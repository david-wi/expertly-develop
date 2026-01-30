from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Form
from fastapi.responses import FileResponse
from bson import ObjectId
from typing import Optional
import os
import uuid
import aiofiles

from app.database import get_database
from app.models import (
    TaskAttachment, TaskAttachmentCreate, TaskAttachmentResponse, AttachmentType,
    User
)
from app.api.deps import get_current_user
from app.config import get_settings

router = APIRouter()
settings = get_settings()

# Base directory for task attachments
UPLOADS_BASE_DIR = "/opt/expertly-develop/uploads/manage/tasks"


def get_task_storage_dir(task_id: str) -> str:
    """Get the storage directory for a task's attachments."""
    return os.path.join(UPLOADS_BASE_DIR, task_id)


def serialize_attachment(attachment: dict) -> dict:
    """Convert ObjectIds to strings in attachment document."""
    result = {
        "id": str(attachment["_id"]),
        "task_id": str(attachment["task_id"]),
        "organization_id": str(attachment["organization_id"]),
        "attachment_type": attachment["attachment_type"],
        "filename": attachment.get("filename"),
        "original_filename": attachment.get("original_filename"),
        "mime_type": attachment.get("mime_type"),
        "size_bytes": attachment.get("size_bytes"),
        "url": attachment.get("url"),
        "link_title": attachment.get("link_title"),
        "note": attachment.get("note"),
        "uploaded_by_id": str(attachment["uploaded_by_id"]),
        "created_at": attachment["created_at"],
    }
    return result


@router.get("/tasks/{task_id}/attachments")
async def list_task_attachments(
    task_id: str,
    current_user: User = Depends(get_current_user)
) -> list[dict]:
    """List all attachments for a task."""
    db = get_database()

    if not ObjectId.is_valid(task_id):
        raise HTTPException(status_code=400, detail="Invalid task ID")

    # Verify task exists and user has access
    task = await db.tasks.find_one({
        "_id": ObjectId(task_id),
        "organization_id": current_user.organization_id
    })
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    cursor = db.task_attachments.find({
        "task_id": ObjectId(task_id),
        "deleted_at": None
    }).sort("created_at", -1)

    attachments = await cursor.to_list(100)
    return [serialize_attachment(a) for a in attachments]


@router.post("/tasks/{task_id}/attachments/upload", status_code=status.HTTP_201_CREATED)
async def upload_task_attachment(
    task_id: str,
    file: UploadFile = File(...),
    note: Optional[str] = Form(None),
    current_user: User = Depends(get_current_user)
) -> dict:
    """Upload a file attachment to a task."""
    db = get_database()

    if not ObjectId.is_valid(task_id):
        raise HTTPException(status_code=400, detail="Invalid task ID")

    # Verify task exists and user has access
    task = await db.tasks.find_one({
        "_id": ObjectId(task_id),
        "organization_id": current_user.organization_id
    })
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    # Create storage directory
    storage_dir = get_task_storage_dir(task_id)
    os.makedirs(storage_dir, exist_ok=True)

    # Generate unique filename
    ext = os.path.splitext(file.filename)[1] if file.filename else ""
    unique_filename = f"{uuid.uuid4()}{ext}"
    file_path = os.path.join(storage_dir, unique_filename)

    # Save file
    content = await file.read()
    async with aiofiles.open(file_path, "wb") as f:
        await f.write(content)

    # Create attachment record
    attachment = TaskAttachment(
        task_id=ObjectId(task_id),
        organization_id=current_user.organization_id,
        attachment_type=AttachmentType.FILE,
        filename=unique_filename,
        original_filename=file.filename,
        mime_type=file.content_type,
        size_bytes=len(content),
        storage_path=file_path,
        note=note,
        uploaded_by_id=current_user.id,
    )

    await db.task_attachments.insert_one(attachment.model_dump_mongo())

    return serialize_attachment(attachment.model_dump_mongo())


@router.post("/tasks/{task_id}/attachments/link", status_code=status.HTTP_201_CREATED)
async def add_task_link(
    task_id: str,
    data: TaskAttachmentCreate,
    current_user: User = Depends(get_current_user)
) -> dict:
    """Add a link attachment to a task."""
    db = get_database()

    if not ObjectId.is_valid(task_id):
        raise HTTPException(status_code=400, detail="Invalid task ID")

    # Verify task exists and user has access
    task = await db.tasks.find_one({
        "_id": ObjectId(task_id),
        "organization_id": current_user.organization_id
    })
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    # Create attachment record
    attachment = TaskAttachment(
        task_id=ObjectId(task_id),
        organization_id=current_user.organization_id,
        attachment_type=AttachmentType.LINK,
        url=data.url,
        link_title=data.link_title,
        note=data.note,
        uploaded_by_id=current_user.id,
    )

    await db.task_attachments.insert_one(attachment.model_dump_mongo())

    return serialize_attachment(attachment.model_dump_mongo())


@router.get("/attachments/{attachment_id}")
async def get_attachment(
    attachment_id: str,
    current_user: User = Depends(get_current_user)
) -> dict:
    """Get a specific attachment."""
    db = get_database()

    if not ObjectId.is_valid(attachment_id):
        raise HTTPException(status_code=400, detail="Invalid attachment ID")

    attachment = await db.task_attachments.find_one({
        "_id": ObjectId(attachment_id),
        "organization_id": current_user.organization_id,
        "deleted_at": None
    })

    if not attachment:
        raise HTTPException(status_code=404, detail="Attachment not found")

    return serialize_attachment(attachment)


@router.get("/attachments/{attachment_id}/download")
async def download_attachment(
    attachment_id: str,
    current_user: User = Depends(get_current_user)
):
    """Download a file attachment."""
    db = get_database()

    if not ObjectId.is_valid(attachment_id):
        raise HTTPException(status_code=400, detail="Invalid attachment ID")

    attachment = await db.task_attachments.find_one({
        "_id": ObjectId(attachment_id),
        "organization_id": current_user.organization_id,
        "deleted_at": None
    })

    if not attachment:
        raise HTTPException(status_code=404, detail="Attachment not found")

    if attachment["attachment_type"] != AttachmentType.FILE.value:
        raise HTTPException(status_code=400, detail="Attachment is not a file")

    storage_path = attachment.get("storage_path")
    if not storage_path or not os.path.exists(storage_path):
        raise HTTPException(status_code=404, detail="File not found on storage")

    return FileResponse(
        path=storage_path,
        filename=attachment.get("original_filename") or attachment.get("filename"),
        media_type=attachment.get("mime_type") or "application/octet-stream"
    )


@router.delete("/attachments/{attachment_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_attachment(
    attachment_id: str,
    current_user: User = Depends(get_current_user)
):
    """Delete an attachment (soft delete)."""
    db = get_database()

    if not ObjectId.is_valid(attachment_id):
        raise HTTPException(status_code=400, detail="Invalid attachment ID")

    now = datetime.now(timezone.utc)

    result = await db.task_attachments.find_one_and_update(
        {
            "_id": ObjectId(attachment_id),
            "organization_id": current_user.organization_id,
            "deleted_at": None
        },
        {
            "$set": {
                "deleted_at": now,
                "updated_at": now
            }
        }
    )

    if not result:
        raise HTTPException(status_code=404, detail="Attachment not found")
