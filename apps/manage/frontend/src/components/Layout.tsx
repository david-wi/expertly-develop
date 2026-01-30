import { useState, useCallback, useEffect, useMemo } from 'react'
import { Outlet, Link, useLocation } from 'react-router-dom'
import {
  LayoutDashboard,
  ListTodo,
  Layers,
  FolderKanban,
  RefreshCw,
  Users2,
  BookOpen,
  Star,
  Link2,
  PersonStanding,
  Building2,
} from 'lucide-react'
import { Sidebar, MainContent, formatBuildTimestamp, useCurrentUser, createDefaultUserMenu } from '@expertly/ui'
import ViewAsSwitcher, { ViewAsState, getViewAsState } from './ViewAsSwitcher'
import { api, Organization } from '../services/api'

const navigation = [
  { name: 'Dashboard', href: '/', icon: LayoutDashboard },
  { name: 'Playbooks', href: '/playbooks', icon: BookOpen },
  { name: 'Projects', href: '/projects', icon: FolderKanban },
  { name: 'Queues', href: '/queues', icon: Layers },
  { name: 'Recurring', href: '/recurring', icon: RefreshCw },
  { name: 'Assignments', href: '/tasks', icon: ListTodo },
  { name: 'Teams', href: '/teams', icon: Users2 },
  { name: 'Users and Bots', href: '/users', icon: PersonStanding },
  { name: 'Connections', href: '/connections', icon: Link2 },
  { name: 'Wins', href: '/wins', icon: Star, spacerBefore: true },
]

// Local storage key for selected organization
const ORG_STORAGE_KEY = 'manage_selected_org_id'

function getStoredOrgId(): string | null {
  try {
    return localStorage.getItem(ORG_STORAGE_KEY)
  } catch {
    return null
  }
}

function setStoredOrgId(orgId: string | null) {
  try {
    if (orgId) {
      localStorage.setItem(ORG_STORAGE_KEY, orgId)
    } else {
      localStorage.removeItem(ORG_STORAGE_KEY)
    }
  } catch {
    // Ignore storage errors
  }
}

export default function Layout() {
  const location = useLocation()
  const [viewAs, setViewAs] = useState<ViewAsState>(getViewAsState())
  const [organizations, setOrganizations] = useState<Organization[]>([])
  const [selectedOrgId, setSelectedOrgId] = useState<string | null>(getStoredOrgId())
  const [showOrgDropdown, setShowOrgDropdown] = useState(false)

  // Use shared hook for consistent user fetching
  const fetchCurrentUser = useCallback(() => api.getCurrentUser(), [])
  const { sidebarUser } = useCurrentUser(fetchCurrentUser)

  // Fetch organizations on mount
  useEffect(() => {
    const fetchOrgs = async () => {
      try {
        const orgs = await api.getOrganizations()
        setOrganizations(orgs)
        // If we have orgs but none selected, select the first one
        if (orgs.length > 0 && !selectedOrgId) {
          const defaultOrg = orgs.find(o => o.is_default) || orgs[0]
          setSelectedOrgId(defaultOrg.id)
          setStoredOrgId(defaultOrg.id)
        }
      } catch {
        // Error fetching orgs - ignore
      }
    }
    fetchOrgs()
  }, [selectedOrgId])

  const handleOrgChange = (orgId: string) => {
    setSelectedOrgId(orgId)
    setStoredOrgId(orgId)
    // Reload the page to refresh data with new org
    window.location.reload()
  }

  const handleViewChange = (newState: ViewAsState) => {
    setViewAs(newState)
    // Reload page to refresh data with new view context
    window.location.reload()
  }

  const selectedOrg = organizations.find(o => o.id === selectedOrgId)

  const handleLogout = useCallback(() => {
    // Redirect to identity login
    window.location.href = 'https://identity.ai.devintensive.com/login'
  }, [])

  // Create user menu config
  const userMenu = useMemo(() => createDefaultUserMenu({
    onLogout: handleLogout,
    buildTimestamp: import.meta.env.VITE_BUILD_TIMESTAMP,
    gitCommit: import.meta.env.VITE_GIT_COMMIT,
  }), [handleLogout])

  // Merge organization name from selected org if not in user data
  const userWithOrg = sidebarUser
    ? {
        ...sidebarUser,
        organization: sidebarUser.organization || selectedOrg?.name,
      }
    : undefined

  // Organization switcher component for bottom section
  const organizationSwitcher = organizations.length > 1 ? (
    <div className="relative px-4 py-3">
      <button
        onClick={() => setShowOrgDropdown(!showOrgDropdown)}
        className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left rounded-lg hover:bg-theme-bg-elevated transition-colors"
        title={selectedOrg?.name || 'Select organization'}
      >
        <Building2 className="w-5 h-5 text-theme-text-secondary flex-shrink-0" />
        <span className="flex-1 truncate text-theme-text-primary">{selectedOrg?.name || 'Select Org'}</span>
      </button>
      {showOrgDropdown && (
        <div className="absolute bottom-full left-4 right-4 mb-1 bg-theme-bg-surface border border-theme-border rounded-lg shadow-lg z-50">
          {organizations.map((org) => (
            <button
              key={org.id}
              onClick={() => {
                handleOrgChange(org.id)
                setShowOrgDropdown(false)
              }}
              className={`w-full text-left px-3 py-2 text-sm ${
                org.id === selectedOrgId
                  ? 'bg-primary-50 text-primary-700'
                  : 'hover:bg-theme-bg-elevated text-theme-text-primary'
              } first:rounded-t-lg last:rounded-b-lg`}
            >
              {org.name}
            </button>
          ))}
        </div>
      )}
    </div>
  ) : null

  return (
    <div className="min-h-screen bg-theme-bg">
      <Sidebar
        productCode="manage"
        productName="Manage"
        navigation={navigation}
        currentPath={location.pathname}
        orgSwitcher={
          <ViewAsSwitcher onViewChange={handleViewChange} />
        }
        bottomSection={organizationSwitcher}
        buildInfo={
          formatBuildTimestamp(import.meta.env.VITE_BUILD_TIMESTAMP) && (
            <span className="text-[10px] text-gray-400 block text-right">
              {formatBuildTimestamp(import.meta.env.VITE_BUILD_TIMESTAMP)}
            </span>
          )
        }
        userMenu={userMenu}
        renderLink={({ href, className, children, onClick }) => (
          <Link to={href} className={className} onClick={onClick}>
            {children}
          </Link>
        )}
        user={userWithOrg}
      />
      <MainContent>
        <Outlet context={{ viewAs, selectedOrgId }} />
      </MainContent>
    </div>
  )
}
