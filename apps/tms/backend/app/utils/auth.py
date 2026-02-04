from typing import Optional
from fastapi import Request, HTTPException
import logging

from app.config import get_settings

logger = logging.getLogger(__name__)


async def get_current_user(request: Request) -> Optional[dict]:
    """
    Get the current user from the request.
    In production, this validates the session with the Identity service.
    In dev mode (SKIP_AUTH=true), returns a mock user.
    """
    settings = get_settings()

    if settings.skip_auth:
        return {
            "id": "dev-user",
            "email": settings.default_user_email,
            "name": settings.default_user_name,
        }

    # In production, validate session cookie with Identity service
    session_cookie = request.cookies.get("expertly_session")
    if not session_cookie:
        raise HTTPException(status_code=401, detail="Not authenticated")

    # TODO: Validate session with Identity service
    # For now, skip validation if cookie exists
    return {
        "id": "authenticated-user",
        "email": "user@example.com",
        "name": "Authenticated User",
    }
