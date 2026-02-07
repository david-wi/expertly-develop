"""Tests for authentication and user management routes (app/api/v1/auth.py).

Covers:
- POST /api/v1/auth/login with valid and invalid credentials
- GET /api/v1/me with valid and expired tokens
- GET /api/v1/accounts/current
- POST /api/v1/users (admin only)
- GET /api/v1/users (list users)
"""

from datetime import datetime, timezone
from unittest.mock import AsyncMock, patch

import pytest
from bson import ObjectId

from app.core.security import hash_password
from app.tests.conftest import (
    ACCOUNT_ID,
    USER_ID,
    auth_headers,
    make_account_doc,
    make_user_doc,
)


# =========================================================================
# POST /api/v1/auth/login
# =========================================================================


class TestLogin:
    async def test_login_success(self, client, mock_collections):
        """Valid email/password returns a JWT token and user info."""
        password = "correct-password"
        user_doc = make_user_doc(
            email="admin@test.com",
            password_hash=hash_password(password),
        )
        mock_collections["users"].find_one = AsyncMock(return_value=user_doc)
        mock_collections["users"].update_one = AsyncMock()

        resp = await client.post(
            "/api/v1/auth/login",
            json={"email": "admin@test.com", "password": password},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert "token" in data
        assert data["tokenType"] == "bearer"
        assert data["user"]["email"] == "admin@test.com"

    async def test_login_wrong_password(self, client, mock_collections):
        """Wrong password returns 401."""
        user_doc = make_user_doc(password_hash=hash_password("real-password"))
        mock_collections["users"].find_one = AsyncMock(return_value=user_doc)

        resp = await client.post(
            "/api/v1/auth/login",
            json={"email": "admin@test.com", "password": "wrong"},
        )
        assert resp.status_code == 401
        assert "Invalid email or password" in resp.json()["detail"]

    async def test_login_unknown_email(self, client, mock_collections):
        """Non-existent email returns 401."""
        mock_collections["users"].find_one = AsyncMock(return_value=None)

        resp = await client.post(
            "/api/v1/auth/login",
            json={"email": "nobody@test.com", "password": "anything"},
        )
        assert resp.status_code == 401

    async def test_login_missing_fields(self, client, mock_collections):
        """Missing email or password returns 422."""
        resp = await client.post("/api/v1/auth/login", json={"email": "a@b.com"})
        assert resp.status_code == 422

    async def test_login_invalid_email_format(self, client, mock_collections):
        """Invalid email format returns 422."""
        resp = await client.post(
            "/api/v1/auth/login",
            json={"email": "not-an-email", "password": "pass"},
        )
        assert resp.status_code == 422


# =========================================================================
# GET /api/v1/me
# =========================================================================


class TestGetMe:
    async def test_me_success(self, client, mock_collections, admin_token):
        """Authenticated user can fetch their own profile."""
        user_doc = make_user_doc()
        mock_collections["users"].find_one = AsyncMock(return_value=user_doc)

        resp = await client.get("/api/v1/me", headers=auth_headers(admin_token))
        assert resp.status_code == 200
        data = resp.json()
        assert data["email"] == "admin@test.com"
        assert data["userId"] == USER_ID

    async def test_me_expired_token(self, client, mock_collections, expired_token):
        """Expired token returns 401 (via HTTPBearer auto_error)."""
        resp = await client.get("/api/v1/me", headers=auth_headers(expired_token))
        assert resp.status_code == 401

    async def test_me_no_token(self, client, mock_collections):
        """Missing Authorization header returns 401 or 403."""
        resp = await client.get("/api/v1/me")
        assert resp.status_code in (401, 403)

    async def test_me_user_not_found(self, client, mock_collections, admin_token):
        """Valid token but user missing from DB returns 404."""
        mock_collections["users"].find_one = AsyncMock(return_value=None)

        resp = await client.get("/api/v1/me", headers=auth_headers(admin_token))
        assert resp.status_code == 404


# =========================================================================
# GET /api/v1/accounts/current
# =========================================================================


class TestGetCurrentAccount:
    async def test_success(self, client, mock_collections, admin_token):
        """Authenticated user can fetch their account info."""
        account_doc = make_account_doc()
        mock_collections["accounts"].find_one = AsyncMock(return_value=account_doc)

        resp = await client.get(
            "/api/v1/accounts/current", headers=auth_headers(admin_token)
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["accountName"] == "Test Account"
        assert data["accountId"] == ACCOUNT_ID

    async def test_account_not_found(self, client, mock_collections, admin_token):
        """Valid token but account missing from DB returns 404."""
        mock_collections["accounts"].find_one = AsyncMock(return_value=None)

        resp = await client.get(
            "/api/v1/accounts/current", headers=auth_headers(admin_token)
        )
        assert resp.status_code == 404

    async def test_no_auth(self, client, mock_collections):
        """Unauthenticated request returns 401 or 403."""
        resp = await client.get("/api/v1/accounts/current")
        assert resp.status_code in (401, 403)


# =========================================================================
# POST /api/v1/users (admin only)
# =========================================================================


class TestCreateUser:
    async def test_success(self, client, mock_collections, admin_token):
        """Admin can create a new user."""
        mock_collections["users"].find_one = AsyncMock(return_value=None)  # no duplicate

        new_user_id = ObjectId()
        insert_result = AsyncMock()
        insert_result.inserted_id = new_user_id
        mock_collections["users"].insert_one = AsyncMock(return_value=insert_result)

        resp = await client.post(
            "/api/v1/users",
            json={"email": "new@test.com", "name": "New User", "role": "member"},
            headers=auth_headers(admin_token),
        )
        assert resp.status_code == 201
        data = resp.json()
        assert data["email"] == "new@test.com"
        assert data["name"] == "New User"

    async def test_duplicate_email(self, client, mock_collections, admin_token):
        """Creating a user with an existing email returns 409."""
        existing_user = make_user_doc(email="existing@test.com")
        mock_collections["users"].find_one = AsyncMock(return_value=existing_user)

        resp = await client.post(
            "/api/v1/users",
            json={"email": "existing@test.com", "name": "Dup User"},
            headers=auth_headers(admin_token),
        )
        assert resp.status_code == 409

    async def test_editor_cannot_create(self, client, mock_collections, editor_token):
        """Non-admin role (editor) gets 403."""
        resp = await client.post(
            "/api/v1/users",
            json={"email": "new@test.com", "name": "New"},
            headers=auth_headers(editor_token),
        )
        assert resp.status_code == 403

    async def test_viewer_cannot_create(self, client, mock_collections, viewer_token):
        """Non-admin role (viewer) gets 403."""
        resp = await client.post(
            "/api/v1/users",
            json={"email": "new@test.com", "name": "New"},
            headers=auth_headers(viewer_token),
        )
        assert resp.status_code == 403


# =========================================================================
# GET /api/v1/users
# =========================================================================


class TestListUsers:
    async def test_success(self, client, mock_collections, admin_token):
        """Lists users for the current account."""
        user_docs = [
            make_user_doc(email="user1@test.com", name="User 1"),
            make_user_doc(
                user_id=str(ObjectId()),
                email="user2@test.com",
                name="User 2",
            ),
        ]
        mock_collections["users"].set_find_results(user_docs)

        resp = await client.get("/api/v1/users", headers=auth_headers(admin_token))
        assert resp.status_code == 200
        data = resp.json()
        assert isinstance(data, list)
        assert len(data) == 2

    async def test_empty_list(self, client, mock_collections, admin_token):
        """Returns empty list when no users exist."""
        mock_collections["users"].set_find_results([])

        resp = await client.get("/api/v1/users", headers=auth_headers(admin_token))
        assert resp.status_code == 200
        assert resp.json() == []

    async def test_no_auth(self, client, mock_collections):
        """Unauthenticated request returns 401 or 403."""
        resp = await client.get("/api/v1/users")
        assert resp.status_code in (401, 403)
