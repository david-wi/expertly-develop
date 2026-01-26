"""Authentication API endpoints."""

from datetime import datetime
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Request, Response, Header
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import joinedload

from app.database import get_db
from app.config import get_settings
from app.models import User, Session
from app.schemas.auth import (
    LoginRequest,
    LoginResponse,
    AuthUserResponse,
    ValidateResponse,
    SessionInfo,
)
from app.core.redis import (
    cache_session,
    get_cached_session,
    delete_cached_session,
    refresh_session_ttl,
)

router = APIRouter()
settings = get_settings()


def _user_to_auth_response(user: User) -> AuthUserResponse:
    """Convert User model to AuthUserResponse."""
    return AuthUserResponse(
        id=user.id,
        name=user.name,
        email=user.email,
        organization_id=user.organization_id,
        organization_name=user.organization.name if user.organization else None,
        role=user.role,
        avatar_url=user.avatar_url,
    )


def _set_session_cookie(response: Response, session_token: str, expires_at: datetime) -> None:
    """Set the session cookie on the response."""
    max_age = int((expires_at - datetime.utcnow()).total_seconds())
    response.set_cookie(
        key="expertly_session",
        value=session_token,
        domain=settings.auth_cookie_domain,
        path="/",
        max_age=max_age,
        httponly=True,
        secure=True,
        samesite="lax",
    )


def _clear_session_cookie(response: Response) -> None:
    """Clear the session cookie."""
    response.delete_cookie(
        key="expertly_session",
        domain=settings.auth_cookie_domain,
        path="/",
    )


@router.post("/login", response_model=LoginResponse)
async def login(
    login_data: LoginRequest,
    request: Request,
    response: Response,
    db: AsyncSession = Depends(get_db),
):
    """
    Authenticate user and create a new session.

    Returns session token and sets cookie on parent domain.
    """
    # Find user by email (case-insensitive)
    query = (
        select(User)
        .options(joinedload(User.organization))
        .where(User.email.ilike(login_data.email))
        .where(User.is_active == True)
    )
    result = await db.execute(query)
    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(status_code=401, detail="Invalid email or password")

    # Verify password
    if not user.verify_password(login_data.password):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    # Create session
    session = Session.create_new(
        user_id=user.id,
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
    )
    db.add(session)
    await db.commit()
    await db.refresh(session)

    # Cache session in Redis
    user_data = {
        "id": str(user.id),
        "name": user.name,
        "email": user.email,
        "organization_id": str(user.organization_id),
        "organization_name": user.organization.name if user.organization else None,
        "role": user.role,
        "avatar_url": user.avatar_url,
    }
    await cache_session(session.session_token, user_data)

    # Set cookie
    _set_session_cookie(response, session.session_token, session.expires_at)

    return LoginResponse(
        session_token=session.session_token,
        expires_at=session.expires_at,
        user=_user_to_auth_response(user),
    )


@router.post("/logout")
async def logout(
    response: Response,
    session_token: Optional[str] = Header(None, alias="X-Session-Token"),
    db: AsyncSession = Depends(get_db),
):
    """
    Invalidate the current session.

    Accepts session token from header or cookie.
    """
    if not session_token:
        _clear_session_cookie(response)
        return {"message": "Logged out"}

    # Delete from database
    query = select(Session).where(Session.session_token == session_token)
    result = await db.execute(query)
    session = result.scalar_one_or_none()

    if session:
        await db.delete(session)
        await db.commit()

    # Delete from Redis cache
    await delete_cached_session(session_token)

    # Clear cookie
    _clear_session_cookie(response)

    return {"message": "Logged out successfully"}


@router.get("/validate", response_model=ValidateResponse)
async def validate_session(
    session_token: Optional[str] = Header(None, alias="X-Session-Token"),
    db: AsyncSession = Depends(get_db),
):
    """
    Validate a session token.

    First checks Redis cache, then falls back to database.
    Returns user info if session is valid.
    """
    if not session_token:
        return ValidateResponse(valid=False)

    # Try Redis cache first
    cached = await get_cached_session(session_token)
    if cached:
        await refresh_session_ttl(session_token)
        return ValidateResponse(
            valid=True,
            user=AuthUserResponse(
                id=cached["id"],
                name=cached["name"],
                email=cached["email"],
                organization_id=cached["organization_id"],
                organization_name=cached.get("organization_name"),
                role=cached["role"],
                avatar_url=cached.get("avatar_url"),
            ),
            expires_at=None,  # Not stored in cache
        )

    # Fallback to database
    query = (
        select(Session)
        .options(joinedload(Session.user).joinedload(User.organization))
        .where(Session.session_token == session_token)
    )
    result = await db.execute(query)
    session = result.scalar_one_or_none()

    if not session:
        return ValidateResponse(valid=False)

    if session.is_expired():
        # Clean up expired session
        await db.delete(session)
        await db.commit()
        return ValidateResponse(valid=False)

    # Update activity
    session.update_activity()
    await db.commit()

    # Re-cache session
    user = session.user
    user_data = {
        "id": str(user.id),
        "name": user.name,
        "email": user.email,
        "organization_id": str(user.organization_id),
        "organization_name": user.organization.name if user.organization else None,
        "role": user.role,
        "avatar_url": user.avatar_url,
    }
    await cache_session(session_token, user_data)

    return ValidateResponse(
        valid=True,
        user=_user_to_auth_response(user),
        expires_at=session.expires_at,
    )


@router.get("/me", response_model=AuthUserResponse)
async def get_current_user(
    session_token: Optional[str] = Header(None, alias="X-Session-Token"),
    db: AsyncSession = Depends(get_db),
):
    """
    Get the current authenticated user.

    Returns 401 if not authenticated.
    """
    if not session_token:
        raise HTTPException(status_code=401, detail="Not authenticated")

    # Validate session
    validation = await validate_session(session_token, db)

    if not validation.valid or not validation.user:
        raise HTTPException(status_code=401, detail="Session invalid or expired")

    return validation.user


@router.get("/sessions", response_model=list[SessionInfo])
async def list_sessions(
    session_token: Optional[str] = Header(None, alias="X-Session-Token"),
    db: AsyncSession = Depends(get_db),
):
    """
    List all active sessions for the current user.
    """
    if not session_token:
        raise HTTPException(status_code=401, detail="Not authenticated")

    # Get current session to find user
    query = select(Session).where(Session.session_token == session_token)
    result = await db.execute(query)
    current_session = result.scalar_one_or_none()

    if not current_session or current_session.is_expired():
        raise HTTPException(status_code=401, detail="Session invalid or expired")

    # Get all sessions for this user
    query = (
        select(Session)
        .where(Session.user_id == current_session.user_id)
        .where(Session.expires_at > datetime.utcnow())
        .order_by(Session.last_active_at.desc())
    )
    result = await db.execute(query)
    sessions = result.scalars().all()

    return [SessionInfo.model_validate(s) for s in sessions]


@router.delete("/sessions/{session_id}")
async def revoke_session(
    session_id: str,
    response: Response,
    session_token: Optional[str] = Header(None, alias="X-Session-Token"),
    db: AsyncSession = Depends(get_db),
):
    """
    Revoke a specific session.
    """
    if not session_token:
        raise HTTPException(status_code=401, detail="Not authenticated")

    # Get current session to verify ownership
    query = select(Session).where(Session.session_token == session_token)
    result = await db.execute(query)
    current_session = result.scalar_one_or_none()

    if not current_session or current_session.is_expired():
        raise HTTPException(status_code=401, detail="Session invalid or expired")

    # Find target session
    query = select(Session).where(Session.id == session_id)
    result = await db.execute(query)
    target_session = result.scalar_one_or_none()

    if not target_session:
        raise HTTPException(status_code=404, detail="Session not found")

    # Verify ownership
    if target_session.user_id != current_session.user_id:
        raise HTTPException(status_code=403, detail="Cannot revoke another user's session")

    # Delete from Redis
    await delete_cached_session(target_session.session_token)

    # Delete from database
    await db.delete(target_session)
    await db.commit()

    # If revoking current session, clear cookie
    if target_session.id == current_session.id:
        _clear_session_cookie(response)

    return {"message": "Session revoked"}
