from datetime import datetime
from typing import Optional
from pydantic import BaseModel

from .base import MongoModel, PyObjectId


class PricingPlaybook(MongoModel):
    """Lane-specific pricing rules for a customer."""

    customer_id: PyObjectId
    name: str

    # Lane definition
    origin_state: Optional[str] = None
    dest_state: Optional[str] = None
    equipment_type: Optional[str] = None

    # Pricing (in cents)
    base_rate: int = 0
    fuel_surcharge_pct: float = 0.0
    min_rate: int = 0
    max_rate: int = 0

    # Validity
    effective_date: Optional[datetime] = None
    expiry_date: Optional[datetime] = None

    notes: Optional[str] = None
    is_active: bool = True
