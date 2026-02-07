import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import {
  ClipboardList,
  LayoutTemplate,
  Mic,
  BarChart3,
  Settings,
  LogOut,
} from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';

// ---------------------------------------------------------------------------
// Navigation items
// ---------------------------------------------------------------------------

interface NavItem {
  label: string;
  to: string;
  icon: React.ComponentType<{ className?: string }>;
}

const navItems: NavItem[] = [
  { label: 'Intakes', to: '/intakes', icon: ClipboardList },
  { label: 'Templates', to: '/admin/templates', icon: LayoutTemplate },
  { label: 'Voices', to: '/admin/voices', icon: Mic },
  { label: 'Usage', to: '/admin/usage', icon: BarChart3 },
  { label: 'Settings', to: '/settings', icon: Settings },
];

// ---------------------------------------------------------------------------
// Layout
// ---------------------------------------------------------------------------

export default function Layout() {
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const navigate = useNavigate();

  function handleLogout() {
    logout();
    navigate('/login');
  }

  return (
    <div className="flex h-screen bg-gray-50">
      {/* ── Sidebar ───────────────────────────────────────────────────── */}
      <aside className="flex flex-col w-60 bg-white border-r border-gray-200">
        {/* Logo */}
        <div className="flex items-center h-14 px-5 border-b border-gray-200 shrink-0">
          <span className="text-lg font-bold text-indigo-600">
            Expertly Intake
          </span>
        </div>

        {/* Nav links */}
        <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-1">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/intakes'}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-indigo-50 text-indigo-700'
                    : 'text-gray-700 hover:bg-gray-100 hover:text-gray-900'
                }`
              }
            >
              <item.icon className="h-5 w-5 shrink-0" />
              {item.label}
            </NavLink>
          ))}
        </nav>

        {/* User info + logout */}
        <div className="border-t border-gray-200 p-4 shrink-0">
          {user && (
            <div className="mb-3">
              <p className="text-sm font-medium text-gray-900 truncate">
                {user.name}
              </p>
              <p className="text-xs text-gray-500 truncate">{user.email}</p>
            </div>
          )}
          <button
            onClick={handleLogout}
            className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm
                       text-gray-600 hover:bg-gray-100 hover:text-gray-900 transition-colors"
          >
            <LogOut className="h-4 w-4" />
            Sign out
          </button>
        </div>
      </aside>

      {/* ── Main content ──────────────────────────────────────────────── */}
      <main className="flex-1 overflow-y-auto">
        <Outlet />
      </main>
    </div>
  );
}
