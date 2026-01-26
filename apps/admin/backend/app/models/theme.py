"""Theme and ThemeVersion models for managing application themes."""

import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, Text, Integer, Boolean, ForeignKey, UniqueConstraint, DateTime
from sqlalchemy.orm import relationship

from app.models.base import Base, TimestampMixin, UUID, JSONB


class ThemeVersionStatus:
    """Theme version status constants."""
    ACTIVE = "active"
    SUPERSEDED = "superseded"

    ALL = [ACTIVE, SUPERSEDED]


class Theme(Base, TimestampMixin):
    """
    Theme represents a color theme for Expertly applications.

    Each theme has a current version and maintains a full version history.
    """

    __tablename__ = "themes"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    # Core fields
    name = Column(String(100), nullable=False, unique=True)
    slug = Column(String(100), nullable=False, unique=True)  # e.g., 'violet', 'ocean'
    description = Column(Text, nullable=True)

    # State
    is_default = Column(Boolean, default=False, nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    current_version = Column(Integer, default=1, nullable=False)

    # Relationships
    versions = relationship(
        "ThemeVersion",
        back_populates="theme",
        cascade="all, delete-orphan",
        order_by="desc(ThemeVersion.version_number)"
    )

    def __repr__(self) -> str:
        return f"<Theme {self.name} (v{self.current_version})>"

    def get_current_snapshot(self) -> dict:
        """Get the current version's color snapshot."""
        for version in self.versions:
            if version.version_number == self.current_version:
                return version.snapshot
        return {}


class ThemeVersion(Base):
    """
    ThemeVersion stores a full snapshot of theme colors at a point in time.

    Every edit creates a new version, allowing full history and restore capability.
    """

    __tablename__ = "theme_versions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    theme_id = Column(
        UUID(as_uuid=True),
        ForeignKey("themes.id", ondelete="CASCADE"),
        nullable=False,
    )

    # Version tracking
    version_number = Column(Integer, nullable=False)

    # Full color palette snapshot
    snapshot = Column(JSONB, nullable=False)

    # Audit info
    change_summary = Column(Text, nullable=True)
    changed_by = Column(String(100), nullable=True)
    changed_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    # Status
    status = Column(
        String(20),
        default=ThemeVersionStatus.ACTIVE,
        nullable=False,
    )

    # Relationships
    theme = relationship("Theme", back_populates="versions")

    __table_args__ = (
        UniqueConstraint('theme_id', 'version_number', name='uq_theme_version'),
    )

    def __repr__(self) -> str:
        return f"<ThemeVersion {self.theme_id} v{self.version_number}>"
