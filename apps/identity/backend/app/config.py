from functools import lru_cache
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Application settings."""

    app_name: str = "Expertly Identity"
    debug: bool = False

    # Database
    database_url: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/identity"

    # Redis
    redis_url: str = "redis://localhost:6379"

    # OpenAI for avatar generation
    openai_api_key: str = ""

    # Auth settings
    auth_cookie_domain: str = ".ai.devintensive.com"
    session_expiry_days: int = 30
    session_secret: str = "change-me-in-production"

    # Frontend URL for password reset links
    identity_frontend_url: str = "https://identity.ai.devintensive.com"

    class Config:
        env_file = ".env"


@lru_cache()
def get_settings() -> Settings:
    return Settings()
