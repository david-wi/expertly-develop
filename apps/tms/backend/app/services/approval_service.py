from typing import Optional

from bson import ObjectId

from app.database import get_database
from app.models.approval import Approval, ApprovalType, ApprovalStatus
from app.models.approval_settings import ApprovalSettings, ApprovalThreshold


# Default thresholds (used when settings are first created)
DEFAULT_THRESHOLDS = [
    ApprovalThreshold(
        approval_type=ApprovalType.RATE_OVERRIDE,
        max_auto_approve_amount=500_00,  # $500
        enabled=True,
        notify_on_auto_approve=True,
    ),
    ApprovalThreshold(
        approval_type=ApprovalType.CREDIT_EXTENSION,
        max_auto_approve_amount=1000_00,  # $1,000
        enabled=True,
        notify_on_auto_approve=True,
    ),
    ApprovalThreshold(
        approval_type=ApprovalType.HIGH_VALUE_SHIPMENT,
        max_auto_approve_amount=5000_00,  # $5,000
        enabled=True,
        notify_on_auto_approve=True,
    ),
    ApprovalThreshold(
        approval_type=ApprovalType.CARRIER_EXCEPTION,
        max_auto_approve_amount=0,  # always require manual
        enabled=True,
        notify_on_auto_approve=True,
    ),
    ApprovalThreshold(
        approval_type=ApprovalType.DISCOUNT_APPROVAL,
        max_auto_approve_amount=250_00,  # $250
        enabled=True,
        notify_on_auto_approve=True,
    ),
]


async def get_settings() -> ApprovalSettings:
    """Get or create default approval settings (singleton)."""
    db = get_database()
    doc = await db.approval_settings.find_one({})
    if doc:
        return ApprovalSettings(**doc)

    # Create default settings
    settings = ApprovalSettings(thresholds=DEFAULT_THRESHOLDS)
    await db.approval_settings.insert_one(settings.model_dump_mongo())
    return settings


async def update_threshold(
    approval_type: ApprovalType,
    max_auto_approve_amount: int,
    enabled: bool = True,
    notify_on_auto_approve: bool = True,
) -> ApprovalSettings:
    """Update a single approval threshold."""
    settings = await get_settings()
    db = get_database()

    # Find and update the threshold, or add a new one
    found = False
    for threshold in settings.thresholds:
        if threshold.approval_type == approval_type:
            threshold.max_auto_approve_amount = max_auto_approve_amount
            threshold.enabled = enabled
            threshold.notify_on_auto_approve = notify_on_auto_approve
            found = True
            break

    if not found:
        settings.thresholds.append(
            ApprovalThreshold(
                approval_type=approval_type,
                max_auto_approve_amount=max_auto_approve_amount,
                enabled=enabled,
                notify_on_auto_approve=notify_on_auto_approve,
            )
        )

    settings.mark_updated()
    await db.approval_settings.update_one(
        {"_id": settings.id},
        {"$set": settings.model_dump_mongo()},
    )
    return settings


async def update_thresholds_bulk(
    thresholds: list[dict],
) -> ApprovalSettings:
    """Update multiple thresholds at once."""
    settings = await get_settings()
    db = get_database()

    for t in thresholds:
        approval_type = t["approval_type"]
        found = False
        for threshold in settings.thresholds:
            if threshold.approval_type == approval_type:
                threshold.max_auto_approve_amount = t["max_auto_approve_amount"]
                threshold.enabled = t.get("enabled", True)
                threshold.notify_on_auto_approve = t.get("notify_on_auto_approve", True)
                found = True
                break
        if not found:
            settings.thresholds.append(
                ApprovalThreshold(
                    approval_type=approval_type,
                    max_auto_approve_amount=t["max_auto_approve_amount"],
                    enabled=t.get("enabled", True),
                    notify_on_auto_approve=t.get("notify_on_auto_approve", True),
                )
            )

    settings.mark_updated()
    await db.approval_settings.update_one(
        {"_id": settings.id},
        {"$set": settings.model_dump_mongo()},
    )
    return settings


async def request_approval(
    approval_type: ApprovalType,
    entity_type: str,
    entity_id: str,
    title: str,
    amount: Optional[int] = None,
    description: Optional[str] = None,
    requested_by: Optional[str] = None,
    metadata: Optional[dict] = None,
    expires_at=None,
) -> Approval:
    """
    Request a new approval.

    If the amount is within the auto-approval threshold for the given type,
    the approval is automatically approved. Otherwise it stays pending.
    """
    db = get_database()
    settings = await get_settings()

    approval = Approval(
        approval_type=approval_type,
        title=title,
        description=description,
        requested_by=requested_by,
        entity_type=entity_type,
        entity_id=ObjectId(entity_id),
        amount=amount,
        metadata=metadata,
        expires_at=expires_at,
    )

    # Check auto-approval threshold
    if amount is not None:
        for threshold in settings.thresholds:
            if threshold.approval_type == approval_type and threshold.enabled:
                if amount <= threshold.max_auto_approve_amount:
                    approval.auto_approve(threshold.max_auto_approve_amount)
                break

    await db.approvals.insert_one(approval.model_dump_mongo())
    return approval


async def approve_approval(approval_id: str, approved_by: str = "system") -> Approval:
    """Approve a pending approval."""
    db = get_database()

    doc = await db.approvals.find_one({"_id": ObjectId(approval_id)})
    if not doc:
        raise ValueError("Approval not found")

    approval = Approval(**doc)
    if approval.status != ApprovalStatus.PENDING:
        raise ValueError(f"Approval is not pending (current status: {approval.status})")

    approval.approve(approved_by)

    await db.approvals.update_one(
        {"_id": ObjectId(approval_id)},
        {"$set": approval.model_dump_mongo()},
    )
    return approval


async def reject_approval(
    approval_id: str,
    rejected_by: str = "system",
    reason: Optional[str] = None,
) -> Approval:
    """Reject a pending approval."""
    db = get_database()

    doc = await db.approvals.find_one({"_id": ObjectId(approval_id)})
    if not doc:
        raise ValueError("Approval not found")

    approval = Approval(**doc)
    if approval.status != ApprovalStatus.PENDING:
        raise ValueError(f"Approval is not pending (current status: {approval.status})")

    approval.reject(rejected_by, reason)

    await db.approvals.update_one(
        {"_id": ObjectId(approval_id)},
        {"$set": approval.model_dump_mongo()},
    )
    return approval
