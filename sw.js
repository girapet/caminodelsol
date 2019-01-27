/* eslint-env serviceworker */

const VERSION = '1.0.1';

const precacheFileNames = [
  './',
  './index.html'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(VERSION)
      .then(cache => cache.addAll(precacheFileNames))
      .then(self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(cacheNames => cacheNames.filter(cacheName => cacheName !== VERSION))
      .then(cachesToDelete => Promise.all(cachesToDelete.map(cacheToDelete => caches.delete(cacheToDelete))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }

      return caches.open(VERSION)
        .then(cache => fetch(event.request)
          .then(response => cache.put(event.request, response.clone())
            .then(() => response)));
    })
  );
});
