"""Organization API endpoints - proxies to Identity service."""

from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel
from typing import Optional

from identity_client.auth import get_session_token
from identity_client.models import User as IdentityUser

from app.utils.auth import get_identity_client, get_current_user

router = APIRouter()


class OrganizationUpdate(BaseModel):
    """Schema for updating an organization."""
    name: Optional[str] = None
    slug: Optional[str] = None


def _org_to_dict(org_data: dict) -> dict:
    """Convert Identity organization to API response format."""
    return {
        "id": org_data.get("id"),
        "_id": org_data.get("id"),  # For backward compatibility
        "name": org_data.get("name"),
        "slug": org_data.get("slug"),
        "settings": org_data.get("settings", {}),
        "is_default": org_data.get("is_default", False),
        "created_at": org_data.get("created_at"),
        "updated_at": org_data.get("updated_at"),
    }


@router.get("")
async def list_organizations(
    request: Request,
    current_user: IdentityUser = Depends(get_current_user)
) -> list[dict]:
    """List organizations the user has access to from Identity."""
    session_token = get_session_token(request)
    if not session_token:
        raise HTTPException(status_code=401, detail="Session required")

    client = get_identity_client()
    try:
        # Users typically only have access to their own organization
        org = await client.get_organization(current_user.organization_id, session_token)
        return [_org_to_dict(org.model_dump())]
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch organizations: {str(e)}")


@router.get("/{org_id}")
async def get_organization(
    org_id: str,
    request: Request,
    current_user: IdentityUser = Depends(get_current_user)
) -> dict:
    """Get a specific organization from Identity."""
    session_token = get_session_token(request)
    if not session_token:
        raise HTTPException(status_code=401, detail="Session required")

    # Verify access - users can only see their own organization
    if current_user.organization_id != org_id:
        raise HTTPException(status_code=403, detail="Access denied")

    client = get_identity_client()
    try:
        org = await client.get_organization(org_id, session_token)
        return _org_to_dict(org.model_dump())
    except Exception as e:
        if "404" in str(e) or "not found" in str(e).lower():
            raise HTTPException(status_code=404, detail="Organization not found")
        raise HTTPException(status_code=500, detail=f"Failed to fetch organization: {str(e)}")


@router.patch("/{org_id}")
async def update_organization(
    org_id: str,
    data: OrganizationUpdate,
    request: Request,
    current_user: IdentityUser = Depends(get_current_user)
) -> dict:
    """Update an organization in Identity."""
    session_token = get_session_token(request)
    if not session_token:
        raise HTTPException(status_code=401, detail="Session required")

    # Verify access (must be owner of the organization)
    if current_user.organization_id != org_id or current_user.role != "owner":
        raise HTTPException(status_code=403, detail="Access denied")

    update_data = data.model_dump(exclude_unset=True)
    if not update_data:
        raise HTTPException(status_code=400, detail="No fields to update")

    client = get_identity_client()

    try:
        import httpx
        async with httpx.AsyncClient() as http_client:
            response = await http_client.patch(
                f"{client.base_url}/api/v1/organizations/{org_id}",
                json=update_data,
                headers={
                    "X-Session-Token": session_token,
                    "Content-Type": "application/json",
                },
            )
            if response.status_code == 404:
                raise HTTPException(status_code=404, detail="Organization not found")
            if response.status_code == 400:
                detail = response.json().get("detail", "Bad request")
                raise HTTPException(status_code=400, detail=detail)
            response.raise_for_status()
            result = response.json()

        return _org_to_dict(result)

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to update organization: {str(e)}")
