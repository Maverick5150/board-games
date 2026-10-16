// Offline cache for the hub page (bump VERSION to force update)
const VERSION = "hub-v4";
const PREFIX = "hub-";   // every game shares this origin (one CacheStorage): only ever touch the hub's own caches
const ASSETS = ["./", "./index.html", "./manifest.webmanifest", "./icon.png",
  "./ui/theme.css", "./ui/ui.js", "./ui/icons.js", "./sound.js", "./ui/fonts/dmserifdisplay-latin.woff2", "./ui/fonts/dmserifdisplay-italic-latin.woff2", "./ui/fonts/manrope-var-latin.woff2", "./ui/tex/felt.webp", "./ui/tex/paper.webp", "./ui/tex/orb-gold.webp", "./ui/tex/orb-violet.webp", "./ui/tex/rays-core.webp",
  "./ui/art/thumb-trouble.svg", "./ui/art/thumb-trouble-sm.svg", "./ui/art/hero-trouble-960.webp", "./ui/art/hero-trouble-1920.webp", "./ui/art/thumb-sorry.svg", "./ui/art/thumb-sorry-sm.svg", "./ui/art/hero-sorry-960.webp", "./ui/art/hero-sorry-1920.webp", "./ui/art/thumb-monopoly.svg", "./ui/art/thumb-monopoly-sm.svg", "./ui/art/hero-monopoly-960.webp", "./ui/art/hero-monopoly-1920.webp", "./ui/art/thumb-rummy500.svg", "./ui/art/thumb-rummy500-sm.svg", "./ui/art/hero-rummy500-960.webp", "./ui/art/hero-rummy500-1920.webp",
  "./ui/art/thumb-risk.svg", "./ui/art/thumb-risk-sm.svg", "./ui/art/hero-risk-960.webp", "./ui/art/hero-risk-1920.webp", "./ui/art/thumb-uno.svg", "./ui/art/thumb-uno-sm.svg", "./ui/art/hero-uno-960.webp", "./ui/art/hero-uno-1920.webp", "./ui/art/thumb-scatter.svg", "./ui/art/thumb-scatter-sm.svg", "./ui/art/hero-scatter-960.webp", "./ui/art/hero-scatter-1920.webp", "./ui/art/thumb-war.svg", "./ui/art/hero-war.svg", "./ui/art/thumb-snakes.svg", "./ui/art/hero-snakes.svg", "./ui/art/thumb-party.svg", "./ui/art/thumb-party-sm.svg", "./ui/art/hero-party-960.webp", "./ui/art/hero-party-1920.webp",
  "./ui/art/icon-collection-192.png", "./ui/art/icon-collection-512.png", "./ui/art/icon-collection-maskable-512.png", "./ui/art/apple-touch-icon-180.png"];
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
// Network-first for the page and the scripts so updates always load fresh; cache-first for the manifest, styles, fonts, art and icons.
self.addEventListener("fetch", e => {
  if (e.request.method !== "GET") return;
  const url = new URL(e.request.url);
  // The hub's Coming soon list is edited on the live site and must never come from a cache: it is not in ASSETS, and this line keeps
  // it out even if someone adds it there. The page fetches it with a fresh query and cache "no-store", and keeps its own last copy.
  if (url.pathname.endsWith("/coming-soon.json")) return;
  if (!OWN.includes(url.origin + url.pathname)) return;   // a game, Party Mode, the TV page...: not the hub's business
  const save = res => { if (res.ok) { const c = res.clone(); caches.open(VERSION).then(x => x.put(e.request, c)).catch(() => {}); } return res; };
  const cached = () => caches.open(VERSION).then(x => x.match(e.request, { ignoreSearch: true }));
  if (e.request.mode === "navigate" || url.pathname.endsWith("/") || url.pathname.endsWith(".html") || url.pathname.endsWith(".js")) {
    e.respondWith(fetch(fresh(e.request)).then(save).catch(() => cached().then(h => h || caches.open(VERSION).then(x => x.match(OWN[1])))));
  } else {
    e.respondWith(cached().then(hit => hit || fetch(e.request).then(save)));
  }
});
