/// <reference lib="webworker" />
/* eslint-disable no-restricted-globals */
import { precacheAndRoute } from 'workbox-precaching'
import { registerRoute } from 'workbox-routing'
import { CacheFirst, StaleWhileRevalidate } from 'workbox-strategies'
import { CacheableResponsePlugin } from 'workbox-cacheable-response'
import { ExpirationPlugin } from 'workbox-expiration'

declare const self: ServiceWorkerGlobalScope

// ============================================================================
// CONFIGURAÇÃO DO CACHE - VERSÃO 2.0.0 - OFFLINE FIRST
// ============================================================================
const CACHE_VERSION = '2.0.0'
const CACHE_NAME = `frota-xingu-v${CACHE_VERSION}`
const RUNTIME_CACHE = `${CACHE_NAME}-runtime`
const OFFLINE_PAGE = '/index.html'

console.log('[SW] 🚀 Service Worker v' + CACHE_VERSION + ' carregando...')

// ============================================================================
// PRECACHE - Workbox injeta automaticamente os assets do build
// ============================================================================
precacheAndRoute(self.__WB_MANIFEST || [])

// ============================================================================
// INSTALL - Cache agressivo do app shell
// ============================================================================
self.addEventListener('install', (event: ExtendableEvent) => {
  console.log('[SW] 📦 Instalando Service Worker v' + CACHE_VERSION)
  
  event.waitUntil(
    caches.open(RUNTIME_CACHE)
      .then(cache => {
        console.log('[SW] 💾 Fazendo cache do app shell')
        // Cache essencial para funcionamento offline
        return cache.addAll([
          '/',
          '/index.html',
          '/icons/icon-192.png',
          '/icons/icon-512.png',
        ])
      })
      .then(() => {
        console.log('[SW] ✅ Cache do app shell completo')
        return self.skipWaiting()
      })
      .catch(err => {
        console.error('[SW] ❌ Erro no precache:', err)
        // Continua mesmo com erro - o app ainda pode funcionar
        return self.skipWaiting()
      })
  )
})

// ============================================================================
// ACTIVATE - Limpa caches antigos e assume controle
// ============================================================================
self.addEventListener('activate', (event: ExtendableEvent) => {
  console.log('[SW] 🔄 Ativando Service Worker v' + CACHE_VERSION)
  
  event.waitUntil(
    caches.keys()
      .then(cacheNames => {
        return Promise.all(
          cacheNames.map(cacheName => {
            if (!cacheName.startsWith(CACHE_NAME)) {
              console.log('[SW] 🗑️ Removendo cache antigo:', cacheName)
              return caches.delete(cacheName)
            }
          })
        )
      })
      .then(() => {
        console.log('[SW] ✅ Assumindo controle de todos os clientes')
        return self.clients.claim()
      })
  )
})

// ============================================================================
// MESSAGE - Comunicação com o app
// ============================================================================
self.addEventListener('message', (event: any) => {
  const data = event.data
  
  if (data === 'SKIP_WAITING' || (data && data.type === 'SKIP_WAITING')) {
    console.log('[SW] ⏭️ SKIP_WAITING recebido')
    self.skipWaiting()
  }
})

// ============================================================================
// FETCH - Estratégia OFFLINE FIRST simplificada e mais robusta
// ============================================================================
self.addEventListener('fetch', (event: FetchEvent) => {
  const { request } = event
  const url = new URL(request.url)
  
  // Ignora requisições não-HTTP
  if (!request.url.startsWith('http')) {
    return
  }
  
  // Ignora Firebase Auth/Firestore (deixa SDK lidar)
  if (
    url.hostname.includes('firebaseapp.com') ||
    url.hostname.includes('firebaseio.com') ||
    url.hostname.includes('firestore.googleapis.com') ||
    url.hostname.includes('identitytoolkit.googleapis.com') ||
    url.hostname.includes('securetoken.googleapis.com')
  ) {
    return
  }
  
  // ========================================================================
  // NAVEGAÇÃO (HTML) - CACHE FIRST com fallback garantido
  // ========================================================================
  if (request.mode === 'navigate') {
    event.respondWith(
      (async () => {
        try {
          // Tenta cache primeiro
          const cachedResponse = await caches.match(request)
          if (cachedResponse) {
            console.log('[SW] 📄 Navegação do CACHE:', url.pathname)
            return cachedResponse
          }
          
          // Tenta rede
          const networkResponse = await fetch(request)
          if (networkResponse.ok) {
            const responseClone = networkResponse.clone()
            const cache = await caches.open(RUNTIME_CACHE)
            cache.put(request, responseClone)
          }
          return networkResponse
        } catch (error) {
          console.log('[SW] 🔌 OFFLINE - Usando fallback para:', url.pathname)
          
          // Tenta index.html do cache
          const offlineResponse = await caches.match(OFFLINE_PAGE)
          if (offlineResponse) {
            return offlineResponse
          }
          
          // Último recurso - página offline inline
          return new Response(
            '<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Offline - Frota Xingu</title><style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:system-ui,-apple-system,sans-serif;background:#0d2d6c;color:#fff;display:flex;align-items:center;justify-content:center;min-height:100vh;padding:2rem;text-align:center}h1{color:#ffd300;font-size:2rem;margin-bottom:1rem}p{margin-bottom:1.5rem;opacity:.9}button{background:#ffd300;color:#0d2d6c;border:none;padding:1rem 2rem;font-size:1rem;font-weight:bold;border-radius:8px;cursor:pointer;transition:transform .2s}button:active{transform:scale(.95)}</style></head><body><div><h1>🔌 Você está offline</h1><p>O aplicativo Frota Xingu está funcionando offline. Conecte-se à internet para sincronizar seus dados.</p><button onclick="location.reload()">Tentar novamente</button></div></body></html>',
            { headers: { 'Content-Type': 'text/html; charset=utf-8' } }
          )
        }
      })()
    )
    return
  }
  
  // ========================================================================
  // ASSETS (JS, CSS, imagens, fontes) - CACHE FIRST
  // ========================================================================
  if (
    request.destination === 'script' ||
    request.destination === 'style' ||
    request.destination === 'image' ||
    request.destination === 'font'
  ) {
    event.respondWith(
      (async () => {
        try {
          // Tenta cache primeiro
          const cachedResponse = await caches.match(request)
          if (cachedResponse) {
            return cachedResponse
          }
          
          // Tenta rede
          const networkResponse = await fetch(request)
          if (networkResponse.ok) {
            const responseClone = networkResponse.clone()
            const cache = await caches.open(RUNTIME_CACHE)
            cache.put(request, responseClone)
          }
          return networkResponse
        } catch (error) {
          // Se falhar, tenta do cache novamente ou retorna erro 404
          const cachedResponse = await caches.match(request)
          return cachedResponse || new Response('', { status: 404 })
        }
      })()
    )
    return
  }
  
  // ========================================================================
  // API requests - Deixa passar (não cacheia)
  // ========================================================================
  if (url.pathname.startsWith('/api/')) {
    return
  }
})

// ============================================================================
// ROTAS ADICIONAIS COM WORKBOX
// ============================================================================

// Firebase Storage - Cache com expiração
registerRoute(
  ({ url }) => url.hostname.includes('firebasestorage.googleapis.com'),
  new CacheFirst({
    cacheName: `${CACHE_NAME}-firebase-storage`,
    plugins: [
      new CacheableResponsePlugin({ statuses: [0, 200] }),
      new ExpirationPlugin({
        maxEntries: 100,
        maxAgeSeconds: 60 * 60 * 24 * 30, // 30 dias
      }),
    ],
  })
)

// Google Fonts - Cache permanente
registerRoute(
  ({ url }) => url.origin === 'https://fonts.googleapis.com' || url.origin === 'https://fonts.gstatic.com',
  new StaleWhileRevalidate({
    cacheName: `${CACHE_NAME}-google-fonts`,
    plugins: [
      new CacheableResponsePlugin({ statuses: [0, 200] }),
      new ExpirationPlugin({
        maxEntries: 30,
        maxAgeSeconds: 60 * 60 * 24 * 365, // 1 ano
      }),
    ],
  })
)

console.log('[SW] ✅ Service Worker v' + CACHE_VERSION + ' pronto!')
