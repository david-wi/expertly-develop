from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field

from ..models.appointment import AppointmentStatus, PaymentSnapshot


class SlotLockRequest(BaseModel):
    """Request to lock a time slot."""

    staff_id: str
    start_time: datetime
    end_time: datetime


class SlotLockResponse(BaseModel):
    """Slot lock response."""

    lock_id: str
    expires_at: datetime


class AppointmentCreate(BaseModel):
    """Create appointment request."""

    client_id: str
    staff_id: str
    service_id: str
    start_time: datetime
    notes: Optional[str] = None
    payment_method_id: Optional[str] = None  # Stripe payment method


class AppointmentUpdate(BaseModel):
    """Update appointment request."""

    notes: Optional[str] = None
    internal_notes: Optional[str] = None


class AppointmentStatusUpdate(BaseModel):
    """Update appointment status."""

    status: AppointmentStatus
    reason: Optional[str] = None  # For cancellation


class AppointmentReschedule(BaseModel):
    """Reschedule appointment request."""

    staff_id: str
    start_time: datetime


class AppointmentResponse(BaseModel):
    """Appointment response."""

    id: str
    client_id: str
    staff_id: str
    service_id: str
    start_time: datetime
    end_time: datetime
    duration_minutes: int
    status: AppointmentStatus
    payment: PaymentSnapshot
    deposit_captured: bool
    notes: Optional[str] = None
    internal_notes: Optional[str] = None
    cancelled_at: Optional[datetime] = None
    cancelled_by: Optional[str] = None
    cancellation_reason: Optional[str] = None
    version: int
    created_at: datetime
    updated_at: datetime

    # Expanded data (optional, for list views)
    client_name: Optional[str] = None
    staff_name: Optional[str] = None
    service_name: Optional[str] = None

    @classmethod
    def from_mongo(
        cls,
        appointment: dict,
        client_name: Optional[str] = None,
        staff_name: Optional[str] = None,
        service_name: Optional[str] = None,
    ) -> "AppointmentResponse":
        return cls(
            id=str(appointment["_id"]),
            client_id=str(appointment["client_id"]),
            staff_id=str(appointment["staff_id"]),
            service_id=str(appointment["service_id"]),
            start_time=appointment["start_time"],
            end_time=appointment["end_time"],
            duration_minutes=appointment["duration_minutes"],
            status=appointment["status"],
            payment=PaymentSnapshot(**appointment.get("payment", {})),
            deposit_captured=appointment.get("deposit_captured", False),
            notes=appointment.get("notes"),
            internal_notes=appointment.get("internal_notes"),
            cancelled_at=appointment.get("cancelled_at"),
            cancelled_by=appointment.get("cancelled_by"),
            cancellation_reason=appointment.get("cancellation_reason"),
            version=appointment.get("version", 1),
            created_at=appointment["created_at"],
            updated_at=appointment["updated_at"],
            client_name=client_name,
            staff_name=staff_name,
            service_name=service_name,
        )
