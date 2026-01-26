# Work Plan - Expertly Today

## Current Session Goals
Get the Expertly Today platform fully operational:
1. Deploy to Coolify (DONE)
2. Migrate data from the old file-based system at `/Users/david/Documents/9999 Cowork - Claude Cowork/`
3. Fix any frontend/API issues preventing the dashboard from working

## Broader Context
Expertly Today is a database-driven replacement for David's file-based Claude assistant workflow. The platform was designed and coded, but needs deployment, data migration, and testing to be usable.

## Status
- **Last updated**: 2026-01-23 ~4:05 AM EST
- **Current state**: **APP FULLY WORKING + ALL FEATURES COMPLETE!** Multi-tenancy, user management, organization settings added. All tests passing. E2E screenshots captured.

## Completed This Session
- [x] Explored codebase structure
- [x] Found DigitalOcean and Coolify credentials
- [x] Created `expertly_today` database on managed PostgreSQL
- [x] Fixed multiple deployment issues:
  - [x] package-lock.json sync
  - [x] TypeScript build errors (type imports, vitest config)
  - [x] Docker compose port binding (changed to expose for Traefik)
  - [x] Added coolify network for Traefik routing
  - [x] Added Host constraint to Traefik routing
  - [x] Fixed DATABASE_URL SSL param (ssl=require not sslmode=require)
  - [x] Added curl to backend Dockerfile for healthcheck
- [x] Ran database migrations
- [x] Created tenant and user
- [x] Fixed API key generation to use cryptographically secure `secrets.token_hex()`
- [x] Generated secure API key: `e87623cff95b3847794076a899211fd8f2f4c5d17115746e59f575774c06d753`
- [x] Migrated 16 playbooks from `/Users/david/Documents/9999 Cowork - Claude Cowork/playbooks/`
- [x] Added work-plan tracking to `/Users/david/Code/_common/CLAUDE.md`
- [x] Fixed missing `updated_at` column in logs table
- [x] Migrated 50 tasks from david-todos.md
- [x] Fixed assignee validation issue (changed 'david' to 'user')
- [x] Fixed frontend API base URL (api.ts: localhost:8000/api -> /api)
- [x] Fixed API key loading (load from localStorage on init + in interceptor)
- [x] Fixed useDrafts.ts (localhost:8000/api -> /api)
- [x] Fixed useWaitingItems.ts (localhost:8000/api -> /api)
- [x] Fixed websocket.ts (construct URL from window.location)
- [x] Added no-cache headers to nginx for HTML files (fixes deployment cache issues)
- [x] Fixed questions table (added missing updated_at column)
- [x] Fixed drafts table (added missing updated_at column)
- [x] Fixed waiting_items table (added missing updated_at column)
- [x] Created drafts API endpoints (GET/POST /api/drafts, approve, reject)
- [x] Created waiting-items API endpoints (GET/POST /api/waiting-items, resolve)
- [x] Implemented full Questions management page with filter tabs, list/detail view, answer/dismiss flow
- [x] Configured floating IP (152.42.152.243) for stable access
- [x] Updated all infrastructure references to use floating IP
- [x] Updated /Users/david/CLAUDE.md with floating IP info

## In Progress
- Nothing currently in progress

## Remaining Tasks

### Data Migration (from `/Users/david/Documents/9999 Cowork - Claude Cowork/`)
- [x] Import tasks from `david-todos.md` (50 imported)
- [x] Import waiting items from `waiting.md` (17 imported - responses, sales, initiatives, networking)
- [x] Import people from `people.md` and `people/` folder (15 people imported)
- [x] Import projects from `projects.md` and `projects/` folder (8 projects imported)
- [x] Import clients from `clients.md` and `clients/` folder (6 clients imported)
- [x] Import drafts from `drafts/` folder (2 drafts imported - email & slack)
- [x] Import recurring tasks from `recurring.md` (14 tasks: 4 daily, 3 weekly, 3 monthly, 3 templates + 1 update summary)
  - Tasks have `source: "recurring"` and `tags: ["daily/weekly/monthly", "recurring"]`
- [x] Import knowledge/rules from `CLAUDE.md` and `expertly-rules.md` (13 rules imported to Company Rules playbook)

### Frontend Fixes
- [x] Fix Tasks page error (API URL was pointing to localhost instead of relative /api)
- [x] Verify all dashboard panels work (tested via Playwright - all panels loading)
- [x] Test question answering flow (Questions page fully implemented, tested answering a question)
- [x] Test draft review flow (API tested - create, approve, reject all working)

### Testing & Validation
- [x] Create a test task via API (tested and verified)
- [x] Create a test task via UI (E2E test written and executed)
- [x] Complete the full task lifecycle (task creation → detail view working)
- [x] Test playbook matching (verified - returns Email Drafting Guide, Calendar Scheduling, etc.)

### Multi-tenancy: Users and Organizations
- [x] Organizations can have multiple users
- [x] Track users in database (User model with email, name, role, timezone)
- [x] Admin interface for managing users/orgs (Settings page with tabs)
- [x] Usage tracking and reporting (total users, tasks, completions, API calls per month)
- [x] User management API: GET /api/users, POST /api/users, PUT /api/users/{id}, DELETE /api/users/{id}
- [x] Organization API: GET /api/organization, PUT /api/organization, GET /api/organization/usage
- [x] Admin-only operations protected with role checks
- [x] Settings page added to frontend with organization info and user management

### Claude Cowork Walkthrough & API Verification
- [x] Created database seed file (backend/seeds/database_seed_20260123.json)
- [x] Created restore_seed.py script for database restore
- [x] Created claude-cowork-walkthrough.md documentation
- [x] Made learnings_captured required in TaskComplete schema
- [x] Manual API simulation verified all 13 endpoints:
  - GET /api/tasks/next ✓
  - GET /api/playbooks/{id} ✓
  - POST /api/tasks/{id}/start ✓
  - POST /api/tasks/{id}/block ✓
  - PUT /api/questions/{id}/answer ✓
  - POST /api/tasks/{id}/complete ✓
  - POST /api/knowledge/capture ✓
  - POST /api/drafts ✓
  - POST /api/drafts/{id}/approve ✓
  - POST /api/waiting-items ✓
  - POST /api/tasks/claim ✓
- [x] Documented field name discrepancies in walkthrough

## Blockers / Questions
- None currently

## Notes
- **Deployed URL**: https://today.ai.devintensive.com/
- **API Docs**: https://today.ai.devintensive.com/api/docs
- **API Key**: `e87623cff95b3847794076a899211fd8f2f4c5d17115746e59f575774c06d753`
- **Floating IP**: 152.42.152.243
- **Coolify Dashboard**: http://152.42.152.243:8000
- **Database**: `expertly_today` on DigitalOcean managed PostgreSQL
- Source data location: `/Users/david/Documents/9999 Cowork - Claude Cowork/`
