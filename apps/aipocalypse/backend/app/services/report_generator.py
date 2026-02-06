import json
import time
import logging
from bson import ObjectId
from app.database import get_database
from app.config import get_settings
from app.models.base import utc_now

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = """You are a senior equity research analyst specializing in technology disruption and AI impact analysis. You produce institutional-quality research reports that are data-driven, balanced, and actionable.

Your reports should:
- Be grounded in financial data and SEC filings when available
- Consider both bull and bear cases objectively
- Provide clear, actionable investment signals
- Assess competitive moats rigorously
- Evaluate AI disruption risk/opportunity specifically

FORMATTING RULES — Every markdown section MUST be highly scannable:
- Start each section with a **bold 1-2 sentence TL;DR** as the first line
- Use bullet points and short paragraphs (3 sentences max per paragraph)
- Use **bold** for key numbers, company names, and critical takeaways
- Use markdown tables when comparing data points (e.g., margins, competitors)
- Use ### subheadings within sections to break up long analyses
- Avoid dense walls of text — break every 3-4 lines with a heading or bullet list
- For the management_strategy_response section, write as if you ARE the company's executive team crafting a strategic memo to the board

Always respond with valid JSON matching the requested schema. Never include markdown code fences around the JSON."""


async def generate_research_report(company: dict) -> dict:
    """Generate a research report for a company using Claude."""
    db = get_database()
    settings = get_settings()

    # Get API key (DB overrides env)
    settings_doc = await db.app_settings.find_one({})
    api_key = (settings_doc or {}).get("anthropic_api_key") or settings.anthropic_api_key
    model = (settings_doc or {}).get("default_model") or settings.default_model

    if not api_key:
        raise ValueError("No Anthropic API key configured. Set it in Settings.")

    company_id = str(company["_id"])
    ticker = company.get("ticker", "")
    company_name = company.get("name", "")

    # Gather financial data
    fin_data = {}
    try:
        from app.services.financial_data import get_company_data
        fin_data = await get_company_data(ticker)
    except Exception as e:
        logger.warning(f"Could not fetch financial data for {ticker}: {e}")

    # Gather SEC data
    sec_sections = {}
    sec_filings_used = []
    if company.get("sec_cik"):
        try:
            from app.services.sec_edgar import get_company_filings, get_filing_text, extract_key_sections
            filings = await get_company_filings(company["sec_cik"], ["10-K"])
            if filings:
                filing = filings[0]
                sec_filings_used.append(f"{filing['form']} ({filing['filing_date']})")
                html = await get_filing_text(filing["accession_number"], company["sec_cik"])
                if html:
                    sec_sections = extract_key_sections(html)
        except Exception as e:
            logger.warning(f"Could not fetch SEC data for {ticker}: {e}")

    # Get linked hypotheses
    linked_hypotheses = []
    for hid in company.get("linked_hypothesis_ids", []):
        try:
            hyp = await db.hypotheses.find_one({"_id": ObjectId(hid)})
            if hyp:
                linked_hypotheses.append({
                    "id": str(hyp["_id"]),
                    "title": hyp["title"],
                    "description": hyp["description"],
                    "impact_direction": hyp["impact_direction"],
                    "confidence_level": hyp["confidence_level"],
                })
        except Exception:
            pass

    # Determine next version
    latest_report = await db.research_reports.find_one(
        {"company_id": company_id},
        sort=[("version", -1)]
    )
    next_version = (latest_report["version"] + 1) if latest_report else 1

    # Build prompt
    user_prompt = f"""Generate a comprehensive research report for {company_name} ({ticker}).

## Financial Data (from yfinance)
```json
{json.dumps(fin_data, indent=2, default=str)}
```

## SEC Filing Excerpts
"""
    if sec_sections:
        for section_name, content in sec_sections.items():
            if content:
                user_prompt += f"\n### {section_name.replace('_', ' ').title()}\n{content[:3000]}\n"
    else:
        user_prompt += "\nNo SEC filing data available. Base analysis on financial data and general knowledge.\n"

    if linked_hypotheses:
        user_prompt += "\n## Investment Hypotheses to Evaluate Against\n"
        for hyp in linked_hypotheses:
            user_prompt += f"\n### {hyp['title']}\n{hyp['description']}\nImpact direction: {hyp['impact_direction']}, Confidence: {hyp['confidence_level']}%\n"

    user_prompt += """
## Required Output
Return a JSON object with these fields:
{
    "signal": "strong_sell|sell|hold|buy|strong_buy",
    "signal_confidence": <0-100>,
    "executive_summary": "<2-3 paragraph markdown summary — start with bold TL;DR>",
    "business_model_analysis": "<markdown analysis of business model — use bullets and subheadings>",
    "revenue_sources": "<markdown breakdown of revenue sources — use a table if possible>",
    "margin_analysis": "<markdown analysis of margins and trends — use a table for key figures>",
    "moat_assessment": "<markdown assessment of competitive moat — bullets for each moat factor>",
    "moat_rating": "strong|moderate|weak|none",
    "ai_impact_analysis": "<markdown analysis of AI disruption risk/opportunity — use ### subheadings for threats vs opportunities>",
    "ai_vulnerability_score": <0-100 where 100 is most vulnerable>,
    "competitive_landscape": "<markdown competitive analysis — use a comparison table>",
    "valuation_assessment": "<markdown valuation analysis — bold key multiples>",
    "investment_recommendation": "<markdown recommendation with timeframe — start with bold verdict>",
    "management_strategy_response": "<Written FROM the perspective of the company's management team as a strategic memo to the board. Outline the smartest, most creative strategy they could adopt to respond to AI disruption and competitive threats. Include specific initiatives, timeline, investment priorities, and expected outcomes. Use ### subheadings and bullets. 3-5 paragraphs.>",
    "section_insights": {
        "Executive Summary": "<1-2 sentence thesis-critical takeaway for this section>",
        "Business Model": "<1-2 sentence thesis-critical takeaway>",
        "Revenue Sources": "<1-2 sentence thesis-critical takeaway>",
        "Margin Analysis": "<1-2 sentence thesis-critical takeaway>",
        "Moat Assessment": "<1-2 sentence thesis-critical takeaway>",
        "AI Impact Analysis": "<1-2 sentence thesis-critical takeaway>",
        "Competitive Landscape": "<1-2 sentence thesis-critical takeaway>",
        "Valuation Assessment": "<1-2 sentence thesis-critical takeaway>",
        "Investment Recommendation": "<1-2 sentence thesis-critical takeaway>"
    },
    "forward_valuation": {
        "current_data": {"price": "<current stock price>", "market_cap": "<market cap>", "shares_outstanding": "<shares>", "ttm_revenue": "<trailing 12 month revenue>", "ttm_gaap_eps": "<trailing 12 month GAAP EPS>"},
        "scenarios": [
            {"name": "Bull", "probability": 0.30, "description": "<1 sentence bull case>", "revenue_cagr": "<5yr revenue CAGR as decimal>", "year5_revenue": "<projected year 5 revenue>", "year5_eps": "<projected year 5 EPS>", "terminal_pe": "<terminal P/E multiple>", "implied_price": "<implied stock price>"},
            {"name": "Base", "probability": 0.45, "description": "<1 sentence base case>", "revenue_cagr": "<5yr CAGR>", "year5_revenue": "<rev>", "year5_eps": "<eps>", "terminal_pe": "<pe>", "implied_price": "<price>"},
            {"name": "Bear", "probability": 0.25, "description": "<1 sentence bear case>", "revenue_cagr": "<5yr CAGR>", "year5_revenue": "<rev>", "year5_eps": "<eps>", "terminal_pe": "<pe>", "implied_price": "<price>"}
        ],
        "weighted_fair_value": "<probability-weighted fair value>",
        "vs_current_pct": "<% difference vs current price, negative means overvalued>"
    },
    "hypothesis_impacts": [{"hypothesis_id": "<id>", "impact_summary": "<summary>"}],
    "citations": [{"source": "<source name>", "url": "<url if available>", "excerpt": "<relevant excerpt>"}]
}
"""

    # Call Claude
    start_time = time.time()

    import anthropic
    client = anthropic.Anthropic(api_key=api_key)

    response = client.messages.create(
        model=model,
        max_tokens=10000,
        system=SYSTEM_PROMPT,
        messages=[{"role": "user", "content": user_prompt}],
    )

    generation_time = time.time() - start_time
    response_text = response.content[0].text

    # Parse JSON response
    try:
        report_data = json.loads(response_text)
    except json.JSONDecodeError:
        # Try to extract JSON from the response
        import re
        json_match = re.search(r'\{[\s\S]*\}', response_text)
        if json_match:
            report_data = json.loads(json_match.group())
        else:
            raise ValueError("Failed to parse report JSON from Claude response")

    # Fetch market data (independent of AI generation)
    price_history = []
    analyst_consensus = None
    key_metrics = None
    try:
        from app.services.financial_data import get_price_history, get_analyst_data, get_key_metrics
        price_history = await get_price_history(ticker)
        analyst_consensus = await get_analyst_data(ticker)
        key_metrics = await get_key_metrics(ticker)
    except Exception as e:
        logger.warning(f"Could not fetch market data for {ticker}: {e}")

    # Build report document
    now = utc_now()
    report_doc = {
        "company_id": company_id,
        "company_name": company_name,
        "company_ticker": ticker,
        "version": next_version,
        "signal": report_data.get("signal", "hold"),
        "signal_confidence": report_data.get("signal_confidence", 50),
        "executive_summary": report_data.get("executive_summary", ""),
        "business_model_analysis": report_data.get("business_model_analysis", ""),
        "revenue_sources": report_data.get("revenue_sources", ""),
        "margin_analysis": report_data.get("margin_analysis", ""),
        "moat_assessment": report_data.get("moat_assessment", ""),
        "moat_rating": report_data.get("moat_rating", "none"),
        "ai_impact_analysis": report_data.get("ai_impact_analysis", ""),
        "ai_vulnerability_score": report_data.get("ai_vulnerability_score", 50),
        "competitive_landscape": report_data.get("competitive_landscape", ""),
        "valuation_assessment": report_data.get("valuation_assessment", ""),
        "investment_recommendation": report_data.get("investment_recommendation", ""),
        "management_strategy_response": report_data.get("management_strategy_response", ""),
        "section_insights": report_data.get("section_insights", None),
        "forward_valuation": report_data.get("forward_valuation", None),
        "hypothesis_impacts": report_data.get("hypothesis_impacts", []),
        "citations": report_data.get("citations", []),
        "sec_filings_used": sec_filings_used,
        "model_used": model,
        "generation_time_seconds": round(generation_time, 2),
        "input_tokens": response.usage.input_tokens,
        "output_tokens": response.usage.output_tokens,
        "raw_financial_data": fin_data,
        "raw_sec_data": sec_sections if sec_sections else None,
        "price_history": price_history,
        "analyst_consensus": analyst_consensus,
        "key_metrics": key_metrics,
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

    return report_doc
