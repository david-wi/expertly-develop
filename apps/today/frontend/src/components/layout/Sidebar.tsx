import { useCallback, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  CheckSquare,
  HelpCircle,
  FolderOpen,
  Users,
  Building2,
  BookOpen,
  FileText,
  Archive,
  Settings,
} from 'lucide-react';
import { Sidebar as SharedSidebar, formatBuildTimestamp, useCurrentUser, useOrganizations, createDefaultUserMenu } from '@expertly/ui';
import { api } from '../../services/api';

const navigation = [
  { name: 'Dashboard', href: '/', icon: LayoutDashboard },
  { name: 'Tasks', href: '/tasks', icon: CheckSquare },
  { name: 'Questions', href: '/questions', icon: HelpCircle },
  { name: 'Projects', href: '/projects', icon: FolderOpen },
  { name: 'People', href: '/people', icon: Users },
  { name: 'Clients', href: '/clients', icon: Building2 },
  { name: 'Playbooks', href: '/playbooks', icon: BookOpen },
  { name: 'Instructions', href: '/instructions', icon: FileText },
  { name: 'Artifacts', href: '/artifacts', icon: Archive },
  { name: 'Settings', href: '/settings', icon: Settings },
];

export function Sidebar() {
  const location = useLocation();
  const navigate = useNavigate();

  // Use shared hook for consistent user fetching - ensure name is never null for CurrentUser type
  const fetchCurrentUser = useCallback(async () => {
    const user = await api.getCurrentUser();
    return { ...user, name: user.name ?? user.email };
  }, []);
  const { sidebarUser } = useCurrentUser(fetchCurrentUser);

  // Use shared organizations hook
  const { organizationsConfig, currentOrg } = useOrganizations({
    storageKey: 'today_selected_org_id',
  });

  // Merge organization name into user display
  const userWithOrg = sidebarUser
    ? { ...sidebarUser, organization: sidebarUser.organization || currentOrg?.name }
    : undefined;

  const handleLogout = useCallback(() => {
    // Redirect to identity login
    window.location.href = 'https://identity.ai.devintensive.com/login';
  }, []);

  // Create user menu config with organization switcher
  const userMenu = useMemo(() => createDefaultUserMenu({
    onLogout: handleLogout,
    buildTimestamp: import.meta.env.VITE_BUILD_TIMESTAMP,
    gitCommit: import.meta.env.VITE_GIT_COMMIT,
    currentAppCode: 'today',
    organizations: organizationsConfig,
  }), [handleLogout, organizationsConfig]);

  return (
    <SharedSidebar
      productCode="today"
      productName="Today"
      navigation={navigation}
      currentPath={location.pathname}
      user={userWithOrg}
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
