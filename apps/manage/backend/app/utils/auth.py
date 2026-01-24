import hashlib
import secrets
from typing import Optional
from fastapi import Header, HTTPException, status, Depends
from bson import ObjectId

from app.config import get_settings
from app.database import get_database
from app.models import User


def hash_api_key(api_key: str) -> str:
    """Hash an API key for storage."""
    return hashlib.sha256(api_key.encode()).hexdigest()


def generate_api_key() -> str:
    """Generate a new API key."""
    settings = get_settings()
    random_part = secrets.token_urlsafe(32)
    return f"{settings.api_key_prefix}{random_part}"


async def get_user_by_api_key(api_key: str) -> Optional[User]:
    """Look up a user by their API key."""
    db = get_database()
    key_hash = hash_api_key(api_key)

    user_doc = await db.users.find_one({"api_key_hash": key_hash, "is_active": True})
    if user_doc:
        return User(**user_doc)
    return None


async def get_default_user() -> Optional[User]:
    """Get the default user (for dev mode)."""
    db = get_database()
    user_doc = await db.users.find_one({"is_default": True})
    if user_doc:
        return User(**user_doc)
    return None


async def get_current_user(
    x_api_key: Optional[str] = Header(None, alias="X-API-Key")
) -> User:
    """
    Get the current authenticated user.

    In dev mode (SKIP_AUTH=true), returns the default user.
    Otherwise, requires a valid API key.
    """
    settings = get_settings()

    if settings.skip_auth:
        user = await get_default_user()
        if user:
            return user
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Default user not found. Run seed script first."
        )

    if not x_api_key:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="API key required. Provide X-API-Key header."
        )

    if not x_api_key.startswith(settings.api_key_prefix):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid API key format."
        )

    user = await get_user_by_api_key(x_api_key)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid API key."
        )

    return user


async def get_current_user_org_id(
    current_user: User = Depends(get_current_user)
) -> ObjectId:
    """Get the organization ID of the current user."""
    return current_user.organization_id
