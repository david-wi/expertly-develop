from datetime import datetime, timezone
from enum import Enum
from typing import Optional
from pydantic import BaseModel, Field

from .base import MongoModel, TimestampMixin, PyObjectId


class AppointmentStatus(str, Enum):
    """Appointment status state machine."""

    PENDING_DEPOSIT = "pending_deposit"  # Awaiting payment authorization
    CONFIRMED = "confirmed"  # Deposit authorized, appointment scheduled
    CHECKED_IN = "checked_in"  # Client has arrived
    IN_PROGRESS = "in_progress"  # Service in progress
    COMPLETED = "completed"  # Service completed
    CANCELLED = "cancelled"  # Cancelled by client or staff
    NO_SHOW = "no_show"  # Client didn't show up


# Valid status transitions
STATUS_TRANSITIONS: dict[AppointmentStatus, list[AppointmentStatus]] = {
    AppointmentStatus.PENDING_DEPOSIT: [
        AppointmentStatus.CONFIRMED,
        AppointmentStatus.CANCELLED,
    ],
    AppointmentStatus.CONFIRMED: [
        AppointmentStatus.CHECKED_IN,
        AppointmentStatus.CANCELLED,
        AppointmentStatus.NO_SHOW,
    ],
    AppointmentStatus.CHECKED_IN: [
        AppointmentStatus.IN_PROGRESS,
        AppointmentStatus.CANCELLED,
        AppointmentStatus.NO_SHOW,
    ],
    AppointmentStatus.IN_PROGRESS: [
        AppointmentStatus.COMPLETED,
        AppointmentStatus.CANCELLED,
    ],
    AppointmentStatus.COMPLETED: [],
    AppointmentStatus.CANCELLED: [],
    AppointmentStatus.NO_SHOW: [],
}


class PaymentSnapshot(BaseModel):
    """Snapshot of pricing at time of booking."""

    service_price: int  # In cents
    deposit_amount: int  # In cents
    deposit_percent: int


class Appointment(MongoModel, TimestampMixin):
    """Appointment booking."""

    salon_id: PyObjectId
    client_id: PyObjectId
    staff_id: PyObjectId
    service_id: PyObjectId

    # Timing
    start_time: datetime
    end_time: datetime
    duration_minutes: int

    # Status
    status: AppointmentStatus = AppointmentStatus.PENDING_DEPOSIT

    # Payment info (snapshot at booking time)
    payment: PaymentSnapshot

    # Stripe references
    stripe_payment_intent_id: Optional[str] = None
    stripe_payment_method_id: Optional[str] = None

    # Payment tracking
    deposit_captured: bool = False
    deposit_captured_at: Optional[datetime] = None
    final_amount: Optional[int] = None  # Final charge if different from deposit

    # Cancellation tracking
    cancelled_at: Optional[datetime] = None
    cancelled_by: Optional[str] = None  # "client", "staff", "system"
    cancellation_reason: Optional[str] = None
    cancellation_fee: Optional[int] = None  # Fee charged, if any

    # Notes
    notes: Optional[str] = None
    internal_notes: Optional[str] = None  # Staff-only notes

    # Optimistic locking
    version: int = 1

    def can_transition_to(self, new_status: AppointmentStatus) -> bool:
        """Check if status transition is valid."""
        return new_status in STATUS_TRANSITIONS.get(self.status, [])

    def transition_to(self, new_status: AppointmentStatus) -> None:
        """Transition to new status if valid."""
        if not self.can_transition_to(new_status):
            raise ValueError(
                f"Cannot transition from {self.status} to {new_status}"
            )
        self.status = new_status
        self.version += 1
        self.mark_updated()


class AppointmentLock(MongoModel):
    """Temporary slot lock during booking process (TTL-indexed)."""

    salon_id: PyObjectId
    staff_id: PyObjectId
    start_time: datetime
    end_time: datetime
    locked_by: str  # User ID or session ID
    expires_at: datetime  # TTL index will auto-delete

    @classmethod
    def create(
        cls,
        salon_id: PyObjectId,
        staff_id: PyObjectId,
        start_time: datetime,
        end_time: datetime,
        locked_by: str,
        ttl_seconds: int = 300,
    ) -> "AppointmentLock":
        """Create a new lock with expiration."""
        return cls(
            salon_id=salon_id,
            staff_id=staff_id,
            start_time=start_time,
            end_time=end_time,
            locked_by=locked_by,
            expires_at=datetime.now(timezone.utc).replace(microsecond=0)
            + timedelta(seconds=ttl_seconds),
        )


# Fix missing import
from datetime import timedelta
