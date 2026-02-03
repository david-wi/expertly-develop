"""
OAuth service for handling external provider authentication.
Supports Google, with extensible provider configuration.
"""
import secrets
from datetime import datetime, timezone, timedelta
from typing import Optional
from urllib.parse import urlencode
import httpx
from pydantic import BaseModel

from app.config import get_settings


class OAuthProviderConfig(BaseModel):
    """Configuration for an OAuth provider."""
    name: str
    client_id: str
    client_secret: str
    auth_url: str
    token_url: str
    userinfo_url: str
    scopes: list[str]
    redirect_uri: str


class TokenResponse(BaseModel):
    """Response from token exchange."""
    access_token: str
    refresh_token: Optional[str] = None
    expires_in: Optional[int] = None
    token_type: str = "Bearer"
    scope: Optional[str] = None
    # Provider-specific fields
    team_name: Optional[str] = None  # Slack workspace name
    team_id: Optional[str] = None  # Slack workspace ID


class UserInfo(BaseModel):
    """User info from OAuth provider."""
    id: str
    email: Optional[str] = None
    name: Optional[str] = None


def get_provider_config(provider: str) -> OAuthProviderConfig:
    """Get OAuth configuration for a provider."""
    settings = get_settings()
    base_url = settings.app_base_url.rstrip("/")

    providers = {
        "google": OAuthProviderConfig(
            name="Google",
            client_id=settings.google_client_id,
            client_secret=settings.google_client_secret,
            auth_url="https://accounts.google.com/o/oauth2/v2/auth",
            token_url="https://oauth2.googleapis.com/token",
            userinfo_url="https://www.googleapis.com/oauth2/v2/userinfo",
            scopes=[
                "https://www.googleapis.com/auth/gmail.readonly",
                "https://www.googleapis.com/auth/gmail.send",
                "https://www.googleapis.com/auth/drive.readonly",
                "https://www.googleapis.com/auth/documents.readonly",
                "https://www.googleapis.com/auth/userinfo.email",
                "https://www.googleapis.com/auth/userinfo.profile",
            ],
            redirect_uri=f"{base_url}/api/v1/connections/oauth/google/callback",
        ),
        "slack": OAuthProviderConfig(
            name="Slack",
            client_id=settings.slack_client_id,
            client_secret=settings.slack_client_secret,
            auth_url="https://slack.com/oauth/v2/authorize",
            token_url="https://slack.com/api/oauth.v2.access",
            userinfo_url="https://slack.com/api/users.identity",
            scopes=[
                "channels:read",
                "channels:history",  # Read public channel messages
                "groups:history",    # Read private channel messages
                "chat:write",
                "users:read",
                "users:read.email",
            ],
            redirect_uri=f"{base_url}/api/v1/connections/oauth/slack/callback",
        ),
    }

    if provider not in providers:
        raise ValueError(f"Unknown OAuth provider: {provider}")

    config = providers[provider]
    if not config.client_id or not config.client_secret:
        raise ValueError(f"OAuth credentials not configured for {provider}")

    return config


def generate_state() -> str:
    """Generate a secure random state parameter for OAuth."""
    return secrets.token_urlsafe(32)


def build_auth_url(provider: str, state: str) -> str:
    """
    Build the authorization URL for OAuth flow.

    Args:
        provider: The OAuth provider name (e.g., "google")
        state: The state parameter for CSRF protection

    Returns:
        The full authorization URL to redirect the user to
    """
    config = get_provider_config(provider)

    params = {
        "client_id": config.client_id,
        "redirect_uri": config.redirect_uri,
        "state": state,
    }

    if provider == "slack":
        # Slack uses user_scope for user tokens (vs scope for bot tokens)
        params["user_scope"] = ",".join(config.scopes)
    else:
        # Google and others
        params["response_type"] = "code"
        params["scope"] = " ".join(config.scopes)
        params["access_type"] = "offline"  # Request refresh token
        params["prompt"] = "consent"  # Always show consent to get refresh token

    return f"{config.auth_url}?{urlencode(params)}"


async def exchange_code_for_tokens(provider: str, code: str) -> TokenResponse:
    """
    Exchange authorization code for access and refresh tokens.

    Args:
        provider: The OAuth provider name
        code: The authorization code from the callback

    Returns:
        TokenResponse with access_token, refresh_token, etc.
    """
    config = get_provider_config(provider)

    async with httpx.AsyncClient() as client:
        response = await client.post(
            config.token_url,
            data={
                "client_id": config.client_id,
                "client_secret": config.client_secret,
                "code": code,
                "grant_type": "authorization_code",
                "redirect_uri": config.redirect_uri,
            },
        )

        if response.status_code != 200:
            error_data = response.json() if response.headers.get("content-type", "").startswith("application/json") else {}
            error_msg = error_data.get("error_description", error_data.get("error", response.text))
            raise ValueError(f"Token exchange failed: {error_msg}")

        data = response.json()

        # Slack returns ok: false on error even with 200 status
        if provider == "slack":
            if not data.get("ok"):
                raise ValueError(f"Token exchange failed: {data.get('error', 'Unknown error')}")
            # Slack returns user token in authed_user for user_scope
            authed_user = data.get("authed_user", {})
            # Slack also returns team info
            team = data.get("team", {})
            return TokenResponse(
                access_token=authed_user.get("access_token", data.get("access_token")),
                refresh_token=authed_user.get("refresh_token"),
                expires_in=authed_user.get("expires_in"),
                token_type="Bearer",
                scope=authed_user.get("scope", data.get("scope")),
                team_name=team.get("name"),
                team_id=team.get("id"),
            )

        return TokenResponse(
            access_token=data["access_token"],
            refresh_token=data.get("refresh_token"),
            expires_in=data.get("expires_in"),
            token_type=data.get("token_type", "Bearer"),
            scope=data.get("scope"),
        )


async def refresh_access_token(provider: str, refresh_token: str) -> TokenResponse:
    """
    Refresh an expired access token.

    Args:
        provider: The OAuth provider name
        refresh_token: The refresh token

    Returns:
        TokenResponse with new access_token (and possibly new refresh_token)
    """
    config = get_provider_config(provider)

    async with httpx.AsyncClient() as client:
        response = await client.post(
            config.token_url,
            data={
                "client_id": config.client_id,
                "client_secret": config.client_secret,
                "refresh_token": refresh_token,
                "grant_type": "refresh_token",
            },
        )

        if response.status_code != 200:
            error_data = response.json() if response.headers.get("content-type", "").startswith("application/json") else {}
            error_msg = error_data.get("error_description", error_data.get("error", response.text))
            raise ValueError(f"Token refresh failed: {error_msg}")

        data = response.json()
        return TokenResponse(
            access_token=data["access_token"],
            refresh_token=data.get("refresh_token", refresh_token),  # Keep old if not provided
            expires_in=data.get("expires_in"),
            token_type=data.get("token_type", "Bearer"),
            scope=data.get("scope"),
        )


async def get_user_info(provider: str, access_token: str) -> UserInfo:
    """
    Get user info from the OAuth provider.

    Args:
        provider: The OAuth provider name
        access_token: The access token

    Returns:
        UserInfo with id, email, name
    """
    config = get_provider_config(provider)

    async with httpx.AsyncClient() as client:
        response = await client.get(
            config.userinfo_url,
            headers={"Authorization": f"Bearer {access_token}"},
        )

        if response.status_code != 200:
            raise ValueError(f"Failed to get user info: {response.text}")

        data = response.json()

        # Handle provider-specific response formats
        if provider == "google":
            return UserInfo(
                id=data["id"],
                email=data.get("email"),
                name=data.get("name"),
            )

        if provider == "slack":
            if not data.get("ok"):
                raise ValueError(f"Failed to get user info: {data.get('error', 'Unknown error')}")
            user = data.get("user", {})
            return UserInfo(
                id=user.get("id", ""),
                email=user.get("email"),
                name=user.get("name"),
            )

        # Default handling
        return UserInfo(
            id=str(data.get("id") or data.get("sub")),
            email=data.get("email"),
            name=data.get("name"),
        )


def calculate_token_expiry(expires_in: Optional[int]) -> Optional[datetime]:
    """Calculate token expiration datetime from expires_in seconds."""
    if not expires_in:
        return None
    return datetime.now(timezone.utc) + timedelta(seconds=expires_in)


def is_provider_configured(provider: str) -> bool:
    """Check if a provider has OAuth credentials configured."""
    settings = get_settings()

    if provider == "google":
        return bool(settings.google_client_id and settings.google_client_secret)
    elif provider == "slack":
        return bool(settings.slack_client_id and settings.slack_client_secret)

    return False


def get_provider_setup_instructions(provider: str) -> dict:
    """Get setup instructions for a provider."""
    settings = get_settings()
    base_url = settings.app_base_url.rstrip("/")

    instructions = {
        "google": {
            "steps": [
                "Go to Google Cloud Console: https://console.cloud.google.com/apis/credentials",
                "Create a new OAuth 2.0 Client ID (Web application)",
                f"Add authorized redirect URI: {base_url}/api/v1/connections/oauth/google/callback",
                "Copy the Client ID and Client Secret",
                "Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET environment variables",
            ],
            "console_url": "https://console.cloud.google.com/apis/credentials",
            "docs_url": "https://developers.google.com/identity/protocols/oauth2",
        },
        "slack": {
            "steps": [
                "Go to Slack API: https://api.slack.com/apps",
                "Create a new app or select an existing one",
                f"Under OAuth & Permissions, add redirect URL: {base_url}/api/v1/connections/oauth/slack/callback",
                "Add required user token scopes: channels:read, chat:write, users:read, users:read.email",
                "Copy the Client ID and Client Secret from Basic Information",
                "Set SLACK_CLIENT_ID and SLACK_CLIENT_SECRET environment variables",
            ],
            "console_url": "https://api.slack.com/apps",
            "docs_url": "https://api.slack.com/authentication/oauth-v2",
        },
    }

    return instructions.get(provider, {"steps": [], "console_url": "", "docs_url": ""})
