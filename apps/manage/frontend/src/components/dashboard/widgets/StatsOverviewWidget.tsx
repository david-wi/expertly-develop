import { CheckCircle2, Clock, Layers, ListTodo, TrendingUp } from 'lucide-react'
import { WidgetWrapper } from '../WidgetWrapper'
import { WidgetProps } from './types'
import { useAppStore } from '../../../stores/appStore'
import { Tooltip } from '../../ui/Tooltip'

interface StatCardProps {
  label: string
  value: number
  icon: React.ReactNode
  color: 'blue' | 'green' | 'purple' | 'amber'
  tooltip: string
  trend?: { value: number; label: string }
}

function StatCard({ label, value, icon, color, tooltip, trend }: StatCardProps) {
  const colorStyles = {
    blue: {
      bg: 'bg-blue-50',
      iconBg: 'bg-blue-100',
      iconColor: 'text-blue-600',
      valueColor: 'text-blue-700',
      trendColor: 'text-blue-600',
    },
    green: {
      bg: 'bg-emerald-50',
      iconBg: 'bg-emerald-100',
      iconColor: 'text-emerald-600',
      valueColor: 'text-emerald-700',
      trendColor: 'text-emerald-600',
    },
    purple: {
      bg: 'bg-violet-50',
      iconBg: 'bg-violet-100',
      iconColor: 'text-violet-600',
      valueColor: 'text-violet-700',
      trendColor: 'text-violet-600',
    },
    amber: {
      bg: 'bg-amber-50',
      iconBg: 'bg-amber-100',
      iconColor: 'text-amber-600',
      valueColor: 'text-amber-700',
      trendColor: 'text-amber-600',
    },
  }

  const styles = colorStyles[color]

  return (
    <Tooltip content={tooltip} position="top">
      <div className={`${styles.bg} rounded-xl p-4 transition-all hover:shadow-md cursor-default`}>
        <div className="flex items-center justify-between">
          <div className={`${styles.iconBg} ${styles.iconColor} p-2 rounded-lg`}>
            {icon}
          </div>
          <div className="flex items-center gap-2">
            {trend && (
              <div className={`flex items-center gap-1 text-xs font-medium ${styles.trendColor}`}>
                <TrendingUp className="w-3 h-3" />
                <span>{trend.value}</span>
              </div>
            )}
            <p className={`text-3xl font-bold ${styles.valueColor}`}>{value}</p>
          </div>
        </div>
        <p className="text-sm text-gray-600 mt-2">{label}</p>
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

  // Calculate tasks completed yesterday for trend
  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)

  const completedYesterday = tasks.filter((t) => {
    if (t.status !== 'completed') return false
    const updatedAt = new Date(t.updated_at)
    updatedAt.setHours(0, 0, 0, 0)
    return updatedAt.getTime() === yesterday.getTime()
  })

  const todayTrend = completedToday.length - completedYesterday.length

  return (
    <WidgetWrapper widgetId={widgetId} title="Overview">
      <div className="p-4">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            label="Active Tasks"
            value={activeTasks.length}
            icon={<Clock className="w-5 h-5" />}
            color="blue"
            tooltip="Tasks currently queued, checked out, or in progress"
          />
          <StatCard
            label="Completed Today"
            value={completedToday.length}
            icon={<CheckCircle2 className="w-5 h-5" />}
            color="green"
            tooltip="Tasks marked as completed since midnight today"
            trend={todayTrend !== 0 ? { value: Math.abs(todayTrend), label: todayTrend > 0 ? 'more' : 'fewer' } : undefined}
          />
          <StatCard
            label="Queues"
            value={queues.length}
            icon={<Layers className="w-5 h-5" />}
            color="purple"
            tooltip="Total number of task queues you have access to"
          />
          <StatCard
            label="Total Tasks"
            value={tasks.length}
            icon={<ListTodo className="w-5 h-5" />}
            color="amber"
            tooltip="All tasks across all queues and statuses"
          />
        </div>
      </div>
    </WidgetWrapper>
  )
}
