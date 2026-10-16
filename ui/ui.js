/* Board Games UI helpers: window.BGUI (the ONLY global this file creates).
   Pairs with ui/theme.css. Plain ES5, no dependencies, no build step. Every call is safe when its element is missing.

   BGUI.haptic(pattern)              guarded navigator.vibrate; pattern = name ("tap","select","turn","success","warn","error","roll") | ms | array
   BGUI.toast(msg, opts)             one shared toast; placed in the first free band (bottom up, then top down) clear of every
                                     visible .bg-players strip, the top bar, the TV hint bar, an open sheet and [data-toast-avoid];
                                     when an open sheet leaves no free band it is held out of sight until the sheet closes (never over
                                     a strip)
   BGUI.sheet.open(el, opts)/close() bottom sheet: focus trap, Back/Escape closes, restores focus; opts {onClose, dismissible, focus};
                                     while the top sheet must be answered (dismissible: false) html[data-back-held] is set and the TV
                                     hint bar steps aside
   BGUI.win.open(el)/close()         win overlay (.bg-win): modal (Tab + D-pad stay inside), restores focus to the opener on close
   BGUI.celebrate(opts)              one-shot canvas burst of gold confetti + a gold ray bloom; auto-removes its canvas; nothing under reduced motion
   BGUI.effects.get()/set(level)     "full" (default) | "reduced": persisted (localStorage "bgui.effects"), reflected as html[data-effects];
                                     .motion() = what really runs ("full" | "reduced" | "off" under reduced motion);
                                     .state() = {level, motion, hz}: hz of the ONE effects ticker (4 orbs, 8 game stage, 24 win
                                     screen, 0 still); .rate = {orbs, win, beat, stage}: updates a second of the ticker and of the
                                     stepped hero fade; follows "bgui.effects" changes made in another tab
   BGUI.hero.show(el, {src, game})   crossfades the two .bg-hero__layer backdrops (the next image is decoded first, then fades in
                                     on top by opacity, stepped at effects.rate.beat)
   BGUI.mark() / BGUI.trophy()       the gold "diamond die" logomark and the laurel trophy as inline SVG strings
   BGUI.flip(el, fromRect, opts)     FLIP move (transform only)
   BGUI.tweenNumber(el, a, b, ms)    counts a number up/down
   BGUI.countdown(el, seconds, opts) ring timer (repaints 4x a second, no continuous animation); returns {stop,pause,resume,remaining,done}
   BGUI.ambient                      ONE scheduler for rare one-shot beats (emblem glint, turn pulse): never two at once,
                                     paused while the page is hidden or motion is reduced (CSS animations on their own layers)
   BGUI.setTurn(playerEl)            moves the static turn ring and asks the scheduler for 3 pulses; the new turn's pulse replaces the
                                     previous player's (running or queued) on the same strip, or on a chip a rebuilt strip left
                                     behind, so it never waits behind it
   BGUI.stage(game, opts)            "this page is game X": html[data-game], the Luxe ambient layer (.bg-ambient: orbs in the house
                                     gold, the game's accent and violet, soft light beams that sweep across the stage + rising gold-line
                                     game motifs that keep to the columns a board leaves free and fade out over text on the
                                     stage, Trouble's slow-turning gold halo round its board, all moved by the effects ticker),
                                     the glint on every .bg-emblem, .bg-frame on opts.frames, the TV Back default (BGUI.back);
                                     call again to switch game. Skins.apply(game) calls it on pages that load ui.js. .current() / .clear()
   BGUI.back                         the remote's Back on a game page: window.__tvBack (Fire TV app), a history guard for TV
                                     browsers and the Back key: closes the top layer, then the page's own step (.on(fn)), then the hub
   BGUI.focus                        D-pad spatial navigation (auto-enabled in TV mode); Enter = click; stays inside an open sheet/win;
                                     the top bar is its own zone and focus scrolls clear of it (Down never enters it; at the end of
                                     the page Down scrolls on only while the focused control stays clear of it); a switch is
                                     revealed with its whole row (the ring's element); arrows never get stuck in select/text/radio
   BGUI.dice                         SVG pip faces + a cheap roll (transform tumble + a few face swaps)
   BGUI.setTV(on) / isTV()           html[data-tv]; auto for ?tv=1 and window.AndroidTV
   BGUI.mount.*                      seg, stepper, toggle, versions, players, emblem, orbs, effectsRow (the "Reduce effects" switch
                                     row), auto (declarative data-bg-mount)
   BGUI.icon(name)                   from ui/icons.js (optional)
   BGUI.names                        player names: one device-wide name ("bg_player_name") + hot-seat names, the fields, the computers' names
   BGUI.hop(el, {ms, lift})          one visible hop (a lift on a plain wrapper) per space a piece passes
   BGUI.firstPlayer(opts)            the who-goes-first show (dice, die on the map, card, cut, flip, spin); .resolve runs the rule */
(function (w, d) {
  "use strict";
  if (!w || !d) return;
  var BGUI = w.BGUI || {};
  w.BGUI = BGUI;
  var root = d.documentElement;
  var P = w.Promise;

  /* ---------------- small utilities ---------------- */
  function $(x, ctx) {
    if (!x) return null;
    if (typeof x === "string") { try { return (ctx || d).querySelector(x); } catch (e) { return null; } }
    return x.nodeType === 1 ? x : null;
  }
  function $$(sel, ctx) { try { return Array.prototype.slice.call((ctx || d).querySelectorAll(sel)); } catch (e) { return []; } }
  function resolved(v) { return P ? P.resolve(v) : { then: function (f) { if (f) f(v); return this; } }; }
  function promise(fn) { if (P) return new P(fn); var v; fn(function (x) { v = x; }); return resolved(v); }
  function now() { return (w.performance && w.performance.now) ? w.performance.now() : Date.now(); }
  function raf(f) { return w.requestAnimationFrame ? w.requestAnimationFrame(f) : setTimeout(function () { f(now()); }, 16); }
  function caf(id) { if (w.cancelAnimationFrame) w.cancelAnimationFrame(id); else clearTimeout(id); }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" }[c]; }); }
  function emit(name, detail) { try { d.dispatchEvent(new CustomEvent("bgui:" + name, { detail: detail })); } catch (e) { } }
  function icon(name) { try { return typeof BGUI.icon === "function" ? BGUI.icon(name) : ""; } catch (e) { return ""; } }
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function focusEl(el) { if (!el) return; try { el.focus({ preventScroll: true }); } catch (e) { try { el.focus(); } catch (e2) { } } }
  function isVisible(el) {
    if (!el || !el.getClientRects || !el.getClientRects().length) return false;
    var cs = w.getComputedStyle(el);
    return cs.visibility !== "hidden" && cs.display !== "none";
  }

  /* ---------------- reduced motion ---------------- */
  var mq = w.matchMedia ? w.matchMedia("(prefers-reduced-motion: reduce)") : null;
  function reducedMotion() { return root.getAttribute("data-motion") === "reduce" || !!(mq && mq.matches); }
  function setReducedMotion(on) {
    if (on === null || on === undefined) root.removeAttribute("data-motion"); else root.setAttribute("data-motion", on ? "reduce" : "full");
    ambientRefresh();
    return reducedMotion();
  }
  if (mq) { var mqf = function () { ambientRefresh(); }; if (mq.addEventListener) mq.addEventListener("change", mqf); else if (mq.addListener) mq.addListener(mqf); }

  /* ---------------- effects level: "full" (default) | "reduced" ----------------
     Every Luxe effect is ON by default. "reduced" turns the endless ambient motion down for slow devices (orbs rest after
     lighting up, the win rays hold still, the confetti holds still, half the confetti burst, glints half as often).
     Reduced motion (OS or data-motion) still wins and stops all motion. */
  var FX_KEY = "bgui.effects", fxLevel = "full";
  function fxStored() { try { return w.localStorage && w.localStorage.getItem(FX_KEY) === "reduced" ? "reduced" : "full"; } catch (e) { return "full"; } }
  function fxApply(v) { fxLevel = v === "reduced" ? "reduced" : "full"; root.setAttribute("data-effects", fxLevel); return fxLevel; }
  fxApply(root.getAttribute("data-effects") || fxStored());   // a page's head script may already have set it (no first-paint flash)
  var effects = {
    key: FX_KEY,
    levels: ["full", "reduced"],
    get: function () { return fxLevel; },
    set: function (v) {
      fxApply(v);
      try { if (w.localStorage) w.localStorage.setItem(FX_KEY, fxLevel); } catch (e) { }
      ambientRefresh();
      emit("effects", { level: fxLevel, motion: effects.motion() });
      return fxLevel;
    },
    motion: function () { return reducedMotion() ? "off" : fxLevel; },
    /* the continuous-effects ticker: hz = 4 (orbs drifting), 8 (game stage: motifs, orbs still 4), 24 (win rays + confetti) or 0 (nothing endless is moving) */
    state: function () { return { level: fxLevel, motion: effects.motion(), hz: tick.hz, hidden: !!d.hidden }; }
  };
  /* everything pauses while the page is hidden: CSS loops via html[data-hidden], beats via the ambient scheduler */
  function hiddenFlag() { if (d.hidden) root.setAttribute("data-hidden", ""); else root.removeAttribute("data-hidden"); }
  hiddenFlag();
  d.addEventListener("visibilitychange", hiddenFlag);
  /* one origin, one key: a change made in another tab of the collection applies here too */
  w.addEventListener("storage", function (e) {
    if (e.key !== FX_KEY && e.key !== null) return;
    var v = fxStored();
    if (v === fxLevel) return;
    fxApply(v); ambientRefresh();
    emit("effects", { level: fxLevel, motion: effects.motion() });
  });

  /* ---------------- continuous effects: ONE ticker ----------------
     The endless effects (the light orbs' drift, the win screen's ray wheel and falling confetti) are moved by this timer,
     not by CSS animations: a running CSS animation keeps the compositor producing 60 frames a second, while a timer that
     moves promoted layers N times a second costs about N composites (README section 6 has the measured CPU of each rate).
     Only transform is written, on layers that are already promoted (will-change), so a tick never lays out or repaints.
     The orbs drift a few px a second, so 4 updates a second look continuous. The win screen runs at film rate (24 a second):
     the rays turn 6 degrees a second (the mockup's 60 s a turn) and every confetti piece falls, sways and spins on its own
     tiny layer. That fits the budget because the page under the opaque win scrim is not drawn at all (theme.css hides it),
     no full-screen confetti sheet is blended, and only the bright inner part of the ray wheel turns (its faint outer glow
     is a static gradient in the scrim). One ticker for the whole page; it stops while the page is hidden, under
     "Reduce effects" and under reduced motion. */
  var RATE = { orbs: 4, win: 24, beat: 30, stage: 8 };   // updates a second: orb drift, win screen, the stepped hero fade, game-stage motifs
  var RAY_DEG_S = 6;                           // the mockup's ray wheel: one turn a minute
  var ORBS = [[9, 5, 46], [-8, -6, 58], [9, 5, 64]];   // drift: x rem, y rem, seconds per leg (eased there and back)
  var tick = { id: 0, hz: 0, last: 0, orbT: 0, orbAt: 0, winT: 0, win: null, bits: null, H: 0, rem: 16 };
  var stg = { game: null, el: null, bits: null, beams: null, t: 0, H: 0, W: 0, pad: 0, chk: -9, cols: "", texts: null,   // the game stage (BGUI.stage)
    halo: null, haloSel: null, haloA: 0, haloK: 0, haloD: 0, haloOn: false };                                           // its halo round a round board
  function fxWant() {
    if (d.hidden || reducedMotion() || fxLevel !== "full") return 0;
    var win = openWin();
    if (win) return win.querySelector(".bg-win__wheel, .bg-win__fall") ? Math.max(1, +RATE.win || 24) : 0;
    if (stg.el && stg.el.parentNode && stg.el.querySelector(".bg-motifs > b, .bg-beams > i, .bg-halo > i")) return Math.max(1, +RATE.stage || 8);   // motifs, beams and the halo 8 a second, orbs still 4
    return d.querySelector(".bg-orbs > i") ? Math.max(1, +RATE.orbs || 4) : 0;
  }
  /* the confetti pieces of an open win overlay with their flight data (data-f: y0, fall speed, sway rem, phase, spin) */
  function winBits(win) {
    tick.rem = parseFloat(w.getComputedStyle(root).fontSize) || 16;
    tick.H = win.clientHeight || w.innerHeight || 800;
    return $$(".bg-win__fall > b", win).map(function (el) {
      var f = (el.getAttribute("data-f") || "").split(",").map(Number);
      return { el: el, y0: f[0] || 0, v: f[1] || 0.05, amp: (f[2] || 0) * tick.rem, ph: f[3] || 0, r0: f[4] || 0, spin: f[5] || 0 };
    });
  }
  w.addEventListener("resize", function () { if (tick.win) tick.bits = null; stg.bits = null; });
  function fxTick() {
    var t = now(), dt = tick.last ? Math.min(0.5, (t - tick.last) / 1000) : 0, win = openWin();
    tick.last = t;
    if (win) {
      if (win !== tick.win) { tick.win = win; tick.winT = 0; tick.bits = null; }
      if (!tick.bits) tick.bits = winBits(win);
      var s = (tick.winT += dt), wheel = win.querySelector(".bg-win__wheel"), span = tick.H + 64;
      if (wheel) wheel.style.transform = "rotate(" + (s * RAY_DEG_S % 360).toFixed(2) + "deg)";
      for (var i = 0; i < tick.bits.length; i++) {   // each piece: down one screen in about 20 s (far ones slower), swaying and spinning
        var p = tick.bits[i], dy = (((p.y0 + s * p.v) % 1) - p.y0) * span, dx = Math.sin(s * 0.9 + p.ph) * p.amp;
        p.el.style.transform = "translate3d(" + dx.toFixed(1) + "px," + dy.toFixed(1) + "px,0) rotate(" + ((p.r0 + s * p.spin) % 360).toFixed(1) + "deg)";
      }
      return;
    }
    var o = (tick.orbT += dt);
    if (!tick.orbAt || t - tick.orbAt >= 1000 / Math.max(1, +RATE.orbs || 4) - 30) {   // the orbs move 4 times a second even when the stage ticks faster
      tick.orbAt = t;
      $$(".bg-orbs > i").forEach(function (el, i) {
        var p = ORBS[i % 3], k = (1 - Math.cos(Math.PI * o / p[2])) / 2;
        el.style.transform = "translate3d(" + (p[0] * k).toFixed(3) + "rem," + (p[1] * k).toFixed(3) + "rem,0)";
      });
    }
    if (stg.el) motifPose(dt);
  }
  function fxRefresh() {
    var want = fxWant();
    if (want === tick.hz) return;
    if (tick.id) { clearInterval(tick.id); tick.id = 0; }
    tick.hz = want; tick.last = 0; tick.orbAt = 0;
    if (!openWin()) { tick.win = null; tick.bits = null; }
    if (want) { tick.id = setInterval(fxTick, Math.round(1000 / want)); fxTick(); }
  }
  effects.rate = RATE;

  /* ---------------- stepped fade (hero crossfade) ----------------
     A timer at RATE.beat (30 a second) writes the incoming layer's opacity instead of a 60 fps CSS transition: an opacity
     ramp looks the same at video rate and measured cheaper on the phone (README section 6). The short beats (glint, turn
     pulse) stay compositor-driven CSS animations: stepping those by a timer measured dearer. */
  function stepper(ms, f, done) {
    var t0 = now(), id = 0, over = false;
    function end(ok) { if (over) return; over = true; if (id) clearInterval(id); if (done) done(ok); }
    function run() { if (over) return; var k = ms > 0 ? Math.min(1, (now() - t0) / ms) : 1; f(k); if (k >= 1) end(true); }
    run();
    if (!over) id = setInterval(run, Math.round(1000 / Math.max(1, +RATE.beat || 30)));
    return { stop: function () { end(false); }, over: function () { return over; } };
  }
  function easeOut(k) { return 1 - Math.pow(1 - k, 3); }
  function cssMs(el, name, dflt) {
    var v = "";
    try { v = (w.getComputedStyle(el).getPropertyValue(name) || "").trim(); } catch (e) { }
    var n = parseFloat(v);
    if (isNaN(n)) return dflt;
    return /ms$/.test(v) ? n : /s$/.test(v) ? n * 1000 : n;
  }

  /* ---------------- haptics ---------------- */
  var HAPTIC = { tap: 8, select: 12, turn: 20, success: [18, 40, 28], warn: [40, 30, 40], error: [60, 40, 60], roll: [6, 30, 6, 30, 10] };
  function haptic(pattern) {
    if (!haptic.enabled) return false;
    var n = w.navigator;
    if (!n || typeof n.vibrate !== "function") return false;
    var p = typeof pattern === "string" ? HAPTIC[pattern] : pattern;
    if (p === null || p === undefined) p = HAPTIC.tap;
    try { return !!n.vibrate(p); } catch (e) { return false; }
  }
  haptic.enabled = true;
  haptic.patterns = HAPTIC;

  /* ---------------- toast ---------------- */
  var toastEl = null, toastTimer = 0, toastEnd = 0, toastHeld = false;   // held: waiting out of sight for an open sheet to close
  function toastNode() {
    if (toastEl && toastEl.parentNode) return toastEl;
    if (!d.body) return null;
    toastEl = d.createElement("div");
    toastEl.className = "bg-toast";
    toastEl.setAttribute("role", "status");
    toastEl.setAttribute("aria-live", "polite");
    d.body.appendChild(toastEl);
    return toastEl;
  }
  /* every visible band the toast must not cover: the top bar, EACH .bg-players strip (wherever it sits: top, middle or
     bottom), the TV hint bar (.bg-hintbar: a toast sat over its text, step 4 Monopoly review), [data-toast-avoid] and an open
     sheet. Bands are treated as full width (the toast is centred). */
  function avoidBands(vh) {
    var out = [];
    $$(".bg-topbar, .bg-players, .bg-hintbar, [data-toast-avoid]").forEach(function (el) {
      if (el.closest && el.closest(".bg-sheet, .bg-win")) return;
      if (!isVisible(el)) return;
      var r = el.getBoundingClientRect();
      if (r.bottom <= 0 || r.top >= vh || r.height <= 0) return;
      out.push({ top: Math.max(0, r.top), bottom: Math.min(vh, r.bottom) });
    });
    var s = sheetTop();
    if (s) out.push({ top: Math.max(0, vh - s.offsetHeight), bottom: vh });   // layout height: correct even mid-slide
    return out;
  }
  /* first free spot for a toast of height h: scanning up from the bottom edge, or down from the top edge */
  function freeSpot(bands, vh, h, gap, edge, from) {
    var y = from === "top" ? edge : vh - edge - h, guard = 0, moved = true;
    while (moved && guard++ < 40) {
      moved = false;
      for (var i = 0; i < bands.length; i++) {
        var b = bands[i];
        if (y < b.bottom + gap && y + h > b.top - gap) { y = from === "top" ? b.bottom + gap : b.top - gap - h; moved = true; }
      }
      if (y < 0 || y + h > vh) return null;
    }
    return moved ? null : y;
  }
  function placeToast(el, want) {
    var vh = w.innerHeight || root.clientHeight, gap = 12;
    el.style.top = ""; el.style.bottom = "";
    var edge = parseFloat(w.getComputedStyle(el).bottom) || 20;    // the CSS resting gap (safe area included)
    var h = el.offsetHeight || 48, bands = avoidBands(vh);
    var order = want === "top" ? ["top", "bottom"] : ["bottom", "top"], mode = order[0], y = null, held = false;
    for (var i = 0; i < order.length && y === null; i++) { mode = order[i]; y = freeSpot(bands, vh, h, gap, edge, mode); }
    if (y === null) {   // nothing is free: just under the top bar, over the least important band
      mode = "top"; y = edge;
      $$(".bg-topbar").forEach(function (b) { if (isVisible(b)) { var r = b.getBoundingClientRect(); if (r.top <= 1 && r.bottom + gap > y) y = r.bottom + gap; } });
      /* with a sheet open (a tall sheet over the strip) that spot would cover the player strip: the toast is HELD instead, out
         of sight (parked there, clear of the sheet) until the sheet closes, then shown for what is left of its time */
      held = !!sheetTop();
    }
    el.classList.toggle("is-top", mode === "top");
    if (mode === "top") { el.style.top = Math.round(y) + "px"; el.style.bottom = "auto"; }
    else { el.style.top = "auto"; el.style.bottom = Math.round(vh - y - h) + "px"; }
    return held ? "held" : mode;
  }
  function toast(msg, opts) {
    opts = opts || {};
    var el = toastNode();
    if (!el) return null;
    clearTimeout(toastTimer);
    var html = "";
    if (opts.seat) html += "<span class=\"bg-token\" data-seat=\"" + esc(opts.seat) + "\" aria-hidden=\"true\">" + esc(opts.token || "") + "</span>";
    if (opts.icon) html += icon(opts.icon);
    html += "<span class=\"bg-toast__msg\">" + (opts.html ? String(msg) : esc(msg)) + "</span>";
    el.innerHTML = html;
    el.classList.remove("is-show");
    var ms = opts.ms === undefined ? 2600 : opts.ms;
    toastEnd = ms > 0 ? now() + ms : Infinity;
    var mode = placeToast(el, opts.place);
    toastHeld = mode === "held";
    if (!toastHeld) { void el.offsetWidth; el.classList.add("is-show"); }
    if (opts.haptic) haptic(opts.haptic);
    if (ms > 0) toastTimer = setTimeout(hideToast, ms);
    return { el: el, place: mode, hide: hideToast };
  }
  function hideToast() { clearTimeout(toastTimer); toastHeld = false; if (toastEl) toastEl.classList.remove("is-show"); }
  /* the layout changed (a sheet opened or closed, TV mode): place a showing toast again, hold it while a sheet leaves no free
     band, or bring a held one back once there is room (unless its time is nearly over) */
  function toastRelayout() {
    if (!toastEl || !(toastHeld || toastEl.classList.contains("is-show"))) return;
    var mode = placeToast(toastEl);
    if (mode === "held") { toastHeld = true; toastEl.classList.remove("is-show"); return; }
    if (!toastHeld) return;
    toastHeld = false;
    if (toastEnd - now() < 500) return;
    void toastEl.offsetWidth;
    toastEl.classList.add("is-show");
  }
  toast.hide = hideToast;
  toast.place = toastRelayout;
  toast.held = function () { return toastHeld; };

  /* ---------------- bottom sheet ---------------- */
  var stack = [], scrimEl = null, refocusing = false;
  var FOCUSABLE = "[data-focus], button, a[href], input:not([type=hidden]), select, textarea, [tabindex], [role=button], [role=switch], [role=radio], [role=option], [role=tab]";
  function sheetTop() { return stack.length ? stack[stack.length - 1].el : null; }
  function scrim() {
    if (scrimEl && scrimEl.parentNode) return scrimEl;
    if (!d.body) return null;
    scrimEl = d.createElement("div");
    scrimEl.className = "bg-scrim";
    scrimEl.setAttribute("aria-hidden", "true");
    scrimEl.addEventListener("click", function () { var t = stack[stack.length - 1]; if (t && t.opts.dismissible !== false) closeSheet(t.el, "scrim"); });
    d.body.appendChild(scrimEl);
    return scrimEl;
  }
  function tabbables(ctx) {
    return $$(FOCUSABLE, ctx).filter(function (el) {
      if (el.disabled || el.getAttribute("tabindex") === "-1" || el.getAttribute("aria-disabled") === "true") return false;
      return isVisible(el);
    });
  }
  function restack() {
    var s = scrim();
    stack.forEach(function (e, i) { e.el.style.zIndex = String(61 + 2 * i); });
    if (s) {
      if (stack.length) { s.style.zIndex = String(60 + 2 * (stack.length - 1)); s.classList.add("is-open"); }
      else { s.classList.remove("is-open"); s.style.zIndex = ""; }
    }
    /* the top sheet must be answered (dismissible: false): Back is held there, so html[data-back-held] lets the TV hint bar step
       aside instead of promising a Back that does nothing (theme.css; step 4 Rummy review) */
    var top = stack.length ? stack[stack.length - 1] : null;
    if (top && top.opts.dismissible === false) root.setAttribute("data-back-held", ""); else root.removeAttribute("data-back-held");
  }
  function openSheet(target, opts) {
    var el = $(target);
    if (!el) return null;
    opts = opts || {};
    for (var i = 0; i < stack.length; i++) if (stack[i].el === el) return el;
    if (!el.getAttribute("role")) el.setAttribute("role", "dialog");
    el.setAttribute("aria-modal", "true");
    el.removeAttribute("aria-hidden");
    if (!el.hasAttribute("tabindex")) el.setAttribute("tabindex", "-1");
    stack.push({ el: el, opener: d.activeElement, opts: opts, dpad: !!d.querySelector(".is-focus") });
    restack();
    el.classList.add("is-open");
    var first = $(opts.focus, el) || el.querySelector("[data-autofocus]") || tabbables(el)[0] || el;
    if (focusOn && stack[stack.length - 1].dpad && first !== el) setFocus(first); else focusEl(first);
    toastRelayout();   // a showing toast is placed again (or held while the sheet leaves no free band); a held one comes back
    emit("sheet", { open: true, el: el });
    return el;
  }
  function closeSheet(target, reason) {
    if (!stack.length) return false;
    var el = target ? $(target) : sheetTop(), idx = -1;
    for (var i = 0; i < stack.length; i++) if (stack[i].el === el) idx = i;
    if (idx < 0) return false;
    var e = stack.splice(idx, 1)[0];
    e.el.classList.remove("is-open");
    e.el.style.zIndex = "";
    restack();
    var back = e.opener;
    if (back && back.parentNode && back !== d.body && isVisible(back)) { if (focusOn && e.dpad) setFocus(back); else focusEl(back); }
    else if (stack.length) focusEl(tabbables(sheetTop())[0] || sheetTop());
    if (typeof e.opts.onClose === "function") { try { e.opts.onClose(reason || "close"); } catch (err) { setTimeout(function () { throw err; }); } }
    toastRelayout();   // a showing toast is placed again (or held while the sheet leaves no free band); a held one comes back
    emit("sheet", { open: false, el: e.el, reason: reason || "close" });
    return true;
  }
  function isBackKey(e) {
    var k = e.key;
    if (k === "Escape" || k === "Esc" || k === "GoBack" || k === "BrowserBack" || e.keyCode === 27 || e.keyCode === 4) return true;
    if ((k === "Backspace" || e.keyCode === 8) && !isTextField(e.target)) return true;
    return false;
  }
  function isTextField(t) {
    if (!t || !t.tagName) return false;
    if (t.isContentEditable) return true;
    if (t.tagName === "TEXTAREA") return true;
    return t.tagName === "INPUT" && !/^(checkbox|radio|button|submit|reset|range|color|image|file)$/i.test(t.type || "text");
  }
  function openWin() { return d.querySelector(".bg-win.is-open"); }
  function trapTab(e, box) {
    var list = tabbables(box);
    if (!list.length) { e.preventDefault(); focusEl(box); return; }
    var i = list.indexOf(d.activeElement), n = list.length;
    var j = e.shiftKey ? (i <= 0 ? n - 1 : i - 1) : (i < 0 || i >= n - 1 ? 0 : i + 1);
    e.preventDefault(); focusEl(list[j]);
  }
  d.addEventListener("keydown", function (e) {
    if (e.defaultPrevented) return;
    var tab = e.key === "Tab" || e.keyCode === 9;
    if (!stack.length) { var wn = tab ? openWin() : null; if (wn) trapTab(e, wn); return; }   // an open win overlay is modal too
    var top = stack[stack.length - 1];
    if (isBackKey(e)) {
      if (top.opts.dismissible === false) return;
      e.preventDefault(); e.stopPropagation();
      closeSheet(top.el, "back");
      return;
    }
    if (tab) trapTab(e, top.el);
  }, true);
  /* focus trap: focus that lands outside the top sheet (or the open win overlay) goes back inside, unless another (foreign) dialog took it */
  d.addEventListener("focusin", function (e) {
    if (refocusing) return;
    var top = sheetTop() || openWin(), t = e.target;
    if (!top || !t || top.contains(t)) return;
    if (t.closest && t.closest("[aria-modal='true'], [role='dialog'], #bgSoundPanel")) return;
    refocusing = true;
    try { focusEl(tabbables(top)[0] || top); } finally { refocusing = false; }
  }, true);
  var sheet = { open: openSheet, close: closeSheet, top: sheetTop, isOpen: function (el) { el = $(el); if (!el) return stack.length > 0; for (var i = 0; i < stack.length; i++) if (stack[i].el === el) return true; return false; } };

  /* ---------------- art strings: logomark + trophy (original, filter-free, no <text>) ---------------- */
  var uidN = 0;
  function mark() {
    var u = "bgmk" + (++uidN);
    var pips = [[24, 14.5], [14.5, 24], [24, 24], [33.5, 24], [24, 33.5]].map(function (p) { return "<circle cx=\"" + p[0] + "\" cy=\"" + p[1] + "\" r=\"2.6\" fill=\"url(#" + u + ")\"/>"; }).join("");
    return "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 48 48\" aria-hidden=\"true\" focusable=\"false\"><defs><linearGradient id=\"" + u + "\" x1=\"0\" y1=\"0\" x2=\"1\" y2=\"1\">" +
      "<stop offset=\"0\" stop-color=\"#fff1cc\"/><stop offset=\".5\" stop-color=\"#e2c48a\"/><stop offset=\"1\" stop-color=\"#a67b3f\"/></linearGradient></defs>" +
      "<rect x=\"9\" y=\"9\" width=\"30\" height=\"30\" rx=\"7\" transform=\"rotate(45 24 24)\" fill=\"none\" stroke=\"url(#" + u + ")\" stroke-width=\"2.6\"/>" +
      "<rect x=\"14.5\" y=\"14.5\" width=\"19\" height=\"19\" rx=\"4\" transform=\"rotate(45 24 24)\" fill=\"url(#" + u + ")\" opacity=\".16\"/>" + pips + "</svg>";
  }
  function f1(v) { return Math.round(v * 10) / 10; }
  function trophy() {
    var u = "bgtr" + (++uidN), lau = "<path d=\"M60 112A54 54 0 0 1 32 34M100 112A54 54 0 0 0 128 34\" fill=\"none\" stroke=\"url(#" + u + ")\" stroke-width=\"2.2\"/>";
    for (var l = 0; l < 7; l++) {
      var th = (118 + l * 17) * Math.PI / 180, tg = 118 + l * 17 + 90;
      [[60, tg + 28], [47, tg - 28]].forEach(function (lv) {
        var x = 80 + lv[0] * Math.cos(th), y = 64 + lv[0] * Math.sin(th);
        lau += "<ellipse cx=\"" + f1(x) + "\" cy=\"" + f1(y) + "\" rx=\"8.5\" ry=\"3.4\" transform=\"rotate(" + f1(lv[1]) + " " + f1(x) + " " + f1(y) + ")\"/>" +
          "<ellipse cx=\"" + f1(160 - x) + "\" cy=\"" + f1(y) + "\" rx=\"8.5\" ry=\"3.4\" transform=\"rotate(" + f1(180 - lv[1]) + " " + f1(160 - x) + " " + f1(y) + ")\"/>";
      });
    }
    return "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 160 136\" aria-hidden=\"true\" focusable=\"false\"><defs><linearGradient id=\"" + u + "\" x1=\"0\" y1=\"0\" x2=\"1\" y2=\"1\">" +
      "<stop offset=\"0\" stop-color=\"#fff3cf\"/><stop offset=\".45\" stop-color=\"#e2c48a\"/><stop offset=\".75\" stop-color=\"#a77d41\"/><stop offset=\"1\" stop-color=\"#f0d9a6\"/></linearGradient></defs>" +
      "<g fill=\"url(#" + u + ")\">" + lau + "</g>" +
      "<path d=\"M58 20h44v26c0 14-10 24-22 24S58 60 58 46Z\" fill=\"url(#" + u + ")\"/>" +
      "<path d=\"M64 24h8v24c0 6 3 11 8 14-9-1-16-8-16-18Z\" fill=\"#fff\" opacity=\".35\"/>" +
      "<path d=\"M58 26H46c0 12 6 20 15 22M102 26h12c0 12-6 20-15 22\" fill=\"none\" stroke=\"url(#" + u + ")\" stroke-width=\"4\"/>" +
      "<rect x=\"74\" y=\"70\" width=\"12\" height=\"14\" fill=\"url(#" + u + ")\"/><rect x=\"62\" y=\"84\" width=\"36\" height=\"10\" rx=\"3\" fill=\"url(#" + u + ")\"/><rect x=\"56\" y=\"94\" width=\"48\" height=\"8\" rx=\"3\" fill=\"#a77d41\"/>" +
      "<path d=\"M80 31l3.2 6.6 7.2 1-5.2 5 1.3 7.2L80 47.4l-6.5 3.4 1.3-7.2-5.2-5 7.2-1Z\" style=\"fill:var(--accent-paper,#6b5124)\" opacity=\".9\"/></svg>";
  }

  /* win overlay dressing, built once per overlay: the ray wheel (4 quadrants of ONE pre-rendered image of the bright inner
     rays on one layer; the faint outer glow is a static gradient in the scrim), the confetti (36 pieces, each its own tiny
     promoted layer moved by the ticker: no full-screen sheet to blend on every tick) and the trophy in an empty medal */
  var CONFETTI = ["#f9ebc6", "#e9cd93", "#c99f5e", "#fff6dc", "#d5af6d", "#ff5d73", "#5f95ff", "#3fd391", "#b383ff", "#ffcb4f"];
  function fallLayer(seed) {
    var html = "", n = 36, r = seed;
    function rnd() { r = (r * 9301 + 49297) % 233280; return r / 233280; }
    for (var i = 0; i < n; i++) {
      var far = i % 5 > 2, k = rnd(), cls = (k < 0.18 ? "is-dot" : k < 0.34 ? "is-gem" : "") + (far ? " is-far" : "");
      var x = (rnd() * 96 + 2).toFixed(1), y0 = rnd(), rot = Math.round(rnd() * 180), c = CONFETTI[Math.floor(rnd() * CONFETTI.length)];
      var v = far ? 0.032 + rnd() * 0.012 : 0.044 + rnd() * 0.018;                   // screens a second: about 20 s a screen, far ones slower
      var amp = (far ? 0.3 : 0.55) + rnd() * 0.6, ph = rnd() * 6.283;                 // sway in rem
      var spin = (rnd() < 0.5 ? -1 : 1) * (far ? 18 + rnd() * 24 : 30 + rnd() * 50);  // degrees a second
      cls = cls.replace(/^ /, "");
      html += "<b" + (cls ? " class=\"" + cls + "\"" : "") + " data-f=\"" + [y0.toFixed(3), v.toFixed(4), amp.toFixed(2), ph.toFixed(2), rot, spin.toFixed(1)].join(",") +
        "\" style=\"left:" + x + "%;top:calc(" + y0.toFixed(3) + " * (100% + 64px) - 32px);background:" + c + ";transform:rotate(" + rot + "deg)\"></b>";
    }
    return "<i class=\"bg-win__fall\">" + html + "</i>";
  }
  function winDress(el) {
    var rays = el.querySelector(".bg-win__rays");
    if (rays && !rays.querySelector(".bg-win__wheel")) rays.innerHTML = "<span class=\"bg-win__wheel\"><i></i><i></i><i></i><i></i></span>";
    if (!el.querySelector(".bg-win__confetti")) {
      var cf = d.createElement("div");
      cf.className = "bg-win__confetti"; cf.setAttribute("aria-hidden", "true");
      cf.innerHTML = fallLayer(31);
      el.insertBefore(cf, el.querySelector(".bg-win__card"));
    }
    var medal = el.querySelector(".bg-win__medal");
    if (medal && !medal.firstElementChild) medal.innerHTML = trophy();
  }
  /* centre the rays on the trophy (layout offsets, so the card's entrance transform does not skew it) */
  function winAim(el) {
    var medal = el.querySelector(".bg-win__medal"), card = el.querySelector(".bg-win__card");
    if (!medal || !card) { el.style.removeProperty("--bg-rays-y"); return; }
    var y = el.getBoundingClientRect().top + card.offsetTop + medal.offsetTop + medal.offsetHeight / 2 - el.scrollTop;
    el.style.setProperty("--bg-rays-y", Math.round(y) + "px");
  }

  /* ---------------- win overlay: BGUI.win.open/close add .is-open, move focus in and give it back on close ---------------- */
  var winOpener = null;
  function openWinEl(target, opts) {
    var el = $(target);
    if (!el) return null;
    opts = opts || {};
    if (!el.classList.contains("is-open")) winOpener = d.activeElement;
    if (!el.getAttribute("role")) el.setAttribute("role", "dialog");
    el.setAttribute("aria-modal", "true");
    if (!el.hasAttribute("tabindex")) el.setAttribute("tabindex", "-1");
    var dpad = !!marked || isTV();
    winDress(el);
    el.classList.add("is-open");
    root.setAttribute("data-win", "");   // the orbs under the overlay rest while it is open
    winAim(el);
    fxRefresh();   // the ticker switches from the orbs to the rays + confetti (24 a second) for as long as it is open
    var first = $(opts.focus, el) || el.querySelector("[data-autofocus]") || tabbables(el)[0] || el;
    if (focusOn && dpad && first !== el) setFocus(first); else focusEl(first);
    emit("win", { open: true, el: el });
    return el;
  }
  function closeWinEl(target) {
    var el = $(target) || openWin();
    if (!el || !el.classList.contains("is-open")) return false;
    var dpad = !!marked || isTV();
    el.classList.remove("is-open");
    if (!openWin()) root.removeAttribute("data-win");
    fxRefresh();
    var back = winOpener;
    winOpener = null;
    if (back && back.parentNode && back !== d.body && isVisible(back)) { if (focusOn && dpad) setFocus(back); else focusEl(back); }
    emit("win", { open: false, el: el });
    return true;
  }
  var winApi = { open: openWinEl, close: closeWinEl, isOpen: function () { return !!openWin(); } };

  /* ---------------- celebrate: one-shot canvas burst of gold confetti + a gold ray bloom ---------------- */
  var fx = null;
  /* mostly champagne golds, a few jewels (the game's accent + seat colours) */
  function luxeColours(from) {
    var cs = w.getComputedStyle(from && from.nodeType === 1 ? from : root), acc = (cs.getPropertyValue("--accent") || "").trim();
    var out = ["#f9ebc6", "#e9cd93", "#c99f5e", "#fff6dc", "#d5af6d", "#f4e3b8", "#e7ca90", "#b68b4b"];
    [acc || "#e7ca90", "#ff5d73", "#5f95ff", "#3fd391", "#b383ff"].forEach(function (c) { out.push(c); });
    return out;
  }
  function celebrate(opts) {
    opts = opts || {};
    if (fx) fx.stop();
    if (reducedMotion() || d.hidden || !d.body) return resolved(false);
    var win = opts.into ? $(opts.into) : d.querySelector(".bg-win.is-open");
    var cv = d.createElement("canvas");
    var ctx = cv.getContext && cv.getContext("2d");
    if (!ctx) return resolved(false);
    var W = w.innerWidth || root.clientWidth, H = w.innerHeight || root.clientHeight;
    var scale = opts.hd ? Math.min(2, w.devicePixelRatio || 1) : 1;   // 1x backing store: confetti does not need retina, CPU does
    cv.width = Math.round(W * scale); cv.height = Math.round(H * scale);
    cv.className = "bg-celebrate"; cv.setAttribute("aria-hidden", "true");
    if (win) win.insertBefore(cv, win.querySelector(".bg-win__card")); else d.body.appendChild(cv);
    ctx.scale(scale, scale);
    var cols = opts.colors || luxeColours(win || opts.origin);
    var lite = fxLevel === "reduced";   // "Reduce effects": half the pieces, a shorter burst
    var N = opts.count || clamp(Math.round(W * H / (lite ? 14000 : 7000)), lite ? 30 : 50, lite ? 80 : 150);
    var ms = opts.ms || (lite ? 2000 : 2800), rays = opts.rays !== false && opts.confetti !== "only";
    var ox = W / 2, oy = H * 0.42, o = opts.origin;
    if (o && o.nodeType === 1) { var r = o.getBoundingClientRect(); ox = r.left + r.width / 2; oy = r.top + r.height / 2; }
    else if (o && typeof o.x === "number") { ox = o.x; oy = o.y; }
    if (win && win.querySelector(".bg-win__rays") && opts.rays === undefined) rays = false;   // the overlay already blooms its own rays
    var bits = [];
    for (var i = 0; i < (opts.confetti === false ? 0 : N); i++) {
      bits.push({ x: Math.random() * W, y: -20 - Math.random() * H * 0.6, vx: (Math.random() - 0.5) * 80, vy: 120 + Math.random() * 170,
        w: 6 + Math.random() * 5, h: 9 + Math.random() * 7, a: Math.random() * 6.28, va: 4 + Math.random() * 8, c: cols[i % cols.length], g: i % 5 === 0 });
    }
    var t0 = now(), last = t0, id = 0, done = false, res = null;
    var p = promise(function (r2) { res = r2; });
    function finish() {
      if (done) return; done = true;
      caf(id); d.removeEventListener("visibilitychange", onHide);
      if (cv.parentNode) cv.parentNode.removeChild(cv);
      if (fx && fx.canvas === cv) fx = null;
      if (res) res(true);
    }
    function onHide() { if (d.hidden) finish(); }
    d.addEventListener("visibilitychange", onHide);
    function frame() {
      if (done) return;
      var t = now(), el = t - t0, dt = Math.min(0.05, (t - last) / 1000); last = t;
      if (el >= ms || !cv.parentNode) { finish(); return; }
      ctx.clearRect(0, 0, W, H);
      if (rays) {
        var pr = Math.min(1, el / 900), ease = 1 - Math.pow(1 - pr, 3);
        var alpha = (el < 900 ? pr : Math.max(0, 1 - (el - 900) / (ms - 1200))) * 0.32;
        if (alpha > 0.01) {
          var R = (0.3 + 0.7 * ease) * Math.max(W, H) * 0.7, rot = -0.3 + 0.3 * ease;
          var grd = ctx.createRadialGradient(ox, oy, 0, ox, oy, R);   // gold light that fades out along each ray
          grd.addColorStop(0, "rgba(255,240,205," + Math.min(1, alpha * 2.2).toFixed(3) + ")");
          grd.addColorStop(0.45, "rgba(236,210,155," + alpha.toFixed(3) + ")");
          grd.addColorStop(1, "rgba(231,202,144,0)");
          ctx.fillStyle = grd;
          ctx.beginPath();
          for (var k = 0; k < 20; k++) {
            var a0 = rot + k * Math.PI / 10, a1 = a0 + 0.13;
            ctx.moveTo(ox, oy); ctx.lineTo(ox + Math.cos(a0) * R, oy + Math.sin(a0) * R); ctx.lineTo(ox + Math.cos(a1) * R, oy + Math.sin(a1) * R);
          }
          ctx.fill();
        }
      }
      var fade = el > ms - 500 ? Math.max(0, (ms - el) / 500) : 1;
      ctx.globalAlpha = fade;
      for (var j = 0; j < bits.length; j++) {
        var b = bits[j];
        b.vy += 240 * dt; b.x += b.vx * dt; b.y += b.vy * dt; b.a += b.va * dt;
        if (b.y > H + 20) continue;
        var fh = Math.abs(Math.cos(b.a)) * b.h + 1;       // the "flip" without a rotate transform
        ctx.fillStyle = b.c;
        if (b.g) { ctx.beginPath(); ctx.moveTo(b.x + b.w / 2, b.y); ctx.lineTo(b.x + b.w, b.y + fh / 2); ctx.lineTo(b.x + b.w / 2, b.y + fh); ctx.lineTo(b.x, b.y + fh / 2); ctx.fill(); }   // gold diamonds
        else ctx.fillRect(b.x, b.y, b.w, fh);
      }
      ctx.globalAlpha = 1;
      id = raf(frame);
    }
    id = raf(frame);
    fx = { canvas: cv, stop: finish, done: p };
    if (opts.haptic !== false) haptic("success");
    return p;
  }

  /* ---------------- FLIP + number tween ---------------- */
  function flip(target, from, opts) {
    var el = $(target);
    if (!el || !from) return resolved(false);
    opts = opts || {};
    if (from.nodeType === 1) from = from.getBoundingClientRect();
    var to = el.getBoundingClientRect();
    var fl = from.left !== undefined ? from.left : from.x, ft = from.top !== undefined ? from.top : from.y;
    if (typeof fl !== "number" || typeof ft !== "number") return resolved(false);
    var dx = fl - to.left, dy = ft - to.top;
    var sx = from.width && to.width && opts.scale !== false ? from.width / to.width : 1;
    var sy = from.height && to.height && opts.scale !== false ? from.height / to.height : 1;
    if (reducedMotion() || (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5 && Math.abs(sx - 1) < 0.01 && Math.abs(sy - 1) < 0.01)) return resolved(false);
    var ms = opts.ms || 520, easing = opts.easing || (opts.spring ? "cubic-bezier(.34,1.56,.64,1)" : "cubic-bezier(.22,.9,.24,1)");
    var start = "translate(" + dx + "px," + dy + "px) scale(" + sx + "," + sy + ")";
    if (el.animate) {
      var a = el.animate([{ transformOrigin: "0 0", transform: start }, { transformOrigin: "0 0", transform: "none" }], { duration: ms, easing: easing });
      return promise(function (res) { a.onfinish = function () { res(true); }; a.oncancel = function () { res(false); }; });
    }
    return promise(function (res) {
      var s = el.style;
      s.transition = "none"; s.transformOrigin = "0 0"; s.transform = start;
      void el.offsetWidth;
      s.transition = "transform " + ms + "ms " + easing; s.transform = "";
      setTimeout(function () { s.transition = ""; s.transformOrigin = ""; res(true); }, ms + 40);
    });
  }
  var tweens = typeof WeakMap === "function" ? new WeakMap() : null;
  function tweenNumber(target, from, to, ms, opts) {
    var el = $(target);
    if (!el) return resolved(false);
    if (ms && typeof ms === "object") { opts = ms; ms = opts.ms; }
    opts = opts || {};
    from = +from || 0; to = +to || 0; ms = (ms === undefined || ms === null) ? 600 : +ms;
    var fmt = typeof opts.format === "function" ? opts.format : function (v) { return String(Math.round(v)); };
    var prev = tweens && tweens.get(el);
    if (prev) { caf(prev.id); prev.res(false); tweens["delete"](el); }
    if (reducedMotion() || ms <= 0 || from === to) { el.textContent = fmt(to); return resolved(true); }
    return promise(function (res) {
      var t0 = now(), rec = { id: 0, res: res };
      function step() {
        var p = Math.min(1, (now() - t0) / ms), e = 1 - Math.pow(1 - p, 3);
        el.textContent = fmt(from + (to - from) * e);
        if (p < 1) rec.id = raf(step);
        else { if (tweens) tweens["delete"](el); res(true); }
      }
      if (tweens) tweens.set(el, rec);
      rec.id = raf(step);
    });
  }

  /* ---------------- countdown ring ---------------- */
  var timers = typeof WeakMap === "function" ? new WeakMap() : null;
  function countdown(target, seconds, opts) {
    var el = $(target);
    opts = opts || {};
    var dummy = { stop: function () { }, pause: function () { }, resume: function () { }, remaining: function () { return 0; }, done: resolved(false), el: null };
    seconds = +seconds;
    if (!el || !(seconds > 0)) return dummy;
    var old = timers && timers.get(el);
    if (old) old.stop();
    var C = 2 * Math.PI * 20, total = seconds * 1000, low = opts.low === undefined ? 5 : opts.low;
    el.classList.add("bg-countdown"); el.classList.remove("is-low", "is-done");
    el.setAttribute("role", "timer");
    el.innerHTML = "<svg viewBox=\"0 0 48 48\" aria-hidden=\"true\" focusable=\"false\"><circle class=\"bg-countdown__track\" cx=\"24\" cy=\"24\" r=\"20\"/>" +
      "<circle class=\"bg-countdown__arc\" cx=\"24\" cy=\"24\" r=\"20\" stroke-dasharray=\"" + C.toFixed(2) + "\" stroke-dashoffset=\"0\"/></svg><b class=\"bg-countdown__num\">" + Math.ceil(seconds) + "</b>";
    var arc = el.querySelector(".bg-countdown__arc"), num = el.querySelector(".bg-countdown__num");
    var endAt = Date.now() + total, left = total, iv = 0, shown = -1, stopped = false, res = null;
    var done = promise(function (r) { res = r; });
    function tick() {
      left = Math.max(0, endAt - Date.now());
      var s = Math.ceil(left / 1000);
      arc.setAttribute("stroke-dashoffset", (C * (1 - left / total)).toFixed(2));
      if (s !== shown) {
        shown = s; num.textContent = String(s);
        el.setAttribute("aria-label", s + (s === 1 ? " second" : " seconds") + " left");
        el.classList.toggle("is-low", s > 0 && s <= low);
        if (typeof opts.onTick === "function") { try { opts.onTick(s); } catch (e) { } }
      }
      if (left <= 0) finish(true);
    }
    function finish(ok) {
      if (stopped) return; stopped = true;
      clearInterval(iv);
      if (timers) timers["delete"](el);
      if (ok) { el.classList.add("is-done"); el.classList.remove("is-low"); if (typeof opts.onDone === "function") { try { opts.onDone(); } catch (e) { } } }
      if (res) res(!!ok);
    }
    var ctl = {
      el: el, done: done,
      stop: function () { finish(false); },
      pause: function () { if (stopped || !iv) return; tick(); clearInterval(iv); iv = 0; },
      resume: function () { if (stopped || iv) return; endAt = Date.now() + left; iv = setInterval(tick, opts.step || 250); },
      remaining: function () { return stopped ? 0 : Math.ceil((iv ? Math.max(0, endAt - Date.now()) : left) / 1000); }
    };
    if (timers) timers.set(el, ctl);
    tick();
    iv = setInterval(tick, opts.step || 250);
    return ctl;
  }

  /* ---------------- ambient: ONE scheduler for rare one-shot beats ---------------- */
  var amb = { every: 12000, items: [], queue: [], active: null, timer: 0, idx: 0, last: 0, paused: false };
  function ambRunnable() { return !d.hidden && !reducedMotion() && !amb.paused; }
  /* still in the document: a page that rebuilds a strip or a board (innerHTML) detaches the old elements, and a beat on one of
     them would play unseen while the next beat waits behind it */
  function connected(el) { return !!el && (el.isConnected !== undefined ? el.isConnected : root.contains(el)); }
  /* the running beat ends at once (its class off, its promise false) WITHOUT starting the next one: the caller does that */
  function ambDrop() {
    var b = amb.active;
    if (!b) return;
    clearTimeout(b.t); amb.active = null;
    if (b.el) b.el.classList.remove(b.cls);
    if (b.done) b.done(false);
  }
  function ambBegin(b) {
    if (!connected(b.el)) { if (b.done) b.done(false); return false; }
    b.el.classList.remove(b.cls);
    void b.el.offsetWidth;
    b.el.classList.add(b.cls);
    amb.active = b;
    b.t = setTimeout(function () { ambEnd(true); }, b.ms);
    return true;
  }
  function ambEnd(ok) {
    var b = amb.active;
    if (!b) return;
    clearTimeout(b.t);
    if (b.el) b.el.classList.remove(b.cls);
    amb.active = null;
    if (b.done) b.done(ok);
    ambTick();
  }
  function ambTick() {
    clearTimeout(amb.timer); amb.timer = 0;
    if (amb.active || !ambRunnable()) return;           // resumes on visibilitychange / motion change / resume()
    while (amb.queue.length) { if (ambBegin(amb.queue.shift())) return; }
    amb.items = amb.items.filter(function (it) { return connected(it.el); });
    if (!amb.items.length) return;                      // nothing registered: no timer at all
    var due = amb.last + amb.every * (fxLevel === "reduced" ? 2 : 1) - now();   // "Reduce effects": beats half as often
    if (due > 20) { amb.timer = setTimeout(ambTick, due); return; }
    var it = amb.items[amb.idx++ % amb.items.length];
    amb.last = now();
    ambBegin({ el: it.el, cls: it.cls, ms: it.ms });
  }
  function ambientRefresh() {
    fxRefresh();   // the continuous-effects ticker follows the same signals (hidden, reduced motion, effects level)
    if (!ambRunnable()) {
      clearTimeout(amb.timer); amb.timer = 0;
      amb.queue.splice(0).forEach(function (b) { if (b.done) b.done(false); });
      ambEnd(false);
      return;
    }
    if (!amb.active && !amb.timer) { amb.last = Math.max(amb.last, now() - amb.every + 1500); ambTick(); }
  }
  d.addEventListener("visibilitychange", ambientRefresh);
  var ambient = {
    add: function (target, opts) {
      var el = $(target);
      if (!el) return function () { };
      opts = opts || {};
      ambient.remove(el);
      amb.items.push({ el: el, cls: opts.cls || "is-glint", ms: opts.ms || 1700 });
      if (amb.items.length === 1) amb.last = now() - amb.every + (opts.delay === undefined ? 1200 : opts.delay);
      if (!amb.active) ambTick();
      return function () { ambient.remove(el); };
    },
    remove: function (target) {
      var el = $(target);
      if (!el) return;
      amb.items = amb.items.filter(function (it) { return it.el !== el; });
      if (amb.active && amb.active.el === el) ambEnd(false);
    },
    trigger: function (target, opts) {
      var el = $(target);
      opts = opts || {};
      if (!el || !ambRunnable()) return resolved(false);
      return promise(function (res) {
        if (amb.active && !connected(amb.active.el)) ambDrop();   // a beat on an element that left the page never holds up a new one
        amb.queue = amb.queue.filter(function (b) { if (b.el === el && b.cls === (opts.cls || "is-beat")) { if (b.done) b.done(false); return false; } return true; });
        amb.queue.push({ el: el, cls: opts.cls || "is-beat", ms: opts.ms || 1600, done: res });
        if (!amb.active) ambTick();
      });
    },
    pause: function () { amb.paused = true; ambientRefresh(); },
    resume: function () { amb.paused = false; ambientRefresh(); },
    state: function () { return { running: ambRunnable(), active: amb.active ? amb.active.cls : null, queued: amb.queue.length, items: amb.items.length, timer: !!amb.timer, every: amb.every }; }
  };
  Object.defineProperty(ambient, "every", { get: function () { return amb.every; }, set: function (v) { amb.every = Math.max(2000, +v || 12000); if (!amb.active) ambTick(); } });

  /* ---------------- hero: two stacked layers crossfade by opacity (TV hub poster, lobby) ---------------- */
  var heroGen = typeof WeakMap === "function" ? new WeakMap() : null;
  function heroLayers(el) {
    var ls = $$(":scope > .bg-hero__layer", el);
    if (!ls.length) ls = $$(".bg-hero__layer", el);
    while (ls.length < 2) {
      var l = d.createElement("div");
      l.className = "bg-hero__layer" + (ls.length ? "" : " is-on"); l.setAttribute("aria-hidden", "true");
      el.insertBefore(l, el.firstChild); ls = $$(".bg-hero__layer", el);
    }
    return ls;
  }
  function heroShow(target, opts) {
    var el = $(target);
    if (!el) return resolved(false);
    opts = opts || {};
    var ls = heroLayers(el), cur = ls[0].classList.contains("is-on") ? ls[0] : ls[1], next = cur === ls[0] ? ls[1] : ls[0];
    var gen = ((heroGen && heroGen.get(el)) || 0) + 1;
    if (heroGen) heroGen.set(el, gen);
    function swap() {
      if (heroGen && heroGen.get(el) !== gen) return false;     // a newer show() (fast D-pad) won: drop this one
      if (el._bgFade) el._bgFade.stop();                        // a fade still running settles to its nearer end first
      var ls2 = heroLayers(el), cur = ls2[0].classList.contains("is-on") ? ls2[0] : ls2[1], next = cur === ls2[0] ? ls2[1] : ls2[0];
      if (opts.game) next.setAttribute("data-game", opts.game); else next.removeAttribute("data-game");
      next.style.backgroundImage = opts.src ? "url(\"" + String(opts.src).replace(/"/g, "%22") + "\")" : "";
      if (opts.game) el.setAttribute("data-game", opts.game);
      /* the incoming (opaque) backdrop fades in ON TOP of the old one, which stays fully on underneath: a true crossfade
         with one blended layer per step instead of two, stepped at RATE.beat */
      next.style.opacity = "0";
      next.classList.add("is-in");
      next.classList.add("is-on");
      var run = stepper(reducedMotion() ? 0 : cssMs(el, "--dur-hero", 420), function (k) { next.style.opacity = easeOut(k).toFixed(3); }, function (ok) {
        if (el._bgFade === run) el._bgFade = null;
        if (ok || (parseFloat(next.style.opacity) || 0) >= 0.5) cur.classList.remove("is-on"); else next.classList.remove("is-on");
        next.classList.remove("is-in");
        next.style.opacity = "";
      });
      if (!run.over()) el._bgFade = run;
      return true;
    }
    if (!opts.src || !w.Image) return resolved(swap());
    return promise(function (res) {
      var im = new w.Image(), done = false;
      function go() { if (!done) { done = true; res(swap()); } }
      im.onload = go; im.onerror = go; im.src = opts.src;
      if (im.decode) im.decode().then(go, go);
    });
  }
  var hero = { show: heroShow, layers: heroLayers };

  function setTurn(target, opts) {
    var el = $(target);
    if (!el) return false;
    opts = opts || {};
    var strip = (el.closest && el.closest(".bg-players")) || el.parentNode;
    if (strip) $$(".bg-player.is-turn, .bg-player.is-pulse", strip).forEach(function (p) { if (p !== el) { p.classList.remove("is-turn"); p.classList.remove("is-pulse"); } });
    /* a turn pulse belongs to its turn: the previous player's pulse on this strip (running, or still queued) ends here, so the
       new turn's pulse starts at once instead of waiting 4.9 s behind it (fast turns used to build a queue of stale pulses).
       So does a pulse on a chip that is no longer in the page: a page that rebuilt its strip (a new game, a load) left it on a
       detached chip, where it played unseen while the new strip's first pulse queued behind it (step 4 Rummy review) */
    var ended = false;
    if (strip && strip.contains) {
      var stale = function (b) { return !!b && b.cls === "is-pulse" && b.el !== el && (strip.contains(b.el) || !connected(b.el)); };
      amb.queue = amb.queue.filter(function (b) { if (stale(b)) { if (b.done) b.done(false); return false; } return true; });
      if (stale(amb.active)) { ambDrop(); ended = true; }
    }
    el.classList.add("is-turn");
    if (strip && strip.classList && strip.classList.contains("bg-players--scroll")) {   // scroll the strip only (scrollIntoView would also scroll the page)
      var sr = strip.getBoundingClientRect(), er = el.getBoundingClientRect();
      if (er.left < sr.left) strip.scrollLeft -= sr.left - er.left + 8; else if (er.right > sr.right) strip.scrollLeft += er.right - sr.right + 8;
    }
    var pulsing = !!amb.active && amb.active.el === el && amb.active.cls === "is-pulse";   // already pulsing for this player: let it run
    if (opts.pulse !== false && !pulsing) ambient.trigger(el, { cls: "is-pulse", ms: 3 * 1600 + 120 });   // starts now unless another beat (a glint) is running
    if (ended && !amb.active) ambTick();   // no new pulse wanted: the scheduler carries on with whatever is next
    if (opts.haptic) haptic("turn");
    return true;
  }

  /* ---------------- game stage: BGUI.stage(game, opts) = "this page is game X" ----------------
     One call gives a game page (or the Party pages) its Luxe identity, and calling it again switches game at runtime:
     - html[data-game] = game (opts.theme === false leaves the page theme alone; the ambient layer is themed either way);
     - the ambient layer .bg-ambient (first child of <body>, fixed, behind everything):
       - three light orbs: the house gold, the game's accent (a static gradient in --accent-glow) and violet;
       - soft light beams (the house gold, the game's accent and violet) that sweep slowly across the
         stage. On a game page the board and its panels cover most of the screen; the beams light whatever the page leaves
         visible (step 4 review: the motifs alone left a game page almost still, against the old animated skin). Beside a
         framed board that leaves a wide free column (TV) they sweep that column only, and fade in there again;
       - gold-line game motifs (dome, deed, cards, flag ... and the logomark) that rise slowly, sway and turn. A motif keeps
         out of the columns a framed board covers (TV: beside the board; a phone has no free column, so nothing changes there):
         a motif the board hides moves to a free column and lights up again there, and each new climb starts in one.
       Each piece is its own promoted layer, moved by the ONE effects ticker (transform only): motifs and beams 8 times a second
       (1-1.8 px a step), the orbs 4. "Reduce effects", reduced motion and a hidden page stop the ticker and everything rests
       where it is (the pieces stay spread over the page);
     - the logomark glint on every .bg-emblem on the page (through BGUI.ambient);
     - .bg-frame (gold hairline + soft static shadow, no filter) on the elements matched by opts.frames.
     opts.beams: false = no beams, or how many. opts.halo: Trouble's halo (on by default there; a selector rings another board,
     false = none): 32 gold rays, a beaded bezel and four seat jewels on one pre-rendered layer centred on the board, turned 2
     degrees a second by the ticker. opts.back: false = no TV Back default. Skins.apply(game) in skins.js calls this on every page
     that loads ui.js (old pages keep the old skins). BGUI.stage.beam = {deg, remS, gap}: the beams' tilt, sweep speed (rem a
     second) and how long each waits off screen between sweeps (as a share of the width it sweeps). BGUI.stage.hush = {on, sel}:
     the motifs fade out over text that sits on the stage (sel: the TV hint bar and [data-stage-text]). */
  var STAGE_GAMES = ["trouble", "sorry", "monopoly", "rummy500", "risk", "uno", "scatter", "party"];
  var MOTIF = {
    trouble: ["dome", "dice", "pawn", "star"], sorry: ["slide", "pawn", "cards", "star"], monopoly: ["deed", "home", "dice", "star"],
    rummy500: ["cards", "crown", "star", "cards"], risk: ["flag", "crown", "star", "pawn"], uno: ["cards", "swap", "star", "cards"],
    scatter: ["letter", "pencil", "hourglass", "star"], party: ["tv", "dice", "cards", "music"]
  };
  /* the boards a motif keeps clear of: .bg-frame, [data-stage-solid] and the board elements skins.js frames on the game pages */
  var STAGE_SOLID = ".bg-frame, [data-stage-solid], #boardWrap, #rkframe, #rtable, .mboard";
  var BEAM = { deg: -20, remS: 0.6, gap: 0 };   // tilt; about 10 px a second on a phone, 14 on a 1080p TV; no wait off screen: the three keep coming
  /* text that sits right on the stage (no card behind it): a motif fades out while it passes over it, as it does behind a card,
     so a gold line never crosses a line of text. BGUI.stage.hush = {on, sel} */
  var HUSH = { on: true, sel: ".bg-hintbar, [data-stage-text]" };
  /* the halo: a slow-turning ring of gold light rays round a game's round board (Trouble: the Luxe heir of the old skin's turning
     rainbow ring). opts.halo: a selector, true (the game's board below) or false */
  var HALO = { trouble: "#boardWrap" };
  var HALO_TURN = { degS: 2 };   // one turn in 3 minutes: 0.25 degrees a tick at the stage's 8 Hz (1-2.5 px at the rays' tips). BGUI.stage.halo
  function seedOf(s) { var h = 7; for (var i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 233280; return h; }
  /* the motifs of a game: spread over the width, golden-ratio spaced in height, far ones smaller, fainter and slower */
  function motifHTML(game) {
    var names = MOTIF[game] || MOTIF.party, n = isTV() ? 16 : 12, r = seedOf(game) + 101, html = "";
    function rnd() { r = (r * 9301 + 49297) % 233280; return r / 233280; }
    for (var i = 0; i < n; i++) {
      var far = i % 3 === 2, logo = i % 6 === 4, accent = !logo && i % 3 === 1;
      var size = far ? 2.1 + rnd() * 0.9 : 3.4 + rnd() * 2;                            // rem
      var x = (((i * 5) % n) + rnd() * 0.8) / n * 94 + 1;                               // % of the width
      var y0 = (i * 0.618 + rnd() * 0.15) % 1;                                          // where in its climb it starts
      var v = far ? 0.0059 + rnd() * 0.0017 : 0.0078 + rnd() * 0.0028;                 // screens a second (about 100-170 s a climb)
      var amp = (far ? 0.3 : 0.55) + rnd() * 0.6, wv = 0.2 + rnd() * 0.25, ph = rnd() * 6.283;   // sway: rem, rad/s, phase
      var r0 = (rnd() - 0.5) * 50, spin = (rnd() < 0.5 ? -1 : 1) * (2 + rnd() * 6);    // degrees, degrees a second
      var op = logo ? 0.26 : far ? 0.11 + rnd() * 0.04 : 0.17 + rnd() * 0.08;
      var art = logo ? mark() : (icon(names[i % names.length]) || mark());
      html += "<b" + (accent ? " class=\"is-accent\"" : logo ? " class=\"is-logo\"" : "") + " data-m=\"" + [y0, v, amp, wv, ph, r0, spin].map(function (f) { return +f.toFixed(4); }).join(",") +
        "\" style=\"left:" + x.toFixed(1) + "%;width:" + size.toFixed(2) + "rem;height:" + size.toFixed(2) + "rem;opacity:" + op.toFixed(2) + "\">" + art + "</b>";
    }
    return html;
  }
  function beamHTML(n) {
    var cls = ["", "is-accent", "is-violet"], h = "";
    for (var i = 0; i < n; i++) h += "<i" + (cls[i % 3] ? " class=\"" + cls[i % 3] + "\"" : "") + "></i>";
    return h;
  }
  /* the halo art, drawn once as inline SVG (gradients only: no filter, mask or <text>), in units of the halo's radius (100). k = the
     halo's diameter over the board's, so the board's edge is at 100 / k: 32 tapered gold rays (long and short in turn) rise from
     under the board's edge and fade out, with a beaded gold bezel just outside the board and four jewels in the seat colours */
  function haloSVG(k) {
    var u = "bghl" + (++uidN), rb = 100 / Math.max(1.05, k), r0 = rb * 0.94, rs = r0 + (100 - r0) * 0.62, rz = rb * 1.06, rays = "", gems = "";
    function pt(r, a) { return f1(r * Math.cos(a)) + " " + f1(r * Math.sin(a)); }
    for (var i = 0; i < 32; i++) {
      var a = (i / 32) * 2 * Math.PI, lg = i % 2 === 0, hw = (lg ? 2.5 : 1.9) * Math.PI / 180, r1 = lg ? 100 : rs;
      rays += "M" + pt(r0, a - hw) + "L" + pt(r1, a) + "L" + pt(r0, a + hw) + "Z";
    }
    for (var j = 0; j < 4; j++) {
      var g = (j / 4 + 0.125) * 2 * Math.PI, c = [f1(rz * Math.cos(g)), f1(rz * Math.sin(g))], s = 2.2;
      gems += "<path d=\"M" + c[0] + " " + f1(c[1] - s) + "L" + f1(c[0] + s) + " " + c[1] + "L" + c[0] + " " + f1(c[1] + s) + "L" + f1(c[0] - s) + " " + c[1] + "Z\" style=\"fill:var(--seat-" + (j + 1) + ")\"/>";
    }
    return "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"-100 -100 200 200\" aria-hidden=\"true\" focusable=\"false\"><defs>" +
      "<radialGradient id=\"" + u + "\" cx=\"0\" cy=\"0\" r=\"100\" gradientUnits=\"userSpaceOnUse\"><stop offset=\"" + f1(r0) / 100 + "\" stop-color=\"#fff3d6\" stop-opacity=\".95\"/>" +
      "<stop offset=\"" + f1((r0 + 100) / 2) / 100 + "\" stop-color=\"#e9cd93\" stop-opacity=\".42\"/><stop offset=\"1\" stop-color=\"#e2c48a\" stop-opacity=\"0\"/></radialGradient></defs>" +
      "<path d=\"" + rays + "\" fill=\"url(#" + u + ")\"/>" +
      "<circle r=\"" + f1(rz) + "\" fill=\"none\" stroke=\"#f3dfae\" stroke-opacity=\".75\" stroke-width=\"1\" stroke-linecap=\"round\" stroke-dasharray=\"0 3.4\"/>" + gems + "</svg>";
  }
  function motifBits() {
    var el = stg.el; if (!el) return null;
    var rem = parseFloat(w.getComputedStyle(root).fontSize) || 16, pad = 0, a = Math.abs(BEAM.deg) * Math.PI / 180;
    stg.H = el.clientHeight || w.innerHeight || 800;
    stg.W = el.clientWidth || w.innerWidth || 400;
    stg.bits = $$(".bg-motifs > b", el).map(function (b) {
      var f = (b.getAttribute("data-m") || "").split(",").map(Number);
      pad = Math.max(pad, b.offsetHeight || 48);
      if (b._bgX0 === undefined) b._bgX0 = b.style.left;   // its spread-out column: where it climbs when no board is in the way
      return { el: b, y0: f[0] || 0, v: f[1] || 0.008, amp: (f[2] || 0) * rem, wv: f[3] || 0.3, ph: f[4] || 0, r0: f[5] || 0, spin: f[6] || 0, k: null, size: b.offsetWidth || 48 };
    });
    stg.pad = pad + 8;
    /* a beam's tilted footprint is fp px wide: it sweeps in from fully off the left edge of its range (the stage, or the free
       column beside a board) to fully off the right one (then waits off screen for BEAM.gap of that width); the beams are evenly
       phased, so their shafts never overlap */
    var beams = $$(".bg-beams > i", el);
    stg.beams = beams.map(function (b, i) {
      var bw = b.offsetWidth || 7 * rem, bh = b.offsetHeight || stg.H;
      return { el: b, w: bw, fp: bw * Math.cos(a) + bh * Math.sin(a), ph: i / beams.length, v: (+BEAM.remS || 0.5) * rem };
    });
    stg.chk = -9; stg.cols = ""; stg.beamCol = null;
    return stg.bits;
  }
  /* the stretches of the stage width that no framed board covers (a board taller than 40 % of the screen, plus a 24 px margin);
     null when nothing is in the way or when the free stretches are too narrow to matter (a phone: the board is the width) */
  function freeCols() {
    var W = stg.W || w.innerWidth || 0, H = stg.H || w.innerHeight || 0, free = [[0, W]], cut = false, room = 0;
    $$(STAGE_SOLID).forEach(function (f) {
      if (!isVisible(f)) return;
      var r = f.getBoundingClientRect();
      if (r.height < H * 0.4 || r.bottom <= 0 || r.top >= H || r.right <= 0 || r.left >= W) return;
      var a = r.left - 24, b = r.right + 24, next = [];
      cut = true;
      free.forEach(function (c) { if (b <= c[0] || a >= c[1]) next.push(c); else { if (a > c[0]) next.push([c[0], a]); if (b < c[1]) next.push([b, c[1]]); } });
      free = next;
    });
    free.forEach(function (c) { room += c[1] - c[0]; });
    return cut && room >= W * 0.18 ? free : null;
  }
  /* a motif's column: a free one beside the board (any spot that fits it), or its own spread-out column when nothing is in the way */
  function motifPlace(p, cols, again) {
    var W = stg.W || 1, left = null;
    if (cols) {
      var fit = cols.filter(function (c) { return c[1] - c[0] >= p.size; }), tot = 0;
      fit.forEach(function (c) { tot += c[1] - c[0] - p.size; });
      var x = Math.random() * tot;
      for (var i = 0; i < fit.length && left === null; i++) { var len = fit[i][1] - fit[i][0] - p.size; if (x <= len || i === fit.length - 1) left = fit[i][0] + Math.min(x, len); else x -= len; }
    }
    var v = left === null ? (p.el._bgX0 || p.el.style.left) : (left / W * 100).toFixed(1) + "%";
    if (p.el.style.left === v) return;
    p.el.style.left = v;
    if (again) relight(p.el);   // it fades in again there (a one-shot animation)
  }
  function relight(el) { var on = el.classList.contains("is-relit"); el.classList.toggle("is-relit", !on); el.classList.toggle("is-relit2", on); }
  /* text that sits right on the stage (HUSH.sel), as boxes [left, top, right, bottom] with a small margin; read every 1.5 s */
  function hushTexts() {
    if (!HUSH.on) return [];
    var m = 6, out = [];
    $$(HUSH.sel).forEach(function (t) {
      if (!isVisible(t)) return;
      var r = t.getBoundingClientRect();
      if (r.width < 1 || r.height < 1 || r.bottom <= 0 || r.top >= (stg.H || w.innerHeight)) return;
      out.push([r.left - m, r.top - m, r.right + m, r.bottom + m]);
    });
    return out;
  }
  /* the halo follows its board: centred on it, sized from it (theme.css --bg-halo-k: the halo's diameter over the board's) and
     hidden while the board is hidden (the setup page). The ticker turns it; scrolling, a resize or the board showing up place it
     at once, so it stays with the board while the ticker is still ("Reduce effects", reduced motion) */
  function haloBoard() { return stg.haloSel ? $(stg.haloSel) : null; }
  function haloArt() {
    var h = stg.halo;
    if (!h) return;
    var k = parseFloat(w.getComputedStyle(h).getPropertyValue("--bg-halo-k")) || 1.6;
    stg.haloK = k;
    if (h.getAttribute("data-k") !== String(k)) { h.setAttribute("data-k", String(k)); h.innerHTML = haloSVG(k); stg.haloD = 0; }
  }
  function haloPlace() {
    var h = stg.halo;
    if (!h || !h.parentNode) return;
    var b = haloBoard(), r = b && isVisible(b) ? b.getBoundingClientRect() : null;
    if (!r || r.width < 48 || r.height < 48) { if (stg.haloOn) { stg.haloOn = false; h.style.visibility = "hidden"; } return; }
    if (!stg.haloK) haloArt();
    var D = Math.round(Math.max(r.width, r.height) * stg.haloK);
    if (D !== stg.haloD) { stg.haloD = D; h.style.width = D + "px"; h.style.height = D + "px"; }
    h.style.transform = "translate3d(" + (r.left + r.width / 2 - D / 2).toFixed(1) + "px," + (r.top + r.height / 2 - D / 2).toFixed(1) + "px,0) rotate(" + (stg.haloA % 360).toFixed(2) + "deg)";
    if (!stg.haloOn) { stg.haloOn = true; h.style.visibility = ""; relight(h); }   // the board just showed up: the halo lights up round it
  }
  function haloWatch() {
    if (!stg.haloLn) {
      stg.haloLn = true;
      var again = function () { if (stg.halo) { stg.haloK = 0; haloArt(); haloPlace(); } };
      w.addEventListener("scroll", function () { if (stg.halo) haloPlace(); }, { passive: true });
      w.addEventListener("resize", again);
      d.addEventListener("bgui:tv", again);
    }
    var b = haloBoard();
    if (w.ResizeObserver && b && stg.haloObs !== b) {   // the board shows, hides or changes size: place the halo at once
      if (!stg.haloRO) stg.haloRO = new w.ResizeObserver(function () { if (stg.halo) haloPlace(); });
      if (stg.haloObs) stg.haloRO.unobserve(stg.haloObs);
      stg.haloRO.observe(b); stg.haloObs = b;
    }
  }
  /* every 1.5 s of stage time: when a board appears, moves or goes, the motifs it hides take a free column (and light up there),
     and the beams sweep the widest free column when it is at least a quarter of the stage (else the whole stage) */
  function stageSteer(s) {
    if (s - stg.chk < 1.5) return stg.steer || null;
    stg.chk = s;
    stg.texts = hushTexts();
    var cols = freeCols(), key = cols ? cols.map(function (c) { return Math.round(c[0]) + "-" + Math.round(c[1]); }).join() : "";
    stg.steer = cols;
    if (key !== stg.cols) {
      stg.cols = key;
      if (cols) (stg.bits || []).forEach(function (p) {
        var cx = (parseFloat(p.el.style.left) || 0) / 100 * stg.W + p.size / 2;
        if (!cols.some(function (c) { return cx >= c[0] && cx <= c[1]; })) motifPlace(p, cols, true);
      });
      var wide = null;
      (cols || []).forEach(function (c) { if (c[1] - c[0] >= stg.W * 0.25 && (!wide || c[1] - c[0] > wide[1] - wide[0])) wide = c; });
      if ((wide ? wide.join() : "") !== (stg.beamCol ? stg.beamCol.join() : "")) {
        stg.beamCol = wide;
        (stg.beams || []).forEach(function (q) { relight(q.el); });   // they move to the new range: they fade in again there
      }
    }
    return cols;
  }
  /* each motif climbs from below the bottom edge to above the top edge (the wrap happens off screen), swaying and turning;
     each beam sweeps left to right at a steady pace */
  function motifPose(dt) {
    var bits = stg.bits || motifBits();
    if (!bits) return;
    var s = (stg.t += dt), span = stg.H + 2 * stg.pad, cols = dt > 0 ? stageSteer(s) : null, texts = HUSH.on ? (stg.texts || []) : [];
    for (var i = 0; i < bits.length; i++) {
      var p = bits[i], c = p.y0 + s * p.v, k = Math.floor(c), y = (1 - (c - k)) * span - stg.pad, dx = Math.sin(s * p.wv + p.ph) * p.amp;
      if (p.k !== null && k !== p.k && dt > 0) motifPlace(p, cols, false);   // it just wrapped below the bottom edge: the next climb takes a free column
      p.k = k;
      p.el.style.transform = "translate3d(" + dx.toFixed(1) + "px," + y.toFixed(1) + "px,0) rotate(" + ((p.r0 + s * p.spin) % 360).toFixed(1) + "deg)";
      /* over text that sits on the stage it fades out (a one-shot opacity transition), as it would behind a card: its box is
         widened to cover it turned (up to 21 % a side) and the fade's lead, so it is gone before a gold line reaches the text */
      var lx = (parseFloat(p.el.style.left) || 0) / 100 * stg.W + dx, e = p.size * 0.21 + 6, hit = false;
      for (var t = 0; t < texts.length && !hit; t++) { var q = texts[t]; hit = lx - e < q[2] && lx + p.size + e > q[0] && y - e < q[3] && y + p.size + e > q[1]; }
      if (hit !== !!p.hush) { p.hush = hit; p.el.classList.toggle("is-hush", hit); }
    }
    if (stg.halo) { stg.haloA += dt * (+HALO_TURN.degS || 0); haloPlace(); }
    var bs = stg.beams || [], L = stg.beamCol ? stg.beamCol[0] : 0, wid = stg.beamCol ? stg.beamCol[1] - stg.beamCol[0] : stg.W, gap = Math.max(0, +BEAM.gap || 0) * wid;
    for (var j = 0; j < bs.length; j++) {
      var q = bs[j], span = wid + q.fp + gap, cx = L + ((q.ph + s * q.v / span) % 1) * span - q.fp / 2;
      q.el.style.transform = "translate3d(" + (cx - q.w / 2).toFixed(1) + "px,0,0) rotate(" + BEAM.deg + "deg)";
    }
  }
  function stage(game, opts) {
    opts = opts || {};
    if (!game) return null;
    game = STAGE_GAMES.indexOf(game) >= 0 ? game : "party";
    if (!d.body) { d.addEventListener("DOMContentLoaded", function () { stage(game, opts); }); return null; }
    if (opts.theme !== false) root.setAttribute("data-game", game);
    var el = stg.el && stg.el.parentNode ? stg.el : d.querySelector(".bg-ambient"), built = false;
    if (!el) { el = d.createElement("div"); el.className = "bg-ambient"; el.setAttribute("aria-hidden", "true"); d.body.insertBefore(el, d.body.firstChild); }
    stg.el = el; stg.game = game;
    el.setAttribute("data-game", game);
    /* the orbs: kept across game switches (the accent orb re-tints with data-game); skipped when the page has its own .bg-orbs */
    var orbs = el.querySelector(".bg-orbs"), pageOrbs = d.body.querySelector(":scope > .bg-orbs");
    if (opts.orbs === false || pageOrbs) { if (orbs) orbs.parentNode.removeChild(orbs); }
    else if (!orbs) el.insertAdjacentHTML("afterbegin", "<div class=\"bg-orbs bg-orbs--stage\"><i></i><i class=\"is-accent\"></i><i></i></div>");
    /* the light beams, over the orbs and under the motifs: kept across game switches (the accent beam re-tints) */
    var bm = el.querySelector(".bg-beams"), nb = opts.beams === false ? 0 : typeof opts.beams === "number" ? clamp(Math.round(opts.beams), 0, 6) : 3;
    if (!nb) { if (bm) { bm.parentNode.removeChild(bm); built = true; } }
    else if (!bm || bm.children.length !== nb) {
      if (bm) bm.parentNode.removeChild(bm);
      bm = d.createElement("div"); bm.className = "bg-beams"; bm.innerHTML = beamHTML(nb);
      el.insertBefore(bm, el.querySelector(".bg-motifs"));
      built = true;
    }
    /* the motifs: rebuilt for a new game (they light up again) */
    var mot = el.querySelector(".bg-motifs");
    if (opts.motifs === false) { if (mot) { mot.parentNode.removeChild(mot); built = true; } }
    else if (!mot || mot.getAttribute("data-game") !== game) {
      if (mot) mot.parentNode.removeChild(mot);
      el.insertAdjacentHTML("beforeend", "<div class=\"bg-motifs\" data-game=\"" + game + "\">" + motifHTML(game) + "</div>");
      built = true;
    }
    /* the halo round a round board (opts.halo, else the game's own: Trouble), between the beams and the motifs */
    var hsel = opts.halo === false ? null : typeof opts.halo === "string" ? opts.halo : (HALO[game] || (opts.halo === true ? ".bg-frame--round, #boardWrap" : null));
    var hl = el.querySelector(".bg-halo");
    if (!hsel) {
      if (hl) hl.parentNode.removeChild(hl);
      stg.halo = null; stg.haloSel = null; stg.haloOn = false;
      if (stg.haloRO && stg.haloObs) { stg.haloRO.unobserve(stg.haloObs); stg.haloObs = null; }
    }
    else {
      if (!hl) { hl = d.createElement("div"); hl.className = "bg-halo"; hl.innerHTML = "<i></i>"; el.insertBefore(hl, el.querySelector(".bg-motifs")); }
      if (stg.halo !== hl.firstChild) { stg.halo = hl.firstChild; stg.haloOn = false; stg.haloA = stg.haloA || 0; stg.halo.style.visibility = "hidden"; }
      stg.haloSel = hsel; stg.haloK = 0;
      haloWatch(); haloArt(); haloPlace();
    }
    if (built) { stg.bits = null; stg.texts = hushTexts(); motifPose(0); }   // the still pose: spread over the page (what "Reduce effects" and reduced motion show)
    if (opts.frames) $$(opts.frames).forEach(function (f) { f.classList.add("bg-frame"); });
    $$(".bg-emblem").forEach(function (e) { if (!e._bgGlint && !e._bgMounted) { e._bgGlint = true; mount.emblem(e); } });
    if (opts.back !== false && game !== "party") backInstall();   // the TV Back default (BGUI.back) for the seven game pages
    fxRefresh();
    emit("stage", { game: game, el: el });
    return { el: el, game: game };
  }
  stage.current = function () { return stg.el && stg.el.parentNode ? stg.game : null; };
  stage.clear = function () {
    if (stg.el && stg.el.parentNode) stg.el.parentNode.removeChild(stg.el);
    stg.el = null; stg.game = null; stg.bits = null; stg.beams = null; stg.steer = null; stg.cols = ""; stg.beamCol = null; stg.texts = null;
    stg.halo = null; stg.haloSel = null; stg.haloOn = false;
    if (stg.haloRO && stg.haloObs) { stg.haloRO.unobserve(stg.haloObs); stg.haloObs = null; }
    fxRefresh();
    emit("stage", { game: null, el: null });
    return true;
  };
  stage.beam = BEAM;
  stage.hush = HUSH;
  stage.halo = HALO_TURN;

  /* ---------------- TV Back: ONE default for every adopted game page (BGUI.back) ----------------
     The Fire TV app calls window.__tvBack() when the remote's Back is pressed (MainActivity.onBackPressed) and CLOSES THE APP when
     the page has none; a TV browser turns Back into history.back(), and some also send a Back key. Each Back takes ONE step:
       1. the top layer closes: the sound panel, else the top sheet (BGUI.sheet; one opened with dismissible: false is not closed,
          and the step ends there: "held"), else the Victory screen (BGUI.win);
       2. else the page takes its own step: hooks added with BGUI.back.on(fn), newest first. A hook returns the name of the step
          it took ("menu", "resume") or false to pass it on (board -> Menu -> game);
       3. else the page leaves for the hub: BGUI.back.hub() = "../index.html", keeping ?tv=1.
     BGUI.stage(game) installs it on the seven game pages (Skins.apply calls BGUI.stage), unless opts.back === false; any page can
     call BGUI.back.install({hub}). A page that defines its own window.__tvBack keeps it (the Party TV host), and the hub never gets
     it (it calls no BGUI.stage(game)), so Back there still exits the app. Pages without ui.js are untouched.
     TV browsers (html[data-tv] only): BGUI.back.arm(), called by the page once a game is on (Start, Continue, Load: inside the tap,
     so the browser keeps the entry), keeps one guard entry in the history. Back then lands on the page: popstate takes the same
     step and puts the guard back. A Back key that nothing on top took (sheets, the sound panel and a page's own win handler take
     theirs) takes the step too, and a Back key followed by history.back() from the same press (within 0.7 s) counts once. Phones
     get no guard entry: their Back works as before. */
  var bk = { on: false, fn: null, hooks: [], armed: false, keyAt: 0, hub: null };
  function backOwn() { return bk.on && w.__tvBack === bk.fn; }   // still ours: a page that sets its own later keeps it
  function backHub() {
    if (bk.hub) return bk.hub;
    var tv = false;
    try { tv = /[?&]tv=1(&|$)/.test(w.location.search); } catch (e) { }
    return "../index.html" + (tv ? "?tv=1" : "");
  }
  function backStep(src) {
    var S = w.Sound;
    if (fpS) { fpSkip(); return "first"; }   // the who-goes-first show: Back skips it (a second Back closes it)
    if (S && typeof S.panelOpen === "function" && S.panelOpen()) { try { S.closePanel(); } catch (e) { } return "panel"; }
    if (stack.length) {
      var top = stack[stack.length - 1];
      if (top.opts.dismissible === false) return "held";   // a sheet that must be answered (pass the phone): Back waits for it
      closeSheet(top.el, "back");
      return "sheet";
    }
    if (openWin()) { closeWinEl(); return "win"; }
    for (var i = bk.hooks.length - 1; i >= 0; i--) {
      var r = false;
      try { r = bk.hooks[i](src || "app"); } catch (err) { setTimeout(function () { throw err; }); }
      if (r) return typeof r === "string" ? r : "page";
    }
    try { w.location.href = backHub(); } catch (e2) { }
    return "hub";
  }
  function backGuard() {
    if (!backOwn() || !bk.armed || !isTV()) return false;
    try { if (!(w.history.state && w.history.state.bgBack)) w.history.pushState({ bgBack: 1 }, ""); return true; } catch (e) { return false; }
  }
  function backInstall(opts) {
    opts = opts || {};
    if (opts.hub) bk.hub = String(opts.hub);
    if (bk.on) return backOwn();
    if (typeof w.__tvBack === "function") return false;     // the page has its own Back (the Party TV host): it keeps it
    bk.on = true;
    bk.fn = function () { return backStep("app"); };
    w.__tvBack = bk.fn;
    try { if (w.history.state && w.history.state.bgBack) w.history.replaceState(null, ""); } catch (e) { }   // reloaded on a guard entry: arm() pushes a fresh one
    w.addEventListener("keydown", function (e) { if (isBackKey(e)) bk.keyAt = now(); }, true);
    d.addEventListener("keydown", function (e) {
      if (!backOwn() || !bk.armed || !isTV() || e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey || !isBackKey(e)) return;
      e.preventDefault();
      backStep("key");
    });
    w.addEventListener("popstate", function () {
      if (!backOwn() || !bk.armed || !isTV()) return;      // not armed yet (no game on): Back leaves the page, as it always did
      if (now() - bk.keyAt < 700) { backGuard(); return; }  // the same press also came as a Back key, which already took the step
      if (backStep("history") !== "hub") backGuard();
    });
    if (bk.armed) backGuard();
    return true;
  }
  var back = {
    install: backInstall,
    installed: backOwn,
    on: function (fn) {
      if (typeof fn !== "function") return function () { };
      bk.hooks.push(fn);
      return function () { bk.hooks = bk.hooks.filter(function (f) { return f !== fn; }); };
    },
    arm: function () { bk.armed = true; return backGuard(); },
    step: function (src) { return backStep(src || "app"); },
    hub: backHub
  };
  Object.defineProperty(back, "armed", { get: function () { return bk.armed; } });

  /* ---------------- focus: D-pad spatial navigation ---------------- */
  var focusOn = false, focusByTV = false, focusRoot = null, marked = null;
  var editing = null;   // the text field being typed in (entered with OK or by typing): only then do left/right stay in it
  var ZONE = ".bg-topbar, [data-focus-zone]";   // the top bar is its own zone: reached from the page only when nothing in the page lies above
  function zoneOf(el) { return (el && el.closest && el.closest(ZONE)) || null; }
  /* px of the viewport top hidden by a sticky/fixed .bg-topbar */
  function barCover() {
    var h = 0;
    $$(".bg-topbar").forEach(function (el) {
      if (!isVisible(el)) return;
      var p = w.getComputedStyle(el).position;
      if (p !== "sticky" && p !== "fixed") return;
      var r = el.getBoundingClientRect();
      if (r.top <= 1 && r.bottom > h) h = r.bottom;
    });
    return h;
  }
  /* scroll a page control into view below the sticky top bar (scroll-padding via --bg-bar-h, then a manual check). What is
     revealed is the element that carries the ring (ringOf): a switch's whole row, not just its knob, so the row's ring (and its
     scroll-margin room) is never cut by the bar, the screen edge or a sheet's edge (step 4 Monopoly review: 132 px rule rows
     lost 16-17 px of their ring when only the 30 px switch was scrolled into view) */
  function reveal(el) {
    if (zoneOf(el)) return;   // the bar itself never scrolls
    var box = ringOf(el), inPage = !(el.closest && el.closest(".bg-sheet, .bg-win")), cover = inPage ? barCover() : 0;
    if (inPage) root.style.setProperty("--bg-bar-h", Math.round(cover) + "px");
    try { box.scrollIntoView({ block: "nearest", inline: "nearest" }); } catch (e) { try { box.scrollIntoView(false); } catch (e2) { } }
    if (cover) {
      var r = box.getBoundingClientRect(), want = cover + (parseFloat(w.getComputedStyle(box).scrollMarginTop) || 0);
      if (r.top < want - 1) { try { w.scrollBy(0, r.top - want); } catch (e3) { } }
    }
  }
  function usable(el) {
    if (el.disabled || el.getAttribute("aria-disabled") === "true" || el.getAttribute("data-focus") === "off") return false;
    if (el.getAttribute("tabindex") === "-1" && !el.hasAttribute("data-focus")) return false;
    if (el.closest && el.closest("[hidden], [inert], [aria-hidden='true'], .bg-sheet:not(.is-open), .bg-win:not(.is-open)")) return false;
    var r = el.getBoundingClientRect();
    if (r.width < 1 && r.height < 1) return false;
    return isVisible(el);
  }
  function focusScope() { return sheetTop() || d.querySelector(".bg-win.is-open") || focusRoot || d; }
  function candidates(scope) { return $$(FOCUSABLE, scope || focusScope()).filter(usable); }
  function ringOf(el) { return (el.classList && el.classList.contains("bg-toggle") && el.closest(".bg-row")) || el; }
  function unmark() { if (marked) { marked.classList.remove("is-focus"); marked = null; } }
  function setFocus(target) {
    var el = $(target);
    if (!el) return false;
    unmark();
    focusEl(el);
    marked = ringOf(el);
    marked.classList.add("is-focus");
    reveal(el);
    return d.activeElement === el;
  }
  function firstIn(scope) {
    scope = scope || focusScope();
    var pref = scope.querySelector ? scope.querySelector("[data-focus-first]") : null;
    if (pref && usable(pref)) return pref;
    var list = candidates(scope), vh = w.innerHeight || root.clientHeight, cover = barCover(), i, r;
    if (!list.length) return null;
    list.sort(function (a, b) { var ra = a.getBoundingClientRect(), rb = b.getBoundingClientRect(); return (Math.round(ra.top / 8) - Math.round(rb.top / 8)) || (ra.left - rb.left); });
    for (i = 0; i < list.length; i++) { r = list[i].getBoundingClientRect(); if (!zoneOf(list[i]) && r.top >= cover - 1 && r.top < vh) return list[i]; }   // page first, not the bar
    for (i = 0; i < list.length; i++) { r = list[i].getBoundingClientRect(); if (r.bottom > 0 && r.top < vh) return list[i]; }
    return list[0];
  }
  function move(dir) {
    var scope = focusScope(), list = candidates(scope), cur = d.activeElement;
    if (!list.length) return false;
    if (!cur || cur === d.body || list.indexOf(cur) < 0) return setFocus(firstIn(scope));
    var a = cur.getBoundingClientRect(), z = zoneOf(cur), same = [], other = [];
    list.forEach(function (el) { if (el !== cur) (zoneOf(el) === z ? same : other).push(el); });
    var best = pick(a, same, dir);
    if (!best && other.length && (dir === "up" || dir === "down")) {   // leave the zone (page <-> top bar) only when nothing is left this way
      var clear = other;
      if (z) {
        var zr = z.getBoundingClientRect();
        clear = other.filter(function (el) { var r = el.getBoundingClientRect(); return dir === "down" ? r.top >= zr.bottom - 1 : r.bottom <= zr.top + 1; });
        if (!clear.length) clear = other;
      }
      else if (dir === "down") clear = other.filter(function (el) { return !(el.closest && el.closest(".bg-topbar")); });   // from the page, Down never lands in the top bar
      best = clear.length ? pick(a, clear, dir) : null;
    }
    if (best) return setFocus(best);
    if (!z && dir === "down" && !sheetTop() && !openWin()) return pageEnd(ringOf(cur).getBoundingClientRect());   // the ring's element (a switch's row) stays clear of the bar
    return false;
  }
  /* Down with nothing below in the page: scroll on (there may be text to read) but only as far as the focused control stays
     fully clear of the sticky top bar; the key is consumed either way, so the page never scrolls natively and the ring
     never slides under the bar */
  function pageEnd(a) {
    var vh = w.innerHeight || root.clientHeight, se = d.scrollingElement || root;
    var room = Math.floor(a.top - barCover() - 24);                       // keep the ring and its glow below the bar
    var left = se.scrollHeight - vh - (w.pageYOffset || se.scrollTop || 0);
    var step = Math.min(room, left, Math.round(vh * 0.6));
    if (step > 0) { try { w.scrollBy(0, step); } catch (e) { } }
    return true;
  }
  function pick(a, list, dir) {
    var acx = a.left + a.width / 2, acy = a.top + a.height / 2, best = null, bestScore = Infinity;
    list.forEach(function (el) {
      var b = el.getBoundingClientRect(), bcx = b.left + b.width / 2, bcy = b.top + b.height / 2, main, cross, off;
      if (dir === "right" || dir === "left") {
        if (dir === "right" ? !(bcx > acx + 1 && b.right > a.right - 1) : !(bcx < acx - 1 && b.left < a.left + 1)) return;
        main = dir === "right" ? Math.max(0, b.left - a.right) : Math.max(0, a.left - b.right);
        cross = Math.max(0, Math.max(a.top, b.top) - Math.min(a.bottom, b.bottom));
        off = Math.abs(bcy - acy);
      } else {
        if (dir === "down" ? !(bcy > acy + 1 && b.bottom > a.bottom - 1) : !(bcy < acy - 1 && b.top < a.top + 1)) return;
        main = dir === "down" ? Math.max(0, b.top - a.bottom) : Math.max(0, a.top - b.bottom);
        cross = Math.max(0, Math.max(a.left, b.left) - Math.min(a.right, b.right));
        off = Math.abs(bcx - acx);
      }
      var score = (cross === 0 ? 0 : 100000) + main + cross * 2 + off * 0.1;   // same row/column (in the beam) always wins
      if (score < bestScore) { bestScore = score; best = el; }
    });
    return best;
  }
  function dirOf(e) {
    var k = e.key, c = e.keyCode;
    if (k === "ArrowLeft" || k === "Left" || c === 37) return "left";
    if (k === "ArrowRight" || k === "Right" || c === 39) return "right";
    if (k === "ArrowUp" || k === "Up" || c === 38) return "up";
    if (k === "ArrowDown" || k === "Down" || c === 40) return "down";
    return null;
  }
  /* a remote has no Tab key, so the D-pad must always be able to leave a control:
     SELECT never keeps arrows (OK opens its picker); a text field keeps left/right only while typing (after OK or a keystroke);
     radios and sliders keep left/right, up/down move on */
  function keepsArrows(t, dir) {
    if (!t || !t.tagName) return false;
    var h = dir === "left" || dir === "right";
    if (t.tagName === "SELECT") return false;
    if (isTextField(t)) return h && editing === t;
    if (t.tagName === "INPUT" && /^(range|radio)$/i.test(t.type)) return h;
    return false;
  }
  function onFocusKey(e) {
    if (!focusOn || e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey) return;
    var dir = dirOf(e), t = e.target;
    if (dir) {
      if (keepsArrows(t, dir)) return;
      if (editing === t) editing = null;
      var moved = move(dir);
      if (moved || (t && (t.tagName === "SELECT" || (t.tagName === "INPUT" && /^(range|radio)$/i.test(t.type))))) e.preventDefault();   // an arrow never changes a value by accident
      return;
    }
    var k = e.key, c = e.keyCode;
    if (k === "Enter" || k === "Select" || c === 13 || c === 23) {
      var el = d.activeElement;
      if (!el || el === d.body || el === root) return;
      var tag = el.tagName, enter = k === "Enter" || c === 13;
      if (isTextField(el)) { editing = editing === el ? null : el; if (enter) return; }   // OK starts typing (the TV keyboard opens), OK again ends it
      if (tag === "SELECT" && typeof el.showPicker === "function") { try { el.showPicker(); e.preventDefault(); return; } catch (err) { } }
      var native = enter && (tag === "BUTTON" || tag === "A" || tag === "SUMMARY" || tag === "SELECT" ||
        (tag === "INPUT" && /^(submit|button|reset|image)$/i.test(el.type)));
      if (native) return;
      e.preventDefault();
      try { el.click(); } catch (err) { }
    }
  }
  d.addEventListener("keydown", onFocusKey, false);
  d.addEventListener("pointerdown", function () { unmark(); }, true);
  d.addEventListener("focusin", function (e) {
    if (editing && e.target !== editing) editing = null;
    if (marked && e.target && ringOf(e.target) !== marked) unmark();   // focus moved by tap/Tab: drop the D-pad mark
  }, true);
  d.addEventListener("input", function (e) { if (focusOn && isTextField(e.target)) editing = e.target; }, true);   // typing = editing
  var focus = {
    enable: function (opts) { opts = opts || {}; focusOn = true; if (opts.root !== undefined) focusRoot = $(opts.root); if (opts.autofocus) setFocus(firstIn()); return true; },
    disable: function () { focusOn = false; focusByTV = false; unmark(); return false; },
    move: function (dir) { return move(dir); },
    set: setFocus,
    first: function (scope) { return setFocus(firstIn($(scope) || undefined)); },
    candidates: function (scope) { return candidates($(scope) || undefined); },
    current: function () { return d.activeElement && d.activeElement !== d.body ? d.activeElement : null; },
    get enabled() { return focusOn; }
  };

  /* ---------------- dice ---------------- */
  var PIPS = { 1: [[50, 50]], 2: [[29, 29], [71, 71]], 3: [[27, 27], [50, 50], [73, 73]], 4: [[29, 29], [71, 29], [29, 71], [71, 71]],
    5: [[27, 27], [73, 27], [50, 50], [27, 73], [73, 73]], 6: [[29, 25], [71, 25], [29, 50], [71, 50], [29, 75], [71, 75]] };
  function dieSVG(n, opts) {
    n = clamp(Math.round(+n) || 1, 1, 6);
    var r = (opts && opts.pip) || 9, s = "<svg viewBox=\"0 0 100 100\" aria-hidden=\"true\" focusable=\"false\">";
    PIPS[n].forEach(function (p) { s += "<circle cx=\"" + p[0] + "\" cy=\"" + p[1] + "\" r=\"" + r + "\" fill=\"currentColor\"/>"; });
    return s + "</svg>";
  }
  function dieRender(target, n) {
    var el = $(target);
    if (!el) return null;
    n = clamp(Math.round(+n) || 1, 1, 6);
    el.classList.add("bg-die");
    el.innerHTML = dieSVG(n);
    el.setAttribute("data-value", String(n));
    el.setAttribute("role", "img");
    el.setAttribute("aria-label", "Die showing " + n);
    return el;
  }
  function dieRoll(target, final, opts) {
    var el = $(target);
    opts = opts || {};
    final = clamp(Math.round(+final) || (1 + Math.floor(Math.random() * 6)), 1, 6);
    if (!el) return resolved(final);
    if (el._bgRoll) { clearInterval(el._bgRoll.iv); clearTimeout(el._bgRoll.t); el._bgRoll.res(false); }
    if (reducedMotion()) { dieRender(el, final); return resolved(final); }
    var ms = opts.ms || 640, flips = opts.flips || 6, i = 0, cur = +el.getAttribute("data-value") || 1;
    el.classList.remove("is-rolling"); void el.offsetWidth; el.classList.add("is-rolling");
    if (opts.haptic !== false) haptic("roll");
    return promise(function (res) {
      var rec = { res: res };
      rec.iv = setInterval(function () { if (++i >= flips) { clearInterval(rec.iv); return; } var n; do { n = 1 + Math.floor(Math.random() * 6); } while (n === cur); cur = n; dieRender(el, n); }, Math.max(40, ms / (flips + 1)));
      rec.t = setTimeout(function () { clearInterval(rec.iv); el._bgRoll = null; el.classList.remove("is-rolling"); dieRender(el, final); res(final); }, ms);
      el._bgRoll = rec;
    });
  }
  var dice = { svg: dieSVG, render: dieRender, roll: dieRoll };

  /* ---------------- TV mode ---------------- */
  function isTV() { return root.hasAttribute("data-tv"); }
  function setTV(on) {
    on = on !== false;
    if (on) root.setAttribute("data-tv", ""); else root.removeAttribute("data-tv");
    if (on && !focusOn) { focus.enable(); focusByTV = true; }
    if (!on && focusByTV) focus.disable();
    toastRelayout();   // the layout changed: a showing (or held) toast is placed again
    emit("tv", { on: on });
    return on;
  }
  function tvRequested() { try { return /[?&]tv=1(&|$)/.test(w.location.search) || !!w.AndroidTV; } catch (e) { return false; } }

  /* ---------------- mount helpers ---------------- */
  function onClick(el, sel, fn) { el.addEventListener("click", function (e) { var t = e.target && e.target.closest ? e.target.closest(sel) : null; if (t && el.contains(t) && !t.disabled) fn(t, e); }); }
  var mount = {
    /* segmented picker: mount.seg(el, {options:[2,3,4] | [{value,label,sub,disabled}], value, onChange}) */
    seg: function (target, opts) {
      var el = $(target);
      if (!el) return null;
      opts = opts || {};
      el.classList.add("bg-seg");
      if (!el.getAttribute("role")) el.setAttribute("role", "group");
      if (opts.options) {
        el.innerHTML = opts.options.map(function (o) {
          if (typeof o !== "object") o = { value: o, label: o };
          return "<button type=\"button\" data-value=\"" + esc(o.value) + "\"" + (o.disabled ? " disabled" : "") + " aria-pressed=\"false\">" + esc(o.label === undefined ? o.value : o.label) + (o.sub ? "<small>" + esc(o.sub) + "</small>" : "") + "</button>";
        }).join("");
      }
      var value = null;
      function set(v, silent) {
        value = v === undefined || v === null ? null : String(v);
        $$("button", el).forEach(function (b) { var on = b.getAttribute("data-value") === value; b.setAttribute("aria-pressed", on ? "true" : "false"); b.classList.toggle("is-on", on); });
        if (!silent && typeof opts.onChange === "function") opts.onChange(value);
        return value;
      }
      onClick(el, "button", function (b) { if (b.getAttribute("data-value") !== value) { haptic("select"); set(b.getAttribute("data-value")); } });
      var pre = el.querySelector("button[aria-pressed='true'], button.is-on, button.on");
      set(opts.value !== undefined ? opts.value : pre ? pre.getAttribute("data-value") : null, true);
      return { el: el, set: set, get value() { return value; } };
    },
    /* CPU stepper: mount.stepper(el, {min:0, max:9, value:3, label:"Computer players", onChange}) */
    stepper: function (target, opts) {
      var el = $(target);
      if (!el) return null;
      opts = opts || {};
      var min = opts.min === undefined ? +(el.getAttribute("data-min") || 0) : opts.min;
      var max = opts.max === undefined ? +(el.getAttribute("data-max") || 9) : opts.max;
      var value = clamp(opts.value === undefined ? +(el.getAttribute("data-value") || min) : +opts.value, min, max);
      var label = opts.label || el.getAttribute("data-label") || "Count";
      el.classList.add("bg-stepper");
      el.setAttribute("role", "group"); el.setAttribute("aria-label", label);
      var pips = "";
      for (var i = 0; i < max; i++) pips += "<i></i>";
      el.innerHTML = "<button type=\"button\" class=\"bg-stepper__btn\" data-step=\"-1\" aria-label=\"Fewer " + esc(label.toLowerCase()) + "\">" + (icon("minus") || "&minus;") + "</button>" +
        "<output class=\"bg-stepper__val\" aria-live=\"polite\"></output>" +
        "<button type=\"button\" class=\"bg-stepper__btn\" data-step=\"1\" aria-label=\"More " + esc(label.toLowerCase()) + "\">" + (icon("plus") || "+") + "</button>" +
        (opts.pips === false ? "" : "<span class=\"bg-pips\" aria-hidden=\"true\">" + pips + "</span>");
      var out = el.querySelector("output"), btns = $$(".bg-stepper__btn", el);
      function set(v, silent) {
        value = clamp(Math.round(+v) || 0, min, max);
        out.textContent = String(value);
        btns[0].disabled = value <= min; btns[1].disabled = value >= max;
        $$(".bg-pips > i", el).forEach(function (p, k) { p.classList.toggle("is-on", k < value); });
        if (!silent && typeof opts.onChange === "function") opts.onChange(value);
        return value;
      }
      onClick(el, ".bg-stepper__btn", function (b) {
        set(value + (+b.getAttribute("data-step")));
        haptic("select");
        if (b.disabled) { var other = btns[b === btns[0] ? 1 : 0]; if (focusOn) setFocus(other); else focusEl(other); }   // never leave focus on a disabled button
      });
      set(value, true);
      return { el: el, set: set, get value() { return value; } };
    },
    /* whole-row toggle: <button class="bg-row" role="switch"> or <label class="bg-row"> with <input type=checkbox class="bg-toggle"> */
    toggle: function (target, opts) {
      var el = $(target);
      if (!el) return null;
      opts = opts || {};
      var input = el.tagName === "INPUT" ? el : el.querySelector("input.bg-toggle, input[type=checkbox]");
      function get() { return input ? input.checked : el.getAttribute("aria-checked") === "true"; }
      function set(v, silent) {
        v = !!v;
        if (input) input.checked = v; else el.setAttribute("aria-checked", v ? "true" : "false");
        if (!silent && typeof opts.onChange === "function") opts.onChange(v);
        return v;
      }
      if (input) input.addEventListener("change", function () { haptic("tap"); if (typeof opts.onChange === "function") opts.onChange(input.checked); });
      else {
        if (!el.getAttribute("role")) el.setAttribute("role", "switch");
        el.addEventListener("click", function () { haptic("tap"); set(!get()); });
      }
      if (opts.checked !== undefined) set(opts.checked, true); else if (!input && !el.hasAttribute("aria-checked")) el.setAttribute("aria-checked", "false");
      return { el: el, set: set, get checked() { return get(); } };
    },
    /* version cards: container of .bg-version[data-value] buttons, radio behaviour */
    versions: function (target, opts) {
      var el = $(target);
      if (!el) return null;
      opts = opts || {};
      el.classList.add("bg-versions");
      el.setAttribute("role", "radiogroup");
      var value = null;
      function set(v, silent) {
        value = v === undefined || v === null ? null : String(v);
        $$(".bg-version", el).forEach(function (c) { c.setAttribute("role", "radio"); c.setAttribute("aria-checked", c.getAttribute("data-value") === value ? "true" : "false"); });
        if (!silent && typeof opts.onChange === "function") opts.onChange(value);
        return value;
      }
      onClick(el, ".bg-version", function (c) { if (c.getAttribute("data-value") !== value) { haptic("select"); set(c.getAttribute("data-value")); } });
      var pre = el.querySelector(".bg-version[aria-checked='true'], .bg-version.is-on");
      set(opts.value !== undefined ? opts.value : pre ? pre.getAttribute("data-value") : null, true);
      return { el: el, set: set, get value() { return value; } };
    },
    /* player strip: mount.players(el, [{name, meta, seat, cpu, out, token}], {turn: index, scroll: bool}) -> array of chips */
    players: function (target, list, opts) {
      var el = $(target);
      if (!el || !list) return [];
      opts = opts || {};
      el.classList.add("bg-players");
      el.classList.toggle("bg-players--scroll", opts.scroll === undefined ? list.length > 4 : !!opts.scroll);
      el.innerHTML = list.map(function (p, i) {
        var seat = p.seat || (i + 1), tok = p.token === undefined ? (p.name ? String(p.name).charAt(0).toUpperCase() : "") : p.token;
        return "<li class=\"bg-player" + (p.out ? " is-out" : "") + "\" data-seat=\"" + esc(seat) + "\"><span class=\"bg-token\" aria-hidden=\"true\">" + esc(tok) + "</span>" +
          (p.cpu ? "<span class=\"bg-player__cpu\" title=\"Computer\">" + icon("cpu") + "</span>" : "") +
          "<span class=\"bg-player__txt\"><span class=\"bg-player__name\">" + esc(p.name) + "</span><span class=\"bg-player__meta\">" + esc(p.meta || "") + "</span></span></li>";
      }).join("");
      var chips = $$(".bg-player", el);
      if (opts.turn !== undefined && chips[opts.turn]) setTurn(chips[opts.turn], { pulse: opts.pulse });
      return chips;
    },
    /* logomark with its glint: fills an empty .bg-emblem with the diamond die and registers it with the ambient scheduler */
    emblem: function (target, opts) {
      var el = $(target);
      if (!el) return null;
      if (!el.firstElementChild) el.innerHTML = mark();
      ambient.add(el, opts);
      return { el: el };
    },
    /* light orbs: <div class="bg-orbs"><i></i><i></i></div> as the first child of the container (default body) */
    orbs: function (target, opts) {
      var host = $(target) || d.body;
      if (!host) return null;
      var el = host.querySelector(":scope > .bg-orbs") || (stg.el && stg.el.parentNode ? stg.el.querySelector(".bg-orbs") : null);   // the game stage already has orbs: never two sets
      if (!el) {
        el = d.createElement("div"); el.className = "bg-orbs"; el.setAttribute("aria-hidden", "true");
        el.innerHTML = new Array(((opts && opts.count) || 2) + 1).join("<i></i>");
        host.insertBefore(el, host.firstChild);
        fxRefresh();
      }
      return { el: el };
    },
    /* the "Reduce effects" switch row, bound to BGUI.effects (default off = full effects; saved per device in "bgui.effects").
       mount.effectsRow(container) appends a <button class="bg-row" role="switch">; given a .bg-row it wires that row instead.
       It follows changes made anywhere else (the sound panel, another tab). opts: {title, desc, id} */
    effectsRow: function (target, opts) {
      var host = $(target);
      if (!host) return null;
      opts = opts || {};
      var row = host.classList.contains("bg-row") ? host : null;
      if (!row) {
        row = d.createElement("button"); row.type = "button"; row.className = "bg-row";
        row.innerHTML = "<span class=\"bg-row__main\"><span class=\"bg-row__title\">" + esc(opts.title || "Reduce effects") + "</span><span class=\"bg-row__desc\">" +
          esc(opts.desc || "Calmer background motion for slower devices. Saved on this device.") + "</span></span><span class=\"bg-toggle\"></span>";
        host.appendChild(row);
      }
      if (opts.id) row.id = opts.id;
      row.setAttribute("role", "switch");
      function sync() { row.setAttribute("aria-checked", fxLevel === "reduced" ? "true" : "false"); }
      if (!row._bgFx) {
        row._bgFx = true;
        row.addEventListener("click", function () { haptic("tap"); effects.set(fxLevel === "reduced" ? "full" : "reduced"); sync(); });
        d.addEventListener("bgui:effects", sync);
      }
      sync();
      return { el: row, sync: sync, get checked() { return fxLevel === "reduced"; } };
    },
    /* declarative wiring: data-bg-mount="seg|stepper|toggle|versions|emblem|effectsRow" (runs once on DOMContentLoaded) */
    auto: function (scope) {
      var n = 0;
      $$("[data-bg-mount]", $(scope) || d).forEach(function (el) {
        if (el._bgMounted) return;
        var kind = el.getAttribute("data-bg-mount");
        if (typeof mount[kind] === "function" && kind !== "auto" && kind !== "players") { el._bgMounted = mount[kind](el) || true; n++; }
      });
      return n;
    }
  };

  /* ---------------- player names (step 10; BG_audit/SHARED-UX.md) ----------------
     ONE device-wide name for the first human ("bg_player_name", every game) and the hot-seat names 2..n ("bg_player_names",
     an array indexed by seat, slot 0 unused). Cleaned: no control characters or < >, single spaces, at most 16 characters.
     names.mount(host, {count, seat(i), token(i, value), label(i, count), extra(i, row), onChange(values)}) draws the fields;
     names.list(humans, raw) gives the names a game uses (raw = the fields; an empty field = "You" for a lone human, "Player n" in
     hot-seat; a duplicate gets its seat number); names.cpu(n, humanNames) draws the computers' names from names.js, never one of the
     humans' (nor "You"). */
  var NAME_KEY = "bg_player_name", NAMES_KEY = "bg_player_names", NAME_MAX = 16;
  function nmClean(v) { return String(v == null ? "" : v).replace(/[\u0000-\u001f\u007f<>]/g, "").replace(/\s+/g, " ").trim().slice(0, NAME_MAX).trim(); }
  function nmArr() { try { var a = JSON.parse(w.localStorage.getItem(NAMES_KEY) || "[]"); return Array.isArray(a) ? a : []; } catch (e) { return []; } }
  function nmGet(i) {
    i = +i || 0;
    try { return i === 0 ? nmClean(w.localStorage.getItem(NAME_KEY)) : nmClean(nmArr()[i]); } catch (e) { return ""; }
  }
  function nmSet(i, v) {
    i = +i || 0; v = nmClean(v);
    try {
      if (i === 0) { if (v) w.localStorage.setItem(NAME_KEY, v); else w.localStorage.removeItem(NAME_KEY); }
      else { var a = nmArr(); a[0] = null; a[i] = v || null; w.localStorage.setItem(NAMES_KEY, JSON.stringify(a)); }
    } catch (e) { }
    return v;
  }
  function nmDefault(i, humans) { return (humans || 1) <= 1 && !i ? "You" : "Player " + ((+i || 0) + 1); }
  function nmList(humans, raw) {
    var out = [], seen = {};
    for (var i = 0; i < humans; i++) {
      var v = raw ? nmClean(raw[i]) : nmGet(i);
      if (!v) v = nmDefault(i, humans);
      var k = v.toLowerCase();
      if (seen[k]) { v = nmClean(v.slice(0, NAME_MAX - 3)) + " " + (i + 1); k = v.toLowerCase(); }
      seen[k] = 1; out.push(v);
    }
    return out;
  }
  function nmCpu(n, humanNames) {
    var ex = (humanNames || []).concat(["You"]), a = [];
    try { if (w.Names && w.Names.pick && n > 0) a = w.Names.pick(n, ex) || []; } catch (e) { a = []; }
    for (var i = a.length; i < n; i++) a.push("CPU " + (i + 1));
    return a.slice(0, n);
  }
  function nmInitial(v) { v = nmClean(v); return v ? v.charAt(0).toUpperCase() : "?"; }
  var nmSeq = 0;
  function nmMount(target, opts) {
    var host = $(target); opts = opts || {};
    if (!host) return null;
    var box = d.createElement("div"); box.className = "bg-names"; host.appendChild(box);
    var count = 0, rows = [];
    function label(i) { return opts.label ? opts.label(i, count) : (i === 0 ? (count > 1 ? "Player 1 name" : "Your name") : "Player " + (i + 1) + " name"); }
    function values() { return rows.slice(0, count).map(function (r) { return r.inp.value; }); }
    function changed() { if (opts.onChange) { try { opts.onChange(values()); } catch (e) { setTimeout(function () { throw e; }); } } }
    function row(i) {
      var r = d.createElement("div"), id = "bgName" + (++nmSeq);
      r.className = "bg-name";
      r.innerHTML = "<span class=\"bg-token bg-name__tok\" aria-hidden=\"true\"></span><span class=\"bg-name__body\"><label class=\"bg-name__lab\" for=\"" + id + "\"></label>" +
        "<input class=\"bg-input\" id=\"" + id + "\" type=\"text\" maxlength=\"" + NAME_MAX + "\" autocomplete=\"off\" autocapitalize=\"words\" spellcheck=\"false\" enterkeyhint=\"done\" data-name-index=\"" + i + "\"></span>";
      var rec = { el: r, inp: r.querySelector("input"), tok: r.querySelector(".bg-name__tok"), lab: r.querySelector("label") };
      rec.inp.value = nmGet(i);
      rec.inp.addEventListener("input", function () { nmSet(i, rec.inp.value); paint(i); changed(); });
      rec.inp.addEventListener("change", function () { var v = nmClean(rec.inp.value); if (v !== rec.inp.value) rec.inp.value = v; nmSet(i, v); paint(i); changed(); });
      rec.inp.addEventListener("keydown", function (e) { if ((e.key === "Enter" || e.keyCode === 13) && editing === rec.inp) { e.preventDefault(); editing = null; } else if ((e.key === "Enter" || e.keyCode === 13) && !focusOn) { try { rec.inp.blur(); } catch (x) { } } });   // OK while typing = Done: the D-pad moves on again (the first OK is BGUI.focus: typing starts)
      if (opts.extra) { try { var x = opts.extra(i, r); if (x && x.nodeType) r.appendChild(x); else if (typeof x === "string" && x) r.insertAdjacentHTML("beforeend", x); } catch (e) { setTimeout(function () { throw e; }); } }
      return rec;
    }
    function paint(i) {
      var rec = rows[i]; if (!rec) return;
      var seat = opts.seat ? opts.seat(i) : i + 1;
      rec.el.setAttribute("data-seat", String(seat)); rec.tok.setAttribute("data-seat", String(seat));
      rec.tok.textContent = opts.token ? opts.token(i, rec.inp.value) : nmInitial(rec.inp.value || nmDefault(i, count));
      rec.lab.textContent = label(i);
      rec.inp.placeholder = nmDefault(i, count);
    }
    var api = {
      el: box,
      count: function (n) {
        count = clamp(+n || 1, 1, 12);
        while (rows.length < count) { var rec = row(rows.length); rows.push(rec); box.appendChild(rec.el); }
        rows.forEach(function (r, i) { r.el.hidden = i >= count; paint(i); });
        return api;
      },
      values: values,
      names: function () { return nmList(count, values()); },
      input: function (i) { return rows[i] ? rows[i].inp : null; },
      row: function (i) { return rows[i] ? rows[i].el : null; },
      refresh: function () { rows.forEach(function (r, i) { paint(i); }); return api; }
    };
    api.count(opts.count || 1);
    return api;
  }
  var names = { key: NAME_KEY, listKey: NAMES_KEY, max: NAME_MAX, clean: nmClean, get: nmGet, set: nmSet, fallback: nmDefault, list: nmList, cpu: nmCpu, initial: nmInitial, mount: nmMount };

  /* ---------------- hop: one visible hop per space (step 10, the CEO's step-by-step rule) ----------------
     BGUI.hop(el, {ms, lift, unit}) lifts a PLAIN wrapper and sets it down again (Web Animations, transform only, one shot). The
     game moves the piece one space per hop; under Reduce effects or reduced motion there is no lift (it still steps space by space). */
  function hop(target, opts) {
    var el = $(target); opts = opts || {};
    if (!el || reducedMotion() || fxLevel === "reduced" || d.hidden || typeof el.animate !== "function") return null;
    var lift = opts.lift == null ? 6 : opts.lift, u = opts.unit || "px";
    try {
      return el.animate([{ transform: "translateY(0)" }, { transform: "translateY(" + (-lift) + u + ")", offset: 0.45 }, { transform: "translateY(0)" }],
        { duration: Math.max(80, opts.ms || 180), easing: "ease-out" });
    } catch (e) { return null; }
  }

  /* ---------------- who goes first (step 10; BG_audit/SHARED-UX.md) ----------------
     BGUI.firstPlayer.resolve(n, draw, {rank, who, maxRounds}) runs the game's official rule: draw(i, round) gives player i's value,
     the highest rank wins and a tie draws again among the tied players only. Returns {winner, rounds:[{who, vals, top}]}.
     BGUI.firstPlayer(opts) plays the show of that result and resolves {winner, skipped} when it closes:
       mode "dice" (dice: 2, gold: true: Monopoly), "die" (Risk; pins put a die on the map), "card" (Uno: face down, then flip),
       "cut" (Rummy), "flip" (Sorry!), "spin" (Scattergories: the letter die spins and lands on a player; letter = its last face);
       players [{name, seat, token, tokenHTML (trusted markup, e.g. a Monopoly piece)}], rounds + winner (from resolve), face(v, i) -> HTML of a card face, back -> HTML of a card back,
       label(v, i) -> the line under a card, title, eyebrow, result {title, sub} (or a function of the winner), pins(i) -> {x, y}
       viewport point, onLand(i, v, round), onWinner(w), layout "center" | "peek" (the board stays in view), focus (element or
       function: the main action to focus when it closes).
     Pace: x Game speed (window.bgGameSpeed). A tap, OK/Enter/Space or Back skips to the result; a second one closes it. Reduce
     effects or reduced motion: the short version (the values at once, the spotlight without the burst). */
  var fpS = null;
  function fpFactor() { return ({ slow: 1.75, fast: 0.5 })[w.bgGameSpeed] || 1; }
  function fpShort() { return reducedMotion() || fxLevel === "reduced"; }
  function fpDice(o) { return o.mode === "dice" || o.mode === "die"; }
  function fpSfx(name) { try { if (w.Sound && typeof w.Sound.sfx === "function") w.Sound.sfx(name); } catch (e) { } }
  function fpResolve(n, draw, opts) {
    opts = opts || {};
    var list = opts.who ? opts.who.slice() : [], rounds = [], i, rank = opts.rank || function (v) { return +v || 0; };
    if (!opts.who) for (i = 0; i < n; i++) list.push(i);
    for (var r = 0; r < (opts.maxRounds || 8); r++) {
      var vals = {}, best = -Infinity, top = [];
      for (i = 0; i < list.length; i++) {
        var p = list[i], v = draw(p, r), k = rank(v, p);
        vals[p] = v;
        if (k > best) { best = k; top = [p]; } else if (k === best) top.push(p);
      }
      rounds.push({ who: list.slice(), vals: vals, top: top.slice() });
      if (top.length === 1) return { winner: top[0], rounds: rounds };
      list = top;
    }
    return { winner: list[0], rounds: rounds };
  }
  function fpLater(f, ms) { if (!fpS) return; var s = fpS; s.timers.push(setTimeout(function () { if (fpS === s) f(); }, Math.max(0, Math.round(ms)))); }
  function fpTotal(v) { return Array.isArray(v) ? v.reduce(function (a, b) { return a + b; }, 0) : v; }
  function fpLane(o, i) {
    var p = o.players[i] || {}, lane = d.createElement("div"), seat = p.seat || i + 1, slot;
    lane.className = "bg-fp__lane"; lane.setAttribute("data-seat", String(seat));
    lane.innerHTML = "<span class=\"bg-fp__spot\" aria-hidden=\"true\"></span><span class=\"bg-fp__burst\" aria-hidden=\"true\"></span>" +
      "<span class=\"bg-fp__who\"><span class=\"bg-fp__tok\"><span class=\"bg-token\" data-seat=\"" + seat + "\">" + (p.tokenHTML || esc(p.token || nmInitial(p.name))) + "</span></span>" +
      "<span class=\"bg-fp__name\">" + esc(p.name || "Player " + (i + 1)) + "</span></span><span class=\"bg-fp__slot\"></span><span class=\"bg-fp__val\" aria-hidden=\"true\"></span>";
    slot = lane.querySelector(".bg-fp__slot");
    if (fpDice(o)) {
      var n = o.mode === "dice" ? (o.dice || 2) : 1;
      for (var k = 0; k < n; k++) { var dd = d.createElement("span"); dd.className = "bg-die" + (o.gold ? " bg-die--gold" : ""); slot.appendChild(dd); dieRender(dd, 1 + ((i + k * 3) % 6)); }
    } else if (o.mode !== "spin") {
      slot.innerHTML = "<span class=\"bg-fp__card\"><span class=\"bg-fp__flip\"><span class=\"bg-fp__back\">" + (o.back || "<i></i>") + "</span><span class=\"bg-fp__face\"></span></span></span>";
    }
    return lane;
  }
  function fpSet(s, i, v, anim) {
    var lane = s.lanes[i]; if (!lane) return;
    var o = s.o, val = lane.querySelector(".bg-fp__val");
    lane.classList.add("is-in");
    if (fpDice(o)) {
      var dv = Array.isArray(v) ? v : [v], dice = lane.querySelectorAll(".bg-fp__slot .bg-die"), ms = 640 * fpFactor();
      for (var k = 0; k < dice.length; k++) { if (anim) dieRoll(dice[k], dv[k], { ms: ms, haptic: k === 0 }); else dieRender(dice[k], dv[k]); }
      var pin = s.pins[i]; if (pin) { if (anim) dieRoll(pin, dv[0], { ms: ms, haptic: false }); else dieRender(pin, dv[0]); }
      if (anim && dice.length > 1) { val.textContent = ""; setTimeout(function () { if (!s.closed) val.textContent = "= " + fpTotal(v); }, ms); }
      else val.textContent = dice.length > 1 ? "= " + fpTotal(v) : "";
    } else if (o.mode !== "spin") {
      var face = "";
      try { face = o.face ? o.face(v, i) : "<b class=\"bg-fp__num\">" + esc(v) + "</b>"; } catch (e) { face = esc(v); }
      lane.querySelector(".bg-fp__face").innerHTML = face;
      lane.classList.add("is-up");
      try { val.textContent = o.label ? o.label(v, i) : ""; } catch (e) { val.textContent = ""; }
    }
  }
  function fpJump(lane) {
    var t = lane && lane.querySelector(".bg-fp__tok"); if (!t || fpShort()) return;
    t.classList.remove("is-jump"); void t.offsetWidth; t.classList.add("is-jump");
  }
  function fpText(s, title, sub) {
    s.res.querySelector(".bg-fp__rt").textContent = title || "";
    s.res.querySelector(".bg-fp__rs").textContent = sub || "";
  }
  function fpRound(s, r) {
    var o = s.o, f = fpFactor(), R = o.rounds[r], dice = fpDice(o);
    if (!R) { fpFinal(s); return; }
    s.lanes.forEach(function (lane, i) {
      var inR = R.who.indexOf(i) >= 0;
      lane.classList.toggle("is-out", !inR);
      if (inR && r > 0) { lane.classList.remove("is-up", "is-tie"); lane.querySelector(".bg-fp__val").textContent = ""; }
    });
    fpText(s, "", "");
    var t = 0, step = (dice ? 420 : 320) * f;
    if (!dice) {   // the cards come face down first, then turn over one by one
      R.who.forEach(function (i, k) { fpLater(function () { s.lanes[i].classList.add("is-in"); fpSfx("card"); }, k * 110 * f); });
      t = R.who.length * 110 * f + 420 * f;
    } else R.who.forEach(function (i) { s.lanes[i].classList.add("is-in"); });
    R.who.forEach(function (i, k) {
      fpLater(function () {
        fpSet(s, i, R.vals[i], true);
        fpLater(function () { fpJump(s.lanes[i]); if (o.onLand) { try { o.onLand(i, R.vals[i], r); } catch (e) { } } }, (dice ? 660 : 360) * f);
      }, t + k * step);
    });
    var end = t + (R.who.length - 1) * step + (dice ? 1100 : 820) * f;
    fpLater(function () {
      if (R.top.length > 1 && o.rounds[r + 1]) {
        R.top.forEach(function (i) { s.lanes[i].classList.add("is-tie"); });
        fpText(s, dice ? "Tie! Roll again" : "Tie! Draw again", R.top.map(function (i) { return (o.players[i] || {}).name; }).join(" and ") + " tie for the top");
        fpLater(function () { fpRound(s, r + 1); }, 1300 * f);
      } else fpFinal(s);
    }, end);
  }
  function fpSpin(s) {
    var o = s.o, f = fpFactor(), n = s.lanes.length, at = Math.floor(Math.random() * n), steps = 2 * n + ((o.winner - at + 2 * n) % n), t = 0;
    var die = s.box.querySelector(".bg-fp__letter"), L = "ABCDEFGHIJKLMNOPRSTW";
    function hit(k) {
      s.lanes.forEach(function (lane, i) { lane.classList.toggle("is-lit", i === k); });
      if (die) die.textContent = L.charAt(Math.floor(Math.random() * L.length));
      var spin = s.box.querySelector(".bg-fp__die"); if (spin) { spin.classList.remove("is-spin"); void spin.offsetWidth; spin.classList.add("is-spin"); }
      fpSfx("tick");
    }
    s.lanes.forEach(function (lane) { lane.classList.add("is-in"); });
    for (var k = 0; k <= steps; k++) {
      t += (70 + 270 * Math.pow(k / Math.max(1, steps), 2.2)) * f;
      (function (k) { fpLater(function () { hit((at + k) % n); }, t); })(k);
    }
    fpLater(function () { fpFinal(s); }, t + 480 * f);
  }
  function fpFinal(s) {
    if (s.final) return;
    s.final = true;
    var o = s.o, wi = o.winner;
    s.timers.forEach(clearTimeout); s.timers = [];
    s.lanes.forEach(function (lane, i) {
      lane.classList.add("is-in"); lane.classList.remove("is-out", "is-tie", "is-lit");
      if (o.mode !== "spin") {   // every lane shows its last value
        var v; for (var r = (o.rounds || []).length - 1; r >= 0; r--) if (o.rounds[r].who.indexOf(i) >= 0) { v = o.rounds[r].vals[i]; break; }
        if (v !== undefined) fpSet(s, i, v, false);
        var hist = (o.rounds || []).filter(function (R) { return R.who.indexOf(i) >= 0; }), val = lane.querySelector(".bg-fp__val");
        if (hist.length > 1 && val) {   // a tie-break: the lane says every value it drew, so the winner never looks lower than a loser
          val.textContent = fpDice(o) ? "= " + hist.map(function (R) { return fpTotal(R.vals[i]); }).join(", then ") : "Tie-break draw";
        }
      }
      lane.classList.toggle("is-win", i === wi); lane.classList.toggle("is-dim", i !== wi);
    });
    if (o.mode === "spin") { var die = s.box.querySelector(".bg-fp__letter"); if (die) die.textContent = o.letter || nmInitial((o.players[wi] || {}).name); }
    var p = o.players[wi] || {}, res = typeof o.result === "function" ? o.result(wi) : o.result;
    res = res || {};
    s.box.setAttribute("data-seat", String(p.seat || wi + 1));
    fpText(s, res.title || (p.name || "Player " + (wi + 1)) + " goes first", res.sub || "");
    s.box.classList.add("is-final");
    if (!fpShort()) { var b = s.lanes[wi] && s.lanes[wi].querySelector(".bg-fp__burst"); if (b) { b.classList.remove("is-go"); void b.offsetWidth; b.classList.add("is-go"); } }
    fpJump(s.lanes[wi]); haptic("success"); fpSfx("win");
    if (o.onWinner) { try { o.onWinner(wi); } catch (e) { setTimeout(function () { throw e; }); } }
    var hold = s.skipped ? 1000 : (fpShort() ? 1600 : 2100) * fpFactor();
    fpLater(function () { fpClose(s); }, hold);
  }
  function fpClose(s) {
    if (!s || s.closed) return;
    s.closed = true; s.timers.forEach(clearTimeout); s.timers = [];
    if (fpS === s) fpS = null;
    root.classList.remove("bg-fp-open");
    s.box.classList.remove("is-open");
    setTimeout(function () { if (s.box.parentNode) s.box.parentNode.removeChild(s.box); }, fpShort() ? 0 : 240);
    var f = s.o.focus; try { f = typeof f === "function" ? f() : $(f); } catch (e) { f = null; }
    if (f && isVisible(f)) { if (focusOn) setFocus(f); else focusEl(f); }
    else if (s.prev && s.prev !== d.body && connected(s.prev) && isVisible(s.prev)) focusEl(s.prev);
    else { try { s.box.blur(); } catch (e) { } }
    emit("firstplayer", { open: false, winner: s.o.winner, skipped: !!s.skipped });
    if (s.res0) s.res0({ winner: s.o.winner, skipped: !!s.skipped });
  }
  function fpSkip() {
    var s = fpS; if (!s) return false;
    if (s.final) { fpClose(s); return true; }
    s.skipped = true; fpFinal(s); return true;
  }
  function firstPlayer(opts) {
    opts = opts || {};
    if (fpS) fpClose(fpS);
    var o = {}; for (var k in opts) o[k] = opts[k];
    o.players = o.players || []; o.mode = o.mode || "dice";
    if (!o.rounds) o.rounds = [];
    if (o.winner == null) o.winner = o.rounds.length ? o.rounds[o.rounds.length - 1].top[0] : 0;
    if (!d.body || !o.players.length) return resolved({ winner: o.winner, skipped: true });
    var tv = isTV(), box = d.createElement("div"), mode = o.mode;
    box.className = "bg-fp bg-fp--" + mode + (o.layout === "peek" ? " bg-fp--peek" : "") + (o.players.length > 4 ? " bg-fp--many" : "");
    box.setAttribute("role", "dialog"); box.setAttribute("aria-modal", "true"); box.setAttribute("aria-label", o.title || "Who goes first"); box.tabIndex = -1;
    box.innerHTML = "<div class=\"bg-fp__panel\"><span class=\"bg-eyebrow bg-fp__eyebrow\">" + esc(o.eyebrow || "Who goes first?") + "</span>" +
      "<h2 class=\"bg-fp__title\">" + esc(o.title || "") + "</h2>" + (mode === "spin" ? "<div class=\"bg-fp__die\" aria-hidden=\"true\"><span class=\"bg-fp__letter\">?</span></div>" : "") +
      "<div class=\"bg-fp__lanes\"></div><div class=\"bg-fp__res\" aria-live=\"polite\"><span class=\"bg-fp__rt\"></span><span class=\"bg-fp__rs\"></span></div>" +
      "<span class=\"bg-fp__skip\">" + (tv ? "Press OK to skip" : "Tap to skip") + "</span></div>";
    var lanesEl = box.querySelector(".bg-fp__lanes"), s = { o: o, box: box, lanes: [], pins: [], timers: [], final: false, closed: false, skipped: false, prev: d.activeElement };
    s.res = box.querySelector(".bg-fp__res");
    o.players.forEach(function (p, i) { var l = fpLane(o, i); s.lanes.push(l); lanesEl.appendChild(l); });
    if (o.pins && fpDice(o)) o.players.forEach(function (p, i) {
      var at = null; try { at = o.pins(i); } catch (e) { at = null; }
      if (!at) { s.pins.push(null); return; }
      var pin = d.createElement("span"); pin.className = "bg-die bg-fp__pin"; pin.setAttribute("data-seat", String(p.seat || i + 1));
      pin.style.left = Math.round(at.x) + "px"; pin.style.top = Math.round(at.y) + "px"; dieRender(pin, 1); box.appendChild(pin); s.pins.push(pin);
    });
    fpS = s; d.body.appendChild(box); root.classList.add("bg-fp-open");
    void box.offsetWidth; box.classList.add("is-open");
    var pr0 = box.querySelector(".bg-fp__panel").getBoundingClientRect();   // a die on the board never sits under (or on) the panel
    s.pins.forEach(function (pin) { if (pin && parseFloat(pin.style.top) > pr0.top - 28) pin.style.display = "none"; });
    focusEl(box);
    box.addEventListener("click", function (e) { e.preventDefault(); e.stopPropagation(); fpSkip(); });
    emit("firstplayer", { open: true, mode: mode });
    var pr = promise(function (res) { s.res0 = res; });
    if (fpShort()) { fpLater(function () { fpFinal(s); }, 150); return pr; }
    fpLater(function () { if (mode === "spin") fpSpin(s); else fpRound(s, 0); }, 380 * fpFactor());
    return pr;
  }
  firstPlayer.resolve = fpResolve;
  firstPlayer.skip = fpSkip;
  firstPlayer.close = function () { if (fpS) fpClose(fpS); };
  firstPlayer.isOpen = function () { return !!fpS; };
  /* while the show is up it owns the keys: OK / Enter / Space / Back skip it, the arrows do nothing (a page's own handlers never see them) */
  if (w.addEventListener) w.addEventListener("keydown", function (e) {
    if (!fpS) return;
    var k = e.key, c = e.keyCode;
    if (k === "Enter" || k === " " || k === "Spacebar" || k === "Select" || c === 13 || c === 32 || c === 23 || isBackKey(e)) { e.preventDefault(); e.stopPropagation(); fpSkip(); return; }
    if (dirOf(e)) { e.preventDefault(); e.stopPropagation(); }
  }, true);

  /* ---------------- export ---------------- */
  BGUI.version = "2.5.0";
  BGUI.reducedMotion = reducedMotion;
  BGUI.setReducedMotion = setReducedMotion;
  BGUI.haptic = haptic;
  BGUI.toast = toast;
  BGUI.sheet = sheet;
  BGUI.win = winApi;
  BGUI.celebrate = celebrate;
  BGUI.effects = effects;
  BGUI.hero = hero;
  BGUI.mark = mark;
  BGUI.trophy = trophy;
  BGUI.flip = flip;
  BGUI.tweenNumber = tweenNumber;
  BGUI.countdown = countdown;
  BGUI.ambient = ambient;
  BGUI.setTurn = setTurn;
  BGUI.stage = stage;
  BGUI.back = back;
  BGUI.focus = focus;
  BGUI.dice = dice;
  BGUI.setTV = setTV;
  BGUI.isTV = isTV;
  BGUI.mount = mount;
  BGUI.names = names;
  BGUI.hop = hop;
  BGUI.firstPlayer = firstPlayer;
  BGUI.util = { $: $, $$: $$, esc: esc, isVisible: isVisible };

  function boot() {
    toastNode();   // the live region exists (empty) before the first message, so screen readers announce it
    if (tvRequested() && !isTV()) setTV(true);
    else if (isTV() && !focusOn) { focus.enable(); focusByTV = true; }
    mount.auto();
    var sg = d.body && d.body.getAttribute("data-bg-stage");   // declarative: <body data-bg-stage="uno">
    if (sg && !stg.game) stage(sg);
    fxRefresh();
  }
  if (d.readyState === "loading") d.addEventListener("DOMContentLoaded", boot); else boot();
})(typeof window !== "undefined" ? window : null, typeof document !== "undefined" ? document : null);
