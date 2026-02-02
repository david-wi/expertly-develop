"""Users API endpoints.

Returns user information from Identity service.
"""

from pydantic import BaseModel
from typing import Optional
from fastapi import APIRouter, Depends, Request

from app.api.deps import get_current_user, get_user_context, UserContext
from identity_client.models import User as IdentityUser

router = APIRouter()


class OrganizationInfo(BaseModel):
    """Organization info for user context."""
    id: str
    name: Optional[str] = None


class CurrentUserResponse(BaseModel):
    """Current user response schema."""
    id: str
    name: str
    email: str
    role: str
    organization: OrganizationInfo


@router.get("/me", response_model=CurrentUserResponse)
async def get_current_user_info(
    request: Request,
    context: UserContext = Depends(get_user_context),
):
    """
    Get current user context including organization information.

    User data comes from Identity service.
    """
    # Get full Identity user for organization name
    identity_user = await get_current_user(request)

    return CurrentUserResponse(
        id=context.user_id,
        name=context.name,
        email=context.email,
        role=context.role,
        organization=OrganizationInfo(
            id=context.organization_id,
            name=identity_user.organization_name,
        ),
    )
