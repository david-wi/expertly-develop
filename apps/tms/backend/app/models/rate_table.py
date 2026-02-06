"""Rate Table model for managing contracted rates."""

from datetime import datetime
from typing import Optional

from pydantic import BaseModel

from .base import MongoModel, PyObjectId, utc_now


class LaneRate(BaseModel):
    """A rate entry for a specific lane in a rate table."""
    origin_state: str
    dest_state: str
    equipment_type: str = "van"
    min_weight: Optional[int] = None  # In lbs
    max_weight: Optional[int] = None  # In lbs
    rate_per_mile: Optional[int] = None  # In cents
    flat_rate: Optional[int] = None  # In cents
    fuel_surcharge_pct: float = 0.0
    min_charge: Optional[int] = None  # In cents
    notes: Optional[str] = None


class RateTable(MongoModel):
    """A rate table containing contracted rates for a customer."""

    # Links
    customer_id: PyObjectId

    # Rate table info
    name: str
    description: Optional[str] = None

    # Dates
    effective_date: datetime
    expiry_date: Optional[datetime] = None

    # Status
    is_active: bool = True

    # Lane rates
    lanes: list[LaneRate] = []

    # Metadata
    currency: str = "USD"
    created_by: Optional[str] = None

    @property
    def is_expired(self) -> bool:
        """Check if the rate table has expired."""
        if self.expiry_date is None:
            return False
        return utc_now() > self.expiry_date

    @property
    def lane_count(self) -> int:
        """Number of lanes in this rate table."""
        return len(self.lanes)
