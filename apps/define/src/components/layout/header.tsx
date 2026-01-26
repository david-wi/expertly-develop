'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSession, signOut } from 'next-auth/react';
import { Play, Home, FolderTree, Package, Settings, LogOut, User } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

const navigation = [
  { name: 'Dashboard', href: '/', icon: Home },
  { name: 'Products', href: '/products', icon: FolderTree },
  { name: 'Releases', href: '/releases', icon: Package },
];

export function Header() {
  const pathname = usePathname();
  const { data: session } = useSession();

  return (
    <header className="sticky top-0 z-40 w-full border-b border-gray-200 bg-white">
      <div className="flex h-16 items-center px-6">
        <Link href="/" className="flex items-center gap-2 mr-8">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-purple-600">
            <Play className="h-4 w-4 text-white fill-white" />
          </div>
          <span className="text-xl font-semibold">
            <span className="text-gray-900">Expertly</span>
            <span className="font-bold">Define</span>
          </span>
        </Link>

        <nav className="flex items-center gap-1">
          {navigation.map((item) => {
            const isActive = pathname === item.href ||
              (item.href !== '/' && pathname.startsWith(item.href));
            return (
              <Link
                key={item.name}
                href={item.href}
                className={cn(
                  'flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-purple-50 text-purple-700'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                )}
              >
                <item.icon className="h-4 w-4" />
                {item.name}
              </Link>
            );
          })}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <Link
            href="/settings"
            className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 hover:text-gray-900 transition-colors"
          >
            <Settings className="h-4 w-4" />
          </Link>
          {session?.user && (
            <>
              <div className="flex items-center gap-2 px-3 py-2 text-sm text-gray-600">
                <User className="h-4 w-4" />
                <span>{session.user.name || session.user.email}</span>
              </div>
              <button
                onClick={() => signOut({ callbackUrl: '/login' })}
                className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 hover:text-gray-900 transition-colors"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
