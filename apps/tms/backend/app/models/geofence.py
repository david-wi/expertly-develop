"""Geofence model for location-based alerts."""
from datetime import datetime
from enum import Enum
from typing import Optional, List

from .base import MongoModel, PyObjectId, utc_now


class GeofenceType(str, Enum):
    """Type of geofence."""
    PICKUP = "pickup"
    DELIVERY = "delivery"
    FACILITY = "facility"
    CUSTOM = "custom"


class GeofenceTrigger(str, Enum):
    """Trigger types for geofence alerts."""
    ENTER = "enter"
    EXIT = "exit"
    BOTH = "both"


class Geofence(MongoModel):
    """A geofence for location-based alerts."""

    # Basic info
    name: str
    geofence_type: GeofenceType = GeofenceType.CUSTOM

    # Location center
    latitude: float
    longitude: float
    radius_meters: int = 500  # Default 500m radius

    # Polygon (optional, for complex shapes)
    polygon_points: Optional[List[dict]] = None  # List of {lat, lng}

    # Links
    facility_id: Optional[PyObjectId] = None
    shipment_id: Optional[PyObjectId] = None
    customer_id: Optional[PyObjectId] = None

    # Triggers
    trigger: GeofenceTrigger = GeofenceTrigger.BOTH

    # Alert settings
    alert_email: Optional[str] = None
    alert_webhook_url: Optional[str] = None
    alert_push: bool = True

    # Address (for display)
    address: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    zip_code: Optional[str] = None

    # Status
    is_active: bool = True


class GeofenceEvent(MongoModel):
    """Record of a geofence trigger event."""

    geofence_id: PyObjectId
    shipment_id: PyObjectId
    carrier_id: Optional[PyObjectId] = None

    # Event details
    event_type: GeofenceTrigger  # enter or exit
    event_timestamp: datetime

    # Location at time of event
    latitude: float
    longitude: float

    # Alert status
    alert_sent: bool = False
    alert_sent_at: Optional[datetime] = None
    alert_channels: List[str] = []  # ['email', 'push', 'webhook']


class TrackingLink(MongoModel):
    """Shareable tracking link for customers."""

    shipment_id: PyObjectId
    customer_id: Optional[PyObjectId] = None

    # Link info
    token: str  # Unique URL-safe token

    # Expiration
    expires_at: Optional[datetime] = None
    is_active: bool = True

    # Access control
    allow_pod_view: bool = True
    allow_document_view: bool = False
    show_carrier_info: bool = False
    show_pricing: bool = False

    # Usage tracking
    view_count: int = 0
    last_viewed_at: Optional[datetime] = None

    # Customer info (for display on portal)
    customer_name: Optional[str] = None
    customer_email: Optional[str] = None


class PODCapture(MongoModel):
    """Proof of Delivery capture including signatures and photos."""

    shipment_id: PyObjectId
    tracking_event_id: Optional[PyObjectId] = None
    document_id: Optional[PyObjectId] = None  # Link to Document if PDF generated

    # Capture type
    capture_type: str = "signature"  # "signature", "photo", "both"

    # Signature
    signature_data: Optional[str] = None  # Base64 encoded signature image
    signer_name: Optional[str] = None
    signer_title: Optional[str] = None

    # Photos
    photo_urls: List[str] = []  # URLs to uploaded photos
    photo_count: int = 0

    # Delivery details
    received_by: Optional[str] = None
    delivery_notes: Optional[str] = None

    # Location at capture
    latitude: Optional[float] = None
    longitude: Optional[float] = None

    # Timestamp
    captured_at: datetime = None

    # AI extraction (for photos)
    ai_extracted_text: Optional[str] = None
    ai_damage_detected: bool = False
    ai_damage_description: Optional[str] = None

    # Verification
    is_verified: bool = False
    verified_by: Optional[str] = None
    verified_at: Optional[datetime] = None

    def __init__(self, **data):
        super().__init__(**data)
        if self.captured_at is None:
            self.captured_at = utc_now()
