"""Test configuration and fixtures."""
import os
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

# Set test environment before imports
os.environ["DATABASE_URL"] = "sqlite:///:memory:"
os.environ["SECRET_KEY"] = "test-secret-key"
os.environ["ENCRYPTION_KEY"] = "test-encryption-key-32-chars!!"

from app.main import app
from app.database import Base, get_db


# Create test database
engine = create_engine(
    "sqlite:///:memory:",
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def override_get_db():
    """Override database dependency for tests."""
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()


@pytest.fixture(scope="function")
def db():
    """Create database tables for each test."""
    Base.metadata.create_all(bind=engine)
    db = TestingSessionLocal()
    yield db
    db.close()
    Base.metadata.drop_all(bind=engine)


@pytest.fixture(scope="function")
def client(db):
    """Create test client with database override."""
    app.dependency_overrides[get_db] = override_get_db
    Base.metadata.create_all(bind=engine)

    with TestClient(app) as test_client:
        yield test_client

    Base.metadata.drop_all(bind=engine)
    app.dependency_overrides.clear()


@pytest.fixture
def sample_project(client):
    """Create a sample project for testing."""
    response = client.post(
        "/api/v1/projects",
        json={"name": "Test Project", "description": "A test project"},
    )
    return response.json()


@pytest.fixture
def sample_environment(client, sample_project):
    """Create a sample environment for testing."""
    response = client.post(
        f"/api/v1/projects/{sample_project['id']}/environments",
        json={
            "name": "Test Environment",
            "type": "staging",
            "base_url": "https://example.com",
            "is_default": True,
        },
    )
    return response.json()


@pytest.fixture
def sample_test_case(client, sample_project):
    """Create a sample test case for testing."""
    response = client.post(
        f"/api/v1/projects/{sample_project['id']}/tests",
        json={
            "title": "Test Login Flow",
            "description": "Verify login functionality",
            "priority": "high",
            "execution_type": "browser",
            "steps": [
                {"action": "navigate", "value": "https://example.com/login"},
                {"action": "type", "selector": "#username", "value": "testuser"},
                {"action": "type", "selector": "#password", "value": "testpass"},
                {"action": "click", "selector": "#submit"},
            ],
            "expected_results": "User is logged in successfully",
        },
    )
    return response.json()
