"""API dependencies for authentication."""

from typing import Optional
from fastapi import Depends, HTTPException, Request
from pydantic import BaseModel

from app.config import get_settings

# Import from shared identity-client package
from identity_client import IdentityClient, IdentityAuth
from identity_client.models import User as IdentityUser

settings = get_settings()

# Identity service client (singleton)
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


class CurrentUser(BaseModel):
    """Current user context."""
    id: str
    name: str
    email: str
    organization_id: Optional[str] = None


async def get_current_user(request: Request) -> CurrentUser:
    """
    Get current user by validating session cookie with Identity API.

    In dev mode with SKIP_AUTH=true, returns default user.
    In production, validates the expertly_session cookie against Identity API.
    """
    if settings.skip_auth:
        return CurrentUser(
            id=settings.default_user_id,
            name=settings.default_user_name,
            email=settings.default_user_email,
        )

    # Use identity-client for session validation
    auth = get_identity_auth()
    identity_user = await auth.get_current_user(request)

    return CurrentUser(
        id=str(identity_user.id),
        name=identity_user.name,
        email=identity_user.email or "",
        organization_id=str(identity_user.organization_id) if identity_user.organization_id else None,
    )
