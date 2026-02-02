import { useState, useEffect, useCallback, useMemo } from 'react'
import { Modal, ModalFooter } from '@expertly/ui'
import { ChevronDown, ChevronRight } from 'lucide-react'
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
  const [currentUser, setCurrentUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  // Form state
  const [form, setForm] = useState<FormState>(initialFormState)

  // Scheduling toggle
  const [showScheduling, setShowScheduling] = useState(false)

  // Advanced section toggle
  const [showAdvanced, setShowAdvanced] = useState(false)

  // Playbook typeahead state
  const [playbookSearch, setPlaybookSearch] = useState('')
  const [showPlaybookDropdown, setShowPlaybookDropdown] = useState(false)

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const [queuesData, teamsData, usersData, playbooksData, userData] = await Promise.all([
        api.getQueues(),
        api.getTeams(),
        api.getUsers(),
        api.getPlaybooks({ active_only: true }),
        api.getCurrentUser(),
      ])

      setQueues(queuesData)
      setTeams(teamsData)
      setUsers(usersData)
      setPlaybooks(playbooksData)
      setCurrentUser(userData)

      // Set default queue to user's inbox if available
      const userId = userData?.id || (userData as { _id?: string })?._id
      const userInbox = queuesData.find(
        (q) => q.scope_type === 'user' && q.scope_id === userId
      )
      if (userInbox) {
        setForm((prev) => {
          if (!prev.queue_id) {
            return { ...prev, queue_id: userInbox._id || userInbox.id }
          }
          return prev
        })
      } else if (queuesData.length > 0) {
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
      setShowScheduling(false)
      setShowAdvanced(false)
      setPlaybookSearch('')
      setShowPlaybookDropdown(false)
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

  // Check if playbook has a default queue (for "Not Applicable" display)
  const playbookHasQueue = selectedPlaybook?.default_queue_id ? true : false

  // Get user's inbox queue for display
  const userInboxQueue = useMemo(() => {
    if (!currentUser) return null
    const userId = currentUser.id || (currentUser as { _id?: string })?._id
    return queues.find((q) => q.scope_type === 'user' && q.scope_id === userId)
  }, [currentUser, queues])

  // When playbook is selected, set defaults from playbook's default fields
  const handlePlaybookSelect = (playbook: Playbook | null) => {
    if (!playbook) {
      setForm((prev) => ({ ...prev, playbook_id: '' }))
      return
    }

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

  const resetFormForAnother = useCallback(() => {
    // Reset to user's inbox queue
    const userId = currentUser?.id || (currentUser as { _id?: string } | null)?._id
    const userInbox = queues.find((q) => q.scope_type === 'user' && q.scope_id === userId)
    const defaultQueueId = userInbox ? userInbox._id || userInbox.id : queues[0]?._id || queues[0]?.id || ''

    setForm({
      ...initialFormState,
      queue_id: defaultQueueId,
    })
    setPlaybookSearch('')
    setShowScheduling(false)
  }, [currentUser, queues])

  const handleSubmit = async (e: React.FormEvent, addAnother = false) => {
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
      if (addAnother) {
        resetFormForAnother()
      } else {
        onClose()
      }
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
        <form onSubmit={(e) => handleSubmit(e, false)} className="space-y-4">
          {/* Row 1: Title + Priority */}
          <div className="flex gap-3">
            <div className="flex-1">
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
            <div className="w-28">
              <label className="block text-sm font-medium text-gray-700 mb-1">Priority</label>
              <select
                value={form.priority}
                onChange={(e) => setForm({ ...form, priority: parseInt(e.target.value) })}
                className="w-full border border-gray-300 rounded-md px-3 py-2"
              >
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((p) => (
                  <option key={p} value={p}>
                    {p} {p === 1 ? '(High)' : p === 10 ? '(Low)' : ''}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Row 2: Playbook + Queue */}
          <div className="flex gap-3">
            {/* Playbook Typeahead */}
            <div className="flex-1 relative">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Playbook (optional)
              </label>
              {selectedPlaybook ? (
                <div className="flex items-center justify-between border border-gray-300 rounded-md px-3 py-2 bg-gray-50">
                  <span className="text-gray-900 truncate">{selectedPlaybook.name}</span>
                  <button
                    type="button"
                    onClick={() => {
                      // Reset queue to user's inbox when clearing playbook
                      const newQueueId = userInboxQueue
                        ? userInboxQueue._id || userInboxQueue.id
                        : form.queue_id
                      setForm({ ...form, playbook_id: '', queue_id: newQueueId })
                      setPlaybookSearch('')
                    }}
                    className="text-gray-400 hover:text-gray-600 ml-2 flex-shrink-0"
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

            {/* Queue */}
            <div className="w-40">
              <label className="block text-sm font-medium text-gray-700 mb-1">Queue</label>
              {playbookHasQueue ? (
                <div className="border border-gray-200 rounded-md px-3 py-2 bg-gray-100 text-gray-500 text-sm">
                  From Playbook
                </div>
              ) : (
                <select
                  value={form.queue_id}
                  onChange={(e) => setForm({ ...form, queue_id: e.target.value })}
                  className="w-full border border-gray-300 rounded-md px-3 py-2"
                >
                  {userInboxQueue && (
                    <option value={userInboxQueue._id || userInboxQueue.id}>My Inbox</option>
                  )}
                  {queues
                    .filter(
                      (q) =>
                        !userInboxQueue ||
                        (q._id || q.id) !== (userInboxQueue._id || userInboxQueue.id)
                    )
                    .map((queue) => (
                      <option key={queue._id || queue.id} value={queue._id || queue.id}>
                        {queue.purpose}
                      </option>
                    ))}
                </select>
              )}
            </div>
          </div>

          {/* Instructions (optional) */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Instructions (optional)
            </label>
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              className="w-full border border-gray-300 rounded-md px-3 py-2"
              rows={4}
              placeholder="Additional instructions for this assignment..."
            />
          </div>

          {/* Advanced Section */}
          <div className="border-t pt-3">
            <button
              type="button"
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="flex items-center gap-2 text-sm font-medium text-gray-600 hover:text-gray-900"
            >
              {showAdvanced ? (
                <ChevronDown className="w-4 h-4" />
              ) : (
                <ChevronRight className="w-4 h-4" />
              )}
              Advanced
              {(form.approver_type ||
                form.scheduled_start_date ||
                form.is_recurring ||
                form.assignment_type !== 'queue') && (
                <span className="ml-1 px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded text-xs">
                  {
                    [
                      form.approver_type ? 'Approval' : '',
                      form.scheduled_start_date ? 'Scheduled' : '',
                      form.is_recurring ? 'Recurring' : '',
                      form.assignment_type !== 'queue' ? 'Direct Assign' : '',
                    ].filter(Boolean).length
                  }{' '}
                  set
                </span>
              )}
            </button>

            {showAdvanced && (
              <div className="mt-4 space-y-4 pl-2">
                {/* Approver Section */}
                {!form.is_recurring && (
                  <div>
                    <div className="flex items-center gap-3 mb-2">
                      <label className="text-sm font-medium text-gray-700">Approver</label>
                      <div className="flex gap-1">
                        <button
                          type="button"
                          onClick={() =>
                            setForm({
                              ...form,
                              approver_type: '',
                              approver_id: '',
                              approver_queue_id: '',
                            })
                          }
                          className={`px-2 py-1 text-xs rounded ${
                            !form.approver_type
                              ? 'bg-gray-200 text-gray-800'
                              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                          }`}
                        >
                          No Approval
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setForm({
                              ...form,
                              approver_type: 'user',
                              approver_id: '',
                              approver_queue_id: '',
                            })
                          }
                          className={`px-2 py-1 text-xs rounded ${
                            form.approver_type === 'user'
                              ? 'bg-blue-100 text-blue-800'
                              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                          }`}
                        >
                          User
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setForm({
                              ...form,
                              approver_type: 'team',
                              approver_id: '',
                              approver_queue_id: '',
                            })
                          }
                          className={`px-2 py-1 text-xs rounded ${
                            form.approver_type === 'team'
                              ? 'bg-blue-100 text-blue-800'
                              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                          }`}
                        >
                          Team
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setForm({
                              ...form,
                              approver_type: 'anyone',
                              approver_id: '',
                              approver_queue_id: '',
                            })
                          }
                          className={`px-2 py-1 text-xs rounded ${
                            form.approver_type === 'anyone'
                              ? 'bg-blue-100 text-blue-800'
                              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                          }`}
                        >
                          Anyone
                        </button>
                      </div>
                    </div>
                    {form.approver_type === 'user' && (
                      <select
                        value={form.approver_id}
                        onChange={(e) => setForm({ ...form, approver_id: e.target.value })}
                        className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                      >
                        <option value="">Select approver...</option>
                        {users.map((user) => (
                          <option key={user._id || user.id} value={user._id || user.id}>
                            {user.name}
                          </option>
                        ))}
                      </select>
                    )}
                    {form.approver_type === 'team' && (
                      <select
                        value={form.approver_id}
                        onChange={(e) => setForm({ ...form, approver_id: e.target.value })}
                        className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                      >
                        <option value="">Select approving team...</option>
                        {teams.map((team) => (
                          <option key={team._id || team.id} value={team._id || team.id}>
                            {team.name}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>
                )}

                {/* Schedule for Later */}
                <div>
                  <button
                    type="button"
                    onClick={() => setShowScheduling(!showScheduling)}
                    className="flex items-center gap-2 text-sm font-medium text-gray-700 hover:text-gray-900"
                  >
                    {showScheduling ? (
                      <ChevronDown className="w-4 h-4" />
                    ) : (
                      <ChevronRight className="w-4 h-4" />
                    )}
                    Schedule for Later
                    {(form.scheduled_start_date || form.scheduled_end_date) && (
                      <span className="ml-1 px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded text-xs">
                        Set
                      </span>
                    )}
                  </button>

                  {showScheduling && (
                    <div className="mt-3 space-y-3 pl-6">
                      <div>
                        <label className="block text-sm text-gray-600 mb-1">
                          Don't start before
                        </label>
                        <div className="flex gap-2">
                          <input
                            type="date"
                            value={form.scheduled_start_date}
                            onChange={(e) =>
                              setForm({ ...form, scheduled_start_date: e.target.value })
                            }
                            className="flex-1 border border-gray-300 rounded-md px-3 py-1.5 text-sm"
                          />
                          <input
                            type="time"
                            value={form.scheduled_start_time}
                            onChange={(e) =>
                              setForm({ ...form, scheduled_start_time: e.target.value })
                            }
                            className="w-28 border border-gray-300 rounded-md px-3 py-1.5 text-sm"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-sm text-gray-600 mb-1">
                          Work window closes (optional)
                        </label>
                        <div className="flex gap-2">
                          <input
                            type="date"
                            value={form.scheduled_end_date}
                            onChange={(e) =>
                              setForm({ ...form, scheduled_end_date: e.target.value })
                            }
                            className="flex-1 border border-gray-300 rounded-md px-3 py-1.5 text-sm"
                          />
                          <input
                            type="time"
                            value={form.scheduled_end_time}
                            onChange={(e) =>
                              setForm({ ...form, scheduled_end_time: e.target.value })
                            }
                            className="w-28 border border-gray-300 rounded-md px-3 py-1.5 text-sm"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-sm text-gray-600 mb-1">Timezone</label>
                        <select
                          value={form.schedule_timezone}
                          onChange={(e) => setForm({ ...form, schedule_timezone: e.target.value })}
                          className="w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm"
                        >
                          <option value="">Browser default</option>
                          {TIMEZONES.map((tz) => (
                            <option key={tz} value={tz}>
                              {tz}
                            </option>
                          ))}
                        </select>
                      </div>

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
                          className="text-xs text-red-600 hover:text-red-700"
                        >
                          Clear scheduling
                        </button>
                      )}
                    </div>
                  )}
                </div>

                {/* Make Recurring */}
                <div>
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
                    <div className="mt-3 space-y-3 pl-6">
                      <div className="flex items-center gap-3">
                        <select
                          value={form.recurrence_type}
                          onChange={(e) =>
                            setForm({
                              ...form,
                              recurrence_type: e.target.value as RecurrenceType,
                            })
                          }
                          className="border border-gray-300 rounded-md px-3 py-1.5 text-sm"
                        >
                          <option value="daily">Daily</option>
                          <option value="weekly">Weekly</option>
                          <option value="monthly">Monthly</option>
                        </select>
                        <span className="text-sm text-gray-600">every</span>
                        <input
                          type="number"
                          value={form.interval}
                          onChange={(e) =>
                            setForm({ ...form, interval: parseInt(e.target.value) || 1 })
                          }
                          className="w-16 border border-gray-300 rounded-md px-2 py-1.5 text-sm"
                          min={1}
                        />
                        <span className="text-sm text-gray-600">
                          {form.recurrence_type === 'daily'
                            ? 'day(s)'
                            : form.recurrence_type === 'weekly'
                              ? 'week(s)'
                              : 'month(s)'}
                        </span>
                      </div>

                      {form.recurrence_type === 'weekly' && (
                        <div className="flex flex-wrap gap-1">
                          {DAYS_OF_WEEK.map((day, index) => (
                            <button
                              key={day}
                              type="button"
                              onClick={() => toggleDayOfWeek(index)}
                              className={`px-2 py-1 rounded text-xs ${
                                form.days_of_week?.includes(index)
                                  ? 'bg-blue-600 text-white'
                                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                              }`}
                            >
                              {day}
                            </button>
                          ))}
                        </div>
                      )}

                      {form.recurrence_type === 'monthly' && (
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-gray-600">On day</span>
                          <input
                            type="number"
                            value={form.day_of_month}
                            onChange={(e) =>
                              setForm({ ...form, day_of_month: parseInt(e.target.value) || 1 })
                            }
                            className="w-16 border border-gray-300 rounded-md px-2 py-1.5 text-sm"
                            min={1}
                            max={31}
                          />
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Direct Assignment (Team/User) */}
                <div>
                  <div className="flex items-center gap-3 mb-2">
                    <label className="text-sm font-medium text-gray-700">Assign To</label>
                    <div className="flex gap-1">
                      <button
                        type="button"
                        onClick={() =>
                          setForm({ ...form, assignment_type: 'queue', team_id: '', user_id: '' })
                        }
                        className={`px-2 py-1 text-xs rounded ${
                          form.assignment_type === 'queue'
                            ? 'bg-gray-200 text-gray-800'
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}
                      >
                        Queue
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setForm({ ...form, assignment_type: 'team', team_id: '', user_id: '' })
                        }
                        className={`px-2 py-1 text-xs rounded ${
                          form.assignment_type === 'team'
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}
                      >
                        Team
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setForm({ ...form, assignment_type: 'user', team_id: '', user_id: '' })
                        }
                        className={`px-2 py-1 text-xs rounded ${
                          form.assignment_type === 'user'
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}
                      >
                        User
                      </button>
                    </div>
                  </div>
                  {form.assignment_type === 'team' && (
                    <select
                      value={form.team_id}
                      onChange={(e) => setForm({ ...form, team_id: e.target.value })}
                      className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                    >
                      <option value="">Select a team...</option>
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
                      className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                    >
                      <option value="">Select a user...</option>
                      {users.map((user) => (
                        <option key={user._id || user.id} value={user._id || user.id}>
                          {user.name}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
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
              type="button"
              onClick={(e) => handleSubmit(e, true)}
              disabled={saving || !form.title.trim()}
              className="px-4 py-2 border border-blue-600 text-blue-600 rounded-md hover:bg-blue-50 transition-colors disabled:opacity-50"
            >
              Create & Add Another
            </button>
            <button
              type="submit"
              disabled={saving || !form.title.trim()}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              {saving
                ? 'Creating...'
                : form.is_recurring
                  ? 'Create Recurring'
                  : 'Create'}
            </button>
          </ModalFooter>
        </form>
      )}
    </Modal>
  )
}
