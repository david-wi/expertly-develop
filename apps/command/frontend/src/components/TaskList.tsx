import { useState, useRef } from 'react'
import { Check, Star } from 'lucide-react'
import { Task, Project, User } from '../services/api'
import { formatDuration, parseDuration } from '../utils/duration'
import { STATUS_COLORS, PHASE_CONFIG } from '../utils/taskDisplay'

interface TaskListColumns {
  showAssignee?: boolean
  showDuration?: boolean
  showProject?: boolean
  showPlaybook?: boolean
  showPhase?: boolean
  showStatus?: boolean
  editableDuration?: boolean
}

interface TaskListProps {
  tasks: Task[]
  projects: Project[]
  users?: User[]
  queues?: { _id?: string; id: string; purpose: string }[]
  playbooks?: { _id?: string; id: string; name: string }[]
  columns?: TaskListColumns
  compact?: boolean
  selectedTaskId?: string | null
  completingTaskId?: string | null
  onTaskClick: (taskId: string) => void
  onQuickComplete: (e: React.MouseEvent, taskId: string) => void
  onToggleStar: (e: React.MouseEvent, taskId: string) => void
  onTaskDoubleClick?: (taskId: string) => void
  // Drag props
  draggable?: boolean
  dragState?: { draggedTaskId: string | null; dragOverTaskId: string | null }
  onDragStart?: (e: React.DragEvent, taskId: string) => void
  onDragOver?: (e: React.DragEvent, taskId: string) => void
  onDragLeave?: () => void
  onDrop?: (e: React.DragEvent, taskId: string, taskList: Task[]) => void
  onDragEnd?: () => void
  // Inline duration editing
  onDurationSave?: (taskId: string, newSeconds: number | null) => void
  emptyMessage?: string
}

export default function TaskList({
  tasks,
  projects,
  users,
  queues,
  playbooks,
  columns = {},
  compact = false,
  selectedTaskId,
  completingTaskId,
  onTaskClick,
  onQuickComplete,
  onToggleStar,
  onTaskDoubleClick,
  draggable = false,
  dragState,
  onDragStart,
  onDragOver,
  onDragLeave,
  onDrop,
  onDragEnd,
  onDurationSave,
  emptyMessage = 'No tasks',
}: TaskListProps) {
  // Inline duration editing state (managed internally)
  const [inlineDurationTaskId, setInlineDurationTaskId] = useState<string | null>(null)
  const [inlineDurationValue, setInlineDurationValue] = useState('')
  const inlineDurationRef = useRef<HTMLInputElement>(null)

  if (tasks.length === 0) {
    return <div className="p-3 text-xs text-gray-500">{emptyMessage}</div>
  }

  const getProjectName = (projectId: string | undefined) => {
    if (!projectId) return null
    const project = projects.find((p) => (p._id || p.id) === projectId)
    return project?.name || null
  }

  const getQueueName = (queueId: string) => {
    if (!queues) return ''
    const queue = queues.find((q) => (q._id || q.id) === queueId)
    return queue?.purpose || ''
  }

  const getUserName = (userId: string | undefined) => {
    if (!userId || !users) return null
    const user = users.find((u) => (u._id || u.id) === userId)
    return user?.name || null
  }

  const getPlaybookName = (playbookId: string | undefined) => {
    if (!playbookId || !playbooks) return null
    const playbook = playbooks.find((p) => (p._id || p.id) === playbookId)
    return playbook?.name || null
  }

  const startInlineDurationEdit = (e: React.MouseEvent, taskId: string, currentDuration: number | undefined) => {
    e.stopPropagation()
    setInlineDurationTaskId(taskId)
    setInlineDurationValue(formatDuration(currentDuration))
    setTimeout(() => inlineDurationRef.current?.focus(), 0)
  }

  const saveInlineDuration = () => {
    if (!inlineDurationTaskId || !onDurationSave) {
      setInlineDurationTaskId(null)
      setInlineDurationValue('')
      return
    }

    const parsed = parseDuration(inlineDurationValue)
    const task = tasks.find(t => (t._id || t.id) === inlineDurationTaskId)
    const originalDuration = task?.estimated_duration || null

    const taskIdToSave = inlineDurationTaskId
    setInlineDurationTaskId(null)
    setInlineDurationValue('')

    if (parsed !== originalDuration) {
      onDurationSave(taskIdToSave, parsed)
    }
  }

  return (
    <div className={`divide-y divide-gray-100 ${compact ? 'max-h-80 overflow-auto' : ''}`}>
      {tasks.map((task) => {
        const taskId = task._id || task.id
        const queueName = getQueueName(task.queue_id)
        const isDragging = dragState?.draggedTaskId === taskId
        const isDragOver = dragState?.dragOverTaskId === taskId
        const isSelected = selectedTaskId === taskId

        return (
          <div
            key={taskId}
            draggable={draggable}
            onDragStart={onDragStart ? (e) => onDragStart(e, taskId) : undefined}
            onDragOver={onDragOver ? (e) => onDragOver(e, taskId) : undefined}
            onDragLeave={onDragLeave}
            onDrop={onDrop ? (e) => onDrop(e, taskId, tasks) : undefined}
            onDragEnd={onDragEnd}
            onClick={() => onTaskClick(taskId)}
            onDoubleClick={onTaskDoubleClick ? () => onTaskDoubleClick(taskId) : undefined}
            className={`flex items-center gap-1.5 px-2 py-1 hover:bg-gray-50 transition-colors cursor-pointer ${
              isDragging ? 'opacity-50 bg-gray-100' : ''
            } ${isDragOver ? 'border-t-2 border-primary-500' : ''} ${isSelected ? 'bg-primary-50 border-l-2 border-primary-500' : ''}`}
            title={queueName}
          >
            {/* Drag handle */}
            {draggable && (
              <div className="flex-shrink-0 cursor-grab active:cursor-grabbing text-gray-400 hover:text-gray-600">
                <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M7 2a2 2 0 1 0 .001 4.001A2 2 0 0 0 7 2zm0 6a2 2 0 1 0 .001 4.001A2 2 0 0 0 7 8zm0 6a2 2 0 1 0 .001 4.001A2 2 0 0 0 7 14zm6-8a2 2 0 1 0-.001-4.001A2 2 0 0 0 13 6zm0 2a2 2 0 1 0 .001 4.001A2 2 0 0 0 13 8zm0 6a2 2 0 1 0 .001 4.001A2 2 0 0 0 13 14z" />
                </svg>
              </div>
            )}

            {/* Complete checkmark */}
            <button
              onClick={(e) => onQuickComplete(e, taskId)}
              onMouseDown={(e) => e.stopPropagation()}
              draggable={false}
              disabled={completingTaskId === taskId}
              className={`flex-shrink-0 p-0.5 rounded transition-colors ${
                completingTaskId === taskId
                  ? 'text-gray-300 cursor-wait'
                  : 'text-gray-300 hover:text-green-500 hover:bg-green-50'
              }`}
              title="Mark as complete"
            >
              <Check className="w-3.5 h-3.5" />
            </button>

            {/* Priority star */}
            <button
              onClick={(e) => onToggleStar(e, taskId)}
              onMouseDown={(e) => e.stopPropagation()}
              draggable={false}
              className={`flex-shrink-0 p-0.5 rounded transition-colors ${
                task.is_starred
                  ? 'text-amber-400 hover:text-amber-500'
                  : 'text-gray-300 hover:text-amber-400'
              }`}
              title={task.is_starred ? 'Remove priority' : 'Mark as priority'}
            >
              <Star className={`w-3.5 h-3.5 ${task.is_starred ? 'fill-current' : ''}`} />
            </button>

            {/* Task title */}
            <div className="flex-1 min-w-0">
              <p className={`text-xs font-medium truncate ${isSelected ? 'text-primary-700' : 'text-gray-900'}`}>
                {task.title}
              </p>
            </div>

            {/* Assignee */}
            {columns.showAssignee && (() => {
              const assigneeName = getUserName(task.assigned_to_id)
              return assigneeName ? (
                <div className="flex-shrink-0 max-w-24">
                  <span className="text-[10px] text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded truncate block">
                    {assigneeName}
                  </span>
                </div>
              ) : null
            })()}

            {/* Duration column - editable or read-only */}
            {columns.showDuration && columns.editableDuration && onDurationSave ? (
              <div className="flex-shrink-0 w-12" onClick={(e) => e.stopPropagation()}>
                {inlineDurationTaskId === taskId ? (
                  <input
                    ref={inlineDurationRef}
                    type="text"
                    value={inlineDurationValue}
                    onChange={(e) => setInlineDurationValue(e.target.value)}
                    onBlur={saveInlineDuration}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        saveInlineDuration()
                      } else if (e.key === 'Escape') {
                        setInlineDurationTaskId(null)
                        setInlineDurationValue('')
                      }
                    }}
                    placeholder="0:10"
                    className="w-full text-[10px] text-gray-700 font-mono bg-white border border-primary-300 rounded px-1 py-0.5 outline-none focus:ring-1 focus:ring-primary-200"
                  />
                ) : (
                  <button
                    onClick={(e) => startInlineDurationEdit(e, taskId, task.estimated_duration)}
                    className="w-full text-left px-1 py-0.5 rounded hover:bg-gray-100 transition-colors group"
                    title="Click to set duration"
                  >
                    {task.estimated_duration ? (
                      <span className="text-[10px] text-gray-500 font-mono">
                        {formatDuration(task.estimated_duration)}
                      </span>
                    ) : (
                      <span className="text-[10px] text-gray-300 group-hover:text-gray-400 font-mono">
                        --:--
                      </span>
                    )}
                  </button>
                )}
              </div>
            ) : columns.showDuration && task.estimated_duration ? (
              <div className="flex-shrink-0 w-10">
                <span className="text-[10px] text-gray-500 font-mono" title="Estimated duration">
                  {formatDuration(task.estimated_duration)}
                </span>
              </div>
            ) : null}

            {/* Project badge */}
            {columns.showProject && (() => {
              const projectName = getProjectName(task.project_id)
              return projectName ? (
                <div className="flex-shrink-0 w-24">
                  <span className="text-[10px] text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded truncate block">
                    {projectName}
                  </span>
                </div>
              ) : null
            })()}

            {/* Playbook badge */}
            {columns.showPlaybook && (() => {
              const playbookName = getPlaybookName(task.playbook_id)
              return playbookName ? (
                <div className="flex-shrink-0 w-24">
                  <span className="text-[10px] text-purple-600 bg-purple-50 px-1.5 py-0.5 rounded truncate block">
                    {playbookName}
                  </span>
                </div>
              ) : null
            })()}

            {/* Phase & Status badges */}
            {(columns.showPhase || columns.showStatus) && (
              <div className="flex items-center gap-1 flex-shrink-0">
                {columns.showPhase && task.phase && PHASE_CONFIG[task.phase] && (
                  <span
                    className={`text-[10px] px-1.5 py-0.5 rounded ${PHASE_CONFIG[task.phase].bg} ${PHASE_CONFIG[task.phase].text}`}
                  >
                    {PHASE_CONFIG[task.phase].label}
                  </span>
                )}
                {columns.showStatus && (
                  <span
                    className={`text-[10px] px-1.5 py-0.5 rounded ${
                      STATUS_COLORS[task.status] || 'bg-gray-100 text-gray-800'
                    }`}
                  >
                    {task.status.replace('_', ' ')}
                  </span>
                )}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
