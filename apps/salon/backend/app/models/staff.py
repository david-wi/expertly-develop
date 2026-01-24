from datetime import date
from typing import Optional
from pydantic import BaseModel, Field, EmailStr

from .base import MongoModel, TimestampMixin, PyObjectId


class TimeSlot(BaseModel):
    """A time range within a day."""

    start: str  # HH:MM format
    end: str


class DaySchedule(BaseModel):
    """Schedule for a single day of the week."""

    is_working: bool = True
    slots: list[TimeSlot] = Field(default_factory=lambda: [TimeSlot(start="09:00", end="17:00")])


class WorkingHours(BaseModel):
    """Weekly working hours schedule."""

    # Keys are "0"-"6" for Monday-Sunday
    schedule: dict[str, DaySchedule] = Field(default_factory=lambda: {
        "0": DaySchedule(),  # Monday
        "1": DaySchedule(),  # Tuesday
        "2": DaySchedule(),  # Wednesday
        "3": DaySchedule(),  # Thursday
        "4": DaySchedule(),  # Friday
        "5": DaySchedule(slots=[TimeSlot(start="09:00", end="14:00")]),  # Saturday
        "6": DaySchedule(is_working=False, slots=[]),  # Sunday
    })


class Staff(MongoModel, TimestampMixin):
    """Staff member profile."""

    salon_id: PyObjectId
    first_name: str
    last_name: str
    email: Optional[EmailStr] = None
    phone: Optional[str] = None

    # Display settings
    display_name: Optional[str] = None  # If different from first_name
    color: str = "#6B7280"  # Calendar color
    avatar_url: Optional[str] = None

    # Availability
    working_hours: WorkingHours = Field(default_factory=WorkingHours)
    is_active: bool = True

    # Services this staff member can perform
    service_ids: list[PyObjectId] = Field(default_factory=list)

    # Ordering for display
    sort_order: int = 0

    @property
    def full_name(self) -> str:
        return f"{self.first_name} {self.last_name}"

    @property
    def calendar_name(self) -> str:
        return self.display_name or self.first_name


class StaffScheduleOverride(MongoModel):
    """Override for staff schedule on specific dates (vacation, sick, custom hours)."""

    staff_id: PyObjectId
    date: date
    override_type: str  # "off", "custom"

    # For custom hours
    custom_slots: list[TimeSlot] = Field(default_factory=list)

    # Optional note
    note: Optional[str] = None
