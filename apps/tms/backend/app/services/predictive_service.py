"""Predictive analytics service for TMS.

Provides predictions for:
- Late delivery risk based on current status, location, and historical patterns
- Rate trend forecasting based on historical lane rates
- Capacity constraint prediction based on historical carrier availability
"""

from typing import List, Optional, Dict, Any
from datetime import datetime, timedelta, timezone
import hashlib
import math
import logging

from bson import ObjectId

from app.database import get_database
from app.models.base import utc_now

logger = logging.getLogger(__name__)


class PredictiveService:
    """Service for predictive analytics using statistical methods."""

    @staticmethod
    async def predict_late_delivery(shipment_id: str) -> dict:
        """
        Predict whether a specific shipment will be delivered late.

        Factors considered:
        - Current status vs scheduled delivery
        - Whether carrier is assigned
        - Time remaining vs typical transit times
        - Carrier's historical on-time rate on this lane
        - Equipment type scarcity
        - Historical delay patterns for this lane
        """
        db = get_database()

        shipment = await db.shipments.find_one({"_id": ObjectId(shipment_id)})
        if not shipment:
            raise ValueError(f"Shipment {shipment_id} not found")

        now = utc_now()
        stops = shipment.get("stops", [])
        origin = next((s for s in stops if s.get("stop_type") == "pickup"), stops[0] if stops else {})
        dest = next((s for s in stops if s.get("stop_type") == "delivery"), stops[-1] if stops else {})
        origin_state = origin.get("state", "")
        dest_state = dest.get("state", "")
        status = shipment.get("status", "booked")
        carrier_id = shipment.get("carrier_id")
        equipment_type = shipment.get("equipment_type", "van")
        delivery_date = shipment.get("delivery_date")
        pickup_date = shipment.get("pickup_date")

        risk_score = 0
        risk_factors = []
        recommendations = []

        # Factor 1: No carrier assigned
        if not carrier_id:
            risk_score += 30
            risk_factors.append("No carrier assigned")
            recommendations.append("Assign carrier immediately")

        # Factor 2: Time pressure - pickup imminent without carrier
        if pickup_date and not carrier_id:
            hours_until_pickup = (pickup_date - now).total_seconds() / 3600
            if hours_until_pickup < 0:
                risk_score += 25
                risk_factors.append(f"Pickup is {abs(int(hours_until_pickup))} hours overdue")
                recommendations.append("Escalate to management - pickup missed")
            elif hours_until_pickup < 12:
                risk_score += 25
                risk_factors.append(f"Pickup in {int(hours_until_pickup)} hours, no carrier")
                recommendations.append("Use emergency carrier sourcing")
            elif hours_until_pickup < 24:
                risk_score += 15
                risk_factors.append(f"Pickup within 24 hours")

        # Factor 3: Delivery timeline pressure
        if delivery_date:
            hours_until_delivery = (delivery_date - now).total_seconds() / 3600
            if hours_until_delivery < 0:
                risk_score += 30
                risk_factors.append(f"Delivery is {abs(int(hours_until_delivery))} hours overdue")
                recommendations.append("Contact customer about delay")
            elif status not in ("delivered", "out_for_delivery") and hours_until_delivery < 12:
                risk_score += 20
                risk_factors.append("Delivery due within 12 hours but not out for delivery")
                recommendations.append("Confirm carrier ETA immediately")
            elif status == "booked" and hours_until_delivery < 48:
                risk_score += 15
                risk_factors.append("Still in booked status with delivery in less than 48 hours")

        # Factor 4: Check call freshness
        if status == "in_transit":
            last_check = shipment.get("last_check_call")
            if last_check:
                hours_since_check = (now - last_check).total_seconds() / 3600
                if hours_since_check > 8:
                    risk_score += 15
                    risk_factors.append(f"No check call in {int(hours_since_check)} hours")
                    recommendations.append("Request immediate location update")
                elif hours_since_check > 4:
                    risk_score += 5
                    risk_factors.append(f"Check call {int(hours_since_check)} hours ago")
            else:
                risk_score += 10
                risk_factors.append("No check calls recorded for in-transit shipment")
                recommendations.append("Initiate check call with carrier")

        # Factor 5: Carrier historical performance on lane
        if carrier_id:
            carrier_stats = await PredictiveService._get_carrier_lane_performance(
                str(carrier_id), origin_state, dest_state
            )
            on_time_rate = carrier_stats.get("on_time_rate", 85)
            if on_time_rate < 70:
                risk_score += 20
                risk_factors.append(f"Carrier on-time rate on this lane: {on_time_rate:.0f}%")
                recommendations.append("Set up proactive check calls every 2 hours")
            elif on_time_rate < 85:
                risk_score += 10
                risk_factors.append(f"Carrier on-time rate below average: {on_time_rate:.0f}%")

        # Factor 6: Equipment scarcity
        if equipment_type in ("reefer", "flatbed", "lowboy", "step_deck"):
            risk_score += 5
            risk_factors.append(f"Specialized equipment ({equipment_type}) may have limited availability")

        # Factor 7: Lane historical delay rate
        lane_stats = await PredictiveService._get_lane_delay_rate(origin_state, dest_state)
        lane_delay_pct = lane_stats.get("delay_rate", 10)
        if lane_delay_pct > 20:
            risk_score += 15
            risk_factors.append(f"High delay rate on this lane: {lane_delay_pct:.0f}%")
            recommendations.append("Add shipment to priority watch list")
        elif lane_delay_pct > 15:
            risk_score += 8
            risk_factors.append(f"Elevated lane delay rate: {lane_delay_pct:.0f}%")

        # Clamp score
        risk_score = min(100, max(0, risk_score))

        if risk_score < 25:
            risk_level = "low"
        elif risk_score < 50:
            risk_level = "medium"
        elif risk_score < 75:
            risk_level = "high"
        else:
            risk_level = "critical"

        # Estimate delay hours
        if risk_score > 30:
            estimated_delay_hours = max(0, (risk_score - 30) * 0.4)
        else:
            estimated_delay_hours = 0

        if risk_score > 60 and "Prepare backup carrier options" not in recommendations:
            recommendations.append("Prepare backup carrier options")
        if risk_score > 40 and "Set up proactive check calls" not in recommendations:
            recommendations.append("Set up proactive check calls")

        return {
            "shipment_id": shipment_id,
            "shipment_number": shipment.get("shipment_number", ""),
            "origin": f"{origin.get('city', '?')}, {origin_state}",
            "destination": f"{dest.get('city', '?')}, {dest_state}",
            "status": status,
            "pickup_date": pickup_date.isoformat() if pickup_date else None,
            "delivery_date": delivery_date.isoformat() if delivery_date else None,
            "delay_risk_score": risk_score,
            "risk_level": risk_level,
            "risk_factors": risk_factors,
            "recommendations": recommendations,
            "estimated_delay_hours": round(estimated_delay_hours, 1),
            "carrier_id": str(carrier_id) if carrier_id else None,
            "lane_delay_rate": round(lane_delay_pct, 1),
            "predicted_at": now.isoformat(),
        }

    @staticmethod
    async def forecast_rate_trend(
        origin_state: str,
        destination_state: str,
        equipment_type: str = "van",
        days: int = 180,
    ) -> dict:
        """
        Forecast rate trends for a specific lane.

        Uses weighted moving average of historical rates, with more
        recent data weighted more heavily.
        """
        db = get_database()
        now = utc_now()
        start_date = now - timedelta(days=days)

        pipeline = [
            {
                "$match": {
                    "created_at": {"$gte": start_date},
                    "carrier_cost": {"$gt": 0},
                }
            },
            {
                "$addFields": {
                    "o_state": {"$arrayElemAt": ["$stops.state", 0]},
                    "d_state": {"$arrayElemAt": ["$stops.state", -1]},
                    "month": {"$dateToString": {"format": "%Y-%m", "date": "$created_at"}},
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
                    "_id": "$month",
                    "avg_rate": {"$avg": "$carrier_cost"},
                    "min_rate": {"$min": "$carrier_cost"},
                    "max_rate": {"$max": "$carrier_cost"},
                    "volume": {"$sum": 1},
                }
            },
            {"$sort": {"_id": 1}},
        ]

        if equipment_type:
            pipeline[0]["$match"]["equipment_type"] = equipment_type

        cursor = db.shipments.aggregate(pipeline)
        monthly_data = await cursor.to_list(100)

        if not monthly_data:
            return {
                "lane": f"{origin_state} -> {destination_state}",
                "equipment_type": equipment_type,
                "historical_data": [],
                "forecast": [],
                "trend_direction": "unknown",
                "rate_trend_percent": 0,
                "confidence": 0,
                "insights": ["Insufficient data for this lane"],
                "total_volume": 0,
            }

        historical = [
            {
                "month": item["_id"],
                "avg_rate": int(item["avg_rate"]),
                "min_rate": int(item["min_rate"]),
                "max_rate": int(item["max_rate"]),
                "volume": item["volume"],
            }
            for item in monthly_data
        ]

        total_volume = sum(h["volume"] for h in historical)

        # Weighted moving average: more recent months get higher weight
        if len(historical) >= 2:
            weights = [i + 1 for i in range(len(historical))]
            total_weight = sum(weights)
            weighted_avg = sum(
                h["avg_rate"] * w for h, w in zip(historical, weights)
            ) / total_weight

            recent_avg = historical[-1]["avg_rate"]
            earliest_avg = historical[0]["avg_rate"]
            rate_change_pct = ((recent_avg - earliest_avg) / earliest_avg * 100) if earliest_avg > 0 else 0

            # Monthly rate of change for forecasting
            monthly_change_rate = rate_change_pct / max(1, len(historical))
        else:
            weighted_avg = historical[0]["avg_rate"]
            rate_change_pct = 0
            monthly_change_rate = 0

        # Forecast next 3 months
        forecast = []
        base_rate = historical[-1]["avg_rate"] if historical else 0
        for i in range(1, 4):
            future_month = now + timedelta(days=30 * i)
            # Dampen the trend for further-out months
            damped_change = monthly_change_rate * (1 - 0.1 * i)
            predicted_rate = int(base_rate * (1 + damped_change / 100))
            confidence = max(40, 85 - i * 10 - max(0, 20 - total_volume))
            forecast.append({
                "month": future_month.strftime("%Y-%m"),
                "predicted_avg_rate": predicted_rate,
                "confidence": round(confidence, 1),
            })

        # Determine trend
        if rate_change_pct > 5:
            trend_direction = "increasing"
        elif rate_change_pct < -5:
            trend_direction = "decreasing"
        else:
            trend_direction = "stable"

        # Generate insights
        insights = []
        if rate_change_pct > 10:
            insights.append(
                f"Rates increasing {rate_change_pct:.1f}% over the period. "
                "Consider locking in contracts at current rates."
            )
        elif rate_change_pct < -10:
            insights.append(
                f"Rates declining {abs(rate_change_pct):.1f}% over the period. "
                "Good time to renegotiate carrier contracts."
            )
        else:
            insights.append("Rates are relatively stable on this lane.")

        if total_volume > 20:
            insights.append(f"High-volume lane ({total_volume} shipments). Forecast confidence is strong.")
        elif total_volume < 5:
            insights.append("Low sample size. Forecast should be treated as directional only.")

        rate_volatility = 0
        if len(historical) >= 3:
            rates = [h["avg_rate"] for h in historical]
            mean_rate = sum(rates) / len(rates)
            variance = sum((r - mean_rate) ** 2 for r in rates) / len(rates)
            std_dev = math.sqrt(variance)
            rate_volatility = (std_dev / mean_rate * 100) if mean_rate > 0 else 0
            if rate_volatility > 15:
                insights.append(
                    f"High rate volatility ({rate_volatility:.0f}% coefficient of variation). "
                    "Consider building in rate buffers."
                )

        return {
            "lane": f"{origin_state} -> {destination_state}",
            "equipment_type": equipment_type,
            "historical_data": historical,
            "current_avg_rate": historical[-1]["avg_rate"] if historical else 0,
            "rate_trend_percent": round(rate_change_pct, 1),
            "trend_direction": trend_direction,
            "forecast": forecast,
            "total_volume": total_volume,
            "rate_volatility": round(rate_volatility, 1),
            "insights": insights,
        }

    @staticmethod
    async def predict_capacity(
        origin_state: str,
        destination_state: str,
        target_date: Optional[str] = None,
        equipment_type: str = "van",
    ) -> dict:
        """
        Predict capacity constraints for a lane on a given date.

        Analyzes:
        - Historical carrier availability patterns
        - Current unassigned loads on the lane
        - Carrier pool size vs demand
        - Seasonal patterns
        """
        db = get_database()
        now = utc_now()

        if target_date:
            try:
                target = datetime.fromisoformat(target_date.replace("Z", "+00:00"))
            except ValueError:
                target = now + timedelta(days=7)
        else:
            target = now + timedelta(days=7)

        # Count active carriers that serve this lane (or have general equipment)
        carrier_count = await db.carriers.count_documents({
            "status": "active",
            "equipment_types": equipment_type,
        })

        # Count carriers with lane experience
        lane_carriers_pipeline = [
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
                    "d_state": destination_state,
                }
            },
            {
                "$group": {
                    "_id": "$carrier_id",
                    "loads": {"$sum": 1},
                }
            },
        ]
        lane_carrier_cursor = db.shipments.aggregate(lane_carriers_pipeline)
        lane_carriers = await lane_carrier_cursor.to_list(1000)
        experienced_carrier_count = len(lane_carriers)

        # Current demand: unassigned shipments on this lane
        target_week_start = target - timedelta(days=3)
        target_week_end = target + timedelta(days=3)

        current_demand = await db.shipments.count_documents({
            "carrier_id": None,
            "status": {"$in": ["booked", "pending_pickup"]},
        })

        # Historical weekly volume
        lookback = now - timedelta(days=90)
        volume_pipeline = [
            {
                "$match": {
                    "created_at": {"$gte": lookback},
                }
            },
            {
                "$addFields": {
                    "o_state": {"$arrayElemAt": ["$stops.state", 0]},
                    "d_state": {"$arrayElemAt": ["$stops.state", -1]},
                    "week": {"$dateToString": {"format": "%Y-W%V", "date": "$created_at"}},
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
                    "_id": "$week",
                    "volume": {"$sum": 1},
                }
            },
            {"$sort": {"_id": 1}},
        ]
        vol_cursor = db.shipments.aggregate(volume_pipeline)
        weekly_volumes = await vol_cursor.to_list(100)

        avg_weekly_volume = (
            sum(w["volume"] for w in weekly_volumes) / max(1, len(weekly_volumes))
            if weekly_volumes
            else 0
        )

        # Calculate capacity score (0 = very tight, 100 = plenty of capacity)
        if experienced_carrier_count == 0 and carrier_count == 0:
            capacity_score = 0
        else:
            # Ratio of supply to demand
            supply = experienced_carrier_count + (carrier_count * 0.3)  # General carriers count less
            demand = max(1, avg_weekly_volume + current_demand * 0.5)
            supply_demand_ratio = supply / demand

            capacity_score = min(100, max(0, supply_demand_ratio * 40))

        if capacity_score >= 70:
            capacity_level = "abundant"
        elif capacity_score >= 40:
            capacity_level = "adequate"
        elif capacity_score >= 20:
            capacity_level = "tight"
        else:
            capacity_level = "critical"

        # Recommendations
        recommendations = []
        if capacity_level == "critical":
            recommendations.append("Post to load boards immediately")
            recommendations.append("Consider rate premium to attract carriers")
            recommendations.append("Engage with carrier development team")
        elif capacity_level == "tight":
            recommendations.append("Begin carrier outreach early")
            recommendations.append("Consider pre-booking with preferred carriers")
        elif capacity_level == "adequate":
            recommendations.append("Standard carrier sourcing should be sufficient")
        else:
            recommendations.append("Strong carrier pool available. Negotiate competitive rates.")

        return {
            "lane": f"{origin_state} -> {destination_state}",
            "equipment_type": equipment_type,
            "target_date": target.isoformat(),
            "capacity_score": round(capacity_score, 1),
            "capacity_level": capacity_level,
            "total_carriers_with_equipment": carrier_count,
            "experienced_lane_carriers": experienced_carrier_count,
            "avg_weekly_volume": round(avg_weekly_volume, 1),
            "current_unassigned_demand": current_demand,
            "weekly_volume_history": [
                {"week": w["_id"], "volume": w["volume"]}
                for w in weekly_volumes[-12:]  # Last 12 weeks
            ],
            "recommendations": recommendations,
            "predicted_at": now.isoformat(),
        }

    @staticmethod
    async def get_predictions_dashboard(limit: int = 20) -> dict:
        """
        Get a comprehensive predictions dashboard combining late delivery
        risk, rate trends, and capacity for active shipments and top lanes.
        """
        db = get_database()
        now = utc_now()

        # Get active shipments for late delivery predictions
        active_cursor = db.shipments.find({
            "status": {"$in": ["booked", "pending_pickup", "in_transit"]},
        }).sort("pickup_date", 1).limit(limit)
        active_shipments = await active_cursor.to_list(limit)

        late_delivery_predictions = []
        for s in active_shipments:
            try:
                prediction = await PredictiveService.predict_late_delivery(str(s["_id"]))
                late_delivery_predictions.append(prediction)
            except Exception as e:
                logger.warning(f"Failed to predict for shipment {s['_id']}: {e}")

        # Sort by risk score descending
        late_delivery_predictions.sort(key=lambda p: p["delay_risk_score"], reverse=True)

        # Get top lanes for capacity predictions
        lane_pipeline = [
            {
                "$match": {
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
                "$group": {
                    "_id": {"origin": "$o_state", "dest": "$d_state"},
                    "volume": {"$sum": 1},
                }
            },
            {"$sort": {"volume": -1}},
            {"$limit": 5},
        ]
        lane_cursor = db.shipments.aggregate(lane_pipeline)
        top_lanes = await lane_cursor.to_list(5)

        capacity_predictions = []
        for lane in top_lanes:
            lid = lane.get("_id", {})
            o_state = lid.get("origin", "")
            d_state = lid.get("dest", "")
            if o_state and d_state:
                try:
                    cap = await PredictiveService.predict_capacity(o_state, d_state)
                    capacity_predictions.append(cap)
                except Exception as e:
                    logger.warning(f"Failed capacity prediction for {o_state}->{d_state}: {e}")

        return {
            "late_delivery_predictions": late_delivery_predictions,
            "high_risk_count": sum(
                1 for p in late_delivery_predictions if p["risk_level"] in ("high", "critical")
            ),
            "medium_risk_count": sum(
                1 for p in late_delivery_predictions if p["risk_level"] == "medium"
            ),
            "low_risk_count": sum(
                1 for p in late_delivery_predictions if p["risk_level"] == "low"
            ),
            "capacity_predictions": capacity_predictions,
            "generated_at": now.isoformat(),
        }

    # ========================================================================
    # Internal helpers
    # ========================================================================

    @staticmethod
    async def _get_carrier_lane_performance(
        carrier_id: str, origin_state: str, destination_state: str
    ) -> dict:
        """Get carrier on-time performance for a specific lane."""
        db = get_database()

        pipeline = [
            {
                "$match": {
                    "carrier_id": ObjectId(carrier_id),
                    "status": "delivered",
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
                    "total": {"$sum": 1},
                    "on_time": {
                        "$sum": {
                            "$cond": [
                                {
                                    "$lte": [
                                        {"$ifNull": ["$delivered_at", "$updated_at"]},
                                        {"$ifNull": ["$scheduled_delivery", "$delivery_date"]},
                                    ]
                                },
                                1,
                                0,
                            ]
                        }
                    },
                }
            },
        ]

        results = await db.shipments.aggregate(pipeline).to_list(1)
        if results and results[0]["total"] > 0:
            total = results[0]["total"]
            on_time = results[0]["on_time"]
            return {"on_time_rate": (on_time / total) * 100, "total_loads": total}

        # Fall back to carrier's overall on-time rate
        carrier = await db.carriers.find_one({"_id": ObjectId(carrier_id)})
        if carrier and carrier.get("on_time_percentage") is not None:
            return {
                "on_time_rate": carrier["on_time_percentage"],
                "total_loads": carrier.get("total_loads", 0),
            }

        return {"on_time_rate": 85, "total_loads": 0}  # Default

    @staticmethod
    async def _get_lane_delay_rate(origin_state: str, destination_state: str) -> dict:
        """Get historical delay rate for a lane."""
        db = get_database()

        pipeline = [
            {
                "$match": {
                    "status": "delivered",
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
                    "total": {"$sum": 1},
                    "late": {
                        "$sum": {
                            "$cond": [
                                {
                                    "$gt": [
                                        {"$ifNull": ["$delivered_at", "$updated_at"]},
                                        {"$ifNull": ["$scheduled_delivery", "$delivery_date"]},
                                    ]
                                },
                                1,
                                0,
                            ]
                        }
                    },
                }
            },
        ]

        results = await db.shipments.aggregate(pipeline).to_list(1)
        if results and results[0]["total"] > 0:
            total = results[0]["total"]
            late = results[0]["late"]
            return {"delay_rate": (late / total) * 100, "total_loads": total}

        # Default if no data
        return {"delay_rate": 10, "total_loads": 0}
