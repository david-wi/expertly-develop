from fastapi import APIRouter, HTTPException
from bson import ObjectId
from app.database import get_database
from app.models.base import utc_now
from app.schemas.research_report import ReportCreate
import logging

logger = logging.getLogger(__name__)

router = APIRouter()


def _to_response(doc: dict) -> dict:
    doc["id"] = str(doc.pop("_id"))
    for field in ["created_at", "updated_at"]:
        if doc.get(field) and hasattr(doc[field], "isoformat"):
            doc[field] = doc[field].isoformat()
    # Convert sub-documents
    for impact in doc.get("hypothesis_impacts", []):
        pass  # already plain dicts
    for citation in doc.get("citations", []):
        if citation.get("accessed_at") and hasattr(citation["accessed_at"], "isoformat"):
            citation["accessed_at"] = citation["accessed_at"].isoformat()
    return doc


def _to_list_item(doc: dict) -> dict:
    return {
        "id": str(doc["_id"]),
        "company_id": doc.get("company_id", ""),
        "company_name": doc.get("company_name", ""),
        "company_ticker": doc.get("company_ticker", ""),
        "version": doc.get("version", 1),
        "signal": doc.get("signal", "hold"),
        "signal_confidence": doc.get("signal_confidence", 50),
        "executive_summary": doc.get("executive_summary", "")[:200],
        "moat_rating": doc.get("moat_rating", "none"),
        "ai_vulnerability_score": doc.get("ai_vulnerability_score", 50),
        "created_at": doc["created_at"].isoformat() if doc.get("created_at") and hasattr(doc["created_at"], "isoformat") else "",
    }


@router.get("")
async def list_reports(company_id: str = None, limit: int = 50):
    db = get_database()
    query = {}
    if company_id:
        query["company_id"] = company_id
    cursor = db.research_reports.find(query).sort("created_at", -1).limit(limit)
    results = []
    async for doc in cursor:
        results.append(_to_list_item(doc))
    return results


@router.post("", status_code=201)
async def create_report(data: ReportCreate):
    """Create a report directly (for manually-authored reports)."""
    db = get_database()
    company = await db.companies.find_one({"_id": ObjectId(data.company_id)})
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")

    # Determine next version
    latest_report = await db.research_reports.find_one(
        {"company_id": data.company_id},
        sort=[("version", -1)]
    )
    next_version = (latest_report["version"] + 1) if latest_report else 1

    now = utc_now()
    report_doc = {
        **data.model_dump(),
        "company_name": company.get("name", ""),
        "company_ticker": company.get("ticker", ""),
        "version": next_version,
        "raw_financial_data": None,
        "raw_sec_data": None,
        "created_at": now,
        "updated_at": now,
    }

    result = await db.research_reports.insert_one(report_doc)
    report_doc["_id"] = result.inserted_id

    # Update company with latest report info
    await db.companies.update_one(
        {"_id": company["_id"]},
        {"$set": {
            "latest_signal": report_doc["signal"],
            "latest_report_id": str(result.inserted_id),
            "latest_report_date": now,
            "updated_at": now,
        },
        "$inc": {"report_count": 1}}
    )

    return _to_response(report_doc)


@router.get("/{report_id}")
async def get_report(report_id: str):
    db = get_database()
    doc = await db.research_reports.find_one({"_id": ObjectId(report_id)})
    if not doc:
        raise HTTPException(status_code=404, detail="Report not found")
    return _to_response(doc)


@router.delete("/{report_id}")
async def delete_report(report_id: str):
    db = get_database()
    result = await db.research_reports.delete_one({"_id": ObjectId(report_id)})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Report not found")
    return {"deleted": True}


@router.post("/generate/{company_id}")
async def generate_report(company_id: str):
    db = get_database()
    company = await db.companies.find_one({"_id": ObjectId(company_id)})
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")

    try:
        from app.services.report_generator import generate_research_report
        report = await generate_research_report(company)
        return _to_response(report)
    except Exception as e:
        logger.error(f"Report generation failed for {company.get('ticker')}: {e}")
        raise HTTPException(status_code=500, detail=f"Report generation failed: {str(e)}")
