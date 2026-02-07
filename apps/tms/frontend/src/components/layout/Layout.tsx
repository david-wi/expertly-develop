import { useCallback, useMemo, useState, useEffect } from 'react'
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
  CheckSquare,
  Activity,
  Map,
  Zap,
  FileInput,
  DollarSign,
  ArrowLeftRight,
  Table2,
  MessageSquare,
  Shield,
  Building,
  Menu,
  X,
} from 'lucide-react'
import { Sidebar, formatBuildTimestamp, useCurrentUser, useOrganizations, createDefaultUserMenu } from '@expertly/ui'
import { api } from '../../services/api'
import NotificationCenter from '../NotificationCenter'

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
  { name: 'Approvals', href: '/approvals', icon: CheckSquare },
  { name: 'Margins', href: '/margins', icon: BarChart3, spacerBefore: true },
  { name: 'Carrier Performance', href: '/carrier-performance', icon: Trophy },
  { name: 'Operations Metrics', href: '/operations-metrics', icon: Activity },
  { name: 'Lane Intelligence', href: '/lane-intelligence', icon: Map },
  { name: 'Document Review', href: '/document-review', icon: FolderSearch },
  { name: 'Document Inbox', href: '/document-inbox', icon: FileInput },
  { name: 'Billing', href: '/billing', icon: DollarSign },
  { name: 'EDI', href: '/edi', icon: ArrowLeftRight, spacerBefore: true },
  { name: 'Rate Tables', href: '/rate-tables', icon: Table2 },
  { name: 'Communications', href: '/communications', icon: MessageSquare },
  { name: 'Settings', href: '/settings', icon: Settings, spacerBefore: true },
  { name: 'Desks', href: '/desks', icon: LayoutGrid },
  { name: 'Automations', href: '/automations', icon: Zap },
  { name: 'Roles', href: '/roles', icon: Shield },
  { name: 'Organization', href: '/tenant-settings', icon: Building },
]

// Local storage key for selected organization
const ORG_STORAGE_KEY = 'tms_selected_org_id'

export default function Layout() {
  const location = useLocation()
  const navigate = useNavigate()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  // Close mobile menu on route change
  useEffect(() => {
    setMobileMenuOpen(false)
  }, [location.pathname])

  // Close mobile menu on resize to desktop
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 1024) {
        setMobileMenuOpen(false)
      }
    }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

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
      {/* Mobile overlay */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setMobileMenuOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Sidebar wrapper: hidden on mobile, shown on desktop; slides in on mobile when open */}
      <div className={`
        fixed inset-y-0 left-0 z-50 transition-transform duration-300 ease-in-out
        lg:translate-x-0 lg:static lg:z-auto
        ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
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
      </div>

      <div className="lg:pl-72 min-h-screen bg-theme-bg">
        {/* Top bar with mobile menu toggle and notification center */}
        <div className="sticky top-0 z-40 bg-theme-bg/80 backdrop-blur-sm border-b border-gray-200/50">
          <div className="flex items-center justify-between px-4 sm:px-6 lg:px-8 py-2">
            {/* Mobile menu toggle */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="lg:hidden p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
              aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>

            {/* Mobile page title */}
            <span className="lg:hidden text-sm font-semibold text-gray-700 truncate">
              {navigation.find(n => n.href === location.pathname)?.name || 'TMS'}
            </span>

            <div className="flex items-center gap-2">
              <NotificationCenter />
            </div>
          </div>
        </div>
        <main className="p-4 sm:p-6 lg:p-8">
          <Outlet context={{ selectedOrgId: currentOrg?.id ?? null }} />
        </main>
      </div>
    </div>
  )
}
