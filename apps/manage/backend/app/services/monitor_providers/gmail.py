"""
Gmail monitor adapter for watching email events.
"""
import base64
import logging
from datetime import datetime, timezone
from typing import Any, Optional

import httpx

from app.services.monitor_providers.base import MonitorAdapter, MonitorAdapterEvent

logger = logging.getLogger(__name__)


class GmailMonitorAdapter(MonitorAdapter):
    """
    Monitor adapter for Gmail events.

    Supports:
    - Polling via Gmail API messages.list and messages.get
    - Filtering by folder/label, sender, subject keywords
    - Unread-only filtering
    """

    GMAIL_API_BASE = "https://gmail.googleapis.com/gmail/v1"

    def __init__(self, connection_data: dict, provider_config: dict):
        super().__init__(connection_data, provider_config)
        self.access_token = connection_data.get("access_token")

        # Parse config - matches GmailConfig model
        self.folders: list[str] = provider_config.get("folders", ["INBOX"])
        self.from_addresses: list[str] = provider_config.get("from_addresses", [])
        self.subject_contains: list[str] = provider_config.get("subject_contains", [])
        self.unread_only: bool = provider_config.get("unread_only", True)

    async def _gmail_request(
        self,
        endpoint: str,
        params: dict | None = None
    ) -> dict:
        """Make a request to the Gmail API."""
        async with httpx.AsyncClient() as client:
            headers = {"Authorization": f"Bearer {self.access_token}"}
            url = f"{self.GMAIL_API_BASE}/users/me/{endpoint}"

            response = await client.get(url, headers=headers, params=params or {}, timeout=30.0)
            response.raise_for_status()
            return response.json()

    def _build_search_query(self) -> str:
        """
        Build Gmail search query from config.

        Gmail query syntax:
        - in:inbox, in:label_name for folders
        - is:unread for unread only
        - from:address for sender filtering
        - subject:keyword for subject filtering
        """
        query_parts = []

        # Add folder/label filters
        if self.folders:
            folder_queries = []
            for folder in self.folders:
                # Gmail uses "in:" for standard folders and labels
                folder_lower = folder.lower()
                if folder_lower in ("inbox", "sent", "drafts", "spam", "trash", "starred"):
                    folder_queries.append(f"in:{folder_lower}")
                else:
                    # Custom labels
                    folder_queries.append(f"label:{folder}")
            if folder_queries:
                if len(folder_queries) == 1:
                    query_parts.append(folder_queries[0])
                else:
                    # OR together multiple folders
                    query_parts.append(f"({' OR '.join(folder_queries)})")

        # Add unread filter
        if self.unread_only:
            query_parts.append("is:unread")

        # Add from address filters (OR together)
        if self.from_addresses:
            from_queries = [f"from:{addr}" for addr in self.from_addresses]
            if len(from_queries) == 1:
                query_parts.append(from_queries[0])
            else:
                query_parts.append(f"({' OR '.join(from_queries)})")

        # Add subject filters (OR together)
        if self.subject_contains:
            subject_queries = [f"subject:{kw}" for kw in self.subject_contains]
            if len(subject_queries) == 1:
                query_parts.append(subject_queries[0])
            else:
                query_parts.append(f"({' OR '.join(subject_queries)})")

        return " ".join(query_parts)

    def _parse_email_headers(self, headers: list[dict]) -> dict[str, str]:
        """Extract common headers from Gmail message headers list."""
        result = {}
        header_names = ["Subject", "From", "To", "Date", "Message-ID"]
        for header in headers:
            name = header.get("name", "")
            if name in header_names:
                result[name.lower()] = header.get("value", "")
        return result

    def _parse_from_header(self, from_header: str) -> dict[str, str]:
        """Parse From header into email and name components."""
        # Format: "Name <email@domain.com>" or just "email@domain.com"
        if "<" in from_header and ">" in from_header:
            name = from_header.split("<")[0].strip().strip('"')
            email = from_header.split("<")[1].split(">")[0].strip()
        else:
            email = from_header.strip()
            name = ""
        return {"email": email, "name": name}

    async def poll(
        self, cursor: Optional[dict] = None
    ) -> tuple[list[MonitorAdapterEvent], Optional[dict]]:
        """
        Poll Gmail for new messages.

        Uses messages.list() with query filters, then messages.get() for details.

        Cursor format:
        {
            "last_history_id": "12345",
            "processed_ids": ["msg1", "msg2", ...]
        }
        """
        events: list[MonitorAdapterEvent] = []
        new_cursor: dict = cursor.copy() if cursor else {"processed_ids": []}

        # Build search query
        query = self._build_search_query()
        logger.debug(f"Gmail search query: {query}")

        try:
            # Get message list
            params: dict[str, Any] = {"maxResults": 50}
            if query:
                params["q"] = query

            result = await self._gmail_request("messages", params)
            messages = result.get("messages", [])

            if not messages:
                logger.debug("No matching Gmail messages found")
                return events, new_cursor

            # Track processed IDs (keep last 500 to avoid memory bloat)
            processed_ids = set(new_cursor.get("processed_ids", []))

            for msg_ref in messages:
                msg_id = msg_ref.get("id")
                if not msg_id:
                    continue

                # Skip already processed messages
                if msg_id in processed_ids:
                    continue

                try:
                    # Fetch full message details
                    msg_data = await self._gmail_request(
                        f"messages/{msg_id}",
                        {"format": "metadata", "metadataHeaders": ["Subject", "From", "To", "Date"]}
                    )

                    # Parse headers
                    headers = self._parse_email_headers(msg_data.get("payload", {}).get("headers", []))
                    from_info = self._parse_from_header(headers.get("from", ""))

                    # Build event data
                    event_data = {
                        "message_id": msg_id,
                        "thread_id": msg_data.get("threadId"),
                        "subject": headers.get("subject", "(No subject)"),
                        "from": from_info,
                        "to": [addr.strip() for addr in headers.get("to", "").split(",") if addr.strip()],
                        "date": headers.get("date", ""),
                        "snippet": msg_data.get("snippet", ""),
                        "labels": msg_data.get("labelIds", []),
                        "permalink": f"https://mail.google.com/mail/u/0/#inbox/{msg_id}",
                    }

                    # Parse timestamp from internal date (milliseconds since epoch)
                    timestamp = None
                    internal_date = msg_data.get("internalDate")
                    if internal_date:
                        try:
                            timestamp = datetime.fromtimestamp(int(internal_date) / 1000, tz=timezone.utc)
                        except (ValueError, TypeError):
                            pass

                    event = MonitorAdapterEvent(
                        provider_event_id=msg_id,
                        event_type="email",
                        event_data=event_data,
                        provider_timestamp=timestamp
                    )
                    events.append(event)

                    # Mark as processed
                    processed_ids.add(msg_id)

                except Exception as e:
                    logger.error(f"Error fetching Gmail message {msg_id}: {e}")
                    continue

            # Update cursor with processed IDs (keep last 500)
            new_cursor["processed_ids"] = list(processed_ids)[-500:]

            # Store history ID for potential future optimization
            if result.get("historyId"):
                new_cursor["last_history_id"] = result["historyId"]

        except httpx.HTTPStatusError as e:
            if e.response.status_code == 401:
                logger.error("Gmail API authentication failed - token may be expired")
            else:
                logger.error(f"Gmail API error: {e.response.status_code} - {e.response.text}")
            raise
        except Exception as e:
            logger.error(f"Error polling Gmail: {e}")
            raise

        return events, new_cursor

    async def validate_config(self) -> tuple[bool, Optional[str]]:
        """
        Validate the Gmail configuration.

        Checks that we can access the Gmail API with the current token.
        """
        if not self.access_token:
            return False, "No access token available"

        try:
            # Try to get the user's email profile
            result = await self._gmail_request("profile")
            email = result.get("emailAddress")
            if email:
                logger.info(f"Gmail config validated for {email}")
                return True, None
            return False, "Could not retrieve Gmail profile"

        except httpx.HTTPStatusError as e:
            if e.response.status_code == 401:
                return False, "Gmail access token is invalid or expired"
            elif e.response.status_code == 403:
                return False, "Gmail API access denied - check OAuth scopes"
            return False, f"Gmail API error: {e.response.status_code}"
        except Exception as e:
            return False, f"Failed to validate Gmail config: {str(e)}"

    @staticmethod
    def get_required_scopes() -> list[str]:
        """Get required OAuth scopes for Gmail monitoring."""
        return ["https://www.googleapis.com/auth/gmail.readonly"]
