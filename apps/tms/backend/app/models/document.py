from datetime import datetime
from enum import Enum
from typing import Optional

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
    OTHER = "other"


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

    # Status
    is_verified: bool = False
    verified_by: Optional[str] = None
    verified_at: Optional[datetime] = None
