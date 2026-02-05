"""Smart exception detection service with pattern recognition."""
from typing import List, Optional
from datetime import datetime, timedelta
from bson import ObjectId

from app.database import get_database
from app.models.base import utc_now
from app.models.work_item import WorkItemType, WorkItemStatus


class ExceptionType:
    """Types of exceptions that can be detected."""
    NO_CARRIER = "no_carrier"
    OVERDUE_CHECK_CALL = "overdue_check_call"
    LATE_PICKUP = "late_pickup"
    LATE_DELIVERY = "late_delivery"
    ETA_PAST_DELIVERY = "eta_past_delivery"
    CARRIER_COMPLIANCE = "carrier_compliance"
    LOW_MARGIN = "low_margin"
    DOCUMENT_MISSING = "document_missing"
    INVOICE_OVERDUE = "invoice_overdue"
    TENDER_NO_RESPONSE = "tender_no_response"


class ExceptionSeverity:
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"


class ExceptionDetectionService:
    """Service for proactive exception detection."""

    @staticmethod
    async def detect_all_exceptions() -> List[dict]:
        """Run all exception detection rules and return findings."""
        db = get_database()
        all_exceptions = []

        # 1. No carrier assigned close to pickup
        exceptions = await ExceptionDetectionService._detect_no_carrier()
        all_exceptions.extend(exceptions)

        # 2. Overdue check calls
        exceptions = await ExceptionDetectionService._detect_overdue_check_calls()
        all_exceptions.extend(exceptions)

        # 3. Late pickups
        exceptions = await ExceptionDetectionService._detect_late_pickups()
        all_exceptions.extend(exceptions)

        # 4. Late deliveries
        exceptions = await ExceptionDetectionService._detect_late_deliveries()
        all_exceptions.extend(exceptions)

        # 5. Carrier compliance issues
        exceptions = await ExceptionDetectionService._detect_carrier_compliance()
        all_exceptions.extend(exceptions)

        # 6. Low margin shipments
        exceptions = await ExceptionDetectionService._detect_low_margin()
        all_exceptions.extend(exceptions)

        # 7. Missing documents
        exceptions = await ExceptionDetectionService._detect_missing_documents()
        all_exceptions.extend(exceptions)

        # 8. Overdue invoices
        exceptions = await ExceptionDetectionService._detect_overdue_invoices()
        all_exceptions.extend(exceptions)

        # 9. Unanswered tenders
        exceptions = await ExceptionDetectionService._detect_tender_no_response()
        all_exceptions.extend(exceptions)

        return all_exceptions

    @staticmethod
    async def _detect_no_carrier() -> List[dict]:
        """Detect shipments without carriers close to pickup."""
        db = get_database()
        now = utc_now()
        threshold_24h = now + timedelta(hours=24)
        threshold_12h = now + timedelta(hours=12)

        shipments = await db.shipments.find({
            "carrier_id": None,
            "status": {"$in": ["booked", "pending_pickup"]},
            "pickup_date": {"$lt": threshold_24h, "$gt": now}
        }).to_list(100)

        exceptions = []
        for s in shipments:
            pickup = s.get("pickup_date")
            hours_until = (pickup - now).total_seconds() / 3600 if pickup else 0

            exceptions.append({
                "type": ExceptionType.NO_CARRIER,
                "severity": ExceptionSeverity.HIGH if hours_until < 12 else ExceptionSeverity.MEDIUM,
                "shipment_id": str(s["_id"]),
                "shipment_number": s.get("shipment_number"),
                "message": f"No carrier assigned. Pickup in {int(hours_until)} hours.",
                "data": {"hours_until_pickup": hours_until},
                "detected_at": now,
            })

        return exceptions

    @staticmethod
    async def _detect_overdue_check_calls() -> List[dict]:
        """Detect shipments with overdue check calls."""
        db = get_database()
        now = utc_now()
        threshold_4h = now - timedelta(hours=4)
        threshold_8h = now - timedelta(hours=8)

        shipments = await db.shipments.find({
            "status": "in_transit",
            "$or": [
                {"last_check_call": {"$lt": threshold_4h}},
                {"last_check_call": None}
            ]
        }).to_list(100)

        exceptions = []
        for s in shipments:
            last_check = s.get("last_check_call")
            hours_since = (now - last_check).total_seconds() / 3600 if last_check else float('inf')

            exceptions.append({
                "type": ExceptionType.OVERDUE_CHECK_CALL,
                "severity": ExceptionSeverity.HIGH if hours_since > 8 else ExceptionSeverity.MEDIUM,
                "shipment_id": str(s["_id"]),
                "shipment_number": s.get("shipment_number"),
                "message": f"No check call in {int(hours_since)} hours." if last_check else "No check calls recorded.",
                "data": {"hours_since_check": hours_since},
                "detected_at": now,
            })

        return exceptions

    @staticmethod
    async def _detect_late_pickups() -> List[dict]:
        """Detect late pickups."""
        db = get_database()
        now = utc_now()

        shipments = await db.shipments.find({
            "status": "pending_pickup",
            "pickup_date": {"$lt": now}
        }).to_list(100)

        exceptions = []
        for s in shipments:
            pickup = s.get("pickup_date")
            hours_late = (now - pickup).total_seconds() / 3600 if pickup else 0

            exceptions.append({
                "type": ExceptionType.LATE_PICKUP,
                "severity": ExceptionSeverity.HIGH,
                "shipment_id": str(s["_id"]),
                "shipment_number": s.get("shipment_number"),
                "message": f"Pickup is {int(hours_late)} hours overdue.",
                "data": {"hours_late": hours_late},
                "detected_at": now,
            })

        return exceptions

    @staticmethod
    async def _detect_late_deliveries() -> List[dict]:
        """Detect late deliveries."""
        db = get_database()
        now = utc_now()

        shipments = await db.shipments.find({
            "status": {"$in": ["in_transit", "out_for_delivery"]},
            "delivery_date": {"$lt": now}
        }).to_list(100)

        exceptions = []
        for s in shipments:
            delivery = s.get("delivery_date")
            hours_late = (now - delivery).total_seconds() / 3600 if delivery else 0

            exceptions.append({
                "type": ExceptionType.LATE_DELIVERY,
                "severity": ExceptionSeverity.HIGH,
                "shipment_id": str(s["_id"]),
                "shipment_number": s.get("shipment_number"),
                "message": f"Delivery is {int(hours_late)} hours overdue.",
                "data": {"hours_late": hours_late},
                "detected_at": now,
            })

        return exceptions

    @staticmethod
    async def _detect_carrier_compliance() -> List[dict]:
        """Detect carrier compliance issues."""
        db = get_database()
        now = utc_now()
        threshold_30d = now + timedelta(days=30)
        threshold_7d = now + timedelta(days=7)

        # Find carriers with expiring insurance
        carriers = await db.carriers.find({
            "status": "active",
            "insurance_expiration": {"$lt": threshold_30d, "$gt": now}
        }).to_list(100)

        exceptions = []
        for c in carriers:
            expiration = c.get("insurance_expiration")
            days_until = (expiration - now).days if expiration else 0

            # Check if carrier has active shipments
            active_shipments = await db.shipments.count_documents({
                "carrier_id": c["_id"],
                "status": {"$in": ["booked", "pending_pickup", "in_transit"]}
            })

            if active_shipments > 0:
                exceptions.append({
                    "type": ExceptionType.CARRIER_COMPLIANCE,
                    "severity": ExceptionSeverity.HIGH if days_until < 7 else ExceptionSeverity.MEDIUM,
                    "carrier_id": str(c["_id"]),
                    "carrier_name": c.get("name"),
                    "message": f"Insurance expires in {days_until} days. {active_shipments} active shipments.",
                    "data": {
                        "days_until_expiration": days_until,
                        "active_shipments": active_shipments,
                        "expiration_date": expiration.isoformat() if expiration else None,
                    },
                    "detected_at": now,
                })

        return exceptions

    @staticmethod
    async def _detect_low_margin() -> List[dict]:
        """Detect shipments with low margins."""
        db = get_database()
        now = utc_now()

        # Find recent shipments with low margin (under 10%)
        shipments = await db.shipments.find({
            "status": {"$in": ["booked", "pending_pickup", "in_transit"]},
            "customer_price": {"$gt": 0},
        }).to_list(500)

        exceptions = []
        for s in shipments:
            customer_price = s.get("customer_price", 0)
            carrier_cost = s.get("carrier_cost", 0)

            if customer_price > 0:
                margin_percent = ((customer_price - carrier_cost) / customer_price) * 100

                if margin_percent < 10:
                    exceptions.append({
                        "type": ExceptionType.LOW_MARGIN,
                        "severity": ExceptionSeverity.LOW if margin_percent > 5 else ExceptionSeverity.MEDIUM,
                        "shipment_id": str(s["_id"]),
                        "shipment_number": s.get("shipment_number"),
                        "message": f"Margin is only {margin_percent:.1f}%.",
                        "data": {
                            "margin_percent": margin_percent,
                            "customer_price": customer_price,
                            "carrier_cost": carrier_cost,
                        },
                        "detected_at": now,
                    })

        return exceptions

    @staticmethod
    async def _detect_missing_documents() -> List[dict]:
        """Detect delivered shipments missing required documents."""
        db = get_database()
        now = utc_now()
        threshold_24h = now - timedelta(hours=24)

        # Find delivered shipments from the last 24 hours
        shipments = await db.shipments.find({
            "status": "delivered",
            "actual_delivery_date": {"$gt": threshold_24h}
        }).to_list(100)

        exceptions = []
        for s in shipments:
            # Check for POD
            pod = await db.pod_captures.find_one({"shipment_id": s["_id"]})
            bol = await db.documents.find_one({
                "shipment_id": s["_id"],
                "document_type": "bol"
            })

            missing = []
            if not pod:
                missing.append("POD")
            if not bol:
                missing.append("BOL")

            if missing:
                exceptions.append({
                    "type": ExceptionType.DOCUMENT_MISSING,
                    "severity": ExceptionSeverity.MEDIUM,
                    "shipment_id": str(s["_id"]),
                    "shipment_number": s.get("shipment_number"),
                    "message": f"Missing documents: {', '.join(missing)}",
                    "data": {"missing_documents": missing},
                    "detected_at": now,
                })

        return exceptions

    @staticmethod
    async def _detect_overdue_invoices() -> List[dict]:
        """Detect overdue invoices."""
        db = get_database()
        now = utc_now()

        invoices = await db.invoices.find({
            "status": {"$in": ["sent", "partial"]},
            "due_date": {"$lt": now}
        }).to_list(100)

        exceptions = []
        for inv in invoices:
            due_date = inv.get("due_date")
            days_overdue = (now - due_date).days if due_date else 0

            exceptions.append({
                "type": ExceptionType.INVOICE_OVERDUE,
                "severity": ExceptionSeverity.HIGH if days_overdue > 30 else ExceptionSeverity.MEDIUM,
                "invoice_id": str(inv["_id"]),
                "invoice_number": inv.get("invoice_number"),
                "customer_id": str(inv.get("customer_id")),
                "message": f"Invoice {days_overdue} days overdue. Amount: ${inv.get('amount_due', 0) / 100:.2f}",
                "data": {
                    "days_overdue": days_overdue,
                    "amount_due": inv.get("amount_due", 0),
                },
                "detected_at": now,
            })

        return exceptions

    @staticmethod
    async def _detect_tender_no_response() -> List[dict]:
        """Detect tenders with no response."""
        db = get_database()
        now = utc_now()
        threshold_4h = now - timedelta(hours=4)

        tenders = await db.tenders.find({
            "status": "sent",
            "sent_at": {"$lt": threshold_4h}
        }).to_list(100)

        exceptions = []
        for t in tenders:
            sent_at = t.get("sent_at")
            hours_waiting = (now - sent_at).total_seconds() / 3600 if sent_at else 0

            carrier = await db.carriers.find_one({"_id": t.get("carrier_id")})

            exceptions.append({
                "type": ExceptionType.TENDER_NO_RESPONSE,
                "severity": ExceptionSeverity.MEDIUM if hours_waiting < 8 else ExceptionSeverity.HIGH,
                "tender_id": str(t["_id"]),
                "shipment_id": str(t.get("shipment_id")),
                "carrier_name": carrier.get("name") if carrier else "Unknown",
                "message": f"No response in {int(hours_waiting)} hours.",
                "data": {"hours_waiting": hours_waiting},
                "detected_at": now,
            })

        return exceptions

    @staticmethod
    async def create_work_items_from_exceptions(
        exceptions: List[dict],
        auto_create: bool = True,
    ) -> List[str]:
        """Create work items from detected exceptions."""
        if not auto_create:
            return []

        db = get_database()
        work_item_ids = []

        for exc in exceptions:
            if exc["severity"] != ExceptionSeverity.HIGH:
                continue  # Only create work items for high severity

            # Check if work item already exists for this exception
            existing = await db.work_items.find_one({
                "work_type": WorkItemType.EXCEPTION.value,
                "status": {"$in": [WorkItemStatus.OPEN.value, WorkItemStatus.IN_PROGRESS.value]},
                "$or": [
                    {"shipment_id": ObjectId(exc.get("shipment_id"))} if exc.get("shipment_id") else {},
                    {"carrier_id": ObjectId(exc.get("carrier_id"))} if exc.get("carrier_id") else {},
                    {"invoice_id": ObjectId(exc.get("invoice_id"))} if exc.get("invoice_id") else {},
                ]
            })

            if existing:
                continue

            work_item = {
                "work_type": WorkItemType.EXCEPTION.value,
                "status": WorkItemStatus.OPEN.value,
                "title": f"{exc['type'].replace('_', ' ').title()}: {exc.get('shipment_number') or exc.get('carrier_name') or exc.get('invoice_number', '')}",
                "description": exc["message"],
                "priority": 1,  # High priority for exceptions
                "is_overdue": False,
                "is_snoozed": False,
                "exception_type": exc["type"],
                "exception_data": exc.get("data", {}),
                "created_at": utc_now(),
                "updated_at": utc_now(),
            }

            if exc.get("shipment_id"):
                work_item["shipment_id"] = ObjectId(exc["shipment_id"])
            if exc.get("carrier_id"):
                work_item["carrier_id"] = ObjectId(exc["carrier_id"])
            if exc.get("invoice_id"):
                work_item["invoice_id"] = ObjectId(exc["invoice_id"])

            result = await db.work_items.insert_one(work_item)
            work_item_ids.append(str(result.inserted_id))

        return work_item_ids

    @staticmethod
    async def get_exception_summary() -> dict:
        """Get summary of all current exceptions."""
        exceptions = await ExceptionDetectionService.detect_all_exceptions()

        by_type = {}
        by_severity = {"high": 0, "medium": 0, "low": 0}

        for exc in exceptions:
            exc_type = exc["type"]
            severity = exc["severity"]

            if exc_type not in by_type:
                by_type[exc_type] = 0
            by_type[exc_type] += 1

            by_severity[severity] += 1

        return {
            "total": len(exceptions),
            "by_type": by_type,
            "by_severity": by_severity,
            "exceptions": exceptions,
        }
