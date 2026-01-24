"""
Restore database from seed file.

Usage:
    python restore_seed.py database_seed_20260123.json

This will:
1. Clear existing data from all tables
2. Restore data from the seed file
3. Preserve referential integrity by restoring in correct order
"""

import asyncio
import json
import sys
import os
from datetime import datetime
from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker

# Table restore order (respects foreign key constraints)
RESTORE_ORDER = [
    'tenants',
    'users',
    'projects',
    'clients',
    'people',
    'playbooks',
    'tasks',
    'questions',
    'knowledge',
    'drafts',
    'waiting_items',
    'recurring_tasks',
    'sales_opportunities',
    'logs',
]


async def restore_database(seed_file: str, db_url: str):
    """Restore database from seed file."""

    with open(seed_file, 'r') as f:
        seed_data = json.load(f)

    print(f"Seed file exported at: {seed_data['exported_at']}")
    print(f"Tables in seed: {list(seed_data['tables'].keys())}")

    engine = create_async_engine(db_url)

    async with engine.begin() as conn:
        # Disable foreign key checks temporarily
        await conn.execute(text("SET session_replication_role = 'replica'"))

        # Clear tables in reverse order
        print("\nClearing existing data...")
        for table in reversed(RESTORE_ORDER):
            if table in seed_data['tables']:
                await conn.execute(text(f"DELETE FROM {table}"))
                print(f"  Cleared {table}")

        # Restore tables in order
        print("\nRestoring data...")
        for table in RESTORE_ORDER:
            if table not in seed_data['tables']:
                print(f"  Skipping {table} (not in seed)")
                continue

            table_data = seed_data['tables'][table]
            columns = table_data['columns']
            rows = table_data['rows']

            if not rows:
                print(f"  {table}: 0 rows (empty)")
                continue

            # Build INSERT statement
            col_names = ', '.join(columns)
            placeholders = ', '.join([f':{c}' for c in columns])

            for row in rows:
                # Convert row to dict, handling None values
                row_dict = {}
                for i, col in enumerate(columns):
                    val = row[i]
                    # Handle UUID and datetime strings
                    if val == 'None' or val is None:
                        row_dict[col] = None
                    else:
                        row_dict[col] = val

                try:
                    await conn.execute(
                        text(f"INSERT INTO {table} ({col_names}) VALUES ({placeholders})"),
                        row_dict
                    )
                except Exception as e:
                    print(f"  ERROR inserting into {table}: {e}")
                    print(f"    Row: {row_dict}")

            print(f"  {table}: {len(rows)} rows restored")

        # Re-enable foreign key checks
        await conn.execute(text("SET session_replication_role = 'origin'"))

    print("\nDatabase restored successfully!")


if __name__ == '__main__':
    if len(sys.argv) < 2:
        print("Usage: python restore_seed.py <seed_file.json>")
        print("Set DATABASE_URL environment variable")
        sys.exit(1)

    seed_file = sys.argv[1]
    db_url = os.environ.get('DATABASE_URL')

    if not db_url:
        print("ERROR: DATABASE_URL environment variable not set")
        sys.exit(1)

    asyncio.run(restore_database(seed_file, db_url))
