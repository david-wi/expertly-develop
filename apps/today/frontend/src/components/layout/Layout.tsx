import type { ReactNode } from 'react';
import { Sidebar } from './Sidebar';

interface LayoutProps {
  children: ReactNode;
}

export function Layout({ children }: LayoutProps) {
  return (
    <div className="min-h-screen bg-theme-bg">
      <Sidebar />
      <div className="pl-64">
        <main className="p-8">{children}</main>
      </div>
    </div>
  );
}
