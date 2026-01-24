# Expertly Companion — Product Specification

> **For**: Claude Code to architect and build
> **Author**: David Bodnick with Claude
> **Date**: January 22, 2026
> **Version**: 1.0

---

## Executive Summary

**Expertly Companion** is a SaaS platform that puts your AI assistant on autopilot. It productizes David Bodnick's custom-built assistant workflow into a database-driven web application with a Python backend and React frontend, enabling Claude (or any LLM assistant) to work autonomously in a continuous loop while users see their organized professional life in a real-time dashboard.

### Important Distinction: Claude Cowork vs. David's System

**Claude Cowork** (Anthropic's game-changing product) is a simple platform from the perspective of managing your life and taking work off your plate. It provides:
- A browser/computer use interface
- Real intelligence
- A skills system (`/mnt/skills/` with SKILL.md files)
- The ability to read/write files on the user's computer

It does NOT inherently run in loops, maintain task queues, learn playbooks, track waiting items, update dashboards, or capture knowledge.

**David's System** is a sophisticated assistant workflow built *on top of* Claude Cowork through:
- Custom `CLAUDE.md` bootstrap instructions
- A designed file structure (todos, queues, playbooks, people, projects, etc.)
- Detailed operating procedures for autonomous work

The core insight: **David's file-based assistant system works well, but because it relies on Claude reading and updating markdown files (which Claude may miss or forget to update), moving to a database-driven API would make the behavior more deterministic and reliable.**

Expertly Companion productizes David's system—not Claude Cowork itself—making it available as a SaaS platform for anyone who wants an AI assistant that truly runs on autopilot.

---

## Vision

### The Problem with the Current File-Based System

David's current system uses markdown files:
- `david-todos.md` — User's priorities
- `claude-queue.md` — AI's work queue  
- `top-questions.md` — Blocking questions
- `waiting.md` — Items awaiting responses
- `recurring.md` — Scheduled tasks
- `projects/[name]/todos.md` — Project backlogs
- `playbooks/*.md` — How to do things
- `people.md`, `clients.md`, etc. — Context files
- `dashboard/panels/*.html` — Static HTML panels

**Problems:**
1. **Unreliable pickup** — Claude may not read all files, or may miss updates
2. **Manual dashboard updates** — Each panel must be regenerated manually
3. **No real-time view** — User must refresh browser; panels get stale
4. **Context fragmentation** — Knowledge scattered across many files
5. **No multi-user support** — Can't scale to SaaS
6. **No audit trail** — Hard to see what Claude did and when

### The Expertly Companion Solution

Replace markdown files with:
1. **PostgreSQL database** — Structured storage for all entities
2. **Python API** — RESTful endpoints Claude calls in a loop
3. **React dashboard** — Real-time updates via WebSocket
4. **Simple Claude instructions** — A standardized CLAUDE.md that works for any user

**The user experience:**
- Open dashboard → see everything: priorities, questions for you, what Claude is working on
- Hover or click items → see full context in a popup/drawer
- Answer questions or give direction → Claude picks it up immediately
- Never need to look at Claude Cowork while it runs — just monitor your dashboard

---

## Core Concepts

### 1. The Work Loop

Claude operates in a simple, repeating loop:

```
while True:
    # 1. Get next task from API
    task = api.get_next_task()
    
    if task is None:
        # Nothing to do - check for recurring tasks or wait
        api.check_recurring()
        sleep(60)
        continue
    
    # 2. Get relevant context
    context = api.get_context(task.id)
    playbook = api.get_playbook(task.type) if task.type else None
    
    # 3. Execute the task
    result = execute_task(task, context, playbook)
    
    # 4. Report completion or blocking
    if result.blocked:
        api.mark_blocked(task.id, result.blocking_question)
    else:
        api.complete_task(task.id, result.output, result.next_steps)
```

This is dramatically simpler than the current file-based approach and ensures nothing is missed.

### 2. Entity Types

Everything is a **first-class entity** in the database:

| Entity | Description | Key Fields |
|--------|-------------|------------|
| **Task** | Something to be done | title, description, priority, status, assignee (user/claude), due_date, project_id, blocking_question_id |
| **Question** | Something blocking progress | text, context, asked_by, answered_at, answer, unblocks_task_ids |
| **Project** | A grouping of related tasks | name, description, status, priority_order |
| **Person** | Someone you interact with | name, relationship, company, context_notes, last_contact |
| **Client** | A customer/account | name, contacts[], status, notes |
| **Draft** | Content awaiting review | type (email/slack/doc), recipient, subject, body, status, related_task_id |
| **Playbook** | How to do something | name, trigger_phrases, steps, examples |
| **RecurringTask** | Scheduled work | title, frequency, last_run, next_run, task_template |
| **WaitingItem** | Something pending externally | what, who, since, follow_up_date, related_task_id |
| **Log** | Audit trail | timestamp, action, entity_type, entity_id, details |

### 3. Task States

```
┌─────────┐     ┌─────────┐     ┌──────────┐
│ QUEUED  │────▶│ WORKING │────▶│ COMPLETE │
└─────────┘     └────┬────┘     └──────────┘
                     │
                     ▼
               ┌──────────┐     ┌──────────┐
               │ BLOCKED  │────▶│ UNBLOCKED│──▶ back to QUEUED
               └──────────┘     └──────────┘
                   │
                   ▼ (creates)
              ┌──────────┐
              │ QUESTION │
              └──────────┘
```

### 4. Priority System

Tasks have:
- **priority** (1-5, where 1 is most urgent)
- **assignee** ("claude" or "user")  
- **due_date** (optional)
- **blocking_question_id** (if blocked)

The API returns the highest-priority unblocked task assigned to the requester.

---

## API Design

### Authentication
- API key per user (for Claude to use)
- JWT tokens for dashboard users
- Multi-tenant: each user has isolated data

### Core Endpoints

#### Task Management
```
GET  /api/tasks/next              # Get highest-priority task for Claude
GET  /api/tasks                   # List all tasks (with filters)
POST /api/tasks                   # Create a task
PUT  /api/tasks/{id}              # Update a task
POST /api/tasks/{id}/complete     # Mark complete with output
POST /api/tasks/{id}/block        # Mark blocked, create question
DELETE /api/tasks/{id}            # Soft delete
```

#### Questions (Blocking Items)
```
GET  /api/questions               # List questions (unanswered first)
GET  /api/questions/unanswered    # Questions needing user input
POST /api/questions               # Create a question
PUT  /api/questions/{id}/answer   # User answers a question → unblocks task
```

#### Context Retrieval
```
GET  /api/context/task/{id}       # Get all context for a task
GET  /api/context/person/{id}     # Get person details
GET  /api/context/project/{id}    # Get project details + tasks
GET  /api/context/search?q=       # Full-text search across entities
```

#### Playbooks
```
GET  /api/playbooks               # List all playbooks
GET  /api/playbooks/{id}          # Get playbook content
GET  /api/playbooks/match?task=   # Find playbook matching task description
POST /api/playbooks               # Create/update playbook
```

#### Drafts
```
GET  /api/drafts                  # List drafts pending review
GET  /api/drafts/{id}             # Get draft content
POST /api/drafts                  # Create a draft
PUT  /api/drafts/{id}             # Update draft
POST /api/drafts/{id}/approve     # User approves → triggers send (external)
POST /api/drafts/{id}/reject      # User rejects with feedback
```

#### Recurring Tasks
```
GET  /api/recurring               # List recurring tasks
GET  /api/recurring/due           # Get recurring tasks due now
POST /api/recurring               # Create recurring task
POST /api/recurring/{id}/run      # Mark as run, create next instance
```

#### Waiting Items
```
GET  /api/waiting                 # List items we're waiting on
GET  /api/waiting/due             # Items past follow-up date
POST /api/waiting                 # Create waiting item
PUT  /api/waiting/{id}            # Update
DELETE /api/waiting/{id}          # Remove (resolved)
```

#### Dashboard / Summary
```
GET  /api/dashboard               # Aggregated data for dashboard
GET  /api/dashboard/today         # Today's priorities
GET  /api/dashboard/calendar      # This week's schedule
GET  /api/dashboard/stats         # Metrics (tasks completed, etc.)
```

#### Logs / Audit
```
GET  /api/logs                    # Activity log with filters
GET  /api/logs/task/{id}          # History for a specific task
```

---

## Database Schema

### PostgreSQL Tables

```sql
-- Users (multi-tenant)
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(255),
    api_key VARCHAR(64) UNIQUE NOT NULL,
    settings JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Projects
CREATE TABLE projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    status VARCHAR(50) DEFAULT 'active',
    priority_order INTEGER DEFAULT 0,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Tasks
CREATE TABLE tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id),
    project_id UUID REFERENCES projects(id),
    title VARCHAR(500) NOT NULL,
    description TEXT,
    priority INTEGER DEFAULT 3 CHECK (priority BETWEEN 1 AND 5),
    status VARCHAR(50) DEFAULT 'queued',
    assignee VARCHAR(50) DEFAULT 'claude' CHECK (assignee IN ('claude', 'user')),
    due_date TIMESTAMP,
    blocking_question_id UUID,
    context JSONB DEFAULT '{}',
    output TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    completed_at TIMESTAMP
);


-- Questions
CREATE TABLE questions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id),
    text TEXT NOT NULL,
    context TEXT,
    why_asking TEXT,
    what_claude_will_do TEXT,
    priority INTEGER DEFAULT 3,
    status VARCHAR(50) DEFAULT 'unanswered',
    answer TEXT,
    answered_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Link questions to tasks they unblock
CREATE TABLE question_unblocks (
    question_id UUID REFERENCES questions(id),
    task_id UUID REFERENCES tasks(id),
    PRIMARY KEY (question_id, task_id)
);

-- People
CREATE TABLE people (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id),
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255),
    phone VARCHAR(50),
    company VARCHAR(255),
    relationship VARCHAR(100),
    context_notes TEXT,
    last_contact TIMESTAMP,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Clients
CREATE TABLE clients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id),
    name VARCHAR(255) NOT NULL,
    status VARCHAR(50) DEFAULT 'active',
    notes TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Drafts
CREATE TABLE drafts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id),
    task_id UUID REFERENCES tasks(id),
    type VARCHAR(50) NOT NULL, -- email, slack, document
    recipient VARCHAR(255),
    subject VARCHAR(500),
    body TEXT NOT NULL,
    status VARCHAR(50) DEFAULT 'pending', -- pending, approved, rejected, sent
    feedback TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Playbooks
CREATE TABLE playbooks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    trigger_phrases TEXT[], -- array of phrases that match this playbook
    steps TEXT NOT NULL,
    examples TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Recurring Tasks
CREATE TABLE recurring_tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id),
    title VARCHAR(500) NOT NULL,
    description TEXT,
    frequency VARCHAR(50) NOT NULL, -- daily, weekly, monthly, custom
    cron_expression VARCHAR(100), -- for custom schedules
    last_run TIMESTAMP,
    next_run TIMESTAMP NOT NULL,
    task_template JSONB NOT NULL, -- template for created tasks
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Waiting Items
CREATE TABLE waiting_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id),
    task_id UUID REFERENCES tasks(id),
    what TEXT NOT NULL,
    who VARCHAR(255),
    since TIMESTAMP DEFAULT NOW(),
    follow_up_date TIMESTAMP,
    why_it_matters TEXT,
    status VARCHAR(50) DEFAULT 'waiting',
    resolved_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Activity Logs
CREATE TABLE logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id),
    timestamp TIMESTAMP DEFAULT NOW(),
    action VARCHAR(100) NOT NULL,
    entity_type VARCHAR(50),
    entity_id UUID,
    details JSONB DEFAULT '{}',
    actor VARCHAR(50) DEFAULT 'claude' -- claude or user
);

-- Full-text search index
CREATE INDEX idx_tasks_search ON tasks USING gin(to_tsvector('english', title || ' ' || COALESCE(description, '')));
CREATE INDEX idx_people_search ON people USING gin(to_tsvector('english', name || ' ' || COALESCE(context_notes, '')));
CREATE INDEX idx_playbooks_search ON playbooks USING gin(to_tsvector('english', name || ' ' || COALESCE(description, '') || ' ' || steps));

-- Performance indexes
CREATE INDEX idx_tasks_user_status ON tasks(user_id, status);
CREATE INDEX idx_tasks_priority ON tasks(user_id, priority, status);
CREATE INDEX idx_questions_user_status ON questions(user_id, status);
CREATE INDEX idx_logs_user_time ON logs(user_id, timestamp DESC);
```

---

## Frontend Design

### Technology Stack
- **React 18+** with TypeScript
- **TailwindCSS** for styling
- **React Query** for data fetching
- **WebSocket** for real-time updates
- **React Router** for navigation

### Dashboard Layout

```
┌─────────────────────────────────────────────────────────────┐
│  Expertly Companion                           [User] [Settings]│
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────┐ │
│  │ 🔴 TODAY'S      │  │ ❓ QUESTIONS    │  │ 🤖 CLAUDE   │ │
│  │ PRIORITIES      │  │ FOR YOU         │  │ IS WORKING  │ │
│  │                 │  │                 │  │ ON          │ │
│  │ • Task 1        │  │ • Question 1    │  │ • Current   │ │
│  │ • Task 2        │  │ • Question 2    │  │   task      │ │
│  │ • Task 3        │  │                 │  │ • Progress  │ │
│  └─────────────────┘  └─────────────────┘  └─────────────┘ │
│                                                             │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────┐ │
│  │ 📝 DRAFTS TO    │  │ ⏳ WAITING ON   │  │ 📅 THIS     │ │
│  │ REVIEW          │  │                 │  │ WEEK        │ │
│  │                 │  │                 │  │             │ │
│  │ • Email draft   │  │ • Person A      │  │ Mon: 3 mtgs │ │
│  │ • Slack draft   │  │ • Person B      │  │ Tue: 2 mtgs │ │
│  └─────────────────┘  └─────────────────┘  └─────────────┘ │
│                                                             │
│  ┌─────────────────────────────────────────────────────────┐│
│  │ 📋 ALL TASKS (sorted by priority)                       ││
│  │ [Filter: All | Mine | Claude's | Blocked]               ││
│  │                                                         ││
│  │ • Task title here...                    [P1] [Project]  ││
│  │ • Another task...                       [P2] [Project]  ││
│  └─────────────────────────────────────────────────────────┘│
│                                                             │
│  ┌───────────────┐ ┌───────────────┐ ┌───────────────┐     │
│  │ Projects      │ │ People        │ │ Activity Log  │     │
│  └───────────────┘ └───────────────┘ └───────────────┘     │
└─────────────────────────────────────────────────────────────┘
```


### Key Interactions

#### Clicking a Task
Opens a detail drawer/modal showing:
- Full task description
- Context (linked people, project, related tasks)
- History (when created, status changes)
- If blocked: the question and ability to answer it inline
- Actions: Edit, Reassign, Mark Complete, Delete

#### Answering a Question
User can answer inline from:
- The Questions panel
- A blocked task's detail view
- A dedicated Questions page

When answered:
- Question status → "answered"
- Blocked tasks auto-unblock
- Claude gets notified (via WebSocket or next poll)

#### Reviewing a Draft
- Click to expand full draft
- "Approve" → triggers external action (e.g., send email via integration)
- "Reject" → prompts for feedback, Claude revises
- "Edit" → user can modify before approving

### Real-Time Updates

WebSocket connection pushes:
- New tasks created by Claude
- Task status changes
- New questions
- New drafts
- Log entries

Dashboard components subscribe and auto-update.

---

## Backend Architecture

### Technology Stack
- **Python 3.11+**
- **FastAPI** — async REST API framework
- **SQLAlchemy 2.0** — async ORM
- **PostgreSQL** — primary database
- **Redis** (optional) — caching, WebSocket pub/sub
- **Uvicorn** — ASGI server
- **Alembic** — database migrations

### Project Structure

```
expertly-cowork/
├── backend/
│   ├── app/
│   │   ├── __init__.py
│   │   ├── main.py              # FastAPI app entry
│   │   ├── config.py            # Settings/env vars
│   │   ├── database.py          # DB connection
│   │   ├── models/              # SQLAlchemy models
│   │   │   ├── __init__.py
│   │   │   ├── user.py
│   │   │   ├── task.py
│   │   │   ├── question.py
│   │   │   ├── project.py
│   │   │   ├── person.py
│   │   │   ├── client.py
│   │   │   ├── draft.py
│   │   │   ├── playbook.py
│   │   │   ├── recurring.py
│   │   │   ├── waiting.py
│   │   │   └── log.py
│   │   ├── schemas/             # Pydantic schemas
│   │   │   ├── __init__.py
│   │   │   ├── task.py
│   │   │   ├── question.py
│   │   │   └── ... (matching models)
│   │   ├── api/                 # Route handlers
│   │   │   ├── __init__.py
│   │   │   ├── tasks.py
│   │   │   ├── questions.py
│   │   │   ├── projects.py
│   │   │   ├── context.py
│   │   │   ├── playbooks.py
│   │   │   ├── drafts.py
│   │   │   ├── recurring.py
│   │   │   ├── waiting.py
│   │   │   ├── dashboard.py
│   │   │   └── logs.py
│   │   ├── services/            # Business logic
│   │   │   ├── __init__.py
│   │   │   ├── task_service.py
│   │   │   ├── question_service.py
│   │   │   └── ...
│   │   ├── websocket/           # WebSocket handlers
│   │   │   ├── __init__.py
│   │   │   └── manager.py
│   │   └── utils/
│   │       ├── __init__.py
│   │       ├── auth.py          # API key / JWT auth
│   │       └── logging.py
│   ├── alembic/                 # DB migrations
│   ├── tests/
│   ├── requirements.txt
│   └── Dockerfile
├── frontend/
│   ├── src/
│   │   ├── App.tsx
│   │   ├── index.tsx
│   │   ├── components/
│   │   │   ├── Dashboard/
│   │   │   ├── Tasks/
│   │   │   ├── Questions/
│   │   │   ├── Drafts/
│   │   │   ├── Projects/
│   │   │   └── common/
│   │   ├── hooks/
│   │   │   ├── useTasks.ts
│   │   │   ├── useQuestions.ts
│   │   │   └── useWebSocket.ts
│   │   ├── services/
│   │   │   └── api.ts
│   │   ├── types/
│   │   │   └── index.ts
│   │   └── utils/
│   ├── public/
│   ├── package.json
│   ├── tailwind.config.js
│   └── Dockerfile
├── claude-instructions/
│   └── CLAUDE.md                # Standardized instructions
├── docker-compose.yml
└── README.md
```

---

## Standardized Claude Instructions

The new CLAUDE.md would be dramatically simpler:

```markdown
# Expertly Companion — Claude Instructions

You are an AI assistant operating within the Expertly Companion system. Your job is to help the user by completing tasks autonomously.

## Your Operating Loop

Repeat this loop continuously:

1. **Get your next task**
   Call: `GET /api/tasks/next`
   If no task, call `GET /api/recurring/due` to check for recurring tasks.
   If still nothing, wait 60 seconds and try again.

2. **Gather context**
   Call: `GET /api/context/task/{task_id}`
   This returns all relevant people, projects, history, and related items.
   
   If the task matches a playbook pattern, call:
   `GET /api/playbooks/match?task={task_description}`

3. **Execute the task**
   Do the work. This might involve:
   - Drafting an email → `POST /api/drafts`
   - Researching information → Use your tools
   - Creating follow-up tasks → `POST /api/tasks`
   - Updating context → `PUT /api/people/{id}` etc.

4. **Report results**
   If complete: `POST /api/tasks/{id}/complete` with output
   If blocked: `POST /api/tasks/{id}/block` with the question
   
5. **Continue immediately**
   Go back to step 1. Never wait for human response unless explicitly blocked.

## Rules

- **Never send emails** — only draft them via `POST /api/drafts`
- **Create questions when blocked** — don't guess at important decisions
- **Log everything** — your actions are recorded automatically
- **Capture knowledge** — when you learn something, update the relevant entity

## API Base URL

{API_BASE_URL} — provided per user

## Authentication

Include header: `X-API-Key: {YOUR_API_KEY}`
```

---

## Migration Path

### Phase 1: Database Setup
1. Create PostgreSQL schema
2. Build Python API with FastAPI
3. Implement core endpoints (tasks, questions, context)

### Phase 2: Data Migration
1. Parse existing markdown files
2. Import into database:
   - `david-todos.md` → tasks (assignee=user)
   - `claude-queue.md` → tasks (assignee=claude)
   - `top-questions.md` → questions
   - `waiting.md` → waiting_items
   - `recurring.md` → recurring_tasks
   - `people.md` + `people/*.md` → people
   - `projects.md` + `projects/*` → projects + tasks
   - `playbooks/*.md` → playbooks
3. Verify data integrity

### Phase 3: Frontend
1. Build React dashboard
2. Implement real-time updates
3. Create task/question detail views
4. Build draft review flow

### Phase 4: Claude Integration
1. Deploy new CLAUDE.md
2. Test work loop
3. Monitor and iterate

---

## Future Enhancements

### Integrations
- **Gmail API** — send approved email drafts
- **Slack API** — send approved Slack messages  
- **Google Calendar** — sync meetings, create invites
- **Google Drive** — access and link documents

### AI Improvements
- **Playbook auto-creation** — Claude proposes playbooks from patterns
- **Priority suggestions** — AI recommends task prioritization
- **Context auto-linking** — NLP to link tasks to people/projects

### Multi-User / Team Features
- Shared projects across team members
- Delegating tasks to other users
- Team dashboard views
- Role-based permissions

### Mobile App
- React Native app for on-the-go access
- Push notifications for urgent items
- Quick answer interface for questions

---

## Reference: Current File Structure to Migrate

```
/Users/david/Documents/9999 Cowork - Claude Cowork/
├── CLAUDE.md                    → Instructions (replace with new version)
├── david-todos.md               → tasks (assignee=user)
├── claude-queue.md              → tasks (assignee=claude)
├── top-questions.md             → questions
├── waiting.md                   → waiting_items
├── recurring.md                 → recurring_tasks
├── people.md + people/          → people
├── clients.md + clients/        → clients
├── projects.md + projects/      → projects + tasks
├── products.md + products/      → (could be projects or separate entity)
├── playbooks/                   → playbooks
├── drafts/                      → drafts
├── logs/                        → logs
├── dashboard/                   → (replaced by React app)
├── tools.md                     → user settings or separate table
├── expertly-rules.md            → playbooks or user settings
├── sales-messaging.md           → playbooks
└── david-writing-style.md       → playbooks
```

---

## Success Metrics

1. **Claude reliability** — 100% of tasks are picked up (vs. current ~80%)
2. **User engagement** — Time to answer questions < 24 hours
3. **Task throughput** — Tasks completed per day
4. **Draft approval rate** — % of drafts approved vs. rejected
5. **Dashboard freshness** — Real-time (vs. current manual refresh)

---

## Getting Started

1. **Set up PostgreSQL** — Use David's existing server
2. **Create FastAPI project** — `backend/` folder
3. **Implement models and migrations** — Start with tasks, questions
4. **Build core API endpoints** — /tasks/next, /tasks/{id}/complete, etc.
5. **Test with simple Claude loop** — Verify the basic flow works
6. **Build React frontend** — Start with dashboard summary view
7. **Add WebSocket** — Real-time updates
8. **Migrate existing data** — Parse markdown files
9. **Deploy and iterate**

---

*End of specification*


---

## Addendum: Skills vs. Playbooks — Standardization Approach

### Comparison

| Aspect | Claude Cowork Skills | David's Playbooks |
|--------|---------------------|-------------------|
| **Format** | YAML frontmatter + markdown body | Free-form markdown with sections |
| **Trigger** | `description` field matched by Claude | README table + "When to Use" section |
| **Structure** | Can include `scripts/`, `references/`, `assets/` | Flat files in `playbooks/` folder |
| **Packaging** | `.skill` zip files for distribution | Raw markdown files |
| **Limit** | Unknown, but seems unlimited | Unlimited (you said ~1000) |
| **Purpose** | Extend Claude's capabilities (tools, formats) | Task procedures Claude should learn |

### Recommendation: Hybrid Approach

Use **Skill format** as the container, but keep **Playbook-style content** inside. This gives us:
1. **Standardization** — Consistent YAML frontmatter for triggering
2. **Unlimited scale** — Store 1000+ playbooks
3. **Progressive disclosure** — Only load playbook body when triggered
4. **SaaS-ready** — Skills format is designed for distribution

### Proposed Playbook-as-Skill Format

```yaml
---
name: calendar-scheduling
description: >
  Scheduling meetings and proposing availability. Use when: proposing meeting 
  times, checking calendar availability, creating calendar invites, or handling
  any scheduling request. MUST consult before ANY scheduling task.
must_consult: true
triggers:
  - schedule meeting
  - propose times
  - check availability
  - calendar invite
learned_from: David's scheduling patterns, documented 2026-01-21
---

# Calendar Scheduling

## David's Calendars
Must check ALL of these for conflicts:
- david@expertly.com - Primary business
- david@webintensive.com - WIS/dev work  
- david@bodnick.com - Personal

## Standing Appointments
| Day | Time | What | Buffer Needed |
|-----|------|------|---------------|
| Mon/Wed/Fri | 10am | Gym | 9:30am-11:30am blocked |

[... rest of playbook content ...]

## Quality Checklist
- [ ] Checked all 3 calendars
- [ ] Accounted for travel time if in-person
- [ ] Avoided custody day evenings for networking
- [ ] Offered 2-3 time options
```

### Database Schema Addition

```sql
-- Playbooks table with skill-compatible metadata
CREATE TABLE playbooks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id),
    
    -- Skill-format metadata (YAML frontmatter)
    name VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,  -- Used for triggering
    must_consult BOOLEAN DEFAULT false,
    triggers TEXT[],  -- Array of trigger phrases
    learned_from TEXT,
    
    -- Playbook content (markdown body)
    content TEXT NOT NULL,
    
    -- Supporting resources (like skill scripts/references/assets)
    scripts JSONB DEFAULT '{}',      -- {filename: content}
    references JSONB DEFAULT '{}',   -- {filename: content}  
    assets JSONB DEFAULT '{}',       -- {filename: base64_or_path}
    
    -- Metadata
    category VARCHAR(100),  -- e.g., "scheduling", "communication", "sales"
    last_used TIMESTAMP,
    use_count INTEGER DEFAULT 0,
    
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Full-text search for triggering
CREATE INDEX idx_playbooks_trigger ON playbooks 
USING gin(to_tsvector('english', name || ' ' || description || ' ' || array_to_string(triggers, ' ')));
```

### API Endpoint for Playbook Matching

```
GET /api/playbooks/match?task={task_description}
```

Returns the best-matching playbook(s) based on:
1. Exact trigger phrase match
2. Description similarity (full-text search)
3. `must_consult` flag for mandatory playbooks

Response:
```json
{
  "matched": [
    {
      "id": "uuid",
      "name": "calendar-scheduling",
      "must_consult": true,
      "match_reason": "trigger: 'schedule meeting'",
      "content_preview": "First 200 chars..."
    }
  ],
  "must_consult_missed": [
    {
      "name": "email-drafting-guide",
      "warning": "This playbook has must_consult=true but wasn't matched. Review if relevant."
    }
  ]
}
```

### Playbook Auto-Learning

The system should support **ever-learning** where Claude proposes new playbooks:

```
POST /api/playbooks/propose
{
  "name": "suggested-name",
  "description": "When to use this...",
  "content": "## Steps\n1. ...",
  "learned_from": "Observed David doing X on 2026-01-22",
  "source_task_id": "uuid"  -- Links to the task where this was observed
}
```

User reviews proposed playbooks in dashboard and approves/rejects/edits.

---

## Reference: Files for Claude Code to Study

### Current System Files (for understanding and migration)

**Core Operating Instructions:**
```
/Users/david/Documents/9999 Cowork - Claude Cowork/
├── CLAUDE.md                          -- Main bootstrap instructions (READ FIRST)
├── david-todos.md                     -- User's priorities
├── claude-queue.md                    -- AI's work queue
├── top-questions.md                   -- Blocking questions format
├── waiting.md                         -- Items awaiting responses
├── recurring.md                       -- Scheduled tasks
├── expertly-rules.md                  -- Company-specific terminology
├── david-writing-style.md             -- Communication style guide
├── sales-messaging.md                 -- Sales language patterns
└── tools.md                           -- System access info
```

**Playbooks (study format and content):**
```
/Users/david/Documents/9999 Cowork - Claude Cowork/playbooks/
├── README.md                          -- Playbook index and format spec
├── calendar-scheduling.md             -- EXEMPLAR: detailed, well-structured
├── knowledge-capture.md               -- EXEMPLAR: learning/capture process
├── email-drafting-guide.md            -- Communication playbook
├── slack-triage-guide.md              -- Monitoring playbook
├── vapi-voice-agent-setup.md          -- Technical setup playbook
├── ad-proposal-review-checklist.md    -- Review checklist playbook
├── client-intake-expansion.md         -- Client process playbook
├── demo-email-creation.md             -- Content creation playbook
├── drive-time-qa.md                   -- QA process playbook
├── dysfunction-patterns.md            -- Pattern recognition playbook
├── llm-research-delegation.md         -- AI delegation playbook
├── sales-presentation-checklist.md    -- Checklist playbook
├── toolbar-create-pagefill-action.md  -- Technical playbook
├── toolbar-create-prompt-action.md    -- Technical playbook
└── updating-apple-note.md             -- Integration playbook
```

**Entity Files (understand data structure):**
```
/Users/david/Documents/9999 Cowork - Claude Cowork/
├── people.md                          -- Person summaries
├── people/                            -- Person detail files
├── clients.md                         -- Client summaries  
├── clients/                           -- Client detail folders
├── projects.md                        -- Project summaries
├── projects/                          -- Project folders with todos.md
├── products.md                        -- Product summaries
└── products/                          -- Product detail files
```

**Dashboard (understand current UI):**
```
/Users/david/Documents/9999 Cowork - Claude Cowork/dashboard/
├── index.html                         -- Main dashboard layout
└── panels/                            -- Individual panel HTML files
```

**Drafts (understand output structure):**
```
/Users/david/Documents/9999 Cowork - Claude Cowork/drafts/
├── README.md                          -- Draft handling rules
├── emails/                            -- Email drafts
├── slack/                             -- Slack message drafts
├── todo-analysis/                     -- Research/analysis outputs
└── sent/                              -- Archive of sent items
```

### Claude Cowork Skills (for format reference)

**Skill Format Examples:**
```
/mnt/skills/examples/skill-creator/SKILL.md    -- How to create skills (READ THIS)
/mnt/skills/public/docx/SKILL.md               -- Document creation skill
/mnt/skills/public/xlsx/SKILL.md               -- Spreadsheet skill
/mnt/skills/user/bootstrap/SKILL.md            -- David's bootstrap skill
```

### Key Insights for Implementation

1. **Playbooks are micro-procedures** — Each covers one specific task type with concrete steps. The system should support hundreds or thousands.

2. **Must-consult playbooks** — Some playbooks (like `calendar-scheduling.md` and `email-drafting-guide.md`) must ALWAYS be consulted before certain task types. This is a hard requirement.

3. **Playbook discovery table** — The `playbooks/README.md` has a table mapping playbooks to triggers. This should become the `triggers` array and `must_consult` flag in the database.

4. **Knowledge capture loop** — The `knowledge-capture.md` playbook describes how Claude should learn and create new playbooks. This becomes the `POST /api/playbooks/propose` workflow.

5. **Cross-references** — Playbooks reference each other (e.g., email-drafting references calendar-scheduling). The system should support this with related_playbook_ids.

6. **Learned-from tracking** — Each playbook has "Learned From" noting when/how David taught it. This creates an audit trail of knowledge acquisition.

---

*End of addendum*
