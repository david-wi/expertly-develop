from datetime import datetime
from enum import Enum
from typing import Optional, Dict
from pydantic import Field

from .base import MongoModel, PyObjectId, utc_now


class DriverStatus(str, Enum):
    """Driver status."""
    ACTIVE = "active"
    INACTIVE = "inactive"
    SUSPENDED = "suspended"


class Driver(MongoModel):
    """Driver in the TMS."""

    # Basic info
    name: str
    email: Optional[str] = None
    phone: str
    pin: Optional[str] = None  # Hashed PIN for driver app login

    # License
    license_number: Optional[str] = None
    license_state: Optional[str] = None
    license_expiry: Optional[datetime] = None

    # Carrier association
    carrier_id: Optional[PyObjectId] = None

    # Status
    status: DriverStatus = DriverStatus.ACTIVE

    # Vehicle
    vehicle_info: Dict[str, str] = Field(default_factory=dict)
    # e.g., {"truck_number": "T-101", "trailer_number": "TR-501", "type": "van"}

    # Location tracking
    current_location: Optional[Dict[str, float]] = None
    # e.g., {"lat": 40.7128, "lng": -74.0060}
    last_location_update: Optional[datetime] = None

    # Push notifications
    device_token: Optional[str] = None

    @property
    def is_license_expired(self) -> bool:
        """Check if driver's license is expired."""
        if not self.license_expiry:
            return False
        return self.license_expiry < utc_now()

    @property
    def is_license_expiring_soon(self) -> bool:
        """Check if license expires within 30 days."""
        if not self.license_expiry:
            return False
        days_until_expiry = (self.license_expiry - utc_now()).days
        return 0 <= days_until_expiry <= 30
