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
  Bot,
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
  { name: 'Tasks', href: '/tasks', icon: ListTodo },
  { name: 'Teams', href: '/teams', icon: Users2 },
  { name: 'Users and Bots', href: '/users', icon: Bot },
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

  return (
    <div className="min-h-screen bg-theme-bg">
      <Sidebar
        productCode="manage"
        productName="Manage"
        navigation={navigation}
        currentPath={location.pathname}
        orgSwitcher={
          <div className="space-y-2">
            {/* Organization Selector */}
            {organizations.length > 0 && (
              <select
                value={selectedOrgId || ''}
                onChange={(e) => handleOrgChange(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                {organizations.map((org) => (
                  <option key={org.id} value={org.id}>
                    {org.name}
                  </option>
                ))}
              </select>
            )}
            {/* View As Switcher (for admins) */}
            <ViewAsSwitcher onViewChange={handleViewChange} />
          </div>
        }
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
