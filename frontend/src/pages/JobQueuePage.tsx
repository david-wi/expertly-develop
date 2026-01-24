import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { RefreshCw, XCircle, Clock, CheckCircle, AlertCircle, Loader } from 'lucide-react'
import { Card, CardContent, CardHeader } from '../components/common/Card'
import { Button } from '../components/common/Button'
import { Badge, getStatusBadgeVariant } from '../components/common/Badge'
import { jobsApi, type Job } from '../api/client'
import { formatDistanceToNow, formatDuration, intervalToDuration } from 'date-fns'

export default function JobQueuePage() {
  const [statusFilter, setStatusFilter] = useState<string>('')
  const queryClient = useQueryClient()

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['jobs', { status: statusFilter }],
    queryFn: () => jobsApi.list(statusFilter ? { status: statusFilter } : {}),
    refetchInterval: 3000,
  })

  const cancelMutation = useMutation({
    mutationFn: jobsApi.cancel,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['jobs'] })
    },
  })

  const stats = data?.stats || {}
  const jobs = data?.items || []

  const statCards = [
    { label: 'Pending', value: stats.pending || 0, icon: Clock, color: 'text-yellow-500' },
    { label: 'Running', value: stats.running || 0, icon: Loader, color: 'text-blue-500' },
    { label: 'Completed', value: stats.completed || 0, icon: CheckCircle, color: 'text-green-500' },
    { label: 'Failed', value: stats.failed || 0, icon: AlertCircle, color: 'text-red-500' },
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Job Queue</h1>
          <p className="text-gray-600 mt-1">Monitor and manage running jobs</p>
        </div>
        <Button variant="secondary" onClick={() => refetch()}>
          <RefreshCw className="w-4 h-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {statCards.map((stat) => (
          <Card
            key={stat.label}
            className={`cursor-pointer transition-shadow hover:shadow-md ${
              statusFilter === stat.label.toLowerCase() ? 'ring-2 ring-primary-500' : ''
            }`}
            onClick={() => setStatusFilter(
              statusFilter === stat.label.toLowerCase() ? '' : stat.label.toLowerCase()
            )}
          >
            <CardContent className="flex items-center gap-3">
              <stat.icon className={`w-8 h-8 ${stat.color}`} />
              <div>
                <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
                <p className="text-sm text-gray-600">{stat.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Jobs List */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">
              {statusFilter ? `${statusFilter.charAt(0).toUpperCase() + statusFilter.slice(1)} Jobs` : 'All Jobs'}
            </h2>
            {statusFilter && (
              <Button variant="ghost" size="sm" onClick={() => setStatusFilter('')}>
                Clear filter
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="text-center py-12 text-gray-500">Loading jobs...</div>
          ) : jobs.length === 0 ? (
            <div className="text-center py-12 text-gray-500">No jobs found</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Progress</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Duration</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Created</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {jobs.map((job) => (
                    <JobRow
                      key={job.id}
                      job={job}
                      onCancel={() => cancelMutation.mutate(job.id)}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function JobRow({ job, onCancel }: { job: Job; onCancel: () => void }) {
  const formatElapsed = (ms: number | null) => {
    if (!ms) return '-'
    const duration = intervalToDuration({ start: 0, end: ms })
    return formatDuration(duration, { format: ['minutes', 'seconds'] }) || '< 1s'
  }

  const canCancel = job.status === 'pending' || job.status === 'running'

  return (
    <tr className="hover:bg-gray-50">
      <td className="px-6 py-4">
        <div>
          <p className="text-sm font-medium text-gray-900 capitalize">
            {job.job_type.replace('_', ' ')}
          </p>
          {job.current_step && (
            <p className="text-xs text-gray-500 truncate max-w-[200px]">{job.current_step}</p>
          )}
        </div>
      </td>
      <td className="px-6 py-4">
        <Badge variant={getStatusBadgeVariant(job.status)}>{job.status}</Badge>
      </td>
      <td className="px-6 py-4">
        {job.status === 'running' ? (
          <div className="flex items-center gap-2">
            <div className="w-24 bg-gray-200 rounded-full h-2">
              <div
                className="bg-primary-600 h-2 rounded-full transition-all"
                style={{ width: `${job.progress}%` }}
              />
            </div>
            <span className="text-xs text-gray-600">{job.progress}%</span>
          </div>
        ) : job.status === 'completed' ? (
          <span className="text-sm text-green-600">100%</span>
        ) : (
          <span className="text-sm text-gray-400">-</span>
        )}
      </td>
      <td className="px-6 py-4 text-sm text-gray-600">
        {formatElapsed(job.elapsed_ms)}
      </td>
      <td className="px-6 py-4 text-sm text-gray-500">
        {formatDistanceToNow(new Date(job.created_at), { addSuffix: true })}
      </td>
      <td className="px-6 py-4">
        {canCancel && (
          <Button variant="ghost" size="sm" onClick={onCancel}>
            <XCircle className="w-4 h-4 text-red-500" />
          </Button>
        )}
        {job.error && (
          <span className="text-xs text-red-600 truncate max-w-[150px] block" title={job.error}>
            {job.error}
          </span>
        )}
      </td>
    </tr>
  )
}
