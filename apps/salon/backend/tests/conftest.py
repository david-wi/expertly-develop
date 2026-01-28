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
async def test_user(test_db) -> dict:
    """Create a test user and salon in the database."""
    from bson import ObjectId
    from app.core.security import get_password_hash

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
    user = {
        "_id": user_id,
        "email": "test@example.com",
        "password_hash": get_password_hash("testpassword"),
        "first_name": "Test",
        "last_name": "User",
        "salon_id": salon_id,
        "role": "owner",
        "is_active": True,
    }
    await test_db.users.insert_one(user)

    return user


@pytest.fixture
async def authenticated_client(client: AsyncClient, test_user: dict) -> AsyncClient:
    """Create an authenticated test client by overriding the auth dependency."""
    from app.main import app
    from app.core.security import get_current_user

    # Override the authentication dependency to return our test user
    async def mock_get_current_user():
        return test_user

    app.dependency_overrides[get_current_user] = mock_get_current_user

    yield client

    # Clean up override
    app.dependency_overrides.pop(get_current_user, None)


@pytest.fixture
async def auth_headers(authenticated_client: AsyncClient, test_user: dict) -> dict:
    """Return empty headers - auth is handled by dependency override."""
    return {}
