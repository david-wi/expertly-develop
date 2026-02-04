from typing import List, Optional
from fastapi import APIRouter, HTTPException
from bson import ObjectId

from app.database import get_database
from app.models.quote_request import QuoteRequest, QuoteRequestStatus
from app.models.work_item import WorkItem, WorkItemType, WorkItemStatus
from app.schemas.quote_request import QuoteRequestCreate, QuoteRequestUpdate, QuoteRequestResponse
from app.services.ai_extraction import AIExtractionService

router = APIRouter()


def quote_request_to_response(qr: QuoteRequest) -> QuoteRequestResponse:
    """Convert QuoteRequest model to response schema."""
    return QuoteRequestResponse(
        id=str(qr.id),
        source_type=qr.source_type,
        source_email=qr.source_email,
        source_subject=qr.source_subject,
        raw_content=qr.raw_content,
        customer_id=str(qr.customer_id) if qr.customer_id else None,
        sender_email=qr.sender_email,
        sender_name=qr.sender_name,
        status=qr.status,
        assigned_to=qr.assigned_to,
        extracted_origin_city=qr.extracted_origin_city,
        extracted_origin_state=qr.extracted_origin_state,
        extracted_origin_zip=qr.extracted_origin_zip,
        extracted_destination_city=qr.extracted_destination_city,
        extracted_destination_state=qr.extracted_destination_state,
        extracted_destination_zip=qr.extracted_destination_zip,
        extracted_pickup_date=qr.extracted_pickup_date,
        extracted_delivery_date=qr.extracted_delivery_date,
        extracted_equipment_type=qr.extracted_equipment_type,
        extracted_weight=qr.extracted_weight,
        extracted_commodity=qr.extracted_commodity,
        extracted_special_requirements=qr.extracted_special_requirements,
        missing_fields=qr.missing_fields,
        clarification_needed=qr.clarification_needed,
        extraction_confidence=qr.extraction_confidence,
        quote_id=str(qr.quote_id) if qr.quote_id else None,
        received_at=qr.received_at,
        responded_at=qr.responded_at,
        created_at=qr.created_at,
        updated_at=qr.updated_at,
    )


@router.get("", response_model=List[QuoteRequestResponse])
async def list_quote_requests(
    status: Optional[QuoteRequestStatus] = None,
    customer_id: Optional[str] = None,
):
    """List all quote requests with optional filters."""
    db = get_database()

    query = {}
    if status:
        query["status"] = status
    if customer_id:
        query["customer_id"] = ObjectId(customer_id)

    cursor = db.quote_requests.find(query).sort("received_at", -1)
    quote_requests = await cursor.to_list(1000)

    return [quote_request_to_response(QuoteRequest(**qr)) for qr in quote_requests]


@router.get("/{quote_request_id}", response_model=QuoteRequestResponse)
async def get_quote_request(quote_request_id: str):
    """Get a quote request by ID."""
    db = get_database()

    qr = await db.quote_requests.find_one({"_id": ObjectId(quote_request_id)})
    if not qr:
        raise HTTPException(status_code=404, detail="Quote request not found")

    return quote_request_to_response(QuoteRequest(**qr))


@router.post("", response_model=QuoteRequestResponse)
async def create_quote_request(data: QuoteRequestCreate):
    """Create a new quote request."""
    db = get_database()

    qr_data = data.model_dump()
    if qr_data.get("customer_id"):
        qr_data["customer_id"] = ObjectId(qr_data["customer_id"])

    quote_request = QuoteRequest(**qr_data)
    await db.quote_requests.insert_one(quote_request.model_dump_mongo())

    # Create a work item for this quote request
    work_item = WorkItem(
        work_type=WorkItemType.QUOTE_REQUEST,
        title=f"New rate request: {data.source_subject or 'No subject'}",
        description=data.raw_content[:200] if data.raw_content else None,
        priority=60,
        quote_request_id=quote_request.id,
        customer_id=quote_request.customer_id,
    )
    await db.work_items.insert_one(work_item.model_dump_mongo())

    return quote_request_to_response(quote_request)


@router.post("/{quote_request_id}/extract", response_model=QuoteRequestResponse)
async def extract_quote_request(quote_request_id: str):
    """Run AI extraction on a quote request."""
    db = get_database()

    qr_doc = await db.quote_requests.find_one({"_id": ObjectId(quote_request_id)})
    if not qr_doc:
        raise HTTPException(status_code=404, detail="Quote request not found")

    quote_request = QuoteRequest(**qr_doc)

    if not quote_request.raw_content:
        raise HTTPException(status_code=400, detail="No content to extract from")

    # Run AI extraction
    ai_service = AIExtractionService()
    extracted = await ai_service.extract_shipment_details(
        email_subject=quote_request.source_subject,
        email_body=quote_request.raw_content,
        sender_email=quote_request.sender_email,
    )

    # Apply extracted fields
    for field_name, field_value in extracted.items():
        if field_name == "missing_fields":
            quote_request.missing_fields = field_value
        elif hasattr(quote_request, field_name):
            setattr(quote_request, field_name, field_value)

    quote_request.mark_updated()

    await db.quote_requests.update_one(
        {"_id": ObjectId(quote_request_id)},
        {"$set": quote_request.model_dump_mongo()}
    )

    return quote_request_to_response(quote_request)


@router.patch("/{quote_request_id}", response_model=QuoteRequestResponse)
async def update_quote_request(quote_request_id: str, data: QuoteRequestUpdate):
    """Update a quote request."""
    db = get_database()

    qr_doc = await db.quote_requests.find_one({"_id": ObjectId(quote_request_id)})
    if not qr_doc:
        raise HTTPException(status_code=404, detail="Quote request not found")

    quote_request = QuoteRequest(**qr_doc)

    # Apply updates
    update_data = data.model_dump(exclude_unset=True)

    # Handle status transitions
    if "status" in update_data:
        new_status = update_data.pop("status")
        if new_status and new_status != quote_request.status:
            quote_request.transition_to(new_status)

    if "customer_id" in update_data and update_data["customer_id"]:
        update_data["customer_id"] = ObjectId(update_data["customer_id"])

    for field, value in update_data.items():
        setattr(quote_request, field, value)

    quote_request.mark_updated()

    await db.quote_requests.update_one(
        {"_id": ObjectId(quote_request_id)},
        {"$set": quote_request.model_dump_mongo()}
    )

    return quote_request_to_response(quote_request)


@router.post("/{quote_request_id}/create-quote")
async def create_quote_from_request(quote_request_id: str):
    """Create a quote from a quote request."""
    db = get_database()
    from app.services.number_generator import NumberGenerator
    from app.models.quote import Quote

    qr_doc = await db.quote_requests.find_one({"_id": ObjectId(quote_request_id)})
    if not qr_doc:
        raise HTTPException(status_code=404, detail="Quote request not found")

    quote_request = QuoteRequest(**qr_doc)

    if not quote_request.customer_id:
        raise HTTPException(status_code=400, detail="Quote request must have a customer assigned")

    # Generate quote number
    quote_number = await NumberGenerator.get_next_quote_number()

    # Create quote from extracted data
    quote = Quote(
        quote_number=quote_number,
        customer_id=quote_request.customer_id,
        quote_request_id=quote_request.id,
        origin_city=quote_request.extracted_origin_city.value if quote_request.extracted_origin_city else "",
        origin_state=quote_request.extracted_origin_state.value if quote_request.extracted_origin_state else "",
        origin_zip=quote_request.extracted_origin_zip.value if quote_request.extracted_origin_zip else None,
        destination_city=quote_request.extracted_destination_city.value if quote_request.extracted_destination_city else "",
        destination_state=quote_request.extracted_destination_state.value if quote_request.extracted_destination_state else "",
        destination_zip=quote_request.extracted_destination_zip.value if quote_request.extracted_destination_zip else None,
        equipment_type=quote_request.extracted_equipment_type.value if quote_request.extracted_equipment_type else "van",
        weight_lbs=quote_request.extracted_weight.value if quote_request.extracted_weight else None,
        commodity=quote_request.extracted_commodity.value if quote_request.extracted_commodity else None,
    )

    await db.quotes.insert_one(quote.model_dump_mongo())

    # Update quote request
    quote_request.quote_id = quote.id
    quote_request.transition_to(QuoteRequestStatus.QUOTED)
    await db.quote_requests.update_one(
        {"_id": ObjectId(quote_request_id)},
        {"$set": quote_request.model_dump_mongo()}
    )

    # Complete the work item
    await db.work_items.update_one(
        {"quote_request_id": quote_request.id, "status": {"$ne": WorkItemStatus.DONE}},
        {"$set": {"status": WorkItemStatus.DONE}}
    )

    return {"quote_id": str(quote.id), "quote_number": quote.quote_number}
