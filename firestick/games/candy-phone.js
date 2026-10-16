/* CANDY LAND in Party Mode: the phone side (firestick/games/README.md; the TV side is games/candy.js).
   A phone shows whose turn it is, a big Draw when it is this player's turn (with "Draw two, choose one": the two cards to tap, each with
   where it leads and the best one marked), the last card played, this player's hint (squares to go, stuck / a lost turn, the chance the next
   card wins near the end, the shortcuts and sticky squares one card away) and the standings in places 1..N.
   The cards are drawn on the TV (the engine never takes a card from a phone); the card pictures are candy/board.js's own art.
   Text >= 12 px, targets >= 44 px. */
(function () {
  "use strict";
  var P = window.PartyGames; if (!P) return;
  var ID = "candy", shown = null;   // the last line shown (kept while the TV plays the next card)
  var SW = { red: "#e5324a", purple: "#8e4fd8", yellow: "#f6c330", blue: "#2f8fe8", orange: "#f5862a", green: "#36b653" };
  var CW = { R: "red", P: "purple", Y: "yellow", B: "blue", O: "orange", G: "green" };
  function css() {
    if (document.getElementById("cdph-css")) return;
    var st = document.createElement("style"); st.id = "cdph-css";
    st.textContent = [
      ".cdph{width:100%;max-width:26rem;margin:0 auto;display:grid;gap:.875rem;text-align:center}",
      ".cdph-who{display:flex;align-items:center;justify-content:center;gap:.6rem;margin:0}",
      ".cdph-who .bg-token{flex:none;width:2.5rem;height:2.5rem;font:var(--fw-caps) var(--fs-md)/1 var(--font-ui)}",
      ".cdph-who h1{margin:0;font:400 var(--fs-2xl)/1.15 var(--font-display);color:var(--text-1)}",
      ".cdph-draw{flex-direction:column;gap:.15rem;min-height:5.5rem !important;font-size:var(--fs-2xl) !important;letter-spacing:.02em}",
      ".cdph-draw small{display:block;margin-top:.15rem;font:var(--fw-ui) var(--fs-sm)/1.2 var(--font-ui);opacity:.9}",
      ".cdph-pick{display:grid;gap:.75rem}",
      ".cdph-card{display:flex !important;align-items:center;justify-content:flex-start !important;gap:.75rem;min-height:6.5rem;padding:.5rem .75rem !important;text-align:left;white-space:normal}",
      ".cdph-card .cd-cardsvg,.cdph-card .cdph-sw{flex:none;width:3.4rem;height:auto;display:block}",
      ".cdph-card > span{display:grid;gap:.15rem;min-width:0}",
      ".cdph-card b{font:var(--fw-ui-strong) var(--fs-lg)/1.2 var(--font-ui)}",
      ".cdph-card small{font:var(--fw-ui) var(--fs-sm)/1.3 var(--font-ui);opacity:.92}",
      ".cdph-card .bg-tag{justify-self:start}",
      ".cdph-card.is-best{box-shadow:inset 0 0 0 3px var(--gold-200)}",
      ".cdph-sw{aspect-ratio:100 / 140;border-radius:.4rem;background:#fffaf2;box-shadow:inset 0 0 0 2px #d9c2a2}",
      ".cdph-wait{display:flex;align-items:center;justify-content:center;gap:.75rem;min-height:5.5rem;margin:0;padding:.75rem 1rem;border-radius:var(--r-lg);background:var(--ink-2);box-shadow:var(--well-edge);font:var(--fw-ui-strong) var(--fs-md)/1.35 var(--font-ui);color:var(--text-1)}",
      ".cdph-last{display:flex;align-items:center;gap:.6rem;margin:0;text-align:left;font:var(--fw-ui) var(--fs-sm)/1.4 var(--font-ui);color:var(--text-2)}",
      ".cdph-last .cd-cardsvg,.cdph-last .cdph-sw{flex:none;width:2.2rem;height:auto;display:block}",
      ".cdph-hint{display:grid;gap:.35rem;margin:0;padding:.75rem .875rem;border-radius:var(--r-md);background:var(--ink-2);box-shadow:var(--well-edge);text-align:left;list-style:none}",
      ".cdph-hint li{font:var(--fw-ui) var(--fs-sm)/1.35 var(--font-ui);color:var(--text-1)}",
      ".cdph-hint li b{color:var(--gold-100);font-weight:var(--fw-ui-strong)}",
      ".cdph-hint li.is-bad b{color:#ffb4a6}",
      ".cdph-hint li.is-good b{color:#c9f59a}",
      ".cdph .ph-stand{max-width:none}",
      ".cdph-stand li.is-me{box-shadow:inset 0 0 0 2px var(--seat, var(--gold-300))}",
      ".cdph-foot{margin:0;font:var(--fw-ui) var(--fs-xs)/1.35 var(--font-ui);color:var(--text-2)}"
    ].join("\n");
    document.head.appendChild(st);
  }
  function BD() { return window.Candy && window.Candy.Board; }
  /* a card picture: candy/board.js's art (its shared gradients are added once), or a plain swatch if that file did not load */
  function cardHTML(cd) {
    var b = BD();
    if (b && b.cardSVG) { try { if (b.defs) b.defs(); return b.cardSVG(cd); } catch (e) { } }
    var c = cd && cd.c ? SW[CW[cd.c]] : "#ff8fc4";
    return '<span class="cdph-sw" aria-hidden="true" style="background:linear-gradient(180deg,' + c + ',' + c + ')"></span>';
  }
  function hintHTML(st) {
    var h = st.hint; if (!h) return "";
    var out = [];   // [class, html]: only numbers and fixed words, plus names escaped below
    var e = function (t) { return String(t).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); };
    if (h.pos === 0) out.push(["", "You are at the start: " + st.goal + " squares to the Sugarspire."]);
    else out.push(["", "You are on square <b>" + h.pos + "</b>: " + h.left + " to go."]);
    if (h.stuck) out.push(["is-bad", "Stuck: you need a <b>" + h.stuck + "</b> card to get out."]);
    if (h.skip) out.push(["is-bad", "Licorice: you lose your <b>next turn</b>."]);
    if (h.near && h.pWin > 0) out.push(["is-good", "Your next " + (st.older ? "draw" : "card") + " wins <b>" + h.pWin + "%</b> of the time."]);
    if (h.near && st.exact) out.push(["", "To win you need <b>" + e(st.last) + "</b> on the last square."]);
    (h.ahead || []).forEach(function (a) {
      out.push(a.kind === "shortcut" ? ["is-good", "One card away: the <b>" + e(a.name || "shortcut") + "</b> at square " + a.at + "."] : ["is-bad", "One card away: <b>" + e(a.name || "a sticky square") + "</b> at square " + a.at + "."]);
    });
    return '<ul class="cdph-hint" aria-label="Your hint">' + out.map(function (t) { return "<li" + (t[0] ? ' class="' + t[0] + '"' : "") + ">" + t[1] + "</li>"; }).join("") + "</ul>";
  }
  function standHTML(st, esc) {
    return '<ol class="ph-stand cdph-stand" aria-label="Standings">' + (st.stand || []).map(function (r) {
      var p = st.pl[r.s]; if (!p) return "";
      var v = p.done ? "Home!" : p.pos ? "Square " + p.pos : "Start";
      return '<li data-seat="' + p.seat + '"' + (r.s === st.me ? ' class="is-me"' : "") + '><span class="ph-stand__n">' + r.place + '</span><span class="bg-token" data-seat="' + p.seat + '" style="width:1.5rem;height:1.5rem;font-size:12px" aria-hidden="true">' + esc((p.n.trim().charAt(0) || "?").toUpperCase()) + '</span><span class="ph-stand__nm">' + esc(p.n) + (r.s === st.me ? " (you)" : "") + (p.cpu ? " · computer" : "") + '</span><span class="ph-stand__v">' + v + "</span></li>";
    }).join("") + "</ol>";
  }
  P.definePhone(ID, {
    show: function (st, ask, api) {
      css();
      var esc = api.esc, me = st.me, who = st.busy && st.mover >= 0 ? st.mover : st.cur, cur = st.pl[who] || {}, mine = !st.over && who === me;
      var a = api.ask && api.ask.st, mode = !st.busy && !st.afk && mine && api.asking() && a && a.step === st.step && a.phase === st.phase ? a.ask : null;   // only a LIVE ask for this position
      var head = mode === "pick" ? "Choose a card" : mode === "draw" ? "Your turn" : st.over ? "Game over" : mine ? "Your turn" : esc(cur.n) + "’s turn";
      var tokSeat = mine || st.over ? (st.pl[me] || {}).seat : cur.seat, tokName = mine || st.over ? (st.pl[me] || {}).n : cur.n;
      var html = '<div class="pgph cdph">' + (st.afk ? api.afkHTML("cdTake") : "") +
        '<div class="cdph-who"><span class="bg-token" data-seat="' + (tokSeat || 1) + '" aria-hidden="true">' + esc(((tokName || "?").trim().charAt(0) || "?").toUpperCase()) + '</span><h1>' + head + "</h1></div>";
      if (mode === "draw") html += '<button type="button" class="opt bg-btn bg-btn--block opt--seat cdph-draw" data-seat="' + (st.pl[me] || {}).seat + '" id="cdDraw">Draw<small>' + (st.older ? "Draw two cards, then choose one" : "Draw the top card") + "</small></button>";
      else if (mode === "pick" && st.hand && st.hand.length === 2) {
        html += '<div class="cdph-pick" role="group" aria-label="Your two cards">' + st.hand.map(function (h, i) {
          return '<button type="button" class="opt bg-btn bg-btn--block opt--seat cdph-card' + (h.best ? " is-best" : "") + '" data-seat="' + (st.pl[me] || {}).seat + '" data-i="' + i + '">' + cardHTML(h.cd) +
            "<span><b>Play " + esc(h.w) + "</b><small>" + esc(h.out) + (h.best ? " · fewest turns home" : "") + "</small>" + (h.best ? '<span class="bg-tag bg-tag--accent">best</span>' : "") + "</span></button>";
        }).join("") + "</div>";
      }
      else if (st.busy) html += '<p class="cdph-wait" role="status"><span>' + (who === me ? (st.afk ? "The computer is playing your card." : "Your card is on the TV.") + " Watch the TV!" : esc(cur.n) + (st.phase === "choose" && st.hand && st.hand.length ? " looks at two cards." : " draws.") + " Watch the TV.") + "</span></p>";
      else if (!st.over) html += '<p class="cdph-wait" role="status"><span>' + (mine ? (st.afk ? "The computer plays this turn for you." : st.phase === "choose" ? "Get ready to choose a card…" : "Get ready to draw…") : esc(cur.n) + (cur.cpu ? " (computer)" : "") + (st.phase === "choose" ? " is choosing a card." : " is drawing.") + " Watch the TV.") + "</span></p>";
      // what happened last: while the TV still plays a card, the phone keeps the line before it (the new line would spoil the move)
      if (!st.busy) shown = st.line ? { line: st.line, cd: st.lc && st.lc.cd } : null;
      if (shown) html += '<p class="cdph-last">' + (shown.cd ? cardHTML(shown.cd) : "") + "<span>" + esc(shown.line) + "</span></p>";
      if (!st.over && me >= 0 && !(st.pl[me] || {}).done) html += hintHTML(st);
      html += standHTML(st, esc);
      html += '<p class="cdph-foot">' + esc(st.ver) + " · Turn " + st.turn + " · " + st.deck + " cards in the pile</p></div>";
      api.put(html);
      var db = document.getElementById("cdDraw");
      if (db) db.onclick = function () {
        if (!api.act("draw", { t: Date.now() })) return;
        db.disabled = true; db.innerHTML = "Drawing…<small>Watch the TV</small>";
      };
      Array.prototype.forEach.call(api.main.querySelectorAll(".cdph-card"), function (b) {
        b.onclick = function () {
          var i = +b.getAttribute("data-i");
          if (!api.act("pick", { i: i })) return;
          Array.prototype.forEach.call(api.main.querySelectorAll(".cdph-card"), function (x) { x.disabled = true; });
          b.querySelector("small").textContent = "Playing this card. Watch the TV";
        };
      });
      var tk = document.getElementById("cdTake"); if (tk) tk.onclick = function () { api.take(); tk.disabled = true; };
      if (mode) api.focusFirst();
    },
    reset: function () { shown = null; }
  });
})();
