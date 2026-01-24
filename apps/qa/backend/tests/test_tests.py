"""Test case endpoint tests."""
import pytest


class TestTestCaseEndpoints:
    """Tests for test case CRUD operations."""

    def test_create_test_case(self, client, sample_project):
        """Test creating a new test case."""
        response = client.post(
            f"/api/v1/projects/{sample_project['id']}/tests",
            json={
                "title": "Verify Homepage",
                "description": "Check homepage loads correctly",
                "priority": "high",
                "execution_type": "browser",
            },
        )
        assert response.status_code == 201
        data = response.json()
        assert data["title"] == "Verify Homepage"
        assert data["priority"] == "high"
        assert data["status"] == "draft"
        assert data["created_by"] == "human"

    def test_create_test_case_with_steps(self, client, sample_project):
        """Test creating a test case with automation steps."""
        response = client.post(
            f"/api/v1/projects/{sample_project['id']}/tests",
            json={
                "title": "Login Flow Test",
                "steps": [
                    {"action": "navigate", "value": "https://example.com"},
                    {"action": "click", "selector": "#login-button"},
                    {"action": "type", "selector": "#email", "value": "test@example.com"},
                ],
                "expected_results": "User is redirected to dashboard",
            },
        )
        assert response.status_code == 201
        data = response.json()
        assert len(data["steps"]) == 3
        assert data["steps"][0]["action"] == "navigate"

    def test_list_test_cases(self, client, sample_project, sample_test_case):
        """Test listing test cases for a project."""
        response = client.get(f"/api/v1/projects/{sample_project['id']}/tests")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert len(data) >= 1

    def test_filter_tests_by_status(self, client, sample_project, sample_test_case):
        """Test filtering test cases by status."""
        response = client.get(
            f"/api/v1/projects/{sample_project['id']}/tests?status=draft"
        )
        assert response.status_code == 200
        data = response.json()
        assert all(t["status"] == "draft" for t in data)

    def test_filter_tests_by_priority(self, client, sample_project, sample_test_case):
        """Test filtering test cases by priority."""
        response = client.get(
            f"/api/v1/projects/{sample_project['id']}/tests?priority=high"
        )
        assert response.status_code == 200
        data = response.json()
        assert all(t["priority"] == "high" for t in data)

    def test_get_test_case(self, client, sample_project, sample_test_case):
        """Test getting a specific test case."""
        response = client.get(
            f"/api/v1/projects/{sample_project['id']}/tests/{sample_test_case['id']}"
        )
        assert response.status_code == 200
        data = response.json()
        assert data["id"] == sample_test_case["id"]
        assert data["title"] == sample_test_case["title"]

    def test_update_test_case(self, client, sample_project, sample_test_case):
        """Test updating a test case."""
        response = client.patch(
            f"/api/v1/projects/{sample_project['id']}/tests/{sample_test_case['id']}",
            json={"title": "Updated Title", "priority": "critical"},
        )
        assert response.status_code == 200
        data = response.json()
        assert data["title"] == "Updated Title"
        assert data["priority"] == "critical"

    def test_approve_test_case(self, client, sample_project, sample_test_case):
        """Test approving a test case."""
        response = client.post(
            f"/api/v1/projects/{sample_project['id']}/tests/{sample_test_case['id']}/approve"
        )
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "approved"
        assert data["approved_at"] is not None

    def test_delete_test_case(self, client, sample_project, sample_test_case):
        """Test soft-deleting a test case."""
        response = client.delete(
            f"/api/v1/projects/{sample_project['id']}/tests/{sample_test_case['id']}"
        )
        assert response.status_code == 204

        # Verify it's archived
        response = client.get(
            f"/api/v1/projects/{sample_project['id']}/tests/{sample_test_case['id']}"
        )
        assert response.status_code == 404
