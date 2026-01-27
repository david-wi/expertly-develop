"""Smoke tests for Vibe QA."""
import pytest
from playwright.sync_api import Page, expect
import requests


BASE_URL = "http://localhost:5173"
API_URL = "http://localhost:8000"


class TestSmoke:
    """Basic smoke tests to verify application is working."""

    def test_api_health(self):
        """Verify API health endpoint responds."""
        response = requests.get(f"{API_URL}/api/v1/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "healthy"

    def test_api_ready(self):
        """Verify API readiness endpoint responds."""
        response = requests.get(f"{API_URL}/api/v1/ready")
        assert response.status_code == 200
        data = response.json()
        assert "database" in data

    def test_homepage_loads(self, page: Page):
        """Verify homepage loads correctly."""
        page.goto(BASE_URL)
        expect(page).to_have_title("Vibe QA - AI-Powered Testing Platform")

    def test_dashboard_elements(self, page: Page):
        """Verify dashboard contains key elements."""
        page.goto(BASE_URL)

        # Should have navigation
        expect(page.locator("text=Dashboard")).to_be_visible()
        expect(page.locator("text=Projects")).to_be_visible()
        expect(page.locator("text=Quick Start")).to_be_visible()

        # Should have quick actions
        expect(page.locator("text=Start Quick Test")).to_be_visible()

    def test_projects_page_loads(self, page: Page):
        """Verify projects page loads."""
        page.goto(f"{BASE_URL}/projects")
        expect(page.locator("h1:has-text('Projects')")).to_be_visible()

    def test_quick_start_page_loads(self, page: Page):
        """Verify quick start page loads."""
        page.goto(f"{BASE_URL}/quick-start")
        expect(page.locator("text=Quick Start")).to_be_visible()
        expect(page.locator("input[type='url']")).to_be_visible()

    def test_can_create_project(self, page: Page):
        """Verify project creation flow."""
        page.goto(f"{BASE_URL}/projects")

        # Click new project button
        page.click("text=New Project")

        # Fill form
        page.fill("input[placeholder='My Project']", "E2E Test Project")
        page.fill("textarea", "Created by E2E test")

        # Submit
        page.click("button:has-text('Create')")

        # Should see the new project
        expect(page.locator("text=E2E Test Project")).to_be_visible()

    def test_navigation_works(self, page: Page):
        """Verify navigation between pages works."""
        page.goto(BASE_URL)

        # Navigate to projects
        page.click("text=Projects")
        expect(page).to_have_url(f"{BASE_URL}/projects")

        # Navigate to quick start
        page.click("text=Quick Start")
        expect(page).to_have_url(f"{BASE_URL}/quick-start")

        # Navigate back to dashboard
        page.click("text=Dashboard")
        expect(page).to_have_url(f"{BASE_URL}/")


@pytest.fixture
def page():
    """Create Playwright page for testing."""
    from playwright.sync_api import sync_playwright

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(viewport={"width": 1280, "height": 720})
        page = context.new_page()
        yield page
        context.close()
        browser.close()
