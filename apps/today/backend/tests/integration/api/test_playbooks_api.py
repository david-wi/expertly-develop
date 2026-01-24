"""Integration tests for playbooks API endpoints."""

import pytest
from uuid import uuid4

from app.models import Playbook
from app.models.playbook import PlaybookStatus


class TestListPlaybooks:
    """Tests for GET /api/playbooks endpoint."""

    @pytest.mark.asyncio
    async def test_list_playbooks_returns_active(
        self, client, db_session, test_tenant
    ):
        """List playbooks should return active playbooks by default."""
        active = Playbook(
            tenant_id=test_tenant.id,
            name="Active Playbook",
            description="Active",
            content="Content",
            status=PlaybookStatus.ACTIVE,
        )
        proposed = Playbook(
            tenant_id=test_tenant.id,
            name="Proposed Playbook",
            description="Proposed",
            content="Content",
            status=PlaybookStatus.PROPOSED,
        )
        db_session.add_all([active, proposed])
        await db_session.commit()

        response = await client.get("/api/playbooks")

        assert response.status_code == 200
        data = response.json()
        assert any(p["name"] == "Active Playbook" for p in data)
        assert not any(p["name"] == "Proposed Playbook" for p in data)

    @pytest.mark.asyncio
    async def test_list_playbooks_filters_by_category(
        self, client, db_session, test_tenant
    ):
        """List playbooks should filter by category."""
        comm = Playbook(
            tenant_id=test_tenant.id,
            name="Comm",
            description="Comm",
            content="Content",
            category="communication",
            status=PlaybookStatus.ACTIVE,
        )
        tech = Playbook(
            tenant_id=test_tenant.id,
            name="Tech",
            description="Tech",
            content="Content",
            category="technical",
            status=PlaybookStatus.ACTIVE,
        )
        db_session.add_all([comm, tech])
        await db_session.commit()

        response = await client.get("/api/playbooks?category=communication")

        assert response.status_code == 200
        data = response.json()
        assert all(p["category"] == "communication" for p in data)

    @pytest.mark.asyncio
    async def test_list_playbooks_filters_by_must_consult(
        self, client, db_session, test_tenant
    ):
        """List playbooks should filter by must_consult."""
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
        await db_session.commit()

        response = await client.get("/api/playbooks?must_consult=true")

        assert response.status_code == 200
        data = response.json()
        assert all(p["must_consult"] is True for p in data)

    @pytest.mark.asyncio
    async def test_list_playbooks_filters_by_status(
        self, client, db_session, test_tenant
    ):
        """List playbooks should filter by status."""
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
        await db_session.commit()

        response = await client.get("/api/playbooks?status=proposed")

        assert response.status_code == 200
        data = response.json()
        assert all(p["status"] == "proposed" for p in data)


class TestMatchPlaybooks:
    """Tests for GET /api/playbooks/match endpoint."""

    @pytest.mark.asyncio
    async def test_match_playbooks_returns_matched(
        self, client, db_session, test_tenant
    ):
        """Match playbooks should return matched playbooks."""
        playbook = Playbook(
            tenant_id=test_tenant.id,
            name="Email Guide",
            description="How to write emails",
            content="Email guidelines...",
            triggers=["send email", "write email"],
            status=PlaybookStatus.ACTIVE,
        )
        db_session.add(playbook)
        await db_session.commit()

        response = await client.get("/api/playbooks/match?task=send email to client")

        assert response.status_code == 200
        data = response.json()
        assert "matched" in data
        assert len(data["matched"]) >= 1
        assert data["matched"][0]["name"] == "Email Guide"

    @pytest.mark.asyncio
    async def test_match_playbooks_returns_must_consult_warnings(
        self, client, db_session, test_tenant
    ):
        """Match playbooks should return must_consult warnings."""
        playbook = Playbook(
            tenant_id=test_tenant.id,
            name="Email Approval",
            description="Email approval process",
            content="All emails need approval...",
            category="communication",
            must_consult=True,
            triggers=[],
            status=PlaybookStatus.ACTIVE,
        )
        db_session.add(playbook)
        await db_session.commit()

        response = await client.get("/api/playbooks/match?task=write a message")

        assert response.status_code == 200
        data = response.json()
        assert "must_consult" in data

    @pytest.mark.asyncio
    async def test_match_playbooks_requires_task(self, client):
        """Match playbooks should require task parameter."""
        response = await client.get("/api/playbooks/match")

        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_match_playbooks_empty_when_no_match(
        self, client, db_session, test_tenant
    ):
        """Match playbooks should return empty when no match."""
        playbook = Playbook(
            tenant_id=test_tenant.id,
            name="Email Guide",
            description="Email",
            content="Content",
            triggers=["email"],
            status=PlaybookStatus.ACTIVE,
        )
        db_session.add(playbook)
        await db_session.commit()

        response = await client.get("/api/playbooks/match?task=schedule a meeting")

        assert response.status_code == 200
        data = response.json()
        assert len(data["matched"]) == 0


class TestCreatePlaybook:
    """Tests for POST /api/playbooks endpoint."""

    @pytest.mark.asyncio
    async def test_create_playbook_returns_201(self, client):
        """Create playbook should return 201 Created."""
        response = await client.post("/api/playbooks", json={
            "name": "New Playbook",
            "description": "Description",
            "content": "Content here",
            "category": "communication",
            "triggers": ["trigger1", "trigger2"],
            "must_consult": False,
        })

        assert response.status_code == 201
        data = response.json()
        assert data["name"] == "New Playbook"
        assert data["status"] == "active"

    @pytest.mark.asyncio
    async def test_create_playbook_requires_name(self, client):
        """Create playbook should require name."""
        response = await client.post("/api/playbooks", json={
            "description": "Description",
            "content": "Content",
        })

        assert response.status_code == 422


class TestProposePlaybook:
    """Tests for POST /api/playbooks/propose endpoint."""

    @pytest.mark.asyncio
    async def test_propose_playbook_returns_201(self, client):
        """Propose playbook should return 201 Created."""
        response = await client.post("/api/playbooks/propose", json={
            "name": "Proposed Playbook",
            "description": "Learned pattern",
            "content": "When X, do Y",
            "learned_from": "Observed on task 123",
        })

        assert response.status_code == 201
        data = response.json()
        assert data["name"] == "Proposed Playbook"
        assert data["status"] == "proposed"
        assert data["learned_from"] == "Observed on task 123"


class TestGetPlaybook:
    """Tests for GET /api/playbooks/{id} endpoint."""

    @pytest.mark.asyncio
    async def test_get_playbook_returns_playbook(
        self, client, db_session, test_tenant
    ):
        """Get playbook should return playbook by ID."""
        playbook = Playbook(
            id=uuid4(),
            tenant_id=test_tenant.id,
            name="Test Playbook",
            description="Test",
            content="Content",
            status=PlaybookStatus.ACTIVE,
        )
        db_session.add(playbook)
        await db_session.commit()

        response = await client.get(f"/api/playbooks/{playbook.id}")

        assert response.status_code == 200
        data = response.json()
        assert data["name"] == "Test Playbook"

    @pytest.mark.asyncio
    async def test_get_playbook_returns_404_for_nonexistent(self, client):
        """Get playbook should return 404 for nonexistent ID."""
        response = await client.get(f"/api/playbooks/{uuid4()}")

        assert response.status_code == 404


class TestUpdatePlaybook:
    """Tests for PUT /api/playbooks/{id} endpoint."""

    @pytest.mark.asyncio
    async def test_update_playbook_updates_fields(
        self, client, db_session, test_tenant
    ):
        """Update playbook should update fields."""
        playbook = Playbook(
            id=uuid4(),
            tenant_id=test_tenant.id,
            name="Original",
            description="Original",
            content="Content",
            status=PlaybookStatus.ACTIVE,
        )
        db_session.add(playbook)
        await db_session.commit()

        response = await client.put(f"/api/playbooks/{playbook.id}", json={
            "name": "Updated",
            "description": "Updated description",
        })

        assert response.status_code == 200
        data = response.json()
        assert data["name"] == "Updated"
        assert data["description"] == "Updated description"

    @pytest.mark.asyncio
    async def test_update_playbook_returns_404_for_nonexistent(self, client):
        """Update playbook should return 404 for nonexistent ID."""
        response = await client.put(f"/api/playbooks/{uuid4()}", json={
            "name": "Updated",
        })

        assert response.status_code == 404


class TestApprovePlaybook:
    """Tests for PUT /api/playbooks/{id}/approve endpoint."""

    @pytest.mark.asyncio
    async def test_approve_playbook_changes_status(
        self, client, db_session, test_tenant
    ):
        """Approve playbook should change status to active."""
        playbook = Playbook(
            id=uuid4(),
            tenant_id=test_tenant.id,
            name="Proposed",
            description="Proposed",
            content="Content",
            status=PlaybookStatus.PROPOSED,
        )
        db_session.add(playbook)
        await db_session.commit()

        response = await client.put(f"/api/playbooks/{playbook.id}/approve")

        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "active"

    @pytest.mark.asyncio
    async def test_approve_playbook_returns_400_for_non_proposed(
        self, client, db_session, test_tenant
    ):
        """Approve playbook should return 400 for non-proposed playbook."""
        playbook = Playbook(
            id=uuid4(),
            tenant_id=test_tenant.id,
            name="Active",
            description="Active",
            content="Content",
            status=PlaybookStatus.ACTIVE,
        )
        db_session.add(playbook)
        await db_session.commit()

        response = await client.put(f"/api/playbooks/{playbook.id}/approve")

        assert response.status_code == 400


class TestArchivePlaybook:
    """Tests for PUT /api/playbooks/{id}/archive endpoint."""

    @pytest.mark.asyncio
    async def test_archive_playbook_changes_status(
        self, client, db_session, test_tenant
    ):
        """Archive playbook should change status to archived."""
        playbook = Playbook(
            id=uuid4(),
            tenant_id=test_tenant.id,
            name="Active",
            description="Active",
            content="Content",
            status=PlaybookStatus.ACTIVE,
        )
        db_session.add(playbook)
        await db_session.commit()

        response = await client.put(f"/api/playbooks/{playbook.id}/archive")

        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "archived"

    @pytest.mark.asyncio
    async def test_archive_playbook_returns_404_for_nonexistent(self, client):
        """Archive playbook should return 404 for nonexistent ID."""
        response = await client.put(f"/api/playbooks/{uuid4()}/archive")

        assert response.status_code == 404
