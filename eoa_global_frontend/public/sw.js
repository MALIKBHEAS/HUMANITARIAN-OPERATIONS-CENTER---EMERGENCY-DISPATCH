// EOA Global Tactical Operations Service Worker
// Offline Caching for Application Shell, Typography, and Geospatial Assets

const CACHE_NAME = 'eoa-tactical-v1';
const PRECACHE_ASSETS = [
  '/',
  '/index.html',
  '/styles/tactical-dark.json',
  '/fonts/fonts.css',
  '/vendor/mapbox-gl-rtl-text.js',
  '/tiles/manifest.json'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(PRECACHE_ASSETS);
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Skip WebSocket, API, and Range requests (PMTiles range requests are handled by IndexedDBSource)
  if (
    url.pathname.startsWith('/api/') ||
    url.pathname.startsWith('/ws/') ||
    event.request.headers.has('range')
  ) {
    return;
  }

  // Cache-First strategy for static assets and typography
  if (
    url.pathname.startsWith('/assets/') ||
    url.pathname.startsWith('/fonts/') ||
    url.pathname.startsWith('/vendor/') ||
    url.pathname.startsWith('/styles/')
  ) {
    event.respondWith(
      caches.match(event.request).then((cached) => {
        if (cached) return cached;
        return fetch(event.request).then((response) => {
          if (response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return response;
        });
      })
    );
    return;
  }

  // Network-First strategy with cache fallback for navigation / app shell
  if (event.request.mode === 'navigate' || url.pathname === '/' || url.pathname.endsWith('.html')) {
    event.respondWith(
      fetch(event.request).catch(() => {
        return caches.match('/index.html');
      })
    );
    return;
  }
});
