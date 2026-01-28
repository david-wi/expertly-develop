import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { useWebSocket } from './useWebSocket'
import { useDashboardStore } from '../store/dashboard-store'

// Mock the store module
vi.mock('../store/dashboard-store', () => ({
  useDashboardStore: Object.assign(
    vi.fn(() => ({
      sessions: {},
      setConnected: vi.fn(),
      setAgents: vi.fn(),
      addSession: vi.fn(),
      updateSessionState: vi.fn(),
      updateSessionExecutionMode: vi.fn(),
      addMessage: vi.fn(),
      markAllSessionsDisconnected: vi.fn(),
      getSessionIds: vi.fn(() => []),
      getNextQueuedMessage: vi.fn(() => null),
      removeQueuedMessage: vi.fn(),
      addChatMessage: vi.fn(),
      setChatState: vi.fn(),
    })),
    {
      getState: vi.fn(() => ({
        sessions: {},
      })),
      subscribe: vi.fn(),
    }
  ),
}))

describe('useWebSocket', () => {
  let mockWs: MockWebSocket
  let wsInstances: MockWebSocket[] = []

  class MockWebSocket {
    static CONNECTING = 0
    static OPEN = 1
    static CLOSING = 2
    static CLOSED = 3

    readyState = MockWebSocket.OPEN
    onopen: ((ev: Event) => void) | null = null
    onclose: ((ev: CloseEvent) => void) | null = null
    onmessage: ((ev: MessageEvent) => void) | null = null
    onerror: ((ev: Event) => void) | null = null

    url: string
    send = vi.fn()
    close = vi.fn()

    constructor(url: string) {
      this.url = url
      mockWs = this
      wsInstances.push(this)
      // Simulate async open
      setTimeout(() => {
        if (this.onopen) this.onopen(new Event('open'))
      }, 0)
    }
  }

  beforeEach(() => {
    vi.clearAllMocks()
    wsInstances = []
    vi.stubGlobal('WebSocket', MockWebSocket)
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('connects to WebSocket on mount', async () => {
    renderHook(() => useWebSocket())

    // Advance timers to trigger onopen
    await act(async () => {
      vi.advanceTimersByTime(100)
    })

    expect(wsInstances.length).toBe(1)
    expect(wsInstances[0].url).toContain('localhost:3001')
  })

  it('sends list_sessions on connect', async () => {
    renderHook(() => useWebSocket())

    await act(async () => {
      vi.advanceTimersByTime(100)
    })

    expect(mockWs.send).toHaveBeenCalledWith(
      JSON.stringify({ type: 'list_sessions' })
    )
  })

  it('createSession sends correct message', async () => {
    const { result } = renderHook(() => useWebSocket())

    await act(async () => {
      vi.advanceTimersByTime(100)
    })

    // Clear previous calls
    mockWs.send.mockClear()

    act(() => {
      result.current.createSession({
        name: 'Test Session',
        cwd: '/test/path',
        executionMode: 'local',
      })
    })

    expect(mockWs.send).toHaveBeenCalledWith(
      JSON.stringify({
        type: 'create_session',
        name: 'Test Session',
        cwd: '/test/path',
        executionMode: 'local',
      })
    )
  })

  it('sendMessage sends chat message', async () => {
    const { result } = renderHook(() => useWebSocket())

    await act(async () => {
      vi.advanceTimersByTime(100)
    })

    mockWs.send.mockClear()

    act(() => {
      result.current.sendMessage('session-123', 'Hello Claude')
    })

    expect(mockWs.send).toHaveBeenCalledWith(
      JSON.stringify({
        type: 'chat',
        sessionId: 'session-123',
        content: 'Hello Claude',
      })
    )
  })

  it('interruptSession sends interrupt message', async () => {
    const { result } = renderHook(() => useWebSocket())

    await act(async () => {
      vi.advanceTimersByTime(100)
    })

    mockWs.send.mockClear()

    act(() => {
      result.current.interruptSession('session-123')
    })

    expect(mockWs.send).toHaveBeenCalledWith(
      JSON.stringify({
        type: 'interrupt',
        sessionId: 'session-123',
      })
    )
  })

  it('subscribeToSession sends subscribe message', async () => {
    const { result } = renderHook(() => useWebSocket())

    await act(async () => {
      vi.advanceTimersByTime(100)
    })

    mockWs.send.mockClear()

    act(() => {
      result.current.subscribeToSession('session-123')
    })

    expect(mockWs.send).toHaveBeenCalledWith(
      JSON.stringify({
        type: 'subscribe',
        sessionId: 'session-123',
      })
    )
  })

  it('setExecutionMode sends set_execution_mode message', async () => {
    const { result } = renderHook(() => useWebSocket())

    await act(async () => {
      vi.advanceTimersByTime(100)
    })

    mockWs.send.mockClear()

    act(() => {
      result.current.setExecutionMode('session-123', 'remote')
    })

    expect(mockWs.send).toHaveBeenCalledWith(
      JSON.stringify({
        type: 'set_execution_mode',
        sessionId: 'session-123',
        executionMode: 'remote',
      })
    )
  })

  it('closeSession sends close_session message', async () => {
    const { result } = renderHook(() => useWebSocket())

    await act(async () => {
      vi.advanceTimersByTime(100)
    })

    mockWs.send.mockClear()

    act(() => {
      result.current.closeSession('session-123')
    })

    expect(mockWs.send).toHaveBeenCalledWith(
      JSON.stringify({
        type: 'close_session',
        sessionId: 'session-123',
      })
    )
  })

  it('sendDirectChat sends direct_chat message', async () => {
    const { result } = renderHook(() => useWebSocket())

    await act(async () => {
      vi.advanceTimersByTime(100)
    })

    mockWs.send.mockClear()

    const history = [
      { id: 'msg-1', role: 'user' as const, content: 'Hi', timestamp: Date.now() },
    ]

    act(() => {
      result.current.sendDirectChat('conv-123', 'Hello', history)
    })

    expect(mockWs.send).toHaveBeenCalledWith(
      JSON.stringify({
        type: 'direct_chat',
        conversationId: 'conv-123',
        content: 'Hello',
        history,
        images: undefined,
      })
    )
  })

  it('sendDirectChat includes images when provided', async () => {
    const { result } = renderHook(() => useWebSocket())

    await act(async () => {
      vi.advanceTimersByTime(100)
    })

    mockWs.send.mockClear()

    const images = [
      { id: 'img-1', data: 'base64data', mediaType: 'image/png' as const },
    ]

    act(() => {
      result.current.sendDirectChat('conv-123', 'Check this', [], images)
    })

    expect(mockWs.send).toHaveBeenCalledWith(
      expect.stringContaining('"images"')
    )
  })

  it('returns all expected functions', async () => {
    const { result } = renderHook(() => useWebSocket())

    await act(async () => {
      vi.advanceTimersByTime(100)
    })

    expect(result.current).toHaveProperty('send')
    expect(result.current).toHaveProperty('createSession')
    expect(result.current).toHaveProperty('sendMessage')
    expect(result.current).toHaveProperty('interruptSession')
    expect(result.current).toHaveProperty('subscribeToSession')
    expect(result.current).toHaveProperty('setExecutionMode')
    expect(result.current).toHaveProperty('closeSession')
    expect(result.current).toHaveProperty('sendDirectChat')
  })
})
