"""Tenant model for multitenancy."""

from typing import Optional
from pydantic import Field

from app.models.base import MongoModel, TimestampMixin, PyObjectId


class TenantSettings(MongoModel):
    """Tenant-level settings."""

    default_visibility: str = "team"


class Tenant(MongoModel, TimestampMixin):
    """Tenant (company) model."""

    name: str
    slug: str
    settings: TenantSettings = Field(default_factory=TenantSettings)

    class Config:
        json_schema_extra = {
            "example": {
                "name": "Acme Corp",
                "slug": "acme-corp",
                "settings": {"default_visibility": "team"},
            }
        }
