# Expertly Admin - Implementation Plan

> **Version**: 1.0
> **Created**: 2026-01-26
> **Status**: Ready for Implementation

## Executive Summary

**Expertly Admin** is the centralized admin panel for managing themes and system-wide configuration across all Expertly applications. The core theme management with versioning is deployed. This plan outlines **advanced theming, system configuration, cross-app management, and operational tools**.

## Current State

### Completed
- Theme CRUD with unique slugs
- Theme versioning (every edit creates new version)
- Full snapshot of color palette per version
- Audit trail (who changed what when)
- Version restore capability
- Public API for other apps to consume themes
- System monitoring (CPU, memory, disk, network)
- Database migrations with Alembic
- Theme seeding script
- Deployed at https://admin.ai.devintensive.com/

### Tech Stack
- **Frontend**: React 19 + Vite + TypeScript + TailwindCSS
- **Backend**: FastAPI + PostgreSQL + SQLAlchemy (async)
- **Database**: PostgreSQL with themes, theme_versions tables
- **Monitoring**: psutil for system metrics

### Current Features
- Theme management with full versioning
- Public API endpoint `/api/public/themes`
- Real-time system monitoring dashboard
- Version history and restore

---

## Phase 1: Advanced Theming

### 1.1 Complete Design Token System
**Goal**: Comprehensive design system variables

**Tasks**:
- [ ] Extended color palette
  - Primary, secondary, accent colors
  - Semantic colors (success, warning, error, info)
  - Surface colors (background, card, modal)
  - Text colors (primary, secondary, muted)
  - Border colors
- [ ] Typography tokens
  - Font families (heading, body, mono)
  - Font sizes (xs through 5xl)
  - Font weights
  - Line heights
  - Letter spacing
- [ ] Spacing tokens
  - Spacing scale (1-12)
  - Component-specific spacing
- [ ] Border & shadow tokens
  - Border radii
  - Shadow definitions
  - Border widths

**Schema Update**:
```json
{
  "colors": {
    "primary": { "50": "#...", "100": "#...", ..., "900": "#..." },
    "secondary": { ... },
    "success": { ... },
    "warning": { ... },
    "error": { ... },
    "gray": { ... }
  },
  "typography": {
    "fontFamily": {
      "heading": "Inter",
      "body": "Inter",
      "mono": "JetBrains Mono"
    },
    "fontSize": {
      "xs": "0.75rem",
      "sm": "0.875rem",
      ...
    }
  },
  "spacing": { "1": "0.25rem", "2": "0.5rem", ... },
  "borderRadius": { "sm": "0.125rem", "md": "0.375rem", ... },
  "shadows": { "sm": "...", "md": "...", "lg": "..." }
}
```

**Effort**: 2 weeks

### 1.2 Theme Preview & Editor
**Goal**: Visual theme editing experience

**Tasks**:
- [ ] Live preview panel
  - Sample UI components
  - Real-time color updates
  - Typography preview
  - Component showcase
- [ ] Visual color picker
  - Color wheel/spectrum
  - Hex/RGB/HSL input
  - Contrast checker (WCAG)
  - Color harmony suggestions
- [ ] Theme export
  - CSS variables
  - Tailwind config
  - JSON format
  - SCSS variables

**Effort**: 2 weeks

### 1.3 Theme Inheritance
**Goal**: Create theme variants efficiently

**Tasks**:
- [ ] Base themes
  - System light/dark themes
  - Customizable base
- [ ] Theme inheritance
  - Extend from parent theme
  - Override specific tokens
  - Track inheritance chain
- [ ] Auto dark mode
  - Generate dark variant
  - Invert appropriate colors
  - Preserve semantic meaning

**Effort**: 1-2 weeks

### 1.4 Theme Assignment
**Goal**: Assign themes to apps/orgs

**Tasks**:
- [ ] Theme-app mapping
  - Default theme per app
  - Override per organization
  - Override per user (preference)
- [ ] Theme scheduling
  - Time-based themes
  - Holiday themes
  - Automatic switching
- [ ] A/B theme testing
  - Percentage rollout
  - User segment targeting
  - Metrics collection

**Effort**: 2 weeks

---

## Phase 2: System Configuration

### 2.1 Feature Flags
**Goal**: Control feature rollout across apps

**Tasks**:
- [ ] Feature flag model
  - Flag name and description
  - State (enabled/disabled/percentage)
  - Target apps
  - Target organizations
  - Target users
- [ ] Flag evaluation API
  - Fast lookup
  - Caching strategy
  - SDK for apps
- [ ] Flag management UI
  - Create/edit flags
  - Targeting rules
  - Audit log
  - Kill switch

**API Endpoints**:
```
GET  /api/flags                    # List all flags
POST /api/flags                    # Create flag
PUT  /api/flags/{id}               # Update flag
DELETE /api/flags/{id}             # Delete flag
GET  /api/public/flags?app=today   # Evaluate flags for app
POST /api/public/flags/evaluate    # Bulk evaluate with context
```

**Effort**: 2-3 weeks

### 2.2 Global Settings
**Goal**: Centralized configuration

**Tasks**:
- [ ] Settings categories
  - Email (SMTP settings)
  - Notifications (channels, defaults)
  - Security (password policies)
  - Integrations (API keys)
- [ ] Settings API
  - Get settings by category
  - Update settings
  - Reset to defaults
- [ ] Settings UI
  - Organized by category
  - Validation feedback
  - Change confirmation

**Effort**: 1-2 weeks

### 2.3 Maintenance Mode
**Goal**: Graceful system maintenance

**Tasks**:
- [ ] Maintenance mode toggle
  - Enable/disable per app
  - Custom message
  - Expected duration
  - Bypass for admins
- [ ] Scheduled maintenance
  - Schedule future maintenance
  - Automatic enable/disable
  - User notifications
- [ ] Maintenance page
  - Branded maintenance page
  - Status updates
  - ETA display

**Effort**: 1 week

---

## Phase 3: Cross-App Management

### 3.1 App Registry
**Goal**: Central registry of all Expertly apps

**Tasks**:
- [ ] App registration
  - App name, slug, URL
  - Health check endpoint
  - Version info
  - Environment (prod/staging/dev)
- [ ] App status dashboard
  - Health status per app
  - Last deployment time
  - Error rate indicators
  - Quick links
- [ ] App configuration
  - Environment variables (encrypted)
  - Secrets management
  - Config distribution

**Effort**: 2 weeks

### 3.2 Unified User Management
**Goal**: Manage users across all apps

**Tasks**:
- [ ] User directory view
  - List all users from Identity
  - Filter by organization/app
  - Role across apps
- [ ] User actions
  - Disable user globally
  - Reset password
  - Revoke all sessions
  - View activity
- [ ] Organization management
  - List organizations
  - Usage statistics
  - Subscription status

**Effort**: 2 weeks

### 3.3 Cross-App Analytics
**Goal**: Aggregated metrics across platform

**Tasks**:
- [ ] Platform dashboard
  - Total users
  - Active users (DAU/MAU)
  - App usage breakdown
  - Error rates
- [ ] Usage trends
  - Growth charts
  - App comparison
  - Feature adoption
- [ ] Custom reports
  - Date range selection
  - Export capability
  - Scheduled delivery

**Effort**: 2 weeks

---

## Phase 4: Operational Tools

### 4.1 Enhanced Monitoring
**Goal**: Comprehensive system health

**Tasks**:
- [ ] Service health checks
  - Check each app health endpoint
  - Database connectivity
  - External service status
  - Response time tracking
- [ ] Alerting
  - Threshold-based alerts
  - Email/Slack notifications
  - Escalation rules
  - Alert history
- [ ] Metrics visualization
  - Time-series charts
  - Custom dashboards
  - Anomaly detection

**Effort**: 2 weeks

### 4.2 Log Aggregation
**Goal**: Centralized log viewing

**Tasks**:
- [ ] Log collection
  - Ingest logs from apps
  - Structured log format
  - Retention policies
- [ ] Log viewer
  - Search and filter
  - Time range selection
  - Log levels
  - Export capability
- [ ] Log correlation
  - Trace IDs across apps
  - Request flow visualization

**Effort**: 2-3 weeks

### 4.3 Deployment Management
**Goal**: Coordinate deployments

**Tasks**:
- [ ] Deployment status
  - Current version per app
  - Deployment history
  - Rollback capability
- [ ] Deployment triggers
  - Manual deploy button
  - API trigger for CI/CD
  - Approval workflow
- [ ] Deployment coordination
  - Dependency order
  - Blue-green status
  - Health verification

**Effort**: 2 weeks

### 4.4 Database Tools
**Goal**: Safe database operations

**Tasks**:
- [ ] Migration status
  - View pending migrations
  - Migration history
  - Rollback tracking
- [ ] Backup status
  - Last backup time
  - Backup size
  - Restore instructions
- [ ] Query console (read-only)
  - Execute read queries
  - Result export
  - Audit logging

**Effort**: 1-2 weeks

---

## Phase 5: Developer Experience

### 5.1 Theme SDK
**Goal**: Easy theme integration for apps

**Tasks**:
- [ ] React SDK
  - ThemeProvider component
  - useTheme hook
  - Theme switcher component
  - TypeScript definitions
- [ ] CSS-in-JS support
  - Styled-components integration
  - Emotion support
  - CSS variable injection
- [ ] Documentation
  - Integration guide
  - API reference
  - Example implementations

**Effort**: 2 weeks

### 5.2 Feature Flag SDK
**Goal**: Easy flag integration

**Tasks**:
- [ ] Client SDKs
  - React SDK (hooks)
  - Python SDK
  - Node.js SDK
- [ ] Evaluation caching
  - Client-side caching
  - Cache invalidation
  - Offline fallbacks
- [ ] Developer tools
  - Flag override for testing
  - Debug mode
  - Logging integration

**Effort**: 2 weeks

### 5.3 Admin API
**Goal**: Programmatic admin access

**Tasks**:
- [ ] Full REST API
  - All features accessible
  - Authentication (API keys)
  - Rate limiting
- [ ] API documentation
  - OpenAPI spec
  - Interactive docs
  - Code examples
- [ ] Webhooks
  - Config change events
  - Theme update events
  - Maintenance events

**Effort**: 1-2 weeks

---

## Implementation Priority

| Priority | Feature | Effort | Impact |
|----------|---------|--------|--------|
| 1 | Complete Design Tokens | 2 weeks | High - Foundation |
| 2 | Theme Preview/Editor | 2 weeks | High - UX |
| 3 | Feature Flags | 3 weeks | High - Control |
| 4 | App Registry | 2 weeks | Medium - Visibility |
| 5 | Enhanced Monitoring | 2 weeks | Medium - Operations |
| 6 | Theme SDK (React) | 2 weeks | Medium - Adoption |
| 7 | Global Settings | 2 weeks | Medium - Config |
| 8 | Cross-App Analytics | 2 weeks | Medium - Insights |
| 9 | Log Aggregation | 3 weeks | Low - Debugging |
| 10 | Deployment Management | 2 weeks | Low - DevOps |

---

## Database Schema Additions

```sql
-- Extended theme tokens
ALTER TABLE theme_versions
    ADD COLUMN tokens JSONB;  -- Full design token system

-- Feature flags
CREATE TABLE feature_flags (
    id UUID PRIMARY KEY,
    name VARCHAR(100) UNIQUE,
    description TEXT,
    flag_type VARCHAR(50) DEFAULT 'boolean',  -- boolean, percentage, json
    default_value JSONB,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ
);

CREATE TABLE feature_flag_rules (
    id UUID PRIMARY KEY,
    flag_id UUID REFERENCES feature_flags(id),
    priority INTEGER,
    conditions JSONB,  -- {"app": "today", "org_id": "...", "percentage": 50}
    value JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE feature_flag_overrides (
    id UUID PRIMARY KEY,
    flag_id UUID REFERENCES feature_flags(id),
    entity_type VARCHAR(50),  -- user, organization, app
    entity_id VARCHAR(255),
    value JSONB,
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- App registry
CREATE TABLE apps (
    id UUID PRIMARY KEY,
    name VARCHAR(100),
    slug VARCHAR(50) UNIQUE,
    url VARCHAR(500),
    health_endpoint VARCHAR(500),
    environment VARCHAR(50),
    version VARCHAR(50),
    config JSONB,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ
);

CREATE TABLE app_health_checks (
    id UUID PRIMARY KEY,
    app_id UUID REFERENCES apps(id),
    status VARCHAR(50),  -- healthy, unhealthy, degraded
    response_time_ms INTEGER,
    details JSONB,
    checked_at TIMESTAMPTZ DEFAULT NOW()
);

-- Theme assignments
CREATE TABLE theme_assignments (
    id UUID PRIMARY KEY,
    theme_id UUID REFERENCES themes(id),
    entity_type VARCHAR(50),  -- app, organization, user
    entity_id VARCHAR(255),
    priority INTEGER DEFAULT 0,
    start_at TIMESTAMPTZ,
    end_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Global settings
CREATE TABLE settings (
    id UUID PRIMARY KEY,
    category VARCHAR(100),
    key VARCHAR(100),
    value JSONB,
    is_sensitive BOOLEAN DEFAULT FALSE,
    updated_at TIMESTAMPTZ,
    updated_by UUID,
    UNIQUE(category, key)
);

-- Maintenance windows
CREATE TABLE maintenance_windows (
    id UUID PRIMARY KEY,
    app_id UUID REFERENCES apps(id),  -- NULL for all apps
    title VARCHAR(255),
    message TEXT,
    start_at TIMESTAMPTZ,
    end_at TIMESTAMPTZ,
    is_active BOOLEAN DEFAULT FALSE,
    created_by UUID,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## API Additions

```
# Themes (enhanced)
GET  /api/themes                        # List themes
POST /api/themes                        # Create theme
GET  /api/themes/{id}                   # Get theme with tokens
PUT  /api/themes/{id}                   # Update theme
GET  /api/themes/{id}/versions          # Version history
POST /api/themes/{id}/restore/{vid}     # Restore version
GET  /api/themes/{id}/export/{format}   # Export (css/tailwind/json)

# Public theme API
GET  /api/public/themes                 # All active themes
GET  /api/public/themes/{slug}          # Specific theme by slug
GET  /api/public/themes/resolve         # Resolve theme for context

# Feature Flags
GET  /api/flags                         # List flags
POST /api/flags                         # Create flag
PUT  /api/flags/{id}                    # Update flag
DELETE /api/flags/{id}                  # Delete flag
POST /api/flags/{id}/rules              # Add targeting rule
GET  /api/public/flags/evaluate         # Evaluate flags

# Apps
GET  /api/apps                          # List registered apps
POST /api/apps                          # Register app
PUT  /api/apps/{id}                     # Update app
GET  /api/apps/{id}/health              # Get health status
POST /api/apps/{id}/health/check        # Trigger health check

# Settings
GET  /api/settings                      # List all settings
GET  /api/settings/{category}           # Get category settings
PUT  /api/settings/{category}/{key}     # Update setting

# Maintenance
GET  /api/maintenance                   # List maintenance windows
POST /api/maintenance                   # Create maintenance
PUT  /api/maintenance/{id}              # Update maintenance
POST /api/maintenance/{id}/activate     # Activate immediately
POST /api/maintenance/{id}/deactivate   # Deactivate

# Monitoring
GET  /api/monitoring/overview           # System overview
GET  /api/monitoring/apps               # App health matrix
GET  /api/monitoring/metrics            # Detailed metrics
```

---

## Theme Integration Pattern

```typescript
// apps/today/src/providers/ThemeProvider.tsx

import { createContext, useContext, useEffect, useState } from 'react';

interface Theme {
  slug: string;
  name: string;
  tokens: {
    colors: Record<string, Record<string, string>>;
    typography: Record<string, any>;
    spacing: Record<string, string>;
    borderRadius: Record<string, string>;
    shadows: Record<string, string>;
  };
}

const ThemeContext = createContext<Theme | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme | null>(null);

  useEffect(() => {
    // Fetch theme from Admin service
    fetch('https://admin.ai.devintensive.com/api/public/themes/resolve', {
      headers: {
        'X-App': 'today',
        'X-Org-Id': orgId,  // if applicable
      }
    })
      .then(res => res.json())
      .then(setTheme);
  }, []);

  useEffect(() => {
    if (theme) {
      // Apply CSS variables
      const root = document.documentElement;
      Object.entries(theme.tokens.colors).forEach(([name, shades]) => {
        Object.entries(shades).forEach(([shade, value]) => {
          root.style.setProperty(`--color-${name}-${shade}`, value);
        });
      });
      // ... apply other tokens
    }
  }, [theme]);

  return (
    <ThemeContext.Provider value={theme}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);
```

---

## Success Criteria

### Phase 1 Complete When:
- [ ] Full design token system in themes
- [ ] Visual editor with live preview
- [ ] Theme inheritance works correctly

### Phase 2 Complete When:
- [ ] Feature flags control features across apps
- [ ] Global settings configure system behavior
- [ ] Maintenance mode gracefully handles downtime

### Phase 3 Complete When:
- [ ] App registry shows health of all apps
- [ ] Cross-app analytics provides insights
- [ ] User management works from admin panel

---

## Next Steps

1. **Immediate**: Extend theme schema with full design tokens
2. **This Week**: Build visual theme editor with preview
3. **Next Sprint**: Feature flag system
4. **Backlog**: App registry and monitoring

---

*End of Implementation Plan*
