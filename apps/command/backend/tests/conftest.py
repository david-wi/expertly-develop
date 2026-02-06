"""Pytest configuration and fixtures for backend tests."""
import pytest
from unittest.mock import AsyncMock, MagicMock
from bson import ObjectId
from dataclasses import dataclass


@pytest.fixture
def mock_db():
    """Create a mock database with async methods."""
    db = MagicMock()
    db.playbooks = MagicMock()
    db.playbooks.find_one = AsyncMock()
    db.playbooks.find = MagicMock()
    db.playbooks.insert_one = AsyncMock()
    db.playbooks.find_one_and_update = AsyncMock()
    return db


@dataclass
class MockUser:
    """Mock user for testing without importing app.models."""
    id: str
    organization_id: str
    email: str
    name: str
    user_type: str
    role: str
    is_active: bool
    is_default: bool


@pytest.fixture
def sample_user():
    """Create a sample user for testing."""
    return MockUser(
        id=str(ObjectId()),
        organization_id=str(ObjectId()),
        email="test@example.com",
        name="Test User",
        user_type="human",
        role="admin",
        is_active=True,
        is_default=False,
    )


@pytest.fixture
def sample_playbook_data():
    """Create sample playbook data."""
    return {
        "_id": "test-playbook-id",
        "organization_id": ObjectId(),
        "name": "Test Playbook",
        "description": "A test playbook",
        "steps": [],
        "scope_type": "organization",
        "scope_id": None,
        "version": 1,
        "history": [],
        "is_active": True,
        "created_by": "user-123",
    }


@pytest.fixture
def sample_step_data():
    """Create sample step data."""
    return {
        "id": "step-1",
        "order": 1,
        "title": "First Step",
        "description": "Do this first",
        "nested_playbook_id": None,
        "assignee_type": "anyone",
        "assignee_id": None,
        "queue_id": None,
        "approval_required": False,
        "approver_type": None,
        "approver_id": None,
        "approver_queue_id": None,
    }
