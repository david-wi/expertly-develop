import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../services/api'
import type { CarrierPerformance as CarrierPerformanceData } from '../types'
import {
  Truck,
  Trophy,
  TrendingUp,
  TrendingDown,
  Minus,
  Clock,
  CheckCircle,
  XCircle,
  BarChart3,
  Star,
  AlertTriangle,
} from 'lucide-react'

export default function CarrierPerformance() {
  const [data, setData] = useState<CarrierPerformanceData | null>(null)
  const [loading, setLoading] = useState(true)
  const [days, setDays] = useState(30)

  useEffect(() => {
    fetchData()
  }, [days])

  const fetchData = async () => {
    setLoading(true)
    try {
      const result = await api.getCarrierPerformance(days)
      setData(result)
    } catch (error) {
      console.error('Failed to fetch carrier performance:', error)
    } finally {
      setLoading(false)
    }
  }

  const formatCurrency = (cents: number) => {
    return `$${(cents / 100).toLocaleString('en-US', { minimumFractionDigits: 2 })}`
  }

  const getScoreBgColor = (score: number) => {
    if (score >= 80) return 'bg-emerald-100 text-emerald-700'
    if (score >= 60) return 'bg-amber-100 text-amber-700'
    return 'bg-red-100 text-red-700'
  }

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'improving':
        return <TrendingUp className="h-4 w-4 text-emerald-500" />
      case 'declining':
        return <TrendingDown className="h-4 w-4 text-red-500" />
      default:
        return <Minus className="h-4 w-4 text-gray-400" />
    }
  }

  const getRateColor = (rate: number) => {
    if (rate >= 95) return 'text-emerald-600'
    if (rate >= 85) return 'text-amber-600'
    return 'text-red-600'
  }

  if (loading) {
    return <div className="p-8 text-center text-gray-500">Loading carrier performance...</div>
  }

  if (!data) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Trophy className="h-7 w-7 text-emerald-600" />
            Carrier Performance
          </h1>
          <p className="text-gray-500">Track and compare carrier reliability and efficiency</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <Trophy className="h-12 w-12 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500">No carrier performance data available</p>
          <p className="text-sm text-gray-400 mt-2">Assign carriers to shipments to see performance metrics</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Trophy className="h-7 w-7 text-emerald-600" />
            Carrier Performance
          </h1>
          <p className="text-gray-500">Track and compare carrier reliability and efficiency</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-500">Time period:</span>
          <select
            value={days}
            onChange={(e) => setDays(parseInt(e.target.value))}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
          >
            <option value={7}>Last 7 days</option>
            <option value={30}>Last 30 days</option>
            <option value={90}>Last 90 days</option>
            <option value={365}>Last year</option>
          </select>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 bg-emerald-100 rounded-lg">
              <Truck className="h-5 w-5 text-emerald-600" />
            </div>
            <span className="text-sm font-medium text-gray-500">Active Carriers</span>
          </div>
          <p className="text-2xl font-bold text-gray-900">{data.summary.active_carriers}</p>
          <p className="text-sm text-gray-500 mt-1">of {data.summary.total_carriers} total</p>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 bg-emerald-100 rounded-lg">
              <Clock className="h-5 w-5 text-emerald-600" />
            </div>
            <span className="text-sm font-medium text-gray-500">Avg On-Time Rate</span>
          </div>
          <p className={`text-2xl font-bold ${getRateColor(data.summary.avg_on_time_rate)}`}>
            {data.summary.avg_on_time_rate}%
          </p>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 bg-emerald-100 rounded-lg">
              <CheckCircle className="h-5 w-5 text-emerald-600" />
            </div>
            <span className="text-sm font-medium text-gray-500">Avg Tender Accept</span>
          </div>
          <p className={`text-2xl font-bold ${getRateColor(data.summary.avg_tender_acceptance)}`}>
            {data.summary.avg_tender_acceptance}%
          </p>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 bg-amber-100 rounded-lg">
              <Star className="h-5 w-5 text-amber-600" />
            </div>
            <span className="text-sm font-medium text-gray-500">Top Performer</span>
          </div>
          {data.summary.top_performer_name ? (
            <>
              <p className="text-lg font-bold text-gray-900 truncate">{data.summary.top_performer_name}</p>
              <Link
                to={`/carriers/${data.summary.top_performer_id}`}
                className="text-sm text-emerald-600 hover:text-emerald-700"
              >
                View carrier
              </Link>
            </>
          ) : (
            <p className="text-lg font-bold text-gray-400">No data</p>
          )}
        </div>
      </div>

      {/* Performance Table */}
      <div className="bg-white rounded-xl border border-gray-200">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-gray-400" />
            Carrier Rankings
          </h2>
        </div>
        {data.carriers.length === 0 ? (
          <div className="p-8 text-center text-gray-500">No carrier data available</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200 text-left">
                  <th className="px-6 py-3 text-sm font-medium text-gray-500">Rank</th>
                  <th className="px-6 py-3 text-sm font-medium text-gray-500">Carrier</th>
                  <th className="px-6 py-3 text-sm font-medium text-gray-500 text-center">Score</th>
                  <th className="px-6 py-3 text-sm font-medium text-gray-500 text-center">Trend</th>
                  <th className="px-6 py-3 text-sm font-medium text-gray-500 text-right">On-Time</th>
                  <th className="px-6 py-3 text-sm font-medium text-gray-500 text-right">Accept Rate</th>
                  <th className="px-6 py-3 text-sm font-medium text-gray-500 text-right">Loads</th>
                  <th className="px-6 py-3 text-sm font-medium text-gray-500 text-right">Avg $/mi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {data.carriers.map((carrier, idx) => (
                  <tr key={carrier.carrier_id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        {idx === 0 && <Trophy className="h-5 w-5 text-amber-500" />}
                        {idx === 1 && <Trophy className="h-5 w-5 text-gray-400" />}
                        {idx === 2 && <Trophy className="h-5 w-5 text-amber-700" />}
                        {idx > 2 && <span className="text-sm text-gray-500 w-5 text-center">{idx + 1}</span>}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <Link
                        to={`/carriers/${carrier.carrier_id}`}
                        className="font-medium text-gray-900 hover:text-emerald-600"
                      >
                        {carrier.carrier_name}
                      </Link>
                      {carrier.mc_number && (
                        <p className="text-xs text-gray-500">MC #{carrier.mc_number}</p>
                      )}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className={`text-sm px-2 py-1 rounded-full font-semibold ${getScoreBgColor(carrier.performance_score)}`}>
                        {carrier.performance_score}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-center gap-1">
                        {getTrendIcon(carrier.trend)}
                        <span className="text-xs text-gray-500 capitalize">{carrier.trend}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <span className={`font-medium ${getRateColor(carrier.on_time_rate)}`}>
                        {carrier.on_time_rate}%
                      </span>
                      <p className="text-xs text-gray-500">
                        {carrier.on_time_delivery_count}/{carrier.shipment_count}
                      </p>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <span className={`font-medium ${getRateColor(carrier.tender_acceptance_rate)}`}>
                        {carrier.tender_acceptance_rate}%
                      </span>
                      {carrier.tender_declined_count > 0 && (
                        <p className="text-xs text-red-500 flex items-center justify-end gap-1">
                          <XCircle className="h-3 w-3" />
                          {carrier.tender_declined_count} declined
                        </p>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right text-sm text-gray-600">
                      {carrier.shipment_count}
                    </td>
                    <td className="px-6 py-4 text-right text-sm text-gray-600">
                      {formatCurrency(carrier.avg_cost_per_mile)}/mi
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Performance Trend Chart */}
      {data.trends.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Fleet Performance Trend</h2>
          <div className="h-64 flex items-end gap-1">
            {data.trends.map((trend, idx) => {
              const height = trend.on_time_rate
              return (
                <div
                  key={idx}
                  className="flex-1 flex flex-col items-center gap-1"
                  title={`${trend.date}: ${trend.on_time_rate}% on-time, ${trend.shipment_count} loads`}
                >
                  <div
                    className={`w-full rounded-t transition-all ${
                      trend.on_time_rate >= 95 ? 'bg-emerald-500' :
                      trend.on_time_rate >= 85 ? 'bg-amber-500' : 'bg-red-500'
                    }`}
                    style={{ height: `${Math.max(height, 4)}%` }}
                  />
                  {data.trends.length <= 14 && (
                    <span className="text-xs text-gray-400 transform -rotate-45 origin-top-left whitespace-nowrap">
                      {new Date(trend.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </span>
                  )}
                </div>
              )
            })}
          </div>
          <div className="flex items-center justify-center gap-6 mt-4 text-sm">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded bg-emerald-500" />
              <span className="text-gray-600">95%+ On-Time</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded bg-amber-500" />
              <span className="text-gray-600">85-95%</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded bg-red-500" />
              <span className="text-gray-600">&lt;85%</span>
            </div>
          </div>
        </div>
      )}

      {/* Low Performers Alert */}
      {data.carriers.filter(c => c.performance_score < 60).length > 0 && (
        <div className="bg-white rounded-xl border border-amber-200">
          <div className="px-6 py-4 border-b border-amber-200 bg-amber-50 rounded-t-xl">
            <h2 className="text-lg font-semibold text-amber-900 flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-600" />
              Carriers Needing Attention
            </h2>
            <p className="text-sm text-amber-700 mt-1">Performance score below 60 - consider reviewing these relationships</p>
          </div>
          <div className="divide-y divide-amber-100">
            {data.carriers.filter(c => c.performance_score < 60).map(carrier => (
              <div key={carrier.carrier_id} className="px-6 py-4 flex items-center justify-between">
                <div>
                  <Link
                    to={`/carriers/${carrier.carrier_id}`}
                    className="font-medium text-gray-900 hover:text-emerald-600"
                  >
                    {carrier.carrier_name}
                  </Link>
                  <p className="text-sm text-gray-500">
                    {carrier.on_time_rate}% on-time, {carrier.tender_acceptance_rate}% accept rate
                  </p>
                </div>
                <div className="text-right">
                  <span className={`text-sm px-2 py-1 rounded-full font-semibold ${getScoreBgColor(carrier.performance_score)}`}>
                    {carrier.performance_score} score
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
