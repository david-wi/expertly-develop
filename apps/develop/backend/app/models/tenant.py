"""Tenant model for multitenancy - shadow records for Identity organizations."""

from typing import Optional
from pydantic import Field

from app.models.base import MongoModel, TimestampMixin, PyObjectId


class TenantSettings(MongoModel):
    """Tenant-level settings."""

    default_visibility: str = "team"


class Tenant(MongoModel, TimestampMixin):
    """
    Tenant (company) model - shadow record for Identity organizations.

    Links to Identity service organization via identity_id field.
    """

    name: str
    slug: str
    settings: TenantSettings = Field(default_factory=TenantSettings)

    # Link to Identity service organization
    identity_id: Optional[str] = None  # Organization UUID from Identity service

    class Config:
        json_schema_extra = {
            "example": {
                "name": "Acme Corp",
                "slug": "acme-corp",
                "settings": {"default_visibility": "team"},
                "identity_id": "550e8400-e29b-41d4-a716-446655440000",
            }
        }
