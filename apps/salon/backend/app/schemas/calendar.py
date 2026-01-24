from datetime import date, datetime
from typing import Optional
from pydantic import BaseModel, Field

from .appointment import AppointmentResponse
from .staff import StaffResponse


class CalendarQuery(BaseModel):
    """Calendar view query parameters."""

    start_date: date
    end_date: date
    staff_ids: Optional[list[str]] = None


class TimeSlotInfo(BaseModel):
    """Time slot availability info."""

    start_time: datetime
    end_time: datetime
    is_available: bool
    is_business_hours: bool
    is_locked: bool = False
    locked_by: Optional[str] = None


class StaffCalendarDay(BaseModel):
    """Staff calendar data for one day."""

    staff_id: str
    date: date
    working_hours: list[dict]  # List of {start, end} time ranges
    appointments: list[AppointmentResponse]
    is_working: bool


class CalendarResponse(BaseModel):
    """Calendar view response."""

    start_date: date
    end_date: date
    staff: list[StaffResponse]
    days: dict[str, list[StaffCalendarDay]]  # date string -> staff calendars


class AvailabilityQuery(BaseModel):
    """Availability query parameters."""

    date: date
    service_id: str
    staff_id: Optional[str] = None  # If not specified, check all eligible staff


class AvailableSlot(BaseModel):
    """Available time slot."""

    start_time: datetime
    end_time: datetime
    staff_id: str
    staff_name: str


class AvailabilityResponse(BaseModel):
    """Availability response for a date/service."""

    date: date
    service_id: str
    service_name: str
    duration_minutes: int
    slots: list[AvailableSlot]
