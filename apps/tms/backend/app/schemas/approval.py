from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel

from app.models.approval import ApprovalType, ApprovalStatus


class ApprovalCreate(BaseModel):
    """Request body for creating a new approval."""
    approval_type: ApprovalType
    title: str
    description: Optional[str] = None
    requested_by: Optional[str] = None
    entity_type: str
    entity_id: str
    amount: Optional[int] = None  # cents
    metadata: Optional[dict] = None
    expires_at: Optional[datetime] = None


class ApprovalResponse(BaseModel):
    """Response schema for an approval."""
    id: str
    approval_type: ApprovalType
    status: ApprovalStatus
    title: str
    description: Optional[str] = None
    requested_by: Optional[str] = None
    approved_by: Optional[str] = None
    entity_type: str
    entity_id: str
    amount: Optional[int] = None
    threshold_amount: Optional[int] = None
    metadata: Optional[dict] = None
    approved_at: Optional[datetime] = None
    rejected_at: Optional[datetime] = None
    rejection_reason: Optional[str] = None
    expires_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime


class RejectApprovalRequest(BaseModel):
    """Request body for rejecting an approval."""
    reason: Optional[str] = None


class ApproveApprovalRequest(BaseModel):
    """Request body for approving an approval."""
    approved_by: Optional[str] = "system"


class ApprovalThresholdResponse(BaseModel):
    """Response schema for a single threshold."""
    approval_type: ApprovalType
    max_auto_approve_amount: int
    enabled: bool
    notify_on_auto_approve: bool


class ApprovalSettingsResponse(BaseModel):
    """Response schema for approval settings."""
    id: str
    thresholds: List[ApprovalThresholdResponse]
    created_at: datetime
    updated_at: datetime


class UpdateThresholdRequest(BaseModel):
    """Request body for updating a single threshold."""
    approval_type: ApprovalType
    max_auto_approve_amount: int
    enabled: bool = True
    notify_on_auto_approve: bool = True


class UpdateThresholdsRequest(BaseModel):
    """Request body for updating multiple thresholds at once."""
    thresholds: List[UpdateThresholdRequest]
