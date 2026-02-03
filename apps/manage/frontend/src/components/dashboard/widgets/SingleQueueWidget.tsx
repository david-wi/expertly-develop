import { Link } from 'react-router-dom'
import { WidgetWrapper } from '../WidgetWrapper'
import { WidgetProps } from './types'
import { useAppStore } from '../../../stores/appStore'
import { Inbox } from 'lucide-react'

export function SingleQueueWidget({ widgetId, config }: WidgetProps) {
  const { tasks, queues, loading } = useAppStore()

  const queue = queues.find(q => (q._id || q.id) === config.queueId)

  const queueTasks = tasks.filter(t => t.queue_id === config.queueId)
  const counts = {
    queued: queueTasks.filter(t => t.status === 'queued').length,
    inProgress: queueTasks.filter(t => ['checked_out', 'in_progress'].includes(t.status)).length,
    completed: queueTasks.filter(t => t.status === 'completed').length,
  }

  const activeTasks = queueTasks.filter(t =>
    ['queued', 'checked_out', 'in_progress'].includes(t.status)
  ).slice(0, 5)

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
              {activeTasks.map(task => (
                <li
                  key={task._id || task.id}
                  className="flex items-center gap-2 p-2 bg-gray-50 rounded-lg"
                >
                  <Inbox className="w-4 h-4 text-gray-400 flex-shrink-0" />
                  <span className="text-sm text-gray-900 truncate">{task.title}</span>
                  <span className={`ml-auto text-xs px-2 py-0.5 rounded ${
                    task.status === 'queued'
                      ? 'bg-blue-100 text-blue-700'
                      : 'bg-yellow-100 text-yellow-700'
                  }`}>
                    {task.status === 'queued' ? 'Queued' : 'Active'}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-gray-500 text-sm">No active tasks in this queue</p>
          )}
        </div>
      )}
    </WidgetWrapper>
  )
}
