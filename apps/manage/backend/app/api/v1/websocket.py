import asyncio
import json
import logging
from datetime import datetime
from typing import Dict, Set
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query
from bson import ObjectId

from app.database import get_database
from app.utils.auth import get_user_by_api_key, get_default_user
from app.config import get_settings

logger = logging.getLogger(__name__)
router = APIRouter()


class ConnectionManager:
    """Manages WebSocket connections per organization."""

    def __init__(self):
        # org_id -> set of websockets
        self.connections: Dict[str, Set[WebSocket]] = {}
        self._lock = asyncio.Lock()

    async def connect(self, websocket: WebSocket, org_id: str):
        await websocket.accept()
        async with self._lock:
            if org_id not in self.connections:
                self.connections[org_id] = set()
            self.connections[org_id].add(websocket)
        logger.info(f"WebSocket connected for org {org_id}")

    async def disconnect(self, websocket: WebSocket, org_id: str):
        async with self._lock:
            if org_id in self.connections:
                self.connections[org_id].discard(websocket)
                if not self.connections[org_id]:
                    del self.connections[org_id]
        logger.info(f"WebSocket disconnected for org {org_id}")

    async def broadcast(self, org_id: str, message: dict):
        """Broadcast message to all connections in an organization."""
        if org_id not in self.connections:
            return

        message_json = json.dumps(message, default=str)
        dead_connections = set()

        for websocket in self.connections[org_id]:
            try:
                await websocket.send_text(message_json)
            except Exception as e:
                logger.warning(f"Failed to send message: {e}")
                dead_connections.add(websocket)

        # Clean up dead connections
        if dead_connections:
            async with self._lock:
                for ws in dead_connections:
                    self.connections[org_id].discard(ws)


manager = ConnectionManager()


async def emit_event(org_id: str, event_type: str, data: dict):
    """Emit an event to all WebSocket clients in an organization."""
    await manager.broadcast(org_id, {
        "type": event_type,
        "data": data,
        "timestamp": datetime.utcnow().isoformat()
    })


@router.websocket("/ws/{org_id}")
async def websocket_endpoint(
    websocket: WebSocket,
    org_id: str,
    api_key: str = Query(None)
):
    """
    WebSocket endpoint for real-time updates.

    Connect: ws://localhost:8000/ws/{org_id}?api_key=...

    Events:
    - task.created: New task created
    - task.updated: Task modified
    - task.progress: Task progress update
    - task.completed: Task completed
    - task.failed: Task failed
    - queue.updated: Queue stats changed
    """
    settings = get_settings()

    # Authenticate
    if settings.skip_auth:
        user = await get_default_user()
    elif api_key:
        user = await get_user_by_api_key(api_key)
    else:
        await websocket.close(code=4001, reason="API key required")
        return

    if not user:
        await websocket.close(code=4001, reason="Invalid API key")
        return

    # Verify org access
    if str(user.organization_id) != org_id:
        await websocket.close(code=4003, reason="Access denied to this organization")
        return

    await manager.connect(websocket, org_id)

    try:
        # Send connection confirmation
        await websocket.send_json({
            "type": "connected",
            "data": {"org_id": org_id, "user_id": str(user.id)},
            "timestamp": datetime.utcnow().isoformat()
        })

        # Keep connection alive and handle incoming messages
        while True:
            try:
                data = await asyncio.wait_for(
                    websocket.receive_text(),
                    timeout=30.0  # Ping every 30 seconds
                )
                # Handle client messages (e.g., ping)
                try:
                    message = json.loads(data)
                    if message.get("type") == "ping":
                        await websocket.send_json({
                            "type": "pong",
                            "timestamp": datetime.utcnow().isoformat()
                        })
                except json.JSONDecodeError:
                    pass
            except asyncio.TimeoutError:
                # Send ping to keep connection alive
                try:
                    await websocket.send_json({
                        "type": "ping",
                        "timestamp": datetime.utcnow().isoformat()
                    })
                except Exception:
                    break

    except WebSocketDisconnect:
        pass
    finally:
        await manager.disconnect(websocket, org_id)


# Helper to get manager for event emission
def get_connection_manager() -> ConnectionManager:
    return manager
