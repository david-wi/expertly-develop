import pytest
import asyncio
from typing import AsyncGenerator
from httpx import AsyncClient, ASGITransport
from motor.motor_asyncio import AsyncIOMotorClient

from app.main import app
from app.core.database import db
from app.config import settings


@pytest.fixture(scope="session")
def event_loop():
    """Create an instance of the default event loop for the test session."""
    loop = asyncio.get_event_loop_policy().new_event_loop()
    yield loop
    loop.close()


@pytest.fixture(scope="session")
async def test_db():
    """Create test database connection."""
    client = AsyncIOMotorClient(settings.mongodb_url)
    test_db_name = f"{settings.mongodb_database}_test"
    database = client[test_db_name]

    # Set up test database
    db.client = client
    db.database = database

    yield database

    # Clean up
    await client.drop_database(test_db_name)
    client.close()


@pytest.fixture
async def client(test_db) -> AsyncGenerator[AsyncClient, None]:
    """Create test client."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac


@pytest.fixture
async def auth_headers(client: AsyncClient, test_db) -> dict:
    """Create authenticated user and return auth headers."""
    from bson import ObjectId
    from app.core.security import get_password_hash, create_access_token

    # Create test salon
    salon_id = ObjectId()
    await test_db.salons.insert_one({
        "_id": salon_id,
        "name": "Test Salon",
        "slug": "test-salon",
        "is_active": True,
        "settings": {},
    })

    # Create test user
    user_id = ObjectId()
    await test_db.users.insert_one({
        "_id": user_id,
        "email": "test@example.com",
        "password_hash": get_password_hash("testpassword"),
        "first_name": "Test",
        "last_name": "User",
        "salon_id": salon_id,
        "role": "owner",
        "is_active": True,
    })

    token = create_access_token({"sub": str(user_id), "salon_id": str(salon_id)})
    return {"Authorization": f"Bearer {token}"}
