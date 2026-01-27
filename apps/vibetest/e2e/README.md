# Vibe QA - End-to-End Tests

## Overview

This document describes the E2E test suite for Vibe QA. Tests cover critical user flows and workflows.

## Prerequisites

- Python 3.12+ with Playwright installed
- Backend and frontend running locally
- PostgreSQL database running

## Setup

```bash
# Install dependencies
cd backend
pip install -r requirements.txt
playwright install chromium

# Start services
docker-compose up -d
```

## Running Tests

### Smoke Tests (Quick)
```bash
cd e2e
pytest tests/test_smoke.py -v
```

### Full Regression
```bash
cd e2e
pytest tests/ -v
```

## Test Coverage

### Critical Paths

1. **Quick Start Flow** (`test_quick_start.py`)
   - Enter URL and start exploration
   - View exploration progress
   - Review discovered pages
   - Review generated tests
   - Save as project

2. **Project Management** (`test_projects.py`)
   - Create new project
   - View project details
   - Edit project settings
   - Archive project

3. **Test Case Management** (`test_test_cases.py`)
   - Create test case
   - Edit test steps
   - Approve test case
   - Delete test case

4. **Test Execution** (`test_runs.py`)
   - Start test run
   - View run progress
   - View test results
   - View failure details

### Smoke Tests (`test_smoke.py`)

Quick sanity checks:
- Application loads
- Can navigate to all main pages
- API health endpoints respond
- Database connectivity

## Test Data

Tests use a seeded database with:
- 1 demo project
- 1 staging environment
- 5 sample test cases
- 2 historical test runs

Seed data: `e2e/fixtures/seed_data.sql`

## Adding New Tests

1. Create test file in `e2e/tests/`
2. Use fixtures from `conftest.py`
3. Follow naming convention: `test_<feature>.py`
4. Add to appropriate test category

## CI/CD Integration

Tests run automatically on:
- Pull requests to main
- Nightly scheduled runs

See `.github/workflows/e2e.yml` for configuration.

## Troubleshooting

### Tests fail to connect
- Ensure services are running: `docker-compose ps`
- Check ports: 8000 (backend), 5173 (frontend), 5432 (db)

### Playwright errors
- Update browsers: `playwright install`
- Check system dependencies: `playwright install-deps`

### Database errors
- Reset database: `docker-compose down -v && docker-compose up -d`
- Rerun migrations: `cd backend && alembic upgrade head`
