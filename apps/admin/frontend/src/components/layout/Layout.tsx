import { useCallback, useMemo, useEffect } from 'react'
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom'
import { LayoutDashboard, Palette, Activity, AlertTriangle, Radio, Bot, Lightbulb } from 'lucide-react'
import { Sidebar, MainContent, formatBuildTimestamp, useCurrentUser, useOrganizations, createDefaultUserMenu } from '@expertly/ui'
import { usersApi } from '@/services/api'

const navigation = [
  { name: 'Dashboard', href: '/', icon: LayoutDashboard },
  { name: 'Themes', href: '/themes', icon: Palette },
  { name: 'AI Config', href: '/ai-config', icon: Bot },
  { name: 'Idea Backlog', href: '/idea-backlog', icon: Lightbulb },
  { name: 'Error Logs', href: '/error-logs', icon: AlertTriangle },
  { name: 'Monitoring', href: '/monitoring', icon: Activity },
  { name: 'Live Monitor', href: '/monitor', icon: Radio },
]

// Page titles for each route
const pageTitles: Record<string, string> = {
  '/': 'Dashboard',
  '/themes': 'Themes',
  '/ai-config': 'AI Config',
  '/idea-backlog': 'Idea Backlog',
  '/error-logs': 'Error Logs',
  '/monitoring': 'Monitoring',
  '/monitor': 'Live Monitor',
  '/known-issues': 'Known Issues',
  '/test-scenarios': 'Test Scenarios',
  '/changelog': 'Changelog',
}

export function Layout() {
  const location = useLocation()
  const navigate = useNavigate()

  // Update page title based on current route
  useEffect(() => {
    const basePath = location.pathname.split('/').slice(0, 2).join('/') || '/'
    const pageTitle = pageTitles[basePath] || pageTitles[location.pathname]
    if (pageTitle) {
      document.title = `${pageTitle} - Expertly Admin`
    } else {
      document.title = 'Expertly Admin'
    }
  }, [location.pathname])

  // Use shared hook for consistent user fetching
  const fetchCurrentUser = useCallback(() => usersApi.me(), [])
  const { sidebarUser } = useCurrentUser(fetchCurrentUser)

  // Use shared organizations hook
  const { organizationsConfig, currentOrg } = useOrganizations({
    storageKey: 'admin_selected_org_id',
  })

  // Merge organization name into user display
  const userWithOrg = sidebarUser
    ? { ...sidebarUser, organization: sidebarUser.organization || currentOrg?.name }
    : undefined

  const handleLogout = useCallback(() => {
    // Redirect to identity login
    window.location.href = 'https://identity.ai.devintensive.com/login'
  }, [])

  // Create user menu config with organization switcher
  const userMenu = useMemo(() => createDefaultUserMenu({
    onLogout: handleLogout,
    buildTimestamp: import.meta.env.VITE_BUILD_TIMESTAMP,
    gitCommit: import.meta.env.VITE_GIT_COMMIT,
    currentAppCode: 'admin',
    organizations: organizationsConfig,
  }), [handleLogout, organizationsConfig])

  return (
    <div className="min-h-screen bg-theme-bg">
      <Sidebar
        productCode="admin"
        productName="Admin"
        navigation={navigation}
        currentPath={location.pathname}
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

      {/* Main content */}
      <MainContent>
        <Outlet />
      </MainContent>

      {/* Subtle marketing page link - fixed to bottom-right of page */}
      <Link
        to="/landing"
        className="fixed bottom-4 right-4 text-xs text-gray-400 hover:text-primary-600 transition-colors"
      >
        View marketing page
      </Link>
    </div>
  )
}
