"""Identity Client - Shared authentication client for Expertly Identity service."""

from identity_client.client import IdentityClient
from identity_client.models import (
    User,
    Organization,
    Team,
    TeamMember,
    ValidateResponse,
    UserType,
    UserRole,
)
from identity_client.auth import IdentityAuth
from identity_client.dependencies import (
    get_current_user,
    get_current_user_optional,
    require_auth,
    require_role,
    get_identity_client,
)

__all__ = [
    # Client
    "IdentityClient",
    # Auth middleware
    "IdentityAuth",
    # Models
    "User",
    "Organization",
    "Team",
    "TeamMember",
    "ValidateResponse",
    "UserType",
    "UserRole",
    # Dependencies
    "get_current_user",
    "get_current_user_optional",
    "require_auth",
    "require_role",
    "get_identity_client",
]
