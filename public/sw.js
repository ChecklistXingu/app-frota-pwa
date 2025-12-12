const CACHE_NAME = 'app-frota-cache-v2';

// Instala e força ativação imediata
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

// Limpa caches antigos e assume controle
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
          return undefined;
        })
      )
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;

  if (request.method !== 'GET') {
    return;
  }

  // Network first, fallback to cache
  event.respondWith(
    fetch(request)
      .then((response) => {
        // Só cacheia respostas válidas
        if (response.status === 200) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
        }
        return response;
      })
      .catch(async () => {
        const cached = await caches.match(request);
        if (cached) return cached;

        if (request.mode === 'navigate') {
          return caches.match('/');
        }

        return new Response('Offline', { status: 503 });
      })
  );
});
