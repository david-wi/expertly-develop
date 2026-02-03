import { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { WidgetWrapper } from '../WidgetWrapper'
import { WidgetProps } from './types'
import { useAppStore } from '../../../stores/appStore'
import { api, User as UserType, Team, TaskReorderItem } from '../../../services/api'
import TaskDetailModal from '../../../components/TaskDetailModal'

export function MyActiveTasksWidget({ widgetId }: WidgetProps) {
  const { user, tasks, queues, loading, fetchTasks } = useAppStore()
  const [selectedQueueFilter, setSelectedQueueFilter] = useState<string>('all')
  const [users, setUsers] = useState<UserType[]>([])
  const [teams, setTeams] = useState<Team[]>([])
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null)
  const [dragOverTaskId, setDragOverTaskId] = useState<string | null>(null)
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null)
  const [newTaskTitle, setNewTaskTitle] = useState('')
  const [newTaskInstructions, setNewTaskInstructions] = useState('')
  const [isCreating, setIsCreating] = useState(false)
  const [hoveredTaskId, setHoveredTaskId] = useState<string | null>(null)
  const titleInputRef = useRef<HTMLInputElement>(null)
  const instructionsRef = useRef<HTMLTextAreaElement>(null)
  const dragRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    api.getUsers().then(setUsers).catch(console.error)
    api.getTeams().then(setTeams).catch(console.error)
  }, [])

  const getQueueDisplayName = (queue: { scope_type: string; scope_id?: string; purpose: string }): string => {
    if (queue.scope_type === 'user') {
      if (queue.scope_id === user?.id) {
        return `${user?.name || 'You'} > ${queue.purpose}`
      }
      const owner = users.find((u) => (u._id || u.id) === queue.scope_id)
      return owner ? `${owner.name} > ${queue.purpose}` : queue.purpose
    }
    if (queue.scope_type === 'team') {
      const team = teams.find((t) => (t._id || t.id) === queue.scope_id)
      return team ? `${team.name} > ${queue.purpose}` : queue.purpose
    }
    return `Everyone > ${queue.purpose}`
  }

  const allActiveTasks = tasks.filter((t) => ['queued', 'checked_out', 'in_progress'].includes(t.status))

  // Sort by sequence (ascending), then by created_at for tasks without sequence
  const sortedActiveTasks = [...allActiveTasks].sort((a, b) => {
    const seqA = a.sequence ?? Number.MAX_VALUE
    const seqB = b.sequence ?? Number.MAX_VALUE
    if (seqA !== seqB) return seqA - seqB
    return new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  })

  const activeTasks = selectedQueueFilter === 'all'
    ? sortedActiveTasks
    : sortedActiveTasks.filter((t) => t.queue_id === selectedQueueFilter)

  const userQueues = queues.filter((q) => q.scope_type === 'user' && q.scope_id === user?.id)
  const teamQueues = queues.filter((q) => q.scope_type === 'team')
  const orgQueues = queues.filter((q) => q.scope_type === 'organization')

  const headerAction = (
    <span className="text-xs text-gray-500">{activeTasks.length} task{activeTasks.length !== 1 ? 's' : ''}</span>
  )

  const handleDragStart = (e: React.DragEvent, taskId: string) => {
    setDraggedTaskId(taskId)
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', taskId)
  }

  const handleDragOver = (e: React.DragEvent, taskId: string) => {
    e.preventDefault()
    if (taskId !== draggedTaskId) {
      setDragOverTaskId(taskId)
    }
  }

  const handleDragLeave = () => {
    setDragOverTaskId(null)
  }

  const handleDrop = async (e: React.DragEvent, targetTaskId: string) => {
    e.preventDefault()
    setDragOverTaskId(null)

    if (!draggedTaskId || draggedTaskId === targetTaskId) {
      setDraggedTaskId(null)
      return
    }

    const draggedIndex = activeTasks.findIndex((t) => (t._id || t.id) === draggedTaskId)
    const targetIndex = activeTasks.findIndex((t) => (t._id || t.id) === targetTaskId)

    if (draggedIndex === -1 || targetIndex === -1) {
      setDraggedTaskId(null)
      return
    }

    // Calculate new sequence value
    let newSequence: number
    const targetTask = activeTasks[targetIndex]
    const targetSeq = targetTask.sequence ?? 0

    if (draggedIndex < targetIndex) {
      // Moving down - place after target (need LARGER sequence)
      const nextTask = activeTasks[targetIndex + 1]
      if (nextTask) {
        const nextSeq = nextTask.sequence ?? targetSeq + 2
        newSequence = (targetSeq + nextSeq) / 2
      } else {
        newSequence = targetSeq + 1
      }
    } else {
      // Moving up - place before target (need SMALLER sequence)
      const prevTask = activeTasks[targetIndex - 1]
      if (prevTask) {
        const prevSeq = prevTask.sequence ?? targetSeq - 2
        newSequence = (prevSeq + targetSeq) / 2
      } else {
        newSequence = targetSeq - 1
      }
    }

    // Update via API
    const items: TaskReorderItem[] = [{ id: draggedTaskId, sequence: newSequence }]
    try {
      await api.reorderTasks(items)
      // Refresh tasks
      fetchTasks()
    } catch (err) {
      console.error('Failed to reorder tasks:', err)
    }

    setDraggedTaskId(null)
  }

  const handleDragEnd = () => {
    setDraggedTaskId(null)
    setDragOverTaskId(null)
  }

  // Get user's default queue for quick task creation
  const defaultQueue = userQueues[0]

  const handleCreateTask = async () => {
    if (!newTaskTitle.trim() || !defaultQueue || isCreating) return

    setIsCreating(true)
    try {
      await api.createTask({
        queue_id: defaultQueue._id || defaultQueue.id,
        title: newTaskTitle.trim(),
        description: newTaskInstructions.trim() || undefined,
      })
      setNewTaskTitle('')
      setNewTaskInstructions('')
      fetchTasks()
      // Re-focus title input for next task
      setTimeout(() => titleInputRef.current?.focus(), 0)
    } catch (err) {
      console.error('Failed to create task:', err)
    } finally {
      setIsCreating(false)
    }
  }

  const handleTitleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      if (newTaskTitle.trim()) {
        handleCreateTask()
      }
    } else if (e.key === 'Tab' && !e.shiftKey) {
      e.preventDefault()
      instructionsRef.current?.focus()
    }
  }

  const handleInstructionsKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      if (newTaskTitle.trim()) {
        handleCreateTask()
      }
    } else if (e.key === 'Tab' && e.shiftKey) {
      e.preventDefault()
      titleInputRef.current?.focus()
    }
  }

  const handleTitleBlur = (e: React.FocusEvent) => {
    // Check if focus is moving to the instructions field
    if (e.relatedTarget === instructionsRef.current) return
    // Don't submit if empty
    if (newTaskTitle.trim() && !isCreating) {
      handleCreateTask()
    }
  }

  const handleInstructionsBlur = (e: React.FocusEvent) => {
    // Check if focus is moving to the title field
    if (e.relatedTarget === titleInputRef.current) return
    // Don't submit if title is empty
    if (newTaskTitle.trim() && !isCreating) {
      handleCreateTask()
    }
  }

  return (
  <>
    <WidgetWrapper widgetId={widgetId} title="My Active Tasks" headerAction={headerAction}>
      <div className="flex flex-col h-full">
        <div className="px-3 py-2 flex flex-wrap gap-1.5 border-b border-gray-100">
          <button
            onClick={() => setSelectedQueueFilter('all')}
            className={`px-2 py-1 text-xs font-medium rounded-full transition-colors ${
              selectedQueueFilter === 'all'
                ? 'bg-primary-100 text-primary-700'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            All ({allActiveTasks.length})
          </button>
          {userQueues.map((queue) => {
            const count = allActiveTasks.filter((t) => t.queue_id === (queue._id || queue.id)).length
            return (
              <button
                key={queue._id || queue.id}
                onClick={() => setSelectedQueueFilter(queue._id || queue.id)}
                className={`px-2 py-1 text-xs font-medium rounded-full transition-colors ${
                  selectedQueueFilter === (queue._id || queue.id)
                    ? 'bg-blue-100 text-blue-700'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {getQueueDisplayName(queue)} ({count})
              </button>
            )
          })}
          {teamQueues.map((queue) => {
            const count = allActiveTasks.filter((t) => t.queue_id === (queue._id || queue.id)).length
            return (
              <button
                key={queue._id || queue.id}
                onClick={() => setSelectedQueueFilter(queue._id || queue.id)}
                className={`px-2 py-1 text-xs font-medium rounded-full transition-colors ${
                  selectedQueueFilter === (queue._id || queue.id)
                    ? 'bg-primary-100 text-primary-700'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {getQueueDisplayName(queue)} ({count})
              </button>
            )
          })}
          {orgQueues.map((queue) => {
            const count = allActiveTasks.filter((t) => t.queue_id === (queue._id || queue.id)).length
            return (
              <button
                key={queue._id || queue.id}
                onClick={() => setSelectedQueueFilter(queue._id || queue.id)}
                className={`px-2 py-1 text-xs font-medium rounded-full transition-colors ${
                  selectedQueueFilter === (queue._id || queue.id)
                    ? 'bg-green-100 text-green-700'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {getQueueDisplayName(queue)} ({count})
              </button>
            )
          })}
        </div>

        <div className="flex-1 flex overflow-hidden">
          {/* Task list (left side) */}
          <div className={`${hoveredTaskId ? 'w-1/2' : 'flex-1'} overflow-auto border-r border-gray-100 transition-all`} ref={dragRef}>
            {/* Quick task creation row */}
            {defaultQueue && (
              <div className="flex items-start gap-2 px-2 py-1.5 border-b border-gray-100 bg-gray-50/50">
                <div className="flex-shrink-0 text-gray-300 pt-0.5">
                  <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="flex-1 min-w-0 flex flex-col gap-1">
                  <input
                    ref={titleInputRef}
                    type="text"
                    placeholder="Add task... (Enter to save)"
                    value={newTaskTitle}
                    onChange={(e) => setNewTaskTitle(e.target.value)}
                    onKeyDown={handleTitleKeyDown}
                    onBlur={handleTitleBlur}
                    disabled={isCreating}
                    className="w-full text-xs font-medium text-gray-900 placeholder-gray-400 bg-transparent border-none outline-none focus:ring-0 p-0"
                  />
                  {newTaskTitle && (
                    <textarea
                      ref={instructionsRef}
                      placeholder="Instructions (optional, Tab to focus)"
                      value={newTaskInstructions}
                      onChange={(e) => setNewTaskInstructions(e.target.value)}
                      onKeyDown={handleInstructionsKeyDown}
                      onBlur={handleInstructionsBlur}
                      disabled={isCreating}
                      rows={2}
                      className="w-full text-xs text-gray-600 placeholder-gray-400 bg-white border border-gray-200 rounded px-2 py-1 outline-none focus:border-primary-300 focus:ring-1 focus:ring-primary-200 resize-none"
                    />
                  )}
                </div>
              </div>
            )}

            {loading.tasks ? (
              <div className="p-3 text-xs text-gray-500">Loading...</div>
            ) : activeTasks.length === 0 && !newTaskTitle ? (
              <div className="p-3 text-xs text-gray-500">No active tasks</div>
            ) : (
              <div className="divide-y divide-gray-100">
                {activeTasks.map((task) => {
                  const taskId = task._id || task.id
                  const queue = queues.find((q) => (q._id || q.id) === task.queue_id)
                  const queueName = queue ? getQueueDisplayName(queue) : 'Unknown'
                  const isDragging = draggedTaskId === taskId
                  const isDragOver = dragOverTaskId === taskId
                  const isHovered = hoveredTaskId === taskId

                  return (
                    <div
                      key={taskId}
                      draggable
                      onDragStart={(e) => handleDragStart(e, taskId)}
                      onDragOver={(e) => handleDragOver(e, taskId)}
                      onDragLeave={handleDragLeave}
                      onDrop={(e) => handleDrop(e, taskId)}
                      onDragEnd={handleDragEnd}
                      onMouseEnter={() => setHoveredTaskId(taskId)}
                      onMouseLeave={() => setHoveredTaskId(null)}
                      className={`flex items-center gap-1.5 px-2 py-1 hover:bg-gray-50 transition-colors cursor-pointer ${
                        isDragging ? 'opacity-50 bg-gray-100' : ''
                      } ${isDragOver ? 'border-t-2 border-primary-500' : ''} ${isHovered ? 'bg-primary-50' : ''}`}
                      title={queueName}
                    >
                      {/* Drag handle */}
                      <div className="flex-shrink-0 cursor-grab active:cursor-grabbing text-gray-400 hover:text-gray-600">
                        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                          <path d="M7 2a2 2 0 1 0 .001 4.001A2 2 0 0 0 7 2zm0 6a2 2 0 1 0 .001 4.001A2 2 0 0 0 7 8zm0 6a2 2 0 1 0 .001 4.001A2 2 0 0 0 7 14zm6-8a2 2 0 1 0-.001-4.001A2 2 0 0 0 13 6zm0 2a2 2 0 1 0 .001 4.001A2 2 0 0 0 13 8zm0 6a2 2 0 1 0 .001 4.001A2 2 0 0 0 13 14z" />
                        </svg>
                      </div>

                      {/* Task content */}
                      <div className="flex-1 min-w-0">
                        <p
                          className="text-xs font-medium text-gray-900 truncate cursor-pointer hover:text-primary-600"
                          onClick={(e) => {
                            e.stopPropagation()
                            setSelectedTaskId(taskId)
                          }}
                        >
                          {task.title}
                        </p>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Detail panel (right side) - shows on hover */}
          {hoveredTaskId && (() => {
            const hoveredTask = activeTasks.find(t => (t._id || t.id) === hoveredTaskId)
            if (!hoveredTask) return null
            return (
              <div className="w-1/2 p-3 overflow-auto bg-gray-50/50">
                <div className="space-y-2">
                  {hoveredTask.description ? (
                    <div>
                      <p className="text-[10px] font-medium text-gray-500 uppercase tracking-wide mb-1">Instructions</p>
                      <p className="text-xs text-gray-700 whitespace-pre-wrap">{hoveredTask.description}</p>
                    </div>
                  ) : (
                    <p className="text-xs text-gray-400 italic">No instructions</p>
                  )}
                  {hoveredTask.playbook_id && (
                    <div>
                      <p className="text-[10px] font-medium text-gray-500 uppercase tracking-wide mb-1">Playbook</p>
                      <p className="text-xs text-primary-600">{hoveredTask.playbook_id}</p>
                    </div>
                  )}
                  <button
                    onClick={() => setSelectedTaskId(hoveredTaskId)}
                    className="text-xs text-primary-600 hover:text-primary-700 font-medium"
                  >
                    Open details →
                  </button>
                </div>
              </div>
            )
          })()}
        </div>

        {activeTasks.length > 10 && (
          <div className="px-3 py-2 border-t border-gray-200 flex-shrink-0">
            <Link to="/tasks" className="text-primary-600 hover:text-primary-700 text-xs font-medium">
              View all tasks
            </Link>
          </div>
        )}
      </div>
    </WidgetWrapper>

    {selectedTaskId && (
      <TaskDetailModal
        taskId={selectedTaskId}
        isOpen={!!selectedTaskId}
        onClose={() => setSelectedTaskId(null)}
        onUpdate={() => fetchTasks()}
      />
    )}
  </>
  )
}
