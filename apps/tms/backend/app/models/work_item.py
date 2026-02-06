from datetime import datetime
from enum import Enum
from typing import Optional

from .base import MongoModel, PyObjectId, utc_now


class WorkItemType(str, Enum):
    """Types of work items in the unified inbox."""
    QUOTE_REQUEST = "quote_request"
    QUOTE_FOLLOWUP = "quote_followup"
    SHIPMENT_NEEDS_CARRIER = "shipment_needs_carrier"
    TENDER_PENDING = "tender_pending"
    CHECK_CALL_DUE = "check_call_due"
    DOCUMENT_NEEDED = "document_needed"
    INVOICE_READY = "invoice_ready"
    CUSTOMER_MESSAGE = "customer_message"
    CARRIER_MESSAGE = "carrier_message"
    EXCEPTION = "exception"
    APPROVAL_NEEDED = "approval_needed"
    CUSTOM = "custom"


class WorkItemStatus(str, Enum):
    """Work item status."""
    OPEN = "open"
    IN_PROGRESS = "in_progress"
    WAITING = "waiting"  # Waiting on external response
    DONE = "done"
    DISMISSED = "dismissed"


class WorkItem(MongoModel):
    """Unified work item for the broker's inbox."""

    work_type: WorkItemType
    status: WorkItemStatus = WorkItemStatus.OPEN

    # Display
    title: str
    description: Optional[str] = None
    priority: int = 50  # 0-100, higher = more urgent

    # Links (set whichever are relevant)
    quote_request_id: Optional[PyObjectId] = None
    quote_id: Optional[PyObjectId] = None
    shipment_id: Optional[PyObjectId] = None
    tender_id: Optional[PyObjectId] = None
    customer_id: Optional[PyObjectId] = None
    carrier_id: Optional[PyObjectId] = None
    invoice_id: Optional[PyObjectId] = None

    # Desk routing
    desk_id: Optional[str] = None  # Desk this work item is routed to

    # Assignment
    assigned_to: Optional[str] = None  # User ID
    assigned_at: Optional[datetime] = None

    # Timing
    due_at: Optional[datetime] = None
    snoozed_until: Optional[datetime] = None

    # Resolution
    completed_at: Optional[datetime] = None
    completed_by: Optional[str] = None
    resolution_notes: Optional[str] = None

    @property
    def is_overdue(self) -> bool:
        """Check if work item is past due."""
        if not self.due_at:
            return False
        return utc_now() > self.due_at and self.status in [WorkItemStatus.OPEN, WorkItemStatus.IN_PROGRESS]

    @property
    def is_snoozed(self) -> bool:
        """Check if work item is currently snoozed."""
        if not self.snoozed_until:
            return False
        return utc_now() < self.snoozed_until

    def complete(self, user_id: str, notes: Optional[str] = None) -> None:
        """Mark work item as complete."""
        self.status = WorkItemStatus.DONE
        self.completed_at = utc_now()
        self.completed_by = user_id
        self.resolution_notes = notes
        self.mark_updated()

    def snooze(self, until: datetime) -> None:
        """Snooze work item until a specific time."""
        self.snoozed_until = until
        self.mark_updated()

    def assign(self, user_id: str) -> None:
        """Assign work item to a user."""
        self.assigned_to = user_id
        self.assigned_at = utc_now()
        if self.status == WorkItemStatus.OPEN:
            self.status = WorkItemStatus.IN_PROGRESS
        self.mark_updated()
