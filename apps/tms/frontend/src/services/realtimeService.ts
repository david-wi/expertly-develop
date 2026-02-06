/**
 * Real-time event service for TMS WebSocket updates.
 *
 * Provides an event subscription model so any component or store
 * can react to server-pushed events without coupling to the WebSocket
 * connection details.
 */

import { useAppStore } from '../stores/appStore'

// ---------------------------------------------------------------------------
// Event types
// ---------------------------------------------------------------------------

export type WSEventType =
  | 'shipment_created'
  | 'shipment_updated'
  | 'shipment_status_changed'
  | 'work_item_created'
  | 'work_item_completed'
  | 'work_item_assigned'
  | 'tender_created'
  | 'tender_accepted'
  | 'tender_declined'
  | 'tracking_update'
  | 'dashboard_refresh'

export interface WSEvent {
  event: WSEventType
  data: Record<string, unknown>
  timestamp: string
}

type EventCallback = (data: Record<string, unknown>) => void

// ---------------------------------------------------------------------------
// Singleton service
// ---------------------------------------------------------------------------

class RealtimeService {
  private listeners: Map<WSEventType, Set<EventCallback>> = new Map()

  /**
   * Subscribe to a specific event type.
   * Returns an unsubscribe function for convenience.
   */
  subscribe(eventType: WSEventType, callback: EventCallback): () => void {
    if (!this.listeners.has(eventType)) {
      this.listeners.set(eventType, new Set())
    }
    this.listeners.get(eventType)!.add(callback)

    return () => this.unsubscribe(eventType, callback)
  }

  /** Remove a previously registered callback. */
  unsubscribe(eventType: WSEventType, callback: EventCallback): void {
    this.listeners.get(eventType)?.delete(callback)
  }

  /**
   * Called by the WebSocket hook whenever a message arrives.
   * Dispatches to registered listeners *and* applies default
   * Zustand store updates.
   */
  handleMessage(message: unknown): void {
    if (!message || typeof message !== 'object') return

    const { event, data } = message as WSEvent
    if (!event) return

    // ------- Default Zustand store integrations -------
    this._applyStoreUpdate(event, data)

    // ------- Notify subscribers -------
    const callbacks = this.listeners.get(event)
    if (callbacks) {
      for (const cb of callbacks) {
        try {
          cb(data)
        } catch (err) {
          console.error(`[RealtimeService] Error in listener for "${event}":`, err)
        }
      }
    }
  }

  // -------------------------------------------------------------------
  // Internal: auto-refresh relevant Zustand slices based on event type
  // -------------------------------------------------------------------
  private _applyStoreUpdate(event: WSEventType, _data: Record<string, unknown>): void {
    const store = useAppStore.getState()

    switch (event) {
      case 'shipment_created':
      case 'shipment_updated':
      case 'shipment_status_changed':
      case 'tracking_update':
        // Re-fetch the shipments list to stay in sync
        store.fetchShipments()
        break

      case 'work_item_created':
      case 'work_item_completed':
      case 'work_item_assigned':
        store.fetchWorkItems()
        break

      case 'tender_created':
      case 'tender_accepted':
      case 'tender_declined':
        // Tender changes often affect shipments too
        store.fetchShipments()
        break

      case 'dashboard_refresh':
        store.fetchDashboardStats()
        store.fetchShipments()
        store.fetchWorkItems()
        break
    }

    // Always refresh dashboard stats on any mutation event
    if (event !== 'dashboard_refresh') {
      store.fetchDashboardStats()
    }
  }
}

/** Singleton instance used across the application. */
export const realtimeService = new RealtimeService()
