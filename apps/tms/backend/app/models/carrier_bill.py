from datetime import datetime
from enum import Enum
from typing import Optional

from .base import MongoModel, PyObjectId, utc_now


class CarrierBillStatus(str, Enum):
    """Status of a carrier bill."""
    RECEIVED = "received"
    MATCHED = "matched"
    DISPUTED = "disputed"
    APPROVED = "approved"
    PAID = "paid"


CARRIER_BILL_STATUS_TRANSITIONS: dict[CarrierBillStatus, list[CarrierBillStatus]] = {
    CarrierBillStatus.RECEIVED: [CarrierBillStatus.MATCHED, CarrierBillStatus.DISPUTED],
    CarrierBillStatus.MATCHED: [CarrierBillStatus.APPROVED, CarrierBillStatus.DISPUTED],
    CarrierBillStatus.DISPUTED: [CarrierBillStatus.MATCHED, CarrierBillStatus.APPROVED],
    CarrierBillStatus.APPROVED: [CarrierBillStatus.PAID],
    CarrierBillStatus.PAID: [],
}


class CarrierBill(MongoModel):
    """A bill received from a carrier for a shipment."""

    # Links
    carrier_id: PyObjectId
    shipment_id: PyObjectId

    # Bill info
    bill_number: str
    amount: int  # In cents

    # Dates
    received_date: datetime = None  # type: ignore[assignment]
    due_date: Optional[datetime] = None

    # Status
    status: CarrierBillStatus = CarrierBillStatus.RECEIVED

    # Matching
    matched_tender_id: Optional[PyObjectId] = None
    variance_amount: Optional[int] = None  # Difference from tender in cents
    variance_reason: Optional[str] = None

    # Approval / Payment
    approved_by: Optional[str] = None
    paid_at: Optional[datetime] = None

    # Notes
    notes: Optional[str] = None

    def __init__(self, **data):
        if data.get("received_date") is None:
            data["received_date"] = utc_now()
        super().__init__(**data)

    def can_transition_to(self, new_status: CarrierBillStatus) -> bool:
        """Check if status transition is valid."""
        return new_status in CARRIER_BILL_STATUS_TRANSITIONS.get(self.status, [])

    def transition_to(self, new_status: CarrierBillStatus) -> None:
        """Transition to new status if valid."""
        if not self.can_transition_to(new_status):
            raise ValueError(f"Cannot transition from {self.status} to {new_status}")
        self.status = new_status
        if new_status == CarrierBillStatus.PAID:
            self.paid_at = utc_now()
        self.mark_updated()
