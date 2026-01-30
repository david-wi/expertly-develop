"""
GitHub monitor adapter for watching repository events.
"""
import hashlib
import hmac
import logging
from datetime import datetime, timezone
from typing import Optional

import httpx

from app.services.monitor_providers.base import MonitorAdapter, MonitorAdapterEvent

logger = logging.getLogger(__name__)


class GitHubMonitorAdapter(MonitorAdapter):
    """
    Monitor adapter for GitHub events.

    Supports:
    - Polling via Events API (with ETag caching)
    - Webhooks for real-time notifications
    - PR, issue, and push events
    """

    GITHUB_API_BASE = "https://api.github.com"

    def __init__(self, connection_data: dict, provider_config: dict):
        super().__init__(connection_data, provider_config)
        self.access_token = connection_data.get("access_token")
        self.owner = provider_config.get("owner", "")
        self.repo = provider_config.get("repo", "")
        self.event_types = provider_config.get(
            "event_types", ["pull_request", "issues", "push"]
        )
        self.branches = provider_config.get("branches", [])
        self.labels = provider_config.get("labels", [])
        self.exclude_bots = provider_config.get("exclude_bots", True)
        self.pr_actions = provider_config.get(
            "pr_actions", ["opened", "reopened", "ready_for_review"]
        )
        self.issue_actions = provider_config.get(
            "issue_actions", ["opened", "reopened"]
        )
        self.include_diff = provider_config.get("include_diff", False)
        self.include_comments = provider_config.get("include_comments", 0)

    def _get_headers(self) -> dict:
        """Get headers for GitHub API requests."""
        return {
            "Authorization": f"Bearer {self.access_token}",
            "Accept": "application/vnd.github+json",
            "X-GitHub-Api-Version": "2022-11-28"
        }

    async def poll(
        self, cursor: Optional[dict] = None
    ) -> tuple[list[MonitorAdapterEvent], Optional[dict]]:
        """
        Poll GitHub Events API for new events.

        Uses ETag caching to minimize API rate limit impact.

        Args:
            cursor: Previous poll state including ETag and last event ID

        Returns:
            Tuple of (events, new_cursor)
        """
        events = []
        new_cursor = cursor.copy() if cursor else {}

        url = f"{self.GITHUB_API_BASE}/repos/{self.owner}/{self.repo}/events"
        headers = self._get_headers()

        # Use ETag for conditional requests
        if cursor and cursor.get("etag"):
            headers["If-None-Match"] = cursor["etag"]

        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(url, headers=headers, timeout=30.0)

                # Not modified - no new events
                if response.status_code == 304:
                    logger.debug(f"GitHub events not modified for {self.owner}/{self.repo}")
                    return [], cursor

                if response.status_code != 200:
                    logger.error(
                        f"GitHub API error: {response.status_code} - {response.text}"
                    )
                    return [], cursor

                # Store new ETag
                if "ETag" in response.headers:
                    new_cursor["etag"] = response.headers["ETag"]

                raw_events = response.json()
                last_seen_id = cursor.get("last_event_id") if cursor else None
                newest_id = None

                for event in raw_events:
                    event_id = event.get("id")

                    # Track newest event ID
                    if newest_id is None:
                        newest_id = event_id

                    # Skip events we've already seen
                    if last_seen_id and event_id == last_seen_id:
                        break

                    # Check if event type is monitored
                    event_type = event.get("type", "")
                    if not self._is_event_monitored(event_type):
                        continue

                    # Filter bot events if configured
                    if self.exclude_bots and self._is_bot_event(event):
                        continue

                    # Convert to our event format
                    adapter_event = self._convert_event(event)
                    if adapter_event:
                        events.append(adapter_event)

                if newest_id:
                    new_cursor["last_event_id"] = newest_id

        except Exception as e:
            logger.error(f"Error polling GitHub: {e}")
            return [], cursor

        return events, new_cursor

    def _is_event_monitored(self, event_type: str) -> bool:
        """Check if an event type is being monitored."""
        type_mapping = {
            "PullRequestEvent": "pull_request",
            "IssuesEvent": "issues",
            "PushEvent": "push",
            "IssueCommentEvent": "issue_comment",
            "PullRequestReviewEvent": "pull_request_review",
            "PullRequestReviewCommentEvent": "pull_request_review_comment",
        }
        mapped_type = type_mapping.get(event_type)
        return mapped_type in self.event_types

    def _is_bot_event(self, event: dict) -> bool:
        """Check if an event was triggered by a bot."""
        actor = event.get("actor", {})
        login = actor.get("login", "")
        actor_type = actor.get("type", "")

        return (
            actor_type == "Bot" or
            login.endswith("[bot]") or
            login.endswith("-bot")
        )

    def _convert_event(self, event: dict) -> Optional[MonitorAdapterEvent]:
        """Convert a GitHub event to our format."""
        event_type = event.get("type", "")
        payload = event.get("payload", {})
        actor = event.get("actor", {})

        # Check action filters
        action = payload.get("action", "")
        if event_type == "PullRequestEvent":
            if action not in self.pr_actions:
                return None
            # Check branch filter
            if self.branches:
                base_branch = payload.get("pull_request", {}).get("base", {}).get("ref", "")
                if base_branch not in self.branches:
                    return None
            # Check label filter
            if self.labels:
                pr_labels = [
                    l.get("name") for l in
                    payload.get("pull_request", {}).get("labels", [])
                ]
                if not any(label in pr_labels for label in self.labels):
                    return None

        elif event_type == "IssuesEvent":
            if action not in self.issue_actions:
                return None
            # Check label filter
            if self.labels:
                issue_labels = [
                    l.get("name") for l in
                    payload.get("issue", {}).get("labels", [])
                ]
                if not any(label in issue_labels for label in self.labels):
                    return None

        elif event_type == "PushEvent":
            # Check branch filter
            if self.branches:
                ref = payload.get("ref", "")
                branch = ref.replace("refs/heads/", "")
                if branch not in self.branches:
                    return None

        # Build event data
        event_data = {
            "type": event_type,
            "action": action,
            "actor": {
                "login": actor.get("login"),
                "avatar_url": actor.get("avatar_url"),
            },
            "repo": {
                "owner": self.owner,
                "name": self.repo,
            },
        }

        # Add type-specific data
        if event_type == "PullRequestEvent":
            pr = payload.get("pull_request", {})
            event_data["pull_request"] = {
                "number": pr.get("number"),
                "title": pr.get("title"),
                "body": pr.get("body"),
                "html_url": pr.get("html_url"),
                "state": pr.get("state"),
                "user": pr.get("user", {}).get("login"),
                "base_branch": pr.get("base", {}).get("ref"),
                "head_branch": pr.get("head", {}).get("ref"),
                "additions": pr.get("additions"),
                "deletions": pr.get("deletions"),
                "changed_files": pr.get("changed_files"),
            }

        elif event_type == "IssuesEvent":
            issue = payload.get("issue", {})
            event_data["issue"] = {
                "number": issue.get("number"),
                "title": issue.get("title"),
                "body": issue.get("body"),
                "html_url": issue.get("html_url"),
                "state": issue.get("state"),
                "user": issue.get("user", {}).get("login"),
                "labels": [l.get("name") for l in issue.get("labels", [])],
            }

        elif event_type == "PushEvent":
            event_data["push"] = {
                "ref": payload.get("ref"),
                "before": payload.get("before"),
                "after": payload.get("head"),
                "commits": [
                    {
                        "sha": c.get("sha"),
                        "message": c.get("message"),
                        "author": c.get("author", {}).get("name"),
                    }
                    for c in payload.get("commits", [])[:10]  # Limit commits
                ],
                "commit_count": len(payload.get("commits", [])),
            }

        # Parse timestamp
        created_at = event.get("created_at")
        timestamp = None
        if created_at:
            try:
                timestamp = datetime.fromisoformat(created_at.replace("Z", "+00:00"))
            except Exception:
                pass

        return MonitorAdapterEvent(
            provider_event_id=event.get("id"),
            event_type=event_type,
            event_data=event_data,
            provider_timestamp=timestamp
        )

    async def validate_config(self) -> tuple[bool, Optional[str]]:
        """
        Validate the GitHub configuration.

        Checks:
        - Repository exists and is accessible
        - Token has required permissions

        Returns:
            Tuple of (is_valid, error_message)
        """
        if not self.owner or not self.repo:
            return False, "Owner and repo are required"

        if not self.access_token:
            return False, "GitHub access token is required"

        url = f"{self.GITHUB_API_BASE}/repos/{self.owner}/{self.repo}"
        headers = self._get_headers()

        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(url, headers=headers, timeout=10.0)

                if response.status_code == 404:
                    return False, f"Repository {self.owner}/{self.repo} not found"

                if response.status_code == 401:
                    return False, "Invalid or expired GitHub token"

                if response.status_code == 403:
                    return False, "Token lacks permission to access this repository"

                if response.status_code != 200:
                    return False, f"GitHub API error: {response.status_code}"

                # Check if it's a private repo we can access
                repo_data = response.json()
                logger.info(
                    f"Validated GitHub config for {self.owner}/{self.repo} "
                    f"(private: {repo_data.get('private')})"
                )

                return True, None

        except httpx.TimeoutException:
            return False, "GitHub API request timed out"
        except Exception as e:
            return False, f"Error validating GitHub config: {str(e)}"

    async def setup_webhook(self, webhook_url: str) -> Optional[str]:
        """
        Set up a GitHub webhook for real-time event notifications.

        Args:
            webhook_url: The URL to receive webhook callbacks

        Returns:
            The webhook ID if successful, None otherwise
        """
        import secrets
        webhook_secret = secrets.token_hex(32)

        url = f"{self.GITHUB_API_BASE}/repos/{self.owner}/{self.repo}/hooks"
        headers = self._get_headers()

        # Map our event types to GitHub webhook events
        hook_events = []
        if "pull_request" in self.event_types:
            hook_events.append("pull_request")
        if "issues" in self.event_types:
            hook_events.append("issues")
        if "push" in self.event_types:
            hook_events.append("push")
        if "issue_comment" in self.event_types:
            hook_events.append("issue_comment")
        if "pull_request_review" in self.event_types:
            hook_events.extend(["pull_request_review", "pull_request_review_comment"])

        payload = {
            "name": "web",
            "active": True,
            "events": hook_events,
            "config": {
                "url": webhook_url,
                "content_type": "json",
                "secret": webhook_secret,
                "insecure_ssl": "0"
            }
        }

        try:
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    url, headers=headers, json=payload, timeout=30.0
                )

                if response.status_code in (200, 201):
                    hook_data = response.json()
                    hook_id = str(hook_data.get("id"))
                    logger.info(
                        f"Created GitHub webhook {hook_id} for {self.owner}/{self.repo}"
                    )
                    # Store secret in provider_config for verification
                    self.provider_config["webhook_secret"] = webhook_secret
                    return hook_id
                else:
                    logger.error(
                        f"Failed to create GitHub webhook: {response.status_code} - {response.text}"
                    )
                    return None

        except Exception as e:
            logger.error(f"Error creating GitHub webhook: {e}")
            return None

    async def handle_webhook(
        self, payload: dict, headers: dict
    ) -> list[MonitorAdapterEvent]:
        """
        Process an incoming GitHub webhook payload.

        Args:
            payload: The webhook payload
            headers: HTTP headers from the request

        Returns:
            List of events extracted from the webhook
        """
        events = []

        # Get event type from header
        event_type = headers.get("x-github-event", "")

        # Map webhook event types to our event types
        type_mapping = {
            "pull_request": "PullRequestEvent",
            "issues": "IssuesEvent",
            "push": "PushEvent",
            "issue_comment": "IssueCommentEvent",
            "pull_request_review": "PullRequestReviewEvent",
        }

        internal_type = type_mapping.get(event_type)
        if not internal_type or not self._is_event_monitored(internal_type):
            return []

        # Check for bot events
        if self.exclude_bots:
            sender = payload.get("sender", {})
            if sender.get("type") == "Bot" or sender.get("login", "").endswith("[bot]"):
                return []

        # Create synthetic event in same format as polling
        event = {
            "id": headers.get("x-github-delivery", ""),
            "type": internal_type,
            "payload": payload,
            "actor": payload.get("sender", {}),
            "created_at": datetime.now(timezone.utc).isoformat()
        }

        adapter_event = self._convert_event(event)
        if adapter_event:
            events.append(adapter_event)

        return events

    async def teardown_webhook(self, webhook_id: str) -> bool:
        """
        Remove a GitHub webhook.

        Args:
            webhook_id: The ID of the webhook to remove

        Returns:
            True if successful
        """
        url = f"{self.GITHUB_API_BASE}/repos/{self.owner}/{self.repo}/hooks/{webhook_id}"
        headers = self._get_headers()

        try:
            async with httpx.AsyncClient() as client:
                response = await client.delete(url, headers=headers, timeout=10.0)
                if response.status_code == 204:
                    logger.info(f"Deleted GitHub webhook {webhook_id}")
                    return True
                else:
                    logger.warning(
                        f"Failed to delete webhook {webhook_id}: {response.status_code}"
                    )
                    return False
        except Exception as e:
            logger.error(f"Error deleting webhook: {e}")
            return False

    @staticmethod
    def verify_webhook_signature(
        body: bytes, signature: str, secret: str
    ) -> bool:
        """
        Verify a GitHub webhook signature.

        Args:
            body: Raw request body
            signature: X-Hub-Signature-256 header value
            secret: Webhook secret

        Returns:
            True if signature is valid
        """
        if not signature or not signature.startswith("sha256="):
            return False

        expected_sig = "sha256=" + hmac.new(
            secret.encode(),
            body,
            hashlib.sha256
        ).hexdigest()

        return hmac.compare_digest(expected_sig, signature)

    @staticmethod
    def get_required_scopes() -> list[str]:
        """Get required OAuth scopes for GitHub monitoring."""
        return ["repo", "read:org", "admin:repo_hook"]
