const CACHE_NAME = 'app-frota-cache-v3';

// Instala o novo SW
self.addEventListener('install', (event) => {
  // Não chama skipWaiting automaticamente - espera mensagem do cliente
  console.log('[SW] Nova versão instalada, aguardando ativação...');
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

  // Para arquivos de assets (JS, CSS), sempre busca da rede primeiro
  const url = new URL(request.url);
  const isAsset = url.pathname.startsWith('/assets/');
  
  if (isAsset) {
    // Network only para assets - garante versão mais recente
    event.respondWith(
      fetch(request).catch(() => caches.match(request))
    );
    return;
  }

  // Para navegação e outros recursos: Network first, fallback to cache
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

        if (request.mode === 'navigate') {
          return caches.match('/');
        }

        return new Response('Offline', { status: 503 });
      })
  );
});
