/* MOTOCROSS WAR in Party Mode: the TV side (firestick/games/README.md is the guide; the registry line is in games/registry.js; the phones:
   games/mxwar-phone.js).
   SAME GAME, SAME ENGINE: the rules are the phone game's own files, loaded by the registry line (../mxwar/data/index.js, race.js, round.js,
   season.js, brain.js, art.js, track.js), and every season file comes on demand from ../mxwar/data/<sid>.js exactly as mxwar/game.js
   loadSeason() does. Nothing of the engine is copied here: a rule or data fix on the phone side reaches Party by itself.
   - The lobby: the series (Supercross / Motocross / SMX Playoffs) and the season year (BGUI.picker with the BIG PREVIEW of the highlighted
     season: its track drawn big, its year and series, its calendar and its top riders), Real / Half length, the War version and the phone
     game's house rules, Fill the gate, the rounds that paid no points, the races without phones, Continue the saved season.
   - The sign-up (the first screen after Start): every phone is a rider: its name (the phone's BGUI.names name), a number free that season
     (the season's real riders keep theirs; two phones never share one; the phone shows the taken numbers) and a team (the makes that
     season raced). The host's computer seats sign up as riders too (their fresh random names, the robot badge). The rest of the field
     is that season's real riders, exactly as the phone game fills it (season.js); the heats are balanced by team by the engine (round.js).
   - The race: the starting gate (War has no first player: race.js firstPlayer is the gate show), the holeshot (the first lap's winner),
     every lap one War flip on every phone at once (queued until the leader starts the lap, as on the phone game; a phone that is late
     at the line is flipped for after a grace), the timing tower (places 1..N, the plate in the team colour, the card each rider turned
     this lap, the cards held, the gap), the war in a SMALL WINDOW IN THE CORNER (3 down + the 4th up), crashes (a lost double war =
     down and remount, a lost triple war = out) and the yellow flag, the red plate on the points leader, the white and checkered flags.
   - After each race: the results (who advances, the points); after each round: the PODIUM (1st, 2nd, 3rd) and the season standings
     (places 1..N, never shared); at the end of the season: the champion's podium and the Victory (H.standings + H.over).
   - The race view is created and driven through ONE adapter (raceView below): the 3D race (mxwar/race3d.js, the phone game's own view, mxlive
     2026-10-18) draws the race on the TV wherever WebGL2 works, at the FIRE TV quality by default (the TV; a device's own Graphics choice in the phone
     game's Menu wins); it rides THE race clock of the time model, which mxwar/track.js keeps in model mode (the 2D track: the clock, the events, and the
     fallback drawing: no WebGL2, Graphics = Classic 2D, a lost GPU, a device too slow for 3D). The phones stay controllers (their YOU card and timing list).
   - An autosave after every lap and every race (localStorage "party-mxwar-live"; Continue in the lobby when the table has the same number
     of riders); a phone that reloads gets its view back (onReconnect); a phone that leaves is ridden by the computer (Auto) and gets it
     back by Take over or the host's invite.
   - mxtime (the CEO, 2026-10-17: "the cards decide REAL lap times"): the TV is the authority. Every battle is one lap with real seconds (mxwar/time.js);
     the track rides the race clock (track.js model mode), the timing tower lists every rider live with the gap in seconds and the last lap, the log says
     what a lap was worth to each phone's rider, and every phone gets the same standings (all riders, gaps, laps down) and its YOU readout in its snapshot
     (phoneSt: race.tw, race.you), computed here from G.tm: a phone never recomputes a lap. */
(function () {
  "use strict";
  var P = window.PartyGames, MX = window.MXWar, IDX = window.MXWarIndex;
  if (!P || !MX || !MX.Season || !MX.Race || !MX.Round || !MX.Art || !IDX) return;
  var S = MX.Season, RC = MX.Race, RD = MX.Round, BR = MX.Brain || null, A = MX.Art;
  var DATA = window.MXWarData = window.MXWarData || {};
  var ID = "mxwar", KEY = "party-mxwar-live", SAVEV = 1;
  var LONG = { sx: "AMA Supercross", mx: "AMA Pro Motocross", smx: "SuperMotocross Playoffs" };
  var SHORTS = { sx: "Supercross", mx: "Motocross", smx: "SMX Playoffs" };
  var DEF_WAR = { version: "three", onlyTied: true, outLoses: false, noDown: false, deucesWild: false, acesWild: false, jokersWild: false, wildAs: "top", form: false, cards: "auto" };
  function BG() { return window.BGUI || null; }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function plural(n, w) { return n + " " + w + (n === 1 ? "" : "s"); }
  function ord(n) { var t = n % 100; return n + ((t >= 11 && t <= 13) ? "th" : (["th", "st", "nd", "rd"][n % 10] || "th")); }
  function listNames(a) { return a.length <= 2 ? a.join(" and ") : a.slice(0, -1).join(", ") + " and " + a[a.length - 1]; }
  function clamp(x, a, b) { return x < a ? a : x > b ? b : x; }
  function remPx() { return parseFloat(getComputedStyle(document.documentElement).fontSize) || 16; }
  function reduced() { var B = BG(), h = document.documentElement; return h.getAttribute("data-motion") === "reduce" || h.getAttribute("data-effects") === "reduced" || !!(B && B.reducedMotion && B.reducedMotion()) || document.hidden; }
  function lsGet(k) { try { return JSON.parse(localStorage.getItem(k) || "null"); } catch (e) { return null; } }
  function lsSet(k, v) { try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, JSON.stringify(v)); } catch (e) { } }
  function setFocus(el) { var B = BG(); if (!el) return; if (B && B.focus && B.focus.enabled && B.focus.set) B.focus.set(el); else try { el.focus({ preventScroll: true }); } catch (e) { } }
  function warWordP(n) { return n === 2 ? "Double war" : n === 3 ? "Triple war" : "War x" + n; }
  var RNAME = { 11: "Jack", 12: "Queen", 13: "King", 14: "Ace", 15: "Joker" };
  function rankPlural(r) { return r === 15 ? "Jokers" : r === 6 ? "6s" : RNAME[r] ? RNAME[r] + "s" : r + "s"; }
  function fmtDate(s) { try { var d = new Date(s + "T12:00:00"); if (isNaN(d)) return s || ""; return d.toLocaleDateString([], { month: "short", day: "numeric" }); } catch (e) { return s || ""; } }

  /* ---------- the game's look: icons, stage motifs and music (the same as mxwar/game.js registers on its own page) ---------- */
  var GLYPHS = {
    helmet: '<path d="M4 14a8 8 0 0 1 16-1.5V15h-6.5L12 18H6.5A2.5 2.5 0 0 1 4 15.5z"/><path d="M13.5 12.5H20"/><path d="M8 8.5l3 1"/>',
    wheel: '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="2.2"/><path d="M12 4v5.8M12 14.2V20M4 12h5.8M14.2 12H20"/>',
    checkflag: '<path d="M5 21V4"/><path d="M5 4h13l-2.5 4L18 12H5"/><path d="M9 4v8M13 4v8M5 8h11"/>'
  };
  (function register() {
    var B = BG(); if (!B) return;
    try {
      if (B.icon && B.icon.add) { Object.keys(GLYPHS).forEach(function (k) { if (!B.icon.has || !B.icon.has(k)) B.icon.add(k, GLYPHS[k]); }); if (B.icon.seal && B.icon.seal.set) B.icon.seal.set(ID, "helmet"); }
      if (B.stage && B.stage.register) B.stage.register(ID, { motifs: ["helmet", "wheel", "checkflag", "cards"] });
    } catch (e) { }
  })();
  if (window.Sound && Sound.addStyle && !(Sound.hasStyle && Sound.hasStyle(ID))) {
    try {
      Sound.addStyle(ID, { scales: ["mixo", "minor", "dorian"], bpm: [132, 156], swing: 0, sev: true, leadVol: 0.08, waves: ["sawtooth", "square", "square"], bassKind: "pulse",
        progs: [[0, 6, 3, 4], [0, 3, 4, 4], [0, 5, 6, 4], [0, 4, 6, 5], [0, 3, 6, 4], [0, 6, 4, 3], [0, 4, 3, 0], [0, 5, 3, 4]],
        bridge: [[3, 4, 5, 5], [6, 5, 4, 4], [3, 6, 4, 4], [5, 4, 3, 4]],
        rhythms: [[1, 1, 0, 1, 1, 0, 1, 1], [1, 0, 1, 1, 0, 1, 1, 0], [1, 1, 1, 0, 1, 1, 0, 1], [1, 0, 1, 0, 1, 1, 1, 1]],
        chordSteps: [0, 4, 7],
        drums: [{ kick: [1, 0, 0, 1, 1, 0, 0, 0], snare: [0, 0, 1, 0, 0, 0, 1, 0], sv: 0.09, hat: [1, 1, 1, 1, 1, 1, 1, 1], hv: 0.035 }, { kick: [1, 0, 1, 0, 1, 0, 1, 0], snare: [0, 0, 1, 0, 0, 1, 1, 0], sv: 0.08, hat: [1, 0, 1, 0, 1, 0, 1, 0], hv: 0.04 }, { kick: [1, 1, 0, 0, 1, 0, 1, 0], snare: [0, 0, 1, 1, 0, 0, 1, 1], sv: 0.07, hat: [0, 1, 0, 1, 0, 1, 0, 1], hv: 0.04 }],
        titles: ["Gate Drop", "Holeshot Highway", "Whoop Section", "Last Chance Qualifier", "Main Event Lights", "Berm Burner", "Thirty Seconds to Gate", "Checkered at Midnight", "Two-Stroke Thunder", "Podium Spray"] },
        { wave: "sawtooth", reg: -1 });
    } catch (e) { }
  }

  /* ---------- the season files: one per year, on demand (the same path rule as mxwar/game.js loadSeason, from firestick/) ---------- */
  var loading = {};
  function loadSeason(id) {
    if (DATA[id]) return Promise.resolve(DATA[id]);
    if (loading[id]) return loading[id];
    loading[id] = new Promise(function (res, rej) {
      var s = document.createElement("script"); s.src = "../mxwar/data/" + id + ".js"; s.async = true;
      s.onload = function () { if (DATA[id]) res(DATA[id]); else { delete loading[id]; rej(new Error("no data")); } };
      s.onerror = function () { delete loading[id]; s.remove(); rej(new Error("could not load the " + id + " season")); };
      document.head.appendChild(s);
    });
    return loading[id];
  }
  function seasonsOf(series) { return IDX.seasons.filter(function (s) { return s.series === series; }).sort(function (a, b) { return b.year - a.year; }); }
  function seasonInfo(id) { return IDX.seasons.filter(function (s) { return s.id === id; })[0] || null; }
  function progWords(F) {
    if (!F) return "";
    var parts = [];
    if (F.direct) parts.push("the top " + F.direct + " seeds straight to the motos");
    F.qual.forEach(function (s) {
      var t = (s.races > 1 ? s.races + " " + s.label.toLowerCase() + (/s$/.test(s.label) ? "" : "s") + " of " + s.size : (s.label === "LCQ" ? "an LCQ of " + s.size : "a " + s.label.toLowerCase() + " of " + s.size));
      if (s.toMain) t += ", the top " + s.toMain + (s.races > 1 ? " of each" : "") + " to the " + (F.finals.kind === "moto" ? "motos" : F.finals.label);
      parts.push(t);
    });
    var f = F.finals;
    parts.push(f.kind === "moto" ? (f.races > 1 ? f.races + " motos with a " + f.size + "-rider gate" : "one moto with a " + f.size + "-rider gate") : (f.races > 1 ? f.races + " " + f.label.toLowerCase() + "s of " + f.size : "a " + f.size + "-rider " + f.label));
    return parts.join("; ");
  }
  function pointsWords(F) { if (!F || !F.table) return ""; var t = F.table, n = t.filter(function (x) { return x > 0; }).length; return "Points " + t.slice(0, 3).join("-") + "... down to the " + ord(n) + (F.pointsOn === "overall" ? " (paid on the night's overall)" : F.finals.kind === "moto" ? " (in every moto)" : "") + "."; }
  /* the makes a season raced (the sign-up's teams): its riders' bikes, most riders first; the modern makes when the data has none */
  function makesOf(D) {
    var cnt = {}, out = [];
    ((D && D.riders) || []).forEach(function (r) { var b = r.bike; if (!b || b === "Privateer") return; cnt[b] = (cnt[b] || 0) + 1; });
    Object.keys(cnt).sort(function (a, b) { return cnt[b] - cnt[a] || (a < b ? -1 : 1); }).forEach(function (b) { out.push(b); });
    return out.length ? out : A.MODERN.slice();
  }

  /* ---------- the CSS (scoped by html[data-pgame="mxwar"]) ---------- */
  var Q = 'html[data-pgame="mxwar"] ';
  var CSS = [
    /* plates, makes and cards (as mxwar/index.html) */
    Q + ".mx-mk{display:inline-flex;align-items:center;flex:none;padding:.05rem .4rem;border-radius:var(--r-xs);font:var(--fw-caps) var(--fs-micro)/1.25 var(--font-ui);letter-spacing:.02em;color:var(--mk-ink,#fff);background:var(--mk,#3a3a44);box-shadow:inset 0 0 0 1px rgba(255,255,255,.18);white-space:nowrap}",
    Q + ".mx-pl{display:inline-grid;place-items:center;flex:none;min-width:2.6em;padding:.1rem .3rem .1rem .55em;border-radius:var(--r-xs);font:800 var(--fs-micro)/1.1 var(--font-ui);font-variant-numeric:tabular-nums;color:#121216;background:#f4f1e8;box-shadow:inset .3em 0 0 var(--mk,#3a3a44),inset 0 0 0 1px rgba(0,0,0,.4)}",
    Q + ".mx-pl.is-red{color:#fff;background:#c8101c;box-shadow:inset .3em 0 0 var(--mk,#3a3a44),inset 0 0 0 1px rgba(255,255,255,.35),0 0 0 1px rgba(200,16,28,.55)}",
    Q + ".mx-pl.is-gen{font-style:italic}",
    Q + ".mx-card{width:var(--cw);height:calc(var(--cw) * 1.4);perspective:60rem}",
    Q + ".mx-ci{position:relative;width:100%;height:100%;transform-style:preserve-3d}",
    Q + ".mx-cf," + Q + ".mx-cb{position:absolute;inset:0;border-radius:calc(var(--cw) * .1);backface-visibility:hidden;-webkit-backface-visibility:hidden;box-shadow:0 .3rem .8rem rgba(0,0,0,.5)}",
    Q + ".mx-cf{background:linear-gradient(180deg,#fffdf7,#ece2cb);color:#1d1a24;transform:rotateY(0deg)}",
    Q + ".mx-cf.is-red{color:#b3202a}",
    Q + ".mx-card:not(.is-up) .mx-cf{transform:rotateY(180deg)}",
    Q + ".mx-card:not(.is-up) .mx-cb{transform:rotateY(0deg)}",
    Q + ".mx-card.is-up .mx-cb{transform:rotateY(-180deg)}",
    Q + ".mx-cb{background:repeating-conic-gradient(#1d1b22 0 25%,#34313b 0 50%) 0 0/calc(var(--cw) * .22) calc(var(--cw) * .22);box-shadow:inset 0 0 0 calc(var(--cw) * .05) #2a2730,inset 0 0 0 calc(var(--cw) * .065) #c99f5e,0 .3rem .8rem rgba(0,0,0,.5)}",
    Q + ".mx-ck{position:absolute;left:calc(var(--cw) * .07);top:calc(var(--cw) * .05);display:grid;justify-items:center;line-height:1}",
    Q + ".mx-ck.is-b{left:auto;top:auto;right:calc(var(--cw) * .07);bottom:calc(var(--cw) * .05);transform:rotate(180deg)}",
    Q + ".mx-ck b{font:800 max(var(--fs-micro), calc(var(--cw) * .26))/1 var(--font-ui);letter-spacing:-.02em}",
    Q + ".mx-ck svg{width:max(.7rem, calc(var(--cw) * .17));height:max(.7rem, calc(var(--cw) * .17))}",
    Q + ".mx-cs{position:absolute;left:50%;top:50%;width:calc(var(--cw) * .48);height:calc(var(--cw) * .48);transform:translate(-50%,-50%)}",
    Q + ".mx-cf.is-jk .mx-cs{color:#c99f5e}",
    Q + ".mx-card.is-win .mx-cf{box-shadow:0 0 0 3px #f0d48a,0 0 0 5px #0b0a12,0 .5rem 1.2rem rgba(0,0,0,.6)}",
    Q + ".mx-card.is-empty .mx-cb," + Q + ".mx-card.is-empty .mx-cf{background:rgba(0,0,0,.25);box-shadow:inset 0 0 0 2px rgba(231,202,144,.28)}",
    Q + ".mx-card.is-empty .mx-cf > *{display:none}",
    Q + ".mx-tw__c{justify-self:center;display:inline-flex;align-items:center;gap:.1rem;min-width:2.2rem;justify-content:center;padding:.12rem .25rem;border-radius:.3rem;font:800 var(--fs-micro)/1 var(--font-ui);color:#1d1a24;background:#f3ead6}",
    Q + ".mx-tw__c.is-red{color:#b3202a}",
    Q + ".mx-tw__c:empty{visibility:hidden}",
    Q + ".mx-tw__c svg{width:.75em;height:.75em}",
    /* the lobby: the season row (its picture, the year big), the series and length segments, the preview in the picker */
    Q + ".mxp-seg{display:grid;grid-template-columns:repeat(3,minmax(0,1fr))}",
    Q + ".mxp-seg--2{grid-template-columns:repeat(2,minmax(0,1fr))}",
    Q + ".mxp-year{display:grid;grid-template-columns:auto minmax(0,1fr) auto;align-items:center;gap:1rem;width:100%;margin-top:1.5rem;text-align:left}",
    Q + ".mxp-ythumb{position:relative;display:block;width:9rem;height:5.4rem;border-radius:var(--r-md);overflow:hidden;background:#140f0c;box-shadow:inset 0 0 0 1px rgba(231,202,144,.35)}",
    Q + ".mxp-ythumb svg{position:absolute;inset:0;width:100%;height:100%}",
    Q + ".mxp-ythumb b{position:absolute;left:.4rem;bottom:.25rem;font:400 var(--fs-2xl)/1 var(--font-display);color:var(--gold-100);text-shadow:0 1px 3px #000}",
    Q + ".mxp-chev{display:inline-flex;width:1.4rem;height:1.4rem;color:var(--gold-200)}",
    Q + ".mxp-lseg{margin-top:1.5rem}",
    ".mx-pv{position:relative;display:grid;grid-template-rows:auto minmax(0,1fr);width:100%;height:100%;overflow:hidden;border-radius:var(--r-md);color:var(--text-1);background:linear-gradient(180deg,#1a1620,#100d14);font-size:var(--pv-fs,12px)}",
    ".mx-pv__band{position:relative;display:flex;align-items:flex-end;gap:.6em;min-height:5.2em;padding:.5em .8em .45em;overflow:hidden}",
    ".mx-pv__art{position:absolute;inset:0;z-index:0}",
    ".mx-pv__art svg{display:block;width:100%;height:100%}",
    ".mx-pv__band::after{content:'';position:absolute;inset:0;z-index:1;background:linear-gradient(180deg,rgba(16,13,20,0) 25%,rgba(16,13,20,.92))}",
    ".mx-pv__y{position:relative;z-index:2;font:400 2.6em/1 var(--font-display);color:var(--gold-100)}",
    ".mx-pv__h{position:relative;z-index:2;display:grid;gap:.15em;min-width:0;padding-bottom:.2em}",
    ".mx-pv__s{font:var(--fw-ui-strong) 1.08em/1.2 var(--font-ui);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}",
    ".mx-pv__c{font:var(--fw-ui) 1em/1.2 var(--font-ui);color:var(--text-2);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}",
    ".mx-pv__body{display:grid;grid-template-columns:minmax(0,1.15fr) minmax(0,1fr);gap:.4em .9em;min-height:0;padding:.45em .8em .6em;overflow:hidden}",
    ".mx-pv__lab{font:var(--fw-caps) 1em/1.2 var(--font-ui);letter-spacing:.06em;text-transform:uppercase;color:var(--gold-200)}",
    ".mx-pv__col{display:flex;flex-direction:column;gap:.25em;min-width:0;min-height:0;overflow:hidden}",
    ".mx-pv__cities{display:flex;flex-wrap:wrap;align-content:flex-start;gap:.25em .3em;min-height:0;overflow:hidden}",
    ".mx-pv__city{padding:.08em .4em;border-radius:var(--r-pill);font:var(--fw-ui) 1em/1.3 var(--font-ui);color:var(--text-1);background:rgba(255,255,255,.07);white-space:nowrap}",
    ".mx-pv__city b{color:var(--gold-100);font-weight:800}",
    ".mx-pv__more{font:var(--fw-ui-strong) 1em/1.3 var(--font-ui);color:var(--text-2);white-space:nowrap}",
    ".mx-pv__riders{display:grid;gap:.22em;margin:0;padding:0;list-style:none;min-height:0;overflow:hidden}",
    ".mx-pv__riders li{display:flex;align-items:center;gap:.4em;min-width:0;font:var(--fw-ui-strong) 1em/1.25 var(--font-ui);white-space:nowrap}",
    ".mx-pv__riders .mx-pl{font-size:1em;min-width:2.3em}",
    ".mx-pv__riders .mx-mk{font-size:.95em}",
    ".mx-pv__nm{min-width:0;overflow:hidden;text-overflow:ellipsis}",
    ".mx-pv__rk{flex:none;min-width:1.1em;color:var(--text-2)}",
    ".mx-pv__load{grid-column:1 / -1;align-self:center;justify-self:center;font:var(--fw-ui) 1.05em/1.3 var(--font-ui);color:var(--text-2)}",
    ".mx-pv.is-narrow .mx-pv__riders .mx-mk{display:none}",
    ".mx-pv.is-narrow .mx-pv__body{grid-template-columns:minmax(0,1fr) minmax(0,1.2fr)}",
    /* the game screen: the race (left) and the timing tower (right) */
    Q + ".mxp{position:relative;display:grid;grid-template-columns:minmax(0,1fr) var(--tw,19.5rem);column-gap:1rem;width:100%;height:calc(100vh - 10.75rem);min-height:0}",
    Q + ".mxp.is-over{height:calc(100vh - 15.5rem)}",
    Q + ".mxp-main{position:relative;min-width:0;min-height:0;border-radius:1.1rem;overflow:hidden;background:#140f0c;box-shadow:inset 0 0 0 2px rgba(231,202,144,.45),0 .75rem 2rem rgba(0,0,0,.5)}",
    Q + ".mxp-lane{position:absolute;inset:0;overflow:hidden}",
    Q + ".mxp-lane canvas{position:absolute;left:0;top:0;display:block}",
    /* the 3D race (raceView): its picture over the lane (the 2D track keeps the clock under it); the corner window moves to the top right (the hero camera keeps the
       person's rider low in the right third), the 2D gate rests; a war flashes across the top (08_WAR_EVENT_FLASH) */
    Q + ".mxp-v3{position:absolute;inset:0;z-index:2;display:none;overflow:hidden;pointer-events:none;background:#05060a}",
    Q + ".mxp-v3 canvas{display:block}",
    Q + ".mxp.is-3d .mxp-v3{display:block}",
    Q + ".mxp.is-3d .mxp-lane{visibility:hidden}",
    Q + ".mxp.is-3d .mxp-gate," + Q + ".mxp.is-3d .mxp-dust{display:none !important}",
    Q + ".mxp.is-3d .mxp-pip{right:auto;left:1rem;bottom:1rem;top:auto}",   /* (the hero chase keeps the person's rider at about 71% across, 64% down: the window takes the bottom-left corner, the 2D gate rests) */
    /* the 3D race getting ready (raceView holding(): its world in short tasks, then its shaders while nothing draws; the gate and the clock wait): a quiet card over the picture,
       its light bar moved by the compositor (it keeps moving while the TV builds) */
    Q + ".mxp-v3hold{display:none}",
    Q + ".mxp-main.is-3dhold .mxp-v3hold{display:flex;position:absolute;inset:0;z-index:4;align-items:flex-end;justify-content:center;padding:0 1rem 10%;pointer-events:none;background:radial-gradient(120% 70% at 50% 108%,rgba(123,74,43,.55),rgba(9,12,18,0) 62%),radial-gradient(80% 50% at 50% -10%,rgba(236,185,103,.16),rgba(9,12,18,0) 70%),#090c12}",
    Q + ".mxp-v3hold__card{display:flex;flex-direction:column;align-items:center;gap:.6rem;min-width:22rem;padding:.8rem 1.4rem .9rem;border-radius:1rem;background:rgba(13,17,27,.86);box-shadow:inset 0 0 0 1px rgba(236,185,103,.38)}",
    Q + ".mxp-v3hold__t{color:#ecb967;font-weight:700;font-size:1.05rem;letter-spacing:.14em;text-transform:uppercase;text-align:center}",
    Q + ".mxp-v3hold__bar{position:relative;width:100%;height:3px;border-radius:2px;overflow:hidden;background:rgba(240,241,243,.12)}",
    Q + ".mxp-v3hold__bar::after{content:'';position:absolute;top:0;bottom:0;left:0;width:38%;border-radius:2px;background:linear-gradient(90deg,rgba(247,45,46,0),#f72d2e 45%,#ecb967);animation:mxpHoldSweep 1.6s cubic-bezier(.45,.05,.35,1) infinite;will-change:transform}",
    "@keyframes mxpHoldSweep{from{transform:translateX(-100%)}to{transform:translateX(265%)}}",
    "@media (prefers-reduced-motion: reduce){" + Q + ".mxp-v3hold__bar::after{animation:none;width:100%;opacity:.6}}",
    Q + ".mxp-banner.is-war{background:linear-gradient(180deg,rgba(24,22,28,.97),rgba(12,11,15,.97));box-shadow:inset 0 0 0 2px #f72d2e,0 .8rem 2rem rgba(0,0,0,.6)}",
    Q + ".mxp-banner.is-war b{color:#f72d2e}",
    Q + ".mxp-banner.is-war span{color:#ecb967;letter-spacing:.04em;text-transform:uppercase}",
    Q + ".mxp-gate{position:absolute;z-index:3;pointer-events:none;transform-origin:50% 100%}",
    Q + ".mxp-gate svg{display:block;width:100%;height:100%}",
    Q + ".mxp-dust{position:absolute;z-index:3;pointer-events:none;opacity:0;background:radial-gradient(50% 50% at 30% 60%,rgba(214,180,140,.55),rgba(214,180,140,0))}",
    Q + ".mxp-chips{position:absolute;left:.75rem;top:.6rem;right:.75rem;z-index:4;display:flex;flex-wrap:wrap;gap:.4rem;pointer-events:none}",
    Q + ".mxp-chip{display:inline-flex;align-items:center;gap:.35rem;padding:.25rem .7rem;border-radius:var(--r-pill);background:rgba(10,8,14,.82);box-shadow:inset 0 0 0 1px rgba(231,202,144,.35);font:var(--fw-ui-strong) var(--fs-micro)/1.25 var(--font-ui);color:var(--text-1);white-space:nowrap}",
    Q + ".mxp-chip:empty{display:none}",
    Q + ".mxp-chip .mx-flag{width:1.6rem;height:1.1rem}",

    Q + ".mxp-chip.is-yellow{background:#ffd21f;color:#1a1408;box-shadow:inset 0 0 0 1px #6b5200}",
    Q + ".mxp-chip.is-hot{color:var(--gold-100)}",
    Q + ".mxp-chip.is-hot.is-white," + Q + ".mxp-chip.is-white{background:#f4f1e8;color:#121216}",
    Q + ".mxp-banner{position:absolute;left:50%;top:3.4rem;z-index:8;display:grid;justify-items:center;gap:.3rem;width:max-content;max-width:80%;padding:.6rem 1.4rem .75rem;transform:translate(-50%,0);border-radius:var(--r-lg);background:linear-gradient(180deg,rgba(60,14,10,.95),rgba(22,6,6,.95));box-shadow:inset 0 0 0 1.5px var(--gold-200),0 .8rem 2rem rgba(0,0,0,.6);text-align:center;pointer-events:none;opacity:0;visibility:hidden}",
    Q + ".mxp-banner.is-on{opacity:1;visibility:visible}",
    Q + ".mxp-banner b{font:400 var(--fs-3xl)/1.05 var(--font-display);color:var(--gold-100)}",
    Q + ".mxp-banner span{font:var(--fw-ui-strong) var(--fs-md)/1.3 var(--font-ui);color:#f6e9cf}",
    Q + ".mxp-banner .mx-flag{display:block;width:3.4rem;height:2.3rem;margin:0 auto .15rem}",
    Q + ".mxp-banner.is-calm{background:linear-gradient(180deg,rgba(24,20,36,.96),rgba(10,9,18,.96))}",
    Q + ".mxp-banner.is-yellow{background:linear-gradient(180deg,rgba(84,66,6,.97),rgba(36,28,2,.97));box-shadow:inset 0 0 0 1.5px #ffd21f,0 .8rem 2rem rgba(0,0,0,.6)}",
    Q + ".mxp-banner.is-yellow b{color:#ffe58a}",
    Q + ".mxp-banner.is-flag{background:linear-gradient(180deg,rgba(30,30,36,.97),rgba(8,8,12,.97))}",
    /* the corner window (the CEO: "wars will be in a tiny box window ... Put it in a corner") */
    Q + ".mxp-pip{position:absolute;right:1rem;bottom:1rem;width:var(--pip-w,15rem);height:var(--pip-h,9.4rem);z-index:5;border-radius:var(--r-lg);background:linear-gradient(180deg,rgba(16,13,20,.92),rgba(8,7,11,.95));box-shadow:inset 0 0 0 1.5px rgba(231,202,144,.5),0 .5rem 1.4rem rgba(0,0,0,.55)}",
    Q + ".mxp-duel{position:absolute;inset:.45rem .6rem;display:grid;grid-template-columns:auto auto minmax(0,1fr);align-items:center;gap:.6rem}",
    Q + ".mxp-duel[hidden]{display:none}",
    Q + ".mxp-lapbig{display:grid;justify-items:center;gap:.1rem;min-width:3.4rem}",
    Q + ".mxp-lapbig b{font:400 var(--fs-2xl)/1 var(--font-display);color:var(--gold-100);white-space:nowrap}",
    Q + ".mxp-lapbig span{font:var(--fw-ui) var(--fs-micro)/1.2 var(--font-ui);color:var(--text-2);white-space:nowrap}",
    Q + ".mxp-dwho{display:grid;gap:.25rem;min-width:0}",
    Q + ".mxp-dwho > span{display:flex;align-items:center;gap:.3rem;min-width:0;font:var(--fw-ui-strong) var(--fs-micro)/1.2 var(--font-ui);color:var(--text-1);white-space:nowrap;overflow:hidden}",
    Q + ".mxp-dwho em{font:var(--fw-caps) var(--fs-micro)/1.2 var(--font-ui);font-style:normal;letter-spacing:.04em;text-transform:uppercase;color:var(--gold-200)}",
    Q + ".mxp-sn{min-width:0;overflow:hidden;text-overflow:ellipsis}",
    Q + ".mxp-war{position:absolute;inset:.4rem .5rem 2.2rem;display:flex;justify-content:center;align-items:stretch;gap:.45rem}",
    Q + ".mxp-war:empty{display:none}",
    Q + ".mxp-fight{position:relative;flex:1 1 0;max-width:7rem;min-width:0;display:grid;grid-template-rows:auto minmax(0,1fr);justify-items:center;gap:.15rem;text-align:center}",
    Q + ".mxp-fight__who{display:flex;align-items:center;gap:.2rem;max-width:100%;overflow:hidden;font:var(--fw-ui-strong) var(--fs-micro)/1.2 var(--font-ui);color:var(--text-1);white-space:nowrap}",
    Q + ".mxp-fight__pile{position:relative;width:var(--cw);height:calc(var(--cw) * 1.4);margin-left:calc(var(--cw) * .3)}",
    Q + ".mxp-fight__pile .mx-card{position:absolute;left:0;top:0}",
    Q + ".mxp-fight.is-win .mxp-fight__who{color:var(--gold-100)}",
    Q + ".mxp-fight.is-win .mx-card.is-top .mx-cf{box-shadow:0 0 0 3px #f0d48a,0 0 0 5px #0b0a12}",
    Q + ".mxp-fight.is-lose{opacity:.6}",
    Q + ".mxp-more{align-self:center;font:var(--fw-ui-strong) var(--fs-micro)/1.3 var(--font-ui);color:var(--text-2);white-space:nowrap}",
    Q + ".mxp-note{position:absolute;left:50%;bottom:.35rem;z-index:2;display:none;max-width:94%;padding:.12rem .6rem;transform:translateX(-50%);border-radius:var(--r-pill);background:#2a1d12;box-shadow:inset 0 0 0 1px rgba(231,202,144,.5);font:var(--fw-ui-strong) var(--fs-micro)/1.25 var(--font-ui);color:var(--text-1);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}",
    Q + ".mxp-note.is-on{display:block}",
    Q + ".mxp-note b{color:var(--gold-100)}",
    Q + ".mxp-note.is-hot{background:#5a0f12;box-shadow:inset 0 0 0 1px #ff9d8a}",
    Q + ".mxp-flash{position:absolute;inset:0;z-index:6;pointer-events:none;opacity:0;background:radial-gradient(60% 60% at 70% 80%,rgba(255,157,138,.35),rgba(255,157,138,0))}",
    /* the timing tower */
    Q + ".mxp-side{display:flex;flex-direction:column;gap:.55rem;min-width:0;min-height:0}",
    Q + ".mxp-head{display:flex;align-items:center;gap:.6rem;min-width:0}",
    Q + ".mxp-head > div{flex:1 1 auto;min-width:0}",
    Q + ".mxp-head b{display:block;font:var(--fw-ui-strong) var(--fs-md)/1.2 var(--font-ui);color:var(--text-1);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}",
    Q + ".mxp-head span{display:block;font:var(--fw-ui) var(--fs-micro)/1.25 var(--font-ui);color:var(--text-2);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}",
    Q + ".mxp-skip{flex:none;min-height:3rem !important;padding:0 .9rem !important;font-size:var(--fs-micro) !important}",
    Q + ".mxp-tower{list-style:none;margin:0;padding:.4rem;display:grid;grid-auto-flow:column;grid-template-rows:repeat(var(--rows,20),var(--rh,1.6rem));grid-template-columns:repeat(var(--cols,1),minmax(0,1fr));gap:.15rem .5rem;align-content:start;flex:1 1 auto;min-height:0;overflow:hidden;border-radius:var(--r-md);background:var(--ink-2);box-shadow:var(--well-edge)}",
    Q + ".mxp-tower li{position:relative;display:grid;grid-template-columns:1.5rem auto minmax(0,1fr) 2.3rem 4.2rem 4.4rem;align-items:center;gap:.3rem;height:var(--rh,1.6rem);box-sizing:border-box;padding:0 .35rem 0 .25rem;border-radius:.45rem;background:var(--ink-3);overflow:hidden;font:var(--fw-ui-strong) var(--fs-micro)/1 var(--font-ui);color:var(--text-1)}",
    Q + ".mxp-tower li.is-me{box-shadow:inset .3rem 0 0 var(--seat,#e7ca90)}",
    Q + ".mxp-tower li.is-need{box-shadow:inset .3rem 0 0 var(--seat,#e7ca90),inset 0 0 0 2px var(--seat,#e7ca90)}",
    Q + ".mxp-tower li.is-win{background:#3a2c10}",
    Q + ".mxp-tower li.is-fight{background:#4a1418}",
    Q + ".mxp-tower li.is-out{opacity:.55}",
    Q + ".mxp-tower li.is-down{background:#4a1f14;box-shadow:inset 0 0 0 2px #e8775a}",
    Q + ".mxp-tower li.is-down .mxp-tg{color:#ffb4a3;font-weight:800;letter-spacing:.04em}",
    Q + ".mxp-tower li.is-fl .mxp-tl{color:#d9b3ff;font-weight:800}",
    Q + ".mxp-tower.is-cols2 li{grid-template-columns:1.5rem auto minmax(0,1fr) 4.1rem 4.3rem;gap:.25rem}",
    Q + ".mxp-tower.is-cols2 .mx-tw__c{display:none}",
    Q + ".mxp-rt{flex:none;margin-left:auto;padding-left:.5rem;font:var(--fw-ui) var(--fs-micro)/1.2 var(--font-ui);color:var(--text-2);font-variant-numeric:tabular-nums;white-space:nowrap}",
    Q + ".mxp-tl{text-align:right;white-space:nowrap;color:var(--text-2);font-variant-numeric:tabular-nums}",
    Q + ".mxp-tower li.is-sep{background:none;height:.2rem}",
    Q + ".mxp-tp{font:400 var(--fs-md)/1 var(--font-display);color:var(--gold-100);text-align:center;font-variant-numeric:tabular-nums}",
    Q + ".mxp-tn{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}",
    Q + ".mxp-tn .bg-ico{width:.9em;height:.9em;margin-left:.25rem;vertical-align:-.1em;color:var(--text-2)}",
    Q + ".mxp-tk{text-align:right;color:var(--gold-100);font-variant-numeric:tabular-nums}",
    Q + ".mxp-tg{text-align:right;color:var(--text-1);font-variant-numeric:tabular-nums;white-space:nowrap}",
    Q + ".mxp-log{list-style:none;margin:0;padding:.5rem .75rem;display:grid;gap:.25rem;border-radius:var(--r-md);background:var(--ink-2);box-shadow:var(--well-edge);font:var(--fw-body) var(--fs-micro)/1.3 var(--font-ui);color:var(--text-2)}",
    Q + ".mxp-log li{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}",
    Q + ".mxp-log li:last-child{color:var(--text-1)}",
    Q + ".mxp-log:empty{display:none}",
    Q + ".mxp.is-many .mxp-log{display:none}",
    /* the panels over the screen: sign-up, results, podium, standings */
    Q + ".mxp-panel{position:absolute;inset:0;z-index:20;display:flex;flex-direction:column;gap:.6rem;padding:1.1rem 1.5rem 1.2rem;border-radius:1.1rem;background:linear-gradient(180deg,rgba(22,18,32,.98),rgba(10,9,16,.99));box-shadow:inset 0 0 0 1.5px var(--gold-200),0 1rem 2.5rem rgba(0,0,0,.6)}",
    Q + ".mxp-panel[hidden]{display:none}",
    Q + ".mxp.is-panel > .mxp-main," + Q + ".mxp.is-panel > .mxp-side{visibility:hidden}",   /* a panel stands alone: nothing behind it shows through or takes the focus */
    Q + ".mxp-ph{display:flex;align-items:flex-end;justify-content:space-between;gap:1rem;flex-wrap:wrap}",
    Q + ".mxp-ph h2{margin:.1rem 0 0;font:400 var(--fs-2xl)/1.1 var(--font-display);color:var(--text-1)}",
    Q + ".mxp-ph p{margin:.2rem 0 0;font:var(--fw-ui) var(--fs-sm)/1.35 var(--font-ui);color:var(--text-2)}",
    Q + ".mxp-ph p .mxp-winline{color:var(--gold-100);font-weight:var(--fw-ui-strong)}",   /* mxfix1: a table player's win or podium, said like one */
    Q + ".mxp-sum{display:flex;flex-wrap:wrap;gap:.4rem}",
    Q + ".mxp-pbody{position:relative;flex:1 1 auto;min-height:0;overflow:hidden}",
    Q + ".mxp-acts{display:flex;flex-wrap:wrap;gap:1.5rem;padding:.5rem .25rem .25rem}",
    Q + ".mxp-acts .bg-btn small{display:block;font:var(--fw-ui) var(--fs-micro)/1.2 var(--font-ui);opacity:.9}",
    Q + ".mxp-res{list-style:none;margin:0;padding:0;display:grid;grid-auto-flow:column;grid-template-rows:repeat(var(--rows,10),var(--rh,1.7rem));grid-template-columns:repeat(var(--cols,1),minmax(0,1fr));gap:.2rem 1.25rem;align-content:start}",
    Q + ".mxp-res li{display:flex;align-items:center;gap:.45rem;height:var(--rh,1.7rem);min-width:0;padding:0 .5rem 0 .3rem;border-radius:.45rem;background:var(--ink-3);overflow:hidden;font:var(--fw-ui-strong) var(--fs-micro)/1 var(--font-ui);color:var(--text-1);white-space:nowrap}",
    Q + ".mxp-res li.is-me{box-shadow:inset .3rem 0 0 var(--seat,#e7ca90);background:#262038}",
    Q + ".mxp-res li.is-sep{background:none;justify-content:center;color:var(--text-2)}",
    Q + ".mxp-rp{flex:none;min-width:1.6rem;font:400 var(--fs-md)/1 var(--font-display);color:var(--gold-100);text-align:center}",
    Q + ".mxp-rn{flex:1 1 auto;min-width:0;overflow:hidden;text-overflow:ellipsis}",
    Q + ".mxp-rx{flex:none;color:var(--gold-100);font-variant-numeric:tabular-nums}",
    Q + ".mxp-tag{flex:none;padding:.12rem .45rem;border-radius:var(--r-pill);font:var(--fw-caps) var(--fs-micro)/1.1 var(--font-ui);letter-spacing:.03em;color:#14110a;background:#e7ca90}",
    Q + ".mxp-tag--next{background:#9fd3ff}",
    Q + ".mxp-tag--out{background:#8b93a8}",
    Q + ".mxp-tag--dnf{background:#ff9d8a}",
    Q + ".mxp-tag--cr{background:#ffd21f}",
    Q + ".mxp-tag--pts{background:#9fe0a8}",
    Q + ".mxp-pod{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));align-items:end;gap:1rem;width:min(100%,46rem);margin:0 auto}",
    Q + ".mxp-pod__c{display:grid;justify-items:center;gap:.35rem;min-width:0;text-align:center}",
    Q + ".mxp-pod__bike{width:6rem;height:4rem}",
    Q + ".mxp-pod__bike svg{display:block;width:100%;height:100%}",
    Q + ".mxp-pod__nm{max-width:100%;font:var(--fw-ui-strong) var(--fs-md)/1.15 var(--font-ui);color:var(--text-1);display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:2;overflow:hidden;overflow-wrap:break-word;text-wrap:balance}",   /* mxfix1: a second line, never an ellipsis on a podium name */
    Q + ".mxp-pod__x{font:var(--fw-ui) var(--fs-micro)/1.2 var(--font-ui);color:var(--text-2)}",
    Q + ".mxp-pod__step{display:grid;place-items:center;width:100%;border-radius:var(--r-md) var(--r-md) 0 0;font:400 var(--fs-3xl)/1 var(--font-display);color:#1a1408;box-shadow:inset 0 3px 0 var(--mk,#c99f5e)}",
    Q + ".mxp-pod__c[data-p='1'] .mxp-pod__step{height:7rem;background:linear-gradient(180deg,#fbeec8,#c99f5e)}",
    Q + ".mxp-pod__c[data-p='2'] .mxp-pod__step{height:5rem;background:linear-gradient(180deg,#eef0f4,#9aa0ac)}",
    Q + ".mxp-pod__c[data-p='3'] .mxp-pod__step{height:3.8rem;background:linear-gradient(180deg,#f1c79b,#a8693a)}",
    Q + ".mxp-pod__c.is-me .mxp-pod__nm{color:var(--gold-100)}",
    Q + ".mxp-podwrap{display:grid;grid-template-columns:minmax(0,1.25fr) minmax(0,1fr);gap:1.5rem;align-items:end;height:100%}",
    Q + ".mxp-podwrap .mxp-res{align-self:center}",
    Q + ".mxp-su{display:grid;grid-template-columns:repeat(var(--cols,4),minmax(0,1fr));gap:.6rem 1rem;align-content:start}",
    Q + ".mxp-suc{display:grid;grid-template-columns:auto minmax(0,1fr);grid-template-rows:auto auto;align-items:center;gap:.25rem .6rem;padding:.55rem .7rem;border-radius:var(--r-md);background:var(--ink-3);box-shadow:inset 0 0 0 1px var(--line-1)}",
    Q + ".mxp-suc.is-ready{box-shadow:inset 0 0 0 2px var(--seat,#e7ca90)}",
    Q + ".mxp-tok{grid-row:1 / span 2;display:grid;place-items:center;width:2.6rem;height:2.6rem;border-radius:50%;background:var(--seat,#e7ca90);color:var(--seat-ink,#0b0a12);font:var(--fw-caps) var(--fs-md)/1 var(--font-ui)}",
    Q + ".mxp-suc b{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font:var(--fw-ui-strong) var(--fs-sm)/1.2 var(--font-ui);color:var(--text-1)}",
    Q + ".mxp-suc b .bg-ico{width:.9em;height:.9em;margin-left:.3rem;vertical-align:-.1em;color:var(--text-2)}",
    Q + ".mxp-suc > span:not(.mxp-tok){display:flex;align-items:center;gap:.35rem;min-width:0;font:var(--fw-ui) var(--fs-micro)/1.2 var(--font-ui);color:var(--text-2);white-space:nowrap;overflow:hidden}",
    Q + ".mxp-teams{display:flex;flex-wrap:wrap;gap:.35rem .5rem;margin:.1rem 0 0}",
    Q + ".mxp-cnt{font:var(--fw-ui-strong) var(--fs-micro)/1 var(--font-ui);color:var(--text-1)}",
    /* the heat line-up before the round's first gate (as mxwar/game.js openLineup): a column per heat, its team counts, its riders */
    Q + ".mxp-lu{display:grid;grid-template-columns:repeat(var(--lu-cols,2),minmax(0,1fr));gap:.6rem 1.5rem;height:100%}",
    Q + ".mxp-lu__col{display:flex;flex-direction:column;gap:.35rem;min-width:0;min-height:0}",
    Q + ".mxp-lu__h{margin:0;font:var(--fw-ui-strong) var(--fs-md)/1.2 var(--font-ui);color:var(--gold-100);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}",
    Q + ".mxp-lu__h span{font:var(--fw-ui) var(--fs-micro)/1.2 var(--font-ui);color:var(--text-2)}",
    Q + ".mxp-lu__tm{display:flex;flex-wrap:wrap;gap:.3rem .4rem;margin:0}",
    Q + ".mxp-lu__col .mxp-res{flex:1 1 auto;min-height:0;overflow:hidden}",
    Q + ".mxp-lu__col .mxp-res .mx-mk{margin-left:auto}",
    /* the announcers (mxwar/booth.js, ui/voice.js): a caption band under the race (and under the panels), three lines of captions high; the tower keeps its whole
       height (it spans both rows), the race and the panels sit above the band, so a caption never covers the cards window, the tower, the buttons or a rider. Off: no band. */
    Q + ".mxp-cap{display:none;grid-column:1;grid-row:2;position:relative;align-items:center;margin-top:.6rem;height:var(--cap-h,4.9rem);overflow:hidden;border-radius:.9rem;background:linear-gradient(180deg,rgba(26,18,11,.97),rgba(14,10,7,.99));box-shadow:inset 0 0 0 1px rgba(231,202,144,.3)}",
    Q + ".mxp.has-cap{grid-template-rows:minmax(0,1fr) auto}",
    Q + ".mxp.has-cap > .mxp-main{grid-row:1}",
    Q + ".mxp.has-cap > .mxp-side{grid-row:1 / span 2}",
    Q + ".mxp.has-cap > .mxp-cap{display:flex}",
    Q + ".mxp.has-cap > .mxp-panel{bottom:calc(var(--cap-h,4.9rem) + .6rem)}",
    Q + ".mxp.has-cap.is-panel > .mxp-panel{right:0}",
    Q + ".mxp-cap .bgv-cap{--bgv-left:.8rem; --bgv-right:.8rem; position:relative; left:auto; bottom:auto; flex-direction:row; align-items:baseline; gap:.6rem; margin:0 .8rem; max-width:calc(100% - 1.6rem); max-height:calc(var(--cap-h,4.9rem) - .5rem); padding:.25rem .9rem .3rem .8rem}",
    Q + ".mxp-cap .bgv-cap__text{font-size:var(--fs-sm);line-height:1.25;-webkit-line-clamp:3}",
    Q + ".mxp-cap .bgv-cap__who{font-size:var(--fs-micro)}",
    Q + ".mxp-capidle{position:absolute;left:.8rem;right:.8rem;top:0;bottom:0;display:flex;align-items:center;justify-content:center;pointer-events:none;font:var(--fw-ui) var(--fs-micro)/1.2 var(--font-ui);letter-spacing:.06em;text-transform:uppercase;color:var(--text-3);opacity:.75;transition:opacity 180ms ease-out}",
    Q + ".mxp-cap .bgv-cap.is-on ~ .mxp-capidle{opacity:0}",
    /* toasts stay over the tower's foot, clear of the race and the corner window */
    'html[data-pgame="mxwar"][data-tv] body.ps-ingame .bg-toast{left:calc(98vw - 10.5rem);max-width:20rem}',
    /* reduced effects: nothing moves */
    'html[data-effects="reduced"] ' + Q + ".mxp *{animation:none !important;transition:none !important}"
  ].join("\n");
  (function addCSS() { if (document.getElementById("mxp-css")) return; var st = document.createElement("style"); st.id = "mxp-css"; st.textContent = CSS; document.head.appendChild(st); })();

  /* ================= the lobby =================
     cfg = {version, over: {the War rows + fill, nonTitle, others}, keep: {fill, nonTitle, others} (kept across a Version change, which
     clears cfg.over), series, sid, length, resume} */
  var KEEPK = ["fill", "nonTitle", "others"];
  function defaults() { return { version: "three", over: {}, keep: { fill: "full", nonTitle: true, others: "ask" }, series: "sx", sid: null, length: "real", resume: false }; }
  function fixSeason(c) {
    if (!LONG[c.series]) c.series = "sx";
    var si = seasonInfo(c.sid);
    if (!si || si.series !== c.series) { var list = seasonsOf(c.series); c.sid = list.length ? list[0].id : null; }
    c.length = RD.MODE_OF[c.length] || "real";
  }
  function keep(c) {
    if (!c.over) c.over = {}; if (!c.keep) c.keep = {};
    KEEPK.forEach(function (k) { if (c.over[k] != null) c.keep[k] = c.over[k]; else if (c.keep[k] != null) c.over[k] = c.keep[k]; });
  }
  function clean(x) {
    var d = defaults(); if (!x || typeof x !== "object") return d;
    x = JSON.parse(JSON.stringify(x));
    if (RC.VERSIONS.some(function (v) { return v.id === x.version; })) d.version = x.version;
    if (x.over && typeof x.over === "object") Object.keys(x.over).forEach(function (k) { if (DEF_WAR.hasOwnProperty(k) || KEEPK.indexOf(k) >= 0) d.over[k] = x.over[k]; });
    if (x.keep && typeof x.keep === "object") KEEPK.forEach(function (k) { if (x.keep[k] != null) d.keep[k] = x.keep[k]; });
    if (LONG[x.series]) d.series = x.series;
    if (seasonInfo(x.sid)) d.sid = x.sid;
    if (x.length) d.length = x.length;
    d.resume = !!x.resume;
    fixSeason(d); keep(d);
    return d;
  }
  function warOpts(c) { var o = {}, k; for (k in DEF_WAR) o[k] = DEF_WAR[k]; o.version = c.version || "three"; for (k in (c.over || {})) if (DEF_WAR.hasOwnProperty(k) && k !== "version") o[k] = c.over[k]; return o; }
  function effOpts(c) {
    var w = RC.normalize(RC.mergeOpts(warOpts(c)), 22), o = {};
    for (var k in DEF_WAR) o[k] = w[k];
    o.version = c.version; o.cards = warOpts(c).cards === "auto" ? "auto" : w.cards;   /* mxtime: Auto = 52 cards in a stadium race of more than 16 laps, else 26 (season.js) */
    o.fill = (c.over && c.over.fill) || (c.keep && c.keep.fill) || "full";
    o.nonTitle = (c.over && c.over.nonTitle != null) ? !!c.over.nonTitle : (c.keep && c.keep.nonTitle != null) ? !!c.keep.nonTitle : true;
    o.others = (c.over && c.over.others) || (c.keep && c.keep.others) || "ask";
    return o;
  }
  var HDESC = {
    onlyTied: "On (the usual way): only the riders tied for the top card go to war. Off: everyone joins the war (Pagat).",
    outLoses: "Official (off): your last card plays for the whole war. On: too few cards for a war and you are out of the race.",
    form: "The year's real top 10 swap their lowest card for a better one after the deal (once; twice for the top 5)."
  };
  var VERS = RC.VERSIONS.map(function (v) { return { id: v.id, name: v.name, tag: v.tag, desc: v.id === "three" ? "The CEO's War: 3 face down, the 4th decides every war. Lose a double war and you crash and remount; lose a triple war and you crash out of the race. Every crash brings out the yellow flag." : "1 face down, the next card decides. Crashes as in Three-card War: a lost double war = down and remount, a lost triple war = out." }; });
  function rows() {
    var out = RC.HOUSE.map(function (h) { return [h[0], h[1], h[2], h[3], h[4] ? 0 : 1]; });   /* race.js row[4] = House; the Party lobby's row[4] = official */
    out.push(["fill", "Fill the gate", "choice", [["full", "The year's full program"], ["roster", "Real riders only (smaller races)"]], 1]);
    out.push(["nonTitle", "Race the rounds that paid no points", "bool", null, 1]);
    out.push(["others", "Races without phones", "choice", [["ask", "Ask: watch or sim"], ["sim", "Sim them to results"], ["watch", "Watch them"]], 0]);
    return out;
  }
  function savedGame() {
    var s = lsGet(KEY);
    if (!s || s.v !== SAVEV || !s.G || s.G.id !== "mxwar" || s.G.over || !Array.isArray(s.G.humans) || !s.G.humans.length) return null;
    try { if (S.check(s.G).length) return null; } catch (e) { return null; }
    return s;
  }
  function ago(t) { var m = Math.round((Date.now() - (+t || 0)) / 60000); return m < 1 ? "just now" : m < 60 ? plural(m, "minute") + " ago" : m < 1440 ? plural(Math.round(m / 60), "hour") + " ago" : plural(Math.round(m / 1440), "day") + " ago"; }
  /* the season's BIG PREVIEW (the picker): its track drawn big, the year, the series, the calendar and the year's top riders (as mxwar/game.js preview) */
  var pvSeq = 0;
  function preview(id) {
    var si = seasonInfo(id), el = document.createElement("div"); el.className = "mx-pv";
    if (!si) return el;
    var F = IDX.formats[si.format];
    el.innerHTML = '<div class="mx-pv__band"><div class="mx-pv__art">' + A.track(si.series === "mx" ? "outdoor" : "stadium", "mxp" + (++pvSeq)) + '</div><span class="mx-pv__y">' + si.year + '</span>' +
      '<span class="mx-pv__h"><span class="mx-pv__s">' + esc(LONG[si.series] + " · " + si.cls) + '</span><span class="mx-pv__c">' + esc(plural(si.rounds, "round") + " · " + (F && F.finals.kind === "moto" ? "motos and overall" : F && F.qual.length ? F.qual.map(function (q) { return q.label; }).join(", ") + ", " + F.finals.label : "Main")) + '</span></span></div>' +
      '<div class="mx-pv__body"><span class="mx-pv__load">Loading the season...</span></div>';
    loadSeason(id).then(function (D) { fillPreview(el, D); }, function () { var l = el.querySelector(".mx-pv__load"); if (l) l.textContent = "Offline: this season loads when you are online."; });
    return el;
  }
  function fillPreview(el, D) {
    var body = el.querySelector(".mx-pv__body"); if (!body) return;
    var top = D.riders.filter(function (r) { return r.pos != null; }).sort(function (a, b) { return a.pos - b.pos; }).slice(0, 8);
    body.innerHTML = '<div class="mx-pv__col"><span class="mx-pv__lab">' + (D.series === "mx" ? "Tracks" : "Cities") + '</span><div class="mx-pv__cities">' +
      D.rounds.map(function (r) { return '<span class="mx-pv__city"><b>' + r.n + "</b> " + esc(r.city || r.venue) + "</span>"; }).join("") + '</div></div>' +
      '<div class="mx-pv__col"><span class="mx-pv__lab">Top riders</span><ol class="mx-pv__riders">' +
      top.map(function (r) { return '<li><span class="mx-pv__rk">' + r.pos + '</span><span class="mx-pl' + (r.ns === "a" ? " is-gen" : "") + '" style="' + A.mkStyle(r.bike) + '">' + (r.num != null ? r.num : "-") + '</span><span class="mx-pv__nm">' + esc(r.name) + '</span>' + (r.bike ? '<span class="mx-mk" style="' + A.mkStyle(r.bike) + '">' + esc(r.bike) + "</span>" : "") + "</li>"; }).join("") + "</ol></div>";
    if (el._fit) fitPreview(el, el._fit);
  }
  function fitPreview(pic, o) {
    var el = pic.classList && pic.classList.contains("mx-pv") ? pic : pic.querySelector && pic.querySelector(".mx-pv"); if (!el || !o) return;
    el._fit = o;
    el.classList.toggle("is-narrow", o.width < 520);
    el.style.setProperty("--pv-fs", Math.max(o.floor || 12, Math.min(o.width / 26, (o.floor || 12) * 1.1)).toFixed(1) + "px");
    var box = el.querySelector(".mx-pv__cities");
    if (box) {   /* the cities that don't fit are counted, never squeezed under the floor */
      var chips = [].slice.call(box.querySelectorAll(".mx-pv__city")), more = box.querySelector(".mx-pv__more"), n = chips.length;
      chips.forEach(function (c) { c.hidden = false; }); if (more) more.remove(); more = null;
      while (n > 1 && box.scrollHeight > box.clientHeight + 1) { n--; chips[n].hidden = true; if (!more) { more = document.createElement("span"); more.className = "mx-pv__more"; box.appendChild(more); } more.textContent = "+" + (chips.length - n) + " more"; }
    }
    var ol = el.querySelector(".mx-pv__riders");
    if (ol) { var li = [].slice.call(ol.children), m = li.length; li.forEach(function (x) { x.hidden = false; }); while (m > 1 && ol.scrollHeight > ol.clientHeight + 1) { m--; li[m].hidden = true; } }
  }
  function openYears(api, cfg) {
    var B = BG(); if (!B || !B.picker) { api.toast("The year list didn't load."); return; }
    fixSeason(cfg);
    var list = seasonsOf(cfg.series), groups = [], byDec = {};
    list.forEach(function (s) {
      var d = Math.floor(s.year / 10) * 10; if (!byDec[d]) { byDec[d] = { head: d + "s", items: [] }; groups.push(byDec[d]); }
      byDec[d].items.push({ id: s.id, name: String(s.year), meta: s.cls + " · " + plural(s.rounds, "round"), desc: "Champion " + s.champion, detail: s.riders + " riders", tags: [s.status === "VERIFIED" ? { text: "verified", kind: "official" } : { text: "partly inferred", kind: "paper" }] });
    });
    B.picker.open({ eyebrow: "Choose the year", title: LONG[cfg.series], sub: "Every season from " + list[list.length - 1].year + " to " + list[0].year + ": the real calendar and the real " + (list[0].cls || "premier") + " riders of that year.",
      groups: groups, chosen: cfg.sid, aspect: 4 / 3, render: function (id) { return preview(id); }, fit: function (pic, id, o) { pic._fit = o; fitPreview(pic, o); },
      pickLabel: "Race this season", keepLabel: "Keep this season", refocus: "#mxpYear",
      onPick: function (id) { cfg.sid = id; api.redraw(); } });
  }
  var lobbyObs = null, lobbySig = "";
  /* the announcers (mxwar/booth.js): the TV speaks and shows captions, the phones are silent; the choice is kept on this device (as in the phone game's Menu) */
  function announcersRow() {
    if (!(MX.Booth && MX.Announce && window.BGVoice)) return "";
    var m = MX.Booth.stored().mode;
    return '<div class="bg-seg mxp-seg mxp-aseg" role="group" aria-label="Announcers">' + [["voice", "Announcers on"], ["captions", "Captions only"], ["off", "Off"]].map(function (s) { var on = s[0] === m; return '<button type="button" class="aibtn' + (on ? " on" : "") + '" aria-pressed="' + on + '" data-mxa="' + s[0] + '">' + s[1] + "</button>"; }).join("") + "</div>" +
      '<p class="ps-vdesc"><b>Announcers:</b> two commentators (both men) call every race on the TV, out loud and in captions. A TV with no male voice installed shows captions only. The phones stay silent.</p>';
  }
  /* [bcast] the broadcast's music (mxshow S0): the lobby's Music credits row and its sheet (the tracks, their authors and licences: MXWar.Music, mxwar/mxmusic.js) */
  var bcRuns = 0;
  function bcCredRow() {
    if (!(MX.Music && window.Sound && Sound.show)) return "";
    return '<button type="button" class="bg-row aibtn mxp-cred" id="mxpCred" aria-haspopup="dialog"><span class="bg-row__main"><span class="bg-row__title">Music credits</span><span class="bg-row__desc">The music plays on the TV (the phones stay silent): the tracks, their authors and their licences</span></span></button>';
  }
  function bcCredSheet() {
    var B = BG(); if (!B || !B.sheet || !MX.Music) return;
    MX.Music.credits("base").then(function (list) {
      var old = document.getElementById("mxpCredSheet"); if (old && old.parentNode) { try { if (B.sheet.isOpen(old)) B.sheet.close(old); } catch (e) { } old.parentNode.removeChild(old); }
      var el = document.createElement("section"); el.className = "bg-sheet ps-rj"; el.id = "mxpCredSheet"; el.setAttribute("aria-labelledby", "mxpCredT"); document.body.appendChild(el);
      el.innerHTML = '<div class="bg-sheet__grip" aria-hidden="true"></div><div class="bg-sheet__head"><div><span class="bg-eyebrow">Music</span><h2 class="bg-sheet__title" id="mxpCredT">Music credits</h2>' +
        '<p class="bg-sheet__sub">Every track you hear in Motocross War, by its author and under its licence.</p></div></div>' + MX.Music.creditsHTML(list, { tv: true }) +
        '<div class="pm-acts"><button type="button" class="bg-btn bg-btn--primary bg-btn--lg" id="mxpCredClose" data-autofocus>Close</button></div>';
      var close = function () { if (B.sheet.isOpen(el)) B.sheet.close(el); };
      document.getElementById("mxpCredClose").onclick = close;
      B.sheet.open(el, { dismissible: true, focus: "#mxpCredClose", onClose: function () { setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); var cb = document.getElementById("mxpCred"); if (cb) setFocus(cb); }, 0); } });
    });
  }
  /* [/bcast] */
  function lobby(api, cfg, el) {
    fixSeason(cfg); keep(cfg);
    var B = BG(), af = document.activeElement, keepSel = af && af.getAttribute && (af.id && /^mxp/.test(af.id) ? "#" + af.id : af.getAttribute("data-mxs") ? '[data-mxs="' + af.getAttribute("data-mxs") + '"]' : af.getAttribute("data-mxl") ? '[data-mxl="' + af.getAttribute("data-mxl") + '"]' : af.getAttribute("data-mxa") ? '[data-mxa="' + af.getAttribute("data-mxa") + '"]' : null);
    var sv = savedGame(); if (!sv) cfg.resume = false;
    api.rules({ versions: VERS, house: rows(), opts: function (c) { keep(c); return effOpts(c); }, show: function (h, o) { return h[0] !== "wildAs" || !!(o.deucesWild || o.acesWild || o.jokersWild); } });
    var secs = el.querySelectorAll(".ps-sec"), vsec = secs[0];
    var si = seasonInfo(cfg.sid), F = si && IDX.formats[si.format], n = Math.max(1, api.players());
    var fieldN = F ? RD.fieldSize(F) : 0;
    var ssec = '<section class="ps-sec mxp-ssec"><div class="bg-section"><h2 class="bg-eyebrow" data-stage-text>Season</h2></div>' +
      '<div class="bg-seg mxp-seg" role="group" aria-label="Series">' + [["sx", "Supercross"], ["mx", "Motocross"], ["smx", "SMX Playoffs"]].map(function (s) { var on = s[0] === cfg.series; return '<button type="button" class="aibtn' + (on ? " on" : "") + '" aria-pressed="' + on + '" data-mxs="' + s[0] + '">' + s[1] + "</button>"; }).join("") + "</div>" +
      (si ? '<button type="button" class="bg-row aibtn mxp-year" id="mxpYear" aria-label="Season ' + si.year + " " + esc(LONG[si.series]) + '. Choose the year">' +
        '<span class="mxp-ythumb" aria-hidden="true">' + A.track(si.series === "mx" ? "outdoor" : "stadium", "mxpy" + (++pvSeq)) + "<b>" + si.year + "</b></span>" +
        '<span class="bg-row__main"><span class="bg-row__title">' + esc(si.year + " " + LONG[si.series] + " · " + si.cls) + '</span><span class="bg-row__desc">' + esc(plural(si.rounds, "round") + " · " + si.riders + " real riders · champion " + si.champion + (si.status === "VERIFIED" ? " · verified" : " · partly inferred")) + "</span></span>" +
        '<span class="mxp-chev" aria-hidden="true" data-icon="chevron"></span></button>' +
        '<p class="ps-vdesc"><b>A night' + (si.series === "mx" ? " outdoors" : " in the stadium") + ":</b> " + esc(progWords(F)) + ". " + esc(pointsWords(F)) + " " +
        esc(n + (n === 1 ? " rider" : " riders") + " from this table race every round against the real riders of " + si.year + (fieldN ? "; a night needs " + fieldN + " riders" + (si.riders + n < fieldN ? ", so labelled privateers fill the gate" : "") : "") + ".") + "</p>" : "<p class=\"ps-vdesc\">No season for this series.</p>") +
      '<div class="bg-seg mxp-seg mxp-seg--2 mxp-lseg" role="group" aria-label="Race length">' + [["real", "Real length"], ["half", "Half length"]].map(function (s) { var on = s[0] === cfg.length; return '<button type="button" class="aibtn' + (on ? " on" : "") + '" aria-pressed="' + on + '" data-mxl="' + s[0] + '">' + s[1] + "</button>"; }).join("") + "</div>" +
      '<p class="ps-vdesc"><b>Real time:</b> every lap takes the round\'s real lap time (Supercross about a minute, outdoors about two), whatever the Game speed (it paces the cards, banners and results). ' + (cfg.length === "half" ? "<b>Half length:</b> half of each race's real laps." : "<b>Real length:</b> every race runs the laps its real race ran.") + " Every lap is one War flip on every phone, and the cards decide the lap times: the first rider across the line after the last lap wins. The season saves after every lap.</p>" +
      '<p class="ps-vdesc">' + esc(BR && BR.skillNote ? BR.skillNote : "War has no choices to make: the cards decide every race.") + "</p>" + announcersRow() + /* [bcast] */ bcCredRow() + /* [/bcast] */ "</section>";
    if (vsec) vsec.insertAdjacentHTML("afterend", ssec); else el.insertAdjacentHTML("beforeend", ssec);
    Array.prototype.forEach.call(el.querySelectorAll("[data-mxa]"), function (b) { b.onclick = function () { try { MX.Booth.store({ mode: b.getAttribute("data-mxa") }); } catch (e) { } api.redraw(); }; });
    /* [bcast] */ var cbtn = el.querySelector("#mxpCred"); if (cbtn) cbtn.onclick = bcCredSheet; /* [/bcast] */
    if (sv) {
      var sh = sv.G.humans.length, ok = sh === n, names = sv.G.humans.map(function (h) { return sv.G.riders[h].name; });
      var res = '<section class="ps-sec mxp-res0"><div class="bg-section"><h2 class="bg-eyebrow" data-stage-text>Saved season</h2></div><div class="ps-rules"><div class="ps-rule"><span class="bg-tag bg-tag--official">saved</span>' +
        '<button type="button" class="bg-row aibtn' + (cfg.resume ? " on" : "") + '" role="switch" aria-checked="' + !!cfg.resume + '" id="mxpResume"><span class="bg-row__main"><span class="bg-row__title">Continue the saved season</span>' +
        '<span class="bg-row__desc">' + esc(sv.G.year + " " + SHORTS[sv.G.series] + " · round " + Math.min(sv.G.ri + 1, sv.G.cal.length) + " of " + sv.G.cal.length + " · " + plural(sh, "rider") + " (" + (names.length > 5 ? names.slice(0, 4).join(", ") + " and " + (names.length - 4) + " more" : names.join(", ")) + ") · saved " + ago(sv.t)) + '</span></span>' +
        '<span class="bg-sr">: ' + (cfg.resume ? "ON" : "off") + '</span><span class="bg-toggle" aria-hidden="true"></span></button></div></div>' +
        (cfg.resume && !ok ? '<p class="ps-vdesc" role="status" style="color:#ffd9a0">The saved season had ' + plural(sh, "rider") + " from this table and this table has " + n + ". Seat " + sh + " (phones and computers) to continue it; otherwise a new season starts.</p>" : "") +
        (cfg.resume && ok ? '<p class="ps-vdesc">The saved season keeps its own year and rules; the phones take its riders in order.</p>' : "") + "</section>";
      el.insertAdjacentHTML("afterbegin", res);
    }
    if (api.paintIcons) api.paintIcons(el);
    Array.prototype.forEach.call(el.querySelectorAll("[data-mxs]"), function (b) { b.onclick = function () { var s = b.getAttribute("data-mxs"); if (s === cfg.series) return; var y = (seasonInfo(cfg.sid) || {}).year; cfg.series = s; var same = seasonsOf(s).filter(function (x) { return x.year === y; })[0]; cfg.sid = same ? same.id : null; fixSeason(cfg); api.redraw(); }; });
    Array.prototype.forEach.call(el.querySelectorAll("[data-mxl]"), function (b) { b.onclick = function () { cfg.length = b.getAttribute("data-mxl"); api.redraw(); }; });
    var yb = el.querySelector("#mxpYear"); if (yb) yb.onclick = function () { openYears(api, cfg); };
    var rb = el.querySelector("#mxpResume"); if (rb) rb.onclick = function () { cfg.resume = !cfg.resume; api.redraw(); };
    if (keepSel) { var k2 = el.querySelector(keepSel); if (k2) setFocus(k2); }
    if (si) loadSeason(si.id).then(function () { }, function () { });   /* warm the season file */
    var pl = document.getElementById("players");
    lobbySig = String(api.players());
    if (pl && window.MutationObserver && (!lobbyObs || lobbyObs.el !== pl)) {
      if (lobbyObs) lobbyObs.disconnect();
      lobbyObs = new MutationObserver(function () {
        if (!pl.isConnected || document.documentElement.getAttribute("data-pgame") !== ID) { lobbyObs.disconnect(); lobbyObs = null; return; }
        var sig = String(api.players()); if (sig !== lobbySig) { lobbySig = sig; api.redraw(); }
      });
      lobbyObs.el = pl; lobbyObs.observe(pl, { childList: true });
    }
  }
  function versionName(c) {
    if (c.resume && savedGame()) return "Continue the saved season";
    fixSeason(c);
    var si = seasonInfo(c.sid), bits = [];
    if (si) bits.push(si.year + " " + SHORTS[si.series]);
    bits.push(c.length === "half" ? "Half length" : "Real length");
    if (c.version !== "three") bits.push("Classic War");
    return bits.join(" · ");
  }

  /* ================= THE RACE VIEW ADAPTER =================
     The one place that knows the renderer. mxwar/track.js (2D: MX.Track.create(el)) is always made: it keeps THE race clock of a time-model race
     (model mode: the clock, its limit at the next line, the events in clock order) and draws the race when there is no 3D. The 3D race (mxwar/race3d.js,
     loaded by a dynamic import made at run time; the classic scripts it rides on, course.js / layouts.js / data/tracks.js, are in the registry's tv files)
     draws it over the lane wherever WebGL2 works, riding the 2D track's clock (V3.setModel). Every call below is what the race needs: the track (series +
     venue key) and the 3D race (race3D: the round, the riders), the riders (team colours, plates, the red plate, the people), the pace (the real lap and
     first lap), the corner hole, the gate, each lap's standings and laps decided, crashes, the yellow flag, the flags, the riding clock. */
  function raceView(host, host3) {
    var T = null, nop = function () { };
    try { T = MX.Track ? MX.Track.create(host) : null; } catch (e) { T = null; }
    if (!T) return { ok: false, kind: "none", is3D: function () { return false; }, holding: function () { return false; }, gateWait: function () { return 0; }, onRelease: nop, prepare: nop, race3D: nop, hold: nop, onShown: nop, onMode: nop, camNext: function () { return null; }, setModel: nop, modelOn: function () { return false; }, rows: function () { return null; }, onEvent: nop, setRate: nop, setWait: nop, setTrack: nop, setHole: nop, size: nop, setRiders: nop, pace: nop, gate: nop, gateRect: function () { return null; }, drop: nop, resume: nop, standings: nop, lap: nop, crash: nop, yellow: nop, yellowOn: function () { return false; }, flag: nop, setRed: nop, ready: function () { return -1; }, untilLine: function () { return 0; }, onLap: nop, live: nop, destroy: nop };
    /* ---- the 3D race on the TV ---- */
    var V3 = null, st3 = "off", live = false, race = null, model = null, shownFn = null, modeFn = null, relFn = null, dead = false, loadT = 0, LOADMAX = 25000, gen3 = 0, prep = false;
    function gfx() { try { var v = localStorage.getItem("bg_mxwar_gfx"); return v === "2d" || /^(firetv|balanced|high|ultra)$/.test(v || "") ? v : "auto"; } catch (e) { return "auto"; } }   /* the phone game's Graphics choice on this device */
    function gl2() { try { return !/[?&]gl=0(&|$)/.test(location.search) && !!window.WebGL2RenderingContext; } catch (e) { return false; } }   /* (no probe context: the view's own supported() decides when it loads) */
    function is3() { return st3 === "on" && !!V3 && !V3.lost && !!race; }
    /* THE WARM HOLD (race3d.js): a new 3D race draws nothing until V3.warm() has compiled its shaders in parallel; the race waits with it (holding(): the
       race clock does not run, the gate does not drop, no lap's cards turn) while the view loads (at most LOADMAX) or warms; onRelease(fn) says when it goes on */
    function holding() { if (st3 === "loading") return !!race && Date.now() - loadT < LOADMAX; return is3() && (prep || !!V3.warming && V3.warming()); }
    function released() { relAt = Date.now(); show(); if (relFn) try { relFn(); } catch (e) { } }
    /* the riders stand at the gate a moment once the picture shows them (GATE3D ms after a hold), so the drop is seen and the picture's first frames are behind it */
    var relAt = 0, GATE3D = 1500;
    function gateWait() { return is3() ? Math.max(0, relAt + GATE3D - Date.now()) : 0; }
    function clock() { return T.tick ? T.tick() : T.clock(); }   /* the 2D track's model clock brought up to now: the 3D view asks every frame */
    function show() {
      var a = is3(), hd = holding(); T.setLive(live && !hd); T.show(live && !a && !(st3 === "loading" && hd)); if (V3) { try { V3.show(live && a); } catch (e) { } }
      var mn = host3 && host3.parentNode; if (mn && mn.classList) mn.classList.toggle("is-3dhold", !!(live && hd));
      if (modeFn) try { modeFn(a); } catch (e) { }
    }
    function apply3() {
      if (!V3 || !race || dead) return;
      var g = ++gen3, done = false, fin = function () { if (done) return; done = true; if (g === gen3 && !dead) released(); };
      var fail = function (e) { prep = false; st3 = "failed"; try { console.warn("mxwar party: the 3D race", e); } catch (x) { } setTimeout(fin, 0); };
      T.setLive(false);   /* the build takes a few tasks and the warm a few seconds: the race clock waits (released() starts it again) */
      /* the world first, over several short tasks (V3.prepareWorld: nothing when this layout is built already), then the riders in one task, so nothing blocks the TV long */
      prep = true;
      var pw = null; try { pw = V3.prepareWorld ? V3.prepareWorld(race) : null; } catch (e) { pw = null; }
      Promise.resolve(pw).then(function () { return new Promise(function (r) { setTimeout(r, 0); }); }).then(function () {   /* (the riders in a task of their own) */
        if (g !== gen3 || dead) return; prep = false;
        if (!V3 || V3.lost || st3 !== "on") { setTimeout(fin, 0); return; }
        try {
          V3.setRace(race); if (model) V3.setModel(model, { clock: clock });
          var w = V3.warm ? V3.warm() : null;   /* in THIS task, right after setRace (the view's warm hold needs it) */
          if (w && w.then) w.then(fin, fin); else setTimeout(fin, 0);
        } catch (e) { fail(e); return; }
        setTimeout(function chk() { if (done) return; if (g === gen3 && !dead && V3 && V3.warming && V3.warming()) { setTimeout(chk, 1000); return; } fin(); }, 32000);   /* (a safety: the view ends its hold after 30 s, later only while its shaders still compile: race3d.js [hook:live] V.warm) */
      });
    }
    (function load() {
      if (!host3 || gfx() === "2d" || !gl2()) return;
      var imp = null; try { imp = new Function("u", "return import(u)"); } catch (e) { return; }
      st3 = "loading"; loadT = Date.now();
      setTimeout(function () { if (st3 === "loading" && !dead) released(); }, LOADMAX + 50);   /* a load that hangs holds the race no longer: the 2D track rides on */
      var g = gfx(); document.documentElement.setAttribute("data-quality", g === "auto" ? "firetv" : g);   /* the TV: the FIRE TV quality unless this device picked one */
      imp(new URL("../mxwar/race3d.js", location.href).href).then(function (m) {
        if (dead) return;
        if (!m || !m.supported || !m.supported()) { st3 = "failed"; released(); return; }
        V3 = m.create(host3, { onLap: nop, onFinish: nop, lost: function () { st3 = "failed"; released(); }, slow: function () { st3 = "slow"; released(); },
          shown: function (k, i) { if (shownFn && is3()) try { shownFn(k, i); } catch (e) { } } });
        window.__mxpv3 = V3; st3 = "on";
        if (race) apply3(); else released();
        show(); if (is3()) try { V3.resize(); } catch (e) { }
      }).catch(function (e) { st3 = "failed"; try { console.warn("mxwar party: the 3D race did not load", e); } catch (x) { } released(); });
    })();
    return {
      ok: true, get kind() { return is3() ? "3d" : "2d"; }, is3D: is3, state3D: function () { return st3; },
      holding: holding, gateWait: gateWait, onRelease: function (fn) { relFn = fn; },                  /* the 3D picture is loading or warming: the race waits (and the callback when it goes on) */
      prepare: function (o) { if (!V3 || st3 !== "on" || V3.lost || prep || !V3.prepareWorld || !o) return; try { if (!(V3.worldReady && V3.worldReady(o))) V3.prepareWorld(o); } catch (e) { } },   /* the next race's world, built over short tasks while a panel shows (V3.prepareWorld) */
      race3D: function (o) { race = o || null; model = null; apply3(); show(); },   /* {series, year, round, cal, len, lapT, riders: [{s, color, accent, num, name, red, me}]}; rv.setModel(rc) follows (the race clock) */
      hold: function (o) { if (is3()) try { V3.hold(o || null); } catch (e) { } },  /* a war: the director looks at its riders */
      onShown: function (fn) { shownFn = fn; },                                   /* the moments the 3D picture shows (the announcers) */
      onMode: function (fn) { modeFn = fn; },                                     /* 3D on / off (the layout) */
      camNext: function () { if (!is3() || !V3.camNext) return null; var id = V3.camNext(), l = V3.camModes().filter(function (x) { return x.id === id; })[0]; return l ? l.name : id; },
      setModel: function (rc) { if (T.setModel) T.setModel(rc); model = rc && rc.tm ? rc : null; if (V3 && race && !prep) try { V3.setModel(model, { clock: clock }); } catch (e) { } },   /* mxtime: the race clock of the time model rides the field (a 3D race still being built takes it with its riders: apply3) */
      modelOn: function () { return !!(T.model && T.model()); },
      rows: function () { return T.rows ? T.rows() : null; },                      /* the live timing tower at the race clock */
      clock: function () { return T.clock ? T.clock() : 0; },
      onEvent: function (fn) { T.onEvent = fn; },                                  /* the events of the clock: a line, a fall, the yellow flag, a pass ... */
      setRate: function (x) { if (T.setRate) T.setRate(x); },
      setWait: function (on) { if (T.setWait) T.setWait(on); },
      setTrack: function (series, key) { T.setLayout(series === "mx" ? "outdoor" : "stadium", key); },
      setHole: function (w, h) { T.setHole({ w: w, h: h }); T.resize(true); },
      size: function () { T.resize(); if (is3()) try { V3.resize(); } catch (e) { } },
      setRiders: function (list) { T.setRiders(list); },                         /* [{s, color, accent, plate, red, me}] in gate order */
      pace: function (lapMs, firstMs) { T.setPace(lapMs); if (T.setFirst) T.setFirst(firstMs || 0); },
      gate: function (on) { T.gate(on); },
      gateRect: function () { return T.gateRect(); },
      drop: function (len) { T.gate(false); T.lap(0, len); if (is3()) try { V3.drop(); } catch (e) { } },
      resume: function (laps, len, parked, yel) { T.gate(false); T.setLaps(laps, len); (parked || []).forEach(function (p) { T.park(p.s, p.sector); }); if (yel) T.setYellow(yel.lap, yel.s, yel.sector); },
      standings: function (order, cnt, outs) { T.update(order, cnt, outs); },
      lap: function (k, len) { T.lap(k, len); },
      crash: function (s, kind) { T.crash(s, kind); },
      yellow: function (lap, s, sector) { T.setYellow(lap, s, sector); },
      yellowOn: function () { return T.yellowOn(); },
      flag: function (f) { T.setFlag(f); if (is3()) try { V3.setFlag(f); } catch (e) { } },
      setRed: function (s) { T.setRed(s); if (is3()) try { V3.setRed(s); } catch (e) { } },
      ready: function () { return T.ready(); },                                   /* ms until the next lap's cards may turn; -1 = no riding clock */
      untilLine: function (k) { return T.untilLine(k); },                         /* ms until the leader ends lap k (the checkered flag) */
      onLap: function (fn) { T.onLap = fn; },
      live: function (on) { live = !!on; show(); },                              /* (show: the clock runs while live and the 3D picture is not holding) */
      destroy: function () { dead = true; try { T.stop(); } catch (e) { } if (V3) { try { V3.dispose(); } catch (e) { } V3 = null; } st3 = "off"; }
    };
  }

  /* ================= the game ================= */
  async function start(H, cfg) {
    cfg = clean(cfg);
    var SEATS = H.seats, n = SEATS.length, G = null, D = null;
    var f = function () { return (H.pace() || 1.8) / 1.8; };                   /* Medium = 1, Slow = 1.75, Fast = .5 (the phone game's speedFactor) */
    var sp = function (ms) { return Math.max(120, Math.round(ms * f())); };
    var dl = function (ms) { return Math.round(ms * f()); };
    var wait = function (ms) { return H.sleep(Math.max(0, ms) / 1.8); };        /* a pause at the Game speed */
    var raw = function (ms) { return H.sleep(Math.max(0, ms) / (H.pace() || 1.8)); };   /* a real-time pause (the riding clock) */
    var auto = {};                                                              /* seat colour -> the phone's Auto switch */
    var ui = { ph: "load", rc: null, lastCards: {}, war: null, warCards: {}, order: [], lap: 0, hs: null, lastWin: null, lapAt: 0, log: [], step: null, intents: {}, need: [], pinfo: null, pendRound: null, pendSeason: null, lastDone: null, crashQ: [], skipArm: 0, white: null, label: "", picks: null, su: null };
    var disp = null, skipQ = false, panelT = 0, pushT = 0;
    var stats = window.__mxp = { laps: 0, races: 0, simmed: 0, rounds: 0, asks: 0, phoneActs: 0, lateFlips: 0, autoActs: 0, wars: 0, crashes: 0, yellows: 0, holeshots: 0, podiums: 0, panels: [], reconnects: 0, takes: 0, leaves: 0, views: 0, saves: 0, pushes: 0, resumed: false, events: {}, errors: [] };
    stats.ui = ui; stats.auto = auto; stats.H = H;
    try { Object.defineProperty(stats, "G", { get: function () { return G; } }); } catch (e) { }
    var ixOf = function (c) { for (var i = 0; i < n; i++) if (SEATS[i].color === c) return i; return -1; };
    var hex = function (k) { return SEATS[k] ? SEATS[k].hex : "#888"; };

    /* ---- the season file ---- */
    var sv = cfg.resume ? savedGame() : null;
    if (sv && sv.G.humans.length !== n) { H.toast("The saved season had " + plural(sv.G.humans.length, "rider") + ": a new season starts."); sv = null; }
    var sid = sv ? sv.G.sid : cfg.sid;
    try { D = await loadSeason(sid); } catch (e) { if (!sv) throw new Error("Couldn't load the season (offline?). Pick another year or go online once."); }
    if (!H.live()) return;

    /* ---- the TV screen ---- */
    H.frame('<div class="mxp" id="mxp">' +
      '<div class="mxp-main" id="mxpMain" data-stage-solid data-toast-avoid>' +
      '<div class="mxp-lane bg-frame" id="mxpLane" role="img" aria-label="The race on the track"></div><div class="mxp-v3" id="mxpV3" aria-hidden="true"></div>' +
      '<div class="mxp-v3hold" aria-hidden="true"><div class="mxp-v3hold__card"><span class="mxp-v3hold__t">The riders roll up to the gate</span><span class="mxp-v3hold__bar"></span></div></div>' +
      '<div class="mxp-gate" id="mxpGate" aria-hidden="true"></div><div class="mxp-dust" id="mxpDust" aria-hidden="true"></div>' +
      '<div class="mxp-chips"><span class="mxp-chip is-hot" id="mxpLapC"></span><span class="mxp-chip" id="mxpHsC"></span><span class="mxp-chip" id="mxpYelC"></span><span class="mxp-chip" id="mxpFieldC"></span></div>' +
      '<div class="mxp-banner" id="mxpBanner" aria-live="polite"><b id="mxpBannerT"></b><span id="mxpBannerS"></span></div>' +
      '<div class="mxp-flash" id="mxpFlash"></div>' +
      '<div class="mxp-pip" id="mxpPip" aria-label="The cards"><div class="mxp-duel" id="mxpDuel"></div><div class="mxp-war" id="mxpWar"></div><div class="mxp-note" id="mxpNote"></div></div>' +
      "</div>" +
      '<aside class="mxp-side" aria-label="The timing tower"><div class="mxp-head"><div><b id="mxpTitle"></b><span id="mxpSub"></span></div><button type="button" class="bg-btn bg-btn--secondary mxp-skip" id="mxpSkip">Skip to the finish</button></div>' +
      '<ol class="mxp-tower" id="mxpTower" aria-label="Timing: places, gaps, last laps"></ol><ol class="mxp-log" id="mxpLog" aria-label="What happened"></ol></aside>' +
      '<div class="mxp-cap" id="mxpCap" aria-label="The announcers"></div><div class="mxp-panel" id="mxpPanel" hidden></div></div>', "Players: watch the TV");
    var $ = H.$;
    /* [bcast] the broadcast's music (mxshow S0): the CEO's picks through mxwar/mxmusic.js, the same director and the same moments as the game page (the TV
       plays them; the phones load none of it). The broadcast mixer while Motocross War is up, today's chain again when it ends. Without the package files:
       today's synthesized playlist. */
    var BCM = null, bcRun = ++bcRuns;
    if (MX.Music && window.Sound && Sound.mix && Sound.show) { try { Sound.mix.profile("broadcast"); BCM = MX.Music.create({ pkg: "base", game: ID }); } catch (e) { BCM = null; } }
    if (BCM) H.onEnd(function () { try { BCM.at("off"); } catch (e) { } try { Sound.mix.profile(null); } catch (e) { } }); else H.music(ID);
    stats.bcm = BCM;
    function bcNew() { return G && !G.over && !G.race && !(G.round && G.round.races.some(function (r) { return r.res; })) ? bcRun + "|" + G.sid + "|" + G.ri : null; }
    function bcPanel(kind) {   /* the panel on the TV is the moment: sign-up = the Menu; season, line-up and standings with the next race = the season screen */
      if (!BCM) return;
      try {
        if (kind === "signup") BCM.at("menu");
        else if (kind === "results" || (kind === "standings" && ui.pendRound)) BCM.at("results", { last: !!ui.pendRound, G: G });   /* (the standings looked at from the round's last results: the post-race music goes on) */
        else if (kind === "podium") { var rs = G.results[G.results.length - 1]; BCM.at("podium", { round: bcRun + "|" + G.sid + "|" + (rs ? rs.ri : G.ri) }); }
        else if (kind === "final") BCM.at("over");
        else BCM.at("season", { round: bcNew() });
      } catch (e) { }
    }
    function bcFlag(fx) { if (!BCM) { H.sfx(fx); return; } var rc = ui.rc, fin = !!rc && (rc.kind === "main" || !G.round); BCM.at("flag"); BCM.flag(fin, fx); }
    /* [/bcast] */
    var rv = raceView($("mxpLane"), $("mxpV3")); stats.rv = rv;
    rv.onMode(function (on) { var p = $("mxp"); if (p) p.classList.toggle("is-3d", on); });
    $("mxpGate").innerHTML = A.gate();

    /* ---------- the announcers: the TV calls the race (the phones never load the voice: they stay silent). Same booth, same calls as mxwar/game.js ---------- */
    var booth = null;
    function annOn() { return !!(booth && booth.callsRace()); }
    function annFeed(ev) { if (booth && G) try { booth.feed(G, ev); } catch (e) { } }
    function annShown(kind, info) { if (booth) try { booth.shown(kind, info); } catch (e) { } }
    function skipSheetUp() { var B = BG(), el = document.getElementById("mxpSkipSheet"); return !!(el && B && B.sheet && B.sheet.isOpen && B.sheet.isOpen(el)); }
    function annBand() {
      var on = annOn(), p = $("mxp"); if (!p) return;
      if (on !== p.classList.contains("has-cap")) { p.classList.toggle("has-cap", on); setTimeout(function () { try { onResize(); } catch (e) { } }, 0); }
    }
    if (MX.Booth && MX.Announce && window.BGVoice) {
      try {
        booth = MX.Booth.create({ speed: function () { return H.speed ? H.speed() : "medium"; }, ctx: function () { return { hold: false, quiet: skipSheetUp() }; }, onChange: annBand,
          clock: function () { return modelOn() ? { t: rv.clock(), rate: modelRate(ui.rc) } : null; } });   /* the race clock the picture is at: the commentator reads the race at that moment */
        var capEls = booth.attach({ band: $("mxpCap") });
        if (capEls && capEls.band) { var idle = document.createElement("span"); idle.className = "mxp-capidle"; idle.textContent = "Calloway and Bramlett on the call"; $("mxpCap").appendChild(idle); }
        annBand();
      } catch (e) { booth = null; }
    }
    stats.booth = booth;
    var hs3 = { seen: false, wait: [] };   /* the holeshot into turn 1 on the 3D picture (the banner waits for it) */
    rv.onShown(function (k, i) { annShown(k, i); if (k === "holeshot") { hs3.seen = true; hs3.wait.splice(0).forEach(function (f) { try { f(); } catch (e) { } }); } });
    function seenHs(ms) { return new Promise(function (res) { if (hs3.seen) { res(); return; } var done = false, f = function () { if (!done) { done = true; res(); } }; hs3.wait.push(f); setTimeout(f, ms); }); }

    /* ---------- helpers on the season ---------- */
    /* the race seats of the race on show: kept from its start (season.js endRace clears G.rmap while the last lap's show still plays) */
    function rmap() { return (ui.rc && ui.rmap) || (G && G.rmap) || null; }
    function kOfId(id) { return G ? G.humans.indexOf(id) : -1; }
    function sOfK(k) { var m = rmap(); return m && G.humans[k] ? m.indexOf(G.humans[k]) : -1; }
    function kOfS(s) { var m = rmap(); return m ? kOfId(m[s]) : -1; }
    function riderOfS(s) { return G.riders[rmap()[s]]; }
    function nm(s) { return riderOfS(s).name; }
    function whoList(seats) { return seats.length <= 3 ? listNames(seats.map(nm)) : seats.length + " riders"; }
    var redK = "", redV = null;
    function redId() { if (!G) return null; var k = G.results.length + "|" + G.ri; if (redK !== k) { redK = k; redV = S.redPlate(G); } return redV; }
    function plateHTML(R) { var red = R.id === redId(), gen = R.plateGen && R.kind !== "human"; return '<span class="mx-pl' + (gen ? " is-gen" : "") + (red ? " is-red" : "") + '" style="' + A.mkStyle(R.bike) + '">' + (R.plate != null ? R.plate : "-") + "</span>"; }
    function cpuIco() { var B = BG(); return B && B.icon ? B.icon("cpu") : ""; }
    function isCpuRider(R) { if (!R || R.kind !== "human") return false; var k = kOfId(R.id); return k >= 0 && !H.isPhone(SEATS[k].color); }
    function nameHTML(R) { return esc(R.name) + (R.kind === "privateer" ? " (privateer)" : "") + (isCpuRider(R) ? cpuIco() : ""); }
    function lapMs() { var o = +window.__mxpLap; if (o > 0) return o; try { return Math.round(S.lapOf(G) * 1000); } catch (e) { return 55000; } }
    function firstMs() { if (+window.__mxpLap > 0) return 0; try { var x = S.firstLapOf(G); return x > 0 ? Math.round(x * 1000) : 0; } catch (e) { return 0; } }
    function raceLabel() { if (!G || !G.round) return ""; var r = G.round.races.filter(function (x) { return x.key === G.rkey; })[0]; return r ? r.label : ""; }
    /* the night's wear for the 3D race (race3d.js V.setRace night; the phone game's night3D, mxwar/game.js): this race's place in the round's program and every
       race's laps, from the round: the first heat on a groomed track, the ruts deeper race by race, the Main the deepest (the same numbers on the TV and the phones) */
    function night3D() { var RG = G && G.round; if (!RG || !RG.races || !RG.races.length) return null; var key = ui.rkey || G.rkey, k = -1; RG.races.forEach(function (r, i) { if (r.key === key) k = i; }); if (k < 0) k = Math.min(RG.cur || 0, RG.races.length - 1); return { k: k, lens: RG.races.map(function (r) { return r.len || 0; }) }; }
    function cal() { return ui.rc && ui.cal ? ui.cal : G.cal[Math.min(G.ri, G.cal.length - 1)]; }
    function machine(k) { var c = SEATS[k].color; return !H.isHuman(c) || !!auto[c]; }
    function logLine(t) { if (!t) return; ui.log.push(t); if (ui.log.length > 12) ui.log.shift(); var l = $("mxpLog"); if (l) l.innerHTML = ui.log.slice(-3).map(function (x) { return "<li>" + esc(x) + "</li>"; }).join(""); }
    function say(e) { try { var t = BR && BR.react(G, e); if (t) logLine(t); } catch (x) { } }
    function status(t) { H.status(esc(t)); }

    /* ---------- the phones: each one's rider and the race, slim (nothing is private in a race: snapshot(G, seat) hides nothing) ---------- */
    function phoneSt(c, ask) {
      var k = ixOf(c), st = { v: 1, step: ui.step || "", ph: ui.ph, ask: ask || null, auto: !!auto[c], n: n, line: ui.log.length ? ui.log[ui.log.length - 1] : "" };
      if (ui.ph === "signup" && ui.su) {
        var pk = ui.picks[k] || {};
        st.step = "su:" + (pk.askN || 0);
        st.su = { year: ui.su.year, series: ui.su.series, makes: ui.su.makes, taken: takenList(k), mine: { num: pk.num, bike: pk.bike, ready: !!pk.ready, err: pk.err || "" },
          riders: ui.picks.map(function (p, j) { return { n: p.name, num: p.ready ? p.num : null, bike: p.bike, ready: !!p.ready, cpu: !H.isPhone(SEATS[j].color), hex: hex(j) }; }) };
        st.me = { name: pk.name || H.name(c), plate: pk.ready ? pk.num : null, bike: pk.bike, mk: A.mk(pk.bike), hex: hex(k) };
        return st;
      }
      if (!G) return st;
      var id = G.humans[k], R = id ? G.riders[id] : null; if (!R) return st;
      st.me = { name: R.name, plate: R.plate, bike: R.bike, mk: A.mk(R.bike), red: R.id === redId(), hex: hex(k) };
      var L = S.standings(G), my = L.filter(function (r) { return r.id === id; })[0];
      st.season = { year: G.year, name: SHORTS[G.series], ri: Math.min(G.ri + 1, G.cal.length), nr: G.cal.length, city: (cal().city || cal().venue), place: my ? my.place : 0, pts: my ? my.pts : 0, of: L.length, leader: L.length && L[0].pts > 0 ? L[0].name : "", over: G.over };
      var rc = ui.rc;
      if (rc && (ui.ph === "race" || ui.ph === "gate")) {
        var s = sOfK(k), RS = RC.standings(rc), cnt = disp ? disp.cnt : rc.r.map(function (p) { return p.pk.length; }), mine = null, order = ui.order.length ? ui.order : RS.map(function (r) { return r.s; });
        if (s >= 0) mine = rc.r[s];
        var top = order.slice(0, 5).map(function (x, i) { var Rx = riderOfS(x); return { p: i + 1, pl: Rx.plate, mk: A.mk(Rx.bike), nm: Rx.name, k: rc.r[x].out ? -1 : cnt[x], me: x === s, red: Rx.id === redId() }; });
        var myPlace = s >= 0 ? order.indexOf(s) + 1 : 0;
        if (s >= 0 && myPlace > 5) top.push({ p: myPlace, pl: R.plate, mk: A.mk(R.bike), nm: R.name, k: mine.out ? -1 : cnt[s], me: true, red: R.id === redId() });
        var w = s >= 0 ? ui.warCards[s] : null;
        var rows = liveRows(), tw = null, you = null, fl = "";
        if (rows) {
          var T = MX.Time, pre = rc.phase === "gate" || rc.tm.k === 0;
          var sn = shortsOf(rc);   /* mxfix1: [10] the compact board's gap ("+2.09", "+1:10.3"), [11] the short name (art.js shortNames, the same rule as everywhere) */
          tw = rows.map(function (r) { var c = T.towerCells(r), Rx = riderOfS(r.s); return [r.s, r.place, Rx.plate, Rx.name, pre ? "" : c.gap, c.tag, pre ? "" : c.last, r.fl ? 1 : 0, A.mk(Rx.bike), Rx.id === redId() ? 1 : 0, pre ? "" : c.short, sn[r.s] || ""]; });
          rows.forEach(function (r) { if (r.fl) fl = "#" + riderOfS(r.s).plate + " " + T.fmtLap(r.best); });
          var mr = s >= 0 ? rows.filter(function (r) { return r.s === s; })[0] : null;
          if (mr) { var mc = T.towerCells(mr), yy = youK[s] || null; myPlace = mr.place;
            you = { place: mr.place, of: rows.length, gap: pre ? "" : mc.gap, tag: mc.tag, last: mr.last != null ? T.fmtLap(mr.last) : "", best: mr.best != null ? T.fmtLap(mr.best) : "", fl: mr.fl ? 1 : 0, int: pre || mr.int == null ? null : mr.int,
              line: yy ? yy.line : pre ? T.RULES : "", why: yy ? yy.reasons.slice(0, 4).map(function (q) { return [q.text, Math.abs(q.sec) >= 0.05 ? (q.sec > 0 ? "+" : "-") + T.secText(q.sec) : "", q.sec > 0.04 ? 1 : q.sec < -0.04 ? -1 : 0]; }) : [] }; }
        }
        st.race = { label: ui.label, city: cal().city || cal().venue, lap: Math.min(Math.max(ui.lap, 1), rc.o.len), len: rc.o.len, gate: rc.phase === "gate", over: rc.over, n: rc.n, inRace: s >= 0, meS: s, place: myPlace, cnt: s >= 0 ? cnt[s] : 0, tw: tw, you: you, fl: fl,
          last: s >= 0 && ui.lastCards[s] != null ? ui.lastCards[s] : null, out: !!(mine && mine.out), dnf: mine && mine.dnf ? mine.dnf.why : null, cr: mine ? mine.crashes | 0 : 0,
          war: w ? { n: w.n, down: w.down, up: w.up, won: w.won, lost: w.lost } : null, warOn: !!(ui.war && s >= 0 && ui.war.seats.indexOf(s) >= 0), warN: ui.war ? ui.war.n : 0,
          phase: rc.phase, need: s >= 0 && ui.need.indexOf(s) >= 0 && !ui.intents[s], hs: ui.hs != null ? nm(ui.hs) : "", yellow: !!(rc.yellow && !rc.over), top: top };
      }
      if (ui.pinfo) st.panel = ui.pinfo;
      return st;
    }
    function safeSt(c, ask) { try { return phoneSt(c, ask); } catch (e) { stats.errors.push("phoneSt: " + (e && e.message || e)); return null; } }
    stats.phoneSt = function (c) { return safeSt(c, null); };   /* test hook: the snapshot a phone gets (the Party round-trip test compares it with what the phone received) */
    function pushNow() { clearTimeout(pushT); pushT = 0; stats.pushes++; H.pushAll(function (c) { return safeSt(c, null); }); }
    function pushSoon() { if (pushT) return; pushT = setTimeout(function () { pushT = 0; if (H.live()) pushNow(); }, 450); }
    H.onReconnect(function () { stats.reconnects++; pushNow(); });
    H.onTakeOver(function (c) { stats.takes++; auto[c] = false; renderTower(null); H.push(c, safeSt(c, null)); });
    H.onLeave(function (c) { stats.leaves++; auto[c] = false; renderTower(null); renderSignup(); pushNow(); });
    H.onView(function (c, d) {
      stats.views++; if (!d || typeof d !== "object") return;
      if (d.auto != null) { auto[c] = !!d.auto; if (auto[c]) { H.interrupt(c); H.toast(H.name(c) + " turned on Auto"); } renderTower(null); H.push(c, safeSt(c, null)); }
    });
    twTimer = setInterval(function () { if (ui.rc && (ui.ph === "race" || ui.ph === "gate") && !document.hidden && ui.rc.tm) { try { renderTower(null); } catch (e) { } } }, 250);
    pushTick = setInterval(function () { if (H.live() && ui.rc && ui.ph === "race" && !ui.rc.over && ui.rc.tm && !pushT) pushNow(); }, 5000);
    H.onEnd(function () { clearInterval(twTimer); clearInterval(pushTick); clearTimeout(pushT); clearInterval(panelT); window.removeEventListener("resize", onResize); document.removeEventListener("keydown", onKey, true); closeSkipSheet(); rv.destroy(); if (booth) try { booth.destroy(); } catch (e) { } });

    /* ---------- the Victory: the season's top 16 (places 1..N, never shared: season.js standings break every tie) ---------- */
    H.standings(function () {
      if (!G) return [];
      return S.standings(G).slice(0, 16).map(function (r) { var R = G.riders[r.id], k = kOfId(r.id); return { name: "#" + R.plate + " " + R.name, color: k >= 0 ? hex(k) : A.mk(R.bike)[0], v: plural(r.pts, "pt"), s: [1000 - r.place], win: r.place === 1, k: r.place }; });
    });
    function save() { if (!G) return; if (G.over) { lsSet(KEY, null); return; } stats.saves++; var as = booth ? booth.state() : null; lsSet(KEY, as ? { v: SAVEV, G: G, t: Date.now(), ann: as } : { v: SAVEV, G: G, t: Date.now() }); }

    /* ---------- layout: the tower's rows and columns, the corner window, the gate ---------- */
    function layoutTower() {
      var tw = $("mxpTower"), rc = ui.rc; if (!tw) return;
      var rowsN = tw.children.length || 1, rem = remPx(), cols = rowsN > 22 ? 2 : 1;
      $("mxp").style.setProperty("--tw", cols === 2 ? "41rem" : "25rem"); tw.classList.toggle("is-cols2", cols === 2);
      $("mxp").classList.toggle("is-many", rowsN > 15);
      var per = Math.ceil(rowsN / cols), room = tw.clientHeight - rem * .8 - (per - 1) * rem * .15;
      var rh = clamp(Math.floor(room / per), Math.round(rem * 1.2), Math.round(rem * 2.1));
      tw.style.setProperty("--cols", String(cols)); tw.style.setProperty("--rows", String(per)); tw.style.setProperty("--rh", rh + "px");
      if (rc) rv.size();
    }
    function layoutPip() {
      var rem = remPx(), pip = $("mxpPip"), w = Math.round(rem * 15), h = Math.round(rem * 9.4);
      pip.style.setProperty("--pip-w", w + "px"); pip.style.setProperty("--pip-h", h + "px");
      rv.setHole(w + rem * 1.4, h + rem * 1.4);
    }
    function placeGate() {
      var r = rv.gateRect(), gt = $("mxpGate"), du = $("mxpDust"); if (!r) { gt.style.display = "none"; return; }
      gt.style.left = Math.round(r.x - r.w / 2) + "px"; gt.style.top = Math.round(r.y) + "px"; gt.style.height = Math.round(r.h) + "px"; gt.style.width = Math.round(r.w) + "px";
      du.style.left = Math.round(r.x - r.h * .2) + "px"; du.style.top = Math.round(r.y - r.h * .2) + "px"; du.style.height = Math.round(r.h * 1.4) + "px"; du.style.width = Math.round(r.h * 3) + "px";
    }
    function onResize() { layoutPip(); layoutTower(); if (ui.rc && ui.rc.phase === "gate") placeGate(); if (!$("mxpPanel").hidden) fitPanel(); }
    window.addEventListener("resize", onResize);

    /* ---------- the chips, the tower, the corner window ---------- */
    function chips() {
      var rc = ui.rc; if (!rc) { ["mxpLapC", "mxpHsC", "mxpYelC", "mxpFieldC"].forEach(function (x) { $(x).innerHTML = ""; }); return; }
      var lp = Math.min(Math.max(ui.lap, 1), rc.o.len), last = rc.phase !== "gate" && !rc.over && lp === rc.o.len && rc.o.len > 1;
      $("mxpLapC").innerHTML = rc.phase === "gate" ? "On the gate · " + plural(rc.o.len, "lap") : rc.over ? A.flag() + "Checkered flag" : (last ? A.wflag() : "") + "Lap " + lp + " of " + rc.o.len + (last ? " · last lap" : "");
      $("mxpLapC").classList.toggle("is-white", last);
      $("mxpHsC").innerHTML = ui.hs != null ? "Holeshot: " + esc(nm(ui.hs)) : "";
      var yon = !rc.over && rc.phase !== "gate" && (!!(rc.yellow && rc.yellow.lap >= Math.min(rc.battle + 1, rc.o.len)) || (rv.ok && rv.ready() >= 0 && rv.yellowOn()));   /* the engine's yellow (G.yellow: the lap after the crash) or the track's */
      $("mxpYelC").innerHTML = yon ? A.yflag() + "Yellow flag" : ""; $("mxpYelC").classList.toggle("is-yellow", !!yon);
      $("mxpFieldC").textContent = fieldWords();
    }
    function fieldWords() {
      var rc = ui.rc; if (!rc || !G.round) return rc ? plural(rc.n, "rider") : "";
      var RG = G.round, r = RG.races.filter(function (x) { return x.key === ui.rkey; })[0], st = r && r.st >= 0 ? RG.st[r.st] : null, t = rc.n + " riders";
      if (st) { if (st.toMain) t += " · top " + st.toMain + " to the " + (RG.F.finals.kind === "moto" ? "motos" : RG.F.finals.label); else if (st.toNext && st.toNext !== "rest") t += " · top " + st.toNext + " move on"; }
      else if (r && r.st < 0) { var tb = RG.F.table || []; t += " · points to the top " + tb.filter(function (x) { return x > 0; }).length; }
      return t;
    }
    /* mxtime: the TIMING TOWER, every rider in the order of the race clock with the gap in seconds, the last lap and the card turned this lap. The rows are
       made once per race, patched four times a second, and the DOM order is the running order. Without a model (never now) the old cards tower. */
    var TWK = { key: "", els: {}, ord: "", cells: {} }, youK = {}, factsK = {}, factK = 0, twMark = null, twTimer, pushTick;
    function modelOn() { return !!(rv.ok && rv.modelOn() && ui.rc && ui.rc.tm && MX.Time); }
    function nameOfSeat(s) { var R = riderOfS(s); return "#" + R.plate + " " + R.name; }
    var snMemo = { rc: null, a: null };
    function shortsOf(rc) { if (!snMemo || snMemo.rc !== rc || !snMemo.a) { var a = []; for (var s = 0; s < rc.n; s++) a.push(String(riderOfS(s).name || "")); snMemo = { rc: rc, a: A.shortNames ? A.shortNames(a) : a }; } return snMemo.a; }   /* mxfix1: this race's short names, once */
    function modelRate(rc) { return Math.max(0.05, (rc.tm.p || 55) / Math.max(0.5, lapMs() / 1000)); }
    var rowsMemo = { t: -1, k: -1, rows: null };
    function liveRows() {   /* one computation per clock instant: a push to every phone reads it once */
      if (!modelOn()) return null;
      var t = rv.clock(), k = ui.rc.tm.k;
      if (rowsMemo.rows && rowsMemo.t === t && rowsMemo.k === k) return rowsMemo.rows;
      rowsMemo = { t: t, k: k, rows: rv.rows() }; return rowsMemo.rows;
    }
    function renderTower(mark) {
      var rc = ui.rc, tw = $("mxpTower"); if (!rc || !tw) return;
      if (mark) twMark = { win: mark.win, fight: mark.fight, until: Date.now() + 1800 };
      var rows = liveRows(); if (!rows) { legacyTower(mark); return; }
      var n = rows.length, key = G.ri + "|" + ui.rkey + "|" + n, T = MX.Time, i, r, e, c;
      if (TWK.key !== key) {
        TWK.key = key; TWK.els = {}; TWK.cells = {}; TWK.ord = "";
        tw.innerHTML = rows.slice().sort(function (a, b) { return a.s - b.s; }).map(function (x) { var R = riderOfS(x.s), k = kOfId(R.id);
          return '<li data-s="' + x.s + '"' + (k >= 0 ? ' style="--seat:' + hex(k) + '"' : "") + '><span class="mxp-tp"></span>' + plateHTML(R) + '<span class="mxp-tn">' + nameHTML(R) + '</span><span class="mx-tw__c"></span><span class="mxp-tl"></span><span class="mxp-tg"></span></li>'; }).join("");
        Array.prototype.forEach.call(tw.children, function (li) { TWK.els[+li.getAttribute("data-s")] = { li: li, p: li.querySelector(".mxp-tp"), c: li.querySelector(".mx-tw__c"), l: li.querySelector(".mxp-tl"), g: li.querySelector(".mxp-tg") }; });
        layoutTower();
      }
      var mk = twMark && twMark.until > Date.now() ? twMark : null, sig = rows.map(function (x) { return x.s; }).join(","), pre = rc.phase === "gate" || rc.tm.k === 0;
      if (sig !== TWK.ord) { TWK.ord = sig; for (i = 0; i < n; i++) tw.appendChild(TWK.els[rows[i].s].li); }
      for (i = 0; i < n; i++) {
        r = rows[i]; e = TWK.els[r.s]; c = T.towerCells(r); if (pre) { c.gap = ""; c.last = ""; }
        var R = riderOfS(r.s), k = kOfId(R.id), card = ui.lastCards[r.s], out = c.tag === "out" || c.tag === "pits";
        var cls = (k >= 0 ? " is-me" : "") + (k >= 0 && ui.need.indexOf(r.s) >= 0 && !ui.intents[r.s] && !machine(k) ? " is-need" : "") + (out ? " is-out" : "") + (r.status === "down" ? " is-down" : "") + (r.fl && r.lastK === r.bestK ? " is-fl" : "") + (mk && mk.win === r.s ? " is-win" : "") + (mk && mk.fight && mk.fight.indexOf(r.s) >= 0 ? " is-fight" : "");
        var v = r.place + "|" + c.gap + "|" + c.last + "|" + cls + "|" + (card == null ? "" : card) + "|" + (out ? 1 : 0);
        if (TWK.cells[r.s] === v) continue;
        TWK.cells[r.s] = v; e.p.textContent = r.place; e.g.textContent = c.gap; e.l.textContent = c.last; e.li.className = cls.trim();
        e.li.setAttribute("aria-label", ord(r.place) + ": " + R.name + ", " + (c.gap || "on the gate") + (c.last ? ", last lap " + c.last : ""));
        e.c.innerHTML = card != null && !out ? A.chip(card) : ""; e.c.className = "mx-tw__c" + (A.chipRed(card) ? " is-red" : "");
      }
    }
    /* the old tower (a race without a model): the order of the cards */
    function legacyTower(mark) {
      var rc = ui.rc, tw = $("mxpTower"); if (!rc || !tw) return;
      var order = ui.order.length ? ui.order : rc.r.map(function (p, s) { return s; }), counts = disp ? disp.cnt : rc.r.map(function (p) { return p.pk.length; }), lead = counts[order[0]] || 0;
      TWK.key = "";
      tw.innerHTML = order.map(function (s, i) {
        var R = riderOfS(s), k = kOfId(R.id), out = rc.r[s].out, c = ui.lastCards[s];
        var cls = (k >= 0 ? " is-me" : "") + (k >= 0 && ui.need.indexOf(s) >= 0 && !ui.intents[s] && !machine(k) ? " is-need" : "") + (out ? " is-out" : "") + (mark && mark.win === s ? " is-win" : "") + (mark && mark.fight && mark.fight.indexOf(s) >= 0 ? " is-fight" : "");
        return '<li class="' + cls.trim() + '"' + (k >= 0 ? ' style="--seat:' + hex(k) + '"' : "") + '><span class="mxp-tp">' + (i + 1) + "</span>" + plateHTML(R) + '<span class="mxp-tn">' + nameHTML(R) + "</span>" +
          '<span class="mx-tw__c' + (A.chipRed(c) ? " is-red" : "") + '">' + (c != null && !out ? A.chip(c) : "") + '</span><span class="mxp-tl">' + (out ? (rc.r[s].dnf && rc.r[s].dnf.why === "crash" ? "DNF" : "out") : counts[s]) + '</span><span class="mxp-tg">' + (i === 0 || out || lead === counts[s] ? "" : "-" + (lead - counts[s])) + "</span></li>";
      }).join("");
      layoutTower();
    }
    /* mxtime: what each phone's rider's cards were worth, read right after the battle (the data is gone by the time he ends the lap) */
    function captureFacts() {
      var rc = ui.rc; if (!rc || !rc.tm || !MX.Time || rc.tm.k <= factK) return;
      factK = rc.tm.k;
      rc.r.forEach(function (p, s) { if (kOfS(s) < 0) return; var f = MX.Time.facts(rc, s); if (f) (factsK[s] = factsK[s] || {})[f.k] = f; });
    }
    /* a person's rider ends a lap: the readout (the phone shows it, the TV logs one line) */
    function youLap(s, k) {
      var rc = ui.rc, kk = kOfS(s); if (!rc || !rc.tm || !MX.Time || kk < 0) return;
      var y; try { y = MX.Time.you(rc, s, k, factsK[s] && factsK[s][k] || null, nameOfSeat); } catch (x) { return; }
      youK[s] = y; logLine(nm(s) + ": " + y.line); pushSoon();
    }
    /* the events of the race clock, in order: a lap ended, a bike goes down, gets up, the yellow flag, a pass, a lapped rider, the fastest lap */
    function onTrackEvent(e) {
      var rc = ui.rc; if (!rc || !G || !rc.tm || !MX.Time) return;
      var T = MX.Time, me = function (s) { return kOfS(s) >= 0; };
      switch (e.e) {
        case "line": if (me(e.s)) youLap(e.s, e.k); break;
        case "down": if (!rv.is3D()) annShown("crash", { s: e.s }); H.sfx(e.kind === "out" ? "lose" : "bump"); logLine(T.eventLine(rc, e, nameOfSeat, me)); twMark = { fight: [e.s], until: Date.now() + 2500 }; renderTower(null); pushSoon(); break;
        case "up": logLine(T.eventLine(rc, e, nameOfSeat, me)); renderTower(null); pushSoon(); break;
        case "yellowOn": {
          stats.yellows++; chips();
          var by = (e.by || []).filter(function (x) { return rc.r[x]; }), outN = by.filter(function (x) { return rc.tm.r[x].dnf && rc.tm.r[x].dnf.why === "crash"; }).length, who = by.map(function (x) { var R = riderOfS(x); return "#" + R.plate + " " + R.name; });
          logLine(T.eventLine(rc, e, nameOfSeat, me)); pushSoon();
          banner("Yellow flag", (who.length > 2 ? who.length + " riders" : listNames(who)) + (outN ? (who.length > 1 ? " are" : " is") + " out of the race" : (who.length > 1 ? " go down and remount" : " goes down and remounts")) + " · no passing there next lap", dl(1500), "is-yellow", A.yflag());
          break; }
        case "yellowOff": chips(); pushSoon(); break;
        case "pass": if (e.pos <= 10 && !e.crash && !rv.is3D()) annShown("pass", { s: e.a, d: e.d, pos: e.pos }); { var pl = T.eventLine(rc, e, nameOfSeat, me); if (pl) logLine(pl); } break;
        case "lapped": if (!rv.is3D()) annShown("lapped", { s: e.s, by: e.by }); if (me(e.s) || me(e.by)) logLine(T.eventLine(rc, e, nameOfSeat, me)); break;
        case "fastest": if (e.k >= 3) logLine(T.eventLine(rc, e, nameOfSeat, me)); break;
      }
    }
    function cardHTML(id, up, cls) { return '<div class="mx-card' + (up && id != null ? " is-up" : "") + (id == null && !up ? " is-empty" : "") + (cls ? " " + cls : "") + '">' + A.cardInner(id) + "</div>"; }
    function flipEl(el, id, ms, zoom) {
      if (!el) return Promise.resolve();
      el.className = "mx-card is-up" + (el.classList.contains("is-top") ? " is-top" : ""); el.innerHTML = A.cardInner(id);
      if (reduced() || !el.animate) return Promise.resolve();
      var ps = [], inn = el.firstElementChild;
      try { ps.push(inn.animate([{ transform: "rotateY(180deg)" }, { transform: "rotateY(0deg)" }], { duration: ms, easing: "cubic-bezier(.3,.6,.25,1)" }).finished); } catch (e) { }
      if (zoom) try { ps.push(el.animate([{ transform: "scale(1)" }, { transform: "scale(1.18)", offset: .5 }, { transform: "scale(1)" }], { duration: Math.round(ms * 1.4), easing: "ease-in-out" }).finished); } catch (e) { }
      return Promise.all(ps).then(function () { }, function () { });
    }
    function pipCw(cols) { var rem = remPx(), W = rem * 15, Hh = rem * 9.4; return Math.round(Math.max(rem * 2.2, Math.min((W - rem) / Math.max(1, cols) * .55, (Hh - rem * 3.9) / 1.4))); }
    function drawDuel(winS) {
      var rc = ui.rc, el = $("mxpDuel"); if (!rc) { el.innerHTML = ""; return; }
      $("mxpWar").innerHTML = ""; el.hidden = false;
      var w = winS != null ? winS : ui.lastWin, c = w != null ? ui.lastCards[w] : null;
      el.style.setProperty("--cw", Math.round(remPx() * 3.6) + "px");
      el.innerHTML = '<span class="mxp-lapbig"><span>' + (rc.phase === "gate" ? "On the" : rc.over ? "The" : "Lap") + "</span><b>" + (rc.phase === "gate" ? "Gate" : rc.over ? "Flag" : Math.min(Math.max(ui.lap, 1), rc.o.len)) + "</b><span>" + (rc.phase === "gate" || rc.over ? "&nbsp;" : "of " + rc.o.len) + "</span></span>" +
        cardHTML(c, c != null, c != null ? "is-win" : "") +
        '<span class="mxp-dwho"><em>' + (c != null ? "Top card" : "Cards turn") + "</em>" + (c != null ? "<span>" + plateHTML(riderOfS(w)) + '<span class="mxp-sn">' + esc(nm(w)) + "</span></span>" : "<span>each lap</span>") + "</span>";
    }
    function drawWar(seats, fresh) {
      var el = $("mxpWar"), rc = ui.rc; $("mxpDuel").hidden = true;
      var ppl = seats.filter(function (s) { return kOfS(s) >= 0; }), rest = seats.filter(function (s) { return ppl.indexOf(s) < 0; });
      var vis = ppl.concat(rest).slice(0, 4), more = seats.length - vis.length;
      el.style.setProperty("--cw", pipCw(vis.length + (more ? .6 : 0)) + "px");
      el.innerHTML = vis.map(function (s) { var c = ui.lastCards[s]; return '<div class="mxp-fight" data-s="' + s + '"><span class="mxp-fight__who">' + plateHTML(riderOfS(s)) + '<span class="mxp-sn">' + esc(nm(s)) + '</span></span><div class="mxp-fight__pile">' + cardHTML(c, true, "is-top") + "</div></div>"; }).join("") + (more ? '<span class="mxp-more">+' + more + "</span>" : "");
      if (!fresh && rc && rc.tb) Array.prototype.forEach.call(el.querySelectorAll(".mxp-fight"), function (col) { var s = +col.getAttribute("data-s"), k = rc.tb.filter(function (t) { return t.s === s && !t.up; }).length; for (var d = 0; d < Math.min(3, k); d++) addBack(col, d); });
    }
    function colOf(s) { return $("mxpWar").querySelector('.mxp-fight[data-s="' + s + '"]'); }
    function addBack(col, d) {
      var pile = col.querySelector(".mxp-fight__pile"), top = pile.querySelector(".is-top"), b = document.createElement("div");
      b.className = "mx-card"; b.innerHTML = A.cardInner(null);
      var cw = parseFloat(getComputedStyle(pile).width) || 40;
      b.style.transform = "translate(" + Math.round(-cw * .16 * (3 - d)) + "px," + Math.round(cw * .03 * (3 - d)) + "px) rotate(" + (d % 2 ? 3 : -3) + "deg)";
      pile.insertBefore(b, top);
      if (!reduced() && b.animate) try { b.animate([{ opacity: 0, transform: "translate(0,-40%) rotate(0deg)" }, { opacity: 1, transform: b.style.transform }], { duration: sp(220), easing: "ease-out" }); } catch (e) { }
    }
    function pipNote(t, ms, hot) {
      var el = $("mxpNote"); if (!t) { el.className = "mxp-note"; el.innerHTML = ""; return Promise.resolve(); }
      var parts = String(t).split("|"); el.innerHTML = "<b>" + esc(parts[0]) + "</b>" + (parts[1] ? " · " + esc(parts[1]) : ""); el.className = "mxp-note is-on" + (hot ? " is-hot" : "");
      return ms ? wait(ms) : Promise.resolve();
    }
    function flash() { var fl = $("mxpFlash"); if (reduced() || !fl.animate) return; try { fl.animate([{ opacity: 0 }, { opacity: 1, offset: .25 }, { opacity: 0 }], { duration: sp(700), easing: "ease-out" }); } catch (e) { } }
    var bannerQ = Promise.resolve();
    function banner(t, s, ms, cls, icon) { var p = bannerQ.then(function () { return banner1(t, s, ms, cls, icon); }); bannerQ = p.then(null, function () { }); return p; }
    function banner1(t, s, ms, cls, icon) {
      var b = $("mxpBanner"); if (!b) return Promise.resolve();
      $("mxpBannerT").innerHTML = (icon ? icon + "<br>" : "") + esc(t); $("mxpBannerS").textContent = s || "";
      b.className = "mxp-banner is-on" + (cls ? " " + cls : "");
      if (!reduced() && b.animate) try { b.animate([{ opacity: 0, transform: "translate(-50%,0) scale(.85)" }, { opacity: 1, transform: "translate(-50%,0) scale(1)" }], { duration: sp(220), easing: "cubic-bezier(.2,.8,.3,1.2)" }); } catch (e) { }
      return wait(ms).then(function () { b.className = "mxp-banner"; });
    }
    function trackSync() {
      var rc = ui.rc; if (!rc) return;
      if (rv.ok && rv.modelOn()) return;   /* the clock places the riders */
      var counts = disp ? disp.cnt : rc.r.map(function (p) { return p.pk.length; }), outs = {};
      rc.r.forEach(function (p, s) { if (p.out && (!disp || disp.cnt[s] === 0)) outs[s] = 1; });
      rv.standings(ui.order.length ? ui.order : rc.r.map(function (p, s) { return s; }), counts, outs);
    }
    function head() {
      if (!G) { $("mxpTitle").textContent = D ? D.year + " " + LONG[D.series] : "Motocross War"; $("mxpSub").textContent = D ? D.cls + " · sign-up" : ""; $("mxpSkip").hidden = true; return; }
      var c = cal(), rc = ui.rc;
      $("mxpTitle").textContent = (c.city || c.venue) + (rc ? " · " + ui.label : "");
      $("mxpSub").textContent = "Round " + Math.min((rc ? ui.rnum : G.ri) + 1, G.cal.length) + " of " + G.cal.length + " · " + G.year + " " + SHORTS[G.series] + (rc ? " · " + rc.n + " riders · cards held" : "");
      $("mxpSkip").hidden = !rc || rc.over || ui.ph === "panel";
    }

    /* ---------- the race view for this race: the track, the riders in team colours, the red plate, the pace ---------- */
    function setupRace() {
      var rc = ui.rc, c = cal(), red = redId();
      rv.setTrack(G.series, (c.venue || "") + "|" + (c.city || "") + "|" + G.year);
      layoutPip();
      rv.setRiders(rc.r.map(function (p, s) { var R = riderOfS(s), m = A.mk(R.bike); return { s: s, color: m[0], accent: m[0] === "#f2f4f8" ? "#183a8c" : "#f2f2f6", plate: R.plate, red: R.id === red, me: kOfId(R.id) >= 0 }; }));
      hs3.seen = rc.phase !== "gate";
      rv.race3D(rc.tm ? { series: G.series, year: G.year, round: c.n || (G.ri + 1), cal: c, len: rc.o.len, lapT: rc.tm.p || lapMs() / 1000, night: night3D(),
        riders: rc.r.map(function (p, s) { var R = riderOfS(s), m = A.mk(R.bike); return { s: s, color: m[0], accent: m[0] === "#f2f4f8" ? "#183a8c" : (m[1] === "#0b0a12" ? "#16161c" : "#f2f2f6"), num: R.plate, name: R.name, red: R.id === red, me: kOfId(R.id) >= 0 }; }) } : null);   /* the 3D race rides the time model's clock only */
      rv.pace(lapMs(), firstMs());
      rv.onLap(leaderLap);
      rv.onEvent(onTrackEvent);
      rv.live(true);
      TWK.key = ""; factK = rc.tm ? rc.tm.k : 0; factsK = {}; youK = {};
      if (rc.phase === "gate") { rv.gate(true); if (rc.tm) rv.setModel(rc); $("mxpGate").style.display = ""; $("mxpGate").style.transform = ""; placeGate(); }
      else {
        $("mxpGate").style.display = "none";
        var parked = [], yel = null; rc.r.forEach(function (p, s) { if (p.dnf && p.dnf.why === "crash") parked.push({ s: s, sector: p.dnf.sector }); });
        if (rc.yellow && rc.yellow.lap >= rc.battle + 1) yel = { lap: rc.yellow.lap, s: rc.yellow.s && rc.yellow.s.length ? rc.yellow.s[0] : null, sector: rc.yellow.sector };
        rv.resume(rc.battle, rc.o.len, parked, yel); if (rc.tm) rv.setModel(rc); trackSync();
        rv.flag(rc.over ? "checkered" : rc.battle + 1 === rc.o.len ? "white" : null);
      }
      if (rc.tm) rv.setRate(modelRate(rc));
      ui.white = rc.phase !== "gate" && rc.battle + 1 >= rc.o.len ? raceKey() : null;
    }
    function raceKey() { return ui.rnum + "|" + ui.rkey; }
    function leaderLap(k) {
      var rc = ui.rc; if (!rc || rc.over) return;
      var lp = Math.min(k, rc.o.len); if (lp > ui.lap) ui.lap = lp;
      chips();
      if (k === rc.o.len && rc.o.len > 1 && ui.white !== raceKey()) { ui.white = raceKey(); rv.flag("white"); H.sfx("bell"); logLine("White flag: last lap!"); banner("White flag", "Last lap · " + k + " of " + rc.o.len, dl(1100), "is-calm", A.wflag()); }
    }
    /* ms until the next lap's cards turn: the riding clock, else (reduced motion) the plain clock from the last lap's turn */
    function lapWait() {
      var rc = ui.rc, T = rv.ready();
      if (T >= 0) return rv.modelOn() ? Math.max(0, T - (rv.is3D() ? Math.max(1500, dl(6000)) : 350)) : T > 0 ? T + Math.round(Math.min(lapMs() * .03, 1500)) : 0;   /* mxtime: the cards turn a moment before the leader's line, so the clock never waits for them (3D: a few seconds before: a war's cards take that long) */
      if (!ui.lapAt) return 0;
      var fm = rc.battle <= 1 ? firstMs() : 0; return Math.max(0, Math.round(ui.lapAt + (fm > 0 ? fm : lapMs()) - Date.now()));
    }

    /* ---------- the gate (War has no first player: the opening show of every race is the starting gate) ---------- */
    var skipGate = false;
    function onKey(ev) {
      var ok = ev.key === "Enter" || ev.key === " " || ev.keyCode === 13 || ev.keyCode === 23;
      if (ui.ph === "gate" && ok) { skipGate = true; ev.preventDefault(); ev.stopPropagation(); return; }
      if ((ev.key === "c" || ev.key === "C" || ev.key === "MediaPlayPause" || ev.keyCode === 179) && rv.is3D() && (ui.ph === "race" || ui.ph === "gate")) { var cn = rv.camNext(); if (cn) H.toast("Camera: " + cn); ev.preventDefault(); return; }   /* the 3D race's camera presets */
      if (panelT && !/^(Shift|Control|Alt|Meta)$/.test(ev.key)) stopCountdown();
    }
    document.addEventListener("keydown", onKey, true);
    function teamLine(rc) { var cnt = {}; rc.r.forEach(function (p, s) { var b = riderOfS(s).bike || "Privateer"; cnt[b] = (cnt[b] || 0) + 1; }); return Object.keys(cnt).sort(function (a, b) { return cnt[b] - cnt[a] || (a < b ? -1 : 1); }).map(function (b) { return b + " " + cnt[b]; }).join(" · "); }
    async function gateShow() {
      var rc = ui.rc; ui.ph = "gate"; skipGate = false; pushNow();
      status(ui.label + ": " + rc.n + " riders behind the gate");
      H.hint("OK: drop the gate now");
      logLine((cal().city || cal().venue) + " " + ui.label + ": " + rc.n + " riders behind the gate.");
      try { var rb = realBit(S.next(G)); if (rb) logLine(rb); } catch (e) { }
      H.sfx("bell");
      var b = banner(ui.label + " · on the gate", teamLine(rc), dl(2200), "is-calm");
      var gd = null, dropped = false;
      if (annOn()) {
        /* the announcers call the start (booth.js): the opening, the 30-second board, the board sideways, the drop; OK skips ahead (a second OK drops the gate at once) */
        gd = booth.gate({ G: G, label: ui.label, people: false, drop: function () { if (rv.holding() || rv.gateWait() > 0) return false; dropped = true; return true; },   /* (the 3D picture is not ready yet, or has shown the gate only a moment: the booth asks again at its next tick) */
          stage: function (n) { if (n === "board") banner("30-second board", "The riders are on the gate", dl(1700), "is-calm"); else if (n === "side") banner("Board sideways", "The gate drops any moment", dl(1500), "is-calm"); } });
        H.hint("OK: skip ahead to the gate drop");
      }
      if (gd) {
        while (!dropped && H.live()) { if (skipGate) { skipGate = false; gd.go(); } await raw(100); }
      } else {
        for (var t = 0; t < 26 && !skipGate && H.live(); t++) await wait(100);
        await b;
        if (!skipGate) { banner("30-second board", "The gate drops", dl(1200), "is-calm"); for (t = 0; t < 14 && !skipGate && H.live(); t++) await wait(100); }
      }
      if (rv.holding()) { status("The riders roll up to the gate..."); while (rv.holding() && H.live()) await raw(150); }   /* the 3D picture loads or warms its shaders: the gate drops once it can show it */
      while (rv.gateWait() > 0 && H.live()) await raw(Math.min(250, rv.gateWait() + 20));   /* (and once it has shown the riders at the gate a moment) */
      if (!H.live()) return;
      ui.ph = "race";
      var pre = rc.r.map(function (p) { return p.pk.length; });
      var r = S.apply(G, { t: "drop" });
      annFeed(r.ev || []);
      save();
      disp = { cnt: pre };
      await playEvents(r.ev || []);
      disp = null;
    }

    /* ---------- one lap (or one war): every rider at once. Phones: H.turn each (Flip, queued until the leader starts the lap); the
         computer seats, Auto and away phones flip by themselves; a phone still out at the line gets a grace, then its card turns ---------- */
    function keyOf(rc) { return rc.battle + ":" + rc.phase + ":" + rc.warN; }
    async function lapStep() {
      var rc = ui.rc, ph = rc.phase, need = RC.need(rc).slice(), key = keyOf(rc), intents = {}, asked = [];
      ui.step = G.ri + ":" + G.rkey + ":" + key; ui.need = need; ui.intents = intents;
      var stepNow = ui.step;
      need.forEach(function (s) {
        var k = kOfS(s); if (k < 0) { intents[s] = 1; return; }
        var c = SEATS[k].color;
        if (machine(k)) { intents[s] = 1; stats.autoActs++; return; }
        asked.push(c); stats.asks++;
        H.turn(c, phoneSt(c, ph === "war" ? "war" : "flip"), { title: ph === "war" ? (rc.warN > 1 ? warWordP(rc.warN) + "!" : "War!") : "Flip", sub: ph === "war" ? "Lay 3 down, turn the 4th" : "Lap " + Math.min(rc.battle + 1, rc.o.len) + " of " + rc.o.len, timeoutMs: window.__mxpTO || 0 }).then(function (r) {
          if (ui.step !== stepNow || !H.live()) return;
          if (r && r.id === "flip") stats.phoneActs++;
          intents[s] = 1; renderTower(null); pushSoon();
        });
      });
      renderTower(null); pushNow();
      var people = need.filter(function (s) { return !intents[s]; });
      H.hint(people.length ? (ph === "war" ? "Players in the war: flip on your phones" : "Players: Flip on your phones (your card turns as the leader starts the lap)") : "The riders ride the lap");
      var graceAt = 0, grace = Math.max(6000, dl(ph === "war" ? 9000 : 8000));
      for (;;) {
        if (!H.live()) return;
        if (rv.holding() && !skipQ && !rc.over) { if (!graceAt) status("The 3D race is getting ready: it goes on in a moment"); await raw(200); continue; }   /* a new 3D picture mid-race (a race picked up again): no lap's cards turn until it shows the race (its clock waits too) */
        rv.setWait(rv.is3D() || people.some(function (s) { return !intents[s]; }));   /* (3D: the clock always eases into a wait) */
        if (skipQ || rc.over) break;
        var rdy = ph === "flip" ? lapWait() : 0, all = need.every(function (s) { return intents[s]; });
        if (rdy <= 0 && all) break;
        if (rdy <= 0) {
          if (!graceAt) { graceAt = Date.now(); var late = need.filter(function (s) { return !intents[s]; }); status("Waiting for " + (late.length <= 3 ? listNames(late.map(nm)) : late.length + " riders") + " to flip"); }
          if (Date.now() - graceAt >= grace) break;
        }
        await raw(Math.max(60, Math.min(250, rdy > 0 ? rdy : 250)));
      }
      var late2 = need.filter(function (s) { return !intents[s]; });
      ui.step = null;
      asked.forEach(function (c) { H.interrupt(c); });
      if (skipQ) return;
      late2.forEach(function (s) { var k = kOfS(s); if (k >= 0) { stats.lateFlips++; H.info(SEATS[k].color, "Your card turned by itself at the line"); } });
      var pre = rc.r.map(function (p) { return p.pk.length; }), ev = [];
      need.forEach(function (s) { if (rc.over || keyOf(rc) !== key) return; if (intents[s] && RC.need(rc).indexOf(s) >= 0) { var r = S.apply(G, { t: "flip", s: s }); if (r.ok) ev = ev.concat(r.ev); } });
      if (!rc.over && keyOf(rc) === key) ev = ev.concat(S.step(G));
      try { if (BR) BR.observe(G, ev); } catch (e) { }
      captureFacts(); rv.setWait(false);
      annFeed(ev);   /* the booth hears the SAME events the screen now plays */
      ui.need = []; ui.intents = {};
      save();
      disp = { cnt: pre };
      await playEvents(ev);
      disp = null;
      if (!rc.over) { ui.order = RC.standings(rc).map(function (r) { return r.s; }); renderTower(null); chips(); }
      pushNow();
    }

    /* ---------- the events of a batch, in order (mxwar/game.js animEvent, on this screen) ---------- */
    async function playEvents(evs) {
      for (var i = 0; i < evs.length; i++) { if (!H.live()) return; var e = evs[i]; stats.events[e.e] = (stats.events[e.e] || 0) + 1; try { await animEvent(e); } catch (x) { stats.errors.push(String(x && x.message || x)); } }
    }
    function bestOf(cards) { var rc = ui.rc, best = -1, out = []; cards.forEach(function (x) { var v = RC.val(rc, x.c); if (v > best) { best = v; out = [x.s]; } else if (v === best) out.push(x.s); }); return out; }
    async function animEvent(e) {
      var rc = ui.rc; if (!rc) return;
      switch (e.e) {
        case "gate": {
          H.sfx("jail"); logLine("The gate drops!");
          var gt = $("mxpGate"), du = $("mxpDust");
          if (!reduced() && gt.animate) {
            try { gt.animate([{ transform: "rotate(0deg)" }, { transform: "rotate(-84deg)" }], { duration: sp(320), easing: "cubic-bezier(.55,0,.85,.35)", fill: "forwards" }); } catch (x) { }
            try { du.animate([{ opacity: 0, transform: "translateX(0)" }, { opacity: .95, offset: .3 }, { opacity: 0, transform: "translateX(30%)" }], { duration: sp(900), easing: "ease-out" }); } catch (x) { }
            await wait(340);
          }
          gt.style.display = "none"; if (gt.getAnimations) gt.getAnimations().forEach(function (a) { a.cancel(); });
          ui.lap = 1; rv.drop(rc.o.len); chips(); drawDuel(); pushNow();
          await wait(250); return;
        }
        case "acted": return;
        case "reveal": {
          if (e.w === 0) {
            ui.lapAt = Date.now(); ui.lastWin = null; ui.war = null; ui.warCards = {}; pipNote(null); rv.hold(null);
            e.cards.forEach(function (x) { ui.lastCards[x.s] = x.c; disp.cnt[x.s] = Math.max(0, disp.cnt[x.s] - 1); });
            H.sfx("card"); stats.laps++;
            drawDuel(null);
            var best = bestOf(e.cards), topEl = $("mxpDuel").querySelector(".mx-card");
            renderTower(null);
            if (topEl) await flipEl(topEl, ui.lastCards[best[0]], sp(360), false);
            await wait(best.length > 1 ? 260 : 200);
          } else {
            e.cards.forEach(function (x) { disp.cnt[x.s] = Math.max(0, disp.cnt[x.s] - (x.down + (x.held ? 0 : 1))); ui.lastCards[x.s] = x.c; var w = ui.warCards[x.s] || (ui.warCards[x.s] = { n: e.w, down: 0, up: null }); w.n = e.w; w.down += x.down; w.up = x.c; });
            for (var d = 0; d < 3; d++) { var any = false; e.cards.forEach(function (x) { var col = colOf(x.s); if (col && d < x.down) { addBack(col, d); any = true; } }); if (any) { H.sfx("discard"); await wait(150); } }
            renderTower({ fight: e.cards.map(function (x) { return x.s; }) }); pushSoon();
            await wait(220);
            var steps = []; e.cards.forEach(function (x) { var col = colOf(x.s); if (col && !x.held) { var top = col.querySelector(".mxp-fight__pile .is-top"); if (top) steps.push(flipEl(top, x.c, sp(420), true)); } });
            H.sfx("card"); await Promise.all(steps); await wait(260);
          }
          return;
        }
        case "war": {
          stats.wars++; H.sfx("cannon"); flash();
          var tiedR = e.tied.length && ui.lastCards[e.tied[0]] != null ? A.info(ui.lastCards[e.tied[0]]).r : 0;
          logLine((e.n > 1 ? "War again! " : "War! ") + whoList(e.tied) + " tie" + (tiedR ? " with " + rankPlural(tiedR) : "") + ".");
          ui.war = { n: e.n, seats: e.seats.slice(), tied: e.tied.slice() };
          drawWar(e.seats, true); renderTower({ fight: e.seats }); pushNow();
          if (rv.is3D()) { rv.hold({ war: e.seats }); banner(e.n === 1 ? "War!" : e.n === 2 ? "Double war!" : e.n === 3 ? "Triple war!" : warWordP(e.n) + "!", e.n === 1 ? "Card event · the winner gains time" : e.n === 2 ? "The loser crashes and remounts" : "The loser crashes out", dl(1300), "is-war"); }
          await pipNote(e.n === 1 ? "War!" : e.n === 2 ? "Double war!|crash, remount" : e.n === 3 ? "Triple war!|crash out" : warWordP(e.n) + "!|crash out", e.n > 1 ? 900 : 850, e.n > 1);
          return;
        }
        case "kitty": logLine(nm(e.s) + " also takes " + plural(e.n, "left-over card") + "."); return;
        case "crash": {
          stats.crashes++; var Rc = riderOfS(e.s);
          if (e.kind === "out") disp.cnt[e.s] = 0;
          ui.crashQ.push({ s: e.s, kind: e.kind, depth: e.depth });
          if (modelOn()) { var wc0 = ui.warCards[e.s]; if (wc0) wc0.lost = e.kind; renderTower({ fight: [e.s] }); pushSoon(); return; }   /* mxtime: the bike goes down on the clock (onTrackEvent) */
          rv.crash(e.s, e.kind); annShown("crash", { s: e.s });
          H.sfx(e.kind === "out" ? "lose" : "bump");
          logLine("Crash! #" + Rc.plate + " " + Rc.name + (e.kind === "out" ? " loses the " + warWordP(e.depth).toLowerCase() + " and is out of the race." : " loses the double war, goes down and remounts."));
          var wc = ui.warCards[e.s]; if (wc) wc.lost = e.kind;
          renderTower({ fight: [e.s] }); trackSync(); pushSoon();
          return;
        }
        case "crashCards": disp.cnt[e.s] += e.n; logLine(nm(e.s) + " takes the " + plural(e.n, "card") + " the crashed rider held."); renderTower(null); trackSync(); return;
        case "yellow": {
          var q = ui.crashQ; ui.crashQ = [];
          if (modelOn()) { chips(); return; }   /* mxtime: the flag comes out on the clock (onTrackEvent) */
          rv.yellow(e.lap, e.s, e.sector); chips();
          if (!q.length) return;
          stats.yellows++;
          var outN = q.filter(function (x) { return x.kind === "out"; }).length, who = q.map(function (x) { var R = riderOfS(x.s); return "#" + R.plate + " " + R.name; });
          logLine("Yellow flag: no passing there until the end of lap " + e.lap + ".");
          pushSoon();
          await banner("Yellow flag", (who.length > 2 ? who.length + " riders" : listNames(who)) + (outN ? (who.length > 1 ? " are" : " is") + " out of the race" : (who.length > 1 ? " go down and remount" : " goes down and remounts")) + " · no passing there", dl(1500), "is-yellow", A.yflag());
          return;
        }
        case "dnf": if (e.why === "crash") renderTower(null); return;
        case "short": e.seats.forEach(function (s) { disp.cnt[s] = 0; }); logLine(whoList(e.seats) + (e.seats.length > 1 ? " don't" : " doesn't") + " have enough cards for the war."); return;
        case "deadlock": rv.lap(ui.lap, rc.o.len); logLine(whoList(e.seats) + " tie with their last cards: " + plural(e.n, "card") + " set aside."); await banner("Dead heat", plural(e.n, "card") + " set aside", dl(800), "is-calm"); return;
        case "win": {
          disp.cnt[e.s] += e.n; ui.lastWin = e.s;
          var me = kOfS(e.s) >= 0;
          if (e.war) {
            var col = colOf(e.s); if (col) col.classList.add("is-win");
            Array.prototype.forEach.call($("mxpWar").querySelectorAll(".mxp-fight"), function (x) { if (x !== col) x.classList.add("is-lose"); });
            Object.keys(ui.warCards).forEach(function (s) { ui.warCards[s].won = +s === e.s; });
            var bl = null; try { bl = BR && BR.react(G, e); } catch (x) { } logLine(bl || nm(e.s) + " wins the war and " + plural(e.n, "card") + ".");
          } else {
            var tc = $("mxpDuel").querySelector(".mx-card"); if (tc) tc.classList.add("is-win");
            var dw = $("mxpDuel").querySelector(".mxp-dwho"); if (dw) dw.innerHTML = "<em>Top card</em><span>" + plateHTML(riderOfS(e.s)) + '<span class="mxp-sn">' + esc(nm(e.s)) + "</span></span>";
          }
          H.sfx(me ? "coin" : e.war ? "slide" : "tick");
          ui.order = RC.standings(rc).map(function (r) { return r.s; });
          renderTower({ win: e.s }); trackSync(); rv.lap(ui.lap, rc.o.len);
          await wait(e.war ? 520 : 300); return;
        }
        case "holeshot": {
          stats.holeshots++;
          var hl = null; try { hl = BR && BR.react(G, e); } catch (x) { }
          var R = riderOfS(e.s);
          if (rv.is3D()) { var hsS = e.s, rcH = rc; seenHs(12000).then(function () { if (!H.live() || ui.rc !== rcH || skipQ) return; ui.hs = hsS; chips(); H.sfx("bell"); logLine(hl || "Holeshot: " + nm(hsS) + "!"); pushSoon(); banner("Holeshot!", "#" + R.plate + " " + R.name + (R.bike ? " · " + R.bike : ""), dl(1100), "is-calm"); }); return; }   /* 3D: as the leader takes turn 1 on the picture (it calls the announcers itself) */
          ui.hs = e.s; chips(); H.sfx("bell"); annShown("holeshot", { s: e.s });
          logLine(hl || "Holeshot: " + nm(e.s) + "!");
          pushSoon();
          await banner("Holeshot!", "#" + R.plate + " " + R.name + (R.bike ? " · " + R.bike : ""), dl(1100), "is-calm"); return;
        }
        case "out": e.seats.forEach(function (s) { disp.cnt[s] = 0; }); logLine(whoList(e.seats) + (e.seats.length > 1 ? " are" : " is") + " out of cards."); if (e.seats.length === 1) say(e); renderTower(null); trackSync(); return;
        case "lead": say(e); return;
        case "next": {
          if (rv.ok && rv.ready() >= 0) return;   /* riding: the leader's own lap moves the counter and brings the white flag (leaderLap) */
          ui.lap = e.b; chips();
          if (e.b === rc.o.len && rc.o.len > 1 && ui.white !== raceKey()) { ui.white = raceKey(); rv.flag("white"); H.sfx("bell"); logLine("White flag: last lap!"); await banner("White flag", "Last lap · " + e.b + " of " + rc.o.len, dl(900), "is-calm", A.wflag()); }
          return;
        }
        case "flag": {
          /* the last lap's cards turned as it started: the field rides it out and the flag falls as the leader crosses the line */
          if (!skipQ) {
            status("Last lap: the riders ride to the flag.");
            for (var gi = 0; gi < 4800; gi++) { if (!H.live() || skipQ) break; if (rv.holding()) { await raw(250); continue; } var ms = rv.ok && rv.ready() >= 0 ? rv.untilLine(e.b) : ui.lapAt ? ui.lapAt + lapMs() - Date.now() : 0; if (ms <= 0) break; await raw(Math.min(ms, 250)); }   /* (holding: the 3D picture is getting ready and the clock waits with it) */
          }
          ui.lap = Math.min(e.b, rc.o.len); rv.lap(e.b, rc.o.len); rv.flag("checkered"); if (!rv.is3D()) annShown("checkered", { s: e.order[0] });   /* (3D: the picture calls it as the winner crosses the line) */
          var w = e.order[0], hw = kOfS(w) >= 0;
          ui.order = e.order.slice(); chips(); renderTower({ win: w }); drawDuel(w);
          /* [bcast] the checkered fanfare (MX War Theme) on a Main or the round's last race; a heat keeps today's effect */ bcFlag(hw ? "win" : "conquer"); /* [/bcast] */ pushNow();
          await banner("Checkered flag", nm(w) + " wins" + (e.why === "all" ? ": every card" : ""), dl(1500), "is-flag", A.flag());
          return;
        }
        case "raceDone": { ui.lastDone = e; var rl = null; try { rl = BR && BR.react(G, e); } catch (x) { } logLine(rl ? rl + " (" + e.label + ")" : (G.riders[e.order[0]] || {}).name + " wins " + e.label + "."); return; }
        case "roundDone": ui.pendRound = e; return;
        case "seasonOver": ui.pendSeason = e; return;
      }
    }

    /* ---------- a race: the gate, the laps, the flag ---------- */
    async function raceShow() {
      var rc = G.race; ui.rmap = G.rmap.slice(); ui.cal = G.cal[G.ri]; ui.rc = rc; ui.label = raceLabel(); ui.rnum = G.ri; ui.rkey = G.rkey; ui.hs = rc.hs >= 0 ? rc.hs : null; ui.lastCards = {}; ui.war = null; ui.warCards = {}; ui.lastWin = null; ui.lapAt = 0; ui.lastDone = null; ui.crashQ = []; skipQ = false; disp = null;
      ui.order = RC.standings(rc).map(function (r) { return r.s; }); ui.lap = rc.phase === "gate" ? 0 : Math.min(rc.battle + 1, rc.o.len); ui.need = []; ui.intents = {};
      if (rc.lastLap && rc.lastLap.c) Object.keys(rc.lastLap.c).forEach(function (s) { ui.lastCards[s] = rc.lastLap.c[s]; });
      hidePanel(); ui.ph = rc.phase === "gate" ? "gate" : "race"; ui.pinfo = null; stats.races++;
      /* [bcast] no music from the gate to the flag (the booth runs the start procedure; engines and the booth only) */ if (BCM) BCM.at("race"); /* [/bcast] */
      head(); renderTower(null); layoutTower(); setupRace(); chips();
      if (rc.phase === "war" && rc.part && rc.part.length) { ui.war = { n: rc.warN, seats: rc.part.slice(), tied: [] }; drawWar(rc.part, false); } else { $("mxpWar").innerHTML = ""; pipNote(null); drawDuel(); }
      pushNow();
      if (rc.phase === "gate") await gateShow();
      else { status("Welcome back: " + ui.label + ", lap " + ui.lap + " of " + rc.o.len); await banner("Welcome back", ui.label + " · lap " + ui.lap + " of " + rc.o.len, dl(1400), "is-calm"); }
      var fails = 0;
      while (H.live() && !rc.over) {
        if (skipQ) {
          skipQ = false; ui.ph = "race";
          var ev = S.simRace(G); try { if (BR) BR.observe(G, ev); } catch (e) { } annFeed(ev); save();
          ui.order = RC.standings(rc).map(function (r) { return r.s; }); ui.lap = rc.o.len; disp = null; renderTower(null); chips(); rv.flag("checkered");
          await playEvents(ev.filter(function (e) { return e.e === "raceDone" || e.e === "roundDone" || e.e === "seasonOver"; }));
          var w = ui.order[0]; drawDuel(w); await banner("Checkered flag", nm(w) + " wins (skipped to the finish)", dl(1300), "is-flag", A.flag());
          break;
        }
        try { await lapStep(); }
        catch (x) { stats.errors.push("lap: " + (x && x.message || x)); try { console.warn("mxwar party: a lap failed", x); } catch (y) { } if (++fails > 2) skipQ = true; else await wait(400); }
      }
      if (!H.live()) return null;
      $("mxpSkip").hidden = true; closeSkipSheet();
      return ui.lastDone;
    }
    /* "Skip to the finish" asks on a sheet (as the phone game does: a real-length race is long, one press must not throw it away):
       Keep watching is the main button; Back or the scrim closes it. Without BGUI.sheet it falls back to a second press. */
    function skipNow() { if (!ui.rc || ui.rc.over || ui.ph === "panel" || ui.ph === "signup") return; ui.skipArm = 0; skipQ = true; $("mxpSkip").textContent = "Skipping..."; status("Skipping to the finish..."); }
    function closeSkipSheet() { var B = window.BGUI, el = document.getElementById("mxpSkipSheet"); if (!el) return; try { if (B && B.sheet && B.sheet.isOpen(el)) B.sheet.close(el); } catch (e) { } if (el.parentNode) el.parentNode.removeChild(el); }
    function openSkipSheet() {
      var B = window.BGUI, rc = ui.rc; if (!B || !B.sheet || !rc) return false;
      closeSkipSheet();
      var el = document.createElement("section"); el.className = "bg-sheet ps-rj"; el.id = "mxpSkipSheet"; el.setAttribute("aria-labelledby", "mxpSkipT"); document.body.appendChild(el);
      var c = cal(), left = Math.max(0, rc.o.len - rc.battle), mine = rc.r.some(function (p, s) { return riderOfS(s).kind === "human"; });
      el.innerHTML = '<div class="bg-sheet__grip" aria-hidden="true"></div><div class="bg-sheet__head"><div><span class="bg-eyebrow">' + esc((c.city || c.venue) + " · " + ui.label) + '</span><h2 class="bg-sheet__title" id="mxpSkipT">Skip to the finish?</h2>' +
        '<p class="bg-sheet__sub">' + (rc.phase === "gate" ? "The whole race" : plural(left, "lap") + " to go") + ". The cards decide the rest at once, as War always does" + (mine ? ", the table riders’ cards too" : "") + ", and everyone sees the result.</p></div></div>" +
        '<div class="pm-acts"><button type="button" class="bg-btn bg-btn--primary bg-btn--lg" id="mxpSkipNo" data-autofocus>Keep watching</button><button type="button" class="bg-btn bg-btn--secondary bg-btn--lg" id="mxpSkipYes">Skip to the finish</button></div>';
      var close = function () { if (B.sheet.isOpen(el)) B.sheet.close(el); };
      document.getElementById("mxpSkipNo").onclick = close;
      document.getElementById("mxpSkipYes").onclick = function () { close(); skipNow(); };
      B.sheet.open(el, { dismissible: true, focus: "#mxpSkipNo" });
      return true;
    }
    $("mxpSkip").onclick = function () {
      var rc = ui.rc; if (!rc || rc.over || ui.ph === "panel" || ui.ph === "signup") return;
      if (openSkipSheet()) return;
      if (Date.now() - ui.skipArm > 4000) { ui.skipArm = Date.now(); $("mxpSkip").textContent = "Press again to skip"; H.toast("Skip to the finish? The cards decide the rest of " + ui.label + " at once. Press again to skip."); setTimeout(function () { if ($("mxpSkip")) $("mxpSkip").textContent = "Skip to the finish"; }, 4000); return; }
      skipNow();
    };

    /* ---------- the panels: sign-up, results, podium, standings (focusable buttons; a countdown picks the main one) ---------- */
    var panelRes = null;
    /* the next race's 3D world (the course, the stadium, the track) is built while a panel shows (rv.prepare: short tasks), so the next gate only adds the riders */
    var prepT = 0;
    function prepNext() {
      clearTimeout(prepT);
      prepT = setTimeout(function () {
        if (!G || G.over || ui.rc || !H.live()) return;
        var nx = null; try { nx = S.next(G); } catch (e) { nx = null; } if (!nx || nx.t !== "race") return;
        var c = G.cal[Math.min(G.ri, G.cal.length - 1)];
        rv.prepare({ series: G.series, year: G.year, round: c.n || (G.ri + 1), cal: c, lapT: nx.lapS || lapMs() / 1000 });
      }, 1500);
    }
    function hidePanel() { stopCountdown(); var p = $("mxpPanel"); if (p) { p.hidden = true; p.innerHTML = ""; } if ($("mxp")) $("mxp").classList.remove("is-panel"); panelRes = null; }
    function stopCountdown() { if (!panelT) return; clearInterval(panelT); panelT = 0; var b = $("mxpPanel") && $("mxpPanel").querySelector("[data-cd]"); if (b) { var s = b.querySelector("small"); if (s) s.textContent = b.getAttribute("data-sub") || ""; } }
    function panel(o) {
      stopCountdown();
      /* [bcast] */ bcPanel(o.kind); /* [/bcast] */
      var p = $("mxpPanel"); ui.ph = o.ph || "panel"; ui.pinfo = o.info || null; ui.rc = o.keepRace ? ui.rc : null; stats.panels.push(o.kind);
      if (!o.keepRace) { rv.live(false); chips(); prepNext(); }
      p.innerHTML = '<div class="mxp-ph"><div><span class="bg-eyebrow" data-stage-text>' + esc(o.eyebrow || "") + '</span><h2 id="mxpPTitle">' + esc(o.title || "") + "</h2>" + (o.sub ? "<p>" + o.sub + "</p>" : "") + "</div>" + (o.sum || "") + "</div>" +
        '<div class="mxp-pbody" id="mxpPBody">' + (o.body || "") + "</div>" +
        '<div class="mxp-acts">' + (o.buttons || []).map(function (b, i) { return '<button type="button" class="bg-btn bg-btn--lg ' + (i === 0 ? "bg-btn--primary" : "bg-btn--secondary") + '" data-pb="' + esc(b.id) + '"' + (i === 0 && o.countdown ? ' data-cd="1"' : "") + ' data-sub="' + esc(b.sub || "") + '">' + esc(b.label) + (b.sub || (i === 0 && o.countdown) ? "<small>" + esc(b.sub || "") + "</small>" : "") + "</button>"; }).join("") + "</div>";
      p.hidden = false; p.setAttribute("data-kind", o.kind || ""); $("mxp").classList.add("is-panel");
      if (H.paintIcons) H.paintIcons(p);
      fitPanel();
      head(); $("mxpSkip").hidden = true; closeSkipSheet();
      status(o.status || o.title || ""); H.hint(o.hint || "OK: " + ((o.buttons && o.buttons[0] && o.buttons[0].label) || "continue"));
      pushNow();
      return new Promise(function (res) {
        panelRes = res;
        Array.prototype.forEach.call(p.querySelectorAll("[data-pb]"), function (b) { b.onclick = function () { if (panelRes !== res) return; var id = b.getAttribute("data-pb"); if (o.onClick && o.onClick(id) === false) return; panelRes = null; stopCountdown(); res(id); }; });
        var first = p.querySelector("[data-pb]"); setTimeout(function () { if (first && first.isConnected) setFocus(first); }, 60);
        if (o.countdown && first && !reduced()) {
          var left = Math.max(5, Math.round(dl(o.countdown) / 1000));
          var tick = function () { var sm = first.querySelector("small"); if (sm) sm.textContent = (first.getAttribute("data-sub") ? first.getAttribute("data-sub") + " · " : "") + "in " + left + " s"; };
          tick();
          panelT = setInterval(function () { if (!H.live() || panelRes !== res) { stopCountdown(); return; } if (document.hidden) return; left--; tick(); if (left <= 0) { stopCountdown(); first.click(); } }, 1000);
        } else if (o.countdown && first) {
          panelT = setInterval(function () { if (!H.live() || panelRes !== res) { stopCountdown(); return; } stopCountdown(); first.click(); }, dl(o.countdown));
        }
      });
    }
    /* lists in the panel: as many rows as fit (the rows' height from the room), in 1-3 columns */
    function fitPanel() {
      var body = $("mxpPBody"); if (!body) return; var rem = remPx();
      if (body.querySelector("[data-lu]")) { fitLineup(); return; }
      Array.prototype.forEach.call(body.querySelectorAll(".mxp-res"), function (ol) {
        var rowsN = ol.children.length; if (!rowsN) return;
        var room = (ol.getAttribute("data-room") ? +ol.getAttribute("data-room") * body.clientHeight : body.clientHeight) - 2;
        var maxCols = +(ol.getAttribute("data-cols") || 3), rh = rem * 1.7, cols = 1;
        while (cols < maxCols && Math.ceil(rowsN / cols) * (rh + rem * .2) > room) cols++;
        var per = Math.ceil(rowsN / cols);
        rh = clamp(Math.floor((room - (per - 1) * rem * .2) / per), Math.round(rem * 1.25), Math.round(rem * 2));
        ol.style.setProperty("--cols", String(cols)); ol.style.setProperty("--rows", String(per)); ol.style.setProperty("--rh", rh + "px");
      });
    }
    function resLi(id, place, extra) { var R = G.riders[id], k = kOfId(id); return '<li class="' + (k >= 0 ? "is-me" : "") + '"' + (k >= 0 ? ' style="--seat:' + hex(k) + '"' : "") + '><span class="mxp-rp">' + place + "</span>" + plateHTML(R) + '<span class="mxp-rn">' + nameHTML(R) + "</span>" + (extra || "") + "</li>"; }
    /* a long list: the rows that fit, then the table's riders below them (their real place kept) */
    function capRows(ids, max) {
      if (ids.length <= max) return ids.map(function (id, i) { return { id: id, p: i + 1 }; });
      var out = ids.slice(0, max - 1).map(function (id, i) { return { id: id, p: i + 1 }; }), shown = {}; out.forEach(function (x) { shown[x.id] = 1; });
      var mine = []; ids.forEach(function (id, i) { if (!shown[id] && kOfId(id) >= 0) mine.push({ id: id, p: i + 1 }); });
      if (mine.length) { out = out.slice(0, Math.max(1, max - 1 - mine.length)); out.push({ sep: true }); out = out.concat(mine); }
      return out;
    }
    function resultTags(e, id, p) {
      var t = "";
      if (e.toMain && e.toMain.indexOf(id) >= 0) t = '<span class="mxp-tag">' + (e.kind === "main" || e.kind === "moto" ? "Main" : "to the " + (roundFinals(e) === "moto" ? "motos" : "Main")) + "</span>";
      else if (e.toNext && e.toNext.indexOf(id) >= 0) t = '<span class="mxp-tag mxp-tag--next">to the ' + esc(nextStage(e)) + "</span>";
      else if (e.out && e.out.indexOf(id) >= 0) t = '<span class="mxp-tag mxp-tag--out">out</span>';
      if (e.dnf && e.dnf[id] && e.dnf[id].why === "crash") t += '<span class="mxp-tag mxp-tag--dnf">DNF lap ' + e.dnf[id].lap + "</span>";
      else if (e.crashes && e.crashes[id]) t += '<span class="mxp-tag mxp-tag--cr">' + (e.crashes[id] > 1 ? e.crashes[id] + " crashes" : "crashed") + "</span>";
      var pts = racePoints(e, p); if (pts) t += '<span class="mxp-tag mxp-tag--pts">+' + pts + "</span>";
      return t;
    }
    function nextStage(e) { try { var F = S.calFormat(G, G.cal[e.ri]), qi = -1; F.qual.forEach(function (q, i) { if (q.kind === e.kind) qi = i; }); var nx = F.qual[qi + 1]; return nx ? nx.label : "next race"; } catch (x) { return "next race"; } }
    function roundFinals(e) { try { return S.calFormat(G, G.cal[e.ri]).finals.kind; } catch (x) { return G.formats[G.fmt].finals.kind; } }
    function racePoints(e, p) { if (e.kind !== "main" && e.kind !== "moto") return 0; var c = G.cal[e.ri]; if (!c || !c.title) return 0; var F = S.calFormat(G, c); if (F.pointsOn !== "race") return 0; return ((F.table || [])[p] || 0) * (c.mult || 1); }
    /* the next race: its label, the people in it (the phones), and what the buttons offer (watch / sim) */
    function nextRace() {
      if (G.over) return null;
      if (!G.round) { S.startRound(G); stats.rounds++; save(); }
      var nx = S.next(G), RG = G.round, ent = RD.entrants(RG) || [];
      var phones = ent.filter(function (id) { var k = kOfId(id); return k >= 0 && H.isPhone(SEATS[k].color); }).length;
      var final = nx.kind === "main" || nx.kind === "moto", c = nx.round;
      var watch = phones > 0 || final || effOpts(cfg).others !== "sim";
      var sub = (c.city || c.venue) + " · " + plural(nx.len, "lap") + (nx.lapS ? " · about " + Math.max(1, Math.round(nx.len * nx.lapS / 60)) + " min" : "") + (phones ? " · " + plural(phones, "phone") + " in it" : " · no phones in it");
      var btns = [];
      if (watch) btns.push({ id: "watch", label: (phones || final ? "Next: " : "Watch ") + nx.label, sub: sub });
      if (!phones) btns.push({ id: "sim", label: "Sim " + nx.label, sub: watch ? "The cards decide it at once" : sub });
      if (!watch) btns.reverse();
      return { nx: nx, phones: phones, final: final, buttons: btns, sub: sub };
    }
    async function goNext(choice) {
      if (choice === "sim") {
        var ev = S.simRace(G); try { if (BR) BR.observe(G, ev); } catch (e) { } stats.simmed++; annFeed(ev);
        var done = null; ev.forEach(function (e) { if (e.e === "raceDone") done = e; if (e.e === "roundDone") ui.pendRound = e; if (e.e === "seasonOver") ui.pendSeason = e; });
        save(); return { done: done, simmed: true };
      }
      if (!G.race) { var ev0 = S.startRace(G); annFeed(ev0); save(); }   /* the race event opens the show */
      var d2 = await raceShow(); return { done: d2, simmed: false };
    }
    /* mxfix1: the results line says a table player's win like a win ("Ann wins Moto 2!") and a podium like a podium, as the phone game does */
    function resultLine(e) {
      var fin = e.kind === "main" || e.kind === "moto", wid = e.order[0], won = kOfId(wid) >= 0;
      var mine = e.order.map(function (id, i) { return kOfId(id) >= 0 && i > 0 ? G.riders[id].name + " " + ord(i + 1) + (fin && i < 3 ? " (podium)" : "") : null; }).filter(Boolean);
      var t = G.riders[wid].name + (won ? " wins " + e.label + "!" : " wins") + (mine.length ? " · " + mine.join(" · ") : "");
      return won || (fin && e.order.slice(1, 3).some(function (id) { return kOfId(id) >= 0; })) ? '<b class="mxp-winline">' + esc(t) + "</b>" : esc(t);
    }
    async function resultsPanel(e, simmed) {
      var c = G.cal[e.ri], last = G.last || {};
      ui.lastRes = { label: e.label, order: e.order.slice(), city: c.city || c.venue };
      var TX = e.tm || last.tm || null, Tt = MX.Time, tmap = {}, topT = null;
      if (TX && Tt) TX.rows.forEach(function (r) { tmap[r[0]] = { laps: r[1], t: r[2], dnf: !!r[3] }; if (topT == null && !r[3]) topT = r; });
      function timeCell(id, i) { var x = tmap[id]; if (!x || !topT) return ""; if (x.dnf) return "DNF"; if (i === 0) return Tt.fmtRace(x.t); var dl0 = topT[1] - x.laps; return dl0 > 0 ? "+" + dl0 + (dl0 > 1 ? " Laps" : " Lap") : Tt.fmtGap((x.t - topT[2]) / 1000); }
      var fastTxt = TX && TX.best ? "Fastest lap: #" + G.riders[TX.best.id].plate + " " + G.riders[TX.best.id].name + " " + Tt.fmtLap(TX.best.t) + " (lap " + TX.best.k + ")" : "";
      var rowsX = capRows(e.order, 40).map(function (x) { var tc = x.sep ? "" : timeCell(x.id, x.p - 1); return x.sep ? '<li class="is-sep" aria-hidden="true">...</li>' : resLi(x.id, x.p, (tc ? '<span class="mxp-rt">' + esc(tc) + "</span>" : "") + resultTags(e, x.id, x.p - 1)); }).join("");
      var nxt = ui.pendRound ? null : nextRace();
      var btns = ui.pendRound ? [{ id: "podium", label: "The podium", sub: (c.city || c.venue) + ": 1st, 2nd and 3rd" }] : nxt ? nxt.buttons : [];
      btns.push({ id: "stand", label: "Season standings" });
      for (;;) {
        var ch = await panel({ kind: "results", eyebrow: "Round " + (e.ri + 1) + " of " + G.cal.length + " · " + (c.city || c.venue) + (simmed ? " · simmed" : ""), title: e.label + " results",
          sub: resultLine(e),
          sum: '<div class="mxp-sum"><span class="mxp-chip is-hot">Holeshot: ' + esc(e.hs != null ? G.riders[e.hs].name : "none") + '</span><span class="mxp-chip">' + plural(last.wars || 0, "war") + '</span><span class="mxp-chip">' + plural(last.battles || 0, "lap") + "</span>" + (TX && topT ? '<span class="mxp-chip">Race time ' + esc(Tt.fmtRace(topT[2])) + "</span>" : "") + (fastTxt ? '<span class="mxp-chip">' + esc(fastTxt) + "</span>" : "") + "</div>",
          body: '<ol class="mxp-res" aria-label="Results">' + rowsX + "</ol>", buttons: btns, countdown: 20000,
          info: { kind: "results", title: e.label + " results", res: resultsFor(e) } });
        if (ch !== "stand") return ch;
        await standingsPanel(false);
      }
    }
    function resultsFor(e) { var out = {}; e.order.forEach(function (id, i) { var k = kOfId(id); if (k >= 0) { var tg = e.toMain && e.toMain.indexOf(id) >= 0 ? (e.kind === "main" || e.kind === "moto" ? "" : "to the " + (roundFinals(e) === "moto" ? "motos" : "Main")) : e.toNext && e.toNext.indexOf(id) >= 0 ? "to the " + nextStage(e) : e.out && e.out.indexOf(id) >= 0 ? "out of the night" : ""; out[SEATS[k].color] = { p: i + 1, of: e.order.length, tag: tg, dnf: !!(e.dnf && e.dnf[id] && e.dnf[id].why === "crash"), pts: racePoints(e, i) }; } }); return { label: e.label, win: G.riders[e.order[0]].name, mine: out, fin: e.kind === "main" || e.kind === "moto" }; }
    function bikeBox(R) { var m = A.mk(R.bike); return '<span class="mxp-pod__bike">' + A.bike(m[0], m[0] === "#f2f4f8" ? "#183a8c" : "#f2f2f6") + "</span>"; }
    function podiumHTML(ids, sub) {
      return [1, 0, 2].map(function (k) { var id = ids[k]; if (!id) return '<div class="mxp-pod__c"></div>'; var R = G.riders[id];
        return '<div class="mxp-pod__c' + (kOfId(id) >= 0 ? " is-me" : "") + '" data-p="' + (k + 1) + '" style="' + A.mkStyle(R.bike) + '">' + bikeBox(R) + plateHTML(R) + '<span class="mxp-pod__nm">' + nameHTML(R) + '</span><span class="mxp-pod__x">' + esc(sub(id, k)) + '</span><span class="mxp-pod__step">' + (k + 1) + "</span></div>"; }).join("");
    }
    async function podiumPanel() {
      ui.pendRound = null; stats.podiums++;
      var res = G.results[G.results.length - 1]; if (!res) return;
      var c = G.cal[res.ri], L = S.standings(G), top = L.length ? L[0].pts : 0;
      /* [bcast] the podium's music (Megasong's finish) plays instead of the old fanfare when the package is on */ if (!(BCM && BCM.plays())) H.sfx("win"); /* [/bcast] */
      var B = BG(); if (B && B.celebrate && !reduced()) try { B.celebrate(); } catch (e) { }
      var tops = '<ol class="mxp-res" data-cols="1" aria-label="Season standings">' + L.slice(0, 5).map(function (r) { return resLi(r.id, r.place, '<span class="mxp-rx">' + r.pts + (r.place > 1 ? " · -" + (top - r.pts) : " pts") + "</span>"); }).join("") + "</ol>";
      await panel({ kind: "podium", eyebrow: "Round " + (res.ri + 1) + " of " + G.cal.length + " · " + (c.venue || c.city), title: (c.city || c.venue) + " podium",
        sub: esc(G.riders[res.cls[0]].name + " wins the night" + (c.title ? "" : " (no points: an exhibition)")),
        body: '<div class="mxp-podwrap"><div class="mxp-pod">' + podiumHTML(res.cls, function (id) { return res.pts[id] ? "+" + res.pts[id] + " pts" : (c.title ? "" : "exhibition"); }) + "</div>" + tops + "</div>",
        buttons: [{ id: "go", label: G.over ? "The champion" : "Season standings" }], countdown: 15000,
        info: { kind: "podium", title: (c.city || c.venue) + " podium", pod: res.cls.slice(0, 3).map(function (id) { return G.riders[id].name; }) } });
    }
    async function standingsPanel(withNext) {
      var L = S.standings(G), top = L.length ? L[0].pts : 0, nxt = withNext ? nextRace() : null;
      var rowsX = capRows(L.map(function (r) { return r.id; }), 48).map(function (x) { if (x.sep) return '<li class="is-sep" aria-hidden="true">...</li>'; var r = L[x.p - 1]; return resLi(r.id, r.place, '<span class="mxp-rx">' + r.pts + (r.place > 1 ? " · -" + (top - r.pts) : " pts") + "</span>"); }).join("");
      var btns = nxt ? nxt.buttons.slice() : [{ id: "back", label: "Back to the results" }];
      var info = { kind: "standings", title: "Season standings", next: nxt ? (nxt.nx.round.city || nxt.nx.round.venue) + " · " + nxt.nx.label : "" };
      return panel({ kind: "standings", eyebrow: G.year + " " + LONG[G.series] + " · " + G.cls, title: "Season standings", sub: esc("After " + plural(G.results.length, "round") + " of " + G.cal.length + (L.length && L[0].pts > 0 ? " · the red plate: " + L[0].name : "")),
        body: '<ol class="mxp-res" aria-label="Season standings">' + rowsX + "</ol>", buttons: btns, countdown: nxt ? 20000 : 0, info: info });
    }
    /* a race in real life, one line (the phone game's realLine, short): its laps, the winner, the winning time */
    function realBit(nx) {
      var R = nx && nx.real; if (!R || !(R.w || R.l > 0 || R.t)) return "";
      var t = [], tm = R.t ? String(R.t).replace(/\.\d+$/, "") : "";
      if (R.l > 0) t.push(plural(R.l, "lap"));
      if (R.w) t.push((tm ? "won in " + tm + " by " : "won by ") + R.w); else if (tm) t.push("won in " + tm);
      return nx.label + " in real life: " + t.join(", ") + ".";
    }
    /* ---------- the heat line-up before the round's first gate (mxwar/game.js openLineup; the CEO ~18:25: "at the start of the heat races,
         there has to be an equal amount of teams"): tonight's heats as round.js balanced them by team, each with its team counts and riders ---------- */
    function lineupDue() { var RG = G && G.round; return !!(RG && !G.over && !G.race && !(RG.cur > 0) && !RG.races.some(function (r) { return r.res; }) && ui.lineSeen !== G.ri); }
    var luCols = null;
    function fitLineup() {
      var body = $("mxpPBody"); if (!body || !luCols) return; var rem = remPx(), gap = rem * .2;
      Array.prototype.forEach.call(body.querySelectorAll("ol[data-lu]"), function (ol) {
        var col = luCols[+ol.getAttribute("data-lu")]; if (!col) return;
        ol.innerHTML = ""; ol.style.removeProperty("--rows");
        var room = ol.clientHeight, cols = +(ol.getAttribute("data-cols") || 1), per = Math.max(3, Math.floor((room + gap) / (rem * 1.25 + gap)));
        var rowsX = capRows(col.ids, per * cols), shown = Math.ceil(rowsX.length / cols);
        var rh = clamp(Math.floor((room - (shown - 1) * gap) / Math.max(1, shown)), Math.round(rem * 1.25), Math.round(rem * 1.9));
        ol.style.setProperty("--cols", String(cols)); ol.style.setProperty("--rows", String(shown)); ol.style.setProperty("--rh", rh + "px");
        ol.innerHTML = rowsX.map(function (x) { if (x.sep) return '<li class="is-sep" aria-hidden="true">...</li>'; var R = G.riders[x.id]; return resLi(x.id, x.p, '<span class="mx-mk" style="' + A.mkStyle(R.bike) + '">' + esc(R.bike || "Privateer") + "</span>"); }).join("");
      });
    }
    async function lineupPanel(ch) {
      ui.lineSeen = G.ri;
      var RG = G.round, c = G.cal[G.ri], F = RG.F, heats = RG.races.filter(function (r) { return r.st === 0 && r.ent; }), cols = [];
      if (heats.length) { var sp = RD.teamSplit(RG, 0); heats.forEach(function (r, i) { cols.push({ label: r.label, ids: r.ent.slice(), teams: (sp[i] || {}).teams || {}, rule: RG.st[0].toMain ? "top " + RG.st[0].toMain + " to the " + (F.finals.kind === "moto" ? "motos" : F.finals.label) : RG.st[0].toNext && RG.st[0].toNext !== "rest" ? "top " + RG.st[0].toNext + " move on" : "" }); }); }
      else { var t = {}; (RG.fin || []).forEach(function (id) { var m = G.riders[id].bike || "Privateer"; t[m] = (t[m] || 0) + 1; }); cols.push({ label: (RG.races[0] || {}).label || "The gate", ids: (RG.fin || []).slice(), teams: t, rule: F.finals.kind === "moto" ? "the motos, the overall by points" : "" }); }
      luCols = cols;
      var per = cols.length === 1 ? 3 : cols.length === 2 ? 2 : 1, mine = {}, mineW = [];
      G.humans.forEach(function (h, k) { var col = cols.filter(function (x) { return x.ids.indexOf(h) >= 0; })[0], lab = col ? col.label : F.direct ? "seeded to the motos" : ""; if (lab) { mine[SEATS[k].color] = lab; mineW.push(G.riders[h].name + ": " + lab); } });
      var body = '<div class="mxp-lu" style="--lu-cols:' + cols.length + '">' + cols.map(function (col, i) {
        var tm = Object.keys(col.teams).sort(function (a, b) { return col.teams[b] - col.teams[a] || (a < b ? -1 : 1); });
        return '<section class="mxp-lu__col"><h3 class="mxp-lu__h">' + esc(col.label) + " <span>" + esc(plural(col.ids.length, "rider") + (col.rule ? " · " + col.rule : "")) + "</span></h3>" +
          '<p class="mxp-lu__tm">' + tm.map(function (m) { return '<span class="mx-mk" style="' + A.mkStyle(m) + '">' + esc(m + " " + col.teams[m]) + "</span>"; }).join("") + "</p>" +
          '<ol class="mxp-res" data-lu="' + i + '" data-cols="' + per + '" aria-label="' + esc(col.label) + '"></ol></section>';
      }).join("") + "</div>";
      var nx = nextRace(), btns = nx.buttons.slice().sort(function (a, b) { return (a.id === ch ? 0 : 1) - (b.id === ch ? 0 : 1); }), rb = realBit(nx.nx);
      var title = heats.length > 1 ? "Tonight's heats" : heats.length ? "Tonight's " + heats[0].label : "The gate";
      var p = panel({ kind: "lineup", eyebrow: "Round " + (G.ri + 1) + " of " + G.cal.length + " · " + (c.city || c.venue), title: title,
        sub: esc((heats.length > 1 ? "Balanced by team: every team's riders split as evenly as they can be over the heats, the top seeds alternating as in qualifying." : "Every rider on the gate, in gate-pick order.") + (mineW.length ? " " + (mineW.length > 4 ? plural(mineW.length, "rider") + " from this table" : mineW.join(" · ")) + "." : "") + (rb ? " " + rb : "")),
        body: body, buttons: btns, countdown: 20000, info: { kind: "lineup", title: title, mine: mine, next: (c.city || c.venue) + " · " + nx.nx.label } });
      var res = await p; luCols = null; return res;
    }

    /* ---------- the sign-up: every phone picks a team and a free number (the computer seats get theirs) ---------- */
    function takenList(k) {
      var out = [];
      Object.keys(ui.su.taken).forEach(function (num) { out.push([+num, ui.su.taken[num]]); });
      ui.picks.forEach(function (p, j) { if (j !== k && p.ready && p.num != null) out.push([p.num, p.name + " (this table)"]); });
      return out.sort(function (a, b) { return a[0] - b[0]; });
    }
    function numFree(num, k) {
      if (!(num >= 0 && num <= 999)) return "Pick a number from 0 to 999.";
      if (ui.su.taken[num]) return "#" + num + " is taken in " + ui.su.year + ": " + ui.su.taken[num] + " rides it.";
      for (var j = 0; j < ui.picks.length; j++) if (j !== k && ui.picks[j].ready && ui.picks[j].num === num) return "#" + num + " is " + ui.picks[j].name + "'s number.";
      return "";
    }
    function freeNum(k, near) {
      var used = {}, j; Object.keys(ui.su.taken).forEach(function (x) { used[x] = 1; }); for (j = 0; j < ui.picks.length; j++) if (j !== k && ui.picks[j].num != null) used[ui.picks[j].num] = 1;
      if (near >= 0 && near <= 999 && !used[near]) return near;
      for (var t = 0; t < 400; t++) { var x = 2 + Math.floor(Math.random() * 98); if (!used[x]) return x; }
      for (x = 2; x < 1000; x++) if (!used[x]) return x; return 999;
    }
    function renderSignup() {
      if (ui.ph !== "signup") return;
      var box = $("mxpSu"); if (!box) return;
      box.style.setProperty("--cols", String(n > 12 ? 4 : n > 6 ? 3 : n > 2 ? 2 : Math.max(1, n)));
      box.innerHTML = ui.picks.map(function (p, j) {
        var c = SEATS[j].color, cpu = !H.isPhone(c), tok = esc((p.name.trim().charAt(0) || "?").toUpperCase());
        return '<div class="mxp-suc' + (p.ready ? " is-ready" : "") + '" style="' + H.seatStyle(hex(j)) + '"><span class="mxp-tok" aria-hidden="true">' + tok + "</span><b>" + esc(p.name) + (cpu ? cpuIco() : "") + "</b>" +
          "<span>" + (p.ready ? '<span class="mx-pl" style="' + A.mkStyle(p.bike) + '">' + p.num + "</span>" : "") + (p.bike ? '<span class="mx-mk" style="' + A.mkStyle(p.bike) + '">' + esc(p.bike) + "</span>" : "") + (p.ready ? "" : cpu ? "Computer" : H.isAway(c) ? "Away: picked for them" : "Choosing on the phone...") + "</span></div>";
      }).join("");
      var t = $("mxpTeams"); if (t) { var cnt = {}; ui.picks.forEach(function (p) { if (p.bike) cnt[p.bike] = (cnt[p.bike] || 0) + 1; }); t.innerHTML = Object.keys(cnt).map(function (b) { return '<span class="mx-mk" style="' + A.mkStyle(b) + '">' + esc(b) + '</span><span class="mxp-cnt">' + cnt[b] + "</span>"; }).join(" "); }
    }
    async function signup() {
      var si = seasonInfo(cfg.sid), makes = makesOf(D), taken = {};
      D.riders.forEach(function (r) { if (r.num != null && r.ns !== "a" && !taken[r.num]) taken[r.num] = r.name + (r.bike ? " (" + r.bike + ")" : ""); });
      ui.su = { year: D.year, series: SHORTS[D.series], makes: makes, taken: taken };
      ui.picks = SEATS.map(function (s, j) { return { name: H.name(s.color), num: null, bike: makes[j % makes.length], ready: false, err: "" }; });
      ui.ph = "signup";
      SEATS.forEach(function (s, j) { if (!H.isPhone(s.color)) { var p = ui.picks[j]; p.bike = makes[Math.floor(Math.random() * Math.min(makes.length, 7))]; p.num = freeNum(j, -1); p.ready = true; } });
      var done = false, resolveAll = null, allIn = new Promise(function (r) { resolveAll = r; });
      function check() { if (!done && ui.picks.every(function (p) { return p.ready; })) { setTimeout(function () { if (!done) resolveAll("all"); }, dl(1400)); } }
      function autoPick(j) { var p = ui.picks[j]; if (p.ready) return; p.num = freeNum(j, p.want); p.ready = true; p.err = ""; }
      function askSeat(j) {
        var c = SEATS[j].color; if (done || !H.isHuman(c)) { autoPick(j); renderSignup(); pushSoon(); check(); return; }
        ui.picks[j].askN = (ui.picks[j].askN || 0) + 1; ui.step = "signup"; stats.asks++;
        H.turn(c, phoneSt(c, "signup"), { title: "Your bike", sub: "Pick a team and a number", timeoutMs: window.__mxpSuTO || 90000 }).then(function (r) {
          if (done || !H.live()) return;
          var p = ui.picks[j];
          if (r && r.id === "ready") {
            var d = r.data || {}, num = d.num === "" || d.num == null ? null : Math.floor(+d.num);
            if (d.bike && makes.indexOf(d.bike) >= 0) p.bike = d.bike;
            if (num == null) { p.num = freeNum(j, -1); p.ready = true; p.err = ""; }
            else { var bad = numFree(num, j); if (bad) { p.err = bad; p.want = null; renderSignup(); askSeat(j); return; } p.num = num; p.ready = true; p.err = ""; }
            stats.phoneActs++;
          } else autoPick(j);
          renderSignup(); pushNow(); check();
        });
      }
      var phonesN = SEATS.filter(function (s) { return H.isPhone(s.color); }).length;
      var pr = panel({ kind: "signup", ph: "signup", eyebrow: D.year + " " + LONG[D.series] + " · " + D.cls + " · sign-up", title: "Riders, pick your number and team",
        sub: esc("On your phones: a team (the makes of " + D.year + ") and a number free that season (the real riders keep theirs). Then the season's real riders fill the gate" + (si ? ": " + si.riders + " of them" : "") + "."),
        body: '<div class="mxp-su" id="mxpSu"></div><p class="mxp-teams" id="mxpTeams"></p>', buttons: [{ id: "go", label: "Start the season", sub: phonesN ? "It starts by itself when every rider is ready" : "" }],
        hint: "Players: pick your number and team on your phones", info: { kind: "signup" } });
      renderSignup();
      SEATS.forEach(function (s, j) { if (H.isPhone(s.color)) askSeat(j); });
      check();
      var why = await Promise.race([pr, allIn]);
      done = true; ui.step = null;
      SEATS.forEach(function (s, j) { if (!ui.picks[j].ready) { H.interrupt(s.color); autoPick(j); } });
      renderSignup();
      try { localStorage.setItem("bg_mxwar_party_last", JSON.stringify({ sid: cfg.sid, n: n })); } catch (e) { }
      return ui.picks.map(function (p) { return { name: p.name, num: p.num, bike: p.bike }; });
    }
    /* season.js takes up to 8 people (Season.MAXH); the Party seats 9 to 16 join the season the way newSeason adds its people: a free
       number (an ASSIGNED number of a real rider is free to take: that rider gets another), their name and team, kind "human". */
    function addRiders(Gs, list) {
      var used = {}, names = {}, id;
      for (id in Gs.riders) { var R = Gs.riders[id]; if (R.plate != null) used[R.plate] = id; if (R.kind === "human") names[R.name.toLowerCase()] = 1; }
      function free() { for (var t = 0; t < 500; t++) { var x = 2 + Math.floor(Math.random() * 998); if (used[x] == null) return x; } for (x = 2; x < 1000; x++) if (used[x] == null) return x; return 999; }
      list.forEach(function (h) {
        var k = Gs.humans.length, hid = "h" + k, name = String(h.name || "Rider " + (k + 1)).trim().slice(0, 24) || "Rider " + (k + 1), base = name, j = 2;
        while (names[name.toLowerCase()]) name = base + " " + (j++);
        names[name.toLowerCase()] = 1;
        var num = Math.floor(+h.num); if (!(num >= 0 && num <= 999)) num = null;
        if (num != null && used[num] != null) { var o = Gs.riders[used[num]]; if (o && o.kind === "pro" && o.plateGen) { o.plate = null; delete used[num]; var nn = free(); o.plate = nn; used[nn] = o.id; } else num = null; }
        var gen = num == null; if (gen) num = free();
        Gs.riders[hid] = { id: hid, name: name, kind: "human", seat: k, plate: num, plateGen: gen, bike: h.bike ? String(h.bike).slice(0, 20) : null, country: null, pos: null };
        used[num] = hid; Gs.humans.push(hid);
      });
    }

    /* ================= start ================= */
    layoutPip();
    if (sv) {
      G = JSON.parse(JSON.stringify(sv.G)); stats.resumed = true;
      if (booth) booth.newSeason(sv.ann && sv.ann.v === 1 ? sv.ann : null);   /* the announcers: a fresh commentator with what the saved season remembered */
      try { if (D && S.attachTiming) S.attachTiming(G, D); else S.upgrade(G); } catch (e) { }
      if (G.lenNote) {   /* an old save's race under way now runs its real length (season.js): said once, as mxwar/game.js lenWords does */
        var ln = G.lenNote; delete G.lenNote;
        var lw = ln.half ? "half its real length" : "its real length";
        setTimeout(function () { if (H.live()) H.toast(ln.done >= ln.real ? "This race now runs " + lw + ": " + plural(ln.real, "lap") + ". " + ln.done + " are done, so the checkered flag falls this lap." : "This race now runs " + lw + ": " + plural(ln.len, "lap") + (ln.done > 0 ? " (" + ln.done + " done)" : "") + "."); }, 2600);
      }
      G.humans.forEach(function (hid, k) { var c = SEATS[k].color; if (H.isPhone(c)) G.riders[hid].name = H.name(c); });
      G.o.skill = H.skill();
      ui.ph = "panel"; head();
    } else {
      var humans = await signup(); if (!H.live()) return;
      var opts = { length: cfg.length, war: warOpts(cfg), fill: effOpts(cfg).fill, nonTitle: effOpts(cfg).nonTitle, skill: H.skill() }, MAXH = S.MAXH || 8;
      G = S.newSeason(D, IDX, opts, humans.slice(0, MAXH));
      if (humans.length > MAXH) addRiders(G, humans.slice(MAXH));
      var chk = S.check(G); if (chk.length) stats.errors.push("check: " + chk.join("; "));
      save();
    }
    head(); pushNow();
    /* the season: race (or sim) -> its results -> (the round's last race) the podium and the standings -> the next race */
    var pend = null;
    while (H.live() && !G.over) {
      var r;
      if (G.race) r = { done: await raceShow(), simmed: false };
      else {
        var ch = pend; pend = null;
        if (!ch) {
          if (!G.results.length && !(G.round && G.round.races.some(function (x) { return x.res; }))) {
            var nx0 = nextRace(), cl = G.cal;
            ch = await panel({ kind: "season", eyebrow: G.year + " " + LONG[G.series] + " · " + G.cls, title: plural(cl.length, "round") + ", " + G.roster.length + " real riders",
              sub: esc("Round 1: " + (cl[0].city || cl[0].venue) + (cl[0].date ? ", " + fmtDate(cl[0].date) : "") + ". Tonight: " + progWords(G.round.F) + "."),
              body: '<ol class="mxp-res" aria-label="The calendar">' + cl.map(function (c, i) { return '<li><span class="mxp-rp">' + (i + 1) + '</span><span class="mxp-rn">' + esc((c.city || c.venue) + (c.venue && c.city ? " · " + c.venue : "")) + '</span><span class="mxp-rx">' + esc(c.date ? fmtDate(c.date) : "") + (c.title ? "" : " · no points") + "</span></li>"; }).join("") + "</ol>",
              buttons: nx0.buttons, countdown: 20000, info: { kind: "season", title: G.year + " " + SHORTS[G.series], next: (cl[0].city || cl[0].venue) + " · " + nx0.nx.label } });
          } else ch = await standingsPanel(true);
        }
        if (!H.live()) return;
        if (ch !== "sim") ch = "watch";
        if (lineupDue()) { var lc = await lineupPanel(ch); if (!H.live()) return; if (lc === "sim" || lc === "watch") ch = lc; }
        r = await goNext(ch);
      }
      if (!H.live()) return;
      if (!r.done) continue;
      var after = await resultsPanel(r.done, r.simmed);
      if (!H.live()) return;
      if (ui.pendRound) {
        await podiumPanel(); if (!H.live()) return;
        if (G.over) break;
        pend = await standingsPanel(true); if (!H.live()) return;
      } else pend = after === "sim" ? "sim" : "watch";
    }
    if (!H.live()) return;
    /* ---- the season's end: the champion's podium, then the Victory ---- */
    try { if (BR && BR.learn) BR.learn(G); } catch (e) { }
    lsSet(KEY, null);
    var L = S.standings(G), ch0 = G.riders[L[0].id];
    ui.ph = "over";
    H.sfx("win"); var Bc = BG(); if (Bc && Bc.celebrate && !reduced()) try { Bc.celebrate(); } catch (e) { }
    await panel({ kind: "final", ph: "over", eyebrow: G.year + " " + LONG[G.series] + " · " + G.cls + " · season over", title: ch0.name + " is the " + G.year + " champion",
      sub: esc("#" + ch0.plate + (ch0.bike ? ", " + ch0.bike : "") + " · " + plural(L[0].pts, "point") + " and " + plural(L[0].wins || 0, "win") + " in " + plural(G.cal.length, "round") + "."),
      body: '<div class="mxp-podwrap"><div class="mxp-pod">' + podiumHTML(L.slice(0, 3).map(function (r) { return r.id; }), function (id) { var x = L.filter(function (q) { return q.id === id; })[0]; return plural(x.pts, "pt"); }) + "</div>" +
        '<ol class="mxp-res" data-cols="2" aria-label="Final standings">' + capRows(L.map(function (r) { return r.id; }), 16).map(function (x) { if (x.sep) return '<li class="is-sep" aria-hidden="true">...</li>'; var r = L[x.p - 1]; return resLi(r.id, r.place, '<span class="mxp-rx">' + r.pts + "</span>"); }).join("") + "</ol></div>",
      buttons: [{ id: "go", label: "The Victory" }], countdown: 12000, info: { kind: "final", title: ch0.name + " is the champion", pod: L.slice(0, 3).map(function (r) { return G.riders[r.id].name; }) } });
    if (!H.live()) return;
    hidePanel(); ui.pinfo = { kind: "final", title: ch0.name + " is the champion", pod: L.slice(0, 3).map(function (r) { return G.riders[r.id].name; }) };
    status(ch0.name + " is the " + G.year + " champion"); H.hint("Season over");
    pushNow();
    H.over(ch0.name);
    var mp = $("mxp"); if (mp) mp.classList.add("is-over");
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
