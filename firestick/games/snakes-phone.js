/* SNAKES AND LADDERS in Party Mode: the phone side (firestick/games/README.md; the TV side is games/snakes.js).
   A phone shows whose turn it is, a big Roll (Spin on the American board) when it is this player's turn, what the last roll did, this
   player's hint (squares to go, the exact roll that wins, the ladders and snakes one roll away) and the standings in places 1..N.
   The roll itself happens on the TV (the engine never takes a number from a phone). Text >= 12 px, targets >= 44 px. */
(function () {
  "use strict";
  var P = window.PartyGames; if (!P) return;
  var ID = "snakes";
  function css() {
    if (document.getElementById("snph-css")) return;
    var st = document.createElement("style"); st.id = "snph-css";
    st.textContent = [
      ".snph{width:100%;max-width:26rem;margin:0 auto;display:grid;gap:.875rem;text-align:center}",
      ".snph-who{display:flex;align-items:center;justify-content:center;gap:.6rem;margin:0}",
      ".snph-who .bg-token{flex:none;width:2.5rem;height:2.5rem;font:var(--fw-caps) var(--fs-md)/1 var(--font-ui)}",
      ".snph-who h1{margin:0;font:400 var(--fs-2xl)/1.15 var(--font-display);color:var(--text-1)}",
      ".snph-sub{margin:0;font:var(--fw-body) var(--fs-md)/1.4 var(--font-ui);color:var(--text-2)}",
      ".snph-roll{flex-direction:column;gap:.15rem;min-height:5.5rem !important;font-size:var(--fs-2xl) !important;letter-spacing:.02em}",
      ".snph-roll small{display:block;margin-top:.15rem;font:var(--fw-ui) var(--fs-sm)/1.2 var(--font-ui);opacity:.9}",
      ".snph-wait{display:flex;align-items:center;justify-content:center;gap:.75rem;min-height:5.5rem;margin:0;padding:.75rem 1rem;border-radius:var(--r-lg);background:var(--ink-2);box-shadow:var(--well-edge);font:var(--fw-ui-strong) var(--fs-md)/1.35 var(--font-ui);color:var(--text-1)}",
      ".snph-wait .bg-die{flex:none;width:3rem;height:3rem}",
      ".snph-spin{flex:none;display:inline-grid;place-items:center;width:3rem;height:3rem;border-radius:50%;background:#0b0a12;box-shadow:inset 0 0 0 2px var(--gold-200);font:400 var(--fs-xl)/1 var(--font-display);color:var(--gold-100)}",
      ".snph-last{margin:0;font:var(--fw-ui) var(--fs-sm)/1.4 var(--font-ui);color:var(--text-2)}",
      ".snph-hint{display:grid;gap:.35rem;margin:0;padding:.75rem .875rem;border-radius:var(--r-md);background:var(--ink-2);box-shadow:var(--well-edge);text-align:left;list-style:none}",
      ".snph-hint li{font:var(--fw-ui) var(--fs-sm)/1.35 var(--font-ui);color:var(--text-1)}",
      ".snph-hint li b{color:var(--gold-100);font-weight:var(--fw-ui-strong)}",
      ".snph-hint li.is-snake b{color:#ffb4a6}",
      ".snph-hint li.is-ladder b{color:#c9f59a}",
      ".snph .ph-stand{max-width:none}",
      ".snph-stand li.is-me{box-shadow:inset 0 0 0 2px var(--seat, var(--gold-300))}",
      ".snph-foot{margin:0;font:var(--fw-ui) var(--fs-xs)/1.35 var(--font-ui);color:var(--text-2)}"
    ].join("\n");
    document.head.appendChild(st);
  }
  function word(st) { return st.spin ? "Spin" : "Roll"; }
  function rollText(st, d) { return d ? (d.length > 1 ? d[0] + " + " + d[1] + " = " + (d[0] + d[1]) : String(d[0])) : ""; }
  function hintHTML(st) {
    var h = st.hint; if (!h) return "";
    var out = [];   // [class, html]: only numbers and fixed words go in here
    if (h.pos === 0) out.push(["", h.wait ? "You are off the board: a <b>6</b> brings you on." : "You are off the board: your first " + word(st).toLowerCase() + " brings you on."]);
    else out.push(["", "You are on <b>" + h.pos + "</b>: " + h.left + " to go to " + st.goal + "."]);
    if (h.outs && h.outs.length) out.push(["", h.outs.length === 1 ? "A <b>" + h.outs[0] + "</b> wins!" : "<b>" + h.outs.join(", ") + "</b> win!"]);
    else if (h.exact && h.near && st.goal - h.pos <= 12) out.push(["", "You need exactly " + (st.goal - h.pos) + " to reach " + st.goal + "."]);
    var seen = {};
    (h.ahead || []).forEach(function (a) {
      if (seen[a.roll + a.kind]) return; seen[a.roll + a.kind] = 1;
      out.push(a.kind === "snake" ? ["is-snake", "A " + a.roll + ": <b>snake</b> from " + a.at + " down to " + a.to + "."] : ["is-ladder", "A " + a.roll + ": <b>ladder</b> from " + a.at + " up to " + a.to + "."]);
    });
    return '<ul class="snph-hint" aria-label="Your hint">' + out.map(function (t) { return "<li" + (t[0] ? ' class="' + t[0] + '"' : "") + ">" + t[1] + "</li>"; }).join("") + "</ul>";
  }
  function standHTML(st, esc) {
    return '<ol class="ph-stand snph-stand" aria-label="Standings">' + (st.stand || []).map(function (r) {
      var p = st.pl[r.s]; if (!p) return "";
      var v = p.done ? (r.place === 1 ? "Winner" : "Home") : p.pos ? "Square " + p.pos : "Start";
      return '<li data-seat="' + p.seat + '"' + (r.s === st.me ? ' class="is-me"' : "") + '><span class="ph-stand__n">' + r.place + '</span><span class="bg-token" data-seat="' + p.seat + '" style="width:1.5rem;height:1.5rem;font-size:12px" aria-hidden="true">' + esc((p.n.trim().charAt(0) || "?").toUpperCase()) + '</span><span class="ph-stand__nm">' + esc(p.n) + (r.s === st.me ? " (you)" : "") + (p.cpu ? " · computer" : "") + '</span><span class="ph-stand__v">' + v + "</span></li>";
    }).join("") + "</ol>";
  }
  function dieHTML(st, d) {
    if (!d) return "";
    if (st.spin) return '<span class="snph-spin" aria-hidden="true">' + d[0] + "</span>";
    return d.map(function (v) { return '<span class="bg-die" data-v="' + v + '" aria-hidden="true"></span>'; }).join("");
  }
  P.definePhone(ID, {
    show: function (st, ask, api) {
      css();
      var last = st.last, who = st.rolling && last ? last.s : st.cur;   // while a roll plays out on the TV, the turn is still the roller's
      var esc = api.esc, me = st.me, cur = st.pl[who] || {}, mine = !st.over && who === me, asking = !st.rolling && !st.afk && mine && api.asking() && !!(api.ask && api.ask.st && api.ask.st.step === st.step);   // only a LIVE ask for this position (an ask that timed out while the phone was away stays behind on the phone)
      var lastMine = last && last.s === me;
      var head = mine && asking ? (st.sixes > 0 ? "A 6! " + word(st) + " again" : "Your turn") : st.over ? "Game over" : mine ? "Your turn" : esc(cur.n) + "’s turn";
      var tokSeat = mine || st.over ? (st.pl[me] || {}).seat : cur.seat, tokName = mine || st.over ? (st.pl[me] || {}).n : cur.n;
      var html = '<div class="pgph snph">' + (st.afk ? api.afkHTML("snTake") : "") +
        '<div class="snph-who"><span class="bg-token" data-seat="' + (tokSeat || 1) + '" aria-hidden="true">' + esc(((tokName || "?").trim().charAt(0) || "?").toUpperCase()) + '</span><h1>' + head + "</h1></div>";
      if (asking) html += '<button type="button" class="opt bg-btn bg-btn--block opt--seat snph-roll" data-seat="' + (st.pl[me] || {}).seat + '" id="snRoll">' + word(st) + "<small>" + (st.spin ? "Spin the spinner" : st.two ? "Roll the dice" : "Roll the die") + "</small></button>";
      else if (st.rolling && last) html += '<p class="snph-wait" role="status">' + dieHTML(st, last.d) + "<span>" + (lastMine ? (st.afk ? "The computer " : "You ") + (st.spin ? "spun" : "rolled") + " " + rollText(st, last.d) + ". Watch the TV!" : esc((st.pl[last.s] || {}).n) + " " + (st.spin ? "spun" : "rolled") + " " + rollText(st, last.d) + ". Watch the TV.") + "</span></p>";
      else if (!st.over) html += '<p class="snph-wait" role="status"><span>' + (mine ? "Get ready to " + word(st).toLowerCase() + "…" : esc(cur.n) + (cur.cpu ? " (computer)" : "") + " is " + (st.spin ? "spinning" : "rolling") + ". Watch the TV.") + "</span></p>";
      if (st.line && !st.rolling) html += '<p class="snph-last">' + esc(st.line) + "</p>";
      if (!st.over && me >= 0 && !(st.pl[me] || {}).done) html += hintHTML(st);
      html += standHTML(st, esc);
      html += '<p class="snph-foot">' + esc(st.board) + " · Turn " + st.turn + (st.six ? " · a 6 rolls again" : "") + "</p></div>";
      api.put(html);
      var B = api.BG && api.BG();
      if (B && B.dice) Array.prototype.forEach.call(api.main.querySelectorAll(".snph-wait .bg-die"), function (d) { try { B.dice.render(d, +d.getAttribute("data-v")); } catch (e) { } });
      var rb = document.getElementById("snRoll");
      if (rb) rb.onclick = function () {
        if (!api.act("roll", { t: Date.now() })) return;
        rb.disabled = true; rb.innerHTML = (st.spin ? "Spinning" : "Rolling") + "…<small>Watch the TV</small>";
      };
      var tk = document.getElementById("snTake"); if (tk) tk.onclick = function () { api.take(); tk.disabled = true; };
      if (asking) api.focusFirst();
    },
    reset: function () { }
  });
})();
