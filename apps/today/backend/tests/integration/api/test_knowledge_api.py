"""Integration tests for knowledge API endpoints."""

import pytest
from uuid import uuid4

from app.models import Knowledge, Person
from app.models.knowledge import KnowledgeStatus, KnowledgeCategory


class TestCaptureKnowledge:
    """Tests for POST /api/knowledge/capture endpoint."""

    @pytest.mark.asyncio
    async def test_capture_knowledge_returns_201(self, client):
        """Capturing knowledge should return 201 Created."""
        response = await client.post("/api/knowledge/capture", json={
            "content": "Always use formal language with new clients",
            "category": "rule",
        })

        assert response.status_code == 201
        data = response.json()
        assert "knowledge" in data
        assert data["knowledge"]["content"] == "Always use formal language with new clients"
        assert data["knowledge"]["category"] == "rule"

    @pytest.mark.asyncio
    async def test_capture_knowledge_with_trigger_phrase(self, client):
        """Capturing knowledge with trigger phrase should store it."""
        response = await client.post("/api/knowledge/capture", json={
            "content": "Test content",
            "category": "rule",
            "trigger_phrase": "remember that",
        })

        assert response.status_code == 201
        data = response.json()
        assert data["knowledge"]["trigger_phrase"] == "remember that"

    @pytest.mark.asyncio
    async def test_capture_knowledge_returns_routing_result(self, client):
        """Capturing knowledge should return routing result."""
        response = await client.post("/api/knowledge/capture", json={
            "content": "How to handle escalations\nStep 1...",
            "category": "playbook",
        })

        assert response.status_code == 201
        data = response.json()
        assert "routed_to" in data
        assert data["routed_to"]["type"] == "playbook"
        assert "action_taken" in data["routed_to"]

    @pytest.mark.asyncio
    async def test_capture_knowledge_requires_content(self, client):
        """Capturing knowledge should require content."""
        response = await client.post("/api/knowledge/capture", json={
            "category": "rule",
        })

        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_capture_knowledge_validates_category(self, client):
        """Capturing knowledge should validate category."""
        response = await client.post("/api/knowledge/capture", json={
            "content": "Test",
            "category": "invalid_category",
        })

        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_capture_knowledge_requires_auth(self, unauthenticated_client):
        """Capturing knowledge should require authentication."""
        response = await unauthenticated_client.post("/api/knowledge/capture", json={
            "content": "Test",
            "category": "rule",
        })

        assert response.status_code == 401


class TestListKnowledge:
    """Tests for GET /api/knowledge endpoint."""

    @pytest.mark.asyncio
    async def test_list_knowledge_returns_entries(
        self, client, db_session, test_tenant
    ):
        """List knowledge should return entries."""
        knowledge = Knowledge(
            tenant_id=test_tenant.id,
            content="Test knowledge",
            category=KnowledgeCategory.RULE,
            source_type="manual",
            status=KnowledgeStatus.CAPTURED,
        )
        db_session.add(knowledge)
        await db_session.commit()

        response = await client.get("/api/knowledge")

        assert response.status_code == 200
        data = response.json()
        assert len(data) >= 1
        assert any(k["content"] == "Test knowledge" for k in data)

    @pytest.mark.asyncio
    async def test_list_knowledge_filters_by_status(
        self, client, db_session, test_tenant
    ):
        """List knowledge should filter by status."""
        captured = Knowledge(
            tenant_id=test_tenant.id,
            content="Captured",
            category=KnowledgeCategory.RULE,
            source_type="manual",
            status=KnowledgeStatus.CAPTURED,
        )
        pending = Knowledge(
            tenant_id=test_tenant.id,
            content="Pending",
            category=KnowledgeCategory.RULE,
            source_type="manual",
            status=KnowledgeStatus.PENDING_REVIEW,
        )
        db_session.add_all([captured, pending])
        await db_session.commit()

        response = await client.get("/api/knowledge?status=pending_review")

        assert response.status_code == 200
        data = response.json()
        assert all(k["status"] == "pending_review" for k in data)

    @pytest.mark.asyncio
    async def test_list_knowledge_filters_by_category(
        self, client, db_session, test_tenant
    ):
        """List knowledge should filter by category."""
        rule = Knowledge(
            tenant_id=test_tenant.id,
            content="Rule",
            category=KnowledgeCategory.RULE,
            source_type="manual",
            status=KnowledgeStatus.CAPTURED,
        )
        person = Knowledge(
            tenant_id=test_tenant.id,
            content="Person",
            category=KnowledgeCategory.PERSON,
            source_type="manual",
            status=KnowledgeStatus.CAPTURED,
        )
        db_session.add_all([rule, person])
        await db_session.commit()

        response = await client.get("/api/knowledge?category=rule")

        assert response.status_code == 200
        data = response.json()
        assert all(k["category"] == "rule" for k in data)

    @pytest.mark.asyncio
    async def test_list_knowledge_pagination(
        self, client, db_session, test_tenant
    ):
        """List knowledge should support pagination."""
        for i in range(5):
            db_session.add(Knowledge(
                tenant_id=test_tenant.id,
                content=f"Knowledge {i}",
                category=KnowledgeCategory.RULE,
                source_type="manual",
                status=KnowledgeStatus.CAPTURED,
            ))
        await db_session.commit()

        response = await client.get("/api/knowledge?limit=2&offset=2")

        assert response.status_code == 200
        data = response.json()
        assert len(data) == 2


class TestGetPendingKnowledge:
    """Tests for GET /api/knowledge/pending endpoint."""

    @pytest.mark.asyncio
    async def test_get_pending_returns_only_pending(
        self, client, db_session, test_tenant
    ):
        """Get pending should only return pending_review entries."""
        pending = Knowledge(
            tenant_id=test_tenant.id,
            content="Pending",
            category=KnowledgeCategory.SETTING,
            source_type="manual",
            status=KnowledgeStatus.PENDING_REVIEW,
        )
        captured = Knowledge(
            tenant_id=test_tenant.id,
            content="Captured",
            category=KnowledgeCategory.RULE,
            source_type="manual",
            status=KnowledgeStatus.CAPTURED,
        )
        db_session.add_all([pending, captured])
        await db_session.commit()

        response = await client.get("/api/knowledge/pending")

        assert response.status_code == 200
        data = response.json()
        assert all(k["status"] == "pending_review" for k in data)


class TestGetTriggerPhrases:
    """Tests for GET /api/knowledge/triggers endpoint."""

    @pytest.mark.asyncio
    async def test_get_triggers_returns_phrases(self, client):
        """Get triggers should return list of trigger phrases."""
        response = await client.get("/api/knowledge/triggers")

        assert response.status_code == 200
        data = response.json()
        assert "phrases" in data
        assert isinstance(data["phrases"], list)
        assert len(data["phrases"]) > 0
        assert "remember that" in data["phrases"]


class TestDismissKnowledge:
    """Tests for POST /api/knowledge/{id}/dismiss endpoint."""

    @pytest.mark.asyncio
    async def test_dismiss_knowledge_updates_status(
        self, client, db_session, test_tenant
    ):
        """Dismiss knowledge should update status to dismissed."""
        knowledge = Knowledge(
            id=uuid4(),
            tenant_id=test_tenant.id,
            content="Test",
            category=KnowledgeCategory.RULE,
            source_type="manual",
            status=KnowledgeStatus.PENDING_REVIEW,
        )
        db_session.add(knowledge)
        await db_session.commit()

        response = await client.post(
            f"/api/knowledge/{knowledge.id}/dismiss",
            json={"reason": "Not useful"},
        )

        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "dismissed"

    @pytest.mark.asyncio
    async def test_dismiss_knowledge_without_reason(
        self, client, db_session, test_tenant
    ):
        """Dismiss knowledge should work without reason."""
        knowledge = Knowledge(
            id=uuid4(),
            tenant_id=test_tenant.id,
            content="Test",
            category=KnowledgeCategory.RULE,
            source_type="manual",
            status=KnowledgeStatus.PENDING_REVIEW,
        )
        db_session.add(knowledge)
        await db_session.commit()

        response = await client.post(
            f"/api/knowledge/{knowledge.id}/dismiss",
            json={},
        )

        assert response.status_code == 200

    @pytest.mark.asyncio
    async def test_dismiss_knowledge_returns_404_for_nonexistent(self, client):
        """Dismiss knowledge should return 404 for nonexistent ID."""
        response = await client.post(
            f"/api/knowledge/{uuid4()}/dismiss",
            json={},
        )

        assert response.status_code == 404
