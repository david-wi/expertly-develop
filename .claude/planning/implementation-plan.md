# Expertly Develop Monorepo - Implementation Plan

> **Version**: 1.0
> **Created**: 2026-01-26
> **Status**: Ready for Implementation

## Executive Summary

The **expertly-develop monorepo** consolidates all Expertly applications into a single repository with shared packages. This plan covers **monorepo infrastructure improvements, shared package expansion, and cross-app features**.

## Current State

### Monorepo Structure
```
expertly-develop/
├── apps/
│   ├── admin/      # Theme management (React + FastAPI + PostgreSQL)
│   ├── define/     # Requirements Management (Next.js + SQLite)
│   ├── develop/    # Visual Walkthroughs (React + FastAPI + MongoDB)
│   ├── identity/   # Auth service (React frontend only)
│   ├── manage/     # Queue Task Management (React + FastAPI + PostgreSQL)
│   ├── qa/         # AI Testing (React + FastAPI + PostgreSQL)
│   ├── salon/      # Salon Booking (React + FastAPI + MongoDB)
│   ├── today/      # Workflow Platform (React + FastAPI + PostgreSQL)
│   └── vibecode/   # Claude Dashboard (React + Node.js sub-monorepo)
├── packages/
│   └── ui/         # @expertly/ui shared components
└── package.json    # Workspace configuration
```

### Deployed Apps
| App | URL | Status |
|-----|-----|--------|
| Today | https://today.ai.devintensive.com/ | Live |
| Develop | https://develop.ai.devintensive.com/ | Live |
| Manage | https://manage.ai.devintensive.com/ | Live |
| QA | https://vibetest.ai.devintensive.com/ | Live |
| Salon | https://salon.ai.devintensive.com/ | Live |
| Vibecode | https://vibecode.ai.devintensive.com/ | Awaiting Test |
| Define | https://define.ai.devintensive.com/ | Live |

### Tech Stack Summary
- **Frontend**: React 18/19 + Vite + TypeScript + TailwindCSS
- **Backend**: FastAPI (Python 3.12) or Next.js
- **Databases**: PostgreSQL, MongoDB, SQLite
- **Deployment**: Docker + Coolify on DigitalOcean

---

## Phase 1: Monorepo Infrastructure

### 1.1 Turborepo Migration
**Goal**: Faster builds and better caching

**Tasks**:
- [ ] Install and configure Turborepo
- [ ] Define pipeline for build, test, lint
- [ ] Configure remote caching
- [ ] Update CI/CD to use turbo
- [ ] Add task dependencies (build UI before apps)

**Benefits**:
- Parallel task execution
- Cache hits skip redundant work
- Better dependency graph visualization

**Effort**: 3-4 days

### 1.2 Unified Testing
**Goal**: Run all tests from monorepo root

**Tasks**:
- [ ] Create root test scripts
  - `npm test` - Run all tests
  - `npm test:frontend` - All frontend tests
  - `npm test:backend` - All backend tests
  - `npm test:e2e` - All E2E tests
- [ ] Shared test utilities package
- [ ] Coverage aggregation across apps
- [ ] Test status dashboard

**Effort**: 2-3 days

### 1.3 Shared Configuration
**Goal**: Consistent config across apps

**Tasks**:
- [ ] `packages/eslint-config` - Shared ESLint rules
- [ ] `packages/typescript-config` - Base tsconfig
- [ ] `packages/tailwind-config` - Shared Tailwind preset
- [ ] Standardize Dockerfile patterns
- [ ] Shared environment variable naming

**Effort**: 2 days

### 1.4 Dependency Management
**Goal**: Consistent and secure dependencies

**Tasks**:
- [ ] Audit all dependencies
- [ ] Deduplicate versions
- [ ] Add Renovate/Dependabot
- [ ] Security scanning in CI
- [ ] License compliance check

**Effort**: 1-2 days

---

## Phase 2: Shared Packages Expansion

### 2.1 @expertly/ui Enhancement
**Goal**: Comprehensive component library

**Current Components**: Basic exports

**Tasks**:
- [ ] Component inventory (audit all apps)
- [ ] Extract common components:
  - Button, Input, Select, Checkbox
  - Card, Modal, Drawer, Tabs
  - Table with sorting/filtering
  - Form with validation
  - Toast notifications
  - Loading states
  - Empty states
  - Error boundaries
- [ ] Storybook documentation
- [ ] Visual regression tests
- [ ] Accessibility audit

**Effort**: 2 weeks

### 2.2 @expertly/api-client
**Goal**: Shared API utilities

**Tasks**:
- [ ] Base HTTP client with interceptors
- [ ] Authentication handling
- [ ] Error handling patterns
- [ ] Retry logic
- [ ] Request/response logging
- [ ] Type-safe API generation (OpenAPI)

**Effort**: 1 week

### 2.3 @expertly/auth
**Goal**: Unified authentication

**Tasks**:
- [ ] JWT handling utilities
- [ ] Token refresh logic
- [ ] Protected route components
- [ ] Auth context/hooks
- [ ] SSO preparation (future)

**Effort**: 1 week

### 2.4 @expertly/hooks
**Goal**: Shared React hooks

**Tasks**:
- [ ] useDebounce, useThrottle
- [ ] useLocalStorage, useSessionStorage
- [ ] useFetch with SWR pattern
- [ ] useWebSocket
- [ ] useMediaQuery
- [ ] useClickOutside

**Effort**: 3-4 days

### 2.5 @expertly/utils
**Goal**: Shared utility functions

**Tasks**:
- [ ] Date formatting (dayjs wrapper)
- [ ] Currency formatting
- [ ] String utilities
- [ ] Validation helpers
- [ ] Error utilities

**Effort**: 2-3 days

---

## Phase 3: Cross-App Features

### 3.1 Unified Authentication
**Goal**: Single sign-on across all Expertly apps

**Tasks**:
- [ ] Centralize identity service
  - User accounts
  - Organizations/tenants
  - API keys
  - Sessions
- [ ] OAuth2/OIDC implementation
- [ ] SSO flow between apps
- [ ] Shared user context
- [ ] Cross-app permissions

**Architecture**:
```
┌─────────────────────────────────────────────────────────────┐
│                   IDENTITY SERVICE                           │
│  /Users/david/Code/expertly-develop/apps/identity/          │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐        │
│  │  Users  │  │  Orgs   │  │Sessions │  │API Keys │        │
│  └─────────┘  └─────────┘  └─────────┘  └─────────┘        │
└─────────────────────────────────────────────────────────────┘
            │           │           │           │
            ▼           ▼           ▼           ▼
     ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐
     │  Today   │ │  Manage  │ │  Salon   │ │   QA     │
     └──────────┘ └──────────┘ └──────────┘ └──────────┘
```

**Effort**: 3-4 weeks

### 3.2 Unified Admin Portal
**Goal**: Central management for all apps

**Tasks**:
- [ ] Enhance apps/admin
- [ ] User management across apps
- [ ] Organization settings
- [ ] Billing/subscription (future)
- [ ] App switching interface
- [ ] Audit logs aggregation

**Effort**: 2 weeks

### 3.3 Cross-App Notifications
**Goal**: Centralized notification system

**Tasks**:
- [ ] Notification service
  - Email templates
  - SMS via Twilio
  - Push notifications
  - In-app notifications
- [ ] Notification preferences
- [ ] Delivery tracking
- [ ] Template management

**Effort**: 2 weeks

### 3.4 Shared Analytics
**Goal**: Unified analytics across apps

**Tasks**:
- [ ] Analytics package
- [ ] Event taxonomy
- [ ] Amplitude/Mixpanel integration
- [ ] Privacy controls
- [ ] Cross-app dashboards

**Effort**: 1 week

---

## Phase 4: DevOps & CI/CD

### 4.1 CI Pipeline Enhancement
**Tasks**:
- [ ] GitHub Actions workflow
  - Lint on PR
  - Test affected packages
  - Build verification
  - Security scanning
- [ ] Branch protection rules
- [ ] Required checks
- [ ] Auto-labeling

**Effort**: 2-3 days

### 4.2 Deployment Pipeline
**Tasks**:
- [ ] Coolify deployment automation
- [ ] Environment promotion (dev → staging → prod)
- [ ] Rollback procedures
- [ ] Database migration safety
- [ ] Health check verification

**Effort**: 1 week

### 4.3 Monitoring & Observability
**Tasks**:
- [ ] Centralized logging (all apps)
- [ ] Error tracking (Sentry)
- [ ] Performance monitoring
- [ ] Uptime monitoring
- [ ] Alerting rules

**Effort**: 1 week

---

## Implementation Priority

| Priority | Feature | Effort | Impact |
|----------|---------|--------|--------|
| 1 | @expertly/ui Enhancement | 2 weeks | High - All apps benefit |
| 2 | Turborepo Migration | 4 days | High - Dev velocity |
| 3 | Shared Configuration | 2 days | Medium - Consistency |
| 4 | Unified Authentication | 4 weeks | High - User experience |
| 5 | @expertly/api-client | 1 week | Medium - DRY |
| 6 | CI Pipeline | 3 days | Medium - Quality |
| 7 | Monitoring | 1 week | Medium - Reliability |
| 8 | Cross-App Notifications | 2 weeks | Low - Nice to have |
| 9 | Shared Analytics | 1 week | Low - Insights |

---

## Package Structure (Proposed)

```
packages/
├── ui/                    # React components
│   ├── src/
│   │   ├── components/
│   │   │   ├── Button/
│   │   │   ├── Input/
│   │   │   ├── Card/
│   │   │   ├── Modal/
│   │   │   ├── Table/
│   │   │   └── ...
│   │   ├── hooks/
│   │   └── index.ts
│   ├── package.json
│   └── tsconfig.json
│
├── api-client/            # HTTP client
│   ├── src/
│   │   ├── client.ts
│   │   ├── interceptors.ts
│   │   └── types.ts
│   └── package.json
│
├── auth/                  # Auth utilities
│   ├── src/
│   │   ├── context.tsx
│   │   ├── hooks.ts
│   │   └── utils.ts
│   └── package.json
│
├── hooks/                 # Shared hooks
│   ├── src/
│   │   ├── useDebounce.ts
│   │   ├── useLocalStorage.ts
│   │   └── ...
│   └── package.json
│
├── utils/                 # Utility functions
│   ├── src/
│   │   ├── date.ts
│   │   ├── string.ts
│   │   └── ...
│   └── package.json
│
├── eslint-config/         # Shared ESLint
│   ├── index.js
│   └── package.json
│
├── typescript-config/     # Shared tsconfig
│   ├── base.json
│   ├── react.json
│   ├── node.json
│   └── package.json
│
└── tailwind-config/       # Shared Tailwind
    ├── index.js
    └── package.json
```

---

## Workspace Configuration (Updated)

```json
{
  "name": "expertly",
  "private": true,
  "workspaces": [
    "apps/*",
    "apps/*/frontend",
    "apps/vibecode/packages/*",
    "packages/*"
  ],
  "scripts": {
    "build": "turbo run build",
    "test": "turbo run test",
    "lint": "turbo run lint",
    "dev": "turbo run dev --parallel",
    "dev:today": "turbo run dev --filter=today...",
    "dev:manage": "turbo run dev --filter=manage...",
    "dev:salon": "turbo run dev --filter=salon...",
    "dev:qa": "turbo run dev --filter=qa...",
    "dev:define": "turbo run dev --filter=define...",
    "dev:vibecode": "turbo run dev --filter=vibecode..."
  },
  "devDependencies": {
    "turbo": "^2.0.0"
  }
}
```

---

## Success Criteria

### Phase 1 Complete When:
- [ ] Turborepo runs all builds in parallel
- [ ] `npm test` runs tests across all packages
- [ ] Shared configs reduce duplication

### Phase 2 Complete When:
- [ ] @expertly/ui has 20+ documented components
- [ ] All apps use shared API client
- [ ] Auth utilities shared across apps

### Phase 3 Complete When:
- [ ] Single sign-on works between apps
- [ ] Admin portal manages users across apps
- [ ] Notifications send via central service

---

## Next Steps

1. **Immediate**: Audit @expertly/ui and identify extraction candidates
2. **This Week**: Set up Turborepo
3. **Next Sprint**: Extract 10 most common components to shared UI
4. **Backlog**: Identity service architecture

---

*End of Implementation Plan*
