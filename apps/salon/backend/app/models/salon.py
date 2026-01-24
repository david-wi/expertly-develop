from datetime import time
from typing import Optional
from pydantic import BaseModel, Field, EmailStr

from .base import MongoModel, TimestampMixin, PyObjectId


class BusinessHours(BaseModel):
    """Operating hours for a single day."""

    open: str = "09:00"  # HH:MM format
    close: str = "17:00"
    is_closed: bool = False


class CancellationPolicy(BaseModel):
    """Cancellation policy settings."""

    # Hours before appointment when free cancellation ends
    free_cancellation_hours: int = 24
    # Percentage of deposit to charge for late cancellation
    late_cancellation_fee_percent: int = 50
    # Percentage of deposit to charge for no-show
    no_show_fee_percent: int = 100
    # Minutes after appointment start to auto-mark no-show
    no_show_window_minutes: int = 15


class NotificationSettings(BaseModel):
    """Notification and messaging settings."""

    # Appointment reminders
    send_reminders: bool = True
    reminder_hours_before: list[int] = Field(default_factory=lambda: [24, 2])  # 24h and 2h before

    # Review requests
    request_reviews: bool = True
    review_delay_hours: int = 2  # Hours after appointment to send review request
    google_review_url: Optional[str] = None  # Google Business review link
    yelp_review_url: Optional[str] = None  # Yelp review link
    facebook_review_url: Optional[str] = None  # Facebook review link

    # Birthday messages
    send_birthday_messages: bool = True
    birthday_message_template: Optional[str] = None

    # Twilio settings (can be overridden per salon)
    twilio_phone_number: Optional[str] = None


class SalonSettings(BaseModel):
    """Salon configuration settings."""

    # Booking settings
    slot_duration_minutes: int = 15  # Base slot size for calendar
    min_booking_notice_hours: int = 1  # Minimum hours before appointment can be booked
    max_booking_advance_days: int = 60  # How far ahead can book

    # Deposit settings
    require_deposit: bool = True
    deposit_percent: int = 50  # Percentage of service price

    # Operating hours by day (0=Monday, 6=Sunday)
    business_hours: dict[str, BusinessHours] = Field(default_factory=lambda: {
        "0": BusinessHours(open="09:00", close="18:00"),
        "1": BusinessHours(open="09:00", close="18:00"),
        "2": BusinessHours(open="09:00", close="18:00"),
        "3": BusinessHours(open="09:00", close="18:00"),
        "4": BusinessHours(open="09:00", close="18:00"),
        "5": BusinessHours(open="09:00", close="17:00"),
        "6": BusinessHours(is_closed=True),
    })

    # Cancellation policy
    cancellation_policy: CancellationPolicy = Field(default_factory=CancellationPolicy)

    # Notification settings
    notifications: NotificationSettings = Field(default_factory=NotificationSettings)


class Salon(MongoModel, TimestampMixin):
    """Salon/business entity - tenant in multi-tenant system."""

    name: str
    slug: str  # URL-friendly identifier
    email: Optional[EmailStr] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    zip_code: Optional[str] = None
    timezone: str = "America/New_York"

    # Stripe Connect
    stripe_account_id: Optional[str] = None
    stripe_onboarding_complete: bool = False

    # Settings
    settings: SalonSettings = Field(default_factory=SalonSettings)

    # Status
    is_active: bool = True
