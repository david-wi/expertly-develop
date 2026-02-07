"""Tests for authentication routes (app/api/v1/auth.py).

Covers:
- GET /api/v1/me — returns user info from Identity session
- GET /api/v1/auth/identity-urls — returns Identity login/logout URLs
- Unauthenticated requests return 401
"""

import pytest

from app.tests.conftest import (
    ACCOUNT_ID,
    USER_ID,
    auth_headers,
)


# =========================================================================
# GET /api/v1/me
# =========================================================================


class TestGetMe:
    async def test_me_success(self, client, admin_token):
        """Authenticated user can fetch their own profile."""
        resp = await client.get("/api/v1/me", headers=auth_headers(admin_token))
        assert resp.status_code == 200
        data = resp.json()
        assert data["email"] == "admin@test.com"
        assert data["userId"] == USER_ID
        assert data["accountId"] == ACCOUNT_ID
        assert data["role"] == "admin"  # owner maps to admin
        assert data["name"] == "Test Admin"

    async def test_me_no_auth(self, client):
        """Missing session returns 401."""
        resp = await client.get("/api/v1/me")
        assert resp.status_code == 401


# =========================================================================
# GET /api/v1/auth/identity-urls
# =========================================================================


class TestIdentityUrls:
    async def test_returns_urls(self, client):
        """Returns login and logout URLs for the Identity service."""
        resp = await client.get("/api/v1/auth/identity-urls")
        assert resp.status_code == 200
        data = resp.json()
        assert "loginUrl" in data
        assert "logoutUrl" in data
        assert "/login" in data["loginUrl"]
        assert "/logout" in data["logoutUrl"]
