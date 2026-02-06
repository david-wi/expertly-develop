from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, status
from bson import ObjectId

from app.database import get_database
from app.models import TaskComment, TaskCommentCreate, TaskCommentUpdate
from app.api.deps import get_current_user
from identity_client.models import User as IdentityUser

router = APIRouter()


def serialize_comment(comment: dict) -> dict:
    """Convert ObjectIds to strings for response."""
    return {
        "id": str(comment["_id"]),
        "task_id": str(comment["task_id"]),
        "organization_id": str(comment["organization_id"]),
        "user_id": str(comment["user_id"]),
        "user_name": comment.get("user_name"),  # Stored at creation time
        "content": comment["content"],
        "attachment_ids": comment.get("attachment_ids", []),
        "created_at": comment["created_at"],
        "updated_at": comment["updated_at"],
    }


@router.get("/tasks/{task_id}/comments")
async def list_task_comments(
    task_id: str,
    current_user: IdentityUser = Depends(get_current_user)
) -> list[dict]:
    """List all comments for a task (regardless of task status)."""
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

    cursor = db.task_comments.find({
        "task_id": ObjectId(task_id),
        "deleted_at": None
    }).sort("created_at", 1)  # Chronological order

    comments = await cursor.to_list(200)
    return [serialize_comment(c) for c in comments]


@router.post("/tasks/{task_id}/comments", status_code=status.HTTP_201_CREATED)
async def create_task_comment(
    task_id: str,
    data: TaskCommentCreate,
    current_user: IdentityUser = Depends(get_current_user)
) -> dict:
    """Create a comment on a task."""
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

    # Create comment with user_name stored for display
    comment = TaskComment(
        task_id=ObjectId(task_id),
        organization_id=current_user.organization_id,
        user_id=current_user.id,
        user_name=current_user.name,  # Store name at creation time
        content=data.content,
        attachment_ids=data.attachment_ids,
    )

    await db.task_comments.insert_one(comment.model_dump_mongo())

    return serialize_comment(comment.model_dump_mongo())


@router.get("/comments/{comment_id}")
async def get_comment(
    comment_id: str,
    current_user: IdentityUser = Depends(get_current_user)
) -> dict:
    """Get a specific comment."""
    db = get_database()

    if not ObjectId.is_valid(comment_id):
        raise HTTPException(status_code=400, detail="Invalid comment ID")

    comment = await db.task_comments.find_one({
        "_id": ObjectId(comment_id),
        "organization_id": current_user.organization_id,
        "deleted_at": None
    })

    if not comment:
        raise HTTPException(status_code=404, detail="Comment not found")

    return serialize_comment(comment)


@router.patch("/comments/{comment_id}")
async def update_comment(
    comment_id: str,
    data: TaskCommentUpdate,
    current_user: IdentityUser = Depends(get_current_user)
) -> dict:
    """Update a comment. Only the author can update their comment."""
    db = get_database()

    if not ObjectId.is_valid(comment_id):
        raise HTTPException(status_code=400, detail="Invalid comment ID")

    update_data = data.model_dump(exclude_unset=True)
    if not update_data:
        raise HTTPException(status_code=400, detail="No fields to update")

    update_data["updated_at"] = datetime.now(timezone.utc)

    # Only allow author to update their own comment
    result = await db.task_comments.find_one_and_update(
        {
            "_id": ObjectId(comment_id),
            "organization_id": current_user.organization_id,
            "user_id": current_user.id,
            "deleted_at": None
        },
        {"$set": update_data},
        return_document=True
    )

    if not result:
        # Check if comment exists
        comment = await db.task_comments.find_one({
            "_id": ObjectId(comment_id),
            "organization_id": current_user.organization_id,
            "deleted_at": None
        })
        if not comment:
            raise HTTPException(status_code=404, detail="Comment not found")
        raise HTTPException(status_code=403, detail="You can only edit your own comments")

    return serialize_comment(result)


@router.delete("/comments/{comment_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_comment(
    comment_id: str,
    current_user: IdentityUser = Depends(get_current_user)
):
    """Delete a comment (soft delete). Only the author can delete their comment."""
    db = get_database()

    if not ObjectId.is_valid(comment_id):
        raise HTTPException(status_code=400, detail="Invalid comment ID")

    now = datetime.now(timezone.utc)

    # Only allow author to delete their own comment
    result = await db.task_comments.find_one_and_update(
        {
            "_id": ObjectId(comment_id),
            "organization_id": current_user.organization_id,
            "user_id": current_user.id,
            "deleted_at": None
        },
        {
            "$set": {
                "deleted_at": now,
                "updated_at": now
            }
        }
    )

    if not result:
        # Check if comment exists
        comment = await db.task_comments.find_one({
            "_id": ObjectId(comment_id),
            "organization_id": current_user.organization_id,
            "deleted_at": None
        })
        if not comment:
            raise HTTPException(status_code=404, detail="Comment not found")
        raise HTTPException(status_code=403, detail="You can only delete your own comments")
