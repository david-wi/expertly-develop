"""Organization membership management API endpoints."""

from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload

from app.database import get_db
from app.models import Organization, User, OrganizationMembership
from app.schemas.membership import (
    AddMemberRequest,
    UpdateMemberRequest,
    MemberResponse,
    MemberListResponse,
    UserOrganizationResponse,
    UserOrganizationsListResponse,
)

router = APIRouter()


def _membership_to_response(membership: OrganizationMembership) -> MemberResponse:
    """Convert membership model to response."""
    user = membership.user
    return MemberResponse(
        id=membership.id,
        user_id=membership.user_id,
        organization_id=membership.organization_id,
        role=membership.role,
        is_primary=membership.is_primary or False,
        joined_at=membership.joined_at,
        user_name=user.name if user else "Unknown",
        user_email=user.email if user else None,
        user_avatar_url=user.avatar_url if user else None,
        user_type=user.user_type if user else "human",
    )


@router.get("/{org_id}/members", response_model=MemberListResponse)
async def list_organization_members(
    org_id: UUID,
    limit: int = 100,
    offset: int = 0,
    db: AsyncSession = Depends(get_db),
):
    """
    List all members of an organization.

    Returns users who have membership records for this organization.
    """
    # Verify org exists
    org_result = await db.execute(select(Organization).where(Organization.id == org_id))
    org = org_result.scalar_one_or_none()
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")

    # Get memberships with user data
    query = (
        select(OrganizationMembership)
        .options(joinedload(OrganizationMembership.user))
        .where(OrganizationMembership.organization_id == org_id)
        .order_by(OrganizationMembership.joined_at.desc())
        .offset(offset)
        .limit(limit)
    )
    result = await db.execute(query)
    memberships = result.scalars().all()

    # Get total count
    count_query = select(func.count(OrganizationMembership.id)).where(
        OrganizationMembership.organization_id == org_id
    )
    total = (await db.execute(count_query)).scalar()

    return MemberListResponse(
        items=[_membership_to_response(m) for m in memberships],
        total=total,
    )


@router.post("/{org_id}/members", response_model=MemberResponse, status_code=status.HTTP_201_CREATED)
async def add_organization_member(
    org_id: UUID,
    request: AddMemberRequest,
    db: AsyncSession = Depends(get_db),
):
    """
    Add a user to an organization.

    Can specify either user_id or email to identify the user.
    The user must already exist in the system.
    """
    # Verify org exists
    org_result = await db.execute(select(Organization).where(Organization.id == org_id))
    org = org_result.scalar_one_or_none()
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")

    # Find the user
    if request.user_id:
        user_query = select(User).where(User.id == request.user_id)
    elif request.email:
        user_query = select(User).where(func.lower(User.email) == request.email.lower())
    else:
        raise HTTPException(status_code=400, detail="Must provide either user_id or email")

    user_result = await db.execute(user_query)
    user = user_result.scalar_one_or_none()

    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # Check if membership already exists
    existing_query = select(OrganizationMembership).where(
        OrganizationMembership.user_id == user.id,
        OrganizationMembership.organization_id == org_id,
    )
    existing_result = await db.execute(existing_query)
    if existing_result.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="User is already a member of this organization")

    # Create membership
    membership = OrganizationMembership(
        user_id=user.id,
        organization_id=org_id,
        role=request.role,
        is_primary=request.is_primary,
    )
    db.add(membership)
    await db.commit()

    # Refresh with user data
    await db.refresh(membership)
    membership_query = (
        select(OrganizationMembership)
        .options(joinedload(OrganizationMembership.user))
        .where(OrganizationMembership.id == membership.id)
    )
    result = await db.execute(membership_query)
    membership = result.scalar_one()

    return _membership_to_response(membership)


@router.patch("/{org_id}/members/{user_id}", response_model=MemberResponse)
async def update_organization_member(
    org_id: UUID,
    user_id: UUID,
    request: UpdateMemberRequest,
    db: AsyncSession = Depends(get_db),
):
    """Update a user's membership in an organization."""
    # Find the membership
    query = (
        select(OrganizationMembership)
        .options(joinedload(OrganizationMembership.user))
        .where(
            OrganizationMembership.organization_id == org_id,
            OrganizationMembership.user_id == user_id,
        )
    )
    result = await db.execute(query)
    membership = result.scalar_one_or_none()

    if not membership:
        raise HTTPException(status_code=404, detail="Membership not found")

    # Update fields
    if request.role is not None:
        membership.role = request.role
    if request.is_primary is not None:
        membership.is_primary = request.is_primary

    await db.commit()
    await db.refresh(membership)

    return _membership_to_response(membership)


@router.delete("/{org_id}/members/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_organization_member(
    org_id: UUID,
    user_id: UUID,
    db: AsyncSession = Depends(get_db),
):
    """Remove a user from an organization."""
    # Find the membership
    query = select(OrganizationMembership).where(
        OrganizationMembership.organization_id == org_id,
        OrganizationMembership.user_id == user_id,
    )
    result = await db.execute(query)
    membership = result.scalar_one_or_none()

    if not membership:
        raise HTTPException(status_code=404, detail="Membership not found")

    await db.delete(membership)
    await db.commit()


@router.get("/users/{user_id}/organizations", response_model=UserOrganizationsListResponse)
async def list_user_organizations(
    user_id: UUID,
    db: AsyncSession = Depends(get_db),
):
    """
    List all organizations a user belongs to.

    Returns organizations where the user has an explicit membership.
    Does not include the user's primary organization unless there's a membership record.
    """
    # Verify user exists
    user_result = await db.execute(select(User).where(User.id == user_id))
    user = user_result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # Get memberships with organization data
    query = (
        select(OrganizationMembership)
        .options(joinedload(OrganizationMembership.organization))
        .where(OrganizationMembership.user_id == user_id)
        .order_by(OrganizationMembership.joined_at.desc())
    )
    result = await db.execute(query)
    memberships = result.scalars().all()

    items = []
    for m in memberships:
        org = m.organization
        if org:
            items.append(UserOrganizationResponse(
                id=m.id,
                organization_id=org.id,
                organization_name=org.name,
                organization_slug=org.slug,
                role=m.role,
                is_primary=m.is_primary or False,
                joined_at=m.joined_at,
            ))

    return UserOrganizationsListResponse(items=items, total=len(items))
