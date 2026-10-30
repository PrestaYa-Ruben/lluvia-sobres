/* PrestaYa - Lluvia de Sobres · Service Worker
   Cambia CACHE_VERSION cada vez que subas una actualización. */
const CACHE_VERSION = 'sobres-v1.16';

const APP_SHELL = [
  './',
  './index.html',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
  './icons/apple-touch-icon.png',
  './icons/favicon-32.png'
];

const CDN = [
  'https://cdn.tailwindcss.com',
  'https://cdn.jsdelivr.net/npm/canvas-confetti@1.6.0/dist/confetti.browser.min.js'
];

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_VERSION);
    await cache.addAll(APP_SHELL);
    // Los CDN se guardan aparte: si alguno falla, la instalación no se cae
    await Promise.all(CDN.map(async url => {
      try {
        const res = await fetch(url, { mode: 'no-cors' });
        await cache.put(url, res);
      } catch (e) {}
    }));
    self.skipWaiting();
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k !== CACHE_VERSION).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;

  // Páginas (incluye enlaces con ?inv= y ?admin): red primero, caché si no hay internet
  if (req.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const fresh = await fetch(req);
        const cache = await caches.open(CACHE_VERSION);
        cache.put('./index.html', fresh.clone());
        return fresh;
      } catch (e) {
        return (await caches.match('./index.html')) || (await caches.match('./'));
      }
    })());
    return;
  }

  // Resto (íconos, CDN): caché primero y actualiza en segundo plano
  event.respondWith((async () => {
    const cached = await caches.match(req, { ignoreSearch: true });
    const network = fetch(req).then(async res => {
      if (res && (res.ok || res.type === 'opaque')) {
        const cache = await caches.open(CACHE_VERSION);
        cache.put(req, res.clone());
      }
      return res;
    }).catch(() => cached);
    return cached || network;
  })());
});
