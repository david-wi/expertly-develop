import { useCallback, useMemo } from 'react'
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom'
import { LayoutDashboard, Palette, Activity, AlertTriangle, Radio, Bot } from 'lucide-react'
import { Sidebar, MainContent, formatBuildTimestamp, useCurrentUser, createDefaultUserMenu } from '@expertly/ui'
import { usersApi } from '@/services/api'

const navigation = [
  { name: 'Dashboard', href: '/', icon: LayoutDashboard },
  { name: 'Themes', href: '/themes', icon: Palette },
  { name: 'AI Config', href: '/ai-config', icon: Bot },
  { name: 'Error Logs', href: '/error-logs', icon: AlertTriangle },
  { name: 'Monitoring', href: '/monitoring', icon: Activity },
  { name: 'Live Monitor', href: '/monitor', icon: Radio },
]

export function Layout() {
  const location = useLocation()
  const navigate = useNavigate()

  // Use shared hook for consistent user fetching
  const fetchCurrentUser = useCallback(() => usersApi.me(), [])
  const { sidebarUser } = useCurrentUser(fetchCurrentUser)

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
        user={sidebarUser}
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
