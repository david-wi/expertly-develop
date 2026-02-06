from datetime import datetime
from enum import Enum
from typing import Any, List, Optional

from pydantic import Field

from .base import MongoModel, utc_now


class AutomationTrigger(str, Enum):
    """Events that can trigger an automation rule."""
    SHIPMENT_CREATED = "shipment_created"
    SHIPMENT_STATUS_CHANGED = "shipment_status_changed"
    TENDER_ACCEPTED = "tender_accepted"
    TENDER_DECLINED = "tender_declined"
    QUOTE_REQUEST_RECEIVED = "quote_request_received"
    WORK_ITEM_CREATED = "work_item_created"
    INVOICE_DUE = "invoice_due"
    CHECK_CALL_OVERDUE = "check_call_overdue"


class AutomationAction(str, Enum):
    """Actions an automation rule can perform."""
    CREATE_WORK_ITEM = "create_work_item"
    SEND_NOTIFICATION = "send_notification"
    ASSIGN_CARRIER = "assign_carrier"
    UPDATE_STATUS = "update_status"
    CREATE_TENDER = "create_tender"
    AUTO_APPROVE = "auto_approve"
    ESCALATE = "escalate"
    SEND_EMAIL = "send_email"


class RolloutStage(str, Enum):
    """Gradual rollout stages for automation rules."""
    DISABLED = "disabled"
    SHADOW = "shadow"
    PARTIAL = "partial"
    FULL = "full"


class AutomationCondition(MongoModel):
    """A single condition within an automation rule."""
    field: str  # e.g., "shipment.equipment_type", "tender.offered_rate"
    operator: str  # e.g., "equals", "greater_than", "less_than", "contains", "in"
    value: Any


class AutomationRule(MongoModel):
    """A user-defined automation rule with plain-English description."""

    name: str
    description: str = ""  # Plain-English description of what this rule does
    trigger: AutomationTrigger
    conditions: List[dict] = Field(default_factory=list)
    action: AutomationAction
    action_config: dict = Field(default_factory=dict)  # Action-specific configuration
    rollout_stage: RolloutStage = RolloutStage.DISABLED
    rollout_percentage: int = 0  # 0-100, for partial rollout
    priority: int = 50  # Higher = runs first
    enabled: bool = False
    last_triggered_at: Optional[datetime] = None
    trigger_count: int = 0
    shadow_log: List[dict] = Field(default_factory=list)  # Last 20 shadow mode results

    def record_shadow_result(self, result: dict) -> None:
        """Record a shadow mode execution result, keeping last 20."""
        result["timestamp"] = utc_now().isoformat()
        self.shadow_log.append(result)
        if len(self.shadow_log) > 20:
            self.shadow_log = self.shadow_log[-20:]
        self.mark_updated()

    def record_trigger(self) -> None:
        """Update trigger count and timestamp."""
        self.trigger_count += 1
        self.last_triggered_at = utc_now()
        self.mark_updated()
