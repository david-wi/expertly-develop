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
from app.services.document_classification import (
    classify_document as classify_by_pattern,
    get_workflow_routing,
    get_supported_classifications,
)

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

    # Auto-classify document by filename if type is "other"
    actual_document_type = document_type.value
    classification_confidence = None
    ai_classified_type = None

    if document_type == DocumentType.OTHER:
        classification, confidence, _extracted = classify_by_pattern(
            filename=file.filename or "unknown",
            file_type=file.content_type or "application/octet-stream",
        )
        if classification != "unknown" and confidence >= 0.7:
            # Map classification string to DocumentType enum if possible
            try:
                mapped_type = DocumentType(classification)
                actual_document_type = mapped_type.value
                ai_classified_type = classification
                classification_confidence = confidence
            except ValueError:
                # Classification doesn't map to DocumentType enum, store as ai_classified
                ai_classified_type = classification
                classification_confidence = confidence

    # Create document record
    doc_data = {
        "document_type": actual_document_type,
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
        "ai_classified_type": ai_classified_type,
        "classification_confidence": classification_confidence,
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


# ============================================================================
# BOL Generation
# ============================================================================

class BOLGenerateRequest(BaseModel):
    template_id: Optional[str] = None
    custom_fields: Optional[dict] = None
    send_to_emails: Optional[list] = None


@router.post("/generate-bol/{shipment_id}")
async def generate_bol(shipment_id: str, data: Optional[BOLGenerateRequest] = None):
    """Auto-generate BOL from shipment data."""
    db = get_database()
    shipment_oid = ObjectId(shipment_id)

    shipment = await db.shipments.find_one({"_id": shipment_oid})
    if not shipment:
        raise HTTPException(status_code=404, detail="Shipment not found")

    # Get customer
    customer = None
    if shipment.get("customer_id"):
        customer = await db.customers.find_one({"_id": shipment["customer_id"]})

    # Get carrier
    carrier = None
    if shipment.get("carrier_id"):
        carrier = await db.carriers.find_one({"_id": shipment["carrier_id"]})

    stops = shipment.get("stops", [])
    pickup_stop = next((s for s in stops if s.get("stop_type") == "pickup"), {})
    delivery_stop = next((s for s in stops if s.get("stop_type") == "delivery"), {})

    # Check for custom template
    template = None
    if data and data.template_id:
        template = await db.bol_templates.find_one({"_id": ObjectId(data.template_id)})
    elif customer:
        template = await db.bol_templates.find_one({"customer_id": customer["_id"], "is_default": True})

    # Build standard Straight BOL data with all required fields
    bol_data = {
        "shipment_number": shipment.get("shipment_number"),
        "bol_number": shipment.get("bol_number") or f"BOL-{shipment.get('shipment_number', '')}",
        "date": datetime.utcnow().strftime("%Y-%m-%d"),
        "bol_type": "straight",  # "straight" or "order"

        # Shipper (Ship From)
        "shipper": {
            "name": pickup_stop.get("name") or (customer.get("name") if customer else ""),
            "address": pickup_stop.get("address", ""),
            "city": pickup_stop.get("city", ""),
            "state": pickup_stop.get("state", ""),
            "zip": pickup_stop.get("zip_code", ""),
            "contact": pickup_stop.get("contact_name", ""),
            "phone": pickup_stop.get("contact_phone", ""),
            "sid_number": "",  # Shipper ID Number
            "fob": "origin",  # FOB: "origin" or "destination"
        },

        # Consignee (Ship To)
        "consignee": {
            "name": delivery_stop.get("name", ""),
            "address": delivery_stop.get("address", ""),
            "city": delivery_stop.get("city", ""),
            "state": delivery_stop.get("state", ""),
            "zip": delivery_stop.get("zip_code", ""),
            "contact": delivery_stop.get("contact_name", ""),
            "phone": delivery_stop.get("contact_phone", ""),
            "location_number": "",
        },

        # Third Party / Bill To
        "third_party": {
            "name": customer.get("name") if customer else "",
            "address": customer.get("address_line1", "") if customer else "",
            "city": customer.get("city", "") if customer else "",
            "state": customer.get("state", "") if customer else "",
            "zip": customer.get("zip_code", "") if customer else "",
        },

        # Carrier Information
        "carrier": {
            "name": carrier.get("name") if carrier else "",
            "mc_number": carrier.get("mc_number") if carrier else "",
            "dot_number": carrier.get("dot_number", "") if carrier else "",
            "scac_code": carrier.get("scac_code", "") if carrier else "",
            "trailer_number": shipment.get("trailer_number", ""),
            "seal_number": shipment.get("seal_number", ""),
            "pro_number": shipment.get("pro_number", ""),
        },

        # Commodity / Freight Details (line items)
        "freight_items": [
            {
                "handling_unit_qty": shipment.get("pieces") or 1,
                "handling_unit_type": shipment.get("packaging_type", "PLT"),  # PLT, CTN, DRM, etc.
                "package_qty": shipment.get("pieces") or 1,
                "package_type": shipment.get("packaging_type", "PLT"),
                "weight_lbs": shipment.get("weight_lbs"),
                "hazmat": shipment.get("hazmat", False),
                "hazmat_class": shipment.get("hazmat_class", ""),
                "hazmat_un_number": shipment.get("hazmat_un_number", ""),
                "hazmat_packing_group": shipment.get("hazmat_packing_group", ""),
                "commodity_description": shipment.get("commodity", ""),
                "nmfc_number": shipment.get("nmfc_number", ""),
                "freight_class": shipment.get("freight_class", ""),
            },
        ],

        # Summary fields
        "commodity": shipment.get("commodity", ""),
        "weight_lbs": shipment.get("weight_lbs"),
        "equipment_type": shipment.get("equipment_type", ""),
        "pickup_date": str(shipment.get("pickup_date", "")),
        "delivery_date": str(shipment.get("delivery_date", "")),
        "special_instructions": shipment.get("special_instructions", ""),
        "reference_numbers": shipment.get("reference_numbers", []),
        "pieces": shipment.get("pieces"),
        "template_name": template.get("name") if template else "Standard BOL",

        # Additional BOL fields
        "prepaid_or_collect": "prepaid",  # "prepaid", "collect", "third_party"
        "cod_amount": None,
        "declared_value": None,
        "emergency_contact": shipment.get("emergency_contact", ""),
        "hazmat": shipment.get("hazmat", False),
    }

    # Merge custom fields
    if data and data.custom_fields:
        bol_data.update(data.custom_fields)

    # Store BOL record
    bol_record = {
        "_id": ObjectId(),
        "shipment_id": shipment_oid,
        "customer_id": shipment.get("customer_id"),
        "bol_data": bol_data,
        "template_id": ObjectId(data.template_id) if data and data.template_id else None,
        "generated_at": datetime.utcnow(),
        "sent_to": data.send_to_emails if data else None,
        "created_at": datetime.utcnow(),
    }
    await db.generated_bols.insert_one(bol_record)

    return {
        "status": "generated",
        "bol_id": str(bol_record["_id"]),
        "bol_number": bol_data["bol_number"],
        "bol_data": bol_data,
        "download_url": f"/api/v1/documents/bol/{bol_record['_id']}/download",
    }


@router.get("/bol/{bol_id}")
async def get_bol(bol_id: str):
    """Get a generated BOL by ID for viewing/printing."""
    db = get_database()

    bol_record = await db.generated_bols.find_one({"_id": ObjectId(bol_id)})
    if not bol_record:
        raise HTTPException(status_code=404, detail="BOL not found")

    return {
        "bol_id": str(bol_record["_id"]),
        "shipment_id": str(bol_record["shipment_id"]),
        "bol_data": bol_record["bol_data"],
        "generated_at": bol_record.get("generated_at"),
    }


@router.get("/bol-history/{shipment_id}")
async def get_bol_history(shipment_id: str):
    """Get all generated BOLs for a shipment."""
    db = get_database()

    cursor = db.generated_bols.find(
        {"shipment_id": ObjectId(shipment_id)}
    ).sort("generated_at", -1)
    bols = await cursor.to_list(50)

    return [
        {
            "bol_id": str(b["_id"]),
            "bol_number": b.get("bol_data", {}).get("bol_number", ""),
            "generated_at": b.get("generated_at"),
            "template_name": b.get("bol_data", {}).get("template_name", "Standard BOL"),
        }
        for b in bols
    ]


@router.get("/bol-templates")
async def list_bol_templates(customer_id: Optional[str] = None):
    """List available BOL templates."""
    db = get_database()
    query = {}
    if customer_id:
        query["$or"] = [{"customer_id": ObjectId(customer_id)}, {"is_global": True}]
    else:
        query["is_global"] = True

    templates = await db.bol_templates.find(query).to_list(50)

    # If no templates exist, return default
    if not templates:
        return [{
            "id": "default",
            "name": "Standard BOL",
            "description": "Default Bill of Lading template",
            "is_default": True,
            "is_global": True,
            "fields": ["shipper", "consignee", "carrier", "commodity", "weight", "pieces", "instructions"],
        }]

    return [
        {
            "id": str(t["_id"]),
            "name": t.get("name", ""),
            "description": t.get("description", ""),
            "customer_id": str(t["customer_id"]) if t.get("customer_id") else None,
            "is_default": t.get("is_default", False),
            "is_global": t.get("is_global", False),
            "fields": t.get("fields", []),
            "created_at": t.get("created_at"),
        }
        for t in templates
    ]


@router.post("/bol-templates")
async def create_bol_template(data: dict):
    """Create a custom BOL template."""
    db = get_database()

    template = {
        "_id": ObjectId(),
        "name": data.get("name", "Custom Template"),
        "description": data.get("description", ""),
        "customer_id": ObjectId(data["customer_id"]) if data.get("customer_id") else None,
        "is_default": data.get("is_default", False),
        "is_global": data.get("is_global", False),
        "fields": data.get("fields", []),
        "header_text": data.get("header_text"),
        "footer_text": data.get("footer_text"),
        "logo_url": data.get("logo_url"),
        "created_at": datetime.utcnow(),
    }

    await db.bol_templates.insert_one(template)

    return {
        "id": str(template["_id"]),
        "name": template["name"],
        "status": "created",
    }


# ============================================================================
# AI Document Classification
# ============================================================================

class ClassificationResult(BaseModel):
    document_id: str
    original_type: Optional[str] = None
    ai_classified_type: str
    confidence: float
    suggested_workflow: Optional[str] = None
    extracted_fields: Optional[List[dict]] = None


@router.post("/classify", response_model=ClassificationResult)
async def classify_document_ai(data: dict):
    """AI-powered document classification and field extraction."""
    db = get_database()

    document_id = data.get("document_id")
    if not document_id:
        raise HTTPException(status_code=400, detail="document_id required")

    doc = await db.documents.find_one({"_id": ObjectId(document_id)})
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    # Use document processing service for AI classification
    try:
        processor = get_document_processor()
        processed = await processor.process_document(document_id)

        # Determine workflow routing
        workflow_map = {
            "bol": "operations",
            "pod": "operations",
            "rate_confirmation": "operations",
            "invoice": "billing",
            "carrier_invoice": "billing",
            "insurance_certificate": "compliance",
            "commercial_invoice": "customs",
            "certificate_of_origin": "customs",
            "customs_entry": "customs",
        }

        classified_type = doc.get("ai_classified_type") or doc.get("document_type")

        # Re-fetch the document after processing
        updated_doc = await db.documents.find_one({"_id": ObjectId(document_id)})

        return ClassificationResult(
            document_id=document_id,
            original_type=doc.get("document_type"),
            ai_classified_type=updated_doc.get("ai_classified_type") or updated_doc.get("document_type"),
            confidence=updated_doc.get("classification_confidence") or updated_doc.get("ocr_confidence") or 0.5,
            suggested_workflow=workflow_map.get(updated_doc.get("ai_classified_type") or updated_doc.get("document_type")),
            extracted_fields=updated_doc.get("extracted_fields"),
        )
    except Exception as e:
        # Fallback to pattern-based classification
        from app.services.document_classification import classify_document as classify_by_pattern

        classification, confidence, extracted_data = classify_by_pattern(
            filename=doc.get("original_filename", ""),
            file_type=doc.get("mime_type", ""),
        )

        await db.documents.update_one(
            {"_id": ObjectId(document_id)},
            {"$set": {
                "ai_classified_type": classification,
                "classification_confidence": confidence,
                "extraction_status": "complete",
            }}
        )

        return ClassificationResult(
            document_id=document_id,
            original_type=doc.get("document_type"),
            ai_classified_type=classification,
            confidence=confidence,
            suggested_workflow=None,
        )


@router.get("/classification-types")
async def get_classification_types():
    """Get supported document classification types and their workflow routing."""
    classifications = get_supported_classifications()
    routing = {}
    for cls in classifications:
        route = get_workflow_routing(cls["value"])
        if route:
            routing[cls["value"]] = route

    return {
        "classifications": classifications,
        "workflow_routing": routing,
    }


# ============================================================================
# Batch Document Upload
# ============================================================================

@router.post("/batch-upload")
async def batch_upload_documents(
    background_tasks: BackgroundTasks,
    files: List[UploadFile] = File(...),
    document_type: DocumentType = Form(DocumentType.OTHER),
    shipment_id: Optional[str] = Form(None),
    auto_classify: bool = Form(True),
    source: str = Form("batch_upload"),
):
    """Upload multiple documents at once with optional AI classification."""
    db = get_database()
    os.makedirs(UPLOAD_DIR, exist_ok=True)

    results = []
    for file in files:
        ext = os.path.splitext(file.filename)[1] if file.filename else ""
        filename = f"{uuid.uuid4()}{ext}"
        filepath = os.path.join(UPLOAD_DIR, filename)

        async with aiofiles.open(filepath, 'wb') as f:
            content = await file.read()
            await f.write(content)

        doc_data = {
            "document_type": document_type.value,
            "filename": filename,
            "original_filename": file.filename or "unknown",
            "mime_type": file.content_type or "application/octet-stream",
            "size_bytes": len(content),
            "storage_path": filepath,
            "storage_provider": "local",
            "shipment_id": ObjectId(shipment_id) if shipment_id else None,
            "source": source,
            "extraction_status": "pending" if auto_classify else "skipped",
            "is_verified": False,
            "needs_review": auto_classify,
            "auto_matched": False,
            "created_at": datetime.utcnow(),
        }

        result = await db.documents.insert_one(doc_data)
        doc_data["_id"] = result.inserted_id

        if auto_classify:
            background_tasks.add_task(process_document_background, str(result.inserted_id))

        results.append({
            "id": str(result.inserted_id),
            "filename": file.filename,
            "status": "uploaded",
            "auto_classify": auto_classify,
        })

    return {
        "status": "uploaded",
        "total_files": len(results),
        "files": results,
    }


# ============================================================================
# Photo/Document Capture for Shipments
# ============================================================================

class PhotoCategory(str, __import__("enum").Enum):
    DELIVERY = "delivery"
    DAMAGE = "damage"
    BOL = "bol"
    LOADING = "loading"
    UNLOADING = "unloading"
    OTHER = "other"


@router.post("/photos/{shipment_id}")
async def upload_shipment_photos(
    shipment_id: str,
    background_tasks: BackgroundTasks,
    files: List[UploadFile] = File(...),
    category: str = Form("delivery"),
    notes: Optional[str] = Form(None),
):
    """Upload photos for a shipment (delivery, damage, BOL, etc.)."""
    db = get_database()
    shipment_oid = ObjectId(shipment_id)

    shipment = await db.shipments.find_one({"_id": shipment_oid})
    if not shipment:
        raise HTTPException(status_code=404, detail="Shipment not found")

    os.makedirs(UPLOAD_DIR, exist_ok=True)
    uploaded_photos = []

    for file in files:
        ext = os.path.splitext(file.filename)[1] if file.filename else ".jpg"
        filename = f"photo_{uuid.uuid4()}{ext}"
        filepath = os.path.join(UPLOAD_DIR, filename)

        async with aiofiles.open(filepath, 'wb') as f:
            content = await file.read()
            await f.write(content)

        photo_doc = {
            "_id": ObjectId(),
            "shipment_id": shipment_oid,
            "category": category,
            "filename": filename,
            "original_filename": file.filename or "photo",
            "mime_type": file.content_type or "image/jpeg",
            "size_bytes": len(content),
            "storage_path": filepath,
            "notes": notes,
            "annotations": [],
            "ai_analysis": None,
            "created_at": datetime.utcnow(),
        }

        await db.shipment_photos.insert_one(photo_doc)
        uploaded_photos.append({
            "id": str(photo_doc["_id"]),
            "filename": file.filename,
            "category": category,
            "size_bytes": len(content),
        })

    return {
        "status": "uploaded",
        "shipment_id": shipment_id,
        "photo_count": len(uploaded_photos),
        "photos": uploaded_photos,
    }


@router.get("/photos/{shipment_id}")
async def get_shipment_photos(shipment_id: str, category: Optional[str] = None):
    """Get photos for a shipment."""
    db = get_database()
    query = {"shipment_id": ObjectId(shipment_id)}
    if category:
        query["category"] = category

    photos = await db.shipment_photos.find(query).sort("created_at", -1).to_list(100)

    return [
        {
            "id": str(p["_id"]),
            "category": p.get("category"),
            "filename": p.get("original_filename"),
            "size_bytes": p.get("size_bytes"),
            "notes": p.get("notes"),
            "annotations": p.get("annotations", []),
            "created_at": p.get("created_at"),
        }
        for p in photos
    ]


@router.post("/photos/{photo_id}/annotate")
async def annotate_photo(photo_id: str, data: dict):
    """Add annotation to a photo (for marking damage, etc.)."""
    db = get_database()

    photo = await db.shipment_photos.find_one({"_id": ObjectId(photo_id)})
    if not photo:
        raise HTTPException(status_code=404, detail="Photo not found")

    annotation = {
        "type": data.get("type", "text"),  # text, circle, arrow, rectangle
        "x": data.get("x", 0),
        "y": data.get("y", 0),
        "width": data.get("width"),
        "height": data.get("height"),
        "text": data.get("text", ""),
        "color": data.get("color", "#FF0000"),
        "created_at": datetime.utcnow().isoformat(),
    }

    await db.shipment_photos.update_one(
        {"_id": ObjectId(photo_id)},
        {"$push": {"annotations": annotation}}
    )

    return {"status": "annotated", "photo_id": photo_id, "annotation": annotation}


# ============================================================================
# Document Image Enhancement
# ============================================================================

@router.post("/enhance-image/{document_id}")
async def enhance_document_image(document_id: str, data: dict):
    """Apply image enhancements: rotation, crop, brightness adjustments."""
    db = get_database()

    doc = await db.documents.find_one({"_id": ObjectId(document_id)})
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    # Store enhancement parameters (actual image processing happens on retrieval)
    enhancements = {
        "rotation_degrees": data.get("rotation_degrees", 0),
        "crop": data.get("crop"),  # {x, y, width, height}
        "brightness": data.get("brightness", 1.0),
        "contrast": data.get("contrast", 1.0),
        "auto_deskew": data.get("auto_deskew", False),
    }

    await db.documents.update_one(
        {"_id": ObjectId(document_id)},
        {"$set": {
            "image_enhancements": enhancements,
            "updated_at": datetime.utcnow(),
        }}
    )

    return {
        "status": "enhanced",
        "document_id": document_id,
        "enhancements_applied": enhancements,
    }


# ============================================================================
# Mobile Document Scanning / Camera Capture
# ============================================================================


class ScanUploadRequest(BaseModel):
    """Upload a scanned/captured document image."""
    image_data: str  # Base64-encoded image data
    filename: Optional[str] = None
    document_type: Optional[str] = "other"
    shipment_id: Optional[str] = None
    carrier_id: Optional[str] = None
    source: str = "mobile"
    auto_process: bool = True


@router.post("/scan-upload")
async def upload_scanned_document(
    data: ScanUploadRequest,
    background_tasks: BackgroundTasks,
):
    """Upload a document captured via mobile camera/scanner.

    Accepts base64-encoded image data, stores it, and queues for AI processing.
    """
    import base64 as b64

    db = get_database()

    # Decode base64 image
    try:
        # Handle data URL format: "data:image/jpeg;base64,..."
        image_b64 = data.image_data
        mime_type = "image/jpeg"
        if image_b64.startswith("data:"):
            header, image_b64 = image_b64.split(",", 1)
            # Extract mime type from header
            mime_parts = header.split(";")[0].split(":")
            if len(mime_parts) > 1:
                mime_type = mime_parts[1]

        image_bytes = b64.b64decode(image_b64)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid image data: {str(e)}")

    # Determine file extension from mime type
    ext_map = {
        "image/jpeg": ".jpg",
        "image/png": ".png",
        "image/webp": ".webp",
        "image/gif": ".gif",
    }
    ext = ext_map.get(mime_type, ".jpg")

    # Generate unique filename
    filename = f"scan_{uuid.uuid4()}{ext}"
    filepath = os.path.join(UPLOAD_DIR, filename)
    os.makedirs(UPLOAD_DIR, exist_ok=True)

    # Save file
    async with aiofiles.open(filepath, 'wb') as f:
        await f.write(image_bytes)

    # Auto-classify by filename if provided
    original_filename = data.filename or f"scan{ext}"
    doc_type = data.document_type or "other"
    ai_classified_type = None
    classification_confidence = None

    if doc_type == "other" and original_filename:
        classification, confidence, _extracted = classify_by_pattern(
            filename=original_filename,
            file_type=mime_type,
        )
        if classification != "unknown" and confidence >= 0.7:
            try:
                mapped_type = DocumentType(classification)
                doc_type = mapped_type.value
                ai_classified_type = classification
                classification_confidence = confidence
            except ValueError:
                ai_classified_type = classification
                classification_confidence = confidence

    # Create document record
    doc_data = {
        "document_type": doc_type,
        "filename": filename,
        "original_filename": original_filename,
        "mime_type": mime_type,
        "size_bytes": len(image_bytes),
        "storage_path": filepath,
        "storage_provider": "local",
        "shipment_id": ObjectId(data.shipment_id) if data.shipment_id else None,
        "carrier_id": ObjectId(data.carrier_id) if data.carrier_id else None,
        "source": data.source,
        "extraction_status": ExtractionStatus.PENDING.value if data.auto_process else ExtractionStatus.SKIPPED.value,
        "is_verified": False,
        "needs_review": False,
        "auto_matched": False,
        "ai_classified_type": ai_classified_type,
        "classification_confidence": classification_confidence,
        "created_at": datetime.utcnow(),
    }

    result = await db.documents.insert_one(doc_data)
    doc_data["_id"] = result.inserted_id

    # Queue AI processing in background
    if data.auto_process:
        background_tasks.add_task(process_document_background, str(result.inserted_id))

    return doc_to_response(doc_data)


@router.post("/{document_id}/ocr")
async def extract_ocr_text(document_id: str, background_tasks: BackgroundTasks):
    """Run OCR text extraction on a document."""
    db = get_database()

    doc = await db.documents.find_one({"_id": ObjectId(document_id)})
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    # Queue AI processing
    background_tasks.add_task(process_document_background, document_id)

    await db.documents.update_one(
        {"_id": ObjectId(document_id)},
        {"$set": {"extraction_status": "pending"}}
    )

    return {
        "status": "processing",
        "document_id": document_id,
        "message": "OCR extraction queued",
    }
