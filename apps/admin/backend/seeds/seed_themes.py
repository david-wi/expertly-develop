"""Seed script to populate initial themes (violet and ocean)."""

import asyncio
import uuid
from datetime import datetime, timezone

from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession

from app.config import get_settings
from app.models.theme import Theme, ThemeVersion, ThemeVersionStatus

# Theme data matching the existing themes.ts
THEMES_DATA = [
    {
        "name": "Violet",
        "slug": "violet",
        "description": "Classic violet theme - the default Expertly color scheme",
        "is_default": True,
        "colors": {
            "light": {
                "primary": {
                    "50": "#f5f3ff",
                    "100": "#ede9fe",
                    "200": "#ddd6fe",
                    "300": "#c4b5fd",
                    "400": "#a78bfa",
                    "500": "#8b5cf6",
                    "600": "#7c3aed",
                    "700": "#6d28d9",
                    "800": "#5b21b6",
                    "900": "#4c1d95",
                    "950": "#2e1065",
                },
                "background": {
                    "default": "#f9fafb",
                    "surface": "#ffffff",
                    "elevated": "#ffffff",
                },
                "text": {
                    "primary": "#111827",
                    "secondary": "#4b5563",
                    "muted": "#6b7280",
                },
                "border": {
                    "default": "#e5e7eb",
                    "subtle": "#f3f4f6",
                },
            },
            "dark": {
                "primary": {
                    "50": "#f5f3ff",
                    "100": "#ede9fe",
                    "200": "#ddd6fe",
                    "300": "#c4b5fd",
                    "400": "#a78bfa",
                    "500": "#8b5cf6",
                    "600": "#7c3aed",
                    "700": "#6d28d9",
                    "800": "#5b21b6",
                    "900": "#4c1d95",
                    "950": "#2e1065",
                },
                "background": {
                    "default": "#111827",
                    "surface": "#1f2937",
                    "elevated": "#374151",
                },
                "text": {
                    "primary": "#f9fafb",
                    "secondary": "#9ca3af",
                    "muted": "#6b7280",
                },
                "border": {
                    "default": "#374151",
                    "subtle": "#1f2937",
                },
            },
        },
    },
    {
        "name": "Ocean",
        "slug": "ocean",
        "description": "Cool ocean-inspired teal theme",
        "is_default": False,
        "colors": {
            "light": {
                "primary": {
                    "50": "#f0fdfa",
                    "100": "#ccfbf1",
                    "200": "#99f6e4",
                    "300": "#5eead4",
                    "400": "#2dd4bf",
                    "500": "#14b8a6",
                    "600": "#0d9488",
                    "700": "#0f766e",
                    "800": "#115e59",
                    "900": "#134e4a",
                    "950": "#042f2e",
                },
                "background": {
                    "default": "#f9fafb",
                    "surface": "#ffffff",
                    "elevated": "#ffffff",
                },
                "text": {
                    "primary": "#111827",
                    "secondary": "#4b5563",
                    "muted": "#6b7280",
                },
                "border": {
                    "default": "#e5e7eb",
                    "subtle": "#f3f4f6",
                },
            },
            "dark": {
                "primary": {
                    "50": "#f0fdfa",
                    "100": "#ccfbf1",
                    "200": "#99f6e4",
                    "300": "#5eead4",
                    "400": "#2dd4bf",
                    "500": "#14b8a6",
                    "600": "#0d9488",
                    "700": "#0f766e",
                    "800": "#115e59",
                    "900": "#134e4a",
                    "950": "#042f2e",
                },
                "background": {
                    "default": "#0f172a",
                    "surface": "#1e293b",
                    "elevated": "#334155",
                },
                "text": {
                    "primary": "#f8fafc",
                    "secondary": "#94a3b8",
                    "muted": "#64748b",
                },
                "border": {
                    "default": "#334155",
                    "subtle": "#1e293b",
                },
            },
        },
    },
    {
        "name": "Emerald",
        "slug": "emerald",
        "description": "Fresh green theme - professional and vibrant",
        "is_default": False,
        "colors": {
            "light": {
                "primary": {
                    "50": "#f0fdf4",
                    "100": "#dcfce7",
                    "200": "#bbf7d0",
                    "300": "#86efac",
                    "400": "#4ade80",
                    "500": "#22c55e",
                    "600": "#16a34a",
                    "700": "#15803d",
                    "800": "#166534",
                    "900": "#14532d",
                    "950": "#052e16",
                },
                "background": {
                    "default": "#f9fafb",
                    "surface": "#ffffff",
                    "elevated": "#ffffff",
                },
                "text": {
                    "primary": "#111827",
                    "secondary": "#4b5563",
                    "muted": "#6b7280",
                },
                "border": {
                    "default": "#e5e7eb",
                    "subtle": "#f3f4f6",
                },
            },
            "dark": {
                "primary": {
                    "50": "#f0fdf4",
                    "100": "#dcfce7",
                    "200": "#bbf7d0",
                    "300": "#86efac",
                    "400": "#4ade80",
                    "500": "#22c55e",
                    "600": "#16a34a",
                    "700": "#15803d",
                    "800": "#166534",
                    "900": "#14532d",
                    "950": "#052e16",
                },
                "background": {
                    "default": "#111827",
                    "surface": "#1f2937",
                    "elevated": "#374151",
                },
                "text": {
                    "primary": "#f9fafb",
                    "secondary": "#9ca3af",
                    "muted": "#6b7280",
                },
                "border": {
                    "default": "#374151",
                    "subtle": "#1f2937",
                },
            },
        },
    },
]


async def seed_themes(db: AsyncSession):
    """Seed the initial themes."""
    now = datetime.now(timezone.utc)

    for theme_data in THEMES_DATA:
        theme_id = uuid.uuid4()

        # Create theme
        theme = Theme(
            id=theme_id,
            name=theme_data["name"],
            slug=theme_data["slug"],
            description=theme_data["description"],
            is_default=theme_data["is_default"],
            is_active=True,
            current_version=1,
            created_at=now,
            updated_at=now,
        )
        db.add(theme)

        # Create initial version
        version = ThemeVersion(
            id=uuid.uuid4(),
            theme_id=theme_id,
            version_number=1,
            snapshot=theme_data["colors"],
            change_summary="Initial seed",
            changed_by="system",
            changed_at=now,
            status=ThemeVersionStatus.ACTIVE,
        )
        db.add(version)

        print(f"Created theme: {theme_data['name']}")

    await db.commit()
    print("Seed completed successfully!")


async def main():
    """Main entry point."""
    settings = get_settings()

    engine = create_async_engine(settings.database_url, echo=True)
    async_session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with async_session() as session:
        await seed_themes(session)


if __name__ == "__main__":
    asyncio.run(main())
