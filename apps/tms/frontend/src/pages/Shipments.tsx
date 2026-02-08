import { useEffect, useState, useRef } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { api } from '../services/api'
import type { Shipment, BulkImportPreview, BulkImportResult, LoadTemplate, ConsolidationSuggestion, Customer } from '../types'
import { ArrowRight, AlertTriangle, Truck, Package, CheckCircle, Upload, FileSpreadsheet, X, Loader2, Repeat, Calendar, Play, Layers, Plus, Save, BookmarkCheck } from 'lucide-react'
import PageHelp from '../components/PageHelp'

const statusColors: Record<string, string> = {
  booked: 'bg-gray-100 text-gray-700',
  pending_pickup: 'bg-blue-100 text-blue-700',
  in_transit: 'bg-yellow-100 text-yellow-700',
  out_for_delivery: 'bg-purple-100 text-purple-700',
  delivered: 'bg-green-100 text-green-700',
  completed: 'bg-green-100 text-green-700',
  cancelled: 'bg-red-100 text-red-700',
}

const statusIcons: Record<string, typeof Truck> = {
  booked: Package,
  pending_pickup: Package,
  in_transit: Truck,
  out_for_delivery: Truck,
  delivered: CheckCircle,
  completed: CheckCircle,
}

export default function Shipments() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [shipments, setShipments] = useState<Shipment[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<string>(searchParams.get('status') || 'all')
  const [atRiskOnly, setAtRiskOnly] = useState(searchParams.get('at_risk') === 'true')

  // Bulk import state
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [showBulkImport, setShowBulkImport] = useState(false)
  const [importPreview, setImportPreview] = useState<BulkImportPreview | null>(null)
  const [importResult, setImportResult] = useState<BulkImportResult | null>(null)
  const [importing, setImporting] = useState(false)
  const [importError, setImportError] = useState<string | null>(null)

  // Templates state
  const [showTemplates, setShowTemplates] = useState(false)
  const [templates, setTemplates] = useState<LoadTemplate[]>([])
  const [loadingTemplates, setLoadingTemplates] = useState(false)
  const [bookingTemplate, setBookingTemplate] = useState<string | null>(null)
  const [showCreateTemplate, setShowCreateTemplate] = useState(false)
  const [newTemplate, setNewTemplate] = useState({
    name: '',
    customer_id: '',
    equipment_type: 'van',
    weight_lbs: '',
    commodity: '',
    customer_price: '',
    origin_city: '',
    origin_state: '',
    dest_city: '',
    dest_state: '',
    recurrence_frequency: '',
  })
  const [creatingTemplate, setCreatingTemplate] = useState(false)

  // Consolidation state
  const [showConsolidation, setShowConsolidation] = useState(false)
  const [consolidationSuggestions, setConsolidationSuggestions] = useState<ConsolidationSuggestion[]>([])
  const [loadingConsolidation, setLoadingConsolidation] = useState(false)
  const [consolidating, setConsolidating] = useState<string | null>(null)

  // Saved column mapping state
  const [savingMapping, setSavingMapping] = useState(false)
  const [mappingName, setMappingName] = useState('')

  // Customers (for template creation)
  const [customers, setCustomers] = useState<Customer[]>([])

  useEffect(() => {
    const fetchShipments = async () => {
      setLoading(true)
      try {
        const params: Record<string, string> = {}
        if (statusFilter !== 'all') params.status = statusFilter
        if (atRiskOnly) params.at_risk = 'true'
        const data = await api.getShipments(params)
        setShipments(data)
      } catch (error) {
        console.error('Failed to fetch shipments:', error)
      } finally {
        setLoading(false)
      }
    }
    fetchShipments()
  }, [statusFilter, atRiskOnly])

  const handleStatusFilter = (status: string) => {
    setStatusFilter(status)
    const params = new URLSearchParams(searchParams)
    if (status === 'all') {
      params.delete('status')
    } else {
      params.set('status', status)
    }
    setSearchParams(params)
  }

  const handleAtRiskToggle = () => {
    const newValue = !atRiskOnly
    setAtRiskOnly(newValue)
    const params = new URLSearchParams(searchParams)
    if (newValue) {
      params.set('at_risk', 'true')
    } else {
      params.delete('at_risk')
    }
    setSearchParams(params)
  }

  // Bulk import handlers
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setImportError(null)
    setImportResult(null)
    setImporting(true)
    try {
      const preview = await api.bulkImportPreview(file)
      setImportPreview(preview)
      setShowBulkImport(true)
    } catch (error) {
      setImportError(error instanceof Error ? error.message : 'Failed to preview file')
    } finally {
      setImporting(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const handleBulkImportExecute = async () => {
    if (!importPreview) return
    setImporting(true)
    setImportError(null)
    try {
      const result = await api.bulkImportExecute({
        filename: importPreview.filename,
        column_mappings: importPreview.column_mappings,
        skip_errors: true,
      })
      setImportResult(result)
      // Refresh shipments list
      const params: Record<string, string> = {}
      if (statusFilter !== 'all') params.status = statusFilter
      if (atRiskOnly) params.at_risk = 'true'
      const data = await api.getShipments(params)
      setShipments(data)
    } catch (error) {
      setImportError(error instanceof Error ? error.message : 'Import failed')
    } finally {
      setImporting(false)
    }
  }

  // Template handlers
  const fetchTemplates = async () => {
    setLoadingTemplates(true)
    try {
      const data = await api.getLoadTemplates()
      setTemplates(data)
    } catch (error) {
      console.error('Failed to fetch templates:', error)
    } finally {
      setLoadingTemplates(false)
    }
  }

  const handleBookFromTemplate = async (templateId: string) => {
    setBookingTemplate(templateId)
    try {
      await api.bookFromTemplate(templateId)
      // Refresh shipments
      const params: Record<string, string> = {}
      if (statusFilter !== 'all') params.status = statusFilter
      if (atRiskOnly) params.at_risk = 'true'
      const data = await api.getShipments(params)
      setShipments(data)
      await fetchTemplates()
    } catch (error) {
      console.error('Failed to book from template:', error)
    } finally {
      setBookingTemplate(null)
    }
  }

  const handleCreateTemplate = async () => {
    if (!newTemplate.name || !newTemplate.customer_id) return
    setCreatingTemplate(true)
    try {
      const stops = []
      if (newTemplate.origin_city && newTemplate.origin_state) {
        stops.push({
          stop_number: 1,
          stop_type: 'pickup' as const,
          address: '',
          city: newTemplate.origin_city,
          state: newTemplate.origin_state,
          zip_code: '',
        })
      }
      if (newTemplate.dest_city && newTemplate.dest_state) {
        stops.push({
          stop_number: 2,
          stop_type: 'delivery' as const,
          address: '',
          city: newTemplate.dest_city,
          state: newTemplate.dest_state,
          zip_code: '',
        })
      }
      await api.createLoadTemplate({
        name: newTemplate.name,
        customer_id: newTemplate.customer_id,
        equipment_type: newTemplate.equipment_type,
        weight_lbs: newTemplate.weight_lbs ? parseInt(newTemplate.weight_lbs) : undefined,
        commodity: newTemplate.commodity || undefined,
        customer_price: newTemplate.customer_price ? Math.round(parseFloat(newTemplate.customer_price) * 100) : undefined,
        stops,
        recurrence_frequency: (newTemplate.recurrence_frequency || undefined) as any,
      })
      setShowCreateTemplate(false)
      setNewTemplate({ name: '', customer_id: '', equipment_type: 'van', weight_lbs: '', commodity: '', customer_price: '', origin_city: '', origin_state: '', dest_city: '', dest_state: '', recurrence_frequency: '' })
      await fetchTemplates()
    } catch (error) {
      console.error('Failed to create template:', error)
    } finally {
      setCreatingTemplate(false)
    }
  }

  // Consolidation handlers
  const fetchConsolidationSuggestions = async () => {
    setLoadingConsolidation(true)
    try {
      const data = await api.getConsolidationSuggestions()
      setConsolidationSuggestions(Array.isArray(data) ? data : (data as any).suggestions || [])
    } catch (error) {
      console.error('Failed to fetch consolidation suggestions:', error)
    } finally {
      setLoadingConsolidation(false)
    }
  }

  const handleConsolidate = async (shipmentIds: string[]) => {
    setConsolidating(shipmentIds.join(','))
    try {
      await api.consolidateShipments({ shipment_ids: shipmentIds })
      // Refresh
      const params: Record<string, string> = {}
      if (statusFilter !== 'all') params.status = statusFilter
      if (atRiskOnly) params.at_risk = 'true'
      const data = await api.getShipments(params)
      setShipments(data)
      await fetchConsolidationSuggestions()
    } catch (error) {
      console.error('Failed to consolidate:', error)
    } finally {
      setConsolidating(null)
    }
  }

  // Saved mapping handlers
  const handleSaveMapping = async () => {
    if (!mappingName || !importPreview) return
    setSavingMapping(true)
    try {
      const mappingObj: Record<string, string> = {}
      importPreview.column_mappings.forEach(m => {
        mappingObj[m.csv_column] = m.mapped_field
      })
      await api.saveImportMapping({
        name: mappingName,
        customer_id: 'default',
        column_mapping: mappingObj,
      })
      setMappingName('')
    } catch (error) {
      console.error('Failed to save mapping:', error)
    } finally {
      setSavingMapping(false)
    }
  }

  // Fetch customers for template creation
  const fetchCustomers = async () => {
    try {
      const data = await api.getCustomers({ status: 'active' })
      setCustomers(data)
    } catch (error) {
      console.error('Failed to fetch customers:', error)
    }
  }

  return (
    <div className="space-y-6">
      {/* Hidden file input for bulk import */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".csv,.xlsx,.xls"
        onChange={handleFileSelect}
        className="hidden"
      />

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-gray-900">Shipments</h1>
            <PageHelp pageId="shipments" />
          </div>
          <p className="text-gray-500">
            {shipments.length} shipment{shipments.length !== 1 ? 's' : ''}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => { setShowConsolidation(true); fetchConsolidationSuggestions() }}
            className="flex items-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
          >
            <Layers className="h-4 w-4" />
            Consolidate
          </button>
          <button
            onClick={() => { setShowTemplates(true); fetchTemplates(); fetchCustomers() }}
            className="flex items-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
          >
            <Repeat className="h-4 w-4" />
            Templates
          </button>
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={importing}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50"
          >
            {importing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            Bulk Import
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-4 items-center flex-wrap">
        <div className="flex gap-2">
          {[
            { value: 'all', label: 'All' },
            { value: 'booked', label: 'Booked' },
            { value: 'pending_pickup', label: 'Pending Pickup' },
            { value: 'in_transit', label: 'In Transit' },
            { value: 'delivered', label: 'Delivered' },
          ].map((f) => (
            <button
              key={f.value}
              onClick={() => handleStatusFilter(f.value)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                statusFilter === f.value
                  ? 'bg-emerald-100 text-emerald-700'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
        <button
          onClick={handleAtRiskToggle}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
            atRiskOnly
              ? 'bg-red-100 text-red-700'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          <AlertTriangle className="h-4 w-4" />
          At Risk Only
        </button>
      </div>

      {/* Shipments List */}
      <div className="bg-white rounded-lg border border-gray-200">
        {loading ? (
          <div className="p-8 text-center text-gray-500">Loading...</div>
        ) : shipments.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            No shipments found
          </div>
        ) : (
          <ul className="divide-y divide-gray-200">
            {shipments.map((shipment) => {
              const Icon = statusIcons[shipment.status] || Truck
              return (
                <li key={shipment.id}>
                  <Link
                    to={`/shipments/${shipment.id}`}
                    className="block p-4 hover:bg-gray-50"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-4">
                        <div className={`p-2 rounded-lg ${
                          shipment.at_risk ? 'bg-red-100' : 'bg-gray-100'
                        }`}>
                          <Icon className={`h-5 w-5 ${
                            shipment.at_risk ? 'text-red-600' : 'text-gray-600'
                          }`} />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="font-medium text-gray-900">
                              {shipment.shipment_number}
                            </h3>
                            <span className={`px-2 py-0.5 text-xs font-medium rounded ${statusColors[shipment.status]}`}>
                              {shipment.status.replace(/_/g, ' ')}
                            </span>
                            {shipment.at_risk && (
                              <span className="px-2 py-0.5 text-xs font-medium bg-red-100 text-red-700 rounded flex items-center gap-1">
                                <AlertTriangle className="h-3 w-3" />
                                At Risk
                              </span>
                            )}
                          </div>
                          <div className="mt-1 flex items-center gap-2 text-sm text-gray-500">
                            <span>{shipment.origin_city}, {shipment.origin_state}</span>
                            <ArrowRight className="h-4 w-4" />
                            <span>{shipment.destination_city}, {shipment.destination_state}</span>
                          </div>
                          {shipment.carrier_name && (
                            <p className="mt-1 text-sm text-gray-500">
                              Carrier: {shipment.carrier_name}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-medium text-gray-900">
                          ${((shipment.customer_price || 0) / 100).toFixed(2)}
                        </p>
                        {shipment.pickup_date && (
                          <p className="text-xs text-gray-500">
                            Pickup: {new Date(shipment.pickup_date).toLocaleDateString()}
                          </p>
                        )}
                      </div>
                    </div>
                  </Link>
                </li>
              )
            })}
          </ul>
        )}
      </div>

      {/* Bulk Import Modal */}
      {showBulkImport && importPreview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl p-6 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <FileSpreadsheet className="h-5 w-5 text-emerald-600" />
                Bulk Import Preview
              </h3>
              <button onClick={() => { setShowBulkImport(false); setImportPreview(null); setImportResult(null) }}
                className="p-1.5 text-gray-400 hover:text-gray-600 rounded">
                <X className="h-5 w-5" />
              </button>
            </div>

            {importResult ? (
              <div className="space-y-4">
                <div className="p-4 bg-emerald-50 rounded-lg border border-emerald-200">
                  <p className="font-semibold text-emerald-700">Import Complete</p>
                  <div className="mt-2 grid grid-cols-3 gap-4 text-sm">
                    <div><span className="text-gray-500">Total Rows:</span> <span className="font-medium">{importResult.total_rows}</span></div>
                    <div><span className="text-gray-500">Imported:</span> <span className="font-medium text-emerald-600">{importResult.imported}</span></div>
                    <div><span className="text-gray-500">Skipped:</span> <span className="font-medium text-amber-600">{importResult.skipped}</span></div>
                  </div>
                </div>
                {importResult.errors.length > 0 && (
                  <div className="p-3 bg-red-50 rounded-lg text-sm">
                    <p className="font-medium text-red-700 mb-1">Errors ({importResult.errors.length}):</p>
                    {importResult.errors.slice(0, 5).map((err, i) => (
                      <p key={i} className="text-red-600">Row {err.row}: {err.error}</p>
                    ))}
                  </div>
                )}
                <button onClick={() => { setShowBulkImport(false); setImportPreview(null); setImportResult(null) }}
                  className="w-full py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700">
                  Done
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="text-sm text-gray-600">
                  <p><span className="font-medium">File:</span> {importPreview.filename}</p>
                  <p><span className="font-medium">Rows:</span> {importPreview.total_rows}</p>
                </div>

                {importPreview.warnings.length > 0 && (
                  <div className="p-3 bg-amber-50 rounded-lg text-sm">
                    {importPreview.warnings.map((w, i) => (
                      <p key={i} className="text-amber-700 flex items-center gap-1">
                        <AlertTriangle className="h-3 w-3" /> {w}
                      </p>
                    ))}
                  </div>
                )}

                <div>
                  <p className="text-sm font-medium text-gray-700 mb-2">AI Column Mapping</p>
                  <div className="border border-gray-200 rounded-lg overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="text-left px-3 py-2 font-medium text-gray-600">CSV Column</th>
                          <th className="text-left px-3 py-2 font-medium text-gray-600">Mapped To</th>
                          <th className="text-left px-3 py-2 font-medium text-gray-600">Confidence</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {importPreview.column_mappings.map((mapping, i) => (
                          <tr key={i}>
                            <td className="px-3 py-2 font-mono text-gray-700">{mapping.csv_column}</td>
                            <td className="px-3 py-2 text-emerald-700 font-medium">{mapping.mapped_field}</td>
                            <td className="px-3 py-2">
                              <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                                mapping.confidence > 0.8 ? 'bg-emerald-100 text-emerald-700' :
                                mapping.confidence > 0.5 ? 'bg-amber-100 text-amber-700' :
                                'bg-red-100 text-red-700'
                              }`}>
                                {(mapping.confidence * 100).toFixed(0)}%
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Save Mapping Template */}
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={mappingName}
                    onChange={e => setMappingName(e.target.value)}
                    placeholder="Mapping name (e.g., Customer XYZ Format)"
                    className="flex-1 px-3 py-1.5 border border-gray-200 rounded-lg text-sm"
                  />
                  <button
                    onClick={handleSaveMapping}
                    disabled={!mappingName || savingMapping}
                    className="flex items-center gap-1 px-3 py-1.5 text-sm text-emerald-700 bg-emerald-50 rounded-lg hover:bg-emerald-100 disabled:opacity-50"
                  >
                    {savingMapping ? <Loader2 className="h-3 w-3 animate-spin" /> : <BookmarkCheck className="h-3 w-3" />}
                    Save Mapping
                  </button>
                </div>

                {importPreview.sample_rows.length > 0 && (
                  <div>
                    <p className="text-sm font-medium text-gray-700 mb-2">Sample Data (first {importPreview.sample_rows.length} rows)</p>
                    <div className="overflow-x-auto border border-gray-200 rounded-lg">
                      <table className="w-full text-xs">
                        <thead className="bg-gray-50">
                          <tr>
                            {Object.keys(importPreview.sample_rows[0]).map(key => (
                              <th key={key} className="text-left px-2 py-1.5 font-medium text-gray-600 whitespace-nowrap">{key}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {importPreview.sample_rows.map((row, i) => (
                            <tr key={i}>
                              {Object.values(row).map((val, j) => (
                                <td key={j} className="px-2 py-1.5 text-gray-700 whitespace-nowrap">{String(val)}</td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {importError && (
                  <div className="p-3 bg-red-50 rounded-lg text-sm text-red-700">{importError}</div>
                )}

                <div className="flex gap-3">
                  <button onClick={() => { setShowBulkImport(false); setImportPreview(null) }}
                    className="flex-1 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50">
                    Cancel
                  </button>
                  <button onClick={handleBulkImportExecute} disabled={importing}
                    className="flex-1 flex items-center justify-center gap-2 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50">
                    {importing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                    {importing ? 'Importing...' : `Import ${importPreview.total_rows} Loads`}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Recurring Templates Modal */}
      {showTemplates && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-xl p-6 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <Repeat className="h-5 w-5 text-emerald-600" />
                Load Templates
              </h3>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowCreateTemplate(!showCreateTemplate)}
                  className="flex items-center gap-1 px-3 py-1.5 text-sm bg-emerald-600 text-white rounded-lg hover:bg-emerald-700"
                >
                  <Plus className="h-3.5 w-3.5" />
                  New
                </button>
                <button onClick={() => { setShowTemplates(false); setShowCreateTemplate(false) }}
                  className="p-1.5 text-gray-400 hover:text-gray-600 rounded">
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            {/* Create Template Form */}
            {showCreateTemplate && (
              <div className="mb-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
                <h4 className="text-sm font-semibold text-gray-700 mb-3">Create New Template</h4>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="col-span-2">
                    <label className="block text-xs text-gray-500 mb-1">Template Name *</label>
                    <input type="text" value={newTemplate.name} onChange={e => setNewTemplate({...newTemplate, name: e.target.value})}
                      placeholder="e.g., Chicago to Dallas Weekly" className="w-full px-3 py-1.5 border border-gray-200 rounded-lg" />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-xs text-gray-500 mb-1">Customer *</label>
                    <select value={newTemplate.customer_id} onChange={e => setNewTemplate({...newTemplate, customer_id: e.target.value})}
                      className="w-full px-3 py-1.5 border border-gray-200 rounded-lg bg-white">
                      <option value="">Select customer...</option>
                      {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Origin City</label>
                    <input type="text" value={newTemplate.origin_city} onChange={e => setNewTemplate({...newTemplate, origin_city: e.target.value})}
                      placeholder="Chicago" className="w-full px-3 py-1.5 border border-gray-200 rounded-lg" />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Origin State</label>
                    <input type="text" value={newTemplate.origin_state} onChange={e => setNewTemplate({...newTemplate, origin_state: e.target.value})}
                      placeholder="IL" className="w-full px-3 py-1.5 border border-gray-200 rounded-lg" maxLength={2} />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Destination City</label>
                    <input type="text" value={newTemplate.dest_city} onChange={e => setNewTemplate({...newTemplate, dest_city: e.target.value})}
                      placeholder="Dallas" className="w-full px-3 py-1.5 border border-gray-200 rounded-lg" />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Destination State</label>
                    <input type="text" value={newTemplate.dest_state} onChange={e => setNewTemplate({...newTemplate, dest_state: e.target.value})}
                      placeholder="TX" className="w-full px-3 py-1.5 border border-gray-200 rounded-lg" maxLength={2} />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Equipment Type</label>
                    <select value={newTemplate.equipment_type} onChange={e => setNewTemplate({...newTemplate, equipment_type: e.target.value})}
                      className="w-full px-3 py-1.5 border border-gray-200 rounded-lg bg-white">
                      <option value="van">Van</option>
                      <option value="reefer">Reefer</option>
                      <option value="flatbed">Flatbed</option>
                      <option value="step_deck">Step Deck</option>
                      <option value="power_only">Power Only</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Weight (lbs)</label>
                    <input type="number" value={newTemplate.weight_lbs} onChange={e => setNewTemplate({...newTemplate, weight_lbs: e.target.value})}
                      placeholder="42000" className="w-full px-3 py-1.5 border border-gray-200 rounded-lg" />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Commodity</label>
                    <input type="text" value={newTemplate.commodity} onChange={e => setNewTemplate({...newTemplate, commodity: e.target.value})}
                      placeholder="General Merchandise" className="w-full px-3 py-1.5 border border-gray-200 rounded-lg" />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Customer Price ($)</label>
                    <input type="number" step="0.01" value={newTemplate.customer_price} onChange={e => setNewTemplate({...newTemplate, customer_price: e.target.value})}
                      placeholder="3500.00" className="w-full px-3 py-1.5 border border-gray-200 rounded-lg" />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-xs text-gray-500 mb-1">Recurrence</label>
                    <select value={newTemplate.recurrence_frequency} onChange={e => setNewTemplate({...newTemplate, recurrence_frequency: e.target.value})}
                      className="w-full px-3 py-1.5 border border-gray-200 rounded-lg bg-white">
                      <option value="">One-time (no recurrence)</option>
                      <option value="daily">Daily</option>
                      <option value="weekly">Weekly</option>
                      <option value="biweekly">Biweekly</option>
                      <option value="monthly">Monthly</option>
                    </select>
                  </div>
                </div>
                <div className="flex gap-2 mt-3">
                  <button onClick={() => setShowCreateTemplate(false)} className="flex-1 py-1.5 border border-gray-300 text-gray-700 rounded-lg text-sm hover:bg-gray-50">Cancel</button>
                  <button onClick={handleCreateTemplate} disabled={!newTemplate.name || !newTemplate.customer_id || creatingTemplate}
                    className="flex-1 flex items-center justify-center gap-1 py-1.5 bg-emerald-600 text-white rounded-lg text-sm hover:bg-emerald-700 disabled:opacity-50">
                    {creatingTemplate ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                    Create Template
                  </button>
                </div>
              </div>
            )}

            {loadingTemplates ? (
              <div className="py-8 text-center">
                <Loader2 className="h-6 w-6 animate-spin mx-auto text-gray-400" />
              </div>
            ) : templates.length === 0 && !showCreateTemplate ? (
              <div className="py-8 text-center text-gray-500">
                <Repeat className="h-10 w-10 text-gray-300 mx-auto mb-2" />
                <p>No templates yet</p>
                <p className="text-sm mt-1">Create templates from completed shipments or use the New button above</p>
              </div>
            ) : (
              <div className="space-y-3">
                {templates.map((template) => (
                  <div key={template.id} className="p-4 border border-gray-200 rounded-lg hover:border-gray-300">
                    <div className="flex items-start justify-between">
                      <div>
                        <h4 className="font-medium text-gray-900">{template.name}</h4>
                        <p className="text-sm text-gray-500 mt-0.5">
                          {template.equipment_type} | {template.commodity || 'General'} | {template.weight_lbs ? `${template.weight_lbs.toLocaleString()} lbs` : '-'}
                        </p>
                        {template.recurrence_frequency && (
                          <span className="inline-flex items-center gap-1 mt-1 px-2 py-0.5 bg-blue-50 text-blue-700 rounded text-xs">
                            <Calendar className="h-3 w-3" />
                            {template.recurrence_frequency}
                          </span>
                        )}
                        <p className="text-xs text-gray-400 mt-1">
                          Booked {template.total_bookings} times
                          {template.last_booked_at && ` | Last: ${new Date(template.last_booked_at).toLocaleDateString()}`}
                        </p>
                      </div>
                      <button
                        onClick={() => handleBookFromTemplate(template.id)}
                        disabled={bookingTemplate === template.id}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 text-sm"
                      >
                        {bookingTemplate === template.id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Play className="h-3.5 w-3.5" />
                        )}
                        Book
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* LTL Consolidation Suggestions Modal */}
      {showConsolidation && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl p-6 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <Layers className="h-5 w-5 text-emerald-600" />
                LTL Consolidation Suggestions
              </h3>
              <button onClick={() => setShowConsolidation(false)}
                className="p-1.5 text-gray-400 hover:text-gray-600 rounded">
                <X className="h-5 w-5" />
              </button>
            </div>
            <p className="text-sm text-gray-500 mb-4">
              AI-detected opportunities to combine smaller shipments going the same direction for cost savings.
            </p>

            {loadingConsolidation ? (
              <div className="py-8 text-center">
                <Loader2 className="h-6 w-6 animate-spin mx-auto text-gray-400" />
              </div>
            ) : consolidationSuggestions.length === 0 ? (
              <div className="py-8 text-center text-gray-500">
                <Layers className="h-10 w-10 text-gray-300 mx-auto mb-2" />
                <p>No consolidation opportunities found</p>
                <p className="text-sm mt-1">Suggestions appear when multiple booked shipments share similar lanes and dates</p>
              </div>
            ) : (
              <div className="space-y-4">
                {consolidationSuggestions.map((suggestion, i) => (
                  <div key={i} className="p-4 border border-gray-200 rounded-lg">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-medium text-gray-900">
                            {suggestion.shared_origin || 'Multiple Origins'} <ArrowRight className="h-3 w-3 inline" /> {suggestion.shared_destination || 'Multiple Destinations'}
                          </span>
                        </div>
                        <div className="grid grid-cols-3 gap-4 text-sm mt-2">
                          <div>
                            <span className="text-gray-500">Shipments:</span>{' '}
                            <span className="font-medium">{suggestion.shipment_ids?.length || suggestion.shipment_numbers?.length || 0}</span>
                          </div>
                          <div>
                            <span className="text-gray-500">Total Weight:</span>{' '}
                            <span className="font-medium">{(suggestion.total_weight_lbs || 0).toLocaleString()} lbs</span>
                          </div>
                          <div>
                            <span className="text-gray-500">Est. Savings:</span>{' '}
                            <span className="font-medium text-emerald-600">${((suggestion.estimated_savings || 0) / 100).toFixed(0)}</span>
                          </div>
                        </div>
                        {suggestion.shipment_numbers && suggestion.shipment_numbers.length > 0 && (
                          <p className="text-xs text-gray-400 mt-2">
                            Shipments: {suggestion.shipment_numbers.join(', ')}
                          </p>
                        )}
                      </div>
                      <button
                        onClick={() => handleConsolidate(suggestion.shipment_ids || [])}
                        disabled={consolidating === (suggestion.shipment_ids || []).join(',')}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 text-sm whitespace-nowrap"
                      >
                        {consolidating === (suggestion.shipment_ids || []).join(',') ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Layers className="h-3.5 w-3.5" />
                        )}
                        Consolidate
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
