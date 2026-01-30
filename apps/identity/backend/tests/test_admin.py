"""Tests for admin API endpoints."""

import pytest
from unittest.mock import MagicMock, AsyncMock
from uuid import uuid4


class TestSetOwnerByEmail:
    """Test set-owner-by-email admin endpoint."""

    @pytest.mark.asyncio
    async def test_set_owner_success(self):
        """Test successfully setting a user as owner by email."""
        from app.api.v1.admin import set_owner_by_email, SetOwnerByEmailRequest

        mock_db = AsyncMock()
        user_id = uuid4()
        org_id = uuid4()

        # Mock user
        mock_user = MagicMock()
        mock_user.id = user_id
        mock_user.email = "test@example.com"
        mock_user.name = "Test User"
        mock_user.organization_id = org_id
        mock_user.role = "member"

        # Mock organization
        mock_org = MagicMock()
        mock_org.name = "Test Org"

        # Setup mock executions
        user_result = MagicMock()
        user_result.scalar_one_or_none.return_value = mock_user

        org_result = MagicMock()
        org_result.scalar_one_or_none.return_value = mock_org

        mock_db.execute.side_effect = [user_result, org_result]

        request = SetOwnerByEmailRequest(email="test@example.com")
        result = await set_owner_by_email(request, mock_db)

        assert result.user_id == user_id
        assert result.email == "test@example.com"
        assert result.old_role == "member"
        assert result.new_role == "owner"
        assert result.organization_name == "Test Org"
        assert mock_user.role == "owner"
        mock_db.commit.assert_called_once()

    @pytest.mark.asyncio
    async def test_set_owner_already_owner(self):
        """Test setting owner when user is already owner."""
        from app.api.v1.admin import set_owner_by_email, SetOwnerByEmailRequest

        mock_db = AsyncMock()
        user_id = uuid4()
        org_id = uuid4()

        mock_user = MagicMock()
        mock_user.id = user_id
        mock_user.email = "owner@example.com"
        mock_user.name = "Owner User"
        mock_user.organization_id = org_id
        mock_user.role = "owner"  # Already owner

        mock_org = MagicMock()
        mock_org.name = "Test Org"

        user_result = MagicMock()
        user_result.scalar_one_or_none.return_value = mock_user

        org_result = MagicMock()
        org_result.scalar_one_or_none.return_value = mock_org

        mock_db.execute.side_effect = [user_result, org_result]

        request = SetOwnerByEmailRequest(email="owner@example.com")
        result = await set_owner_by_email(request, mock_db)

        # Should return without committing since already owner
        assert result.old_role == "owner"
        assert result.new_role == "owner"
        mock_db.commit.assert_not_called()

    @pytest.mark.asyncio
    async def test_set_owner_user_not_found(self):
        """Test error when user email not found."""
        from app.api.v1.admin import set_owner_by_email, SetOwnerByEmailRequest
        from fastapi import HTTPException

        mock_db = AsyncMock()

        user_result = MagicMock()
        user_result.scalar_one_or_none.return_value = None

        mock_db.execute.return_value = user_result

        request = SetOwnerByEmailRequest(email="notfound@example.com")

        with pytest.raises(HTTPException) as exc_info:
            await set_owner_by_email(request, mock_db)

        assert exc_info.value.status_code == 404
        assert "No user found" in str(exc_info.value.detail)


class TestAdminSchemas:
    """Test admin schemas."""

    def test_set_owner_by_email_request(self):
        """Test SetOwnerByEmailRequest schema."""
        from app.api.v1.admin import SetOwnerByEmailRequest

        request = SetOwnerByEmailRequest(email="test@example.com")
        assert request.email == "test@example.com"

    def test_set_owner_by_email_response(self):
        """Test SetOwnerByEmailResponse schema."""
        from app.api.v1.admin import SetOwnerByEmailResponse

        response = SetOwnerByEmailResponse(
            user_id=uuid4(),
            email="test@example.com",
            name="Test User",
            organization_id=uuid4(),
            organization_name="Test Org",
            old_role="member",
            new_role="owner"
        )
        assert response.old_role == "member"
        assert response.new_role == "owner"
