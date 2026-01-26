"""Public API endpoints for other Expertly apps to consume themes."""

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.services.theme_service import ThemeService
from app.schemas.theme import PublicThemeResponse

router = APIRouter()


def get_theme_service(db: AsyncSession = Depends(get_db)) -> ThemeService:
    """Dependency to get theme service."""
    return ThemeService(db)


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
