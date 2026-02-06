from typing import Optional
from pydantic import BaseModel, Field

class ReportResponse(BaseModel):
    id: str
    company_id: str
    company_name: str
    company_ticker: str
    version: int
    signal: str
    signal_confidence: int
    executive_summary: str
    business_model_analysis: str
    revenue_sources: str
    margin_analysis: str
    moat_assessment: str
    moat_rating: str
    ai_impact_analysis: str
    ai_vulnerability_score: int
    competitive_landscape: str
    valuation_assessment: str
    investment_recommendation: str
    hypothesis_impacts: list[dict]
    citations: list[dict]
    sec_filings_used: list[str]
    model_used: str
    generation_time_seconds: Optional[float]
    input_tokens: Optional[int]
    output_tokens: Optional[int]
    created_at: str
    updated_at: str

class ReportListItem(BaseModel):
    id: str
    company_id: str
    company_name: str
    company_ticker: str
    version: int
    signal: str
    signal_confidence: int
    executive_summary: str
    moat_rating: str
    ai_vulnerability_score: int
    created_at: str
