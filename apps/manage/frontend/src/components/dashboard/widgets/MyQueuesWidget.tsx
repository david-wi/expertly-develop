import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { WidgetWrapper } from '../WidgetWrapper'
import { WidgetProps } from './types'
import { useAppStore } from '../../../stores/appStore'
import { api, User as UserType, Team } from '../../../services/api'

export function MyQueuesWidget({ widgetId }: WidgetProps) {
  const { user, tasks, queues, loading } = useAppStore()
  const [users, setUsers] = useState<UserType[]>([])
  const [teams, setTeams] = useState<Team[]>([])

  useEffect(() => {
    api.getUsers().then(setUsers).catch(console.error)
    api.getTeams().then(setTeams).catch(console.error)
  }, [])

  const getQueueTaskCounts = (queueId: string) => {
    const queueTasks = tasks.filter((t) => t.queue_id === queueId)
    return {
      total: queueTasks.length,
      queued: queueTasks.filter((t) => t.status === 'queued').length,
      inProgress: queueTasks.filter((t) => ['checked_out', 'in_progress'].includes(t.status)).length,
      completed: queueTasks.filter((t) => t.status === 'completed').length,
    }
  }

  const getScopeLabel = (queue: { scope_type: string; scope_id?: string }): string => {
    if (queue.scope_type === 'user') {
      if (queue.scope_id === user?.id) {
        return user?.name || 'You'
      }
      const owner = users.find((u) => (u._id || u.id) === queue.scope_id)
      return owner?.name || 'User'
    }
    if (queue.scope_type === 'team') {
      const team = teams.find((t) => (t._id || t.id) === queue.scope_id)
      return team?.name || 'Team'
    }
    return 'Everyone'
  }

  return (
    <WidgetWrapper widgetId={widgetId} title="Queues">
      {loading.queues ? (
        <div className="p-4 text-gray-500">Loading...</div>
      ) : (
        <ul className="divide-y divide-gray-200">
          {queues.map((queue) => {
            const counts = getQueueTaskCounts(queue._id || queue.id)
            return (
              <li key={queue._id || queue.id}>
                <Link
                  to={`/queues?id=${queue._id || queue.id}`}
                  className="block hover:bg-gray-50 px-4 py-3"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2 min-w-0">
                      <p className="font-medium text-gray-900 truncate">{queue.purpose}</p>
                      <span className="flex-shrink-0 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                        {getScopeLabel(queue)}
                      </span>
                    </div>
                    <div className="flex items-center space-x-3 text-xs flex-shrink-0 ml-2">
                      <span className="text-blue-600">{counts.queued} queued</span>
                      <span className="text-yellow-600">{counts.inProgress} active</span>
                      <span className="text-green-600">{counts.completed} done</span>
                    </div>
                  </div>
                </Link>
              </li>
            )
          })}
          {queues.length === 0 && (
            <li className="px-4 py-4 text-gray-500">No queues found</li>
          )}
        </ul>
      )}
    </WidgetWrapper>
  )
}
