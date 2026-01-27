from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    # SQLite
    database_url: str = "sqlite:///./data/expertly-define.db"

    # Auth
    skip_auth: bool = False
    identity_api_url: str = "https://identity.ai.devintensive.com"
    session_cookie_name: str = "expertly_session"

    # App
    app_name: str = "Expertly Define"
    debug: bool = False
    log_level: str = "INFO"

    # Anthropic (for AI features)
    anthropic_api_key: str = ""

    # Uploads
    uploads_dir: str = "./uploads"

    # Default user settings (for dev/seed)
    default_user_id: str = "dev-user-1"
    default_user_name: str = "David"
    default_user_email: str = "david@example.com"

    class Config:
        env_file = ".env"
        extra = "ignore"


@lru_cache
def get_settings() -> Settings:
    return Settings()
