"""
AI Configuration Client - fetches model config from Admin API.
"""
import os
import time
import httpx
from typing import Optional
from dataclasses import dataclass


@dataclass
class UseCaseConfig:
    """Configuration for a specific use case."""
    use_case: str
    model_id: str
    max_tokens: int
    temperature: float


# Cache for AI config
_config_cache: Optional[dict] = None
_config_cache_time: float = 0
_CONFIG_CACHE_TTL = 5 * 60  # 5 minutes

# Default fallback values
DEFAULT_MODEL = "dall-e-3"  # For image generation
DEFAULT_MAX_TOKENS = 4096
DEFAULT_TEMPERATURE = 0.7


def get_admin_api_url() -> str:
    """Get the Admin API URL from environment."""
    return os.getenv("ADMIN_API_URL", "https://admin-api.ai.devintensive.com")


def _fetch_config() -> Optional[dict]:
    """Fetch AI configuration from Admin API."""
    global _config_cache, _config_cache_time

    now = time.time()
    if _config_cache and now - _config_cache_time < _CONFIG_CACHE_TTL:
        return _config_cache

    try:
        url = f"{get_admin_api_url()}/api/public/ai-config"
        response = httpx.get(url, timeout=5.0)
        if response.status_code == 200:
            _config_cache = response.json()
            _config_cache_time = now
            return _config_cache
    except Exception as e:
        print(f"[AIConfig] Failed to fetch from Admin API: {e}")

    return None


def get_use_case_config(use_case: str) -> UseCaseConfig:
    """
    Get model configuration for a specific use case.

    Falls back to defaults if Admin API is unavailable.
    """
    config = _fetch_config()

    if config and "use_cases" in config:
        for uc in config["use_cases"]:
            if uc.get("use_case") == use_case:
                return UseCaseConfig(
                    use_case=uc["use_case"],
                    model_id=uc.get("model_id", DEFAULT_MODEL),
                    max_tokens=uc.get("max_tokens", DEFAULT_MAX_TOKENS),
                    temperature=uc.get("temperature", DEFAULT_TEMPERATURE),
                )

    # Default fallback
    return UseCaseConfig(
        use_case=use_case,
        model_id=DEFAULT_MODEL,
        max_tokens=DEFAULT_MAX_TOKENS,
        temperature=DEFAULT_TEMPERATURE,
    )


def clear_cache() -> None:
    """Clear the configuration cache."""
    global _config_cache, _config_cache_time
    _config_cache = None
    _config_cache_time = 0
