# Plan: Add Organization Switcher to All Apps + Enhance Shared Sidebar

## Summary

1. **Enhance the shared Sidebar** to support custom content sections (for apps like Vibecode)
2. **Add Organization Switcher** to Define, Vibetest, and Vibecode
3. **Migrate Vibecode** to use the shared Sidebar while preserving its custom widget UI

## Phase 1: Enhance Shared Sidebar Component

**File:** `packages/ui/src/components/Sidebar.tsx`

Add new prop for custom content:
```typescript
interface SidebarProps {
  // ... existing props

  /** Custom content rendered below navigation (e.g., widgets, sessions) */
  children?: ReactNode
}
```

The layout order becomes:
1. Version banner (if enabled)
2. Header (logo, product switcher, language)
3. Organization Switcher (if provided)
4. Navigation links
5. **Children/Custom Content** (NEW - scrollable with nav)
6. Build Info (if provided)
7. Theme Switcher
8. Bottom Section (if provided)
9. User info (if provided)

## Phase 2: Add Organizations API to Backends

### Define Backend
**File:** `apps/define/backend/app/api/v1/organizations.py` (new)

```python
@router.get("")
async def list_organizations(user: CurrentUser = Depends(get_current_user)):
    """Get organizations from Identity service."""
    # Proxy to Identity service
```

**File:** `apps/define/backend/app/api/v1/__init__.py` - Register router

### Vibetest Backend
**File:** `apps/vibetest/backend/app/api/v1/organizations.py` (new)

Same pattern as Define.

### Vibecode
Vibecode uses its own server architecture - check if it needs org support or can call Identity directly.

## Phase 3: Add OrganizationSwitcher to Frontends

### Shared OrganizationSwitcher Component

Consider moving to `packages/ui` since multiple apps need it:

**File:** `packages/ui/src/components/OrganizationSwitcher.tsx` (new)

```typescript
interface OrganizationSwitcherProps {
  organizations: Organization[]
  currentTenantId: string | null
  onSwitch: (orgId: string) => void
  loading?: boolean
}
```

Or each app can have its own if the API client integration differs significantly.

### Define Frontend

**Files to modify:**
- `apps/define/frontend/src/api/client.ts` - Add `organizationsApi`, `TENANT_STORAGE_KEY`, X-Tenant-Id header
- `apps/define/frontend/src/components/layout/OrganizationSwitcher.tsx` (new)
- `apps/define/frontend/src/components/layout/Layout.tsx` - Add orgSwitcher prop

### Vibetest Frontend

**Files to modify:**
- `apps/vibetest/frontend/src/api/client.ts` - Add organizations API
- `apps/vibetest/frontend/src/components/OrganizationSwitcher.tsx` (new)
- `apps/vibetest/frontend/src/components/Layout.tsx` - Add orgSwitcher prop

### Vibecode Frontend

**Files to modify:**
- `apps/vibecode/packages/client/src/components/Sidebar.tsx` - Replace with shared Sidebar usage
- Move widget/session management UI to be passed as `children` to shared Sidebar
- Add organization switcher

## Phase 4: Migrate Vibecode to Shared Sidebar

Current Vibecode Sidebar structure:
```
├── Header (logo, product switcher) - REPLACE with shared
├── Widgets Section - MOVE to children prop
├── Agent Status - MOVE to children prop
└── Footer Actions - MOVE to bottomSection prop
```

New structure using shared Sidebar:
```tsx
<SharedSidebar
  productCode="vibecode"
  productName="VibeCode"
  navigation={[]} // Vibecode has no standard nav
  orgSwitcher={<OrganizationSwitcher />}
  bottomSection={<FooterActions />}
>
  {/* Custom content */}
  <WidgetsSection />
  <AgentStatus />
</SharedSidebar>
```

## Files Changed Summary

| File | Action | Description |
|------|--------|-------------|
| `packages/ui/src/components/Sidebar.tsx` | Modify | Add `children` prop |
| `packages/ui/src/index.ts` | Modify | Export OrganizationSwitcher if shared |
| `apps/define/backend/app/api/v1/organizations.py` | Create | Organizations endpoint |
| `apps/define/backend/app/api/v1/__init__.py` | Modify | Register router |
| `apps/define/frontend/src/api/client.ts` | Modify | Add orgs API + tenant header |
| `apps/define/frontend/src/components/layout/OrganizationSwitcher.tsx` | Create | Org switcher component |
| `apps/define/frontend/src/components/layout/Layout.tsx` | Modify | Add orgSwitcher prop |
| `apps/vibetest/backend/app/api/v1/organizations.py` | Create | Organizations endpoint |
| `apps/vibetest/frontend/src/api/client.ts` | Modify | Add orgs API |
| `apps/vibetest/frontend/src/components/OrganizationSwitcher.tsx` | Create | Org switcher |
| `apps/vibetest/frontend/src/components/Layout.tsx` | Modify | Add orgSwitcher prop |
| `apps/vibecode/packages/client/src/components/Sidebar.tsx` | Rewrite | Use shared Sidebar |
| `apps/vibecode/packages/client/src/components/WidgetsSection.tsx` | Create | Extract from Sidebar |
| `apps/vibecode/packages/client/src/components/AgentStatus.tsx` | Create | Extract from Sidebar |

## Implementation Order

1. **Enhance shared Sidebar** (add `children` prop) - enables all other changes
2. **Define** - backend organizations endpoint, frontend org switcher
3. **Vibetest** - backend organizations endpoint, frontend org switcher
4. **Vibecode** - migrate to shared Sidebar with custom content

## Testing

For each app:
1. User with multiple organizations sees dropdown
2. User with single organization sees no dropdown (or single item)
3. Switching organizations reloads with correct tenant context
4. Tenant ID is sent in API requests via `X-Tenant-Id` header

For Vibecode specifically:
5. Widgets section still works correctly
6. Agent status displays properly
7. Session management functions as before
