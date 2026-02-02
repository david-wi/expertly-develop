import { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { WidgetWrapper } from '../WidgetWrapper'
import { WidgetProps } from './types'
import { useAppStore } from '../../../stores/appStore'
import { api, User as UserType, Team, TaskReorderItem } from '../../../services/api'

export function MyActiveTasksWidget({ widgetId }: WidgetProps) {
  const { user, tasks, queues, loading, fetchTasks } = useAppStore()
  const [selectedQueueFilter, setSelectedQueueFilter] = useState<string>('all')
  const [users, setUsers] = useState<UserType[]>([])
  const [teams, setTeams] = useState<Team[]>([])
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null)
  const [dragOverTaskId, setDragOverTaskId] = useState<string | null>(null)
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
      // Moving down - place after target
      const nextTask = activeTasks[targetIndex + 1]
      if (nextTask) {
        const nextSeq = nextTask.sequence ?? targetSeq + 2
        newSequence = (targetSeq + nextSeq) / 2
      } else {
        newSequence = targetSeq - 1
      }
    } else {
      // Moving up - place before target
      const prevTask = activeTasks[targetIndex - 1]
      if (prevTask) {
        const prevSeq = prevTask.sequence ?? targetSeq - 2
        newSequence = (prevSeq + targetSeq) / 2
      } else {
        newSequence = targetSeq + 1
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

  return (
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

        <div className="flex-1 overflow-auto" ref={dragRef}>
          {loading.tasks ? (
            <div className="p-3 text-xs text-gray-500">Loading...</div>
          ) : activeTasks.length === 0 ? (
            <div className="p-3 text-xs text-gray-500">No active tasks</div>
          ) : (
            <div className="divide-y divide-gray-100">
              {activeTasks.map((task) => {
                const taskId = task._id || task.id
                const queue = queues.find((q) => (q._id || q.id) === task.queue_id)
                const queueName = queue ? getQueueDisplayName(queue) : 'Unknown'
                const isDragging = draggedTaskId === taskId
                const isDragOver = dragOverTaskId === taskId

                return (
                  <div
                    key={taskId}
                    draggable
                    onDragStart={(e) => handleDragStart(e, taskId)}
                    onDragOver={(e) => handleDragOver(e, taskId)}
                    onDragLeave={handleDragLeave}
                    onDrop={(e) => handleDrop(e, taskId)}
                    onDragEnd={handleDragEnd}
                    className={`flex items-center gap-2 px-2 py-1.5 hover:bg-gray-50 transition-colors ${
                      isDragging ? 'opacity-50 bg-gray-100' : ''
                    } ${isDragOver ? 'border-t-2 border-primary-500' : ''}`}
                    title={`Queue: ${queueName}${task.description ? `\n\n${task.description}` : ''}`}
                  >
                    {/* Drag handle */}
                    <div className="flex-shrink-0 cursor-grab active:cursor-grabbing text-gray-400 hover:text-gray-600">
                      <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M7 2a2 2 0 1 0 .001 4.001A2 2 0 0 0 7 2zm0 6a2 2 0 1 0 .001 4.001A2 2 0 0 0 7 8zm0 6a2 2 0 1 0 .001 4.001A2 2 0 0 0 7 14zm6-8a2 2 0 1 0-.001-4.001A2 2 0 0 0 13 6zm0 2a2 2 0 1 0 .001 4.001A2 2 0 0 0 13 8zm0 6a2 2 0 1 0 .001 4.001A2 2 0 0 0 13 14z" />
                      </svg>
                    </div>

                    {/* Task content */}
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-gray-900 truncate">{task.title}</p>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
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
  )
}
