# Expertly Develop - Implementation Plan

> **Version**: 1.0
> **Created**: 2026-01-26
> **Status**: Ready for Implementation

## Executive Summary

**Expertly Develop** is an automated visual walkthrough and end-to-end testing platform. It captures screenshots during user workflows, generates documentation artifacts, and enables persona-based testing. The core system is deployed. This plan outlines **AI-powered test generation, advanced browser automation, and collaboration features**.

## Current State

### Completed
- Project management with visibility levels (private/team/companywide)
- Encrypted site credentials storage
- Job queue with async processing (pending → running → completed/failed)
- Playwright browser automation for screenshot capture
- Artifact generation and storage
- Persona management for different browser profiles
- Preconfigured scenario templates
- Multi-tenant architecture with API key auth
- Deployed at https://develop.ai.devintensive.com/

### Tech Stack
- **Frontend**: React 19 + Vite + TypeScript + TailwindCSS + React Router v7
- **Backend**: FastAPI + MongoDB (Motor async) + Playwright
- **Database**: MongoDB with collections for tenants, users, projects, jobs, artifacts

### Current Features
- DSL-like scenario scripting ("Navigate to /...", "Capture 'label'", "Wait X seconds")
- Real-time job progress polling
- Multiple personas (different browser contexts)
- Screenshot gallery with metadata

---

## Phase 1: AI-Powered Test Generation

### 1.1 Intelligent Page Analysis
**Goal**: Auto-generate test scenarios from URLs

**Tasks**:
- [ ] Create page analyzer service
  - Load URL with Playwright
  - Extract DOM structure
  - Identify interactive elements (buttons, links, forms)
  - Detect navigation patterns
  - Map user flows
- [ ] AI scenario generation
  - Send page analysis to Claude
  - Generate comprehensive walkthrough scripts
  - Suggest edge cases and error paths
  - Create persona-appropriate variations
- [ ] "Quick Generate" feature
  - Input: URL only
  - Output: Complete walkthrough scenario
  - One-click execution

**API Endpoints**:
```
POST /api/v1/analyze
  Body: { url, credentials_id?, persona_id? }
  Response: { page_structure, interactive_elements, suggested_flows }

POST /api/v1/generate-scenario
  Body: { url, analysis?, focus_areas?, persona_id? }
  Response: { scenario_script, estimated_steps, confidence_score }
```

**Effort**: 2-3 weeks

### 1.2 Natural Language Scenarios
**Goal**: Write tests in plain English

**Tasks**:
- [ ] NLP scenario parser
  - "Log in as admin and navigate to settings"
  - "Fill out the contact form with test data"
  - "Verify the dashboard shows 3 charts"
- [ ] AI-powered script conversion
  - Natural language → DSL script
  - Handle ambiguity with clarifying questions
  - Learn from corrections
- [ ] Conversational test creation
  - Chat interface for building scenarios
  - Iterative refinement
  - Save as templates

**Effort**: 2 weeks

### 1.3 Visual Diff Detection
**Goal**: Detect visual regressions automatically

**Tasks**:
- [ ] Baseline screenshot management
  - Mark screenshots as baseline
  - Version baselines per environment
- [ ] Pixel-by-pixel comparison
  - Configurable threshold
  - Ignore dynamic regions (timestamps, ads)
  - Perceptual diff for anti-aliasing
- [ ] Visual regression reports
  - Highlight changed areas
  - Side-by-side comparison
  - Approve/reject changes
  - Auto-update baseline on approval

**Effort**: 2 weeks

---

## Phase 2: Advanced Browser Automation

### 2.1 Multi-Browser Support
**Goal**: Test across different browsers

**Tasks**:
- [ ] Add browser selection to jobs
  - Chromium (default)
  - Firefox
  - WebKit (Safari)
- [ ] Browser-specific artifacts
  - Tag screenshots by browser
  - Compare rendering differences
- [ ] Parallel execution
  - Run same scenario across all browsers
  - Aggregate results

**Effort**: 1 week

### 2.2 Mobile & Responsive Testing
**Goal**: Test different viewport sizes

**Tasks**:
- [ ] Device presets
  - iPhone (various models)
  - iPad
  - Android phones/tablets
  - Custom dimensions
- [ ] Responsive comparison
  - Same page at multiple breakpoints
  - Layout verification
  - Touch interaction simulation
- [ ] Device-specific personas
  - User agent strings
  - Touch capability
  - Screen density

**Effort**: 1 week

### 2.3 Video Recording
**Goal**: Record full walkthrough videos

**Tasks**:
- [ ] Enable Playwright video recording
  - Configure quality/framerate
  - Storage in GridFS
- [ ] Video artifacts
  - Downloadable MP4
  - Embedded player in UI
  - Timestamp markers for steps
- [ ] Failure videos
  - Auto-record on failure
  - Highlight failure point
  - Debugging assistance

**Effort**: 1 week

### 2.4 Network & API Monitoring
**Goal**: Capture API calls during walkthroughs

**Tasks**:
- [ ] Request interception
  - Log all network requests
  - Capture request/response bodies
  - Filter by domain/type
- [ ] API timeline
  - Waterfall chart
  - Timing analysis
  - Error detection
- [ ] Performance metrics
  - Load times
  - Resource sizes
  - Core Web Vitals capture

**Effort**: 2 weeks

---

## Phase 3: Collaboration & Workflow

### 3.1 Walkthrough Documentation Export
**Goal**: Generate shareable documentation

**Tasks**:
- [ ] PDF export
  - Professional layout
  - Screenshots with annotations
  - Step descriptions
  - Company branding
- [ ] Markdown export
  - GitHub/GitLab compatible
  - Embedded images
  - Copy to clipboard
- [ ] Confluence/Notion export
  - Direct publish integration
  - Template customization

**Effort**: 1-2 weeks

### 3.2 Team Collaboration
**Goal**: Share and collaborate on scenarios

**Tasks**:
- [ ] Scenario sharing
  - Share across team members
  - Visibility permissions
  - Fork scenarios
- [ ] Comments & annotations
  - Comment on artifacts
  - Flag issues
  - @mention teammates
- [ ] Review workflow
  - Request review
  - Approve/reject artifacts
  - Track revisions

**Effort**: 2 weeks

### 3.3 Scheduled Runs
**Goal**: Automated recurring execution

**Tasks**:
- [ ] Schedule configuration
  - Cron expression support
  - Daily/weekly/monthly presets
  - Timezone awareness
- [ ] Schedule management UI
  - Enable/disable schedules
  - View run history
  - Failure notifications
- [ ] Environment targeting
  - Staging vs production URLs
  - Environment-specific credentials

**Effort**: 1 week

### 3.4 Notifications & Alerts
**Goal**: Stay informed of job results

**Tasks**:
- [ ] Job completion notifications
  - Email summary
  - Slack webhook
  - In-app notifications
- [ ] Failure alerts
  - Immediate notification on failure
  - Error context included
  - One-click retry
- [ ] Visual regression alerts
  - Alert when baseline changes detected
  - Approval request notifications

**Effort**: 1 week

---

## Phase 4: Integration & API

### 4.1 CI/CD Integration
**Goal**: Run walkthroughs in pipelines

**Tasks**:
- [ ] API for automation
  - `POST /api/v1/walkthroughs/trigger` - Start job programmatically
  - `GET /api/v1/jobs/{id}/wait` - Long-poll until completion
  - `GET /api/v1/jobs/{id}/artifacts` - Download artifacts
- [ ] GitHub Action
  - Official action for GitHub workflows
  - PR comment with screenshots
  - Status check integration
- [ ] CLI tool
  - `expertly-develop run --project=X --scenario=Y`
  - Exit codes for CI
  - JSON output for parsing

**Effort**: 2 weeks

### 4.2 Define Integration
**Goal**: Link walkthroughs to requirements

**Tasks**:
- [ ] Cross-reference requirements
  - Tag artifacts with requirement IDs
  - Link from Define to walkthrough
  - Verification evidence
- [ ] Requirement-driven testing
  - Generate walkthrough from requirement acceptance criteria
  - Track coverage

**Effort**: 1 week

### 4.3 Webhook System
**Goal**: Integrate with external systems

**Tasks**:
- [ ] Outbound webhooks
  - Job status changes
  - Configurable per project
  - Retry with backoff
- [ ] Inbound triggers
  - Trigger jobs via webhook
  - GitHub/GitLab integration
  - Deployment hooks

**Effort**: 1 week

---

## Implementation Priority

| Priority | Feature | Effort | Impact |
|----------|---------|--------|--------|
| 1 | AI Page Analysis | 2 weeks | High - Core differentiator |
| 2 | Natural Language Scenarios | 2 weeks | High - UX improvement |
| 3 | Visual Diff Detection | 2 weeks | High - Regression testing |
| 4 | Video Recording | 1 week | Medium - Debugging |
| 5 | CI/CD Integration | 2 weeks | Medium - Automation |
| 6 | PDF Export | 1 week | Medium - Documentation |
| 7 | Multi-Browser | 1 week | Medium - Coverage |
| 8 | Scheduled Runs | 1 week | Medium - Automation |
| 9 | Mobile Testing | 1 week | Low - Expansion |
| 10 | Define Integration | 1 week | Low - Cross-product |

---

## Database Schema Additions

```javascript
// Visual baselines collection
{
  _id: ObjectId,
  tenant_id: ObjectId,
  project_id: ObjectId,
  name: String,
  url: String,
  viewport: { width: Number, height: Number },
  browser: String,
  screenshot_key: String,  // GridFS key
  approved_at: Date,
  approved_by: ObjectId,
  created_at: Date
}

// Visual diffs collection
{
  _id: ObjectId,
  job_id: ObjectId,
  baseline_id: ObjectId,
  diff_percentage: Number,
  diff_image_key: String,
  status: String,  // passed, failed, pending_review
  reviewed_at: Date,
  reviewed_by: ObjectId
}

// Schedules collection
{
  _id: ObjectId,
  tenant_id: ObjectId,
  project_id: ObjectId,
  scenario_id: ObjectId,
  name: String,
  cron_expression: String,
  timezone: String,
  enabled: Boolean,
  last_run_at: Date,
  next_run_at: Date,
  notification_config: {
    email: [String],
    slack_webhook: String,
    on_failure_only: Boolean
  }
}

// Webhooks collection
{
  _id: ObjectId,
  tenant_id: ObjectId,
  project_id: ObjectId,
  url: String,
  events: [String],  // job.started, job.completed, job.failed
  secret: String,
  enabled: Boolean,
  failure_count: Number,
  last_triggered_at: Date
}
```

---

## API Additions

```
# AI Generation
POST /api/v1/analyze                    # Analyze page structure
POST /api/v1/generate-scenario          # AI-generate scenario

# Visual Regression
GET  /api/v1/baselines                  # List baselines
POST /api/v1/baselines                  # Create baseline
PUT  /api/v1/baselines/{id}/approve     # Approve new baseline
GET  /api/v1/diffs                      # List visual diffs
PUT  /api/v1/diffs/{id}/approve         # Approve diff

# Schedules
GET  /api/v1/schedules                  # List schedules
POST /api/v1/schedules                  # Create schedule
PUT  /api/v1/schedules/{id}             # Update schedule
DELETE /api/v1/schedules/{id}           # Delete schedule

# Export
GET  /api/v1/jobs/{id}/export/pdf       # Export as PDF
GET  /api/v1/jobs/{id}/export/markdown  # Export as Markdown

# CI/CD
POST /api/v1/walkthroughs/trigger       # Trigger job (CI-friendly)
GET  /api/v1/jobs/{id}/wait             # Long-poll for completion

# Webhooks
GET  /api/v1/webhooks                   # List webhooks
POST /api/v1/webhooks                   # Create webhook
POST /api/v1/webhooks/{id}/test         # Send test event
```

---

## AI Integration Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                   AI-POWERED GENERATION                      │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│   ┌─────────────┐    ┌─────────────┐    ┌─────────────┐   │
│   │  Page Load  │───>│  Analyzer   │───>│  Claude AI  │   │
│   │ (Playwright)│    │  Service    │    │  (Anthropic)│   │
│   └─────────────┘    └─────────────┘    └─────────────┘   │
│         │                  │                   │           │
│         │                  │                   │           │
│         v                  v                   v           │
│   ┌─────────────────────────────────────────────────────┐ │
│   │              PAGE ANALYSIS OUTPUT                    │ │
│   │                                                      │ │
│   │  {                                                   │ │
│   │    "url": "https://example.com/login",              │ │
│   │    "title": "Login Page",                           │ │
│   │    "forms": [{                                      │ │
│   │      "id": "login-form",                            │ │
│   │      "fields": ["email", "password"],               │ │
│   │      "submit_button": "#login-btn"                  │ │
│   │    }],                                              │ │
│   │    "navigation": ["Home", "Products", "Contact"],   │ │
│   │    "ctas": ["Sign Up", "Learn More"]               │ │
│   │  }                                                   │ │
│   └─────────────────────────────────────────────────────┘ │
│                           │                               │
│                           v                               │
│   ┌─────────────────────────────────────────────────────┐ │
│   │              GENERATED SCENARIO                      │ │
│   │                                                      │ │
│   │  Navigate to /login                                  │ │
│   │  Capture "Login Page Initial State"                  │ │
│   │  Fill "email" with "test@example.com"               │ │
│   │  Fill "password" with "password123"                 │ │
│   │  Click "#login-btn"                                 │ │
│   │  Wait 2 seconds                                      │ │
│   │  Capture "After Login"                              │ │
│   │  Verify URL contains "/dashboard"                    │ │
│   └─────────────────────────────────────────────────────┘ │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## Success Criteria

### Phase 1 Complete When:
- [ ] AI generates meaningful scenarios from URLs
- [ ] Natural language inputs produce working scripts
- [ ] Visual diffs detect CSS changes

### Phase 2 Complete When:
- [ ] Jobs run across Chromium, Firefox, WebKit
- [ ] Mobile viewports capture correctly
- [ ] Video recordings are viewable in UI

### Phase 3 Complete When:
- [ ] PDF exports look professional
- [ ] Scheduled jobs run on time
- [ ] Notifications arrive on job completion

---

## Next Steps

1. **Immediate**: Build page analyzer service
2. **This Week**: Integrate Claude for scenario generation
3. **Next Sprint**: Visual diff detection
4. **Backlog**: CI/CD integration

---

*End of Implementation Plan*
