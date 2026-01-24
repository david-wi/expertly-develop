# Frontend Testing

## Current Test Coverage

### Unit/Integration Tests (Vitest + React Testing Library)

**Well-Tested (90-100% coverage):**
- `src/components/common/Button.tsx` - All variants, sizes, loading states
- `src/components/common/Badge.tsx` - All variants, status badges, priority badges
- `src/components/common/Card.tsx` - All props and compositions
- `src/components/dashboard/TaskList.tsx` - Rendering, empty states, links
- `src/pages/Login.tsx` - Form validation, submission, navigation
- `src/stores/appStore.ts` - Auth state, sidebar toggle, persistence

**Partially Tested (30-60% coverage):**
- `src/services/api.ts` - Core CRUD operations tested via MSW mocks
- `src/hooks/useTasks.ts` - Query hooks tested
- `src/hooks/useQuestions.ts` - Query and mutation hooks tested

### Running Tests

```bash
# Run tests in watch mode
npm test

# Run tests once
npm run test:run

# Run with coverage report
npm run test:coverage
```

---

## E2E Testing Needed

The following components require E2E testing (Playwright or Cypress recommended):

### Pages

1. **Dashboard (`src/pages/Dashboard.tsx`)**
   - Load dashboard with real API data
   - Display today's priorities
   - Show unanswered questions
   - Show Claude's current task status
   - Navigate to task details

2. **Tasks (`src/pages/Tasks.tsx`)**
   - List tasks with filtering by status
   - Create new task via form
   - Update task status (start, complete, cancel)
   - Delete task with confirmation
   - Navigate to task detail view

### Layout Components

3. **Sidebar (`src/components/layout/Sidebar.tsx`)**
   - Navigation between pages
   - Active route highlighting
   - Sidebar collapse/expand on mobile
   - Logout functionality

4. **Header (`src/components/layout/Header.tsx`)**
   - User info display
   - Sidebar toggle button
   - Responsive behavior

5. **Layout (`src/components/layout/Layout.tsx`)**
   - Protected route behavior (redirect to login if not authenticated)
   - Render sidebar + header + content correctly

### Dashboard Components

6. **QuestionsList (`src/components/dashboard/QuestionsList.tsx`)**
   - Display unanswered questions
   - Answer question flow
   - Dismiss question flow
   - Empty state

7. **ClaudeWorkingStatus (`src/components/dashboard/ClaudeWorkingStatus.tsx`)**
   - Show current working task
   - Show idle state when no task

### Real-time Features

8. **WebSocket (`src/services/websocket.ts` + `src/hooks/useWebSocket.ts`)**
   - Connect to WebSocket on auth
   - Receive real-time task updates
   - Receive real-time question updates
   - Handle reconnection on disconnect
   - Invalidate React Query cache on events

### Auth Flow

9. **Full Authentication Flow**
   - Login with valid API key
   - Persist session across page refresh
   - Logout clears session
   - Redirect to login when session expires

---

## E2E Test Setup (TODO)

When implementing E2E tests:

1. Install Playwright:
   ```bash
   npm install -D @playwright/test
   npx playwright install
   ```

2. Create `playwright.config.ts` with:
   - Base URL pointing to dev server
   - API mocking or test database
   - Screenshot on failure

3. Create test fixtures for:
   - Authenticated user state
   - Mock API responses
   - Test data seeding

4. Suggested test file structure:
   ```
   e2e/
   ├── auth.spec.ts        # Login/logout flows
   ├── dashboard.spec.ts   # Dashboard functionality
   ├── tasks.spec.ts       # Task CRUD operations
   ├── questions.spec.ts   # Question answer/dismiss
   └── websocket.spec.ts   # Real-time updates
   ```
