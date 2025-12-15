/// <reference lib="webworker" />
/* eslint-disable no-restricted-globals */
import { precacheAndRoute } from 'workbox-precaching'

// Workbox will replace this with the manifest array at build time
// @ts-ignore
precacheAndRoute(self.__WB_MANIFEST || [])

// Install: ativar imediatamente a nova versão do service worker
self.addEventListener('install', (event: any) => {
  console.log('[SW] install - skipWaiting')
  event.waitUntil((self as any).skipWaiting())
})

// Activate: assumir controle das abas/janelas já abertas
self.addEventListener('activate', (event: any) => {
  console.log('[SW] activate - clients.claim')
  event.waitUntil((self as any).clients.claim())
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
export {}
