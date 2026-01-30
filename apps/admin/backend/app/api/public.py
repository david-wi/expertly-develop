"""Public API endpoints for other Expertly apps to consume themes and AI config."""

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.services.theme_service import ThemeService
from app.services.ai_config_service import AIConfigService
from app.schemas.theme import PublicThemeResponse
from app.schemas.ai_config import PublicAIConfigResponse

router = APIRouter()


def get_theme_service(db: AsyncSession = Depends(get_db)) -> ThemeService:
    """Dependency to get theme service."""
    return ThemeService(db)


def get_ai_config_service(db: AsyncSession = Depends(get_db)) -> AIConfigService:
    """Dependency to get AI config service."""
    return AIConfigService(db)


@router.get("/themes", response_model=list[PublicThemeResponse])
async def get_public_themes(
    service: ThemeService = Depends(get_theme_service),
):
    """
    Get all active themes for use by other Expertly apps.

    This endpoint returns themes in the format expected by ThemeProvider:
    - id: Theme UUID as string
    - name: Display name
    - slug: URL-friendly identifier (e.g., 'violet', 'ocean')
    - colors: Full color configuration with light/dark modes
    """
    themes = await service.get_active_themes_for_public()

    return [
        PublicThemeResponse(
            id=str(theme.id),
            name=theme.name,
            slug=theme.slug,
            colors=theme.get_current_snapshot(),
        )
        for theme in themes
    ]


@router.get("/ai-config", response_model=PublicAIConfigResponse)
async def get_public_ai_config(
    service: AIConfigService = Depends(get_ai_config_service),
):
    """
    Get AI configuration for use by other Expertly apps.

    This endpoint returns:
    - providers: List of active AI providers (without API keys)
    - models: List of active AI models with capabilities
    - use_cases: List of use case to model mappings with configuration

    Apps should use this to determine which model to use for each use case.
    API keys are NOT included - apps read them from their own environment.
    """
    return await service.get_public_config()
