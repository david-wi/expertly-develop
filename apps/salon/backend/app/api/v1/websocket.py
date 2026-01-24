"""WebSocket endpoint for real-time calendar updates."""

from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query
from jose import JWTError, jwt

from ...config import settings
from ...services.websocket_manager import manager

router = APIRouter()


def verify_ws_token(token: str) -> dict | None:
    """Verify JWT token for WebSocket connection."""
    try:
        payload = jwt.decode(
            token,
            settings.jwt_secret_key,
            algorithms=[settings.jwt_algorithm]
        )
        if payload.get("type") != "access":
            return None
        return payload
    except JWTError:
        return None


@router.websocket("/ws")
async def websocket_endpoint(
    websocket: WebSocket,
    token: str = Query(...),
):
    """WebSocket endpoint for real-time calendar updates.

    Connect with: ws://host/api/v1/ws?token=<jwt_access_token>

    Messages sent to client:
    - appointment.created: New appointment created
    - appointment.updated: Appointment status changed
    - appointment.cancelled: Appointment cancelled
    - appointment.rescheduled: Appointment moved
    - calendar.refresh: Full calendar refresh needed
    """
    # Verify token
    payload = verify_ws_token(token)
    if not payload:
        await websocket.close(code=4001, reason="Invalid token")
        return

    salon_id = payload.get("salon_id")
    if not salon_id:
        await websocket.close(code=4002, reason="No salon ID in token")
        return

    await manager.connect(websocket, salon_id)

    try:
        while True:
            # Keep connection alive and handle any client messages
            data = await websocket.receive_text()

            # Handle ping/pong for connection keep-alive
            if data == "ping":
                await websocket.send_text("pong")

    except WebSocketDisconnect:
        manager.disconnect(websocket, salon_id)
    except Exception:
        manager.disconnect(websocket, salon_id)
