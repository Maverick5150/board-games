/* CANDY LAND — the board and card art (window.Candy.Board). Original Midnight Luxe art, drawn as inline SVG from the engine's board
   data (E.BOARDS[G.bd]: the colours, picture squares, sticky squares and shortcuts of each edition are rules, kept exactly), so both
   Versions look the same way: a gingerbread road with an icing edge winding in eight rows from the start plate (bottom left) to the
   Sugarspire (a spun-sugar spire, top), glossy colour squares, pink picture squares with our own landmark pictures, a ribbon-candy
   slide and a wafer bridge for the two shortcuts, caramel bogs (1984: stuck until a colour) or licorice twists (2004: lose a turn), and
   a night-time candy country of gumdrop hills, lollipop trees and sprinkles round it. None of the official characters, places or
   pictures is drawn or named (RULES.md 7.2). No filters, no images, no text but the one "Start" label (sized to the text floor).
   Geometry (viewBox units): W x H = 1000 x 1120. The road is a polyline sampled every ~2 units (rows of gentle waves joined by
   half-circle turns); square n (1..134) sits at arc length (n - .5) x L. Exports what game.js needs to animate: centre(n) (+ angle),
   startSlot(i, n), shortcutPts(from) (the glide follows the ribbon / the bridge), mark(n, ms) (a gold ring counts a square), glow(from,
   ms) (a shortcut lights up), spire(ms) (the goal glows), warn(list) (sticky squares within one card pulse), label(unitPx, floorPx);
   and the cards: cardSVG(card), backSVG(), picSVG(k) and defs() (one shared block of gradients for every card on the page). */
(function(g){
"use strict";
var CY=g.Candy=g.Candy||{};
var W=1000, H=1120, Y0=1046, DY=104, RAD=52, XL=86, XR=914, XS=150, XE=560, ROAD=70, AMP=9, ROWS=8, END=134, NS="http://www.w3.org/2000/svg";
function E(){ return CY.Engine; }
function f1(x){ return Math.round(x*10)/10; }
function hash(s){ var h=2166136261; s=String(s); for(var i=0;i<s.length;i++){ h^=s.charCodeAt(i); h=Math.imul(h,16777619); } return h>>>0; }
function rng(seed){ var a=seed>>>0; return function(){ a=(a+0x6D2B79F5)>>>0; var t=Math.imul(a^(a>>>15),a|1); t^=t+Math.imul(t^(t>>>7),t|61); return ((t^(t>>>14))>>>0)/4294967296; }; }

/* the six colours (original candy shades): [light, base, dark] */
var COL={R:["#ff7d8c","#e5324a","#9c1530"],P:["#c08af2","#8e4fd8","#5a2596"],Y:["#ffe27a","#f6c330","#b88a0e"],B:["#7cc2ff","#2f8fe8","#17559e"],
  O:["#ffb46a","#f5862a","#b45512"],G:["#86e08e","#36b653","#1d7234"],K:["#ffd0e4","#ff8fc4","#c94f8c"]};
var CNAMES={R:"red",P:"purple",Y:"yellow",B:"blue",O:"orange",G:"green"};

/* ---------------- the road: one polyline from square 1 to the end ---------------- */
var PTS=null, LEN=0, L=0, POS=null;
function rowY(i){ return Y0-i*DY; }
function buildPath(){
  if(PTS) return;
  var pts=[], i, t, n, x, y;
  function push(px,py){ var p=pts[pts.length-1]; if(p&&Math.abs(p.x-px)<.01&&Math.abs(p.y-py)<.01) return; pts.push({x:px,y:py}); }
  for(i=0;i<ROWS;i++){
    var right=i%2===0, xa=i===0?XS:(right?XL:XR), xb=i===ROWS-1?XE:(right?XR:XL), y0=rowY(i), len=Math.abs(xb-xa);
    n=Math.max(2,Math.round(len/2));
    for(var k=0;k<=n;k++){ t=k/n; x=xa+(xb-xa)*t; y=y0+AMP*Math.sin(2*Math.PI*t)*(i%2?-1:1); push(x,y); }
    if(i<ROWS-1){   // a half-circle turn up to the next row
      var cx=xb, cy=y0-RAD; n=Math.round(Math.PI*RAD/2);
      for(k=1;k<=n;k++){ var th=Math.PI*k/n; x=cx+(right?1:-1)*RAD*Math.sin(th); y=cy+RAD*Math.cos(th); push(x,y); }
    }
  }
  var acc=0; pts[0].s=0;
  for(i=1;i<pts.length;i++){ acc+=Math.hypot(pts[i].x-pts[i-1].x,pts[i].y-pts[i-1].y); pts[i].s=acc; }
  PTS=pts; LEN=acc; L=LEN/END;
  POS=[startPos()];
  for(n=1;n<=END;n++) POS.push(at((n-.5)*L));
}
function at(s){
  var lo=0, hi=PTS.length-1;
  if(s<=0) return seg(0,0); if(s>=LEN) return seg(PTS.length-2,1);
  while(hi-lo>1){ var m=(lo+hi)>>1; if(PTS[m].s<=s) lo=m; else hi=m; }
  var a=PTS[lo], b=PTS[lo+1], t=(s-a.s)/((b.s-a.s)||1);
  return seg(lo,t);
}
function seg(i,t){ var a=PTS[i], b=PTS[i+1], x=a.x+(b.x-a.x)*t, y=a.y+(b.y-a.y)*t; return {x:x,y:y,a:Math.atan2(b.y-a.y,b.x-a.x)*180/Math.PI}; }
function startPos(){ return {x:84,y:1006,a:0}; }
function centre(n){ buildPath(); n=Math.max(0,Math.min(END,n|0)); return POS[n]; }
/* the start plate holds up to 4 movers side by side (players start OFF the path, at START) */
function startSlot(i,n){ var c=startPos(), off=n<=2?[[-20,-14],[20,-14]]:[[-22,-26],[22,-26],[-22,10],[22,10]]; var o=off[i]||[0,0]; return {x:c.x+o[0],y:c.y+o[1]}; }

/* ---------------- shared gradients (cards and board) ---------------- */
function gradDefs(){
  var d="";
  Object.keys(COL).forEach(function(k){ var c=COL[k];
    d+='<linearGradient id="cdc'+k+'" x1="0" y1="0" x2=".35" y2="1"><stop offset="0" stop-color="'+c[0]+'"/><stop offset=".55" stop-color="'+c[1]+'"/><stop offset="1" stop-color="'+c[2]+'"/></linearGradient>'; });
  d+='<linearGradient id="cdGloss" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".55"/><stop offset=".45" stop-color="#fff" stop-opacity=".08"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>'+
    '<linearGradient id="cdRainbow" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#e5324a"/><stop offset=".2" stop-color="#f5862a"/><stop offset=".4" stop-color="#f6c330"/><stop offset=".6" stop-color="#36b653"/><stop offset=".8" stop-color="#2f8fe8"/><stop offset="1" stop-color="#8e4fd8"/></linearGradient>'+
    '<linearGradient id="cdCard" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fffaf2"/><stop offset="1" stop-color="#f3e6d4"/></linearGradient>'+
    '<linearGradient id="cdBack" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#7a1f43"/><stop offset=".5" stop-color="#b23a64"/><stop offset="1" stop-color="#5c1532"/></linearGradient>'+
    '<radialGradient id="cdGold" cx=".4" cy=".35" r=".75"><stop offset="0" stop-color="#fff4cf"/><stop offset=".5" stop-color="#e2bd72"/><stop offset="1" stop-color="#9c6c2c"/></radialGradient>'+
    '<pattern id="cdStripe" width="16" height="16" patternUnits="userSpaceOnUse" patternTransform="rotate(35)"><rect width="16" height="16" fill="#9d2c55"/><rect width="7" height="16" fill="#f7d8e3" fill-opacity=".9"/></pattern>'+
    '<radialGradient id="cdSugar" cx=".45" cy=".3" r=".8"><stop offset="0" stop-color="#fff"/><stop offset=".55" stop-color="#ffe3f0"/><stop offset="1" stop-color="#e7a9d2"/></radialGradient>'+
    '<linearGradient id="cdToffee" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#8a4b14"/><stop offset=".45" stop-color="#e2a04a"/><stop offset="1" stop-color="#9a5a1c"/></linearGradient>'+
    '<radialGradient id="cdCaramel" cx=".4" cy=".35" r=".8"><stop offset="0" stop-color="#e7a35a"/><stop offset=".6" stop-color="#a65f1f"/><stop offset="1" stop-color="#5e2f0c"/></radialGradient>';
  return d;
}
var defsDone=false;
/* one hidden (0 x 0, not display:none: hidden gradients stop painting) SVG of shared gradients for every card on the page */
function defs(){
  if(defsDone||typeof document==="undefined"||!document.body) return; defsDone=true;
  var s=document.createElementNS(NS,"svg"); s.setAttribute("width","0"); s.setAttribute("height","0"); s.setAttribute("aria-hidden","true"); s.setAttribute("focusable","false");
  s.style.cssText="position:absolute;width:0;height:0;overflow:hidden;left:0;top:0";
  s.innerHTML="<defs>"+gradDefs()+"</defs>"; document.body.insertBefore(s,document.body.firstChild);
}

/* ---------------- our six landmark pictures (original; 100 x 100 box) ---------------- */
var PICS=[
  /* 0 Marshmallow Meadow: three puffy marshmallows on a mint hill */
  '<path d="M6 88C20 66 80 64 94 88Z" fill="#5fcf8a"/><path d="M6 88C20 70 80 68 94 88" fill="none" stroke="#bff3cf" stroke-width="3" stroke-opacity=".7"/>'+
  '<g stroke="#c9a7c7" stroke-width="2"><rect x="16" y="46" width="24" height="28" rx="9" fill="#fff6fb"/><rect x="38" y="30" width="26" height="34" rx="10" fill="#ffe6f2"/><rect x="62" y="48" width="23" height="26" rx="9" fill="#fff6fb"/></g>'+
  '<ellipse cx="28" cy="50" rx="10" ry="4" fill="#fff"/><ellipse cx="51" cy="34" rx="11" ry="4.5" fill="#fff"/><ellipse cx="73.5" cy="52" rx="9.5" ry="4" fill="#fff"/>',
  /* 1 Jellybean Grove: a round tree hung with jellybeans */
  '<rect x="45" y="56" width="10" height="34" rx="4" fill="#8a4b2a"/><path d="M30 92h40" stroke="#5a2a14" stroke-width="5" stroke-linecap="round"/>'+
  '<circle cx="50" cy="40" r="30" fill="#3fb36a"/><circle cx="40" cy="30" r="12" fill="#6fd890" fill-opacity=".7"/>'+
  '<g><ellipse cx="36" cy="44" rx="6" ry="4" transform="rotate(-30 36 44)" fill="#e5324a"/><ellipse cx="58" cy="28" rx="6" ry="4" transform="rotate(20 58 28)" fill="#f6c330"/><ellipse cx="64" cy="50" rx="6" ry="4" transform="rotate(-15 64 50)" fill="#8e4fd8"/>'+
  '<ellipse cx="46" cy="58" rx="6" ry="4" transform="rotate(25 46 58)" fill="#f5862a"/><ellipse cx="30" cy="28" rx="6" ry="4" transform="rotate(40 30 28)" fill="#2f8fe8"/><ellipse cx="72" cy="36" rx="5.5" ry="3.8" transform="rotate(-40 72 36)" fill="#ff8fc4"/></g>',
  /* 2 Toffee Tower: a stacked toffee tower with a pennant */
  '<rect x="30" y="64" width="40" height="26" rx="3" fill="url(#cdToffee)"/><rect x="34" y="42" width="32" height="24" rx="3" fill="url(#cdToffee)"/><rect x="38" y="24" width="24" height="20" rx="3" fill="url(#cdToffee)"/>'+
  '<path d="M30 66h40M34 44h32M38 26h24" stroke="#ffe0a8" stroke-width="2.5" stroke-opacity=".8"/><path d="M38 24l12-12 12 12z" fill="#e5324a"/><path d="M50 12V3" stroke="#5a2a14" stroke-width="2.5"/><path d="M50 3l11 4-11 4z" fill="#f6c330"/>'+
  '<rect x="45" y="74" width="10" height="16" rx="5" fill="#5e2f0c"/><rect x="42" y="50" width="6" height="8" rx="3" fill="#5e2f0c"/><rect x="52" y="50" width="6" height="8" rx="3" fill="#5e2f0c"/>',
  /* 3 Cotton-Cloud Fair: a striped fair tent under a cotton-candy cloud */
  '<path d="M22 34c-8 0-12-10-4-14 0-10 14-12 18-6 4-8 20-8 22 2 8-4 20 2 16 12 6 4 2 12-6 12z" fill="#ffd0ea" stroke="#e79ac6" stroke-width="2"/>'+
  '<path d="M20 90V62L50 44l30 18v28z" fill="#fff4f8"/><path d="M50 44L20 62h10zM50 44l-8 18h12zM50 44l20 18h10z" fill="#e5324a"/>'+
  '<path d="M20 62h60" stroke="#c94f8c" stroke-width="2"/><path d="M42 90V72c0-6 16-6 16 0v18z" fill="#8e4fd8"/><path d="M50 44V36" stroke="#5a2a14" stroke-width="2.5"/><circle cx="50" cy="34" r="3" fill="#f6c330"/>',
  /* 4 Sherbet Springs: a fountain bowl of sherbet scoops with a spray */
  '<path d="M50 30C46 18 40 12 32 10M50 30c4-12 10-18 18-20M50 30V8" fill="none" stroke="#9fe3ff" stroke-width="3.5" stroke-linecap="round"/>'+
  '<circle cx="38" cy="44" r="11" fill="#ffb46a"/><circle cx="62" cy="44" r="11" fill="#86e08e"/><circle cx="50" cy="36" r="12" fill="#ff9ec8"/>'+
  '<path d="M20 50h60l-8 18H28z" fill="#7cc2ff"/><path d="M20 50h60" stroke="#e8f7ff" stroke-width="3"/><rect x="44" y="68" width="12" height="14" fill="#2f8fe8"/><path d="M30 90h40l-6-8H36z" fill="#17559e"/>',
  /* 5 Meringue Peaks: three swirled meringue peaks */
  '<path d="M8 90C14 70 22 50 30 44c8 6 14 22 18 46z" fill="#fff6fb" stroke="#d9b3d0" stroke-width="2"/><path d="M40 90C44 64 52 34 62 22c10 12 18 42 22 68z" fill="#ffe3f0" stroke="#d9a3c8" stroke-width="2"/>'+
  '<path d="M70 90c4-14 8-26 14-30 6 4 8 16 10 30z" fill="#fff6fb" stroke="#d9b3d0" stroke-width="2"/>'+
  '<path d="M50 60c6-4 18-4 24 0M54 46c4-3 12-3 16 0M58 34c2-2 6-2 8 0M20 64c4-3 12-3 16 0" fill="none" stroke="#e79ac6" stroke-width="2.5" stroke-linecap="round"/>'
];
function picSVG(k,cls){ return '<svg class="'+(cls||"cd-pic")+'" viewBox="0 0 100 100" aria-hidden="true" focusable="false">'+(PICS[k]||"")+"</svg>"; }

/* ---------------- the cards (100 x 140): one or two colour blocks, or a picture; the back is an original candy stripe ---------------- */
function block(x,y,s,c){ return '<rect x="'+x+'" y="'+y+'" width="'+s+'" height="'+s+'" rx="'+f1(s*.2)+'" fill="url(#cdc'+c+')" stroke="'+COL[c][2]+'" stroke-width="1.5"/>'+
  '<rect x="'+(x+4)+'" y="'+(y+3)+'" width="'+(s-8)+'" height="'+f1(s*.42)+'" rx="'+f1(s*.16)+'" fill="url(#cdGloss)"/>'; }
function cardSVG(cd,cls){
  var frame='<rect x="1.5" y="1.5" width="97" height="137" rx="11" fill="url(#cdCard)" stroke="#d9c2a2" stroke-width="2"/><rect x="7" y="7" width="86" height="126" rx="7.5" fill="none" stroke="#f0a8bf" stroke-width="1.6" stroke-opacity=".9"/>', body="";
  if(!cd) return backSVG(cls);
  if(cd.pic!=null) body='<rect x="12" y="12" width="76" height="116" rx="8" fill="#ffd9e8"/><rect x="12" y="12" width="76" height="116" rx="8" fill="none" stroke="#ff8fc4" stroke-width="2"/>'+
    '<g transform="translate(13 30) scale(.74)">'+(PICS[cd.pic]||"")+"</g>"+
    '<path d="M50 112l-4-4a3 3 0 0 1 4-4 3 3 0 0 1 4 4z" fill="#ff8fc4"/>';
  else if(cd.n===2) body=block(25,16,50,cd.c)+block(25,74,50,cd.c);
  else body=block(20,40,60,cd.c);
  return '<svg class="'+(cls||"cd-cardsvg")+'" viewBox="0 0 100 140" aria-hidden="true" focusable="false">'+frame+body+"</svg>";
}
function backSVG(cls){
  return '<svg class="'+(cls||"cd-cardsvg")+'" viewBox="0 0 100 140" aria-hidden="true" focusable="false"><rect x="1.5" y="1.5" width="97" height="137" rx="11" fill="url(#cdBack)" stroke="#e7ca90" stroke-width="2"/>'+
    '<rect x="8" y="8" width="84" height="124" rx="7" fill="url(#cdStripe)" fill-opacity=".55"/><rect x="8" y="8" width="84" height="124" rx="7" fill="none" stroke="#e7ca90" stroke-opacity=".8" stroke-width="1.5"/>'+
    '<circle cx="50" cy="70" r="24" fill="url(#cdGold)" stroke="#5a3a10" stroke-width="1.5"/>'+
    '<path d="M50 70m-3 0a3 3 0 1 1 6 0a7 7 0 1 1 -12 2a11 11 0 1 1 18 -6a15 15 0 1 1 -22 11" fill="none" stroke="#9d2c55" stroke-width="3.2" stroke-linecap="round"/></svg>';
}
/* the words for a card, for captions and the log */
function cardWords(cd){ if(!cd) return ""; if(cd.pic!=null) return (E()&&E().PIC_NAMES[cd.pic])||"Picture card"; var w=CNAMES[cd.c]||""; return cd.n===2?"Double "+w:w.charAt(0).toUpperCase()+w.slice(1); }

/* ---------------- the Sugarspire (our goal: a spun-sugar spire on a gold plinth; never a castle) ---------------- */
function spireSVG(cx,base){
  var top=40, h=base-top, out='<g class="cd-spire">';
  out+='<circle class="cd-spireglow" cx="'+cx+'" cy="'+(top+70)+'" r="150" fill="url(#cdSpireGlow)" opacity=".55"/>';
  out+='<ellipse cx="'+cx+'" cy="'+(base+6)+'" rx="120" ry="20" fill="#05060c" opacity=".35"/>';
  out+='<path d="M'+(cx-110)+" "+base+"h220l-18-30h-184z\" fill=\"url(#cdGold)\" stroke=\"#5a3a10\" stroke-width=\"2\"/>";
  // three tiers of spun sugar, narrowing upward, with candy-stripe swirls
  var tiers=[[base-30,92,72],[base-30-h*.36,70,52],[base-30-h*.62,48,34]];
  tiers.forEach(function(t,i){
    var y=t[0], w0=t[1], w1=t[2], th=h*(i===0?.36:i===1?.27:.22);
    out+='<path d="M'+(cx-w0)+" "+y+"C"+(cx-w0)+" "+(y-th*.5)+" "+(cx-w1)+" "+(y-th*.7)+" "+(cx-w1*.9)+" "+(y-th)+"L"+(cx+w1*.9)+" "+(y-th)+"C"+(cx+w1)+" "+(y-th*.7)+" "+(cx+w0)+" "+(y-th*.5)+" "+(cx+w0)+" "+y+'Z" fill="url(#cdSugarTier)" stroke="#c97fae" stroke-width="2"/>';
    for(var k=0;k<4;k++){ var yy=y-th*(k+.6)/4.2, ww=w0-(w0-w1)*(k+.6)/4.2;
      out+='<path d="M'+f1(cx-ww)+" "+f1(yy)+"Q"+cx+" "+f1(yy-14)+" "+f1(cx+ww)+" "+f1(yy-4)+'" fill="none" stroke="'+["#ff8fc4","#c08af2","#7cc2ff","#ffe27a"][(k+i)%4]+'" stroke-width="5" stroke-linecap="round" stroke-opacity=".85"/>'; }
    out+='<path d="M'+(cx-w0+8)+" "+(y-4)+"q"+(w0-8)+" 10 "+(2*w0-16)+' 0" fill="none" stroke="#fff" stroke-width="3" stroke-opacity=".7"/>';
  });
  // the tip: a twisted sugar spike and a crystal star
  var ty=tiers[2][0]-h*.22;
  out+='<path d="M'+(cx-24)+" "+ty+"Q"+(cx-6)+" "+(ty-40)+" "+cx+" "+(top+18)+"Q"+(cx+6)+" "+(ty-40)+" "+(cx+24)+" "+ty+'Z" fill="url(#cdSugar)" stroke="#c97fae" stroke-width="2"/>';
  out+='<path d="M'+(cx-14)+" "+(ty-10)+"L"+(cx+12)+" "+(ty-26)+"M"+(cx-10)+" "+(ty-34)+"L"+(cx+8)+" "+(ty-48)+'" stroke="#ff8fc4" stroke-width="4" stroke-linecap="round"/>';
  out+='<path class="cd-star" d="'+starPath(cx,top+10,22)+'" fill="url(#cdGold)" stroke="#fff4cf" stroke-width="2"/>';
  // a door and two round windows
  out+='<path d="M'+(cx-14)+" "+(base-30)+"v-24a14 14 0 0 1 28 0v24z\" fill=\"#5c1532\" stroke=\"#e7ca90\" stroke-width=\"2\"/>";
  out+='<circle cx="'+(cx-40)+'" cy="'+(base-62)+'" r="7" fill="#fff4cf" fill-opacity=".9"/><circle cx="'+(cx+40)+'" cy="'+(base-62)+'" r="7" fill="#fff4cf" fill-opacity=".9"/>';
  out+='<circle cx="'+cx+'" cy="'+(base-30-h*.5)+'" r="6" fill="#fff4cf" fill-opacity=".9"/></g>';
  return out;
}
function starPath(cx,cy,r){ var d=""; for(var i=0;i<10;i++){ var a=-Math.PI/2+i*Math.PI/5, rr=i%2?r*.45:r; d+=(i?"L":"M")+f1(cx+rr*Math.cos(a))+" "+f1(cy+rr*Math.sin(a)); } return d+"Z"; }

/* ---------------- scenery (seeded, never on the road) ---------------- */
function farFromRoad(x,y,pad){ for(var i=0;i<PTS.length;i+=3){ if(Math.abs(PTS[i].x-x)<ROAD/2+pad&&Math.abs(PTS[i].y-y)<ROAD/2+pad) return false; } return true; }
function lollipop(x,y,s,c1,c2){ return '<path d="M'+x+" "+(y+s*.4)+"V"+(y+s*1.5)+'" stroke="#f6efe0" stroke-width="'+f1(s*.14)+'" stroke-linecap="round"/><circle cx="'+x+'" cy="'+y+'" r="'+f1(s*.55)+'" fill="'+c1+'"/>'+
  '<path d="M'+x+" "+y+"m"+f1(-s*.08)+" 0a"+f1(s*.1)+" "+f1(s*.1)+" 0 1 1 "+f1(s*.2)+" 0a"+f1(s*.22)+" "+f1(s*.22)+" 0 1 1 "+f1(-s*.42)+" "+f1(s*.04)+"a"+f1(s*.34)+" "+f1(s*.34)+" 0 1 1 "+f1(s*.66)+" "+f1(-s*.08)+'" fill="none" stroke="'+c2+'" stroke-width="'+f1(s*.09)+'" stroke-linecap="round"/>'; }
function gumdrop(x,y,s,c){ return '<path d="M'+f1(x-s)+" "+y+"C"+f1(x-s)+" "+f1(y-s*1.5)+" "+f1(x+s)+" "+f1(y-s*1.5)+" "+f1(x+s)+" "+y+'Z" fill="'+c+'"/><ellipse cx="'+f1(x-s*.3)+'" cy="'+f1(y-s*.75)+'" rx="'+f1(s*.25)+'" ry="'+f1(s*.15)+'" fill="#fff" fill-opacity=".45"/>'; }
function scenery(){
  var r=rng(20261016), out="", i, x, y, cs=["#ff8fc4","#c08af2","#7cc2ff","#ffe27a","#86e08e","#ffb46a"];
  // the sky behind the spire: cotton-candy clouds and stars
  out+='<g opacity=".9"><path d="M640 120c-20 0-26-26-6-32 2-24 34-28 44-12 10-18 46-16 50 6 20-6 40 10 30 30 12 8 4 24-12 24z" fill="#ffd0ea" fill-opacity=".22"/>'+
    '<path d="M150 150c-16 0-20-20-4-26 2-20 28-22 36-10 8-14 36-12 40 4 16-4 30 8 24 24 10 6 4 18-8 18z" fill="#c9b8ff" fill-opacity=".18"/></g>';
  for(i=0;i<26;i++){ x=40+r()*920; y=24+r()*230; if(Math.abs(x-XE+95)<130&&y>40) continue; out+='<path d="'+starPath(f1(x),f1(y),f1(3+r()*4))+'" fill="#fff4cf" fill-opacity="'+f1(.35+r()*.5)+'"/>'; }
  // gumdrop hills along the sky line and lollipop trees in the top corners
  out+=gumdrop(60,272,34,"#8e4fd8")+gumdrop(118,276,26,"#e5324a")+gumdrop(920,268,36,"#36b653")+gumdrop(862,276,24,"#f5862a")+gumdrop(760,276,22,"#2f8fe8");
  out+=lollipop(220,196,46,"#ff8fc4","#fff4f8")+lollipop(300,224,30,"#7cc2ff","#fff")+lollipop(820,190,40,"#ffe27a","#e5324a")+lollipop(720,226,28,"#86e08e","#fff");
  // sprinkles in the gaps between the rows
  for(i=0;i<240;i++){
    x=36+r()*928; y=300+r()*790; if(!farFromRoad(x,y,6)) continue;
    var a=Math.round(r()*180), c=cs[Math.floor(r()*cs.length)];
    out+='<rect x="'+f1(x-6)+'" y="'+f1(y-2)+'" width="12" height="4" rx="2" fill="'+c+'" fill-opacity=".75" transform="rotate('+a+" "+f1(x)+" "+f1(y)+')"/>';
  }
  return out;
}

/* ---------------- one square ---------------- */
function sqRect(n,inset,extra){ var p=POS[n], w=L-(inset||4), h=ROAD-(inset||4)-6; return '<rect x="'+f1(p.x-w/2)+'" y="'+f1(p.y-h/2)+'" width="'+f1(w)+'" height="'+f1(h)+'" rx="10" transform="rotate('+f1(p.a)+" "+f1(p.x)+" "+f1(p.y)+')"'+(extra||"")+"/>"; }
function squareSVG(B,n){
  var c=B.track.charAt(n), p=POS[n], out="";
  if(c==="*"){
    out+=sqRect(n,2,' fill="url(#cdcK)" stroke="#fff" stroke-width="3"');
    var k=B.pics.indexOf(n), s=Math.min(L,ROAD)*.95;
    out+='<g transform="translate('+f1(p.x-s/2)+" "+f1(p.y-s/2)+") scale("+(s/100).toFixed(3)+')">'+PICS[k]+"</g>";
    return '<g class="cd-sq is-pic" data-n="'+n+'">'+out+"</g>";
  }
  if(c==="W"){
    out+=sqRect(n,2,' fill="url(#cdRainbow)" stroke="#fff4cf" stroke-width="3"')+sqRect(n,12,' fill="url(#cdGloss)"');
    out+='<path d="'+starPath(p.x,p.y,15)+'" fill="#fff4cf" fill-opacity=".9"/>';
    return '<g class="cd-sq is-rainbow" data-n="'+n+'">'+out+"</g>";
  }
  out+=sqRect(n,4,' fill="url(#cdc'+c+')" stroke="'+COL[c][2]+'" stroke-width="2"')+sqRect(n,14,' fill="url(#cdGloss)" opacity=".85"');
  if(B.sticky[n]!=null){
    if(B.stickyKind==="until"){   // 1984: a caramel bog on the square; the square keeps its colour, the colour that frees you
      out+='<g transform="translate('+f1(p.x)+" "+f1(p.y)+") rotate("+f1(p.a)+')"><path d="M-17 -8C-22 -20 -4 -24 4 -18C14 -26 26 -12 18 -2C26 8 12 20 2 14C-8 22 -24 12 -17 -8Z" fill="url(#cdCaramel)" stroke="#3a1a06" stroke-width="2"/>'+
        '<ellipse cx="-4" cy="-8" rx="6" ry="3" fill="#ffe0b0" fill-opacity=".6"/><circle cx="6" cy="4" r="5" fill="#1d0c04"/></g>';
    } else {                        // 2004: a licorice twist across the square (lose your next turn)
      out+='<g transform="translate('+f1(p.x)+" "+f1(p.y)+") rotate("+f1(p.a+90)+')"><path d="M-26 -6C-16 -16 -8 4 0 -6S16 4 26 -6" fill="none" stroke="#14080c" stroke-width="12" stroke-linecap="round"/>'+
        '<path d="M-26 -6C-16 -16 -8 4 0 -6S16 4 26 -6" fill="none" stroke="#6e1c32" stroke-width="5" stroke-linecap="round" stroke-dasharray="4 6"/>'+
        '<path d="M-26 8C-16 -2 -8 18 0 8S16 18 26 8" fill="none" stroke="#14080c" stroke-width="12" stroke-linecap="round"/>'+
        '<path d="M-26 8C-16 -2 -8 18 0 8S16 18 26 8" fill="none" stroke="#6e1c32" stroke-width="5" stroke-linecap="round" stroke-dasharray="4 6"/></g>';
    }
    return '<g class="cd-sq is-sticky" data-n="'+n+'">'+out+'<g class="cd-warn" opacity="0">'+sqRect(n,-6,' fill="none" stroke="#ff6b6b" stroke-width="6"')+"</g></g>";
  }
  return '<g class="cd-sq" data-n="'+n+'">'+out+"</g>";
}

/* ---------------- the shortcuts: a ribbon-candy slide (from square 5) and a wafer bridge ---------------- */
var SC={};
function bezPts(a,b,c1,c2,N){ var out=[]; for(var i=0;i<=N;i++){ var t=i/N, u=1-t; out.push({x:u*u*u*a.x+3*u*u*t*c1.x+3*u*t*t*c2.x+t*t*t*b.x,y:u*u*u*a.y+3*u*u*t*c1.y+3*u*t*t*c2.y+t*t*t*b.y}); } return out; }
/* the shortcuts run UNDER the squares (every square keeps its whole colour), seen between the rows and in the open ground; a gold ring
   marks the square you take one from and the square it reaches. The bridge arcs through the gap above the row it ends on. */
function shortcutSVG(from,to,name,kind){
  var a=POS[from], b=POS[to], dx=b.x-a.x, dy=b.y-a.y, len=Math.hypot(dx,dy)||1, nx=-dy/len, ny=dx/len, bow;
  if(ny>0){ nx=-nx; ny=-ny; }   // bulge upward on the board
  if(kind==="ribbon") bow=Math.min(120,len*.18);
  else { var gapY=b.y-DY/2; bow=Math.max(40,((a.y+b.y)/2-gapY)/.75/Math.max(.3,-ny)); }
  var c1={x:a.x+dx*.2+nx*bow,y:a.y+dy*.2+ny*bow}, c2={x:a.x+dx*.8+nx*bow,y:a.y+dy*.8+ny*bow};
  var pts=bezPts(a,b,c1,c2,48), d="M"+f1(a.x)+" "+f1(a.y)+"C"+f1(c1.x)+" "+f1(c1.y)+" "+f1(c2.x)+" "+f1(c2.y)+" "+f1(b.x)+" "+f1(b.y);
  SC[from]={pts:pts,to:to,name:name,kind:kind};
  var u='<g class="cd-short is-'+kind+'" data-from="'+from+'">';
  u+='<path d="'+d+'" fill="none" stroke="#05060c" stroke-opacity=".4" stroke-width="'+(kind==="ribbon"?50:44)+'" stroke-linecap="round" transform="translate(5 8)"/>';
  if(kind==="ribbon"){
    [["#e5324a",44],["#f5862a",37],["#f6c330",30],["#36b653",23],["#2f8fe8",16],["#8e4fd8",9]].forEach(function(s){ u+='<path d="'+d+'" fill="none" stroke="'+s[0]+'" stroke-width="'+s[1]+'" stroke-linecap="round"/>'; });
    u+='<path d="'+d+'" fill="none" stroke="#fff" stroke-opacity=".55" stroke-width="2.5" stroke-dasharray="14 10" stroke-linecap="round"/>';
  } else {
    u+='<path d="'+d+'" fill="none" stroke="#5e2f0c" stroke-width="40" stroke-linecap="round"/><path d="'+d+'" fill="none" stroke="#e9c68a" stroke-width="32" stroke-linecap="round"/>'+
      '<path d="'+d+'" fill="none" stroke="#b98544" stroke-width="32" stroke-dasharray="3 10"/><path d="'+d+'" fill="none" stroke="#fff3d6" stroke-opacity=".6" stroke-width="3" stroke-linecap="round" transform="translate(0 -10)"/>';
  }
  u+="</g>";
  var o='<g class="cd-shortx" data-from="'+from+'"><circle cx="'+f1(a.x)+'" cy="'+f1(a.y)+'" r="20" fill="none" stroke="#fff4cf" stroke-width="4.5"/><circle cx="'+f1(b.x)+'" cy="'+f1(b.y)+'" r="20" fill="none" stroke="#fff4cf" stroke-width="4.5"/>'+
    '<path class="cd-glow" d="'+d+'" fill="none" stroke="#fff6d8" stroke-width="'+(kind==="ribbon"?50:44)+'" stroke-linecap="round" opacity="0"/></g>';
  return {under:u,over:o};
}

/* ---------------- the whole board ---------------- */
var st={host:null,svg:null,bd:null,label:null,labelPx:0,marks:null};
function build(host,bd){
  buildPath(); defs();
  host=typeof host==="string"?document.querySelector(host):host; if(!host) return null;
  var B=E().BOARDS[bd]; st.host=host; st.bd=bd; SC={};
  var road="M"+PTS.map(function(p){ return f1(p.x)+" "+f1(p.y); }).join("L");
  var sq="", n, sh="", shx="";
  for(n=1;n<=END;n++) sq+=squareSVG(B,n);
  Object.keys(B.short).forEach(function(k){ var a=+k; var x=shortcutSVG(a,B.short[a],B.shortName[a],a===5?"ribbon":"bridge"); sh+=x.under; shx+=x.over; });
  var spire=spireSVG(XE-110,rowY(ROWS-1)+30);
  var sp=startPos();
  var start='<g class="cd-start"><circle cx="'+sp.x+'" cy="'+sp.y+'" r="62" fill="#05060c" opacity=".35" transform="translate(4 6)"/><circle cx="'+sp.x+'" cy="'+sp.y+'" r="60" fill="url(#cdGold)" stroke="#5a3a10" stroke-width="2"/>'+
    '<circle cx="'+sp.x+'" cy="'+sp.y+'" r="50" fill="#fff4f8" stroke="#ff8fc4" stroke-width="4" stroke-dasharray="8 6"/>'+
    '<text class="cd-startlbl" x="'+sp.x+'" y="'+(sp.y+42)+'" text-anchor="middle">Start</text></g>';
  var bg='<rect width="'+W+'" height="'+H+'" fill="url(#cdNight)"/><rect y="250" width="'+W+'" height="'+(H-250)+'" fill="url(#cdGround)"/>';
  var boardDefs='<defs>'+
    '<linearGradient id="cdNight" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1a0f2a"/><stop offset=".28" stop-color="#3a1a3c"/><stop offset="1" stop-color="#2a1420"/></linearGradient>'+
    '<radialGradient id="cdGround" cx=".5" cy=".55" r=".75"><stop offset="0" stop-color="#5a2a3c"/><stop offset=".7" stop-color="#402028"/><stop offset="1" stop-color="#26121a"/></radialGradient>'+
    '<radialGradient id="cdSpireGlow" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#fff0f8" stop-opacity=".95"/><stop offset=".45" stop-color="#ffb3d6" stop-opacity=".35"/><stop offset="1" stop-color="#ffb3d6" stop-opacity="0"/></radialGradient>'+
    '<linearGradient id="cdSugarTier" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#f7cfe6"/><stop offset=".4" stop-color="#fff6fb"/><stop offset="1" stop-color="#e3b3d4"/></linearGradient></defs>';
  host.innerHTML='<svg class="cd-svg" viewBox="0 0 '+W+" "+H+'" preserveAspectRatio="xMidYMid meet" aria-hidden="true" focusable="false">'+boardDefs+bg+
    '<g class="cd-scenery">'+scenery()+'</g>'+spire+
    '<path d="'+road+'" fill="none" stroke="#05060c" stroke-opacity=".4" stroke-width="'+(ROAD+22)+'" stroke-linejoin="round" stroke-linecap="round" transform="translate(5 8)"/>'+
    '<path d="'+road+'" fill="none" stroke="#7a4220" stroke-width="'+(ROAD+20)+'" stroke-linejoin="round" stroke-linecap="round"/>'+
    '<path d="'+road+'" fill="none" stroke="#fff3e2" stroke-width="'+(ROAD+12)+'" stroke-linejoin="round" stroke-linecap="round" stroke-dasharray="18 7"/>'+
    '<path d="'+road+'" fill="none" stroke="#f3dcc0" stroke-width="'+(ROAD+2)+'" stroke-linejoin="round" stroke-linecap="round"/>'+
    '<g class="cd-shorts">'+sh+'</g><g class="cd-sqs">'+sq+'</g><g class="cd-shortsx">'+shx+'</g>'+start+'<g class="cd-marks"></g></svg>';
  st.svg=host.querySelector("svg"); st.label=st.svg.querySelector(".cd-startlbl"); st.labelPx=0; st.marks=st.svg.querySelector(".cd-marks");
  return st.svg;
}
/* the one label stays at or above the text floor (phone 12 px, TV 21 px at 1080p) at any board size */
function label(unitPx,floorPx){
  if(!st.label||!unitPx) return;
  var fs=Math.max(24,Math.ceil((floorPx+.4)/unitPx)); if(fs===st.labelPx) return; st.labelPx=fs;
  st.label.setAttribute("font-size",fs); var sp=startPos(); st.label.setAttribute("y",String(sp.y+22+fs*.62));   // on the plate, under the movers waiting there
}
function svgEl(tag,attrs){ var e=document.createElementNS(NS,tag); for(var k in attrs) e.setAttribute(k,attrs[k]); return e; }
/* a gold ring counts a square (a colour card's matches, one beat each); one shot, opacity only */
function mark(n,ms,color){
  if(!st.marks||!POS||!POS[n]) return null;
  var p=POS[n], w=L+8, h=ROAD+4;
  var r=svgEl("rect",{x:f1(p.x-w/2),y:f1(p.y-h/2),width:f1(w),height:f1(h),rx:"14",fill:"none",stroke:color||"#fff4cf","stroke-width":"6",transform:"rotate("+f1(p.a)+" "+f1(p.x)+" "+f1(p.y)+")"});
  st.marks.appendChild(r);
  var done=function(){ if(r.parentNode) r.parentNode.removeChild(r); };
  if(r.animate&&ms>0){ try{ r.animate([{opacity:0},{opacity:1,offset:.2},{opacity:1,offset:.75},{opacity:0}],{duration:ms,easing:"ease-out"}).finished.then(done,done); return r; }catch(e){} }
  setTimeout(done,Math.max(200,ms||600)); return r;
}
function clearMarks(){ if(st.marks) st.marks.innerHTML=""; }
/* a shortcut lights up while it is taken (opacity only, one shot) */
function glow(from,ms){
  if(!st.svg) return; var gl=st.svg.querySelector('.cd-shortx[data-from="'+from+'"] .cd-glow'); if(!gl||!gl.animate) return;
  try{ gl.animate([{opacity:0},{opacity:.75,offset:.2},{opacity:.5,offset:.75},{opacity:0}],{duration:ms,easing:"ease-out"}); }catch(e){}
}
/* the Sugarspire glows (tension near the end: a few finite beats; the finish: one big burst) */
function spire(ms,beats){
  if(!st.svg) return; var gl=st.svg.querySelector(".cd-spireglow"), stv=st.svg.querySelector(".cd-star"); if(!gl||!gl.animate) return;
  try{ gl.animate([{opacity:.55},{opacity:1,offset:.35},{opacity:.55}],{duration:ms,iterations:beats||1,easing:"ease-in-out"}); }catch(e){}
  if(stv&&stv.animate) try{ stv.animate([{opacity:1},{opacity:.4,offset:.5},{opacity:1}],{duration:ms,iterations:beats||1}); }catch(e){}
}
/* sticky squares within one card of the player: three soft red pulses (finite; the page skips it under reduced effects) */
function warn(list){
  if(!st.svg) return;
  list.forEach(function(n){ var c=st.svg.querySelector('.cd-sq[data-n="'+n+'"] .cd-warn'); if(!c||!c.animate) return;
    try{ c.animate([{opacity:0},{opacity:.9,offset:.3},{opacity:0}],{duration:1100,iterations:3,easing:"ease-in-out"}); }catch(e){} });
}
function shortcutPts(from){ var s=SC[from]; return s?s.pts:null; }

CY.Board={W:W,H:H,END:END,COL:COL,PICS:PICS,get L(){ buildPath(); return L; },ROAD:ROAD,centre:centre,startSlot:startSlot,build:build,label:label,mark:mark,clearMarks:clearMarks,
  glow:glow,spire:spire,warn:warn,shortcutPts:shortcutPts,cardSVG:cardSVG,backSVG:backSVG,picSVG:picSVG,cardWords:cardWords,defs:defs,
  _geom:function(){ buildPath(); return {L:L,LEN:LEN,pos:POS}; },state:function(){ return st; },
  _art:{gradDefs:gradDefs,spireSVG:spireSVG,starPath:starPath,gumdrop:gumdrop,lollipop:lollipop}};   // the art generator (BG_audit/games/candy/page/gen-art.js) draws the icons and the hero from these
if(typeof module!=="undefined"&&module.exports) module.exports=CY.Board;
})(typeof window!=="undefined"?window:globalThis);
