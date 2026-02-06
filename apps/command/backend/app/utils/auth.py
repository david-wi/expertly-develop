"""Authentication utilities using Identity service."""

import hashlib
import secrets
from typing import Optional
from fastapi import Header, HTTPException, status, Depends, Request

from app.config import get_settings

# Import from shared identity-client package
from identity_client import IdentityClient, IdentityAuth
from identity_client.models import User as IdentityUser
from identity_client.auth import get_session_token

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


async def validate_api_key_with_identity(api_key: str) -> Optional[IdentityUser]:
    """Validate an API key against Identity service."""
    client = get_identity_client()
    try:
        import httpx
        async with httpx.AsyncClient() as http_client:
            response = await http_client.get(
                f"{client.base_url}/api/v1/auth/validate-api-key",
                headers={"X-API-Key": api_key},
            )
            if response.status_code == 200:
                data = response.json()
                if data.get("valid") and data.get("user"):
                    user_data = data["user"]
                    return IdentityUser(
                        id=user_data["id"],
                        organization_id=user_data["organization_id"],
                        name=user_data["name"],
                        email=user_data.get("email"),
                        user_type=user_data.get("user_type", "bot"),
                        role=user_data.get("role", "member"),
                        is_active=user_data.get("is_active", True),
                        avatar_url=user_data.get("avatar_url"),
                        title=user_data.get("title"),
                        responsibilities=user_data.get("responsibilities"),
                        organization_name=user_data.get("organization_name"),
                    )
    except Exception:
        pass
    return None


async def get_current_user(
    request: Request,
    x_api_key: Optional[str] = Header(None, alias="X-API-Key"),
) -> IdentityUser:
    """
    Get the current authenticated user from Identity service.

    Authentication priority:
    1. Identity session cookie (X-Session-Token header or expertly_session cookie)
    2. API key (X-API-Key header) - validated against Identity
    3. Dev mode - use session token from environment or skip

    Returns:
        IdentityUser from the Identity service.
    """
    settings = get_settings()

    # Try Identity session first
    auth = get_identity_auth()
    identity_user = await auth.get_current_user_optional(request)

    if identity_user:
        return identity_user

    # Fall back to API key authentication (for bots)
    if x_api_key:
        if x_api_key.startswith(settings.api_key_prefix):
            user = await validate_api_key_with_identity(x_api_key)
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

    # Dev mode fallback - get default user from Identity
    if settings.skip_auth:
        client = get_identity_client()
        try:
            import httpx
            async with httpx.AsyncClient() as http_client:
                response = await http_client.get(
                    f"{client.base_url}/api/v1/auth/dev-user",
                )
                if response.status_code == 200:
                    data = response.json()
                    return IdentityUser(
                        id=data["id"],
                        organization_id=data["organization_id"],
                        name=data["name"],
                        email=data.get("email"),
                        user_type=data.get("user_type", "human"),
                        role=data.get("role", "member"),
                        is_active=True,
                        avatar_url=data.get("avatar_url"),
                        organization_name=data.get("organization_name"),
                    )
        except Exception:
            pass
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Could not get dev user from Identity. Ensure Identity is running."
        )

    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Authentication required. Provide session cookie or X-API-Key header."
    )


async def get_current_user_org_id(
    current_user: IdentityUser = Depends(get_current_user)
) -> str:
    """Get the organization ID of the current user."""
    return current_user.organization_id


def require_role(*roles: str):
    """Dependency factory that requires specific roles."""
    async def role_checker(request: Request) -> IdentityUser:
        user = await get_current_user(request)
        if user.role not in roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Required role: {', '.join(roles)}",
            )
        return user
    return role_checker


async def get_user_by_api_key(api_key: str) -> Optional[IdentityUser]:
    """
    Get user by API key (for WebSocket authentication).

    This is a wrapper around validate_api_key_with_identity for backwards compatibility.
    """
    settings = get_settings()
    if not api_key.startswith(settings.api_key_prefix):
        return None
    return await validate_api_key_with_identity(api_key)


async def get_default_user() -> Optional[IdentityUser]:
    """
    Get the default dev user from Identity service (for skip_auth mode).

    Used by WebSocket authentication when SKIP_AUTH is enabled.
    """
    client = get_identity_client()
    try:
        import httpx
        async with httpx.AsyncClient() as http_client:
            response = await http_client.get(
                f"{client.base_url}/api/v1/auth/dev-user",
            )
            if response.status_code == 200:
                data = response.json()
                return IdentityUser(
                    id=data["id"],
                    organization_id=data["organization_id"],
                    name=data["name"],
                    email=data.get("email"),
                    user_type=data.get("user_type", "human"),
                    role=data.get("role", "member"),
                    is_active=True,
                    avatar_url=data.get("avatar_url"),
                    organization_name=data.get("organization_name"),
                )
    except Exception:
        pass
    return None
