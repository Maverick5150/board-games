/* MOTOCROSS WAR 3D — the CAPTURE HARNESS page (demo.html): a LIVE race of the real game engine through the 3D race view, stepped on a
   deterministic fixed clock so that the same plan gives the same frames every time (the before / after comparison, the specialists' shots).
   window.DEMO = {
     ready                  a Promise: resolves with DEMO.info() once the view, the engine and the world are up (await it first)
     step(dt, draw)         advance the race by dt seconds (whole 1/60 s ticks: dt = 1/30 is 2 ticks), the virtual clock and its timers
                            with it; draw=true renders the LAST tick through the view's own pipeline. dt = 0 + draw = redraw (1 us tick)
     skip(seconds)          the same without drawing (fast)
     seek(t)                go to race time t (seconds after the gate drop; t < 0 = at the gate, before the drop); a time already passed
                            restarts the race (same seed: the same race) and skips forward
     camera(spec)           place the camera (null = the view's own director). Specs, one of
                              rig on a rider  {seat:"you"|"lead"|"crash"|N|{rank:k}, back:3.5, up:1.5, side:0, aim:8|{ahead,up,side}, fov:70, damp:0.15}
                                 back/side/aim in metres along / across the rider's heading (+side = the rider's right), up above the dirt
                              world pose     {eye:[x,y,z]|at:{s,lat,h}, target:[x,y,z]|look:{s,lat,h}|follow:{seat,up,damp}, fov}
                                 (at/look/h: course distance s in m, lat across the track, h above the dirt or the stadium floor)
     bookmark(id, {draw})   seek to a bookmark's time, set its camera, draw its frame (draw defaults to true)
     capture(id, type, q)   bookmark + a data URL of the canvas (PNG by default)
     grab(type, q)          a data URL of the canvas as drawn last (call it in the same task as the draw)
     quality(name)          a quality tier (restarts the race): high | medium | low | stick (or the view's own V.qualityNames())
     size(w, h, pr)         the canvas size in CSS px and a fixed pixel ratio (pr omitted = the view's own adaptive ratio); restarts the race
     stats()                time, draw calls, triangles, geometries, textures, programs, JS heap, canvas size, quality, camera mode
     bench(frames)          unthrottled cost per frame: JS step ms, step + draw + GPU sync ms
     live(on)               real time: the view's own requestAnimationFrame loop (the game as it runs); the fixed clock stops
     restart()  scan(seconds, every)  riders()  info()  setBookmarks(json)  qualities()  t()  errors
   The view needs one tiny hook to be driven this exactly: V.camHook(dt, riders, T) -> null | {eye, target, fov} (see REQUESTS in the report);
   when the view doesn't have it yet this page adds it to race3d.js IN MEMORY (a patched copy loaded from a blob URL: nothing on disk changes). */
const T0 = performance.now();
const Q = new URLSearchParams(location.search);
const num = (k, d) => (Q.has(k) && isFinite(+Q.get(k)) && Q.get(k) !== "" ? +Q.get(k) : d);
const P = { seed: num("seed", 22), round: num("round", 1), kind: Q.get("kind") || "main", season: Q.get("season") || "sx-2026", live: Q.get("live") === "1",
  q: Q.get("q") || "high", w: num("w", 0), h: num("h", 0), view: Q.get("view") || "race3d.js", hud: Q.get("hud") === "1", red: num("red", 0) };
const DEMO = window.DEMO = { version: 1, state: "loading", errors: [], params: P, ready: null };
const report = e => { try { DEMO.errors.push(String((e && (e.stack || e.message)) || e)); const b = document.getElementById("err"); if (b) { b.style.display = "block"; b.textContent = DEMO.errors.slice(-3).join("\n---\n"); } } catch (x) { } };
window.addEventListener("error", ev => report(ev.error || ev.message));
window.addEventListener("unhandledrejection", ev => report(ev.reason));

/* ---------------- the deterministic world: a seeded Math.random and a virtual clock (timers, performance.now, Date.now) ---------------- */
const realNow = performance.now.bind(performance);
const rST = window.setTimeout.bind(window), rCT = window.clearTimeout.bind(window), rSI = window.setInterval.bind(window), rCI = window.clearInterval.bind(window);
function mulberry32(a) { return function () { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const reseed = () => { Math.random = mulberry32(0x4D585752 ^ (P.seed * 2654435761)); };
reseed();
const clock = { virt: !P.live, tick: 0, v: 0, off: 0, timers: new Map(), seq: 1e9 };
const EPOCH = Date.UTC(2026, 9, 17, 20, 0, 0);
performance.now = () => (clock.virt ? clock.v : realNow() + clock.off);
Date.now = () => EPOCH + Math.round(performance.now());
window.setTimeout = function (fn, ms, ...a) { if (!clock.virt || typeof fn !== "function") return rST(fn, ms, ...a); const id = ++clock.seq; clock.timers.set(id, { id, at: clock.v + Math.max(0, +ms || 0), fn, a, every: 0 }); return id; };
window.setInterval = function (fn, ms, ...a) { if (!clock.virt || typeof fn !== "function") return rSI(fn, ms, ...a); const id = ++clock.seq; clock.timers.set(id, { id, at: clock.v + Math.max(1, +ms || 1), fn, a, every: Math.max(1, +ms || 1) }); return id; };
window.clearTimeout = window.clearInterval = function (id) { if (clock.timers.delete(id)) return; rCT(id); rCI(id); };
function flush(limit) {
  let n = 0; limit = limit || 20000;
  for (;;) {
    let best = null;
    for (const t of clock.timers.values()) if (t.at <= clock.v + 1e-6 && (!best || t.at < best.at || (t.at === best.at && t.id < best.id))) best = t;
    if (!best) break;
    if (best.every) best.at += best.every; else clock.timers.delete(best.id);
    try { best.fn(...best.a); } catch (e) { report(e); }
    if (++n > limit) { report("flush: too many timers"); break; }
  }
}

/* ---------------- the view: loaded as it is; without the camera hook it is patched in memory ---------------- */
const NEEDLE_V = "const V={lost:false};";
const NEEDLE_C = "cam.position.copy(cPos); cam.lookAt(cTarget);";   /* race3d.js as one file (mxvis) */
const NEEDLE_CAMS = "CAMS.camera(dt);";                                 /* race3d.js after the split (r3d-cams.js): the camera is CAMS.camera(dt) and CAMS.target the look-at */
async function loadView(rel) {
  const url = new URL(rel, location.href).href, src = await (await fetch(url, { cache: "no-store" })).text();
  if (/camHook/.test(src)) return { mod: await import(url), hook: "native", url };
  const split = src.indexOf(NEEDLE_CAMS) >= 0;
  if (src.indexOf(NEEDLE_V) < 0 || (!split && src.indexOf(NEEDLE_C) < 0)) return { mod: await import(url), hook: "none", url };   /* no anchor: the director's cameras only */
  let p = src.replace(NEEDLE_V, "const V={lost:false,camHook:null};");
  if (split) p = p.replace(NEEDLE_CAMS, NEEDLE_CAMS + " {const h=V.camHook&&V.camHook(dt,rs,T);if(h){cam.position.set(h.eye[0],h.eye[1],h.eye[2]);CAMS.target.set(h.target[0],h.target[1],h.target[2]);cam.lookAt(CAMS.target);if(h.fov&&Math.abs(cam.fov-h.fov)>1e-4){cam.fov=h.fov;cam.updateProjectionMatrix();}}}");
  else p = p.replace(NEEDLE_C, "{const h=V.camHook&&V.camHook(dt,rs,T);if(h){cPos.set(h.eye[0],h.eye[1],h.eye[2]);cTarget.set(h.target[0],h.target[1],h.target[2]);camS.fov=h.fov||camS.fov;}} " + NEEDLE_C);
  p = p.replace(/(\bfrom\s*|\bimport\s*\(\s*)(["'])(\.{1,2}\/[^"']+)\2/g, (m, a, q, s) => a + q + new URL(s, url).href + q).replace(/import\.meta\.url/g, JSON.stringify(url));
  const blob = URL.createObjectURL(new Blob([p], { type: "text/javascript" }));
  return { mod: await import(blob), hook: split ? "patched-in-memory (split view)" : "patched-in-memory", url };
}

/* ---------------- state ---------------- */
const MX = window.MXWar, DE = MX.DemoEngine;
let V = null, E = null, DRV = null, C = null, YOU = -1, dropTick = -1, CAM = null, BM = null, hookMode = "none", viewInfo = null, quality = P.q, canvasSize = null, GLNAME = "";
const host = document.getElementById("v3");
const TICK = 1 / 60;
const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
const raceT = () => (dropTick < 0 ? -1 : (clock.tick - dropTick) / 60);

/* ---------------- riders: who a camera spec means ---------------- */
function alive(rs) { return rs.filter(r => r.pos && !r.gone); }
function pickRider(sel, rs) {
  if (sel == null || sel === "you") sel = YOU;
  if (typeof sel === "number") return rs.find(r => r.seat === sel) || null;
  if (sel === "lead") { let b = null; rs.forEach(r => { if (r.pos && !r.gone && !r.crash && (!b || r.D > b.D)) b = r; }); return b; }
  if (sel === "crash") { let b = null; rs.forEach(r => { if (r.crash && r.pos && (!b || r.crash.T < b.crash.T)) b = r; }); return b; }
  let k = null; if (typeof sel === "object" && sel && sel.rank) k = sel.rank; else if (typeof sel === "string" && /^p\d+$/.test(sel)) k = +sel.slice(1);
  if (k != null) { const o = alive(rs).filter(r => !r.crash).sort((a, b) => b.D - a.D); return o[k - 1] || null; }
  return null;
}
const needsLock = sel => (sel && typeof sel === "object" && sel.rank != null) || sel === "crash" || (typeof sel === "string" && /^p\d+$/.test(sel));
function seatOf(sel, rs, h) {   /* rank / crash selectors lock on the first rider they resolve to, so a recording stays on one rider while the order changes */
  if (h.lockOn && h.locked != null) return rs.find(r => r.seat === h.locked) || null;
  const r = pickRider(sel, rs); if (h.lockOn && r) h.locked = r.seat; return r;
}
const baseY = r => Math.max(r.gy != null ? r.gy : -1e9, r.pos.y - 1.3);   /* the dirt under the bike, or the bike's height in the air */
function aimOf(a) { if (a == null) return { ahead: 8, up: 1.1, side: 0 }; if (typeof a === "number") return { ahead: a, up: 1.1, side: 0 }; if (Array.isArray(a)) return { ahead: a[0] || 0, up: a[1] != null ? a[1] : 1.1, side: a[2] || 0 }; return { ahead: a.ahead != null ? a.ahead : 8, up: a.up != null ? a.up : 1.1, side: a.side || 0 }; }
function dirtAt(x, z) { let y = -0.16; try { const d = V._dbg && V._dbg.dirt ? V._dbg.dirt(x, z) : -1e9; if (d > y) y = d; } catch (e) { } return y; }
/* a point of the course: s metres along the lap, lat across (+ right), h above the dirt there (or the stadium floor) */
function trackPoint(p) {
  const f = MX.Course.frame(C, p.s, {}), x = f.x - Math.sin(f.th) * (p.lat || 0), z = f.z + Math.cos(f.th) * (p.lat || 0);
  const g = Math.abs(p.lat || 0) <= f.hw ? MX.Course.ground(C, p.s, p.lat || 0) : -0.16;
  return [x, Math.max(g, dirtAt(x, z)) + (p.h != null ? p.h : 0), z];
}
function damp(cur, goal, dt, tau) { const k = tau > 0 ? 1 - Math.exp(-dt / tau) : 1; for (let i = 0; i < 3; i++) cur[i] += (goal[i] - cur[i]) * k; }

/* the camera: the hook the view calls once a step, after its director chose a pose (it returns null = keep the director's) */
function normCam(spec) {
  if (!spec) return null;
  const fov = spec.fov || 60;
  if (spec.seat !== undefined || (!spec.eye && !spec.at)) {
    const a = aimOf(spec.aim);
    return { kind: "rig", lockOn: spec.lock !== false && needsLock(spec.seat), locked: null, seat: spec.seat === undefined ? "you" : spec.seat, back: spec.back != null ? spec.back : 3.5, up: spec.up != null ? spec.up : 1.5, side: spec.side || 0, aim: a, fov, tau: spec.damp != null ? spec.damp : 0.15, prime: true, e: [0, 0, 0], t: [0, 0, 0], last: null };
  }
  const eye = spec.eye ? spec.eye.slice() : trackPoint(spec.at);
  const c = { kind: "world", eye, fov, prime: true, t: [0, 0, 0], follow: null, target: null, last: null };
  if (spec.follow) c.follow = { lockOn: spec.follow.lock !== false && needsLock(spec.follow.seat), locked: null, seat: spec.follow.seat === undefined ? "lead" : spec.follow.seat, up: spec.follow.up != null ? spec.follow.up : 1.0, tau: spec.follow.damp != null ? spec.follow.damp : 0.5 };
  else c.target = spec.target ? spec.target.slice() : (spec.look ? trackPoint(spec.look) : [eye[0], eye[1], eye[2] - 10]);
  return c;
}
function hook(dt, rs) {
  const c = CAM; if (!c) return null;
  const k = dt > 0 ? dt : 1e-6;
  if (c.kind === "world") {
    if (c.follow) { const r = seatOf(c.follow.seat, rs, c.follow); if (r && r.pos) { const g = [r.pos.x, baseY(r) + c.follow.up, r.pos.z]; if (c.prime) { c.t = g; } else damp(c.t, g, k, c.follow.tau); } else if (c.prime) return c.last; c.prime = false; c.last = { eye: c.eye, target: c.t.slice(), fov: c.fov }; return c.last; }
    c.prime = false; c.last = { eye: c.eye, target: c.target, fov: c.fov }; return c.last;
  }
  const r = seatOf(c.seat, rs, c); if (!r || !r.pos) return c.last;
  const th = r.th || 0, fx = Math.cos(th), fz = Math.sin(th), rx = -fz, rz = fx, by = baseY(r);
  let ex = r.pos.x - fx * c.back + rx * c.side, ez = r.pos.z - fz * c.back + rz * c.side, ey = by + c.up;
  ey = Math.max(ey, dirtAt(ex, ez) + 0.4);   /* never inside the dirt */
  const g = [ex, ey, ez], t = [r.pos.x + fx * c.aim.ahead + rx * c.aim.side, by + c.aim.up, r.pos.z + fz * c.aim.ahead + rz * c.aim.side];
  if (c.prime) { c.e = g; c.t = t; c.prime = false; } else { damp(c.e, g, k, c.tau); damp(c.t, t, k, c.tau); }
  c.last = { eye: c.e.slice(), target: c.t.slice(), fov: c.fov };
  return c.last;
}

/* ---------------- the race ---------------- */
function applyQualityPre(name) {
  const el = document.documentElement;
  if (V && V.setQuality && V.qualityNames) { return; }
  if (name === "low" || name === "stick") el.setAttribute("data-effects", "reduced"); else el.removeAttribute("data-effects");
  if (name === "stick") el.setAttribute("data-tv", ""); else el.removeAttribute("data-tv");
}
function applyQualityPost(name) {
  if (V.setQuality && V.qualityNames) { try { V.setQuality(name); } catch (e) { report(e); } return; }
  if (V.setShadows) { const ci = V.camInfo ? V.camInfo() : null, st = V.state ? V.state() : null; V.setShadows(name !== "medium" && !(st && st.lo) && !(ci && ci.weakGPU)); }   /* medium = no real shadows; the others as the view chose */
}
function sizeHost() {
  let w = canvasSize ? canvasSize.w : P.w, h = canvasSize ? canvasSize.h : P.h;
  if (quality === "stick" && !canvasSize && !P.w) { w = 960; h = 540; }
  host.style.width = w ? w + "px" : "100vw"; host.style.height = h ? h + "px" : "100vh";
}
function newRace() {
  clock.tick = 0; clock.v = 0; clock.timers.clear(); dropTick = -1; reseed();
  applyQualityPre(quality); sizeHost();
  let seed = P.seed, tries = 0;
  for (; tries < 80; tries++, seed++) { E = DE.setup({ season: P.season, round: P.round, kind: P.kind, seed }); if (E.inMain || P.kind !== "main") break; }   /* the person must be in the field */
  DEMO.seedUsed = seed; YOU = E.G.rmap.indexOf(E.human);
  const VR = DE.viewRace(E.G, { red: P.red >= 0 ? P.red : null });
  if (canvasSize && canvasSize.pr) V.fixPR(canvasSize.pr);
  viewInfo = V.setRace(VR);
  const pk = V.layout; C = MX.Course.build(pk.layout);
  if (VR.lapT > 0 && Math.abs(C.Tlap / VR.lapT - 1) > 0.04) { const want = clamp(VR.lapT, C.Tlap * 0.87, C.Tlap * 1.15); C = MX.Course.build(Object.assign({}, pk.layout, { vavg: C.L / want })); }
  applyQualityPost(quality);
  reseed();
  DRV = DE.drive(V, E.G, { later: (fn, s) => window.setTimeout(fn, Math.max(0, s) * 1000) });
  DEMO.engine = DRV;
}
function tickOnce(draw) {
  clock.tick++; if (clock.virt) clock.v = clock.tick * 1000 / 60;
  /* the sim's random numbers depend on the tick number only: three.js draws its object UUIDs from Math.random when it first renders / builds something, so a render
     (or its timing) must never shift the stream the next tick sees; the stream restarts every tick */
  Math.random = mulberry32((0x4D585752 ^ Math.imul(P.seed | 0, 2654435761) ^ Math.imul(clock.tick, 0x9E3779B1)) | 0);
  V.advance(TICK, !draw);
  if (clock.virt) flush();
}
function advanceTicks(n, draw) { for (let i = 0; i < n; i++) tickOnce(draw && i === n - 1); }
function drop() { if (dropTick >= 0) return; dropTick = clock.tick; DRV.start(); if (clock.virt) flush(); }

/* ---------------- the API ---------------- */
function lazyBookmarks() { return DEMO._bm || null; }
function findBookmark(id) { const B = lazyBookmarks(); const b = B && (B.bookmarks || []).concat(B.extras || []).find(x => x.id === id || x.name === id); if (!b) throw new Error("no bookmark " + id + " (setBookmarks first)"); return b; }
Object.assign(DEMO, {
  t: raceT,
  step(dt, draw) {
    const n = Math.round((dt || 0) * 60);
    if (n <= 0) { if (draw) { V.advance(1e-6, false); } return raceT(); }
    advanceTicks(n, !!draw); return raceT();
  },
  skip(seconds) { advanceTicks(Math.max(0, Math.round(seconds * 60)), false); return raceT(); },
  seek(t) {
    if (t < 0) { if (dropTick >= 0) DEMO.restart(); return raceT(); }
    if (dropTick < 0) drop();
    let target = dropTick + Math.round(t * 60);
    if (clock.tick > target) { DEMO.restart(); drop(); target = dropTick + Math.round(t * 60); }
    advanceTicks(target - clock.tick, false); return raceT();
  },
  camera(spec) {
    CAM = normCam(spec); DEMO.camSpec = spec || null;
    if (CAM && hookMode === "none" && !DEMO.hookWarned) { DEMO.hookWarned = true; report("camera(spec): this view has no V.camHook and race3d.js could not be patched: the director's cameras are shown"); }
    return { mode: CAM ? CAM.kind : "director", hook: hookMode };
  },
  setBookmarks(json) { DEMO._bm = typeof json === "string" ? JSON.parse(json) : json; return (DEMO._bm.bookmarks || []).map(b => b.id); },
  bookmark(id, o) {
    o = o || {}; const b = findBookmark(id); BM = b;
    /* a still is a rigid mount (no smoothing) and the camera is set 3 ticks before the frame: the view's blob shadows and its shadow box read the PREVIOUS tick's camera, so
       the frame must not depend on which bookmark was drawn before it (checked by tools/determinism.js: alone in a fresh page = in one session) */
    const lead = 3, spec = b.cam ? JSON.parse(JSON.stringify(b.cam)) : null;
    if (spec && spec.seat !== undefined) spec.damp = 0; if (spec && spec.follow) spec.follow.damp = 0;
    DEMO.seek(b.t < 0 ? -1 : Math.max(0, b.t - lead / 60));
    DEMO.camera(spec);
    if (o.draw !== false) { DEMO.step((lead - 1) / 60, false); DEMO.step(1 / 60, true); }
    return { id: b.id, name: b.name, t: raceT(), cam: CAM ? CAM.kind : "director" };
  },
  capture(id, type, q) { DEMO.bookmark(id, { draw: true }); return DEMO.grab(type, q); },
  grab(type, q) { return V.renderer.domElement.toDataURL(type || "image/png", q == null ? 0.92 : q); },
  quality(name) { if (V.qualityNames && V.qualityNames().indexOf(name) < 0) throw new Error("no quality " + name); quality = name; DEMO.restart(); return quality; },
  qualities() { return V && V.qualityNames ? V.qualityNames() : ["high", "medium", "low", "stick"]; },
  size(w, h, pr) { canvasSize = { w, h, pr: pr == null ? 0 : pr }; DEMO.restart(); return { w, h, pr }; },
  restart() { const keep = CAM; newRace(); CAM = keep; if (keep) CAM.prime = true; return raceT(); },
  riders() {
    const st = V.state(); return st.riders.map(r => { const p = V._dbg && V._dbg.pos ? V._dbg.pos(r.s) : null; return Object.assign({}, r, p ? { x: p.x, y: p.y, z: p.z } : {}); });
  },
  scan(seconds, every) {
    const out = [], n = Math.round(seconds * 60), k = Math.max(1, Math.round((every || 1) * 60));
    for (let i = 1; i <= n; i++) { tickOnce(false); if (i % k === 0) { const st = V.state(); out.push({ t: raceT(), lap: st.lap, lapT: st.lapT, shot: st.shot && (st.shot.type + (st.shot.why ? ":" + st.shot.why : "")), order: V.order(), riders: DEMO.riders().map(r => [r.s, r.D, r.ls, r.lat, r.v, r.air ? 1 : 0, r.crash || "", r.ct, r.x, r.y, r.z]) }); } }
    return out;
  },
  stats() {
    const s = V.stats(), inf = V.renderer.info, cv = V.renderer.domElement, mem = performance.memory;
    return { t: raceT(), tick: clock.tick, lap: V.state().lap, calls: inf.render.calls, triangles: inf.render.triangles, points: inf.render.points, lines: inf.render.lines, viewCalls: s.calls, viewTris: s.tris,
      geometries: inf.memory.geometries, textures: inf.memory.textures, programs: inf.programs ? inf.programs.length : null, heapMB: mem ? +(mem.usedJSHeapSize / 1048576).toFixed(1) : null,
      canvas: { w: cv.width, h: cv.height, css: [cv.clientWidth, cv.clientHeight], pr: s.pr }, jsMs: s.jsMs, fps: s.fps, quality, camMode: CAM ? CAM.kind : "director", hook: hookMode, shadows: V.camInfo ? V.camInfo().shadows : null, gl: GLNAME, live: !clock.virt };
  },
  bench(frames) {
    frames = frames || 90; const gl = V.renderer.getContext(), px = new Uint8Array(4), sync = () => gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
    const A = [], B = [];
    for (let i = 0; i < frames; i++) { const a = realNow(); tickOnce(false); A.push(realNow() - a); }
    sync();
    for (let i = 0; i < frames; i++) { const a = realNow(); tickOnce(true); sync(); B.push(realNow() - a); }
    const q = (v, p) => { const s = v.slice().sort((x, y) => x - y); return +s[Math.min(s.length - 1, Math.floor(s.length * p))].toFixed(2); }, avg = v => +(v.reduce((x, y) => x + y, 0) / v.length).toFixed(2);
    /* the best run of 30 frames in a row: the number a throttled CPU (the runner caps it) disturbs least */
    const best30 = v => { let best = 1e9; for (let i = 0; i + 30 <= v.length; i++) { let t = 0; for (let k = 0; k < 30; k++) t += v[i + k]; if (t / 30 < best) best = t / 30; } return +best.toFixed(2); };
    return { frames, stepMs: { avg: avg(A), p50: q(A, 0.5), p95: q(A, 0.95), best30: best30(A) }, stepDrawSyncMs: { avg: avg(B), p50: q(B, 0.5), p95: q(B, 0.95), max: q(B, 0.999), best30: best30(B) }, drawMsApprox: +(avg(B) - avg(A)).toFixed(2), capacityFps: +(1000 / avg(B)).toFixed(1), capacityFpsBest: +(1000 / best30(B)).toFixed(1) };
  },
  /* what the scene holds in memory: unique textures (width x height x 4 bytes, x 4/3 with mipmaps) and geometry buffers */
  memory() {
    const seen = new Set(), tex = [], addT = t => { if (t && t.isTexture && !seen.has(t.uuid)) { seen.add(t.uuid); const im = t.image; const w = im && (im.width || (im.data && im.width)) || 0, h = im && im.height || 0; tex.push({ w, h, mip: t.generateMipmaps !== false && t.minFilter !== 1003 && t.minFilter !== 1006, name: t.name || "" }); } };
    const geos = new Set(); let geoBytes = 0;
    V.scene.traverse(o => {
      const ms = o.material ? (Array.isArray(o.material) ? o.material : [o.material]) : [];
      ms.forEach(m => { for (const k in m) { const v = m[k]; if (v && v.isTexture) addT(v); } if (m.uniforms) Object.values(m.uniforms).forEach(u => { if (u && u.value && u.value.isTexture) addT(u.value); }); });
      if (o.geometry && !geos.has(o.geometry.uuid)) { geos.add(o.geometry.uuid); const g = o.geometry; for (const k in g.attributes) { const a = g.attributes[k]; if (a.array) geoBytes += a.array.byteLength; } if (g.index && g.index.array) geoBytes += g.index.array.byteLength; }
      if (o.isInstancedMesh && o.instanceMatrix) geoBytes += o.instanceMatrix.array.byteLength;
    });
    let texBytes = 0; tex.forEach(t => { texBytes += t.w * t.h * 4 * (t.mip ? 4 / 3 : 1); });
    return { textures: tex.length, texMB: +(texBytes / 1048576).toFixed(1), biggest: tex.slice().sort((a, b) => b.w * b.h - a.w * a.h).slice(0, 4).map(t => t.w + "x" + t.h + (t.name ? " " + t.name : "")), geometries: geos.size, geoMB: +(geoBytes / 1048576).toFixed(1) };
  },
  /* a fixed amount of JS work timed on the real clock: runs on a throttled CPU (the runner caps it) read slower: compare it between runs */
  calib() { const a = realNow(); let x = 0; for (let i = 0; i < 4e6; i++) x += Math.sqrt(i) * 1.0001; const ms = realNow() - a; return { ms: +ms.toFixed(1), mItersPerSec: +(4 / (ms / 1000)).toFixed(1), x: x > 0 }; },
  live(on) {
    if (on === false) { V.show(false); clock.virt = true; clock.v = performance.now(); clock.tick = Math.round(clock.v * 60 / 1000); return "virtual"; }
    if (clock.virt) { clock.off = clock.v - realNow(); clock.virt = false; for (const t of clock.timers.values()) { const d = Math.max(0, t.at - clock.v); (t.every ? rSI : rST)(() => { try { t.fn(...t.a); } catch (e) { report(e); } }, t.every || d); } clock.timers.clear(); }
    if (dropTick < 0) { dropTick = clock.tick; DRV.start(); }
    V.show(true); return "live";
  },
  info() {
    return { view: P.view, hook: hookMode, seed: P.seed, seedUsed: DEMO.seedUsed, season: P.season, round: P.round, kind: P.kind, you: YOU, riders: E ? E.rc.n : 0, laps: E ? E.rc.o.len : 0, course: viewInfo, gl: GLNAME, quality, bootMs: Math.round(realNow() - T0),
      names: E ? E.rc.r.map((p, s) => ({ s, name: E.G.riders[E.G.rmap[s]].name, num: E.G.riders[E.G.rmap[s]].plate, bike: E.G.riders[E.G.rmap[s]].bike })) : [] };
  },
});

/* ---------------- boot ---------------- */
async function boot() {
  try {
    if (!DE) throw new Error("demo-engine.js missing");
    if (!(window.MXWarData && window.MXWarData[P.season])) await new Promise((res, rej) => { const sc = document.createElement("script"); sc.src = "data/" + P.season + ".js"; sc.onload = res; sc.onerror = () => rej(new Error("no season data data/" + P.season + ".js")); document.head.appendChild(sc); });
    const lv = await loadView(P.view); hookMode = lv.hook;
    if (!lv.mod.supported()) throw new Error("no WebGL in this browser");
    sizeHost();
    V = lv.mod.create(host, { onLap: n => { if (DRV) DRV.onLap(n); }, onFinish: () => { if (DRV) DRV.onFinish(); }, lost: () => report("WebGL context lost") });
    if (hookMode !== "none") V.camHook = hook;
    window.__mxv3 = V;
    try { const gl = V.renderer.getContext(), d = gl.getExtension("WEBGL_debug_renderer_info"); GLNAME = String(d ? gl.getParameter(d.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER)); } catch (e) { }
    window.addEventListener("resize", () => { if (!canvasSize && !P.w) { sizeHost(); V.resize(); } });
    try { const r = await fetch("demo-bookmarks.json", { cache: "no-store" }); if (r.ok) DEMO._bm = await r.json(); } catch (e) { }
    newRace();
    if (Q.get("cam")) { try { DEMO.camera(JSON.parse(Q.get("cam"))); } catch (e) { report(e); } }
    DEMO.state = "ready";
    if (P.live) { DEMO.live(true); }
    if (P.hud) { const h = document.getElementById("hud"); h.style.display = "block"; rST(function u() { try { const s = DEMO.stats(); h.textContent = "t " + raceT().toFixed(1) + "s  lap " + s.lap + "  " + s.canvas.w + "x" + s.canvas.h + "  calls " + s.calls + "  tris " + s.triangles + "  fps " + s.fps + "  " + hookMode; } catch (e) { } rST(u, 500); }, 500); }
    return DEMO.info();
  } catch (e) { DEMO.state = "failed"; report(e); throw e; }
}
if (Q.get("boot") === "0") { DEMO.state = "idle"; DEMO.ready = Promise.resolve(null); }   /* a blank page on the served origin (tests: add-on imports) */
else { DEMO.ready = boot(); DEMO.ready.catch(() => { }); }
