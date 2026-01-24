# Expertly Today

AI-powered assistant workflow platform for managing tasks, questions, people, clients, and playbooks.

## Architecture

- **Backend**: Python 3.12 + FastAPI with async PostgreSQL
- **Frontend**: React + TypeScript + TailwindCSS
- **Database**: PostgreSQL
- **Containerization**: Docker + Docker Compose

## Quick Start

### Development

```bash
# Start all services
docker compose up -d

# Backend is available at http://localhost:8000
# Frontend is available at http://localhost:3000
# API docs at http://localhost:8000/api/docs
```

### Running Backend Locally

```bash
cd backend
python -m venv venv
source venv/bin/activate  # or `venv\Scripts\activate` on Windows
pip install -r requirements.txt

# Run tests
pytest

# Start server
uvicorn app.main:app --reload
```

### Running Frontend Locally

```bash
cd frontend
npm install
npm run dev
```

## API Authentication

All API requests require an API key in the `X-API-Key` header.

## Project Structure

```
├── backend/
│   ├── app/
│   │   ├── api/          # API endpoints
│   │   ├── models/       # SQLAlchemy models
│   │   ├── schemas/      # Pydantic schemas
│   │   └── services/     # Business logic
│   └── tests/            # Test suite
├── frontend/
│   ├── src/
│   │   ├── components/   # React components
│   │   ├── hooks/        # React Query hooks
│   │   ├── pages/        # Page components
│   │   ├── services/     # API client
│   │   ├── stores/       # Zustand stores
│   │   └── types/        # TypeScript types
│   └── dist/             # Production build
└── docker-compose.yml    # Development setup
```

## Environment Variables

### Backend

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection string |
| `JWT_SECRET_KEY` | Secret for JWT tokens |
| `ENVIRONMENT` | `development` or `production` |
| `DEBUG` | Enable debug mode |

### Frontend

| Variable | Description |
|----------|-------------|
| `VITE_API_URL` | Backend API base URL |

## Deployment

For Coolify deployment, use `docker-compose.prod.yml`:

```bash
docker compose -f docker-compose.prod.yml up -d
```

## License

Proprietary - All rights reserved.
