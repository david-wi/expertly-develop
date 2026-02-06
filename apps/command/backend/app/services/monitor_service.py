"""
Monitor service for polling external services and triggering playbooks.
"""
import logging
from datetime import datetime, timezone
from typing import Optional

from bson import ObjectId

from app.database import get_database
from app.models import Monitor, MonitorEvent, MonitorProvider, MonitorStatus, TaskComment
from app.services.encryption import decrypt_token
from app.services.monitor_providers import (
    MonitorAdapter,
    MonitorAdapterEvent,
    SlackMonitorAdapter,
    GmailMonitorAdapter,
    OutlookMonitorAdapter,
)
from app.services.ai_service import get_slack_title_service

logger = logging.getLogger(__name__)


def get_adapter_for_provider(
    provider: MonitorProvider,
    connection_data: dict,
    provider_config: dict
) -> MonitorAdapter:
    """Get the appropriate adapter for a provider."""
    if provider == MonitorProvider.SLACK:
        return SlackMonitorAdapter(connection_data, provider_config)
    elif provider == MonitorProvider.GMAIL:
        return GmailMonitorAdapter(connection_data, provider_config)
    elif provider == MonitorProvider.OUTLOOK:
        return OutlookMonitorAdapter(connection_data, provider_config)
    # Add more providers as they're implemented
    # elif provider == MonitorProvider.GOOGLE_DRIVE:
    #     return GoogleDriveMonitorAdapter(connection_data, provider_config)
    raise ValueError(f"Unsupported provider: {provider}")


class MonitorService:
    """Service for managing monitors and processing events."""

    def __init__(self):
        self.db = get_database()

    async def get_connection_data(self, connection_id: ObjectId, organization_id: ObjectId) -> Optional[dict]:
        """Get and decrypt connection data for a monitor."""
        connection = await self.db.connections.find_one({
            "_id": connection_id,
            "organization_id": organization_id,
            "status": "active"
        })

        if not connection:
            return None

        # Decrypt tokens
        access_token = decrypt_token(connection.get("access_token_encrypted", ""))
        refresh_token = decrypt_token(connection.get("refresh_token_encrypted", "")) if connection.get("refresh_token_encrypted") else None

        return {
            "access_token": access_token,
            "refresh_token": refresh_token,
            "provider_user_id": connection.get("provider_user_id"),
            "provider_email": connection.get("provider_email"),
            "scopes": connection.get("scopes", []),
        }

    async def poll_monitor(
        self,
        monitor_id: str,
        organization_id: Optional[ObjectId] = None,
        oldest: Optional[str] = None,
        latest: Optional[str] = None,
        is_backfill: bool = False,
    ) -> dict:
        """
        Poll a single monitor for new events.

        Args:
            monitor_id: The monitor ID to poll
            organization_id: Optional org ID for security validation
            oldest: Optional start date for date-range poll (backfill)
            latest: Optional end date for date-range poll (backfill)
            is_backfill: If True, do NOT update poll_cursor (only update event counts)

        Returns:
            Dict with poll results: events_found, events_processed, error
        """
        result = {
            "events_found": 0,
            "events_processed": 0,
            "playbooks_triggered": 0,
            "error": None
        }

        # Get the monitor
        query = {"_id": ObjectId(monitor_id), "deleted_at": None}
        if organization_id:
            query["organization_id"] = organization_id

        monitor = await self.db.monitors.find_one(query)
        if not monitor:
            result["error"] = "Monitor not found"
            return result

        if monitor.get("status") != MonitorStatus.ACTIVE.value:
            result["error"] = f"Monitor is {monitor.get('status')}, not active"
            return result

        # Get connection data
        connection_data = await self.get_connection_data(
            monitor["connection_id"],
            monitor["organization_id"]
        )
        if not connection_data:
            await self._set_monitor_error(monitor["_id"], "Connection not found or expired")
            result["error"] = "Connection not found or expired"
            return result

        # Get adapter
        try:
            adapter = get_adapter_for_provider(
                MonitorProvider(monitor["provider"]),
                connection_data,
                monitor.get("provider_config", {})
            )
        except ValueError as e:
            result["error"] = str(e)
            return result

        # Poll for events
        try:
            events, new_cursor = await adapter.poll(
                monitor.get("poll_cursor"),
                oldest=oldest,
                latest=latest,
            )
            result["events_found"] = len(events)

            # Process each event
            for event in events:
                try:
                    processed = await self.process_event(monitor, event)
                    if processed:
                        result["events_processed"] += 1
                        result["playbooks_triggered"] += 1
                except Exception as e:
                    logger.error(f"Error processing event {event.provider_event_id}: {e}")

            # Update monitor state
            now = datetime.now(timezone.utc)
            update_data = {
                "last_polled_at": now,
                "last_error": None,
                "status": MonitorStatus.ACTIVE.value,
            }
            # For backfill, do NOT update poll_cursor (preserve normal cursor position)
            if not is_backfill:
                update_data["poll_cursor"] = new_cursor

            if events:
                update_data["last_event_at"] = now
                update_data["$inc"] = {
                    "events_detected": len(events),
                    "playbooks_triggered": result["playbooks_triggered"]
                }

            await self.db.monitors.update_one(
                {"_id": monitor["_id"]},
                {"$set": {k: v for k, v in update_data.items() if k != "$inc"}}
            )
            if "$inc" in update_data:
                await self.db.monitors.update_one(
                    {"_id": monitor["_id"]},
                    {"$inc": update_data["$inc"]}
                )

        except Exception as e:
            logger.error(f"Error polling monitor {monitor_id}: {e}")
            await self._set_monitor_error(monitor["_id"], str(e))
            result["error"] = str(e)

        return result

    async def process_event(self, monitor: dict, event: MonitorAdapterEvent) -> bool:
        """
        Process a single event from a monitor.

        Checks for duplicates, stores the event, and triggers the playbook.

        Returns:
            True if event was processed and playbook triggered, False if duplicate
        """
        # Check for duplicate
        existing = await self.db.monitor_events.find_one({
            "monitor_id": monitor["_id"],
            "provider_event_id": event.provider_event_id
        })
        if existing:
            logger.debug(f"Duplicate event {event.provider_event_id}, skipping")
            return False

        # Store the event
        monitor_event = MonitorEvent(
            organization_id=monitor["organization_id"],
            monitor_id=monitor["_id"],
            provider_event_id=event.provider_event_id,
            event_type=event.event_type,
            event_data=event.event_data,
            context_data=event.context_data,
            provider_timestamp=event.provider_timestamp,
            processed=False
        )
        await self.db.monitor_events.insert_one(monitor_event.model_dump_mongo())

        # Trigger the playbook
        task_id = await self.trigger_playbook(monitor, event)

        # Mark event as processed
        if task_id:
            await self.db.monitor_events.update_one(
                {"_id": monitor_event.id},
                {"$set": {
                    "processed": True,
                    "task_id": task_id
                }}
            )
            return True

        return False

    async def trigger_playbook(self, monitor: dict, event: MonitorAdapterEvent) -> Optional[ObjectId]:
        """
        Create a task based on a detected event, optionally triggering a playbook.

        Creates a task with the event data as input. If a playbook is configured,
        it will be associated with the task. If no playbook is configured, the task
        is created directly in the inbox.

        For Slack mentions, checks if the message is actionable before creating a task.

        Returns:
            The task ID if created, None otherwise
        """
        # For Slack mentions, check if the message is actionable
        provider = monitor.get("provider", "unknown")
        provider_config = monitor.get("provider_config", {})
        if provider == "slack" and provider_config.get("my_mentions"):
            try:
                slack_title_service = get_slack_title_service()
                message_text = event.event_data.get("text", "")
                context = None
                if event.context_data and event.context_data.get("thread"):
                    thread_messages = event.context_data["thread"][:5]
                    context = "\n".join([m.get("text", "")[:500] for m in thread_messages])

                is_actionable = await slack_title_service.is_actionable(message_text, context)
                if not is_actionable:
                    logger.info(f"Skipping non-actionable Slack message: {message_text[:80]}")
                    return None

                # Check if the mention has already been handled in the thread
                handled_context = None
                if event.context_data and event.context_data.get("thread"):
                    thread_messages = event.context_data["thread"][:20]
                    handled_context = "\n".join([m.get("text", "")[:500] for m in thread_messages])

                is_handled = await slack_title_service.is_already_handled(message_text, handled_context)
                if is_handled:
                    logger.info(f"Skipping already-handled Slack message: {message_text[:80]}")
                    return None
            except Exception as e:
                logger.warning(f"Actionability check failed, creating task anyway: {e}")

        playbook_id = monitor.get("playbook_id")
        playbook = None

        if playbook_id:
            # Get the playbook if configured
            playbook = await self.db.playbooks.find_one({"_id": playbook_id})
            if not playbook:
                logger.warning(f"Playbook {playbook_id} not found for monitor {monitor['_id']}, creating task without playbook")
                playbook_id = None

        # Determine which queue to use
        queue_id = monitor.get("queue_id")
        if not queue_id:
            # Get the user's default inbox queue
            user_queue = await self.db.queues.find_one({
                "organization_id": monitor["organization_id"],
                "is_system": True,
                "system_type": "inbox"
            })
            if user_queue:
                queue_id = user_queue["_id"]

        if not queue_id:
            logger.error(f"No queue found for monitor {monitor['_id']}")
            return None

        # Build input data from template and event
        input_data = {}
        if monitor.get("input_data_template"):
            input_data = monitor["input_data_template"].copy()

        # Add event data
        input_data["_monitor_event"] = {
            "event_id": event.provider_event_id,
            "event_type": event.event_type,
            "event_data": event.event_data,
            "context_data": event.context_data,
            "provider_timestamp": event.provider_timestamp.isoformat() if event.provider_timestamp else None
        }

        # Generate task title and description - use AI for Slack mentions
        task_title = await self._generate_ai_task_title(monitor, event)
        task_description = await self._generate_ai_task_description(monitor, event)

        # Extract source_url from event (e.g., Slack permalink)
        source_url = event.event_data.get("permalink")

        # Cross-monitor dedup: skip if a task with this source_url already exists
        if source_url:
            existing_task = await self.db.tasks.find_one({
                "organization_id": monitor["organization_id"],
                "source_url": source_url,
            })
            if existing_task:
                logger.info(f"Skipping duplicate: task already exists for {source_url}")
                return None

        # Create the task
        from app.models import Task, TaskStatus
        task = Task(
            organization_id=monitor["organization_id"],
            queue_id=queue_id,
            title=task_title,
            description=task_description,
            status=TaskStatus.QUEUED,
            priority=5,
            project_id=monitor.get("project_id"),
            input_data=input_data,
            source_monitor_id=monitor["_id"],
            source_playbook_id=playbook_id if playbook_id else None,
            source_url=source_url
        )

        # Check if Task model has the required fields, add them if we can
        task_dict = task.model_dump_mongo()
        task_dict["input_data"] = input_data
        task_dict["source_monitor_id"] = monitor["_id"]
        if playbook_id:
            task_dict["source_playbook_id"] = playbook_id
        task_dict["source_url"] = source_url

        result = await self.db.tasks.insert_one(task_dict)
        task_id = result.inserted_id
        logger.info(f"Created task {task_id} from monitor {monitor['_id']}")

        # Create initial context comment with conversation details
        await self._create_context_comment(task_id, monitor, event)

        return task_id

    def _extract_sender_name(self, monitor: dict, event: MonitorAdapterEvent) -> Optional[str]:
        """Extract sender display name from event data across all providers."""
        provider = monitor.get("provider", "unknown")
        if provider == "slack":
            return event.event_data.get("user_name") or event.event_data.get("user")
        elif provider in ("gmail", "outlook"):
            from_info = event.event_data.get("from", {})
            return from_info.get("name") or from_info.get("email")
        return None

    async def _generate_ai_task_title(self, monitor: dict, event: MonitorAdapterEvent) -> str:
        """Generate an AI-powered task title for Slack mentions, fallback to simple title."""
        provider = monitor.get("provider", "unknown")
        provider_config = monitor.get("provider_config", {})

        # Only use AI for Slack mentions (my_mentions mode)
        if provider == "slack" and provider_config.get("my_mentions"):
            try:
                slack_title_service = get_slack_title_service()
                message_text = event.event_data.get("text", "")
                sender = self._extract_sender_name(monitor, event)

                # Build context from thread if available
                context = None
                if event.context_data and event.context_data.get("thread"):
                    thread_messages = event.context_data["thread"][:5]
                    context = "\n".join([m.get("text", "")[:500] for m in thread_messages])

                return await slack_title_service.generate_title(message_text, context, sender=sender)
            except Exception as e:
                logger.warning(f"AI title generation failed: {e}")

        # Fallback to simple title generation
        return self._generate_task_title(monitor, event)

    async def _generate_ai_task_description(self, monitor: dict, event: MonitorAdapterEvent) -> str:
        """Generate an AI-powered task description for Slack mentions, fallback to simple description."""
        provider = monitor.get("provider", "unknown")
        provider_config = monitor.get("provider_config", {})

        # Only use AI for Slack mentions (my_mentions mode)
        if provider == "slack" and provider_config.get("my_mentions"):
            try:
                slack_title_service = get_slack_title_service()
                message_text = event.event_data.get("text", "")
                sender = self._extract_sender_name(monitor, event)

                # Build context from thread if available
                context = None
                if event.context_data and event.context_data.get("thread"):
                    thread_messages = event.context_data["thread"][:5]
                    context = "\n".join([m.get("text", "")[:500] for m in thread_messages])

                return await slack_title_service.generate_description(message_text, context, sender=sender)
            except Exception as e:
                logger.warning(f"AI description generation failed: {e}")

        # Fallback to simple description generation
        return self._generate_task_description(monitor, event)

    async def _create_context_comment(
        self,
        task_id: ObjectId,
        monitor: dict,
        event: MonitorAdapterEvent
    ) -> None:
        """Create an initial comment with conversation context."""
        provider = monitor.get("provider", "unknown")

        if provider != "slack":
            return  # Only create context comments for Slack for now

        # Build comment content
        lines = ["**Slack Conversation Context**", ""]

        # Main message
        message_text = event.event_data.get("text", "")
        timestamp = event.provider_timestamp
        if timestamp:
            lines.append(f"**Message** ({timestamp.strftime('%Y-%m-%d %H:%M UTC')}):")
        else:
            lines.append("**Message:**")
        lines.append(f"> {message_text}")
        lines.append("")

        # Thread context
        if event.context_data and event.context_data.get("thread"):
            thread_messages = event.context_data["thread"][:10]
            if len(thread_messages) > 1:
                lines.append("**Thread context:**")
                for msg in thread_messages:
                    msg_text = msg.get("text", "")[:300]
                    if len(msg.get("text", "")) > 300:
                        msg_text += "..."
                    lines.append(f"- {msg_text}")
                lines.append("")

        # Source link
        permalink = event.event_data.get("permalink")
        if permalink:
            lines.append(f"[View in Slack]({permalink})")

        content = "\n".join(lines)

        # Insert comment
        comment = TaskComment(
            organization_id=monitor["organization_id"],
            task_id=task_id,
            user_id="system",
            user_name="Slack Monitor",
            content=content
        )
        await self.db.task_comments.insert_one(comment.model_dump_mongo())

    def _generate_task_title(self, monitor: dict, event: MonitorAdapterEvent) -> str:
        """Generate a task title from the event."""
        provider = monitor.get("provider", "unknown")

        if provider == "slack":
            text = event.event_data.get("text", "")
            # Truncate long messages
            if len(text) > 50:
                text = text[:47] + "..."
            return f"[Slack] {text}" if text else "[Slack] New message"

        if provider == "gmail":
            subject = event.event_data.get("subject", "")
            if len(subject) > 50:
                subject = subject[:47] + "..."
            return f"[Gmail] {subject}" if subject else "[Gmail] New email"

        if provider == "outlook":
            subject = event.event_data.get("subject", "")
            if len(subject) > 50:
                subject = subject[:47] + "..."
            return f"[Outlook] {subject}" if subject else "[Outlook] New email"

        return f"[{monitor.get('name', 'Monitor')}] Event detected"

    def _generate_task_description(self, monitor: dict, event: MonitorAdapterEvent) -> str:
        """Generate a task description from the event (fallback when AI is unavailable)."""
        import re
        lines = []

        provider = monitor.get("provider")
        if provider == "slack":
            # Clean up Slack markup - replace <@USERID|Name> with just Name
            text = event.event_data.get("text", "")
            text = re.sub(r'<@[A-Z0-9]+\|([^>]+)>', r'\1', text)
            text = re.sub(r'<@[A-Z0-9]+>', '', text)
            text = text.strip()

            if text:
                lines.append(text)

            if event.context_data:
                if event.context_data.get("thread"):
                    lines.append("")
                    lines.append("**Thread context:**")
                    for msg in event.context_data["thread"][:5]:
                        msg_text = msg.get('text', '')[:100]
                        msg_text = re.sub(r'<@[A-Z0-9]+\|([^>]+)>', r'\1', msg_text)
                        msg_text = re.sub(r'<@[A-Z0-9]+>', '', msg_text)
                        lines.append(f"- {msg_text.strip()}")

        elif provider in ("gmail", "outlook"):
            from_info = event.event_data.get("from", {})
            from_email = from_info.get("email", "Unknown")
            from_name = from_info.get("name", "")
            from_display = f"{from_name} <{from_email}>" if from_name else from_email

            lines.append(f"**From:** {from_display}")
            lines.append(f"**Subject:** {event.event_data.get('subject', 'No subject')}")

            snippet = event.event_data.get("snippet", "")
            if snippet:
                lines.append("")
                lines.append("**Preview:**")
                lines.append(snippet[:500] + "..." if len(snippet) > 500 else snippet)

        return "\n".join(lines)

    async def poll_due_monitors(self, organization_id: Optional[ObjectId] = None) -> dict:
        """
        Poll all monitors that are due for polling.

        Args:
            organization_id: Optional filter by organization

        Returns:
            Dict with summary: monitors_polled, total_events, errors
        """
        result = {
            "monitors_polled": 0,
            "total_events": 0,
            "total_playbooks_triggered": 0,
            "errors": []
        }

        now = datetime.now(timezone.utc)

        # Find monitors due for polling
        query = {
            "status": MonitorStatus.ACTIVE.value,
            "deleted_at": None,
            "$or": [
                {"last_polled_at": None},
                {"$expr": {
                    "$lt": [
                        "$last_polled_at",
                        {"$subtract": [now, {"$multiply": ["$poll_interval_seconds", 1000]}]}
                    ]
                }}
            ]
        }
        if organization_id:
            query["organization_id"] = organization_id

        cursor = self.db.monitors.find(query)
        async for monitor in cursor:
            poll_result = await self.poll_monitor(str(monitor["_id"]))
            result["monitors_polled"] += 1
            result["total_events"] += poll_result.get("events_found", 0)
            result["total_playbooks_triggered"] += poll_result.get("playbooks_triggered", 0)
            if poll_result.get("error"):
                result["errors"].append({
                    "monitor_id": str(monitor["_id"]),
                    "error": poll_result["error"]
                })

        return result

    async def handle_webhook(
        self,
        provider: MonitorProvider,
        payload: dict,
        headers: dict,
        organization_id: Optional[ObjectId] = None
    ) -> dict:
        """
        Handle an incoming webhook from a provider.

        Args:
            provider: The provider type
            payload: The webhook payload
            headers: HTTP headers
            organization_id: Optional filter for monitors

        Returns:
            Dict with processing results
        """
        result = {
            "monitors_matched": 0,
            "events_processed": 0,
            "errors": []
        }

        # Find active monitors for this provider
        query = {
            "provider": provider.value,
            "status": MonitorStatus.ACTIVE.value,
            "deleted_at": None,
            "webhook_id": {"$ne": None}  # Only monitors expecting webhooks
        }
        if organization_id:
            query["organization_id"] = organization_id

        cursor = self.db.monitors.find(query)
        async for monitor in cursor:
            try:
                # Get connection data
                connection_data = await self.get_connection_data(
                    monitor["connection_id"],
                    monitor["organization_id"]
                )
                if not connection_data:
                    continue

                # Get adapter and process webhook
                adapter = get_adapter_for_provider(
                    provider,
                    connection_data,
                    monitor.get("provider_config", {})
                )

                events = await adapter.handle_webhook(payload, headers)
                result["monitors_matched"] += 1

                for event in events:
                    try:
                        processed = await self.process_event(monitor, event)
                        if processed:
                            result["events_processed"] += 1
                    except Exception as e:
                        logger.error(f"Error processing webhook event: {e}")
                        result["errors"].append(str(e))

            except Exception as e:
                logger.error(f"Error handling webhook for monitor {monitor['_id']}: {e}")
                result["errors"].append(str(e))

        return result

    async def handle_slack_webhook(self, payload: dict, headers: dict) -> dict:
        """
        Handle Slack Events API webhook.

        Unlike generic webhooks, Slack webhooks are configured at the app level,
        so we route to all active Slack monitors that have my_mentions enabled.

        Args:
            payload: The webhook payload from Slack
            headers: HTTP headers

        Returns:
            Dict with processing results
        """
        result = {
            "monitors_matched": 0,
            "events_processed": 0,
            "tasks_created": 0,
            "errors": []
        }

        event = payload.get("event", {})
        event_type = event.get("type")

        # Only process app_mention and message events
        if event_type not in ["app_mention", "message"]:
            logger.debug(f"Ignoring Slack event type: {event_type}")
            return result

        # Find all active Slack monitors with my_mentions enabled
        query = {
            "provider": MonitorProvider.SLACK.value,
            "status": MonitorStatus.ACTIVE.value,
            "deleted_at": None,
            "provider_config.my_mentions": True
        }

        cursor = self.db.monitors.find(query)
        async for monitor in cursor:
            try:
                # Get connection data
                connection_data = await self.get_connection_data(
                    monitor["connection_id"],
                    monitor["organization_id"]
                )
                if not connection_data:
                    logger.warning(f"No connection data for monitor {monitor['_id']}")
                    continue

                # For app_mention events, check if the mentioned user matches the connection's user
                if event_type == "app_mention":
                    # Get the user ID from the connection
                    connection_user_id = connection_data.get("provider_user_id")
                    if connection_user_id:
                        # Check if this mention is for this user
                        text = event.get("text", "")
                        if f"<@{connection_user_id}>" not in text:
                            # This mention is not for this user's connection
                            continue

                # Get adapter and process webhook
                adapter = get_adapter_for_provider(
                    MonitorProvider.SLACK,
                    connection_data,
                    monitor.get("provider_config", {})
                )

                events = await adapter.handle_webhook(payload, headers)
                result["monitors_matched"] += 1

                for event_item in events:
                    try:
                        processed = await self.process_event(monitor, event_item)
                        if processed:
                            result["events_processed"] += 1
                            result["tasks_created"] += 1
                    except Exception as e:
                        logger.error(f"Error processing Slack webhook event: {e}")
                        result["errors"].append(str(e))

            except Exception as e:
                logger.error(f"Error handling Slack webhook for monitor {monitor['_id']}: {e}")
                result["errors"].append(str(e))

        logger.info(f"Slack webhook processed: {result['monitors_matched']} monitors, {result['tasks_created']} tasks created")
        return result

    async def _set_monitor_error(self, monitor_id: ObjectId, error: str):
        """Set a monitor to error status."""
        await self.db.monitors.update_one(
            {"_id": monitor_id},
            {"$set": {
                "status": MonitorStatus.ERROR.value,
                "last_error": error,
                "updated_at": datetime.now(timezone.utc)
            }}
        )

    async def validate_monitor_config(
        self,
        provider: MonitorProvider,
        connection_id: ObjectId,
        provider_config: dict,
        organization_id: ObjectId
    ) -> tuple[bool, Optional[str]]:
        """
        Validate a monitor configuration before creating/updating.

        Returns:
            Tuple of (is_valid, error_message)
        """
        # Get connection
        connection_data = await self.get_connection_data(connection_id, organization_id)
        if not connection_data:
            return False, "Connection not found or expired"

        # Get adapter and validate
        try:
            adapter = get_adapter_for_provider(provider, connection_data, provider_config)
            return await adapter.validate_config()
        except ValueError as e:
            return False, str(e)
        except Exception as e:
            return False, f"Validation error: {str(e)}"
