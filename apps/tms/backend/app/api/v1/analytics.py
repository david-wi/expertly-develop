from typing import List, Optional
from datetime import datetime, timedelta
from fastapi import APIRouter
from pydantic import BaseModel
from bson import ObjectId

from app.database import get_database

router = APIRouter()


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
