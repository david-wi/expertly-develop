from typing import List, Optional
from fastapi import APIRouter, HTTPException
from bson import ObjectId

from app.database import get_database
from app.models.approval import Approval, ApprovalType, ApprovalStatus
from app.schemas.approval import (
    ApprovalCreate,
    ApprovalResponse,
    ApprovalSettingsResponse,
    ApprovalThresholdResponse,
    ApproveApprovalRequest,
    RejectApprovalRequest,
    UpdateThresholdsRequest,
)
from app.services import approval_service

router = APIRouter()


def approval_to_response(a: Approval) -> ApprovalResponse:
    return ApprovalResponse(
        id=str(a.id),
        approval_type=a.approval_type,
        status=a.status,
        title=a.title,
        description=a.description,
        requested_by=a.requested_by,
        approved_by=a.approved_by,
        entity_type=a.entity_type,
        entity_id=str(a.entity_id),
        amount=a.amount,
        threshold_amount=a.threshold_amount,
        metadata=a.metadata,
        approved_at=a.approved_at,
        rejected_at=a.rejected_at,
        rejection_reason=a.rejection_reason,
        expires_at=a.expires_at,
        created_at=a.created_at,
        updated_at=a.updated_at,
    )


@router.get("/settings", response_model=ApprovalSettingsResponse)
async def get_approval_settings():
    """Get approval threshold settings."""
    settings = await approval_service.get_settings()
    return ApprovalSettingsResponse(
        id=str(settings.id),
        thresholds=[
            ApprovalThresholdResponse(
                approval_type=t.approval_type,
                max_auto_approve_amount=t.max_auto_approve_amount,
                enabled=t.enabled,
                notify_on_auto_approve=t.notify_on_auto_approve,
            )
            for t in settings.thresholds
        ],
        created_at=settings.created_at,
        updated_at=settings.updated_at,
    )


@router.patch("/settings/thresholds", response_model=ApprovalSettingsResponse)
async def update_thresholds(data: UpdateThresholdsRequest):
    """Update approval thresholds."""
    thresholds_dicts = [t.model_dump() for t in data.thresholds]
    settings = await approval_service.update_thresholds_bulk(thresholds_dicts)
    return ApprovalSettingsResponse(
        id=str(settings.id),
        thresholds=[
            ApprovalThresholdResponse(
                approval_type=t.approval_type,
                max_auto_approve_amount=t.max_auto_approve_amount,
                enabled=t.enabled,
                notify_on_auto_approve=t.notify_on_auto_approve,
            )
            for t in settings.thresholds
        ],
        created_at=settings.created_at,
        updated_at=settings.updated_at,
    )


@router.get("", response_model=List[ApprovalResponse])
async def list_approvals(
    status: Optional[ApprovalStatus] = None,
    approval_type: Optional[ApprovalType] = None,
    entity_type: Optional[str] = None,
):
    """List approvals with optional filters."""
    db = get_database()

    query = {}
    if status:
        query["status"] = status
    if approval_type:
        query["approval_type"] = approval_type
    if entity_type:
        query["entity_type"] = entity_type

    cursor = db.approvals.find(query).sort("created_at", -1)
    docs = await cursor.to_list(1000)

    return [approval_to_response(Approval(**doc)) for doc in docs]


@router.get("/{approval_id}", response_model=ApprovalResponse)
async def get_approval(approval_id: str):
    """Get a single approval by ID."""
    db = get_database()

    doc = await db.approvals.find_one({"_id": ObjectId(approval_id)})
    if not doc:
        raise HTTPException(status_code=404, detail="Approval not found")

    return approval_to_response(Approval(**doc))


@router.post("", response_model=ApprovalResponse)
async def create_approval(data: ApprovalCreate):
    """Request a new approval (may auto-approve based on thresholds)."""
    approval = await approval_service.request_approval(
        approval_type=data.approval_type,
        entity_type=data.entity_type,
        entity_id=data.entity_id,
        title=data.title,
        amount=data.amount,
        description=data.description,
        requested_by=data.requested_by,
        metadata=data.metadata,
        expires_at=data.expires_at,
    )
    return approval_to_response(approval)


@router.post("/{approval_id}/approve", response_model=ApprovalResponse)
async def approve(approval_id: str, data: ApproveApprovalRequest = ApproveApprovalRequest()):
    """Approve a pending approval."""
    try:
        approval = await approval_service.approve_approval(
            approval_id, approved_by=data.approved_by or "system"
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    return approval_to_response(approval)


@router.post("/{approval_id}/reject", response_model=ApprovalResponse)
async def reject(approval_id: str, data: RejectApprovalRequest = RejectApprovalRequest()):
    """Reject a pending approval with an optional reason."""
    try:
        approval = await approval_service.reject_approval(
            approval_id, rejected_by="system", reason=data.reason
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    return approval_to_response(approval)
