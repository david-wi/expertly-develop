import { useParams, Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, Clock, CheckCircle, AlertCircle, Loader, XCircle, FolderKanban } from 'lucide-react'
import { Card, CardContent, CardHeader } from '../components/common/Card'
import { Badge, getStatusBadgeVariant } from '../components/common/Badge'
import { jobsApi, projectsApi, artifactsApi } from '../api/client'
import { formatDistanceToNow, formatDuration, intervalToDuration, format } from 'date-fns'

export default function JobDetailPage() {
  const { id } = useParams<{ id: string }>()

  const { data: job, isLoading } = useQuery({
    queryKey: ['job', id],
    queryFn: () => jobsApi.get(id!),
    enabled: !!id,
    refetchInterval: (query) => {
      const status = query.state.data?.status
      return status === 'running' || status === 'pending' ? 2000 : false
    },
  })

  const { data: project } = useQuery({
    queryKey: ['project', job?.project_id],
    queryFn: () => projectsApi.get(job!.project_id!),
    enabled: !!job?.project_id,
  })

  const { data: artifacts } = useQuery({
    queryKey: ['artifacts', { job_id: id }],
    queryFn: () => artifactsApi.list({ job_id: id }),
    enabled: !!id,
  })

  const formatElapsed = (ms: number | null) => {
    if (!ms) return '-'
    const duration = intervalToDuration({ start: 0, end: ms })
    return formatDuration(duration, { format: ['minutes', 'seconds'] }) || '< 1s'
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending':
        return <Clock className="w-5 h-5 text-yellow-500" />
      case 'running':
        return <Loader className="w-5 h-5 text-blue-500 animate-spin" />
      case 'completed':
        return <CheckCircle className="w-5 h-5 text-green-500" />
      case 'failed':
        return <AlertCircle className="w-5 h-5 text-red-500" />
      case 'cancelled':
        return <XCircle className="w-5 h-5 text-gray-500" />
      default:
        return null
    }
  }

  if (isLoading) {
    return <div className="text-center py-12 text-gray-500">Loading job...</div>
  }

  if (!job) {
    return <div className="text-center py-12 text-gray-500">Job not found</div>
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link to="/jobs" className="p-2 hover:bg-gray-100 rounded-lg">
          <ArrowLeft className="w-5 h-5 text-gray-600" />
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            {getStatusIcon(job.status)}
            <h1 className="text-2xl font-bold text-gray-900 capitalize">
              {job.job_type.replace('_', ' ')}
            </h1>
            <Badge variant={getStatusBadgeVariant(job.status)}>{job.status}</Badge>
          </div>
          <p className="text-gray-600 mt-1">
            Created {formatDistanceToNow(new Date(job.created_at), { addSuffix: true })}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Info */}
        <div className="lg:col-span-2 space-y-6">
          {/* Progress */}
          {(job.status === 'running' || job.status === 'pending') && (
            <Card>
              <CardHeader>
                <h2 className="text-lg font-semibold text-gray-900">Progress</h2>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="w-full bg-gray-200 rounded-full h-3">
                  <div
                    className="bg-primary-600 h-3 rounded-full transition-all"
                    style={{ width: `${job.progress}%` }}
                  />
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">{job.current_step || 'Waiting...'}</span>
                  <span className="font-medium">{job.progress}%</span>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Job Details */}
          <Card>
            <CardHeader>
              <h2 className="text-lg font-semibold text-gray-900">Job Details</h2>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-500">Type</p>
                  <p className="font-medium capitalize">{job.job_type.replace('_', ' ')}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Status</p>
                  <p className="font-medium capitalize">{job.status}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Duration</p>
                  <p className="font-medium">{formatElapsed(job.elapsed_ms)}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Job ID</p>
                  <p className="font-mono text-sm text-gray-600">{job.id}</p>
                </div>
              </div>

              <div className="pt-4 border-t space-y-2">
                <div>
                  <p className="text-sm text-gray-500">Created</p>
                  <p className="font-medium">
                    {format(new Date(job.created_at), 'PPpp')}
                  </p>
                </div>
                {job.started_at && (
                  <div>
                    <p className="text-sm text-gray-500">Started</p>
                    <p className="font-medium">
                      {format(new Date(job.started_at), 'PPpp')}
                    </p>
                  </div>
                )}
                {job.completed_at && (
                  <div>
                    <p className="text-sm text-gray-500">Completed</p>
                    <p className="font-medium">
                      {format(new Date(job.completed_at), 'PPpp')}
                    </p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Error */}
          {job.error && (
            <Card className="border-red-200 bg-red-50">
              <CardHeader>
                <h2 className="text-lg font-semibold text-red-800">Error</h2>
              </CardHeader>
              <CardContent>
                <pre className="text-sm text-red-700 whitespace-pre-wrap font-mono bg-red-100 p-4 rounded-lg overflow-x-auto">
                  {job.error}
                </pre>
              </CardContent>
            </Card>
          )}

          {/* Result */}
          {job.result && Object.keys(job.result).length > 0 && (
            <Card>
              <CardHeader>
                <h2 className="text-lg font-semibold text-gray-900">Result</h2>
              </CardHeader>
              <CardContent>
                <pre className="text-sm text-gray-700 whitespace-pre-wrap font-mono bg-gray-50 p-4 rounded-lg overflow-x-auto">
                  {JSON.stringify(job.result, null, 2)}
                </pre>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Project Link */}
          {project && (
            <Card>
              <CardHeader>
                <h2 className="text-lg font-semibold text-gray-900">Project</h2>
              </CardHeader>
              <CardContent>
                <Link
                  to={`/projects/${project.id}`}
                  className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <div className="w-10 h-10 bg-primary-100 rounded-lg flex items-center justify-center">
                    <FolderKanban className="w-5 h-5 text-primary-600" />
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">{project.name}</p>
                    {project.description && (
                      <p className="text-sm text-gray-500 truncate max-w-[180px]">
                        {project.description}
                      </p>
                    )}
                  </div>
                </Link>
              </CardContent>
            </Card>
          )}

          {/* Artifacts */}
          {artifacts && artifacts.items.length > 0 && (
            <Card>
              <CardHeader>
                <h2 className="text-lg font-semibold text-gray-900">Artifacts</h2>
              </CardHeader>
              <CardContent>
                <ul className="space-y-3">
                  {artifacts.items.map((artifact) => (
                    <li key={artifact.id}>
                      <a
                        href={artifactsApi.download(artifact.id)}
                        className="flex items-center justify-between p-2 rounded-lg hover:bg-gray-50"
                      >
                        <span className="text-sm text-primary-600 truncate">
                          {artifact.label}
                        </span>
                        <Badge>{artifact.format.toUpperCase()}</Badge>
                      </a>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
