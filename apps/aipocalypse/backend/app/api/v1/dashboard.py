from fastapi import APIRouter
from bson import ObjectId
from app.database import get_database

router = APIRouter()


@router.get("/stats")
async def dashboard_stats():
    db = get_database()
    total_companies = await db.companies.count_documents({})
    total_reports = await db.research_reports.count_documents({})
    total_hypotheses = await db.hypotheses.count_documents({"status": "active"})

    # Signal counts
    signal_counts = {}
    pipeline = [
        {"$match": {"latest_signal": {"$ne": None}}},
        {"$group": {"_id": "$latest_signal", "count": {"$sum": 1}}}
    ]
    async for doc in db.companies.aggregate(pipeline):
        signal_counts[doc["_id"]] = doc["count"]

    return {
        "total_companies": total_companies,
        "total_reports": total_reports,
        "total_hypotheses": total_hypotheses,
        "strong_sell_count": signal_counts.get("strong_sell", 0),
        "sell_count": signal_counts.get("sell", 0),
        "hold_count": signal_counts.get("hold", 0),
        "buy_count": signal_counts.get("buy", 0),
        "strong_buy_count": signal_counts.get("strong_buy", 0),
    }


@router.get("/leaderboard")
async def leaderboard(
    hypothesis_id: str = None,
    industry_id: str = None,
    signal: str = None,
    limit: int = 50,
):
    db = get_database()
    query = {}
    if hypothesis_id:
        query["linked_hypothesis_ids"] = hypothesis_id
    if industry_id:
        query["$or"] = [{"industry_id": industry_id}, {"sub_industry_id": industry_id}]
    if signal:
        query["latest_signal"] = signal

    cursor = db.companies.find(query).sort("name", 1).limit(limit)

    # Build hypothesis name lookup
    hyp_names = {}
    async for h in db.hypotheses.find({}, {"title": 1}):
        hyp_names[str(h["_id"])] = h["title"]

    # Build industry name lookup
    ind_names = {}
    async for ind in db.industries.find({}, {"name": 1}):
        ind_names[str(ind["_id"])] = ind["name"]

    results = []
    async for doc in cursor:
        results.append({
            "id": str(doc["_id"]),
            "name": doc.get("name", ""),
            "ticker": doc.get("ticker", ""),
            "industry_name": ind_names.get(doc.get("industry_id")) or ind_names.get(doc.get("sub_industry_id")),
            "signal": doc.get("latest_signal"),
            "signal_confidence": None,
            "current_pe": doc.get("current_pe"),
            "historical_pe_1yr": doc.get("historical_pe_1yr"),
            "market_cap": doc.get("market_cap"),
            "latest_report_date": doc["latest_report_date"].isoformat() if doc.get("latest_report_date") and hasattr(doc["latest_report_date"], "isoformat") else None,
            "hypothesis_names": [hyp_names.get(hid, "") for hid in doc.get("linked_hypothesis_ids", [])],
        })
    return results


@router.get("/by-hypothesis/{hypothesis_id}")
async def companies_by_hypothesis(hypothesis_id: str):
    db = get_database()
    cursor = db.companies.find({"linked_hypothesis_ids": hypothesis_id}).sort("name", 1)
    results = []
    async for doc in cursor:
        results.append({
            "id": str(doc["_id"]),
            "name": doc.get("name", ""),
            "ticker": doc.get("ticker", ""),
            "latest_signal": doc.get("latest_signal"),
            "current_pe": doc.get("current_pe"),
            "market_cap": doc.get("market_cap"),
        })
    return results


@router.get("/by-industry/{industry_id}")
async def companies_by_industry(industry_id: str):
    db = get_database()
    cursor = db.companies.find({
        "$or": [{"industry_id": industry_id}, {"sub_industry_id": industry_id}]
    }).sort("name", 1)
    results = []
    async for doc in cursor:
        results.append({
            "id": str(doc["_id"]),
            "name": doc.get("name", ""),
            "ticker": doc.get("ticker", ""),
            "latest_signal": doc.get("latest_signal"),
            "current_pe": doc.get("current_pe"),
            "market_cap": doc.get("market_cap"),
        })
    return results
