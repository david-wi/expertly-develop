"""Common API dependencies.

User and Tenant data comes from Identity service (no local tables).
"""

from uuid import UUID
from fastapi import Depends, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.utils.auth import get_current_user, get_tenant_id, get_user_id
from identity_client.models import User as IdentityUser


class CurrentContext:
    """Container for current request context.

    Uses IdentityUser directly - no local User/Tenant models.
    """

    def __init__(self, db: AsyncSession, user: IdentityUser):
        self.db = db
        self.user = user
        # Convenience properties for tenant/user IDs as UUID
        self.tenant_id = UUID(user.organization_id)
        self.user_id = UUID(user.id)

    @property
    def tenant(self):
        """Backwards compatibility - returns object with id attribute."""
        class TenantProxy:
            def __init__(self, org_id: str):
                self.id = UUID(org_id)
        return TenantProxy(self.user.organization_id)


async def get_context(
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> CurrentContext:
    """Get current request context with db and user from Identity."""
    user = await get_current_user(request)
    return CurrentContext(db=db, user=user)
