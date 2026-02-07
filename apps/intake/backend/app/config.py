"""Application configuration loaded from environment variables."""

from pydantic_settings import BaseSettings, SettingsConfigDict
from functools import lru_cache


class Settings(BaseSettings):
    # ── Application ──────────────────────────────────────────────────────
    app_name: str = "Expertly Intake API"
    debug: bool = False
    api_v1_prefix: str = "/api/v1"

    # ── MongoDB ──────────────────────────────────────────────────────────
    mongodb_url: str = "mongodb://localhost:27017"
    mongodb_database: str = "expertly_intake"

    # ── Identity Service (centralized auth) ──────────────────────────────
    identity_api_url: str = "https://identity-api.ai.devintensive.com"

    # ── Intake portal ────────────────────────────────────────────────────
    intake_portal_base_url: str = "https://intake.ai.devintensive.com/portal"

    # ── CORS ──────────────────────────────────────────────────────────────
    cors_origins: list[str] = [
        "http://localhost:5173",
        "http://localhost:3000",
        "https://intake.ai.devintensive.com",
    ]

    # ── File uploads ──────────────────────────────────────────────────────
    file_upload_max_size_bytes: int = 50 * 1024 * 1024  # 50 MB
    file_upload_allowed_types: list[str] = [
        "application/pdf",
        "image/png",
        "image/jpeg",
        "image/webp",
        "text/plain",
        "text/csv",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ]
    file_upload_dir: str = "/tmp/intake_uploads"

    # ── VAPI (voice AI provider) ──────────────────────────────────────────
    vapi_api_key: str = ""

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")


@lru_cache()
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
