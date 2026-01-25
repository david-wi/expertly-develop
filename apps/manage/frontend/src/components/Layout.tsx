import { useState } from 'react'
import { Outlet, Link, useLocation } from 'react-router-dom'
import { ChevronDown } from 'lucide-react'

const navItems = [
  { path: '/', label: 'Dashboard' },
  { path: '/tasks', label: 'Tasks' },
  { path: '/queues', label: 'Queues' },
  { path: '/recurring', label: 'Recurring' },
  { path: '/users', label: 'Users' },
  { path: '/teams', label: 'Teams' },
]

const EXPERTLY_PRODUCTS = [
  { name: 'Develop', code: 'develop', href: 'http://expertly-develop.152.42.152.243.sslip.io', color: 'bg-blue-600', description: 'Visual walkthroughs', icon: '🛠️' },
  { name: 'Define', code: 'define', href: 'http://expertly-define.152.42.152.243.sslip.io', color: 'bg-purple-600', description: 'Requirements management', icon: '📋' },
  { name: 'Manage', code: 'manage', href: 'http://expertly-manage.152.42.152.243.sslip.io', color: 'bg-green-600', description: 'Task management', icon: '📊' },
  { name: 'QA', code: 'qa', href: 'http://vibe-qa.152.42.152.243.sslip.io', color: 'bg-orange-600', description: 'Quality assurance', icon: '🧪' },
  { name: 'Salon', code: 'salon', href: 'http://expertly-salon.152.42.152.243.sslip.io', color: 'bg-pink-600', description: 'Booking platform', icon: '💇' },
  { name: 'Today', code: 'today', href: 'http://expertly-today.152.42.152.243.sslip.io', color: 'bg-teal-600', description: 'Daily workflow', icon: '📅' },
]

export default function Layout() {
  const location = useLocation()
  const [showProductSwitcher, setShowProductSwitcher] = useState(false)

  return (
    <div className="min-h-screen flex flex-col">
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex">
              {/* Product Switcher */}
              <div className="relative flex-shrink-0 flex items-center">
                <button
                  onClick={() => setShowProductSwitcher(!showProductSwitcher)}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <div className="w-8 h-8 bg-green-600 rounded-lg flex items-center justify-center">
                    <span className="text-white font-bold text-lg">E</span>
                  </div>
                  <span className="text-xl font-bold text-gray-900">Expertly Manage</span>
                  <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${showProductSwitcher ? 'rotate-180' : ''}`} />
                </button>

                {showProductSwitcher && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setShowProductSwitcher(false)} />
                    <div className="absolute top-full left-0 mt-1 w-72 bg-white border border-gray-200 rounded-lg shadow-lg z-20">
                      <div className="p-2">
                        <p className="px-3 py-2 text-xs font-medium text-gray-500 uppercase">Switch Product</p>
                        {EXPERTLY_PRODUCTS.map((product) => (
                          <a
                            key={product.code}
                            href={product.href}
                            className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                              product.code === 'manage'
                                ? 'bg-gray-100 text-gray-900'
                                : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                            }`}
                          >
                            <div className={`w-8 h-8 ${product.color} rounded-lg flex items-center justify-center`}>
                              <span>{product.icon}</span>
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

              <nav className="ml-8 flex space-x-4">
                {navItems.map((item) => (
                  <Link
                    key={item.path}
                    to={item.path}
                    className={`inline-flex items-center px-3 py-2 text-sm font-medium rounded-md ${
                      location.pathname === item.path
                        ? 'bg-gray-100 text-gray-900'
                        : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                    }`}
                  >
                    {item.label}
                  </Link>
                ))}
              </nav>
            </div>
          </div>
        </div>
      </header>
      <main className="flex-1">
        <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
          <Outlet />
        </div>
      </main>
    </div>
  )
}
