# CLAUDE.md - Expertly Admin

## Overview

Admin service for managing themes and configuration across all Expertly applications (except Salon).

## Architecture

- **Frontend**: React 19 + Vite + TypeScript + TailwindCSS
- **Backend**: FastAPI + PostgreSQL + SQLAlchemy (async)
- **Database**: PostgreSQL with `themes` and `theme_versions` tables

## Development

```bash
# Start all services locally
cd apps/admin
docker-compose up

# Backend only (for local dev)
cd apps/admin/backend
pip install -r requirements.txt
uvicorn app.main:app --reload

# Frontend only (for local dev)
cd apps/admin/frontend
npm install
npm run dev
```

## Database Migrations

```bash
cd apps/admin/backend

# Create a new migration
alembic revision --autogenerate -m "Description"

# Run migrations
alembic upgrade head

# Seed initial themes
python -m seeds.seed_themes
```

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/themes` | List all themes |
| GET | `/api/themes/{id}` | Get theme with current colors |
| POST | `/api/themes` | Create new theme |
| PUT | `/api/themes/{id}` | Update theme (creates new version) |
| DELETE | `/api/themes/{id}` | Soft delete theme |
| GET | `/api/themes/{id}/versions` | List version history |
| POST | `/api/themes/{id}/restore/{version_id}` | Restore to previous version |
| GET | `/api/public/themes` | Public endpoint for other apps |

## Production URLs

- **Frontend**: http://expertly-admin.152.42.152.243.sslip.io
- **API**: http://expertly-admin-api.152.42.152.243.sslip.io
- **API Docs**: http://expertly-admin-api.152.42.152.243.sslip.io/api/docs

## Integration with Other Apps

Other Expertly apps can use the Admin themes API by passing `themesApiUrl` to ThemeProvider:

```tsx
<ThemeProvider themesApiUrl="http://expertly-admin-api.152.42.152.243.sslip.io/api/public/themes">
  <App />
</ThemeProvider>
```
