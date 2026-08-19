/*
 * PROJECT ZERO — service worker.
 *
 * Goal: the app opens at the pitch even with no signal, showing the last pages
 * you visited. Writes are NOT handled here — sessions and test results captured
 * offline go through the localStorage queue in src/lib/offline/queue.ts, which
 * replays them on reconnection.
 *
 * Bump CACHE_VERSION whenever the caching strategy changes.
 */
const CACHE_VERSION = "v2";
const STATIC_CACHE = `pz-static-${CACHE_VERSION}`;
const PAGE_CACHE = `pz-pages-${CACHE_VERSION}`;
// A plain HTML file: the fallback must render with no framework runtime, since
// the JS chunks of a page you never visited were never downloaded either.
const OFFLINE_URL = "/offline.html";

const PRECACHE = [OFFLINE_URL, "/manifest.webmanifest", "/icon-192.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(STATIC_CACHE)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== STATIC_CACHE && key !== PAGE_CACHE)
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

/** Build output under /_next/static is content-hashed, so it never goes stale. */
function isImmutableAsset(url) {
  return (
    url.pathname.startsWith("/_next/static/") ||
    url.pathname === "/manifest.webmanifest" ||
    /\.(png|svg|ico|woff2?)$/.test(url.pathname)
  );
}

self.addEventListener("fetch", (event) => {
  const { request } = event;

  // Never touch writes: server actions are POSTs and must reach the network or
  // fail loudly so the client can queue them.
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (isImmutableAsset(url)) {
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ||
          fetch(request).then((response) => {
            if (response.ok) {
              const copy = response.clone();
              caches.open(STATIC_CACHE).then((cache) => cache.put(request, copy));
            }
            return response;
          }),
      ),
    );
    return;
  }

  if (request.mode === "navigate") {
    // Network first: the data on these pages is user data and must be fresh
    // whenever the network allows. The cache is the pitch-side fallback.
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(PAGE_CACHE).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(async () => {
          const cached = await caches.match(request, { ignoreSearch: true });
          return cached || caches.match(OFFLINE_URL);
        }),
    );
  }
});
