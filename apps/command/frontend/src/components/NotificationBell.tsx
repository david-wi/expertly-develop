import { useState, useEffect, useRef } from 'react'
import { Bell } from 'lucide-react'
import { api, Notification } from '../services/api'
import { formatDistanceToNow } from 'date-fns'
import { useNavigate } from 'react-router-dom'

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

export default function NotificationBell() {
  const [isOpen, setIsOpen] = useState(false)
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [loading, setLoading] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()

  // Fetch unread count periodically
  useEffect(() => {
    const fetchUnreadCount = async () => {
      try {
        const result = await api.getUnreadNotificationCount()
        setUnreadCount(result.count)
      } catch {
        // Ignore errors
      }
    }

    fetchUnreadCount()
    const interval = setInterval(fetchUnreadCount, 30000) // Every 30 seconds

    return () => clearInterval(interval)
  }, [])

  // Fetch notifications when dropdown opens
  useEffect(() => {
    if (isOpen) {
      const fetchNotifications = async () => {
        setLoading(true)
        try {
          const result = await api.getNotifications({ limit: 10 })
          setNotifications(result)
        } catch {
          // Ignore errors
        } finally {
          setLoading(false)
        }
      }
      fetchNotifications()
    }
  }, [isOpen])

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen])

  const handleNotificationClick = async (notification: Notification) => {
    // Mark as read
    if (!notification.read) {
      try {
        await api.markNotificationRead(notification.id)
        setUnreadCount((prev) => Math.max(0, prev - 1))
        setNotifications((prev) =>
          prev.map((n) => (n.id === notification.id ? { ...n, read: true } : n))
        )
      } catch {
        // Ignore errors
      }
    }

    // Navigate if action URL provided
    if (notification.action_url) {
      setIsOpen(false)
      navigate(notification.action_url)
    }
  }

  const handleMarkAllRead = async () => {
    try {
      await api.markAllNotificationsRead()
      setUnreadCount(0)
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })))
    } catch {
      // Ignore errors
    }
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 rounded-lg hover:bg-gray-100 transition-colors"
        aria-label="Notifications"
      >
        <Bell className="w-5 h-5 text-gray-600" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-medium rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 bg-white rounded-lg shadow-lg border border-gray-200 z-50 max-h-[480px] overflow-hidden flex flex-col">
          <div className="p-3 border-b border-gray-200 flex items-center justify-between">
            <h3 className="font-semibold text-gray-900">Notifications</h3>
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllRead}
                className="text-sm text-blue-600 hover:text-blue-800"
              >
                Mark all read
              </button>
            )}
          </div>

          <div className="overflow-y-auto flex-1">
            {loading ? (
              <div className="p-4 text-center text-gray-500">Loading...</div>
            ) : notifications.length === 0 ? (
              <div className="p-4 text-center text-gray-500">No notifications</div>
            ) : (
              notifications.map((notification) => (
                <button
                  key={notification.id}
                  onClick={() => handleNotificationClick(notification)}
                  className={`w-full p-3 text-left border-b border-gray-100 hover:bg-gray-50 transition-colors ${
                    !notification.read ? 'bg-blue-50' : ''
                  }`}
                >
                  <div className="flex items-start gap-2">
                    <span
                      className={`text-xs px-1.5 py-0.5 rounded ${
                        NOTIFICATION_TYPE_COLORS[notification.notification_type] || 'bg-gray-100 text-gray-800'
                      }`}
                    >
                      {NOTIFICATION_TYPE_LABELS[notification.notification_type] || notification.notification_type}
                    </span>
                    {!notification.read && (
                      <span className="w-2 h-2 bg-blue-500 rounded-full flex-shrink-0 mt-1" />
                    )}
                  </div>
                  <p className="font-medium text-gray-900 mt-1 text-sm">{notification.title}</p>
                  <p className="text-gray-600 text-sm mt-0.5 line-clamp-2">{notification.message}</p>
                  <div className="flex items-center gap-2 mt-1">
                    {notification.actor_name && (
                      <span className="text-xs text-gray-500">by {notification.actor_name}</span>
                    )}
                    <span className="text-xs text-gray-400">
                      {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true })}
                    </span>
                  </div>
                </button>
              ))
            )}
          </div>

          <div className="p-2 border-t border-gray-200">
            <button
              onClick={() => {
                setIsOpen(false)
                navigate('/notifications')
              }}
              className="w-full text-center text-sm text-blue-600 hover:text-blue-800 py-1"
            >
              View all notifications
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
