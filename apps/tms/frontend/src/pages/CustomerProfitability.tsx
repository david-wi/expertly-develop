import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../services/api'
import PageHelp from '../components/PageHelp'
import type { CustomerProfitabilityDetail } from '../types'
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  Percent,
  ArrowLeft,
  Building2,
  BarChart3,
  Sparkles,
  ChevronDown,
  ChevronUp,
  Loader2,
  Package,
} from 'lucide-react'

export default function CustomerProfitability() {
  const [data, setData] = useState<CustomerProfitabilityDetail[]>([])
  const [loading, setLoading] = useState(true)
  const [period, setPeriod] = useState<'30d' | '90d' | '1y'>('30d')
  const [expandedCustomer, setExpandedCustomer] = useState<string | null>(null)
  const [sortBy, setSortBy] = useState<'margin' | 'revenue' | 'shipments'>('margin')

  useEffect(() => {
    fetchData()
  }, [period])

  const fetchData = async () => {
    setLoading(true)
    try {
      const result = await api.getCustomerProfitability({ period })
      setData(Array.isArray(result) ? result : result.customers || [])
    } catch (error) {
      console.error('Failed to fetch customer profitability:', error)
    } finally {
      setLoading(false)
    }
  }

  const sortedData = [...data].sort((a, b) => {
    if (sortBy === 'margin') return b.margin_percent - a.margin_percent
    if (sortBy === 'revenue') return b.total_revenue - a.total_revenue
    return b.shipment_count - a.shipment_count
  })

  const totalRevenue = data.reduce((sum, d) => sum + d.total_revenue, 0)
  const totalMargin = data.reduce((sum, d) => sum + d.total_margin, 0)
  const avgMarginPct = totalRevenue > 0 ? (totalMargin / totalRevenue) * 100 : 0
  const totalShipments = data.reduce((sum, d) => sum + d.shipment_count, 0)

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link to="/margin-dashboard" className="text-gray-400 hover:text-gray-200">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold text-white">Customer Profitability</h1>
              <PageHelp pageId="customer-profitability" />
            </div>
            <p className="text-gray-400 text-sm">Detailed profitability analysis by customer</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {(['30d', '90d', '1y'] as const).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                period === p
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              {p === '30d' ? '30 Days' : p === '90d' ? '90 Days' : '1 Year'}
            </button>
          ))}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
          <div className="flex items-center gap-2 text-gray-400 text-sm mb-1">
            <Building2 className="w-4 h-4" />
            Customers
          </div>
          <div className="text-2xl font-bold text-white">{data.length}</div>
        </div>
        <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
          <div className="flex items-center gap-2 text-gray-400 text-sm mb-1">
            <DollarSign className="w-4 h-4" />
            Total Revenue
          </div>
          <div className="text-2xl font-bold text-white">${totalRevenue.toLocaleString()}</div>
        </div>
        <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
          <div className="flex items-center gap-2 text-gray-400 text-sm mb-1">
            <Percent className="w-4 h-4" />
            Avg Margin
          </div>
          <div className="text-2xl font-bold text-white">{avgMarginPct.toFixed(1)}%</div>
        </div>
        <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
          <div className="flex items-center gap-2 text-gray-400 text-sm mb-1">
            <Package className="w-4 h-4" />
            Total Shipments
          </div>
          <div className="text-2xl font-bold text-white">{totalShipments.toLocaleString()}</div>
        </div>
      </div>

      {/* Sort Controls */}
      <div className="flex items-center gap-2">
        <span className="text-gray-400 text-sm">Sort by:</span>
        {(['margin', 'revenue', 'shipments'] as const).map((s) => (
          <button
            key={s}
            onClick={() => setSortBy(s)}
            className={`px-3 py-1 text-xs rounded-full transition-colors ${
              sortBy === s
                ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30'
                : 'bg-gray-700/50 text-gray-400 hover:bg-gray-700'
            }`}
          >
            {s === 'margin' ? 'Margin %' : s === 'revenue' ? 'Revenue' : 'Shipments'}
          </button>
        ))}
      </div>

      {/* Customer List */}
      <div className="space-y-3">
        {sortedData.length === 0 ? (
          <div className="bg-gray-800 rounded-xl p-8 text-center border border-gray-700">
            <BarChart3 className="w-12 h-12 text-gray-600 mx-auto mb-3" />
            <p className="text-gray-400">No profitability data available for this period</p>
          </div>
        ) : (
          sortedData.map((customer) => (
            <div
              key={customer.customer_id}
              className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden"
            >
              <button
                onClick={() =>
                  setExpandedCustomer(
                    expandedCustomer === customer.customer_id ? null : customer.customer_id
                  )
                }
                className="w-full p-4 flex items-center justify-between hover:bg-gray-750 transition-colors"
              >
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-lg bg-blue-600/20 flex items-center justify-center">
                    <Building2 className="w-5 h-5 text-blue-400" />
                  </div>
                  <div className="text-left">
                    <div className="font-medium text-white">{customer.customer_name}</div>
                    <div className="text-sm text-gray-400">
                      {customer.shipment_count} shipments | ${customer.total_revenue.toLocaleString()} revenue
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <div className={`text-lg font-bold ${
                      customer.margin_percent >= 15 ? 'text-green-400' :
                      customer.margin_percent >= 8 ? 'text-yellow-400' : 'text-red-400'
                    }`}>
                      {customer.margin_percent.toFixed(1)}%
                    </div>
                    <div className="text-xs text-gray-400">${customer.total_margin.toLocaleString()} margin</div>
                  </div>
                  <div className="flex items-center gap-1">
                    {customer.trend_direction === 'improving' ? (
                      <TrendingUp className="w-4 h-4 text-green-400" />
                    ) : customer.trend_direction === 'declining' ? (
                      <TrendingDown className="w-4 h-4 text-red-400" />
                    ) : (
                      <div className="w-4 h-4 text-gray-400">—</div>
                    )}
                    {expandedCustomer === customer.customer_id ? (
                      <ChevronUp className="w-4 h-4 text-gray-400" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-gray-400" />
                    )}
                  </div>
                </div>
              </button>

              {expandedCustomer === customer.customer_id && (
                <div className="border-t border-gray-700 p-4 space-y-4">
                  {/* Cost Breakdown */}
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                    <div className="bg-gray-900/50 rounded-lg p-3">
                      <div className="text-xs text-gray-400">Carrier Cost</div>
                      <div className="text-sm font-medium text-white">
                        ${customer.cost_breakdown.carrier_cost.toLocaleString()}
                      </div>
                    </div>
                    <div className="bg-gray-900/50 rounded-lg p-3">
                      <div className="text-xs text-gray-400">Accessorial</div>
                      <div className="text-sm font-medium text-white">
                        ${customer.cost_breakdown.accessorial_cost.toLocaleString()}
                      </div>
                    </div>
                    <div className="bg-gray-900/50 rounded-lg p-3">
                      <div className="text-xs text-gray-400">Quick Pay Disc.</div>
                      <div className="text-sm font-medium text-white">
                        ${customer.cost_breakdown.quick_pay_discount.toLocaleString()}
                      </div>
                    </div>
                    <div className="bg-gray-900/50 rounded-lg p-3">
                      <div className="text-xs text-gray-400">Other Cost</div>
                      <div className="text-sm font-medium text-white">
                        ${customer.cost_breakdown.other_cost.toLocaleString()}
                      </div>
                    </div>
                    <div className="bg-gray-900/50 rounded-lg p-3">
                      <div className="text-xs text-gray-400">Avg/Shipment</div>
                      <div className="text-sm font-medium text-white">
                        ${customer.avg_margin_per_shipment.toLocaleString()}
                      </div>
                    </div>
                  </div>

                  {/* Monthly Trend */}
                  {customer.monthly_data && customer.monthly_data.length > 0 && (
                    <div>
                      <h4 className="text-sm font-medium text-gray-300 mb-2">Monthly Trend</h4>
                      <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
                        {customer.monthly_data.slice(-6).map((month) => (
                          <div key={month.month} className="bg-gray-900/50 rounded-lg p-2 text-center">
                            <div className="text-xs text-gray-500">{month.month}</div>
                            <div className={`text-sm font-medium ${
                              month.margin_percent >= 15 ? 'text-green-400' :
                              month.margin_percent >= 8 ? 'text-yellow-400' : 'text-red-400'
                            }`}>
                              {month.margin_percent.toFixed(1)}%
                            </div>
                            <div className="text-xs text-gray-400">{month.shipment_count} loads</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* AI Insights */}
                  {customer.ai_insights && customer.ai_insights.length > 0 && (
                    <div className="bg-blue-900/20 rounded-lg p-3 border border-blue-800/30">
                      <div className="flex items-center gap-2 text-blue-400 text-sm font-medium mb-2">
                        <Sparkles className="w-4 h-4" />
                        AI Insights
                      </div>
                      <ul className="space-y-1">
                        {customer.ai_insights.map((insight, i) => (
                          <li key={i} className="text-sm text-gray-300">{insight}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  )
}
