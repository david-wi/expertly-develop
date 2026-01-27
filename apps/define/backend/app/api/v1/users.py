"""Users API endpoints."""

from fastapi import APIRouter, Depends

from app.api.deps import get_current_user, CurrentUser

router = APIRouter()


@router.get("/me", response_model=CurrentUser)
async def get_me(current_user: CurrentUser = Depends(get_current_user)):
    """Get current user information."""
    return current_user
