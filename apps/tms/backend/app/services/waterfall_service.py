"""Automated tender waterfall service for sequential carrier tendering."""
from datetime import datetime, timedelta
from typing import List, Optional
from bson import ObjectId

from app.database import get_database
from app.models.base import utc_now
from app.models.tender import TenderStatus
from app.models.work_item import WorkItemType, WorkItemStatus


class WaterfallConfig:
    """Configuration for waterfall tendering."""

    def __init__(
        self,
        carrier_ids: List[str],
        shipment_id: str,
        offered_rate: int,
        timeout_minutes: int = 30,
        auto_escalate: bool = True,
        rate_increase_percent: float = 0.0,  # Increase rate on each step
        max_escalations: int = 3,
        notes: Optional[str] = None,
    ):
        self.carrier_ids = carrier_ids
        self.shipment_id = shipment_id
        self.offered_rate = offered_rate
        self.timeout_minutes = timeout_minutes
        self.auto_escalate = auto_escalate
        self.rate_increase_percent = rate_increase_percent
        self.max_escalations = max_escalations
        self.notes = notes


class WaterfallService:
    """Service for managing automated tender waterfalls."""

    @staticmethod
    async def create_waterfall(config: WaterfallConfig) -> dict:
        """
        Create a new tender waterfall for a shipment.
        Returns waterfall record with ID.
        """
        db = get_database()

        # Verify shipment exists
        shipment = await db.shipments.find_one({"_id": ObjectId(config.shipment_id)})
        if not shipment:
            raise ValueError(f"Shipment {config.shipment_id} not found")

        if shipment.get("carrier_id"):
            raise ValueError("Shipment already has a carrier assigned")

        # Create waterfall record
        waterfall = {
            "shipment_id": ObjectId(config.shipment_id),
            "carrier_ids": [ObjectId(cid) for cid in config.carrier_ids],
            "current_step": 0,
            "base_rate": config.offered_rate,
            "current_rate": config.offered_rate,
            "timeout_minutes": config.timeout_minutes,
            "auto_escalate": config.auto_escalate,
            "rate_increase_percent": config.rate_increase_percent,
            "max_escalations": config.max_escalations,
            "notes": config.notes,
            "status": "active",  # active, completed, cancelled, exhausted
            "started_at": utc_now(),
            "current_tender_id": None,
            "current_step_started_at": None,
            "completed_at": None,
            "winning_carrier_id": None,
            "winning_tender_id": None,
            "history": [],
            "created_at": utc_now(),
            "updated_at": utc_now(),
        }

        result = await db.tender_waterfalls.insert_one(waterfall)
        waterfall_id = result.inserted_id

        # Start first step
        await WaterfallService._send_next_tender(str(waterfall_id))

        return {
            "waterfall_id": str(waterfall_id),
            "status": "active",
            "total_carriers": len(config.carrier_ids),
        }

    @staticmethod
    async def _send_next_tender(waterfall_id: str) -> Optional[str]:
        """Send tender to next carrier in waterfall. Returns tender_id or None if exhausted."""
        db = get_database()

        waterfall = await db.tender_waterfalls.find_one({"_id": ObjectId(waterfall_id)})
        if not waterfall:
            return None

        if waterfall["status"] != "active":
            return None

        carrier_ids = waterfall["carrier_ids"]
        current_step = waterfall["current_step"]

        if current_step >= len(carrier_ids):
            # Exhausted all carriers
            await db.tender_waterfalls.update_one(
                {"_id": ObjectId(waterfall_id)},
                {
                    "$set": {
                        "status": "exhausted",
                        "completed_at": utc_now(),
                        "updated_at": utc_now()
                    }
                }
            )

            # Create work item for manual intervention
            await db.work_items.insert_one({
                "work_type": WorkItemType.SHIPMENT_NEEDS_CARRIER.value,
                "status": WorkItemStatus.OPEN.value,
                "title": f"Waterfall exhausted - manual carrier selection needed",
                "description": f"All carriers in waterfall declined. Manual selection required.",
                "shipment_id": waterfall["shipment_id"],
                "priority": 1,  # High priority
                "is_overdue": False,
                "is_snoozed": False,
                "created_at": utc_now(),
                "updated_at": utc_now(),
            })

            return None

        # Calculate rate for this step
        rate_increase = waterfall.get("rate_increase_percent", 0) / 100
        current_rate = int(waterfall["base_rate"] * (1 + rate_increase * current_step))

        # Create tender
        carrier_id = carrier_ids[current_step]
        tender = {
            "shipment_id": waterfall["shipment_id"],
            "carrier_id": carrier_id,
            "status": TenderStatus.SENT.value,
            "offered_rate": current_rate,
            "notes": waterfall.get("notes"),
            "sent_at": utc_now(),
            "expires_at": utc_now() + timedelta(minutes=waterfall["timeout_minutes"]),
            "waterfall_id": ObjectId(waterfall_id),
            "waterfall_step": current_step,
            "created_at": utc_now(),
            "updated_at": utc_now(),
        }

        tender_result = await db.tenders.insert_one(tender)
        tender_id = tender_result.inserted_id

        # Update waterfall
        history_entry = {
            "step": current_step,
            "carrier_id": carrier_id,
            "tender_id": tender_id,
            "rate": current_rate,
            "sent_at": utc_now(),
            "status": "sent",
        }

        await db.tender_waterfalls.update_one(
            {"_id": ObjectId(waterfall_id)},
            {
                "$set": {
                    "current_step": current_step,
                    "current_rate": current_rate,
                    "current_tender_id": tender_id,
                    "current_step_started_at": utc_now(),
                    "updated_at": utc_now()
                },
                "$push": {"history": history_entry}
            }
        )

        # Create notification for carrier (via portal)
        carrier = await db.carriers.find_one({"_id": carrier_id})
        if carrier:
            await db.portal_notifications.insert_one({
                "portal_type": "carrier",
                "entity_id": carrier_id,
                "title": "New Load Available",
                "message": f"You have a new tender offer. Rate: ${current_rate / 100:.2f}",
                "notification_type": "tender",
                "tender_id": tender_id,
                "shipment_id": waterfall["shipment_id"],
                "is_read": False,
                "created_at": utc_now(),
                "updated_at": utc_now(),
            })

        return str(tender_id)

    @staticmethod
    async def process_tender_response(tender_id: str, accepted: bool, counter_rate: int = None) -> dict:
        """
        Process carrier's response to a tender in a waterfall.
        If declined, automatically escalates to next carrier.
        """
        db = get_database()

        tender = await db.tenders.find_one({"_id": ObjectId(tender_id)})
        if not tender:
            raise ValueError("Tender not found")

        waterfall_id = tender.get("waterfall_id")

        if accepted:
            # Update tender
            await db.tenders.update_one(
                {"_id": ObjectId(tender_id)},
                {
                    "$set": {
                        "status": TenderStatus.ACCEPTED.value,
                        "responded_at": utc_now(),
                        "updated_at": utc_now()
                    }
                }
            )

            # Update shipment
            await db.shipments.update_one(
                {"_id": tender["shipment_id"]},
                {
                    "$set": {
                        "carrier_id": tender["carrier_id"],
                        "carrier_cost": tender["offered_rate"],
                        "updated_at": utc_now()
                    }
                }
            )

            # Complete waterfall if exists
            if waterfall_id:
                await db.tender_waterfalls.update_one(
                    {"_id": waterfall_id},
                    {
                        "$set": {
                            "status": "completed",
                            "completed_at": utc_now(),
                            "winning_carrier_id": tender["carrier_id"],
                            "winning_tender_id": ObjectId(tender_id),
                            "updated_at": utc_now()
                        }
                    }
                )

                # Update history entry
                await db.tender_waterfalls.update_one(
                    {"_id": waterfall_id, "history.tender_id": ObjectId(tender_id)},
                    {"$set": {"history.$.status": "accepted", "history.$.responded_at": utc_now()}}
                )

            # Cancel other pending tenders
            await db.tenders.update_many(
                {
                    "shipment_id": tender["shipment_id"],
                    "_id": {"$ne": ObjectId(tender_id)},
                    "status": TenderStatus.SENT.value
                },
                {"$set": {"status": TenderStatus.CANCELLED.value, "updated_at": utc_now()}}
            )

            return {"status": "accepted", "waterfall_completed": True}

        else:
            # Update tender as declined
            update = {
                "status": TenderStatus.DECLINED.value,
                "responded_at": utc_now(),
                "updated_at": utc_now()
            }
            if counter_rate:
                update["counter_rate"] = counter_rate

            await db.tenders.update_one(
                {"_id": ObjectId(tender_id)},
                {"$set": update}
            )

            # Update history entry
            if waterfall_id:
                await db.tender_waterfalls.update_one(
                    {"_id": waterfall_id, "history.tender_id": ObjectId(tender_id)},
                    {
                        "$set": {
                            "history.$.status": "declined",
                            "history.$.responded_at": utc_now(),
                            "history.$.counter_rate": counter_rate
                        }
                    }
                )

                # Escalate to next carrier
                waterfall = await db.tender_waterfalls.find_one({"_id": waterfall_id})
                if waterfall and waterfall.get("auto_escalate"):
                    # Move to next step
                    next_step = waterfall["current_step"] + 1
                    await db.tender_waterfalls.update_one(
                        {"_id": waterfall_id},
                        {"$set": {"current_step": next_step, "updated_at": utc_now()}}
                    )

                    # Send next tender
                    next_tender_id = await WaterfallService._send_next_tender(str(waterfall_id))
                    return {
                        "status": "declined",
                        "escalated": True,
                        "next_tender_id": next_tender_id
                    }

            return {"status": "declined", "escalated": False}

    @staticmethod
    async def check_expired_tenders():
        """
        Check for expired tenders and auto-escalate.
        Should be called periodically (e.g., every minute).
        """
        db = get_database()

        # Find active waterfalls with expired current tenders
        waterfalls = await db.tender_waterfalls.find({
            "status": "active",
            "current_tender_id": {"$ne": None},
            "auto_escalate": True
        }).to_list(100)

        escalated = []

        for waterfall in waterfalls:
            tender = await db.tenders.find_one({"_id": waterfall["current_tender_id"]})
            if not tender:
                continue

            # Check if expired
            expires_at = tender.get("expires_at")
            if expires_at and expires_at < utc_now() and tender["status"] == TenderStatus.SENT.value:
                # Mark as expired
                await db.tenders.update_one(
                    {"_id": tender["_id"]},
                    {
                        "$set": {
                            "status": TenderStatus.EXPIRED.value,
                            "updated_at": utc_now()
                        }
                    }
                )

                # Update history
                await db.tender_waterfalls.update_one(
                    {"_id": waterfall["_id"], "history.tender_id": tender["_id"]},
                    {"$set": {"history.$.status": "expired", "history.$.expired_at": utc_now()}}
                )

                # Move to next step
                next_step = waterfall["current_step"] + 1
                await db.tender_waterfalls.update_one(
                    {"_id": waterfall["_id"]},
                    {"$set": {"current_step": next_step, "updated_at": utc_now()}}
                )

                # Send next tender
                next_tender_id = await WaterfallService._send_next_tender(str(waterfall["_id"]))
                escalated.append({
                    "waterfall_id": str(waterfall["_id"]),
                    "next_tender_id": next_tender_id,
                    "reason": "timeout"
                })

        return {"escalated_count": len(escalated), "escalations": escalated}

    @staticmethod
    async def cancel_waterfall(waterfall_id: str, reason: str = None) -> dict:
        """Cancel an active waterfall."""
        db = get_database()

        waterfall = await db.tender_waterfalls.find_one({"_id": ObjectId(waterfall_id)})
        if not waterfall:
            raise ValueError("Waterfall not found")

        if waterfall["status"] != "active":
            raise ValueError("Waterfall is not active")

        # Cancel current tender
        if waterfall.get("current_tender_id"):
            await db.tenders.update_one(
                {"_id": waterfall["current_tender_id"]},
                {"$set": {"status": TenderStatus.CANCELLED.value, "updated_at": utc_now()}}
            )

        # Update waterfall
        await db.tender_waterfalls.update_one(
            {"_id": ObjectId(waterfall_id)},
            {
                "$set": {
                    "status": "cancelled",
                    "completed_at": utc_now(),
                    "cancellation_reason": reason,
                    "updated_at": utc_now()
                }
            }
        )

        return {"status": "cancelled"}

    @staticmethod
    async def get_waterfall_status(waterfall_id: str) -> dict:
        """Get current status of a waterfall."""
        db = get_database()

        waterfall = await db.tender_waterfalls.find_one({"_id": ObjectId(waterfall_id)})
        if not waterfall:
            raise ValueError("Waterfall not found")

        # Get carrier names for history
        history_with_names = []
        for entry in waterfall.get("history", []):
            carrier = await db.carriers.find_one({"_id": entry["carrier_id"]})
            history_with_names.append({
                "step": entry["step"],
                "carrier_name": carrier.get("name") if carrier else "Unknown",
                "rate": entry["rate"],
                "status": entry["status"],
                "sent_at": entry.get("sent_at"),
                "responded_at": entry.get("responded_at"),
            })

        return {
            "waterfall_id": str(waterfall["_id"]),
            "shipment_id": str(waterfall["shipment_id"]),
            "status": waterfall["status"],
            "current_step": waterfall["current_step"],
            "total_carriers": len(waterfall["carrier_ids"]),
            "current_rate": waterfall["current_rate"],
            "base_rate": waterfall["base_rate"],
            "history": history_with_names,
            "started_at": waterfall["started_at"],
            "completed_at": waterfall.get("completed_at"),
            "winning_carrier_id": str(waterfall["winning_carrier_id"]) if waterfall.get("winning_carrier_id") else None,
        }
