import { Link, useLocation } from 'react-router-dom';
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
import { Sidebar as SharedSidebar, formatBuildTimestamp } from 'expertly_ui/index';
import { useAuthStore } from '../../stores/authStore';

const navItems = [
  { name: 'Calendar', href: '/', icon: Calendar },
  { name: 'Clients', href: '/clients', icon: Users },
  { name: 'Staff', href: '/staff', icon: UserCircle },
  { name: 'Services', href: '/services', icon: Scissors },
  { name: 'Waitlist', href: '/waitlist', icon: Clock },
  { name: 'Promotions', href: '/promotions', icon: Gift },
  { name: 'Website', href: '/website', icon: Globe },
  { name: 'Reports', href: '/reports', icon: BarChart3 },
  { name: 'Settings', href: '/settings', icon: Settings },
];

export function Sidebar() {
  const location = useLocation();
  const { salon, logout } = useAuthStore();

  return (
    <SharedSidebar
      productCode="salon"
      productName="Salon"
      navigation={navItems}
      currentPath={location.pathname}
      user={salon ? { name: salon.name } : undefined}
      buildInfo={
        formatBuildTimestamp(import.meta.env.VITE_BUILD_TIMESTAMP) && (
          <span className="text-[10px] text-gray-400 block text-right">
            {formatBuildTimestamp(import.meta.env.VITE_BUILD_TIMESTAMP)}
          </span>
        )
      }
      bottomSection={
        <div className="p-4">
          <button
            onClick={logout}
            className="flex items-center gap-3 px-4 py-2.5 w-full rounded-lg text-gray-600 hover:bg-gray-100 hover:text-gray-800 transition-colors"
          >
            <LogOut className="w-5 h-5" />
            <span className="font-medium">Logout</span>
          </button>
        </div>
      }
      renderLink={({ href, className, children }) => (
        <Link to={href} className={className}>
          {children}
        </Link>
      )}
    />
  );
}
