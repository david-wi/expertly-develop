"""
API routes for managing OAuth connections to external services.
"""
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, status, Request
from fastapi.responses import RedirectResponse
from bson import ObjectId

from app.database import get_database
from app.models import User
from app.models.connection import (
    Connection,
    ConnectionCreate,
    ConnectionResponse,
    ConnectionStatus,
    ConnectionProvider,
    OAuthStartResponse,
)
from app.api.deps import get_current_user
from app.services.encryption import encrypt_token, decrypt_token
from app.services.oauth import (
    build_auth_url,
    generate_state,
    exchange_code_for_tokens,
    refresh_access_token,
    get_user_info,
    calculate_token_expiry,
)
from app.config import get_settings

router = APIRouter()

# In-memory state storage (in production, use Redis or similar)
# Maps state -> {user_id, organization_id, provider, created_at}
_oauth_states: dict[str, dict] = {}


def serialize_connection(conn: dict) -> ConnectionResponse:
    """Convert MongoDB connection document to response model."""
    return ConnectionResponse(
        id=str(conn["_id"]),
        provider=conn["provider"],
        provider_email=conn.get("provider_email"),
        status=conn["status"],
        scopes=conn.get("scopes", []),
        connected_at=conn["connected_at"],
        last_used_at=conn.get("last_used_at"),
    )


@router.get("")
async def list_connections(
    current_user: User = Depends(get_current_user)
) -> list[ConnectionResponse]:
    """List all connections for the current user."""
    db = get_database()

    cursor = db.connections.find({
        "user_id": current_user.id,
        "organization_id": current_user.organization_id,
    })
    connections = await cursor.to_list(100)

    return [serialize_connection(c) for c in connections]


@router.get("/{connection_id}")
async def get_connection(
    connection_id: str,
    current_user: User = Depends(get_current_user)
) -> ConnectionResponse:
    """Get a specific connection."""
    db = get_database()

    if not ObjectId.is_valid(connection_id):
        raise HTTPException(status_code=400, detail="Invalid connection ID")

    conn = await db.connections.find_one({
        "_id": ObjectId(connection_id),
        "user_id": current_user.id,
        "organization_id": current_user.organization_id,
    })

    if not conn:
        raise HTTPException(status_code=404, detail="Connection not found")

    return serialize_connection(conn)


@router.delete("/{connection_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_connection(
    connection_id: str,
    current_user: User = Depends(get_current_user)
):
    """Delete a connection (revoke access)."""
    db = get_database()

    if not ObjectId.is_valid(connection_id):
        raise HTTPException(status_code=400, detail="Invalid connection ID")

    result = await db.connections.delete_one({
        "_id": ObjectId(connection_id),
        "user_id": current_user.id,
        "organization_id": current_user.organization_id,
    })

    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Connection not found")


@router.get("/oauth/{provider}/start")
async def start_oauth_flow(
    provider: str,
    current_user: User = Depends(get_current_user)
) -> OAuthStartResponse:
    """
    Start the OAuth flow for a provider.
    Returns the authorization URL to redirect the user to.
    """
    # Validate provider
    try:
        ConnectionProvider(provider)
    except ValueError:
        raise HTTPException(status_code=400, detail=f"Unknown provider: {provider}")

    # Generate state for CSRF protection
    state = generate_state()

    # Store state with user context
    _oauth_states[state] = {
        "user_id": str(current_user.id),
        "organization_id": str(current_user.organization_id),
        "provider": provider,
        "created_at": datetime.now(timezone.utc),
    }

    # Clean up old states (older than 10 minutes)
    cutoff = datetime.now(timezone.utc).timestamp() - 600
    _oauth_states.clear()
    _oauth_states[state] = {
        "user_id": str(current_user.id),
        "organization_id": str(current_user.organization_id),
        "provider": provider,
        "created_at": datetime.now(timezone.utc),
    }

    try:
        auth_url = build_auth_url(provider, state)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    return OAuthStartResponse(auth_url=auth_url, state=state)


@router.get("/oauth/{provider}/callback")
async def oauth_callback(
    provider: str,
    code: str | None = None,
    state: str | None = None,
    error: str | None = None,
    error_description: str | None = None,
):
    """
    OAuth callback handler.
    Exchanges code for tokens and creates the connection.
    Redirects to frontend connections page.
    """
    settings = get_settings()
    frontend_url = settings.frontend_url.rstrip("/")

    # Handle OAuth errors
    if error:
        error_msg = error_description or error
        return RedirectResponse(
            url=f"{frontend_url}/connections?error={error_msg}",
            status_code=status.HTTP_302_FOUND,
        )

    if not code or not state:
        return RedirectResponse(
            url=f"{frontend_url}/connections?error=Missing code or state",
            status_code=status.HTTP_302_FOUND,
        )

    # Validate state
    state_data = _oauth_states.pop(state, None)
    if not state_data:
        return RedirectResponse(
            url=f"{frontend_url}/connections?error=Invalid or expired state",
            status_code=status.HTTP_302_FOUND,
        )

    if state_data["provider"] != provider:
        return RedirectResponse(
            url=f"{frontend_url}/connections?error=Provider mismatch",
            status_code=status.HTTP_302_FOUND,
        )

    try:
        # Exchange code for tokens
        tokens = await exchange_code_for_tokens(provider, code)

        # Get user info from provider
        user_info = await get_user_info(provider, tokens.access_token)

        # Calculate token expiry
        token_expires_at = calculate_token_expiry(tokens.expires_in)

        # Parse scopes
        scopes = tokens.scope.split(" ") if tokens.scope else []

        db = get_database()

        # Check if connection already exists for this provider + provider_user_id
        existing = await db.connections.find_one({
            "user_id": ObjectId(state_data["user_id"]),
            "organization_id": ObjectId(state_data["organization_id"]),
            "provider": provider,
            "provider_user_id": user_info.id,
        })

        if existing:
            # Update existing connection with new tokens
            await db.connections.update_one(
                {"_id": existing["_id"]},
                {
                    "$set": {
                        "access_token_encrypted": encrypt_token(tokens.access_token),
                        "refresh_token_encrypted": encrypt_token(tokens.refresh_token) if tokens.refresh_token else None,
                        "token_expires_at": token_expires_at,
                        "scopes": scopes,
                        "status": ConnectionStatus.ACTIVE.value,
                        "provider_email": user_info.email,
                        "updated_at": datetime.now(timezone.utc),
                    }
                },
            )
        else:
            # Create new connection
            connection = Connection(
                user_id=ObjectId(state_data["user_id"]),
                organization_id=ObjectId(state_data["organization_id"]),
                provider=ConnectionProvider(provider),
                provider_user_id=user_info.id,
                provider_email=user_info.email,
                access_token_encrypted=encrypt_token(tokens.access_token),
                refresh_token_encrypted=encrypt_token(tokens.refresh_token) if tokens.refresh_token else None,
                token_expires_at=token_expires_at,
                scopes=scopes,
                status=ConnectionStatus.ACTIVE,
                connected_at=datetime.now(timezone.utc),
            )

            await db.connections.insert_one(connection.model_dump_mongo())

        return RedirectResponse(
            url=f"{frontend_url}/connections?success=true",
            status_code=status.HTTP_302_FOUND,
        )

    except ValueError as e:
        return RedirectResponse(
            url=f"{frontend_url}/connections?error={str(e)}",
            status_code=status.HTTP_302_FOUND,
        )
    except Exception as e:
        return RedirectResponse(
            url=f"{frontend_url}/connections?error=Connection failed",
            status_code=status.HTTP_302_FOUND,
        )


@router.post("/{connection_id}/refresh")
async def refresh_connection(
    connection_id: str,
    current_user: User = Depends(get_current_user)
) -> ConnectionResponse:
    """Force refresh the access token for a connection."""
    db = get_database()

    if not ObjectId.is_valid(connection_id):
        raise HTTPException(status_code=400, detail="Invalid connection ID")

    conn = await db.connections.find_one({
        "_id": ObjectId(connection_id),
        "user_id": current_user.id,
        "organization_id": current_user.organization_id,
    })

    if not conn:
        raise HTTPException(status_code=404, detail="Connection not found")

    if not conn.get("refresh_token_encrypted"):
        raise HTTPException(status_code=400, detail="No refresh token available")

    try:
        # Decrypt refresh token
        refresh_token = decrypt_token(conn["refresh_token_encrypted"])

        # Refresh the access token
        tokens = await refresh_access_token(conn["provider"], refresh_token)

        # Calculate new expiry
        token_expires_at = calculate_token_expiry(tokens.expires_in)

        # Update connection
        update_data = {
            "access_token_encrypted": encrypt_token(tokens.access_token),
            "token_expires_at": token_expires_at,
            "status": ConnectionStatus.ACTIVE.value,
            "updated_at": datetime.now(timezone.utc),
        }

        # Update refresh token if a new one was provided
        if tokens.refresh_token and tokens.refresh_token != refresh_token:
            update_data["refresh_token_encrypted"] = encrypt_token(tokens.refresh_token)

        result = await db.connections.find_one_and_update(
            {"_id": ObjectId(connection_id)},
            {"$set": update_data},
            return_document=True,
        )

        return serialize_connection(result)

    except ValueError as e:
        # Token refresh failed - mark as expired
        await db.connections.update_one(
            {"_id": ObjectId(connection_id)},
            {"$set": {"status": ConnectionStatus.EXPIRED.value}},
        )
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/providers")
async def list_providers(
    current_user: User = Depends(get_current_user)
) -> list[dict]:
    """List available OAuth providers."""
    settings = get_settings()

    providers = []

    # Only include providers that are configured
    if settings.google_client_id and settings.google_client_secret:
        providers.append({
            "id": "google",
            "name": "Google",
            "description": "Connect Gmail, Drive, and Docs",
            "scopes": [
                "Gmail (read/send)",
                "Google Drive (read)",
                "Google Docs (read)",
            ],
        })

    # Future providers would be added here

    return providers
