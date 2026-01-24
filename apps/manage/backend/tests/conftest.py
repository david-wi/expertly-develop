"""Pytest configuration and fixtures for API tests."""
import asyncio
from typing import AsyncGenerator
import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase
from bson import ObjectId

from app.main import app
from app.database import get_database, set_database
from app.config import get_settings


# Use a test database
TEST_DB_NAME = "expertly_manage_test"


@pytest.fixture(scope="session")
def event_loop():
    """Create event loop for the test session."""
    loop = asyncio.get_event_loop_policy().new_event_loop()
    yield loop
    loop.close()


@pytest_asyncio.fixture(scope="function")
async def test_db() -> AsyncGenerator[AsyncIOMotorDatabase, None]:
    """Create a clean test database for each test."""
    settings = get_settings()
    client = AsyncIOMotorClient(settings.mongodb_url)
    db = client[TEST_DB_NAME]

    # Drop existing collections
    collections = await db.list_collection_names()
    for coll in collections:
        await db[coll].drop()

    # Set the test database
    set_database(db)

    yield db

    # Cleanup after test
    for coll in await db.list_collection_names():
        await db[coll].drop()

    client.close()


@pytest_asyncio.fixture(scope="function")
async def seeded_db(test_db: AsyncIOMotorDatabase) -> AsyncIOMotorDatabase:
    """Create a test database with seed data."""
    from app.utils.seed import seed_database

    await seed_database()
    return test_db


@pytest_asyncio.fixture
async def client(test_db: AsyncIOMotorDatabase) -> AsyncGenerator[AsyncClient, None]:
    """Create an async HTTP client for testing."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac


@pytest_asyncio.fixture
async def seeded_client(seeded_db: AsyncIOMotorDatabase) -> AsyncGenerator[AsyncClient, None]:
    """Create an async HTTP client with seeded database."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac


@pytest.fixture
def api_key() -> str:
    """Return the default API key for testing."""
    settings = get_settings()
    return settings.default_api_key


@pytest.fixture
def auth_headers(api_key: str) -> dict:
    """Return headers with API key authentication."""
    return {"X-API-Key": api_key}
