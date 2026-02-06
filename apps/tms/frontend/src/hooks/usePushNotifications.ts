import { useState, useEffect, useCallback } from 'react'
import { api } from '../services/api'

interface PushNotificationState {
  isSupported: boolean
  isSubscribed: boolean
  subscription: PushSubscription | null
  permission: NotificationPermission
  loading: boolean
  error: string | null
}

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY || ''

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding)
    .replace(/-/g, '+')
    .replace(/_/g, '/')

  const rawData = window.atob(base64)
  const outputArray = new Uint8Array(rawData.length)

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i)
  }
  return outputArray
}

export function usePushNotifications() {
  const [state, setState] = useState<PushNotificationState>({
    isSupported: false,
    isSubscribed: false,
    subscription: null,
    permission: 'default',
    loading: false,
    error: null,
  })

  // Check if push is supported
  useEffect(() => {
    const isSupported =
      'serviceWorker' in navigator &&
      'PushManager' in window &&
      'Notification' in window

    setState((prev) => ({
      ...prev,
      isSupported,
      permission: isSupported ? Notification.permission : 'denied',
    }))

    if (isSupported) {
      checkExistingSubscription()
    }
  }, [])

  // Check for existing subscription
  const checkExistingSubscription = useCallback(async () => {
    try {
      const registration = await navigator.serviceWorker.ready
      const subscription = await registration.pushManager.getSubscription()

      setState((prev) => ({
        ...prev,
        isSubscribed: !!subscription,
        subscription,
      }))
    } catch (error) {
      console.error('Failed to check subscription:', error)
    }
  }, [])

  // Request permission and subscribe
  const subscribe = useCallback(async () => {
    if (!state.isSupported) {
      setState((prev) => ({ ...prev, error: 'Push notifications not supported' }))
      return false
    }

    setState((prev) => ({ ...prev, loading: true, error: null }))

    try {
      // Request permission
      const permission = await Notification.requestPermission()
      setState((prev) => ({ ...prev, permission }))

      if (permission !== 'granted') {
        setState((prev) => ({
          ...prev,
          loading: false,
          error: 'Notification permission denied',
        }))
        return false
      }

      // Get service worker registration
      const registration = await navigator.serviceWorker.ready

      // Subscribe to push
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: VAPID_PUBLIC_KEY
          ? urlBase64ToUint8Array(VAPID_PUBLIC_KEY) as unknown as BufferSource
          : undefined,
      })

      // Save subscription to server
      try {
        await api.savePushSubscription(subscription.toJSON())
      } catch (e) {
        console.warn('Failed to save subscription to server:', e)
      }

      setState((prev) => ({
        ...prev,
        isSubscribed: true,
        subscription,
        loading: false,
      }))

      return true
    } catch (error) {
      console.error('Failed to subscribe:', error)
      setState((prev) => ({
        ...prev,
        loading: false,
        error: error instanceof Error ? error.message : 'Failed to subscribe',
      }))
      return false
    }
  }, [state.isSupported])

  // Unsubscribe
  const unsubscribe = useCallback(async () => {
    if (!state.subscription) {
      return true
    }

    setState((prev) => ({ ...prev, loading: true, error: null }))

    try {
      await state.subscription.unsubscribe()

      // Remove from server
      try {
        await api.removePushSubscription()
      } catch (e) {
        console.warn('Failed to remove subscription from server:', e)
      }

      setState((prev) => ({
        ...prev,
        isSubscribed: false,
        subscription: null,
        loading: false,
      }))

      return true
    } catch (error) {
      console.error('Failed to unsubscribe:', error)
      setState((prev) => ({
        ...prev,
        loading: false,
        error: error instanceof Error ? error.message : 'Failed to unsubscribe',
      }))
      return false
    }
  }, [state.subscription])

  // Show a local notification (for testing)
  const showNotification = useCallback(
    async (title: string, options?: NotificationOptions) => {
      if (!state.isSupported || state.permission !== 'granted') {
        return false
      }

      try {
        const registration = await navigator.serviceWorker.ready
        await registration.showNotification(title, {
          icon: '/icons/icon-192.png',
          badge: '/icons/icon-72.png',
          ...options,
        })
        return true
      } catch (error) {
        console.error('Failed to show notification:', error)
        return false
      }
    },
    [state.isSupported, state.permission]
  )

  return {
    ...state,
    subscribe,
    unsubscribe,
    showNotification,
    checkExistingSubscription,
  }
}

export default usePushNotifications
