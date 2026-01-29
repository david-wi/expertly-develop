from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, status
from bson import ObjectId

from app.database import get_database
from app.models import (
    BacklogItem, BacklogItemCreate, BacklogItemUpdate,
    BacklogStatus, BacklogPriority, BacklogCategory, User
)
from app.api.deps import get_current_user

router = APIRouter()


def serialize_backlog_item(item: dict) -> dict:
    """Convert ObjectIds to strings in backlog item document."""
    result = {**item, "_id": str(item["_id"]), "id": str(item["_id"])}
    for field in ["organization_id", "created_by"]:
        if item.get(field):
            result[field] = str(item[field])
    return result


@router.get("")
async def list_backlog_items(
    category: str | None = None,
    status: str | None = None,
    priority: str | None = None,
    current_user: User = Depends(get_current_user)
) -> list[dict]:
    """List backlog items in the current organization."""
    db = get_database()

    query = {"organization_id": current_user.organization_id}

    if category:
        query["category"] = category
    if status:
        query["status"] = status
    if priority:
        query["priority"] = priority

    cursor = db.backlog_items.find(query).sort("created_at", -1)
    items = await cursor.to_list(1000)

    return [serialize_backlog_item(item) for item in items]


@router.get("/{item_id}")
async def get_backlog_item(
    item_id: str,
    current_user: User = Depends(get_current_user)
) -> dict:
    """Get a specific backlog item."""
    db = get_database()

    if not ObjectId.is_valid(item_id):
        raise HTTPException(status_code=400, detail="Invalid item ID")

    item = await db.backlog_items.find_one({
        "_id": ObjectId(item_id),
        "organization_id": current_user.organization_id
    })

    if not item:
        raise HTTPException(status_code=404, detail="Backlog item not found")

    return serialize_backlog_item(item)


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_backlog_item(
    data: BacklogItemCreate,
    current_user: User = Depends(get_current_user)
) -> dict:
    """Create a new backlog item."""
    db = get_database()

    item = BacklogItem(
        organization_id=current_user.organization_id,
        title=data.title,
        description=data.description,
        status=data.status or BacklogStatus.NEW,
        priority=data.priority or BacklogPriority.MEDIUM,
        category=data.category or BacklogCategory.BACKLOG,
        tags=data.tags or [],
        created_by=current_user.id
    )

    await db.backlog_items.insert_one(item.model_dump_mongo())

    return serialize_backlog_item(item.model_dump_mongo())


@router.patch("/{item_id}")
async def update_backlog_item(
    item_id: str,
    data: BacklogItemUpdate,
    current_user: User = Depends(get_current_user)
) -> dict:
    """Update a backlog item."""
    db = get_database()

    if not ObjectId.is_valid(item_id):
        raise HTTPException(status_code=400, detail="Invalid item ID")

    update_data = data.model_dump(exclude_unset=True)
    if not update_data:
        raise HTTPException(status_code=400, detail="No fields to update")

    update_data["updated_at"] = datetime.now(timezone.utc)

    result = await db.backlog_items.find_one_and_update(
        {"_id": ObjectId(item_id), "organization_id": current_user.organization_id},
        {"$set": update_data},
        return_document=True
    )

    if not result:
        raise HTTPException(status_code=404, detail="Backlog item not found")

    return serialize_backlog_item(result)


@router.delete("/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_backlog_item(
    item_id: str,
    current_user: User = Depends(get_current_user)
):
    """Delete a backlog item."""
    db = get_database()

    if not ObjectId.is_valid(item_id):
        raise HTTPException(status_code=400, detail="Invalid item ID")

    result = await db.backlog_items.delete_one({
        "_id": ObjectId(item_id),
        "organization_id": current_user.organization_id
    })

    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Backlog item not found")


# Convenience endpoints for ideas (filtered backlog items)
@router.get("/ideas/list")
async def list_ideas(
    status: str | None = None,
    priority: str | None = None,
    current_user: User = Depends(get_current_user)
) -> list[dict]:
    """List idea backlog items."""
    db = get_database()

    query = {
        "organization_id": current_user.organization_id,
        "category": BacklogCategory.IDEA
    }

    if status:
        query["status"] = status
    if priority:
        query["priority"] = priority

    cursor = db.backlog_items.find(query).sort("created_at", -1)
    items = await cursor.to_list(1000)

    return [serialize_backlog_item(item) for item in items]


@router.post("/ideas", status_code=status.HTTP_201_CREATED)
async def create_idea(
    data: BacklogItemCreate,
    current_user: User = Depends(get_current_user)
) -> dict:
    """Create a new idea."""
    db = get_database()

    item = BacklogItem(
        organization_id=current_user.organization_id,
        title=data.title,
        description=data.description,
        status=data.status or BacklogStatus.NEW,
        priority=data.priority or BacklogPriority.MEDIUM,
        category=BacklogCategory.IDEA,  # Force idea category
        tags=data.tags or [],
        created_by=current_user.id
    )

    await db.backlog_items.insert_one(item.model_dump_mongo())

    return serialize_backlog_item(item.model_dump_mongo())
