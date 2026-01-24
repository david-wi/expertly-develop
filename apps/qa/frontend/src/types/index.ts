// Auth types
export interface Organization {
  id: string
  name: string
  slug: string
  is_active: boolean
  created_at: string
}

export interface User {
  id: string
  email: string
  full_name: string
  role: 'owner' | 'admin' | 'member' | 'viewer'
  is_active: boolean
  is_verified: boolean
  created_at: string
  organization: Organization
}

export interface AuthTokens {
  access_token: string
  refresh_token: string
  token_type: string
}

// Project types
export interface Project {
  id: string
  name: string
  description: string | null
  settings: Record<string, unknown>
  status: 'active' | 'archived'
  created_at: string
  updated_at: string
  stats?: ProjectStats
  environments?: Environment[]
  recent_runs?: TestRun[]
}

export interface ProjectStats {
  total_tests: number
  approved_tests: number
  draft_tests: number
  total_runs: number
  passed_runs: number
  failed_runs: number
}

export interface Environment {
  id: string
  project_id: string
  name: string
  type: 'staging' | 'production' | 'qa' | 'development'
  base_url: string
  is_default: boolean
  notes: string | null
  created_at: string
  updated_at: string
}

export interface TestStep {
  action: 'navigate' | 'click' | 'type' | 'select' | 'wait' | 'verify' | 'screenshot'
  selector?: string
  value?: string
  expected?: string
  timeout?: number
}

export interface TestCase {
  id: string
  project_id: string
  title: string
  description: string | null
  preconditions: string | null
  steps: TestStep[]
  expected_results: string | null
  tags: string[]
  priority: 'critical' | 'high' | 'medium' | 'low'
  status: 'draft' | 'approved' | 'archived'
  execution_type: 'manual' | 'browser' | 'api' | 'visual'
  automation_config: Record<string, unknown> | null
  created_by: 'human' | 'ai'
  approved_by: string | null
  approved_at: string | null
  created_at: string
  updated_at: string
}

export interface TestSuite {
  id: string
  project_id: string
  name: string
  description: string | null
  type: 'smoke' | 'regression' | 'critical' | 'custom'
  test_case_ids: string[]
  created_at: string
  updated_at: string
}

export interface RunSummary {
  total: number
  passed: number
  failed: number
  skipped: number
  duration_ms?: number
}

export interface TestRun {
  id: string
  project_id: string
  environment_id: string | null
  suite_id: string | null
  name: string | null
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled'
  started_at: string | null
  completed_at: string | null
  summary: RunSummary | null
  triggered_by: 'manual' | 'schedule' | 'webhook'
  created_at: string
  updated_at: string
  results?: TestResult[]
  environment?: Environment
}

export interface StepResult {
  step: TestStep
  status: 'passed' | 'failed' | 'skipped'
  duration_ms: number
  error?: string
  screenshot_path?: string
}

export interface AIAnalysis {
  summary: string
  likely_root_cause: string
  suggested_fix: string
  confidence: number
}

export interface Artifact {
  id: string
  type: string
  file_path: string
}

export interface TestResult {
  id: string
  run_id: string
  test_case_id: string
  test_case_title?: string
  status: 'pending' | 'running' | 'passed' | 'failed' | 'skipped' | 'error'
  duration_ms: number | null
  error_message: string | null
  steps_executed: StepResult[] | null
  ai_analysis: AIAnalysis | null
  artifacts: Artifact[]
  created_at: string
  updated_at: string
}

export interface QuickStartSession {
  id: string
  url: string
  status: 'pending' | 'exploring' | 'generating' | 'completed' | 'failed'
  progress: number
  progress_message: string | null
  results: QuickStartResults | null
  project_id: string | null
  created_at: string
  updated_at: string
}

export interface PageInfo {
  url: string
  title: string
  screenshot_path: string
  links_count: number
  forms_count: number
  buttons_count: number
  errors_count: number
  load_time_ms: number
}

export interface SuggestedTest {
  title: string
  description: string
  preconditions: string
  steps: TestStep[]
  expected_results: string
  priority: string
  tags: string[]
  execution_type: string
}

export interface Issue {
  url: string
  type: string
  message: string
  severity: 'error' | 'warning' | 'info'
}

export interface QuickStartResults {
  pages_explored: number
  pages: PageInfo[]
  suggested_tests: SuggestedTest[]
  issues: Issue[]
  ai_available: boolean
}
