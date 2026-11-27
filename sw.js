/* Guest app service worker.
   Controls the origin so /prices.json can be network-first, but only
   responds for /app/ and /prices.json. The marketing site is untouched. */
const CACHE = 'melo-guest-v2';
const SHELL = [
  '/app/index.html',
  '/app/copy.js',
  '/app/manifest.json',
  '/app/icons/icon-192.png',
  '/app/icons/icon-512.png',
  '/app/icons/icon-maskable-512.png',
  '/app/icons/apple-touch-icon.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    await cache.addAll(SHELL);
    const index = await cache.match('/app/index.html');
    if (index) {
      await cache.put('/app/', index.clone());
      await cache.put('/app', index.clone());
    }
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)));
    await self.clients.claim();
  })());
});

async function networkFirst(request, fallbackUrl) {
  const cache = await caches.open(CACHE);
  try {
    const res = await fetch(request);
    if (res && res.ok && res.type === 'basic') {
      try {
        const headers = new Headers(res.headers);
        headers.delete('cache-control');
        const copy = new Response(await res.clone().blob(), {
          status: res.status,
          statusText: res.statusText,
          headers: headers
        });
        await cache.put(request.url, copy);
      } catch (err) {}
    }
    return res;
  } catch (err) {
    const cached = (await cache.match(request)) || (fallbackUrl && await cache.match(fallbackUrl));
    if (cached) return cached;
    return new Response('', { status: 504, statusText: 'Offline' });
  }
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  let url;
  try { url = new URL(req.url); } catch (err) { return; }
  if (url.origin !== self.location.origin) return;

  if (url.pathname === '/prices.json') {
    event.respondWith(networkFirst(req));
    return;
  }

  if (url.pathname === '/app' || url.pathname === '/app/' || url.pathname.startsWith('/app/')) {
    const shell = (url.pathname === '/app' || url.pathname === '/app/' || url.pathname === '/app/index.html');
    event.respondWith(networkFirst(req, shell ? '/app/index.html' : null));
  }
});
