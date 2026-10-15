/* Scattergories-style game — the player's screen: writing form, scoring review with challenges + votes, round and game results.
   It only reads a snapshot S (Scatter.Engine.snapshot) and sends intents, so the phone game and the Party-mode phones share it. */
(function(g){
"use strict";
var Sc=g.Scatter=g.Scatter||{}, E=Sc.Engine;
function esc(s){ return String(s==null?"":s).replace(/[&<>"]/g,function(c){return{"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c];}); }
var PCOL=["#e23b3b","#2b7be0","#27a758","#eec21b","#a65bd6","#19b5b0","#f08a24","#ec6aa8"];
var CSS=[
".scT{width:100%;color:#fff;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif}",
".scTop{display:flex;align-items:center;gap:12px;justify-content:center;margin:6px 0}",
".scLetter{width:84px;height:84px;border-radius:18px;background:linear-gradient(145deg,#ffe36e,#f2a31b);color:#3a1d00;display:flex;align-items:center;justify-content:center;font:900 56px Georgia,serif;box-shadow:0 6px 0 #a56200,0 10px 18px #0007;transform:rotate(-4deg)}",
".scLetter.kw{width:auto;padding:0 14px;font-size:30px;letter-spacing:3px;height:64px}",
".scTimer{font:900 40px system-ui;min-width:112px;text-align:center;padding:4px 10px;border-radius:14px;background:#00000066}.scTimer.low{background:#b32b1f;animation:scpulse .6s infinite}",
"@keyframes scpulse{50%{opacity:.6}}",
".scBar{height:8px;border-radius:99px;background:#00000055;overflow:hidden;margin:4px 0 8px}.scBar i{display:block;height:100%;background:linear-gradient(90deg,#27a758,#eec21b,#e23b3b);transition:width .5s linear}",
".scHint{text-align:center;font-size:12.5px;color:#e6d9c4;margin-bottom:6px}",
".scRow{display:flex;gap:8px;align-items:center;background:#00000044;border-radius:12px;padding:7px 9px;margin:5px 0}",
".scRow .n{width:22px;font-weight:900;opacity:.7;text-align:right;flex:none}",
".scRow .lb{flex:1;font-size:13.5px;font-weight:700;line-height:1.2;min-width:0}",
".scRow .ins{display:flex;flex-direction:column;gap:4px;width:52%;flex:none}",
".scRow input{width:100%;padding:9px 10px;border-radius:9px;border:2px solid #ffffff33;background:#fffdf6;color:#1a1200;font-size:16px;font-weight:700}",
".scRow input:focus{outline:none;border-color:#f2bf24;box-shadow:0 0 0 3px #f2bf2466}",
".scRow input.good{border-color:#2f9e44}.scRow input.bad{border-color:#d6322b}",
".scBtns{display:flex;gap:8px;justify-content:center;flex-wrap:wrap;margin:10px 0}",
".scBtns button,.scModal button.b{background:#2a1f45;color:#fff;border:1px solid #ffffff66;border-radius:12px;padding:12px 16px;font-size:15px;font-weight:900;cursor:pointer}",
".scBtns button.pri,.scModal button.pri{background:#e8590c;border-color:#ffa56a}.scBtns button[disabled]{opacity:.4}",
".scSlot{background:#00000044;border-radius:12px;padding:8px 10px;margin:6px 0}",
".scCat{font-weight:900;font-size:13.5px;margin-bottom:4px}.scCat span{opacity:.6;margin-right:4px}",
".scAns{display:inline-flex;align-items:center;gap:6px;border-radius:999px;padding:5px 11px;margin:3px 4px 3px 0;font-size:13px;font-weight:800;border:2px solid transparent;cursor:default;max-width:100%;overflow-wrap:anywhere}",
".scAns .w{opacity:.8;font-weight:600;font-size:11px}.scAns b{margin-left:2px}",
".scAns.ok{background:#1f6b36;border-color:#5fe08a}.scAns.dup{background:#6b2a1f;border-color:#ff8a6a;text-decoration:line-through;opacity:.85}.scAns.invalid{background:#444;border-color:#888;opacity:.7;text-decoration:line-through}",
".scAns.chal{cursor:pointer}.scAns.me{box-shadow:0 0 0 2px #ffd23f}",
".scAns .x{font-size:10px;font-weight:700;opacity:.85}",
".scTot{display:flex;flex-wrap:wrap;gap:6px;justify-content:center;margin:8px 0}.scTot div{background:#00000066;border-radius:999px;padding:6px 12px;font-weight:800;font-size:13px;border:2px solid transparent}.scTot b{color:#ffd23f}",
"table.scTab{width:100%;border-collapse:collapse;font-size:14px;margin:6px 0}table.scTab th,table.scTab td{padding:7px 5px;text-align:right;border-bottom:1px solid #ffffff22}table.scTab th:first-child,table.scTab td:first-child{text-align:left}",
".scModal{position:fixed;inset:0;z-index:80;background:#0b0618ee;display:none;align-items:center;justify-content:center;padding:14px}.scModal.show{display:flex}",
".scModal .sh{width:min(100%,420px);background:#26193f;border:2px solid #ffffff55;border-radius:18px;padding:16px;text-align:center}",
".scModal h3{margin:0 0 8px;font-size:18px}.scModal .big{font:900 24px Georgia,serif;color:#ffd23f;margin:8px 0}",
".scLet{display:flex;flex-wrap:wrap;gap:6px;justify-content:center;margin:8px 0}.scLet button{width:40px;height:40px;border-radius:10px;border:2px solid #ffffff55;background:#2a1f45;color:#fff;font:900 18px Georgia,serif}.scLet button[disabled]{opacity:.25}",
"@media(min-width:520px){.scRow .ins{width:46%}}"
].join("\n");
/* luxe mode (cfg.luxe: the Scattergories page on ui/theme.css, step 5): a paper pad under an ink header (the letter die and the gold timer ring),
   ruled lines, category numbers in the margin; static paper and gradients only, nothing here animates */
var LX=[
".scT.is-lx{width:100%;color:var(--text-1);font-family:var(--font-ui)}",
".scPad{position:relative}",
".scHead{position:sticky;top:var(--scTop,3.75rem);z-index:4;display:grid;grid-template-columns:auto minmax(0,1fr) auto;align-items:center;gap:.875rem;padding:1.125rem .875rem .75rem;border-radius:var(--r-lg) var(--r-lg) 0 0;color:var(--text-1);background:linear-gradient(180deg,#1b2040,#10142a);box-shadow:inset 0 0 0 1px var(--line-gold),inset 0 1px 0 rgba(231,202,144,.45)}",
".scHead.is-still{grid-template-columns:auto minmax(0,1fr)}",
".scHead::before{content:\"\";position:absolute;left:1.25rem;right:1.25rem;top:.4rem;height:.3rem;pointer-events:none;background:radial-gradient(circle,rgba(231,202,144,.6) 0,rgba(231,202,144,.6) .11rem,rgba(231,202,144,0) .14rem) 0 0/.9rem .3rem repeat-x}",
".scT .scDie{flex:none;width:3.75rem;height:3.75rem;font:400 2.25rem/1 var(--font-display);letter-spacing:0;transform:rotate(-4deg);color:var(--text-on-gold)}",
".scT .scDie>svg{width:58%;height:58%}",
".scT .scDie.is-kw{width:auto;min-width:3.75rem;height:3rem;padding:0 .75rem;font-size:1.25rem;letter-spacing:.12em;border-radius:.9rem}",
".scHeadTxt{display:grid;gap:.25rem;min-width:0}",
".scRule{font:var(--fw-ui) var(--fs-md)/1.3 var(--font-ui);color:var(--text-1);text-wrap:balance}",
".scRule .nw{white-space:nowrap}",
".scRule .scLab{font-weight:var(--fw-ui-strong);color:var(--gold-100)}",
"html:not([data-tv]) .scHead.is-kw{grid-template-columns:minmax(0,1fr) auto;grid-template-areas:\"die ring\" \"txt txt\"}",
"html:not([data-tv]) .scHead.is-kw.is-still{grid-template-columns:minmax(0,1fr);grid-template-areas:\"die\" \"txt\"}",
"html:not([data-tv]) .scHead.is-kw .scDie{grid-area:die;justify-self:start}html:not([data-tv]) .scHead.is-kw .scRing{grid-area:ring}html:not([data-tv]) .scHead.is-kw .scHeadTxt{grid-area:txt}",
".scRule b{color:var(--gold-100);font:400 var(--fs-xl)/1 var(--font-display)}",
".scBody>*{position:relative}",
".scT .scRing{width:4rem;height:4rem}.scT .scRing .bg-countdown__num{font-size:var(--fs-lg)}",
".scBody{position:relative;padding:.25rem .875rem .5rem 0;border-radius:0 0 var(--r-lg) var(--r-lg);box-shadow:inset 0 1px 0 rgba(90,66,32,.35)}",
".scBody::before{content:\"\";position:absolute;top:0;bottom:0;left:2.75rem;width:1px;background:rgba(196,72,72,.4);pointer-events:none}",
".scNote{margin:0;padding:.625rem 0 .125rem 3.5rem;font:var(--fw-ui) var(--fs-sm)/1.35 var(--font-ui);color:var(--text-on-paper-muted)}",
".scSheet,.scSlots{list-style:none;margin:0;padding:0}",
".scRow{display:grid;grid-template-columns:2.75rem minmax(0,1fr);align-items:start;padding:.625rem 0;border-bottom:1px solid rgba(46,84,160,.24)}",
".scRow .n,.scCat .n{text-align:center;font:400 var(--fs-xl)/1.1 var(--font-display);color:var(--gold-700)}",
".scRow .n{grid-row:1/3;padding-top:.05rem}",
".scRow .lb{display:block;padding:0 .25rem 0 .5rem;font:var(--fw-ui-strong) var(--fs-md)/1.25 var(--font-ui);color:var(--text-on-paper)}",
".scRow .scKwL{font:400 var(--fs-2xl)/1 var(--font-display);color:var(--gold-700)}",
".scRow .ins{grid-column:2;display:grid;gap:.5rem;padding:.375rem 0 0 .5rem}",
".scRow input{width:100%;min-height:var(--tap);margin:0;padding:.5rem .75rem;border:0;border-bottom:2px solid rgba(35,58,138,.6);border-radius:.5rem .5rem 0 0;background:rgba(255,255,255,.62);color:#16286b;font:italic 400 var(--fs-xl)/1.2 var(--font-display)}",
".scRow input::placeholder{color:#5b566e;opacity:1;font-style:italic}",
".scRow input:focus,.scRow input.is-focus{outline:none;background:#fff;box-shadow:var(--focus-ring);position:relative;z-index:2}",
".scRow input.good{border-bottom-color:#2a7d45;background:#eefaf1}.scRow input.bad{border-bottom:3px dashed #b3392f;background:#fdeeea}",
".scDock{position:sticky;bottom:0;z-index:4;margin:0;padding:.875rem 0 calc(env(safe-area-inset-bottom,0px) + .75rem);background:linear-gradient(180deg,rgba(8,10,21,0),var(--ink-1) 34%)}",
".scSlot{padding:.625rem 0 .75rem;border-bottom:1px solid rgba(46,84,160,.24)}",
".scCat{display:grid;grid-template-columns:2.75rem minmax(0,1fr);align-items:baseline;font:var(--fw-ui-strong) var(--fs-md)/1.25 var(--font-ui);color:var(--text-on-paper)}",
".scCat .scKwL{font:400 var(--fs-xl)/1 var(--font-display);color:var(--gold-700);margin-right:.35rem}",
".scChips{display:flex;flex-wrap:wrap;gap:.5rem;padding:.5rem .5rem 0 3.25rem}",
".scAns{display:inline-grid;grid-template-columns:auto minmax(0,1fr) auto;grid-template-areas:\"ic t b\" \". cap cap\";align-items:center;column-gap:.5rem;row-gap:.1rem;max-width:100%;min-height:2.5rem;margin:0;padding:.4rem .875rem .4rem .75rem;border:2px solid transparent;border-radius:var(--r-md);font:var(--fw-ui-strong) var(--fs-sm)/1.2 var(--font-ui);color:#10241a;text-align:left;overflow-wrap:anywhere;cursor:default}",
".scAns .ico{grid-area:ic;display:grid}.scAns .bg-ico{width:1em;height:1em}",
".scAns .t{grid-area:t}.scAns b{grid-area:b}",
".scAns .cap{grid-area:cap;display:flex;flex-wrap:wrap;gap:.05rem .5rem}",
".scAns .w{font:var(--fw-ui) var(--fs-micro)/1.2 var(--font-ui);letter-spacing:.02em}",
".scAns .x{font:var(--fw-ui) var(--fs-micro)/1.2 var(--font-ui)}",
".scAns b{display:inline-grid;place-items:center;min-width:1.5rem;height:1.5rem;padding:0 .4rem;border-radius:var(--r-pill);font:400 var(--fs-md)/1 var(--font-display);color:var(--text-on-gold);background:var(--gold-fill);box-shadow:inset 0 0 0 1px rgba(90,66,32,.35)}",
".scAns.ok{background:#d6efde;border-color:#2f8a4e;color:#0f2b1b}",
".scAns.dup{background:#f6dcd4;border-color:#b5513c;color:#4d1a0f}",
".scAns.invalid{background:#e6e2ec;border-color:#8a8697;color:#322f3d}",
".scAns.dup .t,.scAns.invalid .t{text-decoration:line-through}",
".scAns.me{box-shadow:0 0 0 .1875rem var(--gold-400)}",
".scAns.chal{min-height:var(--tap);cursor:pointer;touch-action:manipulation;box-shadow:0 2px 0 rgba(0,0,0,.2)}",
".scAns.chal.me{box-shadow:0 0 0 .1875rem var(--gold-400),0 2px 0 .1875rem rgba(0,0,0,.2)}",
".scAns.chal:focus{outline:none}",
".scAns.chal:focus-visible,.scAns.chal.is-focus{box-shadow:var(--focus-ring);position:relative;z-index:2}",
".scNone{padding:.25rem 0;font:var(--fw-ui) var(--fs-sm)/1.2 var(--font-ui);color:var(--text-on-paper-muted)}",
".scTotals{margin:.875rem 0 0}",
".scWin{display:flex;align-items:center;justify-content:center;gap:.6rem;margin:.875rem 0 0;font:400 var(--fs-2xl)/1.15 var(--font-display);color:var(--gold-100);text-align:center}",
".scWin .bg-ico{width:1.2em;height:1.2em;color:var(--gold-200)}",
".scTie{margin:.875rem 0 0;text-align:center;font:var(--fw-ui-strong) var(--fs-md)/1.35 var(--font-ui);color:var(--gold-100)}",
".scT .bg-scorepad{margin:.875rem 0 0}",
".scWait{display:grid;justify-items:center;gap:.5rem;padding:1.5rem 1rem 1.75rem 1rem;text-align:center}",
".scWait .bg-ico{width:2.25rem;height:2.25rem;color:var(--gold-700)}",
".scWait b{font:400 var(--fs-2xl)/1.15 var(--font-display);color:var(--text-on-paper)}",
".scWait p{margin:0;font:var(--fw-ui) var(--fs-md)/1.4 var(--font-ui);color:var(--text-on-paper-muted)}",
".scLet{display:grid;grid-template-columns:repeat(auto-fill,minmax(3.25rem,1fr));gap:.625rem;padding:1rem .875rem 1.25rem 3.5rem;margin:0}",
".scLet button{min-height:3.25rem;margin:0;padding:0;border:0;border-radius:22%;cursor:pointer;color:#1d1a2a;font:400 1.5rem/1 var(--font-display);background:radial-gradient(circle at 30% 25%,#fff 0,#f3ecdc 60%,#d8cdb6 100%);box-shadow:inset 0 -3px 0 rgba(90,70,40,.25),inset 0 2px 0 #fff,0 4px 10px -4px rgba(0,0,0,.6);touch-action:manipulation}",
".scLet button:focus{outline:none}.scLet button:focus-visible,.scLet button.is-focus{box-shadow:var(--focus-ring);position:relative;z-index:2}",
".scLet button[disabled]{opacity:.3;cursor:default}",
".scAnsBig{margin:.25rem 0 .5rem;font:400 var(--fs-3xl)/1.1 var(--font-display);color:var(--gold-100);overflow-wrap:anywhere}",
".scBtns2{display:grid;grid-template-columns:1fr 1fr;gap:.75rem;padding:var(--focus-room);margin:1rem calc(-1 * var(--focus-room)) 0}",
".scBtns2 .bg-btn{white-space:normal}",
".scShead{display:grid;gap:.25rem;margin-bottom:.5rem}",
"html[data-tv] .scHead{gap:1.25rem;padding:1rem 1.25rem .625rem}",
"html[data-tv] .scT .scDie:not(.is-kw){width:3rem;height:3rem;font-size:1.875rem}",
"html[data-tv] .scT .scDie.is-kw{height:2.75rem;font-size:1.25rem}",
"html[data-tv] .scT .scRing{width:3.5rem;height:3.5rem}",
"html[data-tv] .scBody{padding-right:1.5rem}",
"html[data-tv] .scRow{padding:.3rem 0}",
"html[data-tv] .scRow .lb{font-size:var(--fs-sm);line-height:1.2}",
"html[data-tv] .scRow .ins{padding-top:.1rem}",
"html[data-tv] .scRow input{min-height:2.25rem;padding:.2rem .75rem}",
"html[data-tv] .scDock{padding:.5rem 0 .5rem}",
"html[data-tv] .scDock .bg-btn{min-height:3rem}",
"html[data-tv] .scSlot{padding:.4rem 0 .5rem}",
"html[data-tv] .scSheet:not(.is-multi){display:grid;grid-auto-flow:column;grid-template-columns:repeat(2,minmax(0,1fr));grid-template-rows:repeat(var(--rows,6),auto);column-gap:2.5rem}",
"html[data-tv] .scSheet.is-multi .scRow{grid-template-columns:2.75rem minmax(0,.65fr) minmax(0,2.35fr);align-items:center;column-gap:.5rem}",
"html[data-tv] .scSheet.is-multi .scRow input{font-size:var(--fs-lg)}",
"html[data-tv] .scSheet.is-multi .scRow .n{grid-row:auto}",
"html[data-tv] .scSheet.is-multi .scRow .ins{grid-column:3;grid-template-columns:repeat(var(--per,3),minmax(0,1fr));gap:1.5rem;padding:.375rem .75rem}",
"html[data-tv] .scSlots{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));column-gap:2.5rem}",
"html[data-tv] .scChips{gap:1.5rem}",
"html[data-tv] .scLet{gap:1.5rem}",
"html[data-tv] .scBtns2{gap:1.5rem}"
].join("\n");
function injectCSS(luxe){ if(typeof document==="undefined"||document.getElementById("scatCss")) return; var s=document.createElement("style"); s.id="scatCss"; s.textContent=luxe?LX:CSS; document.head.appendChild(s); }
function mmss(t){ t=Math.max(0,Math.ceil(t)); return Math.floor(t/60)+":"+("0"+(t%60)).slice(-2); }

function create(cfg){
  var L=!!cfg.luxe, ic=function(n){ return L&&cfg.icon?cfg.icon(n):""; }, BGu=function(){ return L&&typeof window!=="undefined"&&window.BGUI&&window.BGUI.sheet?window.BGUI:null; };
  injectCSS(L);
  var root=cfg.root, S=null, built="", answers=null, deadline=0, tick=null, sent=false, shownVote={}, lastProg=0, ring=null;
  root.classList.add("scT"); if(L) root.classList.add("is-lx");
  function seatOf(i){ return cfg.seatOf?cfg.seatOf(i):(i%8)+1; }
  /* the timer ring is BGUI.countdown (gold arc, 4 updates a second, no continuous animation). The deadline stays the one the old timer used
     (setDeadlineIn moves it): the ring restarts from it, and shows m:ss */
  function stopRing(){ if(ring){ try{ ring.stop(); }catch(e){} ring=null; } }
  function startRing(sec){
    var B=BGu(), el=root.querySelector("#scTimer"); stopRing(); if(!B||!B.countdown||!el) return;
    function num(s){ var n=el.querySelector(".bg-countdown__num"); if(n) n.textContent=mmss(s); }
    ring=B.countdown(el,Math.max(1,sec),{low:10,onTick:num}); num(sec);
  }
  function halt(){ clearInterval(tick); stopRing(); }
  /* the sticky header and the dock cover part of the page: a focused answer is kept clear of both (a tap, the D-pad or Tab) */
  function barH(){ var b=document.querySelector(".bg-topbar"); return b?Math.round(b.getBoundingClientRect().height):0; }
  function syncTop(){ if(L) root.style.setProperty("--scTop",barH()+"px"); }
  if(L&&typeof window!=="undefined"){
    syncTop(); window.addEventListener("resize",syncTop); document.addEventListener("bgui:tv",function(){ setTimeout(syncTop,50); });
    root.addEventListener("focusin",function(e){
      var t=e.target; if(!t||!t.matches||!t.matches("input,.scAns.chal,.scLet button")) return;
      setTimeout(function(){
        if(!t.isConnected) return;
        var hd=root.querySelector(".scHead"), dk=root.querySelector(".scDock"), r=t.getBoundingClientRect(), top=hd?hd.getBoundingClientRect().bottom:barH(), pad=Math.round(window.innerHeight*0.03);
        if(r.top<top+pad) window.scrollBy(0,r.top-top-pad-12);
        else if(dk){ var db=dk.getBoundingClientRect().top; if(db<window.innerHeight&&r.bottom>db-pad) window.scrollBy(0,r.bottom-db+pad+12); }
      },30);
    });
  }
  var modal=document.createElement("div"); modal.className=L?"bg-sheet scModal":"scModal"; if(L) modal.id="scModal"; modal.innerHTML='<div class="sh" id="scsh"></div>'; document.body.appendChild(modal);
  /* a dialog: the classic overlay, or (luxe) a Luxe sheet. must: it has to be answered (a vote), so Back and the scrim leave it open */
  var closing=false;
  function openModal(h,must){ modal.querySelector("#scsh").innerHTML=h; modal.classList.add("show"); var B=BGu(); if(B&&!B.sheet.isOpen(modal)) B.sheet.open(modal,{dismissible:!must,onClose:function(){ if(!closing){ modal.classList.remove("show"); modal.dataset.vote=""; } }}); }
  function closeModal(){ modal.classList.remove("show"); modal.dataset.vote=""; var B=BGu(); if(B&&B.sheet.isOpen(modal)){ closing=true; try{ B.sheet.close(modal); }finally{ closing=false; } } }
  function send(a){ var r=cfg.send(a); if(r&&r.ok===false&&cfg.toast) cfg.toast(r.msg||"Not allowed."); return r; }
  function readInputs(){ var out=[]; root.querySelectorAll(".scRow").forEach(function(row){ var arr=[]; row.querySelectorAll("input").forEach(function(i){ arr.push(i.value); }); out.push(arr); }); return out; }
  function submit(){ if(sent) return; sent=true; var a=readInputs(); send({t:"submit",answers:a}); render(); }
  function startTimer(){ clearInterval(tick); tick=setInterval(function(){ if(!S||S.phase!=="write"||sent) return; var left=(deadline-Date.now())/1000; paintTimer(left); if(left<=0){ submit(); } },250); }
  function paintTimer(left){
    var t=root.querySelector("#scTimer"), b=root.querySelector("#scBar i"); if(!t) return;
    if(!L){ t.textContent=mmss(left); t.classList.toggle("low",left<=10); if(b) b.style.width=Math.max(0,Math.min(100,left/(S.o.timer)*100))+"%"; }
    var now=Date.now(); if(cfg.onProgress&&now-lastProg>2500){ lastProg=now; cfg.onProgress(readInputs()); }
  }
  /* ---------- luxe views: the paper pad ---------- */
  function dieL(kw,face){
    var lab=face==="star"?"Star":face==="check"?"Answers sent":face==="dice"?"Rolling the die":kw?"Key word "+esc(S.keyword):"Letter "+esc(S.letter);
    return '<div class="scDie bg-die bg-die--gold'+(kw?' is-kw':'')+'" role="img" aria-label="'+lab+'">'+(face==="star"?ic("star"):face==="check"?ic("check"):face==="dice"?ic("dice"):kw?esc(S.keyword):esc(S.letter))+'</div>';
  }
  function headL(face,eyebrow,rule,withRing){
    var kw=face==="letter"&&!!S.o&&S.o.mode==="keyword";
    return '<header class="scHead'+(kw?' is-kw':'')+(withRing?'':' is-still')+'">'+dieL(kw,face)+'<div class="scHeadTxt"><span class="bg-eyebrow">'+eyebrow+'</span><span class="scRule">'+rule+'</span></div>'+(withRing?'<div class="scRing" id="scTimer"></div>':'')+'</header>';
  }
  function dockL(id,label,icon){ return '<div class="scDock" data-toast-avoid><button type="button" class="bg-btn bg-btn--primary bg-btn--lg bg-btn--block" id="'+id+'">'+ic(icon)+label+'</button></div>'; }
  function waitL(icon,title,sub,extra,face){
    return '<div class="scPad">'+headL(face||"letter",S.tieActive?"Tie-break round":(S.round>0?"Round "+S.round:"New game"),esc(sub||""),false)+'<div class="scBody bg-surface--paper"><div class="scWait">'+ic(icon)+'<b>'+title+'</b></div></div></div>'+(extra||"");
  }
  function progressL(){ return '<ul class="bg-stats scTotals">'+S.players.map(function(p){ return '<li class="bg-stat"><b>'+p.filled+'/'+S.slots.length+'</b><span>'+esc(p.name)+'</span></li>'; }).join("")+'</ul>'; }
  function buildWriteL(){
    var o=S.o, kw=o.mode==="keyword", per=o.answersPer, n=S.slots.length;
    var round=S.tieActive?"Tie-break round":(kw?"Round "+S.round:"Round "+S.round+" of "+S.rounds);
    var rule=kw?'Write <span class="scLab">'+esc(S.slots[0].label)+'</span> for each letter':'Every answer starts <span class="nw">with <b>'+esc(S.letter)+'</b></span>';
    var notes=[]; if(!kw&&o.startRule==="bonus") notes.push("2 points if it starts with "+S.letter+", 1 if not"); if(per>1) notes.push("up to "+per+" answers per category");
    var rows=S.slots.map(function(s,i){
      var ins=""; for(var k=0;k<per;k++) ins+='<input id="scI'+i+'_'+k+'" data-s="'+i+'" data-k="'+k+'" type="text" maxlength="60" autocomplete="off" autocapitalize="words" spellcheck="false" placeholder="'+esc(s.letter)+'…" aria-label="'+(kw?"Starts with "+esc(s.letter):esc(s.label))+(per>1?", answer "+(k+1):"")+'" value="'+esc(((S.myAnswers||[])[i]||[])[k]||"")+'">';
      return '<li class="scRow"><span class="n">'+(i+1)+'</span>'+(kw?'<span class="lb scKwL" aria-hidden="true">'+esc(s.letter)+'</span>':'<label class="lb" for="scI'+i+'_0">'+esc(s.label)+'</label>')+'<span class="ins">'+ins+'</span></li>';
    }).join("");
    root.innerHTML='<div class="scPad">'+headL("letter",round,rule,true)+'<div class="scBody bg-surface--paper">'+(notes.length?'<p class="scNote">'+esc(notes.join(" · "))+'</p>':'')+
      '<ol id="scForm" class="scSheet'+(per>1?' is-multi':'')+'" style="--rows:'+Math.ceil(n/2)+';--per:'+per+'">'+rows+'</ol></div>'+dockL("scDone","I'm done","check")+'</div>';
    sent=false;
    root.querySelectorAll("input").forEach(function(inp){
      inp.addEventListener("input",function(){ var v=inp.value.trim(), lt=S.slots[+inp.dataset.s].letter, bad=!!v&&S.o.startRule==="must"&&!E.startsWith(v,lt); inp.classList.toggle("good",!!v&&E.startsWith(v,lt)); inp.classList.toggle("bad",bad); inp.setAttribute("aria-invalid",bad?"true":"false"); });
      inp.addEventListener("keydown",function(e){ if(e.key==="Enter"){ e.preventDefault(); var all=Array.prototype.slice.call(root.querySelectorAll("input")), i=all.indexOf(inp); if(all[i+1]) all[i+1].focus(); else inp.blur(); } });
    });
    root.querySelector("#scDone").addEventListener("click",function(){ submit(); });
    var secs=S.secLeft!=null?S.secLeft:S.o.timer; deadline=Date.now()+secs*1000; startTimer(); startRing(secs); paintTimer(secs);
  }
  function chipL(e,scored){
    var o=S.o, cls=e.status==="ok"?"ok":(e.status==="dup"?"dup":"invalid"), canC=!scored&&o.judge==="vote"&&(e.status==="ok"||e.status==="dup"), chal=(S.challenges||[]).filter(function(c){ return c.slot===e.slot&&c.p===e.p&&c.k===e.k; })[0];
    var attrs=' data-s="'+e.slot+'" data-p="'+e.p+'" data-k="'+e.k+'"', mine=e.p===S.me?" me":"", btn=canC&&!chal;
    var inner='<span class="ico">'+ic(e.status==="ok"?"check":"close")+'</span><span class="t">'+esc(e.raw)+'</span>'+(e.pts?'<b>+'+e.pts+'</b>':'')+
      '<span class="cap"><span class="w">'+esc(playerName(e.p))+'</span>'+(chal?'<span class="x">challenged: '+(chal.state==="open"?"voting…":chal.state==="accepted"?"kept":"voted out")+'</span>':(e.status!=="ok"&&e.reason?'<span class="x">'+esc(e.reason)+'</span>':''))+'</span>';
    return btn?'<button type="button" class="scAns '+cls+' chal'+mine+'"'+attrs+' aria-label="Challenge '+esc(playerName(e.p))+"'s answer: "+esc(e.raw)+'">'+inner+'</button>':'<span class="scAns '+cls+mine+'"'+attrs+'>'+inner+'</span>';
  }
  function reviewL(res,scored){
    var o=S.o, kw=o.mode==="keyword";
    var rule=scored?"Everyone's answers and points":(o.judge==="vote"?"Tap someone's answer to challenge it":"Answers are checked automatically");
    var slots=S.slots.map(function(s,i){
      var list=res.entries.filter(function(e){ return e.slot===i&&e.raw; });
      var chips=list.map(function(e){ return chipL(e,scored); }).join("")||'<span class="scNone">no answers</span>';
      return '<li class="scSlot"><div class="scCat"><span class="n">'+(i+1)+'</span><span>'+(kw?'<b class="scKwL">'+esc(s.letter)+'</b> ':'')+esc(s.label)+'</span></div><div class="scChips">'+chips+'</div></li>';
    }).join("");
    return '<div class="scPad">'+headL("letter",scored?"Round "+S.round+" scored":"Scoring",rule,false)+'<div class="scBody bg-surface--paper"><ol class="scSlots">'+slots+'</ol></div></div>'+
      '<ul class="bg-stats scTotals">'+S.players.map(function(p){ return '<li class="bg-stat"><b>+'+((res.totals||{})[p.id]||0)+'</b><span>'+esc(p.name)+'</span></li>'; }).join("")+'</ul>';
  }
  function sheetL(eyebrow,title,big,sub,btns){
    return '<div class="bg-sheet__grip" aria-hidden="true"></div><div class="scShead"><span class="bg-eyebrow bg-eyebrow--accent">'+eyebrow+'</span><h2 class="bg-sheet__title" id="scTitle">'+title+'</h2></div><div class="scAnsBig">'+big+'</div><p class="bg-sheet__sub">'+sub+'</p><div class="scBtns2">'+btns+'</div>';
  }

  /* ---------- writing ---------- */
  function buildWrite(){
    if(L) return buildWriteL();
    var o=S.o, kw=o.mode==="keyword", me=S.me;
    var h='<div class="scTop"><div class="scLetter'+(kw?" kw":"")+'">'+(kw?esc(S.keyword):esc(S.letter))+'</div><div class="scTimer" id="scTimer">0:00</div></div><div class="scBar" id="scBar"><i></i></div>';
    h+='<div class="scHint">'+(kw?'Key word <b>'+esc(S.keyword)+'</b> — write <b>'+esc(S.slots[0].label)+'</b> for each letter':'Every answer must start with <b>'+esc(S.letter)+'</b>'+(o.startRule==="bonus"?' (2 points if it does, 1 if not)':'')+(o.answersPer>1?' · up to '+o.answersPer+' answers per category':''))+(S.tieActive?' · tie-break round':' · round '+S.round+(o.mode==="keyword"?'':'/'+S.rounds))+'</div>';
    h+='<div id="scForm">'+S.slots.map(function(s,i){
      var ins=""; for(var k=0;k<o.answersPer;k++) ins+='<input data-s="'+i+'" data-k="'+k+'" type="text" maxlength="60" autocomplete="off" autocapitalize="words" spellcheck="false" placeholder="'+(kw?esc(s.letter)+"…":esc(s.letter)+"…")+'" value="'+esc(((S.myAnswers||[])[i]||[])[k]||"")+'">';
      return '<div class="scRow"><span class="n">'+(i+1)+'</span><span class="lb">'+(kw?'<b style="font-size:20px;color:#ffd23f">'+esc(s.letter)+'</b>':esc(s.label))+'</span><span class="ins">'+ins+'</span></div>';
    }).join("")+'</div><div class="scBtns"><button class="'+(L?"bg-btn bg-btn--primary bg-btn--lg":"pri")+'" id="scDone">'+(L?ic("check")+"I\'m done":"✓ I\'m done")+'</button></div>';
    root.innerHTML=h; sent=false;
    root.querySelectorAll("input").forEach(function(inp){
      inp.addEventListener("input",function(){ var v=inp.value.trim(), L=S.slots[+inp.dataset.s].letter; inp.classList.toggle("good",!!v&&E.startsWith(v,L)); inp.classList.toggle("bad",!!v&&S.o.startRule==="must"&&!E.startsWith(v,L)); });
      inp.addEventListener("keydown",function(e){ if(e.key==="Enter"){ e.preventDefault(); var all=Array.prototype.slice.call(root.querySelectorAll("input")), i=all.indexOf(inp); if(all[i+1]) all[i+1].focus(); else inp.blur(); } });
    });
    var d=root.querySelector("#scDone"); d.addEventListener("click",function(){ submit(); });
    deadline=Date.now()+(S.secLeft!=null?S.secLeft:S.o.timer)*1000; startTimer(); paintTimer((deadline-Date.now())/1000);
  }
  /* ---------- review / results ---------- */
  function playerName(i){ return S.players[i]?S.players[i].name:"?"; }
  function reviewHTML(res,scored){
    if(L) return reviewL(res,scored);
    var o=S.o, me=S.me, h='';
    h+='<div class="scTop"><div class="scLetter'+(S.keyword?" kw":"")+'">'+(S.keyword?esc(S.keyword):esc(S.letter))+'</div></div>';
    h+='<div class="scHint">'+(scored?'Round '+S.round+' scored':'Scoring — '+(o.judge==="vote"?'tap someone\'s answer to challenge it':'answers are checked automatically'))+'</div>';
    h+=S.slots.map(function(s,i){
      var list=res.entries.filter(function(e){ return e.slot===i&&e.raw; });
      var chips=list.map(function(e){
        var cls=e.status==="ok"?"ok":(e.status==="dup"?"dup":"invalid"), canC=!scored&&o.judge==="vote"&&(e.status==="ok"||e.status==="dup"), chal=(S.challenges||[]).filter(function(c){ return c.slot===e.slot&&c.p===e.p&&c.k===e.k; })[0];
        return '<span class="scAns '+cls+(canC&&!chal?" chal":"")+(e.p===me?" me":"")+'" data-s="'+e.slot+'" data-p="'+e.p+'" data-k="'+e.k+'"><span class="w">'+esc(playerName(e.p))+'</span>'+esc(e.raw)+(e.pts?'<b>+'+e.pts+'</b>':'')+(chal?'<span class="x">⚖ '+(chal.state==="open"?"voting…":chal.state==="accepted"?"kept":"voted out")+'</span>':(e.status!=="ok"&&e.reason?'<span class="x">'+esc(e.reason)+'</span>':''))+'</span>';
      }).join("")||'<span style="opacity:.6;font-size:12px">no answers</span>';
      return '<div class="scSlot"><div class="scCat"><span>'+(i+1)+'.</span>'+(S.o.mode==="keyword"?'<b style="color:#ffd23f">'+esc(s.letter)+'</b> — ':'')+esc(s.label)+'</div>'+chips+'</div>';
    }).join("");
    h+='<div class="scTot">'+S.players.map(function(p){ return '<div>'+esc(p.name)+' <b>+'+((res.totals||{})[p.id]||0)+'</b></div>'; }).join("")+'</div>';
    return h;
  }
  function scoreTable(){
    // long games (Key Word mode plays to 25 points) fold the oldest rounds into one "R1–n" column so Total stays on screen
    var n=S.round, from=n>7?n-6:0, i;
    if(L){   // luxe: the Luxe score pad (the leader's row washed in gold, each player with a seat dot)
      var top=-1; S.players.forEach(function(p){ if(p.score>top) top=p.score; });
      var lrows=S.players.slice().sort(function(a,b){ return b.score-a.score; }).map(function(p){ var cells="", sum=0; if(from){ for(i=0;i<from;i++) sum+=(+p.rs[i]||0); cells+='<td>'+sum+'</td>'; } for(i=from;i<n;i++) cells+='<td>'+(p.rs[i]!=null?p.rs[i]:"—")+'</td>';
        return '<tr'+(top>0&&p.score===top?' class="is-lead"':'')+'><td><span class="bg-score__who" data-seat="'+(cfg.seatOf?cfg.seatOf(p.id):p.id%8+1)+'">'+esc(p.name)+'</span></td>'+cells+'<td class="bg-score__total">'+p.score+'</td></tr>'; }).join("");
      var lhead='<tr><th scope="col">Player</th>'+(from?'<th scope="col">R1–'+from+'</th>':''); for(i=from;i<n;i++) lhead+='<th scope="col">R'+(i+1)+'</th>'; lhead+='<th scope="col">Total</th></tr>';
      return '<div class="bg-scorepad"><table class="bg-score"><thead>'+lhead+'</thead><tbody>'+lrows+'</tbody></table></div>';
    }
    var rows=S.players.slice().sort(function(a,b){ return b.score-a.score; }).map(function(p){ var cells="", sum=0; if(from){ for(i=0;i<from;i++) sum+=(+p.rs[i]||0); cells+='<td>'+sum+'</td>'; } for(i=from;i<n;i++) cells+='<td>'+(p.rs[i]!=null?p.rs[i]:"—")+'</td>'; return '<tr><td>'+esc(p.name)+'</td>'+cells+'<td><b>'+p.score+'</b></td></tr>'; }).join("");
    var head='<tr><th>Player</th>'+(from?'<th>R1–'+from+'</th>':''); for(i=from;i<n;i++) head+='<th>R'+(i+1)+'</th>'; head+='<th>Total</th></tr>';
    return '<div style="overflow-x:auto"><table class="scTab">'+head+rows+'</table></div>';
  }
  function render(){
    if(!S) return;
    var key=S.phase+":"+S.round+":"+S.me+":"+(S.letter||"")+":"+(S.keyword||"");
    if(S.phase==="star"){   // the Junior star: the roller picks the round's letter before anyone writes
      halt(); built=key;
      var mine=S.me>=0&&S.me===S.starBy, free=S.starFree||E.LETTERS;
      if(L) root.innerHTML='<div class="scPad">'+headL("star","Junior star",esc(playerName(S.starBy))+' rolled the star'+(mine?' — pick any unused letter for this round':' and is picking the letter…'),false)+
        (mine?'<div class="scBody bg-surface--paper"><div class="scLet">'+E.LETTERS.map(function(l){ return '<button type="button" data-l="'+l+'" aria-label="Letter '+l+'"'+(free.indexOf(l)<0?" disabled":"")+'>'+l+'</button>'; }).join("")+'</div></div>':'')+'</div>';
      else root.innerHTML='<div class="scTop"><div class="scLetter">'+(L?ic("star"):"⭐")+'</div></div><div class="scHint" style="font-size:15px;padding:6px 0">'+esc(playerName(S.starBy))+' rolled the star'+(mine?' — pick any unused letter for this round':' and is picking the letter…')+'</div>'+
        (mine?'<div class="scLet">'+E.LETTERS.map(function(l){ return '<button data-l="'+l+'"'+(free.indexOf(l)<0?" disabled":"")+'>'+l+'</button>'; }).join("")+'</div>':'');
      var lt=root.querySelector(".scLet"); if(lt) lt.addEventListener("click",function(e){ var b=e.target.closest&&e.target.closest("button[data-l]"); if(!b||b.disabled) return; lt.querySelectorAll("button").forEach(function(x){ x.disabled=true; }); var r=send({t:"star",letter:b.dataset.l}); if(r&&r.ok===false) render(); });
      return;
    }
    if(S.phase==="write"){
      if(S.me<0){ halt(); root.innerHTML=L?waitL("hourglass","Waiting for the next player…","",""):'<div class="scHint" style="padding:30px 0;font-size:16px">Waiting for the next player…</div>'; built=key; return; }
      if(S.tieActive&&S.tieActive.indexOf(S.me)<0){ halt(); root.innerHTML=L?waitL("hourglass","You sit this one out","Tie-break round: "+S.tieActive.map(playerName).join(" vs ")+" — waiting for them…",""):'<div class="scHint" style="padding:30px 0;font-size:16px">Tie-break round: '+esc(S.tieActive.map(playerName).join(" vs "))+'.<br>You sit this one out — waiting for them…</div>'; built=key; return; }
      if(sent&&L){ halt(); root.innerHTML=waitL("check","Answers sent","Waiting for the others…",progressL(),"check"); return; }
      if(sent){ clearInterval(tick); root.innerHTML='<div class="scTop"><div class="scLetter">'+(S.keyword?(L?ic("check"):"✓"):esc(S.letter))+'</div></div><div class="scHint" style="font-size:16px;padding:14px 0">Answers sent'+(L?'':' ✔')+'<br>Waiting for the others…</div><div class="scTot">'+S.players.map(function(p){ return '<div>'+esc(p.name)+' <b>'+p.filled+'/'+S.slots.length+'</b></div>'; }).join("")+'</div>'; return; }
      if(built!==key){ built=key; buildWrite(); }
      else if(S.starChanged){ }
      return;
    }
    halt(); built=key;
    if(S.phase==="review"){
      root.innerHTML=reviewHTML(S.review,false)+(L?dockL("scReady",cfg.readyLabel||"Done scoring","check"):'<div class="scBtns"><button class="pri" id="scReady">'+(cfg.readyLabel||"Done scoring ▶")+'</button></div>');
      var rb=root.querySelector("#scReady"); if(rb) rb.addEventListener("click",function(){ send({t:"ready"}); });
      voteCheck(); return;
    }
    if(S.phase==="scored"||S.phase==="over"){
      var over=S.phase==="over";
      var h=reviewHTML(S.result,true)+scoreTable();
      if(L){
        if(over) h+='<p class="scWin">'+ic("trophy")+'<span>'+esc((S.winners||[]).map(playerName).join(" & "))+(S.winners&&S.winners.length>1?" tie!":" wins!")+'</span></p>';
        else if(S.tiebreak) h+='<p class="scTie">Tied for the lead — an extra round decides it!</p>';
        h+=dockL("scNext",over?"New game":(S.tiebreak?"Tie-break round":"Next round"),over?"play":"play");
      } else {
      if(over){ h+='<div class="scTop" style="font-size:22px;font-weight:900;text-align:center">🏆 '+esc((S.winners||[]).map(playerName).join(" & "))+(S.winners&&S.winners.length>1?" tie!":" wins!")+'</div>'; }
      else if(S.tiebreak) h+='<div class="scHint" style="font-size:14px">Tied for the lead — an extra round decides it!</div>';
      h+='<div class="scBtns"><button class="pri" id="scNext">'+(over?"Play again":(S.tiebreak?"Tie-break round ▶":"Next round ▶"))+'</button></div>';
      }
      root.innerHTML=h; root.querySelector("#scNext").addEventListener("click",function(){ send({t:over?"again":"next"}); });
      return;
    }
    root.innerHTML=L?waitL("dice","Rolling…","Get ready!","","dice"):'<div class="scHint" style="padding:40px 0;font-size:18px">🎲 Rolling…<br>get ready!</div>';
  }
  /* challenge + vote windows */
  root.addEventListener("click",function(e){
    if(!S||S.phase!=="review"||S.o.judge!=="vote") return;
    var chip=e.target.closest&&e.target.closest(".scAns.chal"); if(!chip||S.me<0) return;
    var slot=+chip.dataset.s, p=+chip.dataset.p, k=+chip.dataset.k, ent=S.review.entries.filter(function(x){ return x.slot===slot&&x.p===p&&x.k===k; })[0]; if(!ent) return;
    if(L) openModal(sheetL("Challenge","Challenge this answer?",esc(ent.raw),esc(playerName(p))+' wrote it for “'+esc(S.slots[slot].label)+'” with the letter '+esc(S.slots[slot].letter)+'. Everyone votes: the majority wins.',
      '<button type="button" class="bg-btn bg-btn--primary bg-btn--lg" data-c="1" data-autofocus>'+ic("flag")+'Challenge it</button><button type="button" class="bg-btn bg-btn--secondary bg-btn--lg" data-c="0">Never mind</button>'));
    else openModal('<h3>Challenge this answer?</h3><div class="big">'+esc(ent.raw)+'</div><div style="opacity:.85;font-size:13px">'+esc(playerName(p))+' wrote it for “'+esc(S.slots[slot].label)+'” with the letter '+esc(S.slots[slot].letter)+'.<br>Everyone votes — majority wins.</div><div class="scBtns"><button class="pri b" data-c="1">⚖ Challenge it</button><button class="b" data-c="0">Never mind</button></div>');
    modal.querySelector("#scsh").onclick=function(ev){ var b=ev.target.closest&&ev.target.closest("button[data-c]"); if(!b) return; closeModal(); if(b.dataset.c==="1") send({t:"challenge",slot:slot,p:p,k:k}); };
  });
  function voteCheck(){
    if(S.me<0||S.phase!=="review") return;
    var open=(S.challenges||[]).filter(function(c){ return c.state==="open"&&c.votes[S.me]===undefined; })[0];
    if(!open){ if(modal.classList.contains("show")&&modal.dataset.vote){ closeModal(); modal.dataset.vote=""; } return; }
    var id=open.slot+"/"+open.p+"/"+open.k; if(modal.dataset.vote===id) return; modal.dataset.vote=id;
    var ent=S.review.entries.filter(function(x){ return x.slot===open.slot&&x.p===open.p&&x.k===open.k; })[0]||{raw:"?"};
    if(L) openModal(sheetL("Vote","Is this answer OK?",esc(ent.raw),'For “'+esc(S.slots[open.slot].label)+'” starting with '+esc(S.slots[open.slot].letter)+'. Written by '+esc(playerName(open.p))+', challenged by '+esc(playerName(open.by))+'.',
      '<button type="button" class="bg-btn bg-btn--primary bg-btn--lg" data-v="1" data-autofocus>'+ic("check")+'Accept</button><button type="button" class="bg-btn bg-btn--secondary bg-btn--lg" data-v="0">'+ic("close")+'Reject</button>'),true);
    else openModal('<h3>Vote: is this answer OK?</h3><div class="big">'+esc(ent.raw)+'</div><div style="font-size:13px;opacity:.9">for “'+esc(S.slots[open.slot].label)+'” starting with <b>'+esc(S.slots[open.slot].letter)+'</b><br><span style="opacity:.8">written by '+esc(playerName(open.p))+' · challenged by '+esc(playerName(open.by))+'</span></div><div class="scBtns"><button class="b pri" data-v="1">👍 Accept</button><button class="b" data-v="0">👎 Reject</button></div>',true);
    modal.querySelector("#scsh").onclick=function(ev){ var b=ev.target.closest&&ev.target.closest("button[data-v]"); if(!b) return; modal.dataset.vote=""; closeModal(); send({t:"vote",slot:open.slot,p:open.p,k:open.k,accept:b.dataset.v==="1"}); };
  }
  var self={update:function(s){ var prevPhase=S&&S.phase, prevRound=S&&S.round, prevMe=S&&S.me; S=s; if(S.phase==="write"&&(prevPhase!=="write"||prevRound!==S.round||prevMe!==S.me)){ sent=false; built=""; } render(); },
    destroy:function(){ halt(); if(modal.parentNode) modal.parentNode.removeChild(modal); },
    readAnswers:readInputs,setDeadlineIn:function(sec){ deadline=Date.now()+sec*1000; if(L&&S&&S.phase==="write"&&!sent) startRing(sec); },submitNow:function(){ submit(); },closeModal:closeModal,isSent:function(){ return sent; }};
  return self;
}
Sc.UI={create:create,CSS:CSS,mmss:mmss,PCOL:PCOL};
})(typeof window!=="undefined"?window:globalThis);
