"""Organizations API endpoints.

Returns organization information from Identity service.
"""

from typing import List, Optional
from pydantic import BaseModel
from fastapi import APIRouter, Depends, Request, HTTPException, status

from app.api.deps import get_current_user, get_user_context, get_identity_client, UserContext
from identity_client.models import User as IdentityUser

router = APIRouter()


class OrganizationResponse(BaseModel):
    """Organization response schema."""
    id: str
    name: str
    slug: Optional[str] = None


class OrganizationsListResponse(BaseModel):
    """List organizations response."""
    items: List[OrganizationResponse]
    total: int


@router.get("", response_model=OrganizationsListResponse)
async def list_organizations(
    request: Request,
    context: UserContext = Depends(get_user_context),
):
    """
    List organizations available to the current user.

    Returns the user's organization from Identity service.
    """
    # Get full Identity user for organization details
    identity_user = await get_current_user(request)

    # Return the user's organization
    items = [
        OrganizationResponse(
            id=identity_user.organization_id,
            name=identity_user.organization_name or "Default Organization",
            slug=identity_user.organization_id[:8] if identity_user.organization_id else None,
        )
    ]

    return OrganizationsListResponse(items=items, total=len(items))


@router.get("/current", response_model=OrganizationResponse)
async def get_current_organization(
    request: Request,
    context: UserContext = Depends(get_user_context),
):
    """
    Get the current organization context.
    """
    identity_user = await get_current_user(request)

    return OrganizationResponse(
        id=context.organization_id,
        name=identity_user.organization_name or "Default Organization",
        slug=context.organization_id[:8] if context.organization_id else None,
    )
