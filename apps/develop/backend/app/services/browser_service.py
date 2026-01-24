"""Playwright browser automation service."""

import asyncio
from dataclasses import dataclass
from typing import Callable, List, Optional
from playwright.async_api import async_playwright, Browser, Page, BrowserContext


@dataclass
class Screenshot:
    """Captured screenshot data."""

    step: str
    description: str
    image_data: bytes
    url: str
    timestamp: float


@dataclass
class BrowserSession:
    """Browser session context."""

    browser: Browser
    context: BrowserContext
    page: Page


class BrowserService:
    """Service for headless browser automation with Playwright."""

    def __init__(self):
        self._browser: Optional[Browser] = None
        self._playwright = None

    async def start(self) -> None:
        """Start the browser."""
        if self._browser:
            return

        self._playwright = await async_playwright().start()
        self._browser = await self._playwright.chromium.launch(
            headless=True,
            args=[
                "--disable-gpu",
                "--no-sandbox",
                "--disable-dev-shm-usage",
            ],
        )

    async def stop(self) -> None:
        """Stop the browser."""
        if self._browser:
            await self._browser.close()
            self._browser = None

        if self._playwright:
            await self._playwright.stop()
            self._playwright = None

    async def create_session(
        self,
        viewport_width: int = 1920,
        viewport_height: int = 1080,
    ) -> BrowserSession:
        """Create a new browser session."""
        if not self._browser:
            await self.start()

        context = await self._browser.new_context(
            viewport={"width": viewport_width, "height": viewport_height},
            user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        )

        page = await context.new_page()

        return BrowserSession(
            browser=self._browser,
            context=context,
            page=page,
        )

    async def close_session(self, session: BrowserSession) -> None:
        """Close a browser session."""
        await session.page.close()
        await session.context.close()

    async def login(
        self,
        session: BrowserSession,
        login_url: str,
        username: str,
        password: str,
        username_selector: str,
        password_selector: str,
        submit_selector: str,
        wait_after_login: int = 3000,
    ) -> bool:
        """
        Perform login to a website.

        Returns True if login appears successful.
        """
        page = session.page

        try:
            await page.goto(login_url, wait_until="networkidle")

            # Fill credentials
            await page.fill(username_selector, username)
            await page.fill(password_selector, password)

            # Click submit
            await page.click(submit_selector)

            # Wait for navigation
            await page.wait_for_load_state("networkidle")
            await asyncio.sleep(wait_after_login / 1000)

            return True

        except Exception as e:
            print(f"Login failed: {e}")
            return False

    async def navigate_and_capture(
        self,
        session: BrowserSession,
        url: str,
        step: str,
        description: str,
        wait_time: int = 2000,
    ) -> Screenshot:
        """Navigate to a URL and capture a screenshot."""
        page = session.page
        import time

        await page.goto(url, wait_until="networkidle")
        await asyncio.sleep(wait_time / 1000)

        image_data = await page.screenshot(full_page=False)

        return Screenshot(
            step=step,
            description=description,
            image_data=image_data,
            url=page.url,
            timestamp=time.time(),
        )

    async def capture_current(
        self,
        session: BrowserSession,
        step: str,
        description: str,
    ) -> Screenshot:
        """Capture the current page state."""
        page = session.page
        import time

        image_data = await page.screenshot(full_page=False)

        return Screenshot(
            step=step,
            description=description,
            image_data=image_data,
            url=page.url,
            timestamp=time.time(),
        )

    async def click_and_capture(
        self,
        session: BrowserSession,
        selector: str,
        step: str,
        description: str,
        wait_time: int = 2000,
    ) -> Optional[Screenshot]:
        """Click an element and capture the result."""
        page = session.page
        import time

        try:
            await page.click(selector)
            await page.wait_for_load_state("networkidle")
            await asyncio.sleep(wait_time / 1000)

            image_data = await page.screenshot(full_page=False)

            return Screenshot(
                step=step,
                description=description,
                image_data=image_data,
                url=page.url,
                timestamp=time.time(),
            )

        except Exception as e:
            print(f"Click failed for {selector}: {e}")
            return None

    async def execute_scenario(
        self,
        session: BrowserSession,
        scenario_text: str,
        base_url: str,
        progress_callback: Optional[Callable[[int, str], None]] = None,
    ) -> List[Screenshot]:
        """
        Execute a text-based scenario and capture screenshots.

        Parses simple instructions like:
        - Navigate to /home
        - Click .nav-link
        - Wait 2 seconds
        - Capture "Description"
        """
        screenshots = []
        lines = [l.strip() for l in scenario_text.strip().split("\n") if l.strip()]
        total_steps = len(lines)

        for idx, line in enumerate(lines):
            step_num = idx + 1
            progress = int((step_num / total_steps) * 100)

            if progress_callback:
                progress_callback(progress, f"Step {step_num}: {line[:50]}...")

            # Parse and execute instruction
            line_lower = line.lower()

            if line_lower.startswith("navigate to "):
                path = line[12:].strip()
                url = f"{base_url.rstrip('/')}/{path.lstrip('/')}"
                screenshot = await self.navigate_and_capture(
                    session, url, f"Step {step_num}", f"Navigate to {path}"
                )
                screenshots.append(screenshot)

            elif line_lower.startswith("click "):
                selector = line[6:].strip()
                screenshot = await self.click_and_capture(
                    session, selector, f"Step {step_num}", f"Click {selector}"
                )
                if screenshot:
                    screenshots.append(screenshot)

            elif line_lower.startswith("wait "):
                try:
                    seconds = int(line[5:].split()[0])
                    await asyncio.sleep(seconds)
                except ValueError:
                    await asyncio.sleep(2)

            elif line_lower.startswith("capture "):
                description = line[8:].strip().strip('"').strip("'")
                screenshot = await self.capture_current(
                    session, f"Step {step_num}", description
                )
                screenshots.append(screenshot)

            else:
                # Unknown instruction - capture current state
                screenshot = await self.capture_current(
                    session, f"Step {step_num}", line
                )
                screenshots.append(screenshot)

        return screenshots


# Singleton instance
browser_service = BrowserService()
