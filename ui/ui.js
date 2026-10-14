/* Board Games UI helpers: window.BGUI (the ONLY global this file creates).
   Pairs with ui/theme.css. Plain ES5, no dependencies, no build step. Every call is safe when its element is missing.

   BGUI.haptic(pattern)              guarded navigator.vibrate; pattern = name ("tap","select","turn","success","warn","error","roll") | ms | array
   BGUI.toast(msg, opts)             one shared toast; placed in the first free band (bottom up, then top down) clear of every
                                     visible .bg-players strip, the top bar, an open sheet and [data-toast-avoid]
   BGUI.sheet.open(el, opts)/close() bottom sheet: focus trap, Back/Escape closes, restores focus; opts {onClose, dismissible, focus}
   BGUI.win.open(el)/close()         win overlay (.bg-win): modal (Tab + D-pad stay inside), restores focus to the opener on close
   BGUI.celebrate(opts)              one-shot canvas burst of gold confetti + a gold ray bloom; auto-removes its canvas; nothing under reduced motion
   BGUI.effects.get()/set(level)     "full" (default) | "reduced": persisted (localStorage "bgui.effects"), reflected as html[data-effects];
                                     .motion() = what really runs ("full" | "reduced" | "off" under reduced motion);
                                     .state() = {level, motion, hz}: hz of the ONE effects ticker (4 orbs, 24 win screen, 0 still);
                                     .rate = {orbs, win, beat}: updates a second of the ticker and of the stepped hero fade
   BGUI.hero.show(el, {src, game})   crossfades the two .bg-hero__layer backdrops (the next image is decoded first, then fades in
                                     on top by opacity, stepped at effects.rate.beat)
   BGUI.mark() / BGUI.trophy()       the gold "diamond die" logomark and the laurel trophy as inline SVG strings
   BGUI.flip(el, fromRect, opts)     FLIP move (transform only)
   BGUI.tweenNumber(el, a, b, ms)    counts a number up/down
   BGUI.countdown(el, seconds, opts) ring timer (repaints 4x a second, no continuous animation); returns {stop,pause,resume,remaining,done}
   BGUI.ambient                      ONE scheduler for rare one-shot beats (emblem glint, turn pulse): never two at once,
                                     paused while the page is hidden or motion is reduced (CSS animations on their own layers)
   BGUI.setTurn(playerEl)            moves the static turn ring and asks the scheduler for 3 pulses
   BGUI.focus                        D-pad spatial navigation (auto-enabled in TV mode); Enter = click; stays inside an open sheet/win;
                                     the top bar is its own zone and focus scrolls clear of it (Down never enters it; at the end of
                                     the page Down scrolls on only while the focused control stays clear of it); arrows never get
                                     stuck in select/text/radio
   BGUI.dice                         SVG pip faces + a cheap roll (transform tumble + a few face swaps)
   BGUI.setTV(on) / isTV()           html[data-tv]; auto for ?tv=1 and window.AndroidTV
   BGUI.mount.*                      seg, stepper, toggle, versions, players, emblem, orbs, auto (declarative data-bg-mount)
   BGUI.icon(name)                   from ui/icons.js (optional) */
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
    /* the continuous-effects ticker: hz = 4 (orbs drifting), 24 (win rays + confetti) or 0 (nothing endless is moving) */
    state: function () { return { level: fxLevel, motion: effects.motion(), hz: tick.hz, hidden: !!d.hidden }; }
  };
  /* everything pauses while the page is hidden: CSS loops via html[data-hidden], beats via the ambient scheduler */
  function hiddenFlag() { if (d.hidden) root.setAttribute("data-hidden", ""); else root.removeAttribute("data-hidden"); }
  hiddenFlag();
  d.addEventListener("visibilitychange", hiddenFlag);

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
  var RATE = { orbs: 4, win: 24, beat: 30 };   // updates a second: orb drift, win screen, the stepped hero fade
  var RAY_DEG_S = 6;                           // the mockup's ray wheel: one turn a minute
  var ORBS = [[9, 5, 46], [-8, -6, 58], [9, 5, 64]];   // drift: x rem, y rem, seconds per leg (eased there and back)
  var tick = { id: 0, hz: 0, last: 0, orbT: 0, winT: 0, win: null, bits: null, H: 0, rem: 16 };
  function fxWant() {
    if (d.hidden || reducedMotion() || fxLevel !== "full") return 0;
    var win = openWin();
    if (win) return win.querySelector(".bg-win__wheel, .bg-win__fall") ? Math.max(1, +RATE.win || 24) : 0;
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
  w.addEventListener("resize", function () { if (tick.win) tick.bits = null; });
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
    $$(".bg-orbs > i").forEach(function (el, i) {
      var p = ORBS[i % 3], k = (1 - Math.cos(Math.PI * o / p[2])) / 2;
      el.style.transform = "translate3d(" + (p[0] * k).toFixed(3) + "rem," + (p[1] * k).toFixed(3) + "rem,0)";
    });
  }
  function fxRefresh() {
    var want = fxWant();
    if (want === tick.hz) return;
    if (tick.id) { clearInterval(tick.id); tick.id = 0; }
    tick.hz = want; tick.last = 0;
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
  var toastEl = null, toastTimer = 0;
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
     bottom), [data-toast-avoid] and an open sheet. Bands are treated as full width (the toast is centred). */
  function avoidBands(vh) {
    var out = [];
    $$(".bg-topbar, .bg-players, [data-toast-avoid]").forEach(function (el) {
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
    var order = want === "top" ? ["top", "bottom"] : ["bottom", "top"], mode = order[0], y = null;
    for (var i = 0; i < order.length && y === null; i++) { mode = order[i]; y = freeSpot(bands, vh, h, gap, edge, mode); }
    if (y === null) {   // nothing is free (a tall sheet over a strip): just under the top bar, over the least important band
      mode = "top"; y = edge;
      $$(".bg-topbar").forEach(function (b) { if (isVisible(b)) { var r = b.getBoundingClientRect(); if (r.top <= 1 && r.bottom + gap > y) y = r.bottom + gap; } });
    }
    el.classList.toggle("is-top", mode === "top");
    if (mode === "top") { el.style.top = Math.round(y) + "px"; el.style.bottom = "auto"; }
    else { el.style.top = "auto"; el.style.bottom = Math.round(vh - y - h) + "px"; }
    return mode;
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
    var mode = placeToast(el, opts.place);
    void el.offsetWidth;
    el.classList.add("is-show");
    if (opts.haptic) haptic(opts.haptic);
    var ms = opts.ms === undefined ? 2600 : opts.ms;
    if (ms > 0) toastTimer = setTimeout(hideToast, ms);
    return { el: el, place: mode, hide: hideToast };
  }
  function hideToast() { clearTimeout(toastTimer); if (toastEl) toastEl.classList.remove("is-show"); }
  toast.hide = hideToast;
  toast.place = function () { if (toastEl) placeToast(toastEl); };

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
    if (toastEl && toastEl.classList.contains("is-show")) placeToast(toastEl);
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
    if (toastEl && toastEl.classList.contains("is-show")) placeToast(toastEl);
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
  function ambBegin(b) {
    if (!b.el || !b.el.parentNode) { if (b.done) b.done(false); return false; }
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
    amb.items = amb.items.filter(function (it) { return it.el && it.el.parentNode; });
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
    el.classList.add("is-turn");
    if (strip && strip.classList && strip.classList.contains("bg-players--scroll")) {   // scroll the strip only (scrollIntoView would also scroll the page)
      var sr = strip.getBoundingClientRect(), er = el.getBoundingClientRect();
      if (er.left < sr.left) strip.scrollLeft -= sr.left - er.left + 8; else if (er.right > sr.right) strip.scrollLeft += er.right - sr.right + 8;
    }
    if (opts.pulse !== false) ambient.trigger(el, { cls: "is-pulse", ms: 3 * 1600 + 120 });
    if (opts.haptic) haptic("turn");
    return true;
  }

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
  /* scroll a page control into view below the sticky top bar (scroll-padding via --bg-bar-h, then a manual check) */
  function reveal(el) {
    if (zoneOf(el)) return;   // the bar itself never scrolls
    var inPage = !(el.closest && el.closest(".bg-sheet, .bg-win")), cover = inPage ? barCover() : 0;
    if (inPage) root.style.setProperty("--bg-bar-h", Math.round(cover) + "px");
    try { el.scrollIntoView({ block: "nearest", inline: "nearest" }); } catch (e) { try { el.scrollIntoView(false); } catch (e2) { } }
    if (cover) {
      var r = el.getBoundingClientRect(), want = cover + (parseFloat(w.getComputedStyle(el).scrollMarginTop) || 0);
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
    if (!z && dir === "down" && !sheetTop() && !openWin()) return pageEnd(a);
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
    if (toastEl && toastEl.classList.contains("is-show")) placeToast(toastEl);
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
      var el = host.querySelector(":scope > .bg-orbs");
      if (!el) {
        el = d.createElement("div"); el.className = "bg-orbs"; el.setAttribute("aria-hidden", "true");
        el.innerHTML = new Array(((opts && opts.count) || 2) + 1).join("<i></i>");
        host.insertBefore(el, host.firstChild);
        fxRefresh();
      }
      return { el: el };
    },
    /* declarative wiring: data-bg-mount="seg|stepper|toggle|versions|emblem" (runs once on DOMContentLoaded) */
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

  /* ---------------- export ---------------- */
  BGUI.version = "2.0.0";
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
  BGUI.focus = focus;
  BGUI.dice = dice;
  BGUI.setTV = setTV;
  BGUI.isTV = isTV;
  BGUI.mount = mount;
  BGUI.util = { $: $, $$: $$, esc: esc, isVisible: isVisible };

  function boot() {
    toastNode();   // the live region exists (empty) before the first message, so screen readers announce it
    if (tvRequested() && !isTV()) setTV(true);
    else if (isTV() && !focusOn) { focus.enable(); focusByTV = true; }
    mount.auto();
    fxRefresh();
  }
  if (d.readyState === "loading") d.addEventListener("DOMContentLoaded", boot); else boot();
})(typeof window !== "undefined" ? window : null, typeof document !== "undefined" ? document : null);
