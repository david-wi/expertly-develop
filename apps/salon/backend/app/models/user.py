"""Salon membership model - links Identity users to salons."""

from enum import Enum
from typing import Optional
from pydantic import Field, EmailStr

from .base import MongoModel, TimestampMixin, PyObjectId


class SalonRole(str, Enum):
    """Salon membership roles for access control."""

    OWNER = "owner"  # Full access, can manage billing
    ADMIN = "admin"  # Full access except billing
    MANAGER = "manager"  # Can manage staff, services, appointments
    STAFF = "staff"  # Can view/manage own appointments


# Alias for backward compatibility
UserRole = SalonRole


class SalonMembership(MongoModel, TimestampMixin):
    """
    Salon membership - links an Identity user to a salon.

    Authentication is handled by Identity service. This collection stores
    salon-specific membership data like salon_id, role, and staff linkage.
    """

    # Link to Identity service user (required)
    identity_user_id: str  # UUID from Identity service
    organization_id: Optional[str] = None  # Organization UUID from Identity

    # Salon association
    salon_id: PyObjectId

    # User info (cached from Identity for convenience)
    email: EmailStr
    first_name: str
    last_name: str

    # Salon-specific role
    role: SalonRole = SalonRole.STAFF

    # Optional link to staff profile
    staff_id: Optional[PyObjectId] = None

    # Membership status
    is_active: bool = True
    last_login: Optional[str] = None

    @property
    def full_name(self) -> str:
        return f"{self.first_name} {self.last_name}"


# Alias for backward compatibility
User = SalonMembership
