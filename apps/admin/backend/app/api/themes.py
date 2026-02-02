"""Theme management API endpoints."""

from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.services.theme_service import ThemeService
from app.schemas.theme import (
    ThemeCreate,
    ThemeUpdate,
    ThemeResponse,
    ThemeListResponse,
    ThemeDetailResponse,
    ThemeVersionResponse,
    ThemeVersionListResponse,
)

router = APIRouter()


def get_theme_service(db: AsyncSession = Depends(get_db)) -> ThemeService:
    """Dependency to get theme service."""
    return ThemeService(db)


@router.get("", response_model=ThemeListResponse)
async def list_themes(
    include_inactive: bool = Query(False, description="Include inactive themes"),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=100),
    service: ThemeService = Depends(get_theme_service),
):
    """List all themes with their colors."""
    themes, total = await service.list_themes(
        include_inactive=include_inactive,
        skip=skip,
        limit=limit,
    )
    # Build response with colors for each theme
    theme_responses = []
    for t in themes:
        colors = t.get_current_snapshot()
        theme_responses.append(ThemeResponse(
            id=t.id,
            name=t.name,
            slug=t.slug,
            description=t.description,
            is_default=t.is_default,
            is_active=t.is_active,
            current_version=t.current_version,
            colors=colors,
            created_at=t.created_at,
            updated_at=t.updated_at,
        ))
    return ThemeListResponse(
        themes=theme_responses,
        total=total,
    )


@router.get("/{theme_id}", response_model=ThemeDetailResponse)
async def get_theme(
    theme_id: UUID,
    service: ThemeService = Depends(get_theme_service),
):
    """Get a theme by ID with current colors."""
    theme = await service.get_theme(theme_id)
    if not theme:
        raise HTTPException(status_code=404, detail="Theme not found")

    # Get current snapshot
    colors = theme.get_current_snapshot()

    return ThemeDetailResponse(
        id=theme.id,
        name=theme.name,
        slug=theme.slug,
        description=theme.description,
        is_default=theme.is_default,
        is_active=theme.is_active,
        current_version=theme.current_version,
        colors=colors,
        created_at=theme.created_at,
        updated_at=theme.updated_at,
    )


@router.post("", response_model=ThemeDetailResponse, status_code=201)
async def create_theme(
    data: ThemeCreate,
    service: ThemeService = Depends(get_theme_service),
):
    """Create a new theme."""
    # Check if slug already exists
    existing = await service.get_theme_by_slug(data.slug)
    if existing:
        raise HTTPException(
            status_code=400,
            detail=f"Theme with slug '{data.slug}' already exists",
        )

    theme = await service.create_theme(data)
    colors = theme.get_current_snapshot()

    return ThemeDetailResponse(
        id=theme.id,
        name=theme.name,
        slug=theme.slug,
        description=theme.description,
        is_default=theme.is_default,
        is_active=theme.is_active,
        current_version=theme.current_version,
        colors=colors,
        created_at=theme.created_at,
        updated_at=theme.updated_at,
    )


@router.put("/{theme_id}", response_model=ThemeDetailResponse)
async def update_theme(
    theme_id: UUID,
    data: ThemeUpdate,
    service: ThemeService = Depends(get_theme_service),
):
    """Update a theme. Creates a new version if colors are changed."""
    theme = await service.update_theme(theme_id, data)
    if not theme:
        raise HTTPException(status_code=404, detail="Theme not found")

    colors = theme.get_current_snapshot()

    return ThemeDetailResponse(
        id=theme.id,
        name=theme.name,
        slug=theme.slug,
        description=theme.description,
        is_default=theme.is_default,
        is_active=theme.is_active,
        current_version=theme.current_version,
        colors=colors,
        created_at=theme.created_at,
        updated_at=theme.updated_at,
    )


@router.delete("/{theme_id}", status_code=204)
async def delete_theme(
    theme_id: UUID,
    service: ThemeService = Depends(get_theme_service),
):
    """Soft delete a theme (set is_active=False)."""
    success = await service.delete_theme(theme_id)
    if not success:
        raise HTTPException(status_code=404, detail="Theme not found")


@router.get("/{theme_id}/versions", response_model=ThemeVersionListResponse)
async def list_versions(
    theme_id: UUID,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    service: ThemeService = Depends(get_theme_service),
):
    """List all versions for a theme."""
    # Verify theme exists
    theme = await service.get_theme(theme_id)
    if not theme:
        raise HTTPException(status_code=404, detail="Theme not found")

    versions, total = await service.get_versions(
        theme_id=theme_id,
        skip=skip,
        limit=limit,
    )

    return ThemeVersionListResponse(
        versions=[ThemeVersionResponse.model_validate(v) for v in versions],
        total=total,
    )


@router.post("/{theme_id}/restore/{version_id}", response_model=ThemeDetailResponse)
async def restore_version(
    theme_id: UUID,
    version_id: UUID,
    changed_by: Optional[str] = Query(None, description="Who is restoring this version"),
    service: ThemeService = Depends(get_theme_service),
):
    """Restore a theme to a previous version (creates new version from snapshot)."""
    theme = await service.restore_version(
        theme_id=theme_id,
        version_id=version_id,
        changed_by=changed_by,
    )

    if not theme:
        raise HTTPException(
            status_code=404,
            detail="Theme or version not found",
        )

    colors = theme.get_current_snapshot()

    return ThemeDetailResponse(
        id=theme.id,
        name=theme.name,
        slug=theme.slug,
        description=theme.description,
        is_default=theme.is_default,
        is_active=theme.is_active,
        current_version=theme.current_version,
        colors=colors,
        created_at=theme.created_at,
        updated_at=theme.updated_at,
    )
