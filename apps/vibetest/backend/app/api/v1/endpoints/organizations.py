"""Organizations API endpoints."""

from typing import List
from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel

from app.api.deps import get_current_user, get_identity_client, CurrentUser

router = APIRouter()


class OrganizationResponse(BaseModel):
    """Organization response schema."""
    id: str
    name: str
    slug: str


class OrganizationsListResponse(BaseModel):
    """List organizations response."""
    items: List[OrganizationResponse]
    total: int


@router.get("", response_model=OrganizationsListResponse)
async def list_organizations(
    request: Request,
    current_user: CurrentUser,
):
    """
    List all available organizations.

    Fetches organizations from the Identity service.
    """
    # Get session token from cookie
    session_token = request.cookies.get("expertly_session")
    if not session_token:
        return OrganizationsListResponse(items=[], total=0)

    # Fetch organizations from Identity service
    client = get_identity_client()
    try:
        result = await client.list_organizations(session_token)
        items = [
            OrganizationResponse(
                id=str(org.id),
                name=org.name,
                slug=org.slug,
            )
            for org in result.items
        ]
        return OrganizationsListResponse(items=items, total=result.total)
    except Exception:
        # If identity service fails, return empty list
        return OrganizationsListResponse(items=[], total=0)
