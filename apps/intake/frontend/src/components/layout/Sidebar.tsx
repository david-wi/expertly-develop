import { useCallback, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  ClipboardList,
  LayoutTemplate,
  Mic,
  BarChart3,
  Settings,
} from 'lucide-react';
import {
  Sidebar as SharedSidebar,
  formatBuildTimestamp,
  useCurrentUser,
  createDefaultUserMenu,
} from '@expertly/ui';
import { api } from '../../api/client';

const navigation = [
  { name: 'Intakes', href: '/intakes', icon: ClipboardList },
  { name: 'Templates', href: '/admin/templates', icon: LayoutTemplate },
  { name: 'Voices', href: '/admin/voices', icon: Mic },
  { name: 'Usage', href: '/admin/usage', icon: BarChart3 },
  { name: 'Settings', href: '/settings', icon: Settings },
];

export function Sidebar() {
  const location = useLocation();
  const navigate = useNavigate();

  const fetchCurrentUser = useCallback(() => api.auth.me(), []);
  const { sidebarUser } = useCurrentUser(fetchCurrentUser);

  const handleLogout = useCallback(() => {
    window.location.href = 'https://identity.ai.devintensive.com/login';
  }, []);

  const userMenu = useMemo(
    () =>
      createDefaultUserMenu({
        onLogout: handleLogout,
        buildTimestamp: import.meta.env.VITE_BUILD_TIMESTAMP,
        gitCommit: import.meta.env.VITE_GIT_COMMIT,
        currentAppCode: 'intake',
      }),
    [handleLogout],
  );

  return (
    <SharedSidebar
      productCode="intake"
      productName="Intake"
      navigation={navigation}
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
      navigate={navigate}
    />
  );
}
