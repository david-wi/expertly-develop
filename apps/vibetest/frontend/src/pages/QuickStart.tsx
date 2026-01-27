import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { quickStartApi } from '../api/client'
import { QuickStartSession } from '../types'
import {
  Zap,
  Globe,
  Lock,
  Loader2,
  CheckCircle,
  XCircle,
  AlertTriangle,
  FileText,
  Image,
} from 'lucide-react'
import clsx from 'clsx'

export default function QuickStart() {
  const { t } = useTranslation()
  const navigate = useNavigate()

  const [url, setUrl] = useState('')
  const [showCredentials, setShowCredentials] = useState(false)
  const [credentials, setCredentials] = useState({
    username: '',
    password: '',
    login_url: '',
  })
  const [session, setSession] = useState<QuickStartSession | null>(null)
  const [isStarting, setIsStarting] = useState(false)
  const [error, setError] = useState('')
  const [projectName, setProjectName] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  // Poll for status updates
  useEffect(() => {
    if (!session || ['completed', 'failed'].includes(session.status)) return

    const interval = setInterval(async () => {
      try {
        const updated = await quickStartApi.getStatus(session.id)
        setSession(updated)
      } catch (e) {
        console.error('Failed to get status:', e)
      }
    }, 2000)

    return () => clearInterval(interval)
  }, [session])

  const handleStart = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setIsStarting(true)

    try {
      const data: Parameters<typeof quickStartApi.start>[0] = { url }
      if (showCredentials && credentials.username) {
        data.credentials = credentials
      }

      const result = await quickStartApi.start(data)
      setSession(result)
    } catch (e: unknown) {
      const err = e as { response?: { data?: { detail?: string } }; message?: string }
      setError(err.response?.data?.detail || err.message || 'Failed to start exploration')
    } finally {
      setIsStarting(false)
    }
  }

  const handleSaveAsProject = async () => {
    if (!session || !projectName.trim()) return

    setIsSaving(true)
    try {
      const result = await quickStartApi.saveAsProject(session.id, projectName.trim())
      navigate(`/projects/${result.project_id}`)
    } catch (e: unknown) {
      const err = e as { response?: { data?: { detail?: string } }; message?: string }
      setError(err.response?.data?.detail || err.message || 'Failed to save project')
    } finally {
      setIsSaving(false)
    }
  }

  // Initial form
  if (!session) {
    return (
      <div className="max-w-2xl mx-auto space-y-8">
        <div className="text-center">
          <div className="w-16 h-16 bg-primary-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Zap className="w-8 h-8 text-primary-600" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">{t('quickStart.title')}</h1>
          <p className="text-gray-600 mt-2">{t('quickStart.subtitle')}</p>
        </div>

        <form onSubmit={handleStart} className="bg-white p-6 rounded-lg border border-gray-200 space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t('quickStart.enterUrl')}
            </label>
            <div className="relative">
              <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                placeholder={t('quickStart.urlPlaceholder')}
                required
              />
            </div>
          </div>

          <div>
            <button
              type="button"
              onClick={() => setShowCredentials(!showCredentials)}
              className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900"
            >
              <Lock className="w-4 h-4" />
              {t('quickStart.addCredentials')}
            </button>

            {showCredentials && (
              <div className="mt-4 p-4 bg-gray-50 rounded-lg space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {t('quickStart.loginUrl')}
                  </label>
                  <input
                    type="url"
                    value={credentials.login_url}
                    onChange={(e) => setCredentials({ ...credentials, login_url: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    placeholder="https://your-app.com/login"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      {t('quickStart.username')}
                    </label>
                    <input
                      type="text"
                      value={credentials.username}
                      onChange={(e) => setCredentials({ ...credentials, username: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      {t('quickStart.password')}
                    </label>
                    <input
                      type="password"
                      value={credentials.password}
                      onChange={(e) => setCredentials({ ...credentials, password: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          {error && (
            <div className="p-4 bg-red-50 text-red-700 rounded-lg flex items-center gap-2">
              <XCircle className="w-5 h-5" />
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={isStarting || !url}
            className="w-full py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {isStarting ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Starting...
              </>
            ) : (
              <>
                <Zap className="w-5 h-5" />
                {t('quickStart.startExploration')}
              </>
            )}
          </button>
        </form>
      </div>
    )
  }

  // Progress/Results view
  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Progress Header */}
      <div className="bg-white p-6 rounded-lg border border-gray-200">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            {session.status === 'completed' ? (
              <CheckCircle className="w-8 h-8 text-green-500" />
            ) : session.status === 'failed' ? (
              <XCircle className="w-8 h-8 text-red-500" />
            ) : (
              <Loader2 className="w-8 h-8 text-primary-600 animate-spin" />
            )}
            <div>
              <h2 className="text-lg font-semibold text-gray-900">
                {session.status === 'completed'
                  ? t('quickStart.completed')
                  : session.status === 'failed'
                  ? 'Exploration Failed'
                  : t('quickStart.exploring')}
              </h2>
              <p className="text-sm text-gray-600">{session.progress_message}</p>
            </div>
          </div>
          <span className="text-2xl font-bold text-gray-900">
            {Math.round(session.progress)}%
          </span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div
            className={clsx(
              'h-2 rounded-full transition-all',
              session.status === 'failed' ? 'bg-red-500' : 'bg-primary-600'
            )}
            style={{ width: `${session.progress}%` }}
          />
        </div>
      </div>

      {/* Results */}
      {session.status === 'completed' && session.results && (
        <>
          {/* Stats */}
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-white p-4 rounded-lg border border-gray-200 text-center">
              <div className="text-3xl font-bold text-gray-900">
                {session.results.pages_explored}
              </div>
              <div className="text-sm text-gray-600">{t('quickStart.pagesFound')}</div>
            </div>
            <div className="bg-white p-4 rounded-lg border border-gray-200 text-center">
              <div className="text-3xl font-bold text-primary-600">
                {session.results.suggested_tests.length}
              </div>
              <div className="text-sm text-gray-600">{t('quickStart.testsGenerated')}</div>
            </div>
            <div className="bg-white p-4 rounded-lg border border-gray-200 text-center">
              <div className="text-3xl font-bold text-yellow-600">
                {session.results.issues.length}
              </div>
              <div className="text-sm text-gray-600">{t('quickStart.issuesFound')}</div>
            </div>
          </div>

          {/* Pages */}
          <div className="bg-white rounded-lg border border-gray-200">
            <div className="p-4 border-b border-gray-200">
              <h3 className="font-semibold text-gray-900">Pages Explored</h3>
            </div>
            <div className="divide-y divide-gray-200">
              {session.results.pages.map((page, i) => (
                <div key={i} className="p-4 flex items-center gap-4">
                  <Image className="w-5 h-5 text-gray-400" />
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-gray-900 truncate">{page.title}</div>
                    <div className="text-sm text-gray-600 truncate">{page.url}</div>
                  </div>
                  <div className="text-sm text-gray-500">{page.load_time_ms}ms</div>
                </div>
              ))}
            </div>
          </div>

          {/* Suggested Tests */}
          <div className="bg-white rounded-lg border border-gray-200">
            <div className="p-4 border-b border-gray-200">
              <h3 className="font-semibold text-gray-900">
                Suggested Tests ({session.results.suggested_tests.length})
              </h3>
            </div>
            <div className="divide-y divide-gray-200 max-h-96 overflow-y-auto">
              {session.results.suggested_tests.map((test, i) => (
                <div key={i} className="p-4">
                  <div className="flex items-center gap-2 mb-1">
                    <FileText className="w-4 h-4 text-gray-400" />
                    <span className="font-medium text-gray-900">{test.title}</span>
                    <span
                      className={clsx(
                        'px-2 py-0.5 text-xs rounded-full',
                        test.priority === 'high'
                          ? 'bg-orange-100 text-orange-700'
                          : 'bg-gray-100 text-gray-700'
                      )}
                    >
                      {test.priority}
                    </span>
                  </div>
                  <p className="text-sm text-gray-600">{test.description}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Issues */}
          {session.results.issues.length > 0 && (
            <div className="bg-white rounded-lg border border-gray-200">
              <div className="p-4 border-b border-gray-200">
                <h3 className="font-semibold text-gray-900">Issues Found</h3>
              </div>
              <div className="divide-y divide-gray-200">
                {session.results.issues.map((issue, i) => (
                  <div key={i} className="p-4 flex items-start gap-3">
                    <AlertTriangle
                      className={clsx(
                        'w-5 h-5 mt-0.5',
                        issue.severity === 'error'
                          ? 'text-red-500'
                          : issue.severity === 'warning'
                          ? 'text-yellow-500'
                          : 'text-blue-500'
                      )}
                    />
                    <div>
                      <div className="font-medium text-gray-900">{issue.message}</div>
                      <div className="text-sm text-gray-600">{issue.url}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Save as Project */}
          {!session.project_id && (
            <div className="bg-primary-50 p-6 rounded-lg border border-primary-200">
              <h3 className="font-semibold text-primary-900 mb-2">
                {t('quickStart.saveAsProject')}
              </h3>
              <p className="text-sm text-primary-700 mb-4">
                Save these results as a project to continue testing.
              </p>
              <div className="flex gap-4">
                <input
                  type="text"
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value)}
                  className="flex-1 px-3 py-2 border border-primary-300 rounded-lg"
                  placeholder="Project name..."
                />
                <button
                  onClick={handleSaveAsProject}
                  disabled={isSaving || !projectName.trim()}
                  className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50"
                >
                  {isSaving ? 'Saving...' : 'Save Project'}
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
