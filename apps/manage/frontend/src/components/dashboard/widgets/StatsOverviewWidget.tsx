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
      gradient: 'from-blue-50 to-blue-100/50',
      border: 'border-blue-200/60',
      iconBg: 'bg-gradient-to-br from-blue-500 to-blue-600',
      iconShadow: 'shadow-blue-500/25',
      valueColor: 'text-blue-700',
      trendColor: 'text-blue-600',
      trendBg: 'bg-blue-100/80',
    },
    green: {
      gradient: 'from-emerald-50 to-emerald-100/50',
      border: 'border-emerald-200/60',
      iconBg: 'bg-gradient-to-br from-emerald-500 to-emerald-600',
      iconShadow: 'shadow-emerald-500/25',
      valueColor: 'text-emerald-700',
      trendColor: 'text-emerald-600',
      trendBg: 'bg-emerald-100/80',
    },
    purple: {
      gradient: 'from-violet-50 to-violet-100/50',
      border: 'border-violet-200/60',
      iconBg: 'bg-gradient-to-br from-violet-500 to-violet-600',
      iconShadow: 'shadow-violet-500/25',
      valueColor: 'text-violet-700',
      trendColor: 'text-violet-600',
      trendBg: 'bg-violet-100/80',
    },
    amber: {
      gradient: 'from-amber-50 to-amber-100/50',
      border: 'border-amber-200/60',
      iconBg: 'bg-gradient-to-br from-amber-500 to-amber-600',
      iconShadow: 'shadow-amber-500/25',
      valueColor: 'text-amber-700',
      trendColor: 'text-amber-600',
      trendBg: 'bg-amber-100/80',
    },
  }

  const styles = colorStyles[color]

  return (
    <Tooltip content={tooltip} position="top">
      <div
        className={`bg-gradient-to-br ${styles.gradient} border ${styles.border} rounded-2xl p-5 transition-all duration-200 hover:shadow-lg hover:scale-[1.02] cursor-default h-full flex flex-col justify-between min-h-[120px]`}
      >
        <div className="flex items-start justify-between">
          <div
            className={`${styles.iconBg} text-white p-2.5 rounded-xl shadow-lg ${styles.iconShadow}`}
          >
            {icon}
          </div>
          <div className="text-right">
            <p className={`text-3xl font-bold ${styles.valueColor} tracking-tight`}>{value}</p>
          </div>
        </div>
        <div className="flex items-center justify-between mt-3">
          <p className="text-sm font-medium text-gray-600">{label}</p>
          <div className="h-5">
            {trend && trend.value > 0 && (
              <div
                className={`flex items-center gap-1 text-xs font-semibold ${styles.trendColor} ${styles.trendBg} px-2 py-0.5 rounded-full`}
              >
                <TrendingUp className="w-3 h-3" />
                <span>+{trend.value}</span>
              </div>
            )}
          </div>
        </div>
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
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 auto-rows-fr">
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
