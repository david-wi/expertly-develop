from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, status, Query
from bson import ObjectId
from typing import Optional

from app.database import get_database
from app.models.dashboard_note import (
    DashboardNote, DashboardNoteCreate, DashboardNoteUpdate, DashboardNoteHistoryEntry
)
from app.models import User
from app.api.deps import get_current_user

router = APIRouter()


def serialize_dashboard_note(doc: dict, include_history: bool = False) -> dict:
    """Convert ObjectIds to strings in DashboardNote."""
    result = {**doc}
    result["id"] = str(doc["_id"])
    del result["_id"]
    result["organization_id"] = str(doc["organization_id"])
    result["user_id"] = str(doc["user_id"])

    if doc.get("created_by"):
        result["created_by"] = str(doc["created_by"])
    if doc.get("updated_by"):
        result["updated_by"] = str(doc["updated_by"])

    # Exclude history by default for list operations
    if not include_history:
        result.pop("history", None)

    return result


@router.get("")
async def list_dashboard_notes(
    include_all: bool = Query(False, description="Include notes from all users (admin only)"),
    current_user: User = Depends(get_current_user)
) -> list[dict]:
    """List dashboard notes for the current user."""
    db = get_database()

    query = {
        "organization_id": current_user.organization_id,
        "deleted_at": None
    }

    # By default, only show user's own notes
    if not include_all:
        query["user_id"] = str(current_user.id)

    cursor = db.dashboard_notes.find(query).sort("created_at", -1)
    notes = await cursor.to_list(500)

    return [serialize_dashboard_note(note) for note in notes]


@router.get("/{note_id}")
async def get_dashboard_note(
    note_id: str,
    include_history: bool = Query(False, description="Include version history"),
    current_user: User = Depends(get_current_user)
) -> dict:
    """Get a specific dashboard note."""
    db = get_database()

    if not ObjectId.is_valid(note_id):
        raise HTTPException(status_code=400, detail="Invalid note ID")

    note = await db.dashboard_notes.find_one({
        "_id": ObjectId(note_id),
        "organization_id": current_user.organization_id,
        "deleted_at": None
    })

    if not note:
        raise HTTPException(status_code=404, detail="Dashboard note not found")

    return serialize_dashboard_note(note, include_history=include_history)


@router.get("/{note_id}/version/{version}")
async def get_dashboard_note_version(
    note_id: str,
    version: int,
    current_user: User = Depends(get_current_user)
) -> dict:
    """Get a specific version of a dashboard note from its history."""
    db = get_database()

    if not ObjectId.is_valid(note_id):
        raise HTTPException(status_code=400, detail="Invalid note ID")

    note = await db.dashboard_notes.find_one({
        "_id": ObjectId(note_id),
        "organization_id": current_user.organization_id,
        "deleted_at": None
    })

    if not note:
        raise HTTPException(status_code=404, detail="Dashboard note not found")

    # If requesting current version, return the note
    if version == note.get("version", 1):
        return {
            "version": version,
            "title": note["title"],
            "description": note.get("description"),
            "content": note.get("content"),
            "changed_at": note.get("updated_at"),
            "changed_by": str(note["updated_by"]) if note.get("updated_by") else None,
            "is_current": True
        }

    # Find in history
    history = note.get("history", [])
    for entry in history:
        if entry.get("version") == version:
            return {
                **entry,
                "changed_by": str(entry["changed_by"]) if entry.get("changed_by") else None,
                "is_current": False
            }

    raise HTTPException(status_code=404, detail=f"Version {version} not found")


@router.get("/{note_id}/history")
async def get_dashboard_note_history(
    note_id: str,
    current_user: User = Depends(get_current_user)
) -> list[dict]:
    """Get the version history of a dashboard note."""
    db = get_database()

    if not ObjectId.is_valid(note_id):
        raise HTTPException(status_code=400, detail="Invalid note ID")

    note = await db.dashboard_notes.find_one({
        "_id": ObjectId(note_id),
        "organization_id": current_user.organization_id,
        "deleted_at": None
    })

    if not note:
        raise HTTPException(status_code=404, detail="Dashboard note not found")

    # Build history including current version
    history = []

    # Add historical versions
    for entry in note.get("history", []):
        history.append({
            **entry,
            "changed_by": str(entry["changed_by"]) if entry.get("changed_by") else None,
            "is_current": False
        })

    # Add current version
    history.append({
        "version": note.get("version", 1),
        "title": note["title"],
        "description": note.get("description"),
        "content": note.get("content"),
        "changed_at": note.get("updated_at"),
        "changed_by": str(note["updated_by"]) if note.get("updated_by") else None,
        "is_current": True
    })

    # Sort by version descending
    history.sort(key=lambda x: x.get("version", 0), reverse=True)

    return history


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_dashboard_note(
    data: DashboardNoteCreate,
    current_user: User = Depends(get_current_user)
) -> dict:
    """Create a new dashboard note."""
    db = get_database()

    note = DashboardNote(
        organization_id=current_user.organization_id,
        user_id=str(current_user.id),
        title=data.title,
        description=data.description,
        content=data.content,
        created_by=str(current_user.id),
        updated_by=str(current_user.id)
    )

    await db.dashboard_notes.insert_one(note.model_dump_mongo())

    return serialize_dashboard_note(note.model_dump_mongo())


@router.patch("/{note_id}")
async def update_dashboard_note(
    note_id: str,
    data: DashboardNoteUpdate,
    current_user: User = Depends(get_current_user)
) -> dict:
    """Update a dashboard note. Content changes are tracked in version history."""
    db = get_database()

    if not ObjectId.is_valid(note_id):
        raise HTTPException(status_code=400, detail="Invalid note ID")

    current = await db.dashboard_notes.find_one({
        "_id": ObjectId(note_id),
        "organization_id": current_user.organization_id,
        "deleted_at": None
    })

    if not current:
        raise HTTPException(status_code=404, detail="Dashboard note not found")

    # Check user owns this note
    if current.get("user_id") != str(current_user.id):
        raise HTTPException(status_code=403, detail="You can only edit your own notes")

    update_data = data.model_dump(exclude_unset=True)
    if not update_data:
        raise HTTPException(status_code=400, detail="No fields to update")

    # Check if content-related fields changed (triggers version history)
    content_changed = any(
        field in update_data and update_data[field] != current.get(field)
        for field in ["title", "description", "content"]
    )

    # If content changed, create history entry
    if content_changed:
        history_entry = DashboardNoteHistoryEntry(
            version=current.get("version", 1),
            title=current["title"],
            description=current.get("description"),
            content=current.get("content"),
            changed_at=datetime.now(timezone.utc),
            changed_by=str(current_user.id)
        )
        update_data["version"] = current.get("version", 1) + 1

    update_data["updated_at"] = datetime.now(timezone.utc)
    update_data["updated_by"] = str(current_user.id)

    # Build update operation
    update_op = {"$set": update_data}
    if content_changed:
        update_op["$push"] = {"history": history_entry.model_dump()}

    result = await db.dashboard_notes.find_one_and_update(
        {"_id": ObjectId(note_id)},
        update_op,
        return_document=True
    )

    return serialize_dashboard_note(result)


@router.delete("/{note_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_dashboard_note(
    note_id: str,
    current_user: User = Depends(get_current_user)
):
    """Soft delete a dashboard note."""
    db = get_database()

    if not ObjectId.is_valid(note_id):
        raise HTTPException(status_code=400, detail="Invalid note ID")

    note = await db.dashboard_notes.find_one({
        "_id": ObjectId(note_id),
        "organization_id": current_user.organization_id,
        "deleted_at": None
    })

    if not note:
        raise HTTPException(status_code=404, detail="Dashboard note not found")

    # Check user owns this note
    if note.get("user_id") != str(current_user.id):
        raise HTTPException(status_code=403, detail="You can only delete your own notes")

    await db.dashboard_notes.find_one_and_update(
        {"_id": ObjectId(note_id)},
        {"$set": {"deleted_at": datetime.now(timezone.utc)}}
    )


@router.post("/{note_id}/revert/{version}")
async def revert_to_version(
    note_id: str,
    version: int,
    current_user: User = Depends(get_current_user)
) -> dict:
    """Revert dashboard note to a specific version from history."""
    db = get_database()

    if not ObjectId.is_valid(note_id):
        raise HTTPException(status_code=400, detail="Invalid note ID")

    note = await db.dashboard_notes.find_one({
        "_id": ObjectId(note_id),
        "organization_id": current_user.organization_id,
        "deleted_at": None
    })

    if not note:
        raise HTTPException(status_code=404, detail="Dashboard note not found")

    # Check user owns this note
    if note.get("user_id") != str(current_user.id):
        raise HTTPException(status_code=403, detail="You can only revert your own notes")

    current_version = note.get("version", 1)
    if version >= current_version:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot revert to version {version}. Current version is {current_version}."
        )

    # Find the version in history
    history = note.get("history", [])
    target_entry = None
    for entry in history:
        if entry.get("version") == version:
            target_entry = entry
            break

    if not target_entry:
        raise HTTPException(status_code=404, detail=f"Version {version} not found in history")

    # Create history entry for current version before reverting
    history_entry = DashboardNoteHistoryEntry(
        version=current_version,
        title=note["title"],
        description=note.get("description"),
        content=note.get("content"),
        changed_at=datetime.now(timezone.utc),
        changed_by=str(current_user.id)
    )

    # Update note with content from historical version
    result = await db.dashboard_notes.find_one_and_update(
        {"_id": ObjectId(note_id)},
        {
            "$set": {
                "title": target_entry["title"],
                "description": target_entry.get("description"),
                "content": target_entry.get("content"),
                "version": current_version + 1,
                "updated_at": datetime.now(timezone.utc),
                "updated_by": str(current_user.id)
            },
            "$push": {"history": history_entry.model_dump()}
        },
        return_document=True
    )

    return serialize_dashboard_note(result)
