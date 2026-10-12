// Offline cache for Trouble (bump VERSION to force update)
const VERSION = "trouble-v2";
const ASSETS = ["./", "./index.html", "./manifest.webmanifest", "./icon.png"];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});
// Network-first for the page so updates always load fresh; cache-first for other assets.
self.addEventListener("fetch", e => {
  if (e.request.method !== "GET") return;
  const url = new URL(e.request.url);
  const isDoc = e.request.mode === "navigate" || url.pathname.endsWith("/") || url.pathname.endsWith(".html");
  if (isDoc) {
    e.respondWith(
      fetch(e.request).then(res => { const c = res.clone(); caches.open(VERSION).then(x => x.put(e.request, c)).catch(()=>{}); return res; })
        .catch(() => caches.match(e.request).then(h => h || caches.match("./index.html")))
    );
  } else {
    e.respondWith(caches.match(e.request).then(hit => hit || fetch(e.request).then(res => { const c = res.clone(); caches.open(VERSION).then(x => x.put(e.request, c)).catch(()=>{}); return res; })));
  }
});
