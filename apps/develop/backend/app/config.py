"""Application configuration."""

from functools import lru_cache
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    # Application
    app_name: str = "Expertly Develop"
    debug: bool = False
    api_v1_prefix: str = "/api/v1"

    # MongoDB
    mongodb_url: str = "mongodb://localhost:27017"
    mongodb_database: str = "expertly_develop"

    # Security
    encryption_key: str = ""  # Must be set in production

    # Identity Service (centralized auth)
    identity_api_url: str = "https://identity.ai.devintensive.com"

    # Worker
    job_poll_interval: int = 2  # seconds
    max_concurrent_jobs: int = 3

    # Storage
    max_inline_size: int = 1024 * 100  # 100KB - store inline if smaller

    class Config:
        env_file = ".env"
        case_sensitive = False


@lru_cache
def get_settings() -> Settings:
    """Get cached settings instance."""
    return Settings()
