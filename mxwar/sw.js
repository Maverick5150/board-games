// Offline cache for Motocross War (the season files data/<series>-<year>.js are cached on first use: every .js the page fetches is stored) (bump VERSION to force update)
const VERSION = "mxwar-v19";
const PREFIX = VERSION.replace(/v[0-9]+$/, "");   // every game shares one origin (one CacheStorage): only ever delete THIS game's old caches
// [bcast] the music (mxshow S0): mxwar/audio/<pkg>/ (pkg.json + the content-hashed .m4a files) lives in its own cache, filled on first use and KEPT across
// versions (a new VERSION never re-downloads audio: a changed file has a new name), cache-first; Range requests (the streamed menu tracks) are answered
// from the cached whole file, so the music plays offline once heard online. [/bcast]
const AUDIO = "mxwar-audio-1";
const ASSETS = ["./", "./index.html", "./manifest.webmanifest", "../sound.js", "../skins.js", "../saves.js", "../names.js", "./data/index.js", "./data/history.js", "./race.js", "./time.js", "./round.js", "./season.js", "./announce-lines.js", "./intensity-data.js", "./intensity.js", "./announce.js", "./brain.js", "./art.js", "./track.js", "./booth.js", "./game.js",
  /* [bcast] */ "./mxsound.js", "./mxmusic.js", /* [/bcast] */
  "../ui/theme.css", "../ui/voice.css", "../ui/ui.js", "../ui/icons.js", "../ui/picker.js", "../ui/voice.js",
  "../ui/fonts/dmserifdisplay-latin.woff2", "../ui/fonts/dmserifdisplay-italic-latin.woff2", "../ui/fonts/manrope-var-latin.woff2",
  "../ui/tex/felt.webp", "../ui/tex/paper.webp", "../ui/tex/orb-gold.webp", "../ui/tex/orb-violet.webp", "../ui/tex/rays-core.webp",
  "../ui/art/icon-mxwar-192.png", "../ui/art/icon-mxwar-512.png", "../ui/art/icon-mxwar-maskable-512.png", "../ui/art/hero-mxwar.svg"];
// the 3D race view (race3d.js and its modules from the development branch mxvis, mxwar/CONTRACT.md): every module, the course scripts, the dirt tiles, three.js r160
// and the add-ons the view imports. BG_audit/sprint/mxlive/sync-view.sh copies the view and rewrites the next two lines (the synced commit; the list).
// mxwar 3D view: synced from mxvis a584fe5 (BG_audit/sprint/mxlive/sync-view.sh writes this line and the ASSETS3D list)
const ASSETS3D = [/*3d:assets*/ "./assets/dirt/dirt-tiles-lo.js", "./assets/dirt/dirt-tiles.js", "./course.js", "./data/tracks.js", "./layouts.js", "./r3d-bike-model.js", "./r3d-bike.js", "./r3d-cams.js", "./r3d-dirt-png.js", "./r3d-dirt-relief.js", "./r3d-fx.js", "./r3d-lead-env.js", "./r3d-lead-post.js", "./r3d-look.js", "./r3d-perf-bench.js", "./r3d-perf-warm.js", "./r3d-quality.js", "./r3d-rider-apparel.js", "./r3d-rider-model.js", "./r3d-rider-pose.js", "./r3d-riders.js", "./r3d-stadium-art.js", "./r3d-stadium-bowl.js", "./r3d-track.js", "./r3d-util.js", "./r3d-world.js", "./race3d.js", "../ui/vendor/three-0.160.0.module.min.js", "../ui/vendor/three-addons/Pass.js", "../ui/vendor/three-addons/SMAAPass.js", "../ui/vendor/three-addons/SMAAShader.js" /*/3d:assets*/];

// Updates: a new VERSION re-downloads every asset (cache "reload" skips the browser's HTTP cache, so cache-first icons are fresh too)
// and takes over at once (skipWaiting + clients.claim). Pages and scripts are network-first, so a published update loads on the
// next launch or navigation by itself; an open game is never reloaded.
self.addEventListener("install", e => {
  e.waitUntil(Promise.all([caches.open(VERSION).then(c => c.addAll(ASSETS.concat(ASSETS3D).map(u => new Request(u, { cache: "reload" })))), audioWarm().catch(() => {})]).then(() => self.skipWaiting()));
});
// [bcast] the music's essentials go into the audio cache at install, once (a later version finds them there and downloads nothing): the package's manifest
// (its URL carries the content hash that mxsound.js names, read from that file, so a re-cut package needs no edit here), the theme, the open, the checkered
// fanfare, the post-race beds and the podium (about 1.7 MB). The first visit fetches the manifest before this worker controls the page, so without this the
// next visit offline had no package. The rotation's long tracks are cached when first heard.
const AUDIO_ESS = ["title", "open", "checkered", "recapB1", "recapB2", "podium"];
async function audioWarm() {
  const c = await caches.open(AUDIO);
  const src = await (await fetch("./mxsound.js", { cache: "no-cache" })).text();
  const h = (/PKGS=\{base:"([0-9a-f]+)"\}/.exec(src) || [])[1]; if (!h) return;
  const mu = new URL("./audio/base/pkg.json?h=" + h, self.location).href;
  let man = await c.match(mu);
  if (!man) { const r = await fetch(mu); if (r.status !== 200) return; await c.put(mu, r.clone()); man = r; }
  const m = await man.json();
  for (const n of AUDIO_ESS) {
    const cu = m.cues && m.cues[n]; if (!cu || !cu.file) continue;
    const u = new URL("./audio/base/" + cu.file, self.location).href;
    if (await c.match(u)) continue;
    const r = await fetch(u); if (r.status === 200) await c.put(u, r);
  }
}
// [/bcast]
self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k.startsWith(PREFIX) && k !== VERSION && !k.startsWith("mxwar-audio-")).map(k => caches.delete(k))))   // [bcast] the audio cache is never an old version
      .then(() => self.clients.claim())
  );
});
// Pages and scripts always ask the server whether they changed (a cheap "304 not modified" when not), so a published update
// loads on the very next launch instead of up to 10 minutes later (GitHub Pages' HTTP cache time), and a new page never runs
// with an older script left in the browser's HTTP cache. Old engines that can't copy a request this way just fetch it as before.
const fresh = req => { try { return new Request(req, { cache: "no-cache" }); } catch (x) { return req; } };
// [bcast] only a complete, good answer is kept (a 404, a 500 or a partial 206 never goes into a cache) [/bcast]
const keep = (name, req, res) => { if (res && res.status === 200) { const c = res.clone(); caches.open(name).then(x => x.put(req, c)).catch(() => {}); } return res; };
// [bcast] the audio: cache-first by URL (the names and the manifest's ?h= carry a content hash); a Range request gets its slice of the cached whole file (206)
async function audio(req) {
  const url = req.url, c = await caches.open(AUDIO);
  let hit = await c.match(url);
  if (!hit) {
    const res = await fetch(url, { credentials: "same-origin" });   // the whole file (no Range): stored once, every later range comes from it
    if (res.status !== 200) return res;
    try { await c.put(url, res.clone()); } catch (x) { }
    hit = res;
  }
  const range = req.headers.get("range");
  return range ? slice(hit, range) : hit;
}
async function slice(res, range) {
  const buf = await res.arrayBuffer(), n = buf.byteLength, type = res.headers.get("Content-Type") || "audio/mp4";
  const m = /^bytes=(\d*)-(\d*)$/.exec(String(range).trim());
  if (!m || (m[1] === "" && m[2] === "")) return new Response(buf, { status: 200, headers: { "Content-Type": type, "Content-Length": String(n), "Accept-Ranges": "bytes" } });
  let a, b;
  if (m[1] === "") { a = Math.max(0, n - (+m[2])); b = n - 1; } else { a = +m[1]; b = m[2] === "" ? n - 1 : Math.min(+m[2], n - 1); }
  if (a >= n || a > b) return new Response(null, { status: 416, headers: { "Content-Range": "bytes */" + n } });
  return new Response(buf.slice(a, b + 1), { status: 206, statusText: "Partial Content", headers: { "Content-Type": type, "Content-Range": "bytes " + a + "-" + b + "/" + n, "Content-Length": String(b - a + 1), "Accept-Ranges": "bytes" } });
}
// [/bcast]
// Network-first for the page so updates always load fresh; cache-first for other assets.
self.addEventListener("fetch", e => {
  if (e.request.method !== "GET") return;
  const url = new URL(e.request.url);
  if (url.origin === self.location.origin && url.pathname.indexOf("/mxwar/audio/") >= 0) { e.respondWith(audio(e.request)); return; }   // [bcast] the music [/bcast]
  const isDoc = e.request.mode === "navigate" || url.pathname.endsWith("/") || url.pathname.endsWith(".html") || url.pathname.endsWith(".js") || url.pathname.endsWith(".json");   // [bcast] .json too: a new manifest always loads [/bcast]
  if (isDoc) {
    e.respondWith(
      fetch(fresh(e.request)).then(res => keep(VERSION, e.request, res))
        .catch(() => caches.match(e.request).then(h => h || (e.request.mode === "navigate" ? caches.match("./index.html") : Response.error())))   // [bcast] only a page falls back to the game page: a script never cached fails as a script (it was handed index.html and threw "Unexpected token '<'") [/bcast]
    );
  } else {
    e.respondWith(caches.match(e.request).then(hit => hit || fetch(e.request).then(res => keep(VERSION, e.request, res))));
  }
});
