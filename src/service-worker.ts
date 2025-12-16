/// <reference lib="webworker" />
/* eslint-disable no-restricted-globals */
import { precacheAndRoute } from 'workbox-precaching'
import { registerRoute } from 'workbox-routing'
import { NetworkFirst, StaleWhileRevalidate } from 'workbox-strategies'
import { ExpirationPlugin } from 'workbox-expiration'

declare const self: ServiceWorkerGlobalScope

// Workbox will replace this with the manifest array at build time
// @ts-ignore
precacheAndRoute(self.__WB_MANIFEST || [])

// Install: ativar imediatamente a nova versão do service worker
self.addEventListener('install', (event: ExtendableEvent) => {
  console.log('[SW] Install event')
  // Força a ativação imediata do novo service worker
  self.skipWaiting()
  
  // Limpa caches antigos
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          console.log('[SW] Removendo cache antigo:', cacheName)
          return caches.delete(cacheName)
        })
      )
    })
  )
})

// Ativação: assumir controle das abas/janelas já abertas
self.addEventListener('activate', (event: ExtendableEvent) => {
  console.log('[SW] Activate event')
  
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          // Limpa todos os caches exceto o atual
          if (cacheName !== CACHE_NAME) {
            console.log('[SW] Removendo cache antigo na ativação:', cacheName)
            return caches.delete(cacheName)
          }
        })
      )
    }).then(() => {
      // Assumir controle de todas as abas imediatamente
      return self.clients.claim()
    })
  )
})

// Nome do cache atual
const CACHE_NAME = 'frota-xingu-v1'

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

// Estratégia de cache para navegação (HTML)
registerRoute(
  ({ request }) => request.mode === 'navigate',
  new NetworkFirst({
    cacheName: `${CACHE_NAME}-html`,
    networkTimeoutSeconds: 3,
  })
)

// Estratégia para assets estáticos (JS, CSS, imagens, etc.)
registerRoute(
  ({ request }) => 
    request.destination === 'script' || 
    request.destination === 'style' ||
    request.destination === 'image' ||
    request.destination === 'font',
  new StaleWhileRevalidate({
    cacheName: `${CACHE_NAME}-assets`,
    plugins: [
      new ExpirationPlugin({
        maxEntries: 100,
        maxAgeSeconds: 60 * 60 * 24 * 30, // 30 dias
      })
    ]
  })
)

// Estratégia para API e outros recursos
registerRoute(
  ({ url }) => url.origin === self.location.origin && url.pathname.startsWith('/api/'),
  new NetworkFirst({
    cacheName: `${CACHE_NAME}-api`,
    networkTimeoutSeconds: 10,
  })
)

// Atualiza o service worker quando uma nova versão é detectada
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    console.log('[SW] Recebido SKIP_WAITING, ativando nova versão...')
    self.skipWaiting()
  }
})

// Força a atualização imediata quando o service worker é instalado
self.addEventListener('install', () => {
  console.log('[SW] Nova versão instalada, pulando espera...')
  self.skipWaiting()
})
