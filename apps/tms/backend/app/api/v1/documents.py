from typing import List, Optional
from fastapi import APIRouter, HTTPException, UploadFile, File, Form
from pydantic import BaseModel
from bson import ObjectId
import aiofiles
import os
import uuid

from app.database import get_database
from app.models.document import Document, DocumentType

router = APIRouter()

UPLOAD_DIR = "/app/uploads"


class DocumentResponse(BaseModel):
    id: str
    document_type: DocumentType
    filename: str
    original_filename: str
    mime_type: str
    size_bytes: int
    shipment_id: Optional[str] = None
    quote_id: Optional[str] = None
    carrier_id: Optional[str] = None
    customer_id: Optional[str] = None
    description: Optional[str] = None
    uploaded_by: Optional[str] = None
    is_verified: bool
    verified_by: Optional[str] = None


def doc_to_response(doc: Document) -> DocumentResponse:
    return DocumentResponse(
        id=str(doc.id),
        document_type=doc.document_type,
        filename=doc.filename,
        original_filename=doc.original_filename,
        mime_type=doc.mime_type,
        size_bytes=doc.size_bytes,
        shipment_id=str(doc.shipment_id) if doc.shipment_id else None,
        quote_id=str(doc.quote_id) if doc.quote_id else None,
        carrier_id=str(doc.carrier_id) if doc.carrier_id else None,
        customer_id=str(doc.customer_id) if doc.customer_id else None,
        description=doc.description,
        uploaded_by=doc.uploaded_by,
        is_verified=doc.is_verified,
        verified_by=doc.verified_by,
    )


@router.get("", response_model=List[DocumentResponse])
async def list_documents(
    shipment_id: Optional[str] = None,
    carrier_id: Optional[str] = None,
    customer_id: Optional[str] = None,
    document_type: Optional[DocumentType] = None,
):
    """List documents with optional filters."""
    db = get_database()

    query = {}
    if shipment_id:
        query["shipment_id"] = ObjectId(shipment_id)
    if carrier_id:
        query["carrier_id"] = ObjectId(carrier_id)
    if customer_id:
        query["customer_id"] = ObjectId(customer_id)
    if document_type:
        query["document_type"] = document_type

    cursor = db.documents.find(query).sort("created_at", -1)
    documents = await cursor.to_list(1000)

    return [doc_to_response(Document(**d)) for d in documents]


@router.get("/{document_id}", response_model=DocumentResponse)
async def get_document(document_id: str):
    """Get a document by ID."""
    db = get_database()

    doc = await db.documents.find_one({"_id": ObjectId(document_id)})
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    return doc_to_response(Document(**doc))


@router.post("/upload", response_model=DocumentResponse)
async def upload_document(
    file: UploadFile = File(...),
    document_type: DocumentType = Form(...),
    shipment_id: Optional[str] = Form(None),
    carrier_id: Optional[str] = Form(None),
    customer_id: Optional[str] = Form(None),
    description: Optional[str] = Form(None),
):
    """Upload a document."""
    db = get_database()

    # Generate unique filename
    ext = os.path.splitext(file.filename)[1] if file.filename else ""
    filename = f"{uuid.uuid4()}{ext}"
    filepath = os.path.join(UPLOAD_DIR, filename)

    # Ensure upload directory exists
    os.makedirs(UPLOAD_DIR, exist_ok=True)

    # Save file
    async with aiofiles.open(filepath, 'wb') as f:
        content = await file.read()
        await f.write(content)

    # Create document record
    doc = Document(
        document_type=document_type,
        filename=filename,
        original_filename=file.filename or "unknown",
        mime_type=file.content_type or "application/octet-stream",
        size_bytes=len(content),
        storage_path=filepath,
        shipment_id=ObjectId(shipment_id) if shipment_id else None,
        carrier_id=ObjectId(carrier_id) if carrier_id else None,
        customer_id=ObjectId(customer_id) if customer_id else None,
        description=description,
    )

    await db.documents.insert_one(doc.model_dump_mongo())

    return doc_to_response(doc)


@router.post("/{document_id}/verify", response_model=DocumentResponse)
async def verify_document(document_id: str):
    """Mark a document as verified."""
    db = get_database()
    from datetime import datetime

    doc_data = await db.documents.find_one({"_id": ObjectId(document_id)})
    if not doc_data:
        raise HTTPException(status_code=404, detail="Document not found")

    await db.documents.update_one(
        {"_id": ObjectId(document_id)},
        {
            "$set": {
                "is_verified": True,
                "verified_at": datetime.utcnow(),
            }
        }
    )

    doc_data["is_verified"] = True
    return doc_to_response(Document(**doc_data))


@router.delete("/{document_id}")
async def delete_document(document_id: str):
    """Delete a document."""
    db = get_database()

    doc = await db.documents.find_one({"_id": ObjectId(document_id)})
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    # Delete file
    try:
        os.remove(doc["storage_path"])
    except OSError:
        pass

    await db.documents.delete_one({"_id": ObjectId(document_id)})

    return {"success": True}
