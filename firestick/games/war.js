/* WAR in Party Mode: the TV side (firestick/games/README.md is the guide; the registry line is in games/registry.js).
   The rules are the phone game's own engine (../war/engine.js: pure, plain-JSON state, snapshot(G, seat)), the computers are its brain
   (../war/brain.js) and the cards are its art (../war/cards.js). This file only drives them on the TV for 2 to 16 seats:
   - the lobby: every Version (Three-card War is the default: 3 down, the 4th decides), the engine's rule rows (official / House: only the
     tied go to war, deuces / aces / jokers wild, decks by the player count...), the game length, Continue the saved game;
   - who goes first: War has none (Bicycle, Pagat: everyone turns a card at the same time), so the opening show is the deal, one card at
     a time round the table (OK skips it);
   - the table: a tile per seat (its stack and count, the battle slot where its card turns up and a war's cards fan out), the battle band
     (the pot, left-over and tied cards), banners for every war, and the count rail on the right: sorted, places 1..N, never shared;
   - the phones: a big Flip (war cards in a war, the private hand in Hand War, the spoils with Prisoners of War / Winner arranges) and an
     Auto switch; a phone that goes quiet is played by the computer until it presses Take over;
   - an autosave after every move (localStorage "party-war-live"; Continue in the lobby when the table has the same number of players). */
(function () {
  "use strict";
  var P = window.PartyGames, W = window.War, E = W && W.Engine, C = W && W.Cards;
  if (!P || !E || !C) return;
  var ID = "war", KEY = "party-war-live", SAVEV = 1;
  function BG() { return window.BGUI || null; }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function plural(n, w) { return n + " " + w + (n === 1 ? "" : "s"); }
  function remPx() { return parseFloat(getComputedStyle(document.documentElement).fontSize) || 16; }
  function clamp(x, a, b) { return x < a ? a : x > b ? b : x; }
  function reduced() { var B = BG(); return document.documentElement.getAttribute("data-motion") === "reduce" || !!(B && B.reducedMotion && B.reducedMotion()); }
  function calm() { var B = BG(); return reduced() || !!(B && B.effects && B.effects.get && B.effects.get() === "reduced") || document.hidden; }
  function lsGet(k) { try { return JSON.parse(localStorage.getItem(k) || "null"); } catch (e) { return null; } }
  function lsSet(k, v) { try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, JSON.stringify(v)); } catch (e) { } }
  function ord(n) { var t = n % 100; return n + ((t >= 11 && t <= 13) ? "th" : (["th", "st", "nd", "rd"][n % 10] || "th")); }
  function listNames(a) { return a.length <= 2 ? a.join(" and ") : a.slice(0, -1).join(", ") + " and " + a[a.length - 1]; }
  function warWord(n) { return E.warWord ? E.warWord(n) : n > 1 ? "Double war!" : "I declare war!"; }

  /* ---------- the game's look: icons, stage motifs and music (the same as war/game.js registers on its own page) ---------- */
  var GLYPHS = {
    swords: '<path d="M4.5 4.5L15 15M13 17l4-4M15 15l3.2 3.2M19.5 4.5L9 15M11 17l-4-4M9 15l-3.2 3.2"/><circle cx="19.2" cy="19.2" r="1" fill="currentColor"/><circle cx="4.8" cy="19.2" r="1" fill="currentColor"/>',
    shield: '<path d="M12 3.5l7 2.5v5.5c0 4.3-3 7.6-7 9-4-1.4-7-4.7-7-9V6z"/><path d="M12 7.5v9M8.5 11h7"/>',
    spade: '<path d="M12 4c2.5 3 7 5.8 7 9.3a3.4 3.4 0 0 1-5.8 2.4c.2 1.8.8 3 1.8 4.3H9c1-1.3 1.6-2.5 1.8-4.3A3.4 3.4 0 0 1 5 13.3C5 9.8 9.5 7 12 4z"/>'
  };
  (function register() {
    var B = BG(); if (!B) return;
    try {
      if (B.icon && B.icon.add) { Object.keys(GLYPHS).forEach(function (k) { if (!B.icon.has || !B.icon.has(k)) B.icon.add(k, GLYPHS[k]); }); if (B.icon.seal && B.icon.seal.set) B.icon.seal.set(ID, "swords"); }
      if (B.stage && B.stage.register) B.stage.register(ID, { motifs: ["swords", "spade", "shield", "cards"] });
    } catch (e) { }
  })();
  if (window.Sound && Sound.addStyle && !(Sound.hasStyle && Sound.hasStyle(ID))) {
    try {
      Sound.addStyle(ID, { scales: ["minor", "dorian", "minor"], bpm: [100, 128], swing: 0, sev: false, leadVol: 0.08, waves: ["square", "triangle", "sawtooth"], bassKind: "pulse",
        progs: [[0, 5, 6, 4], [0, 3, 4, 0], [0, 6, 5, 4], [0, 4, 5, 3], [0, 2, 6, 4], [0, 5, 3, 4], [0, 6, 3, 4], [0, 3, 6, 4]],
        bridge: [[5, 6, 4, 4], [3, 4, 0, 0], [2, 3, 4, 4], [6, 5, 4, 0]],
        rhythms: [[1, 0, 1, 1, 1, 0, 1, 1], [1, 1, 0, 1, 1, 0, 1, 0], [1, 0, 0, 1, 1, 0, 1, 1], [1, 0, 1, 0, 1, 1, 0, 1]],
        chordSteps: [0, 3, 6],
        drums: [{ kick: [1, 0, 0, 0, 1, 0, 0, 0], snare: [0, 0, 1, 0, 0, 1, 1, 1], sv: 0.09, hat: [1, 0, 1, 0, 1, 0, 1, 0], hv: 0.04 }, { kick: [1, 0, 0, 1, 1, 0, 0, 0], snare: [0, 0, 1, 0, 0, 0, 1, 0], sv: 0.08, hat: [1, 1, 1, 1, 1, 1, 1, 1], hv: 0.03 }, { kick: [1, 0, 1, 0, 1, 0, 1, 0], snare: [0, 1, 0, 1, 0, 1, 1, 1], sv: 0.07, hat: [0, 1, 0, 1, 0, 1, 0, 1], hv: 0.04 }],
        titles: ["I Declare War", "Three Cards Down", "The Deciding Flip", "Aces in Reserve", "Double War March", "Peace Treaty Waltz", "Battle of the Kings", "Sweep the Table", "Fifty-Two Strong", "Drum Roll, Please"] },
        { wave: "square", reg: -1 });
    } catch (e) { }
  }

  /* ---------- the CSS (scoped by html[data-pgame="war"]) ---------- */
  var Q = 'html[data-pgame="war"] ';
  var CSS = [
    Q + ".wpt{display:grid;grid-template-columns:minmax(0,1fr) 21rem;column-gap:1.5rem;width:100%;height:calc(100vh - 10.75rem);min-height:0}",
    Q + ".wpt.is-over{height:calc(100vh - 15.5rem)}",   /* game over: New Game fits under the hint bar */
    Q + ".wpt-table{position:relative;min-width:0;min-height:0;border-radius:1.25rem;overflow:hidden;background:radial-gradient(120% 90% at 50% 45%,#2f3a1a 0%,#1d2510 55%,#11160a 100%);box-shadow:inset 0 0 0 2px rgba(231,202,144,.45),inset 0 0 3rem rgba(0,0,0,.55),0 .75rem 2rem rgba(0,0,0,.5)}",
    Q + ".wpt-table::before{content:'';position:absolute;inset:.6rem;border-radius:.9rem;box-shadow:inset 0 0 0 1px rgba(231,202,144,.22);pointer-events:none}",
    Q + ".wpt-seat{position:absolute;box-sizing:border-box;border-radius:.9rem;background:linear-gradient(180deg,rgba(10,12,6,.58),rgba(10,12,6,.38));box-shadow:inset 0 0 0 1px rgba(231,202,144,.22)}",
    Q + ".wpt-seat.is-need{box-shadow:inset 0 0 0 1px rgba(231,202,144,.22),0 0 0 3px var(--seat),0 0 0 5px rgba(255,243,209,.85)}",
    Q + ".wpt-seat.is-fight{background:linear-gradient(180deg,rgba(74,22,22,.72),rgba(40,10,10,.5))}",
    Q + ".wpt-seat.is-tied{box-shadow:inset 0 0 0 2px #ffcf7a,0 0 0 3px rgba(255,207,122,.35)}",
    Q + ".wpt-seat.is-win{box-shadow:inset 0 0 0 2px #f0d48a,0 0 1.25rem rgba(240,212,138,.55)}",
    Q + ".wpt-seat.is-out{opacity:.5}",
    Q + ".wpt-head{position:absolute;left:var(--ip);right:var(--ip);top:var(--ip);height:var(--lh);display:flex;align-items:center;gap:.45rem;min-width:0}",
    Q + ".wpt-head .bg-token{flex:none;width:calc(var(--lh) * .92);height:calc(var(--lh) * .92);font:var(--fw-caps) var(--fs-micro)/1 var(--font-ui)}",
    Q + ".wpt-head .bg-player__cpu{position:static;flex:none;width:1.1rem;height:1.1rem;color:var(--text-2)}",
    Q + ".wpt-nm{flex:1 1 auto;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font:var(--fw-ui-strong) var(--fs-sm)/1.1 var(--font-ui);color:var(--text-1)}",
    Q + ".wpt-tag{flex:none;padding:.15rem .45rem;border-radius:var(--r-pill);font:var(--fw-caps) var(--fs-micro)/1 var(--font-ui);letter-spacing:.06em;text-transform:uppercase;color:#14110a;background:#e7ca90}",
    Q + ".wpt-tag:empty{display:none}",
    Q + ".wpt-tag.is-war{background:#ff9d8a}",
    Q + ".wpt-tag.is-tied{background:#ffcf7a}",
    Q + ".wpt-tag.is-out,.wpt-tag.is-away{background:#8b93a8}",
    Q + ".wpt-tag.is-ready{background:#9fe0a8}",
    Q + ".wpt-pk{position:absolute;left:var(--ip);top:calc(var(--ip) + var(--lh) + var(--py));width:var(--col);display:grid;justify-items:center;gap:.2rem}",
    Q + ".wpt-stack{position:relative;width:var(--pw);height:calc(var(--pw) * 1.42)}",
    Q + ".wpt-stack > .wf{position:absolute;left:0;top:0;--cw:var(--pw)}",
    Q + ".wpt-stack.is-empty{border-radius:calc(var(--pw) * .115);box-shadow:inset 0 0 0 2px rgba(231,202,144,.25)}",
    Q + ".wpt-n{font:400 var(--fs-lg)/1 var(--font-display);color:var(--gold-100);font-variant-numeric:tabular-nums;text-align:center;white-space:nowrap}",
    Q + ".wpt-n small{display:block;margin-top:.1rem;font:var(--fw-ui) var(--fs-micro)/1 var(--font-ui);color:var(--text-2)}",
    Q + ".wpt-cards{position:absolute;inset:0;pointer-events:none}",
    Q + ".wpt-cards .wcard{z-index:2}",
    Q + ".wpt-cards .wcard.is-win .wf-face{box-shadow:inset 0 0 0 calc(var(--cw) * .035) #fbf6ea,0 0 0 3px #f0d48a,0 0 1rem rgba(240,212,138,.8)}",
    Q + ".wpt-cards .wcard.is-lose{opacity:.62}",
    Q + ".wpt-cards .wcard.is-wild .wf-face{box-shadow:inset 0 0 0 calc(var(--cw) * .035) #fbf6ea,0 0 0 2px #c99f5e,0 0 0 4px rgba(255,214,120,.55)}",
    Q + ".wpt-cards .wcard[data-wn]::after{content:attr(data-wn);position:absolute;left:50%;bottom:-.15rem;transform:translate(-50%,100%);padding:.05rem .35rem;border-radius:var(--r-pill);background:#11160a;color:#e7ca90;font:var(--fw-caps) var(--fs-micro)/1 var(--font-ui)}",
    Q + ".wpt-band{position:absolute;left:0;right:0;display:flex;align-items:center;justify-content:center;gap:1.25rem;padding:0 1.25rem;pointer-events:none}",
    Q + ".wpt-stat{margin:0;min-width:0;max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font:var(--fw-ui-strong) var(--fs-lg)/1.25 var(--font-ui);color:#f6efe0;text-shadow:0 1px 2px #000}",
    Q + ".wpt-pot{flex:none;display:inline-flex;align-items:baseline;gap:.4rem;padding:.3rem .85rem;border-radius:var(--r-pill);background:rgba(10,12,6,.7);box-shadow:inset 0 0 0 1px rgba(231,202,144,.4);font:var(--fw-ui-strong) var(--fs-sm)/1 var(--font-ui);color:#e7ca90}",
    Q + ".wpt-pot b{font:400 var(--fs-xl)/1 var(--font-display);color:var(--gold-100)}",
    Q + ".wpt-pot.is-war{background:rgba(70,12,12,.8);box-shadow:inset 0 0 0 1px #ff9d8a;color:#ffd0c4}",
    Q + ".wpt-pot:empty{display:none}",
    Q + ".wpt-note{flex:none;font:var(--fw-ui) var(--fs-sm)/1.2 var(--font-ui);color:#e7ca90}",
    Q + ".wpt-note:empty{display:none}",
    Q + ".wpt-banner{position:absolute;left:50%;top:50%;z-index:8;display:grid;justify-items:center;gap:.35rem;width:max-content;max-width:86%;padding:.7rem 1.6rem .85rem;transform:translate(-50%,-50%);border-radius:var(--r-lg);background:linear-gradient(180deg,rgba(18,14,32,.96),rgba(8,10,21,.96));box-shadow:inset 0 0 0 1.5px var(--gold-200),0 .8rem 2rem rgba(0,0,0,.6);text-align:center;pointer-events:none;opacity:0;visibility:hidden}",
    Q + ".wpt-banner.is-on{opacity:1;visibility:visible}",
    Q + ".wpt-banner b{font:400 var(--fs-4xl)/1.05 var(--font-display);color:var(--gold-100)}",
    Q + ".wpt-banner span{font:var(--fw-ui-strong) var(--fs-lg)/1.3 var(--font-ui);color:#f6e9cf}",
    Q + ".wpt-banner.is-war{background:linear-gradient(180deg,rgba(84,14,18,.96),rgba(30,6,8,.96));box-shadow:inset 0 0 0 1.5px #ff9d8a,0 .8rem 2rem rgba(0,0,0,.6)}",
    Q + ".wpt-banner.is-war b{color:#ffd0c4}",
    Q + ".wpt-banner.is-win{background:linear-gradient(180deg,rgba(74,52,14,.96),rgba(26,18,4,.96))}",
    Q + ".wpt-side{display:flex;flex-direction:column;gap:.75rem;min-width:0;min-height:0;padding-top:.15rem}",
    Q + ".wpt-meta{display:flex;flex-wrap:wrap;gap:.45rem .5rem}",
    Q + ".wpt-chip{display:inline-flex;align-items:center;gap:.4rem;padding:.3rem .8rem;border-radius:var(--r-pill);background:var(--ink-3);box-shadow:inset 0 0 0 1px var(--line-1);font:var(--fw-ui-strong) var(--fs-micro)/1.3 var(--font-ui);color:var(--text-1);font-variant-numeric:tabular-nums;white-space:nowrap}",
    Q + ".wpt-chip--v{color:var(--gold-100)}",
    Q + ".wpt-chip:empty{display:none}",
    Q + ".wpt-rail{list-style:none;margin:0;padding:.5rem;display:grid;gap:.2rem;border-radius:var(--r-md);background:var(--ink-2);box-shadow:var(--well-edge);min-height:0}",
    Q + ".wpt-rail li{position:relative;display:grid;grid-template-columns:1.9rem auto minmax(0,1fr) auto;align-items:center;gap:.5rem;height:var(--rh,2.5rem);box-sizing:border-box;overflow:hidden;padding:0 .55rem 0 .3rem;border-radius:.6rem;background:var(--ink-3)}",
    Q + ".wpt-rail li.is-need{box-shadow:inset 0 0 0 2px var(--seat)}",
    Q + ".wpt-rail li.is-out{opacity:.55}",
    Q + ".wpt-rk{font:400 var(--fs-lg)/1 var(--font-display);color:var(--gold-100);text-align:center;font-variant-numeric:tabular-nums}",
    Q + ".wpt-rail .bg-token{width:calc(var(--rh,2.5rem) * .72);height:calc(var(--rh,2.5rem) * .72);font:var(--fw-caps) var(--fs-micro)/1 var(--font-ui)}",
    Q + ".wpt-rnm{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font:var(--fw-ui-strong) var(--fs-sm)/1.1 var(--font-ui);color:var(--text-1)}",
    Q + ".wpt-rnm .bg-ico{width:.9em;height:.9em;margin-left:.3rem;vertical-align:-.1em;color:var(--text-2)}",
    Q + ".wpt-rv{font:var(--fw-ui-strong) var(--fs-sm)/1 var(--font-ui);color:var(--gold-100);font-variant-numeric:tabular-nums;white-space:nowrap}",
    Q + ".wpt-bar{position:absolute;left:2.4rem;right:.55rem;bottom:.18rem;height:.18rem;border-radius:.1rem;background:rgba(255,255,255,.08);overflow:hidden}",
    Q + ".wpt-bar i{display:block;width:100%;height:100%;background:var(--seat);transform-origin:0 50%}",
    Q + ".wpt-log{list-style:none;margin:0;padding:.6rem .85rem;display:grid;gap:.3rem;border-radius:var(--r-md);background:var(--ink-2);box-shadow:var(--well-edge);font:var(--fw-body) var(--fs-sm)/1.3 var(--font-ui);color:var(--text-2)}",
    Q + ".wpt-log li:last-child{color:var(--text-1)}",
    Q + ".wpt-log:empty{display:none}",
    Q + ".wpt.is-many .wpt-log{display:none}",
    Q + ".wf-ipip{color:inherit}",
    /* toasts over the side column, clear of the table (the rail starts below the chips) */
    'html[data-pgame="war"][data-tv] body.ps-ingame .bg-toast{left:calc(98vw - 10.5rem);max-width:20rem}',
    /* reduced effects: nothing moves */
    'html[data-effects="reduced"] ' + Q + ".wpt *{animation:none !important}"
  ].join("\n");
  (function addCSS() { if (document.getElementById("wpt-css")) return; var st = document.createElement("style"); st.id = "wpt-css"; st.textContent = CSS; document.head.appendChild(st); })();

  /* ---------- the lobby settings: {version, over: {house rules}, len: {length, limit, shortTie} (kept across a Version change), resume} ---------- */
  var LENK = ["length", "limit", "shortTie"];
  function defaults() { return { version: E.DEFAULT_VERSION || "three", cv: E.SETUP_V || 2, over: {}, len: {}, resume: false }; }
  function clean(c) {
    var d = defaults(); if (!c || typeof c !== "object") return d;
    var x = JSON.parse(JSON.stringify(c)); if (E.migrateSetup) E.migrateSetup(x);   // a setup saved before Three-card War was the default moves once
    if (E.VERSIONS.some(function (v) { return v.id === x.version; })) d.version = x.version;
    var base = E.defaultOpts();
    if (x.over && typeof x.over === "object") Object.keys(x.over).forEach(function (k) { if (base.hasOwnProperty(k) && k !== "version" && k !== "nd" && k !== "cap") d.over[k] = x.over[k]; });
    if (x.len && typeof x.len === "object") LENK.forEach(function (k) { if (x.len[k] != null) d.len[k] = x.len[k]; });
    return d;
  }
  function keepLen(c) {   // the Version cards clear cfg.over: the game length lives in cfg.len too
    if (!c.over) c.over = {}; if (!c.len) c.len = {};
    LENK.forEach(function (k) { if (c.over[k] != null) c.len[k] = c.over[k]; else if (c.len[k] != null) c.over[k] = c.len[k]; });
  }
  function eff(c, n) { var x = {}; for (var k in (c.over || {})) x[k] = c.over[k]; return E.normalize(E.versionOpts(c.version, x), n); }
  function versionOf(id) { return E.VERSIONS.filter(function (v) { return v.id === id; })[0] || E.VERSIONS[0]; }
  function locked(c, k) { return (versionOf(c.version).lock || []).indexOf(k) >= 0; }
  /* the rule rows: the decks first (they set the size of the game), the engine's rows for this Version, player count and deck count, then
     the game length. Engine rows say [.., house (1 = House), ..]; the Party lobby's row[4] is "official", so it is flipped here */
  function rows(c, n) {
    var o = eff(c, n), list = E.houseRows ? E.houseRows(o.version, n, o) : [];
    var out = list.filter(function (h) { return h[0] === "decks"; }).concat(list.filter(function (h) { return h[0] !== "decks"; })).map(function (h) {
      var ch = h[3];
      if (h[0] === "decks" && ch) { var a = E.autoDecks(n); ch = ch.map(function (x) { return +x[0] === 0 ? [0, x[1] + " (" + plural(a, "deck") + ")"] : x; }); }
      return [h[0], h[1], h[2], ch, h[4] ? 0 : 1];
    });
    if (!locked(c, "length")) {
      out.push(["length", "Game length", "choice", E.LENGTHS.map(function (L) { return [L.id, L.id === "end" ? "Play to the end" : L.name]; }), 1]);
      var L = E.LENGTHS.filter(function (x) { return x.id === o.length; })[0];
      if (L && L.limits) {
        out.push(["limit", L.unit === "min" ? "Minutes" : "Battles", "choice", L.limits.map(function (m) { return [m, m + (L.unit === "min" ? " minutes" : " battles")]; }), 0]);
        out.push(["shortTie", "Equal leaders at the limit", "choice", [["sudden", "Sudden death"], ["draw", "A draw"]], 0]);
      }
    }
    return out;
  }
  function seatCount(api) { return clamp(api.players(), 2, 16); }
  function savedGame() {
    var s = lsGet(KEY);
    if (!s || s.v !== SAVEV || !s.G || s.G.id !== "war" || s.G.over || !Array.isArray(s.G.players)) return null;
    try { if (E.check(s.G).length) return null; } catch (e) { return null; }
    return s;
  }
  function ago(t) { var m = Math.round((Date.now() - (+t || 0)) / 60000); return m < 1 ? "just now" : m < 60 ? plural(m, "minute") + " ago" : m < 1440 ? plural(Math.round(m / 60), "hour") + " ago" : plural(Math.round(m / 1440), "day") + " ago"; }
  function skillNote(o) {
    var dec = W.Brain && W.Brain.hasDecisions ? W.Brain.hasDecisions(o) : !!(o.hand || o.prisoners || o.arrange);
    return dec ? "Computer skill changes how the computers choose" + (o.hand ? " which card to play (they count the cards that have been played)" : "") + (o.prisoners ? (o.hand ? " and" : "") + " which prisoner to take and when to play it" : "") + (o.arrange ? " and how they arrange the cards they win" : "") + "."
      : "Computer skill makes no difference in this Version: the shuffle decides every battle, and every player just turns the top card.";
  }

  var lobbyObs = null, lobbySig = "";
  function lobby(api, cfg, el) {
    keepLen(cfg);
    var n = seatCount(api), o = eff(cfg, n), B = BG();
    var af = document.activeElement, keepId = af && af.id && /^wpt/.test(af.id) ? af.id : null;
    var sv = savedGame(); if (!sv) cfg.resume = false;
    api.rules({ versions: E.VERSIONS, house: rows(cfg, n), opts: function (c) { keepLen(c); return eff(c, n); } });
    var secs = el.querySelectorAll(".ps-sec"), vsec = secs[0], rsec = secs[1];
    var vd = vsec && vsec.querySelector(".ps-vdesc");
    var di = E.deckInfo(o, n);
    if (vd) vd.insertAdjacentHTML("beforeend", " <b>" + n + " at the table:</b> " + esc(di.text) + ", " + esc(plural(di.per, "card")) + " each" + (di.left ? " (" + esc(plural(di.left, "card")) + " left over)" : "") + ". " + esc(skillNote(o)));
    if (rsec) {
      var L = E.LENGTHS.filter(function (x) { return x.id === o.length; })[0] || E.LENGTHS[0];
      var ld = o.length === "time" ? "At the bell the battle in play (and its wars) finishes; then the most cards wins." : o.length === "battles" ? "After " + o.limit + " battles the most cards wins." : L.desc;
      if (o.length === "end") ld += " War can run long: a time limit, a battle limit or one pass keeps it short.";
      if (locked(cfg, "length")) ld = versionOf(cfg.version).name + " is always played once through.";
      var leg = rsec.querySelector(".ps-legend");
      var p = '<p class="ps-vdesc" id="wptLenDesc">' + esc("Game length: " + ld) + "</p>";
      if (leg) leg.insertAdjacentHTML("beforebegin", p); else rsec.insertAdjacentHTML("beforeend", p);
    }
    if (sv) {
      var sn = sv.G.n, ok = sn === n, names = sv.G.players.map(function (p) { return p.name; });
      var res = '<section class="ps-sec wpt-res"><div class="bg-section"><h2 class="bg-eyebrow" data-stage-text>Saved game</h2></div><div class="ps-rules"><div class="ps-rule"><span class="bg-tag bg-tag--official">saved</span>' +
        '<button type="button" class="bg-row aibtn' + (cfg.resume ? " on" : "") + '" role="switch" aria-checked="' + !!cfg.resume + '" id="wptResume"><span class="bg-row__main"><span class="bg-row__title">Continue the saved game</span>' +
        '<span class="bg-row__desc">' + esc(versionOf(sv.G.o.version).name + " · battle " + (sv.G.battle + 1) + " · " + sn + " players (" + (names.length > 6 ? names.slice(0, 5).join(", ") + " and " + (names.length - 5) + " more" : names.join(", ")) + ") · saved " + ago(sv.t)) + '</span></span>' +
        '<span class="bg-sr">: ' + (cfg.resume ? "ON" : "off") + '</span><span class="bg-toggle" aria-hidden="true"></span></button></div></div>' +
        (cfg.resume && !ok ? '<p class="ps-vdesc" role="status" style="color:#ffd9a0">The saved game had ' + sn + ' players and this table has ' + n + '. Seat ' + sn + ' (phones and computers) to continue it; otherwise a new game starts.</p>' : "") +
        (cfg.resume && ok ? '<p class="ps-vdesc">The saved game keeps its own Version and rules; the phones take its seats in order.</p>' : "") + '</section>';
      el.insertAdjacentHTML("afterbegin", res);
    }
    if (api.paintIcons) api.paintIcons(el);
    var rb = el.querySelector("#wptResume"); if (rb) rb.onclick = function () { cfg.resume = !cfg.resume; api.redraw(); };
    if (keepId) { var k2 = document.getElementById(keepId); if (k2) { if (B && B.focus && B.focus.enabled && B.focus.set) B.focus.set(k2); else try { k2.focus({ preventScroll: true }); } catch (e) { } } }
    // the player count changes in the host's own rows: redraw this box (decks by the player count, the rows that need 3 players...)
    var pl = document.getElementById("players");
    lobbySig = String(seatCount(api));
    if (pl && window.MutationObserver && (!lobbyObs || lobbyObs.el !== pl)) {
      if (lobbyObs) lobbyObs.disconnect();
      lobbyObs = new MutationObserver(function () {
        if (!pl.isConnected || document.documentElement.getAttribute("data-pgame") !== ID) { lobbyObs.disconnect(); lobbyObs = null; return; }
        var sig = String(seatCount(api));
        if (sig !== lobbySig) { lobbySig = sig; api.redraw(); }
      });
      lobbyObs.el = pl; lobbyObs.observe(pl, { childList: true });
    }
  }
  function versionName(c) {
    if (c.resume && savedGame()) return "Continue the saved game";
    var v = versionOf(c.version), x = c.over || {}, bits = [v.name];
    if (x.deucesWild || x.acesWild || x.jokersWild) bits.push("wild cards");
    if (x.length && x.length !== "end") bits.push(x.length === "time" ? (x.limit || 10) + " min" : x.length === "battles" ? (x.limit || 100) + " battles" : "one pass");
    return bits.join(" · ");
  }

  /* ================= the game ================= */
  async function start(H, cfg) {
    keepLen(cfg);
    var SEATS = H.seats, n = SEATS.length, G = null, resumed = false, clockMs = 0;
    var f = function () { return (H.pace() || 1.8) / 1.8; };                 // Medium = 1, Slow = 1.75, Fast = .5 (the phone game's speedFactor)
    var sp = function (ms) { return Math.max(120, Math.round(ms * f())); };   // an animation's length
    var dl = function (ms) { return Math.round(ms * f()); };
    var wait = function (ms) { return H.sleep(Math.max(0, ms) / 1.8); };      // a pause at the Game speed; never resolves after a quit
    var hex = function (s) { return SEATS[s].hex; };
    var ixOf = function (c) { for (var i = 0; i < n; i++) if (SEATS[i].color === c) return i; return -1; };
    var nm = function (s) { return G.players[s].name; };
    var who = function (seats) { return seats.length <= 3 ? listNames(seats.map(nm)) : seats.length + " players"; };
    var auto = {};   // seat colour -> the phone's Auto switch is on (the TV flips for that player; still a person, not away)
    var stats = window.__warp = { battles: 0, phoneActs: 0, cpuActs: 0, autoActs: 0, wars: 0, maxWar: 0, flips: 0, reconnects: 0, takes: 0, leaves: 0, views: 0, saves: 0, pushes: 0, resumed: false, asks: 0, events: [], seen: {} };

    // ---- the players: the seats in order (phones keep their names; computers get fresh random names from the host) ----
    var players = SEATS.map(function (s) { return { name: H.name(s.color), human: H.isPhone(s.color), skill: H.isPhone(s.color) ? null : H.skill() }; });
    if (cfg.resume) {
      var sv = savedGame();
      if (sv && sv.G.n === n) {
        G = JSON.parse(JSON.stringify(sv.G)); resumed = true; stats.resumed = true; clockMs = +sv.ms || 0;
        G.players.forEach(function (p, i) { p.name = players[i].name; p.human = players[i].human; p.skill = players[i].skill; });
      } else if (sv) H.toast("The saved game had " + sv.G.n + " players: a new game starts.");
    }
    if (!G) G = E.newGame(eff(cfg, n), players);
    G.skill = H.skill();
    stats.G = G; stats.auto = auto;
    try { Object.defineProperty(stats, "busy", { get: function () { return busy || dealing; } }); } catch (e) { }   // tests: the table is still
    var O = G.o, deckN = E.buildDeck(O).length;

    // ---- the TV screen ----
    C.injectCSS();
    H.frame('<div class="wpt' + (n > 8 ? " is-many" : "") + '" id="wpt">' +
      '<div class="wpt-table bg-frame" id="wptTable" data-stage-solid data-toast-avoid role="img" aria-label="The War table">' +
      '<div id="wptSeats"></div><div class="wpt-cards" id="wptCards"></div>' +
      '<div class="wpt-band" id="wptBand"><span class="wpt-note" id="wptNote"></span><p class="wpt-stat" id="wptStat" role="status"></p><span class="wpt-pot" id="wptPot"></span></div>' +
      '<div class="wpt-banner" id="wptBanner" aria-live="polite"><b id="wptBannerT"></b><span id="wptBannerS"></span></div></div>' +
      '<aside class="wpt-side" aria-label="The count">' +
      '<div class="wpt-meta"><span class="wpt-chip wpt-chip--v" id="wptVer"></span><span class="wpt-chip" id="wptDecks"></span><span class="wpt-chip" id="wptBattle"></span><span class="wpt-chip" id="wptClock"></span></div>' +
      '<ol class="wpt-rail" id="wptRail" aria-label="Cards held, most first"></ol>' +
      '<ol class="wpt-log" id="wptLog" aria-label="What happened"></ol></aside></div>',
      "Players: flip on your phones");
    var $ = H.$, seatEls = [], railEls = [], tab = {}, carryEls = [], kittyEls = [], disp = [], GEO = null, busy = false, dealing = false, fight = null, zTop = 10, lastTurnKey = "";
    $("wptVer").textContent = versionOf(O.version).name;
    var di = E.deckInfo(O, n); $("wptDecks").textContent = di.text;
    H.music(ID);

    function T(p) { return "translate(" + p.x.toFixed(1) + "px," + p.y.toFixed(1) + "px) scale(" + (p.k == null ? 1 : p.k).toFixed(3) + ") rotate(" + (p.r || 0) + "deg)"; }
    function place(el, p) { el._p = p; el.style.transform = T(p); }
    function move(el, p, ms, o) {
      o = o || {}; var from = el._p || p; place(el, p); if (o.front) el.style.zIndex = ++zTop;
      if (calm() || !el.animate || !ms) return Promise.resolve();
      var kf = [{ transform: T(from) }, { transform: T(p) }];
      if (o.lift) kf.splice(1, 0, { transform: T({ x: (from.x + p.x) / 2, y: (from.y + p.y) / 2 - (GEO ? GEO.ch * .25 : 10), k: Math.max(from.k || 1, p.k || 1) * 1.06, r: p.r }), offset: .5 });
      try { return el.animate(kf, { duration: ms, delay: o.delay || 0, easing: "cubic-bezier(.3,.7,.3,1)", fill: "backwards" }).finished.then(function () { }, function () { }); } catch (e) { return Promise.resolve(); }
    }
    function markWild(el, id) { if (el) el.classList.toggle("is-wild", id != null && !!E.isWild(G, id)); }
    function flipUp(el, id, ms, zoom) {
      if (!el) return Promise.resolve();
      C.setFace(el, id); markWild(el, id); el.classList.add("is-up");
      var inner = el.querySelector(".wf-in"); if (calm() || !inner || !inner.animate || !ms) return Promise.resolve();
      var kf = zoom ? [{ transform: "rotateY(180deg) scale(1)" }, { transform: "rotateY(90deg) scale(1.3)", offset: .5 }, { transform: "rotateY(0deg) scale(1)" }] : [{ transform: "rotateY(180deg)" }, { transform: "rotateY(0deg)" }];
      try { return inner.animate(kf, { duration: ms, easing: "ease-in-out" }).finished.then(function () { }, function () { }); } catch (e) { return Promise.resolve(); }
    }
    function newCard(id, up, pose) { var el = C.tableCard(id, up); if (up) markWild(el, id); el.style.zIndex = ++zTop; $("wptCards").appendChild(el); place(el, pose); return el; }

    // ---- the table: a tile per seat. The grid shape (columns x rows) is the one that gives the largest cards for this table size; the
    //      first half of the seats sit above the battle band, the rest below it, in seat order ----
    function buildSeats() {
      var box = $("wptSeats"); box.innerHTML = ""; seatEls = [];
      G.players.forEach(function (p, s) {
        var el = document.createElement("div"); el.className = "wpt-seat"; el.setAttribute("data-s", s); el.setAttribute("style", H.seatStyle(hex(s)));
        el.innerHTML = '<div class="wpt-head"><span class="bg-token" aria-hidden="true"></span><span class="wpt-cpu"></span><span class="wpt-nm"></span><span class="wpt-tag"></span></div>' +
          '<div class="wpt-pk"><div class="wpt-stack" aria-hidden="true"></div><span class="wpt-n"><b>0</b><small>cards</small></span></div>';
        box.appendChild(el); seatEls.push(el);
      });
      var rail = $("wptRail"); rail.innerHTML = ""; railEls = [];
      G.players.forEach(function (p, s) {
        var li = document.createElement("li"); li.setAttribute("data-s", s); li.setAttribute("style", H.seatStyle(hex(s)));
        li.innerHTML = '<span class="wpt-rk"></span><span class="bg-token" aria-hidden="true"></span><span class="wpt-rnm"></span><span class="wpt-rv"></span><span class="wpt-bar" aria-hidden="true"><i></i></span>';
        rail.appendChild(li); railEls.push(li);
      });
      names();
    }
    function names() {
      var B = BG();
      G.players.forEach(function (p, s) {
        var el = seatEls[s], li = railEls[s], c = SEATS[s].color, tok = esc((p.name.trim().charAt(0) || "?").toUpperCase()), cpu = !H.isPhone(c);
        if (el) { el.querySelector(".bg-token").innerHTML = tok; el.querySelector(".wpt-nm").textContent = p.name; el.querySelector(".wpt-cpu").innerHTML = cpu && B && B.icon ? '<span class="bg-player__cpu" title="Computer">' + B.icon("cpu") + "</span>" : ""; }
        if (li) { li.querySelector(".bg-token").innerHTML = tok; li.querySelector(".wpt-rnm").innerHTML = esc(p.name) + (cpu && B && B.icon ? B.icon("cpu") : ""); }
      });
    }
    function layout() {
      var t = $("wptTable"); if (!t) return false; var Wd = t.clientWidth, Ht = t.clientHeight; if (!Wd || !Ht) return false;
      var rem = remPx(), pad = rem * .7, gap = rem * .6, band = rem * 4.2, ip = rem * .45, ig = rem * .5, lh = rem * 1.75, cap = rem * 7.2, best = null, Cc, R;
      for (Cc = 1; Cc <= n; Cc++) {
        R = Math.ceil(n / Cc); if (Cc > 1 && Math.ceil(n / (Cc - 1)) === R) continue;
        if (R < 2 && n > 1) continue;
        var tw = (Wd - 2 * pad - (Cc - 1) * gap) / Cc, th = (Ht - 2 * pad - band - Math.max(0, R - 2) * gap) / R;
        var cw = Math.min(cap, (th - 2 * ip - lh) / 1.42), col = Math.max(cw * .62, rem * 3);
        cw = Math.min(cw, (tw - 2 * ip - ig - col) / 2.3);
        if (!best || cw > best.cw + .5) best = { C: Cc, R: R, tw: tw, th: th, cw: cw };
      }
      Cc = best.C; R = best.R;
      var cw2 = Math.max(Math.floor(best.cw), Math.round(rem * 2.2)), ch = Math.round(cw2 * 1.42), col = Math.round(Math.max(cw2 * .62, rem * 3)), pw = Math.round(Math.min(cw2 * .62, col - rem * .3)), ph = Math.round(pw * 1.42);
      var tw2 = Math.floor(best.tw), th2 = Math.floor(Math.min(best.th, 2 * ip + lh + ch + rem * .2));
      var rowsT = Math.floor(R / 2), nt = Math.min(rowsT * Cc, Math.floor(n / 2)), nb = n - nt, rt = Math.ceil(nt / Cc), rb = Math.ceil(nb / Cc);
      function rowsOf(m, r) { var a = [], i; for (i = 0; i < r; i++) a.push(Math.floor(m / r) + (i < m % r ? 1 : 0)); return a; }
      var seats = [], s = 0, blockH = function (r) { return r ? r * th2 + (r - 1) * gap : 0; };
      var free = Ht - 2 * pad - blockH(rt) - blockH(rb), y0 = pad, bandY = pad + blockH(rt) + free / 2;
      function rowAt(k, y) { var rw = k * tw2 + (k - 1) * gap, x0 = (Wd - rw) / 2; for (var i = 0; i < k; i++) { seats[s] = { x: x0 + i * (tw2 + gap), y: y }; s++; } }
      rowsOf(nt, rt).forEach(function (k, j) { rowAt(k, y0 + j * (th2 + gap)); });
      var yb = Ht - pad - blockH(rb);
      rowsOf(nb, rb).forEach(function (k, j) { rowAt(k, yb + j * (th2 + gap)); });
      var py = Math.max(0, Math.round((ch - ph - rem * 2.1) / 2));
      seatEls.forEach(function (el, q) {
        var p = seats[q];
        el.style.left = Math.round(p.x) + "px"; el.style.top = Math.round(p.y) + "px"; el.style.width = tw2 + "px"; el.style.height = th2 + "px";
        el.style.setProperty("--ip", ip + "px"); el.style.setProperty("--lh", lh + "px"); el.style.setProperty("--col", col + "px"); el.style.setProperty("--pw", pw + "px"); el.style.setProperty("--py", py + "px");
        var x0 = p.x + ip + col + ig, x1 = p.x + tw2 - ip;
        p.slot = { x0: x0, room: Math.max(cw2, x1 - x0), y: p.y + ip + lh + (th2 - 2 * ip - lh) / 2 - ch / 2 };
        p.pk = { x: p.x + ip + col / 2 - cw2 / 2, y: p.y + ip + lh + py + ph / 2 - ch / 2, k: pw / cw2 };
      });
      $("wptCards").style.setProperty("--cw", cw2 + "px");
      var bd = $("wptBand"); bd.style.top = Math.round(bandY - band / 2 + gap / 2) + "px"; bd.style.height = Math.round(band - gap) + "px";
      GEO = { W: Wd, H: Ht, cw: cw2, ch: ch, pw: pw, seats: seats, mid: { x: Wd / 2, y: bandY }, stack: { x: pad + cw2 * .2, y: bandY - ch / 2 } };
      sizeRail();
      return true;
    }
    // the rail: rows as tall as the room under the chips allows (16 seats: about 1.5rem each); measured again whenever the chips change
    function sizeRail() {
      var side = $("wptRail"); if (!side) return; var rem = remPx(), A = side.parentNode.getBoundingClientRect(), Rr = side.getBoundingClientRect();
      var room = (A.bottom - Rr.top - rem * (n > 8 ? 1.4 : 8.5) - (n - 1) * rem * .2) / n, v = Math.floor(clamp(room, rem * 1.45, rem * 2.6)) + "px";
      if (side.style.getPropertyValue("--rh") !== v) side.style.setProperty("--rh", v);
    }
    function fanPoses(s) {
      var a = tab[s] || []; if (!GEO) return a.map(function () { return NOPOSE; });
      var sl = GEO.seats[s].slot, cw = GEO.cw, gaps = [], tot = 0, i;
      for (i = 1; i < a.length; i++) { var g = a[i - 1].classList.contains("is-up") ? cw * .62 : cw * .3; gaps.push(g); tot += g; }
      var k = tot > 0 ? Math.min(1, Math.max(0, sl.room - cw) / tot) : 1, x = sl.x0, out = [];
      for (i = 0; i < a.length; i++) { if (i) x += gaps[i - 1] * k; out.push({ x: x, y: sl.y, k: 1 }); }
      return out;
    }
    var NOPOSE = { x: 0, y: 0, k: 1 };   // a table with no size yet (a WebView still laying out): the cards wait at the corner, nothing throws
    function pkPose(s) { return GEO ? GEO.seats[s].pk : NOPOSE; }
    function midPose(i) { return GEO ? { x: GEO.mid.x - GEO.cw / 2 + (i || 0) * 1.5, y: GEO.mid.y - GEO.ch / 2 - (i || 0) * 1.5, k: .8 } : NOPOSE; }
    function sidePose(j) { return GEO ? { x: GEO.stack.x + j * GEO.cw * .12, y: GEO.stack.y, k: .62, r: j % 2 ? 4 : -4 } : NOPOSE; }
    function layoutSeat(s, ms) { var a = tab[s] || [], ps = fanPoses(s); return Promise.all(a.map(function (el, i) { el.style.zIndex = 20 + i; return ms ? move(el, ps[i], ms) : (place(el, ps[i]), null); })); }
    function addToSeat(s, el) { (tab[s] = tab[s] || []).push(el); }
    function pendingOf(s) { var a = tab[s] || []; for (var i = a.length - 1; i >= 0; i--) if (a[i]._pend) { a[i]._pend = false; return a[i]; } return null; }
    function lastUp(s) { var a = tab[s] || []; for (var i = a.length - 1; i >= 0; i--) if (a[i].classList.contains("is-up")) return a[i]; return null; }
    function clearTable() { $("wptCards").innerHTML = ""; tab = {}; carryEls = []; kittyEls = []; }
    // the cards on the table drawn from the state (a resume, a resize): the table cards, the face-down cards of seats that have acted
    function renderCards() {
      clearTable(); if (!GEO) return;
      var i, s;
      if (G.phase === "war" || G.phase === "claim") G.tb.forEach(function (e) { var el = newCard(e.up ? e.c : null, e.up, pkPose(e.s)); el.setAttribute("data-id", e.up ? e.c : ""); addToSeat(e.s, el); });
      if (G.phase === "claim" && G.pend) G.pend.pot.forEach(function (c, j) { if (!G.tb.length) { var el = newCard(c, true, pkPose(G.pend.w)); addToSeat(G.pend.from[j] >= 0 ? G.pend.from[j] : G.pend.w, el); } });
      Object.keys(G.pick || {}).forEach(function (k) {
        s = +k; var cnt = laidN(s);
        for (i = 0; i < cnt; i++) { var el = newCard(null, false, pkPose(s)); if (i === cnt - 1) el._pend = true; addToSeat(s, el); }
      });
      for (s = 0; s < n; s++) layoutSeat(s, 0);
      G.carry.forEach(function (c, j) { carryEls.push(newCard(c, true, sidePose(j))); });
      for (i = 0; i < G.kitty.length; i++) kittyEls.push(newCard(null, false, sidePose(i)));
      if (G.phase === "claim" && G.pend) { var u = lastUp(G.pend.w); if (u) u.classList.add("is-win"); }
    }
    function laidN(s) { if (G.over || !G.pick || !G.pick[s]) return 0; if (G.phase === "flip") return 1; if (G.phase !== "war") return 0; var a = E.avail(G, s); return a > 0 ? Math.min(G.down, a - 1) + 1 : 0; }
    function needTodo() { if (!G || G.over) return []; if (G.phase === "claim") return G.pend ? [G.pend.w] : []; return E.need(G).filter(function (s) { return !G.pick[s]; }); }
    function countsNow() { disp = G.players.map(function (p, s) { return Math.max(0, E.total(G, s) - laidN(s)); }); }
    function paintStack(s) {
      var el = seatEls[s]; if (!el) return; var pk = el.querySelector(".wpt-stack"), v = disp[s] || 0, p = G.players[s];
      var stackN = O.length === "onepass" ? Math.max(0, v - p.won.length) : Math.max(0, v - p.pr.length - p.hand.length);
      var L = stackN > 0 ? Math.min(5, Math.ceil(stackN / 9)) : 0;
      if (pk._L !== L) { pk._L = L; var h = ""; for (var i = 0; i < L; i++) h += C.backHTML({ attrs: 'style="transform:translate(' + (-i * 1.5) + "px," + (-i * 1.5) + 'px)"' }); pk.innerHTML = h; pk.classList.toggle("is-empty", L === 0); }
    }
    function setCount(s, v, tween) {
      var el = seatEls[s] && seatEls[s].querySelector(".wpt-n b"); if (!el) return; var from = disp[s]; disp[s] = v; var B = BG();
      if (tween && B && B.tweenNumber && !calm() && from !== v) B.tweenNumber(el, from, v, sp(420)); else el.textContent = String(v);
      seatEls[s].querySelector(".wpt-n small").textContent = v === 1 ? "card" : "cards";
      paintStack(s);
    }
    function tags() {
      var todo = needTodo();
      G.players.forEach(function (p, s) {
        var el = seatEls[s]; if (!el) return; var c = SEATS[s].color;
        var fi = !!fight && fight.f.indexOf(s) >= 0, ti = !!fight && fight.t.indexOf(s) >= 0;
        var tag = p.out ? ["Out", "out"] : dealing && s === G.dealer ? ["Dealer", ""] : fi ? (ti ? ["Tied", "tied"] : ["War", "war"]) : H.isAway(c) ? ["Away", "away"] : (!G.over && !busy && G.pick[s]) ? ["Ready", "ready"] : auto[c] && H.isHuman(c) ? ["Auto", ""] : p.pr.length ? ["PoW " + p.pr.map(E.shortName).join(" "), ""] : ["", ""];
        var tg = el.querySelector(".wpt-tag"); tg.innerHTML = C.pipText(esc(tag[0])); tg.className = "wpt-tag" + (tag[1] ? " is-" + tag[1] : "");
        el.classList.toggle("is-fight", fi); el.classList.toggle("is-tied", ti); el.classList.toggle("is-out", !!p.out);
        el.classList.toggle("is-need", !dealing && !busy && !G.over && todo.indexOf(s) >= 0 && H.isHuman(c) && !auto[c]);   // the whose-turn ring: the people still to act
        el.classList.toggle("is-win", !!(G.over && G.winner === s));
        var n0 = el.querySelector(".wpt-n b"); if (n0 && !n0._tw && n0.textContent !== String(disp[s])) { n0.textContent = String(disp[s]); el.querySelector(".wpt-n small").textContent = disp[s] === 1 ? "card" : "cards"; }
        paintStack(s);
      });
    }
    // ---- the count rail: always sorted, leader first, every player on their own place (E.standings; mid-animation the counts on screen) ----
    function railRows() {
      if (!busy && !dealing) return E.standings(G);
      var r = G.players.map(function (p, s) { return { s: s, count: disp[s] || 0, out: p.out, outAt: p.outAt }; });
      r.sort(function (a, b) { return (a.out !== b.out ? (a.out ? 1 : -1) : 0) || ((a.out && b.out) ? (b.outAt || 0) - (a.outAt || 0) : 0) || (b.count - a.count) || (a.s - b.s); });
      r.forEach(function (x, i) { x.place = i + 1; }); return r;
    }
    function renderRail() {
      var ul = $("wptRail"); if (!ul || !railEls.length) return;
      var rows0 = railRows(), B = BG(), before = railEls.map(function (li) { return li.getBoundingClientRect(); }), moved = false, todo = needTodo();
      rows0.forEach(function (r, i) {
        var li = railEls[r.s], p = G.players[r.s], c = SEATS[r.s].color, v = dealing ? disp[r.s] || 0 : r.count;
        li.querySelector(".wpt-rk").textContent = String(r.place);
        li.querySelector(".wpt-rv").textContent = p.out ? "Out" : String(v);
        li.querySelector(".wpt-bar > i").style.transform = "scaleX(" + (deckN ? Math.min(1, v / deckN) : 0).toFixed(3) + ")";
        li.classList.toggle("is-out", !!p.out);
        li.classList.toggle("is-need", !dealing && !busy && !G.over && todo.indexOf(r.s) >= 0 && H.isHuman(c) && !auto[c]);
        li.setAttribute("aria-label", ord(r.place) + ": " + p.name + ", " + (p.out ? "out" : plural(v, "card")));
        if (ul.children[i] !== li) { ul.insertBefore(li, ul.children[i] || null); moved = true; }
      });
      if (moved && B && B.flip && !calm()) railEls.forEach(function (li, s) { try { B.flip(li, before[s], { ms: sp(320) }); } catch (e) { } });
    }
    function renderLog() { var l = $("wptLog"); if (!l) return; l.innerHTML = G.log.slice(-4).map(function (e) { return "<li>" + C.pipText(esc(e.t)) + "</li>"; }).join(""); }
    function potLine() {
      var el = $("wptPot"); if (!el) return; var k = 0, s; for (s in tab) k += tab[s].length; k += carryEls.length;
      var war = !!fight || roundWar || (!busy && (G.phase === "war" || (G.phase === "claim" && G.pend && G.pend.war > 0)));
      el.innerHTML = !G.over && !dealing && k ? (war ? "War pot" : "Battle pot") + " <b>" + k + "</b> " + (k === 1 ? "card" : "cards") : "";
      el.classList.toggle("is-war", war);
      var nt = $("wptNote");
      nt.textContent = dealing ? "" : G.kitty.length ? plural(G.kitty.length, "card") + " left over: to the first war's winner" : G.carry.length ? G.carry.length + " tied cards: to the next battle's winner" : G.aside.length ? G.aside.length + " set aside" : "";
    }
    function chips() {
      $("wptBattle").textContent = "Battle " + (G.over ? G.battle : G.battle + 1) + (O.length === "battles" ? " of " + O.limit : "") + (G.sudden ? " · sudden death" : "");
      var ck = $("wptClock");
      if (O.length === "time") { var left = Math.max(0, O.limit * 60000 - clockMs - runMs()), m = Math.floor(left / 60000), sec = Math.floor(left / 1000) % 60; ck.textContent = G.bell ? "Time!" : m + ":" + String(sec).padStart(2, "0") + " left"; }
      else ck.textContent = "";
    }
    function status(t) { var el = $("wptStat"); if (el) el.innerHTML = C.pipText(esc(t)); H.status(C.pipText(esc(t))); }
    function sync() { if (!busy && !dealing) countsNow(); tags(); renderRail(); renderLog(); potLine(); chips(); sizeRail(); }
    async function banner(title, sub, ms, kind) {
      var b = $("wptBanner"); if (!b) return; $("wptBannerT").textContent = title; $("wptBannerS").innerHTML = C.pipText(esc(sub || ""));
      b.className = "wpt-banner" + (kind ? " is-" + kind : ""); b.classList.add("is-on");
      if (!calm() && b.animate) {
        try { await b.animate([{ opacity: 0, transform: "translate(-50%,-50%) scale(.6)" }, { opacity: 1, transform: "translate(-50%,-50%) scale(1.06)", offset: .18 }, { opacity: 1, transform: "translate(-50%,-50%) scale(1)", offset: .3 }, { opacity: 1, transform: "translate(-50%,-50%) scale(1)", offset: .85 }, { opacity: 0, transform: "translate(-50%,-50%) scale(.97)" }], { duration: ms, easing: "ease-out" }).finished; } catch (e) { await wait(ms); }
      } else await wait(ms);
      b.classList.remove("is-on");
    }
    var t0 = 0; function runMs() { return t0 ? Date.now() - t0 : 0; }
    var tick = setInterval(function () { if (H.live() && G && !G.over) chips(); }, 1000);
    function onResize() { if (layout()) { renderCards(); sync(); } }
    window.addEventListener("resize", onResize);
    H.onEnd(function () { clearInterval(tick); window.removeEventListener("resize", onResize); clearTimeout(pushT); document.removeEventListener("keydown", onKey, true); });
    stats.sync = function () { if (!busy && !dealing) { layout(); renderCards(); sync(); pushNow(); } };   // tests: redraw after they set up the stacks

    // ---- the phones: this player's slim view (the private hand only goes to its own phone) ----
    function cardInfo(c, best) { return { c: c, nm: E.cardName(c), sh: E.shortName(c), p: Math.round(100 * E.strength(G, c)), w: !!E.isWild(G, c), best: !!best }; }
    function stepKey() { return G.battle + ":" + G.phase + ":" + G.warN; }
    function suggest(s) { try { if (!W.Brain || !O.hand) return null; var tmp = JSON.parse(JSON.stringify(G)); tmp.players[s].skill = "normal"; var m = W.Brain.decide(tmp, s); return m && m.t === "pick" ? m.c : null; } catch (e) { return null; } }
    function phoneSt(c, ask) {
      var i = ixOf(c), p = G.players[i], rows0 = railRows(), place = 0;
      rows0.forEach(function (r) { if (r.s === i) place = r.place; });
      var bestC = ask === "pick" ? suggest(i) : null, myUp = null;
      if (G.cur && G.cur[i] != null && (G.phase === "war" || G.phase === "claim")) myUp = G.cur[i];
      else if (G.last && G.last.first) G.last.first.forEach(function (x) { if (x.s === i && G.last.b === G.battle) myUp = x.c; });
      var st = { v: 1, me: i, step: stepKey(), ph: dealing ? "deal" : G.phase, watch: !!busy || dealing, ask: ask || null, battle: G.over ? G.battle : G.battle + 1,
        warN: G.warN, down: G.down, over: G.over, winner: G.winner, draw: G.draw, ver: versionOf(O.version).name, hand: !!O.hand, auto: !!auto[c], n: n, deckN: deckN, dealer: G.dealer,
        need: needTodo(), acted: Object.keys(G.pick || {}).map(Number),
        my: { cnt: disp[i] != null ? disp[i] : E.total(G, i), out: !!p.out, place: place, up: myUp != null ? cardInfo(myUp) : null, lay: G.phase === "war" ? Math.max(0, Math.min(G.down, E.avail(G, i) - 1)) : 0,
          hand: O.hand ? p.hand.map(function (x) { return cardInfo(x, x === bestC); }) : [], pr: p.pr.map(function (x) { return cardInfo(x, x === bestC); }), stack: p.pk.length },
        pl: G.players.map(function (q, k) { var ck = SEATS[k].color; return { n: q.name, hex: hex(k), cnt: disp[k] != null ? disp[k] : E.total(G, k), out: !!q.out, cpu: !H.isPhone(ck), away: H.isAway(ck) }; }),
        stand: rows0.map(function (r) { return r.s; }),
        line: G.log.length ? G.log[G.log.length - 1].t : "", fight: fight ? fight.f.slice() : null };
      if (G.phase === "claim" && G.pend && G.pend.w === i) {
        st.claim = { prOk: G.pend.prOk.map(function (x) { return cardInfo(x); }), pot: G.pend.pot.length, arrange: !!O.arrange, war: G.pend.war > 0 };
        if (st.claim.prOk.length) { var bp = G.pend.prOk.slice().sort(function (a, b) { return E.strength(G, b) - E.strength(G, a); })[0]; st.claim.prOk.forEach(function (x) { x.best = x.c === bp; }); }
      }
      return st;
    }
    var pushT = 0;
    function pushNow() { clearTimeout(pushT); pushT = 0; stats.pushes++; H.pushAll(function (c) { return phoneSt(c, null); }); }
    function pushSoon() { if (pushT) return; pushT = setTimeout(function () { pushT = 0; if (H.live()) pushNow(); }, 450); }
    H.onReconnect(function () { stats.reconnects++; pushNow(); });
    H.onTakeOver(function (c) { stats.takes++; var i = ixOf(c); if (i >= 0) G.players[i].human = true; auto[c] = false; tags(); renderRail(); H.push(c, phoneSt(c, null)); });
    H.onLeave(function (c) { stats.leaves++; var i = ixOf(c); auto[c] = false; if (i >= 0) { G.players[i].human = false; G.players[i].name = H.name(c); G.players[i].skill = H.skill(); } names(); sync(); pushNow(); });
    H.onView(function (c, d) {
      stats.views++; if (!d || typeof d !== "object") return;
      if (d.auto != null) { auto[c] = !!d.auto; if (auto[c]) H.interrupt(c); tags(); renderRail(); H.push(c, phoneSt(c, null)); if (auto[c]) H.toast(H.name(c) + " turned on Auto"); }
    });
    // the Victory in the same order as E.standings (the host sorts: winner, then s, bigger first)
    H.standings(function () {
      var rs = E.standings(G);
      return rs.map(function (r) { var p = G.players[r.s]; return { name: p.name, color: hex(r.s), v: p.out ? "Out" + (p.outAt > 0 ? " after battle " + p.outAt : "") : plural(r.count, "card"), s: [n - r.place], win: r.s === G.winner, k: r.s }; });
    });
    function save() {
      if (G.over) { lsSet(KEY, null); return; }
      stats.saves++; lsSet(KEY, { v: SAVEV, G: G, t: Date.now(), ms: clockMs + runMs() });
    }

    // ---- moves: the computers (the brain), Auto (the brain's pick for Hand War, else the top card) and the phones' answers ----
    function cpuMove(s) { var m = null; try { if (W.Brain) m = W.Brain.decide(G, s); } catch (e) { m = null; } return m || E.defaultMove(G, s); }
    function autoMove(s) { if (G.phase === "flip" && O.hand) { var c = suggest(s); if (c != null) return { t: "pick", s: s, c: c }; } return E.defaultMove(G, s); }
    function machineMove(s) { var c = SEATS[s].color; if (H.isPhone(c) && auto[c] && !H.isAway(c)) { stats.autoActs++; return autoMove(s); } stats.cpuActs++; return cpuMove(s); }
    function fromPhone(s, r) {
      if (!r || !r.id) return null; var d = r.data || {};
      if (r.id === "flip") return d.pr != null ? { t: "flip", s: s, pr: +d.pr } : { t: "flip", s: s };
      if (r.id === "pick") return { t: "pick", s: s, c: +d.c };
      if (r.id === "claim") {
        var m = { t: "claim", s: s, pr: d.pr == null ? null : +d.pr };
        if (O.arrange && d.order && d.order !== "shuffle" && G.pend) { var rest = G.pend.pot.slice(); if (m.pr != null) rest.splice(rest.indexOf(m.pr), 1); m.order = orderOf(d.order, rest); }
        return m;
      }
      return null;
    }
    function orderOf(kind, rest) {
      var a = rest.slice().sort(function (x, y) { return E.strength(G, y) - E.strength(G, x); });
      if (kind === "weak") return a.reverse();
      if (kind === "spread") { var o = [], i = 0, j = a.length - 1; while (i <= j) { o.push(a[i++]); if (i <= j) o.push(a[j--]); } return o; }
      return a;
    }
    function planOf(m) {
      if (m.t === "flip" && G.phase === "flip") return { kind: "flip", s: m.s };
      if (m.t === "pick") return { kind: "flip", s: m.s };
      if (m.t === "flip" && G.phase === "war") { var a = E.avail(G, m.s); return { kind: "war", s: m.s, nd: a > 0 ? Math.min(G.down, a - 1) : 0, up: a > 0 }; }
      return null;
    }
    // a seat acted: its card(s) leave the stack face down for the battle slot (the faces turn together when the last player has acted)
    function animPlan(plan) {
      if (!plan || !GEO) return Promise.resolve();
      var s = plan.s, ps = [];
      if (plan.kind === "flip") { var el = newCard(null, false, pkPose(s)); el._pend = true; addToSeat(s, el); setCount(s, Math.max(0, (disp[s] || 0) - 1)); H.sfx("deal"); ps.push(layoutSeat(s, sp(300))); }
      else if (plan.kind === "war" && plan.up) {
        for (var i = 0; i <= plan.nd; i++) { var e2 = newCard(null, false, pkPose(s)); if (i === plan.nd) e2._pend = true; else e2.setAttribute("data-wn", String(i + 1)); addToSeat(s, e2); }
        setCount(s, Math.max(0, (disp[s] || 0) - plan.nd - 1)); H.sfx("deal");
        var a = tab[s], m = a.length, fp = fanPoses(s); ps.push(Promise.all(a.map(function (x, j) { x.style.zIndex = 20 + j; return move(x, fp[j], sp(320), { delay: Math.max(0, j - (m - plan.nd - 1)) * dl(70) }); })));
      }
      return Promise.all(ps);
    }

    // ---- the events of a resolved battle, in order ----
    function mergeOuts(evs) {
      var out = []; evs.forEach(function (e) { if (e.e === "out") { var last = out[out.length - 1]; if (last && last.e === "outs") { last.seats.push(e.s); return; } out.push({ e: "outs", seats: [e.s] }); return; } out.push(e); });
      return out;
    }
    async function playEvents(evs) {
      evs = mergeOuts(evs);
      for (var i = 0; i < evs.length; i++) { if (!H.live()) return; stats.seen[evs[i].e] = (stats.seen[evs[i].e] || 0) + 1; stats.events.push(evs[i].e); if (stats.events.length > 400) stats.events.splice(0, 200); await animEvent(evs[i]); }
    }
    async function animEvent(e) {
      var s, el, i;
      switch (e.e) {
        case "reveal": {
          var flips = [], war = e.w > 0;
          if (war) {   // the drum roll before the deciding flip: the waiting cards beat twice (a finite transform pulse), then all turn at once
            if (!calm() && GEO) (e.cards || []).forEach(function (x) { var a = tab[x.s] || [], pe = null; for (var j = a.length - 1; j >= 0; j--) if (a[j]._pend) { pe = a[j]; break; } if (!pe || !pe._p || !pe.animate) return; var p0 = pe._p;
              try { pe.animate([{ transform: T(p0) }, { transform: T({ x: p0.x, y: p0.y - GEO.ch * .05, k: 1.08 }), offset: .5 }, { transform: T(p0) }], { duration: dl(280), iterations: 2, easing: "ease-in-out" }); } catch (er) { } });
            await wait(600);
          }
          (e.cards || []).forEach(function (x) {
            if (war && x.held) return;
            el = pendingOf(x.s); if (!el) { el = newCard(null, false, pkPose(x.s)); addToSeat(x.s, el); layoutSeat(x.s, 0); }
            el.style.zIndex = ++zTop; flips.push(flipUp(el, x.c, war ? sp(820) : sp(430), war || n >= 5));
          });
          stats.flips++; H.sfx(war ? "dice" : "card");
          await Promise.all(flips);
          if (!war) status(revealLine(e.cards));
          await wait(war ? 380 : (n >= 9 ? 380 : 260));
          return;
        }
        case "war": {
          stats.wars++; if (e.n > stats.maxWar) stats.maxWar = e.n;
          e.tied.forEach(function (x) { var u = lastUp(x); if (u) u.classList.add("is-win"); });
          fight = { f: e.seats.slice(), t: e.tied.slice() }; tags(); potLine(); pushNow();
          var tc = e.tied.map(function (x) { var u = lastUp(x), id = u ? u.getAttribute("data-id") : ""; return nm(x) + (id !== "" && id != null ? " " + E.shortName(+id) + (E.isWild(G, +id) ? " (wild)" : "") : ""); });
          var sub = e.forced ? (O.twos ? "A 2 declares war" : "A joker declares war") : (e.tied.length <= 4 ? tc.join(" · ") : who(e.tied) + " tie") + (e.seats.length > e.tied.length ? " · " + who(e.seats) + " fight" : "");
          sub += e.down ? ": " + e.down + " face down, then the " + ord(e.down + 1) + " card decides" : ": the next cards decide";
          if (e.n > 1) for (s in tab) tab[s].forEach(function (x) { x.removeAttribute("data-wn"); });
          status(warWord(e.n) + " " + (e.forced ? "" : who(e.tied) + " tie"));
          H.sfx("cannon");
          await banner(warWord(e.n), sub, dl(1700), "war");
          for (s in tab) tab[s].forEach(function (x) { x.classList.remove("is-win"); });
          return;
        }
        case "short": await banner("Out of cards", who(e.seats) + (e.seats.length > 1 ? " can't finish the war and lose" : " can't finish the war and loses"), dl(1500)); return;
        case "underdog": H.sfx("bump"); await banner("Underdog!", nm(e.s) + " has a Jack face down and steals the war from " + nm(e.from), dl(1600)); return;
        case "carry": {
          var all = []; for (s in tab) all = all.concat(tab[s]); tab = {}; fight = null;
          var base = carryEls.length, ps = [];
          all.forEach(function (x, j) { x.classList.remove("is-win", "is-lose"); carryEls.push(x); ps.push(move(x, sidePose(base + j), sp(380), { delay: j * dl(30), front: true })); });
          await Promise.all(ps); status("A tie: the cards go to the next battle's winner"); await banner("A tie", "The " + e.n + " cards go to the next battle's winner", dl(1100)); return;
        }
        case "deadlock": {
          var dd = []; for (s in tab) dd = dd.concat(tab[s]); tab = {}; fight = null;
          await banner("Deadlock", who(e.seats) + " tie with their last cards: the cards are set aside", dl(1500));
          await Promise.all(dd.map(function (x, j) { return move(x, midPose(j % 3), sp(380), { delay: j * dl(25) }).then(function () { x.remove(); }); }));
          potLine(); return;
        }
        case "kitty": kittyEls.forEach(function (x) { x.style.zIndex = ++zTop; x._sweep = true; }); return;
        case "pay": {
          el = newCard(null, false, pkPose(e.s)); setCount(e.s, Math.max(0, (disp[e.s] || 0) - 1)); addToSeat(e.to, el);
          await layoutSeat(e.to, sp(320)); return;
        }
        case "win": {
          for (s in tab) { var u = lastUp(+s); if (u) { u.classList.toggle("is-win", +s === e.s); u.classList.toggle("is-lose", +s !== e.s); } }
          seatEls.forEach(function (se, q) { se.classList.toggle("is-win", q === e.s); });
          var line = "";
          for (i = G.log.length - 1; i >= 0; i--) if (G.log[i].k === "win" && G.log[i].b === battleNo) { line = G.log[i].t; break; }
          status(line || (nm(e.s) + (e.war ? " wins the war" : " wins") + " and takes " + plural(e.n, "card")));
          if (e.war) { var wu = lastUp(e.s), wid = wu ? wu.getAttribute("data-id") : null; H.sfx("conquer"); await banner(nm(e.s) + " wins the war", (wid != null && wid !== "" && e.how !== "underdog" ? "With the " + E.cardName(+wid) + " · " : "") + "takes " + plural(e.n, "card"), dl(1500), "win"); }
          else await wait(n >= 9 ? 520 : 650);
          return;
        }
        case "claim": return;
        case "prisoner": {
          var src = null;
          for (s in tab) { if (+s === e.s) continue; var a = tab[s]; for (i = 0; i < a.length; i++) if (a[i].getAttribute("data-id") === String(e.c)) { src = a[i]; a.splice(i, 1); break; } if (src) break; }
          if (!src) for (s in tab) { if (+s === e.s) continue; var a2 = tab[s]; for (i = 0; i < a2.length; i++) if (!a2[i].classList.contains("is-up")) { src = a2[i]; a2.splice(i, 1); break; } if (src) break; }
          status(nm(e.s) + " takes the " + E.shortName(e.c) + " prisoner");
          if (!src) return;
          src.classList.remove("is-win", "is-lose"); if (!src.classList.contains("is-up")) await flipUp(src, e.c, sp(360), false);
          await move(src, pkPose(e.s), sp(420), { lift: true, front: true }); src.remove(); return;
        }
        case "collect": {
          var els = []; for (s in tab) els = els.concat(tab[s]); tab = {};
          els = els.concat(carryEls); carryEls = [];
          var kept = []; kittyEls.forEach(function (x) { if (x._sweep) els.push(x); else kept.push(x); }); kittyEls = kept;
          var to = pkPose(e.s), st2 = els.length > 24 ? dl(10) : dl(28);
          H.sfx("deal");
          await Promise.all(els.map(function (x, j) { x.classList.remove("is-win", "is-lose"); return move(x, to, sp(420), { delay: j * st2, front: true }).then(function () { x.remove(); }); }));
          fight = null;
          var tot = Math.max(0, E.total(G, e.s));
          setCount(e.s, tot, true);
          seatEls.forEach(function (se) { se.classList.remove("is-win"); });
          renderRail(); potLine();
          await wait(170); return;
        }
        case "outs": case "out": {
          var seats = e.seats || [e.s];
          seats.forEach(function (x) { if (seatEls[x]) seatEls[x].classList.add("is-out"); });
          H.sfx("bump"); tags();
          await banner("Out of cards", who(seats) + (seats.length > 1 ? " are out" : " is out"), dl(seats.length > 1 ? 1400 : 1200)); return;
        }
        case "sudden": H.sfx("bell"); await banner("Sudden death", who(e.seats) + " are tied: the next battle that breaks the tie wins", dl(1800)); return;
        case "next": return;
        case "over": return;
        default: return;
      }
    }
    var battleNo = 0, roundWar = false;
    function fightOf() {   // who is in the war now (the fighters still to lay their cards: from the engine; the tied: the best up cards)
      if (G.phase !== "war") return null; var f = (G.part || []).slice(), ids = f.map(function (s) { return G.cur[s]; });
      return { f: f, t: ids.some(function (c) { return c == null; }) ? [] : E.winnersOf(G, ids).map(function (i) { return f[i]; }) };
    }
    function revealLine(cards) {
      if (!cards || !cards.length) return "";
      if (cards.length <= 4) return cards.map(function (x) { return nm(x.s) + " " + E.shortName(x.c) + (E.isWild(G, x.c) ? " (wild)" : ""); }).join(" · ");
      var ids = cards.map(function (x) { return x.c; }), w = E.winnersOf(G, ids);
      return "Top card: " + E.shortName(ids[w[0]]) + (w.length > 1 ? " · " + w.length + " tied" : "");
    }

    // ---- one battle (or one war round): every seat that must act acts at once; the phones answer, the computers flip together ----
    async function battleRound() {
      if (O.length === "time" && !G.bell && clockMs + runMs() >= O.limit * 60000 && G.phase === "flip" && !Object.keys(G.pick).length) {
        var bev = E.ringBell(G); H.sfx("bell"); chips(); save();
        await banner("Time!", "The time is up: the most cards wins", dl(1600));
        if (bev.length) await playEvents(bev);
        busy = false; countsNow(); sync(); pushNow();
        if (G.over) return;
      }
      if (G.phase === "claim") return claimRound();
      var todo = needTodo(); if (!todo.length) { await wait(300); return; }
      battleNo = G.battle; roundWar = G.phase === "war"; fight = fightOf();
      var finished = false, resolve0, done = new Promise(function (r) { resolve0 = r; }), flights = [], k = 0, ph = G.phase, wn = G.warN;
      var askTitle = ph === "war" ? warWord(Math.max(1, wn)) : O.hand ? "Choose your card" : "Flip!";
      var askSub = ph === "war" ? (G.down ? "Lay " + G.down + " face down, then turn up the " + ord(G.down + 1) : "Turn up your next card") : O.hand ? "Pick a card from your hand" : "Turn up your top card";
      function act(m) {
        if (finished || !H.live() || !m) return;
        if (needTodo().indexOf(m.s) < 0) return;
        var plan = planOf(m), r = E.apply(G, m);
        if (!r.ok) { var d = E.defaultMove(G, m.s); if (!d) return; plan = planOf(d); r = E.apply(G, d); if (!r.ok) return; }
        flights.push(animPlan(plan)); save(); tags(); renderRail(); potLine(); pushSoon();
        if (r.ev.some(function (x) { return x.e !== "acted"; })) { finished = true; resolve0(r.ev); }
      }
      function later(s, ms) { setTimeout(function () { if (finished || !H.live()) return; act(machineMove(s)); }, ms); }
      var first = Object.keys(G.pick).length === 0, base = dl(ph === "war" ? 300 : first ? 480 : 260), stag = dl(n > 8 ? 26 : 45), humans = [];
      todo.forEach(function (s) {
        var c = SEATS[s].color;
        if (H.isHuman(c) && !auto[c]) {
          humans.push(s); stats.asks++;
          H.turn(c, phoneSt(c, ph === "flip" && O.hand ? "pick" : ph), { title: askTitle, sub: askSub, timeoutMs: window.__warpTO || 0 }).then(function (r) {
            if (finished || !H.live()) return;
            var m = fromPhone(s, r);
            if (m && r) { stats.phoneActs++; act(m); if (!finished && needTodo().indexOf(s) >= 0) later(s, dl(120)); }   // a refused answer: the default move
            else later(s, dl(160));
          });
        } else later(s, base + (k++) * stag);
      });
      busy = false; tags(); renderRail(); pushNow();
      var wait0 = humans.length ? humans.map(nm) : [];
      status(ph === "war" ? warWord(Math.max(1, wn)) + " " + (wait0.length ? "Waiting for " + (wait0.length <= 3 ? listNames(wait0) : wait0.length + " players") : "The war cards go down") : wait0.length ? (O.hand ? "Choose a card: " : "Flip: ") + (wait0.length <= 3 ? listNames(wait0) : wait0.length + " players") : "Everyone flips");
      H.hint(humans.length ? (ph === "war" ? "Players: lay your war cards on your phones" : O.hand ? "Players: choose a card on your phones" : "Players: press Flip on your phones") : "The computers are flipping");
      var ev = await done;
      busy = true;
      await Promise.all(flights);
      if (!H.live()) return;
      tags(); renderRail(); pushNow();
      await playEvents(ev);
      busy = false; fight = null; roundWar = false;
      if (G.battle !== battleNo) stats.battles++;
      countsNow(); sync(); pushNow();
    }
    async function claimRound() {
      var w = G.pend.w, c = SEATS[w].color, m = null, b0 = G.battle;
      status(nm(w) + " wins" + (G.pend.war ? " the war" : " the battle") + ": " + (G.pend.prOk.length ? "taking a prisoner" : "arranging the cards"));
      pushNow();
      if (H.isHuman(c) && !auto[c]) {
        H.hint(nm(w) + ": choose on your phone");
        stats.asks++;
        var r = await H.turn(c, phoneSt(c, "claim"), { title: "You win" + (G.pend.war ? " the war" : " the battle"), sub: G.pend.prOk.length ? "Take a prisoner?" : "Arrange the cards you won", timeoutMs: window.__warpTO || 0 });
        if (!H.live()) return;
        m = fromPhone(w, r); if (m) stats.phoneActs++;
      }
      if (!m) { await wait(700); m = H.isPhone(c) && auto[c] ? E.defaultMove(G, w) : cpuMove(w); }
      var res = E.apply(G, m); if (!res.ok) { var d = E.defaultMove(G, w); res = d ? E.apply(G, d) : res; }
      if (!res.ok) { await wait(300); return; }
      save(); busy = true; pushNow();
      await playEvents(res.ev);
      busy = false; if (G.battle !== b0) stats.battles++; countsNow(); sync(); pushNow();
    }

    // ---- the deal: War has no first player (Bicycle, Pagat: everyone turns a card at the same time), so the opening show is the deal,
    //      one card at a time round the table from the dealer's left. OK skips it ----
    var skipDeal = false;
    function onKey(ev) { if (dealing && (ev.key === "Enter" || ev.key === " " || ev.keyCode === 13 || ev.keyCode === 23)) { skipDeal = true; ev.preventDefault(); ev.stopPropagation(); } }
    document.addEventListener("keydown", onKey, true);
    async function dealShow() {
      var fp = E.firstPlayer(G), seq = (G.dealSeq || []).slice(), steps = Math.min(seq.length, 72), got = G.players.map(function () { return 0; });
      dealing = true; stats.dealing = true; disp = G.players.map(function () { return 0; }); G.players.forEach(function (p, s) { setCount(s, 0); });
      sync(); pushNow();
      status(nm(G.dealer) + " deals " + plural(seq.filter(function (x) { return x >= 0; }).length, "card") + (O.nd > 1 ? " (" + O.nd + " decks)" : "") + ": no first player, everyone flips at once");
      H.hint("Press OK to skip the deal");
      var deck = newCard(null, false, midPose(0)), flights = [], idx = 0;
      if (!calm()) {
        for (var j = 0; j < steps && !skipDeal && H.live(); j++) {
          var upto = Math.round((j + 1) / steps * seq.length), last = -1;
          for (; idx < upto; idx++) { if (seq[idx] >= 0) { got[seq[idx]]++; last = seq[idx]; } }
          if (last < 0) continue;
          (function (s, snap) { var el = newCard(null, false, midPose(0)); flights.push(move(el, pkPose(s), sp(300)).then(function () { el.remove(); if (!skipDeal) G.players.forEach(function (p, q) { if (snap[q] !== disp[q]) setCount(q, snap[q]); }); })); })(last, got.slice());
          if (j % 4 === 0) H.sfx("deal");
          await wait(Math.max(12, Math.round(2600 / steps)));
        }
        await Promise.all(flights);
      } else await wait(700);
      if (!H.live()) return;
      deck.remove(); $("wptCards").querySelectorAll(".wcard").forEach(function (x) { x.remove(); });
      dealing = false; stats.dealing = false; stats.dealSkipped = skipDeal; countsNow(); G.players.forEach(function (p, s) { setCount(s, disp[s]); }); renderCards(); sync();
      await banner("Everyone flips at once", fp.why ? "War has no first player: everyone turns a card at the same time." : "", dl(skipDeal ? 900 : 1500));
    }

    // ---- start ----
    buildSeats();
    await H.sleep(30);   // the table is laid out on screen first
    layout(); countsNow(); renderCards(); sync();
    stats.layout = GEO ? { cw: GEO.cw, cols: GEO.seats.length } : null;
    t0 = Date.now();
    if (resumed) {
      status("Welcome back: battle " + (G.battle + 1)); pushNow();
      await banner("Welcome back", versionOf(O.version).name + " · battle " + (G.battle + 1) + " · " + n + " players", dl(1600));
    } else await dealShow();
    save(); pushNow();
    while (H.live() && !G.over) await battleRound();
    if (!H.live()) return;
    // ---- the end ----
    try { if (W.Brain && W.Brain.finish) W.Brain.finish(G); } catch (e) { }
    lsSet(KEY, null); clearInterval(tick);
    busy = false; fight = null; countsNow(); sync(); pushNow();
    var win = G.winner >= 0 ? nm(G.winner) : (G.draw || []).map(nm).join(" & ");
    var why = { all: " has every card", joker: " captures the other joker", time: " has the most cards at the bell", battles: " has the most cards after " + O.limit + " battles", onepass: " won the most cards", sudden: " breaks the tie", cap: " has the most cards" }[G.why] || " wins";
    status(G.winner >= 0 ? win + why + " and wins!" : "A draw: " + win);
    H.hint("Game over");
    H.sfx("win");
    await banner(G.winner >= 0 ? win + " wins!" : "A draw", G.winner >= 0 ? win + why : "Between " + listNames((G.draw || []).map(nm)), dl(1800), "win");
    H.over(win || "Nobody");
    var wp = $("wpt"); if (wp) { wp.classList.add("is-over"); setTimeout(function () { if (layout()) { renderCards(); sync(); } }, 60); }   // the host adds New Game under the hint bar
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
