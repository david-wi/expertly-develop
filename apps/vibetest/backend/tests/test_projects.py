"""Project endpoint tests."""
import pytest


class TestProjectEndpoints:
    """Tests for project CRUD operations."""

    def test_create_project(self, client):
        """Test creating a new project."""
        response = client.post(
            "/api/v1/projects",
            json={"name": "My Project", "description": "Test description"},
        )
        assert response.status_code == 201
        data = response.json()
        assert data["name"] == "My Project"
        assert data["description"] == "Test description"
        assert data["status"] == "active"
        assert "id" in data
        assert "created_at" in data

    def test_create_project_without_description(self, client):
        """Test creating a project without description."""
        response = client.post("/api/v1/projects", json={"name": "Simple Project"})
        assert response.status_code == 201
        data = response.json()
        assert data["name"] == "Simple Project"
        assert data["description"] is None

    def test_create_project_missing_name(self, client):
        """Test creating a project without name fails."""
        response = client.post("/api/v1/projects", json={"description": "No name"})
        assert response.status_code == 422

    def test_list_projects(self, client, sample_project):
        """Test listing projects."""
        response = client.get("/api/v1/projects")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert len(data) >= 1
        assert any(p["id"] == sample_project["id"] for p in data)

    def test_get_project(self, client, sample_project):
        """Test getting a specific project."""
        response = client.get(f"/api/v1/projects/{sample_project['id']}")
        assert response.status_code == 200
        data = response.json()
        assert data["id"] == sample_project["id"]
        assert data["name"] == sample_project["name"]
        assert "stats" in data

    def test_get_nonexistent_project(self, client):
        """Test getting a project that doesn't exist."""
        response = client.get("/api/v1/projects/nonexistent-id")
        assert response.status_code == 404

    def test_update_project(self, client, sample_project):
        """Test updating a project."""
        response = client.patch(
            f"/api/v1/projects/{sample_project['id']}",
            json={"name": "Updated Name", "description": "Updated description"},
        )
        assert response.status_code == 200
        data = response.json()
        assert data["name"] == "Updated Name"
        assert data["description"] == "Updated description"

    def test_delete_project(self, client, sample_project):
        """Test soft-deleting a project."""
        response = client.delete(f"/api/v1/projects/{sample_project['id']}")
        assert response.status_code == 204

        # Verify it's archived
        response = client.get(f"/api/v1/projects/{sample_project['id']}")
        assert response.status_code == 404  # Soft-deleted projects are not returned
