"""Tests for the security module (app.core.security).

Covers:
- Password hashing and verification
- JWT token creation, decoding, and expiration
- Intake code generation and verification
- PIN generation format
- Role hierarchy ordering
- get_current_user dependency with valid/invalid/missing tokens
"""

import re
from datetime import timedelta, datetime, timezone
from unittest.mock import AsyncMock, MagicMock

import pytest
from fastapi import HTTPException
from jose import jwt as jose_jwt

from app.config import settings
from app.core.security import (
    ROLES,
    _role_rank,
    create_access_token,
    decode_access_token,
    generate_intake_code,
    generate_pin,
    get_current_user,
    hash_intake_code,
    hash_password,
    require_admin,
    require_editor_or_above,
    require_viewer_or_above,
    verify_intake_code,
    verify_password,
)


# =========================================================================
# Password hashing
# =========================================================================


class TestPasswordHashing:
    def test_hash_and_verify_correct(self):
        plain = "my-secret-password"
        hashed = hash_password(plain)
        assert hashed != plain
        assert verify_password(plain, hashed) is True

    def test_verify_wrong_password(self):
        hashed = hash_password("correct-password")
        assert verify_password("wrong-password", hashed) is False

    def test_hash_is_different_each_time(self):
        """Bcrypt salts should ensure unique hashes."""
        h1 = hash_password("same")
        h2 = hash_password("same")
        assert h1 != h2

    def test_empty_password(self):
        hashed = hash_password("")
        assert verify_password("", hashed) is True
        assert verify_password("notempty", hashed) is False


# =========================================================================
# Intake code generation and verification
# =========================================================================


class TestIntakeCode:
    def test_generate_returns_tuple(self):
        plain, hashed = generate_intake_code()
        assert isinstance(plain, str)
        assert isinstance(hashed, str)
        assert len(plain) == 6

    def test_code_is_alphanumeric_uppercase(self):
        for _ in range(20):
            plain, _ = generate_intake_code()
            assert plain == plain.upper()
            assert plain.isalnum()

    def test_hash_and_verify(self):
        plain, hashed = generate_intake_code()
        assert verify_intake_code(plain, hashed) is True

    def test_verify_wrong_code(self):
        _, hashed = generate_intake_code()
        assert verify_intake_code("ZZZZZZ", hashed) is False

    def test_case_insensitive_verification(self):
        plain, hashed = generate_intake_code()
        assert verify_intake_code(plain.lower(), hashed) is True

    def test_hash_intake_code_standalone(self):
        hashed = hash_intake_code("ABC123")
        assert verify_intake_code("ABC123", hashed) is True
        assert verify_intake_code("abc123", hashed) is True

    def test_codes_are_unique(self):
        codes = set()
        for _ in range(50):
            plain, _ = generate_intake_code()
            codes.add(plain)
        # With 36^6 possibilities, 50 codes should be unique
        assert len(codes) == 50


# =========================================================================
# PIN generation
# =========================================================================


class TestPinGeneration:
    def test_format(self):
        for _ in range(20):
            pin = generate_pin()
            assert len(pin) == 4
            assert pin.isdigit()

    def test_leading_zeros_preserved(self):
        """PINs like 0042 should remain as strings with leading zeros."""
        # Run many times to increase chance of getting a small number
        pins = [generate_pin() for _ in range(500)]
        # All should be exactly 4 chars
        assert all(len(p) == 4 for p in pins)


# =========================================================================
# JWT tokens
# =========================================================================


class TestJWTTokens:
    def test_create_and_decode(self):
        data = {"sub": "user-123", "accountId": "acc-456", "email": "a@b.com", "role": "admin"}
        token = create_access_token(data)
        decoded = decode_access_token(token)
        assert decoded["sub"] == "user-123"
        assert decoded["accountId"] == "acc-456"
        assert "exp" in decoded
        assert "iat" in decoded

    def test_custom_expiry(self):
        token = create_access_token(
            {"sub": "u1"},
            expires_delta=timedelta(minutes=5),
        )
        decoded = decode_access_token(token)
        exp = datetime.fromtimestamp(decoded["exp"], tz=timezone.utc)
        iat = datetime.fromtimestamp(decoded["iat"], tz=timezone.utc)
        diff = (exp - iat).total_seconds()
        assert 250 < diff < 350  # ~5 minutes with some clock tolerance

    def test_default_expiry(self):
        token = create_access_token({"sub": "u1"})
        decoded = decode_access_token(token)
        exp = datetime.fromtimestamp(decoded["exp"], tz=timezone.utc)
        iat = datetime.fromtimestamp(decoded["iat"], tz=timezone.utc)
        diff = (exp - iat).total_seconds() / 60
        assert abs(diff - settings.access_token_expire_minutes) < 2

    def test_expired_token_raises(self):
        token = create_access_token(
            {"sub": "u1"},
            expires_delta=timedelta(seconds=-10),
        )
        from jose import JWTError
        with pytest.raises(JWTError):
            decode_access_token(token)

    def test_tampered_token_raises(self):
        token = create_access_token({"sub": "u1"})
        tampered = token + "X"
        from jose import JWTError
        with pytest.raises(JWTError):
            decode_access_token(tampered)

    def test_data_not_mutated(self):
        """Ensure the original data dict is not modified."""
        data = {"sub": "u1"}
        create_access_token(data)
        assert "exp" not in data
        assert "iat" not in data


# =========================================================================
# Role hierarchy
# =========================================================================


class TestRoleHierarchy:
    def test_role_ordering(self):
        assert ROLES == ("external_contributor", "viewer", "editor", "admin")
        assert _role_rank("external_contributor") < _role_rank("viewer")
        assert _role_rank("viewer") < _role_rank("editor")
        assert _role_rank("editor") < _role_rank("admin")

    def test_unknown_role_returns_negative(self):
        assert _role_rank("bogus") == -1

    def test_admin_has_highest_rank(self):
        assert _role_rank("admin") == 3


# =========================================================================
# get_current_user dependency
# =========================================================================


class TestGetCurrentUser:
    async def test_valid_token(self):
        token = create_access_token({
            "sub": "user-1",
            "accountId": "acc-1",
            "email": "a@b.com",
            "role": "admin",
            "name": "Admin",
        })
        creds = MagicMock()
        creds.credentials = token
        user = await get_current_user(creds)
        assert user["userId"] == "user-1"
        assert user["accountId"] == "acc-1"
        assert user["role"] == "admin"

    async def test_expired_token_raises_401(self):
        token = create_access_token(
            {"sub": "user-1", "accountId": "acc-1"},
            expires_delta=timedelta(seconds=-10),
        )
        creds = MagicMock()
        creds.credentials = token
        with pytest.raises(HTTPException) as exc_info:
            await get_current_user(creds)
        assert exc_info.value.status_code == 401

    async def test_no_sub_raises_401(self):
        # Manually create a token without "sub"
        payload = {
            "accountId": "acc-1",
            "exp": datetime.now(timezone.utc) + timedelta(hours=1),
            "iat": datetime.now(timezone.utc),
        }
        token = jose_jwt.encode(
            payload, settings.jwt_secret_key, algorithm=settings.jwt_algorithm
        )
        creds = MagicMock()
        creds.credentials = token
        with pytest.raises(HTTPException) as exc_info:
            await get_current_user(creds)
        assert exc_info.value.status_code == 401

    async def test_no_account_id_raises_401(self):
        token = create_access_token({"sub": "user-1"})
        creds = MagicMock()
        creds.credentials = token
        with pytest.raises(HTTPException) as exc_info:
            await get_current_user(creds)
        assert exc_info.value.status_code == 401

    async def test_garbage_token_raises_401(self):
        creds = MagicMock()
        creds.credentials = "totally.not.a.jwt"
        with pytest.raises(HTTPException) as exc_info:
            await get_current_user(creds)
        assert exc_info.value.status_code == 401


# =========================================================================
# Role-based dependencies
# =========================================================================


class TestRoleBasedDependencies:
    async def _make_user_with_role(self, role: str) -> dict:
        """Helper that calls the dependency with a token of the given role."""
        token = create_access_token({
            "sub": "user-1",
            "accountId": "acc-1",
            "email": "a@b.com",
            "role": role,
            "name": "Test",
        })
        creds = MagicMock()
        creds.credentials = token
        return await get_current_user(creds)

    async def test_require_admin_allows_admin(self):
        user = await self._make_user_with_role("admin")
        result = await require_admin(user)
        assert result["role"] == "admin"

    async def test_require_admin_rejects_editor(self):
        user = await self._make_user_with_role("editor")
        with pytest.raises(HTTPException) as exc_info:
            await require_admin(user)
        assert exc_info.value.status_code == 403

    async def test_require_admin_rejects_viewer(self):
        user = await self._make_user_with_role("viewer")
        with pytest.raises(HTTPException) as exc_info:
            await require_admin(user)
        assert exc_info.value.status_code == 403

    async def test_require_editor_allows_admin(self):
        user = await self._make_user_with_role("admin")
        result = await require_editor_or_above(user)
        assert result is not None

    async def test_require_editor_allows_editor(self):
        user = await self._make_user_with_role("editor")
        result = await require_editor_or_above(user)
        assert result["role"] == "editor"

    async def test_require_editor_rejects_viewer(self):
        user = await self._make_user_with_role("viewer")
        with pytest.raises(HTTPException) as exc_info:
            await require_editor_or_above(user)
        assert exc_info.value.status_code == 403

    async def test_require_viewer_allows_viewer(self):
        user = await self._make_user_with_role("viewer")
        result = await require_viewer_or_above(user)
        assert result["role"] == "viewer"

    async def test_require_viewer_rejects_external_contributor(self):
        user = await self._make_user_with_role("external_contributor")
        with pytest.raises(HTTPException) as exc_info:
            await require_viewer_or_above(user)
        assert exc_info.value.status_code == 403
