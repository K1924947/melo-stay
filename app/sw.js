// Guest app shell only. Scope is /app/, so the live homepage is untouched.
// prices.json sits at the site root; StaticDataSource fetches it network-first.

const CACHE = 'melo-guest-v5';

const SHELL = [
  '/app/',
  '/app/index.html',
  '/app/css/app.css',
  '/app/manifest.json',
  '/app/js/app.js',
  '/app/js/catalog.js',
  '/app/js/channel-manager.js',
  '/app/js/data-source.js',
  '/app/js/dom.js',
  '/app/js/format.js',
  '/app/js/i18n.js',
  '/app/js/pricing.js',
  '/app/js/schema.js',
  '/app/js/static-source.js',
  '/app/js/stats.js',
  '/app/js/bookings-source.js',
  '/app/js/booking-view.js',
  '/app/js/messages-view.js',
  '/app/data/demo-bookings.json',
  '/app/icons/icon-192.png',
  '/app/icons/icon-512.png',
  '/app/icons/icon-maskable-512.png',
  '/app/icons/apple-touch-icon.png',
  '/app/icons/favicon-32.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(
    keys.filter((key) => key.startsWith('melo-guest-') && key !== CACHE).map((key) => caches.delete(key))
  )).then(() => self.clients.claim()));
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin || !url.pathname.startsWith('/app/')) return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    try {
      const fresh = await fetch(request);
      if (fresh && fresh.ok) cache.put(request, fresh.clone()).catch(() => {});
      return fresh;
    } catch (err) {
      const cached = await cache.match(request) || await cache.match('/app/index.html');
      if (cached) return cached;
      throw err;
    }
  })());
});
