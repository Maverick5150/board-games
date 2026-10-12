/* 500 Rummy — shared card drawing (original artwork, no copyrighted decks). Needs engine.js first. */
(function(g){
"use strict";
var R=g.Rummy;
var COLORS=["#e23b3b","#2b7be0","#27a758","#eec21b","#f08a24","#a65bd6","#19b5b0","#ec6aa8"];
var CN=["Red","Blue","Green","Yellow","Orange","Purple","Teal","Pink"];
function colorOf(G,i){ if(G&&G.colors) return G.colors[i]; return COLORS[(G&&G.o&&G.o.teams)?i%2:i]; }
function cardHTML(c,o){
  o=o||{};
  var cls="pc"+(c.joker?" jk":(R.RED[c.s]?" red":""))+(o.cls?" "+o.cls:"");
  var inner=c.joker?'<i class="tl">★</i><b class="mid">JOKER</b>':'<i class="tl">'+R.rankLabel(c.r)+'<br>'+R.SYM[c.s]+'</i><b class="mid">'+R.SYM[c.s]+'</b>';
  if(o.sub) inner+='<u class="sb">'+o.sub+'</u>';
  return '<div class="'+cls+'" data-id="'+c.id+'"'+(o.attrs?' '+o.attrs:'')+(o.style?' style="'+o.style+'"':'')+'>'+inner+'</div>';
}
function backHTML(o){ o=o||{}; return '<div class="pc back'+(o.cls?" "+o.cls:"")+'"'+(o.attrs?' '+o.attrs:'')+(o.style?' style="'+o.style+'"':'')+'><b class="mid">'+(o.label||"")+'</b></div>'; }
/* a meld entry {c,r,s}: wild jokers show what they stand for */
function meldCardHTML(e,o){
  o=o||{};
  var sub=(e.c.joker&&e.s!=="J")?"="+R.rankLabel(e.r)+R.SYM[e.s]:"";
  return cardHTML(e.c,{cls:o.cls,sub:sub,attrs:o.attrs,style:o.style});
}
function meldHTML(m,G,o){
  o=o||{};
  var col=colorOf(G,m.owner);
  var inner=m.cards.map(function(e){ return meldCardHTML(e); }).join("");
  return '<div class="meld'+(o.cls?" "+o.cls:"")+'" data-m="'+m.id+'" style="--oc:'+col+'">'+inner+'</div>';
}
var CSS=[
".pc{position:relative;display:inline-block;flex:none;width:var(--cw,54px);height:calc(var(--cw,54px)*1.42);border-radius:calc(var(--cw,54px)*.13);background:linear-gradient(160deg,#fff,#e9ecf4);color:#14171f;border:1px solid #8d97ae;box-shadow:0 2px 5px #0008;font-family:Georgia,'Times New Roman',serif;font-weight:900;user-select:none;-webkit-user-select:none;cursor:pointer;transition:transform .12s,box-shadow .12s}",
".pc.red{color:#d02323}",
".pc .tl{position:absolute;left:calc(var(--cw,54px)*.07);top:calc(var(--cw,54px)*.03);font-style:normal;font-size:calc(var(--cw,54px)*.36);line-height:1.02;text-align:center}",
".pc .mid{position:absolute;right:calc(var(--cw,54px)*.07);bottom:calc(var(--cw,54px)*.02);font-size:calc(var(--cw,54px)*.62);line-height:1}",
".pc.jk{color:#7a2bd0;background:linear-gradient(160deg,#fff7d6,#f1dcff)}",
".pc.jk .mid{font-size:calc(var(--cw,54px)*.19);writing-mode:vertical-rl;right:calc(var(--cw,54px)*.12);bottom:calc(var(--cw,54px)*.1);letter-spacing:1px}",
".pc .sb{position:absolute;left:0;right:0;bottom:calc(var(--cw,54px)*.03);text-align:center;text-decoration:none;font-size:calc(var(--cw,54px)*.2);color:#5b1fa8;background:#fff;opacity:.95;border-radius:4px;margin:0 2px}",
".pc.back{background:repeating-linear-gradient(45deg,#1d4fa8 0 5px,#2a63c8 5px 10px);border:3px solid #fff;color:#fff}",
".pc.back .mid{inset:0;display:flex;align-items:center;justify-content:center;font-size:calc(var(--cw,54px)*.34);text-shadow:0 1px 4px #000}",
".pc.sel{transform:translateY(-14px);box-shadow:0 0 0 3px #ffd84a,0 6px 12px #000a;z-index:5}",
".pc.pf{transform:translateY(-10px);box-shadow:0 0 0 3px #7bf2a3,0 5px 10px #000a}",
".pc.flash{animation:pcflash 1.2s ease-out 1}",
"@keyframes pcflash{0%{box-shadow:0 0 0 4px #fff,0 0 22px 8px #ffd84a}100%{box-shadow:0 2px 5px #0008}}",
".meld{display:flex;align-items:center;padding:6px 10px 6px 8px;margin:3px;border-radius:12px;background:#00000040;border:2px solid var(--oc,#888);--cw:42px;box-shadow:0 0 10px -2px var(--oc,#888)}",
".meld .pc{margin-left:-17px}.meld .pc:first-child{margin-left:0}",
".meld.fit{animation:fitpulse 1s ease-in-out infinite;cursor:pointer}",
"@keyframes fitpulse{50%{box-shadow:0 0 0 4px #ffd84a,0 0 18px 4px #ffd84a}}",
".meld.flash{animation:pcflash 1.4s ease-out 1}"
].join("\n");
function injectCSS(){ if(typeof document==="undefined"||document.getElementById("rummyCardCss")) return; var s=document.createElement("style"); s.id="rummyCardCss"; s.textContent=CSS; document.head.appendChild(s); }
/* press-and-hold any card to see it big */
function enablePeek(root){
  var t=null, ov=null;
  function hide(){ if(ov){ ov.remove(); ov=null; } }
  function show(node){
    hide(); var id=node.getAttribute("data-id"); if(id==null) return;
    ov=document.createElement("div"); ov.style.cssText="position:fixed;inset:0;z-index:9999;background:#000a;display:flex;align-items:center;justify-content:center;flex-direction:column;gap:10px";
    var big=node.cloneNode(true); big.className=big.className.replace(/\b(sel|pf|flash)\b/g,""); big.style.cssText="--cw:min(62vw,260px);margin:0;transform:none";
    ov.appendChild(big); var x=document.createElement("div"); x.textContent="tap anywhere to close"; x.style.cssText="color:#cfd8ff;font:600 13px system-ui"; ov.appendChild(x);
    ov.addEventListener("click",hide); document.body.appendChild(ov);
  }
  root.addEventListener("pointerdown",function(e){ root.__peeked=false; var n=e.target.closest&&e.target.closest(".pc:not(.back)"); if(!n) return; clearTimeout(t); t=setTimeout(function(){ t=null; root.__peeked=true; show(n); },520); });
  ["pointerup","pointercancel","pointerleave","scroll"].forEach(function(ev){ root.addEventListener(ev,function(){ clearTimeout(t); t=null; },true); });
  root.addEventListener("click",function(e){ if(root.__peeked){ root.__peeked=false; e.stopPropagation(); e.preventDefault(); } },true);
}
function sortHand(hand,mode){
  var so={S:0,H:1,D:2,C:3,J:4};
  return hand.slice().sort(function(a,b){
    if(mode==="rank") return (a.r-b.r)||(so[a.s]-so[b.s]);
    return (so[a.s]-so[b.s])||(a.r-b.r);
  });
}
g.Rummy.UI={COLORS:COLORS,CN:CN,colorOf:colorOf,cardHTML:cardHTML,backHTML:backHTML,meldCardHTML:meldCardHTML,meldHTML:meldHTML,injectCSS:injectCSS,enablePeek:enablePeek,sortHand:sortHand,CSS:CSS};
})(typeof window!=="undefined"?window:globalThis);
