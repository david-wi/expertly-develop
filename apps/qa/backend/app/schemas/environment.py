"""Environment schemas."""
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field, HttpUrl


class Credentials(BaseModel):
    """Credentials for environment authentication."""

    username: Optional[str] = None
    password: Optional[str] = None
    login_url: Optional[str] = None
    username_selector: Optional[str] = None
    password_selector: Optional[str] = None
    submit_selector: Optional[str] = None
    token: Optional[str] = None


class EnvironmentCreate(BaseModel):
    """Schema for creating an environment."""

    name: str = Field(..., min_length=1, max_length=255)
    type: str = Field(default="staging", pattern="^(staging|production|qa|development)$")
    base_url: str = Field(..., min_length=1, max_length=500)
    credentials: Optional[Credentials] = None
    is_default: bool = False
    notes: Optional[str] = None


class EnvironmentUpdate(BaseModel):
    """Schema for updating an environment."""

    name: Optional[str] = Field(None, min_length=1, max_length=255)
    type: Optional[str] = Field(None, pattern="^(staging|production|qa|development)$")
    base_url: Optional[str] = Field(None, min_length=1, max_length=500)
    credentials: Optional[Credentials] = None
    is_default: Optional[bool] = None
    notes: Optional[str] = None


class EnvironmentResponse(BaseModel):
    """Schema for environment response."""

    id: str
    project_id: str
    name: str
    type: str
    base_url: str
    is_default: bool
    notes: Optional[str]
    created_at: datetime
    updated_at: datetime
    # Note: credentials are not returned for security

    class Config:
        from_attributes = True
