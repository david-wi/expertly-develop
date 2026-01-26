'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { Header } from './header';

export function ConditionalWrapper({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isLandingPage = pathname === '/landing';

  return (
    <>
      {!isLandingPage && <Header />}
      <main className="min-h-[calc(100vh-4rem)]">
        {children}
      </main>
      {!isLandingPage && (
        <Link
          href="/landing"
          className="fixed bottom-4 right-4 px-3 py-2 bg-purple-600 text-white text-sm font-medium rounded-lg shadow-lg hover:bg-purple-700 transition-colors z-50"
        >
          View marketing page
        </Link>
      )}
    </>
  );
}
