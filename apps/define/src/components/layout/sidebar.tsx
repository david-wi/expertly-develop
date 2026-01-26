'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, FolderTree, Package, Settings } from 'lucide-react';
import { Sidebar as SharedSidebar, ThemeProvider } from '@expertly/ui';
import type { ReactNode } from 'react';

const navigation = [
  { name: 'Dashboard', href: '/', icon: Home },
  { name: 'Products', href: '/products', icon: FolderTree },
  { name: 'Releases', href: '/releases', icon: Package },
  { name: 'Settings', href: '/settings', icon: Settings },
];

// Next.js Link wrapper for the shared Sidebar component
function renderLink({ href, className, children }: { href: string; className: string; children: ReactNode }) {
  return (
    <Link href={href} className={className}>
      {children}
    </Link>
  );
}

export function Sidebar() {
  const pathname = usePathname();

  return (
    <ThemeProvider>
      <SharedSidebar
        productCode="define"
        productName="Expertly Define"
        navigation={navigation}
        currentPath={pathname}
        renderLink={renderLink}
        showThemeSwitcher={true}
      />
    </ThemeProvider>
  );
}
