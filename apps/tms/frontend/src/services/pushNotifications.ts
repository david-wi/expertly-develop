/**
 * Push Notification Service
 *
 * Handles browser push notification subscription lifecycle:
 * - Service worker registration
 * - Push permission request
 * - Subscription management
 * - Token exchange with backend
 *
 * TODO: Implement actual push notification backend integration.
 * Currently uses simulated/mock responses for subscription endpoints.
 */

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY || ''

/**
 * Check if push notifications are supported by the browser.
 */
export function isPushSupported(): boolean {
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
}

/**
 * Get the current notification permission state.
 */
export function getPermissionState(): NotificationPermission {
  if (!('Notification' in window)) return 'denied'
  return Notification.permission
}

/**
 * Request notification permission from the user.
 */
export async function requestPermission(): Promise<NotificationPermission> {
  if (!('Notification' in window)) return 'denied'
  return Notification.requestPermission()
}

/**
 * Register the push notification service worker.
 * Returns the ServiceWorkerRegistration if successful.
 */
export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!('serviceWorker' in navigator)) return null

  try {
    const registration = await navigator.serviceWorker.register('/sw-push.js', {
      scope: '/',
    })
    console.log('[Push] Service worker registered:', registration.scope)
    return registration
  } catch (error) {
    console.error('[Push] Service worker registration failed:', error)
    return null
  }
}

/**
 * Convert a base64 VAPID key to a Uint8Array for subscription.
 */
function urlBase64ToUint8Array(base64String: string): ArrayBuffer {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = window.atob(base64)
  const outputArray = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i)
  }
  return outputArray.buffer as ArrayBuffer
}

/**
 * Subscribe to push notifications.
 * Returns the PushSubscription if successful.
 */
export async function subscribeToPush(
  registration: ServiceWorkerRegistration
): Promise<PushSubscription | null> {
  try {
    // Check for existing subscription
    const existingSubscription = await registration.pushManager.getSubscription()
    if (existingSubscription) {
      console.log('[Push] Already subscribed')
      return existingSubscription
    }

    if (!VAPID_PUBLIC_KEY) {
      console.warn('[Push] No VAPID public key configured. Push subscription skipped.')
      return null
    }

    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
    })

    console.log('[Push] Push subscription created:', subscription.endpoint)

    // TODO: Send subscription to backend
    // await api.registerPushSubscription(subscription.toJSON())

    return subscription
  } catch (error) {
    console.error('[Push] Push subscription failed:', error)
    return null
  }
}

/**
 * Unsubscribe from push notifications.
 */
export async function unsubscribeFromPush(
  registration: ServiceWorkerRegistration
): Promise<boolean> {
  try {
    const subscription = await registration.pushManager.getSubscription()
    if (!subscription) return true

    const success = await subscription.unsubscribe()

    if (success) {
      console.log('[Push] Unsubscribed from push notifications')
      // TODO: Notify backend to remove subscription
      // await api.unregisterPushSubscription(subscription.endpoint)
    }

    return success
  } catch (error) {
    console.error('[Push] Unsubscribe failed:', error)
    return false
  }
}

/**
 * Initialize push notification system.
 * Registers service worker and subscribes if permission is already granted.
 */
export async function initializePushNotifications(): Promise<{
  supported: boolean
  permission: NotificationPermission
  subscription: PushSubscription | null
}> {
  if (!isPushSupported()) {
    return { supported: false, permission: 'denied', subscription: null }
  }

  const permission = getPermissionState()
  let subscription: PushSubscription | null = null

  if (permission === 'granted') {
    const registration = await registerServiceWorker()
    if (registration) {
      subscription = await subscribeToPush(registration)
    }
  }

  return { supported: true, permission, subscription }
}

/**
 * Full setup flow: request permission, register, and subscribe.
 * Call this when the user explicitly enables push notifications.
 */
export async function enablePushNotifications(): Promise<{
  success: boolean
  permission: NotificationPermission
  subscription: PushSubscription | null
  error?: string
}> {
  if (!isPushSupported()) {
    return {
      success: false,
      permission: 'denied',
      subscription: null,
      error: 'Push notifications are not supported in this browser',
    }
  }

  const permission = await requestPermission()
  if (permission !== 'granted') {
    return {
      success: false,
      permission,
      subscription: null,
      error: 'Notification permission was not granted',
    }
  }

  const registration = await registerServiceWorker()
  if (!registration) {
    return {
      success: false,
      permission,
      subscription: null,
      error: 'Service worker registration failed',
    }
  }

  const subscription = await subscribeToPush(registration)
  return {
    success: !!subscription,
    permission,
    subscription,
    error: subscription ? undefined : 'Push subscription failed',
  }
}
