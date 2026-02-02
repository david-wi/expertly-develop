"""User management API endpoints - proxies to Identity service."""

from uuid import UUID
from typing import List

from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel, EmailStr, Field

from app.api.deps import get_context, CurrentContext
from app.utils.auth import get_identity_client

# Import identity client
from identity_client import IdentityClient
from identity_client.client import IdentityClientError

router = APIRouter()


class UserCreate(BaseModel):
    """Schema for creating a new user."""
    email: EmailStr
    name: str = Field(..., min_length=1, max_length=255)
    role: str = Field(default="member", pattern="^(admin|member|viewer)$")


class UserUpdate(BaseModel):
    """Schema for updating a user."""
    name: str | None = Field(None, min_length=1, max_length=255)
    role: str | None = Field(None, pattern="^(admin|member|viewer)$")


class UserResponse(BaseModel):
    """Schema for user response."""
    id: str
    organization_id: str
    email: str | None
    name: str
    role: str
    is_active: bool = True
    created_at: str | None = None

    class Config:
        from_attributes = True


def _get_session_token(request: Request) -> str:
    """Extract session token from request."""
    token = request.cookies.get("expertly_session")
    if not token:
        token = request.headers.get("X-Session-Token")
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Session token required"
        )
    return token


def _map_role_to_identity(role: str) -> str:
    """Map Today role to Identity role."""
    mapping = {
        "admin": "admin",
        "member": "member",
        "viewer": "viewer",
    }
    return mapping.get(role, "member")


def _map_role_from_identity(role: str) -> str:
    """Map Identity role to Today role."""
    mapping = {
        "owner": "admin",
        "admin": "admin",
        "member": "member",
        "viewer": "viewer",
    }
    return mapping.get(role, "member")


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
    request: Request,
    ctx: CurrentContext = Depends(get_context),
):
    """List all users in the organization (fetched from Identity service)."""
    token = _get_session_token(request)
    client = get_identity_client()

    try:
        result = await client.list_users(
            session_token=token,
            organization_id=str(ctx.tenant.id),
        )
        return [
            UserResponse(
                id=str(u.id),
                organization_id=str(u.organization_id),
                email=u.email,
                name=u.name,
                role=_map_role_from_identity(u.role),
                is_active=u.is_active,
            )
            for u in result.items
        ]
    except IdentityClientError as e:
        raise HTTPException(
            status_code=e.status_code or 500,
            detail=str(e.message)
        )


@router.post("", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def create_user(
    request: Request,
    data: UserCreate,
    ctx: CurrentContext = Depends(require_admin),
):
    """Create a new user (admin only) - creates in Identity service."""
    token = _get_session_token(request)
    client = get_identity_client()

    try:
        user = await client.create_user(
            session_token=token,
            organization_id=str(ctx.tenant.id),
            name=data.name,
            email=data.email,
            role=_map_role_to_identity(data.role),
            user_type="human",
        )
        return UserResponse(
            id=str(user.id),
            organization_id=str(user.organization_id),
            email=user.email,
            name=user.name,
            role=_map_role_from_identity(user.role),
            is_active=user.is_active,
        )
    except IdentityClientError as e:
        if e.status_code == 400:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=str(e.message)
            )
        raise HTTPException(
            status_code=e.status_code or 500,
            detail=str(e.message)
        )


@router.get("/me", response_model=UserResponse)
async def get_current_user(
    ctx: CurrentContext = Depends(get_context),
):
    """Get the current authenticated user."""
    return UserResponse(
        id=str(ctx.user.id),
        organization_id=str(ctx.tenant.id),
        email=ctx.user.email,
        name=ctx.user.name or "",
        role=ctx.user.role,
        is_active=True,
    )


@router.get("/{user_id}", response_model=UserResponse)
async def get_user(
    user_id: UUID,
    request: Request,
    ctx: CurrentContext = Depends(get_context),
):
    """Get a user by ID from Identity service."""
    token = _get_session_token(request)
    client = get_identity_client()

    try:
        user = await client.get_user(
            user_id=str(user_id),
            session_token=token,
        )
        # Verify user belongs to same organization
        if str(user.organization_id) != str(ctx.tenant.id):
            raise HTTPException(status_code=404, detail="User not found")

        return UserResponse(
            id=str(user.id),
            organization_id=str(user.organization_id),
            email=user.email,
            name=user.name,
            role=_map_role_from_identity(user.role),
            is_active=user.is_active,
        )
    except IdentityClientError as e:
        if e.status_code == 404:
            raise HTTPException(status_code=404, detail="User not found")
        raise HTTPException(
            status_code=e.status_code or 500,
            detail=str(e.message)
        )


@router.put("/{user_id}", response_model=UserResponse)
async def update_user(
    user_id: UUID,
    request: Request,
    data: UserUpdate,
    ctx: CurrentContext = Depends(get_context),
):
    """Update a user in Identity service. Users can update themselves, admins can update anyone."""
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

    token = _get_session_token(request)
    client = get_identity_client()

    try:
        user = await client.update_user(
            user_id=str(user_id),
            session_token=token,
            organization_id=str(ctx.tenant.id),
            name=data.name,
            role=_map_role_to_identity(data.role) if data.role else None,
        )
        return UserResponse(
            id=str(user.id),
            organization_id=str(user.organization_id),
            email=user.email,
            name=user.name,
            role=_map_role_from_identity(user.role),
            is_active=user.is_active,
        )
    except IdentityClientError as e:
        if e.status_code == 404:
            raise HTTPException(status_code=404, detail="User not found")
        raise HTTPException(
            status_code=e.status_code or 500,
            detail=str(e.message)
        )


@router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_user(
    user_id: UUID,
    request: Request,
    ctx: CurrentContext = Depends(require_admin),
):
    """Delete a user from Identity service (admin only). Cannot delete yourself."""
    if ctx.user.id == user_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot delete yourself"
        )

    token = _get_session_token(request)
    client = get_identity_client()

    try:
        await client.delete_user(
            user_id=str(user_id),
            session_token=token,
            organization_id=str(ctx.tenant.id),
        )
    except IdentityClientError as e:
        if e.status_code == 404:
            raise HTTPException(status_code=404, detail="User not found")
        raise HTTPException(
            status_code=e.status_code or 500,
            detail=str(e.message)
        )
