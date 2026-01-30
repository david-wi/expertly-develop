import logging
from datetime import datetime, timezone
from typing import Any, Optional

import httpx

from app.services.monitor_providers.base import MonitorAdapter, MonitorAdapterEvent

logger = logging.getLogger(__name__)


class SlackMonitorAdapter(MonitorAdapter):
    """
    Slack monitor adapter for detecting messages and events.

    Supports:
    - Polling via conversations.history API
    - Filtering by channel, keywords, and tagged users
    - Context capture (surrounding messages)
    - Webhook support via Slack Events API
    """

    SLACK_API_BASE = "https://slack.com/api"

    def __init__(self, connection_data: dict, provider_config: dict):
        super().__init__(connection_data, provider_config)
        self.access_token = connection_data.get("access_token")

        # Parse config
        self.channel_ids: list[str] = provider_config.get("channel_ids", [])
        self.workspace_wide: bool = provider_config.get("workspace_wide", False)
        self.tagged_user_ids: list[str] = provider_config.get("tagged_user_ids", [])
        self.keywords: list[str] = provider_config.get("keywords", [])
        self.context_messages: int = provider_config.get("context_messages", 5)

    async def _slack_request(self, method: str, params: dict = None, data: dict = None) -> dict:
        """Make a request to the Slack API."""
        async with httpx.AsyncClient() as client:
            headers = {"Authorization": f"Bearer {self.access_token}"}
            url = f"{self.SLACK_API_BASE}/{method}"

            if data:
                response = await client.post(url, headers=headers, json=data)
            else:
                response = await client.get(url, headers=headers, params=params or {})

            response.raise_for_status()
            result = response.json()

            if not result.get("ok"):
                raise Exception(f"Slack API error: {result.get('error', 'Unknown error')}")

            return result

    async def poll(self, cursor: Optional[dict] = None) -> tuple[list[MonitorAdapterEvent], Optional[dict]]:
        """
        Poll Slack for new messages.

        Uses conversations.history to fetch messages since the last poll.
        Filters based on configured keywords, channels, and tagged users.
        """
        events: list[MonitorAdapterEvent] = []
        new_cursor: dict = cursor.copy() if cursor else {}

        # Get channels to poll
        channels_to_poll = await self._get_channels_to_poll()
        if not channels_to_poll:
            logger.warning("No channels to poll")
            return events, new_cursor

        for channel_id in channels_to_poll:
            try:
                channel_events, channel_cursor = await self._poll_channel(
                    channel_id,
                    cursor.get(channel_id) if cursor else None
                )
                events.extend(channel_events)
                if channel_cursor:
                    new_cursor[channel_id] = channel_cursor
            except Exception as e:
                logger.error(f"Error polling channel {channel_id}: {e}")

        return events, new_cursor if new_cursor else None

    async def _get_channels_to_poll(self) -> list[str]:
        """Get list of channel IDs to poll."""
        if self.channel_ids:
            return self.channel_ids

        if self.workspace_wide:
            try:
                result = await self._slack_request("conversations.list", {
                    "types": "public_channel,private_channel",
                    "exclude_archived": "true",
                    "limit": 200
                })
                return [c["id"] for c in result.get("channels", [])]
            except Exception as e:
                logger.error(f"Error fetching channel list: {e}")
                return []

        return []

    async def _poll_channel(
        self,
        channel_id: str,
        oldest_ts: Optional[str] = None
    ) -> tuple[list[MonitorAdapterEvent], Optional[str]]:
        """Poll a single channel for new messages."""
        events: list[MonitorAdapterEvent] = []

        params: dict[str, Any] = {
            "channel": channel_id,
            "limit": 100,
        }
        if oldest_ts:
            params["oldest"] = oldest_ts

        try:
            result = await self._slack_request("conversations.history", params)
        except Exception as e:
            logger.error(f"Error fetching history for channel {channel_id}: {e}")
            return events, oldest_ts

        messages = result.get("messages", [])
        if not messages:
            return events, oldest_ts

        # Get the newest message timestamp for cursor
        newest_ts = max(m.get("ts", "0") for m in messages)

        for message in messages:
            # Skip messages we've already seen
            if oldest_ts and message.get("ts", "0") <= oldest_ts:
                continue

            # Check if message matches our filters
            if self._message_matches_filters(message):
                # Fetch context if configured
                context_data = None
                if self.context_messages > 0:
                    context_data = await self._fetch_message_context(
                        channel_id,
                        message.get("ts"),
                        message.get("thread_ts")
                    )

                event = MonitorAdapterEvent(
                    provider_event_id=f"{channel_id}:{message.get('ts')}",
                    event_type="message",
                    event_data={
                        "channel_id": channel_id,
                        "message": message,
                        "text": message.get("text", ""),
                        "user": message.get("user"),
                        "ts": message.get("ts"),
                        "thread_ts": message.get("thread_ts"),
                    },
                    context_data=context_data,
                    provider_timestamp=self._parse_slack_ts(message.get("ts"))
                )
                events.append(event)

        return events, newest_ts

    def _message_matches_filters(self, message: dict) -> bool:
        """Check if a message matches the configured filters."""
        text = message.get("text", "").lower()

        # Skip bot messages and system messages
        if message.get("subtype") in ["bot_message", "channel_join", "channel_leave"]:
            return False

        # Check for tagged users
        if self.tagged_user_ids:
            mentions = [m for m in message.get("blocks", []) if m.get("type") == "rich_text"]
            user_mentioned = False
            for user_id in self.tagged_user_ids:
                if f"<@{user_id}>" in message.get("text", ""):
                    user_mentioned = True
                    break
            if not user_mentioned:
                return False

        # Check for keywords
        if self.keywords:
            keyword_found = any(kw.lower() in text for kw in self.keywords)
            if not keyword_found:
                return False

        return True

    async def _fetch_message_context(
        self,
        channel_id: str,
        message_ts: str,
        thread_ts: Optional[str] = None
    ) -> Optional[dict]:
        """Fetch surrounding context for a message."""
        context: dict = {"before": [], "after": [], "thread": []}

        try:
            # If in a thread, get thread replies
            if thread_ts:
                result = await self._slack_request("conversations.replies", {
                    "channel": channel_id,
                    "ts": thread_ts,
                    "limit": self.context_messages * 2
                })
                context["thread"] = result.get("messages", [])
            else:
                # Get messages around this one
                result = await self._slack_request("conversations.history", {
                    "channel": channel_id,
                    "latest": message_ts,
                    "inclusive": True,
                    "limit": self.context_messages + 1
                })
                messages = result.get("messages", [])
                if messages:
                    context["before"] = messages[1:] if len(messages) > 1 else []

                # Get messages after
                result = await self._slack_request("conversations.history", {
                    "channel": channel_id,
                    "oldest": message_ts,
                    "limit": self.context_messages
                })
                context["after"] = result.get("messages", [])

        except Exception as e:
            logger.error(f"Error fetching message context: {e}")

        return context

    @staticmethod
    def _parse_slack_ts(ts: Optional[str]) -> Optional[datetime]:
        """Parse Slack timestamp to datetime."""
        if not ts:
            return None
        try:
            # Slack timestamps are Unix timestamps with microseconds
            unix_ts = float(ts)
            return datetime.fromtimestamp(unix_ts, tz=timezone.utc)
        except (ValueError, TypeError):
            return None

    async def validate_config(self) -> tuple[bool, Optional[str]]:
        """Validate the Slack configuration."""
        if not self.access_token:
            return False, "No access token available"

        # Verify we can access the Slack API
        try:
            result = await self._slack_request("auth.test")
            if not result.get("ok"):
                return False, f"Slack API error: {result.get('error')}"
        except Exception as e:
            return False, f"Failed to connect to Slack: {str(e)}"

        # Verify we have channels to poll
        if not self.channel_ids and not self.workspace_wide:
            return False, "Either channel_ids or workspace_wide must be set"

        # Verify channel access if specific channels configured
        if self.channel_ids:
            for channel_id in self.channel_ids:
                try:
                    result = await self._slack_request("conversations.info", {
                        "channel": channel_id
                    })
                    if not result.get("ok"):
                        return False, f"Cannot access channel {channel_id}"
                except Exception as e:
                    return False, f"Cannot access channel {channel_id}: {str(e)}"

        return True, None

    async def setup_webhook(self, webhook_url: str) -> Optional[str]:
        """
        Set up Slack Events API webhook.

        Note: Slack Events API requires app-level configuration.
        This returns a placeholder ID since webhook setup is done through Slack App settings.
        """
        # Slack Events API webhooks are configured at the app level, not per-monitor
        # Return a placeholder to indicate webhook mode is desired
        return "slack_events_api"

    async def handle_webhook(self, payload: dict, headers: dict) -> list[MonitorAdapterEvent]:
        """Process incoming Slack Events API webhook."""
        events: list[MonitorAdapterEvent] = []

        # Handle URL verification challenge
        if payload.get("type") == "url_verification":
            # This is handled at the API route level
            return events

        # Handle event callbacks
        if payload.get("type") == "event_callback":
            event = payload.get("event", {})
            event_type = event.get("type")

            if event_type == "message":
                # Filter out subtypes we don't care about
                if event.get("subtype") in ["bot_message", "message_changed", "message_deleted"]:
                    return events

                # Check if message matches our filters
                message = {
                    "text": event.get("text", ""),
                    "user": event.get("user"),
                    "ts": event.get("ts"),
                    "thread_ts": event.get("thread_ts"),
                }

                if self._message_matches_filters(message):
                    channel_id = event.get("channel")
                    context_data = None

                    # Optionally fetch context
                    if self.context_messages > 0:
                        context_data = await self._fetch_message_context(
                            channel_id,
                            event.get("ts"),
                            event.get("thread_ts")
                        )

                    adapter_event = MonitorAdapterEvent(
                        provider_event_id=f"{channel_id}:{event.get('ts')}",
                        event_type="message",
                        event_data={
                            "channel_id": channel_id,
                            "message": event,
                            "text": event.get("text", ""),
                            "user": event.get("user"),
                            "ts": event.get("ts"),
                            "thread_ts": event.get("thread_ts"),
                        },
                        context_data=context_data,
                        provider_timestamp=self._parse_slack_ts(event.get("ts"))
                    )
                    events.append(adapter_event)

        return events

    @staticmethod
    def get_required_scopes() -> list[str]:
        """Get required Slack OAuth scopes."""
        return [
            "channels:history",
            "channels:read",
            "groups:history",
            "groups:read",
            "im:history",
            "im:read",
            "mpim:history",
            "mpim:read",
            "users:read",
        ]
