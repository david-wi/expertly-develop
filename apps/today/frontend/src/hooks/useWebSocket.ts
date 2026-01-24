import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { websocket, WS_EVENTS } from '../services/websocket';
import { useAppStore } from '../stores/appStore';

/**
 * Hook to connect to WebSocket and invalidate queries on updates.
 */
export function useWebSocket() {
  const queryClient = useQueryClient();
  const { apiKey, isAuthenticated } = useAppStore();

  // Connect when authenticated
  useEffect(() => {
    if (!isAuthenticated || !apiKey) {
      return;
    }

    // TODO: Get actual tenant ID from user context
    // For now, use a placeholder
    const tenantId = 'default';

    websocket.connect(tenantId, apiKey);

    return () => {
      websocket.disconnect();
    };
  }, [isAuthenticated, apiKey]);

  // Set up event handlers to invalidate React Query cache
  useEffect(() => {
    const unsubscribers: (() => void)[] = [];

    // Task events
    unsubscribers.push(
      websocket.on(WS_EVENTS.TASK_CREATED, () => {
        queryClient.invalidateQueries({ queryKey: ['tasks'] });
      })
    );

    unsubscribers.push(
      websocket.on(WS_EVENTS.TASK_UPDATED, (data) => {
        queryClient.invalidateQueries({ queryKey: ['tasks'] });
        if (data?.id) {
          queryClient.invalidateQueries({ queryKey: ['task', data.id] });
        }
      })
    );

    unsubscribers.push(
      websocket.on(WS_EVENTS.TASK_STARTED, (data) => {
        queryClient.invalidateQueries({ queryKey: ['tasks'] });
        if (data?.id) {
          queryClient.invalidateQueries({ queryKey: ['task', data.id] });
        }
      })
    );

    unsubscribers.push(
      websocket.on(WS_EVENTS.TASK_COMPLETED, (data) => {
        queryClient.invalidateQueries({ queryKey: ['tasks'] });
        if (data?.id) {
          queryClient.invalidateQueries({ queryKey: ['task', data.id] });
        }
      })
    );

    unsubscribers.push(
      websocket.on(WS_EVENTS.TASK_BLOCKED, (data) => {
        queryClient.invalidateQueries({ queryKey: ['tasks'] });
        queryClient.invalidateQueries({ queryKey: ['questions'] });
        if (data?.id) {
          queryClient.invalidateQueries({ queryKey: ['task', data.id] });
        }
      })
    );

    // Question events
    unsubscribers.push(
      websocket.on(WS_EVENTS.QUESTION_CREATED, () => {
        queryClient.invalidateQueries({ queryKey: ['questions'] });
      })
    );

    unsubscribers.push(
      websocket.on(WS_EVENTS.QUESTION_ANSWERED, (data) => {
        queryClient.invalidateQueries({ queryKey: ['questions'] });
        queryClient.invalidateQueries({ queryKey: ['tasks'] }); // Tasks may be unblocked
        if (data?.id) {
          queryClient.invalidateQueries({ queryKey: ['question', data.id] });
        }
      })
    );

    unsubscribers.push(
      websocket.on(WS_EVENTS.QUESTION_DISMISSED, (data) => {
        queryClient.invalidateQueries({ queryKey: ['questions'] });
        if (data?.id) {
          queryClient.invalidateQueries({ queryKey: ['question', data.id] });
        }
      })
    );

    return () => {
      unsubscribers.forEach((unsub) => unsub());
    };
  }, [queryClient]);
}

/**
 * Hook to subscribe to specific WebSocket events.
 */
export function useWebSocketEvent(
  eventType: string,
  handler: (data: any) => void
) {
  useEffect(() => {
    const unsubscribe = websocket.on(eventType, handler);
    return unsubscribe;
  }, [eventType, handler]);
}

/**
 * Hook to get WebSocket connection status.
 */
export function useWebSocketStatus() {
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    const handleConnection = (data: { status: string }) => {
      setIsConnected(data.status === 'connected');
    };

    const unsubscribe = websocket.on(WS_EVENTS.CONNECTION, handleConnection);

    // Check initial status
    setIsConnected(websocket.isConnected());

    return unsubscribe;
  }, []);

  return isConnected;
}
