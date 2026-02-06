import { useCallback, useMemo } from 'react'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard,
  Inbox,
  FileText,
  Truck,
  Send,
  Users,
  Building2,
  Radio,
  Receipt,
  BarChart3,
  Trophy,
  FolderSearch,
  Settings,
  LayoutGrid,
} from 'lucide-react'
import { Sidebar, formatBuildTimestamp, useCurrentUser, useOrganizations, createDefaultUserMenu } from '@expertly/ui'
import { api } from '../../services/api'

const navigation = [
  { name: 'Dashboard', href: '/', icon: LayoutDashboard },
  { name: 'Inbox', href: '/inbox', icon: Inbox },
  { name: 'Quote Requests', href: '/quote-requests', icon: FileText },
  { name: 'Shipments', href: '/shipments', icon: Truck },
  { name: 'Dispatch Board', href: '/dispatch', icon: Send },
  { name: 'Customers', href: '/customers', icon: Users, spacerBefore: true },
  { name: 'Carriers', href: '/carriers', icon: Building2 },
  { name: 'Load Boards', href: '/loadboards', icon: Radio },
  { name: 'Invoices', href: '/invoices', icon: Receipt },
  { name: 'Margins', href: '/margins', icon: BarChart3, spacerBefore: true },
  { name: 'Carrier Performance', href: '/carrier-performance', icon: Trophy },
  { name: 'Document Review', href: '/document-review', icon: FolderSearch },
  { name: 'Settings', href: '/settings', icon: Settings, spacerBefore: true },
  { name: 'Desks', href: '/desks', icon: LayoutGrid },
]

// Local storage key for selected organization
const ORG_STORAGE_KEY = 'tms_selected_org_id'

export default function Layout() {
  const location = useLocation()
  const navigate = useNavigate()

  // Use shared hook for consistent user fetching
  const fetchCurrentUser = useCallback(() => api.getCurrentUser(), [])
  const { sidebarUser } = useCurrentUser(fetchCurrentUser)

  // Use shared organizations hook
  const { organizationsConfig, currentOrg } = useOrganizations({
    storageKey: ORG_STORAGE_KEY,
  })

  const handleLogout = useCallback(() => {
    // Redirect to identity login
    window.location.href = 'https://identity.ai.devintensive.com/login'
  }, [])

  // Create user menu config with centralized organization switcher
  const userMenu = useMemo(() => createDefaultUserMenu({
    onLogout: handleLogout,
    buildTimestamp: import.meta.env.VITE_BUILD_TIMESTAMP,
    gitCommit: import.meta.env.VITE_GIT_COMMIT,
    currentAppCode: 'tms',
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
      <Sidebar
        productCode="tms"
        productName="TMS"
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
      <div className="pl-72 min-h-screen bg-theme-bg">
        <main className="p-8">
          <Outlet context={{ selectedOrgId: currentOrg?.id ?? null }} />
        </main>
      </div>
    </div>
  )
}
