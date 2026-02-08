import { useEffect, useState } from 'react'
import { api } from '../services/api'
import PageHelp from '../components/PageHelp'
import type {
  OperationsMetrics as OperationsMetricsData,
  VolumeForecast,
  RateForecast,
  DelayPrediction,
} from '../types'
import {
  Activity,
  Clock,
  AlertTriangle,
  FileText,
  Handshake,
  BarChart3,
  Timer,
  TrendingUp,
  TrendingDown,
  Sparkles,
  ChevronDown,
  ChevronUp,
  MapPin,
  Shield,
} from 'lucide-react'

export default function OperationsMetrics() {
  const [data, setData] = useState<OperationsMetricsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [days, setDays] = useState(30)
  const [showPredictive, setShowPredictive] = useState(false)
  const [predictiveTab, setPredictiveTab] = useState<'volume' | 'rates' | 'delays'>('volume')
  const [volumeForecasts, setVolumeForecasts] = useState<VolumeForecast[]>([])
  const [rateForecasts, setRateForecasts] = useState<RateForecast[]>([])
  const [delayPredictions, setDelayPredictions] = useState<DelayPrediction[]>([])
  const [highRiskCount, setHighRiskCount] = useState(0)
  const [predictiveLoading, setPredictiveLoading] = useState(false)

  useEffect(() => {
    fetchData()
  }, [days])

  const fetchData = async () => {
    setLoading(true)
    try {
      const result = await api.getOperationsMetrics(days)
      setData(result)
    } catch (error) {
      console.error('Failed to fetch operations metrics:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchPredictiveData = async () => {
    setPredictiveLoading(true)
    try {
      if (predictiveTab === 'volume') {
        const result = await api.getVolumeForecast({ days })
        setVolumeForecasts(result.forecasts || [])
      } else if (predictiveTab === 'rates') {
        const result = await api.getRateForecast({ days })
        setRateForecasts(result.lanes || [])
      } else if (predictiveTab === 'delays') {
        const result = await api.getDelayPredictions(30)
        setDelayPredictions(result.predictions || [])
        setHighRiskCount(result.high_risk_count || 0)
      }
    } catch (error) {
      console.error('Failed to fetch predictive data:', error)
    } finally {
      setPredictiveLoading(false)
    }
  }

  useEffect(() => {
    if (showPredictive) {
      fetchPredictiveData()
    }
  }, [showPredictive, predictiveTab, days])

  const formatHours = (hours: number) => {
    if (hours < 1) return `${Math.round(hours * 60)}m`
    if (hours < 24) return `${hours.toFixed(1)}h`
    return `${(hours / 24).toFixed(1)}d`
  }

  const getWorkTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      quote_request: 'Quote Requests',
      quote_followup: 'Quote Follow-ups',
      shipment_needs_carrier: 'Needs Carrier',
      tender_pending: 'Tender Pending',
      check_call_due: 'Check Calls',
      document_needed: 'Documents Needed',
      invoice_ready: 'Invoice Ready',
      exception: 'Exceptions',
      custom: 'Custom',
    }
    return labels[type] || type.replace(/_/g, ' ')
  }

  const getWorkTypeColor = (type: string) => {
    const colors: Record<string, string> = {
      quote_request: 'bg-emerald-500',
      quote_followup: 'bg-teal-500',
      shipment_needs_carrier: 'bg-blue-500',
      tender_pending: 'bg-indigo-500',
      check_call_due: 'bg-amber-500',
      document_needed: 'bg-purple-500',
      invoice_ready: 'bg-orange-500',
      exception: 'bg-red-500',
      custom: 'bg-gray-500',
    }
    return colors[type] || 'bg-gray-500'
  }

  if (loading) {
    return <div className="p-8 text-center text-gray-500">Loading operations metrics...</div>
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Activity className="h-7 w-7 text-indigo-600" />
            Operations Metrics
            <PageHelp pageId="operations-metrics" />
          </h1>
          <p className="text-gray-500">Work items, quote performance, and tender analytics</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-500">Time period:</span>
          <div className="flex border border-gray-300 rounded-lg overflow-hidden">
            {[
              { label: '7d', value: 7 },
              { label: '30d', value: 30 },
              { label: '90d', value: 90 },
            ].map((opt) => (
              <button
                key={opt.value}
                onClick={() => setDays(opt.value)}
                className={`px-4 py-2 text-sm font-medium transition-colors ${
                  days === opt.value
                    ? 'bg-indigo-600 text-white'
                    : 'bg-white text-gray-600 hover:bg-gray-50'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Work Items Section */}
      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Work Items</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <FileText className="h-5 w-5 text-blue-600" />
              </div>
              <span className="text-sm font-medium text-gray-500">Open Items</span>
            </div>
            <p className="text-3xl font-bold text-gray-900">{data?.work_items.open || 0}</p>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 bg-red-100 rounded-lg">
                <AlertTriangle className="h-5 w-5 text-red-600" />
              </div>
              <span className="text-sm font-medium text-gray-500">Overdue</span>
            </div>
            <p className={`text-3xl font-bold ${(data?.work_items.overdue || 0) > 0 ? 'text-red-600' : 'text-gray-900'}`}>
              {data?.work_items.overdue || 0}
            </p>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 bg-amber-100 rounded-lg">
                <Timer className="h-5 w-5 text-amber-600" />
              </div>
              <span className="text-sm font-medium text-gray-500">Avg Completion</span>
            </div>
            <p className="text-3xl font-bold text-gray-900">
              {data ? formatHours(data.work_items.avg_completion_hours) : '--'}
            </p>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 bg-emerald-100 rounded-lg">
                <BarChart3 className="h-5 w-5 text-emerald-600" />
              </div>
              <span className="text-sm font-medium text-gray-500">Types</span>
            </div>
            <p className="text-3xl font-bold text-gray-900">
              {data ? Object.keys(data.work_items.by_type).length : 0}
            </p>
          </div>
        </div>

        {/* Work Items by Type */}
        {data && Object.keys(data.work_items.by_type).length > 0 && (
          <div className="mt-4 bg-white rounded-xl border border-gray-200 p-6">
            <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">Breakdown by Type</h3>
            <div className="space-y-3">
              {Object.entries(data.work_items.by_type)
                .sort(([, a], [, b]) => (b as number) - (a as number))
                .map(([type, count]) => {
                  const total = data.work_items.open || 1
                  const pct = ((count as number) / total * 100)
                  return (
                    <div key={type} className="flex items-center gap-3">
                      <span className="text-sm text-gray-600 w-36 truncate">{getWorkTypeLabel(type)}</span>
                      <div className="flex-1 h-5 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${getWorkTypeColor(type)} transition-all`}
                          style={{ width: `${Math.max(pct, 2)}%` }}
                        />
                      </div>
                      <span className="text-sm font-semibold text-gray-700 w-10 text-right">{count as number}</span>
                    </div>
                  )
                })}
            </div>
          </div>
        )}
      </div>

      {/* Quote & Tender Performance */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Quote Performance */}
        <div className="bg-white rounded-xl border border-gray-200">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <FileText className="h-5 w-5 text-gray-400" />
              Quote Performance
            </h2>
          </div>
          <div className="p-6 space-y-6">
            <div className="grid grid-cols-2 gap-6">
              <div>
                <p className="text-sm text-gray-500 mb-1">Total Quotes</p>
                <p className="text-3xl font-bold text-gray-900">{data?.quotes.total || 0}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500 mb-1">Win Rate</p>
                <p className={`text-3xl font-bold ${
                  (data?.quotes.win_rate || 0) >= 30 ? 'text-emerald-600' :
                  (data?.quotes.win_rate || 0) >= 15 ? 'text-amber-600' : 'text-red-600'
                }`}>
                  {data?.quotes.win_rate || 0}%
                </p>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-gray-600">Win Rate</span>
                <span className="text-sm font-semibold text-gray-700">{data?.quotes.win_rate || 0}%</span>
              </div>
              <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${
                    (data?.quotes.win_rate || 0) >= 30 ? 'bg-emerald-500' :
                    (data?.quotes.win_rate || 0) >= 15 ? 'bg-amber-500' : 'bg-red-500'
                  }`}
                  style={{ width: `${Math.min(data?.quotes.win_rate || 0, 100)}%` }}
                />
              </div>
            </div>

            <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-lg">
              <Clock className="h-5 w-5 text-gray-400" />
              <div>
                <p className="text-sm text-gray-500">Avg Response Time</p>
                <p className="text-lg font-semibold text-gray-900">
                  {data ? formatHours(data.quotes.avg_response_hours) : '--'}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Tender Performance */}
        <div className="bg-white rounded-xl border border-gray-200">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <Handshake className="h-5 w-5 text-gray-400" />
              Tender Performance
            </h2>
          </div>
          <div className="p-6 space-y-6">
            <div className="grid grid-cols-2 gap-6">
              <div>
                <p className="text-sm text-gray-500 mb-1">Acceptance Rate</p>
                <p className={`text-3xl font-bold ${
                  (data?.tenders.acceptance_rate || 0) >= 60 ? 'text-emerald-600' :
                  (data?.tenders.acceptance_rate || 0) >= 40 ? 'text-amber-600' : 'text-red-600'
                }`}>
                  {data?.tenders.acceptance_rate || 0}%
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-500 mb-1">Counter-Offer Rate</p>
                <p className="text-3xl font-bold text-gray-900">{data?.tenders.counter_offer_rate || 0}%</p>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-gray-600">Acceptance Rate</span>
                <span className="text-sm font-semibold text-gray-700">{data?.tenders.acceptance_rate || 0}%</span>
              </div>
              <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${
                    (data?.tenders.acceptance_rate || 0) >= 60 ? 'bg-emerald-500' :
                    (data?.tenders.acceptance_rate || 0) >= 40 ? 'bg-amber-500' : 'bg-red-500'
                  }`}
                  style={{ width: `${Math.min(data?.tenders.acceptance_rate || 0, 100)}%` }}
                />
              </div>
            </div>

            <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-lg">
              <Clock className="h-5 w-5 text-gray-400" />
              <div>
                <p className="text-sm text-gray-500">Avg Time to Accept</p>
                <p className="text-lg font-semibold text-gray-900">
                  {data ? formatHours(data.tenders.avg_acceptance_hours) : '--'}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Predictive Analytics Section */}
      <div className="bg-white rounded-xl border border-gray-200">
        <button
          onClick={() => setShowPredictive(!showPredictive)}
          className="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors rounded-xl"
        >
          <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-indigo-600" />
            Predictive Analytics
            <span className="text-xs text-gray-400 font-normal ml-2">AI-powered forecasting</span>
          </h2>
          {showPredictive ? (
            <ChevronUp className="h-5 w-5 text-gray-400" />
          ) : (
            <ChevronDown className="h-5 w-5 text-gray-400" />
          )}
        </button>

        {showPredictive && (
          <div className="px-6 pb-6 space-y-4">
            {/* Sub-tabs */}
            <div className="flex border border-gray-300 rounded-lg overflow-hidden">
              {[
                { id: 'volume' as const, label: 'Volume Forecast', icon: BarChart3 },
                { id: 'rates' as const, label: 'Rate Trends', icon: TrendingUp },
                { id: 'delays' as const, label: 'Delay Predictions', icon: AlertTriangle },
              ].map((tab) => {
                const TabIcon = tab.icon
                return (
                  <button
                    key={tab.id}
                    onClick={() => setPredictiveTab(tab.id)}
                    className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium transition-colors ${
                      predictiveTab === tab.id
                        ? 'bg-indigo-600 text-white'
                        : 'bg-white text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    <TabIcon className="h-4 w-4" />
                    {tab.label}
                  </button>
                )
              })}
            </div>

            {predictiveLoading ? (
              <div className="py-8 text-center text-gray-500">
                <div className="animate-spin h-6 w-6 border-2 border-indigo-500 border-t-transparent rounded-full mx-auto mb-2" />
                Generating predictions...
              </div>
            ) : (
              <>
                {/* Volume Forecast Tab */}
                {predictiveTab === 'volume' && (
                  <div className="space-y-4">
                    {volumeForecasts.length === 0 ? (
                      <div className="py-8 text-center text-gray-500">
                        <BarChart3 className="h-8 w-8 text-gray-300 mx-auto mb-2" />
                        <p>No volume forecast data available</p>
                      </div>
                    ) : (
                      volumeForecasts.map((vf, idx) => (
                        <div key={idx} className="border border-gray-200 rounded-lg p-5">
                          <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-3">
                              <div className={`p-2 rounded-lg ${
                                vf.trend_direction === 'growing' ? 'bg-emerald-100' :
                                vf.trend_direction === 'declining' ? 'bg-red-100' : 'bg-gray-100'
                              }`}>
                                {vf.trend_direction === 'growing' ? (
                                  <TrendingUp className="h-4 w-4 text-emerald-600" />
                                ) : vf.trend_direction === 'declining' ? (
                                  <TrendingDown className="h-4 w-4 text-red-600" />
                                ) : (
                                  <BarChart3 className="h-4 w-4 text-gray-500" />
                                )}
                              </div>
                              <div>
                                <p className="font-semibold text-gray-900">{vf.customer_name}</p>
                                <p className="text-xs text-gray-500">
                                  Avg: {vf.historical_avg_volume} loads/mo | ${(vf.historical_avg_revenue / 100).toLocaleString()} revenue
                                </p>
                              </div>
                            </div>
                            <span className={`text-sm font-medium px-2.5 py-1 rounded-full ${
                              vf.trend_direction === 'growing' ? 'bg-emerald-100 text-emerald-700' :
                              vf.trend_direction === 'declining' ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-700'
                            }`}>
                              {vf.trend_percent > 0 ? '+' : ''}{vf.trend_percent.toFixed(1)}% trend
                            </span>
                          </div>

                          {vf.forecast && vf.forecast.length > 0 && (
                            <div className="mt-3 grid grid-cols-3 lg:grid-cols-6 gap-2">
                              {vf.forecast.slice(0, 6).map((f, i) => (
                                <div key={i} className="bg-gray-50 rounded p-2 text-center">
                                  <p className="text-xs text-gray-400">{f.month.slice(5)}</p>
                                  <p className="text-sm font-semibold text-gray-900">{f.predicted_volume}</p>
                                  <p className="text-xs text-gray-500">{(f.confidence * 100).toFixed(0)}% conf</p>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                )}

                {/* Rate Trends Tab */}
                {predictiveTab === 'rates' && (
                  <div className="space-y-4">
                    {rateForecasts.length === 0 ? (
                      <div className="py-8 text-center text-gray-500">
                        <TrendingUp className="h-8 w-8 text-gray-300 mx-auto mb-2" />
                        <p>No rate forecast data available</p>
                      </div>
                    ) : (
                      rateForecasts.map((rf, idx) => (
                        <div key={idx} className="border border-gray-200 rounded-lg p-5">
                          <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-3">
                              <div className="p-2 bg-blue-100 rounded-lg">
                                <MapPin className="h-4 w-4 text-blue-600" />
                              </div>
                              <div>
                                <p className="font-semibold text-gray-900">{rf.lane}</p>
                                <p className="text-xs text-gray-500">{rf.total_volume} total loads</p>
                              </div>
                            </div>
                            <div className="text-right">
                              <p className="text-sm text-gray-500">Current Avg Rate</p>
                              <p className="text-lg font-bold text-gray-900">${(rf.current_avg_rate / 100).toFixed(2)}</p>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 mb-3">
                            {rf.trend_direction === 'increasing' ? (
                              <TrendingUp className="h-4 w-4 text-red-500" />
                            ) : rf.trend_direction === 'decreasing' ? (
                              <TrendingDown className="h-4 w-4 text-emerald-500" />
                            ) : (
                              <BarChart3 className="h-4 w-4 text-gray-400" />
                            )}
                            <span className={`text-sm font-medium ${
                              rf.trend_direction === 'increasing' ? 'text-red-600' :
                              rf.trend_direction === 'decreasing' ? 'text-emerald-600' : 'text-gray-600'
                            }`}>
                              {rf.rate_trend_percent > 0 ? '+' : ''}{rf.rate_trend_percent.toFixed(1)}% rate {rf.trend_direction}
                            </span>
                          </div>

                          {rf.forecast && rf.forecast.length > 0 && (
                            <div className="grid grid-cols-3 lg:grid-cols-6 gap-2">
                              {rf.forecast.slice(0, 6).map((f, i) => (
                                <div key={i} className="bg-gray-50 rounded p-2 text-center">
                                  <p className="text-xs text-gray-400">{f.month.slice(5)}</p>
                                  <p className="text-sm font-semibold text-gray-900">${(f.predicted_avg_rate / 100).toFixed(0)}</p>
                                  <p className="text-xs text-gray-500">{(f.confidence * 100).toFixed(0)}%</p>
                                </div>
                              ))}
                            </div>
                          )}

                          {rf.insights && rf.insights.length > 0 && (
                            <div className="mt-3 bg-indigo-50 rounded-lg p-3">
                              <p className="text-xs font-semibold text-indigo-700 mb-1">Insights</p>
                              {rf.insights.map((insight, i) => (
                                <p key={i} className="text-xs text-indigo-600">-- {insight}</p>
                              ))}
                            </div>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                )}

                {/* Delay Predictions Tab */}
                {predictiveTab === 'delays' && (
                  <div className="space-y-4">
                    {highRiskCount > 0 && (
                      <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center gap-3">
                        <AlertTriangle className="h-5 w-5 text-red-600 flex-shrink-0" />
                        <div>
                          <p className="text-sm font-semibold text-red-800">{highRiskCount} High-Risk Shipment{highRiskCount > 1 ? 's' : ''}</p>
                          <p className="text-xs text-red-600">These shipments have a high probability of delay. Consider proactive intervention.</p>
                        </div>
                      </div>
                    )}

                    {delayPredictions.length === 0 ? (
                      <div className="py-8 text-center text-gray-500">
                        <Shield className="h-8 w-8 text-gray-300 mx-auto mb-2" />
                        <p>No delay predictions - all shipments look good</p>
                      </div>
                    ) : (
                      <div className="border border-gray-200 rounded-lg overflow-hidden">
                        <table className="min-w-full divide-y divide-gray-200">
                          <thead className="bg-gray-50">
                            <tr>
                              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Shipment</th>
                              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Lane</th>
                              <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Risk</th>
                              <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Est. Delay</th>
                              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Risk Factors</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-200">
                            {delayPredictions.map((dp) => (
                              <tr key={dp.shipment_id} className="hover:bg-gray-50">
                                <td className="px-4 py-3">
                                  <p className="text-sm font-medium text-indigo-600">{dp.shipment_number}</p>
                                  <p className="text-xs text-gray-500">{dp.status}</p>
                                </td>
                                <td className="px-4 py-3 text-sm text-gray-600">
                                  {dp.origin} → {dp.destination}
                                </td>
                                <td className="px-4 py-3 text-center">
                                  <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                                    dp.risk_level === 'high' ? 'bg-red-100 text-red-700' :
                                    dp.risk_level === 'medium' ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'
                                  }`}>
                                    {dp.delay_risk_score}% {dp.risk_level}
                                  </span>
                                </td>
                                <td className="px-4 py-3 text-center text-sm font-medium text-gray-900">
                                  {dp.estimated_delay_hours > 0 ? `${dp.estimated_delay_hours}h` : '-'}
                                </td>
                                <td className="px-4 py-3">
                                  <div className="flex flex-wrap gap-1">
                                    {dp.risk_factors.slice(0, 3).map((rf, i) => (
                                      <span key={i} className="px-1.5 py-0.5 text-xs bg-gray-100 text-gray-600 rounded">
                                        {rf}
                                      </span>
                                    ))}
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
