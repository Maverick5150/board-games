/* Board Games UI: BGUI.picker, the shared Version picker with a BIG PREVIEW (Midnight Luxe; picker 1.0, 2026-10-16).
   The CEO (2026-10-16): "in every single game, there should be previews of the board for different versions of the game".
   Built from the Snakes and Ladders board sheet (snakes/game.js buildBoardSheet / showBig / atReadingLine / fitBig, commit 5303971).

   Load it AFTER ui.js, only on the pages that use it (it brings its own CSS, injected once as <style id="bg-picker-css">):
     <script src="../ui/ui.js"></script><script src="../ui/picker.js"></script>      (add "../ui/picker.js" to the page's sw.js ASSETS)

   BGUI.picker.open({
     title, sub, eyebrow,                  the sheet's head (eyebrow default "Choose a version")
     groups: [{head, items: [{id, name, meta, desc, detail, tags, small, disabled}]}],   (or items: [...] for one group with no head)
     chosen,                               the id in play now (marked "Chosen", focused, and the first big preview)
     render: (id) => svg / html / Node,    the BIG preview of an id (default: the item's small picture)
     info: (id) => {name, meta, note},     the caption under it (default: the item's name, meta and desc)
     aspect,                               the preview's width / height (default 1; 4/3 for a card table, 0.75 for an upright sheet)
     fit: (picEl, id, {width, height, floor}),   optional: after each render and resize (show numbers only where they reach `floor` px)
     pickLabel, keepLabel,                 the button under the preview ("Play this version" / "Keep this version"); phone only
     hint,                                 the how-to line under the sub (default by input; false = none)
     onPick: (id, item) => {},             after the sheet has closed (focus is back on the opener)
     onClose: (reason) => {},              "pick", "back", "scrim", "close"
     refocus                               optional element / selector to focus after onPick (when onPick redraws the opener)
   }) -> the sheet element;  BGUI.picker.close(), .isOpen(), .preview(id), .peek(), .version

   Behaviour (the CEO's rule, BG_audit/sprint/previews/TASK-PREVIEWS.md):
   - phone upright: the big preview on top (sticky), the list scrolling under it; phone sideways, a wide desktop and TV: the preview on
     the left, the list on the right;
   - a tap previews, a second tap (or the pick button) picks; the preview follows a finger scroll (the entry at the reading line);
   - TV: the D-pad moves through the list, the preview follows the focus, OK picks, Back closes (BGUI.sheet takes the Back step);
   - the tap that opened the sheet is ignored (its click, BGUI 2.5.2) for the list and the pick button too;
   - text floors: 12 px phone, 21 px at 1080p TV (the theme's --fs-* scale); Reduce effects / reduced motion: no cross-fade. */
(function (w, d) {
  "use strict";
  var B = w.BGUI = w.BGUI || {};
  if (B.picker) return;
  var root = d.documentElement;
  var CSS = [
    ".bg-pk{--bg-pk-ar:1; --bg-pk-sw:4.75rem; scroll-padding-top:var(--bg-pk-peek-h,0px)}",
    ".bg-pk__wrap{display:block}",
    ".bg-pk__head{margin-bottom:.25rem}",
    ".bg-pk__hint{margin:.35rem 0 0; font:var(--fw-ui) var(--fs-xs)/1.35 var(--font-ui); color:var(--text-1)}",
    ".bg-pk__hint:empty,.bg-pk__sub:empty{display:none}",
    /* the big preview: sticky on top of the scrolling list (phone upright) */
    ".bg-pk__big{position:sticky; top:-.5rem; z-index:3; margin:.5rem calc(-1 * (var(--gutter) + .25rem)) 0; padding:.625rem calc(var(--gutter) + .25rem) .75rem;" +
      "background:linear-gradient(180deg,#191e3a,#151932); box-shadow:0 1px 0 var(--line-gold), 0 .75rem 1rem -.75rem rgba(0,0,0,.85)}",
    ".bg-pk__art{position:relative; width:min(100%, calc(30vh * var(--bg-pk-ar))); width:min(100%, calc(30dvh * var(--bg-pk-ar))); aspect-ratio:var(--bg-pk-ar);" +
      "margin:0 auto; border-radius:var(--r-md); overflow:hidden; background:#0b0a12; box-shadow:0 .5rem 1.25rem rgba(0,0,0,.5)}",
    ".bg-pk__art::after,.bg-pk__small::after{content:\"\"; position:absolute; inset:0; border-radius:inherit; box-shadow:inset 0 0 0 1px var(--line-gold); pointer-events:none}",
    ".bg-pk__pic{width:100%; height:100%}",
    ".bg-pk__pic > svg,.bg-pk__pic > img,.bg-pk__pic > canvas,.bg-pk__small > svg,.bg-pk__small > img{display:block; width:100%; height:100%}",
    ".bg-pk__cap{display:grid; grid-template-columns:minmax(0,1fr) auto; align-items:center; gap:.75rem; margin:.625rem 0 0}",
    ".bg-pk__text{display:grid; gap:.15rem; min-width:0}",
    ".bg-pk__name{font:400 var(--fs-lg)/1.15 var(--font-display); color:var(--gold-100)}",
    ".bg-pk__meta{font:var(--fw-ui) var(--fs-xs)/1.3 var(--font-ui); color:var(--text-1)}",
    ".bg-pk__note{font:var(--fw-body) var(--fs-xs)/1.35 var(--font-ui); color:var(--text-2)}",
    ".bg-pk__meta:empty,.bg-pk__note:empty{display:none}",
    ".bg-pk__pick{min-height:var(--tap); white-space:nowrap}",
    /* the list */
    ".bg-pk__group{margin:1.25rem 0 .625rem}",
    ".bg-pk__opt{grid-template-columns:var(--bg-pk-sw) minmax(0,1fr); align-items:start}",
    ".bg-pk__opt.is-plain{grid-template-columns:minmax(0,1fr)}",
    ".bg-pk__small{position:relative; width:var(--bg-pk-sw); aspect-ratio:var(--bg-pk-ar); border-radius:var(--r-sm); overflow:hidden; background:#0b0a12}",
    ".bg-pk__tags{display:flex; flex-wrap:wrap; gap:.3rem}",
    ".bg-pk__tags:empty{display:none}",
    ".bg-pk__opt.is-peek{background:radial-gradient(100% 120% at 0% 0%, rgba(248,239,216,.12), rgba(0,0,0,0) 65%), var(--control-fill);" +
      "box-shadow:inset 0 0 0 2px rgba(248,239,216,.62), inset 0 1px 0 rgba(255,255,255,.08)}",
    /* phone sideways (and a wide desktop): the preview on the left, as big as the height allows (picker.js fits it), the list right */
    "@media (orientation:landscape) and (max-height:600px){",
    "  html:not([data-tv]) .bg-pk{width:min(100%,58rem); max-height:100vh; max-height:100dvh}",
    "  html:not([data-tv]) .bg-pk__wrap{--bg-pk-bigw:clamp(10rem, calc((100vh - 12.5rem) * var(--bg-pk-ar)), calc(15rem * var(--bg-pk-ar)));" +
      "--bg-pk-bigw:clamp(10rem, calc((100dvh - 12.5rem) * var(--bg-pk-ar)), calc(15rem * var(--bg-pk-ar)))}",
    "}",
    "@media (orientation:landscape) and (min-width:64rem) and (min-height:601px){",
    "  html:not([data-tv]) .bg-pk{width:min(100%,64rem)}",
    "  html:not([data-tv]) .bg-pk__wrap{--bg-pk-bigw:min(30rem, max(16rem, calc(24rem * var(--bg-pk-ar))))}",
    "}",
    "@media (orientation:landscape) and (max-height:600px), (orientation:landscape) and (min-width:64rem){",
    "  html:not([data-tv]) .bg-pk{scroll-padding-top:0}",
    "  html:not([data-tv]) .bg-pk__wrap{display:grid; grid-template-columns:var(--bg-pk-bigw) minmax(0,1fr); grid-template-areas:\"big head\" \"big list\"; column-gap:1.5rem; align-items:start}",
    "  html:not([data-tv]) .bg-pk__head{grid-area:head}",
    "  html:not([data-tv]) .bg-pk__list{grid-area:list; min-width:0}",
    "  html:not([data-tv]) .bg-pk__big{grid-area:big; align-self:start; top:0; margin:0; padding:0; background:none; box-shadow:none}",
    "  html:not([data-tv]) .bg-pk__art{width:100%}",
    "  html:not([data-tv]) .bg-pk__cap{grid-template-columns:minmax(0,1fr); gap:.375rem; margin-top:.5rem}",
    "  html:not([data-tv]) .bg-pk__name{font-size:var(--fs-md)}",
    "}",
    /* TV (1rem = 24 px at 1080p, 12 px at 960x540: the same layout at both): preview left, list right, OK picks (no pick button) */
    "html[data-tv] .bg-pk{width:min(100%,76rem); scroll-padding-top:0}",
    "html[data-tv] .bg-pk__wrap{display:grid; grid-template-columns:min(36rem, max(18rem, calc(28rem * var(--bg-pk-ar)))) minmax(0,1fr);" +
      "grid-template-areas:\"big head\" \"big list\"; column-gap:2.5rem; align-items:start}",
    "html[data-tv] .bg-pk__head{grid-area:head}",
    "html[data-tv] .bg-pk__list{grid-area:list; min-width:0}",
    "html[data-tv] .bg-pk__big{grid-area:big; align-self:start; top:0; margin:0; padding:.5rem 0 0; background:none; box-shadow:none}",
    "html[data-tv] .bg-pk__art{width:100%}",
    "html[data-tv] .bg-pk__cap{grid-template-columns:minmax(0,1fr); margin-top:.875rem}",
    "html[data-tv] .bg-pk__pick{display:none}",
    "html[data-tv] .bg-pk__opts{gap:1.5rem}",
    "html[data-tv] .bg-pk__opt{gap:1.25rem}",
    "html[data-tv] .bg-pk__group{margin:1.75rem 0 .75rem}"
  ].join("\n");

  var el = null, parts = {}, cur = null, items = {}, peekId = null, openedAt = 0, moved = 0, raf = 0, reason = "";
  function now() { return Date.now(); }
  function onTV() { return root.hasAttribute("data-tv"); }
  function calm() {   // Reduce effects / reduced motion / a hidden page: no cross-fade
    if (d.hidden || root.getAttribute("data-motion") === "reduce" || root.getAttribute("data-effects") === "reduced") return true;
    try { if (B.reducedMotion && B.reducedMotion()) return true; if (B.effects && B.effects.get && B.effects.get() === "reduced") return true; } catch (e) { }
    return false;
  }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function put(box, x) {
    box.textContent = "";
    if (x == null || x === false) return;
    if (typeof x === "object" && x.nodeType) box.appendChild(x); else box.innerHTML = String(x);
  }
  function remPx() { return parseFloat(w.getComputedStyle(root).fontSize) || 16; }
  function css() {
    if (d.getElementById("bg-picker-css")) return;
    var s = d.createElement("style"); s.id = "bg-picker-css"; s.textContent = CSS;
    (d.head || root).appendChild(s);
  }
  function q(sel) { return el.querySelector(sel); }
  function build() {
    if (el && el.isConnected) return;
    css();
    el = d.createElement("section");
    el.className = "bg-sheet bg-pk"; el.id = "bgPicker"; el.setAttribute("aria-labelledby", "bgPickerTitle");
    el.innerHTML = '<div class="bg-sheet__grip" aria-hidden="true"></div><div class="bg-pk__wrap">' +
      '<div class="bg-pk__head"><span class="bg-eyebrow bg-eyebrow--accent"></span><h2 class="bg-sheet__title" id="bgPickerTitle"></h2>' +
      '<p class="bg-sheet__sub bg-pk__sub"></p><p class="bg-pk__hint"></p></div>' +
      '<figure class="bg-pk__big"><div class="bg-pk__art" aria-hidden="true"><div class="bg-pk__pic"></div></div>' +
      '<figcaption class="bg-pk__cap"><span class="bg-pk__text" aria-live="polite"><span class="bg-pk__name"></span><span class="bg-pk__meta"></span>' +
      '<span class="bg-pk__note"></span></span><button type="button" class="bg-btn bg-btn--primary bg-pk__pick"></button></figcaption></figure>' +
      '<div class="bg-pk__list"></div></div>';
    d.body.appendChild(el);
    parts = { eyebrow: q(".bg-eyebrow"), title: q(".bg-sheet__title"), sub: q(".bg-pk__sub"), hint: q(".bg-pk__hint"), big: q(".bg-pk__big"), art: q(".bg-pk__art"),
      pic: q(".bg-pk__pic"), name: q(".bg-pk__name"), meta: q(".bg-pk__meta"), note: q(".bg-pk__note"), pick: q(".bg-pk__pick"), list: q(".bg-pk__list"), cap: q(".bg-pk__cap") };
    /* a tap shows it LARGE; a second tap on it (or the pick button) picks it. OK on TV, a key press (Enter / Space: click detail 0) or a
       tap on the one already shown picks at once. The click of the tap that opened the sheet is ignored (BGUI 2.5.2) */
    parts.list.addEventListener("click", function (e) {
      var b = e.target.closest && e.target.closest(".bg-pk__opt");
      if (!b || b.disabled || !cur) return;
      if (e.detail > 0 && now() - openedAt < 450) return;
      var id = b.getAttribute("data-pk");
      if (onTV() || e.detail === 0 || id === peekId) pick(id); else show(id, true);
    });
    /* TV (and a keyboard): the preview follows the focus. Not on a finger tap (its focus would make the same tap pick) */
    parts.list.addEventListener("focusin", function (e) {
      var b = e.target.closest && e.target.closest(".bg-pk__opt");
      if (!b || !cur) return;
      var kb = false; try { kb = b.matches(":focus-visible"); } catch (x) { }
      if (onTV() || kb) show(b.getAttribute("data-pk"));
    });
    parts.pick.addEventListener("click", function (e) { if (e.detail > 0 && now() - openedAt < 450) return; if (cur && peekId) pick(peekId); });
    /* phone: the preview follows the scroll (only while a finger, the wheel or a key moves it) */
    ["touchmove", "wheel", "pointermove"].forEach(function (t) { el.addEventListener(t, function (ev) { if (t !== "pointermove" || ev.buttons) moved = now(); }, { passive: true }); });
    el.addEventListener("keydown", function (ev) { if (/^(Arrow|Page|Home|End| )/.test(ev.key)) moved = now(); });
    el.addEventListener("scroll", function () {
      if (!cur || onTV() || now() - moved > 900 || raf) return;
      raf = w.requestAnimationFrame(function () { raf = 0; var id = atReadingLine(); if (id && id !== peekId) show(id); });
    }, { passive: true });
  }
  function tagHTML(t) {
    if (t == null || t === "") return "";
    if (typeof t === "string") return '<span class="bg-tag bg-tag--paper">' + esc(t) + "</span>";
    return '<span class="bg-tag' + (t.kind ? " bg-tag--" + esc(t.kind) : "") + '">' + esc(t.text) + "</span>";
  }
  function optHTML(it) {
    var small = it.small != null && it.small !== false && !(typeof it.small === "object" && it.small.nodeType);
    return '<button type="button" class="bg-sheet__option bg-pk__opt' + (it.small == null || it.small === false ? " is-plain" : "") + '" data-pk="' + esc(it.id) + '" aria-pressed="false"' + (it.disabled ? " disabled" : "") + ">" +
      (it.small == null || it.small === false ? "" : '<span class="bg-pk__small" aria-hidden="true">' + (small ? String(it.small) : "") + "</span>") +
      '<span class="bg-sheet__text"><span class="bg-sheet__label">' + esc(it.name) + '</span><span class="bg-pk__tags"></span>' +
      (it.meta ? '<span class="bg-sheet__desc">' + esc(it.meta) + "</span>" : "") +
      (it.desc ? '<span class="bg-sheet__desc">' + esc(it.desc) + "</span>" : "") +
      (it.detail ? '<span class="bg-sheet__detail">' + esc(it.detail) + "</span>" : "") + "</span></button>";
  }
  function opts() { return parts.list.querySelectorAll(".bg-pk__opt"); }
  function optOf(id) { var r = null; opts().forEach(function (o) { if (o.getAttribute("data-pk") === String(id)) r = o; }); return r; }
  function fill(o) {
    var groups = o.groups || [{ items: o.items || [] }], html = "", nodes = [];
    items = {};
    groups.forEach(function (g) {
      if (g.head) html += '<h3 class="bg-eyebrow bg-pk__group">' + esc(g.head) + "</h3>";
      html += '<div class="bg-sheet__options bg-pk__opts">';
      (g.items || []).forEach(function (it) {
        if (!it || it.id == null) return;
        items[String(it.id)] = it; html += optHTML(it);
        if (it.small && typeof it.small === "object" && it.small.nodeType) nodes.push(it);
      });
      html += "</div>";
    });
    parts.list.innerHTML = html;
    nodes.forEach(function (it) { var b = optOf(it.id); if (b) b.querySelector(".bg-pk__small").appendChild(it.small.cloneNode(true)); });
    opts().forEach(function (b) {
      var id = b.getAttribute("data-pk"), it = items[id], on = id === String(o.chosen);
      b.setAttribute("aria-pressed", String(on)); b.classList.toggle("is-best", on);
      b.querySelector(".bg-pk__tags").innerHTML = (on ? '<span class="bg-tag bg-tag--accent">Chosen</span>' : "") + (it.tags || []).map(tagHTML).join("");
    });
  }
  function firstId() { var b = parts.list.querySelector(".bg-pk__opt:not([disabled])") || parts.list.querySelector(".bg-pk__opt"); return b ? b.getAttribute("data-pk") : null; }
  function hintText(o) {
    if (o.hint === false) return "";
    if (typeof o.hint === "string") return o.hint;
    return onTV() ? "Move to one to see it large. Press OK to choose it." : "Tap one to see it large. Tap it again, or " + labels(o).pick + ", to choose it.";
  }
  function labels(o) {
    var p = o.pickLabel || "Play this version";
    return { pick: p, keep: o.keepLabel || (/^Play\b/.test(p) ? p.replace(/^Play\b/, "Keep") : "Keep this one") };
  }
  /* the entry under the reading line of the visible list: a third of the way down it, sliding to the ends at the top and the bottom
     of the scroll so the first and the last entries can be reached by scrolling too */
  function atReadingLine() {
    var r = el.getBoundingClientRect(), bb = parts.big.getBoundingClientRect(), side = bb.right <= parts.list.getBoundingClientRect().left + 1;
    var top = side ? r.top : Math.max(r.top, bb.bottom), bot = r.bottom, max = el.scrollHeight - el.clientHeight;
    var f = max > 0 ? .12 + .76 * Math.min(1, el.scrollTop / max) : .35, y = top + (bot - top) * f, best = null, bd = 1e9;
    opts().forEach(function (o) {
      if (o.disabled) return;
      var b = o.getBoundingClientRect(), dd = y < b.top ? b.top - y : y > b.bottom ? y - b.bottom : 0;
      if (dd < bd) { bd = dd; best = o; }
    });
    return best ? best.getAttribute("data-pk") : null;
  }
  /* show an entry in the big preview: its picture (render), its name, maker and year (meta) and what is different (note) */
  function show(id, tapped) {
    if (!cur || id == null || !items[String(id)]) return;
    id = String(id);
    var it = items[id], same = id === peekId, inf = null;
    peekId = id; parts.big.setAttribute("data-pk", id);
    if (!same) {
      var art = null;
      try { art = cur.render ? cur.render(id, it) : it.small; } catch (e) { setTimeout(function () { throw e; }); }
      if (art && typeof art === "object" && art.nodeType && art === it.small) art = art.cloneNode(true);
      put(parts.pic, art);
      if (!calm() && parts.pic.animate) { try { parts.pic.animate([{ opacity: .25, transform: "scale(.985)" }, { opacity: 1, transform: "none" }], { duration: 220, easing: "cubic-bezier(.2,.8,.2,1)" }); } catch (e2) { } }
    }
    try { inf = cur.info ? cur.info(id, it) : null; } catch (e3) { inf = null; }
    inf = inf || {};
    var name = inf.name != null ? inf.name : it.name;
    parts.name.textContent = name || "";
    parts.meta.textContent = inf.meta != null ? inf.meta : (it.meta || "");
    parts.note.textContent = inf.note != null ? inf.note : (it.desc || "");
    var chosen = id === String(cur.chosen), L = labels(cur);
    parts.pick.textContent = chosen ? L.keep : L.pick;
    parts.pick.setAttribute("aria-label", (chosen ? L.keep : L.pick) + ": " + (name || ""));
    parts.pick.disabled = !!it.disabled;
    opts().forEach(function (o) { o.classList.toggle("is-peek", !onTV() && o.getAttribute("data-pk") === id); });
    fit();
    if (tapped) { var o = optOf(id); if (o) try { o.scrollIntoView({ block: "nearest" }); } catch (e4) { } }
  }
  /* size the big preview: sideways / TV, as big as the column and the sheet's height allow (the caption and button stay on screen);
     upright, the CSS cap (30% of the height). Then the game's fit (numbers only where they reach the floor) and the sticky height */
  function fit() {
    if (!cur || !el || !el.classList.contains("is-open")) return;
    var ar = cur.aspect > 0 ? +cur.aspect : 1, art = parts.art;
    art.style.width = "";
    var side = parts.big.getBoundingClientRect().right <= parts.list.getBoundingClientRect().left + 1;
    if (side) {
      var cs = w.getComputedStyle(el), bs = w.getComputedStyle(parts.big), cps = w.getComputedStyle(parts.cap);
      var H = parseFloat(cs.maxHeight); H = H > 0 ? Math.min(H, w.innerHeight) : w.innerHeight;   // the sheet's full height, not its content's
      var room = H - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom) - parseFloat(bs.paddingTop) - parts.cap.offsetHeight - parseFloat(cps.marginTop) - 4;
      var colW = parts.big.clientWidth, wantW = Math.max(remPx() * 6, Math.min(colW, room * ar));
      if (wantW < colW - 1) art.style.width = Math.floor(wantW) + "px";
    }
    var r = art.getBoundingClientRect();
    if (typeof cur.fit === "function" && r.width) { try { cur.fit(parts.pic, peekId, { width: r.width, height: r.height, floor: onTV() ? remPx() * .875 : 12 }); } catch (e) { setTimeout(function () { throw e; }); } }
    el.style.setProperty("--bg-pk-peek-h", side ? "0px" : Math.ceil(parts.big.getBoundingClientRect().height) + "px");
  }
  w.addEventListener("resize", function () { if (cur && el && el.classList.contains("is-open")) fit(); });
  function pick(id) {
    var o = cur, it = items[String(id)];
    if (!o || !it || it.disabled) return;
    reason = "pick";
    close();
    if (typeof o.onPick === "function") { try { o.onPick(String(id), it); } catch (e) { setTimeout(function () { throw e; }); } }
    if (o.refocus) {
      var t = typeof o.refocus === "string" ? d.querySelector(o.refocus) : o.refocus;
      if (t && t.isConnected) { if (onTV() && B.focus && B.focus.enabled && B.focus.set) B.focus.set(t); else try { t.focus({ preventScroll: true }); } catch (e2) { } }
    }
  }
  function closed(why) {
    var o = cur; cur = null; peekId = null;
    var r = reason || why || "close"; reason = "";
    if (o && typeof o.onClose === "function") { try { o.onClose(r); } catch (e) { setTimeout(function () { throw e; }); } }
  }
  function open(o) {
    o = o || {};
    build();
    var wasOpen = isOpen();
    if (wasOpen && cur && cur !== o && typeof cur.onClose === "function") { try { cur.onClose("replaced"); } catch (e) { } }
    cur = o; peekId = null; reason = "";
    var ar = o.aspect > 0 ? +o.aspect : 1;
    el.style.setProperty("--bg-pk-ar", String(ar));
    el.style.setProperty("--bg-pk-sw", "calc(" + (onTV() ? 7.5 : 4.75) + "rem * " + Math.min(ar, 1.3) + ")");
    parts.eyebrow.textContent = o.eyebrow || "Choose a version";
    parts.title.textContent = o.title || "Versions";
    parts.sub.textContent = o.sub || "";
    parts.hint.textContent = hintText(o);
    fill(o);
    var start = o.chosen != null && items[String(o.chosen)] ? String(o.chosen) : firstId();
    openedAt = now();
    var sel = start != null ? '.bg-pk__opt[data-pk="' + String(start).replace(/["\\]/g, "\\$&") + '"]' : null;
    if (!wasOpen) {
      if (B.sheet && B.sheet.open) B.sheet.open(el, { focus: sel, onClose: closed });
      else { el.classList.add("is-open"); var f = sel && el.querySelector(sel); if (f) f.focus(); }
    }
    show(start);
    fit();
    /* phone: start at the top (the head, the preview, the list); only when the chosen entry is out of sight, bring it up to just under
       the preview (scroll-padding-top = the sticky preview's height upright, 0 sideways) */
    var c = sel && el.querySelector(sel);
    if (c && !onTV() && !wasOpen) {
      el.scrollTop = 0;
      var sr = el.getBoundingClientRect(), cr = c.getBoundingClientRect();
      if (cr.top > sr.bottom - Math.min(cr.height, remPx() * 5)) { try { c.scrollIntoView({ block: "start" }); } catch (e2) { } }
    }
    return el;
  }
  function isOpen() { return !!(el && el.classList.contains("is-open") && (!B.sheet || !B.sheet.isOpen || B.sheet.isOpen(el))); }
  function close() {
    if (!el) return false;
    if (B.sheet && B.sheet.isOpen && B.sheet.isOpen(el)) return B.sheet.close(el);
    if (el.classList.contains("is-open")) { el.classList.remove("is-open"); closed("close"); return true; }
    return false;
  }
  /* no BGUI.sheet (ui.js failed): Escape still closes it */
  d.addEventListener("keydown", function (e) { if (!(B.sheet && B.sheet.open) && cur && (e.key === "Escape" || e.key === "GoBack")) close(); });

  B.picker = { version: "1.0", open: open, close: close, isOpen: isOpen, preview: function (id) { show(id, false); }, peek: function () { return peekId; } };
})(window, document);
