"""API dependencies for authentication and context.

Authentication is handled by Identity service. This module provides:
- Identity session validation
- API key fallback for programmatic access
- User context for request handling
"""

from typing import Optional
from fastapi import Depends, HTTPException, Header, Request, status
from pydantic import BaseModel

from app.database import get_database
from app.config import get_settings

# Import from shared identity-client package
from identity_client import IdentityClient, IdentityAuth
from identity_client.models import User as IdentityUser

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
    """Map Identity service role to develop role."""
    role_mapping = {
        "owner": "admin",
        "admin": "admin",
        "member": "user",
        "viewer": "user",
    }
    return role_mapping.get(identity_role, "user")


class UserContext(BaseModel):
    """Current user context with Identity-based IDs."""

    user_id: str  # Identity user UUID
    organization_id: str  # Identity organization UUID
    email: str
    name: str
    role: str


async def get_current_user(request: Request) -> IdentityUser:
    """
    Get the current authenticated user from Identity service.

    Returns the IdentityUser directly for full access to Identity data.
    """
    auth = get_identity_auth()
    identity_user = await auth.get_current_user(request)

    if not identity_user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User account is disabled",
        )

    return identity_user


async def get_current_user_optional(request: Request) -> Optional[IdentityUser]:
    """Get current user if authenticated, None otherwise."""
    auth = get_identity_auth()
    return await auth.get_current_user_optional(request)


async def get_user_context(
    request: Request,
    x_api_key: Optional[str] = Header(None, alias="X-API-Key"),
    x_organization_id: Optional[str] = Header(None, alias="X-Organization-Id"),
) -> UserContext:
    """
    Get the current user context for request handling.

    Authentication priority:
    1. Identity session cookie (X-Session-Token header or expertly_session cookie)
    2. API key (X-API-Key header)

    Supports organization switching via X-Organization-Id header for admin users.
    """
    db = get_database()

    # Try Identity session first
    auth = get_identity_auth()
    identity_user = await auth.get_current_user_optional(request)

    if identity_user:
        if not identity_user.is_active:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="User account is disabled",
            )

        organization_id = identity_user.organization_id

        # Allow admin users to switch organizations via X-Organization-Id header
        if x_organization_id and identity_user.role in ("owner", "admin"):
            organization_id = x_organization_id

        return UserContext(
            user_id=identity_user.id,
            organization_id=organization_id,
            email=identity_user.email,
            name=identity_user.name or identity_user.email,
            role=_map_identity_role(identity_user.role),
        )

    # Fall back to API key authentication
    if x_api_key:
        api_key_doc = await db.api_keys.find_one({"key": x_api_key, "is_active": True})
        if not api_key_doc:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid API key",
            )

        return UserContext(
            user_id=api_key_doc.get("user_id", "api-key-user"),
            organization_id=api_key_doc["organization_id"],
            email=api_key_doc.get("email", "api@develop.local"),
            name=api_key_doc.get("name", "API Key User"),
            role=api_key_doc.get("role", "user"),
        )

    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Authentication required. Provide session cookie or X-API-Key header.",
    )


async def get_current_organization_id(
    context: UserContext = Depends(get_user_context),
) -> str:
    """Get the current organization ID from the user context."""
    return context.organization_id


# Alias for backward compatibility
get_current_tenant_id = get_current_organization_id


async def require_admin(
    context: UserContext = Depends(get_user_context),
) -> UserContext:
    """Require admin role."""
    if context.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required",
        )
    return context
