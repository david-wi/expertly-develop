from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Form
from fastapi.responses import FileResponse
from bson import ObjectId
from typing import Optional
import os
import uuid
import aiofiles
import httpx
import logging

from app.database import get_database
from app.models.expertise import (
    Expertise, ExpertiseCreate, ExpertiseUpdate, ExpertiseHistoryEntry,
    ExpertiseContentType
)
from app.models import User
from app.api.deps import get_current_user
from app.config import get_settings

router = APIRouter()
settings = get_settings()
logger = logging.getLogger(__name__)

# Base directory for expertise file attachments
UPLOADS_BASE_DIR = "/opt/expertly-develop/uploads/manage/expertise"


def get_expertise_storage_dir(organization_id: str) -> str:
    """Get the storage directory for an organization's expertise files."""
    return os.path.join(UPLOADS_BASE_DIR, organization_id)


def serialize_expertise(expertise: dict) -> dict:
    """Convert ObjectIds to strings in expertise document."""
    result = {
        "id": str(expertise["_id"]),
        "organization_id": str(expertise["organization_id"]),
        "title": expertise["title"],
        "description": expertise.get("description"),
        "content_type": expertise["content_type"],
        # MARKDOWN type
        "markdown_content": expertise.get("markdown_content"),
        # FILE type
        "filename": expertise.get("filename"),
        "original_filename": expertise.get("original_filename"),
        "mime_type": expertise.get("mime_type"),
        "size_bytes": expertise.get("size_bytes"),
        "extracted_markdown": expertise.get("extracted_markdown"),
        # URL type
        "url": expertise.get("url"),
        "url_retrieved_at": expertise.get("url_retrieved_at"),
        "url_content_markdown": expertise.get("url_content_markdown"),
        # Versioning
        "version": expertise.get("version", 1),
        # Status
        "is_active": expertise.get("is_active", True),
        # Timestamps
        "created_at": expertise["created_at"],
        "updated_at": expertise["updated_at"],
        "created_by": expertise.get("created_by"),
    }
    return result


async def extract_text_from_file(file_path: str, mime_type: str) -> str:
    """Extract text content from a file (PDF, Word, etc.)."""
    extracted_text = ""

    try:
        if mime_type == "application/pdf":
            # Try to import pypdf for PDF extraction
            try:
                from pypdf import PdfReader
                reader = PdfReader(file_path)
                text_parts = []
                for page in reader.pages:
                    text = page.extract_text()
                    if text:
                        text_parts.append(text)
                extracted_text = "\n\n".join(text_parts)
            except ImportError:
                logger.warning("pypdf not installed, cannot extract PDF text")
                extracted_text = "[PDF text extraction requires pypdf package]"

        elif mime_type in [
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            "application/msword"
        ]:
            # Try to import python-docx for Word extraction
            try:
                from docx import Document
                doc = Document(file_path)
                text_parts = []
                for paragraph in doc.paragraphs:
                    if paragraph.text:
                        text_parts.append(paragraph.text)
                extracted_text = "\n\n".join(text_parts)
            except ImportError:
                logger.warning("python-docx not installed, cannot extract Word text")
                extracted_text = "[Word text extraction requires python-docx package]"

        elif mime_type and mime_type.startswith("text/"):
            # Plain text files
            async with aiofiles.open(file_path, "r", encoding="utf-8", errors="replace") as f:
                extracted_text = await f.read()

        else:
            extracted_text = f"[No text extraction available for {mime_type}]"

    except Exception as e:
        logger.error(f"Error extracting text from file: {e}")
        extracted_text = f"[Error extracting text: {str(e)}]"

    return extracted_text


async def fetch_url_content(url: str) -> str:
    """Fetch and extract text content from a URL."""
    try:
        async with httpx.AsyncClient(timeout=30.0, follow_redirects=True) as client:
            response = await client.get(url)
            response.raise_for_status()

            content_type = response.headers.get("content-type", "")

            if "text/html" in content_type:
                # For HTML, try to extract text (basic extraction)
                html = response.text
                # Very basic HTML to text - strip tags
                import re
                # Remove script and style elements
                html = re.sub(r'<script[^>]*>.*?</script>', '', html, flags=re.DOTALL | re.IGNORECASE)
                html = re.sub(r'<style[^>]*>.*?</style>', '', html, flags=re.DOTALL | re.IGNORECASE)
                # Remove HTML tags
                text = re.sub(r'<[^>]+>', ' ', html)
                # Clean up whitespace
                text = re.sub(r'\s+', ' ', text).strip()
                return text

            elif "text/plain" in content_type or "text/markdown" in content_type:
                return response.text

            elif "application/json" in content_type:
                return response.text

            else:
                return f"[Content type {content_type} - raw content may not be readable as text]"

    except httpx.HTTPStatusError as e:
        logger.error(f"HTTP error fetching URL {url}: {e}")
        return f"[HTTP error {e.response.status_code} fetching URL]"
    except httpx.RequestError as e:
        logger.error(f"Request error fetching URL {url}: {e}")
        return f"[Error fetching URL: {str(e)}]"
    except Exception as e:
        logger.error(f"Error fetching URL {url}: {e}")
        return f"[Error: {str(e)}]"


@router.get("")
async def list_expertise(
    active_only: bool = True,
    content_type: Optional[str] = None,
    current_user: User = Depends(get_current_user)
) -> list[dict]:
    """List expertise items for the current organization."""
    db = get_database()

    query = {"organization_id": current_user.organization_id}

    if active_only:
        query["is_active"] = True

    if content_type:
        query["content_type"] = content_type

    cursor = db.expertise.find(query).sort("title", 1)
    expertise_items = await cursor.to_list(500)

    return [serialize_expertise(e) for e in expertise_items]


@router.get("/{expertise_id}")
async def get_expertise(
    expertise_id: str,
    current_user: User = Depends(get_current_user)
) -> dict:
    """Get a specific expertise item."""
    db = get_database()

    if not ObjectId.is_valid(expertise_id):
        raise HTTPException(status_code=400, detail="Invalid expertise ID")

    expertise = await db.expertise.find_one({
        "_id": ObjectId(expertise_id),
        "organization_id": current_user.organization_id
    })

    if not expertise:
        raise HTTPException(status_code=404, detail="Expertise not found")

    return serialize_expertise(expertise)


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_expertise(
    data: ExpertiseCreate,
    current_user: User = Depends(get_current_user)
) -> dict:
    """Create a new expertise item (markdown or URL type)."""
    db = get_database()

    # Validate content type and required fields
    if data.content_type == ExpertiseContentType.FILE:
        raise HTTPException(
            status_code=400,
            detail="Use POST /expertise/upload for file-based expertise"
        )

    url_content_markdown = None
    url_retrieved_at = None

    if data.content_type == ExpertiseContentType.URL:
        if not data.url:
            raise HTTPException(status_code=400, detail="URL is required for URL content type")
        # Fetch URL content
        url_content_markdown = await fetch_url_content(data.url)
        url_retrieved_at = datetime.now(timezone.utc)

    elif data.content_type == ExpertiseContentType.MARKDOWN:
        if not data.markdown_content:
            raise HTTPException(status_code=400, detail="Markdown content is required for markdown type")

    expertise = Expertise(
        organization_id=current_user.organization_id,
        title=data.title,
        description=data.description,
        content_type=data.content_type,
        markdown_content=data.markdown_content if data.content_type == ExpertiseContentType.MARKDOWN else None,
        url=data.url if data.content_type == ExpertiseContentType.URL else None,
        url_content_markdown=url_content_markdown,
        url_retrieved_at=url_retrieved_at,
        created_by=str(current_user.id),
    )

    await db.expertise.insert_one(expertise.model_dump_mongo())

    return serialize_expertise(expertise.model_dump_mongo())


@router.post("/upload", status_code=status.HTTP_201_CREATED)
async def upload_expertise(
    file: UploadFile = File(...),
    title: str = Form(...),
    description: Optional[str] = Form(None),
    current_user: User = Depends(get_current_user)
) -> dict:
    """Create a new expertise item by uploading a file (PDF, Word, etc.)."""
    db = get_database()

    # Create storage directory
    storage_dir = get_expertise_storage_dir(current_user.organization_id)
    os.makedirs(storage_dir, exist_ok=True)

    # Generate unique filename
    ext = os.path.splitext(file.filename)[1] if file.filename else ""
    unique_filename = f"{uuid.uuid4()}{ext}"
    file_path = os.path.join(storage_dir, unique_filename)

    # Save file
    content = await file.read()
    async with aiofiles.open(file_path, "wb") as f:
        await f.write(content)

    # Extract text from file
    extracted_markdown = await extract_text_from_file(file_path, file.content_type)

    expertise = Expertise(
        organization_id=current_user.organization_id,
        title=title,
        description=description,
        content_type=ExpertiseContentType.FILE,
        filename=unique_filename,
        original_filename=file.filename,
        mime_type=file.content_type,
        size_bytes=len(content),
        storage_path=file_path,
        extracted_markdown=extracted_markdown,
        created_by=str(current_user.id),
    )

    await db.expertise.insert_one(expertise.model_dump_mongo())

    return serialize_expertise(expertise.model_dump_mongo())


@router.patch("/{expertise_id}")
async def update_expertise(
    expertise_id: str,
    data: ExpertiseUpdate,
    current_user: User = Depends(get_current_user)
) -> dict:
    """Update an expertise item. Changes are tracked in history."""
    db = get_database()

    if not ObjectId.is_valid(expertise_id):
        raise HTTPException(status_code=400, detail="Invalid expertise ID")

    current = await db.expertise.find_one({
        "_id": ObjectId(expertise_id),
        "organization_id": current_user.organization_id
    })

    if not current:
        raise HTTPException(status_code=404, detail="Expertise not found")

    update_data = data.model_dump(exclude_unset=True)
    if not update_data:
        raise HTTPException(status_code=400, detail="No fields to update")

    # Create history entry for the current version before updating
    history_entry = ExpertiseHistoryEntry(
        version=current.get("version", 1),
        title=current["title"],
        description=current.get("description"),
        content_type=ExpertiseContentType(current["content_type"]),
        markdown_content=current.get("markdown_content"),
        extracted_markdown=current.get("extracted_markdown"),
        url=current.get("url"),
        url_content_markdown=current.get("url_content_markdown"),
        changed_at=datetime.now(timezone.utc),
        changed_by=str(current_user.id)
    )

    # Handle URL updates - re-fetch content
    if "url" in update_data and update_data["url"]:
        if current["content_type"] == ExpertiseContentType.URL.value:
            url_content_markdown = await fetch_url_content(update_data["url"])
            update_data["url_content_markdown"] = url_content_markdown
            update_data["url_retrieved_at"] = datetime.now(timezone.utc)

    # Increment version and update timestamp
    update_data["version"] = current.get("version", 1) + 1
    update_data["updated_at"] = datetime.now(timezone.utc)

    result = await db.expertise.find_one_and_update(
        {"_id": ObjectId(expertise_id)},
        {
            "$set": update_data,
            "$push": {"history": history_entry.model_dump()}
        },
        return_document=True
    )

    return serialize_expertise(result)


@router.delete("/{expertise_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_expertise(
    expertise_id: str,
    current_user: User = Depends(get_current_user)
):
    """Delete an expertise item (soft delete by deactivating)."""
    db = get_database()

    if not ObjectId.is_valid(expertise_id):
        raise HTTPException(status_code=400, detail="Invalid expertise ID")

    expertise = await db.expertise.find_one({
        "_id": ObjectId(expertise_id),
        "organization_id": current_user.organization_id
    })

    if not expertise:
        raise HTTPException(status_code=404, detail="Expertise not found")

    await db.expertise.find_one_and_update(
        {"_id": ObjectId(expertise_id)},
        {"$set": {"is_active": False, "updated_at": datetime.now(timezone.utc)}}
    )


@router.post("/{expertise_id}/refresh-url")
async def refresh_url_content(
    expertise_id: str,
    current_user: User = Depends(get_current_user)
) -> dict:
    """Refresh the content from a URL-based expertise item."""
    db = get_database()

    if not ObjectId.is_valid(expertise_id):
        raise HTTPException(status_code=400, detail="Invalid expertise ID")

    expertise = await db.expertise.find_one({
        "_id": ObjectId(expertise_id),
        "organization_id": current_user.organization_id
    })

    if not expertise:
        raise HTTPException(status_code=404, detail="Expertise not found")

    if expertise["content_type"] != ExpertiseContentType.URL.value:
        raise HTTPException(status_code=400, detail="Only URL-type expertise can be refreshed")

    if not expertise.get("url"):
        raise HTTPException(status_code=400, detail="No URL configured for this expertise")

    # Create history entry before refreshing
    history_entry = ExpertiseHistoryEntry(
        version=expertise.get("version", 1),
        title=expertise["title"],
        description=expertise.get("description"),
        content_type=ExpertiseContentType(expertise["content_type"]),
        url=expertise.get("url"),
        url_content_markdown=expertise.get("url_content_markdown"),
        changed_at=datetime.now(timezone.utc),
        changed_by=str(current_user.id)
    )

    # Fetch new content
    url_content_markdown = await fetch_url_content(expertise["url"])

    result = await db.expertise.find_one_and_update(
        {"_id": ObjectId(expertise_id)},
        {
            "$set": {
                "url_content_markdown": url_content_markdown,
                "url_retrieved_at": datetime.now(timezone.utc),
                "version": expertise.get("version", 1) + 1,
                "updated_at": datetime.now(timezone.utc)
            },
            "$push": {"history": history_entry.model_dump()}
        },
        return_document=True
    )

    return serialize_expertise(result)


@router.post("/{expertise_id}/re-extract")
async def re_extract_file_content(
    expertise_id: str,
    current_user: User = Depends(get_current_user)
) -> dict:
    """Re-extract text from a file-based expertise item."""
    db = get_database()

    if not ObjectId.is_valid(expertise_id):
        raise HTTPException(status_code=400, detail="Invalid expertise ID")

    expertise = await db.expertise.find_one({
        "_id": ObjectId(expertise_id),
        "organization_id": current_user.organization_id
    })

    if not expertise:
        raise HTTPException(status_code=404, detail="Expertise not found")

    if expertise["content_type"] != ExpertiseContentType.FILE.value:
        raise HTTPException(status_code=400, detail="Only file-type expertise can be re-extracted")

    storage_path = expertise.get("storage_path")
    if not storage_path or not os.path.exists(storage_path):
        raise HTTPException(status_code=404, detail="File not found on storage")

    # Create history entry before re-extracting
    history_entry = ExpertiseHistoryEntry(
        version=expertise.get("version", 1),
        title=expertise["title"],
        description=expertise.get("description"),
        content_type=ExpertiseContentType(expertise["content_type"]),
        extracted_markdown=expertise.get("extracted_markdown"),
        changed_at=datetime.now(timezone.utc),
        changed_by=str(current_user.id)
    )

    # Re-extract text
    extracted_markdown = await extract_text_from_file(
        storage_path,
        expertise.get("mime_type", "")
    )

    result = await db.expertise.find_one_and_update(
        {"_id": ObjectId(expertise_id)},
        {
            "$set": {
                "extracted_markdown": extracted_markdown,
                "version": expertise.get("version", 1) + 1,
                "updated_at": datetime.now(timezone.utc)
            },
            "$push": {"history": history_entry.model_dump()}
        },
        return_document=True
    )

    return serialize_expertise(result)


@router.get("/{expertise_id}/history")
async def get_expertise_history(
    expertise_id: str,
    current_user: User = Depends(get_current_user)
) -> list[dict]:
    """Get the version history of an expertise item."""
    db = get_database()

    if not ObjectId.is_valid(expertise_id):
        raise HTTPException(status_code=400, detail="Invalid expertise ID")

    expertise = await db.expertise.find_one({
        "_id": ObjectId(expertise_id),
        "organization_id": current_user.organization_id
    })

    if not expertise:
        raise HTTPException(status_code=404, detail="Expertise not found")

    return expertise.get("history", [])


@router.post("/{expertise_id}/duplicate")
async def duplicate_expertise(
    expertise_id: str,
    new_title: Optional[str] = None,
    current_user: User = Depends(get_current_user)
) -> dict:
    """Duplicate an expertise item."""
    db = get_database()

    if not ObjectId.is_valid(expertise_id):
        raise HTTPException(status_code=400, detail="Invalid expertise ID")

    original = await db.expertise.find_one({
        "_id": ObjectId(expertise_id),
        "organization_id": current_user.organization_id
    })

    if not original:
        raise HTTPException(status_code=404, detail="Expertise not found")

    # For file-based expertise, we need to copy the file
    new_storage_path = None
    new_filename = None
    if original["content_type"] == ExpertiseContentType.FILE.value:
        original_path = original.get("storage_path")
        if original_path and os.path.exists(original_path):
            storage_dir = get_expertise_storage_dir(current_user.organization_id)
            ext = os.path.splitext(original.get("original_filename", ""))[1]
            new_filename = f"{uuid.uuid4()}{ext}"
            new_storage_path = os.path.join(storage_dir, new_filename)

            # Copy the file
            async with aiofiles.open(original_path, "rb") as src:
                content = await src.read()
            async with aiofiles.open(new_storage_path, "wb") as dst:
                await dst.write(content)

    new_expertise = Expertise(
        organization_id=current_user.organization_id,
        title=new_title or f"{original['title']} (Copy)",
        description=original.get("description"),
        content_type=ExpertiseContentType(original["content_type"]),
        # MARKDOWN type
        markdown_content=original.get("markdown_content"),
        # FILE type
        filename=new_filename or original.get("filename"),
        original_filename=original.get("original_filename"),
        mime_type=original.get("mime_type"),
        size_bytes=original.get("size_bytes"),
        storage_path=new_storage_path or original.get("storage_path"),
        extracted_markdown=original.get("extracted_markdown"),
        # URL type
        url=original.get("url"),
        url_retrieved_at=original.get("url_retrieved_at"),
        url_content_markdown=original.get("url_content_markdown"),
        # Metadata
        created_by=str(current_user.id),
    )

    await db.expertise.insert_one(new_expertise.model_dump_mongo())

    return serialize_expertise(new_expertise.model_dump_mongo())


@router.get("/{expertise_id}/download")
async def download_expertise_file(
    expertise_id: str,
    current_user: User = Depends(get_current_user)
):
    """Download the file for a file-based expertise item."""
    db = get_database()

    if not ObjectId.is_valid(expertise_id):
        raise HTTPException(status_code=400, detail="Invalid expertise ID")

    expertise = await db.expertise.find_one({
        "_id": ObjectId(expertise_id),
        "organization_id": current_user.organization_id
    })

    if not expertise:
        raise HTTPException(status_code=404, detail="Expertise not found")

    if expertise["content_type"] != ExpertiseContentType.FILE.value:
        raise HTTPException(status_code=400, detail="Only file-type expertise can be downloaded")

    storage_path = expertise.get("storage_path")
    if not storage_path or not os.path.exists(storage_path):
        raise HTTPException(status_code=404, detail="File not found on storage")

    return FileResponse(
        path=storage_path,
        filename=expertise.get("original_filename") or expertise.get("filename"),
        media_type=expertise.get("mime_type") or "application/octet-stream"
    )
