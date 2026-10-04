// Hand-written service worker (zero dependencies, keeps the project's
// pure-frontend philosophy). Strategy:
//   - navigations: network-first, fall back to cached shell (offline open)
//   - same-origin static assets: cache-first (hashed filenames are immutable)
// Bump CACHE on any behavior change so old caches get evicted on activate.
var CACHE = "thought-record-v1";

self.addEventListener("install", function() {
  self.skipWaiting();
});

self.addEventListener("activate", function(event) {
  event.waitUntil((async function() {
    var keys = await caches.keys();
    await Promise.all(keys.filter(function(k) { return k !== CACHE; }).map(function(k) { return caches.delete(k); }));
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", function(event) {
  var req = event.request;
  if (req.method !== "GET") return;
  var url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  if (req.mode === "navigate") {
    event.respondWith((async function() {
      try {
        var res = await fetch(req);
        var cache = await caches.open(CACHE);
        cache.put(req, res.clone());
        return res;
      } catch (err) {
        var cached = (await caches.match(req)) || (await caches.match("./index.html")) || (await caches.match("./"));
        if (cached) return cached;
        return new Response("offline", { status: 503, headers: { "Content-Type": "text/plain" } });
      }
    })());
    return;
  }

  event.respondWith((async function() {
    var cached = await caches.match(req);
    if (cached) return cached;
    var res = await fetch(req);
    if (res && res.ok) {
      var cache = await caches.open(CACHE);
      cache.put(req, res.clone());
    }
    return res;
  })());
});
