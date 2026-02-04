from datetime import datetime
from typing import Optional
from pydantic import BaseModel

from app.models.work_item import WorkItemType, WorkItemStatus


class WorkItemCreate(BaseModel):
    work_type: WorkItemType
    title: str
    description: Optional[str] = None
    priority: int = 50
    quote_request_id: Optional[str] = None
    quote_id: Optional[str] = None
    shipment_id: Optional[str] = None
    tender_id: Optional[str] = None
    customer_id: Optional[str] = None
    carrier_id: Optional[str] = None
    invoice_id: Optional[str] = None
    assigned_to: Optional[str] = None
    due_at: Optional[datetime] = None


class WorkItemUpdate(BaseModel):
    status: Optional[WorkItemStatus] = None
    title: Optional[str] = None
    description: Optional[str] = None
    priority: Optional[int] = None
    assigned_to: Optional[str] = None
    due_at: Optional[datetime] = None
    snoozed_until: Optional[datetime] = None
    resolution_notes: Optional[str] = None


class WorkItemResponse(BaseModel):
    id: str
    work_type: WorkItemType
    status: WorkItemStatus
    title: str
    description: Optional[str] = None
    priority: int
    quote_request_id: Optional[str] = None
    quote_id: Optional[str] = None
    shipment_id: Optional[str] = None
    tender_id: Optional[str] = None
    customer_id: Optional[str] = None
    carrier_id: Optional[str] = None
    invoice_id: Optional[str] = None
    assigned_to: Optional[str] = None
    assigned_at: Optional[datetime] = None
    due_at: Optional[datetime] = None
    snoozed_until: Optional[datetime] = None
    is_overdue: bool
    is_snoozed: bool
    completed_at: Optional[datetime] = None
    completed_by: Optional[str] = None
    resolution_notes: Optional[str] = None
    created_at: datetime
    updated_at: datetime
