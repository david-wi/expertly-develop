import { useEffect, useRef, useState, useCallback } from 'react'

export interface UseWebSocketOptions {
  /** WebSocket URL to connect to */
  url: string
  /** Whether the connection should be active (default: true) */
  enabled?: boolean
  /** Reconnection delay in ms (default: 1000, max 30000 with exponential backoff) */
  reconnectDelay?: number
  /** Maximum reconnection attempts before giving up (default: Infinity) */
  maxReconnectAttempts?: number
  /** Ping interval in ms for keepalive (default: 30000) */
  pingInterval?: number
}

export interface UseWebSocketReturn {
  /** Whether the WebSocket is currently connected */
  isConnected: boolean
  /** Last message received as parsed JSON */
  lastMessage: unknown | null
  /** Send a message through the WebSocket */
  sendMessage: (data: unknown) => void
  /** Manually reconnect */
  reconnect: () => void
}

/**
 * Custom hook for WebSocket connections with auto-reconnect and keepalive.
 *
 * Uses the native browser WebSocket API -- no extra dependencies required.
 */
export function useWebSocket({
  url,
  enabled = true,
  reconnectDelay = 1000,
  maxReconnectAttempts = Infinity,
  pingInterval = 30000,
}: UseWebSocketOptions): UseWebSocketReturn {
  const [isConnected, setIsConnected] = useState(false)
  const [lastMessage, setLastMessage] = useState<unknown | null>(null)

  const wsRef = useRef<WebSocket | null>(null)
  const reconnectAttemptsRef = useRef(0)
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const mountedRef = useRef(true)

  const clearTimers = useCallback(() => {
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current)
      reconnectTimerRef.current = null
    }
    if (pingTimerRef.current) {
      clearInterval(pingTimerRef.current)
      pingTimerRef.current = null
    }
  }, [])

  const connect = useCallback(() => {
    if (!mountedRef.current || !enabled) return

    // Clean up existing connection
    if (wsRef.current) {
      wsRef.current.onopen = null
      wsRef.current.onclose = null
      wsRef.current.onmessage = null
      wsRef.current.onerror = null
      if (wsRef.current.readyState === WebSocket.OPEN || wsRef.current.readyState === WebSocket.CONNECTING) {
        wsRef.current.close()
      }
    }

    try {
      const ws = new WebSocket(url)
      wsRef.current = ws

      ws.onopen = () => {
        if (!mountedRef.current) return
        setIsConnected(true)
        reconnectAttemptsRef.current = 0

        // Start keepalive pings
        pingTimerRef.current = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'ping' }))
          }
        }, pingInterval)
      }

      ws.onclose = () => {
        if (!mountedRef.current) return
        setIsConnected(false)
        clearTimers()

        // Auto-reconnect with exponential backoff
        if (enabled && reconnectAttemptsRef.current < maxReconnectAttempts) {
          const delay = Math.min(
            reconnectDelay * Math.pow(2, reconnectAttemptsRef.current),
            30000
          )
          reconnectAttemptsRef.current += 1
          reconnectTimerRef.current = setTimeout(connect, delay)
        }
      }

      ws.onmessage = (event: MessageEvent) => {
        if (!mountedRef.current) return
        try {
          const data = JSON.parse(event.data)
          // Ignore pong responses
          if (data.type === 'pong') return
          setLastMessage(data)
        } catch {
          // Non-JSON message, ignore
        }
      }

      ws.onerror = () => {
        // Error will trigger onclose, which handles reconnection
      }
    } catch {
      // Failed to create WebSocket, try reconnecting
      if (enabled && reconnectAttemptsRef.current < maxReconnectAttempts) {
        const delay = Math.min(
          reconnectDelay * Math.pow(2, reconnectAttemptsRef.current),
          30000
        )
        reconnectAttemptsRef.current += 1
        reconnectTimerRef.current = setTimeout(connect, delay)
      }
    }
  }, [url, enabled, reconnectDelay, maxReconnectAttempts, pingInterval, clearTimers])

  const sendMessage = useCallback((data: unknown) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(data))
    }
  }, [])

  const reconnect = useCallback(() => {
    reconnectAttemptsRef.current = 0
    clearTimers()
    connect()
  }, [connect, clearTimers])

  useEffect(() => {
    mountedRef.current = true
    if (enabled) {
      connect()
    }

    return () => {
      mountedRef.current = false
      clearTimers()
      if (wsRef.current) {
        wsRef.current.onopen = null
        wsRef.current.onclose = null
        wsRef.current.onmessage = null
        wsRef.current.onerror = null
        wsRef.current.close()
        wsRef.current = null
      }
    }
  }, [enabled, connect, clearTimers])

  return { isConnected, lastMessage, sendMessage, reconnect }
}
