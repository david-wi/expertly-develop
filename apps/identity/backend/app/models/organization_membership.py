"""Organization membership model for multi-org user access."""

import uuid
from datetime import datetime
from enum import Enum
from sqlalchemy import Column, String, DateTime, ForeignKey, UniqueConstraint, Boolean
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.database import Base


class MembershipRole(str, Enum):
    """Role within an organization membership."""
    OWNER = "owner"
    ADMIN = "admin"
    MEMBER = "member"


class OrganizationMembership(Base):
    """
    Links users to organizations they have access to.

    A user can be a member of multiple organizations with different roles.
    This replaces the single organization_id on User for multi-org support.
    """

    __tablename__ = "organization_memberships"
    __table_args__ = (
        UniqueConstraint('user_id', 'organization_id', name='uq_user_org_membership'),
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    organization_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False)

    # Role within this organization
    role = Column(String(20), default=MembershipRole.MEMBER.value, nullable=False)

    # Whether this is the user's primary/default organization
    is_primary = Column(Boolean, default=False, nullable=False)

    # Timestamps
    joined_at = Column(DateTime, default=datetime.utcnow)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    user = relationship("User", back_populates="organization_memberships")
    organization = relationship("Organization", back_populates="memberships")
