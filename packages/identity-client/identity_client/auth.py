"""Session validation middleware for FastAPI."""

import os
from typing import Optional, Callable, Awaitable
from functools import wraps

from fastapi import Request, HTTPException, status

from identity_client.client import IdentityClient
from identity_client.models import User, ValidateResponse


# Cookie and header names
SESSION_COOKIE_NAME = "expertly_session"
SESSION_HEADER_NAME = "X-Session-Token"


def get_session_token(request: Request) -> Optional[str]:
    """
    Extract session token from request (header or cookie).

    Priority:
    1. X-Session-Token header
    2. expertly_session cookie

    Args:
        request: FastAPI request object.

    Returns:
        Session token string or None.
    """
    # Try header first
    token = request.headers.get(SESSION_HEADER_NAME)
    if token:
        return token

    # Try cookie
    return request.cookies.get(SESSION_COOKIE_NAME)


class IdentityAuth:
    """
    Authentication middleware for Identity session validation.

    Usage:
        auth = IdentityAuth()

        @app.get("/protected")
        async def protected(request: Request):
            user = await auth.get_current_user(request)
            return {"user": user.name}

        # Or as middleware
        @app.middleware("http")
        async def auth_middleware(request: Request, call_next):
            request.state.user = await auth.get_current_user_optional(request)
            return await call_next(request)
    """

    def __init__(
        self,
        identity_url: Optional[str] = None,
        client: Optional[IdentityClient] = None,
    ):
        """
        Initialize auth middleware.

        Args:
            identity_url: Identity API URL (uses env var if not provided).
            client: Optional pre-configured IdentityClient.
        """
        self.identity_url = (
            identity_url
            or os.environ.get("IDENTITY_INTERNAL_URL")
            or os.environ.get("IDENTITY_API_URL")
            or "https://identity.ai.devintensive.com"
        )
        self._client = client

    async def _get_client(self) -> IdentityClient:
        """Get or create the Identity client."""
        if self._client is None:
            self._client = IdentityClient(base_url=self.identity_url)
        return self._client

    async def validate_session(self, request: Request) -> ValidateResponse:
        """
        Validate session token from request.

        Args:
            request: FastAPI request object.

        Returns:
            ValidateResponse with valid flag and user info.
        """
        token = get_session_token(request)
        if not token:
            return ValidateResponse(valid=False, user=None, expires_at=None)

        client = await self._get_client()
        return await client.validate_session(token)

    async def get_current_user(self, request: Request) -> User:
        """
        Get current authenticated user (raises if not authenticated).

        Args:
            request: FastAPI request object.

        Returns:
            User object.

        Raises:
            HTTPException: If not authenticated (401).
        """
        result = await self.validate_session(request)
        if not result.valid or not result.user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Not authenticated",
                headers={"WWW-Authenticate": "Session"},
            )
        return result.user

    async def get_current_user_optional(self, request: Request) -> Optional[User]:
        """
        Get current user if authenticated (returns None if not).

        Args:
            request: FastAPI request object.

        Returns:
            User object or None.
        """
        result = await self.validate_session(request)
        return result.user if result.valid else None

    def require_auth(self) -> Callable:
        """
        FastAPI dependency that requires authentication.

        Usage:
            @app.get("/protected", dependencies=[Depends(auth.require_auth())])
            async def protected():
                ...

        Returns:
            Dependency function.
        """
        async def _require_auth(request: Request) -> User:
            return await self.get_current_user(request)
        return _require_auth

    def require_role(self, *roles: str) -> Callable:
        """
        FastAPI dependency that requires specific roles.

        Usage:
            @app.get("/admin", dependencies=[Depends(auth.require_role("admin", "owner"))])
            async def admin_only():
                ...

        Args:
            *roles: Allowed role names.

        Returns:
            Dependency function.
        """
        async def _require_role(request: Request) -> User:
            user = await self.get_current_user(request)
            if user.role not in roles:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail=f"Insufficient permissions. Required role: {', '.join(roles)}",
                )
            return user
        return _require_role

    def require_admin(self) -> Callable:
        """
        FastAPI dependency that requires admin or owner role.

        Returns:
            Dependency function.
        """
        return self.require_role("admin", "owner")


# Default instance using environment configuration
_default_auth: Optional[IdentityAuth] = None


def get_default_auth() -> IdentityAuth:
    """Get the default IdentityAuth instance."""
    global _default_auth
    if _default_auth is None:
        _default_auth = IdentityAuth()
    return _default_auth
