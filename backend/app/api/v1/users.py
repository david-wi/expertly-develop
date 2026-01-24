"""Users API endpoints."""

from pydantic import BaseModel
from fastapi import APIRouter, Depends

from app.database import get_database
from app.api.deps import get_current_user, UserContext

router = APIRouter()


class TenantInfo(BaseModel):
    """Tenant info for user context."""
    id: str
    name: str
    slug: str


class CurrentUserResponse(BaseModel):
    """Current user response schema."""
    id: str
    name: str
    email: str
    role: str
    tenant: TenantInfo


@router.get("/me", response_model=CurrentUserResponse)
async def get_current_user_info(
    user: UserContext = Depends(get_current_user),
):
    """
    Get current user context including tenant information.
    """
    db = get_database()

    # Get tenant info
    tenant = await db.tenants.find_one({"_id": user.tenant_id})

    return CurrentUserResponse(
        id=str(user.user_id),
        name=user.name,
        email=user.email,
        role=user.role,
        tenant=TenantInfo(
            id=str(tenant["_id"]),
            name=tenant["name"],
            slug=tenant["slug"],
        ),
    )
