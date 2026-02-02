"""Authentication utilities using Identity service.

All user and organization (tenant) data comes from Identity service.
No local user/tenant tables are maintained.
"""

from typing import Optional
from fastapi import Depends, HTTPException, Security, status, Request
from fastapi.security import APIKeyHeader
from sqlalchemy.ext.asyncio import AsyncSession
from uuid import UUID

from app.database import get_db
from app.config import get_settings

# Import from shared identity-client package
from identity_client import IdentityClient, IdentityAuth
from identity_client.models import User as IdentityUser

# API Key header (for backward compatibility with API-based access)
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
) -> IdentityUser:
    """
    Get current user from Identity session.

    Returns IdentityUser directly - no local user table.
    API key authentication is no longer supported (use Identity sessions).
    """
    auth = get_identity_auth()
    identity_user = await auth.get_current_user_optional(request)

    if identity_user:
        return identity_user

    # API key support removed - all auth via Identity
    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Authentication required. Please log in via Identity service.",
        headers={"WWW-Authenticate": "Session"},
    )


async def get_current_user_optional(
    request: Request,
) -> Optional[IdentityUser]:
    """Get current user if authenticated, None otherwise."""
    auth = get_identity_auth()
    return await auth.get_current_user_optional(request)


def require_role(*roles: str):
    """Dependency factory that requires specific roles."""
    async def role_checker(request: Request) -> IdentityUser:
        user = await get_current_user(request)
        mapped_role = _map_identity_role(user.role)
        if mapped_role not in roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Required role: {', '.join(roles)}",
            )
        return user
    return role_checker


# Helper to get tenant_id (organization_id) as UUID
def get_tenant_id(user: IdentityUser) -> UUID:
    """Extract tenant_id (organization_id) from Identity user as UUID."""
    return UUID(user.organization_id)


# Helper to get user_id as UUID
def get_user_id(user: IdentityUser) -> UUID:
    """Extract user_id from Identity user as UUID."""
    return UUID(user.id)
