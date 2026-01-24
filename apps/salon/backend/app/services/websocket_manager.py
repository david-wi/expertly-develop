"""WebSocket connection manager for real-time updates."""

from typing import Dict, Set
from fastapi import WebSocket
import json


class ConnectionManager:
    """Manages WebSocket connections grouped by salon."""

    def __init__(self):
        # Map of salon_id -> set of WebSocket connections
        self.active_connections: Dict[str, Set[WebSocket]] = {}

    async def connect(self, websocket: WebSocket, salon_id: str) -> None:
        """Accept a new WebSocket connection."""
        await websocket.accept()
        if salon_id not in self.active_connections:
            self.active_connections[salon_id] = set()
        self.active_connections[salon_id].add(websocket)

    def disconnect(self, websocket: WebSocket, salon_id: str) -> None:
        """Remove a WebSocket connection."""
        if salon_id in self.active_connections:
            self.active_connections[salon_id].discard(websocket)
            if not self.active_connections[salon_id]:
                del self.active_connections[salon_id]

    async def send_personal_message(self, message: dict, websocket: WebSocket) -> None:
        """Send a message to a specific connection."""
        try:
            await websocket.send_json(message)
        except Exception:
            pass

    async def broadcast_to_salon(self, salon_id: str, message: dict) -> None:
        """Broadcast a message to all connections in a salon."""
        if salon_id not in self.active_connections:
            return

        disconnected = set()
        for connection in self.active_connections[salon_id]:
            try:
                await connection.send_json(message)
            except Exception:
                disconnected.add(connection)

        # Clean up disconnected connections
        for conn in disconnected:
            self.active_connections[salon_id].discard(conn)


# Global connection manager instance
manager = ConnectionManager()


# Event types for real-time updates
class EventType:
    APPOINTMENT_CREATED = "appointment.created"
    APPOINTMENT_UPDATED = "appointment.updated"
    APPOINTMENT_CANCELLED = "appointment.cancelled"
    APPOINTMENT_RESCHEDULED = "appointment.rescheduled"
    CALENDAR_REFRESH = "calendar.refresh"


async def broadcast_appointment_event(
    salon_id: str,
    event_type: str,
    appointment_data: dict,
) -> None:
    """Broadcast an appointment event to all connections in the salon."""
    await manager.broadcast_to_salon(
        str(salon_id),
        {
            "type": event_type,
            "data": appointment_data,
        },
    )
