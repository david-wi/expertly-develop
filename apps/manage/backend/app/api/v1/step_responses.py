from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Form
from bson import ObjectId
from typing import Optional
import os
import uuid
import aiofiles

from app.database import get_database
from app.models import (
    TaskStepResponse, TaskStepResponseUpdate, TaskStepResponseComplete,
    StepStatus, TaskAttachment, AttachmentType, User
)
from app.api.deps import get_current_user
from app.config import get_settings

router = APIRouter()
settings = get_settings()

# Base directory for task attachments
UPLOADS_BASE_DIR = "/opt/expertly-develop/uploads/manage/tasks"


def get_step_storage_dir(task_id: str, step_id: str) -> str:
    """Get the storage directory for a step's attachments."""
    return os.path.join(UPLOADS_BASE_DIR, task_id, "steps", step_id)


def serialize_step_response(step_response: dict) -> dict:
    """Convert ObjectIds to strings in step response document."""
    return {
        "id": str(step_response["_id"]),
        "task_id": str(step_response["task_id"]),
        "organization_id": str(step_response["organization_id"]),
        "step_id": step_response["step_id"],
        "step_order": step_response["step_order"],
        "status": step_response["status"],
        "notes": step_response.get("notes"),
        "output_data": step_response.get("output_data"),
        "completed_by_id": str(step_response["completed_by_id"]) if step_response.get("completed_by_id") else None,
        "completed_at": step_response.get("completed_at"),
        "created_at": step_response["created_at"],
        "updated_at": step_response["updated_at"],
    }


def serialize_attachment(attachment: dict) -> dict:
    """Convert ObjectIds to strings in attachment document."""
    return {
        "id": str(attachment["_id"]),
        "task_id": str(attachment["task_id"]),
        "organization_id": str(attachment["organization_id"]),
        "attachment_type": attachment["attachment_type"],
        "step_id": attachment.get("step_id"),
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


@router.get("/tasks/{task_id}/steps")
async def list_step_responses(
    task_id: str,
    current_user: User = Depends(get_current_user)
) -> list[dict]:
    """List all step responses for a task, ordered by step_order."""
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

    cursor = db.task_step_responses.find({
        "task_id": ObjectId(task_id),
    }).sort("step_order", 1)

    step_responses = await cursor.to_list(100)
    return [serialize_step_response(sr) for sr in step_responses]


@router.get("/tasks/{task_id}/steps/{step_id}")
async def get_step_response(
    task_id: str,
    step_id: str,
    current_user: User = Depends(get_current_user)
) -> dict:
    """Get a specific step response."""
    db = get_database()

    if not ObjectId.is_valid(task_id):
        raise HTTPException(status_code=400, detail="Invalid task ID")

    step_response = await db.task_step_responses.find_one({
        "task_id": ObjectId(task_id),
        "step_id": step_id,
        "organization_id": current_user.organization_id
    })

    if not step_response:
        raise HTTPException(status_code=404, detail="Step response not found")

    return serialize_step_response(step_response)


@router.patch("/tasks/{task_id}/steps/{step_id}")
async def update_step_response(
    task_id: str,
    step_id: str,
    data: TaskStepResponseUpdate,
    current_user: User = Depends(get_current_user)
) -> dict:
    """Update notes/output data for a step."""
    db = get_database()

    if not ObjectId.is_valid(task_id):
        raise HTTPException(status_code=400, detail="Invalid task ID")

    update_data = data.model_dump(exclude_unset=True)
    if not update_data:
        raise HTTPException(status_code=400, detail="No fields to update")

    update_data["updated_at"] = datetime.now(timezone.utc)

    # Also mark as in_progress if currently pending
    result = await db.task_step_responses.find_one_and_update(
        {
            "task_id": ObjectId(task_id),
            "step_id": step_id,
            "organization_id": current_user.organization_id
        },
        {
            "$set": update_data,
            "$setOnInsert": {}
        },
        return_document=True
    )

    if not result:
        raise HTTPException(status_code=404, detail="Step response not found")

    # If status is pending and we're updating, move to in_progress
    if result.get("status") == StepStatus.PENDING.value:
        result = await db.task_step_responses.find_one_and_update(
            {"_id": result["_id"]},
            {"$set": {"status": StepStatus.IN_PROGRESS.value}},
            return_document=True
        )

    return serialize_step_response(result)


@router.post("/tasks/{task_id}/steps/{step_id}/complete")
async def complete_step(
    task_id: str,
    step_id: str,
    data: TaskStepResponseComplete | None = None,
    current_user: User = Depends(get_current_user)
) -> dict:
    """Mark a step as completed and optionally update notes/output."""
    db = get_database()

    if not ObjectId.is_valid(task_id):
        raise HTTPException(status_code=400, detail="Invalid task ID")

    now = datetime.now(timezone.utc)
    update_data = {
        "status": StepStatus.COMPLETED.value,
        "completed_by_id": current_user.id,
        "completed_at": now,
        "updated_at": now,
    }

    if data:
        if data.notes is not None:
            update_data["notes"] = data.notes
        if data.output_data is not None:
            update_data["output_data"] = data.output_data

    result = await db.task_step_responses.find_one_and_update(
        {
            "task_id": ObjectId(task_id),
            "step_id": step_id,
            "organization_id": current_user.organization_id
        },
        {"$set": update_data},
        return_document=True
    )

    if not result:
        raise HTTPException(status_code=404, detail="Step response not found")

    return serialize_step_response(result)


@router.post("/tasks/{task_id}/steps/{step_id}/skip")
async def skip_step(
    task_id: str,
    step_id: str,
    current_user: User = Depends(get_current_user)
) -> dict:
    """Mark a step as skipped."""
    db = get_database()

    if not ObjectId.is_valid(task_id):
        raise HTTPException(status_code=400, detail="Invalid task ID")

    now = datetime.now(timezone.utc)
    result = await db.task_step_responses.find_one_and_update(
        {
            "task_id": ObjectId(task_id),
            "step_id": step_id,
            "organization_id": current_user.organization_id
        },
        {
            "$set": {
                "status": StepStatus.SKIPPED.value,
                "completed_by_id": current_user.id,
                "completed_at": now,
                "updated_at": now,
            }
        },
        return_document=True
    )

    if not result:
        raise HTTPException(status_code=404, detail="Step response not found")

    return serialize_step_response(result)


@router.get("/tasks/{task_id}/steps/{step_id}/attachments")
async def list_step_attachments(
    task_id: str,
    step_id: str,
    current_user: User = Depends(get_current_user)
) -> list[dict]:
    """List all attachments for a specific step."""
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
        "step_id": step_id,
        "deleted_at": None
    }).sort("created_at", -1)

    attachments = await cursor.to_list(100)
    return [serialize_attachment(a) for a in attachments]


@router.post("/tasks/{task_id}/steps/{step_id}/attachments/upload", status_code=status.HTTP_201_CREATED)
async def upload_step_attachment(
    task_id: str,
    step_id: str,
    file: UploadFile = File(...),
    note: Optional[str] = Form(None),
    current_user: User = Depends(get_current_user)
) -> dict:
    """Upload a file attachment to a step."""
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

    # Verify step response exists
    step_response = await db.task_step_responses.find_one({
        "task_id": ObjectId(task_id),
        "step_id": step_id,
        "organization_id": current_user.organization_id
    })
    if not step_response:
        raise HTTPException(status_code=404, detail="Step not found")

    # Create storage directory
    storage_dir = get_step_storage_dir(task_id, step_id)
    os.makedirs(storage_dir, exist_ok=True)

    # Generate unique filename
    ext = os.path.splitext(file.filename)[1] if file.filename else ""
    unique_filename = f"{uuid.uuid4()}{ext}"
    file_path = os.path.join(storage_dir, unique_filename)

    # Save file
    content = await file.read()
    async with aiofiles.open(file_path, "wb") as f:
        await f.write(content)

    # Create attachment record with step_id
    attachment = TaskAttachment(
        task_id=ObjectId(task_id),
        organization_id=current_user.organization_id,
        attachment_type=AttachmentType.FILE,
        step_id=step_id,
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


@router.post("/tasks/{task_id}/steps/{step_id}/attachments/link", status_code=status.HTTP_201_CREATED)
async def add_step_link(
    task_id: str,
    step_id: str,
    url: str,
    link_title: Optional[str] = None,
    note: Optional[str] = None,
    current_user: User = Depends(get_current_user)
) -> dict:
    """Add a link attachment to a step."""
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

    # Verify step response exists
    step_response = await db.task_step_responses.find_one({
        "task_id": ObjectId(task_id),
        "step_id": step_id,
        "organization_id": current_user.organization_id
    })
    if not step_response:
        raise HTTPException(status_code=404, detail="Step not found")

    # Create attachment record with step_id
    attachment = TaskAttachment(
        task_id=ObjectId(task_id),
        organization_id=current_user.organization_id,
        attachment_type=AttachmentType.LINK,
        step_id=step_id,
        url=url,
        link_title=link_title,
        note=note,
        uploaded_by_id=current_user.id,
    )

    await db.task_attachments.insert_one(attachment.model_dump_mongo())

    return serialize_attachment(attachment.model_dump_mongo())
