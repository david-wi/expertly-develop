"""Organization management API endpoints."""

import secrets
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from passlib.hash import bcrypt

from app.database import get_db
from app.models import Organization, User
from app.schemas.organization import (
    OrganizationCreate,
    OrganizationUpdate,
    OrganizationResponse,
    OrganizationListResponse,
)

router = APIRouter()


@router.get("", response_model=OrganizationListResponse)
async def list_organizations(
    limit: int = 100,
    offset: int = 0,
    db: AsyncSession = Depends(get_db),
):
    """List all organizations."""
    query = select(Organization).order_by(Organization.name).offset(offset).limit(limit)
    result = await db.execute(query)
    orgs = result.scalars().all()

    count_query = select(func.count(Organization.id))
    total = (await db.execute(count_query)).scalar()

    return OrganizationListResponse(items=orgs, total=total)


@router.post("", response_model=OrganizationResponse, status_code=status.HTTP_201_CREATED)
async def create_organization(
    org_data: OrganizationCreate,
    db: AsyncSession = Depends(get_db),
):
    """Create a new organization with a default owner user."""
    # Check if slug already exists
    existing = await db.execute(
        select(Organization).where(Organization.slug == org_data.slug)
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Organization slug already exists")

    org = Organization(
        name=org_data.name,
        slug=org_data.slug,
    )

    db.add(org)
    await db.flush()

    # Create default owner user
    api_key = secrets.token_urlsafe(32)
    default_user = User(
        organization_id=org.id,
        name="Owner",
        email=f"owner@{org_data.slug}.local",
        user_type="human",
        role="owner",
        is_default=True,
        api_key_hash=bcrypt.hash(api_key),
    )
    db.add(default_user)

    await db.commit()
    await db.refresh(org)

    return org


@router.get("/{org_id}", response_model=OrganizationResponse)
async def get_organization(
    org_id: UUID,
    db: AsyncSession = Depends(get_db),
):
    """Get an organization by ID."""
    result = await db.execute(select(Organization).where(Organization.id == org_id))
    org = result.scalar_one_or_none()

    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")

    return org


@router.patch("/{org_id}", response_model=OrganizationResponse)
async def update_organization(
    org_id: UUID,
    org_data: OrganizationUpdate,
    db: AsyncSession = Depends(get_db),
):
    """Update an organization."""
    result = await db.execute(select(Organization).where(Organization.id == org_id))
    org = result.scalar_one_or_none()

    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")

    update_data = org_data.model_dump(exclude_unset=True)

    # Check slug uniqueness if being changed
    if "slug" in update_data and update_data["slug"] != org.slug:
        existing = await db.execute(
            select(Organization).where(Organization.slug == update_data["slug"])
        )
        if existing.scalar_one_or_none():
            raise HTTPException(status_code=400, detail="Organization slug already exists")

    for field, value in update_data.items():
        setattr(org, field, value)

    await db.commit()
    await db.refresh(org)

    return org


@router.delete("/{org_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_organization(
    org_id: UUID,
    db: AsyncSession = Depends(get_db),
):
    """Delete an organization and all its data."""
    result = await db.execute(select(Organization).where(Organization.id == org_id))
    org = result.scalar_one_or_none()

    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")

    await db.delete(org)
    await db.commit()
