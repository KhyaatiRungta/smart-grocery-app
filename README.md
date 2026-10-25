# Smart Grocer

A grocery shopping and order management app. The customer side is an Expo (React Native + TypeScript)
mobile app; the server is FastAPI on PostgreSQL. Stock is tracked per store, checkout reserves stock inside
a database transaction, and orders move through a state machine that drives live tracking and notifications.

```
smart-grocery-app/
├── backend/        FastAPI + SQLAlchemy 2 + PostgreSQL (API, business rules, seed data, pytest suite)
├── mobile/         Expo SDK 58 + expo-router + TanStack Query (iOS, Android, and web preview)
├── .env.example    Backend configuration reference
└── README.md
```

## What's in it

| Area | Implementation |
| --- | --- |
| Browsing | Categories, search (name, brand, category), price bands, sort (popularity, price, name), pagination |
| Stores | Three stores, each with its own stock and prices. The chosen store drives availability and the cart |
| Cart | One bag per store. Quantities are checked against live store stock |
| Checkout | `POST /api/checkout` requires an `Idempotency-Key`. Stock is reserved under `SELECT … FOR UPDATE` in one transaction |
| Payment | Simulated. `POST /api/orders/{id}/pay` approves instantly. No payment provider is involved |
| Tracking | Order status state machine with a timeline. Simulated fulfilment advances each order automatically |
| Cancellation | Allowed until the order is packed. Releases reserved stock and issues a labelled simulated refund if paid |
| Expiry | Checkouts not paid within `RESERVATION_TTL_MINUTES` (default 10) expire and release their stock |
| Notifications | In-app feed, device-token registration, and Expo push attempts that fail quietly when offline |
| Auth | Email and password (bcrypt), JWT bearer tokens. Tokens are kept in SecureStore on devices |

### Checkout guarantees

* **Duplicate requests.** The first request claims `(user_id, Idempotency-Key)` with an insert that is
  part of the checkout transaction. A concurrent duplicate blocks on that unique index, then receives the
  original order (`200` with `Idempotent-Replayed: true`). The same key with a different body returns `422`.
* **No overselling.** Stock rows are locked in `product_id` order, so concurrent checkouts cannot deadlock.
  The test suite races 12 shoppers for 5 units and checks that exactly 5 orders succeed.
* **Atomic failure.** If any line is short, the whole transaction rolls back. No partial reservation remains,
  and the idempotency key can be reused for a retry.
* **Single decrement.** Reserved units move to `on_hand` once, when the order is packed. Cancellation or
  expiry before that point only releases the reservation.

### Order state machine

```
pending_payment ──pay──▶ placed ──▶ confirmed ──▶ packed ──▶ out_for_delivery ──▶ delivered
      │                    │            │
      ├─expire─▶ expired   └──cancel──▶ cancelled ◀──cancel──┘   (cancel allowed until packed)
      └──cancel──▶ cancelled
```

Illegal moves return `409`. Every change is written to `order_events` and creates a notification.

## Run it

### Prerequisites

* Python 3.11+
* PostgreSQL 14+ running locally (`brew install postgresql@16 && brew services start postgresql@16` on macOS)
* Node 20+ (Expo SDK 58 requires a current Node LTS)
* For a phone: Expo Go, or a development build (push notifications need a development build)

### 1. Database

```bash
createdb smart_grocery          # application database
createdb smart_grocery_test     # used by the test suite (tests drop and recreate tables)
```

The default connection is `postgresql+psycopg://localhost/smart_grocery`, which uses your OS user
through local trust auth. Override it with `DATABASE_URL` if your setup differs.

### 2. Backend

```bash
cd backend
python3 -m venv .venv
./.venv/bin/pip install -r requirements.txt
cp ../.env.example .env           # optional: edit DATABASE_URL and JWT_SECRET
./.venv/bin/uvicorn app.main:app --port 8100
```

On startup the app creates the tables and seeds the catalogue (63 products, 8 categories, 3 stores) and a
demo shopper if the database is empty. Nothing needs to be run by hand. Confirm with
`curl localhost:8100/api/health`. Interactive docs are at http://localhost:8100/docs.

Run the tests (they need `smart_grocery_test`):

```bash
cd backend && ./.venv/bin/python -m pytest -q
```

### 3. Mobile app

```bash
cd mobile
npm install
cp .env.example .env              # EXPO_PUBLIC_API_URL=http://localhost:8100
npx expo start                    # press w for web, or scan the QR code with Expo Go
```

On a physical phone, `localhost` points at the phone. Set `EXPO_PUBLIC_API_URL` to your computer's LAN
address (for example `http://192.168.1.20:8100`) and restart Expo.

Demo account: **demo@grocery.test** / **demo1234**. The sign-in screen also has a one-tap demo button.

### Checks

```bash
cd mobile && npx tsc --noEmit     # typecheck
cd backend && ./.venv/bin/python -m pytest -q
```

## Things that are simulated

Be clear about these if you show the app to anyone:

* **Payments.** No card is charged and no provider is called. "Pay" marks the order as
  `paid_simulated`. The order screen labels this as "simulated".
* **Refunds.** Cancelling a paid order sets `refunded_simulated` and records the amount. Nothing is sent to a bank.
* **Fulfilment.** Packing, dispatch, and delivery are automatic. Each stage lasts `SIM_STEP_SECONDS`
  (default 20). A background ticker, and a read of the order, advance the state. There are no real pickers or riders.
* **Push.** The backend sends to Expo's push service when a token is registered. Results are stored as
  `sent`, `failed`, or `skipped` on each notification. Delivery needs a development build with push credentials.
* **Catalogue and stock.** Products, prices, and stock levels are generated seed data. Product images are emoji
  on pastel tiles, not photographs.

## Configuration

See `.env.example`. The main settings:

| Variable | Default | Meaning |
| --- | --- | --- |
| `DATABASE_URL` | `postgresql+psycopg://localhost/smart_grocery` | PostgreSQL connection |
| `JWT_SECRET` | dev value | Set a long random string outside local development |
| `RESERVATION_TTL_MINUTES` | `10` | How long an unpaid checkout holds stock |
| `SIM_STEP_SECONDS` | `20` | Seconds per simulated fulfilment stage |
| `ENABLE_BACKGROUND_TICKER` | `true` | Expire reservations and advance simulated orders in the background |
| `EXPO_PUSH_ENABLED` | `true` | Attempt real Expo push delivery |

## API overview

| Method | Path | Notes |
| --- | --- | --- |
| POST | `/api/auth/register`, `/api/auth/login` | Returns a bearer token |
| GET, PUT | `/api/me`, `/api/me/store` | Current user; choose the store |
| GET | `/api/categories`, `/api/stores`, `/api/stores/{id}` | Reference data |
| GET | `/api/products` | `q`, `category`, `min_price_cents`, `max_price_cents`, `in_stock`, `store_id`, `sort`, `page`, `page_size` |
| GET | `/api/products/{id}` | Optional `store_id` for availability |
| GET, POST | `/api/cart`, `/api/cart/items` | Per-store bag |
| PUT, DELETE | `/api/cart/items/{product_id}` | Set quantity (0 removes) |
| POST | `/api/checkout` | **Requires `Idempotency-Key`.** Reserves stock, returns `pending_payment` |
| POST | `/api/orders/{id}/pay` | Simulated payment, moves the order to `placed` |
| GET | `/api/orders?scope=active\|past\|all` | Order history |
| GET | `/api/orders/{id}` | Detail and timeline. Also catches up simulated fulfilment |
| POST | `/api/orders/{id}/cancel` | Cancel before packing |
| POST | `/api/notifications/devices` | Register an Expo push token |
| GET | `/api/notifications`, POST `/api/notifications/{id}/read`, `/read-all` | In-app feed |

## Project layout

```
backend/app/
  main.py            app factory, lifespan (create tables, seed, ticker)
  models.py          SQLAlchemy models (stock has an explicit `reserved` column)
  services/orders.py state machine, stock locking, idempotent checkout, pay, cancel, sync
  services/notifications.py   notification records and Expo push delivery
  routers/           HTTP layer
  seed.py, catalog_data.py    demo data
backend/tests/       pytest suite against real PostgreSQL
mobile/src/app/      expo-router screens (auth, tabs, product, checkout, order, stores, notifications)
mobile/src/api/      fetch client, types, TanStack Query hooks
mobile/src/components/ shared UI
mobile/src/theme.ts  design tokens
```
#   s m a r t - g r o c e r y - a p p  
 