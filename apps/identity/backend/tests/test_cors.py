"""Tests for CORS configuration.

Regression test: TMS username was not appearing in the sidebar because
tms.ai.devintensive.com was missing from the identity API's CORS allowed
origins, causing the getCurrentUser fetch to be silently blocked by the browser.
"""

from app.main import app
from starlette.middleware.cors import CORSMiddleware


def _get_cors_origins() -> list[str]:
    """Extract the allowed origins from the app's CORS middleware."""
    for middleware in app.user_middleware:
        if middleware.cls is CORSMiddleware:
            return list(middleware.kwargs.get("allow_origins", []))
    raise AssertionError("CORSMiddleware not found on app")


class TestCORSConfiguration:
    """Verify CORS is configured for all deployed Expertly apps."""

    # All deployed Expertly apps that need identity API access
    REQUIRED_ORIGINS = [
        "https://define.ai.devintensive.com",
        "https://develop.ai.devintensive.com",
        "https://identity.ai.devintensive.com",
        "https://command.ai.devintensive.com",
        "https://manage.ai.devintensive.com",
        "https://today.ai.devintensive.com",
        "https://admin.ai.devintensive.com",
        "https://salon.ai.devintensive.com",
        "https://vibecode.ai.devintensive.com",
        "https://vibetest.ai.devintensive.com",
        "https://tms.ai.devintensive.com",
        "https://aipocalypse.ai.devintensive.com",
    ]

    def test_all_deployed_apps_in_cors_origins(self):
        """Every deployed Expertly app must be in the CORS allowed origins.

        If this test fails after adding a new app, add its origin to both
        the CORS allow_origins list in app/main.py AND this test's
        REQUIRED_ORIGINS list.
        """
        origins = _get_cors_origins()
        missing = [o for o in self.REQUIRED_ORIGINS if o not in origins]
        assert not missing, (
            f"These deployed app origins are missing from CORS config: {missing}. "
            f"Add them to allow_origins in apps/identity/backend/app/main.py"
        )

    def test_tms_origin_present(self):
        """Regression: TMS must be in CORS origins for sidebar user to load."""
        origins = _get_cors_origins()
        assert "https://tms.ai.devintensive.com" in origins, (
            "TMS origin missing from CORS config - this will break the user "
            "display in the TMS sidebar"
        )

    def test_credentials_allowed(self):
        """CORS must allow credentials for session cookies to be sent."""
        for middleware in app.user_middleware:
            if middleware.cls is CORSMiddleware:
                assert middleware.kwargs.get("allow_credentials") is True, (
                    "allow_credentials must be True for cookie-based auth"
                )
                return
        raise AssertionError("CORSMiddleware not found")

    def test_localhost_origins_for_development(self):
        """Localhost origins must be present for local development."""
        origins = _get_cors_origins()
        assert "http://localhost:5173" in origins, "Vite dev server origin missing"
