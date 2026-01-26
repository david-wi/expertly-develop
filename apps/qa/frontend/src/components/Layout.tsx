import React, { ReactNode, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  LayoutDashboard,
  FolderKanban,
  Zap,
  Menu,
  X,
  LogOut,
  Building2,
} from 'lucide-react'
import clsx from 'clsx'
import { useAuth } from '../contexts/AuthContext'
import { Sidebar as SharedSidebar, SupportedLanguage } from '@expertly/ui'

interface LayoutProps {
  children: ReactNode
}

export default function Layout({ children }: LayoutProps) {
  const { t, i18n } = useTranslation()
  const location = useLocation()
  const navigate = useNavigate()
  const { user, logout } = useAuth()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const navItems = [
    { name: t('nav.dashboard'), href: '/', icon: LayoutDashboard },
    { name: t('nav.projects'), href: '/projects', icon: FolderKanban },
    { name: t('nav.quickStart'), href: '/quick-start', icon: Zap },
  ]

  const handleLanguageChange = (lang: SupportedLanguage) => {
    i18n.changeLanguage(lang)
  }

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  return (
    <div className="min-h-screen bg-gray-50">
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
          user={user ? { name: user.full_name, role: user.role } : undefined}
          currentLanguage={i18n.language as SupportedLanguage}
          onLanguageChange={handleLanguageChange}
          bottomSection={
            <div className="p-4 space-y-2">
              {user && (
                <div className="flex items-center gap-2 px-3 py-2 text-sm text-gray-600">
                  <Building2 className="w-4 h-4" />
                  <span className="truncate">{user.organization.name}</span>
                </div>
              )}
              <button
                onClick={handleLogout}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg"
              >
                <LogOut className="w-4 h-4" />
                {t('auth.logout', 'Sign out')}
              </button>
            </div>
          }
          renderLink={({ href, className, children }: { href: string; className: string; children: React.ReactNode }) => (
            <Link
              to={href}
              onClick={() => setSidebarOpen(false)}
              className={className}
            >
              {children}
            </Link>
          )}
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
      <div className="lg:pl-64">
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
