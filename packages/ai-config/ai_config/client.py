"""AI Configuration Client for fetching config from Admin API."""

import os
import logging
from typing import Optional

import httpx

from ai_config.models import AIConfig, AIUseCaseConfig
from ai_config.cache import TTLCache

logger = logging.getLogger(__name__)

# Default fallback values when Admin API is unavailable
DEFAULT_MODEL = "claude-sonnet-4-0-latest"
DEFAULT_PROVIDER = "anthropic"
DEFAULT_MAX_TOKENS = 4096
DEFAULT_TEMPERATURE = 0.7


class AIConfigClient:
    """
    Client for fetching AI configuration from Admin API.

    Provides caching, fallback behavior, and convenience methods for
    getting the right model for each use case.
    """

    def __init__(
        self,
        admin_api_url: Optional[str] = None,
        cache_ttl_seconds: int = 300,
    ):
        """
        Initialize the AI config client.

        Args:
            admin_api_url: Admin API base URL. Defaults to ADMIN_API_URL env var
                          or https://admin-api.ai.devintensive.com
            cache_ttl_seconds: How long to cache config (default: 5 minutes)
        """
        self.admin_api_url = admin_api_url or os.getenv(
            "ADMIN_API_URL",
            "https://admin-api.ai.devintensive.com"
        )
        self._cache: TTLCache[AIConfig] = TTLCache(cache_ttl_seconds)
        self._http_client: Optional[httpx.AsyncClient] = None

    async def _get_http_client(self) -> httpx.AsyncClient:
        """Get or create HTTP client."""
        if self._http_client is None or self._http_client.is_closed:
            self._http_client = httpx.AsyncClient(timeout=10.0)
        return self._http_client

    async def close(self) -> None:
        """Close the HTTP client."""
        if self._http_client and not self._http_client.is_closed:
            await self._http_client.aclose()
            self._http_client = None

    async def fetch_config(self, force_refresh: bool = False) -> AIConfig:
        """
        Fetch AI configuration from Admin API.

        Uses cached config if available and not expired.
        Falls back to default config if Admin API is unavailable.

        Args:
            force_refresh: If True, bypass cache and fetch fresh config

        Returns:
            AIConfig with providers, models, and use cases
        """
        # Check cache first
        if not force_refresh:
            cached = self._cache.get()
            if cached is not None:
                return cached

        # Fetch from Admin API
        try:
            client = await self._get_http_client()
            response = await client.get(f"{self.admin_api_url}/api/public/ai-config")
            response.raise_for_status()

            config = AIConfig.model_validate(response.json())
            self._cache.set(config)
            logger.debug("Fetched AI config from Admin API")
            return config

        except Exception as e:
            logger.warning(f"Failed to fetch AI config from Admin API: {e}")

            # Return cached value if we have one (even if expired)
            cached = self._cache.get()
            if cached is not None:
                logger.info("Using expired cached AI config")
                return cached

            # Return empty config as fallback
            logger.warning("Using default fallback AI config")
            return AIConfig()

    async def get_model_for_use_case(self, use_case: str) -> str:
        """
        Get the model ID for a specific use case.

        Args:
            use_case: The use case name (e.g., "coding", "analysis_heavy")

        Returns:
            Model ID string (e.g., "claude-sonnet-4-0-latest")
        """
        config = await self.fetch_config()

        for uc in config.use_cases:
            if uc.use_case == use_case:
                return uc.model_id

        logger.warning(f"Use case '{use_case}' not found, using default model")
        return DEFAULT_MODEL

    async def get_use_case_config(self, use_case: str) -> AIUseCaseConfig:
        """
        Get the full configuration for a use case.

        Args:
            use_case: The use case name

        Returns:
            AIUseCaseConfig with model_id, max_tokens, temperature, etc.
        """
        config = await self.fetch_config()

        for uc in config.use_cases:
            if uc.use_case == use_case:
                return uc

        # Return default config
        logger.warning(f"Use case '{use_case}' not found, using defaults")
        return AIUseCaseConfig(
            use_case=use_case,
            model_id=DEFAULT_MODEL,
            provider_name=DEFAULT_PROVIDER,
            max_tokens=DEFAULT_MAX_TOKENS,
            temperature=DEFAULT_TEMPERATURE,
        )

    async def get_provider_for_model(self, model_id: str) -> str:
        """
        Get the provider name for a model.

        Args:
            model_id: The model ID

        Returns:
            Provider name (e.g., "anthropic", "openai")
        """
        config = await self.fetch_config()

        for model in config.models:
            if model.model_id == model_id:
                return model.provider_name

        # Guess based on model ID prefix
        if model_id.startswith("claude"):
            return "anthropic"
        elif model_id.startswith("gpt") or model_id.startswith("dall"):
            return "openai"

        return DEFAULT_PROVIDER

    def get_anthropic_client(self):
        """
        Get an initialized Anthropic client.

        Reads API key from ANTHROPIC_API_KEY environment variable.

        Returns:
            anthropic.Anthropic client instance
        """
        try:
            import anthropic
        except ImportError:
            raise ImportError("anthropic package not installed. Run: pip install anthropic")

        api_key = os.getenv("ANTHROPIC_API_KEY")
        if not api_key:
            raise ValueError("ANTHROPIC_API_KEY environment variable not set")

        return anthropic.Anthropic(api_key=api_key)

    def get_anthropic_async_client(self):
        """
        Get an initialized async Anthropic client.

        Reads API key from ANTHROPIC_API_KEY environment variable.

        Returns:
            anthropic.AsyncAnthropic client instance
        """
        try:
            import anthropic
        except ImportError:
            raise ImportError("anthropic package not installed. Run: pip install anthropic")

        api_key = os.getenv("ANTHROPIC_API_KEY")
        if not api_key:
            raise ValueError("ANTHROPIC_API_KEY environment variable not set")

        return anthropic.AsyncAnthropic(api_key=api_key)

    def get_openai_client(self):
        """
        Get an initialized OpenAI client.

        Reads API key from OPENAI_API_KEY environment variable.

        Returns:
            openai.OpenAI client instance
        """
        try:
            import openai
        except ImportError:
            raise ImportError("openai package not installed. Run: pip install openai")

        api_key = os.getenv("OPENAI_API_KEY")
        if not api_key:
            raise ValueError("OPENAI_API_KEY environment variable not set")

        return openai.OpenAI(api_key=api_key)

    def get_openai_async_client(self):
        """
        Get an initialized async OpenAI client.

        Reads API key from OPENAI_API_KEY environment variable.

        Returns:
            openai.AsyncOpenAI client instance
        """
        try:
            import openai
        except ImportError:
            raise ImportError("openai package not installed. Run: pip install openai")

        api_key = os.getenv("OPENAI_API_KEY")
        if not api_key:
            raise ValueError("OPENAI_API_KEY environment variable not set")

        return openai.AsyncOpenAI(api_key=api_key)

    def clear_cache(self) -> None:
        """Clear the configuration cache."""
        self._cache.clear()


# Global singleton for convenience
_default_client: Optional[AIConfigClient] = None


def get_ai_config_client() -> AIConfigClient:
    """
    Get the default global AI config client.

    Creates client on first call, reuses on subsequent calls.
    """
    global _default_client
    if _default_client is None:
        _default_client = AIConfigClient()
    return _default_client
