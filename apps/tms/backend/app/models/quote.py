from datetime import datetime
from enum import Enum
from typing import Optional, List
from pydantic import BaseModel, Field

from .base import MongoModel, PyObjectId, utc_now


class QuoteStatus(str, Enum):
    """Quote status state machine."""
    DRAFT = "draft"
    PENDING_APPROVAL = "pending_approval"  # Internal approval
    SENT = "sent"
    ACCEPTED = "accepted"
    DECLINED = "declined"
    EXPIRED = "expired"


QUOTE_STATUS_TRANSITIONS: dict[QuoteStatus, list[QuoteStatus]] = {
    QuoteStatus.DRAFT: [QuoteStatus.PENDING_APPROVAL, QuoteStatus.SENT],
    QuoteStatus.PENDING_APPROVAL: [QuoteStatus.SENT, QuoteStatus.DRAFT],
    QuoteStatus.SENT: [QuoteStatus.ACCEPTED, QuoteStatus.DECLINED, QuoteStatus.EXPIRED],
    QuoteStatus.ACCEPTED: [],
    QuoteStatus.DECLINED: [QuoteStatus.DRAFT],  # Can re-quote
    QuoteStatus.EXPIRED: [QuoteStatus.DRAFT],  # Can re-quote
}


class QuoteLineItem(BaseModel):
    """Line item on a quote."""
    description: str
    quantity: int = 1
    unit_price: int  # In cents
    is_accessorial: bool = False  # Fuel, detention, etc.

    @property
    def total(self) -> int:
        """Calculate line item total."""
        return self.quantity * self.unit_price


class Quote(MongoModel):
    """Formal quote to a customer."""

    # Reference
    quote_number: str  # e.g., "Q-2024-00001"

    # Links
    customer_id: PyObjectId
    quote_request_id: Optional[PyObjectId] = None

    # Status
    status: QuoteStatus = QuoteStatus.DRAFT

    # Origin
    origin_facility_id: Optional[PyObjectId] = None
    origin_city: str
    origin_state: str
    origin_zip: Optional[str] = None
    origin_address: Optional[str] = None

    # Destination
    destination_facility_id: Optional[PyObjectId] = None
    destination_city: str
    destination_state: str
    destination_zip: Optional[str] = None
    destination_address: Optional[str] = None

    # Dates
    pickup_date: Optional[datetime] = None
    pickup_date_flexible: bool = False
    delivery_date: Optional[datetime] = None
    delivery_date_flexible: bool = False

    # Load details
    equipment_type: str = "van"
    weight_lbs: Optional[int] = None
    commodity: Optional[str] = None
    special_requirements: Optional[str] = None

    # Pricing
    line_items: List[QuoteLineItem] = Field(default_factory=list)
    total_price: int = 0  # In cents
    estimated_cost: int = 0  # In cents (what we expect to pay carrier)
    margin_percent: float = 0.0  # Calculated margin

    # Valid period
    valid_until: Optional[datetime] = None

    # Communication
    sent_at: Optional[datetime] = None
    sent_to: Optional[str] = None  # Email address
    customer_response_at: Optional[datetime] = None
    customer_response_notes: Optional[str] = None

    # Internal
    internal_notes: Optional[str] = None
    created_by: Optional[str] = None

    # Resulting shipment (if booked)
    shipment_id: Optional[PyObjectId] = None

    def calculate_totals(self) -> None:
        """Recalculate total price and margin."""
        self.total_price = sum(item.total for item in self.line_items)
        if self.total_price > 0 and self.estimated_cost > 0:
            self.margin_percent = ((self.total_price - self.estimated_cost) / self.total_price) * 100
        self.mark_updated()

    def can_transition_to(self, new_status: QuoteStatus) -> bool:
        """Check if status transition is valid."""
        return new_status in QUOTE_STATUS_TRANSITIONS.get(self.status, [])

    def transition_to(self, new_status: QuoteStatus) -> None:
        """Transition to new status if valid."""
        if not self.can_transition_to(new_status):
            raise ValueError(f"Cannot transition from {self.status} to {new_status}")
        self.status = new_status
        if new_status == QuoteStatus.SENT:
            self.sent_at = utc_now()
        elif new_status in [QuoteStatus.ACCEPTED, QuoteStatus.DECLINED]:
            self.customer_response_at = utc_now()
        self.mark_updated()
