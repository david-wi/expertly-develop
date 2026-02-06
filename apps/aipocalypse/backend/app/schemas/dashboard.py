from typing import Optional
from pydantic import BaseModel

class DashboardStats(BaseModel):
    total_companies: int
    total_reports: int
    total_hypotheses: int
    strong_sell_count: int
    sell_count: int
    hold_count: int
    buy_count: int
    strong_buy_count: int

class LeaderboardEntry(BaseModel):
    id: str
    name: str
    ticker: str
    industry_name: Optional[str]
    signal: Optional[str]
    signal_confidence: Optional[int]
    current_pe: Optional[float]
    historical_pe_1yr: Optional[float]
    market_cap: Optional[float]
    latest_report_date: Optional[str]
    hypothesis_names: list[str]
