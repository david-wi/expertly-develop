from datetime import datetime
from enum import Enum
from typing import Optional, List
from pydantic import BaseModel, Field

from .base import MongoModel


class CarrierStatus(str, Enum):
    """Carrier status state machine."""
    ACTIVE = "active"
    PENDING = "pending"  # Awaiting compliance review
    SUSPENDED = "suspended"
    DO_NOT_USE = "do_not_use"


CARRIER_STATUS_TRANSITIONS: dict[CarrierStatus, list[CarrierStatus]] = {
    CarrierStatus.ACTIVE: [CarrierStatus.SUSPENDED, CarrierStatus.DO_NOT_USE],
    CarrierStatus.PENDING: [CarrierStatus.ACTIVE, CarrierStatus.DO_NOT_USE],
    CarrierStatus.SUSPENDED: [CarrierStatus.ACTIVE, CarrierStatus.DO_NOT_USE],
    CarrierStatus.DO_NOT_USE: [CarrierStatus.PENDING],
}


class EquipmentType(str, Enum):
    """Standard equipment types."""
    VAN = "van"
    REEFER = "reefer"
    FLATBED = "flatbed"
    STEP_DECK = "step_deck"
    LOWBOY = "lowboy"
    POWER_ONLY = "power_only"
    SPRINTER = "sprinter"
    BOX_TRUCK = "box_truck"
    HOTSHOT = "hotshot"
    CONTAINER = "container"


class CarrierContact(BaseModel):
    """Carrier contact information."""
    name: str
    email: Optional[str] = None
    phone: Optional[str] = None
    role: Optional[str] = None  # e.g., "Dispatch", "Owner"
    is_primary: bool = False


class CarrierLane(BaseModel):
    """Preferred lane for this carrier."""
    origin_city: Optional[str] = None
    origin_state: Optional[str] = None
    destination_city: Optional[str] = None
    destination_state: Optional[str] = None
    equipment_types: List[EquipmentType] = Field(default_factory=list)
    avg_rate_per_mile: Optional[float] = None  # Historical average


class Carrier(MongoModel):
    """Carrier in the TMS."""

    # Basic info
    name: str
    mc_number: Optional[str] = None
    dot_number: Optional[str] = None
    status: CarrierStatus = CarrierStatus.PENDING

    # Contacts
    contacts: List[CarrierContact] = Field(default_factory=list)
    dispatch_email: Optional[str] = None
    dispatch_phone: Optional[str] = None

    # Equipment
    equipment_types: List[EquipmentType] = Field(default_factory=list)

    # Address
    address_line1: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    zip_code: Optional[str] = None

    # Compliance
    insurance_expiration: Optional[datetime] = None
    authority_active: bool = True
    safety_rating: Optional[str] = None  # "Satisfactory", "Conditional", etc.

    # Payment
    payment_terms: int = 30  # Net days
    factoring_company: Optional[str] = None
    quickpay_available: bool = False
    quickpay_discount_percent: float = 2.0

    # Preferred lanes (for smart matching)
    preferred_lanes: List[CarrierLane] = Field(default_factory=list)

    # Performance stats
    total_loads: int = 0
    on_time_deliveries: int = 0
    claims_count: int = 0
    last_load_at: Optional[datetime] = None
    avg_rating: Optional[float] = None  # 1-5 scale

    # Notes
    notes: Optional[str] = None

    @property
    def on_time_percentage(self) -> Optional[float]:
        """Calculate on-time delivery percentage."""
        if self.total_loads == 0:
            return None
        return (self.on_time_deliveries / self.total_loads) * 100

    @property
    def is_insurance_expiring(self) -> bool:
        """Check if insurance expires within 30 days."""
        if not self.insurance_expiration:
            return False
        from datetime import timezone
        now = datetime.now(timezone.utc)
        days_until_expiry = (self.insurance_expiration - now).days
        return 0 <= days_until_expiry <= 30

    def can_transition_to(self, new_status: CarrierStatus) -> bool:
        """Check if status transition is valid."""
        return new_status in CARRIER_STATUS_TRANSITIONS.get(self.status, [])

    def transition_to(self, new_status: CarrierStatus) -> None:
        """Transition to new status if valid."""
        if not self.can_transition_to(new_status):
            raise ValueError(f"Cannot transition from {self.status} to {new_status}")
        self.status = new_status
        self.mark_updated()
