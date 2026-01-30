# CLAUDE.md - Expertly Define

Please review general instructions at `/Users/david/Code/_common/CLAUDE.md`.

For the full list of Expertly products and deployment URLs, see `/Users/david/CLAUDE.md`.

## This Project

**Expertly Define** - AI-powered Requirements Management tool

- **URL**: https://define.ai.devintensive.com/
- **Stack**: Vite + React (frontend) + FastAPI + SQLite (backend)

## Architecture

```
apps/define/
├── frontend/          # Vite + React + TypeScript
│   ├── src/
│   │   ├── api/       # API client
│   │   ├── components/
│   │   └── pages/
│   └── Dockerfile.prod
├── backend/           # FastAPI + SQLAlchemy + SQLite
│   ├── app/
│   │   ├── api/       # Route handlers
│   │   ├── models/    # SQLAlchemy models
│   │   ├── schemas/   # Pydantic schemas
│   │   └── services/  # Business logic
│   └── Dockerfile
└── docker-compose.yml
```

## Key Features

- Product and requirements management with hierarchical tree structure
- Version history and change tracking
- Identity service authentication (via identity.ai.devintensive.com)
- AI-powered bulk requirements import (supports text, PDF, images)
- Jira integration for drafting and sending stories
- Release snapshots with verification stats
- Artifact management with document conversion

## Development

```bash
# Run both frontend and backend
docker-compose up

# Frontend only (port 3000 -> proxies API to backend)
cd frontend && npm install && npm run dev

# Backend only (port 8000)
cd backend && pip install -r requirements.txt && uvicorn app.main:app --reload
```

## Environment Variables

Backend:
- `ANTHROPIC_API_KEY` - For AI features
- `OPENAI_API_KEY` - For avatar generation (DALL-E)
- `DATABASE_URL` - SQLite path (default: `sqlite:///./data/expertly-define.db`)
- `SKIP_AUTH` - Set to `true` for local dev without auth

Frontend:
- `VITE_IDENTITY_URL` - Identity service URL

## Test Credentials

Use Identity service credentials:
- Email: `david@example.com`
- Password: `expertly123`

## Database

SQLite stored in `./data/expertly-define.db`. Migrations managed by Alembic.
