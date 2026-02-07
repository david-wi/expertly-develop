"""Authentication, authorization, and security utilities."""

import secrets
import string
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt
from passlib.context import CryptContext

from ..config import settings

# ---------------------------------------------------------------------------
# Password hashing
# ---------------------------------------------------------------------------

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def hash_password(plain: str) -> str:
    """Hash a plain-text password using bcrypt."""
    return pwd_context.hash(plain)


def verify_password(plain: str, hashed: str) -> bool:
    """Verify a plain-text password against a bcrypt hash."""
    return pwd_context.verify(plain, hashed)


# ---------------------------------------------------------------------------
# Intake code generation & verification
# ---------------------------------------------------------------------------

_CODE_ALPHABET = string.ascii_uppercase + string.digits
_CODE_LENGTH = 6

# Separate context so intake-code hashes are never confused with passwords.
_code_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def generate_intake_code() -> tuple[str, str]:
    """Generate a random 6-character alphanumeric intake code.

    Returns:
        (plain_code, hashed_code)
    """
    plain = "".join(secrets.choice(_CODE_ALPHABET) for _ in range(_CODE_LENGTH))
    hashed = _code_context.hash(plain)
    return plain, hashed


def hash_intake_code(plain: str) -> str:
    """Hash an intake code with bcrypt."""
    return _code_context.hash(plain.upper())


def verify_intake_code(plain: str, hashed: str) -> bool:
    """Verify a plain intake code against its bcrypt hash."""
    return _code_context.verify(plain.upper(), hashed)


# ---------------------------------------------------------------------------
# PIN generation
# ---------------------------------------------------------------------------


def generate_pin() -> str:
    """Generate a 4-digit numeric PIN."""
    return f"{secrets.randbelow(10000):04d}"


# ---------------------------------------------------------------------------
# JWT helpers
# ---------------------------------------------------------------------------


def create_access_token(
    data: dict,
    expires_delta: Optional[timedelta] = None,
) -> str:
    """Create a signed JWT access token.

    Args:
        data: Claims to embed in the token.  Must include at least ``sub``.
        expires_delta: Custom lifetime.  Defaults to ``settings.access_token_expire_minutes``.

    Returns:
        Encoded JWT string.
    """
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + (
        expires_delta
        if expires_delta is not None
        else timedelta(minutes=settings.access_token_expire_minutes)
    )
    to_encode.update({"exp": expire, "iat": datetime.now(timezone.utc)})
    return jwt.encode(
        to_encode,
        settings.jwt_secret_key,
        algorithm=settings.jwt_algorithm,
    )


def decode_access_token(token: str) -> dict:
    """Decode and verify a JWT access token.

    Raises:
        JWTError: When the token is invalid, expired, or tampered with.

    Returns:
        The decoded claims dictionary.
    """
    return jwt.decode(
        token,
        settings.jwt_secret_key,
        algorithms=[settings.jwt_algorithm],
    )


# ---------------------------------------------------------------------------
# FastAPI dependencies
# ---------------------------------------------------------------------------

_bearer_scheme = HTTPBearer(auto_error=True)


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(_bearer_scheme),
) -> dict:
    """Extract and validate the current user from the bearer token.

    Returns a dict with at least ``userId``, ``accountId``, ``email``, ``role``.
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = decode_access_token(credentials.credentials)
        user_id: Optional[str] = payload.get("sub")
        if user_id is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception

    # Build a lightweight user dict from token claims.
    user = {
        "userId": user_id,
        "accountId": payload.get("accountId"),
        "email": payload.get("email"),
        "role": payload.get("role"),
        "name": payload.get("name"),
    }
    if not user["accountId"]:
        raise credentials_exception
    return user


# ---------------------------------------------------------------------------
# Role hierarchy & role-based dependencies
# ---------------------------------------------------------------------------

ROLES = ("external_contributor", "viewer", "editor", "admin")
_ROLE_RANK = {role: idx for idx, role in enumerate(ROLES)}


def _role_rank(role: str) -> int:
    return _ROLE_RANK.get(role, -1)


def _require_minimum_role(minimum: str):
    """Factory that returns a FastAPI dependency enforcing a minimum role."""
    min_rank = _role_rank(minimum)

    async def _dependency(current_user: dict = Depends(get_current_user)) -> dict:
        user_role = current_user.get("role", "")
        if _role_rank(user_role) < min_rank:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Role '{user_role}' does not have sufficient permissions. "
                f"Minimum required: '{minimum}'.",
            )
        return current_user

    return _dependency


require_admin = _require_minimum_role("admin")
require_editor_or_above = _require_minimum_role("editor")
require_viewer_or_above = _require_minimum_role("viewer")
