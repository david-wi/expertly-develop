"""Tests for monitors feature: models, service, and API."""
import pytest
from datetime import datetime, timezone
from unittest.mock import patch, AsyncMock, MagicMock
from bson import ObjectId


class TestMonitorModels:
    """Tests for Monitor and MonitorEvent models."""

    def test_monitor_model_creation(self):
        """Test creating a Monitor model."""
        from app.models.monitor import Monitor, MonitorProvider, MonitorStatus

        monitor = Monitor(
            organization_id=ObjectId(),
            name="Test Slack Monitor",
            description="Monitors support channel for help requests",
            provider=MonitorProvider.SLACK,
            connection_id=ObjectId(),
            provider_config={
                "channel_ids": ["C12345678"],
                "keywords": ["help", "urgent"],
                "context_messages": 5,
            },
            playbook_id="playbook-123",
            poll_interval_seconds=300,
            status=MonitorStatus.ACTIVE,
        )

        assert monitor.name == "Test Slack Monitor"
        assert monitor.provider == MonitorProvider.SLACK
        assert monitor.status == MonitorStatus.ACTIVE
        assert monitor.events_detected == 0
        assert monitor.playbooks_triggered == 0

    def test_monitor_event_model_creation(self):
        """Test creating a MonitorEvent model."""
        from app.models.monitor import MonitorEvent

        event = MonitorEvent(
            organization_id=ObjectId(),
            monitor_id=ObjectId(),
            provider_event_id="C12345678:1234567890.123456",
            event_type="message",
            event_data={
                "text": "Help needed!",
                "user": "U12345",
                "channel_id": "C12345678",
            },
            context_data={"thread": []},
            processed=False,
            provider_timestamp=datetime.now(timezone.utc),
        )

        assert event.event_type == "message"
        assert event.processed is False
        assert "text" in event.event_data

    def test_monitor_create_schema(self):
        """Test MonitorCreate validation."""
        from app.models.monitor import MonitorCreate, MonitorProvider

        create_data = MonitorCreate(
            name="Slack Support Monitor",
            provider=MonitorProvider.SLACK,
            connection_id=str(ObjectId()),
            provider_config={
                "channel_ids": ["C12345678"],
                "keywords": ["help"],
            },
            playbook_id="playbook-123",
            poll_interval_seconds=300,
        )

        assert create_data.name == "Slack Support Monitor"
        assert create_data.provider == MonitorProvider.SLACK
        assert create_data.poll_interval_seconds == 300

    def test_slack_config(self):
        """Test SlackConfig model."""
        from app.models.monitor import SlackConfig

        config = SlackConfig(
            channel_ids=["C12345678", "C87654321"],
            workspace_wide=False,
            keywords=["help", "urgent", "support"],
            context_messages=10,
        )

        assert len(config.channel_ids) == 2
        assert config.workspace_wide is False
        assert len(config.keywords) == 3
        assert config.context_messages == 10


class TestMonitorProviderAdapters:
    """Tests for monitor provider adapters."""

    def test_base_adapter_interface(self):
        """Test MonitorAdapter abstract interface."""
        from app.services.monitor_providers.base import MonitorAdapter

        # Should not be instantiatable directly
        with pytest.raises(TypeError):
            MonitorAdapter({}, {})

    def test_slack_adapter_initialization(self):
        """Test SlackMonitorAdapter initialization."""
        from app.services.monitor_providers.slack import SlackMonitorAdapter

        connection_data = {
            "access_token": "xoxb-test-token",
        }
        provider_config = {
            "channel_ids": ["C12345678"],
            "keywords": ["help"],
            "context_messages": 5,
        }

        adapter = SlackMonitorAdapter(connection_data, provider_config)

        assert adapter.access_token == "xoxb-test-token"
        assert adapter.channel_ids == ["C12345678"]
        assert adapter.keywords == ["help"]
        assert adapter.context_messages == 5

    def test_slack_adapter_message_matching(self):
        """Test Slack adapter message filtering."""
        from app.services.monitor_providers.slack import SlackMonitorAdapter

        adapter = SlackMonitorAdapter(
            {"access_token": "test"},
            {"keywords": ["help", "urgent"]},
        )

        # Message with keyword should match
        assert adapter._message_matches_filters({"text": "I need help with this"})
        assert adapter._message_matches_filters({"text": "This is URGENT!"})

        # Message without keyword should not match
        assert not adapter._message_matches_filters({"text": "Just a regular message"})

        # Bot messages should not match
        assert not adapter._message_matches_filters({
            "text": "help",
            "subtype": "bot_message",
        })

    def test_slack_adapter_no_keywords_matches_all(self):
        """Test that Slack adapter with no keywords matches all messages."""
        from app.services.monitor_providers.slack import SlackMonitorAdapter

        adapter = SlackMonitorAdapter(
            {"access_token": "test"},
            {"keywords": []},  # No keywords
        )

        # Should match any non-bot message
        assert adapter._message_matches_filters({"text": "Any message"})
        assert adapter._message_matches_filters({"text": "Another message"})

    def test_slack_adapter_parse_timestamp(self):
        """Test Slack timestamp parsing."""
        from app.services.monitor_providers.slack import SlackMonitorAdapter

        result = SlackMonitorAdapter._parse_slack_ts("1234567890.123456")

        assert result is not None
        assert isinstance(result, datetime)
        assert result.tzinfo == timezone.utc

    def test_slack_adapter_parse_invalid_timestamp(self):
        """Test Slack timestamp parsing with invalid input."""
        from app.services.monitor_providers.slack import SlackMonitorAdapter

        assert SlackMonitorAdapter._parse_slack_ts(None) is None
        assert SlackMonitorAdapter._parse_slack_ts("invalid") is None

    def test_slack_adapter_required_scopes(self):
        """Test that Slack adapter declares required scopes."""
        from app.services.monitor_providers.slack import SlackMonitorAdapter

        scopes = SlackMonitorAdapter.get_required_scopes()

        assert "channels:history" in scopes
        assert "channels:read" in scopes
        assert len(scopes) > 0


class TestMonitorService:
    """Tests for MonitorService."""

    @pytest.mark.asyncio
    async def test_get_adapter_for_slack(self):
        """Test getting Slack adapter from service."""
        from app.services.monitor_service import get_adapter_for_provider
        from app.models.monitor import MonitorProvider
        from app.services.monitor_providers.slack import SlackMonitorAdapter

        adapter = get_adapter_for_provider(
            MonitorProvider.SLACK,
            {"access_token": "test"},
            {"channel_ids": []},
        )

        assert isinstance(adapter, SlackMonitorAdapter)

    def test_get_adapter_unsupported_provider(self):
        """Test that unsupported provider raises error."""
        from app.services.monitor_service import get_adapter_for_provider
        from app.models.monitor import MonitorProvider

        with pytest.raises(ValueError, match="Unsupported provider"):
            get_adapter_for_provider(
                MonitorProvider.GOOGLE_DRIVE,  # Not yet implemented
                {"access_token": "test"},
                {},
            )

    @pytest.mark.asyncio
    async def test_poll_monitor_not_found(self):
        """Test polling a non-existent monitor."""
        from app.services.monitor_service import MonitorService

        with patch('app.services.monitor_service.get_database') as mock_get_db:
            mock_db = MagicMock()
            mock_db.monitors = MagicMock()
            mock_db.monitors.find_one = AsyncMock(return_value=None)
            mock_get_db.return_value = mock_db

            service = MonitorService()
            result = await service.poll_monitor(str(ObjectId()))

            assert result["error"] == "Monitor not found"
            assert result["events_found"] == 0

    @pytest.mark.asyncio
    async def test_poll_monitor_paused(self):
        """Test polling a paused monitor."""
        from app.services.monitor_service import MonitorService
        from app.models.monitor import MonitorStatus

        with patch('app.services.monitor_service.get_database') as mock_get_db:
            mock_db = MagicMock()
            mock_db.monitors = MagicMock()
            mock_db.monitors.find_one = AsyncMock(return_value={
                "_id": ObjectId(),
                "status": MonitorStatus.PAUSED.value,
            })
            mock_get_db.return_value = mock_db

            service = MonitorService()
            result = await service.poll_monitor(str(ObjectId()))

            assert "paused" in result["error"].lower()

    @pytest.mark.asyncio
    async def test_process_event_duplicate_detection(self):
        """Test that duplicate events are not reprocessed."""
        from app.services.monitor_service import MonitorService
        from app.services.monitor_providers.base import MonitorAdapterEvent

        with patch('app.services.monitor_service.get_database') as mock_get_db:
            mock_db = MagicMock()
            mock_db.monitor_events = MagicMock()
            # Simulate existing event
            mock_db.monitor_events.find_one = AsyncMock(return_value={
                "_id": ObjectId(),
                "provider_event_id": "test-event-id",
            })
            mock_get_db.return_value = mock_db

            service = MonitorService()

            event = MonitorAdapterEvent(
                provider_event_id="test-event-id",
                event_type="message",
                event_data={"text": "test"},
            )

            result = await service.process_event(
                {"_id": ObjectId(), "organization_id": ObjectId()},
                event,
            )

            # Should return False for duplicate
            assert result is False


class TestMonitorEventAdapter:
    """Tests for MonitorAdapterEvent dataclass."""

    def test_event_creation(self):
        """Test creating a MonitorAdapterEvent."""
        from app.services.monitor_providers.base import MonitorAdapterEvent

        event = MonitorAdapterEvent(
            provider_event_id="C12345:1234567.890",
            event_type="message",
            event_data={"text": "Hello"},
            context_data={"before": [], "after": []},
            provider_timestamp=datetime.now(timezone.utc),
        )

        assert event.provider_event_id == "C12345:1234567.890"
        assert event.event_type == "message"
        assert event.event_data["text"] == "Hello"

    def test_event_without_context(self):
        """Test creating event without optional fields."""
        from app.services.monitor_providers.base import MonitorAdapterEvent

        event = MonitorAdapterEvent(
            provider_event_id="test-id",
            event_type="message",
            event_data={},
        )

        assert event.context_data is None
        assert event.provider_timestamp is None


class TestSlackAdapterValidation:
    """Tests for Slack adapter config validation."""

    @pytest.mark.asyncio
    async def test_validate_config_no_token(self):
        """Test validation fails without access token."""
        from app.services.monitor_providers.slack import SlackMonitorAdapter

        adapter = SlackMonitorAdapter({}, {})

        is_valid, error = await adapter.validate_config()

        assert is_valid is False
        assert "token" in error.lower()

    @pytest.mark.asyncio
    async def test_validate_config_no_channels(self):
        """Test validation fails without channels or workspace-wide."""
        from app.services.monitor_providers.slack import SlackMonitorAdapter

        adapter = SlackMonitorAdapter(
            {"access_token": "test-token"},
            {"channel_ids": [], "workspace_wide": False},
        )

        # Mock the Slack API call
        with patch.object(adapter, '_slack_request', new_callable=AsyncMock) as mock_request:
            mock_request.return_value = {"ok": True}

            is_valid, error = await adapter.validate_config()

            assert is_valid is False
            assert "channel" in error.lower() or "workspace" in error.lower()
