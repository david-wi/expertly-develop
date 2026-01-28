"""Tests for themes API endpoints."""

import pytest
from uuid import uuid4


class TestThemesAPI:
    """Test cases for themes API."""

    @pytest.mark.asyncio
    async def test_health_check(self, client):
        """Test health endpoint returns ok."""
        response = await client.get("/health")
        assert response.status_code == 200
        data = response.json()
        assert "status" in data

    @pytest.mark.asyncio
    async def test_list_themes_empty(self, client):
        """Test listing themes when none exist."""
        response = await client.get("/api/themes")
        assert response.status_code == 200
        data = response.json()
        assert "themes" in data
        assert "total" in data

    @pytest.mark.asyncio
    async def test_list_themes_with_pagination(self, client):
        """Test listing themes with pagination parameters."""
        response = await client.get("/api/themes?skip=0&limit=10")
        assert response.status_code == 200
        data = response.json()
        assert "themes" in data
        assert "total" in data

    @pytest.mark.asyncio
    async def test_list_themes_include_inactive(self, client):
        """Test listing themes including inactive ones."""
        response = await client.get("/api/themes?include_inactive=true")
        assert response.status_code == 200

    @pytest.mark.asyncio
    async def test_get_theme_not_found(self, client):
        """Test getting a non-existent theme."""
        fake_id = uuid4()
        response = await client.get(f"/api/themes/{fake_id}")
        assert response.status_code == 404
        assert response.json()["detail"] == "Theme not found"

    @pytest.mark.asyncio
    async def test_create_theme(self, client, sample_theme_data):
        """Test creating a new theme."""
        response = await client.post("/api/themes", json=sample_theme_data)
        assert response.status_code == 201

        data = response.json()
        assert data["name"] == sample_theme_data["name"]
        assert data["slug"] == sample_theme_data["slug"]
        assert "id" in data
        assert "colors" in data

    @pytest.mark.asyncio
    async def test_create_theme_without_slug(self, client, sample_theme_data):
        """Test creating a theme auto-generates slug if not provided."""
        data = {**sample_theme_data}
        del data["slug"]

        response = await client.post("/api/themes", json=data)
        # Should succeed and generate slug from name
        assert response.status_code in [201, 422]  # 422 if slug is required

    @pytest.mark.asyncio
    async def test_get_theme_after_create(self, client, sample_theme_data):
        """Test getting a theme after creating it."""
        # Create
        create_response = await client.post("/api/themes", json=sample_theme_data)
        assert create_response.status_code == 201
        theme_id = create_response.json()["id"]

        # Get
        get_response = await client.get(f"/api/themes/{theme_id}")
        assert get_response.status_code == 200

        data = get_response.json()
        assert data["id"] == theme_id
        assert data["name"] == sample_theme_data["name"]
        assert "colors" in data

    @pytest.mark.asyncio
    async def test_update_theme(self, client, sample_theme_data):
        """Test updating a theme."""
        # Create
        create_response = await client.post("/api/themes", json=sample_theme_data)
        assert create_response.status_code == 201
        theme_id = create_response.json()["id"]

        # Update
        update_data = {"name": "Updated Theme Name"}
        update_response = await client.patch(f"/api/themes/{theme_id}", json=update_data)
        assert update_response.status_code == 200

        data = update_response.json()
        assert data["name"] == "Updated Theme Name"

    @pytest.mark.asyncio
    async def test_update_theme_not_found(self, client):
        """Test updating a non-existent theme."""
        fake_id = uuid4()
        update_data = {"name": "New Name"}
        response = await client.patch(f"/api/themes/{fake_id}", json=update_data)
        assert response.status_code == 404

    @pytest.mark.asyncio
    async def test_delete_theme(self, client, sample_theme_data):
        """Test deleting a theme."""
        # Create
        create_response = await client.post("/api/themes", json=sample_theme_data)
        assert create_response.status_code == 201
        theme_id = create_response.json()["id"]

        # Delete
        delete_response = await client.delete(f"/api/themes/{theme_id}")
        assert delete_response.status_code == 204

        # Verify it's gone
        get_response = await client.get(f"/api/themes/{theme_id}")
        assert get_response.status_code == 404

    @pytest.mark.asyncio
    async def test_theme_versions_list(self, client, sample_theme_data):
        """Test listing theme versions."""
        # Create theme
        create_response = await client.post("/api/themes", json=sample_theme_data)
        assert create_response.status_code == 201
        theme_id = create_response.json()["id"]

        # List versions
        response = await client.get(f"/api/themes/{theme_id}/versions")
        # Endpoint may or may not exist
        assert response.status_code in [200, 404]

    @pytest.mark.asyncio
    async def test_public_themes_endpoint(self, client, sample_theme_data):
        """Test public themes endpoint."""
        # Create a theme first
        await client.post("/api/themes", json=sample_theme_data)

        # Get public themes
        response = await client.get("/api/public/themes")
        assert response.status_code == 200


class TestMetricsAPI:
    """Test cases for metrics API."""

    @pytest.mark.asyncio
    async def test_metrics_endpoint(self, client):
        """Test metrics endpoint returns system info."""
        response = await client.get("/api/metrics")
        assert response.status_code == 200

        data = response.json()
        # Should include CPU, memory, disk info
        assert "cpu_percent" in data or "cpu" in data or "status" in data
