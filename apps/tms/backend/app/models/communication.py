"""Communication log model for SMS/Voice/Email tracking."""

from datetime import datetime
from enum import Enum
from typing import Optional

from pydantic import Field

from .base import MongoModel, PyObjectId, utc_now


class CommunicationChannel(str, Enum):
    """Communication channel type."""
    SMS = "sms"
    VOICE = "voice"
    EMAIL = "email"


class CommunicationDirection(str, Enum):
    """Direction of the communication."""
    INBOUND = "inbound"
    OUTBOUND = "outbound"


class CommunicationStatus(str, Enum):
    """Status of the communication."""
    QUEUED = "queued"
    SENT = "sent"
    DELIVERED = "delivered"
    FAILED = "failed"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    NO_ANSWER = "no_answer"


class CommunicationLog(MongoModel):
    """A logged communication (SMS, voice call, or email)."""

    # Channel & Direction
    channel: CommunicationChannel
    direction: CommunicationDirection = CommunicationDirection.OUTBOUND

    # Phone / Contact
    phone_number: Optional[str] = None
    to_number: Optional[str] = None
    from_number: Optional[str] = None

    # Message content (for SMS/email)
    message_body: Optional[str] = None
    subject: Optional[str] = None

    # Voice-specific
    call_duration_seconds: Optional[int] = None
    recording_url: Optional[str] = None

    # Status
    status: CommunicationStatus = CommunicationStatus.QUEUED

    # Linked entities
    shipment_id: Optional[PyObjectId] = None
    carrier_id: Optional[PyObjectId] = None
    customer_id: Optional[PyObjectId] = None
    template_id: Optional[PyObjectId] = None

    # Provider info (mock Twilio)
    provider_message_id: Optional[str] = None
    provider: str = "mock_twilio"

    # Error tracking
    error_message: Optional[str] = None

    # Enriched fields (not stored, populated on read)
    shipment_number: Optional[str] = None
    carrier_name: Optional[str] = None
    customer_name: Optional[str] = None
    template_name: Optional[str] = None

    # Sent timing
    sent_at: Optional[datetime] = None
    delivered_at: Optional[datetime] = None
