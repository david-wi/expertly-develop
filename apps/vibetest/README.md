# Vibe QA

AI-powered testing platform that generates, executes, and maintains tests by analyzing URLs, APIs, and documentation.

## Features

- **Quick Start**: Point at a URL and AI generates tests automatically
- **Test Management**: Create, organize, and approve test cases
- **Browser Automation**: Playwright-powered UI testing
- **AI Analysis**: Claude-powered test generation and failure analysis
- **Visual Reports**: Screenshots, evidence, and reproduction steps
- **i18n Support**: English and Spanish out of the box

## Tech Stack

- **Backend**: Python 3.12, FastAPI, SQLAlchemy, PostgreSQL
- **Frontend**: React 18, TypeScript, Vite, TailwindCSS
- **Testing**: Playwright (browser), pytest (backend), Vitest (frontend)
- **AI**: Anthropic Claude API

## Getting Started

### Prerequisites

- Python 3.12+
- Node.js 20+
- PostgreSQL 16+
- Docker (optional)

### Local Development

1. **Clone and setup**
   ```bash
   git clone https://github.com/yourusername/vibe-qa.git
   cd vibe-qa
   ```

2. **Backend setup**
   ```bash
   cd backend
   python -m venv venv
   source venv/bin/activate  # or `venv\Scripts\activate` on Windows
   pip install -r requirements.txt
   playwright install chromium
   ```

3. **Create `.env` file in backend/**
   ```
   DATABASE_URL=postgresql://localhost:5432/vibeqa
   ANTHROPIC_API_KEY=sk-ant-...  # Optional, for AI features
   SECRET_KEY=your-secret-key
   ENCRYPTION_KEY=your-32-character-encryption-key!
   ```

4. **Initialize database**
   ```bash
   # Create database
   createdb vibeqa

   # Run migrations
   alembic upgrade head
   ```

5. **Start backend**
   ```bash
   uvicorn app.main:app --reload
   ```

6. **Frontend setup** (new terminal)
   ```bash
   cd frontend
   npm install
   npm run dev
   ```

7. **Open http://localhost:5173**

### Docker Development

```bash
# Start all services
docker-compose up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down
```

## API Documentation

- Swagger UI: http://localhost:8000/api/docs
- ReDoc: http://localhost:8000/api/redoc

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/v1/health` | GET | Health check |
| `/api/v1/ready` | GET | Readiness check |
| `/api/v1/projects` | GET, POST | List/create projects |
| `/api/v1/projects/{id}` | GET, PATCH, DELETE | Project CRUD |
| `/api/v1/projects/{id}/tests` | GET, POST | Test cases |
| `/api/v1/projects/{id}/runs` | GET, POST | Test runs |
| `/api/v1/quick-start` | POST | Start exploration |

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `DATABASE_URL` | PostgreSQL connection string | Yes |
| `ANTHROPIC_API_KEY` | Claude API key for AI features | No |
| `SECRET_KEY` | Application secret key | Yes |
| `ENCRYPTION_KEY` | 32-char key for credential encryption | Yes |
| `ENV` | Environment (development/staging/production) | No |
| `ARTIFACTS_PATH` | Path for screenshots and artifacts | No |

## Deployment

### Coolify (Recommended)

1. Create a new application in Coolify
2. Connect to GitHub repository
3. Configure environment variables
4. Deploy

### Manual Docker

```bash
docker build -t vibe-qa .
docker run -p 80:80 \
  -e DATABASE_URL=postgresql://... \
  -e SECRET_KEY=... \
  -e ENCRYPTION_KEY=... \
  vibe-qa
```

## Testing

### Backend Tests
```bash
cd backend
pytest
```

### Frontend Tests
```bash
cd frontend
npm test
```

### E2E Tests
See [e2e/README.md](e2e/README.md) for E2E test documentation.

## License

Private - All rights reserved
