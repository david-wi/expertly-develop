import { useCallback, useMemo } from 'react'
import { Outlet, Link, useLocation } from 'react-router-dom'
import {
  LayoutDashboard,
  FolderKanban,
  ListTodo,
  FileBox,
  Play,
} from 'lucide-react'
import { Sidebar, MainContent, formatBuildTimestamp, useCurrentUser, createDefaultUserMenu } from 'expertly_ui/index'
import OrganizationSwitcher from './OrganizationSwitcher'
import { usersApi, TENANT_STORAGE_KEY } from '../../api/client'

const navigation = [
  { name: 'Dashboard', href: '/', icon: LayoutDashboard },
  { name: 'Projects', href: '/projects', icon: FolderKanban },
  { name: 'Job Queue', href: '/jobs', icon: ListTodo },
  { name: 'Artifacts', href: '/artifacts', icon: FileBox },
  { name: 'New Walkthrough', href: '/walkthroughs/new', icon: Play },
]

export default function Layout() {
  const location = useLocation()

  // Use shared hook for consistent user fetching
  const fetchCurrentUser = useCallback(() => usersApi.me(), [])
  const { user: currentUser, sidebarUser } = useCurrentUser(fetchCurrentUser)

  const handleOrgSwitch = () => {
    window.location.reload()
  }

  const handleLogout = useCallback(() => {
    // Redirect to identity login
    window.location.href = 'https://identity.ai.devintensive.com/login'
  }, [])

  // Tenant ID comes from localStorage (set when user switches organizations)
  const currentTenantId = localStorage.getItem(TENANT_STORAGE_KEY) || currentUser?.organization_id || null

  // Create user menu config
  const userMenu = useMemo(() => createDefaultUserMenu({
    onLogout: handleLogout,
    buildTimestamp: import.meta.env.VITE_BUILD_TIMESTAMP,
    gitCommit: import.meta.env.VITE_GIT_COMMIT,
  }), [handleLogout])

  return (
    <div className="min-h-screen bg-theme-bg">
      <Sidebar
        productCode="develop"
        productName="Develop"
        navigation={navigation}
        currentPath={location.pathname}
        user={sidebarUser}
        orgSwitcher={
          <OrganizationSwitcher
            currentTenantId={currentTenantId}
            onSwitch={handleOrgSwitch}
          />
        }
        buildInfo={
          formatBuildTimestamp(import.meta.env.VITE_BUILD_TIMESTAMP) && (
            <span className="text-[10px] text-theme-text-muted block text-right">
              {formatBuildTimestamp(import.meta.env.VITE_BUILD_TIMESTAMP)}
            </span>
          )
        }
        versionCheck={{
          currentCommit: import.meta.env.VITE_GIT_COMMIT,
        }}
        userMenu={userMenu}
        renderLink={({ href, className, children, onClick }) => (
          <Link to={href} className={className} onClick={onClick}>
            {children}
          </Link>
        )}
      />

      {/* Main content */}
      <MainContent>
        <Outlet />
      </MainContent>

      {/* Subtle marketing page link - fixed to bottom-right of page */}
      <Link
        to="/landing"
        className="fixed bottom-4 right-4 text-xs text-theme-text-muted hover:text-primary-600 transition-colors"
      >
        View marketing page
      </Link>
    </div>
  )
}
