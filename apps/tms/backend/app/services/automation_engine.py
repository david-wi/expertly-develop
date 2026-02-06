"""Automation engine for evaluating and executing automation rules."""

import logging
import random
from datetime import datetime
from typing import Any, Dict, List, Optional, Tuple

from bson import ObjectId

from app.database import get_database
from app.models.automation import (
    AutomationAction,
    AutomationRule,
    AutomationTrigger,
    RolloutStage,
)

logger = logging.getLogger(__name__)


def _resolve_dotpath(data: dict, path: str) -> Any:
    """Resolve a dot-notation path against a dictionary.

    Example: _resolve_dotpath({"shipment": {"equipment_type": "van"}}, "shipment.equipment_type")
    Returns "van"
    """
    parts = path.split(".")
    current = data
    for part in parts:
        if isinstance(current, dict):
            current = current.get(part)
        else:
            return None
        if current is None:
            return None
    return current


def evaluate_condition(condition: dict, entity_data: dict) -> Tuple[bool, dict]:
    """Evaluate a single condition against entity data.

    Returns (matched: bool, detail: dict with evaluation info).
    """
    field = condition.get("field", "")
    operator = condition.get("operator", "equals")
    expected = condition.get("value")

    actual = _resolve_dotpath(entity_data, field)

    detail = {
        "field": field,
        "operator": operator,
        "expected": expected,
        "actual": actual,
    }

    if actual is None:
        detail["matched"] = False
        detail["reason"] = f"Field '{field}' not found in entity data"
        return False, detail

    matched = False

    if operator == "equals":
        matched = str(actual) == str(expected)
    elif operator == "not_equals":
        matched = str(actual) != str(expected)
    elif operator == "greater_than":
        try:
            matched = float(actual) > float(expected)
        except (ValueError, TypeError):
            detail["reason"] = "Cannot compare non-numeric values"
    elif operator == "less_than":
        try:
            matched = float(actual) < float(expected)
        except (ValueError, TypeError):
            detail["reason"] = "Cannot compare non-numeric values"
    elif operator == "contains":
        matched = str(expected).lower() in str(actual).lower()
    elif operator == "in":
        if isinstance(expected, list):
            matched = str(actual) in [str(v) for v in expected]
        else:
            # Treat comma-separated string as list
            expected_list = [v.strip() for v in str(expected).split(",")]
            matched = str(actual) in expected_list
    elif operator == "starts_with":
        matched = str(actual).lower().startswith(str(expected).lower())
    else:
        detail["reason"] = f"Unknown operator: {operator}"

    detail["matched"] = matched
    return matched, detail


def evaluate_conditions(conditions: List[dict], entity_data: dict) -> Tuple[bool, List[dict]]:
    """Evaluate all conditions (AND logic) against entity data.

    Returns (all_matched: bool, details: list of per-condition evaluation dicts).
    """
    if not conditions:
        return True, []

    details = []
    all_matched = True

    for condition in conditions:
        matched, detail = evaluate_condition(condition, entity_data)
        details.append(detail)
        if not matched:
            all_matched = False

    return all_matched, details


async def execute_action(
    action: AutomationAction,
    action_config: dict,
    entity_data: dict,
    dry_run: bool = False,
) -> dict:
    """Execute an automation action.

    If dry_run=True, returns what would happen without doing it.
    """
    result = {
        "action": action,
        "action_config": action_config,
        "dry_run": dry_run,
    }

    if action == AutomationAction.CREATE_WORK_ITEM:
        work_type = action_config.get("work_type", "custom")
        title = action_config.get("title", "Auto-created work item")
        priority = action_config.get("priority", 50)
        description = action_config.get("description", "")

        result["description"] = f"Create work item: '{title}' (type={work_type}, priority={priority})"

        if not dry_run:
            db = get_database()
            from app.models.work_item import WorkItem, WorkItemType, WorkItemStatus
            from app.models.base import utc_now

            wi = WorkItem(
                work_type=work_type,
                status=WorkItemStatus.OPEN,
                title=title,
                description=description,
                priority=priority,
                shipment_id=ObjectId(entity_data.get("_id")) if entity_data.get("_id") else None,
            )
            await db.work_items.insert_one(wi.model_dump_mongo())
            result["work_item_id"] = str(wi.id)
            result["executed"] = True
        else:
            result["executed"] = False

    elif action == AutomationAction.SEND_NOTIFICATION:
        message = action_config.get("message", "Automation notification")
        result["description"] = f"Send notification: '{message}'"

        if not dry_run:
            from app.services.websocket_manager import manager
            await manager.broadcast("automation_notification", {
                "message": message,
                "entity_data_id": str(entity_data.get("_id", "")),
            })
            result["executed"] = True
        else:
            result["executed"] = False

    elif action == AutomationAction.UPDATE_STATUS:
        new_status = action_config.get("new_status", "")
        result["description"] = f"Update status to: '{new_status}'"

        if not dry_run:
            db = get_database()
            entity_id = entity_data.get("_id")
            if entity_id:
                # Try to detect collection from entity data
                if "shipment_number" in entity_data:
                    await db.shipments.update_one(
                        {"_id": entity_id},
                        {"$set": {"status": new_status, "updated_at": datetime.utcnow()}}
                    )
                elif "work_type" in entity_data:
                    await db.work_items.update_one(
                        {"_id": entity_id},
                        {"$set": {"status": new_status, "updated_at": datetime.utcnow()}}
                    )
            result["executed"] = True
        else:
            result["executed"] = False

    elif action == AutomationAction.ASSIGN_CARRIER:
        carrier_id = action_config.get("carrier_id", "")
        result["description"] = f"Assign carrier: {carrier_id}"

        if not dry_run and carrier_id:
            db = get_database()
            entity_id = entity_data.get("_id")
            if entity_id:
                await db.shipments.update_one(
                    {"_id": entity_id},
                    {"$set": {"carrier_id": ObjectId(carrier_id), "updated_at": datetime.utcnow()}}
                )
            result["executed"] = True
        else:
            result["executed"] = False

    elif action == AutomationAction.CREATE_TENDER:
        offered_rate = action_config.get("offered_rate", 0)
        carrier_id = action_config.get("carrier_id", "")
        result["description"] = f"Create tender at rate ${offered_rate} for carrier {carrier_id}"
        result["executed"] = not dry_run

    elif action == AutomationAction.AUTO_APPROVE:
        result["description"] = "Auto-approve the entity"
        result["executed"] = not dry_run

    elif action == AutomationAction.ESCALATE:
        escalation_target = action_config.get("target", "manager")
        message = action_config.get("message", "Requires attention")
        result["description"] = f"Escalate to {escalation_target}: '{message}'"

        if not dry_run:
            from app.services.websocket_manager import manager
            await manager.broadcast("automation_escalation", {
                "target": escalation_target,
                "message": message,
                "entity_data_id": str(entity_data.get("_id", "")),
            })
            result["executed"] = True
        else:
            result["executed"] = False

    elif action == AutomationAction.SEND_EMAIL:
        to_email = action_config.get("to_email", "")
        subject = action_config.get("subject", "")
        result["description"] = f"Send email to {to_email}: '{subject}'"
        result["executed"] = not dry_run

    else:
        result["description"] = f"Unknown action: {action}"
        result["executed"] = False

    return result


async def process_trigger(
    trigger_type: AutomationTrigger,
    entity_data: dict,
) -> List[dict]:
    """Process a trigger event against all matching automation rules.

    Finds enabled rules matching the trigger, evaluates conditions, and
    executes actions based on rollout stage.

    Returns a list of result dicts for each rule processed.
    """
    db = get_database()

    # Find all enabled rules for this trigger, ordered by priority desc
    cursor = db.automation_rules.find({
        "trigger": trigger_type,
        "enabled": True,
    }).sort("priority", -1)

    rules_docs = await cursor.to_list(200)
    results = []

    for doc in rules_docs:
        rule = AutomationRule(**doc)
        result = {
            "rule_id": str(rule.id),
            "rule_name": rule.name,
            "trigger": trigger_type,
            "rollout_stage": rule.rollout_stage,
        }

        # Skip disabled rollout
        if rule.rollout_stage == RolloutStage.DISABLED:
            result["skipped"] = True
            result["reason"] = "Rollout stage is disabled"
            results.append(result)
            continue

        # Evaluate conditions
        conditions_met, condition_details = evaluate_conditions(
            rule.conditions, entity_data
        )
        result["conditions_met"] = conditions_met
        result["condition_details"] = condition_details

        if not conditions_met:
            result["skipped"] = True
            result["reason"] = "Conditions not met"
            results.append(result)
            continue

        # Handle based on rollout stage
        if rule.rollout_stage == RolloutStage.SHADOW:
            # Evaluate but don't execute; log result
            action_result = await execute_action(
                rule.action, rule.action_config, entity_data, dry_run=True
            )
            result["action_result"] = action_result
            result["shadow"] = True

            # Record to shadow log
            rule.record_shadow_result({
                "conditions_met": conditions_met,
                "action_would_fire": True,
                "action": rule.action,
                "entity_id": str(entity_data.get("_id", "")),
            })
            rule.record_trigger()
            await db.automation_rules.update_one(
                {"_id": rule.id},
                {"$set": {
                    "shadow_log": rule.shadow_log,
                    "trigger_count": rule.trigger_count,
                    "last_triggered_at": rule.last_triggered_at,
                    "updated_at": rule.updated_at,
                }}
            )

        elif rule.rollout_stage == RolloutStage.PARTIAL:
            # Execute based on rollout_percentage
            roll = random.randint(1, 100)
            if roll <= rule.rollout_percentage:
                action_result = await execute_action(
                    rule.action, rule.action_config, entity_data, dry_run=False
                )
                result["action_result"] = action_result
                result["partial_executed"] = True
            else:
                action_result = await execute_action(
                    rule.action, rule.action_config, entity_data, dry_run=True
                )
                result["action_result"] = action_result
                result["partial_executed"] = False
                result["reason"] = f"Random roll {roll} exceeded rollout percentage {rule.rollout_percentage}"

            rule.record_trigger()
            await db.automation_rules.update_one(
                {"_id": rule.id},
                {"$set": {
                    "trigger_count": rule.trigger_count,
                    "last_triggered_at": rule.last_triggered_at,
                    "updated_at": rule.updated_at,
                }}
            )

        elif rule.rollout_stage == RolloutStage.FULL:
            # Execute for real
            action_result = await execute_action(
                rule.action, rule.action_config, entity_data, dry_run=False
            )
            result["action_result"] = action_result
            result["executed"] = True

            rule.record_trigger()
            await db.automation_rules.update_one(
                {"_id": rule.id},
                {"$set": {
                    "trigger_count": rule.trigger_count,
                    "last_triggered_at": rule.last_triggered_at,
                    "updated_at": rule.updated_at,
                }}
            )

        results.append(result)

    return results


async def test_rules(entity_type: str, entity_id: str) -> dict:
    """Test all rules against a specific entity in dry_run mode.

    Loads the entity, evaluates ALL rules (regardless of enabled/rollout),
    and returns which rules would match and what actions would fire.
    """
    db = get_database()

    # Load entity from the appropriate collection
    collection_map = {
        "shipment": "shipments",
        "tender": "tenders",
        "quote_request": "quote_requests",
        "work_item": "work_items",
        "invoice": "invoices",
    }

    collection_name = collection_map.get(entity_type)
    if not collection_name:
        return {
            "entity_type": entity_type,
            "entity_id": entity_id,
            "error": f"Unknown entity type: {entity_type}",
            "matched_rules": [],
            "actions_that_would_fire": [],
            "simulation_results": [],
        }

    entity_doc = await db[collection_name].find_one({"_id": ObjectId(entity_id)})
    if not entity_doc:
        return {
            "entity_type": entity_type,
            "entity_id": entity_id,
            "error": f"Entity not found: {entity_type}/{entity_id}",
            "matched_rules": [],
            "actions_that_would_fire": [],
            "simulation_results": [],
        }

    # Wrap entity data under the entity_type key for dot-notation access
    entity_data = {entity_type: _serialize_for_eval(entity_doc)}
    # Also include at top level for convenience
    entity_data.update(_serialize_for_eval(entity_doc))

    # Get ALL automation rules (regardless of enabled/rollout)
    cursor = db.automation_rules.find({}).sort("priority", -1)
    all_rules = await cursor.to_list(500)

    matched_rules = []
    actions_that_would_fire = []
    simulation_results = []

    for doc in all_rules:
        rule = AutomationRule(**doc)

        conditions_met, condition_details = evaluate_conditions(
            rule.conditions, entity_data
        )

        rule_result = {
            "rule_id": str(rule.id),
            "rule_name": rule.name,
            "trigger": rule.trigger,
            "action": rule.action,
            "action_config": rule.action_config,
            "conditions_met": conditions_met,
            "condition_details": condition_details,
        }

        matched_rules.append(rule_result)

        if conditions_met:
            action_result = await execute_action(
                rule.action, rule.action_config, entity_data, dry_run=True
            )
            actions_that_would_fire.append({
                "rule_id": str(rule.id),
                "rule_name": rule.name,
                **action_result,
            })
            simulation_results.append({
                "rule_id": str(rule.id),
                "rule_name": rule.name,
                "would_execute": True,
                "action_description": action_result.get("description", ""),
            })

    return {
        "entity_type": entity_type,
        "entity_id": entity_id,
        "matched_rules": matched_rules,
        "actions_that_would_fire": actions_that_would_fire,
        "simulation_results": simulation_results,
    }


def _serialize_for_eval(doc: dict) -> dict:
    """Convert MongoDB document types to strings for evaluation."""
    result = {}
    for key, value in doc.items():
        if isinstance(value, ObjectId):
            result[key] = str(value)
        elif isinstance(value, datetime):
            result[key] = value.isoformat()
        elif isinstance(value, dict):
            result[key] = _serialize_for_eval(value)
        elif isinstance(value, list):
            result[key] = [
                _serialize_for_eval(v) if isinstance(v, dict) else str(v) if isinstance(v, ObjectId) else v
                for v in value
            ]
        else:
            result[key] = value
    return result
