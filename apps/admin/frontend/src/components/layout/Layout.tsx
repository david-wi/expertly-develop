import { Outlet, Link, useLocation } from 'react-router-dom'
import { LayoutDashboard, Palette, ChevronDown, Sun, Moon } from 'lucide-react'
import { useState, useEffect } from 'react'

const navigation = [
  { name: 'Dashboard', href: '/', icon: LayoutDashboard },
  { name: 'Themes', href: '/themes', icon: Palette },
]

const EXPERTLY_PRODUCTS = [
  { name: 'Admin', code: 'admin', href: '#', icon: 'gear', description: 'System administration', current: true },
  { name: 'Define', code: 'define', href: 'http://expertly-define.152.42.152.243.sslip.io', icon: 'clipboard', description: 'Requirements management' },
  { name: 'Develop', code: 'develop', href: 'http://expertly-develop.152.42.152.243.sslip.io', icon: 'wrench', description: 'Visual walkthroughs' },
  { name: 'Manage', code: 'manage', href: 'http://expertly-manage.152.42.152.243.sslip.io', icon: 'chart', description: 'Task management' },
  { name: 'Today', code: 'today', href: 'http://expertly-today.152.42.152.243.sslip.io', icon: 'calendar', description: 'Daily workflow' },
]

function ExpertlyLogo({ className = 'w-8 h-8' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 33 33" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M14.8379 24.9606C16.6714 22.9391 17.9566 20.4822 18.571 17.8238L24.2667 20.4657C24.3728 20.4481 24.4733 20.4064 24.5606 20.3436C24.6478 20.2809 24.7194 20.1989 24.7698 20.104C24.8201 20.0091 24.8479 19.9039 24.8509 19.7965C24.8539 19.6892 24.832 19.5826 24.7871 19.485L19.4266 8.14301C19.3632 8.00575 19.2699 7.88442 19.1535 7.78793C19.037 7.69144 18.9004 7.62224 18.7537 7.58542C18.607 7.5486 18.4539 7.54509 18.3057 7.57515C18.1574 7.60521 18.0178 7.66808 17.897 7.75913L7.63363 15.6497C7.10981 16.0196 7.36125 16.9409 7.98285 16.92L14.0452 16.6931C14.0452 16.6931 13.2106 20.2912 8.35301 22.0047L8.27269 22.0326C2.61541 23.4285 -0.000202179 18.7452 -0.000202179 15.7509C-0.00718689 7.22169 7.2006 0.699166 15.1173 0.0570345C17.8181 -0.167956 20.5328 0.274916 23.0218 1.34656C25.5108 2.41821 27.6976 4.08568 29.3891 6.2018C31.0806 8.31791 32.2249 10.8176 32.7209 13.4803C33.2169 16.1429 33.0494 18.8867 32.2332 21.4693C31.4169 24.0519 29.9771 26.3941 28.0407 28.289C26.1043 30.184 23.7309 31.5734 21.13 32.3347C18.5291 33.096 15.7807 33.2058 13.1273 32.6544C10.4738 32.103 7.99705 30.9073 5.91549 29.1728C9.17716 28.7959 12.4772 27.6408 14.8379 24.9606Z" fill="url(#paint0_linear_expertly)"/>
      <defs>
        <linearGradient id="paint0_linear_expertly" x1="32.9998" y1="33" x2="-6.71734" y2="18.8377" gradientUnits="userSpaceOnUse">
          <stop stopColor="#9648FF"/>
          <stop offset="1" stopColor="#2C62F9"/>
        </linearGradient>
      </defs>
    </svg>
  )
}

export function Layout() {
  const location = useLocation()
  const [showProductSwitcher, setShowProductSwitcher] = useState(false)
  const [isDark, setIsDark] = useState(() => {
    if (typeof window !== 'undefined') {
      return document.documentElement.classList.contains('dark')
    }
    return false
  })

  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
  }, [isDark])

  return (
    <div className="min-h-screen bg-theme-bg">
      {/* Sidebar */}
      <div className="fixed inset-y-0 left-0 z-50 w-64 bg-theme-bg-surface shadow-lg flex flex-col overflow-hidden">
        {/* Logo / Product Switcher */}
        <div className="relative flex-shrink-0">
          <div className="flex h-14 items-center justify-between px-4 border-b border-theme-border">
            <button
              onClick={() => setShowProductSwitcher(!showProductSwitcher)}
              className="flex items-center gap-2 hover:bg-theme-bg-elevated -ml-1 px-1.5 py-1 rounded-lg transition-colors min-w-0"
            >
              <ExpertlyLogo className="w-7 h-7 flex-shrink-0" />
              <span className="font-semibold text-theme-text-primary truncate text-sm">Admin</span>
              <ChevronDown className={`w-4 h-4 text-theme-text-muted transition-transform flex-shrink-0 ${showProductSwitcher ? 'rotate-180' : ''}`} />
            </button>

            {/* Dark Mode Toggle */}
            <button
              onClick={() => setIsDark(!isDark)}
              className="p-1.5 rounded-lg hover:bg-theme-bg-elevated transition-colors"
              title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
            >
              {isDark ? <Sun className="w-5 h-5 text-theme-text-secondary" /> : <Moon className="w-5 h-5 text-theme-text-secondary" />}
            </button>
          </div>

          {/* Product Dropdown */}
          {showProductSwitcher && (
            <>
              <div
                className="fixed inset-0 z-40"
                onClick={() => setShowProductSwitcher(false)}
              />
              <div className="fixed left-0 top-14 w-64 bg-theme-bg-surface border border-theme-border rounded-b-lg shadow-lg z-50 max-h-[calc(100vh-4rem)] overflow-y-auto">
                <div className="p-2">
                  <p className="px-3 py-2 text-xs font-medium text-theme-text-muted uppercase">Switch Product</p>
                  {EXPERTLY_PRODUCTS.map((product) => (
                    <a
                      key={product.code}
                      href={product.href}
                      className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                        product.current
                          ? 'bg-primary-50 text-primary-700 dark:bg-primary-900/50 dark:text-primary-300'
                          : 'text-theme-text-secondary hover:bg-theme-bg-elevated'
                      }`}
                      onClick={() => setShowProductSwitcher(false)}
                    >
                      <div className="w-8 h-8 bg-primary-600 rounded-lg flex items-center justify-center">
                        <span className="text-white text-sm">
                          {product.name.charAt(0)}
                        </span>
                      </div>
                      <div>
                        <p className="font-medium">{product.name}</p>
                        <p className="text-xs text-theme-text-muted">{product.description}</p>
                      </div>
                    </a>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Navigation */}
        <nav className="px-3 py-4 flex-1 min-h-0 overflow-y-auto">
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
                        ? 'bg-primary-50 text-primary-700 dark:bg-primary-900/50 dark:text-primary-300'
                        : 'text-theme-text-secondary hover:bg-theme-bg-elevated'
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
