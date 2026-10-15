const CACHE_NAME = 'trustlend-v2';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icon.svg'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  // Delete ALL old caches on every activate so stale JS never gets served
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Skip non-http(s) requests (chrome-extension, moz-extension, etc.)
  if (!url.protocol.startsWith('http')) return;

  // Skip Vite dev server JS/TS modules — always fetch fresh so HMR works
  if (url.hostname === 'localhost' || url.hostname === '127.0.0.1') return;

  // Skip non-GET
  if (event.request.method !== 'GET') return;

  // For everything else (e.g. CDN assets), network-first
  event.respondWith(
    fetch(event.request).catch(() => caches.match(event.request))
  );
});
