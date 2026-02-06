from datetime import datetime
from enum import Enum
from typing import Optional

from .base import MongoModel, PyObjectId, utc_now


class ApprovalType(str, Enum):
    """Types of approvals in the TMS."""
    RATE_OVERRIDE = "rate_override"
    CREDIT_EXTENSION = "credit_extension"
    HIGH_VALUE_SHIPMENT = "high_value_shipment"
    CARRIER_EXCEPTION = "carrier_exception"
    DISCOUNT_APPROVAL = "discount_approval"


class ApprovalStatus(str, Enum):
    """Approval status."""
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"
    AUTO_APPROVED = "auto_approved"


class Approval(MongoModel):
    """Approval request for threshold-gated actions."""

    approval_type: ApprovalType
    status: ApprovalStatus = ApprovalStatus.PENDING

    # Display
    title: str
    description: Optional[str] = None

    # People
    requested_by: Optional[str] = None
    approved_by: Optional[str] = None

    # Entity reference
    entity_type: str  # e.g., "shipment", "tender", "invoice"
    entity_id: PyObjectId

    # Amounts
    amount: Optional[int] = None  # cents
    threshold_amount: Optional[int] = None  # the auto-approval threshold in cents

    # Arbitrary context
    metadata: Optional[dict] = None

    # Resolution timestamps
    approved_at: Optional[datetime] = None
    rejected_at: Optional[datetime] = None
    rejection_reason: Optional[str] = None

    # Expiry
    expires_at: Optional[datetime] = None

    def approve(self, approved_by: str) -> None:
        """Approve this approval request."""
        self.status = ApprovalStatus.APPROVED
        self.approved_by = approved_by
        self.approved_at = utc_now()
        self.mark_updated()

    def reject(self, rejected_by: str, reason: Optional[str] = None) -> None:
        """Reject this approval request."""
        self.status = ApprovalStatus.REJECTED
        self.approved_by = rejected_by
        self.rejected_at = utc_now()
        self.rejection_reason = reason
        self.mark_updated()

    def auto_approve(self, threshold_amount: int) -> None:
        """Auto-approve because amount is within threshold."""
        self.status = ApprovalStatus.AUTO_APPROVED
        self.threshold_amount = threshold_amount
        self.approved_by = "system"
        self.approved_at = utc_now()
        self.mark_updated()

    @property
    def is_expired(self) -> bool:
        """Check if this approval has expired."""
        if not self.expires_at:
            return False
        return utc_now() > self.expires_at and self.status == ApprovalStatus.PENDING
