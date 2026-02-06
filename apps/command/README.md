# Expertly Command

Multi-tenant SaaS for managing organizations via queue-driven tasks, supporting both human users and AI bots (virtual users).

## Tech Stack

- **Backend**: Python 3.12 + FastAPI + Motor (async MongoDB)
- **Frontend**: Vite + React 19 + TypeScript + TailwindCSS
- **Database**: MongoDB 7
- **Real-time**: WebSocket for progress updates

## Quick Start

```bash
# Start all services
docker compose up -d

# Access points:
# - Frontend: http://localhost:3000
# - API: http://localhost:8000
# - API Docs: http://localhost:8000/docs
# - MongoDB: localhost:27017
```

## Development

### Backend Only

```bash
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload
```

### Frontend Only

```bash
cd frontend
npm install
npm run dev
```

## API Authentication

- **Dev mode**: Set `SKIP_AUTH=true` to use default David user
- **Bots**: Use API key header `X-API-Key: em_live_...`

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `MONGODB_URL` | `mongodb://localhost:27017` | MongoDB connection URL |
| `DATABASE_NAME` | `expertly_manage` | MongoDB database name |
| `SKIP_AUTH` | `false` | Skip authentication (dev mode) |
| `LOG_LEVEL` | `INFO` | Logging level |

## Task State Machine

```
queued ──checkout──> checked_out ──start──> in_progress ──complete──> completed
   ^                      │                      │
   │        release/timeout                      fail
   │                      │                      │
   └──────────────────────┴──────────────────────┴───> failed (can retry)
```
