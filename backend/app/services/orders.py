"""Order lifecycle, stock reservation and checkout.

Lifecycle (every change goes through `transition`, which enforces TRANSITIONS):

    pending_payment -> placed -> confirmed -> packed -> out_for_delivery -> delivered
           |               |           |
           v               v           v
       expired        cancelled   cancelled     (cancelled/expired release reserved stock)

Stock model: StoreStock.reserved is held at checkout creation. Reserved units are
committed (on_hand -= qty and reserved -= qty) when the order is packed. Until then
they can be released by cancellation or reservation expiry.
"""

import hashlib
import json
import secrets
from datetime import datetime, timedelta

from fastapi import HTTPException, status
from sqlalchemy import delete, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.config import get_settings
from app.models import CartItem, IdempotencyKey, Order, OrderEvent, OrderItem, StoreStock, User, utcnow
from app.schemas import CheckoutIn
from app.services.notifications import add_notification

TRANSITIONS: dict[str, set[str]] = {
    "pending_payment": {"placed", "expired", "cancelled"},
    "placed": {"confirmed", "cancelled"},
    "confirmed": {"packed", "cancelled"},
    "packed": {"out_for_delivery"},
    "out_for_delivery": {"delivered"},
    "delivered": set(),
    "cancelled": set(),
    "expired": set(),
}
CANCELLABLE = {"pending_payment", "placed", "confirmed"}
SIMULATED_PIPELINE = ["placed", "confirmed", "packed", "out_for_delivery", "delivered"]
ACTIVE = {"pending_payment", "placed", "confirmed", "packed", "out_for_delivery"}

STATUS_COPY: dict[str, tuple[str, str]] = {
    "pending_payment": ("Checkout started", "Complete payment to lock in your order."),
    "placed": ("Order placed", "We've received your order."),
    "confirmed": ("Order confirmed", "The store has accepted your order."),
    "packed": ("Packed", "Your items are packed and ready for pickup by the rider."),
    "out_for_delivery": ("Out for delivery", "Your rider is on the way."),
    "delivered": ("Delivered", "Enjoy your groceries!"),
    "cancelled": ("Order cancelled", "Your order has been cancelled."),
    "expired": ("Reservation expired", "Payment wasn't completed in time, so the stock was released."),
}


def rupees(cents: int) -> str:
    if cents % 100 == 0:
        return f"₹{cents // 100:,}"
    return f"₹{cents / 100:,.2f}"


def new_order_number() -> str:
    return f"SG{utcnow():%y%m%d}-{secrets.token_hex(3).upper()}"


def load_order(db: Session, order_id: int, *, lock: bool = False) -> Order | None:
    stmt = select(Order).where(Order.id == order_id).execution_options(populate_existing=True)
    if lock:
        stmt = stmt.with_for_update(of=Order)
    return db.execute(stmt).unique().scalar_one_or_none()


def get_owned_order(db: Session, user: User, order_id: int, *, lock: bool = False) -> Order:
    order = load_order(db, order_id, lock=lock)
    if order is None or order.user_id != user.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Order not found")
    return order


def lock_stock(db: Session, store_id: int, product_ids: list[int]) -> dict[int, StoreStock]:
    """Lock stock rows in product_id order so concurrent checkouts cannot deadlock."""
    if not product_ids:
        return {}
    rows = (
        db.execute(
            select(StoreStock)
            .where(StoreStock.store_id == store_id, StoreStock.product_id.in_(product_ids))
            .order_by(StoreStock.product_id)
            .with_for_update()
        )
        .scalars()
        .all()
    )
    return {row.product_id: row for row in rows}


def release_stock(db: Session, order: Order) -> None:
    if order.stock_committed:
        return
    stock = lock_stock(db, order.store_id, [item.product_id for item in order.items])
    for item in order.items:
        row = stock.get(item.product_id)
        if row is not None:
            row.reserved = max(row.reserved - item.quantity, 0)


def commit_stock(db: Session, order: Order) -> None:
    stock = lock_stock(db, order.store_id, [item.product_id for item in order.items])
    for item in order.items:
        row = stock[item.product_id]
        row.on_hand -= item.quantity
        row.reserved -= item.quantity
    order.stock_committed = True


def transition(
    db: Session,
    order: Order,
    new_status: str,
    *,
    at: datetime | None = None,
    detail: str = "",
    body: str | None = None,
) -> list[int]:
    """Move an order to new_status, updating stock, timeline and notifications.

    Returns the ids of notifications created (for push dispatch after commit).
    """
    allowed = TRANSITIONS.get(order.status, set())
    if new_status not in allowed:
        raise HTTPException(
            status.HTTP_409_CONFLICT, f"Cannot change order from '{order.status}' to '{new_status}'"
        )
    when = at or utcnow()
    if new_status == "packed":
        commit_stock(db, order)
    elif new_status in {"cancelled", "expired"}:
        release_stock(db, order)

    order.status = new_status
    order.status_changed_at = when
    title, default_body = STATUS_COPY[new_status]
    message = body or default_body
    db.add(OrderEvent(order_id=order.id, status=new_status, title=title, detail=detail or message, created_at=when))
    note = add_notification(
        db, user_id=order.user_id, order_id=order.id, title=f"{order.order_number} · {title}", body=message
    )
    return [note.id]


def sync_order(db: Session, order: Order, now: datetime | None = None) -> list[int]:
    """Bring one order up to date with the clock: expire stale checkouts and advance
    simulated fulfilment one stage per SIM_STEP_SECONDS (catches up if time was skipped)."""
    now = now or utcnow()
    step = timedelta(seconds=get_settings().sim_step_seconds)
    notification_ids: list[int] = []

    if (
        order.status == "pending_payment"
        and order.reservation_expires_at is not None
        and order.reservation_expires_at <= now
    ):
        return transition(db, order, "expired", at=now)

    while order.status in SIMULATED_PIPELINE[:-1] and now - order.status_changed_at >= step:
        next_status = SIMULATED_PIPELINE[SIMULATED_PIPELINE.index(order.status) + 1]
        notification_ids += transition(
            db, order, next_status, at=order.status_changed_at + step, detail="Updated by fulfilment simulator"
        )
    return notification_ids


def sync_all(db: Session, limit: int = 500) -> list[int]:
    """Background ticker entry point. Locks each order row while it is updated."""
    ids = db.execute(select(Order.id).where(Order.status.in_(ACTIVE)).limit(limit)).scalars().all()
    notification_ids: list[int] = []
    for order_id in ids:
        order = load_order(db, order_id, lock=True)
        if order is not None:
            notification_ids += sync_order(db, order)
    db.commit()
    return notification_ids


def request_hash(store_id: int, body: CheckoutIn) -> str:
    canonical = json.dumps({"store_id": store_id, **body.model_dump()}, sort_keys=True)
    return hashlib.sha256(canonical.encode()).hexdigest()


def create_checkout(db: Session, user: User, idempotency_key: str, body: CheckoutIn) -> tuple[Order, bool, list[int]]:
    """Reserve stock for the user's cart and create a pending_payment order.

    Returns (order, replayed, notification_ids). Replays with the same Idempotency-Key
    return the original order and never touch stock again.
    """
    settings = get_settings()
    if user.selected_store_id is None:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Select a store before checking out")
    store_id = user.selected_store_id
    digest = request_hash(store_id, body)

    marker = IdempotencyKey(user_id=user.id, key=idempotency_key, request_hash=digest)
    db.add(marker)
    try:
        # The unique (user_id, key) row is the claim. A concurrent duplicate blocks here until
        # this transaction commits or rolls back, then fails with IntegrityError.
        db.flush()
    except IntegrityError:
        db.rollback()
        existing = db.execute(
            select(IdempotencyKey).where(IdempotencyKey.user_id == user.id, IdempotencyKey.key == idempotency_key)
        ).scalar_one()
        if existing.request_hash != digest:
            raise HTTPException(
                422, "Idempotency-Key was already used for a different request"
            )
        if existing.order_id is None:
            raise HTTPException(status.HTTP_409_CONFLICT, "A request with this Idempotency-Key is still processing")
        return load_order(db, existing.order_id), True, []

    try:
        cart = (
            db.execute(select(CartItem).where(CartItem.user_id == user.id, CartItem.store_id == store_id).order_by(CartItem.id))
            .scalars()
            .all()
        )
        if not cart:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "Your cart is empty")

        stock = lock_stock(db, store_id, [line.product_id for line in cart])
        for line in cart:
            row = stock.get(line.product_id)
            available = row.available if row else 0
            if available < line.quantity:
                raise HTTPException(
                    status.HTTP_409_CONFLICT,
                    {
                        "message": f"Only {available} left of {line.product.name}",
                        "product_id": line.product_id,
                        "available": available,
                    },
                )

        subtotal = sum(line.product.price_cents * line.quantity for line in cart)
        pickup = body.delivery_mode == "pickup"
        delivery_fee = 0 if pickup or subtotal >= settings.free_delivery_threshold_cents else settings.delivery_fee_cents
        now = utcnow()
        order = Order(
            order_number=new_order_number(),
            user_id=user.id,
            store_id=store_id,
            status="pending_payment",
            delivery_mode=body.delivery_mode,
            address_line="" if pickup else body.address_line,
            city="" if pickup else body.city,
            pincode="" if pickup else body.pincode,
            subtotal_cents=subtotal,
            delivery_fee_cents=delivery_fee,
            total_cents=subtotal + delivery_fee,
            payment_status="unpaid",
            reservation_expires_at=now + timedelta(minutes=settings.reservation_ttl_minutes),
            status_changed_at=now,
        )
        db.add(order)
        db.flush()

        for line in cart:
            stock[line.product_id].reserved += line.quantity
            db.add(
                OrderItem(
                    order_id=order.id,
                    product_id=line.product_id,
                    product_name=line.product.name,
                    unit=line.product.unit,
                    emoji=line.product.emoji,
                    unit_price_cents=line.product.price_cents,
                    quantity=line.quantity,
                    line_total_cents=line.product.price_cents * line.quantity,
                )
            )
        db.add(
            OrderEvent(
                order_id=order.id,
                status="pending_payment",
                title=STATUS_COPY["pending_payment"][0],
                detail=f"Stock reserved for {settings.reservation_ttl_minutes} minutes",
                created_at=now,
            )
        )
        note = add_notification(
            db,
            user_id=user.id,
            order_id=order.id,
            title=f"{order.order_number} · Checkout started",
            body=STATUS_COPY["pending_payment"][1],
        )
        marker.order_id = order.id
        db.commit()
    except Exception:
        db.rollback()
        raise
    return load_order(db, order.id), False, [note.id]


def pay_order(db: Session, user: User, order_id: int) -> tuple[Order, list[int]]:
    """Simulated payment: approves instantly and moves the order to `placed`."""
    order = get_owned_order(db, user, order_id, lock=True)
    if order.status != "pending_payment":
        raise HTTPException(status.HTTP_409_CONFLICT, "This order is not awaiting payment")
    now = utcnow()
    if order.reservation_expires_at and order.reservation_expires_at <= now:
        transition(db, order, "expired", at=now)
        db.commit()
        raise HTTPException(status.HTTP_409_CONFLICT, "Reservation expired; please check out again")
    order.payment_status = "paid_simulated"
    ids = transition(db, order, "placed", detail=f"Simulated card payment of {rupees(order.total_cents)} approved")
    db.execute(delete(CartItem).where(CartItem.user_id == user.id, CartItem.store_id == order.store_id))
    db.commit()
    return load_order(db, order.id), ids


def cancel_order(db: Session, user: User, order_id: int, reason: str) -> tuple[Order, list[int]]:
    order = get_owned_order(db, user, order_id, lock=True)
    if order.status not in CANCELLABLE:
        raise HTTPException(status.HTTP_409_CONFLICT, "Orders can't be cancelled once they have been packed")
    detail = reason or "Cancelled by customer"
    body = "Your order has been cancelled and reserved stock released."
    if order.payment_status == "paid_simulated":
        order.payment_status = "refunded_simulated"
        order.refund_cents = order.total_cents
        body = f"Cancelled. A simulated refund of {rupees(order.refund_cents)} has been issued."
    order.cancel_reason = detail[:255]
    ids = transition(db, order, "cancelled", detail=detail, body=body)
    db.commit()
    return load_order(db, order.id), ids
