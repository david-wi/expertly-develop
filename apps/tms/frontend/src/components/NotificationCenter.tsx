/**
 * Notification Center Component
 *
 * A bell icon with dropdown that shows recent notifications,
 * unread count, and categorized notification items.
 * Integrates with the notifications API endpoint.
 * Includes push notification subscription and preferences management.
 */

import { useState, useRef, useEffect, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Bell,
  BellRing,
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
  Smartphone,
  Mail,
  Monitor,
  TestTube,
  Moon,
  Loader2,
  ChevronLeft,
} from 'lucide-react'
import { api } from '../services/api'
import { usePushNotifications } from '../hooks/usePushNotifications'

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

interface NotificationRule {
  event_type: string
  label: string
  description: string
  channels: { in_app: boolean; push: boolean; email: boolean }
  enabled: boolean
}

type CategoryFilter = 'all' | NotificationItem['category']
type PanelView = 'notifications' | 'preferences'

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
  const [panelView, setPanelView] = useState<PanelView>('notifications')
  const dropdownRef = useRef<HTMLDivElement>(null)
  const queryClient = useQueryClient()

  // Push notifications hook
  const {
    isSupported: pushSupported,
    isSubscribed: pushSubscribed,
    permission: pushPermission,
    loading: pushLoading,
    subscribe: pushSubscribe,
    unsubscribe: pushUnsubscribe,
  } = usePushNotifications()

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

  // Notification preferences
  const { data: prefsData } = useQuery({
    queryKey: ['notification-preferences', userId],
    queryFn: () => api.getNotificationPreferences(userId),
    enabled: isOpen && panelView === 'preferences',
  })

  const prefsMutation = useMutation({
    mutationFn: (prefs: Record<string, unknown>) =>
      api.updateNotificationPreferences(userId, prefs),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notification-preferences', userId] })
    },
  })

  const testNotificationMutation = useMutation({
    mutationFn: () => api.sendTestNotification(),
  })

  // Mark all read mutation
  const markAllReadMutation = useMutation({
    mutationFn: () => api.markAllNotificationsRead(userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notification-center'] })
    },
  })

  // Reset panel view when dropdown closes
  useEffect(() => {
    if (!isOpen) {
      setPanelView('notifications')
    }
  }, [isOpen])

  const unreadCount = center?.unread_count ?? 0
  const notifications = center?.notifications ?? []

  const handleToggleRule = useCallback((eventType: string, field: 'enabled' | 'in_app' | 'push' | 'email', value: boolean) => {
    if (!prefsData?.notification_rules) return
    const updatedRules = prefsData.notification_rules.map((rule: NotificationRule) => {
      if (rule.event_type !== eventType) return rule
      if (field === 'enabled') {
        return { ...rule, enabled: value }
      }
      return { ...rule, channels: { ...rule.channels, [field]: value } }
    })
    prefsMutation.mutate({
      ...prefsData,
      notification_rules: updatedRules,
    })
  }, [prefsData, prefsMutation])

  const handleToggleQuietHours = useCallback((enabled: boolean) => {
    if (!prefsData) return
    prefsMutation.mutate({
      ...prefsData,
      quiet_hours_enabled: enabled,
    })
  }, [prefsData, prefsMutation])

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
        <div className="absolute right-0 top-full mt-2 w-[calc(100vw-2rem)] sm:w-[420px] max-h-[85vh] sm:max-h-[520px] bg-white rounded-xl shadow-xl border border-gray-200 z-50 flex flex-col overflow-hidden">
          {/* Header */}
          <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between bg-gray-50">
            <div className="flex items-center gap-2">
              {panelView === 'preferences' && (
                <button
                  onClick={() => setPanelView('notifications')}
                  className="p-1 text-gray-400 hover:text-gray-600 rounded transition-colors"
                  aria-label="Back to notifications"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
              )}
              <h3 className="text-sm font-semibold text-gray-900">
                {panelView === 'notifications' ? 'Notifications' : 'Notification Settings'}
              </h3>
              {panelView === 'notifications' && unreadCount > 0 && (
                <span className="text-xs font-medium text-white bg-blue-600 rounded-full px-2 py-0.5">
                  {unreadCount} new
                </span>
              )}
            </div>
            <div className="flex items-center gap-1">
              {panelView === 'notifications' && (
                <button
                  onClick={() => setPanelView('preferences')}
                  className="p-1.5 text-gray-400 hover:text-gray-600 rounded transition-colors"
                  aria-label="Notification settings"
                >
                  <Settings className="w-4 h-4" />
                </button>
              )}
              <button
                onClick={() => setIsOpen(false)}
                className="p-1 text-gray-400 hover:text-gray-600 rounded transition-colors"
                aria-label="Close notifications"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {panelView === 'notifications' && (
            <>
              {/* Category Filters */}
              <div className="px-3 py-2 border-b border-gray-100 flex gap-1 overflow-x-auto scrollbar-hide">
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
                        className={`px-4 py-3 hover:bg-gray-50 transition-colors cursor-pointer active:bg-gray-100 ${
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
                    onClick={() => markAllReadMutation.mutate()}
                    disabled={markAllReadMutation.isPending}
                    className="text-xs text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1 min-h-[32px] sm:min-h-0"
                  >
                    <CheckCheck className="w-3.5 h-3.5" />
                    Mark all as read
                  </button>
                  <button
                    onClick={() => {
                      setPanelView('preferences')
                    }}
                    className="text-xs text-gray-500 hover:text-gray-700 font-medium min-h-[32px] sm:min-h-0"
                  >
                    Settings
                  </button>
                </div>
              )}
            </>
          )}

          {panelView === 'preferences' && (
            <div className="flex-1 overflow-y-auto">
              {/* Push Notification Toggle */}
              <div className="px-4 py-4 border-b border-gray-100">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <BellRing className="w-4 h-4 text-blue-600" />
                    <span className="text-sm font-semibold text-gray-900">Push Notifications</span>
                  </div>
                  {pushSupported ? (
                    <button
                      onClick={async () => {
                        if (pushSubscribed) {
                          await pushUnsubscribe()
                        } else {
                          await pushSubscribe()
                        }
                      }}
                      disabled={pushLoading}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                        pushSubscribed ? 'bg-blue-600' : 'bg-gray-300'
                      }`}
                      role="switch"
                      aria-checked={pushSubscribed}
                      aria-label="Toggle push notifications"
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                          pushSubscribed ? 'translate-x-6' : 'translate-x-1'
                        }`}
                      />
                    </button>
                  ) : (
                    <span className="text-xs text-gray-400">Not supported</span>
                  )}
                </div>
                <p className="text-xs text-gray-500">
                  {pushPermission === 'denied'
                    ? 'Push notifications are blocked. Please update your browser settings.'
                    : pushSubscribed
                    ? 'You will receive push alerts for enabled events.'
                    : 'Enable to receive instant alerts on your device.'}
                </p>
                {pushSubscribed && (
                  <button
                    onClick={() => testNotificationMutation.mutate()}
                    disabled={testNotificationMutation.isPending}
                    className="mt-2 flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-blue-700 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors min-h-[36px] sm:min-h-0"
                  >
                    {testNotificationMutation.isPending ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      <TestTube className="w-3 h-3" />
                    )}
                    Send test notification
                  </button>
                )}
                {testNotificationMutation.isSuccess && (
                  <p className="mt-1 text-xs text-emerald-600">Test notification sent!</p>
                )}
              </div>

              {/* Quiet Hours */}
              <div className="px-4 py-3 border-b border-gray-100">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Moon className="w-4 h-4 text-indigo-500" />
                    <span className="text-sm font-medium text-gray-900">Quiet Hours</span>
                  </div>
                  <button
                    onClick={() => handleToggleQuietHours(!prefsData?.quiet_hours_enabled)}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                      prefsData?.quiet_hours_enabled ? 'bg-indigo-600' : 'bg-gray-300'
                    }`}
                    role="switch"
                    aria-checked={prefsData?.quiet_hours_enabled || false}
                    aria-label="Toggle quiet hours"
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        prefsData?.quiet_hours_enabled ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Mute push notifications from {prefsData?.quiet_hours_start || '22:00'} to {prefsData?.quiet_hours_end || '07:00'}
                </p>
              </div>

              {/* Notification Rules */}
              <div className="px-4 py-3">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-sm font-semibold text-gray-900">Event Notifications</span>
                </div>
                {/* Channel headers */}
                <div className="flex items-center gap-1 mb-2 pl-8">
                  <div className="flex-1" />
                  <div className="w-10 flex justify-center" title="In-app notifications">
                    <Monitor className="w-3.5 h-3.5 text-gray-400" />
                  </div>
                  <div className="w-10 flex justify-center" title="Push notifications">
                    <Smartphone className="w-3.5 h-3.5 text-gray-400" />
                  </div>
                  <div className="w-10 flex justify-center" title="Email notifications">
                    <Mail className="w-3.5 h-3.5 text-gray-400" />
                  </div>
                </div>

                <div className="space-y-1">
                  {(prefsData?.notification_rules || []).map((rule: NotificationRule) => (
                    <div
                      key={rule.event_type}
                      className={`flex items-center gap-1 py-2 px-2 rounded-lg ${
                        rule.enabled ? '' : 'opacity-50'
                      }`}
                    >
                      <button
                        onClick={() => handleToggleRule(rule.event_type, 'enabled', !rule.enabled)}
                        className="flex-shrink-0 mr-1"
                        aria-label={`${rule.enabled ? 'Disable' : 'Enable'} ${rule.label}`}
                      >
                        <div className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-colors ${
                          rule.enabled
                            ? 'bg-blue-600 border-blue-600'
                            : 'border-gray-300'
                        }`}>
                          {rule.enabled && (
                            <svg className="w-3 h-3 text-white" viewBox="0 0 12 12" fill="none">
                              <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                          )}
                        </div>
                      </button>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-gray-800 truncate">{rule.label}</p>
                      </div>
                      {/* Channel toggles */}
                      {(['in_app', 'push', 'email'] as const).map((channel) => (
                        <button
                          key={channel}
                          onClick={() => handleToggleRule(rule.event_type, channel, !rule.channels[channel])}
                          disabled={!rule.enabled}
                          className={`w-10 h-7 flex items-center justify-center rounded transition-colors min-h-[28px] ${
                            rule.channels[channel] && rule.enabled
                              ? 'bg-blue-100 text-blue-700'
                              : 'text-gray-300 hover:text-gray-400'
                          }`}
                          aria-label={`${rule.channels[channel] ? 'Disable' : 'Enable'} ${channel} for ${rule.label}`}
                          title={`${channel === 'in_app' ? 'In-app' : channel === 'push' ? 'Push' : 'Email'}`}
                        >
                          <div className={`w-3 h-3 rounded-full border-2 ${
                            rule.channels[channel] && rule.enabled
                              ? 'bg-blue-600 border-blue-600'
                              : 'border-gray-300'
                          }`} />
                        </button>
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
