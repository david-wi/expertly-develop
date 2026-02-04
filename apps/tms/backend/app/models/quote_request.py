from datetime import datetime
from enum import Enum
from typing import Optional, Any, List
from pydantic import BaseModel, Field

from .base import MongoModel, PyObjectId


class QuoteRequestStatus(str, Enum):
    """Quote request status state machine."""
    NEW = "new"
    IN_PROGRESS = "in_progress"
    QUOTED = "quoted"
    DECLINED = "declined"
    EXPIRED = "expired"


QUOTE_REQUEST_TRANSITIONS: dict[QuoteRequestStatus, list[QuoteRequestStatus]] = {
    QuoteRequestStatus.NEW: [QuoteRequestStatus.IN_PROGRESS, QuoteRequestStatus.QUOTED, QuoteRequestStatus.DECLINED],
    QuoteRequestStatus.IN_PROGRESS: [QuoteRequestStatus.QUOTED, QuoteRequestStatus.DECLINED, QuoteRequestStatus.EXPIRED],
    QuoteRequestStatus.QUOTED: [QuoteRequestStatus.EXPIRED],
    QuoteRequestStatus.DECLINED: [],
    QuoteRequestStatus.EXPIRED: [],
}


class ExtractedField(BaseModel):
    """Field extracted by AI with evidence."""
    value: Any
    confidence: float = 0.0  # 0-1
    evidence_text: Optional[str] = None  # exact text extracted from
    evidence_source: str = "unknown"  # "email_body", "attachment", "subject"


class QuoteRequest(MongoModel):
    """Incoming rate request before it becomes a formal quote."""

    # Source
    source_type: str = "email"  # "email", "phone", "portal", "manual"
    source_email: Optional[str] = None
    source_subject: Optional[str] = None
    raw_content: Optional[str] = None  # Full email body or notes

    # Customer matching
    customer_id: Optional[PyObjectId] = None  # Matched customer
    sender_email: Optional[str] = None
    sender_name: Optional[str] = None

    # Status
    status: QuoteRequestStatus = QuoteRequestStatus.NEW
    assigned_to: Optional[str] = None  # User ID

    # AI-extracted fields (with evidence)
    extracted_origin_city: Optional[ExtractedField] = None
    extracted_origin_state: Optional[ExtractedField] = None
    extracted_origin_zip: Optional[ExtractedField] = None
    extracted_destination_city: Optional[ExtractedField] = None
    extracted_destination_state: Optional[ExtractedField] = None
    extracted_destination_zip: Optional[ExtractedField] = None
    extracted_pickup_date: Optional[ExtractedField] = None
    extracted_delivery_date: Optional[ExtractedField] = None
    extracted_equipment_type: Optional[ExtractedField] = None
    extracted_weight: Optional[ExtractedField] = None
    extracted_commodity: Optional[ExtractedField] = None
    extracted_special_requirements: Optional[ExtractedField] = None

    # Fields identified as missing or unclear
    missing_fields: List[str] = Field(default_factory=list)
    clarification_needed: Optional[str] = None

    # Resulting quote (if created)
    quote_id: Optional[PyObjectId] = None

    # Timing
    received_at: datetime = Field(default_factory=lambda: datetime.now())
    responded_at: Optional[datetime] = None

    def can_transition_to(self, new_status: QuoteRequestStatus) -> bool:
        """Check if status transition is valid."""
        return new_status in QUOTE_REQUEST_TRANSITIONS.get(self.status, [])

    def transition_to(self, new_status: QuoteRequestStatus) -> None:
        """Transition to new status if valid."""
        if not self.can_transition_to(new_status):
            raise ValueError(f"Cannot transition from {self.status} to {new_status}")
        self.status = new_status
        self.mark_updated()

    @property
    def extraction_confidence(self) -> float:
        """Calculate average confidence of all extractions."""
        fields = [
            self.extracted_origin_city,
            self.extracted_origin_state,
            self.extracted_destination_city,
            self.extracted_destination_state,
            self.extracted_pickup_date,
            self.extracted_equipment_type,
        ]
        confidences = [f.confidence for f in fields if f is not None]
        if not confidences:
            return 0.0
        return sum(confidences) / len(confidences)
