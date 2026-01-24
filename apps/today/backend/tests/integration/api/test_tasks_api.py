"""Integration tests for Tasks API."""

import pytest
from uuid import uuid4

from app.models import Playbook, Project, Person, TaskPerson
from app.models.playbook import PlaybookStatus


class TestTasksAPI:
    """Integration tests for /api/tasks endpoints."""

    @pytest.mark.asyncio
    async def test_create_task(self, client):
        """POST /api/tasks creates a task."""
        response = await client.post(
            "/api/tasks",
            json={
                "title": "Test Task",
                "description": "A test task",
                "priority": 2,
            },
        )

        assert response.status_code == 201
        data = response.json()
        assert data["title"] == "Test Task"
        assert data["description"] == "A test task"
        assert data["priority"] == 2
        assert data["status"] == "queued"
        assert data["assignee"] == "claude"

    @pytest.mark.asyncio
    async def test_create_task_validation(self, client):
        """POST /api/tasks validates input."""
        # Missing title
        response = await client.post("/api/tasks", json={"description": "No title"})
        assert response.status_code == 422

        # Invalid priority
        response = await client.post(
            "/api/tasks",
            json={"title": "Test", "priority": 10},
        )
        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_list_tasks(self, client):
        """GET /api/tasks lists tasks."""
        # Create some tasks
        await client.post("/api/tasks", json={"title": "Task 1", "priority": 1})
        await client.post("/api/tasks", json={"title": "Task 2", "priority": 2})
        await client.post("/api/tasks", json={"title": "Task 3", "priority": 3})

        response = await client.get("/api/tasks")

        assert response.status_code == 200
        data = response.json()
        assert len(data) == 3

        # Should be sorted by priority
        assert data[0]["title"] == "Task 1"
        assert data[1]["title"] == "Task 2"
        assert data[2]["title"] == "Task 3"

    @pytest.mark.asyncio
    async def test_list_tasks_filter_by_status(self, client):
        """GET /api/tasks filters by status."""
        # Create and complete a task
        response = await client.post("/api/tasks", json={"title": "Task to Complete"})
        task_id = response.json()["id"]
        await client.post(f"/api/tasks/{task_id}/start")
        await client.post(f"/api/tasks/{task_id}/complete", json={"output": "Done"})

        # Create another task (queued)
        await client.post("/api/tasks", json={"title": "Queued Task"})

        # Filter by queued
        response = await client.get("/api/tasks?status=queued")
        data = response.json()
        assert len(data) == 1
        assert data[0]["title"] == "Queued Task"

        # Filter by completed
        response = await client.get("/api/tasks?status=completed")
        data = response.json()
        assert len(data) == 1
        assert data[0]["title"] == "Task to Complete"

    @pytest.mark.asyncio
    async def test_get_task(self, client):
        """GET /api/tasks/{id} returns a task."""
        response = await client.post("/api/tasks", json={"title": "Get Me"})
        task_id = response.json()["id"]

        response = await client.get(f"/api/tasks/{task_id}")

        assert response.status_code == 200
        assert response.json()["title"] == "Get Me"

    @pytest.mark.asyncio
    async def test_get_task_not_found(self, client):
        """GET /api/tasks/{id} returns 404 for unknown task."""
        response = await client.get(f"/api/tasks/{uuid4()}")
        assert response.status_code == 404

    @pytest.mark.asyncio
    async def test_update_task(self, client):
        """PUT /api/tasks/{id} updates a task."""
        response = await client.post("/api/tasks", json={"title": "Original"})
        task_id = response.json()["id"]

        response = await client.put(
            f"/api/tasks/{task_id}",
            json={"title": "Updated", "priority": 1},
        )

        assert response.status_code == 200
        data = response.json()
        assert data["title"] == "Updated"
        assert data["priority"] == 1

    @pytest.mark.asyncio
    async def test_get_next_task(self, client):
        """GET /api/tasks/next returns highest priority task."""
        await client.post("/api/tasks", json={"title": "Low", "priority": 5})
        await client.post("/api/tasks", json={"title": "High", "priority": 1})

        response = await client.get("/api/tasks/next")

        assert response.status_code == 200
        data = response.json()
        assert data["task"]["title"] == "High"
        assert data["task"]["priority"] == 1
        assert "context" in data
        assert "matched_playbooks" in data

    @pytest.mark.asyncio
    async def test_get_next_task_empty(self, client):
        """GET /api/tasks/next returns null when no tasks."""
        response = await client.get("/api/tasks/next")

        assert response.status_code == 200
        assert response.json() is None

    @pytest.mark.asyncio
    async def test_start_task(self, client):
        """POST /api/tasks/{id}/start marks task as working."""
        response = await client.post("/api/tasks", json={"title": "Start Me"})
        task_id = response.json()["id"]

        response = await client.post(f"/api/tasks/{task_id}/start")

        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "working"
        assert data["started_at"] is not None

    @pytest.mark.asyncio
    async def test_complete_task(self, client):
        """POST /api/tasks/{id}/complete marks task as completed."""
        response = await client.post("/api/tasks", json={"title": "Complete Me"})
        task_id = response.json()["id"]

        # Start first
        await client.post(f"/api/tasks/{task_id}/start")

        # Then complete
        response = await client.post(
            f"/api/tasks/{task_id}/complete",
            json={"output": "All done!", "learnings_captured": True},
        )

        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "completed"
        assert data["output"] == "All done!"
        assert data["completed_at"] is not None

    @pytest.mark.asyncio
    async def test_complete_task_invalid_state(self, client):
        """POST /api/tasks/{id}/complete fails for queued task."""
        response = await client.post("/api/tasks", json={"title": "Not Started"})
        task_id = response.json()["id"]

        response = await client.post(
            f"/api/tasks/{task_id}/complete",
            json={"output": "Done"},
        )

        assert response.status_code == 400

    @pytest.mark.asyncio
    async def test_block_task(self, client):
        """POST /api/tasks/{id}/block blocks task with question."""
        response = await client.post("/api/tasks", json={"title": "Block Me"})
        task_id = response.json()["id"]

        # Start first
        await client.post(f"/api/tasks/{task_id}/start")

        # Block
        response = await client.post(
            f"/api/tasks/{task_id}/block",
            json={
                "question_text": "What should I do?",
                "why_asking": "Need clarification",
                "what_claude_will_do": "Proceed with answer",
                "priority": 1,
            },
        )

        assert response.status_code == 200
        data = response.json()
        assert data["task"]["status"] == "blocked"
        assert data["question"]["text"] == "What should I do?"

    @pytest.mark.asyncio
    async def test_delete_task(self, client):
        """DELETE /api/tasks/{id} cancels a task."""
        response = await client.post("/api/tasks", json={"title": "Delete Me"})
        task_id = response.json()["id"]

        response = await client.delete(f"/api/tasks/{task_id}")
        assert response.status_code == 204

        # Verify it's cancelled
        response = await client.get(f"/api/tasks/{task_id}")
        assert response.json()["status"] == "cancelled"

    @pytest.mark.asyncio
    async def test_unauthorized_access(self, unauthenticated_client):
        """API requires authentication."""
        response = await unauthenticated_client.get("/api/tasks")
        assert response.status_code == 401

        response = await unauthenticated_client.post(
            "/api/tasks",
            json={"title": "Unauthorized"},
        )
        assert response.status_code == 401

    @pytest.mark.asyncio
    async def test_get_next_task_returns_context(self, client, db_session, test_tenant, test_user):
        """GET /api/tasks/next returns task context."""
        # Create a project
        project = Project(
            id=uuid4(),
            tenant_id=test_tenant.id,
            name="Context Test Project",
            project_type="project",
            status="active",
        )
        db_session.add(project)
        await db_session.commit()

        # Create a task with project
        response = await client.post(
            "/api/tasks",
            json={"title": "Task with Context", "project_id": str(project.id)},
        )
        assert response.status_code == 201

        # Get next task
        response = await client.get("/api/tasks/next")
        assert response.status_code == 200
        data = response.json()

        assert data["context"]["project"] is not None
        assert data["context"]["project"]["name"] == "Context Test Project"
        assert "related_tasks" in data["context"]
        assert "related_people" in data["context"]
        assert "history" in data["context"]

    @pytest.mark.asyncio
    async def test_get_next_task_matches_playbooks(self, client, db_session, test_tenant, test_user):
        """GET /api/tasks/next matches and returns playbooks."""
        # Create a playbook with trigger
        playbook = Playbook(
            id=uuid4(),
            tenant_id=test_tenant.id,
            name="Email Drafting Guide",
            description="How to draft emails",
            category="communication",
            triggers=["email", "draft email"],
            must_consult=False,
            content="Always be professional and concise...",
            status=PlaybookStatus.ACTIVE,
        )
        db_session.add(playbook)
        await db_session.commit()

        # Create a task that should match
        response = await client.post(
            "/api/tasks",
            json={"title": "Draft email to client", "description": "Need to send follow-up email"},
        )
        assert response.status_code == 201

        # Get next task - should match playbook
        response = await client.get("/api/tasks/next")
        assert response.status_code == 200
        data = response.json()

        assert len(data["matched_playbooks"]) >= 1
        matched_names = [p["name"] for p in data["matched_playbooks"]]
        assert "Email Drafting Guide" in matched_names

        # Check playbook data
        email_playbook = next(p for p in data["matched_playbooks"] if p["name"] == "Email Drafting Guide")
        assert email_playbook["must_consult"] is False
        assert "email" in email_playbook["match_reason"].lower()

    @pytest.mark.asyncio
    async def test_get_next_task_returns_must_consult_warnings(self, client, db_session, test_tenant, test_user):
        """GET /api/tasks/next returns must_consult warnings."""
        # Create a must_consult playbook
        playbook = Playbook(
            id=uuid4(),
            tenant_id=test_tenant.id,
            name="Scheduling Rules",
            description="Rules for scheduling meetings",
            category="scheduling",
            triggers=["schedule meeting", "book meeting"],
            must_consult=True,
            content="Always check availability first...",
            status=PlaybookStatus.ACTIVE,
        )
        db_session.add(playbook)
        await db_session.commit()

        # Create a task that should trigger must_consult
        response = await client.post(
            "/api/tasks",
            json={"title": "Schedule meeting with team"},
        )
        assert response.status_code == 201

        # Get next task
        response = await client.get("/api/tasks/next")
        assert response.status_code == 200
        data = response.json()

        # Should match the playbook
        assert len(data["matched_playbooks"]) >= 1
        scheduling_playbook = next(
            (p for p in data["matched_playbooks"] if p["name"] == "Scheduling Rules"),
            None
        )
        assert scheduling_playbook is not None
        assert scheduling_playbook["must_consult"] is True

    @pytest.mark.asyncio
    async def test_get_next_task_with_people_context(self, client, db_session, test_tenant, test_user):
        """GET /api/tasks/next includes related people in context."""
        # Create a person
        person = Person(
            id=uuid4(),
            tenant_id=test_tenant.id,
            name="Jane Smith",
            email="jane@example.com",
            title="CEO",
            company="Client Corp",
            relationship="client",
        )
        db_session.add(person)
        await db_session.flush()

        # Create a task
        response = await client.post(
            "/api/tasks",
            json={"title": "Follow up with Jane"},
        )
        task_id = response.json()["id"]

        # Link person to task
        task_person = TaskPerson(
            task_id=uuid4().hex[:8] + task_id[8:],  # SQLite workaround
            person_id=person.id,
            role="subject",
        )
        # Need to use the actual task_id
        from sqlalchemy import select
        from app.models import Task
        result = await db_session.execute(
            select(Task).where(Task.title == "Follow up with Jane")
        )
        task = result.scalar_one()
        task_person = TaskPerson(task_id=task.id, person_id=person.id, role="subject")
        db_session.add(task_person)
        await db_session.commit()

        # Get next task
        response = await client.get("/api/tasks/next")
        assert response.status_code == 200
        data = response.json()

        assert len(data["context"]["related_people"]) == 1
        person_ctx = data["context"]["related_people"][0]
        assert person_ctx["name"] == "Jane Smith"
        assert person_ctx["role"] == "subject"
        assert person_ctx["email"] == "jane@example.com"
