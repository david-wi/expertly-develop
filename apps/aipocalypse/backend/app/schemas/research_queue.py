from typing import Optional
from pydantic import BaseModel, Field

class QueueItemCreate(BaseModel):
    company_id: str
    company_name: str
    company_ticker: str
    priority: int = 0
    notes: str = ""

class QueueItemBatchCreate(BaseModel):
    items: list[QueueItemCreate]

class QueueItemResponse(BaseModel):
    id: str
    company_id: str
    company_name: str
    company_ticker: str
    status: str
    priority: int
    started_at: Optional[str]
    completed_at: Optional[str]
    report_id: Optional[str]
    error_message: Optional[str]
    retry_count: int
    notes: str
    created_at: str
    updated_at: str

class QueueStatusResponse(BaseModel):
    queued: int
    in_progress: int
    completed: int
    failed: int
    total: int
