from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    # Application
    app_name: str = "Salon Booking API"
    debug: bool = False
    api_v1_prefix: str = "/api/v1"

    # MongoDB
    mongodb_url: str = "mongodb://localhost:27017"
    mongodb_database: str = "salon_booking"

    # Identity Service (centralized auth)
    identity_api_url: str = "https://identity.ai.devintensive.com"

    # JWT Authentication (deprecated - kept for backward compatibility)
    jwt_secret_key: str = "change-this-in-production-use-strong-secret"
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 60 * 24  # 24 hours
    refresh_token_expire_days: int = 7

    # Stripe
    stripe_secret_key: str = ""
    stripe_webhook_secret: str = ""
    stripe_connect_client_id: str = ""  # For OAuth Connect flow
    stripe_connect_redirect_url: str = "http://localhost:5173/settings?stripe=connected"

    # Twilio
    twilio_account_sid: str = ""
    twilio_auth_token: str = ""
    twilio_phone_number: str = ""

    # CORS
    cors_origins: list[str] = [
        "https://salon.ai.devintensive.com",
        "http://localhost:5173",
        "http://localhost:3000",
    ]

    # Slot locking
    slot_lock_ttl_seconds: int = 300  # 5 minutes

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


@lru_cache()
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
