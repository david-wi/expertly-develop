import { useState } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, ExternalLink, Play, FileBox, Trash2, Lock, Users, Globe } from 'lucide-react'
import { Card, CardContent, CardHeader } from '../components/common/Card'
import { Button } from '../components/common/Button'
import { Badge, getStatusBadgeVariant } from '../components/common/Badge'
import { projectsApi, artifactsApi, jobsApi, personasApi } from '../api/client'
import { formatDistanceToNow } from 'date-fns'

const visibilityConfig = {
  private: { icon: Lock, tooltip: 'Private - Only you can see this project' },
  team: { icon: Users, tooltip: 'Team - Visible to your team members' },
  companywide: { icon: Globe, tooltip: 'Company-wide - Visible to everyone in the organization' },
}

export default function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  const { data: project, isLoading } = useQuery({
    queryKey: ['project', id],
    queryFn: () => projectsApi.get(id!),
    enabled: !!id,
  })

  const deleteMutation = useMutation({
    mutationFn: () => projectsApi.delete(id!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] })
      navigate('/projects')
    },
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
    return <div className="text-center py-12 text-theme-text-muted">Loading project...</div>
  }

  if (!project) {
    return <div className="text-center py-12 text-theme-text-muted">Project not found</div>
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link to="/projects" className="p-2 hover:bg-theme-bg-elevated rounded-lg">
          <ArrowLeft className="w-5 h-5 text-theme-text-secondary" />
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-theme-text-primary">{project.name}</h1>
            {(() => {
              const config = visibilityConfig[project.visibility as keyof typeof visibilityConfig] || visibilityConfig.private
              const VisibilityIcon = config.icon
              return (
                <span title={config.tooltip}>
                  <VisibilityIcon className="w-5 h-5 text-theme-text-muted" />
                </span>
              )
            })()}
          </div>
          {project.description && (
            <p className="text-theme-text-secondary mt-1">{project.description}</p>
          )}
        </div>
        <div className="flex items-center gap-2">
          {project.can_edit && (
            <Button variant="secondary" onClick={() => setShowDeleteConfirm(true)}>
              <Trash2 className="w-4 h-4 mr-2" />
              Delete
            </Button>
          )}
          <Link to={`/walkthroughs/new?project=${id}`}>
            <Button>
              <Play className="w-4 h-4 mr-2" />
              Run Walkthrough
            </Button>
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Info */}
        <div className="lg:col-span-2 space-y-6">
          {/* Project Details */}
          <Card>
            <CardHeader>
              <h2 className="text-lg font-semibold text-theme-text-primary">Project Details</h2>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-theme-text-muted">Visibility</p>
                  <p className="font-medium capitalize">{project.visibility}</p>
                </div>
                <div>
                  <p className="text-sm text-theme-text-muted">Credentials</p>
                  <p className="font-medium">{project.has_credentials ? 'Configured' : 'Not set'}</p>
                </div>
              </div>

              {project.site_url && (
                <div>
                  <p className="text-sm text-theme-text-muted">Site URL</p>
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
                <p className="text-sm text-theme-text-muted">
                  Created {formatDistanceToNow(new Date(project.created_at), { addSuffix: true })}
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Recent Jobs */}
          <Card>
            <CardHeader>
              <h2 className="text-lg font-semibold text-theme-text-primary">Recent Jobs</h2>
            </CardHeader>
            <CardContent className="p-0">
              {!jobs?.items?.length ? (
                <p className="text-theme-text-muted text-sm p-6">No jobs yet</p>
              ) : (
                <ul className="divide-y divide-theme-border">
                  {jobs.items.slice(0, 5).map((job) => (
                    <li key={job.id}>
                      <Link to={`/jobs/${job.id}`} className="block px-6 py-4 hover:bg-theme-bg-elevated">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm font-medium text-theme-text-primary">
                              {job.job_type.replace('_', ' ')}
                            </p>
                            <p className="text-xs text-theme-text-muted">
                              {formatDistanceToNow(new Date(job.created_at), { addSuffix: true })}
                              {job.requested_by_name && ` · ${job.requested_by_name}`}
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
              <h2 className="text-lg font-semibold text-theme-text-primary">Personas</h2>
            </CardHeader>
            <CardContent>
              {!personas?.items?.length ? (
                <p className="text-theme-text-muted text-sm">No personas configured</p>
              ) : (
                <ul className="space-y-3">
                  {personas.items.map((persona) => (
                    <li key={persona.id} className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium">{persona.name}</p>
                        {persona.role_description && (
                          <p className="text-xs text-theme-text-muted truncate max-w-[180px]">
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
              <h2 className="text-lg font-semibold text-theme-text-primary">Artifacts</h2>
            </CardHeader>
            <CardContent>
              {!artifacts?.items?.length ? (
                <p className="text-theme-text-muted text-sm">No artifacts yet</p>
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

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowDeleteConfirm(false)} />
          <div className="relative bg-theme-bg-surface rounded-xl shadow-xl w-full max-w-md mx-4 p-6">
            <h2 className="text-xl font-semibold text-theme-text-primary mb-2">Delete Project</h2>
            <p className="text-theme-text-secondary mb-6">
              Are you sure you want to delete <strong>{project.name}</strong>? This action cannot be undone.
            </p>
            <div className="flex gap-3">
              <Button
                variant="secondary"
                onClick={() => setShowDeleteConfirm(false)}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                variant="danger"
                onClick={() => deleteMutation.mutate()}
                disabled={deleteMutation.isPending}
                className="flex-1"
              >
                {deleteMutation.isPending ? 'Deleting...' : 'Delete Project'}
              </Button>
            </div>
            {deleteMutation.isError && (
              <p className="text-red-600 text-sm mt-4">
                Failed to delete project. You may not have permission.
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
