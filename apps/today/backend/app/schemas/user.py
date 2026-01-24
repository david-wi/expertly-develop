"""User schemas."""

from pydantic import BaseModel, Field, EmailStr
from uuid import UUID
from datetime import datetime
from typing import Optional


class UserBase(BaseModel):
    """Base user schema."""
    email: EmailStr
    name: Optional[str] = Field(None, max_length=255)
    timezone: str = Field(default="UTC", max_length=50)


class UserCreate(UserBase):
    """Schema for creating a user."""
    tenant_id: UUID


class UserResponse(UserBase):
    """Schema for user response."""
    id: UUID
    tenant_id: UUID
    role: str
    settings: dict
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class UserWithApiKey(UserResponse):
    """Schema for user response with API key (only on creation)."""
    api_key: str
