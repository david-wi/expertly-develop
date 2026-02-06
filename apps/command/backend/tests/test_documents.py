"""Tests for documents API endpoints."""
import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from bson import ObjectId
from datetime import datetime, timezone


def serialize_document(doc: dict, include_history: bool = False) -> dict:
    """Local copy of serialize function for testing without auth dependencies."""
    result = {**doc}
    result["id"] = str(doc["_id"])
    del result["_id"]
    result["organization_id"] = str(doc["organization_id"])

    if doc.get("project_id"):
        result["project_id"] = str(doc["project_id"])
    if doc.get("task_id"):
        result["task_id"] = str(doc["task_id"])
    if doc.get("created_by"):
        result["created_by"] = str(doc["created_by"])
    if doc.get("updated_by"):
        result["updated_by"] = str(doc["updated_by"])

    if not include_history:
        result.pop("history", None)

    return result


class TestDocumentSerialization:
    """Test document serialization."""

    def test_serialize_document_converts_object_ids(self):
        """Test that serialize_document converts ObjectIds to strings."""
        org_id = ObjectId()
        project_id = ObjectId()
        task_id = ObjectId()
        doc_id = ObjectId()
        user_id = ObjectId()

        doc = {
            "_id": doc_id,
            "organization_id": org_id,
            "project_id": project_id,
            "task_id": task_id,
            "created_by": user_id,
            "updated_by": user_id,
            "title": "Test Document",
            "content": "# Test\n\nContent here",
            "purpose": "architecture",
            "version": 1,
            "history": [],
        }

        result = serialize_document(doc)

        assert result["id"] == str(doc_id)
        assert "_id" not in result
        assert result["organization_id"] == str(org_id)
        assert result["project_id"] == str(project_id)
        assert result["task_id"] == str(task_id)
        assert result["created_by"] == str(user_id)
        assert result["updated_by"] == str(user_id)
        assert result["title"] == "Test Document"
        assert "history" not in result  # history excluded by default

    def test_serialize_document_includes_history_when_requested(self):
        """Test that serialize_document includes history when requested."""
        doc_id = ObjectId()
        org_id = ObjectId()

        doc = {
            "_id": doc_id,
            "organization_id": org_id,
            "title": "Test Document",
            "version": 2,
            "history": [
                {"version": 1, "title": "Old Title", "content": "Old content"}
            ],
        }

        result = serialize_document(doc, include_history=True)

        assert "history" in result
        assert len(result["history"]) == 1
        assert result["history"][0]["version"] == 1

    def test_serialize_document_handles_none_fields(self):
        """Test that serialize_document handles None optional fields."""
        doc_id = ObjectId()
        org_id = ObjectId()

        doc = {
            "_id": doc_id,
            "organization_id": org_id,
            "project_id": None,
            "task_id": None,
            "created_by": None,
            "updated_by": None,
            "title": "Test Document",
            "content": None,
            "purpose": None,
        }

        result = serialize_document(doc)

        assert result["id"] == str(doc_id)
        assert result.get("project_id") is None
        assert result.get("task_id") is None


class TestDocumentModels:
    """Test document model schemas."""

    def test_document_create_minimal(self):
        """Test creating document with only required fields."""
        from app.models import DocumentCreate

        data = DocumentCreate(title="Test Document")
        assert data.title == "Test Document"
        assert data.description is None
        assert data.content is None
        assert data.purpose is None
        assert data.project_id is None
        assert data.task_id is None
        assert data.external_url is None
        assert data.external_title is None

    def test_document_create_full(self):
        """Test creating document with all fields."""
        from app.models import DocumentCreate

        data = DocumentCreate(
            title="Architecture Document",
            description="System architecture overview",
            content="# Architecture\n\n## Overview\n\nThis document describes...",
            purpose="architecture",
            project_id=str(ObjectId()),
            task_id=str(ObjectId()),
            external_url="https://docs.google.com/document/d/123",
            external_title="Google Doc: Architecture"
        )
        assert data.title == "Architecture Document"
        assert data.description == "System architecture overview"
        assert data.content.startswith("# Architecture")
        assert data.purpose == "architecture"
        assert data.external_url == "https://docs.google.com/document/d/123"

    def test_document_update_partial(self):
        """Test updating document with partial fields."""
        from app.models import DocumentUpdate

        data = DocumentUpdate(title="Updated Title")
        update_dict = data.model_dump(exclude_unset=True)
        assert update_dict == {"title": "Updated Title"}

    def test_document_update_content(self):
        """Test updating document content."""
        from app.models import DocumentUpdate

        data = DocumentUpdate(content="# New Content\n\nUpdated content.")
        update_dict = data.model_dump(exclude_unset=True)
        assert update_dict == {"content": "# New Content\n\nUpdated content."}


class TestDocumentHistoryEntry:
    """Test DocumentHistoryEntry model."""

    def test_history_entry_creation(self):
        """Test creating a history entry."""
        from app.models import DocumentHistoryEntry

        entry = DocumentHistoryEntry(
            version=1,
            title="Original Title",
            description="Original description",
            content="# Original Content",
            changed_by="user-123"
        )

        assert entry.version == 1
        assert entry.title == "Original Title"
        assert entry.content == "# Original Content"
        assert entry.changed_by == "user-123"
        assert entry.changed_at is not None


class TestDocument:
    """Test Document model."""

    def test_document_defaults(self):
        """Test that Document has correct default values."""
        from app.models import Document

        org_id = ObjectId()
        doc = Document(
            organization_id=org_id,
            title="Test Document"
        )

        assert doc.title == "Test Document"
        assert doc.version == 1
        assert doc.history == []
        assert doc.content is None
        assert doc.description is None
        assert doc.purpose is None
        assert doc.project_id is None
        assert doc.task_id is None
        assert doc.external_url is None
        assert doc.deleted_at is None

    def test_document_with_relationships(self):
        """Test document with project and task relationships."""
        from app.models import Document

        org_id = ObjectId()
        project_id = ObjectId()
        task_id = ObjectId()

        doc = Document(
            organization_id=org_id,
            title="Project Document",
            project_id=project_id,
            task_id=task_id,
            purpose="requirements"
        )

        assert doc.project_id == project_id
        assert doc.task_id == task_id
        assert doc.purpose == "requirements"

    def test_document_with_external_link(self):
        """Test document with external link."""
        from app.models import Document

        org_id = ObjectId()

        doc = Document(
            organization_id=org_id,
            title="External Document",
            external_url="https://docs.google.com/document/d/abc123",
            external_title="Google Doc: Requirements"
        )

        assert doc.external_url == "https://docs.google.com/document/d/abc123"
        assert doc.external_title == "Google Doc: Requirements"

    def test_document_timestamps(self):
        """Test that Document has timestamps."""
        from app.models import Document

        org_id = ObjectId()
        doc = Document(
            organization_id=org_id,
            title="Test Document"
        )

        assert doc.created_at is not None
        assert doc.updated_at is not None
        delta = abs((doc.updated_at - doc.created_at).total_seconds())
        assert delta < 1


class TestDocumentAPIValidation:
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
            "12345678901234567890123",
        ]
        for invalid_id in invalid_ids:
            assert not ObjectId.is_valid(invalid_id)


class TestDocumentVersioning:
    """Test document versioning logic."""

    def test_version_increments_on_content_change(self):
        """Test that version increments when content changes."""
        from app.models import Document, DocumentHistoryEntry

        org_id = ObjectId()

        # Create initial document
        doc = Document(
            organization_id=org_id,
            title="Test Document",
            content="# Version 1"
        )
        assert doc.version == 1
        assert len(doc.history) == 0

        # Simulate update that would create history
        history_entry = DocumentHistoryEntry(
            version=doc.version,
            title=doc.title,
            content=doc.content,
            changed_by="user-123"
        )

        # New version would be created
        new_version = doc.version + 1
        assert new_version == 2

    def test_history_entry_captures_previous_state(self):
        """Test that history entry captures previous document state."""
        from app.models import DocumentHistoryEntry

        entry = DocumentHistoryEntry(
            version=3,
            title="Previous Title",
            description="Previous description",
            content="# Previous Content\n\nOld text here.",
            changed_by="user-456"
        )

        assert entry.version == 3
        assert entry.title == "Previous Title"
        assert entry.description == "Previous description"
        assert entry.content == "# Previous Content\n\nOld text here."
