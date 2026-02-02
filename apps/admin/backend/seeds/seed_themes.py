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
                "sidebar": {
                    "background": "#ffffff",
                    "backgroundHover": "#f3f4f6",
                    "text": "#4b5563",
                    "textMuted": "#9ca3af",
                    "border": "#e5e7eb",
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
                "sidebar": {
                    "background": "#1f2937",
                    "backgroundHover": "#374151",
                    "text": "#9ca3af",
                    "textMuted": "#6b7280",
                    "border": "#374151",
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
                "sidebar": {
                    "background": "#ffffff",
                    "backgroundHover": "#f3f4f6",
                    "text": "#4b5563",
                    "textMuted": "#9ca3af",
                    "border": "#e5e7eb",
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
                "sidebar": {
                    "background": "#1e293b",
                    "backgroundHover": "#334155",
                    "text": "#94a3b8",
                    "textMuted": "#64748b",
                    "border": "#334155",
                },
            },
        },
    },
    {
        "name": "Emerald",
        "slug": "emerald",
        "description": "Teal theme with dark sidebar and warm stone neutrals",
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
                    "default": "#fafaf9",
                    "surface": "#ffffff",
                    "elevated": "#ffffff",
                },
                "text": {
                    "primary": "#1c1917",
                    "secondary": "#57534e",
                    "muted": "#78716c",
                },
                "border": {
                    "default": "#e7e5e4",
                    "subtle": "#f5f5f4",
                },
                "sidebar": {
                    "background": "#1c1917",
                    "backgroundHover": "#292524",
                    "text": "#a8a29e",
                    "textMuted": "#57534e",
                    "border": "#292524",
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
                    "default": "#1c1917",
                    "surface": "#292524",
                    "elevated": "#44403c",
                },
                "text": {
                    "primary": "#fafaf9",
                    "secondary": "#a8a29e",
                    "muted": "#78716c",
                },
                "border": {
                    "default": "#44403c",
                    "subtle": "#292524",
                },
                "sidebar": {
                    "background": "#1c1917",
                    "backgroundHover": "#292524",
                    "text": "#a8a29e",
                    "textMuted": "#57534e",
                    "border": "#292524",
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
