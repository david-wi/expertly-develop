"""Auto-assignment service for intelligent carrier matching."""
from typing import List, Optional
from bson import ObjectId

from app.database import get_database
from app.models.base import utc_now
from app.services.waterfall_service import WaterfallService, WaterfallConfig


class AssignmentRule:
    """A rule for automatic carrier assignment."""

    def __init__(
        self,
        name: str,
        rule_type: str,  # "lane", "customer", "equipment", "rate", "custom"
        priority: int = 0,
        conditions: dict = None,
        actions: dict = None,
        is_active: bool = True,
    ):
        self.name = name
        self.rule_type = rule_type
        self.priority = priority
        self.conditions = conditions or {}
        self.actions = actions or {}
        self.is_active = is_active


class AutoAssignmentService:
    """Service for automatic load assignment to carriers."""

    @staticmethod
    async def get_assignment_rules() -> List[dict]:
        """Get all active assignment rules."""
        db = get_database()
        rules = await db.assignment_rules.find({"is_active": True}).sort("priority", -1).to_list(100)
        return rules

    @staticmethod
    async def create_rule(rule: AssignmentRule) -> str:
        """Create a new assignment rule."""
        db = get_database()

        rule_doc = {
            "name": rule.name,
            "rule_type": rule.rule_type,
            "priority": rule.priority,
            "conditions": rule.conditions,
            "actions": rule.actions,
            "is_active": rule.is_active,
            "created_at": utc_now(),
            "updated_at": utc_now(),
        }

        result = await db.assignment_rules.insert_one(rule_doc)
        return str(result.inserted_id)

    @staticmethod
    async def evaluate_rules_for_shipment(shipment_id: str) -> List[dict]:
        """
        Evaluate all rules against a shipment and return matching carriers.
        Returns sorted list of carrier suggestions with matched rules.
        """
        db = get_database()

        shipment = await db.shipments.find_one({"_id": ObjectId(shipment_id)})
        if not shipment:
            raise ValueError(f"Shipment {shipment_id} not found")

        # Get shipment details
        stops = shipment.get("stops", [])
        origin = next((s for s in stops if s.get("stop_type") == "pickup"), {})
        dest = next((s for s in stops if s.get("stop_type") == "delivery"), {})

        origin_state = origin.get("state", "")
        dest_state = dest.get("state", "")
        equipment_type = shipment.get("equipment_type", "van")
        customer_id = shipment.get("customer_id")

        # Get active rules
        rules = await db.assignment_rules.find({"is_active": True}).sort("priority", -1).to_list(100)

        matched_carriers = {}  # carrier_id -> {score, rules, carrier}

        for rule in rules:
            conditions = rule.get("conditions", {})
            actions = rule.get("actions", {})

            # Check if rule matches
            matches = True

            # Lane condition
            if "origin_state" in conditions:
                if conditions["origin_state"] != origin_state:
                    matches = False
            if "destination_state" in conditions:
                if conditions["destination_state"] != dest_state:
                    matches = False

            # Equipment condition
            if "equipment_type" in conditions:
                if conditions["equipment_type"] != equipment_type:
                    matches = False

            # Customer condition
            if "customer_id" in conditions:
                if str(customer_id) != conditions["customer_id"]:
                    matches = False

            if not matches:
                continue

            # Get carriers from action
            carrier_ids = actions.get("carrier_ids", [])
            score_boost = actions.get("score_boost", 0)

            for cid in carrier_ids:
                if cid not in matched_carriers:
                    carrier = await db.carriers.find_one({"_id": ObjectId(cid)})
                    if carrier and carrier.get("status") == "active":
                        matched_carriers[cid] = {
                            "carrier_id": cid,
                            "carrier_name": carrier.get("name"),
                            "score": 0,
                            "rules": [],
                            "carrier": carrier,
                        }

                if cid in matched_carriers:
                    matched_carriers[cid]["score"] += (rule.get("priority", 0) + score_boost)
                    matched_carriers[cid]["rules"].append(rule.get("name"))

        return sorted(matched_carriers.values(), key=lambda x: x["score"], reverse=True)

    @staticmethod
    async def auto_assign_shipment(
        shipment_id: str,
        use_waterfall: bool = True,
        timeout_minutes: int = 30,
        max_carriers: int = 5,
    ) -> dict:
        """
        Automatically assign a shipment to carriers.
        Uses rules first, then AI carrier matching if needed.
        Returns assignment result or waterfall ID.
        """
        db = get_database()

        shipment = await db.shipments.find_one({"_id": ObjectId(shipment_id)})
        if not shipment:
            raise ValueError(f"Shipment {shipment_id} not found")

        if shipment.get("carrier_id"):
            return {
                "status": "already_assigned",
                "carrier_id": str(shipment["carrier_id"])
            }

        # Get carriers from rules
        rule_matches = await AutoAssignmentService.evaluate_rules_for_shipment(shipment_id)

        if not rule_matches:
            # Fall back to AI carrier matching
            from app.services.carrier_matching import CarrierMatchingService

            stops = shipment.get("stops", [])
            origin = next((s for s in stops if s.get("stop_type") == "pickup"), {})
            dest = next((s for s in stops if s.get("stop_type") == "delivery"), {})

            ai_suggestions = await CarrierMatchingService.find_matching_carriers(
                origin_city=origin.get("city", ""),
                origin_state=origin.get("state", ""),
                destination_city=dest.get("city", ""),
                destination_state=dest.get("state", ""),
                equipment_type=shipment.get("equipment_type", "van"),
                pickup_date=shipment.get("pickup_date"),
            )

            carrier_ids = [s["carrier_id"] for s in ai_suggestions[:max_carriers]]
            assignment_method = "ai_matching"
        else:
            carrier_ids = [m["carrier_id"] for m in rule_matches[:max_carriers]]
            assignment_method = "rules"

        if not carrier_ids:
            return {"status": "no_carriers_found"}

        # Determine rate
        customer_price = shipment.get("customer_price", 0)
        default_margin = 0.15  # 15% margin
        offered_rate = int(customer_price * (1 - default_margin))

        if use_waterfall and len(carrier_ids) > 1:
            # Create waterfall
            config = WaterfallConfig(
                carrier_ids=carrier_ids,
                shipment_id=shipment_id,
                offered_rate=offered_rate,
                timeout_minutes=timeout_minutes,
                auto_escalate=True,
            )
            result = await WaterfallService.create_waterfall(config)
            return {
                "status": "waterfall_started",
                "waterfall_id": result["waterfall_id"],
                "carrier_count": len(carrier_ids),
                "assignment_method": assignment_method,
            }
        else:
            # Direct assignment to top carrier
            carrier_id = carrier_ids[0]

            # Create tender
            tender = {
                "shipment_id": ObjectId(shipment_id),
                "carrier_id": ObjectId(carrier_id),
                "status": "sent",
                "offered_rate": offered_rate,
                "sent_at": utc_now(),
                "created_at": utc_now(),
                "updated_at": utc_now(),
            }
            result = await db.tenders.insert_one(tender)

            return {
                "status": "tender_sent",
                "tender_id": str(result.inserted_id),
                "carrier_id": carrier_id,
                "assignment_method": assignment_method,
            }

    @staticmethod
    async def process_new_shipments():
        """
        Process shipments without carriers and auto-assign.
        Called periodically (e.g., every 5 minutes).
        """
        db = get_database()

        # Find shipments without carriers that need assignment
        shipments = await db.shipments.find({
            "carrier_id": None,
            "status": {"$in": ["booked", "pending_pickup"]},
            "auto_assignment_attempted": {"$ne": True}
        }).limit(10).to_list(10)

        results = []
        for shipment in shipments:
            try:
                result = await AutoAssignmentService.auto_assign_shipment(str(shipment["_id"]))
                results.append({
                    "shipment_id": str(shipment["_id"]),
                    "result": result
                })

                # Mark as attempted
                await db.shipments.update_one(
                    {"_id": shipment["_id"]},
                    {"$set": {"auto_assignment_attempted": True, "updated_at": utc_now()}}
                )
            except Exception as e:
                results.append({
                    "shipment_id": str(shipment["_id"]),
                    "error": str(e)
                })

        return {"processed": len(results), "results": results}
