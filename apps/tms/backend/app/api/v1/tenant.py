"""
Tenant management API endpoints.

Provides endpoints for:
- Retrieving current tenant/org info
- Managing tenant-specific settings
- Listing users in the current org
- Inviting users to the org
"""

from typing import Optional, Dict, Any, List
from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, Field

from app.database import get_database
from app.middleware.tenant import get_current_org_id, get_tenant_db, TenantDatabase
from app.models.tenant_settings import TenantSettings
from app.models.base import utc_now

router = APIRouter()


# ---------------------------------------------------------------------------
# Request / Response schemas
# ---------------------------------------------------------------------------


class TenantInfoResponse(BaseModel):
    """Response schema for tenant info."""
    org_id: Optional[str] = None
    company_name: Optional[str] = None
    timezone: str = "America/New_York"
    currency: str = "USD"
    member_count: int = 0


class TenantSettingsResponse(BaseModel):
    """Response schema for tenant settings."""
    id: Optional[str] = None
    org_id: str
    company_name: Optional[str] = None
    timezone: str = "America/New_York"
    currency: str = "USD"
    date_format: str = "MM/DD/YYYY"
    shipment_number_prefix: str = "SHP"
    auto_numbering: bool = True
    default_equipment_type: str = "dry_van"
    custom_fields: Dict[str, Any] = {}
    branding: Dict[str, Any] = {}
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


class TenantSettingsUpdate(BaseModel):
    """Request schema for updating tenant settings."""
    company_name: Optional[str] = None
    timezone: Optional[str] = None
    currency: Optional[str] = None
    date_format: Optional[str] = None
    shipment_number_prefix: Optional[str] = None
    auto_numbering: Optional[bool] = None
    default_equipment_type: Optional[str] = None
    custom_fields: Optional[Dict[str, Any]] = None
    branding: Optional[Dict[str, Any]] = None


class TenantUserResponse(BaseModel):
    """Response schema for a user in the tenant."""
    id: str
    email: str
    name: Optional[str] = None
    role: Optional[str] = None
    joined_at: Optional[datetime] = None


class InviteUserRequest(BaseModel):
    """Request schema for inviting a user to the org."""
    email: str = Field(..., description="Email address of the user to invite")
    role: str = Field(default="member", description="Role to assign to the invited user")
    name: Optional[str] = Field(default=None, description="Name of the invited user")


class InviteUserResponse(BaseModel):
    """Response schema for a user invitation."""
    id: str
    org_id: str
    email: str
    role: str
    name: Optional[str] = None
    status: str = "pending"
    invited_at: datetime


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------


@router.get("/info", response_model=TenantInfoResponse)
async def get_tenant_info(
    org_id: Optional[str] = Depends(get_current_org_id),
):
    """Get current tenant/org info."""
    if not org_id:
        return TenantInfoResponse()

    db = get_database()

    # Get settings for this org
    settings_doc = await db["tenant_settings"].find_one({"org_id": org_id})

    # Count members
    member_count = await db["tenant_members"].count_documents({"org_id": org_id})

    company_name = None
    tenant_timezone = "America/New_York"
    currency = "USD"

    if settings_doc:
        company_name = settings_doc.get("company_name")
        tenant_timezone = settings_doc.get("timezone", "America/New_York")
        currency = settings_doc.get("currency", "USD")

    return TenantInfoResponse(
        org_id=org_id,
        company_name=company_name,
        timezone=tenant_timezone,
        currency=currency,
        member_count=member_count,
    )


@router.get("/settings", response_model=TenantSettingsResponse)
async def get_tenant_settings(
    org_id: Optional[str] = Depends(get_current_org_id),
):
    """Get tenant-specific settings."""
    if not org_id:
        # Return defaults when no org is selected
        default_settings = TenantSettings.default_for_org("none")
        return TenantSettingsResponse(
            org_id="none",
            company_name=default_settings.company_name,
            timezone=default_settings.timezone,
            currency=default_settings.currency,
            date_format=default_settings.date_format,
            shipment_number_prefix=default_settings.shipment_number_prefix,
            auto_numbering=default_settings.auto_numbering,
            default_equipment_type=default_settings.default_equipment_type,
            custom_fields=default_settings.custom_fields,
            branding=default_settings.branding,
        )

    db = get_database()
    settings_doc = await db["tenant_settings"].find_one({"org_id": org_id})

    if not settings_doc:
        # Create default settings for this org
        default_settings = TenantSettings.default_for_org(org_id)
        doc = default_settings.model_dump_mongo()
        await db["tenant_settings"].insert_one(doc)
        settings_doc = doc

    return TenantSettingsResponse(
        id=str(settings_doc.get("_id", "")),
        org_id=settings_doc.get("org_id", org_id),
        company_name=settings_doc.get("company_name"),
        timezone=settings_doc.get("timezone", "America/New_York"),
        currency=settings_doc.get("currency", "USD"),
        date_format=settings_doc.get("date_format", "MM/DD/YYYY"),
        shipment_number_prefix=settings_doc.get("shipment_number_prefix", "SHP"),
        auto_numbering=settings_doc.get("auto_numbering", True),
        default_equipment_type=settings_doc.get("default_equipment_type", "dry_van"),
        custom_fields=settings_doc.get("custom_fields", {}),
        branding=settings_doc.get("branding", {}),
        created_at=settings_doc.get("created_at"),
        updated_at=settings_doc.get("updated_at"),
    )


@router.put("/settings", response_model=TenantSettingsResponse)
async def update_tenant_settings(
    update: TenantSettingsUpdate,
    org_id: Optional[str] = Depends(get_current_org_id),
):
    """Update tenant-specific settings."""
    if not org_id:
        raise HTTPException(status_code=400, detail="No organization selected")

    db = get_database()

    # Build update dict from non-None fields
    update_data: Dict[str, Any] = {}
    for field_name, value in update.model_dump(exclude_none=True).items():
        update_data[field_name] = value
    update_data["updated_at"] = utc_now()

    # Upsert the settings document
    result = await db["tenant_settings"].find_one_and_update(
        {"org_id": org_id},
        {"$set": update_data},
        upsert=True,
        return_document=True,
    )

    if not result:
        raise HTTPException(status_code=500, detail="Failed to update settings")

    return TenantSettingsResponse(
        id=str(result.get("_id", "")),
        org_id=result.get("org_id", org_id),
        company_name=result.get("company_name"),
        timezone=result.get("timezone", "America/New_York"),
        currency=result.get("currency", "USD"),
        date_format=result.get("date_format", "MM/DD/YYYY"),
        shipment_number_prefix=result.get("shipment_number_prefix", "SHP"),
        auto_numbering=result.get("auto_numbering", True),
        default_equipment_type=result.get("default_equipment_type", "dry_van"),
        custom_fields=result.get("custom_fields", {}),
        branding=result.get("branding", {}),
        created_at=result.get("created_at"),
        updated_at=result.get("updated_at"),
    )


@router.get("/users", response_model=List[TenantUserResponse])
async def list_tenant_users(
    org_id: Optional[str] = Depends(get_current_org_id),
):
    """List users in the current organization."""
    if not org_id:
        return []

    db = get_database()
    cursor = db["tenant_members"].find({"org_id": org_id})
    members = await cursor.to_list(length=None)

    return [
        TenantUserResponse(
            id=str(member.get("_id", "")),
            email=member.get("email", ""),
            name=member.get("name"),
            role=member.get("role", "member"),
            joined_at=member.get("joined_at"),
        )
        for member in members
    ]


@router.post("/invite", response_model=InviteUserResponse)
async def invite_user(
    invite: InviteUserRequest,
    org_id: Optional[str] = Depends(get_current_org_id),
):
    """Invite a user to the current organization."""
    if not org_id:
        raise HTTPException(status_code=400, detail="No organization selected")

    db = get_database()

    # Check if user is already a member
    existing = await db["tenant_members"].find_one({
        "org_id": org_id,
        "email": invite.email,
    })
    if existing:
        raise HTTPException(
            status_code=409,
            detail=f"User {invite.email} is already a member of this organization",
        )

    # Check for existing pending invitation
    existing_invite = await db["tenant_invitations"].find_one({
        "org_id": org_id,
        "email": invite.email,
        "status": "pending",
    })
    if existing_invite:
        raise HTTPException(
            status_code=409,
            detail=f"An invitation for {invite.email} is already pending",
        )

    # Create invitation record
    now = utc_now()
    invitation_doc = {
        "org_id": org_id,
        "email": invite.email,
        "role": invite.role,
        "name": invite.name,
        "status": "pending",
        "invited_at": now,
        "created_at": now,
        "updated_at": now,
    }

    result = await db["tenant_invitations"].insert_one(invitation_doc)

    return InviteUserResponse(
        id=str(result.inserted_id),
        org_id=org_id,
        email=invite.email,
        role=invite.role,
        name=invite.name,
        status="pending",
        invited_at=now,
    )
