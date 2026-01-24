import { Link, useLocation } from 'react-router-dom'
import { ChevronDown } from 'lucide-react'
import { useState } from 'react'

export interface NavItem {
  name: string
  href: string
  icon: React.ComponentType<{ className?: string }>
}

export interface ExpertlyProduct {
  name: string
  code: string
  href: string
  icon: React.ComponentType<{ className?: string }>
  color: string
  description: string
}

export const EXPERTLY_PRODUCTS: ExpertlyProduct[] = [
  {
    name: 'Develop',
    code: 'develop',
    href: '/develop',
    icon: () => <span className="text-lg">🛠️</span>,
    color: 'bg-blue-600',
    description: 'Visual walkthroughs',
  },
  {
    name: 'Define',
    code: 'define',
    href: '/define',
    icon: () => <span className="text-lg">📋</span>,
    color: 'bg-purple-600',
    description: 'Requirements management',
  },
  {
    name: 'Manage',
    code: 'manage',
    href: '/manage',
    icon: () => <span className="text-lg">📊</span>,
    color: 'bg-green-600',
    description: 'Task management',
  },
  {
    name: 'QA',
    code: 'qa',
    href: '/qa',
    icon: () => <span className="text-lg">🧪</span>,
    color: 'bg-orange-600',
    description: 'Quality assurance',
  },
  {
    name: 'Salon',
    code: 'salon',
    href: '/salon',
    icon: () => <span className="text-lg">💇</span>,
    color: 'bg-pink-600',
    description: 'Booking platform',
  },
  {
    name: 'Today',
    code: 'today',
    href: '/today',
    icon: () => <span className="text-lg">📅</span>,
    color: 'bg-teal-600',
    description: 'Daily workflow',
  },
]

export interface SidebarProps {
  productCode: string
  productName: string
  productColor?: string
  navigation: NavItem[]
  user?: {
    name: string
    role?: string
  }
  basePath?: string
  orgSwitcher?: React.ReactNode
}

export function Sidebar({
  productCode,
  productName,
  productColor = 'bg-primary-600',
  navigation,
  user,
  basePath = '',
  orgSwitcher,
}: SidebarProps) {
  const location = useLocation()
  const [showProductSwitcher, setShowProductSwitcher] = useState(false)

  const currentProduct = EXPERTLY_PRODUCTS.find(p => p.code === productCode)

  return (
    <div className="fixed inset-y-0 left-0 z-50 w-64 bg-white shadow-lg flex flex-col">
      {/* Logo / Product Switcher */}
      <div className="relative">
        <button
          onClick={() => setShowProductSwitcher(!showProductSwitcher)}
          className="w-full flex h-16 items-center justify-between gap-2 px-6 border-b hover:bg-gray-50 transition-colors"
        >
          <div className="flex items-center gap-2">
            <div className={`w-8 h-8 ${productColor} rounded-lg flex items-center justify-center`}>
              <span className="text-white font-bold text-lg">E</span>
            </div>
            <span className="font-semibold text-gray-900">Expertly {productName}</span>
          </div>
          <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${showProductSwitcher ? 'rotate-180' : ''}`} />
        </button>

        {/* Product Dropdown */}
        {showProductSwitcher && (
          <div className="absolute top-full left-0 right-0 bg-white border-b shadow-lg z-50 max-h-80 overflow-y-auto">
            <div className="p-2">
              <p className="px-3 py-2 text-xs font-medium text-gray-500 uppercase">Switch Product</p>
              {EXPERTLY_PRODUCTS.map((product) => (
                <a
                  key={product.code}
                  href={product.href}
                  className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                    product.code === productCode
                      ? 'bg-gray-100 text-gray-900'
                      : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                  }`}
                >
                  <div className={`w-8 h-8 ${product.color} rounded-lg flex items-center justify-center`}>
                    <product.icon />
                  </div>
                  <div>
                    <p className="font-medium">{product.name}</p>
                    <p className="text-xs text-gray-500">{product.description}</p>
                  </div>
                </a>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Organization Switcher (optional) */}
      {orgSwitcher && (
        <div className="mt-4 relative">
          {orgSwitcher}
        </div>
      )}

      {/* Navigation */}
      <nav className="mt-2 px-3 flex-1 overflow-y-auto">
        <ul className="space-y-1">
          {navigation.map((item) => {
            const fullHref = basePath + item.href
            const isActive = location.pathname === fullHref ||
              (item.href !== '/' && location.pathname.startsWith(fullHref))

            return (
              <li key={item.name}>
                <Link
                  to={fullHref}
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
      {user && (
        <div className="p-4 border-t bg-gray-50">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-primary-100 rounded-full flex items-center justify-center">
              <span className="text-primary-700 font-medium text-sm">
                {user.name?.charAt(0) || 'U'}
              </span>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-900">{user.name || 'Loading...'}</p>
              {user.role && <p className="text-xs text-gray-500 capitalize">{user.role}</p>}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export interface MainLayoutProps {
  children: React.ReactNode
}

export function MainLayout({ children }: MainLayoutProps) {
  return (
    <div className="min-h-screen bg-gray-50">
      {children}
    </div>
  )
}

export function MainContent({ children }: { children: React.ReactNode }) {
  return (
    <div className="pl-64">
      <main className="p-8">
        {children}
      </main>
    </div>
  )
}
