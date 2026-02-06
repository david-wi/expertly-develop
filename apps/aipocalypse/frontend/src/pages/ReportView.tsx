import { useParams, Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, Clock, Cpu, FileText } from 'lucide-react'
import { reportsApi } from '../services/api'
import { SignalBadge } from '../components/SignalBadge'
import { ConfidenceMeter } from '../components/ConfidenceMeter'
import { MarkdownRenderer } from '../components/MarkdownRenderer'

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
    { id: 'summary', title: 'Executive Summary', content: report.executive_summary },
    { id: 'business', title: 'Business Model Analysis', content: report.business_model_analysis },
    { id: 'revenue', title: 'Revenue Sources', content: report.revenue_sources },
    { id: 'margins', title: 'Margin Analysis', content: report.margin_analysis },
    { id: 'moat', title: 'Moat Assessment', content: report.moat_assessment },
    { id: 'ai-impact', title: 'AI Impact Analysis', content: report.ai_impact_analysis },
    { id: 'competitive', title: 'Competitive Landscape', content: report.competitive_landscape },
    { id: 'valuation', title: 'Valuation Assessment', content: report.valuation_assessment },
    { id: 'recommendation', title: 'Investment Recommendation', content: report.investment_recommendation },
  ]

  const moatColors: Record<string, string> = {
    strong: 'bg-emerald-100 text-emerald-800',
    moderate: 'bg-green-100 text-green-800',
    weak: 'bg-yellow-100 text-yellow-800',
    none: 'bg-red-100 text-red-800',
  }

  return (
    <div>
      <Link to={`/companies/${report.company_id}`} className="text-sm text-violet-600 hover:text-violet-800 flex items-center gap-1 mb-4">
        <ArrowLeft className="w-3 h-3" /> Back to {report.company_name}
      </Link>

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
              {sections.map(s => (
                <a
                  key={s.id}
                  href={`#${s.id}`}
                  className="block text-sm text-gray-600 hover:text-violet-700 py-1 truncate"
                >
                  {s.title}
                </a>
              ))}
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
          {sections.map(s => (
            <div key={s.id} id={s.id} className="bg-white rounded-lg border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">{s.title}</h2>
              <MarkdownRenderer content={s.content} />
            </div>
          ))}

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
