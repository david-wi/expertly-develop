import { useState, useEffect } from 'react'
import PageHelp from '../components/PageHelp'
import {
  Zap,
  Plus,
  Trash2,
  Save,
  X,
  ToggleLeft,
  ToggleRight,
  ChevronRight,
  Play,
  Eye,
  AlertCircle,
  CheckCircle,
  XCircle,
  Clock,
} from 'lucide-react'
import { api } from '../services/api'
import type {
  AutomationRule,
  AutomationTrigger,
  AutomationAction,
  RolloutStage,
  AutomationCondition,
  TestAutomationResult,
} from '../types'
import {
  AUTOMATION_TRIGGER_LABELS,
  AUTOMATION_ACTION_LABELS,
  ROLLOUT_STAGE_LABELS,
} from '../types'

const TRIGGERS: AutomationTrigger[] = [
  'shipment_created',
  'shipment_status_changed',
  'tender_accepted',
  'tender_declined',
  'quote_request_received',
  'work_item_created',
  'invoice_due',
  'check_call_overdue',
]

const ACTIONS: AutomationAction[] = [
  'create_work_item',
  'send_notification',
  'assign_carrier',
  'update_status',
  'create_tender',
  'auto_approve',
  'escalate',
  'send_email',
]

const OPERATORS = [
  { value: 'equals', label: 'Equals' },
  { value: 'not_equals', label: 'Not Equals' },
  { value: 'greater_than', label: 'Greater Than' },
  { value: 'less_than', label: 'Less Than' },
  { value: 'contains', label: 'Contains' },
  { value: 'in', label: 'In (comma-separated)' },
  { value: 'starts_with', label: 'Starts With' },
]

const ROLLOUT_STAGES: RolloutStage[] = ['disabled', 'shadow', 'partial', 'full']

const rolloutColors: Record<RolloutStage, string> = {
  disabled: 'bg-gray-100 text-gray-700',
  shadow: 'bg-yellow-100 text-yellow-700',
  partial: 'bg-blue-100 text-blue-700',
  full: 'bg-green-100 text-green-700',
}

const STAGE_DESCRIPTIONS: Record<RolloutStage, string> = {
  disabled: 'Rule will not run. Use this while building your rule.',
  shadow: 'Rule evaluates on every trigger but does not execute actions. Results are logged for review.',
  partial: 'Rule executes actions for a percentage of matching triggers. Good for gradual rollout.',
  full: 'Rule executes actions for every matching trigger. Fully active.',
}

interface RuleFormData {
  name: string
  description: string
  trigger: AutomationTrigger
  conditions: AutomationCondition[]
  action: AutomationAction
  action_config: Record<string, unknown>
  rollout_stage: RolloutStage
  rollout_percentage: number
  priority: number
  enabled: boolean
}

const emptyForm: RuleFormData = {
  name: '',
  description: '',
  trigger: 'shipment_created',
  conditions: [],
  action: 'create_work_item',
  action_config: {},
  rollout_stage: 'disabled',
  rollout_percentage: 0,
  priority: 50,
  enabled: false,
}

export default function AutomationBuilder() {
  const [rules, setRules] = useState<AutomationRule[]>([])
  const [loading, setLoading] = useState(true)
  const [showEditor, setShowEditor] = useState(false)
  const [editingRule, setEditingRule] = useState<AutomationRule | null>(null)
  const [formData, setFormData] = useState<RuleFormData>(emptyForm)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Testing sandbox state
  const [showTestPanel, setShowTestPanel] = useState(false)
  const [testEntityType, setTestEntityType] = useState('shipment')
  const [testEntityId, setTestEntityId] = useState('')
  const [testResult, setTestResult] = useState<TestAutomationResult | null>(null)
  const [testing, setTesting] = useState(false)
  const [testError, setTestError] = useState<string | null>(null)

  useEffect(() => {
    fetchRules()
  }, [])

  const fetchRules = async () => {
    setLoading(true)
    try {
      const data = await api.listAutomations()
      setRules(data)
    } catch (err) {
      console.error('Failed to fetch automations:', err)
    } finally {
      setLoading(false)
    }
  }

  const openNewRule = () => {
    setEditingRule(null)
    setFormData(emptyForm)
    setShowEditor(true)
    setError(null)
  }

  const openEditRule = (rule: AutomationRule) => {
    setEditingRule(rule)
    setFormData({
      name: rule.name,
      description: rule.description,
      trigger: rule.trigger,
      conditions: rule.conditions || [],
      action: rule.action,
      action_config: rule.action_config || {},
      rollout_stage: rule.rollout_stage,
      rollout_percentage: rule.rollout_percentage,
      priority: rule.priority,
      enabled: rule.enabled,
    })
    setShowEditor(true)
    setError(null)
  }

  const closeEditor = () => {
    setShowEditor(false)
    setEditingRule(null)
    setFormData(emptyForm)
    setError(null)
  }

  const handleSave = async () => {
    if (!formData.name.trim()) {
      setError('Rule name is required')
      return
    }
    setSaving(true)
    setError(null)
    try {
      if (editingRule) {
        await api.updateAutomation(editingRule.id, formData)
      } else {
        await api.createAutomation(formData)
      }
      await fetchRules()
      closeEditor()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (ruleId: string) => {
    if (!confirm('Delete this automation rule?')) return
    try {
      await api.deleteAutomation(ruleId)
      await fetchRules()
      if (editingRule?.id === ruleId) closeEditor()
    } catch (err) {
      console.error('Failed to delete rule:', err)
    }
  }

  const handleToggle = async (ruleId: string) => {
    try {
      const updated = await api.toggleAutomation(ruleId)
      setRules(rules.map(r => (r.id === updated.id ? updated : r)))
    } catch (err) {
      console.error('Failed to toggle rule:', err)
    }
  }

  // Conditions management
  const addCondition = () => {
    setFormData({
      ...formData,
      conditions: [...formData.conditions, { field: '', operator: 'equals', value: '' }],
    })
  }

  const updateCondition = (index: number, updates: Partial<AutomationCondition>) => {
    const newConditions = [...formData.conditions]
    newConditions[index] = { ...newConditions[index], ...updates }
    setFormData({ ...formData, conditions: newConditions })
  }

  const removeCondition = (index: number) => {
    setFormData({
      ...formData,
      conditions: formData.conditions.filter((_, i) => i !== index),
    })
  }

  // Action config helpers
  const updateActionConfig = (key: string, value: unknown) => {
    setFormData({
      ...formData,
      action_config: { ...formData.action_config, [key]: value },
    })
  }

  // Testing sandbox
  const handleTest = async () => {
    if (!testEntityId.trim()) {
      setTestError('Entity ID is required')
      return
    }
    setTesting(true)
    setTestError(null)
    setTestResult(null)
    try {
      const result = await api.testAutomation({
        entity_type: testEntityType,
        entity_id: testEntityId,
      })
      setTestResult(result)
    } catch (err) {
      setTestError(err instanceof Error ? err.message : 'Test failed')
    } finally {
      setTesting(false)
    }
  }

  // Render action config form based on action type
  const renderActionConfig = () => {
    const config = formData.action_config

    switch (formData.action) {
      case 'create_work_item':
        return (
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Work Type</label>
              <select
                value={(config.work_type as string) || 'custom'}
                onChange={e => updateActionConfig('work_type', e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              >
                <option value="custom">Custom</option>
                <option value="quote_request">Quote Request</option>
                <option value="shipment_needs_carrier">Shipment Needs Carrier</option>
                <option value="check_call_due">Check Call Due</option>
                <option value="exception">Exception</option>
                <option value="approval_needed">Approval Needed</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
              <input
                type="text"
                value={(config.title as string) || ''}
                onChange={e => updateActionConfig('title', e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                placeholder="Work item title"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Priority</label>
              <input
                type="number"
                min={0}
                max={100}
                value={(config.priority as number) || 50}
                onChange={e => updateActionConfig('priority', Number(e.target.value))}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              />
            </div>
          </div>
        )

      case 'send_notification':
        return (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Message</label>
            <textarea
              value={(config.message as string) || ''}
              onChange={e => updateActionConfig('message', e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              rows={3}
              placeholder="Notification message"
            />
          </div>
        )

      case 'update_status':
        return (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">New Status</label>
            <input
              type="text"
              value={(config.new_status as string) || ''}
              onChange={e => updateActionConfig('new_status', e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              placeholder="e.g., in_transit, delivered"
            />
          </div>
        )

      case 'send_email':
        return (
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">To Email</label>
              <input
                type="email"
                value={(config.to_email as string) || ''}
                onChange={e => updateActionConfig('to_email', e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                placeholder="recipient@example.com"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Subject</label>
              <input
                type="text"
                value={(config.subject as string) || ''}
                onChange={e => updateActionConfig('subject', e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                placeholder="Email subject"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Body</label>
              <textarea
                value={(config.body as string) || ''}
                onChange={e => updateActionConfig('body', e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                rows={3}
                placeholder="Email body"
              />
            </div>
          </div>
        )

      case 'escalate':
        return (
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Escalation Target</label>
              <input
                type="text"
                value={(config.target as string) || ''}
                onChange={e => updateActionConfig('target', e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                placeholder="e.g., manager, ops_lead"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Message</label>
              <textarea
                value={(config.message as string) || ''}
                onChange={e => updateActionConfig('message', e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                rows={2}
                placeholder="Escalation message"
              />
            </div>
          </div>
        )

      default:
        return (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Action Configuration (JSON)
            </label>
            <textarea
              value={JSON.stringify(config, null, 2)}
              onChange={e => {
                try {
                  setFormData({ ...formData, action_config: JSON.parse(e.target.value) })
                } catch {
                  // Allow partial edits
                }
              }}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm font-mono"
              rows={4}
              placeholder="{}"
            />
          </div>
        )
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Zap className="h-7 w-7 text-yellow-500" />
            Automation Builder
            <PageHelp pageId="automations" />
          </h1>
          <p className="text-gray-500 mt-1">
            Define rules in plain English, test in a sandbox, and roll out gradually.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowTestPanel(!showTestPanel)}
            className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            <Play className="h-4 w-4" />
            Test Sandbox
          </button>
          <button
            onClick={openNewRule}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            <Plus className="h-4 w-4" />
            New Rule
          </button>
        </div>
      </div>

      {/* Testing Sandbox Panel */}
      {showTestPanel && (
        <div className="rounded-xl border border-blue-200 bg-blue-50 p-6">
          <h3 className="text-lg font-semibold text-blue-900 mb-4 flex items-center gap-2">
            <Play className="h-5 w-5" />
            Testing Sandbox
          </h3>
          <p className="text-sm text-blue-700 mb-4">
            Test all automation rules against a specific entity. Rules are evaluated in dry-run mode — no actions are executed.
          </p>
          <div className="flex items-end gap-4">
            <div>
              <label className="block text-sm font-medium text-blue-900 mb-1">Entity Type</label>
              <select
                value={testEntityType}
                onChange={e => setTestEntityType(e.target.value)}
                className="rounded-lg border border-blue-300 bg-white px-3 py-2 text-sm"
              >
                <option value="shipment">Shipment</option>
                <option value="tender">Tender</option>
                <option value="quote_request">Quote Request</option>
                <option value="work_item">Work Item</option>
                <option value="invoice">Invoice</option>
              </select>
            </div>
            <div className="flex-1">
              <label className="block text-sm font-medium text-blue-900 mb-1">Entity ID</label>
              <input
                type="text"
                value={testEntityId}
                onChange={e => setTestEntityId(e.target.value)}
                className="w-full rounded-lg border border-blue-300 bg-white px-3 py-2 text-sm"
                placeholder="Enter entity ID"
              />
            </div>
            <button
              onClick={handleTest}
              disabled={testing}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {testing ? 'Testing...' : 'Run Test'}
            </button>
          </div>

          {testError && (
            <div className="mt-4 rounded-lg bg-red-100 border border-red-200 p-3 text-sm text-red-700">
              {testError}
            </div>
          )}

          {testResult && (
            <div className="mt-4 space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <div className="rounded-lg bg-white p-4 border border-blue-200">
                  <div className="text-2xl font-bold text-blue-900">
                    {testResult.matched_rules.length}
                  </div>
                  <div className="text-sm text-blue-600">Rules Evaluated</div>
                </div>
                <div className="rounded-lg bg-white p-4 border border-blue-200">
                  <div className="text-2xl font-bold text-green-700">
                    {testResult.matched_rules.filter((r: any) => r.conditions_met).length}
                  </div>
                  <div className="text-sm text-green-600">Conditions Met</div>
                </div>
                <div className="rounded-lg bg-white p-4 border border-blue-200">
                  <div className="text-2xl font-bold text-yellow-700">
                    {testResult.actions_that_would_fire.length}
                  </div>
                  <div className="text-sm text-yellow-600">Actions Would Fire</div>
                </div>
              </div>

              {testResult.matched_rules.length > 0 && (
                <div className="rounded-lg bg-white border border-blue-200 overflow-hidden">
                  <div className="px-4 py-2 bg-blue-100 border-b border-blue-200">
                    <span className="text-sm font-semibold text-blue-900">Rule Results</span>
                  </div>
                  <div className="divide-y divide-blue-100">
                    {testResult.matched_rules.map((mr: any, idx: number) => (
                      <div key={idx} className="px-4 py-3 flex items-center gap-3">
                        {mr.conditions_met ? (
                          <CheckCircle className="h-5 w-5 text-green-500 shrink-0" />
                        ) : (
                          <XCircle className="h-5 w-5 text-red-400 shrink-0" />
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-sm text-gray-900">{mr.rule_name}</div>
                          <div className="text-xs text-gray-500">
                            Trigger: {AUTOMATION_TRIGGER_LABELS[mr.trigger as AutomationTrigger]} | Action:{' '}
                            {AUTOMATION_ACTION_LABELS[mr.action as AutomationAction]}
                          </div>
                        </div>
                        <span
                          className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                            mr.conditions_met
                              ? 'bg-green-100 text-green-700'
                              : 'bg-red-100 text-red-700'
                          }`}
                        >
                          {mr.conditions_met ? 'PASS' : 'FAIL'}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {testResult.actions_that_would_fire.length > 0 && (
                <div className="rounded-lg bg-white border border-yellow-200 overflow-hidden">
                  <div className="px-4 py-2 bg-yellow-100 border-b border-yellow-200">
                    <span className="text-sm font-semibold text-yellow-900">
                      Actions That Would Fire
                    </span>
                  </div>
                  <div className="divide-y divide-yellow-100">
                    {testResult.actions_that_would_fire.map((af: any, idx: number) => (
                      <div key={idx} className="px-4 py-3">
                        <div className="font-medium text-sm text-gray-900">
                          {af.rule_name as string}
                        </div>
                        <div className="text-xs text-gray-600 mt-1">
                          {af.description as string}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Rule Editor */}
      {showEditor && (
        <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
            <h2 className="text-lg font-semibold text-gray-900">
              {editingRule ? 'Edit Rule' : 'New Automation Rule'}
            </h2>
            <button onClick={closeEditor} className="text-gray-400 hover:text-gray-600">
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="p-6 space-y-6">
            {error && (
              <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700 flex items-center gap-2">
                <AlertCircle className="h-4 w-4 shrink-0" />
                {error}
              </div>
            )}

            {/* Name & Description */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Rule Name</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  placeholder="e.g., Auto-create work item on new shipment"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Priority</label>
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={formData.priority}
                  onChange={e => setFormData({ ...formData, priority: Number(e.target.value) })}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Description (plain English)
              </label>
              <textarea
                value={formData.description}
                onChange={e => setFormData({ ...formData, description: e.target.value })}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                rows={2}
                placeholder="Describe what this rule does in plain English..."
              />
            </div>

            {/* Trigger & Action */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Trigger</label>
                <select
                  value={formData.trigger}
                  onChange={e =>
                    setFormData({ ...formData, trigger: e.target.value as AutomationTrigger })
                  }
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                >
                  {TRIGGERS.map(t => (
                    <option key={t} value={t}>
                      {AUTOMATION_TRIGGER_LABELS[t]}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Action</label>
                <select
                  value={formData.action}
                  onChange={e =>
                    setFormData({
                      ...formData,
                      action: e.target.value as AutomationAction,
                      action_config: {},
                    })
                  }
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                >
                  {ACTIONS.map(a => (
                    <option key={a} value={a}>
                      {AUTOMATION_ACTION_LABELS[a]}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Conditions */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium text-gray-700">
                  Conditions (all must match)
                </label>
                <button
                  onClick={addCondition}
                  className="inline-flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700"
                >
                  <Plus className="h-3 w-3" /> Add Condition
                </button>
              </div>
              {formData.conditions.length === 0 ? (
                <p className="text-sm text-gray-400 italic">
                  No conditions — rule will match all triggers of this type.
                </p>
              ) : (
                <div className="space-y-2">
                  {formData.conditions.map((cond, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <input
                        type="text"
                        value={cond.field}
                        onChange={e => updateCondition(idx, { field: e.target.value })}
                        className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm"
                        placeholder="Field (e.g., shipment.equipment_type)"
                      />
                      <select
                        value={cond.operator}
                        onChange={e => updateCondition(idx, { operator: e.target.value })}
                        className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
                      >
                        {OPERATORS.map(op => (
                          <option key={op.value} value={op.value}>
                            {op.label}
                          </option>
                        ))}
                      </select>
                      <input
                        type="text"
                        value={String(cond.value ?? '')}
                        onChange={e => updateCondition(idx, { value: e.target.value })}
                        className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm"
                        placeholder="Value"
                      />
                      <button
                        onClick={() => removeCondition(idx)}
                        className="text-red-400 hover:text-red-600"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Action Config */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Action Configuration
              </label>
              {renderActionConfig()}
            </div>

            {/* Rollout Controls */}
            <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
              <h3 className="text-sm font-semibold text-gray-900 mb-3">Rollout Controls</h3>
              <div className="flex gap-2 mb-3">
                {ROLLOUT_STAGES.map(stage => (
                  <button
                    key={stage}
                    onClick={() => setFormData({ ...formData, rollout_stage: stage })}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                      formData.rollout_stage === stage
                        ? rolloutColors[stage] + ' ring-2 ring-offset-1 ring-gray-400'
                        : 'bg-white text-gray-500 border border-gray-200 hover:bg-gray-100'
                    }`}
                  >
                    {ROLLOUT_STAGE_LABELS[stage]}
                  </button>
                ))}
              </div>
              <p className="text-xs text-gray-500 mb-3">
                {STAGE_DESCRIPTIONS[formData.rollout_stage]}
              </p>
              {formData.rollout_stage === 'partial' && (
                <div className="flex items-center gap-3">
                  <label className="text-sm text-gray-700 whitespace-nowrap">
                    Rollout Percentage:
                  </label>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={formData.rollout_percentage}
                    onChange={e =>
                      setFormData({ ...formData, rollout_percentage: Number(e.target.value) })
                    }
                    className="flex-1"
                  />
                  <span className="text-sm font-medium text-gray-900 w-12 text-right">
                    {formData.rollout_percentage}%
                  </span>
                </div>
              )}
            </div>

            {/* Save / Cancel */}
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={closeEditor}
                className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              >
                <Save className="h-4 w-4" />
                {saving ? 'Saving...' : editingRule ? 'Update Rule' : 'Create Rule'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Rules Table */}
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">
            Automation Rules ({rules.length})
          </h2>
        </div>

        {loading ? (
          <div className="p-12 text-center text-gray-400">Loading automation rules...</div>
        ) : rules.length === 0 ? (
          <div className="p-12 text-center">
            <Zap className="h-12 w-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500">No automation rules yet.</p>
            <p className="text-sm text-gray-400 mt-1">
              Create your first rule to automate TMS workflows.
            </p>
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                <th className="px-6 py-3">Name</th>
                <th className="px-6 py-3">Trigger</th>
                <th className="px-6 py-3">Action</th>
                <th className="px-6 py-3">Rollout</th>
                <th className="px-6 py-3 text-right">Triggers</th>
                <th className="px-6 py-3">Last Triggered</th>
                <th className="px-6 py-3 text-center">Enabled</th>
                <th className="px-6 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rules.map(rule => (
                <tr
                  key={rule.id}
                  className="hover:bg-gray-50 cursor-pointer transition-colors"
                  onClick={() => openEditRule(rule)}
                >
                  <td className="px-6 py-4">
                    <div className="font-medium text-sm text-gray-900">{rule.name}</div>
                    {rule.description && (
                      <div className="text-xs text-gray-500 mt-0.5 truncate max-w-xs">
                        {rule.description}
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-700">
                    {AUTOMATION_TRIGGER_LABELS[rule.trigger]}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-700">
                    {AUTOMATION_ACTION_LABELS[rule.action]}
                  </td>
                  <td className="px-6 py-4">
                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${rolloutColors[rule.rollout_stage]}`}
                    >
                      {ROLLOUT_STAGE_LABELS[rule.rollout_stage]}
                      {rule.rollout_stage === 'partial' && (
                        <span className="ml-0.5">({rule.rollout_percentage}%)</span>
                      )}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-700 text-right">
                    {rule.trigger_count}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    {rule.last_triggered_at ? (
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {new Date(rule.last_triggered_at).toLocaleDateString()}
                      </span>
                    ) : (
                      <span className="text-gray-300">Never</span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-center" onClick={e => e.stopPropagation()}>
                    <button
                      onClick={() => handleToggle(rule.id)}
                      className="inline-flex items-center"
                      title={rule.enabled ? 'Disable' : 'Enable'}
                    >
                      {rule.enabled ? (
                        <ToggleRight className="h-6 w-6 text-green-500" />
                      ) : (
                        <ToggleLeft className="h-6 w-6 text-gray-300" />
                      )}
                    </button>
                  </td>
                  <td className="px-6 py-4 text-right" onClick={e => e.stopPropagation()}>
                    <div className="flex items-center justify-end gap-2">
                      {rule.shadow_log.length > 0 && (
                        <button
                          onClick={() => openEditRule(rule)}
                          className="text-yellow-500 hover:text-yellow-700"
                          title="View shadow log"
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                      )}
                      <button
                        onClick={() => handleDelete(rule.id)}
                        className="text-red-400 hover:text-red-600"
                        title="Delete rule"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                      <ChevronRight className="h-4 w-4 text-gray-300" />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
