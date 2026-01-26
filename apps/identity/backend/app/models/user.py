import uuid
from datetime import datetime
from enum import Enum
from sqlalchemy import Column, String, DateTime, Boolean, ForeignKey, Text, JSON
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.database import Base


class UserType(str, Enum):
    HUMAN = "human"
    BOT = "bot"


class UserRole(str, Enum):
    OWNER = "owner"
    ADMIN = "admin"
    MEMBER = "member"


class User(Base):
    """User model - supports both human and bot users."""

    __tablename__ = "users"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    organization_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id"), nullable=False)

    # Basic info
    name = Column(String(255), nullable=False)
    email = Column(String(255), nullable=True)  # Optional for bots
    user_type = Column(String(20), default=UserType.HUMAN.value)
    role = Column(String(20), default=UserRole.MEMBER.value)

    # Status
    is_active = Column(Boolean, default=True)
    is_default = Column(Boolean, default=False)

    # Profile
    avatar_url = Column(Text, nullable=True)
    title = Column(String(255), nullable=True)
    responsibilities = Column(Text, nullable=True)

    # Bot-specific config (JSON)
    bot_config = Column(JSON, nullable=True)

    # Auth
    api_key_hash = Column(String(255), nullable=True)

    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    organization = relationship("Organization", back_populates="users")
    team_memberships = relationship("TeamMember", back_populates="user", cascade="all, delete-orphan")
