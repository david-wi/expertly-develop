from typing import Optional
from datetime import datetime
from pydantic import Field
from .base import MongoModel

class Company(MongoModel):
    name: str
    ticker: str
    industry_id: Optional[str] = None
    sub_industry_id: Optional[str] = None
    description: str = ""
    sec_cik: Optional[str] = None
    exchange: Optional[str] = None
    # Financials
    current_pe: Optional[float] = None
    forward_pe: Optional[float] = None
    historical_pe_1yr: Optional[float] = None
    market_cap: Optional[float] = None
    revenue: Optional[float] = None
    gross_margin: Optional[float] = None
    operating_margin: Optional[float] = None
    current_price: Optional[float] = None
    price_change_1yr: Optional[float] = None
    financial_data_updated_at: Optional[datetime] = None
    # Research
    linked_hypothesis_ids: list[str] = Field(default_factory=list)
    latest_signal: Optional[str] = None  # strong_sell, sell, hold, buy, strong_buy
    latest_report_id: Optional[str] = None
    latest_report_date: Optional[datetime] = None
    report_count: int = 0
    tags: list[str] = Field(default_factory=list)
