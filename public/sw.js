// SAMS service worker — turns the app into an installable, offline-capable PWA.
//
// Deliberately conservative: it only ever touches same-origin GET requests for
// the app shell + static assets. It NEVER intercepts:
//   • the runtime API (`/api/**`) — the live SSE stream is `/api/events` and
//     assign/settings/etc. are POST/DELETE; caching them would break the app;
//   • Commit Garden public pages (`/u/**`), served by the runtime;
//   • any non-GET request.
// Static assets use stale-while-revalidate; navigations are network-first with
// the cached shell as the offline fallback. Vite fingerprints asset filenames,
// so runtime caching keeps us correct across deploys without a precache list.

const CACHE = "sams-shell-v1";
const SHELL = ["/", "/index.html", "/favicon.svg", "/manifest.webmanifest"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(SHELL))
      .then(() => self.skipWaiting())
      .catch(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

// Let the page trigger an immediate update ("nuova versione" → skipWaiting).
self.addEventListener("message", (event) => {
  if (event.data === "skip-waiting") self.skipWaiting();
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return; // never cache mutations
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // only same-origin
  if (url.pathname.startsWith("/api") || url.pathname.startsWith("/u")) return; // runtime/API + garden

  // SPA navigations: network-first, fall back to the cached shell when offline.
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put("/index.html", copy)).catch(() => {});
          return res;
        })
        .catch(() => caches.match("/index.html").then((m) => m || caches.match("/"))),
    );
    return;
  }

  // Static assets: serve from cache immediately, refresh in the background.
  event.respondWith(
    caches.match(req).then((cached) => {
      const network = fetch(req)
        .then((res) => {
          if (res.ok && res.type === "basic") {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
          }
          return res;
        })
        .catch(() => cached);
      return cached || network;
    }),
  );
});
