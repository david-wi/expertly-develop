# Expertly Identity - Implementation Plan

> **Version**: 1.0
> **Created**: 2026-01-26
> **Status**: Ready for Implementation

## Executive Summary

**Expertly Identity** is the centralized identity and access management service for the Expertly product suite. It manages organizations, users, teams, and permissions across all applications. The basic structure is deployed. This plan outlines **complete authentication system, SSO, RBAC, and cross-app integration**.

## Current State

### Completed
- Organization CRUD (create, list, update, soft delete)
- User management (human and bot users)
- User roles (owner, admin, member)
- Team management with membership
- Avatar/image upload via GridFS-like storage
- API key hashing for bot authentication
- Async PostgreSQL access
- Basic frontend pages
- Deployed at https://identity.ai.devintensive.com/

### Tech Stack
- **Frontend**: React 19 + Vite + TypeScript + TailwindCSS + React Router v7
- **Backend**: FastAPI + PostgreSQL + SQLAlchemy (async)
- **Database**: PostgreSQL with 5 tables (organizations, users, teams, team_members, images)

### Current Features
- Multi-tenant organization structure
- Human users with profiles (title, responsibilities)
- Bot users with JSON config and API keys
- Team creation and membership management

---

## Phase 1: Complete Authentication System

### 1.1 User Registration & Login
**Goal**: Full authentication flow

**Tasks**:
- [ ] Registration endpoint
  - Email + password registration
  - Email verification flow
  - Password strength validation
  - Rate limiting
- [ ] Login endpoint
  - Email + password authentication
  - Return JWT access token
  - Refresh token mechanism
  - Session management
- [ ] Password management
  - Forgot password flow
  - Email reset link
  - Password change (authenticated)
  - Password history (no reuse)
- [ ] Account management
  - Email change with verification
  - Account deactivation
  - Account deletion request

**API Endpoints**:
```
POST /api/v1/auth/register
POST /api/v1/auth/login
POST /api/v1/auth/logout
POST /api/v1/auth/refresh
POST /api/v1/auth/forgot-password
POST /api/v1/auth/reset-password
POST /api/v1/auth/change-password
POST /api/v1/auth/verify-email
GET  /api/v1/auth/me
```

**Effort**: 2-3 weeks

### 1.2 JWT Token System
**Goal**: Secure token-based authentication

**Tasks**:
- [ ] Access tokens
  - Short-lived (15 minutes)
  - Contains user_id, org_id, roles
  - Signed with RS256
- [ ] Refresh tokens
  - Long-lived (7 days)
  - Stored in database
  - Rotation on use
  - Revocation support
- [ ] Token validation
  - Middleware for all protected routes
  - Automatic refresh handling
  - Cross-app token validation

**Effort**: 1 week

### 1.3 API Key Authentication
**Goal**: Secure bot and API access

**Tasks**:
- [ ] API key generation
  - Generate secure keys
  - Scoped to organization
  - Optional expiration
  - Usage tracking
- [ ] API key management
  - List active keys
  - Revoke keys
  - Rotate keys
  - Last used tracking
- [ ] API key authentication
  - Header-based auth (X-API-Key)
  - Rate limiting per key
  - Scope validation

**Effort**: 1 week

### 1.4 Session Management
**Goal**: Track and control user sessions

**Tasks**:
- [ ] Session tracking
  - Device/browser info
  - IP address
  - Location (GeoIP)
  - Last active
- [ ] Session controls
  - View active sessions
  - Revoke specific sessions
  - Revoke all sessions
  - Force re-login
- [ ] Security features
  - Concurrent session limits
  - Suspicious activity detection
  - Session timeout configuration

**Effort**: 1 week

---

## Phase 2: Role-Based Access Control (RBAC)

### 2.1 Permission System
**Goal**: Fine-grained access control

**Tasks**:
- [ ] Permission model
  - Define permissions (e.g., users:read, users:write)
  - Group into permission sets
  - Resource-level permissions
- [ ] Role definitions
  - System roles (super_admin, org_owner, admin, member)
  - Custom roles per organization
  - Role inheritance
- [ ] Permission checking
  - Middleware for permission validation
  - Decorator-based protection
  - Audit logging of access

**Database Schema**:
```sql
CREATE TABLE permissions (
    id UUID PRIMARY KEY,
    name VARCHAR(100) UNIQUE,  -- e.g., "users:read"
    description TEXT,
    resource VARCHAR(50),      -- e.g., "users"
    action VARCHAR(50)         -- e.g., "read"
);

CREATE TABLE roles (
    id UUID PRIMARY KEY,
    organization_id UUID REFERENCES organizations(id),
    name VARCHAR(100),
    description TEXT,
    is_system_role BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ
);

CREATE TABLE role_permissions (
    role_id UUID REFERENCES roles(id),
    permission_id UUID REFERENCES permissions(id),
    PRIMARY KEY (role_id, permission_id)
);

CREATE TABLE user_roles (
    user_id UUID REFERENCES users(id),
    role_id UUID REFERENCES roles(id),
    resource_type VARCHAR(50),  -- optional: scope to resource
    resource_id UUID,           -- optional: specific resource
    granted_at TIMESTAMPTZ,
    granted_by UUID REFERENCES users(id),
    PRIMARY KEY (user_id, role_id, resource_type, resource_id)
);
```

**Effort**: 2-3 weeks

### 2.2 Organization Policies
**Goal**: Organization-level security settings

**Tasks**:
- [ ] Password policy
  - Minimum length
  - Complexity requirements
  - Expiration period
  - History depth
- [ ] Session policy
  - Max session duration
  - Concurrent sessions
  - Idle timeout
- [ ] Access policy
  - IP allowlist
  - Time-based access
  - Geographic restrictions

**Effort**: 1 week

### 2.3 Admin Console
**Goal**: UI for managing RBAC

**Tasks**:
- [ ] Roles management page
  - View all roles
  - Create/edit custom roles
  - Assign permissions to roles
- [ ] User permissions page
  - View user's effective permissions
  - Assign roles to users
  - Override permissions
- [ ] Audit log viewer
  - Permission changes
  - Access attempts
  - Admin actions

**Effort**: 2 weeks

---

## Phase 3: Single Sign-On (SSO)

### 3.1 OAuth2 / OIDC Provider
**Goal**: Identity as OAuth provider for Expertly apps

**Tasks**:
- [ ] OAuth2 authorization server
  - Authorization code flow
  - PKCE support
  - Client registration
  - Scope management
- [ ] OIDC implementation
  - ID tokens with claims
  - UserInfo endpoint
  - Discovery endpoint (.well-known)
- [ ] Client management
  - Register Expertly apps as clients
  - Client credentials
  - Redirect URI validation

**Flow**:
```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│ Expertly    │    │  Identity   │    │   User      │
│ Today/Salon │    │   Service   │    │  Browser    │
└──────┬──────┘    └──────┬──────┘    └──────┬──────┘
       │                  │                   │
       │ 1. Redirect to   │                   │
       │    /authorize    │                   │
       │─────────────────>│                   │
       │                  │ 2. Show login     │
       │                  │─────────────────>│
       │                  │                   │
       │                  │ 3. User logs in   │
       │                  │<─────────────────│
       │                  │                   │
       │ 4. Redirect with │                   │
       │    auth code     │                   │
       │<─────────────────│                   │
       │                  │                   │
       │ 5. Exchange code │                   │
       │    for tokens    │                   │
       │─────────────────>│                   │
       │                  │                   │
       │ 6. Access token  │                   │
       │    + ID token    │                   │
       │<─────────────────│                   │
```

**Effort**: 3-4 weeks

### 3.2 External Identity Providers
**Goal**: Login with Google, Microsoft, etc.

**Tasks**:
- [ ] Google OAuth integration
  - Client setup
  - Scope configuration
  - User provisioning
- [ ] Microsoft Entra ID
  - Enterprise SSO
  - Group sync
  - Conditional access
- [ ] Generic SAML support
  - SAML SP implementation
  - Metadata configuration
  - Attribute mapping
- [ ] Social login (optional)
  - GitHub
  - LinkedIn

**Effort**: 2-3 weeks

### 3.3 Cross-App Session
**Goal**: Seamless experience across Expertly apps

**Tasks**:
- [ ] Shared session detection
  - Check if already logged in
  - Silent token refresh
  - Consistent user context
- [ ] App switching
  - Maintain session across apps
  - Context preservation
  - Logout from all apps
- [ ] Session synchronization
  - Real-time session status
  - Cross-app token invalidation

**Effort**: 1-2 weeks

---

## Phase 4: User & Organization Management

### 4.1 Organization Lifecycle
**Goal**: Complete org management

**Tasks**:
- [ ] Organization creation
  - Wizard flow
  - Initial admin setup
  - Default settings
- [ ] Organization settings
  - Branding (logo, colors)
  - Custom domain (future)
  - Feature flags
- [ ] Billing integration (future)
  - Subscription plans
  - Usage tracking
  - Invoice management

**Effort**: 2 weeks

### 4.2 User Provisioning
**Goal**: Scalable user management

**Tasks**:
- [ ] Invitation system
  - Email invitations
  - Invitation links
  - Expiration handling
  - Role pre-assignment
- [ ] Bulk operations
  - CSV import
  - Bulk role assignment
  - Bulk deactivation
- [ ] SCIM provisioning
  - SCIM 2.0 endpoints
  - User sync from IdP
  - Group sync

**Effort**: 2-3 weeks

### 4.3 Directory Sync
**Goal**: Sync with external directories

**Tasks**:
- [ ] Azure AD sync
  - User provisioning
  - Group sync
  - Attribute mapping
- [ ] Okta integration
  - SCIM connector
  - Real-time sync
- [ ] Google Workspace
  - User directory
  - Group membership

**Effort**: 2-3 weeks

---

## Phase 5: Security & Compliance

### 5.1 Multi-Factor Authentication (MFA)
**Goal**: Enhanced security

**Tasks**:
- [ ] TOTP support
  - Authenticator app setup
  - QR code enrollment
  - Recovery codes
- [ ] SMS OTP (optional)
  - Phone verification
  - Twilio integration
- [ ] WebAuthn/Passkeys
  - FIDO2 support
  - Passwordless option
- [ ] MFA policies
  - Required for org
  - Required for admins only
  - Remember device option

**Effort**: 2-3 weeks

### 5.2 Audit Logging
**Goal**: Complete audit trail

**Tasks**:
- [ ] Event logging
  - Authentication events
  - Permission changes
  - Admin actions
  - API access
- [ ] Log retention
  - Configurable retention
  - Export capability
  - Compliance features
- [ ] Alerting
  - Suspicious activity
  - Failed login attempts
  - Privilege escalation

**Effort**: 2 weeks

### 5.3 Compliance Features
**Goal**: Enterprise compliance

**Tasks**:
- [ ] Data residency
  - Region selection
  - Data isolation
- [ ] Export & deletion
  - GDPR data export
  - Right to deletion
  - Audit of deletions
- [ ] Compliance reports
  - SOC 2 evidence
  - Access reviews
  - Permission reports

**Effort**: 2-3 weeks

---

## Implementation Priority

| Priority | Feature | Effort | Impact |
|----------|---------|--------|--------|
| 1 | User Registration & Login | 3 weeks | Critical - Core functionality |
| 2 | JWT Token System | 1 week | Critical - Auth foundation |
| 3 | Basic RBAC | 3 weeks | High - Access control |
| 4 | OAuth2 Provider | 4 weeks | High - Cross-app SSO |
| 5 | API Key Management | 1 week | Medium - Bot access |
| 6 | Invitation System | 1 week | Medium - User growth |
| 7 | MFA (TOTP) | 2 weeks | Medium - Security |
| 8 | External IdPs | 3 weeks | Medium - Enterprise |
| 9 | Audit Logging | 2 weeks | Medium - Compliance |
| 10 | SCIM Provisioning | 3 weeks | Low - Enterprise |

---

## Database Schema Additions

```sql
-- Refresh tokens
CREATE TABLE refresh_tokens (
    id UUID PRIMARY KEY,
    user_id UUID REFERENCES users(id),
    token_hash VARCHAR(255),
    device_info JSONB,
    ip_address INET,
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    revoked_at TIMESTAMPTZ
);

-- API keys
CREATE TABLE api_keys (
    id UUID PRIMARY KEY,
    organization_id UUID REFERENCES organizations(id),
    user_id UUID REFERENCES users(id),  -- creator
    name VARCHAR(255),
    key_hash VARCHAR(255),
    key_prefix VARCHAR(10),  -- for identification (e.g., "exp_live_")
    scopes TEXT[],
    expires_at TIMESTAMPTZ,
    last_used_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    revoked_at TIMESTAMPTZ
);

-- Sessions
CREATE TABLE sessions (
    id UUID PRIMARY KEY,
    user_id UUID REFERENCES users(id),
    refresh_token_id UUID REFERENCES refresh_tokens(id),
    device_info JSONB,
    ip_address INET,
    location JSONB,
    last_active_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    ended_at TIMESTAMPTZ
);

-- MFA settings
CREATE TABLE mfa_settings (
    id UUID PRIMARY KEY,
    user_id UUID REFERENCES users(id) UNIQUE,
    totp_secret_encrypted VARCHAR(500),
    totp_enabled BOOLEAN DEFAULT FALSE,
    recovery_codes_hash TEXT[],
    enrolled_at TIMESTAMPTZ
);

-- OAuth clients (for SSO provider)
CREATE TABLE oauth_clients (
    id UUID PRIMARY KEY,
    client_id VARCHAR(100) UNIQUE,
    client_secret_hash VARCHAR(255),
    name VARCHAR(255),
    redirect_uris TEXT[],
    allowed_scopes TEXT[],
    is_confidential BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- OAuth authorization codes
CREATE TABLE oauth_codes (
    id UUID PRIMARY KEY,
    client_id UUID REFERENCES oauth_clients(id),
    user_id UUID REFERENCES users(id),
    code_hash VARCHAR(255),
    redirect_uri VARCHAR(2000),
    scopes TEXT[],
    code_challenge VARCHAR(255),
    code_challenge_method VARCHAR(10),
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    used_at TIMESTAMPTZ
);

-- Invitations
CREATE TABLE invitations (
    id UUID PRIMARY KEY,
    organization_id UUID REFERENCES organizations(id),
    email VARCHAR(255),
    role VARCHAR(50),
    token_hash VARCHAR(255),
    invited_by UUID REFERENCES users(id),
    expires_at TIMESTAMPTZ,
    accepted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Audit log
CREATE TABLE audit_log (
    id UUID PRIMARY KEY,
    timestamp TIMESTAMPTZ DEFAULT NOW(),
    actor_id UUID REFERENCES users(id),
    actor_type VARCHAR(50),  -- user, api_key, system
    action VARCHAR(100),
    resource_type VARCHAR(50),
    resource_id UUID,
    details JSONB,
    ip_address INET,
    user_agent TEXT
);
```

---

## API Overview

```
# Authentication
POST /api/v1/auth/register
POST /api/v1/auth/login
POST /api/v1/auth/logout
POST /api/v1/auth/refresh
POST /api/v1/auth/forgot-password
POST /api/v1/auth/reset-password
GET  /api/v1/auth/me

# Users
GET  /api/v1/users
POST /api/v1/users
GET  /api/v1/users/{id}
PUT  /api/v1/users/{id}
DELETE /api/v1/users/{id}

# Organizations
GET  /api/v1/organizations
POST /api/v1/organizations
GET  /api/v1/organizations/{id}
PUT  /api/v1/organizations/{id}

# Teams
GET  /api/v1/teams
POST /api/v1/teams
PUT  /api/v1/teams/{id}
POST /api/v1/teams/{id}/members
DELETE /api/v1/teams/{id}/members/{uid}

# Roles & Permissions
GET  /api/v1/roles
POST /api/v1/roles
PUT  /api/v1/roles/{id}
GET  /api/v1/permissions
POST /api/v1/users/{id}/roles

# API Keys
GET  /api/v1/api-keys
POST /api/v1/api-keys
DELETE /api/v1/api-keys/{id}

# Sessions
GET  /api/v1/sessions
DELETE /api/v1/sessions/{id}
DELETE /api/v1/sessions (logout all)

# MFA
POST /api/v1/mfa/enroll
POST /api/v1/mfa/verify
DELETE /api/v1/mfa

# OAuth (Provider endpoints)
GET  /api/v1/oauth/authorize
POST /api/v1/oauth/token
GET  /api/v1/oauth/userinfo
GET  /.well-known/openid-configuration

# Invitations
POST /api/v1/invitations
GET  /api/v1/invitations
POST /api/v1/invitations/{token}/accept
DELETE /api/v1/invitations/{id}
```

---

## Success Criteria

### Phase 1 Complete When:
- [ ] Users can register and login
- [ ] JWT tokens work with refresh
- [ ] Password reset flow works end-to-end

### Phase 2 Complete When:
- [ ] Roles and permissions restrict access appropriately
- [ ] Admin can create custom roles
- [ ] Audit log captures all permission changes

### Phase 3 Complete When:
- [ ] Expertly apps use Identity for SSO
- [ ] Users log in once, access all apps
- [ ] External IdP (Google) works

---

## Next Steps

1. **Immediate**: Build registration and login endpoints
2. **This Week**: Implement JWT token system
3. **Next Sprint**: Basic RBAC with permissions
4. **Backlog**: OAuth2 provider implementation

---

*End of Implementation Plan*
