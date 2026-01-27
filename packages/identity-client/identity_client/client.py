"""HTTP client for Identity API operations."""

import os
from typing import Optional
import httpx

from identity_client.models import (
    User,
    Organization,
    Team,
    ValidateResponse,
    UserListResponse,
    OrganizationListResponse,
    TeamListResponse,
    SessionInfo,
)


class IdentityClientError(Exception):
    """Base exception for Identity client errors."""
    def __init__(self, message: str, status_code: Optional[int] = None):
        self.message = message
        self.status_code = status_code
        super().__init__(message)


class IdentityClient:
    """
    Async HTTP client for Identity API operations.

    Usage:
        client = IdentityClient()

        # Validate session
        result = await client.validate_session(token)

        # Get user info
        user = await client.get_user(user_id)
    """

    def __init__(
        self,
        base_url: Optional[str] = None,
        timeout: float = 10.0,
    ):
        """
        Initialize Identity client.

        Args:
            base_url: Identity API base URL. Defaults to IDENTITY_API_URL env var.
            timeout: Request timeout in seconds.
        """
        self.base_url = (
            base_url
            or os.environ.get("IDENTITY_INTERNAL_URL")
            or os.environ.get("IDENTITY_API_URL")
            or "https://identity.ai.devintensive.com"
        ).rstrip("/")
        self.timeout = timeout
        self._client: Optional[httpx.AsyncClient] = None

    async def _get_client(self) -> httpx.AsyncClient:
        """Get or create the HTTP client."""
        if self._client is None or self._client.is_closed:
            self._client = httpx.AsyncClient(
                base_url=self.base_url,
                timeout=self.timeout,
            )
        return self._client

    async def close(self):
        """Close the HTTP client."""
        if self._client and not self._client.is_closed:
            await self._client.aclose()
            self._client = None

    async def __aenter__(self):
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        await self.close()

    def _headers(self, session_token: Optional[str] = None) -> dict:
        """Build request headers."""
        headers = {"Content-Type": "application/json"}
        if session_token:
            headers["X-Session-Token"] = session_token
        return headers

    # -------------------------------------------------------------------------
    # Session / Auth
    # -------------------------------------------------------------------------

    async def validate_session(self, session_token: str) -> ValidateResponse:
        """
        Validate a session token against Identity API.

        Args:
            session_token: The session token to validate.

        Returns:
            ValidateResponse with valid flag, user info, and expiry.
        """
        client = await self._get_client()
        try:
            response = await client.get(
                "/api/v1/auth/validate",
                headers=self._headers(session_token),
            )

            if response.status_code == 401:
                return ValidateResponse(valid=False, user=None, expires_at=None)

            response.raise_for_status()
            data = response.json()

            # Map response to our model
            user_data = data.get("user")
            user = None
            if user_data:
                user = User(
                    id=user_data["id"],
                    organization_id=user_data["organization_id"],
                    name=user_data["name"],
                    email=user_data.get("email"),
                    role=user_data.get("role", "member"),
                    avatar_url=user_data.get("avatar_url"),
                    organization_name=user_data.get("organization_name"),
                )

            return ValidateResponse(
                valid=data.get("valid", False),
                user=user,
                expires_at=data.get("expires_at"),
            )
        except httpx.HTTPStatusError as e:
            if e.response.status_code == 401:
                return ValidateResponse(valid=False, user=None, expires_at=None)
            raise IdentityClientError(
                f"Session validation failed: {e.response.text}",
                status_code=e.response.status_code,
            )
        except httpx.RequestError as e:
            raise IdentityClientError(f"Request failed: {str(e)}")

    async def get_current_user(self, session_token: str) -> Optional[User]:
        """
        Get current user from session token.

        Args:
            session_token: The session token.

        Returns:
            User if valid session, None otherwise.
        """
        client = await self._get_client()
        try:
            response = await client.get(
                "/api/v1/auth/me",
                headers=self._headers(session_token),
            )

            if response.status_code == 401:
                return None

            response.raise_for_status()
            data = response.json()

            return User(
                id=data["id"],
                organization_id=data["organization_id"],
                name=data["name"],
                email=data.get("email"),
                user_type=data.get("user_type", "human"),
                role=data.get("role", "member"),
                is_active=data.get("is_active", True),
                avatar_url=data.get("avatar_url"),
                title=data.get("title"),
                responsibilities=data.get("responsibilities"),
                organization_name=data.get("organization_name"),
            )
        except httpx.HTTPStatusError as e:
            if e.response.status_code == 401:
                return None
            raise IdentityClientError(
                f"Failed to get current user: {e.response.text}",
                status_code=e.response.status_code,
            )
        except httpx.RequestError as e:
            raise IdentityClientError(f"Request failed: {str(e)}")

    async def logout(self, session_token: str) -> bool:
        """
        Logout / invalidate a session.

        Args:
            session_token: The session token to invalidate.

        Returns:
            True if successful.
        """
        client = await self._get_client()
        try:
            response = await client.post(
                "/api/v1/auth/logout",
                headers=self._headers(session_token),
            )
            return response.status_code == 200
        except (httpx.HTTPStatusError, httpx.RequestError):
            return False

    async def list_sessions(self, session_token: str) -> list[SessionInfo]:
        """
        List all active sessions for current user.

        Args:
            session_token: The session token.

        Returns:
            List of session info objects.
        """
        client = await self._get_client()
        response = await client.get(
            "/api/v1/auth/sessions",
            headers=self._headers(session_token),
        )
        response.raise_for_status()
        return [SessionInfo(**s) for s in response.json()]

    # -------------------------------------------------------------------------
    # Users
    # -------------------------------------------------------------------------

    async def get_user(self, user_id: str, session_token: str) -> User:
        """
        Get a user by ID.

        Args:
            user_id: The user ID.
            session_token: Session token for authentication.

        Returns:
            User object.
        """
        client = await self._get_client()
        response = await client.get(
            f"/api/v1/users/{user_id}",
            headers=self._headers(session_token),
        )
        response.raise_for_status()
        return User(**response.json())

    async def list_users(
        self,
        session_token: str,
        organization_id: Optional[str] = None,
    ) -> UserListResponse:
        """
        List users (optionally filtered by organization).

        Args:
            session_token: Session token for authentication.
            organization_id: Optional organization ID filter.

        Returns:
            UserListResponse with items and total count.
        """
        client = await self._get_client()
        params = {}
        if organization_id:
            params["organization_id"] = organization_id

        response = await client.get(
            "/api/v1/users",
            headers=self._headers(session_token),
            params=params,
        )
        response.raise_for_status()
        data = response.json()

        # Handle both array and paginated response formats
        if isinstance(data, list):
            return UserListResponse(items=[User(**u) for u in data], total=len(data))
        return UserListResponse(
            items=[User(**u) for u in data.get("items", [])],
            total=data.get("total", 0),
        )

    # -------------------------------------------------------------------------
    # Organizations
    # -------------------------------------------------------------------------

    async def get_organization(self, org_id: str, session_token: str) -> Organization:
        """
        Get an organization by ID.

        Args:
            org_id: The organization ID.
            session_token: Session token for authentication.

        Returns:
            Organization object.
        """
        client = await self._get_client()
        response = await client.get(
            f"/api/v1/organizations/{org_id}",
            headers=self._headers(session_token),
        )
        response.raise_for_status()
        return Organization(**response.json())

    async def list_organizations(
        self,
        session_token: str,
    ) -> OrganizationListResponse:
        """
        List organizations.

        Args:
            session_token: Session token for authentication.

        Returns:
            OrganizationListResponse with items and total count.
        """
        client = await self._get_client()
        response = await client.get(
            "/api/v1/organizations",
            headers=self._headers(session_token),
        )
        response.raise_for_status()
        data = response.json()

        if isinstance(data, list):
            return OrganizationListResponse(
                items=[Organization(**o) for o in data],
                total=len(data),
            )
        return OrganizationListResponse(
            items=[Organization(**o) for o in data.get("items", [])],
            total=data.get("total", 0),
        )

    # -------------------------------------------------------------------------
    # Teams
    # -------------------------------------------------------------------------

    async def get_team(self, team_id: str, session_token: str) -> Team:
        """
        Get a team by ID.

        Args:
            team_id: The team ID.
            session_token: Session token for authentication.

        Returns:
            Team object.
        """
        client = await self._get_client()
        response = await client.get(
            f"/api/v1/teams/{team_id}",
            headers=self._headers(session_token),
        )
        response.raise_for_status()
        return Team(**response.json())

    async def list_teams(
        self,
        session_token: str,
        organization_id: Optional[str] = None,
    ) -> TeamListResponse:
        """
        List teams (optionally filtered by organization).

        Args:
            session_token: Session token for authentication.
            organization_id: Optional organization ID filter.

        Returns:
            TeamListResponse with items and total count.
        """
        client = await self._get_client()
        params = {}
        if organization_id:
            params["organization_id"] = organization_id

        response = await client.get(
            "/api/v1/teams",
            headers=self._headers(session_token),
            params=params,
        )
        response.raise_for_status()
        data = response.json()

        if isinstance(data, list):
            return TeamListResponse(items=[Team(**t) for t in data], total=len(data))
        return TeamListResponse(
            items=[Team(**t) for t in data.get("items", [])],
            total=data.get("total", 0),
        )
