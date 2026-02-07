from typing import List, Optional
from dataclasses import dataclass, field
from datetime import datetime, timezone, timedelta
import logging
import math

from bson import ObjectId

from app.database import get_database
from app.models.carrier import Carrier, CarrierStatus, EquipmentType
from app.models.base import utc_now

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

    async def get_ml_carrier_ranking(
        self,
        shipment_id: str,
    ) -> dict:
        """
        ML-optimized carrier ranking for a specific shipment.

        Scores carriers based on:
        - Historical on-time % (weighted by recency)
        - Claims ratio
        - Lane experience (loads on this exact lane)
        - Rate competitiveness vs lane average
        - Tender acceptance rate
        - Recent activity / reliability

        Returns ranked carriers with explanations.
        """
        db = get_database()

        shipment = await db.shipments.find_one({"_id": ObjectId(shipment_id)})
        if not shipment:
            raise ValueError(f"Shipment {shipment_id} not found")

        stops = shipment.get("stops", [])
        origin = next((s for s in stops if s.get("stop_type") == "pickup"), stops[0] if stops else {})
        dest = next((s for s in stops if s.get("stop_type") == "delivery"), stops[-1] if stops else {})
        origin_state = origin.get("state", "")
        dest_state = dest.get("state", "")
        equipment_type = shipment.get("equipment_type", "van")
        customer_price = shipment.get("customer_price", 0) or 0

        # Get all active carriers with matching equipment
        carriers = await db.carriers.find({
            "status": CarrierStatus.ACTIVE,
            "equipment_types": equipment_type,
        }).to_list(200)

        if not carriers:
            return {
                "shipment_id": shipment_id,
                "rankings": [],
                "total_evaluated": 0,
                "lane": f"{origin_state} -> {dest_state}",
            }

        now = datetime.now(timezone.utc)

        # Get lane history for all carriers at once
        lane_pipeline = [
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
                                {"$lte": [
                                    {"$ifNull": ["$delivered_at", "$updated_at"]},
                                    {"$ifNull": ["$scheduled_delivery", "$delivery_date"]},
                                ]},
                                1, 0,
                            ]
                        }
                    },
                    "total_delivered": {"$sum": 1},
                    "last_load_date": {"$max": "$created_at"},
                }
            },
        ]
        lane_data = await db.shipments.aggregate(lane_pipeline).to_list(500)
        lane_map = {str(d["_id"]): d for d in lane_data if d.get("_id")}

        # Get tender acceptance rates
        tender_pipeline = [
            {
                "$match": {
                    "created_at": {"$gte": now - timedelta(days=180)},
                }
            },
            {
                "$group": {
                    "_id": "$carrier_id",
                    "total_tenders": {"$sum": 1},
                    "accepted": {
                        "$sum": {"$cond": [{"$eq": ["$status", "accepted"]}, 1, 0]}
                    },
                    "declined": {
                        "$sum": {"$cond": [{"$eq": ["$status", "declined"]}, 1, 0]}
                    },
                }
            },
        ]
        tender_data = await db.tenders.aggregate(tender_pipeline).to_list(500)
        tender_map = {str(d["_id"]): d for d in tender_data if d.get("_id")}

        # Get lane average rate
        lane_avg_rate = await self._get_avg_lane_rate(origin_state, dest_state, equipment_type)

        rankings = []
        for carrier_doc in carriers:
            carrier = Carrier(**carrier_doc)
            cid = str(carrier.id)
            explanation = []

            # === ML Feature Weights ===
            # Weight recent performance more heavily

            # Feature 1: Lane Experience (0-25 points)
            lane_info = lane_map.get(cid, {})
            lane_count = lane_info.get("lane_count", 0)
            if lane_count > 0:
                lane_score = min(25, lane_count * 4)
                explanation.append(f"{lane_count} loads on this lane")
            else:
                lane_score = 0

            # Feature 2: On-time Performance (0-30 points)
            # Weight by lane-specific data first, fall back to overall
            if lane_info.get("total_delivered", 0) > 0:
                lane_otp = (lane_info["on_time_count"] / lane_info["total_delivered"]) * 100
            elif carrier.on_time_percentage is not None:
                lane_otp = carrier.on_time_percentage
            else:
                lane_otp = 85  # Default assumption

            otp_score = (lane_otp / 100) * 30
            if lane_otp >= 95:
                explanation.append(f"Excellent on-time: {lane_otp:.0f}%")
            elif lane_otp >= 85:
                explanation.append(f"Good on-time: {lane_otp:.0f}%")
            elif lane_otp < 75:
                explanation.append(f"Below average on-time: {lane_otp:.0f}%")

            # Feature 3: Claims Ratio (0-10 points)
            total_loads = carrier.total_loads or 0
            claims = carrier.claims_count or 0
            if total_loads > 5 and claims == 0:
                claims_score = 10
                explanation.append("Zero claims")
            elif total_loads > 0:
                claims_ratio = claims / total_loads
                claims_score = max(0, 10 - claims_ratio * 50)
                if claims > 2:
                    explanation.append(f"{claims} claims on {total_loads} loads")
            else:
                claims_score = 5  # Neutral

            # Feature 4: Rate Competitiveness (0-15 points)
            carrier_avg_cost = lane_info.get("avg_cost", 0)
            if carrier_avg_cost > 0 and customer_price > 0:
                rate_ratio = carrier_avg_cost / customer_price
                rate_score = max(0, 15 - rate_ratio * 12)
                if rate_ratio < 0.8:
                    explanation.append(f"Competitive rate (avg ${carrier_avg_cost/100:.0f})")
                elif rate_ratio > 0.95:
                    explanation.append(f"Rate may be high (avg ${carrier_avg_cost/100:.0f})")
            else:
                rate_score = 7.5  # Neutral

            # Feature 5: Tender Acceptance Rate (0-10 points)
            tender_info = tender_map.get(cid, {})
            total_tenders = tender_info.get("total_tenders", 0)
            if total_tenders > 0:
                acceptance_rate = (tender_info.get("accepted", 0) / total_tenders) * 100
                acceptance_score = (acceptance_rate / 100) * 10
                if acceptance_rate >= 80:
                    explanation.append(f"High acceptance rate: {acceptance_rate:.0f}%")
                elif acceptance_rate < 50:
                    explanation.append(f"Low acceptance rate: {acceptance_rate:.0f}%")
            else:
                acceptance_score = 5  # Neutral
                acceptance_rate = 85  # Default

            # Feature 6: Recency (0-10 points) - Recent activity = more reliable
            recency_score = 5
            last_load = lane_info.get("last_load_date") or carrier.last_load_at
            if last_load:
                days_since = (now - last_load).days
                if days_since < 7:
                    recency_score = 10
                    explanation.append("Active in last week")
                elif days_since < 30:
                    recency_score = 7
                elif days_since > 90:
                    recency_score = 2
                    explanation.append("Inactive for 90+ days")

            # Feature 7: Insurance/Compliance (-20 to 0 penalty)
            compliance_penalty = 0
            insurance_status = "valid"
            if carrier.is_insurance_expiring:
                compliance_penalty = -5
                insurance_status = "expiring"
                explanation.append("Insurance expiring soon")
            elif carrier.insurance_expiration:
                if carrier.insurance_expiration < now:
                    compliance_penalty = -20
                    insurance_status = "expired"
                    explanation.append("Insurance expired")

            # Calculate total score (max 100)
            total_score = (
                lane_score
                + otp_score
                + claims_score
                + rate_score
                + acceptance_score
                + recency_score
                + compliance_penalty
            )
            total_score = min(100, max(0, total_score))

            estimated_rate = int(carrier_avg_cost) if carrier_avg_cost > 0 else (
                int(customer_price * 0.82) if customer_price > 0 else None
            )

            rankings.append({
                "carrier_id": cid,
                "carrier_name": carrier.name,
                "ml_score": round(total_score, 1),
                "explanation": explanation,
                "on_time_percent": round(lane_otp, 1),
                "lane_loads": lane_count,
                "claims_count": claims,
                "estimated_rate": estimated_rate,
                "tender_acceptance_rate": round(acceptance_rate if total_tenders > 0 else 85, 1),
                "insurance_status": insurance_status,
                "feature_scores": {
                    "lane_experience": round(lane_score, 1),
                    "on_time": round(otp_score, 1),
                    "claims": round(claims_score, 1),
                    "rate": round(rate_score, 1),
                    "acceptance": round(acceptance_score, 1),
                    "recency": round(recency_score, 1),
                    "compliance": round(compliance_penalty, 1),
                },
            })

        # Sort by ML score
        rankings.sort(key=lambda r: r["ml_score"], reverse=True)

        return {
            "shipment_id": shipment_id,
            "lane": f"{origin_state} -> {dest_state}",
            "equipment_type": equipment_type,
            "customer_price": customer_price,
            "lane_avg_rate": int(lane_avg_rate * 100 * 500) if lane_avg_rate else None,  # Convert back
            "rankings": rankings[:20],
            "total_evaluated": len(rankings),
            "generated_at": utc_now().isoformat(),
        }

    async def suggest_rate(
        self,
        origin_state: str,
        destination_state: str,
        equipment_type: str = "van",
        weight_lbs: Optional[int] = None,
    ) -> dict:
        """
        Suggest an optimal rate for a lane based on historical data.

        Considers:
        - Historical carrier costs on the lane
        - Market trend direction
        - Equipment type adjustments
        - Weight-based adjustments
        """
        db = get_database()
        now = datetime.now(timezone.utc)

        # Get recent rate data (last 90 days)
        pipeline = [
            {
                "$match": {
                    "status": "delivered",
                    "carrier_cost": {"$gt": 0},
                    "created_at": {"$gte": now - timedelta(days=90)},
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
                    "d_state": destination_state,
                    "equipment_type": equipment_type,
                }
            },
            {
                "$group": {
                    "_id": None,
                    "avg_carrier_cost": {"$avg": "$carrier_cost"},
                    "min_carrier_cost": {"$min": "$carrier_cost"},
                    "max_carrier_cost": {"$max": "$carrier_cost"},
                    "avg_customer_price": {"$avg": "$customer_price"},
                    "count": {"$sum": 1},
                    "avg_miles": {"$avg": "$total_miles"},
                }
            },
        ]

        results = await db.shipments.aggregate(pipeline).to_list(1)

        if not results or results[0]["count"] < 2:
            # Insufficient data - use broader lane data
            broader_pipeline = list(pipeline)
            broader_pipeline[0]["$match"]["created_at"] = {"$gte": now - timedelta(days=180)}
            broader_pipeline[3].pop("$match", None)
            # Re-run without equipment filter
            broader_pipeline2 = [
                {
                    "$match": {
                        "status": "delivered",
                        "carrier_cost": {"$gt": 0},
                        "created_at": {"$gte": now - timedelta(days=180)},
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
                        "d_state": destination_state,
                    }
                },
                {
                    "$group": {
                        "_id": None,
                        "avg_carrier_cost": {"$avg": "$carrier_cost"},
                        "min_carrier_cost": {"$min": "$carrier_cost"},
                        "max_carrier_cost": {"$max": "$carrier_cost"},
                        "avg_customer_price": {"$avg": "$customer_price"},
                        "count": {"$sum": 1},
                        "avg_miles": {"$avg": "$total_miles"},
                    }
                },
            ]
            results = await db.shipments.aggregate(broader_pipeline2).to_list(1)

        if not results:
            return {
                "lane": f"{origin_state} -> {destination_state}",
                "equipment_type": equipment_type,
                "suggested_carrier_rate": None,
                "suggested_customer_rate": None,
                "confidence": 0,
                "data_points": 0,
                "message": "Insufficient historical data for rate suggestion",
                "insights": [],
            }

        data = results[0]
        avg_carrier = data["avg_carrier_cost"]
        min_carrier = data["min_carrier_cost"]
        max_carrier = data["max_carrier_cost"]
        avg_customer = data["avg_customer_price"]
        count = data["count"]
        avg_miles = data.get("avg_miles", 0) or 0

        # Get trend: compare last 30d to previous 30-90d
        recent_pipeline = [
            {
                "$match": {
                    "status": "delivered",
                    "carrier_cost": {"$gt": 0},
                    "created_at": {"$gte": now - timedelta(days=30)},
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
                    "d_state": destination_state,
                }
            },
            {
                "$group": {
                    "_id": None,
                    "avg_cost": {"$avg": "$carrier_cost"},
                    "count": {"$sum": 1},
                }
            },
        ]
        recent_results = await db.shipments.aggregate(recent_pipeline).to_list(1)
        recent_avg = recent_results[0]["avg_cost"] if recent_results else avg_carrier

        # Trend adjustment
        trend_factor = 1.0
        if avg_carrier > 0:
            trend_pct = ((recent_avg - avg_carrier) / avg_carrier) * 100
            if trend_pct > 5:
                trend_factor = 1.03  # Rates are rising, suggest slightly higher
            elif trend_pct < -5:
                trend_factor = 0.97  # Rates are falling, suggest slightly lower

        # Calculate suggested rate
        suggested_carrier_rate = int(recent_avg * trend_factor)

        # Target 15% margin for customer rate
        target_margin = 0.15
        suggested_customer_rate = int(suggested_carrier_rate / (1 - target_margin))

        # Confidence based on sample size and recency
        confidence = min(95, 40 + count * 3)
        if recent_results and recent_results[0]["count"] >= 5:
            confidence = min(95, confidence + 10)

        insights = []
        if trend_factor > 1:
            insights.append("Rates trending upward. Suggested rate reflects recent market increase.")
        elif trend_factor < 1:
            insights.append("Rates trending downward. Good opportunity for competitive pricing.")
        else:
            insights.append("Rates are stable on this lane.")

        if count > 20:
            insights.append(f"Strong data set ({count} historical shipments). High confidence.")
        elif count < 5:
            insights.append(f"Limited data ({count} shipments). Consider market rate benchmarks.")

        rate_spread = max_carrier - min_carrier
        if avg_carrier > 0 and rate_spread / avg_carrier > 0.3:
            insights.append("High rate variability. Negotiate firmly for best rate.")

        return {
            "lane": f"{origin_state} -> {destination_state}",
            "equipment_type": equipment_type,
            "suggested_carrier_rate": suggested_carrier_rate,
            "suggested_customer_rate": suggested_customer_rate,
            "rate_range": {"min": int(min_carrier), "max": int(max_carrier)},
            "current_avg_carrier_rate": int(avg_carrier),
            "current_avg_customer_rate": int(avg_customer) if avg_customer else None,
            "target_margin_percent": target_margin * 100,
            "avg_miles": int(avg_miles),
            "rate_per_mile": round(suggested_carrier_rate / avg_miles, 2) if avg_miles > 0 else None,
            "confidence": round(confidence, 1),
            "data_points": count,
            "trend_direction": "increasing" if trend_factor > 1 else "decreasing" if trend_factor < 1 else "stable",
            "insights": insights,
        }
