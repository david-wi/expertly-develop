from typing import Optional
from pydantic import BaseModel, Field

from app.models.base import MongoModel, PyObjectId


class OrganizationSettings(BaseModel):
    """Organization-level settings."""
    allow_virtual_users: bool = True
    default_task_priority: int = 5
    task_checkout_timeout_minutes: int = 30


class Organization(MongoModel):
    """Organization/tenant model."""
    name: str
    slug: str
    settings: OrganizationSettings = Field(default_factory=OrganizationSettings)
    is_default: bool = False


class OrganizationCreate(BaseModel):
    """Schema for creating an organization."""
    name: str
    slug: str
    settings: Optional[OrganizationSettings] = None
    is_default: bool = False


class OrganizationUpdate(BaseModel):
    """Schema for updating an organization."""
    name: Optional[str] = None
    slug: Optional[str] = None
    settings: Optional[OrganizationSettings] = None
