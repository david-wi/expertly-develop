"""Tests for the security module (app.core.security).

Covers:
- Intake code generation and verification
- PIN generation format
- Role hierarchy ordering
- Role mapping from Identity roles to Intake roles
- Role-based dependencies (require_admin, etc.)
"""

import re
from unittest.mock import AsyncMock, MagicMock

import pytest
from fastapi import HTTPException

from app.core.security import (
    ROLES,
    _map_role,
    _role_rank,
    generate_intake_code,
    generate_pin,
    hash_intake_code,
    require_admin,
    require_editor_or_above,
    require_viewer_or_above,
    verify_intake_code,
)


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
        pins = [generate_pin() for _ in range(500)]
        assert all(len(p) == 4 for p in pins)


# =========================================================================
# Role mapping
# =========================================================================


class TestRoleMapping:
    def test_owner_maps_to_admin(self):
        assert _map_role("owner") == "admin"

    def test_admin_maps_to_admin(self):
        assert _map_role("admin") == "admin"

    def test_member_maps_to_editor(self):
        assert _map_role("member") == "editor"

    def test_viewer_maps_to_viewer(self):
        assert _map_role("viewer") == "viewer"

    def test_unknown_maps_to_viewer(self):
        assert _map_role("unknown_role") == "viewer"


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
# Role-based dependencies
# =========================================================================


class TestRoleBasedDependencies:
    def _make_user_dict(self, role: str) -> dict:
        """Helper that creates a user dict with the given role."""
        return {
            "userId": "user-1",
            "accountId": "acc-1",
            "email": "a@b.com",
            "role": role,
            "name": "Test",
        }

    async def test_require_admin_allows_admin(self):
        user = self._make_user_dict("admin")
        result = await require_admin(user)
        assert result["role"] == "admin"

    async def test_require_admin_rejects_editor(self):
        user = self._make_user_dict("editor")
        with pytest.raises(HTTPException) as exc_info:
            await require_admin(user)
        assert exc_info.value.status_code == 403

    async def test_require_admin_rejects_viewer(self):
        user = self._make_user_dict("viewer")
        with pytest.raises(HTTPException) as exc_info:
            await require_admin(user)
        assert exc_info.value.status_code == 403

    async def test_require_editor_allows_admin(self):
        user = self._make_user_dict("admin")
        result = await require_editor_or_above(user)
        assert result is not None

    async def test_require_editor_allows_editor(self):
        user = self._make_user_dict("editor")
        result = await require_editor_or_above(user)
        assert result["role"] == "editor"

    async def test_require_editor_rejects_viewer(self):
        user = self._make_user_dict("viewer")
        with pytest.raises(HTTPException) as exc_info:
            await require_editor_or_above(user)
        assert exc_info.value.status_code == 403

    async def test_require_viewer_allows_viewer(self):
        user = self._make_user_dict("viewer")
        result = await require_viewer_or_above(user)
        assert result["role"] == "viewer"

    async def test_require_viewer_rejects_external_contributor(self):
        user = self._make_user_dict("external_contributor")
        with pytest.raises(HTTPException) as exc_info:
            await require_viewer_or_above(user)
        assert exc_info.value.status_code == 403
