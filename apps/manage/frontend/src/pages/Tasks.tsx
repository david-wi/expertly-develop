import { useEffect, useState } from 'react'
import { useAppStore } from '../stores/appStore'
import TaskDetailModal from '../components/TaskDetailModal'
import CreateAssignmentModal from '../components/CreateAssignmentModal'

const STATUS_COLORS: Record<string, string> = {
  queued: 'bg-blue-100 text-blue-800',
  blocked: 'bg-orange-100 text-orange-800',
  checked_out: 'bg-primary-100 text-primary-800',
  in_progress: 'bg-yellow-100 text-yellow-800',
  completed: 'bg-green-100 text-green-800',
  failed: 'bg-red-100 text-red-800',
}

const PHASE_CONFIG: Record<string, { bg: string; text: string; label: string }> = {
  planning: { bg: 'bg-gray-100', text: 'text-gray-700', label: 'Planning' },
  ready: { bg: 'bg-blue-100', text: 'text-blue-700', label: 'Ready' },
  in_progress: { bg: 'bg-yellow-100', text: 'text-yellow-700', label: 'In Progress' },
  pending_review: { bg: 'bg-purple-100', text: 'text-purple-700', label: 'Pending Review' },
  in_review: { bg: 'bg-indigo-100', text: 'text-indigo-700', label: 'In Review' },
  changes_requested: { bg: 'bg-orange-100', text: 'text-orange-700', label: 'Changes Requested' },
  approved: { bg: 'bg-green-100', text: 'text-green-700', label: 'Approved' },
  waiting_on_subplaybook: { bg: 'bg-cyan-100', text: 'text-cyan-700', label: 'Waiting' },
}

export default function Tasks() {
  const { tasks, queues, loading, fetchTasks, fetchQueues } = useAppStore()
  const [filterQueue, setFilterQueue] = useState<string>('')
  const [filterStatus, setFilterStatus] = useState<string>('')
  const [filterPhase, setFilterPhase] = useState<string>('')
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null)

  useEffect(() => {
    fetchQueues()
    fetchTasks()
  }, [fetchQueues, fetchTasks])

  const filteredTasks = tasks.filter((task) => {
    if (filterQueue && task.queue_id !== filterQueue) return false
    if (filterStatus && task.status !== filterStatus) return false
    if (filterPhase && task.phase !== filterPhase) return false
    return true
  })

  const getQueuePurpose = (queueId: string) => {
    const queue = queues.find((q) => (q._id || q.id) === queueId)
    return queue?.purpose || 'Unknown'
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900">Assignments</h2>
        <button
          onClick={() => setShowCreateModal(true)}
          className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors"
        >
          New Assignment
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white shadow rounded-lg p-4">
        <div className="flex flex-wrap gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Queue</label>
            <select
              value={filterQueue}
              onChange={(e) => setFilterQueue(e.target.value)}
              className="border border-gray-300 rounded-md px-3 py-2 text-sm"
            >
              <option value="">All Queues</option>
              {queues.map((queue) => (
                <option key={queue._id || queue.id} value={queue._id || queue.id}>
                  {queue.purpose}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="border border-gray-300 rounded-md px-3 py-2 text-sm"
            >
              <option value="">All Statuses</option>
              <option value="queued">Queued</option>
              <option value="checked_out">Checked Out</option>
              <option value="in_progress">In Progress</option>
              <option value="completed">Completed</option>
              <option value="failed">Failed</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Phase</label>
            <select
              value={filterPhase}
              onChange={(e) => setFilterPhase(e.target.value)}
              className="border border-gray-300 rounded-md px-3 py-2 text-sm"
            >
              <option value="">All Phases</option>
              <option value="planning">Planning</option>
              <option value="ready">Ready</option>
              <option value="in_progress">In Progress</option>
              <option value="pending_review">Pending Review</option>
              <option value="in_review">In Review</option>
              <option value="changes_requested">Changes Requested</option>
              <option value="approved">Approved</option>
              <option value="waiting_on_subplaybook">Waiting on Subplaybook</option>
            </select>
          </div>
        </div>
      </div>

      {/* Tasks List */}
      <div className="bg-white shadow rounded-lg">
        {loading.tasks ? (
          <div className="p-4 text-gray-500">Loading...</div>
        ) : (
          <ul className="divide-y divide-gray-200">
            {filteredTasks.map((task) => (
              <li
                key={task._id || task.id}
                className="p-4 hover:bg-gray-50 cursor-pointer"
                onClick={() => setSelectedTaskId(task._id || task.id)}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center space-x-2">
                      <p className="font-medium text-gray-900">{task.title}</p>
                      <span className="text-xs text-gray-500">P{task.priority}</span>
                    </div>
                    {task.description && (
                      <p className="text-sm text-gray-500 mt-1">{task.description}</p>
                    )}
                    <div className="flex items-center space-x-4 mt-2 text-xs text-gray-500">
                      <span>Queue: {getQueuePurpose(task.queue_id)}</span>
                      <span>Created: {new Date(task.created_at).toLocaleDateString()}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {task.phase && PHASE_CONFIG[task.phase] && (
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${PHASE_CONFIG[task.phase].bg} ${PHASE_CONFIG[task.phase].text}`}
                      >
                        {PHASE_CONFIG[task.phase].label}
                      </span>
                    )}
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        STATUS_COLORS[task.status] || 'bg-gray-100 text-gray-800'
                      }`}
                    >
                      {task.status.replace('_', ' ')}
                    </span>
                  </div>
                </div>
              </li>
            ))}
            {filteredTasks.length === 0 && (
              <li className="p-4 text-gray-500">No assignments found</li>
            )}
          </ul>
        )}
      </div>

      {/* Task Detail Modal */}
      {selectedTaskId && (
        <TaskDetailModal
          taskId={selectedTaskId}
          isOpen={!!selectedTaskId}
          onClose={() => setSelectedTaskId(null)}
          onUpdate={() => fetchTasks()}
        />
      )}

      {/* Create Assignment Modal */}
      <CreateAssignmentModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onCreated={() => fetchTasks()}
      />
    </div>
  )
}
