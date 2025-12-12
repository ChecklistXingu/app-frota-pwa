const CACHE_NAME = 'app-frota-cache-v4';

// Arquivos essenciais para funcionar offline
const PRECACHE_URLS = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
  '/icons/icon-192.svg',
];

// Instala o novo SW e faz pre-cache dos arquivos essenciais
self.addEventListener('install', (event) => {
  console.log('[SW] Instalando e fazendo pre-cache...');
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[SW] Pre-cacheando arquivos essenciais');
      return cache.addAll(PRECACHE_URLS);
    }).then(() => {
      console.log('[SW] Pre-cache concluído');
    }).catch((err) => {
      console.error('[SW] Erro no pre-cache:', err);
    })
  );
});

// Escuta mensagem para ativar imediatamente
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// Limpa caches antigos e assume controle
self.addEventListener('activate', (event) => {
  console.log('[SW] Ativando nova versão...');
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            console.log('[SW] Removendo cache antigo:', key);
            return caches.delete(key);
          }
          return undefined;
        })
      )
    ).then(() => {
      console.log('[SW] Assumindo controle dos clientes');
      return self.clients.claim();
    })
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;

  if (request.method !== 'GET') {
    return;
  }

  const url = new URL(request.url);

  // Ignora requisições para Firebase/APIs externas
  if (url.origin !== self.location.origin) {
    return;
  }

  // Para arquivos de assets (JS, CSS) - Cache first, network fallback
  // Assets têm hash no nome, então são imutáveis
  const isAsset = url.pathname.startsWith('/assets/');
  
  if (isAsset) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) {
          return cached;
        }
        // Se não tem em cache, busca e cacheia
        return fetch(request).then((response) => {
          if (response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return response;
        });
      })
    );
    return;
  }

  // Para navegação (páginas HTML): Network first, cache fallback
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return response;
        })
        .catch(() => {
          // Offline - retorna index.html do cache (SPA)
          return caches.match('/index.html').then((cached) => {
            return cached || caches.match('/');
          });
        })
    );
    return;
  }

  // Para outros recursos: Network first, cache fallback
  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response.status === 200) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
        }
        return response;
      })
      .catch(async () => {
        const cached = await caches.match(request);
        if (cached) return cached;
        return new Response('Offline', { status: 503 });
      })
  );
});
