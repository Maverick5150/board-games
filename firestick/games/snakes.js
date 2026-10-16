/* SNAKES AND LADDERS in Party Mode: the TV side (firestick/games/README.md is the guide; the registry line is in games/registry.js).
   The rules are the phone game's own engine (../snakes/engine.js: pure, plain-JSON state, snapshot(G, seat)); the board art is
   ../snakes/board.js (every board of ../snakes/boards.js: 10 x 10, the 9 x 8 = 72-square Indian charts, the Jaina charts and the Ayres
   spiral); the computers' characters are ../snakes/brain.js. This file only drives them on the TV, as snakes/game.js does:
   - the lobby: Version cards and the rule rows (official / House) from the engine, the Board row that opens the big-preview board picker
     (BGUI.picker: preview left, list right; the D-pad moves and the preview follows, OK picks, Back closes), "Youngest player" for the 2021
     American rule, and Continue the saved game;
   - who goes first: the engine's own roll-off (Classic: the die; American: the spinner; 2021: the youngest), played by the shared show;
   - every move hops through EVERY square it passes, one hop per square at the Game speed pace; a ladder climbs rung by rung and a snake
     slides along its body as their own moves, with banners naming the squares; the phones get Roll (Spin on the American board);
   - live standings in unique places 1..N (E.standings), the Victory with the same order, an autosave after every roll (localStorage
     "party-snakes-live"; Continue in the lobby when the table has the same number of players).
   Snakes and Ladders has no decisions (RULES.md 6): the only move is the roll, and it happens here on the TV (never on a phone). */
(function () {
  "use strict";
  var P = window.PartyGames, S = window.Snakes, E = S && S.Engine, BD = S && S.Board;
  if (!P || !E || !BD) return;
  var ID = "snakes", KEY = "party-snakes-live", SAVEV = 1;
  var LUXE = ["#ff5d73", "#5f95ff", "#3fd391", "#ffcb4f", "#b383ff", "#38cbd2", "#ff9f4a", "#ff7ab8", "#8b93a8", "#c08a5a"];   // ui/theme.css --seat-1..10
  function BG() { return window.BGUI || null; }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function plural(n, w) { return n + " " + w + (n === 1 ? "" : "s"); }
  function remPx() { return parseFloat(getComputedStyle(document.documentElement).fontSize) || 16; }
  function clamp(x, a, b) { return x < a ? a : x > b ? b : x; }
  function reduced() { var B = BG(); return document.documentElement.getAttribute("data-motion") === "reduce" || !!(B && B.reducedMotion && B.reducedMotion()); }
  function calm() { var B = BG(); return reduced() || !!(B && B.effects && B.effects.get && B.effects.get() === "reduced") || document.hidden; }
  function lsGet(k) { try { return JSON.parse(localStorage.getItem(k) || "null"); } catch (e) { return null; } }
  function lsSet(k, v) { try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, JSON.stringify(v)); } catch (e) { } }

  /* ---------- the game's look: icons, stage motifs and music (the same as snakes/game.js registers on its own page) ---------- */
  var GLYPHS = {
    snake: '<path d="M17.5 5.5c2 0 3 1.2 3 2.6 0 1.6-1.4 2.6-3.2 2.6H8.4c-2 0-3.4 1.3-3.4 3s1.4 3 3.4 3h7.2c1.4 0 2.4.8 2.4 2s-1 2-2.4 2H6"/><path d="M17.5 5.5c-1.6 0-2.8 1-2.8 2.4"/><circle cx="18.3" cy="7.4" r=".7" fill="currentColor"/><path d="M20.5 8.1l1.6-.6M20.5 8.1l1.4 1"/>',
    ladder: '<path d="M8 3v18M16 3v18M8 6.5h8M8 10.5h8M8 14.5h8M8 18.5h8"/>',
    die: '<rect x="4.5" y="4.5" width="15" height="15" rx="3.2"/><circle cx="9" cy="9" r="1.1" fill="currentColor"/><circle cx="15" cy="15" r="1.1" fill="currentColor"/><circle cx="12" cy="12" r="1.1" fill="currentColor"/>',
    crest: '<path d="M12 3.5l2.4 4.9 5.4.8-3.9 3.8.9 5.4L12 15.9l-4.8 2.5.9-5.4-3.9-3.8 5.4-.8z"/>'
  };
  (function register() {
    var B = BG(); if (!B) return;
    try {
      if (B.icon && B.icon.add) { Object.keys(GLYPHS).forEach(function (k) { if (!B.icon.has || !B.icon.has(k)) B.icon.add(k, GLYPHS[k]); }); if (B.icon.seal && B.icon.seal.set) B.icon.seal.set(ID, "snake"); }
      if (B.stage && B.stage.register) B.stage.register(ID, { motifs: ["snake", "ladder", "die", "crest"] });
    } catch (e) { }
  })();
  if (window.Sound && Sound.addStyle && !(Sound.hasStyle && Sound.hasStyle(ID))) {
    try {
      Sound.addStyle(ID, { scales: ["major", "mixo", "major", "dorian"], bpm: [108, 136], swing: 0.12, sev: false, leadVol: 0.08, waves: ["triangle", "square", "triangle"], bassKind: "bounce",
        progs: [[0, 4, 5, 3], [0, 3, 4, 4], [0, 5, 3, 4], [0, 2, 3, 4], [0, 4, 3, 4], [0, 5, 1, 4], [0, 3, 5, 4], [0, 1, 3, 4]],
        bridge: [[3, 4, 0, 5], [5, 3, 4, 4], [1, 4, 0, 0], [3, 5, 4, 4]],
        rhythms: [[1, 0, 1, 0, 1, 1, 0, 1], [1, 1, 0, 1, 0, 1, 1, 0], [1, 0, 0, 1, 1, 0, 1, 0], [1, 0, 1, 1, 0, 1, 0, 1]],
        chordSteps: [0, 2, 4],
        drums: [{ kick: [1, 0, 0, 0, 1, 0, 0, 0], snare: [0, 0, 1, 0, 0, 0, 1, 0], sv: 0.07, hat: [1, 1, 1, 1, 1, 1, 1, 1], hv: 0.03 }, { kick: [1, 0, 0, 1, 0, 0, 1, 0], snare: [0, 0, 1, 0, 0, 1, 0, 0], sv: 0.08, hat: [1, 0, 1, 0, 1, 0, 1, 0], hv: 0.04 }, { kick: [1, 0, 1, 0, 1, 0, 0, 1], snare: [0, 0, 1, 0, 0, 0, 1, 1], sv: 0.06, hat: [0, 1, 0, 1, 0, 1, 0, 1], hv: 0.035 }],
        titles: ["Up the Golden Ladder", "Hundred Square Hustle", "Slither Down Slow", "Roll Me a Six", "Viper Lime Boogie", "The Long Way Home", "Rung by Rung", "Back to Square One", "Penitence and Kindness", "Exactly Three to Go"] },
        { wave: "triangle", reg: 0 });
    } catch (e) { }
  }

  /* ---------- the CSS (scoped by html[data-pgame="snakes"]: the lobby, the picker and the game screen) ---------- */
  var Q = 'html[data-pgame="snakes"] ';
  var CSS = [
    'html[data-pgame="snakes"]{--snp-bw:min(calc((100vh - 10.75rem) * 1000 / 1070), 50vw)}',
    /* the lobby's Board row (a thumbnail, the board's name and year, a chevron) and the saved game row */
    Q + ".snp-brow{display:flex;align-items:center;gap:1rem;width:100%;min-height:5.5rem;padding:.75rem 1rem;text-align:left}",
    Q + ".snp-bthumb{flex:none;width:4.5rem;height:4.5rem;border-radius:var(--r-sm);overflow:hidden;background:#0b0a12;box-shadow:inset 0 0 0 1px var(--line-gold)}",
    Q + ".snp-bthumb svg{display:block;width:100%;height:100%}",
    Q + ".snp-brow .bg-row__title{font:400 var(--fs-xl)/1.2 var(--font-display);color:var(--gold-100)}",
    Q + ".snp-brow .bg-row__desc{color:var(--text-2)}",
    Q + ".snp-brow .snp-chev{flex:none;display:inline-grid;place-items:center;width:1.5rem;height:1.5rem;color:var(--gold-200)}",
    Q + ".snp-warn{margin:.5rem 0 0;font:var(--fw-ui-strong) var(--fs-sm)/1.4 var(--font-ui);color:#ffd9a0}",
    Q + ".snp-res .bg-row__desc{color:var(--text-2)}",
    /* the picker's pictures (the same numbers as on the board) */
    ".sn-prevsvg .sn-num{font-family:var(--font-ui);font-weight:800;fill:#f8efd8;stroke:#0b0a12;stroke-opacity:.72;stroke-width:5px;paint-order:stroke;stroke-linejoin:round}",
    ".sn-prevsvg .sn-num.is-100{fill:#3a2408;stroke:#fff3cf;stroke-opacity:.5}",
    ".sn-prevsvg .sn-num.is-mid{text-anchor:middle}",
    ".sn-prevsvg{display:block;width:100%;height:100%}",
    /* the game: the board on the left at the full height, the standings, the die and the log on the right */
    Q + ".snp{display:grid;grid-template-columns:var(--snp-bw) minmax(0,34rem);column-gap:3rem;align-items:start;justify-content:center;width:100%;min-height:0}",
    Q + ".snp-board{position:relative;width:var(--snp-bw)}",
    Q + ".snp.is-over{--snp-bw:min(calc((100vh - 15.5rem) * 1000 / 1070), 50vw)}",   /* game over: New Game fits under the hint bar */
    Q + ".sn-board{position:relative;width:100%;padding:.3rem;border-radius:1rem;background:linear-gradient(145deg,#f6e2ac,#b88a45 40%,#e9cb87 62%,#7d5523);box-shadow:0 .75rem 2rem rgba(0,0,0,.55)}",
    Q + ".sn-art{position:relative;width:100%;aspect-ratio:1000 / 1070;border-radius:.75rem;overflow:hidden;background:#0b0a12;user-select:none}",
    Q + ".sn-art .sn-svg{position:absolute;inset:0;width:100%;height:100%;display:block;will-change:transform}",
    Q + ".sn-svg .sn-num{font-family:var(--font-ui);font-weight:800;fill:#f8efd8;stroke:#0b0a12;stroke-opacity:.72;stroke-width:5px;paint-order:stroke;stroke-linejoin:round}",
    Q + ".sn-svg .sn-num.is-100{fill:#3a2408;stroke:#fff3cf;stroke-opacity:.5}",
    Q + ".sn-svg .sn-num.is-mid{text-anchor:middle}",
    Q + ".sn-svg .sn-railtxt{font-family:var(--font-ui);font-weight:800;letter-spacing:.06em;text-transform:uppercase;fill:#e7ca90;text-anchor:end}",
    Q + ".sn-spin text{font-family:var(--font-ui);font-weight:800;font-size:19px;fill:#f8efd8;text-anchor:middle;dominant-baseline:central}",
    Q + ".sn-toks{position:absolute;inset:0;pointer-events:none}",
    Q + ".sn-tok{position:absolute;aspect-ratio:1;z-index:2;will-change:transform}",
    Q + ".sn-tok.is-turn{z-index:4}",
    Q + ".sn-tok.is-moving{z-index:5}",
    Q + ".sn-hopw{position:absolute;inset:0}",
    Q + ".sn-tok .bg-token{width:100%;height:100%;font-size:max(var(--fs-micro), calc(var(--tw, 24px) * .44));box-shadow:inset 0 -3px 6px rgba(0,0,0,.35), 0 0 0 2px #0b0a12, 0 .2rem .45rem rgba(0,0,0,.6)}",
    Q + ".sn-tok.is-turn .bg-token{box-shadow:inset 0 -3px 6px rgba(0,0,0,.35), 0 0 0 2px #0b0a12, 0 0 0 4px var(--seat), 0 0 0 6px #fff3d1}",
    Q + ".sn-tok.is-done .bg-token{box-shadow:inset 0 -3px 6px rgba(0,0,0,.35), 0 0 0 2px #0b0a12, 0 0 0 4px #e2bd72}",
    Q + ".sn-banner{position:absolute;left:50%;top:46%;z-index:8;display:grid;justify-items:center;gap:.3rem;width:max-content;max-width:88%;padding:.6rem 1.4rem .75rem;transform:translate(-50%,-50%);border-radius:var(--r-lg);background:linear-gradient(180deg,rgba(18,14,32,.95),rgba(8,10,21,.95));box-shadow:inset 0 0 0 1.5px var(--gold-200), 0 .8rem 2rem rgba(0,0,0,.6);text-align:center;pointer-events:none;opacity:0;visibility:hidden}",
    Q + ".sn-banner.is-on{opacity:1;visibility:visible}",
    Q + ".sn-banner b{font:400 var(--fs-4xl)/1.05 var(--font-display);color:var(--gold-100)}",
    Q + ".sn-banner span{font:var(--fw-ui-strong) var(--fs-lg)/1.3 var(--font-ui);color:#f6e9cf}",
    Q + ".sn-banner.is-snake{background:linear-gradient(180deg,rgba(70,12,22,.95),rgba(22,6,10,.95))}",
    Q + ".sn-banner.is-snake b{color:#ffc2b4}",
    Q + ".sn-banner.is-ladder{background:linear-gradient(180deg,rgba(16,48,24,.95),rgba(6,18,10,.95))}",
    Q + ".sn-banner.is-ladder b{color:#d6fa9c}",
    Q + ".sn-banner.is-win{background:linear-gradient(180deg,rgba(74,52,14,.96),rgba(26,18,4,.96))}",
    Q + ".snp-side{display:flex;flex-direction:column;gap:1rem;min-width:0;padding-top:.25rem}",
    Q + ".snp-meta{display:flex;flex-wrap:wrap;gap:.5rem .75rem}",
    Q + ".snp-chip{display:inline-flex;align-items:center;gap:.4rem;padding:.3rem .85rem;border-radius:var(--r-pill);background:var(--ink-3);box-shadow:inset 0 0 0 1px var(--line-1);font:var(--fw-ui-strong) var(--fs-sm)/1.3 var(--font-ui);color:var(--text-1);font-variant-numeric:tabular-nums}",
    Q + ".snp-chip--board{color:var(--gold-100)}",
    Q + "#snpPl.bg-players{grid-template-columns:minmax(0,1fr);gap:.75rem;padding:.75rem 0 0}",
    Q + "#snpPl.bg-players.is-two{grid-template-columns:repeat(2,minmax(0,1fr))}",
    Q + "#snpPl .bg-player{padding:.55rem .9rem .7rem .5rem}",
    Q + "#snpPl .bg-token{width:2.25rem;height:2.25rem}",
    Q + "#snpPl .bg-badge{flex:none;min-width:2.6rem;text-align:center}",
    Q + ".snp-roll{display:flex;align-items:center;gap:1.5rem;min-height:6.5rem}",
    Q + ".snp-dice{flex:none;display:flex;align-items:center;gap:.6rem}",
    Q + ".snp-dice .bg-die{width:4.5rem;height:4.5rem}",
    Q + ".snp-dice .sn-spin{width:6rem;height:6rem;display:block}",
    Q + ".snp-dice .sn-arrow{transform-origin:50px 50px;transform-box:view-box}",
    Q + ".snp-stat{margin:0;font:var(--fw-ui-strong) var(--fs-lg)/1.35 var(--font-ui);color:var(--text-1);min-width:0}",
    Q + ".snp-say{display:flex;align-items:center;gap:.6rem;margin:0;min-height:2.5rem;font:italic 400 var(--fs-md)/1.3 var(--font-display);color:var(--text-2)}",
    Q + ".snp-say:empty{visibility:hidden}",
    Q + ".snp-say .bg-token{flex:none;width:2rem;height:2rem;font:var(--fw-caps) var(--fs-micro)/1 var(--font-ui)}",
    Q + ".snp-log{list-style:none;margin:0;padding:.75rem 1rem;display:grid;gap:.3rem;border-radius:var(--r-md);background:var(--ink-2);box-shadow:var(--well-edge);font:var(--fw-body) var(--fs-sm)/1.35 var(--font-ui);color:var(--text-2)}",
    Q + ".snp-log li:last-child{color:var(--text-1)}",
    Q + ".snp-log:empty{display:none}",
    Q + ".snp.is-over .snp-log li:nth-last-child(n+3){display:none}",   /* game over: the last two lines (New Game needs the room) */
    Q + ".sn-fpspin{position:relative;display:grid;place-items:center;width:100%;height:100%}",
    Q + ".sn-fpspin svg{width:88%;height:auto;display:block}",
    Q + ".sn-fpspin b{position:absolute;left:50%;bottom:.15rem;transform:translateX(-50%);font:400 var(--fs-lg)/1 var(--font-display);color:#1d1a2a}",
    Q + ".sn-fpspin--back svg{width:80%}",
    Q + ".bg-fp__face .sn-fpspin svg{width:74%;margin-top:-.9rem}",
    /* the young-player sheet (2021 rules) */
    Q + "#snpYoungSheet .bg-sheet__option{min-height:3.5rem}",
    /* toasts over the side column, clear of the board */
    'html[data-pgame="snakes"][data-tv] body.ps-ingame .bg-toast{left:calc(50vw + var(--snp-bw) / 2 + 1.5rem);max-width:32rem}'
  ].join("\n");
  (function addCSS() { if (document.getElementById("snp-css")) return; var st = document.createElement("style"); st.id = "snp-css"; st.textContent = CSS; document.head.appendChild(st); })();

  /* ---------- the lobby settings: {version, over: {house rules + board}, youngest: Luxe seat number of the youngest phone, resume} ---------- */
  function defaults() { return { version: "classic", over: {}, youngest: 0, resume: false }; }
  function clean(c) {
    var d = defaults(); if (!c || typeof c !== "object") return d;
    if (E.versionOf(c.version)) d.version = c.version;
    var base = E.defaultOpts();
    if (c.over && typeof c.over === "object") Object.keys(c.over).forEach(function (k) { if (base.hasOwnProperty(k) && k !== "version" && k !== "youngest") d.over[k] = c.over[k]; });
    if (d.over.board && d.over.board !== "shuffle" && E.boardIds().indexOf(d.over.board) < 0) delete d.over.board;
    d.youngest = Math.max(0, Math.floor(+c.youngest) || 0);
    return d;
  }
  /* the effective rules for n players (the engine's normalize: locked Version options, 5-6 players = Big table, two dice...) */
  function eff(c, n, youngIx) {
    var x = {}; for (var k in (c.over || {})) x[k] = c.over[k];
    if (x.first === "youngest") x.youngest = youngIx == null ? 0 : youngIx;
    return E.normalize(E.versionOpts(c.version, x), n);
  }
  function infoOf(bd) { return bd && bd !== "shuffle" && E.infoOf ? E.infoOf(bd) : null; }
  function boardCap(bd) { var i = infoOf(bd); return bd === "shuffle" ? "Shuffled fair board" : i ? i.cap : (E.BOARDS[bd] ? E.BOARDS[bd].name : "The board"); }
  function chosenBoard(c, n) { var o = eff(c, n); return o.board === "shuffle" ? "shuffle" : E.boardOf(o); }
  function boardFacts(id) {
    var i = infoOf(id), B0 = E.BOARDS[id], nl = 0, ns = 0, k; if (!B0) return "";
    for (k in B0.L) { if (+B0.L[k] > +k) nl++; else ns++; }
    var sq = i && i.grid && i.grid.kind === "cells" ? i.squares + " squares + 6 top squares" : (i ? i.squares : 100) + " squares";
    var out = [sq, nl + (i && i.devices && i.devices.all ? " arrows" : nl === 1 ? " ladder" : " ladders"), ns + (ns === 1 ? " snake" : " snakes")];
    if (i && i.steps) out.push(Object.keys(i.steps).length + " footprints");
    return out.join(" · ");
  }
  function lengthLine(c, n, id) {
    var real = id === "shuffle" ? (E.versionOf(c.version) || E.VERSIONS[0]).board : id, x = {}, k;
    for (k in (c.over || {})) x[k] = c.over[k]; x.board = real;
    var len = null; try { len = E.lengthOf ? E.lengthOf(real, E.normalize(E.versionOpts(c.version, x), n)) : null; } catch (e) { len = null; }
    if (!len || !isFinite(len.solo)) return "";
    return "About " + Math.round(len.solo) + " rolls alone · " + Math.round(len.four) + " rounds with 4 players";
  }
  /* the rule rows for this Version, player count and rules (engine HOUSE rows, minus the Board row: the Board has its own picker).
     Engine rows say [.., house (1 = House), ..]; the Party lobby's row[4] is "official", so it is flipped here */
  function rows(c, n) {
    var o = eff(c, n);
    return E.houseRows(o.version, n, o).filter(function (h) { return h[0] !== "board"; }).map(function (h) { return [h[0], h[1], h[2], h[3], h[4] ? 0 : 1]; });
  }
  /* the phones seated in the lobby, read from the host's seat cards (the lobby api has only their count): [{seat, name}] */
  function seatedPhones() {
    var out = [];
    Array.prototype.forEach.call(document.querySelectorAll("#players .bg-seatcard:not(.bg-seatcard--empty)"), function (el) {
      var nm = el.querySelector(".bg-seatcard__name"); out.push({ seat: +el.getAttribute("data-seat") || 0, name: nm ? nm.textContent.trim() : "" });
    });
    return out;
  }
  function savedGame() {
    var s = lsGet(KEY);
    if (!s || s.v !== SAVEV || !s.G || s.G.id !== "snakes" || s.G.over || !Array.isArray(s.G.players)) return null;
    try { if (E.check(s.G).length) return null; } catch (e) { return null; }
    return s;
  }
  function ago(t) { var m = Math.round((Date.now() - (+t || 0)) / 60000); return m < 1 ? "just now" : m < 60 ? plural(m, "minute") + " ago" : m < 1440 ? plural(Math.round(m / 60), "hour") + " ago" : plural(Math.round(m / 1440), "day") + " ago"; }

  var lobbyObs = null, lobbySig = "";
  function lobby(api, cfg, el) {
    if (!cfg.over) cfg.over = {};
    var n = Math.max(2, api.players()), o = eff(cfg, n), B = BG();
    var af = document.activeElement, keepId = af && af.id && /^snp/.test(af.id) ? af.id : null;
    var sv = savedGame(); if (!sv) cfg.resume = false;
    api.rules({ versions: E.VERSIONS, house: rows(cfg, n), opts: function (c) { return eff(c, n); } });
    // the Version's description says what 5-6 players mean (the Big table House rule) and the Board under it
    var secs = el.querySelectorAll(".ps-sec"), vsec = secs[0], rsec = secs[1];
    var vd = vsec && vsec.querySelector(".ps-vdesc");
    if (vd && n > E.MAXP) vd.insertAdjacentHTML("beforeend", " <b>" + n + " at the table:</b> the Big table House rule (5 or 6 players) is on.");
    if (vd) vd.insertAdjacentHTML("beforeend", " " + esc((S.Brain && S.Brain.NOTE) || "Skill makes no difference in Snakes and Ladders: it is pure luck, and every player just rolls."));   // Computer skill, said honestly
    var id = chosenBoard(cfg, n), inf = infoOf(id), v = E.versionOf(cfg.version) || E.VERSIONS[0];
    var desc = id === "shuffle" ? "New each game, about as long as the " + boardCap(v.board) + "." : (inf ? inf.maker + " · " + inf.country + ", " + inf.year + ". " : "") + boardFacts(id) + ".";
    var gm = E.geoOf && id !== "shuffle" ? E.geoOf(id) : null;
    var own = gm && gm.play ? " " + inf.rules : "";
    var bsec = '<section class="ps-sec snp-bsec"><div class="bg-section"><h2 class="bg-eyebrow" data-stage-text>Board</h2></div>' +
      '<button type="button" class="bg-row aibtn snp-brow" id="snpBoard" aria-label="Board: ' + esc(boardCap(id)) + '. Choose your board">' +
      '<span class="snp-bthumb" aria-hidden="true">' + (BD.preview ? BD.preview(id) : "") + '</span>' +
      '<span class="bg-row__main"><span class="bg-row__title">' + esc(boardCap(id)) + '</span><span class="bg-row__desc">' + esc(desc) + '</span></span>' +
      '<span class="snp-chev" aria-hidden="true" data-icon="chevron"></span></button>' +
      '<p class="ps-vdesc">' + esc((id === v.board && cfg.over.board !== "shuffle" ? "The " + v.name + " board. " : id === "shuffle" ? "House rule. " : "Another real board, with the " + v.name + " rules. ") + lengthLine(cfg, n, id) + "." + own) + '</p></section>';
    if (vsec) vsec.insertAdjacentHTML("afterend", bsec);
    // 2021 American rules: the youngest phone goes first (computers have no age); nobody picked = the spin
    if (o.first === "youngest" && rsec) {
      var ph = seatedPhones(), yo = ph.filter(function (p) { return p.seat === cfg.youngest; })[0];
      var row = '<div class="ps-rule"><span class="bg-tag bg-tag--official">official</span><button type="button" class="bg-row aibtn" id="snpYoung"><span class="bg-row__main"><span class="bg-row__title">Youngest player</span></span><span class="bg-sr">: </span><span class="ps-val">' + esc(yo ? yo.name : ph.length ? "Press OK to pick" : "Waiting for phones") + '</span><span class="bg-ico-slot" aria-hidden="true" data-icon="chevron"></span></button></div>';
      var fr = rsec.querySelector('button[data-k] .bg-row__title'), rr = null;
      Array.prototype.forEach.call(rsec.querySelectorAll(".ps-rule"), function (r) { var t = r.querySelector(".bg-row__title"); if (t && /Who starts/.test(t.textContent)) rr = r; });
      if (rr) rr.insertAdjacentHTML("afterend", row); else if (fr) rsec.querySelector(".ps-rules").insertAdjacentHTML("afterbegin", row);
    }
    // Continue the saved game (the table needs the same number of players)
    if (sv) {
      var sn = sv.G.n, ok = sn === n, names = sv.G.players.map(function (p) { return p.name; }).join(", ");
      var res = '<section class="ps-sec snp-res"><div class="bg-section"><h2 class="bg-eyebrow" data-stage-text>Saved game</h2></div><div class="ps-rules"><div class="ps-rule"><span class="bg-tag bg-tag--official">saved</span>' +
        '<button type="button" class="bg-row aibtn' + (cfg.resume ? " on" : "") + '" role="switch" aria-checked="' + !!cfg.resume + '" id="snpResume"><span class="bg-row__main"><span class="bg-row__title">Continue the saved game</span>' +
        '<span class="bg-row__desc">' + esc("Turn " + sv.G.turn + " on the " + boardCap(sv.G.bd) + " · " + sn + " players (" + names + ") · saved " + ago(sv.t)) + '</span></span>' +
        '<span class="bg-sr">: ' + (cfg.resume ? "ON" : "off") + '</span><span class="bg-toggle" aria-hidden="true"></span></button></div></div>' +
        (cfg.resume && !ok ? '<p class="snp-warn" role="status">The saved game had ' + sn + ' players and this table has ' + n + '. Seat ' + sn + ' (phones and computers) to continue it; otherwise a new game starts.</p>' : "") +
        (cfg.resume && ok ? '<p class="ps-vdesc">The saved game keeps its own Version, board and rules; the phones take its seats in order.</p>' : "") + '</section>';
      el.insertAdjacentHTML("afterbegin", res);
    }
    if (api.paintIcons) api.paintIcons(el);
    var bb = el.querySelector("#snpBoard"); if (bb) bb.onclick = function () { openPicker(api, cfg, n); };
    var yb = el.querySelector("#snpYoung"); if (yb) yb.onclick = function () {
      var ph = seatedPhones(); if (!ph.length) { api.toast("The youngest player joins from a phone first."); return; }
      var ix = -1; ph.forEach(function (p, i) { if (p.seat === cfg.youngest) ix = i; });
      cfg.youngest = ph[(ix + 1) % ph.length].seat; api.redraw();
    };
    var rb = el.querySelector("#snpResume"); if (rb) rb.onclick = function () { cfg.resume = !cfg.resume; api.redraw(); };
    if (keepId) { var k2 = document.getElementById(keepId); if (k2) { if (B && B.focus && B.focus.enabled && B.focus.set) B.focus.set(k2); else try { k2.focus({ preventScroll: true }); } catch (e) { } } }
    // the player count and the seated phones change in the host's own rows: redraw this box when they do (Big table, places, youngest)
    var pl = document.getElementById("players");
    lobbySig = n + "|" + seatedPhones().map(function (p) { return p.seat + p.name; }).join(",");
    if (pl && window.MutationObserver && (!lobbyObs || lobbyObs.el !== pl)) {
      if (lobbyObs) lobbyObs.disconnect();
      lobbyObs = new MutationObserver(function () {
        if (!pl.isConnected || document.documentElement.getAttribute("data-pgame") !== ID) { lobbyObs.disconnect(); lobbyObs = null; return; }
        var sig = Math.max(2, api.players()) + "|" + seatedPhones().map(function (p) { return p.seat + p.name; }).join(",");
        if (sig !== lobbySig) { lobbySig = sig; api.redraw(); }
      });
      lobbyObs.el = pl; lobbyObs.observe(pl, { childList: true });
    }
  }
  /* Choose your board: the shared big-preview picker (BGUI.picker), every board of the catalogue grouped by era, oldest first, then the
     shuffled fair board. TV: preview left, list right; the D-pad moves and the preview follows; OK picks; Back closes */
  function openPicker(api, cfg, n) {
    var B = BG(); if (!B || !B.picker) { api.toast("The board picker didn't load."); return; }
    var list = E.catalogue ? E.catalogue() : [], v = E.versionOf(cfg.version) || E.VERSIONS[0], chosen = chosenBoard(cfg, n), groups = [], g = null;
    if (!list.length) list = [{ id: "vic", group: "Victorian Britain" }, { id: "mb", group: "United States" }];
    function item(id) {
      var i = infoOf(id), shuffle = id === "shuffle", tags = [];
      if (id === v.board) tags.push({ text: v.name + " board", kind: "official" });
      if (i && i.status === "PARTLY INFERRED") tags.push({ text: "Partly inferred", kind: "house" }); else if (i) tags.push({ text: "Verified", kind: "paper" });
      if (shuffle) tags.push({ text: "House", kind: "house" });
      return { id: id, name: shuffle ? "Shuffled fair board" : i ? i.name : boardCap(id),
        meta: shuffle ? "A new board each game" : i ? i.maker + " · " + i.country + ", " + i.year : "",
        desc: shuffle ? "The " + boardCap(v.board) + "'s counts of ladders and snakes, kept only if its length is within 10% of the real board's." : (i ? i.rules : ""),
        detail: (shuffle ? "New each game · house rule" : boardFacts(id)) + (lengthLine(cfg, n, id) ? " · " + lengthLine(cfg, n, id) : ""),
        tags: tags, small: BD.preview ? BD.preview(id) : "" };
    }
    list.forEach(function (b) { if (!g || g.head !== b.group) { g = { head: b.group, items: [] }; groups.push(g); } g.items.push(item(b.id)); });
    groups.push({ head: "A board of your own", items: [item("shuffle")] });
    B.picker.open({
      eyebrow: "Choose your board", title: "Every classic board, with its year",
      sub: "Every board whose layout is documented, oldest first, with its maker, country and year, played with the " + v.name + " rules. Each picture is drawn from the board's own layout in our own art.",
      groups: groups, chosen: chosen, aspect: 1,
      render: function (id) { return BD.preview ? BD.preview(id, true) : ""; },
      info: function (id) { var i = infoOf(id); return id === "shuffle" ? { name: "Shuffled fair board", meta: "New each game, about as long as the " + boardCap(v.board) + ".", note: "" } : { name: i ? i.name : boardCap(id), meta: i ? i.maker + " · " + i.country + ", " + i.year : "", note: boardFacts(id) }; },
      fit: function (pic, id, o) { var svg = pic && (pic.tagName === "svg" ? pic : pic.querySelector("svg")); if (svg && BD.previewFit) BD.previewFit(svg, id, o.width / 1000, o.floor); },
      pickLabel: "Play this board", keepLabel: "Keep this board",
      refocus: "#snpBoard",
      onPick: function (id) { if (id === "shuffle") cfg.over.board = "shuffle"; else if (id === v.board) delete cfg.over.board; else cfg.over.board = id; api.redraw(); }
    });
  }
  function versionName(c) {
    var v = E.versionOf(c.version) || E.VERSIONS[0], b = c.over && c.over.board;
    if (c.resume && savedGame()) return "Continue the saved game";
    return v.name + (b && b !== v.board ? " · " + (b === "shuffle" ? "shuffled board" : (infoOf(b) ? infoOf(b).name + ", " + infoOf(b).year : boardCap(b))) : "");
  }

  /* ================= the game ================= */
  async function start(H, cfg) {
    var SEATS = H.seats, n = SEATS.length, G = null, resumed = false;
    var f = function () { return (H.pace() || 1.8) / 1.8; };                 // Medium = 1, Slow = 1.75, Fast = .5 (the phone game's speedFactor)
    var sp = function (ms) { return Math.max(120, Math.round(ms * f())); };   // an animation's length
    var wait = function (ms) { return H.sleep(Math.max(0, ms) / 1.8); };      // a pause at the Game speed (H.sleep x PACE); never resolves after a quit
    var hex = function (s) { return LUXE[(SEATS[s].seat - 1) % LUXE.length] || SEATS[s].hex; };
    var ixOf = function (c) { for (var i = 0; i < n; i++) if (SEATS[i].color === c) return i; return -1; };
    var nm = function (s) { return G.players[s].name; };
    var stats = window.__snp = { seq: [], rolls: 0, phoneRolls: 0, cpuRolls: 0, hops: 0, climbs: 0, slides: 0, reconnects: 0, takes: 0, leaves: 0, views: 0, saves: 0, resumed: false };

    // ---- the players: the seats in order (phones keep their names; computers get fresh random names from the host) ----
    var players = SEATS.map(function (s) { return { name: H.name(s.color), human: H.isPhone(s.color), color: String(s.seat) }; });
    if (cfg.resume) {
      var sv = savedGame();
      if (sv && sv.G.n === n) {
        G = JSON.parse(JSON.stringify(sv.G)); resumed = true; stats.resumed = true;
        G.players.forEach(function (p, i) { p.name = players[i].name; p.human = players[i].human; p.color = players[i].color; });
      } else if (sv) H.toast("The saved game had " + sv.G.n + " players: a new game starts.");
    }
    if (!G) {
      var o = eff(cfg, n), yIx = -1;
      if (cfg.over && cfg.over.first === "youngest" && o.version === "american") {
        for (var k = 0; k < n; k++) if (SEATS[k].seat === cfg.youngest && H.isPhone(SEATS[k].color)) yIx = k;
        o = eff(cfg, n, yIx);
        if (yIx < 0) { o.first = "high"; o.youngest = -1; }
      }
      G = E.newGame(o, players);
    }
    window.__snp.G = G;
    var gm = E.geo(G), inf = infoOf(G.bd);

    // ---- the TV screen ----
    H.frame('<div class="snp" id="snp">' +
      '<div class="snp-board"><div class="sn-board bg-frame" data-stage-solid data-toast-avoid><div class="sn-art" id="snpArt" role="img" aria-label="The board">' +
      '<div class="sn-svghost" id="snpSvg"></div><div class="sn-toks" id="snpToks"></div>' +
      '<div class="sn-banner" id="snpBanner" aria-live="polite"><b id="snpBannerT"></b><span id="snpBannerS"></span></div></div></div></div>' +
      '<aside class="snp-side" aria-label="Standings and the roll">' +
      '<div class="snp-meta"><span class="snp-chip snp-chip--board" id="snpCap"></span><span class="snp-chip" id="snpTurn"></span></div>' +
      '<ul class="bg-players' + (n > 4 ? " is-two" : "") + '" id="snpPl" aria-label="Standings"></ul>' +
      '<div class="snp-roll"><div class="snp-dice" id="snpDice" aria-hidden="true"></div><p class="snp-stat" id="snpStat" role="status"></p></div>' +
      '<p class="snp-say" id="snpSay" data-stage-text></p>' +
      '<ol class="snp-log" id="snpLog" aria-label="What happened"></ol></aside></div>',
      "Players: roll on your phones");
    var $ = H.$, art = $("snpArt"), tokEls = [], disp = [], fpShow = false, busy = false, mover = -1;
    BD.build($("snpSvg"), G.L, G.bd);
    art.setAttribute("aria-label", boardCap(G.bd) + ": " + Object.keys(G.L).filter(function (k) { return +G.L[k] > +k; }).length + " ladders and " + Object.keys(G.L).filter(function (k) { return +G.L[k] < +k; }).length + " snakes");
    $("snpCap").textContent = G.bd === "shuffle" ? "Shuffled fair board" : boardCap(G.bd);
    G.players.forEach(function (p, s) {
      var el = document.createElement("div"); el.className = "sn-tok"; el.setAttribute("data-seat", SEATS[s].seat); el.setAttribute("data-s", s);
      el.innerHTML = '<div class="sn-hopw"><span class="bg-token" data-seat="' + SEATS[s].seat + '">' + esc((p.name.trim().charAt(0) || "?").toUpperCase()) + "</span></div>";
      $("snpToks").appendChild(el); tokEls.push(el);
    });
    disp = G.players.map(function (p) { return p.pos; });
    H.music(ID);

    function unit() { return art && art.isConnected ? art.clientWidth / BD.W : 0; }
    function tokR() { return 31 * (BD.scale ? BD.scale() : 1); }
    function layout() { var u = unit(); if (!u) return; BD.numbers(u, remPx() * .875); $("snpToks").style.setProperty("--tw", Math.round(2 * tokR() * u) + "px"); }
    var FAN = { 1: [[0, 0]], 2: [[-19, -6], [19, 6]], 3: [[-20, -12], [20, -12], [0, 16]], 4: [[-21, -19], [21, -19], [-21, 19], [21, 19]], 5: [[-27, -22], [27, -22], [0, 0], [-27, 22], [27, 22]], 6: [[-28, -21], [0, -21], [28, -21], [-28, 21], [0, 21], [28, 21]] };
    function restPose(s, pos) {
      if (!pos) { var a = BD.startSlot(s, G.n); return { x: a.x, y: a.y, k: G.n > 4 ? .9 : 1 }; }
      var c = BD.centre(pos), here = [], sc = BD.scale ? BD.scale() : 1;
      for (var q = 0; q < G.n; q++) if (disp[q] === pos) here.push(q);
      if (here.length < 2) return { x: c.x, y: c.y, k: 1 };
      var f2 = FAN[Math.min(6, here.length)][here.indexOf(s)] || [0, 0];
      return { x: c.x + f2[0] * sc, y: c.y + f2[1] * sc, k: here.length > 3 ? .68 : .74 };
    }
    function setPose(el, p) { el._p = p; var r = tokR() * (p.k || 1); el.style.left = ((p.x - r) / BD.W * 100) + "%"; el.style.top = ((p.y - r) / BD.H * 100) + "%"; el.style.width = (2 * r / BD.W * 100) + "%"; }
    function renderTokens() {
      tokEls.forEach(function (el, s) { setPose(el, restPose(s, disp[s])); el.classList.remove("is-moving"); el.classList.toggle("is-turn", !G.over && !fpShow && s === G.cur); el.classList.toggle("is-done", !!G.players[s].done); });
    }
    function glide(el, p, ms, ease) {
      var from = el._p || p, u = unit(); setPose(el, p);
      if (calm() || !el.animate || !ms || !u) return Promise.resolve();
      var k0 = (from.k || 1) / (p.k || 1), dx = (from.x - p.x) * u, dy = (from.y - p.y) * u;
      try { return el.animate([{ transform: "translate(" + dx.toFixed(1) + "px," + dy.toFixed(1) + "px) scale(" + k0.toFixed(3) + ")" }, { transform: "none" }], { duration: ms, easing: ease || "cubic-bezier(.3,.7,.3,1)" }).finished.then(function () { }, function () { }); } catch (e) { return Promise.resolve(); }
    }
    function hop(el) { var B = BG(), w = el.querySelector(".sn-hopw"); if (B && B.hop && w && !calm()) B.hop(w, { ms: sp(170), lift: Math.max(5, Math.round(unit() * 18)) }); }
    // the die (two with the House rule) or the American spinner
    function dice() {
      var box = $("snpDice"); var key = G.o.spinner ? "spin" : G.o.two ? "two" : "one"; if (box._k === key) return; box._k = key;
      if (G.o.spinner) { box.innerHTML = BD.spinnerSVG(); box._a = 0; }
      else { box.innerHTML = '<span class="bg-die"></span>' + (G.o.two ? '<span class="bg-die"></span>' : ""); var B = BG(); box.querySelectorAll(".bg-die").forEach(function (d, i) { if (B && B.dice) B.dice.render(d, i ? 6 : 5); }); }
    }
    function showRoll(d) {
      var box = $("snpDice"), B = BG();
      if (G.o.spinner) {
        var ar = box.querySelector(".sn-arrow"); if (!ar) return Promise.resolve();
        var to = (d[0] - 1) * 60 + (Math.random() * 24 - 12), a0 = box._a || 0, a1 = to + 360 * Math.ceil((a0 + 720 - to) / 360);
        box._a = a1 % 360; ar.style.transform = "rotate(" + box._a.toFixed(1) + "deg)";
        if (calm() || !ar.animate) return wait(300);
        H.sfx("tick");
        try { return ar.animate([{ transform: "rotate(" + a0.toFixed(1) + "deg)" }, { transform: "rotate(" + a1.toFixed(1) + "deg)" }], { duration: sp(900), easing: "cubic-bezier(.15,.6,.2,1)" }).finished.then(function () { }, function () { }); } catch (e) { return Promise.resolve(); }
      }
      var ps = [];
      box.querySelectorAll(".bg-die").forEach(function (el, i) { if (B && B.dice) { if (!calm()) ps.push(B.dice.roll(el, d[i], { ms: sp(600) })); else B.dice.render(el, d[i]); } });
      H.sfx("dice");
      return ps.length ? Promise.all(ps) : wait(250);
    }
    function status(t, s) { $("snpStat").textContent = t; H.status((s != null ? '<span class="dot" style="background:' + hex(s) + '"></span> ' : "") + esc(t)); }
    async function banner(title, sub, ms, kind) {
      var b = $("snpBanner"); if (!b) return; $("snpBannerT").textContent = title; $("snpBannerS").textContent = sub || "";
      b.className = "sn-banner" + (kind ? " is-" + kind : ""); b.classList.add("is-on");
      if (!calm() && b.animate) {
        try { await b.animate([{ opacity: 0, transform: "translate(-50%,-50%) scale(.6)" }, { opacity: 1, transform: "translate(-50%,-50%) scale(1.06)", offset: .18 }, { opacity: 1, transform: "translate(-50%,-50%) scale(1)", offset: .3 }, { opacity: 1, transform: "translate(-50%,-50%) scale(1)", offset: .85 }, { opacity: 0, transform: "translate(-50%,-50%) scale(.97)" }], { duration: ms, easing: "ease-out" }).finished; } catch (e) { await wait(ms); }
      } else await wait(ms);
      b.classList.remove("is-on");
    }
    // ---- the standings: live, sorted, every player on their own place (E.standings: finishers in finishing order, then the square,
    //      then who got there first, then seat order) ----
    function placeWord(r) { var p = G.players[r.s]; return p.done ? (r.place === 1 ? "Winner" : E.ord(r.place) + " home") : p.pos ? "Square " + p.pos : "Start"; }
    function renderStand() {
      var host = $("snpPl"); if (!host) return;
      var rows0 = E.standings(G);
      host.innerHTML = rows0.map(function (r) {
        var c = SEATS[r.s].color;
        return H.chipHTML({ color: hex(r.s), name: nm(r.s), tok: (nm(r.s).trim().charAt(0) || "?").toUpperCase(), meta: placeWord(r) + (H.isAway(c) ? " · away" : ""), cpu: !H.isPhone(c), turn: !G.over && !fpShow && r.s === (busy && mover >= 0 ? mover : G.cur), badge: E.ord(r.place) });
      }).join("");
      H.markTurn(host, "t" + (busy && mover >= 0 ? mover : G.cur));
      $("snpTurn").textContent = "Turn " + G.turn;
    }
    function renderLog() { var l = $("snpLog"); if (!l) return; l.innerHTML = G.log.slice(-4).map(function (e) { return "<li>" + esc(String(e.t).replace(/ → /g, " to ")) + "</li>"; }).join(""); }
    function say(r) {
      var el = $("snpSay"); if (!el) return;
      if (!r || !G.players[r.s]) { el.innerHTML = ""; return; }
      el.innerHTML = '<span class="bg-token" data-seat="' + SEATS[r.s].seat + '" aria-hidden="true">' + esc(nm(r.s).charAt(0).toUpperCase()) + "</span><span>" + esc(nm(r.s)) + ": “" + esc(r.text) + "”</span>";
    }
    function sync() { disp = G.players.map(function (p) { return p.pos; }); layout(); renderTokens(); renderStand(); renderLog(); dice(); }
    stats.sync = function () { if (!busy) { sync(); pushAll(false); } };   // tests: redraw after they set up a position
    window.addEventListener("resize", onResize); H.onEnd(function () { window.removeEventListener("resize", onResize); });
    function onResize() { if (!busy) { layout(); renderTokens(); } else layout(); }

    // ---- the phones: a slim view of the engine's snapshot (the board layout never goes to a phone) ----
    function phoneSt(c, rolling) {
      var i = ixOf(c), sn = E.snapshot(G, i), h = sn.hint;
      return { v: 1, me: i, cur: G.cur, turn: G.turn, step: G.step, over: G.over, spin: !!G.o.spinner, two: !!G.o.two, six: !!G.o.six, goal: gm.goal, end: gm.end,
        board: G.bd === "shuffle" ? "Shuffled fair board" : boardCap(G.bd), sixes: G.sixes, rolling: !!rolling,
        pl: G.players.map(function (p, k) { return { n: p.name, seat: SEATS[k].seat, pos: p.pos, done: p.done, cpu: !H.isPhone(SEATS[k].color) }; }),
        stand: sn.standings.map(function (r) { return { s: r.s, place: r.place }; }),
        hint: h ? { pos: h.pos, left: h.left, outs: h.outs, near: h.near, exact: h.exact, ahead: h.ahead.slice(0, 4).map(function (a) { return { kind: a.kind, roll: a.roll, at: a.at, to: a.to }; }), wait: G.players[i].pos === 0 && (G.o.needSix || gm.need6) } : null,
        last: G.last ? { s: G.last.s, d: G.last.d, tot: G.last.tot, from: G.last.from, to: G.last.to, kind: G.last.kind, jump: G.last.jump } : null,
        line: G.log.length ? String(G.log[G.log.length - 1].t).replace(/ → /g, " to ") : "" };
    }
    function pushAll(rolling) { H.pushAll(function (c) { return phoneSt(c, rolling); }); }
    H.onReconnect(function () { stats.reconnects++; pushAll(busy); });
    H.onTakeOver(function (c) { stats.takes++; var i = ixOf(c); if (i >= 0) G.players[i].human = true; H.push(c, phoneSt(c, busy)); renderStand(); });
    H.onLeave(function (c) { stats.leaves++; var i = ixOf(c); if (i >= 0) { G.players[i].human = false; G.players[i].name = H.name(c); var t = tokEls[i] && tokEls[i].querySelector(".bg-token"); if (t) t.textContent = (G.players[i].name.charAt(0) || "?").toUpperCase(); } renderStand(); pushAll(busy); });
    H.onView(function (c, d) { stats.views++; });
    // the Victory's rows in the same order as E.standings (the host sorts: winner, s keys bigger first, at smaller first, k)
    H.standings(function () {
      return G.players.map(function (p, s) {
        var fi = p.done ? G.fin.indexOf(s) : -1;
        return { name: p.name, color: hex(s), v: p.done ? (fi === 0 ? "Reached " + gm.goal : E.ord(fi + 1) + " home") : (p.pos ? "Square " + p.pos : "Start"), s: [p.done ? 1000 - fi : 0, p.done ? 0 : p.pos], win: s === G.winner, at: p.done ? 0 : p.at, k: s };
      });
    });
    function save() {
      if (G.over) { lsSet(KEY, null); return; }
      stats.saves++; lsSet(KEY, { v: SAVEV, G: G, t: Date.now() });
    }

    // ---- one roll's events, in order: the roll, the hops (one per square), then the ladder or snake as its own move ----
    function label(at) { var w = G.labels && G.labels[at]; if (w) return w; return inf && inf.names && inf.names[at] ? inf.names[at] : ""; }
    function named(x) { var w = label(x); return w ? (/\(/.test(w) ? ", " + w : " (" + w + ")") : ""; }
    function device(at) { return inf && inf.devices && inf.devices[at] ? inf.devices[at] : ""; }
    async function hops(s, path) {
      var el = tokEls[s]; if (!el) return; el.classList.add("is-moving");
      for (var i = 0; i < path.length; i++) {
        disp[s] = path[i]; stats.hops++; mark("h" + path[i]);
        glide(el, { x: BD.centre(path[i]).x, y: BD.centre(path[i]).y, k: 1 }, sp(150)); hop(el); H.sfx("tick");
        await wait(235);
      }
    }
    async function climb(s, foot, to) {
      var el = tokEls[s], mids = BD.rungs(foot), u = unit(); if (!el) return; stats.climbs++; mark("L" + foot + ">" + to);
      var end = BD.centre(to), cnt = mids ? mids.length : 0, per = clamp(Math.round(1700 / Math.max(1, cnt)), 70, 140), ms = Math.max(120, Math.round(per * cnt * f()));
      BD.glow(foot, ms + sp(500)); disp[s] = to; setPose(el, { x: end.x, y: end.y, k: 1 });
      if (calm() || !el.animate || !cnt || !u) { await wait(Math.min(900, per * cnt)); el._p = { x: end.x, y: end.y, k: 1 }; return; }
      var kf = mids.map(function (p, i) { return { transform: "translate(" + ((p.x - end.x) * u).toFixed(1) + "px," + ((p.y - end.y) * u).toFixed(1) + "px)", offset: i / cnt, easing: "cubic-bezier(.3,.8,.35,1)" }; });
      kf.push({ transform: "none", offset: 1 });
      for (var t = 0; t < cnt; t += 2) (function (t) { setTimeout(function () { if (H.live()) H.sfx("click"); }, Math.round(ms * t / cnt)); })(t);
      try { await el.animate(kf, { duration: ms }).finished; } catch (e) { }
    }
    async function slither(s, head, to) {
      var el = tokEls[s], pts = BD.snakePts(head), u = unit(), len = 0, i; if (!el) return; stats.slides++; mark("S" + head + ">" + to);
      var end = BD.centre(to);
      if (pts) for (i = 1; i < pts.length; i++) len += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
      var ms = Math.max(120, Math.round(Math.min(2600, 500 + len * 1.25) * f()));
      BD.glow(head, ms + sp(500)); disp[s] = to; setPose(el, { x: end.x, y: end.y, k: 1 });
      if (calm() || !el.animate || !pts || !u) { await wait(Math.min(1000, ms)); el._p = { x: end.x, y: end.y, k: 1 }; return; }
      var kf = [], stepN = Math.max(1, Math.floor(pts.length / 40));
      for (i = 0; i < pts.length; i += stepN) kf.push({ transform: "translate(" + ((pts[i].x - end.x) * u).toFixed(1) + "px," + ((pts[i].y - end.y) * u).toFixed(1) + "px)" });
      kf.push({ transform: "none" });
      try { await el.animate(kf, { duration: ms, easing: "cubic-bezier(.45,.05,.6,.95)" }).finished; } catch (e) { }
    }
    function mark(x) { stats.seq.push(x); if (stats.seq.length > 400) stats.seq.splice(0, 100); }   // what played, in order (tests read window.__snp)
    function shake(el) { if (calm() || !el || !el.animate) return; try { el.querySelector(".sn-hopw").animate([{ transform: "none" }, { transform: "translateX(-12%)" }, { transform: "translateX(10%)" }, { transform: "translateX(-6%)" }, { transform: "none" }], { duration: sp(420) }); } catch (e) { } }
    async function animEvent(e) {
      var s = e.s, el = tokEls[s], who = s != null && G.players[s] ? nm(s) : "";
      switch (e.e) {
        case "roll":
          tokEls.forEach(function (t, q) { t.classList.toggle("is-turn", q === s); });
          status(who + (e.spin ? " spins…" : " rolls…"), s);
          mark("R" + s + ":" + e.tot); H.hint(who + (e.spin ? " spins" : " rolls") + ": watch the board"); await showRoll(e.d);
          status(who + " " + (e.spin ? "spun" : "rolled") + " " + (e.d.length > 1 ? e.d[0] + " + " + e.d[1] + " = " + e.tot : e.tot) + (e.six ? "!" : ""), s);
          await wait(220); return;
        case "move":
          await hops(s, e.path);
          if (e.bounce) status(who + " bounces back from " + (e.turnAt || gm.end) + " to " + e.to, s);
          renderStand(); await wait(140); return;
        case "ladder": {
          await wait(180);
          var lw = label(e.from), arrow = !!(inf && inf.devices && inf.devices.all);
          H.sfx("meld");
          if (e.step) banner("Footprint!", e.from + " to " + e.to + named(e.to) + ": one row straight up", Math.round(1500 * f()), "ladder");
          else banner(arrow ? "Arrow!" : "Ladder!", (lw ? lw + ": " : "") + e.from + " to " + e.to + named(e.to), Math.round(1500 * f()), "ladder");
          status(who + " climbs from " + e.from + " to " + e.to, s);
          await climb(s, e.from, e.to); H.sfx("coin"); renderStand(); await wait(320); return;
        }
        case "snake": {
          await wait(180);
          var sw = label(e.from), dv = device(e.from);
          H.sfx("slide");
          banner(/scorpion/.test(dv) ? "Scorpion!" : "Snake!", (sw ? sw + ": " : "") + e.from + " down to " + e.to + (e.mid ? ", and the count goes on" : ""), Math.round(1500 * f()), "snake");
          status(who + " slides down from " + e.from + " to " + e.to, s);
          await slither(s, e.from, e.to); H.sfx("bump"); renderStand(); await wait(320); return;
        }
        case "stay": shake(el); H.sfx("discard"); await banner("Stay put", e.cap ? "Past " + e.cap + " a throw is lost" : who + " needs exactly " + e.need + " to reach " + gm.end, Math.round(1300 * f())); return;
        case "wait": shake(el); H.sfx("discard"); await banner("Needs a 6", who + " needs a 6 to start", Math.round(1200 * f())); return;
        case "void": H.sfx("bell"); await banner("Third 6", who + "'s third 6 in a row doesn't count", Math.round(1400 * f())); return;
        case "restart":
          H.sfx("jail"); banner("Back to the start", "Three 6s in a row", Math.round(1500 * f()), "snake");
          disp[s] = e.to; el.classList.add("is-moving");
          await glide(el, restPose(s, e.to), sp(900), "cubic-bezier(.5,0,.5,1)"); renderStand(); return;
        case "again": H.sfx("turn"); await banner("A 6!", who + (G.o.spinner ? " spins" : " rolls") + " again", Math.round(950 * f())); return;
        case "finish": {
          BD.crest(sp(1400)); renderStand();
          var gw = label(gm.goal);
          if (e.place === 1) { H.sfx("win"); await banner(gm.goal + "!", who + " reaches " + (gw ? gw : "the top") + " and wins", Math.round(1800 * f()), "win"); }
          else { H.sfx("conquer"); await banner(E.ord(e.place) + " place", who + " reaches " + gm.goal, Math.round(1300 * f()), "win"); }
          return;
        }
        default: return;
      }
    }
    // once per turn: the tension cues (a heartbeat near the goal; the snake heads within one roll pulse three times)
    var warned = -1;
    function turnStart() {
      if (G.over || warned === G.step) return; warned = G.step;
      var h = E.hint(G, G.cur); if (!h) return;
      if (h.near) { H.sfx("bump"); setTimeout(function () { if (H.live()) H.sfx("bump"); }, Math.round(260 * f())); }
      if (!calm()) { var heads = h.ahead.filter(function (a) { return a.kind === "snake"; }).map(function (a) { return a.at; }); if (heads.length) BD.warn(heads); }
    }

    // ---- who goes first: the engine already decided it (newGame); the shared show plays that result ----
    sync(); save();
    if (resumed) {
      status("Welcome back: turn " + G.turn + ", " + nm(G.cur) + " to " + (G.o.spinner ? "spin" : "roll"), G.cur);
      pushAll(false); await banner("Welcome back", "Turn " + G.turn + " · " + nm(G.cur) + (G.o.spinner ? " spins" : " rolls") + " next", Math.round(1800 * f()));
    } else {
      var fp = E.firstPlayer(G), B = BG();
      fpShow = true; renderTokens(); renderStand(); pushAll(false);
      if (fp.rule === "youngest") {
        fpShow = false; sync();
        await banner(nm(fp.winner) + " goes first", nm(fp.winner) + " is the youngest (2021 rules)", Math.round(1800 * f()));
      } else if (B && B.firstPlayer) {
        var rounds = fp.rounds.map(function (r) { var vals = {}; r.who.forEach(function (x, i) { vals[x] = r.vals[i]; }); return { who: r.who.slice(), vals: vals, top: r.who.filter(function (x, i) { return r.vals[i] === r.top; }) }; });
        var fpObs = null;
        if (fp.spinner && window.MutationObserver) {   // the shared show says "Draw again" for a card-style tie: here it is a spin
          document.addEventListener("bgui:firstplayer", function once(ev) {
            if (!ev.detail || !ev.detail.open) return; document.removeEventListener("bgui:firstplayer", once);
            var rt = document.querySelector(".bg-fp .bg-fp__rt"); if (!rt) return;
            fpObs = new MutationObserver(function () { if (/Draw again/.test(rt.textContent)) rt.textContent = rt.textContent.replace("Draw again", "Spin again"); });
            fpObs.observe(rt, { childList: true, characterData: true, subtree: true });
          });
        }
        var spinFace = function (v) { var svg = BD.spinnerSVG().replace(/<g class="sn-spin__nums">[\s\S]*?<\/g>/, "").replace('<g class="sn-arrow">', '<g class="sn-arrow" transform="rotate(' + ((v - 1) * 60) + ' 50 50)">'); return '<span class="sn-fpspin">' + svg + "<b>" + v + "</b></span>"; };
        var pin = function (i) { if (i >= 9 || !art.isConnected) return null; var a = art.getBoundingClientRect(), c = BD.centre(Math.min(gm.end - 1, 12 + i * Math.max(1, Math.floor(8 / Math.max(1, n - 1))))); return { x: a.left + c.x / BD.W * a.width, y: a.top + c.y / BD.H * a.height }; };
        await H.first({ mode: fp.spinner ? "card" : "die", layout: "peek", eyebrow: "Who goes first?", title: fp.spinner ? "Everyone spins the spinner" : "Everyone rolls the die",
          players: H.fpPlayers(), rounds: rounds, winner: fp.winner, pins: fp.spinner ? null : pin,
          face: fp.spinner ? spinFace : undefined,
          back: fp.spinner ? '<span class="sn-fpspin sn-fpspin--back">' + BD.spinnerSVG().replace(/<g class="sn-spin__nums">[\s\S]*?<\/g>/, "").replace(/<g class="sn-arrow">[\s\S]*?<\/g>/, "") + "</span>" : undefined,
          label: fp.spinner ? function (v) { return "Spun " + v; } : undefined,
          result: function (w) { return { title: nm(w) + " goes first", sub: fp.why }; },
          onWinner: function () { fpShow = false; renderTokens(); renderStand(); } }, SEATS[fp.winner].color);
        if (fpObs) fpObs.disconnect();
      }
      fpShow = false; sync();
    }

    // ---- the turns ----
    while (H.live() && !G.over) {
      var s = G.cur, c = SEATS[s].color, word = G.o.spinner ? "spin" : "roll";
      sync(); turnStart(); pushAll(false);
      var human = H.isHuman(c), m = null;
      if (human) {
        status(nm(s) + (G.sixes > 0 ? ": a 6! " + word + " again on your phone" : ": " + word + " on your phone"), s);
        H.hint(nm(s) + ": press " + (G.o.spinner ? "Spin" : "Roll") + " on your phone");
        var r = await H.turn(c, phoneSt(c, false), { title: G.sixes > 0 ? "A 6! " + (G.o.spinner ? "Spin" : "Roll") + " again" : "Your turn", sub: G.o.spinner ? "Spin the spinner" : G.o.two ? "Roll the dice" : "Roll the die", timeoutMs: window.__snpTO || 0 });
        if (!H.live()) return;
        if (r && r.id === "roll") { m = { t: "roll", s: s }; stats.phoneRolls++; stats.ph = stats.ph || {}; stats.ph[nm(s)] = (stats.ph[nm(s)] || 0) + 1; }
      }
      if (!m) {
        status(nm(s) + (G.o.spinner ? " is spinning" : " is rolling"), s);
        H.hint(nm(s) + (H.isPhone(c) ? " (the computer plays for an away phone)" : " (computer)") + " is " + (G.o.spinner ? "spinning" : "rolling"));
        var tf = 1; try { if (S.Brain && S.Brain.think) tf = S.Brain.think(G, s) || 1; } catch (e) { tf = 1; }
        await wait((G.sixes > 0 ? 480 : 620) * tf);
        try { if (S.Brain) m = S.Brain.decide(G, s); } catch (e) { m = null; }
        m = m || E.defaultMove(G, s); stats.cpuRolls++;
      }
      var res = E.apply(G, { t: m.t, s: m.s });
      if (!res.ok) { H.toast(res.msg); await wait(400); continue; }
      save();
      var line = null; try { if (S.Brain && S.Brain.react) line = S.Brain.react(G, res.ev); } catch (e) { line = null; }
      busy = true; mover = s; stats.rolls++; stats.lastEv = res.ev; pushAll(true);
      say(null);
      for (var i = 0; i < res.ev.length; i++) { if (!H.live()) return; await animEvent(res.ev[i]); }
      busy = false; mover = -1;
      if (line) say(line);
      sync(); pushAll(false);
    }
    if (!H.live()) return;
    // ---- the end ----
    try { if (S.Brain && S.Brain.finish) S.Brain.finish(G); } catch (e) { }
    lsSet(KEY, null);
    fpShow = false; sync(); pushAll(false);
    status(nm(G.winner) + " wins!", G.winner);
    H.hint("Game over");
    await wait(700);
    H.over(nm(G.winner));
    var sn = $("snp"); if (sn) { sn.classList.add("is-over"); layout(); renderTokens(); }   // the host adds New Game under the hint bar
  }

  P.define(ID, {
    defaults: defaults,
    restore: function (s) { var c = clean(s); c.resume = false; return c; },
    versionName: versionName,
    lobby: lobby,
    start: start,
    noWait: true
  });
})();
