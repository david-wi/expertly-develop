"""Application configuration."""
from functools import lru_cache
from typing import Optional

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    # Environment
    env: str = "development"
    debug: bool = False

    # Database
    database_url: str = "postgresql://localhost:5432/vibeqa"

    # Identity Service (centralized auth)
    identity_api_url: str = "https://identity.ai.devintensive.com"

    # Security (legacy - kept for backward compatibility)
    secret_key: str = "change-me-in-production"
    encryption_key: str = "change-me-in-production-32bytes!"
    access_token_expire_minutes: int = 60 * 24  # 24 hours

    # AI
    anthropic_api_key: Optional[str] = None

    # Storage
    artifacts_path: str = "./data/artifacts"

    # Analytics
    analytics_enabled: bool = False
    amplitude_api_key: Optional[str] = None
    mixpanel_token: Optional[str] = None

    # CORS - stored as comma-separated string for env var compatibility
    cors_origins_str: str = "http://localhost:5173,http://localhost:3000"

    @property
    def cors_origins(self) -> list[str]:
        """Get CORS origins as a list."""
        return [origin.strip() for origin in self.cors_origins_str.split(",") if origin.strip()]

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


@lru_cache
def get_settings() -> Settings:
    """Get cached settings instance."""
    return Settings()
