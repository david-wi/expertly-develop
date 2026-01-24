"""Tenant schemas."""

from pydantic import BaseModel, Field
from uuid import UUID
from datetime import datetime
from typing import Optional


class TenantBase(BaseModel):
    """Base tenant schema."""
    name: str = Field(..., min_length=1, max_length=255)
    slug: str = Field(..., min_length=1, max_length=100, pattern=r"^[a-z0-9-]+$")


class TenantCreate(TenantBase):
    """Schema for creating a tenant."""
    pass


class TenantResponse(TenantBase):
    """Schema for tenant response."""
    id: UUID
    database_mode: str
    tier: str
    settings: dict
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
