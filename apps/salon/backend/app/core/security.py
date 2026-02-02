"""Security utilities using Identity service for authentication."""

from typing import Optional
from fastapi import Depends, HTTPException, status, Request

from ..config import settings
from .database import get_collection

# Import from shared identity-client package
from identity_client import IdentityClient, IdentityAuth
from identity_client.models import User as IdentityUser
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


async def get_current_user(request: Request) -> IdentityUser:
    """
    Get current authenticated user from Identity session.

    Returns IdentityUser directly from Identity service.
    For salon-specific data (salon_id, staff_id), use get_salon_membership().
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
    identity_user = await auth.get_current_user_optional(request)

    if identity_user and not identity_user.is_active:
        return None

    return identity_user


async def get_salon_membership(identity_user: IdentityUser) -> Optional[dict]:
    """
    Get salon membership data for an Identity user.

    Returns the salon-specific membership record (salon_id, staff_id, role)
    or None if the user has no salon membership.
    """
    memberships = get_collection("salon_memberships")
    membership = await memberships.find_one({
        "identity_user_id": identity_user.id
    })
    return membership


async def get_current_active_user(
    current_user: IdentityUser = Depends(get_current_user)
) -> IdentityUser:
    """Alias for get_current_user that ensures user is active."""
    return current_user


def _map_identity_role(identity_role: str) -> str:
    """Map Identity service role to salon role."""
    role_mapping = {
        "owner": "owner",
        "admin": "admin",
        "member": "manager",
        "viewer": "staff",
    }
    return role_mapping.get(identity_role, "staff")


def require_role(*roles: str):
    """
    Dependency factory that requires specific Identity roles.

    Note: This checks Identity service roles, not salon membership roles.
    For salon-specific role checks, use require_salon_role().
    """
    async def role_checker(request: Request) -> IdentityUser:
        current_user = await get_current_user(request)
        user_role = current_user.role
        mapped_role = _map_identity_role(user_role)
        if mapped_role not in roles and user_role not in roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Required role: {', '.join(roles)}",
            )
        return current_user
    return role_checker


def require_salon_role(*roles: str):
    """
    Dependency factory that requires specific salon membership roles.

    Checks the user's role in their salon membership record.
    """
    async def role_checker(request: Request) -> dict:
        current_user = await get_current_user(request)
        membership = await get_salon_membership(current_user)

        if not membership:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="No salon membership found",
            )

        user_role = membership.get("role", "staff")
        if user_role not in roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Required role: {', '.join(roles)}",
            )

        # Return membership data with identity user info
        return {
            **membership,
            "identity_user": current_user,
        }
    return role_checker


# Password utilities for legacy support
from passlib.context import CryptContext

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a password against its hash."""
    return pwd_context.verify(plain_password, hashed_password)


def get_password_hash(password: str) -> str:
    """Generate password hash."""
    return pwd_context.hash(password)
