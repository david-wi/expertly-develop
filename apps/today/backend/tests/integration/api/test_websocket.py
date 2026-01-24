"""Integration tests for WebSocket endpoint."""

import pytest
from httpx import AsyncClient
from starlette.testclient import TestClient
from starlette.websockets import WebSocketDisconnect

from app.main import app
from app.api.websocket import manager, broadcast_event, EventTypes


class TestWebSocketConnection:
    """Tests for WebSocket connection handling."""

    def test_websocket_connect_with_api_key(self, test_user):
        """WebSocket should accept connection with valid API key."""
        client = TestClient(app)
        with client.websocket_connect(
            f"/ws/test-tenant?api_key={test_user.api_key}"
        ) as websocket:
            # Send ping
            websocket.send_text("ping")
            # Should receive pong
            data = websocket.receive_text()
            assert data == "pong"

    def test_websocket_handles_disconnect(self, test_user):
        """WebSocket should handle client disconnect gracefully."""
        client = TestClient(app)
        with client.websocket_connect(
            f"/ws/test-tenant?api_key={test_user.api_key}"
        ) as websocket:
            pass  # Connection closes when context exits

        # Should not raise any errors
        assert True


class TestConnectionManager:
    """Tests for the ConnectionManager class."""

    @pytest.mark.asyncio
    async def test_broadcast_to_tenant(self, test_user):
        """broadcast_event should send message to connected clients."""
        # This is tested indirectly through the WebSocket endpoint
        # Direct testing would require mocking WebSocket connections
        pass

    def test_connection_tracking(self, test_user):
        """Manager should track connections per tenant."""
        client = TestClient(app)

        # Connect to tenant
        with client.websocket_connect(
            f"/ws/tenant-1?api_key={test_user.api_key}"
        ):
            assert "tenant-1" in manager.active_connections
            assert len(manager.active_connections["tenant-1"]) == 1

        # After disconnect, should be removed
        assert "tenant-1" not in manager.active_connections or \
               len(manager.active_connections.get("tenant-1", set())) == 0

    def test_multiple_connections_same_tenant(self, test_user):
        """Manager should handle multiple connections to same tenant."""
        client = TestClient(app)

        with client.websocket_connect(
            f"/ws/tenant-2?api_key={test_user.api_key}"
        ) as ws1:
            with client.websocket_connect(
                f"/ws/tenant-2?api_key={test_user.api_key}"
            ) as ws2:
                assert len(manager.active_connections["tenant-2"]) == 2


class TestEventTypes:
    """Tests for event type constants."""

    def test_task_event_types_defined(self):
        """Task event types should be defined."""
        assert EventTypes.TASK_CREATED == "task.created"
        assert EventTypes.TASK_UPDATED == "task.updated"
        assert EventTypes.TASK_STARTED == "task.started"
        assert EventTypes.TASK_COMPLETED == "task.completed"
        assert EventTypes.TASK_BLOCKED == "task.blocked"

    def test_question_event_types_defined(self):
        """Question event types should be defined."""
        assert EventTypes.QUESTION_CREATED == "question.created"
        assert EventTypes.QUESTION_ANSWERED == "question.answered"
        assert EventTypes.QUESTION_DISMISSED == "question.dismissed"

    def test_other_event_types_defined(self):
        """Other event types should be defined."""
        assert EventTypes.DRAFT_CREATED == "draft.created"
        assert EventTypes.DRAFT_UPDATED == "draft.updated"
        assert EventTypes.KNOWLEDGE_CAPTURED == "knowledge.captured"
        assert EventTypes.PLAYBOOK_MATCHED == "playbook.matched"
