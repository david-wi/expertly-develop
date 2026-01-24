"""Task API tests - including state machine transitions."""
import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_create_task(seeded_client: AsyncClient, auth_headers: dict):
    """Test creating a new task."""
    # Get a queue first
    queues_response = await seeded_client.get("/api/v1/queues", headers=auth_headers)
    queue_id = queues_response.json()[0].get("_id") or queues_response.json()[0].get("id")

    new_task = {
        "queue_id": queue_id,
        "title": "Test Task",
        "description": "A test task description",
        "priority": 5
    }
    response = await seeded_client.post(
        "/api/v1/tasks",
        json=new_task,
        headers=auth_headers
    )
    assert response.status_code == 201
    data = response.json()
    assert data["title"] == "Test Task"
    assert data["status"] == "queued"
    assert data["priority"] == 5


@pytest.mark.asyncio
async def test_list_tasks(seeded_client: AsyncClient, auth_headers: dict):
    """Test listing tasks."""
    # Create a task first
    queues_response = await seeded_client.get("/api/v1/queues", headers=auth_headers)
    queue_id = queues_response.json()[0].get("_id") or queues_response.json()[0].get("id")

    await seeded_client.post(
        "/api/v1/tasks",
        json={"queue_id": queue_id, "title": "List Test Task"},
        headers=auth_headers
    )

    response = await seeded_client.get("/api/v1/tasks", headers=auth_headers)
    assert response.status_code == 200
    data = response.json()
    assert len(data) >= 1


@pytest.mark.asyncio
async def test_list_tasks_filter_by_queue(seeded_client: AsyncClient, auth_headers: dict):
    """Test filtering tasks by queue."""
    queues_response = await seeded_client.get("/api/v1/queues", headers=auth_headers)
    queue_id = queues_response.json()[0].get("_id") or queues_response.json()[0].get("id")

    # Create a task in this queue
    await seeded_client.post(
        "/api/v1/tasks",
        json={"queue_id": queue_id, "title": "Queue Filter Test"},
        headers=auth_headers
    )

    response = await seeded_client.get(
        f"/api/v1/tasks?queue_id={queue_id}",
        headers=auth_headers
    )
    assert response.status_code == 200
    data = response.json()
    assert all(t["queue_id"] == queue_id for t in data)


@pytest.mark.asyncio
async def test_list_tasks_filter_by_status(seeded_client: AsyncClient, auth_headers: dict):
    """Test filtering tasks by status."""
    response = await seeded_client.get(
        "/api/v1/tasks?status=queued",
        headers=auth_headers
    )
    assert response.status_code == 200
    data = response.json()
    assert all(t["status"] == "queued" for t in data)


@pytest.mark.asyncio
async def test_get_task(seeded_client: AsyncClient, auth_headers: dict):
    """Test getting a specific task."""
    queues_response = await seeded_client.get("/api/v1/queues", headers=auth_headers)
    queue_id = queues_response.json()[0].get("_id") or queues_response.json()[0].get("id")

    create_response = await seeded_client.post(
        "/api/v1/tasks",
        json={"queue_id": queue_id, "title": "Get Task Test"},
        headers=auth_headers
    )
    task_id = create_response.json().get("_id") or create_response.json().get("id")

    response = await seeded_client.get(f"/api/v1/tasks/{task_id}", headers=auth_headers)
    assert response.status_code == 200
    data = response.json()
    assert data["title"] == "Get Task Test"


@pytest.mark.asyncio
async def test_update_task(seeded_client: AsyncClient, auth_headers: dict):
    """Test updating a task."""
    queues_response = await seeded_client.get("/api/v1/queues", headers=auth_headers)
    queue_id = queues_response.json()[0].get("_id") or queues_response.json()[0].get("id")

    create_response = await seeded_client.post(
        "/api/v1/tasks",
        json={"queue_id": queue_id, "title": "Update Test"},
        headers=auth_headers
    )
    task_id = create_response.json().get("_id") or create_response.json().get("id")

    response = await seeded_client.patch(
        f"/api/v1/tasks/{task_id}",
        json={"title": "Updated Title", "priority": 1},
        headers=auth_headers
    )
    assert response.status_code == 200
    data = response.json()
    assert data["title"] == "Updated Title"
    assert data["priority"] == 1


@pytest.mark.asyncio
async def test_task_checkout(seeded_client: AsyncClient, auth_headers: dict):
    """Test checking out a task."""
    queues_response = await seeded_client.get("/api/v1/queues", headers=auth_headers)
    queue_id = queues_response.json()[0].get("_id") or queues_response.json()[0].get("id")

    create_response = await seeded_client.post(
        "/api/v1/tasks",
        json={"queue_id": queue_id, "title": "Checkout Test"},
        headers=auth_headers
    )
    task_id = create_response.json().get("_id") or create_response.json().get("id")

    response = await seeded_client.post(
        f"/api/v1/tasks/{task_id}/checkout",
        headers=auth_headers
    )
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "checked_out"
    assert data.get("assigned_to_id") is not None


@pytest.mark.asyncio
async def test_task_start(seeded_client: AsyncClient, auth_headers: dict):
    """Test starting a checked out task."""
    queues_response = await seeded_client.get("/api/v1/queues", headers=auth_headers)
    queue_id = queues_response.json()[0].get("_id") or queues_response.json()[0].get("id")

    create_response = await seeded_client.post(
        "/api/v1/tasks",
        json={"queue_id": queue_id, "title": "Start Test"},
        headers=auth_headers
    )
    task_id = create_response.json().get("_id") or create_response.json().get("id")

    # First checkout
    await seeded_client.post(f"/api/v1/tasks/{task_id}/checkout", headers=auth_headers)

    # Then start
    response = await seeded_client.post(
        f"/api/v1/tasks/{task_id}/start",
        headers=auth_headers
    )
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "in_progress"


@pytest.mark.asyncio
async def test_task_complete(seeded_client: AsyncClient, auth_headers: dict):
    """Test completing a task."""
    queues_response = await seeded_client.get("/api/v1/queues", headers=auth_headers)
    queue_id = queues_response.json()[0].get("_id") or queues_response.json()[0].get("id")

    create_response = await seeded_client.post(
        "/api/v1/tasks",
        json={"queue_id": queue_id, "title": "Complete Test"},
        headers=auth_headers
    )
    task_id = create_response.json().get("_id") or create_response.json().get("id")

    # Checkout and start
    await seeded_client.post(f"/api/v1/tasks/{task_id}/checkout", headers=auth_headers)
    await seeded_client.post(f"/api/v1/tasks/{task_id}/start", headers=auth_headers)

    # Complete (output_data should be a dict or omitted)
    response = await seeded_client.post(
        f"/api/v1/tasks/{task_id}/complete",
        json={"output_data": {"message": "Task completed successfully"}},
        headers=auth_headers
    )
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "completed"


@pytest.mark.asyncio
async def test_task_fail(seeded_client: AsyncClient, auth_headers: dict):
    """Test failing a task."""
    queues_response = await seeded_client.get("/api/v1/queues", headers=auth_headers)
    queue_id = queues_response.json()[0].get("_id") or queues_response.json()[0].get("id")

    create_response = await seeded_client.post(
        "/api/v1/tasks",
        json={"queue_id": queue_id, "title": "Fail Test"},
        headers=auth_headers
    )
    task_id = create_response.json().get("_id") or create_response.json().get("id")

    # Checkout and start
    await seeded_client.post(f"/api/v1/tasks/{task_id}/checkout", headers=auth_headers)
    await seeded_client.post(f"/api/v1/tasks/{task_id}/start", headers=auth_headers)

    # Fail with retry=False to mark as failed (not retry to queued)
    response = await seeded_client.post(
        f"/api/v1/tasks/{task_id}/fail",
        json={"reason": "Something went wrong", "retry": False},
        headers=auth_headers
    )
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "failed"


@pytest.mark.asyncio
async def test_task_release(seeded_client: AsyncClient, auth_headers: dict):
    """Test releasing a checked out task."""
    queues_response = await seeded_client.get("/api/v1/queues", headers=auth_headers)
    queue_id = queues_response.json()[0].get("_id") or queues_response.json()[0].get("id")

    create_response = await seeded_client.post(
        "/api/v1/tasks",
        json={"queue_id": queue_id, "title": "Release Test"},
        headers=auth_headers
    )
    task_id = create_response.json().get("_id") or create_response.json().get("id")

    # Checkout
    await seeded_client.post(f"/api/v1/tasks/{task_id}/checkout", headers=auth_headers)

    # Release
    response = await seeded_client.post(
        f"/api/v1/tasks/{task_id}/release",
        headers=auth_headers
    )
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "queued"
    # checked_out_by_id should be cleared on release
    assert data.get("checked_out_by_id") is None


@pytest.mark.asyncio
async def test_invalid_state_transition(seeded_client: AsyncClient, auth_headers: dict):
    """Test that invalid state transitions are rejected."""
    queues_response = await seeded_client.get("/api/v1/queues", headers=auth_headers)
    queue_id = queues_response.json()[0].get("_id") or queues_response.json()[0].get("id")

    create_response = await seeded_client.post(
        "/api/v1/tasks",
        json={"queue_id": queue_id, "title": "Invalid Transition Test"},
        headers=auth_headers
    )
    task_id = create_response.json().get("_id") or create_response.json().get("id")

    # Try to start without checkout (should fail)
    response = await seeded_client.post(
        f"/api/v1/tasks/{task_id}/start",
        headers=auth_headers
    )
    assert response.status_code == 400


@pytest.mark.asyncio
async def test_full_task_lifecycle(seeded_client: AsyncClient, auth_headers: dict):
    """Test the complete task lifecycle: create -> checkout -> start -> complete."""
    # Get a queue
    queues_response = await seeded_client.get("/api/v1/queues", headers=auth_headers)
    queue_id = queues_response.json()[0].get("_id") or queues_response.json()[0].get("id")

    # Create
    create_response = await seeded_client.post(
        "/api/v1/tasks",
        json={
            "queue_id": queue_id,
            "title": "Full Lifecycle Test",
            "description": "Testing the complete workflow"
        },
        headers=auth_headers
    )
    assert create_response.status_code == 201
    task_id = create_response.json().get("_id") or create_response.json().get("id")
    assert create_response.json()["status"] == "queued"

    # Checkout
    checkout_response = await seeded_client.post(
        f"/api/v1/tasks/{task_id}/checkout",
        headers=auth_headers
    )
    assert checkout_response.status_code == 200
    assert checkout_response.json()["status"] == "checked_out"

    # Start
    start_response = await seeded_client.post(
        f"/api/v1/tasks/{task_id}/start",
        headers=auth_headers
    )
    assert start_response.status_code == 200
    assert start_response.json()["status"] == "in_progress"

    # Complete (output_data should be a dict)
    complete_response = await seeded_client.post(
        f"/api/v1/tasks/{task_id}/complete",
        json={"output_data": {"result": "All done!"}},
        headers=auth_headers
    )
    assert complete_response.status_code == 200
    assert complete_response.json()["status"] == "completed"
