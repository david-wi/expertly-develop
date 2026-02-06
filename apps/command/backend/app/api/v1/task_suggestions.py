from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, status
from bson import ObjectId

from app.database import get_database
from app.models.task_suggestion import TaskSuggestion, TaskSuggestionCreate, TaskSuggestionUpdate
from app.api.deps import get_current_user
from identity_client.models import User as IdentityUser

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
