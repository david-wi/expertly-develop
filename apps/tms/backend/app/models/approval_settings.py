from typing import List, Optional
from pydantic import BaseModel, Field

from .base import MongoModel
from .approval import ApprovalType


class ApprovalThreshold(BaseModel):
    """Threshold configuration for a specific approval type."""

    approval_type: ApprovalType
    max_auto_approve_amount: int  # cents, e.g. 500000 = $5,000
    enabled: bool = True
    notify_on_auto_approve: bool = True


class ApprovalSettings(MongoModel):
    """Singleton document holding all approval threshold settings."""

    thresholds: List[ApprovalThreshold] = Field(default_factory=list)
