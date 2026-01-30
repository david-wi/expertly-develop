import { useState, useEffect } from 'react'
import { ArrowUp, ArrowDown, CheckCircle, Clock, AlertCircle, Loader2 } from 'lucide-react'
import { api, TaskDependencyInfo } from '../services/api'

const STATUS_ICONS: Record<string, { icon: typeof CheckCircle; className: string }> = {
  completed: { icon: CheckCircle, className: 'text-green-500' },
  in_progress: { icon: Loader2, className: 'text-blue-500 animate-spin' },
  checked_out: { icon: Clock, className: 'text-yellow-500' },
  queued: { icon: Clock, className: 'text-gray-400' },
  blocked: { icon: AlertCircle, className: 'text-orange-500' },
  failed: { icon: AlertCircle, className: 'text-red-500' },
}

interface TaskDependenciesProps {
  taskId: string
  onNavigate?: (taskId: string) => void
  compact?: boolean
}

export default function TaskDependencies({ taskId, onNavigate, compact = false }: TaskDependenciesProps) {
  const [dependencies, setDependencies] = useState<TaskDependencyInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchDependencies = async () => {
      setLoading(true)
      setError(null)
      try {
        const result = await api.getTaskDependencies(taskId)
        setDependencies(result)
      } catch (e) {
        setError('Failed to load dependencies')
      } finally {
        setLoading(false)
      }
    }

    fetchDependencies()
  }, [taskId])

  if (loading) {
    return (
      <div className={`${compact ? 'text-sm' : ''} text-gray-500`}>
        Loading dependencies...
      </div>
    )
  }

  if (error) {
    return (
      <div className={`${compact ? 'text-sm' : ''} text-red-500`}>
        {error}
      </div>
    )
  }

  if (!dependencies) {
    return null
  }

  const hasUpstream = dependencies.upstream.length > 0
  const hasDownstream = dependencies.downstream.length > 0

  if (!hasUpstream && !hasDownstream) {
    return (
      <div className={`${compact ? 'text-sm' : ''} text-gray-500`}>
        No dependencies
      </div>
    )
  }

  const renderTask = (task: { id: string; title: string; status: string }) => {
    const statusConfig = STATUS_ICONS[task.status] || STATUS_ICONS.queued
    const StatusIcon = statusConfig.icon

    return (
      <button
        key={task.id}
        onClick={() => onNavigate?.(task.id)}
        className={`flex items-center gap-2 w-full text-left ${
          compact ? 'py-1 text-sm' : 'py-1.5'
        } hover:bg-gray-50 rounded px-2 -mx-2 transition-colors`}
        disabled={!onNavigate}
      >
        <StatusIcon className={`w-4 h-4 flex-shrink-0 ${statusConfig.className}`} />
        <span className="truncate flex-1 text-gray-700">{task.title}</span>
        <span className="text-xs text-gray-400 capitalize">{task.status.replace('_', ' ')}</span>
      </button>
    )
  }

  if (compact) {
    // Compact view: just show counts with icons
    const incompleteUpstream = dependencies.upstream.filter(t => t.status !== 'completed').length

    return (
      <div className="flex items-center gap-3 text-sm">
        {hasUpstream && (
          <div className={`flex items-center gap-1 ${incompleteUpstream > 0 ? 'text-orange-600' : 'text-green-600'}`}>
            <ArrowUp className="w-3.5 h-3.5" />
            <span>{incompleteUpstream > 0 ? `${incompleteUpstream} waiting` : `${dependencies.upstream.length} done`}</span>
          </div>
        )}
        {hasDownstream && (
          <div className="flex items-center gap-1 text-blue-600">
            <ArrowDown className="w-3.5 h-3.5" />
            <span>{dependencies.downstream.length} blocking</span>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {hasUpstream && (
        <div>
          <h4 className="text-sm font-medium text-gray-700 flex items-center gap-1.5 mb-2">
            <ArrowUp className="w-4 h-4 text-gray-400" />
            Waiting on ({dependencies.upstream.length})
          </h4>
          <div className="space-y-1 pl-1">
            {dependencies.upstream.map(renderTask)}
          </div>
        </div>
      )}

      {hasDownstream && (
        <div>
          <h4 className="text-sm font-medium text-gray-700 flex items-center gap-1.5 mb-2">
            <ArrowDown className="w-4 h-4 text-gray-400" />
            Blocking ({dependencies.downstream.length})
          </h4>
          <div className="space-y-1 pl-1">
            {dependencies.downstream.map(renderTask)}
          </div>
        </div>
      )}
    </div>
  )
}
