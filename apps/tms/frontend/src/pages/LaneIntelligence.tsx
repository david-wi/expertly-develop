import { useEffect, useState } from 'react'
import { api } from '../services/api'
import type { LaneData } from '../types'
import {
  Map,
  ArrowRight,
  ChevronDown,
  ChevronUp,
  Truck,
  TrendingUp,
  Hash,
  DollarSign,
} from 'lucide-react'

type SortField = 'volume' | 'avg_rate' | 'avg_margin_percent'

export default function LaneIntelligence() {
  const [lanes, setLanes] = useState<LaneData[]>([])
  const [loading, setLoading] = useState(true)
  const [days, setDays] = useState(90)
  const [sortBy, setSortBy] = useState<SortField>('volume')
  const [expandedLane, setExpandedLane] = useState<string | null>(null)

  useEffect(() => {
    fetchData()
  }, [days])

  const fetchData = async () => {
    setLoading(true)
    try {
      const result = await api.getLaneIntelligence(days, 20)
      setLanes(result)
    } catch (error) {
      console.error('Failed to fetch lane intelligence:', error)
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

  const sortedLanes = [...lanes].sort((a, b) => {
    switch (sortBy) {
      case 'volume':
        return b.volume - a.volume
      case 'avg_rate':
        return b.avg_rate - a.avg_rate
      case 'avg_margin_percent':
        return b.avg_margin_percent - a.avg_margin_percent
      default:
        return b.volume - a.volume
    }
  })

  const toggleExpand = (laneKey: string) => {
    setExpandedLane(expandedLane === laneKey ? null : laneKey)
  }

  if (loading) {
    return <div className="p-8 text-center text-gray-500">Loading lane intelligence...</div>
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Map className="h-7 w-7 text-amber-600" />
            Lane Intelligence
          </h1>
          <p className="text-gray-500">Top lanes by volume with carrier performance data</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-500">Sort:</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortField)}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
            >
              <option value="volume">Volume</option>
              <option value="avg_rate">Avg Rate</option>
              <option value="avg_margin_percent">Margin %</option>
            </select>
          </div>
          <div className="flex border border-gray-300 rounded-lg overflow-hidden">
            {[
              { label: '30d', value: 30 },
              { label: '90d', value: 90 },
              { label: '180d', value: 180 },
            ].map((opt) => (
              <button
                key={opt.value}
                onClick={() => setDays(opt.value)}
                className={`px-4 py-2 text-sm font-medium transition-colors ${
                  days === opt.value
                    ? 'bg-amber-600 text-white'
                    : 'bg-white text-gray-600 hover:bg-gray-50'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 bg-amber-100 rounded-lg">
              <Hash className="h-5 w-5 text-amber-600" />
            </div>
            <span className="text-sm font-medium text-gray-500">Total Lanes</span>
          </div>
          <p className="text-2xl font-bold text-gray-900">{lanes.length}</p>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Truck className="h-5 w-5 text-blue-600" />
            </div>
            <span className="text-sm font-medium text-gray-500">Total Volume</span>
          </div>
          <p className="text-2xl font-bold text-gray-900">
            {lanes.reduce((sum, l) => sum + l.volume, 0)} loads
          </p>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 bg-emerald-100 rounded-lg">
              <DollarSign className="h-5 w-5 text-emerald-600" />
            </div>
            <span className="text-sm font-medium text-gray-500">Avg Margin %</span>
          </div>
          <p className="text-2xl font-bold text-gray-900">
            {lanes.length > 0
              ? (lanes.reduce((sum, l) => sum + l.avg_margin_percent, 0) / lanes.length).toFixed(1)
              : '0'}%
          </p>
        </div>
      </div>

      {/* Lanes Table */}
      {lanes.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <Map className="h-12 w-12 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500">No lane data available</p>
          <p className="text-sm text-gray-400 mt-2">Complete some shipments to see lane intelligence</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200 text-left">
                  <th className="px-6 py-4 text-sm font-medium text-gray-500 w-8"></th>
                  <th className="px-6 py-4 text-sm font-medium text-gray-500">Lane</th>
                  <th
                    className="px-6 py-4 text-sm font-medium text-gray-500 text-right cursor-pointer hover:text-gray-700"
                    onClick={() => setSortBy('volume')}
                  >
                    Volume {sortBy === 'volume' && <TrendingUp className="h-3 w-3 inline ml-1" />}
                  </th>
                  <th
                    className="px-6 py-4 text-sm font-medium text-gray-500 text-right cursor-pointer hover:text-gray-700"
                    onClick={() => setSortBy('avg_rate')}
                  >
                    Avg Rate {sortBy === 'avg_rate' && <TrendingUp className="h-3 w-3 inline ml-1" />}
                  </th>
                  <th className="px-6 py-4 text-sm font-medium text-gray-500 text-right">Avg Margin</th>
                  <th
                    className="px-6 py-4 text-sm font-medium text-gray-500 text-right cursor-pointer hover:text-gray-700"
                    onClick={() => setSortBy('avg_margin_percent')}
                  >
                    Margin % {sortBy === 'avg_margin_percent' && <TrendingUp className="h-3 w-3 inline ml-1" />}
                  </th>
                  <th className="px-6 py-4 text-sm font-medium text-gray-500 text-right">Carriers</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {sortedLanes.map((lane) => {
                  const laneKey = `${lane.origin_state}-${lane.destination_state}`
                  const isExpanded = expandedLane === laneKey
                  return (
                    <>
                      <tr
                        key={laneKey}
                        className="hover:bg-gray-50 cursor-pointer transition-colors"
                        onClick={() => toggleExpand(laneKey)}
                      >
                        <td className="px-6 py-4">
                          {lane.top_carriers.length > 0 ? (
                            isExpanded ? (
                              <ChevronUp className="h-4 w-4 text-gray-400" />
                            ) : (
                              <ChevronDown className="h-4 w-4 text-gray-400" />
                            )
                          ) : null}
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-gray-900 text-lg">{lane.origin_state}</span>
                            <ArrowRight className="h-4 w-4 text-gray-400" />
                            <span className="font-semibold text-gray-900 text-lg">{lane.destination_state}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <span className="text-sm font-semibold text-gray-900">{lane.volume}</span>
                          <span className="text-xs text-gray-400 ml-1">loads</span>
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-600 text-right">
                          {formatCurrency(lane.avg_rate)}
                        </td>
                        <td className={`px-6 py-4 text-sm font-semibold text-right ${getMarginColor(lane.avg_margin_percent)}`}>
                          {formatCurrency(lane.avg_margin)}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <span className={`text-xs px-2 py-1 rounded-full font-semibold ${getMarginBgColor(lane.avg_margin_percent)}`}>
                            {lane.avg_margin_percent}%
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-600 text-right">
                          {lane.top_carriers.length}
                        </td>
                      </tr>
                      {isExpanded && lane.top_carriers.length > 0 && (
                        <tr key={`${laneKey}-expanded`}>
                          <td colSpan={7} className="px-6 py-0">
                            <div className="bg-gray-50 rounded-lg p-4 mb-4 ml-8">
                              <h4 className="text-sm font-semibold text-gray-700 mb-3">Top Carriers on This Lane</h4>
                              <table className="w-full">
                                <thead>
                                  <tr className="text-xs text-gray-500 uppercase">
                                    <th className="pb-2 text-left">Carrier</th>
                                    <th className="pb-2 text-right">Loads</th>
                                    <th className="pb-2 text-right">On-Time %</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {lane.top_carriers.map((carrier: any) => (
                                    <tr key={carrier.carrier_id} className="border-t border-gray-200">
                                      <td className="py-2 text-sm font-medium text-gray-900">
                                        {carrier.carrier_name}
                                      </td>
                                      <td className="py-2 text-sm text-gray-600 text-right">{carrier.loads}</td>
                                      <td className="py-2 text-right">
                                        <span className={`text-sm font-semibold ${
                                          carrier.on_time_pct >= 90 ? 'text-emerald-600' :
                                          carrier.on_time_pct >= 75 ? 'text-amber-600' : 'text-red-600'
                                        }`}>
                                          {carrier.on_time_pct}%
                                        </span>
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
