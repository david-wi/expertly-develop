"""Integration tests for projects API endpoints."""

import pytest
from uuid import uuid4

from app.models import Project


class TestListProjects:
    """Tests for GET /api/projects endpoint."""

    @pytest.mark.asyncio
    async def test_list_projects_returns_projects(
        self, client, db_session, test_tenant
    ):
        """List projects should return projects."""
        project = Project(
            tenant_id=test_tenant.id,
            name="Test Project",
            description="A test project",
            project_type="project",
            status="active",
        )
        db_session.add(project)
        await db_session.commit()

        response = await client.get("/api/projects")

        assert response.status_code == 200
        data = response.json()
        assert any(p["name"] == "Test Project" for p in data)

    @pytest.mark.asyncio
    async def test_list_projects_filters_by_status(
        self, client, db_session, test_tenant
    ):
        """List projects should filter by status."""
        active = Project(
            tenant_id=test_tenant.id,
            name="Active Project",
            status="active",
        )
        completed = Project(
            tenant_id=test_tenant.id,
            name="Completed Project",
            status="completed",
        )
        db_session.add_all([active, completed])
        await db_session.commit()

        response = await client.get("/api/projects?status=active")

        assert response.status_code == 200
        data = response.json()
        assert all(p["status"] == "active" for p in data)

    @pytest.mark.asyncio
    async def test_list_projects_pagination(
        self, client, db_session, test_tenant
    ):
        """List projects should support pagination."""
        for i in range(5):
            db_session.add(Project(
                tenant_id=test_tenant.id,
                name=f"Project {i}",
                status="active",
            ))
        await db_session.commit()

        response = await client.get("/api/projects?limit=2&offset=2")

        assert response.status_code == 200
        data = response.json()
        assert len(data) == 2


class TestCreateProject:
    """Tests for POST /api/projects endpoint."""

    @pytest.mark.asyncio
    async def test_create_project_returns_201(self, client):
        """Create project should return 201 Created."""
        response = await client.post("/api/projects", json={
            "name": "New Project",
            "description": "Project description",
        })

        assert response.status_code == 201
        data = response.json()
        assert data["name"] == "New Project"
        assert data["status"] == "active"

    @pytest.mark.asyncio
    async def test_create_project_with_all_fields(self, client):
        """Create project should accept all fields."""
        response = await client.post("/api/projects", json={
            "name": "Full Project",
            "description": "Full description",
            "project_type": "initiative",
            "success_criteria": "Ship by Q2",
            "target_date": "2026-06-30",
        })

        assert response.status_code == 201
        data = response.json()
        assert data["project_type"] == "initiative"
        assert data["success_criteria"] == "Ship by Q2"

    @pytest.mark.asyncio
    async def test_create_project_requires_name(self, client):
        """Create project should require name."""
        response = await client.post("/api/projects", json={
            "description": "No name",
        })

        assert response.status_code == 422


class TestGetProject:
    """Tests for GET /api/projects/{id} endpoint."""

    @pytest.mark.asyncio
    async def test_get_project_returns_project(
        self, client, db_session, test_tenant
    ):
        """Get project should return project."""
        project = Project(
            id=uuid4(),
            tenant_id=test_tenant.id,
            name="Get Me",
            status="active",
        )
        db_session.add(project)
        await db_session.commit()

        response = await client.get(f"/api/projects/{project.id}")

        assert response.status_code == 200
        data = response.json()
        assert data["name"] == "Get Me"

    @pytest.mark.asyncio
    async def test_get_project_returns_404_for_nonexistent(self, client):
        """Get project should return 404 for nonexistent ID."""
        response = await client.get(f"/api/projects/{uuid4()}")

        assert response.status_code == 404


class TestUpdateProject:
    """Tests for PUT /api/projects/{id} endpoint."""

    @pytest.mark.asyncio
    async def test_update_project_updates_fields(
        self, client, db_session, test_tenant
    ):
        """Update project should update fields."""
        project = Project(
            id=uuid4(),
            tenant_id=test_tenant.id,
            name="Original",
            status="active",
        )
        db_session.add(project)
        await db_session.commit()

        response = await client.put(f"/api/projects/{project.id}", json={
            "name": "Updated",
            "status": "on_hold",
        })

        assert response.status_code == 200
        data = response.json()
        assert data["name"] == "Updated"
        assert data["status"] == "on_hold"

    @pytest.mark.asyncio
    async def test_update_project_partial_update(
        self, client, db_session, test_tenant
    ):
        """Update project should support partial updates."""
        project = Project(
            id=uuid4(),
            tenant_id=test_tenant.id,
            name="Original Name",
            description="Original desc",
            status="active",
        )
        db_session.add(project)
        await db_session.commit()

        response = await client.put(f"/api/projects/{project.id}", json={
            "description": "New description",
        })

        assert response.status_code == 200
        data = response.json()
        assert data["name"] == "Original Name"  # Unchanged
        assert data["description"] == "New description"  # Updated

    @pytest.mark.asyncio
    async def test_update_project_returns_404_for_nonexistent(self, client):
        """Update project should return 404 for nonexistent ID."""
        response = await client.put(f"/api/projects/{uuid4()}", json={
            "name": "Updated",
        })

        assert response.status_code == 404


class TestDeleteProject:
    """Tests for DELETE /api/projects/{id} endpoint."""

    @pytest.mark.asyncio
    async def test_delete_project_archives_project(
        self, client, db_session, test_tenant
    ):
        """Delete project should archive the project."""
        project = Project(
            id=uuid4(),
            tenant_id=test_tenant.id,
            name="To Archive",
            status="active",
        )
        db_session.add(project)
        await db_session.commit()

        response = await client.delete(f"/api/projects/{project.id}")

        assert response.status_code == 204

        # Verify it was archived
        await db_session.refresh(project)
        assert project.status == "archived"

    @pytest.mark.asyncio
    async def test_delete_project_returns_404_for_nonexistent(self, client):
        """Delete project should return 404 for nonexistent ID."""
        response = await client.delete(f"/api/projects/{uuid4()}")

        assert response.status_code == 404


class TestProjectHierarchy:
    """Tests for project parent-child relationships."""

    @pytest.mark.asyncio
    async def test_create_subproject(
        self, client, db_session, test_tenant
    ):
        """Should be able to create a subproject with parent_id."""
        parent = Project(
            id=uuid4(),
            tenant_id=test_tenant.id,
            name="Parent Project",
            status="active",
        )
        db_session.add(parent)
        await db_session.commit()

        response = await client.post("/api/projects", json={
            "name": "Child Project",
            "parent_id": str(parent.id),
        })

        assert response.status_code == 201
        data = response.json()
        assert data["parent_id"] == str(parent.id)
