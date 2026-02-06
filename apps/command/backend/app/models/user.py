from enum import Enum
from typing import Optional
from pydantic import BaseModel, Field

from app.models.base import MongoModel, PyObjectId


class UserType(str, Enum):
    HUMAN = "human"
    VIRTUAL = "virtual"


class UserRole(str, Enum):
    OWNER = "owner"
    ADMIN = "admin"
    MEMBER = "member"


class BotConfig(BaseModel):
    """Configuration for virtual/bot users."""
    poll_interval_seconds: int = 5
    max_concurrent_tasks: int = 1
    allowed_queue_ids: list[str] = Field(default_factory=list)
    capabilities: list[str] = Field(default_factory=list)
    what_i_can_help_with: Optional[str] = None


class User(MongoModel):
    """User model - supports both human and virtual (bot) users."""
    organization_id: PyObjectId
    email: str
    name: str
    user_type: UserType = UserType.HUMAN
    role: UserRole = UserRole.MEMBER
    is_active: bool = True
    is_default: bool = False

    # Profile
    avatar_url: Optional[str] = None
    title: Optional[str] = None
    responsibilities: Optional[str] = None

    # Auth
    api_key_hash: Optional[str] = None

    # Bot-specific config
    bot_config: Optional[BotConfig] = None

    # Human-specific
    password_hash: Optional[str] = None


class UserCreate(BaseModel):
    """Schema for creating a user."""
    email: str
    name: str
    user_type: UserType = UserType.HUMAN
    role: UserRole = UserRole.MEMBER
    organization_id: Optional[str] = None
    avatar_url: Optional[str] = None
    title: Optional[str] = None
    responsibilities: Optional[str] = None
    bot_config: Optional[BotConfig] = None


class UserUpdate(BaseModel):
    """Schema for updating a user."""
    email: Optional[str] = None
    name: Optional[str] = None
    role: Optional[UserRole] = None
    is_active: Optional[bool] = None
    avatar_url: Optional[str] = None
    title: Optional[str] = None
    responsibilities: Optional[str] = None
    bot_config: Optional[BotConfig] = None
