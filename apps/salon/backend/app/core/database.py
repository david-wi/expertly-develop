from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase
from typing import Optional
from ..config import settings


class Database:
    client: Optional[AsyncIOMotorClient] = None
    database: Optional[AsyncIOMotorDatabase] = None


db = Database()


async def init_db() -> None:
    """Initialize database connection and create indexes."""
    db.client = AsyncIOMotorClient(settings.mongodb_url)
    db.database = db.client[settings.mongodb_database]

    # Create indexes
    await create_indexes()


async def close_db() -> None:
    """Close database connection."""
    if db.client:
        db.client.close()


async def create_indexes() -> None:
    """Create necessary indexes for collections."""
    if db.database is None:
        return

    # Salons
    await db.database.salons.create_index("slug", unique=True)

    # Salon Memberships (links Identity users to salons)
    await db.database.salon_memberships.create_index("identity_user_id", unique=True)
    await db.database.salon_memberships.create_index("salon_id")
    await db.database.salon_memberships.create_index("email")

    # Staff
    await db.database.staff.create_index("salon_id")
    await db.database.staff.create_index([("salon_id", 1), ("email", 1)], unique=True)

    # Services
    await db.database.services.create_index("salon_id")
    await db.database.services.create_index("category_id")

    # Service Categories
    await db.database.service_categories.create_index("salon_id")

    # Clients
    await db.database.clients.create_index("salon_id")
    await db.database.clients.create_index([("salon_id", 1), ("email", 1)], unique=True, sparse=True)
    await db.database.clients.create_index([("salon_id", 1), ("phone", 1)])
    await db.database.clients.create_index([("first_name", "text"), ("last_name", "text"), ("email", "text"), ("phone", "text")])

    # Appointments
    await db.database.appointments.create_index("salon_id")
    await db.database.appointments.create_index("client_id")
    await db.database.appointments.create_index("staff_id")
    await db.database.appointments.create_index([("salon_id", 1), ("start_time", 1)])
    await db.database.appointments.create_index([("staff_id", 1), ("start_time", 1)])
    await db.database.appointments.create_index("status")

    # Appointment Locks - TTL index for auto-expiration
    await db.database.appointment_locks.create_index(
        "expires_at",
        expireAfterSeconds=0
    )
    await db.database.appointment_locks.create_index(
        [("salon_id", 1), ("staff_id", 1), ("start_time", 1)],
        unique=True
    )

    # Staff Schedule Overrides
    await db.database.staff_schedule_overrides.create_index("staff_id")
    await db.database.staff_schedule_overrides.create_index([("staff_id", 1), ("date", 1)])

    # Payments
    await db.database.payments.create_index("salon_id")
    await db.database.payments.create_index("appointment_id")
    await db.database.payments.create_index("stripe_payment_intent_id")

    # Audit Log
    await db.database.audit_log.create_index("salon_id")
    await db.database.audit_log.create_index("created_at")
    await db.database.audit_log.create_index([("entity_type", 1), ("entity_id", 1)])

    # Webhooks
    await db.database.webhooks.create_index("salon_id")
    await db.database.webhook_deliveries.create_index("webhook_id")
    await db.database.webhook_deliveries.create_index("created_at")


def get_collection(name: str):
    """Get a collection from the database."""
    if db.database is None:
        raise RuntimeError("Database not initialized")
    return db.database[name]
