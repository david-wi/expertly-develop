from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    # MongoDB
    mongodb_url: str = "mongodb://localhost:27017"
    database_name: str = "expertly_manage"

    # Identity Service (centralized auth)
    identity_api_url: str = "https://identity.ai.devintensive.com"

    # Auth (legacy - kept for backward compatibility)
    skip_auth: bool = False
    api_key_prefix: str = "em_live_"

    # App
    app_name: str = "Expertly Manage"
    debug: bool = False
    log_level: str = "INFO"

    # OpenAI (for avatar generation)
    openai_api_key: str = ""

    # Default user settings (for dev/seed)
    default_org_name: str = "David"
    default_org_slug: str = "david"
    default_user_name: str = "David"
    default_user_email: str = "david@example.com"
    default_api_key: str = "em_live_dev_david_key_12345"

    class Config:
        env_file = ".env"
        extra = "ignore"


@lru_cache
def get_settings() -> Settings:
    return Settings()
