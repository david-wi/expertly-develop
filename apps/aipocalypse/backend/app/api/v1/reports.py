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
    # Ensure new optional fields are present
    doc.setdefault("price_history", None)
    doc.setdefault("analyst_consensus", None)
    doc.setdefault("key_metrics", None)
    doc.setdefault("management_strategy_response", None)
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


@router.post("/backfill")
async def backfill_reports():
    """Backfill existing reports with price_history, analyst_consensus, and key_metrics."""
    from app.services.financial_data import get_price_history, get_analyst_data, get_key_metrics

    db = get_database()
    # Find reports missing any of the new fields
    query = {
        "$or": [
            {"price_history": {"$exists": False}},
            {"analyst_consensus": {"$exists": False}},
            {"key_metrics": {"$exists": False}},
            {"price_history": None},
            {"analyst_consensus": None},
            {"key_metrics": None},
        ]
    }
    cursor = db.research_reports.find(query)
    updated = 0
    errors = []
    async for doc in cursor:
        ticker = doc.get("company_ticker", "")
        if not ticker:
            continue
        try:
            price_history = await get_price_history(ticker)
            analyst_consensus = await get_analyst_data(ticker)
            key_metrics = await get_key_metrics(ticker)
            await db.research_reports.update_one(
                {"_id": doc["_id"]},
                {"$set": {
                    "price_history": price_history,
                    "analyst_consensus": analyst_consensus,
                    "key_metrics": key_metrics,
                    "updated_at": utc_now(),
                }}
            )
            updated += 1
        except Exception as e:
            errors.append({"ticker": ticker, "error": str(e)})
            logger.warning(f"Backfill failed for {ticker}: {e}")

    return {"updated": updated, "errors": errors}


@router.post("/backfill-strategy")
async def backfill_management_strategy():
    """Backfill existing reports with AI-generated management_strategy_response."""
    from app.config import get_settings
    import anthropic
    import json

    db = get_database()
    settings = get_settings()

    settings_doc = await db.app_settings.find_one({})
    api_key = (settings_doc or {}).get("anthropic_api_key") or settings.anthropic_api_key
    model = (settings_doc or {}).get("default_model") or settings.default_model

    if not api_key:
        raise HTTPException(status_code=400, detail="No Anthropic API key configured")

    query = {
        "$or": [
            {"management_strategy_response": {"$exists": False}},
            {"management_strategy_response": None},
            {"management_strategy_response": ""},
        ]
    }
    cursor = db.research_reports.find(query)
    updated = 0
    errors = []

    client = anthropic.Anthropic(api_key=api_key)

    async for doc in cursor:
        company_name = doc.get("company_name", "Unknown")
        ticker = doc.get("company_ticker", "")
        try:
            prompt = f"""Based on this existing research report for {company_name} ({ticker}), write a management_strategy_response section.

## Existing Report Context
- Signal: {doc.get('signal', 'hold')} (confidence: {doc.get('signal_confidence', 50)}%)
- Moat: {doc.get('moat_rating', 'unknown')}
- AI Vulnerability Score: {doc.get('ai_vulnerability_score', 50)}/100

### Executive Summary
{doc.get('executive_summary', '')[:1500]}

### AI Impact Analysis
{doc.get('ai_impact_analysis', '')[:1500]}

### Competitive Landscape
{doc.get('competitive_landscape', '')[:1500]}

### Investment Recommendation
{doc.get('investment_recommendation', '')[:1000]}

## Task
Write ONLY the management_strategy_response as a markdown string (NOT JSON, just the raw markdown text).

This should be written FROM the perspective of {company_name}'s management team as a strategic memo to the board. Outline the smartest, most creative strategy they could adopt to respond to AI disruption and competitive threats. Include:
- Specific initiatives with timelines
- Investment priorities and resource allocation
- Expected outcomes and KPIs
- Creative/unconventional moves that could give them an edge

Use ### subheadings and bullet points. Be specific and actionable, not generic. 3-5 paragraphs."""

            response = client.messages.create(
                model=model,
                max_tokens=2000,
                system="You are the executive strategy team of the company described. Write a strategic memo to the board outlining your best response to AI disruption. Be specific, creative, and actionable. Output raw markdown only — no JSON wrapping.",
                messages=[{"role": "user", "content": prompt}],
            )

            strategy_text = response.content[0].text.strip()

            await db.research_reports.update_one(
                {"_id": doc["_id"]},
                {"$set": {
                    "management_strategy_response": strategy_text,
                    "updated_at": utc_now(),
                }}
            )
            updated += 1
            logger.info(f"Backfilled strategy for {company_name} ({ticker})")
        except Exception as e:
            errors.append({"ticker": ticker, "company": company_name, "error": str(e)})
            logger.warning(f"Strategy backfill failed for {ticker}: {e}")

    return {"updated": updated, "errors": errors}


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
