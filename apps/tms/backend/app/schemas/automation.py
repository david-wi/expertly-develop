from datetime import datetime
from typing import Any, Dict, List, Optional

from pydantic import BaseModel

from app.models.automation import AutomationAction, AutomationTrigger, RolloutStage


class AutomationConditionSchema(BaseModel):
    field: str
    operator: str
    value: Any


class AutomationRuleCreate(BaseModel):
    name: str
    description: str = ""
    trigger: AutomationTrigger
    conditions: List[AutomationConditionSchema] = []
    action: AutomationAction
    action_config: Dict[str, Any] = {}
    rollout_stage: RolloutStage = RolloutStage.DISABLED
    rollout_percentage: int = 0
    priority: int = 50
    enabled: bool = False


class AutomationRuleUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    trigger: Optional[AutomationTrigger] = None
    conditions: Optional[List[AutomationConditionSchema]] = None
    action: Optional[AutomationAction] = None
    action_config: Optional[Dict[str, Any]] = None
    rollout_stage: Optional[RolloutStage] = None
    rollout_percentage: Optional[int] = None
    priority: Optional[int] = None
    enabled: Optional[bool] = None


class AutomationRuleResponse(BaseModel):
    id: str
    name: str
    description: str
    trigger: AutomationTrigger
    conditions: List[Dict[str, Any]]
    action: AutomationAction
    action_config: Dict[str, Any]
    rollout_stage: RolloutStage
    rollout_percentage: int
    priority: int
    enabled: bool
    last_triggered_at: Optional[datetime] = None
    trigger_count: int
    shadow_log: List[Dict[str, Any]]
    created_at: datetime
    updated_at: datetime


class RolloutUpdateRequest(BaseModel):
    rollout_stage: RolloutStage
    rollout_percentage: int = 0


class TestAutomationRequest(BaseModel):
    entity_type: str  # "shipment", "tender", "quote_request", "work_item"
    entity_id: str


class MatchedRuleResult(BaseModel):
    rule_id: str
    rule_name: str
    trigger: AutomationTrigger
    action: AutomationAction
    action_config: Dict[str, Any]
    conditions_met: bool
    condition_details: List[Dict[str, Any]] = []


class TestAutomationResponse(BaseModel):
    entity_type: str
    entity_id: str
    matched_rules: List[MatchedRuleResult]
    actions_that_would_fire: List[Dict[str, Any]]
    simulation_results: List[Dict[str, Any]]
