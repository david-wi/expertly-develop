from datetime import datetime
from enum import Enum
from typing import Optional, List
from pydantic import BaseModel, Field

from .base import MongoModel, PyObjectId


class CustomerStatus(str, Enum):
    """Customer status state machine."""
    ACTIVE = "active"
    PAUSED = "paused"
    CREDIT_HOLD = "credit_hold"
    INACTIVE = "inactive"


# Valid status transitions
CUSTOMER_STATUS_TRANSITIONS: dict[CustomerStatus, list[CustomerStatus]] = {
    CustomerStatus.ACTIVE: [CustomerStatus.PAUSED, CustomerStatus.CREDIT_HOLD, CustomerStatus.INACTIVE],
    CustomerStatus.PAUSED: [CustomerStatus.ACTIVE, CustomerStatus.INACTIVE],
    CustomerStatus.CREDIT_HOLD: [CustomerStatus.ACTIVE, CustomerStatus.INACTIVE],
    CustomerStatus.INACTIVE: [CustomerStatus.ACTIVE],
}


class CustomerContact(BaseModel):
    """Customer contact information."""
    name: str
    email: Optional[str] = None
    phone: Optional[str] = None
    role: Optional[str] = None  # e.g., "Logistics Manager", "AP Contact"
    is_primary: bool = False


class Customer(MongoModel):
    """Customer/shipper in the TMS."""

    # Basic info
    name: str
    code: Optional[str] = None  # Customer code/ID for quick reference
    status: CustomerStatus = CustomerStatus.ACTIVE

    # Contacts
    contacts: List[CustomerContact] = Field(default_factory=list)
    billing_email: Optional[str] = None

    # Address
    address_line1: Optional[str] = None
    address_line2: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    zip_code: Optional[str] = None
    country: str = "USA"

    # Pricing/Terms
    payment_terms: int = 30  # Net days
    credit_limit: Optional[int] = None  # In cents
    default_margin_percent: float = 15.0  # Default markup percentage
    pricing_notes: Optional[str] = None

    # Internal notes
    notes: Optional[str] = None

    # Stats (denormalized for quick access)
    total_shipments: int = 0
    total_revenue: int = 0  # In cents
    last_shipment_at: Optional[datetime] = None

    def can_transition_to(self, new_status: CustomerStatus) -> bool:
        """Check if status transition is valid."""
        return new_status in CUSTOMER_STATUS_TRANSITIONS.get(self.status, [])

    def transition_to(self, new_status: CustomerStatus) -> None:
        """Transition to new status if valid."""
        if not self.can_transition_to(new_status):
            raise ValueError(f"Cannot transition from {self.status} to {new_status}")
        self.status = new_status
        self.mark_updated()
