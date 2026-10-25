/* UNO — original card artwork (no Mattel art) as HTML/SVG, plus the table + hand controller shared by the phone game and the Party phones. Needs engine.js.
   Step 4 (Midnight Luxe): create({luxe:true, seatOf, tv, pulse, gameKey}) draws the table with the shared ui/ pieces (a bg-players strip with
   BGUI.setTurn, the felt table, bg- buttons, colour / target choices as BGUI sheets, the D-pad on TV). Without ui/ui.js, or without luxe:true
   (the Party Mode phones), the original panel is used, unchanged. */
(function(g){
"use strict";
var Uno=g.Uno=g.Uno||{}, E=Uno.Engine;
/* ---------------- the card faces (step 5): original Midnight Luxe artwork, all vector ----------------
   One element per card, sized by --cw (any length: 64px, 4.4rem, 13vh): everything inside is in em of the card width, and the face is one
   inline SVG (100 x 150 units) with no gradients, ids or filters. A lacquered colour field, an ivory rim with a gold hairline, an elongated
   rounded diamond "inlay" carrying the big numeral or symbol, and an index plate in two corners (the second turned upside down). Dark-side
   (Flip) faces carry a night rim and inlay with the colour in the numeral. No oval, no "UNO" lettering, no four-quarter wheel: a Wild is
   a fan of four small cards. Numbers use DM Serif Display (ui/fonts) and fall back to Georgia. */
var COL={R:"#e0443a",Y:"#f6c92e",G:"#2fa857",B:"#3b72dc",P:"#e9529c",T:"#1fbdb5",O:"#f5902f",V:"#8a5fe0",W:"#232850"};   // field mid-tones (the colour discs and the picker use these too)
var F1={R:"#e9564a",Y:"#fbd43c",G:"#41b868",B:"#4f86ec",P:"#f46aa8",T:"#33cfc7",O:"#ffa549",V:"#9d73ea",W:"#2a3060"};   // field, lit corner
var F2={R:"#a61f1b",Y:"#d9970a",G:"#17713a",B:"#1f4aa6",P:"#932461",T:"#0a756f",O:"#bf4f0a",V:"#52289a",W:"#0b0d1d"};   // field, shaded corner
var INK={R:"#b3261e",Y:"#8a5a00",G:"#1d7a3c",B:"#2457b8",P:"#ff7ab8",T:"#3fe0d6",O:"#ffa347",V:"#c4a6ff",W:"#14172b"};   // numerals: >= 4.9:1 on the inlay (ivory on the light side, night on the dark side)
var CN=E.CNAME;
function esc(s){ return String(s==null?"":s).replace(/[&<>"]/g,function(c){return{"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c];}); }
function faceName(f){ return f.c==="W"?(E.VNAME[f.v]||"Wild"):(CN[f.c]||"")+" "+((f.v.length===1)?f.v:(E.VNAME[f.v]||f.v)); }

/* a polygon with rounded corners as an SVG path */
function rpoly(pts,r){
  var n=pts.length, d="";
  function f(p){ return (Math.round(p[0]*10)/10)+" "+(Math.round(p[1]*10)/10); }
  for(var i=0;i<n;i++){
    var p0=pts[(i+n-1)%n], p1=pts[i], p2=pts[(i+1)%n];
    function u(a){ var dx=a[0]-p1[0], dy=a[1]-p1[1], l=Math.sqrt(dx*dx+dy*dy); return [dx/l,dy/l]; }
    var v1=u(p0), v2=u(p2), a=[p1[0]+v1[0]*r,p1[1]+v1[1]*r], b=[p1[0]+v2[0]*r,p1[1]+v2[1]*r];
    d+=(i?"L":"M")+f(a)+"Q"+f(p1)+" "+f(b);
  }
  return d+"Z";
}
var MED=rpoly([[50,19],[88,75],[50,131],[12,75]],9), MEDIN=rpoly([[50,26],[81,75],[50,124],[19,75]],7);
var FAN=["#e0443a","#f6c92e","#2fa857","#3b72dc"];
var DARKFAN=["#e9529c","#1fbdb5","#f5902f","#8a5fe0"];
/* the Wild mark: four small cards in a fan (original; pivot at 50,100) */
function fan(cx,cy,s,dark){
  var o='<g transform="translate('+cx+' '+cy+') scale('+s+') translate(-50 -80)">';
  [-33,-11,11,33].forEach(function(a,i){ o+='<rect x="39" y="63" width="22" height="34" rx="3.5" transform="rotate('+a+' 50 100)" fill="'+(dark?DARKFAN:FAN)[i]+'" stroke="#14172b" stroke-width="1.5"/>'; });
  return o+'</g>';
}
function pips(y,dark){ var o=""; [35.5,45.2,54.8,64.5].forEach(function(x,i){ o+='<path d="M'+x+' '+(y-4.2)+'L'+(x+3.4)+' '+y+'L'+x+' '+(y+4.2)+'L'+(x-3.4)+' '+y+'Z" fill="'+(dark?DARKFAN:FAN)[i]+'" stroke="#14172b" stroke-width="1"/>'; }); return o; }
function st(w){ return 'fill="none" stroke="currentColor" stroke-width="'+w+'" stroke-linecap="round" stroke-linejoin="round"'; }
var ARR_REV='<path d="M30 62H66M56 50L68 62L56 74" '+st(7)+'/><path d="M70 88H34M44 76L32 88L44 100" '+st(7)+'/>';
var SKIP='<circle cx="50" cy="75" r="19" '+st(7)+'/><path d="M36.5 88.5L63.5 61.5" '+st(7)+'/>';
var CIRC='<g transform="translate(50 80) scale(1.5) translate(-24 -24)"><path d="M38 24a14 14 0 1 1-4.1-9.9" '+st(4)+'/><path d="M36 6v9.5h-9.5" '+st(4)+'/></g>';
var SKIPALL='<circle cx="33" cy="75" r="13" '+st(5.5)+'/><path d="M24 84L42 66" '+st(5.5)+'/><circle cx="67" cy="75" r="13" '+st(5.5)+'/><path d="M58 84L76 66" '+st(5.5)+'/>';
var FLIPG='<path d="M36 92V58M26 68L36 56L46 68" '+st(7)+'/><path d="M64 58V92M54 82L64 94L74 82" '+st(7)+'/>';
var XX='<path d="M35 52L65 82M65 52L35 82" '+st(8)+'/>';
var MINI={skip:SKIP,wskip:SKIP,wskip2:SKIP,skipall:SKIPALL,rev:ARR_REV,wrev:ARR_REV,wswap:ARR_REV,flip:FLIPG,discardall:XX,roul:CIRC,wrd4:ARR_REV};
function under(g,sc,cy){ return '<g transform="translate(50 '+cy+') scale('+sc+') translate(-50 -75)">'+g+'</g>'; }
var MS={skipall:.215};
function num(t,sz,y){ return '<text class="nm" x="50" y="'+y+'" text-anchor="middle" style="font-size:'+sz+'px">'+t+'</text>'; }
/* the symbol drawn inside the inlay; everything in currentColor (the face's ink) except the Wild fan. Centre of the inlay: 50,75 */
function sym(v,dark){
  switch(v){
    case "skip": return SKIP;
    case "wskip": return pips(50,dark)+under(SKIP,.78,82);
    case "wskip2": return pips(50,dark)+under(SKIP,.66,76)+num("x2",20,108);
    case "skipall": return SKIPALL;
    case "rev": return ARR_REV;
    case "wrev": return pips(50,dark)+under(ARR_REV,.78,82);
    case "wswap": return pips(50,dark)+under('<rect x="24" y="66" width="20" height="30" rx="3.5" '+st(3.5)+'/><rect x="56" y="66" width="20" height="30" rx="3.5" '+st(3.5)+'/><path d="M47 76H53M51 72.5L54 76L51 79.5M53 88H47M49 84.5L46 88L49 91.5" '+st(2.6)+'/>',.72,78);
    case "flip": return FLIPG;
    case "d1": return num("+1",46,91);
    case "d2": case "wd2": case "wtd2": return v==="d2"?num("+2",46,91):fan(50,57,.6,dark)+num("+2",30,104);
    case "d4": return num("+4",46,91);
    case "wd4": return fan(50,57,.6,dark)+num("+4",30,104);
    case "d5": return num("+5",46,91);
    case "wd6": return fan(50,57,.6,dark)+num("+6",30,104);
    case "wd10": return fan(50,56,.56,dark)+num("+10",22,103);
    case "wdc": return fan(50,57,.6,dark)+num("+C",30,104);
    case "wrd4": return '<g transform="translate(50 58) scale(.56) translate(-50 -75)">'+ARR_REV+'</g>'+num("+4",30,104);
    case "discardall": return XX+num("ALL",16,104);
    case "roul": return pips(50,dark)+'<g transform="translate(50 83) scale(.58) translate(-50 -80)">'+CIRC+'</g>';
    case "wild": return fan(50,80,1.06,dark);
  }
  return "";
}
/* the corner index: the value (or a small symbol) on a plate, centred at 15.5,21 */
function indexMark(f,dark){
  var v=f.v;
  if(f.c!=="W"&&v.length===1) return '<text class="ix" x="16" y="28" text-anchor="middle" style="font-size:20px">'+v+'</text>'+((v==="6"||v==="9")?'<rect class="ink" x="12" y="30.2" width="8" height="1.7" rx=".8"/>':"");
  var t={d1:"+1",d2:"+2",d4:"+4",d5:"+5",wd4:"+4",wd2:"+2",wtd2:"+2",wd6:"+6",wd10:"10",wdc:"+C",wild:"W"}[v];
  if(t) return '<text class="ix" x="16" y="27.5" text-anchor="middle" style="font-size:'+(t==="W"?15:t==="+C"?13:t==="10"?14:15)+'px">'+t+'</text>';
  return MINI[v]?'<g class="ink-s mini" transform="translate(16 21.5) scale('+(MS[v]||.27)+') translate(-50 -75)">'+MINI[v]+'</g>':"";
}
/* one card face as HTML. card={id,f:[..]}; side 0/1 */
function cardHTML(card,side,o){
  o=o||{}; var f=card.f[side||0], dark=!!side, wild=f.c==="W", c=f.c, nm=faceName(f);
  var plate='<rect class="pl" x="6.5" y="8" width="19" height="27" rx="4.5"/>'+indexMark(f,dark);
  var big=(!wild&&f.v.length===1)?num(f.v,68,98)+((f.v==="6"||f.v==="9")?'<rect class="ink" x="38" y="104.5" width="24" height="4" rx="2"/>':""):'<g class="ink-s">'+sym(f.v,dark)+'</g>';
  var cls="uc c"+c+(dark?" dk":"")+(wild?" wl":"")+(o.cls?" "+o.cls:"")+(o.dim?" dim":"")+(o.glow?" glow":"");
  var at=o.attrs||"";
  return '<div class="'+cls+'" data-id="'+card.id+'"'+(at.indexOf("aria-label")<0?' aria-label="'+esc(nm)+'"':"")+(at?" "+at:"")+(o.style||o.rot?' style="'+(o.rot?"--rot:"+o.rot+"deg;":"")+(o.style||"")+'"':"")+'>'+
    '<svg viewBox="0 0 100 150" aria-hidden="true" focusable="false"><rect class="fr" x="5.2" y="5.2" width="89.6" height="139.6" rx="7"/><path class="md" d="'+MED+'"/><path class="mi" d="'+MEDIN+'"/>'+big+
    '<g>'+plate+'</g><g transform="rotate(180 50 75)">'+plate+'</g></svg></div>';
}
/* the card back: night lacquer, gold lattice and frame, a gold star in a rounded diamond */
var STAR=(function(){ var p=[]; for(var i=0;i<16;i++){ var a=Math.PI*i/8-Math.PI/2, r=i%2?6.2:19; p.push((50+r*Math.cos(a)).toFixed(1)+" "+(75+r*Math.sin(a)).toFixed(1)); } return "M"+p.join("L")+"Z"; })();
function backHTML(o){
  o=o||{};
  return '<div class="uc back'+(o.cls?" "+o.cls:"")+'"'+(o.attrs?" "+o.attrs:"")+'><svg viewBox="0 0 100 150" aria-hidden="true" focusable="false"><rect class="fr" x="5.2" y="5.2" width="89.6" height="139.6" rx="7"/><rect class="fr2" x="9.5" y="9.5" width="81" height="131" rx="5"/>'+
    '<path class="bm" d="'+MED+'"/><path class="mi" d="'+MEDIN+'"/><path class="bs" d="'+STAR+'"/><circle class="bc" cx="50" cy="75" r="3.4"/>'+
    '<path d="M50 29.5l3.4 3.7-3.4 3.7-3.4-3.7z" fill="'+FAN[0]+'"/><path d="M50 113l3.4 3.7-3.4 3.7-3.4-3.7z" fill="'+FAN[2]+'"/><path d="M21.5 75l3.7-3.4 3.7 3.4-3.7 3.4z" fill="'+FAN[1]+'"/><path d="M71.1 75l3.7-3.4 3.7 3.4-3.7 3.4z" fill="'+FAN[3]+'"/></svg>'+
    (o.label?'<b class="bl">'+esc(o.label)+'</b>':"")+'</div>';
}

/* colour classes: --f1/--f2 the lacquer, --ink the numeral, --med the inlay and plates, --rim the card edge */
var CSS=(function(){
  var rows=[], k;
  ["R","Y","G","B","P","T","O","V","W"].forEach(function(c){
    var dk=("PTOV".indexOf(c)>=0);
    rows.push(".uc.c"+c+"{--f1:"+F1[c]+";--f2:"+F2[c]+";--ink:"+INK[c]+";--med:"+(dk?"#141833":c==="W"?"#fbf6e8":"#fbf6e8")+";--hair:"+(dk?"#e7ca90":F2[c])+"}");
  });
  return [
".uc{--rim:#f5eedb;--pat:none;--ps:.16em .16em;position:relative;display:inline-block;flex:none;box-sizing:border-box;width:1em;height:1.5em;font-size:var(--cw,64px);border-radius:.12em;border:.04em solid var(--rim);",
" background:linear-gradient(152deg,var(--f1,#444),var(--f2,#111));box-shadow:0 .03em .06em rgba(0,0,0,.5),0 .09em .2em rgba(0,0,0,.42),inset 0 .012em 0 rgba(255,255,255,.5);",
" user-select:none;-webkit-user-select:none;cursor:pointer;overflow:hidden;transition:transform .12s,box-shadow .12s;line-height:1}",
".uc::before{content:\"\";position:absolute;inset:0;border-radius:inherit;pointer-events:none;background-image:var(--pat),radial-gradient(120% 80% at 28% 6%,rgba(255,255,255,.3),rgba(255,255,255,0) 58%);background-size:var(--ps),100% 100%}",
".uc.cR,.uc.cP{--pat:linear-gradient(45deg,rgba(255,255,255,.09) 25%,transparent 25% 75%,rgba(255,255,255,.09) 75%)}",
".uc.cY,.uc.cT{--pat:repeating-linear-gradient(0deg,rgba(255,255,255,.14) 0 .012em,transparent .012em .1em);--ps:100% 100%}",
".uc.cG,.uc.cO{--pat:repeating-linear-gradient(90deg,rgba(255,255,255,.1) 0 .012em,transparent .012em .1em);--ps:100% 100%}",
".uc.cB,.uc.cV{--pat:radial-gradient(circle,rgba(255,255,255,.16) 0 .018em,transparent .02em);--ps:.1em .1em}",
".uc.cW{--pat:linear-gradient(45deg,rgba(231,202,144,.1) 25%,transparent 25% 75%,rgba(231,202,144,.1) 75%)}",
".uc.dk{--rim:#161a36;box-shadow:0 .03em .06em rgba(0,0,0,.6),0 .09em .2em rgba(0,0,0,.5),inset 0 0 0 .012em rgba(231,202,144,.55)}",
".uc svg{position:absolute;inset:0;width:100%;height:100%;display:block}",
".uc .fr{fill:none;stroke:#e7ca90;stroke-width:.8;opacity:.6}.uc.back .fr2{fill:none;stroke:#e7ca90;stroke-width:.5;opacity:.5}",
".uc .md{fill:var(--med,#fbf6e8);stroke:rgba(20,23,43,.55);stroke-width:1}.uc .mi{fill:none;stroke:var(--hair,#8a5a00);stroke-width:.9;opacity:.55}",
".uc .pl{fill:var(--med,#fbf6e8);stroke:var(--hair,#8a5a00);stroke-width:.8}",
".uc .nm{stroke:var(--ink,#14172b);stroke-width:1.5;stroke-linejoin:round}",
".uc .nm,.uc .ix{fill:var(--ink,#14172b);font-family:var(--font-display,\"DM Serif Display\",\"Iowan Old Style\",Georgia,serif)}",
".uc .ix{font-family:var(--font-ui,\"Manrope\",system-ui,sans-serif);font-weight:800}",
".uc .ink{fill:var(--ink,#14172b)}.uc .ink-s{color:var(--ink,#14172b)}.uc .mini path,.uc .mini circle{stroke-width:11px}",
".uc.dk.cW{--med:#141833;--ink:#f6efdb;--hair:#e7ca90}",
".uc.back{--rim:#f5eedb;background:linear-gradient(152deg,#262b57,#0b0d1f);--pat:linear-gradient(45deg,rgba(231,202,144,.13) 25%,transparent 25% 75%,rgba(231,202,144,.13) 75%)}",
".uc .bm{fill:#0e1128;stroke:#e7ca90;stroke-width:1.5}.uc.back .mi{stroke:#e7ca90;opacity:.7}.uc .bs{fill:#ecd29b}.uc .bc{fill:#0e1128}",
".uc .bl{position:absolute;left:.1em;right:.1em;bottom:.07em;padding:.03em .02em;border-radius:.06em;text-align:center;font:800 .17em/1.15 var(--font-ui,system-ui,sans-serif);color:#f6efdb;background:rgba(8,10,21,.86)}",
".uc.back.dead{opacity:.5}",
".uc.dim::after{content:\"\";position:absolute;inset:-1px;border-radius:inherit;background:rgba(8,10,21,.52);pointer-events:none}",
".uc.glow{transform:translateY(-.12em);box-shadow:0 0 0 .035em #e7ca90,0 0 .34em .05em rgba(231,202,144,.6),0 .1em .22em rgba(0,0,0,.5)}",
".uc.sel{transform:translateY(-.18em)}",
".uc.jmp{transform:translateY(-.12em);box-shadow:0 0 0 .035em #fff3d1,0 0 .4em .07em rgba(255,243,209,.85),0 .1em .22em rgba(0,0,0,.5)}",
"@keyframes ucpop{from{transform:scale(.4) rotate(-12deg);opacity:0}to{transform:rotate(var(--rot,0deg));opacity:1}}.uc.pop{animation:ucpop .35s ease-out}",
"html[data-effects=\"reduced\"] .uc.pop,html[data-motion=\"reduce\"] .uc.pop{animation:none}",
"@media (prefers-reduced-motion:reduce){.uc.pop{animation:none}}"
  ].concat(rows).join("\n");
})();
function injectCSS(){ if(typeof document==="undefined"||document.getElementById("unoCardCss")) return; var s=document.createElement("style"); s.id="unoCardCss"; s.textContent=CSS+NEXT_CSS; document.head.appendChild(s); }

/* ================= controller (reads a snapshot V, sends action objects) ================= */
var CTCSS=[
".unoT{width:100%;color:#fff;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif}",
".upl{display:flex;flex-wrap:wrap;gap:6px;justify-content:center;margin:4px 0}",
".upc{display:flex;align-items:center;gap:6px;background:#00000066;border:3px solid #ffffff22;border-radius:14px;padding:5px 9px;font-size:12.5px;font-weight:800;position:relative}",
".upc .bd{min-width:22px;height:22px;border-radius:6px;background:#fff;color:#111;display:flex;align-items:center;justify-content:center;font-weight:900;font-size:13px}",
".upc.cur{border-color:var(--c);box-shadow:0 0 0 2px var(--c),0 0 16px 2px var(--c);background:#000000a8}",
".upc.out{opacity:.35}.upc small{opacity:.8;font-weight:600}",
".upc button{background:#ffd23f;color:#111;border:0;border-radius:8px;font-weight:900;padding:3px 7px;font-size:11px;cursor:pointer}",
".utbl{display:flex;align-items:center;justify-content:center;gap:16px;margin:8px 0;min-height:130px}",
".utbl .pile{--cw:78px;text-align:center;font-size:11px;font-weight:800;color:#fde;position:relative}",
".utbl .pile .uc{display:block;margin:0 auto 4px}",
".ucol{width:30px;height:30px;border-radius:50%;border:3px solid #fff;margin:6px auto 0;box-shadow:0 0 10px #000a}",
".udir{font-size:24px;text-align:center;opacity:.9;line-height:1}",
".upen{background:#e53b2c;border-radius:999px;padding:4px 12px;font-weight:900;font-size:15px;display:inline-block;margin-top:4px}",
".ustat{background:#00000066;border:2px solid var(--pc,#ffffff30);border-radius:12px;padding:8px 12px;margin:6px 0;font-weight:700;font-size:14px;text-align:center;min-height:42px;box-shadow:0 0 12px -2px var(--pc,transparent)}",
".uacts{display:flex;flex-wrap:wrap;gap:8px;justify-content:center;margin:6px 0;min-height:44px}",
".uacts button{background:#2a2118;color:#fff;border:1px solid #ffffff55;border-radius:12px;padding:11px 15px;font-size:15px;font-weight:900;cursor:pointer}",
".uacts button.pri{background:#e53b2c;border-color:#ff8a7a}.uacts button.gold{background:#f2bf24;color:#1a1200;border-color:#ffe38a}.uacts button[disabled]{opacity:.35}",
".uhand{--cw:64px;display:flex;flex-wrap:wrap;gap:8px 0;justify-content:center;padding:14px 20px 6px 4px;min-height:110px}.uhand .uc{margin-right:-18px}",
".ulog{font-size:11.5px;color:#d9cdd6;text-align:center;line-height:1.35;min-height:34px}",
".umodal{position:fixed;inset:0;z-index:70;background:#0a0a10ee;display:none;align-items:center;justify-content:center;padding:14px}.umodal.show{display:flex}",
".umodal .sh{width:min(100%,420px);background:#23232c;border:2px solid #ffffff44;border-radius:18px;padding:16px;text-align:center;box-shadow:0 18px 44px #000b}",
".umodal h3{margin:0 0 10px;font-size:18px}.ucp{display:flex;gap:10px;justify-content:center;flex-wrap:wrap}.ucp button{width:64px;height:64px;border-radius:50%;border:4px solid #fff;font-weight:900;font-size:13px;color:#fff;text-shadow:0 1px 2px #000;cursor:pointer}",
".utg{display:flex;flex-direction:column;gap:8px}.utg button{background:#2a2118;color:#fff;border:1px solid #ffffff66;border-radius:12px;padding:12px;font-size:15px;font-weight:800}",
"@media(min-width:520px){.uhand{--cw:74px}.utbl .pile{--cw:92px}}"
].join("\n");
function injectCtCSS(){ if(typeof document==="undefined"||document.getElementById("unoCtCss")) return; var s=document.createElement("style"); s.id="unoCtCss"; s.textContent=CTCSS; document.head.appendChild(s); }

/* ---- Luxe controller CSS (step 4): only added when the controller runs in luxe mode (needs ui/theme.css on the page) ---- */
var HI={R:"#ff8a7e",Y:"#ffe58a",G:"#7fdc97",B:"#8fb4f7",P:"#ffa6d0",T:"#7ee6df",O:"#ffbc78",V:"#c2a8f4"};
var LCSS=[
".unoT.un-lux{width:100%;color:var(--text-1);font-family:var(--font-ui)}",
".un-lux .upl{padding-inline:0}",
".un-lux .utbl{position:relative;display:flex;align-items:center;justify-content:center;gap:1.25rem;min-height:13rem;margin:.5rem 0;padding:1.25rem .75rem 1rem}",
".un-lux .utbl .pile{--cw:86px;position:relative;text-align:center;font:var(--fw-ui-strong) var(--fs-micro)/1.3 var(--font-ui);color:var(--text-2)}",
".un-lux .utbl .pile .uc{display:block;margin:0 auto .4rem}",
".un-lux .utbl .un-mid{display:grid;justify-items:center;align-content:center;gap:.5rem;min-width:4.5rem}",
".un-lux .udir{width:2.25rem;height:2.25rem;color:var(--gold-200)}.un-lux .udir svg{display:block;width:100%;height:100%}",
".un-lux .ucol{--c:#888;--hi:#ccc;width:2.5rem;height:2.5rem;margin:0;border:0;border-radius:50%;background:radial-gradient(circle at 35% 30%,var(--hi),var(--c) 62%);box-shadow:0 0 0 .1875rem var(--ink-1),0 0 0 .3125rem var(--focus-ivory)}",
".un-lux .ucol.any{display:flex;align-items:center;justify-content:center;gap:.14rem;background:var(--ink-3)}.un-lux .ucol.any i{width:.46rem;height:.46rem;border-radius:.1rem;transform:rotate(45deg)}",
".un-lux .ucname{font:var(--fw-ui-strong) var(--fs-sm)/1.2 var(--font-ui);color:var(--text-1)}",
".un-lux .upen{margin:0;padding:.2rem .7rem;border-radius:var(--r-pill);font:var(--fw-caps) var(--fs-md)/1.2 var(--font-ui);color:var(--danger-ink);background:var(--danger)}",
".un-lux .ustat{display:flex;align-items:center;justify-content:center;gap:.5rem;min-height:calc(1.3em + 1.25rem);margin:.5rem 0 .25rem;padding:.625rem .875rem;font:var(--fw-ui) var(--fs-md)/1.3 var(--font-ui);text-align:center;color:var(--text-1);border:0;border-radius:var(--r-lg)}",
".un-lux .ustat{flex-wrap:wrap}.un-lux .ustat .unn{flex-basis:100%;font-size:.8em;margin-top:.25rem}",
".un-lux .ustat[data-seat]{box-shadow:var(--panel-edge),inset 0 0 0 1.5px var(--seat-ring),var(--elev-2)}",
".un-lux .ustat .dot{flex:none;width:.75rem;height:.75rem;border-radius:50%;background:var(--seat);box-shadow:0 0 0 2px var(--ink-1),0 0 0 3px rgba(255,255,255,.18)}",
".un-lux .uacts{display:flex;flex-wrap:wrap;gap:.5rem;justify-content:center;margin:.375rem 0;min-height:var(--tap)}",
".un-lux .uacts .bg-btn{padding-inline:.9rem}",
".un-lux .un-cbtn{gap:.5rem}",
".un-lux .un-sw,.un-sheet .un-sw{--c:#888;--hi:#ccc;flex:none;width:1.5rem;height:1.5rem;border-radius:50%;background:radial-gradient(circle at 35% 30%,var(--hi),var(--c) 62%);box-shadow:0 0 0 .125rem var(--ink-1),0 0 0 .1875rem rgba(255,255,255,.28)}",
".un-sheet .un-sw{width:1.75rem;height:1.75rem}",
".un-lux .uhand{--cw:64px;display:flex;flex-wrap:wrap;gap:.5rem 0;justify-content:center;padding:.875rem 1.25rem .375rem .25rem;min-height:110px}.un-lux .uhand .uc{margin-right:-.28em}",
".un-lux .utbl .pile .uc.back{margin-bottom:calc(.4rem + .14em);box-shadow:.025em .03em 0 #e8e0cc,.05em .06em 0 #232850,.075em .09em 0 #e8e0cc,.1em .12em 0 #232850,0 .2em .34em rgba(0,0,0,.6)}",
".un-lux .dstack{position:relative;width:1em;height:1.5em;margin:0 auto calc(.4rem + .12em);font-size:var(--cw)}.un-lux .dstack .uc{position:absolute;left:0;top:0;margin:0;transform:rotate(var(--rot,0deg))}",
".un-lux .dstack .uc.h1{transform:translate(.04em,.012em) rotate(9deg)}.un-lux .dstack .uc.h2{transform:translate(-.05em,.02em) rotate(-11deg)}",
".un-lux .uhand .un-empty{padding:1.5rem 0;font:var(--fw-body) var(--fs-sm)/1.3 var(--font-ui);color:var(--text-2)}",
".un-lux .uc.is-focus{box-shadow:var(--focus-ring) !important;z-index:7}.un-lux .uc{outline:none}",
".un-lux .ulog{min-height:4.35em;margin:.25rem 0;font:var(--fw-body) var(--fs-micro)/1.45 var(--font-ui);color:var(--text-2);text-align:center}",
".un-sheet .un-shead{display:grid;gap:.25rem;margin-bottom:1rem}.un-sheet .un-shead .bg-sheet__sub{margin:0}",
".un-sheet .un-colors{grid-template-columns:repeat(2,minmax(0,1fr))}",
".un-sheet .un-sheetbtns{margin-top:1rem}",
"@media(min-width:520px){.un-lux .uhand{--cw:74px}.un-lux .utbl .pile{--cw:100px}}",
"html[data-tv] .un-lux .utbl{gap:2.5rem}",
"html[data-tv] .un-lux .utbl .pile{--cw:11rem}",
"html[data-tv] .un-lux .uhand{--cw:5.6rem;justify-content:flex-start;padding:1.25rem 1.5rem .5rem .5rem}",
"html[data-tv] .un-lux .uhand[data-n=\"m\"]{--cw:4.6rem}html[data-tv] .un-lux .uhand[data-n=\"l\"]{--cw:3.8rem}",
"html[data-tv] .un-lux .udir{width:3rem;height:3rem}html[data-tv] .un-lux .ucol{width:3.25rem;height:3.25rem}"
].join("\n");
function injectLuxCss(){ if(typeof document==="undefined"||document.getElementById("unoLuxCss")) return; var s=document.createElement("style"); s.id="unoLuxCss"; s.textContent=LCSS; document.head.appendChild(s); }
var DIR_CW='<svg viewBox="0 0 48 48" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"><path d="M38 24a14 14 0 1 1-4.1-9.9"/><path d="M36 6v9.5h-9.5"/></svg>';
var DIR_CCW='<svg viewBox="0 0 48 48" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" style="transform:scaleX(-1)"><path d="M38 24a14 14 0 1 1-4.1-9.9"/><path d="M36 6v9.5h-9.5"/></svg>';
function initialsOf(name){ var m=/^(You|Player|CPU)\s*(\d*)$/.exec(String(name)); return m?(m[1]==="You"?"Y":m[1].charAt(0)+m[2]):String(name).charAt(0); }

function create(cfg){
  var BG=g.BGUI, L=!!(cfg.luxe&&BG&&BG.sheet&&BG.icon);   // the Luxe table: only with ui/ui.js on the page
  injectCSS(); if(L) injectLuxCss(); else injectCtCSS();
  var root=cfg.root, V=null, S={pend:null};
  root.classList.add("unoT"); if(L) root.classList.add("un-lux");
  root.innerHTML=L?'<ul class="bg-players upl" id="upl" aria-label="Players"></ul><div class="utbl bg-surface--felt bg-frame" id="utbl" data-stage-solid></div><div class="bg-card ustat" id="ustat" aria-live="polite"></div><div class="uacts" id="uacts" data-toast-avoid></div><div class="uhand" id="uhand" data-toast-avoid></div><div class="ulog" id="ulog" data-stage-text></div>'
    :'<div class="upl" id="upl"></div><div class="utbl" id="utbl"></div><div class="ustat" id="ustat"></div><div class="uacts" id="uacts"></div><div class="uhand" id="uhand"></div><div class="ulog" id="ulog"></div>';
  var modal=document.createElement(L?"section":"div");
  if(L){ modal.className="bg-sheet un-sheet"; modal.id="unSheet"; modal.setAttribute("aria-labelledby","unSheetTitle"); modal.innerHTML='<div id="ush"></div>'; }
  else { modal.className="umodal"; modal.innerHTML='<div class="sh" id="ush"></div>'; }
  document.body.appendChild(modal);
  var $=function(id){ return root.querySelector("#"+id); };
  /* smoothness (step 10): the Luxe table redraw rewrites only the parts whose markup changed. Every update used to re-parse the
     table, the status, the actions, the whole hand and the log, lay them all out again and hand the D-pad focus to a new node (on a
     Fire TV class CPU a card took up to 0.2 s to answer). An element is rewritten when its markup differs from what put() last
     wrote, or when anything else changed its nodes (first node and node count are checked) */
  function put(el,html){ if(el._uk===html&&el._un===el.childNodes.length&&el._uf===el.firstChild) return false; el.innerHTML=html; el._uk=html; el._un=el.childNodes.length; el._uf=el.firstChild; return true; }
  function act(a){ var r=cfg.send(a); if(r&&r.ok===false&&cfg.toast) cfg.toast(r.msg||"Not allowed."); return r; }
  function onTV(){ return !!(L&&cfg.tv&&cfg.tv()); }
  function tvOn(){ return !!(onTV()&&BG.focus&&BG.focus.enabled); }
  function tapw(){ return onTV()?"press OK on":"tap"; }
  function seatOf(i){ return V&&V.o&&V.o.teams?(i%2?2:1):(cfg.seatOf?cfg.seatOf(i):(i%10)+1); }
  function ico(n){ return L?BG.icon(n):""; }
  function swStyle(c){ return "--c:"+COL[c]+";--hi:"+HI[c]; }
  function sheetHead(eyebrow,title,sub){ return '<div class="bg-sheet__grip" aria-hidden="true"></div><div class="un-shead"><span class="bg-eyebrow bg-eyebrow--accent">'+esc(eyebrow)+'</span><h2 class="bg-sheet__title" id="unSheetTitle">'+esc(title)+'</h2>'+(sub?'<p class="bg-sheet__sub">'+esc(sub)+'</p>':"")+'</div>'; }
  function openModal(h,first){
    modal.querySelector("#ush").innerHTML=h;
    if(!L){ modal.classList.add("show"); return; }
    modal.classList.add("show");
    if(!BG.sheet.isOpen(modal)) BG.sheet.open(modal,{dismissible:true,focus:modal.querySelector(first||".bg-sheet__option.is-best, .bg-sheet__option")||undefined,onClose:function(){ modal.classList.remove("show"); }});
  }
  function closeModal(){ modal.classList.remove("show"); if(L&&BG.sheet.isOpen(modal)) BG.sheet.close(modal); }
  function pcolor(i){ return (V&&V.cols&&V.cols[i])||(cfg.seatColor&&cfg.seatColor(i))||"#ffffff"; }
  function colorPicker(title,cb){
    var cols=E.colorsNow({side:V.side});
    if(!L){
      openModal('<h3>'+esc(title)+'</h3><div class="ucp">'+cols.map(function(c){ return '<button data-c="'+c+'" style="background:'+COL[c]+'">'+CN[c]+'</button>'; }).join("")+'</div><div class="uacts"><button data-x="1">Cancel</button></div>');
    } else {
      var cnt={}, best=null, bn=0; V.hand.forEach(function(c){ var f=c.f[V.side]; if(f.c!=="W") cnt[f.c]=(cnt[f.c]||0)+1; });
      cols.forEach(function(c){ if((cnt[c]||0)>bn){ bn=cnt[c]; best=c; } });
      openModal(sheetHead("Wild card",title,"The next card must match the colour you name.")+'<div class="bg-sheet__options un-colors">'+cols.map(function(c){
        var n=cnt[c]||0; return '<button type="button" class="bg-sheet__option'+(c===best?" is-best":"")+'" data-c="'+c+'"><i class="un-sw" style="'+swStyle(c)+'"></i><span class="bg-sheet__text"><span class="bg-sheet__label">'+CN[c]+'</span><span class="bg-sheet__detail">'+n+' in hand</span></span></button>'; }).join("")+
        '</div><div class="un-sheetbtns"><button type="button" class="bg-btn bg-btn--secondary bg-btn--block" data-x="1">Cancel</button></div>');
    }
    modal.querySelector("#ush").onclick=function(e){ var b=e.target.closest&&e.target.closest("button"); if(!b) return; if(b.dataset.c){ closeModal(); cb(b.dataset.c); } else if(b.dataset.x) closeModal(); };
  }
  function targetPicker(title,cb){
    var rows=V.players.filter(function(p){ return p.id!==V.me&&p.alive; });
    if(!L){
      openModal('<h3>'+esc(title)+'</h3><div class="utg">'+rows.map(function(p){ return '<button data-t="'+p.id+'" style="border-color:'+pcolor(p.id)+'">'+esc(p.name)+' — '+p.cards+' cards</button>'; }).join("")+'<button data-x="1">Cancel</button></div>');
    } else {
      var fewest=Math.min.apply(null,rows.map(function(p){ return p.cards; }));
      openModal(sheetHead("Choose a player",title,"")+'<div class="bg-sheet__options">'+rows.map(function(p){
        return '<button type="button" class="bg-sheet__option'+(p.cards===fewest?" is-best":"")+'" data-t="'+p.id+'"><span class="bg-token" data-seat="'+seatOf(p.id)+'" aria-hidden="true">'+esc(initialsOf(p.name))+'</span><span class="bg-sheet__text"><span class="bg-sheet__label">'+esc(p.name)+'</span>'+(p.cards===fewest?'<span class="bg-sheet__desc">The smallest hand</span>':"")+'<span class="bg-sheet__detail">'+p.cards+(p.cards===1?" card":" cards")+'</span></span>'+ico("chevron")+'</button>'; }).join("")+
        '</div><div class="un-sheetbtns"><button type="button" class="bg-btn bg-btn--secondary bg-btn--block" data-x="1">Cancel</button></div>');
    }
    modal.querySelector("#ush").onclick=function(e){ var b=e.target.closest&&e.target.closest("button"); if(!b) return; if(b.dataset.t!=null){ closeModal(); cb(+b.dataset.t); } else if(b.dataset.x) closeModal(); };
  }
  function cardById(id){ return V.hand.filter(function(c){ return c.id===id; })[0]; }
  function playCard(id,out){
    var c=cardById(id); if(!c) return; var f=c.f[V.side];
    var needT=E.needsTarget({o:V.o},f)&&!(V.hand.length===1&&f.v==="7");
    var needC=E.namesColor({o:V.o},f);   // Color Roulette: the next player names the colour
    function go(color,target){ var a={t:out?"jump":"play",card:id}; if(color) a.color=color; if(target!=null) a.target=target; act(a); }
    if(needC){ colorPicker("Choose a colour",function(col){ if(needT) targetPicker(f.v==="wtd2"?"Who draws 2?":"Swap hands with…",function(t){ go(col,t); }); else go(col,null); }); }
    else if(needT){ targetPicker(f.v==="wtd2"?"Who draws 2?":(f.v==="7"?"Swap hands with…":"Swap hands with…"),function(t){ go(null,t); }); }
    else go(null,null);
  }

  /* ---------------- the original panel (Party Mode phones, and any page without ui/ui.js) ---------------- */
  function render(){
    if(!V) return;
    var me=V.me, myTurn=V.actor===me&&me>=0&&!V.over&&!V.roundOver;
    var tp=V.players[V.turn];
    // players
    $("upl").innerHTML=V.players.map(function(p,i){
      var cur=!V.over&&!V.roundOver&&i===V.actor, c=pcolor(i);
      return '<div class="upc'+(cur?" cur":"")+(p.alive?"":" out")+'" style="--c:'+c+'"><span style="width:12px;height:12px;border-radius:3px;background:'+c+'"></span>'+esc(p.name)+(p.team>=0?' <small>T'+(p.team+1)+'</small>':'')+(p.human?'':' 🤖')+' <span class="bd">'+p.cards+'</span>'+(V.o.target?'<small>'+p.score+'</small>':'')+(p.vuln&&i!==me?' <button data-a="catch:'+i+'">Catch!</button>':'')+'</div>';
    }).join("");
    // table
    var top=V.top, dark=V.side===1;
    $("utbl").innerHTML='<div class="pile" id="udraw">'+backHTML({label:V.drawCount+" left",attrs:'data-pile="draw"'})+'<div style="opacity:.8">draw</div></div>'+
      '<div class="pile"><div class="udir">'+(V.dir>0?"↻":"↺")+'</div>'+(V.pen?'<div class="upen">+'+V.pen.n+'</div>':'')+'<div class="ucol" style="background:'+(V.color?COL[V.color]:"conic-gradient(#d6322b,#f2bf24,#2f9e44,#2d63c8,#d6322b)")+'" title="'+(V.color?CN[V.color]:"any colour")+'"></div></div>'+
      '<div class="pile">'+(top?cardHTML(top,V.side,{cls:"pop"}):"")+'<div style="opacity:.8">'+(dark?"Dark side":V.o.edition==="flip"?"Light side":"discard")+'</div></div>';
    // status
    var st="", acts="", cp=pcolor(V.actor);
    if(V.over||V.roundOver) st="Round over";
    else if(V.needColor&&V.turn===me) st="<b>You start</b> — choose the starting colour.";
    else if(V.phase==="challenge"){ var c=V.chal; st=V.actor===me?("<b>"+esc(V.players[c.by].name)+" played a "+esc(E.VNAME[c.v])+"</b> — accept the penalty or challenge it?"):(esc(V.players[V.actor].name)+" is deciding whether to challenge…"); }
    else if(V.phase==="roulette") st=V.actor===me?"<b>Color Roulette</b> — pick a colour; you'll draw until one shows up.":esc(V.players[V.actor].name)+" is spinning the roulette…";
    else if(V.phase==="drawn"&&V.turn===me) st="<b>You drew a playable card</b> — play it"+(V.canPass?" or keep it.":".");
    else if(myTurn) st=V.pen?"<b>Stack a draw card</b> or take the "+V.pen.n+" cards.":(V.playable.length?"<b>Your turn</b> — tap a glowing card.":"<b>Your turn</b> — nothing to play, draw a card.");
    else st="<b>"+esc(tp.name)+"</b> is playing…";
    if(!V.over&&!V.roundOver){
      if(V.needColor&&V.turn===me) acts+='<div class="ucp">'+E.colorsNow({side:V.side}).map(function(c2){ return '<button data-a="scolor:'+c2+'" style="background:'+COL[c2]+';width:54px;height:54px;font-size:11px">'+CN[c2]+'</button>'; }).join("")+'</div>';
      else if(V.phase==="challenge"&&V.actor===me) acts+='<button class="pri" data-a="chal:1">Challenge!</button><button data-a="chal:0">Accept '+(V.chal.v==="wdc"?"(draw until the colour)":V.chal.n+" cards")+'</button>';
      else if(V.phase==="roulette"&&V.actor===me) acts+='<div class="ucp">'+E.colorsNow({side:V.side}).map(function(c2){ return '<button data-a="roul:'+c2+'" style="background:'+COL[c2]+';width:54px;height:54px;font-size:11px">'+CN[c2]+'</button>'; }).join("")+'</div>';
      else if(myTurn){
        if(V.phase==="drawn"){ if(V.canPass) acts+='<button data-a="pass">Keep it</button>'; }
        else if(V.pen) acts+='<button class="pri" data-a="draw">Take '+V.pen.n+' cards</button>';
        else acts+='<button class="pri" data-a="draw">Draw'+(V.o.drawRule==="untilPlay"?" until playable":"")+'</button>';
      }
      var mypl=me>=0?V.players[me]:null;
      if(mypl&&mypl.alive&&(mypl.cards<=2||mypl.vuln)) acts+='<button class="gold" data-a="uno">'+(mypl.vuln?"Say UNO!":"UNO!")+'</button>';
    }
    var s=$("ustat"); s.style.setProperty("--pc",V.over||V.roundOver?"#ffffff30":cp); s.innerHTML=st;
    $("uacts").innerHTML=acts;
    // hand
    if(me>=0){
      var pl=V.playable||[], jmp=V.jump||[];
      $("uhand").setAttribute("data-n",V.hand.length<=10?"s":V.hand.length<=18?"m":"l");
      $("uhand").innerHTML=V.hand.map(function(c){ var can=pl.indexOf(c.id)>=0, j=jmp.indexOf(c.id)>=0; return cardHTML(c,V.side,{dim:(myTurn||V.phase==="drawn")&&!can&&!j,glow:can&&myTurn,cls:j?"jmp":"",attrs:'data-h="1"'}); }).join("")||'<div style="opacity:.7;padding:30px 0">no cards</div>';
    } else $("uhand").innerHTML='<div style="opacity:.7;padding:30px 0;text-align:center">'+esc(tp.name)+' is playing…</div>';
    $("ulog").innerHTML=(V.log||[]).slice(-3).map(esc).join("<br>");
  }

  /* ---------------- the Luxe table (step 4) ---------------- */
  var stripKey="", turnKey="", lastTop=-1, lastTopCard=null, lastTopSide=0, hist=[], histKey="", focusPhase="";
  function strip(){
    var el=$("upl"), gk=cfg.gameKey?cfg.gameKey():"";
    // cfg.scrollStrip (optional): the page asks for the one scrolling row (a phone on its side, step 11); part of the key, so turning re-lays it out
    var row=V.players.length>4||!!(cfg.scrollStrip&&cfg.scrollStrip());
    var key=gk+"|"+V.players.map(function(p){ return p.name+(p.human?"H":"C"); }).join(",")+"|"+(V.o.teams?"T":"")+(row?"|S":"");
    if(key!==stripKey||el.children.length!==V.players.length){
      var old=[].slice.call(el.children);
      el.className="bg-players upl"+(row?" bg-players--scroll":"");
      el.innerHTML=V.players.map(function(p,i){ return '<li class="bg-player upc" data-seat="'+seatOf(i)+'" data-p="'+i+'"><span class="bg-token" aria-hidden="true">'+esc(initialsOf(p.name))+'</span>'+(p.human?"":'<span class="bg-player__cpu" aria-hidden="true">'+ico("cpu")+'</span>')+
        '<span class="bg-player__txt"><span class="bg-player__name">'+esc(p.name)+'</span><span class="bg-player__meta"></span></span></li>'; }).join("");
      // a turn pulse still running on a chip of the old strip ends with it
      if(BG.ambient&&BG.ambient.remove) old.forEach(function(c){ BG.ambient.remove(c); });
      stripKey=key; turnKey="";
    }
    V.players.forEach(function(p,i){
      var c=el.children[i]; if(!c) return;
      var m=p.cards+(p.cards===1?" card":" cards")+(V.o.target?" · "+p.score+" pts":"")+(p.team>=0?" · Team "+(p.team+1):"")+(p.alive?"":" · out");
      var mt=c.querySelector(".bg-player__meta"); if(mt.textContent!==m) mt.textContent=m;
      c.classList.toggle("is-out",!p.alive);
    });
    var over=V.over||V.roundOver, tk=over?"over":gk+":"+V.round+":"+V.actor+":"+V.turn;
    if(tk===turnKey) return; turnKey=tk;
    if(over){ [].forEach.call(el.querySelectorAll(".is-turn, .is-pulse"),function(c){ c.classList.remove("is-turn","is-pulse"); }); return; }
    var c2=el.children[V.actor]; if(!c2) return;
    // the turn pulse plays only while the table is on screen (never behind the Menu, where computer turns go on)
    if(BG.setTurn) BG.setTurn(c2,{pulse:cfg.pulse?!!cfg.pulse():!document.hidden});
  }
  function lbtn(txt,a,o){ o=o||{}; return '<button type="button" class="bg-btn '+(o.accent?"bg-btn--accent":o.primary?"bg-btn--primary":"bg-btn--secondary")+(o.cls?" "+o.cls:"")+'" data-a="'+a+'">'+(o.icon?ico(o.icon):"")+(o.html||esc(txt))+'</button>'; }
  function colorBtns(prefix){ return '<div class="un-colorrow" style="display:flex;flex-wrap:wrap;gap:.5rem;justify-content:center">'+E.colorsNow({side:V.side}).map(function(c2){ return '<button type="button" class="bg-btn bg-btn--secondary un-cbtn" data-a="'+prefix+':'+c2+'"><i class="un-sw" style="'+swStyle(c2)+'"></i>'+CN[c2]+'</button>'; }).join("")+'</div>'; }
  function renderLux(){
    var me=V.me, myTurn=V.actor===me&&me>=0&&!V.over&&!V.roundOver, tp=V.players[V.turn], tv=onTV();
    var fk=tvOn()?tvKey(document.activeElement):null;
    strip();
    // table
    var top=V.top, dark=V.side===1, newTop=top&&top.id!==lastTop, hk=(cfg.gameKey?cfg.gameKey():"")+":"+V.round;
    if(hk!==histKey){ histKey=hk; hist=[]; lastTopCard=null; }
    else if(newTop&&lastTopCard){ hist.unshift({card:lastTopCard,side:lastTopSide}); if(hist.length>2) hist.length=2; }
    lastTop=top?top.id:-1; lastTopCard=top; lastTopSide=V.side;
    var dname=V.color?CN[V.color]:"Any colour";
    put($("utbl"),'<div class="pile" id="udraw">'+backHTML({label:V.drawCount+" left",attrs:'data-pile="draw"'+(tv?' data-focus tabindex="-1" role="button" aria-label="Draw pile, '+V.drawCount+' cards left"':"")})+'<div class="pl">draw</div></div>'+
      '<div class="pile un-mid"><div class="udir" role="img" aria-label="'+(V.dir>0?"Play goes clockwise":"Play goes counter-clockwise")+'" title="'+(V.dir>0?"Clockwise":"Counter-clockwise")+'">'+(V.dir>0?DIR_CW:DIR_CCW)+'</div>'+(V.pen?'<div class="upen">+'+V.pen.n+'</div>':'')+
      (V.color?'<div class="ucol" style="'+swStyle(V.color)+'"></div>':'<div class="ucol any" aria-hidden="true"><i style="background:'+COL.R+'"></i><i style="background:'+COL.Y+'"></i><i style="background:'+COL.G+'"></i><i style="background:'+COL.B+'"></i></div>')+'<div class="ucname">'+esc(dname)+'</div></div>'+
      '<div class="pile"><div class="dstack">'+hist.slice().reverse().map(function(h,i){ return cardHTML(h.card,h.side,{cls:"dim h"+(hist.length-i),attrs:'aria-hidden="true"'}); }).join("")+(top?cardHTML(top,V.side,{cls:newTop?"pop top":"top",rot:(top.id*47)%9-4,attrs:'data-pile="discard" role="img" aria-label="Top card: '+esc(faceName(top.f[V.side]))+'"'}):"")+'</div><div class="pl">'+(dark?"Dark side":V.o.edition==="flip"?"Light side":"discard")+'</div></div>');
    // status + actions
    var st="", acts="", ts=tapw();
    if(V.over||V.roundOver) st="Round over";
    else if(V.needColor&&V.turn===me) st="<b>You start</b> — choose the starting colour.";
    else if(V.phase==="challenge"){ var c=V.chal; st=V.actor===me?("<b>"+esc(V.players[c.by].name)+" played a "+esc(E.VNAME[c.v])+"</b> — accept the penalty or challenge it?"):(esc(V.players[V.actor].name)+" is deciding whether to challenge…"); }
    else if(V.phase==="roulette") st=V.actor===me?"<b>Color Roulette</b> — pick a colour; you'll draw until one shows up.":esc(V.players[V.actor].name)+" is spinning the roulette…";
    else if(V.phase==="drawn"&&V.turn===me) st="<b>You drew a playable card</b> — play it"+(V.canPass?" or keep it.":".");
    else if(myTurn) st=V.pen?"<b>Stack a draw card</b> or take the "+V.pen.n+" cards.":(V.playable.length?"<b>Your turn</b> — "+ts+" a glowing card.":"<b>Your turn</b> — nothing to play, draw a card.");
    else st="<b>"+esc(tp.name)+"</b> is playing…";
    if(!V.over&&!V.roundOver){
      if(V.needColor&&V.turn===me) acts+=colorBtns("scolor");
      else if(V.phase==="challenge"&&V.actor===me) acts+=lbtn("Challenge!","chal:1",{primary:true,icon:"flag"})+lbtn("Accept "+(V.chal.v==="wdc"?"(draw until the colour)":V.chal.n+" cards"),"chal:0",{icon:"check"});
      else if(V.phase==="roulette"&&V.actor===me) acts+=colorBtns("roul");
      else if(myTurn){
        if(V.phase==="drawn"){ if(V.canPass) acts+=lbtn("Keep it","pass",{icon:"check"}); }
        else if(V.pen) acts+=lbtn("Take "+V.pen.n+" cards","draw",{primary:true,icon:"cards"});
        else acts+=lbtn("Draw"+(V.o.drawRule==="untilPlay"?" until playable":""),"draw",{primary:true,icon:"cards"});
      }
      var mypl=me>=0?V.players[me]:null;
      if(mypl&&mypl.alive&&(mypl.cards<=2||mypl.vuln)) acts+=lbtn(mypl.vuln?"Say UNO!":"UNO!","uno",{accent:true});
      // catching a player who forgot to say UNO (the strip chips are labels: the catch is a real button here)
      V.players.forEach(function(p,i){ if(p.vuln&&i!==me) acts+=lbtn("","catch:"+i,{accent:true,cls:"un-catch",html:"Catch "+esc(p.name)+"!"}); });
    }
    var s=$("ustat");
    if(V.over||V.roundOver) s.removeAttribute("data-seat"); else s.setAttribute("data-seat",seatOf(V.actor));
    put(s,(V.over||V.roundOver?"":'<span class="dot" aria-hidden="true"></span>')+'<span>'+st+'</span>'+(tv?"":nextHTML(V,V.cols)));
    put($("uacts"),acts);
    // hand
    if(me>=0){
      var pl=V.playable||[], jmp=V.jump||[];
      put($("uhand"),V.hand.map(function(c){ var can=pl.indexOf(c.id)>=0, j=jmp.indexOf(c.id)>=0;
        return cardHTML(c,V.side,{dim:(myTurn||V.phase==="drawn")&&!can&&!j,glow:can&&myTurn,cls:j?"jmp":"",attrs:'data-h="1" role="button" aria-label="'+esc(faceName(c.f[V.side]))+(can&&myTurn?", playable":"")+'"'+(tv?' data-focus tabindex="-1"':"")}); }).join("")||'<div class="un-empty">no cards</div>');
    } else put($("uhand"),'<div class="un-empty" data-stage-text>'+esc(tp.name)+' is playing…</div>');
    put($("ulog"),(V.log||[]).slice(-3).map(esc).join("<br>"));
    if(tvOn()) tvKeep(fk);
  }

  /* ---- TV: the D-pad focus survives every redraw. A new turn or phase gives the focus to its main control (a card you can play, else
     Draw); otherwise the same card, pile or action keeps it. It never takes the focus from the top bar, the sound panel, a sheet or
     the Victory screen ---- */
  function tvKey(a){
    if(!a||a===document.body||!a.closest) return null;
    if(a.closest("#uhand")&&a.getAttribute("data-id")!==null) return "#uhand .uc[data-id=\""+a.getAttribute("data-id")+"\"]";
    if(a.closest("#uacts")&&a.getAttribute("data-a")) return "#uacts [data-a=\""+a.getAttribute("data-a")+"\"]";
    if(a.getAttribute("data-pile")==="draw") return "#udraw [data-pile=draw]";
    return null;
  }
  function tvFind(k){ if(!k) return null; var el=root.querySelector(k); return el&&!el.disabled&&el.getClientRects().length?el:null; }
  function tvMain(){
    if(!V||V.over||V.roundOver||V.me<0||V.actor!==V.me) return null;
    var a=$("uacts");
    if(V.needColor||V.phase==="roulette"||V.phase==="challenge") return a.querySelector("button:not([disabled])");
    return $("uhand").querySelector(".uc.glow")||a.querySelector(".bg-btn--primary:not([disabled])")||a.querySelector("button:not([disabled])");
  }
  function tvKeep(k){
    if(!V||!$("utbl").getClientRects().length||(BG.sheet.top&&BG.sheet.top())||(BG.win&&BG.win.isOpen())) return;
    var a=document.activeElement;
    if(a&&a!==document.body&&a.isConnected&&a.closest&&a.closest(".bg-topbar, #bgSoundPanel")) return;
    var phase=(cfg.gameKey?cfg.gameKey():"")+":"+V.round+":"+V.turn+":"+V.phase+":"+V.actor+":"+V.me+":"+(V.over||V.roundOver?"R":"");
    var el=null;
    if(phase!==focusPhase){ focusPhase=phase; el=tvMain(); }
    if(!el) el=tvFind(k);
    var lost=!a||a===document.body||a===document.documentElement||!a.isConnected||!a.getClientRects().length||!!(a.closest&&a.closest(".bg-sheet:not(.is-open), .bg-win:not(.is-open)"));
    if(!el&&lost) el=tvMain()||$("uacts").querySelector("button:not([disabled])")||$("uhand").querySelector(".uc")||root.querySelector("[data-pile=draw]");
    if(el&&el!==a) BG.focus.set(el);
  }

  root.addEventListener("click",function(e){
    if(!V) return;
    var b=e.target.closest&&e.target.closest("button[data-a]");
    if(b&&!b.disabled){ var p=b.getAttribute("data-a").split(":");
      if(p[0]==="draw") act({t:"draw"}); else if(p[0]==="pass") act({t:"pass"}); else if(p[0]==="uno") act({t:"uno"});
      else if(p[0]==="catch") act({t:"catch",target:+p[1]});
      else if(p[0]==="chal") act({t:"challenge",yes:p[1]==="1"});
      else if(p[0]==="roul") act({t:"roulette",color:p[1]});
      else if(p[0]==="scolor") act({t:"startColor",color:p[1]});
      return; }
    var pile=e.target.closest&&e.target.closest("[data-pile=draw]");
    if(pile){ if(V.actor===V.me&&V.phase==="play"&&!V.pen) act({t:"draw"}); return; }
    var dis=L&&e.target.closest&&e.target.closest("[data-pile=discard]");
    if(dis){ if(cfg.toast&&V.top) cfg.toast("Top card: "+faceName(V.top.f[V.side])+(V.color?" · play "+CN[V.color]:"")); return; }
    var card=e.target.closest&&e.target.closest("#uhand .uc");
    if(card){ var id=+card.getAttribute("data-id"); var myTurn=V.actor===V.me&&(V.phase==="play"||V.phase==="drawn");
      if(myTurn&&(V.playable||[]).indexOf(id)>=0) playCard(id,false);
      else if((V.jump||[]).indexOf(id)>=0) playCard(id,true);
      else if(myTurn) { if(cfg.toast) cfg.toast(V.pen?"Stack a draw card or take the penalty.":"That card doesn't match."); } }
  });
  var self={update:function(v){ V=v; if(L) renderLux(); else render(); },destroy:function(){ if(modal.parentNode) modal.parentNode.removeChild(modal); },closeModal:closeModal,luxe:L,resetTurn:function(){ turnKey=""; focusPhase=""; }};
  return self;
}
/* "Next up" strip (TV bottom line and phone status): direction + next player + the order after. V = a snapshot (V.order, V.dir, V.players);
   cols = optional player colours. Returns '' when the round is over. */
function nextHTML(V,cols){
  if(!V||V.over||V.roundOver||!V.order||!V.order.length) return "";
  var cw=V.dir>0, nm=function(i){ var c=cols&&cols[i]; return '<b class="unn-p"'+(c?' style="--pc:'+c+'"':"")+'><i class="unn-d"></i>'+esc(V.players[i].name)+'</b>'; };
  var rest=V.order.slice(1);
  return '<div class="unn" data-dir="'+(cw?"cw":"ccw")+'"><span class="unn-dir" role="img" aria-label="'+(cw?"Play goes clockwise":"Play goes counter-clockwise")+'">'+(cw?DIR_CW:DIR_CCW)+'<span>'+(cw?"Clockwise":"Counter-clockwise")+'</span></span>'+
    '<span class="unn-nx">Next up: '+nm(V.order[0])+'</span>'+(rest.length?'<span class="unn-then">Then: '+rest.map(nm).join(' <span class="unn-a">&gt;</span> ')+'</span>':"")+'</div>';
}
var NEXT_CSS=".unn{display:flex;flex-wrap:wrap;align-items:center;justify-content:center;gap:.25em 1.1em;font-weight:700;line-height:1.25}.unn-dir{display:inline-flex;align-items:center;gap:.4em;color:var(--gold-200,#e8c66a);white-space:nowrap}.unn-dir svg{width:1.5em;height:1.5em}.unn-nx{white-space:nowrap}.unn-then{opacity:.85;white-space:nowrap}.unn-p{display:inline-flex;align-items:center;gap:.35em}.unn-d{width:.7em;height:.7em;border-radius:50%;background:var(--pc,#fff);box-shadow:0 0 0 2px rgba(255,255,255,.25)}.unn-a{opacity:.7;margin:0 .15em}";
Uno.Cards={nextHTML:nextHTML,NEXT_CSS:NEXT_CSS,cardHTML:cardHTML,backHTML:backHTML,injectCSS:injectCSS,faceName:faceName,COL:COL,CSS:CSS};
Uno.Ctrl={create:create,CSS:CTCSS,COL:COL};
})(typeof window!=="undefined"?window:globalThis);
