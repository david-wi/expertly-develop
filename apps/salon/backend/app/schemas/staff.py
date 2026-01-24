from datetime import date
from typing import Optional
from pydantic import BaseModel, EmailStr, Field

from ..models.staff import WorkingHours, TimeSlot


class StaffCreate(BaseModel):
    """Create staff member request."""

    first_name: str = Field(min_length=1)
    last_name: str = Field(min_length=1)
    email: Optional[EmailStr] = None
    phone: Optional[str] = None
    display_name: Optional[str] = None
    color: str = "#6B7280"
    working_hours: Optional[WorkingHours] = None
    service_ids: list[str] = Field(default_factory=list)


class StaffUpdate(BaseModel):
    """Update staff member request."""

    first_name: Optional[str] = None
    last_name: Optional[str] = None
    email: Optional[EmailStr] = None
    phone: Optional[str] = None
    display_name: Optional[str] = None
    color: Optional[str] = None
    is_active: Optional[bool] = None
    service_ids: Optional[list[str]] = None
    sort_order: Optional[int] = None


class StaffScheduleUpdate(BaseModel):
    """Update staff working hours."""

    working_hours: WorkingHours


class ScheduleOverrideCreate(BaseModel):
    """Create schedule override (vacation, custom hours)."""

    date: date
    override_type: str = Field(pattern=r"^(off|custom)$")
    custom_slots: list[TimeSlot] = Field(default_factory=list)
    note: Optional[str] = None


class StaffResponse(BaseModel):
    """Staff member response."""

    id: str
    first_name: str
    last_name: str
    email: Optional[str] = None
    phone: Optional[str] = None
    display_name: Optional[str] = None
    color: str
    avatar_url: Optional[str] = None
    working_hours: WorkingHours
    is_active: bool
    service_ids: list[str]
    sort_order: int

    @classmethod
    def from_mongo(cls, staff: dict) -> "StaffResponse":
        return cls(
            id=str(staff["_id"]),
            first_name=staff["first_name"],
            last_name=staff["last_name"],
            email=staff.get("email"),
            phone=staff.get("phone"),
            display_name=staff.get("display_name"),
            color=staff.get("color", "#6B7280"),
            avatar_url=staff.get("avatar_url"),
            working_hours=WorkingHours(**staff.get("working_hours", {})),
            is_active=staff.get("is_active", True),
            service_ids=[str(sid) for sid in staff.get("service_ids", [])],
            sort_order=staff.get("sort_order", 0),
        )
