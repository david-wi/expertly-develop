import logging
from bson import ObjectId

from app.config import get_settings
from app.database import get_database
from app.models import Organization, OrganizationSettings, User, UserType, UserRole, Queue
from app.models.queue import ScopeType
from app.utils.auth import hash_api_key

logger = logging.getLogger(__name__)


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

    # Create default queues for David (user-scoped)
    # These are personal queues for the default user
    default_queues = [
        ("My Todos", "inbox", "Default queue for incoming tasks"),
        ("My Urgent Todos", "urgent", "High-priority tasks requiring immediate attention"),
        ("My Followups", "followup", "Tasks that need follow-up or are waiting on something"),
    ]

    for purpose, system_type, description in default_queues:
        queue = Queue(
            organization_id=org_id,
            purpose=purpose,
            description=description,
            scope_type=ScopeType.USER,
            scope_id=user_id,  # Owned by David
            is_system=False,
            system_type=system_type
        )
        await db.queues.insert_one(queue.model_dump_mongo())
        logger.info(f"Created queue for {user.name}: {purpose}")

    # Create indexes
    await create_indexes(db)

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
