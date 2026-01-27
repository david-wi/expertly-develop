"""Security utilities using Identity service for authentication."""

from typing import Optional, Any
from fastapi import Depends, HTTPException, status, Request
from bson import ObjectId

from ..config import settings
from .database import get_collection

# Import from shared identity-client package
from identity_client import IdentityClient, IdentityAuth, User as IdentityUser
from identity_client.auth import get_session_token, SESSION_COOKIE_NAME, SESSION_HEADER_NAME


# Identity service client
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


async def get_current_user(request: Request) -> dict:
    """
    Get current authenticated user from Identity session.

    The user is returned as a dict with MongoDB-compatible fields for backward compatibility.
    """
    auth = get_identity_auth()
    identity_user = await auth.get_current_user(request)

    # Map Identity user to local user representation
    # Look up the user in our local users collection by email
    users_collection = get_collection("users")
    local_user = await users_collection.find_one({"email": identity_user.email.lower()})

    if local_user:
        # Return local user data (includes salon_id, staff_id, etc.)
        return local_user

    # If no local user found, create a minimal representation
    # This allows Identity-only users to access the system
    return {
        "_id": ObjectId(),  # Temporary ID
        "email": identity_user.email,
        "first_name": identity_user.name.split()[0] if identity_user.name else "",
        "last_name": " ".join(identity_user.name.split()[1:]) if identity_user.name and len(identity_user.name.split()) > 1 else "",
        "role": _map_identity_role(identity_user.role),
        "salon_id": None,  # No salon association
        "staff_id": None,
        "is_active": identity_user.is_active,
        "identity_user_id": identity_user.id,
        "organization_id": identity_user.organization_id,
    }


def _map_identity_role(identity_role: str) -> str:
    """Map Identity service role to salon role."""
    role_mapping = {
        "owner": "owner",
        "admin": "admin",
        "member": "manager",  # Default members to manager
        "viewer": "staff",
    }
    return role_mapping.get(identity_role, "staff")


async def get_current_user_optional(request: Request) -> Optional[dict]:
    """Get current user if authenticated, None otherwise."""
    auth = get_identity_auth()
    identity_user = await auth.get_current_user_optional(request)

    if not identity_user:
        return None

    # Same logic as get_current_user
    users_collection = get_collection("users")
    local_user = await users_collection.find_one({"email": identity_user.email.lower()})

    if local_user:
        return local_user

    return {
        "_id": ObjectId(),
        "email": identity_user.email,
        "first_name": identity_user.name.split()[0] if identity_user.name else "",
        "last_name": " ".join(identity_user.name.split()[1:]) if identity_user.name and len(identity_user.name.split()) > 1 else "",
        "role": _map_identity_role(identity_user.role),
        "salon_id": None,
        "staff_id": None,
        "is_active": identity_user.is_active,
        "identity_user_id": identity_user.id,
        "organization_id": identity_user.organization_id,
    }


async def get_current_active_user(
    current_user: dict = Depends(get_current_user)
) -> dict:
    """Alias for get_current_user that ensures user is active."""
    return current_user


def require_role(*roles: str):
    """Dependency factory that requires specific roles."""
    async def role_checker(request: Request) -> dict:
        current_user = await get_current_user(request)
        user_role = current_user.get("role", "staff")
        if user_role not in roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Required role: {', '.join(roles)}",
            )
        return current_user
    return role_checker


# Keep password utilities for local user management (staff accounts)
# These are used when creating salon-specific user accounts
from passlib.context import CryptContext

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a password against its hash."""
    return pwd_context.verify(plain_password, hashed_password)


def get_password_hash(password: str) -> str:
    """Generate password hash."""
    return pwd_context.hash(password)
