"""Pydantic models for AI configuration."""

from typing import Optional
from pydantic import BaseModel


class AIProviderConfig(BaseModel):
    """AI provider configuration."""
    name: str
    display_name: str
    base_url: Optional[str] = None


class AIModelConfig(BaseModel):
    """AI model configuration."""
    model_id: str
    display_name: str
    provider_name: str
    capabilities: list[str] = []


class AIUseCaseConfig(BaseModel):
    """Use case to model mapping with configuration."""
    use_case: str
    description: Optional[str] = None
    model_id: str
    provider_name: str
    max_tokens: int = 4096
    temperature: float = 0.7


class AIConfig(BaseModel):
    """Complete AI configuration from Admin API."""
    providers: list[AIProviderConfig] = []
    models: list[AIModelConfig] = []
    use_cases: list[AIUseCaseConfig] = []
