/* 500 Rummy — shared card drawing (original artwork, no copyrighted decks). Needs engine.js first.
   Step 5 (Midnight Luxe): ivory faces with a rank index and a suit pip in BOTH top corners (an overlapping or focused neighbour never hides the
   index), real pip layouts, original crown / tiara / plumed-cap court art, a plum jester-cap joker with its word, a navy-and-gold back.
   All vector: one hidden SVG sprite (injectCSS adds it) and <use>; every size comes from --cw, so a card is crisp at any size.
   The page may not have ui/theme.css (Party Mode's pages before they adopt it): every var() has a fallback. */
(function(g){
"use strict";
var R=g.Rummy;
var COLORS=["#ff5d73","#5f95ff","#3fd391","#ffcb4f","#b383ff","#38cbd2","#ff8c45","#ff7fcb"];   /* the Luxe seat colours (ui/theme.css --seat-1..8) */
var CN=["Red","Blue","Green","Yellow","Orange","Purple","Teal","Pink"];
function colorOf(G,i){ if(G&&G.colors) return G.colors[i]; return COLORS[(G&&G.o&&G.o.teams)?i%2:i]; }
/* the sprite: suit pips (100x100), court emblems and the jester cap (100x80), a star (100x100); fill is currentColor unless a gold is named */
var GOLD="#c99f5e", GOLDHI="#f0d48a";
var SPRITE='<svg xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false" style="position:absolute;width:0;height:0;overflow:hidden"><defs>'+
 '<symbol id="rp-S" viewBox="0 0 100 100"><path fill="currentColor" d="M50 5C50 5 13 38 13 62C13 76 24 85 36 85C42 85 47 82 49 79C48 89 44 94 35 97H65C56 94 52 89 51 79C53 82 58 85 64 85C76 85 87 76 87 62C87 38 50 5 50 5Z"/></symbol>'+
 '<symbol id="rp-H" viewBox="0 0 100 100"><path fill="currentColor" d="M50 94C19 68 7 49 7 32C7 17 18 7 31 7C40 7 47 12 50 20C53 12 60 7 69 7C82 7 93 17 93 32C93 49 81 68 50 94Z"/></symbol>'+
 '<symbol id="rp-D" viewBox="0 0 100 100"><path fill="currentColor" d="M50 3C60 22 76 38 90 50C76 62 60 78 50 97C40 78 24 62 10 50C24 38 40 22 50 3Z"/></symbol>'+
 '<symbol id="rp-C" viewBox="0 0 100 100"><g fill="currentColor"><circle cx="50" cy="27" r="21"/><circle cx="27" cy="62" r="21"/><circle cx="73" cy="62" r="21"/><path d="M50 50C50 72 46 85 37 96H63C54 85 50 72 50 50Z"/></g></symbol>'+
 '<symbol id="rp-K" viewBox="0 0 100 80"><path fill="currentColor" d="M10 64L5 19L30 40L50 12L70 40L95 19L90 64Z"/><path fill="'+GOLD+'" d="M9 67H91V76H9Z"/><g fill="'+GOLDHI+'"><circle cx="5" cy="14" r="5.5"/><circle cx="50" cy="7" r="5.5"/><circle cx="95" cy="14" r="5.5"/></g><g fill="#fbf6ea"><circle cx="30" cy="71.5" r="2.6"/><circle cx="50" cy="71.5" r="2.6"/><circle cx="70" cy="71.5" r="2.6"/></g></symbol>'+
 '<symbol id="rp-Q" viewBox="0 0 100 80"><path fill="currentColor" d="M12 64C7 42 16 24 30 17C36 30 42 34 50 15C58 34 64 30 70 17C84 24 93 42 88 64Z"/><path fill="'+GOLD+'" d="M10 67H90V76H10Z"/><g fill="'+GOLDHI+'"><circle cx="30" cy="12" r="5"/><circle cx="50" cy="9" r="5"/><circle cx="70" cy="12" r="5"/></g><g fill="#fbf6ea"><circle cx="32" cy="71.5" r="2.6"/><circle cx="50" cy="71.5" r="2.6"/><circle cx="68" cy="71.5" r="2.6"/></g></symbol>'+
 '<symbol id="rp-J" viewBox="0 0 100 80"><path fill="currentColor" d="M14 64C11 40 28 20 52 22C68 24 80 34 85 47L92 47V64Z"/><path fill="'+GOLD+'" d="M10 67H94V76H10Z"/><path fill="'+GOLDHI+'" d="M58 24C67 5 88 1 98 7C92 11 88 19 80 26C74 31 65 31 58 24Z"/><circle cx="30" cy="71.5" r="2.6" fill="#fbf6ea"/><circle cx="50" cy="71.5" r="2.6" fill="#fbf6ea"/><circle cx="70" cy="71.5" r="2.6" fill="#fbf6ea"/></symbol>'+
 '<symbol id="rp-JK" viewBox="0 0 100 80"><path fill="currentColor" d="M10 64C4 46 6 28 20 15C22 31 32 42 43 46C43 31 45 18 50 6C55 18 57 31 57 46C68 42 78 31 80 15C94 28 96 46 90 64Z"/><path fill="'+GOLD+'" d="M8 67H92V76H8Z"/><g fill="'+GOLDHI+'"><circle cx="20" cy="11" r="6.5"/><circle cx="50" cy="5" r="6.5"/><circle cx="80" cy="11" r="6.5"/></g></symbol>'+
 '<symbol id="rp-star" viewBox="0 0 100 100"><path fill="currentColor" d="M50 5L62 37L96 38L69 59L79 92L50 72L21 92L31 59L4 38L38 37Z"/></symbol>'+
 '</defs></svg>';
var PIPS={ /* [x, y] of each pip in a 100 x 142 card, as t (0..1 down the pip zone) for the side columns; C = the centre column */
  2:[["C",0],["C",1]], 3:[["C",0],["C",.5],["C",1]], 4:[["L",0],["R",0],["L",1],["R",1]], 5:[["L",0],["R",0],["C",.5],["L",1],["R",1]],
  6:[["L",0],["R",0],["L",.5],["R",.5],["L",1],["R",1]], 7:[["L",0],["R",0],["C",.25],["L",.5],["R",.5],["L",1],["R",1]],
  8:[["L",0],["R",0],["C",.25],["L",.5],["R",.5],["C",.75],["L",1],["R",1]],
  9:[["L",0],["R",0],["L",1/3],["R",1/3],["C",.5],["L",2/3],["R",2/3],["L",1],["R",1]],
  10:[["L",0],["R",0],["C",1/6],["L",1/3],["R",1/3],["L",2/3],["R",2/3],["C",5/6],["L",1],["R",1]]};
var XCOL={L:33,C:50,R:67};
function pip(s,x,y,w,flip){ var h=w/2; return '<use href="#rp-'+s+'" x="'+(x-h)+'" y="'+(y-h)+'" width="'+w+'" height="'+w+'"'+(flip?' transform="rotate(180 '+x+' '+y+')"':'')+'/>'; }
function artSVG(c){
  var s=c.s, body="", r=c.r===14?1:c.r;
  if(c.joker){
    body='<ellipse cx="50" cy="76" rx="36" ry="46" fill="#f4e4ff" opacity=".7"/><use href="#rp-JK" x="17" y="42" width="66" height="53"/>'+
         '<use href="#rp-star" x="19" y="100" width="10" height="10" style="color:#c99f5e"/><use href="#rp-star" x="45" y="103" width="10" height="10" style="color:#c99f5e"/><use href="#rp-star" x="71" y="100" width="10" height="10" style="color:#c99f5e"/>';
  } else if(r===1){
    body='<circle cx="50" cy="84" r="34" fill="none" stroke="#c99f5e" stroke-width="1.6" opacity=".7"/>'+pip(s,50,84,50);
  } else if(r>=11){
    var K=r===13?"K":r===12?"Q":"J";
    body='<rect x="22" y="52" width="56" height="82" rx="9" fill="#c99f5e" fill-opacity=".14" stroke="#c99f5e" stroke-width="2"/><rect x="26" y="56" width="48" height="74" rx="6" fill="none" stroke="#c99f5e" stroke-width="1" opacity=".7"/>'+
         '<use href="#rp-'+K+'" x="29" y="62" width="42" height="33.6"/>'+pip(s,50,111,22)+'<path d="M32 121H68" stroke="#c99f5e" stroke-width="1.2" opacity=".8"/>';
  } else {
    var P=PIPS[r]||[], w=r<=3?24:17.5;
    for(var i=0;i<P.length;i++){ var y=P[i][1]*64+60; body+=pip(s,XCOL[P[i][0]],y,w,y>92); }
  }
  return '<svg class="art" viewBox="0 0 100 142" aria-hidden="true" focusable="false">'+body+'</svg>';
}
function cornerHTML(c,k){
  return '<i class="'+k+'">'+(c.joker?'<svg class="pp st" viewBox="0 0 100 100" aria-hidden="true" focusable="false"><use href="#rp-star"/></svg>':
    '<b>'+R.rankLabel(c.r)+'</b><svg class="pp" viewBox="0 0 100 100" aria-hidden="true" focusable="false"><use href="#rp-'+c.s+'"/></svg>')+'</i>';
}
function cardHTML(c,o){
  o=o||{};
  var cls="pc"+(c.joker?" jk":(R.RED[c.s]?" red":""))+(o.cls?" "+o.cls:"");
  var inner=cornerHTML(c,"tl")+cornerHTML(c,"tr")+artSVG(c)+(c.joker?'<u class="jt">JOKER</u>':'');
  if(o.sub) inner+='<u class="sb">'+o.sub+'</u>';
  return '<div class="'+cls+'" data-id="'+c.id+'"'+(o.attrs?' '+o.attrs:'')+(o.style?' style="'+o.style+'"':'')+'>'+inner+'</div>';
}
function backHTML(o){ o=o||{}; return '<div class="pc back'+(o.cls?" "+o.cls:"")+'"'+(o.attrs?' '+o.attrs:'')+(o.style?' style="'+o.style+'"':'')+'><b class="mid">'+(o.label||"")+'</b></div>'; }
/* a meld entry {c,r,s}: wild jokers show what they stand for */
function meldCardHTML(e,o){
  o=o||{};
  var sub=(e.c.joker&&e.s!=="J")?"="+R.rankLabel(e.r)+'<svg class="sbp'+(R.RED[e.s]?" r":"")+'" viewBox="0 0 100 100" aria-hidden="true" focusable="false"><use href="#rp-'+e.s+'"/></svg>':"";
  return cardHTML(e.c,{cls:o.cls,sub:sub,attrs:o.attrs,style:o.style});
}
function meldHTML(m,G,o){
  o=o||{};
  var col=colorOf(G,m.owner);
  var inner=m.cards.map(function(e){ return meldCardHTML(e); }).join("");
  return '<div class="meld'+(o.cls?" "+o.cls:"")+'" data-m="'+m.id+'" style="--oc:'+col+'">'+inner+'</div>';
}
var FD='var(--font-display,"DM Serif Display","Iowan Old Style",Georgia,serif)', FU='var(--font-ui,Manrope,system-ui,sans-serif)';
var CW='var(--cw,54px)';
var CSS=[
".pc{position:relative;display:inline-block;flex:none;width:"+CW+";height:calc("+CW+"*1.42);border-radius:calc("+CW+"*.115);color:#1d2142;"+
  "background:radial-gradient(95% 70% at 50% 14%,var(--paper-50,#fbf6ea) 0%,var(--paper-100,#f1e8d4) 62%,var(--paper-200,#e5d9bf) 100%);"+
  "border:1px solid #a89570;box-shadow:inset 0 0 0 calc("+CW+"*.035) var(--paper-50,#fbf6ea),inset 0 0 0 calc("+CW+"*.035 + 1px) rgba(107,81,36,.4),0 2px 5px #0009;box-sizing:border-box;overflow:hidden}",
".pc.red{color:#b3263a}",
".pc .tl,.pc .tr{position:absolute;top:calc("+CW+"*.05);display:flex;flex-direction:column;align-items:center;gap:calc("+CW+"*.02);font-style:normal;line-height:1;pointer-events:none}",
".pc .tl{left:calc("+CW+"*.075)}.pc .tr{right:calc("+CW+"*.075)}",
".pc .tl b,.pc .tr b{font:400 calc("+CW+"*.3)/1 "+FD+";letter-spacing:-.02em;font-variant-numeric:lining-nums}",
".pc .pp{display:block;width:calc("+CW+"*.19);height:calc("+CW+"*.19);fill:currentColor}",
".pc .pp.st{width:calc("+CW+"*.2);height:calc("+CW+"*.2);color:#c99f5e}",
".pc .art{position:absolute;inset:0;width:100%;height:100%;pointer-events:none;fill:currentColor}",
".pc.jk{color:#5b2a86;background:radial-gradient(95% 70% at 50% 14%,#fffaf0 0%,#f6ecff 64%,#e4d3f3 100%)}",
".pc .jt{position:absolute;left:0;right:0;bottom:calc("+CW+"*.045);text-align:center;text-decoration:none;font:400 max(12px,calc("+CW+"*.19))/1 "+FD+";letter-spacing:.04em;color:#5b2a86;white-space:nowrap}",
".pc .sb{position:absolute;left:calc("+CW+"*.045);bottom:calc("+CW+"*.045);display:inline-flex;align-items:center;gap:1px;padding:0 3px;border-radius:5px;text-decoration:none;white-space:nowrap;font:800 max(12px,calc("+CW+"*.2))/1.25 "+FU+";color:#14172c;background:#fffaf0;box-shadow:0 0 0 1px #c99f5e}",
".pc .sbp{width:.85em;height:.85em;fill:currentColor;color:#14172c}.pc .sbp.r{color:#b3263a}",
".meld .pc.jk .jt{display:none}",
".pc.back{border:1px solid #c99f5e;color:#e7ca90;box-shadow:inset 0 0 0 calc("+CW+"*.05) #0c1030,inset 0 0 0 calc("+CW+"*.05 + 1px) rgba(231,202,144,.7),0 2px 5px #0009;"+
  "background:radial-gradient(70% 46% at 50% 50%,rgba(231,202,144,.26),transparent 72%),repeating-linear-gradient(45deg,rgba(231,202,144,.2) 0 1px,transparent 1px calc("+CW+"*.115)),repeating-linear-gradient(-45deg,rgba(231,202,144,.2) 0 1px,transparent 1px calc("+CW+"*.115)),linear-gradient(160deg,#27326a,#0f1436)}",
".pc.back::before{content:'';position:absolute;left:50%;top:50%;width:calc("+CW+"*.42);height:calc("+CW+"*.42);transform:translate(-50%,-50%) rotate(45deg);border:calc("+CW+"*.035) solid #e7ca90;background:#10153a;box-shadow:0 0 0 calc("+CW+"*.03) #10153a,0 0 0 calc("+CW+"*.045) rgba(231,202,144,.6)}",
".pc.back .mid{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;text-align:center;z-index:1;font:800 calc("+CW+"*.2)/1 "+FU+";letter-spacing:0;color:#f4e3b8;text-shadow:0 1px 3px #000}",
".pc.sel{transform:translateY(-14px);box-shadow:0 0 0 3px #e7ca90,0 0 0 5px #0b0a12,0 8px 14px #000b;z-index:5}",
".pc.pf{transform:translateY(-10px);box-shadow:0 0 0 3px #4fd8d2,0 0 0 5px #0b0a12,0 6px 12px #000b}",
".pc.flash{animation:pcflash 1.2s ease-out 1}",
"@keyframes pcdrawn{0%,55%{box-shadow:0 0 0 4px #e7ca90,0 0 20px 7px #e7ca90}100%{box-shadow:0 0 0 4px #e7ca9000,0 0 20px 7px #e7ca9000}}",
"#hand .pc,.hd .pc{touch-action:none}",
"@keyframes pcflash{0%{box-shadow:0 0 0 4px #fff,0 0 22px 8px #e7ca90}100%{box-shadow:0 2px 5px #0009}}",
".meld{display:flex;align-items:center;padding:6px 10px 6px 8px;margin:3px;border-radius:14px;background:linear-gradient(180deg,rgba(0,0,0,.2),rgba(0,0,0,.38));border:2px solid var(--oc,#888);--cw:42px;box-shadow:0 0 10px -2px var(--oc,#888),inset 0 1px 0 rgba(255,255,255,.06)}",
".meld .pc{margin-left:-17px}.meld .pc:first-child{margin-left:0}",
".meld.fit{position:relative;cursor:pointer}",
".meld.fit:not(.flash)::after{content:'';position:absolute;inset:-2px;border-radius:inherit;pointer-events:none;opacity:0;box-shadow:0 0 0 4px #e7ca90,0 0 18px 4px #e7ca90;animation:fitbeat 1s ease-in-out infinite}",
"@keyframes fitbeat{50%{opacity:1}}",
"@media (prefers-reduced-motion: reduce){.meld.fit:not(.flash)::after{animation:none;opacity:1}}",
"html[data-motion=reduce] .meld.fit:not(.flash)::after,html[data-effects=reduced] .meld.fit:not(.flash)::after{animation:none;opacity:1}",
".meld.flash{animation:pcflash 1.4s ease-out 1}"
].join("\n");
function injectCSS(){
  if(typeof document==="undefined"||document.getElementById("rummyCardCss")) return;
  var s=document.createElement("style"); s.id="rummyCardCss"; s.textContent=CSS; document.head.appendChild(s);
  var d=document.createElement("div"); d.id="rummyCardSprite"; d.setAttribute("aria-hidden","true"); d.style.cssText="position:absolute;width:0;height:0;overflow:hidden"; d.innerHTML=SPRITE;
  (document.body||document.documentElement).insertBefore(d,(document.body||document.documentElement).firstChild);
}
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
  var px=0,py=0;
  root.addEventListener("pointerdown",function(e){ root.__peeked=false; px=e.clientX; py=e.clientY; var n=e.target.closest&&e.target.closest(".pc:not(.back)"); if(!n) return; clearTimeout(t); t=setTimeout(function(){ t=null; root.__peeked=true; show(n); },520); });
  root.addEventListener("pointermove",function(e){ if(t&&Math.hypot(e.clientX-px,e.clientY-py)>8){ clearTimeout(t); t=null; } });
  ["pointerup","pointercancel","pointerleave","scroll"].forEach(function(ev){ root.addEventListener(ev,function(){ clearTimeout(t); t=null; },true); });
  root.addEventListener("click",function(e){ if(root.__peeked){ root.__peeked=false; e.stopPropagation(); e.preventDefault(); } },true);
}
function sortHand(hand,mode,order){
  var so={S:0,H:1,D:2,C:3,J:4};
  if(mode==="custom"){
    var pos={}; (order||[]).forEach(function(id,i){ pos[id]=i; });
    return hand.slice().sort(function(a,b){ var pa=pos[a.id]==null?1e6+a.id:pos[a.id], pb=pos[b.id]==null?1e6+b.id:pos[b.id]; return pa-pb; });
  }
  return hand.slice().sort(function(a,b){
    if(mode==="rank") return (a.r-b.r)||(so[a.s]-so[b.s]);
    return (so[a.s]-so[b.s])||(a.r-b.r);
  });
}
/* a card you just drew gets an outline that fades out over 3 seconds (survives re-renders by using the time already elapsed) */
function drawnStyle(map,id){
  var t=map&&map[id]; if(!t) return "";
  var el=Date.now()-t; if(el>3000){ delete map[id]; return ""; }
  return "animation:pcdrawn 3s linear forwards;animation-delay:-"+(el/1000).toFixed(2)+"s;z-index:4";
}
/* drag a card in your hand to a new place; onReorder(ids) gets the new left-to-right order */
function enableDragSort(root,sel,onReorder){
  var st=null;
  root.addEventListener("pointerdown",function(e){
    var c=e.target.closest&&e.target.closest(sel+" .pc"); if(!c||(e.button||0)>0) return;
    st={node:c,id:+c.getAttribute("data-id"),sx:e.clientX,sy:e.clientY,started:false,pid:e.pointerId,clone:null,box:null};
  });
  root.addEventListener("pointermove",function(e){
    if(!st||e.pointerId!==st.pid) return;
    var dx=e.clientX-st.sx, dy=e.clientY-st.sy;
    if(!st.started){
      if(Math.hypot(dx,dy)<10) return;
      st.started=true; root.__dragged=true;
      var r=st.node.getBoundingClientRect(); st.box=r;
      var cl=st.node.cloneNode(true); cl.className=cl.className.replace(/\b(sel|pf|flash)\b/g,"");
      cl.style.cssText="position:fixed;left:"+r.left+"px;top:"+r.top+"px;width:"+r.width+"px;height:"+r.height+"px;margin:0;z-index:9998;pointer-events:none;transform:scale(1.15) rotate(4deg);opacity:.96;box-shadow:0 10px 24px #000c";
      document.body.appendChild(cl); st.clone=cl; st.node.style.opacity=".25";
    }
    st.clone.style.left=(st.box.left+dx)+"px"; st.clone.style.top=(st.box.top+dy)+"px";
    if(e.preventDefault) e.preventDefault();
  });
  function finish(e,cancel){
    if(!st||e.pointerId!==st.pid) return;
    var s=st; st=null;
    if(!s.started) return;
    if(s.clone&&s.clone.parentNode) s.clone.parentNode.removeChild(s.clone); s.node.style.opacity="";
    if(cancel) return;
    var host=s.node.parentNode, nodes=Array.prototype.slice.call(host.querySelectorAll(".pc")).filter(function(n){ return n!==s.node; });
    var best=null,bd=1e12,x=e.clientX,y=e.clientY;
    nodes.forEach(function(n){ var r=n.getBoundingClientRect(), cx=r.left+r.width/2, cy=r.top+r.height/2, d=Math.pow(cx-x,2)+Math.pow((cy-y)*1.6,2); if(d<bd){ bd=d; best={n:n,cx:cx}; } });
    var ids=nodes.map(function(n){ return +n.getAttribute("data-id"); });
    var at=best?ids.indexOf(+best.n.getAttribute("data-id"))+(x>best.cx?1:0):ids.length;
    ids.splice(at,0,s.id);
    onReorder(ids);
    setTimeout(function(){ root.__dragged=false; },80);
  }
  root.addEventListener("pointerup",function(e){ finish(e,false); });
  root.addEventListener("pointercancel",function(e){ finish(e,true); });
  root.addEventListener("click",function(e){ if(root.__dragged){ root.__dragged=false; e.stopPropagation(); e.preventDefault(); } },true);
}
g.Rummy.UI={drawnStyle:drawnStyle,enableDragSort:enableDragSort,COLORS:COLORS,CN:CN,colorOf:colorOf,cardHTML:cardHTML,backHTML:backHTML,meldCardHTML:meldCardHTML,meldHTML:meldHTML,injectCSS:injectCSS,enablePeek:enablePeek,sortHand:sortHand,CSS:CSS};
})(typeof window!=="undefined"?window:globalThis);
