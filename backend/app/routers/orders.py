from typing import Literal

from fastapi import APIRouter, BackgroundTasks, Depends, Header, Response, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import current_user
from app.models import Order, User
from app.schemas import CancelIn, CheckoutIn, OrderEventOut, OrderItemOut, OrderOut
from app.services.notifications import send_pushes
from app.services.orders import (
    ACTIVE,
    CANCELLABLE,
    cancel_order,
    create_checkout,
    get_owned_order,
    pay_order,
    sync_order,
)

router = APIRouter(prefix="/api", tags=["orders"])


def order_out(order: Order) -> OrderOut:
    return OrderOut(
        id=order.id,
        order_number=order.order_number,
        status=order.status,
        delivery_mode=order.delivery_mode,
        store_name=order.store.name,
        store_city=order.store.city,
        address_line=order.address_line,
        city=order.city,
        pincode=order.pincode,
        subtotal_cents=order.subtotal_cents,
        delivery_fee_cents=order.delivery_fee_cents,
        total_cents=order.total_cents,
        payment_status=order.payment_status,
        refund_cents=order.refund_cents,
        reservation_expires_at=order.reservation_expires_at,
        cancel_reason=order.cancel_reason,
        cancellable=order.status in CANCELLABLE,
        is_active=order.status in ACTIVE,
        status_changed_at=order.status_changed_at,
        created_at=order.created_at,
        item_count=sum(item.quantity for item in order.items),
        items=[OrderItemOut.model_validate(i) for i in order.items],
        events=[OrderEventOut.model_validate(e) for e in order.events],
    )


@router.post("/checkout", response_model=OrderOut, status_code=status.HTTP_201_CREATED)
def checkout(
    body: CheckoutIn,
    response: Response,
    background: BackgroundTasks,
    idempotency_key: str = Header(alias="Idempotency-Key", min_length=8, max_length=128),
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
):
    order, replayed, notification_ids = create_checkout(db, user, idempotency_key, body)
    if replayed:
        response.status_code = status.HTTP_200_OK
        response.headers["Idempotent-Replayed"] = "true"
    background.add_task(send_pushes, notification_ids)
    return order_out(order)


@router.post("/orders/{order_id}/pay", response_model=OrderOut)
def pay(order_id: int, background: BackgroundTasks, user: User = Depends(current_user), db: Session = Depends(get_db)):
    order, notification_ids = pay_order(db, user, order_id)
    background.add_task(send_pushes, notification_ids)
    return order_out(order)


@router.get("/orders", response_model=list[OrderOut])
def list_orders(
    scope: Literal["active", "past", "all"] = "all",
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
):
    stmt = select(Order).where(Order.user_id == user.id).order_by(Order.created_at.desc()).limit(100)
    if scope == "active":
        stmt = stmt.where(Order.status.in_(ACTIVE))
    elif scope == "past":
        stmt = stmt.where(Order.status.not_in(ACTIVE))
    orders = db.execute(stmt).scalars().all()
    changed = False
    for order in orders:
        if order.status in ACTIVE:
            sync_order(db, order)
            changed = True
    if changed:
        db.commit()
    return [order_out(o) for o in db.execute(stmt).scalars().all()]


@router.get("/orders/{order_id}", response_model=OrderOut)
def get_order(
    order_id: int,
    background: BackgroundTasks,
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
):
    order = get_owned_order(db, user, order_id, lock=True)
    notification_ids = sync_order(db, order) if order.status in ACTIVE else []
    db.commit()
    background.add_task(send_pushes, notification_ids)
    return order_out(get_owned_order(db, user, order_id))


@router.post("/orders/{order_id}/cancel", response_model=OrderOut)
def cancel(
    order_id: int,
    body: CancelIn,
    background: BackgroundTasks,
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
):
    order, notification_ids = cancel_order(db, user, order_id, body.reason.strip())
    background.add_task(send_pushes, notification_ids)
    return order_out(order)
