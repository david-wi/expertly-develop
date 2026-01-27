"""AI service for test generation and analysis using Claude."""
import json
from dataclasses import dataclass, field
from typing import Optional

from app.config import get_settings


@dataclass
class GeneratedTest:
    """AI-generated test case."""

    title: str
    description: str
    preconditions: str
    steps: list[dict] = field(default_factory=list)
    expected_results: str = ""
    priority: str = "medium"
    tags: list[str] = field(default_factory=list)
    execution_type: str = "browser"


@dataclass
class PageAnalysis:
    """AI analysis of a page."""

    url: str
    title: str
    description: str
    elements: list[dict] = field(default_factory=list)
    suggested_tests: list[GeneratedTest] = field(default_factory=list)
    issues: list[dict] = field(default_factory=list)


@dataclass
class FailureAnalysis:
    """AI analysis of a test failure."""

    summary: str
    likely_root_cause: str
    suggested_fix: str
    confidence: float


class AIService:
    """Service for AI-powered test generation and analysis."""

    def __init__(self):
        self.settings = get_settings()
        self._client = None

    def _get_client(self):
        """Get Anthropic client (lazy initialization)."""
        if self._client is None and self.settings.anthropic_api_key:
            import anthropic
            self._client = anthropic.Anthropic(api_key=self.settings.anthropic_api_key)
        return self._client

    def is_available(self) -> bool:
        """Check if AI service is available."""
        return self.settings.anthropic_api_key is not None

    def analyze_page_screenshot(
        self, screenshot_base64: str, url: str, html: Optional[str] = None
    ) -> PageAnalysis:
        """Analyze a page screenshot and generate test suggestions."""
        client = self._get_client()

        if not client:
            return PageAnalysis(
                url=url,
                title="Analysis Unavailable",
                description="ANTHROPIC_API_KEY not configured",
                issues=[{
                    "type": "config",
                    "message": "AI features require ANTHROPIC_API_KEY",
                    "severity": "warning"
                }],
            )

        try:
            response = client.messages.create(
                model="claude-sonnet-4-20250514",
                max_tokens=4096,
                messages=[{
                    "role": "user",
                    "content": [
                        {
                            "type": "image",
                            "source": {
                                "type": "base64",
                                "media_type": "image/png",
                                "data": screenshot_base64,
                            },
                        },
                        {
                            "type": "text",
                            "text": f"""Analyze this screenshot of a web page at URL: {url}

Provide a JSON response:
{{
  "url": "{url}",
  "title": "Page title",
  "description": "What this page does",
  "elements": [
    {{"type": "button|input|link|form|navigation", "text": "text", "selector": "CSS selector", "isInteractive": true}}
  ],
  "suggestedTests": [
    {{
      "title": "Test title",
      "description": "What to verify",
      "preconditions": "Setup needed",
      "steps": [{{"action": "click|type|navigate|verify", "selector": "CSS", "value": "optional", "expected": "result"}}],
      "expectedResults": "What should happen",
      "priority": "critical|high|medium|low",
      "tags": ["smoke", "functional"],
      "executionType": "browser"
    }}
  ],
  "issues": [
    {{"type": "accessibility|usability|functionality", "message": "Issue", "severity": "error|warning|info"}}
  ]
}}

Focus on critical user flows and obvious issues. Return ONLY valid JSON.""",
                        },
                    ],
                }],
            )

            content = response.content[0]
            if content.type == "text":
                json_match = content.text
                if "{" in json_match:
                    json_str = json_match[json_match.index("{"):json_match.rindex("}") + 1]
                    data = json.loads(json_str)

                    return PageAnalysis(
                        url=data.get("url", url),
                        title=data.get("title", ""),
                        description=data.get("description", ""),
                        elements=data.get("elements", []),
                        suggested_tests=[
                            GeneratedTest(**t) for t in data.get("suggestedTests", [])
                        ],
                        issues=data.get("issues", []),
                    )

        except Exception as e:
            print(f"AI analysis failed: {e}")

        return PageAnalysis(
            url=url,
            title="Analysis Failed",
            description="Could not analyze page",
            issues=[{"type": "error", "message": str(e), "severity": "error"}],
        )

    def generate_tests_from_requirements(
        self, requirements: str, context: Optional[str] = None
    ) -> list[GeneratedTest]:
        """Generate test cases from requirements text."""
        client = self._get_client()

        if not client:
            return []

        try:
            prompt = f"""Generate test cases from these requirements:

{requirements}

{f"Context: {context}" if context else ""}

Return a JSON array:
[
  {{
    "title": "Test case title",
    "description": "Detailed description",
    "preconditions": "Required setup",
    "steps": [{{"action": "click|type|navigate|verify|api_call", "selector": "element", "value": "input", "expected": "result"}}],
    "expectedResults": "Pass criteria",
    "priority": "critical|high|medium|low",
    "tags": ["functional", "smoke"],
    "executionType": "browser|api|manual|visual"
  }}
]

Include happy path, edge cases, negative tests, and security considerations.
Return ONLY valid JSON array."""

            response = client.messages.create(
                model="claude-sonnet-4-20250514",
                max_tokens=4096,
                messages=[{"role": "user", "content": prompt}],
            )

            content = response.content[0]
            if content.type == "text":
                json_str = content.text
                if "[" in json_str:
                    json_str = json_str[json_str.index("["):json_str.rindex("]") + 1]
                    data = json.loads(json_str)
                    return [GeneratedTest(**t) for t in data]

        except Exception as e:
            print(f"Test generation failed: {e}")

        return []

    def analyze_test_failure(
        self,
        test_title: str,
        steps: list[dict],
        expected: str,
        actual: str,
        screenshot_base64: Optional[str] = None,
        logs: Optional[str] = None,
    ) -> FailureAnalysis:
        """Analyze a test failure and suggest fixes."""
        client = self._get_client()

        if not client:
            return FailureAnalysis(
                summary="AI analysis unavailable",
                likely_root_cause="Unknown - configure ANTHROPIC_API_KEY",
                suggested_fix="Enable AI for detailed analysis",
                confidence=0,
            )

        try:
            content = []

            if screenshot_base64:
                content.append({
                    "type": "image",
                    "source": {
                        "type": "base64",
                        "media_type": "image/png",
                        "data": screenshot_base64,
                    },
                })

            content.append({
                "type": "text",
                "text": f"""Analyze this test failure:

Test: {test_title}
Expected: {expected}
Actual: {actual}
Steps: {json.dumps(steps)}
{f"Logs: {logs}" if logs else ""}

Return JSON:
{{
  "summary": "Brief failure summary",
  "likely_root_cause": "Most probable cause",
  "suggested_fix": "Recommended fix",
  "confidence": 0.0-1.0
}}

Return ONLY valid JSON.""",
            })

            response = client.messages.create(
                model="claude-sonnet-4-20250514",
                max_tokens=1024,
                messages=[{"role": "user", "content": content}],
            )

            resp_content = response.content[0]
            if resp_content.type == "text":
                json_str = resp_content.text
                if "{" in json_str:
                    json_str = json_str[json_str.index("{"):json_str.rindex("}") + 1]
                    data = json.loads(json_str)
                    return FailureAnalysis(
                        summary=data.get("summary", ""),
                        likely_root_cause=data.get("likely_root_cause", ""),
                        suggested_fix=data.get("suggested_fix", ""),
                        confidence=data.get("confidence", 0),
                    )

        except Exception as e:
            print(f"Failure analysis failed: {e}")

        return FailureAnalysis(
            summary="Analysis failed",
            likely_root_cause="Unknown",
            suggested_fix="Manual investigation required",
            confidence=0,
        )


# Singleton instance
_ai_service: Optional[AIService] = None


def get_ai_service() -> AIService:
    """Get AI service singleton."""
    global _ai_service
    if _ai_service is None:
        _ai_service = AIService()
    return _ai_service
