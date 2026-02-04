import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
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
} from 'lucide-react'
import { api } from '../services/api'
import {
  LoadBoardPosting,
  CarrierSearch,
  CarrierSearchResult,
  RateIndex,
  LoadBoardProvider,
  PostingStatus,
  LOADBOARD_PROVIDER_LABELS,
  POSTING_STATUS_LABELS,
} from '../types'

type TabType = 'postings' | 'search' | 'rates' | 'settings'

export default function LoadBoards() {
  const [activeTab, setActiveTab] = useState<TabType>('postings')

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Load Board Integration</h1>
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
