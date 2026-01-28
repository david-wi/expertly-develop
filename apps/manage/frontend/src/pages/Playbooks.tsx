import { useEffect, useState } from 'react'
import { api, Playbook, CreatePlaybookRequest, ScopeType, User, Team, Queue, PlaybookStep, PlaybookStepCreate, AssigneeType } from '../services/api'
import { useAppStore } from '../stores/appStore'
import { createErrorLogger } from '../utils/errorLogger'

const logger = createErrorLogger('Playbooks')

// Generate a simple UUID for step IDs
function generateId(): string {
  return crypto.randomUUID ? crypto.randomUUID() :
    'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = Math.random() * 16 | 0
      const v = c === 'x' ? r : (r & 0x3 | 0x8)
      return v.toString(16)
    })
}

interface StepFormData {
  id: string
  title: string
  description: string
  when_to_perform: string
  parallel_group: string
  nested_playbook_id: string
  assignee_type: AssigneeType
  assignee_id: string
  queue_id: string
  approval_required: boolean
  approver_type: AssigneeType
  approver_id: string
  approver_queue_id: string
}

function createEmptyStep(): StepFormData {
  return {
    id: generateId(),
    title: '',
    description: '',
    when_to_perform: '',
    parallel_group: '',
    nested_playbook_id: '',
    assignee_type: 'anyone',
    assignee_id: '',
    queue_id: '',
    approval_required: false,
    approver_type: 'anyone',
    approver_id: '',
    approver_queue_id: '',
  }
}

function stepFormToCreate(step: StepFormData, order: number): PlaybookStepCreate {
  return {
    id: step.id,
    order,
    title: step.title,
    description: step.description || undefined,
    when_to_perform: step.when_to_perform || undefined,
    parallel_group: step.parallel_group || undefined,
    nested_playbook_id: step.nested_playbook_id || undefined,
    assignee_type: step.assignee_type,
    assignee_id: step.assignee_type !== 'anyone' ? step.assignee_id || undefined : undefined,
    queue_id: step.queue_id || undefined,
    approval_required: step.approval_required,
    approver_type: step.approval_required ? step.approver_type : undefined,
    approver_id: step.approval_required && step.approver_type !== 'anyone' ? step.approver_id || undefined : undefined,
    approver_queue_id: step.approval_required ? step.approver_queue_id || undefined : undefined,
  }
}

function playbookStepToForm(step: PlaybookStep): StepFormData {
  return {
    id: step.id,
    title: step.title,
    description: step.description || '',
    when_to_perform: step.when_to_perform || '',
    parallel_group: step.parallel_group || '',
    nested_playbook_id: step.nested_playbook_id || '',
    assignee_type: step.assignee_type,
    assignee_id: step.assignee_id || '',
    queue_id: step.queue_id || '',
    approval_required: step.approval_required,
    approver_type: step.approver_type || 'anyone',
    approver_id: step.approver_id || '',
    approver_queue_id: step.approver_queue_id || '',
  }
}

interface StepEditorProps {
  step: StepFormData
  index: number
  totalSteps: number
  expanded: boolean
  onToggleExpand: () => void
  onChange: (step: StepFormData) => void
  onMoveUp: () => void
  onMoveDown: () => void
  onDelete: () => void
  onDragStart: (index: number) => void
  onDragOver: (e: React.DragEvent, index: number) => void
  onDragEnd: () => void
  isDragging: boolean
  isDragOver: boolean
  users: User[]
  teams: Team[]
  queues: Queue[]
  playbooks: Playbook[]
  currentPlaybookId?: string
}

function StepEditor({
  step,
  index,
  totalSteps,
  expanded,
  onToggleExpand,
  onChange,
  onMoveUp,
  onMoveDown,
  onDelete,
  onDragStart,
  onDragOver,
  onDragEnd,
  isDragging,
  isDragOver,
  users,
  teams,
  queues,
  playbooks,
  currentPlaybookId,
}: StepEditorProps) {
  const updateField = <K extends keyof StepFormData>(field: K, value: StepFormData[K]) => {
    onChange({ ...step, [field]: value })
  }

  // Filter out current playbook from nested options
  const availablePlaybooks = playbooks.filter(p => p.id !== currentPlaybookId)

  // Get assignee label for collapsed view
  const getAssigneeLabel = () => {
    if (step.assignee_type === 'user' && step.assignee_id) {
      const user = users.find(u => u.id === step.assignee_id)
      return user?.name || 'User'
    }
    if (step.assignee_type === 'team' && step.assignee_id) {
      const team = teams.find(t => t.id === step.assignee_id)
      return team?.name || 'Team'
    }
    return 'Anyone'
  }

  return (
    <div
      className={`border rounded-lg bg-white shadow-sm transition-all ${
        isDragging ? 'opacity-50 scale-95' : ''
      } ${isDragOver ? 'border-blue-400 border-2' : ''}`}
      draggable
      onDragStart={() => onDragStart(index)}
      onDragOver={(e) => onDragOver(e, index)}
      onDragEnd={onDragEnd}
    >
      {/* Header - always visible, inline editing */}
      <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 rounded-t-lg border-b cursor-grab active:cursor-grabbing">
        <span className="flex items-center justify-center w-6 h-6 bg-blue-100 text-blue-700 text-xs font-medium rounded-full flex-shrink-0">
          {index + 1}
        </span>
        <input
          type="text"
          value={step.title}
          onChange={(e) => updateField('title', e.target.value)}
          className="flex-1 bg-transparent border-0 focus:ring-0 text-sm font-medium text-gray-900 placeholder-gray-400 px-1 py-0.5"
          placeholder="Step title..."
        />
        {step.description && !expanded && (
          <span
            className="text-gray-400 cursor-help"
            title={step.description}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </span>
        )}
        {!expanded && (
          <span className="text-xs text-gray-400 hidden sm:inline">
            {getAssigneeLabel()}
          </span>
        )}
        <div className="flex items-center gap-0.5 flex-shrink-0">
          <button
            type="button"
            onClick={onMoveUp}
            disabled={index === 0}
            className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30"
            title="Move up"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
            </svg>
          </button>
          <button
            type="button"
            onClick={onMoveDown}
            disabled={index === totalSteps - 1}
            className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30"
            title="Move down"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          <button
            type="button"
            onClick={onToggleExpand}
            className="p-1 text-gray-400 hover:text-gray-600"
            title={expanded ? 'Collapse' : 'Expand'}
          >
            <svg className={`w-4 h-4 transition-transform ${expanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          <button
            type="button"
            onClick={onDelete}
            className="p-1 text-gray-400 hover:text-red-600"
            title="Delete step"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      {/* Expanded content - compact layout */}
      {expanded && (
        <div className="p-3 space-y-3 text-sm">
          {/* Description and When to Perform - side by side on larger screens */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Instructions</label>
              <textarea
                value={step.description}
                onChange={(e) => updateField('description', e.target.value)}
                className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm"
                rows={2}
                placeholder="What needs to be done?"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">When to Perform</label>
              <textarea
                value={step.when_to_perform}
                onChange={(e) => updateField('when_to_perform', e.target.value)}
                className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm"
                rows={2}
                placeholder="Conditions or timing (optional)"
              />
            </div>
          </div>

          {/* Two-column layout for assignment and options */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Assignment */}
            <div className="space-y-2">
              <label className="block text-xs font-medium text-gray-500">Assign to</label>
              <select
                value={step.assignee_type}
                onChange={(e) => {
                  updateField('assignee_type', e.target.value as AssigneeType)
                  updateField('assignee_id', '')
                }}
                className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm"
              >
                <option value="anyone">Anyone</option>
                <option value="user">Specific person</option>
                <option value="team">Team</option>
              </select>
              {step.assignee_type === 'user' && (
                <select
                  value={step.assignee_id}
                  onChange={(e) => updateField('assignee_id', e.target.value)}
                  className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm"
                >
                  <option value="">Select person...</option>
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>{u.name}</option>
                  ))}
                </select>
              )}
              {step.assignee_type === 'team' && (
                <select
                  value={step.assignee_id}
                  onChange={(e) => updateField('assignee_id', e.target.value)}
                  className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm"
                >
                  <option value="">Select team...</option>
                  {teams.map((t) => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              )}
            </div>

            {/* Queue, parallel group, and nested playbook */}
            <div className="space-y-2">
              <label className="block text-xs font-medium text-gray-500">Queue</label>
              <select
                value={step.queue_id}
                onChange={(e) => updateField('queue_id', e.target.value)}
                className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm"
              >
                <option value="">Default queue</option>
                {queues.map((q) => (
                  <option key={q.id} value={q.id}>{q.purpose}</option>
                ))}
              </select>
              <label className="block text-xs font-medium text-gray-500">Parallel Group</label>
              <input
                type="text"
                value={step.parallel_group}
                onChange={(e) => updateField('parallel_group', e.target.value)}
                className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm"
                placeholder="Steps with same group run in parallel"
              />
              {availablePlaybooks.length > 0 && (
                <>
                  <label className="block text-xs font-medium text-gray-500">Nested Playbook</label>
                  <select
                    value={step.nested_playbook_id}
                    onChange={(e) => updateField('nested_playbook_id', e.target.value)}
                    className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm"
                  >
                    <option value="">None</option>
                    {availablePlaybooks.map((pb) => (
                      <option key={pb.id} value={pb.id}>{pb.name}</option>
                    ))}
                  </select>
                </>
              )}
            </div>
          </div>

          {/* Approval - compact toggle */}
          <div className="border-t pt-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={step.approval_required}
                onChange={(e) => updateField('approval_required', e.target.checked)}
                className="rounded border-gray-300 text-blue-600"
              />
              <span className="text-xs font-medium text-gray-700">Requires approval</span>
            </label>

            {step.approval_required && (
              <div className="mt-2 pl-5 grid grid-cols-1 sm:grid-cols-2 gap-2">
                <select
                  value={step.approver_type}
                  onChange={(e) => {
                    updateField('approver_type', e.target.value as AssigneeType)
                    updateField('approver_id', '')
                  }}
                  className="border border-gray-300 rounded px-2 py-1.5 text-sm"
                >
                  <option value="anyone">Anyone can approve</option>
                  <option value="user">Specific approver</option>
                  <option value="team">Team approves</option>
                </select>
                {step.approver_type === 'user' && (
                  <select
                    value={step.approver_id}
                    onChange={(e) => updateField('approver_id', e.target.value)}
                    className="border border-gray-300 rounded px-2 py-1.5 text-sm"
                  >
                    <option value="">Select approver...</option>
                    {users.map((u) => (
                      <option key={u.id} value={u.id}>{u.name}</option>
                    ))}
                  </select>
                )}
                {step.approver_type === 'team' && (
                  <select
                    value={step.approver_id}
                    onChange={(e) => updateField('approver_id', e.target.value)}
                    className="border border-gray-300 rounded px-2 py-1.5 text-sm"
                  >
                    <option value="">Select team...</option>
                    {teams.map((t) => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </select>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default function Playbooks() {
  const { user } = useAppStore()
  const [playbooks, setPlaybooks] = useState<Playbook[]>([])
  const [users, setUsers] = useState<User[]>([])
  const [teams, setTeams] = useState<Team[]>([])
  const [queues, setQueues] = useState<Queue[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedPlaybook, setSelectedPlaybook] = useState<Playbook | null>(null)

  // Modal states
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [showHistoryModal, setShowHistoryModal] = useState(false)

  // Editor state (used for both create and edit)
  const [isEditing, setIsEditing] = useState(false)
  const [editingPlaybook, setEditingPlaybook] = useState<Playbook | null>(null)
  const [formData, setFormData] = useState<{
    name: string
    description: string
    inputs_template: string
    scope_type: ScopeType
    scope_id: string
  }>({
    name: '',
    description: '',
    inputs_template: '',
    scope_type: 'user',
    scope_id: '',
  })
  const [steps, setSteps] = useState<StepFormData[]>([])
  const [expandedSteps, setExpandedSteps] = useState<Set<string>>(new Set())
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Drag-and-drop state
  const [dragIndex, setDragIndex] = useState<number | null>(null)
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null)

  useEffect(() => {
    loadData()
  }, [])

  // Close modals on Escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (isEditing) {
          setIsEditing(false)
          setEditingPlaybook(null)
        } else {
          setShowCreateModal(false)
          setShowDeleteConfirm(false)
          setShowHistoryModal(false)
        }
      }
    }
    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [isEditing])

  const loadData = async () => {
    setLoading(true)
    setError(null)
    try {
      const [playbooksData, usersData, teamsData, queuesData] = await Promise.all([
        api.getPlaybooks(),
        api.getUsers('human'),
        api.getTeams(),
        api.getQueues(),
      ])
      setPlaybooks(playbooksData)
      setUsers(usersData)
      setTeams(teamsData)
      setQueues(queuesData)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load data'
      setError(message)
      logger.error(err, { action: 'loadData' })
    } finally {
      setLoading(false)
    }
  }

  const getScopeLabel = (playbook: Playbook): string => {
    if (playbook.scope_type === 'user') {
      if (playbook.scope_id === user?.id) {
        return `Private (${user?.name || 'You'})`
      }
      const scopeUser = users.find(u => u.id === playbook.scope_id)
      return `Private (${scopeUser?.name || 'User'})`
    }
    if (playbook.scope_type === 'team') {
      const team = teams.find(t => t.id === playbook.scope_id)
      return `Team: ${team?.name || 'Unknown'}`
    }
    return 'Everyone'
  }

  const getScopeBadgeColor = (scopeType: ScopeType): string => {
    switch (scopeType) {
      case 'user':
        return 'bg-blue-100 text-blue-800'
      case 'team':
        return 'bg-purple-100 text-purple-800'
      case 'organization':
        return 'bg-green-100 text-green-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.name.trim()) return

    setSaving(true)
    setError(null)
    try {
      const newPlaybook: CreatePlaybookRequest = {
        name: formData.name.trim(),
        description: formData.description.trim() || undefined,
        inputs_template: formData.inputs_template.trim() || undefined,
        scope_type: formData.scope_type,
        scope_id: formData.scope_type === 'organization' ? undefined : formData.scope_id || undefined,
      }
      await api.createPlaybook(newPlaybook)
      await loadData()
      setShowCreateModal(false)
      resetForm()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create playbook'
      setError(message)
      logger.error(err, { action: 'createPlaybook', additionalContext: { name: formData.name } })
    } finally {
      setSaving(false)
    }
  }

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingPlaybook || !formData.name.trim()) return

    // Validate that all steps have titles
    const invalidSteps = steps.filter(s => !s.title.trim())
    if (invalidSteps.length > 0) {
      setError('All steps must have a title')
      return
    }

    setSaving(true)
    setError(null)
    try {
      await api.updatePlaybook(editingPlaybook.id, {
        name: formData.name.trim(),
        description: formData.description.trim() || undefined,
        inputs_template: formData.inputs_template.trim() || undefined,
        steps: steps.map((s, idx) => stepFormToCreate(s, idx + 1)),
        scope_type: formData.scope_type,
        scope_id: formData.scope_type === 'organization' ? undefined : formData.scope_id || undefined,
      })
      await loadData()
      setIsEditing(false)
      setEditingPlaybook(null)
      resetForm()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to save playbook'
      setError(message)
      logger.error(err, { action: 'updatePlaybook', additionalContext: { playbookId: editingPlaybook.id, name: formData.name } })
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!selectedPlaybook) return

    setSaving(true)
    setError(null)
    try {
      await api.deletePlaybook(selectedPlaybook.id)
      await loadData()
      setShowDeleteConfirm(false)
      setSelectedPlaybook(null)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to delete playbook'
      setError(message)
      logger.error(err, { action: 'deletePlaybook', additionalContext: { playbookId: selectedPlaybook.id, name: selectedPlaybook.name } })
    } finally {
      setSaving(false)
    }
  }

  const handleDuplicate = async (playbook: Playbook) => {
    setError(null)
    try {
      await api.duplicatePlaybook(playbook.id)
      await loadData()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to duplicate playbook'
      setError(message)
      logger.error(err, { action: 'duplicatePlaybook', additionalContext: { playbookId: playbook.id, name: playbook.name } })
    }
  }

  const openCreateModal = () => {
    resetForm()
    setShowCreateModal(true)
  }

  const openEditor = (playbook: Playbook) => {
    setEditingPlaybook(playbook)
    setFormData({
      name: playbook.name,
      description: playbook.description || '',
      inputs_template: playbook.inputs_template || '',
      scope_type: playbook.scope_type,
      scope_id: playbook.scope_id || '',
    })
    setSteps(playbook.steps.map(playbookStepToForm))
    setExpandedSteps(new Set())
    setIsEditing(true)
  }

  const openDeleteConfirm = (playbook: Playbook) => {
    setSelectedPlaybook(playbook)
    setShowDeleteConfirm(true)
  }

  const openHistoryModal = (playbook: Playbook) => {
    setSelectedPlaybook(playbook)
    setShowHistoryModal(true)
  }

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      inputs_template: '',
      scope_type: 'user',
      scope_id: '',
    })
    setSteps([])
    setExpandedSteps(new Set())
  }

  const addStep = () => {
    const newStep = createEmptyStep()
    setSteps([...steps, newStep])
    setExpandedSteps(new Set([...expandedSteps, newStep.id]))
  }

  const updateStep = (index: number, updatedStep: StepFormData) => {
    const newSteps = [...steps]
    newSteps[index] = updatedStep
    setSteps(newSteps)
  }

  const deleteStep = (index: number) => {
    const newSteps = steps.filter((_, i) => i !== index)
    setSteps(newSteps)
  }

  const moveStep = (index: number, direction: 'up' | 'down') => {
    const newSteps = [...steps]
    const targetIndex = direction === 'up' ? index - 1 : index + 1
    ;[newSteps[index], newSteps[targetIndex]] = [newSteps[targetIndex], newSteps[index]]
    setSteps(newSteps)
  }

  // Drag-and-drop handlers
  const handleDragStart = (index: number) => {
    setDragIndex(index)
  }

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault()
    if (dragIndex !== null && dragIndex !== index) {
      setDragOverIndex(index)
    }
  }

  const handleDragEnd = () => {
    if (dragIndex !== null && dragOverIndex !== null && dragIndex !== dragOverIndex) {
      const newSteps = [...steps]
      const [draggedStep] = newSteps.splice(dragIndex, 1)
      newSteps.splice(dragOverIndex, 0, draggedStep)
      setSteps(newSteps)
    }
    setDragIndex(null)
    setDragOverIndex(null)
  }

  const toggleStepExpand = (stepId: string) => {
    const newExpanded = new Set(expandedSteps)
    if (newExpanded.has(stepId)) {
      newExpanded.delete(stepId)
    } else {
      newExpanded.add(stepId)
    }
    setExpandedSteps(newExpanded)
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  }

  // Full-page editor view
  if (isEditing && editingPlaybook) {
    return (
      <div className="space-y-4">
        {/* Error banner */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start justify-between">
            <div className="flex items-start">
              <svg className="w-5 h-5 text-red-500 mt-0.5 mr-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div>
                <p className="text-sm font-medium text-red-800">Error</p>
                <p className="text-sm text-red-700">{error}</p>
              </div>
            </div>
            <button
              onClick={() => setError(null)}
              className="text-red-500 hover:text-red-700"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        )}

        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <button
              onClick={() => {
                setIsEditing(false)
                setEditingPlaybook(null)
              }}
              className="text-gray-600 hover:text-gray-800"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
            </button>
            <h2 className="text-2xl font-bold text-gray-900">Edit Playbook</h2>
          </div>
          <div className="flex items-center space-x-3">
            <button
              onClick={() => {
                setIsEditing(false)
                setEditingPlaybook(null)
              }}
              className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-md transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSaveEdit}
              disabled={saving}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </div>

        <form onSubmit={handleSaveEdit} className="space-y-6">
          {/* Basic Info */}
          <div className="bg-white shadow rounded-lg p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Basic Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Playbook Name
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full border border-gray-300 rounded-md px-3 py-2"
                  placeholder="e.g., Customer Onboarding, Bug Triage"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Visibility
                </label>
                <select
                  value={formData.scope_type}
                  onChange={(e) => setFormData({ ...formData, scope_type: e.target.value as ScopeType, scope_id: '' })}
                  className="w-full border border-gray-300 rounded-md px-3 py-2"
                >
                  <option value="user">Private (just me)</option>
                  <option value="team">Team</option>
                  <option value="organization">Everyone</option>
                </select>
              </div>
              {formData.scope_type === 'team' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Select Team
                  </label>
                  <select
                    value={formData.scope_id}
                    onChange={(e) => setFormData({ ...formData, scope_id: e.target.value })}
                    className="w-full border border-gray-300 rounded-md px-3 py-2"
                    required
                  >
                    <option value="">Choose a team...</option>
                    {teams.map((team) => (
                      <option key={team.id} value={team.id}>
                        {team.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full border border-gray-300 rounded-md px-3 py-2"
                  rows={2}
                  placeholder="Brief description of this playbook"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Required Information
                </label>
                <textarea
                  value={formData.inputs_template}
                  onChange={(e) => setFormData({ ...formData, inputs_template: e.target.value })}
                  className="w-full border border-gray-300 rounded-md px-3 py-2"
                  rows={2}
                  placeholder="What information should be provided when starting this playbook? (e.g., Customer name, Order ID, Issue description)"
                />
              </div>
            </div>
          </div>

          {/* Steps */}
          <div className="bg-white shadow rounded-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium text-gray-900">Steps</h3>
              <button
                type="button"
                onClick={addStep}
                className="text-blue-600 hover:text-blue-800 text-sm font-medium"
              >
                + Add Step
              </button>
            </div>

            {steps.length === 0 ? (
              <div className="text-center py-8 border-2 border-dashed border-gray-300 rounded-lg">
                <p className="text-gray-500 mb-3">No steps yet</p>
                <button
                  type="button"
                  onClick={addStep}
                  className="text-blue-600 hover:text-blue-800 font-medium"
                >
                  Add your first step
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                {steps.map((step, index) => (
                  <StepEditor
                    key={step.id}
                    step={step}
                    index={index}
                    totalSteps={steps.length}
                    expanded={expandedSteps.has(step.id)}
                    onToggleExpand={() => toggleStepExpand(step.id)}
                    onChange={(updated) => updateStep(index, updated)}
                    onMoveUp={() => moveStep(index, 'up')}
                    onMoveDown={() => moveStep(index, 'down')}
                    onDelete={() => deleteStep(index)}
                    onDragStart={handleDragStart}
                    onDragOver={handleDragOver}
                    onDragEnd={handleDragEnd}
                    isDragging={dragIndex === index}
                    isDragOver={dragOverIndex === index}
                    users={users}
                    teams={teams}
                    queues={queues}
                    playbooks={playbooks}
                    currentPlaybookId={editingPlaybook.id}
                  />
                ))}
                <button
                  type="button"
                  onClick={addStep}
                  className="w-full py-3 border-2 border-dashed border-gray-300 rounded-lg text-gray-500 hover:border-blue-400 hover:text-blue-600 transition-colors"
                >
                  + Add Another Step
                </button>
              </div>
            )}
          </div>
        </form>
      </div>
    )
  }

  // List view
  return (
    <div className="space-y-4">
      {/* Error banner */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start justify-between">
          <div className="flex items-start">
            <svg className="w-5 h-5 text-red-500 mt-0.5 mr-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div>
              <p className="text-sm font-medium text-red-800">Error</p>
              <p className="text-sm text-red-700">{error}</p>
            </div>
          </div>
          <button
            onClick={() => setError(null)}
            className="text-red-500 hover:text-red-700"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900">Playbooks</h2>
        <div className="flex items-center space-x-3">
          <button
            onClick={loadData}
            className="text-gray-600 hover:text-gray-700 text-sm"
            disabled={loading}
          >
            {loading ? 'Refreshing...' : 'Refresh'}
          </button>
          <button
            onClick={openCreateModal}
            className="bg-blue-600 text-white px-3 py-1.5 rounded-md text-sm hover:bg-blue-700 transition-colors"
          >
            New Playbook
          </button>
        </div>
      </div>

      {/* Playbooks List */}
      <div className="bg-white shadow rounded-lg overflow-hidden">
        {loading ? (
          <div className="p-4 text-gray-500">Loading...</div>
        ) : (
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Playbook
                </th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-32">
                  Scope
                </th>
                <th className="px-4 py-2 text-center text-xs font-medium text-gray-500 uppercase tracking-wider w-14">
                  Steps
                </th>
                <th className="px-4 py-2 text-center text-xs font-medium text-gray-500 uppercase tracking-wider w-16">
                  Version
                </th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
                  Updated
                </th>
                <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider w-28">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {playbooks.map((playbook) => (
                <tr key={playbook.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div>
                      <button
                        onClick={() => openEditor(playbook)}
                        className="font-medium text-gray-900 hover:text-blue-600 text-left"
                      >
                        {playbook.name}
                      </button>
                      {playbook.description && (
                        <p className="text-xs text-gray-500 truncate max-w-md">
                          {playbook.description}
                        </p>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${getScopeBadgeColor(playbook.scope_type)}`}>
                      {getScopeLabel(playbook)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className="text-sm text-gray-600">{playbook.steps?.length || 0}</span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className="text-sm text-gray-600">v{playbook.version}</span>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className="text-sm text-gray-500">{formatDate(playbook.updated_at)}</span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end space-x-1">
                      {playbook.history.length > 0 && (
                        <button
                          onClick={() => openHistoryModal(playbook)}
                          className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded transition-colors"
                          title="View history"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                        </button>
                      )}
                      <button
                        onClick={() => handleDuplicate(playbook)}
                        className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded transition-colors"
                        title="Duplicate playbook"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                        </svg>
                      </button>
                      <button
                        onClick={() => openEditor(playbook)}
                        className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                        title="Edit playbook"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </button>
                      <button
                        onClick={() => openDeleteConfirm(playbook)}
                        className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                        title="Delete playbook"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {playbooks.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                    No playbooks found. Create one to get started.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* Create Playbook Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Create New Playbook</h3>
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Name
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full border border-gray-300 rounded-md px-3 py-2"
                  placeholder="e.g., Customer Onboarding, Bug Triage"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description (optional)
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full border border-gray-300 rounded-md px-3 py-2"
                  rows={2}
                  placeholder="Brief description of this playbook"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Visibility
                </label>
                <select
                  value={formData.scope_type}
                  onChange={(e) => setFormData({ ...formData, scope_type: e.target.value as ScopeType, scope_id: '' })}
                  className="w-full border border-gray-300 rounded-md px-3 py-2"
                >
                  <option value="user">Private (just me)</option>
                  <option value="team">Team</option>
                  <option value="organization">Everyone</option>
                </select>
              </div>
              {formData.scope_type === 'team' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Select Team
                  </label>
                  <select
                    value={formData.scope_id}
                    onChange={(e) => setFormData({ ...formData, scope_id: e.target.value })}
                    className="w-full border border-gray-300 rounded-md px-3 py-2"
                    required
                  >
                    <option value="">Choose a team...</option>
                    {teams.map((team) => (
                      <option key={team.id} value={team.id}>
                        {team.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <div className="flex justify-end space-x-3">
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
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && selectedPlaybook && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-sm w-full p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-2">Delete Playbook?</h3>
            <p className="text-gray-500 mb-4">
              Are you sure you want to delete "{selectedPlaybook.name}"? This action cannot be undone.
            </p>
            <div className="flex justify-end space-x-3">
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
            </div>
          </div>
        </div>
      )}

      {/* History Modal */}
      {showHistoryModal && selectedPlaybook && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">
              Version History: {selectedPlaybook.name}
            </h3>
            <div className="space-y-3 max-h-64 overflow-y-auto">
              {/* Current version */}
              <div className="border-l-4 border-blue-500 pl-3 py-1">
                <p className="font-medium text-gray-900">
                  v{selectedPlaybook.version} (current)
                </p>
                <p className="text-sm text-gray-500">{selectedPlaybook.name}</p>
                <p className="text-xs text-gray-400">{selectedPlaybook.steps?.length || 0} steps</p>
              </div>
              {/* Historical versions */}
              {selectedPlaybook.history.slice().reverse().map((entry, idx) => (
                <div key={idx} className="border-l-4 border-gray-300 pl-3 py-1">
                  <p className="font-medium text-gray-700">v{entry.version}</p>
                  <p className="text-sm text-gray-500">{entry.name}</p>
                  <p className="text-xs text-gray-400">
                    {entry.steps?.length || 0} steps - {formatDate(entry.changed_at)}
                  </p>
                </div>
              ))}
            </div>
            <div className="flex justify-end mt-4">
              <button
                onClick={() => setShowHistoryModal(false)}
                className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-md transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
