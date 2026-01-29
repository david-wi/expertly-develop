import { useCallback, useMemo } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  Calendar,
  Users,
  Scissors,
  UserCircle,
  Settings,
  BarChart3,
  Clock,
  Gift,
  Globe,
} from 'lucide-react';
import { Sidebar as SharedSidebar, formatBuildTimestamp, useCurrentUser, createDefaultUserMenu, type CurrentUser } from '@expertly/ui';
import { useAuthStore } from '../../stores/authStore';
import { auth, salon } from '../../services/api';

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
  const { logout } = useAuthStore();

  // Use shared hook for consistent user fetching
  const fetchCurrentUser = useCallback(async (): Promise<CurrentUser> => {
    const [user, salonData] = await Promise.all([
      auth.me(),
      salon.getCurrent().catch(() => null),
    ]);
    return {
      id: user.id,
      name: `${user.first_name} ${user.last_name}`,
      email: user.email,
      role: user.role,
      organization_id: user.salon_id,
      organization_name: salonData?.name || null,
    };
  }, []);
  const { sidebarUser } = useCurrentUser(fetchCurrentUser);

  // Create user menu config
  const userMenu = useMemo(() => createDefaultUserMenu({
    onLogout: logout,
    buildTimestamp: import.meta.env.VITE_BUILD_TIMESTAMP,
    gitCommit: import.meta.env.VITE_GIT_COMMIT,
  }), [logout]);

  return (
    <SharedSidebar
      productCode="salon"
      productName="Salon"
      navigation={navItems}
      currentPath={location.pathname}
      user={sidebarUser}
      buildInfo={
        formatBuildTimestamp(import.meta.env.VITE_BUILD_TIMESTAMP) && (
          <span className="text-[10px] text-gray-400 block text-right">
            {formatBuildTimestamp(import.meta.env.VITE_BUILD_TIMESTAMP)}
          </span>
        )
      }
      userMenu={userMenu}
      renderLink={({ href, className, children, onClick }) => (
        <Link to={href} className={className} onClick={onClick}>
          {children}
        </Link>
      )}
    />
  );
}
