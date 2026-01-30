"""Anthropic provider utilities."""

from typing import Optional, Any
import logging

from ai_config.client import AIConfigClient

logger = logging.getLogger(__name__)


async def create_anthropic_message(
    client: AIConfigClient,
    use_case: str,
    messages: list[dict],
    system: Optional[str] = None,
    max_tokens: Optional[int] = None,
    temperature: Optional[float] = None,
    **kwargs: Any,
) -> Any:
    """
    Create a message using Anthropic API with config from Admin.

    This is a convenience wrapper that:
    1. Fetches the model config for the use case
    2. Creates an Anthropic client
    3. Makes the API call with proper parameters

    Args:
        client: AIConfigClient instance
        use_case: The use case name (e.g., "coding", "analysis_heavy")
        messages: List of message dicts with "role" and "content"
        system: Optional system prompt
        max_tokens: Override max_tokens from config
        temperature: Override temperature from config
        **kwargs: Additional kwargs passed to Anthropic API

    Returns:
        Anthropic Message response
    """
    # Get config for this use case
    config = await client.get_use_case_config(use_case)

    # Use overrides if provided, otherwise use config values
    actual_max_tokens = max_tokens if max_tokens is not None else config.max_tokens
    actual_temperature = temperature if temperature is not None else config.temperature

    # Get Anthropic client
    anthropic_client = client.get_anthropic_client()

    # Build request
    request_kwargs = {
        "model": config.model_id,
        "messages": messages,
        "max_tokens": actual_max_tokens,
        "temperature": actual_temperature,
        **kwargs,
    }

    if system:
        request_kwargs["system"] = system

    logger.debug(f"Creating Anthropic message with model={config.model_id}")

    return anthropic_client.messages.create(**request_kwargs)


async def create_anthropic_message_async(
    client: AIConfigClient,
    use_case: str,
    messages: list[dict],
    system: Optional[str] = None,
    max_tokens: Optional[int] = None,
    temperature: Optional[float] = None,
    **kwargs: Any,
) -> Any:
    """
    Async version of create_anthropic_message.

    Args:
        client: AIConfigClient instance
        use_case: The use case name
        messages: List of message dicts
        system: Optional system prompt
        max_tokens: Override max_tokens from config
        temperature: Override temperature from config
        **kwargs: Additional kwargs passed to Anthropic API

    Returns:
        Anthropic Message response
    """
    # Get config for this use case
    config = await client.get_use_case_config(use_case)

    # Use overrides if provided, otherwise use config values
    actual_max_tokens = max_tokens if max_tokens is not None else config.max_tokens
    actual_temperature = temperature if temperature is not None else config.temperature

    # Get async Anthropic client
    anthropic_client = client.get_anthropic_async_client()

    # Build request
    request_kwargs = {
        "model": config.model_id,
        "messages": messages,
        "max_tokens": actual_max_tokens,
        "temperature": actual_temperature,
        **kwargs,
    }

    if system:
        request_kwargs["system"] = system

    logger.debug(f"Creating Anthropic message (async) with model={config.model_id}")

    return await anthropic_client.messages.create(**request_kwargs)
