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

    # Anthropic (for AI-assisted features)
    anthropic_api_key: str = ""

    # Deepgram (for text-to-speech)
    deepgram_api_key: str = ""

    # OAuth - Google
    google_client_id: str = ""
    google_client_secret: str = ""

    # OAuth - Slack
    slack_client_id: str = ""
    slack_client_secret: str = ""

    # OAuth - Microsoft
    microsoft_client_id: str = ""
    microsoft_client_secret: str = ""

    # Encryption key for tokens (Fernet key)
    connection_encryption_key: str = ""

    # App URLs (for OAuth redirects)
    app_base_url: str = "https://manage.ai.devintensive.com"
    frontend_url: str = "https://manage.ai.devintensive.com"

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
