import { useState, useEffect, useCallback } from 'react'
import { Outlet, Link, useLocation } from 'react-router-dom'
import {
  LayoutDashboard,
  FolderKanban,
  ListTodo,
  FileBox,
  Play,
} from 'lucide-react'
import OrganizationSwitcher from './OrganizationSwitcher'
import { usersApi, CurrentUser, TENANT_STORAGE_KEY } from '../../api/client'

const navigation = [
  { name: 'Dashboard', href: '/', icon: LayoutDashboard },
  { name: 'Projects', href: '/projects', icon: FolderKanban },
  { name: 'Job Queue', href: '/jobs', icon: ListTodo },
  { name: 'Artifacts', href: '/artifacts', icon: FileBox },
  { name: 'New Walkthrough', href: '/walkthroughs/new', icon: Play },
]

export default function Layout() {
  const location = useLocation()
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)

  const fetchCurrentUser = useCallback(async () => {
    try {
      const user = await usersApi.me()
      setCurrentUser(user)
    } catch (error) {
      console.error('Failed to fetch current user:', error)
    }
  }, [])

  useEffect(() => {
    fetchCurrentUser()
  }, [fetchCurrentUser, refreshKey])

  const handleOrgSwitch = () => {
    setRefreshKey((k) => k + 1)
    // Force reload the page to refresh all data
    window.location.reload()
  }

  const currentTenantId = localStorage.getItem(TENANT_STORAGE_KEY) || currentUser?.tenant.id || null

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Sidebar */}
      <div className="fixed inset-y-0 left-0 z-50 w-64 bg-white shadow-lg">
        {/* Logo */}
        <div className="flex h-16 items-center gap-2 px-6 border-b">
          <div className="w-8 h-8 bg-primary-600 rounded-lg flex items-center justify-center">
            <span className="text-white font-bold text-lg">E</span>
          </div>
          <span className="font-semibold text-gray-900">Expertly Develop</span>
        </div>

        {/* Organization Switcher */}
        <div className="mt-4 relative">
          <OrganizationSwitcher
            currentTenantId={currentTenantId}
            onSwitch={handleOrgSwitch}
          />
        </div>

        {/* Navigation */}
        <nav className="mt-2 px-3">
          <ul className="space-y-1">
            {navigation.map((item) => {
              const isActive = location.pathname === item.href ||
                (item.href !== '/' && location.pathname.startsWith(item.href))

              return (
                <li key={item.name}>
                  <Link
                    to={item.href}
                    className={`
                      flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium
                      transition-colors duration-150
                      ${isActive
                        ? 'bg-primary-50 text-primary-700'
                        : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                      }
                    `}
                  >
                    <item.icon className="w-5 h-5" />
                    {item.name}
                  </Link>
                </li>
              )
            })}
          </ul>
        </nav>

        {/* User */}
        <div className="absolute bottom-0 left-0 right-0 p-4 border-t bg-gray-50">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-primary-100 rounded-full flex items-center justify-center">
              <span className="text-primary-700 font-medium text-sm">
                {currentUser?.name?.charAt(0) || 'U'}
              </span>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-900">{currentUser?.name || 'Loading...'}</p>
              <p className="text-xs text-gray-500 capitalize">{currentUser?.role || ''}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="pl-64">
        <main className="p-8">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
