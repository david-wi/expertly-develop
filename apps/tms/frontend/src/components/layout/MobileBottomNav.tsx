/**
 * Mobile Bottom Navigation Bar
 *
 * Provides quick access to key broker workflows from mobile devices.
 * Only visible on small screens (below lg breakpoint).
 * Uses larger tap targets (min 44x44px) for touch-friendly interaction.
 */

import { useLocation, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard,
  Inbox,
  Truck,
  Send,
  MoreHorizontal,
} from 'lucide-react'
import { useState, useEffect, useRef } from 'react'

const PRIMARY_TABS = [
  { name: 'Home', href: '/', icon: LayoutDashboard },
  { name: 'Inbox', href: '/inbox', icon: Inbox },
  { name: 'Shipments', href: '/shipments', icon: Truck },
  { name: 'Dispatch', href: '/dispatch', icon: Send },
]

const MORE_ITEMS = [
  { name: 'Quote Requests', href: '/quote-requests' },
  { name: 'Customers', href: '/customers' },
  { name: 'Carriers', href: '/carriers' },
  { name: 'Invoices', href: '/invoices' },
  { name: 'Load Boards', href: '/loadboards' },
  { name: 'Settings', href: '/settings' },
]

export default function MobileBottomNav() {
  const location = useLocation()
  const navigate = useNavigate()
  const [showMore, setShowMore] = useState(false)
  const moreRef = useRef<HTMLDivElement>(null)

  // Close "more" menu on route change
  useEffect(() => {
    setShowMore(false)
  }, [location.pathname])

  // Close "more" menu on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (moreRef.current && !moreRef.current.contains(event.target as Node)) {
        setShowMore(false)
      }
    }
    if (showMore) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [showMore])

  const isActive = (href: string) => {
    if (href === '/') return location.pathname === '/'
    return location.pathname.startsWith(href)
  }

  const isMoreActive = MORE_ITEMS.some(item => location.pathname.startsWith(item.href))

  return (
    <div className="lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-gray-200 safe-area-bottom">
      <nav
        className="flex items-stretch justify-around px-1"
        role="navigation"
        aria-label="Mobile navigation"
      >
        {PRIMARY_TABS.map((tab) => {
          const active = isActive(tab.href)
          return (
            <button
              key={tab.href}
              onClick={() => navigate(tab.href)}
              className={`flex flex-col items-center justify-center gap-0.5 py-2 px-2 min-w-[64px] min-h-[56px] transition-colors ${
                active
                  ? 'text-emerald-600'
                  : 'text-gray-400 active:text-gray-600'
              }`}
              aria-label={tab.name}
              aria-current={active ? 'page' : undefined}
            >
              <tab.icon className={`w-5 h-5 ${active ? 'stroke-[2.5]' : ''}`} />
              <span className={`text-[10px] font-medium ${active ? 'font-semibold' : ''}`}>
                {tab.name}
              </span>
            </button>
          )
        })}

        {/* More menu */}
        <div className="relative" ref={moreRef}>
          <button
            onClick={() => setShowMore(!showMore)}
            className={`flex flex-col items-center justify-center gap-0.5 py-2 px-2 min-w-[64px] min-h-[56px] transition-colors ${
              showMore || isMoreActive
                ? 'text-emerald-600'
                : 'text-gray-400 active:text-gray-600'
            }`}
            aria-label="More options"
            aria-expanded={showMore}
            aria-haspopup="true"
          >
            <MoreHorizontal className={`w-5 h-5 ${showMore || isMoreActive ? 'stroke-[2.5]' : ''}`} />
            <span className={`text-[10px] font-medium ${showMore || isMoreActive ? 'font-semibold' : ''}`}>
              More
            </span>
          </button>

          {showMore && (
            <div className="absolute bottom-full right-0 mb-2 w-48 bg-white rounded-xl shadow-xl border border-gray-200 overflow-hidden">
              {MORE_ITEMS.map((item) => {
                const active = location.pathname.startsWith(item.href)
                return (
                  <button
                    key={item.href}
                    onClick={() => {
                      navigate(item.href)
                      setShowMore(false)
                    }}
                    className={`w-full text-left px-4 py-3 text-sm font-medium transition-colors min-h-[44px] ${
                      active
                        ? 'bg-emerald-50 text-emerald-700'
                        : 'text-gray-700 active:bg-gray-50'
                    }`}
                  >
                    {item.name}
                  </button>
                )
              })}
            </div>
          )}
        </div>
      </nav>
    </div>
  )
}
