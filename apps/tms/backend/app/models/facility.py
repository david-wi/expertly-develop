from typing import Optional, List
from pydantic import BaseModel, Field

from .base import MongoModel, PyObjectId


class FacilityHours(BaseModel):
    """Operating hours for a day."""
    day: str  # "monday", "tuesday", etc.
    open_time: Optional[str] = None  # "08:00"
    close_time: Optional[str] = None  # "17:00"
    closed: bool = False


class Facility(MongoModel):
    """Pickup or delivery facility."""

    # Basic info
    name: str
    facility_type: str = "warehouse"  # "warehouse", "distribution_center", "port", etc.

    # Owner (optional - for customer-specific facilities)
    customer_id: Optional[PyObjectId] = None

    # Address
    address_line1: str
    address_line2: Optional[str] = None
    city: str
    state: str
    zip_code: str
    country: str = "USA"

    # Contact
    contact_name: Optional[str] = None
    contact_phone: Optional[str] = None
    contact_email: Optional[str] = None

    # Operations
    hours: List[FacilityHours] = Field(default_factory=list)
    appointment_required: bool = False
    appointment_lead_time_hours: int = 24  # How far in advance to schedule

    # Loading/Unloading
    dock_hours: Optional[str] = None  # e.g., "6am-2pm Mon-Fri"
    has_dock: bool = True
    has_forklift: bool = True
    driver_assist_required: bool = False

    # Special instructions
    special_instructions: Optional[str] = None
    gate_code: Optional[str] = None
    check_in_process: Optional[str] = None

    # Location info
    latitude: Optional[float] = None
    longitude: Optional[float] = None

    @property
    def full_address(self) -> str:
        """Get formatted full address."""
        parts = [self.address_line1]
        if self.address_line2:
            parts.append(self.address_line2)
        parts.append(f"{self.city}, {self.state} {self.zip_code}")
        return ", ".join(parts)
