import { useEffect, useState, useCallback } from 'react'
import { api } from '../services/api'
import type { Approval, ApprovalSettings, ApprovalThreshold, ApprovalType, ApprovalStatus } from '../types'
import { APPROVAL_TYPE_LABELS, APPROVAL_STATUS_LABELS } from '../types'
import { CheckSquare, X, Clock, Zap, Shield, Save } from 'lucide-react'

const statusColors: Record<ApprovalStatus, string> = {
  pending: 'bg-yellow-100 text-yellow-700',
  approved: 'bg-green-100 text-green-700',
  rejected: 'bg-red-100 text-red-700',
  auto_approved: 'bg-blue-100 text-blue-700',
}

const typeColors: Record<ApprovalType, string> = {
  rate_override: 'bg-purple-100 text-purple-700',
  credit_extension: 'bg-orange-100 text-orange-700',
  high_value_shipment: 'bg-indigo-100 text-indigo-700',
  carrier_exception: 'bg-rose-100 text-rose-700',
  discount_approval: 'bg-teal-100 text-teal-700',
}

function formatCents(cents?: number): string {
  if (cents === undefined || cents === null) return '-'
  return `$${(cents / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function timeAgo(dateStr: string): string {
  const now = new Date()
  const date = new Date(dateStr)
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  if (diffMins < 1) return 'just now'
  if (diffMins < 60) return `${diffMins}m ago`
  const diffHours = Math.floor(diffMins / 60)
  if (diffHours < 24) return `${diffHours}h ago`
  const diffDays = Math.floor(diffHours / 24)
  return `${diffDays}d ago`
}

function expiryCountdown(expiresAt?: string): string | null {
  if (!expiresAt) return null
  const now = new Date()
  const expires = new Date(expiresAt)
  const diffMs = expires.getTime() - now.getTime()
  if (diffMs <= 0) return 'Expired'
  const diffHours = Math.floor(diffMs / 3600000)
  const diffMins = Math.floor((diffMs % 3600000) / 60000)
  if (diffHours > 24) return `${Math.floor(diffHours / 24)}d ${diffHours % 24}h left`
  if (diffHours > 0) return `${diffHours}h ${diffMins}m left`
  return `${diffMins}m left`
}

type TabId = 'pending' | 'history' | 'settings'

export default function ApprovalCenter() {
  const [activeTab, setActiveTab] = useState<TabId>('pending')
  const [pendingApprovals, setPendingApprovals] = useState<Approval[]>([])
  const [historyApprovals, setHistoryApprovals] = useState<Approval[]>([])
  const [, setSettings] = useState<ApprovalSettings | null>(null)
  const [loading, setLoading] = useState(true)
  const [rejectModalId, setRejectModalId] = useState<string | null>(null)
  const [rejectReason, setRejectReason] = useState('')
  const [savingSettings, setSavingSettings] = useState(false)
  const [editedThresholds, setEditedThresholds] = useState<ApprovalThreshold[]>([])
  const [settingsDirty, setSettingsDirty] = useState(false)

  const fetchPending = useCallback(async () => {
    try {
      const data = await api.getApprovals({ status: 'pending' })
      setPendingApprovals(data)
    } catch (error) {
      console.error('Failed to fetch pending approvals:', error)
    }
  }, [])

  const fetchHistory = useCallback(async () => {
    try {
      const data = await api.getApprovals()
      setHistoryApprovals(data.filter((a: Approval) => a.status !== 'pending'))
    } catch (error) {
      console.error('Failed to fetch approval history:', error)
    }
  }, [])

  const fetchSettings = useCallback(async () => {
    try {
      const data = await api.getApprovalSettings()
      setSettings(data)
      setEditedThresholds(data.thresholds.map((t: ApprovalThreshold) => ({ ...t })))
    } catch (error) {
      console.error('Failed to fetch approval settings:', error)
    }
  }, [])

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      await Promise.all([fetchPending(), fetchHistory(), fetchSettings()])
      setLoading(false)
    }
    load()
  }, [fetchPending, fetchHistory, fetchSettings])

  const handleApprove = async (id: string) => {
    try {
      await api.approveApproval(id)
      await Promise.all([fetchPending(), fetchHistory()])
    } catch (error) {
      console.error('Failed to approve:', error)
    }
  }

  const handleReject = async () => {
    if (!rejectModalId) return
    try {
      await api.rejectApproval(rejectModalId, rejectReason || undefined)
      setRejectModalId(null)
      setRejectReason('')
      await Promise.all([fetchPending(), fetchHistory()])
    } catch (error) {
      console.error('Failed to reject:', error)
    }
  }

  const handleThresholdChange = (index: number, field: keyof ApprovalThreshold, value: unknown) => {
    setEditedThresholds(prev => {
      const next = [...prev]
      next[index] = { ...next[index], [field]: value }
      return next
    })
    setSettingsDirty(true)
  }

  const handleSaveSettings = async () => {
    setSavingSettings(true)
    try {
      const data = await api.updateApprovalThresholds(editedThresholds)
      setSettings(data)
      setEditedThresholds(data.thresholds.map((t: ApprovalThreshold) => ({ ...t })))
      setSettingsDirty(false)
    } catch (error) {
      console.error('Failed to save settings:', error)
    } finally {
      setSavingSettings(false)
    }
  }

  const tabs: { id: TabId; label: string; count?: number }[] = [
    { id: 'pending', label: 'Pending', count: pendingApprovals.length },
    { id: 'history', label: 'History' },
    { id: 'settings', label: 'Settings' },
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Approval Center</h1>
          <p className="text-gray-500">
            Manage approval requests and auto-approval thresholds
          </p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-yellow-100 rounded-lg">
              <Clock className="h-5 w-5 text-yellow-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Pending</p>
              <p className="text-xl font-bold">{pendingApprovals.length}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <CheckSquare className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Approved</p>
              <p className="text-xl font-bold">{historyApprovals.filter(a => a.status === 'approved').length}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Zap className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Auto-Approved</p>
              <p className="text-xl font-bold">{historyApprovals.filter(a => a.status === 'auto_approved').length}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-red-100 rounded-lg">
              <X className="h-5 w-5 text-red-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Rejected</p>
              <p className="text-xl font-bold">{historyApprovals.filter(a => a.status === 'rejected').length}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-gray-200">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab.id
                ? 'border-emerald-500 text-emerald-700'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab.label}
            {tab.count !== undefined && tab.count > 0 && (
              <span className="ml-2 px-1.5 py-0.5 text-xs rounded-full bg-yellow-100 text-yellow-700">
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="p-8 text-center text-gray-500">Loading...</div>
      ) : (
        <>
          {/* Pending Tab */}
          {activeTab === 'pending' && (
            <div className="space-y-4">
              {pendingApprovals.length === 0 ? (
                <div className="bg-white rounded-lg border border-gray-200 p-8 text-center text-gray-500">
                  No pending approvals
                </div>
              ) : (
                pendingApprovals.map((approval) => (
                  <div key={approval.id} className="bg-white rounded-lg border border-gray-200 p-5">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <span className={`px-2 py-0.5 text-xs font-medium rounded ${typeColors[approval.approval_type]}`}>
                            {APPROVAL_TYPE_LABELS[approval.approval_type]}
                          </span>
                          <span className={`px-2 py-0.5 text-xs font-medium rounded ${statusColors[approval.status]}`}>
                            {APPROVAL_STATUS_LABELS[approval.status]}
                          </span>
                          {approval.expires_at && (
                            <span className="text-xs text-gray-400">
                              {expiryCountdown(approval.expires_at)}
                            </span>
                          )}
                        </div>
                        <h3 className="text-base font-semibold text-gray-900">{approval.title}</h3>
                        {approval.description && (
                          <p className="text-sm text-gray-600 mt-1">{approval.description}</p>
                        )}
                        <div className="flex items-center gap-4 mt-3 text-sm text-gray-500">
                          {approval.amount !== undefined && approval.amount !== null && (
                            <span className="font-medium text-gray-900">
                              Amount: {formatCents(approval.amount)}
                            </span>
                          )}
                          <span>Entity: {approval.entity_type}</span>
                          {approval.requested_by && (
                            <span>Requested by: {approval.requested_by}</span>
                          )}
                          <span>{timeAgo(approval.created_at)}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 ml-4">
                        <button
                          onClick={() => handleApprove(approval.id)}
                          className="flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded-lg transition-colors"
                        >
                          <CheckSquare className="h-4 w-4" />
                          Approve
                        </button>
                        <button
                          onClick={() => {
                            setRejectModalId(approval.id)
                            setRejectReason('')
                          }}
                          className="flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors"
                        >
                          <X className="h-4 w-4" />
                          Reject
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* History Tab */}
          {activeTab === 'history' && (
            <div className="bg-white rounded-lg border border-gray-200">
              {historyApprovals.length === 0 ? (
                <div className="p-8 text-center text-gray-500">No approval history</div>
              ) : (
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-200 text-left">
                      <th className="px-4 py-3 text-sm font-medium text-gray-500">Type</th>
                      <th className="px-4 py-3 text-sm font-medium text-gray-500">Title</th>
                      <th className="px-4 py-3 text-sm font-medium text-gray-500 text-right">Amount</th>
                      <th className="px-4 py-3 text-sm font-medium text-gray-500">Status</th>
                      <th className="px-4 py-3 text-sm font-medium text-gray-500">Requested By</th>
                      <th className="px-4 py-3 text-sm font-medium text-gray-500">Resolved By</th>
                      <th className="px-4 py-3 text-sm font-medium text-gray-500">Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {historyApprovals.map((approval) => (
                      <tr key={approval.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3">
                          <span className={`px-2 py-0.5 text-xs font-medium rounded ${typeColors[approval.approval_type]}`}>
                            {APPROVAL_TYPE_LABELS[approval.approval_type]}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900">{approval.title}</td>
                        <td className="px-4 py-3 text-sm text-gray-900 text-right font-medium">
                          {formatCents(approval.amount)}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-0.5 text-xs font-medium rounded ${statusColors[approval.status]}`}>
                            {APPROVAL_STATUS_LABELS[approval.status]}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">
                          {approval.requested_by || '-'}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">
                          {approval.approved_by || '-'}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">
                          {new Date(approval.created_at).toLocaleDateString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {/* Settings Tab */}
          {activeTab === 'settings' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Shield className="h-5 w-5 text-gray-600" />
                  <h2 className="text-lg font-semibold text-gray-900">Auto-Approval Thresholds</h2>
                </div>
                <button
                  onClick={handleSaveSettings}
                  disabled={!settingsDirty || savingSettings}
                  className={`flex items-center gap-1 px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                    settingsDirty && !savingSettings
                      ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                      : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                  }`}
                >
                  <Save className="h-4 w-4" />
                  {savingSettings ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
              <p className="text-sm text-gray-500">
                Approvals at or below these amounts will be automatically approved. Set to $0 to always require manual approval.
              </p>
              <div className="bg-white rounded-lg border border-gray-200">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-200 text-left">
                      <th className="px-4 py-3 text-sm font-medium text-gray-500">Approval Type</th>
                      <th className="px-4 py-3 text-sm font-medium text-gray-500">Max Auto-Approve Amount</th>
                      <th className="px-4 py-3 text-sm font-medium text-gray-500">Enabled</th>
                      <th className="px-4 py-3 text-sm font-medium text-gray-500">Notify on Auto-Approve</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {editedThresholds.map((threshold, index) => (
                      <tr key={threshold.approval_type} className="hover:bg-gray-50">
                        <td className="px-4 py-3">
                          <span className={`px-2 py-0.5 text-xs font-medium rounded ${typeColors[threshold.approval_type]}`}>
                            {APPROVAL_TYPE_LABELS[threshold.approval_type]}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1">
                            <span className="text-sm text-gray-500">$</span>
                            <input
                              type="number"
                              min="0"
                              step="100"
                              value={threshold.max_auto_approve_amount / 100}
                              onChange={(e) => {
                                const dollars = parseFloat(e.target.value) || 0
                                handleThresholdChange(index, 'max_auto_approve_amount', Math.round(dollars * 100))
                              }}
                              className="w-32 px-2 py-1 border border-gray-300 rounded text-sm focus:ring-emerald-500 focus:border-emerald-500"
                            />
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <button
                            onClick={() => handleThresholdChange(index, 'enabled', !threshold.enabled)}
                            className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                              threshold.enabled ? 'bg-emerald-500' : 'bg-gray-200'
                            }`}
                          >
                            <span
                              className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                                threshold.enabled ? 'translate-x-5' : 'translate-x-0'
                              }`}
                            />
                          </button>
                        </td>
                        <td className="px-4 py-3">
                          <button
                            onClick={() => handleThresholdChange(index, 'notify_on_auto_approve', !threshold.notify_on_auto_approve)}
                            className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                              threshold.notify_on_auto_approve ? 'bg-emerald-500' : 'bg-gray-200'
                            }`}
                          >
                            <span
                              className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                                threshold.notify_on_auto_approve ? 'translate-x-5' : 'translate-x-0'
                              }`}
                            />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {/* Reject Reason Modal */}
      {rejectModalId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-lg shadow-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Reject Approval</h3>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Reason (optional)
            </label>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-red-500 focus:border-red-500"
              placeholder="Enter reason for rejection..."
            />
            <div className="flex justify-end gap-2 mt-4">
              <button
                onClick={() => {
                  setRejectModalId(null)
                  setRejectReason('')
                }}
                className="px-4 py-2 text-sm font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleReject}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors"
              >
                Reject
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
