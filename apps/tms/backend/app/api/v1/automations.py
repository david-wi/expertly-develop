from typing import List, Optional

from fastapi import APIRouter, HTTPException
from bson import ObjectId

from app.database import get_database
from app.models.automation import AutomationRule, AutomationTrigger, RolloutStage
from app.schemas.automation import (
    AutomationRuleCreate,
    AutomationRuleResponse,
    AutomationRuleUpdate,
    RolloutUpdateRequest,
    TestAutomationRequest,
    TestAutomationResponse,
    MatchedRuleResult,
)
from app.services.automation_engine import test_rules
from app.services.websocket_manager import manager

router = APIRouter()


def rule_to_response(rule: AutomationRule) -> AutomationRuleResponse:
    return AutomationRuleResponse(
        id=str(rule.id),
        name=rule.name,
        description=rule.description,
        trigger=rule.trigger,
        conditions=rule.conditions,
        action=rule.action,
        action_config=rule.action_config,
        rollout_stage=rule.rollout_stage,
        rollout_percentage=rule.rollout_percentage,
        priority=rule.priority,
        enabled=rule.enabled,
        last_triggered_at=rule.last_triggered_at,
        trigger_count=rule.trigger_count,
        shadow_log=rule.shadow_log,
        created_at=rule.created_at,
        updated_at=rule.updated_at,
    )


@router.get("", response_model=List[AutomationRuleResponse])
async def list_automations(
    trigger: Optional[AutomationTrigger] = None,
    enabled: Optional[bool] = None,
    rollout_stage: Optional[RolloutStage] = None,
):
    """List all automation rules with optional filters."""
    db = get_database()

    query = {}
    if trigger:
        query["trigger"] = trigger
    if enabled is not None:
        query["enabled"] = enabled
    if rollout_stage:
        query["rollout_stage"] = rollout_stage

    cursor = db.automation_rules.find(query).sort([("priority", -1), ("created_at", -1)])
    docs = await cursor.to_list(500)

    return [rule_to_response(AutomationRule(**doc)) for doc in docs]


@router.get("/{rule_id}", response_model=AutomationRuleResponse)
async def get_automation(rule_id: str):
    """Get a single automation rule with its shadow log."""
    db = get_database()

    doc = await db.automation_rules.find_one({"_id": ObjectId(rule_id)})
    if not doc:
        raise HTTPException(status_code=404, detail="Automation rule not found")

    return rule_to_response(AutomationRule(**doc))


@router.post("", response_model=AutomationRuleResponse)
async def create_automation(data: AutomationRuleCreate):
    """Create a new automation rule."""
    db = get_database()

    rule_data = data.model_dump()
    # Convert conditions from schema to dicts
    rule_data["conditions"] = [c.model_dump() if hasattr(c, "model_dump") else c for c in (data.conditions or [])]

    rule = AutomationRule(**rule_data)
    await db.automation_rules.insert_one(rule.model_dump_mongo())

    await manager.broadcast("automation_created", {
        "rule_id": str(rule.id),
        "name": rule.name,
    })

    return rule_to_response(rule)


@router.patch("/{rule_id}", response_model=AutomationRuleResponse)
async def update_automation(rule_id: str, data: AutomationRuleUpdate):
    """Update an automation rule."""
    db = get_database()

    doc = await db.automation_rules.find_one({"_id": ObjectId(rule_id)})
    if not doc:
        raise HTTPException(status_code=404, detail="Automation rule not found")

    rule = AutomationRule(**doc)

    update_data = data.model_dump(exclude_unset=True)

    # Convert conditions if provided
    if "conditions" in update_data and update_data["conditions"] is not None:
        update_data["conditions"] = [
            c.model_dump() if hasattr(c, "model_dump") else c
            for c in update_data["conditions"]
        ]

    for field, value in update_data.items():
        setattr(rule, field, value)

    rule.mark_updated()

    await db.automation_rules.update_one(
        {"_id": ObjectId(rule_id)},
        {"$set": rule.model_dump_mongo()}
    )

    await manager.broadcast("automation_updated", {
        "rule_id": str(rule.id),
        "name": rule.name,
    })

    return rule_to_response(rule)


@router.delete("/{rule_id}")
async def delete_automation(rule_id: str):
    """Delete an automation rule."""
    db = get_database()

    result = await db.automation_rules.delete_one({"_id": ObjectId(rule_id)})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Automation rule not found")

    await manager.broadcast("automation_deleted", {"rule_id": rule_id})

    return {"status": "deleted", "rule_id": rule_id}


@router.post("/{rule_id}/toggle", response_model=AutomationRuleResponse)
async def toggle_automation(rule_id: str):
    """Enable or disable an automation rule."""
    db = get_database()

    doc = await db.automation_rules.find_one({"_id": ObjectId(rule_id)})
    if not doc:
        raise HTTPException(status_code=404, detail="Automation rule not found")

    rule = AutomationRule(**doc)
    rule.enabled = not rule.enabled
    rule.mark_updated()

    await db.automation_rules.update_one(
        {"_id": ObjectId(rule_id)},
        {"$set": {"enabled": rule.enabled, "updated_at": rule.updated_at}}
    )

    await manager.broadcast("automation_toggled", {
        "rule_id": str(rule.id),
        "name": rule.name,
        "enabled": rule.enabled,
    })

    return rule_to_response(rule)


@router.post("/{rule_id}/rollout", response_model=AutomationRuleResponse)
async def update_rollout(rule_id: str, data: RolloutUpdateRequest):
    """Change the rollout stage and percentage of an automation rule."""
    db = get_database()

    doc = await db.automation_rules.find_one({"_id": ObjectId(rule_id)})
    if not doc:
        raise HTTPException(status_code=404, detail="Automation rule not found")

    rule = AutomationRule(**doc)
    rule.rollout_stage = data.rollout_stage
    rule.rollout_percentage = max(0, min(100, data.rollout_percentage))
    rule.mark_updated()

    await db.automation_rules.update_one(
        {"_id": ObjectId(rule_id)},
        {"$set": {
            "rollout_stage": rule.rollout_stage,
            "rollout_percentage": rule.rollout_percentage,
            "updated_at": rule.updated_at,
        }}
    )

    await manager.broadcast("automation_rollout_changed", {
        "rule_id": str(rule.id),
        "name": rule.name,
        "rollout_stage": rule.rollout_stage,
        "rollout_percentage": rule.rollout_percentage,
    })

    return rule_to_response(rule)


@router.post("/test", response_model=TestAutomationResponse)
async def test_automation(data: TestAutomationRequest):
    """Test automation rules against a specific entity (sandbox)."""
    result = await test_rules(data.entity_type, data.entity_id)

    if "error" in result:
        raise HTTPException(status_code=400, detail=result["error"])

    # Convert matched_rules to MatchedRuleResult objects
    matched = []
    for mr in result.get("matched_rules", []):
        matched.append(MatchedRuleResult(
            rule_id=mr["rule_id"],
            rule_name=mr["rule_name"],
            trigger=mr["trigger"],
            action=mr["action"],
            action_config=mr["action_config"],
            conditions_met=mr["conditions_met"],
            condition_details=mr.get("condition_details", []),
        ))

    return TestAutomationResponse(
        entity_type=result["entity_type"],
        entity_id=result["entity_id"],
        matched_rules=matched,
        actions_that_would_fire=result.get("actions_that_would_fire", []),
        simulation_results=result.get("simulation_results", []),
    )


@router.get("/{rule_id}/log")
async def get_automation_log(rule_id: str):
    """Get the shadow mode execution log for an automation rule."""
    db = get_database()

    doc = await db.automation_rules.find_one({"_id": ObjectId(rule_id)})
    if not doc:
        raise HTTPException(status_code=404, detail="Automation rule not found")

    rule = AutomationRule(**doc)
    return {
        "rule_id": str(rule.id),
        "rule_name": rule.name,
        "shadow_log": rule.shadow_log,
        "trigger_count": rule.trigger_count,
        "last_triggered_at": rule.last_triggered_at,
    }
