"""Rate Table API endpoints for managing contracted rates and rate lookups."""

from typing import List, Optional
from datetime import datetime
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from bson import ObjectId

from app.database import get_database
from app.models.rate_table import RateTable, LaneRate
from app.models.base import utc_now

router = APIRouter()


# ============================================================================
# Request/Response Models
# ============================================================================


class LaneRateInput(BaseModel):
    """Input model for a lane rate."""
    origin_state: str
    dest_state: str
    equipment_type: str = "van"
    min_weight: Optional[int] = None
    max_weight: Optional[int] = None
    rate_per_mile: Optional[int] = None  # cents
    flat_rate: Optional[int] = None  # cents
    fuel_surcharge_pct: float = 0.0
    min_charge: Optional[int] = None  # cents
    notes: Optional[str] = None


class CustomerPricingRuleInput(BaseModel):
    """Input model for a customer-specific pricing rule."""
    rule_name: str
    discount_percent: float = 0.0
    volume_discount_tiers: list[dict] = []
    contract_rate_per_mile: Optional[int] = None  # cents
    contract_flat_rate: Optional[int] = None  # cents
    fuel_surcharge_override: Optional[float] = None
    min_margin_percent: float = 0.0
    auto_apply: bool = True
    notes: Optional[str] = None


class RateTableCreate(BaseModel):
    """Create a new rate table."""
    customer_id: str
    name: str
    description: Optional[str] = None
    effective_date: datetime
    expiry_date: Optional[datetime] = None
    is_active: bool = True
    lanes: list[LaneRateInput] = []
    customer_pricing_rules: list[CustomerPricingRuleInput] = []
    currency: str = "USD"
    created_by: Optional[str] = None


class RateTableUpdate(BaseModel):
    """Update a rate table."""
    name: Optional[str] = None
    description: Optional[str] = None
    effective_date: Optional[datetime] = None
    expiry_date: Optional[datetime] = None
    is_active: Optional[bool] = None
    lanes: Optional[list[LaneRateInput]] = None
    customer_pricing_rules: Optional[list[CustomerPricingRuleInput]] = None
    currency: Optional[str] = None


class RateTableResponse(BaseModel):
    """Response model for a rate table."""
    id: str
    customer_id: str
    name: str
    description: Optional[str] = None
    effective_date: datetime
    expiry_date: Optional[datetime] = None
    is_active: bool
    lanes: list[LaneRateInput]
    lane_count: int
    customer_pricing_rules: list[CustomerPricingRuleInput] = []
    currency: str
    created_by: Optional[str] = None
    is_expired: bool
    created_at: datetime
    updated_at: datetime
    # Enriched fields
    customer_name: Optional[str] = None


class RateLookupRequest(BaseModel):
    """Request to look up a rate."""
    origin_state: str
    dest_state: str
    equipment_type: str = "van"
    weight_lbs: Optional[int] = None
    customer_id: Optional[str] = None


class RateLookupResult(BaseModel):
    """A single rate match from a lookup."""
    rate_table_id: str
    rate_table_name: str
    customer_id: str
    customer_name: Optional[str] = None
    origin_state: str
    dest_state: str
    equipment_type: str
    rate_per_mile: Optional[int] = None
    flat_rate: Optional[int] = None
    fuel_surcharge_pct: float = 0.0
    min_charge: Optional[int] = None
    effective_date: datetime
    expiry_date: Optional[datetime] = None
    notes: Optional[str] = None


class BulkImportRow(BaseModel):
    """A single row for bulk CSV import."""
    origin_state: str
    dest_state: str
    equipment_type: str = "van"
    min_weight: Optional[int] = None
    max_weight: Optional[int] = None
    rate_per_mile: Optional[int] = None
    flat_rate: Optional[int] = None
    fuel_surcharge_pct: float = 0.0
    min_charge: Optional[int] = None
    notes: Optional[str] = None


class BulkImportRequest(BaseModel):
    """Request to bulk import lanes into a rate table."""
    lanes: list[BulkImportRow]


class ExpiringContractResponse(BaseModel):
    """A rate table nearing expiration."""
    id: str
    name: str
    customer_id: str
    customer_name: Optional[str] = None
    effective_date: datetime
    expiry_date: datetime
    days_until_expiry: int
    lane_count: int
    is_active: bool


# ============================================================================
# Helpers
# ============================================================================


async def rate_table_to_response(doc: dict) -> RateTableResponse:
    """Convert a MongoDB document to a RateTableResponse with enrichment."""
    db = get_database()

    customer_name = None
    if doc.get("customer_id"):
        customer = await db.customers.find_one({"_id": doc["customer_id"]})
        if customer:
            customer_name = customer.get("name")

    lanes = doc.get("lanes", [])
    now = utc_now()
    expiry_date = doc.get("expiry_date")
    is_expired = bool(expiry_date and now > expiry_date)

    pricing_rules = doc.get("customer_pricing_rules", [])

    return RateTableResponse(
        id=str(doc["_id"]),
        customer_id=str(doc["customer_id"]),
        name=doc["name"],
        description=doc.get("description"),
        effective_date=doc["effective_date"],
        expiry_date=expiry_date,
        is_active=doc.get("is_active", True),
        lanes=[LaneRateInput(**lane) for lane in lanes],
        lane_count=len(lanes),
        customer_pricing_rules=[CustomerPricingRuleInput(**rule) for rule in pricing_rules],
        currency=doc.get("currency", "USD"),
        created_by=doc.get("created_by"),
        is_expired=is_expired,
        created_at=doc.get("created_at", datetime.utcnow()),
        updated_at=doc.get("updated_at", datetime.utcnow()),
        customer_name=customer_name,
    )


# ============================================================================
# Rate Table CRUD
# ============================================================================


@router.get("", response_model=List[RateTableResponse])
async def list_rate_tables(
    customer_id: Optional[str] = None,
    is_active: Optional[bool] = None,
    include_expired: bool = False,
):
    """List rate tables with filters."""
    db = get_database()

    query: dict = {}
    if customer_id:
        query["customer_id"] = ObjectId(customer_id)
    if is_active is not None:
        query["is_active"] = is_active
    if not include_expired:
        # Exclude expired unless requested
        query["$or"] = [
            {"expiry_date": None},
            {"expiry_date": {"$gte": utc_now()}},
        ]

    cursor = db.rate_tables.find(query).sort("created_at", -1)
    tables = await cursor.to_list(1000)

    return [await rate_table_to_response(t) for t in tables]


@router.post("", response_model=RateTableResponse)
async def create_rate_table(data: RateTableCreate):
    """Create a new rate table."""
    db = get_database()

    # Validate customer exists
    customer = await db.customers.find_one({"_id": ObjectId(data.customer_id)})
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")

    lane_dicts = [lane.model_dump() for lane in data.lanes]
    from app.models.rate_table import CustomerPricingRule
    pricing_rule_dicts = [rule.model_dump() for rule in data.customer_pricing_rules]

    rate_table = RateTable(
        customer_id=ObjectId(data.customer_id),
        name=data.name,
        description=data.description,
        effective_date=data.effective_date,
        expiry_date=data.expiry_date,
        is_active=data.is_active,
        lanes=[LaneRate(**ld) for ld in lane_dicts],
        customer_pricing_rules=[CustomerPricingRule(**r) for r in pricing_rule_dicts],
        currency=data.currency,
        created_by=data.created_by,
    )

    await db.rate_tables.insert_one(rate_table.model_dump_mongo())
    doc = await db.rate_tables.find_one({"_id": rate_table.id})
    return await rate_table_to_response(doc)


@router.get("/{table_id}", response_model=RateTableResponse)
async def get_rate_table(table_id: str):
    """Get a specific rate table."""
    db = get_database()
    doc = await db.rate_tables.find_one({"_id": ObjectId(table_id)})
    if not doc:
        raise HTTPException(status_code=404, detail="Rate table not found")
    return await rate_table_to_response(doc)


@router.patch("/{table_id}", response_model=RateTableResponse)
async def update_rate_table(table_id: str, data: RateTableUpdate):
    """Update a rate table."""
    db = get_database()

    doc = await db.rate_tables.find_one({"_id": ObjectId(table_id)})
    if not doc:
        raise HTTPException(status_code=404, detail="Rate table not found")

    update_data = data.model_dump(exclude_unset=True)
    if not update_data:
        raise HTTPException(status_code=400, detail="No fields to update")

    # Convert lanes from Pydantic models to dicts
    if "lanes" in update_data and update_data["lanes"] is not None:
        update_data["lanes"] = [
            lane.model_dump() if hasattr(lane, "model_dump") else lane
            for lane in update_data["lanes"]
        ]

    # Convert customer pricing rules from Pydantic models to dicts
    if "customer_pricing_rules" in update_data and update_data["customer_pricing_rules"] is not None:
        update_data["customer_pricing_rules"] = [
            rule.model_dump() if hasattr(rule, "model_dump") else rule
            for rule in update_data["customer_pricing_rules"]
        ]

    update_data["updated_at"] = utc_now()

    await db.rate_tables.update_one(
        {"_id": ObjectId(table_id)},
        {"$set": update_data},
    )

    updated = await db.rate_tables.find_one({"_id": ObjectId(table_id)})
    return await rate_table_to_response(updated)


@router.delete("/{table_id}")
async def delete_rate_table(table_id: str):
    """Delete a rate table."""
    db = get_database()
    result = await db.rate_tables.delete_one({"_id": ObjectId(table_id)})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Rate table not found")
    return {"status": "deleted", "id": table_id}


# ============================================================================
# Rate Lookup
# ============================================================================


@router.post("/lookup", response_model=List[RateLookupResult])
async def lookup_rate(data: RateLookupRequest):
    """Look up rates matching the given criteria.

    Searches active, non-expired rate tables for matching lanes.
    If customer_id is provided, only searches that customer's tables.
    """
    db = get_database()
    now = utc_now()

    query: dict = {
        "is_active": True,
        "$or": [
            {"expiry_date": None},
            {"expiry_date": {"$gte": now}},
        ],
        "effective_date": {"$lte": now},
    }
    if data.customer_id:
        query["customer_id"] = ObjectId(data.customer_id)

    cursor = db.rate_tables.find(query)
    tables = await cursor.to_list(1000)

    results: list[RateLookupResult] = []

    for table in tables:
        # Look up customer name
        customer_name = None
        customer = await db.customers.find_one({"_id": table["customer_id"]})
        if customer:
            customer_name = customer.get("name")

        for lane in table.get("lanes", []):
            # Match origin/dest states
            if lane["origin_state"].upper() != data.origin_state.upper():
                continue
            if lane["dest_state"].upper() != data.dest_state.upper():
                continue
            # Match equipment type
            if lane.get("equipment_type", "van").lower() != data.equipment_type.lower():
                continue
            # Match weight range if specified
            if data.weight_lbs is not None:
                min_w = lane.get("min_weight")
                max_w = lane.get("max_weight")
                if min_w is not None and data.weight_lbs < min_w:
                    continue
                if max_w is not None and data.weight_lbs > max_w:
                    continue

            results.append(RateLookupResult(
                rate_table_id=str(table["_id"]),
                rate_table_name=table["name"],
                customer_id=str(table["customer_id"]),
                customer_name=customer_name,
                origin_state=lane["origin_state"],
                dest_state=lane["dest_state"],
                equipment_type=lane.get("equipment_type", "van"),
                rate_per_mile=lane.get("rate_per_mile"),
                flat_rate=lane.get("flat_rate"),
                fuel_surcharge_pct=lane.get("fuel_surcharge_pct", 0.0),
                min_charge=lane.get("min_charge"),
                effective_date=table["effective_date"],
                expiry_date=table.get("expiry_date"),
                notes=lane.get("notes"),
            ))

    return results


# ============================================================================
# Bulk Import
# ============================================================================


@router.post("/{table_id}/import-lanes", response_model=RateTableResponse)
async def bulk_import_lanes(table_id: str, data: BulkImportRequest):
    """Bulk import lane rates into a rate table (appends to existing lanes)."""
    db = get_database()

    doc = await db.rate_tables.find_one({"_id": ObjectId(table_id)})
    if not doc:
        raise HTTPException(status_code=404, detail="Rate table not found")

    new_lanes = [lane.model_dump() for lane in data.lanes]
    existing_lanes = doc.get("lanes", [])
    combined = existing_lanes + new_lanes

    await db.rate_tables.update_one(
        {"_id": ObjectId(table_id)},
        {"$set": {"lanes": combined, "updated_at": utc_now()}},
    )

    updated = await db.rate_tables.find_one({"_id": ObjectId(table_id)})
    return await rate_table_to_response(updated)


# ============================================================================
# Expiring Contracts
# ============================================================================


@router.get("/expiring/soon", response_model=List[ExpiringContractResponse])
async def get_expiring_contracts(days: int = 30):
    """Get rate tables expiring within the given number of days."""
    db = get_database()
    now = utc_now()

    from datetime import timedelta
    cutoff = now + timedelta(days=days)

    cursor = db.rate_tables.find({
        "is_active": True,
        "expiry_date": {"$ne": None, "$lte": cutoff, "$gte": now},
    }).sort("expiry_date", 1)

    tables = await cursor.to_list(100)
    results: list[ExpiringContractResponse] = []

    for table in tables:
        customer_name = None
        customer = await db.customers.find_one({"_id": table["customer_id"]})
        if customer:
            customer_name = customer.get("name")

        expiry = table["expiry_date"]
        days_until = (expiry - now).days

        results.append(ExpiringContractResponse(
            id=str(table["_id"]),
            name=table["name"],
            customer_id=str(table["customer_id"]),
            customer_name=customer_name,
            effective_date=table["effective_date"],
            expiry_date=expiry,
            days_until_expiry=max(0, days_until),
            lane_count=len(table.get("lanes", [])),
            is_active=table.get("is_active", True),
        ))

    return results
