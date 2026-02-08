import type { ReactNode } from 'react';
import { useSidebarCollapsed } from '@expertly/ui';
import { Sidebar } from './Sidebar';

interface LayoutProps {
  children: ReactNode;
}

export function Layout({ children }: LayoutProps) {
  const [sidebarCollapsed] = useSidebarCollapsed();
  return (
    <div className="min-h-screen bg-theme-bg">
      <Sidebar />
      <div className={`${sidebarCollapsed ? 'pl-16' : 'pl-72'} transition-[padding] duration-200 ease-in-out`}>
        <main className="p-8">{children}</main>
      </div>
    </div>
  );
}
