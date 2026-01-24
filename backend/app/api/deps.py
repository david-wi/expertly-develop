"""API dependencies for authentication and context."""

from typing import Optional
from bson import ObjectId
from fastapi import Depends, HTTPException, Header, status
from pydantic import BaseModel

from app.database import get_database


class UserContext(BaseModel):
    """Current user context."""

    user_id: ObjectId
    tenant_id: ObjectId
    email: str
    name: str
    role: str

    class Config:
        arbitrary_types_allowed = True


async def get_default_user() -> Optional[dict]:
    """Get the default user from the database."""
    db = get_database()
    user = await db.users.find_one({"is_default": True})
    return user


async def get_current_user(
    x_api_key: Optional[str] = Header(None, alias="X-API-Key"),
) -> UserContext:
    """
    Get the current user context.

    For now, returns the default user (David).
    Later can be extended to support API key or JWT authentication.
    """
    db = get_database()

    # If API key provided, authenticate with it
    if x_api_key:
        user = await db.users.find_one({"api_key": x_api_key, "deleted_at": None})
        if not user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid API key",
            )
    else:
        # Use default user
        user = await get_default_user()
        if not user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="No default user configured. Please seed the database.",
            )

    return UserContext(
        user_id=user["_id"],
        tenant_id=user["tenant_id"],
        email=user["email"],
        name=user["name"],
        role=user["role"],
    )


async def get_current_tenant_id(
    user: UserContext = Depends(get_current_user),
) -> ObjectId:
    """Get the current tenant ID from the user context."""
    return user.tenant_id


async def require_admin(
    user: UserContext = Depends(get_current_user),
) -> UserContext:
    """Require admin role."""
    if user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required",
        )
    return user
