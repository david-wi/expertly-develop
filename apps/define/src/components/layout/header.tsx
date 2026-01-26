'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Play, Home, FolderTree, Package, Settings, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

const navigation = [
  { name: 'Dashboard', href: '/', icon: Home },
  { name: 'Products', href: '/products', icon: FolderTree },
  { name: 'Releases', href: '/releases', icon: Package },
];

const EXPERTLY_PRODUCTS = [
  { name: 'Develop', code: 'develop', href: 'http://expertly-develop.152.42.152.243.sslip.io', color: 'bg-blue-600', description: 'Visual walkthroughs', icon: '🛠️' },
  { name: 'Define', code: 'define', href: 'http://expertly-define.152.42.152.243.sslip.io', color: 'bg-purple-600', description: 'Requirements management', icon: '📋' },
  { name: 'Manage', code: 'manage', href: 'http://expertly-manage.152.42.152.243.sslip.io', color: 'bg-green-600', description: 'Task management', icon: '📊' },
  { name: 'QA', code: 'qa', href: 'http://vibe-qa.152.42.152.243.sslip.io', color: 'bg-orange-600', description: 'Quality assurance', icon: '🧪' },
  { name: 'Salon', code: 'salon', href: 'http://expertly-salon.152.42.152.243.sslip.io', color: 'bg-pink-600', description: 'Booking platform', icon: '💇' },
  { name: 'Today', code: 'today', href: 'http://expertly-today.152.42.152.243.sslip.io', color: 'bg-teal-600', description: 'Daily workflow', icon: '📅' },
];

export function Header() {
  const pathname = usePathname();
  const [showProductSwitcher, setShowProductSwitcher] = useState(false);

  return (
    <header className="sticky top-0 z-40 w-full border-b border-gray-200 bg-white">
      <div className="flex h-16 items-center px-6">
        {/* Product Switcher */}
        <div className="relative mr-8">
          <button
            onClick={() => setShowProductSwitcher(!showProductSwitcher)}
            className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-purple-600">
              <span className="text-white font-bold text-lg">E</span>
            </div>
            <span className="text-xl font-semibold">
              <span className="text-gray-900">Expertly</span>
              <span className="font-bold">Define</span>
            </span>
            <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${showProductSwitcher ? 'rotate-180' : ''}`} />
          </button>

          {showProductSwitcher && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setShowProductSwitcher(false)} />
              <div className="fixed left-6 top-16 w-72 bg-white border border-gray-200 rounded-lg shadow-lg z-20 max-h-[calc(100vh-5rem)] overflow-y-auto">
                <div className="p-2">
                  <p className="px-3 py-2 text-xs font-medium text-gray-500 uppercase">Switch Product</p>
                  {EXPERTLY_PRODUCTS.map((product) => (
                    <a
                      key={product.code}
                      href={product.href}
                      className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                        product.code === 'define'
                          ? 'bg-gray-100 text-gray-900'
                          : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                      }`}
                    >
                      <div className={`w-8 h-8 ${product.color} rounded-lg flex items-center justify-center`}>
                        <span>{product.icon}</span>
                      </div>
                      <div>
                        <p className="font-medium">{product.name}</p>
                        <p className="text-xs text-gray-500">{product.description}</p>
                      </div>
                    </a>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>

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
        </div>
      </div>
    </header>
  );
}
