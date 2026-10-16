/* Monopoly editions (batch 1, 2026-10-16): the catalogue's loader, and the ONE place that turns an edition file
   (monopoly/editions/<id>.js, format BG_audit/games/monopoly/editions/FORMAT.md) into what the game, the board (board.js) and Party
   Mode use. No DOM is needed for engine() / money(), so node tests load this file too (module.exports).
   - list(): the catalogue (monopoly/editions/index.js), oldest first, grouped by era and country.
   - load(id, cb): adds the edition's <script> once (cached by sw.js for offline play); cb(data) or cb(null) when it cannot load.
   - engine(data): {BOARD, CHANCE, CHEST, TOKENS, COLORVAR, ED, board}: the game's own data shape (index.html), the numbers it reads
     from the edition (ED: salary, jail fine, taxes, railroad rents, currency ...), and the board's drawing options (board.js mount
     {edition}). The classic US edition (classic-us-2008) is the game's built-in default: index.html keeps it inline, unchanged.
   - money(currency): the one formatter for an edition's money ("$200", "£200", "200 F", "$2M"). */
(function (g) {
  "use strict";
  var DEFAULT = "classic-us-2008";
  // the classic group colours (index.html COLORVAR): an edition that keeps one draws the board's own Luxe colour for it
  var CLASSIC_HEX = { brown: "#8b5a2b", light_blue: "#9fd0ef", pink: "#d93a96", orange: "#f08d1c", red: "#e23b3b", yellow: "#f3d41b", green: "#1f9d54", dark_blue: "#2b4fe0" };
  var base = "";
  try { var cs = g.document && g.document.currentScript; if (cs && cs.src) base = cs.src.replace(/[^\/]*$/, ""); } catch (e) { }

  function list() { return (g.MONO_EDITION_LIST || []).slice(); }
  function info(id) { var L = g.MONO_EDITION_LIST || []; for (var i = 0; i < L.length; i++) if (L[i].id === id) return L[i]; return null; }
  function get(id) { var E = g.MONO_EDITIONS || {}; return E[id] || null; }
  var waiting = {};
  function load(id, cb) {
    cb = cb || function () { };
    if (get(id)) { cb(get(id)); return; }
    var it = info(id), d = g.document;
    if (!it || !d) { cb(null); return; }
    if (waiting[id]) { waiting[id].push(cb); return; }
    waiting[id] = [cb];
    var s = d.createElement("script"), done = function () { var l = waiting[id] || []; delete waiting[id]; var e = get(id); l.forEach(function (f) { try { f(e); } catch (x) { } }); };
    s.src = base + it.file; s.async = true;
    s.onload = done; s.onerror = function () { try { s.parentNode.removeChild(s); } catch (x) { } done(); };
    (d.head || d.documentElement).appendChild(s);
  }
  function loadAll(cb) { var L = list(), n = L.length; if (!n) { if (cb) cb(); return; } L.forEach(function (it) { load(it.id, function () { if (--n === 0 && cb) cb(); }); }); }

  /* money: "$200", "-£15", "200 F"; units (Here & Now) give the short forms "$2M", "$600K" */
  function money(cur) {
    cur = cur || { symbol: "$", position: "before" };
    var sp = cur.space ? " " : "", units = (cur.units || []).slice().sort(function (a, b) { return b.value - a.value; }), dec = cur.decimals | 0;
    function num(n) {
      for (var i = 0; i < units.length; i++) if (n >= units[i].value && n % (units[i].value / 10) === 0) return String(n / units[i].value) + units[i].suffix;
      return dec && n % 1 ? n.toFixed(dec) : String(n);
    }
    return function (n) { var neg = n < 0, a = num(Math.abs(n)); return (neg ? "-" : "") + (cur.position === "after" ? a + sp + cur.symbol : cur.symbol + sp + a); };
  }
  function titleCase(s) { return String(s).split(" ").map(function (w) { return w.length > 1 && /^[A-Z]+$/.test(w) ? w.charAt(0) + w.slice(1).toLowerCase() : w; }).join(" "); }
  function sentence(s) { s = String(s || ""); return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase(); }
  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  var ENGINE_GROUPS = ["brown", "light_blue", "pink", "orange", "red", "yellow", "green", "dark_blue"];

  function engine(ed) {
    var fmt = money(ed.currency);
    var BOARD = ed.spaces.map(function (s) {
      var o = { n: s.n, t: s.t };
      if (s.t === "prop") { o.g = s.g; o.price = s.price; o.rent = s.rent.slice(); o.house = s.house; o.mort = s.mort; }
      else if (s.t === "rr" || s.t === "util") { o.price = s.price; o.mort = s.mort; }
      else if (s.t === "tax") o.tax = s.tax;
      return o;
    });
    var card = function (c) { var o = { text: c.text, fx: c.fx }; if (c.a !== undefined) o.a = Array.isArray(c.a) ? c.a.slice() : c.a; if (c.orig) o.orig = c.orig; return o; };
    var COLORVAR = {}; ENGINE_GROUPS.forEach(function (k) { if (ed.groups && ed.groups[k]) COLORVAR[k] = ed.groups[k].hex; });
    var TOKENS = ed.tokensLegacy ? ed.tokensLegacy.map(function (t) { return { e: t.e, n: t.n }; })
      : (ed.tokens || []).map(function (t) { return { e: t.emoji || "", n: t.name, id: t.id }; });
    var added = ed.tokensLegacy ? [] : (ed.tokens || []).filter(function (t) { return t.added; }).map(function (t) { return t.id; });
    var inc = ed.spaces[4] && ed.spaces[4].tax === "income" ? ed.spaces[4] : null, lux = ed.spaces[38] && ed.spaces[38].tax === "luxury" ? ed.spaces[38] : null;
    var rrWord = (ed.railroad && ed.railroad.word) || "Railroad", dn = ed.deckNames || {};
    var luxAmt = lux ? lux.amount : 100, us = ed.country === "US";
    var ED = {
      id: ed.id, name: ed.name, fmt: fmt, cur: ed.currency,
      salary: ed.money.salary, startCash: ed.money.startingCash, jail: ed.money.jailFine || 50,
      houses: ed.money.houses || 32, hotels: ed.money.hotels || 12,
      inc: { amount: inc ? inc.amount : 200, pct: inc && inc.pct ? inc.pct : 10, printed: !!(inc && inc.pct), name: inc ? inc.n : "Income Tax" },
      lux: luxAmt, luxName: lux ? lux.n : "Luxury Tax",
      // the $75 / $100 Luxury Tax switch is a US rule: shown for US boards that print 75 or 100 (Official where the board prints $75)
      luxToggle: us && (luxAmt === 75 || luxAmt === 100), luxOfficial: luxAmt === 75,
      incTag: inc && inc.pct ? "official" : us ? "official" : "house",
      rr: (ed.railroad && ed.railroad.rent) ? ed.railroad.rent.slice() : [25, 50, 100, 200], rrWord: rrWord,
      util: (ed.utility && ed.utility.mult) ? ed.utility.mult.slice() : [4, 10],
      decks: { chance: dn.chance || "Chance", chest: dn.chest || "Community Chest", chestShort: (dn.chest || "Community Chest") === "Community Chest" ? "Chest" : (dn.chest || "Chest"),
        chanceGloss: dn.chanceGloss || "", chestGloss: dn.chestGloss || "" },
      rules: clone(ed.rules || {}), tokensAdded: added, language: ed.language || "en"
    };
    if (ED.rules.startingCash === undefined) ED.rules.startingCash = ED.startCash;
    // the board's drawing options (board.js mount {edition}): names as printed, the group colours and names, money, the GO salary, the decks
    var names = ed.spaces.map(function (s, i) { return i === 10 ? "In Jail / Just Visiting" : i === 30 ? "Go to Jail" : ((s.printed && s.t !== "tax") ? titleCase(s.printed) : s.n).replace(/(\S) & (\S)/g, "$1 & $2"); });   // "B. & O." stays on one line (as board.js prints it)
    var groups = {};
    ENGINE_GROUPS.forEach(function (k) { var gr = ed.groups && ed.groups[k]; if (!gr) return; groups[k] = { n: sentence(gr.name) }; if ((gr.hex || "").toLowerCase() !== CLASSIC_HEX[k]) groups[k].c = gr.hex; });
    var board = { id: ed.id, names: names, groups: groups, money: fmt, salary: ED.salary, rr: ED.rr, util: ED.util, rrWord: rrWord.toLowerCase(),
      decks: { chance: ED.decks.chance.toUpperCase(), chest: ED.decks.chest.toUpperCase() }, word: ed.officialName || "Monopoly" };
    ED.board = board;
    return { BOARD: BOARD, CHANCE: (ed.chance || []).map(card), CHEST: (ed.chest || []).map(card), TOKENS: TOKENS, COLORVAR: COLORVAR, ED: ED, board: board };
  }

  var api = { DEFAULT: DEFAULT, list: list, info: info, get: get, load: load, loadAll: loadAll, engine: engine, money: money, titleCase: titleCase, CLASSIC_HEX: CLASSIC_HEX };
  g.MonoEdition = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
