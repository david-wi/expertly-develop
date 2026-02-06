import { useEffect, useState } from 'react'
import { WidgetWrapper } from '../WidgetWrapper'
import { WidgetProps } from './types'
import { api, User } from '../../../services/api'
import { useAppStore } from '../../../stores/appStore'
import { PortalTooltip } from '../../ui/PortalTooltip'

export function TeamMembersWidget({ widgetId }: WidgetProps) {
  const { user: currentUser, viewingUserId, setViewingUserId } = useAppStore()
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)

  // Which user is currently selected (viewing their tasks)
  const selectedUserId = viewingUserId || currentUser?.id

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
          {users.map((user) => {
            const userId = user._id || user.id
            const isSelected = selectedUserId === userId

            return (
              <PortalTooltip
                key={userId}
                content={
                  <>
                    <div className="font-medium">{user.name}</div>
                    {user.title && <div className="text-gray-300">{user.title}</div>}
                    {!user.title && <div className="text-gray-300 capitalize">{user.role}</div>}
                    <div className="mt-1 text-primary-300 text-[10px]">
                      {isSelected ? 'Currently viewing' : 'Click to view tasks'}
                    </div>
                  </>
                }
              >
                <div
                  onClick={() => setViewingUserId(userId === currentUser?.id ? null : userId)}
                  className={`flex flex-col items-center relative cursor-pointer ${
                    isSelected ? 'scale-110' : 'hover:scale-105'
                  } transition-transform`}
                >
                  {/* Avatar */}
                  <div className="relative">
                    {user.avatar_url ? (
                      <img
                        src={user.avatar_url}
                        alt={user.name}
                        className={`w-14 h-14 rounded-full object-cover border-2 transition-colors ${
                          isSelected
                            ? 'border-primary-500 ring-2 ring-primary-200'
                            : 'border-gray-200 hover:border-blue-400'
                        }`}
                      />
                    ) : (
                      <div className={`w-14 h-14 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-lg font-semibold border-2 transition-colors ${
                        isSelected
                          ? 'border-primary-500 ring-2 ring-primary-200'
                          : 'border-gray-200 hover:border-blue-400'
                      }`}>
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
                        🤖
                      </span>
                    )}
                    {/* Selected indicator */}
                    {isSelected && (
                      <span className="absolute -top-1 -right-1 w-4 h-4 bg-primary-500 rounded-full flex items-center justify-center">
                        <svg className="w-2.5 h-2.5 text-white" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      </span>
                    )}
                  </div>
                  {/* Name */}
                  <span className={`mt-2 text-sm font-medium text-center max-w-[80px] truncate ${
                    isSelected ? 'text-primary-700' : 'text-gray-700'
                  }`}>
                    {user.name.split(' ')[0]}
                  </span>
                </div>
              </PortalTooltip>
            )
          })}
        </div>
      </div>
    </WidgetWrapper>
  )
}
