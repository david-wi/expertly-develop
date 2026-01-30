"""Expertly AI Config - Shared AI configuration client."""

from ai_config.client import AIConfigClient
from ai_config.models import (
    AIConfig,
    AIProviderConfig,
    AIModelConfig,
    AIUseCaseConfig,
)

__all__ = [
    "AIConfigClient",
    "AIConfig",
    "AIProviderConfig",
    "AIModelConfig",
    "AIUseCaseConfig",
]

__version__ = "0.1.0"
