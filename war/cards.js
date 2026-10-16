/* WAR — card art (original, no copyrighted deck art). The faces are the 500 Rummy Midnight Luxe faces (rummy500/cards.js) in War's own
   namespace (window.War.Cards, ids "wc-*", class "wf"), so War never needs the Rummy globals:
   ivory faces with the rank and suit index in BOTH top corners, real pip layouts, original crown / tiara / plumed-cap court emblems in a gold
   frame, a jester-cap joker (red joker plum-red, black joker ink), and War's own back: field olive with a gold lattice and crossed sabres.
   Card ids are the engine's: 0..51 = suit*13 + rank-2 (S H D C, Ace = 14), 52 = red joker, 53 = black joker; with more decks
   (5-16 players) deck k's card is k*54 + that id, so the face is id % 54.
   Every size comes from --cw (the card width); the index text never drops under the page's --fs-micro floor (12 px phone, 21 px TV).
   A table card (flipCard) is a face/back pair on a plain 3D wrapper: a flip is ONE rotateY of .wf-in (transform only, one shot). */
(function(g){
"use strict";
var W=g.War=g.War||{};
var SUITS=["S","H","D","C"], RED={H:1,D:1};
var GOLD="#c99f5e", GOLDHI="#f0d48a";
function info(id){ id=(+id)%54; if(id>=52) return {id:id,r:15,s:"J",joker:true,red:id===52}; var s=SUITS[(id/13)|0], r=2+id%13; return {id:id,r:r,s:s,joker:false,red:!!RED[s]}; }
function rankLabel(r){ return r===15?"Joker":r===14?"A":r===13?"K":r===12?"Q":r===11?"J":String(r); }
var SPRITE='<svg xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false" style="position:absolute;width:0;height:0;overflow:hidden"><defs>'+
 '<symbol id="wc-S" viewBox="0 0 100 100"><path fill="currentColor" d="M50 5C50 5 13 38 13 62C13 76 24 85 36 85C42 85 47 82 49 79C48 89 44 94 35 97H65C56 94 52 89 51 79C53 82 58 85 64 85C76 85 87 76 87 62C87 38 50 5 50 5Z"/></symbol>'+
 '<symbol id="wc-H" viewBox="0 0 100 100"><path fill="currentColor" d="M50 94C19 68 7 49 7 32C7 17 18 7 31 7C40 7 47 12 50 20C53 12 60 7 69 7C82 7 93 17 93 32C93 49 81 68 50 94Z"/></symbol>'+
 '<symbol id="wc-D" viewBox="0 0 100 100"><path fill="currentColor" d="M50 3C60 22 76 38 90 50C76 62 60 78 50 97C40 78 24 62 10 50C24 38 40 22 50 3Z"/></symbol>'+
 '<symbol id="wc-C" viewBox="0 0 100 100"><g fill="currentColor"><circle cx="50" cy="27" r="21"/><circle cx="27" cy="62" r="21"/><circle cx="73" cy="62" r="21"/><path d="M50 50C50 72 46 85 37 96H63C54 85 50 72 50 50Z"/></g></symbol>'+
 '<symbol id="wc-K" viewBox="0 0 100 80"><path fill="currentColor" d="M10 64L5 19L30 40L50 12L70 40L95 19L90 64Z"/><path fill="'+GOLD+'" d="M9 67H91V76H9Z"/><g fill="'+GOLDHI+'"><circle cx="5" cy="14" r="5.5"/><circle cx="50" cy="7" r="5.5"/><circle cx="95" cy="14" r="5.5"/></g><g fill="#fbf6ea"><circle cx="30" cy="71.5" r="2.6"/><circle cx="50" cy="71.5" r="2.6"/><circle cx="70" cy="71.5" r="2.6"/></g></symbol>'+
 '<symbol id="wc-Q" viewBox="0 0 100 80"><path fill="currentColor" d="M12 64C7 42 16 24 30 17C36 30 42 34 50 15C58 34 64 30 70 17C84 24 93 42 88 64Z"/><path fill="'+GOLD+'" d="M10 67H90V76H10Z"/><g fill="'+GOLDHI+'"><circle cx="30" cy="12" r="5"/><circle cx="50" cy="9" r="5"/><circle cx="70" cy="12" r="5"/></g><g fill="#fbf6ea"><circle cx="32" cy="71.5" r="2.6"/><circle cx="50" cy="71.5" r="2.6"/><circle cx="68" cy="71.5" r="2.6"/></g></symbol>'+
 '<symbol id="wc-J" viewBox="0 0 100 80"><path fill="currentColor" d="M14 64C11 40 28 20 52 22C68 24 80 34 85 47L92 47V64Z"/><path fill="'+GOLD+'" d="M10 67H94V76H10Z"/><path fill="'+GOLDHI+'" d="M58 24C67 5 88 1 98 7C92 11 88 19 80 26C74 31 65 31 58 24Z"/><circle cx="30" cy="71.5" r="2.6" fill="#fbf6ea"/><circle cx="50" cy="71.5" r="2.6" fill="#fbf6ea"/><circle cx="70" cy="71.5" r="2.6" fill="#fbf6ea"/></symbol>'+
 '<symbol id="wc-JK" viewBox="0 0 100 80"><path fill="currentColor" d="M10 64C4 46 6 28 20 15C22 31 32 42 43 46C43 31 45 18 50 6C55 18 57 31 57 46C68 42 78 31 80 15C94 28 96 46 90 64Z"/><path fill="'+GOLD+'" d="M8 67H92V76H8Z"/><g fill="'+GOLDHI+'"><circle cx="20" cy="11" r="6.5"/><circle cx="50" cy="5" r="6.5"/><circle cx="80" cy="11" r="6.5"/></g></symbol>'+
 '<symbol id="wc-star" viewBox="0 0 100 100"><path fill="currentColor" d="M50 5L62 37L96 38L69 59L79 92L50 72L21 92L31 59L4 38L38 37Z"/></symbol>'+
 /* War's back emblem: two crossed sabres in a gold diamond (original) */
 '<symbol id="wc-sabres" viewBox="0 0 100 100"><g fill="none" stroke="currentColor" stroke-width="5" stroke-linecap="round"><path d="M18 18L62 62M82 18L38 62"/><path d="M54 72L72 54M46 72L28 54" stroke-width="6"/><path d="M62 62L76 76M38 62L24 76" stroke-width="7"/></g><circle cx="80" cy="80" r="5" fill="currentColor"/><circle cx="20" cy="80" r="5" fill="currentColor"/></symbol>'+
 '</defs></svg>';
var PIPS={ 2:[["C",0],["C",1]], 3:[["C",0],["C",.5],["C",1]], 4:[["L",0],["R",0],["L",1],["R",1]], 5:[["L",0],["R",0],["C",.5],["L",1],["R",1]],
  6:[["L",0],["R",0],["L",.5],["R",.5],["L",1],["R",1]], 7:[["L",0],["R",0],["C",.25],["L",.5],["R",.5],["L",1],["R",1]],
  8:[["L",0],["R",0],["C",.25],["L",.5],["R",.5],["C",.75],["L",1],["R",1]],
  9:[["L",0],["R",0],["L",1/3],["R",1/3],["C",.5],["L",2/3],["R",2/3],["L",1],["R",1]],
  10:[["L",0],["R",0],["C",1/6],["L",1/3],["R",1/3],["L",2/3],["R",2/3],["C",5/6],["L",1],["R",1]]};
var XCOL={L:33,C:50,R:67};
function pip(s,x,y,w,flip){ var h=w/2; return '<use href="#wc-'+s+'" x="'+(x-h)+'" y="'+(y-h)+'" width="'+w+'" height="'+w+'"'+(flip?' transform="rotate(180 '+x+' '+y+')"':'')+'/>'; }
function artSVG(c){
  var s=c.s, body="", r=c.r;
  if(c.joker){
    body='<ellipse cx="50" cy="76" rx="36" ry="46" fill="'+(c.red?"#ffe6ea":"#e9e6f4")+'" opacity=".75"/><use href="#wc-JK" x="17" y="42" width="66" height="53"/>'+
         '<use href="#wc-star" x="19" y="100" width="10" height="10" style="color:'+GOLD+'"/><use href="#wc-star" x="45" y="103" width="10" height="10" style="color:'+GOLD+'"/><use href="#wc-star" x="71" y="100" width="10" height="10" style="color:'+GOLD+'"/>';
  } else if(r===14){
    body='<circle cx="50" cy="84" r="34" fill="none" stroke="'+GOLD+'" stroke-width="1.6" opacity=".7"/>'+pip(s,50,84,50);
  } else if(r>=11){
    var K=r===13?"K":r===12?"Q":"J";
    body='<rect x="22" y="52" width="56" height="82" rx="9" fill="'+GOLD+'" fill-opacity=".14" stroke="'+GOLD+'" stroke-width="2"/><rect x="26" y="56" width="48" height="74" rx="6" fill="none" stroke="'+GOLD+'" stroke-width="1" opacity=".7"/>'+
         '<use href="#wc-'+K+'" x="29" y="62" width="42" height="33.6"/>'+pip(s,50,111,22)+'<path d="M32 121H68" stroke="'+GOLD+'" stroke-width="1.2" opacity=".8"/>';
  } else {
    var P=PIPS[r]||[], w=r<=3?24:17.5;
    for(var i=0;i<P.length;i++){ var y=P[i][1]*64+60; body+=pip(s,XCOL[P[i][0]],y,w,y>92); }
  }
  return '<svg class="wf-art" viewBox="0 0 100 142" aria-hidden="true" focusable="false">'+body+'</svg>';
}
function corner(c,k){
  return '<i class="'+k+'">'+(c.joker?'<svg class="wf-pp st" viewBox="0 0 100 100" aria-hidden="true" focusable="false"><use href="#wc-star"/></svg>':
    '<b>'+rankLabel(c.r)+'</b><svg class="wf-pp" viewBox="0 0 100 100" aria-hidden="true" focusable="false"><use href="#wc-'+c.s+'"/></svg>')+'</i>';
}
/* the inner HTML of a face (no wrapper) and the class it needs */
function faceInner(id){ var c=info(id); return corner(c,"tl")+corner(c,"tr")+artSVG(c)+(c.joker?'<u class="wf-jt">JOKER</u>':''); }
function faceClass(id){ var c=info(id); return "wf"+(c.joker?" jk"+(c.red?" jr":""):(c.red?" red":"")); }
function faceHTML(id,o){ o=o||{}; return '<div class="'+faceClass(id)+(o.cls?" "+o.cls:"")+'" data-id="'+id+'"'+(o.attrs?" "+o.attrs:"")+'>'+faceInner(id)+'</div>'; }
function backHTML(o){ o=o||{}; return '<div class="wf wf-back'+(o.cls?" "+o.cls:"")+'"'+(o.attrs?" "+o.attrs:"")+'><svg class="wf-em" viewBox="0 0 100 100" aria-hidden="true" focusable="false"><use href="#wc-sabres"/></svg></div>'; }
/* a table card: <div class="wcard [is-up]"><div class="wf-in"><div class="wf face"/><div class="wf wf-back"/></div></div>. id null = unknown face */
function tableCard(id,up){
  var d=document.createElement("div"); d.className="wcard"+(up?" is-up":"");
  d.innerHTML='<div class="wf-in">'+(id!=null?faceHTML(id,{cls:"wf-face"}):'<div class="wf wf-face wf-blank"></div>')+backHTML({cls:"wf-bk"})+'</div>';
  if(id!=null) d.setAttribute("data-id",id);
  return d;
}
function setFace(card,id){
  var f=card.querySelector(".wf-face"); if(!f) return;
  f.className=faceClass(id)+" wf-face"; f.setAttribute("data-id",id); f.innerHTML=faceInner(id); card.setAttribute("data-id",id);
}
/* suit symbols in log text become the sprite's pips (the font subsets have no suit glyphs) */
var SYMS={"♠":"S","♥":"H","♦":"D","♣":"C"};
function pipText(html){ return String(html).replace(/[♠♥♦♣]/g,function(ch){ var s=SYMS[ch]; return '<svg class="wf-ipip'+(RED[s]?" red":"")+'" viewBox="0 0 100 100" role="img" aria-label="'+({S:"spades",H:"hearts",D:"diamonds",C:"clubs"})[s]+'"><use href="#wc-'+s+'"/></svg>'; }); }
var FD='var(--font-display,"DM Serif Display",Georgia,serif)', FU='var(--font-ui,Manrope,system-ui,sans-serif)', CW='var(--cw,64px)', FM='var(--fs-micro,12px)';
var CSS=[
".wf{position:relative;display:block;flex:none;width:"+CW+";height:calc("+CW+"*1.42);border-radius:calc("+CW+"*.115);color:#1d2142;"+
  "background:radial-gradient(95% 70% at 50% 14%,var(--paper-50,#fbf6ea) 0%,var(--paper-100,#f1e8d4) 62%,var(--paper-200,#e5d9bf) 100%);"+
  "border:1px solid #a89570;box-shadow:inset 0 0 0 calc("+CW+"*.035) var(--paper-50,#fbf6ea),inset 0 0 0 calc("+CW+"*.035 + 1px) rgba(107,81,36,.4),0 2px 5px #0009;box-sizing:border-box;overflow:hidden}",
".wf.red{color:#b3263a}",
".wf .tl,.wf .tr{position:absolute;top:calc("+CW+"*.05);display:flex;flex-direction:column;align-items:center;gap:calc("+CW+"*.02);font-style:normal;line-height:1;pointer-events:none}",
".wf .tl{left:calc("+CW+"*.075)}.wf .tr{right:calc("+CW+"*.075)}",
".wf .tl b,.wf .tr b{font:400 max("+FM+",calc("+CW+"*.3))/1 "+FD+";letter-spacing:-.02em;font-variant-numeric:lining-nums}",
".wf-pp{display:block;width:calc("+CW+"*.19);height:calc("+CW+"*.19);fill:currentColor}",
".wf-pp.st{width:calc("+CW+"*.2);height:calc("+CW+"*.2);color:#c99f5e}",
".wf-art{position:absolute;inset:0;width:100%;height:100%;pointer-events:none;fill:currentColor}",
".wf.jk{color:#2a2742;background:radial-gradient(95% 70% at 50% 14%,#fffaf0 0%,#eeeaf8 64%,#d9d3ea 100%)}",
".wf.jk.jr{color:#9b1f3a;background:radial-gradient(95% 70% at 50% 14%,#fffaf0 0%,#ffeef0 64%,#f1d3d8 100%)}",
".wf-jt{position:absolute;left:0;right:0;bottom:calc("+CW+"*.045);text-align:center;text-decoration:none;font:400 max("+FM+",calc("+CW+"*.19))/1 "+FD+";letter-spacing:.04em;color:inherit;white-space:nowrap}",
/* War's back: field olive, a gold lattice, crossed sabres in a gold diamond */
".wf.wf-back{border:1px solid #c99f5e;color:#e7ca90;box-shadow:inset 0 0 0 calc("+CW+"*.05) #141a08,inset 0 0 0 calc("+CW+"*.05 + 1px) rgba(231,202,144,.7),0 2px 5px #0009;"+
  "background:radial-gradient(70% 46% at 50% 50%,rgba(231,202,144,.24),transparent 72%),repeating-linear-gradient(45deg,rgba(231,202,144,.2) 0 1px,transparent 1px calc("+CW+"*.115)),repeating-linear-gradient(-45deg,rgba(231,202,144,.2) 0 1px,transparent 1px calc("+CW+"*.115)),linear-gradient(160deg,#4a5a22,#1b230b)}",
".wf.wf-back::before{content:'';position:absolute;left:50%;top:50%;width:calc("+CW+"*.5);height:calc("+CW+"*.5);transform:translate(-50%,-50%) rotate(45deg);border:calc("+CW+"*.03) solid #e7ca90;background:#1d260c;box-shadow:0 0 0 calc("+CW+"*.03) #1d260c,0 0 0 calc("+CW+"*.045) rgba(231,202,144,.6)}",
".wf-em{position:absolute;left:50%;top:50%;width:calc("+CW+"*.36);height:calc("+CW+"*.36);transform:translate(-50%,-50%);color:#f0d48a}",
".wf-blank{background:var(--paper-100,#f1e8d4)}",
/* the table card: a plain wrapper moved by transform; .wf-in turns (rotateY) to flip */
".wcard{position:absolute;left:0;top:0;width:"+CW+";height:calc("+CW+"*1.42);perspective:calc("+CW+"*7);will-change:transform;pointer-events:none}",
".wf-in{position:relative;width:100%;height:100%;transform-style:preserve-3d;transform:rotateY(180deg)}",
".wcard.is-up .wf-in{transform:none}",
".wf-in > .wf{position:absolute;inset:0;width:100%;height:100%;backface-visibility:hidden;-webkit-backface-visibility:hidden}",
".wf-in > .wf-bk{transform:rotateY(180deg)}",
".wf-ipip{display:inline-block;width:.85em;height:.85em;margin:0 .05em;vertical-align:-.08em;fill:currentColor;color:var(--text-1,#f6efe0)}",
".wf-ipip.red{color:#ff8a98}"
].join("\n");
function injectCSS(){
  if(typeof document==="undefined"||document.getElementById("warCardCss")) return;
  var s=document.createElement("style"); s.id="warCardCss"; s.textContent=CSS; document.head.appendChild(s);
  var d=document.createElement("div"); d.id="warCardSprite"; d.setAttribute("aria-hidden","true"); d.style.cssText="position:absolute;width:0;height:0;overflow:hidden"; d.innerHTML=SPRITE;
  (document.body||document.documentElement).insertBefore(d,(document.body||document.documentElement).firstChild);
}
W.Cards={info:info,rankLabel:rankLabel,faceHTML:faceHTML,faceInner:faceInner,faceClass:faceClass,backHTML:backHTML,tableCard:tableCard,setFace:setFace,pipText:pipText,injectCSS:injectCSS,CSS:CSS,SPRITE:SPRITE};
})(typeof window!=="undefined"?window:globalThis);
