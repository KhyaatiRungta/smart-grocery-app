"""Tests run against a real PostgreSQL database (default: smart_grocery_test).

The database is dropped and re-seeded for every test, so the suite is deterministic.
"""

import os

TEST_DB = os.environ.get("TEST_DATABASE_URL", "postgresql+psycopg://localhost/smart_grocery_test")
assert "test" in TEST_DB, "Refusing to run destructive tests against a non-test database"

os.environ["DATABASE_URL"] = TEST_DB
os.environ["ENABLE_BACKGROUND_TICKER"] = "false"
os.environ["EXPO_PUSH_ENABLED"] = "false"
os.environ["SIM_STEP_SECONDS"] = "20"
os.environ["RESERVATION_TTL_MINUTES"] = "10"
os.environ["JWT_SECRET"] = "test-secret-not-for-production-0123456789abcdef"

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402
from sqlalchemy import select  # noqa: E402

from app.database import Base, SessionLocal, engine  # noqa: E402
from app.main import app  # noqa: E402
from app.models import StoreStock  # noqa: E402
from app.seed import seed_database  # noqa: E402

STORE_ID = 1
MANGO_ID = 1  # 52900 paise
BANANA_ID = 2  # 5400 paise


@pytest.fixture()
def db_reset():
    Base.metadata.drop_all(engine)
    Base.metadata.create_all(engine)
    with SessionLocal() as db:
        seed_database(db)
    yield


@pytest.fixture()
def client(db_reset):
    with TestClient(app) as test_client:
        yield test_client


def set_stock(product_id: int, on_hand: int, reserved: int = 0, store_id: int = STORE_ID) -> None:
    with SessionLocal() as db:
        row = db.execute(
            select(StoreStock).where(StoreStock.store_id == store_id, StoreStock.product_id == product_id)
        ).scalar_one()
        row.on_hand = on_hand
        row.reserved = reserved
        db.commit()


def get_stock(product_id: int, store_id: int = STORE_ID) -> tuple[int, int]:
    with SessionLocal() as db:
        row = db.execute(
            select(StoreStock).where(StoreStock.store_id == store_id, StoreStock.product_id == product_id)
        ).scalar_one()
        return row.on_hand, row.reserved


def register(client, email: str = "shopper@example.com", password: str = "password123") -> dict:
    res = client.post(
        "/api/auth/register", json={"email": email, "password": password, "full_name": "Test Shopper"}
    )
    assert res.status_code == 201, res.text
    return {"Authorization": f"Bearer {res.json()['access_token']}"}


def demo_headers(client) -> dict:
    res = client.post("/api/auth/login", json={"email": "demo@grocery.test", "password": "demo1234"})
    assert res.status_code == 200, res.text
    return {"Authorization": f"Bearer {res.json()['access_token']}"}


def checkout_body() -> dict:
    return {
        "delivery_mode": "delivery",
        "address_line": "12 MG Road, Flat 4B",
        "city": "Bengaluru",
        "pincode": "560001",
    }


def idem(prefix: str = "key") -> dict:
    return {"Idempotency-Key": f"{prefix}-{os.urandom(6).hex()}"}
