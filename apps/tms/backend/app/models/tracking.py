from datetime import datetime
from enum import Enum
from typing import Optional

from .base import MongoModel, PyObjectId


class TrackingEventType(str, Enum):
    """Types of tracking events."""
    BOOKED = "booked"
    DISPATCHED = "dispatched"
    DRIVER_ASSIGNED = "driver_assigned"
    EN_ROUTE_TO_PICKUP = "en_route_to_pickup"
    ARRIVED_AT_PICKUP = "arrived_at_pickup"
    LOADING = "loading"
    DEPARTED_PICKUP = "departed_pickup"
    IN_TRANSIT = "in_transit"
    CHECK_CALL = "check_call"
    ARRIVED_AT_DELIVERY = "arrived_at_delivery"
    UNLOADING = "unloading"
    DELIVERED = "delivered"
    POD_RECEIVED = "pod_received"
    DELAY = "delay"
    EXCEPTION = "exception"
    NOTE = "note"


class TrackingEvent(MongoModel):
    """Tracking event for a shipment."""

    shipment_id: PyObjectId
    event_type: TrackingEventType

    # Timing
    event_timestamp: datetime  # When the event occurred
    reported_at: datetime  # When we recorded it

    # Location (optional)
    location_city: Optional[str] = None
    location_state: Optional[str] = None
    location_zip: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None

    # Details
    description: Optional[str] = None
    notes: Optional[str] = None

    # Source
    reported_by: Optional[str] = None  # User ID
    source: str = "manual"  # "manual", "edi", "api", "driver_app"

    # Stop reference (if event is at a stop)
    stop_number: Optional[int] = None

    # Exception handling
    is_exception: bool = False
    exception_resolved: bool = False
    exception_resolution: Optional[str] = None
