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
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE_VERSION).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // INKWELL is a separate app published under /inkwell/, inside this worker's
  // scope but nothing to do with the tracker. Leave it entirely alone.
  //
  // Without this, the stale-while-revalidate below would hand back a cached
  // copy of INKWELL's index.html on every visit and only refresh it in the
  // background, pinning it one deploy behind for good — and its build assets
  // would accumulate in a cache meant for the tracker.
  // Lowercased because a mis-cased /Inkwell/ still resolves to INKWELL via
  // the 404 page's redirect, and caching that round trip would be pointless.
  if (url.pathname.toLowerCase().includes('/inkwell/')) return;

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
