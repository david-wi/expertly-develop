"""Promotion schemas."""

from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field

from ..models.promotion import PromotionType, DiscountType


class PromotionCreate(BaseModel):
    """Create promotion request."""

    name: str = Field(min_length=1, max_length=100)
    description: Optional[str] = None
    promotion_type: PromotionType
    discount_type: DiscountType

    # Discount value
    discount_value: int = Field(ge=0)  # Percentage or cents
    free_service_id: Optional[str] = None

    # Applicability
    applicable_service_ids: list[str] = Field(default_factory=list)
    applicable_staff_ids: list[str] = Field(default_factory=list)
    min_purchase_amount: int = Field(default=0, ge=0)

    # Validity
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    is_active: bool = True

    # Usage limits
    max_uses: Optional[int] = None
    max_uses_per_client: int = Field(default=1, ge=1)

    # Promo code
    code: Optional[str] = None
    requires_code: bool = False

    # Birthday specific
    birthday_days_before: int = Field(default=7, ge=0, le=30)
    birthday_days_after: int = Field(default=7, ge=0, le=30)


class PromotionUpdate(BaseModel):
    """Update promotion request."""

    name: Optional[str] = None
    description: Optional[str] = None
    discount_value: Optional[int] = None
    is_active: Optional[bool] = None
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    max_uses: Optional[int] = None
    max_uses_per_client: Optional[int] = None
    code: Optional[str] = None
    requires_code: Optional[bool] = None
    birthday_days_before: Optional[int] = None
    birthday_days_after: Optional[int] = None


class PromotionResponse(BaseModel):
    """Promotion response."""

    id: str
    salon_id: str
    name: str
    description: Optional[str]
    promotion_type: PromotionType
    discount_type: DiscountType
    discount_value: int
    free_service_id: Optional[str]
    applicable_service_ids: list[str]
    applicable_staff_ids: list[str]
    min_purchase_amount: int
    start_date: Optional[datetime]
    end_date: Optional[datetime]
    is_active: bool
    max_uses: Optional[int]
    max_uses_per_client: int
    current_uses: int
    code: Optional[str]
    requires_code: bool
    birthday_days_before: int
    birthday_days_after: int
    created_at: datetime
    updated_at: datetime

    @classmethod
    def from_mongo(cls, doc: dict) -> "PromotionResponse":
        return cls(
            id=str(doc["_id"]),
            salon_id=doc["salon_id"],
            name=doc["name"],
            description=doc.get("description"),
            promotion_type=PromotionType(doc["promotion_type"]),
            discount_type=DiscountType(doc["discount_type"]),
            discount_value=doc["discount_value"],
            free_service_id=doc.get("free_service_id"),
            applicable_service_ids=[str(sid) for sid in doc.get("applicable_service_ids", [])],
            applicable_staff_ids=[str(sid) for sid in doc.get("applicable_staff_ids", [])],
            min_purchase_amount=doc.get("min_purchase_amount", 0),
            start_date=doc.get("start_date"),
            end_date=doc.get("end_date"),
            is_active=doc.get("is_active", True),
            max_uses=doc.get("max_uses"),
            max_uses_per_client=doc.get("max_uses_per_client", 1),
            current_uses=doc.get("current_uses", 0),
            code=doc.get("code"),
            requires_code=doc.get("requires_code", False),
            birthday_days_before=doc.get("birthday_days_before", 7),
            birthday_days_after=doc.get("birthday_days_after", 7),
            created_at=doc["created_at"],
            updated_at=doc["updated_at"],
        )


class ApplyPromotionRequest(BaseModel):
    """Request to apply a promotion to an appointment."""

    promotion_id: Optional[str] = None
    promo_code: Optional[str] = None
    appointment_id: str


class PromotionCheckResult(BaseModel):
    """Result of checking applicable promotions for a client."""

    promotion_id: str
    promotion_name: str
    promotion_type: PromotionType
    discount_type: DiscountType
    discount_value: int
    discount_display: str  # e.g., "15% off" or "$10 off"
    reason: str  # e.g., "Birthday discount" or "New client welcome"
    auto_apply: bool  # Whether to automatically apply
