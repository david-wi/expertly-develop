import httpx
import base64
from typing import Optional, List


class JiraService:
    def __init__(self, host: str, email: str, api_token: str):
        self.host = host.rstrip("/")
        self.email = email
        self.api_token = api_token
        self.base_url = f"https://{self.host}/rest/api/3"

    def _get_auth_header(self) -> str:
        """Generate Basic auth header."""
        credentials = f"{self.email}:{self.api_token}"
        encoded = base64.b64encode(credentials.encode()).decode()
        return f"Basic {encoded}"

    async def create_issue(
        self,
        project_key: str,
        summary: str,
        description: Optional[str] = None,
        issue_type: str = "Story",
        priority: str = "Medium",
        labels: Optional[List[str]] = None,
        story_points: Optional[int] = None,
    ) -> dict:
        """Create a Jira issue."""
        # Build issue fields
        fields = {
            "project": {"key": project_key},
            "summary": summary,
            "issuetype": {"name": issue_type},
        }

        # Add description in Atlassian Document Format (ADF)
        if description:
            fields["description"] = {
                "type": "doc",
                "version": 1,
                "content": [
                    {
                        "type": "paragraph",
                        "content": [{"type": "text", "text": description}],
                    }
                ],
            }

        # Add priority
        if priority:
            fields["priority"] = {"name": priority}

        # Add labels
        if labels:
            fields["labels"] = labels

        # Note: Story points field name varies by Jira configuration
        # Common field names: customfield_10016, customfield_10026
        # This would need to be configured per-product

        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{self.base_url}/issue",
                json={"fields": fields},
                headers={
                    "Authorization": self._get_auth_header(),
                    "Content-Type": "application/json",
                },
            )

            if response.status_code not in (200, 201):
                error_detail = response.text
                try:
                    error_json = response.json()
                    if "errors" in error_json:
                        error_detail = str(error_json["errors"])
                    elif "errorMessages" in error_json:
                        error_detail = ", ".join(error_json["errorMessages"])
                except Exception:
                    pass
                raise Exception(f"Jira API error ({response.status_code}): {error_detail}")

            data = response.json()
            issue_key = data.get("key")
            return {
                "key": issue_key,
                "url": f"https://{self.host}/browse/{issue_key}",
            }

    async def test_connection(self) -> bool:
        """Test Jira connection."""
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{self.base_url}/myself",
                headers={"Authorization": self._get_auth_header()},
            )
            return response.status_code == 200
