from typing import Optional, List
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.services.ai_extraction import AIExtractionService
from app.services.ai_communications import get_ai_communications_service
from app.services.exception_detection import ExceptionDetectionService

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


# ==========================================
# AI Communications Endpoints
# ==========================================

class DraftQuoteEmailFromIdRequest(BaseModel):
    quote_id: str
    tone: str = "professional"  # professional, friendly, formal


class DraftedEmailResponse(BaseModel):
    subject: str
    body: str
    key_points: Optional[List[str]] = None


@router.post("/communications/draft-quote-email", response_model=DraftedEmailResponse)
async def draft_quote_email_from_quote(data: DraftQuoteEmailFromIdRequest):
    """Generate a quote email from an existing quote using AI."""
    service = get_ai_communications_service()
    try:
        result = await service.draft_quote_email(data.quote_id, data.tone)
        return DraftedEmailResponse(
            subject=result.get("subject", ""),
            body=result.get("body", ""),
            key_points=result.get("key_points"),
        )
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


class DraftTenderEmailRequest(BaseModel):
    tender_id: str
    tone: str = "professional"


@router.post("/communications/draft-tender-email", response_model=DraftedEmailResponse)
async def draft_tender_email(data: DraftTenderEmailRequest):
    """Generate a tender/rate confirmation email to send to carrier."""
    service = get_ai_communications_service()
    try:
        result = await service.draft_tender_email(data.tender_id, data.tone)
        return DraftedEmailResponse(
            subject=result.get("subject", ""),
            body=result.get("body", ""),
        )
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


class DraftCheckCallRequest(BaseModel):
    shipment_id: str
    channel: str = "sms"  # sms, email


class CheckCallMessageResponse(BaseModel):
    message: Optional[str] = None
    subject: Optional[str] = None
    body: Optional[str] = None


@router.post("/communications/draft-check-call", response_model=CheckCallMessageResponse)
async def draft_check_call_message(data: DraftCheckCallRequest):
    """Generate a check call request message (SMS or email)."""
    service = get_ai_communications_service()
    try:
        result = await service.draft_check_call_message(data.shipment_id, data.channel)
        return CheckCallMessageResponse(
            message=result.get("message"),
            subject=result.get("subject"),
            body=result.get("body"),
        )
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


class DraftExceptionNotificationRequest(BaseModel):
    shipment_id: str
    exception_type: str
    exception_details: str
    recipient: str = "customer"  # customer, carrier


@router.post("/communications/draft-exception-notification", response_model=DraftedEmailResponse)
async def draft_exception_notification(data: DraftExceptionNotificationRequest):
    """Generate an exception notification message."""
    service = get_ai_communications_service()
    try:
        result = await service.draft_exception_notification(
            data.shipment_id,
            data.exception_type,
            data.exception_details,
            data.recipient,
        )
        return DraftedEmailResponse(
            subject=result.get("subject", ""),
            body=result.get("body", ""),
        )
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


class SummarizeEmailThreadRequest(BaseModel):
    emails: List[dict]


class EmailThreadSummaryResponse(BaseModel):
    summary: str
    key_points: List[str]
    action_items: List[str]
    sentiment: str
    urgency: str


@router.post("/communications/summarize-thread", response_model=EmailThreadSummaryResponse)
async def summarize_email_thread(data: SummarizeEmailThreadRequest):
    """Summarize an email thread and extract action items."""
    service = get_ai_communications_service()
    result = await service.summarize_email_thread(data.emails)
    return EmailThreadSummaryResponse(
        summary=result.get("summary", ""),
        key_points=result.get("key_points", []),
        action_items=result.get("action_items", []),
        sentiment=result.get("sentiment", "neutral"),
        urgency=result.get("urgency", "medium"),
    )


# ==========================================
# Exception Detection Endpoints
# ==========================================

class ExceptionResponse(BaseModel):
    type: str
    severity: str
    message: str
    shipment_id: Optional[str] = None
    shipment_number: Optional[str] = None
    carrier_id: Optional[str] = None
    carrier_name: Optional[str] = None
    invoice_id: Optional[str] = None
    invoice_number: Optional[str] = None
    tender_id: Optional[str] = None
    data: Optional[dict] = None
    detected_at: Optional[str] = None


class ExceptionSummaryResponse(BaseModel):
    total: int
    by_type: dict
    by_severity: dict
    exceptions: List[ExceptionResponse]


@router.get("/exceptions/detect-all", response_model=List[ExceptionResponse])
async def detect_all_exceptions():
    """Run all exception detection rules and return findings."""
    exceptions = await ExceptionDetectionService.detect_all_exceptions()
    return [
        ExceptionResponse(
            type=e.get("type", ""),
            severity=e.get("severity", ""),
            message=e.get("message", ""),
            shipment_id=e.get("shipment_id"),
            shipment_number=e.get("shipment_number"),
            carrier_id=e.get("carrier_id"),
            carrier_name=e.get("carrier_name"),
            invoice_id=e.get("invoice_id"),
            invoice_number=e.get("invoice_number"),
            tender_id=e.get("tender_id"),
            data=e.get("data"),
            detected_at=e.get("detected_at").isoformat() if e.get("detected_at") else None,
        )
        for e in exceptions
    ]


@router.get("/exceptions/summary", response_model=ExceptionSummaryResponse)
async def get_exception_summary():
    """Get summary of all current exceptions."""
    summary = await ExceptionDetectionService.get_exception_summary()

    exceptions = [
        ExceptionResponse(
            type=e.get("type", ""),
            severity=e.get("severity", ""),
            message=e.get("message", ""),
            shipment_id=e.get("shipment_id"),
            shipment_number=e.get("shipment_number"),
            carrier_id=e.get("carrier_id"),
            carrier_name=e.get("carrier_name"),
            invoice_id=e.get("invoice_id"),
            invoice_number=e.get("invoice_number"),
            tender_id=e.get("tender_id"),
            data=e.get("data"),
            detected_at=e.get("detected_at").isoformat() if e.get("detected_at") else None,
        )
        for e in summary.get("exceptions", [])
    ]

    return ExceptionSummaryResponse(
        total=summary.get("total", 0),
        by_type=summary.get("by_type", {}),
        by_severity=summary.get("by_severity", {}),
        exceptions=exceptions,
    )


class CreateWorkItemsRequest(BaseModel):
    auto_create: bool = True


class CreateWorkItemsResponse(BaseModel):
    work_item_ids: List[str]
    total_exceptions: int
    work_items_created: int


@router.post("/exceptions/create-work-items", response_model=CreateWorkItemsResponse)
async def create_work_items_from_exceptions(data: CreateWorkItemsRequest):
    """Detect exceptions and create work items for high severity ones."""
    exceptions = await ExceptionDetectionService.detect_all_exceptions()
    work_item_ids = await ExceptionDetectionService.create_work_items_from_exceptions(
        exceptions, data.auto_create
    )

    return CreateWorkItemsResponse(
        work_item_ids=work_item_ids,
        total_exceptions=len(exceptions),
        work_items_created=len(work_item_ids),
    )
