from datetime import datetime
from typing import Optional, List
from uuid import UUID
from pydantic import BaseModel, EmailStr


class BotConfig(BaseModel):
    """Configuration for bot users."""

    what_i_can_help_with: Optional[str] = None
    capabilities: List[str] = []


class UserCreate(BaseModel):
    """Schema for creating a user."""

    name: str
    email: Optional[EmailStr] = None  # Optional for bots
    user_type: str = "human"
    role: str = "member"
    avatar_url: Optional[str] = None
    title: Optional[str] = None
    responsibilities: Optional[str] = None
    bot_config: Optional[BotConfig] = None


class UserUpdate(BaseModel):
    """Schema for updating a user."""

    name: Optional[str] = None
    email: Optional[EmailStr] = None
    role: Optional[str] = None
    is_active: Optional[bool] = None
    is_expertly_admin: Optional[bool] = None  # Requires Expertly Admin to set
    avatar_url: Optional[str] = None
    title: Optional[str] = None
    responsibilities: Optional[str] = None
    bot_config: Optional[BotConfig] = None


class UserResponse(BaseModel):
    """Schema for user response."""

    id: UUID
    organization_id: UUID
    name: str
    email: Optional[str]
    user_type: str
    role: str
    is_active: bool
    is_default: bool
    is_expertly_admin: bool = False
    avatar_url: Optional[str]
    title: Optional[str]
    responsibilities: Optional[str]
    bot_config: Optional[dict]
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class UserListResponse(BaseModel):
    """Schema for user list response."""

    items: List[UserResponse]
    total: int


class UserCreateResponse(BaseModel):
    """Response after creating a user, includes API key."""

    user: UserResponse
    api_key: Optional[str] = None
