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

export function Sidebar() {
  const { salon, logout } = useAuthStore();

  return (
    <aside className="w-64 bg-white border-r border-warm-200 flex flex-col h-screen">
      {/* Logo/Brand */}
      <div className="p-6 border-b border-warm-200">
        <h1 className="text-xl font-semibold text-primary-500">
          {salon?.name || 'Salon Booking'}
        </h1>
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
