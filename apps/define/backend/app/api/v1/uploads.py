from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from uuid import uuid4
from datetime import datetime
import os
import aiofiles

from app.database import get_db
from app.api.deps import get_current_user, CurrentUser
from app.models.requirement import Requirement
from app.models.attachment import Attachment
from app.schemas.attachment import AttachmentResponse
from app.config import get_settings

router = APIRouter()
settings = get_settings()


@router.post("", response_model=AttachmentResponse, status_code=201)
async def upload_file(
    requirement_id: str = Form(...),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    """Upload a file attachment for a requirement."""
    # Verify requirement exists
    requirement = db.query(Requirement).filter(Requirement.id == requirement_id).first()
    if not requirement:
        raise HTTPException(status_code=404, detail="Requirement not found")

    # Create uploads directory if needed
    uploads_dir = os.path.join(settings.uploads_dir, requirement_id)
    os.makedirs(uploads_dir, exist_ok=True)

    # Generate unique filename
    file_id = str(uuid4())
    ext = os.path.splitext(file.filename)[1] if file.filename else ""
    stored_filename = f"{file_id}{ext}"
    storage_path = os.path.join(requirement_id, stored_filename)
    full_path = os.path.join(settings.uploads_dir, storage_path)

    # Save file
    content = await file.read()
    async with aiofiles.open(full_path, "wb") as f:
        await f.write(content)

    now = datetime.utcnow().isoformat()
    attachment = Attachment(
        id=file_id,
        requirement_id=requirement_id,
        filename=stored_filename,
        original_filename=file.filename or "unknown",
        mime_type=file.content_type or "application/octet-stream",
        size_bytes=len(content),
        storage_path=storage_path,
        created_at=now,
    )

    db.add(attachment)
    db.commit()
    db.refresh(attachment)

    return attachment


@router.get("/{attachment_id}")
async def get_attachment(
    attachment_id: str,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    """Download an attachment."""
    attachment = db.query(Attachment).filter(Attachment.id == attachment_id).first()
    if not attachment:
        raise HTTPException(status_code=404, detail="Attachment not found")

    full_path = os.path.join(settings.uploads_dir, attachment.storage_path)
    if not os.path.exists(full_path):
        raise HTTPException(status_code=404, detail="File not found on disk")

    return FileResponse(
        path=full_path,
        filename=attachment.original_filename,
        media_type=attachment.mime_type,
    )


@router.delete("/{attachment_id}", status_code=204)
async def delete_attachment(
    attachment_id: str,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    """Delete an attachment."""
    attachment = db.query(Attachment).filter(Attachment.id == attachment_id).first()
    if not attachment:
        raise HTTPException(status_code=404, detail="Attachment not found")

    # Delete file from disk
    full_path = os.path.join(settings.uploads_dir, attachment.storage_path)
    if os.path.exists(full_path):
        os.remove(full_path)

    db.delete(attachment)
    db.commit()

    return None
