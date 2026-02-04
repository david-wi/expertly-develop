from datetime import datetime
from typing import Optional, List, Any
from pydantic import BaseModel

from app.models.quote_request import QuoteRequestStatus, ExtractedField


class QuoteRequestCreate(BaseModel):
    source_type: str = "email"
    source_email: Optional[str] = None
    source_subject: Optional[str] = None
    raw_content: Optional[str] = None
    customer_id: Optional[str] = None
    sender_email: Optional[str] = None
    sender_name: Optional[str] = None


class QuoteRequestUpdate(BaseModel):
    status: Optional[QuoteRequestStatus] = None
    assigned_to: Optional[str] = None
    customer_id: Optional[str] = None
    extracted_origin_city: Optional[ExtractedField] = None
    extracted_origin_state: Optional[ExtractedField] = None
    extracted_origin_zip: Optional[ExtractedField] = None
    extracted_destination_city: Optional[ExtractedField] = None
    extracted_destination_state: Optional[ExtractedField] = None
    extracted_destination_zip: Optional[ExtractedField] = None
    extracted_pickup_date: Optional[ExtractedField] = None
    extracted_delivery_date: Optional[ExtractedField] = None
    extracted_equipment_type: Optional[ExtractedField] = None
    extracted_weight: Optional[ExtractedField] = None
    extracted_commodity: Optional[ExtractedField] = None
    extracted_special_requirements: Optional[ExtractedField] = None
    missing_fields: Optional[List[str]] = None
    clarification_needed: Optional[str] = None


class QuoteRequestResponse(BaseModel):
    id: str
    source_type: str
    source_email: Optional[str] = None
    source_subject: Optional[str] = None
    raw_content: Optional[str] = None
    customer_id: Optional[str] = None
    sender_email: Optional[str] = None
    sender_name: Optional[str] = None
    status: QuoteRequestStatus
    assigned_to: Optional[str] = None
    extracted_origin_city: Optional[ExtractedField] = None
    extracted_origin_state: Optional[ExtractedField] = None
    extracted_origin_zip: Optional[ExtractedField] = None
    extracted_destination_city: Optional[ExtractedField] = None
    extracted_destination_state: Optional[ExtractedField] = None
    extracted_destination_zip: Optional[ExtractedField] = None
    extracted_pickup_date: Optional[ExtractedField] = None
    extracted_delivery_date: Optional[ExtractedField] = None
    extracted_equipment_type: Optional[ExtractedField] = None
    extracted_weight: Optional[ExtractedField] = None
    extracted_commodity: Optional[ExtractedField] = None
    extracted_special_requirements: Optional[ExtractedField] = None
    missing_fields: List[str]
    clarification_needed: Optional[str] = None
    extraction_confidence: float
    quote_id: Optional[str] = None
    received_at: datetime
    responded_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime
