"""Comprehensive API test suite for Expertly Develop."""

import pytest
import httpx
import asyncio
from datetime import datetime

# API base URL - can be overridden with environment variable
API_BASE_URL = "http://expertly-develop-api.152.42.152.243.sslip.io/api/v1"


class TestHealthAPI:
    """Test health endpoints."""

    def test_health_check(self, client):
        """Test health endpoint returns healthy status."""
        response = client.get("/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "healthy"
        assert "services" in data
        assert data["services"]["mongodb"] == "healthy"


class TestProjectsAPI:
    """Test projects endpoints."""

    def test_list_projects(self, client):
        """Test listing projects."""
        response = client.get("/projects")
        assert response.status_code == 200
        data = response.json()
        assert "items" in data
        assert "total" in data
        assert isinstance(data["items"], list)
        assert isinstance(data["total"], int)

    def test_create_project(self, client):
        """Test creating a new project."""
        project_data = {
            "name": f"Test Project {datetime.now().isoformat()}",
            "description": "A test project for API testing",
            "visibility": "private",
            "site_url": "https://test.example.com",
        }
        response = client.post("/projects", json=project_data)
        assert response.status_code == 201
        data = response.json()
        assert data["name"] == project_data["name"]
        assert data["description"] == project_data["description"]
        assert data["visibility"] == project_data["visibility"]
        assert data["site_url"] == project_data["site_url"]
        assert "id" in data
        assert "created_at" in data
        return data["id"]

    def test_create_project_minimal(self, client):
        """Test creating a project with minimal data."""
        project_data = {
            "name": f"Minimal Project {datetime.now().isoformat()}",
        }
        response = client.post("/projects", json=project_data)
        assert response.status_code == 201
        data = response.json()
        assert data["name"] == project_data["name"]
        assert data["visibility"] == "private"  # default

    def test_create_project_missing_name(self, client):
        """Test creating a project without name fails."""
        response = client.post("/projects", json={})
        assert response.status_code == 422

    def test_get_project(self, client, test_project_id):
        """Test getting a specific project."""
        response = client.get(f"/projects/{test_project_id}")
        assert response.status_code == 200
        data = response.json()
        assert data["id"] == test_project_id

    def test_get_project_not_found(self, client):
        """Test getting a non-existent project."""
        response = client.get("/projects/000000000000000000000000")
        assert response.status_code == 404

    def test_update_project(self, client, test_project_id):
        """Test updating a project."""
        updates = {
            "name": f"Updated Project {datetime.now().isoformat()}",
            "description": "Updated description",
        }
        response = client.put(f"/projects/{test_project_id}", json=updates)
        assert response.status_code == 200
        data = response.json()
        assert data["name"] == updates["name"]
        assert data["description"] == updates["description"]

    def test_delete_project(self, client):
        """Test deleting a project."""
        # First create a project to delete
        project_data = {"name": f"Delete Me {datetime.now().isoformat()}"}
        create_response = client.post("/projects", json=project_data)
        project_id = create_response.json()["id"]

        # Delete it
        response = client.delete(f"/projects/{project_id}")
        assert response.status_code == 204

        # Verify it's gone
        get_response = client.get(f"/projects/{project_id}")
        assert get_response.status_code == 404


class TestJobsAPI:
    """Test jobs endpoints."""

    def test_list_jobs(self, client):
        """Test listing jobs."""
        response = client.get("/jobs")
        assert response.status_code == 200
        data = response.json()
        assert "items" in data
        assert "total" in data
        assert "stats" in data

    def test_list_jobs_with_status_filter(self, client):
        """Test listing jobs with status filter."""
        response = client.get("/jobs", params={"status": "completed"})
        assert response.status_code == 200
        data = response.json()
        for job in data["items"]:
            assert job["status"] == "completed"

    def test_get_job_not_found(self, client):
        """Test getting a non-existent job."""
        response = client.get("/jobs/000000000000000000000000")
        assert response.status_code == 404


class TestArtifactsAPI:
    """Test artifacts endpoints."""

    def test_list_artifacts(self, client):
        """Test listing artifacts."""
        response = client.get("/artifacts")
        assert response.status_code == 200
        data = response.json()
        assert "items" in data
        assert "total" in data

    def test_list_artifacts_with_project_filter(self, client, test_project_id):
        """Test listing artifacts with project filter."""
        response = client.get("/artifacts", params={"project_id": test_project_id})
        assert response.status_code == 200
        data = response.json()
        for artifact in data["items"]:
            assert artifact["project_id"] == test_project_id

    def test_get_artifact_not_found(self, client):
        """Test getting a non-existent artifact."""
        response = client.get("/artifacts/000000000000000000000000")
        assert response.status_code == 404


class TestScenariosAPI:
    """Test scenarios endpoints."""

    def test_list_scenarios(self, client):
        """Test listing preconfigured scenarios."""
        response = client.get("/scenarios")
        assert response.status_code == 200
        data = response.json()
        assert "items" in data
        assert "total" in data
        # Should have at least the seeded scenarios
        assert len(data["items"]) >= 2

    def test_get_scenario(self, client):
        """Test getting a specific scenario by code."""
        response = client.get("/scenarios/basic_visual_walkthrough")
        assert response.status_code == 200
        data = response.json()
        assert data["code"] == "basic_visual_walkthrough"
        assert "scenario_template" in data
        assert "default_observations" in data

    def test_get_scenario_not_found(self, client):
        """Test getting a non-existent scenario."""
        response = client.get("/scenarios/nonexistent_scenario")
        assert response.status_code == 404


class TestPersonasAPI:
    """Test personas endpoints."""

    def test_list_personas(self, client):
        """Test listing personas."""
        response = client.get("/personas")
        assert response.status_code == 200
        data = response.json()
        assert "items" in data
        assert "total" in data

    def test_create_persona(self, client, test_project_id):
        """Test creating a persona."""
        persona_data = {
            "project_id": test_project_id,
            "name": f"Test Persona {datetime.now().isoformat()}",
            "role_description": "A test user for API testing",
            "goals": ["Test the system", "Find bugs"],
            "task_types": ["testing", "exploration"],
        }
        response = client.post("/personas", json=persona_data)
        assert response.status_code == 201
        data = response.json()
        assert data["name"] == persona_data["name"]
        assert data["project_id"] == test_project_id
        return data["id"]


class TestWalkthroughsAPI:
    """Test walkthroughs endpoints."""

    def test_create_walkthrough(self, client, test_project_with_url):
        """Test creating a walkthrough job."""
        walkthrough_data = {
            "project_id": test_project_with_url,
            "scenario_text": "Navigate to /\nCapture \"Homepage\"",
            "label": f"Test Walkthrough {datetime.now().isoformat()}",
            "description": "A test walkthrough",
        }
        response = client.post("/walkthroughs", json=walkthrough_data)
        assert response.status_code == 201
        data = response.json()
        assert "job_id" in data
        assert data["status"] == "pending"

    def test_create_walkthrough_missing_project(self, client):
        """Test creating a walkthrough without project fails."""
        walkthrough_data = {
            "scenario_text": "Navigate to /",
        }
        response = client.post("/walkthroughs", json=walkthrough_data)
        assert response.status_code == 422

    def test_create_walkthrough_project_without_url(self, client, test_project_id):
        """Test creating a walkthrough for project without site_url fails."""
        # First check if project has site_url
        project_response = client.get(f"/projects/{test_project_id}")
        if not project_response.json().get("site_url"):
            walkthrough_data = {
                "project_id": test_project_id,
                "scenario_text": "Navigate to /",
            }
            response = client.post("/walkthroughs", json=walkthrough_data)
            # Should fail because project has no site_url
            assert response.status_code in [400, 422]


class TestDocumentsAPI:
    """Test documents endpoints."""

    def test_upload_document(self, client):
        """Test uploading a document."""
        files = {
            "file": ("test.txt", b"Test content for document upload", "text/plain"),
        }
        data = {"name": f"Test Document {datetime.now().isoformat()}"}
        response = client.post("/documents", files=files, data=data)
        assert response.status_code == 201
        result = response.json()
        assert "document_key" in result
        return result["document_key"]

    def test_get_document_not_found(self, client):
        """Test getting a non-existent document."""
        response = client.get("/documents/nonexistent-key")
        assert response.status_code == 404


class TestRequirementsAPI:
    """Test requirements endpoints."""

    def test_list_requirements(self, client):
        """Test listing requirements."""
        response = client.get("/requirements")
        assert response.status_code == 200
        data = response.json()
        assert "items" in data
        assert "total" in data


# Fixtures
@pytest.fixture(scope="session")
def client():
    """Create an HTTP client for testing."""
    return httpx.Client(base_url=API_BASE_URL, timeout=30.0)


@pytest.fixture(scope="session")
def test_project_id(client):
    """Create a test project and return its ID."""
    project_data = {
        "name": f"API Test Project {datetime.now().isoformat()}",
        "description": "Project for API testing",
        "visibility": "private",
    }
    response = client.post("/projects", json=project_data)
    return response.json()["id"]


@pytest.fixture(scope="session")
def test_project_with_url(client):
    """Create a test project with site_url and return its ID."""
    project_data = {
        "name": f"API Test Project with URL {datetime.now().isoformat()}",
        "description": "Project for walkthrough testing",
        "visibility": "private",
        "site_url": "https://example.com",
    }
    response = client.post("/projects", json=project_data)
    return response.json()["id"]


def main():
    """Run tests and output results."""
    import sys

    # Run pytest with verbose output
    exit_code = pytest.main([__file__, "-v", "--tb=short", "-x"])
    sys.exit(exit_code)


if __name__ == "__main__":
    main()
