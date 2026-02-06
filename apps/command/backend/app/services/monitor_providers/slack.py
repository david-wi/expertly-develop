import logging
from datetime import datetime, timezone
from typing import Any, Optional

import httpx

from app.services.monitor_providers.base import MonitorAdapter, MonitorAdapterEvent

logger = logging.getLogger(__name__)


async def send_slack_message(access_token: str, channel_id: str, text: str, thread_ts: str | None = None) -> dict:
    """
    Send a message to a Slack channel via chat.postMessage.

    Args:
        access_token: OAuth access token with chat:write scope
        channel_id: Slack channel ID
        text: Message text
        thread_ts: Optional thread timestamp to reply in-thread

    Returns:
        Slack API response dict (includes 'ts' of the sent message)
    """
    async with httpx.AsyncClient() as client:
        headers = {"Authorization": f"Bearer {access_token}"}
        payload = {"channel": channel_id, "text": text}
        if thread_ts:
            payload["thread_ts"] = thread_ts

        response = await client.post(
            "https://slack.com/api/chat.postMessage",
            headers=headers,
            json=payload,
        )
        response.raise_for_status()
        result = response.json()

        if not result.get("ok"):
            raise Exception(f"Slack API error: {result.get('error', 'Unknown error')}")

        return result


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
        self.provider_user_id = connection_data.get("provider_user_id")

        # Parse config
        self.channel_ids: list[str] = provider_config.get("channel_ids", [])
        self.workspace_wide: bool = provider_config.get("workspace_wide", False)
        self.tagged_user_ids: list[str] = provider_config.get("tagged_user_ids", [])
        self.keywords: list[str] = provider_config.get("keywords", [])
        self.context_messages: int = provider_config.get("context_messages", 5)
        self.my_mentions: bool = provider_config.get("my_mentions", False)

        # Cache for resolved Slack user IDs -> display names
        self._user_name_cache: dict[str, str] = {}

    async def _resolve_user_name(self, user_id: Optional[str]) -> Optional[str]:
        """Resolve a Slack user ID to a display name via users.info API."""
        if not user_id:
            return None
        if user_id in self._user_name_cache:
            return self._user_name_cache[user_id]
        try:
            result = await self._slack_request("users.info", {"user": user_id})
            user = result.get("user", {})
            profile = user.get("profile", {})
            name = (
                profile.get("display_name")
                or profile.get("real_name")
                or user.get("real_name")
                or user.get("name")
            )
            if name:
                self._user_name_cache[user_id] = name
            return name
        except Exception as e:
            logger.warning(f"Failed to resolve Slack user {user_id}: {e}")
            return None

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

    async def poll(
        self,
        cursor: Optional[dict] = None,
        oldest: Optional[str] = None,
        latest: Optional[str] = None,
    ) -> tuple[list[MonitorAdapterEvent], Optional[dict]]:
        """
        Poll Slack for new messages.

        For my_mentions mode: Uses search.messages API for efficiency (single API call).
        For other modes: Uses conversations.history to fetch messages since the last poll.

        Args:
            cursor: Previous poll state
            oldest: Optional ISO date string for start of date range (backfill)
            latest: Optional ISO date string for end of date range (backfill)
        """
        events: list[MonitorAdapterEvent] = []
        new_cursor: dict = cursor.copy() if cursor else {}

        # Use efficient search API for @mentions mode
        if self.my_mentions:
            return await self._poll_via_search(cursor, oldest=oldest, latest=latest)

        # Get channels to poll
        channels_to_poll = await self._get_channels_to_poll()
        if not channels_to_poll:
            logger.warning("No channels to poll")
            return events, new_cursor

        for channel_id in channels_to_poll:
            try:
                channel_events, channel_cursor = await self._poll_channel(
                    channel_id,
                    cursor.get(channel_id) if cursor else None,
                    oldest=oldest,
                    latest=latest,
                )
                events.extend(channel_events)
                if channel_cursor:
                    new_cursor[channel_id] = channel_cursor
            except Exception as e:
                logger.error(f"Error polling channel {channel_id}: {e}")

        return events, new_cursor if new_cursor else None

    async def _poll_via_search(
        self,
        cursor: Optional[dict] = None,
        oldest: Optional[str] = None,
        latest: Optional[str] = None,
    ) -> tuple[list[MonitorAdapterEvent], Optional[dict]]:
        """
        Poll for @mentions using Slack's search.messages API.

        Much more efficient than scanning all channels - single API call
        searches the entire workspace for messages mentioning the user.
        """
        events: list[MonitorAdapterEvent] = []

        if not self.provider_user_id:
            logger.warning("my_mentions enabled but no provider_user_id available")
            return events, cursor

        # Get the last seen timestamp from cursor
        last_seen_ts = cursor.get("last_seen_ts") if cursor else None

        try:
            # Search for messages mentioning this user
            query = f"<@{self.provider_user_id}>"

            # Append date filters for backfill
            if oldest:
                query += f" after:{self._to_slack_date(oldest)}"
            if latest:
                query += f" before:{self._to_slack_date(latest)}"

            result = await self._slack_request("search.messages", {
                "query": query,
                "sort": "timestamp",
                "sort_dir": "desc",
                "count": 50
            })

            messages = result.get("messages", {}).get("matches", [])
            if not messages:
                return events, cursor

            newest_ts = None

            for message in messages:
                msg_ts = message.get("ts", "0")

                # Track newest for cursor
                if newest_ts is None or msg_ts > newest_ts:
                    newest_ts = msg_ts

                # Skip messages we've already seen
                if last_seen_ts and msg_ts <= last_seen_ts:
                    continue

                # Skip bot messages
                if message.get("subtype") == "bot_message":
                    continue

                channel_id = message.get("channel", {}).get("id")
                if not channel_id:
                    continue

                # Fetch context if configured
                context_data = None
                if self.context_messages > 0:
                    context_data = await self._fetch_message_context(
                        channel_id,
                        msg_ts,
                        message.get("thread_ts")
                    )

                # Get permalink from search result or fetch it
                permalink = message.get("permalink")
                if not permalink:
                    permalink = await self._get_message_permalink(channel_id, msg_ts)

                # Resolve sender to display name
                sender_id = message.get("user") or message.get("username")
                sender_name = message.get("username") or await self._resolve_user_name(sender_id)

                event = MonitorAdapterEvent(
                    provider_event_id=f"{channel_id}:{msg_ts}",
                    event_type="mention",
                    event_data={
                        "channel_id": channel_id,
                        "channel_name": message.get("channel", {}).get("name"),
                        "message": message,
                        "text": message.get("text", ""),
                        "user": sender_id,
                        "user_name": sender_name,
                        "ts": msg_ts,
                        "thread_ts": message.get("thread_ts"),
                        "permalink": permalink,
                    },
                    context_data=context_data,
                    provider_timestamp=self._parse_slack_ts(msg_ts)
                )
                events.append(event)

            # Update cursor with newest timestamp
            new_cursor = {"last_seen_ts": newest_ts} if newest_ts else cursor
            return events, new_cursor

        except Exception as e:
            logger.error(f"Error searching for mentions: {e}")
            return events, cursor

    async def _get_channels_to_poll(self) -> list[str]:
        """Get list of channel IDs to poll."""
        if self.channel_ids:
            return self.channel_ids

        # my_mentions mode or workspace_wide both need to scan all channels
        if self.workspace_wide or self.my_mentions:
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
        oldest_ts: Optional[str] = None,
        oldest: Optional[str] = None,
        latest: Optional[str] = None,
    ) -> tuple[list[MonitorAdapterEvent], Optional[str]]:
        """Poll a single channel for new messages."""
        events: list[MonitorAdapterEvent] = []

        params: dict[str, Any] = {
            "channel": channel_id,
            "limit": 100,
        }
        # Use explicit date range if provided (backfill), else cursor
        if oldest:
            params["oldest"] = self._to_unix_ts(oldest)
        elif oldest_ts:
            params["oldest"] = oldest_ts
        if latest:
            params["latest"] = self._to_unix_ts(latest)

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

                # Fetch permalink for direct link back to Slack
                permalink = await self._get_message_permalink(channel_id, message.get("ts"))

                # Resolve sender to display name
                sender_id = message.get("user")
                sender_name = await self._resolve_user_name(sender_id)

                event = MonitorAdapterEvent(
                    provider_event_id=f"{channel_id}:{message.get('ts')}",
                    event_type="message",
                    event_data={
                        "channel_id": channel_id,
                        "message": message,
                        "text": message.get("text", ""),
                        "user": sender_id,
                        "user_name": sender_name,
                        "ts": message.get("ts"),
                        "thread_ts": message.get("thread_ts"),
                        "permalink": permalink,
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

        # Check for my_mentions mode - filter for messages mentioning the connected user
        if self.my_mentions:
            if not self.provider_user_id:
                logger.warning("my_mentions enabled but no provider_user_id available")
                return False
            if f"<@{self.provider_user_id}>" not in message.get("text", ""):
                return False
            # If my_mentions is enabled, we found a match - skip other filters
            return True

        # Check for tagged users
        if self.tagged_user_ids:
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

    async def _get_message_permalink(self, channel_id: str, message_ts: str) -> Optional[str]:
        """Fetch the permalink URL for a Slack message."""
        try:
            result = await self._slack_request("chat.getPermalink", {
                "channel": channel_id,
                "message_ts": message_ts
            })
            return result.get("permalink")
        except Exception as e:
            logger.warning(f"Failed to get message permalink: {e}")
            return None

    async def _fetch_message_context(
        self,
        channel_id: str,
        message_ts: str,
        thread_ts: Optional[str] = None
    ) -> Optional[dict]:
        """Fetch surrounding context for a message.

        For threaded messages: fetches ALL thread replies (up to 400) via pagination.
        For non-threaded messages: fetches surrounding channel messages using context_messages setting.
        """
        context: dict = {"before": [], "after": [], "thread": []}

        try:
            if thread_ts:
                # Paginate through ALL thread replies (up to 400 max)
                all_replies: list[dict] = []
                cursor_token: Optional[str] = None
                max_replies = 400

                while len(all_replies) < max_replies:
                    params: dict = {
                        "channel": channel_id,
                        "ts": thread_ts,
                        "limit": 200,
                    }
                    if cursor_token:
                        params["cursor"] = cursor_token

                    result = await self._slack_request("conversations.replies", params)
                    messages = result.get("messages", [])
                    all_replies.extend(messages)

                    # Check for more pages
                    response_metadata = result.get("response_metadata", {})
                    cursor_token = response_metadata.get("next_cursor")
                    if not cursor_token:
                        break

                context["thread"] = all_replies[:max_replies]
            else:
                # Get messages around this one (non-threaded)
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
    def _to_slack_date(iso_date: str) -> str:
        """Convert an ISO date string (YYYY-MM-DD or full ISO) to Slack search date YYYY-MM-DD."""
        return iso_date[:10]

    @staticmethod
    def _to_unix_ts(iso_date: str) -> str:
        """Convert an ISO date string to a Unix timestamp string for Slack API."""
        try:
            dt = datetime.fromisoformat(iso_date.replace("Z", "+00:00"))
        except ValueError:
            # Try as date-only
            dt = datetime.strptime(iso_date[:10], "%Y-%m-%d").replace(tzinfo=timezone.utc)
        return str(dt.timestamp())

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

        # Verify we have channels to poll or my_mentions mode enabled
        if not self.channel_ids and not self.workspace_wide and not self.my_mentions:
            return False, "Either channel_ids, workspace_wide, or my_mentions must be set"

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

            # Handle app_mention events (when someone @mentions the app or user)
            if event_type == "app_mention":
                channel_id = event.get("channel")
                context_data = None

                # Fetch context if configured
                if self.context_messages > 0:
                    context_data = await self._fetch_message_context(
                        channel_id,
                        event.get("ts"),
                        event.get("thread_ts")
                    )

                # Fetch permalink for direct link back to Slack
                permalink = await self._get_message_permalink(channel_id, event.get("ts"))

                # Resolve sender to display name
                sender_id = event.get("user")
                sender_name = await self._resolve_user_name(sender_id)

                adapter_event = MonitorAdapterEvent(
                    provider_event_id=f"{channel_id}:{event.get('ts')}",
                    event_type="app_mention",
                    event_data={
                        "channel_id": channel_id,
                        "message": event,
                        "text": event.get("text", ""),
                        "user": sender_id,
                        "user_name": sender_name,
                        "ts": event.get("ts"),
                        "thread_ts": event.get("thread_ts"),
                        "permalink": permalink,
                    },
                    context_data=context_data,
                    provider_timestamp=self._parse_slack_ts(event.get("ts"))
                )
                events.append(adapter_event)
                return events

            # Handle regular message events
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

                    # Fetch permalink for direct link back to Slack
                    permalink = await self._get_message_permalink(channel_id, event.get("ts"))

                    # Resolve sender to display name
                    sender_id = event.get("user")
                    sender_name = await self._resolve_user_name(sender_id)

                    adapter_event = MonitorAdapterEvent(
                        provider_event_id=f"{channel_id}:{event.get('ts')}",
                        event_type="message",
                        event_data={
                            "channel_id": channel_id,
                            "message": event,
                            "text": event.get("text", ""),
                            "user": sender_id,
                            "user_name": sender_name,
                            "ts": event.get("ts"),
                            "thread_ts": event.get("thread_ts"),
                            "permalink": permalink,
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
            "search:read",  # For efficient @mentions search
        ]
