// Offline cache for Motocross War (the season files data/<series>-<year>.js are cached on first use: every .js the page fetches is stored) (bump VERSION to force update)
const VERSION = "mxwar-v18";
const PREFIX = VERSION.replace(/v[0-9]+$/, "");   // every game shares one origin (one CacheStorage): only ever delete THIS game's old caches
const ASSETS = ["./", "./index.html", "./manifest.webmanifest", "../sound.js", "../skins.js", "../saves.js", "../names.js", "./data/index.js", "./data/history.js", "./race.js", "./time.js", "./round.js", "./season.js", "./announce-lines.js", "./intensity-data.js", "./intensity.js", "./announce.js", "./brain.js", "./art.js", "./track.js", "./booth.js", "./game.js",
  "../ui/theme.css", "../ui/voice.css", "../ui/ui.js", "../ui/icons.js", "../ui/picker.js", "../ui/voice.js",
  "../ui/fonts/dmserifdisplay-latin.woff2", "../ui/fonts/dmserifdisplay-italic-latin.woff2", "../ui/fonts/manrope-var-latin.woff2",
  "../ui/tex/felt.webp", "../ui/tex/paper.webp", "../ui/tex/orb-gold.webp", "../ui/tex/orb-violet.webp", "../ui/tex/rays-core.webp",
  "../ui/art/icon-mxwar-192.png", "../ui/art/icon-mxwar-512.png", "../ui/art/icon-mxwar-maskable-512.png", "../ui/art/hero-mxwar.svg"];
// the 3D race view (race3d.js and its modules from the development branch mxvis, mxwar/CONTRACT.md): every module, the course scripts, the dirt tiles, three.js r160
// and the add-ons the view imports. BG_audit/sprint/mxlive/sync-view.sh copies the view and rewrites the next two lines (the synced commit; the list).
// mxwar 3D view: synced from mxvis 1ef7444 (BG_audit/sprint/mxlive/sync-view.sh writes this line and the ASSETS3D list)
const ASSETS3D = [/*3d:assets*/ "./assets/dirt/dirt-tiles-lo.js", "./assets/dirt/dirt-tiles.js", "./course.js", "./data/tracks.js", "./layouts.js", "./r3d-bike-model.js", "./r3d-bike.js", "./r3d-cams.js", "./r3d-dirt-png.js", "./r3d-dirt-relief.js", "./r3d-fx.js", "./r3d-lead-env.js", "./r3d-lead-post.js", "./r3d-look.js", "./r3d-perf-bench.js", "./r3d-perf-warm.js", "./r3d-quality.js", "./r3d-rider-apparel.js", "./r3d-rider-model.js", "./r3d-rider-pose.js", "./r3d-riders.js", "./r3d-stadium-art.js", "./r3d-stadium-bowl.js", "./r3d-track.js", "./r3d-util.js", "./r3d-world.js", "./race3d.js", "../ui/vendor/three-0.160.0.module.min.js", "../ui/vendor/three-addons/Pass.js", "../ui/vendor/three-addons/SMAAPass.js", "../ui/vendor/three-addons/SMAAShader.js" /*/3d:assets*/];

// Updates: a new VERSION re-downloads every asset (cache "reload" skips the browser's HTTP cache, so cache-first icons are fresh too)
// and takes over at once (skipWaiting + clients.claim). Pages and scripts are network-first, so a published update loads on the
// next launch or navigation by itself; an open game is never reloaded.
self.addEventListener("install", e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(ASSETS.concat(ASSETS3D).map(u => new Request(u, { cache: "reload" })))).then(() => self.skipWaiting()));
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
// Network-first for the page so updates always load fresh; cache-first for other assets.
self.addEventListener("fetch", e => {
  if (e.request.method !== "GET") return;
  const url = new URL(e.request.url);
  const isDoc = e.request.mode === "navigate" || url.pathname.endsWith("/") || url.pathname.endsWith(".html") || url.pathname.endsWith(".js");
  if (isDoc) {
    e.respondWith(
      fetch(fresh(e.request)).then(res => { const c = res.clone(); caches.open(VERSION).then(x => x.put(e.request, c)).catch(()=>{}); return res; })
        .catch(() => caches.match(e.request).then(h => h || caches.match("./index.html")))
    );
  } else {
    e.respondWith(caches.match(e.request).then(hit => hit || fetch(e.request).then(res => { const c = res.clone(); caches.open(VERSION).then(x => x.put(e.request, c)).catch(()=>{}); return res; })));
  }
});
