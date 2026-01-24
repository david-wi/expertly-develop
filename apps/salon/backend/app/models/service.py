from typing import Optional
from pydantic import Field

from .base import MongoModel, TimestampMixin, PyObjectId


class ServiceCategory(MongoModel, TimestampMixin):
    """Category for organizing services."""

    salon_id: PyObjectId
    name: str
    description: Optional[str] = None
    sort_order: int = 0
    is_active: bool = True


class Service(MongoModel, TimestampMixin):
    """Service offered by the salon."""

    salon_id: PyObjectId
    category_id: Optional[PyObjectId] = None

    name: str
    description: Optional[str] = None

    # Timing
    duration_minutes: int  # How long the service takes
    buffer_minutes: int = 0  # Buffer time after service (cleanup, etc.)

    # Pricing
    price: int  # Price in cents
    deposit_override: Optional[int] = None  # Override salon default deposit %

    # Display
    color: Optional[str] = None  # Override category/default color
    sort_order: int = 0
    is_active: bool = True

    # Staff who can perform this service (empty = all staff)
    eligible_staff_ids: list[PyObjectId] = Field(default_factory=list)

    @property
    def total_duration(self) -> int:
        """Total time blocked including buffer."""
        return self.duration_minutes + self.buffer_minutes

    @property
    def price_dollars(self) -> float:
        """Price in dollars."""
        return self.price / 100
