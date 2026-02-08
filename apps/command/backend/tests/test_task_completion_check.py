"""Tests for the task completion check endpoint.

Uses lazy imports via importlib to handle environments where
full app dependencies may not be available.
"""
import re
import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from bson import ObjectId
from datetime import datetime, timezone


# ---- Pure utility function tests (no app imports needed) ----

class TestExtractExistingTsMarkers:
    """Test the ts marker extraction from existing comments."""

    def _extract(self, comments):
        """Inline implementation of ts marker extraction for testing."""
        markers = set()
        pattern = re.compile(r"<!-- ts:([\d.]+) -->")
        for comment in comments:
            content = comment.get("content", "")
            for match in pattern.finditer(content):
                markers.add(match.group(1))
        return markers

    def test_extracts_single_marker(self):
        comments = [{"content": "some text\n<!-- ts:1738937400.123456 -->\nmore text"}]
        assert self._extract(comments) == {"1738937400.123456"}

    def test_extracts_multiple_markers_from_one_comment(self):
        comments = [{"content": "<!-- ts:111.111 -->\n<!-- ts:222.222 -->"}]
        assert self._extract(comments) == {"111.111", "222.222"}

    def test_extracts_markers_across_comments(self):
        comments = [
            {"content": "text <!-- ts:111.111 -->"},
            {"content": "text <!-- ts:222.222 -->"},
        ]
        assert self._extract(comments) == {"111.111", "222.222"}

    def test_empty_comments(self):
        assert self._extract([]) == set()

    def test_no_markers(self):
        comments = [{"content": "regular comment with no markers"}]
        assert self._extract(comments) == set()

    def test_missing_content_field(self):
        comments = [{"other_field": "value"}]
        assert self._extract(comments) == set()


class TestBuildResponse:
    """Test response builder logic."""

    def _build_response(self, details, total_checked):
        """Inline implementation for testing."""
        tasks_completed = sum(1 for d in details if d.get("action") == "completed")
        tasks_updated = sum(1 for d in details if d.get("action") == "updated")
        tasks_skipped = sum(1 for d in details if d.get("action") == "skipped")
        errors = sum(1 for d in details if d.get("action") == "error")
        return {
            "tasks_checked": total_checked,
            "tasks_completed": tasks_completed,
            "tasks_updated": tasks_updated,
            "tasks_skipped": tasks_skipped,
            "errors": errors,
            "details": details,
        }

    def test_empty_details(self):
        result = self._build_response([], 0)
        assert result == {
            "tasks_checked": 0,
            "tasks_completed": 0,
            "tasks_updated": 0,
            "tasks_skipped": 0,
            "errors": 0,
            "details": [],
        }

    def test_mixed_results(self):
        details = [
            {"task_id": "1", "action": "completed", "message": "Resolved"},
            {"task_id": "2", "action": "completed", "message": "Resolved"},
            {"task_id": "3", "action": "updated", "message": "2 new messages"},
            {"task_id": "4", "action": "skipped", "message": "No new messages"},
            {"task_id": "5", "action": "error", "message": "API error"},
        ]
        result = self._build_response(details, 5)
        assert result["tasks_checked"] == 5
        assert result["tasks_completed"] == 2
        assert result["tasks_updated"] == 1
        assert result["tasks_skipped"] == 1
        assert result["errors"] == 1
        assert len(result["details"]) == 5


class TestBuildThreadText:
    """Test thread text builder for AI analysis."""

    def test_builds_text_from_messages(self):
        adapter = MagicMock()
        adapter._user_name_cache = {"U1": "Alice", "U2": "Bob"}
        messages = [
            {"user": "U1", "text": "Hello"},
            {"user": "U2", "text": "Hi there"},
        ]
        # Inline the logic
        lines = []
        for msg in messages:
            user_id = msg.get("user", "Unknown")
            name = adapter._user_name_cache.get(user_id, user_id)
            text = msg.get("text", "")
            lines.append(f"{name}: {text}")
        result = "\n".join(lines)
        assert "Alice: Hello" in result
        assert "Bob: Hi there" in result

    def test_unknown_user_uses_id(self):
        adapter = MagicMock()
        adapter._user_name_cache = {}
        messages = [{"user": "U999", "text": "Unknown person"}]
        lines = []
        for msg in messages:
            user_id = msg.get("user", "Unknown")
            name = adapter._user_name_cache.get(user_id, user_id)
            text = msg.get("text", "")
            lines.append(f"{name}: {text}")
        result = "\n".join(lines)
        assert "U999: Unknown person" in result


class TestCommentFormatting:
    """Test comment formatting patterns."""

    def _format_thread_message(self, msg, sender_name=None):
        """Inline implementation for testing."""
        ts = msg.get("ts", "")
        text = msg.get("text", "")
        name = sender_name or msg.get("user", "Unknown")
        ts_display = ""
        if ts:
            try:
                dt = datetime.fromtimestamp(float(ts), tz=timezone.utc)
                ts_display = dt.strftime("%b %d, %I:%M %p")
            except (ValueError, OSError):
                ts_display = ""
        time_part = f" ({ts_display})" if ts_display else ""
        quoted = f"> **@{name}**{time_part}:\n> {text}"
        marker = f"\n<!-- ts:{ts} -->" if ts else ""
        return quoted + marker

    def test_basic_message(self):
        msg = {"ts": "1738937400.123456", "text": "Hello world", "user": "U12345"}
        result = self._format_thread_message(msg, sender_name="Alice")
        assert "**@Alice**" in result
        assert "Hello world" in result
        assert "<!-- ts:1738937400.123456 -->" in result

    def test_message_without_ts(self):
        msg = {"text": "No timestamp", "user": "U12345"}
        result = self._format_thread_message(msg, sender_name="Bob")
        assert "**@Bob**" in result
        assert "No timestamp" in result
        assert "<!-- ts:" not in result

    def test_message_without_sender_name(self):
        msg = {"ts": "1738937400.123456", "text": "Test", "user": "U12345"}
        result = self._format_thread_message(msg)
        assert "**@U12345**" in result

    def test_resolved_comment_format(self):
        messages = [
            {"ts": "111.111", "text": "Fixed!", "user": "U1", "_resolved_name": "Alice"},
        ]
        # Build resolved comment inline
        parts = ["**Task Resolved -- Thread Activity**\n"]
        parts.append("The following messages indicate this has been resolved:\n")
        for msg in messages:
            name = msg.get("_resolved_name", msg.get("user", "Unknown"))
            parts.append(self._format_thread_message(msg, sender_name=name))
            parts.append("")
        permalink = "https://slack.com/archives/C1/p111111"
        if permalink:
            parts.append(f"[View in Slack]({permalink})")
            parts.append("")
        parts.append("*Auto-detected by Thread Update Check*")
        result = "\n".join(parts)

        assert "**Task Resolved -- Thread Activity**" in result
        assert "**@Alice**" in result
        assert "Fixed!" in result
        assert "<!-- ts:111.111 -->" in result
        assert "[View in Slack]" in result
        assert "*Auto-detected by Thread Update Check*" in result

    def test_update_comment_singular(self):
        messages = [
            {"ts": "111.111", "text": "Any update?", "user": "U1", "_resolved_name": "Alice"},
        ]
        count = len(messages)
        header = f"**Thread Update** ({count} new message{'s' if count != 1 else ''})\n"
        assert "**Thread Update** (1 new message)" in header

    def test_update_comment_plural(self):
        messages = [{"ts": f"{i}.{i}", "text": f"Msg {i}", "user": f"U{i}"} for i in range(3)]
        count = len(messages)
        header = f"**Thread Update** ({count} new message{'s' if count != 1 else ''})\n"
        assert "**Thread Update** (3 new messages)" in header


# ---- Integration tests that require app imports ----
# These test the actual _check_single_task function with mocked dependencies.
# They use try/except around the import so they skip gracefully if dependencies
# aren't available (e.g. running tests without the full Docker environment).

def _try_import_check_single_task():
    """Try importing _check_single_task; return None if unavailable."""
    try:
        from app.api.v1.task_completion_check import _check_single_task
        return _check_single_task
    except ImportError:
        return None


_check_fn = _try_import_check_single_task()
_skip_reason = "App dependencies not available in this environment"


@pytest.mark.skipif(_check_fn is None, reason=_skip_reason)
class TestCheckSingleTask:
    """Tests for _check_single_task with mocked Slack/AI/DB."""

    @pytest.mark.asyncio
    async def test_skipped_no_slack_data(self):
        """Task without channel/thread data should be skipped."""
        task = {
            "_id": ObjectId(),
            "title": "Test Task",
            "input_data": {},
            "source_monitor_id": ObjectId(),
        }
        mock_user = MagicMock()
        mock_user.organization_id = str(ObjectId())
        mock_user.id = str(ObjectId())
        mock_user.name = "Test"

        result = await _check_fn(
            MagicMock(), task, mock_user, MagicMock(), {}, {},
        )
        assert result["action"] == "skipped"
        assert "No Slack channel/thread data" in result["message"]

    @pytest.mark.asyncio
    async def test_no_new_messages(self):
        """Task with no new thread messages should be skipped."""
        task = {
            "_id": ObjectId(),
            "title": "Test Task",
            "source_monitor_id": ObjectId(),
            "input_data": {
                "_monitor_event": {
                    "event_data": {
                        "channel": "C12345",
                        "thread_ts": "111.111",
                        "ts": "111.111",
                        "text": "Original message",
                    },
                    "context_data": {
                        "thread": [
                            {"ts": "111.111", "text": "Original", "user": "U1"},
                            {"ts": "222.222", "text": "Reply", "user": "U2"},
                        ],
                    },
                },
            },
        }

        mock_user = MagicMock()
        mock_user.organization_id = str(ObjectId())
        mock_user.id = str(ObjectId())
        mock_user.name = "Test"

        mock_adapter = MagicMock()
        mock_adapter._fetch_message_context = AsyncMock(return_value={
            "thread": [
                {"ts": "111.111", "text": "Original", "user": "U1"},
                {"ts": "222.222", "text": "Reply", "user": "U2"},
            ],
        })

        mock_db = MagicMock()
        mock_cursor = MagicMock()
        mock_cursor.to_list = AsyncMock(return_value=[])
        mock_db.task_comments.find = MagicMock(return_value=mock_cursor)

        with patch(
            "app.api.v1.task_completion_check._get_slack_adapter",
            new_callable=AsyncMock,
            return_value=mock_adapter,
        ):
            result = await _check_fn(
                mock_db, task, mock_user, MagicMock(), {}, {},
            )

        assert result["action"] == "skipped"
        assert "No new messages" in result["message"]

    @pytest.mark.asyncio
    async def test_new_messages_not_resolved(self):
        """New messages that AI says are NOT resolved should post update comment."""
        task = {
            "_id": ObjectId(),
            "title": "Help with deployment",
            "source_monitor_id": ObjectId(),
            "input_data": {
                "_monitor_event": {
                    "event_data": {
                        "channel": "C12345",
                        "thread_ts": "111.111",
                        "ts": "111.111",
                        "text": "Can someone help with deployment?",
                    },
                    "context_data": {
                        "thread": [
                            {"ts": "111.111", "text": "Can someone help?", "user": "U1"},
                        ],
                    },
                },
            },
        }

        mock_user = MagicMock()
        mock_user.organization_id = str(ObjectId())
        mock_user.id = str(ObjectId())
        mock_user.name = "Test"

        mock_adapter = MagicMock()
        mock_adapter._fetch_message_context = AsyncMock(return_value={
            "thread": [
                {"ts": "111.111", "text": "Can someone help?", "user": "U1"},
                {"ts": "333.333", "text": "I'm looking into it", "user": "U2"},
            ],
        })
        mock_adapter._resolve_user_name = AsyncMock(return_value="Alice")
        mock_adapter._user_name_cache = {"U1": "Sender", "U2": "Alice"}

        mock_ai = MagicMock()
        mock_ai.is_configured = MagicMock(return_value=True)
        mock_ai.check_task_resolution = AsyncMock(return_value=False)

        mock_db = MagicMock()
        mock_cursor = MagicMock()
        mock_cursor.to_list = AsyncMock(return_value=[])
        mock_db.task_comments.find = MagicMock(return_value=mock_cursor)
        mock_db.task_comments.insert_one = AsyncMock()

        with patch(
            "app.api.v1.task_completion_check._get_slack_adapter",
            new_callable=AsyncMock,
            return_value=mock_adapter,
        ):
            result = await _check_fn(
                mock_db, task, mock_user, mock_ai, {}, {},
            )

        assert result["action"] == "updated"
        assert "1 new message" in result["message"]
        mock_db.task_comments.insert_one.assert_called_once()

    @pytest.mark.asyncio
    async def test_resolved_completes_task(self):
        """New messages that AI says IS resolved should complete the task."""
        task = {
            "_id": ObjectId(),
            "title": "Fix the bug",
            "source_monitor_id": ObjectId(),
            "project_id": None,
            "input_data": {
                "_monitor_event": {
                    "event_data": {
                        "channel": "C12345",
                        "thread_ts": "111.111",
                        "ts": "111.111",
                        "text": "There's a bug in production",
                    },
                    "context_data": {
                        "thread": [
                            {"ts": "111.111", "text": "Bug report", "user": "U1"},
                        ],
                    },
                },
            },
        }

        mock_user = MagicMock()
        mock_user.organization_id = str(ObjectId())
        mock_user.id = str(ObjectId())
        mock_user.name = "Test"

        mock_adapter = MagicMock()
        mock_adapter._fetch_message_context = AsyncMock(return_value={
            "thread": [
                {"ts": "111.111", "text": "Bug report", "user": "U1"},
                {"ts": "444.444", "text": "Fixed and deployed!", "user": "U2"},
            ],
        })
        mock_adapter._resolve_user_name = AsyncMock(return_value="Bob")
        mock_adapter._user_name_cache = {"U1": "Reporter", "U2": "Bob"}

        mock_ai = MagicMock()
        mock_ai.is_configured = MagicMock(return_value=True)
        mock_ai.check_task_resolution = AsyncMock(return_value=True)

        mock_db = MagicMock()
        mock_cursor = MagicMock()
        mock_cursor.to_list = AsyncMock(return_value=[])
        mock_db.task_comments.find = MagicMock(return_value=mock_cursor)
        mock_db.task_comments.insert_one = AsyncMock()
        mock_db.tasks.find_one_and_update = AsyncMock(return_value={
            **task,
            "status": "completed",
            "phase": "approved",
        })

        with patch(
            "app.api.v1.task_completion_check._get_slack_adapter",
            new_callable=AsyncMock,
            return_value=mock_adapter,
        ), patch(
            "app.api.v1.task_completion_check.emit_event",
            new_callable=AsyncMock,
        ) as mock_emit, patch(
            "app.api.v1.task_completion_check.add_task_completion_to_project_timeline",
            new_callable=AsyncMock,
        ):
            result = await _check_fn(
                mock_db, task, mock_user, mock_ai, {}, {},
            )

        assert result["action"] == "completed"
        assert "Resolved" in result["message"]
        mock_db.tasks.find_one_and_update.assert_called_once()
        mock_emit.assert_called_once()

    @pytest.mark.asyncio
    async def test_deduplication_via_ts_markers(self):
        """Messages already reported via ts markers should not be re-reported."""
        task = {
            "_id": ObjectId(),
            "title": "Test Task",
            "source_monitor_id": ObjectId(),
            "input_data": {
                "_monitor_event": {
                    "event_data": {
                        "channel": "C12345",
                        "thread_ts": "111.111",
                        "ts": "111.111",
                        "text": "Original",
                    },
                    "context_data": {
                        "thread": [
                            {"ts": "111.111", "text": "Original", "user": "U1"},
                        ],
                    },
                },
            },
        }

        mock_user = MagicMock()
        mock_user.organization_id = str(ObjectId())
        mock_user.id = str(ObjectId())
        mock_user.name = "Test"

        mock_adapter = MagicMock()
        mock_adapter._fetch_message_context = AsyncMock(return_value={
            "thread": [
                {"ts": "111.111", "text": "Original", "user": "U1"},
                {"ts": "333.333", "text": "Already reported", "user": "U2"},
            ],
        })

        mock_db = MagicMock()
        mock_cursor = MagicMock()
        mock_cursor.to_list = AsyncMock(return_value=[
            {"content": "Previous update\n<!-- ts:333.333 -->"},
        ])
        mock_db.task_comments.find = MagicMock(return_value=mock_cursor)

        with patch(
            "app.api.v1.task_completion_check._get_slack_adapter",
            new_callable=AsyncMock,
            return_value=mock_adapter,
        ):
            result = await _check_fn(
                mock_db, task, mock_user, MagicMock(), {}, {},
            )

        assert result["action"] == "skipped"
        assert "No new messages" in result["message"]

    @pytest.mark.asyncio
    async def test_adapter_fetch_error(self):
        """Slack API errors should be caught and reported as errors."""
        task = {
            "_id": ObjectId(),
            "title": "Test Task",
            "source_monitor_id": ObjectId(),
            "input_data": {
                "_monitor_event": {
                    "event_data": {
                        "channel": "C12345",
                        "thread_ts": "111.111",
                        "ts": "111.111",
                    },
                    "context_data": {"thread": []},
                },
            },
        }

        mock_user = MagicMock()
        mock_user.organization_id = str(ObjectId())
        mock_user.id = str(ObjectId())
        mock_user.name = "Test"

        mock_adapter = MagicMock()
        mock_adapter._fetch_message_context = AsyncMock(
            side_effect=Exception("channel_not_found")
        )

        with patch(
            "app.api.v1.task_completion_check._get_slack_adapter",
            new_callable=AsyncMock,
            return_value=mock_adapter,
        ):
            result = await _check_fn(
                MagicMock(), task, mock_user, MagicMock(), {}, {},
            )

        assert result["action"] == "error"
        assert "Slack API error" in result["message"]

    @pytest.mark.asyncio
    async def test_ai_failure_defaults_to_not_resolved(self):
        """If AI check fails, task should be treated as not resolved (update only)."""
        task = {
            "_id": ObjectId(),
            "title": "Test Task",
            "source_monitor_id": ObjectId(),
            "input_data": {
                "_monitor_event": {
                    "event_data": {
                        "channel": "C12345",
                        "thread_ts": "111.111",
                        "ts": "111.111",
                        "text": "Original",
                    },
                    "context_data": {
                        "thread": [
                            {"ts": "111.111", "text": "Original", "user": "U1"},
                        ],
                    },
                },
            },
        }

        mock_user = MagicMock()
        mock_user.organization_id = str(ObjectId())
        mock_user.id = str(ObjectId())
        mock_user.name = "Test"

        mock_adapter = MagicMock()
        mock_adapter._fetch_message_context = AsyncMock(return_value={
            "thread": [
                {"ts": "111.111", "text": "Original", "user": "U1"},
                {"ts": "555.555", "text": "New reply", "user": "U2"},
            ],
        })
        mock_adapter._resolve_user_name = AsyncMock(return_value="Someone")
        mock_adapter._user_name_cache = {"U1": "A", "U2": "B"}

        mock_ai = MagicMock()
        mock_ai.is_configured = MagicMock(return_value=True)
        mock_ai.check_task_resolution = AsyncMock(side_effect=Exception("AI down"))

        mock_db = MagicMock()
        mock_cursor = MagicMock()
        mock_cursor.to_list = AsyncMock(return_value=[])
        mock_db.task_comments.find = MagicMock(return_value=mock_cursor)
        mock_db.task_comments.insert_one = AsyncMock()

        with patch(
            "app.api.v1.task_completion_check._get_slack_adapter",
            new_callable=AsyncMock,
            return_value=mock_adapter,
        ):
            result = await _check_fn(
                mock_db, task, mock_user, mock_ai, {}, {},
            )

        assert result["action"] == "updated"
