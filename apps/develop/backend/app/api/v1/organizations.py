"""Organizations API endpoints."""

from typing import List
from pydantic import BaseModel
from fastapi import APIRouter, Depends

from app.database import get_database
from app.api.deps import get_current_user, UserContext

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
    user: UserContext = Depends(get_current_user),
):
    """
    List all available organizations.

    Available to all authenticated users.
    """
    db = get_database()

    tenants = await db.tenants.find({}).to_list(length=100)

    items = [
        OrganizationResponse(
            id=str(tenant["_id"]),
            name=tenant["name"],
            slug=tenant["slug"],
        )
        for tenant in tenants
    ]

    return OrganizationsListResponse(items=items, total=len(items))
