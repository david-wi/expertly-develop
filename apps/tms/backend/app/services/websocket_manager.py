"""WebSocket connection manager for real-time updates."""

import logging
import json
from datetime import datetime
from typing import Any
from fastapi import WebSocket

logger = logging.getLogger(__name__)


class ConnectionManager:
    """Manages active WebSocket connections and broadcasts events."""

    def __init__(self):
        self.active_connections: list[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        """Accept and track a new WebSocket connection."""
        await websocket.accept()
        self.active_connections.append(websocket)
        logger.info(
            "WebSocket connected. Total connections: %d",
            len(self.active_connections),
        )

    def disconnect(self, websocket: WebSocket):
        """Remove a WebSocket connection from tracking."""
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)
        logger.info(
            "WebSocket disconnected. Total connections: %d",
            len(self.active_connections),
        )

    async def broadcast(self, event_type: str, data: dict[str, Any] | None = None):
        """Broadcast an event to all connected clients."""
        message = json.dumps({
            "event": event_type,
            "data": data or {},
            "timestamp": datetime.utcnow().isoformat(),
        }, default=str)

        disconnected: list[WebSocket] = []
        for connection in self.active_connections:
            try:
                await connection.send_text(message)
            except Exception:
                logger.warning("Failed to send to WebSocket, marking for removal")
                disconnected.append(connection)

        # Clean up broken connections
        for conn in disconnected:
            self.disconnect(conn)

    async def send_to_connection(self, websocket: WebSocket, event_type: str, data: dict[str, Any] | None = None):
        """Send an event to a specific connection."""
        message = json.dumps({
            "event": event_type,
            "data": data or {},
            "timestamp": datetime.utcnow().isoformat(),
        }, default=str)

        try:
            await websocket.send_text(message)
        except Exception:
            logger.warning("Failed to send to specific WebSocket")
            self.disconnect(websocket)

    @property
    def connection_count(self) -> int:
        """Return the number of active connections."""
        return len(self.active_connections)


# Singleton instance used across the application
manager = ConnectionManager()
