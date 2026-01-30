# Database Migration Skill

Use this skill when migrating databases between backends (e.g., SQLite to PostgreSQL) or making schema changes that affect existing data.

## Pre-Migration Checklist

1. **Identify existing data location**
   ```bash
   # For Docker volumes
   docker volume ls | grep <app-name>

   # Check volume contents
   docker run --rm -v <volume-name>:/data alpine ls -la /data/
   ```

2. **Backup existing data**
   ```bash
   # SQLite backup
   docker run --rm -v <volume-name>:/data -v $(pwd):/backup alpine cp /data/*.db /backup/

   # PostgreSQL backup
   pg_dump -h <host> -U <user> -d <database> > backup.sql
   ```

3. **Export data to portable format**
   ```bash
   # SQLite to JSON/CSV
   docker run --rm -v <volume-name>:/data nouchka/sqlite3 /data/<db-file>.db \
     "SELECT * FROM <table>;" > data-export.txt
   ```

## Migration Steps

1. **Create migration script** that:
   - Connects to old database
   - Exports all data
   - Transforms data if schema changed
   - Imports to new database

2. **Test migration locally**
   - Spin up both old and new databases
   - Run migration script
   - Verify row counts match
   - Verify data integrity

3. **Deploy code changes** (new database connection)

4. **Run data migration** immediately after deployment

5. **Verify data** in production
   ```bash
   # Check row counts
   SELECT COUNT(*) FROM <table>;

   # Spot check specific records
   SELECT * FROM <table> LIMIT 5;
   ```

## Emergency Recovery

If data is lost after migration, check Docker volumes for backups:

```bash
# List all volumes that might have old data
docker volume ls | grep <app-name>

# Check each volume for database files
for vol in $(docker volume ls -q | grep <app-name>); do
  echo "=== $vol ==="
  docker run --rm -v $vol:/data alpine ls -la /data/
done

# Query SQLite backup
docker run --rm -v <volume-name>:/data nouchka/sqlite3 /data/<db>.db "SELECT * FROM <table>;"

# Restore to PostgreSQL
docker exec <backend-container> python -c "
import asyncio
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy import text
import os

async def restore():
    engine = create_async_engine(os.environ['DATABASE_URL'])
    async with engine.begin() as conn:
        await conn.execute(text('''
            INSERT INTO <table> (col1, col2, ...)
            VALUES ('val1', 'val2', ...)
            ON CONFLICT (id) DO NOTHING
        '''))
    await engine.dispose()

asyncio.run(restore())
"
```

## Known Data Locations

| App | Old Storage | New Storage | Backup Volumes |
|-----|-------------|-------------|----------------|
| Define | SQLite in Docker volume | DO Managed PostgreSQL | `shared_define_data`, `expertly-blue_define_data` |
| Admin | Container PostgreSQL | DO Managed PostgreSQL | `expertly-*_admin_postgres_data` |
| Identity | Container PostgreSQL | DO Managed PostgreSQL | `expertly-*_identity_postgres_data` |
| Today | Container PostgreSQL | DO Managed PostgreSQL | `expertly-*_today_postgres_data` |

## Lessons Learned

- **Jan 30, 2026**: Define migration to PostgreSQL lost 1 product. Recovered from `shared_define_data` Docker volume containing SQLite backup.
- SQLite databases inside containers are ephemeral - always use volumes
- Always export data BEFORE changing database connection strings
- Keep old Docker volumes until data is verified in new database
