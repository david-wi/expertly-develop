# Expertly Today — Architecture Document

> **Version**: 1.2
> **Date**: January 22, 2026
> **Status**: Ready for Review
>
> **Key Updates**:
> - v1.1: Added mandatory Knowledge Capture system (Learning Loop)
> - v1.2: Added multi-tenant database isolation (future-proofed for dedicated DBs)
> - v1.2: Added comprehensive testing strategy with coverage requirements
> - v1.2: Added tenants table and connection factory pattern

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [System Overview](#system-overview)
3. [Core Design Principles](#core-design-principles)
4. [Data Model](#data-model)
5. [Backend Architecture](#backend-architecture)
6. [Frontend Architecture](#frontend-architecture)
7. [Claude Integration](#claude-integration)
8. [Playbook System](#playbook-system)
9. [Real-Time Updates](#real-time-updates)
10. [Implementation Phases](#implementation-phases)
11. [Technical Decisions](#technical-decisions)

---

## Executive Summary

**Expertly Today** transforms David's file-based AI assistant workflow into a database-driven SaaS platform. The core insight: the current markdown-based system works well conceptually, but file-based operations are unreliable (Claude may miss updates). Moving to API-driven interactions makes the behavior deterministic and scalable.

### What We're Building

```
┌─────────────────────────────────────────────────────────────────────┐
│                           EXPERTLY TODAY                            │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────────────┐  │
│  │   CLAUDE     │◄──►│   FASTAPI    │◄──►│     REACT            │  │
│  │   (Loop)     │    │   BACKEND    │    │     DASHBOARD        │  │
│  │              │    │              │    │                      │  │
│  │ Get task     │    │ /api/tasks   │    │ Real-time view       │  │
│  │ Get context  │    │ /api/context │    │ Answer questions     │  │
│  │ Execute      │    │ /api/playbooks    │ Review drafts        │  │
│  │ Report       │    │ /api/drafts  │    │ Manage priorities    │  │
│  └──────────────┘    └──────┬───────┘    └──────────────────────┘  │
│                             │                                       │
│                      ┌──────▼───────┐                               │
│                      │  POSTGRESQL  │                               │
│                      │              │                               │
│                      │ Tasks        │                               │
│                      │ Questions    │                               │
│                      │ Playbooks    │                               │
│                      │ People       │                               │
│                      │ Projects     │                               │
│                      │ Drafts       │                               │
│                      │ Logs         │                               │
│                      └──────────────┘                               │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### Key Outcomes

| Problem (Current) | Solution (Expertly Today) |
|-------------------|---------------------------|
| Claude misses file updates | API guarantees task pickup |
| Manual dashboard refresh | WebSocket real-time updates |
| No audit trail | Every action logged |
| Context fragmented | Structured relationships |
| Knowledge gets lost | Mandatory capture loop routes learnings |
| Not scalable | Multi-tenant SaaS |

---

## System Overview

### The Work Loop

Claude operates in a continuous, deterministic loop:

```
┌────────────────────────────────────────────────────────────────────┐
│                         CLAUDE WORK LOOP                           │
├────────────────────────────────────────────────────────────────────┤
│                                                                    │
│   ┌─────────┐                                                      │
│   │  START  │                                                      │
│   └────┬────┘                                                      │
│        ▼                                                           │
│   ┌─────────────────────┐     No task?     ┌──────────────────┐   │
│   │ GET /tasks/next     │────────────────► │ Check recurring  │   │
│   └─────────┬───────────┘                  │ Wait 60s         │   │
│             │ Got task                     │ Loop back        │   │
│             ▼                              └──────────────────┘   │
│   ┌─────────────────────┐                                          │
│   │ GET /context/{id}   │◄── Gather all relevant context          │
│   └─────────┬───────────┘                                          │
│             ▼                                                      │
│   ┌─────────────────────┐                                          │
│   │ GET /playbooks/match│◄── Find applicable procedures           │
│   └─────────┬───────────┘                                          │
│             │                                                      │
│             ▼                                                      │
│   ┌─────────────────────┐     Blocked?     ┌──────────────────┐   │
│   │ EXECUTE THE TASK    │────────────────► │ POST /block      │   │
│   │                     │                  │ (creates question)│   │
│   └─────────┬───────────┘                  └────────┬─────────┘   │
│             │ Success                               │              │
│             ▼                                       │              │
│   ┌─────────────────────┐                          │              │
│   │ ★ CAPTURE LEARNING  │◄── MANDATORY: Ask "what did I learn?"  │
│   │ POST /knowledge     │    Routes to correct entity             │
│   └─────────┬───────────┘                          │              │
│             ▼                                       │              │
│   ┌─────────────────────┐                          │              │
│   │ POST /complete      │                          │              │
│   └─────────┬───────────┘                          │              │
│             │                                       │              │
│             └───────────────────────────────────────┘              │
│                              │                                     │
│                              ▼                                     │
│                         [LOOP BACK]                                │
│                                                                    │
└────────────────────────────────────────────────────────────────────┘
```

### Core Entities

| Entity | Purpose | Key Relationships |
|--------|---------|-------------------|
| **Task** | Work to be done | → Project, → Person, → blocking Question |
| **Question** | Blocking item requiring human input | → unblocks Tasks |
| **Project** | Grouping of related work | → has many Tasks |
| **Person** | Contact with relationship context | → related to Tasks, Clients |
| **Client** | Customer/account | → has People (contacts) |
| **Draft** | Content awaiting review | → created from Task |
| **Playbook** | Procedure for how to do something | → matched to Tasks |
| **Knowledge** | Captured learning (routes to entities) | → source Task, → target entity |
| **RecurringTask** | Scheduled work template | → creates Tasks |
| **WaitingItem** | Something pending externally | → relates to Task |
| **SalesOpportunity** | Pipeline item | → Client, People |
| **Log** | Audit trail | → all entities |

---

## Core Design Principles

These principles are learned from the working file-based system and must be preserved:

### 1. Capture Knowledge Immediately (The Learning Loop)

> "When David teaches Claude something, record it NOW — not later."

This is the **most critical principle**. The system must continuously learn and improve.

**The Mandatory Question**: After EVERY task, Claude must ask itself:
- "What did I learn that should be captured?"
- "Did the user teach me something new?"
- "Did I discover a pattern, preference, or process?"

**Knowledge Categories & Routing**:
| What Was Learned | Where It Goes | Example |
|------------------|---------------|---------|
| How to do something | → **Playbook** | "When scheduling, check all 3 calendars" |
| Info about a person | → **Person** entity | "Patrick prefers brief emails" |
| Info about a client | → **Client** entity | "Liberty uses Outlook, not Gmail" |
| Info about a project | → **Project** entity | "CNW budget approved for Phase 2" |
| A URL, system, or tool | → **User settings** | "Slack workspace URL is..." |
| Company rule/terminology | → **Playbook** (rules) | "We call it 'AD' not 'Automation Designer'" |
| User preference | → **User settings** | "David prefers UTC timestamps" |

**Trigger Phrases** (force knowledge capture when detected):
- "Remember that..."
- "For future reference..."
- "Here's how we do this..."
- "Going forward..."
- "Always..." / "Never..."
- "FYI for next time..."

**Implementation:**
- `POST /api/knowledge/capture` — Routes learning to correct entity
- Knowledge capture step is MANDATORY before task completion
- System prompts Claude: "Before completing, what did you learn?"
- Empty response allowed, but the question must be asked
- All captured knowledge logged with source task for audit trail

### 2. Draft But Never Send

> "Claude drafts all external communication. David sends."

**Implementation:**
- `Draft` entity with mandatory review workflow
- No external API integrations send without explicit approval
- Draft history preserved for learning

### 3. Block Early, Don't Guess

> "When uncertain about something important, ask — don't assume."

**Implementation:**
- Clear `blocked` state that pauses task
- Questions have "why asking" and "what Claude will do with answer"
- User can see impact of answering

### 4. Relationship-Aware Communication

> "Think about who this person is relative to others, who else will see this, who deserves credit."

**Implementation:**
- Person entity has `relationship_to_user`, `political_context`
- Draft creation requires relationship context lookup
- Playbooks encode communication strategies

### 5. Surface Problems, Don't Hide Them

> "Flag dysfunction directly. No sugarcoating."

**Implementation:**
- Questions prioritized by business impact
- Blocked items visible on dashboard
- Overdue waiting items highlighted

### 6. Playbook-First for Critical Tasks

> "For scheduling, email, and other critical tasks — MUST consult the playbook."

**Implementation:**
- `must_consult` flag enforced by API
- Playbook matching runs automatically
- Warnings if must_consult playbook is skipped

---

## Data Model

### Entity Relationship Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                              DATA MODEL                                  │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│   ┌───────────┐         ┌───────────┐         ┌───────────┐            │
│   │   USER    │◄───────►│  PROJECT  │◄───────►│   TASK    │            │
│   └─────┬─────┘    1:N  └─────┬─────┘    1:N  └─────┬─────┘            │
│         │                     │ parent              │                   │
│         │ 1:N                 ▼                     │ N:1               │
│         ▼              ┌───────────┐               ▼                   │
│   ┌───────────┐        │ INITIATIVE│        ┌───────────┐              │
│   │  CLIENT   │        │ (project  │        │ QUESTION  │              │
│   └─────┬─────┘        │  type)    │        └───────────┘              │
│         │ 1:N          └───────────┘              ▲                     │
│         ▼                                         │ blocks              │
│   ┌───────────┐         ┌───────────┐            │                     │
│   │  PERSON   │◄───────►│   TASK    │────────────┘                     │
│   └───────────┘   N:M   └─────┬─────┘                                  │
│                               │                                         │
│                               │ creates                                 │
│                               ▼                                         │
│                         ┌───────────┐                                   │
│                         │   DRAFT   │                                   │
│                         └───────────┘                                   │
│                                                                         │
│   ┌───────────┐         ┌───────────┐         ┌───────────┐            │
│   │ PLAYBOOK  │◄────────│ KNOWLEDGE │────────►│  PERSON   │            │
│   │           │ routes  │ (learning │ routes  │  CLIENT   │            │
│   └───────────┘   to    │  capture) │   to    │  PROJECT  │            │
│                         └─────┬─────┘         └───────────┘            │
│                               ▲                                         │
│                               │ source                                  │
│   ┌───────────┐         ┌─────┴─────┐         ┌───────────┐            │
│   │ RECURRING │         │   TASK    │         │  WAITING  │            │
│   │   TASK    │         │           │         │   ITEM    │            │
│   └───────────┘         └───────────┘         └───────────┘            │
│                                                                         │
│   ┌───────────┐         ┌───────────┐                                   │
│   │   SALES   │◄───────►│  CLIENT   │                                   │
│   │OPPORTUNITY│   N:1   │           │                                   │
│   └───────────┘         └───────────┘                                   │
│                                                                         │
│   ┌───────────────────────────────────────────────────────┐            │
│   │                         LOG                            │            │
│   │  (Records all actions on all entities)                │            │
│   └───────────────────────────────────────────────────────┘            │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### Multi-Tenancy & Data Isolation

The system supports two isolation models, designed for future-proofing:

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        DATA ISOLATION MODELS                            │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  MODEL A: Shared Database (Default)         MODEL B: Dedicated Database │
│  ─────────────────────────────────          ─────────────────────────── │
│                                                                         │
│  ┌─────────────────────────┐               ┌─────────────────────────┐ │
│  │    SHARED POSTGRES      │               │   TENANT A's POSTGRES   │ │
│  │    ─────────────────    │               │   ─────────────────────  │ │
│  │                         │               │                         │ │
│  │  ┌─────┐ ┌─────┐       │               │  All tables for         │ │
│  │  │ A's │ │ B's │ ...   │               │  Tenant A only          │ │
│  │  │data │ │data │       │               │                         │ │
│  │  └─────┘ └─────┘       │               └─────────────────────────┘ │
│  │                         │                                           │
│  │  Row-level isolation    │               ┌─────────────────────────┐ │
│  │  via tenant_id          │               │   TENANT B's POSTGRES   │ │
│  │                         │               │   ─────────────────────  │ │
│  └─────────────────────────┘               │                         │ │
│                                            │  All tables for         │ │
│  Risk: Bug/injection could                 │  Tenant B only          │ │
│  leak across tenants                       │                         │ │
│                                            └─────────────────────────┘ │
│  Cost: Lower                                                           │
│                                            Risk: Impossible to leak    │
│                                            (credentials don't work)    │
│                                                                        │
│                                            Cost: Higher (premium)      │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

**Initial implementation**: Shared database with row-level isolation (Model A)
**Future premium tier**: Dedicated database per tenant (Model B)

**How it works**:
1. Every API request resolves `tenant_id` from the API key
2. Connection factory checks `tenants.database_mode`
3. For `shared`: Use default connection pool, enforce `tenant_id` in all queries
4. For `dedicated`: Decrypt `connection_config` (KMS), use tenant-specific connection

**Why this matters**: Even with perfect code, shared-database bugs happen. With dedicated databases, a missing WHERE clause or SQL injection can only affect that tenant's data — the credentials physically cannot access other databases.

### Database Schema

```sql
-- ============================================================================
-- TENANCY & ISOLATION
-- ============================================================================

-- Tenants (organizations/accounts - enables future dedicated databases)
CREATE TABLE tenants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(100) UNIQUE NOT NULL,    -- e.g., "acme-corp"

    -- Isolation model
    database_mode VARCHAR(20) DEFAULT 'shared',  -- shared, dedicated
    connection_config TEXT,               -- Encrypted (KMS) connection string for dedicated DBs
                                          -- NULL for shared mode

    -- Billing tier (for future premium dedicated DB option)
    tier VARCHAR(50) DEFAULT 'standard',  -- standard, premium, enterprise

    -- Settings
    settings JSONB DEFAULT '{}',

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- CORE TABLES
-- ============================================================================

-- Users (belong to a tenant)
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,

    email VARCHAR(255) NOT NULL,
    name VARCHAR(255),
    api_key VARCHAR(64) UNIQUE NOT NULL,
    role VARCHAR(50) DEFAULT 'member',    -- owner, admin, member
    settings JSONB DEFAULT '{}',
    timezone VARCHAR(50) DEFAULT 'UTC',

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(tenant_id, email)              -- Email unique within tenant
);

-- Projects (also used for initiatives and goals)
CREATE TABLE projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,  -- Creator/owner
    name VARCHAR(255) NOT NULL,
    description TEXT,

    -- Type distinguishes concrete work from strategic goals
    -- project: concrete deliverable (Liberty Hotel implementation)
    -- initiative: strategic effort (10x dev velocity)
    -- goal: outcome target (increase revenue 20%)
    project_type VARCHAR(50) DEFAULT 'project',

    status VARCHAR(50) DEFAULT 'active', -- active, on_hold, completed, archived
    priority_order INTEGER DEFAULT 0,

    -- For initiatives/goals: what does success look like?
    success_criteria TEXT,
    target_date DATE,

    -- Hierarchy: initiatives can contain projects, projects can contain sub-projects
    parent_id UUID REFERENCES projects(id) ON DELETE SET NULL,

    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tasks (the core work unit)
CREATE TABLE tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    project_id UUID REFERENCES projects(id) ON DELETE SET NULL,

    -- Core fields
    title VARCHAR(500) NOT NULL,
    description TEXT,
    priority INTEGER DEFAULT 3 CHECK (priority BETWEEN 1 AND 5),
    status VARCHAR(50) DEFAULT 'queued',
        -- queued, working, blocked, completed, cancelled
    assignee VARCHAR(50) DEFAULT 'claude' CHECK (assignee IN ('claude', 'user')),

    -- Timing
    due_date TIMESTAMPTZ,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,

    -- Blocking
    blocking_question_id UUID,

    -- Context & Output
    context JSONB DEFAULT '{}',  -- Related entities, background info
    output TEXT,                  -- Result of task execution

    -- Metadata
    source VARCHAR(100),          -- Where task originated (manual, recurring, claude)
    tags TEXT[],

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Questions (blocking items requiring human input)
CREATE TABLE questions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,

    -- The question itself
    text TEXT NOT NULL,
    context TEXT,                 -- Background for the question

    -- Why this matters (learned from existing system)
    why_asking TEXT,              -- "Why Claude is asking this"
    what_claude_will_do TEXT,     -- "What Claude will do with the answer"

    -- Priority & Status
    priority INTEGER DEFAULT 3 CHECK (priority BETWEEN 1 AND 5),
    priority_reason VARCHAR(50),  -- high_impact, blocking_multiple, time_sensitive
    status VARCHAR(50) DEFAULT 'unanswered', -- unanswered, answered, dismissed

    -- Answer
    answer TEXT,
    answered_at TIMESTAMPTZ,
    answered_by VARCHAR(50),      -- user or claude (if self-resolved)

    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Question-Task relationship (a question may unblock multiple tasks)
CREATE TABLE question_unblocks (
    question_id UUID REFERENCES questions(id) ON DELETE CASCADE,
    task_id UUID REFERENCES tasks(id) ON DELETE CASCADE,
    PRIMARY KEY (question_id, task_id)
);

-- Add foreign key for blocking_question_id
ALTER TABLE tasks ADD CONSTRAINT fk_blocking_question
    FOREIGN KEY (blocking_question_id) REFERENCES questions(id) ON DELETE SET NULL;

-- ============================================================================
-- PEOPLE & CLIENTS
-- ============================================================================

-- Clients (accounts/customers)
CREATE TABLE clients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    status VARCHAR(50) DEFAULT 'active', -- prospect, active, churned, archived
    notes TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- People (contacts with relationship context)
CREATE TABLE people (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    client_id UUID REFERENCES clients(id) ON DELETE SET NULL,

    -- Basic info
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255),
    phone VARCHAR(50),
    title VARCHAR(255),
    company VARCHAR(255),

    -- Relationship context (critical for communication)
    relationship VARCHAR(100),         -- colleague, client, prospect, partner, friend
    relationship_to_user TEXT,         -- "Reports to me", "Peer at client", etc.
    political_context TEXT,            -- "Close to CEO", "Often sidelined in meetings"
    communication_notes TEXT,          -- How to communicate with this person

    -- Tracking
    last_contact TIMESTAMPTZ,
    next_follow_up TIMESTAMPTZ,

    -- Context
    context_notes TEXT,               -- General notes about this person
    metadata JSONB DEFAULT '{}',

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Task-Person relationship (which people are relevant to a task)
CREATE TABLE task_people (
    task_id UUID REFERENCES tasks(id) ON DELETE CASCADE,
    person_id UUID REFERENCES people(id) ON DELETE CASCADE,
    role VARCHAR(50),                  -- subject, recipient, stakeholder, mentioned
    PRIMARY KEY (task_id, person_id)
);

-- ============================================================================
-- DRAFTS (content awaiting review)
-- ============================================================================

CREATE TABLE drafts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    task_id UUID REFERENCES tasks(id) ON DELETE SET NULL,

    -- Draft content
    type VARCHAR(50) NOT NULL,        -- email, slack, document, note
    recipient VARCHAR(255),
    subject VARCHAR(500),
    body TEXT NOT NULL,

    -- Status workflow
    status VARCHAR(50) DEFAULT 'pending', -- pending, approved, rejected, sent, revised

    -- Feedback loop
    feedback TEXT,                     -- User's feedback if rejected
    revision_of UUID REFERENCES drafts(id), -- Link to previous version

    -- Relationship context used
    relationship_context JSONB,        -- Snapshot of context considered when drafting

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    approved_at TIMESTAMPTZ,
    sent_at TIMESTAMPTZ
);

-- ============================================================================
-- PLAYBOOKS (procedures and knowledge)
-- ============================================================================

CREATE TABLE playbooks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,

    -- Identity
    name VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,         -- Used for matching
    category VARCHAR(100),             -- scheduling, communication, sales, technical

    -- Triggering
    triggers TEXT[],                   -- Phrases that match this playbook
    must_consult BOOLEAN DEFAULT false, -- MUST be consulted for certain task types

    -- Content (markdown)
    content TEXT NOT NULL,

    -- Supporting resources
    scripts JSONB DEFAULT '{}',        -- {filename: content}
    references JSONB DEFAULT '{}',     -- {filename: content}
    examples JSONB DEFAULT '[]',       -- Array of example scenarios

    -- Learning audit trail
    learned_from TEXT,                 -- "David taught this on 2026-01-21"
    source_task_id UUID REFERENCES tasks(id) ON DELETE SET NULL,

    -- Usage tracking
    last_used TIMESTAMPTZ,
    use_count INTEGER DEFAULT 0,

    -- Status
    status VARCHAR(50) DEFAULT 'active', -- active, proposed, archived

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- KNOWLEDGE CAPTURE (the learning system)
-- ============================================================================

-- Knowledge entries capture learnings and route them to the right place
CREATE TABLE knowledge (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,

    -- Source tracking
    source_task_id UUID REFERENCES tasks(id) ON DELETE SET NULL,
    source_type VARCHAR(50) NOT NULL,    -- task, conversation, trigger_phrase
    trigger_phrase VARCHAR(255),          -- If detected from trigger phrase

    -- The learning itself
    content TEXT NOT NULL,                -- What was learned
    category VARCHAR(50) NOT NULL,        -- playbook, person, client, project, setting, rule

    -- Routing result
    routed_to_type VARCHAR(50),           -- Which entity type it was routed to
    routed_to_id UUID,                    -- ID of the created/updated entity

    -- Status
    status VARCHAR(50) DEFAULT 'captured', -- captured, routed, pending_review, dismissed

    -- Metadata
    learned_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for finding unrouted knowledge
CREATE INDEX idx_knowledge_status ON knowledge(user_id, status);
CREATE INDEX idx_knowledge_source ON knowledge(source_task_id);

-- ============================================================================
-- RECURRING TASKS
-- ============================================================================

CREATE TABLE recurring_tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,

    -- Template
    title VARCHAR(500) NOT NULL,
    description TEXT,
    task_template JSONB NOT NULL,      -- Full task fields to use

    -- Schedule
    frequency VARCHAR(50) NOT NULL,    -- daily, weekly, monthly, custom
    cron_expression VARCHAR(100),      -- For custom schedules

    -- Tracking
    last_run TIMESTAMPTZ,
    next_run TIMESTAMPTZ NOT NULL,

    -- Control
    active BOOLEAN DEFAULT true,

    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- WAITING ITEMS (external dependencies)
-- ============================================================================

CREATE TABLE waiting_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    task_id UUID REFERENCES tasks(id) ON DELETE SET NULL,
    person_id UUID REFERENCES people(id) ON DELETE SET NULL,

    -- What we're waiting for
    what TEXT NOT NULL,
    who VARCHAR(255),

    -- Timeline
    since TIMESTAMPTZ DEFAULT NOW(),
    follow_up_date TIMESTAMPTZ,

    -- Context
    why_it_matters TEXT,

    -- Status
    status VARCHAR(50) DEFAULT 'waiting', -- waiting, resolved, abandoned
    resolved_at TIMESTAMPTZ,
    resolution_notes TEXT,

    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- SALES OPPORTUNITIES (dedicated pipeline tracking)
-- ============================================================================

CREATE TABLE sales_opportunities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    client_id UUID REFERENCES clients(id) ON DELETE SET NULL,

    -- Opportunity details
    name VARCHAR(255) NOT NULL,
    description TEXT,

    -- Pipeline
    stage VARCHAR(50) DEFAULT 'lead', -- lead, qualified, proposal, negotiation, closed_won, closed_lost
    value DECIMAL(12, 2),
    probability INTEGER CHECK (probability BETWEEN 0 AND 100),

    -- Timeline
    expected_close_date DATE,
    last_activity TIMESTAMPTZ,
    next_action TEXT,
    next_action_date DATE,

    -- Notes
    notes TEXT,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    closed_at TIMESTAMPTZ
);

-- ============================================================================
-- ACTIVITY LOGS (audit trail)
-- ============================================================================

CREATE TABLE logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,

    -- When & Who
    timestamp TIMESTAMPTZ DEFAULT NOW(),
    actor VARCHAR(50) DEFAULT 'claude', -- claude, user, system

    -- What
    action VARCHAR(100) NOT NULL,       -- task.created, question.answered, draft.approved, etc.
    entity_type VARCHAR(50),
    entity_id UUID,

    -- Details
    details JSONB DEFAULT '{}',         -- Action-specific data

    -- Context
    session_id VARCHAR(100),            -- Group related actions

    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- INDEXES
-- ============================================================================

-- Task retrieval (the critical path)
CREATE INDEX idx_tasks_next ON tasks(user_id, status, priority, created_at)
    WHERE status = 'queued' AND assignee = 'claude';
CREATE INDEX idx_tasks_user_status ON tasks(user_id, status);
CREATE INDEX idx_tasks_project ON tasks(project_id);
CREATE INDEX idx_tasks_blocking ON tasks(blocking_question_id) WHERE blocking_question_id IS NOT NULL;

-- Questions
CREATE INDEX idx_questions_unanswered ON questions(user_id, priority, created_at)
    WHERE status = 'unanswered';

-- People
CREATE INDEX idx_people_client ON people(client_id);
CREATE INDEX idx_people_user ON people(user_id);

-- Playbooks
CREATE INDEX idx_playbooks_user ON playbooks(user_id);
CREATE INDEX idx_playbooks_must_consult ON playbooks(user_id) WHERE must_consult = true;

-- Logs
CREATE INDEX idx_logs_user_time ON logs(user_id, timestamp DESC);
CREATE INDEX idx_logs_entity ON logs(entity_type, entity_id);

-- Full-text search
CREATE INDEX idx_tasks_search ON tasks
    USING gin(to_tsvector('english', title || ' ' || COALESCE(description, '')));
CREATE INDEX idx_people_search ON people
    USING gin(to_tsvector('english', name || ' ' || COALESCE(context_notes, '')));
CREATE INDEX idx_playbooks_search ON playbooks
    USING gin(to_tsvector('english', name || ' ' || description || ' ' || array_to_string(triggers, ' ')));
```

---

## Backend Architecture

### Technology Stack

| Component | Choice | Rationale |
|-----------|--------|-----------|
| Language | Python 3.12 | Infrastructure standard |
| Framework | FastAPI | Async, fast, great OpenAPI docs |
| ORM | SQLAlchemy 2.0 | Async support, mature |
| Database | PostgreSQL | Infrastructure standard |
| Migrations | Alembic | SQLAlchemy integration |
| Server | Uvicorn | ASGI, production-ready |
| Cache | Redis (optional) | WebSocket pub/sub, caching |
| Secrets | AWS KMS (future) | Encrypt dedicated DB credentials |

### Tenant-Aware Database Connections

The connection factory enables future database-per-tenant isolation:

```python
# tenant_db.py — Connection factory for multi-tenant isolation

from typing import AsyncGenerator
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from functools import lru_cache
import boto3  # For KMS decryption (future)

class TenantConnectionFactory:
    """
    Returns database connections based on tenant's isolation mode.

    Phase 1: All tenants use shared database (connection_config is NULL)
    Future:  Premium tenants get dedicated databases (connection_config encrypted)
    """

    def __init__(self, default_database_url: str):
        self.default_engine = create_async_engine(default_database_url)
        self._tenant_engines: dict[str, AsyncEngine] = {}

    async def get_session(self, tenant: Tenant) -> AsyncGenerator[AsyncSession, None]:
        """Get a database session for the given tenant."""

        if tenant.database_mode == "shared" or not tenant.connection_config:
            # Use shared database — tenant isolation via tenant_id in queries
            async with AsyncSession(self.default_engine) as session:
                yield session
        else:
            # Use dedicated database — true isolation
            engine = await self._get_tenant_engine(tenant)
            async with AsyncSession(engine) as session:
                yield session

    @lru_cache(maxsize=100)
    async def _get_tenant_engine(self, tenant: Tenant) -> AsyncEngine:
        """Get or create engine for dedicated tenant database."""
        if tenant.id not in self._tenant_engines:
            # Decrypt connection string (KMS in production)
            connection_url = self._decrypt_connection_config(tenant.connection_config)
            self._tenant_engines[tenant.id] = create_async_engine(connection_url)
        return self._tenant_engines[tenant.id]

    def _decrypt_connection_config(self, encrypted_config: str) -> str:
        """Decrypt connection config using KMS (future implementation)."""
        # Phase 1: Not implemented (all tenants are shared)
        # Future: Use AWS KMS to decrypt
        # kms = boto3.client('kms')
        # return kms.decrypt(CiphertextBlob=encrypted_config)['Plaintext']
        raise NotImplementedError("Dedicated databases not yet implemented")


# Dependency injection for FastAPI
async def get_db(
    request: Request,
    tenant: Tenant = Depends(get_current_tenant)
) -> AsyncGenerator[AsyncSession, None]:
    """FastAPI dependency that provides tenant-aware database session."""
    factory: TenantConnectionFactory = request.app.state.db_factory
    async for session in factory.get_session(tenant):
        yield session
```

**Key points:**
- Phase 1 uses shared database only — `database_mode='shared'` for all tenants
- Connection factory is ready for dedicated databases when needed
- Premium tier can be enabled by setting `database_mode='dedicated'` and providing encrypted `connection_config`
- All API endpoints use `get_db` dependency — switching to dedicated DB requires no code changes

### Project Structure

```
backend/
├── app/
│   ├── __init__.py
│   ├── main.py                    # FastAPI app, startup/shutdown
│   ├── config.py                  # Settings from environment
│   ├── database.py                # Async SQLAlchemy setup
│   ├── tenant_db.py               # Tenant-aware connection factory
│   │
│   ├── models/                    # SQLAlchemy models
│   │   ├── __init__.py           # Export all models
│   │   ├── base.py               # Base model with common fields
│   │   ├── user.py
│   │   ├── task.py
│   │   ├── question.py
│   │   ├── project.py
│   │   ├── person.py
│   │   ├── client.py
│   │   ├── draft.py
│   │   ├── playbook.py
│   │   ├── knowledge.py
│   │   ├── recurring_task.py
│   │   ├── waiting_item.py
│   │   ├── sales_opportunity.py
│   │   └── log.py
│   │
│   ├── schemas/                   # Pydantic schemas
│   │   ├── __init__.py
│   │   ├── task.py               # TaskCreate, TaskUpdate, TaskResponse
│   │   ├── question.py
│   │   └── ...                   # Matching models
│   │
│   ├── api/                       # Route handlers
│   │   ├── __init__.py
│   │   ├── deps.py               # Dependency injection (auth, db)
│   │   ├── tasks.py
│   │   ├── questions.py
│   │   ├── context.py            # Context retrieval endpoints
│   │   ├── playbooks.py
│   │   ├── drafts.py
│   │   ├── projects.py
│   │   ├── people.py
│   │   ├── clients.py
│   │   ├── knowledge.py          # Knowledge capture endpoints
│   │   ├── recurring.py
│   │   ├── waiting.py
│   │   ├── sales.py
│   │   ├── dashboard.py
│   │   └── logs.py
│   │
│   ├── services/                  # Business logic
│   │   ├── __init__.py
│   │   ├── task_service.py       # Task state machine, completion
│   │   ├── question_service.py   # Question answering, unblocking
│   │   ├── playbook_service.py   # Matching, must_consult enforcement
│   │   ├── knowledge_service.py  # Learning capture and routing
│   │   ├── draft_service.py      # Review workflow
│   │   ├── context_service.py    # Context assembly
│   │   ├── recurring_service.py  # Schedule management
│   │   └── log_service.py        # Audit logging
│   │
│   ├── websocket/                 # Real-time updates
│   │   ├── __init__.py
│   │   ├── manager.py            # Connection manager
│   │   └── events.py             # Event types
│   │
│   └── utils/
│       ├── __init__.py
│       ├── auth.py               # API key + JWT handling
│       └── search.py             # Full-text search helpers
│
├── alembic/                       # Database migrations
│   ├── env.py
│   └── versions/
│
├── tests/
│   ├── conftest.py
│   ├── test_tasks.py
│   └── ...
│
├── requirements.txt
├── Dockerfile
└── docker-compose.yml
```

### API Endpoints

#### Task Management (Claude's primary interface)

```
GET  /api/tasks/next                    # Get highest-priority unblocked task
     Response: { task, context, matched_playbooks, must_consult_warnings }

GET  /api/tasks                         # List tasks with filters
     Query: status, assignee, project_id, priority, limit, offset

POST /api/tasks                         # Create a task
     Body: { title, description, priority, assignee, project_id, due_date, context }

GET  /api/tasks/{id}                    # Get task details

PUT  /api/tasks/{id}                    # Update task

POST /api/tasks/{id}/start              # Mark task as working
     Response: { task, context, playbooks }

POST /api/tasks/{id}/complete           # Complete with output
     Body: { output, knowledge_captured, follow_up_tasks }

POST /api/tasks/{id}/block              # Block with question
     Body: { question_text, why_asking, what_claude_will_do, priority }
     Response: { task, question }

DELETE /api/tasks/{id}                  # Soft delete
```

#### Questions

```
GET  /api/questions                     # List questions
     Query: status, priority, limit, offset

GET  /api/questions/unanswered          # Unanswered questions prioritized

POST /api/questions                     # Create standalone question

PUT  /api/questions/{id}/answer         # Answer a question
     Body: { answer }
     Response: { question, unblocked_tasks }

PUT  /api/questions/{id}/dismiss        # Dismiss without answering
     Body: { reason }
```

#### Context Retrieval

```
GET  /api/context/task/{id}             # Full context for a task
     Response: {
       task,
       project,
       related_people: [{ person, relationship_context }],
       related_tasks,
       history,
       relevant_playbooks
     }

GET  /api/context/person/{id}           # Person with full context
GET  /api/context/project/{id}          # Project with tasks
GET  /api/context/client/{id}           # Client with people and opportunities

GET  /api/context/search                # Full-text search
     Query: q, entity_types[], limit
```

#### Knowledge Capture (The Learning System)

```
POST /api/knowledge/capture             # Capture a learning (MANDATORY after tasks)
     Body: {
       content: "Patrick prefers brief, direct emails",
       category: "person",              # playbook, person, client, project, setting, rule
       source_task_id: "uuid",          # What task taught us this
       trigger_phrase: "remember that"  # If detected from trigger phrase
     }
     Response: {
       knowledge: { id, content, category, status },
       routed_to: { type: "person", id: "uuid", field_updated: "communication_notes" },
       action_taken: "Updated Patrick's communication_notes"
     }

GET  /api/knowledge                     # List captured knowledge
     Query: category, status, source_task_id, limit, offset

GET  /api/knowledge/pending             # Knowledge awaiting review/routing

POST /api/knowledge/{id}/route          # Manually route knowledge to entity
     Body: { target_type: "playbook", target_id: "uuid" }

POST /api/knowledge/{id}/dismiss        # Dismiss if not worth keeping
     Body: { reason: "Already known" }

GET  /api/knowledge/triggers            # Get trigger phrases to detect
     Response: {
       phrases: [
         "remember that", "for future reference", "here's how we do this",
         "going forward", "always", "never", "FYI for next time"
       ]
     }
```

**Knowledge Routing Logic**:

```python
def route_knowledge(knowledge: Knowledge) -> RoutingResult:
    """
    Automatically routes captured knowledge to the right entity.
    """
    content = knowledge.content.lower()
    category = knowledge.category

    if category == "person":
        # Extract person name, find or create Person, update context
        person = find_or_create_person(content)
        person.context_notes += f"\n\n[{knowledge.learned_at}] {knowledge.content}"
        return RoutingResult(type="person", id=person.id, field="context_notes")

    elif category == "playbook":
        # Create proposed playbook for review
        playbook = create_proposed_playbook(
            name=extract_playbook_name(content),
            content=knowledge.content,
            learned_from=f"Task {knowledge.source_task_id}",
            source_task_id=knowledge.source_task_id
        )
        return RoutingResult(type="playbook", id=playbook.id, status="proposed")

    elif category == "client":
        client = find_client(content)
        client.notes += f"\n\n[{knowledge.learned_at}] {knowledge.content}"
        return RoutingResult(type="client", id=client.id, field="notes")

    elif category == "project":
        project = find_project(content)
        project.description += f"\n\n[{knowledge.learned_at}] {knowledge.content}"
        return RoutingResult(type="project", id=project.id, field="description")

    elif category == "setting":
        # Update user settings
        update_user_setting(knowledge.user_id, content)
        return RoutingResult(type="user_settings", field="custom")

    elif category == "rule":
        # Create a "rules" playbook entry
        playbook = create_or_update_rules_playbook(knowledge)
        return RoutingResult(type="playbook", id=playbook.id)

    return RoutingResult(status="pending_review")
```

#### Playbooks

```
GET  /api/playbooks                     # List playbooks
     Query: category, must_consult, status

GET  /api/playbooks/{id}                # Get playbook content

GET  /api/playbooks/match               # Match playbooks to task
     Query: task_description
     Response: {
       matched: [{ playbook, match_reason, relevance_score }],
       must_consult: [{ playbook, warning }]  # Always included if relevant
     }

POST /api/playbooks                     # Create playbook

POST /api/playbooks/propose             # Claude proposes a new playbook
     Body: { name, description, content, learned_from, source_task_id }
     Response: { playbook (status=proposed) }

PUT  /api/playbooks/{id}                # Update playbook

PUT  /api/playbooks/{id}/approve        # Approve proposed playbook

PUT  /api/playbooks/{id}/archive        # Archive playbook
```

#### Drafts

```
GET  /api/drafts                        # List drafts
     Query: status, type, limit, offset

GET  /api/drafts/{id}                   # Get draft with context

POST /api/drafts                        # Create draft
     Body: { type, recipient, subject, body, task_id }
     Note: relationship_context auto-captured

PUT  /api/drafts/{id}                   # Update draft

POST /api/drafts/{id}/approve           # Approve draft
     Response: { draft (status=approved), send_action }

POST /api/drafts/{id}/reject            # Reject with feedback
     Body: { feedback }

POST /api/drafts/{id}/revise            # Create revised version
     Body: { body, subject }
     Response: { new_draft (linked to original) }
```

#### Dashboard (Aggregated views)

```
GET  /api/dashboard                     # Main dashboard data
     Response: {
       today_priorities: tasks[],
       questions_for_you: questions[],
       claude_working_on: task,
       drafts_to_review: drafts[],
       waiting_on: waiting_items[],
       this_week: calendar_items[],
       overdue_items: []
     }

GET  /api/dashboard/stats               # Metrics
     Response: {
       tasks_completed_today,
       tasks_completed_this_week,
       questions_answered_today,
       drafts_reviewed_today,
       average_question_response_time
     }
```

#### Other Endpoints

```
# Recurring Tasks
GET  /api/recurring                     # List recurring tasks
GET  /api/recurring/due                 # Get due recurring tasks
POST /api/recurring                     # Create recurring task
POST /api/recurring/{id}/run            # Execute and reschedule

# Waiting Items
GET  /api/waiting                       # List waiting items
GET  /api/waiting/overdue               # Past follow-up date
POST /api/waiting                       # Create waiting item
PUT  /api/waiting/{id}/resolve          # Mark resolved

# Sales Opportunities
GET  /api/sales                         # List opportunities
POST /api/sales                         # Create opportunity
PUT  /api/sales/{id}                    # Update opportunity
PUT  /api/sales/{id}/advance            # Move to next stage

# Logs
GET  /api/logs                          # Activity log
     Query: entity_type, entity_id, actor, action, start_date, end_date
```

---

## Frontend Architecture

### Technology Stack

| Component | Choice | Rationale |
|-----------|--------|-----------|
| Framework | React 18 | Standard, hooks, concurrent |
| Language | TypeScript | Type safety |
| Styling | TailwindCSS | Utility-first, fast iteration |
| Data Fetching | TanStack Query | Caching, real-time, mutations |
| Routing | React Router | Standard |
| State | Zustand | Simple, lightweight |
| WebSocket | Native + custom hook | Real-time updates |

### Component Structure

```
frontend/
├── src/
│   ├── App.tsx
│   ├── main.tsx
│   │
│   ├── components/
│   │   ├── layout/
│   │   │   ├── Header.tsx
│   │   │   ├── Sidebar.tsx
│   │   │   └── Layout.tsx
│   │   │
│   │   ├── dashboard/
│   │   │   ├── Dashboard.tsx
│   │   │   ├── TodayPriorities.tsx
│   │   │   ├── QuestionsPanel.tsx
│   │   │   ├── ClaudeWorkingOn.tsx
│   │   │   ├── DraftsToReview.tsx
│   │   │   ├── WaitingOn.tsx
│   │   │   └── ThisWeek.tsx
│   │   │
│   │   ├── tasks/
│   │   │   ├── TaskList.tsx
│   │   │   ├── TaskCard.tsx
│   │   │   ├── TaskDetail.tsx      # Drawer/modal
│   │   │   ├── TaskForm.tsx
│   │   │   └── TaskFilters.tsx
│   │   │
│   │   ├── questions/
│   │   │   ├── QuestionList.tsx
│   │   │   ├── QuestionCard.tsx
│   │   │   ├── QuestionDetail.tsx
│   │   │   └── AnswerForm.tsx
│   │   │
│   │   ├── drafts/
│   │   │   ├── DraftList.tsx
│   │   │   ├── DraftCard.tsx
│   │   │   ├── DraftReview.tsx     # Full review interface
│   │   │   └── DraftEditor.tsx
│   │   │
│   │   ├── projects/
│   │   │   ├── ProjectList.tsx
│   │   │   └── ProjectDetail.tsx
│   │   │
│   │   ├── people/
│   │   │   ├── PeopleList.tsx
│   │   │   └── PersonDetail.tsx
│   │   │
│   │   ├── playbooks/
│   │   │   ├── PlaybookList.tsx
│   │   │   └── PlaybookDetail.tsx
│   │   │
│   │   └── common/
│   │       ├── Button.tsx
│   │       ├── Card.tsx
│   │       ├── Badge.tsx
│   │       ├── Modal.tsx
│   │       ├── Drawer.tsx
│   │       └── ...
│   │
│   ├── hooks/
│   │   ├── useTasks.ts
│   │   ├── useQuestions.ts
│   │   ├── useDrafts.ts
│   │   ├── useWebSocket.ts
│   │   └── useAuth.ts
│   │
│   ├── services/
│   │   ├── api.ts                 # Axios/fetch wrapper
│   │   └── websocket.ts           # WebSocket client
│   │
│   ├── stores/
│   │   └── uiStore.ts             # UI state (modals, drawers)
│   │
│   ├── types/
│   │   └── index.ts               # TypeScript interfaces
│   │
│   └── utils/
│       ├── formatters.ts
│       └── helpers.ts
│
├── public/
├── package.json
├── tailwind.config.js
├── tsconfig.json
└── Dockerfile
```

### Dashboard Layout

```
┌────────────────────────────────────────────────────────────────────────┐
│  Expertly Today                                        [David] [⚙]    │
├────────────────────────────────────────────────────────────────────────┤
│                                                                        │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐     │
│  │ TODAY'S          │  │ QUESTIONS        │  │ CLAUDE IS        │     │
│  │ PRIORITIES       │  │ FOR YOU          │  │ WORKING ON       │     │
│  │                  │  │                  │  │                  │     │
│  │ 1. [P1] Task A   │  │ 🔴 HIGH: Q1     │  │ Current task     │     │
│  │ 2. [P2] Task B   │  │ 🟠 MED:  Q2     │  │ ▓▓▓▓░░░░ 50%    │     │
│  │ 3. [P2] Task C   │  │                  │  │                  │     │
│  │                  │  │ [Answer inline]  │  │ Started: 2m ago  │     │
│  └──────────────────┘  └──────────────────┘  └──────────────────┘     │
│                                                                        │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐     │
│  │ DRAFTS TO        │  │ WAITING ON       │  │ THIS WEEK        │     │
│  │ REVIEW           │  │                  │  │                  │     │
│  │                  │  │ • Response from  │  │ Thu: 3 meetings  │     │
│  │ 📧 Email: Re:... │  │   Patrick (2d)   │  │ Fri: 2 meetings  │     │
│  │ 💬 Slack: ...    │  │ • Contract from  │  │                  │     │
│  │                  │  │   Legal (5d) ⚠️  │  │ [View calendar]  │     │
│  └──────────────────┘  └──────────────────┘  └──────────────────┘     │
│                                                                        │
│  ┌─────────────────────────────────────────────────────────────────┐  │
│  │ ALL TASKS                                                        │  │
│  │ [All] [Mine] [Claude's] [Blocked]  🔍 Search...   [+ New Task]  │  │
│  │                                                                  │  │
│  │ ┌────────────────────────────────────────────────────────────┐  │  │
│  │ │ [P1] Prepare for Liberty meeting    [Project: Liberty]  📋 │  │  │
│  │ └────────────────────────────────────────────────────────────┘  │  │
│  │ ┌────────────────────────────────────────────────────────────┐  │  │
│  │ │ [P2] Draft follow-up email to...    [Project: CNW]      📋 │  │  │
│  │ └────────────────────────────────────────────────────────────┘  │  │
│  └─────────────────────────────────────────────────────────────────┘  │
│                                                                        │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  │
│  │ Projects    │  │ People      │  │ Playbooks   │  │ Activity    │  │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘  │
│                                                                        │
└────────────────────────────────────────────────────────────────────────┘
```

### Key Interactions

**Clicking a Task** → Opens drawer showing:
- Full description and context
- Related people with relationship notes
- History (created, status changes)
- If blocked: question + inline answer form
- Actions: Edit, Reassign, Complete, Delete

**Answering a Question** →
- Can answer inline from Questions panel
- Can answer from blocked task detail
- Answer triggers unblock API → WebSocket pushes update

**Reviewing a Draft** →
- Opens full draft review interface
- Shows relationship context that was considered
- Actions: Approve, Reject (with feedback), Edit
- Approve triggers status update (future: integration sends)

---

## Claude Integration

### Simplified Claude Instructions

The new CLAUDE.md is dramatically simpler than the current file-based version:

```markdown
# Expertly Today — Claude Instructions

You are an AI assistant operating within the Expertly Today system.

## Your Operating Loop

Repeat continuously:

### 1. Get Next Task
```
GET /api/tasks/next
Headers: X-API-Key: {YOUR_API_KEY}
```

If no task, check `GET /api/recurring/due`, then wait 60 seconds.

### 2. Review Context & Playbooks

The `/tasks/next` response includes:
- `context`: Related people, project, history
- `matched_playbooks`: Relevant procedures
- `must_consult_warnings`: Playbooks you MUST review

**Always review must_consult playbooks before proceeding.**

### 3. Execute the Task

Do the work. Common actions:
- Draft email → `POST /api/drafts { type: "email", ... }`
- Create follow-up → `POST /api/tasks { ... }`
- Update person context → `PUT /api/people/{id}`
- Propose playbook → `POST /api/playbooks/propose`

### 4. ★ CAPTURE LEARNINGS (MANDATORY)

**Before completing ANY task, ask yourself:**
- "What did I learn that should be captured?"
- "Did the user teach me something new?"
- "Did I discover a pattern, preference, or process?"

**If you learned something, capture it:**
```
POST /api/knowledge/capture
{
  "content": "Patrick prefers brief, direct emails",
  "category": "person",  // playbook, person, client, project, setting, rule
  "source_task_id": "uuid"
}
```

**Watch for trigger phrases** — If the user said any of these, you MUST capture:
- "Remember that...", "For future reference...", "Here's how we do this..."
- "Going forward...", "Always...", "Never...", "FYI for next time..."

**Categories:**
| Category | What to capture | Where it goes |
|----------|-----------------|---------------|
| `playbook` | How to do something | New playbook (proposed) |
| `person` | Info about someone | Person's context_notes |
| `client` | Info about a client | Client's notes |
| `project` | Info about a project | Project description |
| `setting` | URL, tool, preference | User settings |
| `rule` | Company rule/term | Rules playbook |

### 5. Report Results

**If complete:**
```
POST /api/tasks/{id}/complete
{ "output": "...", "learnings_captured": true }
```

**If blocked:**
```
POST /api/tasks/{id}/block
{
  "question_text": "...",
  "why_asking": "...",
  "what_claude_will_do": "..."
}
```

### 6. Continue Immediately

Go back to step 1. Never wait unless explicitly blocked.

## Rules

1. **Never send emails** — only draft via `POST /api/drafts`
2. **Create questions when blocked** — don't guess important decisions
3. **★ ALWAYS capture knowledge** — this is mandatory, not optional
4. **Consult must_consult playbooks** — they are mandatory
5. **Watch for trigger phrases** — "remember", "going forward", etc. = must capture

## API Base URL

{API_BASE_URL}

## Authentication

Header: `X-API-Key: {YOUR_API_KEY}`
```

### API Response Design for Claude

The `/tasks/next` endpoint is designed for Claude's consumption:

```json
{
  "task": {
    "id": "uuid",
    "title": "Draft follow-up email to Patrick at Liberty",
    "description": "...",
    "priority": 1,
    "project": { "id": "uuid", "name": "Liberty Hotel" }
  },
  "context": {
    "people": [
      {
        "id": "uuid",
        "name": "Patrick Fields",
        "relationship": "client",
        "relationship_to_user": "Main contact at Liberty Hotel",
        "political_context": "Reports to GM. Close to decision-maker.",
        "communication_notes": "Prefers brief, direct emails. Responds quickly."
      }
    ],
    "project": {
      "name": "Liberty Hotel",
      "description": "AI implementation pilot",
      "recent_tasks": [...]
    },
    "related_tasks": [...],
    "history": [...]
  },
  "matched_playbooks": [
    {
      "id": "uuid",
      "name": "email-drafting-guide",
      "match_reason": "Task contains 'email'",
      "must_consult": true,
      "content_preview": "..."
    }
  ],
  "must_consult_warnings": [
    {
      "playbook_name": "email-drafting-guide",
      "warning": "MUST consult before any email drafting"
    }
  ]
}
```

---

## Playbook System

The playbook system is critical. It encodes institutional knowledge and ensures consistent behavior.

### Playbook Structure

```yaml
---
name: email-drafting-guide
description: >
  Guide for drafting external emails. MUST consult before ANY email.
  Covers tone, relationship awareness, strategic considerations.
must_consult: true
triggers:
  - draft email
  - email to
  - reply to
  - follow up with
category: communication
learned_from: David's communication patterns, documented 2026-01-15
---

# Email Drafting Guide

## Before You Draft

Ask yourself:
1. Who is this person relative to David?
2. Who else might see this email?
3. Who deserves credit in this situation?
4. What am I NOT promising?
5. How does this affect the long-term relationship?

## Tone Guidelines

- Warm but strategic (not transactional)
- Make the right people look good
- Raise concerns softly without blame
- Set expectations without over-promising

## Structure

1. Opening: Personal touch or reference to last conversation
2. Body: Clear, concise, one topic per paragraph
3. Ask: Specific next step or question
4. Close: Warm sign-off

## Examples

[Example 1: Following up after meeting...]
[Example 2: Raising a concern diplomatically...]

## Quality Checklist

- [ ] Checked relationship context
- [ ] Appropriate tone for recipient
- [ ] Clear ask or next step
- [ ] No over-promises
- [ ] Draft saved for review
```

### Must-Consult Enforcement

The API enforces must_consult playbooks:

1. `GET /tasks/next` always returns `must_consult_warnings` for relevant playbooks
2. `POST /tasks/{id}/complete` checks if must_consult playbooks were retrieved
3. If skipped, completion returns warning (not blocking, but logged)

### Playbook Matching Algorithm

```python
def match_playbooks(task_description: str, user_id: UUID) -> PlaybookMatch:
    # 1. Get all active playbooks for user
    playbooks = get_playbooks(user_id, status='active')

    matched = []
    must_consult = []

    for playbook in playbooks:
        # 2. Check trigger phrases (exact match)
        for trigger in playbook.triggers:
            if trigger.lower() in task_description.lower():
                matched.append(PlaybookMatchResult(
                    playbook=playbook,
                    match_reason=f"trigger: '{trigger}'",
                    relevance_score=1.0
                ))
                break

        # 3. Full-text search on description
        if not matched or playbook not in [m.playbook for m in matched]:
            score = full_text_score(task_description, playbook.description)
            if score > 0.5:
                matched.append(PlaybookMatchResult(
                    playbook=playbook,
                    match_reason="description similarity",
                    relevance_score=score
                ))

        # 4. Always include must_consult playbooks if task type matches
        if playbook.must_consult:
            if task_matches_playbook_category(task_description, playbook):
                must_consult.append(playbook)

    return PlaybookMatch(
        matched=sorted(matched, key=lambda x: -x.relevance_score),
        must_consult=must_consult
    )
```

### Playbook Proposal Workflow

```
Claude notices pattern → POST /api/playbooks/propose
                              │
                              ▼
                      ┌───────────────┐
                      │ status:       │
                      │ "proposed"    │
                      └───────┬───────┘
                              │
                              ▼
                   Dashboard shows proposal
                              │
                    ┌─────────┴─────────┐
                    │                   │
                    ▼                   ▼
           User approves          User rejects
                    │                   │
                    ▼                   ▼
           status: "active"     status: "rejected"
```

---

## Real-Time Updates

### WebSocket Protocol

```typescript
// Connection
ws://api.expertly.com/ws?token={jwt_token}

// Server → Client Events
{
  "type": "task.created",
  "payload": { "task": {...} }
}

{
  "type": "task.status_changed",
  "payload": { "task_id": "...", "old_status": "...", "new_status": "..." }
}

{
  "type": "question.created",
  "payload": { "question": {...} }
}

{
  "type": "draft.created",
  "payload": { "draft": {...} }
}

{
  "type": "playbook.proposed",
  "payload": { "playbook": {...} }
}

// Client → Server (optional)
{
  "type": "subscribe",
  "payload": { "channels": ["tasks", "questions", "drafts"] }
}
```

### Backend Implementation

```python
# websocket/manager.py
class ConnectionManager:
    def __init__(self):
        self.active_connections: Dict[str, List[WebSocket]] = {}

    async def connect(self, websocket: WebSocket, user_id: str):
        await websocket.accept()
        if user_id not in self.active_connections:
            self.active_connections[user_id] = []
        self.active_connections[user_id].append(websocket)

    async def disconnect(self, websocket: WebSocket, user_id: str):
        self.active_connections[user_id].remove(websocket)

    async def broadcast_to_user(self, user_id: str, event: dict):
        if user_id in self.active_connections:
            for connection in self.active_connections[user_id]:
                await connection.send_json(event)

# Usage in services
async def create_task(task_data: TaskCreate, user_id: UUID) -> Task:
    task = Task(**task_data.dict(), user_id=user_id)
    db.add(task)
    await db.commit()

    # Broadcast to connected clients
    await ws_manager.broadcast_to_user(
        str(user_id),
        {"type": "task.created", "payload": {"task": task.to_dict()}}
    )

    return task
```

---

## Testing Strategy

**Philosophy**: Tests are not optional. Every feature ships with tests. TDD where practical.

### Test Coverage Requirements

| Layer | Min Coverage | Test Type |
|-------|--------------|-----------|
| API endpoints | 90% | Integration tests |
| Services (business logic) | 95% | Unit tests |
| Models | 80% | Unit tests |
| Database queries | 90% | Integration tests |
| Frontend components | 80% | Component tests |
| Critical paths | 100% | E2E tests |

### Backend Testing Stack

```
pytest                    # Test runner
pytest-asyncio            # Async test support
pytest-cov               # Coverage reporting
httpx                    # Async HTTP client for API tests
factory-boy              # Test data factories
testcontainers           # Isolated Postgres for tests
```

### Test Structure

```
tests/
├── conftest.py                    # Fixtures, test DB setup
├── factories/                     # Test data factories
│   ├── user_factory.py
│   ├── task_factory.py
│   └── ...
├── unit/                          # Unit tests (no DB)
│   ├── services/
│   │   ├── test_task_service.py
│   │   ├── test_knowledge_service.py
│   │   └── ...
│   └── utils/
├── integration/                   # Integration tests (with DB)
│   ├── api/
│   │   ├── test_tasks_api.py
│   │   ├── test_questions_api.py
│   │   └── ...
│   └── services/
└── e2e/                          # End-to-end tests
    ├── test_work_loop.py         # Full Claude work loop
    └── test_knowledge_capture.py # Full learning flow
```

### Critical Test Cases (Must Have)

1. **Task State Machine**
   - queued → working → complete
   - queued → working → blocked → unblocked → complete
   - Cannot complete blocked task
   - Cannot block completed task

2. **Tenant Isolation**
   - User A cannot see User B's tasks
   - API key resolves to correct tenant
   - Queries always filter by tenant_id

3. **Knowledge Capture**
   - Trigger phrase detection
   - Routing to correct entity type
   - Playbook proposal workflow

4. **Playbook Matching**
   - Trigger phrase exact match
   - Full-text search fallback
   - must_consult always returned

---

## Implementation Phases

### Phase 1: Foundation (Week 1-2)

**Goal**: Working backend with core entities + comprehensive tests

**Setup:**
- [ ] Set up repository structure
- [ ] Configure PostgreSQL database
- [ ] Set up pytest with async support, coverage, testcontainers
- [ ] Create test factories for all models
- [ ] Implement SQLAlchemy models
- [ ] Run Alembic migrations

**Core API (with tests for each):**
- [ ] `/api/tasks` — CRUD + next + complete + block
  - [ ] Unit tests: TaskService state machine
  - [ ] Integration tests: All endpoints
  - [ ] Test: Tenant isolation
- [ ] `/api/questions` — CRUD + answer
  - [ ] Unit tests: Question answering, unblocking
  - [ ] Integration tests: All endpoints
- [ ] `/api/context/{type}/{id}`
  - [ ] Integration tests: Context assembly

**Auth:**
- [ ] Implement API key + JWT authentication
- [ ] Unit tests: Auth middleware
- [ ] Integration tests: Unauthorized access blocked

**Deploy:**
- [ ] Deploy to Coolify
- [ ] CI pipeline runs tests on every PR

**Exit Criteria**:
- Claude can fetch tasks, complete them, create questions
- All tests pass, coverage ≥ 85%

### Phase 2: Knowledge System (Week 2-3)

**Goal**: Playbook matching, knowledge capture + tests

**Knowledge Capture (with tests):**
- [ ] Implement Knowledge model and `/api/knowledge/capture`
  - [ ] Unit tests: Routing logic for each category
  - [ ] Unit tests: Trigger phrase detection
  - [ ] Integration tests: Full capture → route flow
- [ ] Implement KnowledgeService
  - [ ] Unit tests: 95% coverage required

**Playbooks (with tests):**
- [ ] Implement Playbook model and API
  - [ ] Unit tests: Matching algorithm
  - [ ] Unit tests: must_consult enforcement
  - [ ] Integration tests: All endpoints
- [ ] Build playbook proposal workflow
  - [ ] E2E test: Propose → review → approve

**Context (with tests):**
- [ ] Add people/client context endpoints
  - [ ] Integration tests
- [ ] Build full-text search
  - [ ] Integration tests: Search accuracy

**Exit Criteria**:
- Claude receives playbooks with tasks, can propose new ones
- Knowledge capture routes correctly
- All tests pass, coverage ≥ 90%

### Phase 3: Frontend Dashboard (Week 3-4)

**Goal**: Working React dashboard + component tests

**Setup:**
- [ ] Set up React project with TypeScript
- [ ] Configure TailwindCSS
- [ ] Set up Vitest + React Testing Library
- [ ] Set up MSW for API mocking

**Dashboard Panels (with component tests):**
- [ ] Today's Priorities — component test
- [ ] Questions for You — component test + interaction test
- [ ] Claude Working On — component test
- [ ] Drafts to Review — component test + interaction test
- [ ] Waiting On — component test

**Interactions (with tests):**
- [ ] Task detail drawer — component test
- [ ] Question answering inline — interaction test
- [ ] Draft review workflow — interaction test

**Deploy:**
- [ ] Deploy frontend to Coolify
- [ ] E2E tests with Playwright (critical paths)

**Exit Criteria**:
- User can view dashboard, answer questions, review drafts
- Component test coverage ≥ 80%
- E2E tests pass for critical paths

### Phase 4: Real-Time & Polish (Week 4-5)

**Goal**: Real-time updates, additional features + tests

**WebSocket (with tests):**
- [ ] Implement WebSocket server
  - [ ] Unit tests: Connection manager
  - [ ] Integration tests: Event broadcast
- [ ] Add WebSocket client to frontend
  - [ ] Component tests: Real-time updates render

**Additional Features (with tests):**
- [ ] Activity log view — integration + component tests
- [ ] Recurring tasks — unit + integration tests
- [ ] Sales opportunities — unit + integration tests

**Polish:**
- [ ] Performance optimization
- [ ] Error handling and logging
- [ ] Documentation

**Exit Criteria**:
- Full working system with real-time updates
- All tests pass, backend coverage ≥ 90%, frontend ≥ 80%

### Phase 5: Migration & Launch (Week 5-6)

**Goal**: Migrate existing data, go live

**Migration (with tests):**
- [ ] Build migration scripts for markdown files
  - [ ] Unit tests: Parser accuracy
  - [ ] Integration tests: Data integrity
- [ ] Import existing data:
  - [ ] Tasks from claude-queue.md, david-todos.md
  - [ ] Questions from top-questions.md
  - [ ] Playbooks from playbooks/
  - [ ] People from people/
  - [ ] Projects from projects/
- [ ] Validate data integrity
- [ ] Deploy new Claude instructions
- [ ] Run parallel (old + new) for validation
- [ ] Full cutover

**Deliverable**: System live with migrated data.

---

## Technical Decisions

### Why PostgreSQL over MongoDB?

- Relational data (tasks → projects → people) fits SQL better
- Full-text search with proper indexes
- ACID compliance for task state machine
- Infrastructure standard (shared instance)

### Why FastAPI over Django?

- Async-first (better for WebSocket)
- Automatic OpenAPI docs
- Lighter weight
- Faster for API-only backend

### Why TanStack Query over Redux?

- Built for server state
- Automatic caching and refetching
- Simpler mental model
- Less boilerplate

### Why Zustand over Context/Redux?

- Minimal boilerplate
- Simple API
- Works well with TanStack Query
- UI state only (server state in Query)

### Containerization

Both backend and frontend are containerized:

```dockerfile
# backend/Dockerfile
FROM python:3.12-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install -r requirements.txt
COPY . .
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]

# frontend/Dockerfile
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
```

### Environment Variables

```bash
# Backend
DATABASE_URL=postgresql+asyncpg://user:pass@host:5432/db
REDIS_URL=redis://host:6379/0  # Optional
JWT_SECRET=...
ALLOWED_ORIGINS=https://app.expertly.com

# Frontend
VITE_API_URL=https://api.expertly.com
VITE_WS_URL=wss://api.expertly.com/ws
```

---

## Next Steps

1. **Review this architecture** — Does it capture everything needed?
2. **Approve Phase 1 scope** — Any adjustments?
3. **Begin implementation** — Start with database schema and core API

---

*End of Architecture Document*
