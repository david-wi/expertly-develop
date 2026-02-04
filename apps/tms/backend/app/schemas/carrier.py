from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel

from app.models.carrier import CarrierStatus, EquipmentType, CarrierContact, CarrierLane


class CarrierCreate(BaseModel):
    name: str
    mc_number: Optional[str] = None
    dot_number: Optional[str] = None
    contacts: List[CarrierContact] = []
    dispatch_email: Optional[str] = None
    dispatch_phone: Optional[str] = None
    equipment_types: List[EquipmentType] = []
    address_line1: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    zip_code: Optional[str] = None
    insurance_expiration: Optional[datetime] = None
    authority_active: bool = True
    safety_rating: Optional[str] = None
    payment_terms: int = 30
    factoring_company: Optional[str] = None
    quickpay_available: bool = False
    quickpay_discount_percent: float = 2.0
    preferred_lanes: List[CarrierLane] = []
    notes: Optional[str] = None


class CarrierUpdate(BaseModel):
    name: Optional[str] = None
    mc_number: Optional[str] = None
    dot_number: Optional[str] = None
    status: Optional[CarrierStatus] = None
    contacts: Optional[List[CarrierContact]] = None
    dispatch_email: Optional[str] = None
    dispatch_phone: Optional[str] = None
    equipment_types: Optional[List[EquipmentType]] = None
    address_line1: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    zip_code: Optional[str] = None
    insurance_expiration: Optional[datetime] = None
    authority_active: Optional[bool] = None
    safety_rating: Optional[str] = None
    payment_terms: Optional[int] = None
    factoring_company: Optional[str] = None
    quickpay_available: Optional[bool] = None
    quickpay_discount_percent: Optional[float] = None
    preferred_lanes: Optional[List[CarrierLane]] = None
    notes: Optional[str] = None


class CarrierResponse(BaseModel):
    id: str
    name: str
    mc_number: Optional[str] = None
    dot_number: Optional[str] = None
    status: CarrierStatus
    contacts: List[CarrierContact]
    dispatch_email: Optional[str] = None
    dispatch_phone: Optional[str] = None
    equipment_types: List[EquipmentType]
    address_line1: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    zip_code: Optional[str] = None
    insurance_expiration: Optional[datetime] = None
    authority_active: bool
    safety_rating: Optional[str] = None
    payment_terms: int
    factoring_company: Optional[str] = None
    quickpay_available: bool
    quickpay_discount_percent: float
    preferred_lanes: List[CarrierLane]
    total_loads: int
    on_time_deliveries: int
    on_time_percentage: Optional[float] = None
    claims_count: int
    last_load_at: Optional[datetime] = None
    avg_rating: Optional[float] = None
    is_insurance_expiring: bool
    notes: Optional[str] = None
    created_at: datetime
    updated_at: datetime
