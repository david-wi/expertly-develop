"""Authentication routes.

Login is handled by the centralized Identity service.  This module exposes
only the endpoints the Intake frontend needs after a session has already
been established.
"""

from fastapi import APIRouter, Depends

from app.core.security import get_current_user
from app.config import settings
from app.schemas.auth import UserResponse

router = APIRouter()

# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------


@router.get("/me", response_model=UserResponse)
async def get_me(current_user: dict = Depends(get_current_user)):
    """Return the currently authenticated user's profile from the session."""
    return UserResponse(**current_user)


@router.get("/auth/identity-urls")
async def get_identity_urls():
    """Return Identity service login/logout URLs for the frontend."""
    identity_url = settings.identity_api_url.replace("-api", "")
    return {
        "loginUrl": f"{identity_url}/login",
        "logoutUrl": f"{identity_url}/logout",
    }
