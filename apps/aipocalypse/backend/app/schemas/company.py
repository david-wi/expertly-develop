from typing import Optional
from pydantic import BaseModel, Field

class CompanyCreate(BaseModel):
    name: str
    ticker: str
    industry_id: Optional[str] = None
    sub_industry_id: Optional[str] = None
    description: str = ""
    sec_cik: Optional[str] = None
    exchange: Optional[str] = None
    linked_hypothesis_ids: list[str] = Field(default_factory=list)
    tags: list[str] = Field(default_factory=list)

class CompanyUpdate(BaseModel):
    name: Optional[str] = None
    ticker: Optional[str] = None
    industry_id: Optional[str] = None
    sub_industry_id: Optional[str] = None
    description: Optional[str] = None
    sec_cik: Optional[str] = None
    exchange: Optional[str] = None
    tags: Optional[list[str]] = None

class CompanyResponse(BaseModel):
    id: str
    name: str
    ticker: str
    industry_id: Optional[str]
    sub_industry_id: Optional[str]
    description: str
    sec_cik: Optional[str]
    exchange: Optional[str]
    current_pe: Optional[float]
    forward_pe: Optional[float]
    historical_pe_1yr: Optional[float]
    market_cap: Optional[float]
    revenue: Optional[float]
    gross_margin: Optional[float]
    operating_margin: Optional[float]
    current_price: Optional[float]
    price_change_1yr: Optional[float]
    financial_data_updated_at: Optional[str]
    linked_hypothesis_ids: list[str]
    latest_signal: Optional[str]
    latest_report_id: Optional[str]
    latest_report_date: Optional[str]
    report_count: int
    tags: list[str]
    created_at: str
    updated_at: str

class LinkHypothesisRequest(BaseModel):
    hypothesis_id: str

class TickerSearchResult(BaseModel):
    ticker: str
    name: str
    exchange: Optional[str] = None
    sector: Optional[str] = None
