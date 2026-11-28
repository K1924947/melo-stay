// Owner app shell. Scope is /owner/ only.
// prices.json is fetched network-first by the shared data layer.

const CACHE = 'melo-owner-v1';

const SHELL = [
  '/owner/',
  '/owner/index.html',
  '/owner/css/owner.css',
  '/owner/manifest.json',
  '/owner/js/app.js',
  '/owner/js/i18n.js',
  '/owner/icons/icon-192.png',
  '/owner/icons/icon-512.png',
  '/owner/icons/icon-maskable-512.png',
  '/owner/icons/apple-touch-icon.png',
  '/owner/icons/favicon-32.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(
    keys.filter((key) => key.startsWith('melo-owner-') && key !== CACHE).map((key) => caches.delete(key))
  )).then(() => self.clients.claim()));
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin || !url.pathname.startsWith('/owner/')) return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    try {
      const fresh = await fetch(request);
      if (fresh && fresh.ok) cache.put(request, fresh.clone()).catch(() => {});
      return fresh;
    } catch (err) {
      const cached = await cache.match(request) || await cache.match('/owner/index.html');
      if (cached) return cached;
      throw err;
    }
  })());
});
