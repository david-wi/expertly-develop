from fastapi import APIRouter, Depends, HTTPException, status
from bson import ObjectId

from app.database import get_database
from app.models import SOP, SOPCreate, SOPUpdate, SOPType, User
from app.api.deps import get_current_user

router = APIRouter()


def serialize_sop(sop: dict) -> dict:
    """Convert ObjectIds to strings in SOP document."""
    result = {**sop, "_id": str(sop["_id"])}
    result["organization_id"] = str(sop["organization_id"])
    result["queue_ids"] = [str(q) for q in sop.get("queue_ids", [])]
    return result


@router.get("")
async def list_sops(
    sop_type: str | None = None,
    queue_id: str | None = None,
    active_only: bool = True,
    current_user: User = Depends(get_current_user)
) -> list[dict]:
    """List SOPs in the current organization."""
    db = get_database()

    query = {"organization_id": current_user.organization_id}

    if sop_type:
        query["sop_type"] = sop_type

    if queue_id:
        if not ObjectId.is_valid(queue_id):
            raise HTTPException(status_code=400, detail="Invalid queue ID")
        query["queue_ids"] = ObjectId(queue_id)

    if active_only:
        query["is_active"] = True

    cursor = db.sops.find(query).sort("name", 1)
    sops = await cursor.to_list(100)

    return [serialize_sop(s) for s in sops]


@router.get("/match")
async def match_sop(
    queue_id: str | None = None,
    title: str | None = None,
    keywords: str | None = None,
    current_user: User = Depends(get_current_user)
) -> dict | None:
    """
    Find the best matching SOP for a task.

    Matches by queue_id first, then by keywords in title.
    """
    db = get_database()

    query = {
        "organization_id": current_user.organization_id,
        "is_active": True
    }

    # Try to match by queue first
    if queue_id and ObjectId.is_valid(queue_id):
        sop = await db.sops.find_one({
            **query,
            "queue_ids": ObjectId(queue_id)
        })
        if sop:
            return serialize_sop(sop)

    # Try to match by keywords
    search_text = " ".join(filter(None, [title, keywords])).lower()
    if search_text:
        cursor = db.sops.find({
            **query,
            "match_keywords": {"$exists": True, "$ne": []}
        })
        sops = await cursor.to_list(100)

        for sop in sops:
            for keyword in sop.get("match_keywords", []):
                if keyword.lower() in search_text:
                    return serialize_sop(sop)

    return None


@router.get("/{sop_id}")
async def get_sop(
    sop_id: str,
    current_user: User = Depends(get_current_user)
) -> dict:
    """Get a specific SOP."""
    db = get_database()

    if not ObjectId.is_valid(sop_id):
        raise HTTPException(status_code=400, detail="Invalid SOP ID")

    sop = await db.sops.find_one({
        "_id": ObjectId(sop_id),
        "organization_id": current_user.organization_id
    })

    if not sop:
        raise HTTPException(status_code=404, detail="SOP not found")

    return serialize_sop(sop)


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_sop(
    data: SOPCreate,
    current_user: User = Depends(get_current_user)
) -> dict:
    """Create a new SOP."""
    db = get_database()

    # Validate based on type
    if data.sop_type == SOPType.GENERAL and not data.content:
        raise HTTPException(status_code=400, detail="General SOPs require content")

    if data.sop_type == SOPType.STEP_BY_STEP and not data.steps:
        raise HTTPException(status_code=400, detail="Step-by-step SOPs require steps")

    sop = SOP(
        organization_id=current_user.organization_id,
        name=data.name,
        description=data.description,
        sop_type=data.sop_type,
        content=data.content,
        steps=data.steps,
        queue_ids=[ObjectId(q) for q in data.queue_ids if ObjectId.is_valid(q)],
        match_keywords=data.match_keywords
    )

    await db.sops.insert_one(sop.model_dump_mongo())

    return serialize_sop(sop.model_dump_mongo())


@router.patch("/{sop_id}")
async def update_sop(
    sop_id: str,
    data: SOPUpdate,
    current_user: User = Depends(get_current_user)
) -> dict:
    """Update an SOP. Creates a new version."""
    db = get_database()

    if not ObjectId.is_valid(sop_id):
        raise HTTPException(status_code=400, detail="Invalid SOP ID")

    # Get current SOP
    current = await db.sops.find_one({
        "_id": ObjectId(sop_id),
        "organization_id": current_user.organization_id
    })

    if not current:
        raise HTTPException(status_code=404, detail="SOP not found")

    update_data = data.model_dump(exclude_unset=True)
    if not update_data:
        raise HTTPException(status_code=400, detail="No fields to update")

    # Convert queue_ids
    if "queue_ids" in update_data:
        update_data["queue_ids"] = [
            ObjectId(q) for q in update_data["queue_ids"] if ObjectId.is_valid(q)
        ]

    # Increment version
    update_data["version"] = current.get("version", 1) + 1

    result = await db.sops.find_one_and_update(
        {"_id": ObjectId(sop_id)},
        {"$set": update_data},
        return_document=True
    )

    return serialize_sop(result)


@router.delete("/{sop_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_sop(
    sop_id: str,
    current_user: User = Depends(get_current_user)
):
    """Delete an SOP (soft delete by deactivating)."""
    db = get_database()

    if not ObjectId.is_valid(sop_id):
        raise HTTPException(status_code=400, detail="Invalid SOP ID")

    result = await db.sops.find_one_and_update(
        {
            "_id": ObjectId(sop_id),
            "organization_id": current_user.organization_id
        },
        {"$set": {"is_active": False}},
        return_document=True
    )

    if not result:
        raise HTTPException(status_code=404, detail="SOP not found")


@router.post("/{sop_id}/duplicate")
async def duplicate_sop(
    sop_id: str,
    new_name: str | None = None,
    current_user: User = Depends(get_current_user)
) -> dict:
    """Duplicate an SOP."""
    db = get_database()

    if not ObjectId.is_valid(sop_id):
        raise HTTPException(status_code=400, detail="Invalid SOP ID")

    original = await db.sops.find_one({
        "_id": ObjectId(sop_id),
        "organization_id": current_user.organization_id
    })

    if not original:
        raise HTTPException(status_code=404, detail="SOP not found")

    # Create copy
    new_sop = SOP(
        organization_id=current_user.organization_id,
        name=new_name or f"{original['name']} (Copy)",
        description=original.get("description"),
        sop_type=original["sop_type"],
        content=original.get("content"),
        steps=original.get("steps", []),
        queue_ids=original.get("queue_ids", []),
        match_keywords=original.get("match_keywords", []),
        version=1,
        is_active=True
    )

    await db.sops.insert_one(new_sop.model_dump_mongo())

    return serialize_sop(new_sop.model_dump_mongo())
