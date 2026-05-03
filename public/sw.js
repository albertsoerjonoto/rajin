// Bump CACHE_VERSION whenever the cache strategy or shell changes.
// The activate handler purges any cache that doesn't match.
const CACHE_VERSION = 'v3';
const RUNTIME_CACHE = `rajin-runtime-${CACHE_VERSION}`;
const STATIC_CACHE = `rajin-static-${CACHE_VERSION}`;

const APP_SHELL = [
  '/manifest.json',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => k !== RUNTIME_CACHE && k !== STATIC_CACHE)
          .map((k) => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

// Stale-while-revalidate: serve from cache instantly, fetch fresh in the
// background, then update the cache. Beats network-first for perceived speed
// because we never block on the network.
self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  // Skip cross-origin, API, and Supabase auth/realtime traffic — those need
  // network freshness and would break if served stale.
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/api/')) return;
  if (url.pathname.startsWith('/auth/')) return;

  // Hashed _next/static assets are immutable; cache-first is correct.
  if (url.pathname.startsWith('/_next/static/')) {
    event.respondWith(cacheFirst(req));
    return;
  }

  // Everything else: SWR.
  event.respondWith(staleWhileRevalidate(req));
});

async function cacheFirst(req) {
  const cache = await caches.open(STATIC_CACHE);
  const hit = await cache.match(req);
  if (hit) return hit;
  const res = await fetch(req);
  if (res.ok) cache.put(req, res.clone());
  return res;
}

async function staleWhileRevalidate(req) {
  const cache = await caches.open(RUNTIME_CACHE);
  const cached = await cache.match(req);
  const network = fetch(req)
    .then((res) => {
      if (res.ok) cache.put(req, res.clone());
      return res;
    })
    .catch(() => cached);
  return cached || network;
}
