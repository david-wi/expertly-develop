# Expertly Intake

Intake management system.

## Quick Start

### Local Development

```bash
# Start all services
docker-compose up

# Or develop individually:
# Backend
cd backend && python -m venv venv && source venv/bin/activate && pip install -r requirements.txt
uvicorn app.main:app --reload

# Frontend
cd frontend && npm install && npm run dev
```

### Access

- **Frontend**: http://localhost:5173 (dev) or http://localhost (Docker)
- **Backend API**: http://localhost:8000
- **API Docs**: http://localhost:8000/docs

### Production

- **Frontend**: https://intake.ai.devintensive.com
- **Backend API**: https://intake-api.ai.devintensive.com

## Stack

- **Backend**: Python 3.12, FastAPI, MongoDB (Motor async driver)
- **Frontend**: React 19, Vite, TypeScript, Tailwind CSS
- **Deployment**: Docker, GitHub Actions (blue-green via monorepo)
