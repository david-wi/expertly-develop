from datetime import datetime, timezone
from typing import List, Optional
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from bson import ObjectId

from app.database import get_database
from app.models.pricing_playbook import PricingPlaybook

router = APIRouter()


class PricingPlaybookCreate(BaseModel):
    name: str
    origin_state: Optional[str] = None
    dest_state: Optional[str] = None
    equipment_type: Optional[str] = None
    base_rate: int = 0
    fuel_surcharge_pct: float = 0.0
    min_rate: int = 0
    max_rate: int = 0
    effective_date: Optional[datetime] = None
    expiry_date: Optional[datetime] = None
    notes: Optional[str] = None
    is_active: bool = True


class PricingPlaybookUpdate(BaseModel):
    name: Optional[str] = None
    origin_state: Optional[str] = None
    dest_state: Optional[str] = None
    equipment_type: Optional[str] = None
    base_rate: Optional[int] = None
    fuel_surcharge_pct: Optional[float] = None
    min_rate: Optional[int] = None
    max_rate: Optional[int] = None
    effective_date: Optional[datetime] = None
    expiry_date: Optional[datetime] = None
    notes: Optional[str] = None
    is_active: Optional[bool] = None


class PricingPlaybookResponse(BaseModel):
    id: str
    customer_id: str
    name: str
    origin_state: Optional[str] = None
    dest_state: Optional[str] = None
    equipment_type: Optional[str] = None
    base_rate: int
    fuel_surcharge_pct: float
    min_rate: int
    max_rate: int
    effective_date: Optional[str] = None
    expiry_date: Optional[str] = None
    notes: Optional[str] = None
    is_active: bool
    created_at: str
    updated_at: str


def playbook_to_response(playbook: PricingPlaybook) -> PricingPlaybookResponse:
    return PricingPlaybookResponse(
        id=str(playbook.id),
        customer_id=str(playbook.customer_id),
        name=playbook.name,
        origin_state=playbook.origin_state,
        dest_state=playbook.dest_state,
        equipment_type=playbook.equipment_type,
        base_rate=playbook.base_rate,
        fuel_surcharge_pct=playbook.fuel_surcharge_pct,
        min_rate=playbook.min_rate,
        max_rate=playbook.max_rate,
        effective_date=playbook.effective_date.isoformat() if playbook.effective_date else None,
        expiry_date=playbook.expiry_date.isoformat() if playbook.expiry_date else None,
        notes=playbook.notes,
        is_active=playbook.is_active,
        created_at=playbook.created_at.isoformat(),
        updated_at=playbook.updated_at.isoformat(),
    )


@router.get("/{customer_id}/playbooks", response_model=List[PricingPlaybookResponse])
async def list_pricing_playbooks(customer_id: str):
    """List all pricing playbooks for a customer."""
    db = get_database()

    customer = await db.customers.find_one({"_id": ObjectId(customer_id)})
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")

    cursor = db.pricing_playbooks.find({"customer_id": ObjectId(customer_id)}).sort("name", 1)
    playbooks = await cursor.to_list(1000)

    return [playbook_to_response(PricingPlaybook(**p)) for p in playbooks]


@router.post("/{customer_id}/playbooks", response_model=PricingPlaybookResponse)
async def create_pricing_playbook(customer_id: str, data: PricingPlaybookCreate):
    """Create a pricing playbook for a customer."""
    db = get_database()

    customer = await db.customers.find_one({"_id": ObjectId(customer_id)})
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")

    playbook_data = data.model_dump()
    playbook_data["customer_id"] = ObjectId(customer_id)
    playbook = PricingPlaybook(**playbook_data)
    await db.pricing_playbooks.insert_one(playbook.model_dump_mongo())

    return playbook_to_response(playbook)


@router.patch("/{customer_id}/playbooks/{playbook_id}", response_model=PricingPlaybookResponse)
async def update_pricing_playbook(customer_id: str, playbook_id: str, data: PricingPlaybookUpdate):
    """Update a pricing playbook."""
    db = get_database()

    playbook_doc = await db.pricing_playbooks.find_one({
        "_id": ObjectId(playbook_id),
        "customer_id": ObjectId(customer_id),
    })
    if not playbook_doc:
        raise HTTPException(status_code=404, detail="Playbook not found")

    playbook = PricingPlaybook(**playbook_doc)
    update_data = data.model_dump(exclude_unset=True)

    for field, value in update_data.items():
        setattr(playbook, field, value)

    playbook.mark_updated()

    await db.pricing_playbooks.update_one(
        {"_id": ObjectId(playbook_id)},
        {"$set": playbook.model_dump_mongo()},
    )

    return playbook_to_response(playbook)


@router.delete("/{customer_id}/playbooks/{playbook_id}")
async def delete_pricing_playbook(customer_id: str, playbook_id: str):
    """Delete a pricing playbook."""
    db = get_database()

    result = await db.pricing_playbooks.delete_one({
        "_id": ObjectId(playbook_id),
        "customer_id": ObjectId(customer_id),
    })
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Playbook not found")

    return {"success": True}


@router.get("/{customer_id}/playbooks/match", response_model=Optional[PricingPlaybookResponse])
async def match_pricing_playbook(
    customer_id: str,
    origin_state: Optional[str] = None,
    dest_state: Optional[str] = None,
    equipment_type: Optional[str] = None,
):
    """Find a matching pricing playbook for a lane."""
    db = get_database()

    now = datetime.now(timezone.utc)

    # Build query: match on active playbooks for this customer
    query: dict = {
        "customer_id": ObjectId(customer_id),
        "is_active": True,
    }

    if origin_state:
        query["$or"] = query.get("$or", [])
        # Match playbooks with this origin state or no origin state (wildcard)
    if dest_state:
        pass

    # Build a more nuanced query: find playbooks matching origin/dest/equipment,
    # allowing None (wildcard) in playbook fields
    candidates_query: dict = {
        "customer_id": ObjectId(customer_id),
        "is_active": True,
    }

    cursor = db.pricing_playbooks.find(candidates_query).sort("created_at", -1)
    playbooks = await cursor.to_list(1000)

    best_match = None
    best_score = -1

    for p_doc in playbooks:
        playbook = PricingPlaybook(**p_doc)

        # Check date validity
        if playbook.effective_date and playbook.effective_date > now:
            continue
        if playbook.expiry_date and playbook.expiry_date < now:
            continue

        score = 0

        # Score based on how specific the match is
        if origin_state and playbook.origin_state:
            if playbook.origin_state.upper() == origin_state.upper():
                score += 3
            else:
                continue  # Explicit mismatch
        elif playbook.origin_state is None:
            score += 0  # Wildcard, less specific

        if dest_state and playbook.dest_state:
            if playbook.dest_state.upper() == dest_state.upper():
                score += 3
            else:
                continue  # Explicit mismatch
        elif playbook.dest_state is None:
            score += 0

        if equipment_type and playbook.equipment_type:
            if playbook.equipment_type.lower() == equipment_type.lower():
                score += 2
            else:
                continue  # Explicit mismatch
        elif playbook.equipment_type is None:
            score += 0

        if score > best_score:
            best_score = score
            best_match = playbook

    if best_match:
        return playbook_to_response(best_match)

    return None
