import logging
from bson import ObjectId

from app.config import get_settings
from app.database import get_database
from app.models import Organization, OrganizationSettings, User, UserType, UserRole, Queue
from app.models.queue import ScopeType
from app.utils.auth import hash_api_key

logger = logging.getLogger(__name__)


async def ensure_indexes() -> None:
    """Ensure all required indexes exist. Safe to call multiple times."""
    db = get_database()
    await create_indexes(db)


async def seed_database() -> None:
    """
    Seed the database with default data for development.

    Creates:
    - Default organization (David)
    - Default user (David, owner)
    - System queues (Inbox, Urgent, Follow-up) - organization-wide
    """
    settings = get_settings()
    db = get_database()

    # Always ensure indexes exist (idempotent)
    await create_indexes(db)

    # Check if already seeded
    existing_org = await db.organizations.find_one({"is_default": True})
    if existing_org:
        logger.info("Database already seeded, skipping")
        return

    logger.info("Seeding database with default data...")

    # Create default organization
    org_id = ObjectId()
    org = Organization(
        id=org_id,
        name=settings.default_org_name,
        slug=settings.default_org_slug,
        settings=OrganizationSettings(),
        is_default=True
    )
    await db.organizations.insert_one(org.model_dump_mongo())
    logger.info(f"Created default organization: {org.name} ({org.id})")

    # Create default user
    user_id = ObjectId()
    user = User(
        id=user_id,
        organization_id=org_id,
        email=settings.default_user_email,
        name=settings.default_user_name,
        user_type=UserType.HUMAN,
        role=UserRole.OWNER,
        is_default=True,
        api_key_hash=hash_api_key(settings.default_api_key)
    )
    await db.users.insert_one(user.model_dump_mongo())
    logger.info(f"Created default user: {user.name} ({user.id})")

    # Create Inbox queue for David (user-scoped)
    inbox_queue = Queue(
        organization_id=org_id,
        purpose="Inbox",
        description="Default queue for incoming tasks",
        scope_type=ScopeType.USER,
        scope_id=user_id,
        is_system=True,
        system_type="inbox"
    )
    await db.queues.insert_one(inbox_queue.model_dump_mongo())
    logger.info(f"Created Inbox queue for {user.name}")

    logger.info("Database seeding complete!")
    logger.info(f"Default API key: {settings.default_api_key}")


async def create_indexes(db) -> None:
    """Create MongoDB indexes for performance."""
    # Organizations
    await db.organizations.create_index("slug", unique=True)
    await db.organizations.create_index("is_default")

    # Users
    await db.users.create_index([("organization_id", 1), ("email", 1)], unique=True)
    await db.users.create_index("api_key_hash")
    await db.users.create_index("is_default")

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

    # Task updates
    await db.task_updates.create_index("task_id")
    await db.task_updates.create_index([("task_id", 1), ("created_at", -1)])

    # Projects
    await db.projects.create_index("organization_id")
    await db.projects.create_index("parent_project_id")

    # SOPs
    await db.sops.create_index("organization_id")
    await db.sops.create_index("queue_ids")
    await db.sops.create_index("match_keywords")

    logger.info("Created database indexes")
