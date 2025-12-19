/// <reference lib="webworker" />
declare const self: ServiceWorkerGlobalScope

const CACHE_NAME = 'frota-xingu-v3'
const URLS_TO_CACHE = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
  '/icons/icon-192.png',
  '/icons/icon-512.png'
]

console.log('[SW] Service Worker simplificado carregando...')

// ============================================================================
// INSTALL - Cache tudo de uma vez
// ============================================================================
self.addEventListener('install', (event) => {
  console.log('[SW] Instalando e cacheando arquivos essenciais')
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('[SW] Cache aberto, adicionando arquivos...')
        return cache.addAll(URLS_TO_CACHE)
      })
      .then(() => {
        console.log('[SW] Todos os arquivos cacheados com sucesso')
        return self.skipWaiting()
      })
      .catch(err => {
        console.error('[SW] Erro no cache:', err)
        return self.skipWaiting()
      })
  )
})

// ============================================================================
// ACTIVATE - Limpa caches antigos
// ============================================================================
self.addEventListener('activate', (event) => {
  console.log('[SW] Ativando e limpando caches antigos')
  event.waitUntil(
    caches.keys()
      .then(cacheNames => {
        return Promise.all(
          cacheNames.map(cacheName => {
            if (cacheName !== CACHE_NAME) {
              console.log('[SW] Removendo cache antigo:', cacheName)
              return caches.delete(cacheName)
            }
          })
        )
      })
      .then(() => {
        console.log('[SW] Assumindo controle')
        return self.clients.claim()
      })
  )
})

// ============================================================================
// FETCH - Estratégia simples: CACHE FIRST
// ============================================================================
self.addEventListener('fetch', (event) => {
  const { request } = event
  const url = new URL(request.url)
  
  // Deixa Firebase passar (SDK lida com offline)
  if (url.hostname.includes('firebase')) {
    return
  }
  
  // Apenas requisições do mesmo domínio
  if (url.origin !== self.location.origin) {
    return
  }
  
  event.respondWith(
    (async () => {
      try {
        // Tenta cache primeiro
        const cachedResponse = await caches.match(request)
        if (cachedResponse) {
          console.log('[SW] Cache hit:', request.url)
          return cachedResponse
        }
        
        // Cache miss - busca da rede e salva no cache
        const networkResponse = await fetch(request)
        
        // Verifica se resposta é válida
        if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
          return networkResponse
        }
        
        // Salva no cache para próximas requisições
        const responseToCache = networkResponse.clone()
        const cache = await caches.open(CACHE_NAME)
        cache.put(request, responseToCache)
        
        return networkResponse
      } catch (error) {
        // Se falhar rede e for navegação, retorna index.html
        if (request.mode === 'navigate') {
          console.log('[SW] Offline - retornando index.html')
          const offlineResponse = await caches.match('/index.html')
          return offlineResponse || new Response('Offline - App não disponível', { status: 503 })
        }
        
        // Para outros recursos, retorna erro
        return new Response('Offline', { status: 503 })
      }
    })()
  )
})

console.log('[SW] Service Worker simplificado pronto!')
