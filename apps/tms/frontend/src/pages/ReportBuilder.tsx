import { useState, useEffect } from 'react'
import { api } from '../services/api'
import PageHelp from '../components/PageHelp'
import type { ReportBuildResult, SavedReport } from '../types'
import {
  BarChart3,
  Table,
  PieChart,
  TrendingUp,
  Play,
  Save,
  Download,
  Trash2,
  Plus,
  X,
  Filter,
  Layers,
  BookOpen,
} from 'lucide-react'

const DATA_SOURCES = [
  { value: 'shipments', label: 'Shipments' },
  { value: 'invoices', label: 'Invoices' },
  { value: 'carriers', label: 'Carriers' },
  { value: 'customers', label: 'Customers' },
]

const COLUMN_OPTIONS: Record<string, string[]> = {
  shipments: ['shipment_number', 'status', 'customer_price', 'carrier_cost', 'margin', 'equipment_type', 'total_miles', 'created_at'],
  invoices: ['invoice_number', 'status', 'total', 'amount_paid', 'amount_due', 'invoice_date', 'due_date'],
  carriers: ['name', 'mc_number', 'status', 'total_loads', 'on_time_percentage', 'claims_count'],
  customers: ['name', 'status', 'total_shipments', 'total_revenue', 'payment_terms', 'credit_limit'],
}

const OPERATORS = [
  { value: 'equals', label: 'Equals' },
  { value: 'not_equals', label: 'Not Equals' },
  { value: 'greater_than', label: 'Greater Than' },
  { value: 'less_than', label: 'Less Than' },
  { value: 'contains', label: 'Contains' },
  { value: 'in', label: 'In' },
]

const AGG_FUNCTIONS = [
  { value: 'sum', label: 'Sum' },
  { value: 'avg', label: 'Average' },
  { value: 'count', label: 'Count' },
  { value: 'min', label: 'Min' },
  { value: 'max', label: 'Max' },
]

const CHART_TYPES = [
  { value: 'table', label: 'Table', icon: Table },
  { value: 'bar', label: 'Bar Chart', icon: BarChart3 },
  { value: 'line', label: 'Line Chart', icon: TrendingUp },
  { value: 'pie', label: 'Pie Chart', icon: PieChart },
]

interface ReportFilter {
  field: string
  operator: string
  value: string
}

interface Aggregation {
  field: string
  function: string
}

export default function ReportBuilder() {
  const [dataSources, setDataSources] = useState<string[]>(['shipments'])
  const [columns, setColumns] = useState<string[]>(['shipment_number', 'status', 'customer_price', 'carrier_cost'])
  const [filters, setFilters] = useState<ReportFilter[]>([])
  const [grouping, setGrouping] = useState<string[]>([])
  const [aggregations, setAggregations] = useState<Aggregation[]>([])
  const [chartType, setChartType] = useState('table')
  const [sortBy, setSortBy] = useState('')
  const [sortOrder, setSortOrder] = useState('desc')
  const [reportLimit, setReportLimit] = useState(100)

  const [result, setResult] = useState<ReportBuildResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [savedReports, setSavedReports] = useState<SavedReport[]>([])
  const [showSaveDialog, setShowSaveDialog] = useState(false)
  const [saveName, setSaveName] = useState('')
  const [saveDescription, setSaveDescription] = useState('')

  useEffect(() => {
    fetchSavedReports()
  }, [])

  const fetchSavedReports = async () => {
    try {
      const data = await api.getSavedReports()
      setSavedReports(data)
    } catch {
      // Ignore
    }
  }

  const availableColumns = dataSources.flatMap(ds => COLUMN_OPTIONS[ds] || [])

  const handleRunReport = async () => {
    setLoading(true)
    try {
      const data = await api.buildCustomReport({
        data_sources: dataSources,
        columns,
        filters: filters.length > 0 ? filters.map(f => ({ field: f.field, operator: f.operator, value: f.value })) : undefined,
        grouping: grouping.length > 0 ? grouping : undefined,
        aggregations: aggregations.length > 0 ? aggregations : undefined,
        sort_by: sortBy || undefined,
        sort_order: sortOrder,
        chart_type: chartType !== 'table' ? chartType : undefined,
        limit: reportLimit,
      })
      setResult(data)
    } catch (error) {
      console.error('Failed to build report:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    if (!saveName) return
    try {
      await api.saveCustomReport({
        name: saveName,
        description: saveDescription || undefined,
        config: { dataSources, columns, filters, grouping, aggregations, chartType, sortBy, sortOrder, reportLimit },
      })
      setShowSaveDialog(false)
      setSaveName('')
      setSaveDescription('')
      fetchSavedReports()
    } catch (error) {
      console.error('Failed to save report:', error)
    }
  }

  const loadSavedReport = (report: SavedReport) => {
    const c = report.config as Record<string, unknown>
    if (c.dataSources) setDataSources(c.dataSources as string[])
    if (c.columns) setColumns(c.columns as string[])
    if (c.filters) setFilters(c.filters as ReportFilter[])
    if (c.grouping) setGrouping(c.grouping as string[])
    if (c.aggregations) setAggregations(c.aggregations as Aggregation[])
    if (c.chartType) setChartType(c.chartType as string)
    if (c.sortBy) setSortBy(c.sortBy as string)
    if (c.sortOrder) setSortOrder(c.sortOrder as string)
    if (c.reportLimit) setReportLimit(c.reportLimit as number)
  }

  const handleDeleteSaved = async (id: string) => {
    try {
      await api.deleteSavedReport(id)
      setSavedReports(savedReports.filter(r => r.id !== id))
    } catch (error) {
      console.error('Failed to delete report:', error)
    }
  }

  const formatValue = (val: unknown): string => {
    if (val === null || val === undefined) return '-'
    if (typeof val === 'number') {
      if (val > 100000) return `$${(val / 100).toLocaleString('en-US', { minimumFractionDigits: 2 })}`
      return val.toLocaleString()
    }
    return String(val)
  }

  const addFilter = () => setFilters([...filters, { field: availableColumns[0] || '', operator: 'equals', value: '' }])
  const removeFilter = (idx: number) => setFilters(filters.filter((_, i) => i !== idx))
  const addAggregation = () => setAggregations([...aggregations, { field: availableColumns[0] || '', function: 'sum' }])
  const removeAggregation = (idx: number) => setAggregations(aggregations.filter((_, i) => i !== idx))

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Layers className="h-7 w-7 text-violet-600" />
            Report Builder
            <PageHelp pageId="report-builder" />
          </h1>
          <p className="text-gray-500">Build custom reports from your TMS data</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowSaveDialog(true)} className="flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50">
            <Save className="h-4 w-4" /> Save
          </button>
          <button
            onClick={handleRunReport}
            disabled={loading || columns.length === 0}
            className="flex items-center gap-2 px-4 py-2 bg-violet-600 text-white rounded-lg hover:bg-violet-700 disabled:opacity-50 text-sm"
          >
            <Play className="h-4 w-4" /> {loading ? 'Running...' : 'Run Report'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Configuration Panel */}
        <div className="lg:col-span-1 space-y-4">
          {/* Data Sources */}
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Data Sources</h3>
            <div className="space-y-2">
              {DATA_SOURCES.map(ds => (
                <label key={ds.value} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={dataSources.includes(ds.value)}
                    onChange={(e) => {
                      if (e.target.checked) setDataSources([...dataSources, ds.value])
                      else setDataSources(dataSources.filter(d => d !== ds.value))
                    }}
                    className="rounded text-violet-600 focus:ring-violet-500"
                  />
                  {ds.label}
                </label>
              ))}
            </div>
          </div>

          {/* Columns */}
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Columns</h3>
            <div className="space-y-1.5 max-h-48 overflow-y-auto">
              {availableColumns.map(col => (
                <label key={col} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={columns.includes(col)}
                    onChange={(e) => {
                      if (e.target.checked) setColumns([...columns, col])
                      else setColumns(columns.filter(c => c !== col))
                    }}
                    className="rounded text-violet-600 focus:ring-violet-500"
                  />
                  {col.replace(/_/g, ' ')}
                </label>
              ))}
            </div>
          </div>

          {/* Chart Type */}
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Visualization</h3>
            <div className="grid grid-cols-2 gap-2">
              {CHART_TYPES.map(ct => {
                const Icon = ct.icon
                return (
                  <button
                    key={ct.value}
                    onClick={() => setChartType(ct.value)}
                    className={`flex flex-col items-center gap-1 p-2 rounded-lg border text-xs transition-colors ${
                      chartType === ct.value ? 'border-violet-600 bg-violet-50 text-violet-700' : 'border-gray-200 text-gray-500 hover:bg-gray-50'
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    {ct.label}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Filters */}
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-1">
                <Filter className="h-3.5 w-3.5" /> Filters
              </h3>
              <button onClick={addFilter} className="text-violet-600 hover:text-violet-700"><Plus className="h-4 w-4" /></button>
            </div>
            {filters.map((f, idx) => (
              <div key={idx} className="flex gap-1 mb-2">
                <select value={f.field} onChange={(e) => { const nf = [...filters]; nf[idx].field = e.target.value; setFilters(nf) }} className="flex-1 text-xs border border-gray-200 rounded px-1 py-1">
                  {availableColumns.map(col => <option key={col} value={col}>{col}</option>)}
                </select>
                <select value={f.operator} onChange={(e) => { const nf = [...filters]; nf[idx].operator = e.target.value; setFilters(nf) }} className="w-20 text-xs border border-gray-200 rounded px-1 py-1">
                  {OPERATORS.map(op => <option key={op.value} value={op.value}>{op.label}</option>)}
                </select>
                <input value={f.value} onChange={(e) => { const nf = [...filters]; nf[idx].value = e.target.value; setFilters(nf) }} className="w-20 text-xs border border-gray-200 rounded px-1 py-1" placeholder="Value" />
                <button onClick={() => removeFilter(idx)} className="text-gray-400 hover:text-red-500"><X className="h-3.5 w-3.5" /></button>
              </div>
            ))}
          </div>

          {/* Grouping */}
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Group By</h3>
            <select
              multiple
              value={grouping}
              onChange={(e) => setGrouping(Array.from(e.target.selectedOptions, o => o.value))}
              className="w-full text-xs border border-gray-200 rounded p-1 h-20"
            >
              {availableColumns.map(col => <option key={col} value={col}>{col}</option>)}
            </select>
          </div>

          {/* Aggregations */}
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-gray-700">Aggregations</h3>
              <button onClick={addAggregation} className="text-violet-600 hover:text-violet-700"><Plus className="h-4 w-4" /></button>
            </div>
            {aggregations.map((a, idx) => (
              <div key={idx} className="flex gap-1 mb-2">
                <select value={a.function} onChange={(e) => { const na = [...aggregations]; na[idx].function = e.target.value; setAggregations(na) }} className="w-20 text-xs border border-gray-200 rounded px-1 py-1">
                  {AGG_FUNCTIONS.map(fn => <option key={fn.value} value={fn.value}>{fn.label}</option>)}
                </select>
                <select value={a.field} onChange={(e) => { const na = [...aggregations]; na[idx].field = e.target.value; setAggregations(na) }} className="flex-1 text-xs border border-gray-200 rounded px-1 py-1">
                  {availableColumns.map(col => <option key={col} value={col}>{col}</option>)}
                </select>
                <button onClick={() => removeAggregation(idx)} className="text-gray-400 hover:text-red-500"><X className="h-3.5 w-3.5" /></button>
              </div>
            ))}
          </div>

          {/* Saved Reports */}
          {savedReports.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-1">
                <BookOpen className="h-3.5 w-3.5" /> Saved Reports
              </h3>
              <div className="space-y-2">
                {savedReports.map(r => (
                  <div key={r.id} className="flex items-center justify-between">
                    <button onClick={() => loadSavedReport(r)} className="text-sm text-violet-600 hover:text-violet-700 truncate">
                      {r.name}
                    </button>
                    <button onClick={() => handleDeleteSaved(r.id)} className="text-gray-400 hover:text-red-500">
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Results Panel */}
        <div className="lg:col-span-3">
          {!result && !loading && (
            <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
              <BarChart3 className="h-12 w-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500">Configure your report and click "Run Report"</p>
              <p className="text-sm text-gray-400 mt-2">Select data sources, columns, filters, and visualization type</p>
            </div>
          )}

          {loading && (
            <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
              <div className="animate-spin h-8 w-8 border-4 border-violet-600 border-t-transparent rounded-full mx-auto mb-4" />
              <p className="text-gray-500">Building report...</p>
            </div>
          )}

          {result && !loading && (
            <div className="space-y-4">
              {/* Summary */}
              <div className="bg-white rounded-xl border border-gray-200 p-4 flex items-center justify-between">
                <div className="flex items-center gap-4 text-sm text-gray-600">
                  <span className="font-medium">{result.total_rows} rows</span>
                  <span>{result.columns.length} columns</span>
                  <span className="text-xs text-gray-400">Generated {new Date(result.generated_at).toLocaleTimeString()}</span>
                </div>
                <button className="flex items-center gap-1 text-sm text-violet-600 hover:text-violet-700">
                  <Download className="h-4 w-4" /> Export
                </button>
              </div>

              {/* Chart Preview */}
              {result.chart_data && chartType !== 'table' && (
                <div className="bg-white rounded-xl border border-gray-200 p-6">
                  <h3 className="text-sm font-semibold text-gray-700 mb-4">Chart Preview</h3>
                  {chartType === 'bar' && result.chart_data.labels && result.chart_data.datasets && (
                    <div className="h-64 flex items-end gap-2">
                      {result.chart_data.labels.map((label: string, idx: number) => {
                        const maxVal = Math.max(...(result.chart_data?.datasets?.[0]?.data || [1]))
                        const val = result.chart_data?.datasets?.[0]?.data?.[idx] || 0
                        const pct = maxVal > 0 ? (val / maxVal) * 100 : 0
                        return (
                          <div key={idx} className="flex-1 flex flex-col items-center gap-1" title={`${label}: ${val}`}>
                            <div className="w-full bg-violet-500 rounded-t transition-all" style={{ height: `${Math.max(pct, 4)}%` }} />
                            <span className="text-xs text-gray-400 truncate max-w-full">{label}</span>
                          </div>
                        )
                      })}
                    </div>
                  )}
                  {chartType === 'pie' && result.chart_data.labels && result.chart_data.data && (
                    <div className="flex items-center gap-8">
                      <div className="w-48 h-48 rounded-full border-8 border-violet-500 flex items-center justify-center">
                        <span className="text-2xl font-bold text-gray-700">{(result.chart_data.data as number[]).reduce((a: number, b: number) => a + b, 0)}</span>
                      </div>
                      <div className="space-y-2">
                        {(result.chart_data.labels as string[]).map((label: string, idx: number) => (
                          <div key={idx} className="flex items-center gap-2 text-sm">
                            <div className="w-3 h-3 rounded" style={{ backgroundColor: `hsl(${idx * 50}, 60%, 50%)` }} />
                            <span className="text-gray-600">{label}: {(result.chart_data?.data as number[])?.[idx]}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Aggregations */}
              {result.aggregations && Object.keys(result.aggregations).length > 0 && (
                <div className="bg-white rounded-xl border border-gray-200 p-4">
                  <h3 className="text-sm font-semibold text-gray-700 mb-3">Aggregations</h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {Object.entries(result.aggregations).map(([key, val]) => (
                      <div key={key} className="p-3 bg-violet-50 rounded-lg">
                        <p className="text-xs text-gray-500">{key.replace(/_/g, ' ')}</p>
                        <p className="text-lg font-bold text-violet-700">{formatValue(val)}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Data Table */}
              <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-gray-200 bg-gray-50">
                        {result.columns.map(col => (
                          <th
                            key={col}
                            onClick={() => { setSortBy(col); setSortOrder(sortOrder === 'desc' ? 'asc' : 'desc') }}
                            className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide cursor-pointer hover:bg-gray-100"
                          >
                            {col.replace(/_/g, ' ')}
                            {sortBy === col && <span className="ml-1">{sortOrder === 'desc' ? '\u25BC' : '\u25B2'}</span>}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {result.rows.map((row, idx) => (
                        <tr key={idx} className="hover:bg-gray-50">
                          {result.columns.map(col => (
                            <td key={col} className="px-4 py-3 text-sm text-gray-700">
                              {formatValue(row[col])}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {result.rows.length === 0 && (
                  <div className="p-8 text-center text-gray-500">No data matches your criteria</div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Save Dialog */}
      {showSaveDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-96 space-y-4">
            <h3 className="text-lg font-semibold text-gray-900">Save Report</h3>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
              <input
                type="text"
                value={saveName}
                onChange={(e) => setSaveName(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-violet-500"
                placeholder="My Custom Report"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Description (optional)</label>
              <textarea
                value={saveDescription}
                onChange={(e) => setSaveDescription(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-violet-500"
                rows={2}
              />
            </div>
            <div className="flex justify-end gap-3">
              <button onClick={() => setShowSaveDialog(false)} className="px-4 py-2 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50">Cancel</button>
              <button onClick={handleSave} disabled={!saveName} className="px-4 py-2 bg-violet-600 text-white rounded-lg hover:bg-violet-700 disabled:opacity-50">Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
