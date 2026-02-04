from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel

from app.models.shipment import ShipmentStatus, Stop


class ShipmentCreate(BaseModel):
    customer_id: str
    quote_id: Optional[str] = None
    carrier_id: Optional[str] = None
    stops: List[Stop] = []
    equipment_type: str = "van"
    weight_lbs: Optional[int] = None
    commodity: Optional[str] = None
    piece_count: Optional[int] = None
    pallet_count: Optional[int] = None
    special_requirements: Optional[str] = None
    customer_price: int = 0
    carrier_cost: int = 0
    pickup_date: Optional[datetime] = None
    delivery_date: Optional[datetime] = None
    internal_notes: Optional[str] = None
    customer_notes: Optional[str] = None


class ShipmentUpdate(BaseModel):
    status: Optional[ShipmentStatus] = None
    carrier_id: Optional[str] = None
    pro_number: Optional[str] = None
    bol_number: Optional[str] = None
    stops: Optional[List[Stop]] = None
    equipment_type: Optional[str] = None
    weight_lbs: Optional[int] = None
    commodity: Optional[str] = None
    piece_count: Optional[int] = None
    pallet_count: Optional[int] = None
    special_requirements: Optional[str] = None
    customer_price: Optional[int] = None
    carrier_cost: Optional[int] = None
    pickup_date: Optional[datetime] = None
    delivery_date: Optional[datetime] = None
    actual_pickup_date: Optional[datetime] = None
    actual_delivery_date: Optional[datetime] = None
    last_known_location: Optional[str] = None
    last_check_call: Optional[datetime] = None
    eta: Optional[datetime] = None
    internal_notes: Optional[str] = None
    customer_notes: Optional[str] = None
    assigned_to: Optional[str] = None


class ShipmentResponse(BaseModel):
    id: str
    shipment_number: str
    pro_number: Optional[str] = None
    bol_number: Optional[str] = None
    customer_id: str
    carrier_id: Optional[str] = None
    quote_id: Optional[str] = None
    status: ShipmentStatus
    stops: List[Stop]
    equipment_type: str
    weight_lbs: Optional[int] = None
    commodity: Optional[str] = None
    piece_count: Optional[int] = None
    pallet_count: Optional[int] = None
    special_requirements: Optional[str] = None
    customer_price: int
    carrier_cost: int
    margin: int
    margin_percent: float
    pickup_date: Optional[datetime] = None
    delivery_date: Optional[datetime] = None
    actual_pickup_date: Optional[datetime] = None
    actual_delivery_date: Optional[datetime] = None
    last_known_location: Optional[str] = None
    last_check_call: Optional[datetime] = None
    eta: Optional[datetime] = None
    is_at_risk: bool
    internal_notes: Optional[str] = None
    customer_notes: Optional[str] = None
    assigned_to: Optional[str] = None
    created_by: Optional[str] = None
    created_at: datetime
    updated_at: datetime
