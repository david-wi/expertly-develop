from datetime import datetime
from enum import Enum
from typing import Optional, List
from pydantic import BaseModel, Field

from .base import MongoModel, PyObjectId, utc_now


class ShipmentStatus(str, Enum):
    """Shipment status state machine."""
    BOOKED = "booked"
    PENDING_PICKUP = "pending_pickup"
    IN_TRANSIT = "in_transit"
    OUT_FOR_DELIVERY = "out_for_delivery"
    DELIVERED = "delivered"
    CANCELLED = "cancelled"


SHIPMENT_STATUS_TRANSITIONS: dict[ShipmentStatus, list[ShipmentStatus]] = {
    ShipmentStatus.BOOKED: [ShipmentStatus.PENDING_PICKUP, ShipmentStatus.CANCELLED],
    ShipmentStatus.PENDING_PICKUP: [ShipmentStatus.IN_TRANSIT, ShipmentStatus.CANCELLED],
    ShipmentStatus.IN_TRANSIT: [ShipmentStatus.OUT_FOR_DELIVERY, ShipmentStatus.DELIVERED, ShipmentStatus.CANCELLED],
    ShipmentStatus.OUT_FOR_DELIVERY: [ShipmentStatus.DELIVERED, ShipmentStatus.CANCELLED],
    ShipmentStatus.DELIVERED: [],
    ShipmentStatus.CANCELLED: [],
}


class StopType(str, Enum):
    """Type of stop."""
    PICKUP = "pickup"
    DELIVERY = "delivery"
    STOP = "stop"  # Intermediate stop


class Stop(BaseModel):
    """A stop on a shipment route."""
    stop_number: int
    stop_type: StopType
    facility_id: Optional[str] = None

    # Location
    name: Optional[str] = None
    address: str
    city: str
    state: str
    zip_code: str

    # Contact
    contact_name: Optional[str] = None
    contact_phone: Optional[str] = None

    # Timing
    scheduled_date: Optional[datetime] = None
    scheduled_time_start: Optional[str] = None  # "08:00"
    scheduled_time_end: Optional[str] = None  # "17:00"
    appointment_number: Optional[str] = None
    actual_arrival: Optional[datetime] = None
    actual_departure: Optional[datetime] = None

    # Notes
    special_instructions: Optional[str] = None

    @property
    def is_completed(self) -> bool:
        """Check if stop is completed."""
        return self.actual_departure is not None


class Shipment(MongoModel):
    """A booked shipment."""

    # Reference
    shipment_number: str  # e.g., "S-2024-00001"
    pro_number: Optional[str] = None  # Carrier's PRO number
    bol_number: Optional[str] = None  # Bill of Lading

    # Links
    customer_id: PyObjectId
    carrier_id: Optional[PyObjectId] = None
    quote_id: Optional[PyObjectId] = None

    # Status
    status: ShipmentStatus = ShipmentStatus.BOOKED

    # Stops (supports multi-stop shipments)
    stops: List[Stop] = Field(default_factory=list)

    # Load details
    equipment_type: str = "van"
    weight_lbs: Optional[int] = None
    commodity: Optional[str] = None
    piece_count: Optional[int] = None
    pallet_count: Optional[int] = None
    special_requirements: Optional[str] = None

    # Pricing
    customer_price: int = 0  # What customer pays (cents)
    carrier_cost: int = 0  # What we pay carrier (cents)
    fuel_surcharge: int = 0  # Fuel surcharge amount (cents)
    fuel_surcharge_schedule_id: Optional[str] = None  # Reference to fuel schedule used

    # Equipment assignment
    assigned_equipment: Optional[dict] = None  # {equipment_number, equipment_type, trailer_number, chassis_number}

    @property
    def margin(self) -> int:
        """Calculate margin in cents."""
        return self.customer_price - self.carrier_cost

    @property
    def margin_percent(self) -> float:
        """Calculate margin percentage."""
        if self.customer_price == 0:
            return 0.0
        return (self.margin / self.customer_price) * 100

    # Dates
    pickup_date: Optional[datetime] = None
    delivery_date: Optional[datetime] = None
    actual_pickup_date: Optional[datetime] = None
    actual_delivery_date: Optional[datetime] = None

    # Tracking
    last_known_location: Optional[str] = None
    last_check_call: Optional[datetime] = None
    eta: Optional[datetime] = None

    # Notes
    internal_notes: Optional[str] = None
    customer_notes: Optional[str] = None

    # Assignment
    assigned_to: Optional[str] = None
    created_by: Optional[str] = None

    # Split shipment parent-child relationship
    split_parent_id: Optional[str] = None  # Parent shipment ID if this is a child
    split_children: list[str] = []  # Child shipment IDs if this was split
    consolidated_into: Optional[str] = None  # ID of consolidated shipment

    @property
    def is_at_risk(self) -> bool:
        """Check if shipment has risk indicators."""
        now = utc_now()
        # No carrier assigned and pickup is soon
        if not self.carrier_id and self.pickup_date:
            hours_until_pickup = (self.pickup_date - now).total_seconds() / 3600
            if hours_until_pickup < 24:
                return True
        # No recent check call while in transit
        if self.status == ShipmentStatus.IN_TRANSIT and self.last_check_call:
            hours_since_check = (now - self.last_check_call).total_seconds() / 3600
            if hours_since_check > 4:
                return True
        return False

    def can_transition_to(self, new_status: ShipmentStatus) -> bool:
        """Check if status transition is valid."""
        return new_status in SHIPMENT_STATUS_TRANSITIONS.get(self.status, [])

    def transition_to(self, new_status: ShipmentStatus) -> None:
        """Transition to new status if valid."""
        if not self.can_transition_to(new_status):
            raise ValueError(f"Cannot transition from {self.status} to {new_status}")
        self.status = new_status
        if new_status == ShipmentStatus.IN_TRANSIT:
            self.actual_pickup_date = utc_now()
        elif new_status == ShipmentStatus.DELIVERED:
            self.actual_delivery_date = utc_now()
        self.mark_updated()
