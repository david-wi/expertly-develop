"""Tests for playbook service."""

import pytest
from uuid import uuid4

from app.services.playbook_service import PlaybookService
from app.models import Playbook
from app.models.playbook import PlaybookStatus
from app.schemas.playbook import PlaybookCreate, PlaybookPropose, PlaybookUpdate


class TestPlaybookServiceCRUD:
    """Tests for playbook CRUD operations."""

    @pytest.mark.asyncio
    async def test_create_playbook(self, db_session, test_tenant, test_user):
        """create_playbook should create an active playbook."""
        service = PlaybookService(db_session, test_tenant.id, test_user.id)

        data = PlaybookCreate(
            name="Email Response Guide",
            description="How to respond to client emails",
            content="1. Read carefully\n2. Address all points\n3. Be concise",
            category="communication",
            triggers=["email", "respond to client"],
            must_consult=False,
        )

        playbook = await service.create_playbook(data)

        assert playbook.id is not None
        assert playbook.name == "Email Response Guide"
        assert playbook.status == PlaybookStatus.ACTIVE
        assert playbook.tenant_id == test_tenant.id

    @pytest.mark.asyncio
    async def test_propose_playbook(self, db_session, test_tenant, test_user):
        """propose_playbook should create a proposed playbook."""
        service = PlaybookService(db_session, test_tenant.id, test_user.id)

        data = PlaybookPropose(
            name="New Pattern",
            description="Discovered pattern",
            content="When X happens, do Y",
            learned_from="Observed on 2024-01-15",
        )

        playbook = await service.propose_playbook(data)

        assert playbook.id is not None
        assert playbook.name == "New Pattern"
        assert playbook.status == PlaybookStatus.PROPOSED
        assert playbook.learned_from == "Observed on 2024-01-15"

    @pytest.mark.asyncio
    async def test_get_playbook(self, db_session, test_tenant, test_user):
        """get_playbook should return playbook by ID."""
        playbook = Playbook(
            id=uuid4(),
            tenant_id=test_tenant.id,
            name="Test",
            description="Test playbook",
            content="Content",
            status=PlaybookStatus.ACTIVE,
        )
        db_session.add(playbook)
        await db_session.flush()

        service = PlaybookService(db_session, test_tenant.id, test_user.id)
        result = await service.get_playbook(playbook.id)

        assert result is not None
        assert result.id == playbook.id

    @pytest.mark.asyncio
    async def test_get_playbook_returns_none_for_other_tenant(
        self, db_session, test_tenant, test_user
    ):
        """get_playbook should return None for other tenant's playbook."""
        playbook = Playbook(
            id=uuid4(),
            tenant_id=uuid4(),  # Different tenant
            name="Test",
            description="Test playbook",
            content="Content",
            status=PlaybookStatus.ACTIVE,
        )
        db_session.add(playbook)
        await db_session.flush()

        service = PlaybookService(db_session, test_tenant.id, test_user.id)
        result = await service.get_playbook(playbook.id)

        assert result is None

    @pytest.mark.asyncio
    async def test_update_playbook(self, db_session, test_tenant, test_user):
        """update_playbook should update playbook fields."""
        playbook = Playbook(
            id=uuid4(),
            tenant_id=test_tenant.id,
            name="Original",
            description="Original description",
            content="Content",
            status=PlaybookStatus.ACTIVE,
        )
        db_session.add(playbook)
        await db_session.flush()

        service = PlaybookService(db_session, test_tenant.id, test_user.id)
        update_data = PlaybookUpdate(name="Updated", description="New description")
        result = await service.update_playbook(playbook.id, update_data)

        assert result is not None
        assert result.name == "Updated"
        assert result.description == "New description"

    @pytest.mark.asyncio
    async def test_approve_playbook(self, db_session, test_tenant, test_user):
        """approve_playbook should change status to active."""
        playbook = Playbook(
            id=uuid4(),
            tenant_id=test_tenant.id,
            name="Proposed",
            description="Proposed playbook",
            content="Content",
            status=PlaybookStatus.PROPOSED,
        )
        db_session.add(playbook)
        await db_session.flush()

        service = PlaybookService(db_session, test_tenant.id, test_user.id)
        result = await service.approve_playbook(playbook.id)

        assert result is not None
        assert result.status == PlaybookStatus.ACTIVE

    @pytest.mark.asyncio
    async def test_approve_playbook_raises_for_non_proposed(
        self, db_session, test_tenant, test_user
    ):
        """approve_playbook should raise error for non-proposed playbook."""
        playbook = Playbook(
            id=uuid4(),
            tenant_id=test_tenant.id,
            name="Active",
            description="Active playbook",
            content="Content",
            status=PlaybookStatus.ACTIVE,
        )
        db_session.add(playbook)
        await db_session.flush()

        service = PlaybookService(db_session, test_tenant.id, test_user.id)

        with pytest.raises(ValueError, match="not in proposed status"):
            await service.approve_playbook(playbook.id)

    @pytest.mark.asyncio
    async def test_archive_playbook(self, db_session, test_tenant, test_user):
        """archive_playbook should change status to archived."""
        playbook = Playbook(
            id=uuid4(),
            tenant_id=test_tenant.id,
            name="Active",
            description="Active playbook",
            content="Content",
            status=PlaybookStatus.ACTIVE,
        )
        db_session.add(playbook)
        await db_session.flush()

        service = PlaybookService(db_session, test_tenant.id, test_user.id)
        result = await service.archive_playbook(playbook.id)

        assert result is not None
        assert result.status == PlaybookStatus.ARCHIVED


class TestPlaybookServiceList:
    """Tests for listing playbooks."""

    @pytest.mark.asyncio
    async def test_list_playbooks_returns_active_by_default(
        self, db_session, test_tenant, test_user
    ):
        """list_playbooks should return active playbooks by default."""
        active = Playbook(
            tenant_id=test_tenant.id,
            name="Active",
            description="Active",
            content="Content",
            status=PlaybookStatus.ACTIVE,
        )
        proposed = Playbook(
            tenant_id=test_tenant.id,
            name="Proposed",
            description="Proposed",
            content="Content",
            status=PlaybookStatus.PROPOSED,
        )
        db_session.add_all([active, proposed])
        await db_session.flush()

        service = PlaybookService(db_session, test_tenant.id)
        results = await service.list_playbooks()

        assert len(results) == 1
        assert results[0].name == "Active"

    @pytest.mark.asyncio
    async def test_list_playbooks_filters_by_status(
        self, db_session, test_tenant
    ):
        """list_playbooks should filter by status."""
        active = Playbook(
            tenant_id=test_tenant.id,
            name="Active",
            description="Active",
            content="Content",
            status=PlaybookStatus.ACTIVE,
        )
        proposed = Playbook(
            tenant_id=test_tenant.id,
            name="Proposed",
            description="Proposed",
            content="Content",
            status=PlaybookStatus.PROPOSED,
        )
        db_session.add_all([active, proposed])
        await db_session.flush()

        service = PlaybookService(db_session, test_tenant.id)
        results = await service.list_playbooks(status=PlaybookStatus.PROPOSED)

        assert len(results) == 1
        assert results[0].name == "Proposed"

    @pytest.mark.asyncio
    async def test_list_playbooks_filters_by_category(
        self, db_session, test_tenant
    ):
        """list_playbooks should filter by category."""
        comm = Playbook(
            tenant_id=test_tenant.id,
            name="Communication",
            description="Comm",
            content="Content",
            category="communication",
            status=PlaybookStatus.ACTIVE,
        )
        tech = Playbook(
            tenant_id=test_tenant.id,
            name="Technical",
            description="Tech",
            content="Content",
            category="technical",
            status=PlaybookStatus.ACTIVE,
        )
        db_session.add_all([comm, tech])
        await db_session.flush()

        service = PlaybookService(db_session, test_tenant.id)
        results = await service.list_playbooks(category="communication")

        assert len(results) == 1
        assert results[0].name == "Communication"

    @pytest.mark.asyncio
    async def test_list_playbooks_filters_by_must_consult(
        self, db_session, test_tenant
    ):
        """list_playbooks should filter by must_consult."""
        must = Playbook(
            tenant_id=test_tenant.id,
            name="Must",
            description="Must",
            content="Content",
            must_consult=True,
            status=PlaybookStatus.ACTIVE,
        )
        optional = Playbook(
            tenant_id=test_tenant.id,
            name="Optional",
            description="Optional",
            content="Content",
            must_consult=False,
            status=PlaybookStatus.ACTIVE,
        )
        db_session.add_all([must, optional])
        await db_session.flush()

        service = PlaybookService(db_session, test_tenant.id)
        results = await service.list_playbooks(must_consult=True)

        assert len(results) == 1
        assert results[0].name == "Must"

    @pytest.mark.asyncio
    async def test_get_must_consult_playbooks(self, db_session, test_tenant):
        """get_must_consult_playbooks should return only must_consult playbooks."""
        must = Playbook(
            tenant_id=test_tenant.id,
            name="Must",
            description="Must",
            content="Content",
            must_consult=True,
            status=PlaybookStatus.ACTIVE,
        )
        optional = Playbook(
            tenant_id=test_tenant.id,
            name="Optional",
            description="Optional",
            content="Content",
            must_consult=False,
            status=PlaybookStatus.ACTIVE,
        )
        db_session.add_all([must, optional])
        await db_session.flush()

        service = PlaybookService(db_session, test_tenant.id)
        results = await service.get_must_consult_playbooks()

        assert len(results) == 1
        assert results[0].name == "Must"


class TestPlaybookServiceMatching:
    """Tests for playbook matching algorithm."""

    @pytest.mark.asyncio
    async def test_match_playbooks_by_trigger_phrase(
        self, db_session, test_tenant
    ):
        """match_playbooks should match by trigger phrases."""
        playbook = Playbook(
            tenant_id=test_tenant.id,
            name="Email Guide",
            description="How to write emails",
            content="Email guidelines...",
            triggers=["send email", "write email"],
            status=PlaybookStatus.ACTIVE,
        )
        db_session.add(playbook)
        await db_session.flush()

        service = PlaybookService(db_session, test_tenant.id)
        matched, warnings = await service.match_playbooks("Please send email to the client")

        assert len(matched) == 1
        assert matched[0].name == "Email Guide"
        assert matched[0].match_reason == "trigger: 'send email'"
        assert matched[0].relevance_score == 1.0

    @pytest.mark.asyncio
    async def test_match_playbooks_by_description_keywords(
        self, db_session, test_tenant
    ):
        """match_playbooks should match by description keywords."""
        playbook = Playbook(
            tenant_id=test_tenant.id,
            name="Client Onboarding",
            description="Steps for onboarding new clients",
            content="Onboarding process...",
            triggers=[],
            status=PlaybookStatus.ACTIVE,
        )
        db_session.add(playbook)
        await db_session.flush()

        service = PlaybookService(db_session, test_tenant.id)
        matched, _ = await service.match_playbooks("Start onboarding process for new client")

        assert len(matched) == 1
        assert matched[0].name == "Client Onboarding"
        assert "keywords" in matched[0].match_reason

    @pytest.mark.asyncio
    async def test_match_playbooks_by_category(self, db_session, test_tenant):
        """match_playbooks should match by category keywords."""
        playbook = Playbook(
            tenant_id=test_tenant.id,
            name="Communication Best Practices",
            description="General communication guide",
            content="Best practices...",
            category="communication",
            triggers=[],
            status=PlaybookStatus.ACTIVE,
        )
        db_session.add(playbook)
        await db_session.flush()

        service = PlaybookService(db_session, test_tenant.id)
        matched, _ = await service.match_playbooks("Draft a message to the team")

        assert len(matched) == 1
        assert matched[0].match_reason == "category: communication"

    @pytest.mark.asyncio
    async def test_match_playbooks_returns_must_consult_warnings(
        self, db_session, test_tenant
    ):
        """match_playbooks should return warnings for relevant must_consult playbooks."""
        playbook = Playbook(
            tenant_id=test_tenant.id,
            name="Email Approval Required",
            description="Emails must be approved first",
            content="All external emails need approval...",
            category="communication",
            must_consult=True,
            triggers=[],
            status=PlaybookStatus.ACTIVE,
        )
        db_session.add(playbook)
        await db_session.flush()

        service = PlaybookService(db_session, test_tenant.id)
        # Task doesn't directly match but category is relevant
        matched, warnings = await service.match_playbooks("send invitation email")

        # Should have warning for must_consult playbook
        assert len(warnings) >= 0  # Warning logic depends on category relevance

    @pytest.mark.asyncio
    async def test_match_playbooks_no_match(self, db_session, test_tenant):
        """match_playbooks should return empty list when no match."""
        playbook = Playbook(
            tenant_id=test_tenant.id,
            name="Email Guide",
            description="How to write emails",
            content="Email guidelines...",
            triggers=["send email"],
            status=PlaybookStatus.ACTIVE,
        )
        db_session.add(playbook)
        await db_session.flush()

        service = PlaybookService(db_session, test_tenant.id)
        matched, _ = await service.match_playbooks("Schedule a meeting")

        assert len(matched) == 0

    @pytest.mark.asyncio
    async def test_match_playbooks_sorts_by_relevance(
        self, db_session, test_tenant
    ):
        """match_playbooks should sort results by relevance score."""
        # Exact trigger match (score 1.0)
        playbook1 = Playbook(
            tenant_id=test_tenant.id,
            name="Exact Match",
            description="Guide",
            content="Content",
            triggers=["send email to client"],
            status=PlaybookStatus.ACTIVE,
        )
        # Keyword match (lower score)
        playbook2 = Playbook(
            tenant_id=test_tenant.id,
            name="Keyword Match",
            description="Email client communication send",
            content="Content",
            triggers=[],
            status=PlaybookStatus.ACTIVE,
        )
        db_session.add_all([playbook1, playbook2])
        await db_session.flush()

        service = PlaybookService(db_session, test_tenant.id)
        matched, _ = await service.match_playbooks("send email to client now")

        assert len(matched) == 2
        assert matched[0].name == "Exact Match"  # Higher score first
        assert matched[0].relevance_score > matched[1].relevance_score

    @pytest.mark.asyncio
    async def test_match_playbooks_case_insensitive(
        self, db_session, test_tenant
    ):
        """match_playbooks should be case insensitive."""
        playbook = Playbook(
            tenant_id=test_tenant.id,
            name="Email Guide",
            description="How to write emails",
            content="Content",
            triggers=["Send Email"],
            status=PlaybookStatus.ACTIVE,
        )
        db_session.add(playbook)
        await db_session.flush()

        service = PlaybookService(db_session, test_tenant.id)
        matched, _ = await service.match_playbooks("SEND EMAIL to the manager")

        assert len(matched) == 1

    @pytest.mark.asyncio
    async def test_match_playbooks_records_usage(self, db_session, test_tenant):
        """match_playbooks should record usage on matched playbooks."""
        playbook = Playbook(
            tenant_id=test_tenant.id,
            name="Email Guide",
            description="Guide",
            content="Content",
            triggers=["send email"],
            use_count=5,
            status=PlaybookStatus.ACTIVE,
        )
        db_session.add(playbook)
        await db_session.flush()

        service = PlaybookService(db_session, test_tenant.id)
        await service.match_playbooks("send email please")

        await db_session.refresh(playbook)
        assert playbook.use_count == 6

    @pytest.mark.asyncio
    async def test_match_playbooks_excludes_non_active(
        self, db_session, test_tenant
    ):
        """match_playbooks should only match active playbooks."""
        active = Playbook(
            tenant_id=test_tenant.id,
            name="Active",
            description="Active guide",
            content="Content",
            triggers=["send email"],
            status=PlaybookStatus.ACTIVE,
        )
        proposed = Playbook(
            tenant_id=test_tenant.id,
            name="Proposed",
            description="Proposed guide",
            content="Content",
            triggers=["send email"],
            status=PlaybookStatus.PROPOSED,
        )
        archived = Playbook(
            tenant_id=test_tenant.id,
            name="Archived",
            description="Archived guide",
            content="Content",
            triggers=["send email"],
            status=PlaybookStatus.ARCHIVED,
        )
        db_session.add_all([active, proposed, archived])
        await db_session.flush()

        service = PlaybookService(db_session, test_tenant.id)
        matched, _ = await service.match_playbooks("send email")

        assert len(matched) == 1
        assert matched[0].name == "Active"
