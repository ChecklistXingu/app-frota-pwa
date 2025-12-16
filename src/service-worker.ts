/// <reference lib="webworker" />
/* eslint-disable no-restricted-globals */
import { precacheAndRoute } from 'workbox-precaching'
import { registerRoute } from 'workbox-routing'
import { NetworkFirst, StaleWhileRevalidate } from 'workbox-strategies'
import { ExpirationPlugin } from 'workbox-expiration'

declare const self: ServiceWorkerGlobalScope

// Nome do cache atual - deve ser declarado antes de usar
// Incrementar esta versão força a limpeza de todos os caches antigos
const CACHE_VERSION = '1.0.2'
const CACHE_NAME = `frota-xingu-v${CACHE_VERSION}`

// Workbox will replace this with the manifest array at build time
// @ts-ignore
precacheAndRoute(self.__WB_MANIFEST || [])

// Install: ativar imediatamente a nova versão do service worker
self.addEventListener('install', (_event: ExtendableEvent) => {
  console.log('[SW] Install event - Nova versão detectada')
  // Força a ativação imediata do novo service worker
  self.skipWaiting()
  
  // Não limpa caches aqui - isso será feito no activate
  // para evitar remover caches que ainda podem ser necessários
})

// Ativação: assumir controle das abas/janelas já abertas e limpar caches antigos
self.addEventListener('activate', (event: ExtendableEvent) => {
  console.log('[SW] Activate event - Limpando caches antigos')
  
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          // Limpa todos os caches exceto os caches da versão atual
          if (!cacheName.startsWith(CACHE_NAME)) {
            console.log('[SW] Removendo cache antigo na ativação:', cacheName)
            return caches.delete(cacheName)
          }
          return Promise.resolve()
        })
      )
    }).then(() => {
      // Assumir controle de todas as abas imediatamente
      console.log('[SW] Assumindo controle de todos os clientes')
      return self.clients.claim()
    })
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
