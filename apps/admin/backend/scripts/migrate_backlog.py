#!/usr/bin/env python3
"""
Migrate backlog items from Manage MongoDB to Admin PostgreSQL.

This script migrates existing backlog items from Manage's MongoDB collection
to Admin's PostgreSQL ideas table. Items are migrated with their organization_id
preserved for proper tenant isolation.

Field mapping:
    Manage MongoDB          ->  Admin PostgreSQL (ideas)
    ---------------------------------------------------
    _id                     ->  (new UUID generated)
    organization_id         ->  organization_id
    title                   ->  title
    description             ->  description
    status                  ->  status
    priority                ->  priority
    tags                    ->  tags
    created_by              ->  created_by_email (looked up)
    created_at              ->  created_at
    updated_at              ->  updated_at
                            ->  product = "manage" (fixed)

Usage:
    cd apps/admin/backend
    python scripts/migrate_backlog.py

Environment variables (set via .env or export):
    MANAGE_MONGODB_URL: MongoDB connection string for Manage
    ADMIN_DATABASE_URL: PostgreSQL connection string for Admin

Optional flags:
    --dry-run: Show what would be migrated without making changes
    --verbose: Show detailed output for each item
"""

import asyncio
import argparse
import logging
import os
import sys
import uuid
from datetime import datetime, timezone
from typing import Optional

# Add parent directory for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from motor.motor_asyncio import AsyncIOMotorClient
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlalchemy import text

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


async def get_manage_connection(mongodb_url: str, db_name: str = "expertly_manage"):
    """Connect to Manage MongoDB."""
    client = AsyncIOMotorClient(mongodb_url)
    return client[db_name]


async def get_admin_connection(database_url: str):
    """Connect to Admin PostgreSQL."""
    engine = create_async_engine(database_url, echo=False)
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    return engine, async_session


async def get_user_email_mapping(manage_db) -> dict:
    """Build a mapping of user IDs to email addresses."""
    user_mapping = {}
    try:
        cursor = manage_db.users.find({}, {"_id": 1, "email": 1})
        async for user in cursor:
            user_id = str(user["_id"])
            email = user.get("email")
            if email:
                user_mapping[user_id] = email
    except Exception as e:
        logger.warning(f"Could not load user mapping: {e}")
    return user_mapping


async def migrate_backlog_items(
    manage_db,
    admin_session: AsyncSession,
    user_mapping: dict,
    dry_run: bool = False,
    verbose: bool = False
) -> tuple[int, int, int]:
    """
    Migrate backlog items from MongoDB to PostgreSQL.

    Returns (migrated_count, skipped_count, error_count)
    """
    migrated = 0
    skipped = 0
    errors = 0

    # Query all backlog items (category=backlog, not ideas which were already redirected)
    cursor = manage_db.backlog_items.find({"category": "backlog"})

    async for item in cursor:
        try:
            mongo_id = str(item["_id"])
            org_id = item.get("organization_id")
            created_by = item.get("created_by")

            if verbose:
                logger.info(f"Processing item: {item.get('title', 'Untitled')[:50]}...")

            # Map fields
            idea_data = {
                "id": str(uuid.uuid4()),
                "product": "manage",
                "organization_id": org_id,
                "title": item.get("title", "Untitled"),
                "description": item.get("description"),
                "status": item.get("status", "new"),
                "priority": item.get("priority", "medium"),
                "tags": item.get("tags", []),
                "created_by_email": user_mapping.get(created_by) if created_by else None,
                "vote_count": 0,
                "created_at": item.get("created_at", datetime.now(timezone.utc)),
                "updated_at": item.get("updated_at", datetime.now(timezone.utc)),
            }

            if dry_run:
                logger.info(f"[DRY RUN] Would migrate: {idea_data['title'][:50]}... (org: {org_id})")
                migrated += 1
                continue

            # Insert into PostgreSQL
            insert_sql = text("""
                INSERT INTO ideas (
                    id, product, organization_id, title, description,
                    status, priority, tags, created_by_email, vote_count,
                    created_at, updated_at
                ) VALUES (
                    :id, :product, :organization_id, :title, :description,
                    :status, :priority, :tags, :created_by_email, :vote_count,
                    :created_at, :updated_at
                )
            """)

            # Convert tags list to proper format for JSONB
            import json
            params = {
                **idea_data,
                "tags": json.dumps(idea_data["tags"]) if idea_data["tags"] else "[]",
            }

            await admin_session.execute(insert_sql, params)
            migrated += 1

            if verbose:
                logger.info(f"Migrated: {idea_data['title'][:50]}...")

        except Exception as e:
            logger.error(f"Error migrating item {mongo_id}: {e}")
            errors += 1

    if not dry_run:
        await admin_session.commit()

    return migrated, skipped, errors


async def main():
    parser = argparse.ArgumentParser(description="Migrate backlog items from Manage to Admin")
    parser.add_argument("--dry-run", action="store_true", help="Show what would be migrated without making changes")
    parser.add_argument("--verbose", "-v", action="store_true", help="Show detailed output")
    args = parser.parse_args()

    # Get connection strings from environment
    manage_mongodb_url = os.environ.get("MANAGE_MONGODB_URL", "mongodb://localhost:27017")
    admin_database_url = os.environ.get("ADMIN_DATABASE_URL", "postgresql+asyncpg://admin:admin@localhost:5432/expertly_admin")

    logger.info("Starting backlog migration from Manage to Admin...")
    logger.info(f"Manage MongoDB: {manage_mongodb_url.split('@')[-1] if '@' in manage_mongodb_url else manage_mongodb_url}")
    logger.info(f"Admin PostgreSQL: {admin_database_url.split('@')[-1] if '@' in admin_database_url else admin_database_url}")

    if args.dry_run:
        logger.info("=== DRY RUN MODE - No changes will be made ===")

    # Connect to both databases
    manage_db = await get_manage_connection(manage_mongodb_url)
    admin_engine, admin_session_factory = await get_admin_connection(admin_database_url)

    async with admin_session_factory() as admin_session:
        # Build user email mapping for created_by lookups
        logger.info("Loading user mapping from Manage...")
        user_mapping = await get_user_email_mapping(manage_db)
        logger.info(f"Loaded {len(user_mapping)} users")

        # Migrate items
        migrated, skipped, errors = await migrate_backlog_items(
            manage_db,
            admin_session,
            user_mapping,
            dry_run=args.dry_run,
            verbose=args.verbose
        )

        logger.info("=" * 50)
        logger.info(f"Migration complete!")
        logger.info(f"  Migrated: {migrated}")
        logger.info(f"  Skipped:  {skipped}")
        logger.info(f"  Errors:   {errors}")

    # Clean up
    await admin_engine.dispose()


if __name__ == "__main__":
    asyncio.run(main())
