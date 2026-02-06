import re
import logging
from datetime import datetime, timezone
from typing import Optional

from bson import ObjectId
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.models.desk import Desk, RoutingRule, CoverageSchedule
from app.models.work_item import WorkItem, WorkItemStatus

logger = logging.getLogger(__name__)


def evaluate_rule(rule: RoutingRule, work_item: WorkItem, shipment: Optional[dict] = None) -> bool:
    """Check if a single routing rule matches a work item (and optionally its shipment)."""

    # Determine which object to get the field value from
    field_value = None

    # Check work item fields first
    if hasattr(work_item, rule.field):
        raw = getattr(work_item, rule.field)
        field_value = str(raw) if raw is not None else None
    elif rule.field == "work_type":
        field_value = work_item.work_type.value if work_item.work_type else None

    # Fall back to shipment fields if provided
    if field_value is None and shipment:
        field_value = shipment.get(rule.field)
        if field_value is not None:
            field_value = str(field_value)

    if field_value is None:
        return False

    if rule.operator == "equals":
        return field_value.lower() == str(rule.value).lower()

    elif rule.operator == "in":
        if isinstance(rule.value, list):
            return field_value.lower() in [str(v).lower() for v in rule.value]
        return False

    elif rule.operator == "contains":
        return str(rule.value).lower() in field_value.lower()

    elif rule.operator == "regex":
        try:
            return bool(re.search(str(rule.value), field_value, re.IGNORECASE))
        except re.error:
            logger.warning(f"Invalid regex pattern in routing rule: {rule.value}")
            return False

    return False


def is_desk_covered(desk: Desk, now: Optional[datetime] = None) -> bool:
    """Check if a desk has coverage right now based on its schedule."""
    if not desk.coverage:
        # No coverage schedule means always covered
        return True

    if now is None:
        now = datetime.now(timezone.utc)

    for schedule in desk.coverage:
        try:
            import zoneinfo
            tz = zoneinfo.ZoneInfo(schedule.timezone)
        except Exception:
            # Fall back to UTC if timezone is invalid
            tz = timezone.utc

        local_now = now.astimezone(tz)
        # Python weekday: 0=Monday, 6=Sunday (matches our schema)
        if local_now.weekday() != schedule.day_of_week:
            continue

        current_time = local_now.strftime("%H:%M")
        if schedule.start_time <= current_time <= schedule.end_time:
            return True

    return False


async def route_work_item(
    work_item: WorkItem,
    db: AsyncIOMotorDatabase,
) -> Optional[str]:
    """
    Evaluate all active desks' routing rules against a work item.
    Returns the desk_id of the best matching desk, or None if no match.
    """
    # Get all active desks, sorted by priority descending
    cursor = db.desks.find({"is_active": True}).sort("priority", -1)
    desks_docs = await cursor.to_list(500)

    if not desks_docs:
        return None

    # Try to load the related shipment for rule evaluation
    shipment = None
    if work_item.shipment_id:
        shipment = await db.shipments.find_one({"_id": work_item.shipment_id})

    for desk_doc in desks_docs:
        desk = Desk(**desk_doc)

        if not desk.routing_rules:
            continue

        # All rules must match for a desk to be selected
        all_match = all(
            evaluate_rule(rule, work_item, shipment)
            for rule in desk.routing_rules
        )

        if all_match:
            return str(desk.id)

    return None


async def get_desk_for_work_item(
    work_item_id: str,
    db: AsyncIOMotorDatabase,
) -> Optional[str]:
    """Find which desk a work item belongs to by checking desk_id on the work item."""
    wi_doc = await db.work_items.find_one({"_id": ObjectId(work_item_id)})
    if not wi_doc:
        return None
    return wi_doc.get("desk_id")


async def auto_route_unassigned(db: AsyncIOMotorDatabase) -> int:
    """Route all unassigned work items (no desk_id) to their best matching desk.
    Returns the number of work items routed.
    """
    # Find open/in-progress work items with no desk assignment
    query = {
        "status": {"$in": [WorkItemStatus.OPEN, WorkItemStatus.IN_PROGRESS]},
        "$or": [
            {"desk_id": None},
            {"desk_id": {"$exists": False}},
        ],
    }

    cursor = db.work_items.find(query)
    work_items_docs = await cursor.to_list(1000)

    routed_count = 0

    for wi_doc in work_items_docs:
        work_item = WorkItem(**wi_doc)
        desk_id = await route_work_item(work_item, db)

        if desk_id:
            await db.work_items.update_one(
                {"_id": wi_doc["_id"]},
                {"$set": {"desk_id": desk_id}},
            )
            routed_count += 1

    logger.info(f"Auto-routed {routed_count} work items to desks")
    return routed_count
