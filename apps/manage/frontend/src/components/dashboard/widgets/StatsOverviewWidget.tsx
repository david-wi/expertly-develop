import { WidgetWrapper } from '../WidgetWrapper'
import { WidgetProps } from './types'
import { useAppStore } from '../../../stores/appStore'

export function StatsOverviewWidget({ widgetId }: WidgetProps) {
  const { tasks, queues } = useAppStore()

  const activeTasks = tasks.filter((t) => ['queued', 'checked_out', 'in_progress'].includes(t.status))
  const completedToday = tasks.filter((t) => {
    if (t.status !== 'completed') return false
    const today = new Date().toDateString()
    return new Date(t.updated_at).toDateString() === today
  })

  return (
    <WidgetWrapper widgetId={widgetId} title="Overview">
      <div className="p-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center">
            <p className="text-sm text-gray-500">Active Tasks</p>
            <p className="text-3xl font-bold text-gray-900">{activeTasks.length}</p>
          </div>
          <div className="text-center">
            <p className="text-sm text-gray-500">Completed Today</p>
            <p className="text-3xl font-bold text-green-600">{completedToday.length}</p>
          </div>
          <div className="text-center">
            <p className="text-sm text-gray-500">Queues</p>
            <p className="text-3xl font-bold text-gray-900">{queues.length}</p>
          </div>
          <div className="text-center">
            <p className="text-sm text-gray-500">Total Tasks</p>
            <p className="text-3xl font-bold text-gray-900">{tasks.length}</p>
          </div>
        </div>
      </div>
    </WidgetWrapper>
  )
}
