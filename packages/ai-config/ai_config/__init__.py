"""Expertly AI Config - Shared AI configuration client."""

from ai_config.client import AIConfigClient, get_ai_config_client
from ai_config.models import (
    AIConfig,
    AIProviderConfig,
    AIModelConfig,
    AIUseCaseConfig,
)

__all__ = [
    "AIConfigClient",
    "get_ai_config_client",
    "AIConfig",
    "AIProviderConfig",
    "AIModelConfig",
    "AIUseCaseConfig",
]

__version__ = "0.1.0"
