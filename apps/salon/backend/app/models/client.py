from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field, EmailStr

from .base import MongoModel, TimestampMixin, PyObjectId


class ClientStats(BaseModel):
    """Denormalized statistics for quick access."""

    total_appointments: int = 0
    completed_appointments: int = 0
    cancelled_appointments: int = 0
    no_shows: int = 0
    total_spent: int = 0  # In cents
    last_visit: Optional[datetime] = None


class Client(MongoModel, TimestampMixin):
    """Customer profile."""

    salon_id: PyObjectId
    first_name: str
    last_name: str
    email: Optional[EmailStr] = None
    phone: Optional[str] = None

    # Stripe
    stripe_customer_id: Optional[str] = None

    # Notes and preferences
    notes: Optional[str] = None
    preferences: Optional[str] = None  # Service preferences, allergies, etc.

    # Stats (denormalized for quick access)
    stats: ClientStats = Field(default_factory=ClientStats)

    # Tags for organization
    tags: list[str] = Field(default_factory=list)

    @property
    def full_name(self) -> str:
        return f"{self.first_name} {self.last_name}"

    @property
    def display_contact(self) -> str:
        """Primary contact method for display."""
        return self.phone or self.email or "No contact"
