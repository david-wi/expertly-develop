from typing import Optional
from datetime import datetime
from pydantic import Field
from .base import MongoModel

class ResearchQueueItem(MongoModel):
    company_id: str
    company_name: str
    company_ticker: str
    status: str = "queued"  # queued, in_progress, completed, failed
    priority: int = 0  # higher = processed first
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    report_id: Optional[str] = None
    error_message: Optional[str] = None
    retry_count: int = 0
    notes: str = ""
