// Service worker for the melo stay app.
// Scope is the whole origin so /prices.json can be network-first.
// Requests that are not the app or prices.json are left untouched,
// including the marketing homepage at /.

const CACHE = 'melo-app-v1';

const SHELL = [
  '/app/',
  '/app/index.html',
  '/app/owner/',
  '/app/owner/index.html',
  '/app/css/app.css',
  '/app/manifest.json',
  '/app/js/app.js',
  '/app/js/catalog.js',
  '/app/js/channel-manager.js',
  '/app/js/data-source.js',
  '/app/js/dom.js',
  '/app/js/format.js',
  '/app/js/i18n.js',
  '/app/js/owner-i18n.js',
  '/app/js/owner.js',
  '/app/js/pricing.js',
  '/app/js/schema.js',
  '/app/js/static-source.js',
  '/app/data/room-overrides.json',
  '/app/icons/icon-192.png',
  '/app/icons/icon-512.png',
  '/app/icons/icon-maskable-512.png',
  '/app/icons/apple-touch-icon.png',
  '/app/icons/favicon-32.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(
      keys.filter((key) => key.startsWith('melo-app-') && key !== CACHE).map((key) => caches.delete(key))
    )).then(() => self.clients.claim())
  );
});

async function networkFirst(request) {
  const cache = await caches.open(CACHE);
  try {
    const fresh = await fetch(request.url, { cache: 'no-store', credentials: 'same-origin' });
    if (fresh && fresh.ok && !fresh.redirected) {
      try { await cache.put(request, fresh.clone()); } catch (err) { /* ignore */ }
    }
    return fresh;
  } catch (err) {
    const cached = await cache.match(request);
    if (cached) return cached;
    if (request.mode === 'navigate') {
      const shell = await cache.match('/app/index.html') || await cache.match('/app/');
      if (shell) return shell;
    }
    throw err;
  }
}

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;
  let url;
  try { url = new URL(request.url); } catch (err) { return; }
  if (url.origin !== self.location.origin) return;
  if (url.pathname === '/prices.json' || url.pathname === '/app' || url.pathname.startsWith('/app/')) {
    event.respondWith(networkFirst(request));
  }
});
