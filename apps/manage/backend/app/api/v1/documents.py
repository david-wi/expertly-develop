from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, status, Query
from bson import ObjectId
from typing import Optional

from app.database import get_database
from app.models.document import (
    Document, DocumentCreate, DocumentUpdate, DocumentHistoryEntry
)
from app.models import User
from app.api.deps import get_current_user

router = APIRouter()


def serialize_document(doc: dict, include_history: bool = False) -> dict:
    """Convert ObjectIds to strings in Document."""
    result = {**doc}
    result["id"] = str(doc["_id"])
    del result["_id"]
    result["organization_id"] = str(doc["organization_id"])

    if doc.get("project_id"):
        result["project_id"] = str(doc["project_id"])
    if doc.get("task_id"):
        result["task_id"] = str(doc["task_id"])
    if doc.get("created_by"):
        result["created_by"] = str(doc["created_by"])
    if doc.get("updated_by"):
        result["updated_by"] = str(doc["updated_by"])

    # Exclude history by default for list operations
    if not include_history:
        result.pop("history", None)

    return result


@router.get("")
async def list_documents(
    project_id: Optional[str] = Query(None, description="Filter by project"),
    task_id: Optional[str] = Query(None, description="Filter by task"),
    purpose: Optional[str] = Query(None, description="Filter by document purpose"),
    current_user: User = Depends(get_current_user)
) -> list[dict]:
    """List documents. At least one filter (project_id or task_id) is recommended."""
    db = get_database()

    query = {
        "organization_id": current_user.organization_id,
        "deleted_at": None
    }

    if project_id:
        if not ObjectId.is_valid(project_id):
            raise HTTPException(status_code=400, detail="Invalid project ID")
        query["project_id"] = ObjectId(project_id)

    if task_id:
        if not ObjectId.is_valid(task_id):
            raise HTTPException(status_code=400, detail="Invalid task ID")
        query["task_id"] = ObjectId(task_id)

    if purpose:
        query["purpose"] = purpose

    cursor = db.documents.find(query).sort("created_at", -1)
    documents = await cursor.to_list(500)

    return [serialize_document(doc) for doc in documents]


@router.get("/{document_id}")
async def get_document(
    document_id: str,
    include_history: bool = Query(False, description="Include version history"),
    current_user: User = Depends(get_current_user)
) -> dict:
    """Get a specific document."""
    db = get_database()

    if not ObjectId.is_valid(document_id):
        raise HTTPException(status_code=400, detail="Invalid document ID")

    doc = await db.documents.find_one({
        "_id": ObjectId(document_id),
        "organization_id": current_user.organization_id,
        "deleted_at": None
    })

    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    return serialize_document(doc, include_history=include_history)


@router.get("/{document_id}/version/{version}")
async def get_document_version(
    document_id: str,
    version: int,
    current_user: User = Depends(get_current_user)
) -> dict:
    """Get a specific version of a document from its history."""
    db = get_database()

    if not ObjectId.is_valid(document_id):
        raise HTTPException(status_code=400, detail="Invalid document ID")

    doc = await db.documents.find_one({
        "_id": ObjectId(document_id),
        "organization_id": current_user.organization_id,
        "deleted_at": None
    })

    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    # If requesting current version, return the document
    if version == doc.get("version", 1):
        return {
            "version": version,
            "title": doc["title"],
            "description": doc.get("description"),
            "content": doc.get("content"),
            "changed_at": doc.get("updated_at"),
            "changed_by": str(doc["updated_by"]) if doc.get("updated_by") else None,
            "is_current": True
        }

    # Find in history
    history = doc.get("history", [])
    for entry in history:
        if entry.get("version") == version:
            return {
                **entry,
                "changed_by": str(entry["changed_by"]) if entry.get("changed_by") else None,
                "is_current": False
            }

    raise HTTPException(status_code=404, detail=f"Version {version} not found")


@router.get("/{document_id}/history")
async def get_document_history(
    document_id: str,
    current_user: User = Depends(get_current_user)
) -> list[dict]:
    """Get the version history of a document."""
    db = get_database()

    if not ObjectId.is_valid(document_id):
        raise HTTPException(status_code=400, detail="Invalid document ID")

    doc = await db.documents.find_one({
        "_id": ObjectId(document_id),
        "organization_id": current_user.organization_id,
        "deleted_at": None
    })

    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    # Build history including current version
    history = []

    # Add historical versions
    for entry in doc.get("history", []):
        history.append({
            **entry,
            "changed_by": str(entry["changed_by"]) if entry.get("changed_by") else None,
            "is_current": False
        })

    # Add current version
    history.append({
        "version": doc.get("version", 1),
        "title": doc["title"],
        "description": doc.get("description"),
        "content": doc.get("content"),
        "changed_at": doc.get("updated_at"),
        "changed_by": str(doc["updated_by"]) if doc.get("updated_by") else None,
        "is_current": True
    })

    # Sort by version descending
    history.sort(key=lambda x: x.get("version", 0), reverse=True)

    return history


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_document(
    data: DocumentCreate,
    current_user: User = Depends(get_current_user)
) -> dict:
    """Create a new document."""
    db = get_database()

    # Validate project_id if provided
    project_id = None
    if data.project_id:
        if not ObjectId.is_valid(data.project_id):
            raise HTTPException(status_code=400, detail="Invalid project ID")
        project_id = ObjectId(data.project_id)
        # Verify project exists
        project = await db.projects.find_one({
            "_id": project_id,
            "organization_id": current_user.organization_id
        })
        if not project:
            raise HTTPException(status_code=404, detail="Project not found")

    # Validate task_id if provided
    task_id = None
    if data.task_id:
        if not ObjectId.is_valid(data.task_id):
            raise HTTPException(status_code=400, detail="Invalid task ID")
        task_id = ObjectId(data.task_id)
        # Verify task exists
        task = await db.tasks.find_one({
            "_id": task_id,
            "organization_id": current_user.organization_id
        })
        if not task:
            raise HTTPException(status_code=404, detail="Task not found")

    document = Document(
        organization_id=current_user.organization_id,
        title=data.title,
        description=data.description,
        content=data.content,
        purpose=data.purpose,
        project_id=project_id,
        task_id=task_id,
        external_url=data.external_url,
        external_title=data.external_title,
        created_by=str(current_user.id),
        updated_by=str(current_user.id)
    )

    await db.documents.insert_one(document.model_dump_mongo())

    return serialize_document(document.model_dump_mongo())


@router.patch("/{document_id}")
async def update_document(
    document_id: str,
    data: DocumentUpdate,
    current_user: User = Depends(get_current_user)
) -> dict:
    """Update a document. Content changes are tracked in version history."""
    db = get_database()

    if not ObjectId.is_valid(document_id):
        raise HTTPException(status_code=400, detail="Invalid document ID")

    current = await db.documents.find_one({
        "_id": ObjectId(document_id),
        "organization_id": current_user.organization_id,
        "deleted_at": None
    })

    if not current:
        raise HTTPException(status_code=404, detail="Document not found")

    update_data = data.model_dump(exclude_unset=True)
    if not update_data:
        raise HTTPException(status_code=400, detail="No fields to update")

    # Check if content-related fields changed (triggers version history)
    content_changed = any(
        field in update_data and update_data[field] != current.get(field)
        for field in ["title", "description", "content"]
    )

    # Validate project_id if provided
    if "project_id" in update_data:
        if update_data["project_id"]:
            if not ObjectId.is_valid(update_data["project_id"]):
                raise HTTPException(status_code=400, detail="Invalid project ID")
            project_id = ObjectId(update_data["project_id"])
            project = await db.projects.find_one({
                "_id": project_id,
                "organization_id": current_user.organization_id
            })
            if not project:
                raise HTTPException(status_code=404, detail="Project not found")
            update_data["project_id"] = project_id
        else:
            update_data["project_id"] = None

    # Validate task_id if provided
    if "task_id" in update_data:
        if update_data["task_id"]:
            if not ObjectId.is_valid(update_data["task_id"]):
                raise HTTPException(status_code=400, detail="Invalid task ID")
            task_id = ObjectId(update_data["task_id"])
            task = await db.tasks.find_one({
                "_id": task_id,
                "organization_id": current_user.organization_id
            })
            if not task:
                raise HTTPException(status_code=404, detail="Task not found")
            update_data["task_id"] = task_id
        else:
            update_data["task_id"] = None

    # If content changed, create history entry
    if content_changed:
        history_entry = DocumentHistoryEntry(
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

    result = await db.documents.find_one_and_update(
        {"_id": ObjectId(document_id)},
        update_op,
        return_document=True
    )

    return serialize_document(result)


@router.delete("/{document_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_document(
    document_id: str,
    current_user: User = Depends(get_current_user)
):
    """Soft delete a document."""
    db = get_database()

    if not ObjectId.is_valid(document_id):
        raise HTTPException(status_code=400, detail="Invalid document ID")

    doc = await db.documents.find_one({
        "_id": ObjectId(document_id),
        "organization_id": current_user.organization_id,
        "deleted_at": None
    })

    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    await db.documents.find_one_and_update(
        {"_id": ObjectId(document_id)},
        {"$set": {"deleted_at": datetime.now(timezone.utc)}}
    )


@router.post("/{document_id}/restore", status_code=status.HTTP_200_OK)
async def restore_document(
    document_id: str,
    current_user: User = Depends(get_current_user)
) -> dict:
    """Restore a soft-deleted document."""
    db = get_database()

    if not ObjectId.is_valid(document_id):
        raise HTTPException(status_code=400, detail="Invalid document ID")

    # Find document including deleted ones
    doc = await db.documents.find_one({
        "_id": ObjectId(document_id),
        "organization_id": current_user.organization_id
    })

    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    if not doc.get("deleted_at"):
        raise HTTPException(status_code=400, detail="Document is not deleted")

    result = await db.documents.find_one_and_update(
        {"_id": ObjectId(document_id)},
        {
            "$set": {
                "deleted_at": None,
                "updated_at": datetime.now(timezone.utc),
                "updated_by": str(current_user.id)
            }
        },
        return_document=True
    )

    return serialize_document(result)


@router.post("/{document_id}/revert/{version}")
async def revert_to_version(
    document_id: str,
    version: int,
    current_user: User = Depends(get_current_user)
) -> dict:
    """Revert document to a specific version from history."""
    db = get_database()

    if not ObjectId.is_valid(document_id):
        raise HTTPException(status_code=400, detail="Invalid document ID")

    doc = await db.documents.find_one({
        "_id": ObjectId(document_id),
        "organization_id": current_user.organization_id,
        "deleted_at": None
    })

    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    current_version = doc.get("version", 1)
    if version >= current_version:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot revert to version {version}. Current version is {current_version}."
        )

    # Find the version in history
    history = doc.get("history", [])
    target_entry = None
    for entry in history:
        if entry.get("version") == version:
            target_entry = entry
            break

    if not target_entry:
        raise HTTPException(status_code=404, detail=f"Version {version} not found in history")

    # Create history entry for current version before reverting
    history_entry = DocumentHistoryEntry(
        version=current_version,
        title=doc["title"],
        description=doc.get("description"),
        content=doc.get("content"),
        changed_at=datetime.now(timezone.utc),
        changed_by=str(current_user.id)
    )

    # Update document with content from historical version
    result = await db.documents.find_one_and_update(
        {"_id": ObjectId(document_id)},
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

    return serialize_document(result)
