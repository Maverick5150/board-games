// Offline cache for the hub page (bump VERSION to force update)
const VERSION = "hub-v1";
const PREFIX = "hub-";   // every game shares this origin (one CacheStorage): only ever touch the hub's own caches
const ASSETS = ["./", "./index.html", "./manifest.webmanifest", "./icon.png"];
// This worker's scope covers the game folders too, but it only answers for the hub's own files: games have their own
// workers and caches, and Party Mode / the TV page always go straight to the network, exactly as before.
const OWN = ASSETS.map(u => new URL(u, self.location).href);

// Updates: a new VERSION re-downloads every asset (cache "reload" skips the browser's HTTP cache, so the cache-first icon is fresh too)
// and takes over at once (skipWaiting + clients.claim). The page is network-first, so a published update loads on the next
// launch or navigation by itself; an open page is never reloaded.
self.addEventListener("install", e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(ASSETS.map(u => new Request(u, { cache: "reload" })))).then(() => self.skipWaiting()));
});
self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k.startsWith(PREFIX) && k !== VERSION).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});
// Pages and scripts always ask the server whether they changed (a cheap "304 not modified" when not), so a published update
// loads on the very next launch instead of up to 10 minutes later (GitHub Pages' HTTP cache time), and a new page never runs
// with an older script left in the browser's HTTP cache. Old engines that can't copy a request this way just fetch it as before.
const fresh = req => { try { return new Request(req, { cache: "no-cache" }); } catch (x) { return req; } };
// Network-first for the page so updates always load fresh; cache-first for the manifest and icon.
self.addEventListener("fetch", e => {
  if (e.request.method !== "GET") return;
  const url = new URL(e.request.url);
  if (!OWN.includes(url.origin + url.pathname)) return;   // a game, Party Mode, the TV page...: not the hub's business
  const save = res => { if (res.ok) { const c = res.clone(); caches.open(VERSION).then(x => x.put(e.request, c)).catch(() => {}); } return res; };
  const cached = () => caches.open(VERSION).then(x => x.match(e.request, { ignoreSearch: true }));
  if (e.request.mode === "navigate" || url.pathname.endsWith("/") || url.pathname.endsWith(".html")) {
    e.respondWith(fetch(fresh(e.request)).then(save).catch(() => cached().then(h => h || caches.open(VERSION).then(x => x.match(OWN[1])))));
  } else {
    e.respondWith(cached().then(hit => hit || fetch(e.request).then(save)));
  }
});
