from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, status
from bson import ObjectId

from app.database import get_database
from app.models import Playbook, PlaybookCreate, PlaybookUpdate, PlaybookHistoryEntry, User, ScopeType
from app.api.deps import get_current_user

router = APIRouter()


def serialize_playbook(playbook: dict) -> dict:
    """Convert ObjectIds to strings in Playbook document."""
    result = {**playbook}
    # _id is already a string UUID for playbooks
    result["id"] = result.pop("_id")
    result["organization_id"] = str(playbook["organization_id"])
    if playbook.get("scope_id"):
        result["scope_id"] = str(playbook["scope_id"])
    if playbook.get("created_by"):
        result["created_by"] = str(playbook["created_by"])
    return result


def can_access_playbook(playbook: dict, user: User) -> bool:
    """Check if user can access a playbook based on its scope."""
    scope_type = playbook.get("scope_type", "organization")
    scope_id = playbook.get("scope_id")

    if scope_type == ScopeType.ORGANIZATION:
        return True  # Everyone in org can access
    elif scope_type == ScopeType.USER:
        return str(scope_id) == str(user.id)  # Only the owner
    elif scope_type == ScopeType.TEAM:
        # Check if user is in the team
        # For now, allow access - team membership check can be added later
        return True
    return False


@router.get("")
async def list_playbooks(
    scope_type: str | None = None,
    active_only: bool = True,
    current_user: User = Depends(get_current_user)
) -> list[dict]:
    """List playbooks accessible to the current user."""
    db = get_database()

    # Base query - same organization
    query = {"organization_id": current_user.organization_id}

    if active_only:
        query["is_active"] = True

    if scope_type:
        query["scope_type"] = scope_type

    cursor = db.playbooks.find(query).sort("name", 1)
    playbooks = await cursor.to_list(100)

    # Filter to only accessible playbooks
    accessible = []
    for pb in playbooks:
        if can_access_playbook(pb, current_user):
            accessible.append(serialize_playbook(pb))

    return accessible


@router.get("/{playbook_id}")
async def get_playbook(
    playbook_id: str,
    current_user: User = Depends(get_current_user)
) -> dict:
    """Get a specific playbook."""
    db = get_database()

    playbook = await db.playbooks.find_one({
        "_id": playbook_id,
        "organization_id": current_user.organization_id
    })

    if not playbook:
        raise HTTPException(status_code=404, detail="Playbook not found")

    if not can_access_playbook(playbook, current_user):
        raise HTTPException(status_code=403, detail="Access denied to this playbook")

    return serialize_playbook(playbook)


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_playbook(
    data: PlaybookCreate,
    current_user: User = Depends(get_current_user)
) -> dict:
    """Create a new playbook."""
    db = get_database()

    # Validate scope_id if provided
    scope_id = None
    if data.scope_id:
        if not ObjectId.is_valid(data.scope_id):
            raise HTTPException(status_code=400, detail="Invalid scope ID")
        scope_id = ObjectId(data.scope_id)

    # For user scope, must be current user
    if data.scope_type == ScopeType.USER:
        scope_id = current_user.id

    playbook = Playbook(
        organization_id=current_user.organization_id,
        name=data.name,
        description=data.description,
        scope_type=data.scope_type,
        scope_id=scope_id,
        created_by=str(current_user.id)
    )

    await db.playbooks.insert_one(playbook.model_dump_mongo())

    return serialize_playbook(playbook.model_dump_mongo())


@router.patch("/{playbook_id}")
async def update_playbook(
    playbook_id: str,
    data: PlaybookUpdate,
    current_user: User = Depends(get_current_user)
) -> dict:
    """Update a playbook. Changes are tracked in history."""
    db = get_database()

    # Get current playbook
    current = await db.playbooks.find_one({
        "_id": playbook_id,
        "organization_id": current_user.organization_id
    })

    if not current:
        raise HTTPException(status_code=404, detail="Playbook not found")

    if not can_access_playbook(current, current_user):
        raise HTTPException(status_code=403, detail="Access denied to this playbook")

    update_data = data.model_dump(exclude_unset=True)
    if not update_data:
        raise HTTPException(status_code=400, detail="No fields to update")

    # Create history entry for the current version before updating
    history_entry = PlaybookHistoryEntry(
        version=current.get("version", 1),
        name=current["name"],
        description=current.get("description"),
        changed_at=datetime.now(timezone.utc),
        changed_by=str(current_user.id)
    )

    # Convert scope_id
    if "scope_id" in update_data and update_data["scope_id"]:
        if not ObjectId.is_valid(update_data["scope_id"]):
            raise HTTPException(status_code=400, detail="Invalid scope ID")
        update_data["scope_id"] = ObjectId(update_data["scope_id"])

    # For user scope, must be current user
    if update_data.get("scope_type") == ScopeType.USER:
        update_data["scope_id"] = current_user.id

    # Increment version and update timestamp
    update_data["version"] = current.get("version", 1) + 1
    update_data["updated_at"] = datetime.now(timezone.utc)

    # Add to history
    history = current.get("history", [])
    history.append(history_entry.model_dump())

    result = await db.playbooks.find_one_and_update(
        {"_id": playbook_id},
        {
            "$set": update_data,
            "$push": {"history": history_entry.model_dump()}
        },
        return_document=True
    )

    return serialize_playbook(result)


@router.delete("/{playbook_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_playbook(
    playbook_id: str,
    current_user: User = Depends(get_current_user)
):
    """Delete a playbook (soft delete by deactivating)."""
    db = get_database()

    playbook = await db.playbooks.find_one({
        "_id": playbook_id,
        "organization_id": current_user.organization_id
    })

    if not playbook:
        raise HTTPException(status_code=404, detail="Playbook not found")

    if not can_access_playbook(playbook, current_user):
        raise HTTPException(status_code=403, detail="Access denied to this playbook")

    await db.playbooks.find_one_and_update(
        {"_id": playbook_id},
        {"$set": {"is_active": False, "updated_at": datetime.now(timezone.utc)}}
    )


@router.post("/{playbook_id}/duplicate")
async def duplicate_playbook(
    playbook_id: str,
    new_name: str | None = None,
    current_user: User = Depends(get_current_user)
) -> dict:
    """Duplicate a playbook."""
    db = get_database()

    original = await db.playbooks.find_one({
        "_id": playbook_id,
        "organization_id": current_user.organization_id
    })

    if not original:
        raise HTTPException(status_code=404, detail="Playbook not found")

    if not can_access_playbook(original, current_user):
        raise HTTPException(status_code=403, detail="Access denied to this playbook")

    # Create copy with new UUID
    new_playbook = Playbook(
        organization_id=current_user.organization_id,
        name=new_name or f"{original['name']} (Copy)",
        description=original.get("description"),
        scope_type=original.get("scope_type", ScopeType.ORGANIZATION),
        scope_id=original.get("scope_id"),
        created_by=str(current_user.id)
    )

    await db.playbooks.insert_one(new_playbook.model_dump_mongo())

    return serialize_playbook(new_playbook.model_dump_mongo())


@router.get("/{playbook_id}/history")
async def get_playbook_history(
    playbook_id: str,
    current_user: User = Depends(get_current_user)
) -> list[dict]:
    """Get the version history of a playbook."""
    db = get_database()

    playbook = await db.playbooks.find_one({
        "_id": playbook_id,
        "organization_id": current_user.organization_id
    })

    if not playbook:
        raise HTTPException(status_code=404, detail="Playbook not found")

    if not can_access_playbook(playbook, current_user):
        raise HTTPException(status_code=403, detail="Access denied to this playbook")

    return playbook.get("history", [])
