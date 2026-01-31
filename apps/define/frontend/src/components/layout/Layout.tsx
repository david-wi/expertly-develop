import { useCallback, useState, useMemo, useEffect } from 'react'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard,
  FolderTree,
  Package,
} from 'lucide-react'
import { Sidebar, MainContent, formatBuildTimestamp, useCurrentUser, createDefaultUserMenu, type Organization } from '@expertly/ui'
import { usersApi, organizationsApi, TENANT_STORAGE_KEY } from '../../api/client'

const navigation = [
  { name: 'Dashboard', href: '/', icon: LayoutDashboard },
  { name: 'Products', href: '/products', icon: FolderTree },
  { name: 'Releases', href: '/releases', icon: Package },
]

export default function Layout() {
  const location = useLocation()
  const navigate = useNavigate()
  const [currentTenantId, setCurrentTenantId] = useState<string | null>(
    localStorage.getItem(TENANT_STORAGE_KEY)
  )
  const [organizations, setOrganizations] = useState<Organization[]>([])

  // Use shared hook for consistent user fetching
  const fetchCurrentUser = useCallback(() => usersApi.me(), [])
  const { sidebarUser } = useCurrentUser(fetchCurrentUser)

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
        if (!currentTenantId && items.length > 0) {
          localStorage.setItem(TENANT_STORAGE_KEY, items[0].id)
          setCurrentTenantId(items[0].id)
        }
      } catch {
        // Ignore errors fetching organizations
      }
    }
    fetchOrgs()
  }, [currentTenantId])

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
    currentAppCode: 'define',
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
        productCode="define"
        productName="Define"
        navigation={navigation}
        currentPath={location.pathname}
        buildInfo={
          formatBuildTimestamp(import.meta.env.VITE_BUILD_TIMESTAMP) && (
            <span className="text-[10px] text-gray-400 block text-right">
              {formatBuildTimestamp(import.meta.env.VITE_BUILD_TIMESTAMP)}
            </span>
          )
        }
        versionCheck={{
          currentCommit: import.meta.env.VITE_GIT_COMMIT,
        }}
        userMenu={userMenu}
        navigate={navigate}
        user={userWithOrg}
      />

      <MainContent>
        <Outlet />
      </MainContent>
    </div>
  )
}
