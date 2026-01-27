"""Authentication utilities using Identity service."""

import hashlib
import secrets
from typing import Optional
from fastapi import Header, HTTPException, status, Depends, Request
from bson import ObjectId

from app.config import get_settings
from app.database import get_database
from app.models import User

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


def hash_api_key(api_key: str) -> str:
    """Hash an API key for storage."""
    return hashlib.sha256(api_key.encode()).hexdigest()


def generate_api_key() -> str:
    """Generate a new API key."""
    settings = get_settings()
    random_part = secrets.token_urlsafe(32)
    return f"{settings.api_key_prefix}{random_part}"


async def get_user_by_api_key(api_key: str) -> Optional[User]:
    """Look up a user by their API key."""
    db = get_database()
    key_hash = hash_api_key(api_key)

    user_doc = await db.users.find_one({"api_key_hash": key_hash, "is_active": True})
    if user_doc:
        return User(**user_doc)
    return None


async def get_default_user() -> Optional[User]:
    """Get the default user (for dev mode)."""
    db = get_database()
    user_doc = await db.users.find_one({"is_default": True})
    if user_doc:
        return User(**user_doc)
    return None


def _map_identity_role(identity_role: str) -> str:
    """Map Identity service role to manage role."""
    role_mapping = {
        "owner": "owner",
        "admin": "admin",
        "member": "member",
        "viewer": "member",
    }
    return role_mapping.get(identity_role, "member")


async def get_current_user(
    request: Request,
    x_api_key: Optional[str] = Header(None, alias="X-API-Key"),
) -> User:
    """
    Get the current authenticated user.

    Authentication priority:
    1. Identity session cookie (X-Session-Token header or expertly_session cookie)
    2. API key (X-API-Key header) - for bots and service-to-service calls
    3. Dev mode default user (SKIP_AUTH=true)
    """
    settings = get_settings()
    db = get_database()

    # Try Identity session first
    auth = get_identity_auth()
    identity_user = await auth.get_current_user_optional(request)

    if identity_user:
        # Look up local user by email
        user_doc = await db.users.find_one({
            "email": identity_user.email,
            "is_active": True,
        })

        if user_doc:
            return User(**user_doc)

        # If no local user found, create one based on Identity user
        # First, ensure the organization exists
        org_doc = await db.organizations.find_one({"_id": ObjectId(identity_user.organization_id)})
        if not org_doc:
            # Create organization
            org_data = {
                "_id": ObjectId(identity_user.organization_id),
                "name": identity_user.organization_name or "Default Organization",
                "slug": identity_user.organization_id[:8],
                "is_default": False,
            }
            await db.organizations.insert_one(org_data)

        # Create local user linked to Identity
        user_data = {
            "_id": ObjectId(identity_user.id),
            "organization_id": ObjectId(identity_user.organization_id),
            "email": identity_user.email,
            "name": identity_user.name,
            "user_type": "human",
            "role": _map_identity_role(identity_user.role),
            "is_active": True,
            "is_default": False,
            "avatar_url": identity_user.avatar_url,
        }
        await db.users.insert_one(user_data)
        return User(**user_data)

    # Fall back to API key authentication (for bots)
    if x_api_key:
        if x_api_key.startswith(settings.api_key_prefix):
            user = await get_user_by_api_key(x_api_key)
            if user:
                return user
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid API key."
            )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid API key format."
        )

    # Dev mode fallback
    if settings.skip_auth:
        user = await get_default_user()
        if user:
            return user
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Default user not found. Run seed script first."
        )

    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Authentication required. Provide session cookie or X-API-Key header."
    )


async def get_current_user_org_id(
    current_user: User = Depends(get_current_user)
) -> ObjectId:
    """Get the organization ID of the current user."""
    return current_user.organization_id


def require_role(*roles: str):
    """Dependency factory that requires specific roles."""
    async def role_checker(request: Request) -> User:
        user = await get_current_user(request)
        if user.role not in roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Required role: {', '.join(roles)}",
            )
        return user
    return role_checker
