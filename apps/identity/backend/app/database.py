from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from sqlalchemy.orm import declarative_base

from app.config import get_settings

settings = get_settings()

engine = create_async_engine(settings.database_url, echo=settings.debug)
async_session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

Base = declarative_base()


async def get_db():
    """Dependency for getting database session."""
    async with async_session() as session:
        yield session


async def init_db():
    """Initialize database tables and indexes."""
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

        # Create partial unique index for email per organization (if not exists)
        # This ensures only one user per email per organization (excluding null emails for bots)
        await conn.execute(text("""
            CREATE UNIQUE INDEX IF NOT EXISTS ix_users_org_email_unique
            ON users (organization_id, email)
            WHERE email IS NOT NULL
        """))
