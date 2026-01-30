"""AI configuration API endpoints."""

from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.services.ai_config_service import AIConfigService
from app.schemas.ai_config import (
    AIProviderCreate,
    AIProviderUpdate,
    AIProviderResponse,
    AIProviderListResponse,
    AIModelCreate,
    AIModelUpdate,
    AIModelResponse,
    AIModelListResponse,
    AIUseCaseConfigCreate,
    AIUseCaseConfigUpdate,
    AIUseCaseConfigResponse,
    AIUseCaseConfigListResponse,
)

router = APIRouter()


def get_ai_config_service(db: AsyncSession = Depends(get_db)) -> AIConfigService:
    """Dependency to get AI config service."""
    return AIConfigService(db)


# ============================================================================
# Provider Endpoints
# ============================================================================

@router.get("/providers", response_model=AIProviderListResponse)
async def list_providers(
    include_inactive: bool = False,
    service: AIConfigService = Depends(get_ai_config_service),
):
    """List all AI providers."""
    providers, total = await service.list_providers(include_inactive=include_inactive)
    return AIProviderListResponse(
        providers=[AIProviderResponse.model_validate(p) for p in providers],
        total=total,
    )


@router.get("/providers/{provider_id}", response_model=AIProviderResponse)
async def get_provider(
    provider_id: UUID,
    service: AIConfigService = Depends(get_ai_config_service),
):
    """Get a specific AI provider."""
    provider = await service.get_provider(provider_id)
    if not provider:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Provider not found",
        )
    return AIProviderResponse.model_validate(provider)


@router.post("/providers", response_model=AIProviderResponse, status_code=status.HTTP_201_CREATED)
async def create_provider(
    data: AIProviderCreate,
    service: AIConfigService = Depends(get_ai_config_service),
):
    """Create a new AI provider."""
    # Check if provider already exists
    existing = await service.get_provider_by_name(data.name)
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Provider '{data.name}' already exists",
        )

    provider = await service.create_provider(data)
    return AIProviderResponse.model_validate(provider)


@router.put("/providers/{provider_id}", response_model=AIProviderResponse)
async def update_provider(
    provider_id: UUID,
    data: AIProviderUpdate,
    service: AIConfigService = Depends(get_ai_config_service),
):
    """Update an AI provider."""
    provider = await service.update_provider(provider_id, data)
    if not provider:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Provider not found",
        )
    return AIProviderResponse.model_validate(provider)


@router.delete("/providers/{provider_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_provider(
    provider_id: UUID,
    service: AIConfigService = Depends(get_ai_config_service),
):
    """Soft delete an AI provider."""
    success = await service.delete_provider(provider_id)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Provider not found",
        )


# ============================================================================
# Model Endpoints
# ============================================================================

@router.get("/models", response_model=AIModelListResponse)
async def list_models(
    include_inactive: bool = False,
    provider_id: Optional[UUID] = None,
    service: AIConfigService = Depends(get_ai_config_service),
):
    """List all AI models."""
    models, total = await service.list_models(
        include_inactive=include_inactive,
        provider_id=provider_id,
    )
    return AIModelListResponse(models=models, total=total)


@router.get("/models/{model_id}", response_model=AIModelResponse)
async def get_model(
    model_id: UUID,
    service: AIConfigService = Depends(get_ai_config_service),
):
    """Get a specific AI model."""
    model = await service.get_model(model_id)
    if not model:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Model not found",
        )
    return AIModelResponse.model_validate(model)


@router.post("/models", response_model=AIModelResponse, status_code=status.HTTP_201_CREATED)
async def create_model(
    data: AIModelCreate,
    service: AIConfigService = Depends(get_ai_config_service),
):
    """Create a new AI model."""
    # Check if provider exists
    provider = await service.get_provider(data.provider_id)
    if not provider:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Provider not found",
        )

    # Check if model already exists
    existing = await service.get_model_by_model_id(data.model_id)
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Model '{data.model_id}' already exists",
        )

    model = await service.create_model(data)
    return AIModelResponse.model_validate(model)


@router.put("/models/{model_id}", response_model=AIModelResponse)
async def update_model(
    model_id: UUID,
    data: AIModelUpdate,
    service: AIConfigService = Depends(get_ai_config_service),
):
    """Update an AI model."""
    model = await service.update_model(model_id, data)
    if not model:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Model not found",
        )
    return AIModelResponse.model_validate(model)


@router.delete("/models/{model_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_model(
    model_id: UUID,
    service: AIConfigService = Depends(get_ai_config_service),
):
    """Soft delete an AI model."""
    success = await service.delete_model(model_id)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Model not found",
        )


# ============================================================================
# Use Case Config Endpoints
# ============================================================================

@router.get("/use-cases", response_model=AIUseCaseConfigListResponse)
async def list_use_cases(
    include_inactive: bool = False,
    service: AIConfigService = Depends(get_ai_config_service),
):
    """List all use case configurations."""
    use_cases, total = await service.list_use_cases(include_inactive=include_inactive)
    return AIUseCaseConfigListResponse(use_cases=use_cases, total=total)


@router.get("/use-cases/{use_case_id}", response_model=AIUseCaseConfigResponse)
async def get_use_case(
    use_case_id: UUID,
    service: AIConfigService = Depends(get_ai_config_service),
):
    """Get a specific use case configuration."""
    use_case = await service.get_use_case(use_case_id)
    if not use_case:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Use case not found",
        )
    return AIUseCaseConfigResponse.model_validate(use_case)


@router.post("/use-cases", response_model=AIUseCaseConfigResponse, status_code=status.HTTP_201_CREATED)
async def create_use_case(
    data: AIUseCaseConfigCreate,
    service: AIConfigService = Depends(get_ai_config_service),
):
    """Create a new use case configuration."""
    # Check if use case already exists
    existing = await service.get_use_case_by_name(data.use_case)
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Use case '{data.use_case}' already exists",
        )

    # Check if model exists
    model = await service.get_model(data.model_id)
    if not model:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Model not found",
        )

    use_case = await service.create_use_case(data)
    return AIUseCaseConfigResponse.model_validate(use_case)


@router.put("/use-cases/{use_case_id}", response_model=AIUseCaseConfigResponse)
async def update_use_case(
    use_case_id: UUID,
    data: AIUseCaseConfigUpdate,
    service: AIConfigService = Depends(get_ai_config_service),
):
    """Update a use case configuration."""
    # Check if model exists (if provided)
    if data.model_id:
        model = await service.get_model(data.model_id)
        if not model:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Model not found",
            )

    use_case = await service.update_use_case(use_case_id, data)
    if not use_case:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Use case not found",
        )
    return AIUseCaseConfigResponse.model_validate(use_case)


@router.put("/use-cases/by-name/{use_case_name}", response_model=AIUseCaseConfigResponse)
async def update_use_case_by_name(
    use_case_name: str,
    data: AIUseCaseConfigUpdate,
    service: AIConfigService = Depends(get_ai_config_service),
):
    """Update a use case configuration by use case name."""
    # Check if model exists (if provided)
    if data.model_id:
        model = await service.get_model(data.model_id)
        if not model:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Model not found",
            )

    use_case = await service.update_use_case_by_name(use_case_name, data)
    if not use_case:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Use case not found",
        )
    return AIUseCaseConfigResponse.model_validate(use_case)


@router.delete("/use-cases/{use_case_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_use_case(
    use_case_id: UUID,
    service: AIConfigService = Depends(get_ai_config_service),
):
    """Soft delete a use case configuration."""
    success = await service.delete_use_case(use_case_id)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Use case not found",
        )
