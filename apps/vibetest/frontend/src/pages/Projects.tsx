import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { InlineVoiceTranscription } from '@expertly/ui'
import { projectsApi } from '../api/client'
import { Project } from '../types'
import {
  FolderKanban,
  Plus,
  Trash2,
} from 'lucide-react'
import clsx from 'clsx'

export default function Projects() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [newProjectName, setNewProjectName] = useState('')
  const [newProjectDescription, setNewProjectDescription] = useState('')

  const { data: projects, isLoading } = useQuery({
    queryKey: ['projects'],
    queryFn: projectsApi.list,
  })

  const createMutation = useMutation({
    mutationFn: (data: { name: string; description?: string }) =>
      projectsApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] })
      setShowCreateModal(false)
      setNewProjectName('')
      setNewProjectDescription('')
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => projectsApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] })
    },
  })

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault()
    if (newProjectName.trim()) {
      createMutation.mutate({
        name: newProjectName.trim(),
        description: newProjectDescription.trim() || undefined,
      })
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t('projects.title')}</h1>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
        >
          <Plus className="w-4 h-4" />
          {t('projects.newProject')}
        </button>
      </div>

      {/* Projects Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-40 bg-gray-100 rounded-lg animate-pulse" />
          ))}
        </div>
      ) : (projects as Project[])?.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-lg border border-gray-200">
          <FolderKanban className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            {t('projects.noProjects')}
          </h3>
          <p className="text-gray-600 mb-6">{t('projects.createFirst')}</p>
          <button
            onClick={() => setShowCreateModal(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
          >
            <Plus className="w-4 h-4" />
            {t('projects.newProject')}
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {(projects as Project[])?.map((project) => (
            <div
              key={project.id}
              className="bg-white border border-gray-200 rounded-lg hover:border-primary-300 hover:shadow-sm transition-all"
            >
              <Link to={`/projects/${project.id}`} className="block p-4">
                <div className="flex items-start justify-between mb-2">
                  <h3 className="font-semibold text-gray-900">{project.name}</h3>
                  <span
                    className={clsx(
                      'px-2 py-0.5 text-xs rounded-full',
                      project.status === 'active'
                        ? 'bg-green-100 text-green-700'
                        : 'bg-gray-100 text-gray-700'
                    )}
                  >
                    {t(`status.${project.status}`)}
                  </span>
                </div>
                {project.description && (
                  <p className="text-sm text-gray-600 mb-4 line-clamp-2">
                    {project.description}
                  </p>
                )}
                <div className="flex items-center gap-4 text-sm text-gray-500">
                  <span>{project.stats?.total_tests || 0} {t('projects.tests')}</span>
                  <span>{project.stats?.total_runs || 0} {t('projects.runs')}</span>
                </div>
              </Link>
              <div className="px-4 py-3 border-t border-gray-100 flex items-center justify-between">
                <span className="text-xs text-gray-500">
                  {new Date(project.updated_at).toLocaleDateString()}
                </span>
                <button
                  onClick={(e) => {
                    e.preventDefault()
                    if (confirm('Delete this project?')) {
                      deleteMutation.mutate(project.id)
                    }
                  }}
                  className="p-1 text-gray-400 hover:text-red-500"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4">
            <form onSubmit={handleCreate}>
              <div className="p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">
                  {t('projects.newProject')}
                </h2>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      {t('common.name')}
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={newProjectName}
                        onChange={(e) => setNewProjectName(e.target.value)}
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                        placeholder="My Project"
                        required
                      />
                      <InlineVoiceTranscription
                        tokenUrl="https://identity-api.ai.devintensive.com/api/v1/transcription/token"
                        onTranscribe={(text) => setNewProjectName(newProjectName ? newProjectName + ' ' + text : text)}
                        size="md"
                        className="self-center"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      {t('common.description')}
                    </label>
                    <div className="flex gap-2">
                      <textarea
                        value={newProjectDescription}
                        onChange={(e) => setNewProjectDescription(e.target.value)}
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                        rows={3}
                        placeholder="Optional description..."
                      />
                      <InlineVoiceTranscription
                        tokenUrl="https://identity-api.ai.devintensive.com/api/v1/transcription/token"
                        onTranscribe={(text) => setNewProjectDescription(newProjectDescription ? newProjectDescription + ' ' + text : text)}
                        size="md"
                        className="self-start mt-1"
                      />
                    </div>
                  </div>
                </div>
              </div>
              <div className="px-6 py-4 bg-gray-50 rounded-b-lg flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg"
                >
                  {t('common.cancel')}
                </button>
                <button
                  type="submit"
                  disabled={createMutation.isPending}
                  className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50"
                >
                  {createMutation.isPending ? t('common.loading') : t('common.create')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
