import { useState, useEffect, useCallback } from 'react'
import { Outlet, Link, useLocation } from 'react-router-dom'
import {
  LayoutDashboard,
  FolderKanban,
  ListTodo,
  FileBox,
  Play,
  ChevronDown,
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

const EXPERTLY_PRODUCTS = [
  { name: 'Develop', code: 'develop', href: 'http://expertly-develop.152.42.152.243.sslip.io', color: 'bg-violet-600', description: 'Visual walkthroughs', icon: '🛠️' },
  { name: 'Define', code: 'define', href: 'http://expertly-define.152.42.152.243.sslip.io', color: 'bg-violet-600', description: 'Requirements management', icon: '📋' },
  { name: 'Manage', code: 'manage', href: 'http://expertly-manage.152.42.152.243.sslip.io', color: 'bg-violet-600', description: 'Task management', icon: '📊' },
  { name: 'QA', code: 'qa', href: 'http://vibe-qa.152.42.152.243.sslip.io', color: 'bg-violet-600', description: 'Quality assurance', icon: '🧪' },
  { name: 'Salon', code: 'salon', href: 'http://expertly-salon.152.42.152.243.sslip.io', color: 'bg-violet-600', description: 'Booking platform', icon: '💇' },
  { name: 'Today', code: 'today', href: 'http://expertly-today.152.42.152.243.sslip.io', color: 'bg-violet-600', description: 'Daily workflow', icon: '📅' },
]

// Expertly Logo SVG component
function ExpertlyLogo({ className = 'w-8 h-8' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 33 33" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M14.8379 24.9606C16.6714 22.9391 17.9566 20.4822 18.571 17.8238L24.2667 20.4657C24.3728 20.4481 24.4733 20.4064 24.5606 20.3436C24.6478 20.2809 24.7194 20.1989 24.7698 20.104C24.8201 20.0091 24.8479 19.9039 24.8509 19.7965C24.8539 19.6892 24.832 19.5826 24.7871 19.485L19.4266 8.14301C19.3632 8.00575 19.2699 7.88442 19.1535 7.78793C19.037 7.69144 18.9004 7.62224 18.7537 7.58542C18.607 7.5486 18.4539 7.54509 18.3057 7.57515C18.1574 7.60521 18.0178 7.66808 17.897 7.75913L7.63363 15.6497C7.10981 16.0196 7.36125 16.9409 7.98285 16.92L14.0452 16.6931C14.0452 16.6931 13.2106 20.2912 8.35301 22.0047L8.27269 22.0326C2.61541 23.4285 -0.000202179 18.7452 -0.000202179 15.7509C-0.00718689 7.22169 7.2006 0.699166 15.1173 0.0570345C17.8181 -0.167956 20.5328 0.274916 23.0218 1.34656C25.5108 2.41821 27.6976 4.08568 29.3891 6.2018C31.0806 8.31791 32.2249 10.8176 32.7209 13.4803C33.2169 16.1429 33.0494 18.8867 32.2332 21.4693C31.4169 24.0519 29.9771 26.3941 28.0407 28.289C26.1043 30.184 23.7309 31.5734 21.13 32.3347C18.5291 33.096 15.7807 33.2058 13.1273 32.6544C10.4738 32.103 7.99705 30.9073 5.91549 29.1728C9.17716 28.7959 12.4772 27.6408 14.8379 24.9606Z" fill="url(#paint0_linear_expertly_layout)"/>
      <defs>
        <linearGradient id="paint0_linear_expertly_layout" x1="32.9998" y1="33" x2="-6.71734" y2="18.8377" gradientUnits="userSpaceOnUse">
          <stop stopColor="#9648FF"/>
          <stop offset="1" stopColor="#2C62F9"/>
        </linearGradient>
      </defs>
    </svg>
  )
}

export default function Layout() {
  const location = useLocation()
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)
  const [showProductSwitcher, setShowProductSwitcher] = useState(false)

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
    window.location.reload()
  }

  const currentTenantId = localStorage.getItem(TENANT_STORAGE_KEY) || currentUser?.tenant.id || null

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Sidebar */}
      <div className="fixed inset-y-0 left-0 z-50 w-64 bg-white shadow-lg flex flex-col">
        {/* Logo / Product Switcher */}
        <div className="relative">
          <button
            onClick={() => setShowProductSwitcher(!showProductSwitcher)}
            className="w-full flex h-16 items-center justify-between gap-2 px-6 border-b hover:bg-gray-50 transition-colors"
          >
            <div className="flex items-center gap-3">
              <ExpertlyLogo className="w-8 h-8" />
              <span className="font-semibold text-gray-900">Expertly Develop</span>
            </div>
            <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${showProductSwitcher ? 'rotate-180' : ''}`} />
          </button>

          {/* Product Dropdown */}
          {showProductSwitcher && (
            <>
              <div
                className="fixed inset-0 z-40"
                onClick={() => setShowProductSwitcher(false)}
              />
              <div className="absolute top-full left-0 right-0 bg-white border-b shadow-lg z-50 max-h-80 overflow-y-auto">
                <div className="p-2">
                  <p className="px-3 py-2 text-xs font-medium text-gray-500 uppercase">Switch Product</p>
                  {EXPERTLY_PRODUCTS.map((product) => (
                    <a
                      key={product.code}
                      href={product.href}
                      className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                        product.code === 'develop'
                          ? 'bg-violet-50 text-violet-900'
                          : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                      }`}
                      onClick={() => setShowProductSwitcher(false)}
                    >
                      <div className={`w-8 h-8 ${product.color} rounded-lg flex items-center justify-center`}>
                        <span className="text-white">{product.icon}</span>
                      </div>
                      <div>
                        <p className="font-medium">{product.name}</p>
                        <p className="text-xs text-gray-500">{product.description}</p>
                      </div>
                    </a>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Organization Switcher */}
        <div className="mt-4 relative">
          <OrganizationSwitcher
            currentTenantId={currentTenantId}
            onSwitch={handleOrgSwitch}
          />
        </div>

        {/* Navigation */}
        <nav className="mt-2 px-3 flex-1 overflow-y-auto">
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
                        ? 'bg-violet-50 text-violet-700'
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
        <div className="p-4 border-t bg-gray-50">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-violet-100 rounded-full flex items-center justify-center">
              <span className="text-violet-700 font-medium text-sm">
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
