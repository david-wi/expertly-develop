"""Waitlist schemas."""

from datetime import datetime, date
from typing import Optional
from pydantic import BaseModel, Field

from ..models.waitlist import WaitlistStatus, AvailabilityPreference


class WaitlistCreate(BaseModel):
    """Create waitlist entry request."""

    client_id: str
    service_id: str
    availability_description: str = Field(
        min_length=5,
        description="Natural language description of when the client is available",
        json_schema_extra={"examples": [
            "I'm usually free Wed 2-4pm, want to see Yana ASAP",
            "Any morning works, prefer Sarah",
            "Weekends only, flexible on time"
        ]}
    )
    # Optional: allow specifying staff preference directly
    preferred_staff_id: Optional[str] = None
    expires_in_days: int = Field(default=30, ge=1, le=90)


class WaitlistUpdate(BaseModel):
    """Update waitlist entry."""

    availability_description: Optional[str] = None
    preferred_staff_id: Optional[str] = None
    status: Optional[WaitlistStatus] = None


class WaitlistResponse(BaseModel):
    """Waitlist entry response."""

    id: str
    client_id: str
    client_name: str
    service_id: str
    service_name: str
    availability_description: str
    preferences: AvailabilityPreference
    status: WaitlistStatus
    notification_count: int
    last_notified_at: Optional[datetime] = None
    offered_slots: list[dict]
    created_at: datetime
    expires_at: Optional[datetime] = None

    @classmethod
    def from_mongo(
        cls,
        entry: dict,
        client_name: str = "",
        service_name: str = ""
    ) -> "WaitlistResponse":
        return cls(
            id=str(entry["_id"]),
            client_id=str(entry["client_id"]),
            client_name=client_name,
            service_id=str(entry["service_id"]),
            service_name=service_name,
            availability_description=entry["availability_description"],
            preferences=AvailabilityPreference(**entry.get("preferences", {})),
            status=WaitlistStatus(entry["status"]),
            notification_count=entry.get("notification_count", 0),
            last_notified_at=entry.get("last_notified_at"),
            offered_slots=entry.get("offered_slots", []),
            created_at=entry["created_at"],
            expires_at=entry.get("expires_at"),
        )


class AvailabilityMatch(BaseModel):
    """A matching availability slot for waitlist notification."""

    waitlist_entry_id: str
    client_id: str
    client_name: str
    client_phone: Optional[str]
    client_language: str
    service_id: str
    service_name: str
    staff_id: str
    staff_name: str
    start_time: datetime
    end_time: datetime
    match_reason: str  # "Cancellation", "New availability", "Staff schedule change"


class NotifyWaitlistRequest(BaseModel):
    """Request to notify a waitlist entry about availability."""

    waitlist_entry_id: str
    slot_start_time: datetime
    staff_id: str
    message: Optional[str] = None  # Custom message to include
