import { ReactNode, useState, useCallback, useMemo } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  LayoutDashboard,
  FolderKanban,
  Zap,
  Menu,
  X,
} from 'lucide-react'
import clsx from 'clsx'
import { useAuth } from '../contexts/AuthContext'
import { Sidebar as SharedSidebar, SupportedLanguage, formatBuildTimestamp, useCurrentUser, useOrganizations, createDefaultUserMenu, useSidebarCollapsed, type CurrentUser } from '@expertly/ui'
import { authApi, TENANT_STORAGE_KEY } from '../api/client'

interface LayoutProps {
  children: ReactNode
}

export default function Layout({ children }: LayoutProps) {
  const { t, i18n } = useTranslation()
  const location = useLocation()
  const navigate = useNavigate()
  const { logout } = useAuth()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [sidebarCollapsed] = useSidebarCollapsed()

  // Use shared hook for consistent user fetching
  const fetchCurrentUser = useCallback(async (): Promise<CurrentUser> => {
    const user = await authApi.me()
    return {
      id: user.id,
      name: user.full_name,
      email: user.email,
      role: user.role,
      organization_id: user.organization?.id || null,
      organization_name: user.organization?.name || null,
    }
  }, [])
  const { sidebarUser } = useCurrentUser(fetchCurrentUser)

  // Use shared organizations hook
  const { organizationsConfig, currentOrg } = useOrganizations({
    storageKey: TENANT_STORAGE_KEY,
  })

  const navItems = [
    { name: t('nav.dashboard'), href: '/', icon: LayoutDashboard },
    { name: t('nav.projects'), href: '/projects', icon: FolderKanban },
    { name: t('nav.quickStart'), href: '/quick-start', icon: Zap },
  ]

  const handleLanguageChange = (lang: SupportedLanguage) => {
    i18n.changeLanguage(lang)
  }

  const handleLogout = useCallback(() => {
    logout()
    navigate('/login')
  }, [logout, navigate])

  // Get current organization name for user display
  const userWithOrg = sidebarUser
    ? { ...sidebarUser, organization: sidebarUser.organization || currentOrg?.name }
    : undefined

  // Create user menu config with centralized organization switcher
  const userMenu = useMemo(() => createDefaultUserMenu({
    onLogout: handleLogout,
    buildTimestamp: import.meta.env.VITE_BUILD_TIMESTAMP,
    gitCommit: import.meta.env.VITE_GIT_COMMIT,
    currentAppCode: 'vibetest',
    organizations: organizationsConfig,
  }), [handleLogout, organizationsConfig])

  return (
    <div className="min-h-screen bg-theme-bg">
      {/* Mobile sidebar backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar - Desktop: always visible, Mobile: togglable */}
      <div className={clsx(
        'fixed top-0 left-0 z-50 h-full transform transition-transform duration-200 lg:translate-x-0',
        sidebarOpen ? 'translate-x-0' : '-translate-x-full'
      )}>
        <SharedSidebar
          productCode="qa"
          productName="VibeTest"
          navigation={navItems}
          currentPath={location.pathname}
          user={userWithOrg}
          currentLanguage={i18n.language as SupportedLanguage}
          onLanguageChange={handleLanguageChange}
          buildInfo={
            formatBuildTimestamp(import.meta.env.VITE_BUILD_TIMESTAMP) && (
              <span className="text-[10px] text-gray-400 block text-right">
                {formatBuildTimestamp(import.meta.env.VITE_BUILD_TIMESTAMP)}
              </span>
            )
          }
          userMenu={userMenu}
          navigate={navigate}
        />
        {/* Mobile close button */}
        <button
          className="lg:hidden absolute top-4 right-4 p-2 text-gray-500 hover:text-gray-700"
          onClick={() => setSidebarOpen(false)}
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Main content */}
      <div className={`${sidebarCollapsed ? 'lg:pl-16' : 'lg:pl-72'} transition-[padding] duration-200 ease-in-out`}>
        {/* Top bar - mobile only */}
        <header className="sticky top-0 z-30 bg-white border-b border-gray-200 lg:hidden">
          <div className="flex items-center justify-between h-16 px-4">
            <button
              className="p-2 text-gray-500 hover:text-gray-700"
              onClick={() => setSidebarOpen(true)}
            >
              <Menu className="w-5 h-5" />
            </button>
            <span className="font-semibold text-gray-900">Expertly VibeTest</span>
            <div className="w-9" /> {/* Spacer for centering */}
          </div>
        </header>

        {/* Page content */}
        <main className="p-4 lg:p-8">{children}</main>
      </div>
    </div>
  )
}
