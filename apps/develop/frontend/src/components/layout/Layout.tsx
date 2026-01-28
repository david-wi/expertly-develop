import { useCallback } from 'react'
import { Outlet, Link, useLocation } from 'react-router-dom'
import {
  LayoutDashboard,
  FolderKanban,
  ListTodo,
  FileBox,
  Play,
} from 'lucide-react'
import { Sidebar, MainContent, formatBuildTimestamp, useCurrentUser, CurrentUser } from 'expertly_ui/index'
import OrganizationSwitcher from './OrganizationSwitcher'
import { usersApi, TENANT_STORAGE_KEY, CurrentUser as DevelopUser } from '../../api/client'

const navigation = [
  { name: 'Dashboard', href: '/', icon: LayoutDashboard },
  { name: 'Projects', href: '/projects', icon: FolderKanban },
  { name: 'Job Queue', href: '/jobs', icon: ListTodo },
  { name: 'Artifacts', href: '/artifacts', icon: FileBox },
  { name: 'New Walkthrough', href: '/walkthroughs/new', icon: Play },
]

export default function Layout() {
  const location = useLocation()

  // Adapt Develop's user type to the shared hook's type
  const fetchCurrentUser = useCallback(async (): Promise<CurrentUser> => {
    const user = await usersApi.me()
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      organization_id: user.tenant.id,
      organization_name: user.tenant.name,
    }
  }, [])
  const { user: currentUser, sidebarUser } = useCurrentUser(fetchCurrentUser)

  const handleOrgSwitch = () => {
    window.location.reload()
  }

  // Tenant ID comes from localStorage (set when user switches organizations)
  const currentTenantId = localStorage.getItem(TENANT_STORAGE_KEY) || currentUser?.organization_id || null

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
        renderLink={({ href, className, children }) => (
          <Link to={href} className={className}>
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
