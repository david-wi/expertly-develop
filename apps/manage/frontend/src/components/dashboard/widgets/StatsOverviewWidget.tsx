import { WidgetWrapper } from '../WidgetWrapper'
import { WidgetProps } from './types'
import { useAppStore } from '../../../stores/appStore'
import { Tooltip } from '../../ui/Tooltip'

interface StatItemProps {
  label: string
  value: number
  dotColor: string
  tooltip: string
  showDivider?: boolean
}

function StatItem({ label, value, dotColor, tooltip, showDivider = true }: StatItemProps) {
  return (
    <Tooltip content={tooltip} position="top">
      <div className="flex items-center cursor-default">
        <div className="flex-1 flex flex-col items-center py-4">
          <div className={`w-2.5 h-2.5 rounded-full mb-3 ${dotColor}`} />
          <p className="text-4xl font-bold text-gray-800 mb-1">{value}</p>
          <p className="text-sm text-gray-500">{label}</p>
        </div>
        {showDivider && <div className="w-px h-16 bg-gray-200 self-center" />}
      </div>
    </Tooltip>
  )
}

export function StatsOverviewWidget({ widgetId }: WidgetProps) {
  const { tasks, queues } = useAppStore()

  const activeTasks = tasks.filter((t) => ['queued', 'checked_out', 'in_progress'].includes(t.status))

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const completedToday = tasks.filter((t) => {
    if (t.status !== 'completed') return false
    const updatedAt = new Date(t.updated_at)
    updatedAt.setHours(0, 0, 0, 0)
    return updatedAt.getTime() === today.getTime()
  })

  return (
    <WidgetWrapper widgetId={widgetId} title="Overview" titleUnderline>
      <div className="grid grid-cols-2 lg:grid-cols-4">
        <StatItem
          label="Active Tasks"
          value={activeTasks.length}
          dotColor="bg-blue-400"
          tooltip="Tasks currently queued, checked out, or in progress"
        />
        <StatItem
          label="Completed Today"
          value={completedToday.length}
          dotColor="bg-teal-400"
          tooltip="Tasks marked as completed since midnight today"
        />
        <StatItem
          label="Queues"
          value={queues.length}
          dotColor="bg-violet-400"
          tooltip="Total number of task queues you have access to"
        />
        <StatItem
          label="Total Tasks"
          value={tasks.length}
          dotColor="bg-gray-300"
          tooltip="All tasks across all queues and statuses"
          showDivider={false}
        />
      </div>
    </WidgetWrapper>
  )
}
