"""Idempotent demo data: catalogue, stores, stock levels and a demo shopper with order history."""

import random
from datetime import timedelta

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.catalog_data import CATEGORIES, PRODUCTS, STORES
from app.models import Category, Order, OrderEvent, OrderItem, Product, Store, StoreStock, User, utcnow
from app.security import hash_password
from app.services.orders import new_order_number

DEMO_EMAIL = "demo@grocery.test"
DEMO_PASSWORD = "demo1234"


def seed_database(db: Session) -> bool:
    """Insert demo data when the database is empty. Returns True if anything was inserted."""
    if db.execute(select(Category.id).limit(1)).first() is not None:
        return False

    categories = {}
    for cat in CATEGORIES:
        row = Category(**cat)
        db.add(row)
        categories[cat["slug"]] = row
    db.flush()

    products = []
    for sku, name, brand, unit, price, emoji, cat_slug, popularity in PRODUCTS:
        product = Product(
            sku=sku,
            name=name,
            brand=brand,
            unit=unit,
            price_cents=price,
            emoji=emoji,
            bg_color=categories[cat_slug].color,
            popularity=popularity,
            category_id=categories[cat_slug].id,
            description=(
                f"{name} from {brand}, sold in {unit}. Checked at the store before dispatch. "
                "Free replacement if quality isn't right on arrival."
            ),
        )
        db.add(product)
        products.append(product)
    db.flush()

    stores = []
    for store in STORES:
        row = Store(**store)
        db.add(row)
        stores.append(row)
    db.flush()

    rng = random.Random(42)
    for store in stores:
        for product, (*_, popularity) in zip(products, PRODUCTS):
            # Popular items are stocked deeper; some niche items are occasionally out of stock.
            depth = 5 + popularity // 4
            on_hand = rng.randint(0, depth + 25) if rng.random() > 0.08 else 0
            db.add(StoreStock(store_id=store.id, product_id=product.id, on_hand=on_hand, reserved=0))

    demo = User(
        email=DEMO_EMAIL,
        password_hash=hash_password(DEMO_PASSWORD),
        full_name="Ananya Rao",
        selected_store_id=stores[0].id,
    )
    db.add(demo)
    db.flush()
    _seed_history(db, demo, stores[0], products)
    db.commit()
    return True


def _seed_history(db: Session, user: User, store: Store, products: list[Product]) -> None:
    """One delivered and one cancelled order so the Orders tab is not empty on first launch."""
    now = utcnow()
    scenarios = [
        (now - timedelta(days=6), "delivered", [0, 2, 12, 24], None),
        (now - timedelta(days=2), "cancelled", [30, 40], "Changed my mind"),
    ]
    titles = {
        "placed": "Order placed",
        "confirmed": "Order confirmed",
        "packed": "Packed",
        "out_for_delivery": "Out for delivery",
        "delivered": "Delivered",
        "cancelled": "Order cancelled",
    }
    for placed_at, final_status, picks, cancel_reason in scenarios:
        chosen = [products[i] for i in picks]
        subtotal = sum(p.price_cents for p in chosen)
        fee = 0 if subtotal >= 49900 else 3900
        refunded = final_status == "cancelled"
        order = Order(
            order_number=new_order_number(),
            user_id=user.id,
            store_id=store.id,
            status=final_status,
            delivery_mode="delivery",
            address_line="221B, 4th Cross, Jyoti Nivas College Rd",
            city="Bengaluru",
            pincode="560095",
            subtotal_cents=subtotal,
            delivery_fee_cents=fee,
            total_cents=subtotal + fee,
            payment_status="refunded_simulated" if refunded else "paid_simulated",
            refund_cents=subtotal + fee if refunded else 0,
            cancel_reason=cancel_reason,
            stock_committed=final_status == "delivered",
            status_changed_at=placed_at + timedelta(minutes=50),
            created_at=placed_at,
        )
        db.add(order)
        db.flush()
        for product in chosen:
            db.add(
                OrderItem(
                    order_id=order.id,
                    product_id=product.id,
                    product_name=product.name,
                    unit=product.unit,
                    emoji=product.emoji,
                    unit_price_cents=product.price_cents,
                    quantity=1,
                    line_total_cents=product.price_cents,
                )
            )
        timeline = ["placed", "cancelled"] if refunded else ["placed", "confirmed", "packed", "out_for_delivery", "delivered"]
        for i, stage in enumerate(timeline):
            db.add(
                OrderEvent(
                    order_id=order.id,
                    status=stage,
                    title=titles[stage],
                    detail=cancel_reason or "",
                    created_at=placed_at + timedelta(minutes=i * 12),
                )
            )
