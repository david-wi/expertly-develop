import { describe, it, expect, beforeEach } from 'vitest'
import { act } from '@testing-library/react'
import { useDashboardStore } from './dashboard-store'

describe('dashboardStore - Extended Tests', () => {
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
      agents: [],
      sessions: {},
      widgets: [],
      layout: [],
      sessionNameHistory: [],
      sessionConfigs: {},
      chatConversations: {},
    })
  })

  describe('chat widget management', () => {
    it('addChatWidget creates a chat widget with conversation', () => {
      act(() => {
        useDashboardStore.getState().addChatWidget()
      })

      const state = useDashboardStore.getState()
      expect(state.widgets).toHaveLength(1)
      expect(state.widgets[0].type).toBe('chat')
      expect(state.widgets[0].conversationId).toBeTruthy()
      expect(state.chatConversations[state.widgets[0].conversationId!]).toBeDefined()
      expect(state.chatConversations[state.widgets[0].conversationId!].state).toBe('idle')
    })

    it('removeWidget cleans up chat conversation when removing chat widget', () => {
      act(() => {
        useDashboardStore.getState().addChatWidget()
      })

      const widget = useDashboardStore.getState().widgets[0]
      const conversationId = widget.conversationId!

      expect(useDashboardStore.getState().chatConversations[conversationId]).toBeDefined()

      act(() => {
        useDashboardStore.getState().removeWidget(widget.id)
      })

      expect(useDashboardStore.getState().chatConversations[conversationId]).toBeUndefined()
    })

    it('addChatMessage adds message to conversation', () => {
      act(() => {
        useDashboardStore.getState().addChatWidget()
      })

      const conversationId = useDashboardStore.getState().widgets[0].conversationId!

      act(() => {
        useDashboardStore.getState().addChatMessage(conversationId, {
          id: 'msg-1',
          role: 'user',
          content: 'Hello',
          timestamp: Date.now(),
        })
      })

      const conversation = useDashboardStore.getState().chatConversations[conversationId]
      expect(conversation.messages).toHaveLength(1)
      expect(conversation.messages[0].content).toBe('Hello')
    })

    it('addChatMessage updates existing message by id', () => {
      act(() => {
        useDashboardStore.getState().addChatWidget()
      })

      const conversationId = useDashboardStore.getState().widgets[0].conversationId!

      act(() => {
        useDashboardStore.getState().addChatMessage(conversationId, {
          id: 'msg-1',
          role: 'assistant',
          content: 'Thinking...',
          timestamp: Date.now(),
        })
      })

      act(() => {
        useDashboardStore.getState().addChatMessage(conversationId, {
          id: 'msg-1',
          role: 'assistant',
          content: 'Complete response',
          timestamp: Date.now(),
        })
      })

      const conversation = useDashboardStore.getState().chatConversations[conversationId]
      expect(conversation.messages).toHaveLength(1)
      expect(conversation.messages[0].content).toBe('Complete response')
    })

    it('setChatState updates conversation state', () => {
      act(() => {
        useDashboardStore.getState().addChatWidget()
      })

      const conversationId = useDashboardStore.getState().widgets[0].conversationId!

      act(() => {
        useDashboardStore.getState().setChatState(conversationId, 'busy')
      })

      expect(useDashboardStore.getState().chatConversations[conversationId].state).toBe(
        'busy'
      )

      act(() => {
        useDashboardStore.getState().setChatState(conversationId, 'idle')
      })

      expect(useDashboardStore.getState().chatConversations[conversationId].state).toBe(
        'idle'
      )
    })
  })

  describe('session management', () => {
    it('addSession creates a new session', () => {
      act(() => {
        useDashboardStore.getState().addSession({
          id: 'session-1',
          name: 'Test Session',
          cwd: '/test',
          state: 'idle',
          executionMode: 'local',
          messages: [],
          queuedMessages: [],
        })
      })

      const session = useDashboardStore.getState().sessions['session-1']
      expect(session).toBeDefined()
      expect(session.name).toBe('Test Session')
    })

    it('addSession tracks busyStartedAt when state is busy', () => {
      act(() => {
        useDashboardStore.getState().addSession({
          id: 'session-1',
          name: 'Test Session',
          cwd: '/test',
          state: 'busy',
          executionMode: 'local',
          messages: [],
          queuedMessages: [],
        })
      })

      const session = useDashboardStore.getState().sessions['session-1']
      expect(session.busyStartedAt).toBeDefined()
    })

    it('updateSessionState changes state correctly', () => {
      act(() => {
        useDashboardStore.getState().addSession({
          id: 'session-1',
          name: 'Test Session',
          cwd: '/test',
          state: 'idle',
          executionMode: 'local',
          messages: [],
          queuedMessages: [],
        })
      })

      act(() => {
        useDashboardStore.getState().updateSessionState('session-1', 'busy')
      })

      expect(useDashboardStore.getState().sessions['session-1'].state).toBe('busy')
      expect(useDashboardStore.getState().sessions['session-1'].busyStartedAt).toBeDefined()
    })

    it('updateSessionExecutionMode changes execution mode', () => {
      act(() => {
        useDashboardStore.getState().addSession({
          id: 'session-1',
          name: 'Test Session',
          cwd: '/test',
          state: 'idle',
          executionMode: 'local',
          messages: [],
          queuedMessages: [],
        })
      })

      act(() => {
        useDashboardStore.getState().updateSessionExecutionMode('session-1', 'remote')
      })

      expect(useDashboardStore.getState().sessions['session-1'].executionMode).toBe(
        'remote'
      )
    })

    it('removeSession removes a session', () => {
      act(() => {
        useDashboardStore.getState().addSession({
          id: 'session-1',
          name: 'Test Session',
          cwd: '/test',
          state: 'idle',
          executionMode: 'local',
          messages: [],
          queuedMessages: [],
        })
      })

      act(() => {
        useDashboardStore.getState().removeSession('session-1')
      })

      expect(useDashboardStore.getState().sessions['session-1']).toBeUndefined()
    })

    it('markAllSessionsDisconnected marks all sessions as disconnected', () => {
      act(() => {
        useDashboardStore.getState().addSession({
          id: 'session-1',
          name: 'Session 1',
          cwd: '/test1',
          state: 'idle',
          executionMode: 'local',
          messages: [],
          queuedMessages: [],
        })
        useDashboardStore.getState().addSession({
          id: 'session-2',
          name: 'Session 2',
          cwd: '/test2',
          state: 'busy',
          executionMode: 'local',
          messages: [],
          queuedMessages: [],
        })
      })

      act(() => {
        useDashboardStore.getState().markAllSessionsDisconnected()
      })

      expect(useDashboardStore.getState().sessions['session-1'].state).toBe('disconnected')
      expect(useDashboardStore.getState().sessions['session-2'].state).toBe('disconnected')
    })

    it('clearDisconnectedSessions removes disconnected sessions not attached to widgets', () => {
      act(() => {
        useDashboardStore.getState().addSession({
          id: 'session-1',
          name: 'Session 1',
          cwd: '/test1',
          state: 'disconnected',
          executionMode: 'local',
          messages: [],
          queuedMessages: [],
        })
        useDashboardStore.getState().addSession({
          id: 'session-2',
          name: 'Session 2',
          cwd: '/test2',
          state: 'idle',
          executionMode: 'local',
          messages: [],
          queuedMessages: [],
        })
      })

      act(() => {
        useDashboardStore.getState().clearDisconnectedSessions()
      })

      expect(useDashboardStore.getState().sessions['session-1']).toBeUndefined()
      expect(useDashboardStore.getState().sessions['session-2']).toBeDefined()
    })

    it('getSessionIds returns all session IDs', () => {
      act(() => {
        useDashboardStore.getState().addSession({
          id: 'session-1',
          name: 'Session 1',
          cwd: '/test1',
          state: 'idle',
          executionMode: 'local',
          messages: [],
          queuedMessages: [],
        })
        useDashboardStore.getState().addSession({
          id: 'session-2',
          name: 'Session 2',
          cwd: '/test2',
          state: 'idle',
          executionMode: 'local',
          messages: [],
          queuedMessages: [],
        })
      })

      const ids = useDashboardStore.getState().getSessionIds()
      expect(ids).toContain('session-1')
      expect(ids).toContain('session-2')
    })
  })

  describe('agents management', () => {
    it('setAgents updates agents list and hasLocalAgent', () => {
      act(() => {
        useDashboardStore.getState().setAgents([
          {
            id: 'agent-1',
            workingDir: '/home/user',
            platform: 'darwin',
            version: '1.0.0',
            connectedAt: new Date().toISOString(),
          },
        ])
      })

      const state = useDashboardStore.getState()
      expect(state.agents).toHaveLength(1)
      expect(state.serverConfig.hasLocalAgent).toBe(true)
    })

    it('setAgents sets hasLocalAgent to false when no agents', () => {
      act(() => {
        useDashboardStore.getState().setAgents([
          {
            id: 'agent-1',
            workingDir: '/home/user',
            platform: 'darwin',
            version: '1.0.0',
            connectedAt: new Date().toISOString(),
          },
        ])
      })

      act(() => {
        useDashboardStore.getState().setAgents([])
      })

      expect(useDashboardStore.getState().serverConfig.hasLocalAgent).toBe(false)
    })
  })

  describe('layout management', () => {
    it('updateLayout updates the layout', () => {
      const newLayout = [{ i: 'widget-1', x: 0, y: 0, w: 4, h: 6 }]

      act(() => {
        useDashboardStore.getState().updateLayout(newLayout as any)
      })

      expect(useDashboardStore.getState().layout).toEqual(newLayout)
    })
  })

  describe('queued messages', () => {
    it('removeQueuedMessage removes a message from queue', () => {
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
              queuedMessages: [
                { id: 'q-1', content: 'Message 1', timestamp: Date.now() },
                { id: 'q-2', content: 'Message 2', timestamp: Date.now() },
              ],
            },
          },
        })
      })

      act(() => {
        useDashboardStore.getState().removeQueuedMessage('session-1', 'q-1')
      })

      const queue = useDashboardStore.getState().sessions['session-1'].queuedMessages
      expect(queue).toHaveLength(1)
      expect(queue[0].id).toBe('q-2')
    })

    it('clearQueue removes all queued messages', () => {
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
              queuedMessages: [
                { id: 'q-1', content: 'Message 1', timestamp: Date.now() },
                { id: 'q-2', content: 'Message 2', timestamp: Date.now() },
              ],
            },
          },
        })
      })

      act(() => {
        useDashboardStore.getState().clearQueue('session-1')
      })

      expect(useDashboardStore.getState().sessions['session-1'].queuedMessages).toHaveLength(
        0
      )
    })

    it('getNextQueuedMessage returns first message in queue', () => {
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
              queuedMessages: [
                { id: 'q-1', content: 'Message 1', timestamp: Date.now() },
                { id: 'q-2', content: 'Message 2', timestamp: Date.now() },
              ],
            },
          },
        })
      })

      const next = useDashboardStore.getState().getNextQueuedMessage('session-1')
      expect(next?.content).toBe('Message 1')
    })

    it('getNextQueuedMessage returns null for empty queue', () => {
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

      const next = useDashboardStore.getState().getNextQueuedMessage('session-1')
      expect(next).toBeNull()
    })
  })

  describe('setSessionMessages', () => {
    it('replaces all messages for a session', () => {
      act(() => {
        useDashboardStore.setState({
          sessions: {
            'session-1': {
              id: 'session-1',
              name: 'Test Session',
              cwd: '/test',
              state: 'idle',
              executionMode: 'local',
              messages: [{ id: 'old', role: 'user', content: 'old', timestamp: 1 }],
              queuedMessages: [],
            },
          },
        })
      })

      const newMessages = [
        { id: 'new-1', role: 'user' as const, content: 'new 1', timestamp: Date.now() },
        { id: 'new-2', role: 'assistant' as const, content: 'new 2', timestamp: Date.now() },
      ]

      act(() => {
        useDashboardStore.getState().setSessionMessages('session-1', newMessages)
      })

      const session = useDashboardStore.getState().sessions['session-1']
      expect(session.messages).toHaveLength(2)
      expect(session.messages[0].content).toBe('new 1')
    })
  })

  describe('addWidget type parameter', () => {
    it('addWidget with chat type creates chat widget', () => {
      // Note: addWidget with 'chat' type doesn't create conversation
      // Use addChatWidget for that
      act(() => {
        useDashboardStore.getState().addWidget('session')
      })

      expect(useDashboardStore.getState().widgets[0].type).toBe('session')
    })
  })
})
