"""
Tenant settings model for organization-specific configuration.

Stores per-organization settings like timezone, currency, shipment numbering
conventions, branding, custom fields, and white-label configuration.
"""

from typing import Optional, Dict, Any, List

from pydantic import BaseModel, Field

from app.models.base import MongoModel, utc_now
from datetime import datetime


class TenantBranding(MongoModel):
    """Branding settings for an organization (white-label support)."""

    # Override MongoModel defaults - branding is an embedded doc, not standalone
    class Config:
        pass

    logo_url: Optional[str] = None
    primary_color: Optional[str] = Field(
        default="#3B82F6",
        description="Primary brand color (hex)",
    )
    secondary_color: Optional[str] = Field(
        default="#10B981",
        description="Secondary brand color (hex)",
    )
    company_name: Optional[str] = Field(
        default=None,
        description="Branded company name override for customer-facing pages",
    )
    favicon_url: Optional[str] = Field(
        default=None,
        description="URL to custom favicon",
    )
    custom_domain: Optional[str] = Field(
        default=None,
        description="Custom domain for customer portal",
    )
    email_header_logo_url: Optional[str] = Field(
        default=None,
        description="Logo URL for email headers and notifications",
    )
    portal_title: Optional[str] = Field(
        default=None,
        description="Title displayed in browser tab and portal header",
    )
    hide_powered_by: bool = Field(
        default=False,
        description="Hide 'Powered by Expertly TMS' branding",
    )


class EmailTemplateOverride(BaseModel):
    """Customizable email template for white-label tenants."""
    template_name: str = Field(
        ...,
        description="Template identifier (e.g. quote_confirmation, shipment_update)",
    )
    subject: Optional[str] = Field(
        default=None,
        description="Custom email subject line (supports {{variable}} placeholders)",
    )
    header_html: Optional[str] = Field(
        default=None,
        description="Custom HTML for the email header section",
    )
    footer_html: Optional[str] = Field(
        default=None,
        description="Custom HTML for the email footer section",
    )
    body_template: Optional[str] = Field(
        default=None,
        description="Custom body template HTML (supports {{variable}} placeholders)",
    )
    is_active: bool = True


class TenantSettings(MongoModel):
    """
    Organization-specific settings for a TMS tenant.

    Each organization has one TenantSettings document that controls
    operational defaults, display preferences, branding, and white-label
    configuration including customizable email templates.
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
            "secondary_color": "#10B981",
            "company_name": None,
            "favicon_url": None,
            "custom_domain": None,
            "email_header_logo_url": None,
            "portal_title": None,
            "hide_powered_by": False,
        },
        description="White-label branding configuration",
    )
    email_templates: List[Dict[str, Any]] = Field(
        default_factory=list,
        description="Custom email template overrides for white-label",
    )
    created_at: datetime = Field(default_factory=utc_now)
    updated_at: datetime = Field(default_factory=utc_now)

    @classmethod
    def default_for_org(cls, org_id: str) -> "TenantSettings":
        """Create a TenantSettings with sensible defaults for a given org."""
        return cls(org_id=org_id)
