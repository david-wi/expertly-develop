import { useParams, Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, Clock, Cpu, FileText, TrendingUp, TrendingDown, BarChart3, Users, Briefcase, DollarSign, Shield, Zap, Swords, Target, LineChart, Building2, Lightbulb } from 'lucide-react'
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import { reportsApi } from '../services/api'
import { SignalBadge } from '../components/SignalBadge'
import { ConfidenceMeter } from '../components/ConfidenceMeter'
import { MarkdownRenderer } from '../components/MarkdownRenderer'
import type { KeyMetrics, AnalystConsensus, PricePoint } from '../types'

function formatLargeNumber(value: number | undefined): string {
  if (value === undefined || value === null) return '—'
  if (Math.abs(value) >= 1e12) return `$${(value / 1e12).toFixed(2)}T`
  if (Math.abs(value) >= 1e9) return `$${(value / 1e9).toFixed(2)}B`
  if (Math.abs(value) >= 1e6) return `$${(value / 1e6).toFixed(1)}M`
  return `$${value.toLocaleString()}`
}

function formatPercent(value: number | undefined): string {
  if (value === undefined || value === null) return '—'
  return `${(value * 100).toFixed(1)}%`
}

function formatRatio(value: number | undefined): string {
  if (value === undefined || value === null) return '—'
  return value.toFixed(2)
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-gray-50 rounded-lg p-3">
      <div className="text-xs text-gray-500 mb-1">{label}</div>
      <div className="text-sm font-semibold text-gray-900">{value}</div>
    </div>
  )
}

function KeyMetricsSection({ metrics }: { metrics: KeyMetrics }) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6">
      <div className="flex items-center gap-2 mb-4">
        <BarChart3 className="w-5 h-5 text-violet-600" />
        <h2 className="text-lg font-semibold text-gray-900">Key Financial Metrics</h2>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        <MetricCard label="Trailing P/E" value={formatRatio(metrics.trailingPE)} />
        <MetricCard label="Forward P/E" value={formatRatio(metrics.forwardPE)} />
        <MetricCard label="Market Cap" value={formatLargeNumber(metrics.marketCap)} />
        <MetricCard label="Enterprise Value" value={formatLargeNumber(metrics.enterpriseValue)} />
        <MetricCard label="Revenue" value={formatLargeNumber(metrics.totalRevenue)} />
        <MetricCard label="EBITDA" value={formatLargeNumber(metrics.ebitda)} />
        <MetricCard label="Free Cash Flow" value={formatLargeNumber(metrics.freeCashflow)} />
        <MetricCard label="Cash" value={formatLargeNumber(metrics.totalCash)} />
        <MetricCard label="Debt" value={formatLargeNumber(metrics.totalDebt)} />
        <MetricCard label="P/B Ratio" value={formatRatio(metrics.priceToBook)} />
        <MetricCard label="P/S Ratio" value={formatRatio(metrics.priceToSalesTrailing12Months)} />
        <MetricCard label="Beta" value={formatRatio(metrics.beta)} />
        <MetricCard label="ROE" value={formatPercent(metrics.returnOnEquity)} />
        <MetricCard label="Gross Margin" value={formatPercent(metrics.grossMargins)} />
        <MetricCard label="Operating Margin" value={formatPercent(metrics.operatingMargins)} />
        <MetricCard label="Profit Margin" value={formatPercent(metrics.profitMargins)} />
        <MetricCard label="Revenue Growth" value={formatPercent(metrics.revenueGrowth)} />
        <MetricCard label="Earnings Growth" value={formatPercent(metrics.earningsGrowth)} />
        {metrics.dividendYield !== undefined && (
          <MetricCard label="Dividend Yield" value={formatPercent(metrics.dividendYield)} />
        )}
      </div>
    </div>
  )
}

function PriceChartSection({ data, ticker }: { data: PricePoint[]; ticker: string }) {
  const first = data[0]?.close ?? 0
  const last = data[data.length - 1]?.close ?? 0
  const change = first > 0 ? ((last - first) / first) * 100 : 0
  const isPositive = change >= 0

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-violet-600" />
          <h2 className="text-lg font-semibold text-gray-900">{ticker} — 1 Year Price History</h2>
        </div>
        <div className={`flex items-center gap-1 text-sm font-medium ${isPositive ? 'text-emerald-600' : 'text-red-600'}`}>
          {isPositive ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
          {change >= 0 ? '+' : ''}{change.toFixed(1)}%
        </div>
      </div>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data}>
            <defs>
              <linearGradient id="priceGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={isPositive ? '#10b981' : '#ef4444'} stopOpacity={0.3} />
                <stop offset="95%" stopColor={isPositive ? '#10b981' : '#ef4444'} stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis
              dataKey="date"
              tick={{ fontSize: 11, fill: '#9ca3af' }}
              tickFormatter={(d: string) => {
                const date = new Date(d)
                return `${date.toLocaleString('default', { month: 'short' })} ${date.getFullYear().toString().slice(-2)}`
              }}
              interval="preserveStartEnd"
              minTickGap={60}
            />
            <YAxis
              domain={['auto', 'auto']}
              tick={{ fontSize: 11, fill: '#9ca3af' }}
              tickFormatter={(v: number) => `$${v.toFixed(0)}`}
              width={60}
            />
            <Tooltip
              content={({ active, payload }) => {
                if (!active || !payload?.[0]) return null
                const d = payload[0].payload as PricePoint
                return (
                  <div className="bg-white border border-gray-200 rounded-lg shadow-lg px-3 py-2 text-sm">
                    <div className="text-gray-500">{new Date(d.date).toLocaleDateString()}</div>
                    <div className="font-semibold text-gray-900">${d.close.toFixed(2)}</div>
                  </div>
                )
              }}
            />
            <Area
              type="monotone"
              dataKey="close"
              stroke={isPositive ? '#10b981' : '#ef4444'}
              strokeWidth={2}
              fill="url(#priceGradient)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

function recommendationLabel(key: string | null): string {
  const map: Record<string, string> = {
    strong_buy: 'Strong Buy',
    buy: 'Buy',
    hold: 'Hold',
    underperform: 'Underperform',
    sell: 'Sell',
  }
  return key ? (map[key] || key.charAt(0).toUpperCase() + key.slice(1)) : '—'
}

function recommendationColor(key: string | null): string {
  if (!key) return 'bg-gray-100 text-gray-700'
  if (key.includes('buy') || key === 'strong_buy') return 'bg-emerald-100 text-emerald-800'
  if (key === 'hold') return 'bg-yellow-100 text-yellow-800'
  return 'bg-red-100 text-red-800'
}

function AnalystConsensusSection({ data }: { data: AnalystConsensus }) {
  const upside = data.currentPrice && data.targetMeanPrice
    ? ((data.targetMeanPrice - data.currentPrice) / data.currentPrice) * 100
    : null

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6">
      <div className="flex items-center gap-2 mb-4">
        <Users className="w-5 h-5 text-violet-600" />
        <h2 className="text-lg font-semibold text-gray-900">Analyst Consensus</h2>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div>
          <div className="text-xs text-gray-500 mb-1">Consensus Rating</div>
          <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${recommendationColor(data.recommendationKey)}`}>
            {recommendationLabel(data.recommendationKey)}
          </span>
          {data.recommendationMean && (
            <div className="text-xs text-gray-400 mt-1">Score: {data.recommendationMean.toFixed(1)} / 5</div>
          )}
        </div>
        <div>
          <div className="text-xs text-gray-500 mb-1">Price Target (Mean)</div>
          <div className="text-lg font-semibold text-gray-900">
            {data.targetMeanPrice ? `$${data.targetMeanPrice.toFixed(2)}` : '—'}
          </div>
          {upside !== null && (
            <div className={`text-xs font-medium ${upside >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
              {upside >= 0 ? '+' : ''}{upside.toFixed(1)}% vs current
            </div>
          )}
        </div>
        <div>
          <div className="text-xs text-gray-500 mb-1">Target Range</div>
          <div className="text-sm text-gray-700">
            {data.targetLowPrice ? `$${data.targetLowPrice.toFixed(2)}` : '—'}
            {' — '}
            {data.targetHighPrice ? `$${data.targetHighPrice.toFixed(2)}` : '—'}
          </div>
        </div>
        <div>
          <div className="text-xs text-gray-500 mb-1"># Analysts</div>
          <div className="text-lg font-semibold text-gray-900">
            {data.numberOfAnalystOpinions ?? '—'}
          </div>
        </div>
      </div>
    </div>
  )
}

export function ReportView() {
  const { id } = useParams<{ id: string }>()

  const { data: report, isLoading } = useQuery({
    queryKey: ['report', id],
    queryFn: () => reportsApi.get(id!),
    enabled: !!id,
  })

  if (isLoading || !report) {
    return <div className="text-center py-12 text-gray-500">Loading report...</div>
  }

  const sections = [
    { id: 'summary', title: 'Executive Summary', content: report.executive_summary, icon: FileText },
    { id: 'business', title: 'Business Model', content: report.business_model_analysis, icon: Building2 },
    { id: 'revenue', title: 'Revenue Sources', content: report.revenue_sources, icon: DollarSign },
    { id: 'margins', title: 'Margin Analysis', content: report.margin_analysis, icon: LineChart },
    { id: 'moat', title: 'Moat Assessment', content: report.moat_assessment, icon: Shield },
    { id: 'ai-impact', title: 'AI Impact Analysis', content: report.ai_impact_analysis, icon: Zap },
    { id: 'competitive', title: 'Competitive Landscape', content: report.competitive_landscape, icon: Swords },
    { id: 'valuation', title: 'Valuation Assessment', content: report.valuation_assessment, icon: Target },
    { id: 'recommendation', title: 'Investment Recommendation', content: report.investment_recommendation, icon: Briefcase },
  ]

  const moatColors: Record<string, string> = {
    strong: 'bg-emerald-100 text-emerald-800',
    moderate: 'bg-green-100 text-green-800',
    weak: 'bg-yellow-100 text-yellow-800',
    none: 'bg-red-100 text-red-800',
  }

  return (
    <div>
      <div className="flex items-center gap-4 mb-4">
        <Link to="/reports" className="text-sm text-violet-600 hover:text-violet-800 flex items-center gap-1">
          <ArrowLeft className="w-3 h-3" /> All Reports
        </Link>
        <span className="text-gray-300">|</span>
        <Link to={`/companies/${report.company_id}`} className="text-sm text-violet-600 hover:text-violet-800">
          {report.company_name}
        </Link>
      </div>

      {/* Report Header */}
      <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              {report.company_name} ({report.company_ticker})
            </h1>
            <div className="flex items-center gap-3 mt-2">
              <SignalBadge signal={report.signal} size="lg" />
              <span className="text-sm text-gray-500">Version {report.version}</span>
              <span className="text-sm text-gray-400">{new Date(report.created_at).toLocaleDateString()}</span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <div className="text-xs text-gray-500 mb-1">Signal Confidence</div>
            <ConfidenceMeter value={report.signal_confidence} />
          </div>
          <div>
            <div className="text-xs text-gray-500 mb-1">AI Vulnerability</div>
            <ConfidenceMeter value={report.ai_vulnerability_score} />
          </div>
          <div>
            <div className="text-xs text-gray-500 mb-1">Moat Rating</div>
            <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${moatColors[report.moat_rating] || moatColors.none}`}>
              {report.moat_rating.charAt(0).toUpperCase() + report.moat_rating.slice(1)}
            </span>
          </div>
          <div>
            <div className="text-xs text-gray-500 mb-1">Generation</div>
            <div className="flex items-center gap-2 text-xs text-gray-600">
              <Clock className="w-3 h-3" /> {report.generation_time_seconds?.toFixed(1)}s
              <Cpu className="w-3 h-3 ml-1" /> {report.model_used?.split('-').slice(-2).join('-')}
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Table of Contents */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-lg border border-gray-200 p-4 sticky top-4">
            <h3 className="text-sm font-semibold text-gray-900 mb-3">Contents</h3>
            <nav className="space-y-1">
              {report.key_metrics && (
                <a href="#key-metrics" className="block text-sm text-gray-600 hover:text-violet-700 py-1">Key Metrics</a>
              )}
              {report.price_history && report.price_history.length > 0 && (
                <a href="#price-chart" className="block text-sm text-gray-600 hover:text-violet-700 py-1">Price Chart</a>
              )}
              {report.analyst_consensus && (
                <a href="#analyst-consensus" className="block text-sm text-gray-600 hover:text-violet-700 py-1">Analyst Consensus</a>
              )}
              {sections.map(s => (
                <a
                  key={s.id}
                  href={`#${s.id}`}
                  className="block text-sm text-gray-600 hover:text-violet-700 py-1 truncate"
                >
                  {s.title}
                </a>
              ))}
              {report.management_strategy_response && (
                <a href="#management-strategy" className="block text-sm text-amber-700 hover:text-amber-900 py-1 font-medium">Management Strategy</a>
              )}
              {report.citations.length > 0 && (
                <a href="#citations" className="block text-sm text-gray-600 hover:text-violet-700 py-1">Citations</a>
              )}
            </nav>

            {report.sec_filings_used.length > 0 && (
              <div className="mt-4 pt-4 border-t border-gray-200">
                <h4 className="text-xs font-medium text-gray-500 mb-2">SEC Filings Used</h4>
                {report.sec_filings_used.map((f, i) => (
                  <div key={i} className="text-xs text-gray-600 flex items-center gap-1">
                    <FileText className="w-3 h-3" /> {f}
                  </div>
                ))}
              </div>
            )}

            {report.input_tokens && (
              <div className="mt-4 pt-4 border-t border-gray-200 text-xs text-gray-400">
                <div>Input: {report.input_tokens.toLocaleString()} tokens</div>
                <div>Output: {report.output_tokens?.toLocaleString()} tokens</div>
              </div>
            )}
          </div>
        </div>

        {/* Report Content */}
        <div className="lg:col-span-3 space-y-6">
          {/* Key Financial Metrics */}
          {report.key_metrics && (
            <div id="key-metrics">
              <KeyMetricsSection metrics={report.key_metrics} />
            </div>
          )}

          {/* Price Chart */}
          {report.price_history && report.price_history.length > 0 && (
            <div id="price-chart">
              <PriceChartSection data={report.price_history} ticker={report.company_ticker} />
            </div>
          )}

          {/* Analyst Consensus */}
          {report.analyst_consensus && (
            <div id="analyst-consensus">
              <AnalystConsensusSection data={report.analyst_consensus} />
            </div>
          )}

          {sections.map(s => {
            const Icon = s.icon
            return (
              <div key={s.id} id={s.id} className="bg-white rounded-lg border border-gray-200 p-6">
                <div className="flex items-center gap-2 mb-4">
                  <Icon className="w-5 h-5 text-violet-600 shrink-0" />
                  <h2 className="text-lg font-semibold text-gray-900">{s.title}</h2>
                </div>
                <MarkdownRenderer content={s.content} />
              </div>
            )
          })}

          {/* Management Strategy Response */}
          {report.management_strategy_response && (
            <div id="management-strategy" className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-lg border border-amber-200 p-6">
              <div className="flex items-center gap-2 mb-4">
                <Lightbulb className="w-5 h-5 text-amber-600 shrink-0" />
                <h2 className="text-lg font-semibold text-gray-900">Management Strategy Response</h2>
              </div>
              <div className="text-xs text-amber-700 bg-amber-100 rounded px-2 py-1 inline-block mb-4">
                Written from the perspective of {report.company_name}'s executive team
              </div>
              <MarkdownRenderer content={report.management_strategy_response} />
            </div>
          )}

          {/* Hypothesis Impacts */}
          {report.hypothesis_impacts.length > 0 && (
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Hypothesis Impacts</h2>
              <div className="space-y-3">
                {report.hypothesis_impacts.map((hi, i) => (
                  <div key={i} className="bg-gray-50 rounded-lg p-4">
                    <div className="text-xs text-gray-400 mb-1">Hypothesis: {hi.hypothesis_id}</div>
                    <MarkdownRenderer content={hi.impact_summary} />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Citations */}
          {report.citations.length > 0 && (
            <div id="citations" className="bg-white rounded-lg border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Citations</h2>
              <div className="space-y-2">
                {report.citations.map((c, i) => (
                  <div key={i} className="text-sm border-l-2 border-gray-200 pl-3 py-1">
                    <div className="font-medium text-gray-700">{c.source}</div>
                    {c.url && <a href={c.url} target="_blank" rel="noopener noreferrer" className="text-xs text-violet-600 hover:underline">{c.url}</a>}
                    {c.excerpt && <p className="text-xs text-gray-500 mt-1 italic">{c.excerpt}</p>}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
