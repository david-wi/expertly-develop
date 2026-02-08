"""
Endpoint for checking Slack-sourced tasks against their current thread state
to detect resolution and post update comments.
"""
import logging
import re
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, status
from bson import ObjectId

from app.database import get_database
from app.models import TaskComment, TaskStatus, TaskPhase
from app.api.deps import get_current_user
from app.api.v1.websocket import emit_event
from app.api.v1.tasks import serialize_task, add_task_completion_to_project_timeline
from app.services.ai_service import get_slack_title_service
from app.services.encryption import decrypt_token
from app.services.monitor_providers.slack import SlackMonitorAdapter
from identity_client.models import User as IdentityUser

logger = logging.getLogger(__name__)

router = APIRouter()


def _extract_existing_ts_markers(comments: list[dict]) -> set[str]:
    """Extract ts markers from existing Thread Update Check comments.

    Looks for hidden <!-- ts:... --> markers in comment content to avoid
    re-posting messages that were already reported.
    """
    markers = set()
    pattern = re.compile(r"<!-- ts:([\d.]+) -->")
    for comment in comments:
        content = comment.get("content", "")
        for match in pattern.finditer(content):
            markers.add(match.group(1))
    return markers


def _format_thread_message(msg: dict, sender_name: str | None = None) -> str:
    """Format a single thread message for display in a comment."""
    ts = msg.get("ts", "")
    text = msg.get("text", "")
    name = sender_name or msg.get("user", "Unknown")

    # Format timestamp for display
    ts_display = ""
    if ts:
        try:
            dt = datetime.fromtimestamp(float(ts), tz=timezone.utc)
            ts_display = dt.strftime("%b %d, %I:%M %p")
        except (ValueError, OSError):
            ts_display = ""

    time_part = f" ({ts_display})" if ts_display else ""
    quoted = f"> **@{name}**{time_part}:\n> {text}"
    marker = f"\n<!-- ts:{ts} -->" if ts else ""
    return quoted + marker


@router.post("/tasks/check-completed")
async def check_completed_tasks(
    current_user: IdentityUser = Depends(get_current_user),
) -> dict:
    """
    Check active Slack-sourced tasks for thread resolution.

    For each task:
    1. Fetches the current Slack thread
    2. Compares against original thread state and previously reported messages
    3. If new messages found, uses AI to check if the task has been resolved
    4. Posts a comment with the new messages and optionally marks the task completed
    """
    db = get_database()
    ai_service = get_slack_title_service()

    # Get user's queues
    user_queues = await db.queues.find({
        "organization_id": current_user.organization_id,
        "scope_type": "user",
        "scope_id": current_user.id,
    }).to_list(None)
    user_queue_ids = [q["_id"] for q in user_queues]

    if not user_queue_ids:
        return _build_response([], 0)

    # Get active tasks with source_monitor_id (Slack-sourced)
    active_tasks = await db.tasks.find({
        "organization_id": current_user.organization_id,
        "queue_id": {"$in": user_queue_ids},
        "status": {"$in": ["queued", "checked_out", "in_progress"]},
        "source_monitor_id": {"$ne": None},
    }).to_list(None)

    if not active_tasks:
        return _build_response([], 0)

    # Cache monitors and connections to avoid redundant lookups
    monitor_cache: dict[str, dict] = {}
    connection_cache: dict[str, dict] = {}

    details = []
    for task in active_tasks:
        task_id = str(task["_id"])
        try:
            result = await _check_single_task(
                db, task, current_user, ai_service,
                monitor_cache, connection_cache,
            )
            details.append(result)
        except Exception as e:
            logger.error(f"Error checking task {task_id}: {e}")
            details.append({
                "task_id": task_id,
                "task_title": task.get("title", ""),
                "action": "error",
                "message": str(e),
            })

    return _build_response(details, len(active_tasks))


async def _check_single_task(
    db,
    task: dict,
    current_user: IdentityUser,
    ai_service,
    monitor_cache: dict,
    connection_cache: dict,
) -> dict:
    """Check a single task for thread updates/resolution."""
    task_id = str(task["_id"])
    task_title = task.get("title", "")

    # Extract channel_id and thread_ts from input_data
    monitor_event = (task.get("input_data") or {}).get("_monitor_event", {})
    event_data = monitor_event.get("event_data", {})
    channel_id = event_data.get("channel")
    thread_ts = event_data.get("thread_ts") or event_data.get("ts")

    if not channel_id or not thread_ts:
        return {
            "task_id": task_id,
            "task_title": task_title,
            "action": "skipped",
            "message": "No Slack channel/thread data",
        }

    # Look up monitor and connection
    monitor_id = str(task.get("source_monitor_id", ""))
    adapter = await _get_slack_adapter(
        db, monitor_id, current_user.organization_id,
        monitor_cache, connection_cache,
    )
    if not adapter:
        return {
            "task_id": task_id,
            "task_title": task_title,
            "action": "error",
            "message": "Could not get Slack connection for monitor",
        }

    # Fetch current thread state
    try:
        context = await adapter._fetch_message_context(
            channel_id, thread_ts, thread_ts=thread_ts,
        )
    except Exception as e:
        return {
            "task_id": task_id,
            "task_title": task_title,
            "action": "error",
            "message": f"Slack API error: {e}",
        }

    if not context:
        return {
            "task_id": task_id,
            "task_title": task_title,
            "action": "skipped",
            "message": "Could not fetch thread context",
        }

    current_thread = context.get("thread", [])
    if not current_thread:
        return {
            "task_id": task_id,
            "task_title": task_title,
            "action": "skipped",
            "message": "Thread is empty",
        }

    # Get original thread messages (stored at task creation time)
    original_thread = (monitor_event.get("context_data") or {}).get("thread", [])
    original_ts_set = {msg.get("ts") for msg in original_thread if msg.get("ts")}

    # Get previously reported ts markers from comments
    task_comments = await db.task_comments.find({
        "task_id": task["_id"],
        "deleted_at": None,
    }).to_list(200)
    reported_ts_set = _extract_existing_ts_markers(task_comments)

    # Find new messages (not in original set, not already reported)
    known_ts = original_ts_set | reported_ts_set
    new_messages = [
        msg for msg in current_thread
        if msg.get("ts") and msg["ts"] not in known_ts
    ]

    if not new_messages:
        return {
            "task_id": task_id,
            "task_title": task_title,
            "action": "skipped",
            "message": "No new messages",
        }

    # Resolve sender names for new messages
    for msg in new_messages:
        user_id = msg.get("user")
        if user_id:
            name = await adapter._resolve_user_name(user_id)
            if name:
                msg["_resolved_name"] = name

    # Build thread text for AI analysis
    thread_text = _build_thread_text(current_thread, adapter)

    # Get original message text
    original_message = event_data.get("text", "")

    # Check if resolved via AI
    is_resolved = False
    if ai_service.is_configured():
        try:
            is_resolved = await ai_service.check_task_resolution(
                original_message, task_title, thread_text,
            )
        except Exception as e:
            logger.warning(f"AI resolution check failed for task {task_id}: {e}")

    # Build permalink
    permalink = event_data.get("permalink", "")
    if not permalink and channel_id and thread_ts:
        # Construct a basic Slack permalink
        permalink = f"https://slack.com/archives/{channel_id}/p{thread_ts.replace('.', '')}"

    # Format and post comment
    if is_resolved:
        comment_content = _format_resolved_comment(new_messages, permalink)
    else:
        comment_content = _format_update_comment(new_messages, permalink)

    # Post the comment
    comment = TaskComment(
        task_id=task["_id"],
        organization_id=current_user.organization_id,
        user_id=str(current_user.id),
        user_name="Thread Update Check",
        content=comment_content,
    )
    await db.task_comments.insert_one(comment.model_dump_mongo())

    # If resolved, complete the task
    if is_resolved:
        now = datetime.now(timezone.utc)
        result = await db.tasks.find_one_and_update(
            {
                "_id": task["_id"],
                "status": {"$in": ["queued", "checked_out", "in_progress"]},
            },
            {
                "$set": {
                    "status": TaskStatus.COMPLETED.value,
                    "phase": TaskPhase.APPROVED.value,
                    "completed_at": now,
                    "updated_at": now,
                }
            },
            return_document=True,
        )
        if result:
            await add_task_completion_to_project_timeline(result, current_user, db)
            serialized = serialize_task(result)
            await emit_event(
                str(current_user.organization_id), "task.completed", serialized,
            )

        return {
            "task_id": task_id,
            "task_title": task_title,
            "action": "completed",
            "message": f"Resolved - {len(new_messages)} new message(s)",
        }
    else:
        return {
            "task_id": task_id,
            "task_title": task_title,
            "action": "updated",
            "message": f"{len(new_messages)} new message(s) posted as comment",
        }


async def _get_slack_adapter(
    db,
    monitor_id: str,
    organization_id: str,
    monitor_cache: dict,
    connection_cache: dict,
) -> SlackMonitorAdapter | None:
    """Get a SlackMonitorAdapter for a monitor, using caches."""
    # Check monitor cache
    if monitor_id in monitor_cache:
        monitor = monitor_cache[monitor_id]
    else:
        if not ObjectId.is_valid(monitor_id):
            return None
        monitor = await db.monitors.find_one({
            "_id": ObjectId(monitor_id),
            "organization_id": organization_id,
        })
        if not monitor:
            return None
        monitor_cache[monitor_id] = monitor

    connection_id = str(monitor.get("connection_id", ""))

    # Check connection cache
    if connection_id in connection_cache:
        connection = connection_cache[connection_id]
    else:
        if not ObjectId.is_valid(connection_id):
            return None
        connection = await db.connections.find_one({
            "_id": ObjectId(connection_id),
            "organization_id": organization_id,
            "status": "active",
        })
        if not connection:
            return None
        connection_cache[connection_id] = connection

    # Decrypt token
    access_token = decrypt_token(connection.get("access_token_encrypted", ""))
    if not access_token:
        return None

    # Build adapter
    connection_data = {
        "access_token": access_token,
        "provider_user_id": connection.get("provider_user_id"),
    }
    provider_config = monitor.get("provider_config", {})

    return SlackMonitorAdapter(connection_data, provider_config)


def _build_thread_text(thread_messages: list[dict], adapter: SlackMonitorAdapter) -> str:
    """Build a plain text representation of the full thread for AI analysis."""
    lines = []
    for msg in thread_messages:
        user_id = msg.get("user", "Unknown")
        name = adapter._user_name_cache.get(user_id, user_id)
        text = msg.get("text", "")
        lines.append(f"{name}: {text}")
    return "\n".join(lines)


def _format_resolved_comment(new_messages: list[dict], permalink: str) -> str:
    """Format a comment for a resolved task."""
    parts = ["**Task Resolved -- Thread Activity**\n"]
    parts.append("The following messages indicate this has been resolved:\n")

    for msg in new_messages:
        name = msg.get("_resolved_name", msg.get("user", "Unknown"))
        parts.append(_format_thread_message(msg, sender_name=name))
        parts.append("")

    if permalink:
        parts.append(f"[View in Slack]({permalink})")
        parts.append("")

    parts.append("*Auto-detected by Thread Update Check*")
    return "\n".join(parts)


def _format_update_comment(new_messages: list[dict], permalink: str) -> str:
    """Format a comment for updated (but not resolved) task."""
    count = len(new_messages)
    parts = [f"**Thread Update** ({count} new message{'s' if count != 1 else ''})\n"]

    for msg in new_messages:
        name = msg.get("_resolved_name", msg.get("user", "Unknown"))
        parts.append(_format_thread_message(msg, sender_name=name))
        parts.append("")

    if permalink:
        parts.append(f"[View in Slack]({permalink})")
        parts.append("")

    parts.append("*Auto-detected by Thread Update Check*")
    return "\n".join(parts)


def _build_response(details: list[dict], total_checked: int) -> dict:
    """Build the endpoint response from per-task details."""
    tasks_completed = sum(1 for d in details if d.get("action") == "completed")
    tasks_updated = sum(1 for d in details if d.get("action") == "updated")
    tasks_skipped = sum(1 for d in details if d.get("action") == "skipped")
    errors = sum(1 for d in details if d.get("action") == "error")

    # tasks_checked = only tasks where Slack was actually contacted
    # (completed + updated + those skipped with "No new messages")
    actually_checked = sum(
        1 for d in details
        if d.get("action") in ("completed", "updated")
        or (d.get("action") == "skipped" and d.get("message") == "No new messages")
    )

    return {
        "tasks_checked": actually_checked,
        "tasks_total": total_checked,
        "tasks_completed": tasks_completed,
        "tasks_updated": tasks_updated,
        "tasks_skipped": tasks_skipped,
        "errors": errors,
        "details": details,
    }
