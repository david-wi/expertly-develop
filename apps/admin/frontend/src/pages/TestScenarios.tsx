import { useState, useEffect, useRef } from 'react'
import {
  FlaskConical,
  CheckCircle,
  XCircle,
  Clock,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  AlertTriangle,
  ListOrdered,
} from 'lucide-react'
import { testScenariosApi } from '@/services/api'
import type { TestScenario, TestScenarioStats, TestRunStatus, TestStepDefinition, TestStepResult } from '@/types/test_scenarios'

function formatDate(dateString: string): string {
  const date = new Date(dateString)
  return date.toLocaleString('en-US', {
    timeZone: 'America/New_York',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }) + ' EST'
}

function StatusBadge({ status }: { status: TestRunStatus | undefined }) {
  if (!status) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400">
        <Clock className="w-3 h-3" />
        Not Run
      </span>
    )
  }

  const config = {
    passed: { icon: CheckCircle, color: 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300' },
    failed: { icon: XCircle, color: 'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300' },
    skipped: { icon: AlertTriangle, color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-300' },
    running: { icon: RefreshCw, color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300' },
  }
  const { icon: Icon, color } = config[status]
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${color}`}>
      <Icon className={`w-3 h-3 ${status === 'running' ? 'animate-spin' : ''}`} />
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  )
}

function StepStatusIcon({ status, isFailed }: { status?: TestRunStatus; isFailed?: boolean }) {
  if (isFailed) {
    return <XCircle className="w-4 h-4 text-red-500" />
  }
  if (status === 'passed') {
    return <CheckCircle className="w-4 h-4 text-green-500" />
  }
  if (status === 'failed') {
    return <XCircle className="w-4 h-4 text-red-500" />
  }
  if (status === 'running') {
    return <RefreshCw className="w-4 h-4 text-blue-500 animate-spin" />
  }
  return <div className="w-4 h-4 rounded-full border-2 border-gray-300 dark:border-gray-600" />
}

function CategoryBadge({ category }: { category: string }) {
  const colors: Record<string, string> = {
    smoke: 'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300',
    integration: 'bg-purple-100 text-purple-800 dark:bg-purple-900/50 dark:text-purple-300',
    e2e: 'bg-primary-100 text-primary-800 dark:bg-primary-900/50 dark:text-primary-300',
    unit: 'bg-orange-100 text-orange-800 dark:bg-orange-900/50 dark:text-orange-300',
  }
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${colors[category] || 'bg-gray-100 text-gray-800'}`}>
      {category.toUpperCase()}
    </span>
  )
}

function StatCard({
  title,
  value,
  icon: Icon,
  color,
  onClick,
}: {
  title: string
  value: number
  icon: React.ElementType
  color: string
  onClick?: () => void
}) {
  const Component = onClick ? 'button' : 'div'
  return (
    <Component
      onClick={onClick}
      className={`bg-theme-bg-surface rounded-xl border border-theme-border p-4 text-left w-full ${
        onClick ? 'cursor-pointer hover:bg-theme-bg-elevated transition-colors' : ''
      }`}
    >
      <div className="flex items-center gap-3">
        <div className={`p-2 rounded-lg ${color}`}>
          <Icon className="w-5 h-5" />
        </div>
        <div>
          <p className="text-2xl font-bold text-theme-text-primary">{value}</p>
          <p className="text-sm text-theme-text-secondary">{title}</p>
        </div>
      </div>
    </Component>
  )
}

function StepsList({
  steps,
  stepResults,
  failedStep
}: {
  steps: TestStepDefinition[] | null
  stepResults: TestStepResult[] | null
  failedStep: number | null
}) {
  if (!steps || steps.length === 0) {
    return (
      <p className="text-sm text-theme-text-muted italic">No step definitions available</p>
    )
  }

  // Create a map of step results for quick lookup
  const resultsMap = new Map<number, TestStepResult>()
  if (stepResults) {
    stepResults.forEach(sr => resultsMap.set(sr.step_number, sr))
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-sm font-medium text-theme-text-primary mb-3">
        <ListOrdered className="w-4 h-4" />
        Test Steps
      </div>
      <ol className="space-y-2">
        {steps.map((step) => {
          const result = resultsMap.get(step.step_number)
          const isFailed = failedStep === step.step_number

          return (
            <li
              key={step.step_number}
              className={`flex items-start gap-3 p-2 rounded-lg ${
                isFailed
                  ? 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800'
                  : 'bg-theme-bg-surface'
              }`}
            >
              <div className="flex-shrink-0 mt-0.5">
                <StepStatusIcon status={result?.status} isFailed={isFailed} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-theme-text-muted">
                    Step {step.step_number}
                  </span>
                  {result?.duration_ms && (
                    <span className="text-xs text-theme-text-muted">
                      ({(result.duration_ms / 1000).toFixed(2)}s)
                    </span>
                  )}
                </div>
                <p className="text-sm text-theme-text-primary">
                  {step.description}
                </p>
                {step.expected_outcome && (
                  <p className="text-xs text-theme-text-secondary mt-0.5">
                    Expected: {step.expected_outcome}
                  </p>
                )}
                {result?.error && (
                  <pre className="mt-1 text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/30 p-2 rounded overflow-x-auto">
                    {result.error}
                  </pre>
                )}
              </div>
            </li>
          )
        })}
      </ol>
    </div>
  )
}

export function TestScenarios() {
  const [scenarios, setScenarios] = useState<TestScenario[]>([])
  const [stats, setStats] = useState<TestScenarioStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [filterApp, setFilterApp] = useState<string>('')
  const [filterCategory, setFilterCategory] = useState<string>('')
  const [filterStatus, setFilterStatus] = useState<string>('')
  const [apps, setApps] = useState<string[]>([])
  const [categories, setCategories] = useState<string[]>([])
  const scenariosListRef = useRef<HTMLDivElement>(null)

  const scrollToScenarios = () => {
    scenariosListRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const fetchData = async () => {
    setLoading(true)
    setError(null)
    try {
      const [scenariosRes, statsRes, appsRes, categoriesRes] = await Promise.all([
        testScenariosApi.list({
          app_name: filterApp || undefined,
          category: filterCategory as 'smoke' | 'integration' | 'e2e' | 'unit' | undefined,
        }),
        testScenariosApi.getStats(),
        testScenariosApi.getApps(),
        testScenariosApi.getCategories(),
      ])
      setScenarios(scenariosRes.scenarios)
      setStats(statsRes)
      setApps(appsRes)
      setCategories(categoriesRes)
    } catch (err) {
      console.error('Failed to fetch test scenarios:', err)
      setError('Failed to load test scenarios. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [filterApp, filterCategory])

  // Filter by status (client-side since it depends on latest_run)
  const filteredScenarios = scenarios.filter(s => {
    if (filterStatus) {
      const runStatus = s.latest_run?.status
      if (filterStatus === 'not-run' && runStatus) return false
      if (filterStatus !== 'not-run' && runStatus !== filterStatus) return false
    }
    return true
  })

  // Calculate stats from current scenarios
  const displayStats = {
    total: stats?.total_scenarios || 0,
    passed: stats?.run_stats?.passed || 0,
    failed: stats?.run_stats?.failed || 0,
    notRun: (stats?.total_scenarios || 0) - Object.values(stats?.run_stats || {}).reduce((a, b) => a + b, 0),
  }

  if (loading && scenarios.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-8 h-8 animate-spin text-theme-text-muted" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-theme-text-primary">Test Scenarios</h1>
          <p className="text-theme-text-secondary mt-1">
            End-to-end test scenarios across all Expertly applications
          </p>
        </div>
        <button
          onClick={fetchData}
          disabled={loading}
          className="flex items-center gap-2 px-3 py-1.5 text-theme-text-secondary hover:bg-theme-bg-elevated rounded-lg text-sm transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 text-red-800 dark:text-red-200">
          {error}
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Scenarios"
          value={displayStats.total}
          icon={FlaskConical}
          color="bg-primary-100 text-primary-600 dark:bg-primary-900/50 dark:text-primary-400"
          onClick={() => {
            setFilterStatus('')
            scrollToScenarios()
          }}
        />
        <StatCard
          title="Passed"
          value={displayStats.passed}
          icon={CheckCircle}
          color="bg-green-100 text-green-600 dark:bg-green-900/50 dark:text-green-400"
          onClick={() => {
            setFilterStatus('passed')
            scrollToScenarios()
          }}
        />
        <StatCard
          title="Failed"
          value={displayStats.failed}
          icon={XCircle}
          color="bg-red-100 text-red-600 dark:bg-red-900/50 dark:text-red-400"
          onClick={() => {
            setFilterStatus('failed')
            scrollToScenarios()
          }}
        />
        <StatCard
          title="Not Run"
          value={displayStats.notRun}
          icon={Clock}
          color="bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400"
          onClick={() => {
            setFilterStatus('not-run')
            scrollToScenarios()
          }}
        />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 bg-theme-bg-surface rounded-xl border border-theme-border p-4">
        <div>
          <label className="block text-xs text-theme-text-muted mb-1">App</label>
          <select
            value={filterApp}
            onChange={(e) => setFilterApp(e.target.value)}
            className="px-3 py-1.5 bg-theme-bg-elevated border border-theme-border rounded-lg text-sm text-theme-text-primary"
          >
            <option value="">All Apps</option>
            {apps.map(app => (
              <option key={app} value={app}>{app}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs text-theme-text-muted mb-1">Category</label>
          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            className="px-3 py-1.5 bg-theme-bg-elevated border border-theme-border rounded-lg text-sm text-theme-text-primary"
          >
            <option value="">All Categories</option>
            {categories.map(cat => (
              <option key={cat} value={cat}>{cat.toUpperCase()}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs text-theme-text-muted mb-1">Status</label>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-3 py-1.5 bg-theme-bg-elevated border border-theme-border rounded-lg text-sm text-theme-text-primary"
          >
            <option value="">All Statuses</option>
            <option value="passed">Passed</option>
            <option value="failed">Failed</option>
            <option value="skipped">Skipped</option>
            <option value="not-run">Not Run</option>
          </select>
        </div>

        {(filterApp || filterCategory || filterStatus) && (
          <button
            onClick={() => {
              setFilterApp('')
              setFilterCategory('')
              setFilterStatus('')
            }}
            className="px-3 py-1.5 text-sm text-theme-text-secondary hover:text-theme-text-primary mt-4"
          >
            Clear filters
          </button>
        )}
      </div>

      {/* Scenarios List */}
      <div ref={scenariosListRef} className="space-y-2">
        {/* List Title */}
        <h2 className="text-lg font-semibold text-theme-text-primary">
          {filterStatus === 'passed' && 'Passed Scenarios'}
          {filterStatus === 'failed' && 'Failed Scenarios'}
          {filterStatus === 'not-run' && 'Scenarios Not Run'}
          {filterStatus === 'skipped' && 'Skipped Scenarios'}
          {!filterStatus && 'All Scenarios'}
          <span className="text-sm font-normal text-theme-text-muted ml-2">
            ({filteredScenarios.length})
          </span>
        </h2>

        <div className="bg-theme-bg-surface rounded-xl border border-theme-border overflow-hidden">
        {filteredScenarios.length === 0 ? (
          <div className="p-8 text-center text-theme-text-muted">
            <FlaskConical className="w-8 h-8 mx-auto mb-2" />
            {scenarios.length === 0
              ? 'No test scenarios defined yet. Run the seed script to populate initial data.'
              : 'No scenarios found matching filters'}
          </div>
        ) : (
          <>
            {/* Table Header */}
            <div className="hidden md:grid grid-cols-[100px_1fr_120px_80px_80px_140px_32px] gap-2 px-4 py-2 bg-theme-bg-elevated border-b border-theme-border text-xs font-medium text-theme-text-muted uppercase tracking-wide">
              <div>Status</div>
              <div>Scenario</div>
              <div>App</div>
              <div>Category</div>
              <div>Steps</div>
              <div>Last Run</div>
              <div></div>
            </div>
            <div className="divide-y divide-theme-border">
            {filteredScenarios.map((scenario) => (
              <div key={scenario.id} className="hover:bg-theme-bg-elevated transition-colors">
                <button
                  onClick={() => setExpandedId(expandedId === scenario.id ? null : scenario.id)}
                  className="w-full px-4 py-3 text-left"
                >
                  {/* Desktop: Table row layout */}
                  <div className="hidden md:grid grid-cols-[100px_1fr_120px_80px_80px_140px_32px] gap-2 items-center">
                    <div>
                      <StatusBadge status={scenario.latest_run?.status} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-theme-text-primary truncate">
                        {scenario.name}
                      </p>
                      {scenario.description && (
                        <p className="text-xs text-theme-text-muted truncate">
                          {scenario.description}
                        </p>
                      )}
                    </div>
                    <div className="text-sm text-theme-text-secondary truncate">
                      {scenario.app_name}
                    </div>
                    <div>
                      <CategoryBadge category={scenario.category} />
                    </div>
                    <div className="text-xs text-theme-text-muted">
                      {scenario.steps?.length || 0} steps
                    </div>
                    <div className="text-xs text-theme-text-muted truncate">
                      {scenario.latest_run ? formatDate(scenario.latest_run.created_at) : '—'}
                    </div>
                    <div>
                      {expandedId === scenario.id ? (
                        <ChevronUp className="w-4 h-4 text-theme-text-muted" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-theme-text-muted" />
                      )}
                    </div>
                  </div>
                  {/* Mobile: Stacked layout */}
                  <div className="md:hidden flex items-center justify-between">
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <StatusBadge status={scenario.latest_run?.status} />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-theme-text-primary truncate">
                          {scenario.name}
                        </p>
                        <p className="text-xs text-theme-text-muted">
                          {scenario.app_name}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <CategoryBadge category={scenario.category} />
                      {expandedId === scenario.id ? (
                        <ChevronUp className="w-4 h-4 text-theme-text-muted" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-theme-text-muted" />
                      )}
                    </div>
                  </div>
                </button>

                {expandedId === scenario.id && (
                  <div className="px-4 pb-4 pt-0 space-y-4">
                    <div className="bg-theme-bg-elevated rounded-lg p-4 ml-8">
                      {scenario.description && (
                        <p className="text-sm text-theme-text-secondary mb-4">
                          {scenario.description}
                        </p>
                      )}

                      {/* Steps List */}
                      <StepsList
                        steps={scenario.steps}
                        stepResults={scenario.latest_run?.step_results || null}
                        failedStep={scenario.latest_run?.failed_step || null}
                      />

                      {/* Test File Link */}
                      {scenario.test_file && (
                        <div className="flex items-center gap-2 text-xs text-theme-text-muted mt-4 pt-4 border-t border-theme-border">
                          <span>Test file:</span>
                          <code className="bg-theme-bg-surface px-1.5 py-0.5 rounded">
                            {scenario.test_file}
                          </code>
                          <a
                            href={`https://github.com/david-wi/expertly-develop/blob/main/${scenario.test_file}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-primary-600 hover:text-primary-700 inline-flex items-center gap-1"
                          >
                            View <ExternalLink className="w-3 h-3" />
                          </a>
                        </div>
                      )}

                      {/* Last Run Info */}
                      {scenario.latest_run && (
                        <div className="mt-4 pt-4 border-t border-theme-border">
                          <div className="flex items-center gap-4 text-xs">
                            <span className="text-theme-text-muted">
                              Last run: {formatDate(scenario.latest_run.created_at)}
                            </span>
                            {scenario.latest_run.duration_ms && (
                              <span className="text-theme-text-muted">
                                Duration: {(scenario.latest_run.duration_ms / 1000).toFixed(1)}s
                              </span>
                            )}
                            {scenario.latest_run.environment && (
                              <span className="text-theme-text-muted">
                                Env: {scenario.latest_run.environment}
                              </span>
                            )}
                          </div>
                          {scenario.latest_run.error_message && (
                            <div className="mt-3">
                              <p className="text-xs font-medium text-red-600 dark:text-red-400 mb-1">
                                Error at Step {scenario.latest_run.failed_step}:
                              </p>
                              <pre className="text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 p-2 rounded overflow-x-auto">
                                {scenario.latest_run.error_message}
                              </pre>
                            </div>
                          )}
                          {scenario.latest_run.error_stack && (
                            <details className="mt-2">
                              <summary className="text-xs text-theme-text-muted cursor-pointer hover:text-theme-text-secondary">
                                Show stack trace
                              </summary>
                              <pre className="mt-1 text-xs text-theme-text-muted bg-theme-bg-surface p-2 rounded overflow-x-auto max-h-48">
                                {scenario.latest_run.error_stack}
                              </pre>
                            </details>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}
            </div>
          </>
        )}
        </div>
      </div>

      {/* Footer note */}
      <p className="text-xs text-theme-text-muted text-center">
        Test results are updated when CI/CD reports runs via the API. Click Refresh to reload.
      </p>
    </div>
  )
}
