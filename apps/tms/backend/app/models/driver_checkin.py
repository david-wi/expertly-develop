from datetime import datetime
from enum import Enum
from typing import Optional, List, Dict
from pydantic import Field

from .base import MongoModel, PyObjectId, utc_now


class CheckinEventType(str, Enum):
    """Types of driver check-in events."""
    CHECK_CALL = "check_call"
    ARRIVAL = "arrival"
    DEPARTURE = "departure"
    POD_UPLOAD = "pod_upload"
    EXCEPTION = "exception"


class DriverCheckin(MongoModel):
    """Driver check-in / check call record."""

    driver_id: PyObjectId
    shipment_id: PyObjectId

    # Location
    location: Optional[Dict[str, float]] = None
    # e.g., {"lat": 40.7128, "lng": -74.0060}

    # Event details
    event_type: CheckinEventType = CheckinEventType.CHECK_CALL
    notes: Optional[str] = None

    # Photos (POD, exception evidence, etc.)
    photos: List[str] = Field(default_factory=list)
    # List of photo URLs/paths

    # Exception details (when event_type == EXCEPTION)
    exception_reason: Optional[str] = None
    # e.g., "delay", "damage", "refusal", "wrong_address", "closed"
    exception_details: Optional[str] = None
