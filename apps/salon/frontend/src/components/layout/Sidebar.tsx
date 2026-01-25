import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { clsx } from 'clsx';
import {
  Calendar,
  Users,
  Scissors,
  UserCircle,
  Settings,
  BarChart3,
  LogOut,
  Clock,
  Gift,
  Globe,
  ChevronDown,
} from 'lucide-react';
import { useAuthStore } from '../../stores/authStore';

const navItems = [
  { to: '/', icon: Calendar, label: 'Calendar' },
  { to: '/clients', icon: Users, label: 'Clients' },
  { to: '/staff', icon: UserCircle, label: 'Staff' },
  { to: '/services', icon: Scissors, label: 'Services' },
  { to: '/waitlist', icon: Clock, label: 'Waitlist' },
  { to: '/promotions', icon: Gift, label: 'Promotions' },
  { to: '/website', icon: Globe, label: 'Website' },
  { to: '/reports', icon: BarChart3, label: 'Reports' },
  { to: '/settings', icon: Settings, label: 'Settings' },
];

const EXPERTLY_PRODUCTS = [
  { name: 'Develop', code: 'develop', href: 'http://expertly-develop.152.42.152.243.sslip.io', color: 'bg-blue-600', description: 'Visual walkthroughs', icon: '🛠️' },
  { name: 'Define', code: 'define', href: 'http://expertly-define.152.42.152.243.sslip.io', color: 'bg-purple-600', description: 'Requirements management', icon: '📋' },
  { name: 'Manage', code: 'manage', href: 'http://expertly-manage.152.42.152.243.sslip.io', color: 'bg-green-600', description: 'Task management', icon: '📊' },
  { name: 'QA', code: 'qa', href: 'http://vibe-qa.152.42.152.243.sslip.io', color: 'bg-orange-600', description: 'Quality assurance', icon: '🧪' },
  { name: 'Salon', code: 'salon', href: 'http://expertly-salon.152.42.152.243.sslip.io', color: 'bg-pink-600', description: 'Booking platform', icon: '💇' },
  { name: 'Today', code: 'today', href: 'http://expertly-today.152.42.152.243.sslip.io', color: 'bg-teal-600', description: 'Daily workflow', icon: '📅' },
];

export function Sidebar() {
  const { salon, logout } = useAuthStore();
  const [showProductSwitcher, setShowProductSwitcher] = useState(false);

  return (
    <aside className="w-64 bg-white border-r border-warm-200 flex flex-col h-screen">
      {/* Product Switcher */}
      <div className="relative">
        <button
          onClick={() => setShowProductSwitcher(!showProductSwitcher)}
          className="w-full p-6 border-b border-warm-200 flex items-center justify-between hover:bg-warm-50 transition-colors"
        >
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-pink-600 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-lg">E</span>
            </div>
            <span className="text-xl font-semibold text-primary-500">
              {salon?.name || 'Expertly Salon'}
            </span>
          </div>
          <ChevronDown className={`w-4 h-4 text-warm-400 transition-transform ${showProductSwitcher ? 'rotate-180' : ''}`} />
        </button>

        {showProductSwitcher && (
          <div className="absolute top-full left-0 right-0 bg-white border-b border-warm-200 shadow-lg z-50 max-h-80 overflow-y-auto">
            <div className="p-2">
              <p className="px-3 py-2 text-xs font-medium text-warm-500 uppercase">Switch Product</p>
              {EXPERTLY_PRODUCTS.map((product) => (
                <a
                  key={product.code}
                  href={product.href}
                  className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                    product.code === 'salon'
                      ? 'bg-warm-100 text-warm-900'
                      : 'text-warm-600 hover:bg-warm-50 hover:text-warm-900'
                  }`}
                >
                  <div className={`w-8 h-8 ${product.color} rounded-lg flex items-center justify-center`}>
                    <span>{product.icon}</span>
                  </div>
                  <div>
                    <p className="font-medium">{product.name}</p>
                    <p className="text-xs text-warm-500">{product.description}</p>
                  </div>
                </a>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-1">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              clsx(
                'flex items-center gap-3 px-4 py-2.5 rounded-lg transition-colors',
                isActive
                  ? 'bg-primary-100 text-primary-700'
                  : 'text-warm-600 hover:bg-warm-100 hover:text-warm-800'
              )
            }
          >
            <item.icon className="w-5 h-5" />
            <span className="font-medium">{item.label}</span>
          </NavLink>
        ))}
      </nav>

      {/* Logout */}
      <div className="p-4 border-t border-warm-200">
        <button
          onClick={logout}
          className="flex items-center gap-3 px-4 py-2.5 w-full rounded-lg text-warm-600 hover:bg-warm-100 hover:text-warm-800 transition-colors"
        >
          <LogOut className="w-5 h-5" />
          <span className="font-medium">Logout</span>
        </button>
      </div>
    </aside>
  );
}
