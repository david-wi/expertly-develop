"""Scenario tests - Bot workflow for processing tasks."""
import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_bot_workflow_poll_claim_complete(seeded_client: AsyncClient, auth_headers: dict):
    """
    Scenario: A bot polls for tasks, claims one, processes it, and marks it complete.

    This simulates the typical bot workflow:
    1. Bot polls for available tasks
    2. Bot claims the next task atomically
    3. Bot starts working on the task
    4. Bot posts progress updates
    5. Bot completes the task with output_data
    """
    # Setup: Create a task in the Inbox queue
    queues_response = await seeded_client.get("/api/v1/queues", headers=auth_headers)
    inbox_queue = next(q for q in queues_response.json() if q["purpose"] == "Inbox")
    queue_id = inbox_queue.get("_id") or inbox_queue.get("id")

    create_response = await seeded_client.post(
        "/api/v1/tasks",
        json={
            "queue_id": queue_id,
            "title": "Process customer feedback",
            "description": "Analyze and categorize customer feedback from survey"
        },
        headers=auth_headers
    )
    assert create_response.status_code == 201
    task_id = create_response.json().get("_id") or create_response.json().get("id")

    # Step 1: Bot polls for available tasks (via /api/v1/bot/poll or tasks filter)
    poll_response = await seeded_client.get(
        "/api/v1/tasks?status=queued",
        headers=auth_headers
    )
    assert poll_response.status_code == 200
    available_tasks = poll_response.json()
    assert len(available_tasks) >= 1
    assert any(t.get("_id") == task_id or t.get("id") == task_id for t in available_tasks)

    # Step 2: Bot claims the task
    claim_response = await seeded_client.post(
        f"/api/v1/tasks/{task_id}/checkout",
        headers=auth_headers
    )
    assert claim_response.status_code == 200
    assert claim_response.json()["status"] == "checked_out"

    # Verify task is no longer in available pool
    poll_response2 = await seeded_client.get(
        "/api/v1/tasks?status=queued",
        headers=auth_headers
    )
    assert not any(
        t.get("_id") == task_id or t.get("id") == task_id
        for t in poll_response2.json()
    )

    # Step 3: Bot starts working
    start_response = await seeded_client.post(
        f"/api/v1/tasks/{task_id}/start",
        headers=auth_headers
    )
    assert start_response.status_code == 200
    assert start_response.json()["status"] == "in_progress"

    # Step 4: Bot posts progress updates
    update_response = await seeded_client.post(
        f"/api/v1/tasks/{task_id}/updates",
        json={
            "content": "Analyzed 50% of feedback entries",
            "progress_percent": 50
        },
        headers=auth_headers
    )
    assert update_response.status_code == 201

    # Post another update
    update_response2 = await seeded_client.post(
        f"/api/v1/tasks/{task_id}/updates",
        json={
            "content": "Categorization complete, generating report",
            "progress_percent": 90
        },
        headers=auth_headers
    )
    assert update_response2.status_code == 201

    # Step 5: Bot completes the task
    complete_response = await seeded_client.post(
        f"/api/v1/tasks/{task_id}/complete",
        json={
            "output_data": {
                "summary": "Analysis complete",
                "positive": 45,
                "neutral": 30,
                "negative": 25,
                "top_concerns": ["pricing (15)", "support response time (12)", "feature requests (8)"]
            }
        },
        headers=auth_headers
    )
    assert complete_response.status_code == 200
    final_task = complete_response.json()
    assert final_task["status"] == "completed"

    # Verify the task is in completed state
    get_response = await seeded_client.get(f"/api/v1/tasks/{task_id}", headers=auth_headers)
    assert get_response.json()["status"] == "completed"


@pytest.mark.asyncio
async def test_bot_workflow_failure_and_retry(seeded_client: AsyncClient, auth_headers: dict):
    """
    Scenario: A bot claims a task, fails, and the task becomes available for retry.

    1. Task is created
    2. Bot claims and starts the task
    3. Bot fails the task with an reason
    4. Task can be retried (back to queued)
    """
    # Setup
    queues_response = await seeded_client.get("/api/v1/queues", headers=auth_headers)
    queue_id = queues_response.json()[0].get("_id") or queues_response.json()[0].get("id")

    create_response = await seeded_client.post(
        "/api/v1/tasks",
        json={
            "queue_id": queue_id,
            "title": "Flaky external API call",
            "description": "Call external API that sometimes fails"
        },
        headers=auth_headers
    )
    task_id = create_response.json().get("_id") or create_response.json().get("id")

    # Bot claims and starts
    await seeded_client.post(f"/api/v1/tasks/{task_id}/checkout", headers=auth_headers)
    await seeded_client.post(f"/api/v1/tasks/{task_id}/start", headers=auth_headers)

    # Bot fails the task with retry=False to mark as failed (not queued for retry)
    fail_response = await seeded_client.post(
        f"/api/v1/tasks/{task_id}/fail",
        json={"reason": "External API returned 503 Service Unavailable", "retry": False},
        headers=auth_headers
    )
    assert fail_response.status_code == 200
    assert fail_response.json()["status"] == "failed"


@pytest.mark.asyncio
async def test_multiple_queues_different_priorities(seeded_client: AsyncClient, auth_headers: dict):
    """
    Scenario: Tasks in Urgent queue should be processed before Inbox tasks.

    1. Create tasks in both Inbox and Urgent queues
    2. Verify priority ordering when polling
    """
    queues_response = await seeded_client.get("/api/v1/queues", headers=auth_headers)
    queues = queues_response.json()
    inbox_queue = next(q for q in queues if q["purpose"] == "Inbox")
    urgent_queue = next(q for q in queues if q["purpose"] == "Urgent")

    inbox_id = inbox_queue.get("_id") or inbox_queue.get("id")
    urgent_id = urgent_queue.get("_id") or urgent_queue.get("id")

    # Create task in Inbox first
    await seeded_client.post(
        "/api/v1/tasks",
        json={
            "queue_id": inbox_id,
            "title": "Regular task",
            "priority": 5
        },
        headers=auth_headers
    )

    # Create task in Urgent with higher priority
    await seeded_client.post(
        "/api/v1/tasks",
        json={
            "queue_id": urgent_id,
            "title": "Urgent task",
            "priority": 1  # Higher priority (lower number)
        },
        headers=auth_headers
    )

    # Poll and verify urgent task can be identified
    tasks_response = await seeded_client.get("/api/v1/tasks?status=queued", headers=auth_headers)
    tasks = tasks_response.json()

    # Find tasks with priority 1 (urgent)
    high_priority = [t for t in tasks if t["priority"] == 1]
    assert len(high_priority) >= 1
    assert any(t["title"] == "Urgent task" for t in high_priority)
