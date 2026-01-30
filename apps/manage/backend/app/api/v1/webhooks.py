"""
Webhook endpoints for receiving real-time events from external providers.
"""
import logging
import hmac
import hashlib
from fastapi import APIRouter, Request, HTTPException
from fastapi.responses import JSONResponse

from app.config import get_settings
from app.models import MonitorProvider
from app.services.monitor_service import MonitorService

router = APIRouter()
logger = logging.getLogger(__name__)


@router.post("/slack")
async def slack_webhook(request: Request):
    """
    Handle Slack Events API webhooks.

    Handles:
    - URL verification challenge
    - Event callbacks (messages, etc.)
    """
    settings = get_settings()
    body = await request.json()

    # Handle URL verification challenge
    if body.get("type") == "url_verification":
        return {"challenge": body.get("challenge")}

    # Verify request signature if signing secret is configured
    slack_signing_secret = getattr(settings, "slack_signing_secret", None)
    if slack_signing_secret:
        timestamp = request.headers.get("X-Slack-Request-Timestamp", "")
        signature = request.headers.get("X-Slack-Signature", "")

        # Check timestamp to prevent replay attacks
        import time
        if abs(time.time() - int(timestamp)) > 60 * 5:
            raise HTTPException(status_code=400, detail="Request too old")

        # Verify signature
        raw_body = await request.body()
        sig_basestring = f"v0:{timestamp}:{raw_body.decode()}"
        my_signature = "v0=" + hmac.new(
            slack_signing_secret.encode(),
            sig_basestring.encode(),
            hashlib.sha256
        ).hexdigest()

        if not hmac.compare_digest(my_signature, signature):
            raise HTTPException(status_code=400, detail="Invalid signature")

    # Process event callback
    if body.get("type") == "event_callback":
        event = body.get("event", {})
        logger.info(f"Received Slack event: {event.get('type')}")

        try:
            service = MonitorService()
            headers = dict(request.headers)
            result = await service.handle_webhook(
                MonitorProvider.SLACK,
                body,
                headers
            )

            logger.info(f"Processed Slack webhook: {result}")
        except Exception as e:
            logger.error(f"Error processing Slack webhook: {e}")
            # Return 200 to prevent Slack from retrying
            # Errors are logged and can be investigated

    # Always return 200 to acknowledge receipt
    return {"ok": True}


@router.post("/google-drive")
async def google_drive_webhook(request: Request):
    """
    Handle Google Drive push notifications.

    Google Drive sends notifications when files/folders change.
    The notification just indicates that changes occurred - we need
    to poll the changes API to get details.
    """
    # Get notification headers
    channel_id = request.headers.get("X-Goog-Channel-Id")
    resource_id = request.headers.get("X-Goog-Resource-Id")
    resource_state = request.headers.get("X-Goog-Resource-State")

    logger.info(f"Google Drive notification: channel={channel_id}, state={resource_state}")

    # Ignore sync messages (sent when watch is set up)
    if resource_state == "sync":
        return {"ok": True}

    # For change notifications, trigger a poll of affected monitors
    if resource_state == "change":
        try:
            service = MonitorService()
            # Find monitors with this channel_id in their poll_cursor
            # and trigger a poll
            headers = dict(request.headers)
            body = {}
            try:
                body = await request.json()
            except Exception:
                pass

            result = await service.handle_webhook(
                MonitorProvider.GOOGLE_DRIVE,
                {
                    "channel_id": channel_id,
                    "resource_id": resource_id,
                    "resource_state": resource_state,
                    **body
                },
                headers
            )
            logger.info(f"Processed Google Drive webhook: {result}")
        except Exception as e:
            logger.error(f"Error processing Google Drive webhook: {e}")

    return {"ok": True}


@router.post("/teamwork")
async def teamwork_webhook(request: Request):
    """
    Handle Teamwork webhook notifications.

    Teamwork sends webhooks for various events like task creation,
    status changes, etc.
    """
    body = await request.json()
    logger.info(f"Received Teamwork webhook: {body.get('eventType')}")

    try:
        service = MonitorService()
        headers = dict(request.headers)
        result = await service.handle_webhook(
            MonitorProvider.TEAMWORK,
            body,
            headers
        )
        logger.info(f"Processed Teamwork webhook: {result}")
    except Exception as e:
        logger.error(f"Error processing Teamwork webhook: {e}")

    return {"ok": True}


@router.get("/health")
async def webhooks_health():
    """Health check for webhook endpoints."""
    return {"status": "ok", "endpoints": ["slack", "google-drive", "teamwork"]}
