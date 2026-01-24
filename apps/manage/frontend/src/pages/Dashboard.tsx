import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useAppStore } from '../stores/appStore'
import { useWebSocket } from '../hooks/useWebSocket'

export default function Dashboard() {
  const { user, queues, tasks, loading, wsConnected, fetchUser, fetchQueues, fetchTasks } = useAppStore()

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

  const activeTasks = tasks.filter((t) => ['queued', 'checked_out', 'in_progress'].includes(t.status))
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

      {/* Recent Active Tasks */}
      <div className="bg-white shadow rounded-lg">
        <div className="px-4 py-5 border-b border-gray-200">
          <h3 className="text-lg font-medium text-gray-900">Active Tasks</h3>
        </div>
        {loading.tasks ? (
          <div className="p-4 text-gray-500">Loading...</div>
        ) : (
          <ul className="divide-y divide-gray-200">
            {activeTasks.slice(0, 5).map((task) => (
              <li key={task._id || task.id} className="px-4 py-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-gray-900">{task.title}</p>
                    {task.description && (
                      <p className="text-sm text-gray-500 truncate max-w-md">{task.description}</p>
                    )}
                  </div>
                  <span
                    className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      task.status === 'queued'
                        ? 'bg-blue-100 text-blue-800'
                        : task.status === 'in_progress'
                        ? 'bg-yellow-100 text-yellow-800'
                        : 'bg-gray-100 text-gray-800'
                    }`}
                  >
                    {task.status.replace('_', ' ')}
                  </span>
                </div>
              </li>
            ))}
            {activeTasks.length === 0 && (
              <li className="px-4 py-4 text-gray-500">No active tasks</li>
            )}
          </ul>
        )}
        {activeTasks.length > 5 && (
          <div className="px-4 py-3 border-t border-gray-200">
            <Link to="/tasks" className="text-blue-600 hover:text-blue-700 text-sm font-medium">
              View all tasks →
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}
