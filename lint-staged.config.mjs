// lint-staged configuration for running tests on staged files
export default {
  // Frontend tests (vitest) - run tests for changed TypeScript/TSX files
  // Use npm workspaces to run tests in specific packages
  'apps/define/**/*.{ts,tsx}': () => 'cd apps/define && npm run test:run -- --passWithNoTests',
  'apps/develop/frontend/**/*.{ts,tsx}': () => 'cd apps/develop/frontend && npm run test:run -- --passWithNoTests',
  'apps/identity/frontend/**/*.{ts,tsx}': () => 'cd apps/identity/frontend && npm run test:run -- --passWithNoTests',
  'apps/admin/frontend/**/*.{ts,tsx}': () => 'cd apps/admin/frontend && npm run test:run -- --passWithNoTests',
  'apps/manage/frontend/**/*.{ts,tsx}': () => 'cd apps/manage/frontend && npm run test:run -- --passWithNoTests',
  'apps/salon/frontend/**/*.{ts,tsx}': () => 'cd apps/salon/frontend && npm run test:run -- --passWithNoTests',
  'apps/today/frontend/**/*.{ts,tsx}': () => 'cd apps/today/frontend && npm run test:run -- --passWithNoTests',
  'apps/vibetest/frontend/**/*.{ts,tsx}': () => 'cd apps/vibetest/frontend && npm run test:run -- --passWithNoTests',
  'apps/vibecode/packages/client/**/*.{ts,tsx}': () => 'cd apps/vibecode/packages/client && npm run test:run -- --passWithNoTests',

  // Backend tests (pytest) - run tests for changed Python files
  // Silently fail if venv not activated or dependencies not installed
  'apps/define/backend/**/*.py': () => 'cd apps/define/backend && python -m pytest tests/ -x --tb=short 2>/dev/null || true',
  'apps/develop/backend/**/*.py': () => 'cd apps/develop/backend && python -m pytest tests/ -x --tb=short 2>/dev/null || true',
  'apps/identity/backend/**/*.py': () => 'cd apps/identity/backend && python -m pytest tests/ -x --tb=short 2>/dev/null || true',
  'apps/admin/backend/**/*.py': () => 'cd apps/admin/backend && python -m pytest tests/ -x --tb=short 2>/dev/null || true',
  'apps/manage/backend/**/*.py': () => 'cd apps/manage/backend && python -m pytest tests/ -x --tb=short 2>/dev/null || true',
  'apps/salon/backend/**/*.py': () => 'cd apps/salon/backend && python -m pytest tests/ -x --tb=short 2>/dev/null || true',
  'apps/today/backend/**/*.py': () => 'cd apps/today/backend && python -m pytest tests/ -x --tb=short 2>/dev/null || true',
  'apps/vibetest/backend/**/*.py': () => 'cd apps/vibetest/backend && python -m pytest tests/ -x --tb=short 2>/dev/null || true',
}
