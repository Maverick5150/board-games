/* CANDY LAND in Party Mode: the TV side (firestick/games/README.md is the guide; the registry line is in games/registry.js).
   The rules are the phone game's own engine (../candy/engine.js: pure, plain-JSON state, snapshot(G, seat)); the road and card art is
   ../candy/board.js (it draws whatever board the engine lists for a Version: E.BOARDS[G.bd]); the computers' characters are
   ../candy/brain.js. This file only drives them on the TV, as candy/game.js does:
   - the lobby: the engine's Version cards and rule rows (official options / House rules), the Board row that opens the big-preview
     picker (BGUI.picker: each Version's board, preview left, list right; the D-pad moves and the preview follows, OK picks, Back closes),
     "Who is the youngest?" (every edition: the youngest player goes first, then to the left; computers have no age), Continue the saved game;
   - who goes first: the engine's rule (the youngest, or seat 1 when nobody is picked), shown by the shared show as the playing order;
   - every card turns over BIG in front of the board (readable across the room), then flies to the discard pile; the reshuffle sends the
     played cards back; with "draw two" both cards stay on the table with where each one leads until the player picks on the phone;
   - every move hops through EVERY square it passes, one hop per square at the Game speed pace (a long picture trip ramps up, never under
     120 ms a square), THEN a shortcut glides along its ribbon / bridge as its own move; sticky and licorice squares get their banners;
   - the CEO's rule lives in the engine: you need the last colour to win (1984: a card must land exactly on the last purple square);
   - live standings in unique places 1..N (E.standings), the Victory in the same order, an autosave after every card (localStorage
     "party-candy-live"; Continue in the lobby when the table has the same number of players).
   Candy Land has no decisions (RULES.md 6) except "draw two, choose one": the cards are drawn here on the TV, never on a phone. */
(function () {
  "use strict";
  var P = window.PartyGames, CY = window.Candy, E = CY && CY.Engine, BD = CY && CY.Board;
  if (!P || !E || !BD) return;
  var ID = "candy", KEY = "party-candy-live", SAVEV = 1;
  var LUXE = ["#ff5d73", "#5f95ff", "#3fd391", "#ffcb4f", "#b383ff", "#38cbd2", "#ff9f4a", "#ff7ab8", "#8b93a8", "#c08a5a"];   // ui/theme.css --seat-1..10
  var CN = E.CNAME;
  function BG() { return window.BGUI || null; }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function plural(n, w) { return n + " " + w + (n === 1 ? "" : "s"); }
  function remPx() { return parseFloat(getComputedStyle(document.documentElement).fontSize) || 16; }
  function reduced() { var B = BG(); return document.documentElement.getAttribute("data-motion") === "reduce" || !!(B && B.reducedMotion && B.reducedMotion()); }
  function calm() { var B = BG(); return reduced() || !!(B && B.effects && B.effects.get && B.effects.get() === "reduced") || document.hidden; }
  function lsGet(k) { try { return JSON.parse(localStorage.getItem(k) || "null"); } catch (e) { return null; } }
  function lsSet(k, v) { try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, JSON.stringify(v)); } catch (e) { } }
  function ini(name) { return (String(name || "").trim().charAt(0) || "?").toUpperCase(); }
  function cap(s) { s = String(s || ""); return s.charAt(0).toUpperCase() + s.slice(1); }

  /* ---------- the game's look: icons, stage motifs and music (the same as candy/game.js registers on its own page) ---------- */
  var GLYPHS = {
    gumdrop: '<path d="M5 19c0-8 3.2-13 7-13s7 5 7 13z"/><path d="M8.5 11.5c.6-1.6 1.6-2.6 2.6-3"/><path d="M4 19h16"/>',
    lolly: '<circle cx="12" cy="9" r="6"/><path d="M12 15v7"/><path d="M12 9a1.4 1.4 0 1 1 1.4 1.4A3 3 0 1 1 9 8.6a4.4 4.4 0 1 1 6.6 3.4"/>',
    wrapped: '<path d="M8 8.5h8a3.5 3.5 0 0 1 0 7H8a3.5 3.5 0 0 1 0-7z"/><path d="M8 9.5L3 6v12l5-3.5M16 9.5L21 6v12l-5-3.5"/>',
    spire: '<path d="M12 2.5l1.2 2.6 2.8.4-2 2 .5 2.8-2.5-1.3-2.5 1.3.5-2.8-2-2 2.8-.4z"/><path d="M9 12h6l2 9H7z"/><path d="M8.2 16h7.6"/>',
    gingerbread: '<circle cx="12" cy="5.5" r="3"/><path d="M9 9.5h6l4 2.5-1 2-3-1.2V16l2 5h-2.6L12 17.5 10.6 21H8l2-5v-3.2L7 14l-1-2z"/>'
  };
  (function register() {
    var B = BG(); if (!B) return;
    try {
      if (B.icon && B.icon.add) { Object.keys(GLYPHS).forEach(function (k) { if (!B.icon.has || !B.icon.has(k)) B.icon.add(k, GLYPHS[k]); }); if (B.icon.seal && B.icon.seal.set) B.icon.seal.set(ID, "lolly"); }
      if (B.stage && B.stage.register) B.stage.register(ID, { motifs: ["lolly", "gumdrop", "wrapped", "spire", "gingerbread"] });
    } catch (e) { }
  })();
  if (window.Sound && Sound.addStyle && !(Sound.hasStyle && Sound.hasStyle(ID))) {
    try {
      Sound.addStyle(ID, { scales: ["major", "major", "mixo", "major"], bpm: [100, 128], swing: 0.18, sev: true, leadVol: 0.085, waves: ["triangle", "sine", "triangle"], bassKind: "walk",
        progs: [[0, 5, 3, 4], [0, 3, 4, 0], [0, 2, 3, 4], [0, 5, 1, 4], [0, 3, 1, 4], [0, 4, 5, 3], [0, 1, 3, 4], [0, 5, 3, 3]],
        bridge: [[3, 4, 2, 5], [5, 3, 4, 4], [3, 0, 4, 4], [1, 4, 0, 5]],
        rhythms: [[1, 0, 1, 1, 0, 1, 0, 1], [1, 1, 0, 1, 1, 0, 1, 0], [1, 0, 0, 1, 0, 1, 1, 0], [1, 0, 1, 0, 1, 1, 0, 1]],
        chordSteps: [0, 2, 4],
        drums: [{ kick: [1, 0, 0, 0, 1, 0, 0, 0], snare: [0, 0, 1, 0, 0, 0, 1, 0], sv: 0.05, hat: [1, 0, 1, 0, 1, 0, 1, 1], hv: 0.03 }, { kick: [1, 0, 0, 1, 0, 0, 1, 0], snare: [0, 0, 1, 0, 0, 1, 0, 0], sv: 0.06, hat: [1, 1, 1, 1, 1, 1, 1, 1], hv: 0.025 }, { kick: [1, 0, 1, 0, 0, 1, 0, 0], snare: [0, 0, 1, 0, 0, 0, 1, 0], sv: 0.05, hat: [0, 1, 0, 1, 0, 1, 0, 1], hv: 0.03 }],
        titles: ["Gumdrop Gallop", "The Sugarspire Waltz", "Ribbon Candy Rag", "Licorice Shuffle", "Marshmallow Moonrise", "Draw Me a Double", "Caramel Bog Blues", "Over the Wafer Bridge", "Sprinkles After Midnight", "Six Colours Home"] },
        { wave: "triangle", reg: 1 });
    } catch (e) { }
  }

  /* ---------- the CSS (scoped by html[data-pgame="candy"]: the lobby, the picker and the game screen; the board's own classes as on candy/) ---------- */
  var Q = 'html[data-pgame="candy"] ';
  var CSS = [
    'html[data-pgame="candy"]{--cdp-bw:min(calc((100vh - 10.75rem) * 1000 / 1120), 46vw)}',
    /* the lobby: the Board row (a thumbnail of the road, the board's name and facts, a chevron), the saved game */
    Q + ".cdp-brow{display:flex;align-items:center;gap:1rem;width:100%;min-height:5.5rem;padding:.75rem 1rem;text-align:left}",
    Q + ".cdp-bthumb{flex:none;width:4.1rem;height:4.6rem;border-radius:var(--r-sm);overflow:hidden;background:#2a1420;box-shadow:inset 0 0 0 1px var(--line-gold)}",
    Q + ".cdp-bthumb svg{display:block;width:100%;height:100%}",
    Q + ".cdp-brow .bg-row__title{font:400 var(--fs-xl)/1.2 var(--font-display);color:var(--gold-100)}",
    Q + ".cdp-brow .bg-row__desc{color:var(--text-2)}",
    Q + ".cdp-brow .cdp-chev{flex:none;display:inline-grid;place-items:center;width:1.5rem;height:1.5rem;color:var(--gold-200)}",
    Q + ".cdp-warn{margin:.5rem 0 0;font:var(--fw-ui-strong) var(--fs-sm)/1.4 var(--font-ui);color:#ffd9a0}",
    Q + ".cdp-res .bg-row__desc{color:var(--text-2)}",
    ".cdp-prevsvg{display:block;width:100%;height:100%}",
    /* the game: the road on the left at the full height; the standings, the cards, the log on the right */
    Q + ".cdp{display:grid;grid-template-columns:var(--cdp-bw) minmax(0,36rem);column-gap:3rem;align-items:start;justify-content:center;width:100%;min-height:0}",
    Q + ".cdp.is-over{--cdp-bw:min(calc((100vh - 15.5rem) * 1000 / 1120), 46vw)}",
    Q + ".cdp-boardc{position:relative;width:var(--cdp-bw)}",
    Q + ".cd-board{position:relative;width:100%;padding:.3rem;border-radius:1rem;background:linear-gradient(145deg,#f6e2ac,#b88a45 40%,#e9cb87 62%,#7d5523);box-shadow:0 .75rem 2rem rgba(0,0,0,.55)}",
    Q + ".cd-art{position:relative;width:100%;aspect-ratio:1000 / 1120;border-radius:.75rem;overflow:hidden;background:#2a1420;user-select:none}",
    Q + ".cd-art .cd-svg{position:absolute;inset:0;width:100%;height:100%;display:block;will-change:transform}",
    'html[data-pgame="candy"] .cd-svg .cd-startlbl{font-family:var(--font-display);fill:#5c1532;letter-spacing:.02em}',
    Q + ".cd-toks{position:absolute;inset:0;pointer-events:none}",
    Q + ".cd-tok{position:absolute;aspect-ratio:1;z-index:2;will-change:transform}",
    Q + ".cd-tok.is-turn{z-index:4}",
    Q + ".cd-tok.is-moving{z-index:5}",
    Q + ".cd-hopw{position:absolute;inset:0}",
    Q + ".cd-gb{position:absolute;inset:0;width:100%;height:100%;display:block;overflow:visible}",
    Q + ".cd-gb .cd-gbody{fill:var(--seat);stroke:#2a1208;stroke-width:4;stroke-linejoin:round}",
    Q + ".cd-gb .cd-gice{fill:none;stroke:#fff8ee;stroke-width:3.2;stroke-linecap:round;stroke-linejoin:round}",
    Q + ".cd-gb .cd-gring{fill:none;stroke:#fff3d1;stroke-width:5;opacity:0}",
    Q + ".cd-tok.is-turn .cd-gring{opacity:1;stroke:var(--seat-hi)}",
    Q + ".cd-tok.is-done .cd-gring{opacity:1;stroke:#e2bd72}",
    Q + ".cd-tok .cd-ini{position:absolute;left:0;right:0;top:52%;transform:translateY(-50%);text-align:center;font:800 max(var(--fs-micro), calc(var(--tw, 28px) * .36))/1 var(--font-ui);color:var(--seat-ink);pointer-events:none}",
    Q + ".cd-banner{position:absolute;left:50%;top:46%;z-index:8;display:grid;justify-items:center;gap:.3rem;width:max-content;max-width:88%;padding:.6rem 1.4rem .75rem;transform:translate(-50%,-50%);border-radius:var(--r-lg);background:linear-gradient(180deg,rgba(40,16,30,.95),rgba(12,8,16,.95));box-shadow:inset 0 0 0 1.5px var(--gold-200), 0 .8rem 2rem rgba(0,0,0,.6);text-align:center;pointer-events:none;opacity:0;visibility:hidden}",
    Q + ".cd-banner.is-on{opacity:1;visibility:visible}",
    Q + ".cd-banner b{font:400 var(--fs-4xl)/1.05 var(--font-display);color:var(--gold-100)}",
    Q + ".cd-banner span{font:var(--fw-ui-strong) var(--fs-lg)/1.3 var(--font-ui);color:#f6e9cf}",
    Q + ".cd-banner.is-bad{background:linear-gradient(180deg,rgba(54,14,24,.96),rgba(18,6,10,.96))}",
    Q + ".cd-banner.is-bad b{color:#ffc2c8}",
    Q + ".cd-banner.is-good{background:linear-gradient(180deg,rgba(64,22,52,.96),rgba(20,8,20,.96))}",
    Q + ".cd-banner.is-good b{color:#ffd6f0}",
    Q + ".cd-banner.is-win{background:linear-gradient(180deg,rgba(74,52,14,.96),rgba(26,18,4,.96))}",
    /* the side column */
    Q + ".cdp-side{display:flex;flex-direction:column;gap:.875rem;min-width:0;padding-top:.25rem}",
    Q + ".cdp-meta{display:flex;flex-wrap:wrap;gap:.5rem .75rem}",
    Q + ".cdp-chip{display:inline-flex;align-items:center;gap:.4rem;padding:.3rem .85rem;border-radius:var(--r-pill);background:var(--ink-3);box-shadow:inset 0 0 0 1px var(--line-1);font:var(--fw-ui-strong) var(--fs-sm)/1.3 var(--font-ui);color:var(--text-1);font-variant-numeric:tabular-nums}",
    Q + ".cdp-chip:empty{display:none}",
    Q + ".cdp-chip--board{color:var(--gold-100)}",
    Q + ".cdp-chip.is-hot{box-shadow:inset 0 0 0 1.5px var(--accent);color:var(--accent-text)}",
    Q + "#cdpPl.bg-players{grid-template-columns:repeat(2,minmax(0,1fr));gap:.75rem;padding:.5rem 0 0}",
    Q + "#cdpPl .bg-player{padding:.55rem .9rem .7rem .5rem}",
    Q + "#cdpPl .bg-token{width:2.25rem;height:2.25rem}",
    Q + "#cdpPl .bg-player__cpu{left:2.75rem}",
    Q + "#cdpPl .bg-badge{flex:none;min-width:2.6rem;text-align:center}",
    Q + ".cdp-stat{margin:0;min-height:1.4em;font:var(--fw-ui-strong) var(--fs-lg)/1.35 var(--font-ui);color:var(--text-1)}",
    Q + ".cdp-table{display:flex;align-items:flex-start;gap:1.5rem;min-height:9.5rem;padding-top:1.9rem}",
    Q + ".cdp-piles{display:flex;flex:none;align-items:flex-end;gap:2rem}",
    Q + ".cdp-pile{position:relative;width:5.25rem;aspect-ratio:100 / 140;flex:none}",
    Q + ".cdp-pile .cd-cardsvg{position:absolute;inset:0;width:100%;height:100%;display:block}",
    Q + ".cdp-pile .cd-cardsvg.is-under1{transform:translate(-3px,3px)}",
    Q + ".cdp-pile .cd-cardsvg.is-under2{transform:translate(-6px,6px)}",
    Q + ".cdp-pile.is-empty::before{content:\"\";position:absolute;inset:0;border-radius:.5rem;box-shadow:inset 0 0 0 2px rgba(231,202,144,.4);background:rgba(255,255,255,.03)}",
    Q + ".cdp-cnt{position:absolute;right:-.5rem;bottom:-.55rem;z-index:2;min-width:2.2rem;padding:.1rem .4rem;border-radius:var(--r-pill);background:var(--ink-1);box-shadow:inset 0 0 0 1.5px var(--gold-200);font:var(--fw-caps) var(--fs-micro)/1.2 var(--font-ui);color:var(--gold-100);text-align:center;font-variant-numeric:tabular-nums}",
    Q + ".cdp-pilelbl{position:absolute;left:50%;top:-1.75rem;transform:translateX(-50%);white-space:nowrap;font:var(--fw-caps) var(--fs-micro)/1 var(--font-ui);letter-spacing:.06em;text-transform:uppercase;color:var(--text-2)}",
    /* the two cards of "draw two": each with where it leads (the exact outcome) and the best one marked */
    Q + ".cdp-pick{flex:1;min-width:0;display:grid;gap:.6rem;margin-top:-1.5rem}",
    Q + ".cdp-pick[hidden]{display:none}",
    Q + ".cdp-pk{display:flex;align-items:center;gap:.75rem;min-height:4.4rem;padding:.35rem .75rem;border-radius:var(--r-md);background:var(--ink-2);box-shadow:inset 0 0 0 1px var(--line-1)}",
    Q + ".cdp-pk .cd-cardsvg{flex:none;width:2.9rem;height:auto;display:block}",
    Q + ".cdp-pk > span{display:grid;gap:.1rem;min-width:0}",
    Q + ".cdp-pk b{font:var(--fw-ui-strong) var(--fs-md)/1.2 var(--font-ui);color:var(--text-1)}",
    Q + ".cdp-pk small{font:var(--fw-ui) var(--fs-micro)/1.25 var(--font-ui);color:var(--text-2)}",
    Q + ".cdp-pk .bg-tag{justify-self:start}",
    Q + ".cdp-pk.is-best{box-shadow:inset 0 0 0 2px var(--gold-200)}",
    Q + ".cdp-pk.is-picked{box-shadow:inset 0 0 0 3px var(--accent), 0 0 1rem var(--accent-glow)}",
    Q + ".cdp-say{display:flex;align-items:center;gap:.6rem;margin:0;min-height:2.5rem;font:italic 400 var(--fs-md)/1.3 var(--font-display);color:var(--text-2)}",
    Q + ".cdp-say:empty{visibility:hidden}",
    Q + ".cdp-say .bg-token{flex:none;width:2rem;height:2rem;font:var(--fw-caps) var(--fs-micro)/1 var(--font-ui)}",
    Q + ".cdp-log{list-style:none;margin:0;padding:.75rem 1rem;display:grid;gap:.3rem;border-radius:var(--r-md);background:var(--ink-2);box-shadow:var(--well-edge);font:var(--fw-body) var(--fs-sm)/1.35 var(--font-ui);color:var(--text-2)}",
    Q + ".cdp-log li:last-child{color:var(--text-1)}",
    Q + ".cdp-log:empty{display:none}",
    Q + ".cdp.is-over .cdp-log li:nth-last-child(n+3){display:none}",
    /* the flying cards: a drawn card turns over BIG in front of the road (readable across the room), then flies to its pile */
    ".cdp-fly{position:fixed;inset:0;z-index:40;pointer-events:none}",
    ".cdp-fly .cd-big{position:fixed;display:grid;justify-items:center;align-content:start;gap:.5rem;will-change:transform}",
    ".cdp-fly .cd-fl{position:relative;width:100%;aspect-ratio:100 / 140;perspective:60rem}",
    ".cdp-fly .cd-fl > i{position:absolute;inset:0;transform-style:preserve-3d}",
    ".cdp-fly .cd-fl > i > span{position:absolute;inset:0;-webkit-backface-visibility:hidden;backface-visibility:hidden;border-radius:.6rem;box-shadow:0 1rem 2.4rem rgba(0,0,0,.6)}",
    ".cdp-fly .cd-fl > i > span.cd-back{transform:rotateY(180deg)}",
    ".cdp-fly .cd-cardsvg{width:100%;height:100%;display:block}",
    ".cdp-fly .cd-cap{padding:.25rem 1rem;border-radius:var(--r-pill);background:rgba(8,10,21,.9);box-shadow:inset 0 0 0 1px var(--gold-200);white-space:nowrap;font:400 var(--fs-3xl)/1.15 var(--font-display);color:var(--gold-100)}",
    ".cdp-fly .cd-big.is-small .cd-cap{display:none}",
    /* the who-goes-first show: each lane's card shows the playing order */
    Q + ".cd-fpface{display:grid;place-items:center;width:100%;height:100%;background:linear-gradient(180deg,#fffaf2,#f3e6d4)}",
    Q + ".cd-fpface b{font:400 var(--fs-2xl)/1 var(--font-display);color:#5c1532}",
    Q + ".cd-fpface b small{font-size:.55em}",
    Q + ".cd-fpback{display:block;width:100%;height:100%}",
    Q + ".cd-fpback .cd-cardsvg{width:100%;height:100%;display:block}",
    /* toasts over the side column, clear of the road */
    'html[data-pgame="candy"][data-tv] body.ps-ingame .bg-toast{left:calc(50vw + var(--cdp-bw) / 2 + 1.5rem);max-width:32rem}'
  ].join("\n");
  (function addCSS() { if (document.getElementById("cdp-css")) return; var st = document.createElement("style"); st.id = "cdp-css"; st.textContent = CSS; document.head.appendChild(st); })();

  /* ---------- the lobby settings: {version, over: {official options + House rules}, youngest: Luxe seat number of the youngest phone
     (0 = nobody picked: the first seat starts), resume} ---------- */
  function defaults() { return { version: E.VERSIONS[0].id, over: {}, youngest: 0, resume: false }; }
  function clean(c) {
    var d = defaults(); if (!c || typeof c !== "object") return d;
    if (E.versionOf(c.version)) d.version = c.version;
    var base = E.defaultOpts();
    if (c.over && typeof c.over === "object") Object.keys(c.over).forEach(function (k) { if (base.hasOwnProperty(k) && k !== "version" && k !== "youngest") d.over[k] = !!c.over[k]; });
    d.youngest = Math.max(0, Math.floor(+c.youngest) || 0);
    return d;
  }
  /* the effective rules for n players (the engine's normalize: "you need the last colour" only on the 1984 board, and so on) */
  function eff(c, n, youngIx) {
    var x = {}; for (var k in (c.over || {})) x[k] = c.over[k];
    x.youngest = youngIx == null ? -1 : youngIx;
    return E.normalize(E.versionOpts(c.version, x), n);
  }
  /* the rule rows for this Version (engine HOUSE rows; its row[4] = 1 means House, the Party lobby's row[4] means OFFICIAL: flipped) */
  function rows(c, n) {
    var o = eff(c, n);
    return E.houseRows(o.version, n, o).map(function (h) { return [h[0], h[1], h[2], h[3], h[4] ? 0 : 1]; });
  }
  function boardOfV(vid) { var v = E.versionOf(vid) || E.VERSIONS[0]; return E.BOARDS[v.board]; }
  function boardFacts(vid) {
    var B0 = boardOfV(vid); if (!B0) return "";
    var last = B0.track.charAt(E.END), sticky = Object.keys(B0.sticky).length;
    return [E.END + " squares", B0.pics.length + " picture squares", Object.keys(B0.short).length + " shortcuts",
      sticky + (B0.stickyKind === "until" ? " sticky squares" : " licorice squares"), last === "W" ? "a rainbow finish" : "the last square " + CN[last]].join(" · ");
  }
  /* the board picture for the lobby and the picker: the engine's board drawn by candy/board.js (cached per board; the one "Start" label is
     left out of these small pictures, so no text there can fall under the TV floor) */
  var PREV = {};
  function preview(vid) {
    var v = E.versionOf(vid) || E.VERSIONS[0]; if (PREV[v.board]) return PREV[v.board];
    var d = document.createElement("div");
    try { BD.build(d, v.board); } catch (e) { return ""; }
    var svg = d.querySelector("svg"); if (!svg) return "";
    svg.setAttribute("class", "cdp-prevsvg"); var t = svg.querySelector(".cd-startlbl"); if (t && t.parentNode) t.parentNode.removeChild(t);
    return (PREV[v.board] = d.innerHTML);
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
    if (!s || s.v !== SAVEV || !s.G || s.G.id !== "candy" || s.G.over || !Array.isArray(s.G.players)) return null;
    try { if (!E.BOARDS[s.G.bd] || E.check(s.G).length) return null; } catch (e) { return null; }
    return s;
  }
  function ago(t) { var m = Math.round((Date.now() - (+t || 0)) / 60000); return m < 1 ? "just now" : m < 60 ? plural(m, "minute") + " ago" : m < 1440 ? plural(Math.round(m / 60), "hour") + " ago" : plural(Math.round(m / 1440), "day") + " ago"; }
  function setFocus(el) { var B = BG(); if (!el) return; if (B && B.focus && B.focus.enabled && B.focus.set) B.focus.set(el); else try { el.focus({ preventScroll: true }); } catch (e) { } }

  var lobbyObs = null, lobbySig = "";
  function lobby(api, cfg, el) {
    if (!cfg.over) cfg.over = {};
    var n = Math.max(2, api.players()), B = BG();
    var af = document.activeElement, keepId = af && af.id && /^cdp/.test(af.id) ? af.id : null;
    var sv = savedGame(); if (!sv) cfg.resume = false;
    api.rules({ versions: E.VERSIONS, house: rows(cfg, n), opts: function (c) { return eff(c, n); } });
    var secs = el.querySelectorAll(".ps-sec"), vsec = secs[0], rsec = secs[1];
    var vd = vsec && vsec.querySelector(".ps-vdesc"), o = eff(cfg, n);
    // Computer skill, said honestly: the cards decide everything, except with "draw two, choose one"
    if (vd) vd.insertAdjacentHTML("beforeend", " " + esc((CY.Brain && (o.older ? CY.Brain.NOTE_CHOICE : CY.Brain.NOTE)) || "In Candy Land the cards decide everything: skill makes no difference."));
    // the Board row under the Version: the road of this Version, with the big-preview picker
    var v = E.versionOf(cfg.version) || E.VERSIONS[0];
    var bsec = '<section class="ps-sec cdp-bsec"><div class="bg-section"><h2 class="bg-eyebrow" data-stage-text>Board</h2></div>' +
      '<button type="button" class="bg-row aibtn cdp-brow" id="cdpBoard" aria-label="Board: the ' + esc(v.name) + ' board. See every board">' +
      '<span class="cdp-bthumb" aria-hidden="true">' + preview(v.id) + '</span>' +
      '<span class="bg-row__main"><span class="bg-row__title">' + esc(v.name + " board") + '</span><span class="bg-row__desc">' + esc(boardFacts(v.id)) + '</span></span>' +
      '<span class="cdp-chev" aria-hidden="true" data-icon="chevron"></span></button></section>';
    if (vsec) vsec.insertAdjacentHTML("afterend", bsec);
    // every edition: "The youngest player goes first. Play proceeds to the left." (computers have no age; nobody picked = seat 1 starts)
    if (rsec) {
      var ph = seatedPhones(), yo = ph.filter(function (p) { return p.seat === cfg.youngest; })[0];
      if (!yo) cfg.youngest = 0;
      var row = '<div class="ps-rule"><span class="bg-tag bg-tag--official">official</span><button type="button" class="bg-row aibtn" id="cdpYoung"><span class="bg-row__main"><span class="bg-row__title">Who is the youngest?</span></span><span class="bg-sr">: </span><span class="ps-val">' +
        esc(yo ? yo.name + " goes first" : ph.length ? "Not picked: the first seat starts" : "Waiting for phones") + '</span><span class="bg-ico-slot" aria-hidden="true" data-icon="chevron"></span></button></div>';
      var rl = rsec.querySelector(".ps-rules"); if (rl) rl.insertAdjacentHTML("afterbegin", row);
    }
    // Continue the saved game (the table needs the same number of players)
    if (sv) {
      var sn = sv.G.n, ok = sn === n, names = sv.G.players.map(function (p) { return p.name; }).join(", "), sv0 = E.versionOf(sv.G.o.version) || E.VERSIONS[0];
      var res = '<section class="ps-sec cdp-res"><div class="bg-section"><h2 class="bg-eyebrow" data-stage-text>Saved game</h2></div><div class="ps-rules"><div class="ps-rule"><span class="bg-tag bg-tag--official">saved</span>' +
        '<button type="button" class="bg-row aibtn' + (cfg.resume ? " on" : "") + '" role="switch" aria-checked="' + !!cfg.resume + '" id="cdpResume"><span class="bg-row__main"><span class="bg-row__title">Continue the saved game</span>' +
        '<span class="bg-row__desc">' + esc("Turn " + sv.G.turn + " · " + sv0.name + " · " + sn + " players (" + names + ") · saved " + ago(sv.t)) + '</span></span>' +
        '<span class="bg-sr">: ' + (cfg.resume ? "ON" : "off") + '</span><span class="bg-toggle" aria-hidden="true"></span></button></div></div>' +
        (cfg.resume && !ok ? '<p class="cdp-warn" role="status">The saved game had ' + sn + ' players and this table has ' + n + '. Seat ' + sn + ' (phones and computers) to continue it; otherwise a new game starts.</p>' : "") +
        (cfg.resume && ok ? '<p class="ps-vdesc">The saved game keeps its own Version and rules; the phones take its seats in order.</p>' : "") + '</section>';
      el.insertAdjacentHTML("afterbegin", res);
    }
    if (api.paintIcons) api.paintIcons(el);
    var bb = el.querySelector("#cdpBoard"); if (bb) bb.onclick = function () { openPicker(api, cfg); };
    var yb = el.querySelector("#cdpYoung"); if (yb) yb.onclick = function () {
      var ph2 = seatedPhones(); if (!ph2.length) { api.toast("The youngest player joins from a phone first."); return; }
      var ix = -1; ph2.forEach(function (p, i) { if (p.seat === cfg.youngest) ix = i; });
      cfg.youngest = ix + 1 < ph2.length ? ph2[ix + 1].seat : 0; api.redraw();       // each phone in turn, then "not picked"
    };
    var rb = el.querySelector("#cdpResume"); if (rb) rb.onclick = function () { cfg.resume = !cfg.resume; api.redraw(); };
    if (keepId) setFocus(document.getElementById(keepId));
    // the player count and the seated phones change in the host's own rows: redraw this box when they do (the youngest row)
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
  /* the boards of every Version with the BIG PREVIEW (BGUI.picker; TV: preview left, list right; the D-pad moves and the preview follows;
     OK picks the Version; Back closes). Whatever boards the engine lists are offered. */
  function openPicker(api, cfg) {
    var B = BG(); if (!B || !B.picker) { api.toast("The board picker didn't load."); return; }
    var items = E.VERSIONS.map(function (v) {
      return { id: v.id, name: v.name + " board", meta: v.tag, desc: v.desc, detail: boardFacts(v.id), tags: [{ text: "Official", kind: "official" }], small: preview(v.id) };
    });
    B.picker.open({
      eyebrow: "Choose your board", title: "Every Candy Land board",
      sub: "Each Version has its own road: the colours, the picture squares, the shortcuts and the sticky or licorice squares are placed as on that edition's board, drawn in our own art.",
      items: items, chosen: cfg.version, aspect: 1000 / 1120,
      render: function (id) { return preview(id); },
      info: function (id) { var v = E.versionOf(id) || E.VERSIONS[0]; return { name: v.name + " board", meta: v.tag, note: boardFacts(id) }; },
      pickLabel: "Play this board", keepLabel: "Keep this board",
      refocus: "#cdpBoard",
      onPick: function (id) { if (id !== cfg.version) { cfg.version = id; cfg.over = {}; } api.redraw(); }
    });
  }
  function versionName(c) {
    var v = E.versionOf(c.version) || E.VERSIONS[0];
    if (c.resume && savedGame()) return "Continue the saved game";
    return v.name + (c.over && c.over.older ? " · draw two" : "");
  }

  /* ================= the game ================= */
  async function start(H, cfg) {
    var SEATS = H.seats, n = SEATS.length, G = null, resumed = false;
    var f = function () { return (H.pace() || 1.8) / 1.8; };                 // Medium = 1, Slow = 1.75, Fast = .5 (the phone game's speedFactor)
    var sp = function (ms) { return Math.max(120, Math.round(ms * f())); };   // an animation's length
    var wait = function (ms) { return H.sleep(Math.max(0, ms) / 1.8); };      // a pause at the Game speed (H.sleep x PACE); never resolves after a quit
    var waitReal = function (ms) { return H.sleep(Math.max(0, ms) / (H.pace() || 1.8)); };   // a pause of exactly ms (already scaled)
    var hex = function (s) { return LUXE[(SEATS[s].seat - 1) % LUXE.length] || SEATS[s].hex; };
    var ixOf = function (c) { for (var i = 0; i < n; i++) if (SEATS[i].color === c) return i; return -1; };
    var nm = function (s) { return G.players[s].name; };
    var stats = window.__cdp = { ask: null, seq: [], cards: 0, phoneDraws: 0, phonePicks: 0, cpuMoves: 0, hops: 0, glides: 0, flips: 0, reshuffles: 0, banners: [], reconnects: 0, takes: 0, leaves: 0, saves: 0, resumed: false };

    // ---- the players: the seats in order (phones keep their names; computers get fresh random names from the host) ----
    var players = SEATS.map(function (s) { var ph = H.isPhone(s.color); return { name: H.name(s.color), human: ph, color: String(s.seat), skill: ph ? null : H.skill() }; });
    if (cfg.resume) {
      var sv = savedGame();
      if (sv && sv.G.n === n) {
        G = JSON.parse(JSON.stringify(sv.G)); resumed = true; stats.resumed = true;
        G.players.forEach(function (p, i) { p.name = players[i].name; p.human = players[i].human; p.color = players[i].color; p.skill = players[i].skill; });
      } else if (sv) H.toast("The saved game had " + sv.G.n + " players: a new game starts.");
    }
    if (!G) {
      var yIx = -1;
      for (var k = 0; k < n; k++) if (cfg.youngest && SEATS[k].seat === cfg.youngest && H.isPhone(SEATS[k].color)) yIx = k;
      G = E.newGame(eff(cfg, n, yIx), players);
    }
    stats.G = G;
    var BRD = E.BOARDS[G.bd], ver = E.versionOf(G.o.version) || E.VERSIONS[0];

    // ---- the TV screen ----
    H.frame('<div class="cdp" id="cdp">' +
      '<div class="cdp-boardc"><div class="cd-board bg-frame" data-stage-solid data-toast-avoid><div class="cd-art" id="cdpArt" role="img" aria-label="The board">' +
      '<div class="cd-svghost" id="cdpSvg"></div><div class="cd-toks" id="cdpToks"></div>' +
      '<div class="cd-banner" id="cdpBanner" aria-live="polite"><b id="cdpBannerT"></b><span id="cdpBannerS"></span></div></div></div></div>' +
      '<aside class="cdp-side" aria-label="Standings and the cards">' +
      '<div class="cdp-meta"><span class="cdp-chip cdp-chip--board" id="cdpCap"></span><span class="cdp-chip" id="cdpTurn"></span><span class="cdp-chip" id="cdpNeed"></span><span class="cdp-chip" id="cdpAside"></span></div>' +
      '<ul class="bg-players" id="cdpPl" aria-label="Standings"></ul>' +
      '<p class="cdp-stat" id="cdpStat" role="status"></p>' +
      '<div class="cdp-table"><div class="cdp-piles">' +
      '<div class="cdp-pile" id="cdpDeck" aria-label="Draw pile"><span class="cdp-pilelbl" data-stage-text>Cards</span><span class="cdp-cnt" id="cdpDeckN">0</span></div>' +
      '<div class="cdp-pile" id="cdpDisc" aria-label="Discard pile"><span class="cdp-pilelbl" data-stage-text>Played</span><span class="cdp-cnt" id="cdpDiscN">0</span></div></div>' +
      '<div class="cdp-pick" id="cdpPick" hidden></div></div>' +
      '<p class="cdp-say" id="cdpSay" data-stage-text></p>' +
      '<ol class="cdp-log" id="cdpLog" aria-label="What happened"></ol></aside></div>',
      "Players: draw on your phones");
    var $ = H.$, art = $("cdpArt"), tokEls = [], disp = [], fpShow = false, busy = false, mover = -1;
    var fly = document.createElement("div"); fly.className = "cdp-fly"; fly.setAttribute("aria-hidden", "true"); document.body.appendChild(fly);
    H.onEnd(function () { if (fly.parentNode) fly.parentNode.removeChild(fly); });
    BD.build($("cdpSvg"), G.bd);
    art.setAttribute("aria-label", ver.name + " board: " + E.END + " squares from the start to " + E.GOAL_NAME + ", " + BRD.pics.length + " picture squares, " + Object.keys(BRD.short).length + " shortcuts and " + Object.keys(BRD.sticky).length + " " + (BRD.stickyKind === "until" ? "sticky" : "licorice") + " squares");
    $("cdpCap").textContent = ver.name + (G.o.older ? " · draw two" : "");
    var GB = '<svg class="cd-gb" viewBox="0 0 100 100" aria-hidden="true" focusable="false"><ellipse class="cd-gring" cx="50" cy="56" rx="46" ry="44"/>' +
      '<path class="cd-gbody" d="M50 6a17 17 0 0 1 9.5 31.1C66 39 72 40.5 82 41.5c8 .8 9 13.2 0 14.2l-12 1.1V66l12 22.5c4 7.6-6.4 12.4-11 6L57 78.4h-14L29 94.5c-4.6 6.4-15-1.6-11-6L30 66v-9.2l-12-1.1c-9-1-8-13.4 0-14.2 10-1 16-2.5 22.5-4.4A17 17 0 0 1 50 6z"/>' +
      '<path class="cd-gice" d="M16 46.5q4 3 8 0t8 0M68 46.5q4 3 8 0t8 0M26 87q3-4 6-1M68 86q3-3 6 1M42 19a2 2 0 1 0 0 .1M58 19a2 2 0 1 0 0 .1M43 27q7 5 14 0"/></svg>';
    G.players.forEach(function (p, s) {
      var el = document.createElement("div"); el.className = "cd-tok"; el.setAttribute("data-seat", SEATS[s].seat); el.setAttribute("data-s", s);
      el.innerHTML = '<div class="cd-hopw">' + GB + '<span class="cd-ini">' + esc(ini(p.name)) + "</span></div>";
      $("cdpToks").appendChild(el); tokEls.push(el);
    });
    disp = G.players.map(function (p) { return p.pos; });
    H.music(ID);

    var TR = 36;   // a mover's half size in board units (a square is about 54 x 64)
    function unit() { return art && art.isConnected ? art.clientWidth / BD.W : 0; }
    function layout() { var u = unit(); if (!u) return; BD.label(u, remPx() * .875); $("cdpToks").style.setProperty("--tw", Math.round(2 * TR * u) + "px"); }
    var FAN = { 1: [[0, 0]], 2: [[-16, -8], [16, 8]], 3: [[-18, -12], [18, -12], [0, 14]], 4: [[-18, -15], [18, -15], [-18, 15], [18, 15]] };
    function restPose(s, pos) {
      if (!pos) { var ss = BD.startSlot(s, G.n); return { x: ss.x, y: ss.y, k: .82 }; }
      var c = BD.centre(pos), here = [];
      for (var q = 0; q < G.n; q++) if (disp[q] === pos) here.push(q);
      if (here.length < 2) return { x: c.x, y: c.y - 6, k: 1 };
      var f2 = FAN[Math.min(4, here.length)][here.indexOf(s)] || [0, 0];
      return { x: c.x + f2[0], y: c.y + f2[1] - 6, k: here.length > 2 ? .7 : .78 };
    }
    function setPose(el, p) { el._p = p; var r = TR * (p.k || 1); el.style.left = ((p.x - r) / BD.W * 100) + "%"; el.style.top = ((p.y - r) / BD.H * 100) + "%"; el.style.width = (2 * r / BD.W * 100) + "%"; }
    function renderTokens() {
      tokEls.forEach(function (el, s) { setPose(el, restPose(s, disp[s])); el.classList.remove("is-moving"); el.classList.toggle("is-turn", !G.over && !fpShow && s === G.cur); el.classList.toggle("is-done", !!G.players[s].done); });
    }
    function glide(el, p, ms, ease) {
      var from = el._p || p, u = unit(); setPose(el, p);
      if (calm() || !el.animate || !ms || !u) return Promise.resolve();
      var k0 = (from.k || 1) / (p.k || 1), dx = (from.x - p.x) * u, dy = (from.y - p.y) * u;
      try { return el.animate([{ transform: "translate(" + dx.toFixed(1) + "px," + dy.toFixed(1) + "px) scale(" + k0.toFixed(3) + ")" }, { transform: "none" }], { duration: ms, easing: ease || "cubic-bezier(.3,.7,.3,1)" }).finished.then(function () { }, function () { }); } catch (e) { return Promise.resolve(); }
    }
    function hop(el, ms) { var B = BG(), w = el.querySelector(".cd-hopw"); if (B && B.hop && w && !calm()) B.hop(w, { ms: ms, lift: Math.max(5, Math.round(unit() * 20)) }); }
    function shake(el) { if (calm() || !el || !el.animate) return; try { el.querySelector(".cd-hopw").animate([{ transform: "none" }, { transform: "translateX(-12%) rotate(-8deg)" }, { transform: "translateX(10%) rotate(6deg)" }, { transform: "translateX(-6%) rotate(-3deg)" }, { transform: "none" }], { duration: sp(460) }); } catch (e) { } }
    function mark(x) { stats.seq.push(x); if (stats.seq.length > 600) stats.seq.splice(0, 150); }   // what played, in order (tests read window.__cdp)

    // ---- the cards on the table: the draw pile, the discard pile, the set-aside picture cards, the two cards of "draw two" ----
    var dk = { n: 64, dn: 0, top: null, hand: [], aside: 0, landed: {} };
    function syncDeck() { dk.n = G.deck.length; dk.dn = G.disc.length; dk.top = G.disc.length ? G.disc[G.disc.length - 1] : null; dk.hand = G.hand.slice(); dk.aside = G.aside.length; dk.landed = {}; }
    function pub(id) { return E.cardPublic(G, id); }
    function renderPiles() {
      var d = $("cdpDeck"), x = $("cdpDisc"); if (!d || !x) return;
      var dKey = Math.min(3, dk.n), xKey = dk.top == null ? "e" : String(dk.top);
      if (d._k !== dKey) { d._k = dKey; Array.prototype.forEach.call(d.querySelectorAll(".cd-cardsvg"), function (e) { e.remove(); }); var h = ""; for (var i = Math.min(3, dk.n) - 1; i >= 0; i--) h += BD.backSVG("cd-cardsvg" + (i ? " is-under" + i : "")); d.insertAdjacentHTML("afterbegin", h); d.classList.toggle("is-empty", !dk.n); }
      if (x._k !== xKey) { x._k = xKey; Array.prototype.forEach.call(x.querySelectorAll(".cd-cardsvg"), function (e) { e.remove(); }); if (dk.top != null) x.insertAdjacentHTML("afterbegin", BD.cardSVG(pub(dk.top))); x.classList.toggle("is-empty", dk.top == null); }
      $("cdpDeckN").textContent = dk.n; $("cdpDiscN").textContent = dk.dn;
      $("cdpAside").textContent = G.o.treatsOnce && dk.aside ? plural(dk.aside, "picture card") + " used up" : "";
    }
    function lastColour() { var t = BRD.track; return CN[t.charAt(t.length - 1)] === "rainbow" ? "the rainbow" : CN[t.charAt(t.length - 1)]; }
    /* where a card leads seat s (the exact outcome, the same words as candy/game.js) */
    function outText(s, id) {
      var r = E.outcome(G, s, id);
      if (r.stay === "stuck") return "Still stuck (needs " + CN[G.players[s].stuck] + ")";
      if (r.stay === "same") return "Already on that square";
      if (r.stay === "exact") return "Needs " + lastColour() + " to finish: no move";
      if (r.redraw) return "That square is taken: draw again";
      var t = (r.kind === "picture" ? (r.dir < 0 ? "Back to " : "To ") + "square " + r.land : "To " + (r.win && !r.seq.length ? (r.over ? "past the end" : "the rainbow") : "square " + r.land));
      r.seq.forEach(function (x) { t += x.e === "shortcut" ? ", " + x.name + " to " + x.to : ", taken: on to " + x.to; });
      if (r.win) t += ": wins!";
      else if (r.sticky) t += ": stuck until " + CN[r.sticky];
      else if (r.lose) t += ": loses a turn";
      return t;
    }
    /* the best of the two cards: the fewest expected turns home (the engine's exact table; the Normal computers' measure). Read only */
    function bestPick(s) {
      if (G.hand.length !== 2) return -1;
      try {
        var T = E.table(G.o, 1e-7), pos = G.players[s].pos;
        var v = G.hand.map(function (id) { var r = E.outcome(G, s, id); if (r.win) return -1; if (r.redraw || r.stay) return T.E[pos] + (r.redraw ? 0 : .001); return T.E[r.to] + (r.lose ? 1 : 0); });
        return v[0] <= v[1] ? 0 : 1;
      } catch (e) { return -1; }
    }
    var picked = -1, pickMemo = {};   // pickMemo: each card's outcome line and best mark, kept from the choice while the pick plays out
    function renderPick() {
      var box = $("cdpPick"); if (!box) return;
      var show = dk.hand.length > 0 && !G.over; box.hidden = !show;
      if (!show) { pickMemo = {}; if (box._k !== "") { box._k = ""; box.innerHTML = ""; } return; }
      var s = G.cur, ready = G.phase === "choose" && dk.hand.length === 2 && G.hand.length === 2 && G.hand.join() === dk.hand.join(), best = ready ? bestPick(s) : -1;
      if (ready) { pickMemo = {}; dk.hand.forEach(function (id, i) { pickMemo[id] = { t: outText(s, id), b: i === best }; }); }
      var key = dk.hand.join(",") + "|" + ready + "|" + best + "|" + picked + "|" + dk.hand.map(function (id) { return pickMemo[id] ? 1 : 0; }).join("");
      if (box._k === key) return; box._k = key;
      box.innerHTML = dk.hand.map(function (id, i) {
        var cd = pub(id), m = pickMemo[id], isBest = !!(m && m.b);
        return '<div class="cdp-pk' + (isBest ? " is-best" : "") + (i === picked ? " is-picked" : "") + '" data-i="' + i + '">' + BD.cardSVG(cd) + "<span><b>" + esc(BD.cardWords(cd)) + "</b><small>" + esc(m ? m.t : "Drawing…") + "</small>" + (isBest ? '<span class="bg-tag bg-tag--accent">best</span>' : "") + "</span></div>";
      }).join("");
    }
    function status(t, s) { $("cdpStat").textContent = t; H.status((s != null ? '<span class="dot" style="background:' + hex(s) + '"></span> ' : "") + esc(t)); }
    async function banner(title, sub, ms, kind) {
      var b = $("cdpBanner"); if (!b) return; $("cdpBannerT").textContent = title; $("cdpBannerS").textContent = sub || "";
      stats.banners.push(title); if (stats.banners.length > 80) stats.banners.splice(0, 20);
      b.className = "cd-banner" + (kind ? " is-" + kind : ""); b.classList.add("is-on");
      if (!calm() && b.animate) {
        try { await b.animate([{ opacity: 0, transform: "translate(-50%,-50%) scale(.6)" }, { opacity: 1, transform: "translate(-50%,-50%) scale(1.06)", offset: .18 }, { opacity: 1, transform: "translate(-50%,-50%) scale(1)", offset: .3 }, { opacity: 1, transform: "translate(-50%,-50%) scale(1)", offset: .85 }, { opacity: 0, transform: "translate(-50%,-50%) scale(.97)" }], { duration: Math.round(ms * f()), easing: "ease-out" }).finished; } catch (e) { await wait(ms); }
      } else await wait(ms);
      b.classList.remove("is-on");
    }
    // ---- the standings: live, sorted, every player on their own place (E.standings: the winner, then the square, then who got there
    //      first, then seat order) ----
    function standMeta(s) { var p = G.players[s]; if (p.done) return "Home!"; if (p.stuck) return "Stuck: needs " + CN[p.stuck]; if (p.skip) return "Loses next turn"; return p.pos ? "Square " + p.pos : "Start"; }   // short: the chip never cuts it
    function renderStand() {
      var host = $("cdpPl"); if (!host) return;
      var who = busy && mover >= 0 ? mover : G.cur;
      host.innerHTML = E.standings(G).map(function (r) {
        var c = SEATS[r.s].color, p = G.players[r.s];
        var pos = p.done ? E.END : (disp[r.s] != null ? disp[r.s] : p.pos);
        return H.chipHTML({ color: hex(r.s), name: nm(r.s), tok: ini(nm(r.s)), meta: (p.done ? "Home!" : busy && r.s === mover ? (pos ? "Square " + pos : "Start") : standMeta(r.s)) + (H.isAway(c) ? " · away" : ""), cpu: !H.isPhone(c), turn: !G.over && !fpShow && r.s === who, badge: E.ord(r.place) });
      }).join("");
      H.markTurn(host, "t" + who);
      $("cdpTurn").textContent = "Turn " + G.turn;
      var h = null; try { h = !G.over ? E.hint(G, G.cur) : null; } catch (e) { h = null; }
      var need = $("cdpNeed");
      if (h && h.near && !busy && !fpShow) { need.textContent = nm(G.cur) + ": " + Math.round(h.pWin * 100) + "% to win with this " + (G.o.older ? "draw" : "card"); need.classList.add("is-hot"); }
      else { need.textContent = ""; need.classList.remove("is-hot"); }
    }
    function renderLog() { var l = $("cdpLog"); if (!l) return; l.innerHTML = G.log.slice(-4).map(function (e) { return "<li>" + esc(String(e.t).replace(/ → /g, " to ")) + "</li>"; }).join(""); }
    function say(r) {
      var el = $("cdpSay"); if (!el) return;
      if (!r || !G.players[r.s]) { el.innerHTML = ""; return; }
      el.innerHTML = '<span class="bg-token" data-seat="' + SEATS[r.s].seat + '" aria-hidden="true">' + esc(ini(nm(r.s))) + "</span><span>" + esc(nm(r.s)) + ": “" + esc(r.text) + "”</span>";
    }
    function sync() { disp = G.players.map(function (p) { return p.pos; }); syncDeck(); layout(); renderTokens(); renderStand(); renderLog(); renderPiles(); renderPick(); }
    stats.sync = function () { if (!busy) { sync(); pushAll(false); } };   // tests: redraw after they set up a position
    window.addEventListener("resize", onResize); H.onEnd(function () { window.removeEventListener("resize", onResize); });
    function onResize() { layout(); if (!busy) renderTokens(); }

    // ---- the phones: a slim view of the engine's snapshot (the board never goes to a phone; the cards are drawn here) ----
    function phoneSt(c, ask, playing) {
      var i = ixOf(c), sn = E.snapshot(G, i), h = sn.hint, best = G.phase === "choose" ? bestPick(G.cur) : -1;
      var L = G.last;
      return { v: 1, me: i, cur: G.cur, turn: G.turn, step: G.step, phase: G.phase, over: G.over, ask: ask || null, busy: !!playing, mover: playing ? mover : -1,
        older: !!G.o.older, exact: !!G.o.exact, ver: ver.name, last: lastColour(), deck: G.deck.length, goal: E.END,
        pl: G.players.map(function (p, k) { return { n: p.name, seat: SEATS[k].seat, pos: p.pos, done: p.done, stuck: p.stuck ? CN[p.stuck] : null, skip: p.skip, cpu: !H.isPhone(SEATS[k].color) }; }),
        stand: sn.standings.map(function (r) { return { s: r.s, place: r.place }; }),
        hand: G.phase === "choose" && G.hand.length === 2 ? G.hand.map(function (id, k) { var cd = pub(id); return { cd: cd, w: BD.cardWords(cd), out: outText(G.cur, id), best: k === best }; }) : [],
        lc: L ? { s: L.s, cd: L.card, w: BD.cardWords(L.card), from: L.from, to: L.to, kind: L.kind, stay: L.stay, win: L.win, pick: !!L.pick } : null,
        hint: h && i >= 0 ? { pos: h.pos, left: h.left, pWin: Math.round(h.pWin * 100), near: h.near, stuck: h.stuck ? CN[h.stuck] : null, skip: h.skip,
          ahead: h.ahead.slice(0, 4).map(function (a) { return { at: a.at, kind: a.kind, name: (a.kind === "shortcut" ? BRD.shortName[a.at] : BRD.stickyName[a.at]) || "" }; }) } : null,
        line: G.log.length ? String(G.log[G.log.length - 1].t).replace(/ → /g, " to ") : "" };
    }
    function pushAll(playing) { H.pushAll(function (c) { return phoneSt(c, null, playing); }); }
    H.onReconnect(function () { stats.reconnects++; pushAll(busy); });
    H.onTakeOver(function (c) { stats.takes++; var i = ixOf(c); if (i >= 0) G.players[i].human = true; H.push(c, phoneSt(c, null, busy)); renderStand(); });
    H.onLeave(function (c) { stats.leaves++; var i = ixOf(c); if (i >= 0) { G.players[i].human = false; G.players[i].skill = H.skill(); G.players[i].name = H.name(c); var t = tokEls[i] && tokEls[i].querySelector(".cd-ini"); if (t) t.textContent = ini(G.players[i].name); } renderStand(); pushAll(busy); });
    // the Victory's rows in the same order as E.standings (the host sorts: winner, s keys bigger first, at smaller first, k)
    H.standings(function () {
      return G.players.map(function (p, s) {
        return { name: p.name, color: hex(s), v: p.done ? "Reached " + E.GOAL_NAME : (p.pos ? "Square " + p.pos : "Start"), s: [p.done ? 1 : 0, p.done ? 0 : p.pos], win: s === G.winner, at: p.done ? 0 : p.at, k: s };
      });
    });
    function save() {
      if (G.over) { lsSet(KEY, null); return; }
      stats.saves++; lsSet(KEY, { v: SAVEV, G: G, t: Date.now() });
    }

    // ---- the flying cards ----
    function rectOf(el) { var r = el.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; }
    function bigRect(slot, two) {   // the big spot in front of the road: slot 0 / 1 side by side for "draw two"
      var a = rectOf(art), w = Math.min(a.w * (two ? .4 : .48), a.h * .5 * 100 / 140), h = w * 1.4;
      var cx = a.x + a.w / 2 + (two ? (slot ? 1 : -1) * (w * .56) : 0), cy = a.y + a.h * .44;
      return { x: cx - w / 2, y: cy - h / 2, w: w, h: h };
    }
    function pileRect(id) { return rectOf($(id)); }
    function pickRect(i) { var b = $("cdpPick").querySelectorAll(".cdp-pk .cd-cardsvg")[i]; return b && b.getClientRects().length ? rectOf(b) : null; }
    function asideRect() { var a = $("cdpAside"); if (a && a.textContent && a.getClientRects().length) { var r = rectOf(a), w = Math.max(24, r.h * .9); return { x: r.x + r.w / 2 - w / 2, y: r.y + r.h / 2 - w * .7, w: w, h: w * 1.4 }; } return null; }
    function makeBig(cd, r, caption) {
      var el = document.createElement("div"); el.className = "cd-big";
      el.style.left = r.x + "px"; el.style.top = r.y + "px"; el.style.width = r.w + "px";
      el.innerHTML = '<div class="cd-fl"><i><span class="cd-face">' + BD.cardSVG(cd) + '</span><span class="cd-back">' + BD.backSVG() + "</span></i></div>" + (caption ? '<span class="cd-cap">' + esc(caption) + "</span>" : "");
      fly.appendChild(el); return el;
    }
    function fromTo(a, b) { var k = a.w / b.w; return "translate(" + (a.x - b.x).toFixed(1) + "px," + (a.y - b.y).toFixed(1) + "px) scale(" + k.toFixed(3) + ")"; }
    async function flipIn(el, from, to) {   // from the draw pile, turning over, to the big spot
      stats.flips++;
      if (calm() || !el.animate) { await wait(120); return; }
      el.style.transformOrigin = "0 0";
      var inner = el.querySelector(".cd-fl > i"), ms = sp(620);
      try { inner.animate([{ transform: "rotateY(180deg)" }, { transform: "rotateY(180deg)", offset: .25 }, { transform: "rotateY(0deg)" }], { duration: ms, easing: "cubic-bezier(.3,.6,.25,1)" }); } catch (e) { }
      try { var cp = el.querySelector(".cd-cap"); if (cp) cp.animate([{ opacity: 0 }, { opacity: 0, offset: .6 }, { opacity: 1 }], { duration: ms }); } catch (e) { }
      try { await el.animate([{ transform: fromTo(from, to) }, { transform: "none" }], { duration: ms, easing: "cubic-bezier(.22,.7,.2,1)" }).finished; } catch (e) { }
    }
    async function flyCard(el, a, b, ms) {   // a card flies from rect a to rect b, then is gone (the pile under it shows it)
      if (!el) return;
      if (calm() || !el.animate || !b) { el.remove(); return; }
      el.classList.add("is-small"); el.style.transformOrigin = "0 0";
      try { await el.animate([{ transform: "none" }, { transform: fromTo(b, a), opacity: 1 }], { duration: ms, easing: "cubic-bezier(.4,.1,.3,1)", fill: "forwards" }).finished; } catch (e) { }
      el.remove();
    }
    function cardFly(cd, a, b, ms) { var el = makeBig(cd, a, ""); el.classList.add("is-small"); return flyCard(el, a, b, ms); }
    async function landOnDiscard(id, el, from) {
      await flyCard(el, from || rectOf(el), pileRect("cdpDisc"), sp(380));
      dk.top = id; dk.dn++; dk.landed[id] = 1; renderPiles(); H.sfx("discard");
    }
    function clearFly() { fly.innerHTML = ""; }

    // ---- hops: one per square at the Game speed; a long trip (a picture card) ramps up after the first squares, never under 120 ms ----
    function stepMs(i, len) { var base = 235 * f(); if (len <= 14) return Math.max(120, Math.round(base)); return Math.max(120, Math.round(base * Math.max(.5, 1 - i / 14))); }
    async function hops(s, path) {
      var el = tokEls[s]; if (!el) return; el.classList.add("is-moving");
      for (var i = 0; i < path.length; i++) {
        if (!H.live()) return;
        var ms = stepMs(i, path.length), c = BD.centre(path[i]);
        disp[s] = path[i]; stats.hops++; mark("h" + path[i]);
        glide(el, { x: c.x, y: c.y - 6, k: 1 }, Math.max(100, Math.round(ms * .64)));
        hop(el, Math.max(100, Math.round(ms * .72))); H.sfx("tick");
        await waitReal(ms);
        if (i % 6 === 5) renderStand();
      }
    }
    async function shortcutGlide(s, from, to) {   // the shortcut: one glide along the ribbon or across the bridge, while it lights up
      var el = tokEls[s], pts = BD.shortcutPts(from), u = unit(), len = 0, i; if (!el) return; stats.glides++; mark("G" + from + ">" + to);
      var end = BD.centre(to);
      if (pts) for (i = 1; i < pts.length; i++) len += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
      var ms = Math.max(120, Math.round(Math.min(2400, 600 + len * 1.6) * f()));
      BD.glow(from, ms + sp(500));
      disp[s] = to; setPose(el, { x: end.x, y: end.y - 6, k: 1 });
      if (calm() || !el.animate || !pts || !u) { await waitReal(Math.min(900, ms)); el._p = { x: end.x, y: end.y - 6, k: 1 }; return; }
      var kf = []; for (i = 0; i < pts.length; i += 2) kf.push({ transform: "translate(" + ((pts[i].x - end.x) * u).toFixed(1) + "px," + ((pts[i].y - 6 - (end.y - 6)) * u).toFixed(1) + "px)" + (i > 0 && i < pts.length - 2 ? " scale(1.18)" : "") });
      kf.push({ transform: "none" });
      try { await el.animate(kf, { duration: ms, easing: "cubic-bezier(.45,.05,.55,.95)" }).finished; } catch (e) { }
    }

    // ---- one action's events, in order (candy/game.js animEvent): the card turns over, the hops, then the shortcut / sticky / licorice ----
    async function animEvent(e) {
      var s = e.s, el = s != null ? tokEls[s] : null, who = s != null && G.players[s] ? nm(s) : "";
      switch (e.e) {
        case "reshuffle": {
          H.sfx("deal"); stats.reshuffles++; mark("X");
          banner("Reshuffle", "The played cards become a new draw pile", 1300, "good");
          if (!calm() && dk.dn) {
            var a = pileRect("cdpDisc"), b = pileRect("cdpDeck"), ps = [];
            for (var q = 0; q < Math.min(5, dk.dn); q++) (function (q) { ps.push(wait(90 * q).then(function () { return cardFly(null, a, b, sp(360)); })); })(q);
            await Promise.all(ps);
          }
          dk.n = e.n; dk.dn = 0; dk.top = null; renderPiles();
          await wait(500); return;
        }
        case "draw": {
          tokEls.forEach(function (t, q) { t.classList.toggle("is-turn", q === s); });
          var two = G.o.older, slot = two ? dk.hand.length : 0, cd = e.card;
          stats.cards++; mark("D" + s + ":" + (cd.pic != null ? "*" + cd.pic : cd.c + cd.n));
          status(who + " draws " + (slot ? "a second card" : "a card") + "…", s);
          dk.n = e.left; renderPiles(); H.sfx("draw");
          var to = bigRect(slot, two), big = makeBig(cd, to, BD.cardWords(cd));
          await flipIn(big, pileRect("cdpDeck"), to);
          if (cd.pic != null) H.sfx("meld");
          status(who + " drew " + (cd.pic != null ? "a picture card: " + BD.cardWords(cd) : (cd.n === 2 ? "a double " + CN[cd.c] : CN[cd.c])), s);
          await wait(two ? 620 : 900);
          if (!H.live()) return;
          var aside = cd.pic != null && G.o.treatsOnce && !two;
          if (two) { dk.hand.push(e.id); renderPick(); await flyCard(big, to, pickRect(dk.hand.length - 1), sp(380)); }
          else if (aside) { dk.aside++; renderPiles(); await flyCard(big, to, asideRect(), sp(380)); dk.landed[e.id] = 1; }
          else await landOnDiscard(e.id, big, to);
          return;
        }
        case "redraw": {
          H.sfx("discard"); mark("RD" + s);
          if (e.why === "back") await banner("No going back", who + " draws a new card (picture cards only send you forward)", 1500, "good");
          else await banner("Square taken", who + " draws again", 1300, "good");
          return;
        }
        case "choose": {
          renderPick();
          status(who + (H.isHuman(SEATS[s].color) ? ": choose one of the two cards on your phone" : " looks at both cards…"), s);
          return;
        }
        case "pick": {
          picked = e.i; renderPick(); mark("P" + s + ":" + e.i);
          H.sfx("click");
          status(who + " plays " + (e.card.pic != null ? "the " + BD.cardWords(e.card) + " card" : BD.cardWords(e.card).toLowerCase()), s);
          await wait(650);
          return;
        }
        case "stuck": { shake(el); H.sfx("discard"); mark("K" + s); await banner("Still stuck", who + " needs a " + CN[e.need] + " card to get out", 1300, "bad"); return; }
        case "stay": {
          shake(el); H.sfx("discard"); mark("Y" + s + ":" + e.why);
          await banner("Stay put", e.why === "same" ? who + " is already on that square" : e.why === "exact" ? who + " needs " + lastColour() + " to finish" : "That square is taken", 1300);
          return;
        }
        case "freed": { H.sfx("coin"); mark("F" + s); await banner("Free!", "A " + CN[e.c] + " card: out of the " + (BRD.stickyName[e.at] || "sticky square"), 1200, "good"); return; }
        case "move": {
          mover = s; mark("M" + s + ":" + e.from + ">" + e.to + "/" + e.path.length);
          if (e.kind === "picture") {
            var nmP = E.PIC_NAMES[e.card.pic], back = e.dir < 0;
            H.sfx("slide");
            status(who + " goes " + (back ? "back" : "ahead") + " to " + nmP + " (" + plural(e.path.length, "square") + ")", s);
            await banner(nmP + "!", (back ? "Back " : "Forward ") + plural(e.path.length, "square") + " to square " + e.to, 1200, back ? "bad" : "good");
          } else {
            for (var m = 0; m < e.marks.length; m++) { if (!H.live()) return; BD.mark(e.marks[m], calm() ? 0 : sp(900)); H.sfx("click"); await wait(300); }   // the squares of that colour are counted
            status(who + " hops to " + (e.over ? "the end" : e.to === E.END && BRD.track.charAt(E.END) === "W" ? "the rainbow" : "square " + e.to), s);
          }
          await hops(s, e.path);
          renderStand(); await wait(160); return;
        }
        case "bump": {
          mark("B" + s + ":" + e.to);
          status("Taken: " + who + " hops on to square " + e.to, s);
          await banner("Square taken", "On to the next square of that colour", 1000);
          await hops(s, e.path || []); renderStand(); return;
        }
        case "shortcut": {
          await wait(200); H.sfx("slide");
          var bridge = e.from !== 5;
          banner(e.name + "!", (bridge ? "Across the bridge: " : "Down the ribbon: ") + "square " + e.from + " to " + e.to, 1500, "good");
          status(who + (bridge ? " crosses" : " glides") + " from " + e.from + " to " + e.to, s);
          await shortcutGlide(s, e.from, e.to); H.sfx("coin"); renderStand(); await wait(320); return;
        }
        case "sticky": { shake(el); H.sfx("jail"); mark("S" + s + ":" + e.at); await banner("Stuck!", (BRD.stickyName[e.at] || "A sticky square") + ": " + who + " is stuck until a " + CN[e.need] + " card", 1700, "bad"); renderStand(); return; }
        case "licorice": { shake(el); H.sfx("jail"); mark("L" + s + ":" + e.at); await banner("Licorice!", (BRD.stickyName[e.at] || "Licorice") + ": " + who + " loses the next turn", 1700, "bad"); renderStand(); return; }
        case "discard": {
          if (dk.landed[e.id]) { delete dk.landed[e.id]; return; }
          var hi = dk.hand.indexOf(e.id), from = hi >= 0 ? pickRect(hi) : null, cdd = pub(e.id);
          if (hi >= 0) dk.hand.splice(hi, 1);
          if (!dk.hand.length) picked = -1;
          if (e.aside) { dk.aside++; renderPiles(); renderPick(); if (from) await cardFly(cdd, from, asideRect(), sp(340)); return; }
          var fl = from ? makeBig(cdd, from, "") : null; renderPick();
          if (fl) { fl.classList.add("is-small"); await landOnDiscard(e.id, fl, from); }
          else { dk.top = e.id; dk.dn++; renderPiles(); }
          return;
        }
        case "finish": {
          mark("W" + s); BD.spire(sp(1400), 1); renderStand(); H.sfx("win");
          await banner("The Sugarspire!", who + " reaches it and wins", 2000, "win");
          return;
        }
        case "skip": { shake(tokEls[s]); H.sfx("bump"); mark("Z" + s); await banner("Lost turn", nm(s) + " loses this turn (licorice)", 1400, "bad"); return; }
        default: return;
      }
    }
    // once per turn: the tension cues (a heartbeat near the Sugarspire, the spire glows; sticky / licorice squares one card away pulse)
    var warned = -1;
    function turnStart() {
      if (G.over || warned === G.step) return; warned = G.step;
      var h = null; try { h = E.hint(G, G.cur); } catch (e) { h = null; } if (!h) return;
      if (h.near) { H.sfx("bump"); setTimeout(function () { if (H.live()) H.sfx("bump"); }, Math.round(260 * f())); if (!calm()) BD.spire(sp(900), 2); }
      if (!calm()) { var st = h.ahead.filter(function (a) { return a.kind === "sticky"; }).map(function (a) { return a.at; }); if (st.length) BD.warn(st); }
    }

    // ---- who goes first: the engine already decided it (newGame: the youngest, or the first seat); the shared show plays that order ----
    sync(); save();
    try { if (CY.Brain && CY.Brain.warm) CY.Brain.warm(G); } catch (e) { }
    if (resumed) {
      status("Welcome back: turn " + G.turn + ", " + nm(G.cur) + " to " + (G.phase === "choose" ? "choose a card" : "draw"), G.cur);
      pushAll(false); await banner("Welcome back", "Turn " + G.turn + " · " + nm(G.cur) + (G.phase === "choose" ? " chooses a card" : " draws next"), 1800);
    } else {
      var fp = E.firstPlayer(G), w = fp.winner, B = BG();
      fpShow = true; renderTokens(); renderStand(); pushAll(false);
      if (B && B.firstPlayer) {
        var vals = {}, who0 = []; for (var s0 = 0; s0 < n; s0++) { who0.push(s0); vals[s0] = ((s0 - w + n) % n) + 1; }
        var face = function (v) { return '<span class="cd-fpface"><b>' + v + "<small>" + (["", "st", "nd", "rd", "th"][v] || "th") + "</small></b></span>"; };
        await H.first({ mode: "card", eyebrow: "Who goes first?", title: fp.youngest ? "The youngest player goes first" : "No youngest picked: the first seat starts",
          players: H.fpPlayers(), rounds: [{ who: who0, vals: vals, top: [w] }], winner: w,
          face: face, back: '<span class="cd-fpback">' + BD.backSVG() + "</span>",
          label: function (v) { return v === 1 ? (fp.youngest ? "Youngest" : "Seat 1") : "Then " + E.ord(v); },
          result: function (x) { return { title: nm(x) + " goes first", sub: fp.why }; },
          onWinner: function () { fpShow = false; renderTokens(); renderStand(); } }, SEATS[w].color);
      }
      fpShow = false; sync();
    }

    // ---- the turns ----
    while (H.live() && !G.over) {
      var s = G.cur, c = SEATS[s].color, choose = G.phase === "choose";
      picked = -1; sync(); turnStart(); pushAll(false);
      var m = null;
      if (H.isHuman(c)) {
        if (!choose) {
          status(nm(s) + ": draw on your phone", s);
          H.hint(nm(s) + ": press Draw on your phone");
          stats.ask = { s: s, mode: "draw", step: G.step };
          var r = await H.turn(c, phoneSt(c, "draw", false), { title: "Your turn", sub: G.o.older ? "Draw two cards" : "Draw a card", timeoutMs: window.__cdpTO || 0 });
          if (!H.live()) return;
          if (r && r.id === "draw") { m = { t: "draw", s: s }; stats.phoneDraws++; }
        } else {
          status(nm(s) + ": choose one of the two cards on your phone", s);
          H.hint(nm(s) + ": pick a card on your phone");
          stats.ask = { s: s, mode: "pick", step: G.step };
          var r2 = await H.turn(c, phoneSt(c, "pick", false), { title: "Choose a card", sub: "Play one of your two cards", timeoutMs: window.__cdpTO || 0 });
          if (!H.live()) return;
          if (r2 && r2.id === "pick" && r2.data && (r2.data.i === 0 || r2.data.i === 1)) { m = { t: "pick", s: s, i: r2.data.i }; stats.phonePicks++; }
        }
      }
      stats.ask = null;
      if (!m) {
        status(nm(s) + (choose ? " looks at both cards…" : " draws a card…"), s);
        H.hint(nm(s) + (H.isPhone(c) ? " (the computer plays for an away phone)" : " (computer)") + (choose ? " is choosing" : " is drawing"));
        var tf = 1; try { if (CY.Brain && CY.Brain.think) tf = CY.Brain.think(G, s) || 1; } catch (e) { tf = 1; }
        await wait((choose ? 900 : 640) * tf);
        if (!H.live()) return;
        try { if (CY.Brain) m = CY.Brain.decide(G, s); } catch (e) { m = null; }
        m = m || E.defaultMove(G, s); stats.cpuMoves++;
      }
      var mv = { t: m.t, s: m.s }; if (m.t === "pick") mv.i = m.i;
      var before = G.players.map(function (p) { return p.pos; }), deck0 = { n: G.deck.length, dn: G.disc.length, top: G.disc.length ? G.disc[G.disc.length - 1] : null, hand: G.hand.slice(), aside: G.aside.length };
      var res = E.apply(G, mv);
      if (!res.ok) { H.toast(res.msg); await wait(400); continue; }
      save();
      var line = null; try { if (CY.Brain && CY.Brain.react) line = CY.Brain.react(G, res.ev); } catch (e) { line = null; }
      busy = true; mover = s; disp = before; dk.n = deck0.n; dk.dn = deck0.dn; dk.top = deck0.top; dk.hand = deck0.hand; dk.aside = deck0.aside; dk.landed = {};
      stats.lastEv = res.ev; pushAll(true); say(null);
      H.hint(nm(s) + ": watch the cards");
      for (var i = 0; i < res.ev.length; i++) { if (!H.live()) return; await animEvent(res.ev[i]); }
      if (!H.live()) return;
      clearFly(); busy = false; mover = -1;
      if (line) say(line);
      sync(); pushAll(false);
    }
    if (!H.live()) return;
    // ---- the end ----
    try { if (CY.Brain && CY.Brain.finish) CY.Brain.finish(G); } catch (e) { }
    lsSet(KEY, null);
    fpShow = false; sync(); pushAll(false);
    status(nm(G.winner) + " wins!", G.winner);
    H.hint("Game over");
    await wait(700);
    H.over(nm(G.winner));
    var cd0 = $("cdp"); if (cd0) { cd0.classList.add("is-over"); layout(); renderTokens(); }   // the host adds New Game under the hint bar
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
