import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { api } from '../services/api'
import { apiExtensions } from '../services/api-extensions'
import type { Carrier, Shipment } from '../types'
import type {
  CarrierInsurance,
  CarrierComplianceRecord,
  ComplianceStatusSummary,
  ComplianceCheckResult,
} from '../types/carrier-detail'
import {
  INSURANCE_TYPE_LABELS,
  COMPLIANCE_TYPE_LABELS,
  COMPLIANCE_STATUS_LABELS,
} from '../types/carrier-detail'
import {
  ArrowLeft,
  Building2,
  Shield,
  FileCheck,
  BarChart3,
  Truck,
  Plus,
  X,
  AlertTriangle,
  CheckCircle,
  Clock,
  XCircle,
  RefreshCw,
  Calendar,
} from 'lucide-react'

const carrierStatusConfig: Record<string, { bg: string; text: string }> = {
  active: { bg: 'bg-emerald-100', text: 'text-emerald-700' },
  pending: { bg: 'bg-blue-100', text: 'text-blue-700' },
  suspended: { bg: 'bg-red-100', text: 'text-red-700' },
  do_not_use: { bg: 'bg-gray-100', text: 'text-gray-700' },
}

const complianceStatusColors: Record<string, { bg: string; text: string; icon: typeof CheckCircle }> = {
  compliant: { bg: 'bg-emerald-100', text: 'text-emerald-700', icon: CheckCircle },
  at_risk: { bg: 'bg-amber-100', text: 'text-amber-700', icon: AlertTriangle },
  non_compliant: { bg: 'bg-red-100', text: 'text-red-700', icon: XCircle },
  pending: { bg: 'bg-blue-100', text: 'text-blue-700', icon: Clock },
  expired: { bg: 'bg-red-100', text: 'text-red-700', icon: XCircle },
}

type Tab = 'overview' | 'compliance' | 'insurance' | 'performance' | 'loads'

export default function CarrierDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [carrier, setCarrier] = useState<Carrier | null>(null)
  const [insuranceRecords, setInsuranceRecords] = useState<CarrierInsurance[]>([])
  const [complianceRecords, setComplianceRecords] = useState<CarrierComplianceRecord[]>([])
  const [complianceSummary, setComplianceSummary] = useState<ComplianceStatusSummary | null>(null)
  const [checkResult, setCheckResult] = useState<ComplianceCheckResult | null>(null)
  const [shipments, setShipments] = useState<Shipment[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<Tab>('overview')
  const [runningCheck, setRunningCheck] = useState(false)

  // Insurance form
  const [showInsuranceForm, setShowInsuranceForm] = useState(false)
  const [insuranceForm, setInsuranceForm] = useState({
    insurance_type: 'cargo' as 'cargo' | 'liability' | 'auto' | 'workers_comp',
    provider: '',
    policy_number: '',
    coverage_amount: 0,
    effective_date: '',
    expiry_date: '',
    is_current: true,
  })

  // Compliance form
  const [showComplianceForm, setShowComplianceForm] = useState(false)
  const [complianceForm, setComplianceForm] = useState({
    compliance_type: 'authority' as 'authority' | 'safety_rating' | 'drug_testing' | 'hazmat_cert',
    status: 'pending' as 'compliant' | 'non_compliant' | 'pending' | 'expired',
    details: '',
    expires_at: '',
  })

  useEffect(() => {
    if (!id) return
    fetchCarrier()
  }, [id])

  useEffect(() => {
    if (!id || !carrier) return
    if (activeTab === 'compliance') {
      fetchComplianceRecords()
      fetchComplianceSummary()
    }
    if (activeTab === 'insurance') fetchInsuranceRecords()
    if (activeTab === 'loads') fetchShipments()
  }, [activeTab, carrier])

  const fetchCarrier = async () => {
    if (!id) return
    try {
      const data = await api.getCarrier(id)
      setCarrier(data)
    } catch (error) {
      console.error('Failed to fetch carrier:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchInsuranceRecords = async () => {
    if (!id) return
    try {
      const data = await apiExtensions.getCarrierInsurance(id)
      setInsuranceRecords(data)
    } catch (error) {
      console.error('Failed to fetch insurance:', error)
    }
  }

  const fetchComplianceRecords = async () => {
    if (!id) return
    try {
      const data = await apiExtensions.getCarrierCompliance(id)
      setComplianceRecords(data)
    } catch (error) {
      console.error('Failed to fetch compliance:', error)
    }
  }

  const fetchComplianceSummary = async () => {
    if (!id) return
    try {
      const data = await apiExtensions.getCarrierComplianceStatus(id)
      setComplianceSummary(data)
    } catch (error) {
      console.error('Failed to fetch compliance summary:', error)
    }
  }

  const fetchShipments = async () => {
    if (!id) return
    try {
      const data = await api.getShipments({ carrier_id: id })
      setShipments(data)
    } catch (error) {
      console.error('Failed to fetch shipments:', error)
    }
  }

  const handleRunComplianceCheck = async () => {
    if (!id) return
    setRunningCheck(true)
    try {
      const result = await apiExtensions.runCarrierComplianceCheck(id)
      setCheckResult(result)
      // Refresh summary
      await fetchComplianceSummary()
    } catch (error) {
      console.error('Failed to run compliance check:', error)
    } finally {
      setRunningCheck(false)
    }
  }

  const handleCreateInsurance = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!id) return
    try {
      const payload: Record<string, unknown> = {
        insurance_type: insuranceForm.insurance_type,
        provider: insuranceForm.provider || undefined,
        policy_number: insuranceForm.policy_number || undefined,
        coverage_amount: insuranceForm.coverage_amount,
        is_current: insuranceForm.is_current,
      }
      if (insuranceForm.effective_date) payload.effective_date = new Date(insuranceForm.effective_date).toISOString()
      if (insuranceForm.expiry_date) payload.expiry_date = new Date(insuranceForm.expiry_date).toISOString()

      const created = await apiExtensions.createCarrierInsurance(id, payload as any)
      setInsuranceRecords([...insuranceRecords, created])
      setShowInsuranceForm(false)
      setInsuranceForm({
        insurance_type: 'cargo', provider: '', policy_number: '',
        coverage_amount: 0, effective_date: '', expiry_date: '', is_current: true,
      })
    } catch (error) {
      console.error('Failed to create insurance:', error)
    }
  }

  const handleCreateCompliance = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!id) return
    try {
      const payload: Record<string, unknown> = {
        compliance_type: complianceForm.compliance_type,
        status: complianceForm.status,
        details: complianceForm.details || undefined,
      }
      if (complianceForm.expires_at) payload.expires_at = new Date(complianceForm.expires_at).toISOString()

      const created = await apiExtensions.createCarrierCompliance(id, payload as any)
      setComplianceRecords([...complianceRecords, created])
      setShowComplianceForm(false)
      setComplianceForm({
        compliance_type: 'authority', status: 'pending', details: '', expires_at: '',
      })
    } catch (error) {
      console.error('Failed to create compliance record:', error)
    }
  }

  if (loading) {
    return <div className="p-8 text-center text-gray-500">Loading...</div>
  }

  if (!carrier) {
    return <div className="p-8 text-center text-gray-500">Carrier not found</div>
  }

  const statusStyle = carrierStatusConfig[carrier.status] || carrierStatusConfig.active

  const tabs: { key: Tab; label: string; icon: typeof Building2 }[] = [
    { key: 'overview', label: 'Overview', icon: Building2 },
    { key: 'compliance', label: 'Compliance', icon: Shield },
    { key: 'insurance', label: 'Insurance', icon: FileCheck },
    { key: 'performance', label: 'Performance', icon: BarChart3 },
    { key: 'loads', label: 'Load History', icon: Truck },
  ]

  const formatCurrency = (cents: number) => {
    return `$${(cents / 100).toLocaleString('en-US', { minimumFractionDigits: 2 })}`
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => navigate('/carriers')}
          className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-gray-900">{carrier.name}</h1>
            <span className={`px-2.5 py-1 text-xs font-medium rounded-full ${statusStyle.bg} ${statusStyle.text}`}>
              {carrier.status.replace(/_/g, ' ')}
            </span>
          </div>
          <div className="flex items-center gap-4 mt-1 text-sm text-gray-500">
            {carrier.mc_number && <span>MC# {carrier.mc_number}</span>}
            {carrier.dot_number && <span>DOT# {carrier.dot_number}</span>}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="flex gap-6">
          {tabs.map((tab) => {
            const TabIcon = tab.icon
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex items-center gap-2 py-3 px-1 border-b-2 text-sm font-medium transition-colors ${
                  activeTab === tab.key
                    ? 'border-emerald-500 text-emerald-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <TabIcon className="h-4 w-4" />
                {tab.label}
              </button>
            )
          })}
        </nav>
      </div>

      {/* Overview Tab */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Stats */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="text-sm font-medium text-gray-500">Total Loads</div>
            <div className="mt-1 text-3xl font-bold text-gray-900">{carrier.total_loads}</div>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="text-sm font-medium text-gray-500">On-Time Rate</div>
            <div className="mt-1 text-3xl font-bold text-gray-900">
              {carrier.on_time_percentage !== undefined && carrier.on_time_percentage !== null
                ? `${carrier.on_time_percentage.toFixed(1)}%`
                : 'N/A'}
            </div>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="text-sm font-medium text-gray-500">Claims</div>
            <div className="mt-1 text-3xl font-bold text-gray-900">{carrier.claims_count}</div>
          </div>

          {/* Carrier Details */}
          <div className="lg:col-span-2 bg-white rounded-lg border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Carrier Information</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <span className="text-sm text-gray-500">Dispatch Email</span>
                <p className="text-sm font-medium">{carrier.dispatch_email || '-'}</p>
              </div>
              <div>
                <span className="text-sm text-gray-500">Dispatch Phone</span>
                <p className="text-sm font-medium">{carrier.dispatch_phone || '-'}</p>
              </div>
              <div>
                <span className="text-sm text-gray-500">Equipment Types</span>
                <div className="flex flex-wrap gap-1 mt-1">
                  {carrier.equipment_types.length > 0 ? carrier.equipment_types.map((eq, i) => (
                    <span key={i} className="px-2 py-0.5 text-xs bg-gray-100 rounded">{eq}</span>
                  )) : <span className="text-sm text-gray-400">None specified</span>}
                </div>
              </div>
              <div>
                <span className="text-sm text-gray-500">Safety Rating</span>
                <p className="text-sm font-medium">{carrier.safety_rating || 'Not rated'}</p>
              </div>
              <div>
                <span className="text-sm text-gray-500">Authority Active</span>
                <p className="text-sm font-medium">{carrier.authority_active ? 'Yes' : 'No'}</p>
              </div>
              <div>
                <span className="text-sm text-gray-500">Insurance Status</span>
                <p className={`text-sm font-medium ${carrier.is_insurance_expiring ? 'text-amber-600' : 'text-gray-900'}`}>
                  {carrier.is_insurance_expiring ? 'Expiring Soon' : carrier.insurance_expiration ? 'Current' : 'Unknown'}
                </p>
              </div>
            </div>
          </div>

          {/* Contacts */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Contacts</h3>
            {carrier.contacts && carrier.contacts.length > 0 ? (
              <ul className="space-y-3">
                {carrier.contacts.map((c, i) => (
                  <li key={i} className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 text-xs font-medium">
                      {c.name.charAt(0)}
                    </div>
                    <div>
                      <div className="text-sm font-medium">{c.name}</div>
                      <div className="text-xs text-gray-500">{c.role || c.email || ''}</div>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-gray-500">No contacts</p>
            )}
          </div>
        </div>
      )}

      {/* Compliance Tab */}
      {activeTab === 'compliance' && (
        <div className="space-y-6">
          {/* Compliance Status Summary */}
          {complianceSummary && (
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
              <div className={`rounded-lg border p-4 ${
                complianceSummary.overall_status === 'compliant' ? 'border-emerald-200 bg-emerald-50' :
                complianceSummary.overall_status === 'at_risk' ? 'border-amber-200 bg-amber-50' :
                'border-red-200 bg-red-50'
              }`}>
                <div className="flex items-center gap-2">
                  {(() => {
                    const cfg = complianceStatusColors[complianceSummary.overall_status]
                    const Icon = cfg?.icon || CheckCircle
                    return <Icon className={`h-5 w-5 ${cfg?.text || ''}`} />
                  })()}
                  <span className="text-sm font-medium">Overall Status</span>
                </div>
                <div className="mt-1 text-lg font-bold capitalize">
                  {complianceSummary.overall_status.replace(/_/g, ' ')}
                </div>
              </div>
              <div className="bg-white rounded-lg border border-gray-200 p-4">
                <div className="text-sm text-gray-500">Insurance Records</div>
                <div className="text-2xl font-bold">{complianceSummary.insurance_count}</div>
              </div>
              <div className="bg-white rounded-lg border border-gray-200 p-4">
                <div className="text-sm text-gray-500">Compliance Records</div>
                <div className="text-2xl font-bold">{complianceSummary.compliance_count}</div>
              </div>
              <div className="bg-white rounded-lg border border-gray-200 p-4">
                <div className="text-sm text-gray-500">Expiring Soon</div>
                <div className={`text-2xl font-bold ${complianceSummary.expiring_soon > 0 ? 'text-amber-600' : ''}`}>
                  {complianceSummary.expiring_soon}
                </div>
              </div>
            </div>
          )}

          {/* Issues */}
          {complianceSummary && complianceSummary.issues.length > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <h4 className="text-sm font-medium text-red-800 mb-2">Issues</h4>
              <ul className="space-y-1">
                {complianceSummary.issues.map((issue, i) => (
                  <li key={i} className="text-sm text-red-700 flex items-center gap-2">
                    <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0" />
                    {issue}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-900">Compliance Records</h3>
            <div className="flex items-center gap-2">
              <button
                onClick={handleRunComplianceCheck}
                disabled={runningCheck}
                className="flex items-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 text-sm disabled:opacity-50"
              >
                <RefreshCw className={`h-4 w-4 ${runningCheck ? 'animate-spin' : ''}`} />
                Run Check
              </button>
              <button
                onClick={() => setShowComplianceForm(true)}
                className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 text-sm"
              >
                <Plus className="h-4 w-4" />
                Add Record
              </button>
            </div>
          </div>

          {/* Check result */}
          {checkResult && (
            <div className="bg-white rounded-lg border border-gray-200 p-4 space-y-3">
              <h4 className="text-sm font-medium text-gray-900">Compliance Check Result</h4>
              {checkResult.issues.length > 0 && (
                <div>
                  <span className="text-xs font-medium text-red-700 uppercase">Issues</span>
                  <ul className="mt-1 space-y-1">
                    {checkResult.issues.map((issue, i) => (
                      <li key={i} className="text-sm text-red-600">{issue}</li>
                    ))}
                  </ul>
                </div>
              )}
              {checkResult.warnings.length > 0 && (
                <div>
                  <span className="text-xs font-medium text-amber-700 uppercase">Warnings</span>
                  <ul className="mt-1 space-y-1">
                    {checkResult.warnings.map((w, i) => (
                      <li key={i} className="text-sm text-amber-600">{w}</li>
                    ))}
                  </ul>
                </div>
              )}
              {checkResult.missing_records.length > 0 && (
                <div>
                  <span className="text-xs font-medium text-gray-700 uppercase">Missing Records</span>
                  <ul className="mt-1 space-y-1">
                    {checkResult.missing_records.map((m, i) => (
                      <li key={i} className="text-sm text-gray-600">{m}</li>
                    ))}
                  </ul>
                </div>
              )}
              {checkResult.issues.length === 0 && checkResult.warnings.length === 0 && checkResult.missing_records.length === 0 && (
                <p className="text-sm text-emerald-600 flex items-center gap-1">
                  <CheckCircle className="h-4 w-4" />
                  All compliance checks passed
                </p>
              )}
            </div>
          )}

          {/* Compliance form modal */}
          {showComplianceForm && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
              <div className="bg-white rounded-lg w-full max-w-lg mx-4">
                <div className="flex items-center justify-between p-4 border-b">
                  <h2 className="text-lg font-semibold">Add Compliance Record</h2>
                  <button onClick={() => setShowComplianceForm(false)} className="p-1 text-gray-400 hover:text-gray-600">
                    <X className="h-5 w-5" />
                  </button>
                </div>
                <form onSubmit={handleCreateCompliance} className="p-4 space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Type *</label>
                      <select value={complianceForm.compliance_type}
                        onChange={(e) => setComplianceForm({ ...complianceForm, compliance_type: e.target.value as any })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                      >
                        {Object.entries(COMPLIANCE_TYPE_LABELS).map(([val, label]) => (
                          <option key={val} value={val}>{label}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Status *</label>
                      <select value={complianceForm.status}
                        onChange={(e) => setComplianceForm({ ...complianceForm, status: e.target.value as any })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                      >
                        {Object.entries(COMPLIANCE_STATUS_LABELS).map(([val, label]) => (
                          <option key={val} value={val}>{label}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Details</label>
                    <textarea rows={2} value={complianceForm.details}
                      onChange={(e) => setComplianceForm({ ...complianceForm, details: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Expires At</label>
                    <input type="date" value={complianceForm.expires_at}
                      onChange={(e) => setComplianceForm({ ...complianceForm, expires_at: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                  <div className="flex gap-3 pt-2">
                    <button type="submit" className="flex-1 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700">
                      Add Record
                    </button>
                    <button type="button" onClick={() => setShowComplianceForm(false)} className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200">
                      Cancel
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* Compliance records table */}
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            {complianceRecords.length === 0 ? (
              <div className="p-8 text-center text-gray-500">No compliance records yet</div>
            ) : (
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Details</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Expires</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {complianceRecords.map((rec) => {
                    const statusCfg = complianceStatusColors[rec.status] || complianceStatusColors.pending
                    return (
                      <tr key={rec.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm font-medium text-gray-900">
                          {COMPLIANCE_TYPE_LABELS[rec.compliance_type] || rec.compliance_type}
                        </td>
                        <td className="px-4 py-3 text-sm">
                          <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${statusCfg.bg} ${statusCfg.text}`}>
                            {COMPLIANCE_STATUS_LABELS[rec.status] || rec.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">{rec.details || '-'}</td>
                        <td className="px-4 py-3 text-sm text-gray-600">
                          {rec.expires_at ? (
                            <span className={`flex items-center gap-1 ${
                              rec.days_until_expiry !== undefined && rec.days_until_expiry !== null && rec.days_until_expiry <= 30
                                ? (rec.days_until_expiry <= 0 ? 'text-red-600' : 'text-amber-600')
                                : ''
                            }`}>
                              <Calendar className="h-3.5 w-3.5" />
                              {new Date(rec.expires_at).toLocaleDateString()}
                              {rec.days_until_expiry !== undefined && rec.days_until_expiry !== null && (
                                <span className="text-xs ml-1">
                                  ({rec.days_until_expiry <= 0 ? 'Expired' : `${rec.days_until_expiry}d`})
                                </span>
                              )}
                            </span>
                          ) : '-'}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* Insurance Tab */}
      {activeTab === 'insurance' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-900">
              Insurance Policies ({insuranceRecords.length})
            </h3>
            <button
              onClick={() => setShowInsuranceForm(true)}
              className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 text-sm"
            >
              <Plus className="h-4 w-4" />
              Add Insurance
            </button>
          </div>

          {/* Insurance form modal */}
          {showInsuranceForm && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
              <div className="bg-white rounded-lg w-full max-w-lg mx-4">
                <div className="flex items-center justify-between p-4 border-b">
                  <h2 className="text-lg font-semibold">Add Insurance Policy</h2>
                  <button onClick={() => setShowInsuranceForm(false)} className="p-1 text-gray-400 hover:text-gray-600">
                    <X className="h-5 w-5" />
                  </button>
                </div>
                <form onSubmit={handleCreateInsurance} className="p-4 space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Type *</label>
                      <select value={insuranceForm.insurance_type}
                        onChange={(e) => setInsuranceForm({ ...insuranceForm, insurance_type: e.target.value as any })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                      >
                        {Object.entries(INSURANCE_TYPE_LABELS).map(([val, label]) => (
                          <option key={val} value={val}>{label}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Provider</label>
                      <input type="text" value={insuranceForm.provider}
                        onChange={(e) => setInsuranceForm({ ...insuranceForm, provider: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Policy Number</label>
                      <input type="text" value={insuranceForm.policy_number}
                        onChange={(e) => setInsuranceForm({ ...insuranceForm, policy_number: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Coverage (cents)</label>
                      <input type="number" value={insuranceForm.coverage_amount}
                        onChange={(e) => setInsuranceForm({ ...insuranceForm, coverage_amount: parseInt(e.target.value) || 0 })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Effective Date</label>
                      <input type="date" value={insuranceForm.effective_date}
                        onChange={(e) => setInsuranceForm({ ...insuranceForm, effective_date: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Expiry Date</label>
                      <input type="date" value={insuranceForm.expiry_date}
                        onChange={(e) => setInsuranceForm({ ...insuranceForm, expiry_date: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                      />
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <input type="checkbox" id="is_current" checked={insuranceForm.is_current}
                      onChange={(e) => setInsuranceForm({ ...insuranceForm, is_current: e.target.checked })}
                      className="rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
                    />
                    <label htmlFor="is_current" className="text-sm text-gray-700">Current policy</label>
                  </div>
                  <div className="flex gap-3 pt-2">
                    <button type="submit" className="flex-1 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700">
                      Add Insurance
                    </button>
                    <button type="button" onClick={() => setShowInsuranceForm(false)} className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200">
                      Cancel
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* Insurance cards */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {insuranceRecords.length === 0 ? (
              <div className="lg:col-span-2 bg-white rounded-lg border border-gray-200 p-8 text-center text-gray-500">
                No insurance records yet
              </div>
            ) : (
              insuranceRecords.map((ins) => {
                const isExpiring = ins.days_until_expiry !== undefined && ins.days_until_expiry !== null && ins.days_until_expiry >= 0 && ins.days_until_expiry <= 30
                const isExpired = ins.days_until_expiry !== undefined && ins.days_until_expiry !== null && ins.days_until_expiry < 0
                return (
                  <div key={ins.id} className={`bg-white rounded-lg border p-5 ${
                    isExpired ? 'border-red-200' : isExpiring ? 'border-amber-200' : 'border-gray-200'
                  }`}>
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="font-medium text-gray-900">
                            {INSURANCE_TYPE_LABELS[ins.insurance_type] || ins.insurance_type}
                          </h4>
                          {ins.is_current && (
                            <span className="px-1.5 py-0.5 text-xs bg-emerald-100 text-emerald-700 rounded">Current</span>
                          )}
                        </div>
                        {ins.provider && (
                          <p className="text-sm text-gray-600 mt-1">{ins.provider}</p>
                        )}
                      </div>
                      <div className="text-right">
                        <div className="text-lg font-bold text-gray-900">
                          {formatCurrency(ins.coverage_amount)}
                        </div>
                        <div className="text-xs text-gray-500">coverage</div>
                      </div>
                    </div>
                    <div className="mt-3 flex items-center justify-between text-sm">
                      {ins.policy_number && (
                        <span className="text-gray-500">Policy: {ins.policy_number}</span>
                      )}
                      {ins.expiry_date && (
                        <span className={`flex items-center gap-1 ${
                          isExpired ? 'text-red-600 font-medium' :
                          isExpiring ? 'text-amber-600 font-medium' :
                          'text-gray-500'
                        }`}>
                          <Calendar className="h-3.5 w-3.5" />
                          Expires: {new Date(ins.expiry_date).toLocaleDateString()}
                          {ins.days_until_expiry !== undefined && ins.days_until_expiry !== null && (
                            <span className="text-xs ml-1">
                              ({ins.days_until_expiry <= 0 ? 'EXPIRED' : `${ins.days_until_expiry}d`})
                            </span>
                          )}
                        </span>
                      )}
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>
      )}

      {/* Performance Tab */}
      {activeTab === 'performance' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <div className="text-sm font-medium text-gray-500">On-Time %</div>
              <div className="mt-1 text-3xl font-bold text-gray-900">
                {carrier.on_time_percentage !== undefined && carrier.on_time_percentage !== null
                  ? `${carrier.on_time_percentage.toFixed(1)}%`
                  : 'N/A'}
              </div>
              <div className="mt-1 text-xs text-gray-500">
                {carrier.on_time_percentage !== undefined && carrier.on_time_percentage !== null ? (
                  <div className="w-full bg-gray-200 rounded-full h-1.5 mt-2">
                    <div
                      className={`h-1.5 rounded-full ${
                        carrier.on_time_percentage >= 95 ? 'bg-emerald-500' :
                        carrier.on_time_percentage >= 90 ? 'bg-amber-500' :
                        'bg-red-500'
                      }`}
                      style={{ width: `${Math.min(carrier.on_time_percentage, 100)}%` }}
                    />
                  </div>
                ) : null}
              </div>
            </div>
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <div className="text-sm font-medium text-gray-500">Claims Rate</div>
              <div className="mt-1 text-3xl font-bold text-gray-900">
                {carrier.total_loads > 0
                  ? `${((carrier.claims_count / carrier.total_loads) * 100).toFixed(1)}%`
                  : 'N/A'}
              </div>
              <div className="text-xs text-gray-500 mt-1">
                {carrier.claims_count} claims / {carrier.total_loads} loads
              </div>
            </div>
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <div className="text-sm font-medium text-gray-500">Total Loads</div>
              <div className="mt-1 text-3xl font-bold text-gray-900">{carrier.total_loads}</div>
            </div>
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <div className="text-sm font-medium text-gray-500">Last Load</div>
              <div className="mt-1 text-xl font-bold text-gray-900">
                {(carrier as any).last_load_at
                  ? new Date((carrier as any).last_load_at).toLocaleDateString()
                  : 'Never'}
              </div>
            </div>
          </div>

          {/* Performance note */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Performance Overview</h3>
            <p className="text-sm text-gray-600">
              This carrier has completed {carrier.total_loads} loads with an on-time delivery rate of{' '}
              {carrier.on_time_percentage !== undefined && carrier.on_time_percentage !== null
                ? `${carrier.on_time_percentage.toFixed(1)}%`
                : 'N/A'}.
              {carrier.claims_count > 0 && ` There have been ${carrier.claims_count} claims filed.`}
            </p>
          </div>
        </div>
      )}

      {/* Load History Tab */}
      {activeTab === 'loads' && (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-gray-900">
            Load History ({shipments.length})
          </h3>
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            {shipments.length === 0 ? (
              <div className="p-8 text-center text-gray-500">No loads yet</div>
            ) : (
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Shipment #</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Origin</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Destination</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Carrier Cost</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Pickup</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {shipments.map((s) => (
                    <tr
                      key={s.id}
                      onClick={() => navigate(`/shipments/${s.id}`)}
                      className="hover:bg-gray-50 cursor-pointer"
                    >
                      <td className="px-4 py-3 text-sm font-medium text-emerald-600">{s.shipment_number}</td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {s.origin_city ? `${s.origin_city}, ${s.origin_state}` : '-'}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {s.destination_city ? `${s.destination_city}, ${s.destination_state}` : '-'}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${
                          s.status === 'delivered' ? 'bg-green-100 text-green-700' :
                          s.status === 'in_transit' ? 'bg-yellow-100 text-yellow-700' :
                          s.status === 'cancelled' ? 'bg-red-100 text-red-700' :
                          'bg-gray-100 text-gray-700'
                        }`}>
                          {s.status.replace(/_/g, ' ')}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900 text-right">{formatCurrency(s.carrier_cost)}</td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {s.pickup_date ? new Date(s.pickup_date).toLocaleDateString() : '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
