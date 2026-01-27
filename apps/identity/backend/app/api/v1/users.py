"""User management API endpoints."""

import secrets
from typing import Optional
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, Header, status
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from passlib.hash import bcrypt

from app.database import get_db
from app.models import User, Organization
from app.schemas.user import (
    UserCreate,
    UserUpdate,
    UserResponse,
    UserListResponse,
    UserCreateResponse,
)

router = APIRouter()


async def get_organization(
    x_organization_id: str = Header(..., alias="X-Organization-Id"),
    db: AsyncSession = Depends(get_db),
) -> Organization:
    """Get organization from header."""
    try:
        org_id = UUID(x_organization_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid organization ID")

    result = await db.execute(select(Organization).where(Organization.id == org_id))
    org = result.scalar_one_or_none()

    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")

    return org


@router.get("", response_model=UserListResponse)
async def list_users(
    user_type: Optional[str] = None,
    is_active: Optional[bool] = None,
    limit: int = 100,
    offset: int = 0,
    org: Organization = Depends(get_organization),
    db: AsyncSession = Depends(get_db),
):
    """List users in the organization."""
    query = select(User).where(User.organization_id == org.id)

    if user_type:
        query = query.where(User.user_type == user_type)
    if is_active is not None:
        query = query.where(User.is_active == is_active)

    query = query.order_by(User.created_at.desc()).offset(offset).limit(limit)
    result = await db.execute(query)
    users = result.scalars().all()

    # Get total count
    count_query = select(func.count(User.id)).where(User.organization_id == org.id)
    if user_type:
        count_query = count_query.where(User.user_type == user_type)
    if is_active is not None:
        count_query = count_query.where(User.is_active == is_active)
    total = (await db.execute(count_query)).scalar()

    return UserListResponse(items=users, total=total)


@router.post("", response_model=UserCreateResponse, status_code=status.HTTP_201_CREATED)
async def create_user(
    user_data: UserCreate,
    org: Organization = Depends(get_organization),
    db: AsyncSession = Depends(get_db),
):
    """Create a new user or bot."""
    # Check for duplicate email in organization
    if user_data.email:
        existing = await db.execute(
            select(User).where(
                User.organization_id == org.id,
                func.lower(User.email) == user_data.email.lower()
            )
        )
        if existing.scalar_one_or_none():
            raise HTTPException(
                status_code=400,
                detail="A user with this email already exists in the organization"
            )

    # Generate API key
    api_key = secrets.token_urlsafe(32)
    api_key_hash = bcrypt.hash(api_key)

    user = User(
        organization_id=org.id,
        name=user_data.name,
        email=user_data.email,
        user_type=user_data.user_type,
        role=user_data.role,
        avatar_url=user_data.avatar_url,
        title=user_data.title,
        responsibilities=user_data.responsibilities,
        bot_config=user_data.bot_config.model_dump() if user_data.bot_config else None,
        api_key_hash=api_key_hash,
    )

    db.add(user)
    await db.commit()
    await db.refresh(user)

    return UserCreateResponse(user=user, api_key=api_key)


@router.get("/{user_id}", response_model=UserResponse)
async def get_user(
    user_id: UUID,
    org: Organization = Depends(get_organization),
    db: AsyncSession = Depends(get_db),
):
    """Get a user by ID."""
    result = await db.execute(
        select(User).where(User.id == user_id, User.organization_id == org.id)
    )
    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    return user


@router.patch("/{user_id}", response_model=UserResponse)
async def update_user(
    user_id: UUID,
    user_data: UserUpdate,
    org: Organization = Depends(get_organization),
    db: AsyncSession = Depends(get_db),
):
    """Update a user."""
    result = await db.execute(
        select(User).where(User.id == user_id, User.organization_id == org.id)
    )
    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # Check for duplicate email if email is being changed
    if user_data.email and user_data.email.lower() != (user.email or "").lower():
        existing = await db.execute(
            select(User).where(
                User.organization_id == org.id,
                func.lower(User.email) == user_data.email.lower(),
                User.id != user_id
            )
        )
        if existing.scalar_one_or_none():
            raise HTTPException(
                status_code=400,
                detail="A user with this email already exists in the organization"
            )

    update_data = user_data.model_dump(exclude_unset=True)
    if "bot_config" in update_data and update_data["bot_config"]:
        update_data["bot_config"] = update_data["bot_config"]

    for field, value in update_data.items():
        setattr(user, field, value)

    await db.commit()
    await db.refresh(user)

    return user


@router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_user(
    user_id: UUID,
    org: Organization = Depends(get_organization),
    db: AsyncSession = Depends(get_db),
):
    """Delete a user."""
    result = await db.execute(
        select(User).where(User.id == user_id, User.organization_id == org.id)
    )
    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if user.is_default:
        raise HTTPException(status_code=400, detail="Cannot delete default user")

    await db.delete(user)
    await db.commit()


@router.post("/{user_id}/regenerate-api-key")
async def regenerate_api_key(
    user_id: UUID,
    org: Organization = Depends(get_organization),
    db: AsyncSession = Depends(get_db),
):
    """Regenerate a user's API key."""
    result = await db.execute(
        select(User).where(User.id == user_id, User.organization_id == org.id)
    )
    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    api_key = secrets.token_urlsafe(32)
    user.api_key_hash = bcrypt.hash(api_key)

    await db.commit()

    return {"api_key": api_key}
