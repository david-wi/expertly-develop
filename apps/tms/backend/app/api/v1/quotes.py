from typing import List, Optional
from datetime import datetime
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from bson import ObjectId

from app.database import get_database
from app.models.quote import Quote, QuoteStatus, QuoteApprovalStatus, QuoteRevisionSnapshot, CustomerPricingApplied
from app.models.work_item import WorkItem, WorkItemType
from app.models.base import utc_now
from app.schemas.quote import (
    QuoteCreate, QuoteUpdate, QuoteResponse,
    RevisionSnapshotResponse, CustomerPricingAppliedResponse,
)
from app.services.number_generator import NumberGenerator
from app.services.ai_extraction import AIExtractionService

router = APIRouter()


def _revision_to_response(snap: QuoteRevisionSnapshot) -> RevisionSnapshotResponse:
    """Convert a QuoteRevisionSnapshot to response schema."""
    return RevisionSnapshotResponse(
        version=snap.version,
        revised_at=snap.revised_at,
        revised_by=snap.revised_by,
        change_summary=snap.change_summary,
        line_items=snap.line_items,
        total_price=snap.total_price,
        estimated_cost=snap.estimated_cost,
        margin_percent=snap.margin_percent,
        origin_city=snap.origin_city,
        origin_state=snap.origin_state,
        destination_city=snap.destination_city,
        destination_state=snap.destination_state,
        equipment_type=snap.equipment_type,
        weight_lbs=snap.weight_lbs,
        special_requirements=snap.special_requirements,
        internal_notes=snap.internal_notes,
    )


def _pricing_applied_to_response(pricing: CustomerPricingApplied) -> CustomerPricingAppliedResponse:
    """Convert CustomerPricingApplied to response schema."""
    return CustomerPricingAppliedResponse(
        rate_table_id=pricing.rate_table_id,
        rate_table_name=pricing.rate_table_name,
        playbook_id=pricing.playbook_id,
        playbook_name=pricing.playbook_name,
        discount_percent=pricing.discount_percent,
        contract_rate_per_mile=pricing.contract_rate_per_mile,
        contract_flat_rate=pricing.contract_flat_rate,
        applied_at=pricing.applied_at,
        auto_applied=pricing.auto_applied,
    )


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
        # Versioning
        version_number=quote.version_number,
        parent_quote_id=str(quote.parent_quote_id) if quote.parent_quote_id else None,
        revision_history=[_revision_to_response(r) for r in quote.revision_history],
        is_current_version=quote.is_current_version,
        # Customer Pricing
        customer_pricing_applied=_pricing_applied_to_response(quote.customer_pricing_applied) if quote.customer_pricing_applied else None,
        # Approval
        approval_status=quote.approval_status,
        approval_required=quote.approval_required,
        approved_by=quote.approved_by,
        approved_at=quote.approved_at,
        rejection_reason=quote.rejection_reason,
        approval_id=quote.approval_id,
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


# ============================================================================
# Customer-Specific Pricing
# ============================================================================


@router.post("/{quote_id}/apply-customer-pricing", response_model=QuoteResponse)
async def apply_customer_pricing(quote_id: str):
    """Auto-apply customer's negotiated rates from rate tables and pricing playbooks.

    Looks up the customer's active rate tables and pricing playbooks,
    finds matching lanes, and applies the best contracted rate as line items.
    """
    db = get_database()

    quote_doc = await db.quotes.find_one({"_id": ObjectId(quote_id)})
    if not quote_doc:
        raise HTTPException(status_code=404, detail="Quote not found")

    quote = Quote(**quote_doc)

    if quote.status != QuoteStatus.DRAFT:
        raise HTTPException(status_code=400, detail="Can only apply pricing to draft quotes")

    now = utc_now()

    # 1. Search rate tables for matching lanes
    rate_table_query = {
        "customer_id": quote.customer_id,
        "is_active": True,
        "effective_date": {"$lte": now},
        "$or": [
            {"expiry_date": None},
            {"expiry_date": {"$gte": now}},
        ],
    }
    rate_tables = await db.rate_tables.find(rate_table_query).to_list(100)

    best_rate = None
    best_table_info = None

    for table in rate_tables:
        for lane in table.get("lanes", []):
            if lane.get("origin_state", "").upper() != quote.origin_state.upper():
                continue
            if lane.get("dest_state", "").upper() != quote.destination_state.upper():
                continue
            eq = lane.get("equipment_type", "van").lower()
            if eq != quote.equipment_type.lower():
                continue
            # Weight check
            if quote.weight_lbs:
                min_w = lane.get("min_weight")
                max_w = lane.get("max_weight")
                if min_w and quote.weight_lbs < min_w:
                    continue
                if max_w and quote.weight_lbs > max_w:
                    continue

            # Found a match - use flat rate if available, else rate_per_mile
            rate_value = lane.get("flat_rate") or lane.get("rate_per_mile")
            if rate_value and (best_rate is None or rate_value > best_rate):
                best_rate = rate_value
                fsc = lane.get("fuel_surcharge_pct", 0.0)
                best_table_info = {
                    "rate_table_id": str(table["_id"]),
                    "rate_table_name": table["name"],
                    "flat_rate": lane.get("flat_rate"),
                    "rate_per_mile": lane.get("rate_per_mile"),
                    "fuel_surcharge_pct": fsc,
                    "min_charge": lane.get("min_charge"),
                }

    # 2. Also check customer pricing rules on rate tables
    discount_percent = 0.0
    for table in rate_tables:
        for rule in table.get("customer_pricing_rules", []):
            if rule.get("auto_apply", True) and rule.get("discount_percent", 0) > discount_percent:
                discount_percent = rule["discount_percent"]
            if rule.get("contract_flat_rate"):
                if best_rate is None or rule["contract_flat_rate"] > best_rate:
                    best_rate = rule["contract_flat_rate"]
                    best_table_info = {
                        "rate_table_id": str(table["_id"]),
                        "rate_table_name": table["name"],
                        "flat_rate": rule["contract_flat_rate"],
                        "rate_per_mile": rule.get("contract_rate_per_mile"),
                        "fuel_surcharge_pct": 0.0,
                        "min_charge": None,
                    }

    # 3. Check pricing playbooks as fallback
    playbook_info = None
    playbook_query = {
        "customer_id": quote.customer_id,
        "is_active": True,
    }
    playbooks = await db.pricing_playbooks.find(playbook_query).to_list(100)

    best_playbook = None
    best_playbook_score = -1

    for p in playbooks:
        if p.get("effective_date") and p["effective_date"] > now:
            continue
        if p.get("expiry_date") and p["expiry_date"] < now:
            continue

        score = 0
        if p.get("origin_state"):
            if p["origin_state"].upper() == quote.origin_state.upper():
                score += 3
            else:
                continue
        if p.get("dest_state"):
            if p["dest_state"].upper() == quote.destination_state.upper():
                score += 3
            else:
                continue
        if p.get("equipment_type"):
            if p["equipment_type"].lower() == quote.equipment_type.lower():
                score += 2
            else:
                continue

        if score > best_playbook_score:
            best_playbook_score = score
            best_playbook = p

    if best_playbook and best_playbook.get("base_rate"):
        playbook_info = {
            "playbook_id": str(best_playbook["_id"]),
            "playbook_name": best_playbook["name"],
            "base_rate": best_playbook["base_rate"],
            "fuel_surcharge_pct": best_playbook.get("fuel_surcharge_pct", 0.0),
        }

    # 4. Build line items from the best match
    from app.models.quote import QuoteLineItem as QLI

    new_line_items = []
    applied_pricing = None

    if best_table_info:
        # Use rate table pricing
        flat = best_table_info.get("flat_rate")
        rpm = best_table_info.get("rate_per_mile")
        fsc_pct = best_table_info.get("fuel_surcharge_pct", 0.0)

        if flat:
            base_amount = flat
            new_line_items.append(QLI(description="Contracted Flat Rate", quantity=1, unit_price=base_amount))
        elif rpm:
            base_amount = rpm * 100  # Rough estimate - need miles for real calc
            new_line_items.append(QLI(description=f"Contracted Rate ({rpm} cents/mi)", quantity=1, unit_price=rpm))

        if fsc_pct > 0 and new_line_items:
            fsc_amount = int(new_line_items[0].unit_price * fsc_pct / 100)
            new_line_items.append(QLI(description=f"Fuel Surcharge ({fsc_pct}%)", quantity=1, unit_price=fsc_amount, is_accessorial=True))

        # Apply discount if present
        if discount_percent > 0:
            total_before = sum(item.unit_price * item.quantity for item in new_line_items)
            discount_amount = int(total_before * discount_percent / 100)
            new_line_items.append(QLI(
                description=f"Customer Discount ({discount_percent}%)",
                quantity=1,
                unit_price=-discount_amount,
                is_accessorial=True,
            ))

        applied_pricing = CustomerPricingApplied(
            rate_table_id=best_table_info["rate_table_id"],
            rate_table_name=best_table_info["rate_table_name"],
            discount_percent=discount_percent,
            contract_rate_per_mile=best_table_info.get("rate_per_mile"),
            contract_flat_rate=best_table_info.get("flat_rate"),
            auto_applied=True,
        )

    elif playbook_info:
        # Use playbook pricing
        base = playbook_info["base_rate"]
        fsc_pct = playbook_info.get("fuel_surcharge_pct", 0.0)

        new_line_items.append(QLI(description="Base Rate (Pricing Playbook)", quantity=1, unit_price=base))

        if fsc_pct > 0:
            fsc_amount = int(base * fsc_pct / 100)
            new_line_items.append(QLI(description=f"Fuel Surcharge ({fsc_pct}%)", quantity=1, unit_price=fsc_amount, is_accessorial=True))

        applied_pricing = CustomerPricingApplied(
            playbook_id=playbook_info["playbook_id"],
            playbook_name=playbook_info["playbook_name"],
            auto_applied=True,
        )

    if not new_line_items:
        raise HTTPException(
            status_code=404,
            detail="No matching customer pricing found for this lane/equipment combination"
        )

    # Save snapshot before applying pricing
    snapshot = quote.create_revision_snapshot(
        revised_by="system",
        change_summary="Before applying customer pricing"
    )
    quote.revision_history.append(snapshot)

    quote.line_items = new_line_items
    quote.customer_pricing_applied = applied_pricing
    quote.calculate_totals()
    quote.version_number += 1

    await db.quotes.update_one(
        {"_id": ObjectId(quote_id)},
        {"$set": quote.model_dump_mongo()}
    )

    return quote_to_response(quote)


# ============================================================================
# Quote Versioning / Revisions
# ============================================================================


class ReviseQuoteRequest(BaseModel):
    """Request body for creating a new revision of a quote."""
    change_summary: Optional[str] = None
    revised_by: Optional[str] = None
    line_items: Optional[List] = None
    estimated_cost: Optional[int] = None
    origin_city: Optional[str] = None
    origin_state: Optional[str] = None
    destination_city: Optional[str] = None
    destination_state: Optional[str] = None
    equipment_type: Optional[str] = None
    weight_lbs: Optional[int] = None
    special_requirements: Optional[str] = None
    internal_notes: Optional[str] = None


@router.get("/{quote_id}/versions", response_model=List[RevisionSnapshotResponse])
async def get_quote_versions(quote_id: str):
    """Get the revision history of a quote, including the current version."""
    db = get_database()

    quote_doc = await db.quotes.find_one({"_id": ObjectId(quote_id)})
    if not quote_doc:
        raise HTTPException(status_code=404, detail="Quote not found")

    quote = Quote(**quote_doc)

    # Build the full version list: all snapshots + current state
    versions = [_revision_to_response(r) for r in quote.revision_history]

    # Add the current version as the latest
    current = RevisionSnapshotResponse(
        version=quote.version_number,
        revised_at=quote.updated_at,
        revised_by=quote.created_by,
        change_summary="Current version",
        line_items=quote.line_items,
        total_price=quote.total_price,
        estimated_cost=quote.estimated_cost,
        margin_percent=quote.margin_percent,
        origin_city=quote.origin_city,
        origin_state=quote.origin_state,
        destination_city=quote.destination_city,
        destination_state=quote.destination_state,
        equipment_type=quote.equipment_type,
        weight_lbs=quote.weight_lbs,
        special_requirements=quote.special_requirements,
        internal_notes=quote.internal_notes,
    )
    versions.append(current)

    return versions


@router.post("/{quote_id}/revise", response_model=QuoteResponse)
async def revise_quote(quote_id: str, data: ReviseQuoteRequest):
    """Create a new revision of a quote.

    Saves the current state as a snapshot in revision_history,
    applies the changes, and increments the version number.
    """
    db = get_database()

    quote_doc = await db.quotes.find_one({"_id": ObjectId(quote_id)})
    if not quote_doc:
        raise HTTPException(status_code=404, detail="Quote not found")

    quote = Quote(**quote_doc)

    if quote.status not in [QuoteStatus.DRAFT, QuoteStatus.PENDING_APPROVAL]:
        raise HTTPException(
            status_code=400,
            detail="Can only revise draft or pending approval quotes"
        )

    # Save current state as a snapshot
    snapshot = quote.create_revision_snapshot(
        revised_by=data.revised_by,
        change_summary=data.change_summary or f"Revised from v{quote.version_number}",
    )
    quote.revision_history.append(snapshot)

    # Apply changes
    update_fields = data.model_dump(exclude_unset=True, exclude={"change_summary", "revised_by"})

    # Handle line_items specially (convert dicts to QuoteLineItem)
    if "line_items" in update_fields and update_fields["line_items"] is not None:
        from app.models.quote import QuoteLineItem as QLI
        quote.line_items = [QLI(**item) if isinstance(item, dict) else item for item in update_fields.pop("line_items")]

    for field, value in update_fields.items():
        if value is not None:
            setattr(quote, field, value)

    # Increment version and recalculate
    quote.version_number += 1
    quote.calculate_totals()

    await db.quotes.update_one(
        {"_id": ObjectId(quote_id)},
        {"$set": quote.model_dump_mongo()}
    )

    return quote_to_response(quote)


@router.post("/{quote_id}/revert/{version}", response_model=QuoteResponse)
async def revert_to_version(quote_id: str, version: int):
    """Revert a quote to a previous version.

    Saves the current state as a snapshot, then restores the specified version.
    """
    db = get_database()

    quote_doc = await db.quotes.find_one({"_id": ObjectId(quote_id)})
    if not quote_doc:
        raise HTTPException(status_code=404, detail="Quote not found")

    quote = Quote(**quote_doc)

    if quote.status not in [QuoteStatus.DRAFT, QuoteStatus.PENDING_APPROVAL]:
        raise HTTPException(
            status_code=400,
            detail="Can only revert draft or pending approval quotes"
        )

    # Find the version to revert to
    target_snapshot = None
    for snap in quote.revision_history:
        if snap.version == version:
            target_snapshot = snap
            break

    if not target_snapshot:
        raise HTTPException(status_code=404, detail=f"Version {version} not found")

    # Save current state before reverting
    snapshot = quote.create_revision_snapshot(
        revised_by="system",
        change_summary=f"Before revert to v{version}",
    )
    quote.revision_history.append(snapshot)

    # Restore from snapshot
    quote.line_items = target_snapshot.line_items.copy()
    quote.total_price = target_snapshot.total_price
    quote.estimated_cost = target_snapshot.estimated_cost
    quote.margin_percent = target_snapshot.margin_percent
    if target_snapshot.origin_city:
        quote.origin_city = target_snapshot.origin_city
    if target_snapshot.origin_state:
        quote.origin_state = target_snapshot.origin_state
    if target_snapshot.destination_city:
        quote.destination_city = target_snapshot.destination_city
    if target_snapshot.destination_state:
        quote.destination_state = target_snapshot.destination_state
    if target_snapshot.equipment_type:
        quote.equipment_type = target_snapshot.equipment_type
    quote.weight_lbs = target_snapshot.weight_lbs
    quote.special_requirements = target_snapshot.special_requirements
    quote.internal_notes = target_snapshot.internal_notes

    quote.version_number += 1
    quote.calculate_totals()

    await db.quotes.update_one(
        {"_id": ObjectId(quote_id)},
        {"$set": quote.model_dump_mongo()}
    )

    return quote_to_response(quote)


# ============================================================================
# Quote Approval Workflow
# ============================================================================


class SubmitForApprovalRequest(BaseModel):
    """Request body for submitting a quote for approval."""
    requested_by: Optional[str] = None
    notes: Optional[str] = None


class ApproveQuoteRequest(BaseModel):
    """Request body for approving a quote."""
    approved_by: Optional[str] = "manager"


class RejectQuoteRequest(BaseModel):
    """Request body for rejecting a quote."""
    reason: Optional[str] = None
    rejected_by: Optional[str] = "manager"


@router.post("/{quote_id}/submit-for-approval", response_model=QuoteResponse)
async def submit_for_approval(quote_id: str, data: SubmitForApprovalRequest = SubmitForApprovalRequest()):
    """Submit a quote for approval.

    Checks if the quote amount exceeds the approval threshold.
    If within threshold, auto-approves. Otherwise marks as pending approval.
    """
    db = get_database()

    quote_doc = await db.quotes.find_one({"_id": ObjectId(quote_id)})
    if not quote_doc:
        raise HTTPException(status_code=404, detail="Quote not found")

    quote = Quote(**quote_doc)

    if quote.status != QuoteStatus.DRAFT:
        raise HTTPException(status_code=400, detail="Can only submit draft quotes for approval")

    # Get approval settings to check thresholds
    settings_doc = await db.approval_settings.find_one({})
    auto_approve_threshold = 500000  # Default: $5,000 in cents

    if settings_doc:
        for threshold in settings_doc.get("thresholds", []):
            if threshold.get("approval_type") == "high_value_shipment" and threshold.get("enabled"):
                auto_approve_threshold = threshold.get("max_auto_approve_amount", auto_approve_threshold)
                break

    quote.approval_threshold = auto_approve_threshold

    # Check if auto-approve is possible
    if quote.total_price <= auto_approve_threshold:
        # Auto-approve
        quote.approval_status = QuoteApprovalStatus.AUTO_APPROVED
        quote.approval_required = False
        quote.approved_by = "system"
        quote.approved_at = utc_now()
        # Transition directly to sent-ready state
        quote.transition_to(QuoteStatus.SENT)
    else:
        # Needs manual approval
        quote.approval_status = QuoteApprovalStatus.PENDING
        quote.approval_required = True
        quote.transition_to(QuoteStatus.PENDING_APPROVAL)

        # Create an approval record
        from app.services import approval_service
        from app.models.approval import ApprovalType

        approval = await approval_service.request_approval(
            approval_type=ApprovalType.HIGH_VALUE_SHIPMENT,
            entity_type="quote",
            entity_id=str(quote.id),
            title=f"Quote {quote.quote_number} requires approval (${quote.total_price / 100:,.2f})",
            amount=quote.total_price,
            description=data.notes or f"Quote for {quote.origin_city}, {quote.origin_state} -> {quote.destination_city}, {quote.destination_state}",
            requested_by=data.requested_by,
        )
        quote.approval_id = str(approval.id)

        # If the approval service auto-approved it (based on its own thresholds)
        if approval.status.value == "auto_approved":
            quote.approval_status = QuoteApprovalStatus.AUTO_APPROVED
            quote.approved_by = "system"
            quote.approved_at = utc_now()
            # Move back to draft so user can send
            quote.status = QuoteStatus.DRAFT

        # Create a work item for pending approvals
        if quote.approval_status == QuoteApprovalStatus.PENDING:
            work_item = WorkItem(
                work_type=WorkItemType.CUSTOM,
                title=f"Approve quote {quote.quote_number}",
                description=f"Quote total: ${quote.total_price / 100:,.2f} exceeds auto-approval threshold of ${auto_approve_threshold / 100:,.2f}",
                priority=60,
                quote_id=quote.id,
                customer_id=quote.customer_id,
            )
            await db.work_items.insert_one(work_item.model_dump_mongo())

    quote.mark_updated()

    await db.quotes.update_one(
        {"_id": ObjectId(quote_id)},
        {"$set": quote.model_dump_mongo()}
    )

    return quote_to_response(quote)


@router.post("/{quote_id}/approve", response_model=QuoteResponse)
async def approve_quote(quote_id: str, data: ApproveQuoteRequest = ApproveQuoteRequest()):
    """Approve a quote that is pending approval. One-click approve."""
    db = get_database()

    quote_doc = await db.quotes.find_one({"_id": ObjectId(quote_id)})
    if not quote_doc:
        raise HTTPException(status_code=404, detail="Quote not found")

    quote = Quote(**quote_doc)

    if quote.approval_status != QuoteApprovalStatus.PENDING:
        raise HTTPException(status_code=400, detail=f"Quote is not pending approval (current: {quote.approval_status})")

    quote.approval_status = QuoteApprovalStatus.APPROVED
    quote.approved_by = data.approved_by
    quote.approved_at = utc_now()

    # Move from pending_approval back to draft (ready to send)
    if quote.status == QuoteStatus.PENDING_APPROVAL:
        quote.status = QuoteStatus.DRAFT

    # Also approve the linked approval record
    if quote.approval_id:
        try:
            from app.services import approval_service
            await approval_service.approve_approval(quote.approval_id, approved_by=data.approved_by or "manager")
        except (ValueError, Exception):
            pass  # Non-critical if approval record update fails

    quote.mark_updated()

    await db.quotes.update_one(
        {"_id": ObjectId(quote_id)},
        {"$set": quote.model_dump_mongo()}
    )

    return quote_to_response(quote)


@router.post("/{quote_id}/reject", response_model=QuoteResponse)
async def reject_quote(quote_id: str, data: RejectQuoteRequest = RejectQuoteRequest()):
    """Reject a quote that is pending approval."""
    db = get_database()

    quote_doc = await db.quotes.find_one({"_id": ObjectId(quote_id)})
    if not quote_doc:
        raise HTTPException(status_code=404, detail="Quote not found")

    quote = Quote(**quote_doc)

    if quote.approval_status != QuoteApprovalStatus.PENDING:
        raise HTTPException(status_code=400, detail=f"Quote is not pending approval (current: {quote.approval_status})")

    quote.approval_status = QuoteApprovalStatus.REJECTED
    quote.rejection_reason = data.reason

    # Move back to draft so user can revise
    if quote.status == QuoteStatus.PENDING_APPROVAL:
        quote.status = QuoteStatus.DRAFT

    # Also reject the linked approval record
    if quote.approval_id:
        try:
            from app.services import approval_service
            await approval_service.reject_approval(quote.approval_id, reason=data.reason)
        except (ValueError, Exception):
            pass

    quote.mark_updated()

    await db.quotes.update_one(
        {"_id": ObjectId(quote_id)},
        {"$set": quote.model_dump_mongo()}
    )

    return quote_to_response(quote)
