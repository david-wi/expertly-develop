from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase
from typing import Optional
import logging

from app.config import get_settings

logger = logging.getLogger(__name__)

_client: Optional[AsyncIOMotorClient] = None
_database: Optional[AsyncIOMotorDatabase] = None


async def connect_to_mongo() -> None:
    global _client, _database
    settings = get_settings()

    logger.info(f"Connecting to MongoDB at {settings.mongodb_url}")
    _client = AsyncIOMotorClient(settings.mongodb_url)
    _database = _client[settings.database_name]

    await _client.admin.command("ping")
    logger.info(f"Connected to MongoDB database: {settings.database_name}")


async def close_mongo_connection() -> None:
    global _client, _database
    if _client:
        logger.info("Closing MongoDB connection")
        _client.close()
        _client = None
        _database = None


def get_database() -> AsyncIOMotorDatabase:
    if _database is None:
        raise RuntimeError("Database not initialized. Call connect_to_mongo() first.")
    return _database


def set_database(db: AsyncIOMotorDatabase) -> None:
    global _database
    _database = db


async def check_database_connection() -> bool:
    try:
        if _client is None:
            return False
        await _client.admin.command("ping")
        return True
    except Exception:
        return False
