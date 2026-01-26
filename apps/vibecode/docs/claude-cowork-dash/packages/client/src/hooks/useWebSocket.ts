import { useEffect, useRef, useCallback } from 'react';
import { useDashboardStore } from '../store/dashboard-store';

const WS_URL = import.meta.env.DEV
  ? 'ws://localhost:3001'
  : `ws://${window.location.host}`;

export function useWebSocket() {
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<number | null>(null);
  
  const {
    setConnected,
    addSession,
    updateSessionState,
    addMessage,
    setSessionMessages,
    setWidgetSession,
  } = useDashboardStore();

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    console.log('[WS] Connecting to', WS_URL);
    const ws = new WebSocket(WS_URL);

    ws.onopen = () => {
      console.log('[WS] Connected');
      // Request list of existing sessions
      ws.send(JSON.stringify({ type: 'list_sessions' }));
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        console.log('[WS] Received:', data.type);

        switch (data.type) {
          case 'connected':
            setConnected(true, data.clientId);
            break;

          case 'session_created':
            addSession({
              id: data.sessionId,
              name: data.name,
              cwd: data.cwd || '',
              state: 'idle',
              messages: [],
            });
            break;

          case 'sessions_list':
            for (const session of data.sessions) {
              addSession({
                id: session.id,
                name: session.name,
                cwd: session.cwd || '',
                state: session.state,
                messages: [],
              });
            }
            break;

          case 'session_state':
            addSession({
              id: data.sessionId,
              name: data.name,
              cwd: data.cwd || '',
              state: data.state,
              messages: data.messages || [],
            });
            break;

          case 'message':
            addMessage(data.sessionId, data.message);
            break;

          case 'state_changed':
            updateSessionState(data.sessionId, data.state);
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
        }
      } catch (error) {
        console.error('[WS] Error parsing message:', error);
      }
    };

    ws.onclose = () => {
      console.log('[WS] Disconnected');
      setConnected(false);
      
      // Attempt to reconnect
      reconnectTimeoutRef.current = window.setTimeout(() => {
        connect();
      }, 3000);
    };

    ws.onerror = (error) => {
      console.error('[WS] Error:', error);
    };

    wsRef.current = ws;
  }, [setConnected, addSession, updateSessionState, addMessage]);

  useEffect(() => {
    connect();

    return () => {
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

  const closeSession = useCallback((sessionId: string) => {
    send({
      type: 'close_session',
      sessionId,
    });
  }, [send]);

  return {
    send,
    createSession,
    sendMessage,
    interruptSession,
    subscribeToSession,
    closeSession,
  };
}
