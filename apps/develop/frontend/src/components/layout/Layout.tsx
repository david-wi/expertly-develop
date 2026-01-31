import { useCallback, useMemo, useState, useEffect } from 'react'
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard,
  FolderKanban,
  ListTodo,
  FileBox,
  Play,
} from 'lucide-react'
import { Sidebar, MainContent, formatBuildTimestamp, useCurrentUser, createDefaultUserMenu, type Organization } from '@expertly/ui'
import { usersApi, organizationsApi, TENANT_STORAGE_KEY } from '../../api/client'

const navigation = [
  { name: 'Dashboard', href: '/', icon: LayoutDashboard },
  { name: 'Projects', href: '/projects', icon: FolderKanban },
  { name: 'Job Queue', href: '/jobs', icon: ListTodo },
  { name: 'Artifacts', href: '/artifacts', icon: FileBox },
  { name: 'New Walkthrough', href: '/walkthroughs/new', icon: Play },
]

export default function Layout() {
  const location = useLocation()
  const navigate = useNavigate()
  const [organizations, setOrganizations] = useState<Organization[]>([])

  // Use shared hook for consistent user fetching
  const fetchCurrentUser = useCallback(() => usersApi.me(), [])
  const { user: currentUser, sidebarUser } = useCurrentUser(fetchCurrentUser)

  // Tenant ID comes from localStorage (set when user switches organizations)
  const currentTenantId = localStorage.getItem(TENANT_STORAGE_KEY) || currentUser?.organization_id || null

  // Fetch organizations on mount
  useEffect(() => {
    const fetchOrgs = async () => {
      try {
        const { items } = await organizationsApi.list()
        setOrganizations(items.map(org => ({
          id: org.id,
          name: org.name,
        })))
        // If no tenant selected, select the first one
        if (!localStorage.getItem(TENANT_STORAGE_KEY) && items.length > 0) {
          localStorage.setItem(TENANT_STORAGE_KEY, items[0].id)
        }
      } catch {
        // Ignore errors fetching organizations
      }
    }
    fetchOrgs()
  }, [])

  const handleOrgSwitch = useCallback((orgId: string) => {
    localStorage.setItem(TENANT_STORAGE_KEY, orgId)
    window.location.reload()
  }, [])

  const handleLogout = useCallback(() => {
    // Redirect to identity login
    window.location.href = 'https://identity.ai.devintensive.com/login'
  }, [])

  // Get current organization name for user display
  const currentOrg = organizations.find(o => o.id === currentTenantId)
  const userWithOrg = sidebarUser
    ? { ...sidebarUser, organization: sidebarUser.organization || currentOrg?.name }
    : undefined

  // Create user menu config with centralized organization switcher
  const userMenu = useMemo(() => createDefaultUserMenu({
    onLogout: handleLogout,
    buildTimestamp: import.meta.env.VITE_BUILD_TIMESTAMP,
    gitCommit: import.meta.env.VITE_GIT_COMMIT,
    currentAppCode: 'develop',
    organizations: organizations.length > 1 ? {
      items: organizations,
      currentId: currentTenantId,
      onSwitch: handleOrgSwitch,
      storageKey: TENANT_STORAGE_KEY,
    } : undefined,
  }), [handleLogout, organizations, currentTenantId, handleOrgSwitch])

  return (
    <div className="min-h-screen bg-theme-bg">
      <Sidebar
        productCode="develop"
        productName="Develop"
        navigation={navigation}
        currentPath={location.pathname}
        user={userWithOrg}
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
        navigate={navigate}
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
