import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { api } from '../services/api'
import { apiExtensions } from '../services/api-extensions'
import type { Carrier, Shipment, DOTCompliance } from '../types'
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
  MapPin,
  DollarSign,
  MessageSquare,
  ClipboardList,
  Sparkles,
} from 'lucide-react'
import type {
  CapacityPosting,
  NegotiationHistory,
  NegotiationRecord,
} from '../types'

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

type Tab = 'overview' | 'compliance' | 'insurance' | 'performance' | 'loads' | 'capacity' | 'negotiations' | 'onboarding' | 'dot_compliance'

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

  // DOT Compliance state
  const [dotCompliance, setDotCompliance] = useState<DOTCompliance | null>(null)
  const [dotLoading, setDotLoading] = useState(false)
  const [dotCheckRunning, setDotCheckRunning] = useState(false)

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
    if (activeTab === 'dot_compliance') fetchDOTCompliance()
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

  const fetchDOTCompliance = async () => {
    if (!id) return
    setDotLoading(true)
    try {
      const data = await api.getDOTCompliance(id)
      setDotCompliance(data)
    } catch (error) {
      console.error('Failed to fetch DOT compliance:', error)
    } finally {
      setDotLoading(false)
    }
  }

  const handleRunDOTCheck = async () => {
    if (!id) return
    setDotCheckRunning(true)
    try {
      const data = await api.runDOTComplianceCheck(id)
      setDotCompliance(data)
    } catch (error) {
      console.error('Failed to run DOT check:', error)
    } finally {
      setDotCheckRunning(false)
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
    { key: 'capacity', label: 'Capacity', icon: MapPin },
    { key: 'negotiations', label: 'Negotiations', icon: DollarSign },
    { key: 'dot_compliance', label: 'DOT/FMCSA', icon: Sparkles },
    { key: 'onboarding', label: 'Onboarding', icon: ClipboardList },
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

      {/* Capacity Tab */}
      {activeTab === 'capacity' && (
        <CarrierCapacityTab carrierId={id!} />
      )}

      {/* Negotiations Tab */}
      {activeTab === 'negotiations' && (
        <CarrierNegotiationsTab carrierId={id!} />
      )}

      {/* Onboarding Tab */}
      {activeTab === 'onboarding' && (
        <div className="bg-white rounded-lg border border-gray-200 p-8 text-center text-gray-500">
          <ClipboardList className="h-12 w-12 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-900 font-medium">Carrier Onboarding</p>
          <p className="text-sm text-gray-400 mt-2">Onboarding dashboard coming soon</p>
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
      {/* DOT/FMCSA Compliance Tab */}
      {activeTab === 'dot_compliance' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">DOT/FMCSA Compliance</h3>
              <p className="text-sm text-gray-500">Federal safety ratings, CSA scores, and compliance tracking</p>
            </div>
            <button
              onClick={handleRunDOTCheck}
              disabled={dotCheckRunning}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm disabled:opacity-50"
            >
              <RefreshCw className={`h-4 w-4 ${dotCheckRunning ? 'animate-spin' : ''}`} />
              {dotCheckRunning ? 'Checking...' : 'Run DOT Check'}
            </button>
          </div>

          {dotLoading ? (
            <div className="py-8 text-center text-gray-500">
              <div className="animate-spin h-6 w-6 border-2 border-indigo-500 border-t-transparent rounded-full mx-auto mb-2" />
              Loading DOT compliance data...
            </div>
          ) : !dotCompliance ? (
            <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
              <Shield className="h-12 w-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500">No DOT compliance data available</p>
              <p className="text-sm text-gray-400 mt-2">Click &quot;Run DOT Check&quot; to fetch FMCSA data for this carrier</p>
            </div>
          ) : (
            <>
              {/* Overall Score and Status */}
              <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
                <div className={`rounded-lg border p-5 ${
                  dotCompliance.overall_compliance_score >= 80 ? 'border-emerald-200 bg-emerald-50' :
                  dotCompliance.overall_compliance_score >= 60 ? 'border-amber-200 bg-amber-50' :
                  'border-red-200 bg-red-50'
                }`}>
                  <div className="text-sm font-medium text-gray-600">Overall Score</div>
                  <div className={`text-3xl font-bold mt-1 ${
                    dotCompliance.overall_compliance_score >= 80 ? 'text-emerald-600' :
                    dotCompliance.overall_compliance_score >= 60 ? 'text-amber-600' : 'text-red-600'
                  }`}>
                    {dotCompliance.overall_compliance_score}/100
                  </div>
                  <div className="mt-2 h-2 bg-white/50 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${
                        dotCompliance.overall_compliance_score >= 80 ? 'bg-emerald-500' :
                        dotCompliance.overall_compliance_score >= 60 ? 'bg-amber-500' : 'bg-red-500'
                      }`}
                      style={{ width: `${dotCompliance.overall_compliance_score}%` }}
                    />
                  </div>
                </div>

                <div className="bg-white rounded-lg border border-gray-200 p-5">
                  <div className="text-sm font-medium text-gray-500">FMCSA Safety Rating</div>
                  <div className="text-2xl font-bold text-gray-900 mt-1">
                    {dotCompliance.fmcsa_safety_rating || 'Not Rated'}
                  </div>
                  <div className="text-xs text-gray-400 mt-1">
                    Status: {dotCompliance.fmcsa_status || 'Unknown'}
                  </div>
                </div>

                <div className="bg-white rounded-lg border border-gray-200 p-5">
                  <div className="text-sm font-medium text-gray-500">Operating Status</div>
                  <div className={`text-2xl font-bold mt-1 ${
                    dotCompliance.operating_status === 'Authorized' ? 'text-emerald-600' : 'text-red-600'
                  }`}>
                    {dotCompliance.operating_status || 'Unknown'}
                  </div>
                  <div className="text-xs text-gray-400 mt-1">
                    Authority: {dotCompliance.authority_status || 'Unknown'}
                  </div>
                </div>

                <div className="bg-white rounded-lg border border-gray-200 p-5">
                  <div className="text-sm font-medium text-gray-500">Insurance on File</div>
                  <div className={`text-2xl font-bold mt-1 ${
                    dotCompliance.insurance_on_file ? 'text-emerald-600' : 'text-red-600'
                  }`}>
                    {dotCompliance.insurance_on_file ? 'Yes' : 'No'}
                  </div>
                  {dotCompliance.dot_number && (
                    <div className="text-xs text-gray-400 mt-1">DOT# {dotCompliance.dot_number}</div>
                  )}
                </div>
              </div>

              {/* CSA Scores */}
              {dotCompliance.csa_scores && Object.keys(dotCompliance.csa_scores).length > 0 && (
                <div className="bg-white rounded-lg border border-gray-200 p-6">
                  <h4 className="text-sm font-semibold text-gray-900 uppercase tracking-wide mb-4">CSA BASIC Scores</h4>
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    {Object.entries(dotCompliance.csa_scores).map(([category, score]) => {
                      const threshold = category === 'HOS Compliance' ? 65 :
                                        category === 'Unsafe Driving' ? 65 :
                                        category === 'Crash Indicator' ? 65 :
                                        category === 'Vehicle Maintenance' ? 80 :
                                        category === 'Driver Fitness' ? 80 :
                                        category === 'Controlled Substances' ? 80 : 75
                      const isAbove = score > threshold
                      return (
                        <div key={category} className={`rounded-lg p-4 border ${
                          isAbove ? 'border-red-200 bg-red-50' : 'border-gray-200'
                        }`}>
                          <div className="text-xs font-medium text-gray-500 mb-1">{category}</div>
                          <div className={`text-2xl font-bold ${
                            isAbove ? 'text-red-600' : score > threshold * 0.7 ? 'text-amber-600' : 'text-emerald-600'
                          }`}>
                            {score}
                          </div>
                          <div className="mt-1 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full ${
                                isAbove ? 'bg-red-500' : score > threshold * 0.7 ? 'bg-amber-500' : 'bg-emerald-500'
                              }`}
                              style={{ width: `${Math.min(score, 100)}%` }}
                            />
                          </div>
                          <div className="text-xs text-gray-400 mt-1">Threshold: {threshold}</div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Safety & Operations Grid */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Drug Testing & HOS */}
                <div className="bg-white rounded-lg border border-gray-200 p-6">
                  <h4 className="text-sm font-semibold text-gray-900 uppercase tracking-wide mb-4">Driver Safety</h4>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">Drug Testing Enrolled</span>
                      <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${
                        dotCompliance.drug_testing_enrolled ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
                      }`}>
                        {dotCompliance.drug_testing_enrolled ? 'Yes' : 'No'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">Drug Testing Compliant</span>
                      <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${
                        dotCompliance.drug_testing_compliant ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
                      }`}>
                        {dotCompliance.drug_testing_compliant ? 'Compliant' : 'Non-Compliant'}
                      </span>
                    </div>
                    {dotCompliance.drug_testing_last_test && (
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-600">Last Test Date</span>
                        <span className="text-sm font-medium text-gray-900">
                          {new Date(dotCompliance.drug_testing_last_test).toLocaleDateString()}
                        </span>
                      </div>
                    )}
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">HOS Violations</span>
                      <span className={`text-sm font-bold ${
                        dotCompliance.hos_violation_count > 0 ? 'text-red-600' : 'text-emerald-600'
                      }`}>
                        {dotCompliance.hos_violation_count}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Inspections & Crashes */}
                <div className="bg-white rounded-lg border border-gray-200 p-6">
                  <h4 className="text-sm font-semibold text-gray-900 uppercase tracking-wide mb-4">Inspection History</h4>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">Total Inspections</span>
                      <span className="text-sm font-bold text-gray-900">{dotCompliance.inspection_count}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">Out-of-Service Rate</span>
                      <span className={`text-sm font-bold ${
                        dotCompliance.out_of_service_rate > 25 ? 'text-red-600' :
                        dotCompliance.out_of_service_rate > 15 ? 'text-amber-600' : 'text-emerald-600'
                      }`}>
                        {dotCompliance.out_of_service_rate.toFixed(1)}%
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">Crash Count</span>
                      <span className={`text-sm font-bold ${
                        dotCompliance.crash_count > 0 ? 'text-red-600' : 'text-emerald-600'
                      }`}>
                        {dotCompliance.crash_count}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Compliance Alerts */}
              {dotCompliance.compliance_alerts && dotCompliance.compliance_alerts.length > 0 && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-5">
                  <h4 className="text-sm font-semibold text-red-800 flex items-center gap-2 mb-3">
                    <AlertTriangle className="h-4 w-4 text-red-600" />
                    Compliance Alerts ({dotCompliance.compliance_alerts.length})
                  </h4>
                  <ul className="space-y-2">
                    {dotCompliance.compliance_alerts.map((alert, idx) => (
                      <li key={idx} className="text-sm text-red-700 flex items-start gap-2">
                        <XCircle className="h-4 w-4 text-red-500 flex-shrink-0 mt-0.5" />
                        {alert}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Last Checked */}
              {dotCompliance.last_checked_at && (
                <div className="text-xs text-gray-400 text-right">
                  Last checked: {new Date(dotCompliance.last_checked_at).toLocaleString()}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}


// ============================================================================
// Carrier Capacity Tab Component
// ============================================================================

function CarrierCapacityTab({ carrierId }: { carrierId: string }) {
  const [capacityPostings, setCapacityPostings] = useState<CapacityPosting[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({
    equipment_type: 'van',
    truck_count: 1,
    available_date: '',
    origin_city: '',
    origin_state: '',
    destination_city: '',
    destination_state: '',
    notes: '',
    rate_per_mile_target: '',
    expires_hours: 48,
  })

  useEffect(() => {
    fetchCapacity()
  }, [carrierId])

  const fetchCapacity = async () => {
    try {
      const data = await api.getAvailableCapacity()
      setCapacityPostings(data.filter((c: CapacityPosting) => c.carrier_id === carrierId))
    } catch (error) {
      console.error('Failed to fetch capacity:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      await api.postCarrierCapacity(carrierId, {
        equipment_type: form.equipment_type,
        truck_count: form.truck_count,
        available_date: form.available_date || undefined,
        origin_city: form.origin_city || undefined,
        origin_state: form.origin_state || undefined,
        destination_city: form.destination_city || undefined,
        destination_state: form.destination_state || undefined,
        notes: form.notes || undefined,
        rate_per_mile_target: form.rate_per_mile_target ? parseFloat(form.rate_per_mile_target) : undefined,
        expires_hours: form.expires_hours,
      })
      setShowForm(false)
      fetchCapacity()
    } catch (error) {
      console.error('Failed to post capacity:', error)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Available Capacity</h3>
          <p className="text-sm text-gray-500">Track and post available trucks for this carrier</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 text-sm"
        >
          <Plus className="h-4 w-4" />
          Post Capacity
        </button>
      </div>

      {/* Capacity Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg w-full max-w-lg mx-4">
            <div className="flex items-center justify-between p-4 border-b">
              <h2 className="text-lg font-semibold">Post Available Capacity</h2>
              <button onClick={() => setShowForm(false)} className="p-1 text-gray-400 hover:text-gray-600">
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-4 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Equipment Type</label>
                  <select value={form.equipment_type} onChange={(e) => setForm({ ...form, equipment_type: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500">
                    <option value="van">Dry Van</option>
                    <option value="reefer">Reefer</option>
                    <option value="flatbed">Flatbed</option>
                    <option value="step_deck">Step Deck</option>
                    <option value="power_only">Power Only</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Truck Count</label>
                  <input type="number" min={1} value={form.truck_count}
                    onChange={(e) => setForm({ ...form, truck_count: parseInt(e.target.value) || 1 })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Origin City</label>
                  <input type="text" value={form.origin_city} onChange={(e) => setForm({ ...form, origin_city: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500" placeholder="e.g., Chicago" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Origin State</label>
                  <input type="text" value={form.origin_state} onChange={(e) => setForm({ ...form, origin_state: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500" placeholder="e.g., IL" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Destination City</label>
                  <input type="text" value={form.destination_city} onChange={(e) => setForm({ ...form, destination_city: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500" placeholder="e.g., Dallas" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Destination State</label>
                  <input type="text" value={form.destination_state} onChange={(e) => setForm({ ...form, destination_state: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500" placeholder="e.g., TX" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Available Date</label>
                  <input type="date" value={form.available_date} onChange={(e) => setForm({ ...form, available_date: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Target Rate/Mile ($)</label>
                  <input type="number" step="0.01" value={form.rate_per_mile_target}
                    onChange={(e) => setForm({ ...form, rate_per_mile_target: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500" placeholder="e.g., 2.50" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                <textarea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500" />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="submit" className="flex-1 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700">
                  Post Capacity
                </button>
                <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200">
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Capacity Cards */}
      {loading ? (
        <div className="text-center py-8 text-gray-500">Loading...</div>
      ) : capacityPostings.length === 0 ? (
        <div className="bg-white rounded-lg border border-gray-200 p-8 text-center text-gray-500">
          <Truck className="h-8 w-8 mx-auto mb-2 text-gray-400" />
          <p>No capacity postings for this carrier</p>
          <p className="text-xs mt-1">Post available trucks to match with open loads</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {capacityPostings.map((cp) => (
            <div key={cp.id} className="bg-white rounded-lg border border-gray-200 p-5">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 text-xs font-medium bg-blue-100 text-blue-700 rounded">
                      {cp.equipment_type}
                    </span>
                    <span className="text-sm font-medium text-gray-900">{cp.truck_count} truck{cp.truck_count > 1 ? 's' : ''}</span>
                  </div>
                  <div className="mt-2 text-sm text-gray-600">
                    {cp.origin_city && cp.origin_state
                      ? `${cp.origin_city}, ${cp.origin_state}`
                      : cp.origin_state || 'Any origin'}
                    {' -> '}
                    {cp.destination_city && cp.destination_state
                      ? `${cp.destination_city}, ${cp.destination_state}`
                      : cp.destination_state || 'Any destination'}
                  </div>
                </div>
                <div className="text-right">
                  {cp.ai_matched_loads > 0 && (
                    <div className="flex items-center gap-1 text-emerald-600 text-xs font-medium">
                      <CheckCircle className="h-3.5 w-3.5" />
                      {cp.ai_matched_loads} matching loads
                    </div>
                  )}
                  {cp.rate_per_mile_target && (
                    <div className="text-sm font-medium text-gray-900 mt-1">
                      ${cp.rate_per_mile_target}/mi
                    </div>
                  )}
                </div>
              </div>
              {cp.notes && <p className="mt-2 text-xs text-gray-500">{cp.notes}</p>}
              <div className="mt-3 flex items-center justify-between text-xs text-gray-400">
                <span>{cp.available_date ? `Available: ${new Date(cp.available_date).toLocaleDateString()}` : ''}</span>
                <span>{cp.expires_at ? `Expires: ${new Date(cp.expires_at).toLocaleDateString()}` : ''}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}


// ============================================================================
// Carrier Negotiations Tab Component
// ============================================================================

function CarrierNegotiationsTab({ carrierId }: { carrierId: string }) {
  const [history, setHistory] = useState<NegotiationHistory | null>(null)
  const [selectedNegotiation, setSelectedNegotiation] = useState<NegotiationRecord | null>(null)
  const [counterOfferRate, setCounterOfferRate] = useState('')
  const [counterOfferNotes, setCounterOfferNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchHistory()
  }, [carrierId])

  const fetchHistory = async () => {
    try {
      const data = await api.getNegotiationHistory({ carrier_id: carrierId })
      setHistory(data)
    } catch (error) {
      console.error('Failed to fetch negotiation history:', error)
    } finally {
      setLoading(false)
    }
  }

  const formatCurrency = (cents: number) => `$${(cents / 100).toLocaleString('en-US', { minimumFractionDigits: 2 })}`

  const handleSubmitCounterOffer = async (tenderId: string) => {
    if (!counterOfferRate) return
    setSubmitting(true)
    try {
      await api.createCounterOffer(tenderId, {
        counter_rate: Math.round(parseFloat(counterOfferRate) * 100),
        notes: counterOfferNotes || undefined,
      })
      setCounterOfferRate('')
      setCounterOfferNotes('')
      fetchHistory()
    } catch (error) {
      console.error('Failed to submit counter-offer:', error)
    } finally {
      setSubmitting(false)
    }
  }

  const handleAcceptCounter = async (tenderId: string) => {
    try {
      await api.acceptCounterOffer(tenderId)
      fetchHistory()
      setSelectedNegotiation(null)
    } catch (error) {
      console.error('Failed to accept counter-offer:', error)
    }
  }

  if (loading) return <div className="text-center py-8 text-gray-500">Loading...</div>
  if (!history) return <div className="text-center py-8 text-gray-500">Failed to load negotiations</div>

  return (
    <div className="space-y-6">
      {/* Summary Stats */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="text-sm text-gray-500">Total Negotiations</div>
          <div className="text-2xl font-bold text-gray-900">{history.total_negotiations}</div>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="text-sm text-gray-500">Accepted</div>
          <div className="text-2xl font-bold text-emerald-600">{history.accepted_count}</div>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="text-sm text-gray-500">Avg Negotiation Rounds</div>
          <div className="text-2xl font-bold text-gray-900">{history.average_rounds.toFixed(1)}</div>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="text-sm text-gray-500">Total Savings</div>
          <div className="text-2xl font-bold text-blue-600">{formatCurrency(history.total_savings_cents)}</div>
        </div>
      </div>

      {/* Negotiation Records */}
      <h3 className="text-lg font-semibold text-gray-900">Rate Negotiation History</h3>
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        {history.negotiations.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            <MessageSquare className="h-8 w-8 mx-auto mb-2 text-gray-400" />
            <p>No negotiation history for this carrier</p>
          </div>
        ) : (
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Lane</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Offered Rate</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Counter</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Final</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Rounds</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {history.negotiations.map((n) => (
                <tr key={n.tender_id} className="hover:bg-gray-50 cursor-pointer" onClick={() => setSelectedNegotiation(selectedNegotiation?.tender_id === n.tender_id ? null : n)}>
                  <td className="px-4 py-3 text-sm">
                    <div className="font-medium text-gray-900">{n.lane || '-'}</div>
                    <div className="text-xs text-gray-500">{n.origin} - {n.destination}</div>
                  </td>
                  <td className="px-4 py-3 text-sm">
                    <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${
                      n.status === 'accepted' ? 'bg-emerald-100 text-emerald-700' :
                      n.status === 'declined' ? 'bg-red-100 text-red-700' :
                      n.status === 'sent' ? 'bg-blue-100 text-blue-700' :
                      'bg-gray-100 text-gray-700'
                    }`}>
                      {n.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-right text-gray-900">{formatCurrency(n.offered_rate)}</td>
                  <td className="px-4 py-3 text-sm text-right text-amber-600">
                    {n.counter_offer_rate ? formatCurrency(n.counter_offer_rate) : '-'}
                  </td>
                  <td className="px-4 py-3 text-sm text-right font-medium text-gray-900">
                    {n.final_rate ? formatCurrency(n.final_rate) : '-'}
                  </td>
                  <td className="px-4 py-3 text-sm text-center">
                    {n.negotiation_rounds > 0 ? (
                      <span className="px-2 py-0.5 text-xs bg-gray-100 text-gray-700 rounded">
                        {n.negotiation_rounds}
                      </span>
                    ) : '-'}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500">
                    {n.created_at ? new Date(n.created_at).toLocaleDateString() : '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Counter-Offer Thread Detail Panel */}
      {selectedNegotiation && (
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h4 className="text-lg font-semibold text-gray-900">Negotiation Thread</h4>
              <p className="text-sm text-gray-500">
                {selectedNegotiation.lane || `${selectedNegotiation.origin} - ${selectedNegotiation.destination}`}
                {' '}&middot; {selectedNegotiation.carrier_name}
              </p>
            </div>
            <button onClick={() => setSelectedNegotiation(null)} className="p-1 text-gray-400 hover:text-gray-600">
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Thread Timeline */}
          <div className="space-y-4 mb-6">
            {/* Initial Offer */}
            <div className="flex gap-3">
              <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                <DollarSign className="h-4 w-4 text-blue-600" />
              </div>
              <div className="flex-1 bg-blue-50 rounded-lg p-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-blue-900">Initial Offer (Broker)</span>
                  <span className="text-xs text-blue-600">{selectedNegotiation.created_at ? new Date(selectedNegotiation.created_at).toLocaleString() : ''}</span>
                </div>
                <div className="text-lg font-bold text-blue-900 mt-1">{formatCurrency(selectedNegotiation.offered_rate)}</div>
              </div>
            </div>

            {/* Counter-Offers Thread */}
            {selectedNegotiation.counter_offers && selectedNegotiation.counter_offers.map((co, idx) => (
              <div key={co.id || idx} className="flex gap-3">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${co.offered_by === 'carrier' ? 'bg-amber-100' : 'bg-blue-100'}`}>
                  <MessageSquare className={`h-4 w-4 ${co.offered_by === 'carrier' ? 'text-amber-600' : 'text-blue-600'}`} />
                </div>
                <div className={`flex-1 rounded-lg p-3 ${co.offered_by === 'carrier' ? 'bg-amber-50' : 'bg-blue-50'}`}>
                  <div className="flex items-center justify-between">
                    <span className={`text-sm font-medium ${co.offered_by === 'carrier' ? 'text-amber-900' : 'text-blue-900'}`}>
                      Round {co.round_number} Counter ({co.offered_by === 'carrier' ? 'Carrier' : 'Broker'})
                    </span>
                    <div className="flex items-center gap-2">
                      {co.auto_accepted && (
                        <span className="text-xs bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded">Auto-Accepted</span>
                      )}
                      <span className={`text-xs px-1.5 py-0.5 rounded ${
                        co.status === 'accepted' ? 'bg-emerald-100 text-emerald-700' :
                        co.status === 'rejected' ? 'bg-red-100 text-red-700' :
                        'bg-gray-100 text-gray-700'
                      }`}>{co.status}</span>
                      <span className="text-xs text-gray-500">{co.created_at ? new Date(co.created_at).toLocaleString() : ''}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 mt-1">
                    <div>
                      <span className="text-xs text-gray-500">Was: </span>
                      <span className="text-sm text-gray-500 line-through">{formatCurrency(co.original_rate)}</span>
                    </div>
                    <div>
                      <span className="text-xs text-gray-500">Counter: </span>
                      <span className={`text-lg font-bold ${co.offered_by === 'carrier' ? 'text-amber-900' : 'text-blue-900'}`}>{formatCurrency(co.counter_rate)}</span>
                    </div>
                  </div>
                  {co.notes && <p className="text-sm text-gray-600 mt-1">{co.notes}</p>}
                </div>
              </div>
            ))}

            {/* Final Rate */}
            {selectedNegotiation.final_rate && (
              <div className="flex gap-3">
                <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0">
                  <CheckCircle className="h-4 w-4 text-emerald-600" />
                </div>
                <div className="flex-1 bg-emerald-50 rounded-lg p-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-emerald-900">Final Agreed Rate</span>
                    <span className="text-xs text-emerald-600">{selectedNegotiation.responded_at ? new Date(selectedNegotiation.responded_at).toLocaleString() : ''}</span>
                  </div>
                  <div className="text-lg font-bold text-emerald-900 mt-1">{formatCurrency(selectedNegotiation.final_rate)}</div>
                  <div className="text-xs text-emerald-700 mt-1">
                    Savings: {formatCurrency(Math.abs(selectedNegotiation.offered_rate - selectedNegotiation.final_rate))}
                    {' '}({((Math.abs(selectedNegotiation.offered_rate - selectedNegotiation.final_rate) / selectedNegotiation.offered_rate) * 100).toFixed(1)}%)
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* New Counter-Offer Form (only for active negotiations) */}
          {selectedNegotiation.status === 'sent' && (
            <div className="border-t border-gray-200 pt-4">
              <h5 className="text-sm font-medium text-gray-900 mb-3">Submit Counter-Offer</h5>
              <div className="flex items-end gap-3">
                <div className="flex-1">
                  <label className="block text-xs text-gray-500 mb-1">Counter Rate ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={counterOfferRate}
                    onChange={(e) => setCounterOfferRate(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 text-sm"
                    placeholder="e.g., 2500.00"
                  />
                </div>
                <div className="flex-1">
                  <label className="block text-xs text-gray-500 mb-1">Notes (optional)</label>
                  <input
                    type="text"
                    value={counterOfferNotes}
                    onChange={(e) => setCounterOfferNotes(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 text-sm"
                    placeholder="Reason for counter..."
                  />
                </div>
                <button
                  onClick={() => handleSubmitCounterOffer(selectedNegotiation.tender_id)}
                  disabled={submitting || !counterOfferRate}
                  className="px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 disabled:opacity-50 text-sm whitespace-nowrap"
                >
                  {submitting ? <RefreshCw className="h-4 w-4 animate-spin" /> : 'Send Counter'}
                </button>
                <button
                  onClick={() => handleAcceptCounter(selectedNegotiation.tender_id)}
                  disabled={submitting}
                  className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 text-sm whitespace-nowrap"
                >
                  Accept
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
