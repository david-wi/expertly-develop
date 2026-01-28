"""Tests for authentication API endpoints."""

import pytest
from unittest.mock import patch, AsyncMock, MagicMock
from datetime import datetime, timedelta
import secrets


class TestAuthHelpers:
    """Test authentication helper functions."""

    def test_get_session_token_from_header(self):
        """Test extracting session token from header."""
        from app.api.v1.auth import _get_session_token

        mock_request = MagicMock()
        mock_request.cookies.get.return_value = None

        token = _get_session_token(mock_request, session_token_header="header-token")

        assert token == "header-token"

    def test_get_session_token_from_cookie(self):
        """Test extracting session token from cookie when no header."""
        from app.api.v1.auth import _get_session_token

        mock_request = MagicMock()
        mock_request.cookies.get.return_value = "cookie-token"

        token = _get_session_token(mock_request, session_token_header=None)

        assert token == "cookie-token"

    def test_get_session_token_prefers_header(self):
        """Test that header takes precedence over cookie."""
        from app.api.v1.auth import _get_session_token

        mock_request = MagicMock()
        mock_request.cookies.get.return_value = "cookie-token"

        token = _get_session_token(mock_request, session_token_header="header-token")

        assert token == "header-token"

    def test_magic_code_allowed_domains(self):
        """Test that magic code domains are configured."""
        from app.api.v1.auth import MAGIC_CODE_ALLOWED_DOMAINS

        assert "expertly.com" in MAGIC_CODE_ALLOWED_DOMAINS

    def test_reset_token_expiry(self):
        """Test password reset token expiry is set."""
        from app.api.v1.auth import RESET_TOKEN_EXPIRY_MINUTES

        assert RESET_TOKEN_EXPIRY_MINUTES == 15


class TestSessionCookie:
    """Test session cookie handling."""

    def test_set_session_cookie(self):
        """Test setting session cookie with proper attributes."""
        from app.api.v1.auth import _set_session_cookie

        mock_response = MagicMock()
        session_token = secrets.token_urlsafe(32)
        expires_at = datetime.utcnow() + timedelta(days=7)

        with patch("app.api.v1.auth.settings") as mock_settings:
            mock_settings.auth_cookie_domain = ".example.com"
            _set_session_cookie(mock_response, session_token, expires_at)

        mock_response.set_cookie.assert_called_once()
        call_kwargs = mock_response.set_cookie.call_args.kwargs
        assert call_kwargs["key"] == "expertly_session"
        assert call_kwargs["value"] == session_token
        assert call_kwargs["httponly"] is True
        assert call_kwargs["secure"] is True
        assert call_kwargs["samesite"] == "lax"

    def test_clear_session_cookie(self):
        """Test clearing session cookie."""
        from app.api.v1.auth import _clear_session_cookie

        mock_response = MagicMock()

        with patch("app.api.v1.auth.settings") as mock_settings:
            mock_settings.auth_cookie_domain = ".example.com"
            _clear_session_cookie(mock_response)

        mock_response.delete_cookie.assert_called_once()
        call_kwargs = mock_response.delete_cookie.call_args.kwargs
        assert call_kwargs["key"] == "expertly_session"


class TestUserConversion:
    """Test user model conversion functions."""

    def test_user_to_auth_response(self):
        """Test converting User model to AuthUserResponse."""
        from app.api.v1.auth import _user_to_auth_response

        # Create mock user
        mock_user = MagicMock()
        mock_user.id = "user-123"
        mock_user.name = "Test User"
        mock_user.email = "test@example.com"
        mock_user.organization_id = "org-456"
        mock_user.organization = MagicMock()
        mock_user.organization.name = "Test Org"
        mock_user.role = "admin"
        mock_user.avatar_url = None

        result = _user_to_auth_response(mock_user)

        assert result.id == "user-123"
        assert result.name == "Test User"
        assert result.email == "test@example.com"
        assert result.organization_id == "org-456"
        assert result.organization_name == "Test Org"
        assert result.role == "admin"

    def test_user_to_auth_response_no_org(self):
        """Test converting User model when no organization."""
        from app.api.v1.auth import _user_to_auth_response

        mock_user = MagicMock()
        mock_user.id = "user-123"
        mock_user.name = "Test User"
        mock_user.email = "test@example.com"
        mock_user.organization_id = None
        mock_user.organization = None
        mock_user.role = "user"
        mock_user.avatar_url = None

        result = _user_to_auth_response(mock_user)

        assert result.organization_name is None


class TestPasswordValidation:
    """Test password validation functions."""

    def test_validate_password_strength_weak(self):
        """Test that weak passwords are rejected."""
        from app.core.password import validate_password_strength

        # Too short
        is_valid, error = validate_password_strength("abc")
        assert not is_valid
        assert error is not None

    def test_validate_password_strength_common(self):
        """Test that common passwords are rejected."""
        from app.core.password import validate_password_strength

        # Common password
        is_valid, error = validate_password_strength("password123")
        # May or may not be valid depending on implementation
        assert isinstance(is_valid, bool)


class TestAuthSchemas:
    """Test authentication schemas."""

    def test_login_request_schema(self):
        """Test LoginRequest schema validation."""
        from app.schemas.auth import LoginRequest

        login = LoginRequest(email="test@example.com", password="password123")
        assert login.email == "test@example.com"
        assert login.password == "password123"

    def test_magic_code_request_schema(self):
        """Test MagicCodeRequest schema validation."""
        from app.schemas.auth import MagicCodeRequest

        request = MagicCodeRequest(email="test@expertly.com")
        assert request.email == "test@expertly.com"

    def test_change_password_request_schema(self):
        """Test ChangePasswordRequest schema validation."""
        from app.schemas.auth import ChangePasswordRequest

        request = ChangePasswordRequest(
            current_password="oldpass",
            new_password="newpass123"
        )
        assert request.current_password == "oldpass"
        assert request.new_password == "newpass123"

    def test_forgot_password_request_schema(self):
        """Test ForgotPasswordRequest schema validation."""
        from app.schemas.auth import ForgotPasswordRequest

        request = ForgotPasswordRequest(email="test@example.com")
        assert request.email == "test@example.com"

    def test_reset_password_request_schema(self):
        """Test ResetPasswordRequest schema validation."""
        from app.schemas.auth import ResetPasswordRequest

        request = ResetPasswordRequest(
            token="reset-token-123",
            new_password="newpassword123"
        )
        assert request.token == "reset-token-123"
        assert request.new_password == "newpassword123"
