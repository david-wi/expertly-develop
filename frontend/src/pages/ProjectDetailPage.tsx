import { useParams, Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, ExternalLink, Play, FileBox } from 'lucide-react'
import { Card, CardContent, CardHeader } from '../components/common/Card'
import { Button } from '../components/common/Button'
import { Badge, getStatusBadgeVariant } from '../components/common/Badge'
import { projectsApi, artifactsApi, jobsApi, personasApi } from '../api/client'
import { formatDistanceToNow } from 'date-fns'

export default function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>()

  const { data: project, isLoading } = useQuery({
    queryKey: ['project', id],
    queryFn: () => projectsApi.get(id!),
    enabled: !!id,
  })

  const { data: artifacts } = useQuery({
    queryKey: ['artifacts', { project_id: id }],
    queryFn: () => artifactsApi.list({ project_id: id }),
    enabled: !!id,
  })

  const { data: jobs } = useQuery({
    queryKey: ['jobs', { project_id: id }],
    queryFn: () => jobsApi.list({ project_id: id }),
    enabled: !!id,
  })

  const { data: personas } = useQuery({
    queryKey: ['personas', { project_id: id }],
    queryFn: () => personasApi.list(id),
    enabled: !!id,
  })

  if (isLoading) {
    return <div className="text-center py-12 text-gray-500">Loading project...</div>
  }

  if (!project) {
    return <div className="text-center py-12 text-gray-500">Project not found</div>
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link to="/projects" className="p-2 hover:bg-gray-100 rounded-lg">
          <ArrowLeft className="w-5 h-5 text-gray-600" />
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-900">{project.name}</h1>
          {project.description && (
            <p className="text-gray-600 mt-1">{project.description}</p>
          )}
        </div>
        <Link to={`/walkthroughs/new?project=${id}`}>
          <Button>
            <Play className="w-4 h-4 mr-2" />
            Run Walkthrough
          </Button>
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Info */}
        <div className="lg:col-span-2 space-y-6">
          {/* Project Details */}
          <Card>
            <CardHeader>
              <h2 className="text-lg font-semibold text-gray-900">Project Details</h2>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-500">Visibility</p>
                  <p className="font-medium capitalize">{project.visibility}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Credentials</p>
                  <p className="font-medium">{project.has_credentials ? 'Configured' : 'Not set'}</p>
                </div>
              </div>

              {project.site_url && (
                <div>
                  <p className="text-sm text-gray-500">Site URL</p>
                  <a
                    href={project.site_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-medium text-primary-600 hover:text-primary-700 flex items-center gap-1"
                  >
                    {project.site_url}
                    <ExternalLink className="w-4 h-4" />
                  </a>
                </div>
              )}

              <div className="pt-4 border-t">
                <p className="text-sm text-gray-500">
                  Created {formatDistanceToNow(new Date(project.created_at), { addSuffix: true })}
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Recent Jobs */}
          <Card>
            <CardHeader>
              <h2 className="text-lg font-semibold text-gray-900">Recent Jobs</h2>
            </CardHeader>
            <CardContent className="p-0">
              {!jobs?.items?.length ? (
                <p className="text-gray-500 text-sm p-6">No jobs yet</p>
              ) : (
                <ul className="divide-y divide-gray-200">
                  {jobs.items.slice(0, 5).map((job) => (
                    <li key={job.id}>
                      <Link to={`/jobs/${job.id}`} className="block px-6 py-4 hover:bg-gray-50">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm font-medium text-gray-900">
                              {job.job_type.replace('_', ' ')}
                            </p>
                            <p className="text-xs text-gray-500">
                              {formatDistanceToNow(new Date(job.created_at), { addSuffix: true })}
                            </p>
                          </div>
                          <Badge variant={getStatusBadgeVariant(job.status)}>
                            {job.status}
                          </Badge>
                        </div>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Personas */}
          <Card>
            <CardHeader>
              <h2 className="text-lg font-semibold text-gray-900">Personas</h2>
            </CardHeader>
            <CardContent>
              {!personas?.items?.length ? (
                <p className="text-gray-500 text-sm">No personas configured</p>
              ) : (
                <ul className="space-y-3">
                  {personas.items.map((persona) => (
                    <li key={persona.id} className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium">{persona.name}</p>
                        {persona.role_description && (
                          <p className="text-xs text-gray-500 truncate max-w-[180px]">
                            {persona.role_description}
                          </p>
                        )}
                      </div>
                      {persona.has_credentials && (
                        <Badge variant="success">Auth</Badge>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          {/* Artifacts */}
          <Card>
            <CardHeader>
              <h2 className="text-lg font-semibold text-gray-900">Artifacts</h2>
            </CardHeader>
            <CardContent>
              {!artifacts?.items?.length ? (
                <p className="text-gray-500 text-sm">No artifacts yet</p>
              ) : (
                <ul className="space-y-3">
                  {artifacts.items.slice(0, 5).map((artifact) => (
                    <li key={artifact.id}>
                      <a
                        href={artifactsApi.download(artifact.id)}
                        className="flex items-center gap-2 text-sm text-primary-600 hover:text-primary-700"
                      >
                        <FileBox className="w-4 h-4" />
                        <span className="truncate">{artifact.label}</span>
                      </a>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
