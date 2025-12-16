/// <reference lib="webworker" />
/* eslint-disable no-restricted-globals */
import { precacheAndRoute } from 'workbox-precaching'

// Workbox will replace this with the manifest array at build time
// @ts-ignore
precacheAndRoute(self.__WB_MANIFEST || [])

// Install: ativar imediatamente a nova versão do service worker
self.addEventListener('install', () => {
  // Do NOT call skipWaiting() here so the newly installed worker stays in
  // 'waiting' state. This allows the UI to show an update prompt and give
  // the user control to apply the update (via SKIP_WAITING message).
  console.log('[SW] install - installed (waiting for activation)')
})

// Activate: assumir controle das abas/janelas já abertas
self.addEventListener('activate', (event: any) => {
  console.log('[SW] activate - clients.claim')
  event.waitUntil((self as any).clients.claim())
})

// Durante a ativação, tenta limpar caches antigos explicitamente para forçar a
// remoção de assets obsoletos caso algo não tenha sido limpo automaticamente.
self.addEventListener('activate', (event: any) => {
  event.waitUntil((async () => {
    try {
      const cacheNames = await caches.keys();
      // Apenas loga caches relacionados ao workbox para diagnóstico
      cacheNames.forEach((name) => {
        if (name.includes('workbox')) {
          console.log('[SW] active - cache present:', name)
        }
      });
    } catch (e) {
      console.error('[SW] Error during cache cleanup', e)
    }
  })())
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
