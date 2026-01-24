from enum import Enum
from typing import Optional
from pydantic import Field, EmailStr

from .base import MongoModel, TimestampMixin, PyObjectId


class UserRole(str, Enum):
    """User roles for access control."""

    OWNER = "owner"  # Full access, can manage billing
    ADMIN = "admin"  # Full access except billing
    MANAGER = "manager"  # Can manage staff, services, appointments
    STAFF = "staff"  # Can view/manage own appointments


class User(MongoModel, TimestampMixin):
    """User account for admin system access."""

    salon_id: PyObjectId
    email: EmailStr
    password_hash: str
    first_name: str
    last_name: str
    role: UserRole = UserRole.STAFF

    # Optional link to staff profile
    staff_id: Optional[PyObjectId] = None

    # Account status
    is_active: bool = True
    last_login: Optional[str] = None

    @property
    def full_name(self) -> str:
        return f"{self.first_name} {self.last_name}"
