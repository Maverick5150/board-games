/* MOTOCROSS WAR in Party Mode: the phone side (firestick/games/README.md; the TV side is games/mxwar.js).
   Each phone is a rider. The sign-up: a team (the makes that season raced) and a number free that season (the taken numbers are listed:
   the season's real riders keep theirs, and two phones never share one; empty = the TV picks a free one). The race: this rider's place,
   cards held and the lap, the Auto switch (the TV flips for you every lap), a big Flip each lap (it turns as the leader starts the lap)
   and in a war ("3 down, the 4th decides"), the card this rider turned, the war (the 3 down + the 4th up), the crash and the yellow flag,
   the timing (every rider: place, plate, name, the gap in seconds or the laps down, DNF; two compact columns for a big gate), and the YOU readout
   (mxtime: this rider's place and gap now, the last and best lap, and after every lap what it was worth: seconds against a typical lap, the places,
   the reasons). The TV computes it all from the time model (mxwar/time.js) and sends it in the snapshot: the phone only draws it.
   Between races: the result, the podium, the season place and points.
   The cards are mxwar/art.js's own faces. Text >= 12 px, targets >= 44 px. */
(function () {
  "use strict";
  var P = window.PartyGames; if (!P) return;
  var ID = "mxwar", MXA = window.MXWar && window.MXWar.Art;
  var sentStep = "", autoLocal = null, autoAt = 0, su = { key: "", num: "", bike: "" }, LKEY = "bg_mxwar_party";
  function css() {
    if (document.getElementById("mxph-css")) return;
    var st = document.createElement("style"); st.id = "mxph-css";
    var Q = ".mxph ";
    /* THE MXWAR SKIN (BG_audit/sprint/mxui/UI-SPEC.md; the same tokens and fonts as mxwar/index.html): the two OFL font families from ../mxwar/assets/fonts/ and the
       pack's tokens, the shared tokens remapped ONLY inside this controller (.mxph): the shell's top bar and its room joining keep the shared look */
    var FR = "unicode-range:U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD";
    st.textContent = [
      '@font-face{font-family:"MXW Anton";src:url("../mxwar/assets/fonts/anton-400-latin.woff2") format("woff2");font-weight:400;font-style:normal;font-display:swap;' + FR + "}",
      /* Barlow Condensed 600 / 700 ("MXW Barlow Condensed"): its @font-face is with the timing rules below (mxfix1), the same files and family name */
      ".mxph{--mx-night-black:#090C12;--mx-panel-black:#0D111B;--mx-war-red:#F72D2E;--mx-dust-brown:#7B4A2B;--mx-dirt-highlight:#B6824C;--mx-stadium-gold:#ECB967;--mx-hud-white:#F0F1F3;--mx-secondary-text:#AEB5BF;" +
        "--mx-font-display:\"MXW Anton\",Impact,\"Arial Narrow\",\"Roboto Condensed\",sans-serif;--mx-font-hud:\"MXW Barlow Condensed\",\"Roboto Condensed\",\"Arial Narrow\",system-ui,sans-serif;" +
        "--mx-safe-area-percent:6;--mx-safe-x:1rem;--mx-safe-y:.5rem;" +
        "--mx-red-fill:#C92730;--mx-red-fill-focus:#D22B31;--mx-red-fill-press:#A51E25;--mx-red-deep:#B5222A;--mx-red-head:#B21F29;--mx-red-text:#FF5A4F;--mx-edge-warm:#FFD6A5;--mx-edge-focus:#FFF3CB;" +
        "--mx-slate:#191F2B;--mx-slate-edge:#8D9DB2;--mx-row:#22272F;--mx-row-edge:#626A7B;--mx-gold-pale:#FCEFD2;--mx-disabled:#26282F;--mx-disabled-edge:#3F444D;--mx-disabled-text:#8E949C;" +
        "--mx-hud-panel:rgba(6,9,16,.84);--mx-hud-panel-strong:rgba(6,10,16,.93);--mx-zebra:rgba(100,106,121,.11);--mx-hairline:rgba(240,241,243,.14);--mx-card-face:#EAE7DD;--mx-card-edge:#E7CA9C;" +
        "--mx-up:#8FE3A3;--mx-down:#FF9A8A;--mx-yellow:#FFD21F;--mx-fastest:#D9B3FF;--mx-r-btn:.5rem;--mx-r-panel:.75rem;--mx-r-card:1rem;" +
        "--mx-fs-hero:3rem;--mx-fs-display-xl:2.5rem;--mx-fs-display-l:2.25rem;--mx-fs-display-m:1.75rem;--mx-fs-display-s:1.25rem;--mx-fs-hud-l:1.125rem;--mx-fs-hud-m:.8125rem;--mx-fs-hud-s:.75rem;" +
        "--ink-0:#05070B;--ink-1:var(--mx-night-black);--ink-2:#0A0E16;--ink-3:var(--mx-panel-black);--ink-4:var(--mx-slate);--ink-5:var(--mx-row);" +
        "--line-1:rgba(240,241,243,.08);--line-2:rgba(240,241,243,.16);--line-gold:rgba(236,185,103,.45);--text-1:var(--mx-hud-white);--text-2:var(--mx-secondary-text);--text-3:#9AA2AD;" +
        "--gold-100:#F6DDB0;--gold-200:var(--mx-stadium-gold);--gold-300:#D9A24F;--panel-fill:var(--mx-panel-black);--panel-edge:inset 0 0 0 1px var(--mx-hairline);--control-fill:var(--mx-slate);" +
        "--font-display:var(--mx-font-display)}",
      Q + ".mxph-who h1{text-transform:uppercase;letter-spacing:.01em}",
      Q + ".mxph-tw li{font-family:var(--mx-font-hud);font-weight:700;font-variant-numeric:tabular-nums}",
      ".mxph{width:100%;max-width:26rem;margin:0 auto;display:grid;gap:.7rem;text-align:center}",
      Q + ".mx-mk{display:inline-flex;align-items:center;flex:none;padding:.1rem .45rem;border-radius:var(--r-xs);font:var(--fw-caps) var(--fs-micro)/1.25 var(--font-ui);color:var(--mk-ink,#fff);background:var(--mk,#3a3a44);box-shadow:inset 0 0 0 1px rgba(255,255,255,.18);white-space:nowrap}",
      Q + ".mx-pl{display:inline-grid;place-items:center;flex:none;min-width:2.6em;padding:.1rem .3rem .1rem .55em;border-radius:var(--r-xs);font:800 var(--fs-sm)/1.1 var(--font-ui);font-variant-numeric:tabular-nums;color:#121216;background:#f4f1e8;box-shadow:inset .3em 0 0 var(--mk,#3a3a44),inset 0 0 0 1px rgba(0,0,0,.4)}",
      Q + ".mx-pl.is-red{color:#fff;background:#c8101c;box-shadow:inset .3em 0 0 var(--mk,#3a3a44),inset 0 0 0 1px rgba(255,255,255,.35)}",
      Q + ".mx-card{width:var(--cw,3.6rem);height:calc(var(--cw,3.6rem) * 1.4);perspective:40rem;flex:none}",
      Q + ".mx-ci{position:relative;width:100%;height:100%;transform-style:preserve-3d}",
      Q + ".mx-cf," + Q + ".mx-cb{position:absolute;inset:0;border-radius:calc(var(--cw,3.6rem) * .1);backface-visibility:hidden;-webkit-backface-visibility:hidden;box-shadow:0 .25rem .6rem rgba(0,0,0,.5)}",
      Q + ".mx-cf{background:linear-gradient(180deg,#fffdf7,#ece2cb);color:#1d1a24}",
      Q + ".mx-cf.is-red{color:#b3202a}",
      Q + ".mx-card:not(.is-up) .mx-cf{transform:rotateY(180deg)}",
      Q + ".mx-card.is-up .mx-cb{transform:rotateY(-180deg)}",
      Q + ".mx-cb{background:repeating-conic-gradient(#1d1b22 0 25%,#34313b 0 50%) 0 0/calc(var(--cw,3.6rem) * .22) calc(var(--cw,3.6rem) * .22);box-shadow:inset 0 0 0 calc(var(--cw,3.6rem) * .05) #2a2730,inset 0 0 0 calc(var(--cw,3.6rem) * .065) #c99f5e}",
      Q + ".mx-ck{position:absolute;left:calc(var(--cw,3.6rem) * .07);top:calc(var(--cw,3.6rem) * .05);display:grid;justify-items:center;line-height:1}",
      Q + ".mx-ck.is-b{left:auto;top:auto;right:calc(var(--cw,3.6rem) * .07);bottom:calc(var(--cw,3.6rem) * .05);transform:rotate(180deg)}",
      Q + ".mx-ck b{font:800 max(var(--fs-micro), calc(var(--cw,3.6rem) * .26))/1 var(--font-ui)}",
      Q + ".mx-ck svg{width:max(.7rem, calc(var(--cw,3.6rem) * .17));height:max(.7rem, calc(var(--cw,3.6rem) * .17))}",
      Q + ".mx-cs{position:absolute;left:50%;top:50%;width:calc(var(--cw,3.6rem) * .48);height:calc(var(--cw,3.6rem) * .48);transform:translate(-50%,-50%)}",
      Q + ".mx-cf.is-jk .mx-cs{color:#c99f5e}",
      Q + ".mx-card.is-win .mx-cf{box-shadow:0 0 0 3px #f0d48a,0 0 0 5px #0b0a12}",
      Q + ".mx-tw__c{display:inline-flex;align-items:center;gap:.1rem;padding:.1rem .3rem;border-radius:.3rem;font:800 var(--fs-micro)/1 var(--font-ui);color:#1d1a24;background:#f3ead6}",
      Q + ".mx-tw__c.is-red{color:#b3202a}",
      Q + ".mx-tw__c svg{width:.8em;height:.8em}",
      Q + ".mxph-who{display:flex;align-items:center;gap:.65rem;margin:0;text-align:left}",
      Q + ".mxph-who .mx-pl{font-size:var(--fs-xl);min-width:2.4em;padding:.25rem .4rem .25rem .6em}",
      Q + ".mxph-who .mxph-tok{flex:none;display:grid;place-items:center;width:2.75rem;height:2.75rem;border-radius:50%;background:var(--seat,#e7ca90);color:#0b0a12;font:var(--fw-caps) var(--fs-md)/1 var(--font-ui)}",
      Q + ".mxph-who.is-turn .mx-pl," + Q + ".mxph-who.is-turn .mxph-tok{box-shadow:0 0 0 2px var(--ink-1),0 0 0 4px var(--seat,#e7ca90),0 0 0 6px #fff3d1}",
      Q + ".mxph-who h1{margin:0;font:400 var(--fs-2xl)/1.1 var(--font-display);color:var(--text-1)}",
      Q + ".mxph-who p{margin:.15rem 0 0;font:var(--fw-body) var(--fs-sm)/1.35 var(--font-ui);color:var(--text-2)}",
      Q + ".mxph-stats{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:.5rem}",
      Q + ".mxph-stat{display:grid;gap:.15rem;padding:.55rem .4rem;border-radius:var(--r-md);background:var(--ink-2);box-shadow:var(--well-edge)}",
      Q + ".mxph-stat b{font:400 var(--fs-2xl)/1 var(--font-display);color:var(--gold-100);font-variant-numeric:tabular-nums}",
      Q + ".mxph-stat span{font:var(--fw-caps) var(--fs-micro)/1.2 var(--font-ui);letter-spacing:.06em;text-transform:uppercase;color:var(--text-2)}",
      Q + ".mxph-go{flex-direction:column;gap:.15rem;min-height:5.5rem !important;font-size:var(--fs-2xl) !important}",
      Q + ".mxph-go small{display:block;margin-top:.15rem;font:var(--fw-ui) var(--fs-sm)/1.2 var(--font-ui);opacity:.92}",
      Q + ".mxph-alt{min-height:3rem !important}",
      Q + ".mxph-auto{display:flex;align-items:center;justify-content:space-between;gap:.75rem;width:100%;min-height:3rem;padding:.5rem .85rem;border:0;border-radius:var(--r-md);background:var(--ink-2);box-shadow:inset 0 0 0 1px var(--line-1);color:var(--text-1);font:var(--fw-ui-strong) var(--fs-md)/1.2 var(--font-ui);text-align:left;cursor:pointer}",
      Q + ".mxph-auto small{display:block;font:var(--fw-ui) var(--fs-xs)/1.3 var(--font-ui);color:var(--text-2)}",
      Q + ".mxph-auto[aria-checked=true]{box-shadow:inset 0 0 0 2px var(--gold-300)}",
      Q + ".mxph-auto:focus-visible{outline:none;box-shadow:var(--focus-ring)}",
      Q + ".mxph-box{display:flex;align-items:center;justify-content:center;gap:.85rem;min-height:5.5rem;margin:0;padding:.75rem 1rem;border-radius:var(--r-lg);background:var(--ink-2);box-shadow:var(--well-edge);font:var(--fw-ui-strong) var(--fs-md)/1.35 var(--font-ui);color:var(--text-1);text-align:left}",
      Q + ".mxph-box.is-war{background:linear-gradient(180deg,#4a1216,#22080a);box-shadow:inset 0 0 0 1.5px #ff9d8a}",
      Q + ".mxph-box.is-yellow{background:linear-gradient(180deg,#4f3f06,#231b02);box-shadow:inset 0 0 0 1.5px #ffd21f}",
      Q + ".mxph-pile{position:relative;flex:none;width:calc(var(--cw) * 1.7);height:calc(var(--cw) * 1.4);--cw:3rem}",
      Q + ".mxph-pile > span{position:absolute;top:0}",
      Q + ".mxph-pile .mx-card{--cw:3rem}",
      Q + ".mxph-lbl{margin:0;font:var(--fw-caps) var(--fs-micro)/1.2 var(--font-ui);letter-spacing:.08em;text-transform:uppercase;color:var(--gold-200)}",
      Q + ".mxph-last{margin:0;font:var(--fw-ui) var(--fs-sm)/1.4 var(--font-ui);color:var(--text-2)}",
      Q + ".mxph-foot{margin:0;font:var(--fw-ui) var(--fs-xs)/1.35 var(--font-ui);color:var(--text-2)}",
      Q + ".mxph-run{list-style:none;margin:0;padding:.4rem;display:grid;gap:.25rem;border-radius:var(--r-md);background:var(--ink-2);box-shadow:var(--well-edge)}",
      Q + ".mxph-run li{display:flex;align-items:center;gap:.5rem;min-height:2rem;padding:0 .5rem;border-radius:.5rem;background:var(--ink-3);font:var(--fw-ui-strong) var(--fs-sm)/1.2 var(--font-ui);color:var(--text-1);text-align:left}",
      Q + ".mxph-run li.is-me{box-shadow:inset 0 0 0 2px var(--gold-300)}",
      Q + ".mxph-run li.is-gap{min-height:.8rem;background:none;justify-content:center;color:var(--text-2)}",
      Q + ".mxph-run .mxph-p{flex:none;min-width:1.6rem;font:400 var(--fs-lg)/1 var(--font-display);color:var(--gold-100);text-align:center}",
      Q + ".mxph-run .mxph-n{flex:1 1 auto;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}",
      Q + ".mxph-run .mxph-k{flex:none;color:var(--gold-100);font-variant-numeric:tabular-nums}",
      Q + ".mxph-you{display:grid;gap:.3rem;padding:.6rem .7rem .65rem;border-radius:var(--r-lg);background:linear-gradient(180deg,rgba(231,202,144,.16),rgba(231,202,144,.05));box-shadow:inset 0 0 0 1.5px var(--gold-300);text-align:left}",
      Q + ".mxph-you.is-down{background:linear-gradient(180deg,rgba(232,119,90,.22),rgba(232,119,90,.06));box-shadow:inset 0 0 0 1.5px #e8775a}",
      Q + ".mxph-you.is-out{opacity:.88}",
      Q + ".mxph-you__top{display:flex;flex-wrap:wrap;align-items:baseline;gap:.15rem .6rem}",
      Q + ".mxph-you__top b{font:400 var(--fs-xl)/1 var(--font-display);color:var(--gold-100);white-space:nowrap}",
      Q + ".mxph-you__top span{flex:1 1 9rem;min-width:0;font:var(--fw-ui-strong) var(--fs-sm)/1.25 var(--font-ui);color:var(--text-1);font-variant-numeric:tabular-nums}",
      Q + ".mxph-you__laps{margin:0;font:var(--fw-ui) var(--fs-xs)/1.25 var(--font-ui);color:var(--text-2);font-variant-numeric:tabular-nums}",
      Q + ".mxph-you__line{margin:0;font:var(--fw-ui-strong) var(--fs-sm)/1.3 var(--font-ui);color:var(--text-1)}",
      Q + ".mxph-why{list-style:none;margin:0;padding:0;display:flex;flex-wrap:wrap;gap:.3rem}",
      Q + ".mxph-why li{display:inline-flex;align-items:baseline;gap:.4rem;padding:.18rem .6rem;border-radius:999px;background:var(--ink-3);box-shadow:inset 0 0 0 1px var(--line-1);font:var(--fw-ui-strong) var(--fs-micro)/1.25 var(--font-ui);color:var(--text-1)}",
      Q + ".mxph-why li b{font-variant-numeric:tabular-nums}",
      Q + ".mxph-why li.is-up b{color:#8fe3a3}",
      Q + ".mxph-why li.is-dn b{color:#ff9a8a}",
      Q + ".mxph-tw{list-style:none;margin:0;padding:.4rem;display:grid;gap:.18rem;border-radius:var(--r-md);background:var(--ink-2);box-shadow:var(--well-edge)}",
      Q + ".mxph-tw.is-two{grid-auto-flow:column;grid-template-rows:repeat(var(--rows,20),auto);grid-template-columns:repeat(2,minmax(0,1fr));column-gap:.35rem}",
      Q + ".mxph-tw li{display:grid;grid-template-columns:1.5rem auto minmax(0,1fr) auto;align-items:center;gap:.35rem;min-height:1.75rem;padding:0 .4rem;border-radius:.4rem;background:var(--ink-3);font:var(--fw-ui-strong) var(--fs-micro)/1.2 var(--font-ui);color:var(--text-1);text-align:left}",
      Q + ".mxph-tw.is-two li{grid-template-columns:1.05rem auto minmax(0,1fr) auto;gap:.2rem;padding:0 .3rem 0 .15rem}",
      /* mxfix1 (review fix): the condensed face ships with the game (mxwar/assets/fonts/, SIL OFL 1.1; the same files and family name as mxwar/index.html) */
      '@font-face{font-family:"MXW Barlow Condensed";src:url("../mxwar/assets/fonts/barlowcondensed-600-latin.woff2") format("woff2");font-weight:600;font-style:normal;font-display:swap;unicode-range:U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD}',
      '@font-face{font-family:"MXW Barlow Condensed";src:url("../mxwar/assets/fonts/barlowcondensed-700-latin.woff2") format("woff2");font-weight:700;font-style:normal;font-display:swap;unicode-range:U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD}',
      Q + ".mxph-tw.is-two .mxph-n," + Q + ".mxph-tw.is-two .mxph-g," + Q + ".mxph-tw.is-two .mxph-p{font-family:\"MXW Barlow Condensed\",\"Barlow Condensed\",\"Roboto Condensed\",\"sans-serif-condensed\",\"Arial Narrow\",\"Avenir Next Condensed\",\"Bahnschrift Condensed\",sans-serif;font-size:.8125rem}",
      Q + ".mxph-tw.is-two .mxph-n{font-weight:600;letter-spacing:.01em}",
      Q + ".mxph-tw.is-two .mxph-p{font-weight:700}",
      Q + ".mxph-tw.is-two .mx-pl{min-width:1.85em;padding:.06rem .16rem .06rem .45em}",
      Q + ".mxph-tw li.is-me{box-shadow:inset 0 0 0 2px var(--gold-300)}",
      Q + ".mxph-tw li.is-down{background:#4a1f14;box-shadow:inset 0 0 0 1.5px #e8775a}",
      Q + ".mxph-tw li.is-out{opacity:.6}",
      Q + ".mxph-tw .mxph-p{font:400 var(--fs-micro)/1 var(--font-display);color:var(--gold-100);text-align:right;font-variant-numeric:tabular-nums}",
      Q + ".mxph-tw .mx-pl{font-size:var(--fs-micro);min-width:2em;padding:.05rem .2rem .05rem .5em}",
      Q + ".mxph-tw .mxph-n{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}",
      Q + ".mxph-tw .mxph-g{text-align:right;white-space:nowrap;font-variant-numeric:tabular-nums}",
      Q + ".mxph-tw li.is-down .mxph-g{color:#ffb4a3;font-weight:800}",
      Q + ".mxph-teams{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:.5rem}",
      Q + ".mxph-team{display:flex;align-items:center;justify-content:center;gap:.4rem;min-height:3rem;padding:.4rem .5rem;border:0;border-radius:var(--r-md);background:var(--ink-2);box-shadow:inset 0 0 0 1px var(--line-1);color:var(--text-1);font:var(--fw-ui-strong) var(--fs-sm)/1.2 var(--font-ui);cursor:pointer}",
      Q + ".mxph-team[aria-pressed=true]{box-shadow:inset 0 0 0 2.5px var(--gold-300);background:var(--ink-3)}",
      Q + ".mxph-team i{display:block;width:1.1rem;height:1.1rem;border-radius:.25rem;background:var(--mk,#888);box-shadow:inset 0 0 0 1px rgba(255,255,255,.3)}",
      Q + ".mxph-team:focus-visible{outline:none;box-shadow:var(--focus-ring)}",
      Q + ".mxph-num{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:.5rem;align-items:center}",
      Q + ".mxph-num input{min-height:3rem;font:800 var(--fs-xl)/1 var(--font-ui);text-align:center;letter-spacing:.05em}",
      Q + ".mxph-num input[aria-invalid=true]{box-shadow:inset 0 0 0 2px #ff9d8a}",
      Q + ".mxph-nst{margin:0;min-height:1.2em;font:var(--fw-ui) var(--fs-sm)/1.35 var(--font-ui);color:var(--text-2)}",
      Q + ".mxph-nst.is-bad{color:#ffb4a6}",
      Q + ".mxph-nst.is-ok{color:#9fe0a8}",
      Q + ".mxph-free{display:flex;flex-wrap:wrap;justify-content:center;gap:.4rem}",
      Q + ".mxph-free:empty{display:none}",
      Q + ".mxph-free button{min-width:3.2rem;min-height:2.75rem !important}",
      Q + ".mxph-taken{margin:0;text-align:left;border-radius:var(--r-md);background:var(--ink-2);box-shadow:var(--well-edge)}",
      Q + ".mxph-taken summary{min-height:2.75rem;display:flex;align-items:center;padding:0 .85rem;font:var(--fw-ui-strong) var(--fs-sm)/1.2 var(--font-ui);color:var(--text-1);cursor:pointer}",
      Q + ".mxph-taken ul{list-style:none;margin:0;padding:.2rem .7rem .7rem;display:flex;flex-wrap:wrap;gap:.3rem .5rem;max-height:12rem;overflow:auto}",
      Q + ".mxph-taken li{font:var(--fw-ui) var(--fs-xs)/1.35 var(--font-ui);color:var(--text-2)}",
      Q + ".mxph-taken li b{color:var(--text-1)}",
      Q + ".mxph-rs{list-style:none;margin:0;padding:0;display:grid;gap:.3rem;text-align:left}",
      Q + ".mxph-rs li{display:flex;align-items:center;gap:.5rem;min-height:2rem;padding:.2rem .5rem;border-radius:.5rem;background:var(--ink-2);font:var(--fw-ui) var(--fs-sm)/1.2 var(--font-ui);color:var(--text-1)}",
      Q + ".mxph-rs li i{flex:none;width:.85rem;height:.85rem;border-radius:50%;background:var(--seat,#888)}",
      Q + ".mxph-rs li span{flex:1 1 auto;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}",
      Q + ".mxph-rs li em{flex:none;font-style:normal;color:var(--text-2)}"
    ].join("\n");
    document.head.appendChild(st);
  }
  function ord(n) { var t = n % 100; return n + ((t >= 11 && t <= 13) ? "th" : (["th", "st", "nd", "rd"][n % 10] || "th")); }
  function plural(n, w) { return n + " " + w + (n === 1 ? "" : "s"); }
  function mkStyle(mk) { return mk ? "--mk:" + mk[0] + ";--mk-ink:" + mk[1] : ""; }
  function mkOf(b) { return MXA && MXA.mk ? MXA.mk(b) : ["#3a3a44", "#fff"]; }
  function card(id, cls) { return '<div class="mx-card' + (id != null ? " is-up" : "") + (cls ? " " + cls : "") + '">' + (MXA && MXA.cardInner ? MXA.cardInner(id) : "") + "</div>"; }
  function chip(id) { return id == null || !MXA ? "" : '<span class="mx-tw__c' + (MXA.chipRed(id) ? " is-red" : "") + '">' + MXA.chip(id) + "</span>"; }
  function plate(p, mk, red) { return p == null ? "" : '<span class="mx-pl' + (red ? " is-red" : "") + '" style="' + mkStyle(mk) + '">' + p + "</span>"; }
  function cardName(id) { if (id == null || !MXA) return ""; var c = MXA.info(id), R = { 11: "Jack", 12: "Queen", 13: "King", 14: "Ace", 15: "Joker" }; return c.r === 15 ? "a Joker" : (c.r === 14 || c.r === 8 ? "an " : "a ") + (R[c.r] || c.r) + ({ S: " of Spades", H: " of Hearts", D: " of Diamonds", C: " of Clubs", J: "" }[c.s] || ""); }
  function remember() { try { return JSON.parse(localStorage.getItem(LKEY) || "null") || {}; } catch (e) { return {}; } }
  function keepPick(num, bike) { try { localStorage.setItem(LKEY, JSON.stringify({ num: num, bike: bike })); } catch (e) { } }
  function cleanNum(v) { return String(v == null ? "" : v).replace(/\D/g, "").slice(0, 3); }

  P.definePhone(ID, {
    show: function (st, ask, api) {
      css();
      var esc = api.esc, me = st.me || {}, R = st.race, se = st.season, pn = st.panel;
      var A = api.ask && api.ask.st ? api.ask : null;
      var asking = !st.afk && api.asking() && !!A && A.st.step === st.step && sentStep !== st.step;
      var kind = asking ? A.st.ask : null;
      if (autoLocal != null && autoLocal === !!st.auto) autoLocal = null;
      if (autoLocal != null && Date.now() - autoAt > 2000) { autoAt = Date.now(); api.view({ auto: autoLocal }); }   // the TV has not confirmed the switch yet: say it again
      var isAuto = autoLocal != null ? autoLocal : !!st.auto;
      var title = "Motocross War", sub = "Watch the TV.";
      if (st.ph === "signup") {
        var my = (st.su && st.su.mine) || {};
        if (asking) { title = "Your bike"; sub = "Pick a team and a number for " + (st.su ? st.su.year + " " + st.su.series : "the season") + "."; }
        else if (my.ready) { title = "#" + my.num + " · " + (my.bike || ""); sub = "Ready. Waiting for the other riders."; }
        else { title = "Sign-up"; sub = "Pick your number and team when the TV asks."; }
      } else if (st.ph === "over" || (se && se.over)) { title = "Season over"; sub = pn && pn.title ? pn.title : se ? "You finished " + ord(se.place) + " with " + plural(se.pts, "point") : ""; }
      else if (R && (st.ph === "race" || st.ph === "gate")) {
        if (!R.inRace) { title = "Watching " + R.label; sub = "You're not in this race."; }
        else if (R.gate) { title = "On the gate"; sub = R.label + " · " + R.n + " riders. The gate drops on the TV."; }
        else if (asking && kind === "war") { title = R.warN > 1 ? (R.warN === 2 ? "Double war!" : R.warN === 3 ? "Triple war!" : "War x" + R.warN + "!") : "War!"; sub = "Lay 3 face down, then turn the 4th: it decides."; }
        else if (asking) { title = "Flip!"; sub = "Lap " + R.lap + " of " + R.len + " · your card turns as the leader starts the lap."; }
        else if (R.out) { title = R.dnf === "crash" ? "Crashed out" : "Out of cards"; sub = "Watch the rest of " + R.label + " on the TV."; }
        else if (R.over) { title = ord(R.place) + " of " + R.n; sub = "Checkered flag. Watch the TV."; }
        else { var py = R.you && R.you.tag === "down" ? "Down: getting going again" : ord(R.you ? R.you.place : R.place) + " of " + R.n; title = py; sub = R.label + " · lap " + R.lap + " of " + R.len + (isAuto ? " · Auto flips for you" : ""); }
      } else if (pn) {
        var mr = pn.res && pn.res.mine ? pn.res.mine[api.color()] : null;
        if (pn.kind === "results") {   /* mxfix1: a win said like a win ("You win Moto 2!"), a podium like a podium */
          var lb = pn.res && pn.res.label ? pn.res.label : "", pod = mr && mr.p > 1 && mr.p <= 3 && pn.res && pn.res.fin;
          title = mr && mr.p === 1 ? "You win" + (lb ? " " + lb : "") + "!" : pod ? "You finished " + ord(mr.p) + "!" : pn.title;
          sub = mr ? (mr.p === 1 ? (pn.title || "") + " · 1st of " + mr.of : pod ? "On the podium in " + (lb || "the race") + " · " + pn.res.win + " wins" : "You finished " + ord(mr.p) + " of " + mr.of) + (mr.tag ? " · " + mr.tag : "") + (mr.dnf ? " · DNF: crash" : "") + (mr.pts ? " · +" + mr.pts + " pts" : "") : (pn.res ? pn.res.win + " wins" : ""); }
        else if (pn.kind === "lineup") { var ml = pn.mine ? pn.mine[api.color()] : null; title = pn.title; sub = ml ? (/^seeded/.test(ml) ? "You're " + ml + "." : "You ride " + ml + ".") + " Watch the TV." : "Watch the TV."; }
        else if (pn.kind === "podium" || pn.kind === "final") { title = pn.title; sub = (pn.pod || []).map(function (x, i) { return (i + 1) + ". " + x; }).join(" · "); }
        else { title = pn.title || "Season standings"; sub = pn.next ? "Next: " + pn.next : "Watch the TV."; }
      }
      var who = '<div class="mxph-who' + (asking ? " is-turn" : "") + '" style="--seat:' + esc(me.hex || "#e7ca90") + '">' + (me.plate != null ? plate(me.plate, me.mk, me.red) : '<span class="mxph-tok" aria-hidden="true">' + esc(((me.name || "?").trim().charAt(0) || "?").toUpperCase()) + "</span>") +
        "<div><h1>" + esc(title) + "</h1><p>" + esc(sub) + "</p></div></div>";
      var html = '<div class="pgph mxph">' + (st.afk ? api.afkHTML("mxTake") : "") + who;
      if (st.ph === "signup" && st.su) html += asking && kind === "signup" ? signupHTML(st, api) : readyHTML(st, api);
      else if (R && (st.ph === "race" || st.ph === "gate")) {
        if (R.inRace) {
          html += '<div class="mxph-stats"><div class="mxph-stat"><b>' + (R.out ? "Out" : R.gate ? "-" : ord(R.you ? R.you.place : R.place)) + "</b><span>of " + R.n + '</span></div><div class="mxph-stat"><b>' + (R.out ? 0 : R.cnt) + "</b><span>" + (R.cnt === 1 ? "card" : "cards") + '</span></div><div class="mxph-stat"><b>' + (R.gate ? 0 : R.lap) + "</b><span>lap of " + R.len + "</span></div></div>";
          html += youHTML(R, api);
          if (!R.out && !R.over) html += '<button type="button" class="mxph-auto" role="switch" aria-checked="' + isAuto + '" id="mxAuto"><span>Auto<small>' + (isAuto ? "On: the TV flips for you every lap" : "Off: you press Flip every lap") + '</small></span><span class="bg-toggle" aria-hidden="true"></span></button>';
          if (asking && (kind === "flip" || kind === "war")) html += '<button type="button" class="opt bg-btn bg-btn--block opt--seat mxph-go" data-seat="' + (api.seat() || 1) + '" id="mxGo">' + (kind === "war" ? "Lay war cards" : "Flip") + "<small>" + (kind === "war" ? "3 face down + the 4th up" : "Lap " + R.lap + " of " + R.len) + "</small></button>" + (R.war && (R.war.won || R.war.lost || R.war.won === false) ? warHTML(R.war) : "");
          else if (R.war && (R.warOn || R.war.won || R.war.lost)) html += warHTML(R.war);
          else if (!R.gate) html += '<div class="mxph-box' + (R.yellow ? " is-yellow" : "") + '" role="status">' + (R.last != null ? card(R.last) : "") + "<span>" + (R.last != null ? "Your card: " + esc(cardName(R.last)) + ". " : "") + (R.out ? (R.dnf === "crash" ? "You crashed out of the race." : "You're out of cards.") : R.yellow ? "Yellow flag: no passing there." : R.need && !isAuto ? "Wait for the TV to ask you..." : "Watch the TV.") + "</span></div>";
          if (R.cr && !R.out) html += '<p class="mxph-last">' + (R.cr > 1 ? "You crashed " + R.cr + " times and got back on." : "You crashed and got back on.") + "</p>";
        }
        if (R.hs) html += '<p class="mxph-last">Holeshot: ' + esc(R.hs) + "</p>";
        html += R.tw && R.tw.length ? timingHTML(R, api) : runHTML(R.top, api);
      } else if (se) {
        html += '<div class="mxph-stats"><div class="mxph-stat"><b>' + (se.place ? ord(se.place) : "-") + "</b><span>season</span></div><div class=\"mxph-stat\"><b>" + se.pts + "</b><span>points</span></div><div class=\"mxph-stat\"><b>" + se.ri + "</b><span>round of " + se.nr + "</span></div></div>";
        if (se.leader) html += '<p class="mxph-last">Red plate (the points leader): ' + esc(se.leader) + "</p>";
      }
      if (st.line && st.ph !== "signup") html += '<p class="mxph-last">' + esc(st.line) + "</p>";
      if (se) html += '<p class="mxph-foot">' + esc(se.year + " " + se.name + " · round " + se.ri + " of " + se.nr + " · " + se.city) + "</p>";
      html += "</div>";
      var act = document.activeElement, numFocus = act && act.id === "mxNum";
      api.put(html);
      // ---- the controls ----
      var go = document.getElementById("mxGo");
      if (go) go.onclick = function () { if (!api.act("flip", {})) return; sentStep = st.step; go.disabled = true; go.innerHTML = "Sent<small>" + (kind === "war" ? "Your war cards go down" : "Your card turns at the line") + "</small>"; };
      var au = document.getElementById("mxAuto");
      if (au) au.onclick = function () { autoLocal = !isAuto; autoAt = Date.now(); api.view({ auto: autoLocal }); au.setAttribute("aria-checked", String(autoLocal)); au.querySelector("small").textContent = autoLocal ? "On: the TV flips for you every lap" : "Off: you press Flip every lap"; };
      var tk = document.getElementById("mxTake"); if (tk) tk.onclick = function () { api.take(); tk.disabled = true; };
      if (st.ph === "signup" && asking && kind === "signup") wireSignup(st, api, numFocus);
      else if (asking && isAuto && (kind === "flip" || kind === "war")) {   // Auto is on but the TV still asked (the switch crossed the ask): answer it
        var stepNow = st.step;
        setTimeout(function () { if (sentStep === stepNow || !api.asking()) return; if (api.act("flip", {})) sentStep = stepNow; }, 350);
      } else if (asking) api.focusFirst();
    },
    reset: function () { sentStep = ""; autoLocal = null; su = { key: "", num: "", bike: "" }; }
  });

  function warHTML(w) {
    var down = Math.min(3, w.down || 0), h = '<div class="mxph-box is-war" role="status"><span class="mxph-pile" aria-hidden="true">';
    for (var i = 0; i < down; i++) h += '<span style="left:' + (i * 0.35) + 'rem">' + card(null) + "</span>";
    h += '<span style="left:' + (down * 0.35 + .2) + 'rem">' + card(w.up, w.won ? "is-win" : "") + "</span></span><span>" +
      (w.n > 1 ? (w.n === 2 ? "Double war" : w.n === 3 ? "Triple war" : "War x" + w.n) : "War") + ": " + (w.down || 0) + " down, the 4th up: " + cardName(w.up) + "." +
      (w.won ? " You win the war!" : w.lost === "out" ? " You lose it: crashed out." : w.lost === "remount" ? " You lose it: down, and you remount." : w.won === false ? " You lose the war." : "") + "</span></div>";
    return h;
  }
  /* the YOU readout: this rider's place and gap now, the last and best lap, and what the lap just ridden was worth (the TV computed it) */
  function secT(x) { x = Math.abs(+x || 0); return x.toFixed(1) + " s"; }
  function youHTML(R, api) {
    var y = R.you; if (!y) return "";
    var esc = api.esc;
    var gap = R.gate ? "the gate drops on the TV" : y.tag === "down" ? "down: getting going again" : y.tag === "out" ? "crashed out of the race" : y.tag === "pits" ? "pulled off: out of cards" : y.place === 1 ? "leading the race" : (y.gap || "") + " to the leader" + (y.int != null ? " · " + secT(y.int) + " to the rider ahead" : "");
    return '<div class="mxph-you' + (y.tag === "down" ? " is-down" : "") + (y.tag === "out" || y.tag === "pits" ? " is-out" : "") + '" role="status"><div class="mxph-you__top"><b>' + (R.gate ? "On the gate" : ord(y.place) + " of " + y.of) + "</b><span>" + esc(gap) + "</span></div>" +
      '<p class="mxph-you__laps">Last lap ' + esc(y.last || "-") + " · Best " + esc(y.best || "-") + (y.fl ? " · fastest of the race" : "") + "</p>" +
      (y.line ? '<p class="mxph-you__line">' + esc(y.line) + "</p>" : "") +
      (y.why && y.why.length ? '<ul class="mxph-why" aria-label="What the lap was worth">' + y.why.map(function (w) { return '<li class="' + (w[2] > 0 ? "is-up" : w[2] < 0 ? "is-dn" : "") + '"><span>' + esc(w[0]) + "</span>" + (w[1] ? "<b>" + esc(w[1]) + "</b>" : "") + "</li>"; }).join("") + "</ul>" : "") + "</div>";
  }
  /* the timing: every rider (two compact columns for a big gate), the gap in seconds or the laps down, DNF; this rider's row is ringed */
  /* mxfix1: two columns (a big gate) write the surname in a condensed face (the TV sends it: r[11], art.js shortNames, the same rule as everywhere) and the
     gaps short (r[10]: "+2.09", "+1:10.3"), so the names read in full on a phone */
  function timingHTML(R, api) {
    var tw = R.tw, esc = api.esc, n = tw.length, two = n > 24;
    var mine = two && !tw.every(function (r) { return r[11]; }) && MXA && MXA.shortNames ? MXA.shortNames(tw.map(function (r) { return String(r[3] || ""); })) : null;
    var h = '<p class="mxph-lbl">Timing · gap to the leader' + (R.fl ? " · fastest lap " + esc(R.fl) : "") + '</p><ol class="mxph-tw' + (two ? " is-two" : "") + '" style="--rows:' + Math.ceil(n / 2) + '" aria-label="Timing">';
    tw.forEach(function (r, i) {
      var short = r[11] || (mine ? mine[i] : String(r[3] || "").split(" ").pop()), tag = r[5], gap = two && typeof r[10] === "string" ? r[10] : r[4];
      h += '<li class="' + (r[0] === R.meS ? "is-me" : "") + (tag === "down" ? " is-down" : "") + (tag === "out" || tag === "pits" ? " is-out" : "") + '"><span class="mxph-p">' + r[1] + "</span>" + plate(r[2], r[8], r[9]) + '<span class="mxph-n">' + esc(two ? short : r[3]) + '</span><span class="mxph-g">' + esc(gap) + "</span></li>";
    });
    return h + "</ol>";
  }
  function runHTML(top, api) {
    if (!top || !top.length) return "";
    var esc = api.esc, h = '<p class="mxph-lbl">Running order · cards held</p><ol class="mxph-run" aria-label="Running order">';
    top.forEach(function (r, i) {
      if (i > 0 && r.p > top[i - 1].p + 1) h += '<li class="is-gap" aria-hidden="true">...</li>';
      h += '<li class="' + (r.me ? "is-me" : "") + '"><span class="mxph-p">' + r.p + "</span>" + plate(r.pl, r.mk, r.red) + '<span class="mxph-n">' + esc(r.nm) + (r.me ? " (you)" : "") + '</span><span class="mxph-k">' + (r.k < 0 ? "out" : r.k) + "</span></li>";
    });
    return h + "</ol>";
  }
  function readyHTML(st, api) {
    var esc = api.esc, rs = st.su.riders || [];
    return '<p class="mxph-lbl">This table · ' + rs.filter(function (r) { return r.ready; }).length + " of " + rs.length + ' ready</p><ul class="mxph-rs">' + rs.map(function (r) {
      return '<li style="--seat:' + esc(r.hex) + '"><i aria-hidden="true"></i><span>' + esc(r.n) + (r.cpu ? " · computer" : "") + "</span>" + (r.ready ? plate(r.num, mkOf(r.bike), false) + '<span class="mx-mk" style="' + mkStyle(mkOf(r.bike)) + '">' + esc(r.bike) + "</span>" : "<em>choosing...</em>") + "</li>";
    }).join("") + "</ul>";
  }
  /* the sign-up: the season's teams, the number (empty = any free one), its check against the taken numbers, Ready */
  function takenMap(st) { var m = {}; (st.su.taken || []).forEach(function (t) { m[t[0]] = t[1]; }); return m; }
  function numCheck(st) {
    var v = su.num, m = takenMap(st);
    if (v === "") return { ok: true, t: "Any free number: the TV picks one for you." };
    var n = +v; if (m[n]) return { ok: false, n: n, t: "#" + n + " is taken: " + m[n] + "." };
    return { ok: true, n: n, t: "#" + n + " is free in " + st.su.year + "." };
  }
  function freeNear(st, n, k) { var m = takenMap(st), out = []; for (var d = 1; d < 1000 && out.length < k; d++) { if (n - d >= 1 && !m[n - d]) out.push(n - d); if (out.length < k && n + d <= 999 && !m[n + d]) out.push(n + d); } return out.sort(function (a, b) { return a - b; }); }
  function signupHTML(st, api) {
    var esc = api.esc, S0 = st.su, mine = S0.mine || {}, key = S0.year + "|" + S0.series;
    if (su.key !== key) {   // the first ask of this sign-up: the remembered pick when it fits this season
      var r = remember(); su.key = key;
      su.bike = S0.makes.indexOf(mine.bike) >= 0 ? mine.bike : S0.makes[0];
      if (r.bike && S0.makes.indexOf(r.bike) >= 0) su.bike = r.bike;
      su.num = r.num != null && r.num !== "" && !takenMap(st)[+r.num] ? String(r.num) : "";
    }
    if (S0.makes.indexOf(su.bike) < 0) su.bike = S0.makes[0];
    var taken = S0.taken || [];
    return (mine.err ? '<p class="mxph-nst is-bad" role="alert">' + esc(mine.err) + "</p>" : "") +
      '<p class="mxph-lbl">Team · the makes of ' + esc(String(S0.year)) + '</p><div class="mxph-teams" role="group" aria-label="Team">' + S0.makes.map(function (b) {
        return '<button type="button" class="mxph-team" data-bike="' + esc(b) + '" aria-pressed="' + (b === su.bike) + '" style="' + mkStyle(mkOf(b)) + '"><i aria-hidden="true"></i>' + esc(b) + "</button>";
      }).join("") + "</div>" +
      '<p class="mxph-lbl">Number</p><div class="mxph-num"><input class="bg-input" id="mxNum" type="text" inputmode="numeric" maxlength="3" autocomplete="off" aria-label="Your number (empty: any free number)" placeholder="Any" value="' + esc(su.num) + '">' +
      '<button type="button" class="bg-btn bg-btn--secondary mxph-alt" id="mxAny">Pick for me</button></div>' +
      '<p class="mxph-nst" id="mxNst" aria-live="polite"></p><div class="mxph-free" id="mxFree"></div>' +
      '<details class="mxph-taken"><summary>Taken numbers in ' + esc(String(S0.year)) + " (" + taken.length + ")</summary><ul>" + taken.map(function (t) { return "<li><b>" + t[0] + "</b> " + esc(t[1]) + "</li>"; }).join("") + "</ul></details>" +
      '<button type="button" class="opt bg-btn bg-btn--block opt--seat mxph-go" data-seat="' + (api.seat() || 1) + '" id="mxReady">Ready<small id="mxReadySub"></small></button>';
  }
  function wireSignup(st, api, numFocus) {
    var inp = document.getElementById("mxNum"), nst = document.getElementById("mxNst"), fr = document.getElementById("mxFree"), rd = document.getElementById("mxReady"), any = document.getElementById("mxAny");
    function paint() {
      var x = numCheck(st);
      nst.textContent = x.t; nst.className = "mxph-nst" + (!x.ok ? " is-bad" : su.num !== "" ? " is-ok" : "");
      inp.setAttribute("aria-invalid", String(!x.ok));
      var want = !x.ok ? freeNear(st, x.n, 4) : [];
      fr.innerHTML = want.map(function (n) { return '<button type="button" class="bg-btn bg-btn--secondary" data-free="' + n + '" aria-label="Take number ' + n + '">' + n + "</button>"; }).join("");
      Array.prototype.forEach.call(fr.querySelectorAll("[data-free]"), function (b) { b.onclick = function () { su.num = b.getAttribute("data-free"); inp.value = su.num; paint(); }; });
      rd.disabled = !x.ok;
      document.getElementById("mxReadySub").textContent = (su.num === "" ? "Any free number" : "#" + su.num) + " · " + su.bike;
    }
    inp.addEventListener("input", function () { var v = cleanNum(inp.value); if (v !== inp.value) inp.value = v; su.num = v; paint(); });
    any.onclick = function () { su.num = ""; inp.value = ""; paint(); };
    Array.prototype.forEach.call(document.querySelectorAll(".mxph-team"), function (b) { b.onclick = function () { su.bike = b.getAttribute("data-bike"); Array.prototype.forEach.call(document.querySelectorAll(".mxph-team"), function (x) { x.setAttribute("aria-pressed", String(x === b)); }); paint(); }; });
    rd.onclick = function () {
      if (!numCheck(st).ok) return;
      if (!api.act("ready", { num: su.num === "" ? null : +su.num, bike: su.bike })) return;
      sentStep = st.step; keepPick(su.num, su.bike); rd.disabled = true; rd.innerHTML = "Sent<small>Waiting for the TV</small>";
    };
    paint();
    if (numFocus) { try { inp.focus({ preventScroll: true }); var L = inp.value.length; inp.setSelectionRange(L, L); } catch (e) { } }
  }
})();
