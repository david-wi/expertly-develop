"""AI configuration schemas for API request/response validation."""

from datetime import datetime
from typing import Optional
from uuid import UUID
from pydantic import BaseModel, Field


# ============================================================================
# Provider Schemas
# ============================================================================

class AIProviderCreate(BaseModel):
    """Schema for creating a new AI provider."""
    name: str = Field(..., min_length=1, max_length=50, pattern=r'^[a-z0-9_-]+$')
    display_name: str = Field(..., min_length=1, max_length=100)
    api_key_env_var: str = Field(..., min_length=1, max_length=100)
    base_url: Optional[str] = None
    is_active: bool = True


class AIProviderUpdate(BaseModel):
    """Schema for updating an AI provider."""
    display_name: Optional[str] = Field(None, min_length=1, max_length=100)
    api_key_env_var: Optional[str] = Field(None, min_length=1, max_length=100)
    base_url: Optional[str] = None
    is_active: Optional[bool] = None


class AIProviderResponse(BaseModel):
    """Schema for AI provider in responses."""
    id: UUID
    name: str
    display_name: str
    api_key_env_var: str
    base_url: Optional[str]
    is_active: bool
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


# ============================================================================
# Model Schemas
# ============================================================================

class AIModelCreate(BaseModel):
    """Schema for creating a new AI model."""
    provider_id: UUID
    model_id: str = Field(..., min_length=1, max_length=100)
    display_name: str = Field(..., min_length=1, max_length=100)
    capabilities: list[str] = Field(default_factory=list)
    is_active: bool = True


class AIModelUpdate(BaseModel):
    """Schema for updating an AI model."""
    display_name: Optional[str] = Field(None, min_length=1, max_length=100)
    capabilities: Optional[list[str]] = None
    is_active: Optional[bool] = None


class AIModelResponse(BaseModel):
    """Schema for AI model in responses."""
    id: UUID
    provider_id: UUID
    model_id: str
    display_name: str
    capabilities: list[str]
    is_active: bool
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class AIModelWithProviderResponse(BaseModel):
    """Schema for AI model with provider details."""
    id: UUID
    provider_id: UUID
    provider_name: str
    model_id: str
    display_name: str
    capabilities: list[str]
    is_active: bool
    created_at: datetime
    updated_at: datetime


# ============================================================================
# Use Case Config Schemas
# ============================================================================

class AIUseCaseConfigCreate(BaseModel):
    """Schema for creating a new use case configuration."""
    use_case: str = Field(..., min_length=1, max_length=50, pattern=r'^[a-z0-9_]+$')
    description: Optional[str] = None
    model_id: UUID
    max_tokens: int = Field(default=4096, ge=1, le=200000)
    temperature: float = Field(default=0.7, ge=0.0, le=2.0)
    is_active: bool = True


class AIUseCaseConfigUpdate(BaseModel):
    """Schema for updating a use case configuration."""
    description: Optional[str] = None
    model_id: Optional[UUID] = None
    max_tokens: Optional[int] = Field(None, ge=1, le=200000)
    temperature: Optional[float] = Field(None, ge=0.0, le=2.0)
    is_active: Optional[bool] = None


class AIUseCaseConfigResponse(BaseModel):
    """Schema for use case config in responses."""
    id: UUID
    use_case: str
    description: Optional[str]
    model_id: Optional[UUID]
    max_tokens: int
    temperature: float
    is_active: bool
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class AIUseCaseConfigWithModelResponse(BaseModel):
    """Schema for use case config with model details."""
    id: UUID
    use_case: str
    description: Optional[str]
    model_id: Optional[UUID]
    model_name: Optional[str]
    provider_name: Optional[str]
    max_tokens: int
    temperature: float
    is_active: bool


# ============================================================================
# Public API Schemas (no sensitive data)
# ============================================================================

class PublicAIProviderResponse(BaseModel):
    """Public schema for AI provider (no API key info)."""
    name: str
    display_name: str
    base_url: Optional[str]


class PublicAIModelResponse(BaseModel):
    """Public schema for AI model."""
    model_id: str
    display_name: str
    provider_name: str
    capabilities: list[str]


class PublicAIUseCaseConfigResponse(BaseModel):
    """Public schema for use case configuration."""
    use_case: str
    description: Optional[str]
    model_id: str
    provider_name: str
    max_tokens: int
    temperature: float


class PublicAIConfigResponse(BaseModel):
    """Complete public AI configuration for other apps to consume."""
    providers: list[PublicAIProviderResponse]
    models: list[PublicAIModelResponse]
    use_cases: list[PublicAIUseCaseConfigResponse]


# ============================================================================
# List Response Schemas
# ============================================================================

class AIProviderListResponse(BaseModel):
    """Schema for list of providers."""
    providers: list[AIProviderResponse]
    total: int


class AIModelListResponse(BaseModel):
    """Schema for list of models."""
    models: list[AIModelWithProviderResponse]
    total: int


class AIUseCaseConfigListResponse(BaseModel):
    """Schema for list of use case configs."""
    use_cases: list[AIUseCaseConfigWithModelResponse]
    total: int
