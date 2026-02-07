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
            # Migration 1: Add context column to artifacts table
            result = await session.execute(text("""
                SELECT column_name
                FROM information_schema.columns
                WHERE table_name = 'artifacts' AND column_name = 'context'
            """))
            has_context_column = result.scalar_one_or_none() is not None

            if not has_context_column:
                logger.info("Running migration: Adding context column to artifacts table")

                await session.execute(text("""
                    ALTER TABLE artifacts ADD COLUMN context JSONB DEFAULT '{}' NOT NULL
                """))

                await session.execute(text("""
                    UPDATE artifacts
                    SET context = jsonb_build_object('product_id', product_id)
                    WHERE context = '{}' AND product_id IS NOT NULL
                """))

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

            # Migration 2: Add node_type column to requirements table
            result = await session.execute(text("""
                SELECT column_name
                FROM information_schema.columns
                WHERE table_name = 'requirements' AND column_name = 'node_type'
            """))
            has_node_type_column = result.scalar_one_or_none() is not None

            if not has_node_type_column:
                logger.info("Running migration: Adding node_type column to requirements table")

                await session.execute(text("""
                    ALTER TABLE requirements ADD COLUMN node_type VARCHAR NULL
                """))

                await session.commit()
                logger.info("Migration completed: node_type column added to requirements table")
            else:
                logger.debug("Migration check: node_type column already exists")

            # Migration 3: Add deleted_at column to requirements table (soft delete)
            result = await session.execute(text("""
                SELECT column_name
                FROM information_schema.columns
                WHERE table_name = 'requirements' AND column_name = 'deleted_at'
            """))
            has_deleted_at_column = result.scalar_one_or_none() is not None

            if not has_deleted_at_column:
                logger.info("Running migration: Adding deleted_at column to requirements table")

                await session.execute(text("""
                    ALTER TABLE requirements ADD COLUMN deleted_at VARCHAR NULL
                """))

                await session.execute(text("""
                    CREATE INDEX IF NOT EXISTS ix_requirements_deleted_at
                    ON requirements (deleted_at)
                """))

                await session.commit()
                logger.info("Migration completed: deleted_at column added to requirements table")
            else:
                logger.debug("Migration check: deleted_at column already exists")

        except Exception as e:
            logger.error(f"Migration error: {e}")
            await session.rollback()
            raise
