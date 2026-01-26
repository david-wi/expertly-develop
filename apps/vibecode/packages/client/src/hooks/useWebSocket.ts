import { useEffect, useRef, useCallback } from 'react';
import { useDashboardStore, type ExecutionMode, type ChatMessage, type ImageAttachment } from '../store/dashboard-store';

const WS_URL = import.meta.env.DEV
  ? 'ws://localhost:3001'
  : `ws://${window.location.host}`;

export function useWebSocket() {
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<number | null>(null);
  const hasConnectedOnceRef = useRef(false);

  const {
    sessions,
    setConnected,
    setAgents,
    addSession,
    updateSessionState,
    updateSessionExecutionMode,
    addMessage,
    markAllSessionsDisconnected,
    getSessionIds,
    getNextQueuedMessage,
    removeQueuedMessage,
    addChatMessage,
    setChatState,
  } = useDashboardStore();

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    console.log('[WS] Connecting to', WS_URL);
    const ws = new WebSocket(WS_URL);

    ws.onopen = () => {
      console.log('[WS] Connected');
      // Request list of existing sessions from server
      ws.send(JSON.stringify({ type: 'list_sessions' }));

      // Try to resubscribe to persisted sessions (from localStorage)
      // This handles both reconnection and initial page load with persisted state
      const persistedSessionIds = getSessionIds();
      if (persistedSessionIds.length > 0) {
        console.log('[WS] Resubscribing to persisted sessions:', persistedSessionIds);
        for (const sessionId of persistedSessionIds) {
          ws.send(JSON.stringify({ type: 'subscribe', sessionId }));
        }
      }
      hasConnectedOnceRef.current = true;
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        console.log('[WS] Received:', data.type);

        switch (data.type) {
          case 'connected':
            setConnected(true, data.clientId, {
              defaultExecutionMode: data.defaultExecutionMode || 'local',
              remoteAvailable: data.remoteAvailable || false,
              hasLocalAgent: data.hasLocalAgent || false,
            });
            break;

          case 'agent_status':
            // Update agent status and details
            setAgents(data.agents || []);
            break;

          case 'agent_metrics':
            // Update agent metrics
            setAgents(data.agents || []);
            break;

          case 'tool_queued':
            // Tool was queued by agent - could show notification
            console.log('[WS] Tool queued:', data.sessionId, 'position:', data.queuePosition, 'reason:', data.reason);
            break;

          case 'session_created':
            addSession({
              id: data.sessionId,
              name: data.name,
              cwd: data.cwd || '',
              state: 'idle',
              executionMode: data.executionMode || 'local',
              messages: [],
              queuedMessages: [],
            });
            break;

          case 'sessions_list':
            for (const session of data.sessions) {
              addSession({
                id: session.id,
                name: session.name,
                cwd: session.cwd || '',
                state: session.state,
                executionMode: session.executionMode || 'local',
                messages: [],
                queuedMessages: [],
              });
            }
            break;

          case 'session_state': {
            // When resubscribing, preserve local messages if server has fewer
            const existingSession = useDashboardStore.getState().sessions[data.sessionId];
            const serverMessages = data.messages || [];
            const localMessages = existingSession?.messages || [];
            // Use whichever has more messages (preserves local history if server restarted)
            const messages = localMessages.length > serverMessages.length ? localMessages : serverMessages;

            addSession({
              id: data.sessionId,
              name: data.name,
              cwd: data.cwd || '',
              state: data.state,
              executionMode: data.executionMode || 'local',
              messages,
              queuedMessages: existingSession?.queuedMessages || [],
            });
            break;
          }

          case 'message':
            console.log('[WS] Message received for session:', data.sessionId, data.message);
            addMessage(data.sessionId, data.message);
            break;

          case 'state_changed':
            updateSessionState(data.sessionId, data.state);

            // Process queue when session becomes idle
            if (data.state === 'idle') {
              const queuedMessage = getNextQueuedMessage(data.sessionId);
              if (queuedMessage) {
                console.log('[WS] Processing queued message:', queuedMessage.content.substring(0, 50));
                // Remove from queue
                removeQueuedMessage(data.sessionId, queuedMessage.id);
                // Add as user message
                addMessage(data.sessionId, {
                  id: `local-${Date.now()}`,
                  role: 'user',
                  content: queuedMessage.content,
                  timestamp: Date.now(),
                });
                // Send to server
                if (wsRef.current?.readyState === WebSocket.OPEN) {
                  wsRef.current.send(JSON.stringify({
                    type: 'chat',
                    sessionId: data.sessionId,
                    content: queuedMessage.content,
                  }));
                }
              }
            }
            break;

          case 'execution_mode_changed':
            updateSessionExecutionMode(data.sessionId, data.executionMode);
            break;

          case 'session_closed':
            updateSessionState(data.sessionId, 'disconnected');
            break;

          case 'error':
            console.error('[WS] Server error:', data.error);
            if (data.sessionId) {
              updateSessionState(data.sessionId, 'error');
            }
            break;

          // Chat widget message handlers
          case 'chat_message':
            console.log('[WS] Chat message received for conversation:', data.conversationId);
            addChatMessage(data.conversationId, data.message);
            break;

          case 'chat_state_changed':
            setChatState(data.conversationId, data.state);
            break;
        }
      } catch (error) {
        console.error('[WS] Error parsing message:', error);
      }
    };

    ws.onclose = () => {
      console.log('[WS] Disconnected');
      setConnected(false);
      markAllSessionsDisconnected();

      // Attempt to reconnect
      reconnectTimeoutRef.current = window.setTimeout(() => {
        connect();
      }, 3000);
    };

    ws.onerror = (error) => {
      console.error('[WS] Error:', error);
    };

    wsRef.current = ws;
  }, [setConnected, setAgents, addSession, updateSessionState, updateSessionExecutionMode, addMessage, markAllSessionsDisconnected, getSessionIds, getNextQueuedMessage, removeQueuedMessage, addChatMessage, setChatState]);

  useEffect(() => {
    connect();

    // Warn user if navigating away while sessions are busy
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      const currentSessions = useDashboardStore.getState().sessions;
      const hasBusySession = Object.values(currentSessions).some(
        s => s.state === 'busy' || s.state === 'waiting'
      );

      if (hasBusySession) {
        e.preventDefault();
        // Modern browsers ignore custom messages, but we set one anyway
        e.returnValue = 'You have active sessions. Are you sure you want to leave?';
        return e.returnValue;
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [connect]);

  const send = useCallback((message: object) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message));
    } else {
      console.warn('[WS] Cannot send - not connected');
    }
  }, []);

  const createSession = useCallback((options: {
    cwd?: string;
    name?: string;
    prompt?: string;
    executionMode?: ExecutionMode;
    widgetId?: string;
  }) => {
    send({
      type: 'create_session',
      ...options,
    });
  }, [send]);

  const sendMessage = useCallback((sessionId: string, content: string) => {
    send({
      type: 'chat',
      sessionId,
      content,
    });
  }, [send]);

  const interruptSession = useCallback((sessionId: string) => {
    send({
      type: 'interrupt',
      sessionId,
    });
  }, [send]);

  const subscribeToSession = useCallback((sessionId: string) => {
    send({
      type: 'subscribe',
      sessionId,
    });
  }, [send]);

  const setExecutionMode = useCallback((sessionId: string, executionMode: ExecutionMode) => {
    send({
      type: 'set_execution_mode',
      sessionId,
      executionMode,
    });
  }, [send]);

  const closeSession = useCallback((sessionId: string) => {
    send({
      type: 'close_session',
      sessionId,
    });
  }, [send]);

  const sendDirectChat = useCallback((conversationId: string, content: string, history: ChatMessage[], images?: ImageAttachment[]) => {
    send({
      type: 'direct_chat',
      conversationId,
      content,
      history,
      images,
    });
  }, [send]);

  return {
    send,
    createSession,
    sendMessage,
    interruptSession,
    subscribeToSession,
    setExecutionMode,
    closeSession,
    sendDirectChat,
  };
}
