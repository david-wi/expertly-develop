"""Pydantic models for Identity service data types."""

from datetime import datetime
from enum import Enum
from typing import Optional
from pydantic import BaseModel, Field


class UserType(str, Enum):
    """User type enumeration."""
    HUMAN = "human"
    BOT = "bot"


class UserRole(str, Enum):
    """User role enumeration."""
    OWNER = "owner"
    ADMIN = "admin"
    MEMBER = "member"
    VIEWER = "viewer"


class BotConfig(BaseModel):
    """Configuration for bot users."""
    what_i_can_help_with: Optional[str] = None
    capabilities: list[str] = Field(default_factory=list)


class Organization(BaseModel):
    """Organization model from Identity service."""
    id: str
    name: str
    slug: str
    is_active: bool = True
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


class User(BaseModel):
    """User model from Identity service."""
    id: str
    organization_id: str
    name: str
    email: Optional[str] = None
    user_type: UserType = UserType.HUMAN
    role: UserRole = UserRole.MEMBER
    is_active: bool = True
    is_default: bool = False
    avatar_url: Optional[str] = None
    title: Optional[str] = None
    responsibilities: Optional[str] = None
    bot_config: Optional[BotConfig] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    # Organization info (populated when available)
    organization_name: Optional[str] = None

    @property
    def is_admin(self) -> bool:
        """Check if user has admin privileges."""
        return self.role in (UserRole.ADMIN, UserRole.OWNER)

    @property
    def is_owner(self) -> bool:
        """Check if user is an owner."""
        return self.role == UserRole.OWNER

    @property
    def is_bot(self) -> bool:
        """Check if user is a bot."""
        return self.user_type == UserType.BOT


class TeamMember(BaseModel):
    """Team member with role."""
    user_id: str
    role: str = "member"  # lead, member
    joined_at: Optional[datetime] = None


class Team(BaseModel):
    """Team model from Identity service."""
    id: str
    organization_id: str
    name: str
    description: Optional[str] = None
    members: list[TeamMember] = Field(default_factory=list)
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


class ValidateResponse(BaseModel):
    """Response from session validation."""
    valid: bool
    user: Optional[User] = None
    expires_at: Optional[datetime] = None


class SessionInfo(BaseModel):
    """Information about a session."""
    id: str
    created_at: datetime
    expires_at: datetime
    last_active_at: datetime
    ip_address: Optional[str] = None
    user_agent: Optional[str] = None


class UserListResponse(BaseModel):
    """Response for listing users."""
    items: list[User]
    total: int


class OrganizationListResponse(BaseModel):
    """Response for listing organizations."""
    items: list[Organization]
    total: int


class TeamListResponse(BaseModel):
    """Response for listing teams."""
    items: list[Team]
    total: int
