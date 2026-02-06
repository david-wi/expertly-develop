import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { ListTodo, Play, RotateCcw, Trash2, CheckCircle, XCircle, Clock, Loader2, Search } from 'lucide-react'
import { queueApi, companiesApi } from '../services/api'
import { EmptyState } from '../components/EmptyState'
import type { QueueItem, QueueItemStatus } from '../types'

const tabs: { label: string; status: QueueItemStatus | 'all' }[] = [
  { label: 'All', status: 'all' },
  { label: 'Queued', status: 'queued' },
  { label: 'In Progress', status: 'in_progress' },
  { label: 'Completed', status: 'completed' },
  { label: 'Failed', status: 'failed' },
]

const statusIcons: Record<QueueItemStatus, React.ReactNode> = {
  queued: <Clock className="w-4 h-4 text-gray-400" />,
  in_progress: <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />,
  completed: <CheckCircle className="w-4 h-4 text-green-500" />,
  failed: <XCircle className="w-4 h-4 text-red-500" />,
}

export function Queue() {
  const queryClient = useQueryClient()
  const [activeTab, setActiveTab] = useState<QueueItemStatus | 'all'>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [processing, setProcessing] = useState(false)

  const { data: items, isLoading } = useQuery({
    queryKey: ['queue', activeTab === 'all' ? undefined : activeTab],
    queryFn: () => queueApi.list(activeTab === 'all' ? undefined : activeTab),
  })

  const { data: queueStatus } = useQuery({
    queryKey: ['queue', 'status'],
    queryFn: queueApi.status,
    refetchInterval: processing ? 5000 : false,
  })

  const { data: companies } = useQuery({
    queryKey: ['companies', 'search', searchQuery],
    queryFn: () => companiesApi.list({ search: searchQuery }),
    enabled: searchQuery.length >= 2,
  })

  const retryMutation = useMutation({
    mutationFn: (id: string) => queueApi.retry(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['queue'] }),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => queueApi.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['queue'] }),
  })

  const clearMutation = useMutation({
    mutationFn: () => queueApi.clearCompleted(),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['queue'] }),
  })

  const processQueue = async () => {
    setProcessing(true)
    try {
      await queueApi.process()
      queryClient.invalidateQueries({ queryKey: ['queue'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
    } catch (e) {
      alert('Processing failed. Check API key in Settings.')
    } finally {
      setProcessing(false)
    }
  }

  const addCompanyToQueue = async (company: { id: string; name: string; ticker: string }) => {
    await queueApi.add({ company_id: company.id, company_name: company.name, company_ticker: company.ticker })
    queryClient.invalidateQueries({ queryKey: ['queue'] })
    setSearchQuery('')
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Research Queue</h1>
          <p className="text-gray-500 mt-1">Manage batch research report generation</p>
        </div>
        <div className="flex items-center gap-3">
          {queueStatus && queueStatus.completed > 0 && (
            <button
              onClick={() => clearMutation.mutate()}
              className="text-sm text-gray-500 hover:text-gray-700"
            >
              Clear Completed
            </button>
          )}
          <button
            onClick={processQueue}
            disabled={processing || !queueStatus?.queued}
            className="flex items-center gap-2 px-4 py-2 bg-violet-600 text-white rounded-lg hover:bg-violet-700 text-sm font-medium disabled:opacity-50"
          >
            {processing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
            {processing ? 'Processing...' : `Process Queue${queueStatus?.queued ? ` (${queueStatus.queued})` : ''}`}
          </button>
        </div>
      </div>

      {/* Queue status bar */}
      {queueStatus && queueStatus.total > 0 && (
        <div className="grid grid-cols-4 gap-3 mb-6">
          <div className="bg-gray-50 rounded-lg p-3 text-center">
            <div className="text-xl font-bold text-gray-700">{queueStatus.queued}</div>
            <div className="text-xs text-gray-500">Queued</div>
          </div>
          <div className="bg-blue-50 rounded-lg p-3 text-center">
            <div className="text-xl font-bold text-blue-700">{queueStatus.in_progress}</div>
            <div className="text-xs text-blue-500">In Progress</div>
          </div>
          <div className="bg-green-50 rounded-lg p-3 text-center">
            <div className="text-xl font-bold text-green-700">{queueStatus.completed}</div>
            <div className="text-xs text-green-500">Completed</div>
          </div>
          <div className="bg-red-50 rounded-lg p-3 text-center">
            <div className="text-xl font-bold text-red-700">{queueStatus.failed}</div>
            <div className="text-xs text-red-500">Failed</div>
          </div>
        </div>
      )}

      {/* Add companies to queue */}
      <div className="bg-white rounded-lg border border-gray-200 p-4 mb-6">
        <h3 className="text-sm font-semibold text-gray-900 mb-3">Add Company to Queue</h3>
        <div className="relative">
          <Search className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search companies by name or ticker..."
            className="w-full border border-gray-300 rounded-lg pl-9 pr-3 py-2 text-sm"
          />
          {companies && companies.length > 0 && searchQuery.length >= 2 && (
            <div className="absolute top-full left-0 right-0 bg-white border border-gray-200 rounded-lg shadow-lg mt-1 z-10 max-h-48 overflow-y-auto">
              {companies.map(c => (
                <button
                  key={c.id}
                  onClick={() => addCompanyToQueue(c)}
                  className="w-full text-left px-4 py-2 text-sm hover:bg-gray-50 flex items-center justify-between"
                >
                  <span>{c.name} <span className="text-gray-400 font-mono">({c.ticker})</span></span>
                  <span className="text-xs text-violet-600">+ Add</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-4 bg-gray-100 rounded-lg p-1 w-fit">
        {tabs.map(tab => (
          <button
            key={tab.status}
            onClick={() => setActiveTab(tab.status)}
            className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
              activeTab === tab.status ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-800'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Queue Items */}
      {isLoading ? (
        <div className="text-center py-12 text-gray-500">Loading...</div>
      ) : !items || items.length === 0 ? (
        <EmptyState
          icon={ListTodo}
          title="Queue is empty"
          description="Search for companies above and add them to the queue for batch research generation."
        />
      ) : (
        <div className="bg-white rounded-lg border border-gray-200">
          {items.map((item, i) => (
            <div key={item.id} className={`px-6 py-4 flex items-center justify-between ${i > 0 ? 'border-t border-gray-100' : ''}`}>
              <div className="flex items-center gap-3">
                {statusIcons[item.status]}
                <div>
                  <div className="text-sm font-medium text-gray-900">
                    {item.company_name} <span className="text-gray-400 font-mono">({item.company_ticker})</span>
                  </div>
                  <div className="text-xs text-gray-400">
                    Added {new Date(item.created_at).toLocaleString()}
                    {item.retry_count > 0 && ` | Retries: ${item.retry_count}`}
                  </div>
                  {item.error_message && (
                    <div className="text-xs text-red-500 mt-1">{item.error_message}</div>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                {item.status === 'completed' && item.report_id && (
                  <Link to={`/reports/${item.report_id}`} className="text-xs text-violet-600 hover:text-violet-800">
                    View Report
                  </Link>
                )}
                {item.status === 'failed' && (
                  <button onClick={() => retryMutation.mutate(item.id)} className="p-1.5 text-gray-400 hover:text-blue-600" title="Retry">
                    <RotateCcw className="w-4 h-4" />
                  </button>
                )}
                <button onClick={() => deleteMutation.mutate(item.id)} className="p-1.5 text-gray-400 hover:text-red-600" title="Remove">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
