"""Seed script to create a demo organization with lots of sample data."""

import asyncio
from sqlalchemy import select

from app.database import async_session, init_db
from app.models import Organization, User, Team, TeamMember


# Demo organization details
DEMO_ORG = {
    "name": "Acme Corporation",
    "slug": "acme-demo",
}

# Demo users - mix of humans and bots
DEMO_USERS = [
    # Leadership
    {"name": "Sarah Chen", "email": "sarah.chen@acme.demo", "role": "owner", "user_type": "human", "title": "CEO"},
    {"name": "Marcus Johnson", "email": "marcus.johnson@acme.demo", "role": "admin", "user_type": "human", "title": "CTO"},
    {"name": "Emily Rodriguez", "email": "emily.rodriguez@acme.demo", "role": "admin", "user_type": "human", "title": "VP of Operations"},

    # Engineering team
    {"name": "Alex Kim", "email": "alex.kim@acme.demo", "role": "member", "user_type": "human", "title": "Senior Engineer"},
    {"name": "Jordan Lee", "email": "jordan.lee@acme.demo", "role": "member", "user_type": "human", "title": "Software Engineer"},
    {"name": "Taylor Swift", "email": "taylor.swift@acme.demo", "role": "member", "user_type": "human", "title": "DevOps Engineer"},
    {"name": "Casey Morgan", "email": "casey.morgan@acme.demo", "role": "member", "user_type": "human", "title": "QA Engineer"},

    # Sales team
    {"name": "Ryan O'Connor", "email": "ryan.oconnor@acme.demo", "role": "member", "user_type": "human", "title": "Sales Director"},
    {"name": "Priya Patel", "email": "priya.patel@acme.demo", "role": "member", "user_type": "human", "title": "Account Executive"},
    {"name": "Derek Williams", "email": "derek.williams@acme.demo", "role": "member", "user_type": "human", "title": "Sales Rep"},

    # Support team
    {"name": "Michelle Torres", "email": "michelle.torres@acme.demo", "role": "member", "user_type": "human", "title": "Support Manager"},
    {"name": "Chris Anderson", "email": "chris.anderson@acme.demo", "role": "member", "user_type": "human", "title": "Support Specialist"},

    # Bots
    {"name": "Acme Assistant", "email": None, "role": "member", "user_type": "bot", "title": "AI Assistant"},
    {"name": "Deploy Bot", "email": None, "role": "member", "user_type": "bot", "title": "Deployment Automation"},
    {"name": "Monitor Bot", "email": None, "role": "member", "user_type": "bot", "title": "System Monitor"},
    {"name": "Sales Bot", "email": None, "role": "member", "user_type": "bot", "title": "Lead Qualification"},
]

# Demo teams
DEMO_TEAMS = [
    {
        "name": "Engineering",
        "description": "Product development and technical infrastructure",
        "members": ["Marcus Johnson", "Alex Kim", "Jordan Lee", "Taylor Swift", "Casey Morgan", "Deploy Bot", "Monitor Bot"],
        "lead": "Marcus Johnson",
    },
    {
        "name": "Sales",
        "description": "Revenue generation and customer acquisition",
        "members": ["Ryan O'Connor", "Priya Patel", "Derek Williams", "Sales Bot"],
        "lead": "Ryan O'Connor",
    },
    {
        "name": "Customer Success",
        "description": "Customer support and satisfaction",
        "members": ["Michelle Torres", "Chris Anderson", "Acme Assistant"],
        "lead": "Michelle Torres",
    },
    {
        "name": "Leadership",
        "description": "Executive team and strategic planning",
        "members": ["Sarah Chen", "Marcus Johnson", "Emily Rodriguez", "Ryan O'Connor"],
        "lead": "Sarah Chen",
    },
]


async def seed_demo_org():
    """Create a demo organization with users, teams, and sample data."""
    await init_db()

    async with async_session() as db:
        # Check if demo org already exists
        query = select(Organization).where(Organization.slug == DEMO_ORG["slug"])
        result = await db.execute(query)
        org = result.scalar_one_or_none()

        if org:
            print(f"Demo organization already exists: {org.name} (ID: {org.id})")
            print("To recreate, delete the organization first.")
            return org.id

        # Create demo organization
        org = Organization(
            name=DEMO_ORG["name"],
            slug=DEMO_ORG["slug"],
            is_active=True,
        )
        db.add(org)
        await db.commit()
        await db.refresh(org)
        print(f"Created organization: {org.name} (ID: {org.id})")

        # Create users
        user_map = {}  # name -> user object
        for user_data in DEMO_USERS:
            user = User(
                organization_id=org.id,
                name=user_data["name"],
                email=user_data["email"],
                user_type=user_data["user_type"],
                role=user_data["role"],
                title=user_data.get("title"),
                is_active=True,
                is_default=False,
            )
            if user_data["email"]:
                user.set_password("demo123")  # Default password for demo users
            db.add(user)
            await db.flush()
            user_map[user_data["name"]] = user
            print(f"  Created user: {user.name} ({user.user_type})")

        await db.commit()

        # Create teams
        for team_data in DEMO_TEAMS:
            team = Team(
                organization_id=org.id,
                name=team_data["name"],
                description=team_data["description"],
            )
            db.add(team)
            await db.flush()
            print(f"  Created team: {team.name}")

            # Add members
            for member_name in team_data["members"]:
                if member_name in user_map:
                    role = "lead" if member_name == team_data["lead"] else "member"
                    member = TeamMember(
                        team_id=team.id,
                        user_id=user_map[member_name].id,
                        role=role,
                    )
                    db.add(member)

        await db.commit()

        print(f"\nDemo organization created successfully!")
        print(f"  Organization: {org.name} (slug: {org.slug})")
        print(f"  Users: {len(DEMO_USERS)}")
        print(f"  Teams: {len(DEMO_TEAMS)}")
        print(f"\nLogin credentials for human users:")
        print(f"  Password: demo123")
        print(f"  Example: sarah.chen@acme.demo / demo123")

        return org.id


async def add_david_to_demo_org():
    """Add the existing David user to the demo organization for easy testing."""
    async with async_session() as db:
        # Get demo org
        query = select(Organization).where(Organization.slug == DEMO_ORG["slug"])
        result = await db.execute(query)
        org = result.scalar_one_or_none()

        if not org:
            print("Demo org not found. Run seed_demo_org first.")
            return

        # Get David's user from the main org
        query = select(User).where(User.email == "david@example.com")
        result = await db.execute(query)
        david = result.scalar_one_or_none()

        if not david:
            print("David user not found.")
            return

        # Check if David already exists in demo org
        query = select(User).where(
            User.organization_id == org.id,
            User.email == "david@example.com"
        )
        result = await db.execute(query)
        existing = result.scalar_one_or_none()

        if existing:
            print(f"David already exists in demo org (ID: {existing.id})")
            return

        # Create David in demo org as owner
        demo_david = User(
            organization_id=org.id,
            name="David",
            email="david@example.com",
            user_type="human",
            role="owner",
            title="Demo Administrator",
            is_active=True,
            is_default=False,
        )
        demo_david.set_password("expertly123")
        db.add(demo_david)
        await db.commit()
        print(f"Added David to demo org with owner role")
        print(f"Login: david@example.com / expertly123")


if __name__ == "__main__":
    asyncio.run(seed_demo_org())
    asyncio.run(add_david_to_demo_org())
