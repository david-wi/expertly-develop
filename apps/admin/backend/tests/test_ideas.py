"""Tests for Ideas API endpoints."""

import pytest
from httpx import AsyncClient


@pytest.fixture
def sample_idea_data():
    """Sample idea data for testing."""
    return {
        "product": "manage",
        "title": "Test Idea",
        "description": "A test idea description",
        "status": "new",
        "priority": "medium",
        "tags": ["test", "sample"],
    }


class TestIdeasAPI:
    """Test Ideas API endpoints."""

    @pytest.mark.asyncio
    async def test_list_products(self, client: AsyncClient):
        """Test listing valid products."""
        response = await client.get("/api/ideas/products")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert "admin" in data
        assert "manage" in data
        assert "define" in data

    @pytest.mark.asyncio
    async def test_create_idea(self, client: AsyncClient, sample_idea_data):
        """Test creating an idea."""
        response = await client.post("/api/ideas", json=sample_idea_data)
        assert response.status_code == 201
        data = response.json()
        assert data["title"] == sample_idea_data["title"]
        assert data["product"] == sample_idea_data["product"]
        assert data["description"] == sample_idea_data["description"]
        assert data["status"] == "new"
        assert data["priority"] == "medium"
        assert "id" in data
        assert "created_at" in data
        assert "updated_at" in data

    @pytest.mark.asyncio
    async def test_list_ideas(self, client: AsyncClient, sample_idea_data):
        """Test listing ideas."""
        # Create an idea first
        await client.post("/api/ideas", json=sample_idea_data)

        # List ideas
        response = await client.get("/api/ideas")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert len(data) >= 1
        assert data[0]["title"] == sample_idea_data["title"]

    @pytest.mark.asyncio
    async def test_list_ideas_filter_by_product(self, client: AsyncClient, sample_idea_data):
        """Test filtering ideas by product."""
        # Create ideas for different products
        await client.post("/api/ideas", json=sample_idea_data)
        await client.post("/api/ideas", json={**sample_idea_data, "product": "admin", "title": "Admin Idea"})

        # Filter by manage product
        response = await client.get("/api/ideas?product=manage")
        assert response.status_code == 200
        data = response.json()
        assert all(idea["product"] == "manage" for idea in data)

        # Filter by admin product
        response = await client.get("/api/ideas?product=admin")
        assert response.status_code == 200
        data = response.json()
        assert all(idea["product"] == "admin" for idea in data)

    @pytest.mark.asyncio
    async def test_list_ideas_filter_by_status(self, client: AsyncClient, sample_idea_data):
        """Test filtering ideas by status."""
        # Create idea with status=new
        await client.post("/api/ideas", json=sample_idea_data)

        # Filter by status
        response = await client.get("/api/ideas?status=new")
        assert response.status_code == 200
        data = response.json()
        assert all(idea["status"] == "new" for idea in data)

    @pytest.mark.asyncio
    async def test_get_idea(self, client: AsyncClient, sample_idea_data):
        """Test getting a single idea."""
        # Create an idea
        create_response = await client.post("/api/ideas", json=sample_idea_data)
        idea_id = create_response.json()["id"]

        # Get the idea
        response = await client.get(f"/api/ideas/{idea_id}")
        assert response.status_code == 200
        data = response.json()
        assert data["id"] == idea_id
        assert data["title"] == sample_idea_data["title"]

    @pytest.mark.asyncio
    async def test_get_idea_not_found(self, client: AsyncClient):
        """Test getting a non-existent idea."""
        response = await client.get("/api/ideas/00000000-0000-0000-0000-000000000000")
        assert response.status_code == 404

    @pytest.mark.asyncio
    async def test_update_idea(self, client: AsyncClient, sample_idea_data):
        """Test updating an idea."""
        # Create an idea
        create_response = await client.post("/api/ideas", json=sample_idea_data)
        idea_id = create_response.json()["id"]

        # Update the idea
        update_data = {"title": "Updated Title", "status": "in_progress"}
        response = await client.patch(f"/api/ideas/{idea_id}", json=update_data)
        assert response.status_code == 200
        data = response.json()
        assert data["title"] == "Updated Title"
        assert data["status"] == "in_progress"

    @pytest.mark.asyncio
    async def test_update_idea_not_found(self, client: AsyncClient):
        """Test updating a non-existent idea."""
        response = await client.patch(
            "/api/ideas/00000000-0000-0000-0000-000000000000",
            json={"title": "Updated"}
        )
        assert response.status_code == 404

    @pytest.mark.asyncio
    async def test_delete_idea(self, client: AsyncClient, sample_idea_data):
        """Test deleting an idea."""
        # Create an idea
        create_response = await client.post("/api/ideas", json=sample_idea_data)
        idea_id = create_response.json()["id"]

        # Delete the idea
        response = await client.delete(f"/api/ideas/{idea_id}")
        assert response.status_code == 204

        # Verify it's deleted
        get_response = await client.get(f"/api/ideas/{idea_id}")
        assert get_response.status_code == 404

    @pytest.mark.asyncio
    async def test_delete_idea_not_found(self, client: AsyncClient):
        """Test deleting a non-existent idea."""
        response = await client.delete("/api/ideas/00000000-0000-0000-0000-000000000000")
        assert response.status_code == 404

    @pytest.mark.asyncio
    async def test_archived_ideas_excluded_by_default(self, client: AsyncClient, sample_idea_data):
        """Test that archived ideas are excluded by default."""
        # Create an idea and archive it
        create_response = await client.post("/api/ideas", json=sample_idea_data)
        idea_id = create_response.json()["id"]
        await client.patch(f"/api/ideas/{idea_id}", json={"status": "archived"})

        # List ideas - should not include archived
        response = await client.get("/api/ideas")
        assert response.status_code == 200
        data = response.json()
        archived_ideas = [i for i in data if i["status"] == "archived"]
        assert len(archived_ideas) == 0

        # List with include_archived=true - should include archived
        response = await client.get("/api/ideas?include_archived=true")
        assert response.status_code == 200
        data = response.json()
        archived_ideas = [i for i in data if i["status"] == "archived"]
        assert len(archived_ideas) >= 1

    @pytest.mark.asyncio
    async def test_create_idea_minimal(self, client: AsyncClient):
        """Test creating an idea with minimal data."""
        minimal_data = {
            "product": "admin",
            "title": "Minimal Idea",
        }
        response = await client.post("/api/ideas", json=minimal_data)
        assert response.status_code == 201
        data = response.json()
        assert data["title"] == "Minimal Idea"
        assert data["product"] == "admin"
        assert data["status"] == "new"  # Default
        assert data["priority"] == "medium"  # Default
