import { describe, it, expect, beforeAll, afterAll, afterEach, vi, beforeEach } from 'vitest'
import { server } from '../test/mocks/server'
import { mockTasks, mockQuestions } from '../test/mocks/handlers'

// Start server before all tests
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterAll(() => server.close())
afterEach(() => server.resetHandlers())

// We need to import the api module fresh for each test due to singleton pattern
describe('ApiService', () => {
  let api: typeof import('./api').default

  beforeEach(async () => {
    // Reset mocks
    vi.resetModules()
    // Import fresh instance
    const module = await import('./api')
    api = module.default
  })

  describe('setApiKey', () => {
    it('stores API key in localStorage', () => {
      api.setApiKey('test-api-key')
      expect(localStorage.setItem).toHaveBeenCalledWith('api_key', 'test-api-key')
    })
  })

  describe('loadApiKey', () => {
    it('loads API key from localStorage', () => {
      vi.mocked(localStorage.getItem).mockReturnValue('saved-key')
      const key = api.loadApiKey()
      expect(localStorage.getItem).toHaveBeenCalledWith('api_key')
      expect(key).toBe('saved-key')
    })

    it('returns null when no key is stored', () => {
      vi.mocked(localStorage.getItem).mockReturnValue(null)
      const key = api.loadApiKey()
      expect(key).toBeNull()
    })
  })

  describe('Tasks API', () => {
    it('getTasks returns list of tasks', async () => {
      const tasks = await api.getTasks()
      expect(tasks).toHaveLength(2)
      expect(tasks[0].title).toBe(mockTasks[0].title)
    })

    it('getTasks accepts filter params', async () => {
      const tasks = await api.getTasks({ status: 'queued', limit: 10 })
      expect(tasks).toBeDefined()
    })

    it('getTask returns single task', async () => {
      const task = await api.getTask('1')
      expect(task.id).toBe('1')
      expect(task.title).toBe('Test Task 1')
    })

    it('getNextTask returns task with context', async () => {
      const result = await api.getNextTask()
      expect(result?.task).toBeDefined()
      expect(result?.context).toBeDefined()
      expect(result?.matched_playbooks).toBeDefined()
    })

    it('createTask creates and returns new task', async () => {
      const newTask = await api.createTask({ title: 'New Task' })
      expect(newTask.title).toBe('New Task')
    })

    it('updateTask updates and returns task', async () => {
      const updated = await api.updateTask('1', { title: 'Updated Title' })
      expect(updated.title).toBe('Updated Title')
    })

    it('startTask starts task and returns updated task', async () => {
      const started = await api.startTask('1')
      expect(started.status).toBe('working')
      expect(started.started_at).toBeDefined()
    })

    it('completeTask completes task with output', async () => {
      const completed = await api.completeTask('1', 'Task completed successfully')
      expect(completed.status).toBe('completed')
      expect(completed.output).toBe('Task completed successfully')
    })

    it('deleteTask deletes task', async () => {
      // Should not throw
      await expect(api.deleteTask('1')).resolves.toBeUndefined()
    })
  })

  describe('Questions API', () => {
    it('getQuestions returns list of questions', async () => {
      const questions = await api.getQuestions()
      expect(questions).toHaveLength(1)
      expect(questions[0].text).toBe(mockQuestions[0].text)
    })

    it('getUnansweredQuestions returns only unanswered', async () => {
      const questions = await api.getUnansweredQuestions()
      expect(questions.every((q) => q.status === 'unanswered')).toBe(true)
    })

    it('answerQuestion returns answered question with unblocked tasks', async () => {
      const result = await api.answerQuestion('q1', 'The answer is 42')
      expect(result.question.status).toBe('answered')
      expect(result.question.answer).toBe('The answer is 42')
      expect(result.unblocked_task_ids).toBeDefined()
    })
  })

  describe('getDashboardData', () => {
    it('aggregates data from multiple endpoints', async () => {
      const dashboard = await api.getDashboardData()

      expect(dashboard.today_priorities).toBeDefined()
      expect(dashboard.questions_for_you).toBeDefined()
      expect(dashboard.claude_working_on).toBeDefined()
      expect(dashboard.drafts_to_review).toBeDefined()
    })
  })
})
