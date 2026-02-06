from typing import Optional
from datetime import datetime
from pydantic import BaseModel, Field
from .base import MongoModel

class HypothesisImpact(BaseModel):
    hypothesis_id: str
    impact_summary: str

class Citation(BaseModel):
    source: str
    url: Optional[str] = None
    accessed_at: Optional[datetime] = None
    excerpt: Optional[str] = None

class ResearchReport(MongoModel):
    company_id: str
    company_name: str
    company_ticker: str
    version: int = 1
    # Signal
    signal: str = "hold"  # strong_sell, sell, hold, buy, strong_buy
    signal_confidence: int = 50  # 0-100
    # Sections (all markdown)
    executive_summary: str = ""
    business_model_analysis: str = ""
    revenue_sources: str = ""
    margin_analysis: str = ""
    moat_assessment: str = ""
    moat_rating: str = "none"  # strong, moderate, weak, none
    ai_impact_analysis: str = ""
    ai_vulnerability_score: int = 50  # 0-100
    competitive_landscape: str = ""
    valuation_assessment: str = ""
    investment_recommendation: str = ""
    management_strategy_response: str = ""
    # References
    hypothesis_impacts: list[HypothesisImpact] = Field(default_factory=list)
    citations: list[Citation] = Field(default_factory=list)
    sec_filings_used: list[str] = Field(default_factory=list)
    # Metadata
    model_used: str = ""
    generation_time_seconds: Optional[float] = None
    input_tokens: Optional[int] = None
    output_tokens: Optional[int] = None
    raw_financial_data: Optional[dict] = None
    raw_sec_data: Optional[dict] = None
    # Market data (fetched from yfinance, not AI-generated)
    price_history: Optional[list] = None
    analyst_consensus: Optional[dict] = None
    key_metrics: Optional[dict] = None
