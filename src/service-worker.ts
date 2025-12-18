/// <reference lib="webworker" />
/* eslint-disable no-restricted-globals */
import { precacheAndRoute } from 'workbox-precaching'
import { registerRoute } from 'workbox-routing'
import { NetworkFirst, CacheFirst } from 'workbox-strategies'
import { ExpirationPlugin } from 'workbox-expiration'

declare const self: ServiceWorkerGlobalScope

// Nome do cache atual - deve ser declarado antes de usar
// Incrementar esta versão força a limpeza de todos os caches antigos
const CACHE_VERSION = '1.0.7'
const CACHE_NAME = `frota-xingu-v${CACHE_VERSION}`
const OFFLINE_URL = '/index.html'

// Workbox will replace this with the manifest array at build time
// @ts-ignore
precacheAndRoute(self.__WB_MANIFEST || [])

// Install: ativar imediatamente a nova versão do service worker
self.addEventListener('install', (event: ExtendableEvent) => {
  console.log('[SW] Install event - Nova versão detectada')
  
  // Força o cache do shell do app para garantir funcionamento offline
  event.waitUntil(
    caches.open(`${CACHE_NAME}-html`).then(cache => {
      console.log('[SW] Fazendo precache do app shell para offline')
      return cache.addAll([
        '/',
        OFFLINE_URL,
      ]).catch(err => {
        console.warn('[SW] Erro ao fazer precache:', err)
        // Mesmo com erro, continua a instalação
        return Promise.resolve()
      })
    }).then(() => {
      console.log('[SW] Precache concluído, ativando imediatamente')
      return self.skipWaiting()
    })
  )
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

// Estratégia de cache para navegação (HTML) - CacheFirst para melhor offline
registerRoute(
  ({ request }) => request.mode === 'navigate',
  async ({ request, event }) => {
    const cache = await caches.open(`${CACHE_NAME}-html`);
    
    // Tenta buscar do cache primeiro
    const cachedResponse = await cache.match(request);
    if (cachedResponse) {
      console.log('[SW] Retornando navegação do cache');
      // Atualiza o cache em background se houver rede
      if (event) {
        event.waitUntil(
          fetch(request).then(response => {
            if (response.ok) {
              cache.put(request, response.clone());
            }
          }).catch(() => {})
        );
      }
      return cachedResponse;
    }
    
    // Se não tem no cache, tenta a rede
    try {
      const networkResponse = await fetch(request);
      if (networkResponse.ok) {
        cache.put(request, networkResponse.clone());
      }
      return networkResponse;
    } catch (error) {
      // Se falhar, tenta retornar index.html do cache
      console.log('[SW] Rede falhou, tentando index.html do cache');
      const indexResponse = await cache.match(OFFLINE_URL) || await cache.match('/');
      if (indexResponse) {
        console.log('[SW] Retornando index.html do cache como fallback');
        return indexResponse;
      }
      
      // Último recurso: página offline básica
      console.warn('[SW] Nenhum cache disponível, retornando página offline básica');
      return new Response(
        '<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Offline - Frota Xingu</title><style>body{font-family:system-ui;padding:2rem;text-align:center;background:#0d2d6c;color:#fff}h1{color:#ffd300}button{padding:1rem 2rem;font-size:1rem;background:#ffd300;color:#0d2d6c;border:none;border-radius:8px;cursor:pointer;margin-top:1rem;font-weight:bold}</style></head><body><h1>⚠️ App Offline</h1><p>O aplicativo está disponível offline, mas precisa ser acessado online pelo menos uma vez.</p><p>Conecte-se à internet e recarregue a página.</p><button onclick="location.reload()">Tentar novamente</button></body></html>',
        { headers: { 'Content-Type': 'text/html; charset=utf-8' } }
      );
    }
  }
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

// Handler global de fetch para garantir que todas as requisições sejam interceptadas
self.addEventListener('fetch', (event: FetchEvent) => {
  // Ignora requisições que não são HTTP/HTTPS
  if (!event.request.url.startsWith('http')) {
    return;
  }

  // Ignora requisições para Firebase Auth e Firestore (deixa o Firebase SDK lidar)
  if (
    event.request.url.includes('firebaseapp.com') ||
    event.request.url.includes('firebaseio.com') ||
    event.request.url.includes('googleapis.com/identitytoolkit') ||
    event.request.url.includes('securetoken.googleapis.com')
  ) {
    return;
  }

  // Log para debug
  if (event.request.mode === 'navigate') {
    console.log('[SW] Interceptando navegação:', event.request.url);
  }
});
