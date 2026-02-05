"""
Outlook monitor adapter for watching email events via Microsoft Graph API.
"""
import logging
from datetime import datetime, timezone
from typing import Any, Optional
from urllib.parse import quote

import httpx

from app.services.monitor_providers.base import MonitorAdapter, MonitorAdapterEvent

logger = logging.getLogger(__name__)


class OutlookMonitorAdapter(MonitorAdapter):
    """
    Monitor adapter for Outlook/Microsoft 365 email events.

    Supports:
    - Polling via Microsoft Graph API
    - Filtering by folder, sender, subject keywords
    - Unread-only filtering
    """

    GRAPH_API_BASE = "https://graph.microsoft.com/v1.0"

    def __init__(self, connection_data: dict, provider_config: dict):
        super().__init__(connection_data, provider_config)
        self.access_token = connection_data.get("access_token")

        # Parse config - matches OutlookConfig model
        self.folders: list[str] = provider_config.get("folders", ["Inbox"])
        self.from_addresses: list[str] = provider_config.get("from_addresses", [])
        self.subject_contains: list[str] = provider_config.get("subject_contains", [])
        self.unread_only: bool = provider_config.get("unread_only", True)

    async def _graph_request(
        self,
        endpoint: str,
        params: dict | None = None
    ) -> dict:
        """Make a request to the Microsoft Graph API."""
        async with httpx.AsyncClient() as client:
            headers = {"Authorization": f"Bearer {self.access_token}"}
            url = f"{self.GRAPH_API_BASE}{endpoint}"

            response = await client.get(url, headers=headers, params=params or {}, timeout=30.0)
            response.raise_for_status()
            return response.json()

    def _build_odata_filter(self) -> str:
        """
        Build OData filter for Microsoft Graph API.

        OData filter syntax:
        - isRead eq false for unread
        - from/emailAddress/address eq 'email@domain.com' for sender
        - contains(subject, 'keyword') for subject search
        """
        filters = []

        # Unread filter
        if self.unread_only:
            filters.append("isRead eq false")

        # From address filters (OR together)
        if self.from_addresses:
            from_filters = [
                f"from/emailAddress/address eq '{addr}'" for addr in self.from_addresses
            ]
            if len(from_filters) == 1:
                filters.append(from_filters[0])
            else:
                filters.append(f"({' or '.join(from_filters)})")

        # Subject contains filters (OR together)
        if self.subject_contains:
            subject_filters = [
                f"contains(subject, '{kw}')" for kw in self.subject_contains
            ]
            if len(subject_filters) == 1:
                filters.append(subject_filters[0])
            else:
                filters.append(f"({' or '.join(subject_filters)})")

        return " and ".join(filters) if filters else ""

    def _get_folder_id(self, folder_name: str) -> str:
        """
        Get the folder ID or well-known name for a folder.

        Well-known folder names: inbox, drafts, sentitems, deleteditems, archive, junkemail
        """
        well_known = {
            "inbox": "inbox",
            "drafts": "drafts",
            "sent": "sentitems",
            "sentitems": "sentitems",
            "deleted": "deleteditems",
            "deleteditems": "deleteditems",
            "trash": "deleteditems",
            "archive": "archive",
            "junk": "junkemail",
            "junkemail": "junkemail",
            "spam": "junkemail",
        }
        return well_known.get(folder_name.lower(), folder_name)

    async def poll(
        self,
        cursor: Optional[dict] = None,
        oldest: Optional[str] = None,
        latest: Optional[str] = None,
    ) -> tuple[list[MonitorAdapterEvent], Optional[dict]]:
        """
        Poll Outlook for new messages.

        Uses /me/mailFolders/{folder}/messages with $filter and $orderby.

        Cursor format:
        {
            "last_received_datetime": "2024-01-15T10:30:00Z",
            "processed_ids": ["AAMk...", ...]
        }
        """
        events: list[MonitorAdapterEvent] = []
        new_cursor: dict = cursor.copy() if cursor else {"processed_ids": []}

        # Build OData filter
        odata_filter = self._build_odata_filter()
        logger.debug(f"Outlook OData filter: {odata_filter}")

        # Track processed IDs
        processed_ids = set(new_cursor.get("processed_ids", []))
        newest_received_datetime = new_cursor.get("last_received_datetime")

        try:
            # Poll each configured folder
            for folder_name in self.folders:
                folder_id = self._get_folder_id(folder_name)

                params: dict[str, Any] = {
                    "$top": 50,
                    "$orderby": "receivedDateTime desc",
                    "$select": "id,subject,from,toRecipients,receivedDateTime,bodyPreview,webLink,isRead",
                }

                if odata_filter:
                    params["$filter"] = odata_filter

                # Add time filter if we have a cursor
                if newest_received_datetime:
                    time_filter = f"receivedDateTime gt {newest_received_datetime}"
                    if params.get("$filter"):
                        params["$filter"] = f"{params['$filter']} and {time_filter}"
                    else:
                        params["$filter"] = time_filter

                try:
                    result = await self._graph_request(
                        f"/me/mailFolders/{folder_id}/messages",
                        params
                    )
                except httpx.HTTPStatusError as e:
                    if e.response.status_code == 404:
                        logger.warning(f"Outlook folder not found: {folder_name}")
                        continue
                    raise

                messages = result.get("value", [])

                for msg in messages:
                    msg_id = msg.get("id")
                    if not msg_id:
                        continue

                    # Skip already processed messages
                    if msg_id in processed_ids:
                        continue

                    # Parse from address
                    from_data = msg.get("from", {}).get("emailAddress", {})
                    from_info = {
                        "email": from_data.get("address", ""),
                        "name": from_data.get("name", ""),
                    }

                    # Parse to recipients
                    to_list = [
                        r.get("emailAddress", {}).get("address", "")
                        for r in msg.get("toRecipients", [])
                    ]

                    # Build event data
                    event_data = {
                        "message_id": msg_id,
                        "subject": msg.get("subject", "(No subject)"),
                        "from": from_info,
                        "to": to_list,
                        "date": msg.get("receivedDateTime", ""),
                        "snippet": msg.get("bodyPreview", ""),
                        "is_read": msg.get("isRead", False),
                        "folder": folder_name,
                        "permalink": msg.get("webLink", ""),
                    }

                    # Parse timestamp
                    timestamp = None
                    received_dt = msg.get("receivedDateTime")
                    if received_dt:
                        try:
                            timestamp = datetime.fromisoformat(received_dt.replace("Z", "+00:00"))
                            # Track newest message time for cursor
                            if not newest_received_datetime or received_dt > newest_received_datetime:
                                newest_received_datetime = received_dt
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

            # Update cursor
            new_cursor["processed_ids"] = list(processed_ids)[-500:]
            if newest_received_datetime:
                new_cursor["last_received_datetime"] = newest_received_datetime

        except httpx.HTTPStatusError as e:
            if e.response.status_code == 401:
                logger.error("Microsoft Graph API authentication failed - token may be expired")
            else:
                logger.error(f"Microsoft Graph API error: {e.response.status_code} - {e.response.text}")
            raise
        except Exception as e:
            logger.error(f"Error polling Outlook: {e}")
            raise

        return events, new_cursor

    async def validate_config(self) -> tuple[bool, Optional[str]]:
        """
        Validate the Outlook configuration.

        Checks that we can access the Microsoft Graph API with the current token.
        """
        if not self.access_token:
            return False, "No access token available"

        try:
            # Try to get the user's profile
            result = await self._graph_request("/me")
            email = result.get("mail") or result.get("userPrincipalName")
            if email:
                logger.info(f"Outlook config validated for {email}")
                return True, None
            return False, "Could not retrieve Outlook profile"

        except httpx.HTTPStatusError as e:
            if e.response.status_code == 401:
                return False, "Microsoft access token is invalid or expired"
            elif e.response.status_code == 403:
                return False, "Microsoft Graph API access denied - check OAuth scopes"
            return False, f"Microsoft Graph API error: {e.response.status_code}"
        except Exception as e:
            return False, f"Failed to validate Outlook config: {str(e)}"

    @staticmethod
    def get_required_scopes() -> list[str]:
        """Get required OAuth scopes for Outlook monitoring."""
        return ["Mail.Read", "User.Read", "offline_access"]
