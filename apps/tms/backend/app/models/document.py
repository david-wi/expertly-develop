from datetime import datetime
from enum import Enum
from typing import Optional, List, Dict, Any

from .base import MongoModel, PyObjectId


class DocumentType(str, Enum):
    """Types of documents in TMS."""
    BOL = "bol"  # Bill of Lading
    POD = "pod"  # Proof of Delivery
    RATE_CONFIRMATION = "rate_confirmation"
    LUMPER_RECEIPT = "lumper_receipt"
    SCALE_TICKET = "scale_ticket"
    INVOICE = "invoice"
    CARRIER_INVOICE = "carrier_invoice"
    INSURANCE_CERTIFICATE = "insurance_certificate"
    COMMERCIAL_INVOICE = "commercial_invoice"  # For customs
    PACKING_LIST = "packing_list"
    CERTIFICATE_OF_ORIGIN = "certificate_of_origin"
    CUSTOMS_ENTRY = "customs_entry"
    OTHER = "other"


class ExtractionStatus(str, Enum):
    """Status of document AI extraction."""
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETE = "complete"
    FAILED = "failed"
    SKIPPED = "skipped"  # Not a supported document type


class ExtractedDocumentField(MongoModel):
    """A single extracted field from a document."""
    field_name: str
    value: Any
    confidence: float  # 0-1
    bounding_box: Optional[Dict[str, float]] = None  # x, y, width, height (normalized)
    evidence_text: Optional[str] = None  # Raw text that was extracted


class Document(MongoModel):
    """Document attached to a shipment or entity."""

    document_type: DocumentType
    filename: str
    original_filename: str
    mime_type: str
    size_bytes: int

    # Storage
    storage_path: str  # Path in file storage
    storage_provider: str = "local"  # "local", "s3", etc.

    # Links (one of these should be set)
    shipment_id: Optional[PyObjectId] = None
    quote_id: Optional[PyObjectId] = None
    carrier_id: Optional[PyObjectId] = None
    customer_id: Optional[PyObjectId] = None

    # Metadata
    description: Optional[str] = None
    uploaded_by: Optional[str] = None
    source: Optional[str] = None  # "upload", "email", "api", "mobile"

    # AI Extraction
    extraction_status: ExtractionStatus = ExtractionStatus.PENDING
    extraction_started_at: Optional[datetime] = None
    extraction_completed_at: Optional[datetime] = None
    extraction_error: Optional[str] = None

    # OCR Results
    ocr_text: Optional[str] = None  # Full extracted text
    ocr_confidence: Optional[float] = None  # Overall OCR confidence

    # AI Classification (if type was auto-detected)
    ai_classified_type: Optional[DocumentType] = None
    classification_confidence: Optional[float] = None

    # Extracted Fields (varies by document type)
    extracted_fields: Optional[List[ExtractedDocumentField]] = None

    # Auto-Matching
    suggested_shipment_ids: Optional[List[PyObjectId]] = None
    auto_matched: bool = False
    match_confidence: Optional[float] = None

    # Status
    is_verified: bool = False
    verified_by: Optional[str] = None
    verified_at: Optional[datetime] = None
    needs_review: bool = False  # Flag for human review
    review_notes: Optional[str] = None
