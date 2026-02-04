from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    # MongoDB
    mongodb_url: str = "mongodb://localhost:27017"
    database_name: str = "expertly_tms"

    # Identity Service (centralized auth)
    identity_api_url: str = "https://identity.ai.devintensive.com"

    # Auth
    skip_auth: bool = False

    # App
    app_name: str = "Expertly TMS"
    debug: bool = False
    log_level: str = "INFO"

    # AI (for email extraction and drafting)
    anthropic_api_key: str = ""

    # Admin API (for AI config)
    admin_api_url: str = "https://admin-api.ai.devintensive.com"

    # App URLs
    app_base_url: str = "https://tms.ai.devintensive.com"
    frontend_url: str = "https://tms.ai.devintensive.com"

    # Default user settings (for dev/seed)
    default_org_name: str = "Demo Broker"
    default_org_slug: str = "demo-broker"
    default_user_name: str = "Demo User"
    default_user_email: str = "demo@example.com"

    class Config:
        env_file = ".env"
        extra = "ignore"


@lru_cache
def get_settings() -> Settings:
    return Settings()
