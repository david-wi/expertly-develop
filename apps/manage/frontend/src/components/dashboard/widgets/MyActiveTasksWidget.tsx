import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { WidgetWrapper } from '../WidgetWrapper'
import { WidgetProps } from './types'
import { useAppStore } from '../../../stores/appStore'
import { api, User as UserType, Team } from '../../../services/api'

export function MyActiveTasksWidget({ widgetId }: WidgetProps) {
  const { user, tasks, queues, loading } = useAppStore()
  const [selectedQueueFilter, setSelectedQueueFilter] = useState<string>('all')
  const [users, setUsers] = useState<UserType[]>([])
  const [teams, setTeams] = useState<Team[]>([])

  useEffect(() => {
    api.getUsers().then(setUsers).catch(console.error)
    api.getTeams().then(setTeams).catch(console.error)
  }, [])

  const getQueueDisplayName = (queue: { scope_type: string; scope_id?: string; purpose: string }): string => {
    if (queue.scope_type === 'user') {
      if (queue.scope_id === user?.id) {
        return `${user?.name || 'You'} > ${queue.purpose}`
      }
      const owner = users.find((u) => (u._id || u.id) === queue.scope_id)
      return owner ? `${owner.name} > ${queue.purpose}` : queue.purpose
    }
    if (queue.scope_type === 'team') {
      const team = teams.find((t) => (t._id || t.id) === queue.scope_id)
      return team ? `${team.name} > ${queue.purpose}` : queue.purpose
    }
    return `Everyone > ${queue.purpose}`
  }

  const allActiveTasks = tasks.filter((t) => ['queued', 'checked_out', 'in_progress'].includes(t.status))
  const activeTasks = selectedQueueFilter === 'all'
    ? allActiveTasks
    : allActiveTasks.filter((t) => t.queue_id === selectedQueueFilter)

  const userQueues = queues.filter((q) => q.scope_type === 'user' && q.scope_id === user?.id)
  const teamQueues = queues.filter((q) => q.scope_type === 'team')
  const orgQueues = queues.filter((q) => q.scope_type === 'organization')

  const headerAction = (
    <span className="text-sm text-gray-500">{activeTasks.length} task{activeTasks.length !== 1 ? 's' : ''}</span>
  )

  return (
    <WidgetWrapper widgetId={widgetId} title="My Active Tasks" headerAction={headerAction}>
      <div className="flex flex-col h-full">
        <div className="px-4 py-3 flex flex-wrap gap-2 border-b border-gray-100">
          <button
            onClick={() => setSelectedQueueFilter('all')}
            className={`px-3 py-1.5 text-sm font-medium rounded-full transition-colors ${
              selectedQueueFilter === 'all'
                ? 'bg-primary-100 text-primary-700'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            All ({allActiveTasks.length})
          </button>
          {userQueues.map((queue) => {
            const count = allActiveTasks.filter((t) => t.queue_id === (queue._id || queue.id)).length
            return (
              <button
                key={queue._id || queue.id}
                onClick={() => setSelectedQueueFilter(queue._id || queue.id)}
                className={`px-3 py-1.5 text-sm font-medium rounded-full transition-colors ${
                  selectedQueueFilter === (queue._id || queue.id)
                    ? 'bg-blue-100 text-blue-700'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {getQueueDisplayName(queue)} ({count})
              </button>
            )
          })}
          {teamQueues.map((queue) => {
            const count = allActiveTasks.filter((t) => t.queue_id === (queue._id || queue.id)).length
            return (
              <button
                key={queue._id || queue.id}
                onClick={() => setSelectedQueueFilter(queue._id || queue.id)}
                className={`px-3 py-1.5 text-sm font-medium rounded-full transition-colors ${
                  selectedQueueFilter === (queue._id || queue.id)
                    ? 'bg-primary-100 text-primary-700'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {getQueueDisplayName(queue)} ({count})
              </button>
            )
          })}
          {orgQueues.map((queue) => {
            const count = allActiveTasks.filter((t) => t.queue_id === (queue._id || queue.id)).length
            return (
              <button
                key={queue._id || queue.id}
                onClick={() => setSelectedQueueFilter(queue._id || queue.id)}
                className={`px-3 py-1.5 text-sm font-medium rounded-full transition-colors ${
                  selectedQueueFilter === (queue._id || queue.id)
                    ? 'bg-green-100 text-green-700'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {getQueueDisplayName(queue)} ({count})
              </button>
            )
          })}
        </div>

        <div className="flex-1 overflow-auto">
          {loading.tasks ? (
            <div className="p-4 text-gray-500">Loading...</div>
          ) : activeTasks.length === 0 ? (
            <div className="p-4 text-gray-500">No active tasks</div>
          ) : (
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Task
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Queue
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {activeTasks.slice(0, 10).map((task) => {
                  const queue = queues.find((q) => (q._id || q.id) === task.queue_id)
                  return (
                    <tr key={task._id || task.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <div>
                          <p className="font-medium text-gray-900">{task.title}</p>
                          {task.description && (
                            <p className="text-sm text-gray-500 truncate max-w-md">{task.description}</p>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-sm text-gray-700">{queue ? getQueueDisplayName(queue) : 'Unknown'}</span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>

        {activeTasks.length > 5 && (
          <div className="px-4 py-3 border-t border-gray-200 flex-shrink-0">
            <Link to="/tasks" className="text-blue-600 hover:text-blue-700 text-sm font-medium">
              View all tasks
            </Link>
          </div>
        )}
      </div>
    </WidgetWrapper>
  )
}
