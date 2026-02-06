import { useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, RefreshCw, FileText, X, ListTodo, Loader2 } from 'lucide-react'
import { companiesApi, reportsApi, hypothesesApi, queueApi } from '../services/api'
import { SignalBadge } from '../components/SignalBadge'
import { ConfidenceMeter } from '../components/ConfidenceMeter'

export function CompanyDetail() {
  const { id } = useParams<{ id: string }>()
  const queryClient = useQueryClient()
  const [generating, setGenerating] = useState(false)

  const { data: company, isLoading } = useQuery({
    queryKey: ['company', id],
    queryFn: () => companiesApi.get(id!),
    enabled: !!id,
  })

  const { data: reports } = useQuery({
    queryKey: ['reports', 'company', id],
    queryFn: () => reportsApi.list({ company_id: id }),
    enabled: !!id,
  })

  const { data: hypotheses } = useQuery({
    queryKey: ['hypotheses'],
    queryFn: () => hypothesesApi.list(),
  })

  const refreshMutation = useMutation({
    mutationFn: () => companiesApi.refreshFinancials(id!),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['company', id] }),
  })

  const linkMutation = useMutation({
    mutationFn: (hypId: string) => companiesApi.linkHypothesis(id!, hypId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['company', id] }),
  })

  const unlinkMutation = useMutation({
    mutationFn: (hypId: string) => companiesApi.unlinkHypothesis(id!, hypId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['company', id] }),
  })

  const generateReport = async () => {
    setGenerating(true)
    try {
      await reportsApi.generate(id!)
      queryClient.invalidateQueries({ queryKey: ['reports', 'company', id] })
      queryClient.invalidateQueries({ queryKey: ['company', id] })
    } catch (e) {
      alert('Report generation failed. Check that an API key is configured in Settings.')
    } finally {
      setGenerating(false)
    }
  }

  const addToQueue = async () => {
    if (!company) return
    try {
      await queueApi.add({ company_id: company.id, company_name: company.name, company_ticker: company.ticker })
      alert('Added to research queue')
    } catch {
      alert('Failed to add to queue')
    }
  }

  const formatCurrency = (val: number | null) => {
    if (!val) return '-'
    if (val >= 1e12) return `$${(val / 1e12).toFixed(2)}T`
    if (val >= 1e9) return `$${(val / 1e9).toFixed(2)}B`
    if (val >= 1e6) return `$${(val / 1e6).toFixed(0)}M`
    return `$${val.toLocaleString()}`
  }

  const formatPercent = (val: number | null) => {
    if (val == null) return '-'
    return `${(val * 100).toFixed(1)}%`
  }

  if (isLoading || !company) {
    return <div className="text-center py-12 text-gray-500">Loading...</div>
  }

  const linkedHyps = hypotheses?.filter(h => company.linked_hypothesis_ids.includes(h.id)) ?? []
  const availableHyps = hypotheses?.filter(h => !company.linked_hypothesis_ids.includes(h.id) && h.status === 'active') ?? []

  return (
    <div>
      <Link to="/" className="text-sm text-violet-600 hover:text-violet-800 flex items-center gap-1 mb-4">
        <ArrowLeft className="w-3 h-3" /> Back to Dashboard
      </Link>

      {/* Header */}
      <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-2xl font-bold text-gray-900">{company.name}</h1>
              <span className="text-lg font-mono text-gray-500">{company.ticker}</span>
              <SignalBadge signal={company.latest_signal} size="lg" />
            </div>
            {company.description && (
              <p className="text-sm text-gray-600 max-w-2xl line-clamp-2">{company.description}</p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => refreshMutation.mutate()}
              disabled={refreshMutation.isPending}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${refreshMutation.isPending ? 'animate-spin' : ''}`} />
              Refresh Financials
            </button>
            <button
              onClick={addToQueue}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              <ListTodo className="w-3.5 h-3.5" />
              Add to Queue
            </button>
            <button
              onClick={generateReport}
              disabled={generating}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-violet-600 text-white rounded-lg hover:bg-violet-700 disabled:opacity-50"
            >
              {generating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileText className="w-3.5 h-3.5" />}
              {generating ? 'Generating...' : 'Generate Report'}
            </button>
          </div>
        </div>
      </div>

      {/* Financial Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 mb-6">
        {[
          { label: 'Price', value: company.current_price ? `$${company.current_price.toFixed(2)}` : '-' },
          { label: 'Market Cap', value: formatCurrency(company.market_cap) },
          { label: 'P/E (TTM)', value: company.current_pe?.toFixed(1) ?? '-' },
          { label: 'Forward P/E', value: company.forward_pe?.toFixed(1) ?? '-' },
          { label: 'Gross Margin', value: formatPercent(company.gross_margin) },
          { label: 'Op Margin', value: formatPercent(company.operating_margin) },
        ].map(({ label, value }) => (
          <div key={label} className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="text-xs text-gray-500 mb-1">{label}</div>
            <div className="text-lg font-semibold text-gray-900 font-mono">{value}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Linked Hypotheses */}
        <div className="bg-white rounded-lg border border-gray-200 p-5">
          <h3 className="text-sm font-semibold text-gray-900 mb-3">Linked Hypotheses</h3>
          <div className="space-y-2 mb-3">
            {linkedHyps.map(h => (
              <div key={h.id} className="flex items-center justify-between bg-violet-50 rounded-lg px-3 py-2">
                <span className="text-sm text-violet-800 truncate">{h.title}</span>
                <button onClick={() => unlinkMutation.mutate(h.id)} className="text-violet-400 hover:text-red-500 ml-2 flex-shrink-0">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
            {linkedHyps.length === 0 && <p className="text-xs text-gray-400">No hypotheses linked</p>}
          </div>
          {availableHyps.length > 0 && (
            <select
              onChange={e => { if (e.target.value) linkMutation.mutate(e.target.value); e.target.value = '' }}
              className="w-full text-sm border border-gray-300 rounded-lg px-2 py-1.5"
              defaultValue=""
            >
              <option value="" disabled>Link a hypothesis...</option>
              {availableHyps.map(h => (
                <option key={h.id} value={h.id}>{h.title}</option>
              ))}
            </select>
          )}
        </div>

        {/* Reports Timeline */}
        <div className="lg:col-span-2 bg-white rounded-lg border border-gray-200 p-5">
          <h3 className="text-sm font-semibold text-gray-900 mb-3">Research Reports</h3>
          {!reports || reports.length === 0 ? (
            <p className="text-sm text-gray-400">No reports yet. Generate one to get started.</p>
          ) : (
            <div className="space-y-3">
              {reports.map(r => (
                <Link
                  key={r.id}
                  to={`/reports/${r.id}`}
                  className="block border border-gray-200 rounded-lg p-4 hover:border-violet-300 hover:shadow-sm transition-all"
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <SignalBadge signal={r.signal} />
                      <span className="text-xs text-gray-400">v{r.version}</span>
                    </div>
                    <span className="text-xs text-gray-400">{new Date(r.created_at).toLocaleDateString()}</span>
                  </div>
                  <p className="text-sm text-gray-600 line-clamp-2">{r.executive_summary}</p>
                  <div className="flex items-center gap-3 mt-2">
                    <ConfidenceMeter value={r.signal_confidence} label="Confidence" />
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
