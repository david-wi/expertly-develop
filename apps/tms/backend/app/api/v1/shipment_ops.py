"""Advanced shipment operations: bulk import, split, consolidation, templates,
equipment assignment, fuel surcharge, and route optimization.

All endpoints are prefixed with /shipments in the router registration.
"""

from typing import List, Optional
from datetime import datetime, timedelta, timezone
from enum import Enum
import csv
import io
import json
import math
import uuid
import logging

from fastapi import APIRouter, HTTPException, UploadFile, File, Form
from pydantic import BaseModel, Field
from bson import ObjectId

from app.database import get_database
from app.models.shipment import Shipment, ShipmentStatus, Stop, StopType
from app.models.base import MongoModel, PyObjectId, utc_now
from app.services.number_generator import NumberGenerator
from app.services.websocket_manager import manager

logger = logging.getLogger(__name__)
router = APIRouter()


# ============================================================================
# Models for new features
# ============================================================================

class RecurrenceFrequency(str, Enum):
    DAILY = "daily"
    WEEKLY = "weekly"
    BIWEEKLY = "biweekly"
    MONTHLY = "monthly"


class LoadTemplate(MongoModel):
    """Recurring load template."""
    name: str
    customer_id: PyObjectId
    stops: list = []
    equipment_type: str = "van"
    weight_lbs: Optional[int] = None
    commodity: Optional[str] = None
    piece_count: Optional[int] = None
    pallet_count: Optional[int] = None
    special_requirements: Optional[str] = None
    customer_price: int = 0
    carrier_cost: int = 0
    internal_notes: Optional[str] = None
    customer_notes: Optional[str] = None
    # Recurrence
    is_recurring: bool = False
    recurrence_frequency: Optional[str] = None
    recurrence_days: list[int] = []  # 0=Mon, 6=Sun
    next_scheduled: Optional[datetime] = None
    is_active: bool = True
    last_booked_at: Optional[datetime] = None
    times_booked: int = 0


class FuelSurchargeSchedule(MongoModel):
    """Customer-specific fuel surcharge schedule."""
    name: str
    customer_id: Optional[PyObjectId] = None
    is_default: bool = False
    # Bracket-based: list of {min_price, max_price, surcharge_per_mile}
    brackets: list[dict] = []
    # Percentage-based
    use_percentage: bool = False
    base_fuel_price: float = 0.0  # Base price for percentage calc
    surcharge_percentage: float = 0.0
    # DOE price tracking
    current_doe_price: Optional[float] = None
    last_doe_update: Optional[datetime] = None
    is_active: bool = True


class Equipment(MongoModel):
    """Equipment (trailer, chassis) record."""
    equipment_number: str
    equipment_type: str  # van, reefer, flatbed, etc.
    status: str = "available"  # available, in_use, maintenance, retired
    current_location: Optional[str] = None
    current_shipment_id: Optional[PyObjectId] = None
    carrier_id: Optional[PyObjectId] = None
    # Dimensions
    length_ft: Optional[int] = None
    width_ft: Optional[int] = None
    height_ft: Optional[int] = None
    max_weight_lbs: Optional[int] = None
    # Reefer
    temperature_min: Optional[float] = None
    temperature_max: Optional[float] = None
    notes: Optional[str] = None


# ============================================================================
# 1. Bulk Load Import (CSV/Excel)
# ============================================================================

class ColumnMapping(BaseModel):
    """Maps CSV columns to shipment fields."""
    source_column: str
    target_field: str
    transform: Optional[str] = None


class BulkImportPreview(BaseModel):
    """Preview of bulk import with validation."""
    total_rows: int
    valid_rows: int
    error_rows: int
    columns_detected: list[str]
    ai_column_mapping: dict[str, str]
    preview_data: list[dict]
    validation_errors: list[dict]


class BulkImportResult(BaseModel):
    """Result of bulk import."""
    total_processed: int
    successful: int
    failed: int
    shipment_ids: list[str]
    errors: list[dict]


# AI column mapping heuristics
COLUMN_MAPPING_HINTS = {
    "origin_city": ["origin city", "pickup city", "ship from city", "from city", "origin", "shipper city", "o_city"],
    "origin_state": ["origin state", "pickup state", "ship from state", "from state", "o_state", "shipper state"],
    "origin_zip": ["origin zip", "pickup zip", "ship from zip", "from zip", "o_zip"],
    "origin_address": ["origin address", "pickup address", "ship from address", "from address"],
    "destination_city": ["dest city", "delivery city", "ship to city", "to city", "destination", "consignee city", "d_city"],
    "destination_state": ["dest state", "delivery state", "ship to state", "to state", "d_state", "consignee state"],
    "destination_zip": ["dest zip", "delivery zip", "ship to zip", "to zip", "d_zip"],
    "destination_address": ["dest address", "delivery address", "ship to address", "to address"],
    "pickup_date": ["pickup date", "ship date", "pickup", "pick up date", "ready date", "pu date"],
    "delivery_date": ["delivery date", "deliver by", "delivery", "due date", "del date", "required delivery"],
    "equipment_type": ["equipment", "equipment type", "equip", "trailer type", "mode"],
    "weight_lbs": ["weight", "weight lbs", "gross weight", "lbs", "weight_lbs"],
    "commodity": ["commodity", "product", "description", "item", "goods"],
    "piece_count": ["pieces", "piece count", "qty", "quantity", "units"],
    "pallet_count": ["pallets", "pallet count", "skids", "pallet_count"],
    "customer_price": ["price", "customer price", "rate", "revenue", "charge", "customer rate"],
    "special_requirements": ["requirements", "special", "notes", "instructions", "special requirements"],
    "reference_number": ["reference", "ref", "po number", "po", "order number", "order", "ref#"],
}


def ai_detect_column_mapping(columns: list[str]) -> dict[str, str]:
    """AI-powered column mapping using fuzzy matching."""
    mapping = {}
    for col in columns:
        col_lower = col.strip().lower().replace("_", " ").replace("-", " ")
        best_match = None
        best_score = 0

        for field, hints in COLUMN_MAPPING_HINTS.items():
            for hint in hints:
                # Exact match
                if col_lower == hint:
                    best_match = field
                    best_score = 100
                    break
                # Contains match
                elif hint in col_lower or col_lower in hint:
                    score = len(hint) / max(len(col_lower), 1) * 80
                    if score > best_score:
                        best_match = field
                        best_score = score
            if best_score == 100:
                break

        if best_match and best_score > 40:
            mapping[col] = best_match

    return mapping


def validate_import_row(row: dict, mapping: dict, row_index: int) -> tuple[Optional[dict], Optional[dict]]:
    """Validate a single import row and return (mapped_data, error)."""
    mapped = {}
    errors = []

    for source_col, target_field in mapping.items():
        value = row.get(source_col, "").strip() if row.get(source_col) else ""
        if value:
            mapped[target_field] = value

    # Required fields check
    if not mapped.get("origin_city"):
        errors.append("Missing origin city")
    if not mapped.get("origin_state"):
        errors.append("Missing origin state")
    if not mapped.get("destination_city"):
        errors.append("Missing destination city")
    if not mapped.get("destination_state"):
        errors.append("Missing destination state")

    if errors:
        return None, {"row": row_index + 1, "errors": errors, "data": row}

    return mapped, None


@router.post("/bulk-import/preview")
async def preview_bulk_import(
    file: UploadFile = File(...),
    customer_id: str = Form(...),
):
    """Preview CSV import with AI column mapping and validation."""
    if not file.filename:
        raise HTTPException(status_code=400, detail="No file provided")

    ext = file.filename.lower().split(".")[-1]
    if ext not in ("csv", "tsv", "txt"):
        raise HTTPException(status_code=400, detail="Only CSV/TSV files supported. Download template for format.")

    content = await file.read()
    try:
        text = content.decode("utf-8-sig")  # Handle BOM
    except UnicodeDecodeError:
        text = content.decode("latin-1")

    # Parse CSV
    delimiter = "\t" if ext == "tsv" else ","
    reader = csv.DictReader(io.StringIO(text), delimiter=delimiter)
    columns = reader.fieldnames or []

    if not columns:
        raise HTTPException(status_code=400, detail="No columns found in file")

    # AI column mapping
    mapping = ai_detect_column_mapping(columns)

    rows = list(reader)
    valid_rows = []
    error_rows = []

    for i, row in enumerate(rows):
        mapped, error = validate_import_row(row, mapping, i)
        if mapped:
            valid_rows.append(mapped)
        if error:
            error_rows.append(error)

    # Preview first 10 rows
    preview_data = []
    for row in rows[:10]:
        preview = {}
        for col in columns:
            preview[col] = row.get(col, "")
        preview_data.append(preview)

    return BulkImportPreview(
        total_rows=len(rows),
        valid_rows=len(valid_rows),
        error_rows=len(error_rows),
        columns_detected=columns,
        ai_column_mapping=mapping,
        preview_data=preview_data,
        validation_errors=error_rows[:20],  # Cap at 20 errors
    )


class BulkImportRequest(BaseModel):
    rows: list[dict]
    customer_id: str
    column_mapping: dict[str, str]


@router.post("/bulk-import", response_model=BulkImportResult)
async def bulk_import_shipments(data: BulkImportRequest):
    """Import multiple shipments from pre-validated data."""
    db = get_database()
    shipment_ids = []
    errors = []
    customer_oid = ObjectId(data.customer_id)

    # Verify customer exists
    customer = await db.customers.find_one({"_id": customer_oid})
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")

    for i, row in enumerate(data.rows):
        try:
            # Apply column mapping
            mapped = {}
            for source_col, target_field in data.column_mapping.items():
                if source_col in row and row[source_col]:
                    mapped[target_field] = row[source_col]

            # Build stops
            stops = []
            if mapped.get("origin_city"):
                stops.append(Stop(
                    stop_number=1,
                    stop_type=StopType.PICKUP,
                    address=mapped.get("origin_address", ""),
                    city=mapped["origin_city"],
                    state=mapped.get("origin_state", ""),
                    zip_code=mapped.get("origin_zip", ""),
                ))
            if mapped.get("destination_city"):
                stops.append(Stop(
                    stop_number=2,
                    stop_type=StopType.DELIVERY,
                    address=mapped.get("destination_address", ""),
                    city=mapped["destination_city"],
                    state=mapped.get("destination_state", ""),
                    zip_code=mapped.get("destination_zip", ""),
                ))

            shipment_number = await NumberGenerator.get_next_shipment_number()

            # Parse numeric fields
            weight = None
            if mapped.get("weight_lbs"):
                try:
                    weight = int(float(str(mapped["weight_lbs"]).replace(",", "")))
                except (ValueError, TypeError):
                    pass

            price = 0
            if mapped.get("customer_price"):
                try:
                    price = int(float(str(mapped["customer_price"]).replace(",", "").replace("$", "")) * 100)
                except (ValueError, TypeError):
                    pass

            # Parse dates
            pickup_date = None
            if mapped.get("pickup_date"):
                try:
                    pickup_date = datetime.fromisoformat(mapped["pickup_date"])
                except (ValueError, TypeError):
                    try:
                        pickup_date = datetime.strptime(mapped["pickup_date"], "%m/%d/%Y")
                    except (ValueError, TypeError):
                        pass

            delivery_date = None
            if mapped.get("delivery_date"):
                try:
                    delivery_date = datetime.fromisoformat(mapped["delivery_date"])
                except (ValueError, TypeError):
                    try:
                        delivery_date = datetime.strptime(mapped["delivery_date"], "%m/%d/%Y")
                    except (ValueError, TypeError):
                        pass

            shipment = Shipment(
                shipment_number=shipment_number,
                customer_id=customer_oid,
                stops=stops,
                equipment_type=mapped.get("equipment_type", "van"),
                weight_lbs=weight,
                commodity=mapped.get("commodity"),
                piece_count=int(mapped["piece_count"]) if mapped.get("piece_count") else None,
                pallet_count=int(mapped["pallet_count"]) if mapped.get("pallet_count") else None,
                special_requirements=mapped.get("special_requirements"),
                customer_price=price,
                pickup_date=pickup_date,
                delivery_date=delivery_date,
                bol_number=mapped.get("reference_number"),
                internal_notes=f"Bulk imported row {i+1}",
            )

            await db.shipments.insert_one(shipment.model_dump_mongo())
            shipment_ids.append(str(shipment.id))

        except Exception as e:
            errors.append({"row": i + 1, "error": str(e)})
            logger.error(f"Bulk import row {i+1} failed: {e}")

    if shipment_ids:
        await manager.broadcast("bulk_import_complete", {
            "count": len(shipment_ids),
            "customer_id": data.customer_id,
        })

    return BulkImportResult(
        total_processed=len(data.rows),
        successful=len(shipment_ids),
        failed=len(errors),
        shipment_ids=shipment_ids,
        errors=errors,
    )


@router.get("/import-template")
async def get_import_template():
    """Get CSV template for bulk import."""
    return {
        "columns": [
            "Origin City", "Origin State", "Origin Zip", "Origin Address",
            "Destination City", "Destination State", "Destination Zip", "Destination Address",
            "Pickup Date", "Delivery Date", "Equipment Type", "Weight (lbs)",
            "Commodity", "Pieces", "Pallets", "Customer Price", "Special Requirements",
            "Reference Number",
        ],
        "sample_rows": [
            {
                "Origin City": "Chicago", "Origin State": "IL", "Origin Zip": "60601",
                "Origin Address": "123 Main St",
                "Destination City": "Dallas", "Destination State": "TX", "Destination Zip": "75201",
                "Destination Address": "456 Oak Ave",
                "Pickup Date": "2026-03-01", "Delivery Date": "2026-03-03",
                "Equipment Type": "van", "Weight (lbs)": "42000",
                "Commodity": "General Merchandise", "Pieces": "24", "Pallets": "12",
                "Customer Price": "3500.00", "Special Requirements": "",
                "Reference Number": "PO-12345",
            }
        ],
        "csv_content": "Origin City,Origin State,Origin Zip,Origin Address,Destination City,Destination State,Destination Zip,Destination Address,Pickup Date,Delivery Date,Equipment Type,Weight (lbs),Commodity,Pieces,Pallets,Customer Price,Special Requirements,Reference Number\nChicago,IL,60601,123 Main St,Dallas,TX,75201,456 Oak Ave,2026-03-01,2026-03-03,van,42000,General Merchandise,24,12,3500.00,,PO-12345",
    }


# ============================================================================
# 3. Split Shipments
# ============================================================================

class SplitRequest(BaseModel):
    """Request to split a shipment into child shipments."""
    split_method: str = "weight"  # weight, commodity, destination, manual
    parts: list[dict] = []  # For manual split: [{weight_lbs, commodity, ...}]
    num_parts: int = 2  # For auto split


@router.post("/{shipment_id}/split")
async def split_shipment(shipment_id: str, data: SplitRequest):
    """Split a single shipment into multiple child shipments."""
    db = get_database()

    parent = await db.shipments.find_one({"_id": ObjectId(shipment_id)})
    if not parent:
        raise HTTPException(status_code=404, detail="Shipment not found")

    parent_shipment = Shipment(**parent)

    if parent_shipment.status not in (ShipmentStatus.BOOKED,):
        raise HTTPException(status_code=400, detail="Can only split booked shipments")

    child_shipments = []

    if data.split_method == "manual" and data.parts:
        # Manual split - use provided part data
        for i, part in enumerate(data.parts):
            child_number = await NumberGenerator.get_next_shipment_number()
            child = Shipment(
                shipment_number=child_number,
                customer_id=parent_shipment.customer_id,
                carrier_id=parent_shipment.carrier_id,
                quote_id=parent_shipment.quote_id,
                stops=parent_shipment.stops,
                equipment_type=part.get("equipment_type", parent_shipment.equipment_type),
                weight_lbs=part.get("weight_lbs"),
                commodity=part.get("commodity", parent_shipment.commodity),
                piece_count=part.get("piece_count"),
                pallet_count=part.get("pallet_count"),
                special_requirements=parent_shipment.special_requirements,
                customer_price=part.get("customer_price", 0),
                carrier_cost=part.get("carrier_cost", 0),
                pickup_date=parent_shipment.pickup_date,
                delivery_date=parent_shipment.delivery_date,
                internal_notes=f"Split from {parent_shipment.shipment_number} (part {i+1}/{len(data.parts)})",
                customer_notes=parent_shipment.customer_notes,
            )
            await db.shipments.insert_one(child.model_dump_mongo())
            child_shipments.append(child)
    else:
        # Auto split by weight
        total_weight = parent_shipment.weight_lbs or 0
        total_price = parent_shipment.customer_price or 0
        total_cost = parent_shipment.carrier_cost or 0
        num_parts = max(data.num_parts, 2)

        for i in range(num_parts):
            child_number = await NumberGenerator.get_next_shipment_number()
            part_weight = total_weight // num_parts if total_weight else None
            part_price = total_price // num_parts
            part_cost = total_cost // num_parts

            child = Shipment(
                shipment_number=child_number,
                customer_id=parent_shipment.customer_id,
                carrier_id=parent_shipment.carrier_id,
                quote_id=parent_shipment.quote_id,
                stops=parent_shipment.stops,
                equipment_type=parent_shipment.equipment_type,
                weight_lbs=part_weight,
                commodity=parent_shipment.commodity,
                special_requirements=parent_shipment.special_requirements,
                customer_price=part_price,
                carrier_cost=part_cost,
                pickup_date=parent_shipment.pickup_date,
                delivery_date=parent_shipment.delivery_date,
                internal_notes=f"Split from {parent_shipment.shipment_number} (part {i+1}/{num_parts})",
                customer_notes=parent_shipment.customer_notes,
            )
            await db.shipments.insert_one(child.model_dump_mongo())
            child_shipments.append(child)

    # Store parent-child relationship
    child_ids = [child.id for child in child_shipments]
    await db.shipments.update_one(
        {"_id": ObjectId(shipment_id)},
        {"$set": {
            "status": "cancelled",
            "internal_notes": f"{parent_shipment.internal_notes or ''}\nSplit into {len(child_shipments)} child shipments",
            "split_children": [str(cid) for cid in child_ids],
            "updated_at": utc_now(),
        }}
    )

    # Store parent reference on children
    for child in child_shipments:
        await db.shipments.update_one(
            {"_id": child.id},
            {"$set": {"split_parent_id": shipment_id}}
        )

    return {
        "status": "split",
        "parent_shipment_id": shipment_id,
        "parent_shipment_number": parent_shipment.shipment_number,
        "children": [
            {
                "id": str(c.id),
                "shipment_number": c.shipment_number,
                "weight_lbs": c.weight_lbs,
                "customer_price": c.customer_price,
            }
            for c in child_shipments
        ],
    }


# ============================================================================
# 4. LTL Consolidation
# ============================================================================

class ConsolidateRequest(BaseModel):
    """Request to consolidate multiple LTL shipments."""
    shipment_ids: list[str]
    consolidated_equipment_type: str = "van"
    notes: Optional[str] = None


@router.post("/consolidate")
async def consolidate_shipments(data: ConsolidateRequest):
    """Consolidate multiple LTL shipments into one FTL load."""
    db = get_database()

    if len(data.shipment_ids) < 2:
        raise HTTPException(status_code=400, detail="Need at least 2 shipments to consolidate")

    shipments = []
    for sid in data.shipment_ids:
        doc = await db.shipments.find_one({"_id": ObjectId(sid)})
        if not doc:
            raise HTTPException(status_code=404, detail=f"Shipment {sid} not found")
        shipments.append(Shipment(**doc))

    # Verify all are booked
    for s in shipments:
        if s.status != ShipmentStatus.BOOKED:
            raise HTTPException(status_code=400, detail=f"Shipment {s.shipment_number} must be in 'booked' status")

    # Create consolidated shipment
    total_weight = sum(s.weight_lbs or 0 for s in shipments)
    total_price = sum(s.customer_price or 0 for s in shipments)
    total_pieces = sum(s.piece_count or 0 for s in shipments)
    total_pallets = sum(s.pallet_count or 0 for s in shipments)

    # Collect all unique stops
    all_stops = []
    stop_num = 1
    seen_locations = set()
    for s in shipments:
        for stop in s.stops:
            loc_key = f"{stop.city}_{stop.state}_{stop.stop_type}"
            if loc_key not in seen_locations:
                seen_locations.add(loc_key)
                all_stops.append(Stop(
                    stop_number=stop_num,
                    stop_type=stop.stop_type,
                    name=stop.name,
                    address=stop.address,
                    city=stop.city,
                    state=stop.state,
                    zip_code=stop.zip_code,
                    contact_name=stop.contact_name,
                    contact_phone=stop.contact_phone,
                    scheduled_date=stop.scheduled_date,
                    special_instructions=stop.special_instructions,
                ))
                stop_num += 1

    consolidated_number = await NumberGenerator.get_next_shipment_number()

    consolidated = Shipment(
        shipment_number=consolidated_number,
        customer_id=shipments[0].customer_id,
        stops=all_stops,
        equipment_type=data.consolidated_equipment_type,
        weight_lbs=total_weight,
        commodity="Consolidated LTL",
        piece_count=total_pieces,
        pallet_count=total_pallets,
        customer_price=total_price,
        pickup_date=min((s.pickup_date for s in shipments if s.pickup_date), default=None),
        delivery_date=max((s.delivery_date for s in shipments if s.delivery_date), default=None),
        internal_notes=f"Consolidated from: {', '.join(s.shipment_number for s in shipments)}\n{data.notes or ''}",
    )

    await db.shipments.insert_one(consolidated.model_dump_mongo())

    # Mark originals as consolidated
    for s in shipments:
        await db.shipments.update_one(
            {"_id": s.id},
            {"$set": {
                "status": "cancelled",
                "internal_notes": f"{s.internal_notes or ''}\nConsolidated into {consolidated_number}",
                "consolidated_into": str(consolidated.id),
                "updated_at": utc_now(),
            }}
        )

    return {
        "status": "consolidated",
        "consolidated_shipment_id": str(consolidated.id),
        "consolidated_shipment_number": consolidated_number,
        "original_shipments": [s.shipment_number for s in shipments],
        "total_weight_lbs": total_weight,
        "total_price": total_price,
        "stop_count": len(all_stops),
    }


@router.get("/consolidation-suggestions")
async def get_consolidation_suggestions():
    """AI suggests LTL consolidation opportunities based on compatible lanes/dates."""
    db = get_database()

    # Get booked shipments that could be consolidated
    cursor = db.shipments.find({
        "status": "booked",
        "carrier_id": None,  # Only unassigned
    }).sort("pickup_date", 1)
    shipments = await cursor.to_list(500)

    if len(shipments) < 2:
        return {"suggestions": []}

    # Group by lane (origin state -> destination state) and date proximity
    lane_groups: dict = {}
    for s in shipments:
        stops = s.get("stops", [])
        if len(stops) < 2:
            continue
        origin = stops[0]
        dest = stops[-1]
        lane_key = f"{origin.get('state', '')}_{dest.get('state', '')}"

        if lane_key not in lane_groups:
            lane_groups[lane_key] = []
        lane_groups[lane_key].append(s)

    suggestions = []
    for lane_key, group in lane_groups.items():
        if len(group) < 2:
            continue

        # Check date compatibility (within 2 days)
        compatible = []
        for i, s1 in enumerate(group):
            for s2 in group[i+1:]:
                pd1 = s1.get("pickup_date")
                pd2 = s2.get("pickup_date")
                if pd1 and pd2:
                    diff = abs((pd1 - pd2).total_seconds()) / 3600
                    if diff <= 48:  # Within 2 days
                        if s1 not in compatible:
                            compatible.append(s1)
                        if s2 not in compatible:
                            compatible.append(s2)

        if len(compatible) >= 2:
            total_weight = sum(s.get("weight_lbs", 0) or 0 for s in compatible)
            total_price = sum(s.get("customer_price", 0) or 0 for s in compatible)
            estimated_savings = int(total_price * 0.15)  # ~15% savings from consolidation

            origin_state, dest_state = lane_key.split("_")
            suggestions.append({
                "lane": f"{origin_state} -> {dest_state}",
                "shipment_count": len(compatible),
                "shipment_ids": [str(s["_id"]) for s in compatible],
                "shipment_numbers": [s.get("shipment_number", "") for s in compatible],
                "total_weight_lbs": total_weight,
                "total_revenue": total_price,
                "estimated_savings": estimated_savings,
                "compatible_dates": True,
                "utilization_percent": min(round(total_weight / 44000 * 100, 1), 100) if total_weight else 0,
            })

    # Sort by potential savings
    suggestions.sort(key=lambda x: x["estimated_savings"], reverse=True)

    return {"suggestions": suggestions[:20]}


# ============================================================================
# 5. Recurring Load Templates
# ============================================================================

class TemplateCreateRequest(BaseModel):
    name: str
    customer_id: str
    stops: list[dict] = []
    equipment_type: str = "van"
    weight_lbs: Optional[int] = None
    commodity: Optional[str] = None
    piece_count: Optional[int] = None
    pallet_count: Optional[int] = None
    special_requirements: Optional[str] = None
    customer_price: int = 0
    carrier_cost: int = 0
    internal_notes: Optional[str] = None
    customer_notes: Optional[str] = None
    is_recurring: bool = False
    recurrence_frequency: Optional[str] = None
    recurrence_days: list[int] = []


class TemplateResponse(BaseModel):
    id: str
    name: str
    customer_id: str
    equipment_type: str
    weight_lbs: Optional[int]
    commodity: Optional[str]
    customer_price: int
    is_recurring: bool
    recurrence_frequency: Optional[str]
    recurrence_days: list[int]
    next_scheduled: Optional[datetime]
    is_active: bool
    times_booked: int
    last_booked_at: Optional[datetime]
    stops: list
    created_at: datetime


@router.post("/templates", response_model=TemplateResponse)
async def create_load_template(data: TemplateCreateRequest):
    """Create a recurring load template."""
    db = get_database()

    template = LoadTemplate(
        name=data.name,
        customer_id=ObjectId(data.customer_id),
        stops=data.stops,
        equipment_type=data.equipment_type,
        weight_lbs=data.weight_lbs,
        commodity=data.commodity,
        piece_count=data.piece_count,
        pallet_count=data.pallet_count,
        special_requirements=data.special_requirements,
        customer_price=data.customer_price,
        carrier_cost=data.carrier_cost,
        internal_notes=data.internal_notes,
        customer_notes=data.customer_notes,
        is_recurring=data.is_recurring,
        recurrence_frequency=data.recurrence_frequency,
        recurrence_days=data.recurrence_days,
    )

    # Calculate next scheduled date if recurring
    if data.is_recurring and data.recurrence_frequency:
        template.next_scheduled = _calculate_next_schedule(data.recurrence_frequency, data.recurrence_days)

    await db.load_templates.insert_one(template.model_dump_mongo())

    return TemplateResponse(
        id=str(template.id),
        name=template.name,
        customer_id=str(template.customer_id),
        equipment_type=template.equipment_type,
        weight_lbs=template.weight_lbs,
        commodity=template.commodity,
        customer_price=template.customer_price,
        is_recurring=template.is_recurring,
        recurrence_frequency=template.recurrence_frequency,
        recurrence_days=template.recurrence_days,
        next_scheduled=template.next_scheduled,
        is_active=template.is_active,
        times_booked=template.times_booked,
        last_booked_at=template.last_booked_at,
        stops=template.stops,
        created_at=template.created_at,
    )


def _calculate_next_schedule(frequency: str, days: list[int]) -> Optional[datetime]:
    """Calculate the next scheduled date based on recurrence settings."""
    now = datetime.now(timezone.utc)
    if frequency == "daily":
        return now + timedelta(days=1)
    elif frequency == "weekly":
        if days:
            current_dow = now.weekday()
            for d in sorted(days):
                if d > current_dow:
                    return now + timedelta(days=d - current_dow)
            return now + timedelta(days=7 - current_dow + days[0])
        return now + timedelta(weeks=1)
    elif frequency == "biweekly":
        return now + timedelta(weeks=2)
    elif frequency == "monthly":
        next_month = now.month + 1 if now.month < 12 else 1
        next_year = now.year if now.month < 12 else now.year + 1
        day = min(now.day, 28)
        return now.replace(year=next_year, month=next_month, day=day)
    return None


@router.get("/templates", response_model=list[TemplateResponse])
async def list_load_templates(
    customer_id: Optional[str] = None,
    is_active: Optional[bool] = None,
):
    """List load templates."""
    db = get_database()
    query: dict = {}
    if customer_id:
        query["customer_id"] = ObjectId(customer_id)
    if is_active is not None:
        query["is_active"] = is_active

    cursor = db.load_templates.find(query).sort("created_at", -1)
    templates = await cursor.to_list(200)

    return [
        TemplateResponse(
            id=str(t["_id"]),
            name=t["name"],
            customer_id=str(t["customer_id"]),
            equipment_type=t.get("equipment_type", "van"),
            weight_lbs=t.get("weight_lbs"),
            commodity=t.get("commodity"),
            customer_price=t.get("customer_price", 0),
            is_recurring=t.get("is_recurring", False),
            recurrence_frequency=t.get("recurrence_frequency"),
            recurrence_days=t.get("recurrence_days", []),
            next_scheduled=t.get("next_scheduled"),
            is_active=t.get("is_active", True),
            times_booked=t.get("times_booked", 0),
            last_booked_at=t.get("last_booked_at"),
            stops=t.get("stops", []),
            created_at=t.get("created_at", utc_now()),
        )
        for t in templates
    ]


@router.post("/templates/{template_id}/book")
async def book_from_template(template_id: str):
    """Book a new shipment from a template."""
    db = get_database()

    template = await db.load_templates.find_one({"_id": ObjectId(template_id)})
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")

    shipment_number = await NumberGenerator.get_next_shipment_number()

    # Build stops from template
    stops = []
    for s in template.get("stops", []):
        stops.append(Stop(**s) if isinstance(s, dict) else s)

    shipment = Shipment(
        shipment_number=shipment_number,
        customer_id=template["customer_id"],
        stops=stops,
        equipment_type=template.get("equipment_type", "van"),
        weight_lbs=template.get("weight_lbs"),
        commodity=template.get("commodity"),
        piece_count=template.get("piece_count"),
        pallet_count=template.get("pallet_count"),
        special_requirements=template.get("special_requirements"),
        customer_price=template.get("customer_price", 0),
        carrier_cost=template.get("carrier_cost", 0),
        internal_notes=f"Booked from template: {template.get('name', '')}",
        customer_notes=template.get("customer_notes"),
    )

    await db.shipments.insert_one(shipment.model_dump_mongo())

    # Update template stats
    await db.load_templates.update_one(
        {"_id": ObjectId(template_id)},
        {
            "$set": {"last_booked_at": utc_now(), "updated_at": utc_now()},
            "$inc": {"times_booked": 1},
        }
    )

    # If recurring, schedule next
    if template.get("is_recurring") and template.get("recurrence_frequency"):
        next_date = _calculate_next_schedule(
            template["recurrence_frequency"],
            template.get("recurrence_days", []),
        )
        await db.load_templates.update_one(
            {"_id": ObjectId(template_id)},
            {"$set": {"next_scheduled": next_date}}
        )

    await manager.broadcast("shipment_created", {"id": str(shipment.id), "shipment_number": shipment_number})

    return {
        "shipment_id": str(shipment.id),
        "shipment_number": shipment_number,
        "template_name": template.get("name"),
    }


@router.delete("/templates/{template_id}")
async def delete_load_template(template_id: str):
    """Delete (deactivate) a load template."""
    db = get_database()
    result = await db.load_templates.update_one(
        {"_id": ObjectId(template_id)},
        {"$set": {"is_active": False, "updated_at": utc_now()}}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Template not found")
    return {"status": "deactivated", "id": template_id}


# ============================================================================
# 7. Equipment Assignment
# ============================================================================

class EquipmentAssignRequest(BaseModel):
    equipment_number: str
    equipment_type: str
    trailer_number: Optional[str] = None
    chassis_number: Optional[str] = None
    notes: Optional[str] = None


@router.patch("/{shipment_id}/assign-equipment")
async def assign_equipment(shipment_id: str, data: EquipmentAssignRequest):
    """Assign specific equipment (trailer, chassis) to a shipment."""
    db = get_database()

    shipment = await db.shipments.find_one({"_id": ObjectId(shipment_id)})
    if not shipment:
        raise HTTPException(status_code=404, detail="Shipment not found")

    # Check if equipment is available
    existing = await db.equipment.find_one({
        "equipment_number": data.equipment_number,
        "status": "in_use",
        "current_shipment_id": {"$ne": ObjectId(shipment_id)},
    })
    if existing:
        raise HTTPException(status_code=400, detail=f"Equipment {data.equipment_number} is already in use")

    # Update or create equipment record
    await db.equipment.update_one(
        {"equipment_number": data.equipment_number},
        {
            "$set": {
                "equipment_number": data.equipment_number,
                "equipment_type": data.equipment_type,
                "status": "in_use",
                "current_shipment_id": ObjectId(shipment_id),
                "updated_at": utc_now(),
            },
            "$setOnInsert": {
                "_id": ObjectId(),
                "created_at": utc_now(),
            }
        },
        upsert=True,
    )

    # Update shipment with equipment info
    await db.shipments.update_one(
        {"_id": ObjectId(shipment_id)},
        {"$set": {
            "assigned_equipment": {
                "equipment_number": data.equipment_number,
                "equipment_type": data.equipment_type,
                "trailer_number": data.trailer_number,
                "chassis_number": data.chassis_number,
                "notes": data.notes,
                "assigned_at": utc_now().isoformat(),
            },
            "updated_at": utc_now(),
        }}
    )

    return {
        "status": "assigned",
        "shipment_id": shipment_id,
        "equipment_number": data.equipment_number,
        "equipment_type": data.equipment_type,
    }


@router.get("/equipment-availability")
async def get_equipment_availability(
    equipment_type: Optional[str] = None,
    status: Optional[str] = None,
):
    """Get equipment availability and location."""
    db = get_database()

    query: dict = {}
    if equipment_type:
        query["equipment_type"] = equipment_type
    if status:
        query["status"] = status

    equipment = await db.equipment.find(query).sort("equipment_number", 1).to_list(500)

    result = []
    for e in equipment:
        item = {
            "id": str(e["_id"]),
            "equipment_number": e["equipment_number"],
            "equipment_type": e.get("equipment_type", "van"),
            "status": e.get("status", "available"),
            "current_location": e.get("current_location"),
            "current_shipment_id": str(e["current_shipment_id"]) if e.get("current_shipment_id") else None,
            "notes": e.get("notes"),
        }

        # Enrich with shipment info if in use
        if e.get("current_shipment_id"):
            shipment = await db.shipments.find_one({"_id": e["current_shipment_id"]})
            if shipment:
                item["current_shipment_number"] = shipment.get("shipment_number")
                item["current_shipment_status"] = shipment.get("status")

        result.append(item)

    # Summary
    total = len(result)
    available = len([e for e in result if e["status"] == "available"])
    in_use = len([e for e in result if e["status"] == "in_use"])

    return {
        "summary": {
            "total": total,
            "available": available,
            "in_use": in_use,
            "maintenance": total - available - in_use,
        },
        "equipment": result,
    }


# ============================================================================
# 8. Fuel Surcharge Auto-Calculation
# ============================================================================

# Default DOE national average diesel prices (representative brackets)
DEFAULT_FUEL_BRACKETS = [
    {"min_price": 0.00, "max_price": 3.00, "surcharge_per_mile": 0.00},
    {"min_price": 3.00, "max_price": 3.25, "surcharge_per_mile": 0.10},
    {"min_price": 3.25, "max_price": 3.50, "surcharge_per_mile": 0.15},
    {"min_price": 3.50, "max_price": 3.75, "surcharge_per_mile": 0.20},
    {"min_price": 3.75, "max_price": 4.00, "surcharge_per_mile": 0.25},
    {"min_price": 4.00, "max_price": 4.25, "surcharge_per_mile": 0.30},
    {"min_price": 4.25, "max_price": 4.50, "surcharge_per_mile": 0.35},
    {"min_price": 4.50, "max_price": 4.75, "surcharge_per_mile": 0.40},
    {"min_price": 4.75, "max_price": 5.00, "surcharge_per_mile": 0.45},
    {"min_price": 5.00, "max_price": 99.99, "surcharge_per_mile": 0.50},
]


@router.get("/fuel-surcharge/calculate")
async def calculate_fuel_surcharge(
    miles: float,
    fuel_schedule_id: Optional[str] = None,
    fuel_price: Optional[float] = None,
):
    """Calculate fuel surcharge based on miles and DOE fuel price."""
    db = get_database()

    # Get the fuel price
    current_fuel_price = fuel_price
    brackets = DEFAULT_FUEL_BRACKETS

    if fuel_schedule_id:
        schedule = await db.fuel_surcharge_schedules.find_one({"_id": ObjectId(fuel_schedule_id)})
        if schedule:
            brackets = schedule.get("brackets", DEFAULT_FUEL_BRACKETS)
            if schedule.get("current_doe_price"):
                current_fuel_price = current_fuel_price or schedule["current_doe_price"]

    # Default DOE price if not provided
    if not current_fuel_price:
        # Check for latest stored DOE price
        latest = await db.doe_fuel_prices.find_one(sort=[("date", -1)])
        if latest:
            current_fuel_price = latest.get("price", 4.00)
        else:
            current_fuel_price = 4.00  # Reasonable default

    # Find matching bracket
    surcharge_per_mile = 0.0
    for bracket in brackets:
        if bracket["min_price"] <= current_fuel_price < bracket["max_price"]:
            surcharge_per_mile = bracket["surcharge_per_mile"]
            break

    total_surcharge = round(surcharge_per_mile * miles, 2)
    total_surcharge_cents = int(total_surcharge * 100)

    return {
        "miles": miles,
        "current_fuel_price": current_fuel_price,
        "surcharge_per_mile": surcharge_per_mile,
        "total_surcharge": total_surcharge,
        "total_surcharge_cents": total_surcharge_cents,
        "schedule_id": fuel_schedule_id,
        "bracket_used": {
            "min_price": next(
                (b["min_price"] for b in brackets if b["min_price"] <= current_fuel_price < b["max_price"]),
                0,
            ),
            "max_price": next(
                (b["max_price"] for b in brackets if b["min_price"] <= current_fuel_price < b["max_price"]),
                0,
            ),
        },
    }


class FuelScheduleRequest(BaseModel):
    name: str
    customer_id: Optional[str] = None
    is_default: bool = False
    brackets: list[dict] = []
    use_percentage: bool = False
    base_fuel_price: float = 0.0
    surcharge_percentage: float = 0.0


@router.put("/fuel-surcharge/schedules")
async def upsert_fuel_schedule(data: FuelScheduleRequest):
    """Create or update a fuel surcharge schedule."""
    db = get_database()

    schedule = FuelSurchargeSchedule(
        name=data.name,
        customer_id=ObjectId(data.customer_id) if data.customer_id else None,
        is_default=data.is_default,
        brackets=data.brackets if data.brackets else DEFAULT_FUEL_BRACKETS,
        use_percentage=data.use_percentage,
        base_fuel_price=data.base_fuel_price,
        surcharge_percentage=data.surcharge_percentage,
        is_active=True,
    )

    # If setting as default, unset other defaults
    if data.is_default:
        await db.fuel_surcharge_schedules.update_many(
            {"is_default": True},
            {"$set": {"is_default": False}}
        )

    await db.fuel_surcharge_schedules.insert_one(schedule.model_dump_mongo())

    return {
        "id": str(schedule.id),
        "name": schedule.name,
        "is_default": schedule.is_default,
        "brackets": schedule.brackets,
        "status": "created",
    }


@router.get("/fuel-surcharge/schedules")
async def list_fuel_schedules(customer_id: Optional[str] = None):
    """List fuel surcharge schedules."""
    db = get_database()

    query: dict = {"is_active": True}
    if customer_id:
        query["$or"] = [
            {"customer_id": ObjectId(customer_id)},
            {"is_default": True},
        ]

    schedules = await db.fuel_surcharge_schedules.find(query).sort("name", 1).to_list(100)

    return [
        {
            "id": str(s["_id"]),
            "name": s["name"],
            "customer_id": str(s["customer_id"]) if s.get("customer_id") else None,
            "is_default": s.get("is_default", False),
            "brackets": s.get("brackets", []),
            "use_percentage": s.get("use_percentage", False),
            "base_fuel_price": s.get("base_fuel_price", 0),
            "surcharge_percentage": s.get("surcharge_percentage", 0),
            "current_doe_price": s.get("current_doe_price"),
            "last_doe_update": s.get("last_doe_update"),
        }
        for s in schedules
    ]


# ============================================================================
# 9. Route Optimization
# ============================================================================

def _haversine_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Calculate distance in miles between two GPS coordinates using Haversine formula."""
    R = 3959  # Earth radius in miles

    lat1_r = math.radians(lat1)
    lat2_r = math.radians(lat2)
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)

    a = math.sin(dlat/2)**2 + math.cos(lat1_r) * math.cos(lat2_r) * math.sin(dlon/2)**2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1-a))

    return R * c


def _estimate_transit_hours(distance_miles: float) -> float:
    """Estimate transit time based on distance (avg 50 mph with HOS breaks)."""
    driving_speed = 50  # mph average
    hours_per_day = 11  # HOS driving limit

    raw_hours = distance_miles / driving_speed

    if raw_hours <= hours_per_day:
        return raw_hours

    # Multi-day: add 10-hour rest periods
    driving_days = math.ceil(raw_hours / hours_per_day)
    rest_hours = (driving_days - 1) * 10
    return raw_hours + rest_hours


class StopCoordinate(BaseModel):
    latitude: float
    longitude: float
    city: Optional[str] = None
    state: Optional[str] = None
    stop_type: Optional[str] = None


class RouteOptimizeRequest(BaseModel):
    stops: list[StopCoordinate]
    optimize_for: str = "distance"  # distance, time
    fixed_first: bool = True  # Keep first stop fixed (origin)
    fixed_last: bool = True   # Keep last stop fixed (destination)


@router.post("/optimize-route")
async def optimize_route(data: RouteOptimizeRequest):
    """Calculate optimal route for multi-stop loads."""
    if len(data.stops) < 2:
        raise HTTPException(status_code=400, detail="Need at least 2 stops")

    stops = data.stops

    if len(stops) <= 3:
        # For 2-3 stops, compute direct route
        optimized_order = list(range(len(stops)))
    else:
        # Simple nearest-neighbor heuristic for route optimization
        # Keep first and last fixed if specified
        fixed_start = 0 if data.fixed_first else None
        fixed_end = len(stops) - 1 if data.fixed_last else None

        # Get intermediate stops to optimize
        intermediate_indices = [
            i for i in range(len(stops))
            if i != fixed_start and i != fixed_end
        ]

        # Nearest neighbor algorithm
        if fixed_start is not None:
            current = fixed_start
            optimized_order = [current]
        else:
            current = 0
            optimized_order = [current]

        remaining = set(intermediate_indices)
        while remaining:
            nearest = min(
                remaining,
                key=lambda idx: _haversine_distance(
                    stops[current].latitude, stops[current].longitude,
                    stops[idx].latitude, stops[idx].longitude,
                ),
            )
            optimized_order.append(nearest)
            remaining.remove(nearest)
            current = nearest

        if fixed_end is not None and fixed_end not in optimized_order:
            optimized_order.append(fixed_end)

    # Calculate distances for both original and optimized routes
    def calc_route_distance(order: list[int]) -> float:
        total = 0.0
        for i in range(len(order) - 1):
            s1 = stops[order[i]]
            s2 = stops[order[i+1]]
            total += _haversine_distance(s1.latitude, s1.longitude, s2.latitude, s2.longitude)
        return total

    original_order = list(range(len(stops)))
    original_distance = calc_route_distance(original_order)
    optimized_distance = calc_route_distance(optimized_order)

    transit_hours = _estimate_transit_hours(optimized_distance)
    deadhead_saved = max(0, original_distance - optimized_distance)

    # Build route legs
    legs = []
    for i in range(len(optimized_order) - 1):
        s1 = stops[optimized_order[i]]
        s2 = stops[optimized_order[i+1]]
        leg_distance = _haversine_distance(s1.latitude, s1.longitude, s2.latitude, s2.longitude)
        legs.append({
            "from_index": optimized_order[i],
            "to_index": optimized_order[i+1],
            "from_location": f"{s1.city or ''}, {s1.state or ''}".strip(", "),
            "to_location": f"{s2.city or ''}, {s2.state or ''}".strip(", "),
            "distance_miles": round(leg_distance, 1),
            "estimated_hours": round(_estimate_transit_hours(leg_distance), 1),
        })

    return {
        "optimized_stop_order": optimized_order,
        "optimized_stops": [
            {
                "index": idx,
                "latitude": stops[idx].latitude,
                "longitude": stops[idx].longitude,
                "city": stops[idx].city,
                "state": stops[idx].state,
                "stop_type": stops[idx].stop_type,
            }
            for idx in optimized_order
        ],
        "total_distance_miles": round(optimized_distance, 1),
        "original_distance_miles": round(original_distance, 1),
        "distance_saved_miles": round(deadhead_saved, 1),
        "estimated_transit_hours": round(transit_hours, 1),
        "estimated_transit_days": math.ceil(transit_hours / 24) if transit_hours > 11 else 1,
        "legs": legs,
        "optimization_applied": optimized_distance < original_distance,
    }
