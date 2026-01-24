/**
 * WebSocket service for real-time updates.
 */

type EventHandler = (data: any) => void;
type EventType = string;

class WebSocketService {
  private socket: WebSocket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;
  private handlers: Map<EventType, Set<EventHandler>> = new Map();
  private apiKey: string | null = null;
  private tenantId: string | null = null;
  private pingInterval: number | null = null;

  /**
   * Connect to the WebSocket server.
   */
  connect(tenantId: string, apiKey: string): void {
    if (this.socket?.readyState === WebSocket.OPEN) {
      return;
    }

    this.tenantId = tenantId;
    this.apiKey = apiKey;

    const wsUrl = this.getWebSocketUrl(tenantId, apiKey);
    this.socket = new WebSocket(wsUrl);

    this.socket.onopen = () => {
      console.log('WebSocket connected');
      this.reconnectAttempts = 0;
      this.startPingInterval();
      this.emit('connection', { status: 'connected' });
    };

    this.socket.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        if (message.type) {
          this.emit(message.type, message.data);
        }
      } catch (e) {
        // Handle pong response
        if (event.data === 'pong') {
          return;
        }
        console.error('Failed to parse WebSocket message:', e);
      }
    };

    this.socket.onclose = () => {
      console.log('WebSocket disconnected');
      this.stopPingInterval();
      this.emit('connection', { status: 'disconnected' });
      this.attemptReconnect();
    };

    this.socket.onerror = (error) => {
      console.error('WebSocket error:', error);
      this.emit('error', { error });
    };
  }

  /**
   * Disconnect from the WebSocket server.
   */
  disconnect(): void {
    this.stopPingInterval();
    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }
    this.reconnectAttempts = this.maxReconnectAttempts; // Prevent auto-reconnect
  }

  /**
   * Subscribe to an event type.
   */
  on(eventType: EventType, handler: EventHandler): () => void {
    if (!this.handlers.has(eventType)) {
      this.handlers.set(eventType, new Set());
    }
    this.handlers.get(eventType)!.add(handler);

    // Return unsubscribe function
    return () => {
      this.handlers.get(eventType)?.delete(handler);
    };
  }

  /**
   * Emit an event to all handlers.
   */
  private emit(eventType: EventType, data: any): void {
    const handlers = this.handlers.get(eventType);
    if (handlers) {
      handlers.forEach((handler) => {
        try {
          handler(data);
        } catch (e) {
          console.error(`Error in ${eventType} handler:`, e);
        }
      });
    }

    // Also emit to wildcard handlers
    const wildcardHandlers = this.handlers.get('*');
    if (wildcardHandlers) {
      wildcardHandlers.forEach((handler) => {
        try {
          handler({ type: eventType, data });
        } catch (e) {
          console.error('Error in wildcard handler:', e);
        }
      });
    }
  }

  /**
   * Attempt to reconnect after disconnection.
   */
  private attemptReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.log('Max reconnection attempts reached');
      return;
    }

    this.reconnectAttempts++;
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);

    console.log(`Attempting to reconnect in ${delay}ms (attempt ${this.reconnectAttempts})`);

    setTimeout(() => {
      if (this.tenantId && this.apiKey) {
        this.connect(this.tenantId, this.apiKey);
      }
    }, delay);
  }

  /**
   * Get the WebSocket URL.
   */
  private getWebSocketUrl(tenantId: string, apiKey: string): string {
    if (import.meta.env.VITE_WS_URL) {
      return `${import.meta.env.VITE_WS_URL}/ws/${tenantId}?api_key=${encodeURIComponent(apiKey)}`;
    }
    // Construct WebSocket URL from current location
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    return `${protocol}//${host}/ws/${tenantId}?api_key=${encodeURIComponent(apiKey)}`;
  }

  /**
   * Start ping interval to keep connection alive.
   */
  private startPingInterval(): void {
    this.pingInterval = window.setInterval(() => {
      if (this.socket?.readyState === WebSocket.OPEN) {
        this.socket.send('ping');
      }
    }, 30000); // Ping every 30 seconds
  }

  /**
   * Stop ping interval.
   */
  private stopPingInterval(): void {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }

  /**
   * Check if connected.
   */
  isConnected(): boolean {
    return this.socket?.readyState === WebSocket.OPEN;
  }
}

// Export singleton instance
export const websocket = new WebSocketService();
export default websocket;

// Event type constants
export const WS_EVENTS = {
  CONNECTION: 'connection',
  ERROR: 'error',

  TASK_CREATED: 'task.created',
  TASK_UPDATED: 'task.updated',
  TASK_STARTED: 'task.started',
  TASK_COMPLETED: 'task.completed',
  TASK_BLOCKED: 'task.blocked',

  QUESTION_CREATED: 'question.created',
  QUESTION_ANSWERED: 'question.answered',
  QUESTION_DISMISSED: 'question.dismissed',

  DRAFT_CREATED: 'draft.created',
  DRAFT_UPDATED: 'draft.updated',

  KNOWLEDGE_CAPTURED: 'knowledge.captured',
  PLAYBOOK_MATCHED: 'playbook.matched',
} as const;
