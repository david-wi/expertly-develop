from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel

from app.models.quote import QuoteStatus, QuoteLineItem


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
    created_at: datetime
    updated_at: datetime
