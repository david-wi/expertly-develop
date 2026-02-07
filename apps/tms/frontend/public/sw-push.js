/**
 * Push Notification Service Worker
 *
 * Handles incoming push events and notification click actions.
 * Registered by the pushNotifications service.
 *
 * TODO: Implement actual push notification payload parsing
 * from the backend push service.
 */

/* eslint-disable no-restricted-globals */

// Service worker install event
self.addEventListener('install', (event) => {
  console.log('[SW-Push] Service worker installed')
  self.skipWaiting()
})

// Service worker activate event
self.addEventListener('activate', (event) => {
  console.log('[SW-Push] Service worker activated')
  event.waitUntil(self.clients.claim())
})

// Handle incoming push notifications
self.addEventListener('push', (event) => {
  console.log('[SW-Push] Push received:', event)

  let data = {
    title: 'Expertly TMS',
    body: 'You have a new notification',
    icon: '/icon-192x192.png',
    badge: '/icon-72x72.png',
    tag: 'tms-notification',
    data: {
      url: '/',
    },
  }

  // Parse push payload if available
  if (event.data) {
    try {
      const payload = event.data.json()
      data = {
        title: payload.title || data.title,
        body: payload.body || payload.message || data.body,
        icon: payload.icon || data.icon,
        badge: payload.badge || data.badge,
        tag: payload.tag || payload.category || data.tag,
        data: {
          url: payload.action_url || payload.url || data.data.url,
          ...payload.data,
        },
      }
    } catch (e) {
      // If JSON parse fails, use the text as the body
      data.body = event.data.text() || data.body
    }
  }

  const options = {
    body: data.body,
    icon: data.icon,
    badge: data.badge,
    tag: data.tag,
    data: data.data,
    vibrate: [100, 50, 100],
    actions: [
      {
        action: 'view',
        title: 'View',
      },
      {
        action: 'dismiss',
        title: 'Dismiss',
      },
    ],
  }

  event.waitUntil(self.registration.showNotification(data.title, options))
})

// Handle notification click
self.addEventListener('notificationclick', (event) => {
  console.log('[SW-Push] Notification clicked:', event.action)

  event.notification.close()

  if (event.action === 'dismiss') {
    return
  }

  const urlToOpen = event.notification.data?.url || '/'

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // Try to focus an existing window
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.focus()
          client.navigate(urlToOpen)
          return
        }
      }
      // Open a new window if none exist
      if (self.clients.openWindow) {
        return self.clients.openWindow(urlToOpen)
      }
    })
  )
})

// Handle push subscription change (e.g., browser refreshes the subscription)
self.addEventListener('pushsubscriptionchange', (event) => {
  console.log('[SW-Push] Push subscription changed')

  // TODO: Re-subscribe and notify backend of the new subscription
  event.waitUntil(
    self.registration.pushManager
      .subscribe({
        userVisibleOnly: true,
        // applicationServerKey will need to be stored or fetched
      })
      .then((subscription) => {
        // TODO: Send new subscription to backend
        console.log('[SW-Push] Re-subscribed:', subscription.endpoint)
      })
      .catch((err) => {
        console.error('[SW-Push] Re-subscription failed:', err)
      })
  )
})
