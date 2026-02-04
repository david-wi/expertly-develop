import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { Plus, ExternalLink, Lock, Users, Globe } from 'lucide-react'
import { Card, CardContent } from '../components/common/Card'
import { Button } from '../components/common/Button'
import { Badge } from '../components/common/Badge'
import { Input, Textarea, Select } from '../components/common/Input'
import { InlineVoiceTranscription } from '@expertly/ui'
import { projectsApi, type ProjectCreate } from '../api/client'
import { formatDistanceToNow } from 'date-fns'

export default function ProjectsPage() {
  const [showCreateModal, setShowCreateModal] = useState(false)
  const queryClient = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ['projects'],
    queryFn: projectsApi.list,
  })

  const createMutation = useMutation({
    mutationFn: projectsApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] })
      setShowCreateModal(false)
    },
  })

  const visibilityConfig = {
    private: { icon: Lock, tooltip: 'Private - Only you can see this project' },
    team: { icon: Users, tooltip: 'Team - Visible to your team members' },
    companywide: { icon: Globe, tooltip: 'Company-wide - Visible to everyone in the organization' },
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-theme-text-primary">Projects</h1>
          <p className="text-theme-text-secondary mt-1">Manage your applications and their configurations</p>
        </div>
        <Button onClick={() => setShowCreateModal(true)}>
          <Plus className="w-4 h-4 mr-2" />
          New Project
        </Button>
      </div>

      {/* Projects Grid */}
      {isLoading ? (
        <div className="text-center py-12">
          <p className="text-theme-text-muted">Loading projects...</p>
        </div>
      ) : data?.items?.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-theme-text-muted mb-4">No projects yet. Create your first project to get started.</p>
            <Button onClick={() => setShowCreateModal(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Create Project
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {data?.items?.map((project) => {
            const config = visibilityConfig[project.visibility as keyof typeof visibilityConfig] || visibilityConfig.private
            const VisibilityIcon = config.icon
            return (
              <Link key={project.id} to={`/projects/${project.id}`}>
                <Card className="h-full hover:shadow-md transition-shadow">
                  <CardContent className="space-y-4">
                    <div className="flex items-start justify-between">
                      <h3 className="text-lg font-semibold text-theme-text-primary">{project.name}</h3>
                      <span title={config.tooltip}>
                        <VisibilityIcon className="w-4 h-4 text-theme-text-muted" />
                      </span>
                    </div>

                    {project.description && (
                      <p className="text-sm text-theme-text-secondary line-clamp-2">{project.description}</p>
                    )}

                    {project.site_url && (
                      <div className="flex items-center gap-1 text-sm text-primary-600">
                        <ExternalLink className="w-3 h-3" />
                        <span className="truncate">{project.site_url}</span>
                      </div>
                    )}

                    <div className="flex items-center justify-between pt-2 border-t">
                      <div className="flex gap-2">
                        <Badge>{project.visibility}</Badge>
                        {project.has_credentials && (
                          <Badge variant="success">Credentials</Badge>
                        )}
                      </div>
                      <span className="text-xs text-theme-text-muted">
                        {formatDistanceToNow(new Date(project.updated_at), { addSuffix: true })}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            )
          })}
        </div>
      )}

      {/* Create Modal */}
      {showCreateModal && (
        <CreateProjectModal
          onClose={() => setShowCreateModal(false)}
          onSubmit={(data) => createMutation.mutate(data)}
          isLoading={createMutation.isPending}
        />
      )}
    </div>
  )
}

function CreateProjectModal({
  onClose,
  onSubmit,
  isLoading,
}: {
  onClose: () => void
  onSubmit: (data: ProjectCreate) => void
  isLoading: boolean
}) {
  const [formData, setFormData] = useState<ProjectCreate>({
    name: '',
    description: '',
    visibility: 'private',
    site_url: '',
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSubmit(formData)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-theme-bg-surface rounded-xl shadow-xl w-full max-w-md mx-4 p-6">
        <h2 className="text-xl font-semibold text-theme-text-primary mb-4">Create Project</h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <div className="flex gap-2 items-end">
              <div className="flex-1">
                <Input
                  label="Project Name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="My Application"
                  required
                />
              </div>
              <InlineVoiceTranscription
                tokenUrl="https://identity-api.ai.devintensive.com/api/v1/transcription/token"
                onTranscribe={(text) => setFormData({ ...formData, name: formData.name ? formData.name + ' ' + text : text })}
                size="md"
                className="mb-[2px]"
              />
            </div>
          </div>

          <div>
            <div className="flex gap-2 items-start">
              <div className="flex-1">
                <Textarea
                  label="Description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Brief description of the project..."
                  rows={3}
                />
              </div>
              <InlineVoiceTranscription
                tokenUrl="https://identity-api.ai.devintensive.com/api/v1/transcription/token"
                onTranscribe={(text) => setFormData({ ...formData, description: formData.description ? formData.description + ' ' + text : text })}
                size="md"
                className="mt-6"
              />
            </div>
          </div>

          <Input
            label="Site URL"
            type="url"
            value={formData.site_url}
            onChange={(e) => setFormData({ ...formData, site_url: e.target.value })}
            placeholder="https://example.com"
          />

          <Select
            label="Visibility"
            value={formData.visibility}
            onChange={(e) => setFormData({ ...formData, visibility: e.target.value as 'private' | 'team' | 'companywide' })}
            options={[
              { value: 'private', label: 'Private - Only you' },
              { value: 'team', label: 'Team - Your team members' },
              { value: 'companywide', label: 'Company - Everyone in organization' },
            ]}
          />

          <div className="flex gap-3 pt-4">
            <Button type="button" variant="secondary" onClick={onClose} className="flex-1">
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading || !formData.name} className="flex-1">
              {isLoading ? 'Creating...' : 'Create Project'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
