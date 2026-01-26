"""Seed script to create test user for authentication."""

import asyncio
from sqlalchemy import select

from app.database import async_session, init_db
from app.models import Organization, User


async def seed_test_user():
    """Create a test organization and user for authentication testing."""
    await init_db()

    async with async_session() as db:
        # Check if test org already exists
        query = select(Organization).where(Organization.slug == "expertly")
        result = await db.execute(query)
        org = result.scalar_one_or_none()

        if not org:
            # Create test organization
            org = Organization(
                name="Expertly",
                slug="expertly",
                is_active=True,
            )
            db.add(org)
            await db.commit()
            await db.refresh(org)
            print(f"Created organization: {org.name} (ID: {org.id})")
        else:
            print(f"Organization already exists: {org.name} (ID: {org.id})")

        # Check if test user already exists
        query = select(User).where(User.email == "david@example.com")
        result = await db.execute(query)
        user = result.scalar_one_or_none()

        if not user:
            # Create test user
            user = User(
                organization_id=org.id,
                name="David",
                email="david@example.com",
                user_type="human",
                role="owner",
                is_active=True,
                is_default=True,
            )
            user.set_password("expertly123")
            db.add(user)
            await db.commit()
            await db.refresh(user)
            print(f"Created user: {user.email} (ID: {user.id})")
            print("Password: expertly123")
        else:
            # Update password if user exists
            user.set_password("expertly123")
            await db.commit()
            print(f"User already exists: {user.email} (ID: {user.id})")
            print("Password updated to: expertly123")


if __name__ == "__main__":
    asyncio.run(seed_test_user())
