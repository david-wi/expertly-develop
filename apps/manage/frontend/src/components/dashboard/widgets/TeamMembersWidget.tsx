import { useEffect, useState } from 'react'
import { WidgetWrapper } from '../WidgetWrapper'
import { WidgetProps } from './types'
import { api, User } from '../../../services/api'

export function TeamMembersWidget({ widgetId }: WidgetProps) {
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const data = await api.getUsers()
        // Filter to only active users
        setUsers(data.filter((u) => u.is_active))
      } catch (error) {
        console.error('Failed to fetch users:', error)
      } finally {
        setLoading(false)
      }
    }
    fetchUsers()
  }, [])

  if (loading) {
    return (
      <WidgetWrapper widgetId={widgetId} title="My Team">
        <div className="p-4 flex items-center justify-center">
          <span className="text-gray-500">Loading...</span>
        </div>
      </WidgetWrapper>
    )
  }

  return (
    <WidgetWrapper widgetId={widgetId} title="My Team">
      <div className="p-4">
        <div className="flex flex-wrap gap-6 justify-center">
          {users.map((user) => (
            <div
              key={user.id}
              className="flex flex-col items-center group relative"
              title={user.title || user.role}
            >
              {/* Avatar */}
              <div className="relative">
                {user.avatar_url ? (
                  <img
                    src={user.avatar_url}
                    alt={user.name}
                    className="w-14 h-14 rounded-full object-cover border-2 border-gray-200 group-hover:border-blue-400 transition-colors"
                  />
                ) : (
                  <div className="w-14 h-14 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-lg font-semibold border-2 border-gray-200 group-hover:border-blue-400 transition-colors">
                    {user.name
                      .split(' ')
                      .map((n) => n[0])
                      .join('')
                      .slice(0, 2)
                      .toUpperCase()}
                  </div>
                )}
                {/* User type indicator */}
                {user.user_type === 'virtual' && (
                  <span className="absolute -bottom-1 -right-1 w-5 h-5 bg-purple-500 rounded-full flex items-center justify-center text-[10px] text-white border-2 border-white">
                    AI
                  </span>
                )}
              </div>
              {/* Name */}
              <span className="mt-2 text-sm font-medium text-gray-700 text-center max-w-[80px] truncate">
                {user.name.split(' ')[0]}
              </span>
              {/* Tooltip */}
              <div className="absolute bottom-full mb-2 px-3 py-2 bg-gray-900 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-10">
                <div className="font-medium">{user.name}</div>
                {user.title && <div className="text-gray-300">{user.title}</div>}
                {!user.title && <div className="text-gray-300 capitalize">{user.role}</div>}
                <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-900" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </WidgetWrapper>
  )
}
