from fastapi import Depends, HTTPException, Request
from typing import Optional
from pydantic import BaseModel
import httpx

from app.config import get_settings

settings = get_settings()


class CurrentUser(BaseModel):
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

    # Get session token from cookie
    session_token = request.cookies.get(settings.session_cookie_name)

    if not session_token:
        raise HTTPException(status_code=401, detail="Not authenticated - no session cookie")

    # Validate with Identity API
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{settings.identity_api_url}/api/v1/auth/validate",
                headers={"X-Session-Token": session_token},
                timeout=5.0,
            )

            if response.status_code != 200:
                raise HTTPException(status_code=401, detail="Invalid session")

            data = response.json()

            if not data.get("valid") or not data.get("user"):
                raise HTTPException(status_code=401, detail="Session expired or invalid")

            user = data["user"]
            return CurrentUser(
                id=user["id"],
                name=user["name"],
                email=user.get("email") or "",
                organization_id=user.get("organization_id"),
            )

    except httpx.RequestError as e:
        # If Identity API is unreachable, fail closed (deny access)
        raise HTTPException(status_code=503, detail=f"Auth service unavailable: {str(e)}")
