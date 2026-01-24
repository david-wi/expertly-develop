"""Browser automation service using Playwright."""
import os
import uuid
from dataclasses import dataclass, field
from datetime import datetime
from typing import Optional
from pathlib import Path

from playwright.sync_api import sync_playwright, Browser, Page, BrowserContext

from app.config import get_settings


@dataclass
class PageExploreResult:
    """Result of exploring a single page."""

    url: str
    title: str
    screenshot_base64: str
    screenshot_path: str
    links: list[dict] = field(default_factory=list)
    forms: list[dict] = field(default_factory=list)
    buttons: list[dict] = field(default_factory=list)
    errors: list[str] = field(default_factory=list)
    console_messages: list[str] = field(default_factory=list)
    load_time_ms: int = 0
    dom_content_loaded_ms: int = 0


@dataclass
class StepResult:
    """Result of executing a single test step."""

    step: dict
    status: str  # passed, failed, skipped
    duration_ms: int
    error: Optional[str] = None
    screenshot_base64: Optional[str] = None
    screenshot_path: Optional[str] = None


@dataclass
class TestExecutionResult:
    """Result of executing a test."""

    status: str  # passed, failed
    results: list[StepResult] = field(default_factory=list)
    final_screenshot_base64: Optional[str] = None
    final_screenshot_path: Optional[str] = None
    total_duration_ms: int = 0


class BrowserService:
    """Service for browser automation using Playwright."""

    def __init__(self):
        self.settings = get_settings()
        self._playwright = None
        self._browser: Optional[Browser] = None

    def _ensure_browser(self):
        """Ensure browser is initialized."""
        if self._browser is None:
            self._playwright = sync_playwright().start()
            self._browser = self._playwright.chromium.launch(headless=True)

    def _get_artifacts_dir(self, session_id: Optional[str] = None) -> Path:
        """Get artifacts directory path."""
        base_path = Path(self.settings.artifacts_path)
        if session_id:
            path = base_path / session_id
        else:
            path = base_path / datetime.utcnow().strftime("%Y%m%d")
        path.mkdir(parents=True, exist_ok=True)
        return path

    def _save_screenshot(
        self, page: Page, artifacts_dir: Path, prefix: str = ""
    ) -> tuple[str, str]:
        """Save screenshot and return (base64, path)."""
        filename = f"{prefix}{uuid.uuid4().hex[:8]}.png"
        filepath = artifacts_dir / filename
        screenshot_bytes = page.screenshot(full_page=False)
        filepath.write_bytes(screenshot_bytes)
        import base64
        screenshot_base64 = base64.b64encode(screenshot_bytes).decode()
        return screenshot_base64, str(filepath)

    def explore_page(
        self,
        url: str,
        credentials: Optional[dict] = None,
        session_id: Optional[str] = None,
    ) -> PageExploreResult:
        """Explore a single page and capture information."""
        self._ensure_browser()
        artifacts_dir = self._get_artifacts_dir(session_id)

        context = self._browser.new_context(viewport={"width": 1280, "height": 720})
        page = context.new_page()

        errors = []
        console_messages = []

        page.on("console", lambda msg: console_messages.append(f"[{msg.type}] {msg.text}"))
        page.on("pageerror", lambda err: errors.append(str(err)))

        start_time = datetime.utcnow()
        dom_loaded_time = [0]

        page.on("domcontentloaded", lambda: dom_loaded_time.__setitem__(
            0, int((datetime.utcnow() - start_time).total_seconds() * 1000)
        ))

        try:
            # Handle login if credentials provided
            if credentials and credentials.get("login_url"):
                page.goto(credentials["login_url"], wait_until="networkidle", timeout=30000)
                if credentials.get("username_selector") and credentials.get("username"):
                    page.fill(credentials["username_selector"], credentials["username"])
                if credentials.get("password_selector") and credentials.get("password"):
                    page.fill(credentials["password_selector"], credentials["password"])
                if credentials.get("submit_selector"):
                    page.click(credentials["submit_selector"])
                    page.wait_for_load_state("networkidle")

            # Navigate to target URL
            page.goto(url, wait_until="networkidle", timeout=30000)
            load_time_ms = int((datetime.utcnow() - start_time).total_seconds() * 1000)

            title = page.title()
            screenshot_base64, screenshot_path = self._save_screenshot(
                page, artifacts_dir, "explore_"
            )

            # Extract links
            links = page.evaluate("""() => {
                return Array.from(document.querySelectorAll('a[href]')).slice(0, 50).map(a => ({
                    href: a.href,
                    text: a.textContent?.trim() || ''
                }));
            }""")

            # Extract forms
            forms = page.evaluate("""() => {
                return Array.from(document.querySelectorAll('form')).map(form => ({
                    action: form.action,
                    method: form.method || 'get',
                    inputs: Array.from(form.querySelectorAll('input, textarea, select')).map(input => ({
                        name: input.name,
                        type: input.type || 'text',
                        placeholder: input.placeholder
                    }))
                }));
            }""")

            # Extract buttons
            buttons = page.evaluate("""() => {
                return Array.from(document.querySelectorAll('button, input[type="submit"], [role="button"]'))
                    .slice(0, 20).map((btn, i) => ({
                        text: btn.textContent?.trim() || btn.value || '',
                        selector: btn.id ? '#' + btn.id :
                                  btn.className ? '.' + btn.className.split(' ').join('.') :
                                  'button:nth-of-type(' + (i + 1) + ')'
                    }));
            }""")

            context.close()

            return PageExploreResult(
                url=url,
                title=title,
                screenshot_base64=screenshot_base64,
                screenshot_path=screenshot_path,
                links=links,
                forms=forms,
                buttons=buttons,
                errors=errors[:20],
                console_messages=console_messages[:50],
                load_time_ms=load_time_ms,
                dom_content_loaded_ms=dom_loaded_time[0],
            )

        except Exception as e:
            context.close()
            raise e

    def explore_multiple_pages(
        self,
        start_url: str,
        credentials: Optional[dict] = None,
        max_pages: int = 5,
        session_id: Optional[str] = None,
    ) -> list[PageExploreResult]:
        """Explore multiple pages starting from a URL."""
        from urllib.parse import urlparse

        visited = set()
        results = []
        to_visit = [start_url]
        base_origin = urlparse(start_url).netloc

        while to_visit and len(results) < max_pages:
            url = to_visit.pop(0)

            if url in visited:
                continue

            try:
                parsed = urlparse(url)
                if parsed.netloc != base_origin:
                    continue

                visited.add(url)
                result = self.explore_page(url, credentials, session_id)
                results.append(result)

                # Add discovered links to queue
                for link in result.links:
                    link_url = link.get("href", "")
                    if link_url and link_url not in visited and link_url not in to_visit:
                        try:
                            if urlparse(link_url).netloc == base_origin:
                                to_visit.append(link_url)
                        except Exception:
                            pass

            except Exception as e:
                print(f"Failed to explore {url}: {e}")

        return results

    def execute_test_steps(
        self,
        start_url: str,
        steps: list[dict],
        credentials: Optional[dict] = None,
        session_id: Optional[str] = None,
    ) -> TestExecutionResult:
        """Execute a series of test steps."""
        self._ensure_browser()
        artifacts_dir = self._get_artifacts_dir(session_id)

        context = self._browser.new_context(viewport={"width": 1280, "height": 720})
        page = context.new_page()

        results = []
        overall_status = "passed"
        start_time = datetime.utcnow()

        try:
            # Handle login
            if credentials and credentials.get("login_url"):
                page.goto(credentials["login_url"], wait_until="networkidle")
                if credentials.get("username_selector") and credentials.get("username"):
                    page.fill(credentials["username_selector"], credentials["username"])
                if credentials.get("password_selector") and credentials.get("password"):
                    page.fill(credentials["password_selector"], credentials["password"])
                if credentials.get("submit_selector"):
                    page.click(credentials["submit_selector"])
                    page.wait_for_load_state("networkidle")

            # Navigate to start URL
            page.goto(start_url, wait_until="networkidle")

            # Execute each step
            for step in steps:
                step_start = datetime.utcnow()
                result = StepResult(step=step, status="passed", duration_ms=0)

                try:
                    action = step.get("action", "")
                    selector = step.get("selector")
                    value = step.get("value")
                    expected = step.get("expected")
                    timeout = step.get("timeout", 5000)

                    if action == "navigate":
                        if value:
                            page.goto(value, wait_until="networkidle")

                    elif action == "click":
                        if selector:
                            page.click(selector, timeout=timeout)
                            page.wait_for_load_state("networkidle", timeout=5000)

                    elif action == "type":
                        if selector and value:
                            page.fill(selector, value)

                    elif action == "select":
                        if selector and value:
                            page.select_option(selector, value)

                    elif action == "wait":
                        if selector:
                            page.wait_for_selector(selector, timeout=timeout)
                        else:
                            page.wait_for_timeout(timeout)

                    elif action == "verify":
                        if selector:
                            element = page.query_selector(selector)
                            if not element:
                                raise Exception(f"Element not found: {selector}")
                            if expected:
                                text = element.text_content() or ""
                                if expected not in text:
                                    raise Exception(f"Expected '{expected}' not found in '{text}'")

                    elif action == "screenshot":
                        result.screenshot_base64, result.screenshot_path = self._save_screenshot(
                            page, artifacts_dir, "step_"
                        )

                except Exception as e:
                    result.status = "failed"
                    result.error = str(e)
                    overall_status = "failed"

                    # Capture failure screenshot
                    try:
                        result.screenshot_base64, result.screenshot_path = self._save_screenshot(
                            page, artifacts_dir, "failure_"
                        )
                    except Exception:
                        pass

                result.duration_ms = int((datetime.utcnow() - step_start).total_seconds() * 1000)
                results.append(result)

                if result.status == "failed":
                    break

            # Final screenshot
            final_base64 = None
            final_path = None
            try:
                final_base64, final_path = self._save_screenshot(page, artifacts_dir, "final_")
            except Exception:
                pass

            context.close()

            return TestExecutionResult(
                status=overall_status,
                results=results,
                final_screenshot_base64=final_base64,
                final_screenshot_path=final_path,
                total_duration_ms=int((datetime.utcnow() - start_time).total_seconds() * 1000),
            )

        except Exception as e:
            context.close()
            return TestExecutionResult(
                status="failed",
                results=results,
                total_duration_ms=int((datetime.utcnow() - start_time).total_seconds() * 1000),
            )

    def close(self):
        """Close browser and cleanup."""
        if self._browser:
            self._browser.close()
            self._browser = None
        if self._playwright:
            self._playwright.stop()
            self._playwright = None


# Singleton instance
_browser_service: Optional[BrowserService] = None


def get_browser_service() -> BrowserService:
    """Get browser service singleton."""
    global _browser_service
    if _browser_service is None:
        _browser_service = BrowserService()
    return _browser_service
