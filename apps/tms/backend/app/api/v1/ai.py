from typing import Optional, List
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.services.ai_extraction import AIExtractionService

router = APIRouter()


class ExtractEmailRequest(BaseModel):
    subject: Optional[str] = None
    body: str
    sender_email: Optional[str] = None


class ExtractedFieldResponse(BaseModel):
    value: Optional[str] = None
    confidence: float = 0.0
    evidence_text: Optional[str] = None
    evidence_source: str = "unknown"


class ExtractEmailResponse(BaseModel):
    origin_city: Optional[ExtractedFieldResponse] = None
    origin_state: Optional[ExtractedFieldResponse] = None
    origin_zip: Optional[ExtractedFieldResponse] = None
    destination_city: Optional[ExtractedFieldResponse] = None
    destination_state: Optional[ExtractedFieldResponse] = None
    destination_zip: Optional[ExtractedFieldResponse] = None
    pickup_date: Optional[ExtractedFieldResponse] = None
    delivery_date: Optional[ExtractedFieldResponse] = None
    equipment_type: Optional[ExtractedFieldResponse] = None
    weight_lbs: Optional[ExtractedFieldResponse] = None
    commodity: Optional[ExtractedFieldResponse] = None
    special_requirements: Optional[ExtractedFieldResponse] = None
    missing_fields: List[str] = []


@router.post("/extract-email", response_model=ExtractEmailResponse)
async def extract_email(data: ExtractEmailRequest):
    """Extract shipment details from email content using AI."""
    ai_service = AIExtractionService()

    extracted = await ai_service.extract_shipment_details(
        email_subject=data.subject,
        email_body=data.body,
        sender_email=data.sender_email,
    )

    # Convert to response format
    response_data = {}

    field_mappings = {
        'extracted_origin_city': 'origin_city',
        'extracted_origin_state': 'origin_state',
        'extracted_origin_zip': 'origin_zip',
        'extracted_destination_city': 'destination_city',
        'extracted_destination_state': 'destination_state',
        'extracted_destination_zip': 'destination_zip',
        'extracted_pickup_date': 'pickup_date',
        'extracted_delivery_date': 'delivery_date',
        'extracted_equipment_type': 'equipment_type',
        'extracted_weight': 'weight_lbs',
        'extracted_commodity': 'commodity',
        'extracted_special_requirements': 'special_requirements',
    }

    for model_field, response_field in field_mappings.items():
        if model_field in extracted:
            field = extracted[model_field]
            response_data[response_field] = ExtractedFieldResponse(
                value=str(field.value) if field.value else None,
                confidence=field.confidence,
                evidence_text=field.evidence_text,
                evidence_source=field.evidence_source,
            )

    response_data['missing_fields'] = extracted.get('missing_fields', [])

    return ExtractEmailResponse(**response_data)


class DraftQuoteEmailRequest(BaseModel):
    customer_name: str
    origin: str
    destination: str
    equipment_type: str
    pickup_date: Optional[str] = None
    total_price: int  # In cents
    special_instructions: Optional[str] = None


class DraftEmailResponse(BaseModel):
    email_body: str


@router.post("/draft-quote-email", response_model=DraftEmailResponse)
async def draft_quote_email(data: DraftQuoteEmailRequest):
    """Generate a professional quote email using AI."""
    ai_service = AIExtractionService()

    email_body = await ai_service.draft_quote_email(
        customer_name=data.customer_name,
        origin=data.origin,
        destination=data.destination,
        equipment_type=data.equipment_type,
        pickup_date=data.pickup_date,
        total_price=data.total_price,
        special_instructions=data.special_instructions,
    )

    return DraftEmailResponse(email_body=email_body)


class DraftClarificationRequest(BaseModel):
    customer_name: str
    missing_fields: List[str]
    original_request: str


@router.post("/draft-clarification", response_model=DraftEmailResponse)
async def draft_clarification_email(data: DraftClarificationRequest):
    """Generate a clarification request email using AI."""
    ai_service = AIExtractionService()

    email_body = await ai_service.draft_clarification_email(
        customer_name=data.customer_name,
        missing_fields=data.missing_fields,
        original_request=data.original_request,
    )

    return DraftEmailResponse(email_body=email_body)
