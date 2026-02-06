// @ts-nocheck
/**
 * Expertly TMS Service Worker (TypeScript source)
 *
 * This is the canonical TypeScript source for the service worker.
 * It is excluded from the main app's type-checking (uses @ts-nocheck)
 * because it runs in the ServiceWorkerGlobalScope, not the DOM.
 * Compile separately or transpile to `public/sw.js` for production.
 *
 * Strategies:
 * - Static assets  : cache-first (fast loads, background update)
 * - API calls      : network-first (freshness, cache fallback when offline)
 * - Navigation     : network-first with offline fallback page
 * - Mutations      : background-sync queue for offline writes
 */

// ---------------------------------------------------------------------------
// Globals and types
// ---------------------------------------------------------------------------

// Service Worker global scope
declare const self: ServiceWorkerGlobalScope

const CACHE_VERSION = 'v2'
const STATIC_CACHE = `expertly-tms-static-${CACHE_VERSION}`
const API_CACHE = `expertly-tms-api-${CACHE_VERSION}`
const OFFLINE_QUEUE_CACHE = 'expertly-tms-offline-queue'

const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/offline.html',
]

// API paths we'll cache for offline fallback reads
const CACHEABLE_API_PREFIXES = [
  '/api/v1/shipments',
  '/api/v1/customers',
  '/api/v1/carriers',
  '/api/v1/work-items',
  '/api/v1/invoices',
  '/api/v1/quotes',
]

// ---------------------------------------------------------------------------
// Install: pre-cache static assets
// ---------------------------------------------------------------------------

self.addEventListener('install', (event: ExtendableEvent) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => cache.addAll(STATIC_ASSETS)),
  )
  // Activate immediately instead of waiting
  self.skipWaiting()
})

// ---------------------------------------------------------------------------
// Activate: clean old caches
// ---------------------------------------------------------------------------

self.addEventListener('activate', (event: ExtendableEvent) => {
  const keepCaches = new Set([STATIC_CACHE, API_CACHE, OFFLINE_QUEUE_CACHE])

  event.waitUntil(
    caches.keys().then((names) =>
      Promise.all(
        names
          .filter((name) => !keepCaches.has(name))
          .map((name) => caches.delete(name)),
      ),
    ),
  )

  // Claim all open tabs immediately
  self.clients.claim()
})

// ---------------------------------------------------------------------------
// Fetch strategies
// ---------------------------------------------------------------------------

function isStaticAsset(url: URL): boolean {
  // JS/CSS/font/image bundles produced by Vite
  if (url.pathname.startsWith('/assets/')) return true
  // Known static files
  if (url.pathname.match(/\.(js|css|png|jpg|jpeg|gif|svg|woff2?|ttf|ico)$/)) return true
  return false
}

function isCacheableAPI(url: URL): boolean {
  return CACHEABLE_API_PREFIXES.some((prefix) => url.pathname.startsWith(prefix))
}

/** Cache-first for static assets (Vite bundles are content-hashed). */
async function cacheFirst(request: Request): Promise<Response> {
  const cached = await caches.match(request)
  if (cached) return cached

  const response = await fetch(request)
  if (response.ok) {
    const cache = await caches.open(STATIC_CACHE)
    cache.put(request, response.clone())
  }
  return response
}

/** Network-first for API calls with cache fallback. */
async function networkFirst(request: Request): Promise<Response> {
  try {
    const response = await fetch(request)
    if (response.ok) {
      const cache = await caches.open(API_CACHE)
      cache.put(request, response.clone())
    }
    return response
  } catch {
    const cached = await caches.match(request)
    if (cached) return cached
    return new Response(JSON.stringify({ error: 'offline' }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}

/** Network-first for navigation with offline fallback page. */
async function navigationHandler(request: Request): Promise<Response> {
  try {
    const response = await fetch(request)
    if (response.ok) {
      const cache = await caches.open(STATIC_CACHE)
      cache.put(request, response.clone())
    }
    return response
  } catch {
    const cached = await caches.match(request)
    if (cached) return cached

    const offlinePage = await caches.match('/offline.html')
    if (offlinePage) return offlinePage

    return new Response('Offline', { status: 503 })
  }
}

self.addEventListener('fetch', (event: FetchEvent) => {
  const url = new URL(event.request.url)

  // Only handle same-origin requests
  if (url.origin !== self.location.origin) return

  // Skip non-GET for fetching (mutations go through background sync)
  if (event.request.method !== 'GET') return

  // Navigation requests (page loads)
  if (event.request.mode === 'navigate') {
    event.respondWith(navigationHandler(event.request))
    return
  }

  // Static assets: cache-first
  if (isStaticAsset(url)) {
    event.respondWith(cacheFirst(event.request))
    return
  }

  // API reads: network-first with cache fallback
  if (isCacheableAPI(url)) {
    event.respondWith(networkFirst(event.request))
    return
  }

  // Everything else: default browser behaviour (no interception)
})

// ---------------------------------------------------------------------------
// Background Sync: queue offline mutations
// ---------------------------------------------------------------------------

interface QueuedMutation {
  url: string
  method: string
  headers: Record<string, string>
  body: string | null
  timestamp: number
}

async function getOfflineQueue(): Promise<QueuedMutation[]> {
  const cache = await caches.open(OFFLINE_QUEUE_CACHE)
  const response = await cache.match('queue')
  if (!response) return []
  return response.json()
}

async function setOfflineQueue(queue: QueuedMutation[]): Promise<void> {
  const cache = await caches.open(OFFLINE_QUEUE_CACHE)
  await cache.put(
    'queue',
    new Response(JSON.stringify(queue), {
      headers: { 'Content-Type': 'application/json' },
    }),
  )
}

/**
 * Called from client code via `postMessage` to enqueue a mutation
 * that should be retried when connectivity is restored.
 */
async function enqueueMutation(mutation: QueuedMutation): Promise<void> {
  const queue = await getOfflineQueue()
  queue.push(mutation)
  await setOfflineQueue(queue)

  // Request background sync if available
  if ('sync' in self.registration) {
    await self.registration.sync.register('replay-mutations')
  }
}

/** Replay all queued mutations in order. */
async function replayMutations(): Promise<void> {
  const queue = await getOfflineQueue()
  const remaining: QueuedMutation[] = []

  for (const mutation of queue) {
    try {
      await fetch(mutation.url, {
        method: mutation.method,
        headers: mutation.headers,
        body: mutation.body,
      })
    } catch {
      remaining.push(mutation)
    }
  }

  await setOfflineQueue(remaining)
}

self.addEventListener('sync', (event: ExtendableEvent & { tag?: string }) => {
  if (event.tag === 'replay-mutations') {
    event.waitUntil(replayMutations())
  }
})

// ---------------------------------------------------------------------------
// Message handler: receive commands from client
// ---------------------------------------------------------------------------

self.addEventListener('message', (event: ExtendableMessageEvent) => {
  const msg = event.data

  if (msg?.type === 'ENQUEUE_MUTATION') {
    event.waitUntil(enqueueMutation(msg.mutation as QueuedMutation))
  }

  if (msg?.type === 'SKIP_WAITING') {
    self.skipWaiting()
  }
})
