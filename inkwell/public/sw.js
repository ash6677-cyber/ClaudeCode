'use strict'

/**
 * INKWELL's service worker.
 *
 * Its job is twofold: let the app open with no connection, and make the
 * browser treat this as an installed application rather than a page that
 * happened to be visited. The second matters more than it sounds — iOS
 * Safari deletes IndexedDB for ordinary sites after seven days without a
 * visit, and a manuscript is not something to lose to a fortnight's break.
 *
 * Caching is entirely at runtime. A precomputed list of built filenames
 * would have to be regenerated on every deploy and would silently rot the
 * moment it wasn't, which is the failure this deliberately avoids.
 */

const VERSION = 'inkwell-v1'
const SHELL = `${VERSION}-shell`
const ASSETS = `${VERSION}-assets`

self.addEventListener('install', () => {
  // Nothing is precached, so there is nothing to wait for.
  self.skipWaiting()
})

/**
 * Cache cleanup, scoped to what is actually ours.
 *
 * Cache storage is origin-global, and this origin is shared with FC Career
 * Tracker at /tracker/. The first version of this handler deleted every
 * cache it did not own — which meant the two workers deleted each other's
 * caches on every update, quietly breaking offline support for whichever
 * app updated second. Own prefix only, now.
 *
 * The second loop is the cure for a specific poisoning. The tracker owned
 * this scope before INKWELL did, and its worker cached the tracker's pages
 * under *this scope's* URLs — which is exactly what served writers the
 * tracker's dead menu instead of INKWELL. Those entries are keyed by URL
 * inside the tracker's cache, so they are removed individually; the cache
 * itself is the live tracker's property and stays.
 */
self.addEventListener('activate', (event) => {
  const scope = self.registration.scope
  const trackerPrefix = new URL('tracker/', scope).toString()
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.map(async (key) => {
            if (key.startsWith('inkwell-')) {
              if (key !== SHELL && key !== ASSETS) await caches.delete(key)
              return
            }
            // A foreign cache. Leave it alive, but evict anything it holds
            // for URLs inside our scope (the tracker's own /tracker/ URLs
            // are inside our scope too, and are not ours to touch).
            const cache = await caches.open(key)
            const entries = await cache.keys()
            await Promise.all(
              entries
                .filter((req) => req.url.startsWith(scope) && !req.url.startsWith(trackerPrefix))
                .map((req) => cache.delete(req)),
            )
          }),
        ),
      )
      .then(() => self.clients.claim()),
  )
})

/** The app shell for this worker's scope — one entry, whatever the base path. */
function shellUrl() {
  return new URL('./', self.registration.scope).toString()
}

self.addEventListener('fetch', (event) => {
  const req = event.request
  if (req.method !== 'GET') return

  const url = new URL(req.url)
  if (url.origin !== self.location.origin) return

  // FC Career Tracker lives beside this app and brings its own worker.
  if (url.pathname.toLowerCase().includes('/tracker/')) return

  // Navigations: always prefer the network so a deploy is picked up at once,
  // but fall back to the cached shell so the app still opens offline. Hash
  // routing means every route resolves to this same document.
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res && res.ok) {
            const copy = res.clone()
            caches.open(SHELL).then((c) => c.put(shellUrl(), copy))
          }
          return res
        })
        .catch(() =>
          caches
            .open(SHELL)
            .then((c) => c.match(shellUrl()))
            .then((hit) => hit || Response.error()),
        ),
    )
    return
  }

  // Built assets carry a content hash in the filename, so a given URL can
  // never change meaning. Serve them from cache without revalidating.
  if (url.pathname.includes('/assets/')) {
    event.respondWith(
      caches.open(ASSETS).then((cache) =>
        cache.match(req).then((hit) => {
          if (hit) return hit
          return fetch(req).then((res) => {
            if (res && res.ok) cache.put(req, res.clone())
            return res
          })
        }),
      ),
    )
    return
  }

  // Everything else same-origin — icons, the manifest — is served from cache
  // and refreshed behind the scenes.
  event.respondWith(
    caches.open(SHELL).then((cache) =>
      cache.match(req).then((hit) => {
        const network = fetch(req)
          .then((res) => {
            if (res && res.ok) cache.put(req, res.clone())
            return res
          })
          .catch(() => hit)
        return hit || network
      }),
    ),
  )
})
