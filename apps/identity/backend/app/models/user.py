import uuid
from datetime import datetime
from enum import Enum
from sqlalchemy import Column, String, DateTime, Boolean, ForeignKey, Text, JSON, UniqueConstraint, Index
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from passlib.context import CryptContext

from app.database import Base

# Password hashing context
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


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
    __table_args__ = (
        # Unique email per organization (only for non-null emails)
        Index(
            'ix_users_org_email_unique',
            'organization_id',
            'email',
            unique=True,
            postgresql_where=Column('email').isnot(None)
        ),
    )

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

    # Expertly Admin flag - gives access to all organizations
    is_expertly_admin = Column(Boolean, default=False)

    # Profile
    avatar_url = Column(Text, nullable=True)
    title = Column(String(255), nullable=True)
    responsibilities = Column(Text, nullable=True)

    # Bot-specific config (JSON)
    bot_config = Column(JSON, nullable=True)

    # Auth
    api_key_hash = Column(String(255), nullable=True)
    password_hash = Column(String(255), nullable=True)  # For login authentication

    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    organization = relationship("Organization", back_populates="users")
    team_memberships = relationship("TeamMember", back_populates="user", cascade="all, delete-orphan")
    sessions = relationship("Session", back_populates="user", cascade="all, delete-orphan")
    organization_memberships = relationship("OrganizationMembership", back_populates="user", cascade="all, delete-orphan")

    def set_password(self, password: str) -> None:
        """Hash and set the user's password."""
        self.password_hash = pwd_context.hash(password)

    def verify_password(self, password: str) -> bool:
        """Verify a password against the stored hash."""
        if not self.password_hash:
            return False
        return pwd_context.verify(password, self.password_hash)
