"""EDI Message model for tracking EDI 204/214/210/990 messages."""

from datetime import datetime
from enum import Enum
from typing import Optional

from .base import MongoModel, PyObjectId


class EDIMessageType(str, Enum):
    """Supported EDI transaction types."""
    MOTOR_CARRIER_LOAD_TENDER = "204"
    TRANSPORTATION_CARRIER_SHIPMENT_STATUS = "214"
    MOTOR_CARRIER_FREIGHT_INVOICE = "210"
    RESPONSE_TO_LOAD_TENDER = "990"


class EDIDirection(str, Enum):
    """Direction of the EDI message."""
    INBOUND = "inbound"
    OUTBOUND = "outbound"


class EDIMessageStatus(str, Enum):
    """Processing status of the EDI message."""
    RECEIVED = "received"
    PARSING = "parsing"
    PARSED = "parsed"
    VALIDATED = "validated"
    PROCESSING = "processing"
    PROCESSED = "processed"
    SENT = "sent"
    ACKNOWLEDGED = "acknowledged"
    ERROR = "error"
    REJECTED = "rejected"


class EDIMessage(MongoModel):
    """An EDI message sent or received from a trading partner."""

    # Message metadata
    message_type: EDIMessageType
    direction: EDIDirection
    status: EDIMessageStatus = EDIMessageStatus.RECEIVED

    # Content
    raw_content: str
    parsed_data: Optional[dict] = None

    # Links
    trading_partner_id: Optional[PyObjectId] = None
    shipment_id: Optional[PyObjectId] = None

    # Control numbers
    isa_control_number: Optional[str] = None
    gs_control_number: Optional[str] = None
    st_control_number: Optional[str] = None

    # Error tracking
    error_messages: list[str] = []

    # Acknowledgment
    acknowledged_at: Optional[datetime] = None
    functional_ack_status: Optional[str] = None  # A/E/R (accepted/error/rejected)

    # Processing metadata
    processed_at: Optional[datetime] = None
    processing_notes: Optional[str] = None
