from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status
from bson import ObjectId

from app.database import get_database
from app.models import Organization, OrganizationCreate, OrganizationUpdate, User
from app.api.deps import get_current_user

router = APIRouter()


@router.get("")
async def list_organizations(
    current_user: User = Depends(get_current_user)
) -> list[dict]:
    """List organizations the user has access to."""
    db = get_database()

    # Users can only see their own organization
    cursor = db.organizations.find({"_id": current_user.organization_id})
    orgs = await cursor.to_list(100)

    return [{**org, "_id": str(org["_id"])} for org in orgs]


@router.get("/{org_id}")
async def get_organization(
    org_id: str,
    current_user: User = Depends(get_current_user)
) -> dict:
    """Get a specific organization."""
    db = get_database()

    if not ObjectId.is_valid(org_id):
        raise HTTPException(status_code=400, detail="Invalid organization ID")

    # Verify access
    if str(current_user.organization_id) != org_id:
        raise HTTPException(status_code=403, detail="Access denied")

    org = await db.organizations.find_one({"_id": ObjectId(org_id)})
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")

    return {**org, "_id": str(org["_id"])}


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_organization(
    data: OrganizationCreate,
    current_user: User = Depends(get_current_user)
) -> dict:
    """Create a new organization."""
    db = get_database()

    # Check for duplicate slug
    existing = await db.organizations.find_one({"slug": data.slug})
    if existing:
        raise HTTPException(status_code=400, detail="Organization slug already exists")

    org = Organization(
        name=data.name,
        slug=data.slug,
        settings=data.settings or Organization.model_fields["settings"].default_factory(),
        is_default=data.is_default
    )

    await db.organizations.insert_one(org.model_dump_mongo())

    return {**org.model_dump_mongo(), "_id": str(org.id)}


@router.patch("/{org_id}")
async def update_organization(
    org_id: str,
    data: OrganizationUpdate,
    current_user: User = Depends(get_current_user)
) -> dict:
    """Update an organization."""
    db = get_database()

    if not ObjectId.is_valid(org_id):
        raise HTTPException(status_code=400, detail="Invalid organization ID")

    # Verify access (must be owner)
    if str(current_user.organization_id) != org_id or current_user.role != "owner":
        raise HTTPException(status_code=403, detail="Access denied")

    update_data = data.model_dump(exclude_unset=True)
    if not update_data:
        raise HTTPException(status_code=400, detail="No fields to update")

    # Check for duplicate slug
    if "slug" in update_data:
        existing = await db.organizations.find_one({
            "slug": update_data["slug"],
            "_id": {"$ne": ObjectId(org_id)}
        })
        if existing:
            raise HTTPException(status_code=400, detail="Organization slug already exists")

    result = await db.organizations.find_one_and_update(
        {"_id": ObjectId(org_id)},
        {"$set": update_data},
        return_document=True
    )

    if not result:
        raise HTTPException(status_code=404, detail="Organization not found")

    return {**result, "_id": str(result["_id"])}
