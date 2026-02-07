from datetime import datetime
from enum import Enum
from typing import List, Optional

from pydantic import BaseModel, Field

from .base import MongoModel, PyObjectId, utc_now


class TenderStatus(str, Enum):
    """Tender/offer status state machine."""
    DRAFT = "draft"
    SENT = "sent"
    ACCEPTED = "accepted"
    DECLINED = "declined"
    EXPIRED = "expired"
    CANCELLED = "cancelled"
    COUNTER_OFFERED = "counter_offered"


TENDER_STATUS_TRANSITIONS: dict[TenderStatus, list[TenderStatus]] = {
    TenderStatus.DRAFT: [TenderStatus.SENT, TenderStatus.CANCELLED],
    TenderStatus.SENT: [TenderStatus.ACCEPTED, TenderStatus.DECLINED, TenderStatus.EXPIRED, TenderStatus.CANCELLED, TenderStatus.COUNTER_OFFERED],
    TenderStatus.COUNTER_OFFERED: [TenderStatus.ACCEPTED, TenderStatus.DECLINED, TenderStatus.CANCELLED, TenderStatus.COUNTER_OFFERED],
    TenderStatus.ACCEPTED: [],
    TenderStatus.DECLINED: [],
    TenderStatus.EXPIRED: [],
    TenderStatus.CANCELLED: [],
}


class NegotiationEvent(BaseModel):
    """A single event in the negotiation thread for a tender."""
    timestamp: datetime = Field(default_factory=utc_now)
    action: str  # "tender_sent", "counter_offer", "counter_accepted", "counter_rejected", "accepted", "declined", "expired"
    amount: int  # Rate in cents at this point
    party: str  # "broker" or "carrier"
    notes: Optional[str] = None
    auto_action: bool = False  # True if auto-approved/auto-escalated


class Tender(MongoModel):
    """Tender/offer sent to a carrier for a shipment."""

    # Links
    shipment_id: PyObjectId
    carrier_id: PyObjectId

    # Status
    status: TenderStatus = TenderStatus.DRAFT

    # Offer
    offered_rate: int  # In cents
    rate_type: str = "all_in"  # "all_in", "linehaul", "per_mile"
    fuel_surcharge: Optional[int] = None  # In cents if separate
    accessorials: Optional[str] = None  # Any included accessorials

    # Timing
    expires_at: Optional[datetime] = None
    sent_at: Optional[datetime] = None
    responded_at: Optional[datetime] = None

    # Communication
    sent_via: Optional[str] = None  # "email", "phone", "load_board"
    sent_to_email: Optional[str] = None
    sent_to_phone: Optional[str] = None

    # Response
    response_notes: Optional[str] = None
    counter_offer_rate: Optional[int] = None  # If they counter
    counter_offer_notes: Optional[str] = None

    # Negotiation thread - embedded array of all offers/counter-offers
    negotiation_history: List[dict] = Field(default_factory=list)

    # Internal
    notes: Optional[str] = None
    created_by: Optional[str] = None

    # Waterfall reference
    waterfall_id: Optional[PyObjectId] = None
    waterfall_step: Optional[int] = None

    def can_transition_to(self, new_status: TenderStatus) -> bool:
        """Check if status transition is valid."""
        return new_status in TENDER_STATUS_TRANSITIONS.get(self.status, [])

    def transition_to(self, new_status: TenderStatus) -> None:
        """Transition to new status if valid."""
        if not self.can_transition_to(new_status):
            raise ValueError(f"Cannot transition from {self.status} to {new_status}")
        self.status = new_status
        if new_status == TenderStatus.SENT:
            self.sent_at = utc_now()
        elif new_status in [TenderStatus.ACCEPTED, TenderStatus.DECLINED]:
            self.responded_at = utc_now()
        self.mark_updated()

    def add_negotiation_event(self, action: str, amount: int, party: str, notes: Optional[str] = None, auto_action: bool = False) -> None:
        """Add a negotiation event to the history thread."""
        event = NegotiationEvent(
            action=action,
            amount=amount,
            party=party,
            notes=notes,
            auto_action=auto_action,
        )
        self.negotiation_history.append(event.model_dump())
        self.mark_updated()
