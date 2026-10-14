/* Board Games UI helpers: window.BGUI (the ONLY global this file creates).
   Pairs with ui/theme.css. Plain ES5, no dependencies, no build step. Every call is safe when its element is missing.

   BGUI.haptic(pattern)              guarded navigator.vibrate; pattern = name ("tap","select","turn","success","warn","error","roll") | ms | array
   BGUI.toast(msg, opts)             one shared toast; position computed from the layout (open sheet, top bar, [data-toast-avoid])
   BGUI.sheet.open(el, opts)/close() bottom sheet: focus trap, Back/Escape closes, restores focus; opts {onClose, dismissible, focus}
   BGUI.win.open(el)/close()         win overlay (.bg-win): modal (Tab + D-pad stay inside), restores focus to the opener on close
   BGUI.celebrate(opts)              one-shot canvas confetti + ray bloom; auto-removes its canvas; nothing under reduced motion
   BGUI.flip(el, fromRect, opts)     FLIP move (transform only)
   BGUI.tweenNumber(el, a, b, ms)    counts a number up/down
   BGUI.countdown(el, seconds, opts) ring timer (repaints 4x a second, no continuous animation); returns {stop,pause,resume,remaining,done}
   BGUI.ambient                      ONE scheduler for rare one-shot beats (emblem glint, turn pulse): never two at once,
                                     paused while the page is hidden or motion is reduced
   BGUI.setTurn(playerEl)            moves the static turn ring and asks the scheduler for 3 pulses
   BGUI.focus                        D-pad spatial navigation (auto-enabled in TV mode); Enter = click; stays inside an open sheet/win;
                                     the top bar is its own zone and focus scrolls clear of it; arrows never get stuck in select/text/radio
   BGUI.dice                         SVG pip faces + a cheap roll (transform tumble + a few face swaps)
   BGUI.setTV(on) / isTV()           html[data-tv]; auto for ?tv=1 and window.AndroidTV
   BGUI.mount.*                      seg, stepper, toggle, versions, players, auto (declarative data-bg-mount)
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
  /* px covered at the top (top bar, [data-toast-avoid] in the top half) and at the bottom (open sheet, [data-toast-avoid]) */
  function layoutCover() {
    var vh = w.innerHeight || root.clientHeight, top = 0, bottom = 0;
    $$(".bg-topbar, [data-toast-avoid]").forEach(function (el) {
      if (!isVisible(el)) return;
      var r = el.getBoundingClientRect();
      if (r.bottom <= 0 || r.top >= vh) return;
      if (r.top + r.height / 2 < vh / 2) top = Math.max(top, r.bottom); else bottom = Math.max(bottom, vh - r.top);
    });
    var s = sheetTop();
    if (s) bottom = Math.max(bottom, Math.min(vh, s.offsetHeight));   // layout height: correct even mid-slide
    return { top: top, bottom: bottom, vh: vh };
  }
  function placeToast(el, want) {
    var c = layoutCover(), gap = 12, mode = want || "auto";
    if (mode === "auto") mode = c.bottom > c.vh * 0.45 ? "top" : "bottom";
    el.classList.toggle("is-top", mode === "top");
    if (mode === "top") { el.style.top = Math.round(c.top + gap) + "px"; el.style.bottom = "auto"; }
    else { el.style.top = "auto"; el.style.bottom = c.bottom ? Math.round(c.bottom + gap) + "px" : ""; }
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
    el.classList.add("is-open");
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
    var back = winOpener;
    winOpener = null;
    if (back && back.parentNode && back !== d.body && isVisible(back)) { if (focusOn && dpad) setFocus(back); else focusEl(back); }
    emit("win", { open: false, el: el });
    return true;
  }
  var winApi = { open: openWinEl, close: closeWinEl, isOpen: function () { return !!openWin(); } };

  /* ---------------- celebrate: one-shot canvas confetti + ray bloom ---------------- */
  var fx = null;
  function seatColours() {
    var cs = w.getComputedStyle(root), out = [];
    for (var i = 1; i <= 8; i++) { var c = (cs.getPropertyValue("--seat-" + i) || "").trim(); if (c) out.push(c); }
    return out.length ? out : ["#d63c2f", "#2f66c9", "#279957", "#ebb81f", "#8a52c8", "#17a09b", "#ee7b22", "#e0609a"];
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
    var cols = opts.colors || seatColours().concat(["#f3db97", "#fff3d1"]);
    var N = opts.count || clamp(Math.round(W * H / 7000), 50, 150);
    var ms = opts.ms || 2800, rays = opts.rays !== false && opts.confetti !== "only";
    var ox = W / 2, oy = H * 0.42, o = opts.origin;
    if (o && o.nodeType === 1) { var r = o.getBoundingClientRect(); ox = r.left + r.width / 2; oy = r.top + r.height / 2; }
    else if (o && typeof o.x === "number") { ox = o.x; oy = o.y; }
    if (win && win.querySelector(".bg-win__rays") && opts.rays === undefined) rays = false;   // the overlay already blooms its own rays
    var bits = [];
    for (var i = 0; i < (opts.confetti === false ? 0 : N); i++) {
      bits.push({ x: Math.random() * W, y: -20 - Math.random() * H * 0.6, vx: (Math.random() - 0.5) * 80, vy: 120 + Math.random() * 170,
        w: 6 + Math.random() * 5, h: 9 + Math.random() * 7, a: Math.random() * 6.28, va: 4 + Math.random() * 8, c: cols[i % cols.length] });
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
          ctx.fillStyle = "rgba(255,214,140," + alpha.toFixed(3) + ")";
          ctx.beginPath();
          for (var k = 0; k < 16; k++) {
            var a0 = rot + k * Math.PI / 8, a1 = a0 + 0.17;
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
        ctx.fillRect(b.x, b.y, b.w, fh);
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
  var amb = { every: 14000, items: [], queue: [], active: null, timer: 0, idx: 0, last: 0, paused: false };
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
    var due = amb.last + amb.every - now();
    if (due > 20) { amb.timer = setTimeout(ambTick, due); return; }
    var it = amb.items[amb.idx++ % amb.items.length];
    amb.last = now();
    ambBegin({ el: it.el, cls: it.cls, ms: it.ms });
  }
  function ambientRefresh() {
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
  Object.defineProperty(ambient, "every", { get: function () { return amb.every; }, set: function (v) { amb.every = Math.max(2000, +v || 14000); if (!amb.active) ambTick(); } });

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
      best = pick(a, clear, dir);
    }
    return best ? setFocus(best) : false;
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
    /* declarative wiring: data-bg-mount="seg|stepper|toggle|versions" (runs once on DOMContentLoaded) */
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
  BGUI.version = "1.0.0";
  BGUI.reducedMotion = reducedMotion;
  BGUI.setReducedMotion = setReducedMotion;
  BGUI.haptic = haptic;
  BGUI.toast = toast;
  BGUI.sheet = sheet;
  BGUI.win = winApi;
  BGUI.celebrate = celebrate;
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
  }
  if (d.readyState === "loading") d.addEventListener("DOMContentLoaded", boot); else boot();
})(typeof window !== "undefined" ? window : null, typeof document !== "undefined" ? document : null);
