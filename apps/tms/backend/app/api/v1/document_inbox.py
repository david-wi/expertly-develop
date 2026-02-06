"""Document Inbox API endpoints for receiving and classifying incoming documents."""

from typing import List, Optional
from datetime import datetime
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from bson import ObjectId

from app.database import get_database
from app.models.document_inbox import (
    DocumentInboxItem,
    InboxSource,
    InboxFileType,
    InboxClassification,
    InboxStatus,
)
from app.services.document_classification import classify_document, suggest_link
from app.services.websocket_manager import manager
from app.models.base import utc_now

router = APIRouter()


# ============================================================================
# Request/Response Models
# ============================================================================


class InboxItemCreate(BaseModel):
    """Create a new inbox item (simulates receiving a document)."""
    source: InboxSource = InboxSource.UPLOAD
    source_email: Optional[str] = None
    filename: str
    file_type: InboxFileType = InboxFileType.PDF
    file_size: int = 0
    metadata: Optional[dict] = None


class InboxItemLink(BaseModel):
    """Link an inbox item to an entity."""
    entity_type: str  # "shipment", "carrier", "customer", "invoice"
    entity_id: str


class InboxItemResponse(BaseModel):
    """Response model for an inbox item."""
    id: str
    source: str
    source_email: Optional[str] = None
    filename: str
    file_type: str
    file_size: int
    classification: Optional[str] = None
    classification_confidence: Optional[float] = None
    linked_entity_type: Optional[str] = None
    linked_entity_id: Optional[str] = None
    status: str
    metadata: dict = {}
    processed_at: Optional[datetime] = None
    processed_by: Optional[str] = None
    created_at: datetime
    updated_at: datetime


class InboxStatsResponse(BaseModel):
    """Summary stats for the document inbox."""
    total: int
    by_status: dict
    by_classification: dict


# ============================================================================
# Helpers
# ============================================================================


def item_to_response(doc: dict) -> InboxItemResponse:
    """Convert a MongoDB document to an InboxItemResponse."""
    return InboxItemResponse(
        id=str(doc["_id"]),
        source=doc.get("source", "upload"),
        source_email=doc.get("source_email"),
        filename=doc.get("filename", ""),
        file_type=doc.get("file_type", "pdf"),
        file_size=doc.get("file_size", 0),
        classification=doc.get("classification"),
        classification_confidence=doc.get("classification_confidence"),
        linked_entity_type=doc.get("linked_entity_type"),
        linked_entity_id=str(doc["linked_entity_id"]) if doc.get("linked_entity_id") else None,
        status=doc.get("status", "new"),
        metadata=doc.get("metadata", {}),
        processed_at=doc.get("processed_at"),
        processed_by=doc.get("processed_by"),
        created_at=doc.get("created_at", datetime.utcnow()),
        updated_at=doc.get("updated_at", datetime.utcnow()),
    )


# ============================================================================
# Endpoints
# ============================================================================


@router.get("", response_model=List[InboxItemResponse])
async def list_inbox_items(
    status: Optional[InboxStatus] = None,
    classification: Optional[InboxClassification] = None,
    source: Optional[InboxSource] = None,
):
    """List document inbox items with optional filters."""
    db = get_database()

    query = {}
    if status:
        query["status"] = status.value
    if classification:
        query["classification"] = classification.value
    if source:
        query["source"] = source.value

    cursor = db.document_inbox.find(query).sort("created_at", -1)
    items = await cursor.to_list(1000)

    return [item_to_response(item) for item in items]


@router.post("", response_model=InboxItemResponse)
async def create_inbox_item(data: InboxItemCreate):
    """Create a new inbox item (simulates receiving a document)."""
    db = get_database()

    item = DocumentInboxItem(
        source=data.source,
        source_email=data.source_email,
        filename=data.filename,
        file_type=data.file_type,
        file_size=data.file_size,
        metadata=data.metadata or {},
    )

    result = await db.document_inbox.insert_one(item.model_dump_mongo())

    item_doc = await db.document_inbox.find_one({"_id": result.inserted_id})

    await manager.broadcast("document_inbox:new", {
        "id": str(result.inserted_id),
        "filename": data.filename,
    })

    return item_to_response(item_doc)


@router.post("/{item_id}/classify", response_model=InboxItemResponse)
async def classify_inbox_item(item_id: str):
    """Run AI classification on an inbox item."""
    db = get_database()

    item_doc = await db.document_inbox.find_one({"_id": ObjectId(item_id)})
    if not item_doc:
        raise HTTPException(status_code=404, detail="Inbox item not found")

    # Run classification
    classification, confidence, extracted_data = classify_document(
        filename=item_doc["filename"],
        file_type=item_doc.get("file_type", "pdf"),
        metadata=item_doc.get("metadata"),
    )

    # Get link suggestion
    entity_type, entity_id = suggest_link(classification, extracted_data)

    # Update the item
    now = utc_now()
    update_data = {
        "classification": classification,
        "classification_confidence": confidence,
        "status": InboxStatus.CLASSIFIED.value,
        "metadata": {**item_doc.get("metadata", {}), **extracted_data},
        "processed_at": now,
        "processed_by": "ai_classifier",
        "updated_at": now,
    }

    if entity_type:
        update_data["linked_entity_type"] = entity_type

    await db.document_inbox.update_one(
        {"_id": ObjectId(item_id)},
        {"$set": update_data},
    )

    updated = await db.document_inbox.find_one({"_id": ObjectId(item_id)})

    await manager.broadcast("document_inbox:classified", {
        "id": item_id,
        "classification": classification,
        "confidence": confidence,
    })

    return item_to_response(updated)


@router.post("/{item_id}/link", response_model=InboxItemResponse)
async def link_inbox_item(item_id: str, data: InboxItemLink):
    """Link an inbox item to an entity."""
    db = get_database()

    item_doc = await db.document_inbox.find_one({"_id": ObjectId(item_id)})
    if not item_doc:
        raise HTTPException(status_code=404, detail="Inbox item not found")

    # Validate entity type
    valid_types = {"shipment", "carrier", "customer", "invoice"}
    if data.entity_type not in valid_types:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid entity type. Must be one of: {', '.join(valid_types)}",
        )

    # Validate entity exists
    collection_map = {
        "shipment": "shipments",
        "carrier": "carriers",
        "customer": "customers",
        "invoice": "invoices",
    }
    collection = collection_map[data.entity_type]
    entity = await db[collection].find_one({"_id": ObjectId(data.entity_id)})
    if not entity:
        raise HTTPException(status_code=404, detail=f"{data.entity_type.capitalize()} not found")

    now = utc_now()
    await db.document_inbox.update_one(
        {"_id": ObjectId(item_id)},
        {"$set": {
            "linked_entity_type": data.entity_type,
            "linked_entity_id": ObjectId(data.entity_id),
            "status": InboxStatus.LINKED.value,
            "updated_at": now,
        }},
    )

    updated = await db.document_inbox.find_one({"_id": ObjectId(item_id)})

    await manager.broadcast("document_inbox:linked", {
        "id": item_id,
        "entity_type": data.entity_type,
        "entity_id": data.entity_id,
    })

    return item_to_response(updated)


@router.post("/{item_id}/archive", response_model=InboxItemResponse)
async def archive_inbox_item(item_id: str):
    """Archive an inbox item."""
    db = get_database()

    item_doc = await db.document_inbox.find_one({"_id": ObjectId(item_id)})
    if not item_doc:
        raise HTTPException(status_code=404, detail="Inbox item not found")

    now = utc_now()
    await db.document_inbox.update_one(
        {"_id": ObjectId(item_id)},
        {"$set": {
            "status": InboxStatus.ARCHIVED.value,
            "updated_at": now,
        }},
    )

    updated = await db.document_inbox.find_one({"_id": ObjectId(item_id)})
    return item_to_response(updated)


@router.get("/stats", response_model=InboxStatsResponse)
async def get_inbox_stats():
    """Get document inbox statistics."""
    db = get_database()

    # Count by status
    status_pipeline = [
        {"$group": {"_id": "$status", "count": {"$sum": 1}}},
    ]
    status_results = await db.document_inbox.aggregate(status_pipeline).to_list(20)
    by_status = {r["_id"]: r["count"] for r in status_results}

    # Count by classification
    classification_pipeline = [
        {"$match": {"classification": {"$ne": None}}},
        {"$group": {"_id": "$classification", "count": {"$sum": 1}}},
    ]
    classification_results = await db.document_inbox.aggregate(classification_pipeline).to_list(20)
    by_classification = {r["_id"]: r["count"] for r in classification_results}

    total = await db.document_inbox.count_documents({})

    return InboxStatsResponse(
        total=total,
        by_status=by_status,
        by_classification=by_classification,
    )
