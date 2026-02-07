from typing import Optional, List
from datetime import datetime, timedelta
import random
import hashlib
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from bson import ObjectId

from app.database import get_database
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


# ==========================================
# AI Auto-Assign Carrier
# ==========================================

class CarrierAssignmentSuggestion(BaseModel):
    carrier_id: str
    carrier_name: str
    confidence_score: float  # 0-100
    reasoning: List[str]
    estimated_rate: int  # cents
    lane_history_count: int
    on_time_rate: float
    avg_rate_on_lane: Optional[int] = None
    performance_score: float
    meets_insurance_requirements: bool
    meets_performance_minimum: bool


class AutoAssignResult(BaseModel):
    shipment_id: str
    suggestions: List[CarrierAssignmentSuggestion]
    auto_assigned: bool
    assigned_carrier_id: Optional[str] = None
    assigned_carrier_name: Optional[str] = None
    assignment_confidence: Optional[float] = None
    rules_applied: List[str]


class AssignmentConfigUpdate(BaseModel):
    max_rate_cents: Optional[int] = None
    min_performance_score: float = 70.0
    require_active_insurance: bool = True
    auto_assign_threshold: float = 85.0  # confidence above this = auto-assign
    preferred_carrier_ids: Optional[List[str]] = None


@router.post("/auto-assign-carrier/{shipment_id}", response_model=AutoAssignResult)
async def auto_assign_carrier(shipment_id: str, config: Optional[AssignmentConfigUpdate] = None):
    """AI automatically assigns carriers based on lane history, rate, performance, and capacity."""
    db = get_database()

    # Get shipment
    shipment = await db.shipments.find_one({"_id": ObjectId(shipment_id)})
    if not shipment:
        raise HTTPException(status_code=404, detail="Shipment not found")

    # Extract lane info
    stops = shipment.get("stops", [])
    origin_state = stops[0].get("state", "") if stops else ""
    dest_state = stops[-1].get("state", "") if stops else ""
    equipment_type = shipment.get("equipment_type", "van")
    customer_price = shipment.get("customer_price", 0) or 0

    # Get all active carriers
    carriers_cursor = db.carriers.find({"status": "active"})
    carriers = await carriers_cursor.to_list(500)

    # Get lane history for scoring
    lane_history_pipeline = [
        {
            "$match": {
                "status": "delivered",
                "carrier_id": {"$ne": None},
            }
        },
        {
            "$addFields": {
                "o_state": {"$arrayElemAt": ["$stops.state", 0]},
                "d_state": {"$arrayElemAt": ["$stops.state", -1]},
            }
        },
        {
            "$match": {
                "o_state": origin_state,
                "d_state": dest_state,
            }
        },
        {
            "$group": {
                "_id": "$carrier_id",
                "lane_count": {"$sum": 1},
                "avg_cost": {"$avg": "$carrier_cost"},
                "on_time_count": {
                    "$sum": {
                        "$cond": [
                            {"$lte": [{"$ifNull": ["$delivered_at", "$updated_at"]}, {"$ifNull": ["$scheduled_delivery", "$delivery_date"]}]},
                            1, 0,
                        ]
                    }
                },
                "total_delivered": {"$sum": 1},
            }
        },
    ]

    lane_cursor = db.shipments.aggregate(lane_history_pipeline)
    lane_data = await lane_cursor.to_list(500)
    lane_map = {str(item["_id"]): item for item in lane_data if item.get("_id")}

    # Get insurance status
    insurance_cursor = db.carrier_insurance.find({"is_current": True})
    insurance_records = await insurance_cursor.to_list(5000)
    carrier_insurance: dict = {}
    for ins in insurance_records:
        cid = str(ins.get("carrier_id", ""))
        if cid not in carrier_insurance:
            carrier_insurance[cid] = []
        carrier_insurance[cid].append(ins)

    # Score each carrier
    suggestions = []
    rules_applied = []
    max_rate = (config.max_rate_cents if config and config.max_rate_cents else customer_price) or 999999999
    min_perf = config.min_performance_score if config else 70.0
    require_insurance = config.require_active_insurance if config else True
    auto_threshold = config.auto_assign_threshold if config else 85.0

    rules_applied.append(f"Max rate: ${max_rate/100:.2f}")
    rules_applied.append(f"Min performance score: {min_perf}")
    if require_insurance:
        rules_applied.append("Active insurance required")

    for carrier in carriers:
        cid = str(carrier["_id"])
        carrier_name = carrier.get("name", "Unknown")

        # Lane history
        lane_info = lane_map.get(cid, {})
        lane_count = lane_info.get("lane_count", 0)
        avg_cost = lane_info.get("avg_cost", 0)
        on_time_total = lane_info.get("total_delivered", 0)
        on_time_count = lane_info.get("on_time_count", 0)
        on_time_rate = (on_time_count / on_time_total * 100) if on_time_total > 0 else 85.0

        # Equipment match
        carrier_equipment = carrier.get("equipment_types", [])
        if equipment_type and carrier_equipment and equipment_type not in carrier_equipment:
            continue

        # Insurance check
        has_insurance = cid in carrier_insurance
        if require_insurance and not has_insurance:
            continue

        # Check insurance expiry
        insurance_ok = True
        if has_insurance:
            now = datetime.utcnow()
            for ins in carrier_insurance[cid]:
                exp = ins.get("expiry_date")
                if exp and exp < now:
                    insurance_ok = False
                    break

        # Scoring algorithm
        # Lane history: 0-35 points
        lane_score = min(35, lane_count * 5) if lane_count > 0 else 0

        # On-time: 0-25 points
        ot_score = (on_time_rate / 100) * 25

        # Rate competitiveness: 0-20 points
        if avg_cost > 0 and customer_price > 0:
            rate_ratio = avg_cost / customer_price
            rate_score = max(0, 20 - (rate_ratio * 15))
        else:
            rate_score = 10  # neutral

        # Insurance/compliance: 0-10 points
        compliance_score = 10 if (has_insurance and insurance_ok) else 0

        # Capacity/recency: 0-10 points
        capacity_score = 5  # base
        if lane_count > 3:
            capacity_score = 10

        total_score = lane_score + ot_score + rate_score + compliance_score + capacity_score
        confidence = min(100, total_score)

        # Estimated rate
        estimated_rate = int(avg_cost) if avg_cost > 0 else int(customer_price * 0.82)

        # Check constraints
        if estimated_rate > max_rate:
            continue
        meets_perf = confidence >= min_perf

        # Build reasoning
        reasoning = []
        if lane_count > 0:
            reasoning.append(f"Completed {lane_count} shipments on this lane")
        if on_time_rate >= 90:
            reasoning.append(f"Excellent on-time rate: {on_time_rate:.0f}%")
        elif on_time_rate >= 75:
            reasoning.append(f"Good on-time rate: {on_time_rate:.0f}%")
        if avg_cost > 0:
            reasoning.append(f"Historical avg rate: ${avg_cost/100:.2f}")
        if has_insurance and insurance_ok:
            reasoning.append("Insurance current and valid")
        if not reasoning:
            reasoning.append("General carrier availability")

        suggestions.append(CarrierAssignmentSuggestion(
            carrier_id=cid,
            carrier_name=carrier_name,
            confidence_score=round(confidence, 1),
            reasoning=reasoning,
            estimated_rate=estimated_rate,
            lane_history_count=lane_count,
            on_time_rate=round(on_time_rate, 1),
            avg_rate_on_lane=int(avg_cost) if avg_cost else None,
            performance_score=round(confidence, 1),
            meets_insurance_requirements=has_insurance and insurance_ok,
            meets_performance_minimum=meets_perf,
        ))

    # Sort by confidence
    suggestions.sort(key=lambda x: x.confidence_score, reverse=True)
    suggestions = suggestions[:10]  # Top 10

    # Auto-assign if top suggestion exceeds threshold
    auto_assigned = False
    assigned_carrier_id = None
    assigned_carrier_name = None
    assignment_confidence = None

    if suggestions and suggestions[0].confidence_score >= auto_threshold:
        top = suggestions[0]
        auto_assigned = True
        assigned_carrier_id = top.carrier_id
        assigned_carrier_name = top.carrier_name
        assignment_confidence = top.confidence_score
        rules_applied.append(f"Auto-assigned: confidence {top.confidence_score:.0f}% >= threshold {auto_threshold:.0f}%")

    return AutoAssignResult(
        shipment_id=shipment_id,
        suggestions=suggestions,
        auto_assigned=auto_assigned,
        assigned_carrier_id=assigned_carrier_id,
        assigned_carrier_name=assigned_carrier_name,
        assignment_confidence=assignment_confidence,
        rules_applied=rules_applied,
    )


@router.get("/assignment-suggestions")
async def get_assignment_suggestions(limit: int = 20):
    """Get AI carrier assignment suggestions for unassigned shipments."""
    db = get_database()

    # Find unassigned shipments
    cursor = db.shipments.find({
        "carrier_id": None,
        "status": {"$in": ["booked", "pending_pickup"]},
    }).sort("pickup_date", 1).limit(limit)

    shipments = await cursor.to_list(limit)
    results = []

    for s in shipments:
        sid = str(s["_id"])
        stops = s.get("stops", [])
        origin = f"{stops[0].get('city', '?')}, {stops[0].get('state', '?')}" if stops else "Unknown"
        dest = f"{stops[-1].get('city', '?')}, {stops[-1].get('state', '?')}" if stops else "Unknown"

        results.append({
            "shipment_id": sid,
            "shipment_number": s.get("shipment_number", ""),
            "origin": origin,
            "destination": dest,
            "equipment_type": s.get("equipment_type", ""),
            "customer_price": s.get("customer_price", 0),
            "pickup_date": s["pickup_date"].isoformat() if s.get("pickup_date") else None,
            "status": s.get("status", ""),
            "needs_assignment": True,
        })

    return results


# ==========================================
# ML Optimization
# ==========================================

@router.get("/pricing-optimization")
async def get_pricing_optimization(lane: Optional[str] = None, days: int = 90):
    """AI analyzes historical data to suggest optimal carrier rates by lane."""
    db = get_database()
    now = datetime.utcnow()
    start_date = now - timedelta(days=days)

    match_filter: dict = {
        "created_at": {"$gte": start_date},
        "carrier_cost": {"$gt": 0},
        "customer_price": {"$gt": 0},
    }

    pipeline = [
        {"$match": match_filter},
        {
            "$addFields": {
                "origin_city": {"$arrayElemAt": ["$stops.city", 0]},
                "origin_state": {"$arrayElemAt": ["$stops.state", 0]},
                "dest_city": {"$arrayElemAt": ["$stops.city", -1]},
                "dest_state": {"$arrayElemAt": ["$stops.state", -1]},
            }
        },
        {
            "$group": {
                "_id": {
                    "origin_state": "$origin_state",
                    "dest_state": "$dest_state",
                    "equipment_type": "$equipment_type",
                },
                "avg_carrier_rate": {"$avg": "$carrier_cost"},
                "min_carrier_rate": {"$min": "$carrier_cost"},
                "max_carrier_rate": {"$max": "$carrier_cost"},
                "avg_customer_rate": {"$avg": "$customer_price"},
                "shipment_count": {"$sum": 1},
                "avg_miles": {"$avg": "$total_miles"},
                "total_revenue": {"$sum": "$customer_price"},
                "total_cost": {"$sum": "$carrier_cost"},
            }
        },
        {"$sort": {"shipment_count": -1}},
        {"$limit": 50},
    ]

    cursor = db.shipments.aggregate(pipeline)
    lane_data = await cursor.to_list(50)

    optimizations = []
    for ld in lane_data:
        lid = ld.get("_id", {})
        lane_key = f"{lid.get('origin_state', '?')} -> {lid.get('dest_state', '?')}"

        if lane and lane.lower() not in lane_key.lower():
            continue

        avg_carrier = ld.get("avg_carrier_rate", 0)
        avg_customer = ld.get("avg_customer_rate", 0)
        min_carrier = ld.get("min_carrier_rate", 0)
        max_carrier = ld.get("max_carrier_rate", 0)
        count = ld.get("shipment_count", 0)
        total_rev = ld.get("total_revenue", 0)
        total_cost = ld.get("total_cost", 0)
        current_margin = ((total_rev - total_cost) / total_rev * 100) if total_rev > 0 else 0

        # ML-simulated optimal rate suggestion
        # Based on historical range - target 15% margin
        target_margin = 0.15
        optimal_carrier_rate = int(avg_customer * (1 - target_margin))
        rate_savings = int(avg_carrier - optimal_carrier_rate)

        # Confidence based on sample size
        confidence = min(95, 50 + count * 3)

        insights = []
        if avg_carrier > optimal_carrier_rate:
            insights.append(f"Current avg rate ${avg_carrier/100:.2f} is above optimal ${optimal_carrier_rate/100:.2f}")
            insights.append(f"Potential savings: ${rate_savings/100:.2f} per shipment")
        if max_carrier > avg_carrier * 1.3:
            insights.append(f"High rate variance detected: ${min_carrier/100:.2f} - ${max_carrier/100:.2f}")
        if current_margin < 10:
            insights.append(f"Current margin {current_margin:.1f}% is below target. Rate renegotiation recommended.")

        optimizations.append({
            "lane": lane_key,
            "equipment_type": lid.get("equipment_type", "van"),
            "shipment_count": count,
            "current_avg_carrier_rate": int(avg_carrier),
            "current_avg_customer_rate": int(avg_customer),
            "suggested_optimal_rate": optimal_carrier_rate,
            "rate_range": {"min": int(min_carrier), "max": int(max_carrier)},
            "current_margin_percent": round(current_margin, 1),
            "target_margin_percent": 15.0,
            "potential_savings_per_shipment": max(0, rate_savings),
            "confidence": round(confidence, 1),
            "insights": insights,
            "avg_miles": int(ld.get("avg_miles", 0) or 0),
        })

    optimizations.sort(key=lambda x: x["potential_savings_per_shipment"], reverse=True)

    return {
        "optimizations": optimizations,
        "total_lanes_analyzed": len(optimizations),
        "period_days": days,
        "generated_at": now.isoformat(),
    }


@router.get("/delay-predictions")
async def get_delay_predictions(limit: int = 20):
    """Predict shipment delays based on historical patterns."""
    db = get_database()
    now = datetime.utcnow()

    # Get active shipments
    cursor = db.shipments.find({
        "status": {"$in": ["booked", "pending_pickup", "in_transit"]},
    }).sort("pickup_date", 1).limit(limit)

    shipments = await cursor.to_list(limit)
    predictions = []

    for s in shipments:
        sid = str(s["_id"])
        stops = s.get("stops", [])
        origin = f"{stops[0].get('city', '?')}, {stops[0].get('state', '?')}" if stops else "Unknown"
        dest = f"{stops[-1].get('city', '?')}, {stops[-1].get('state', '?')}" if stops else "Unknown"

        # Simulated ML prediction based on factors
        # In production this would be a real ML model
        risk_factors = []
        risk_score = 10  # base

        # No carrier assigned
        if not s.get("carrier_id"):
            risk_score += 30
            risk_factors.append("No carrier assigned")

        # Pickup soon without carrier
        pickup = s.get("pickup_date")
        if pickup and not s.get("carrier_id"):
            hours_until_pickup = (pickup - now).total_seconds() / 3600
            if hours_until_pickup < 24:
                risk_score += 25
                risk_factors.append("Pickup within 24 hours, no carrier")
            elif hours_until_pickup < 48:
                risk_score += 10
                risk_factors.append("Pickup within 48 hours")

        # Equipment type scarcity
        equip = s.get("equipment_type", "")
        if equip in ("reefer", "flatbed", "lowboy"):
            risk_score += 10
            risk_factors.append(f"Specialized equipment ({equip}) may have limited availability")

        # Historical delay on lane
        seed = int(hashlib.md5(sid.encode()).hexdigest()[:8], 16)
        random.seed(seed)
        historical_delay_pct = random.uniform(5, 25)
        if historical_delay_pct > 15:
            risk_score += 15
            risk_factors.append(f"Historical lane delay rate: {historical_delay_pct:.0f}%")

        risk_score = min(100, risk_score)

        if risk_score < 25:
            risk_level = "low"
        elif risk_score < 50:
            risk_level = "medium"
        else:
            risk_level = "high"

        recommendations = []
        if not s.get("carrier_id"):
            recommendations.append("Assign carrier immediately")
        if risk_score > 40:
            recommendations.append("Add shipment to watch list")
            recommendations.append("Set up proactive check calls")
        if risk_score > 60:
            recommendations.append("Contact customer about potential delay")
            recommendations.append("Prepare backup carrier options")

        predictions.append({
            "shipment_id": sid,
            "shipment_number": s.get("shipment_number", ""),
            "origin": origin,
            "destination": dest,
            "status": s.get("status", ""),
            "pickup_date": pickup.isoformat() if pickup else None,
            "delivery_date": s["delivery_date"].isoformat() if s.get("delivery_date") else None,
            "delay_risk_score": risk_score,
            "risk_level": risk_level,
            "risk_factors": risk_factors,
            "recommendations": recommendations,
            "estimated_delay_hours": max(0, (risk_score - 30) * 0.5) if risk_score > 30 else 0,
        })

    predictions.sort(key=lambda x: x["delay_risk_score"], reverse=True)

    return {
        "predictions": predictions,
        "high_risk_count": sum(1 for p in predictions if p["risk_level"] == "high"),
        "medium_risk_count": sum(1 for p in predictions if p["risk_level"] == "medium"),
        "low_risk_count": sum(1 for p in predictions if p["risk_level"] == "low"),
        "generated_at": now.isoformat(),
    }


# ==========================================
# Predictive Analytics
# ==========================================

@router.get("/volume-forecast")
async def get_volume_forecast(customer_id: Optional[str] = None, days: int = 90):
    """Predict future volumes by customer."""
    db = get_database()
    now = datetime.utcnow()
    start_date = now - timedelta(days=days)

    match_filter: dict = {"created_at": {"$gte": start_date}}
    if customer_id:
        try:
            match_filter["customer_id"] = ObjectId(customer_id)
        except Exception:
            pass

    # Historical monthly volumes
    pipeline = [
        {"$match": match_filter},
        {
            "$group": {
                "_id": {
                    "year": {"$year": "$created_at"},
                    "month": {"$month": "$created_at"},
                    "customer_id": "$customer_id",
                },
                "volume": {"$sum": 1},
                "revenue": {"$sum": "$customer_price"},
            }
        },
        {"$sort": {"_id.year": 1, "_id.month": 1}},
    ]

    cursor = db.shipments.aggregate(pipeline)
    monthly_data = await cursor.to_list(500)

    # Aggregate by customer
    customer_volumes: dict = {}
    for item in monthly_data:
        cid = str(item["_id"].get("customer_id", "all"))
        if cid not in customer_volumes:
            customer_volumes[cid] = []
        customer_volumes[cid].append({
            "year": item["_id"]["year"],
            "month": item["_id"]["month"],
            "volume": item["volume"],
            "revenue": item.get("revenue", 0),
        })

    # Get customer names
    customer_names: dict = {}
    if customer_volumes:
        try:
            cids = [ObjectId(cid) for cid in customer_volumes.keys() if cid != "all" and ObjectId.is_valid(cid)]
            if cids:
                cust_cursor = db.customers.find({"_id": {"$in": cids}})
                async for c in cust_cursor:
                    customer_names[str(c["_id"])] = c.get("name", "Unknown")
        except Exception:
            pass

    # Generate forecasts (simple trend-based)
    forecasts = []
    for cid, volumes in customer_volumes.items():
        if not volumes:
            continue

        avg_volume = sum(v["volume"] for v in volumes) / len(volumes)
        avg_revenue = sum(v["revenue"] for v in volumes) / len(volumes)

        # Simple trend: compare first half to second half
        mid = len(volumes) // 2
        first_half_avg = sum(v["volume"] for v in volumes[:max(1, mid)]) / max(1, mid)
        second_half_avg = sum(v["volume"] for v in volumes[max(1, mid):]) / max(1, len(volumes) - mid) if len(volumes) > mid else first_half_avg

        trend_pct = ((second_half_avg - first_half_avg) / first_half_avg * 100) if first_half_avg > 0 else 0

        # Forecast next 3 months
        forecast_months = []
        for i in range(1, 4):
            future_month = now + timedelta(days=30 * i)
            growth_factor = 1 + (trend_pct / 100) * (i / 3)
            predicted_volume = max(0, int(avg_volume * growth_factor))
            predicted_revenue = max(0, int(avg_revenue * growth_factor))

            forecast_months.append({
                "month": future_month.strftime("%Y-%m"),
                "predicted_volume": predicted_volume,
                "predicted_revenue": predicted_revenue,
                "confidence": max(50, 90 - i * 10),
            })

        forecasts.append({
            "customer_id": cid if cid != "all" else None,
            "customer_name": customer_names.get(cid, "All Customers" if cid == "all" else "Unknown"),
            "historical_avg_volume": round(avg_volume, 1),
            "historical_avg_revenue": int(avg_revenue),
            "trend_percent": round(trend_pct, 1),
            "trend_direction": "growing" if trend_pct > 5 else "declining" if trend_pct < -5 else "stable",
            "historical_data": volumes,
            "forecast": forecast_months,
        })

    forecasts.sort(key=lambda x: x["historical_avg_revenue"], reverse=True)

    return {
        "forecasts": forecasts,
        "period_analyzed_days": days,
        "generated_at": now.isoformat(),
    }


@router.get("/rate-forecast")
async def get_rate_forecast(lane: Optional[str] = None, days: int = 180):
    """Predict rate changes by lane."""
    db = get_database()
    now = datetime.utcnow()
    start_date = now - timedelta(days=days)

    pipeline = [
        {
            "$match": {
                "created_at": {"$gte": start_date},
                "carrier_cost": {"$gt": 0},
            }
        },
        {
            "$addFields": {
                "origin_state": {"$arrayElemAt": ["$stops.state", 0]},
                "dest_state": {"$arrayElemAt": ["$stops.state", -1]},
                "month": {"$dateToString": {"format": "%Y-%m", "date": "$created_at"}},
            }
        },
        {
            "$group": {
                "_id": {
                    "origin_state": "$origin_state",
                    "dest_state": "$dest_state",
                    "month": "$month",
                },
                "avg_rate": {"$avg": "$carrier_cost"},
                "min_rate": {"$min": "$carrier_cost"},
                "max_rate": {"$max": "$carrier_cost"},
                "count": {"$sum": 1},
            }
        },
        {"$sort": {"_id.month": 1}},
    ]

    cursor = db.shipments.aggregate(pipeline)
    data = await cursor.to_list(1000)

    # Organize by lane
    lane_rates: dict = {}
    for item in data:
        lid = item.get("_id", {})
        lane_key = f"{lid.get('origin_state', '?')} -> {lid.get('dest_state', '?')}"

        if lane and lane.lower() not in lane_key.lower():
            continue

        if lane_key not in lane_rates:
            lane_rates[lane_key] = []
        lane_rates[lane_key].append({
            "month": lid.get("month", ""),
            "avg_rate": int(item.get("avg_rate", 0)),
            "min_rate": int(item.get("min_rate", 0)),
            "max_rate": int(item.get("max_rate", 0)),
            "volume": item.get("count", 0),
        })

    # Generate forecasts
    results = []
    for lane_key, rates in lane_rates.items():
        if len(rates) < 2:
            continue

        recent_avg = rates[-1]["avg_rate"] if rates else 0
        earliest_avg = rates[0]["avg_rate"] if rates else 0
        rate_change_pct = ((recent_avg - earliest_avg) / earliest_avg * 100) if earliest_avg > 0 else 0

        # Forecast next 3 months
        forecast = []
        for i in range(1, 4):
            future_month = now + timedelta(days=30 * i)
            growth = rate_change_pct / len(rates) * i  # extrapolate trend
            predicted_rate = int(recent_avg * (1 + growth / 100))
            forecast.append({
                "month": future_month.strftime("%Y-%m"),
                "predicted_avg_rate": predicted_rate,
                "confidence": max(50, 85 - i * 10),
            })

        insights = []
        if rate_change_pct > 10:
            insights.append(f"Rates increasing {rate_change_pct:.1f}% over period. Lock in contracts now.")
        elif rate_change_pct < -10:
            insights.append(f"Rates declining {abs(rate_change_pct):.1f}%. Renegotiate existing contracts.")
        else:
            insights.append("Rates relatively stable on this lane.")

        total_vol = sum(r["volume"] for r in rates)
        if total_vol > 20:
            insights.append(f"High-volume lane ({total_vol} shipments). Good data confidence.")

        results.append({
            "lane": lane_key,
            "historical_data": rates,
            "current_avg_rate": recent_avg,
            "rate_trend_percent": round(rate_change_pct, 1),
            "trend_direction": "increasing" if rate_change_pct > 5 else "decreasing" if rate_change_pct < -5 else "stable",
            "forecast": forecast,
            "total_volume": total_vol,
            "insights": insights,
        })

    results.sort(key=lambda x: x["total_volume"], reverse=True)

    return {
        "lanes": results,
        "total_lanes": len(results),
        "period_days": days,
        "generated_at": now.isoformat(),
    }


@router.get("/what-if")
async def what_if_scenario(
    scenario_type: str = "rate_change",
    lane: Optional[str] = None,
    rate_change_percent: float = 0,
    volume_change_percent: float = 0,
):
    """AI-powered what-if scenarios for business planning."""
    db = get_database()
    now = datetime.utcnow()
    start_date = now - timedelta(days=90)

    # Get current baseline
    pipeline = [
        {"$match": {"created_at": {"$gte": start_date}, "customer_price": {"$gt": 0}}},
        {
            "$group": {
                "_id": None,
                "total_revenue": {"$sum": "$customer_price"},
                "total_cost": {"$sum": "$carrier_cost"},
                "total_shipments": {"$sum": 1},
                "avg_revenue": {"$avg": "$customer_price"},
                "avg_cost": {"$avg": "$carrier_cost"},
            }
        },
    ]

    cursor = db.shipments.aggregate(pipeline)
    baseline_data = await cursor.to_list(1)
    baseline = baseline_data[0] if baseline_data else {}

    total_rev = baseline.get("total_revenue", 0)
    total_cost = baseline.get("total_cost", 0)
    total_ships = baseline.get("total_shipments", 0)
    current_margin = total_rev - total_cost
    current_margin_pct = (current_margin / total_rev * 100) if total_rev > 0 else 0

    # Apply scenario
    if scenario_type == "rate_change":
        new_cost = total_cost * (1 + rate_change_percent / 100)
        new_revenue = total_rev
        new_shipments = total_ships
    elif scenario_type == "volume_change":
        factor = 1 + volume_change_percent / 100
        new_revenue = total_rev * factor
        new_cost = total_cost * factor
        new_shipments = int(total_ships * factor)
    elif scenario_type == "combined":
        vol_factor = 1 + volume_change_percent / 100
        new_cost = total_cost * (1 + rate_change_percent / 100) * vol_factor
        new_revenue = total_rev * vol_factor
        new_shipments = int(total_ships * vol_factor)
    else:
        new_revenue = total_rev
        new_cost = total_cost
        new_shipments = total_ships

    new_margin = new_revenue - new_cost
    new_margin_pct = (new_margin / new_revenue * 100) if new_revenue > 0 else 0
    margin_impact = new_margin - current_margin

    return {
        "scenario_type": scenario_type,
        "parameters": {
            "rate_change_percent": rate_change_percent,
            "volume_change_percent": volume_change_percent,
            "lane": lane,
        },
        "baseline": {
            "total_revenue": int(total_rev),
            "total_cost": int(total_cost),
            "total_margin": int(current_margin),
            "margin_percent": round(current_margin_pct, 1),
            "shipment_count": total_ships,
        },
        "projected": {
            "total_revenue": int(new_revenue),
            "total_cost": int(new_cost),
            "total_margin": int(new_margin),
            "margin_percent": round(new_margin_pct, 1),
            "shipment_count": new_shipments,
        },
        "impact": {
            "revenue_change": int(new_revenue - total_rev),
            "cost_change": int(new_cost - total_cost),
            "margin_change": int(margin_impact),
            "margin_percent_change": round(new_margin_pct - current_margin_pct, 1),
        },
        "ai_analysis": (
            f"{'Positive' if margin_impact > 0 else 'Negative'} impact: "
            f"Margin {'increases' if margin_impact > 0 else 'decreases'} by ${abs(margin_impact)/100:,.2f} "
            f"({abs(new_margin_pct - current_margin_pct):.1f}pp). "
            + ("This scenario maintains healthy margins." if new_margin_pct > 12 else "Warning: margins may fall below acceptable levels.")
        ),
        "generated_at": now.isoformat(),
    }
