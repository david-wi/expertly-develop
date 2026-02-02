"""
Authentication endpoints using Identity service.

Most authentication operations (login, logout, register) are handled by the
Identity service at https://identity.ai.devintensive.com. This module provides:
- Session validation endpoint (/auth/me)
- Identity redirect URLs

Note: Login/logout/register are now handled by the Identity frontend.
"""

from fastapi import APIRouter, Request

from app.api.deps import get_current_user
from app.config import get_settings
from identity_client.models import User as IdentityUser

router = APIRouter()
settings = get_settings()

# Identity service URLs for frontend to redirect to
IDENTITY_LOGIN_URL = f"{settings.identity_api_url}/login"
IDENTITY_LOGOUT_URL = f"{settings.identity_api_url}/logout"
IDENTITY_REGISTER_URL = f"{settings.identity_api_url}/register"
IDENTITY_USERS_URL = f"{settings.identity_api_url}/users"


@router.get("/identity-urls")
async def get_identity_urls():
    """Get Identity service URLs for frontend redirects."""
    return {
        "login_url": IDENTITY_LOGIN_URL,
        "logout_url": IDENTITY_LOGOUT_URL,
        "register_url": IDENTITY_REGISTER_URL,
        "users_management_url": IDENTITY_USERS_URL,
    }


@router.get("/me")
async def get_current_user_info(request: Request):
    """Get current user information from Identity session."""
    current_user: IdentityUser = await get_current_user(request)

    return {
        "id": current_user.id,
        "email": current_user.email,
        "full_name": current_user.name,
        "role": current_user.role,
        "is_active": current_user.is_active,
        "is_verified": True,  # Identity users are always verified
        "organization": {
            "id": current_user.organization_id,
            "name": current_user.organization_name or "Organization",
        },
    }
