import { useState, useEffect, useMemo, useCallback } from 'react'
import { Modal, ModalFooter } from '@expertly/ui'
import {
  api,
  Queue,
  Team,
  User,
  Playbook,
  CreateTaskRequest,
  CreateRecurringTaskRequest,
  RecurrenceType,
} from '../services/api'
import ApproverSelector, { ApproverType } from './ApproverSelector'

const DAYS_OF_WEEK = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

const TIMEZONES = [
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'America/Phoenix',
  'Europe/London',
  'Europe/Paris',
  'Europe/Berlin',
  'Asia/Tokyo',
  'Asia/Shanghai',
  'Australia/Sydney',
  'Pacific/Auckland',
  'UTC',
]

interface CreateAssignmentModalProps {
  isOpen: boolean
  onClose: () => void
  onCreated: () => void
  projectId?: string
}

interface FormState {
  title: string
  description: string
  playbook_id: string
  queue_id: string
  team_id: string
  user_id: string
  assignment_type: 'queue' | 'team' | 'user'
  priority: number
  is_recurring: boolean
  recurrence_type: RecurrenceType
  interval: number
  days_of_week: number[]
  day_of_month: number
  // Scheduling
  scheduled_start_date: string
  scheduled_start_time: string
  scheduled_end_date: string
  scheduled_end_time: string
  schedule_timezone: string
  // Approver fields
  approver_type: 'user' | 'team' | 'anyone' | ''
  approver_id: string
  approver_queue_id: string
}

const initialFormState: FormState = {
  title: '',
  description: '',
  playbook_id: '',
  queue_id: '',
  team_id: '',
  user_id: '',
  assignment_type: 'queue',
  priority: 5,
  is_recurring: false,
  recurrence_type: 'daily',
  interval: 1,
  days_of_week: [],
  day_of_month: 1,
  scheduled_start_date: '',
  scheduled_start_time: '',
  scheduled_end_date: '',
  scheduled_end_time: '',
  schedule_timezone: '',
  approver_type: '',
  approver_id: '',
  approver_queue_id: '',
}

export default function CreateAssignmentModal({
  isOpen,
  onClose,
  onCreated,
  projectId,
}: CreateAssignmentModalProps) {
  // Data states
  const [queues, setQueues] = useState<Queue[]>([])
  const [teams, setTeams] = useState<Team[]>([])
  const [users, setUsers] = useState<User[]>([])
  const [playbooks, setPlaybooks] = useState<Playbook[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  // Form state
  const [form, setForm] = useState<FormState>(initialFormState)

  // Playbook typeahead state
  const [playbookSearch, setPlaybookSearch] = useState('')
  const [showPlaybookDropdown, setShowPlaybookDropdown] = useState(false)

  // Scheduling toggle
  const [showScheduling, setShowScheduling] = useState(false)

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const [queuesData, teamsData, usersData, playbooksData] = await Promise.all([
        api.getQueues(),
        api.getTeams(),
        api.getUsers(),
        api.getPlaybooks({ active_only: true }),
      ])

      setQueues(queuesData)
      setTeams(teamsData)
      setUsers(usersData)
      setPlaybooks(playbooksData)

      // Set default queue if available
      if (queuesData.length > 0) {
        setForm((prev) => {
          if (!prev.queue_id) {
            return { ...prev, queue_id: queuesData[0]._id || queuesData[0].id }
          }
          return prev
        })
      }
    } catch (err) {
      console.error('Failed to load data:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  // Load data when modal opens
  useEffect(() => {
    if (isOpen) {
      loadData()
    }
  }, [isOpen, loadData])

  // Reset form when modal closes
  useEffect(() => {
    if (!isOpen) {
      setForm(initialFormState)
      setPlaybookSearch('')
      setShowScheduling(false)
    }
  }, [isOpen])

  // Filtered playbooks for typeahead (exclude groups, sort alphabetically)
  const filteredPlaybooks = useMemo(() => {
    // Exclude groups - include playbooks and any legacy items without item_type
    const actualPlaybooks = playbooks
      .filter((p) => p.item_type !== 'group')
      .sort((a, b) => a.name.localeCompare(b.name))

    if (!playbookSearch.trim()) return actualPlaybooks.slice(0, 10)
    const search = playbookSearch.toLowerCase()
    return actualPlaybooks.filter((p) => p.name.toLowerCase().includes(search)).slice(0, 10)
  }, [playbooks, playbookSearch])

  const selectedPlaybook = useMemo(() => {
    return playbooks.find((p) => (p.id || (p as { _id?: string })._id) === form.playbook_id)
  }, [playbooks, form.playbook_id])

  // When playbook is selected, set defaults from playbook's default fields
  const handlePlaybookSelect = (playbook: Playbook) => {
    const playbookId = playbook.id || (playbook as { _id?: string })._id || ''

    // Use playbook's default_queue_id if available, otherwise keep current
    const queueId = playbook.default_queue_id || form.queue_id

    // Use playbook's default approver settings if available
    const approverType = playbook.default_approver_type || ''
    const approverId = playbook.default_approver_id || ''
    const approverQueueId = playbook.default_approver_queue_id || ''

    setForm((prev) => ({
      ...prev,
      playbook_id: playbookId,
      queue_id: queueId,
      approver_type: approverType,
      approver_id: approverId,
      approver_queue_id: approverQueueId,
    }))
    setPlaybookSearch('')
    setShowPlaybookDropdown(false)
  }

  const toggleDayOfWeek = (day: number) => {
    const days = form.days_of_week || []
    if (days.includes(day)) {
      setForm({ ...form, days_of_week: days.filter((d) => d !== day) })
    } else {
      setForm({ ...form, days_of_week: [...days, day].sort() })
    }
  }

  const buildScheduledStart = (): string | undefined => {
    if (form.scheduled_start_date && form.scheduled_start_time) {
      return `${form.scheduled_start_date}T${form.scheduled_start_time}:00`
    }
    return undefined
  }

  const buildScheduledEnd = (): string | undefined => {
    if (form.scheduled_end_date && form.scheduled_end_time) {
      return `${form.scheduled_end_date}T${form.scheduled_end_time}:00`
    }
    return undefined
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.title.trim()) return

    // Determine queue_id
    let queueId = form.queue_id
    if (!queueId && queues.length > 0) {
      queueId = queues[0]._id || queues[0].id
    }

    if (!queueId) {
      alert('Please select a queue')
      return
    }

    setSaving(true)
    try {
      if (form.is_recurring) {
        const recurringData: CreateRecurringTaskRequest = {
          queue_id: queueId,
          title: form.title.trim(),
          description: form.description.trim() || undefined,
          project_id: projectId,
          priority: form.priority,
          recurrence_type: form.recurrence_type,
          interval: form.interval,
          days_of_week: form.recurrence_type === 'weekly' ? form.days_of_week : undefined,
          day_of_month: form.recurrence_type === 'monthly' ? form.day_of_month : undefined,
        }
        await api.createRecurringTask(recurringData)
      } else {
        const taskData: CreateTaskRequest = {
          queue_id: queueId,
          title: form.title.trim(),
          description: form.description.trim() || undefined,
          project_id: projectId,
          sop_id: form.playbook_id || undefined,
          playbook_id: form.playbook_id || undefined,
          priority: form.priority,
          scheduled_start: buildScheduledStart(),
          scheduled_end: buildScheduledEnd(),
          schedule_timezone: form.schedule_timezone || undefined,
          // Approver fields
          approver_type: form.approver_type || undefined,
          approver_id: form.approver_id || undefined,
          approver_queue_id: form.approver_queue_id || undefined,
          approval_required: !!form.approver_type,
        }
        await api.createTask(taskData)
      }

      onCreated()
      onClose()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create assignment'
      alert(message)
    } finally {
      setSaving(false)
    }
  }

  if (!isOpen) return null

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Create Assignment" size="lg">
      {loading ? (
        <div className="py-8 text-center text-gray-500">Loading...</div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
            <input
              type="text"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              className="w-full border border-gray-300 rounded-md px-3 py-2"
              placeholder="Assignment title"
              required
              autoFocus
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Description (optional)
            </label>
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              className="w-full border border-gray-300 rounded-md px-3 py-2"
              rows={2}
              placeholder="Assignment description"
            />
          </div>

          {/* Playbook Typeahead */}
          <div className="relative">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Playbook (optional)
            </label>
            {selectedPlaybook ? (
              <div className="flex items-center justify-between border border-gray-300 rounded-md px-3 py-2 bg-gray-50">
                <span className="text-gray-900">{selectedPlaybook.name}</span>
                <button
                  type="button"
                  onClick={() => {
                    setForm({ ...form, playbook_id: '' })
                    setPlaybookSearch('')
                  }}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              </div>
            ) : (
              <>
                <input
                  type="text"
                  value={playbookSearch}
                  onChange={(e) => {
                    setPlaybookSearch(e.target.value)
                    setShowPlaybookDropdown(true)
                  }}
                  onFocus={() => setShowPlaybookDropdown(true)}
                  onBlur={() => setTimeout(() => setShowPlaybookDropdown(false), 200)}
                  className="w-full border border-gray-300 rounded-md px-3 py-2"
                  placeholder="Search playbooks..."
                />
                {showPlaybookDropdown && filteredPlaybooks.length > 0 && (
                  <ul className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-48 overflow-auto">
                    {filteredPlaybooks.map((playbook) => (
                      <li
                        key={playbook.id || (playbook as { _id?: string })._id}
                        className="px-3 py-2 hover:bg-gray-100 cursor-pointer"
                        onMouseDown={() => handlePlaybookSelect(playbook)}
                      >
                        <p className="font-medium text-gray-900">{playbook.name}</p>
                        {playbook.description && (
                          <p className="text-xs text-gray-500 truncate">{playbook.description}</p>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </>
            )}
          </div>

          {/* Priority and Assignment in same row */}
          <div className="grid grid-cols-2 gap-4">
            {/* Priority */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Priority</label>
              <select
                value={form.priority}
                onChange={(e) => setForm({ ...form, priority: parseInt(e.target.value) })}
                className="w-full border border-gray-300 rounded-md px-3 py-2"
              >
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((p) => (
                  <option key={p} value={p}>
                    {p} {p === 1 ? '(Highest)' : p === 10 ? '(Lowest)' : ''}
                  </option>
                ))}
              </select>
            </div>

            {/* Queue */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Queue</label>
              <select
                value={form.queue_id}
                onChange={(e) => setForm({ ...form, queue_id: e.target.value })}
                className="w-full border border-gray-300 rounded-md px-3 py-2"
              >
                <option value="">Select a queue</option>
                {queues.map((queue) => (
                  <option key={queue._id || queue.id} value={queue._id || queue.id}>
                    {queue.purpose}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Assignment Section */}
          <div className="border-t pt-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">Assignment Type</label>
            <div className="space-y-3">
              {/* Assignment Type Radio */}
              <div className="flex space-x-4">
                <label className="flex items-center">
                  <input
                    type="radio"
                    name="assignment_type"
                    value="queue"
                    checked={form.assignment_type === 'queue'}
                    onChange={() => setForm({ ...form, assignment_type: 'queue' })}
                    className="mr-2"
                  />
                  Queue
                </label>
                <label className="flex items-center">
                  <input
                    type="radio"
                    name="assignment_type"
                    value="team"
                    checked={form.assignment_type === 'team'}
                    onChange={() => setForm({ ...form, assignment_type: 'team' })}
                    className="mr-2"
                  />
                  Team
                </label>
                <label className="flex items-center">
                  <input
                    type="radio"
                    name="assignment_type"
                    value="user"
                    checked={form.assignment_type === 'user'}
                    onChange={() => setForm({ ...form, assignment_type: 'user' })}
                    className="mr-2"
                  />
                  User
                </label>
              </div>

              {/* Assignment Dropdown based on type */}
              {form.assignment_type === 'team' && (
                <select
                  value={form.team_id}
                  onChange={(e) => setForm({ ...form, team_id: e.target.value })}
                  className="w-full border border-gray-300 rounded-md px-3 py-2"
                >
                  <option value="">Select a team</option>
                  {teams.map((team) => (
                    <option key={team._id || team.id} value={team._id || team.id}>
                      {team.name}
                    </option>
                  ))}
                </select>
              )}

              {form.assignment_type === 'user' && (
                <select
                  value={form.user_id}
                  onChange={(e) => setForm({ ...form, user_id: e.target.value })}
                  className="w-full border border-gray-300 rounded-md px-3 py-2"
                >
                  <option value="">Select a user</option>
                  {users.map((user) => (
                    <option key={user._id || user.id} value={user._id || user.id}>
                      {user.name}
                    </option>
                  ))}
                </select>
              )}
            </div>
          </div>

          {/* Approval Section */}
          {!form.is_recurring && (
            <div className="border-t pt-4">
              <label className="block text-sm font-medium text-gray-700 mb-3">
                Approval Required
                {selectedPlaybook?.default_approver_type && (
                  <span className="ml-2 text-xs text-gray-500 font-normal">
                    (from playbook defaults)
                  </span>
                )}
              </label>
              <ApproverSelector
                approverType={(form.approver_type as ApproverType) || null}
                approverId={form.approver_id || null}
                approverQueueId={form.approver_queue_id || null}
                onChange={(type, id, queueId) => {
                  setForm({
                    ...form,
                    approver_type: type || '',
                    approver_id: id || '',
                    approver_queue_id: queueId || '',
                  })
                }}
              />
            </div>
          )}

          {/* Scheduling Section */}
          <div className="border-t pt-4">
            <button
              type="button"
              onClick={() => setShowScheduling(!showScheduling)}
              className="flex items-center gap-2 text-sm font-medium text-gray-700 hover:text-gray-900"
            >
              <svg
                className={`w-4 h-4 transition-transform ${showScheduling ? 'rotate-90' : ''}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 5l7 7-7 7"
                />
              </svg>
              Schedule for Later
              {(form.scheduled_start_date || form.scheduled_end_date) && (
                <span className="ml-2 px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-xs">
                  Scheduled
                </span>
              )}
            </button>

            {showScheduling && (
              <div className="mt-4 space-y-4 pl-6">
                {/* Scheduled Start */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Don't start before
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="date"
                      value={form.scheduled_start_date}
                      onChange={(e) => setForm({ ...form, scheduled_start_date: e.target.value })}
                      className="flex-1 border border-gray-300 rounded-md px-3 py-2"
                    />
                    <input
                      type="time"
                      value={form.scheduled_start_time}
                      onChange={(e) => setForm({ ...form, scheduled_start_time: e.target.value })}
                      className="w-32 border border-gray-300 rounded-md px-3 py-2"
                    />
                  </div>
                </div>

                {/* Scheduled End */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Work window closes (optional)
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="date"
                      value={form.scheduled_end_date}
                      onChange={(e) => setForm({ ...form, scheduled_end_date: e.target.value })}
                      className="flex-1 border border-gray-300 rounded-md px-3 py-2"
                    />
                    <input
                      type="time"
                      value={form.scheduled_end_time}
                      onChange={(e) => setForm({ ...form, scheduled_end_time: e.target.value })}
                      className="w-32 border border-gray-300 rounded-md px-3 py-2"
                    />
                  </div>
                </div>

                {/* Timezone */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Timezone</label>
                  <select
                    value={form.schedule_timezone}
                    onChange={(e) => setForm({ ...form, schedule_timezone: e.target.value })}
                    className="w-full border border-gray-300 rounded-md px-3 py-2"
                  >
                    <option value="">Browser default</option>
                    {TIMEZONES.map((tz) => (
                      <option key={tz} value={tz}>
                        {tz}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Clear scheduling button */}
                {(form.scheduled_start_date || form.scheduled_end_date) && (
                  <button
                    type="button"
                    onClick={() =>
                      setForm({
                        ...form,
                        scheduled_start_date: '',
                        scheduled_start_time: '',
                        scheduled_end_date: '',
                        scheduled_end_time: '',
                        schedule_timezone: '',
                      })
                    }
                    className="text-sm text-red-600 hover:text-red-700"
                  >
                    Clear scheduling
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Make Recurring Toggle */}
          <div className="border-t pt-4">
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={form.is_recurring}
                onChange={(e) => setForm({ ...form, is_recurring: e.target.checked })}
                className="mr-2"
              />
              <span className="text-sm font-medium text-gray-700">
                Make this a recurring assignment
              </span>
            </label>

            {form.is_recurring && (
              <div className="mt-4 space-y-3 pl-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Recurrence Type
                  </label>
                  <select
                    value={form.recurrence_type}
                    onChange={(e) =>
                      setForm({
                        ...form,
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
                  <label className="block text-sm font-medium text-gray-700 mb-1">Every</label>
                  <div className="flex items-center space-x-2">
                    <input
                      type="number"
                      value={form.interval}
                      onChange={(e) =>
                        setForm({ ...form, interval: parseInt(e.target.value) || 1 })
                      }
                      className="w-20 border border-gray-300 rounded-md px-3 py-2"
                      min={1}
                    />
                    <span className="text-gray-700">
                      {form.recurrence_type === 'daily'
                        ? 'day(s)'
                        : form.recurrence_type === 'weekly'
                          ? 'week(s)'
                          : 'month(s)'}
                    </span>
                  </div>
                </div>

                {form.recurrence_type === 'weekly' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">On days</label>
                    <div className="flex flex-wrap gap-2">
                      {DAYS_OF_WEEK.map((day, index) => (
                        <button
                          key={day}
                          type="button"
                          onClick={() => toggleDayOfWeek(index)}
                          className={`px-3 py-1 rounded-md text-sm ${
                            form.days_of_week?.includes(index)
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

                {form.recurrence_type === 'monthly' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      On day of month
                    </label>
                    <input
                      type="number"
                      value={form.day_of_month}
                      onChange={(e) =>
                        setForm({ ...form, day_of_month: parseInt(e.target.value) || 1 })
                      }
                      className="w-20 border border-gray-300 rounded-md px-3 py-2"
                      min={1}
                      max={31}
                    />
                  </div>
                )}
              </div>
            )}
          </div>

          <ModalFooter>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-md transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || !form.title.trim()}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              {saving
                ? 'Creating...'
                : form.is_recurring
                  ? 'Create Recurring Assignment'
                  : 'Create Assignment'}
            </button>
          </ModalFooter>
        </form>
      )}
    </Modal>
  )
}
