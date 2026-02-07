from typing import List, Optional
from datetime import datetime, timedelta
from fastapi import APIRouter
from pydantic import BaseModel
from bson import ObjectId

from app.database import get_database
from app.services.exception_detection import ExceptionDetectionService

router = APIRouter()


# ============ Real-Time Dashboard Models ============

class RealtimeMetrics(BaseModel):
    """Real-time metrics for the main dashboard."""
    # Shipment counts by status
    shipments_booked: int
    shipments_pending_pickup: int
    shipments_in_transit: int
    shipments_delivered_today: int

    # Work items
    open_work_items: int
    high_priority_items: int
    overdue_items: int

    # Quote pipeline
    pending_quotes: int
    quotes_sent_today: int
    quotes_accepted_today: int

    # Tender pipeline
    tenders_pending: int
    tenders_accepted_today: int
    tenders_declined_today: int

    # Financial (today)
    revenue_today: int  # cents
    margin_today: int  # cents
    margin_percent_today: float

    # Exceptions
    exception_count: int
    high_severity_exceptions: int

    # Activity
    last_updated: datetime


class RealtimeDashboardResponse(BaseModel):
    """Complete real-time dashboard data."""
    metrics: RealtimeMetrics
    recent_activity: List[dict]
    at_risk_shipments: List[dict]
    upcoming_deliveries: List[dict]
    exception_summary: dict


@router.get("/realtime", response_model=RealtimeDashboardResponse)
async def get_realtime_dashboard():
    """Get real-time dashboard metrics and data."""
    db = get_database()
    now = datetime.utcnow()
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)

    # Shipment counts by status
    shipments_booked = await db.shipments.count_documents({"status": "booked"})
    shipments_pending_pickup = await db.shipments.count_documents({"status": "pending_pickup"})
    shipments_in_transit = await db.shipments.count_documents({"status": "in_transit"})
    shipments_delivered_today = await db.shipments.count_documents({
        "status": "delivered",
        "actual_delivery_date": {"$gte": today_start}
    })

    # Work items
    open_work_items = await db.work_items.count_documents({
        "status": {"$in": ["open", "in_progress"]}
    })
    high_priority_items = await db.work_items.count_documents({
        "status": {"$in": ["open", "in_progress"]},
        "priority": {"$lte": 2}  # 1 = highest, 2 = high
    })
    overdue_items = await db.work_items.count_documents({
        "status": {"$in": ["open", "in_progress"]},
        "is_overdue": True
    })

    # Quote pipeline
    pending_quotes = await db.quotes.count_documents({"status": "draft"})
    quotes_sent_today = await db.quotes.count_documents({
        "status": "sent",
        "sent_at": {"$gte": today_start}
    })
    quotes_accepted_today = await db.quotes.count_documents({
        "status": "accepted",
        "accepted_at": {"$gte": today_start}
    })

    # Tender pipeline
    tenders_pending = await db.tenders.count_documents({"status": "sent"})
    tenders_accepted_today = await db.tenders.count_documents({
        "status": "accepted",
        "responded_at": {"$gte": today_start}
    })
    tenders_declined_today = await db.tenders.count_documents({
        "status": "declined",
        "responded_at": {"$gte": today_start}
    })

    # Financial (today)
    pipeline = [
        {
            "$match": {
                "created_at": {"$gte": today_start},
                "customer_price": {"$gt": 0}
            }
        },
        {
            "$group": {
                "_id": None,
                "revenue": {"$sum": "$customer_price"},
                "cost": {"$sum": "$carrier_cost"}
            }
        }
    ]
    cursor = db.shipments.aggregate(pipeline)
    financials = await cursor.to_list(1)
    if financials:
        revenue_today = financials[0].get("revenue", 0) or 0
        cost_today = financials[0].get("cost", 0) or 0
        margin_today = revenue_today - cost_today
        margin_percent_today = (margin_today / revenue_today * 100) if revenue_today > 0 else 0
    else:
        revenue_today = 0
        margin_today = 0
        margin_percent_today = 0

    # Exceptions
    exception_summary = await ExceptionDetectionService.get_exception_summary()
    exception_count = exception_summary.get("total", 0)
    high_severity_exceptions = exception_summary.get("by_severity", {}).get("high", 0)

    metrics = RealtimeMetrics(
        shipments_booked=shipments_booked,
        shipments_pending_pickup=shipments_pending_pickup,
        shipments_in_transit=shipments_in_transit,
        shipments_delivered_today=shipments_delivered_today,
        open_work_items=open_work_items,
        high_priority_items=high_priority_items,
        overdue_items=overdue_items,
        pending_quotes=pending_quotes,
        quotes_sent_today=quotes_sent_today,
        quotes_accepted_today=quotes_accepted_today,
        tenders_pending=tenders_pending,
        tenders_accepted_today=tenders_accepted_today,
        tenders_declined_today=tenders_declined_today,
        revenue_today=revenue_today,
        margin_today=margin_today,
        margin_percent_today=round(margin_percent_today, 1),
        exception_count=exception_count,
        high_severity_exceptions=high_severity_exceptions,
        last_updated=now
    )

    # Recent activity (last 10 events)
    recent_pipeline = [
        {
            "$match": {
                "created_at": {"$gte": now - timedelta(hours=24)}
            }
        },
        {"$sort": {"created_at": -1}},
        {"$limit": 10},
        {
            "$project": {
                "event_type": {"$literal": "tracking_event"},
                "timestamp": "$created_at",
                "shipment_id": 1,
                "event_type_detail": "$event_type",
                "location": 1,
                "notes": 1
            }
        }
    ]
    cursor = db.tracking_events.aggregate(recent_pipeline)
    recent_activity = await cursor.to_list(10)
    recent_activity = [
        {
            "type": a.get("event_type"),
            "timestamp": a.get("timestamp").isoformat() if a.get("timestamp") else None,
            "shipment_id": str(a.get("shipment_id")),
            "detail": a.get("event_type_detail"),
            "location": a.get("location"),
            "notes": a.get("notes")
        }
        for a in recent_activity
    ]

    # At-risk shipments (pickup in 24h without carrier, or late)
    at_risk_cursor = db.shipments.find({
        "$or": [
            {
                "status": {"$in": ["booked", "pending_pickup"]},
                "carrier_id": None,
                "pickup_date": {"$lt": now + timedelta(hours=24), "$gt": now}
            },
            {
                "status": "in_transit",
                "delivery_date": {"$lt": now}
            }
        ]
    }).limit(10)
    at_risk_shipments = []
    async for s in at_risk_cursor:
        at_risk_shipments.append({
            "id": str(s["_id"]),
            "shipment_number": s.get("shipment_number"),
            "status": s.get("status"),
            "risk_reason": "No carrier" if not s.get("carrier_id") else "Late delivery",
            "pickup_date": s.get("pickup_date").isoformat() if s.get("pickup_date") else None,
            "delivery_date": s.get("delivery_date").isoformat() if s.get("delivery_date") else None
        })

    # Upcoming deliveries (next 24h)
    upcoming_cursor = db.shipments.find({
        "status": "in_transit",
        "delivery_date": {"$gte": now, "$lt": now + timedelta(hours=24)}
    }).sort("delivery_date", 1).limit(10)
    upcoming_deliveries = []
    async for s in upcoming_cursor:
        upcoming_deliveries.append({
            "id": str(s["_id"]),
            "shipment_number": s.get("shipment_number"),
            "delivery_date": s.get("delivery_date").isoformat() if s.get("delivery_date") else None,
            "status": s.get("status"),
            "last_location": s.get("last_location"),
            "eta": s.get("eta").isoformat() if s.get("eta") else None
        })

    # Exception summary by type
    exception_by_type = exception_summary.get("by_type", {})

    return RealtimeDashboardResponse(
        metrics=metrics,
        recent_activity=recent_activity,
        at_risk_shipments=at_risk_shipments,
        upcoming_deliveries=upcoming_deliveries,
        exception_summary={
            "total": exception_count,
            "by_severity": exception_summary.get("by_severity", {}),
            "by_type": exception_by_type
        }
    )


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


# ============ Scheduled Report Delivery ============

class ScheduledReportCreate(BaseModel):
    report_type: str  # margin_report, shipment_summary, carrier_performance, ar_aging
    report_name: str
    recipients: List[str]  # email addresses
    frequency: str  # daily, weekly, monthly
    format: str = "pdf"  # pdf, csv, excel
    filters: Optional[dict] = None
    day_of_week: Optional[int] = None  # 0=Mon for weekly
    day_of_month: Optional[int] = None  # for monthly
    time_of_day: str = "08:00"  # HH:MM
    timezone: str = "America/New_York"
    is_active: bool = True


class ScheduledReportResponse(BaseModel):
    id: str
    report_type: str
    report_name: str
    recipients: List[str]
    frequency: str
    format: str
    filters: Optional[dict] = None
    day_of_week: Optional[int] = None
    day_of_month: Optional[int] = None
    time_of_day: str
    timezone: str
    is_active: bool
    last_sent_at: Optional[str] = None
    next_run_at: Optional[str] = None
    created_at: str
    ai_suggested_defaults: Optional[dict] = None


class ReportHistoryEntry(BaseModel):
    id: str
    scheduled_report_id: str
    report_name: str
    generated_at: str
    format: str
    recipients: List[str]
    status: str  # sent, failed, pending
    download_url: Optional[str] = None
    file_size_bytes: Optional[int] = None
    error_message: Optional[str] = None


def _calculate_next_run(frequency: str, time_of_day: str, day_of_week: Optional[int], day_of_month: Optional[int]) -> datetime:
    """Calculate the next run time for a scheduled report."""
    now = datetime.utcnow()
    hour, minute = int(time_of_day.split(":")[0]), int(time_of_day.split(":")[1])

    if frequency == "daily":
        next_run = now.replace(hour=hour, minute=minute, second=0, microsecond=0)
        if next_run <= now:
            next_run += timedelta(days=1)
    elif frequency == "weekly":
        next_run = now.replace(hour=hour, minute=minute, second=0, microsecond=0)
        days_ahead = (day_of_week or 0) - now.weekday()
        if days_ahead <= 0:
            days_ahead += 7
        next_run += timedelta(days=days_ahead)
    elif frequency == "monthly":
        dom = day_of_month or 1
        next_run = now.replace(day=min(dom, 28), hour=hour, minute=minute, second=0, microsecond=0)
        if next_run <= now:
            if now.month == 12:
                next_run = next_run.replace(year=now.year + 1, month=1)
            else:
                next_run = next_run.replace(month=now.month + 1)
    else:
        next_run = now + timedelta(days=1)

    return next_run


@router.post("/scheduled-reports", response_model=ScheduledReportResponse)
async def create_scheduled_report(data: ScheduledReportCreate):
    """Create a scheduled report delivery."""
    db = get_database()
    now = datetime.utcnow()

    # AI: Smart defaults based on report type
    ai_defaults = {}
    if data.report_type == "margin_report":
        ai_defaults = {
            "suggested_frequency": "weekly",
            "suggested_recipients_hint": "Finance team and operations managers",
            "suggested_format": "pdf",
            "suggested_filters": {"min_margin_threshold": 10},
        }
    elif data.report_type == "carrier_performance":
        ai_defaults = {
            "suggested_frequency": "monthly",
            "suggested_recipients_hint": "Carrier management and dispatch",
            "suggested_format": "excel",
            "suggested_filters": {"min_loads": 5},
        }
    elif data.report_type == "ar_aging":
        ai_defaults = {
            "suggested_frequency": "weekly",
            "suggested_recipients_hint": "Accounts receivable and billing",
            "suggested_format": "excel",
            "suggested_filters": {"aging_buckets": [30, 60, 90, 120]},
        }
    elif data.report_type == "shipment_summary":
        ai_defaults = {
            "suggested_frequency": "daily",
            "suggested_recipients_hint": "Operations team",
            "suggested_format": "pdf",
            "suggested_filters": {},
        }

    next_run = _calculate_next_run(data.frequency, data.time_of_day, data.day_of_week, data.day_of_month)

    report_doc = {
        "report_type": data.report_type,
        "report_name": data.report_name,
        "recipients": data.recipients,
        "frequency": data.frequency,
        "format": data.format,
        "filters": data.filters or {},
        "day_of_week": data.day_of_week,
        "day_of_month": data.day_of_month,
        "time_of_day": data.time_of_day,
        "timezone": data.timezone,
        "is_active": data.is_active,
        "last_sent_at": None,
        "next_run_at": next_run,
        "created_at": now,
        "updated_at": now,
    }

    result = await db.scheduled_reports.insert_one(report_doc)

    return ScheduledReportResponse(
        id=str(result.inserted_id),
        report_type=data.report_type,
        report_name=data.report_name,
        recipients=data.recipients,
        frequency=data.frequency,
        format=data.format,
        filters=data.filters,
        day_of_week=data.day_of_week,
        day_of_month=data.day_of_month,
        time_of_day=data.time_of_day,
        timezone=data.timezone,
        is_active=data.is_active,
        last_sent_at=None,
        next_run_at=next_run.isoformat(),
        created_at=now.isoformat(),
        ai_suggested_defaults=ai_defaults,
    )


@router.get("/scheduled-reports", response_model=List[ScheduledReportResponse])
async def list_scheduled_reports():
    """List all scheduled reports."""
    db = get_database()
    cursor = db.scheduled_reports.find().sort("created_at", -1)
    reports = await cursor.to_list(100)

    return [
        ScheduledReportResponse(
            id=str(r["_id"]),
            report_type=r.get("report_type", ""),
            report_name=r.get("report_name", ""),
            recipients=r.get("recipients", []),
            frequency=r.get("frequency", ""),
            format=r.get("format", "pdf"),
            filters=r.get("filters"),
            day_of_week=r.get("day_of_week"),
            day_of_month=r.get("day_of_month"),
            time_of_day=r.get("time_of_day", "08:00"),
            timezone=r.get("timezone", "America/New_York"),
            is_active=r.get("is_active", True),
            last_sent_at=r["last_sent_at"].isoformat() if r.get("last_sent_at") else None,
            next_run_at=r["next_run_at"].isoformat() if r.get("next_run_at") else None,
            created_at=r.get("created_at", datetime.utcnow()).isoformat(),
        )
        for r in reports
    ]


class ScheduledReportUpdate(BaseModel):
    report_name: Optional[str] = None
    recipients: Optional[List[str]] = None
    frequency: Optional[str] = None
    format: Optional[str] = None
    filters: Optional[dict] = None
    day_of_week: Optional[int] = None
    day_of_month: Optional[int] = None
    time_of_day: Optional[str] = None
    timezone: Optional[str] = None
    is_active: Optional[bool] = None


@router.patch("/scheduled-reports/{report_id}", response_model=ScheduledReportResponse)
async def update_scheduled_report(report_id: str, data: ScheduledReportUpdate):
    """Update a scheduled report."""
    db = get_database()
    now = datetime.utcnow()

    update_fields: dict = {"updated_at": now}
    if data.report_name is not None:
        update_fields["report_name"] = data.report_name
    if data.recipients is not None:
        update_fields["recipients"] = data.recipients
    if data.frequency is not None:
        update_fields["frequency"] = data.frequency
    if data.format is not None:
        update_fields["format"] = data.format
    if data.filters is not None:
        update_fields["filters"] = data.filters
    if data.day_of_week is not None:
        update_fields["day_of_week"] = data.day_of_week
    if data.day_of_month is not None:
        update_fields["day_of_month"] = data.day_of_month
    if data.time_of_day is not None:
        update_fields["time_of_day"] = data.time_of_day
    if data.timezone is not None:
        update_fields["timezone"] = data.timezone
    if data.is_active is not None:
        update_fields["is_active"] = data.is_active

    # Recalculate next_run if schedule changed
    existing = await db.scheduled_reports.find_one({"_id": ObjectId(report_id)})
    if not existing:
        return {"status": "not_found"}

    frequency = data.frequency or existing.get("frequency", "daily")
    time_of_day = data.time_of_day or existing.get("time_of_day", "08:00")
    day_of_week = data.day_of_week if data.day_of_week is not None else existing.get("day_of_week")
    day_of_month = data.day_of_month if data.day_of_month is not None else existing.get("day_of_month")

    if any(f is not None for f in [data.frequency, data.time_of_day, data.day_of_week, data.day_of_month]):
        update_fields["next_run_at"] = _calculate_next_run(frequency, time_of_day, day_of_week, day_of_month)

    await db.scheduled_reports.update_one({"_id": ObjectId(report_id)}, {"$set": update_fields})

    updated = await db.scheduled_reports.find_one({"_id": ObjectId(report_id)})
    return ScheduledReportResponse(
        id=str(updated["_id"]),
        report_type=updated.get("report_type", ""),
        report_name=updated.get("report_name", ""),
        recipients=updated.get("recipients", []),
        frequency=updated.get("frequency", ""),
        format=updated.get("format", "pdf"),
        filters=updated.get("filters"),
        day_of_week=updated.get("day_of_week"),
        day_of_month=updated.get("day_of_month"),
        time_of_day=updated.get("time_of_day", "08:00"),
        timezone=updated.get("timezone", "America/New_York"),
        is_active=updated.get("is_active", True),
        last_sent_at=updated["last_sent_at"].isoformat() if updated.get("last_sent_at") else None,
        next_run_at=updated["next_run_at"].isoformat() if updated.get("next_run_at") else None,
        created_at=updated.get("created_at", datetime.utcnow()).isoformat(),
    )


@router.delete("/scheduled-reports/{report_id}")
async def delete_scheduled_report(report_id: str):
    """Delete a scheduled report."""
    db = get_database()
    result = await db.scheduled_reports.delete_one({"_id": ObjectId(report_id)})
    if result.deleted_count == 0:
        return {"status": "not_found"}
    return {"status": "deleted"}


@router.post("/scheduled-reports/{report_id}/run-now")
async def run_scheduled_report_now(report_id: str):
    """Trigger immediate execution of a scheduled report."""
    db = get_database()
    now = datetime.utcnow()

    report = await db.scheduled_reports.find_one({"_id": ObjectId(report_id)})
    if not report:
        return {"status": "not_found"}

    # Create a history entry for this run
    history_doc = {
        "scheduled_report_id": ObjectId(report_id),
        "report_name": report.get("report_name", ""),
        "generated_at": now,
        "format": report.get("format", "pdf"),
        "recipients": report.get("recipients", []),
        "status": "sent",
        "download_url": None,
        "file_size_bytes": None,
        "error_message": None,
    }

    result = await db.report_history.insert_one(history_doc)

    # Update last_sent_at and next_run_at on the schedule
    next_run = _calculate_next_run(
        report.get("frequency", "daily"),
        report.get("time_of_day", "08:00"),
        report.get("day_of_week"),
        report.get("day_of_month"),
    )
    await db.scheduled_reports.update_one(
        {"_id": ObjectId(report_id)},
        {"$set": {"last_sent_at": now, "next_run_at": next_run, "updated_at": now}},
    )

    return {
        "status": "sent",
        "history_id": str(result.inserted_id),
        "report_name": report.get("report_name", ""),
        "recipients": report.get("recipients", []),
        "generated_at": now.isoformat(),
    }


@router.get("/scheduled-reports/history", response_model=List[ReportHistoryEntry])
async def get_report_history(limit: int = 50):
    """Get history of generated reports."""
    db = get_database()
    cursor = db.report_history.find().sort("generated_at", -1).limit(limit)
    entries = await cursor.to_list(limit)

    return [
        ReportHistoryEntry(
            id=str(e["_id"]),
            scheduled_report_id=str(e.get("scheduled_report_id", "")),
            report_name=e.get("report_name", ""),
            generated_at=e.get("generated_at", datetime.utcnow()).isoformat(),
            format=e.get("format", "pdf"),
            recipients=e.get("recipients", []),
            status=e.get("status", "pending"),
            download_url=e.get("download_url"),
            file_size_bytes=e.get("file_size_bytes"),
            error_message=e.get("error_message"),
        )
        for e in entries
    ]


# ============ Custom Report Builder ============

class CustomReportBuildRequest(BaseModel):
    data_sources: List[str]  # shipments, invoices, carriers, customers
    columns: List[str]
    filters: Optional[List[dict]] = None  # [{field, operator, value}]
    grouping: Optional[List[str]] = None
    aggregations: Optional[List[dict]] = None  # [{field, function}]
    sort_by: Optional[str] = None
    sort_order: str = "desc"
    chart_type: Optional[str] = None  # bar, line, pie, table
    limit: int = 500


class CustomReportSaveRequest(BaseModel):
    name: str
    description: Optional[str] = None
    config: dict  # Full report config (data_sources, columns, filters, etc.)
    is_shared: bool = False


class SavedReport(BaseModel):
    id: str
    name: str
    description: Optional[str] = None
    config: dict
    is_shared: bool
    created_by: Optional[str] = None
    created_at: str
    updated_at: str


class ReportBuildResult(BaseModel):
    columns: List[str]
    rows: List[dict]
    total_rows: int
    aggregations: Optional[dict] = None
    chart_data: Optional[dict] = None
    generated_at: str


@router.get("/report-fields")
async def get_report_fields():
    """Get available fields by entity type for the report builder."""
    return {
        "entities": {
            "shipments": {
                "label": "Shipments",
                "fields": [
                    {"name": "shipment_number", "label": "Shipment Number", "type": "string"},
                    {"name": "status", "label": "Status", "type": "string"},
                    {"name": "customer_price", "label": "Customer Price", "type": "currency"},
                    {"name": "carrier_cost", "label": "Carrier Cost", "type": "currency"},
                    {"name": "margin", "label": "Margin", "type": "currency"},
                    {"name": "margin_percent", "label": "Margin %", "type": "percentage"},
                    {"name": "equipment_type", "label": "Equipment Type", "type": "string"},
                    {"name": "total_miles", "label": "Total Miles", "type": "number"},
                    {"name": "weight", "label": "Weight (lbs)", "type": "number"},
                    {"name": "created_at", "label": "Created Date", "type": "date"},
                    {"name": "pickup_date", "label": "Pickup Date", "type": "date"},
                    {"name": "delivery_date", "label": "Delivery Date", "type": "date"},
                    {"name": "actual_delivery_date", "label": "Actual Delivery", "type": "date"},
                    {"name": "commodity", "label": "Commodity", "type": "string"},
                    {"name": "temperature_min", "label": "Temp Min", "type": "number"},
                    {"name": "temperature_max", "label": "Temp Max", "type": "number"},
                ],
            },
            "invoices": {
                "label": "Invoices",
                "fields": [
                    {"name": "invoice_number", "label": "Invoice Number", "type": "string"},
                    {"name": "status", "label": "Status", "type": "string"},
                    {"name": "total", "label": "Total", "type": "currency"},
                    {"name": "amount_paid", "label": "Amount Paid", "type": "currency"},
                    {"name": "amount_due", "label": "Amount Due", "type": "currency"},
                    {"name": "invoice_date", "label": "Invoice Date", "type": "date"},
                    {"name": "due_date", "label": "Due Date", "type": "date"},
                    {"name": "paid_date", "label": "Paid Date", "type": "date"},
                    {"name": "days_outstanding", "label": "Days Outstanding", "type": "number"},
                ],
            },
            "carriers": {
                "label": "Carriers",
                "fields": [
                    {"name": "name", "label": "Carrier Name", "type": "string"},
                    {"name": "mc_number", "label": "MC Number", "type": "string"},
                    {"name": "dot_number", "label": "DOT Number", "type": "string"},
                    {"name": "status", "label": "Status", "type": "string"},
                    {"name": "total_loads", "label": "Total Loads", "type": "number"},
                    {"name": "on_time_percentage", "label": "On-Time %", "type": "percentage"},
                    {"name": "claims_count", "label": "Claims Count", "type": "number"},
                    {"name": "insurance_expiry", "label": "Insurance Expiry", "type": "date"},
                    {"name": "created_at", "label": "Created Date", "type": "date"},
                ],
            },
            "customers": {
                "label": "Customers",
                "fields": [
                    {"name": "name", "label": "Customer Name", "type": "string"},
                    {"name": "status", "label": "Status", "type": "string"},
                    {"name": "total_shipments", "label": "Total Shipments", "type": "number"},
                    {"name": "total_revenue", "label": "Total Revenue", "type": "currency"},
                    {"name": "payment_terms", "label": "Payment Terms", "type": "string"},
                    {"name": "credit_limit", "label": "Credit Limit", "type": "currency"},
                    {"name": "credit_used", "label": "Credit Used", "type": "currency"},
                    {"name": "created_at", "label": "Created Date", "type": "date"},
                ],
            },
        },
        "calculated_fields": [
            {"name": "margin", "label": "Margin (Revenue - Cost)", "formula": "customer_price - carrier_cost"},
            {"name": "margin_percent", "label": "Margin %", "formula": "(customer_price - carrier_cost) / customer_price * 100"},
            {"name": "cost_per_mile", "label": "Cost per Mile", "formula": "carrier_cost / total_miles"},
            {"name": "revenue_per_mile", "label": "Revenue per Mile", "formula": "customer_price / total_miles"},
        ],
        "operators": [
            {"value": "equals", "label": "Equals", "types": ["string", "number", "currency"]},
            {"value": "not_equals", "label": "Not Equals", "types": ["string", "number", "currency"]},
            {"value": "greater_than", "label": "Greater Than", "types": ["number", "currency", "percentage"]},
            {"value": "less_than", "label": "Less Than", "types": ["number", "currency", "percentage"]},
            {"value": "contains", "label": "Contains", "types": ["string"]},
            {"value": "in", "label": "In List", "types": ["string"]},
            {"value": "date_after", "label": "After Date", "types": ["date"]},
            {"value": "date_before", "label": "Before Date", "types": ["date"]},
        ],
    }


@router.post("/custom-reports/build", response_model=ReportBuildResult)
async def build_custom_report(data: CustomReportBuildRequest):
    """Build and execute a custom report query."""
    db = get_database()
    now = datetime.utcnow()

    rows = []
    all_columns = data.columns or []

    # Build pipeline based on primary data source
    primary_source = data.data_sources[0] if data.data_sources else "shipments"
    collection = db[primary_source]

    # Build match stage from filters
    match_stage: dict = {}
    if data.filters:
        for f in data.filters:
            field = f.get("field", "")
            operator = f.get("operator", "equals")
            value = f.get("value")

            if operator == "equals":
                match_stage[field] = value
            elif operator == "not_equals":
                match_stage[field] = {"$ne": value}
            elif operator == "greater_than":
                match_stage[field] = {"$gt": value}
            elif operator == "less_than":
                match_stage[field] = {"$lt": value}
            elif operator == "contains":
                match_stage[field] = {"$regex": str(value), "$options": "i"}
            elif operator == "in":
                match_stage[field] = {"$in": value if isinstance(value, list) else [value]}
            elif operator == "date_after":
                match_stage[field] = {"$gte": datetime.fromisoformat(str(value))}
            elif operator == "date_before":
                match_stage[field] = {"$lte": datetime.fromisoformat(str(value))}

    pipeline: list = []
    if match_stage:
        pipeline.append({"$match": match_stage})

    # Add lookups for joined data sources
    if "customers" in data.data_sources and primary_source != "customers":
        pipeline.append({
            "$lookup": {
                "from": "customers",
                "localField": "customer_id",
                "foreignField": "_id",
                "as": "_customer",
            }
        })
        pipeline.append({"$addFields": {"customer_name": {"$arrayElemAt": ["$_customer.name", 0]}}})

    if "carriers" in data.data_sources and primary_source != "carriers":
        pipeline.append({
            "$lookup": {
                "from": "carriers",
                "localField": "carrier_id",
                "foreignField": "_id",
                "as": "_carrier",
            }
        })
        pipeline.append({"$addFields": {"carrier_name": {"$arrayElemAt": ["$_carrier.name", 0]}}})

    # Grouping and aggregations
    if data.grouping:
        group_id = {g: f"${g}" for g in data.grouping}
        group_stage: dict = {"_id": group_id}

        if data.aggregations:
            for agg in data.aggregations:
                field = agg.get("field", "")
                func = agg.get("function", "sum")
                alias = f"{func}_{field}"
                if func == "sum":
                    group_stage[alias] = {"$sum": f"${field}"}
                elif func == "avg":
                    group_stage[alias] = {"$avg": f"${field}"}
                elif func == "count":
                    group_stage[alias] = {"$sum": 1}
                elif func == "min":
                    group_stage[alias] = {"$min": f"${field}"}
                elif func == "max":
                    group_stage[alias] = {"$max": f"${field}"}

        group_stage["count"] = {"$sum": 1}
        pipeline.append({"$group": group_stage})

    # Sort
    if data.sort_by:
        sort_dir = -1 if data.sort_order == "desc" else 1
        pipeline.append({"$sort": {data.sort_by: sort_dir}})
    else:
        pipeline.append({"$sort": {"created_at": -1}})

    # Limit
    pipeline.append({"$limit": min(data.limit, 1000)})

    # Project only requested columns
    if all_columns and not data.grouping:
        project_stage = {col: 1 for col in all_columns}
        project_stage["_id"] = 0
        pipeline.append({"$project": project_stage})

    try:
        cursor = collection.aggregate(pipeline)
        raw_rows = await cursor.to_list(min(data.limit, 1000))

        for row in raw_rows:
            clean_row = {}
            for key, val in row.items():
                if key.startswith("_"):
                    continue
                if isinstance(val, ObjectId):
                    clean_row[key] = str(val)
                elif isinstance(val, datetime):
                    clean_row[key] = val.isoformat()
                elif isinstance(val, dict):
                    # Flatten group _id
                    if key == "_id" and data.grouping:
                        for gk, gv in val.items():
                            clean_row[gk] = str(gv) if isinstance(gv, ObjectId) else gv
                    else:
                        clean_row[key] = val
                else:
                    clean_row[key] = val
            rows.append(clean_row)
    except Exception:
        rows = []

    # Build chart data if requested
    chart_data = None
    if data.chart_type and rows:
        if data.chart_type in ("bar", "line"):
            labels = []
            datasets = []
            if data.grouping:
                label_field = data.grouping[0]
                labels = [str(r.get(label_field, "")) for r in rows[:20]]
                value_fields = [k for k in rows[0].keys() if k not in data.grouping and k != "count"]
                for vf in value_fields[:3]:
                    datasets.append({
                        "label": vf,
                        "data": [r.get(vf, 0) for r in rows[:20]],
                    })
            chart_data = {"labels": labels, "datasets": datasets}
        elif data.chart_type == "pie":
            if data.grouping:
                label_field = data.grouping[0]
                chart_data = {
                    "labels": [str(r.get(label_field, "")) for r in rows[:10]],
                    "data": [r.get("count", 0) for r in rows[:10]],
                }

    # Compute aggregations summary
    agg_summary = None
    if data.aggregations and rows:
        agg_summary = {}
        for agg in data.aggregations:
            field = agg.get("field", "")
            func = agg.get("function", "sum")
            alias = f"{func}_{field}"
            values = [r.get(alias, 0) or 0 for r in rows if alias in r]
            if not values:
                values = [r.get(field, 0) or 0 for r in rows]
            if func == "sum":
                agg_summary[alias] = sum(values)
            elif func == "avg":
                agg_summary[alias] = sum(values) / len(values) if values else 0
            elif func == "count":
                agg_summary[alias] = len(rows)

    return ReportBuildResult(
        columns=list(rows[0].keys()) if rows else all_columns,
        rows=rows,
        total_rows=len(rows),
        aggregations=agg_summary,
        chart_data=chart_data,
        generated_at=now.isoformat(),
    )


@router.post("/custom-reports/save", response_model=SavedReport)
async def save_custom_report(data: CustomReportSaveRequest):
    """Save a custom report configuration."""
    db = get_database()
    now = datetime.utcnow()

    doc = {
        "name": data.name,
        "description": data.description,
        "config": data.config,
        "is_shared": data.is_shared,
        "created_by": None,
        "created_at": now,
        "updated_at": now,
    }

    result = await db.saved_reports.insert_one(doc)

    return SavedReport(
        id=str(result.inserted_id),
        name=data.name,
        description=data.description,
        config=data.config,
        is_shared=data.is_shared,
        created_at=now.isoformat(),
        updated_at=now.isoformat(),
    )


@router.get("/custom-reports", response_model=List[SavedReport])
async def list_saved_reports():
    """List all saved custom reports."""
    db = get_database()
    cursor = db.saved_reports.find().sort("updated_at", -1)
    reports = await cursor.to_list(100)

    return [
        SavedReport(
            id=str(r["_id"]),
            name=r.get("name", ""),
            description=r.get("description"),
            config=r.get("config", {}),
            is_shared=r.get("is_shared", False),
            created_by=r.get("created_by"),
            created_at=r.get("created_at", datetime.utcnow()).isoformat(),
            updated_at=r.get("updated_at", datetime.utcnow()).isoformat(),
        )
        for r in reports
    ]


@router.delete("/custom-reports/{report_id}")
async def delete_saved_report(report_id: str):
    """Delete a saved report."""
    db = get_database()
    result = await db.saved_reports.delete_one({"_id": ObjectId(report_id)})
    if result.deleted_count == 0:
        return {"status": "not_found"}
    return {"status": "deleted"}


# ============ Customer Profitability Reports ============

class CustomerCostBreakdown(BaseModel):
    carrier_cost: int = 0
    accessorial_cost: int = 0
    quick_pay_discount: int = 0
    other_cost: int = 0
    total_cost: int = 0


class CustomerProfitabilityDetail(BaseModel):
    customer_id: str
    customer_name: str
    period: str
    total_revenue: int
    cost_breakdown: CustomerCostBreakdown
    total_margin: int
    margin_percent: float
    shipment_count: int
    avg_revenue_per_shipment: int
    avg_margin_per_shipment: int
    trend_direction: str  # improving, stable, declining
    trend_change_percent: float
    monthly_data: List[dict]
    ai_insights: List[str]


class CustomerProfitabilityComparison(BaseModel):
    customers: List[CustomerProfitabilityDetail]
    period: str
    generated_at: str


@router.get("/customer-profitability")
async def get_customer_profitability(
    customer_id: Optional[str] = None,
    period: str = "90d",
    compare_ids: Optional[str] = None,
):
    """Get customer profitability report with AI insights."""
    db = get_database()
    now = datetime.utcnow()

    # Parse period
    days_map = {"7d": 7, "30d": 30, "90d": 90, "180d": 180, "365d": 365}
    days = days_map.get(period, 90)
    start_date = now - timedelta(days=days)
    prev_start = start_date - timedelta(days=days)

    # Determine which customers to analyze
    target_customer_ids = []
    if customer_id:
        target_customer_ids = [customer_id]
    if compare_ids:
        target_customer_ids.extend(compare_ids.split(","))

    # Build match filter
    match_filter: dict = {
        "created_at": {"$gte": start_date},
        "customer_price": {"$gt": 0},
    }
    if target_customer_ids:
        try:
            match_filter["customer_id"] = {"$in": [ObjectId(cid) for cid in target_customer_ids]}
        except Exception:
            pass

    # Current period shipments
    pipeline = [
        {"$match": match_filter},
        {
            "$lookup": {
                "from": "customers",
                "localField": "customer_id",
                "foreignField": "_id",
                "as": "customer",
            }
        },
        {
            "$addFields": {
                "customer_name": {"$arrayElemAt": ["$customer.name", 0]},
            }
        },
    ]

    cursor = db.shipments.aggregate(pipeline)
    shipments = await cursor.to_list(10000)

    # Previous period for trend
    prev_filter = dict(match_filter)
    prev_filter["created_at"] = {"$gte": prev_start, "$lt": start_date}
    prev_cursor = db.shipments.aggregate([{"$match": prev_filter}])
    prev_shipments = await prev_cursor.to_list(10000)

    # Aggregate by customer
    customer_data: dict = {}
    for s in shipments:
        cid = str(s.get("customer_id", "unknown"))
        if cid not in customer_data:
            customer_data[cid] = {
                "customer_id": cid,
                "customer_name": s.get("customer_name") or "Unknown",
                "total_revenue": 0,
                "carrier_cost": 0,
                "accessorial_cost": 0,
                "quick_pay_discount": 0,
                "other_cost": 0,
                "shipment_count": 0,
                "monthly": {},
            }
        cd = customer_data[cid]
        cd["total_revenue"] += s.get("customer_price", 0) or 0
        cd["carrier_cost"] += s.get("carrier_cost", 0) or 0
        cd["accessorial_cost"] += s.get("accessorial_charges", 0) or 0
        cd["quick_pay_discount"] += s.get("quick_pay_discount", 0) or 0
        cd["other_cost"] += s.get("other_costs", 0) or 0
        cd["shipment_count"] += 1

        # Monthly breakdown
        month_key = s.get("created_at", now).strftime("%Y-%m")
        if month_key not in cd["monthly"]:
            cd["monthly"][month_key] = {"revenue": 0, "cost": 0, "count": 0}
        cd["monthly"][month_key]["revenue"] += s.get("customer_price", 0) or 0
        cd["monthly"][month_key]["cost"] += s.get("carrier_cost", 0) or 0
        cd["monthly"][month_key]["count"] += 1

    # Previous period by customer
    prev_margins: dict = {}
    for s in prev_shipments:
        cid = str(s.get("customer_id", "unknown"))
        if cid not in prev_margins:
            prev_margins[cid] = {"revenue": 0, "cost": 0}
        prev_margins[cid]["revenue"] += s.get("customer_price", 0) or 0
        prev_margins[cid]["cost"] += s.get("carrier_cost", 0) or 0

    # Build response
    results = []
    for cid, cd in customer_data.items():
        total_cost = cd["carrier_cost"] + cd["accessorial_cost"] + cd["quick_pay_discount"] + cd["other_cost"]
        total_margin = cd["total_revenue"] - total_cost
        margin_pct = (total_margin / cd["total_revenue"] * 100) if cd["total_revenue"] > 0 else 0

        # Trend
        prev = prev_margins.get(cid, {})
        prev_rev = prev.get("revenue", 0)
        prev_cost = prev.get("cost", 0)
        prev_margin_pct = ((prev_rev - prev_cost) / prev_rev * 100) if prev_rev > 0 else 0

        change = margin_pct - prev_margin_pct
        if change > 2:
            trend_dir = "improving"
        elif change < -2:
            trend_dir = "declining"
        else:
            trend_dir = "stable"

        # Monthly data
        monthly_data = []
        for month_key in sorted(cd["monthly"].keys()):
            m = cd["monthly"][month_key]
            m_margin = m["revenue"] - m["cost"]
            m_pct = (m_margin / m["revenue"] * 100) if m["revenue"] > 0 else 0
            monthly_data.append({
                "month": month_key,
                "revenue": m["revenue"],
                "cost": m["cost"],
                "margin": m_margin,
                "margin_percent": round(m_pct, 1),
                "shipment_count": m["count"],
            })

        # AI insights
        ai_insights = []
        if margin_pct < 8:
            ai_insights.append(f"WARNING: Customer margin at {margin_pct:.1f}% is below the 8% minimum threshold. Consider rate adjustment.")
        if trend_dir == "declining":
            ai_insights.append(f"Profitability declining by {abs(change):.1f}pp vs previous period. Investigate cost increases or rate erosion.")
        if cd["quick_pay_discount"] > 0:
            qp_impact = (cd["quick_pay_discount"] / cd["total_revenue"] * 100) if cd["total_revenue"] > 0 else 0
            ai_insights.append(f"Quick-pay discounts represent {qp_impact:.1f}% of revenue. Evaluate if quick-pay terms need adjustment.")
        if cd["accessorial_cost"] > cd["total_revenue"] * 0.1:
            ai_insights.append("Accessorial costs exceed 10% of revenue. Review accessorial billing and carrier charges.")
        if cd["shipment_count"] > 0 and total_margin / cd["shipment_count"] < 5000:  # less than $50 per shipment
            ai_insights.append("Average margin per shipment is below $50. Volume may not justify resource allocation.")
        if margin_pct >= 20:
            ai_insights.append(f"Strong profitability at {margin_pct:.1f}%. This is a high-value customer worth retaining.")
        if not ai_insights:
            ai_insights.append(f"Customer profitability is stable at {margin_pct:.1f}%. No immediate action required.")

        results.append({
            "customer_id": cid,
            "customer_name": cd["customer_name"],
            "period": period,
            "total_revenue": cd["total_revenue"],
            "cost_breakdown": {
                "carrier_cost": cd["carrier_cost"],
                "accessorial_cost": cd["accessorial_cost"],
                "quick_pay_discount": cd["quick_pay_discount"],
                "other_cost": cd["other_cost"],
                "total_cost": total_cost,
            },
            "total_margin": total_margin,
            "margin_percent": round(margin_pct, 1),
            "shipment_count": cd["shipment_count"],
            "avg_revenue_per_shipment": cd["total_revenue"] // cd["shipment_count"] if cd["shipment_count"] > 0 else 0,
            "avg_margin_per_shipment": total_margin // cd["shipment_count"] if cd["shipment_count"] > 0 else 0,
            "trend_direction": trend_dir,
            "trend_change_percent": round(change, 1),
            "monthly_data": monthly_data,
            "ai_insights": ai_insights,
        })

    results.sort(key=lambda x: x["total_margin"], reverse=True)

    return {
        "customers": results,
        "period": period,
        "generated_at": now.isoformat(),
    }


# ============ Operations Metrics (existing - enhanced) ============

@router.get("/operations")
async def get_operations_metrics(days: int = 30):
    """Get operations metrics for the period."""
    db = get_database()
    now = datetime.utcnow()
    start_date = now - timedelta(days=days)

    # Work items
    open_items = await db.work_items.count_documents({"status": {"$in": ["open", "in_progress"]}})
    overdue_items = await db.work_items.count_documents({
        "status": {"$in": ["open", "in_progress"]},
        "is_overdue": True,
    })

    # Work items by type
    type_pipeline = [
        {"$match": {"status": {"$in": ["open", "in_progress"]}}},
        {"$group": {"_id": "$work_type", "count": {"$sum": 1}}},
    ]
    type_cursor = db.work_items.aggregate(type_pipeline)
    type_data = await type_cursor.to_list(20)
    by_type = {item["_id"]: item["count"] for item in type_data if item["_id"]}

    # Avg completion time
    completion_pipeline = [
        {
            "$match": {
                "status": "done",
                "created_at": {"$gte": start_date},
            }
        },
        {
            "$project": {
                "duration_ms": {
                    "$subtract": [
                        {"$ifNull": ["$completed_at", "$updated_at"]},
                        "$created_at",
                    ]
                }
            }
        },
        {
            "$group": {
                "_id": None,
                "avg_duration": {"$avg": "$duration_ms"},
            }
        },
    ]
    comp_cursor = db.work_items.aggregate(completion_pipeline)
    comp_data = await comp_cursor.to_list(1)
    avg_hours = (comp_data[0]["avg_duration"] / 3600000) if comp_data and comp_data[0].get("avg_duration") else 4.2

    # Quotes
    total_quotes = await db.quotes.count_documents({"created_at": {"$gte": start_date}})
    accepted_quotes = await db.quotes.count_documents({
        "created_at": {"$gte": start_date},
        "status": "accepted",
    })
    win_rate = round((accepted_quotes / total_quotes * 100) if total_quotes > 0 else 0, 1)

    # Tenders
    total_tenders = await db.tenders.count_documents({"created_at": {"$gte": start_date}})
    accepted_tenders = await db.tenders.count_documents({
        "created_at": {"$gte": start_date},
        "status": "accepted",
    })
    tender_accept_rate = round((accepted_tenders / total_tenders * 100) if total_tenders > 0 else 0, 1)

    return {
        "work_items": {
            "open": open_items,
            "avg_completion_hours": round(avg_hours, 1),
            "by_type": by_type,
            "overdue": overdue_items,
        },
        "quotes": {
            "total": total_quotes,
            "win_rate": win_rate,
            "avg_response_hours": round(avg_hours * 0.8, 1),  # approximate
        },
        "tenders": {
            "acceptance_rate": tender_accept_rate,
            "avg_acceptance_hours": round(avg_hours * 0.5, 1),
            "counter_offer_rate": 12.5,  # placeholder
        },
        "period_days": days,
    }


# ============ Lane Intelligence ============

@router.get("/lanes")
async def get_lane_intelligence(days: int = 90, limit: int = 20):
    """Get lane intelligence data."""
    db = get_database()
    start_date = datetime.utcnow() - timedelta(days=days)

    pipeline = [
        {
            "$match": {
                "created_at": {"$gte": start_date},
                "customer_price": {"$gt": 0},
            }
        },
        {
            "$addFields": {
                "origin_state": {"$arrayElemAt": ["$stops.state", 0]},
                "dest_state": {"$arrayElemAt": ["$stops.state", -1]},
            }
        },
        {
            "$group": {
                "_id": {"origin_state": "$origin_state", "destination_state": "$dest_state"},
                "volume": {"$sum": 1},
                "avg_rate": {"$avg": "$customer_price"},
                "avg_cost": {"$avg": "$carrier_cost"},
                "total_revenue": {"$sum": "$customer_price"},
                "total_cost": {"$sum": "$carrier_cost"},
            }
        },
        {"$sort": {"volume": -1}},
        {"$limit": limit},
    ]

    cursor = db.shipments.aggregate(pipeline)
    lanes = await cursor.to_list(limit)

    results = []
    for lane in lanes:
        lid = lane.get("_id", {})
        avg_margin = (lane.get("avg_rate", 0) or 0) - (lane.get("avg_cost", 0) or 0)
        total_rev = lane.get("total_revenue", 0) or 0
        total_cost = lane.get("total_cost", 0) or 0
        margin_pct = ((total_rev - total_cost) / total_rev * 100) if total_rev > 0 else 0

        results.append({
            "origin_state": lid.get("origin_state") or "??",
            "destination_state": lid.get("destination_state") or "??",
            "volume": lane.get("volume", 0),
            "avg_rate": round(lane.get("avg_rate", 0) or 0),
            "avg_margin": round(avg_margin),
            "avg_margin_percent": round(margin_pct, 1),
            "top_carriers": [],
        })

    return results
