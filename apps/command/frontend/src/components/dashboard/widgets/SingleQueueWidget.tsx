import { Link } from 'react-router-dom'
import { WidgetWrapper } from '../WidgetWrapper'
import { WidgetProps } from './types'
import { useAppStore } from '../../../stores/appStore'
import { Star } from 'lucide-react'
import { useToggleStar } from '../../../hooks/useToggleStar'

export function SingleQueueWidget({ widgetId, config }: WidgetProps) {
  const { tasks, queues, loading } = useAppStore()
  const handleToggleStar = useToggleStar()

  const queue = queues.find(q => (q._id || q.id) === config.queueId)

  const queueTasks = tasks.filter(t => t.queue_id === config.queueId)
  const counts = {
    queued: queueTasks.filter(t => t.status === 'queued').length,
    inProgress: queueTasks.filter(t => ['checked_out', 'in_progress'].includes(t.status)).length,
    completed: queueTasks.filter(t => t.status === 'completed').length,
  }

  const activeTasks = queueTasks.filter(t =>
    ['queued', 'checked_out', 'in_progress'].includes(t.status)
  ).sort((a, b) => {
    const starA = a.is_starred ? 0 : 1
    const starB = b.is_starred ? 0 : 1
    if (starA !== starB) return starA - starB
    const seqA = a.sequence ?? Number.MAX_VALUE
    const seqB = b.sequence ?? Number.MAX_VALUE
    if (seqA !== seqB) return seqA - seqB
    return new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  }).slice(0, 5)

  if (!config.queueId) {
    return (
      <WidgetWrapper widgetId={widgetId} title="Queue">
        <div className="p-4 text-gray-500">No queue selected</div>
      </WidgetWrapper>
    )
  }

  return (
    <WidgetWrapper
      widgetId={widgetId}
      title={queue?.purpose || 'Queue'}
      headerAction={
        <Link
          to={`/queues?id=${config.queueId}`}
          className="text-sm text-primary-600 hover:text-primary-700"
        >
          View All
        </Link>
      }
    >
      {loading.tasks ? (
        <div className="p-4 text-gray-500">Loading...</div>
      ) : (
        <div className="p-4">
          <div className="flex items-center gap-4 mb-4">
            <div className="flex items-center gap-2 text-sm">
              <span className="w-2 h-2 rounded-full bg-blue-500"></span>
              <span className="text-gray-600">{counts.queued} queued</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <span className="w-2 h-2 rounded-full bg-yellow-500"></span>
              <span className="text-gray-600">{counts.inProgress} active</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <span className="w-2 h-2 rounded-full bg-green-500"></span>
              <span className="text-gray-600">{counts.completed} done</span>
            </div>
          </div>

          {activeTasks.length > 0 ? (
            <ul className="space-y-2">
              {activeTasks.map(task => {
                const taskId = task._id || task.id
                return (
                  <li
                    key={taskId}
                    className="flex items-center gap-2 p-2 bg-gray-50 rounded-lg"
                  >
                    <button
                      onClick={(e) => handleToggleStar(e, taskId)}
                      className={`flex-shrink-0 p-0.5 rounded transition-colors ${
                        task.is_starred
                          ? 'text-amber-400 hover:text-amber-500'
                          : 'text-gray-300 hover:text-amber-400'
                      }`}
                      title={task.is_starred ? 'Remove priority' : 'Mark as priority'}
                    >
                      <Star className={`w-3.5 h-3.5 ${task.is_starred ? 'fill-current' : ''}`} />
                    </button>
                    <span className="text-sm text-gray-900 truncate">{task.title}</span>
                    <span className={`ml-auto text-xs px-2 py-0.5 rounded ${
                      task.status === 'queued'
                        ? 'bg-blue-100 text-blue-700'
                        : 'bg-yellow-100 text-yellow-700'
                    }`}>
                      {task.status === 'queued' ? 'Queued' : 'Active'}
                    </span>
                  </li>
                )
              })}
            </ul>
          ) : (
            <p className="text-gray-500 text-sm">No active tasks in this queue</p>
          )}
        </div>
      )}
    </WidgetWrapper>
  )
}
