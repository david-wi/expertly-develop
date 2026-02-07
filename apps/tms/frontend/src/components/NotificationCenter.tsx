/**
 * Notification Center Component
 *
 * A bell icon with dropdown that shows recent notifications,
 * unread count, and categorized notification items.
 * Integrates with the notifications API endpoint.
 */

import { useState, useRef, useEffect, useCallback } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  Bell,
  X,
  CheckCheck,
  Truck,
  DollarSign,
  FileText,
  ArrowLeftRight,
  Radio,
  Package,
  Clock,
  Settings,
} from 'lucide-react'
import { api } from '../services/api'

interface NotificationItem {
  id: string
  title: string
  message: string
  category: 'shipment' | 'billing' | 'carrier' | 'edi' | 'loadboard' | 'approval' | 'system'
  severity: 'info' | 'warning' | 'error' | 'success'
  read: boolean
  created_at: string
  action_url?: string | null
  action_label?: string | null
}

interface NotificationCenterData {
  notifications: NotificationItem[]
  unread_count: number
  total_count: number
}

type CategoryFilter = 'all' | NotificationItem['category']

const CATEGORY_ICONS: Record<NotificationItem['category'], typeof Bell> = {
  shipment: Truck,
  billing: DollarSign,
  carrier: Package,
  edi: ArrowLeftRight,
  loadboard: Radio,
  approval: FileText,
  system: Settings,
}

const CATEGORY_LABELS: Record<NotificationItem['category'], string> = {
  shipment: 'Shipments',
  billing: 'Billing',
  carrier: 'Carriers',
  edi: 'EDI',
  loadboard: 'Load Boards',
  approval: 'Approvals',
  system: 'System',
}

export default function NotificationCenter() {
  const [isOpen, setIsOpen] = useState(false)
  const [activeCategory, setActiveCategory] = useState<CategoryFilter>('all')
  const dropdownRef = useRef<HTMLDivElement>(null)

  // TODO: Replace with actual user ID from auth context
  const userId = 'current-user'

  const { data: notificationData } = useQuery({
    queryKey: ['notification-center', activeCategory],
    queryFn: () =>
      api.getNotificationCenter(userId, {
        limit: 20,
        category: activeCategory === 'all' ? undefined : activeCategory,
      }),
    refetchInterval: 30000, // Poll every 30 seconds
  })

  const center = notificationData as NotificationCenterData | undefined

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [isOpen])

  // Close dropdown with Escape key
  useEffect(() => {
    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsOpen(false)
      }
    }
    if (isOpen) {
      document.addEventListener('keydown', handleEscape)
    }
    return () => document.removeEventListener('keydown', handleEscape)
  }, [isOpen])

  const unreadCount = center?.unread_count ?? 0
  const notifications = center?.notifications ?? []

  const formatTime = useCallback((dateStr: string) => {
    const date = new Date(dateStr)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    if (diffMins < 1) return 'Just now'
    if (diffMins < 60) return `${diffMins}m ago`
    if (diffHours < 24) return `${diffHours}h ago`
    if (diffDays < 7) return `${diffDays}d ago`
    return date.toLocaleDateString()
  }, [])

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bell Icon Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
        aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ''}`}
        aria-expanded={isOpen}
        aria-haspopup="true"
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[10px] font-bold text-white bg-red-500 rounded-full ring-2 ring-white">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown Panel */}
      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-[420px] max-h-[520px] bg-white rounded-xl shadow-xl border border-gray-200 z-50 flex flex-col overflow-hidden">
          {/* Header */}
          <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between bg-gray-50">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold text-gray-900">Notifications</h3>
              {unreadCount > 0 && (
                <span className="text-xs font-medium text-white bg-blue-600 rounded-full px-2 py-0.5">
                  {unreadCount} new
                </span>
              )}
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="p-1 text-gray-400 hover:text-gray-600 rounded transition-colors"
              aria-label="Close notifications"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Category Filters */}
          <div className="px-3 py-2 border-b border-gray-100 flex gap-1 overflow-x-auto">
            {(['all', 'shipment', 'billing', 'carrier', 'edi', 'loadboard', 'approval', 'system'] as CategoryFilter[]).map(cat => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={`px-2.5 py-1 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
                  activeCategory === cat
                    ? 'bg-blue-100 text-blue-700'
                    : 'text-gray-500 hover:bg-gray-100'
                }`}
              >
                {cat === 'all' ? 'All' : CATEGORY_LABELS[cat]}
              </button>
            ))}
          </div>

          {/* Notification List */}
          <div className="flex-1 overflow-y-auto divide-y divide-gray-50">
            {notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-gray-400">
                <Bell className="w-8 h-8 mb-2 text-gray-300" />
                <p className="text-sm">No notifications</p>
                <p className="text-xs mt-1">
                  {activeCategory !== 'all'
                    ? `No ${CATEGORY_LABELS[activeCategory as NotificationItem['category']].toLowerCase()} notifications`
                    : "You're all caught up!"}
                </p>
              </div>
            ) : (
              notifications.map((notification) => {
                const CategoryIcon = CATEGORY_ICONS[notification.category] || Bell
                return (
                  <div
                    key={notification.id}
                    className={`px-4 py-3 hover:bg-gray-50 transition-colors cursor-pointer ${
                      !notification.read ? 'bg-blue-50/30' : ''
                    }`}
                    role="button"
                    tabIndex={0}
                    onClick={() => {
                      if (notification.action_url) {
                        window.location.href = notification.action_url
                        setIsOpen(false)
                      }
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && notification.action_url) {
                        window.location.href = notification.action_url
                        setIsOpen(false)
                      }
                    }}
                  >
                    <div className="flex items-start gap-3">
                      <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
                        notification.severity === 'error' ? 'bg-red-100 text-red-600' :
                        notification.severity === 'warning' ? 'bg-yellow-100 text-yellow-600' :
                        notification.severity === 'success' ? 'bg-emerald-100 text-emerald-600' :
                        'bg-blue-100 text-blue-600'
                      }`}>
                        <CategoryIcon className="w-4 h-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className={`text-sm ${!notification.read ? 'font-semibold text-gray-900' : 'font-medium text-gray-700'}`}>
                            {notification.title}
                          </p>
                          {!notification.read && (
                            <div className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0" />
                          )}
                        </div>
                        <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">
                          {notification.message}
                        </p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-[10px] text-gray-400 flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {formatTime(notification.created_at)}
                          </span>
                          {notification.action_label && (
                            <span className="text-[10px] text-blue-600 font-medium">
                              {notification.action_label}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })
            )}
          </div>

          {/* Footer */}
          {notifications.length > 0 && (
            <div className="px-4 py-2.5 border-t border-gray-200 bg-gray-50 flex items-center justify-between">
              <button
                onClick={() => {
                  // TODO: Mark all as read API call
                }}
                className="text-xs text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1"
              >
                <CheckCheck className="w-3.5 h-3.5" />
                Mark all as read
              </button>
              <button
                onClick={() => {
                  // TODO: Navigate to full notifications page
                  setIsOpen(false)
                }}
                className="text-xs text-gray-500 hover:text-gray-700 font-medium"
              >
                View all
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
