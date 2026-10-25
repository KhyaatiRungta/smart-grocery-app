import threading
from concurrent.futures import ThreadPoolExecutor

from sqlalchemy import select

from app.database import SessionLocal
from app.models import CartItem, Order, Store, User
from app.schemas import CheckoutIn
from app.services.orders import create_checkout
from tests.conftest import BANANA_ID, MANGO_ID, STORE_ID, checkout_body, demo_headers, get_stock, idem, register, set_stock


def _cart(client, headers, product_id, qty):
    res = client.post("/api/cart/items", json={"product_id": product_id, "quantity": qty}, headers=headers)
    assert res.status_code == 201, res.text


def test_checkout_reserves_stock_and_is_idempotent(client):
    headers = demo_headers(client)
    set_stock(MANGO_ID, on_hand=10)
    client.delete("/api/cart", headers=headers)
    _cart(client, headers, MANGO_ID, 2)

    key_headers = idem("replay")
    first = client.post("/api/checkout", json=checkout_body(), headers={**headers, **key_headers})
    assert first.status_code == 201, first.text
    order = first.json()
    assert order["status"] == "pending_payment"
    assert get_stock(MANGO_ID) == (10, 2)

    replay = client.post("/api/checkout", json=checkout_body(), headers={**headers, **key_headers})
    assert replay.status_code == 200
    assert replay.headers["Idempotent-Replayed"] == "true"
    assert replay.json()["id"] == order["id"]
    assert get_stock(MANGO_ID) == (10, 2), "a replay must never reserve stock twice"


def test_same_key_with_different_body_is_rejected(client):
    headers = demo_headers(client)
    set_stock(MANGO_ID, on_hand=10)
    client.delete("/api/cart", headers=headers)
    _cart(client, headers, MANGO_ID, 1)
    key = idem("conflict")
    assert client.post("/api/checkout", json=checkout_body(), headers={**headers, **key}).status_code == 201
    changed = {**checkout_body(), "address_line": "Somewhere else entirely"}
    assert client.post("/api/checkout", json=changed, headers={**headers, **key}).status_code == 422


def test_checkout_requires_idempotency_key(client):
    headers = demo_headers(client)
    assert client.post("/api/checkout", json=checkout_body(), headers=headers).status_code == 422


def test_insufficient_stock_rolls_back_everything(client):
    headers = demo_headers(client)
    set_stock(MANGO_ID, on_hand=5)
    set_stock(BANANA_ID, on_hand=5)
    client.delete("/api/cart", headers=headers)
    _cart(client, headers, MANGO_ID, 2)
    _cart(client, headers, BANANA_ID, 2)

    # Someone else buys the bananas after they went into our cart.
    set_stock(BANANA_ID, on_hand=1)
    key = idem("short")
    res = client.post("/api/checkout", json=checkout_body(), headers={**headers, **key})
    assert res.status_code == 409
    assert res.json()["detail"]["product_id"] == BANANA_ID
    assert get_stock(MANGO_ID) == (5, 0), "mangoes must not stay reserved when the order fails"
    assert get_stock(BANANA_ID) == (1, 0)

    # Restock and retry with the same key: the failed attempt left no idempotency claim behind.
    set_stock(BANANA_ID, on_hand=5)
    retry = client.post("/api/checkout", json=checkout_body(), headers={**headers, **key})
    assert retry.status_code == 201, retry.text
    assert get_stock(MANGO_ID) == (5, 2)


def test_concurrent_checkouts_never_oversell(db_reset):
    """Twelve shoppers race for five units. Exactly five orders may succeed."""
    set_stock(MANGO_ID, on_hand=5)
    from app.security import hash_password
    from fastapi import HTTPException

    with SessionLocal() as db:
        store_id = STORE_ID
        user_ids = []
        for n in range(12):
            user = User(email=f"racer{n}@example.com", password_hash=hash_password("password123"), full_name="Racer", selected_store_id=store_id)
            db.add(user)
            db.flush()
            db.add(CartItem(user_id=user.id, store_id=store_id, product_id=MANGO_ID, quantity=1))
            user_ids.append(user.id)
        db.commit()

    barrier = threading.Barrier(12)

    def attempt(user_id: int) -> str:
        barrier.wait()
        with SessionLocal() as db:
            user = db.get(User, user_id)
            try:
                create_checkout(db, user, f"race-{user_id}-abcdef", CheckoutIn(**checkout_body()))
                return "ok"
            except HTTPException as exc:
                assert exc.status_code == 409
                return "sold_out"

    with ThreadPoolExecutor(max_workers=12) as pool:
        outcomes = list(pool.map(attempt, user_ids))

    assert outcomes.count("ok") == 5
    assert outcomes.count("sold_out") == 7
    on_hand, reserved = get_stock(MANGO_ID)
    assert (on_hand, reserved) == (5, 5)
    with SessionLocal() as db:
        placed_for_racers = db.execute(select(Order).where(Order.user_id.in_(user_ids))).scalars().all()
        assert len(placed_for_racers) == 5


def test_cancel_before_payment_releases_reservation(client):
    headers = demo_headers(client)
    set_stock(MANGO_ID, on_hand=4)
    client.delete("/api/cart", headers=headers)
    _cart(client, headers, MANGO_ID, 3)
    order = client.post("/api/checkout", json=checkout_body(), headers={**headers, **idem("cancel")}).json()
    assert get_stock(MANGO_ID) == (4, 3)

    cancelled = client.post(f"/api/orders/{order['id']}/cancel", json={"reason": "Changed plans"}, headers=headers)
    assert cancelled.status_code == 200, cancelled.text
    body = cancelled.json()
    assert body["status"] == "cancelled"
    assert body["refund_cents"] == 0 and body["payment_status"] == "unpaid"
    assert get_stock(MANGO_ID) == (4, 0)


def test_pay_places_order_and_clears_cart(client):
    headers = demo_headers(client)
    set_stock(MANGO_ID, on_hand=4)
    client.delete("/api/cart", headers=headers)
    _cart(client, headers, MANGO_ID, 1)
    order = client.post("/api/checkout", json=checkout_body(), headers={**headers, **idem("pay")}).json()

    paid = client.post(f"/api/orders/{order['id']}/pay", headers=headers)
    assert paid.status_code == 200
    assert paid.json()["status"] == "placed"
    assert paid.json()["payment_status"] == "paid_simulated"
    assert client.get("/api/cart", headers=headers).json()["items"] == []
    assert client.post(f"/api/orders/{order['id']}/pay", headers=headers).status_code == 409


def test_paid_order_cancel_issues_simulated_refund(client):
    headers = demo_headers(client)
    set_stock(MANGO_ID, on_hand=4)
    client.delete("/api/cart", headers=headers)
    _cart(client, headers, MANGO_ID, 1)
    order = client.post("/api/checkout", json=checkout_body(), headers={**headers, **idem("refund")}).json()
    client.post(f"/api/orders/{order['id']}/pay", headers=headers)

    cancelled = client.post(f"/api/orders/{order['id']}/cancel", json={"reason": ""}, headers=headers).json()
    assert cancelled["status"] == "cancelled"
    assert cancelled["payment_status"] == "refunded_simulated"
    assert cancelled["refund_cents"] == order["total_cents"]
    assert get_stock(MANGO_ID) == (4, 0)


def test_fulfilment_advances_and_commits_stock(client):
    headers = demo_headers(client)
    set_stock(MANGO_ID, on_hand=4)
    client.delete("/api/cart", headers=headers)
    _cart(client, headers, MANGO_ID, 2)
    order = client.post("/api/checkout", json=checkout_body(), headers={**headers, **idem("ship")}).json()
    client.post(f"/api/orders/{order['id']}/pay", headers=headers)

    # Pretend the order was placed long ago; reading it catches up the simulator.
    from datetime import timedelta
    from app.models import Order as OrderModel
    from app.database import SessionLocal as Session_
    from app.models import utcnow

    with Session_() as db:
        row = db.get(OrderModel, order["id"])
        row.status_changed_at = utcnow() - timedelta(seconds=200)
        db.commit()

    final = client.get(f"/api/orders/{order['id']}", headers=headers).json()
    assert final["status"] == "delivered"
    assert [e["status"] for e in final["events"]][-1] == "delivered"
    assert get_stock(MANGO_ID) == (2, 0), "stock is decremented once, when the order is packed"

    cancel = client.post(f"/api/orders/{order['id']}/cancel", json={"reason": "too late"}, headers=headers)
    assert cancel.status_code == 409


def test_reservation_expiry_releases_stock(client):
    headers = demo_headers(client)
    set_stock(MANGO_ID, on_hand=4)
    client.delete("/api/cart", headers=headers)
    _cart(client, headers, MANGO_ID, 2)
    order = client.post("/api/checkout", json=checkout_body(), headers={**headers, **idem("expire")}).json()
    assert get_stock(MANGO_ID) == (4, 2)

    from datetime import timedelta
    from app.models import Order as OrderModel, utcnow
    with SessionLocal() as db:
        row = db.get(OrderModel, order["id"])
        row.reservation_expires_at = utcnow() - timedelta(seconds=1)
        db.commit()

    view = client.get(f"/api/orders/{order['id']}", headers=headers).json()
    assert view["status"] == "expired"
    assert get_stock(MANGO_ID) == (4, 0)
    assert client.post(f"/api/orders/{order['id']}/pay", headers=headers).status_code == 409


def test_invalid_status_transition_is_rejected(db_reset):
    from fastapi import HTTPException
    from app.services.orders import transition
    from app.models import Order as OrderModel

    with SessionLocal() as db:
        delivered = db.query(OrderModel).filter(OrderModel.status == "delivered").first()
        try:
            transition(db, delivered, "cancelled")
            raise AssertionError("delivered -> cancelled must be rejected")
        except HTTPException as exc:
            assert exc.status_code == 409


def test_customers_cannot_see_each_others_orders(client):
    demo = demo_headers(client)
    other = register(client, "neighbour@example.com")
    set_stock(MANGO_ID, on_hand=4)
    client.delete("/api/cart", headers=demo)
    _cart(client, demo, MANGO_ID, 1)
    order = client.post("/api/checkout", json=checkout_body(), headers={**demo, **idem("private")}).json()
    assert client.get(f"/api/orders/{order['id']}", headers=other).status_code == 404
    assert client.post(f"/api/orders/{order['id']}/cancel", json={}, headers=other).status_code == 404


def test_empty_cart_and_pickup_fee_rules(client):
    headers = demo_headers(client)
    client.delete("/api/cart", headers=headers)
    assert client.post("/api/checkout", json=checkout_body(), headers={**headers, **idem("empty")}).status_code == 400

    set_stock(BANANA_ID, on_hand=20)
    _cart(client, headers, BANANA_ID, 1)
    pickup = client.post(
        "/api/checkout", json={"delivery_mode": "pickup"}, headers={**headers, **idem("pickup")}
    ).json()
    assert pickup["delivery_fee_cents"] == 0 and pickup["address_line"] == ""


def test_notifications_are_written_on_status_change_and_devices_register(client):
    headers = demo_headers(client)
    set_stock(MANGO_ID, on_hand=4)
    client.delete("/api/cart", headers=headers)
    _cart(client, headers, MANGO_ID, 1)
    order = client.post("/api/checkout", json=checkout_body(), headers={**headers, **idem("notify")}).json()
    client.post(f"/api/orders/{order['id']}/pay", headers=headers)

    register_device = client.post(
        "/api/notifications/devices",
        json={"token": "ExponentPushToken[testtoken123456]", "platform": "ios"},
        headers=headers,
    )
    assert register_device.status_code == 204
    feed = client.get("/api/notifications", headers=headers).json()
    titles = " ".join(n["title"] for n in feed["items"])
    assert "Checkout started" in titles and "Order placed" in titles
    assert feed["unread_count"] >= 2
    assert all(n["push_status"] in {"skipped", "sent", "failed"} for n in feed["items"])

    client.post("/api/notifications/read-all", headers=headers)
    assert client.get("/api/notifications", headers=headers).json()["unread_count"] == 0
