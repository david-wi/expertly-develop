from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel

from app.models.customer import CustomerStatus, CustomerContact


class CustomerCreate(BaseModel):
    name: str
    code: Optional[str] = None
    contacts: List[CustomerContact] = []
    billing_email: Optional[str] = None
    address_line1: Optional[str] = None
    address_line2: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    zip_code: Optional[str] = None
    country: str = "USA"
    payment_terms: int = 30
    credit_limit: Optional[int] = None
    default_margin_percent: float = 15.0
    pricing_notes: Optional[str] = None
    notes: Optional[str] = None


class CustomerUpdate(BaseModel):
    name: Optional[str] = None
    code: Optional[str] = None
    status: Optional[CustomerStatus] = None
    contacts: Optional[List[CustomerContact]] = None
    billing_email: Optional[str] = None
    address_line1: Optional[str] = None
    address_line2: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    zip_code: Optional[str] = None
    country: Optional[str] = None
    payment_terms: Optional[int] = None
    credit_limit: Optional[int] = None
    default_margin_percent: Optional[float] = None
    pricing_notes: Optional[str] = None
    notes: Optional[str] = None


class CustomerResponse(BaseModel):
    id: str
    name: str
    code: Optional[str] = None
    status: CustomerStatus
    contacts: List[CustomerContact]
    billing_email: Optional[str] = None
    address_line1: Optional[str] = None
    address_line2: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    zip_code: Optional[str] = None
    country: str
    payment_terms: int
    credit_limit: Optional[int] = None
    default_margin_percent: float
    pricing_notes: Optional[str] = None
    notes: Optional[str] = None
    total_shipments: int
    total_revenue: int
    last_shipment_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime
