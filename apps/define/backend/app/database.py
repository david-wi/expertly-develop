"""Database connection and session management for async PostgreSQL."""

from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase
from sqlalchemy import text
from typing import AsyncGenerator
import logging

from app.config import get_settings

logger = logging.getLogger(__name__)

settings = get_settings()

# Create async engine
engine = create_async_engine(
    settings.database_url,
    echo=settings.debug,
    future=True,
)

# Session factory
async_session_maker = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
)


class Base(DeclarativeBase):
    """Base class for all models."""
    pass


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """Dependency that provides a database session."""
    async with async_session_maker() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()


async def init_db() -> None:
    """Initialize database tables and run migrations."""
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    # Run migrations for existing tables
    await run_migrations()


async def run_migrations() -> None:
    """Run database migrations for schema changes."""
    async with async_session_maker() as session:
        try:
            # Check if context column exists on artifacts table
            result = await session.execute(text("""
                SELECT column_name
                FROM information_schema.columns
                WHERE table_name = 'artifacts' AND column_name = 'context'
            """))
            has_context_column = result.scalar_one_or_none() is not None

            if not has_context_column:
                logger.info("Running migration: Adding context column to artifacts table")

                # Add context column
                await session.execute(text("""
                    ALTER TABLE artifacts ADD COLUMN context JSONB DEFAULT '{}' NOT NULL
                """))

                # Populate from product_id
                await session.execute(text("""
                    UPDATE artifacts
                    SET context = jsonb_build_object('product_id', product_id)
                    WHERE context = '{}' AND product_id IS NOT NULL
                """))

                # Create indexes
                await session.execute(text("""
                    CREATE INDEX IF NOT EXISTS ix_artifacts_context_product_id
                    ON artifacts ((context->>'product_id'))
                """))

                await session.execute(text("""
                    CREATE INDEX IF NOT EXISTS ix_artifacts_context
                    ON artifacts USING GIN (context)
                """))

                await session.commit()
                logger.info("Migration completed: context column added to artifacts table")
            else:
                logger.debug("Migration check: context column already exists")

        except Exception as e:
            logger.error(f"Migration error: {e}")
            await session.rollback()
            raise
