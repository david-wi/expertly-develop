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
import { Sidebar, formatBuildTimestamp, useCurrentUser, useOrganizations, createDefaultUserMenu, useSidebarCollapsed } from '@expertly/ui'
import { api } from '../../services/api'
import NotificationCenter from '../NotificationCenter'
import MobileBottomNav from './MobileBottomNav'

const navigation = [
  { name: 'Dashboard', href: '/', icon: LayoutDashboard },
  { name: 'Inbox', href: '/inbox', icon: Inbox, tooltip: 'Inbound emails, rate requests, and tasks needing attention' },
  { name: 'Quote Requests', href: '/quote-requests', icon: FileText, tooltip: 'Customer requests for shipping rates and pricing' },
  { name: 'Shipments', href: '/shipments', icon: Truck, tooltip: 'Booked loads and their pickup/delivery status' },
  { name: 'Dispatch Board', href: '/dispatch', icon: Send, tooltip: 'Assign carriers to shipments and manage pickups' },
  { name: 'Customers', href: '/customers', icon: Users, spacerBefore: true },
  { name: 'Carriers', href: '/carriers', icon: Building2, tooltip: 'Trucking companies and their lanes, rates, and compliance' },
  { name: 'Load Boards', href: '/loadboards', icon: Radio, tooltip: 'Browse available loads from external load boards' },
  { name: 'Invoices', href: '/invoices', icon: Receipt },
  { name: 'Approvals', href: '/approvals', icon: CheckSquare, tooltip: 'Quotes, rate changes, and other items pending your approval' },
  { name: 'Margins', href: '/margins', icon: BarChart3, spacerBefore: true, tooltip: 'Profit analysis across shipments, customers, and lanes' },
  { name: 'Carrier Performance', href: '/carrier-performance', icon: Trophy, tooltip: 'On-time delivery, claims, and carrier scorecards' },
  { name: 'Operations Metrics', href: '/operations-metrics', icon: Activity, tooltip: 'KPIs for load volume, revenue, and operational efficiency' },
  { name: 'Lane Intelligence', href: '/lane-intelligence', icon: Map, tooltip: 'Historical lane data, rate trends, and market insights' },
  { name: 'Document Review', href: '/document-review', icon: FolderSearch, tooltip: 'Review and verify uploaded BOLs, PODs, and rate confirmations' },
  { name: 'Document Inbox', href: '/document-inbox', icon: FileInput, tooltip: 'Incoming documents waiting to be classified and linked to shipments' },
  { name: 'Billing', href: '/billing', icon: DollarSign, tooltip: 'Invoice matching, carrier payables, and billing reconciliation' },
  { name: 'EDI', href: '/edi', icon: ArrowLeftRight, spacerBefore: true, tooltip: 'Electronic data interchange with carriers and trading partners' },
  { name: 'Rate Tables', href: '/rate-tables', icon: Table2, tooltip: 'Customer and carrier rate agreements and pricing rules' },
  { name: 'Communications', href: '/communications', icon: MessageSquare, tooltip: 'Email templates, check calls, and message history' },
  { name: 'Settings', href: '/settings', icon: Settings, spacerBefore: true },
  { name: 'Desks', href: '/desks', icon: LayoutGrid, tooltip: 'Team workspaces organized by region, mode, or customer' },
  { name: 'Automations', href: '/automations', icon: Zap, tooltip: 'Rules that auto-assign carriers, send alerts, or trigger actions' },
  { name: 'Roles', href: '/roles', icon: Shield, tooltip: 'Manage user roles and permissions' },
  { name: 'Organization', href: '/tenant-settings', icon: Building, tooltip: 'Company info, branding, custom fields, and user management' },
]

// Local storage key for selected organization
const ORG_STORAGE_KEY = 'tms_selected_org_id'

export default function Layout() {
  const location = useLocation()
  const navigate = useNavigate()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [sidebarCollapsed] = useSidebarCollapsed()

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

      {/* Sidebar wrapper: slides in on mobile; on desktop, no translate keeps
           Sidebar's fixed positioning relative to the viewport (not a containing block) */}
      <div className={`
        fixed inset-y-0 left-0 z-50
        max-lg:transition-transform max-lg:duration-300 max-lg:ease-in-out
        lg:static lg:z-auto
        ${mobileMenuOpen ? 'max-lg:translate-x-0' : 'max-lg:-translate-x-full'}
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

      <div className={`${sidebarCollapsed ? 'lg:pl-16' : 'lg:pl-72'} min-h-screen bg-theme-bg transition-[padding] duration-200 ease-in-out`}>
        {/* Top bar with mobile menu toggle and notification center */}
        <div className="sticky top-0 z-40 lg:z-[60] bg-theme-bg/80 backdrop-blur-sm border-b border-gray-200/50">
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
        <main className="p-4 sm:p-6 lg:p-8 pb-20 lg:pb-8">
          <Outlet context={{ selectedOrgId: currentOrg?.id ?? null }} />
        </main>
      </div>

      {/* Mobile bottom navigation */}
      <MobileBottomNav />
    </div>
  )
}
