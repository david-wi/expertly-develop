from typing import List, Optional
from dataclasses import dataclass
import logging

from bson import ObjectId

from app.database import get_database
from app.models.carrier import Carrier, CarrierStatus, EquipmentType

logger = logging.getLogger(__name__)


@dataclass
class CarrierMatch:
    """A carrier match with scoring details."""
    carrier_id: str
    carrier_name: str
    score: float  # 0-100
    reasons: List[str]
    on_time_percentage: Optional[float]
    total_loads_on_lane: int
    avg_rate_per_mile: Optional[float]
    insurance_status: str  # "valid", "expiring", "expired"
    estimated_cost: Optional[int]  # In cents


class CarrierMatchingService:
    """Service for smart carrier matching and suggestions."""

    async def find_matching_carriers(
        self,
        origin_city: str,
        origin_state: str,
        destination_city: str,
        destination_state: str,
        equipment_type: str,
        pickup_date: Optional[str] = None,
        weight_lbs: Optional[int] = None,
        limit: int = 10,
    ) -> List[CarrierMatch]:
        """
        Find and rank carriers suitable for a shipment.

        Scoring factors:
        - Has equipment type (required)
        - Has run this lane before (+30)
        - On-time percentage (+20 max)
        - No compliance issues (+15)
        - Available capacity (+10)
        - Preferred lane match (+15)
        - Recent activity (+10)
        """
        db = get_database()

        # Base query: active carriers with the right equipment
        query = {
            "status": CarrierStatus.ACTIVE,
            "equipment_types": equipment_type,
        }

        carriers = await db.carriers.find(query).to_list(100)

        matches = []
        for carrier_doc in carriers:
            carrier = Carrier(**carrier_doc)
            score = 50  # Base score
            reasons = []

            # Check lane history
            lane_loads = await self._get_lane_history(
                carrier.id,
                origin_state,
                destination_state,
            )
            if lane_loads > 0:
                score += min(30, lane_loads * 5)
                reasons.append(f"Ran this lane {lane_loads} times")

            # On-time performance
            if carrier.on_time_percentage is not None:
                otp = carrier.on_time_percentage
                if otp >= 95:
                    score += 20
                    reasons.append(f"{otp:.0f}% on-time")
                elif otp >= 90:
                    score += 15
                    reasons.append(f"{otp:.0f}% on-time")
                elif otp >= 80:
                    score += 10

            # Compliance status
            insurance_status = "valid"
            if carrier.is_insurance_expiring:
                score -= 10
                insurance_status = "expiring"
                reasons.append("Insurance expiring soon")
            elif carrier.insurance_expiration:
                from datetime import datetime, timezone
                if carrier.insurance_expiration < datetime.now(timezone.utc):
                    score -= 30
                    insurance_status = "expired"
                    reasons.append("Insurance expired")
                else:
                    score += 15
                    reasons.append("Valid insurance")

            # Claims history
            if carrier.total_loads > 10 and carrier.claims_count == 0:
                score += 10
                reasons.append("No claims history")
            elif carrier.claims_count > 2:
                score -= 15
                reasons.append(f"{carrier.claims_count} claims")

            # Recent activity
            if carrier.last_load_at:
                from datetime import datetime, timezone, timedelta
                days_since_load = (datetime.now(timezone.utc) - carrier.last_load_at).days
                if days_since_load < 7:
                    score += 10
                    reasons.append("Recently active")
                elif days_since_load > 90:
                    score -= 10

            # Estimate cost based on lane history
            avg_rate = await self._get_avg_lane_rate(
                origin_state,
                destination_state,
                equipment_type,
            )

            matches.append(CarrierMatch(
                carrier_id=str(carrier.id),
                carrier_name=carrier.name,
                score=min(100, max(0, score)),
                reasons=reasons,
                on_time_percentage=carrier.on_time_percentage,
                total_loads_on_lane=lane_loads,
                avg_rate_per_mile=avg_rate,
                insurance_status=insurance_status,
                estimated_cost=int(avg_rate * 1000) if avg_rate else None,  # Rough estimate
            ))

        # Sort by score descending
        matches.sort(key=lambda m: m.score, reverse=True)

        return matches[:limit]

    async def _get_lane_history(
        self,
        carrier_id: ObjectId,
        origin_state: str,
        destination_state: str,
    ) -> int:
        """Count how many loads this carrier has done on this lane."""
        db = get_database()

        # Query shipments for this carrier on this lane
        count = await db.shipments.count_documents({
            "carrier_id": carrier_id,
            "stops.0.state": origin_state,  # First stop (pickup) state
            "status": {"$in": ["delivered", "in_transit"]},
        })

        return count

    async def _get_avg_lane_rate(
        self,
        origin_state: str,
        destination_state: str,
        equipment_type: str,
    ) -> Optional[float]:
        """Get average rate per mile for a lane."""
        db = get_database()

        # Aggregate recent shipments on this lane
        pipeline = [
            {
                "$match": {
                    "equipment_type": equipment_type,
                    "stops.0.state": origin_state,
                    "status": "delivered",
                    "carrier_cost": {"$gt": 0},
                }
            },
            {
                "$group": {
                    "_id": None,
                    "avg_cost": {"$avg": "$carrier_cost"},
                    "count": {"$sum": 1},
                }
            }
        ]

        results = await db.shipments.aggregate(pipeline).to_list(1)
        if results and results[0]["count"] >= 3:
            # Return as rate per dollar (simplified)
            return results[0]["avg_cost"] / 100 / 500  # Assume 500 miles average

        return None

    async def get_carrier_lane_stats(
        self,
        carrier_id: str,
        origin_state: str,
        destination_state: str,
    ) -> dict:
        """Get detailed stats for a carrier on a specific lane."""
        db = get_database()

        pipeline = [
            {
                "$match": {
                    "carrier_id": ObjectId(carrier_id),
                    "stops.0.state": origin_state,
                    "status": "delivered",
                }
            },
            {
                "$group": {
                    "_id": None,
                    "total_loads": {"$sum": 1},
                    "avg_cost": {"$avg": "$carrier_cost"},
                    "min_cost": {"$min": "$carrier_cost"},
                    "max_cost": {"$max": "$carrier_cost"},
                }
            }
        ]

        results = await db.shipments.aggregate(pipeline).to_list(1)
        if results:
            return {
                "total_loads": results[0]["total_loads"],
                "avg_cost": results[0]["avg_cost"],
                "min_cost": results[0]["min_cost"],
                "max_cost": results[0]["max_cost"],
            }

        return {
            "total_loads": 0,
            "avg_cost": None,
            "min_cost": None,
            "max_cost": None,
        }
