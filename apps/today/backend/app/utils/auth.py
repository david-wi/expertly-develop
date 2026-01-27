"""Authentication utilities using Identity service."""

from typing import Optional
from fastapi import Depends, HTTPException, Security, status, Request
from fastapi.security import APIKeyHeader
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.database import get_db
from app.models import User, Tenant
from app.config import get_settings

# Import from shared identity-client package
from identity_client import IdentityClient, IdentityAuth
from identity_client.models import User as IdentityUser

# API Key header (for backward compatibility)
api_key_header = APIKeyHeader(name="X-API-Key", auto_error=False)

# Identity service client (singleton)
_identity_client: Optional[IdentityClient] = None
_identity_auth: Optional[IdentityAuth] = None


def get_identity_client() -> IdentityClient:
    """Get or create Identity client."""
    global _identity_client
    settings = get_settings()
    if _identity_client is None:
        _identity_client = IdentityClient(base_url=settings.identity_api_url)
    return _identity_client


def get_identity_auth() -> IdentityAuth:
    """Get or create Identity auth middleware."""
    global _identity_auth
    settings = get_settings()
    if _identity_auth is None:
        _identity_auth = IdentityAuth(
            identity_url=settings.identity_api_url,
            client=get_identity_client(),
        )
    return _identity_auth


def _map_identity_role(identity_role: str) -> str:
    """Map Identity service role to today role."""
    role_mapping = {
        "owner": "admin",
        "admin": "admin",
        "member": "member",
        "viewer": "viewer",
    }
    return role_mapping.get(identity_role, "member")


async def get_current_user(
    request: Request,
    api_key: Optional[str] = Security(api_key_header),
    db: AsyncSession = Depends(get_db),
) -> User:
    """
    Get current user from Identity session or API key.

    Authentication priority:
    1. Identity session cookie (X-Session-Token header or expertly_session cookie)
    2. API key (X-API-Key header)
    """
    # Try Identity session first
    auth = get_identity_auth()
    identity_user = await auth.get_current_user_optional(request)

    if identity_user:
        # Look up local user by email
        result = await db.execute(
            select(User).where(User.email == identity_user.email)
        )
        user = result.scalar_one_or_none()

        if user:
            return user

        # If no local user found, create one based on Identity user
        # First, ensure the tenant exists
        result = await db.execute(
            select(Tenant).where(Tenant.id == identity_user.organization_id)
        )
        tenant = result.scalar_one_or_none()

        if not tenant:
            # Create tenant from Identity org
            tenant = Tenant(
                id=identity_user.organization_id,
                name=identity_user.organization_name or "Default Tenant",
                slug=identity_user.organization_id[:8],
            )
            db.add(tenant)

        # Create local user linked to Identity
        user = User(
            id=identity_user.id,
            tenant_id=identity_user.organization_id,
            email=identity_user.email,
            name=identity_user.name,
            role=_map_identity_role(identity_user.role),
        )
        db.add(user)
        await db.commit()
        await db.refresh(user)

        return user

    # Fall back to API key authentication
    if api_key:
        result = await db.execute(
            select(User).where(User.api_key == api_key)
        )
        user = result.scalar_one_or_none()

        if user:
            return user

        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid API key",
            headers={"WWW-Authenticate": "ApiKey"},
        )

    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Authentication required. Provide session cookie or X-API-Key header.",
        headers={"WWW-Authenticate": "Session"},
    )


async def get_current_tenant(
    request: Request,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Tenant:
    """
    Get current tenant from authenticated user.
    """
    result = await db.execute(
        select(Tenant).where(Tenant.id == user.tenant_id)
    )
    tenant = result.scalar_one_or_none()

    if not tenant:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Tenant not found for user",
        )

    return tenant


def require_role(*roles: str):
    """Dependency factory that requires specific roles."""
    async def role_checker(
        request: Request,
        db: AsyncSession = Depends(get_db),
    ) -> User:
        user = await get_current_user(request, db=db)
        if user.role not in roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Required role: {', '.join(roles)}",
            )
        return user
    return role_checker
