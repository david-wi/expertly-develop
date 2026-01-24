# Expertly Define - Implementation Plan

## Executive Summary

Expertly Define is an AI-powered requirements management tool that keeps product requirements, code, tests, and delivery work connected over time. It answers three key questions: What does the product do? Where does that live in the code? How do we know it works?

## Enhanced Feature Set

### Core Features (MVP)

#### 1. Products & Requirements Tree
- Hierarchical tree structure for requirements (modules → features → sub-features)
- Drag-and-drop reordering
- Stable unique keys (e.g., `REQ-001`) that never change
- Tags: functional, nonfunctional, security, performance, usability, invariant
- Priority levels: Critical, High, Medium, Low
- Status: Draft, Ready to Build, Implemented, Verified

#### 2. Requirement Definition
Each requirement includes:
- **What this does** - Single clear sentence starting with "Users can..."
- **Why this exists** - Plain English rationale
- **Not included** - Explicit scope exclusions
- **How we know it works** - Acceptance criteria that map to tests
- **Implementation links** - Code locations
- **Verification links** - Test files and check status
- **Delivery work** - Jira/external ticket references

#### 3. Version History
- Every requirement change creates a new version (never overwrite)
- Compare any two versions with visual diff
- Restore older versions (creates new version)
- Audit trail: who changed what, when, and why
- Statuses: Active, Superseded, Canceled

#### 4. Dashboard ("Today" View)
- Recent changes across all requirements
- Release snapshot progress
- Checks needing attention (failing tests, missing coverage)
- Quick actions: Review changes, Fix links

#### 5. Release Snapshots
- Point-in-time view of all requirements
- Track what changed since last release
- Critical requirements verification percentage
- Export release notes

### AI-Powered Features

#### 6. Smart Import
- **From Documents**: Upload FSD/PRD, AI extracts requirements tree
- **From Existing Code**: Scan repos, infer requirements from code structure
- **From Running App**: AI explores app, takes screenshots, infers behaviors

#### 7. AI Assistance
- Draft requirement subtrees from natural language
- Suggest acceptance criteria and test ideas
- Detect contradictions between requirements
- Auto-suggest code locations for requirements
- Generate Jira story drafts

### Integration Features

#### 8. Code Linking
- Track code file paths implementing each requirement
- Auto-detect when linked files move or change
- "Needs a look" status when code drifts
- Open mapping PRs to update links

#### 9. Verification Tracking
- Link unit, integration, e2e tests to requirements
- Show test status: Passing, Failing, Not Run
- Track manual verification checkpoints
- Coverage gaps highlighted

#### 10. External Integrations (Future)
- Jira/Teamwork story generation
- GitHub/GitLab code scanning
- CI/CD test result ingestion

## Technical Architecture

### Stack
- **Frontend**: Next.js 14 with App Router, TypeScript, Tailwind CSS, shadcn/ui
- **Backend**: Next.js API routes with tRPC
- **Database**: SQLite with Drizzle ORM (easy deployment, can upgrade to Postgres)
- **AI**: Anthropic Claude API for intelligent features
- **Auth**: Simple API key auth initially (can add OAuth later)

### Data Models

```
Product
├── id, name, description, created_at, updated_at

Requirement
├── id, product_id, parent_id, stable_key
├── title, what_this_does, why_this_exists
├── not_included, acceptance_criteria (JSON array)
├── status, priority, tags (JSON array)
├── order_index, created_at, updated_at

RequirementVersion
├── id, requirement_id, version_number
├── snapshot (JSON - full requirement state)
├── change_summary, changed_by, changed_at
├── status (active, superseded, canceled)

CodeLink
├── id, requirement_id, file_path, description
├── status (up_to_date, needs_look, broken)
├── last_checked_at

TestLink
├── id, requirement_id, test_path, test_type
├── status (passing, failing, not_run)
├── last_run_at

ReleaseSnapshot
├── id, product_id, version_name, created_at
├── requirements_snapshot (JSON)
├── stats (JSON - verified count, etc.)

DeliveryLink
├── id, requirement_id, external_id, external_system
├── intent (implements, modifies, verifies, refactors)
├── url
```

### Page Structure

```
/                       → Dashboard (Today view)
/products               → Product list
/products/[id]          → Product tree view
/products/[id]/tree     → Full tree navigator
/requirements/[id]      → Requirement detail (tabs)
/requirements/[id]/versions → Version history
/requirements/[id]/compare  → Version comparison
/releases               → Release snapshots list
/releases/[id]          → Release detail
/import                 → Import wizard
/settings               → Settings
```

## Implementation Phases

### Phase 1: Core Foundation
1. Project setup (Next.js, Tailwind, shadcn/ui)
2. Database schema and migrations
3. Product CRUD
4. Requirements tree with basic CRUD
5. Requirement detail view with all fields

### Phase 2: Versioning & History
1. Version tracking on requirement changes
2. Version comparison UI
3. Restore functionality
4. Audit trail display

### Phase 3: Dashboard & Navigation
1. Dashboard with recent changes
2. Tree navigator with search
3. Quick status indicators
4. Breadcrumb navigation

### Phase 4: Linking Features
1. Code link management
2. Test link management
3. Delivery work links
4. Link health checking

### Phase 5: Release Management
1. Create release snapshots
2. Release comparison
3. Export functionality (JSON, basic PDF structure)

### Phase 6: AI Features
1. AI requirement drafting
2. Acceptance criteria suggestions
3. Contradiction detection

## UI Design Principles

Based on the mockups:
- Clean, minimal design with plenty of whitespace
- Purple accent color (#7C3AED) for primary actions
- Card-based layouts for content sections
- Status badges with semantic colors (green=good, yellow=warning, red=failing)
- Tabs for requirement detail sections
- Left sidebar tree navigation on tree views

## File Structure

```
expertly-define/
├── src/
│   ├── app/
│   │   ├── layout.tsx
│   │   ├── page.tsx (dashboard)
│   │   ├── products/
│   │   ├── requirements/
│   │   ├── releases/
│   │   └── api/
│   ├── components/
│   │   ├── ui/ (shadcn components)
│   │   ├── layout/
│   │   ├── requirements/
│   │   ├── tree/
│   │   └── dashboard/
│   ├── lib/
│   │   ├── db/
│   │   ├── utils/
│   │   └── ai/
│   └── styles/
├── drizzle/
├── public/
├── docs/
└── tests/
```

## Deployment

- GitHub repository: expertly-define
- Deployed to Digital Ocean droplet via Coolify
- Auto-deploy on push to main
- SQLite database file persisted in volume

## Success Metrics

1. Requirements can be created and organized in < 30 seconds
2. Full requirement definition takes < 2 minutes
3. Version history is instantly accessible
4. Dashboard loads in < 1 second
5. Tree navigation feels instant
