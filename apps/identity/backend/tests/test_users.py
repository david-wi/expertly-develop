"""Tests for user management API endpoints."""

import pytest
from unittest.mock import patch, AsyncMock, MagicMock
from uuid import uuid4


class TestUserCreationAutoOwner:
    """Test that first non-default user becomes owner."""

    @pytest.mark.asyncio
    async def test_first_human_user_becomes_owner(self):
        """Test that the first real (non-default) human user is auto-assigned owner role."""
        from app.api.v1.users import create_user
        from app.schemas.user import UserCreate

        mock_org = MagicMock()
        mock_org.id = uuid4()

        mock_db = AsyncMock()
        # Mock: no duplicate email
        mock_db.execute.return_value.scalar_one_or_none.return_value = None
        # Mock: no non-default users exist (count = 0)
        mock_db.execute.return_value.scalar.return_value = 0

        user_data = UserCreate(
            name="First User",
            email="first@example.com",
            user_type="human",
            role="member",  # User requests member role
        )

        # We need to mock the User creation and commit
        with patch("app.api.v1.users.User") as MockUser:
            mock_user = MagicMock()
            mock_user.id = uuid4()
            mock_user.organization_id = mock_org.id
            mock_user.name = "First User"
            mock_user.email = "first@example.com"
            mock_user.user_type = "human"
            mock_user.role = "owner"  # Should be set to owner
            mock_user.is_active = True
            mock_user.is_default = False
            mock_user.avatar_url = None
            mock_user.title = None
            mock_user.responsibilities = None
            mock_user.bot_config = None
            mock_user.created_at = MagicMock()
            mock_user.updated_at = MagicMock()
            MockUser.return_value = mock_user

            result = await create_user(user_data, mock_org, mock_db)

            # Verify User was created with owner role
            MockUser.assert_called_once()
            call_kwargs = MockUser.call_args.kwargs
            assert call_kwargs["role"] == "owner"

    @pytest.mark.asyncio
    async def test_second_human_user_keeps_requested_role(self):
        """Test that subsequent users keep their requested role."""
        from app.api.v1.users import create_user
        from app.schemas.user import UserCreate

        mock_org = MagicMock()
        mock_org.id = uuid4()

        mock_db = AsyncMock()
        # Mock: no duplicate email
        first_execute = MagicMock()
        first_execute.scalar_one_or_none.return_value = None
        # Mock: 1 non-default user already exists
        second_execute = MagicMock()
        second_execute.scalar.return_value = 1

        mock_db.execute.side_effect = [first_execute, second_execute]

        user_data = UserCreate(
            name="Second User",
            email="second@example.com",
            user_type="human",
            role="member",  # User requests member role
        )

        with patch("app.api.v1.users.User") as MockUser:
            mock_user = MagicMock()
            mock_user.id = uuid4()
            mock_user.organization_id = mock_org.id
            mock_user.name = "Second User"
            mock_user.email = "second@example.com"
            mock_user.user_type = "human"
            mock_user.role = "member"  # Should keep requested role
            mock_user.is_active = True
            mock_user.is_default = False
            mock_user.avatar_url = None
            mock_user.title = None
            mock_user.responsibilities = None
            mock_user.bot_config = None
            mock_user.created_at = MagicMock()
            mock_user.updated_at = MagicMock()
            MockUser.return_value = mock_user

            result = await create_user(user_data, mock_org, mock_db)

            # Verify User was created with member role (not auto-promoted to owner)
            MockUser.assert_called_once()
            call_kwargs = MockUser.call_args.kwargs
            assert call_kwargs["role"] == "member"

    @pytest.mark.asyncio
    async def test_bot_user_does_not_become_owner(self):
        """Test that bot users are not auto-assigned owner role even if first."""
        from app.api.v1.users import create_user
        from app.schemas.user import UserCreate

        mock_org = MagicMock()
        mock_org.id = uuid4()

        mock_db = AsyncMock()
        # Mock: no duplicate email
        mock_db.execute.return_value.scalar_one_or_none.return_value = None

        user_data = UserCreate(
            name="Bot User",
            email=None,
            user_type="bot",  # Bot user
            role="member",
        )

        with patch("app.api.v1.users.User") as MockUser:
            mock_user = MagicMock()
            mock_user.id = uuid4()
            mock_user.organization_id = mock_org.id
            mock_user.name = "Bot User"
            mock_user.email = None
            mock_user.user_type = "bot"
            mock_user.role = "member"  # Should keep member role
            mock_user.is_active = True
            mock_user.is_default = False
            mock_user.avatar_url = None
            mock_user.title = None
            mock_user.responsibilities = None
            mock_user.bot_config = None
            mock_user.created_at = MagicMock()
            mock_user.updated_at = MagicMock()
            MockUser.return_value = mock_user

            result = await create_user(user_data, mock_org, mock_db)

            # Verify bot was created with member role (not promoted to owner)
            MockUser.assert_called_once()
            call_kwargs = MockUser.call_args.kwargs
            assert call_kwargs["role"] == "member"


class TestUserSchemas:
    """Test user schemas."""

    def test_user_create_schema(self):
        """Test UserCreate schema with defaults."""
        from app.schemas.user import UserCreate

        user = UserCreate(name="Test User")
        assert user.name == "Test User"
        assert user.email is None
        assert user.user_type == "human"
        assert user.role == "member"

    def test_user_create_schema_with_email(self):
        """Test UserCreate schema with email."""
        from app.schemas.user import UserCreate

        user = UserCreate(name="Test User", email="test@example.com")
        assert user.email == "test@example.com"

    def test_user_update_schema(self):
        """Test UserUpdate schema."""
        from app.schemas.user import UserUpdate

        update = UserUpdate(role="admin")
        assert update.role == "admin"
        assert update.name is None

    def test_bot_config_schema(self):
        """Test BotConfig schema."""
        from app.schemas.user import BotConfig

        config = BotConfig(
            what_i_can_help_with="I help with testing",
            capabilities=["testing", "qa"]
        )
        assert config.what_i_can_help_with == "I help with testing"
        assert len(config.capabilities) == 2
