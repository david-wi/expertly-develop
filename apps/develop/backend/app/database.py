"""MongoDB database connection and utilities."""

from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase, AsyncIOMotorGridFSBucket
from typing import Optional

from app.config import get_settings


class Database:
    """MongoDB database connection manager."""

    client: Optional[AsyncIOMotorClient] = None
    db: Optional[AsyncIOMotorDatabase] = None
    fs: Optional[AsyncIOMotorGridFSBucket] = None


db = Database()


async def connect_to_mongodb() -> None:
    """Connect to MongoDB."""
    settings = get_settings()
    db.client = AsyncIOMotorClient(settings.mongodb_url)
    db.db = db.client[settings.mongodb_database]
    db.fs = AsyncIOMotorGridFSBucket(db.db)

    # Create indexes
    await create_indexes()


async def close_mongodb_connection() -> None:
    """Close MongoDB connection."""
    if db.client:
        db.client.close()


async def create_indexes() -> None:
    """Create MongoDB indexes for optimal query performance."""
    # Documents collection indexes
    await db.db.documents.create_index([("document_key", 1), ("version", 1)], unique=True)
    await db.db.documents.create_index([("document_key", 1), ("is_current", 1)])
    await db.db.documents.create_index([("organization_id", 1), ("metadata.project_id", 1)])
    await db.db.documents.create_index([("organization_id", 1), ("deleted_at", 1)])

    # Jobs collection indexes
    await db.db.jobs.create_index([("organization_id", 1), ("status", 1)])
    await db.db.jobs.create_index([("status", 1), ("created_at", 1)])
    await db.db.jobs.create_index([("organization_id", 1), ("job_type", 1), ("created_at", -1)])

    # Projects collection indexes
    await db.db.projects.create_index([("organization_id", 1), ("deleted_at", 1)])
    await db.db.projects.create_index([("organization_id", 1), ("visibility", 1)])

    # API keys collection index (for programmatic access)
    await db.db.api_keys.create_index([("key", 1)], unique=True)
    await db.db.api_keys.create_index([("organization_id", 1)])

    # Personas collection indexes
    await db.db.personas.create_index([("project_id", 1)])
    await db.db.personas.create_index([("organization_id", 1)])

    # Artifacts collection indexes
    await db.db.artifacts.create_index([("project_id", 1), ("created_at", -1)])
    await db.db.artifacts.create_index([("organization_id", 1), ("created_at", -1)])
    await db.db.artifacts.create_index([("job_id", 1)])

    # Requirements collection indexes
    await db.db.requirements.create_index([("organization_id", 1), ("project_id", 1)])
    await db.db.requirements.create_index([("organization_id", 1), ("status", 1)])

    # Preconfigured scenarios indexes
    await db.db.preconfigured_scenarios.create_index([("organization_id", 1), ("code", 1)], unique=True)


def get_database() -> AsyncIOMotorDatabase:
    """Get database instance."""
    return db.db


def get_gridfs() -> AsyncIOMotorGridFSBucket:
    """Get GridFS bucket instance."""
    return db.fs
