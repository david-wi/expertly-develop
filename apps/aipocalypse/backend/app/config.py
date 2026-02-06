from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    # MongoDB
    mongodb_url: str = "mongodb://localhost:27017"
    database_name: str = "aipocalypse_fund"

    # Identity Service
    identity_api_url: str = "https://identity.ai.devintensive.com"

    # Auth
    skip_auth: bool = False

    # App
    app_name: str = "Aipocalypse Fund"
    debug: bool = False
    log_level: str = "INFO"

    # AI
    anthropic_api_key: str = ""

    # SEC EDGAR
    sec_edgar_user_agent: str = ""

    # Queue
    queue_batch_size: int = 5

    # Default model
    default_model: str = "claude-sonnet-4-20250514"

    class Config:
        env_file = ".env"
        extra = "ignore"


@lru_cache
def get_settings() -> Settings:
    return Settings()
