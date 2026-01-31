import { useEffect, useState, useCallback, useMemo } from 'react'
import { FolderPlus } from 'lucide-react'
import { Modal, ModalFooter } from '@expertly/ui'
import { api, Playbook, CreatePlaybookRequest, ScopeType, User, Team, Queue, PlaybookStep, PlaybookStepCreate, AssigneeType, PlaybookReorderItem, GeneratedStep } from '../services/api'
import { useAppStore } from '../stores/appStore'
import { createErrorLogger } from '../utils/errorLogger'
import { useUnsavedChanges } from '../hooks/useUnsavedChanges'

const logger = createErrorLogger('Playbooks')

// Local storage key for recent parent history
const RECENT_PARENTS_KEY = 'playbook-recent-parents'
const MAX_RECENT = 5

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

// Helper functions for recent parent tracking
function getRecentParents(): (string | null)[] {
  try {
    const stored = localStorage.getItem(RECENT_PARENTS_KEY)
    return stored ? JSON.parse(stored) : []
  } catch {
    return []
  }
}

function recordParentUsage(parentId: string | null) {
  try {
    const recent = getRecentParents()
    const newRecent = [parentId, ...recent.filter(p => p !== parentId)].slice(0, MAX_RECENT)
    localStorage.setItem(RECENT_PARENTS_KEY, JSON.stringify(newRecent))
  } catch {
    // Ignore localStorage errors
  }
}

function getSuggestedParent(): string | null {
  const recent = getRecentParents()
  if (recent.length === 0) return null

  // Count occurrences
  const counts: Record<string, number> = {}
  for (const p of recent) {
    const key = p ?? '__null__'
    counts[key] = (counts[key] || 0) + 1
  }

  // Find most common
  let maxCount = 0
  let suggested: string | null = null
  for (const [key, count] of Object.entries(counts)) {
    if (count > maxCount) {
      maxCount = count
      suggested = key === '__null__' ? null : key
    }
  }
  return suggested
}

// Tree node structure for rendering
interface TreeNode {
  playbook: Playbook
  children: TreeNode[]
  depth: number
}

// Build tree structure from flat list
function buildTree(playbooks: Playbook[]): TreeNode[] {
  const map = new Map<string, TreeNode>()
  const roots: TreeNode[] = []

  // Create nodes for all playbooks
  for (const pb of playbooks) {
    map.set(pb.id, { playbook: pb, children: [], depth: 0 })
  }

  // Build tree structure
  for (const pb of playbooks) {
    const node = map.get(pb.id)!
    if (pb.parent_id && map.has(pb.parent_id)) {
      const parent = map.get(pb.parent_id)!
      node.depth = parent.depth + 1
      parent.children.push(node)
    } else {
      roots.push(node)
    }
  }

  // Sort children alphabetically by name
  const sortChildren = (nodes: TreeNode[]) => {
    nodes.sort((a, b) => a.playbook.name.localeCompare(b.playbook.name))
    for (const node of nodes) {
      sortChildren(node.children)
    }
  }
  sortChildren(roots)

  return roots
}

// Flatten tree for rendering while preserving hierarchy
function flattenTree(nodes: TreeNode[]): TreeNode[] {
  const result: TreeNode[] = []
  const flatten = (nodes: TreeNode[]) => {
    for (const node of nodes) {
      result.push(node)
      flatten(node.children)
    }
  }
  flatten(nodes)
  return result
}

// Drop position types
type DropPosition = 'before' | 'after' | 'inside'

interface DropTarget {
  targetId: string
  position: DropPosition
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
        <textarea
          value={step.title}
          onChange={(e) => updateField('title', e.target.value)}
          onInput={(e) => {
            const target = e.target as HTMLTextAreaElement
            target.style.height = 'auto'
            target.style.height = target.scrollHeight + 'px'
          }}
          ref={(el) => {
            if (el) {
              el.style.height = 'auto'
              el.style.height = el.scrollHeight + 'px'
            }
          }}
          className="flex-1 bg-transparent border-0 focus:ring-0 text-sm font-medium text-gray-900 placeholder-gray-400 px-1 py-0.5 resize-none overflow-hidden min-h-[1.5rem]"
          placeholder="Step title..."
          rows={1}
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

// Tree item component for playbook list
interface PlaybookTreeItemProps {
  node: TreeNode
  isExpanded: boolean
  onToggleExpand: () => void
  onEdit: (playbook: Playbook) => void
  onDelete: (playbook: Playbook) => void
  onDuplicate: (playbook: Playbook) => void
  onHistory: (playbook: Playbook) => void
  onDragStart: (e: React.DragEvent, playbookId: string) => void
  onDragOver: (e: React.DragEvent, playbookId: string) => void
  onDragLeave: (e: React.DragEvent) => void
  onDrop: (e: React.DragEvent, playbookId: string) => void
  dropTarget: DropTarget | null
  isDragging: boolean
  hasChildren: boolean
  getScopeLabel: (playbook: Playbook) => string
  getScopeBadgeColor: (scopeType: ScopeType) => string
  formatDate: (dateString: string) => string
}

function PlaybookTreeItem({
  node,
  isExpanded,
  onToggleExpand,
  onEdit,
  onDelete,
  onDuplicate,
  onHistory,
  onDragStart,
  onDragOver,
  onDragLeave,
  onDrop,
  dropTarget,
  isDragging,
  hasChildren,
  getScopeLabel,
  getScopeBadgeColor,
  formatDate,
}: PlaybookTreeItemProps) {
  const { playbook, depth } = node
  const isGroup = playbook.item_type === 'group'
  const showChevron = isGroup || hasChildren

  const isDropTarget = dropTarget?.targetId === playbook.id
  const dropPosition = isDropTarget ? dropTarget.position : null

  return (
    <div
      className={`relative ${isDragging ? 'opacity-50' : ''}`}
      draggable
      onDragStart={(e) => onDragStart(e, playbook.id)}
      onDragOver={(e) => onDragOver(e, playbook.id)}
      onDragLeave={onDragLeave}
      onDrop={(e) => onDrop(e, playbook.id)}
    >
      {/* Drop indicator - before */}
      {dropPosition === 'before' && (
        <div className="absolute left-0 right-0 top-0 h-0.5 bg-blue-500 z-10" style={{ marginLeft: depth * 24 }} />
      )}

      <div
        className={`flex items-center gap-2 px-3 py-2 hover:bg-gray-50 cursor-grab active:cursor-grabbing border-b border-gray-100 ${
          dropPosition === 'inside' ? 'bg-blue-50 ring-2 ring-blue-300 ring-inset' : ''
        }`}
        style={{ paddingLeft: 12 + depth * 24 }}
      >
        {/* Expand/collapse button */}
        {showChevron ? (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              onToggleExpand()
            }}
            className="p-0.5 text-gray-400 hover:text-gray-600 flex-shrink-0"
          >
            <svg
              className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        ) : (
          <span className="w-5 flex-shrink-0" />
        )}

        {/* Icon */}
        {isGroup ? (
          <svg className="w-5 h-5 text-yellow-500 flex-shrink-0" fill="currentColor" viewBox="0 0 24 24">
            <path d="M10 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z" />
          </svg>
        ) : (
          <svg className="w-5 h-5 text-blue-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        )}

        {/* Name */}
        <button
          onClick={() => isGroup ? onToggleExpand() : onEdit(playbook)}
          className="flex-1 text-left font-medium text-gray-900 hover:text-blue-600 truncate"
        >
          {playbook.name}
        </button>

        {/* Scope badge */}
        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${getScopeBadgeColor(playbook.scope_type)} flex-shrink-0`}>
          {getScopeLabel(playbook)}
        </span>

        {/* Steps count (for playbooks only) */}
        {!isGroup && (
          <span className="text-xs text-gray-400 w-12 text-center flex-shrink-0">
            {playbook.steps?.length || 0} steps
          </span>
        )}

        {/* Updated date */}
        <span className="text-xs text-gray-400 w-20 flex-shrink-0 hidden sm:block">
          {formatDate(playbook.updated_at)}
        </span>

        {/* Actions */}
        <div className="flex items-center gap-0.5 flex-shrink-0">
          {!isGroup && playbook.history.length > 0 && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                onHistory(playbook)
              }}
              className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded transition-colors"
              title="View history"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </button>
          )}
          <button
            onClick={(e) => {
              e.stopPropagation()
              onDuplicate(playbook)
            }}
            className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded transition-colors"
            title="Duplicate"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
          </button>
          {!isGroup && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                onEdit(playbook)
              }}
              className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
              title="Edit"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
            </button>
          )}
          <button
            onClick={(e) => {
              e.stopPropagation()
              onDelete(playbook)
            }}
            className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
            title="Delete"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>
      </div>

      {/* Drop indicator - after */}
      {dropPosition === 'after' && (
        <div className="absolute left-0 right-0 bottom-0 h-0.5 bg-blue-500 z-10" style={{ marginLeft: depth * 24 }} />
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
  const [showCreateGroupModal, setShowCreateGroupModal] = useState(false)
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
    parent_id: string
  }>({
    name: '',
    description: '',
    inputs_template: '',
    scope_type: 'user',
    scope_id: '',
    parent_id: '',
  })
  const [steps, setSteps] = useState<StepFormData[]>([])
  const [expandedSteps, setExpandedSteps] = useState<Set<string>>(new Set())
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Tree state
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())
  const [draggedId, setDraggedId] = useState<string | null>(null)
  const [dropTarget, setDropTarget] = useState<DropTarget | null>(null)

  // Group form state
  const [groupName, setGroupName] = useState('')

  // Drag-and-drop state for steps
  const [dragIndex, setDragIndex] = useState<number | null>(null)
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null)

  // AI Assist state
  const [showAIModal, setShowAIModal] = useState(false)
  const [aiPrompt, setAIPrompt] = useState('')
  const [aiLoading, setAILoading] = useState(false)
  const [aiSuggestions, setAISuggestions] = useState<GeneratedStep[] | null>(null)
  const [aiError, setAIError] = useState<string | null>(null)

  // Auto-save state
  const [autoSave, setAutoSave] = useState(true)
  const [autoSaveStatus, setAutoSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')

  // Track unsaved changes in editor
  const hasEditorChanges = useMemo(() => {
    if (!isEditing || !editingPlaybook) return false
    // Check form data changes
    if (formData.name !== editingPlaybook.name) return true
    if (formData.description !== (editingPlaybook.description || '')) return true
    if (formData.inputs_template !== (editingPlaybook.inputs_template || '')) return true
    if (formData.scope_type !== editingPlaybook.scope_type) return true
    if (formData.scope_id !== (editingPlaybook.scope_id || '')) return true
    // Check steps changes
    const originalSteps = editingPlaybook.steps.map(playbookStepToForm)
    if (steps.length !== originalSteps.length) return true
    for (let i = 0; i < steps.length; i++) {
      const current = steps[i]
      const original = originalSteps[i]
      if (!original) return true
      if (current.title !== original.title) return true
      if (current.description !== original.description) return true
      if (current.when_to_perform !== original.when_to_perform) return true
      if (current.parallel_group !== original.parallel_group) return true
      if (current.nested_playbook_id !== original.nested_playbook_id) return true
      if (current.assignee_type !== original.assignee_type) return true
      if (current.assignee_id !== original.assignee_id) return true
      if (current.queue_id !== original.queue_id) return true
      if (current.approval_required !== original.approval_required) return true
      if (current.approver_type !== original.approver_type) return true
      if (current.approver_id !== original.approver_id) return true
      if (current.approver_queue_id !== original.approver_queue_id) return true
    }
    return false
  }, [isEditing, editingPlaybook, formData, steps])

  // Track unsaved changes in create modal
  const hasCreateChanges = useMemo(() => {
    if (!showCreateModal) return false
    return formData.name.trim() !== '' || formData.description.trim() !== ''
  }, [showCreateModal, formData.name, formData.description])

  // Track unsaved changes in create group modal
  const hasGroupChanges = useMemo(() => {
    if (!showCreateGroupModal) return false
    return groupName.trim() !== ''
  }, [showCreateGroupModal, groupName])

  // Combined unsaved changes state for beforeunload
  const hasAnyUnsavedChanges = hasEditorChanges || hasCreateChanges || hasGroupChanges

  // Hook for browser beforeunload warning
  const { confirmClose } = useUnsavedChanges(hasAnyUnsavedChanges)

  useEffect(() => {
    loadData()
  }, [])

  // Auto-save effect with debounce
  useEffect(() => {
    if (!autoSave || !isEditing || !editingPlaybook || !hasEditorChanges) {
      return
    }

    // Don't auto-save if there's a validation error (e.g., step without title)
    const invalidSteps = steps.filter(s => !s.title.trim())
    if (invalidSteps.length > 0) {
      return
    }

    // Don't auto-save if name is empty
    if (!formData.name.trim()) {
      return
    }

    const timeoutId = setTimeout(async () => {
      setAutoSaveStatus('saving')
      try {
        await api.updatePlaybook(editingPlaybook.id, {
          name: formData.name.trim(),
          description: formData.description.trim() || undefined,
          inputs_template: formData.inputs_template.trim() || undefined,
          steps: steps.map((s, idx) => stepFormToCreate(s, idx + 1)),
          scope_type: formData.scope_type,
          scope_id: formData.scope_type === 'organization' ? undefined : formData.scope_id || undefined,
        })
        // Refresh the editing playbook to sync with saved state
        const updated = await api.getPlaybooks()
        const refreshed = updated.find(p => p.id === editingPlaybook.id)
        if (refreshed) {
          setEditingPlaybook(refreshed)
        }
        setPlaybooks(updated)
        setAutoSaveStatus('saved')
        // Reset status after a short delay
        setTimeout(() => setAutoSaveStatus('idle'), 2000)
      } catch (err) {
        setAutoSaveStatus('error')
        logger.error(err, { action: 'autoSavePlaybook', additionalContext: { playbookId: editingPlaybook.id } })
        setTimeout(() => setAutoSaveStatus('idle'), 3000)
      }
    }, 1500) // 1.5 second debounce

    return () => clearTimeout(timeoutId)
  }, [autoSave, isEditing, editingPlaybook, hasEditorChanges, formData, steps])


  // Build tree structure
  const treeNodes = buildTree(playbooks)
  const flatNodes = flattenTree(treeNodes)

  // Get all groups for location dropdown
  const groupPlaybooks = playbooks.filter(p => p.item_type === 'group')

  // Check if a playbook has children
  const hasChildren = useCallback((playbookId: string) => {
    return playbooks.some(p => p.parent_id === playbookId)
  }, [playbooks])

  // Check if a playbook is a descendant of another
  const isDescendant = useCallback((childId: string, parentId: string): boolean => {
    const child = playbooks.find(p => p.id === childId)
    if (!child || !child.parent_id) return false
    if (child.parent_id === parentId) return true
    return isDescendant(child.parent_id, parentId)
  }, [playbooks])

  // Tree drag-drop handlers
  const handleTreeDragStart = useCallback((e: React.DragEvent, playbookId: string) => {
    e.dataTransfer.setData('text/plain', playbookId)
    e.dataTransfer.effectAllowed = 'move'
    setDraggedId(playbookId)
  }, [])

  const handleTreeDragOver = useCallback((e: React.DragEvent, targetId: string) => {
    e.preventDefault()
    e.stopPropagation()

    if (!draggedId || draggedId === targetId) {
      setDropTarget(null)
      return
    }

    // Can't drop on a descendant
    if (isDescendant(targetId, draggedId)) {
      setDropTarget(null)
      return
    }

    const target = playbooks.find(p => p.id === targetId)
    if (!target) {
      setDropTarget(null)
      return
    }

    const rect = e.currentTarget.getBoundingClientRect()
    const y = e.clientY - rect.top
    const height = rect.height

    let position: DropPosition
    if (target.item_type === 'group') {
      // For groups: top 25% = before, bottom 25% = after, middle 50% = inside
      if (y < height * 0.25) {
        position = 'before'
      } else if (y > height * 0.75) {
        position = 'after'
      } else {
        position = 'inside'
      }
    } else {
      // For playbooks: top 33% = before, bottom 33% = after, middle 33% = inside (nest under)
      if (y < height * 0.33) {
        position = 'before'
      } else if (y > height * 0.66) {
        position = 'after'
      } else {
        position = 'inside'
      }
    }

    setDropTarget({ targetId, position })
  }, [draggedId, playbooks, isDescendant])

  const handleTreeDragLeave = useCallback((e: React.DragEvent) => {
    // Only clear if leaving the container entirely
    const relatedTarget = e.relatedTarget as HTMLElement
    if (!e.currentTarget.contains(relatedTarget)) {
      setDropTarget(null)
    }
  }, [])

  const handleTreeDrop = useCallback(async (e: React.DragEvent, targetId: string) => {
    e.preventDefault()
    e.stopPropagation()

    if (!draggedId || !dropTarget) {
      setDraggedId(null)
      setDropTarget(null)
      return
    }

    const target = playbooks.find(p => p.id === targetId)
    const dragged = playbooks.find(p => p.id === draggedId)
    if (!target || !dragged) {
      setDraggedId(null)
      setDropTarget(null)
      return
    }

    // Calculate new parent and order
    let newParentId: string | null
    let siblings: Playbook[]

    if (dropTarget.position === 'inside') {
      // Drop inside the target
      newParentId = targetId
      siblings = playbooks.filter(p => p.parent_id === targetId && p.id !== draggedId)
    } else {
      // Drop before or after the target
      newParentId = target.parent_id || null
      siblings = playbooks.filter(p => (p.parent_id || null) === newParentId && p.id !== draggedId)
    }

    // Sort siblings by order_index
    siblings.sort((a, b) => a.order_index - b.order_index)

    // Calculate new order
    const reorderItems: PlaybookReorderItem[] = []

    if (dropTarget.position === 'inside') {
      // Add dragged item at the end
      const newOrder = siblings.length
      reorderItems.push({ id: draggedId, parent_id: newParentId, order_index: newOrder })
    } else {
      // Find target index
      const targetIndex = siblings.findIndex(s => s.id === targetId)
      const insertIndex = dropTarget.position === 'before' ? targetIndex : targetIndex + 1

      // Rebuild order for all siblings
      let order = 0
      for (let i = 0; i < siblings.length; i++) {
        if (i === insertIndex) {
          reorderItems.push({ id: draggedId, parent_id: newParentId, order_index: order++ })
        }
        reorderItems.push({ id: siblings[i].id, parent_id: siblings[i].parent_id || null, order_index: order++ })
      }

      // If inserting at end
      if (insertIndex >= siblings.length) {
        reorderItems.push({ id: draggedId, parent_id: newParentId, order_index: order++ })
      }
    }

    setDraggedId(null)
    setDropTarget(null)

    // Call API to update
    try {
      await api.reorderPlaybooks(reorderItems)
      await loadData()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to reorder playbooks'
      setError(message)
      logger.error(err, { action: 'reorderPlaybooks' })
    }
  }, [draggedId, dropTarget, playbooks])

  const handleTreeDragEnd = useCallback(() => {
    setDraggedId(null)
    setDropTarget(null)
  }, [])

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
        return 'bg-primary-100 text-primary-800'
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
      const parentId = formData.parent_id || null
      const newPlaybook: CreatePlaybookRequest = {
        name: formData.name.trim(),
        description: formData.description.trim() || undefined,
        inputs_template: formData.inputs_template.trim() || undefined,
        scope_type: formData.scope_type,
        scope_id: formData.scope_type === 'organization' ? undefined : formData.scope_id || undefined,
        item_type: 'playbook',
        parent_id: parentId,
      }
      await api.createPlaybook(newPlaybook)
      recordParentUsage(parentId)
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

  const handleCreateGroup = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!groupName.trim()) return

    setSaving(true)
    setError(null)
    try {
      const newGroup: CreatePlaybookRequest = {
        name: groupName.trim(),
        scope_type: 'organization',
        item_type: 'group',
      }
      await api.createPlaybook(newGroup)
      await loadData()
      setShowCreateGroupModal(false)
      setGroupName('')
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create group'
      setError(message)
      logger.error(err, { action: 'createGroup', additionalContext: { name: groupName } })
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
    // Set suggested parent based on recent usage
    const suggested = getSuggestedParent()
    if (suggested && playbooks.some(p => p.id === suggested)) {
      setFormData(prev => ({ ...prev, parent_id: suggested }))
    }
    setShowCreateModal(true)
  }

  const openCreateGroupModal = useCallback(() => {
    setGroupName('')
    setShowCreateGroupModal(true)
  }, [])

  // Keyboard shortcut for new folder (Cmd/Ctrl+Shift+F)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === 'f') {
        e.preventDefault()
        openCreateGroupModal()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [openCreateGroupModal])

  const openEditor = (playbook: Playbook) => {
    setEditingPlaybook(playbook)
    setFormData({
      name: playbook.name,
      description: playbook.description || '',
      inputs_template: playbook.inputs_template || '',
      scope_type: playbook.scope_type,
      scope_id: playbook.scope_id || '',
      parent_id: playbook.parent_id || '',
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
      parent_id: '',
    })
    setSteps([])
    setExpandedSteps(new Set())
  }

  const toggleExpand = (playbookId: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev)
      if (next.has(playbookId)) {
        next.delete(playbookId)
      } else {
        next.add(playbookId)
      }
      return next
    })
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

  // AI Assist handlers
  const openAIModal = () => {
    setAIPrompt('')
    setAISuggestions(null)
    setAIError(null)
    setShowAIModal(true)
  }

  const closeAIModal = () => {
    setShowAIModal(false)
    setAIPrompt('')
    setAISuggestions(null)
    setAIError(null)
  }

  const handleGenerateSteps = async () => {
    if (!editingPlaybook) return

    setAILoading(true)
    setAIError(null)
    setAISuggestions(null)

    try {
      const response = await api.generatePlaybookSteps({
        playbook_name: formData.name || editingPlaybook.name,
        playbook_description: formData.description || undefined,
        existing_steps: steps.map(s => ({
          title: s.title,
          description: s.description || undefined,
          when_to_perform: s.when_to_perform || undefined,
        })),
        user_prompt: aiPrompt || undefined,
      })
      setAISuggestions(response.steps)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to generate steps'
      setAIError(message)
      logger.error(err, { action: 'generatePlaybookSteps' })
    } finally {
      setAILoading(false)
    }
  }

  const handleReplaceAllSteps = () => {
    if (!aiSuggestions) return

    const newSteps: StepFormData[] = aiSuggestions.map(s => ({
      id: generateId(),
      title: s.title,
      description: s.description || '',
      when_to_perform: s.when_to_perform || '',
      parallel_group: '',
      nested_playbook_id: '',
      assignee_type: 'anyone' as AssigneeType,
      assignee_id: '',
      queue_id: '',
      approval_required: false,
      approver_type: 'anyone' as AssigneeType,
      approver_id: '',
      approver_queue_id: '',
    }))

    setSteps(newSteps)
    setExpandedSteps(new Set())
    closeAIModal()
  }

  const handleAddToExisting = () => {
    if (!aiSuggestions) return

    const newSteps: StepFormData[] = aiSuggestions.map(s => ({
      id: generateId(),
      title: s.title,
      description: s.description || '',
      when_to_perform: s.when_to_perform || '',
      parallel_group: '',
      nested_playbook_id: '',
      assignee_type: 'anyone' as AssigneeType,
      assignee_id: '',
      queue_id: '',
      approval_required: false,
      approver_type: 'anyone' as AssigneeType,
      approver_id: '',
      approver_queue_id: '',
    }))

    setSteps([...steps, ...newSteps])
    closeAIModal()
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
        {/* Sticky header */}
        <div className="sticky top-0 z-10 bg-white -mx-4 px-4 py-3 border-b border-gray-200 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <button
                onClick={confirmClose(() => {
                  setIsEditing(false)
                  setEditingPlaybook(null)
                })}
                className="text-gray-600 hover:text-gray-800"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
              </button>
              <h2 className="text-2xl font-bold text-gray-900">Edit Playbook</h2>
            </div>
            <div className="flex items-center space-x-4">
              {/* Auto-save toggle */}
              <div className="flex items-center space-x-2">
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={autoSave}
                    onChange={(e) => setAutoSave(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
                </label>
                <span className="text-sm text-gray-600">Auto-save</span>
                {/* Auto-save status indicator */}
                {autoSaveStatus === 'saving' && (
                  <span className="text-xs text-gray-500 flex items-center gap-1">
                    <svg className="animate-spin h-3 w-3" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Saving...
                  </span>
                )}
                {autoSaveStatus === 'saved' && (
                  <span className="text-xs text-green-600 flex items-center gap-1">
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    Saved
                  </span>
                )}
                {autoSaveStatus === 'error' && (
                  <span className="text-xs text-red-600">Save failed</span>
                )}
              </div>
              <button
                onClick={confirmClose(() => {
                  setIsEditing(false)
                  setEditingPlaybook(null)
                })}
                className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-md transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveEdit}
                disabled={saving || autoSaveStatus === 'saving'}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>

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
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={openAIModal}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-purple-700 bg-purple-50 hover:bg-purple-100 rounded-md transition-colors"
                >
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                  AI Assist
                </button>
                <button
                  type="button"
                  onClick={addStep}
                  className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                >
                  + Add Step
                </button>
              </div>
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

        {/* AI Assist Modal */}
        <Modal
          isOpen={showAIModal}
          onClose={closeAIModal}
          title="AI Assist - Generate Steps"
        >
          <div className="space-y-4">
            {!aiSuggestions ? (
              <>
                <p className="text-sm text-gray-600">
                  Let AI help you generate high-quality, repeatable process steps for this playbook.
                </p>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Additional Instructions (optional)
                  </label>
                  <textarea
                    value={aiPrompt}
                    onChange={(e) => setAIPrompt(e.target.value)}
                    className="w-full border border-gray-300 rounded-md px-3 py-2"
                    rows={3}
                    placeholder="e.g., Focus on quality control steps, Include approval checkpoints, Keep steps concise..."
                    disabled={aiLoading}
                  />
                </div>

                {aiError && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                    <p className="text-sm text-red-700">{aiError}</p>
                  </div>
                )}

                <ModalFooter>
                  <button
                    type="button"
                    onClick={closeAIModal}
                    className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-md transition-colors"
                    disabled={aiLoading}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleGenerateSteps}
                    disabled={aiLoading}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 transition-colors disabled:opacity-50"
                  >
                    {aiLoading ? (
                      <>
                        <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                        Generating...
                      </>
                    ) : (
                      <>
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M13 10V3L4 14h7v7l9-11h-7z" />
                        </svg>
                        Generate Steps
                      </>
                    )}
                  </button>
                </ModalFooter>
              </>
            ) : (
              <>
                <p className="text-sm text-gray-600">
                  AI generated {aiSuggestions.length} steps. Review them below and choose how to apply them.
                </p>

                <div className="max-h-72 overflow-y-auto border border-gray-200 rounded-lg divide-y divide-gray-100">
                  {aiSuggestions.map((step, idx) => (
                    <div key={idx} className="p-3">
                      <div className="flex items-start gap-2">
                        <span className="flex items-center justify-center w-5 h-5 bg-purple-100 text-purple-700 text-xs font-medium rounded-full flex-shrink-0 mt-0.5">
                          {idx + 1}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-gray-900">{step.title}</p>
                          {step.description && (
                            <p className="text-sm text-gray-600 mt-1">{step.description}</p>
                          )}
                          {step.when_to_perform && (
                            <p className="text-xs text-gray-400 mt-1">
                              <span className="font-medium">When:</span> {step.when_to_perform}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <ModalFooter>
                  <button
                    type="button"
                    onClick={() => setAISuggestions(null)}
                    className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-md transition-colors"
                  >
                    Back
                  </button>
                  <div className="flex gap-2">
                    {steps.length > 0 && (
                      <button
                        type="button"
                        onClick={handleAddToExisting}
                        className="px-4 py-2 border border-purple-600 text-purple-700 rounded-md hover:bg-purple-50 transition-colors"
                      >
                        Add to Existing
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={handleReplaceAllSteps}
                      className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 transition-colors"
                    >
                      Replace All Steps
                    </button>
                  </div>
                </ModalFooter>
              </>
            )}
          </div>
        </Modal>
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

      {/* Playbooks Tree View */}
      <div className="flex justify-end mb-2">
        <button
          onClick={openCreateGroupModal}
          className="text-gray-500 hover:text-gray-700 hover:bg-gray-100 p-1.5 rounded-md transition-colors flex items-center gap-1 text-sm"
          title={`New Folder (${navigator.platform.includes('Mac') ? '⌘' : 'Ctrl'}+Shift+F)`}
        >
          <FolderPlus className="w-4 h-4" />
          <span>New Folder</span>
        </button>
      </div>
      <div
        className="bg-white shadow rounded-lg overflow-hidden"
        onDragEnd={handleTreeDragEnd}
      >
        {loading ? (
          <div className="p-4 text-gray-500">Loading...</div>
        ) : flatNodes.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            No playbooks found. Create one to get started.
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {flatNodes.map((node) => {
              // Skip children of collapsed parents
              let parent: Playbook | undefined = node.playbook.parent_id ? playbooks.find(p => p.id === node.playbook.parent_id) : undefined
              let isHidden = false
              while (parent) {
                if (!expandedIds.has(parent.id)) {
                  isHidden = true
                  break
                }
                parent = parent.parent_id ? playbooks.find(p => p.id === parent!.parent_id) : undefined
              }
              if (isHidden) return null

              return (
                <PlaybookTreeItem
                  key={node.playbook.id}
                  node={node}
                  isExpanded={expandedIds.has(node.playbook.id)}
                  onToggleExpand={() => toggleExpand(node.playbook.id)}
                  onEdit={openEditor}
                  onDelete={openDeleteConfirm}
                  onDuplicate={handleDuplicate}
                  onHistory={openHistoryModal}
                  onDragStart={handleTreeDragStart}
                  onDragOver={handleTreeDragOver}
                  onDragLeave={handleTreeDragLeave}
                  onDrop={handleTreeDrop}
                  dropTarget={dropTarget}
                  isDragging={draggedId === node.playbook.id}
                  hasChildren={hasChildren(node.playbook.id)}
                  getScopeLabel={getScopeLabel}
                  getScopeBadgeColor={getScopeBadgeColor}
                  formatDate={formatDate}
                />
              )
            })}
          </div>
        )}
      </div>

      {/* Create Playbook Modal */}
      <Modal
        isOpen={showCreateModal}
        onClose={confirmClose(() => setShowCreateModal(false))}
        title="Create New Playbook"
      >
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
          {groupPlaybooks.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Location
              </label>
              <select
                value={formData.parent_id}
                onChange={(e) => setFormData({ ...formData, parent_id: e.target.value })}
                className="w-full border border-gray-300 rounded-md px-3 py-2"
              >
                <option value="">Top Level</option>
                {groupPlaybooks.map((group) => {
                  const isSuggested = getSuggestedParent() === group.id
                  return (
                    <option key={group.id} value={group.id}>
                      {group.name}{isSuggested ? ' (Suggested)' : ''}
                    </option>
                  )
                })}
              </select>
            </div>
          )}
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
          <ModalFooter>
            <button
              type="button"
              onClick={confirmClose(() => setShowCreateModal(false))}
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

      {/* Create Folder Modal */}
      <Modal
        isOpen={showCreateGroupModal}
        onClose={confirmClose(() => setShowCreateGroupModal(false))}
        title="Create New Folder"
        size="sm"
      >
        <form onSubmit={handleCreateGroup} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Folder Name
            </label>
            <input
              type="text"
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2"
              placeholder="e.g., Customer Success, Engineering"
              required
              autoFocus
            />
          </div>
          <ModalFooter>
            <button
              type="button"
              onClick={confirmClose(() => setShowCreateGroupModal(false))}
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

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={showDeleteConfirm && !!selectedPlaybook}
        onClose={() => setShowDeleteConfirm(false)}
        title="Delete Playbook?"
        size="sm"
      >
        <p className="text-gray-500 mb-4">
          Are you sure you want to delete "{selectedPlaybook?.name}"? This action cannot be undone.
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

      {/* History Modal */}
      <Modal
        isOpen={showHistoryModal && !!selectedPlaybook}
        onClose={() => setShowHistoryModal(false)}
        title={`Version History: ${selectedPlaybook?.name || ''}`}
      >
        <div className="space-y-3 max-h-64 overflow-y-auto">
          {/* Current version */}
          {selectedPlaybook && (
            <div className="border-l-4 border-blue-500 pl-3 py-1">
              <p className="font-medium text-gray-900">
                v{selectedPlaybook.version} (current)
              </p>
              <p className="text-sm text-gray-500">{selectedPlaybook.name}</p>
              <p className="text-xs text-gray-400">{selectedPlaybook.steps?.length || 0} steps</p>
            </div>
          )}
          {/* Historical versions */}
          {selectedPlaybook?.history.slice().reverse().map((entry, idx) => (
            <div key={idx} className="border-l-4 border-gray-300 pl-3 py-1">
              <p className="font-medium text-gray-700">v{entry.version}</p>
              <p className="text-sm text-gray-500">{entry.name}</p>
              <p className="text-xs text-gray-400">
                {entry.steps?.length || 0} steps - {formatDate(entry.changed_at)}
              </p>
            </div>
          ))}
        </div>
        <ModalFooter>
          <button
            onClick={() => setShowHistoryModal(false)}
            className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-md transition-colors"
          >
            Close
          </button>
        </ModalFooter>
      </Modal>
    </div>
  )
}
