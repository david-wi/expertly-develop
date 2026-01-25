import { Link, useLocation } from 'react-router-dom';
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
import { Sidebar as SharedSidebar } from '@expertly/ui';

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

  return (
    <SharedSidebar
      productCode="today"
      productName="Today"
      navigation={navigation}
      currentPath={location.pathname}
      user={{ name: 'Claude', role: 'AI Assistant' }}
      renderLink={({ href, className, children }) => (
        <Link to={href} className={className}>
          {children}
        </Link>
      )}
    />
  );
}
