"""OpenAI provider utilities."""

from typing import Optional, Any
import logging

from ai_config.client import AIConfigClient

logger = logging.getLogger(__name__)


async def create_openai_completion(
    client: AIConfigClient,
    use_case: str,
    messages: list[dict],
    max_tokens: Optional[int] = None,
    temperature: Optional[float] = None,
    **kwargs: Any,
) -> Any:
    """
    Create a chat completion using OpenAI API with config from Admin.

    Args:
        client: AIConfigClient instance
        use_case: The use case name
        messages: List of message dicts with "role" and "content"
        max_tokens: Override max_tokens from config
        temperature: Override temperature from config
        **kwargs: Additional kwargs passed to OpenAI API

    Returns:
        OpenAI ChatCompletion response
    """
    # Get config for this use case
    config = await client.get_use_case_config(use_case)

    # Use overrides if provided, otherwise use config values
    actual_max_tokens = max_tokens if max_tokens is not None else config.max_tokens
    actual_temperature = temperature if temperature is not None else config.temperature

    # Get OpenAI client
    openai_client = client.get_openai_client()

    logger.debug(f"Creating OpenAI completion with model={config.model_id}")

    return openai_client.chat.completions.create(
        model=config.model_id,
        messages=messages,
        max_tokens=actual_max_tokens,
        temperature=actual_temperature,
        **kwargs,
    )


async def create_openai_completion_async(
    client: AIConfigClient,
    use_case: str,
    messages: list[dict],
    max_tokens: Optional[int] = None,
    temperature: Optional[float] = None,
    **kwargs: Any,
) -> Any:
    """
    Async version of create_openai_completion.

    Args:
        client: AIConfigClient instance
        use_case: The use case name
        messages: List of message dicts
        max_tokens: Override max_tokens from config
        temperature: Override temperature from config
        **kwargs: Additional kwargs passed to OpenAI API

    Returns:
        OpenAI ChatCompletion response
    """
    # Get config for this use case
    config = await client.get_use_case_config(use_case)

    # Use overrides if provided, otherwise use config values
    actual_max_tokens = max_tokens if max_tokens is not None else config.max_tokens
    actual_temperature = temperature if temperature is not None else config.temperature

    # Get async OpenAI client
    openai_client = client.get_openai_async_client()

    logger.debug(f"Creating OpenAI completion (async) with model={config.model_id}")

    return await openai_client.chat.completions.create(
        model=config.model_id,
        messages=messages,
        max_tokens=actual_max_tokens,
        temperature=actual_temperature,
        **kwargs,
    )


async def create_openai_image(
    client: AIConfigClient,
    prompt: str,
    size: str = "1024x1024",
    quality: str = "standard",
    n: int = 1,
    **kwargs: Any,
) -> Any:
    """
    Create an image using OpenAI DALL-E with config from Admin.

    Args:
        client: AIConfigClient instance
        prompt: Image generation prompt
        size: Image size (default: "1024x1024")
        quality: Image quality (default: "standard")
        n: Number of images to generate (default: 1)
        **kwargs: Additional kwargs passed to OpenAI API

    Returns:
        OpenAI Image response
    """
    # Get config for image generation use case
    config = await client.get_use_case_config("image_generation")

    # Get OpenAI client
    openai_client = client.get_openai_client()

    logger.debug(f"Creating OpenAI image with model={config.model_id}")

    return openai_client.images.generate(
        model=config.model_id,
        prompt=prompt,
        size=size,
        quality=quality,
        n=n,
        **kwargs,
    )


async def create_openai_image_async(
    client: AIConfigClient,
    prompt: str,
    size: str = "1024x1024",
    quality: str = "standard",
    n: int = 1,
    **kwargs: Any,
) -> Any:
    """
    Async version of create_openai_image.

    Args:
        client: AIConfigClient instance
        prompt: Image generation prompt
        size: Image size
        quality: Image quality
        n: Number of images
        **kwargs: Additional kwargs passed to OpenAI API

    Returns:
        OpenAI Image response
    """
    # Get config for image generation use case
    config = await client.get_use_case_config("image_generation")

    # Get async OpenAI client
    openai_client = client.get_openai_async_client()

    logger.debug(f"Creating OpenAI image (async) with model={config.model_id}")

    return await openai_client.images.generate(
        model=config.model_id,
        prompt=prompt,
        size=size,
        quality=quality,
        n=n,
        **kwargs,
    )
