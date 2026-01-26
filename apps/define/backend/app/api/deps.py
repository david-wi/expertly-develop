from fastapi import Depends, HTTPException, Header
from typing import Optional
from pydantic import BaseModel

from app.config import get_settings

settings = get_settings()


class CurrentUser(BaseModel):
    id: str
    name: str
    email: str


async def get_current_user(
    x_user_id: Optional[str] = Header(None),
    x_user_name: Optional[str] = Header(None),
    x_user_email: Optional[str] = Header(None),
) -> CurrentUser:
    """
    Get current user from headers or return default in dev mode.

    In production, headers would be set by Identity service / API gateway.
    In dev mode with SKIP_AUTH=true, returns default user.
    """
    if settings.skip_auth:
        return CurrentUser(
            id=settings.default_user_id,
            name=settings.default_user_name,
            email=settings.default_user_email,
        )

    if not x_user_id:
        raise HTTPException(status_code=401, detail="Not authenticated")

    return CurrentUser(
        id=x_user_id,
        name=x_user_name or "Unknown",
        email=x_user_email or "",
    )
