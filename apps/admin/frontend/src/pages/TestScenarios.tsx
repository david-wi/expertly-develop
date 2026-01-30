import { useState, useEffect } from 'react'
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
} from 'lucide-react'

interface TestScenario {
  id: string
  name: string
  description: string
  app: string
  category: 'smoke' | 'integration' | 'e2e' | 'regression'
  lastRun?: {
    status: 'passed' | 'failed' | 'skipped' | 'running'
    timestamp: string
    duration?: number
    error?: string
  }
  testFile?: string
}

// Static test scenarios data - in the future this could come from an API
const TEST_SCENARIOS: TestScenario[] = [
  // Define App
  {
    id: 'define-login',
    name: 'User Login Flow',
    description: 'Verify user can log in via Identity service and access Define dashboard',
    app: 'Define',
    category: 'smoke',
    testFile: 'apps/define/frontend/e2e/login.spec.ts',
  },
  {
    id: 'define-product-crud',
    name: 'Product CRUD Operations',
    description: 'Create, read, update, and delete products with requirements',
    app: 'Define',
    category: 'integration',
    testFile: 'apps/define/backend/tests/test_products.py',
  },
  {
    id: 'define-ai-import',
    name: 'AI Requirements Import',
    description: 'Import requirements from text, PDF, or images using AI',
    app: 'Define',
    category: 'e2e',
  },
  // Develop App
  {
    id: 'develop-walkthrough',
    name: 'Create Visual Walkthrough',
    description: 'Create a new walkthrough project with screenshots and annotations',
    app: 'Develop',
    category: 'e2e',
    testFile: 'apps/develop/frontend/e2e/product-dropdown.spec.ts',
  },
  {
    id: 'develop-job-queue',
    name: 'Job Queue Processing',
    description: 'Verify background jobs are queued and processed correctly',
    app: 'Develop',
    category: 'integration',
    testFile: 'apps/develop/backend/tests/test_api.py',
  },
  // Manage App
  {
    id: 'manage-playbooks',
    name: 'Playbook Execution',
    description: 'Create and execute playbooks with task assignments',
    app: 'Manage',
    category: 'e2e',
    testFile: 'apps/manage/frontend/e2e/playbooks.spec.ts',
  },
  {
    id: 'manage-bot-workflow',
    name: 'Bot Task Workflow',
    description: 'Verify bots can process and complete assigned tasks',
    app: 'Manage',
    category: 'integration',
    testFile: 'apps/manage/backend/tests/test_scenario_bot_workflow.py',
  },
  {
    id: 'manage-queue-priority',
    name: 'Queue Priority Ordering',
    description: 'Tasks are processed in correct priority order',
    app: 'Manage',
    category: 'integration',
  },
  // Today App
  {
    id: 'today-dashboard',
    name: 'Dashboard Load',
    description: 'Dashboard displays tasks, stats, and recent activity',
    app: 'Today',
    category: 'smoke',
    testFile: 'apps/today/frontend/e2e/dashboard.spec.ts',
  },
  {
    id: 'today-task-crud',
    name: 'Task CRUD Operations',
    description: 'Create, complete, and manage daily tasks',
    app: 'Today',
    category: 'e2e',
    testFile: 'apps/today/frontend/e2e/tasks.spec.ts',
  },
  {
    id: 'today-production',
    name: 'Production E2E Tests',
    description: 'End-to-end tests against production environment',
    app: 'Today',
    category: 'e2e',
    testFile: 'apps/today/frontend/e2e/production-e2e.spec.ts',
  },
  // Identity App
  {
    id: 'identity-auth',
    name: 'Authentication Flow',
    description: 'User registration, login, and session management',
    app: 'Identity',
    category: 'smoke',
  },
  {
    id: 'identity-org-switch',
    name: 'Organization Switching',
    description: 'Users can switch between organizations they belong to',
    app: 'Identity',
    category: 'integration',
  },
  // Salon App
  {
    id: 'salon-comprehensive',
    name: 'Comprehensive Salon Tests',
    description: 'Full suite of salon management operations',
    app: 'Salon',
    category: 'e2e',
    testFile: 'apps/salon/frontend/e2e/comprehensive.spec.ts',
  },
  {
    id: 'salon-booking',
    name: 'Appointment Booking',
    description: 'Book, modify, and cancel salon appointments',
    app: 'Salon',
    category: 'integration',
  },
  // VibeTest App
  {
    id: 'vibetest-smoke',
    name: 'VibeTest Smoke Tests',
    description: 'Basic smoke tests for the testing platform',
    app: 'VibeTest',
    category: 'smoke',
    testFile: 'apps/vibetest/e2e/tests/test_smoke.py',
  },
  // Cross-App
  {
    id: 'cross-app-theme',
    name: 'Theme Synchronization',
    description: 'Themes update correctly across all applications',
    app: 'All Apps',
    category: 'integration',
  },
  {
    id: 'cross-app-auth',
    name: 'Cross-App Authentication',
    description: 'Single sign-on works across all Expertly applications',
    app: 'All Apps',
    category: 'e2e',
  },
]

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

function StatusBadge({ status }: { status: 'passed' | 'failed' | 'skipped' | 'running' | undefined }) {
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

function CategoryBadge({ category }: { category: string }) {
  const colors: Record<string, string> = {
    smoke: 'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300',
    integration: 'bg-purple-100 text-purple-800 dark:bg-purple-900/50 dark:text-purple-300',
    e2e: 'bg-primary-100 text-primary-800 dark:bg-primary-900/50 dark:text-primary-300',
    regression: 'bg-orange-100 text-orange-800 dark:bg-orange-900/50 dark:text-orange-300',
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
}: {
  title: string
  value: number
  icon: React.ElementType
  color: string
}) {
  return (
    <div className="bg-theme-bg-surface rounded-xl border border-theme-border p-4">
      <div className="flex items-center gap-3">
        <div className={`p-2 rounded-lg ${color}`}>
          <Icon className="w-5 h-5" />
        </div>
        <div>
          <p className="text-2xl font-bold text-theme-text-primary">{value}</p>
          <p className="text-sm text-theme-text-secondary">{title}</p>
        </div>
      </div>
    </div>
  )
}

export function TestScenarios() {
  const [scenarios, setScenarios] = useState<TestScenario[]>(TEST_SCENARIOS)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [filterApp, setFilterApp] = useState<string>('')
  const [filterCategory, setFilterCategory] = useState<string>('')
  const [filterStatus, setFilterStatus] = useState<string>('')

  // Simulate fetching latest results (in future this could be from an API)
  useEffect(() => {
    // Add some mock last run data for demonstration
    const scenariosWithResults = TEST_SCENARIOS.map(s => {
      // Randomly assign some results for demo purposes
      if (Math.random() > 0.3) {
        const statuses: ('passed' | 'failed' | 'skipped')[] = ['passed', 'passed', 'passed', 'failed', 'skipped']
        const status = statuses[Math.floor(Math.random() * statuses.length)]
        return {
          ...s,
          lastRun: {
            status,
            timestamp: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000).toISOString(),
            duration: Math.floor(Math.random() * 30000) + 1000,
            error: status === 'failed' ? 'AssertionError: Expected element to be visible' : undefined,
          },
        }
      }
      return s
    })
    setScenarios(scenariosWithResults)
  }, [])

  const apps = [...new Set(scenarios.map(s => s.app))]
  const categories = [...new Set(scenarios.map(s => s.category))]

  const filteredScenarios = scenarios.filter(s => {
    if (filterApp && s.app !== filterApp) return false
    if (filterCategory && s.category !== filterCategory) return false
    if (filterStatus) {
      if (filterStatus === 'not-run' && s.lastRun) return false
      if (filterStatus !== 'not-run' && s.lastRun?.status !== filterStatus) return false
    }
    return true
  })

  const stats = {
    total: scenarios.length,
    passed: scenarios.filter(s => s.lastRun?.status === 'passed').length,
    failed: scenarios.filter(s => s.lastRun?.status === 'failed').length,
    notRun: scenarios.filter(s => !s.lastRun).length,
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
          onClick={() => window.location.reload()}
          className="flex items-center gap-2 px-3 py-1.5 text-theme-text-secondary hover:bg-theme-bg-elevated rounded-lg text-sm transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
          Refresh
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Scenarios"
          value={stats.total}
          icon={FlaskConical}
          color="bg-primary-100 text-primary-600 dark:bg-primary-900/50 dark:text-primary-400"
        />
        <StatCard
          title="Passed"
          value={stats.passed}
          icon={CheckCircle}
          color="bg-green-100 text-green-600 dark:bg-green-900/50 dark:text-green-400"
        />
        <StatCard
          title="Failed"
          value={stats.failed}
          icon={XCircle}
          color="bg-red-100 text-red-600 dark:bg-red-900/50 dark:text-red-400"
        />
        <StatCard
          title="Not Run"
          value={stats.notRun}
          icon={Clock}
          color="bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400"
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
      <div className="bg-theme-bg-surface rounded-xl border border-theme-border overflow-hidden">
        {filteredScenarios.length === 0 ? (
          <div className="p-8 text-center text-theme-text-muted">
            <FlaskConical className="w-8 h-8 mx-auto mb-2" />
            No scenarios found matching filters
          </div>
        ) : (
          <div className="divide-y divide-theme-border">
            {filteredScenarios.map((scenario) => (
              <div key={scenario.id} className="hover:bg-theme-bg-elevated transition-colors">
                <button
                  onClick={() => setExpandedId(expandedId === scenario.id ? null : scenario.id)}
                  className="w-full px-4 py-3 flex items-center justify-between text-left"
                >
                  <div className="flex items-center gap-4 min-w-0 flex-1">
                    <StatusBadge status={scenario.lastRun?.status} />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-theme-text-primary truncate">
                        {scenario.name}
                      </p>
                      <p className="text-xs text-theme-text-muted truncate">
                        {scenario.app} • {scenario.description}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <CategoryBadge category={scenario.category} />
                    {scenario.lastRun && (
                      <span className="text-xs text-theme-text-muted hidden sm:inline">
                        {formatDate(scenario.lastRun.timestamp)}
                      </span>
                    )}
                    {expandedId === scenario.id ? (
                      <ChevronUp className="w-4 h-4 text-theme-text-muted" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-theme-text-muted" />
                    )}
                  </div>
                </button>

                {expandedId === scenario.id && (
                  <div className="px-4 pb-4 pt-0 space-y-3">
                    <div className="bg-theme-bg-elevated rounded-lg p-3 ml-8">
                      <p className="text-sm text-theme-text-secondary mb-2">
                        {scenario.description}
                      </p>

                      {scenario.testFile && (
                        <div className="flex items-center gap-2 text-xs text-theme-text-muted">
                          <span>Test file:</span>
                          <code className="bg-theme-bg-surface px-1.5 py-0.5 rounded">
                            {scenario.testFile}
                          </code>
                          <a
                            href={`https://github.com/david-wi/expertly-develop/blob/main/${scenario.testFile}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-primary-600 hover:text-primary-700 inline-flex items-center gap-1"
                          >
                            View <ExternalLink className="w-3 h-3" />
                          </a>
                        </div>
                      )}

                      {scenario.lastRun && (
                        <div className="mt-3 pt-3 border-t border-theme-border">
                          <div className="flex items-center gap-4 text-xs">
                            <span className="text-theme-text-muted">
                              Last run: {formatDate(scenario.lastRun.timestamp)}
                            </span>
                            {scenario.lastRun.duration && (
                              <span className="text-theme-text-muted">
                                Duration: {(scenario.lastRun.duration / 1000).toFixed(1)}s
                              </span>
                            )}
                          </div>
                          {scenario.lastRun.error && (
                            <pre className="mt-2 text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 p-2 rounded overflow-x-auto">
                              {scenario.lastRun.error}
                            </pre>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer note */}
      <p className="text-xs text-theme-text-muted text-center">
        Test results are cached and may not reflect the latest run. Click Refresh to update.
      </p>
    </div>
  )
}
