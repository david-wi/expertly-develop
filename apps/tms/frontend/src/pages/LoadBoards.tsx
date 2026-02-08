import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import PageHelp from '../components/PageHelp'
import {
  Radio,
  Search,
  Settings,
  Truck,
  DollarSign,
  TrendingUp,
  ExternalLink,
  CheckCircle,
  XCircle,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  Eye,
  Phone,
  Mail,
  Star,
  MapPin,
  BarChart3,
} from 'lucide-react'
import { api } from '../services/api'
import {
  LoadBoardPosting,
  CarrierSearch,
  CarrierSearchResult,
  RateIndex,
  LoadBoardProvider,
  PostingStatus,
  SpotRateComparison,
  RateTrends,
  LOADBOARD_PROVIDER_LABELS,
  POSTING_STATUS_LABELS,
} from '../types'

type TabType = 'postings' | 'search' | 'rates' | 'spot_market' | 'dat' | 'truckstop' | 'settings'

export default function LoadBoards() {
  const [activeTab, setActiveTab] = useState<TabType>('postings')

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-gray-900">Load Board Integration</h1>
            <PageHelp pageId="loadboards" />
          </div>
          <p className="text-gray-600">Post loads, find carriers, and get market rates from DAT & Truckstop</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          {[
            { id: 'postings', label: 'My Postings', icon: Radio },
            { id: 'search', label: 'Find Carriers', icon: Search },
            { id: 'rates', label: 'Market Rates', icon: TrendingUp },
            { id: 'spot_market', label: 'Spot vs Contract', icon: BarChart3 },
            { id: 'dat', label: 'DAT', icon: ExternalLink },
            { id: 'truckstop', label: 'Truckstop', icon: ExternalLink },
            { id: 'settings', label: 'Settings', icon: Settings },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as TabType)}
              className={`flex items-center gap-2 py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === tab.id
                  ? 'border-emerald-500 text-emerald-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      <div>
        {activeTab === 'postings' && <PostingsTab />}
        {activeTab === 'search' && <CarrierSearchTab />}
        {activeTab === 'rates' && <MarketRatesTab />}
        {activeTab === 'spot_market' && <SpotMarketTab />}
        {activeTab === 'dat' && <DATIntegrationTab />}
        {activeTab === 'truckstop' && <TruckstopIntegrationTab />}
        {activeTab === 'settings' && <SettingsTab />}
      </div>
    </div>
  )
}

// ==================== Postings Tab ====================

function PostingsTab() {
  const { data: postings, isLoading } = useQuery({
    queryKey: ['loadboard-postings'],
    queryFn: () => api.getLoadBoardPostings(),
  })

  const { data: stats } = useQuery({
    queryKey: ['loadboard-stats'],
    queryFn: () => api.getLoadBoardPostingStats(),
  })

  if (isLoading) {
    return <div className="text-center py-12 text-gray-500">Loading postings...</div>
  }

  return (
    <div className="space-y-6">
      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-5 gap-4">
          {[
            { label: 'Draft', value: stats.draft, color: 'bg-gray-100 text-gray-700' },
            { label: 'Posted', value: stats.posted, color: 'bg-emerald-100 text-emerald-700' },
            { label: 'Booked', value: stats.booked, color: 'bg-blue-100 text-blue-700' },
            { label: 'Expired', value: stats.expired, color: 'bg-yellow-100 text-yellow-700' },
            { label: 'Cancelled', value: stats.cancelled, color: 'bg-red-100 text-red-700' },
          ].map((stat) => (
            <div key={stat.label} className={`${stat.color} rounded-lg p-4 text-center`}>
              <div className="text-2xl font-bold">{stat.value}</div>
              <div className="text-sm">{stat.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Postings List */}
      {postings && postings.length > 0 ? (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Posting
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Lane
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Equipment
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Rate
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Posted To
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Engagement
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {postings.map((posting) => (
                <PostingRow key={posting.id} posting={posting} />
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
          <Radio className="w-12 h-12 mx-auto text-gray-400" />
          <h3 className="mt-2 text-sm font-medium text-gray-900">No load postings</h3>
          <p className="mt-1 text-sm text-gray-500">
            Post loads from the Shipment detail page to find carriers on DAT and Truckstop.
          </p>
        </div>
      )}
    </div>
  )
}

function PostingRow({ posting }: { posting: LoadBoardPosting }) {
  const statusColors: Record<PostingStatus, string> = {
    draft: 'bg-gray-100 text-gray-700',
    posted: 'bg-emerald-100 text-emerald-700',
    booked: 'bg-blue-100 text-blue-700',
    expired: 'bg-yellow-100 text-yellow-700',
    cancelled: 'bg-red-100 text-red-700',
  }

  return (
    <tr className="hover:bg-gray-50">
      <td className="px-6 py-4 whitespace-nowrap">
        <div className="text-sm font-medium text-gray-900">{posting.posting_number}</div>
        <div className="text-xs text-gray-500">
          {posting.created_at ? new Date(posting.created_at).toLocaleDateString() : ''}
        </div>
      </td>
      <td className="px-6 py-4 whitespace-nowrap">
        <div className="text-sm text-gray-900">
          {posting.origin_city}, {posting.origin_state}
        </div>
        <div className="text-sm text-gray-500">
          → {posting.destination_city}, {posting.destination_state}
        </div>
      </td>
      <td className="px-6 py-4 whitespace-nowrap">
        <div className="text-sm text-gray-900 capitalize">{posting.equipment_type}</div>
        {posting.weight_lbs && (
          <div className="text-xs text-gray-500">{posting.weight_lbs.toLocaleString()} lbs</div>
        )}
      </td>
      <td className="px-6 py-4 whitespace-nowrap">
        {posting.posted_rate ? (
          <div className="text-sm font-medium text-gray-900">
            ${(posting.posted_rate / 100).toFixed(2)}
          </div>
        ) : posting.rate_per_mile ? (
          <div className="text-sm font-medium text-gray-900">
            ${posting.rate_per_mile.toFixed(2)}/mi
          </div>
        ) : (
          <span className="text-gray-400">-</span>
        )}
      </td>
      <td className="px-6 py-4 whitespace-nowrap">
        <div className="flex flex-wrap gap-1">
          {posting.providers.map((provider) => (
            <span
              key={provider}
              className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-indigo-100 text-indigo-800"
            >
              {LOADBOARD_PROVIDER_LABELS[provider as LoadBoardProvider]}
            </span>
          ))}
        </div>
      </td>
      <td className="px-6 py-4 whitespace-nowrap">
        <span
          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
            statusColors[posting.status as PostingStatus]
          }`}
        >
          {POSTING_STATUS_LABELS[posting.status as PostingStatus]}
        </span>
      </td>
      <td className="px-6 py-4 whitespace-nowrap">
        <div className="flex items-center gap-4 text-sm text-gray-500">
          <div className="flex items-center gap-1" title="Views">
            <Eye className="w-4 h-4" />
            {posting.view_count}
          </div>
          <div className="flex items-center gap-1" title="Calls">
            <Phone className="w-4 h-4" />
            {posting.call_count}
          </div>
        </div>
      </td>
    </tr>
  )
}

// ==================== Carrier Search Tab ====================

function CarrierSearchTab() {
  const [searchParams, setSearchParams] = useState({
    origin_city: '',
    origin_state: '',
    destination_city: '',
    destination_state: '',
    equipment_type: 'van',
    providers: ['dat', 'truckstop'] as LoadBoardProvider[],
  })
  const [searchResults, setSearchResults] = useState<CarrierSearch | null>(null)

  const searchMutation = useMutation({
    mutationFn: () => api.searchLoadBoardCarriers(searchParams),
    onSuccess: (data) => setSearchResults(data),
  })

  return (
    <div className="space-y-6">
      {/* Search Form */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Search for Available Carriers</h3>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Origin City</label>
            <input
              type="text"
              value={searchParams.origin_city}
              onChange={(e) => setSearchParams({ ...searchParams, origin_city: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-emerald-500 focus:border-emerald-500"
              placeholder="Chicago"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Origin State</label>
            <input
              type="text"
              value={searchParams.origin_state}
              onChange={(e) => setSearchParams({ ...searchParams, origin_state: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-emerald-500 focus:border-emerald-500"
              placeholder="IL"
              maxLength={2}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Destination City</label>
            <input
              type="text"
              value={searchParams.destination_city}
              onChange={(e) => setSearchParams({ ...searchParams, destination_city: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-emerald-500 focus:border-emerald-500"
              placeholder="Dallas"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Destination State</label>
            <input
              type="text"
              value={searchParams.destination_state}
              onChange={(e) => setSearchParams({ ...searchParams, destination_state: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-emerald-500 focus:border-emerald-500"
              placeholder="TX"
              maxLength={2}
            />
          </div>
        </div>

        <div className="mt-4 flex items-center justify-between">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Equipment Type</label>
            <select
              value={searchParams.equipment_type}
              onChange={(e) => setSearchParams({ ...searchParams, equipment_type: e.target.value })}
              className="px-3 py-2 border border-gray-300 rounded-md focus:ring-emerald-500 focus:border-emerald-500"
            >
              <option value="van">Van</option>
              <option value="reefer">Reefer</option>
              <option value="flatbed">Flatbed</option>
              <option value="step_deck">Step Deck</option>
            </select>
          </div>

          <button
            onClick={() => searchMutation.mutate()}
            disabled={searchMutation.isPending || !searchParams.origin_state}
            className="inline-flex items-center gap-2 px-6 py-2 bg-emerald-600 text-white rounded-md hover:bg-emerald-700 disabled:opacity-50"
          >
            {searchMutation.isPending ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <Search className="w-4 h-4" />
            )}
            Search Carriers
          </button>
        </div>
      </div>

      {/* Search Results */}
      {searchResults && (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
            <h3 className="text-lg font-medium text-gray-900">
              {searchResults.result_count} Carriers Found
            </h3>
            <p className="text-sm text-gray-500">
              Searched at {new Date(searchResults.searched_at).toLocaleString()}
            </p>
          </div>

          {searchResults.results.length > 0 ? (
            <div className="divide-y divide-gray-200">
              {searchResults.results.map((carrier, idx) => (
                <CarrierSearchResultRow key={idx} carrier={carrier} />
              ))}
            </div>
          ) : (
            <div className="p-12 text-center text-gray-500">
              No carriers found matching your criteria. Try expanding your search radius.
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function CarrierSearchResultRow({ carrier }: { carrier: CarrierSearchResult }) {
  return (
    <div className="p-6 hover:bg-gray-50">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h4 className="text-lg font-medium text-gray-900">{carrier.carrier_name}</h4>
            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-indigo-100 text-indigo-800">
              {LOADBOARD_PROVIDER_LABELS[carrier.provider as LoadBoardProvider]}
            </span>
          </div>

          <div className="mt-2 flex flex-wrap gap-4 text-sm text-gray-600">
            {carrier.mc_number && (
              <span>MC# {carrier.mc_number}</span>
            )}
            {carrier.city && carrier.state && (
              <span className="flex items-center gap-1">
                <MapPin className="w-4 h-4" />
                {carrier.city}, {carrier.state}
              </span>
            )}
            {carrier.truck_count && (
              <span className="flex items-center gap-1">
                <Truck className="w-4 h-4" />
                {carrier.truck_count} truck{carrier.truck_count > 1 ? 's' : ''} available
              </span>
            )}
            {carrier.deadhead_miles !== undefined && (
              <span>{carrier.deadhead_miles} mi deadhead</span>
            )}
          </div>

          {/* Contact Info */}
          <div className="mt-3 flex flex-wrap gap-4 text-sm">
            {carrier.contact_name && (
              <span className="text-gray-900">{carrier.contact_name}</span>
            )}
            {carrier.contact_phone && (
              <a href={`tel:${carrier.contact_phone}`} className="text-emerald-600 hover:text-emerald-700 flex items-center gap-1">
                <Phone className="w-4 h-4" />
                {carrier.contact_phone}
              </a>
            )}
            {carrier.contact_email && (
              <a href={`mailto:${carrier.contact_email}`} className="text-emerald-600 hover:text-emerald-700 flex items-center gap-1">
                <Mail className="w-4 h-4" />
                {carrier.contact_email}
              </a>
            )}
          </div>
        </div>

        {/* Performance Stats */}
        <div className="ml-6 text-right">
          {carrier.rating && (
            <div className="flex items-center gap-1 text-yellow-500">
              <Star className="w-4 h-4 fill-current" />
              <span className="font-medium">{carrier.rating.toFixed(1)}</span>
            </div>
          )}
          {carrier.on_time_percentage && (
            <div className="text-sm text-gray-600">
              {carrier.on_time_percentage.toFixed(1)}% on-time
            </div>
          )}
          {carrier.total_loads && (
            <div className="text-sm text-gray-500">
              {carrier.total_loads.toLocaleString()} loads
            </div>
          )}
          {carrier.days_to_pay && (
            <div className="text-sm text-gray-500">
              {carrier.days_to_pay} days to pay
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ==================== Market Rates Tab ====================

function MarketRatesTab() {
  const [rateParams, setRateParams] = useState({
    origin_city: '',
    origin_state: '',
    destination_city: '',
    destination_state: '',
    equipment_type: 'van',
  })
  const [rates, setRates] = useState<RateIndex[]>([])

  const ratesMutation = useMutation({
    mutationFn: () => api.getMarketRates(rateParams),
    onSuccess: (data) => setRates(data),
  })

  return (
    <div className="space-y-6">
      {/* Rate Lookup Form */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Lane Rate Lookup</h3>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Origin City</label>
            <input
              type="text"
              value={rateParams.origin_city}
              onChange={(e) => setRateParams({ ...rateParams, origin_city: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-emerald-500 focus:border-emerald-500"
              placeholder="Chicago"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Origin State</label>
            <input
              type="text"
              value={rateParams.origin_state}
              onChange={(e) => setRateParams({ ...rateParams, origin_state: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-emerald-500 focus:border-emerald-500"
              placeholder="IL"
              maxLength={2}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Destination City</label>
            <input
              type="text"
              value={rateParams.destination_city}
              onChange={(e) => setRateParams({ ...rateParams, destination_city: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-emerald-500 focus:border-emerald-500"
              placeholder="Dallas"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Destination State</label>
            <input
              type="text"
              value={rateParams.destination_state}
              onChange={(e) => setRateParams({ ...rateParams, destination_state: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-emerald-500 focus:border-emerald-500"
              placeholder="TX"
              maxLength={2}
            />
          </div>
        </div>

        <div className="mt-4 flex items-center justify-between">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Equipment Type</label>
            <select
              value={rateParams.equipment_type}
              onChange={(e) => setRateParams({ ...rateParams, equipment_type: e.target.value })}
              className="px-3 py-2 border border-gray-300 rounded-md focus:ring-emerald-500 focus:border-emerald-500"
            >
              <option value="van">Van</option>
              <option value="reefer">Reefer</option>
              <option value="flatbed">Flatbed</option>
              <option value="step_deck">Step Deck</option>
            </select>
          </div>

          <button
            onClick={() => ratesMutation.mutate()}
            disabled={ratesMutation.isPending || !rateParams.origin_city || !rateParams.destination_city}
            className="inline-flex items-center gap-2 px-6 py-2 bg-emerald-600 text-white rounded-md hover:bg-emerald-700 disabled:opacity-50"
          >
            {ratesMutation.isPending ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <DollarSign className="w-4 h-4" />
            )}
            Get Rates
          </button>
        </div>
      </div>

      {/* Rate Results */}
      {rates.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {rates.map((rate, idx) => (
            <div key={idx} className="bg-white rounded-lg border border-gray-200 p-6">
              <div className="flex items-center justify-between mb-4">
                <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-indigo-100 text-indigo-800">
                  {LOADBOARD_PROVIDER_LABELS[rate.provider as LoadBoardProvider]}
                </span>
                <span className="text-sm text-gray-500">{rate.date_range}</span>
              </div>

              <div className="mb-4">
                <div className="text-lg font-medium text-gray-900">
                  {rate.origin} → {rate.destination}
                </div>
                <div className="text-sm text-gray-500 capitalize">{rate.equipment_type}</div>
              </div>

              {/* Rate per Mile */}
              <div className="mb-4">
                <div className="text-sm font-medium text-gray-700 mb-2">Rate per Mile</div>
                <div className="flex items-center gap-4">
                  <div className="text-center">
                    <div className="text-sm text-gray-500">Low</div>
                    <div className="text-lg font-medium text-red-600">
                      ${rate.rate_per_mile_low?.toFixed(2) || '-'}
                    </div>
                  </div>
                  <div className="text-center">
                    <div className="text-sm text-gray-500">Avg</div>
                    <div className="text-2xl font-bold text-emerald-600">
                      ${rate.rate_per_mile_avg?.toFixed(2) || '-'}
                    </div>
                  </div>
                  <div className="text-center">
                    <div className="text-sm text-gray-500">High</div>
                    <div className="text-lg font-medium text-blue-600">
                      ${rate.rate_per_mile_high?.toFixed(2) || '-'}
                    </div>
                  </div>
                </div>
              </div>

              {/* Flat Rates */}
              <div className="mb-4">
                <div className="text-sm font-medium text-gray-700 mb-2">Flat Rate</div>
                <div className="flex items-center gap-4">
                  <div className="text-center">
                    <div className="text-sm text-gray-500">Low</div>
                    <div className="text-lg font-medium text-red-600">
                      ${rate.flat_rate_low ? (rate.flat_rate_low / 100).toFixed(0) : '-'}
                    </div>
                  </div>
                  <div className="text-center">
                    <div className="text-sm text-gray-500">Avg</div>
                    <div className="text-2xl font-bold text-emerald-600">
                      ${rate.flat_rate_avg ? (rate.flat_rate_avg / 100).toFixed(0) : '-'}
                    </div>
                  </div>
                  <div className="text-center">
                    <div className="text-sm text-gray-500">High</div>
                    <div className="text-lg font-medium text-blue-600">
                      ${rate.flat_rate_high ? (rate.flat_rate_high / 100).toFixed(0) : '-'}
                    </div>
                  </div>
                </div>
              </div>

              {/* Market Activity */}
              <div className="flex items-center justify-between text-sm text-gray-500 pt-4 border-t border-gray-200">
                <span>{rate.load_count || 0} loads posted</span>
                <span>{rate.truck_count || 0} trucks available</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {rates.length === 0 && !ratesMutation.isPending && (
        <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
          <TrendingUp className="w-12 h-12 mx-auto text-gray-400" />
          <h3 className="mt-2 text-sm font-medium text-gray-900">No rate data</h3>
          <p className="mt-1 text-sm text-gray-500">
            Enter a lane to see current market rates from DAT and Truckstop.
          </p>
        </div>
      )}
    </div>
  )
}

// ==================== DAT Integration Tab ====================

function DATIntegrationTab() {
  const [postForm, setPostForm] = useState({
    shipment_id: '',
    origin_city: '',
    origin_state: '',
    destination_city: '',
    destination_state: '',
    equipment_type: 'van',
    posted_rate: '',
  })
  const [searchForm, setSearchForm] = useState({
    origin_city: '',
    origin_state: '',
    destination_city: '',
    destination_state: '',
    equipment_type: 'van',
  })
  const [postResult, setPostResult] = useState<any>(null)
  const [searchResults, setSearchResults] = useState<any>(null)
  const [rateResults, setRateResults] = useState<any[]>([])

  const postMutation = useMutation({
    mutationFn: () => api.datPostLoad({
      ...postForm,
      posted_rate: postForm.posted_rate ? Number(postForm.posted_rate) * 100 : undefined,
    }),
    onSuccess: (data) => setPostResult(data),
  })

  const searchMutation = useMutation({
    mutationFn: () => api.datSearchCarriers(searchForm),
    onSuccess: (data) => setSearchResults(data),
  })

  const rateMutation = useMutation({
    mutationFn: () => api.datRateLookup(searchForm),
    onSuccess: (data) => setRateResults(data),
  })

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
            <span className="text-blue-700 font-bold text-sm">DAT</span>
          </div>
          <div>
            <h3 className="text-lg font-medium text-gray-900">DAT Power Integration</h3>
            <p className="text-sm text-gray-500">Post loads, search carriers, and get RateView data from DAT</p>
          </div>
        </div>
      </div>

      {/* Post Load to DAT */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h4 className="text-md font-medium text-gray-900 mb-4">Post Load to DAT</h4>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Shipment ID</label>
            <input type="text" value={postForm.shipment_id} onChange={(e) => setPostForm({ ...postForm, shipment_id: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm" placeholder="SHP-..." />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Origin City</label>
            <input type="text" value={postForm.origin_city} onChange={(e) => setPostForm({ ...postForm, origin_city: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm" placeholder="Chicago" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Origin State</label>
            <input type="text" value={postForm.origin_state} onChange={(e) => setPostForm({ ...postForm, origin_state: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm" placeholder="IL" maxLength={2} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Rate ($)</label>
            <input type="number" value={postForm.posted_rate} onChange={(e) => setPostForm({ ...postForm, posted_rate: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm" placeholder="2500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Dest City</label>
            <input type="text" value={postForm.destination_city} onChange={(e) => setPostForm({ ...postForm, destination_city: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm" placeholder="Dallas" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Dest State</label>
            <input type="text" value={postForm.destination_state} onChange={(e) => setPostForm({ ...postForm, destination_state: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm" placeholder="TX" maxLength={2} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Equipment</label>
            <select value={postForm.equipment_type} onChange={(e) => setPostForm({ ...postForm, equipment_type: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm">
              <option value="van">Van</option><option value="reefer">Reefer</option><option value="flatbed">Flatbed</option>
            </select>
          </div>
        </div>
        <button onClick={() => postMutation.mutate()} disabled={postMutation.isPending || !postForm.shipment_id}
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 text-sm">
          {postMutation.isPending ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Radio className="w-4 h-4" />}
          Post to DAT
        </button>
        {postResult && (
          <div className="mt-3 p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700">
            Load posted successfully. Posting #{postResult.posting_number} - Status: {postResult.status}
          </div>
        )}
      </div>

      {/* Search Carriers on DAT */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h4 className="text-md font-medium text-gray-900 mb-4">Search DAT Carriers</h4>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Origin City</label>
            <input type="text" value={searchForm.origin_city} onChange={(e) => setSearchForm({ ...searchForm, origin_city: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm" placeholder="Chicago" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Origin State</label>
            <input type="text" value={searchForm.origin_state} onChange={(e) => setSearchForm({ ...searchForm, origin_state: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm" placeholder="IL" maxLength={2} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Dest City</label>
            <input type="text" value={searchForm.destination_city} onChange={(e) => setSearchForm({ ...searchForm, destination_city: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm" placeholder="Dallas" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Dest State</label>
            <input type="text" value={searchForm.destination_state} onChange={(e) => setSearchForm({ ...searchForm, destination_state: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm" placeholder="TX" maxLength={2} />
          </div>
        </div>
        <div className="flex gap-3">
          <button onClick={() => searchMutation.mutate()} disabled={searchMutation.isPending || !searchForm.origin_state}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 text-sm">
            {searchMutation.isPending ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            Search Carriers
          </button>
          <button onClick={() => rateMutation.mutate()} disabled={rateMutation.isPending || !searchForm.origin_city}
            className="inline-flex items-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 disabled:opacity-50 text-sm">
            {rateMutation.isPending ? <RefreshCw className="w-4 h-4 animate-spin" /> : <DollarSign className="w-4 h-4" />}
            Rate Lookup
          </button>
        </div>
        {searchResults && (
          <div className="mt-4 p-4 bg-gray-50 rounded-lg">
            <p className="text-sm font-medium text-gray-900">{searchResults.result_count} carriers found on DAT</p>
            {searchResults.results?.map((c: any, i: number) => (
              <div key={i} className="flex items-center justify-between py-2 border-b border-gray-200 last:border-0">
                <div><span className="font-medium text-sm">{c.carrier_name}</span> {c.mc_number && <span className="text-xs text-gray-500 ml-2">MC#{c.mc_number}</span>}</div>
                <div className="flex items-center gap-4 text-sm text-gray-500">
                  {c.truck_count && <span>{c.truck_count} trucks</span>}
                  {c.contact_phone && <span>{c.contact_phone}</span>}
                </div>
              </div>
            ))}
          </div>
        )}
        {rateResults.length > 0 && (
          <div className="mt-4 grid grid-cols-3 gap-4">
            {rateResults.map((r: any, i: number) => (
              <div key={i} className="p-4 bg-blue-50 rounded-lg text-center">
                <p className="text-xs text-gray-500">DAT Rate/Mile</p>
                <p className="text-lg font-bold text-blue-700">${r.rate_per_mile_avg?.toFixed(2) || '-'}</p>
                <p className="text-xs text-gray-400">{r.load_count || 0} loads, {r.truck_count || 0} trucks</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ==================== Truckstop Integration Tab ====================

function TruckstopIntegrationTab() {
  const [postForm, setPostForm] = useState({
    shipment_id: '',
    origin_city: '',
    origin_state: '',
    destination_city: '',
    destination_state: '',
    equipment_type: 'van',
    posted_rate: '',
  })
  const [searchForm, setSearchForm] = useState({
    origin_city: '',
    origin_state: '',
    destination_city: '',
    destination_state: '',
    equipment_type: 'van',
  })
  const [postResult, setPostResult] = useState<any>(null)
  const [searchResults, setSearchResults] = useState<any>(null)
  const [rateResults, setRateResults] = useState<any[]>([])

  const postMutation = useMutation({
    mutationFn: () => api.truckstopPostLoad({
      ...postForm,
      posted_rate: postForm.posted_rate ? Number(postForm.posted_rate) * 100 : undefined,
    }),
    onSuccess: (data) => setPostResult(data),
  })

  const searchMutation = useMutation({
    mutationFn: () => api.truckstopSearch(searchForm),
    onSuccess: (data) => setSearchResults(data),
  })

  const rateMutation = useMutation({
    mutationFn: () => api.truckstopRates(searchForm),
    onSuccess: (data) => setRateResults(data),
  })

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
            <span className="text-orange-700 font-bold text-sm">TS</span>
          </div>
          <div>
            <h3 className="text-lg font-medium text-gray-900">Truckstop.com Integration</h3>
            <p className="text-sm text-gray-500">Post loads, search carriers, and get rate data from Truckstop</p>
          </div>
        </div>
      </div>

      {/* Post Load to Truckstop */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h4 className="text-md font-medium text-gray-900 mb-4">Post Load to Truckstop</h4>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Shipment ID</label>
            <input type="text" value={postForm.shipment_id} onChange={(e) => setPostForm({ ...postForm, shipment_id: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm" placeholder="SHP-..." />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Origin City</label>
            <input type="text" value={postForm.origin_city} onChange={(e) => setPostForm({ ...postForm, origin_city: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm" placeholder="Chicago" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Origin State</label>
            <input type="text" value={postForm.origin_state} onChange={(e) => setPostForm({ ...postForm, origin_state: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm" placeholder="IL" maxLength={2} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Rate ($)</label>
            <input type="number" value={postForm.posted_rate} onChange={(e) => setPostForm({ ...postForm, posted_rate: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm" placeholder="2500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Dest City</label>
            <input type="text" value={postForm.destination_city} onChange={(e) => setPostForm({ ...postForm, destination_city: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm" placeholder="Dallas" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Dest State</label>
            <input type="text" value={postForm.destination_state} onChange={(e) => setPostForm({ ...postForm, destination_state: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm" placeholder="TX" maxLength={2} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Equipment</label>
            <select value={postForm.equipment_type} onChange={(e) => setPostForm({ ...postForm, equipment_type: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm">
              <option value="van">Van</option><option value="reefer">Reefer</option><option value="flatbed">Flatbed</option>
            </select>
          </div>
        </div>
        <button onClick={() => postMutation.mutate()} disabled={postMutation.isPending || !postForm.shipment_id}
          className="inline-flex items-center gap-2 px-4 py-2 bg-orange-600 text-white rounded-md hover:bg-orange-700 disabled:opacity-50 text-sm">
          {postMutation.isPending ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Radio className="w-4 h-4" />}
          Post to Truckstop
        </button>
        {postResult && (
          <div className="mt-3 p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700">
            Load posted successfully. Posting #{postResult.posting_number} - Status: {postResult.status}
          </div>
        )}
      </div>

      {/* Search Carriers on Truckstop */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h4 className="text-md font-medium text-gray-900 mb-4">Search Truckstop Carriers</h4>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Origin City</label>
            <input type="text" value={searchForm.origin_city} onChange={(e) => setSearchForm({ ...searchForm, origin_city: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm" placeholder="Chicago" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Origin State</label>
            <input type="text" value={searchForm.origin_state} onChange={(e) => setSearchForm({ ...searchForm, origin_state: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm" placeholder="IL" maxLength={2} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Dest City</label>
            <input type="text" value={searchForm.destination_city} onChange={(e) => setSearchForm({ ...searchForm, destination_city: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm" placeholder="Dallas" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Dest State</label>
            <input type="text" value={searchForm.destination_state} onChange={(e) => setSearchForm({ ...searchForm, destination_state: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm" placeholder="TX" maxLength={2} />
          </div>
        </div>
        <div className="flex gap-3">
          <button onClick={() => searchMutation.mutate()} disabled={searchMutation.isPending || !searchForm.origin_state}
            className="inline-flex items-center gap-2 px-4 py-2 bg-orange-600 text-white rounded-md hover:bg-orange-700 disabled:opacity-50 text-sm">
            {searchMutation.isPending ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            Search Carriers
          </button>
          <button onClick={() => rateMutation.mutate()} disabled={rateMutation.isPending || !searchForm.origin_city}
            className="inline-flex items-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 disabled:opacity-50 text-sm">
            {rateMutation.isPending ? <RefreshCw className="w-4 h-4 animate-spin" /> : <DollarSign className="w-4 h-4" />}
            Rate Lookup
          </button>
        </div>
        {searchResults && (
          <div className="mt-4 p-4 bg-gray-50 rounded-lg">
            <p className="text-sm font-medium text-gray-900">{searchResults.result_count} carriers found on Truckstop</p>
            {searchResults.results?.map((c: any, i: number) => (
              <div key={i} className="flex items-center justify-between py-2 border-b border-gray-200 last:border-0">
                <div><span className="font-medium text-sm">{c.carrier_name}</span> {c.mc_number && <span className="text-xs text-gray-500 ml-2">MC#{c.mc_number}</span>}</div>
                <div className="flex items-center gap-4 text-sm text-gray-500">
                  {c.truck_count && <span>{c.truck_count} trucks</span>}
                  {c.contact_phone && <span>{c.contact_phone}</span>}
                </div>
              </div>
            ))}
          </div>
        )}
        {rateResults.length > 0 && (
          <div className="mt-4 grid grid-cols-3 gap-4">
            {rateResults.map((r: any, i: number) => (
              <div key={i} className="p-4 bg-orange-50 rounded-lg text-center">
                <p className="text-xs text-gray-500">Truckstop Rate/Mile</p>
                <p className="text-lg font-bold text-orange-700">${r.rate_per_mile_avg?.toFixed(2) || '-'}</p>
                <p className="text-xs text-gray-400">{r.load_count || 0} loads, {r.truck_count || 0} trucks</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ==================== Spot Market Tab ====================

function SpotMarketTab() {
  const [spotParams, setSpotParams] = useState({
    origin_city: '',
    origin_state: '',
    destination_city: '',
    destination_state: '',
    equipment_type: 'van',
  })
  const [comparison, setComparison] = useState<SpotRateComparison | null>(null)
  const [trends, setTrends] = useState<RateTrends | null>(null)

  const spotMutation = useMutation({
    mutationFn: async () => {
      const spotData = await api.getSpotRates(spotParams)
      const lane = `${spotParams.origin_city}, ${spotParams.origin_state} -> ${spotParams.destination_city}, ${spotParams.destination_state}`
      const trendData = await api.getRateTrends({
        lane,
        equipment_type: spotParams.equipment_type,
        days: 90,
      })
      return { spot: spotData, trends: trendData }
    },
    onSuccess: ({ spot, trends: trendData }) => {
      setComparison(spot)
      setTrends(trendData)
    },
  })

  const formatDollar = (cents: number) => `$${(cents / 100).toFixed(2)}`
  const formatRpm = (rpm?: number) => (rpm ? `$${rpm.toFixed(2)}/mi` : '-')

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-2">Spot vs Contract Rate Comparison</h3>
        <p className="text-sm text-gray-500 mb-4">Compare real-time spot market rates against your contract rates</p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Origin City</label>
            <input type="text" value={spotParams.origin_city} onChange={(e) => setSpotParams({ ...spotParams, origin_city: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-emerald-500 focus:border-emerald-500" placeholder="Chicago" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Origin State</label>
            <input type="text" value={spotParams.origin_state} onChange={(e) => setSpotParams({ ...spotParams, origin_state: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-emerald-500 focus:border-emerald-500" placeholder="IL" maxLength={2} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Dest City</label>
            <input type="text" value={spotParams.destination_city} onChange={(e) => setSpotParams({ ...spotParams, destination_city: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-emerald-500 focus:border-emerald-500" placeholder="Dallas" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Dest State</label>
            <input type="text" value={spotParams.destination_state} onChange={(e) => setSpotParams({ ...spotParams, destination_state: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-emerald-500 focus:border-emerald-500" placeholder="TX" maxLength={2} />
          </div>
        </div>
        <div className="mt-4 flex items-center justify-between">
          <select value={spotParams.equipment_type} onChange={(e) => setSpotParams({ ...spotParams, equipment_type: e.target.value })} className="px-3 py-2 border border-gray-300 rounded-md focus:ring-emerald-500 focus:border-emerald-500">
            <option value="van">Van</option>
            <option value="reefer">Reefer</option>
            <option value="flatbed">Flatbed</option>
            <option value="step_deck">Step Deck</option>
          </select>
          <button onClick={() => spotMutation.mutate()} disabled={spotMutation.isPending || !spotParams.origin_city || !spotParams.destination_city} className="inline-flex items-center gap-2 px-6 py-2 bg-emerald-600 text-white rounded-md hover:bg-emerald-700 disabled:opacity-50">
            {spotMutation.isPending ? <RefreshCw className="w-4 h-4 animate-spin" /> : <BarChart3 className="w-4 h-4" />}
            Compare Rates
          </button>
        </div>
      </div>

      {comparison && (
        <div className={`rounded-lg border p-4 ${comparison.recommendation === 'spot' ? 'bg-blue-50 border-blue-200' : 'bg-emerald-50 border-emerald-200'}`}>
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center ${comparison.recommendation === 'spot' ? 'bg-blue-100' : 'bg-emerald-100'}`}>
              {comparison.recommendation === 'spot' ? <TrendingUp className="w-5 h-5 text-blue-600" /> : <CheckCircle className="w-5 h-5 text-emerald-600" />}
            </div>
            <div>
              <div className="font-medium text-gray-900">AI Recommendation: Use {comparison.recommendation === 'spot' ? 'Spot Market' : 'Contract Rate'}</div>
              <div className="text-sm text-gray-600">
                {comparison.recommendation === 'spot'
                  ? `Spot rates are lower for ${comparison.lane}. Market avg: ${formatRpm(comparison.market_average.rate_per_mile)}`
                  : `Contract rate is more favorable for ${comparison.lane}. Market avg: ${formatRpm(comparison.market_average.rate_per_mile)}`}
              </div>
            </div>
          </div>
        </div>
      )}

      {comparison && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="flex items-center gap-2 mb-4">
              <TrendingUp className="w-5 h-5 text-blue-600" />
              <h4 className="text-lg font-semibold text-gray-900">Spot Market Rates</h4>
            </div>
            {comparison.spot_rates.length > 0 ? (
              <div className="space-y-4">
                {comparison.spot_rates.map((sr, idx) => (
                  <div key={idx} className="border border-gray-100 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-indigo-100 text-indigo-800">{LOADBOARD_PROVIDER_LABELS[sr.provider as LoadBoardProvider] || sr.provider}</span>
                      <span className="text-xs text-gray-500">{new Date(sr.fetched_at).toLocaleDateString()}</span>
                    </div>
                    <div className="grid grid-cols-3 gap-3 text-center">
                      <div><div className="text-xs text-gray-500">Low</div><div className="text-lg font-medium text-red-600">{formatRpm(sr.rate_per_mile_low)}</div></div>
                      <div><div className="text-xs text-gray-500">Average</div><div className="text-xl font-bold text-blue-600">{formatRpm(sr.rate_per_mile_avg)}</div></div>
                      <div><div className="text-xs text-gray-500">High</div><div className="text-lg font-medium text-emerald-600">{formatRpm(sr.rate_per_mile_high)}</div></div>
                    </div>
                    <div className="mt-2 flex items-center justify-between text-xs text-gray-500">
                      <span>{sr.load_count || 0} loads</span>
                      <span>{sr.truck_count || 0} trucks</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-6 text-gray-500 text-sm">No spot rate data available</div>
            )}
          </div>

          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="flex items-center gap-2 mb-4">
              <DollarSign className="w-5 h-5 text-emerald-600" />
              <h4 className="text-lg font-semibold text-gray-900">Contract Rates</h4>
            </div>
            {comparison.contract_rates.length > 0 ? (
              <div className="space-y-4">
                {comparison.contract_rates.map((cr, idx) => (
                  <div key={idx} className="border border-gray-100 rounded-lg p-4">
                    <div className="font-medium text-gray-900 mb-2">{cr.rate_table_name}</div>
                    <div className="grid grid-cols-2 gap-4">
                      {cr.rate_per_mile && <div><div className="text-xs text-gray-500">Rate/Mile</div><div className="text-xl font-bold text-emerald-600">${cr.rate_per_mile.toFixed(2)}/mi</div></div>}
                      {cr.flat_rate && <div><div className="text-xs text-gray-500">Flat Rate</div><div className="text-xl font-bold text-emerald-600">{formatDollar(cr.flat_rate)}</div></div>}
                    </div>
                    <div className="mt-2 flex items-center justify-between text-xs text-gray-500">
                      {cr.effective_date && <span>Effective: {new Date(cr.effective_date).toLocaleDateString()}</span>}
                      {cr.expiration_date && <span>Expires: {new Date(cr.expiration_date).toLocaleDateString()}</span>}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-6 text-gray-500 text-sm">No contract rates on file for this lane</div>
            )}
            <div className="mt-4 pt-4 border-t border-gray-200">
              <div className="text-sm font-medium text-gray-700 mb-2">Market Average</div>
              <div className="grid grid-cols-2 gap-4">
                <div><div className="text-xs text-gray-500">Per Mile</div><div className="text-lg font-bold text-gray-900">{formatRpm(comparison.market_average.rate_per_mile)}</div></div>
                <div><div className="text-xs text-gray-500">Flat Rate</div><div className="text-lg font-bold text-gray-900">{comparison.market_average.flat_rate ? formatDollar(comparison.market_average.flat_rate) : '-'}</div></div>
              </div>
            </div>
          </div>
        </div>
      )}

      {trends && trends.data_points.length > 0 && (
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h4 className="text-lg font-semibold text-gray-900">Rate Trends (Last {trends.days} Days)</h4>
              <p className="text-sm text-gray-500">{trends.lane} - {trends.equipment_type}</p>
            </div>
            <span className="text-sm text-gray-500">{trends.total_points} data points</span>
          </div>
          <div className="overflow-x-auto">
            <div className="flex items-end gap-1 min-h-[200px] pb-6 relative">
              {(() => {
                const points = trends.data_points
                const maxRate = Math.max(...points.map((p) => p.rate_per_mile_avg || 0))
                const minRate = Math.min(...points.filter((p) => p.rate_per_mile_avg).map((p) => p.rate_per_mile_avg || 0))
                const range = maxRate - minRate * 0.8 || 1
                return points.map((point, idx) => {
                  const rate = point.rate_per_mile_avg || 0
                  const heightPct = maxRate > 0 ? ((rate - minRate * 0.8) / range) * 100 : 0
                  const isLast = idx === points.length - 1
                  const prevRate = idx > 0 ? points[idx - 1].rate_per_mile_avg || 0 : rate
                  const dir = rate > prevRate ? 'up' : rate < prevRate ? 'down' : 'flat'
                  return (
                    <div key={idx} className="flex-1 flex flex-col items-center group relative min-w-[40px]">
                      <div className="absolute bottom-full mb-2 hidden group-hover:block z-10 bg-gray-900 text-white px-3 py-2 rounded-lg text-xs whitespace-nowrap shadow-lg">
                        <div className="font-medium">{new Date(point.date).toLocaleDateString()}</div>
                        <div>Avg: ${rate.toFixed(2)}/mi</div>
                        {point.rate_per_mile_low && <div>Low: ${point.rate_per_mile_low.toFixed(2)}/mi</div>}
                        {point.rate_per_mile_high && <div>High: ${point.rate_per_mile_high.toFixed(2)}/mi</div>}
                        {point.load_count && <div>{point.load_count} loads</div>}
                        <div className="text-gray-400">{point.provider}</div>
                      </div>
                      <div className={`w-full rounded-t transition-all ${isLast ? 'bg-emerald-500' : dir === 'up' ? 'bg-red-400' : dir === 'down' ? 'bg-blue-400' : 'bg-gray-400'} hover:opacity-80`} style={{ height: `${Math.max(heightPct, 5)}%`, minHeight: '8px' }} />
                      {(idx % Math.max(1, Math.floor(points.length / 8)) === 0 || isLast) && (
                        <div className="text-[10px] text-gray-400 mt-1 transform -rotate-45 origin-top-left whitespace-nowrap">
                          {new Date(point.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        </div>
                      )}
                    </div>
                  )
                })
              })()}
            </div>
          </div>
          <div className="flex items-center gap-6 mt-4 pt-4 border-t border-gray-200 text-xs text-gray-500">
            <div className="flex items-center gap-1"><div className="w-3 h-3 bg-red-400 rounded" /><span>Rate increasing</span></div>
            <div className="flex items-center gap-1"><div className="w-3 h-3 bg-blue-400 rounded" /><span>Rate decreasing</span></div>
            <div className="flex items-center gap-1"><div className="w-3 h-3 bg-emerald-500 rounded" /><span>Current</span></div>
          </div>
        </div>
      )}

      {!comparison && !spotMutation.isPending && (
        <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
          <BarChart3 className="w-12 h-12 mx-auto text-gray-400" />
          <h3 className="mt-2 text-sm font-medium text-gray-900">Spot vs Contract Analysis</h3>
          <p className="mt-1 text-sm text-gray-500">Enter a lane to compare current spot rates with your contract rates and see AI recommendations.</p>
        </div>
      )}
    </div>
  )
}

// ==================== Settings Tab ====================

function SettingsTab() {
  const queryClient = useQueryClient()
  const [expandedProvider, setExpandedProvider] = useState<LoadBoardProvider | null>(null)
  const [formData, setFormData] = useState<Record<string, Record<string, string>>>({})

  const { data: credentials, isLoading } = useQuery({
    queryKey: ['loadboard-credentials'],
    queryFn: () => api.getLoadBoardCredentials(),
  })

  const saveMutation = useMutation({
    mutationFn: (data: Parameters<typeof api.saveLoadBoardCredentials>[0]) =>
      api.saveLoadBoardCredentials(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['loadboard-credentials'] })
      setExpandedProvider(null)
    },
  })

  const testMutation = useMutation({
    mutationFn: (provider: LoadBoardProvider) => api.testLoadBoardConnection(provider),
  })

  const providers: { id: LoadBoardProvider; name: string; description: string }[] = [
    {
      id: 'dat',
      name: 'DAT Power',
      description: 'Access DAT\'s load board, carrier search, and RateView for market intelligence.',
    },
    {
      id: 'truckstop',
      name: 'Truckstop.com',
      description: 'Post loads and search carriers on Truckstop\'s network.',
    },
  ]

  const getCredential = (provider: LoadBoardProvider) =>
    credentials?.find((c) => c.provider === provider)

  if (isLoading) {
    return <div className="text-center py-12 text-gray-500">Loading settings...</div>
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg border border-gray-200">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-medium text-gray-900">Load Board Connections</h3>
          <p className="text-sm text-gray-500">
            Connect your load board accounts to post loads and search for carriers.
          </p>
        </div>

        <div className="divide-y divide-gray-200">
          {providers.map((provider) => {
            const cred = getCredential(provider.id)
            const isExpanded = expandedProvider === provider.id
            const form = formData[provider.id] || {}

            return (
              <div key={provider.id} className="p-6">
                <div
                  className="flex items-center justify-between cursor-pointer"
                  onClick={() => setExpandedProvider(isExpanded ? null : provider.id)}
                >
                  <div className="flex items-center gap-4">
                    <div
                      className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                        cred?.is_active ? 'bg-emerald-100' : 'bg-gray-100'
                      }`}
                    >
                      {cred?.is_active ? (
                        <CheckCircle className="w-5 h-5 text-emerald-600" />
                      ) : (
                        <Radio className="w-5 h-5 text-gray-400" />
                      )}
                    </div>
                    <div>
                      <div className="font-medium text-gray-900">{provider.name}</div>
                      <div className="text-sm text-gray-500">{provider.description}</div>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    {cred?.is_active && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700">
                        <CheckCircle className="w-3 h-3" />
                        Connected
                      </span>
                    )}
                    {isExpanded ? (
                      <ChevronUp className="w-5 h-5 text-gray-400" />
                    ) : (
                      <ChevronDown className="w-5 h-5 text-gray-400" />
                    )}
                  </div>
                </div>

                {isExpanded && (
                  <div className="mt-6 pl-14 space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Username / Account ID
                        </label>
                        <input
                          type="text"
                          value={form.username || cred?.username || ''}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              [provider.id]: { ...form, username: e.target.value },
                            })
                          }
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-emerald-500 focus:border-emerald-500"
                          placeholder="your_username"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Password / API Key
                        </label>
                        <input
                          type="password"
                          value={form.password || ''}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              [provider.id]: { ...form, password: e.target.value },
                            })
                          }
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-emerald-500 focus:border-emerald-500"
                          placeholder="••••••••"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Company Name
                        </label>
                        <input
                          type="text"
                          value={form.company_name || cred?.company_name || ''}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              [provider.id]: { ...form, company_name: e.target.value },
                            })
                          }
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-emerald-500 focus:border-emerald-500"
                          placeholder="Your Company LLC"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          MC Number
                        </label>
                        <input
                          type="text"
                          value={form.mc_number || cred?.mc_number || ''}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              [provider.id]: { ...form, mc_number: e.target.value },
                            })
                          }
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-emerald-500 focus:border-emerald-500"
                          placeholder="MC-123456"
                        />
                      </div>
                    </div>

                    {cred?.connection_error && (
                      <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 px-3 py-2 rounded">
                        <XCircle className="w-4 h-4" />
                        {cred.connection_error}
                      </div>
                    )}

                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => {
                          saveMutation.mutate({
                            provider: provider.id,
                            username: form.username || cred?.username || '',
                            password: form.password,
                            company_name: form.company_name || cred?.company_name,
                            mc_number: form.mc_number || cred?.mc_number,
                          })
                        }}
                        disabled={saveMutation.isPending}
                        className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-md hover:bg-emerald-700 disabled:opacity-50"
                      >
                        {saveMutation.isPending ? (
                          <RefreshCw className="w-4 h-4 animate-spin" />
                        ) : (
                          <CheckCircle className="w-4 h-4" />
                        )}
                        Save Credentials
                      </button>

                      {cred && (
                        <button
                          onClick={() => testMutation.mutate(provider.id)}
                          disabled={testMutation.isPending}
                          className="inline-flex items-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 disabled:opacity-50"
                        >
                          {testMutation.isPending ? (
                            <RefreshCw className="w-4 h-4 animate-spin" />
                          ) : (
                            <ExternalLink className="w-4 h-4" />
                          )}
                          Test Connection
                        </button>
                      )}

                      {testMutation.isSuccess && testMutation.data?.success && (
                        <span className="text-sm text-emerald-600 flex items-center gap-1">
                          <CheckCircle className="w-4 h-4" />
                          Connection successful
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
