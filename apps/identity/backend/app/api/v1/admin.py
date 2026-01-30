"""Admin API endpoints for privileged operations."""

from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, EmailStr
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models import User, Organization

router = APIRouter()


class SetOwnerByEmailRequest(BaseModel):
    """Request to set a user as owner by email."""
    email: EmailStr


class SetOwnerByEmailResponse(BaseModel):
    """Response after setting a user as owner."""
    user_id: UUID
    email: str
    name: str
    organization_id: UUID
    organization_name: str
    old_role: str
    new_role: str


@router.post("/set-owner-by-email", response_model=SetOwnerByEmailResponse)
async def set_owner_by_email(
    request: SetOwnerByEmailRequest,
    db: AsyncSession = Depends(get_db),
):
    """Set a user as owner by their email address.

    This is an admin-only endpoint for setting ownership across organizations.
    Finds a user by email and updates their role to 'owner'.
    """
    # Find user by email (case-insensitive)
    result = await db.execute(
        select(User).where(func.lower(User.email) == request.email.lower())
    )
    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(
            status_code=404,
            detail=f"No user found with email '{request.email}'"
        )

    # Get organization
    org_result = await db.execute(
        select(Organization).where(Organization.id == user.organization_id)
    )
    org = org_result.scalar_one_or_none()
    org_name = org.name if org else "Unknown"

    old_role = user.role

    if old_role == "owner":
        return SetOwnerByEmailResponse(
            user_id=user.id,
            email=user.email,
            name=user.name,
            organization_id=user.organization_id,
            organization_name=org_name,
            old_role=old_role,
            new_role="owner"
        )

    user.role = "owner"
    await db.commit()

    return SetOwnerByEmailResponse(
        user_id=user.id,
        email=user.email,
        name=user.name,
        organization_id=user.organization_id,
        organization_name=org_name,
        old_role=old_role,
        new_role="owner"
    )
