"""Queue API tests."""
import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_list_queues(seeded_client: AsyncClient, auth_headers: dict):
    """Test listing all queues."""
    response = await seeded_client.get("/api/v1/queues", headers=auth_headers)
    assert response.status_code == 200
    data = response.json()
    # Should have system queues from seeding
    assert len(data) >= 3
    purposes = [q["purpose"] for q in data]
    assert "Inbox" in purposes
    assert "Urgent" in purposes
    assert "Follow-up" in purposes


@pytest.mark.asyncio
async def test_list_system_queues_only(seeded_client: AsyncClient, auth_headers: dict):
    """Test filtering to include only system queues."""
    response = await seeded_client.get(
        "/api/v1/queues?include_system=true",
        headers=auth_headers
    )
    assert response.status_code == 200
    data = response.json()
    system_queues = [q for q in data if q["is_system"]]
    assert len(system_queues) >= 3


@pytest.mark.asyncio
async def test_create_queue(seeded_client: AsyncClient, auth_headers: dict):
    """Test creating a new queue."""
    new_queue = {
        "purpose": "Marketing Approvals",
        "description": "Queue for marketing content approvals",
        "scope_type": "organization",
        "priority_default": 5,
        "allow_bots": True
    }
    response = await seeded_client.post(
        "/api/v1/queues",
        json=new_queue,
        headers=auth_headers
    )
    assert response.status_code == 201
    data = response.json()
    assert data["purpose"] == "Marketing Approvals"
    assert data["scope_type"] == "organization"
    assert data["is_system"] == False


@pytest.mark.asyncio
async def test_create_user_scoped_queue(seeded_client: AsyncClient, auth_headers: dict):
    """Test creating a user-scoped queue."""
    # First get current user to get their ID
    user_response = await seeded_client.get("/api/v1/users/me", headers=auth_headers)
    user_id = user_response.json().get("id") or user_response.json().get("_id")

    new_queue = {
        "purpose": "My Personal Tasks",
        "scope_type": "user",
        "scope_id": user_id
    }
    response = await seeded_client.post(
        "/api/v1/queues",
        json=new_queue,
        headers=auth_headers
    )
    assert response.status_code == 201
    data = response.json()
    assert data["scope_type"] == "user"
    assert data["scope_id"] == user_id


@pytest.mark.asyncio
async def test_get_queue(seeded_client: AsyncClient, auth_headers: dict):
    """Test getting a specific queue by ID."""
    # First list queues to get an ID
    list_response = await seeded_client.get("/api/v1/queues", headers=auth_headers)
    queues = list_response.json()
    queue_id = queues[0].get("_id") or queues[0].get("id")

    response = await seeded_client.get(f"/api/v1/queues/{queue_id}", headers=auth_headers)
    assert response.status_code == 200
    data = response.json()
    assert data["purpose"] == queues[0]["purpose"]


@pytest.mark.asyncio
async def test_update_queue(seeded_client: AsyncClient, auth_headers: dict):
    """Test updating a queue."""
    # Create a queue first
    create_response = await seeded_client.post(
        "/api/v1/queues",
        json={"purpose": "Test Queue", "scope_type": "organization"},
        headers=auth_headers
    )
    queue_id = create_response.json().get("_id") or create_response.json().get("id")

    # Update it
    response = await seeded_client.patch(
        f"/api/v1/queues/{queue_id}",
        json={"purpose": "Updated Queue", "priority_default": 3},
        headers=auth_headers
    )
    assert response.status_code == 200
    data = response.json()
    assert data["purpose"] == "Updated Queue"
    assert data["priority_default"] == 3


@pytest.mark.asyncio
async def test_cannot_update_system_queue(seeded_client: AsyncClient, auth_headers: dict):
    """Test that system queues cannot be modified."""
    # Get a system queue
    list_response = await seeded_client.get("/api/v1/queues", headers=auth_headers)
    system_queue = next(q for q in list_response.json() if q["is_system"])
    queue_id = system_queue.get("_id") or system_queue.get("id")

    # Try to update it
    response = await seeded_client.patch(
        f"/api/v1/queues/{queue_id}",
        json={"purpose": "Hacked Queue"},
        headers=auth_headers
    )
    assert response.status_code == 400
    assert "system" in response.json()["detail"].lower()


@pytest.mark.asyncio
async def test_delete_queue(seeded_client: AsyncClient, auth_headers: dict):
    """Test deleting a queue."""
    # Create a queue first
    create_response = await seeded_client.post(
        "/api/v1/queues",
        json={"purpose": "To Delete", "scope_type": "organization"},
        headers=auth_headers
    )
    queue_id = create_response.json().get("_id") or create_response.json().get("id")

    # Delete it
    response = await seeded_client.delete(f"/api/v1/queues/{queue_id}", headers=auth_headers)
    assert response.status_code == 204

    # Verify it's gone
    get_response = await seeded_client.get(f"/api/v1/queues/{queue_id}", headers=auth_headers)
    assert get_response.status_code == 404


@pytest.mark.asyncio
async def test_cannot_delete_system_queue(seeded_client: AsyncClient, auth_headers: dict):
    """Test that system queues cannot be deleted."""
    list_response = await seeded_client.get("/api/v1/queues", headers=auth_headers)
    system_queue = next(q for q in list_response.json() if q["is_system"])
    queue_id = system_queue.get("_id") or system_queue.get("id")

    response = await seeded_client.delete(f"/api/v1/queues/{queue_id}", headers=auth_headers)
    assert response.status_code == 400
    assert "system" in response.json()["detail"].lower()


@pytest.mark.asyncio
async def test_queue_stats(seeded_client: AsyncClient, auth_headers: dict):
    """Test getting queue statistics."""
    response = await seeded_client.get("/api/v1/queues/stats", headers=auth_headers)
    assert response.status_code == 200
    data = response.json()
    # Should have stats for all queues
    assert len(data) >= 3
    # Each stat should have task counts
    for stat in data:
        assert "total_tasks" in stat or stat.get("queued") is not None
        assert "purpose" in stat
