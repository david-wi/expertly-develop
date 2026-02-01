export type TestCategory = 'smoke' | 'integration' | 'e2e' | 'unit'

export type TestRunStatus = 'passed' | 'failed' | 'skipped' | 'running'

export interface TestStepDefinition {
  step_number: number
  description: string
  expected_outcome?: string
}

export interface TestStepResult {
  step_number: number
  status: TestRunStatus
  duration_ms?: number
  error?: string
}

export interface TestRun {
  id: string
  scenario_id: string
  status: TestRunStatus
  duration_ms: number | null
  failed_step: number | null
  error_message: string | null
  error_stack: string | null
  step_results: TestStepResult[] | null
  environment: string | null
  run_id: string | null
  started_at: string | null
  completed_at: string | null
  created_at: string
}

export interface TestScenario {
  id: string
  scenario_key: string
  name: string
  description: string | null
  app_name: string
  category: TestCategory
  test_file: string | null
  steps: TestStepDefinition[] | null
  is_active: boolean
  created_at: string
  updated_at: string
  latest_run: TestRun | null
}

export interface TestScenarioCreate {
  scenario_key: string
  name: string
  description?: string
  app_name: string
  category?: TestCategory
  test_file?: string
  steps?: TestStepDefinition[]
  is_active?: boolean
}

export interface TestScenarioUpdate {
  name?: string
  description?: string
  app_name?: string
  category?: TestCategory
  test_file?: string
  steps?: TestStepDefinition[]
  is_active?: boolean
}

export interface TestScenarioListResponse {
  scenarios: TestScenario[]
  total: number
}

export interface TestRunCreate {
  scenario_key: string
  status: TestRunStatus
  duration_ms?: number
  failed_step?: number
  error_message?: string
  error_stack?: string
  step_results?: TestStepResult[]
  environment?: string
  run_id?: string
  started_at?: string
  completed_at?: string
}

export interface TestRunListResponse {
  runs: TestRun[]
  total: number
}

export interface AppScenarioCount {
  app_name: string
  count: number
}

export interface CategoryScenarioCount {
  category: string
  count: number
}

export interface TestScenarioStats {
  total_scenarios: number
  active_scenarios: number
  by_app: AppScenarioCount[]
  by_category: CategoryScenarioCount[]
  run_stats: Record<string, number>
}

export interface TestScenarioFilters {
  app_name?: string
  category?: TestCategory
  is_active?: boolean
  skip?: number
  limit?: number
}
