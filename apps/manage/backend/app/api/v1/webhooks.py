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


@router.post("/github")
async def github_webhook(request: Request):
    """
    Handle GitHub webhook notifications.

    Handles:
    - Push events
    - Pull request events
    - Issue events
    - And more based on monitor configuration
    """
    from app.services.monitor_providers.github import GitHubMonitorAdapter

    # Get the raw body for signature verification
    raw_body = await request.body()
    body = {}
    try:
        import json
        body = json.loads(raw_body)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid JSON payload")

    event_type = request.headers.get("X-GitHub-Event", "")
    delivery_id = request.headers.get("X-GitHub-Delivery", "")
    signature = request.headers.get("X-Hub-Signature-256", "")

    logger.info(f"Received GitHub webhook: event={event_type}, delivery={delivery_id}")

    # Find monitors that might handle this webhook
    # We need to verify signatures per-monitor since each has its own secret
    service = MonitorService()
    db = service.db

    # Get the repo from the payload
    repo_info = body.get("repository", {})
    repo_owner = repo_info.get("owner", {}).get("login", "")
    repo_name = repo_info.get("name", "")

    if not repo_owner or not repo_name:
        logger.warning("GitHub webhook missing repository info")
        return {"ok": True, "skipped": "no repository info"}

    # Find monitors for this repo
    cursor = db.monitors.find({
        "provider": MonitorProvider.GITHUB.value,
        "status": "active",
        "deleted_at": None,
        "provider_config.owner": repo_owner,
        "provider_config.repo": repo_name
    })

    processed_count = 0
    async for monitor in cursor:
        # Verify signature if webhook secret is configured
        webhook_secret = monitor.get("webhook_secret")
        if webhook_secret and signature:
            if not GitHubMonitorAdapter.verify_webhook_signature(
                raw_body, signature, webhook_secret
            ):
                logger.warning(f"Invalid signature for monitor {monitor['_id']}")
                continue

        # Get connection data for the adapter
        connection_data = await service.get_connection_data(
            monitor["connection_id"],
            monitor["organization_id"]
        )
        if not connection_data:
            logger.warning(f"No connection data for monitor {monitor['_id']}")
            continue

        # Create adapter and process webhook
        try:
            adapter = GitHubMonitorAdapter(
                connection_data,
                monitor.get("provider_config", {})
            )
            headers_dict = dict(request.headers)
            events = await adapter.handle_webhook(body, headers_dict)

            for event in events:
                try:
                    processed = await service.process_event(monitor, event)
                    if processed:
                        processed_count += 1
                except Exception as e:
                    logger.error(f"Error processing GitHub event: {e}")

        except Exception as e:
            logger.error(f"Error handling GitHub webhook for monitor {monitor['_id']}: {e}")

    logger.info(f"GitHub webhook processed: {processed_count} events")
    return {"ok": True, "events_processed": processed_count}


@router.get("/health")
async def webhooks_health():
    """Health check for webhook endpoints."""
    return {"status": "ok", "endpoints": ["slack", "google-drive", "teamwork", "github"]}
