import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { logError, createErrorLogger } from './errorLogger'

describe('errorLogger', () => {
  // Mock fetch
  const mockFetch = vi.fn()

  beforeEach(() => {
    vi.stubGlobal('fetch', mockFetch)
    mockFetch.mockResolvedValue({ ok: true })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.clearAllMocks()
  })

  describe('logError', () => {
    it('should create correct payload with app name', async () => {
      await logError('define', 'Test error message', {
        component: 'TestComponent',
        action: 'testAction',
      })

      expect(mockFetch).toHaveBeenCalledTimes(1)
      const [url, options] = mockFetch.mock.calls[0]

      expect(url).toBe('https://admin-api.ai.devintensive.com/api/error-logs')
      expect(options.method).toBe('POST')
      expect(options.headers['Content-Type']).toBe('application/json')

      const payload = JSON.parse(options.body)
      expect(payload.app_name).toBe('define')
      expect(payload.error_message).toBe('Test error message')
      expect(payload.severity).toBe('error')
      expect(payload.additional_context.component).toBe('TestComponent')
      expect(payload.additional_context.action).toBe('testAction')
      expect(payload.occurred_at).toBeDefined()
    })

    it('should handle Error objects', async () => {
      const error = new Error('Test error with stack')
      await logError('manage', error)

      const [, options] = mockFetch.mock.calls[0]
      const payload = JSON.parse(options.body)

      expect(payload.error_message).toBe('Test error with stack')
      expect(payload.stack_trace).toBeDefined()
      expect(payload.stack_trace).toContain('Error: Test error with stack')
    })

    it('should handle string errors', async () => {
      await logError('admin', 'Simple string error')

      const [, options] = mockFetch.mock.calls[0]
      const payload = JSON.parse(options.body)

      expect(payload.error_message).toBe('Simple string error')
      expect(payload.stack_trace).toBeUndefined()
    })

    it('should handle unknown error types', async () => {
      await logError('today', { weird: 'object' })

      const [, options] = mockFetch.mock.calls[0]
      const payload = JSON.parse(options.body)

      expect(payload.error_message).toBe('[object Object]')
    })

    it('should not throw when fetch fails (fire-and-forget)', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'))

      // Should not throw
      await expect(logError('salon', 'Test error')).resolves.toBeUndefined()
    })

    it('should include additional context in payload', async () => {
      await logError('vibetest', 'Test error', {
        additionalContext: {
          userId: '123',
          requestId: 'abc-456',
        },
      })

      const [, options] = mockFetch.mock.calls[0]
      const payload = JSON.parse(options.body)

      expect(payload.additional_context.userId).toBe('123')
      expect(payload.additional_context.requestId).toBe('abc-456')
    })
  })

  describe('createErrorLogger', () => {
    it('should create logger with app name bound', async () => {
      const logger = createErrorLogger('define')

      await logger.error('Test error')

      const [, options] = mockFetch.mock.calls[0]
      const payload = JSON.parse(options.body)

      expect(payload.app_name).toBe('define')
      expect(payload.severity).toBe('error')
    })

    it('should support error severity', async () => {
      const logger = createErrorLogger('manage')

      await logger.error('Error message')

      const [, options] = mockFetch.mock.calls[0]
      const payload = JSON.parse(options.body)

      expect(payload.severity).toBe('error')
    })

    it('should support warning severity', async () => {
      const logger = createErrorLogger('manage')

      await logger.warn('Warning message')

      const [, options] = mockFetch.mock.calls[0]
      const payload = JSON.parse(options.body)

      expect(payload.severity).toBe('warning')
    })

    it('should support info severity', async () => {
      const logger = createErrorLogger('manage')

      await logger.info('Info message')

      const [, options] = mockFetch.mock.calls[0]
      const payload = JSON.parse(options.body)

      expect(payload.severity).toBe('info')
    })

    it('should pass context through to logError', async () => {
      const logger = createErrorLogger('today')

      await logger.error('Test error', {
        component: 'Dashboard',
        action: 'loadData',
      })

      const [, options] = mockFetch.mock.calls[0]
      const payload = JSON.parse(options.body)

      expect(payload.additional_context.component).toBe('Dashboard')
      expect(payload.additional_context.action).toBe('loadData')
    })
  })
})
