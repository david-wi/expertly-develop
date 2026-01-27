# Vibe QA - Implementation Plan

## Executive Summary

Vibe QA is an AI-powered testing platform that transforms QA workflows. Point it at a URL, API spec, or documentation, and it generates comprehensive tests, executes them, and delivers evidence-rich reports.

## Technical Architecture

### Stack

| Layer | Technology | Rationale |
|-------|------------|-----------|
| **Backend** | Python 3.12 + FastAPI | Per infrastructure standards |
| **Frontend** | Vite + React + TypeScript | Modern, fast DX |
| **Database** | PostgreSQL | Shared managed instance |
| **Browser Automation** | Playwright | Cross-browser, reliable |
| **AI** | Anthropic Claude API | Test generation, visual analysis |
| **Containerization** | Docker | Required for Coolify deployment |
| **i18n** | Backend: babel, Frontend: react-i18next | Multi-language support |

### API Design

```
/api/v1/
├── /health          GET     Health check
├── /ready           GET     Readiness check
├── /projects
│   ├── GET          List projects
│   ├── POST         Create project
│   └── /{id}
│       ├── GET      Get project details
│       ├── PATCH    Update project
│       ├── DELETE   Soft-delete project
│       ├── /environments
│       │   ├── GET  List environments
│       │   └── POST Create environment
│       ├── /tests
│       │   ├── GET  List test cases
│       │   ├── POST Create test case
│       │   └── /{test_id}
│       │       ├── GET    Get test
│       │       ├── PATCH  Update test
│       │       └── DELETE Delete test
│       ├── /suites
│       │   ├── GET  List test suites
│       │   └── POST Create suite
│       └── /runs
│           ├── GET  List runs
│           ├── POST Start new run
│           └── /{run_id}
│               ├── GET     Get run details
│               └── /results GET results
├── /quick-start
│   ├── POST         Start exploration session
│   └── /{session_id}
│       └── GET      Get session status/results
└── /artifacts
    └── /{id}        GET artifact file
```

### Database Schema

```sql
-- Projects
CREATE TABLE projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    settings JSONB DEFAULT '{}',
    status VARCHAR(50) DEFAULT 'active',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

-- Environments
CREATE TABLE environments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    type VARCHAR(50) DEFAULT 'staging',
    base_url VARCHAR(500) NOT NULL,
    credentials_encrypted TEXT,
    is_default BOOLEAN DEFAULT FALSE,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Test Cases
CREATE TABLE test_cases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    title VARCHAR(500) NOT NULL,
    description TEXT,
    preconditions TEXT,
    steps JSONB DEFAULT '[]',
    expected_results TEXT,
    tags JSONB DEFAULT '[]',
    priority VARCHAR(50) DEFAULT 'medium',
    status VARCHAR(50) DEFAULT 'draft',
    execution_type VARCHAR(50) DEFAULT 'manual',
    automation_config JSONB,
    created_by VARCHAR(50) DEFAULT 'human',
    approved_by VARCHAR(255),
    approved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

-- Test Suites
CREATE TABLE test_suites (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    type VARCHAR(50) DEFAULT 'custom',
    test_case_ids JSONB DEFAULT '[]',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Test Runs
CREATE TABLE test_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    environment_id UUID REFERENCES environments(id) ON DELETE SET NULL,
    suite_id UUID REFERENCES test_suites(id) ON DELETE SET NULL,
    name VARCHAR(255),
    status VARCHAR(50) DEFAULT 'pending',
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    summary JSONB,
    triggered_by VARCHAR(50) DEFAULT 'manual',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Test Results
CREATE TABLE test_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    run_id UUID REFERENCES test_runs(id) ON DELETE CASCADE,
    test_case_id UUID REFERENCES test_cases(id) ON DELETE CASCADE,
    status VARCHAR(50) DEFAULT 'pending',
    duration_ms INTEGER,
    error_message TEXT,
    steps_executed JSONB,
    ai_analysis JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Artifacts
CREATE TABLE artifacts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    run_id UUID REFERENCES test_runs(id) ON DELETE CASCADE,
    result_id UUID REFERENCES test_results(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL,
    file_path VARCHAR(500) NOT NULL,
    metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Quick Start Sessions
CREATE TABLE quick_start_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    url VARCHAR(500) NOT NULL,
    credentials_encrypted TEXT,
    status VARCHAR(50) DEFAULT 'pending',
    progress REAL DEFAULT 0,
    progress_message TEXT,
    results JSONB,
    project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Version history for test cases (audit trail)
CREATE TABLE test_cases_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    test_case_id UUID REFERENCES test_cases(id) ON DELETE CASCADE,
    changed_by VARCHAR(255),
    changed_at TIMESTAMPTZ DEFAULT NOW(),
    previous_data JSONB,
    change_type VARCHAR(50)
);
```

## Feature Breakdown

### Phase 1: Core Infrastructure
- [x] Project structure setup
- [ ] Docker configuration
- [ ] Database migrations with Alembic
- [ ] Health/readiness endpoints
- [ ] Basic authentication

### Phase 2: Project Management
- [ ] CRUD for projects
- [ ] CRUD for environments
- [ ] Credential encryption

### Phase 3: Test Management
- [ ] CRUD for test cases
- [ ] CRUD for test suites
- [ ] Tag-based filtering
- [ ] Approval workflow

### Phase 4: Test Execution
- [ ] Manual test runner
- [ ] Browser automation runner (Playwright)
- [ ] API test runner
- [ ] Screenshot capture
- [ ] Artifact storage

### Phase 5: AI Integration
- [ ] Page analysis from screenshots
- [ ] Test generation from requirements
- [ ] Failure analysis
- [ ] Quick-start exploration

### Phase 6: Reporting
- [ ] Run summary views
- [ ] Failure details with evidence
- [ ] Visual walkthrough generation
- [ ] Export capabilities

### Phase 7: Frontend
- [ ] Dashboard
- [ ] Project management UI
- [ ] Test library browser
- [ ] Test case editor
- [ ] Run viewer
- [ ] Visual walkthrough viewer
- [ ] Quick-start wizard

## Directory Structure

```
vibe-qa/
├── __SPECIAL/
│   ├── work-plan.*.md
│   ├── request-history/
│   ├── performance/
│   └── creds.txt
├── backend/
│   ├── app/
│   │   ├── __init__.py
│   │   ├── main.py
│   │   ├── config.py
│   │   ├── database.py
│   │   ├── models/
│   │   ├── schemas/
│   │   ├── api/
│   │   │   └── v1/
│   │   ├── services/
│   │   ├── utils/
│   │   └── i18n/
│   ├── alembic/
│   ├── tests/
│   ├── requirements.txt
│   └── Dockerfile
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   ├── api/
│   │   ├── hooks/
│   │   ├── i18n/
│   │   └── types/
│   ├── tests/
│   ├── package.json
│   └── Dockerfile
├── docker-compose.yml
├── docs/
├── e2e/
│   ├── tests/
│   └── README.md
└── README.md
```

## Environment Variables

```bash
# Database
DATABASE_URL=postgresql://user:pass@host:5432/vibeqa

# AI
ANTHROPIC_API_KEY=sk-ant-...

# Security
SECRET_KEY=...
ENCRYPTION_KEY=...

# Environment
ENV=production|staging|development

# Analytics (optional)
ANALYTICS_ENABLED=true
AMPLITUDE_API_KEY=...
MIXPANEL_TOKEN=...
```

## Deployment

1. Push to GitHub (private repo)
2. Create NEW Coolify application
3. Connect to GitHub repo
4. Configure environment variables
5. Deploy

## Success Metrics

- Time to first test: < 2 minutes from URL
- Test generation accuracy: 80%+ useful
- False positive rate: < 5%
- Page load time: < 2.5s (LCP)
