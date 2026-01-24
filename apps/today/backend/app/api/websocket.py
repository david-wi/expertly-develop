"""WebSocket endpoints for real-time updates."""

from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query
from typing import Dict, Set
import json
import asyncio

router = APIRouter()

# Connection manager
class ConnectionManager:
    """Manages WebSocket connections per tenant."""

    def __init__(self):
        # tenant_id -> set of websocket connections
        self.active_connections: Dict[str, Set[WebSocket]] = {}

    async def connect(self, websocket: WebSocket, tenant_id: str):
        """Accept and track a new connection."""
        await websocket.accept()
        if tenant_id not in self.active_connections:
            self.active_connections[tenant_id] = set()
        self.active_connections[tenant_id].add(websocket)

    def disconnect(self, websocket: WebSocket, tenant_id: str):
        """Remove a connection."""
        if tenant_id in self.active_connections:
            self.active_connections[tenant_id].discard(websocket)
            if not self.active_connections[tenant_id]:
                del self.active_connections[tenant_id]

    async def broadcast_to_tenant(self, tenant_id: str, message: dict):
        """Send a message to all connections for a tenant."""
        if tenant_id not in self.active_connections:
            return

        disconnected = []
        for connection in self.active_connections[tenant_id]:
            try:
                await connection.send_json(message)
            except Exception:
                disconnected.append(connection)

        # Clean up disconnected connections
        for conn in disconnected:
            self.active_connections[tenant_id].discard(conn)


manager = ConnectionManager()


@router.websocket("/ws/{tenant_id}")
async def websocket_endpoint(
    websocket: WebSocket,
    tenant_id: str,
    api_key: str = Query(...),
):
    """
    WebSocket endpoint for real-time updates.

    Connect with: ws://host/ws/{tenant_id}?api_key=YOUR_KEY

    Messages are JSON with format:
    {
        "type": "task.updated" | "question.created" | etc,
        "data": { ... entity data ... }
    }
    """
    # TODO: Validate API key against tenant
    # For now, just accept the connection

    await manager.connect(websocket, tenant_id)

    try:
        while True:
            # Keep connection alive, receive any client messages
            data = await websocket.receive_text()

            # Client can send ping messages
            if data == "ping":
                await websocket.send_text("pong")

    except WebSocketDisconnect:
        manager.disconnect(websocket, tenant_id)


# Helper function to broadcast events
async def broadcast_event(tenant_id: str, event_type: str, data: dict):
    """Broadcast an event to all connected clients for a tenant."""
    message = {
        "type": event_type,
        "data": data,
    }
    await manager.broadcast_to_tenant(str(tenant_id), message)


# Event types
class EventTypes:
    """Standard event types for WebSocket messages."""

    TASK_CREATED = "task.created"
    TASK_UPDATED = "task.updated"
    TASK_STARTED = "task.started"
    TASK_COMPLETED = "task.completed"
    TASK_BLOCKED = "task.blocked"

    QUESTION_CREATED = "question.created"
    QUESTION_ANSWERED = "question.answered"
    QUESTION_DISMISSED = "question.dismissed"

    DRAFT_CREATED = "draft.created"
    DRAFT_UPDATED = "draft.updated"

    KNOWLEDGE_CAPTURED = "knowledge.captured"

    PLAYBOOK_MATCHED = "playbook.matched"
