"""
Tenant settings model for organization-specific configuration.

Stores per-organization settings like timezone, currency, shipment numbering
conventions, branding, and custom fields.
"""

from typing import Optional, Dict, Any

from pydantic import Field

from app.models.base import MongoModel, utc_now
from datetime import datetime


class TenantBranding(MongoModel):
    """Branding settings for an organization."""

    # Override MongoModel defaults - branding is an embedded doc, not standalone
    class Config:
        pass

    logo_url: Optional[str] = None
    primary_color: Optional[str] = Field(
        default="#3B82F6",
        description="Primary brand color (hex)",
    )


class TenantSettings(MongoModel):
    """
    Organization-specific settings for a TMS tenant.

    Each organization has one TenantSettings document that controls
    operational defaults, display preferences, and branding.
    """

    org_id: str = Field(
        ...,
        description="Organization ID this settings document belongs to",
    )
    company_name: Optional[str] = Field(
        default=None,
        description="Display name of the organization",
    )
    timezone: str = Field(
        default="America/New_York",
        description="Default timezone for the organization (IANA format)",
    )
    currency: str = Field(
        default="USD",
        description="Default currency code (ISO 4217)",
    )
    date_format: str = Field(
        default="MM/DD/YYYY",
        description="Preferred date display format",
    )
    shipment_number_prefix: str = Field(
        default="SHP",
        description="Prefix for auto-generated shipment numbers",
    )
    auto_numbering: bool = Field(
        default=True,
        description="Whether to auto-generate shipment/quote numbers",
    )
    default_equipment_type: str = Field(
        default="dry_van",
        description="Default equipment type for new shipments",
    )
    custom_fields: Dict[str, Any] = Field(
        default_factory=dict,
        description="Custom field definitions for the organization",
    )
    branding: Dict[str, Any] = Field(
        default_factory=lambda: {
            "logo_url": None,
            "primary_color": "#3B82F6",
        },
        description="Branding configuration (logo_url, primary_color)",
    )
    created_at: datetime = Field(default_factory=utc_now)
    updated_at: datetime = Field(default_factory=utc_now)

    @classmethod
    def default_for_org(cls, org_id: str) -> "TenantSettings":
        """Create a TenantSettings with sensible defaults for a given org."""
        return cls(org_id=org_id)
