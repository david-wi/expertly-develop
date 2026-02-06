from datetime import datetime
from enum import Enum
from typing import Optional, Dict, Any

from .base import MongoModel, PyObjectId, utc_now


class InboxSource(str, Enum):
    """Source of incoming document."""
    EMAIL = "email"
    UPLOAD = "upload"
    FAX = "fax"
    EDI = "edi"


class InboxFileType(str, Enum):
    """File type of the document."""
    PDF = "pdf"
    IMAGE = "image"
    CSV = "csv"
    EXCEL = "excel"


class InboxClassification(str, Enum):
    """AI classification of document type."""
    BOL = "bol"
    POD = "pod"
    RATE_CONFIRMATION = "rate_confirmation"
    INVOICE = "invoice"
    INSURANCE_CERT = "insurance_cert"
    CUSTOMS_DOC = "customs_doc"
    UNKNOWN = "unknown"


class InboxStatus(str, Enum):
    """Status of inbox item."""
    NEW = "new"
    CLASSIFIED = "classified"
    LINKED = "linked"
    ARCHIVED = "archived"


class DocumentInboxItem(MongoModel):
    """An incoming document in the inbox awaiting classification and linking."""

    # Source info
    source: InboxSource = InboxSource.UPLOAD
    source_email: Optional[str] = None

    # File info
    filename: str
    file_type: InboxFileType = InboxFileType.PDF
    file_size: int = 0  # In bytes

    # AI Classification
    classification: Optional[InboxClassification] = None
    classification_confidence: Optional[float] = None

    # Entity linking
    linked_entity_type: Optional[str] = None  # "shipment", "carrier", "customer", "invoice"
    linked_entity_id: Optional[PyObjectId] = None

    # Status
    status: InboxStatus = InboxStatus.NEW

    # AI-extracted metadata
    metadata: Dict[str, Any] = {}

    # Processing
    processed_at: Optional[datetime] = None
    processed_by: Optional[str] = None
