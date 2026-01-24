"""Common API dependencies."""

from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.utils.auth import get_current_user, get_current_tenant
from app.models import User, Tenant


class CurrentContext:
    """Container for current request context."""

    def __init__(self, db: AsyncSession, user: User, tenant: Tenant):
        self.db = db
        self.user = user
        self.tenant = tenant


async def get_context(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
    tenant: Tenant = Depends(get_current_tenant),
) -> CurrentContext:
    """Get current request context with db, user, and tenant."""
    return CurrentContext(db=db, user=user, tenant=tenant)
