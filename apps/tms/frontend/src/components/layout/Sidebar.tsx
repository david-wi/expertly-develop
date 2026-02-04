import { Link, useLocation } from 'react-router-dom'
import {
  LayoutDashboard,
  Inbox,
  FileText,
  Truck,
  Send,
  Users,
  Building2,
  Receipt,
  BarChart3,
  Settings,
} from 'lucide-react'

const navigation = [
  { name: 'Dashboard', href: '/', icon: LayoutDashboard },
  { name: 'Inbox', href: '/inbox', icon: Inbox },
  { name: 'Quote Requests', href: '/quote-requests', icon: FileText },
  { name: 'Shipments', href: '/shipments', icon: Truck },
  { name: 'Dispatch Board', href: '/dispatch', icon: Send },
  { name: 'Customers', href: '/customers', icon: Users },
  { name: 'Carriers', href: '/carriers', icon: Building2 },
  { name: 'Invoices', href: '/invoices', icon: Receipt },
  { name: 'Margins', href: '/margins', icon: BarChart3 },
  { name: 'Settings', href: '/settings', icon: Settings },
]

export default function Sidebar() {
  const location = useLocation()

  return (
    <div className="w-64 bg-white border-r border-gray-200 flex flex-col">
      {/* Logo */}
      <div className="h-16 flex items-center px-6 border-b border-gray-200">
        <h1 className="text-xl font-bold text-emerald-600">Expertly TMS</h1>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-1">
        {navigation.map((item) => {
          const isActive = location.pathname === item.href ||
            (item.href !== '/' && location.pathname.startsWith(item.href))
          return (
            <Link
              key={item.name}
              to={item.href}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-emerald-50 text-emerald-700'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
              }`}
            >
              <item.icon className="h-5 w-5" />
              {item.name}
            </Link>
          )
        })}
      </nav>

      {/* User section */}
      <div className="p-4 border-t border-gray-200">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-full bg-emerald-100 flex items-center justify-center">
            <span className="text-sm font-medium text-emerald-600">U</span>
          </div>
          <div className="text-sm">
            <div className="font-medium text-gray-900">User</div>
            <div className="text-gray-500">Broker</div>
          </div>
        </div>
      </div>
    </div>
  )
}
