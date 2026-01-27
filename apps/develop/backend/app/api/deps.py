"""API dependencies for authentication and context."""

from typing import Optional
from bson import ObjectId
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
    """Current user context."""

    user_id: ObjectId
    tenant_id: ObjectId
    email: str
    name: str
    role: str

    class Config:
        arbitrary_types_allowed = True


async def get_default_user() -> Optional[dict]:
    """Get the default user from the database."""
    db = get_database()
    user = await db.users.find_one({"is_default": True})
    return user


async def _ensure_local_user(identity_user: IdentityUser, db) -> dict:
    """Ensure local user and tenant exist for Identity user, create if needed."""
    # Look up local user by email
    user = await db.users.find_one({"email": identity_user.email, "deleted_at": None})

    if user:
        return user

    # Create tenant if needed
    tenant = await db.tenants.find_one({"_id": ObjectId(identity_user.organization_id)})

    if not tenant:
        # Try to find by slug or name match
        tenant = await db.tenants.find_one({"slug": identity_user.organization_id[:8]})

        if not tenant:
            # Create tenant from Identity org
            tenant_doc = {
                "_id": ObjectId(identity_user.organization_id) if len(identity_user.organization_id) == 24 else ObjectId(),
                "name": identity_user.organization_name or "Default Tenant",
                "slug": identity_user.organization_id[:8],
            }
            await db.tenants.insert_one(tenant_doc)
            tenant = tenant_doc

    # Create local user linked to Identity
    user_id = ObjectId(identity_user.id) if len(identity_user.id) == 24 else ObjectId()
    user_doc = {
        "_id": user_id,
        "tenant_id": tenant["_id"],
        "email": identity_user.email,
        "name": identity_user.name,
        "role": _map_identity_role(identity_user.role),
        "is_default": False,
    }
    await db.users.insert_one(user_doc)

    return user_doc


async def get_current_user(
    request: Request,
    x_api_key: Optional[str] = Header(None, alias="X-API-Key"),
    x_tenant_id: Optional[str] = Header(None, alias="X-Tenant-Id"),
) -> UserContext:
    """
    Get the current user context.

    Authentication priority:
    1. Identity session cookie (X-Session-Token header or expertly_session cookie)
    2. API key (X-API-Key header)
    3. Default user (for backward compatibility)

    Supports tenant switching via X-Tenant-Id header for admin users.
    """
    db = get_database()
    user = None

    # Try Identity session first
    auth = get_identity_auth()
    identity_user = await auth.get_current_user_optional(request)

    if identity_user:
        # Ensure local user exists
        user = await _ensure_local_user(identity_user, db)
    elif x_api_key:
        # Fall back to API key authentication
        user = await db.users.find_one({"api_key": x_api_key, "deleted_at": None})
        if not user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid API key",
            )
    else:
        # Fall back to default user for backward compatibility
        user = await get_default_user()
        if not user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Authentication required. Provide session cookie or X-API-Key header.",
            )

    # Determine tenant_id (possibly overridden)
    tenant_id = user["tenant_id"]

    # Allow admin users to switch tenants via X-Tenant-Id header
    if x_tenant_id and user["role"] == "admin":
        try:
            override_tenant_id = ObjectId(x_tenant_id)
            # Validate tenant exists
            tenant = await db.tenants.find_one({"_id": override_tenant_id})
            if tenant:
                tenant_id = override_tenant_id
            else:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Invalid tenant ID",
                )
        except Exception as e:
            if isinstance(e, HTTPException):
                raise
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid tenant ID format",
            )

    return UserContext(
        user_id=user["_id"],
        tenant_id=tenant_id,
        email=user["email"],
        name=user["name"],
        role=user["role"],
    )


async def get_current_tenant_id(
    user: UserContext = Depends(get_current_user),
) -> ObjectId:
    """Get the current tenant ID from the user context."""
    return user.tenant_id


async def require_admin(
    user: UserContext = Depends(get_current_user),
) -> UserContext:
    """Require admin role."""
    if user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required",
        )
    return user
