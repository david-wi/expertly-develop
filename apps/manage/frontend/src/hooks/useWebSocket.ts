import { useEffect, useRef, useCallback } from 'react'
import { useAppStore } from '../stores/appStore'

interface WebSocketMessage {
  type: string
  data: unknown
  timestamp: string
}

export function useWebSocket(orgId: string | undefined) {
  const wsRef = useRef<WebSocket | null>(null)
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const { setWsConnected, handleTaskEvent } = useAppStore()

  const connect = useCallback(() => {
    if (!orgId) return

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const host = import.meta.env.VITE_API_URL
      ? new URL(import.meta.env.VITE_API_URL).host
      : window.location.host

    const wsUrl = `${protocol}//${host}/ws/${orgId}`

    try {
      wsRef.current = new WebSocket(wsUrl)

      wsRef.current.onopen = () => {
        console.log('WebSocket connected')
        setWsConnected(true)
      }

      wsRef.current.onclose = () => {
        console.log('WebSocket disconnected')
        setWsConnected(false)

        // Reconnect after 3 seconds
        reconnectTimeoutRef.current = setTimeout(() => {
          connect()
        }, 3000)
      }

      wsRef.current.onerror = (error) => {
        console.error('WebSocket error:', error)
      }

      wsRef.current.onmessage = (event) => {
        try {
          const message: WebSocketMessage = JSON.parse(event.data)

          // Handle different message types
          switch (message.type) {
            case 'connected':
              console.log('WebSocket authenticated')
              break

            case 'ping':
              // Respond with pong
              wsRef.current?.send(JSON.stringify({ type: 'pong' }))
              break

            case 'task.created':
            case 'task.updated':
            case 'task.progress':
            case 'task.completed':
            case 'task.failed':
              handleTaskEvent({ type: message.type, data: message.data as never })
              break

            default:
              console.log('Unknown message type:', message.type)
          }
        } catch (error) {
          console.error('Failed to parse WebSocket message:', error)
        }
      }
    } catch (error) {
      console.error('Failed to connect WebSocket:', error)
    }
  }, [orgId, setWsConnected, handleTaskEvent])

  useEffect(() => {
    connect()

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current)
      }
      if (wsRef.current) {
        wsRef.current.close()
      }
    }
  }, [connect])

  const sendMessage = useCallback((message: object) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message))
    }
  }, [])

  return { sendMessage }
}
