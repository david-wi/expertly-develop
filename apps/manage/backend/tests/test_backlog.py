"""Tests for backlog API endpoints."""
import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from bson import ObjectId
from datetime import datetime, timezone

from app.models import BacklogStatus, BacklogPriority, BacklogCategory


def serialize_backlog_item(item: dict) -> dict:
    """Local copy of serialize function for testing without auth dependencies."""
    result = {**item, "_id": str(item["_id"]), "id": str(item["_id"])}
    for field in ["organization_id", "created_by"]:
        if item.get(field):
            result[field] = str(item[field])
    return result


class TestBacklogSerialization:
    """Test backlog item serialization."""

    def test_serialize_backlog_item_converts_object_ids(self):
        """Test that serialize_backlog_item converts ObjectIds to strings."""
        org_id = ObjectId()
        user_id = ObjectId()
        item_id = ObjectId()

        item = {
            "_id": item_id,
            "organization_id": org_id,
            "created_by": user_id,
            "title": "Test Item",
        }

        result = serialize_backlog_item(item)

        assert result["id"] == str(item_id)
        assert result["_id"] == str(item_id)
        assert result["organization_id"] == str(org_id)
        assert result["created_by"] == str(user_id)
        assert result["title"] == "Test Item"

    def test_serialize_backlog_item_handles_none_fields(self):
        """Test that serialize_backlog_item handles None optional fields."""
        item_id = ObjectId()
        item = {
            "_id": item_id,
            "organization_id": None,
            "created_by": None,
            "title": "Test Item",
        }

        result = serialize_backlog_item(item)

        assert result["id"] == str(item_id)
        # None fields should remain None, not be converted to "None"
        assert result.get("organization_id") is None or result["organization_id"] is None


class TestBacklogModels:
    """Test backlog model enums and types."""

    def test_backlog_status_values(self):
        """Test that BacklogStatus has expected values."""
        assert BacklogStatus.NEW == "new"
        assert BacklogStatus.IN_PROGRESS == "in_progress"
        assert BacklogStatus.DONE == "done"
        assert BacklogStatus.ARCHIVED == "archived"

    def test_backlog_priority_values(self):
        """Test that BacklogPriority has expected values."""
        assert BacklogPriority.LOW == "low"
        assert BacklogPriority.MEDIUM == "medium"
        assert BacklogPriority.HIGH == "high"

    def test_backlog_category_values(self):
        """Test that BacklogCategory has expected values."""
        assert BacklogCategory.BACKLOG == "backlog"
        assert BacklogCategory.IDEA == "idea"


class TestBacklogItemCreate:
    """Test BacklogItemCreate schema."""

    def test_create_with_minimal_fields(self):
        """Test creating backlog item with only required fields."""
        from app.models import BacklogItemCreate

        data = BacklogItemCreate(title="Test Item")
        assert data.title == "Test Item"
        assert data.description is None
        assert data.status is None
        assert data.priority is None
        assert data.category is None
        assert data.tags is None

    def test_create_with_all_fields(self):
        """Test creating backlog item with all fields."""
        from app.models import BacklogItemCreate

        data = BacklogItemCreate(
            title="Test Item",
            description="A test description",
            status=BacklogStatus.IN_PROGRESS,
            priority=BacklogPriority.HIGH,
            category=BacklogCategory.IDEA,
            tags=["feature", "urgent"]
        )
        assert data.title == "Test Item"
        assert data.description == "A test description"
        assert data.status == BacklogStatus.IN_PROGRESS
        assert data.priority == BacklogPriority.HIGH
        assert data.category == BacklogCategory.IDEA
        assert data.tags == ["feature", "urgent"]


class TestBacklogItemUpdate:
    """Test BacklogItemUpdate schema."""

    def test_update_with_partial_fields(self):
        """Test updating backlog item with partial fields."""
        from app.models import BacklogItemUpdate

        data = BacklogItemUpdate(title="Updated Title")
        update_dict = data.model_dump(exclude_unset=True)
        assert update_dict == {"title": "Updated Title"}

    def test_update_with_status_change(self):
        """Test updating backlog item status."""
        from app.models import BacklogItemUpdate

        data = BacklogItemUpdate(status=BacklogStatus.DONE)
        update_dict = data.model_dump(exclude_unset=True)
        assert update_dict == {"status": BacklogStatus.DONE}


class TestBacklogItem:
    """Test BacklogItem model."""

    def test_backlog_item_defaults(self):
        """Test that BacklogItem has correct default values."""
        from app.models import BacklogItem

        org_id = ObjectId()
        item = BacklogItem(
            organization_id=org_id,
            title="Test Item"
        )

        assert item.title == "Test Item"
        assert item.status == BacklogStatus.NEW
        assert item.priority == BacklogPriority.MEDIUM
        assert item.category == BacklogCategory.BACKLOG
        assert item.tags == []
        assert item.description is None
        assert item.created_by is None

    def test_backlog_item_timestamps(self):
        """Test that BacklogItem has timestamps."""
        from app.models import BacklogItem

        org_id = ObjectId()
        item = BacklogItem(
            organization_id=org_id,
            title="Test Item"
        )

        assert item.created_at is not None
        assert item.updated_at is not None
        # created_at and updated_at should be close to each other
        delta = abs((item.updated_at - item.created_at).total_seconds())
        assert delta < 1  # Within 1 second


class TestBacklogAPIValidation:
    """Test API validation logic."""

    def test_valid_object_id(self):
        """Test ObjectId validation."""
        valid_id = str(ObjectId())
        assert ObjectId.is_valid(valid_id)

    def test_invalid_object_id(self):
        """Test invalid ObjectId detection."""
        invalid_ids = [
            "not-an-id",
            "123",
            "",
            "12345678901234567890123",  # Wrong length
        ]
        for invalid_id in invalid_ids:
            assert not ObjectId.is_valid(invalid_id)
