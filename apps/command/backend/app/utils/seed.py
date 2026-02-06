import logging

from app.database import get_database

logger = logging.getLogger(__name__)


async def ensure_indexes() -> None:
    """Ensure all required indexes exist. Safe to call multiple times."""
    db = get_database()
    await create_indexes(db)


async def seed_database() -> None:
    """
    Seed the database with indexes and required data.

    Note: Users and organizations are managed by the Identity service.
    System queues (Inbox, Approvals) are created on-demand when users
    access the app, via the queue service.
    """
    db = get_database()

    # Always ensure indexes exist (idempotent)
    await create_indexes(db)

    logger.info("Database indexes created/verified.")


async def create_indexes(db) -> None:
    """Create MongoDB indexes for performance."""
    # Note: Users and organizations are managed by Identity service.
    # No local user/organization indexes needed.

    # Teams
    await db.teams.create_index("organization_id")
    await db.teams.create_index("member_ids")

    # Queues - indexed by (organization, scope)
    await db.queues.create_index("organization_id")
    await db.queues.create_index([("organization_id", 1), ("is_system", 1)])
    await db.queues.create_index([("organization_id", 1), ("scope_type", 1), ("scope_id", 1)])

    # Tasks
    await db.tasks.create_index("organization_id")
    await db.tasks.create_index("queue_id")
    await db.tasks.create_index("status")
    await db.tasks.create_index("assigned_to_id")
    await db.tasks.create_index([("queue_id", 1), ("status", 1), ("priority", 1)])
    await db.tasks.create_index("project_id")
    await db.tasks.create_index("parent_task_id")
    # Sparse index for cross-monitor dedup on source_url
    await db.tasks.create_index(
        [("organization_id", 1), ("source_url", 1)],
        sparse=True,
    )

    # Task updates
    await db.task_updates.create_index("task_id")
    await db.task_updates.create_index([("task_id", 1), ("created_at", -1)])

    # Task attachments
    await db.task_attachments.create_index("task_id")
    await db.task_attachments.create_index("organization_id")
    await db.task_attachments.create_index([("task_id", 1), ("deleted_at", 1)])

    # Task comments
    await db.task_comments.create_index("task_id")
    await db.task_comments.create_index("organization_id")
    await db.task_comments.create_index([("task_id", 1), ("deleted_at", 1), ("created_at", 1)])

    # Projects
    await db.projects.create_index("organization_id")
    await db.projects.create_index("parent_project_id")

    # SOPs
    await db.sops.create_index("organization_id")
    await db.sops.create_index("queue_ids")
    await db.sops.create_index("match_keywords")

    # Monitors
    await db.monitors.create_index("organization_id")
    await db.monitors.create_index([("organization_id", 1), ("status", 1)])
    await db.monitors.create_index([("organization_id", 1), ("provider", 1)])
    await db.monitors.create_index([("organization_id", 1), ("project_id", 1)])
    await db.monitors.create_index([("status", 1), ("last_polled_at", 1)])
    await db.monitors.create_index("deleted_at")

    # Monitor events
    await db.monitor_events.create_index("organization_id")
    await db.monitor_events.create_index("monitor_id")
    await db.monitor_events.create_index([("monitor_id", 1), ("provider_event_id", 1)], unique=True)
    await db.monitor_events.create_index([("monitor_id", 1), ("created_at", -1)])
    await db.monitor_events.create_index([("organization_id", 1), ("processed", 1)])

    # Task dependencies
    await db.tasks.create_index("depends_on")

    # Notifications
    await db.notifications.create_index("organization_id")
    await db.notifications.create_index("user_id")
    await db.notifications.create_index([("organization_id", 1), ("user_id", 1), ("read", 1), ("created_at", -1)])
    await db.notifications.create_index([("user_id", 1), ("read", 1), ("dismissed", 1)])

    # Bot activities
    await db.bot_activities.create_index("organization_id")
    await db.bot_activities.create_index("bot_id")
    await db.bot_activities.create_index([("organization_id", 1), ("bot_id", 1), ("created_at", -1)])
    await db.bot_activities.create_index([("bot_id", 1), ("activity_type", 1), ("created_at", -1)])

    # Documents
    await db.documents.create_index("organization_id")
    await db.documents.create_index("project_id")
    await db.documents.create_index("task_id")
    await db.documents.create_index("purpose")
    await db.documents.create_index([("organization_id", 1), ("project_id", 1), ("deleted_at", 1)])
    await db.documents.create_index([("organization_id", 1), ("task_id", 1), ("deleted_at", 1)])
    await db.documents.create_index([("organization_id", 1), ("purpose", 1), ("deleted_at", 1)])
    await db.documents.create_index([("document_key", 1), ("version", -1)])

    # Artifacts (from artifacts-mongo package)
    await db.artifacts.create_index("organization_id")
    await db.artifacts.create_index([("organization_id", 1), ("task_id", 1)])
    await db.artifacts.create_index([("organization_id", 1), ("project_id", 1)])
    await db.artifacts.create_index([("organization_id", 1), ("status", 1)])
    await db.artifacts.create_index("document_id")

    # Artifact versions
    await db.artifact_versions.create_index("artifact_id")
    await db.artifact_versions.create_index([("artifact_id", 1), ("version_number", -1)])

    logger.info("Created database indexes")
