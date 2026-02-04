import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../services/api'
import type { MarginDashboard as MarginDashboardData } from '../types'
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  Percent,
  AlertTriangle,
  ArrowRight,
  Building2,
  Truck,
  MapPin,
  BarChart3,
} from 'lucide-react'

export default function MarginDashboard() {
  const [data, setData] = useState<MarginDashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [days, setDays] = useState(30)

  useEffect(() => {
    fetchData()
  }, [days])

  const fetchData = async () => {
    setLoading(true)
    try {
      const result = await api.getMarginDashboard(days)
      setData(result)
    } catch (error) {
      console.error('Failed to fetch margin data:', error)
    } finally {
      setLoading(false)
    }
  }

  const formatCurrency = (cents: number) => {
    return `$${(cents / 100).toLocaleString('en-US', { minimumFractionDigits: 2 })}`
  }

  const getMarginColor = (percent: number) => {
    if (percent >= 15) return 'text-emerald-600'
    if (percent >= 10) return 'text-amber-600'
    return 'text-red-600'
  }

  const getMarginBgColor = (percent: number) => {
    if (percent >= 15) return 'bg-emerald-100 text-emerald-700'
    if (percent >= 10) return 'bg-amber-100 text-amber-700'
    return 'bg-red-100 text-red-700'
  }

  if (loading) {
    return <div className="p-8 text-center text-gray-500">Loading margin analytics...</div>
  }

  if (!data) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <BarChart3 className="h-7 w-7 text-emerald-600" />
            Margin Dashboard
          </h1>
          <p className="text-gray-500">Profitability analytics across your operations</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <BarChart3 className="h-12 w-12 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500">No margin data available</p>
          <p className="text-sm text-gray-400 mt-2">Complete some shipments with invoices to see margin analytics</p>
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
            <BarChart3 className="h-7 w-7 text-emerald-600" />
            Margin Dashboard
          </h1>
          <p className="text-gray-500">Profitability analytics across your operations</p>
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
              <DollarSign className="h-5 w-5 text-emerald-600" />
            </div>
            <span className="text-sm font-medium text-gray-500">Total Revenue</span>
          </div>
          <p className="text-2xl font-bold text-gray-900">{formatCurrency(data.summary.total_revenue)}</p>
          <p className="text-sm text-gray-500 mt-1">{data.summary.shipment_count} shipments</p>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 bg-red-100 rounded-lg">
              <TrendingDown className="h-5 w-5 text-red-600" />
            </div>
            <span className="text-sm font-medium text-gray-500">Total Cost</span>
          </div>
          <p className="text-2xl font-bold text-gray-900">{formatCurrency(data.summary.total_cost)}</p>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 bg-emerald-100 rounded-lg">
              <TrendingUp className="h-5 w-5 text-emerald-600" />
            </div>
            <span className="text-sm font-medium text-gray-500">Total Margin</span>
          </div>
          <p className={`text-2xl font-bold ${getMarginColor(data.summary.avg_margin_percent)}`}>
            {formatCurrency(data.summary.total_margin)}
          </p>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 bg-emerald-100 rounded-lg">
              <Percent className="h-5 w-5 text-emerald-600" />
            </div>
            <span className="text-sm font-medium text-gray-500">Avg Margin %</span>
          </div>
          <p className={`text-2xl font-bold ${getMarginColor(data.summary.avg_margin_percent)}`}>
            {data.summary.avg_margin_percent}%
          </p>
          {data.summary.low_margin_count > 0 && (
            <p className="text-sm text-amber-600 mt-1 flex items-center gap-1">
              <AlertTriangle className="h-3 w-3" />
              {data.summary.low_margin_count} low margin
            </p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* By Customer */}
        <div className="bg-white rounded-xl border border-gray-200">
          <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <Building2 className="h-5 w-5 text-gray-400" />
              By Customer
            </h2>
          </div>
          {data.by_customer.length === 0 ? (
            <div className="p-8 text-center text-gray-500">No customer data</div>
          ) : (
            <div className="divide-y divide-gray-100">
              {data.by_customer.map((customer) => (
                <div key={customer.customer_id} className="px-6 py-4 flex items-center justify-between hover:bg-gray-50">
                  <div>
                    <p className="font-medium text-gray-900">{customer.customer_name}</p>
                    <p className="text-sm text-gray-500">{customer.shipment_count} loads</p>
                  </div>
                  <div className="text-right">
                    <p className={`font-semibold ${getMarginColor(customer.avg_margin_percent)}`}>
                      {formatCurrency(customer.total_margin)}
                    </p>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${getMarginBgColor(customer.avg_margin_percent)}`}>
                      {customer.avg_margin_percent}%
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* By Carrier */}
        <div className="bg-white rounded-xl border border-gray-200">
          <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <Truck className="h-5 w-5 text-gray-400" />
              By Carrier
            </h2>
          </div>
          {data.by_carrier.length === 0 ? (
            <div className="p-8 text-center text-gray-500">No carrier data</div>
          ) : (
            <div className="divide-y divide-gray-100">
              {data.by_carrier.map((carrier) => (
                <div key={carrier.carrier_id} className="px-6 py-4 flex items-center justify-between hover:bg-gray-50">
                  <div>
                    <p className="font-medium text-gray-900">{carrier.carrier_name}</p>
                    <p className="text-sm text-gray-500">{carrier.shipment_count} loads</p>
                  </div>
                  <div className="text-right">
                    <p className={`font-semibold ${getMarginColor(carrier.avg_margin_percent)}`}>
                      {formatCurrency(carrier.total_margin)}
                    </p>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${getMarginBgColor(carrier.avg_margin_percent)}`}>
                      {carrier.avg_margin_percent}%
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* By Lane */}
      <div className="bg-white rounded-xl border border-gray-200">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <MapPin className="h-5 w-5 text-gray-400" />
            Top Lanes by Margin
          </h2>
        </div>
        {data.by_lane.length === 0 ? (
          <div className="p-8 text-center text-gray-500">No lane data</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200 text-left">
                  <th className="px-6 py-3 text-sm font-medium text-gray-500">Lane</th>
                  <th className="px-6 py-3 text-sm font-medium text-gray-500 text-right">Revenue</th>
                  <th className="px-6 py-3 text-sm font-medium text-gray-500 text-right">Cost</th>
                  <th className="px-6 py-3 text-sm font-medium text-gray-500 text-right">Margin</th>
                  <th className="px-6 py-3 text-sm font-medium text-gray-500 text-right">%</th>
                  <th className="px-6 py-3 text-sm font-medium text-gray-500 text-right">Loads</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {data.by_lane.map((lane, idx) => (
                  <tr key={idx} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2 text-sm">
                        <span className="font-medium text-gray-900">{lane.origin}</span>
                        <ArrowRight className="h-4 w-4 text-gray-400" />
                        <span className="font-medium text-gray-900">{lane.destination}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600 text-right">{formatCurrency(lane.total_revenue)}</td>
                    <td className="px-6 py-4 text-sm text-gray-600 text-right">{formatCurrency(lane.total_cost)}</td>
                    <td className={`px-6 py-4 text-sm font-semibold text-right ${getMarginColor(lane.avg_margin_percent)}`}>
                      {formatCurrency(lane.total_margin)}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${getMarginBgColor(lane.avg_margin_percent)}`}>
                        {lane.avg_margin_percent}%
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600 text-right">{lane.shipment_count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Low Margin Alerts */}
      {data.low_margin_shipments.length > 0 && (
        <div className="bg-white rounded-xl border border-red-200">
          <div className="px-6 py-4 border-b border-red-200 bg-red-50 rounded-t-xl">
            <h2 className="text-lg font-semibold text-red-900 flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-600" />
              Low Margin Shipments (Below 10%)
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200 text-left">
                  <th className="px-6 py-3 text-sm font-medium text-gray-500">Shipment</th>
                  <th className="px-6 py-3 text-sm font-medium text-gray-500">Customer</th>
                  <th className="px-6 py-3 text-sm font-medium text-gray-500">Carrier</th>
                  <th className="px-6 py-3 text-sm font-medium text-gray-500">Lane</th>
                  <th className="px-6 py-3 text-sm font-medium text-gray-500 text-right">Price</th>
                  <th className="px-6 py-3 text-sm font-medium text-gray-500 text-right">Cost</th>
                  <th className="px-6 py-3 text-sm font-medium text-gray-500 text-right">Margin</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {data.low_margin_shipments.map((shipment) => (
                  <tr key={shipment.shipment_id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <Link
                        to={`/shipments/${shipment.shipment_id}`}
                        className="text-sm font-medium text-emerald-600 hover:text-emerald-700"
                      >
                        {shipment.shipment_number}
                      </Link>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">{shipment.customer_name || '-'}</td>
                    <td className="px-6 py-4 text-sm text-gray-600">{shipment.carrier_name || '-'}</td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-1 text-sm text-gray-600">
                        <span>{shipment.origin}</span>
                        <ArrowRight className="h-3 w-3" />
                        <span>{shipment.destination}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600 text-right">{formatCurrency(shipment.customer_price)}</td>
                    <td className="px-6 py-4 text-sm text-gray-600 text-right">{formatCurrency(shipment.carrier_cost)}</td>
                    <td className="px-6 py-4 text-right">
                      <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-700">
                        {shipment.margin_percent.toFixed(1)}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Margin Trend */}
      {data.trends.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Margin Trend</h2>
          <div className="h-64 flex items-end gap-1">
            {data.trends.map((trend, idx) => {
              const maxMargin = Math.max(...data.trends.map(t => t.total_margin))
              const height = maxMargin > 0 ? (trend.total_margin / maxMargin) * 100 : 0
              return (
                <div
                  key={idx}
                  className="flex-1 flex flex-col items-center gap-1"
                  title={`${trend.date}: ${formatCurrency(trend.total_margin)} (${trend.avg_margin_percent}%)`}
                >
                  <div
                    className={`w-full rounded-t transition-all ${
                      trend.avg_margin_percent >= 15 ? 'bg-emerald-500' :
                      trend.avg_margin_percent >= 10 ? 'bg-amber-500' : 'bg-red-500'
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
              <span className="text-gray-600">≥15%</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded bg-amber-500" />
              <span className="text-gray-600">10-15%</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded bg-red-500" />
              <span className="text-gray-600">&lt;10%</span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
