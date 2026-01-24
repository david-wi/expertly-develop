"""Promotion model for discounts and special offers."""

from datetime import datetime
from enum import Enum
from typing import Optional
from pydantic import BaseModel, Field


class PromotionType(str, Enum):
    BIRTHDAY = "birthday"  # Birthday week/month discount
    REFERRAL = "referral"  # Referral discount
    NEW_CLIENT = "new_client"  # First-time client discount
    LOYALTY = "loyalty"  # Loyalty points redemption
    SEASONAL = "seasonal"  # Holiday/seasonal promotions
    CUSTOM = "custom"  # Custom one-time codes


class DiscountType(str, Enum):
    PERCENTAGE = "percentage"  # e.g., 20% off
    FIXED = "fixed"  # e.g., $10 off
    FREE_SERVICE = "free_service"  # Free add-on service


class Promotion(BaseModel):
    """A promotion/discount configuration."""

    salon_id: str
    name: str
    description: Optional[str] = None
    promotion_type: PromotionType
    discount_type: DiscountType

    # Discount value
    discount_value: int  # Percentage or cents depending on discount_type
    free_service_id: Optional[str] = None  # For free_service type

    # Applicability
    applicable_service_ids: list[str] = Field(default_factory=list)  # Empty = all services
    applicable_staff_ids: list[str] = Field(default_factory=list)  # Empty = all staff
    min_purchase_amount: int = 0  # Minimum spend in cents

    # Validity
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    is_active: bool = True

    # Usage limits
    max_uses: Optional[int] = None  # Total uses allowed
    max_uses_per_client: int = 1
    current_uses: int = 0

    # For promo codes
    code: Optional[str] = None  # e.g., "BIRTHDAY20"
    requires_code: bool = False

    # Birthday specific
    birthday_days_before: int = 7  # Days before birthday it's valid
    birthday_days_after: int = 7  # Days after birthday it's valid

    # Audit
    created_at: datetime
    updated_at: datetime


class PromotionUsage(BaseModel):
    """Track promotion usage."""

    promotion_id: str
    salon_id: str
    client_id: str
    appointment_id: str
    discount_applied: int  # Amount in cents
    used_at: datetime


# Default promotion templates
DEFAULT_PROMOTIONS = [
    {
        "name": "Birthday Discount",
        "description": "Special discount during your birthday week",
        "promotion_type": PromotionType.BIRTHDAY,
        "discount_type": DiscountType.PERCENTAGE,
        "discount_value": 15,  # 15% off
        "birthday_days_before": 7,
        "birthday_days_after": 7,
        "requires_code": False,
    },
    {
        "name": "New Client Welcome",
        "description": "Welcome discount for first-time clients",
        "promotion_type": PromotionType.NEW_CLIENT,
        "discount_type": DiscountType.PERCENTAGE,
        "discount_value": 10,  # 10% off
        "max_uses_per_client": 1,
        "requires_code": False,
    },
    {
        "name": "Referral Reward",
        "description": "Discount for referring a friend",
        "promotion_type": PromotionType.REFERRAL,
        "discount_type": DiscountType.FIXED,
        "discount_value": 1500,  # $15 off
        "requires_code": True,
    },
]
