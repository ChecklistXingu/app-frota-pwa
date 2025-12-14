/// <reference lib="webworker" />
/* eslint-disable no-restricted-globals */
import { precacheAndRoute } from 'workbox-precaching'

// Workbox will replace this with the manifest array at build time
// @ts-ignore
precacheAndRoute(self.__WB_MANIFEST || [])

const CACHE_NAME = 'frota-pwa-v' + new Date().toISOString()

// Install: we don't call skipWaiting here to allow the worker to enter 'waiting'
// until the user chooses to update (we handle SKIP_WAITING via message)
self.addEventListener('install', (event: any) => {
  // Optionally warm the cache or do lightweight installs here
  console.log('[SW] install')
  // ensure the event waits for install completion
  event.waitUntil(Promise.resolve())
})

// Activation: clean up old caches
self.addEventListener('activate', (event: any) => {
  console.log('[SW] activate')
  event.waitUntil(
    caches.keys().then((keys: string[]) =>
      Promise.all(
        keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key)),
      ),
    ).then(() => (self as any).clients.claim()),
  )
})

// Fetch: default network-first for non-precached, and cache fallback
self.addEventListener('fetch', (event: any) => {
  event.respondWith(
    caches.match(event.request).then(res => res || fetch(event.request)),
  )
})

// Message: handle SKIP_WAITING (support string or object messages)
self.addEventListener('message', (event: any) => {
  try {
    const data = event.data
    if (data === 'SKIP_WAITING' || (data && data.type === 'SKIP_WAITING')) {
      console.log('[SW] Received SKIP_WAITING message; calling skipWaiting()')
      ;(self as any).skipWaiting()
    }
  } catch (e) {
    console.error('[SW] Error handling message', e)
  }
})

// Cleanup outdated caches at runtime as a safety net
self.addEventListener('periodicsync' as any, () => {
  // noop: placeholder if you want to schedule cache maintenance
})

export {}
