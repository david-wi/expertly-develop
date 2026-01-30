"""Tests for connections feature: encryption and OAuth services."""
import pytest
from datetime import datetime, timezone, timedelta
from unittest.mock import patch, AsyncMock, MagicMock
from bson import ObjectId

# Test encryption service
class TestEncryptionService:
    """Tests for token encryption/decryption."""

    def test_encrypt_decrypt_round_trip(self):
        """Test that encryption and decryption are inverse operations."""
        # Mock the settings to provide an encryption key
        with patch('app.services.encryption.get_settings') as mock_settings:
            from cryptography.fernet import Fernet
            # Generate a valid Fernet key for testing
            test_key = Fernet.generate_key().decode()
            mock_settings.return_value.connection_encryption_key = test_key

            from app.services.encryption import encrypt_token, decrypt_token

            original_token = "ya29.a0AfH6SMBxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
            encrypted = encrypt_token(original_token)

            # Encrypted token should be different from original
            assert encrypted != original_token
            # Encrypted token should be a non-empty string
            assert len(encrypted) > 0

            # Decrypt should return original
            decrypted = decrypt_token(encrypted)
            assert decrypted == original_token

    def test_encrypt_empty_token(self):
        """Test that encrypting empty string returns empty string."""
        with patch('app.services.encryption.get_settings') as mock_settings:
            from cryptography.fernet import Fernet
            test_key = Fernet.generate_key().decode()
            mock_settings.return_value.connection_encryption_key = test_key

            from app.services.encryption import encrypt_token, decrypt_token

            assert encrypt_token("") == ""
            assert decrypt_token("") == ""

    def test_generate_encryption_key(self):
        """Test that generate_encryption_key creates valid Fernet key."""
        from app.services.encryption import generate_encryption_key
        from cryptography.fernet import Fernet

        key = generate_encryption_key()
        # Should be a valid base64-encoded 32-byte key
        assert len(key) == 44  # Base64 encoded 32 bytes
        # Should be usable with Fernet
        fernet = Fernet(key.encode())
        test_data = b"test"
        assert fernet.decrypt(fernet.encrypt(test_data)) == test_data


class TestOAuthService:
    """Tests for OAuth URL generation and token management."""

    def test_generate_state(self):
        """Test that state generation creates unique secure strings."""
        from app.services.oauth import generate_state

        state1 = generate_state()
        state2 = generate_state()

        # States should be non-empty
        assert len(state1) > 0
        assert len(state2) > 0
        # States should be unique
        assert state1 != state2
        # Should be URL-safe
        assert all(c.isalnum() or c in '-_' for c in state1)

    def test_build_auth_url_google(self):
        """Test building Google OAuth URL."""
        with patch('app.services.oauth.get_settings') as mock_settings:
            mock_settings.return_value.google_client_id = "test-client-id"
            mock_settings.return_value.google_client_secret = "test-secret"
            mock_settings.return_value.app_base_url = "https://manage.ai.devintensive.com"

            from app.services.oauth import build_auth_url

            state = "test-state-12345"
            url = build_auth_url("google", state)

            # Check URL structure
            assert url.startswith("https://accounts.google.com/o/oauth2/v2/auth?")
            assert "client_id=test-client-id" in url
            assert "state=test-state-12345" in url
            assert "response_type=code" in url
            assert "access_type=offline" in url
            assert "prompt=consent" in url
            # Check redirect URI
            assert "redirect_uri=" in url
            assert "connections%2Foauth%2Fgoogle%2Fcallback" in url

    def test_build_auth_url_unknown_provider(self):
        """Test that unknown provider raises error."""
        with patch('app.services.oauth.get_settings') as mock_settings:
            mock_settings.return_value.app_base_url = "https://example.com"
            mock_settings.return_value.google_client_id = "test-id"
            mock_settings.return_value.google_client_secret = "test-secret"

            from app.services.oauth import build_auth_url

            with pytest.raises(ValueError, match="Unknown OAuth provider"):
                build_auth_url("unknown_provider", "state")

    def test_build_auth_url_unconfigured_provider(self):
        """Test that unconfigured provider raises error."""
        with patch('app.services.oauth.get_settings') as mock_settings:
            mock_settings.return_value.google_client_id = ""
            mock_settings.return_value.google_client_secret = ""
            mock_settings.return_value.app_base_url = "https://example.com"

            from app.services.oauth import build_auth_url

            with pytest.raises(ValueError, match="OAuth credentials not configured"):
                build_auth_url("google", "state")

    def test_calculate_token_expiry(self):
        """Test token expiry calculation."""
        from app.services.oauth import calculate_token_expiry

        # None input returns None
        assert calculate_token_expiry(None) is None

        # Valid expires_in returns future datetime
        expiry = calculate_token_expiry(3600)  # 1 hour
        assert expiry is not None
        assert expiry > datetime.now(timezone.utc)
        # Should be approximately 1 hour from now (within 5 seconds)
        expected = datetime.now(timezone.utc) + timedelta(seconds=3600)
        assert abs((expiry - expected).total_seconds()) < 5


class TestConnectionModel:
    """Tests for Connection model."""

    def test_connection_model_creation(self):
        """Test creating a Connection model."""
        from app.models.connection import Connection, ConnectionProvider, ConnectionStatus

        connection = Connection(
            user_id=ObjectId(),
            organization_id=ObjectId(),
            provider=ConnectionProvider.GOOGLE,
            provider_user_id="123456789",
            provider_email="user@gmail.com",
            access_token_encrypted="encrypted_access_token",
            refresh_token_encrypted="encrypted_refresh_token",
            token_expires_at=datetime.now(timezone.utc) + timedelta(hours=1),
            scopes=["gmail.readonly", "drive.readonly"],
            status=ConnectionStatus.ACTIVE,
        )

        assert connection.provider == ConnectionProvider.GOOGLE
        assert connection.status == ConnectionStatus.ACTIVE
        assert "gmail.readonly" in connection.scopes

    def test_connection_response_serialization(self):
        """Test ConnectionResponse doesn't expose tokens."""
        from app.models.connection import ConnectionResponse

        response = ConnectionResponse(
            id="conn-123",
            provider="google",
            provider_email="user@gmail.com",
            status="active",
            scopes=["gmail.readonly"],
            connected_at=datetime.now(timezone.utc),
        )

        data = response.model_dump()
        # Should not have any token fields
        assert "access_token" not in data
        assert "refresh_token" not in data
        assert "access_token_encrypted" not in data
        # Should have safe fields
        assert data["provider"] == "google"
        assert data["provider_email"] == "user@gmail.com"


class TestOAuthTokenExchange:
    """Tests for OAuth token exchange (async)."""

    @pytest.mark.asyncio
    async def test_exchange_code_for_tokens_success(self):
        """Test successful token exchange."""
        with patch('app.services.oauth.get_settings') as mock_settings:
            mock_settings.return_value.google_client_id = "test-client-id"
            mock_settings.return_value.google_client_secret = "test-secret"
            mock_settings.return_value.app_base_url = "https://manage.ai.devintensive.com"

            with patch('app.services.oauth.httpx.AsyncClient') as mock_client:
                mock_response = MagicMock()
                mock_response.status_code = 200
                mock_response.json.return_value = {
                    "access_token": "ya29.xxx",
                    "refresh_token": "1//xxx",
                    "expires_in": 3600,
                    "token_type": "Bearer",
                    "scope": "https://www.googleapis.com/auth/gmail.readonly",
                }
                mock_client.return_value.__aenter__.return_value.post = AsyncMock(return_value=mock_response)

                from app.services.oauth import exchange_code_for_tokens

                tokens = await exchange_code_for_tokens("google", "test-code")

                assert tokens.access_token == "ya29.xxx"
                assert tokens.refresh_token == "1//xxx"
                assert tokens.expires_in == 3600

    @pytest.mark.asyncio
    async def test_exchange_code_for_tokens_error(self):
        """Test token exchange failure."""
        with patch('app.services.oauth.get_settings') as mock_settings:
            mock_settings.return_value.google_client_id = "test-client-id"
            mock_settings.return_value.google_client_secret = "test-secret"
            mock_settings.return_value.app_base_url = "https://manage.ai.devintensive.com"

            with patch('app.services.oauth.httpx.AsyncClient') as mock_client:
                mock_response = MagicMock()
                mock_response.status_code = 400
                mock_response.headers = {"content-type": "application/json"}
                mock_response.json.return_value = {
                    "error": "invalid_grant",
                    "error_description": "Code expired",
                }
                mock_client.return_value.__aenter__.return_value.post = AsyncMock(return_value=mock_response)

                from app.services.oauth import exchange_code_for_tokens

                with pytest.raises(ValueError, match="Token exchange failed"):
                    await exchange_code_for_tokens("google", "expired-code")


class TestGetUserInfo:
    """Tests for fetching user info from OAuth providers."""

    @pytest.mark.asyncio
    async def test_get_user_info_google(self):
        """Test getting user info from Google."""
        with patch('app.services.oauth.get_settings') as mock_settings:
            mock_settings.return_value.google_client_id = "test-client-id"
            mock_settings.return_value.google_client_secret = "test-secret"
            mock_settings.return_value.app_base_url = "https://example.com"

            with patch('app.services.oauth.httpx.AsyncClient') as mock_client:
                mock_response = MagicMock()
                mock_response.status_code = 200
                mock_response.json.return_value = {
                    "id": "12345",
                    "email": "user@gmail.com",
                    "name": "Test User",
                }
                mock_client.return_value.__aenter__.return_value.get = AsyncMock(return_value=mock_response)

                from app.services.oauth import get_user_info

                user_info = await get_user_info("google", "valid-token")

                assert user_info.id == "12345"
                assert user_info.email == "user@gmail.com"
                assert user_info.name == "Test User"
