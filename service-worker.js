/* Servo Skull Tracker service worker.
 * Bump CACHE_NAME whenever the app shell changes. The worker takes over
 * immediately (skipWaiting + clients.claim) instead of waiting for every
 * open tab to close, and it never caches itself.
 */
const CACHE_NAME = 'servo-skull-cache-v2';
const urlsToCache = [
  './',
  './index.html',
  './styles.css',
  './data.js',
  './state.js',
  './app.js',
  './manifest.webmanifest',
  './icon.svg',
  './icon-192.png',
  './icon-512.png',
  './icon-512-maskable.png',
  './apple-touch-icon.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(urlsToCache)).then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((cacheNames) =>
        Promise.all(
          cacheNames.map((cacheName) => {
            if (cacheName !== CACHE_NAME) return caches.delete(cacheName);
            return undefined;
          }),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET' || !request.url.startsWith(self.location.origin)) {
    return;
  }
  // Never cache the worker itself: a cached worker can pin an old version.
  if (new URL(request.url).pathname.endsWith('/service-worker.js')) {
    return;
  }
  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      if (cachedResponse) return cachedResponse;
      return fetch(request)
        .then((networkResponse) => {
          if (networkResponse.ok) {
            const clone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return networkResponse;
        })
        .catch(() => {
          // Offline: navigations fall back to the cached app shell.
          if (request.mode === 'navigate') return caches.match('./index.html');
          return caches.match('./');
        });
    }),
  );
});
