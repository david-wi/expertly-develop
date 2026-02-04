from typing import List, Optional
from datetime import datetime
from fastapi import APIRouter, HTTPException, UploadFile, File, Form, BackgroundTasks
from fastapi.responses import FileResponse
from pydantic import BaseModel
from bson import ObjectId
import aiofiles
import os
import uuid

from app.database import get_database
from app.models.document import Document, DocumentType, ExtractionStatus, ExtractedDocumentField
from app.services.document_processing import get_document_processor

router = APIRouter()

UPLOAD_DIR = "/app/uploads"


class ExtractedFieldResponse(BaseModel):
    field_name: str
    value: Optional[str] = None
    confidence: float
    evidence_text: Optional[str] = None


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
    source: Optional[str] = None
    is_verified: bool
    verified_by: Optional[str] = None
    created_at: Optional[datetime] = None

    # AI Extraction fields
    extraction_status: Optional[str] = None
    ocr_text: Optional[str] = None
    ocr_confidence: Optional[float] = None
    ai_classified_type: Optional[str] = None
    classification_confidence: Optional[float] = None
    extracted_fields: Optional[List[ExtractedFieldResponse]] = None
    suggested_shipment_ids: Optional[List[str]] = None
    auto_matched: bool = False
    match_confidence: Optional[float] = None
    needs_review: bool = False


def doc_to_response(doc: dict) -> DocumentResponse:
    """Convert document dict to response model."""
    extracted_fields = None
    if doc.get("extracted_fields"):
        extracted_fields = [
            ExtractedFieldResponse(
                field_name=f.get("field_name", ""),
                value=str(f.get("value")) if f.get("value") is not None else None,
                confidence=f.get("confidence", 0),
                evidence_text=f.get("evidence_text"),
            )
            for f in doc["extracted_fields"]
        ]

    suggested_shipment_ids = None
    if doc.get("suggested_shipment_ids"):
        suggested_shipment_ids = [str(sid) for sid in doc["suggested_shipment_ids"]]

    return DocumentResponse(
        id=str(doc["_id"]),
        document_type=doc["document_type"],
        filename=doc["filename"],
        original_filename=doc["original_filename"],
        mime_type=doc["mime_type"],
        size_bytes=doc["size_bytes"],
        shipment_id=str(doc["shipment_id"]) if doc.get("shipment_id") else None,
        quote_id=str(doc["quote_id"]) if doc.get("quote_id") else None,
        carrier_id=str(doc["carrier_id"]) if doc.get("carrier_id") else None,
        customer_id=str(doc["customer_id"]) if doc.get("customer_id") else None,
        description=doc.get("description"),
        uploaded_by=doc.get("uploaded_by"),
        source=doc.get("source"),
        is_verified=doc.get("is_verified", False),
        verified_by=doc.get("verified_by"),
        created_at=doc.get("created_at"),
        extraction_status=doc.get("extraction_status"),
        ocr_text=doc.get("ocr_text"),
        ocr_confidence=doc.get("ocr_confidence"),
        ai_classified_type=doc.get("ai_classified_type"),
        classification_confidence=doc.get("classification_confidence"),
        extracted_fields=extracted_fields,
        suggested_shipment_ids=suggested_shipment_ids,
        auto_matched=doc.get("auto_matched", False),
        match_confidence=doc.get("match_confidence"),
        needs_review=doc.get("needs_review", False),
    )


@router.get("", response_model=List[DocumentResponse])
async def list_documents(
    shipment_id: Optional[str] = None,
    carrier_id: Optional[str] = None,
    customer_id: Optional[str] = None,
    document_type: Optional[DocumentType] = None,
    needs_review: Optional[bool] = None,
    extraction_status: Optional[str] = None,
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
    if needs_review is not None:
        query["needs_review"] = needs_review
    if extraction_status:
        query["extraction_status"] = extraction_status

    cursor = db.documents.find(query).sort("created_at", -1)
    documents = await cursor.to_list(1000)

    return [doc_to_response(d) for d in documents]


@router.get("/pending-review", response_model=List[DocumentResponse])
async def list_pending_review():
    """List documents that need human review."""
    db = get_database()

    cursor = db.documents.find({
        "$or": [
            {"needs_review": True},
            {"extraction_status": ExtractionStatus.COMPLETE.value, "shipment_id": None},
        ]
    }).sort("created_at", -1)
    documents = await cursor.to_list(100)

    return [doc_to_response(d) for d in documents]


@router.get("/{document_id}", response_model=DocumentResponse)
async def get_document(document_id: str):
    """Get a document by ID."""
    db = get_database()

    doc = await db.documents.find_one({"_id": ObjectId(document_id)})
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    return doc_to_response(doc)


@router.get("/{document_id}/download")
async def download_document(document_id: str):
    """Download the actual document file."""
    db = get_database()

    doc = await db.documents.find_one({"_id": ObjectId(document_id)})
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    filepath = doc["storage_path"]
    if not os.path.exists(filepath):
        raise HTTPException(status_code=404, detail="File not found on disk")

    return FileResponse(
        filepath,
        filename=doc["original_filename"],
        media_type=doc["mime_type"],
    )


@router.post("/upload", response_model=DocumentResponse)
async def upload_document(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    document_type: DocumentType = Form(...),
    shipment_id: Optional[str] = Form(None),
    carrier_id: Optional[str] = Form(None),
    customer_id: Optional[str] = Form(None),
    description: Optional[str] = Form(None),
    auto_process: bool = Form(True),  # Auto-run AI extraction
    source: str = Form("upload"),  # "upload", "email", "mobile", "api"
):
    """Upload a document and optionally process it with AI."""
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
    doc_data = {
        "document_type": document_type.value,
        "filename": filename,
        "original_filename": file.filename or "unknown",
        "mime_type": file.content_type or "application/octet-stream",
        "size_bytes": len(content),
        "storage_path": filepath,
        "storage_provider": "local",
        "shipment_id": ObjectId(shipment_id) if shipment_id else None,
        "carrier_id": ObjectId(carrier_id) if carrier_id else None,
        "customer_id": ObjectId(customer_id) if customer_id else None,
        "description": description,
        "source": source,
        "extraction_status": ExtractionStatus.PENDING.value if auto_process else ExtractionStatus.SKIPPED.value,
        "is_verified": False,
        "needs_review": False,
        "auto_matched": False,
        "created_at": datetime.utcnow(),
    }

    result = await db.documents.insert_one(doc_data)
    doc_data["_id"] = result.inserted_id

    # Queue AI processing in background
    if auto_process:
        background_tasks.add_task(process_document_background, str(result.inserted_id))

    return doc_to_response(doc_data)


async def process_document_background(document_id: str):
    """Background task to process a document with AI."""
    try:
        processor = get_document_processor()
        await processor.process_document(document_id)
    except Exception as e:
        print(f"Error processing document {document_id}: {e}")


@router.post("/{document_id}/process", response_model=DocumentResponse)
async def process_document(document_id: str, background_tasks: BackgroundTasks):
    """Manually trigger AI processing for a document."""
    db = get_database()

    doc = await db.documents.find_one({"_id": ObjectId(document_id)})
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    # Queue processing
    background_tasks.add_task(process_document_background, document_id)

    # Update status to pending
    await db.documents.update_one(
        {"_id": ObjectId(document_id)},
        {"$set": {"extraction_status": ExtractionStatus.PENDING.value}}
    )
    doc["extraction_status"] = ExtractionStatus.PENDING.value

    return doc_to_response(doc)


@router.post("/{document_id}/link-shipment", response_model=DocumentResponse)
async def link_document_to_shipment(document_id: str, shipment_id: str):
    """Manually link a document to a shipment."""
    db = get_database()

    doc = await db.documents.find_one({"_id": ObjectId(document_id)})
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    # Verify shipment exists
    shipment = await db.shipments.find_one({"_id": ObjectId(shipment_id)})
    if not shipment:
        raise HTTPException(status_code=404, detail="Shipment not found")

    await db.documents.update_one(
        {"_id": ObjectId(document_id)},
        {
            "$set": {
                "shipment_id": ObjectId(shipment_id),
                "needs_review": False,
                "auto_matched": False,  # Manual match
            }
        }
    )

    doc["shipment_id"] = ObjectId(shipment_id)
    doc["needs_review"] = False
    return doc_to_response(doc)


@router.post("/{document_id}/verify", response_model=DocumentResponse)
async def verify_document(document_id: str, verified_by: Optional[str] = None):
    """Mark a document as verified."""
    db = get_database()

    doc_data = await db.documents.find_one({"_id": ObjectId(document_id)})
    if not doc_data:
        raise HTTPException(status_code=404, detail="Document not found")

    await db.documents.update_one(
        {"_id": ObjectId(document_id)},
        {
            "$set": {
                "is_verified": True,
                "verified_at": datetime.utcnow(),
                "verified_by": verified_by,
                "needs_review": False,
            }
        }
    )

    doc_data["is_verified"] = True
    doc_data["needs_review"] = False
    return doc_to_response(doc_data)


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
