from abc import ABC, abstractmethod
from dataclasses import dataclass
from datetime import datetime
from typing import Any, Optional


@dataclass
class MonitorAdapterEvent:
    """Represents an event detected by a monitor adapter."""
    provider_event_id: str  # Unique ID from the provider
    event_type: str  # e.g., "message", "file_created", "task_updated"
    event_data: dict  # The raw event data
    context_data: Optional[dict] = None  # Additional context (e.g., surrounding messages)
    provider_timestamp: Optional[datetime] = None  # When the event occurred


class MonitorAdapter(ABC):
    """
    Abstract base class for monitor provider adapters.

    Each provider (Slack, Google Drive, etc.) implements this interface
    to handle polling and webhook processing.
    """

    def __init__(self, connection_data: dict, provider_config: dict):
        """
        Initialize the adapter.

        Args:
            connection_data: The decrypted OAuth connection data (tokens, etc.)
            provider_config: Provider-specific configuration from the monitor
        """
        self.connection_data = connection_data
        self.provider_config = provider_config

    @abstractmethod
    async def poll(self, cursor: Optional[dict] = None) -> tuple[list[MonitorAdapterEvent], Optional[dict]]:
        """
        Poll the provider for new events.

        Args:
            cursor: Optional cursor from previous poll for pagination

        Returns:
            A tuple of (events, new_cursor) where:
            - events: List of detected events
            - new_cursor: Cursor to use for next poll (None if no more events)
        """
        pass

    @abstractmethod
    async def validate_config(self) -> tuple[bool, Optional[str]]:
        """
        Validate the provider configuration.

        Returns:
            A tuple of (is_valid, error_message)
            - is_valid: True if configuration is valid
            - error_message: Description of the error if invalid, None otherwise
        """
        pass

    async def setup_webhook(self, webhook_url: str) -> Optional[str]:
        """
        Set up a webhook for real-time event notifications (if supported).

        Args:
            webhook_url: The URL to receive webhook callbacks

        Returns:
            The webhook ID if successfully set up, None if not supported
        """
        return None  # Default: webhooks not supported

    async def handle_webhook(self, payload: dict, headers: dict) -> list[MonitorAdapterEvent]:
        """
        Process an incoming webhook payload.

        Args:
            payload: The webhook payload
            headers: HTTP headers from the webhook request

        Returns:
            List of events extracted from the webhook payload
        """
        return []  # Default: no webhook handling

    async def teardown_webhook(self, webhook_id: str) -> bool:
        """
        Remove a previously set up webhook.

        Args:
            webhook_id: The ID of the webhook to remove

        Returns:
            True if successfully removed, False otherwise
        """
        return True  # Default: no cleanup needed

    @staticmethod
    def get_required_scopes() -> list[str]:
        """
        Get the OAuth scopes required for this provider.

        Returns:
            List of required scope strings
        """
        return []
