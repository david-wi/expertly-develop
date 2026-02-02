"""API dependencies for authentication and authorization using Identity service."""

from typing import Annotated, Optional

from fastapi import Depends, HTTPException, status, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.database import get_db
from app.models import User, Project, Organization
from app.config import get_settings

# Import from shared identity-client package
from identity_client import IdentityClient, IdentityAuth
from identity_client.models import User as IdentityUser

settings = get_settings()

# Identity service client (singleton)
_identity_client: Optional[IdentityClient] = None
_identity_auth: Optional[IdentityAuth] = None


def get_identity_client() -> IdentityClient:
    """Get or create Identity client."""
    global _identity_client
    if _identity_client is None:
        _identity_client = IdentityClient(base_url=settings.identity_api_url)
    return _identity_client


def get_identity_auth() -> IdentityAuth:
    """Get or create Identity auth middleware."""
    global _identity_auth
    if _identity_auth is None:
        _identity_auth = IdentityAuth(
            identity_url=settings.identity_api_url,
            client=get_identity_client(),
        )
    return _identity_auth


async def get_current_user(
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> User:
    """Get the current authenticated user from Identity session.

    Raises HTTPException 401 if not authenticated.
    """
    auth = get_identity_auth()
    identity_user = await auth.get_current_user(request)

    # Look up local user by email
    stmt = select(User).where(
        User.email == identity_user.email,
        User.deleted_at.is_(None)
    )
    result = await db.execute(stmt)
    user = result.scalar_one_or_none()

    if user:
        if not user.is_active:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="User account is disabled",
            )
        return user

    # If no local user exists, create one linked to this Identity user
    # First, ensure the organization exists
    org_stmt = select(Organization).where(Organization.id == identity_user.organization_id)
    org_result = await db.execute(org_stmt)
    org = org_result.scalar_one_or_none()

    if not org:
        # Create organization from Identity
        org = Organization(
            id=identity_user.organization_id,
            name=identity_user.organization_name or "Default Organization",
            slug=identity_user.organization_id[:8],  # Use first 8 chars of UUID as slug
            is_active=True,
        )
        db.add(org)

    # Create local shadow user linked to Identity
    user = User(
        id=identity_user.id,
        organization_id=identity_user.organization_id,
        email=identity_user.email,
        full_name=identity_user.name,
        role=identity_user.role,
        is_active=identity_user.is_active,
        is_verified=True,  # Identity users are already verified
    )
    db.add(user)
    await db.flush()
    await db.refresh(user)

    return user


async def get_optional_user(
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> Optional[User]:
    """Get the current user if authenticated, None otherwise.

    For endpoints that work with or without authentication.
    """
    auth = get_identity_auth()
    identity_user = await auth.get_current_user_optional(request)

    if not identity_user:
        return None

    # Look up local user by email
    stmt = select(User).where(
        User.email == identity_user.email,
        User.deleted_at.is_(None),
        User.is_active == True
    )
    result = await db.execute(stmt)
    user = result.scalar_one_or_none()

    return user


def require_role(*allowed_roles: str):
    """Dependency factory for role-based access control.

    Usage:
        @router.post("/admin-action")
        async def admin_action(user: User = Depends(require_role("owner", "admin"))):
            ...
    """
    async def role_checker(
        request: Request,
        db: AsyncSession = Depends(get_db),
    ) -> User:
        current_user = await get_current_user(request, db)
        if current_user.role not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Insufficient permissions. Required role: {', '.join(allowed_roles)}",
            )
        return current_user

    return role_checker


async def get_project_with_access(
    project_id: str,
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> Project:
    """Get a project and verify the user has access to it.

    The project must belong to the user's organization.
    """
    current_user = await get_current_user(request, db)

    stmt = select(Project).where(
        Project.id == project_id,
        Project.organization_id == current_user.organization_id,
        Project.deleted_at.is_(None)
    )
    result = await db.execute(stmt)
    project = result.scalar_one_or_none()

    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found",
        )

    return project


# Type aliases for cleaner dependency injection
CurrentUser = Annotated[User, Depends(get_current_user)]
OptionalUser = Annotated[Optional[User], Depends(get_optional_user)]
