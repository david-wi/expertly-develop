import { useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { projectsApi, testsApi, runsApi, environmentsApi } from '../api/client'
import { Project, TestCase, TestRun, Environment } from '../types'
import {
  Play,
  Plus,
  CheckCircle,
  XCircle,
  Clock,
  ChevronRight,
  Settings,
  FileText,
  Zap,
} from 'lucide-react'
import clsx from 'clsx'

export default function ProjectDetail() {
  const { projectId } = useParams<{ projectId: string }>()
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [activeTab, setActiveTab] = useState<'tests' | 'runs' | 'environments'>('tests')
  const [showNewTest, setShowNewTest] = useState(false)
  const [newTestTitle, setNewTestTitle] = useState('')

  const { data: project, isLoading } = useQuery({
    queryKey: ['project', projectId],
    queryFn: () => projectsApi.get(projectId!),
    enabled: !!projectId,
  })

  const { data: tests } = useQuery({
    queryKey: ['tests', projectId],
    queryFn: () => testsApi.list(projectId!),
    enabled: !!projectId,
  })

  const { data: runs } = useQuery({
    queryKey: ['runs', projectId],
    queryFn: () => runsApi.list(projectId!),
    enabled: !!projectId,
  })

  const { data: environments } = useQuery({
    queryKey: ['environments', projectId],
    queryFn: () => environmentsApi.list(projectId!),
    enabled: !!projectId,
  })

  const createTestMutation = useMutation({
    mutationFn: (data: { title: string }) => testsApi.create(projectId!, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tests', projectId] })
      setShowNewTest(false)
      setNewTestTitle('')
    },
  })

  const startRunMutation = useMutation({
    mutationFn: () => runsApi.start(projectId!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['runs', projectId] })
    },
  })

  const approveTestMutation = useMutation({
    mutationFn: (testId: string) => testsApi.approve(projectId!, testId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tests', projectId] })
    },
  })

  if (isLoading) {
    return (
      <div className="animate-pulse space-y-6">
        <div className="h-8 w-48 bg-gray-200 rounded" />
        <div className="h-4 w-96 bg-gray-200 rounded" />
        <div className="h-64 bg-gray-200 rounded-lg" />
      </div>
    )
  }

  const projectData = project as Project & {
    stats: { total_tests: number; approved_tests: number; draft_tests: number; total_runs: number; passed_runs: number; failed_runs: number }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{projectData?.name}</h1>
          {projectData?.description && (
            <p className="text-gray-600 mt-1">{projectData.description}</p>
          )}
        </div>
        <button
          onClick={() => startRunMutation.mutate()}
          disabled={startRunMutation.isPending || !tests?.length}
          className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
        >
          <Play className="w-4 h-4" />
          {t('runs.newRun')}
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <div className="text-2xl font-bold text-gray-900">
            {projectData?.stats?.total_tests || 0}
          </div>
          <div className="text-sm text-gray-600">{t('projects.tests')}</div>
        </div>
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <div className="text-2xl font-bold text-green-600">
            {projectData?.stats?.approved_tests || 0}
          </div>
          <div className="text-sm text-gray-600">{t('status.approved')}</div>
        </div>
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <div className="text-2xl font-bold text-yellow-600">
            {projectData?.stats?.draft_tests || 0}
          </div>
          <div className="text-sm text-gray-600">{t('status.draft')}</div>
        </div>
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <div className="text-2xl font-bold text-gray-900">
            {projectData?.stats?.total_runs || 0}
          </div>
          <div className="text-sm text-gray-600">{t('projects.runs')}</div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="flex gap-4">
          {(['tests', 'runs', 'environments'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={clsx(
                'px-4 py-2 text-sm font-medium border-b-2 -mb-px',
                activeTab === tab
                  ? 'border-primary-600 text-primary-600'
                  : 'border-transparent text-gray-600 hover:text-gray-900'
              )}
            >
              {t(`projects.${tab}`)}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === 'tests' && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button
              onClick={() => setShowNewTest(true)}
              className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
            >
              <Plus className="w-4 h-4" />
              {t('tests.newTest')}
            </button>
          </div>

          {(tests as TestCase[])?.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
              <FileText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                {t('tests.noTests')}
              </h3>
              <button
                onClick={() => setShowNewTest(true)}
                className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
              >
                <Plus className="w-4 h-4" />
                {t('tests.newTest')}
              </button>
            </div>
          ) : (
            <div className="bg-white rounded-lg border border-gray-200 divide-y divide-gray-200">
              {(tests as TestCase[])?.map((test) => (
                <div key={test.id} className="p-4 hover:bg-gray-50">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="font-medium text-gray-900">{test.title}</h3>
                        <span
                          className={clsx(
                            'px-2 py-0.5 text-xs rounded-full',
                            test.status === 'approved'
                              ? 'bg-green-100 text-green-700'
                              : test.status === 'draft'
                              ? 'bg-yellow-100 text-yellow-700'
                              : 'bg-gray-100 text-gray-700'
                          )}
                        >
                          {t(`status.${test.status}`)}
                        </span>
                        <span
                          className={clsx(
                            'px-2 py-0.5 text-xs rounded-full',
                            test.priority === 'critical'
                              ? 'bg-red-100 text-red-700'
                              : test.priority === 'high'
                              ? 'bg-orange-100 text-orange-700'
                              : 'bg-gray-100 text-gray-700'
                          )}
                        >
                          {t(`priority.${test.priority}`)}
                        </span>
                        {test.created_by === 'ai' && (
                          <span className="px-2 py-0.5 text-xs bg-purple-100 text-purple-700 rounded-full flex items-center gap-1">
                            <Zap className="w-3 h-3" /> AI
                          </span>
                        )}
                      </div>
                      {test.description && (
                        <p className="text-sm text-gray-600 mt-1 line-clamp-1">
                          {test.description}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {test.status === 'draft' && (
                        <button
                          onClick={() => approveTestMutation.mutate(test.id)}
                          className="px-3 py-1 text-sm bg-green-100 text-green-700 rounded hover:bg-green-200"
                        >
                          {t('tests.approve')}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* New Test Modal */}
          {showNewTest && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
              <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4">
                <form
                  onSubmit={(e) => {
                    e.preventDefault()
                    if (newTestTitle.trim()) {
                      createTestMutation.mutate({ title: newTestTitle.trim() })
                    }
                  }}
                >
                  <div className="p-6">
                    <h2 className="text-lg font-semibold text-gray-900 mb-4">
                      {t('tests.newTest')}
                    </h2>
                    <input
                      type="text"
                      value={newTestTitle}
                      onChange={(e) => setNewTestTitle(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                      placeholder="Test case title..."
                      required
                    />
                  </div>
                  <div className="px-6 py-4 bg-gray-50 rounded-b-lg flex justify-end gap-3">
                    <button
                      type="button"
                      onClick={() => setShowNewTest(false)}
                      className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg"
                    >
                      {t('common.cancel')}
                    </button>
                    <button
                      type="submit"
                      disabled={createTestMutation.isPending}
                      className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
                    >
                      {t('common.create')}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === 'runs' && (
        <div className="space-y-4">
          {(runs as TestRun[])?.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
              <Play className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                {t('runs.noRuns')}
              </h3>
            </div>
          ) : (
            <div className="bg-white rounded-lg border border-gray-200 divide-y divide-gray-200">
              {(runs as TestRun[])?.map((run) => (
                <Link
                  key={run.id}
                  to={`/projects/${projectId}/runs/${run.id}`}
                  className="p-4 hover:bg-gray-50 flex items-center justify-between"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-medium text-gray-900">
                        {run.name || `Run ${run.id.slice(0, 8)}`}
                      </h3>
                      <span
                        className={clsx(
                          'px-2 py-0.5 text-xs rounded-full',
                          run.status === 'completed'
                            ? 'bg-green-100 text-green-700'
                            : run.status === 'failed'
                            ? 'bg-red-100 text-red-700'
                            : run.status === 'running'
                            ? 'bg-blue-100 text-blue-700'
                            : 'bg-gray-100 text-gray-700'
                        )}
                      >
                        {t(`status.${run.status}`)}
                      </span>
                    </div>
                    {run.summary && (
                      <div className="flex items-center gap-4 mt-1 text-sm text-gray-600">
                        <span className="flex items-center gap-1">
                          <CheckCircle className="w-4 h-4 text-green-500" />
                          {run.summary.passed}
                        </span>
                        <span className="flex items-center gap-1">
                          <XCircle className="w-4 h-4 text-red-500" />
                          {run.summary.failed}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="w-4 h-4" />
                          {run.summary.skipped}
                        </span>
                      </div>
                    )}
                  </div>
                  <ChevronRight className="w-5 h-5 text-gray-400" />
                </Link>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'environments' && (
        <div className="space-y-4">
          {(environments as Environment[])?.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
              <Settings className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                No environments configured
              </h3>
            </div>
          ) : (
            <div className="bg-white rounded-lg border border-gray-200 divide-y divide-gray-200">
              {(environments as Environment[])?.map((env) => (
                <div key={env.id} className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-medium text-gray-900">{env.name}</h3>
                        <span className="px-2 py-0.5 text-xs bg-gray-100 text-gray-700 rounded-full">
                          {env.type}
                        </span>
                        {env.is_default && (
                          <span className="px-2 py-0.5 text-xs bg-primary-100 text-primary-700 rounded-full">
                            Default
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-gray-600 mt-1">{env.base_url}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
