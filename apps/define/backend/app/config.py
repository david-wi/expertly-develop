from pydantic_settings import BaseSettings
from pydantic import field_validator
from functools import lru_cache


class Settings(BaseSettings):
    # PostgreSQL (required for production)
    database_url: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/expertly_define"

    # Auth
    skip_auth: bool = False
    identity_api_url: str = "https://identity.ai.devintensive.com"
    session_cookie_name: str = "expertly_session"

    # App
    app_name: str = "Expertly Define"
    debug: bool = False
    log_level: str = "INFO"

    # AI Provider API Keys
    anthropic_api_key: str = ""
    openai_api_key: str = ""
    groq_api_key: str = ""
    google_api_key: str = ""

    # Uploads
    uploads_dir: str = "./uploads"

    # Default user settings (for dev/seed)
    default_user_id: str = "dev-user-1"
    default_user_name: str = "David"
    default_user_email: str = "david@example.com"

    @field_validator('database_url')
    @classmethod
    def validate_database_url(cls, v: str) -> str:
        if v.startswith('sqlite'):
            raise ValueError("SQLite is no longer supported. Use PostgreSQL with asyncpg.")
        return v

    class Config:
        env_file = ".env"
        extra = "ignore"


@lru_cache
def get_settings() -> Settings:
    return Settings()
