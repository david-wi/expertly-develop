import { useEffect, useState } from 'react'
import { useAppStore } from '../stores/appStore'
import { Task } from '../services/api'
import { Trophy, Calendar, TrendingUp, Users, User } from 'lucide-react'

type TimeFilter = 'today' | 'week' | 'month'
type GroupBy = 'none' | 'user' | 'queue'

export default function Wins() {
  const { user, queues, tasks, loading, fetchUser, fetchQueues, fetchTasks } = useAppStore()
  const [timeFilter, setTimeFilter] = useState<TimeFilter>('today')
  const [groupBy, setGroupBy] = useState<GroupBy>('none')

  useEffect(() => {
    fetchUser()
    fetchQueues()
    fetchTasks()
  }, [fetchUser, fetchQueues, fetchTasks])

  const getDateRange = (filter: TimeFilter): { start: Date; end: Date } => {
    const now = new Date()
    const end = new Date(now)
    end.setHours(23, 59, 59, 999)

    const start = new Date(now)
    start.setHours(0, 0, 0, 0)

    if (filter === 'week') {
      const dayOfWeek = start.getDay()
      start.setDate(start.getDate() - dayOfWeek)
    } else if (filter === 'month') {
      start.setDate(1)
    }

    return { start, end }
  }

  const { start, end } = getDateRange(timeFilter)

  const completedTasks = tasks.filter((t) => {
    if (t.status !== 'completed') return false
    const completedDate = new Date(t.updated_at)
    return completedDate >= start && completedDate <= end
  })

  const groupTasks = (tasksToGroup: Task[]): Map<string, Task[]> => {
    const grouped = new Map<string, Task[]>()

    if (groupBy === 'none') {
      grouped.set('all', tasksToGroup)
      return grouped
    }

    tasksToGroup.forEach((task) => {
      let key: string
      if (groupBy === 'user') {
        key = task.assigned_to_id || 'Unassigned'
      } else {
        const queue = queues.find((q) => (q._id || q.id) === task.queue_id)
        key = queue?.purpose || 'Unknown Queue'
      }

      if (!grouped.has(key)) {
        grouped.set(key, [])
      }
      grouped.get(key)!.push(task)
    })

    return grouped
  }

  const groupedTasks = groupTasks(completedTasks)

  const getTimeFilterLabel = (filter: TimeFilter): string => {
    switch (filter) {
      case 'today':
        return 'Today'
      case 'week':
        return 'This Week'
      case 'month':
        return 'This Month'
    }
  }

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    })
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <Trophy className="h-8 w-8 text-yellow-500" />
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Wins</h2>
            <p className="text-sm text-gray-500">Celebrate what you've accomplished</p>
          </div>
        </div>
      </div>

      {/* Stats Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div
          onClick={() => setTimeFilter('today')}
          className={`bg-white shadow rounded-lg p-4 cursor-pointer transition-all ${
            timeFilter === 'today' ? 'ring-2 ring-yellow-400' : 'hover:shadow-md'
          }`}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Today</p>
              <p className="text-3xl font-bold text-green-600">
                {tasks.filter((t) => {
                  if (t.status !== 'completed') return false
                  const today = new Date().toDateString()
                  return new Date(t.updated_at).toDateString() === today
                }).length}
              </p>
            </div>
            <Calendar className="h-8 w-8 text-gray-300" />
          </div>
        </div>
        <div
          onClick={() => setTimeFilter('week')}
          className={`bg-white shadow rounded-lg p-4 cursor-pointer transition-all ${
            timeFilter === 'week' ? 'ring-2 ring-yellow-400' : 'hover:shadow-md'
          }`}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">This Week</p>
              <p className="text-3xl font-bold text-green-600">
                {tasks.filter((t) => {
                  if (t.status !== 'completed') return false
                  const now = new Date()
                  const weekStart = new Date(now)
                  weekStart.setDate(weekStart.getDate() - weekStart.getDay())
                  weekStart.setHours(0, 0, 0, 0)
                  return new Date(t.updated_at) >= weekStart
                }).length}
              </p>
            </div>
            <TrendingUp className="h-8 w-8 text-gray-300" />
          </div>
        </div>
        <div
          onClick={() => setTimeFilter('month')}
          className={`bg-white shadow rounded-lg p-4 cursor-pointer transition-all ${
            timeFilter === 'month' ? 'ring-2 ring-yellow-400' : 'hover:shadow-md'
          }`}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">This Month</p>
              <p className="text-3xl font-bold text-green-600">
                {tasks.filter((t) => {
                  if (t.status !== 'completed') return false
                  const now = new Date()
                  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
                  return new Date(t.updated_at) >= monthStart
                }).length}
              </p>
            </div>
            <Trophy className="h-8 w-8 text-gray-300" />
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white shadow rounded-lg p-4">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center space-x-2">
            <span className="text-sm font-medium text-gray-700">Group by:</span>
            <div className="flex rounded-lg overflow-hidden border border-gray-200">
              <button
                onClick={() => setGroupBy('none')}
                className={`px-3 py-1.5 text-sm font-medium transition-colors ${
                  groupBy === 'none'
                    ? 'bg-primary-100 text-primary-700'
                    : 'bg-white text-gray-600 hover:bg-gray-50'
                }`}
              >
                All
              </button>
              <button
                onClick={() => setGroupBy('user')}
                className={`px-3 py-1.5 text-sm font-medium transition-colors border-l border-gray-200 flex items-center space-x-1 ${
                  groupBy === 'user'
                    ? 'bg-primary-100 text-primary-700'
                    : 'bg-white text-gray-600 hover:bg-gray-50'
                }`}
              >
                <User className="h-4 w-4" />
                <span>By Person</span>
              </button>
              <button
                onClick={() => setGroupBy('queue')}
                className={`px-3 py-1.5 text-sm font-medium transition-colors border-l border-gray-200 flex items-center space-x-1 ${
                  groupBy === 'queue'
                    ? 'bg-primary-100 text-primary-700'
                    : 'bg-white text-gray-600 hover:bg-gray-50'
                }`}
              >
                <Users className="h-4 w-4" />
                <span>By Queue</span>
              </button>
            </div>
          </div>
          <div className="text-sm text-gray-500">
            Showing <span className="font-medium text-gray-900">{completedTasks.length}</span> completed tasks for {getTimeFilterLabel(timeFilter).toLowerCase()}
          </div>
        </div>
      </div>

      {/* Wins List */}
      <div className="space-y-4">
        {loading.tasks ? (
          <div className="bg-white shadow rounded-lg p-8 text-center text-gray-500">
            Loading your wins...
          </div>
        ) : completedTasks.length === 0 ? (
          <div className="bg-white shadow rounded-lg p-8 text-center">
            <Trophy className="h-12 w-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500">No completed tasks {getTimeFilterLabel(timeFilter).toLowerCase()}</p>
            <p className="text-sm text-gray-400 mt-1">Complete some tasks to see your wins here!</p>
          </div>
        ) : (
          Array.from(groupedTasks.entries()).map(([groupName, groupTasks]) => (
            <div key={groupName} className="bg-white shadow rounded-lg overflow-hidden">
              {groupBy !== 'none' && (
                <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
                  <div className="flex items-center justify-between">
                    <h3 className="font-medium text-gray-900">{groupName}</h3>
                    <span className="text-sm text-gray-500">{groupTasks.length} win{groupTasks.length !== 1 ? 's' : ''}</span>
                  </div>
                </div>
              )}
              <ul className="divide-y divide-gray-200">
                {groupTasks.map((task) => {
                  const queue = queues.find((q) => (q._id || q.id) === task.queue_id)
                  return (
                    <li key={task._id || task.id} className="px-4 py-4 hover:bg-green-50 transition-colors">
                      <div className="flex items-start space-x-3">
                        <div className="flex-shrink-0 mt-1">
                          <span className="inline-flex items-center justify-center h-6 w-6 rounded-full bg-green-100">
                            <Trophy className="h-3.5 w-3.5 text-green-600" />
                          </span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-gray-900">{task.title}</p>
                          {task.description && (
                            <p className="text-sm text-gray-500 mt-0.5 line-clamp-2">{task.description}</p>
                          )}
                          <div className="flex items-center space-x-3 mt-2 text-xs text-gray-400">
                            <span>Completed {formatDate(task.updated_at)}</span>
                            {queue && <span>• {queue.purpose}</span>}
                            {task.assigned_to_id && groupBy !== 'user' && (
                              <span>• {task.assigned_to_id}</span>
                            )}
                          </div>
                        </div>
                      </div>
                    </li>
                  )
                })}
              </ul>
            </div>
          ))
        )}
      </div>

      {/* Motivation Footer */}
      {completedTasks.length > 0 && (
        <div className="bg-gradient-to-r from-yellow-50 to-green-50 rounded-lg p-6 text-center">
          <p className="text-lg font-medium text-gray-800">
            {completedTasks.length === 1
              ? "Great job completing a task!"
              : completedTasks.length < 5
              ? "You're making progress!"
              : completedTasks.length < 10
              ? "Excellent work!"
              : "You're on fire! Amazing productivity!"}
          </p>
          <p className="text-sm text-gray-600 mt-1">
            Keep up the momentum {user?.name ? `, ${user.name.split(' ')[0]}` : ''}!
          </p>
        </div>
      )}
    </div>
  )
}
