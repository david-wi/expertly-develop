"""Tests for playbook models."""
import pytest
from uuid import uuid4
from bson import ObjectId

from app.models.playbook import (
    AssigneeType,
    PlaybookStep,
    PlaybookStepCreate,
    PlaybookHistoryEntry,
    Playbook,
    PlaybookCreate,
    PlaybookUpdate,
)
from app.models.queue import ScopeType


class TestAssigneeType:
    """Tests for AssigneeType enum."""

    def test_enum_values(self):
        """Test that AssigneeType has the expected values."""
        assert AssigneeType.USER == "user"
        assert AssigneeType.TEAM == "team"
        assert AssigneeType.ANYONE == "anyone"

    def test_enum_is_string(self):
        """Test that AssigneeType values are strings."""
        assert isinstance(AssigneeType.USER.value, str)
        assert isinstance(AssigneeType.TEAM.value, str)
        assert isinstance(AssigneeType.ANYONE.value, str)


class TestPlaybookStep:
    """Tests for PlaybookStep model."""

    def test_create_minimal_step(self):
        """Test creating a step with minimal fields."""
        step = PlaybookStep(order=1, title="Test Step")
        
        assert step.order == 1
        assert step.title == "Test Step"
        assert step.id is not None  # Auto-generated
        assert step.description is None
        assert step.nested_playbook_id is None
        assert step.assignee_type == AssigneeType.ANYONE
        assert step.assignee_id is None
        assert step.queue_id is None
        assert step.approval_required is False
        assert step.approver_type is None

    def test_create_full_step(self):
        """Test creating a step with all fields."""
        step = PlaybookStep(
            id="custom-id",
            order=2,
            title="Full Step",
            description="Detailed instructions",
            nested_playbook_id="nested-pb-id",
            assignee_type=AssigneeType.USER,
            assignee_id="user-123",
            queue_id="queue-456",
            approval_required=True,
            approver_type=AssigneeType.TEAM,
            approver_id="team-789",
            approver_queue_id="approval-queue",
        )
        
        assert step.id == "custom-id"
        assert step.order == 2
        assert step.title == "Full Step"
        assert step.description == "Detailed instructions"
        assert step.nested_playbook_id == "nested-pb-id"
        assert step.assignee_type == AssigneeType.USER
        assert step.assignee_id == "user-123"
        assert step.queue_id == "queue-456"
        assert step.approval_required is True
        assert step.approver_type == AssigneeType.TEAM
        assert step.approver_id == "team-789"
        assert step.approver_queue_id == "approval-queue"

    def test_step_id_auto_generated(self):
        """Test that step IDs are auto-generated and unique."""
        step1 = PlaybookStep(order=1, title="Step 1")
        step2 = PlaybookStep(order=2, title="Step 2")
        
        assert step1.id != step2.id
        assert len(step1.id) == 36  # UUID format


class TestPlaybookStepCreate:
    """Tests for PlaybookStepCreate schema."""

    def test_create_minimal(self):
        """Test creating with minimal fields."""
        step_create = PlaybookStepCreate(title="New Step")
        
        assert step_create.title == "New Step"
        assert step_create.id is None  # Not auto-generated in create schema
        assert step_create.order is None
        assert step_create.assignee_type == AssigneeType.ANYONE

    def test_create_with_all_fields(self):
        """Test creating with all fields specified."""
        step_create = PlaybookStepCreate(
            id="provided-id",
            order=5,
            title="Complete Step",
            description="Full description",
            nested_playbook_id="pb-123",
            assignee_type=AssigneeType.TEAM,
            assignee_id="team-1",
            queue_id="q-1",
            approval_required=True,
            approver_type=AssigneeType.USER,
            approver_id="approver-1",
            approver_queue_id="aq-1",
        )
        
        assert step_create.id == "provided-id"
        assert step_create.order == 5
        assert step_create.approval_required is True


class TestPlaybookHistoryEntry:
    """Tests for PlaybookHistoryEntry model."""

    def test_create_history_entry(self):
        """Test creating a history entry."""
        steps = [PlaybookStep(order=1, title="Step 1")]
        entry = PlaybookHistoryEntry(
            version=1,
            name="Original Name",
            description="Original description",
            steps=steps,
            changed_by="user-123",
        )
        
        assert entry.version == 1
        assert entry.name == "Original Name"
        assert entry.description == "Original description"
        assert len(entry.steps) == 1
        assert entry.steps[0].title == "Step 1"
        assert entry.changed_by == "user-123"
        assert entry.changed_at is not None

    def test_history_entry_with_empty_steps(self):
        """Test history entry with no steps."""
        entry = PlaybookHistoryEntry(version=1, name="Empty")
        
        assert entry.steps == []


class TestPlaybook:
    """Tests for Playbook model."""

    def test_create_minimal_playbook(self):
        """Test creating a playbook with minimal fields."""
        org_id = ObjectId()
        playbook = Playbook(organization_id=org_id, name="Test Playbook")
        
        assert playbook.name == "Test Playbook"
        assert playbook.organization_id == org_id
        assert playbook.id is not None
        assert playbook.description is None
        assert playbook.steps == []
        assert playbook.scope_type == ScopeType.ORGANIZATION
        assert playbook.scope_id is None
        assert playbook.version == 1
        assert playbook.history == []
        assert playbook.is_active is True
        assert playbook.created_at is not None
        assert playbook.updated_at is not None

    def test_create_playbook_with_steps(self):
        """Test creating a playbook with steps."""
        org_id = ObjectId()
        steps = [
            PlaybookStep(order=1, title="Step 1"),
            PlaybookStep(order=2, title="Step 2"),
        ]
        playbook = Playbook(
            organization_id=org_id,
            name="Playbook with Steps",
            steps=steps,
        )
        
        assert len(playbook.steps) == 2
        assert playbook.steps[0].title == "Step 1"
        assert playbook.steps[1].title == "Step 2"

    def test_playbook_model_dump_mongo(self):
        """Test that model_dump_mongo produces correct output."""
        org_id = ObjectId()
        playbook = Playbook(organization_id=org_id, name="Mongo Test")
        
        data = playbook.model_dump_mongo()
        
        assert "_id" in data
        assert "id" not in data
        assert data["name"] == "Mongo Test"


class TestPlaybookCreate:
    """Tests for PlaybookCreate schema."""

    def test_create_minimal(self):
        """Test creating with minimal fields."""
        create = PlaybookCreate(name="New Playbook")
        
        assert create.name == "New Playbook"
        assert create.description is None
        assert create.steps == []
        assert create.scope_type == ScopeType.ORGANIZATION
        assert create.scope_id is None

    def test_create_with_steps(self):
        """Test creating with steps."""
        steps = [
            PlaybookStepCreate(title="Step A"),
            PlaybookStepCreate(title="Step B"),
        ]
        create = PlaybookCreate(name="With Steps", steps=steps)
        
        assert len(create.steps) == 2
        assert create.steps[0].title == "Step A"


class TestPlaybookUpdate:
    """Tests for PlaybookUpdate schema."""

    def test_update_partial(self):
        """Test partial update with only some fields."""
        update = PlaybookUpdate(name="Updated Name")
        
        assert update.name == "Updated Name"
        assert update.description is None
        assert update.steps is None
        assert update.scope_type is None
        assert update.is_active is None

    def test_update_with_steps(self):
        """Test updating steps."""
        steps = [PlaybookStepCreate(title="New Step")]
        update = PlaybookUpdate(steps=steps)
        
        assert update.steps is not None
        assert len(update.steps) == 1

    def test_update_deactivate(self):
        """Test deactivating a playbook."""
        update = PlaybookUpdate(is_active=False)
        
        assert update.is_active is False
