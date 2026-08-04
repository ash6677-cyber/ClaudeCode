'use strict';

const CACHE_VERSION = 'fc-career-tracker-v21';
const CORE_ASSETS = [
  './',
  './index.html',
  './assets/style.css',
  './assets/app.js',
  './assets/trophy3d.js',
  './assets/vendor/three.module.min.js',
  './assets/vendor/three.core.min.js',
  './manifest.webmanifest',
  './assets/icons/icon-192.png',
  './assets/icons/icon-512.png'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_VERSION)
      .then(cache => cache.addAll(CORE_ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  // Own caches only. This origin is shared with INKWELL, and deleting every
  // cache that isn't ours meant the two workers destroyed each other's
  // offline support on every update.
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys
          .filter(k => k.startsWith('fc-career-tracker-') && k !== CACHE_VERSION)
          .map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // Only requests inside this worker's own scope. The tracker used to own
  // the site root with INKWELL carved out by path — and when the deploy
  // swapped them, that stale carve-out left old registrations serving the
  // tracker's cached menu over INKWELL. A scope check cannot go stale the
  // same way: wherever this worker is mounted, it only ever answers for
  // its own directory.
  if (!url.href.startsWith(self.registration.scope)) return;

  event.respondWith(
    caches.open(CACHE_VERSION).then(cache =>
      cache.match(req).then(cached => {
        const networkFetch = fetch(req).then(res => {
          if (res && res.status === 200) cache.put(req, res.clone());
          return res;
        }).catch(() => cached);
        return cached || networkFetch;
      })
    )
  );
});
