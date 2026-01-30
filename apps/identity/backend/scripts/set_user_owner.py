#!/usr/bin/env python3
"""Script to set a user as owner by email.

Usage:
    python scripts/set_user_owner.py <email>

Example:
    python scripts/set_user_owner.py david@expertly.com
"""

import asyncio
import sys
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker

# Add the app directory to the path
sys.path.insert(0, "/app")

from app.config import get_settings
from app.models import User, Organization


async def set_user_as_owner(email: str):
    """Find a user by email and set their role to owner."""
    settings = get_settings()
    engine = create_async_engine(settings.database_url)
    async_session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with async_session() as session:
        # Find user by email (case-insensitive)
        result = await session.execute(
            select(User).where(func.lower(User.email) == email.lower())
        )
        user = result.scalar_one_or_none()

        if not user:
            print(f"Error: No user found with email '{email}'")
            return False

        # Get organization name for display
        org_result = await session.execute(
            select(Organization).where(Organization.id == user.organization_id)
        )
        org = org_result.scalar_one_or_none()
        org_name = org.name if org else "Unknown"

        if user.role == "owner":
            print(f"User '{user.name}' ({email}) in organization '{org_name}' is already an owner.")
            return True

        old_role = user.role
        user.role = "owner"
        await session.commit()

        print(f"Success: Updated user '{user.name}' ({email}) in organization '{org_name}'")
        print(f"  Role changed: {old_role} -> owner")
        return True


def main():
    if len(sys.argv) < 2:
        print("Usage: python scripts/set_user_owner.py <email>")
        print("Example: python scripts/set_user_owner.py david@expertly.com")
        sys.exit(1)

    email = sys.argv[1]
    result = asyncio.run(set_user_as_owner(email))
    sys.exit(0 if result else 1)


if __name__ == "__main__":
    main()
