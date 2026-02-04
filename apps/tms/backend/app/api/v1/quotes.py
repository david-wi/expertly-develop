from typing import List, Optional
from datetime import datetime
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from bson import ObjectId

from app.database import get_database
from app.models.quote import Quote, QuoteStatus
from app.models.work_item import WorkItem, WorkItemType
from app.schemas.quote import QuoteCreate, QuoteUpdate, QuoteResponse
from app.services.number_generator import NumberGenerator
from app.services.ai_extraction import AIExtractionService

router = APIRouter()


def quote_to_response(quote: Quote) -> QuoteResponse:
    """Convert Quote model to response schema."""
    return QuoteResponse(
        id=str(quote.id),
        quote_number=quote.quote_number,
        customer_id=str(quote.customer_id),
        quote_request_id=str(quote.quote_request_id) if quote.quote_request_id else None,
        status=quote.status,
        origin_facility_id=str(quote.origin_facility_id) if quote.origin_facility_id else None,
        origin_city=quote.origin_city,
        origin_state=quote.origin_state,
        origin_zip=quote.origin_zip,
        origin_address=quote.origin_address,
        destination_facility_id=str(quote.destination_facility_id) if quote.destination_facility_id else None,
        destination_city=quote.destination_city,
        destination_state=quote.destination_state,
        destination_zip=quote.destination_zip,
        destination_address=quote.destination_address,
        pickup_date=quote.pickup_date,
        pickup_date_flexible=quote.pickup_date_flexible,
        delivery_date=quote.delivery_date,
        delivery_date_flexible=quote.delivery_date_flexible,
        equipment_type=quote.equipment_type,
        weight_lbs=quote.weight_lbs,
        commodity=quote.commodity,
        special_requirements=quote.special_requirements,
        line_items=quote.line_items,
        total_price=quote.total_price,
        estimated_cost=quote.estimated_cost,
        margin_percent=quote.margin_percent,
        valid_until=quote.valid_until,
        sent_at=quote.sent_at,
        sent_to=quote.sent_to,
        customer_response_at=quote.customer_response_at,
        customer_response_notes=quote.customer_response_notes,
        internal_notes=quote.internal_notes,
        created_by=quote.created_by,
        shipment_id=str(quote.shipment_id) if quote.shipment_id else None,
        created_at=quote.created_at,
        updated_at=quote.updated_at,
    )


@router.get("", response_model=List[QuoteResponse])
async def list_quotes(
    status: Optional[QuoteStatus] = None,
    customer_id: Optional[str] = None,
):
    """List all quotes with optional filters."""
    db = get_database()

    query = {}
    if status:
        query["status"] = status
    if customer_id:
        query["customer_id"] = ObjectId(customer_id)

    cursor = db.quotes.find(query).sort("created_at", -1)
    quotes = await cursor.to_list(1000)

    return [quote_to_response(Quote(**q)) for q in quotes]


@router.get("/{quote_id}", response_model=QuoteResponse)
async def get_quote(quote_id: str):
    """Get a quote by ID."""
    db = get_database()

    quote = await db.quotes.find_one({"_id": ObjectId(quote_id)})
    if not quote:
        raise HTTPException(status_code=404, detail="Quote not found")

    return quote_to_response(Quote(**quote))


@router.post("", response_model=QuoteResponse)
async def create_quote(data: QuoteCreate):
    """Create a new quote."""
    db = get_database()

    quote_data = data.model_dump()
    quote_data["customer_id"] = ObjectId(quote_data["customer_id"])
    if quote_data.get("quote_request_id"):
        quote_data["quote_request_id"] = ObjectId(quote_data["quote_request_id"])
    if quote_data.get("origin_facility_id"):
        quote_data["origin_facility_id"] = ObjectId(quote_data["origin_facility_id"])
    if quote_data.get("destination_facility_id"):
        quote_data["destination_facility_id"] = ObjectId(quote_data["destination_facility_id"])

    # Generate quote number
    quote_number = await NumberGenerator.get_next_quote_number()
    quote_data["quote_number"] = quote_number

    quote = Quote(**quote_data)
    quote.calculate_totals()

    await db.quotes.insert_one(quote.model_dump_mongo())

    return quote_to_response(quote)


@router.patch("/{quote_id}", response_model=QuoteResponse)
async def update_quote(quote_id: str, data: QuoteUpdate):
    """Update a quote."""
    db = get_database()

    quote_doc = await db.quotes.find_one({"_id": ObjectId(quote_id)})
    if not quote_doc:
        raise HTTPException(status_code=404, detail="Quote not found")

    quote = Quote(**quote_doc)

    # Apply updates
    update_data = data.model_dump(exclude_unset=True)

    # Handle status transitions
    if "status" in update_data:
        new_status = update_data.pop("status")
        if new_status and new_status != quote.status:
            quote.transition_to(new_status)

    # Convert ObjectId fields
    for field in ["origin_facility_id", "destination_facility_id"]:
        if field in update_data and update_data[field]:
            update_data[field] = ObjectId(update_data[field])

    for field, value in update_data.items():
        setattr(quote, field, value)

    # Recalculate totals if line items changed
    if "line_items" in update_data or "estimated_cost" in update_data:
        quote.calculate_totals()
    else:
        quote.mark_updated()

    await db.quotes.update_one(
        {"_id": ObjectId(quote_id)},
        {"$set": quote.model_dump_mongo()}
    )

    return quote_to_response(quote)


class SendQuoteRequest(BaseModel):
    email: str
    message: Optional[str] = None


@router.post("/{quote_id}/send", response_model=QuoteResponse)
async def send_quote(quote_id: str, data: SendQuoteRequest):
    """Mark a quote as sent."""
    db = get_database()

    quote_doc = await db.quotes.find_one({"_id": ObjectId(quote_id)})
    if not quote_doc:
        raise HTTPException(status_code=404, detail="Quote not found")

    quote = Quote(**quote_doc)

    quote.transition_to(QuoteStatus.SENT)
    quote.sent_to = data.email

    await db.quotes.update_one(
        {"_id": ObjectId(quote_id)},
        {"$set": quote.model_dump_mongo()}
    )

    # Create a follow-up work item
    work_item = WorkItem(
        work_type=WorkItemType.QUOTE_FOLLOWUP,
        title=f"Follow up on quote {quote.quote_number}",
        priority=40,
        quote_id=quote.id,
        customer_id=quote.customer_id,
        due_at=datetime.now().replace(hour=9, minute=0, second=0)  # Next day 9am
    )
    await db.work_items.insert_one(work_item.model_dump_mongo())

    return quote_to_response(quote)


@router.post("/{quote_id}/book")
async def book_quote(quote_id: str):
    """Convert a quote to a shipment."""
    db = get_database()
    from app.models.shipment import Shipment, Stop, StopType

    quote_doc = await db.quotes.find_one({"_id": ObjectId(quote_id)})
    if not quote_doc:
        raise HTTPException(status_code=404, detail="Quote not found")

    quote = Quote(**quote_doc)

    if quote.status != QuoteStatus.SENT:
        raise HTTPException(status_code=400, detail="Can only book sent quotes")

    # Generate shipment number
    shipment_number = await NumberGenerator.get_next_shipment_number()

    # Create stops from origin/destination
    stops = [
        Stop(
            stop_number=1,
            stop_type=StopType.PICKUP,
            address=quote.origin_address or "",
            city=quote.origin_city,
            state=quote.origin_state,
            zip_code=quote.origin_zip or "",
            scheduled_date=quote.pickup_date,
        ),
        Stop(
            stop_number=2,
            stop_type=StopType.DELIVERY,
            address=quote.destination_address or "",
            city=quote.destination_city,
            state=quote.destination_state,
            zip_code=quote.destination_zip or "",
            scheduled_date=quote.delivery_date,
        ),
    ]

    # Create shipment
    shipment = Shipment(
        shipment_number=shipment_number,
        customer_id=quote.customer_id,
        quote_id=quote.id,
        stops=stops,
        equipment_type=quote.equipment_type,
        weight_lbs=quote.weight_lbs,
        commodity=quote.commodity,
        special_requirements=quote.special_requirements,
        customer_price=quote.total_price,
        pickup_date=quote.pickup_date,
        delivery_date=quote.delivery_date,
    )

    await db.shipments.insert_one(shipment.model_dump_mongo())

    # Update quote
    quote.transition_to(QuoteStatus.ACCEPTED)
    quote.shipment_id = shipment.id
    await db.quotes.update_one(
        {"_id": ObjectId(quote_id)},
        {"$set": quote.model_dump_mongo()}
    )

    # Create work item to find carrier
    work_item = WorkItem(
        work_type=WorkItemType.SHIPMENT_NEEDS_CARRIER,
        title=f"Find carrier for {shipment_number}",
        description=f"{quote.origin_city}, {quote.origin_state} → {quote.destination_city}, {quote.destination_state}",
        priority=70,
        shipment_id=shipment.id,
        customer_id=quote.customer_id,
    )
    await db.work_items.insert_one(work_item.model_dump_mongo())

    return {"shipment_id": str(shipment.id), "shipment_number": shipment_number}


class DraftEmailRequest(BaseModel):
    custom_message: Optional[str] = None


@router.post("/{quote_id}/draft-email")
async def draft_quote_email(quote_id: str, data: DraftEmailRequest):
    """AI-generate a quote email."""
    db = get_database()

    quote_doc = await db.quotes.find_one({"_id": ObjectId(quote_id)})
    if not quote_doc:
        raise HTTPException(status_code=404, detail="Quote not found")

    quote = Quote(**quote_doc)

    # Get customer name
    customer = await db.customers.find_one({"_id": quote.customer_id})
    customer_name = customer["name"] if customer else "Valued Customer"

    ai_service = AIExtractionService()
    email_body = await ai_service.draft_quote_email(
        customer_name=customer_name,
        origin=f"{quote.origin_city}, {quote.origin_state}",
        destination=f"{quote.destination_city}, {quote.destination_state}",
        equipment_type=quote.equipment_type,
        pickup_date=quote.pickup_date.strftime("%m/%d/%Y") if quote.pickup_date else None,
        total_price=quote.total_price,
        special_instructions=quote.special_requirements,
    )

    return {"email_body": email_body}
