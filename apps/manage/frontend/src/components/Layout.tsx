import { useState, useCallback, useEffect, useMemo } from 'react'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
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
  Eye,
} from 'lucide-react'
import { Sidebar, formatBuildTimestamp, useCurrentUser, createDefaultUserMenu, VoiceTranscription, type Organization } from '@expertly/ui'
import ViewAsSwitcher, { ViewAsState, getViewAsState } from './ViewAsSwitcher'
import NotificationBell from './NotificationBell'
import { api, Organization as ApiOrganization } from '../services/api'

const navigation = [
  { name: 'Dashboard', href: '/', icon: LayoutDashboard },
  { name: 'Assignments', href: '/tasks', icon: ListTodo },
  { name: 'Connections', href: '/connections', icon: Link2 },
  { name: 'Monitors', href: '/monitors', icon: Eye },
  { name: 'Playbooks', href: '/playbooks', icon: BookOpen },
  { name: 'Projects', href: '/projects', icon: FolderKanban },
  { name: 'Queues', href: '/queues', icon: Layers },
  { name: 'Recurring', href: '/recurring', icon: RefreshCw },
  { name: 'Teams', href: '/teams', icon: Users2, spacerBefore: true },
  { name: 'Users and Bots', href: '/users', icon: PersonStanding },
  { name: 'Wins', href: '/wins', icon: Star },
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
  const navigate = useNavigate()
  const [viewAs, setViewAs] = useState<ViewAsState>(getViewAsState())
  const [organizations, setOrganizations] = useState<ApiOrganization[]>([])
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

  const handleOrgChange = useCallback((orgId: string) => {
    setStoredOrgId(orgId)
    // Reload the page to refresh data with new org
    window.location.reload()
  }, [])

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

  // Convert organizations to the format expected by UserMenu
  const userMenuOrganizations: Organization[] = useMemo(() =>
    organizations.map(org => ({
      id: org.id,
      name: org.name,
      is_default: org.is_default,
    })),
    [organizations]
  )

  // Create user menu config with centralized organization switcher
  const userMenu = useMemo(() => createDefaultUserMenu({
    onLogout: handleLogout,
    buildTimestamp: import.meta.env.VITE_BUILD_TIMESTAMP,
    gitCommit: import.meta.env.VITE_GIT_COMMIT,
    currentAppCode: 'manage',
    organizations: userMenuOrganizations.length > 0 ? {
      items: userMenuOrganizations,
      currentId: selectedOrgId,
      onSwitch: handleOrgChange,
      storageKey: ORG_STORAGE_KEY,
    } : undefined,
  }), [handleLogout, userMenuOrganizations, selectedOrgId, handleOrgChange])

  // Merge organization name from selected org if not in user data
  const userWithOrg = sidebarUser
    ? {
        ...sidebarUser,
        organization: sidebarUser.organization || selectedOrg?.name,
      }
    : undefined

  return (
    <div className="min-h-screen bg-theme-bg">
      <VoiceTranscription wsUrl="wss://identity-api.ai.devintensive.com/ws/transcribe" />
      <Sidebar
        productCode="manage"
        productName="Manage"
        navigation={navigation}
        currentPath={location.pathname}
        orgSwitcher={
          <ViewAsSwitcher onViewChange={handleViewChange} />
        }
        buildInfo={
          formatBuildTimestamp(import.meta.env.VITE_BUILD_TIMESTAMP) && (
            <span className="text-[10px] text-gray-400 block text-right">
              {formatBuildTimestamp(import.meta.env.VITE_BUILD_TIMESTAMP)}
            </span>
          )
        }
        userMenu={userMenu}
        navigate={navigate}
        user={userWithOrg}
      />
      <div className="pl-72 min-h-screen bg-theme-bg">
        <header className="sticky top-0 z-40 bg-theme-bg border-b border-gray-200 px-8 py-3 flex items-center justify-end">
          <NotificationBell />
        </header>
        <main className="p-8">
          <Outlet context={{ viewAs, selectedOrgId }} />
        </main>
      </div>
    </div>
  )
}
