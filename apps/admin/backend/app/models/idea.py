"""Idea model for centralized idea tracking across Expertly products.

Supports both product-wide ideas and organization-specific backlog items:
- organization_id = NULL: Product-wide idea visible to all
- organization_id = UUID: Organization-private backlog item
"""

import uuid
from enum import Enum

from sqlalchemy import Column, String, Text, Index, Integer
from sqlalchemy.orm import relationship

from app.models.base import Base, TimestampMixin, UUID, JSONB


class IdeaStatus(str, Enum):
    """Idea status levels."""
    NEW = "new"
    EXPLORING = "in_progress"
    IMPLEMENTED = "done"
    ARCHIVED = "archived"


class IdeaPriority(str, Enum):
    """Idea priority levels."""
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"


class Idea(Base, TimestampMixin):
    """Model for tracking ideas across all Expertly products."""

    __tablename__ = "ideas"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    # Organization ID for org-specific backlogs (NULL = product-wide idea)
    organization_id = Column(UUID(as_uuid=True), nullable=True, index=True)

    # Product this idea belongs to
    product = Column(String(50), nullable=False, index=True)

    # Idea details
    title = Column(String(500), nullable=False)
    description = Column(Text, nullable=True)

    # Classification
    status = Column(String(20), nullable=False, default=IdeaStatus.NEW.value)
    priority = Column(String(20), nullable=False, default=IdeaPriority.MEDIUM.value)

    # Tags for categorization
    tags = Column(JSONB, nullable=True, default=list)

    # Creator tracking
    created_by_email = Column(String(255), nullable=True)

    # Vote count (denormalized for performance)
    vote_count = Column(Integer, default=0, nullable=False)

    # Relationships
    votes = relationship("IdeaVote", back_populates="idea", cascade="all, delete-orphan")
    comments = relationship("IdeaComment", back_populates="idea", cascade="all, delete-orphan")

    __table_args__ = (
        Index('ix_ideas_status', 'status'),
        Index('ix_ideas_priority', 'priority'),
        Index('ix_ideas_product_status', 'product', 'status'),
        Index('ix_ideas_org_status', 'organization_id', 'status'),
    )

    def __repr__(self) -> str:
        return f"<Idea {self.title[:50]}...>"
