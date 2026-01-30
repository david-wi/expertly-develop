"""AI configuration service for business logic."""

from typing import Optional
from uuid import UUID
import uuid

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.ai_config import AIProvider, AIModel, AIUseCaseConfig
from app.schemas.ai_config import (
    AIProviderCreate,
    AIProviderUpdate,
    AIModelCreate,
    AIModelUpdate,
    AIUseCaseConfigCreate,
    AIUseCaseConfigUpdate,
    AIModelWithProviderResponse,
    AIUseCaseConfigWithModelResponse,
    PublicAIProviderResponse,
    PublicAIModelResponse,
    PublicAIUseCaseConfigResponse,
    PublicAIConfigResponse,
)


class AIConfigService:
    """Service class for AI configuration operations."""

    def __init__(self, db: AsyncSession):
        self.db = db

    # ========================================================================
    # Provider Operations
    # ========================================================================

    async def list_providers(
        self,
        include_inactive: bool = False,
    ) -> tuple[list[AIProvider], int]:
        """List all providers."""
        query = select(AIProvider)
        if not include_inactive:
            query = query.where(AIProvider.is_active == True)

        count_query = select(func.count()).select_from(AIProvider)
        if not include_inactive:
            count_query = count_query.where(AIProvider.is_active == True)
        total_result = await self.db.execute(count_query)
        total = total_result.scalar()

        query = query.order_by(AIProvider.display_name)
        result = await self.db.execute(query)
        providers = result.scalars().all()

        return list(providers), total

    async def get_provider(self, provider_id: UUID) -> Optional[AIProvider]:
        """Get a provider by ID."""
        query = select(AIProvider).where(AIProvider.id == provider_id)
        result = await self.db.execute(query)
        return result.scalar_one_or_none()

    async def get_provider_by_name(self, name: str) -> Optional[AIProvider]:
        """Get a provider by name."""
        query = select(AIProvider).where(AIProvider.name == name)
        result = await self.db.execute(query)
        return result.scalar_one_or_none()

    async def create_provider(self, data: AIProviderCreate) -> AIProvider:
        """Create a new provider."""
        provider = AIProvider(
            id=uuid.uuid4(),
            name=data.name,
            display_name=data.display_name,
            api_key_env_var=data.api_key_env_var,
            base_url=data.base_url,
            is_active=data.is_active,
        )
        self.db.add(provider)
        await self.db.flush()
        return provider

    async def update_provider(
        self,
        provider_id: UUID,
        data: AIProviderUpdate,
    ) -> Optional[AIProvider]:
        """Update a provider."""
        provider = await self.get_provider(provider_id)
        if not provider:
            return None

        if data.display_name is not None:
            provider.display_name = data.display_name
        if data.api_key_env_var is not None:
            provider.api_key_env_var = data.api_key_env_var
        if data.base_url is not None:
            provider.base_url = data.base_url
        if data.is_active is not None:
            provider.is_active = data.is_active

        await self.db.flush()
        return provider

    async def delete_provider(self, provider_id: UUID) -> bool:
        """Soft delete a provider (set is_active=False)."""
        provider = await self.get_provider(provider_id)
        if not provider:
            return False

        provider.is_active = False
        await self.db.flush()
        return True

    # ========================================================================
    # Model Operations
    # ========================================================================

    async def list_models(
        self,
        include_inactive: bool = False,
        provider_id: Optional[UUID] = None,
    ) -> tuple[list[AIModelWithProviderResponse], int]:
        """List all models with provider info."""
        query = select(AIModel).options(selectinload(AIModel.provider))
        if not include_inactive:
            query = query.where(AIModel.is_active == True)
        if provider_id:
            query = query.where(AIModel.provider_id == provider_id)

        count_query = select(func.count()).select_from(AIModel)
        if not include_inactive:
            count_query = count_query.where(AIModel.is_active == True)
        if provider_id:
            count_query = count_query.where(AIModel.provider_id == provider_id)
        total_result = await self.db.execute(count_query)
        total = total_result.scalar()

        query = query.order_by(AIModel.display_name)
        result = await self.db.execute(query)
        models = result.scalars().all()

        response_models = [
            AIModelWithProviderResponse(
                id=model.id,
                provider_id=model.provider_id,
                provider_name=model.provider.name if model.provider else "unknown",
                model_id=model.model_id,
                display_name=model.display_name,
                capabilities=model.capabilities or [],
                is_active=model.is_active,
                created_at=model.created_at,
                updated_at=model.updated_at,
            )
            for model in models
        ]

        return response_models, total

    async def get_model(self, model_id: UUID) -> Optional[AIModel]:
        """Get a model by ID."""
        query = select(AIModel).where(AIModel.id == model_id).options(
            selectinload(AIModel.provider)
        )
        result = await self.db.execute(query)
        return result.scalar_one_or_none()

    async def get_model_by_model_id(self, model_id_str: str) -> Optional[AIModel]:
        """Get a model by its model_id string (e.g., 'claude-sonnet-4-0-latest')."""
        query = select(AIModel).where(AIModel.model_id == model_id_str).options(
            selectinload(AIModel.provider)
        )
        result = await self.db.execute(query)
        return result.scalar_one_or_none()

    async def create_model(self, data: AIModelCreate) -> AIModel:
        """Create a new model."""
        model = AIModel(
            id=uuid.uuid4(),
            provider_id=data.provider_id,
            model_id=data.model_id,
            display_name=data.display_name,
            capabilities=data.capabilities,
            is_active=data.is_active,
        )
        self.db.add(model)
        await self.db.flush()
        return model

    async def update_model(
        self,
        model_uuid: UUID,
        data: AIModelUpdate,
    ) -> Optional[AIModel]:
        """Update a model."""
        model = await self.get_model(model_uuid)
        if not model:
            return None

        if data.display_name is not None:
            model.display_name = data.display_name
        if data.capabilities is not None:
            model.capabilities = data.capabilities
        if data.is_active is not None:
            model.is_active = data.is_active

        await self.db.flush()
        return model

    async def delete_model(self, model_uuid: UUID) -> bool:
        """Soft delete a model (set is_active=False)."""
        model = await self.get_model(model_uuid)
        if not model:
            return False

        model.is_active = False
        await self.db.flush()
        return True

    # ========================================================================
    # Use Case Config Operations
    # ========================================================================

    async def list_use_cases(
        self,
        include_inactive: bool = False,
    ) -> tuple[list[AIUseCaseConfigWithModelResponse], int]:
        """List all use case configurations with model info."""
        query = select(AIUseCaseConfig).options(
            selectinload(AIUseCaseConfig.model).selectinload(AIModel.provider)
        )
        if not include_inactive:
            query = query.where(AIUseCaseConfig.is_active == True)

        count_query = select(func.count()).select_from(AIUseCaseConfig)
        if not include_inactive:
            count_query = count_query.where(AIUseCaseConfig.is_active == True)
        total_result = await self.db.execute(count_query)
        total = total_result.scalar()

        query = query.order_by(AIUseCaseConfig.use_case)
        result = await self.db.execute(query)
        use_cases = result.scalars().all()

        response_use_cases = [
            AIUseCaseConfigWithModelResponse(
                id=uc.id,
                use_case=uc.use_case,
                description=uc.description,
                model_id=uc.model_id,
                model_name=uc.model.model_id if uc.model else None,
                provider_name=uc.model.provider.name if uc.model and uc.model.provider else None,
                max_tokens=uc.max_tokens,
                temperature=uc.temperature,
                is_active=uc.is_active,
            )
            for uc in use_cases
        ]

        return response_use_cases, total

    async def get_use_case(self, use_case_id: UUID) -> Optional[AIUseCaseConfig]:
        """Get a use case config by ID."""
        query = select(AIUseCaseConfig).where(AIUseCaseConfig.id == use_case_id).options(
            selectinload(AIUseCaseConfig.model).selectinload(AIModel.provider)
        )
        result = await self.db.execute(query)
        return result.scalar_one_or_none()

    async def get_use_case_by_name(self, use_case: str) -> Optional[AIUseCaseConfig]:
        """Get a use case config by name."""
        query = select(AIUseCaseConfig).where(AIUseCaseConfig.use_case == use_case).options(
            selectinload(AIUseCaseConfig.model).selectinload(AIModel.provider)
        )
        result = await self.db.execute(query)
        return result.scalar_one_or_none()

    async def create_use_case(self, data: AIUseCaseConfigCreate) -> AIUseCaseConfig:
        """Create a new use case configuration."""
        use_case = AIUseCaseConfig(
            id=uuid.uuid4(),
            use_case=data.use_case,
            description=data.description,
            model_id=data.model_id,
            max_tokens=data.max_tokens,
            temperature=data.temperature,
            is_active=data.is_active,
        )
        self.db.add(use_case)
        await self.db.flush()
        return use_case

    async def update_use_case(
        self,
        use_case_id: UUID,
        data: AIUseCaseConfigUpdate,
    ) -> Optional[AIUseCaseConfig]:
        """Update a use case configuration."""
        use_case = await self.get_use_case(use_case_id)
        if not use_case:
            return None

        if data.description is not None:
            use_case.description = data.description
        if data.model_id is not None:
            use_case.model_id = data.model_id
        if data.max_tokens is not None:
            use_case.max_tokens = data.max_tokens
        if data.temperature is not None:
            use_case.temperature = data.temperature
        if data.is_active is not None:
            use_case.is_active = data.is_active

        await self.db.flush()

        # Re-fetch with relationships
        return await self.get_use_case(use_case_id)

    async def update_use_case_by_name(
        self,
        use_case_name: str,
        data: AIUseCaseConfigUpdate,
    ) -> Optional[AIUseCaseConfig]:
        """Update a use case configuration by name."""
        use_case = await self.get_use_case_by_name(use_case_name)
        if not use_case:
            return None

        if data.description is not None:
            use_case.description = data.description
        if data.model_id is not None:
            use_case.model_id = data.model_id
        if data.max_tokens is not None:
            use_case.max_tokens = data.max_tokens
        if data.temperature is not None:
            use_case.temperature = data.temperature
        if data.is_active is not None:
            use_case.is_active = data.is_active

        await self.db.flush()

        # Re-fetch with relationships
        return await self.get_use_case(use_case.id)

    async def delete_use_case(self, use_case_id: UUID) -> bool:
        """Soft delete a use case (set is_active=False)."""
        use_case = await self.get_use_case(use_case_id)
        if not use_case:
            return False

        use_case.is_active = False
        await self.db.flush()
        return True

    # ========================================================================
    # Public API Operations
    # ========================================================================

    async def get_public_config(self) -> PublicAIConfigResponse:
        """Get complete AI configuration for public consumption (no secrets)."""
        # Get active providers
        providers_query = select(AIProvider).where(AIProvider.is_active == True)
        providers_result = await self.db.execute(providers_query)
        providers = providers_result.scalars().all()

        # Get active models with providers
        models_query = select(AIModel).where(AIModel.is_active == True).options(
            selectinload(AIModel.provider)
        )
        models_result = await self.db.execute(models_query)
        models = models_result.scalars().all()

        # Get active use cases with models and providers
        use_cases_query = select(AIUseCaseConfig).where(
            AIUseCaseConfig.is_active == True
        ).options(
            selectinload(AIUseCaseConfig.model).selectinload(AIModel.provider)
        )
        use_cases_result = await self.db.execute(use_cases_query)
        use_cases = use_cases_result.scalars().all()

        return PublicAIConfigResponse(
            providers=[
                PublicAIProviderResponse(
                    name=p.name,
                    display_name=p.display_name,
                    base_url=p.base_url,
                )
                for p in providers
            ],
            models=[
                PublicAIModelResponse(
                    model_id=m.model_id,
                    display_name=m.display_name,
                    provider_name=m.provider.name if m.provider else "unknown",
                    capabilities=m.capabilities or [],
                )
                for m in models
            ],
            use_cases=[
                PublicAIUseCaseConfigResponse(
                    use_case=uc.use_case,
                    description=uc.description,
                    model_id=uc.model.model_id if uc.model else "",
                    provider_name=uc.model.provider.name if uc.model and uc.model.provider else "",
                    max_tokens=uc.max_tokens,
                    temperature=uc.temperature,
                )
                for uc in use_cases
                if uc.model  # Only include use cases with assigned models
            ],
        )
