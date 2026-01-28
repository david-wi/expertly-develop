"""Pytest configuration and fixtures for Develop backend tests."""

import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from typing import AsyncGenerator
from bson import ObjectId


@pytest.fixture
def mock_db():
    """Create a mock MongoDB database with async methods."""
    db = MagicMock()

    # Projects collection
    db.projects = MagicMock()
    db.projects.find_one = AsyncMock()
    db.projects.find = MagicMock()
    db.projects.insert_one = AsyncMock()
    db.projects.update_one = AsyncMock()
    db.projects.delete_one = AsyncMock()

    # Users collection
    db.users = MagicMock()
    db.users.find_one = AsyncMock()
    db.users.find = MagicMock()
    db.users.insert_one = AsyncMock()

    # Tenants collection
    db.tenants = MagicMock()
    db.tenants.find_one = AsyncMock()
    db.tenants.insert_one = AsyncMock()

    # Jobs collection
    db.jobs = MagicMock()
    db.jobs.find_one = AsyncMock()
    db.jobs.find = MagicMock()
    db.jobs.insert_one = AsyncMock()
    db.jobs.update_one = AsyncMock()

    # Artifacts collection
    db.artifacts = MagicMock()
    db.artifacts.find_one = AsyncMock()
    db.artifacts.find = MagicMock()
    db.artifacts.insert_one = AsyncMock()

    # Documents collection
    db.documents = MagicMock()
    db.documents.find_one = AsyncMock()
    db.documents.find = MagicMock()
    db.documents.insert_one = AsyncMock()
    db.documents.update_one = AsyncMock()

    return db


@pytest.fixture
def sample_tenant_id():
    """Generate a sample tenant ID."""
    return ObjectId()


@pytest.fixture
def sample_user_id():
    """Generate a sample user ID."""
    return ObjectId()


@pytest.fixture
def sample_project_data(sample_tenant_id):
    """Sample project data for testing."""
    return {
        "tenant_id": sample_tenant_id,
        "name": "Test Project",
        "description": "A test project",
        "base_url": "https://example.com",
        "visibility": "team",
        "settings": {},
    }


@pytest.fixture
def sample_user_data(sample_tenant_id):
    """Sample user data for testing."""
    return {
        "tenant_id": sample_tenant_id,
        "email": "test@example.com",
        "name": "Test User",
        "role": "admin",
        "api_key": "test-api-key-123",
    }


@pytest.fixture
def sample_job_data(sample_tenant_id, sample_project_id):
    """Sample job data for testing."""
    return {
        "tenant_id": sample_tenant_id,
        "project_id": sample_project_id,
        "job_type": "visual_walkthrough",
        "status": "pending",
        "settings": {},
    }


@pytest.fixture
def sample_project_id():
    """Generate a sample project ID."""
    return ObjectId()
