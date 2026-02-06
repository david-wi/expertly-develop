import { useQuery } from '@tanstack/react-query'
import { Building2, FileText, Lightbulb, AlertTriangle } from 'lucide-react'
import { Link } from 'react-router-dom'
import { dashboardApi, hypothesesApi } from '../services/api'
import { StatCard } from '../components/StatCard'
import { SignalBadge } from '../components/SignalBadge'
import { EmptyState } from '../components/EmptyState'
import { useState } from 'react'

export function Dashboard() {
  const [filterHypothesis, setFilterHypothesis] = useState<string>('')
  const [filterSignal, setFilterSignal] = useState<string>('')

  const { data: stats } = useQuery({
    queryKey: ['dashboard', 'stats'],
    queryFn: dashboardApi.stats,
  })

  const { data: leaderboard } = useQuery({
    queryKey: ['dashboard', 'leaderboard', filterHypothesis, filterSignal],
    queryFn: () => dashboardApi.leaderboard({
      hypothesis_id: filterHypothesis || undefined,
      signal: filterSignal || undefined,
    }),
  })

  const { data: hypotheses } = useQuery({
    queryKey: ['hypotheses'],
    queryFn: () => hypothesesApi.list(),
  })

  const formatMarketCap = (cap: number | null) => {
    if (!cap) return '-'
    if (cap >= 1e12) return `$${(cap / 1e12).toFixed(1)}T`
    if (cap >= 1e9) return `$${(cap / 1e9).toFixed(1)}B`
    if (cap >= 1e6) return `$${(cap / 1e6).toFixed(0)}M`
    return `$${cap.toLocaleString()}`
  }

  const formatPE = (pe: number | null) => {
    if (!pe) return '-'
    return pe.toFixed(1)
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">The Aipocalypse Fund</h1>
        <p className="text-gray-500 mt-1">AI-impact investment research dashboard</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard icon={Building2} label="Companies Tracked" value={stats?.total_companies ?? 0} color="blue" />
        <StatCard icon={FileText} label="Research Reports" value={stats?.total_reports ?? 0} color="purple" />
        <StatCard icon={Lightbulb} label="Active Hypotheses" value={stats?.total_hypotheses ?? 0} color="green" />
        <StatCard icon={AlertTriangle} label="Strong Sell Alerts" value={stats?.strong_sell_count ?? 0} color="red" />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
        <div className="bg-red-50 rounded-lg p-3 text-center">
          <div className="text-2xl font-bold text-red-700">{stats?.strong_sell_count ?? 0}</div>
          <div className="text-xs text-red-600">Strong Sell</div>
        </div>
        <div className="bg-orange-50 rounded-lg p-3 text-center">
          <div className="text-2xl font-bold text-orange-700">{stats?.sell_count ?? 0}</div>
          <div className="text-xs text-orange-600">Sell</div>
        </div>
        <div className="bg-yellow-50 rounded-lg p-3 text-center">
          <div className="text-2xl font-bold text-yellow-700">{stats?.hold_count ?? 0}</div>
          <div className="text-xs text-yellow-600">Hold</div>
        </div>
        <div className="bg-green-50 rounded-lg p-3 text-center">
          <div className="text-2xl font-bold text-green-700">{stats?.buy_count ?? 0}</div>
          <div className="text-xs text-green-600">Buy</div>
        </div>
        <div className="bg-emerald-50 rounded-lg p-3 text-center">
          <div className="text-2xl font-bold text-emerald-700">{stats?.strong_buy_count ?? 0}</div>
          <div className="text-xs text-emerald-600">Strong Buy</div>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-gray-200">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between flex-wrap gap-3">
          <h2 className="text-lg font-semibold text-gray-900">Company Leaderboard</h2>
          <div className="flex gap-3">
            <select
              value={filterHypothesis}
              onChange={e => setFilterHypothesis(e.target.value)}
              className="text-sm border border-gray-300 rounded-lg px-3 py-1.5 text-gray-700"
            >
              <option value="">All Hypotheses</option>
              {hypotheses?.map(h => (
                <option key={h.id} value={h.id}>{h.title.slice(0, 40)}</option>
              ))}
            </select>
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
          </div>
        </div>

        {!leaderboard || leaderboard.length === 0 ? (
          <div className="p-8">
            <EmptyState
              icon={Building2}
              title="No companies yet"
              description="Add companies and generate research reports to see the leaderboard."
              action={{ label: 'Add Companies', onClick: () => window.location.href = '/hypotheses' }}
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Signal</th>
                  <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Company</th>
                  <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Ticker</th>
                  <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Industry</th>
                  <th className="text-right px-6 py-3 text-xs font-medium text-gray-500 uppercase">P/E Now</th>
                  <th className="text-right px-6 py-3 text-xs font-medium text-gray-500 uppercase">P/E 1yr</th>
                  <th className="text-right px-6 py-3 text-xs font-medium text-gray-500 uppercase">Market Cap</th>
                  <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Thesis</th>
                  <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Report</th>
                </tr>
              </thead>
              <tbody>
                {leaderboard.map(entry => (
                  <tr key={entry.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="px-6 py-3">
                      <SignalBadge signal={entry.signal} />
                    </td>
                    <td className="px-6 py-3">
                      <Link to={`/companies/${entry.id}`} className="text-sm font-medium text-violet-600 hover:text-violet-800">
                        {entry.name}
                      </Link>
                    </td>
                    <td className="px-6 py-3 text-sm text-gray-600 font-mono">{entry.ticker}</td>
                    <td className="px-6 py-3 text-sm text-gray-500">{entry.industry_name || '-'}</td>
                    <td className="px-6 py-3 text-sm text-gray-700 text-right font-mono">{formatPE(entry.current_pe)}</td>
                    <td className="px-6 py-3 text-sm text-gray-700 text-right font-mono">{formatPE(entry.historical_pe_1yr)}</td>
                    <td className="px-6 py-3 text-sm text-gray-700 text-right">{formatMarketCap(entry.market_cap)}</td>
                    <td className="px-6 py-3">
                      <div className="flex flex-wrap gap-1">
                        {entry.hypothesis_names.slice(0, 2).map((name, i) => (
                          <span key={i} className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full truncate max-w-[120px]">
                            {name}
                          </span>
                        ))}
                        {entry.hypothesis_names.length > 2 && (
                          <span className="text-xs text-gray-400">+{entry.hypothesis_names.length - 2}</span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-3 text-xs text-gray-400">
                      {entry.latest_report_date ? new Date(entry.latest_report_date).toLocaleDateString() : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
