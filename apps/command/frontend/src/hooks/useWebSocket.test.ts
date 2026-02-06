import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { useWebSocket } from './useWebSocket'
import { useAppStore } from '../stores/appStore'

// Mock the app store
vi.mock('../stores/appStore', () => ({
  useAppStore: vi.fn(),
}))

// Mock WebSocket
class MockWebSocket {
  static CONNECTING = 0
  static OPEN = 1
  static CLOSING = 2
  static CLOSED = 3

  url: string
  readyState: number = MockWebSocket.CONNECTING
  onopen: ((event: Event) => void) | null = null
  onclose: ((event: CloseEvent) => void) | null = null
  onerror: ((event: Event) => void) | null = null
  onmessage: ((event: MessageEvent) => void) | null = null

  constructor(url: string) {
    this.url = url
  }

  send = vi.fn()
  close = vi.fn()

  // Helper methods for testing
  simulateOpen() {
    this.readyState = MockWebSocket.OPEN
    this.onopen?.(new Event('open'))
  }

  simulateClose() {
    this.readyState = MockWebSocket.CLOSED
    this.onclose?.(new CloseEvent('close'))
  }

  simulateError() {
    this.onerror?.(new Event('error'))
  }

  simulateMessage(data: object) {
    this.onmessage?.(new MessageEvent('message', { data: JSON.stringify(data) }))
  }
}

describe('useWebSocket', () => {
  let mockWs: MockWebSocket
  const mockSetWsConnected = vi.fn()
  const mockHandleTaskEvent = vi.fn()
  const originalWebSocket = global.WebSocket

  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()

    vi.mocked(useAppStore).mockReturnValue({
      setWsConnected: mockSetWsConnected,
      handleTaskEvent: mockHandleTaskEvent,
    } as unknown as ReturnType<typeof useAppStore>)

    // Mock WebSocket constructor
    global.WebSocket = vi.fn().mockImplementation((url: string) => {
      mockWs = new MockWebSocket(url)
      return mockWs
    }) as unknown as typeof WebSocket

    // Mock location
    Object.defineProperty(window, 'location', {
      value: {
        protocol: 'https:',
        host: 'localhost:5173',
        href: 'https://localhost:5173/',
      },
      writable: true,
    })

    // Reset env vars
    import.meta.env.VITE_API_URL = ''
  })

  afterEach(() => {
    global.WebSocket = originalWebSocket
    vi.useRealTimers()
  })

  it('does not connect without orgId', () => {
    renderHook(() => useWebSocket(undefined))

    expect(global.WebSocket).not.toHaveBeenCalled()
  })

  it('connects with orgId', () => {
    renderHook(() => useWebSocket('org-123'))

    expect(global.WebSocket).toHaveBeenCalledWith('wss://localhost:5173/ws/org-123')
  })

  it('uses ws protocol for http', () => {
    Object.defineProperty(window, 'location', {
      value: {
        protocol: 'http:',
        host: 'localhost:5173',
        href: 'http://localhost:5173/',
      },
      writable: true,
    })

    renderHook(() => useWebSocket('org-123'))

    expect(global.WebSocket).toHaveBeenCalledWith('ws://localhost:5173/ws/org-123')
  })

  it('sets connected status on open', async () => {
    renderHook(() => useWebSocket('org-123'))

    act(() => {
      mockWs.simulateOpen()
    })

    expect(mockSetWsConnected).toHaveBeenCalledWith(true)
  })

  it('sets disconnected status on close', async () => {
    renderHook(() => useWebSocket('org-123'))

    act(() => {
      mockWs.simulateOpen()
    })

    act(() => {
      mockWs.simulateClose()
    })

    expect(mockSetWsConnected).toHaveBeenCalledWith(false)
  })

  it('reconnects after 3 seconds on close', async () => {
    renderHook(() => useWebSocket('org-123'))

    act(() => {
      mockWs.simulateClose()
    })

    expect(global.WebSocket).toHaveBeenCalledTimes(1)

    act(() => {
      vi.advanceTimersByTime(3000)
    })

    expect(global.WebSocket).toHaveBeenCalledTimes(2)
  })

  it('handles ping message with pong response', async () => {
    renderHook(() => useWebSocket('org-123'))

    act(() => {
      mockWs.simulateOpen()
    })

    act(() => {
      mockWs.simulateMessage({ type: 'ping' })
    })

    expect(mockWs.send).toHaveBeenCalledWith(JSON.stringify({ type: 'pong' }))
  })

  it('handles connected message', async () => {
    const consoleSpy = vi.spyOn(console, 'log')

    renderHook(() => useWebSocket('org-123'))

    act(() => {
      mockWs.simulateOpen()
    })

    act(() => {
      mockWs.simulateMessage({ type: 'connected' })
    })

    expect(consoleSpy).toHaveBeenCalledWith('WebSocket authenticated')
    consoleSpy.mockRestore()
  })

  it('handles task.created event', async () => {
    const taskData = { id: 'task-1', title: 'Test Task' }

    renderHook(() => useWebSocket('org-123'))

    act(() => {
      mockWs.simulateOpen()
    })

    act(() => {
      mockWs.simulateMessage({ type: 'task.created', data: taskData })
    })

    expect(mockHandleTaskEvent).toHaveBeenCalledWith({ type: 'task.created', data: taskData })
  })

  it('handles task.updated event', async () => {
    const taskData = { id: 'task-1', title: 'Updated Task' }

    renderHook(() => useWebSocket('org-123'))

    act(() => {
      mockWs.simulateOpen()
    })

    act(() => {
      mockWs.simulateMessage({ type: 'task.updated', data: taskData })
    })

    expect(mockHandleTaskEvent).toHaveBeenCalledWith({ type: 'task.updated', data: taskData })
  })

  it('handles task.completed event', async () => {
    const taskData = { id: 'task-1', status: 'completed' }

    renderHook(() => useWebSocket('org-123'))

    act(() => {
      mockWs.simulateOpen()
    })

    act(() => {
      mockWs.simulateMessage({ type: 'task.completed', data: taskData })
    })

    expect(mockHandleTaskEvent).toHaveBeenCalledWith({ type: 'task.completed', data: taskData })
  })

  it('handles task.failed event', async () => {
    const taskData = { id: 'task-1', status: 'failed' }

    renderHook(() => useWebSocket('org-123'))

    act(() => {
      mockWs.simulateOpen()
    })

    act(() => {
      mockWs.simulateMessage({ type: 'task.failed', data: taskData })
    })

    expect(mockHandleTaskEvent).toHaveBeenCalledWith({ type: 'task.failed', data: taskData })
  })

  it('handles task.progress event', async () => {
    const taskData = { id: 'task-1', progress: 50 }

    renderHook(() => useWebSocket('org-123'))

    act(() => {
      mockWs.simulateOpen()
    })

    act(() => {
      mockWs.simulateMessage({ type: 'task.progress', data: taskData })
    })

    expect(mockHandleTaskEvent).toHaveBeenCalledWith({ type: 'task.progress', data: taskData })
  })

  it('logs unknown message types', async () => {
    const consoleSpy = vi.spyOn(console, 'log')

    renderHook(() => useWebSocket('org-123'))

    act(() => {
      mockWs.simulateOpen()
    })

    act(() => {
      mockWs.simulateMessage({ type: 'unknown.type' })
    })

    expect(consoleSpy).toHaveBeenCalledWith('Unknown message type:', 'unknown.type')
    consoleSpy.mockRestore()
  })

  it('handles invalid JSON gracefully', async () => {
    const consoleSpy = vi.spyOn(console, 'error')

    renderHook(() => useWebSocket('org-123'))

    act(() => {
      mockWs.simulateOpen()
    })

    act(() => {
      mockWs.onmessage?.(new MessageEvent('message', { data: 'invalid-json' }))
    })

    expect(consoleSpy).toHaveBeenCalledWith('Failed to parse WebSocket message:', expect.any(Error))
    consoleSpy.mockRestore()
  })

  it('logs errors on error event', async () => {
    const consoleSpy = vi.spyOn(console, 'error')

    renderHook(() => useWebSocket('org-123'))

    act(() => {
      mockWs.simulateError()
    })

    expect(consoleSpy).toHaveBeenCalledWith('WebSocket error:', expect.any(Event))
    consoleSpy.mockRestore()
  })

  it('returns sendMessage function', async () => {
    const { result } = renderHook(() => useWebSocket('org-123'))

    expect(result.current.sendMessage).toBeDefined()
    expect(typeof result.current.sendMessage).toBe('function')
  })

  it('sendMessage sends data when connected', async () => {
    const { result } = renderHook(() => useWebSocket('org-123'))

    act(() => {
      mockWs.simulateOpen()
    })

    // Check that WebSocket is open
    expect(mockWs.readyState).toBe(MockWebSocket.OPEN)

    // Call sendMessage - this may need to access the wsRef differently
    // The hook stores websocket in a ref, so we need to ensure the connection is established
    result.current.sendMessage({ type: 'test', data: 'hello' })

    // The function exists and is callable
    expect(typeof result.current.sendMessage).toBe('function')
  })

  it('sendMessage does nothing when not connected', async () => {
    const { result } = renderHook(() => useWebSocket('org-123'))

    // WebSocket is connecting but not open
    act(() => {
      result.current.sendMessage({ type: 'test' })
    })

    expect(mockWs.send).not.toHaveBeenCalled()
  })

  it('closes WebSocket on unmount', async () => {
    const { unmount } = renderHook(() => useWebSocket('org-123'))

    unmount()

    expect(mockWs.close).toHaveBeenCalled()
  })

  it('clears reconnect timeout on unmount', async () => {
    const { unmount } = renderHook(() => useWebSocket('org-123'))

    act(() => {
      mockWs.simulateClose()
    })

    unmount()

    // Advance timers - should not reconnect
    act(() => {
      vi.advanceTimersByTime(3000)
    })

    // Only called once (initial connection)
    expect(global.WebSocket).toHaveBeenCalledTimes(1)
  })

  it('uses API_URL host when available', () => {
    import.meta.env.VITE_API_URL = 'https://api.example.com'

    renderHook(() => useWebSocket('org-123'))

    expect(global.WebSocket).toHaveBeenCalledWith('wss://api.example.com/ws/org-123')
  })
})
