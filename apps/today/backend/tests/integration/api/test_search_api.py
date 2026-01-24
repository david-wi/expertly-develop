"""Integration tests for Search API."""

import pytest
from uuid import uuid4

from app.models import Task, Person, Playbook, Project, Knowledge
from app.models.playbook import PlaybookStatus


class TestSearchAPI:
    """Integration tests for /api/search endpoint."""

    @pytest.mark.asyncio
    async def test_search_requires_query(self, client):
        """GET /api/search requires a query parameter."""
        response = await client.get("/api/search")
        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_search_empty_query(self, client):
        """GET /api/search with empty query returns validation error."""
        response = await client.get("/api/search?q=")
        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_search_returns_empty_results(self, client):
        """GET /api/search with no matches returns empty results."""
        response = await client.get("/api/search?q=nonexistentquery12345")
        assert response.status_code == 200
        data = response.json()
        assert data["query"] == "nonexistentquery12345"
        assert data["results"] == []
        assert data["total_count"] == 0

    @pytest.mark.asyncio
    async def test_search_tasks(self, client, db_session, test_tenant):
        """GET /api/search finds tasks by title."""
        # Create a task
        await client.post(
            "/api/tasks",
            json={"title": "Review quarterly report", "description": "Need to review Q4 numbers"},
        )

        # Search for it
        response = await client.get("/api/search?q=quarterly")
        assert response.status_code == 200
        data = response.json()

        assert data["total_count"] >= 1
        task_results = [r for r in data["results"] if r["entity_type"] == "task"]
        assert len(task_results) >= 1
        assert any("quarterly" in r["title"].lower() for r in task_results)

    @pytest.mark.asyncio
    async def test_search_tasks_by_description(self, client):
        """GET /api/search finds tasks by description."""
        await client.post(
            "/api/tasks",
            json={"title": "Generic task", "description": "Contains unique keyword xyzabc"},
        )

        response = await client.get("/api/search?q=xyzabc")
        assert response.status_code == 200
        data = response.json()

        assert data["total_count"] >= 1
        assert any(r["entity_type"] == "task" for r in data["results"])

    @pytest.mark.asyncio
    async def test_search_people(self, client, db_session, test_tenant):
        """GET /api/search finds people by name."""
        # Create a person directly
        person = Person(
            id=uuid4(),
            tenant_id=test_tenant.id,
            name="Maria Rodriguez",
            email="maria@example.com",
            title="VP Engineering",
            company="TechCorp",
        )
        db_session.add(person)
        await db_session.commit()

        # Search by name
        response = await client.get("/api/search?q=Maria")
        assert response.status_code == 200
        data = response.json()

        assert data["total_count"] >= 1
        person_results = [r for r in data["results"] if r["entity_type"] == "person"]
        assert len(person_results) >= 1
        assert any("Maria" in r["title"] for r in person_results)

    @pytest.mark.asyncio
    async def test_search_playbooks(self, client, db_session, test_tenant):
        """GET /api/search finds playbooks by name and content."""
        playbook = Playbook(
            id=uuid4(),
            tenant_id=test_tenant.id,
            name="Client Onboarding Guide",
            description="Steps for onboarding new clients",
            category="sales",
            triggers=["onboard", "new client"],
            content="Welcome new clients with a kickoff meeting...",
            status=PlaybookStatus.ACTIVE,
        )
        db_session.add(playbook)
        await db_session.commit()

        response = await client.get("/api/search?q=onboarding")
        assert response.status_code == 200
        data = response.json()

        assert data["total_count"] >= 1
        playbook_results = [r for r in data["results"] if r["entity_type"] == "playbook"]
        assert len(playbook_results) >= 1

    @pytest.mark.asyncio
    async def test_search_projects(self, client, db_session, test_tenant):
        """GET /api/search finds projects by name."""
        project = Project(
            id=uuid4(),
            tenant_id=test_tenant.id,
            name="Website Redesign Initiative",
            description="Complete overhaul of company website",
            project_type="project",
            status="active",
        )
        db_session.add(project)
        await db_session.commit()

        response = await client.get("/api/search?q=redesign")
        assert response.status_code == 200
        data = response.json()

        assert data["total_count"] >= 1
        project_results = [r for r in data["results"] if r["entity_type"] == "project"]
        assert len(project_results) >= 1

    @pytest.mark.asyncio
    async def test_search_filter_by_entity_type(self, client, db_session, test_tenant):
        """GET /api/search can filter by entity type."""
        # Create a task and person with similar terms
        await client.post(
            "/api/tasks",
            json={"title": "Review proposal for Acme Corp"},
        )

        person = Person(
            id=uuid4(),
            tenant_id=test_tenant.id,
            name="John Acme",
            company="Acme Corp",
        )
        db_session.add(person)
        await db_session.commit()

        # Search for 'Acme' filtered to tasks only
        response = await client.get("/api/search?q=Acme&entity_types=task")
        assert response.status_code == 200
        data = response.json()

        # Should only return tasks
        for result in data["results"]:
            assert result["entity_type"] == "task"

        # Search filtered to person only
        response = await client.get("/api/search?q=Acme&entity_types=person")
        assert response.status_code == 200
        data = response.json()

        for result in data["results"]:
            assert result["entity_type"] == "person"

    @pytest.mark.asyncio
    async def test_search_multiple_entity_types(self, client, db_session, test_tenant):
        """GET /api/search can filter by multiple entity types."""
        await client.post("/api/tasks", json={"title": "Universal search test task"})

        person = Person(
            id=uuid4(),
            tenant_id=test_tenant.id,
            name="Universal Test Person",
        )
        db_session.add(person)
        await db_session.commit()

        # Search for 'Universal' in both tasks and people
        response = await client.get("/api/search?q=Universal&entity_types=task,person")
        assert response.status_code == 200
        data = response.json()

        entity_types = {r["entity_type"] for r in data["results"]}
        assert "task" in entity_types or "person" in entity_types

    @pytest.mark.asyncio
    async def test_search_limit(self, client):
        """GET /api/search respects limit parameter."""
        # Create multiple tasks
        for i in range(5):
            await client.post("/api/tasks", json={"title": f"Bulk test task {i}"})

        response = await client.get("/api/search?q=Bulk&limit=2")
        assert response.status_code == 200
        data = response.json()

        assert len(data["results"]) <= 2

    @pytest.mark.asyncio
    async def test_search_relevance_ordering(self, client, db_session, test_tenant):
        """GET /api/search orders results by relevance."""
        # Create tasks with different relevance to "meeting"
        await client.post(
            "/api/tasks",
            json={"title": "Meeting preparation", "description": "Prepare slides"},
        )
        await client.post(
            "/api/tasks",
            json={"title": "Work on other stuff", "description": "Has meeting in description"},
        )

        response = await client.get("/api/search?q=meeting")
        assert response.status_code == 200
        data = response.json()

        # The task with "meeting" in title should have higher relevance
        assert data["total_count"] >= 1
        task_results = [r for r in data["results"] if r["entity_type"] == "task"]
        if len(task_results) >= 2:
            # First result should have "meeting" in title
            assert "meeting" in task_results[0]["title"].lower()

    @pytest.mark.asyncio
    async def test_search_returns_match_context(self, client):
        """GET /api/search returns match context snippets."""
        await client.post(
            "/api/tasks",
            json={
                "title": "Task with context",
                "description": "This is a long description that contains the keyword contexttest somewhere in the middle of it",
            },
        )

        response = await client.get("/api/search?q=contexttest")
        assert response.status_code == 200
        data = response.json()

        assert data["total_count"] >= 1
        # At least one result should have match_context
        has_context = any(r.get("match_context") for r in data["results"])
        assert has_context

    @pytest.mark.asyncio
    async def test_search_unauthorized(self, unauthenticated_client):
        """GET /api/search requires authentication."""
        response = await unauthenticated_client.get("/api/search?q=test")
        assert response.status_code == 401
