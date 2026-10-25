from tests.conftest import demo_headers, register


def test_protected_routes_require_a_token(client):
    assert client.get("/api/cart").status_code == 401
    assert client.get("/api/orders").status_code == 401


def test_invalid_token_is_rejected(client):
    res = client.get("/api/me", headers={"Authorization": "Bearer not-a-real-token"})
    assert res.status_code == 401


def test_login_rejects_wrong_password(client):
    res = client.post("/api/auth/login", json={"email": "demo@grocery.test", "password": "wrong-pass"})
    assert res.status_code == 401


def test_register_then_login_round_trip(client):
    headers = register(client, "new.person@example.com")
    me = client.get("/api/me", headers=headers).json()
    assert me["email"] == "new.person@example.com"
    assert me["selected_store_id"] == 1
    assert client.post("/api/auth/register", json={"email": "new.person@example.com", "password": "password123", "full_name": "Dup"}).status_code == 409


def test_catalog_filters_and_pagination(client):
    page = client.get("/api/products", params={"page_size": 5}).json()
    assert page["total"] >= 60
    assert len(page["items"]) == 5 and page["has_more"] is True

    dairy = client.get("/api/products", params={"category": "dairy-eggs", "page_size": 60}).json()
    assert dairy["items"] and all(p["category"]["slug"] == "dairy-eggs" for p in dairy["items"])

    cheap = client.get("/api/products", params={"max_price_cents": 5000, "sort": "price_desc", "page_size": 60}).json()
    prices = [p["price_cents"] for p in cheap["items"]]
    assert prices and max(prices) <= 5000 and prices == sorted(prices, reverse=True)

    search = client.get("/api/products", params={"q": "mango"}).json()
    assert any("Mango" in p["name"] for p in search["items"])


def test_in_stock_filter_uses_store_availability(client):
    res = client.get("/api/products", params={"in_stock": True})
    assert res.status_code == 400
    page = client.get("/api/products", params={"in_stock": True, "store_id": 1, "page_size": 60}).json()
    assert page["items"] and all(p["availability"]["in_stock"] for p in page["items"])


def test_demo_account_can_sign_in(client):
    assert demo_headers(client)
