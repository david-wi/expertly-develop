"""Waitlist model for tracking availability requests."""

from datetime import datetime
from enum import Enum
from typing import Optional
from pydantic import BaseModel, Field


class WaitlistStatus(str, Enum):
    ACTIVE = "active"
    NOTIFIED = "notified"
    BOOKED = "booked"
    EXPIRED = "expired"
    CANCELLED = "cancelled"


class AvailabilityPreference(BaseModel):
    """Parsed availability preferences from natural language."""

    # Specific staff preferences
    preferred_staff_ids: list[str] = Field(default_factory=list)
    any_staff_ok: bool = True

    # Time preferences
    preferred_days: list[int] = Field(default_factory=list)  # 0=Mon, 6=Sun
    preferred_time_ranges: list[dict] = Field(default_factory=list)  # [{"start": "09:00", "end": "12:00"}]
    morning_ok: bool = True  # Before 12pm
    afternoon_ok: bool = True  # 12pm - 5pm
    evening_ok: bool = True  # After 5pm

    # Urgency
    is_urgent: bool = False
    flexible: bool = True

    # Date range
    earliest_date: Optional[datetime] = None
    latest_date: Optional[datetime] = None


class WaitlistEntry(BaseModel):
    """A waitlist entry."""

    salon_id: str
    client_id: str
    service_id: str

    # Natural language input
    availability_description: str  # "I'm usually free Wed 2-4pm, want to see Yana ASAP"

    # Parsed preferences
    preferences: AvailabilityPreference

    # Status tracking
    status: WaitlistStatus = WaitlistStatus.ACTIVE
    notification_count: int = 0
    last_notified_at: Optional[datetime] = None

    # Matched slots that were offered
    offered_slots: list[dict] = Field(default_factory=list)

    # Audit
    created_at: datetime
    updated_at: datetime
    expires_at: Optional[datetime] = None  # Auto-expire after X days


# Keywords for parsing natural language availability
TIME_KEYWORDS = {
    "morning": {"start": "09:00", "end": "12:00"},
    "afternoon": {"start": "12:00", "end": "17:00"},
    "evening": {"start": "17:00", "end": "20:00"},
    "lunch": {"start": "11:00", "end": "14:00"},
    "early": {"start": "08:00", "end": "10:00"},
    "late": {"start": "16:00", "end": "20:00"},
}

DAY_KEYWORDS = {
    "monday": 0, "mon": 0,
    "tuesday": 1, "tue": 1, "tues": 1,
    "wednesday": 2, "wed": 2, "weds": 2,
    "thursday": 3, "thu": 3, "thur": 3, "thurs": 3,
    "friday": 4, "fri": 4,
    "saturday": 5, "sat": 5,
    "sunday": 6, "sun": 6,
    "weekday": [0, 1, 2, 3, 4],
    "weekdays": [0, 1, 2, 3, 4],
    "weekend": [5, 6],
    "weekends": [5, 6],
}

URGENCY_KEYWORDS = ["asap", "urgent", "soon", "immediately", "quickly", "right away"]
FLEXIBILITY_KEYWORDS = ["flexible", "anytime", "whenever", "any time", "open"]
