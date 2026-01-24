from typing import Optional
from pydantic import BaseModel, EmailStr, Field

from ..models.salon import SalonSettings, CancellationPolicy


class SalonCreate(BaseModel):
    """Create salon request."""

    name: str = Field(min_length=1)
    slug: str = Field(min_length=1, pattern=r"^[a-z0-9-]+$")
    email: Optional[EmailStr] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    zip_code: Optional[str] = None
    timezone: str = "America/New_York"


class SalonUpdate(BaseModel):
    """Update salon request."""

    name: Optional[str] = None
    email: Optional[EmailStr] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    zip_code: Optional[str] = None
    timezone: Optional[str] = None
    settings: Optional[SalonSettings] = None


class SalonResponse(BaseModel):
    """Salon response."""

    id: str
    name: str
    slug: str
    email: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    zip_code: Optional[str] = None
    timezone: str
    stripe_account_id: Optional[str] = None
    stripe_onboarding_complete: bool
    settings: SalonSettings
    is_active: bool

    @classmethod
    def from_mongo(cls, salon: dict) -> "SalonResponse":
        return cls(
            id=str(salon["_id"]),
            name=salon["name"],
            slug=salon["slug"],
            email=salon.get("email"),
            phone=salon.get("phone"),
            address=salon.get("address"),
            city=salon.get("city"),
            state=salon.get("state"),
            zip_code=salon.get("zip_code"),
            timezone=salon.get("timezone", "America/New_York"),
            stripe_account_id=salon.get("stripe_account_id"),
            stripe_onboarding_complete=salon.get("stripe_onboarding_complete", False),
            settings=SalonSettings(**salon.get("settings", {})),
            is_active=salon.get("is_active", True),
        )
