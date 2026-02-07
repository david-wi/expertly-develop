"""Authentication, authorization, and security utilities.

Authentication is delegated to the centralized Identity service via the
shared ``identity-client`` package.  The ``get_current_user`` dependency
returns a **dict** with the same keys the rest of the codebase expects
(``userId``, ``accountId``, ``email``, ``role``, ``name``), so existing
route files require zero changes.
"""

import secrets
import string
from typing import Optional

from fastapi import Depends, HTTPException, Request, status
from passlib.context import CryptContext

from identity_client import IdentityAuth, IdentityClient

from ..config import settings

# ---------------------------------------------------------------------------
# Identity service singletons
# ---------------------------------------------------------------------------

_identity_client: Optional[IdentityClient] = None
_identity_auth: Optional[IdentityAuth] = None


def get_identity_client() -> IdentityClient:
    global _identity_client
    if _identity_client is None:
        _identity_client = IdentityClient(base_url=settings.identity_api_url)
    return _identity_client


def get_identity_auth() -> IdentityAuth:
    global _identity_auth
    if _identity_auth is None:
        _identity_auth = IdentityAuth(
            identity_url=settings.identity_api_url,
            client=get_identity_client(),
        )
    return _identity_auth


# ---------------------------------------------------------------------------
# Role mapping: Identity roles → Intake roles
# ---------------------------------------------------------------------------

_IDENTITY_TO_INTAKE_ROLE = {
    "owner": "admin",
    "admin": "admin",
    "member": "editor",
    "viewer": "viewer",
}


def _map_role(identity_role: str) -> str:
    return _IDENTITY_TO_INTAKE_ROLE.get(identity_role, "viewer")


# ---------------------------------------------------------------------------
# FastAPI dependency — current user (compat dict)
# ---------------------------------------------------------------------------


async def get_current_user(request: Request) -> dict:
    """Validate the Identity session and return a backward-compatible dict.

    Keys returned: ``userId``, ``accountId``, ``email``, ``role``, ``name``.
    """
    auth = get_identity_auth()
    identity_user = await auth.get_current_user(request)

    if not identity_user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User account is disabled",
        )

    return {
        "userId": str(identity_user.id),
        "accountId": str(identity_user.organization_id),
        "email": identity_user.email,
        "role": _map_role(identity_user.role),
        "name": identity_user.name,
    }


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
