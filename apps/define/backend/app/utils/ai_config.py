"""
Multi-Provider AI Client - fetches config from Admin API and routes to appropriate provider.

Supports: OpenAI, Anthropic, Groq, Google (Gemini)
"""
import logging
import os
import time
import httpx
import json
from typing import Optional, List, Any
from dataclasses import dataclass

logger = logging.getLogger(__name__)


@dataclass
class UseCaseConfig:
    """Configuration for a specific use case."""
    use_case: str
    model_id: str
    provider_name: str
    max_tokens: int
    temperature: float


# Cache for AI config
_config_cache: Optional[dict] = None
_config_cache_time: float = 0
_CONFIG_CACHE_TTL = 5 * 60  # 5 minutes

# Default fallback values
DEFAULT_PROVIDER = "openai"
DEFAULT_MODEL = "gpt-5.2"
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
                    provider_name=uc.get("provider_name", DEFAULT_PROVIDER),
                    max_tokens=uc.get("max_tokens", DEFAULT_MAX_TOKENS),
                    temperature=uc.get("temperature", DEFAULT_TEMPERATURE),
                )

    # Default fallback
    return UseCaseConfig(
        use_case=use_case,
        model_id=DEFAULT_MODEL,
        provider_name=DEFAULT_PROVIDER,
        max_tokens=DEFAULT_MAX_TOKENS,
        temperature=DEFAULT_TEMPERATURE,
    )


def clear_cache() -> None:
    """Clear the configuration cache."""
    global _config_cache, _config_cache_time
    _config_cache = None
    _config_cache_time = 0


class MultiProviderAIClient:
    """
    Unified AI client that routes to the appropriate provider based on config.
    """

    def __init__(self):
        from app.config import get_settings
        self.settings = get_settings()
        self._clients = {}

    def _get_openai_client(self):
        """Get or create OpenAI client."""
        if "openai" not in self._clients:
            import openai
            self._clients["openai"] = openai.OpenAI(api_key=self.settings.openai_api_key)
        return self._clients["openai"]

    def _get_anthropic_client(self):
        """Get or create Anthropic client."""
        if "anthropic" not in self._clients:
            import anthropic
            self._clients["anthropic"] = anthropic.Anthropic(api_key=self.settings.anthropic_api_key)
        return self._clients["anthropic"]

    def _get_groq_client(self):
        """Get or create Groq client."""
        if "groq" not in self._clients:
            from groq import Groq
            self._clients["groq"] = Groq(api_key=self.settings.groq_api_key)
        return self._clients["groq"]

    def _get_google_client(self):
        """Get or create Google Gemini client."""
        if "google" not in self._clients:
            import google.generativeai as genai
            genai.configure(api_key=self.settings.google_api_key)
            self._clients["google"] = genai
        return self._clients["google"]

    async def complete(
        self,
        use_case: str,
        system_prompt: str,
        user_content: str | List[Any],
        images: Optional[List[dict]] = None,
    ) -> str:
        """
        Make a completion request using the configured provider for the use case.

        Args:
            use_case: The use case name (e.g., 'requirements_parsing')
            system_prompt: System instructions
            user_content: User message (text or list of content blocks)
            images: Optional list of image dicts with 'type', 'media_type', 'data' (base64)

        Returns:
            The text response from the AI model
        """
        config = get_use_case_config(use_case)
        provider = config.provider_name.lower()

        if provider == "openai":
            return await self._complete_openai(config, system_prompt, user_content, images)
        elif provider == "anthropic":
            return await self._complete_anthropic(config, system_prompt, user_content, images)
        elif provider == "groq":
            return await self._complete_groq(config, system_prompt, user_content, images)
        elif provider in ("google", "gemini"):
            return await self._complete_google(config, system_prompt, user_content, images)
        else:
            raise ValueError(f"Unknown AI provider: {provider}")

    async def _complete_openai(
        self,
        config: UseCaseConfig,
        system_prompt: str,
        user_content: str | List[Any],
        images: Optional[List[dict]] = None,
    ) -> str:
        """Make completion using OpenAI."""
        client = self._get_openai_client()

        # Build messages
        messages = [{"role": "system", "content": system_prompt}]

        # Build user message content
        if images:
            content = []
            for img in images:
                content.append({
                    "type": "image_url",
                    "image_url": {
                        "url": f"data:{img['media_type']};base64,{img['data']}"
                    }
                })
            if isinstance(user_content, str):
                content.append({"type": "text", "text": user_content})
            else:
                for block in user_content:
                    if isinstance(block, dict) and block.get("type") == "text":
                        content.append({"type": "text", "text": block["text"]})
            messages.append({"role": "user", "content": content})
        else:
            if isinstance(user_content, str):
                messages.append({"role": "user", "content": user_content})
            else:
                # Extract text from content blocks
                text_parts = []
                for block in user_content:
                    if isinstance(block, dict) and block.get("type") == "text":
                        text_parts.append(block["text"])
                    elif isinstance(block, str):
                        text_parts.append(block)
                messages.append({"role": "user", "content": "\n".join(text_parts)})

        # Newer OpenAI models (gpt-5.x, o1, o3, o4) use max_completion_tokens instead of max_tokens
        # and support a reasoning parameter to control thinking effort
        model_lower = config.model_id.lower()
        is_reasoning_model = any(x in model_lower for x in ['gpt-5', 'o1', 'o3', 'o4'])

        if is_reasoning_model:
            response = client.chat.completions.create(
                model=config.model_id,
                messages=messages,
                max_completion_tokens=config.max_tokens,
                temperature=config.temperature,
                reasoning={"effort": "medium"},
            )
        else:
            response = client.chat.completions.create(
                model=config.model_id,
                messages=messages,
                max_tokens=config.max_tokens,
                temperature=config.temperature,
            )

        choice = response.choices[0]
        content = choice.message.content
        finish_reason = choice.finish_reason
        usage = response.usage

        logger.info(
            f"[OpenAI] model={config.model_id} finish_reason={finish_reason} "
            f"prompt_tokens={usage.prompt_tokens if usage else '?'} "
            f"completion_tokens={usage.completion_tokens if usage else '?'} "
            f"content_length={len(content) if content else 0}"
        )

        if not content:
            detail = f"model={config.model_id}, finish_reason={finish_reason}"
            if usage:
                detail += f", prompt_tokens={usage.prompt_tokens}, completion_tokens={usage.completion_tokens}"
                if hasattr(usage, 'completion_tokens_details') and usage.completion_tokens_details:
                    detail += f", details={usage.completion_tokens_details}"
            raise ValueError(
                f"OpenAI returned empty response ({detail}). "
                f"This may indicate the model used all tokens on internal reasoning. "
                f"Try increasing max_tokens in Admin AI config."
            )

        return content

    async def _complete_anthropic(
        self,
        config: UseCaseConfig,
        system_prompt: str,
        user_content: str | List[Any],
        images: Optional[List[dict]] = None,
    ) -> str:
        """Make completion using Anthropic."""
        client = self._get_anthropic_client()

        # Build content blocks
        content_blocks = []

        if images:
            for img in images:
                content_blocks.append({
                    "type": "image",
                    "source": {
                        "type": "base64",
                        "media_type": img["media_type"],
                        "data": img["data"],
                    }
                })

        if isinstance(user_content, str):
            content_blocks.append({"type": "text", "text": user_content})
        else:
            content_blocks.extend(user_content)

        response = client.messages.create(
            model=config.model_id,
            max_tokens=config.max_tokens,
            system=system_prompt,
            messages=[{"role": "user", "content": content_blocks}],
        )

        text_block = next((b for b in response.content if b.type == "text"), None)
        if not text_block:
            raise ValueError("No text response from Anthropic")

        return text_block.text

    async def _complete_groq(
        self,
        config: UseCaseConfig,
        system_prompt: str,
        user_content: str | List[Any],
        images: Optional[List[dict]] = None,
    ) -> str:
        """Make completion using Groq."""
        client = self._get_groq_client()

        # Groq uses OpenAI-compatible API
        messages = [{"role": "system", "content": system_prompt}]

        # Note: Groq vision support may be limited
        if isinstance(user_content, str):
            messages.append({"role": "user", "content": user_content})
        else:
            text_parts = []
            for block in user_content:
                if isinstance(block, dict) and block.get("type") == "text":
                    text_parts.append(block["text"])
            messages.append({"role": "user", "content": "\n".join(text_parts)})

        response = client.chat.completions.create(
            model=config.model_id,
            messages=messages,
            max_tokens=config.max_tokens,
            temperature=config.temperature,
        )

        content = response.choices[0].message.content
        if not content:
            raise ValueError(
                f"Groq returned empty response (model={config.model_id}, "
                f"finish_reason={response.choices[0].finish_reason})"
            )
        return content

    async def _complete_google(
        self,
        config: UseCaseConfig,
        system_prompt: str,
        user_content: str | List[Any],
        images: Optional[List[dict]] = None,
    ) -> str:
        """Make completion using Google Gemini."""
        genai = self._get_google_client()

        model = genai.GenerativeModel(
            config.model_id,
            system_instruction=system_prompt,
        )

        # Build content
        parts = []

        if images:
            import base64
            for img in images:
                parts.append({
                    "mime_type": img["media_type"],
                    "data": base64.b64decode(img["data"]),
                })

        if isinstance(user_content, str):
            parts.append(user_content)
        else:
            for block in user_content:
                if isinstance(block, dict) and block.get("type") == "text":
                    parts.append(block["text"])

        response = model.generate_content(
            parts,
            generation_config={
                "max_output_tokens": config.max_tokens,
                "temperature": config.temperature,
            }
        )

        return response.text


# Singleton instance
_ai_client: Optional[MultiProviderAIClient] = None


def get_ai_client() -> MultiProviderAIClient:
    """Get the singleton AI client."""
    global _ai_client
    if _ai_client is None:
        _ai_client = MultiProviderAIClient()
    return _ai_client
