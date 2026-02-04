from typing import List, Optional
from datetime import datetime, timedelta
from fastapi import APIRouter
from pydantic import BaseModel
from bson import ObjectId

from app.database import get_database

router = APIRouter()


# ============ Carrier Performance Models ============

class CarrierPerformanceSummary(BaseModel):
    total_carriers: int
    active_carriers: int  # with shipments in period
    avg_on_time_rate: float  # percentage
    avg_tender_acceptance: float  # percentage
    top_performer_id: Optional[str]
    top_performer_name: Optional[str]


class CarrierPerformanceDetail(BaseModel):
    carrier_id: str
    carrier_name: str
    mc_number: Optional[str]
    shipment_count: int
    on_time_delivery_count: int
    on_time_rate: float  # percentage
    late_delivery_count: int
    tender_accepted_count: int
    tender_declined_count: int
    tender_acceptance_rate: float  # percentage
    avg_cost_per_mile: float  # cents
    total_miles: int
    total_cost: int  # cents
    exception_count: int
    performance_score: float  # 0-100 composite score
    trend: str  # "improving", "stable", "declining"


class CarrierPerformanceTrend(BaseModel):
    date: str  # YYYY-MM-DD
    on_time_rate: float
    shipment_count: int
    avg_cost_per_mile: float


class CarrierPerformanceResponse(BaseModel):
    summary: CarrierPerformanceSummary
    carriers: List[CarrierPerformanceDetail]
    trends: List[CarrierPerformanceTrend]


class MarginSummary(BaseModel):
    total_revenue: int  # cents
    total_cost: int  # cents
    total_margin: int  # cents
    avg_margin_percent: float
    shipment_count: int
    low_margin_count: int  # below 10%


class CustomerMargin(BaseModel):
    customer_id: str
    customer_name: str
    total_revenue: int
    total_cost: int
    total_margin: int
    avg_margin_percent: float
    shipment_count: int


class CarrierMargin(BaseModel):
    carrier_id: str
    carrier_name: str
    total_revenue: int
    total_cost: int
    total_margin: int
    avg_margin_percent: float
    shipment_count: int


class LaneMargin(BaseModel):
    origin: str  # "City, ST"
    destination: str  # "City, ST"
    total_revenue: int
    total_cost: int
    total_margin: int
    avg_margin_percent: float
    shipment_count: int


class MarginTrend(BaseModel):
    date: str  # YYYY-MM-DD
    total_revenue: int
    total_cost: int
    total_margin: int
    avg_margin_percent: float
    shipment_count: int


class LowMarginShipment(BaseModel):
    shipment_id: str
    shipment_number: str
    customer_name: Optional[str]
    carrier_name: Optional[str]
    origin: str
    destination: str
    customer_price: int
    carrier_cost: int
    margin: int
    margin_percent: float
    created_at: datetime


class MarginDashboardResponse(BaseModel):
    summary: MarginSummary
    by_customer: List[CustomerMargin]
    by_carrier: List[CarrierMargin]
    by_lane: List[LaneMargin]
    trends: List[MarginTrend]
    low_margin_shipments: List[LowMarginShipment]


@router.get("/margins", response_model=MarginDashboardResponse)
async def get_margin_dashboard(days: int = 30):
    """Get margin analytics dashboard data."""
    db = get_database()

    # Calculate date range
    end_date = datetime.utcnow()
    start_date = end_date - timedelta(days=days)

    # Get all shipments in date range with financial data
    pipeline = [
        {
            "$match": {
                "created_at": {"$gte": start_date, "$lte": end_date},
                "customer_price": {"$gt": 0}
            }
        },
        {
            "$lookup": {
                "from": "customers",
                "localField": "customer_id",
                "foreignField": "_id",
                "as": "customer"
            }
        },
        {
            "$lookup": {
                "from": "carriers",
                "localField": "carrier_id",
                "foreignField": "_id",
                "as": "carrier"
            }
        },
        {
            "$addFields": {
                "customer_name": {"$arrayElemAt": ["$customer.name", 0]},
                "carrier_name": {"$arrayElemAt": ["$carrier.name", 0]},
                "origin_city": {"$arrayElemAt": ["$stops.city", 0]},
                "origin_state": {"$arrayElemAt": ["$stops.state", 0]},
                "dest_city": {"$arrayElemAt": ["$stops.city", -1]},
                "dest_state": {"$arrayElemAt": ["$stops.state", -1]},
            }
        }
    ]

    cursor = db.shipments.aggregate(pipeline)
    shipments = await cursor.to_list(10000)

    # Calculate summary
    total_revenue = sum(s.get("customer_price", 0) or 0 for s in shipments)
    total_cost = sum(s.get("carrier_cost", 0) or 0 for s in shipments)
    total_margin = total_revenue - total_cost
    shipment_count = len(shipments)
    avg_margin_percent = (total_margin / total_revenue * 100) if total_revenue > 0 else 0
    low_margin_count = sum(1 for s in shipments if (s.get("margin_percent") or 0) < 10)

    summary = MarginSummary(
        total_revenue=total_revenue,
        total_cost=total_cost,
        total_margin=total_margin,
        avg_margin_percent=round(avg_margin_percent, 1),
        shipment_count=shipment_count,
        low_margin_count=low_margin_count
    )

    # By Customer
    customer_data = {}
    for s in shipments:
        cid = str(s.get("customer_id", "unknown"))
        if cid not in customer_data:
            customer_data[cid] = {
                "customer_id": cid,
                "customer_name": s.get("customer_name") or "Unknown",
                "total_revenue": 0,
                "total_cost": 0,
                "shipment_count": 0
            }
        customer_data[cid]["total_revenue"] += s.get("customer_price", 0) or 0
        customer_data[cid]["total_cost"] += s.get("carrier_cost", 0) or 0
        customer_data[cid]["shipment_count"] += 1

    by_customer = []
    for cid, data in customer_data.items():
        margin = data["total_revenue"] - data["total_cost"]
        margin_pct = (margin / data["total_revenue"] * 100) if data["total_revenue"] > 0 else 0
        by_customer.append(CustomerMargin(
            customer_id=data["customer_id"],
            customer_name=data["customer_name"],
            total_revenue=data["total_revenue"],
            total_cost=data["total_cost"],
            total_margin=margin,
            avg_margin_percent=round(margin_pct, 1),
            shipment_count=data["shipment_count"]
        ))
    by_customer.sort(key=lambda x: x.total_margin, reverse=True)

    # By Carrier
    carrier_data = {}
    for s in shipments:
        carrier_id = s.get("carrier_id")
        if not carrier_id:
            continue
        cid = str(carrier_id)
        if cid not in carrier_data:
            carrier_data[cid] = {
                "carrier_id": cid,
                "carrier_name": s.get("carrier_name") or "Unknown",
                "total_revenue": 0,
                "total_cost": 0,
                "shipment_count": 0
            }
        carrier_data[cid]["total_revenue"] += s.get("customer_price", 0) or 0
        carrier_data[cid]["total_cost"] += s.get("carrier_cost", 0) or 0
        carrier_data[cid]["shipment_count"] += 1

    by_carrier = []
    for cid, data in carrier_data.items():
        margin = data["total_revenue"] - data["total_cost"]
        margin_pct = (margin / data["total_revenue"] * 100) if data["total_revenue"] > 0 else 0
        by_carrier.append(CarrierMargin(
            carrier_id=data["carrier_id"],
            carrier_name=data["carrier_name"],
            total_revenue=data["total_revenue"],
            total_cost=data["total_cost"],
            total_margin=margin,
            avg_margin_percent=round(margin_pct, 1),
            shipment_count=data["shipment_count"]
        ))
    by_carrier.sort(key=lambda x: x.total_margin, reverse=True)

    # By Lane
    lane_data = {}
    for s in shipments:
        origin = f"{s.get('origin_city', 'Unknown')}, {s.get('origin_state', '??')}"
        dest = f"{s.get('dest_city', 'Unknown')}, {s.get('dest_state', '??')}"
        lane_key = f"{origin}|{dest}"

        if lane_key not in lane_data:
            lane_data[lane_key] = {
                "origin": origin,
                "destination": dest,
                "total_revenue": 0,
                "total_cost": 0,
                "shipment_count": 0
            }
        lane_data[lane_key]["total_revenue"] += s.get("customer_price", 0) or 0
        lane_data[lane_key]["total_cost"] += s.get("carrier_cost", 0) or 0
        lane_data[lane_key]["shipment_count"] += 1

    by_lane = []
    for key, data in lane_data.items():
        margin = data["total_revenue"] - data["total_cost"]
        margin_pct = (margin / data["total_revenue"] * 100) if data["total_revenue"] > 0 else 0
        by_lane.append(LaneMargin(
            origin=data["origin"],
            destination=data["destination"],
            total_revenue=data["total_revenue"],
            total_cost=data["total_cost"],
            total_margin=margin,
            avg_margin_percent=round(margin_pct, 1),
            shipment_count=data["shipment_count"]
        ))
    by_lane.sort(key=lambda x: x.total_margin, reverse=True)
    by_lane = by_lane[:20]  # Top 20 lanes

    # Trends by day
    trend_data = {}
    for s in shipments:
        date_str = s.get("created_at", datetime.utcnow()).strftime("%Y-%m-%d")
        if date_str not in trend_data:
            trend_data[date_str] = {
                "date": date_str,
                "total_revenue": 0,
                "total_cost": 0,
                "shipment_count": 0
            }
        trend_data[date_str]["total_revenue"] += s.get("customer_price", 0) or 0
        trend_data[date_str]["total_cost"] += s.get("carrier_cost", 0) or 0
        trend_data[date_str]["shipment_count"] += 1

    trends = []
    for date_str in sorted(trend_data.keys()):
        data = trend_data[date_str]
        margin = data["total_revenue"] - data["total_cost"]
        margin_pct = (margin / data["total_revenue"] * 100) if data["total_revenue"] > 0 else 0
        trends.append(MarginTrend(
            date=data["date"],
            total_revenue=data["total_revenue"],
            total_cost=data["total_cost"],
            total_margin=margin,
            avg_margin_percent=round(margin_pct, 1),
            shipment_count=data["shipment_count"]
        ))

    # Low margin shipments (below 10%)
    low_margin_shipments = []
    for s in shipments:
        margin_pct = s.get("margin_percent") or 0
        if margin_pct < 10:
            origin = f"{s.get('origin_city', 'Unknown')}, {s.get('origin_state', '??')}"
            dest = f"{s.get('dest_city', 'Unknown')}, {s.get('dest_state', '??')}"
            low_margin_shipments.append(LowMarginShipment(
                shipment_id=str(s["_id"]),
                shipment_number=s.get("shipment_number", ""),
                customer_name=s.get("customer_name"),
                carrier_name=s.get("carrier_name"),
                origin=origin,
                destination=dest,
                customer_price=s.get("customer_price", 0) or 0,
                carrier_cost=s.get("carrier_cost", 0) or 0,
                margin=s.get("margin", 0) or 0,
                margin_percent=margin_pct,
                created_at=s.get("created_at", datetime.utcnow())
            ))
    low_margin_shipments.sort(key=lambda x: x.margin_percent)
    low_margin_shipments = low_margin_shipments[:10]  # Top 10 lowest

    return MarginDashboardResponse(
        summary=summary,
        by_customer=by_customer[:10],  # Top 10
        by_carrier=by_carrier[:10],  # Top 10
        by_lane=by_lane,
        trends=trends,
        low_margin_shipments=low_margin_shipments
    )


@router.get("/carrier-performance", response_model=CarrierPerformanceResponse)
async def get_carrier_performance(days: int = 30):
    """Get carrier performance analytics."""
    db = get_database()

    # Calculate date range
    end_date = datetime.utcnow()
    start_date = end_date - timedelta(days=days)
    prev_start = start_date - timedelta(days=days)

    # Get all carriers
    carriers_cursor = db.carriers.find({"status": {"$ne": "do_not_use"}})
    all_carriers = await carriers_cursor.to_list(1000)
    carrier_map = {str(c["_id"]): c for c in all_carriers}

    # Get shipments in current period
    pipeline = [
        {
            "$match": {
                "created_at": {"$gte": start_date, "$lte": end_date},
                "carrier_id": {"$exists": True, "$ne": None}
            }
        },
        {
            "$lookup": {
                "from": "carriers",
                "localField": "carrier_id",
                "foreignField": "_id",
                "as": "carrier"
            }
        },
        {
            "$addFields": {
                "carrier_name": {"$arrayElemAt": ["$carrier.name", 0]},
                "mc_number": {"$arrayElemAt": ["$carrier.mc_number", 0]},
            }
        }
    ]
    cursor = db.shipments.aggregate(pipeline)
    shipments = await cursor.to_list(10000)

    # Get tenders for acceptance rate
    tenders_cursor = db.tenders.find({
        "created_at": {"$gte": start_date, "$lte": end_date}
    })
    tenders = await tenders_cursor.to_list(10000)

    # Get previous period shipments for trend calculation
    prev_pipeline = [
        {
            "$match": {
                "created_at": {"$gte": prev_start, "$lt": start_date},
                "carrier_id": {"$exists": True, "$ne": None}
            }
        }
    ]
    prev_cursor = db.shipments.aggregate(prev_pipeline)
    prev_shipments = await prev_cursor.to_list(10000)

    # Aggregate by carrier
    carrier_data = {}
    for s in shipments:
        carrier_id = s.get("carrier_id")
        if not carrier_id:
            continue
        cid = str(carrier_id)

        if cid not in carrier_data:
            carrier_data[cid] = {
                "carrier_id": cid,
                "carrier_name": s.get("carrier_name") or "Unknown",
                "mc_number": s.get("mc_number"),
                "shipment_count": 0,
                "on_time_count": 0,
                "late_count": 0,
                "total_miles": 0,
                "total_cost": 0,
                "exception_count": 0,
            }

        carrier_data[cid]["shipment_count"] += 1
        carrier_data[cid]["total_cost"] += s.get("carrier_cost", 0) or 0
        carrier_data[cid]["total_miles"] += s.get("total_miles", 0) or 0

        # Check delivery status
        status = s.get("status", "")
        if status == "delivered":
            # Check if delivered on time (simplified - actual delivery vs scheduled)
            delivered_at = s.get("delivered_at")
            scheduled_delivery = s.get("scheduled_delivery")
            if delivered_at and scheduled_delivery:
                if delivered_at <= scheduled_delivery:
                    carrier_data[cid]["on_time_count"] += 1
                else:
                    carrier_data[cid]["late_count"] += 1
            else:
                # Assume on-time if no dates to compare
                carrier_data[cid]["on_time_count"] += 1

    # Calculate tender acceptance rates
    tender_stats = {}
    for t in tenders:
        carrier_id = t.get("carrier_id")
        if not carrier_id:
            continue
        cid = str(carrier_id)
        if cid not in tender_stats:
            tender_stats[cid] = {"accepted": 0, "declined": 0, "total": 0}

        tender_stats[cid]["total"] += 1
        status = t.get("status", "")
        if status == "accepted":
            tender_stats[cid]["accepted"] += 1
        elif status == "declined":
            tender_stats[cid]["declined"] += 1

    # Calculate previous period performance for trend
    prev_carrier_data = {}
    for s in prev_shipments:
        carrier_id = s.get("carrier_id")
        if not carrier_id:
            continue
        cid = str(carrier_id)
        if cid not in prev_carrier_data:
            prev_carrier_data[cid] = {"shipment_count": 0, "on_time_count": 0}
        prev_carrier_data[cid]["shipment_count"] += 1
        status = s.get("status", "")
        if status == "delivered":
            prev_carrier_data[cid]["on_time_count"] += 1

    # Build carrier performance list
    carriers_list = []
    for cid, data in carrier_data.items():
        tender_info = tender_stats.get(cid, {"accepted": 0, "declined": 0, "total": 0})
        tender_rate = (tender_info["accepted"] / tender_info["total"] * 100) if tender_info["total"] > 0 else 100

        on_time_rate = (data["on_time_count"] / data["shipment_count"] * 100) if data["shipment_count"] > 0 else 100
        avg_cost_per_mile = (data["total_cost"] / data["total_miles"]) if data["total_miles"] > 0 else 0

        # Calculate composite performance score (weighted average)
        # 40% on-time, 30% tender acceptance, 20% cost efficiency, 10% volume
        cost_score = max(0, 100 - (avg_cost_per_mile / 2))  # Lower cost = higher score
        volume_score = min(100, data["shipment_count"] * 10)  # More shipments = higher score (max 10 shipments)

        performance_score = (
            on_time_rate * 0.4 +
            tender_rate * 0.3 +
            cost_score * 0.2 +
            volume_score * 0.1
        )

        # Calculate trend
        prev_data = prev_carrier_data.get(cid)
        if prev_data and prev_data["shipment_count"] > 0:
            prev_on_time_rate = (prev_data["on_time_count"] / prev_data["shipment_count"] * 100)
            if on_time_rate > prev_on_time_rate + 5:
                trend = "improving"
            elif on_time_rate < prev_on_time_rate - 5:
                trend = "declining"
            else:
                trend = "stable"
        else:
            trend = "stable"

        carriers_list.append(CarrierPerformanceDetail(
            carrier_id=cid,
            carrier_name=data["carrier_name"],
            mc_number=data["mc_number"],
            shipment_count=data["shipment_count"],
            on_time_delivery_count=data["on_time_count"],
            on_time_rate=round(on_time_rate, 1),
            late_delivery_count=data["late_count"],
            tender_accepted_count=tender_info["accepted"],
            tender_declined_count=tender_info["declined"],
            tender_acceptance_rate=round(tender_rate, 1),
            avg_cost_per_mile=round(avg_cost_per_mile, 2),
            total_miles=data["total_miles"],
            total_cost=data["total_cost"],
            exception_count=data["exception_count"],
            performance_score=round(performance_score, 1),
            trend=trend
        ))

    # Sort by performance score
    carriers_list.sort(key=lambda x: x.performance_score, reverse=True)

    # Calculate summary
    active_carriers = len(carriers_list)
    avg_on_time = sum(c.on_time_rate for c in carriers_list) / active_carriers if active_carriers > 0 else 0
    avg_tender = sum(c.tender_acceptance_rate for c in carriers_list) / active_carriers if active_carriers > 0 else 0

    top_performer = carriers_list[0] if carriers_list else None

    summary = CarrierPerformanceSummary(
        total_carriers=len(all_carriers),
        active_carriers=active_carriers,
        avg_on_time_rate=round(avg_on_time, 1),
        avg_tender_acceptance=round(avg_tender, 1),
        top_performer_id=top_performer.carrier_id if top_performer else None,
        top_performer_name=top_performer.carrier_name if top_performer else None
    )

    # Calculate daily trends
    trend_data = {}
    for s in shipments:
        date_str = s.get("created_at", datetime.utcnow()).strftime("%Y-%m-%d")
        if date_str not in trend_data:
            trend_data[date_str] = {
                "date": date_str,
                "on_time_count": 0,
                "total_count": 0,
                "total_cost": 0,
                "total_miles": 0
            }
        trend_data[date_str]["total_count"] += 1
        trend_data[date_str]["total_cost"] += s.get("carrier_cost", 0) or 0
        trend_data[date_str]["total_miles"] += s.get("total_miles", 0) or 0
        if s.get("status") == "delivered":
            trend_data[date_str]["on_time_count"] += 1

    trends = []
    for date_str in sorted(trend_data.keys()):
        data = trend_data[date_str]
        on_time_rate = (data["on_time_count"] / data["total_count"] * 100) if data["total_count"] > 0 else 100
        avg_cpm = (data["total_cost"] / data["total_miles"]) if data["total_miles"] > 0 else 0
        trends.append(CarrierPerformanceTrend(
            date=date_str,
            on_time_rate=round(on_time_rate, 1),
            shipment_count=data["total_count"],
            avg_cost_per_mile=round(avg_cpm, 2)
        ))

    return CarrierPerformanceResponse(
        summary=summary,
        carriers=carriers_list[:20],  # Top 20 carriers
        trends=trends
    )
