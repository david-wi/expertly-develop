import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  LayoutGrid,
  Plus,
  Users,
  Clock,
  AlertCircle,
  CheckCircle,
  XCircle,
  Trash2,
  Edit3,
  ChevronDown,
  ChevronUp,
  Route,
  UserPlus,
  UserMinus,
} from 'lucide-react'
import { api } from '../services/api'
import type {
  Desk,
  DeskType,
  RoutingRule,
  CoverageSchedule,
  WorkItem,
} from '../types'
import {
  DESK_TYPE_LABELS,
  ROUTING_FIELD_LABELS,
  ROUTING_OPERATOR_LABELS,
} from '../types'

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const HOURS = Array.from({ length: 24 }, (_, i) => `${String(i).padStart(2, '0')}:00`)

interface DeskFormData {
  name: string
  description: string
  desk_type: DeskType
  is_active: boolean
  routing_rules: RoutingRule[]
  coverage: CoverageSchedule[]
  members: string[]
  priority: number
}

const emptyForm: DeskFormData = {
  name: '',
  description: '',
  desk_type: 'general',
  is_active: true,
  routing_rules: [],
  coverage: [],
  members: [],
  priority: 0,
}

export default function DeskManagement() {
  const queryClient = useQueryClient()
  const [showModal, setShowModal] = useState(false)
  const [editingDesk, setEditingDesk] = useState<Desk | null>(null)
  const [expandedDesk, setExpandedDesk] = useState<string | null>(null)
  const [formData, setFormData] = useState<DeskFormData>(emptyForm)
  const [memberInput, setMemberInput] = useState('')

  const { data: desks, isLoading } = useQuery({
    queryKey: ['desks'],
    queryFn: () => api.getDesks(),
  })

  const { data: expandedWorkItems } = useQuery({
    queryKey: ['desk-work-items', expandedDesk],
    queryFn: () => api.getDeskWorkItems(expandedDesk!),
    enabled: !!expandedDesk,
  })

  const createMutation = useMutation({
    mutationFn: (data: DeskFormData) => api.createDesk(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['desks'] })
      closeModal()
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<DeskFormData> }) =>
      api.updateDesk(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['desks'] })
      closeModal()
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.deleteDesk(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['desks'] })
      if (expandedDesk) setExpandedDesk(null)
    },
  })

  const autoRouteMutation = useMutation({
    mutationFn: () => api.autoRouteWorkItems(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['desks'] })
      queryClient.invalidateQueries({ queryKey: ['desk-work-items'] })
    },
  })

  const closeModal = () => {
    setShowModal(false)
    setEditingDesk(null)
    setFormData(emptyForm)
  }

  const openCreate = () => {
    setFormData(emptyForm)
    setEditingDesk(null)
    setShowModal(true)
  }

  const openEdit = (desk: Desk) => {
    setEditingDesk(desk)
    setFormData({
      name: desk.name,
      description: desk.description,
      desk_type: desk.desk_type,
      is_active: desk.is_active,
      routing_rules: desk.routing_rules,
      coverage: desk.coverage,
      members: desk.members,
      priority: desk.priority,
    })
    setShowModal(true)
  }

  const handleSubmit = () => {
    if (editingDesk) {
      updateMutation.mutate({ id: editingDesk.id, data: formData })
    } else {
      createMutation.mutate(formData)
    }
  }

  const addRule = () => {
    setFormData({
      ...formData,
      routing_rules: [
        ...formData.routing_rules,
        { field: 'work_type', operator: 'equals', value: '' },
      ],
    })
  }

  const updateRule = (index: number, rule: RoutingRule) => {
    const rules = [...formData.routing_rules]
    rules[index] = rule
    setFormData({ ...formData, routing_rules: rules })
  }

  const removeRule = (index: number) => {
    setFormData({
      ...formData,
      routing_rules: formData.routing_rules.filter((_, i) => i !== index),
    })
  }

  const toggleCoverage = (day: number, hour: string) => {
    const existing = formData.coverage.find(
      (c) => c.day_of_week === day && c.start_time === hour
    )
    if (existing) {
      setFormData({
        ...formData,
        coverage: formData.coverage.filter(
          (c) => !(c.day_of_week === day && c.start_time === hour)
        ),
      })
    } else {
      const endHour = `${String(parseInt(hour) + 1).padStart(2, '0')}:00`
      setFormData({
        ...formData,
        coverage: [
          ...formData.coverage,
          { day_of_week: day, start_time: hour, end_time: endHour, timezone: 'America/New_York' },
        ],
      })
    }
  }

  const isCovered = (day: number, hour: string) => {
    return formData.coverage.some(
      (c) => c.day_of_week === day && c.start_time <= hour && c.end_time > hour
    )
  }

  const addMember = () => {
    if (memberInput.trim() && !formData.members.includes(memberInput.trim())) {
      setFormData({ ...formData, members: [...formData.members, memberInput.trim()] })
      setMemberInput('')
    }
  }

  const removeMember = (userId: string) => {
    setFormData({ ...formData, members: formData.members.filter((m) => m !== userId) })
  }

  const toggleExpand = (deskId: string) => {
    setExpandedDesk(expandedDesk === deskId ? null : deskId)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Desk Management</h1>
          <p className="text-gray-500">Organize work items by desk with routing rules and coverage schedules</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => autoRouteMutation.mutate()}
            disabled={autoRouteMutation.isPending}
            className="inline-flex items-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 disabled:opacity-50 transition-colors"
          >
            <Route className="h-4 w-4" />
            {autoRouteMutation.isPending ? 'Routing...' : 'Auto-Route All'}
          </button>
          <button
            onClick={openCreate}
            className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors"
          >
            <Plus className="h-4 w-4" />
            Create Desk
          </button>
        </div>
      </div>

      {/* Auto-route result */}
      {autoRouteMutation.isSuccess && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-lg px-4 py-3 text-sm text-emerald-700">
          Successfully routed {autoRouteMutation.data.routed_count} work items to desks.
        </div>
      )}

      {/* Desks List */}
      {isLoading ? (
        <div className="text-center py-12 text-gray-500">Loading desks...</div>
      ) : !desks?.length ? (
        <div className="text-center py-12">
          <LayoutGrid className="mx-auto h-12 w-12 text-gray-300" />
          <h3 className="mt-4 text-lg font-medium text-gray-900">No desks yet</h3>
          <p className="mt-2 text-gray-500">Create your first desk to start organizing work items.</p>
          <button
            onClick={openCreate}
            className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700"
          >
            <Plus className="h-4 w-4" />
            Create Desk
          </button>
        </div>
      ) : (
        <div className="grid gap-4">
          {desks.map((desk) => (
            <div
              key={desk.id}
              className="bg-white rounded-lg border border-gray-200 overflow-hidden"
            >
              {/* Desk Card Header */}
              <div className="p-5 flex items-center justify-between">
                <div className="flex items-center gap-4 min-w-0">
                  <div
                    className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                      desk.is_active ? 'bg-emerald-100' : 'bg-gray-100'
                    }`}
                  >
                    <LayoutGrid
                      className={`h-5 w-5 ${desk.is_active ? 'text-emerald-600' : 'text-gray-400'}`}
                    />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-gray-900 truncate">{desk.name}</h3>
                      <span className="inline-flex px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-600">
                        {DESK_TYPE_LABELS[desk.desk_type]}
                      </span>
                      {!desk.is_active && (
                        <span className="inline-flex px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-700">
                          Inactive
                        </span>
                      )}
                    </div>
                    {desk.description && (
                      <p className="text-sm text-gray-500 truncate">{desk.description}</p>
                    )}
                  </div>
                </div>

                {/* Stats */}
                <div className="flex items-center gap-6">
                  <div className="flex items-center gap-1.5 text-sm text-gray-600">
                    <Users className="h-4 w-4" />
                    <span>{desk.member_count}</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-sm text-gray-600">
                    <AlertCircle className="h-4 w-4" />
                    <span>{desk.active_work_items_count}</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-sm">
                    {desk.is_covered ? (
                      <>
                        <CheckCircle className="h-4 w-4 text-emerald-500" />
                        <span className="text-emerald-600">Covered</span>
                      </>
                    ) : (
                      <>
                        <XCircle className="h-4 w-4 text-amber-500" />
                        <span className="text-amber-600">Not Covered</span>
                      </>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => openEdit(desk)}
                      className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-50"
                      title="Edit desk"
                    >
                      <Edit3 className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => {
                        if (confirm(`Delete desk "${desk.name}"? Work items will be unassigned.`)) {
                          deleteMutation.mutate(desk.id)
                        }
                      }}
                      className="p-2 text-gray-400 hover:text-red-600 rounded-lg hover:bg-red-50"
                      title="Delete desk"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => toggleExpand(desk.id)}
                      className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-50"
                      title="View work items"
                    >
                      {expandedDesk === desk.id ? (
                        <ChevronUp className="h-4 w-4" />
                      ) : (
                        <ChevronDown className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                </div>
              </div>

              {/* Routing Rules Summary */}
              {desk.routing_rules.length > 0 && (
                <div className="px-5 pb-3">
                  <div className="flex flex-wrap gap-2">
                    {desk.routing_rules.map((rule, i) => (
                      <span
                        key={i}
                        className="inline-flex items-center px-2 py-1 rounded bg-blue-50 text-xs text-blue-700"
                      >
                        {ROUTING_FIELD_LABELS[rule.field] || rule.field}{' '}
                        {ROUTING_OPERATOR_LABELS[rule.operator] || rule.operator}{' '}
                        {Array.isArray(rule.value) ? rule.value.join(', ') : rule.value}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Expanded Work Items */}
              {expandedDesk === desk.id && (
                <div className="border-t border-gray-200 bg-gray-50 p-5">
                  <h4 className="text-sm font-medium text-gray-700 mb-3">
                    Active Work Items ({desk.active_work_items_count})
                  </h4>
                  {expandedWorkItems?.length ? (
                    <div className="space-y-2">
                      {expandedWorkItems.map((wi: WorkItem) => (
                        <div
                          key={wi.id}
                          className="flex items-center justify-between bg-white rounded-lg border border-gray-200 px-4 py-3"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <span
                              className={`w-2 h-2 rounded-full flex-shrink-0 ${
                                wi.is_overdue
                                  ? 'bg-red-500'
                                  : wi.priority >= 70
                                    ? 'bg-amber-500'
                                    : 'bg-emerald-500'
                              }`}
                            />
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-gray-900 truncate">
                                {wi.title}
                              </p>
                              <p className="text-xs text-gray-500">
                                {wi.work_type} - Priority {wi.priority}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <span
                              className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${
                                wi.status === 'open'
                                  ? 'bg-blue-100 text-blue-700'
                                  : wi.status === 'in_progress'
                                    ? 'bg-amber-100 text-amber-700'
                                    : 'bg-gray-100 text-gray-700'
                              }`}
                            >
                              {wi.status}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-gray-500">No active work items assigned to this desk.</p>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-start justify-center pt-12 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl mx-4 mb-12">
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">
                {editingDesk ? 'Edit Desk' : 'Create Desk'}
              </h2>
              <button
                onClick={closeModal}
                className="text-gray-400 hover:text-gray-600"
              >
                <XCircle className="h-5 w-5" />
              </button>
            </div>

            <div className="px-6 py-4 space-y-6 max-h-[70vh] overflow-y-auto">
              {/* Basic Info */}
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Desk Name
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g., East Coast, Flatbed, High Value"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Description
                  </label>
                  <input
                    type="text"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Brief description of this desk's purpose"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                  />
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Type
                    </label>
                    <select
                      value={formData.desk_type}
                      onChange={(e) =>
                        setFormData({ ...formData, desk_type: e.target.value as DeskType })
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                    >
                      <option value="general">General</option>
                      <option value="lane">Lane</option>
                      <option value="mode">Mode</option>
                      <option value="customer">Customer</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Priority
                    </label>
                    <input
                      type="number"
                      value={formData.priority}
                      onChange={(e) =>
                        setFormData({ ...formData, priority: parseInt(e.target.value) || 0 })
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                    />
                    <p className="mt-1 text-xs text-gray-500">Higher = checked first</p>
                  </div>
                  <div className="flex items-end pb-1">
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={formData.is_active}
                        onChange={(e) =>
                          setFormData({ ...formData, is_active: e.target.checked })
                        }
                        className="h-4 w-4 text-emerald-600 rounded border-gray-300 focus:ring-emerald-500"
                      />
                      <span className="text-sm text-gray-700">Active</span>
                    </label>
                  </div>
                </div>
              </div>

              {/* Routing Rules */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-gray-900">Routing Rules</h3>
                  <button
                    onClick={addRule}
                    className="inline-flex items-center gap-1 text-sm text-emerald-600 hover:text-emerald-700"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Add Rule
                  </button>
                </div>
                <p className="text-xs text-gray-500 mb-3">
                  All rules must match for a work item to be routed to this desk.
                </p>
                {formData.routing_rules.length === 0 ? (
                  <p className="text-sm text-gray-400 italic">No routing rules. Add rules to auto-route work items.</p>
                ) : (
                  <div className="space-y-2">
                    {formData.routing_rules.map((rule, index) => (
                      <div key={index} className="flex items-center gap-2">
                        <select
                          value={rule.field}
                          onChange={(e) =>
                            updateRule(index, { ...rule, field: e.target.value })
                          }
                          className="px-2 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                        >
                          <option value="work_type">Work Type</option>
                          <option value="origin_state">Origin State</option>
                          <option value="destination_state">Destination State</option>
                          <option value="equipment_type">Equipment Type</option>
                          <option value="customer_id">Customer ID</option>
                        </select>
                        <select
                          value={rule.operator}
                          onChange={(e) =>
                            updateRule(index, { ...rule, operator: e.target.value })
                          }
                          className="px-2 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                        >
                          <option value="equals">Equals</option>
                          <option value="in">In</option>
                          <option value="contains">Contains</option>
                          <option value="regex">Regex</option>
                        </select>
                        <input
                          type="text"
                          value={Array.isArray(rule.value) ? rule.value.join(', ') : rule.value}
                          onChange={(e) => {
                            const val =
                              rule.operator === 'in'
                                ? e.target.value.split(',').map((s) => s.trim())
                                : e.target.value
                            updateRule(index, { ...rule, value: val })
                          }}
                          placeholder={rule.operator === 'in' ? 'val1, val2, val3' : 'value'}
                          className="flex-1 px-2 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                        />
                        <button
                          onClick={() => removeRule(index)}
                          className="p-1.5 text-gray-400 hover:text-red-600 rounded"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Coverage Schedule */}
              <div>
                <h3 className="text-sm font-semibold text-gray-900 mb-1">Coverage Schedule</h3>
                <p className="text-xs text-gray-500 mb-3">
                  Click cells to toggle coverage. No schedule = always covered.
                </p>
                <div className="overflow-x-auto">
                  <table className="text-xs border-collapse">
                    <thead>
                      <tr>
                        <th className="p-1 text-left text-gray-500 w-10"></th>
                        {HOURS.filter((_, i) => i >= 6 && i <= 22).map((h) => (
                          <th key={h} className="p-1 text-center text-gray-500 w-7">
                            {parseInt(h)}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {DAY_LABELS.map((day, dayIndex) => (
                        <tr key={day}>
                          <td className="p-1 font-medium text-gray-600">{day}</td>
                          {HOURS.filter((_, i) => i >= 6 && i <= 22).map((hour) => (
                            <td key={`${dayIndex}-${hour}`} className="p-0.5">
                              <button
                                onClick={() => toggleCoverage(dayIndex, hour)}
                                className={`w-6 h-5 rounded ${
                                  isCovered(dayIndex, hour)
                                    ? 'bg-emerald-500'
                                    : 'bg-gray-100 hover:bg-gray-200'
                                }`}
                              />
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Members */}
              <div>
                <h3 className="text-sm font-semibold text-gray-900 mb-3">Team Members</h3>
                <div className="flex items-center gap-2 mb-3">
                  <input
                    type="text"
                    value={memberInput}
                    onChange={(e) => setMemberInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && addMember()}
                    placeholder="Enter user ID or email"
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                  />
                  <button
                    onClick={addMember}
                    className="inline-flex items-center gap-1 px-3 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 text-sm"
                  >
                    <UserPlus className="h-3.5 w-3.5" />
                    Add
                  </button>
                </div>
                {formData.members.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {formData.members.map((m) => (
                      <span
                        key={m}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-gray-100 text-sm text-gray-700"
                      >
                        {m}
                        <button
                          onClick={() => removeMember(m)}
                          className="text-gray-400 hover:text-red-600"
                        >
                          <UserMinus className="h-3 w-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-gray-400 italic">No members assigned.</p>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-end gap-3">
              <button
                onClick={closeModal}
                className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={!formData.name || createMutation.isPending || updateMutation.isPending}
                className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50"
              >
                {editingDesk ? 'Save Changes' : 'Create Desk'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
