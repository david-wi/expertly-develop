"""
Notification API endpoints.
"""
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, status
from bson import ObjectId

from app.database import get_database
from app.models import NotificationType
from app.api.deps import get_current_user
from app.services.notification_service import NotificationService
from identity_client.models import User as IdentityUser

router = APIRouter()


def serialize_notification(notification: dict) -> dict:
    """Convert ObjectIds to strings in notification document."""
    result = {
        "id": str(notification["_id"]),
        "organization_id": str(notification["organization_id"]),
        "user_id": str(notification["user_id"]),
        "notification_type": notification["notification_type"],
        "title": notification["title"],
        "message": notification["message"],
        "read": notification.get("read", False),
        "read_at": notification.get("read_at"),
        "dismissed": notification.get("dismissed", False),
        "action_url": notification.get("action_url"),
        "created_at": notification["created_at"],
    }

    if notification.get("task_id"):
        result["task_id"] = str(notification["task_id"])
    if notification.get("actor_id"):
        result["actor_id"] = str(notification["actor_id"])
    # Use stored actor_name from notification document
    if notification.get("actor_name"):
        result["actor_name"] = notification["actor_name"]

    return result


@router.get("")
async def list_notifications(
    unread_only: bool = False,
    notification_type: str | None = None,
    limit: int = 50,
    offset: int = 0,
    current_user: IdentityUser = Depends(get_current_user)
) -> list[dict]:
    """
    List notifications for the current user.

    Args:
        unread_only: Only return unread notifications
        notification_type: Filter by notification type
        limit: Maximum number of notifications to return
        offset: Number of notifications to skip
    """
    db = get_database()

    query = {
        "user_id": current_user.id,
        "organization_id": current_user.organization_id,
        "dismissed": False
    }

    if unread_only:
        query["read"] = False

    if notification_type:
        query["notification_type"] = notification_type

    cursor = db.notifications.find(query).sort("created_at", -1).skip(offset).limit(limit)
    notifications = await cursor.to_list(limit)

    # actor_name is now stored in notification document at creation time
    return [serialize_notification(n) for n in notifications]


@router.get("/unread-count")
async def get_unread_count(
    current_user: IdentityUser = Depends(get_current_user)
) -> dict:
    """Get count of unread notifications."""
    notif_service = NotificationService()
    count = await notif_service.get_unread_count(
        current_user.id,
        current_user.organization_id
    )
    return {"count": count}


@router.get("/{notification_id}")
async def get_notification(
    notification_id: str,
    current_user: IdentityUser = Depends(get_current_user)
) -> dict:
    """Get a specific notification."""
    db = get_database()

    if not ObjectId.is_valid(notification_id):
        raise HTTPException(status_code=400, detail="Invalid notification ID")

    notification = await db.notifications.find_one({
        "_id": ObjectId(notification_id),
        "user_id": current_user.id,
        "organization_id": current_user.organization_id
    })

    if not notification:
        raise HTTPException(status_code=404, detail="Notification not found")

    # actor_name is stored in notification document at creation time
    return serialize_notification(notification)


@router.post("/{notification_id}/read")
async def mark_notification_read(
    notification_id: str,
    current_user: IdentityUser = Depends(get_current_user)
) -> dict:
    """Mark a notification as read."""
    if not ObjectId.is_valid(notification_id):
        raise HTTPException(status_code=400, detail="Invalid notification ID")

    notif_service = NotificationService()
    success = await notif_service.mark_as_read(
        ObjectId(notification_id),
        current_user.id
    )

    if not success:
        # Check if notification exists
        db = get_database()
        notification = await db.notifications.find_one({
            "_id": ObjectId(notification_id),
            "user_id": current_user.id
        })
        if not notification:
            raise HTTPException(status_code=404, detail="Notification not found")
        # Already read
        return {"success": True, "already_read": True}

    return {"success": True}


@router.post("/read-all")
async def mark_all_notifications_read(
    current_user: IdentityUser = Depends(get_current_user)
) -> dict:
    """Mark all notifications as read."""
    notif_service = NotificationService()
    count = await notif_service.mark_all_as_read(
        current_user.id,
        current_user.organization_id
    )
    return {"success": True, "marked_count": count}


@router.post("/{notification_id}/dismiss")
async def dismiss_notification(
    notification_id: str,
    current_user: IdentityUser = Depends(get_current_user)
) -> dict:
    """Dismiss a notification (hide it from view)."""
    if not ObjectId.is_valid(notification_id):
        raise HTTPException(status_code=400, detail="Invalid notification ID")

    notif_service = NotificationService()
    success = await notif_service.dismiss_notification(
        ObjectId(notification_id),
        current_user.id
    )

    if not success:
        raise HTTPException(status_code=404, detail="Notification not found")

    return {"success": True}


@router.delete("/{notification_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_notification(
    notification_id: str,
    current_user: IdentityUser = Depends(get_current_user)
):
    """Delete a notification permanently."""
    db = get_database()

    if not ObjectId.is_valid(notification_id):
        raise HTTPException(status_code=400, detail="Invalid notification ID")

    result = await db.notifications.delete_one({
        "_id": ObjectId(notification_id),
        "user_id": current_user.id,
        "organization_id": current_user.organization_id
    })

    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Notification not found")
