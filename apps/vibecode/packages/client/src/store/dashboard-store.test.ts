import { describe, it, expect, beforeEach } from 'vitest'
import { act } from '@testing-library/react'
import { useDashboardStore } from './dashboard-store'

describe('dashboardStore', () => {
  beforeEach(() => {
    // Reset the store before each test
    useDashboardStore.setState({
      connected: false,
      clientId: null,
      serverConfig: {
        defaultExecutionMode: 'local',
        remoteAvailable: false,
        hasLocalAgent: false,
      },
      agents: {},
      sessions: {},
      widgets: [],
      layout: [],
      sessionNameHistory: [],
      sessionConfigs: {},
      chatConversations: {},
    })
  })

  describe('initial state', () => {
    it('has correct default values', () => {
      const state = useDashboardStore.getState()

      expect(state.connected).toBe(false)
      expect(state.clientId).toBeNull()
      expect(state.serverConfig.defaultExecutionMode).toBe('local')
      expect(state.serverConfig.remoteAvailable).toBe(false)
      expect(state.widgets).toEqual([])
      expect(state.sessions).toEqual({})
    })
  })

  describe('widget management', () => {
    it('addWidget creates a new widget', () => {
      act(() => {
        useDashboardStore.getState().addWidget()
      })

      const state = useDashboardStore.getState()
      expect(state.widgets).toHaveLength(1)
      expect(state.widgets[0].type).toBe('session')
      expect(state.widgets[0].minimized).toBe(false)
      expect(state.widgets[0].showStreaming).toBe(false)
    })

    it('removeWidget removes a widget by id', () => {
      act(() => {
        useDashboardStore.getState().addWidget()
      })

      const widgetId = useDashboardStore.getState().widgets[0].id

      act(() => {
        useDashboardStore.getState().removeWidget(widgetId)
      })

      expect(useDashboardStore.getState().widgets).toHaveLength(0)
    })

    it('toggleWidgetMinimized toggles minimized state', () => {
      act(() => {
        useDashboardStore.getState().addWidget()
      })

      const widgetId = useDashboardStore.getState().widgets[0].id
      expect(useDashboardStore.getState().widgets[0].minimized).toBe(false)

      act(() => {
        useDashboardStore.getState().toggleWidgetMinimized(widgetId)
      })

      expect(useDashboardStore.getState().widgets[0].minimized).toBe(true)

      act(() => {
        useDashboardStore.getState().toggleWidgetMinimized(widgetId)
      })

      expect(useDashboardStore.getState().widgets[0].minimized).toBe(false)
    })

    it('renameWidget updates widget customName', () => {
      act(() => {
        useDashboardStore.getState().addWidget()
      })

      const widgetId = useDashboardStore.getState().widgets[0].id

      act(() => {
        useDashboardStore.getState().renameWidget(widgetId, 'My Custom Widget')
      })

      expect(useDashboardStore.getState().widgets[0].customName).toBe('My Custom Widget')
    })

    it('setWidgetSession links a widget to a session', () => {
      act(() => {
        useDashboardStore.getState().addWidget()
      })

      const widgetId = useDashboardStore.getState().widgets[0].id

      act(() => {
        useDashboardStore.getState().setWidgetSession(widgetId, 'session-123')
      })

      expect(useDashboardStore.getState().widgets[0].sessionId).toBe('session-123')
    })

    it('toggleShowStreaming toggles streaming visibility', () => {
      act(() => {
        useDashboardStore.getState().addWidget()
      })

      const widgetId = useDashboardStore.getState().widgets[0].id
      expect(useDashboardStore.getState().widgets[0].showStreaming).toBe(false)

      act(() => {
        useDashboardStore.getState().toggleShowStreaming(widgetId)
      })

      expect(useDashboardStore.getState().widgets[0].showStreaming).toBe(true)
    })
  })

  describe('session name history', () => {
    it('addSessionNameToHistory adds unique names', () => {
      act(() => {
        useDashboardStore.getState().addSessionNameToHistory('My Project')
      })

      expect(useDashboardStore.getState().sessionNameHistory).toContain('My Project')

      // Adding the same name again should not duplicate
      act(() => {
        useDashboardStore.getState().addSessionNameToHistory('My Project')
      })

      const history = useDashboardStore.getState().sessionNameHistory
      expect(history.filter((n) => n === 'My Project')).toHaveLength(1)
    })

    it('addSessionNameToHistory moves existing name to front', () => {
      act(() => {
        useDashboardStore.getState().addSessionNameToHistory('First')
        useDashboardStore.getState().addSessionNameToHistory('Second')
        useDashboardStore.getState().addSessionNameToHistory('Third')
      })

      // Third should be first (most recent)
      expect(useDashboardStore.getState().sessionNameHistory[0]).toBe('Third')

      // Add First again, it should move to front
      act(() => {
        useDashboardStore.getState().addSessionNameToHistory('First')
      })

      expect(useDashboardStore.getState().sessionNameHistory[0]).toBe('First')
    })
  })

  describe('session configs', () => {
    it('saveSessionConfig stores config for a session name', () => {
      act(() => {
        useDashboardStore.getState().saveSessionConfig('My Project', '/path/to/project')
      })

      const config = useDashboardStore.getState().getSessionConfig('My Project')
      expect(config).toEqual({ cwd: '/path/to/project' })
    })

    it('getSessionConfig returns undefined for unknown session', () => {
      const config = useDashboardStore.getState().getSessionConfig('Unknown')
      expect(config).toBeUndefined()
    })
  })

  describe('messages', () => {
    it('addMessage adds a message to a session', () => {
      // First create a session
      act(() => {
        useDashboardStore.setState({
          sessions: {
            'session-1': {
              id: 'session-1',
              name: 'Test Session',
              cwd: '/test',
              state: 'idle',
              executionMode: 'local',
              messages: [],
              queuedMessages: [],
            },
          },
        })
      })

      act(() => {
        useDashboardStore.getState().addMessage('session-1', {
          id: 'msg-1',
          role: 'user',
          content: 'Hello',
          timestamp: Date.now(),
        })
      })

      const session = useDashboardStore.getState().sessions['session-1']
      expect(session.messages).toHaveLength(1)
      expect(session.messages[0].content).toBe('Hello')
    })

    it('addQueuedMessage adds a message to the queue', () => {
      act(() => {
        useDashboardStore.setState({
          sessions: {
            'session-1': {
              id: 'session-1',
              name: 'Test Session',
              cwd: '/test',
              state: 'busy',
              executionMode: 'local',
              messages: [],
              queuedMessages: [],
            },
          },
        })
      })

      act(() => {
        useDashboardStore.getState().addQueuedMessage('session-1', 'Queued message')
      })

      const session = useDashboardStore.getState().sessions['session-1']
      expect(session.queuedMessages).toHaveLength(1)
      expect(session.queuedMessages[0].content).toBe('Queued message')
    })
  })

  describe('connection state', () => {
    it('setConnected updates connection state', () => {
      act(() => {
        useDashboardStore.getState().setConnected(true, 'client-123')
      })

      expect(useDashboardStore.getState().connected).toBe(true)
      expect(useDashboardStore.getState().clientId).toBe('client-123')
    })
  })
})
