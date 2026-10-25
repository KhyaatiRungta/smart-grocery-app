from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

BACKEND_DIR = Path(__file__).resolve().parent.parent


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=BACKEND_DIR / ".env", extra="ignore")

    database_url: str = "postgresql+psycopg://localhost/smart_grocery"
    jwt_secret: str = "dev-only-secret-change-me-to-a-long-random-value"
    jwt_algorithm: str = "HS256"
    jwt_expire_minutes: int = 60 * 24 * 7
    reservation_ttl_minutes: int = 10
    sim_step_seconds: int = 20
    enable_background_ticker: bool = True
    expo_push_enabled: bool = True
    expo_push_url: str = "https://exp.host/--/api/v2/push/send"
    cors_origins: str = "*"
    delivery_fee_cents: int = 3900
    free_delivery_threshold_cents: int = 49900


@lru_cache
def get_settings() -> Settings:
    return Settings()
