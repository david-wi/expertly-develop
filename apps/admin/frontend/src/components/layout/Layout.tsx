import { useCallback } from 'react'
import { Outlet, Link, useLocation } from 'react-router-dom'
import { LayoutDashboard, Palette, Activity, AlertTriangle } from 'lucide-react'
import { Sidebar, MainContent, formatBuildTimestamp, useCurrentUser } from 'expertly_ui/index'
import { usersApi } from '@/services/api'

const navigation = [
  { name: 'Dashboard', href: '/', icon: LayoutDashboard },
  { name: 'Themes', href: '/themes', icon: Palette },
  { name: 'Error Logs', href: '/error-logs', icon: AlertTriangle },
  { name: 'Monitoring', href: '/monitoring', icon: Activity },
]

export function Layout() {
  const location = useLocation()

  // Use shared hook for consistent user fetching
  const fetchCurrentUser = useCallback(() => usersApi.me(), [])
  const { sidebarUser } = useCurrentUser(fetchCurrentUser)

  return (
    <div className="min-h-screen bg-gray-50">
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
        renderLink={({ href, className, children }) => (
          <Link to={href} className={className}>
            {children}
          </Link>
        )}
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
