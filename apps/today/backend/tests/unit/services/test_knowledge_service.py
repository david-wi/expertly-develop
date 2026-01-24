"""Tests for knowledge service."""

import pytest
from uuid import uuid4

from app.services.knowledge_service import KnowledgeService
from app.models import Knowledge, Person, Client, Project, Playbook
from app.models.knowledge import KnowledgeStatus, KnowledgeCategory
from app.models.playbook import PlaybookStatus
from app.schemas.knowledge import KnowledgeCapture, TRIGGER_PHRASES


class TestKnowledgeServiceCapture:
    """Tests for knowledge capture functionality."""

    @pytest.mark.asyncio
    async def test_capture_playbook_knowledge_creates_proposed_playbook(
        self, db_session, test_tenant, test_user
    ):
        """Capturing playbook knowledge should create a proposed playbook."""
        service = KnowledgeService(db_session, test_tenant.id, test_user.id)

        data = KnowledgeCapture(
            content="How to handle client escalations\n1. Acknowledge the issue\n2. Gather facts\n3. Propose solution",
            category=KnowledgeCategory.PLAYBOOK,
        )

        knowledge, routing = await service.capture(data)

        assert knowledge.status == KnowledgeStatus.ROUTED
        assert knowledge.category == KnowledgeCategory.PLAYBOOK
        assert knowledge.routed_to_type == "playbook"
        assert knowledge.routed_to_id is not None

        assert routing is not None
        assert routing.type == "playbook"
        assert "proposed playbook" in routing.action_taken.lower()

    @pytest.mark.asyncio
    async def test_capture_person_knowledge_updates_existing_person(
        self, db_session, test_tenant, test_user
    ):
        """Capturing person knowledge should update existing person's context_notes."""
        # Create a person first
        person = Person(
            id=uuid4(),
            tenant_id=test_tenant.id,
            name="John Smith",
            email="john@example.com",
            relationship="client",
        )
        db_session.add(person)
        await db_session.flush()

        service = KnowledgeService(db_session, test_tenant.id, test_user.id)

        data = KnowledgeCapture(
            content="John Smith prefers email over phone calls",
            category=KnowledgeCategory.PERSON,
        )

        knowledge, routing = await service.capture(data)

        assert knowledge.status == KnowledgeStatus.ROUTED
        assert knowledge.routed_to_type == "person"
        assert knowledge.routed_to_id == person.id

        assert routing is not None
        assert routing.type == "person"
        assert routing.field_updated == "context_notes"

        # Verify person was updated
        await db_session.refresh(person)
        assert "prefers email" in person.context_notes

    @pytest.mark.asyncio
    async def test_capture_person_knowledge_marks_pending_if_not_found(
        self, db_session, test_tenant, test_user
    ):
        """Capturing person knowledge should mark pending if person not found."""
        service = KnowledgeService(db_session, test_tenant.id, test_user.id)

        data = KnowledgeCapture(
            content="some random information without a clear person name",
            category=KnowledgeCategory.PERSON,
        )

        knowledge, routing = await service.capture(data)

        assert knowledge.status == KnowledgeStatus.PENDING_REVIEW
        assert routing.action_taken == "Could not find person to update, marked for review"

    @pytest.mark.asyncio
    async def test_capture_client_knowledge_updates_existing_client(
        self, db_session, test_tenant, test_user
    ):
        """Capturing client knowledge should update existing client's notes."""
        client = Client(
            id=uuid4(),
            tenant_id=test_tenant.id,
            name="Acme Corp",
            status="active",
        )
        db_session.add(client)
        await db_session.flush()

        service = KnowledgeService(db_session, test_tenant.id, test_user.id)

        data = KnowledgeCapture(
            content="Client Acme Corp is expanding their team next quarter",
            category=KnowledgeCategory.CLIENT,
        )

        knowledge, routing = await service.capture(data)

        assert knowledge.status == KnowledgeStatus.ROUTED
        assert knowledge.routed_to_type == "client"

        await db_session.refresh(client)
        assert "expanding their team" in client.notes

    @pytest.mark.asyncio
    async def test_capture_project_knowledge_updates_existing_project(
        self, db_session, test_tenant, test_user
    ):
        """Capturing project knowledge should update existing project's description."""
        project = Project(
            id=uuid4(),
            tenant_id=test_tenant.id,
            name="Website Redesign",
            status="active",
        )
        db_session.add(project)
        await db_session.flush()

        service = KnowledgeService(db_session, test_tenant.id, test_user.id)

        data = KnowledgeCapture(
            content="Project Website Redesign requires mobile-first approach",
            category=KnowledgeCategory.PROJECT,
        )

        knowledge, routing = await service.capture(data)

        assert knowledge.status == KnowledgeStatus.ROUTED
        assert knowledge.routed_to_type == "project"

        await db_session.refresh(project)
        assert "mobile-first" in project.description

    @pytest.mark.asyncio
    async def test_capture_setting_knowledge_marks_for_review(
        self, db_session, test_tenant, test_user
    ):
        """Capturing setting knowledge should mark for user review."""
        service = KnowledgeService(db_session, test_tenant.id, test_user.id)

        data = KnowledgeCapture(
            content="My preferred email signature is 'Best regards'",
            category=KnowledgeCategory.SETTING,
        )

        knowledge, routing = await service.capture(data)

        assert knowledge.status == KnowledgeStatus.PENDING_REVIEW
        assert routing.type == "setting"
        assert "settings review" in routing.action_taken.lower()

    @pytest.mark.asyncio
    async def test_capture_rule_knowledge_creates_rules_playbook(
        self, db_session, test_tenant, test_user
    ):
        """Capturing rule knowledge should create or update Company Rules playbook."""
        service = KnowledgeService(db_session, test_tenant.id, test_user.id)

        data = KnowledgeCapture(
            content="Always use formal language with new clients",
            category=KnowledgeCategory.RULE,
        )

        knowledge, routing = await service.capture(data)

        assert knowledge.status == KnowledgeStatus.ROUTED
        assert knowledge.routed_to_type == "playbook"
        assert routing.type == "playbook"
        assert "Company Rules" in routing.action_taken

    @pytest.mark.asyncio
    async def test_capture_rule_appends_to_existing_rules_playbook(
        self, db_session, test_tenant, test_user
    ):
        """Capturing rule knowledge should append to existing Company Rules playbook."""
        # Create existing rules playbook
        rules_playbook = Playbook(
            id=uuid4(),
            tenant_id=test_tenant.id,
            name="Company Rules",
            description="Company rules",
            content="# Company Rules\n\nExisting rule here",
            status=PlaybookStatus.ACTIVE,
        )
        db_session.add(rules_playbook)
        await db_session.flush()

        service = KnowledgeService(db_session, test_tenant.id, test_user.id)

        data = KnowledgeCapture(
            content="Never use slang in emails",
            category=KnowledgeCategory.RULE,
        )

        knowledge, routing = await service.capture(data)

        await db_session.refresh(rules_playbook)
        assert "Never use slang" in rules_playbook.content
        assert "Existing rule here" in rules_playbook.content  # Original content preserved

    @pytest.mark.asyncio
    async def test_capture_stores_trigger_phrase(
        self, db_session, test_tenant, test_user
    ):
        """Capturing knowledge should store the trigger phrase if provided."""
        service = KnowledgeService(db_session, test_tenant.id, test_user.id)

        data = KnowledgeCapture(
            content="Test content",
            category=KnowledgeCategory.RULE,
            trigger_phrase="remember that",
        )

        knowledge, _ = await service.capture(data)

        assert knowledge.trigger_phrase == "remember that"

    @pytest.mark.asyncio
    async def test_capture_stores_source_task_id(
        self, db_session, test_tenant, test_user
    ):
        """Capturing knowledge should store source task ID if provided."""
        task_id = uuid4()
        service = KnowledgeService(db_session, test_tenant.id, test_user.id)

        data = KnowledgeCapture(
            content="Test content",
            category=KnowledgeCategory.RULE,
            source_task_id=task_id,
        )

        knowledge, _ = await service.capture(data)

        assert knowledge.source_task_id == task_id
        assert knowledge.source_type == "task"


class TestKnowledgeServiceTriggerPhrases:
    """Tests for trigger phrase detection."""

    @pytest.mark.asyncio
    async def test_get_trigger_phrases_returns_list(
        self, db_session, test_tenant
    ):
        """get_trigger_phrases should return list of phrases."""
        service = KnowledgeService(db_session, test_tenant.id)

        phrases = service.get_trigger_phrases()

        assert isinstance(phrases, list)
        assert len(phrases) > 0
        assert "remember that" in phrases

    @pytest.mark.asyncio
    async def test_detect_trigger_phrase_finds_match(
        self, db_session, test_tenant
    ):
        """detect_trigger_phrase should find matching phrase."""
        service = KnowledgeService(db_session, test_tenant.id)

        result = service.detect_trigger_phrase("Remember that we use Slack for internal comms")

        assert result == "remember that"

    @pytest.mark.asyncio
    async def test_detect_trigger_phrase_returns_none_when_no_match(
        self, db_session, test_tenant
    ):
        """detect_trigger_phrase should return None when no match."""
        service = KnowledgeService(db_session, test_tenant.id)

        result = service.detect_trigger_phrase("This is a normal sentence")

        assert result is None

    @pytest.mark.asyncio
    async def test_detect_trigger_phrase_case_insensitive(
        self, db_session, test_tenant
    ):
        """detect_trigger_phrase should be case insensitive."""
        service = KnowledgeService(db_session, test_tenant.id)

        result = service.detect_trigger_phrase("REMEMBER THAT we need to submit timesheets")

        assert result == "remember that"


class TestKnowledgeServiceList:
    """Tests for listing and querying knowledge."""

    @pytest.mark.asyncio
    async def test_list_knowledge_returns_tenant_entries(
        self, db_session, test_tenant, test_user
    ):
        """list_knowledge should only return tenant's entries."""
        # Create knowledge for this tenant
        k1 = Knowledge(
            tenant_id=test_tenant.id,
            content="Test 1",
            category=KnowledgeCategory.RULE,
            source_type="manual",
            status=KnowledgeStatus.CAPTURED,
        )
        # Create knowledge for another tenant
        k2 = Knowledge(
            tenant_id=uuid4(),
            content="Test 2",
            category=KnowledgeCategory.RULE,
            source_type="manual",
            status=KnowledgeStatus.CAPTURED,
        )
        db_session.add_all([k1, k2])
        await db_session.flush()

        service = KnowledgeService(db_session, test_tenant.id)
        entries = await service.list_knowledge()

        assert len(entries) == 1
        assert entries[0].content == "Test 1"

    @pytest.mark.asyncio
    async def test_list_knowledge_filters_by_status(
        self, db_session, test_tenant
    ):
        """list_knowledge should filter by status."""
        k1 = Knowledge(
            tenant_id=test_tenant.id,
            content="Captured",
            category=KnowledgeCategory.RULE,
            source_type="manual",
            status=KnowledgeStatus.CAPTURED,
        )
        k2 = Knowledge(
            tenant_id=test_tenant.id,
            content="Pending",
            category=KnowledgeCategory.RULE,
            source_type="manual",
            status=KnowledgeStatus.PENDING_REVIEW,
        )
        db_session.add_all([k1, k2])
        await db_session.flush()

        service = KnowledgeService(db_session, test_tenant.id)
        entries = await service.list_knowledge(status=KnowledgeStatus.PENDING_REVIEW)

        assert len(entries) == 1
        assert entries[0].content == "Pending"

    @pytest.mark.asyncio
    async def test_list_knowledge_filters_by_category(
        self, db_session, test_tenant
    ):
        """list_knowledge should filter by category."""
        k1 = Knowledge(
            tenant_id=test_tenant.id,
            content="Rule",
            category=KnowledgeCategory.RULE,
            source_type="manual",
            status=KnowledgeStatus.CAPTURED,
        )
        k2 = Knowledge(
            tenant_id=test_tenant.id,
            content="Person",
            category=KnowledgeCategory.PERSON,
            source_type="manual",
            status=KnowledgeStatus.CAPTURED,
        )
        db_session.add_all([k1, k2])
        await db_session.flush()

        service = KnowledgeService(db_session, test_tenant.id)
        entries = await service.list_knowledge(category=KnowledgeCategory.RULE)

        assert len(entries) == 1
        assert entries[0].content == "Rule"

    @pytest.mark.asyncio
    async def test_get_pending_returns_pending_review_entries(
        self, db_session, test_tenant
    ):
        """get_pending should return pending review entries."""
        k1 = Knowledge(
            tenant_id=test_tenant.id,
            content="Pending",
            category=KnowledgeCategory.SETTING,
            source_type="manual",
            status=KnowledgeStatus.PENDING_REVIEW,
        )
        k2 = Knowledge(
            tenant_id=test_tenant.id,
            content="Routed",
            category=KnowledgeCategory.RULE,
            source_type="manual",
            status=KnowledgeStatus.ROUTED,
        )
        db_session.add_all([k1, k2])
        await db_session.flush()

        service = KnowledgeService(db_session, test_tenant.id)
        entries = await service.get_pending()

        assert len(entries) == 1
        assert entries[0].content == "Pending"


class TestKnowledgeServiceDismiss:
    """Tests for dismissing knowledge."""

    @pytest.mark.asyncio
    async def test_dismiss_updates_status(
        self, db_session, test_tenant, test_user
    ):
        """dismiss should update knowledge status to dismissed."""
        knowledge = Knowledge(
            id=uuid4(),
            tenant_id=test_tenant.id,
            content="Test",
            category=KnowledgeCategory.RULE,
            source_type="manual",
            status=KnowledgeStatus.PENDING_REVIEW,
        )
        db_session.add(knowledge)
        await db_session.flush()

        service = KnowledgeService(db_session, test_tenant.id, test_user.id)
        result = await service.dismiss(knowledge.id, "Not useful")

        assert result is not None
        assert result.status == KnowledgeStatus.DISMISSED

    @pytest.mark.asyncio
    async def test_dismiss_returns_none_for_nonexistent(
        self, db_session, test_tenant, test_user
    ):
        """dismiss should return None for nonexistent knowledge."""
        service = KnowledgeService(db_session, test_tenant.id, test_user.id)

        result = await service.dismiss(uuid4())

        assert result is None

    @pytest.mark.asyncio
    async def test_dismiss_respects_tenant_isolation(
        self, db_session, test_tenant, test_user
    ):
        """dismiss should not affect other tenant's knowledge."""
        other_tenant_id = uuid4()
        knowledge = Knowledge(
            id=uuid4(),
            tenant_id=other_tenant_id,
            content="Test",
            category=KnowledgeCategory.RULE,
            source_type="manual",
            status=KnowledgeStatus.PENDING_REVIEW,
        )
        db_session.add(knowledge)
        await db_session.flush()

        service = KnowledgeService(db_session, test_tenant.id, test_user.id)
        result = await service.dismiss(knowledge.id)

        assert result is None
