/* Monopoly board (step 5): ONE renderer shared by the phone game (monopoly/index.html) and Party Mode (firestick/index.html).
   Original art only: the Luxe plate, the icons and the eight pieces are drawn here as SVG (no emoji, no copied board art).
   - The board is one static SVG drawn once (every name in full, auto-fitted so a word is never broken); houses, owners and
     mortgages are small per-square groups redrawn only when that square changes; the pieces, the "you are here" mark and the
     D-pad ring are HTML overlays. A piece is placed by ONE translate (it glides on the compositor: transform only); jailed pieces
     stand in the jail cell, visitors on the "Just visiting" L. Nothing animates in the SVG.
   - Phone zoom (pinch, double-tap, wheel, one-finger pan, "Fit") moves ONE transform on the stage; it is crisp at rest because the
     layer is re-rastered when the gesture ends.
   - TV: the board takes the D-pad (focus it, then the arrows walk the squares in order, OK opens the square).
   API: var mb = MonoBoard.mount(host, {squares, center, zoom, dpad, onTap, onOpen, onFocus, start});  mb.update(state);  mb.fit();  mb.destroy()
   state = {own:[seat|0 x40], houses:[0..5 x40], mort:[bool x40], toks:[{id,i,seat,tok,cur,title,jail}], amt:{4:"PAY $200",38:"PAY $100"}, hl:i}
   Also: MonoBoard.tokenSVG(name, seat, px), .icon(name, px), .card(i, info), .SEATS, .NAMES, .GROUPS, .plateHTML() */
(function (g) {
  "use strict";
  // a side square is W wide and D deep; the board is S units. Names are condensed caps: set 20% narrow (SX) with a slightly tight
  // track (LS, em), PAD units clear of each side line. STRIP = the price strip on the outer edge (the owner's colour when owned);
  // RIM = the outer edge's dark rim and brass line, which nothing may touch (review: prices and "Just visiting" sat on the brass line)
  var W = 100, D = 140, S = 2 * D + 9 * W, SX = 0.8, LS = -0.015, PAD = 5, STRIP = 31, RIM = 9;
  var INK = "#102a1c", LINE = "#2d6a46", PAPER = "#f6faf0", FIELD = "#cfe6d3", GOLD = "#c79a3b";
  var SEATS = {
    0: { c: "#e4e2da", hi: "#ffffff", lo: "#7a7f92", name: "silver" },   // the Luxe seat colours (ui/theme.css --seat-N, -hi, -lo, -ink): hex here so Party pages need no theme
    1: { c: "#ff5d73", hi: "#ffa1ae", lo: "#802f3a", name: "red" }, 2: { c: "#5f95ff", hi: "#a2c2ff", lo: "#304b80", name: "blue" },
    3: { c: "#3fd391", hi: "#90e5bf", lo: "#206a49", name: "green" }, 4: { c: "#ffcb4f", hi: "#ffe199", lo: "#806628", name: "yellow" },
    5: { c: "#b383ff", hi: "#d3b7ff", lo: "#5a4280", name: "purple" }, 6: { c: "#38cbd2", hi: "#8ce1e5", lo: "#1c6669", name: "teal" },
    7: { c: "#ff8c45", hi: "#ffbc93", lo: "#804623", name: "orange" }, 8: { c: "#ff7fcb", hi: "#ffb5e1", lo: "#804066", name: "pink" } };
  var GROUPS = { brown: { c: "#8a5a34", n: "Brown" }, light_blue: { c: "#a9dcf5", n: "Light blue" }, pink: { c: "#d8449b", n: "Pink" }, orange: { c: "#f39a2b", n: "Orange" },
    red: { c: "#dd3b3b", n: "Red" }, yellow: { c: "#f5d62c", n: "Yellow" }, green: { c: "#1f9d5a", n: "Green" }, dark_blue: { c: "#2f55d8", n: "Dark blue" } };
  /* the full names as printed on the classic US board (the engine keeps its own names for logs and saves) */
  var NAMES = ["GO", "Mediterranean Avenue", "Community Chest", "Baltic Avenue", "Income Tax", "Reading Railroad", "Oriental Avenue", "Chance", "Vermont Avenue", "Connecticut Avenue",
    "In Jail / Just Visiting", "St. Charles Place", "Electric Company", "States Avenue", "Virginia Avenue", "Pennsylvania Railroad", "St. James Place", "Community Chest", "Tennessee Avenue", "New York Avenue",
    "Free Parking", "Kentucky Avenue", "Chance", "Indiana Avenue", "Illinois Avenue", "B. & O. Railroad", "Atlantic Avenue", "Ventnor Avenue", "Water Works", "Marvin Gardens",
    "Go to Jail", "Pacific Avenue", "North Carolina Avenue", "Community Chest", "Pennsylvania Avenue", "Short Line", "Chance", "Park Place", "Luxury Tax", "Boardwalk"];
  function plain(s) { return String(s).replace(/ /g, " "); }
  function esc(s) { return plain(s).replace(/&/g, "&amp;").replace(/</g, "&lt;"); }
  var uid = 0;

  /* ---------------- geometry (units) ---------------- */
  function rectOf(i) {   // the square's rectangle on the board, its turn (the angle its text is set at) and its centre
    var r;
    if (i === 0) r = { x: S - D, y: S - D, w: D, h: D, a: 0 };
    else if (i < 10) r = { x: D + (9 - i) * W, y: S - D, w: W, h: D, a: 0 };
    else if (i === 10) r = { x: 0, y: S - D, w: D, h: D, a: 0 };
    else if (i < 20) r = { x: 0, y: S - D - (i - 10) * W, w: D, h: W, a: 90 };
    else if (i === 20) r = { x: 0, y: 0, w: D, h: D, a: 0 };
    else if (i < 30) r = { x: D + (i - 21) * W, y: 0, w: W, h: D, a: 180 };
    else if (i === 30) r = { x: S - D, y: 0, w: D, h: D, a: 0 };
    else r = { x: S - D, y: D + (i - 31) * W, w: D, h: W, a: 270 };
    r.cx = r.x + r.w / 2; r.cy = r.y + r.h / 2; r.corner = i % 10 === 0; r.side = i < 10 ? 0 : i < 20 ? 1 : i < 30 ? 2 : 3;
    return r;
  }
  var RECTS = []; for (var q = 0; q < 40; q++) RECTS.push(rectOf(q));
  function hit(x, y) {   // unit coordinates -> square index, or -1 (the middle)
    for (var i = 0; i < 40; i++) { var r = RECTS[i]; if (x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h) return i; }
    return -1;
  }
  function toScreen(i, lx, ly) {   // a point in the square's own frame (x along the edge, y from the inner edge outward) -> board units
    var r = RECTS[i], a = r.a * Math.PI / 180, bw = r.corner ? D : W, bh = D, dx = lx - bw / 2, dy = ly - bh / 2;
    return { x: r.cx + dx * Math.cos(a) - dy * Math.sin(a), y: r.cy + dx * Math.sin(a) + dy * Math.cos(a) };
  }
  function sqXf(i) { var r = RECTS[i], bw = r.corner ? D : W; return "translate(" + r2(r.cx) + " " + r2(r.cy) + ")" + (r.a ? " rotate(" + r.a + ")" : "") + " translate(" + (-bw / 2) + " " + (-D / 2) + ")"; }
  function r2(n) { return Math.round(n * 100) / 100; }
  /* the walk: the arrows move along the track, jump across the board and leave it at its edges (-1: the D-pad goes on to the page) */
  function walk(i, dir) {
    var s = RECTS[i].side, c = RECTS[i].corner;
    var T = {   // [left, right, up, down]
      0: [1, -1, 39, -1], 10: [-1, 9, 11, -1], 20: [-1, 21, -1, 19], 30: [29, -1, -1, 31] };
    var L = dir === "left", R = dir === "right", U = dir === "up", Dn = dir === "down", k = L ? 0 : R ? 1 : U ? 2 : 3;
    if (c) return T[i][k];
    if (s === 0) { if (L) return i === 9 ? 10 : i + 1; if (R) return i === 1 ? 0 : i - 1; if (U) return 30 - i; return -1; }
    if (s === 2) { if (L) return i === 21 ? 20 : i - 1; if (R) return i === 29 ? 30 : i + 1; if (Dn) return 30 - i; return -1; }
    if (s === 1) { if (U) return i === 19 ? 20 : i + 1; if (Dn) return i === 11 ? 10 : i - 1; if (R) return 50 - i; return -1; }
    if (U) return i === 31 ? 30 : i - 1; if (Dn) return i === 39 ? 0 : i + 1; if (L) return 50 - i; return -1;
  }

  /* ---------------- text fitting ---------------- */
  var cx = null, cxTried = false, wcache = {};
  var FONT = "'Manrope','Segoe UI',system-ui,-apple-system,Roboto,'Helvetica Neue',Arial,sans-serif";
  function ctx() {
    if (cxTried) return cx; cxTried = true;
    try { var c = document.createElement("canvas"); cx = c.getContext && c.getContext("2d"); if (cx && cx.measureText) cx.font = "800 100px " + FONT; else cx = null; } catch (e) { cx = null; }
    return cx;
  }
  function w100(s, weight) {   // the width of s at 100 units, uncondensed
    var k = weight + "|" + s; if (wcache[k] !== undefined) return wcache[k];
    var c = ctx(), v;
    if (c) { c.font = weight + " 100px " + FONT; v = c.measureText(s).width; } else v = s.length * 70;   // no canvas (jsdom): a wide estimate
    return (wcache[k] = v);
  }
  function tw(s, f, weight) { return (w100(s, weight || 800) + LS * 100 * s.length) * f / 100 * SX * 1.02; }   // set width: condensed, tracked
  function splitWords(label) { return label.toUpperCase().split(" "); }
  function fits(words, f, availW, maxLines) {   // the fewest lines, then the most even ones, that all fit availW at size f; null if a word is too wide
    var n = words.length, best = null, mask, lines, j, cur, w, ok, maxW;
    for (mask = 0; mask < (1 << (n - 1)); mask++) {
      lines = []; cur = words[0];
      for (j = 1; j < n; j++) { if (mask & (1 << (j - 1))) { lines.push(cur); cur = words[j]; } else cur += " " + words[j]; }
      lines.push(cur);
      if (lines.length > maxLines) continue;
      ok = true; maxW = 0;
      for (j = 0; j < lines.length; j++) { w = tw(plain(lines[j]), f); if (w > availW) { ok = false; break; } if (w > maxW) maxW = w; }
      if (!ok) continue;
      if (!best || lines.length < best.lines.length || (lines.length === best.lines.length && maxW < best.maxW)) best = { lines: lines, maxW: maxW };
    }
    return best;
  }
  function bestSize(label, availW, availH, fmax) {   // the largest size at which the whole name fits
    var words = splitWords(label), f, r;
    for (f = fmax; f >= 5; f -= 0.25) {
      r = fits(words, f, availW, 4);
      if (r && r.lines.length * f * 1.12 <= availH) return f;
    }
    return 5;
  }
  var SIZES = null, SIGW = 0;
  function sizes() {   // one name size per side; no side more than 20% over the smallest, so the board stays tidy
    if (SIZES) return SIZES;
    var availW = W - 2 * PAD, raw = [99, 99, 99, 99], i, s, f;
    for (i = 0; i < 40; i++) {
      if (i % 10 === 0) continue;
      s = RECTS[i].side; f = bestSize(NAMES[i], availW, isBand(i) ? 62 : 56, 19);
      if (f < raw[s]) raw[s] = f;
    }
    var lo = Math.min(raw[0], raw[1], raw[2], raw[3]);
    SIZES = raw.map(function (v) { return Math.min(v, lo * 1.2); });
    SIGW = w100("MEDITERRANEAN", 800);
    return SIZES;
  }
  var BANDED = { 1: 1, 3: 1, 6: 1, 8: 1, 9: 1, 11: 1, 13: 1, 14: 1, 16: 1, 18: 1, 19: 1, 21: 1, 23: 1, 24: 1, 26: 1, 27: 1, 29: 1, 31: 1, 32: 1, 34: 1, 37: 1, 39: 1 };
  function isBand(i) { return !!BANDED[i]; }

  /* ---------------- art ---------------- */
  var K = "#0d1222";
  var ICONS = {   // 64 x 64, original drawings: ink green, brass and a little colour
    chance: '<path d="M22 25c0-8 6-12 11-12s11 4 11 10c0 5-3 7-7 10-3 2-4 4-4 8" fill="none" stroke="#6a2e0b" stroke-width="9" stroke-linecap="round" opacity=".25" transform="translate(1.5 2)"/><path d="M22 25c0-8 6-12 11-12s11 4 11 10c0 5-3 7-7 10-3 2-4 4-4 8" fill="none" stroke="#e0662a" stroke-width="8" stroke-linecap="round"/><path d="M25 21c1-4 4-6 8-6" fill="none" stroke="#ffd0a8" stroke-width="2.4" stroke-linecap="round"/><circle cx="33" cy="54" r="5.2" fill="#e0662a" stroke="#8c3a12" stroke-width="1.2"/>',
    chest: '<path d="M8 30c0-12 10-17 24-17s24 5 24 17z" fill="#3a63c8" stroke="' + K + '" stroke-width="1.8"/><rect x="8" y="30" width="48" height="23" rx="3" fill="#2a4aa8" stroke="' + K + '" stroke-width="1.8"/><rect x="8" y="28" width="48" height="4.5" fill="#d9ae4a" stroke="' + K + '" stroke-width="1.2"/><rect x="14" y="15" width="5" height="38" fill="#d9ae4a" opacity=".9"/><rect x="45" y="15" width="5" height="38" fill="#d9ae4a" opacity=".9"/><rect x="26.5" y="31" width="11" height="12" rx="2" fill="#f1cd6f" stroke="' + K + '" stroke-width="1.4"/><circle cx="32" cy="36" r="2.2" fill="' + K + '"/><path d="M32 37v4" stroke="' + K + '" stroke-width="1.6"/><path d="M13 20c5-3 11-4 17-4" stroke="#fff" stroke-width="2.4" stroke-linecap="round" opacity=".45" fill="none"/>',
    train: '<rect x="6" y="28" width="36" height="19" rx="3" fill="#1d3a2a" stroke="' + K + '" stroke-width="1.6"/><rect x="36" y="16" width="19" height="31" rx="2.5" fill="#2a5a3d" stroke="' + K + '" stroke-width="1.6"/><rect x="40" y="20" width="11" height="9" rx="1.5" fill="#cfe9ff" stroke="' + K + '" stroke-width="1.2"/><rect x="11" y="15" width="8" height="13" fill="#1d3a2a" stroke="' + K + '" stroke-width="1.6"/><rect x="9" y="12" width="12" height="4" rx="1.5" fill="#d9ae4a" stroke="' + K + '" stroke-width="1.2"/><rect x="4" y="44" width="52" height="4" fill="#d9ae4a" stroke="' + K + '" stroke-width="1.2"/><circle cx="16" cy="51" r="6" fill="#d9ae4a" stroke="' + K + '" stroke-width="1.6"/><circle cx="31" cy="51" r="6" fill="#d9ae4a" stroke="' + K + '" stroke-width="1.6"/><circle cx="46" cy="51" r="6" fill="#d9ae4a" stroke="' + K + '" stroke-width="1.6"/><circle cx="16" cy="51" r="1.8" fill="' + K + '"/><circle cx="31" cy="51" r="1.8" fill="' + K + '"/><circle cx="46" cy="51" r="1.8" fill="' + K + '"/><path d="M8 33h30" stroke="#fff" stroke-width="2" opacity=".28"/><path d="M58 47l-4-8v8z" fill="#d9ae4a" stroke="' + K + '" stroke-width="1"/>',
    bulb: '<path d="M32 6c-10 0-17 7-17 16 0 6 3 10 7 14 2 2 3 4 3 7h14c0-3 1-5 3-7 4-4 7-8 7-14 0-9-7-16-17-16z" fill="#ffe28a" stroke="' + K + '" stroke-width="1.8"/><path d="M26 24l6 8 6-8" fill="none" stroke="#b9791b" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M32 32v10" stroke="#b9791b" stroke-width="2"/><path d="M20 18c1-5 5-8 10-9" stroke="#fff" stroke-width="2.6" stroke-linecap="round" opacity=".7" fill="none"/><rect x="25" y="43" width="14" height="5" rx="1.5" fill="#9aa3b5" stroke="' + K + '" stroke-width="1.4"/><rect x="26" y="49" width="12" height="4.5" rx="1.5" fill="#7d879b" stroke="' + K + '" stroke-width="1.4"/><path d="M29 56h6" stroke="' + K + '" stroke-width="2.6" stroke-linecap="round"/>',
    tap: '<path d="M32 5C32 5 14 27 14 39a18 18 0 0 0 36 0C50 27 32 5 32 5z" fill="#3b86e0" stroke="' + K + '" stroke-width="1.8"/><path d="M22 41c0 6 3 10 9 11" stroke="#fff" stroke-width="3" stroke-linecap="round" opacity=".6" fill="none"/><path d="M30 15c-5 7-10 14-10 20" stroke="#bfe0ff" stroke-width="2.2" stroke-linecap="round" opacity=".7" fill="none"/>',
    coin: '<ellipse cx="32" cy="48" rx="20" ry="7" fill="#b8892f" stroke="' + K + '" stroke-width="1.6"/><rect x="12" y="38" width="40" height="10" fill="#d9ae4a"/><ellipse cx="32" cy="38" rx="20" ry="7" fill="#f1cd6f" stroke="' + K + '" stroke-width="1.6"/><path d="M12 38v10M52 38v10" stroke="' + K + '" stroke-width="1.6"/><circle cx="32" cy="26" r="19" fill="#e9bf55" stroke="' + K + '" stroke-width="1.8"/><circle cx="32" cy="26" r="14.5" fill="none" stroke="#a87a22" stroke-width="1.6"/><path d="M38 20c0-4-5-6-8-6s-7 2-7 6 5 5 9 6 7 3 7 6-4 6-8 6-8-2-8-6M31 11v30" fill="none" stroke="' + K + '" stroke-width="3.4" stroke-linecap="round" transform="translate(0 -.5) scale(1 .82) translate(0 6)"/><path d="M22 18c2-4 6-6 10-6" stroke="#fff" stroke-width="2.4" stroke-linecap="round" opacity=".6" fill="none"/>',
    ring: '<circle cx="32" cy="41" r="15" fill="none" stroke="#a87a22" stroke-width="8"/><circle cx="32" cy="41" r="15" fill="none" stroke="#f1cd6f" stroke-width="4.5"/><path d="M20 38c2-6 8-9 13-8" stroke="#fff" stroke-width="2" stroke-linecap="round" opacity=".7" fill="none"/><path d="M20 13h24l8 9-20 17L12 22z" fill="#8fdcff" stroke="' + K + '" stroke-width="1.8" stroke-linejoin="round"/><path d="M12 22h40M26 13l-4 9 10 17 10-17-4-9M22 22l10 17M42 22L32 39" fill="none" stroke="#fff" stroke-width="1.3" opacity=".85"/>',
    jail: '<rect x="8" y="8" width="48" height="48" rx="4" fill="#2c3550" stroke="' + K + '" stroke-width="2"/><rect x="13" y="13" width="38" height="38" rx="2" fill="#1a2036"/><g fill="#d3d9e6" stroke="' + K + '" stroke-width="1.1"><rect x="17" y="11" width="4.6" height="42" rx="2"/><rect x="25.4" y="11" width="4.6" height="42" rx="2"/><rect x="33.8" y="11" width="4.6" height="42" rx="2"/><rect x="42.2" y="11" width="4.6" height="42" rx="2"/></g><path d="M18.5 15v8M27 15v8M35.5 15v8M44 15v8" stroke="#fff" stroke-width="1.2" opacity=".6"/><rect x="11" y="31" width="42" height="4.6" rx="2" fill="#d3d9e6" stroke="' + K + '" stroke-width="1.1"/>',
    parking: '<rect x="6" y="6" width="52" height="52" rx="9" fill="#2a54b8" stroke="' + K + '" stroke-width="2"/><rect x="10" y="10" width="44" height="44" rx="6" fill="none" stroke="#9fbcff" stroke-width="1.4" opacity=".7"/><path d="M23 48V16h11c7 0 11 4 11 10s-4 10-11 10H23" fill="none" stroke="#fff" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/><path d="M14 13c6-3 14-3 22-3" stroke="#fff" stroke-width="2" stroke-linecap="round" opacity=".35" fill="none"/>',
    gotojail: '<path d="M32 4l22 8v18c0 14-10 24-22 30C20 54 10 44 10 30V12z" fill="#2a54b8" stroke="' + K + '" stroke-width="2" stroke-linejoin="round"/><path d="M32 10l16 6v14c0 10-7 18-16 23-9-5-16-13-16-23V16z" fill="none" stroke="#9fbcff" stroke-width="1.4" opacity=".8"/><path d="M32 18l4 9 10 1-7.5 6.5 2.5 10-9-5.5-9 5.5 2.5-10L18 28l10-1z" fill="#f1cd6f" stroke="' + K + '" stroke-width="1.4" stroke-linejoin="round"/>',
    arrow: '<path d="M60 22H26V10L4 32l22 22V42h34z" fill="#c1272d" stroke="#6e1218" stroke-width="2" stroke-linejoin="round"/><path d="M30 18h26" stroke="#fff" stroke-width="2.4" stroke-linecap="round" opacity=".4"/>',
    house: '<path d="M4 31L32 8l28 23h-8v22H12V31z" fill="#1f9d54" stroke="#fff" stroke-width="3.4" stroke-linejoin="round"/><path d="M4 31L32 8l28 23h-8v22H12V31z" fill="#1f9d54" stroke="#0a3d20" stroke-width="1.4" stroke-linejoin="round"/><rect x="27" y="36" width="10" height="17" fill="#0a3d20"/>',
    hotel: '<rect x="6" y="14" width="52" height="40" rx="3" fill="#d7263d" stroke="#fff" stroke-width="3.4"/><rect x="6" y="14" width="52" height="40" rx="3" fill="#d7263d" stroke="#6a0f1c" stroke-width="1.4"/><g fill="#ffe9ad"><rect x="13" y="21" width="8" height="8"/><rect x="28" y="21" width="8" height="8"/><rect x="43" y="21" width="8" height="8"/><rect x="13" y="35" width="8" height="8"/><rect x="43" y="35" width="8" height="8"/></g><rect x="27" y="36" width="10" height="18" fill="#6a0f1c"/>'
  };
  function icon(name, px, cls) { return '<svg class="mb-ic' + (cls ? " " + cls : "") + '" viewBox="0 0 64 64" width="' + (px || 24) + '" height="' + (px || 24) + '" aria-hidden="true" focusable="false">' + (ICONS[name] || "") + "</svg>"; }
  function iconFor(i) { return i === 2 || i === 17 || i === 33 ? "chest" : i === 7 || i === 22 || i === 36 ? "chance" : i % 10 === 5 ? "train" : i === 12 ? "bulb" : i === 28 ? "tap" : i === 4 ? "coin" : i === 38 ? "ring" : i === 10 ? "jail" : i === 20 ? "parking" : i === 30 ? "gotojail" : ""; }

  /* the eight pieces: a seat-coloured polished metal (gradient), dark outline, a bright edge and a soft contact shadow */
  var TOKART = {
    "Top Hat": function (F) { return '<ellipse cx="32" cy="49" rx="26" ry="7" fill="' + F + '" stroke="' + K + '" stroke-width="1.8"/><path d="M17 47V19Q17 9 25 9H39Q47 9 47 19V47Q32 54 17 47z" fill="' + F + '" stroke="' + K + '" stroke-width="1.8"/><path d="M17 37Q32 43 47 37V45Q32 51 17 45z" fill="#1a1f36" stroke="' + K + '" stroke-width="1"/><rect x="28.5" y="39" width="7" height="6.5" rx="1" fill="#f1cd6f" stroke="' + K + '" stroke-width="1"/><path d="M22 14V42" stroke="#fff" stroke-width="3.4" stroke-linecap="round" opacity=".5"/><ellipse cx="32" cy="10.5" rx="14" ry="2.6" fill="#fff" opacity=".28"/><path d="M8 47Q10 52 20 54" stroke="#fff" stroke-width="2" stroke-linecap="round" opacity=".4" fill="none"/>'; },
    "Race Car": function (F) { return '<path d="M3 46V40Q3 36 8 35L16 33L22 23Q24 20 28 20H40Q44 20 46 23L50 31L57 33Q62 34 62 39V46z" fill="' + F + '" stroke="' + K + '" stroke-width="1.8" stroke-linejoin="round"/><path d="M24 31L28 24H38Q40 24 41.5 26L44.5 31z" fill="#d6ecff" stroke="' + K + '" stroke-width="1.5" stroke-linejoin="round"/><path d="M33 24V31" stroke="' + K + '" stroke-width="1.4"/><path d="M5 41H60" stroke="#101426" stroke-width="2.2" opacity=".5"/><path d="M9 37.5L17 35.5" stroke="#fff" stroke-width="2.2" stroke-linecap="round" opacity=".65"/><rect x="2" y="30" width="9" height="3" rx="1" fill="#101426"/><circle cx="17" cy="47" r="7.5" fill="#101426" stroke="' + K + '" stroke-width="1.5"/><circle cx="17" cy="47" r="3.2" fill="#c8cfdc"/><circle cx="48" cy="47" r="7.5" fill="#101426" stroke="' + K + '" stroke-width="1.5"/><circle cx="48" cy="47" r="3.2" fill="#c8cfdc"/>'; },
    "Dog": function (F) { return '<path d="M13 29Q4 26 6 15" fill="none" stroke="' + K + '" stroke-width="7.4" stroke-linecap="round"/><path d="M13 29Q4 26 6 15" fill="none" stroke="' + F + '" stroke-width="4.2" stroke-linecap="round"/><rect x="15" y="40" width="7" height="15" rx="2.5" fill="' + F + '" stroke="' + K + '" stroke-width="1.6"/><rect x="26" y="41" width="7" height="14" rx="2.5" fill="' + F + '" stroke="' + K + '" stroke-width="1.6"/><rect x="38" y="41" width="7" height="14" rx="2.5" fill="' + F + '" stroke="' + K + '" stroke-width="1.6"/><rect x="47" y="40" width="7" height="15" rx="2.5" fill="' + F + '" stroke="' + K + '" stroke-width="1.6"/><rect x="11" y="26" width="43" height="19" rx="9.5" fill="' + F + '" stroke="' + K + '" stroke-width="1.8"/><circle cx="50" cy="22" r="9.5" fill="' + F + '" stroke="' + K + '" stroke-width="1.8"/><rect x="52" y="21" width="10" height="8.5" rx="3.5" fill="' + F + '" stroke="' + K + '" stroke-width="1.6"/><path d="M43 11L50 4L52 14z" fill="#1a1f36" stroke="' + K + '" stroke-width="1.2" stroke-linejoin="round"/><circle cx="52.5" cy="19.5" r="1.7" fill="' + K + '"/><circle cx="60.6" cy="24" r="2.2" fill="' + K + '"/><path d="M55 31L58 36L60 31" fill="#1a1f36" stroke="' + K + '" stroke-width="1"/><path d="M17 31Q28 28 40 31" stroke="#fff" stroke-width="2.6" stroke-linecap="round" opacity=".5" fill="none"/>'; },
    "Battleship": function (F) { return '<path d="M2 38H62L55 51H10z" fill="' + F + '" stroke="' + K + '" stroke-width="1.8" stroke-linejoin="round"/><rect x="13" y="30" width="38" height="8" rx="1.5" fill="' + F + '" stroke="' + K + '" stroke-width="1.6"/><rect x="25" y="20" width="15" height="10" rx="1.5" fill="' + F + '" stroke="' + K + '" stroke-width="1.6"/><rect x="30" y="9" width="5" height="11" fill="' + F + '" stroke="' + K + '" stroke-width="1.4"/><rect x="42" y="22" width="6.5" height="8" fill="#1a1f36" stroke="' + K + '" stroke-width="1.2"/><rect x="4" y="32" width="14" height="3.4" rx="1.4" fill="#1a1f36" stroke="' + K + '" stroke-width="1"/><rect x="46" y="32" width="14" height="3.4" rx="1.4" fill="#1a1f36" stroke="' + K + '" stroke-width="1"/><g fill="#d6ecff" stroke="' + K + '" stroke-width=".8"><circle cx="18" cy="43" r="1.8"/><circle cx="26" cy="43" r="1.8"/><circle cx="34" cy="43" r="1.8"/><circle cx="42" cy="43" r="1.8"/></g><path d="M5 55Q13 51 21 55T37 55T53 55T61 54" stroke="#bfe0ff" stroke-width="2" stroke-linecap="round" fill="none" opacity=".75"/><path d="M8 40H55" stroke="#fff" stroke-width="2" opacity=".4"/>'; },
    "Boot": function (F) { return '<path d="M20 7H39V31Q39 35 44 37L56 41Q62 43 62 49V54H20z" fill="' + F + '" stroke="' + K + '" stroke-width="1.8" stroke-linejoin="round"/><rect x="20" y="7" width="19" height="7" fill="#1a1f36" stroke="' + K + '" stroke-width="1.2"/><path d="M20 48H62V54H20z" fill="#1a1f36" stroke="' + K + '" stroke-width="1.2"/><rect x="20" y="45" width="12" height="9" fill="#1a1f36" stroke="' + K + '" stroke-width="1.2"/><g stroke="#1a1f36" stroke-width="2" stroke-linecap="round"><path d="M27 19H36M27 24H36M28 29H37"/></g><path d="M24 15V43" stroke="#fff" stroke-width="3" stroke-linecap="round" opacity=".5"/><path d="M45 41L57 45" stroke="#fff" stroke-width="2" stroke-linecap="round" opacity=".45"/>'; },
    "Thimble": function (F) { return '<path d="M16 53L20 25Q21 10 32 10Q43 10 44 25L48 53Q32 59 16 53z" fill="' + F + '" stroke="' + K + '" stroke-width="1.8" stroke-linejoin="round"/><path d="M14 54Q32 61 50 54V48Q32 54 14 48z" fill="' + F + '" stroke="' + K + '" stroke-width="1.8" stroke-linejoin="round"/><g fill="#101426" opacity=".55"><circle cx="27" cy="19" r="1.7"/><circle cx="37" cy="19" r="1.7"/><circle cx="32" cy="25" r="1.7"/><circle cx="24" cy="29" r="1.7"/><circle cx="40" cy="29" r="1.7"/><circle cx="32" cy="35" r="1.7"/><circle cx="22" cy="40" r="1.7"/><circle cx="42" cy="40" r="1.7"/><circle cx="32" cy="44" r="1.7"/></g><path d="M23 18Q22 30 25 46" stroke="#fff" stroke-width="3.2" stroke-linecap="round" opacity=".5" fill="none"/>'; },
    "Wheelbarrow": function (F) { return '<path d="M9 21L5 42" stroke="' + K + '" stroke-width="5.4" stroke-linecap="round"/><path d="M9 21L5 42" stroke="#c9ced9" stroke-width="3" stroke-linecap="round"/><path d="M20 38L16 56" stroke="' + K + '" stroke-width="5" stroke-linecap="round"/><path d="M20 38L16 56" stroke="#c9ced9" stroke-width="2.8" stroke-linecap="round"/><path d="M38 38L36 56" stroke="' + K + '" stroke-width="5" stroke-linecap="round"/><path d="M38 38L36 56" stroke="#c9ced9" stroke-width="2.8" stroke-linecap="round"/><path d="M42 33L50 44" stroke="' + K + '" stroke-width="5" stroke-linecap="round"/><path d="M42 33L50 44" stroke="#c9ced9" stroke-width="2.8" stroke-linecap="round"/><path d="M7 17H47L41 39H15z" fill="' + F + '" stroke="' + K + '" stroke-width="1.8" stroke-linejoin="round"/><path d="M9 21H45" stroke="#fff" stroke-width="2.4" stroke-linecap="round" opacity=".55"/><path d="M13 29L16 36" stroke="#101426" stroke-width="1.6" opacity=".4"/><circle cx="52" cy="46" r="9" fill="#101426" stroke="' + K + '" stroke-width="1.6"/><circle cx="52" cy="46" r="3.6" fill="#c8cfdc"/>'; },
    "Horse & Rider": function (F) { return '<path d="M12 31Q3 33 4 46Q8 40 14 40z" fill="#1a1f36" stroke="' + K + '" stroke-width="1.4" stroke-linejoin="round"/><path d="M18 41L16 57M26 44L26 57M38 44L40 57M46 40L51 57" stroke="' + K + '" stroke-width="7" stroke-linecap="round"/><path d="M18 41L16 57M26 44L26 57M38 44L40 57M46 40L51 57" stroke="' + F + '" stroke-width="4.2" stroke-linecap="round"/><ellipse cx="30" cy="38" rx="19" ry="9.5" fill="' + F + '" stroke="' + K + '" stroke-width="1.8"/><path d="M41 34L44 20L47 12L56 14L61 22L55 24L52 38z" fill="' + F + '" stroke="' + K + '" stroke-width="1.8" stroke-linejoin="round"/><path d="M45 14L40 24L43 36" fill="none" stroke="#1a1f36" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"/><circle cx="54.5" cy="17.5" r="1.5" fill="' + K + '"/><path d="M22 14L23 29L35 29L36 14z" fill="#1a1f36" stroke="' + K + '" stroke-width="1.4" stroke-linejoin="round"/><circle cx="29" cy="9.5" r="5" fill="' + F + '" stroke="' + K + '" stroke-width="1.6"/><path d="M24 7Q29 2 34 7" fill="#1a1f36" stroke="' + K + '" stroke-width="1"/><path d="M20 35Q30 31 41 35" stroke="#fff" stroke-width="2.4" stroke-linecap="round" opacity=".5" fill="none"/>'; }
  };
  var TOKEN_NAMES = ["Top Hat", "Race Car", "Dog", "Battleship", "Boot", "Thimble", "Wheelbarrow", "Horse & Rider"];
  function tokenSVG(name, seat, px, cls) {
    var art = TOKART[name] || TOKART["Top Hat"], s = SEATS[seat] || SEATS[1], id = "mbg" + (++uid);
    return '<svg class="mb-tkv' + (cls ? " " + cls : "") + '" viewBox="0 0 64 64"' + (px ? ' width="' + px + '" height="' + px + '"' : "") + ' aria-hidden="true" focusable="false"><defs><linearGradient id="' + id + '" x1=".1" y1="0" x2=".9" y2="1"><stop offset="0" stop-color="' + s.hi + '"/><stop offset=".48" stop-color="' + s.c + '"/><stop offset="1" stop-color="' + s.lo + '"/></linearGradient></defs><ellipse cx="32" cy="58.5" rx="21" ry="3.2" fill="#000" opacity=".3"/>' + art("url(#" + id + ")") + "</svg>";
  }

  /* ---------------- the static board ---------------- */
  var NB = [];   // per square: where its name block ends (units from the inner edge): the mortgage tag goes below it
  function textLines(lines, f, x, y0, cls, fill) {   // condensed caps, centred on x, one <text> per line (y0 = the first line's cap top)
    var out = "", lh = f * 1.12, k;
    for (k = 0; k < lines.length; k++) out += '<text class="' + cls + '" transform="translate(' + r2(x) + " " + r2(y0 + f * 0.74 + k * lh) + ") scale(" + SX + ' 1)" text-anchor="middle" font-size="' + r2(f) + '"' + (fill ? ' style="fill:' + fill + '"' : "") + ">" + esc(lines[k]) + "</text>";
    return out;
  }
  function capText(txt, f, x, y, rot, fill) {   // one line of condensed caps whose caps are CENTRED on (x, y), turned rot degrees
    return '<text class="mb-nm" transform="translate(' + r2(x) + " " + r2(y) + ")" + (rot ? " rotate(" + rot + ")" : "") + " translate(0 " + r2(f * 0.37) + ") scale(" + SX + ' 1)" text-anchor="middle" font-size="' + r2(f) + '"' + (fill ? ' style="fill:' + fill + '"' : "") + ">" + esc(txt) + "</text>";
  }
  function fitSize(txt, room, fmax) { return Math.min(fmax, Math.floor(room / tw(plain(txt), 1) * 4) / 4); }   // the largest size (in quarters) that fits room
  function nameBlock(i, f, y0) { var r = fits(splitWords(NAMES[i]), f, W - 2 * PAD, 4) || { lines: splitWords(NAMES[i]) }; return { svg: textLines(r.lines, f, W / 2, y0, "mb-nm"), h: r.lines.length * f * 1.12 }; }
  function iconAt(name, x, y, sz) { return '<g transform="translate(' + r2(x) + " " + r2(y) + ") scale(" + r2(sz / 64) + ')">' + ICONS[name] + "</g>"; }
  function priceText(txt, size, y, fill) { return '<text class="mb-pr" x="' + W / 2 + '" y="' + r2(y) + '" text-anchor="middle" font-size="' + r2(size) + '" fill="' + fill + '">' + esc(txt) + "</text>"; }
  function cornerArt(i) {
    var inner = "", f1, f2;
    if (i === 0) {   // GO: the board's outer edges are its right and bottom sides (the rim), so the lines stay within 118 units
      f1 = fitSize("COLLECT $200", 118, 17); f2 = fitSize("SALARY AS YOU PASS", 118, 13);
      inner += capText("COLLECT $200", f1, D / 2, 11 + f1 * 0.37, 0) + capText("SALARY AS YOU PASS", f2, D / 2, 16 + f1 * 0.74 + f2 * 0.37, 0);
      inner += '<text class="mb-go" x="' + D / 2 + '" y="98" text-anchor="middle" font-size="62" fill="#c1272d">GO</text>';
      inner += '<g transform="translate(24 107) scale(1.31 .4)">' + ICONS.arrow + '</g>';
    } else if (i === 10) {   // as on the real board: the cell (In Jail) toward the middle, "Just" down the left strip and "Visiting" along the
      // bottom one: the L where visitors stand (jailed pieces are drawn in the cell, visitors on the L)
      inner += '<rect class="mb-cell" x="44" y="6" width="90" height="90" rx="6" fill="#f08a2c" stroke="' + K + '" stroke-width="2.4"/><rect x="47.5" y="9.5" width="83" height="83" rx="4" fill="none" stroke="#fff" stroke-opacity=".38" stroke-width="1.2"/>';
      inner += capText("IN JAIL", 13.5, 89, 18.5, 0) + iconAt("jail", 59, 29, 60);
      inner += capText("JUST", 15, 26.5, 52, 90) + capText("VISITING", 15, 87, 113.5, 0);
    } else if (i === 20) {
      inner += textLines(["FREE"], 21, D / 2, 10, "mb-nm") + iconAt("parking", 36, 32, 68) + textLines(["PARKING"], 21, D / 2, 108, "mb-nm");
    } else {
      inner += textLines(["GO TO"], 21, D / 2, 10, "mb-nm") + iconAt("gotojail", 36, 32, 68) + textLines(["JAIL"], 21, D / 2, 108, "mb-nm");
    }
    return inner;
  }
  function deckSpot(x, y, rot, kind) {   // a card place in the middle as on the real board: a dashed tray with the deck's icon and name
    var w = 196, h = 124, ch = kind === "chance";
    return '<g class="mb-deck" transform="translate(' + x + " " + y + ") rotate(" + rot + ')"><rect x="' + (-w / 2) + '" y="' + (-h / 2) + '" width="' + w + '" height="' + h + '" rx="12" fill="' + (ch ? "#fde5cc" : "#dbe7fb") + '" fill-opacity=".72" stroke="' + INK + '" stroke-opacity=".42" stroke-width="2" stroke-dasharray="8 6"/>' +
      iconAt(ch ? "chance" : "chest", -27, -41, 54) + capText(ch ? "CHANCE" : "COMMUNITY CHEST", 18, 0, 30, 0) + "</g>";
  }
  function staticSVG(amt) {
    var sz = sizes(), out = "", i, r, f, pr, nb, y, nm;
    out += '<svg class="mb-svg" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + S + " " + S + '" preserveAspectRatio="xMidYMid meet" text-rendering="geometricPrecision" role="img" aria-label="The Monopoly board">';
    out += '<defs><radialGradient id="mbFld" cx="50%" cy="46%" r="75%"><stop offset="0" stop-color="#e3f2e4"/><stop offset=".6" stop-color="' + FIELD + '"/><stop offset="1" stop-color="#b6d6bd"/></radialGradient>' +
      '<linearGradient id="mbSq" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset=".5" stop-color="' + PAPER + '"/><stop offset="1" stop-color="#e8f1e1"/></linearGradient>' +
      '<linearGradient id="mbSh" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".42"/><stop offset=".5" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".16"/></linearGradient>' +
      '<pattern id="mbHatch" width="10" height="10" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="3.2" height="10" fill="#0b0e1a" opacity=".26"/></pattern></defs>';
    out += '<rect width="' + S + '" height="' + S + '" fill="url(#mbFld)"/>';
    // the middle: fine gold guilloche rings and a soft glow behind the plate (the plate itself is HTML)
    for (i = 0; i < 6; i++) out += '<rect x="' + (D + 14 + i * 22) + '" y="' + (D + 14 + i * 22) + '" width="' + (9 * W - 28 - i * 44) + '" height="' + (9 * W - 28 - i * 44) + '" rx="' + (26 - i * 3) + '" fill="none" stroke="' + GOLD + '" stroke-width="1.4" opacity="' + r2(0.22 - i * 0.025) + '"/>';
    // the two card places of the real board, turned to face their corners: Community Chest up-left, Chance down-right
    out += deckSpot(275, 275, -45, "chest") + deckSpot(S - 275, S - 275, 135, "chance");
    for (i = 0; i < 40; i++) {
      r = RECTS[i]; out += '<g class="sp msp" data-i="' + i + '" transform="' + sqXf(i) + '">';
      if (r.corner) {
        out += '<rect width="' + D + '" height="' + D + '" fill="url(#mbSq)" stroke="' + LINE + '" stroke-width="1.8"/>' + cornerArt(i) + "</g>"; continue;
      }
      out += '<rect width="' + W + '" height="' + D + '" fill="url(#mbSq)" stroke="' + LINE + '" stroke-width="1.8"/>';
      f = sz[r.side];
      if (isBand(i)) {
        out += '<rect class="mb-band" data-band="' + i + '" width="' + W + '" height="30" fill="#888"/><rect width="' + W + '" height="30" fill="url(#mbSh)"/><path d="M0 30H' + W + '" stroke="' + K + '" stroke-opacity=".55" stroke-width="1.6"/>';
        nb = nameBlock(i, f, 37); out += nb.svg; NB[i] = 37 + nb.h;
      } else {
        nb = nameBlock(i, f, 11); out += nb.svg; NB[i] = 11 + nb.h;
        // the icon fills the room between the name and the price strip (tax squares keep room for a two-line amount, "PAY 10% / OR $200")
        var ic = iconFor(i), top = 11 + nb.h + 4, room = (i % 10 === 5 || i === 12 || i === 28 ? 106 : i === 4 || i === 38 ? 103 : 110) - top, isz = Math.max(26, Math.min(56, room));
        if (ic) out += iconAt(ic, (W - isz) / 2, top + Math.max(0, (room - isz) / 2), isz);
      }
      out += "</g>";
    }
    // the rim: a deep green edge with a brass line inside it
    out += '<rect x="2" y="2" width="' + (S - 4) + '" height="' + (S - 4) + '" fill="none" stroke="#0f3d24" stroke-width="6"/><rect x="7" y="7" width="' + (S - 14) + '" height="' + (S - 14) + '" fill="none" stroke="' + GOLD + '" stroke-width="1.6" opacity=".8"/>';
    out += '<g id="mbDyn"></g></svg>';
    return out;
  }

  /* per-square dynamic art: the price strip (in the owner's seat colour when owned), the price or amount, houses, mortgage.
     A mortgaged square takes a light hatch (its name still reads through it) and a "Mortgaged" tag in the free room under its name; the
     colour band and the owner's strip stay clean (review: the old dark hatch and the tag on the band hid the name and the group) */
  function amtSVG(txt, pf, fill) {   // a tax amount, on one line, or two when the house rule's long text needs it ("PAY 10% / OR $200")
    var room = W - 2 * PAD - 4, one = Math.min(pf, 14, room / (w100(plain(txt), 800) / 100)), a, f2;
    if (one >= 11 || txt.indexOf(" OR ") < 0) return priceText(txt, one, D - 12.5, fill);
    a = txt.split(" OR "); f2 = Math.min(12, room / (Math.max(w100(a[0], 800), w100("OR " + a[1], 800)) / 100));
    return priceText(a[0], f2, D - 12.5 - f2 * 1.12, fill) + priceText("OR " + a[1], f2, D - 12.5, fill);
  }
  function dynSVG(i, st, amtTxt) {
    var s = BUY[i], r = RECTS[i], own = st.own && st.own[i], sc = own ? (SEATS[own] || SEATS[1]) : null, h = st.houses ? st.houses[i] | 0 : 0, mo = st.mort && st.mort[i], out = "", k, x0;
    if (r.corner) return "";
    var f = sizes()[r.side], pf = Math.min(19, f * 1.45), top = D - STRIP, fill = sc ? "#0b0a12" : INK;
    if (mo) out += '<rect class="mb-mort" width="' + W + '" height="' + top + '" fill="url(#mbHatch)"/>';
    if (s || amtTxt) {
      if (sc) out += '<rect class="mb-own" y="' + top + '" width="' + W + '" height="' + STRIP + '" fill="' + sc.c + '"/><path d="M0 ' + top + 'H' + W + '" stroke="' + K + '" stroke-opacity=".55" stroke-width="1.4"/>';
      else if (mo) out += '<rect class="mb-mort" y="' + top + '" width="' + W + '" height="' + STRIP + '" fill="url(#mbHatch)"/>';
      out += amtTxt ? amtSVG(amtTxt, pf, fill) : priceText("$" + s.price, pf, D - 12.5, fill);
    }
    if (isBand(i) && h > 0) {
      if (h === 5) out += '<g transform="translate(' + (W / 2 - 22) + " 4) scale(" + r2(44 / 64) + " " + r2(22 / 64) + ')">' + ICONS.hotel + "</g>";
      else { x0 = W / 2 - h * 11.5; for (k = 0; k < h; k++) out += '<g transform="translate(' + r2(x0 + k * 23) + " 5) scale(" + r2(21 / 64) + " " + r2(20 / 64) + ')">' + ICONS.house + "</g>"; }
    }
    if (mo) {
      var nb = NB[i] || 60, cy = Math.max(nb + 11, Math.min(top - 11, (nb + top) / 2));
      out += '<rect class="mb-mtag" x="8" y="' + r2(cy - 10) + '" width="' + (W - 16) + '" height="20" rx="4" fill="#0b0e1a" opacity=".9"/>' + capText("MORTGAGED", 12.5, W / 2, cy, 0, "#f6f1e7");
    }
    return out ? '<g transform="' + sqXf(i) + '">' + out + "</g>" : "";
  }
  var BUY = {};   // set from the page's squares: {price} for the squares that can be bought
  function paintBands(host, squares) {
    var els = host.querySelectorAll("[data-band]"), k, i, s;
    for (k = 0; k < els.length; k++) { i = +els[k].getAttribute("data-band"); s = squares[i]; els[k].setAttribute("fill", (s && GROUPS[s.g] ? GROUPS[s.g].c : "#888")); }
  }

  /* ---------------- the Luxe plate (the board's middle) ---------------- */
  function plateHTML(emblem) {
    if (emblem) return '<div class="mb-plate"><span class="bg-emblem"></span><span class="mb-word bg-gold">Monopoly</span></div>';
    return '<div class="mb-plate"><svg class="mb-mark" viewBox="0 0 64 64" aria-hidden="true"><defs><linearGradient id="mbMk" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fcf5e3"/><stop offset=".5" stop-color="#d5af6d"/><stop offset="1" stop-color="#8a6633"/></linearGradient></defs><path d="M32 4 60 32 32 60 4 32z" fill="none" stroke="url(#mbMk)" stroke-width="3.4" stroke-linejoin="round"/><g fill="url(#mbMk)"><circle cx="32" cy="32" r="3.6"/><circle cx="22" cy="22" r="3.2"/><circle cx="42" cy="22" r="3.2"/><circle cx="22" cy="42" r="3.2"/><circle cx="42" cy="42" r="3.2"/></g></svg><span class="mb-word">Monopoly</span></div>';
  }

  /* ---------------- the inspector card (a square, large) ---------------- */
  function money(n) { return "$" + n; }
  function card(i, o) {   // o = {sq, owner:{name,seat}|null, houses, mort, now, desc}: HTML for the phone sheet and the TV column
    o = o || {}; var tag = o.tag || "h3", s = o.sq || {}, grp = GROUPS[s.g], r = RECTS[i], nm = plain(NAMES[i]), ic = iconFor(i), h = "";
    h += '<div class="mbi' + (grp ? "" : " mbi--plain") + '"' + (grp ? ' style="--grp:' + grp.c + '"' : "") + '><div class="mbi__head">' + (ic ? '<span class="mbi__ic">' + icon(ic, 40) + "</span>" : "") + '<' + tag + ' class="mbi__name"' + (o.id ? ' id="' + o.id + '"' : "") + '>' + esc(nm) + "</" + tag + "></div>";
    var meta = [];
    if (grp) meta.push('<span class="mbi__chip"><i style="background:' + grp.c + '"></i>' + grp.n + "</span>");
    if (s.price) meta.push('<span class="mbi__chip">Price <b>' + money(s.price) + "</b></span>");
    if (o.amt) meta.push('<span class="mbi__chip"><b>' + esc(o.amt) + "</b></span>");
    if (meta.length) h += '<div class="mbi__meta">' + meta.join("") + "</div>";
    if (o.rents === false) { } else if (s.t === "prop" && s.rent) {
      h += '<dl class="mbi__rents"><div><dt>Rent</dt><dd>' + money(s.rent[0]) + "</dd></div>";
      for (var k = 1; k <= 4; k++) h += "<div><dt>" + k + (k === 1 ? " house" : " houses") + "</dt><dd>" + money(s.rent[k]) + "</dd></div>";
      h += "<div><dt>Hotel</dt><dd>" + money(s.rent[5]) + "</dd></div><div><dt>House cost</dt><dd>" + money(s.house) + "</dd></div><div><dt>Mortgage</dt><dd>" + money(s.mort) + "</dd></div></dl>";
    } else if (s.t === "rr") h += '<dl class="mbi__rents"><div><dt>1 railroad</dt><dd>$25</dd></div><div><dt>2 railroads</dt><dd>$50</dd></div><div><dt>3 railroads</dt><dd>$100</dd></div><div><dt>4 railroads</dt><dd>$200</dd></div><div><dt>Mortgage</dt><dd>$100</dd></div></dl>';
    else if (s.t === "util") h += '<p class="mbi__desc">One utility: rent is 4 times the dice. Both: 10 times the dice.</p><dl class="mbi__rents"><div><dt>Mortgage</dt><dd>$75</dd></div></dl>';
    else if (o.desc) h += '<p class="mbi__desc">' + esc(o.desc) + "</p>";
    var st = [];
    if (s.price) {
      st.push(o.owner ? '<span class="mbi__own" style="--oc:' + (SEATS[o.owner.seat] || SEATS[1]).c + '"><i></i>' + esc(o.owner.name) + " owns it</span>" : '<span class="mbi__own mbi__own--none">Unowned</span>');
      if (s.t === "prop" && o.owner) st.push('<span class="mbi__st">' + (o.houses === 5 ? "Hotel" : o.houses ? o.houses + (o.houses === 1 ? " house" : " houses") : "No houses") + "</span>");
      if (o.mort) st.push('<span class="mbi__st mbi__st--bad">Mortgaged</span>');
      if (o.now != null && o.owner && !o.mort) st.push('<span class="mbi__st">Rent now ' + money(o.now) + "</span>");
    }
    if (st.length) h += '<div class="mbi__state">' + st.join("") + "</div>";
    return h + "</div>";
  }

  /* ---------------- CSS (injected once) ---------------- */
  var CSS = ".mb{position:relative;overflow:hidden;border-radius:inherit;user-select:none;-webkit-user-select:none;-webkit-tap-highlight-color:transparent;outline:none;touch-action:none;background:#0f3d24}" +
    ".mb.is-gesture .mb-stage{will-change:transform}" +
    ".mb-stage{position:absolute;left:0;top:0;width:100%;height:100%;transform-origin:0 0}.mb-stage.is-glide{transition:transform .2s cubic-bezier(.2,.7,.2,1)}" +
    "html[data-effects=reduced] .mb-stage.is-glide,html[data-motion=reduce] .mb-stage.is-glide{transition:none}" +
    ".mb-svg{position:absolute;left:0;top:0;width:100%;height:100%;display:block}" +
    ".mb-nm{font-family:" + FONT + ";font-weight:800;letter-spacing:" + LS + "em;fill:" + INK + "}.mb-pr{font-family:" + FONT + ";font-weight:800;font-variant-numeric:tabular-nums}.mb-go{font-family:'DM Serif Display',Georgia,serif;font-weight:400}" +
    ".mb-center{position:absolute;left:" + (D / S * 100) + "%;top:" + (D / S * 100) + "%;width:" + (9 * W / S * 100) + "%;height:" + (9 * W / S * 100) + "%;display:grid;place-items:center;pointer-events:none}" +
    ".mb-center>.mb-plate,.mb-center>.mb-cw{pointer-events:none}" +
    ".mb-plate{display:grid;justify-items:center;gap:calc(var(--mb-u,4px)*1.678);padding:calc(var(--mb-u,4px)*4.119) calc(var(--mb-u,4px)*8.39) calc(var(--mb-u,4px)*4.576);border-radius:calc(var(--mb-u,4px)*4.958);background:radial-gradient(120% 95% at 50% 0%,#1d6b45 0%,var(--accent-deep,#06391f) 58%,#031b0e 100%);box-shadow:inset 0 0 0 1px rgba(230,201,143,.6),inset 0 0 0 calc(var(--mb-u,4px)*1.525) rgba(4,6,16,.22),inset 0 0 0 calc(calc(var(--mb-u,4px)*1.525) + 1px) rgba(230,201,143,.25),0 calc(var(--mb-u,4px)*3.051) calc(var(--mb-u,4px)*6.864) -calc(var(--mb-u,4px)*3.814) rgba(0,0,0,.65)}" +
    ".mb-plate .bg-emblem{width:calc(var(--mb-u,4px)*12.966);height:calc(var(--mb-u,4px)*12.966)}.bg-token .mb-tkv{width:78%;height:78%;display:block;overflow:visible}.mb-mark{width:calc(var(--mb-u,4px)*12.966);height:calc(var(--mb-u,4px)*12.966);display:block}.mb-word{font:400 calc(var(--mb-u,4px)*9.152)/1 var(--font-display,'DM Serif Display',Georgia,serif);letter-spacing:-.01em;color:var(--gold-100,#f4e3b8)}" +
    ".mb-toks,.mb-marks{position:absolute;left:0;top:0;width:100%;height:100%;pointer-events:none;contain:layout}" +
    // a piece: a box of its own size (set when its square's slots change), placed by its transform only, so a move glides on the
    // compositor (no left/top: transform only); at rest the box is drawn 1:1, as the pulse's layer expects (no scale)
    ".mb-pos{position:absolute;left:0;top:0;z-index:3}.mb-anim .mb-pos{transition:transform .15s linear}" +
    "html[data-effects=reduced] .mb-pos,html[data-motion=reduce] .mb-pos{transition:none !important}" +
    ".mb-pos .tkp,.mb-pos .tk{display:block;width:100%;height:100%}.mb-pos .tk{filter:drop-shadow(0 0 1px var(--pc,#000)) drop-shadow(0 .06em .08em #0009)}.mb-pos .mb-tkv{display:block;width:100%;height:100%;overflow:visible}" +
    ".mb-hl,.mb-fs{position:absolute;box-sizing:border-box;pointer-events:none;display:none}" +
    ".mb-hl{border:calc(var(--mb-u,4px)*.55) solid #ffe3a0;box-shadow:0 0 0 calc(var(--mb-u,4px)*.2) #0b0e1a,0 0 calc(var(--mb-u,4px)*2.2) calc(var(--mb-u,4px)*.6) rgba(255,214,120,.8),inset 0 0 calc(var(--mb-u,4px)*2.4) rgba(255,214,120,.55);z-index:2}" +
    ".mb-fs{border:calc(var(--mb-u,4px)*.8) solid #fbf6ea;box-shadow:0 0 0 calc(var(--mb-u,4px)*.5) #0b0e1a,0 0 calc(var(--mb-u,4px)*3) calc(var(--mb-u,4px)*1) rgba(255,228,160,.9);z-index:4}" +
    ".mb-ctl{position:absolute;left:50%;bottom:17.5%;transform:translateX(-50%);z-index:6;display:inline-flex;align-items:center;justify-content:center;gap:.4em;min-width:44px;min-height:44px;padding:0 1em;border:0;border-radius:999px;font:700 14px/1 " + FONT + ";color:#f6f1e7;background:rgba(8,10,21,.86);box-shadow:inset 0 0 0 1px rgba(231,202,144,.7),0 4px 12px rgba(0,0,0,.5);cursor:pointer;touch-action:manipulation}" +
    ".mb.is-zoomed .mb-ctl{left:auto;right:10px;bottom:10px;transform:none;background:#e7ca90;color:#1a1306;box-shadow:0 4px 12px rgba(0,0,0,.55)}" +
    "html[data-tv] .mb-ctl{display:none}.mb-ctl svg{width:18px;height:18px}" +
    ".mbi{color:var(--text-1,#f6f1e7);display:grid;gap:.5rem}.mbi__head{display:flex;align-items:center;gap:.75rem;padding:.2rem 0 .1rem;border-bottom:.4rem solid var(--grp,#e7ca90);padding-bottom:.6rem}.mbi--plain .mbi__head{border-bottom-color:var(--gold-300,#d5af6d)}" +
    ".mbi__name{margin:0;font:400 var(--fs-3xl,2rem)/1.05 var(--font-display,Georgia,serif);letter-spacing:-.01em;text-transform:uppercase}.mbi__ic{flex:none;display:grid;place-items:center}" +
    ".mbi__meta,.mbi__state{display:flex;flex-wrap:wrap;gap:.4rem .5rem}.mbi__chip,.mbi__st,.mbi__own{display:inline-flex;align-items:center;gap:.4rem;padding:.25rem .65rem;border-radius:999px;font:var(--fw-ui,600) var(--fs-sm,1rem)/1.2 var(--font-ui,sans-serif);background:var(--ink-2,#11162a);box-shadow:inset 0 0 0 1px var(--line-2,#2a3150);color:var(--text-1,#f6f1e7)}" +
    ".mbi__chip i{width:.9em;height:.9em;border-radius:3px;box-shadow:0 0 0 1px rgba(255,255,255,.4)}.mbi__own i{width:.9em;height:.9em;border-radius:50%;background:var(--oc);box-shadow:0 0 0 2px var(--ink-1,#080a15),0 0 0 3px rgba(255,255,255,.3)}" +
    ".mbi__st--bad{color:var(--danger-text,#ff8a93)}.mbi__rents{display:grid;grid-template-columns:repeat(var(--mbi-cols,2),1fr);gap:.05rem 1.25rem;margin:0}.mbi__rents div{display:flex;justify-content:space-between;gap:.5rem;padding:.15rem 0;font:var(--fw-body,500) var(--fs-sm,1rem)/1.25 var(--font-ui,sans-serif)}" +
    ".mbi__rents dt{color:var(--text-2,#cfc8d8)}.mbi__rents dd{margin:0;font-weight:var(--fw-caps,800);font-variant-numeric:tabular-nums}.mbi__desc{margin:0;font:var(--fw-body,500) var(--fs-sm,1rem)/1.35 var(--font-ui,sans-serif);color:var(--text-2,#cfc8d8)}";
  function injectCSS() {
    if (document.getElementById("mb-style")) return;
    var st = document.createElement("style"); st.id = "mb-style"; st.textContent = CSS;
    var base = ""; try { var cs = document.currentScript || g.__mbScript; if (cs && cs.src) base = cs.src.replace(/[^\/]*$/, ""); } catch (e) { }
    if (base && !document.querySelector('link[href*="theme.css"]')) st.textContent = "@font-face{font-family:'Manrope';src:url('" + base + "../ui/fonts/manrope-var-latin.woff2') format('woff2');font-weight:200 800;font-display:swap}@font-face{font-family:'DM Serif Display';src:url('" + base + "../ui/fonts/dmserifdisplay-latin.woff2') format('woff2');font-weight:400;font-display:swap}" + st.textContent;
    (document.head || document.documentElement).appendChild(st);
  }
  if (document.currentScript) g.__mbScript = document.currentScript;

  /* ---------------- mount ---------------- */
  function pct(v) { return r2(v / S * 100) + "%"; }
  var VISIT = [[26.5, 113.5], [64, 113.5], [26.5, 76], [101.5, 113.5], [26.5, 38.5]];   // Just visiting: places on the L (the corner first), in the corner's frame
  function slots(n) {   // piece offsets (in the square's own frame, units from its middle) and the piece size
    if (n <= 1) return { sz: 40, p: [[0, 0]] };
    if (n === 2) return { sz: 36, p: [[-19, 0], [19, 0]] };
    if (n === 3) return { sz: 30, p: [[-31, 0], [0, 0], [31, 0]] };
    if (n === 4) return { sz: 30, p: [[-16, -15], [16, -15], [-16, 15], [16, 15]] };
    return { sz: 28, p: [[-31, -14], [0, -14], [31, -14], [-31, 14], [0, 14], [31, 14]] };
  }
  function mount(host, o) {
    o = o || {}; injectCSS();
    var sq = o.squares || [], zoomOn = o.zoom !== false, inst = {}, st = {}, amt = { 4: "PAY $200", 38: "PAY $100" }, last = [], tokEls = {}, selI = -1, zoom = 1, tx = 0, ty = 0, gestureT = 0, tapT = 0, lastTap = { t: 0, x: 0, y: 0 };
    BUY = {}; sq.forEach(function (s, i) { if (s && s.price) BUY[i] = s; });
    var dpad = o.dpad !== false;   // dpad:false (Party Mode's TV host, where the board is only shown): not a focus stop
    host.classList.add("mb");
    if (dpad) { host.setAttribute("tabindex", "0"); host.setAttribute("role", "group"); host.setAttribute("aria-label", "Monopoly board. Press OK, then the arrow keys to move between the squares."); }
    var stage = document.createElement("div"); stage.className = "mb-stage";
    var live = document.createElement("div"); live.setAttribute("aria-live", "polite"); live.className = "bg-sr"; live.style.cssText = "position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0)";
    host.innerHTML = ""; host.appendChild(stage); host.appendChild(live);
    var svgBox = document.createElement("div"); svgBox.style.cssText = "position:absolute;inset:0"; stage.appendChild(svgBox);
    var center = document.createElement("div"); center.className = "mb-center"; stage.appendChild(center);
    if (o.center) center.appendChild(o.center); else center.innerHTML = plateHTML(!!o.emblem);
    var marks = document.createElement("div"); marks.className = "mb-marks"; stage.appendChild(marks);
    var hl = document.createElement("div"); hl.className = "mb-hl"; marks.appendChild(hl);
    var fs = document.createElement("div"); fs.className = "mb-fs"; marks.appendChild(fs);
    var toks = document.createElement("div"); toks.className = "mb-toks"; stage.appendChild(toks);
    var ctl = null;
    inst.host = host; inst.stage = stage; inst.center = center; inst.toks = toks;

    function drawStatic() {
      sizes(); svgBox.innerHTML = staticSVG(); paintBands(svgBox, sq);
      inst.svg = svgBox.firstChild; inst.dyn = svgBox.querySelector("#mbDyn"); last = [];
      if (st.own || st.houses) paintDyn(true);
      if (st.toks) setToks(st.toks);   // a redraw (the font arrived) can move the free room under a name: the pieces follow
    }
    function paintDyn(all) {
      var i, changed = false;
      for (i = 0; i < 40; i++) {
        var key2 = (st.own ? st.own[i] | 0 : 0) + "|" + (st.houses ? st.houses[i] | 0 : 0) + "|" + (st.mort && st.mort[i] ? 1 : 0) + "|" + (amt[i] || "");
        if (all || last[i] !== key2) { last[i] = key2; changed = true; }
      }
      if (!changed) return;
      var html = "", j; for (j = 0; j < 40; j++) html += dynSVG(j, st, amt[j]);
      inst.dyn.innerHTML = html;
    }
    function unit() { host.style.setProperty("--mb-u", (size() / 100) + "px"); }
    unit(); if (g.ResizeObserver) new ResizeObserver(unit).observe(host); else g.addEventListener("resize", unit);
    drawStatic();
    // the font arrives after the first draw: lay the names out again if the measured widths changed
    if (document.fonts && document.fonts.load) {
      var again = function () { var was = SIGW; SIZES = null; wcache = {}; cxTried = false; cx = null; sizes(); if (Math.abs(SIGW - was) > 0.5) drawStatic(); else SIZES = SIZES; };
      document.fonts.load("800 20px Manrope", "ABC").then(again, function () { });
    }

    // where a piece stands: its slot in the square (jv: "j" = in jail, drawn in the cell over the bars; "v" = visiting the jail corner,
    // on the L of "Just visiting"); the place is ONE translate in board units (through --mb-u), the size the slot's
    function place(el, i, k, n, cur, jv) {
      var s = slots(n), r = RECTS[i], p = s.p[k], sz, pt, v, d, sc;
      if (jv === "j") { sz = s.sz * 0.9; pt = toScreen(i, 89 + p[0] * 0.8, 59 + p[1] * 0.8); }
      else if (jv === "v") { v = VISIT[k % 5]; d = Math.floor(k / 5) * 7; sz = n > 5 ? 28 : 32; pt = toScreen(i, v[0] + d, v[1] - d); }
      else {   // a side square: in the free room between its name and the price strip, so the name and the price stay readable
        sc = r.corner ? 1.35 : 1; sz = s.sz * sc;
        pt = toScreen(i, (r.corner ? D / 2 : W / 2) + p[0] * sc, (r.corner ? D / 2 + 6 : NB[i] ? Math.max(76, Math.min(100, (NB[i] + D - STRIP) / 2)) : 100) + p[1] * sc);
      }
      el.style.width = el.style.height = pct(sz);   // the size steps with the slot (a layout change only when it changes, never per frame)
      el.style.transform = "translate(calc(var(--mb-u,4px)*" + r2(pt.x / S * 100) + "),calc(var(--mb-u,4px)*" + r2(pt.y / S * 100) + ")) translate(-50%,-50%)";
    }
    function setToks(list) {
      var by = {}, n, k, seen = {}, first = !host.classList.contains("mb-anim");
      function key(t) { return t.i === 10 ? (t.jail ? "10j" : "10v") : t.i; }   // the jail corner holds two groups: in jail, visiting
      (list || []).forEach(function (t) { var kk = key(t); (by[kk] = by[kk] || []).push(t); });
      (list || []).forEach(function (t) {
        var grp = by[key(t)], idx = grp.indexOf(t), el = tokEls[t.id];
        seen[t.id] = 1;
        if (!el) { el = tokEls[t.id] = document.createElement("div"); el.className = "mb-pos"; toks.appendChild(el); el._sig = ""; }
        var sig = t.tok + "|" + t.seat + "|" + (t.cur ? 1 : 0) + "|" + (t.title || "");
        if (el._sig !== sig) {
          var wasCur = el._cur; el._sig = sig; el._cur = !!t.cur;
          el.innerHTML = '<span class="tkp' + (t.cur ? " cur" : "") + '"><span class="tk" style="--pc:' + (SEATS[t.seat] || SEATS[1]).c + '"' + (t.title ? ' title="' + esc(t.title).replace(/"/g, "&quot;") + '"' : "") + ">" + tokenSVG(t.tok, t.seat) + "</span></span>";
        }
        place(el, t.i, idx, grp.length, t.cur, t.i === 10 ? (t.jail ? "j" : "v") : "");
      });
      Object.keys(tokEls).forEach(function (id) { if (!seen[id]) { toks.removeChild(tokEls[id]); delete tokEls[id]; } });
      if (first && list && list.length) { void host.offsetWidth; host.classList.add("mb-anim"); }   // the first placement jumps, every later one glides
    }
    function box(el, i) { var r = RECTS[i]; el.style.left = pct(r.x); el.style.top = pct(r.y); el.style.width = pct(r.w); el.style.height = pct(r.h); el.style.display = "block"; }
    inst.update = function (s) {
      s = s || {}; if (s.amt) amt = s.amt;
      st = s;
      paintDyn(false);
      setToks(s.toks);
      if (s.hl >= 0 && s.hl != null) box(hl, s.hl); else hl.style.display = "none";
    };
    inst.select = function (i) {   // the D-pad's square
      selI = i; if (i < 0) { fs.style.display = "none"; live.textContent = ""; return; }
      box(fs, i); live.textContent = plain(NAMES[i]);
      if (o.onFocus) o.onFocus(i);
    };
    inst.selected = function () { return selI; };
    inst.names = NAMES; inst.rects = RECTS;

    /* ---- zoom and pan (phone and mouse) ---- */
    function size() { return host.clientWidth || 1; }
    function clamp() { var P = size(); tx = Math.min(0, Math.max(P - P * zoom, tx)); ty = Math.min(0, Math.max(P - P * zoom, ty)); }
    function apply(glide) {
      clamp();
      if (glide) { stage.classList.add("is-glide"); setTimeout(function () { stage.classList.remove("is-glide"); }, 260); }
      stage.style.transform = zoom === 1 && !tx && !ty ? "" : "translate3d(" + r2(tx) + "px," + r2(ty) + "px,0) scale(" + r2(zoom * 1000) / 1000 + ")";
      host.classList.toggle("is-zoomed", zoom > 1.02); ctlSync();
    }
    function gestureOn() { host.classList.add("is-gesture"); clearTimeout(gestureT); }
    function gestureOff() { clearTimeout(gestureT); gestureT = setTimeout(function () { host.classList.remove("is-gesture"); }, 160); }
    function zoomAt(z, px, py, glide, centre) {   // zoom to z keeping the point (px, py) of the frame fixed, or (centre) bringing it to the middle
      z = Math.max(1, Math.min(3, z)); var f = z / zoom, P = size(); if (centre) { tx = P / 2 - (px - tx) * f; ty = P / 2 - (py - ty) * f; } else { tx = px - (px - tx) * f; ty = py - (py - ty) * f; } zoom = z;
      if (zoom <= 1.001) { zoom = 1; tx = 0; ty = 0; } apply(glide);
    }
    inst.fit = function () { zoom = 1; tx = 0; ty = 0; apply(true); };
    inst.zoomToSquare = function (i, z) {
      var P = size(), r = RECTS[i >= 0 ? i : 0], k = P / S; z = z || 3; zoom = z; tx = P / 2 - r.cx * k * z; ty = P / 2 - r.cy * k * z; apply(true);
    };
    inst.zoom = function () { return zoom; };
    function ctlSync() { if (!ctl) return; var on = zoom > 1.02; ctl.setAttribute("aria-label", on ? "Fit the whole board" : "Zoom in"); ctl.lastChild.textContent = on ? "Fit" : "Zoom"; ctl.firstChild.style.display = on ? "none" : ""; }
    if (zoomOn) {
      ctl = document.createElement("button"); ctl.type = "button"; ctl.className = "mb-ctl";
      ctl.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5"/><path d="M15.5 15.5L21 21M10.5 7.5v6M7.5 10.5h6"/></svg><span>Zoom</span>';
      host.appendChild(ctl);
      ctl.addEventListener("pointerdown", function (e) { e.stopPropagation(); });
      ctl.addEventListener("click", function (e) { e.stopPropagation(); if (zoom > 1.02) inst.fit(); else { var c = (o.start && o.start()); inst.zoomToSquare(c >= 0 && c != null ? c : 0, 3); } });
      ctlSync();
      var ptrs = {}, np = 0, gx = 0, gy = 0, moved = false, startD = 0, startZ = 1, t0 = 0, one = null;
      var local = function (e) { var b = host.getBoundingClientRect(); return { x: e.clientX - b.left, y: e.clientY - b.top }; };
      // the board takes the whole touch (touch-action: none) so a pinch is never stolen by the browser; at Fit a one-finger swipe that
      // starts on it therefore scrolls the page from here (with a short glide after a flick, none under reduced motion)
      var scrolling = false, sEl = null, sY = 0, sT = 0, sV = 0, flingRAF = 0;
      var scroller = function () { for (var el = host.parentElement; el && el !== document.body && el !== document.documentElement; el = el.parentElement) { var oy = getComputedStyle(el).overflowY; if ((oy === "auto" || oy === "scroll") && el.scrollHeight > el.clientHeight + 1) return el; } return null; };
      var scrollPage = function (dy) { if (sEl) sEl.scrollTop -= dy; else g.scrollBy(0, -dy); };
      var stopFling = function () { if (flingRAF) { cancelAnimationFrame(flingRAF); flingRAF = 0; } };
      var fling = function (v) {
        var de = document.documentElement; if (Math.abs(v) < 0.2 || de.getAttribute("data-motion") === "reduce" || (g.matchMedia && g.matchMedia("(prefers-reduced-motion: reduce)").matches)) return;
        var last = 0, step = function (t) { var dt = last ? Math.min(40, t - last) : 16; last = t; v *= Math.pow(0.93, dt / 16); if (Math.abs(v) < 0.03) { flingRAF = 0; return; } scrollPage(v * dt); flingRAF = requestAnimationFrame(step); };
        flingRAF = requestAnimationFrame(step);
      };
      host.addEventListener("pointerdown", function (e) {
        if (e.button > 0 && e.pointerType === "mouse") return;
        stopFling();
        var p = local(e); ptrs[e.pointerId] = p; np = Object.keys(ptrs).length;
        if (np === 1) { moved = false; scrolling = false; t0 = Date.now(); one = { x: p.x, y: p.y, cx: e.clientX, cy: e.clientY }; gx = p.x; gy = p.y; }
        if (np === 2) { scrolling = false; var k = Object.keys(ptrs), a = ptrs[k[0]], b = ptrs[k[1]]; startD = Math.hypot(a.x - b.x, a.y - b.y) || 1; startZ = zoom; moved = true; gestureOn(); try { host.setPointerCapture(e.pointerId); } catch (x) { } }
      });
      host.addEventListener("pointermove", function (e) {
        if (!ptrs[e.pointerId]) return; var p = local(e), prev = ptrs[e.pointerId]; ptrs[e.pointerId] = p;
        if (np >= 2) {
          var k = Object.keys(ptrs), a = ptrs[k[0]], b = ptrs[k[1]], d = Math.hypot(a.x - b.x, a.y - b.y) || 1, mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
          zoomAt(startZ * d / startD, mx, my, false); e.preventDefault(); return;
        }
        if (one && !moved && Math.hypot(e.clientX - one.cx, e.clientY - one.cy) > 8) {
          moved = true;
          if (zoom > 1.02) { gestureOn(); try { host.setPointerCapture(e.pointerId); } catch (x) { } }
          else if (e.pointerType !== "mouse") { scrolling = true; sEl = scroller(); sY = e.clientY; sT = e.timeStamp; sV = 0; }
        }
        if (scrolling) { var dy = e.clientY - sY, dt = Math.max(1, e.timeStamp - sT); if (dy) { scrollPage(dy); sV = sV * 0.5 + dy / dt * 0.5; } sY = e.clientY; sT = e.timeStamp; e.preventDefault(); return; }
        if (moved && zoom > 1.02) { tx += p.x - prev.x; ty += p.y - prev.y; apply(false); e.preventDefault(); }
      });
      var up = function (e) {
        if (!ptrs[e.pointerId]) return; var p = ptrs[e.pointerId]; delete ptrs[e.pointerId]; var was = np; np = Object.keys(ptrs).length;
        if (was >= 2) { if (zoom < 1.04) inst.fit(); gestureOff(); if (np === 1) { var k = Object.keys(ptrs); gx = ptrs[k[0]].x; gy = ptrs[k[0]].y; } return; }
        gestureOff();
        if (scrolling) { scrolling = false; if (e.type === "pointerup" && e.timeStamp - sT < 90) fling(sV); return; }
        if (e.type !== "pointerup" || moved || Date.now() - t0 > 450) return;
        var now = Date.now();
        if (now - lastTap.t < 320 && Math.hypot(p.x - lastTap.x, p.y - lastTap.y) < 36) {   // double-tap: in, or back out
          clearTimeout(tapT); lastTap.t = 0;
          if (zoom > 1.05) inst.fit(); else zoomAt(3, p.x, p.y, true, true);
          return;
        }
        lastTap = { t: now, x: p.x, y: p.y };
        var P = size(), ux = ((p.x - tx) / zoom) / P * S, uy = ((p.y - ty) / zoom) / P * S, i = hit(ux, uy);
        clearTimeout(tapT);
        if (i >= 0 && o.onTap) tapT = setTimeout(function () { o.onTap(i); }, 260);   // a second tap inside this time is a double-tap, not an inspect
      };
      host.addEventListener("pointerup", up); host.addEventListener("pointercancel", up);
      host.addEventListener("wheel", function (e) { if (!e.ctrlKey && zoom < 1.02) return; var p = local(e); e.preventDefault(); zoomAt(zoom * (e.deltaY < 0 ? 1.18 : 1 / 1.18), p.x, p.y, false); }, { passive: false });
    } else {
      host.addEventListener("click", function (e) { var b = host.getBoundingClientRect(), P = b.width, i = hit((e.clientX - b.left) / P * S, (e.clientY - b.top) / P * S); if (i >= 0 && o.onTap) o.onTap(i); });
    }

    /* ---- the D-pad on TV: focus the board, then the arrows walk the squares, OK opens one ---- */
    if (dpad) {
      host.addEventListener("focus", function () { var vis = true; try { vis = host.matches(":focus-visible"); } catch (e) { } if (!vis && !document.documentElement.hasAttribute("data-tv")) return; if (selI < 0) { var c = o.start ? o.start() : 0; inst.select(c >= 0 && c != null ? c : 0); } else inst.select(selI); });
      host.addEventListener("blur", function () { fs.style.display = "none"; if (o.onFocus) o.onFocus(-1); });
      host.addEventListener("keydown", function (e) {
        if (e.altKey || e.ctrlKey || e.metaKey) return;
        var k = e.key, d = k === "ArrowLeft" || k === "Left" ? "left" : k === "ArrowRight" || k === "Right" ? "right" : k === "ArrowUp" || k === "Up" ? "up" : k === "ArrowDown" || k === "Down" ? "down" : null;
        if (d) { var n = walk(selI < 0 ? 0 : selI, d); if (n >= 0) { e.preventDefault(); inst.select(n); } return; }
        if ((k === "Enter" || k === " " || k === "Select" || e.keyCode === 13 || e.keyCode === 23) && selI >= 0 && o.onOpen) { e.preventDefault(); e.stopPropagation(); o.onOpen(selI); }
      });
    }
    inst.destroy = function () { host.classList.remove("mb", "is-zoomed", "is-gesture", "mb-anim"); host.innerHTML = ""; };
    inst.redraw = function () { drawStatic(); };
    inst.setSquares = function (s2) { sq = s2 || sq; BUY = {}; sq.forEach(function (s, i) { if (s && s.price) BUY[i] = s; }); paintBands(svgBox, sq); last = []; paintDyn(true); };
    return inst;
  }

  g.MonoBoard = { mount: mount, tokenSVG: tokenSVG, icon: icon, card: card, plateHTML: plateHTML, SEATS: SEATS, NAMES: NAMES, GROUPS: GROUPS, TOKENS: TOKEN_NAMES, rects: RECTS, walk: walk, hit: hit, iconFor: iconFor, S: S, SX: SX, LS: LS, ROOM: W - 2 * PAD, RIM: RIM,
    measure: function () { return { sizes: sizes(), sigw: SIGW }; } };
})(window);
