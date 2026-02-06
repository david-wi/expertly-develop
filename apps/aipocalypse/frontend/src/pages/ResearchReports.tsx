import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { FileText, Search } from 'lucide-react'
import { reportsApi } from '../services/api'
import { SignalBadge } from '../components/SignalBadge'
import { ConfidenceMeter } from '../components/ConfidenceMeter'
import { EmptyState } from '../components/EmptyState'
import type { SignalRating } from '../types'

const moatColors: Record<string, string> = {
  strong: 'bg-emerald-100 text-emerald-800',
  moderate: 'bg-green-100 text-green-800',
  weak: 'bg-yellow-100 text-yellow-800',
  none: 'bg-red-100 text-red-800',
}

export function ResearchReports() {
  const [searchQuery, setSearchQuery] = useState('')
  const [filterSignal, setFilterSignal] = useState<string>('')

  const { data: reports, isLoading } = useQuery({
    queryKey: ['reports', 'all'],
    queryFn: () => reportsApi.list({ limit: 500 }),
  })

  const filtered = reports?.filter(r => {
    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      if (!r.company_name.toLowerCase().includes(q) && !r.company_ticker.toLowerCase().includes(q)) {
        return false
      }
    }
    if (filterSignal && r.signal !== filterSignal) {
      return false
    }
    return true
  })

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Research Reports</h1>
        <p className="text-gray-500 mt-1">All published research reports, newest first</p>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg border border-gray-200 px-4 py-3 mb-6 flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search by company name or ticker..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent"
          />
        </div>
        <select
          value={filterSignal}
          onChange={e => setFilterSignal(e.target.value)}
          className="text-sm border border-gray-300 rounded-lg px-3 py-1.5 text-gray-700"
        >
          <option value="">All Signals</option>
          <option value="strong_sell">Strong Sell</option>
          <option value="sell">Sell</option>
          <option value="hold">Hold</option>
          <option value="buy">Buy</option>
          <option value="strong_buy">Strong Buy</option>
        </select>
        {filtered && (
          <span className="text-sm text-gray-400">
            {filtered.length} report{filtered.length !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      {/* Report List */}
      {isLoading ? (
        <div className="text-center py-12 text-gray-500">Loading reports...</div>
      ) : !filtered || filtered.length === 0 ? (
        <EmptyState
          icon={FileText}
          title={searchQuery || filterSignal ? 'No matching reports' : 'No research reports yet'}
          description={
            searchQuery || filterSignal
              ? 'Try adjusting your search or filter criteria.'
              : 'Generate reports from the Research Queue or from individual company pages.'
          }
        />
      ) : (
        <div className="space-y-3">
          {filtered.map(r => (
            <Link
              key={r.id}
              to={`/reports/${r.id}`}
              className="block bg-white rounded-lg border border-gray-200 p-5 hover:border-violet-300 hover:shadow-sm transition-all"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-base font-semibold text-gray-900 truncate">
                      {r.company_name}
                    </h3>
                    <span className="text-sm font-mono text-gray-500 flex-shrink-0">{r.company_ticker}</span>
                    <SignalBadge signal={r.signal as SignalRating} />
                    <span className="text-xs text-gray-400 flex-shrink-0">v{r.version}</span>
                  </div>
                  <p className="text-sm text-gray-600 line-clamp-2">{r.executive_summary}</p>
                  <div className="flex items-center gap-4 mt-3">
                    <div className="w-32">
                      <ConfidenceMeter value={r.signal_confidence} label="Confidence" />
                    </div>
                    <div className="w-32">
                      <ConfidenceMeter value={r.ai_vulnerability_score} label="AI Vulnerability" />
                    </div>
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${moatColors[r.moat_rating] || moatColors.none}`}>
                      Moat: {r.moat_rating.charAt(0).toUpperCase() + r.moat_rating.slice(1)}
                    </span>
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                  <div className="text-sm text-gray-500">
                    {new Date(r.created_at).toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric',
                    })}
                  </div>
                  <div className="text-xs text-gray-400 mt-1">
                    {new Date(r.created_at).toLocaleTimeString('en-US', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
