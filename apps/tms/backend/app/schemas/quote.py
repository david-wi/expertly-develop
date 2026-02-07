from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel

from app.models.quote import QuoteStatus, QuoteLineItem, QuoteApprovalStatus, QuoteRevisionSnapshot, CustomerPricingApplied


class QuoteCreate(BaseModel):
    customer_id: str
    quote_request_id: Optional[str] = None
    origin_facility_id: Optional[str] = None
    origin_city: str
    origin_state: str
    origin_zip: Optional[str] = None
    origin_address: Optional[str] = None
    destination_facility_id: Optional[str] = None
    destination_city: str
    destination_state: str
    destination_zip: Optional[str] = None
    destination_address: Optional[str] = None
    pickup_date: Optional[datetime] = None
    pickup_date_flexible: bool = False
    delivery_date: Optional[datetime] = None
    delivery_date_flexible: bool = False
    equipment_type: str = "van"
    weight_lbs: Optional[int] = None
    commodity: Optional[str] = None
    special_requirements: Optional[str] = None
    line_items: List[QuoteLineItem] = []
    estimated_cost: int = 0
    valid_until: Optional[datetime] = None
    internal_notes: Optional[str] = None


class QuoteUpdate(BaseModel):
    status: Optional[QuoteStatus] = None
    origin_facility_id: Optional[str] = None
    origin_city: Optional[str] = None
    origin_state: Optional[str] = None
    origin_zip: Optional[str] = None
    origin_address: Optional[str] = None
    destination_facility_id: Optional[str] = None
    destination_city: Optional[str] = None
    destination_state: Optional[str] = None
    destination_zip: Optional[str] = None
    destination_address: Optional[str] = None
    pickup_date: Optional[datetime] = None
    pickup_date_flexible: Optional[bool] = None
    delivery_date: Optional[datetime] = None
    delivery_date_flexible: Optional[bool] = None
    equipment_type: Optional[str] = None
    weight_lbs: Optional[int] = None
    commodity: Optional[str] = None
    special_requirements: Optional[str] = None
    line_items: Optional[List[QuoteLineItem]] = None
    estimated_cost: Optional[int] = None
    valid_until: Optional[datetime] = None
    internal_notes: Optional[str] = None
    customer_response_notes: Optional[str] = None


class RevisionSnapshotResponse(BaseModel):
    """Response schema for a quote revision snapshot."""
    version: int
    revised_at: datetime
    revised_by: Optional[str] = None
    change_summary: Optional[str] = None
    line_items: List[QuoteLineItem]
    total_price: int
    estimated_cost: int
    margin_percent: float
    origin_city: Optional[str] = None
    origin_state: Optional[str] = None
    destination_city: Optional[str] = None
    destination_state: Optional[str] = None
    equipment_type: Optional[str] = None
    weight_lbs: Optional[int] = None
    special_requirements: Optional[str] = None
    internal_notes: Optional[str] = None


class CustomerPricingAppliedResponse(BaseModel):
    """Response schema for customer pricing that was applied."""
    rate_table_id: Optional[str] = None
    rate_table_name: Optional[str] = None
    playbook_id: Optional[str] = None
    playbook_name: Optional[str] = None
    discount_percent: float = 0.0
    contract_rate_per_mile: Optional[int] = None
    contract_flat_rate: Optional[int] = None
    applied_at: datetime
    auto_applied: bool = False


class QuoteResponse(BaseModel):
    id: str
    quote_number: str
    customer_id: str
    quote_request_id: Optional[str] = None
    status: QuoteStatus
    origin_facility_id: Optional[str] = None
    origin_city: str
    origin_state: str
    origin_zip: Optional[str] = None
    origin_address: Optional[str] = None
    destination_facility_id: Optional[str] = None
    destination_city: str
    destination_state: str
    destination_zip: Optional[str] = None
    destination_address: Optional[str] = None
    pickup_date: Optional[datetime] = None
    pickup_date_flexible: bool
    delivery_date: Optional[datetime] = None
    delivery_date_flexible: bool
    equipment_type: str
    weight_lbs: Optional[int] = None
    commodity: Optional[str] = None
    special_requirements: Optional[str] = None
    line_items: List[QuoteLineItem]
    total_price: int
    estimated_cost: int
    margin_percent: float
    valid_until: Optional[datetime] = None
    sent_at: Optional[datetime] = None
    sent_to: Optional[str] = None
    customer_response_at: Optional[datetime] = None
    customer_response_notes: Optional[str] = None
    internal_notes: Optional[str] = None
    created_by: Optional[str] = None
    shipment_id: Optional[str] = None
    # Versioning
    version_number: int = 1
    parent_quote_id: Optional[str] = None
    revision_history: List[RevisionSnapshotResponse] = []
    is_current_version: bool = True
    # Customer Pricing
    customer_pricing_applied: Optional[CustomerPricingAppliedResponse] = None
    # Approval
    approval_status: QuoteApprovalStatus = QuoteApprovalStatus.NOT_REQUIRED
    approval_required: bool = False
    approved_by: Optional[str] = None
    approved_at: Optional[datetime] = None
    rejection_reason: Optional[str] = None
    approval_id: Optional[str] = None
    created_at: datetime
    updated_at: datetime
