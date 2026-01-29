import { useEffect, useState } from 'react'
import { Modal, ModalFooter } from 'expertly_ui/index'
import {
  api,
  RecurringTask,
  Queue,
  CreateRecurringTaskRequest,
  RecurrenceType,
} from '../services/api'

const DAYS_OF_WEEK = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

export default function RecurringTasks() {
  const [recurringTasks, setRecurringTasks] = useState<RecurringTask[]>([])
  const [queues, setQueues] = useState<Queue[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'active' | 'inactive'>('all')

  // Modal states
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [selectedTask, setSelectedTask] = useState<RecurringTask | null>(null)
  const [saving, setSaving] = useState(false)

  // Form state
  const [formData, setFormData] = useState<CreateRecurringTaskRequest>({
    queue_id: '',
    title: '',
    description: '',
    priority: 5,
    recurrence_type: 'daily',
    interval: 1,
    days_of_week: [],
    day_of_month: 1,
    timezone: 'UTC',
    max_retries: 3,
  })

  useEffect(() => {
    loadData()
  }, [filter])

  const loadData = async () => {
    setLoading(true)
    try {
      const isActive = filter === 'all' ? undefined : filter === 'active'
      const [tasksData, queuesData] = await Promise.all([
        api.getRecurringTasks({ is_active: isActive }),
        api.getQueues(),
      ])
      setRecurringTasks(tasksData)
      setQueues(queuesData)
    } catch (error) {
      console.error('Failed to load data:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.queue_id || !formData.title.trim()) return

    setSaving(true)
    try {
      await api.createRecurringTask({
        ...formData,
        title: formData.title.trim(),
        description: formData.description?.trim() || undefined,
        days_of_week:
          formData.recurrence_type === 'weekly' ? formData.days_of_week : undefined,
        day_of_month:
          formData.recurrence_type === 'monthly' ? formData.day_of_month : undefined,
      })
      await loadData()
      setShowCreateModal(false)
      resetForm()
    } catch (error) {
      console.error('Failed to create recurring task:', error)
      alert(error instanceof Error ? error.message : 'Failed to create recurring task')
    } finally {
      setSaving(false)
    }
  }

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedTask) return

    const taskId = selectedTask._id || selectedTask.id
    setSaving(true)
    try {
      await api.updateRecurringTask(taskId, {
        title: formData.title.trim(),
        description: formData.description?.trim() || undefined,
        priority: formData.priority,
        queue_id: formData.queue_id,
        recurrence_type: formData.recurrence_type,
        interval: formData.interval,
        days_of_week:
          formData.recurrence_type === 'weekly' ? formData.days_of_week : undefined,
        day_of_month:
          formData.recurrence_type === 'monthly' ? formData.day_of_month : undefined,
        timezone: formData.timezone,
        max_retries: formData.max_retries,
      })
      await loadData()
      setShowEditModal(false)
      setSelectedTask(null)
    } catch (error) {
      console.error('Failed to update recurring task:', error)
      alert(error instanceof Error ? error.message : 'Failed to update recurring task')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!selectedTask) return

    const taskId = selectedTask._id || selectedTask.id
    setSaving(true)
    try {
      await api.deleteRecurringTask(taskId)
      await loadData()
      setShowDeleteConfirm(false)
      setSelectedTask(null)
    } catch (error) {
      console.error('Failed to delete recurring task:', error)
      alert(error instanceof Error ? error.message : 'Failed to delete recurring task')
    } finally {
      setSaving(false)
    }
  }

  const handleToggleActive = async (task: RecurringTask) => {
    const taskId = task._id || task.id
    try {
      await api.updateRecurringTask(taskId, { is_active: !task.is_active })
      await loadData()
    } catch (error) {
      console.error('Failed to toggle recurring task:', error)
    }
  }

  const handleTrigger = async (task: RecurringTask) => {
    const taskId = task._id || task.id
    try {
      await api.triggerRecurringTask(taskId)
      await loadData()
      alert('Task created successfully!')
    } catch (error) {
      console.error('Failed to trigger recurring task:', error)
      alert(error instanceof Error ? error.message : 'Failed to trigger recurring task')
    }
  }

  const resetForm = () => {
    setFormData({
      queue_id: queues[0]?._id || queues[0]?.id || '',
      title: '',
      description: '',
      priority: 5,
      recurrence_type: 'daily',
      interval: 1,
      days_of_week: [],
      day_of_month: 1,
      timezone: 'UTC',
      max_retries: 3,
    })
  }

  const openEditModal = (task: RecurringTask) => {
    setSelectedTask(task)
    setFormData({
      queue_id: task.queue_id,
      title: task.title,
      description: task.description || '',
      priority: task.priority,
      recurrence_type: task.recurrence_type,
      interval: task.interval,
      days_of_week: task.days_of_week || [],
      day_of_month: task.day_of_month || 1,
      timezone: task.timezone,
      max_retries: task.max_retries,
    })
    setShowEditModal(true)
  }

  const openDeleteConfirm = (task: RecurringTask) => {
    setSelectedTask(task)
    setShowDeleteConfirm(true)
  }

  const getQueueName = (queueId: string): string => {
    const queue = queues.find((q) => (q._id || q.id) === queueId)
    return queue?.purpose || 'Unknown Queue'
  }

  const formatRecurrence = (task: RecurringTask): string => {
    const interval = task.interval > 1 ? `every ${task.interval} ` : ''
    switch (task.recurrence_type) {
      case 'daily':
        return `${interval}day${task.interval > 1 ? 's' : ''}`
      case 'weekly':
        const days = task.days_of_week?.map((d) => DAYS_OF_WEEK[d]).join(', ')
        return `${interval}week${task.interval > 1 ? 's' : ''}${days ? ` on ${days}` : ''}`
      case 'monthly':
        return `${interval}month${task.interval > 1 ? 's' : ''} on day ${task.day_of_month}`
      case 'custom':
        return task.cron_expression || 'custom'
      default:
        return task.recurrence_type
    }
  }

  const formatDate = (dateStr: string | undefined): string => {
    if (!dateStr) return '-'
    return new Date(dateStr).toLocaleString()
  }

  const toggleDayOfWeek = (day: number) => {
    const days = formData.days_of_week || []
    if (days.includes(day)) {
      setFormData({ ...formData, days_of_week: days.filter((d) => d !== day) })
    } else {
      setFormData({ ...formData, days_of_week: [...days, day].sort() })
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900">Recurring Tasks</h2>
        <div className="flex items-center space-x-3">
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value as 'all' | 'active' | 'inactive')}
            className="border border-gray-300 rounded-md px-3 py-1.5 text-sm"
          >
            <option value="all">All</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
          <button
            onClick={() => {
              resetForm()
              setShowCreateModal(true)
            }}
            className="bg-blue-600 text-white px-3 py-1.5 rounded-md text-sm hover:bg-blue-700 transition-colors"
          >
            New Recurring Task
          </button>
        </div>
      </div>

      {/* Recurring Tasks List */}
      <div className="bg-white shadow rounded-lg overflow-hidden">
        {loading ? (
          <div className="p-4 text-gray-500">Loading...</div>
        ) : (
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Task
                </th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Queue
                </th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Schedule
                </th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Next Run
                </th>
                <th className="px-4 py-2 text-center text-xs font-medium text-gray-500 uppercase tracking-wider w-16">
                  Created
                </th>
                <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider w-40">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {recurringTasks.map((task) => {
                const taskId = task._id || task.id
                return (
                  <tr key={taskId} className={`hover:bg-gray-50 ${!task.is_active ? 'opacity-50' : ''}`}>
                    <td className="px-4 py-3">
                      <div>
                        <p className="font-medium text-gray-900">{task.title}</p>
                        {task.description && (
                          <p className="text-xs text-gray-500 truncate max-w-xs">
                            {task.description}
                          </p>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm text-gray-700">{getQueueName(task.queue_id)}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm text-gray-700 capitalize">
                        {formatRecurrence(task)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm text-gray-700">{formatDate(task.next_run)}</span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="text-sm font-medium text-gray-700">
                        {task.created_tasks_count}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => handleTrigger(task)}
                        className="text-green-600 hover:text-green-800 text-sm mr-2"
                        title="Create task now"
                      >
                        Run
                      </button>
                      <button
                        onClick={() => handleToggleActive(task)}
                        className={`text-sm mr-2 ${
                          task.is_active
                            ? 'text-yellow-600 hover:text-yellow-800'
                            : 'text-green-600 hover:text-green-800'
                        }`}
                      >
                        {task.is_active ? 'Pause' : 'Resume'}
                      </button>
                      <button
                        onClick={() => openEditModal(task)}
                        className="text-blue-600 hover:text-blue-800 text-sm mr-2"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => openDeleteConfirm(task)}
                        className="text-red-600 hover:text-red-800 text-sm"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                )
              })}
              {recurringTasks.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                    No recurring tasks found. Create one to automate task creation.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* Create Modal */}
      <Modal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title="Create Recurring Task"
      >
        <form onSubmit={handleCreate} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Queue</label>
            <select
              value={formData.queue_id}
              onChange={(e) => setFormData({ ...formData, queue_id: e.target.value })}
              className="w-full border border-gray-300 rounded-md px-3 py-2"
              required
            >
              <option value="">Select a queue</option>
              {queues.map((queue) => (
                <option key={queue._id || queue.id} value={queue._id || queue.id}>
                  {queue.purpose}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              className="w-full border border-gray-300 rounded-md px-3 py-2"
              placeholder="e.g., Weekly Team Standup"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Description (optional)
            </label>
            <textarea
              value={formData.description || ''}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full border border-gray-300 rounded-md px-3 py-2"
              rows={2}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Priority</label>
            <input
              type="number"
              value={formData.priority}
              onChange={(e) =>
                setFormData({ ...formData, priority: parseInt(e.target.value) || 5 })
              }
              className="w-full border border-gray-300 rounded-md px-3 py-2"
              min={1}
              max={10}
            />
            <p className="text-xs text-gray-500 mt-1">1 = highest, 10 = lowest</p>
          </div>

          {/* Recurrence Settings */}
          <div className="border-t pt-4 mt-4">
            <h4 className="text-sm font-medium text-gray-900 mb-3">Schedule</h4>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Recurrence Type
                </label>
                <select
                  value={formData.recurrence_type}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      recurrence_type: e.target.value as RecurrenceType,
                    })
                  }
                  className="w-full border border-gray-300 rounded-md px-3 py-2"
                >
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Every
                </label>
                <div className="flex items-center space-x-2">
                  <input
                    type="number"
                    value={formData.interval}
                    onChange={(e) =>
                      setFormData({ ...formData, interval: parseInt(e.target.value) || 1 })
                    }
                    className="w-20 border border-gray-300 rounded-md px-3 py-2"
                    min={1}
                  />
                  <span className="text-gray-700">
                    {formData.recurrence_type === 'daily'
                      ? 'day(s)'
                      : formData.recurrence_type === 'weekly'
                      ? 'week(s)'
                      : 'month(s)'}
                  </span>
                </div>
              </div>
              {formData.recurrence_type === 'weekly' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    On days
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {DAYS_OF_WEEK.map((day, index) => (
                      <button
                        key={day}
                        type="button"
                        onClick={() => toggleDayOfWeek(index)}
                        className={`px-3 py-1 rounded-md text-sm ${
                          formData.days_of_week?.includes(index)
                            ? 'bg-blue-600 text-white'
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        }`}
                      >
                        {day}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {formData.recurrence_type === 'monthly' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    On day of month
                  </label>
                  <input
                    type="number"
                    value={formData.day_of_month}
                    onChange={(e) =>
                      setFormData({ ...formData, day_of_month: parseInt(e.target.value) || 1 })
                    }
                    className="w-20 border border-gray-300 rounded-md px-3 py-2"
                    min={1}
                    max={31}
                  />
                </div>
              )}
            </div>
          </div>

          <ModalFooter>
            <button
              type="button"
              onClick={() => setShowCreateModal(false)}
              className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-md transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              {saving ? 'Creating...' : 'Create'}
            </button>
          </ModalFooter>
        </form>
      </Modal>

      {/* Edit Modal */}
      <Modal
        isOpen={showEditModal && !!selectedTask}
        onClose={() => setShowEditModal(false)}
        title="Edit Recurring Task"
      >
        <form onSubmit={handleEdit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Queue</label>
            <select
              value={formData.queue_id}
              onChange={(e) => setFormData({ ...formData, queue_id: e.target.value })}
              className="w-full border border-gray-300 rounded-md px-3 py-2"
              required
            >
              {queues.map((queue) => (
                <option key={queue._id || queue.id} value={queue._id || queue.id}>
                  {queue.purpose}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              className="w-full border border-gray-300 rounded-md px-3 py-2"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Description (optional)
            </label>
            <textarea
              value={formData.description || ''}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full border border-gray-300 rounded-md px-3 py-2"
              rows={2}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Priority</label>
            <input
              type="number"
              value={formData.priority}
              onChange={(e) =>
                setFormData({ ...formData, priority: parseInt(e.target.value) || 5 })
              }
              className="w-full border border-gray-300 rounded-md px-3 py-2"
              min={1}
              max={10}
            />
          </div>

          {/* Recurrence Settings */}
          <div className="border-t pt-4 mt-4">
            <h4 className="text-sm font-medium text-gray-900 mb-3">Schedule</h4>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Recurrence Type
                </label>
                <select
                  value={formData.recurrence_type}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      recurrence_type: e.target.value as RecurrenceType,
                    })
                  }
                  className="w-full border border-gray-300 rounded-md px-3 py-2"
                >
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Every
                </label>
                <div className="flex items-center space-x-2">
                  <input
                    type="number"
                    value={formData.interval}
                    onChange={(e) =>
                      setFormData({ ...formData, interval: parseInt(e.target.value) || 1 })
                    }
                    className="w-20 border border-gray-300 rounded-md px-3 py-2"
                    min={1}
                  />
                  <span className="text-gray-700">
                    {formData.recurrence_type === 'daily'
                      ? 'day(s)'
                      : formData.recurrence_type === 'weekly'
                      ? 'week(s)'
                      : 'month(s)'}
                  </span>
                </div>
              </div>
              {formData.recurrence_type === 'weekly' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    On days
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {DAYS_OF_WEEK.map((day, index) => (
                      <button
                        key={day}
                        type="button"
                        onClick={() => toggleDayOfWeek(index)}
                        className={`px-3 py-1 rounded-md text-sm ${
                          formData.days_of_week?.includes(index)
                            ? 'bg-blue-600 text-white'
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        }`}
                      >
                        {day}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {formData.recurrence_type === 'monthly' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    On day of month
                  </label>
                  <input
                    type="number"
                    value={formData.day_of_month}
                    onChange={(e) =>
                      setFormData({ ...formData, day_of_month: parseInt(e.target.value) || 1 })
                    }
                    className="w-20 border border-gray-300 rounded-md px-3 py-2"
                    min={1}
                    max={31}
                  />
                </div>
              )}
            </div>
          </div>

          <ModalFooter>
            <button
              type="button"
              onClick={() => setShowEditModal(false)}
              className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-md transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save'}
            </button>
          </ModalFooter>
        </form>
      </Modal>

      {/* Delete Confirmation */}
      <Modal
        isOpen={showDeleteConfirm && !!selectedTask}
        onClose={() => setShowDeleteConfirm(false)}
        title="Delete Recurring Task?"
        size="sm"
      >
        <p className="text-gray-500 mb-4">
          Are you sure you want to delete "{selectedTask?.title}"? This will not delete
          already-created tasks.
        </p>
        <ModalFooter>
          <button
            onClick={() => setShowDeleteConfirm(false)}
            className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-md transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleDelete}
            disabled={saving}
            className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors disabled:opacity-50"
          >
            {saving ? 'Deleting...' : 'Delete'}
          </button>
        </ModalFooter>
      </Modal>
    </div>
  )
}
