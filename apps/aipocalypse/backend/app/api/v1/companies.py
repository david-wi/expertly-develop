from fastapi import APIRouter, HTTPException
from bson import ObjectId
from app.database import get_database
from app.models.base import utc_now
from app.schemas.company import CompanyCreate, CompanyUpdate, CompanyResponse, LinkHypothesisRequest
import logging

logger = logging.getLogger(__name__)

router = APIRouter()


def _to_response(doc: dict) -> dict:
    doc["id"] = str(doc.pop("_id"))
    for field in ["created_at", "updated_at", "financial_data_updated_at", "latest_report_date"]:
        if doc.get(field) and hasattr(doc[field], "isoformat"):
            doc[field] = doc[field].isoformat()
        elif not doc.get(field):
            doc[field] = None if field != "created_at" and field != "updated_at" else ""
    return doc


@router.get("")
async def list_companies(
    industry_id: str = None,
    signal: str = None,
    hypothesis_id: str = None,
    search: str = None,
):
    db = get_database()
    query = {}
    if industry_id:
        query["$or"] = [{"industry_id": industry_id}, {"sub_industry_id": industry_id}]
    if signal:
        query["latest_signal"] = signal
    if hypothesis_id:
        query["linked_hypothesis_ids"] = hypothesis_id
    if search:
        query["$or"] = [
            {"name": {"$regex": search, "$options": "i"}},
            {"ticker": {"$regex": search, "$options": "i"}},
        ]
        if industry_id:
            # Can't have two $or, merge them
            query = {
                "$and": [
                    {"$or": [{"industry_id": industry_id}, {"sub_industry_id": industry_id}]},
                    {"$or": [{"name": {"$regex": search, "$options": "i"}}, {"ticker": {"$regex": search, "$options": "i"}}]},
                ]
            }
            if signal:
                query["$and"].append({"latest_signal": signal})
    cursor = db.companies.find(query).sort("name", 1)
    results = []
    async for doc in cursor:
        results.append(_to_response(doc))
    return results


@router.post("", status_code=201)
async def create_company(data: CompanyCreate):
    db = get_database()
    now = utc_now()
    doc = {
        **data.model_dump(),
        "current_pe": None,
        "forward_pe": None,
        "historical_pe_1yr": None,
        "market_cap": None,
        "revenue": None,
        "gross_margin": None,
        "operating_margin": None,
        "current_price": None,
        "price_change_1yr": None,
        "financial_data_updated_at": None,
        "latest_signal": None,
        "latest_report_id": None,
        "latest_report_date": None,
        "report_count": 0,
        "created_at": now,
        "updated_at": now,
    }
    # Update industry company count
    if data.industry_id:
        await db.industries.update_one(
            {"_id": ObjectId(data.industry_id)},
            {"$inc": {"company_count": 1}}
        )
    if data.sub_industry_id:
        await db.industries.update_one(
            {"_id": ObjectId(data.sub_industry_id)},
            {"$inc": {"company_count": 1}}
        )
    result = await db.companies.insert_one(doc)
    doc["_id"] = result.inserted_id
    return _to_response(doc)


@router.get("/{company_id}")
async def get_company(company_id: str):
    db = get_database()
    doc = await db.companies.find_one({"_id": ObjectId(company_id)})
    if not doc:
        raise HTTPException(status_code=404, detail="Company not found")
    return _to_response(doc)


@router.patch("/{company_id}")
async def update_company(company_id: str, data: CompanyUpdate):
    db = get_database()
    update_data = {k: v for k, v in data.model_dump().items() if v is not None}
    if not update_data:
        raise HTTPException(status_code=400, detail="No fields to update")
    update_data["updated_at"] = utc_now()
    result = await db.companies.update_one(
        {"_id": ObjectId(company_id)},
        {"$set": update_data}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Company not found")
    doc = await db.companies.find_one({"_id": ObjectId(company_id)})
    return _to_response(doc)


@router.delete("/{company_id}")
async def delete_company(company_id: str):
    db = get_database()
    company = await db.companies.find_one({"_id": ObjectId(company_id)})
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")
    # Decrement industry company counts
    if company.get("industry_id"):
        await db.industries.update_one(
            {"_id": ObjectId(company["industry_id"])},
            {"$inc": {"company_count": -1}}
        )
    if company.get("sub_industry_id"):
        await db.industries.update_one(
            {"_id": ObjectId(company["sub_industry_id"])},
            {"$inc": {"company_count": -1}}
        )
    await db.companies.delete_one({"_id": ObjectId(company_id)})
    return {"deleted": True}


@router.post("/{company_id}/link-hypothesis")
async def link_hypothesis(company_id: str, data: LinkHypothesisRequest):
    db = get_database()
    result = await db.companies.update_one(
        {"_id": ObjectId(company_id)},
        {
            "$addToSet": {"linked_hypothesis_ids": data.hypothesis_id},
            "$set": {"updated_at": utc_now()}
        }
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Company not found")
    return {"linked": True}


@router.post("/{company_id}/unlink-hypothesis")
async def unlink_hypothesis(company_id: str, data: LinkHypothesisRequest):
    db = get_database()
    result = await db.companies.update_one(
        {"_id": ObjectId(company_id)},
        {
            "$pull": {"linked_hypothesis_ids": data.hypothesis_id},
            "$set": {"updated_at": utc_now()}
        }
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Company not found")
    return {"unlinked": True}


@router.post("/{company_id}/refresh-financials")
async def refresh_financials(company_id: str):
    db = get_database()
    company = await db.companies.find_one({"_id": ObjectId(company_id)})
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")

    try:
        from app.services.financial_data import get_company_data
        fin_data = await get_company_data(company["ticker"])
        update = {
            "current_pe": fin_data.get("current_pe"),
            "forward_pe": fin_data.get("forward_pe"),
            "market_cap": fin_data.get("market_cap"),
            "revenue": fin_data.get("revenue"),
            "gross_margin": fin_data.get("gross_margin"),
            "operating_margin": fin_data.get("operating_margin"),
            "current_price": fin_data.get("current_price"),
            "price_change_1yr": fin_data.get("price_change_1yr"),
            "financial_data_updated_at": utc_now(),
            "updated_at": utc_now(),
        }
        # Get historical PE
        from app.services.financial_data import get_historical_pe
        historical_pe = await get_historical_pe(company["ticker"])
        if historical_pe:
            update["historical_pe_1yr"] = historical_pe

        await db.companies.update_one(
            {"_id": ObjectId(company_id)},
            {"$set": update}
        )
        doc = await db.companies.find_one({"_id": ObjectId(company_id)})
        return _to_response(doc)
    except Exception as e:
        logger.error(f"Failed to refresh financials for {company['ticker']}: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch financial data: {str(e)}")


@router.get("/search-ticker/{query}")
async def search_ticker(query: str):
    try:
        from app.services.financial_data import search_ticker
        results = await search_ticker(query)
        return results
    except Exception as e:
        logger.error(f"Ticker search failed: {e}")
        return []
