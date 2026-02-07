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


class QuoteApprovalStatus(str, Enum):
    """Approval status for quotes requiring manager sign-off."""
    NOT_REQUIRED = "not_required"
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"
    AUTO_APPROVED = "auto_approved"


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


class QuoteRevisionSnapshot(BaseModel):
    """A snapshot of a quote at a point in time for version history."""
    version: int
    revised_at: datetime = Field(default_factory=utc_now)
    revised_by: Optional[str] = None
    change_summary: Optional[str] = None
    line_items: List[QuoteLineItem] = Field(default_factory=list)
    total_price: int = 0
    estimated_cost: int = 0
    margin_percent: float = 0.0
    origin_city: Optional[str] = None
    origin_state: Optional[str] = None
    destination_city: Optional[str] = None
    destination_state: Optional[str] = None
    equipment_type: Optional[str] = None
    weight_lbs: Optional[int] = None
    special_requirements: Optional[str] = None
    internal_notes: Optional[str] = None


class CustomerPricingApplied(BaseModel):
    """Record of customer-specific pricing that was applied to a quote."""
    rate_table_id: Optional[str] = None
    rate_table_name: Optional[str] = None
    playbook_id: Optional[str] = None
    playbook_name: Optional[str] = None
    discount_percent: float = 0.0
    contract_rate_per_mile: Optional[int] = None  # cents
    contract_flat_rate: Optional[int] = None  # cents
    applied_at: datetime = Field(default_factory=utc_now)
    auto_applied: bool = False


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

    # === Versioning fields ===
    version_number: int = 1
    parent_quote_id: Optional[PyObjectId] = None  # Original quote if this is a revision
    revision_history: List[QuoteRevisionSnapshot] = Field(default_factory=list)
    is_current_version: bool = True

    # === Customer Pricing fields ===
    customer_pricing_applied: Optional[CustomerPricingApplied] = None

    # === Approval Workflow fields ===
    approval_status: QuoteApprovalStatus = QuoteApprovalStatus.NOT_REQUIRED
    approval_required: bool = False
    approval_threshold: Optional[int] = None  # cents - quotes above this need approval
    approved_by: Optional[str] = None
    approved_at: Optional[datetime] = None
    rejection_reason: Optional[str] = None
    approval_id: Optional[str] = None  # Reference to Approval collection

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

    def create_revision_snapshot(self, revised_by: Optional[str] = None, change_summary: Optional[str] = None) -> QuoteRevisionSnapshot:
        """Create a snapshot of the current state for revision history."""
        snapshot = QuoteRevisionSnapshot(
            version=self.version_number,
            revised_by=revised_by,
            change_summary=change_summary,
            line_items=self.line_items.copy(),
            total_price=self.total_price,
            estimated_cost=self.estimated_cost,
            margin_percent=self.margin_percent,
            origin_city=self.origin_city,
            origin_state=self.origin_state,
            destination_city=self.destination_city,
            destination_state=self.destination_state,
            equipment_type=self.equipment_type,
            weight_lbs=self.weight_lbs,
            special_requirements=self.special_requirements,
            internal_notes=self.internal_notes,
        )
        return snapshot
