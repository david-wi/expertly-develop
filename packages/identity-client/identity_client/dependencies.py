"""FastAPI dependencies for Identity authentication."""

import os
from typing import Optional, Annotated
from functools import lru_cache

from fastapi import Depends, Request, HTTPException, status

from identity_client.client import IdentityClient
from identity_client.auth import IdentityAuth, get_session_token
from identity_client.models import User


# -----------------------------------------------------------------------------
# Singleton instances
# -----------------------------------------------------------------------------

@lru_cache
def get_identity_client() -> IdentityClient:
    """
    Get singleton IdentityClient instance.

    Reads from IDENTITY_INTERNAL_URL or IDENTITY_API_URL environment variables.
    """
    return IdentityClient()


@lru_cache
def get_identity_auth() -> IdentityAuth:
    """Get singleton IdentityAuth instance."""
    return IdentityAuth(client=get_identity_client())


# -----------------------------------------------------------------------------
# FastAPI Dependencies
# -----------------------------------------------------------------------------

async def get_current_user(request: Request) -> User:
    """
    FastAPI dependency to get the current authenticated user.

    Raises HTTPException 401 if not authenticated.

    Usage:
        @app.get("/protected")
        async def protected(user: User = Depends(get_current_user)):
            return {"user": user.name}
    """
    auth = get_identity_auth()
    return await auth.get_current_user(request)


async def get_current_user_optional(request: Request) -> Optional[User]:
    """
    FastAPI dependency to get current user if authenticated.

    Returns None if not authenticated (does not raise).

    Usage:
        @app.get("/public")
        async def public(user: Optional[User] = Depends(get_current_user_optional)):
            if user:
                return {"message": f"Hello {user.name}"}
            return {"message": "Hello guest"}
    """
    auth = get_identity_auth()
    return await auth.get_current_user_optional(request)


def require_auth(request: Request) -> User:
    """
    Alias for get_current_user for explicit dependency naming.

    Usage:
        @app.get("/protected", dependencies=[Depends(require_auth)])
        async def protected():
            ...
    """
    # Note: This is synchronous wrapper, actual validation happens in get_current_user
    # This function exists for cleaner dependency naming
    raise NotImplementedError("Use get_current_user instead")


def require_role(*roles: str):
    """
    FastAPI dependency factory that requires specific roles.

    Usage:
        @app.get("/admin")
        async def admin_only(user: User = Depends(require_role("admin", "owner"))):
            return {"admin": True}

    Args:
        *roles: Allowed role names (e.g., "admin", "owner", "member").

    Returns:
        Dependency function that validates role.
    """
    async def _check_role(request: Request) -> User:
        user = await get_current_user(request)
        if user.role not in roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Insufficient permissions. Required: {', '.join(roles)}",
            )
        return user
    return _check_role


def require_admin():
    """
    FastAPI dependency that requires admin or owner role.

    Usage:
        @app.get("/admin-only")
        async def admin(user: User = Depends(require_admin())):
            return {"admin": True}
    """
    return require_role("admin", "owner")


# -----------------------------------------------------------------------------
# Type Aliases for cleaner signatures
# -----------------------------------------------------------------------------

CurrentUser = Annotated[User, Depends(get_current_user)]
OptionalUser = Annotated[Optional[User], Depends(get_current_user_optional)]


# -----------------------------------------------------------------------------
# Session Token Dependency
# -----------------------------------------------------------------------------

async def get_session_token_dep(request: Request) -> Optional[str]:
    """
    FastAPI dependency to extract session token from request.

    Useful when you need the raw token for API calls.
    """
    return get_session_token(request)


SessionToken = Annotated[Optional[str], Depends(get_session_token_dep)]
