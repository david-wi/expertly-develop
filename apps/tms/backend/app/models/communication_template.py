"""Communication template model for SMS/Voice message templates."""

from enum import Enum
from typing import Optional, List

from .base import MongoModel


class TemplateChannel(str, Enum):
    """Channel this template is for."""
    SMS = "sms"
    VOICE = "voice"
    EMAIL = "email"


class TemplateCategory(str, Enum):
    """Category of the template."""
    CHECK_CALL = "check_call"
    DELIVERY_NOTIFICATION = "delivery_notification"
    PICKUP_REMINDER = "pickup_reminder"
    RATE_CONFIRMATION = "rate_confirmation"
    STATUS_UPDATE = "status_update"
    CUSTOM = "custom"


class CommunicationTemplate(MongoModel):
    """A reusable message template with variable placeholders."""

    name: str
    channel: TemplateChannel = TemplateChannel.SMS
    category: TemplateCategory = TemplateCategory.CUSTOM
    template_body: str  # Supports {{variable}} placeholders
    subject: Optional[str] = None  # For email templates
    description: Optional[str] = None
    is_active: bool = True

    # Available variables for this template (informational)
    available_variables: List[str] = [
        "shipment_number",
        "carrier_name",
        "customer_name",
        "origin_city",
        "origin_state",
        "destination_city",
        "destination_state",
        "pickup_date",
        "delivery_date",
        "driver_name",
        "driver_phone",
    ]
