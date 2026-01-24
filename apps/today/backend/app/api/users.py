"""User management API endpoints."""

from uuid import UUID
from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, EmailStr, Field

from app.api.deps import get_context, CurrentContext
from app.models.user import User
from app.models.base import generate_api_key
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

router = APIRouter()


class UserCreate(BaseModel):
    """Schema for creating a new user."""
    email: EmailStr
    name: str = Field(..., min_length=1, max_length=255)
    role: str = Field(default="member", pattern="^(admin|member|viewer)$")
    timezone: str = Field(default="UTC", max_length=50)


class UserUpdate(BaseModel):
    """Schema for updating a user."""
    name: str | None = Field(None, min_length=1, max_length=255)
    role: str | None = Field(None, pattern="^(admin|member|viewer)$")
    timezone: str | None = Field(None, max_length=50)
    settings: dict | None = None


class UserResponse(BaseModel):
    """Schema for user response."""
    id: UUID
    tenant_id: UUID
    email: str
    name: str | None
    role: str
    timezone: str
    settings: dict
    created_at: str
    updated_at: str

    class Config:
        from_attributes = True


class UserWithApiKey(UserResponse):
    """User response including API key (only returned on creation)."""
    api_key: str


def require_admin(ctx: CurrentContext = Depends(get_context)) -> CurrentContext:
    """Dependency that requires admin role."""
    if ctx.user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required"
        )
    return ctx


@router.get("", response_model=List[UserResponse])
async def list_users(
    ctx: CurrentContext = Depends(get_context),
):
    """List all users in the organization."""
    result = await ctx.db.execute(
        select(User).where(User.tenant_id == ctx.tenant.id).order_by(User.created_at)
    )
    users = result.scalars().all()
    return [UserResponse.model_validate(u) for u in users]


@router.post("", response_model=UserWithApiKey, status_code=status.HTTP_201_CREATED)
async def create_user(
    data: UserCreate,
    ctx: CurrentContext = Depends(require_admin),
):
    """Create a new user (admin only)."""
    # Check if email already exists in tenant
    result = await ctx.db.execute(
        select(User).where(
            User.tenant_id == ctx.tenant.id,
            User.email == data.email
        )
    )
    if result.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User with this email already exists in the organization"
        )

    # Create user with new API key
    user = User(
        tenant_id=ctx.tenant.id,
        email=data.email,
        name=data.name,
        role=data.role,
        timezone=data.timezone,
        api_key=generate_api_key(),
    )
    ctx.db.add(user)
    await ctx.db.flush()
    await ctx.db.refresh(user)

    return UserWithApiKey.model_validate(user)


@router.get("/me", response_model=UserResponse)
async def get_current_user(
    ctx: CurrentContext = Depends(get_context),
):
    """Get the current authenticated user."""
    return UserResponse.model_validate(ctx.user)


@router.get("/{user_id}", response_model=UserResponse)
async def get_user(
    user_id: UUID,
    ctx: CurrentContext = Depends(get_context),
):
    """Get a user by ID."""
    result = await ctx.db.execute(
        select(User).where(
            User.id == user_id,
            User.tenant_id == ctx.tenant.id
        )
    )
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return UserResponse.model_validate(user)


@router.put("/{user_id}", response_model=UserResponse)
async def update_user(
    user_id: UUID,
    data: UserUpdate,
    ctx: CurrentContext = Depends(get_context),
):
    """Update a user. Users can update themselves, admins can update anyone."""
    result = await ctx.db.execute(
        select(User).where(
            User.id == user_id,
            User.tenant_id == ctx.tenant.id
        )
    )
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # Only admins can update other users or change roles
    if ctx.user.id != user_id:
        if ctx.user.role != "admin":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Cannot update other users"
            )

    if data.role is not None and ctx.user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admins can change user roles"
        )

    # Update fields
    if data.name is not None:
        user.name = data.name
    if data.role is not None:
        user.role = data.role
    if data.timezone is not None:
        user.timezone = data.timezone
    if data.settings is not None:
        user.settings = {**user.settings, **data.settings}

    await ctx.db.flush()
    await ctx.db.refresh(user)

    return UserResponse.model_validate(user)


@router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_user(
    user_id: UUID,
    ctx: CurrentContext = Depends(require_admin),
):
    """Delete a user (admin only). Cannot delete yourself."""
    if ctx.user.id == user_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot delete yourself"
        )

    result = await ctx.db.execute(
        select(User).where(
            User.id == user_id,
            User.tenant_id == ctx.tenant.id
        )
    )
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    await ctx.db.delete(user)
    await ctx.db.flush()


@router.post("/{user_id}/regenerate-api-key", response_model=UserWithApiKey)
async def regenerate_api_key(
    user_id: UUID,
    ctx: CurrentContext = Depends(get_context),
):
    """Regenerate API key for a user. Users can regenerate their own, admins can regenerate any."""
    result = await ctx.db.execute(
        select(User).where(
            User.id == user_id,
            User.tenant_id == ctx.tenant.id
        )
    )
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # Only admins can regenerate other users' keys
    if ctx.user.id != user_id and ctx.user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Cannot regenerate API key for other users"
        )

    user.api_key = generate_api_key()
    await ctx.db.flush()
    await ctx.db.refresh(user)

    return UserWithApiKey.model_validate(user)
