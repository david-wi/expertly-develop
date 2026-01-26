import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { FolderKanban, ListTodo, FileBox, Play, ArrowRight } from 'lucide-react'
import { Card, CardContent, CardHeader } from '../components/common/Card'
import { Badge, getStatusBadgeVariant } from '../components/common/Badge'
import { projectsApi, jobsApi, artifactsApi } from '../api/client'
import { formatDistanceToNow } from 'date-fns'

export default function Dashboard() {
  const { data: projects } = useQuery({
    queryKey: ['projects'],
    queryFn: projectsApi.list,
  })

  const { data: jobs } = useQuery({
    queryKey: ['jobs'],
    queryFn: () => jobsApi.list(),
    refetchInterval: 5000,
  })

  const { data: artifacts } = useQuery({
    queryKey: ['artifacts'],
    queryFn: () => artifactsApi.list(),
  })

  const stats = [
    {
      name: 'Projects',
      value: projects?.total || 0,
      icon: FolderKanban,
      href: '/projects',
      color: 'bg-blue-500',
    },
    {
      name: 'Active Jobs',
      value: (jobs?.stats?.running || 0) + (jobs?.stats?.pending || 0),
      icon: ListTodo,
      href: '/jobs',
      color: 'bg-yellow-500',
    },
    {
      name: 'Artifacts',
      value: artifacts?.total || 0,
      icon: FileBox,
      href: '/artifacts',
      color: 'bg-green-500',
    },
  ]

  const recentJobs = jobs?.items?.slice(0, 5) || []
  const recentArtifacts = artifacts?.items?.slice(0, 5) || []

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-600 mt-1">Welcome back, David</p>
        </div>
        <Link
          to="/walkthroughs/new"
          className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
        >
          <Play className="w-4 h-4" />
          New Walkthrough
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {stats.map((stat) => (
          <Link key={stat.name} to={stat.href}>
            <Card className="hover:shadow-md transition-shadow">
              <CardContent className="flex items-center gap-4">
                <div className={`w-12 h-12 ${stat.color} rounded-lg flex items-center justify-center`}>
                  <stat.icon className="w-6 h-6 text-white" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
                  <p className="text-sm text-gray-600">{stat.name}</p>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Jobs */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">Recent Jobs</h2>
              <Link
                to="/jobs"
                className="text-sm text-primary-600 hover:text-primary-700 flex items-center gap-1"
              >
                View all <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {recentJobs.length === 0 ? (
              <p className="text-gray-500 text-sm p-6">No jobs yet</p>
            ) : (
              <ul className="divide-y divide-gray-200">
                {recentJobs.map((job) => (
                  <li key={job.id}>
                    <Link to={`/jobs/${job.id}`} className="block px-6 py-4 hover:bg-gray-50">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-gray-900">
                            {job.job_type.replace('_', ' ')}
                          </p>
                          <p className="text-xs text-gray-500">
                            {job.project_name && <span className="text-primary-600">{job.project_name}</span>}
                            {job.project_name && ' · '}
                            {formatDistanceToNow(new Date(job.created_at), { addSuffix: true })}
                            {job.requested_by_name && ` · ${job.requested_by_name}`}
                          </p>
                        </div>
                        <div className="flex items-center gap-3">
                          {job.status === 'running' && (
                            <div className="w-16 bg-gray-200 rounded-full h-2">
                              <div
                                className="bg-primary-600 h-2 rounded-full transition-all"
                                style={{ width: `${job.progress}%` }}
                              />
                            </div>
                          )}
                          <Badge variant={getStatusBadgeVariant(job.status)}>
                            {job.status}
                          </Badge>
                        </div>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* Recent Artifacts */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">Recent Artifacts</h2>
              <Link
                to="/artifacts"
                className="text-sm text-primary-600 hover:text-primary-700 flex items-center gap-1"
              >
                View all <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {recentArtifacts.length === 0 ? (
              <p className="text-gray-500 text-sm p-6">No artifacts yet</p>
            ) : (
              <ul className="divide-y divide-gray-200">
                {recentArtifacts.map((artifact) => (
                  <li key={artifact.id}>
                    <a
                      href={artifactsApi.download(artifact.id)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block px-6 py-4 hover:bg-gray-50 cursor-pointer"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-gray-900">{artifact.label}</p>
                          <p className="text-xs text-gray-500">
                            {artifact.project_name && <span className="text-primary-600">{artifact.project_name}</span>}
                            {artifact.project_name && ' · '}
                            {formatDistanceToNow(new Date(artifact.created_at), { addSuffix: true })}
                            {artifact.created_by_name && ` · ${artifact.created_by_name}`}
                          </p>
                        </div>
                        <Badge>{artifact.format.toUpperCase()}</Badge>
                      </div>
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
