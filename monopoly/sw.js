// Offline cache for Monopoly (bump VERSION to force update)
const VERSION = "monopoly-v18";
const PREFIX = VERSION.replace(/v[0-9]+$/, "");   // every game shares one origin (one CacheStorage): only ever delete THIS game's old caches
const ASSETS = ["./", "./index.html", "./manifest.webmanifest", "./icon.png", "../sound.js", "../skins.js", "../saves.js"];

// Updates: a new VERSION re-downloads every asset (cache "reload" skips the browser's HTTP cache, so cache-first icons are fresh too)
// and takes over at once (skipWaiting + clients.claim). Pages and scripts are network-first, so a published update loads on the
// next launch or navigation by itself; an open game is never reloaded.
self.addEventListener("install", e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(ASSETS.map(u => new Request(u, { cache: "reload" })))).then(() => self.skipWaiting()));
});
self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k.startsWith(PREFIX) && k !== VERSION).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});
// Network-first for the page/HTML so updates always load fresh; cache-first for other assets.
self.addEventListener("fetch", e => {
  if (e.request.method !== "GET") return;
  const url = new URL(e.request.url);
  const isDoc = e.request.mode === "navigate" || url.pathname.endsWith("/") || url.pathname.endsWith(".html") || url.pathname.endsWith(".js");
  if (isDoc) {
    e.respondWith(
      fetch(e.request).then(res => {
        const copy = res.clone();
        caches.open(VERSION).then(c => c.put(e.request, copy)).catch(() => {});
        return res;
      }).catch(() => caches.match(e.request).then(h => h || caches.match("./index.html")))
    );
  } else {
    e.respondWith(
      caches.match(e.request).then(hit => hit || fetch(e.request).then(res => {
        const copy = res.clone();
        caches.open(VERSION).then(c => c.put(e.request, copy)).catch(() => {});
        return res;
      }))
    );
  }
});
