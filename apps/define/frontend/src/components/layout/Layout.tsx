import { useCallback, useState } from 'react'
import { Outlet, Link, useLocation } from 'react-router-dom'
import {
  LayoutDashboard,
  FolderTree,
  Package,
} from 'lucide-react'
import { Sidebar, MainContent, formatBuildTimestamp, useCurrentUser } from 'expertly_ui/index'
import { usersApi, TENANT_STORAGE_KEY } from '../../api/client'
import OrganizationSwitcher from './OrganizationSwitcher'

const navigation = [
  { name: 'Dashboard', href: '/', icon: LayoutDashboard },
  { name: 'Products', href: '/products', icon: FolderTree },
  { name: 'Releases', href: '/releases', icon: Package },
]

export default function Layout() {
  const location = useLocation()
  const [currentTenantId, setCurrentTenantId] = useState<string | null>(
    localStorage.getItem(TENANT_STORAGE_KEY)
  )

  // Use shared hook for consistent user fetching
  const fetchCurrentUser = useCallback(() => usersApi.me(), [])
  const { sidebarUser } = useCurrentUser(fetchCurrentUser)

  const handleOrgSwitch = () => {
    // Update state and reload to fetch data for new org
    setCurrentTenantId(localStorage.getItem(TENANT_STORAGE_KEY))
    window.location.reload()
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Sidebar
        productCode="define"
        productName="Define"
        navigation={navigation}
        currentPath={location.pathname}
        orgSwitcher={
          <OrganizationSwitcher
            currentTenantId={currentTenantId}
            onSwitch={handleOrgSwitch}
          />
        }
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
        renderLink={({ href, className, children }) => (
          <Link to={href} className={className}>
            {children}
          </Link>
        )}
        user={sidebarUser}
      />

      <MainContent>
        <Outlet />
      </MainContent>
    </div>
  )
}
