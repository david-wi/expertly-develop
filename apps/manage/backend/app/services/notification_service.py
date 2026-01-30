"""
Notification service for creating and managing notifications.
"""
import logging
from datetime import datetime, timezone
from typing import Optional

from bson import ObjectId

from app.database import get_database
from app.models import Notification, NotificationType

logger = logging.getLogger(__name__)


class NotificationService:
    """Service for managing notifications."""

    def __init__(self):
        self.db = get_database()

    async def create_notification(
        self,
        organization_id: ObjectId,
        user_id: ObjectId,
        notification_type: NotificationType,
        title: str,
        message: str,
        task_id: Optional[ObjectId] = None,
        actor_id: Optional[ObjectId] = None,
        action_url: Optional[str] = None
    ) -> Notification:
        """
        Create a new notification.

        Args:
            organization_id: Organization the notification belongs to
            user_id: User to notify (recipient)
            notification_type: Type of notification
            title: Short title for the notification
            message: Detailed message
            task_id: Related task if applicable
            actor_id: User who triggered the notification
            action_url: URL to navigate to when clicked

        Returns:
            The created notification
        """
        notification = Notification(
            organization_id=organization_id,
            user_id=user_id,
            notification_type=notification_type,
            title=title,
            message=message,
            task_id=task_id,
            actor_id=actor_id,
            action_url=action_url
        )

        await self.db.notifications.insert_one(notification.model_dump_mongo())
        logger.info(
            f"Created notification {notification.id} for user {user_id}: {title}"
        )

        # TODO: Emit WebSocket event for real-time delivery
        # await self.emit_notification(notification)

        return notification

    async def notify_task_assigned(
        self,
        task: dict,
        assigned_by_id: Optional[ObjectId] = None
    ) -> Optional[Notification]:
        """
        Create a notification when a task is assigned to a user.

        Args:
            task: The task document
            assigned_by_id: User who made the assignment (actor)

        Returns:
            The created notification or None if no assignee
        """
        assignee_id = task.get("assigned_to_id")
        if not assignee_id:
            return None

        # Don't notify if user assigned to themselves
        if assigned_by_id and assigned_by_id == assignee_id:
            return None

        return await self.create_notification(
            organization_id=task["organization_id"],
            user_id=assignee_id,
            notification_type=NotificationType.TASK_ASSIGNED,
            title="Task Assigned",
            message=f"You've been assigned: {task.get('title', 'Untitled task')}",
            task_id=task["_id"],
            actor_id=assigned_by_id,
            action_url=f"/tasks?taskId={task['_id']}"
        )

    async def notify_approval_needed(
        self,
        task: dict,
        requester_id: ObjectId
    ) -> Optional[Notification]:
        """
        Create a notification when a task requires approval.

        Args:
            task: The task document requiring approval
            requester_id: User who is requesting approval

        Returns:
            The created notification or None if no approver set
        """
        approver_id = task.get("approver_id")
        if not approver_id:
            return None

        return await self.create_notification(
            organization_id=task["organization_id"],
            user_id=approver_id,
            notification_type=NotificationType.APPROVAL_NEEDED,
            title="Approval Required",
            message=f"Please review: {task.get('title', 'Untitled task')}",
            task_id=task["_id"],
            actor_id=requester_id,
            action_url=f"/tasks?taskId={task['_id']}"
        )

    async def notify_task_completed(
        self,
        task: dict,
        completed_by_id: ObjectId
    ) -> list[Notification]:
        """
        Notify relevant users when a task is completed.

        Notifies task creator and any watchers.

        Args:
            task: The completed task document
            completed_by_id: User who completed the task

        Returns:
            List of created notifications
        """
        notifications = []

        # Notify the task's original assignee if different from completer
        assigned_to = task.get("assigned_to_id")
        if assigned_to and assigned_to != completed_by_id:
            notif = await self.create_notification(
                organization_id=task["organization_id"],
                user_id=assigned_to,
                notification_type=NotificationType.TASK_COMPLETED,
                title="Task Completed",
                message=f"Task completed: {task.get('title', 'Untitled task')}",
                task_id=task["_id"],
                actor_id=completed_by_id,
                action_url=f"/tasks?taskId={task['_id']}"
            )
            notifications.append(notif)

        return notifications

    async def notify_task_unblocked(
        self,
        task: dict,
        completed_task_title: str
    ) -> Optional[Notification]:
        """
        Notify the assignee when a task becomes unblocked.

        Args:
            task: The unblocked task document
            completed_task_title: Title of the task that completed

        Returns:
            The created notification or None
        """
        assignee_id = task.get("assigned_to_id")
        if not assignee_id:
            return None

        return await self.create_notification(
            organization_id=task["organization_id"],
            user_id=assignee_id,
            notification_type=NotificationType.TASK_UNBLOCKED,
            title="Task Unblocked",
            message=f"'{task.get('title')}' is now ready ('{completed_task_title}' completed)",
            task_id=task["_id"],
            action_url=f"/tasks?taskId={task['_id']}"
        )

    async def notify_bot_failure(
        self,
        organization_id: ObjectId,
        bot_id: ObjectId,
        bot_name: str,
        task: dict,
        error_message: str,
        admin_ids: list[ObjectId]
    ) -> list[Notification]:
        """
        Notify admins when a bot fails a task.

        Args:
            organization_id: Organization ID
            bot_id: The bot that failed
            bot_name: Name of the bot
            task: The failed task
            error_message: Error description
            admin_ids: List of admin user IDs to notify

        Returns:
            List of created notifications
        """
        notifications = []

        for admin_id in admin_ids:
            notif = await self.create_notification(
                organization_id=organization_id,
                user_id=admin_id,
                notification_type=NotificationType.BOT_FAILURE_ALERT,
                title="Bot Task Failed",
                message=f"{bot_name} failed: {task.get('title', 'task')} - {error_message}",
                task_id=task["_id"],
                actor_id=bot_id,
                action_url=f"/bots/{bot_id}"
            )
            notifications.append(notif)

        return notifications

    async def mark_as_read(
        self,
        notification_id: ObjectId,
        user_id: ObjectId
    ) -> bool:
        """
        Mark a notification as read.

        Args:
            notification_id: The notification to mark
            user_id: The user marking it (for authorization)

        Returns:
            True if updated, False otherwise
        """
        result = await self.db.notifications.update_one(
            {
                "_id": notification_id,
                "user_id": user_id,
                "read": False
            },
            {
                "$set": {
                    "read": True,
                    "read_at": datetime.now(timezone.utc)
                }
            }
        )
        return result.modified_count > 0

    async def mark_all_as_read(
        self,
        user_id: ObjectId,
        organization_id: ObjectId
    ) -> int:
        """
        Mark all notifications for a user as read.

        Args:
            user_id: The user
            organization_id: Organization for filtering

        Returns:
            Number of notifications marked as read
        """
        result = await self.db.notifications.update_many(
            {
                "user_id": user_id,
                "organization_id": organization_id,
                "read": False
            },
            {
                "$set": {
                    "read": True,
                    "read_at": datetime.now(timezone.utc)
                }
            }
        )
        return result.modified_count

    async def dismiss_notification(
        self,
        notification_id: ObjectId,
        user_id: ObjectId
    ) -> bool:
        """
        Dismiss a notification (hide it from the user).

        Args:
            notification_id: The notification to dismiss
            user_id: The user dismissing it

        Returns:
            True if updated, False otherwise
        """
        result = await self.db.notifications.update_one(
            {
                "_id": notification_id,
                "user_id": user_id
            },
            {
                "$set": {
                    "dismissed": True,
                    "dismissed_at": datetime.now(timezone.utc)
                }
            }
        )
        return result.modified_count > 0

    async def get_unread_count(
        self,
        user_id: ObjectId,
        organization_id: ObjectId
    ) -> int:
        """
        Get count of unread notifications for a user.

        Args:
            user_id: The user
            organization_id: Organization for filtering

        Returns:
            Count of unread notifications
        """
        return await self.db.notifications.count_documents({
            "user_id": user_id,
            "organization_id": organization_id,
            "read": False,
            "dismissed": False
        })
