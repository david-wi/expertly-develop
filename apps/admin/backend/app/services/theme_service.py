"""Theme service for business logic."""

from datetime import datetime, timezone
from typing import Optional
from uuid import UUID
import uuid

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.theme import Theme, ThemeVersion, ThemeVersionStatus
from app.schemas.theme import ThemeCreate, ThemeUpdate


class ThemeService:
    """Service class for theme operations."""

    def __init__(self, db: AsyncSession):
        self.db = db

    async def list_themes(
        self,
        include_inactive: bool = False,
        skip: int = 0,
        limit: int = 100,
    ) -> tuple[list[Theme], int]:
        """List all themes with pagination."""
        query = select(Theme)
        if not include_inactive:
            query = query.where(Theme.is_active == True)

        # Get total count
        count_query = select(func.count()).select_from(Theme)
        if not include_inactive:
            count_query = count_query.where(Theme.is_active == True)
        total_result = await self.db.execute(count_query)
        total = total_result.scalar()

        # Get paginated results
        query = query.offset(skip).limit(limit).order_by(Theme.name)
        result = await self.db.execute(query)
        themes = result.scalars().all()

        return list(themes), total

    async def get_theme(self, theme_id: UUID) -> Optional[Theme]:
        """Get a theme by ID with its versions."""
        query = select(Theme).where(Theme.id == theme_id).options(
            selectinload(Theme.versions)
        )
        result = await self.db.execute(query)
        return result.scalar_one_or_none()

    async def get_theme_by_slug(self, slug: str) -> Optional[Theme]:
        """Get a theme by slug with its versions."""
        query = select(Theme).where(Theme.slug == slug).options(
            selectinload(Theme.versions)
        )
        result = await self.db.execute(query)
        return result.scalar_one_or_none()

    async def create_theme(self, data: ThemeCreate) -> Theme:
        """Create a new theme with initial version."""
        # Create theme
        theme = Theme(
            id=uuid.uuid4(),
            name=data.name,
            slug=data.slug,
            description=data.description,
            is_default=data.is_default,
            is_active=True,
            current_version=1,
        )

        # If this is the new default, unset other defaults
        if data.is_default:
            await self._unset_other_defaults(None)

        self.db.add(theme)
        await self.db.flush()

        # Create initial version
        version = ThemeVersion(
            id=uuid.uuid4(),
            theme_id=theme.id,
            version_number=1,
            snapshot=data.colors.model_dump(by_alias=True),
            change_summary="Initial version",
            changed_by="system",
            changed_at=datetime.now(timezone.utc),
            status=ThemeVersionStatus.ACTIVE,
        )
        self.db.add(version)

        await self.db.flush()

        # Expire and re-fetch with versions loaded to avoid lazy loading issues
        # (expiring is necessary because the session's identity map caches the object)
        self.db.expire(theme)
        theme = await self.get_theme(theme.id)
        return theme

    async def update_theme(
        self,
        theme_id: UUID,
        data: ThemeUpdate,
    ) -> Optional[Theme]:
        """Update a theme, creating a new version if colors changed."""
        theme = await self.get_theme(theme_id)
        if not theme:
            return None

        # Track if we need a new version
        colors_changed = data.colors is not None

        # Update basic fields
        if data.name is not None:
            theme.name = data.name
        if data.description is not None:
            theme.description = data.description
        if data.is_active is not None:
            theme.is_active = data.is_active
        if data.is_default is not None:
            if data.is_default:
                await self._unset_other_defaults(theme_id)
            theme.is_default = data.is_default

        # Create new version if colors changed
        if colors_changed:
            # Mark current version as superseded
            await self._supersede_current_version(theme)

            # Increment version
            new_version_number = theme.current_version + 1
            theme.current_version = new_version_number

            # Create new version
            version = ThemeVersion(
                id=uuid.uuid4(),
                theme_id=theme.id,
                version_number=new_version_number,
                snapshot=data.colors.model_dump(by_alias=True),
                change_summary=data.change_summary,
                changed_by=data.changed_by,
                changed_at=datetime.now(timezone.utc),
                status=ThemeVersionStatus.ACTIVE,
            )
            self.db.add(version)

        await self.db.flush()

        # Expire and re-fetch with versions loaded to avoid lazy loading issues
        self.db.expire(theme)
        theme = await self.get_theme(theme.id)
        return theme

    async def delete_theme(self, theme_id: UUID) -> bool:
        """Soft delete a theme (set is_active=False)."""
        theme = await self.get_theme(theme_id)
        if not theme:
            return False

        theme.is_active = False
        await self.db.flush()
        return True

    async def get_versions(
        self,
        theme_id: UUID,
        skip: int = 0,
        limit: int = 50,
    ) -> tuple[list[ThemeVersion], int]:
        """Get version history for a theme."""
        # Get total count
        count_query = select(func.count()).select_from(ThemeVersion).where(
            ThemeVersion.theme_id == theme_id
        )
        total_result = await self.db.execute(count_query)
        total = total_result.scalar()

        # Get paginated results
        query = select(ThemeVersion).where(
            ThemeVersion.theme_id == theme_id
        ).offset(skip).limit(limit).order_by(ThemeVersion.version_number.desc())
        result = await self.db.execute(query)
        versions = result.scalars().all()

        return list(versions), total

    async def get_version(
        self,
        theme_id: UUID,
        version_id: UUID,
    ) -> Optional[ThemeVersion]:
        """Get a specific version."""
        query = select(ThemeVersion).where(
            ThemeVersion.id == version_id,
            ThemeVersion.theme_id == theme_id,
        )
        result = await self.db.execute(query)
        return result.scalar_one_or_none()

    async def restore_version(
        self,
        theme_id: UUID,
        version_id: UUID,
        changed_by: Optional[str] = None,
    ) -> Optional[Theme]:
        """Restore a theme to a previous version (creates new version from snapshot)."""
        theme = await self.get_theme(theme_id)
        if not theme:
            return None

        # Get the version to restore
        old_version = await self.get_version(theme_id, version_id)
        if not old_version:
            return None

        # Mark current version as superseded
        await self._supersede_current_version(theme)

        # Increment version
        new_version_number = theme.current_version + 1
        theme.current_version = new_version_number

        # Create new version from old snapshot
        version = ThemeVersion(
            id=uuid.uuid4(),
            theme_id=theme.id,
            version_number=new_version_number,
            snapshot=old_version.snapshot,
            change_summary=f"Restored from version {old_version.version_number}",
            changed_by=changed_by,
            changed_at=datetime.now(timezone.utc),
            status=ThemeVersionStatus.ACTIVE,
        )
        self.db.add(version)

        await self.db.flush()

        # Expire and re-fetch with versions loaded to avoid lazy loading issues
        self.db.expire(theme)
        theme = await self.get_theme(theme.id)
        return theme

    async def get_active_themes_for_public(self) -> list[Theme]:
        """Get all active themes for the public API."""
        query = select(Theme).where(Theme.is_active == True).options(
            selectinload(Theme.versions)
        ).order_by(Theme.name)
        result = await self.db.execute(query)
        return list(result.scalars().all())

    async def _unset_other_defaults(self, exclude_id: Optional[UUID]) -> None:
        """Unset is_default on all other themes."""
        query = select(Theme).where(Theme.is_default == True)
        if exclude_id:
            query = query.where(Theme.id != exclude_id)
        result = await self.db.execute(query)
        themes = result.scalars().all()
        for theme in themes:
            theme.is_default = False

    async def _supersede_current_version(self, theme: Theme) -> None:
        """Mark the current active version as superseded."""
        query = select(ThemeVersion).where(
            ThemeVersion.theme_id == theme.id,
            ThemeVersion.version_number == theme.current_version,
        )
        result = await self.db.execute(query)
        current_version = result.scalar_one_or_none()
        if current_version:
            current_version.status = ThemeVersionStatus.SUPERSEDED
