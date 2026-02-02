"""Application configuration from environment variables."""

from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    """Application settings loaded from environment."""

    # Database
    database_url: str = "postgresql+asyncpg://admin:admin@localhost:5432/expertly_admin"

    # API
    api_prefix: str = "/api"

    # Environment
    environment: str = "development"
    debug: bool = True

    # CORS
    cors_origins: str = "https://admin.ai.devintensive.com,http://localhost:5173,http://localhost:3000"

    # Identity service
    identity_api_url: str = "https://identity-api.ai.devintensive.com"
    skip_auth: bool = False
    default_user_id: str = "dev-user"
    default_user_name: str = "Developer"
    default_user_email: str = "dev@example.com"

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


@lru_cache
def get_settings() -> Settings:
    """Get cached settings instance."""
    return Settings()
