import { useState, useCallback, useMemo } from 'react'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard,
  ListTodo,
  Layers,
  FolderKanban,
  RefreshCw,
  Users2,
  BookOpen,
  GraduationCap,
  Star,
  Link2,
  PersonStanding,
  Eye,
} from 'lucide-react'
import { Sidebar, formatBuildTimestamp, useCurrentUser, useOrganizations, createDefaultUserMenu, VoiceTranscription, useSidebarCollapsed } from '@expertly/ui'
import ViewAsSwitcher, { ViewAsState, getViewAsState } from './ViewAsSwitcher'
import NotificationBell from './NotificationBell'
import { api } from '../services/api'

const navigation = [
  { name: 'Dashboard', href: '/', icon: LayoutDashboard },
  { name: 'Assignments', href: '/tasks', icon: ListTodo },
  { name: 'Connections', href: '/connections', icon: Link2 },
  { name: 'Monitors', href: '/monitors', icon: Eye },
  { name: 'Playbooks', href: '/playbooks', icon: BookOpen },
  { name: 'Expertise', href: '/expertise', icon: GraduationCap },
  { name: 'Projects', href: '/projects', icon: FolderKanban },
  { name: 'Queues', href: '/queues', icon: Layers },
  { name: 'Recurring', href: '/recurring', icon: RefreshCw },
  { name: 'Teams', href: '/teams', icon: Users2, spacerBefore: true },
  { name: 'Users and Bots', href: '/users', icon: PersonStanding },
  { name: 'Wins', href: '/wins', icon: Star },
]

// Local storage key for selected organization
const ORG_STORAGE_KEY = 'manage_selected_org_id'

export default function Layout() {
  const location = useLocation()
  const navigate = useNavigate()
  const [viewAs, setViewAs] = useState<ViewAsState>(getViewAsState())
  const [sidebarCollapsed] = useSidebarCollapsed()

  // Use shared hook for consistent user fetching
  const fetchCurrentUser = useCallback(() => api.getCurrentUser(), [])
  const { sidebarUser } = useCurrentUser(fetchCurrentUser)

  // Use shared organizations hook
  const { organizationsConfig, currentOrg } = useOrganizations({
    storageKey: ORG_STORAGE_KEY,
  })

  const handleViewChange = (newState: ViewAsState) => {
    setViewAs(newState)
    // Reload page to refresh data with new view context
    window.location.reload()
  }

  const handleLogout = useCallback(() => {
    // Redirect to identity login
    window.location.href = 'https://identity.ai.devintensive.com/login'
  }, [])

  // Create user menu config with centralized organization switcher
  const userMenu = useMemo(() => createDefaultUserMenu({
    onLogout: handleLogout,
    buildTimestamp: import.meta.env.VITE_BUILD_TIMESTAMP,
    gitCommit: import.meta.env.VITE_GIT_COMMIT,
    currentAppCode: 'command',
    organizations: organizationsConfig,
  }), [handleLogout, organizationsConfig])

  // Merge organization name from selected org if not in user data
  const userWithOrg = sidebarUser
    ? {
        ...sidebarUser,
        organization: sidebarUser.organization || currentOrg?.name,
      }
    : undefined

  return (
    <div className="min-h-screen bg-theme-bg">
      <VoiceTranscription tokenUrl="https://identity-api.ai.devintensive.com/api/v1/transcription/token" />
      <Sidebar
        productCode="command"
        productName="Command"
        navigation={navigation}
        currentPath={location.pathname}
        orgSwitcher={<ViewAsSwitcher onViewChange={handleViewChange} />}
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
      <div className={`${sidebarCollapsed ? 'pl-16' : 'pl-72'} min-h-screen bg-theme-bg transition-[padding] duration-200 ease-in-out`}>
        <header className="sticky top-0 z-40 bg-theme-bg border-b border-gray-200 px-8 py-3 flex items-center justify-end">
          <NotificationBell />
        </header>
        <main className="p-8">
          <Outlet context={{ viewAs, selectedOrgId: currentOrg?.id ?? null }} />
        </main>
      </div>
    </div>
  )
}
