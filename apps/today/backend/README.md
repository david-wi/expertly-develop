# Expertly Today - Backend

FastAPI backend for the Expertly Today AI assistant workflow platform.

## Quick Start

### Using Docker (Recommended)

```bash
# From project root
docker-compose up -d

# API available at http://localhost:8000
# Docs at http://localhost:8000/api/docs
```

### Local Development

```bash
cd backend

# Create virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Set up environment
cp .env.example .env
# Edit .env with your database URL

# Run database migrations (when implemented)
# alembic upgrade head

# Run the server
uvicorn app.main:app --reload
```

## Running Tests

```bash
# Run all tests with coverage
pytest

# Run specific test file
pytest tests/integration/api/test_tasks_api.py

# Run with verbose output
pytest -v

# Run only unit tests
pytest tests/unit/

# Run only integration tests
pytest tests/integration/
```

## API Endpoints

### Tasks
- `GET /api/tasks/next` - Get highest priority task for Claude
- `GET /api/tasks` - List tasks
- `POST /api/tasks` - Create task
- `GET /api/tasks/{id}` - Get task
- `PUT /api/tasks/{id}` - Update task
- `POST /api/tasks/{id}/start` - Mark as working
- `POST /api/tasks/{id}/complete` - Complete task
- `POST /api/tasks/{id}/block` - Block with question
- `DELETE /api/tasks/{id}` - Cancel task

### Questions
- `GET /api/questions` - List questions
- `GET /api/questions/unanswered` - Get unanswered questions
- `POST /api/questions` - Create question
- `GET /api/questions/{id}` - Get question
- `PUT /api/questions/{id}/answer` - Answer question
- `PUT /api/questions/{id}/dismiss` - Dismiss question

### Projects
- `GET /api/projects` - List projects
- `POST /api/projects` - Create project
- `GET /api/projects/{id}` - Get project
- `PUT /api/projects/{id}` - Update project
- `DELETE /api/projects/{id}` - Archive project

## Authentication

All endpoints require an API key in the `X-API-Key` header.

```bash
curl -H "X-API-Key: your-api-key" http://localhost:8000/api/tasks
```

## Project Structure

```
backend/
├── app/
│   ├── main.py              # FastAPI app
│   ├── config.py            # Settings
│   ├── database.py          # Database connection
│   ├── models/              # SQLAlchemy models
│   ├── schemas/             # Pydantic schemas
│   ├── api/                 # Route handlers
│   ├── services/            # Business logic
│   └── utils/               # Utilities
├── tests/
│   ├── unit/                # Unit tests
│   ├── integration/         # Integration tests
│   └── factories/           # Test data factories
├── alembic/                 # Database migrations
├── requirements.txt
└── Dockerfile
```
