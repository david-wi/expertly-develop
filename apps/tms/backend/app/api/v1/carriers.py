from typing import List, Optional
from fastapi import APIRouter, HTTPException
from bson import ObjectId

from app.database import get_database
from app.models.carrier import Carrier, CarrierStatus, EquipmentType
from app.schemas.carrier import CarrierCreate, CarrierUpdate, CarrierResponse

router = APIRouter()


def carrier_to_response(carrier: Carrier) -> CarrierResponse:
    """Convert Carrier model to response schema."""
    return CarrierResponse(
        id=str(carrier.id),
        name=carrier.name,
        mc_number=carrier.mc_number,
        dot_number=carrier.dot_number,
        status=carrier.status,
        contacts=carrier.contacts,
        dispatch_email=carrier.dispatch_email,
        dispatch_phone=carrier.dispatch_phone,
        equipment_types=carrier.equipment_types,
        address_line1=carrier.address_line1,
        city=carrier.city,
        state=carrier.state,
        zip_code=carrier.zip_code,
        insurance_expiration=carrier.insurance_expiration,
        authority_active=carrier.authority_active,
        safety_rating=carrier.safety_rating,
        payment_terms=carrier.payment_terms,
        factoring_company=carrier.factoring_company,
        quickpay_available=carrier.quickpay_available,
        quickpay_discount_percent=carrier.quickpay_discount_percent,
        preferred_lanes=carrier.preferred_lanes,
        total_loads=carrier.total_loads,
        on_time_deliveries=carrier.on_time_deliveries,
        on_time_percentage=carrier.on_time_percentage,
        claims_count=carrier.claims_count,
        last_load_at=carrier.last_load_at,
        avg_rating=carrier.avg_rating,
        is_insurance_expiring=carrier.is_insurance_expiring,
        notes=carrier.notes,
        created_at=carrier.created_at,
        updated_at=carrier.updated_at,
    )


@router.get("", response_model=List[CarrierResponse])
async def list_carriers(
    status: Optional[CarrierStatus] = None,
    equipment_type: Optional[EquipmentType] = None,
    search: Optional[str] = None,
):
    """List all carriers with optional filters."""
    db = get_database()

    query = {}
    if status:
        query["status"] = status
    if equipment_type:
        query["equipment_types"] = equipment_type
    if search:
        query["$or"] = [
            {"name": {"$regex": search, "$options": "i"}},
            {"mc_number": {"$regex": search, "$options": "i"}},
            {"dot_number": {"$regex": search, "$options": "i"}},
        ]

    cursor = db.carriers.find(query).sort("name", 1)
    carriers = await cursor.to_list(1000)

    return [carrier_to_response(Carrier(**c)) for c in carriers]


@router.get("/{carrier_id}", response_model=CarrierResponse)
async def get_carrier(carrier_id: str):
    """Get a carrier by ID."""
    db = get_database()

    carrier = await db.carriers.find_one({"_id": ObjectId(carrier_id)})
    if not carrier:
        raise HTTPException(status_code=404, detail="Carrier not found")

    return carrier_to_response(Carrier(**carrier))


@router.post("", response_model=CarrierResponse)
async def create_carrier(data: CarrierCreate):
    """Create a new carrier."""
    db = get_database()

    carrier = Carrier(**data.model_dump())
    await db.carriers.insert_one(carrier.model_dump_mongo())

    return carrier_to_response(carrier)


@router.patch("/{carrier_id}", response_model=CarrierResponse)
async def update_carrier(carrier_id: str, data: CarrierUpdate):
    """Update a carrier."""
    db = get_database()

    carrier_doc = await db.carriers.find_one({"_id": ObjectId(carrier_id)})
    if not carrier_doc:
        raise HTTPException(status_code=404, detail="Carrier not found")

    carrier = Carrier(**carrier_doc)

    # Apply updates
    update_data = data.model_dump(exclude_unset=True)

    # Handle status transitions
    if "status" in update_data:
        new_status = update_data.pop("status")
        if new_status and new_status != carrier.status:
            carrier.transition_to(new_status)

    for field, value in update_data.items():
        setattr(carrier, field, value)

    carrier.mark_updated()

    await db.carriers.update_one(
        {"_id": ObjectId(carrier_id)},
        {"$set": carrier.model_dump_mongo()}
    )

    return carrier_to_response(carrier)


@router.delete("/{carrier_id}")
async def delete_carrier(carrier_id: str):
    """Delete a carrier."""
    db = get_database()

    result = await db.carriers.delete_one({"_id": ObjectId(carrier_id)})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Carrier not found")

    return {"success": True}


# ============================================================================
# Carrier Capacity Tracking
# ============================================================================

from pydantic import BaseModel
from datetime import datetime, timedelta
from app.models.base import utc_now


class CapacityPostingCreate(BaseModel):
    equipment_type: str = "van"
    truck_count: int = 1
    available_date: Optional[str] = None
    origin_city: Optional[str] = None
    origin_state: Optional[str] = None
    origin_radius_miles: int = 100
    destination_city: Optional[str] = None
    destination_state: Optional[str] = None
    destination_radius_miles: int = 200
    notes: Optional[str] = None
    rate_per_mile_target: Optional[float] = None
    expires_hours: int = 48


class CapacityPostingResponse(BaseModel):
    id: str
    carrier_id: str
    carrier_name: str
    equipment_type: str
    truck_count: int
    available_date: Optional[str] = None
    origin_city: Optional[str] = None
    origin_state: Optional[str] = None
    origin_radius_miles: int = 100
    destination_city: Optional[str] = None
    destination_state: Optional[str] = None
    destination_radius_miles: int = 200
    notes: Optional[str] = None
    rate_per_mile_target: Optional[float] = None
    expires_at: Optional[str] = None
    is_active: bool = True
    ai_matched_loads: int = 0
    created_at: str


@router.post("/{carrier_id}/capacity", response_model=CapacityPostingResponse)
async def post_carrier_capacity(carrier_id: str, data: CapacityPostingCreate):
    """Post available capacity for a carrier."""
    db = get_database()

    carrier = await db.carriers.find_one({"_id": ObjectId(carrier_id)})
    if not carrier:
        raise HTTPException(status_code=404, detail="Carrier not found")

    now = utc_now()
    expires_at = now + timedelta(hours=data.expires_hours)

    capacity_doc = {
        "_id": ObjectId(),
        "carrier_id": ObjectId(carrier_id),
        "carrier_name": carrier.get("name", ""),
        "equipment_type": data.equipment_type,
        "truck_count": data.truck_count,
        "available_date": data.available_date,
        "origin_city": data.origin_city,
        "origin_state": data.origin_state,
        "origin_radius_miles": data.origin_radius_miles,
        "destination_city": data.destination_city,
        "destination_state": data.destination_state,
        "destination_radius_miles": data.destination_radius_miles,
        "notes": data.notes,
        "rate_per_mile_target": data.rate_per_mile_target,
        "expires_at": expires_at,
        "is_active": True,
        "ai_matched_loads": 0,
        "created_at": now,
        "updated_at": now,
    }

    await db.carrier_capacity.insert_one(capacity_doc)

    # AI: count potential matching open loads
    match_query = {"status": {"$in": ["booked", "pending_pickup"]}, "carrier_id": None}
    if data.equipment_type:
        match_query["equipment_type"] = data.equipment_type
    ai_matched = await db.shipments.count_documents(match_query)
    await db.carrier_capacity.update_one(
        {"_id": capacity_doc["_id"]},
        {"$set": {"ai_matched_loads": min(ai_matched, 50)}}
    )

    return CapacityPostingResponse(
        id=str(capacity_doc["_id"]),
        carrier_id=carrier_id,
        carrier_name=carrier.get("name", ""),
        equipment_type=data.equipment_type,
        truck_count=data.truck_count,
        available_date=data.available_date,
        origin_city=data.origin_city,
        origin_state=data.origin_state,
        origin_radius_miles=data.origin_radius_miles,
        destination_city=data.destination_city,
        destination_state=data.destination_state,
        destination_radius_miles=data.destination_radius_miles,
        notes=data.notes,
        rate_per_mile_target=data.rate_per_mile_target,
        expires_at=expires_at.isoformat(),
        is_active=True,
        ai_matched_loads=min(ai_matched, 50),
        created_at=now.isoformat(),
    )


@router.get("/available-capacity", response_model=List[CapacityPostingResponse])
async def get_available_capacity(
    origin_state: Optional[str] = None,
    destination_state: Optional[str] = None,
    equipment_type: Optional[str] = None,
):
    """Get available carrier capacity with optional lane/equipment filters."""
    db = get_database()

    query = {"is_active": True, "expires_at": {"$gt": utc_now()}}
    if origin_state:
        query["origin_state"] = {"$regex": origin_state, "$options": "i"}
    if destination_state:
        query["destination_state"] = {"$regex": destination_state, "$options": "i"}
    if equipment_type:
        query["equipment_type"] = equipment_type

    cursor = db.carrier_capacity.find(query).sort("created_at", -1)
    docs = await cursor.to_list(200)

    return [
        CapacityPostingResponse(
            id=str(d["_id"]),
            carrier_id=str(d["carrier_id"]),
            carrier_name=d.get("carrier_name", ""),
            equipment_type=d.get("equipment_type", "van"),
            truck_count=d.get("truck_count", 1),
            available_date=d.get("available_date"),
            origin_city=d.get("origin_city"),
            origin_state=d.get("origin_state"),
            origin_radius_miles=d.get("origin_radius_miles", 100),
            destination_city=d.get("destination_city"),
            destination_state=d.get("destination_state"),
            destination_radius_miles=d.get("destination_radius_miles", 200),
            notes=d.get("notes"),
            rate_per_mile_target=d.get("rate_per_mile_target"),
            expires_at=d["expires_at"].isoformat() if d.get("expires_at") else None,
            is_active=d.get("is_active", True),
            ai_matched_loads=d.get("ai_matched_loads", 0),
            created_at=d["created_at"].isoformat() if d.get("created_at") else "",
        )
        for d in docs
    ]


@router.get("/capacity-heatmap")
async def get_capacity_heatmap():
    """Get carrier capacity aggregated by region for heatmap visualization."""
    db = get_database()

    # Aggregate active capacity by state
    pipeline = [
        {"$match": {"is_active": True, "expires_at": {"$gt": utc_now()}}},
        {"$group": {
            "_id": "$origin_state",
            "total_trucks": {"$sum": "$truck_count"},
            "posting_count": {"$sum": 1},
            "equipment_types": {"$addToSet": "$equipment_type"},
        }},
        {"$sort": {"total_trucks": -1}},
    ]
    cursor = db.carrier_capacity.aggregate(pipeline)
    results = await cursor.to_list(100)

    return [
        {
            "state": r["_id"] or "Unknown",
            "total_trucks": r["total_trucks"],
            "posting_count": r["posting_count"],
            "equipment_types": r["equipment_types"],
        }
        for r in results if r["_id"]
    ]


# ============================================================================
# Onboarding Dashboard
# ============================================================================

@router.get("/onboarding-dashboard")
async def get_onboarding_dashboard():
    """Get onboarding progress dashboard for all carriers in onboarding."""
    db = get_database()

    pipeline = [
        {"$match": {"status": {"$in": ["in_progress", "pending_review", "not_started"]}}},
        {"$sort": {"updated_at": -1}},
        {"$limit": 100},
    ]
    cursor = db.carrier_onboardings.aggregate(pipeline)
    onboardings = await cursor.to_list(100)

    # Count by status
    status_counts = {}
    items = []
    for ob in onboardings:
        status = ob.get("status", "not_started")
        status_counts[status] = status_counts.get(status, 0) + 1
        total_steps = ob.get("total_steps", 6)
        current_step = ob.get("current_step", 1)
        items.append({
            "id": str(ob["_id"]),
            "company_name": ob.get("company_name", ""),
            "contact_name": ob.get("contact_name", ""),
            "contact_email": ob.get("contact_email", ""),
            "mc_number": ob.get("mc_number"),
            "dot_number": ob.get("dot_number"),
            "status": status,
            "current_step": current_step,
            "total_steps": total_steps,
            "progress_percent": int((current_step / total_steps) * 100) if total_steps > 0 else 0,
            "created_at": ob.get("created_at", "").isoformat() if hasattr(ob.get("created_at", ""), "isoformat") else str(ob.get("created_at", "")),
            "updated_at": ob.get("updated_at", "").isoformat() if hasattr(ob.get("updated_at", ""), "isoformat") else str(ob.get("updated_at", "")),
        })

    return {
        "total": len(items),
        "status_counts": status_counts,
        "onboardings": items,
    }
