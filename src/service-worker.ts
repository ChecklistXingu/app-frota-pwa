/// <reference lib="webworker" />
/* eslint-disable no-restricted-globals */
import { precacheAndRoute } from 'workbox-precaching'
import { registerRoute } from 'workbox-routing'
import { NetworkFirst, CacheFirst } from 'workbox-strategies'
import { ExpirationPlugin } from 'workbox-expiration'

declare const self: ServiceWorkerGlobalScope

// Nome do cache atual - deve ser declarado antes de usar
// Incrementar esta versão força a limpeza de todos os caches antigos
const CACHE_VERSION = '1.0.5'
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
    console.log('[SW] Mensagem recebida:', data);
    
    if (data === 'SKIP_WAITING' || (data && data.type === 'SKIP_WAITING')) {
      console.log('[SW] Received SKIP_WAITING message; calling skipWaiting()')
      ;(self as any).skipWaiting()
      
      // Notifica todos os clientes sobre a mudança
      self.clients.matchAll().then(clients => {
        clients.forEach(client => {
          client.postMessage({ type: 'SKIP_WAITING_COMPLETE' });
        });
      });
    }
  } catch (e) {
    console.error('[SW] Error handling message', e)
  }
})

// Estratégia de cache para navegação (HTML) - com fallback offline
registerRoute(
  ({ request }) => request.mode === 'navigate',
  new NetworkFirst({
    cacheName: `${CACHE_NAME}-html`,
    networkTimeoutSeconds: 3,
    plugins: [
      {
        // Fallback para index.html quando offline
        handlerDidError: async () => {
          const cache = await caches.open(`${CACHE_NAME}-html`);
          const cachedResponse = await cache.match('/index.html');
          if (cachedResponse) {
            console.log('[SW] Retornando index.html do cache (offline)');
            return cachedResponse;
          }
          // Se não tem cache, retorna página offline básica
          return new Response(
            '<!DOCTYPE html><html><head><meta charset="utf-8"><title>Offline</title></head><body><h1>Você está offline</h1><p>Conecte-se à internet para acessar o aplicativo.</p></body></html>',
            { headers: { 'Content-Type': 'text/html' } }
          );
        },
      },
    ],
  })
)

// Estratégia para assets estáticos (JS, CSS, imagens, etc.) - CacheFirst para melhor offline
registerRoute(
  ({ request }) => 
    request.destination === 'script' || 
    request.destination === 'style' ||
    request.destination === 'image' ||
    request.destination === 'font',
  new CacheFirst({
    cacheName: `${CACHE_NAME}-assets`,
    plugins: [
      new ExpirationPlugin({
        maxEntries: 200,
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

// Estratégia para recursos Firebase (evitar 404s)
registerRoute(
  ({ url }) => url.origin.includes('firebase') || url.origin.includes('googleapis'),
  new NetworkFirst({
    cacheName: `${CACHE_NAME}-firebase`,
    networkTimeoutSeconds: 10,
    plugins: [
      new ExpirationPlugin({
        maxEntries: 50,
        maxAgeSeconds: 60 * 60 * 24, // 24 horas
      })
    ]
  })
)

// Fallback para recursos não encontrados
registerRoute(
  ({ request }) => request.destination === 'script' || request.destination === 'style',
  async ({ request }) => {
    try {
      const response = await fetch(request)
      return response
    } catch (error) {
      console.warn('[SW] Recurso não encontrado, tentando cache:', request.url)
      const cached = await caches.match(request)
      return cached || new Response('Resource not found', { status: 404 })
    }
  }
)
