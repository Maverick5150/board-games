/* WAR in Party Mode: the phone side (firestick/games/README.md; the TV side is games/war.js).
   A phone shows this player's count and place, a big Flip when the TV asks (in a war: lay the war cards; Hand War: this player's PRIVATE
   hand, each card with how much of the deck it beats and the best one marked; Prisoners of War / Winner arranges: the spoils), the
   Auto switch (the TV flips for you every battle), the card this player turned up, the last line of the game and the places 1..N.
   The cards are war/cards.js's own faces. Text >= 12 px, targets >= 44 px. */
(function () {
  "use strict";
  var P = window.PartyGames; if (!P) return;
  var ID = "war", W = window.War, C = W && W.Cards;
  var claimPr = { step: "", pr: undefined }, autoLocal = null, autoAt = 0, sentStep = "";
  function css() {
    if (C && C.injectCSS) C.injectCSS();
    if (document.getElementById("wph-css")) return;
    var st = document.createElement("style"); st.id = "wph-css";
    st.textContent = [
      ".wph{width:100%;max-width:26rem;margin:0 auto;display:grid;gap:.75rem;text-align:center}",
      ".wph-who{display:flex;align-items:center;gap:.65rem;margin:0;text-align:left}",
      ".wph-who .bg-token{flex:none;width:2.75rem;height:2.75rem;font:var(--fw-caps) var(--fs-md)/1 var(--font-ui)}",
      ".wph-who.is-turn .bg-token{box-shadow:inset 0 -3px 6px rgba(0,0,0,.3),0 0 0 2px var(--ink-1),0 0 0 4px var(--seat),0 0 0 6px #fff3d1}",
      ".wph-who h1{margin:0;font:400 var(--fs-2xl)/1.1 var(--font-display);color:var(--text-1)}",
      ".wph-who p{margin:.15rem 0 0;font:var(--fw-body) var(--fs-sm)/1.35 var(--font-ui);color:var(--text-2)}",
      ".wph-stats{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:.5rem}",
      ".wph-stat{display:grid;gap:.15rem;padding:.55rem .4rem;border-radius:var(--r-md);background:var(--ink-2);box-shadow:var(--well-edge)}",
      ".wph-stat b{font:400 var(--fs-2xl)/1 var(--font-display);color:var(--gold-100);font-variant-numeric:tabular-nums}",
      ".wph-stat span{font:var(--fw-caps) var(--fs-micro)/1.2 var(--font-ui);letter-spacing:.06em;text-transform:uppercase;color:var(--text-2)}",
      ".wph-go{flex-direction:column;gap:.15rem;min-height:5.5rem !important;font-size:var(--fs-2xl) !important;letter-spacing:.02em}",
      ".wph-go small{display:block;margin-top:.15rem;font:var(--fw-ui) var(--fs-sm)/1.2 var(--font-ui);opacity:.92}",
      ".wph-alt{min-height:3.25rem !important}",
      ".wph-alt small{display:block;font:var(--fw-ui) var(--fs-xs)/1.2 var(--font-ui);opacity:.9}",
      ".wph-wait{display:flex;align-items:center;justify-content:center;gap:.85rem;min-height:5.5rem;margin:0;padding:.75rem 1rem;border-radius:var(--r-lg);background:var(--ink-2);box-shadow:var(--well-edge);font:var(--fw-ui-strong) var(--fs-md)/1.35 var(--font-ui);color:var(--text-1);text-align:left}",
      ".wph-wait.is-war{background:linear-gradient(180deg,#4a1216,#22080a);box-shadow:inset 0 0 0 1.5px #ff9d8a}",
      ".wph-card{flex:none;--cw:3.6rem}",
      ".wph-card .wf{--cw:3.6rem}",
      ".wph-hand{display:grid;grid-template-columns:repeat(auto-fit,minmax(5.25rem,1fr));gap:.6rem}",
      ".wph-hc{position:relative;display:grid;justify-items:center;gap:.3rem;min-height:44px;padding:.5rem .35rem .45rem;border:0;border-radius:var(--r-md);background:var(--ink-2);box-shadow:inset 0 0 0 1.5px var(--line-1);color:var(--text-1);font:var(--fw-ui-strong) var(--fs-xs)/1.2 var(--font-ui);cursor:pointer}",
      ".wph-hc .wf{--cw:4rem}",
      ".wph-hc.is-best{box-shadow:inset 0 0 0 2px var(--gold-300)}",
      ".wph-hc:focus-visible{outline:none;box-shadow:var(--focus-ring)}",
      ".wph-hc[disabled]{opacity:.55}",
      ".wph-best{position:absolute;top:-.55rem;left:50%;transform:translateX(-50%);padding:.12rem .45rem;border-radius:var(--r-pill);background:var(--gold-fill);color:var(--text-on-gold);font:var(--fw-caps) var(--fs-micro)/1 var(--font-ui);letter-spacing:.06em;text-transform:uppercase;white-space:nowrap}",
      ".wph-mini{display:flex;justify-content:center;gap:.4rem}",
      ".wph-mini .wf{--cw:2.6rem}",
      ".wph-lbl{margin:0;font:var(--fw-caps) var(--fs-micro)/1.2 var(--font-ui);letter-spacing:.08em;text-transform:uppercase;color:var(--gold-200)}",
      ".wph-auto{display:flex;align-items:center;justify-content:space-between;gap:.75rem;width:100%;min-height:3rem;padding:.5rem .85rem;border:0;border-radius:var(--r-md);background:var(--ink-2);box-shadow:inset 0 0 0 1px var(--line-1);color:var(--text-1);font:var(--fw-ui-strong) var(--fs-md)/1.2 var(--font-ui);text-align:left;cursor:pointer}",
      ".wph-auto small{display:block;font:var(--fw-ui) var(--fs-xs)/1.3 var(--font-ui);color:var(--text-2)}",
      ".wph-auto[aria-checked=true]{box-shadow:inset 0 0 0 2px var(--gold-300)}",
      ".wph-auto:focus-visible{outline:none;box-shadow:var(--focus-ring)}",
      ".wph-last{margin:0;font:var(--fw-ui) var(--fs-sm)/1.4 var(--font-ui);color:var(--text-2)}",
      ".wph .ph-stand{max-width:none}",
      ".wph-stand li.is-me{box-shadow:inset 0 0 0 2px var(--gold-300)}",
      ".wph-stand li.is-out{opacity:.6}",
      ".wph-stand .wph-dot{flex:none;width:.85rem;height:.85rem;border-radius:50%;box-shadow:0 0 0 2px rgba(0,0,0,.35)}",
      ".wph-foot{margin:0;font:var(--fw-ui) var(--fs-xs)/1.35 var(--font-ui);color:var(--text-2)}",
      ".wph .wf-ipip{color:inherit}"
    ].join("\n");
    document.head.appendChild(st);
  }
  function ord(n) { var t = n % 100; return n + ((t >= 11 && t <= 13) ? "th" : (["th", "st", "nd", "rd"][n % 10] || "th")); }
  function plural(n, w) { return n + " " + w + (n === 1 ? "" : "s"); }
  function pip(api, t) { return C && C.pipText ? C.pipText(api.esc(t)) : api.esc(t); }
  function face(ci, cls) { if (!ci) return ""; return C && C.faceHTML ? C.faceHTML(ci.c, { cls: cls || "" }) : '<b>' + ci.sh + "</b>"; }
  function warWord(n) { return n <= 1 ? "I declare war!" : n <= 5 ? ["Double", "Triple", "Quadruple", "Quintuple"][n - 2] + " war!" : "War number " + n + "!"; }
  function standHTML(st, api) {
    return '<ol class="ph-stand wph-stand" aria-label="Places">' + (st.stand || []).map(function (s, i) {
      var p = st.pl[s]; if (!p) return "";
      return '<li class="' + (s === st.me ? "is-me" : "") + (p.out ? " is-out" : "") + '"><span class="ph-stand__n">' + (i + 1) + '</span><span class="wph-dot" style="background:' + api.esc(p.hex) + '" aria-hidden="true"></span><span class="ph-stand__nm">' + api.esc(p.n) + (s === st.me ? " (you)" : "") + (p.cpu ? " · computer" : p.away ? " · away" : "") + '</span><span class="ph-stand__v">' + (p.out ? "Out" : p.cnt) + "</span></li>";
    }).join("") + "</ol>";
  }

  P.definePhone(ID, {
    show: function (st, ask, api) {
      css();
      var esc = api.esc, me = st.me, my = st.my || {}, mine = st.pl[me] || {};
      var A = api.ask && api.ask.st ? api.ask : null;
      var asking = !st.afk && !st.over && api.asking() && !!A && A.st.step === st.step && sentStep !== st.step;
      var as = asking ? A.st : null, kind = as ? as.ask : null;
      if (autoLocal != null && autoLocal === !!st.auto) autoLocal = null;
      if (autoLocal != null && Date.now() - autoAt > 2000) { autoAt = Date.now(); api.view({ auto: autoLocal }); }   // the TV has not confirmed the switch yet: say it again
      var isAuto = autoLocal != null ? autoLocal : !!st.auto;
      var need = (st.need || []).indexOf(me) >= 0 && (st.acted || []).indexOf(me) < 0;
      var title, sub;
      if (st.over) { title = "Game over"; sub = st.winner === me ? "You win!" : st.winner >= 0 ? esc((st.pl[st.winner] || {}).n) + " wins" : "A draw"; }
      else if (st.ph === "deal") { title = "The deal"; sub = esc((st.pl[st.dealer] || {}).n) + " deals the cards. Watch the TV."; }
      else if (my.out) { title = "You're out"; sub = "Out of cards. Watch the rest on the TV."; }
      else if (asking && kind === "claim") { title = "You win" + (as.claim && as.claim.war ? " the war!" : " the battle!"); sub = "Take your spoils"; }
      else if (asking && kind === "war") { title = warWord(Math.max(1, st.warN)); sub = st.down ? "Lay " + st.down + " face down, then turn up the " + ord(st.down + 1) + "." : "Turn up your next card."; }
      else if (asking && kind === "pick") { title = "Choose your card"; sub = "Everyone picks in secret, then all reveal."; }
      else if (asking) { title = "Flip!"; sub = "Everyone turns a card at once."; }
      else if (st.watch) { title = st.fight && st.fight.indexOf(me) >= 0 ? "You're in a war!" : "Watch the TV"; sub = st.fight ? "A war is on the table." : "The cards are turning."; }
      else if (need) { title = isAuto ? "Auto is on" : "Get ready…"; sub = isAuto ? "The TV flips for you." : "Your turn comes up on the TV."; }
      else { var left = (st.need || []).filter(function (s) { return (st.acted || []).indexOf(s) < 0; }); title = "Ready"; sub = left.length ? "Waiting for " + (left.length <= 2 ? left.map(function (s) { return esc((st.pl[s] || {}).n); }).join(" and ") : plural(left.length, "player")) + "." : "Watch the TV."; }
      var tokStyle = "--seat:" + esc(mine.hex) + ";--seat-hi:" + esc(mine.hex) + ";--seat-lo:" + esc(mine.hex) + ";--seat-ink:#0b0a12";
      var html = '<div class="pgph wph">' + (st.afk ? api.afkHTML("wpTake") : "") +
        '<div class="wph-who' + (asking ? " is-turn" : "") + '" style="' + tokStyle + '"><span class="bg-token" aria-hidden="true">' + esc(((mine.n || "?").trim().charAt(0) || "?").toUpperCase()) + "</span><div><h1>" + title + "</h1><p>" + sub + "</p></div></div>" +
        '<div class="wph-stats"><div class="wph-stat"><b>' + (my.out ? "Out" : my.cnt) + "</b><span>" + (my.cnt === 1 ? "card" : "cards") + '</span></div><div class="wph-stat"><b>' + ord(my.place || 1) + "</b><span>of " + st.n + '</span></div><div class="wph-stat"><b>' + st.battle + "</b><span>battle</span></div></div>";
      // the Auto switch sits ABOVE the action, so the Flip arriving never moves it under a finger
      if (!st.over && !my.out) html += '<button type="button" class="wph-auto" role="switch" aria-checked="' + isAuto + '" id="wpAuto"><span>Auto<small>' + (isAuto ? (st.hand ? "On: the TV plays a card for you every battle" : "On: the TV flips for you every battle") : (st.hand ? "Off: you choose your card each battle" : "Off: you press Flip each battle")) + '</small></span><span class="bg-toggle" aria-hidden="true"></span></button>';
      if (asking && kind === "claim") html += claimHTML(as, api);
      else if (asking && kind === "pick") {
        html += '<p class="wph-lbl">Your hand · private</p><div class="wph-hand" role="group" aria-label="Your hand">' + (as.my.hand || []).concat(as.my.pr || []).map(function (ci, i) {
          var pr = i >= (as.my.hand || []).length;
          return '<button type="button" class="wph-hc' + (ci.best ? " is-best" : "") + '" data-c="' + ci.c + '" aria-label="' + esc(ci.nm + (pr ? ", your prisoner" : "") + ", beats about " + ci.p + "% of the deck" + (ci.best ? ", the best choice" : "")) + '">' + (ci.best ? '<span class="wph-best">Best</span>' : "") + face(ci) + "<span>" + (pr ? "Prisoner · " : "") + "Beats " + ci.p + "%" + (ci.w ? " · wild" : "") + "</span></button>";
        }).join("") + "</div>";
      } else if (asking) {
        var big = kind === "war" ? "Lay war cards" : "Flip";
        var small = kind === "war" ? (as.my.lay ? as.my.lay + " face down + 1 up" : "Your last card plays") : "Turn up your top card";
        html += '<button type="button" class="opt bg-btn bg-btn--block opt--seat wph-go" data-seat="' + (api.seat() || 1) + '" id="wpGo">' + big + "<small>" + small + "</small></button>";
        if (kind !== "war") (as.my.pr || []).forEach(function (ci) { html += '<button type="button" class="opt bg-btn bg-btn--block bg-btn--secondary wph-alt" data-pr="' + ci.c + '">' + pip(api, "Play your prisoner " + ci.sh) + "<small>Beats about " + ci.p + "% of the deck" + (ci.best ? " · the best choice" : "") + "</small></button>"; });
      } else if (!st.over) {
        var up = my.up, fightOn = st.fight && st.fight.indexOf(me) >= 0;
        html += '<div class="wph-wait' + (fightOn ? " is-war" : "") + '" role="status">' + (up ? '<span class="wph-card">' + face(up) + "</span>" : "") + "<span>" + (up ? "Your card: " + pip(api, up.nm) + (up.w ? " (wild)" : "") + ". " : "") + (st.ph === "deal" ? "Watch the deal on the TV." : need && !isAuto ? "Wait for the TV to ask you…" : "Watch the TV.") + "</span></div>";
      }
      if (st.hand && !asking && !st.over && (my.hand || []).length) html += '<p class="wph-lbl">Your hand · private</p><div class="wph-mini" aria-label="Your hand">' + my.hand.map(function (ci) { return face(ci); }).join("") + "</div>";
      if (st.line && !st.watch) html += '<p class="wph-last">' + pip(api, st.line) + "</p>";
      html += standHTML(st, api);
      html += '<p class="wph-foot">' + esc(st.ver) + " · " + st.n + " players · " + st.deckN + " cards</p></div>";
      api.put(html);
      var go = document.getElementById("wpGo");
      if (go) go.onclick = function () { if (!api.act("flip", {})) return; sentStep = st.step; go.disabled = true; go.innerHTML = "Sent<small>Watch the TV</small>"; };
      Array.prototype.forEach.call(api.main.querySelectorAll("[data-pr]"), function (b) { b.onclick = function () { if (!api.act("flip", { pr: +b.getAttribute("data-pr") })) return; sentStep = st.step; b.disabled = true; }; });
      Array.prototype.forEach.call(api.main.querySelectorAll(".wph-hc[data-c]"), function (b) { b.onclick = function () {
        if (!api.act("pick", { c: +b.getAttribute("data-c") })) return; sentStep = st.step;
        Array.prototype.forEach.call(api.main.querySelectorAll(".wph-hc"), function (x) { x.disabled = true; });
      }; });
      Array.prototype.forEach.call(api.main.querySelectorAll("[data-claim]"), function (b) { b.onclick = function () {
        var v = b.getAttribute("data-claim");
        if (v === "none" || v.charAt(0) === "p") { claimPr = { step: st.step, pr: v === "none" ? null : +v.slice(1) }; if (as && as.claim && as.claim.arrange && as.claim.pot - (claimPr.pr != null ? 1 : 0) >= 2) { P.phone(ID).show(st, ask, api); return; } }
        var pr = claimPr.step === st.step ? claimPr.pr : null;
        if (!api.act("claim", { pr: pr == null ? null : pr, order: v.charAt(0) === "o" ? v.slice(1) : "shuffle" })) return;
        sentStep = st.step; claimPr = { step: "", pr: undefined };
        Array.prototype.forEach.call(api.main.querySelectorAll("[data-claim]"), function (x) { x.disabled = true; });
      }; });
      var au = document.getElementById("wpAuto");
      if (au) au.onclick = function () { autoLocal = !isAuto; autoAt = Date.now(); api.view({ auto: autoLocal }); au.setAttribute("aria-checked", String(autoLocal)); au.querySelector("small").textContent = autoLocal ? (st.hand ? "On: the TV plays a card for you every battle" : "On: the TV flips for you every battle") : (st.hand ? "Off: you choose your card each battle" : "Off: you press Flip each battle"); };
      var tk = document.getElementById("wpTake"); if (tk) tk.onclick = function () { api.take(); tk.disabled = true; };
      if (asking && isAuto) {   // Auto is on but the TV still asked (the switch crossed the ask): answer it for the player
        var stepNow = st.step;
        setTimeout(function () {
          if (sentStep === stepNow || !api.asking()) return;
          var bh = (as.my.hand || []).concat(as.my.pr || []).filter(function (x) { return x.best; })[0] || (as.my.hand || [])[0];
          var ok2 = kind === "pick" && bh ? api.act("pick", { c: bh.c }) : kind === "claim" ? api.act("claim", { pr: ((as.claim && as.claim.prOk) || []).filter(function (x) { return x.best; }).map(function (x) { return x.c; })[0], order: "shuffle" }) : api.act("flip", {});
          if (ok2) sentStep = stepNow;
        }, 350);
      } else if (asking) api.focusFirst();
      function claimHTML(as, api) {
        var cl = as.claim || { prOk: [], pot: 0 }, h = "";
        var pickedPr = claimPr.step === as.step ? claimPr.pr : undefined;
        if (cl.prOk.length && pickedPr === undefined) {
          h += '<p class="wph-lbl">Prisoners of War · house rule</p>';
          cl.prOk.forEach(function (ci) { h += '<button type="button" class="opt bg-btn bg-btn--block ' + (ci.best ? "opt--seat" : "bg-btn--secondary") + ' wph-alt" data-seat="' + (api.seat() || 1) + '" data-claim="p' + ci.c + '">' + pip(api, "Take the " + ci.nm) + "<small>Beats about " + ci.p + "% of the deck" + (ci.best ? " · the best choice" : "") + "</small></button>"; });
          h += '<button type="button" class="opt bg-btn bg-btn--block bg-btn--secondary wph-alt" data-claim="none">No prisoner<small>All ' + cl.pot + " cards go under your stack</small></button>";
          return h;
        }
        h += '<p class="wph-lbl">Winner arranges · house rule</p>';
        [["ospread", "Spread them out", "Strong, weak, strong: a steady supply"], ["ostrong", "Strongest first", "Your best cards come back soonest"], ["oweak", "Weakest first", "Save the strong cards for later"], ["shuffle", "Shuffle them", "A random order, as in the official game"]].forEach(function (o, i) {
          h += '<button type="button" class="opt bg-btn bg-btn--block ' + (i === 0 ? "opt--seat" : "bg-btn--secondary") + ' wph-alt" data-seat="' + (api.seat() || 1) + '" data-claim="' + o[0] + '">' + o[1] + "<small>" + o[2] + "</small></button>";
        });
        return h;
      }
    },
    reset: function () { claimPr = { step: "", pr: undefined }; autoLocal = null; sentStep = ""; }
  });
})();
