import { useEffect, useState } from 'react'
import { api } from '../services/api'
import PageHelp from '../components/PageHelp'
import {
  DollarSign,
  Plus,
  Search,
  Loader2,
  FileText,
  AlertTriangle,
  Calendar,
  Trash2,
  ChevronDown,
  ChevronUp,
  Upload,
  Clock,
  Table,
  Edit3,
} from 'lucide-react'

// ============================================================================
// Types (local to this page)
// ============================================================================

interface LaneRateItem {
  origin_state: string
  dest_state: string
  equipment_type: string
  min_weight?: number
  max_weight?: number
  rate_per_mile?: number
  flat_rate?: number
  fuel_surcharge_pct: number
  min_charge?: number
  notes?: string
}

interface RateTableItem {
  id: string
  customer_id: string
  name: string
  description?: string
  effective_date: string
  expiry_date?: string
  is_active: boolean
  lanes: LaneRateItem[]
  lane_count: number
  currency: string
  created_by?: string
  is_expired: boolean
  created_at: string
  updated_at: string
  customer_name?: string
}

interface RateLookupResultItem {
  rate_table_id: string
  rate_table_name: string
  customer_id: string
  customer_name?: string
  origin_state: string
  dest_state: string
  equipment_type: string
  rate_per_mile?: number
  flat_rate?: number
  fuel_surcharge_pct: number
  min_charge?: number
  effective_date: string
  expiry_date?: string
  notes?: string
}

interface ExpiringContractItem {
  id: string
  name: string
  customer_id: string
  customer_name?: string
  effective_date: string
  expiry_date: string
  days_until_expiry: number
  lane_count: number
  is_active: boolean
}

// ============================================================================
// Constants
// ============================================================================

const US_STATES = [
  'AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA','KS',
  'KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ','NM','NY',
  'NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT','VA','WA','WV',
  'WI','WY',
]

const EQUIPMENT_TYPES = [
  { value: 'van', label: 'Dry Van' },
  { value: 'reefer', label: 'Reefer' },
  { value: 'flatbed', label: 'Flatbed' },
  { value: 'step_deck', label: 'Step Deck' },
  { value: 'lowboy', label: 'Lowboy' },
  { value: 'power_only', label: 'Power Only' },
  { value: 'container', label: 'Container' },
]

interface CustomerPricingRuleItem {
  rule_name: string
  discount_percent: number
  volume_discount_tiers: { min_shipments: number; discount_pct: number }[]
  contract_rate_per_mile?: number
  contract_flat_rate?: number
  fuel_surcharge_override?: number
  min_margin_percent: number
  auto_apply: boolean
  notes?: string
}

type TabId = 'tables' | 'lookup' | 'expiring' | 'customer-pricing'

// ============================================================================
// Component
// ============================================================================

export default function RateManagement() {
  const [activeTab, setActiveTab] = useState<TabId>('tables')
  const [loading, setLoading] = useState(true)

  // Rate Tables state
  const [rateTables, setRateTables] = useState<RateTableItem[]>([])
  const [expandedTable, setExpandedTable] = useState<string | null>(null)
  const [showTableForm, setShowTableForm] = useState(false)
  const [editingTable, setEditingTable] = useState<RateTableItem | null>(null)
  const [includeExpired, setIncludeExpired] = useState(false)

  // Rate Lookup state
  const [lookupOrigin, setLookupOrigin] = useState('')
  const [lookupDest, setLookupDest] = useState('')
  const [lookupEquipment, setLookupEquipment] = useState('van')
  const [lookupWeight, setLookupWeight] = useState('')
  const [lookupCustomerId, setLookupCustomerId] = useState('')
  const [lookupResults, setLookupResults] = useState<RateLookupResultItem[] | null>(null)
  const [lookupLoading, setLookupLoading] = useState(false)

  // Expiring Contracts state
  const [expiringContracts, setExpiringContracts] = useState<ExpiringContractItem[]>([])
  const [expiryDays, setExpiryDays] = useState(30)

  // Bulk import state
  const [showBulkImport, setShowBulkImport] = useState<string | null>(null)
  const [bulkCsv, setBulkCsv] = useState('')

  // Customers for forms
  const [customers, setCustomers] = useState<{ id: string; name: string }[]>([])

  useEffect(() => {
    fetchCustomers()
  }, [])

  useEffect(() => {
    fetchData()
  }, [activeTab, includeExpired, expiryDays])

  const fetchCustomers = async () => {
    try {
      const data = await api.getCustomers()
      setCustomers(data.map((c: { id: string; name: string }) => ({ id: c.id, name: c.name })))
    } catch (error) {
      console.error('Failed to fetch customers:', error)
    }
  }

  const fetchData = async () => {
    setLoading(true)
    try {
      if (activeTab === 'tables') {
        const data = await api.getRateTables({ include_expired: includeExpired })
        setRateTables(data)
      } else if (activeTab === 'expiring') {
        const data = await api.getExpiringContracts(expiryDays)
        setExpiringContracts(data)
      }
    } catch (error) {
      console.error('Failed to fetch rate data:', error)
    } finally {
      setLoading(false)
    }
  }

  // ============================================================================
  // Rate Table Actions
  // ============================================================================

  const handleSaveTable = async (formData: Record<string, unknown>) => {
    try {
      if (editingTable) {
        await api.updateRateTable(editingTable.id, formData)
      } else {
        await api.createRateTable(formData)
      }
      setShowTableForm(false)
      setEditingTable(null)
      await fetchData()
    } catch (error) {
      console.error('Failed to save rate table:', error)
    }
  }

  const handleDeleteTable = async (tableId: string) => {
    if (!confirm('Delete this rate table?')) return
    try {
      await api.deleteRateTable(tableId)
      await fetchData()
    } catch (error) {
      console.error('Failed to delete rate table:', error)
    }
  }

  // ============================================================================
  // Rate Lookup
  // ============================================================================

  const handleLookup = async () => {
    if (!lookupOrigin || !lookupDest) return
    setLookupLoading(true)
    try {
      const results = await api.rateLookup({
        origin_state: lookupOrigin,
        dest_state: lookupDest,
        equipment_type: lookupEquipment,
        weight_lbs: lookupWeight ? parseInt(lookupWeight) : undefined,
        customer_id: lookupCustomerId || undefined,
      })
      setLookupResults(results)
    } catch (error) {
      console.error('Rate lookup failed:', error)
    } finally {
      setLookupLoading(false)
    }
  }

  // ============================================================================
  // Bulk Import
  // ============================================================================

  const handleBulkImport = async (tableId: string) => {
    if (!bulkCsv.trim()) return
    try {
      // Parse CSV: origin_state,dest_state,equipment_type,rate_per_mile,flat_rate,fuel_surcharge_pct,min_charge
      const lines = bulkCsv.trim().split('\n')
      const lanes = lines
        .filter((line) => line.trim() && !line.startsWith('#'))
        .map((line) => {
          const parts = line.split(',').map((p) => p.trim())
          return {
            origin_state: parts[0] || '',
            dest_state: parts[1] || '',
            equipment_type: parts[2] || 'van',
            rate_per_mile: parts[3] ? parseInt(parts[3]) : undefined,
            flat_rate: parts[4] ? parseInt(parts[4]) : undefined,
            fuel_surcharge_pct: parts[5] ? parseFloat(parts[5]) : 0,
            min_charge: parts[6] ? parseInt(parts[6]) : undefined,
          }
        })
      await api.bulkImportLanes(tableId, { lanes })
      setBulkCsv('')
      setShowBulkImport(null)
      await fetchData()
    } catch (error) {
      console.error('Bulk import failed:', error)
    }
  }

  // ============================================================================
  // Formatters
  // ============================================================================

  const formatCents = (cents?: number) => {
    if (cents == null) return '-'
    return `$${(cents / 100).toFixed(2)}`
  }

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '-'
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  }

  // ============================================================================
  // Render
  // ============================================================================

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <DollarSign className="h-7 w-7 text-teal-600" />
            Rate Management
            <PageHelp pageId="rate-tables" />
          </h1>
          <p className="text-gray-500">
            Manage contract rate tables, lookup rates, and track expiring contracts
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200">
        {([
          { id: 'tables' as const, label: 'Rate Tables', icon: Table },
          { id: 'customer-pricing' as const, label: 'Customer Pricing', icon: DollarSign },
          { id: 'lookup' as const, label: 'Rate Lookup', icon: Search },
          { id: 'expiring' as const, label: 'Expiring Contracts', icon: Clock },
        ] as const).map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab.id
                ? 'border-teal-600 text-teal-700'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <tab.icon className="h-4 w-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {loading && activeTab !== 'lookup' ? (
        <div className="p-12 text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-gray-400" />
          <p className="text-gray-500 mt-2">Loading rate data...</p>
        </div>
      ) : (
        <>
          {/* ============================================================ */}
          {/* Rate Tables Tab */}
          {/* ============================================================ */}
          {activeTab === 'tables' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 text-sm text-gray-500">
                  <input
                    type="checkbox"
                    checked={includeExpired}
                    onChange={(e) => setIncludeExpired(e.target.checked)}
                    className="rounded"
                  />
                  Include expired
                </label>
                <button
                  onClick={() => { setEditingTable(null); setShowTableForm(true) }}
                  className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700"
                >
                  <Plus className="h-4 w-4" />
                  New Rate Table
                </button>
              </div>

              {rateTables.length === 0 ? (
                <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
                  <Table className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-900 font-medium">No rate tables found</p>
                  <p className="text-gray-500 mt-1">Create a rate table to manage contracted rates</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {rateTables.map((table) => (
                    <div key={table.id} className={`bg-white rounded-xl border ${table.is_expired ? 'border-red-200' : 'border-gray-200'}`}>
                      <div className="p-5">
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-4">
                            <div className={`p-3 rounded-lg ${table.is_expired ? 'bg-red-100' : table.is_active ? 'bg-teal-100' : 'bg-gray-100'}`}>
                              <FileText className={`h-5 w-5 ${table.is_expired ? 'text-red-600' : table.is_active ? 'text-teal-600' : 'text-gray-400'}`} />
                            </div>
                            <div>
                              <h3 className="font-semibold text-gray-900">{table.name}</h3>
                              {table.customer_name && (
                                <p className="text-sm text-gray-500">Customer: {table.customer_name}</p>
                              )}
                              {table.description && (
                                <p className="text-sm text-gray-400 mt-0.5">{table.description}</p>
                              )}
                              <div className="flex items-center gap-4 mt-1 text-xs text-gray-400">
                                <span>{table.lane_count} lanes</span>
                                <span>Effective: {formatDate(table.effective_date)}</span>
                                {table.expiry_date && <span>Expires: {formatDate(table.expiry_date)}</span>}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {table.is_expired && (
                              <span className="text-xs px-2 py-0.5 rounded font-medium bg-red-100 text-red-700">Expired</span>
                            )}
                            <span className={`text-xs px-2 py-0.5 rounded font-medium ${table.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                              {table.is_active ? 'Active' : 'Inactive'}
                            </span>
                            <button
                              onClick={() => { setEditingTable(table); setShowTableForm(true) }}
                              className="p-1.5 text-gray-400 hover:text-teal-600 hover:bg-teal-50 rounded"
                            >
                              <Edit3 className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => setShowBulkImport(showBulkImport === table.id ? null : table.id)}
                              className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded"
                              title="Bulk import lanes"
                            >
                              <Upload className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => handleDeleteTable(table.id)}
                              className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => setExpandedTable(expandedTable === table.id ? null : table.id)}
                              className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded"
                            >
                              {expandedTable === table.id ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* Bulk Import Form */}
                      {showBulkImport === table.id && (
                        <div className="px-5 pb-4 border-t border-gray-100">
                          <div className="mt-3 space-y-2">
                            <label className="block text-sm font-medium text-gray-700">
                              Bulk Import Lanes (CSV)
                            </label>
                            <p className="text-xs text-gray-400">
                              Format: origin_state,dest_state,equipment_type,rate_per_mile_cents,flat_rate_cents,fuel_surcharge_pct,min_charge_cents
                            </p>
                            <textarea
                              value={bulkCsv}
                              onChange={(e) => setBulkCsv(e.target.value)}
                              placeholder="CA,TX,van,250,,5.0,50000&#10;TX,FL,reefer,275,,5.5,"
                              rows={5}
                              className="w-full border border-gray-300 rounded-lg px-3 py-2 font-mono text-sm"
                            />
                            <div className="flex gap-2">
                              <button
                                onClick={() => { setShowBulkImport(null); setBulkCsv('') }}
                                className="px-3 py-1.5 text-sm border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                              >
                                Cancel
                              </button>
                              <button
                                onClick={() => handleBulkImport(table.id)}
                                disabled={!bulkCsv.trim()}
                                className="flex items-center gap-1 px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                              >
                                <Upload className="h-3 w-3" />
                                Import
                              </button>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Expanded Lane Grid */}
                      {expandedTable === table.id && (
                        <div className="border-t border-gray-100">
                          {table.lanes.length === 0 ? (
                            <div className="p-6 text-center text-sm text-gray-500">No lanes configured</div>
                          ) : (
                            <div className="overflow-x-auto">
                              <table className="w-full">
                                <thead>
                                  <tr className="bg-gray-50 text-left">
                                    <th className="px-4 py-2 text-xs font-medium text-gray-500">Origin</th>
                                    <th className="px-4 py-2 text-xs font-medium text-gray-500">Dest</th>
                                    <th className="px-4 py-2 text-xs font-medium text-gray-500">Equipment</th>
                                    <th className="px-4 py-2 text-xs font-medium text-gray-500">Weight Range</th>
                                    <th className="px-4 py-2 text-xs font-medium text-gray-500 text-right">Rate/Mile</th>
                                    <th className="px-4 py-2 text-xs font-medium text-gray-500 text-right">Flat Rate</th>
                                    <th className="px-4 py-2 text-xs font-medium text-gray-500 text-right">FSC%</th>
                                    <th className="px-4 py-2 text-xs font-medium text-gray-500 text-right">Min Charge</th>
                                    <th className="px-4 py-2 text-xs font-medium text-gray-500">Notes</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                  {table.lanes.map((lane, idx) => (
                                    <tr key={idx} className="hover:bg-gray-50">
                                      <td className="px-4 py-2 text-sm font-medium">{lane.origin_state}</td>
                                      <td className="px-4 py-2 text-sm font-medium">{lane.dest_state}</td>
                                      <td className="px-4 py-2 text-sm text-gray-600">{lane.equipment_type}</td>
                                      <td className="px-4 py-2 text-sm text-gray-600">
                                        {lane.min_weight || lane.max_weight
                                          ? `${lane.min_weight ?? '0'} - ${lane.max_weight ?? 'max'} lbs`
                                          : '-'}
                                      </td>
                                      <td className="px-4 py-2 text-sm text-right font-medium">{formatCents(lane.rate_per_mile)}</td>
                                      <td className="px-4 py-2 text-sm text-right">{formatCents(lane.flat_rate)}</td>
                                      <td className="px-4 py-2 text-sm text-right">{lane.fuel_surcharge_pct}%</td>
                                      <td className="px-4 py-2 text-sm text-right">{formatCents(lane.min_charge)}</td>
                                      <td className="px-4 py-2 text-xs text-gray-400">{lane.notes || '-'}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Table Form Modal */}
              {showTableForm && (
                <RateTableFormModal
                  table={editingTable}
                  customers={customers}
                  onSave={handleSaveTable}
                  onClose={() => { setShowTableForm(false); setEditingTable(null) }}
                />
              )}
            </div>
          )}

          {/* ============================================================ */}
          {/* Rate Lookup Tab */}
          {/* ============================================================ */}
          {activeTab === 'lookup' && (
            <div className="space-y-6">
              <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
                <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                  <Search className="h-5 w-5 text-teal-600" />
                  Rate Lookup Tool
                </h3>
                <p className="text-sm text-gray-500">
                  Search for matching contracted rates based on lane and shipment details
                </p>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Origin State *</label>
                    <select value={lookupOrigin} onChange={(e) => setLookupOrigin(e.target.value)}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2">
                      <option value="">Select...</option>
                      {US_STATES.map((st) => <option key={st} value={st}>{st}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Destination State *</label>
                    <select value={lookupDest} onChange={(e) => setLookupDest(e.target.value)}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2">
                      <option value="">Select...</option>
                      {US_STATES.map((st) => <option key={st} value={st}>{st}</option>)}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Equipment Type</label>
                    <select value={lookupEquipment} onChange={(e) => setLookupEquipment(e.target.value)}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2">
                      {EQUIPMENT_TYPES.map((et) => <option key={et.value} value={et.value}>{et.label}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Weight (lbs)</label>
                    <input type="number" value={lookupWeight} onChange={(e) => setLookupWeight(e.target.value)}
                      placeholder="Optional" className="w-full border border-gray-300 rounded-lg px-3 py-2" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Customer</label>
                    <select value={lookupCustomerId} onChange={(e) => setLookupCustomerId(e.target.value)}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2">
                      <option value="">All Customers</option>
                      {customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>
                </div>

                <button
                  onClick={handleLookup}
                  disabled={!lookupOrigin || !lookupDest || lookupLoading}
                  className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 disabled:opacity-50"
                >
                  {lookupLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                  {lookupLoading ? 'Searching...' : 'Look Up Rates'}
                </button>
              </div>

              {/* Lookup Results */}
              {lookupResults !== null && (
                <div className="bg-white rounded-xl border border-gray-200">
                  <div className="p-4 border-b border-gray-200">
                    <h4 className="font-medium text-gray-900">
                      {lookupResults.length} matching rate{lookupResults.length !== 1 ? 's' : ''} found
                    </h4>
                  </div>
                  {lookupResults.length === 0 ? (
                    <div className="p-8 text-center text-gray-500">
                      No matching rates found for this lane
                    </div>
                  ) : (
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-gray-200 text-left">
                          <th className="px-4 py-3 text-sm font-medium text-gray-500">Rate Table</th>
                          <th className="px-4 py-3 text-sm font-medium text-gray-500">Customer</th>
                          <th className="px-4 py-3 text-sm font-medium text-gray-500">Lane</th>
                          <th className="px-4 py-3 text-sm font-medium text-gray-500">Equipment</th>
                          <th className="px-4 py-3 text-sm font-medium text-gray-500 text-right">Rate/Mile</th>
                          <th className="px-4 py-3 text-sm font-medium text-gray-500 text-right">Flat Rate</th>
                          <th className="px-4 py-3 text-sm font-medium text-gray-500 text-right">FSC%</th>
                          <th className="px-4 py-3 text-sm font-medium text-gray-500 text-right">Min Charge</th>
                          <th className="px-4 py-3 text-sm font-medium text-gray-500">Valid Until</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {lookupResults.map((result, idx) => (
                          <tr key={idx} className="hover:bg-gray-50">
                            <td className="px-4 py-3 text-sm font-medium text-gray-900">{result.rate_table_name}</td>
                            <td className="px-4 py-3 text-sm text-gray-600">{result.customer_name || result.customer_id.slice(-8)}</td>
                            <td className="px-4 py-3 text-sm font-mono text-gray-600">{result.origin_state} &rarr; {result.dest_state}</td>
                            <td className="px-4 py-3 text-sm text-gray-600">{result.equipment_type}</td>
                            <td className="px-4 py-3 text-sm text-right font-medium text-teal-700">{formatCents(result.rate_per_mile)}</td>
                            <td className="px-4 py-3 text-sm text-right">{formatCents(result.flat_rate)}</td>
                            <td className="px-4 py-3 text-sm text-right">{result.fuel_surcharge_pct}%</td>
                            <td className="px-4 py-3 text-sm text-right">{formatCents(result.min_charge)}</td>
                            <td className="px-4 py-3 text-sm text-gray-500">{result.expiry_date ? formatDate(result.expiry_date) : 'No expiry'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ============================================================ */}
          {/* Customer Pricing Tab */}
          {/* ============================================================ */}
          {activeTab === 'customer-pricing' && (
            <CustomerPricingTab
              rateTables={rateTables}
              customers={customers}
              formatCents={formatCents}
              onRefresh={fetchData}
            />
          )}

          {/* ============================================================ */}
          {/* Expiring Contracts Tab */}
          {/* ============================================================ */}
          {activeTab === 'expiring' && (
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <label className="text-sm text-gray-500">Show contracts expiring within:</label>
                <select
                  value={expiryDays}
                  onChange={(e) => setExpiryDays(parseInt(e.target.value))}
                  className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm"
                >
                  <option value={7}>7 days</option>
                  <option value={14}>14 days</option>
                  <option value={30}>30 days</option>
                  <option value={60}>60 days</option>
                  <option value={90}>90 days</option>
                </select>
              </div>

              {expiringContracts.length === 0 ? (
                <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
                  <Calendar className="h-12 w-12 text-green-400 mx-auto mb-4" />
                  <p className="text-gray-900 font-medium">No contracts expiring soon</p>
                  <p className="text-gray-500 mt-1">All rate tables are valid beyond {expiryDays} days</p>
                </div>
              ) : (
                <div className="grid gap-3">
                  {expiringContracts.map((contract) => {
                    const urgency = contract.days_until_expiry <= 7
                      ? 'border-l-red-500 bg-red-50'
                      : contract.days_until_expiry <= 14
                        ? 'border-l-amber-500 bg-amber-50'
                        : 'border-l-yellow-400 bg-yellow-50'
                    return (
                      <div
                        key={contract.id}
                        className={`bg-white rounded-lg border border-gray-200 border-l-4 ${urgency} p-4`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <AlertTriangle className={`h-5 w-5 ${contract.days_until_expiry <= 7 ? 'text-red-500' : 'text-amber-500'}`} />
                            <div>
                              <p className="font-medium text-gray-900">{contract.name}</p>
                              <p className="text-sm text-gray-500">{contract.customer_name || 'Unknown customer'}</p>
                              <div className="flex items-center gap-3 mt-1 text-xs text-gray-400">
                                <span>{contract.lane_count} lanes</span>
                                <span>Effective: {formatDate(contract.effective_date)}</span>
                              </div>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-medium text-gray-900">Expires: {formatDate(contract.expiry_date)}</p>
                            <p className={`text-lg font-bold ${contract.days_until_expiry <= 7 ? 'text-red-600' : 'text-amber-600'}`}>
                              {contract.days_until_expiry} day{contract.days_until_expiry !== 1 ? 's' : ''}
                            </p>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}


// ============================================================================
// Rate Table Form Modal
// ============================================================================

function RateTableFormModal({
  table,
  customers,
  onSave,
  onClose,
}: {
  table: RateTableItem | null
  customers: { id: string; name: string }[]
  onSave: (data: Record<string, unknown>) => void
  onClose: () => void
}) {
  const [name, setName] = useState(table?.name || '')
  const [description, setDescription] = useState(table?.description || '')
  const [customerId, setCustomerId] = useState(table?.customer_id || '')
  const [effectiveDate, setEffectiveDate] = useState(
    table?.effective_date ? new Date(table.effective_date).toISOString().split('T')[0] : ''
  )
  const [expiryDate, setExpiryDate] = useState(
    table?.expiry_date ? new Date(table.expiry_date).toISOString().split('T')[0] : ''
  )
  const [isActive, setIsActive] = useState(table?.is_active ?? true)

  const handleSubmit = () => {
    if (!name.trim() || !customerId || !effectiveDate) return
    onSave({
      name,
      description: description || undefined,
      customer_id: customerId,
      effective_date: new Date(effectiveDate).toISOString(),
      expiry_date: expiryDate ? new Date(expiryDate).toISOString() : undefined,
      is_active: isActive,
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          {table ? 'Edit Rate Table' : 'New Rate Table'}
        </h3>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Q1 2026 Contracted Rates"
              className="w-full border border-gray-300 rounded-lg px-3 py-2" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2}
              className="w-full border border-gray-300 rounded-lg px-3 py-2" />
          </div>
          {!table && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Customer *</label>
              <select value={customerId} onChange={(e) => setCustomerId(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2">
                <option value="">Select customer...</option>
                {customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
          )}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Effective Date *</label>
              <input type="date" value={effectiveDate} onChange={(e) => setEffectiveDate(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Expiry Date</label>
              <input type="date" value={expiryDate} onChange={(e) => setExpiryDate(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2" />
            </div>
          </div>
          <div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)}
                className="rounded" />
              <span className="text-sm font-medium text-gray-700">Active</span>
            </label>
          </div>
          <div className="flex gap-3 pt-2">
            <button onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50">
              Cancel
            </button>
            <button onClick={handleSubmit}
              disabled={!name.trim() || !customerId || !effectiveDate}
              className="flex-1 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 disabled:opacity-50">
              {table ? 'Update' : 'Create'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}


// ============================================================================
// Customer Pricing Tab Component
// ============================================================================

function CustomerPricingTab({
  rateTables,
  customers,
  formatCents,
  onRefresh,
}: {
  rateTables: RateTableItem[]
  customers: { id: string; name: string }[]
  formatCents: (cents?: number) => string
  onRefresh: () => void
}) {
  const [selectedCustomer, setSelectedCustomer] = useState('')
  const [showAddRule, setShowAddRule] = useState<string | null>(null)

  // New rule form state
  const [ruleName, setRuleName] = useState('')
  const [discountPercent, setDiscountPercent] = useState('')
  const [contractRpm, setContractRpm] = useState('')
  const [contractFlat, setContractFlat] = useState('')
  const [fscOverride, setFscOverride] = useState('')
  const [minMargin, setMinMargin] = useState('')
  const [autoApply, setAutoApply] = useState(true)
  const [ruleNotes, setRuleNotes] = useState('')
  const [saving, setSaving] = useState(false)

  // Filter rate tables by selected customer
  const filteredTables = selectedCustomer
    ? rateTables.filter(t => t.customer_id === selectedCustomer)
    : rateTables

  const tablesWithRules = filteredTables.filter(t =>
    (t as any).customer_pricing_rules && (t as any).customer_pricing_rules.length > 0
  )

  const handleAddRule = async (tableId: string) => {
    if (!ruleName.trim()) return
    setSaving(true)
    try {
      const table = rateTables.find(t => t.id === tableId)
      if (!table) return

      const existingRules = (table as any).customer_pricing_rules || []
      const newRule: CustomerPricingRuleItem = {
        rule_name: ruleName,
        discount_percent: discountPercent ? parseFloat(discountPercent) : 0,
        volume_discount_tiers: [],
        contract_rate_per_mile: contractRpm ? parseInt(contractRpm) : undefined,
        contract_flat_rate: contractFlat ? parseInt(contractFlat) : undefined,
        fuel_surcharge_override: fscOverride ? parseFloat(fscOverride) : undefined,
        min_margin_percent: minMargin ? parseFloat(minMargin) : 0,
        auto_apply: autoApply,
        notes: ruleNotes || undefined,
      }

      await api.updateRateTable(tableId, {
        customer_pricing_rules: [...existingRules, newRule],
      })

      // Reset form
      setRuleName('')
      setDiscountPercent('')
      setContractRpm('')
      setContractFlat('')
      setFscOverride('')
      setMinMargin('')
      setAutoApply(true)
      setRuleNotes('')
      setShowAddRule(null)
      onRefresh()
    } catch (error) {
      console.error('Failed to add pricing rule:', error)
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteRule = async (tableId: string, ruleIndex: number) => {
    if (!confirm('Delete this pricing rule?')) return
    try {
      const table = rateTables.find(t => t.id === tableId)
      if (!table) return
      const rules = [...((table as any).customer_pricing_rules || [])]
      rules.splice(ruleIndex, 1)
      await api.updateRateTable(tableId, { customer_pricing_rules: rules })
      onRefresh()
    } catch (error) {
      console.error('Failed to delete rule:', error)
    }
  }

  return (
    <div className="space-y-6">
      {/* Customer Filter */}
      <div className="flex items-center gap-4">
        <label className="text-sm font-medium text-gray-700">Filter by Customer:</label>
        <select
          value={selectedCustomer}
          onChange={(e) => setSelectedCustomer(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm min-w-[200px]"
        >
          <option value="">All Customers</option>
          {customers.map(c => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      </div>

      {/* Summary of customer pricing */}
      <div className="bg-gradient-to-br from-teal-50 to-white rounded-xl border border-teal-100 p-5">
        <h3 className="text-sm font-semibold text-teal-800 mb-2">Customer-Specific Pricing</h3>
        <p className="text-xs text-teal-600 mb-3">
          Configure per-customer rate overrides, volume discounts, and contract pricing.
          These rules auto-apply when creating quotes for the customer.
        </p>
        <div className="flex gap-6 text-sm">
          <div>
            <span className="text-teal-500 text-xs">Rate Tables</span>
            <p className="font-bold text-teal-800">{filteredTables.length}</p>
          </div>
          <div>
            <span className="text-teal-500 text-xs">With Pricing Rules</span>
            <p className="font-bold text-teal-800">{tablesWithRules.length}</p>
          </div>
          <div>
            <span className="text-teal-500 text-xs">Total Rules</span>
            <p className="font-bold text-teal-800">
              {filteredTables.reduce((sum, t) => sum + ((t as any).customer_pricing_rules?.length || 0), 0)}
            </p>
          </div>
        </div>
      </div>

      {/* Rate Tables with pricing rules */}
      {filteredTables.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <DollarSign className="h-12 w-12 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-900 font-medium">No rate tables found</p>
          <p className="text-gray-500 mt-1">Create rate tables first, then add customer pricing rules</p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredTables.map(table => {
            const rules: CustomerPricingRuleItem[] = (table as any).customer_pricing_rules || []
            return (
              <div key={table.id} className="bg-white rounded-xl border border-gray-200">
                <div className="p-5 flex items-start justify-between">
                  <div>
                    <h3 className="font-semibold text-gray-900">{table.name}</h3>
                    <p className="text-sm text-gray-500">
                      {table.customer_name || 'Unknown Customer'} - {table.lane_count} lanes
                    </p>
                  </div>
                  <button
                    onClick={() => setShowAddRule(showAddRule === table.id ? null : table.id)}
                    className="flex items-center gap-1 text-sm text-teal-600 hover:text-teal-700 font-medium"
                  >
                    <Plus className="h-4 w-4" />
                    Add Rule
                  </button>
                </div>

                {/* Existing Pricing Rules */}
                {rules.length > 0 && (
                  <div className="border-t border-gray-100">
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead>
                          <tr className="bg-gray-50 text-left">
                            <th className="px-4 py-2 text-xs font-medium text-gray-500">Rule Name</th>
                            <th className="px-4 py-2 text-xs font-medium text-gray-500 text-right">Discount %</th>
                            <th className="px-4 py-2 text-xs font-medium text-gray-500 text-right">Rate/Mile</th>
                            <th className="px-4 py-2 text-xs font-medium text-gray-500 text-right">Flat Rate</th>
                            <th className="px-4 py-2 text-xs font-medium text-gray-500 text-right">FSC Override</th>
                            <th className="px-4 py-2 text-xs font-medium text-gray-500 text-right">Min Margin</th>
                            <th className="px-4 py-2 text-xs font-medium text-gray-500">Auto-Apply</th>
                            <th className="px-4 py-2 text-xs font-medium text-gray-500"></th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {rules.map((rule, idx) => (
                            <tr key={idx} className="hover:bg-gray-50">
                              <td className="px-4 py-2 text-sm font-medium text-gray-900">{rule.rule_name}</td>
                              <td className="px-4 py-2 text-sm text-right">
                                {rule.discount_percent > 0 ? (
                                  <span className="text-emerald-600 font-medium">{rule.discount_percent}%</span>
                                ) : '-'}
                              </td>
                              <td className="px-4 py-2 text-sm text-right font-medium">
                                {formatCents(rule.contract_rate_per_mile)}
                              </td>
                              <td className="px-4 py-2 text-sm text-right">
                                {formatCents(rule.contract_flat_rate)}
                              </td>
                              <td className="px-4 py-2 text-sm text-right">
                                {rule.fuel_surcharge_override != null ? `${rule.fuel_surcharge_override}%` : '-'}
                              </td>
                              <td className="px-4 py-2 text-sm text-right">
                                {rule.min_margin_percent > 0 ? `${rule.min_margin_percent}%` : '-'}
                              </td>
                              <td className="px-4 py-2 text-sm">
                                <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${rule.auto_apply ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                                  {rule.auto_apply ? 'Yes' : 'No'}
                                </span>
                              </td>
                              <td className="px-4 py-2">
                                <button
                                  onClick={() => handleDeleteRule(table.id, idx)}
                                  className="p-1 text-gray-400 hover:text-red-500"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {rules.length === 0 && showAddRule !== table.id && (
                  <div className="border-t border-gray-100 px-5 py-4 text-center text-sm text-gray-500">
                    No pricing rules configured. Add rules for per-customer rate overrides.
                  </div>
                )}

                {/* Add Rule Form */}
                {showAddRule === table.id && (
                  <div className="border-t border-gray-100 p-5 bg-gray-50">
                    <h4 className="text-sm font-semibold text-gray-700 mb-3">New Pricing Rule</h4>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="col-span-2">
                        <label className="block text-xs font-medium text-gray-600 mb-1">Rule Name *</label>
                        <input
                          type="text"
                          value={ruleName}
                          onChange={(e) => setRuleName(e.target.value)}
                          placeholder="e.g., Q1 2026 Volume Discount"
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Discount %</label>
                        <input
                          type="number"
                          step="0.1"
                          value={discountPercent}
                          onChange={(e) => setDiscountPercent(e.target.value)}
                          placeholder="e.g., 5.0"
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Contract Rate/Mile (cents)</label>
                        <input
                          type="number"
                          value={contractRpm}
                          onChange={(e) => setContractRpm(e.target.value)}
                          placeholder="e.g., 250"
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Contract Flat Rate (cents)</label>
                        <input
                          type="number"
                          value={contractFlat}
                          onChange={(e) => setContractFlat(e.target.value)}
                          placeholder="e.g., 150000"
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">FSC Override %</label>
                        <input
                          type="number"
                          step="0.1"
                          value={fscOverride}
                          onChange={(e) => setFscOverride(e.target.value)}
                          placeholder="e.g., 5.5"
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Min Margin %</label>
                        <input
                          type="number"
                          step="0.1"
                          value={minMargin}
                          onChange={(e) => setMinMargin(e.target.value)}
                          placeholder="e.g., 10.0"
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                        />
                      </div>
                      <div className="col-span-2">
                        <label className="block text-xs font-medium text-gray-600 mb-1">Notes</label>
                        <input
                          type="text"
                          value={ruleNotes}
                          onChange={(e) => setRuleNotes(e.target.value)}
                          placeholder="Optional notes about this pricing rule"
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                        />
                      </div>
                      <div className="col-span-2">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={autoApply}
                            onChange={(e) => setAutoApply(e.target.checked)}
                            className="rounded"
                          />
                          <span className="text-sm text-gray-700">Auto-apply when creating quotes for this customer</span>
                        </label>
                      </div>
                    </div>
                    <div className="flex gap-2 mt-4">
                      <button
                        onClick={() => setShowAddRule(null)}
                        className="px-3 py-1.5 text-sm border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={() => handleAddRule(table.id)}
                        disabled={!ruleName.trim() || saving}
                        className="flex items-center gap-1 px-3 py-1.5 text-sm bg-teal-600 text-white rounded-lg hover:bg-teal-700 disabled:opacity-50"
                      >
                        <Plus className="h-3 w-3" />
                        {saving ? 'Saving...' : 'Add Rule'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
