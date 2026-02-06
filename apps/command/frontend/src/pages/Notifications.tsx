import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bell, Check, CheckCheck, Trash2, Filter, RefreshCw } from 'lucide-react'
import { api, Notification, NotificationType } from '../services/api'
import { formatDistanceToNow } from 'date-fns'

type FilterType = 'all' | 'unread' | NotificationType

const NOTIFICATION_TYPE_LABELS: Record<string, string> = {
  task_assigned: 'Assignment',
  task_completed: 'Completed',
  task_failed: 'Failed',
  task_unblocked: 'Unblocked',
  approval_needed: 'Approval',
  bot_failure_alert: 'Bot Alert',
  mention: 'Mention',
}

const NOTIFICATION_TYPE_COLORS: Record<string, string> = {
  task_assigned: 'bg-blue-100 text-blue-800',
  task_completed: 'bg-green-100 text-green-800',
  task_failed: 'bg-red-100 text-red-800',
  task_unblocked: 'bg-yellow-100 text-yellow-800',
  approval_needed: 'bg-purple-100 text-purple-800',
  bot_failure_alert: 'bg-orange-100 text-orange-800',
  mention: 'bg-gray-100 text-gray-800',
}

export default function Notifications() {
  const navigate = useNavigate()
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<FilterType>('all')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  const loadNotifications = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params: { unread_only?: boolean; notification_type?: string } = {}
      if (filter === 'unread') {
        params.unread_only = true
      } else if (filter !== 'all') {
        params.notification_type = filter
      }
      const data = await api.getNotifications(params)
      setNotifications(data)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load notifications'
      setError(message)
    } finally {
      setLoading(false)
    }
  }, [filter])

  useEffect(() => {
    loadNotifications()
  }, [loadNotifications])

  const handleNotificationClick = async (notification: Notification) => {
    // Mark as read
    if (!notification.read) {
      try {
        await api.markNotificationRead(notification.id)
        setNotifications(prev =>
          prev.map(n => (n.id === notification.id ? { ...n, read: true } : n))
        )
      } catch {
        // Ignore errors
      }
    }

    // Navigate if action URL provided
    if (notification.action_url) {
      navigate(notification.action_url)
    }
  }

  const handleMarkAsRead = async (notificationId: string) => {
    try {
      await api.markNotificationRead(notificationId)
      setNotifications(prev =>
        prev.map(n => (n.id === notificationId ? { ...n, read: true } : n))
      )
    } catch {
      // Ignore errors
    }
  }

  const handleMarkAllRead = async () => {
    try {
      await api.markAllNotificationsRead()
      setNotifications(prev => prev.map(n => ({ ...n, read: true })))
    } catch {
      // Ignore errors
    }
  }

  const handleMarkSelectedRead = async () => {
    try {
      await Promise.all(Array.from(selectedIds).map(id => api.markNotificationRead(id)))
      setNotifications(prev =>
        prev.map(n => (selectedIds.has(n.id) ? { ...n, read: true } : n))
      )
      setSelectedIds(new Set())
    } catch {
      // Ignore errors
    }
  }

  const handleDismiss = async (notificationId: string) => {
    try {
      await api.dismissNotification(notificationId)
      setNotifications(prev => prev.filter(n => n.id !== notificationId))
    } catch {
      // Ignore errors
    }
  }

  const handleDismissSelected = async () => {
    try {
      await Promise.all(Array.from(selectedIds).map(id => api.dismissNotification(id)))
      setNotifications(prev => prev.filter(n => !selectedIds.has(n.id)))
      setSelectedIds(new Set())
    } catch {
      // Ignore errors
    }
  }

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  const toggleSelectAll = () => {
    if (selectedIds.size === notifications.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(notifications.map(n => n.id)))
    }
  }

  const unreadCount = notifications.filter(n => !n.read).length

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <Bell className="h-8 w-8 text-blue-600" />
          <div>
            <h2 className="text-2xl font-bold text-[var(--theme-text-heading)]">Notifications</h2>
            <p className="text-sm text-gray-500">
              {unreadCount > 0 ? `${unreadCount} unread` : 'All caught up'}
            </p>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <button
            onClick={loadNotifications}
            className="flex items-center space-x-2 px-3 py-2 text-sm text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <RefreshCw className="h-4 w-4" />
            <span>Refresh</span>
          </button>
          {unreadCount > 0 && (
            <button
              onClick={handleMarkAllRead}
              className="flex items-center space-x-2 px-3 py-2 text-sm text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-lg transition-colors"
            >
              <CheckCheck className="h-4 w-4" />
              <span>Mark all read</span>
            </button>
          )}
        </div>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {/* Filters */}
      <div className="flex items-center space-x-4">
        <Filter className="h-4 w-4 text-gray-400" />
        <div className="flex items-center space-x-2">
          <button
            onClick={() => setFilter('all')}
            className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
              filter === 'all'
                ? 'bg-blue-100 text-blue-700'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            All
          </button>
          <button
            onClick={() => setFilter('unread')}
            className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
              filter === 'unread'
                ? 'bg-blue-100 text-blue-700'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            Unread
          </button>
          <select
            value={filter !== 'all' && filter !== 'unread' ? filter : ''}
            onChange={(e) => setFilter((e.target.value || 'all') as FilterType)}
            className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg"
          >
            <option value="">By Type...</option>
            <option value="task_assigned">Assignments</option>
            <option value="task_completed">Completed</option>
            <option value="task_failed">Failed</option>
            <option value="task_unblocked">Unblocked</option>
            <option value="approval_needed">Approvals</option>
            <option value="bot_failure_alert">Bot Alerts</option>
            <option value="mention">Mentions</option>
          </select>
        </div>
      </div>

      {/* Bulk Actions */}
      {selectedIds.size > 0 && (
        <div className="flex items-center space-x-4 bg-blue-50 rounded-lg p-3">
          <span className="text-sm text-blue-700">{selectedIds.size} selected</span>
          <button
            onClick={handleMarkSelectedRead}
            className="flex items-center space-x-1 px-2 py-1 text-sm text-blue-600 hover:bg-blue-100 rounded transition-colors"
          >
            <Check className="h-4 w-4" />
            <span>Mark read</span>
          </button>
          <button
            onClick={handleDismissSelected}
            className="flex items-center space-x-1 px-2 py-1 text-sm text-red-600 hover:bg-red-100 rounded transition-colors"
          >
            <Trash2 className="h-4 w-4" />
            <span>Dismiss</span>
          </button>
          <button
            onClick={() => setSelectedIds(new Set())}
            className="px-2 py-1 text-sm text-gray-600 hover:bg-gray-100 rounded transition-colors"
          >
            Clear selection
          </button>
        </div>
      )}

      {/* Notifications List */}
      <div className="bg-white shadow rounded-lg overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-500">Loading notifications...</div>
        ) : notifications.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            <Bell className="h-12 w-12 mx-auto mb-4 text-gray-300" />
            <p>No notifications</p>
            <p className="text-sm mt-1">
              {filter !== 'all' ? 'Try adjusting your filter' : "You're all caught up!"}
            </p>
          </div>
        ) : (
          <div>
            {/* Select All */}
            <div className="px-4 py-2 bg-gray-50 border-b border-gray-200 flex items-center">
              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={selectedIds.size === notifications.length}
                  onChange={toggleSelectAll}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm text-gray-600">Select all</span>
              </label>
            </div>

            {/* Notification Items */}
            <ul className="divide-y divide-gray-200">
              {notifications.map((notification) => (
                <li
                  key={notification.id}
                  className={`relative ${!notification.read ? 'bg-blue-50' : ''}`}
                >
                  <div className="flex items-start p-4">
                    {/* Checkbox */}
                    <div className="flex-shrink-0 mr-3">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(notification.id)}
                        onChange={() => toggleSelect(notification.id)}
                        className="mt-1 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                    </div>

                    {/* Content */}
                    <button
                      onClick={() => handleNotificationClick(notification)}
                      className="flex-1 text-left min-w-0"
                    >
                      <div className="flex items-center gap-2 flex-wrap">
                        <span
                          className={`text-xs px-1.5 py-0.5 rounded ${
                            NOTIFICATION_TYPE_COLORS[notification.notification_type] || 'bg-gray-100 text-gray-800'
                          }`}
                        >
                          {NOTIFICATION_TYPE_LABELS[notification.notification_type] || notification.notification_type}
                        </span>
                        {!notification.read && (
                          <span className="w-2 h-2 bg-blue-500 rounded-full" />
                        )}
                        <span className="text-xs text-gray-400">
                          {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true })}
                        </span>
                      </div>
                      <p className="font-medium text-gray-900 mt-1">{notification.title}</p>
                      <p className="text-sm text-gray-600 mt-0.5 line-clamp-2">{notification.message}</p>
                      {notification.actor_name && (
                        <p className="text-xs text-gray-500 mt-1">by {notification.actor_name}</p>
                      )}
                    </button>

                    {/* Actions */}
                    <div className="flex-shrink-0 ml-4 flex items-center space-x-1">
                      {!notification.read && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            handleMarkAsRead(notification.id)
                          }}
                          className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                          title="Mark as read"
                        >
                          <Check className="h-4 w-4" />
                        </button>
                      )}
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          handleDismiss(notification.id)
                        }}
                        className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                        title="Dismiss"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  )
}
