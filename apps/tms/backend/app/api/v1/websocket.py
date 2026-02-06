"""WebSocket endpoint for real-time updates."""

import logging
import json
from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from app.services.websocket_manager import manager

logger = logging.getLogger(__name__)

router = APIRouter()


@router.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    """
    WebSocket endpoint for real-time TMS updates.

    Clients connect here to receive broadcast events for shipments,
    work items, tenders, and other entity changes.

    Supports ping/pong keepalive: send {"type": "ping"} to receive {"type": "pong"}.
    """
    await manager.connect(websocket)

    try:
        while True:
            # Wait for messages from client (keepalive pings)
            raw = await websocket.receive_text()

            try:
                message = json.loads(raw)
            except json.JSONDecodeError:
                continue

            msg_type = message.get("type")

            if msg_type == "ping":
                await websocket.send_text(json.dumps({"type": "pong"}))

    except WebSocketDisconnect:
        manager.disconnect(websocket)
    except Exception as e:
        logger.error("WebSocket error: %s", str(e))
        manager.disconnect(websocket)
