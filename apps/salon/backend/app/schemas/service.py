from typing import Optional
from pydantic import BaseModel, Field


class CategoryCreate(BaseModel):
    """Create service category."""

    name: str = Field(min_length=1)
    description: Optional[str] = None
    sort_order: int = 0


class CategoryUpdate(BaseModel):
    """Update service category."""

    name: Optional[str] = None
    description: Optional[str] = None
    sort_order: Optional[int] = None
    is_active: Optional[bool] = None


class CategoryResponse(BaseModel):
    """Service category response."""

    id: str
    name: str
    description: Optional[str] = None
    sort_order: int
    is_active: bool

    @classmethod
    def from_mongo(cls, category: dict) -> "CategoryResponse":
        return cls(
            id=str(category["_id"]),
            name=category["name"],
            description=category.get("description"),
            sort_order=category.get("sort_order", 0),
            is_active=category.get("is_active", True),
        )


class ServiceCreate(BaseModel):
    """Create service request."""

    name: str = Field(min_length=1)
    category_id: Optional[str] = None
    description: Optional[str] = None
    duration_minutes: int = Field(ge=5, le=480)
    buffer_minutes: int = Field(ge=0, le=60, default=0)
    price: int = Field(ge=0)  # In cents
    deposit_override: Optional[int] = Field(None, ge=0, le=100)
    color: Optional[str] = None
    eligible_staff_ids: list[str] = Field(default_factory=list)


class ServiceUpdate(BaseModel):
    """Update service request."""

    name: Optional[str] = None
    category_id: Optional[str] = None
    description: Optional[str] = None
    duration_minutes: Optional[int] = Field(None, ge=5, le=480)
    buffer_minutes: Optional[int] = Field(None, ge=0, le=60)
    price: Optional[int] = Field(None, ge=0)
    deposit_override: Optional[int] = Field(None, ge=0, le=100)
    color: Optional[str] = None
    sort_order: Optional[int] = None
    is_active: Optional[bool] = None
    eligible_staff_ids: Optional[list[str]] = None


class ServiceResponse(BaseModel):
    """Service response."""

    id: str
    name: str
    category_id: Optional[str] = None
    description: Optional[str] = None
    duration_minutes: int
    buffer_minutes: int
    price: int
    price_display: str  # Formatted price
    deposit_override: Optional[int] = None
    color: Optional[str] = None
    sort_order: int
    is_active: bool
    eligible_staff_ids: list[str]

    @classmethod
    def from_mongo(cls, service: dict) -> "ServiceResponse":
        price = service.get("price", 0)
        return cls(
            id=str(service["_id"]),
            name=service["name"],
            category_id=str(service["category_id"]) if service.get("category_id") else None,
            description=service.get("description"),
            duration_minutes=service["duration_minutes"],
            buffer_minutes=service.get("buffer_minutes", 0),
            price=price,
            price_display=f"${price / 100:.2f}",
            deposit_override=service.get("deposit_override"),
            color=service.get("color"),
            sort_order=service.get("sort_order", 0),
            is_active=service.get("is_active", True),
            eligible_staff_ids=[str(sid) for sid in service.get("eligible_staff_ids", [])],
        )
