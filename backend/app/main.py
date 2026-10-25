import asyncio
import logging
from contextlib import asynccontextmanager, suppress

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.database import Base, SessionLocal, engine
from app import models  # noqa: F401  (register tables)
from app.routers import auth, cart, catalog, notifications, orders
from app.seed import seed_database
from app.services.notifications import send_pushes
from app.services.orders import sync_all

log = logging.getLogger("grocery")
TICK_SECONDS = 5


def run_sync_cycle() -> None:
    with SessionLocal() as db:
        notification_ids = sync_all(db)
    send_pushes(notification_ids)


async def _ticker() -> None:
    while True:
        try:
            await asyncio.to_thread(run_sync_cycle)
        except Exception:  # keep the ticker alive; errors are logged
            log.exception("order sync cycle failed")
        await asyncio.sleep(TICK_SECONDS)


@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(engine)
    with SessionLocal() as db:
        seed_database(db)
    task = asyncio.create_task(_ticker()) if get_settings().enable_background_ticker else None
    yield
    if task:
        task.cancel()
        with suppress(asyncio.CancelledError):
            await task


def create_app() -> FastAPI:
    settings = get_settings()
    app = FastAPI(title="Smart Grocer API", version="1.0.0", lifespan=lifespan)
    origins = [o.strip() for o in settings.cors_origins.split(",") if o.strip()]
    app.add_middleware(
        CORSMiddleware,
        allow_origins=origins,
        allow_credentials=False,
        allow_methods=["*"],
        allow_headers=["*"],
        expose_headers=["Idempotent-Replayed"],
    )
    app.include_router(auth.router)
    app.include_router(catalog.router)
    app.include_router(cart.router)
    app.include_router(orders.router)
    app.include_router(notifications.router)

    @app.get("/api/health", tags=["meta"])
    def health():
        return {"status": "ok", "simulated_payments": True}

    return app


app = create_app()
