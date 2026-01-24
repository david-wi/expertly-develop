from datetime import datetime, date
from typing import Optional
from pydantic import BaseModel, EmailStr, Field

from ..models.client import ClientStats


# Supported languages for client communications
SUPPORTED_LANGUAGES = ["en", "es", "fr", "zh", "ko", "vi", "ru", "pt", "ja", "ar"]


class ClientCreate(BaseModel):
    """Create client request."""

    first_name: str = Field(min_length=1)
    last_name: str = Field(min_length=1)
    email: Optional[EmailStr] = None
    phone: Optional[str] = None
    notes: Optional[str] = None
    preferences: Optional[str] = None
    tags: list[str] = Field(default_factory=list)
    # New fields
    avatar_url: Optional[str] = None
    language: str = Field(default="en")
    birthday: Optional[date] = None
    allergies: Optional[str] = None
    color_formula: Optional[str] = None
    referral_source: Optional[str] = None


class ClientUpdate(BaseModel):
    """Update client request."""

    first_name: Optional[str] = None
    last_name: Optional[str] = None
    email: Optional[EmailStr] = None
    phone: Optional[str] = None
    notes: Optional[str] = None
    preferences: Optional[str] = None
    tags: Optional[list[str]] = None
    avatar_url: Optional[str] = None
    language: Optional[str] = None
    birthday: Optional[date] = None
    allergies: Optional[str] = None
    color_formula: Optional[str] = None
    referral_source: Optional[str] = None


class ClientSearch(BaseModel):
    """Client search parameters."""

    q: str = Field(min_length=1)
    limit: int = Field(default=20, ge=1, le=100)


class ClientResponse(BaseModel):
    """Client response."""

    id: str
    first_name: str
    last_name: str
    full_name: str
    email: Optional[str] = None
    phone: Optional[str] = None
    notes: Optional[str] = None
    preferences: Optional[str] = None
    tags: list[str]
    stats: ClientStats
    stripe_customer_id: Optional[str] = None
    has_payment_method: bool
    created_at: datetime
    # New fields
    avatar_url: Optional[str] = None
    language: str = "en"
    birthday: Optional[date] = None
    allergies: Optional[str] = None
    color_formula: Optional[str] = None
    referral_source: Optional[str] = None

    @classmethod
    def from_mongo(cls, client: dict) -> "ClientResponse":
        birthday = client.get("birthday")
        if birthday and isinstance(birthday, datetime):
            birthday = birthday.date()

        return cls(
            id=str(client["_id"]),
            first_name=client["first_name"],
            last_name=client["last_name"],
            full_name=f"{client['first_name']} {client['last_name']}",
            email=client.get("email"),
            phone=client.get("phone"),
            notes=client.get("notes"),
            preferences=client.get("preferences"),
            tags=client.get("tags", []),
            stats=ClientStats(**client.get("stats", {})),
            stripe_customer_id=client.get("stripe_customer_id"),
            has_payment_method=bool(client.get("stripe_customer_id")),
            created_at=client.get("created_at", datetime.utcnow()),
            avatar_url=client.get("avatar_url"),
            language=client.get("language", "en"),
            birthday=birthday,
            allergies=client.get("allergies"),
            color_formula=client.get("color_formula"),
            referral_source=client.get("referral_source"),
        )
