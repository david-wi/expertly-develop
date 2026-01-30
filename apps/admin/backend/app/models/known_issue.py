"""Known issue model for tracking known issues across Expertly apps."""

import uuid
from datetime import datetime, timezone
from enum import Enum

from sqlalchemy import Column, String, Text, DateTime, Index
from sqlalchemy.dialects.postgresql import UUID as PG_UUID

from app.models.base import Base, TimestampMixin, UUID


class IssueSeverity(str, Enum):
    """Issue severity levels."""
    CRITICAL = "critical"
    MAJOR = "major"
    MINOR = "minor"
    COSMETIC = "cosmetic"


class IssueStatus(str, Enum):
    """Known issue status."""
    OPEN = "open"
    INVESTIGATING = "investigating"
    WORKAROUND = "workaround"
    RESOLVED = "resolved"


class KnownIssue(Base, TimestampMixin):
    """Model for tracking known issues across all Expertly applications."""

    __tablename__ = "known_issues"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    # Issue details
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=False)

    # Affected app (null means all apps)
    app_name = Column(String(50), nullable=True, index=True)

    # Classification
    severity = Column(String(20), nullable=False, default=IssueSeverity.MINOR.value)
    status = Column(String(20), nullable=False, default=IssueStatus.OPEN.value)

    # Workaround and version info
    workaround = Column(Text, nullable=True)
    affected_version = Column(String(50), nullable=True)
    resolved_version = Column(String(50), nullable=True)

    # Timestamps
    resolved_at = Column(DateTime(timezone=True), nullable=True)

    __table_args__ = (
        Index('ix_known_issues_status', 'status'),
        Index('ix_known_issues_severity', 'severity'),
        Index('ix_known_issues_app_status', 'app_name', 'status'),
    )

    def __repr__(self) -> str:
        return f"<KnownIssue {self.title[:50]}...>"
