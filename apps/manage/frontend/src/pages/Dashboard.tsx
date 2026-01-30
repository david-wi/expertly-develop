import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAppStore } from '../stores/appStore'
import { useWebSocket } from '../hooks/useWebSocket'

export default function Dashboard() {
  const { user, queues, tasks, loading, wsConnected, fetchUser, fetchQueues, fetchTasks } = useAppStore()
  const [selectedQueueFilter, setSelectedQueueFilter] = useState<string>('all')

  // Connect WebSocket
  useWebSocket(user?.organization_id)

  useEffect(() => {
    fetchUser()
    fetchQueues()
    fetchTasks()
  }, [fetchUser, fetchQueues, fetchTasks])

  const getQueueTaskCounts = (queueId: string) => {
    const queueTasks = tasks.filter((t) => t.queue_id === queueId)
    return {
      total: queueTasks.length,
      queued: queueTasks.filter((t) => t.status === 'queued').length,
      inProgress: queueTasks.filter((t) => ['checked_out', 'in_progress'].includes(t.status)).length,
      completed: queueTasks.filter((t) => t.status === 'completed').length,
    }
  }

  const allActiveTasks = tasks.filter((t) => ['queued', 'checked_out', 'in_progress'].includes(t.status))

  // Filter active tasks by selected queue
  const activeTasks = selectedQueueFilter === 'all'
    ? allActiveTasks
    : allActiveTasks.filter((t) => t.queue_id === selectedQueueFilter)

  // Separate queues by type for the filter
  const userQueues = queues.filter((q) => q.scope_type === 'user' && q.scope_id === user?.id)
  const teamQueues = queues.filter((q) => q.scope_type === 'team')
  const orgQueues = queues.filter((q) => q.scope_type === 'organization')
  const completedToday = tasks.filter((t) => {
    if (t.status !== 'completed') return false
    const today = new Date().toDateString()
    return new Date(t.updated_at).toDateString() === today
  })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900">Dashboard</h2>
        <div className="flex items-center space-x-2">
          <span
            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
              wsConnected ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
            }`}
          >
            <span
              className={`w-2 h-2 mr-1.5 rounded-full ${wsConnected ? 'bg-green-400' : 'bg-gray-400'}`}
            />
            {wsConnected ? 'Live' : 'Offline'}
          </span>
        </div>
      </div>

      {user && (
        <div className="bg-white shadow rounded-lg p-4">
          <p className="text-gray-600">
            Welcome, <span className="font-medium text-gray-900">{user.name}</span>
          </p>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white shadow rounded-lg p-4">
          <p className="text-sm text-gray-500">Active Tasks</p>
          <p className="text-3xl font-bold text-gray-900">{activeTasks.length}</p>
        </div>
        <div className="bg-white shadow rounded-lg p-4">
          <p className="text-sm text-gray-500">Completed Today</p>
          <p className="text-3xl font-bold text-green-600">{completedToday.length}</p>
        </div>
        <div className="bg-white shadow rounded-lg p-4">
          <p className="text-sm text-gray-500">Queues</p>
          <p className="text-3xl font-bold text-gray-900">{queues.length}</p>
        </div>
        <div className="bg-white shadow rounded-lg p-4">
          <p className="text-sm text-gray-500">Total Tasks</p>
          <p className="text-3xl font-bold text-gray-900">{tasks.length}</p>
        </div>
      </div>

      {/* Active Tasks */}
      <div className="bg-white shadow rounded-lg">
        <div className="px-4 py-5 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-medium text-gray-900">Active Tasks</h3>
            <span className="text-sm text-gray-500">{activeTasks.length} task{activeTasks.length !== 1 ? 's' : ''}</span>
          </div>
          {/* Queue filter tabs */}
          <div className="mt-3 flex flex-wrap gap-2">
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
                  {queue.purpose} ({count})
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
                  {queue.purpose} ({count})
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
                  {queue.purpose} ({count})
                </button>
              )
            })}
          </div>
        </div>
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
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Priority
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {activeTasks.slice(0, 10).map((task) => {
                const queue = queues.find((q) => (q._id || q.id) === task.queue_id)
                return (
                  <tr key={task._id || task.id} className="hover:bg-gray-50">
                    <td className="px-4 py-4">
                      <div>
                        <p className="font-medium text-gray-900">{task.title}</p>
                        {task.description && (
                          <p className="text-sm text-gray-500 truncate max-w-md">{task.description}</p>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <span className="text-sm text-gray-700">{queue?.purpose || 'Unknown'}</span>
                    </td>
                    <td className="px-4 py-4">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          task.status === 'queued'
                            ? 'bg-blue-100 text-blue-800'
                            : task.status === 'in_progress'
                            ? 'bg-yellow-100 text-yellow-800'
                            : task.status === 'checked_out'
                            ? 'bg-orange-100 text-orange-800'
                            : 'bg-gray-100 text-gray-800'
                        }`}
                      >
                        {task.status.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      <span className="text-sm text-gray-600">{task.priority}</span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
        {activeTasks.length > 5 && (
          <div className="px-4 py-3 border-t border-gray-200">
            <Link to="/tasks" className="text-blue-600 hover:text-blue-700 text-sm font-medium">
              View all tasks →
            </Link>
          </div>
        )}
      </div>

      {/* Queues Overview */}
      <div className="bg-white shadow rounded-lg">
        <div className="px-4 py-5 border-b border-gray-200">
          <h3 className="text-lg font-medium text-gray-900">Queues</h3>
        </div>
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
                    className="block hover:bg-gray-50 px-4 py-4"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <p className="font-medium text-gray-900">{queue.purpose}</p>
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                          {queue.scope_type === 'user' && queue.scope_id === user?.id
                            ? user?.name
                            : queue.scope_type === 'user'
                            ? 'User'
                            : queue.scope_type === 'team'
                            ? 'Team'
                            : 'Everyone'}
                        </span>
                      </div>
                      <div className="flex items-center space-x-4 text-sm">
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
      </div>
    </div>
  )
}
