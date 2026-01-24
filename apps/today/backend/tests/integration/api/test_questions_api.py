"""Integration tests for Questions API."""

import pytest
from uuid import uuid4


class TestQuestionsAPI:
    """Integration tests for /api/questions endpoints."""

    @pytest.mark.asyncio
    async def test_create_question(self, client):
        """POST /api/questions creates a question."""
        response = await client.post(
            "/api/questions",
            json={
                "text": "What should I do?",
                "context": "I'm stuck",
                "why_asking": "Need clarification",
                "what_claude_will_do": "Proceed with the answer",
                "priority": 1,
            },
        )

        assert response.status_code == 201
        data = response.json()
        assert data["text"] == "What should I do?"
        assert data["status"] == "unanswered"
        assert data["priority"] == 1

    @pytest.mark.asyncio
    async def test_list_questions(self, client):
        """GET /api/questions lists questions."""
        # Create some questions
        await client.post("/api/questions", json={"text": "Question 1", "priority": 3})
        await client.post("/api/questions", json={"text": "Question 2", "priority": 1})
        await client.post("/api/questions", json={"text": "Question 3", "priority": 2})

        response = await client.get("/api/questions")

        assert response.status_code == 200
        data = response.json()
        assert len(data) == 3

        # Should be sorted by priority (highest priority = lowest number first)
        assert data[0]["priority"] == 1
        assert data[1]["priority"] == 2
        assert data[2]["priority"] == 3

    @pytest.mark.asyncio
    async def test_get_unanswered_questions(self, client):
        """GET /api/questions/unanswered returns only unanswered questions."""
        # Create questions
        response = await client.post(
            "/api/questions",
            json={"text": "Unanswered Question"},
        )
        unanswered_id = response.json()["id"]

        response = await client.post(
            "/api/questions",
            json={"text": "Will Be Answered"},
        )
        to_answer_id = response.json()["id"]

        # Answer one
        await client.put(
            f"/api/questions/{to_answer_id}/answer",
            json={"answer": "Here's the answer"},
        )

        # Get unanswered
        response = await client.get("/api/questions/unanswered")

        assert response.status_code == 200
        data = response.json()
        assert len(data) == 1
        assert data[0]["id"] == unanswered_id

    @pytest.mark.asyncio
    async def test_get_question(self, client):
        """GET /api/questions/{id} returns a question."""
        response = await client.post(
            "/api/questions",
            json={"text": "Get Me"},
        )
        question_id = response.json()["id"]

        response = await client.get(f"/api/questions/{question_id}")

        assert response.status_code == 200
        assert response.json()["text"] == "Get Me"

    @pytest.mark.asyncio
    async def test_get_question_not_found(self, client):
        """GET /api/questions/{id} returns 404 for unknown question."""
        response = await client.get(f"/api/questions/{uuid4()}")
        assert response.status_code == 404

    @pytest.mark.asyncio
    async def test_answer_question(self, client):
        """PUT /api/questions/{id}/answer answers a question."""
        response = await client.post(
            "/api/questions",
            json={"text": "Answer Me"},
        )
        question_id = response.json()["id"]

        response = await client.put(
            f"/api/questions/{question_id}/answer",
            json={"answer": "Here is your answer"},
        )

        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "answered"
        assert data["answer"] == "Here is your answer"
        assert data["answered_at"] is not None

    @pytest.mark.asyncio
    async def test_answer_question_unblocks_task(self, client):
        """Answering a question unblocks related tasks."""
        # Create a task
        response = await client.post("/api/tasks", json={"title": "Blocked Task"})
        task_id = response.json()["id"]

        # Start the task
        await client.post(f"/api/tasks/{task_id}/start")

        # Block it with a question
        response = await client.post(
            f"/api/tasks/{task_id}/block",
            json={"question_text": "What should I do?"},
        )
        question_id = response.json()["question"]["id"]

        # Verify task is blocked
        response = await client.get(f"/api/tasks/{task_id}")
        assert response.json()["status"] == "blocked"

        # Answer the question
        response = await client.put(
            f"/api/questions/{question_id}/answer",
            json={"answer": "Do this!"},
        )

        assert response.status_code == 200
        data = response.json()
        assert task_id in [str(tid) for tid in data["unblocked_task_ids"]] or \
               str(task_id) in [str(tid) for tid in data.get("unblocked_task_ids", [])]

        # Verify task is unblocked
        response = await client.get(f"/api/tasks/{task_id}")
        assert response.json()["status"] == "queued"

    @pytest.mark.asyncio
    async def test_dismiss_question(self, client):
        """PUT /api/questions/{id}/dismiss dismisses a question."""
        response = await client.post(
            "/api/questions",
            json={"text": "Dismiss Me"},
        )
        question_id = response.json()["id"]

        response = await client.put(
            f"/api/questions/{question_id}/dismiss",
            json={"reason": "No longer relevant"},
        )

        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "dismissed"

    @pytest.mark.asyncio
    async def test_cannot_answer_already_answered(self, client):
        """Cannot answer an already answered question."""
        response = await client.post(
            "/api/questions",
            json={"text": "Answer Twice"},
        )
        question_id = response.json()["id"]

        # Answer once
        await client.put(
            f"/api/questions/{question_id}/answer",
            json={"answer": "First answer"},
        )

        # Try to answer again
        response = await client.put(
            f"/api/questions/{question_id}/answer",
            json={"answer": "Second answer"},
        )

        assert response.status_code == 400
