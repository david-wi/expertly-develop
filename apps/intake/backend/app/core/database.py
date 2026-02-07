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
    await create_indexes()


async def close_db() -> None:
    """Close database connection."""
    if db.client:
        db.client.close()


async def create_indexes() -> None:
    """Create necessary indexes for collections."""
    if db.database is None:
        return
    # Add indexes as collections are created


def get_collection(name: str):
    """Get a collection from the database."""
    if db.database is None:
        raise RuntimeError("Database not initialized")
    return db.database[name]
