import json
import logging
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, status
from bson import ObjectId

from app.database import get_database
from app.models.task_suggestion import TaskSuggestion, TaskSuggestionCreate, TaskSuggestionUpdate
from app.api.deps import get_current_user
from identity_client.models import User as IdentityUser

logger = logging.getLogger(__name__)

router = APIRouter()


def serialize_suggestion(suggestion: dict) -> dict:
    """Convert ObjectIds to strings for response."""
    return {
        "id": str(suggestion["_id"]),
        "task_id": str(suggestion["task_id"]),
        "organization_id": str(suggestion["organization_id"]),
        "suggestion_type": suggestion["suggestion_type"],
        "status": suggestion["status"],
        "title": suggestion["title"],
        "content": suggestion["content"],
        "provider_data": suggestion.get("provider_data", {}),
        "created_by": suggestion.get("created_by", "ai"),
        "executed_at": suggestion.get("executed_at"),
        "created_at": suggestion["created_at"],
        "updated_at": suggestion["updated_at"],
    }


@router.get("/tasks/{task_id}/suggestions")
async def list_task_suggestions(
    task_id: str,
    current_user: IdentityUser = Depends(get_current_user)
) -> list[dict]:
    """List all suggestions for a task."""
    db = get_database()

    if not ObjectId.is_valid(task_id):
        raise HTTPException(status_code=400, detail="Invalid task ID")

    # Verify task exists and user has access
    task = await db.tasks.find_one({
        "_id": ObjectId(task_id),
        "organization_id": current_user.organization_id
    })
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    cursor = db.task_suggestions.find({
        "task_id": ObjectId(task_id),
        "deleted_at": None
    }).sort("created_at", 1)

    suggestions = await cursor.to_list(100)
    return [serialize_suggestion(s) for s in suggestions]


@router.post("/tasks/{task_id}/suggestions", status_code=status.HTTP_201_CREATED)
async def create_task_suggestion(
    task_id: str,
    data: TaskSuggestionCreate,
    current_user: IdentityUser = Depends(get_current_user)
) -> dict:
    """Create a suggestion on a task."""
    db = get_database()

    if not ObjectId.is_valid(task_id):
        raise HTTPException(status_code=400, detail="Invalid task ID")

    # Verify task exists and user has access
    task = await db.tasks.find_one({
        "_id": ObjectId(task_id),
        "organization_id": current_user.organization_id
    })
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    suggestion = TaskSuggestion(
        task_id=ObjectId(task_id),
        organization_id=current_user.organization_id,
        suggestion_type=data.suggestion_type,
        title=data.title,
        content=data.content,
        provider_data=data.provider_data,
        created_by=data.created_by,
    )

    await db.task_suggestions.insert_one(suggestion.model_dump_mongo())
    return serialize_suggestion(suggestion.model_dump_mongo())


@router.patch("/suggestions/{suggestion_id}")
async def update_suggestion(
    suggestion_id: str,
    data: TaskSuggestionUpdate,
    current_user: IdentityUser = Depends(get_current_user)
) -> dict:
    """Update a suggestion's content or status."""
    db = get_database()

    if not ObjectId.is_valid(suggestion_id):
        raise HTTPException(status_code=400, detail="Invalid suggestion ID")

    update_data = data.model_dump(exclude_unset=True)
    if not update_data:
        raise HTTPException(status_code=400, detail="No fields to update")

    update_data["updated_at"] = datetime.now(timezone.utc)

    result = await db.task_suggestions.find_one_and_update(
        {
            "_id": ObjectId(suggestion_id),
            "organization_id": current_user.organization_id,
            "deleted_at": None
        },
        {"$set": update_data},
        return_document=True
    )

    if not result:
        raise HTTPException(status_code=404, detail="Suggestion not found")

    return serialize_suggestion(result)


@router.delete("/suggestions/{suggestion_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_suggestion(
    suggestion_id: str,
    current_user: IdentityUser = Depends(get_current_user)
):
    """Soft-delete a suggestion."""
    db = get_database()

    if not ObjectId.is_valid(suggestion_id):
        raise HTTPException(status_code=400, detail="Invalid suggestion ID")

    now = datetime.now(timezone.utc)
    result = await db.task_suggestions.find_one_and_update(
        {
            "_id": ObjectId(suggestion_id),
            "organization_id": current_user.organization_id,
            "deleted_at": None
        },
        {"$set": {"deleted_at": now, "updated_at": now}}
    )

    if not result:
        raise HTTPException(status_code=404, detail="Suggestion not found")


@router.post("/suggestions/{suggestion_id}/execute")
async def execute_suggestion(
    suggestion_id: str,
    current_user: IdentityUser = Depends(get_current_user)
) -> dict:
    """
    Execute a suggestion: send Slack reply or return Gmail compose info.
    """
    db = get_database()

    if not ObjectId.is_valid(suggestion_id):
        raise HTTPException(status_code=400, detail="Invalid suggestion ID")

    suggestion = await db.task_suggestions.find_one({
        "_id": ObjectId(suggestion_id),
        "organization_id": current_user.organization_id,
        "deleted_at": None
    })

    if not suggestion:
        raise HTTPException(status_code=404, detail="Suggestion not found")

    if suggestion["status"] == "accepted":
        raise HTTPException(status_code=400, detail="Suggestion already executed")

    suggestion_type = suggestion["suggestion_type"]
    provider_data = suggestion.get("provider_data", {})
    content = suggestion["content"]

    if suggestion_type == "slack_reply":
        return await _execute_slack_reply(db, suggestion, provider_data, content, current_user)
    elif suggestion_type == "gmail_reply":
        return await _execute_gmail_reply(suggestion, provider_data, content)
    else:
        raise HTTPException(status_code=400, detail=f"Unsupported suggestion type: {suggestion_type}")


async def _execute_slack_reply(db, suggestion: dict, provider_data: dict, content: str, current_user) -> dict:
    """Execute a Slack reply suggestion by sending the message via Slack API."""
    from app.services.monitor_providers.slack import send_slack_message
    from app.services.encryption import decrypt_token

    connection_id = provider_data.get("connection_id")
    channel_id = provider_data.get("channel_id")
    thread_ts = provider_data.get("thread_ts")

    if not connection_id or not channel_id:
        raise HTTPException(status_code=400, detail="Missing Slack connection data")

    # Get the connection and decrypt access token
    connection = await db.connections.find_one({
        "_id": ObjectId(connection_id),
        "organization_id": current_user.organization_id,
        "status": "active"
    })
    if not connection:
        raise HTTPException(status_code=400, detail="Slack connection not found or expired")

    access_token = decrypt_token(connection.get("access_token_encrypted", ""))
    if not access_token:
        raise HTTPException(status_code=400, detail="Could not decrypt Slack access token")

    # Send the message
    try:
        result = await send_slack_message(access_token, channel_id, content, thread_ts=thread_ts)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Failed to send Slack message: {str(e)}")

    # Mark suggestion as accepted
    now = datetime.now(timezone.utc)
    await db.task_suggestions.update_one(
        {"_id": suggestion["_id"]},
        {"$set": {"status": "accepted", "executed_at": now, "updated_at": now}}
    )

    # Post the sent reply as a comment on the task discussion
    task_id = suggestion.get("task_id")
    if task_id:
        from app.models import TaskComment
        comment = TaskComment(
            organization_id=suggestion["organization_id"],
            task_id=task_id if isinstance(task_id, ObjectId) else ObjectId(task_id),
            user_id=str(current_user.id),
            user_name=current_user.name or current_user.email,
            content=f"**Replied in Slack:**\n> {content}",
        )
        await db.task_comments.insert_one(comment.model_dump_mongo())

    return {
        "action": "sent",
        "suggestion_type": "slack_reply",
        "channel_id": channel_id,
        "thread_ts": thread_ts,
        "message_ts": result.get("ts"),
        "permalink": provider_data.get("permalink"),
    }


async def _execute_gmail_reply(suggestion: dict, provider_data: dict, content: str) -> dict:
    """Return Gmail compose info for client-side execution."""
    thread_id = provider_data.get("thread_id", "")
    permalink = provider_data.get("permalink", "")

    # Build Gmail URL — if we have the permalink use it, otherwise construct from thread_id
    gmail_url = permalink or f"https://mail.google.com/mail/u/0/#inbox/{thread_id}"

    return {
        "action": "open_url",
        "suggestion_type": "gmail_reply",
        "url": gmail_url,
        "copy_content": content,
    }


GENERATE_SUGGESTIONS_SYSTEM_PROMPT = """You are a smart task assistant for David's task management system. You analyze active tasks and their context to suggest concrete next actions.

For each task, you'll receive:
- Task title, description, and source URL
- Task discussion/comments history
- Project context (if any): name, description, next steps, active tasks, project comments/timeline

Your job: determine if there's a clear, actionable next step David should take. Good suggestions include:
- A Slack reply to a thread (if the task came from Slack and needs a response)
- An email reply (if the task came from email and needs a response)
- A calendar event (if a meeting should be scheduled)

Guidelines:
1. Only suggest actions where you have enough context to draft a meaningful message
2. If a task is just a personal to-do with no communication needed, return no suggestions for it
3. For Slack replies: draft a natural, conversational reply matching the channel's tone
4. For email replies: draft a professional but friendly email
5. For calendar events: suggest a title, description, and approximate duration
6. You may suggest multiple actions for a single task if appropriate
7. IMPORTANT: Only suggest Slack replies if the task has Slack-related source_url or provider_data. Only suggest Gmail replies if the task has Gmail-related data.
8. If a task doesn't have communication context (no source_url, no Slack/Gmail data), suggest a general next step comment instead — but only if the project context makes a clear action obvious.

Respond with a JSON array. Each element:
{
  "task_index": 0,  // index in the tasks array
  "suggestions": [
    {
      "suggestion_type": "slack_reply" | "gmail_reply" | "calendar_event",
      "title": "Brief title for the suggestion",
      "content": "The draft message/reply text"
    }
  ]
}

If no suggestions are appropriate for any task, return an empty array: []
Only return valid JSON, no other text."""


@router.post("/tasks/generate-suggestions")
async def generate_task_suggestions(
    current_user: IdentityUser = Depends(get_current_user)
) -> dict:
    """
    Analyze active tasks and generate AI suggestions for the top 5
    that don't already have pending suggestions.
    """
    from app.services.ai_service import get_slack_title_service

    db = get_database()
    ai_service = get_slack_title_service()

    if not ai_service.is_configured():
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="AI service is not configured"
        )

    # Get user's queues (matches how frontend fetches "My Active Tasks")
    user_queues = await db.queues.find({
        "organization_id": current_user.organization_id,
        "scope_type": "user",
        "scope_id": current_user.id,
    }).to_list(100)
    user_queue_ids = [q["_id"] for q in user_queues]

    if not user_queue_ids:
        return {"generated": 0, "tasks_analyzed": 0, "suggestions": []}

    # Get user's active tasks (sorted by starred first, then sequence)
    active_tasks = await db.tasks.find({
        "organization_id": current_user.organization_id,
        "queue_id": {"$in": user_queue_ids},
        "status": {"$in": ["queued", "checked_out", "in_progress"]},
    }).sort([("is_starred", -1), ("sequence", 1), ("created_at", 1)]).to_list(50)

    if not active_tasks:
        return {"generated": 0, "tasks_analyzed": 0, "suggestions": []}

    # Find tasks without pending suggestions
    tasks_without_suggestions = []
    for task in active_tasks:
        task_id = task["_id"]
        pending_count = await db.task_suggestions.count_documents({
            "task_id": task_id,
            "status": "pending",
            "deleted_at": None,
        })
        if pending_count == 0:
            tasks_without_suggestions.append(task)
        if len(tasks_without_suggestions) >= 5:
            break

    if not tasks_without_suggestions:
        return {"generated": 0, "tasks_analyzed": 0, "suggestions": []}

    # Gather context for each task
    tasks_context = []
    for task in tasks_without_suggestions:
        task_id = task["_id"]
        ctx = {
            "title": task.get("title", ""),
            "description": task.get("description", ""),
            "source_url": task.get("source_url", ""),
            "status": task.get("status", ""),
            "phase": task.get("phase", ""),
        }

        # Get task comments
        comments = await db.task_comments.find({
            "task_id": task_id,
            "deleted_at": None,
        }).sort("created_at", 1).to_list(20)
        ctx["comments"] = [
            {
                "author": c.get("user_name", "Unknown"),
                "content": c.get("content", "")[:500],
                "created_at": str(c.get("created_at", "")),
            }
            for c in comments
        ]

        # Get existing suggestions (accepted/dismissed) for context
        past_suggestions = await db.task_suggestions.find({
            "task_id": task_id,
            "deleted_at": None,
            "status": {"$in": ["accepted", "dismissed"]},
        }).sort("created_at", -1).to_list(5)
        ctx["past_suggestions"] = [
            {
                "type": s.get("suggestion_type", ""),
                "title": s.get("title", ""),
                "status": s.get("status", ""),
            }
            for s in past_suggestions
        ]

        # Get project context if task has a project
        if task.get("project_id"):
            project = await db.projects.find_one({"_id": task["project_id"]})
            if project:
                # Get project's active tasks
                project_tasks = await db.tasks.find({
                    "project_id": project["_id"],
                    "status": {"$in": ["queued", "checked_out", "in_progress"]},
                }).to_list(20)

                ctx["project"] = {
                    "name": project.get("name", ""),
                    "description": project.get("description", ""),
                    "next_steps": project.get("next_steps", ""),
                    "active_tasks": [
                        t.get("title", "") for t in project_tasks
                    ],
                    "comments": [
                        {
                            "author": c.get("author_name", "Unknown"),
                            "content": c.get("content", "")[:500],
                            "source": c.get("import_source", ""),
                            "created_at": c.get("created_at", ""),
                        }
                        for c in (project.get("comments") or [])[-10:]
                    ],
                }

        tasks_context.append(ctx)

    # Call AI to generate suggestions
    prompt = f"Analyze these {len(tasks_context)} active tasks and suggest next actions:\n\n"
    for i, ctx in enumerate(tasks_context):
        prompt += f"--- Task {i} ---\n"
        prompt += f"Title: {ctx['title']}\n"
        if ctx.get("description"):
            prompt += f"Description: {ctx['description'][:500]}\n"
        if ctx.get("source_url"):
            prompt += f"Source URL: {ctx['source_url']}\n"
        prompt += f"Status: {ctx['status']}, Phase: {ctx.get('phase', 'N/A')}\n"
        if ctx.get("comments"):
            prompt += "Discussion:\n"
            for c in ctx["comments"]:
                prompt += f"  [{c['created_at']}] {c['author']}: {c['content']}\n"
        if ctx.get("past_suggestions"):
            prompt += "Previous suggestions (already handled):\n"
            for s in ctx["past_suggestions"]:
                prompt += f"  - {s['type']}: {s['title']} ({s['status']})\n"
        if ctx.get("project"):
            p = ctx["project"]
            prompt += f"Project: {p['name']}\n"
            if p.get("description"):
                prompt += f"  Description: {p['description'][:300]}\n"
            if p.get("next_steps"):
                prompt += f"  Next Steps: {p['next_steps'][:300]}\n"
            if p.get("active_tasks"):
                prompt += f"  Active Tasks: {', '.join(p['active_tasks'][:10])}\n"
            if p.get("comments"):
                prompt += "  Recent Timeline:\n"
                for c in p["comments"][-5:]:
                    source_label = f" ({c['source']})" if c.get("source") else ""
                    prompt += f"    [{c['created_at']}] {c['author']}{source_label}: {c['content'][:200]}\n"
        prompt += "\n"

    try:
        response_text = await ai_service._call_with_fallback(
            GENERATE_SUGGESTIONS_SYSTEM_PROMPT,
            prompt,
            max_tokens=2000,
            temperature=0.4,
            fallback_fn=lambda: "[]",
        )

        # Parse AI response
        ai_suggestions = json.loads(response_text)
    except (json.JSONDecodeError, Exception) as e:
        logger.error(f"Failed to generate suggestions: {e}")
        raise HTTPException(
            status_code=500,
            detail="Failed to generate suggestions. Please try again."
        )

    # Create TaskSuggestion records from AI response
    created_suggestions = []
    for item in ai_suggestions:
        task_idx = item.get("task_index", -1)
        if task_idx < 0 or task_idx >= len(tasks_without_suggestions):
            continue

        task = tasks_without_suggestions[task_idx]
        task_id = task["_id"]

        for s in item.get("suggestions", []):
            suggestion_type = s.get("suggestion_type", "")
            if suggestion_type not in ("slack_reply", "gmail_reply", "calendar_event"):
                continue

            # Build provider_data from task's existing data if available
            provider_data = {}
            if suggestion_type == "slack_reply":
                # Try to extract Slack context from task comments or source
                source_url = task.get("source_url", "")
                if "slack" in source_url.lower():
                    provider_data["permalink"] = source_url
                # Check for connection data in recent suggestions
                for ps in (await db.task_suggestions.find({
                    "task_id": task_id,
                    "suggestion_type": "slack_reply",
                    "deleted_at": None,
                }).sort("created_at", -1).to_list(1)):
                    pd = ps.get("provider_data", {})
                    provider_data.update({
                        k: v for k, v in pd.items()
                        if k in ("channel_id", "thread_ts", "connection_id", "permalink")
                    })
            elif suggestion_type == "gmail_reply":
                source_url = task.get("source_url", "")
                if "mail.google" in source_url.lower() or "gmail" in source_url.lower():
                    provider_data["permalink"] = source_url
                for ps in (await db.task_suggestions.find({
                    "task_id": task_id,
                    "suggestion_type": "gmail_reply",
                    "deleted_at": None,
                }).sort("created_at", -1).to_list(1)):
                    pd = ps.get("provider_data", {})
                    provider_data.update({
                        k: v for k, v in pd.items()
                        if k in ("thread_id", "message_id", "to", "subject", "connection_id", "permalink")
                    })

            suggestion = TaskSuggestion(
                task_id=task_id,
                organization_id=current_user.organization_id,
                suggestion_type=suggestion_type,
                title=s.get("title", "Suggested action"),
                content=s.get("content", ""),
                provider_data=provider_data,
                created_by="ai",
            )
            result = await db.task_suggestions.insert_one(suggestion.model_dump_mongo())
            created_suggestions.append({
                "id": str(result.inserted_id),
                "task_id": str(task_id),
                "task_title": task.get("title", ""),
                "suggestion_type": suggestion_type,
                "title": s.get("title", ""),
                "content": s.get("content", ""),
                "provider_data": provider_data,
            })

    return {
        "generated": len(created_suggestions),
        "tasks_analyzed": len(tasks_without_suggestions),
        "suggestions": created_suggestions,
    }
