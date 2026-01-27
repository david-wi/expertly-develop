"""Authentication API endpoints."""

import secrets
import logging
from datetime import datetime, timedelta
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Request, Response, Header
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete as sql_delete
from sqlalchemy.orm import joinedload

from app.database import get_db
from app.config import get_settings
from app.models import User, Session, MagicCode
from app.schemas.auth import (
    LoginRequest,
    LoginResponse,
    AuthUserResponse,
    ValidateResponse,
    SessionInfo,
    MagicCodeRequest,
    MagicCodeResponse,
    MagicCodeVerifyRequest,
    ChangePasswordRequest,
    ChangePasswordResponse,
    ForgotPasswordRequest,
    ForgotPasswordResponse,
    ResetPasswordRequest,
    ResetPasswordResponse,
)
from app.core.redis import (
    cache_session,
    get_cached_session,
    delete_cached_session,
    refresh_session_ttl,
)
from app.core.password import validate_password_strength
from app.core.email import send_magic_code_email, send_password_reset_email

logger = logging.getLogger(__name__)

# Allowed email domains for magic code login
MAGIC_CODE_ALLOWED_DOMAINS = {"expertly.com", "webintensive.com"}

# Password reset token expiry
RESET_TOKEN_EXPIRY_MINUTES = 15

router = APIRouter()
settings = get_settings()


def _get_session_token(
    request: Request,
    session_token_header: Optional[str] = None,
) -> Optional[str]:
    """Get session token from header or cookie."""
    # Prefer header if provided
    if session_token_header:
        return session_token_header
    # Fall back to cookie
    return request.cookies.get("expertly_session")


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


# =====================
# Magic Code (Passwordless Login)
# =====================

def _is_magic_code_allowed(email: str) -> bool:
    """Check if the email domain is allowed for magic code login."""
    domain = email.lower().split("@")[-1]
    return domain in MAGIC_CODE_ALLOWED_DOMAINS


@router.post("/magic-code/request", response_model=MagicCodeResponse)
async def request_magic_code(
    request_data: MagicCodeRequest,
    db: AsyncSession = Depends(get_db),
):
    """
    Request a magic code for passwordless login.

    Only available for @expertly.com and @webintensive.com domains.
    """
    email = request_data.email.lower()

    # Check if domain is allowed
    if not _is_magic_code_allowed(email):
        raise HTTPException(
            status_code=403,
            detail="Magic code login is only available for @expertly.com and @webintensive.com email addresses"
        )

    # Check if user exists
    query = (
        select(User)
        .options(joinedload(User.organization))
        .where(User.email.ilike(email))
        .where(User.is_active == True)
    )
    result = await db.execute(query)
    user = result.scalar_one_or_none()

    if not user:
        # Return success anyway to prevent email enumeration
        logger.warning(f"Magic code requested for non-existent user: {email}")
        return MagicCodeResponse(
            message="If an account exists with this email, a login code has been sent.",
            expires_in_minutes=15
        )

    # Delete any existing codes for this email
    await db.execute(
        sql_delete(MagicCode).where(MagicCode.email == email)
    )

    # Create new magic code
    magic_code = MagicCode.create_new(email)
    db.add(magic_code)
    await db.commit()

    # Send email
    await send_magic_code_email(email, magic_code.code)
    logger.info(f"Magic code sent to {email}: {magic_code.code}")  # Remove in production

    return MagicCodeResponse(
        message="If an account exists with this email, a login code has been sent.",
        expires_in_minutes=15
    )


@router.post("/magic-code/verify", response_model=LoginResponse)
async def verify_magic_code(
    verify_data: MagicCodeVerifyRequest,
    request: Request,
    response: Response,
    db: AsyncSession = Depends(get_db),
):
    """
    Verify a magic code and create a session.

    Returns session token and sets cookie on success.
    """
    email = verify_data.email.lower()
    code = verify_data.code.upper()

    # Find the magic code
    query = (
        select(MagicCode)
        .where(MagicCode.email == email)
        .where(MagicCode.used == False)
    )
    result = await db.execute(query)
    magic_code = result.scalar_one_or_none()

    if not magic_code:
        raise HTTPException(status_code=401, detail="Invalid or expired code")

    if magic_code.is_expired():
        await db.delete(magic_code)
        await db.commit()
        raise HTTPException(status_code=401, detail="Code has expired")

    # Check the code
    if magic_code.code != code:
        attempts = magic_code.increment_attempts()
        await db.commit()

        if attempts >= 5:
            await db.delete(magic_code)
            await db.commit()
            raise HTTPException(
                status_code=401,
                detail="Too many failed attempts. Please request a new code."
            )

        raise HTTPException(
            status_code=401,
            detail=f"Invalid code. {5 - attempts} attempts remaining."
        )

    # Mark code as used
    magic_code.mark_used()

    # Find the user
    query = (
        select(User)
        .options(joinedload(User.organization))
        .where(User.email.ilike(email))
        .where(User.is_active == True)
    )
    result = await db.execute(query)
    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(status_code=401, detail="Account not found")

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


# =====================
# Password Management
# =====================

@router.post("/password/change", response_model=ChangePasswordResponse)
async def change_password(
    password_data: ChangePasswordRequest,
    request: Request,
    session_token_header: Optional[str] = Header(None, alias="X-Session-Token"),
    db: AsyncSession = Depends(get_db),
):
    """
    Change password for the authenticated user.

    Requires current password for verification.
    """
    session_token = _get_session_token(request, session_token_header)
    if not session_token:
        raise HTTPException(status_code=401, detail="Not authenticated")

    # Validate session
    validation = await validate_session(session_token, db)
    if not validation.valid or not validation.user:
        raise HTTPException(status_code=401, detail="Session invalid or expired")

    # Get the user
    query = select(User).where(User.id == validation.user.id)
    result = await db.execute(query)
    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(status_code=401, detail="User not found")

    # Verify current password
    if not user.verify_password(password_data.current_password):
        raise HTTPException(status_code=401, detail="Current password is incorrect")

    # Validate new password strength
    errors = validate_password_strength(password_data.new_password, user.email)
    if errors:
        raise HTTPException(
            status_code=400,
            detail={"message": "Password does not meet requirements", "errors": errors}
        )

    # Update password
    user.set_password(password_data.new_password)
    await db.commit()

    return ChangePasswordResponse(message="Password changed successfully")


@router.post("/password/forgot", response_model=ForgotPasswordResponse)
async def forgot_password(
    forgot_data: ForgotPasswordRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """
    Request a password reset email.

    Sends an email with a reset link if the account exists.
    """
    email = forgot_data.email.lower()

    # Find the user
    query = (
        select(User)
        .where(User.email.ilike(email))
        .where(User.is_active == True)
    )
    result = await db.execute(query)
    user = result.scalar_one_or_none()

    if not user:
        # Return success anyway to prevent email enumeration
        logger.warning(f"Password reset requested for non-existent user: {email}")
        return ForgotPasswordResponse(
            message="If an account exists with this email, a password reset link has been sent."
        )

    # Generate reset token (using magic code for simplicity)
    # Delete any existing codes for this email
    await db.execute(
        sql_delete(MagicCode).where(MagicCode.email == email)
    )

    # Create a longer token for password reset
    reset_token = secrets.token_urlsafe(32)
    magic_code = MagicCode(
        email=email,
        code=reset_token,  # Store the token in the code field
        expires_at=datetime.utcnow() + timedelta(minutes=RESET_TOKEN_EXPIRY_MINUTES),
    )
    db.add(magic_code)
    await db.commit()

    # Build reset URL
    # Use the request's origin or default to identity URL
    base_url = settings.identity_frontend_url or "https://identity.ai.devintensive.com"
    reset_url = f"{base_url}/reset-password?token={reset_token}&email={email}"

    # Send email
    await send_password_reset_email(email, reset_token, reset_url)
    logger.info(f"Password reset email sent to {email}")

    return ForgotPasswordResponse(
        message="If an account exists with this email, a password reset link has been sent."
    )


@router.post("/password/reset", response_model=ResetPasswordResponse)
async def reset_password(
    reset_data: ResetPasswordRequest,
    db: AsyncSession = Depends(get_db),
):
    """
    Reset password using a token from the password reset email.
    """
    # Find the magic code entry with this token
    query = (
        select(MagicCode)
        .where(MagicCode.code == reset_data.token)
        .where(MagicCode.used == False)
    )
    result = await db.execute(query)
    magic_code = result.scalar_one_or_none()

    if not magic_code:
        raise HTTPException(status_code=401, detail="Invalid or expired reset link")

    if magic_code.is_expired():
        await db.delete(magic_code)
        await db.commit()
        raise HTTPException(status_code=401, detail="Reset link has expired")

    # Find the user
    query = (
        select(User)
        .where(User.email.ilike(magic_code.email))
        .where(User.is_active == True)
    )
    result = await db.execute(query)
    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(status_code=401, detail="Account not found")

    # Validate new password strength
    errors = validate_password_strength(reset_data.new_password, user.email)
    if errors:
        raise HTTPException(
            status_code=400,
            detail={"message": "Password does not meet requirements", "errors": errors}
        )

    # Update password
    user.set_password(reset_data.new_password)

    # Mark token as used
    magic_code.mark_used()

    await db.commit()

    return ResetPasswordResponse(message="Password has been reset successfully. You can now log in.")
