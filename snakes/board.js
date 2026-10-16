/* SNAKES AND LADDERS — the board art (window.Snakes.Board). Original Midnight Luxe art, drawn as inline SVG from the engine's board data
   (G.L), so every real layout and a shuffled board look the same way: lacquered jewel squares, gilded ladders with rungs, patterned
   snakes with a head, eyes and a forked tongue, a gold crest on 100 and a start rail under square 1 (players start OFF the board).
   No filters, no images: gradients and paths only. Pieces live in an HTML layer over the SVG (game.js) and move by transform.
   Geometry (viewBox units): the 10x10 grid is 1000 x 1000, square n's centre is cell(n) (1 bottom left, rows alternate, 100 top left);
   the start rail is the strip y 1000..1070. Exports what game.js needs to animate: centre(n), startSlot(i), snakePts(head) (the
   centreline from the head down to the tail: the slither follows it), rungs(foot) (the rung midpoints, foot to top: the climb steps
   on each one), glow(kind, at, ms) (the ladder or snake lights up as it fires), and numbers(px) (keeps the square numbers above the text
   floor at any board size). */
(function(g){
"use strict";
var S=g.Snakes=g.Snakes||{};
var W=1000, H=1070, RAIL=1000, NS="http://www.w3.org/2000/svg";
var E=function(){ return S.Engine; };
function cell(n){ var r=Math.floor((n-1)/10), c=(n-1)%10; if(r%2) c=9-c; return {x:c*100+50,y:(9-r)*100+50}; }
function centre(n){ return n>=1&&n<=100?cell(n):{x:50,y:1035}; }
function startSlot(i,n){ var gap=n>4?66:76; return {x:52+i*gap,y:1035}; }
function f1(x){ return Math.round(x*10)/10; }
function hash(s){ var h=2166136261; s=String(s); for(var i=0;i<s.length;i++){ h^=s.charCodeAt(i); h=Math.imul(h,16777619); } return h>>>0; }

/* the board palettes (original jewel lacquer; never the red/blue print of a real board): [dark square, light square, rail] */
var PAL={
  vic:{a:"#4b1730",b:"#16305e",a2:"#6a2442",b2:"#244584",name:"garnet and sapphire"},
  mb:{a:"#123f36",b:"#5a3a0e",a2:"#1d5a4c",b2:"#80561c",name:"jade and amber"},
  shuffle:{a:"#2e1c52",b:"#0f3d44",a2:"#43307a",b2:"#1b5a62",name:"amethyst and teal"}
};
/* snake skins (original): body, darker body, the diamonds down the back, the belly line */
var SKINS=[
  ["#3fae6a","#1b5a34","#f3d36a","#b9f0c8"],   // emerald, gold diamonds
  ["#d0434f","#6e1622","#ffe08a","#ffc2c2"],   // ruby
  ["#4277d6","#1a3470","#a8ecff","#cfe0ff"],   // sapphire
  ["#e09a3a","#7a4310","#3a1a08","#ffe0b0"],   // amber, dark diamonds
  ["#9a62e0","#462480","#ffd1f0","#e6d2ff"],   // violet
  ["#94d63a","#3b6614","#1d3a0a","#e6ffc0"],   // viper lime
  ["#2fb5b0","#0f4f4c","#ffe08a","#c8fff6"]    // teal
];

var st={host:null,svg:null,L:{},bd:"vic",snakes:{},ladders:{},numEls:[],numPx:0};

/* ---------- snakes: a sine-curved centreline from the head (higher square) to the tail ---------- */
function snakeLine(a,b,seed){
  var A=centre(a), B=centre(b), dx=B.x-A.x, dy=B.y-A.y, len=Math.sqrt(dx*dx+dy*dy)||1, nx=-dy/len, ny=dx/len;
  var waves=Math.max(1,Math.round(len/300)), amp=Math.min(58,16+len*.06)*((seed%2)?1:-1);
  if(len<130){ waves=1; amp=(seed%2?1:-1)*Math.max(26,len*.35); }   // a short one (56->53) curls
  var N=Math.max(28,Math.round(len/11)), pts=[];
  for(var i=0;i<=N;i++){ var t=i/N, s=Math.sin(Math.PI*waves*t)*amp; pts.push({x:A.x+dx*t+nx*s,y:A.y+dy*t+ny*s,t:t}); }
  return pts;
}
function normalAt(pts,i){ var p=pts[Math.max(0,i-1)], q=pts[Math.min(pts.length-1,i+1)], dx=q.x-p.x, dy=q.y-p.y, l=Math.sqrt(dx*dx+dy*dy)||1; return {x:-dy/l,y:dx/l,tx:dx/l,ty:dy/l}; }
function snakeSVG(head,tail,k){
  var seed=hash(head+":"+tail), pts=snakeLine(head,tail,seed), sk=SKINS[k%SKINS.length], N=pts.length-1, L=[], R=[], i;
  var len=0; for(i=1;i<=N;i++) len+=Math.hypot(pts[i].x-pts[i-1].x,pts[i].y-pts[i-1].y);
  var wHead=Math.min(36,22+len*.02);
  function wid(t){ return Math.max(0,(wHead-1)*Math.pow(1-t,.75))+(t<1?1:0); }
  for(i=0;i<=N;i++){ var n=normalAt(pts,i), w=wid(pts[i].t)/2; L.push(f1(pts[i].x+n.x*w)+" "+f1(pts[i].y+n.y*w)); R.push(f1(pts[i].x-n.x*w)+" "+f1(pts[i].y-n.y*w)); }
  var body="M"+L.join("L")+"L"+R.reverse().join("L")+"Z";
  var gid="sg"+k, A=pts[0], B=pts[N];
  var out='<g class="sn-snake" data-head="'+head+'"><defs><linearGradient id="'+gid+'" gradientUnits="userSpaceOnUse" x1="'+f1(A.x)+'" y1="'+f1(A.y)+'" x2="'+f1(B.x)+'" y2="'+f1(B.y)+'">'+
    '<stop offset="0" stop-color="'+sk[0]+'"/><stop offset=".6" stop-color="'+sk[0]+'"/><stop offset="1" stop-color="'+sk[1]+'"/></linearGradient></defs>'+
    '<path d="'+body+'" fill="#05060c" opacity=".35" transform="translate(5 7)"/>'+
    '<path d="'+body+'" fill="url(#'+gid+')" stroke="#0b0a12" stroke-opacity=".6" stroke-width="3" stroke-linejoin="round"/>';
  // the belly line: a light stripe down one side of the body
  var bl=[]; for(i=1;i<Math.round(N*.86);i++){ var nb=normalAt(pts,i), wb=wid(pts[i].t)*.28; bl.push(f1(pts[i].x+nb.x*wb)+" "+f1(pts[i].y+nb.y*wb)); }
  if(bl.length>1) out+='<path d="M'+bl.join("L")+'" fill="none" stroke="'+sk[3]+'" stroke-opacity=".38" stroke-width="3.5" stroke-linecap="round"/>';
  // diamonds down the back
  var d="", acc=0, every=27;
  for(i=2;i<N-2;i++){
    acc+=Math.hypot(pts[i].x-pts[i-1].x,pts[i].y-pts[i-1].y); if(acc<every) continue; acc=0;
    var nd=normalAt(pts,i), wd=wid(pts[i].t); if(wd<7) break;
    var hl=Math.min(11,wd*.42), hw=wd*.3, p=pts[i];
    d+="M"+f1(p.x+nd.tx*hl)+" "+f1(p.y+nd.ty*hl)+"L"+f1(p.x+nd.x*hw)+" "+f1(p.y+nd.y*hw)+"L"+f1(p.x-nd.tx*hl)+" "+f1(p.y-nd.ty*hl)+"L"+f1(p.x-nd.x*hw)+" "+f1(p.y-nd.y*hw)+"Z";
  }
  if(d) out+='<path d="'+d+'" fill="'+sk[2]+'" fill-opacity=".9"/>';
  // the head: points away from the body, eyes and a forked tongue
  var n0=normalAt(pts,0), fx=-n0.tx, fy=-n0.ty, ang=Math.atan2(fy,fx)*180/Math.PI, hs=wHead/34;
  out+='<g class="sn-head" transform="translate('+f1(A.x)+" "+f1(A.y)+") rotate("+f1(ang)+") scale("+f1(hs*100)/100+')" data-css="translate('+f1(A.x)+"px,"+f1(A.y)+"px) rotate("+f1(ang)+"deg) scale("+f1(hs*100)/100+')">'+
    '<path d="M38 0L56 0M56 0L64 -7M56 0L64 7" fill="none" stroke="#e8364a" stroke-width="3.2" stroke-linecap="round"/>'+
    '<path d="M-10 -17C14 -24 34 -12 40 0C34 12 14 24 -10 17Z" fill="'+sk[0]+'" stroke="#0b0a12" stroke-opacity=".6" stroke-width="3"/>'+
    '<path d="M2 -8C14 -12 26 -7 31 0C26 7 14 12 2 8Z" fill="'+sk[2]+'" fill-opacity=".55"/>'+
    '<circle cx="16" cy="-10" r="5" fill="#fff6dc"/><circle cx="16" cy="10" r="5" fill="#fff6dc"/><circle cx="17.5" cy="-10" r="2.4" fill="#0b0a12"/><circle cx="17.5" cy="10" r="2.4" fill="#0b0a12"/></g>';
  // the glow that plays when this snake fires (opacity only)
  out+='<path class="sn-glow" d="'+body+'" fill="none" stroke="#ffe9a8" stroke-width="9" stroke-linejoin="round" opacity="0"/>';
  out+='<circle class="sn-warn" cx="'+f1(A.x)+'" cy="'+f1(A.y)+'" r="44" fill="none" stroke="#ff6b6b" stroke-width="5" opacity="0"/></g>';
  st.snakes[head]={pts:pts,tail:tail};
  return out;
}

/* ---------- ladders: two gilded rails with rungs; the climb steps on every rung ---------- */
function ladderSVG(foot,top,k){
  var A=centre(foot), B=centre(top), dx=B.x-A.x, dy=B.y-A.y, len=Math.sqrt(dx*dx+dy*dy)||1, ux=dx/len, uy=dy/len, nx=-uy, ny=ux, hw=17, ext=18;
  var a={x:A.x-ux*ext,y:A.y-uy*ext}, b={x:B.x+ux*ext,y:B.y+uy*ext};
  var rail=function(s){ return "M"+f1(a.x+nx*hw*s)+" "+f1(a.y+ny*hw*s)+"L"+f1(b.x+nx*hw*s)+" "+f1(b.y+ny*hw*s); };
  var nr=Math.max(3,Math.round(len/40)), gap=len/nr, rungs="", mids=[];
  for(var i=0;i<=nr;i++){ var t=Math.min(len,i*gap), cx=A.x+ux*t, cy=A.y+uy*t; mids.push({x:cx,y:cy});
    if(i>0&&i<nr) rungs+="M"+f1(cx+nx*hw)+" "+f1(cy+ny*hw)+"L"+f1(cx-nx*hw)+" "+f1(cy-ny*hw); }
  var gid="lg"+k, rails=rail(1)+rail(-1);
  st.ladders[foot]={mids:mids,top:top};
  return '<g class="sn-ladder" data-foot="'+foot+'"><defs><linearGradient id="'+gid+'" gradientUnits="userSpaceOnUse" x1="'+f1(a.x+nx*hw)+'" y1="'+f1(a.y+ny*hw)+'" x2="'+f1(a.x-nx*hw)+'" y2="'+f1(a.y-ny*hw)+'">'+
    '<stop offset="0" stop-color="#fff0c4"/><stop offset=".45" stop-color="#d9b06a"/><stop offset="1" stop-color="#8f6428"/></linearGradient></defs>'+
    '<path d="'+rails+rungs+'" fill="none" stroke="#05060c" stroke-opacity=".4" stroke-width="12" transform="translate(5 7)" stroke-linecap="round"/>'+
    '<path d="'+rungs+'" fill="none" stroke="#2a1a08" stroke-width="10" stroke-linecap="round"/><path d="'+rungs+'" fill="none" stroke="url(#'+gid+')" stroke-width="6" stroke-linecap="round"/>'+
    '<path d="'+rails+'" fill="none" stroke="#2a1a08" stroke-width="13" stroke-linecap="round"/><path d="'+rails+'" fill="none" stroke="url(#'+gid+')" stroke-width="8" stroke-linecap="round"/>'+
    '<path d="'+rails+'" fill="none" stroke="#fff6dc" stroke-opacity=".45" stroke-width="2" stroke-linecap="round" transform="translate('+f1(nx*-2)+" "+f1(ny*-2)+')"/>'+
    '<path class="sn-glow" d="'+rails+rungs+'" fill="none" stroke="#fff2c0" stroke-width="14" stroke-linecap="round" opacity="0"/></g>';
}

/* ---------- the whole board ---------- */
function build(host,L,bd){
  host=typeof host==="string"?document.querySelector(host):host; if(!host) return null;
  st.host=host; st.L=L||{}; st.bd=bd||"vic"; st.snakes={}; st.ladders={};
  var P=PAL[st.bd]||PAL.vic, sq="", nums="", i, c;
  var defs='<defs><linearGradient id="snSqA" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="'+P.a2+'"/><stop offset="1" stop-color="'+P.a+'"/></linearGradient>'+
    '<linearGradient id="snSqB" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="'+P.b2+'"/><stop offset="1" stop-color="'+P.b+'"/></linearGradient>'+
    '<radialGradient id="snGloss" cx=".3" cy=".18" r=".95"><stop offset="0" stop-color="#fff" stop-opacity=".16"/><stop offset=".55" stop-color="#fff" stop-opacity=".03"/><stop offset="1" stop-color="#000" stop-opacity=".22"/></radialGradient>'+
    '<radialGradient id="snCrest" cx=".5" cy=".45" r=".7"><stop offset="0" stop-color="#fff4cf"/><stop offset=".5" stop-color="#e2bd72"/><stop offset="1" stop-color="#9c6c2c"/></radialGradient>'+
    '<radialGradient id="snBurst" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#fff6d8" stop-opacity=".95"/><stop offset=".45" stop-color="#f3c96a" stop-opacity=".5"/><stop offset="1" stop-color="#f3c96a" stop-opacity="0"/></radialGradient>'+
    '<linearGradient id="snRail" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1b1830"/><stop offset="1" stop-color="#0c0b18"/></linearGradient></defs>';
  for(i=1;i<=100;i++){
    c=cell(i); var x=c.x-50, y=c.y-50, odd=((Math.floor((i-1)/10))+((i-1)%10))%2;
    if(i===100){ sq+='<rect x="'+x+'" y="'+y+'" width="100" height="100" fill="url(#snCrest)"/>'+
      '<path d="M'+(x+50)+' '+(y+22)+'l8.5 17.5 19.3 2.8-14 13.6 3.3 19.2L'+(x+50)+' '+(y+66)+'l-17.1 9.1 3.3-19.2-14-13.6 19.3-2.8z" fill="#7a4e14" fill-opacity=".55"/>'; continue; }
    sq+='<rect x="'+x+'" y="'+y+'" width="100" height="100" fill="url(#snSq'+(odd?"B":"A")+')"/>';
  }
  // ladder foot and snake head squares carry a soft ring, so the start of every ladder and snake is easy to find
  var marks="";
  Object.keys(st.L).forEach(function(k){ var a=+k, b=+st.L[k], cc=cell(a); marks+='<rect x="'+(cc.x-46)+'" y="'+(cc.y-46)+'" width="92" height="92" rx="10" fill="none" stroke="'+(b>a?"#f0d48a":"#ff8a8a")+'" stroke-opacity=".5" stroke-width="3"/>'; });
  var lad="", sn="", k=0;
  Object.keys(st.L).forEach(function(kk){ var a=+kk, b=+st.L[kk]; if(b>a) lad+=ladderSVG(a,b,k++); });
  var ks=0; Object.keys(st.L).sort(function(x,y){ return (+st.L[y]-+y)-(+st.L[x]-+x); }).forEach(function(kk){ var a=+kk, b=+st.L[kk]; if(b<a){ sn+=snakeSVG(a,b,ks+100); ks++; } });
  for(i=1;i<=100;i++){ c=cell(i); nums+='<text class="sn-num'+(i===100?" is-100":"")+'" x="'+(c.x-42)+'" y="'+(c.y-42)+'">'+i+"</text>"; }
  var rail='<rect x="0" y="'+RAIL+'" width="'+W+'" height="'+(H-RAIL)+'" fill="url(#snRail)"/><path d="M0 '+(RAIL+1)+'H'+W+'" stroke="#e7ca90" stroke-opacity=".55" stroke-width="2"/>'+
    '<path d="M50 '+(RAIL-4)+'l-12 14h24z" fill="#e7ca90" fill-opacity=".7"/>'+
    '<text class="sn-railtxt" x="'+(W-18)+'" y="'+(RAIL+35)+'">Start: off the board</text>';
  var crest='<g class="sn-crestfx" opacity="0"><circle cx="50" cy="50" r="150" fill="url(#snBurst)"/></g>';
  host.innerHTML='<svg class="sn-svg" viewBox="0 0 '+W+" "+H+'" preserveAspectRatio="xMidYMid meet" aria-hidden="true" focusable="false">'+defs+
    '<g class="sn-sq">'+sq+'</g><rect width="1000" height="1000" fill="url(#snGloss)"/><g class="sn-grid">'+gridLines()+'</g>'+marks+
    '<g class="sn-lads">'+lad+'</g><g class="sn-snks">'+sn+'</g><g class="sn-nums">'+nums+'</g>'+rail+crest+'</svg>';
  st.svg=host.querySelector("svg"); st.numEls=[].slice.call(st.svg.querySelectorAll(".sn-num, .sn-railtxt")); st.numPx=0;
  return st.svg;
}
function gridLines(){ var d=""; for(var i=1;i<10;i++) d+="M"+i*100+" 0V1000M0 "+i*100+"H1000"; return '<path d="'+d+'" stroke="#0b0a12" stroke-opacity=".45" stroke-width="2"/><rect x="1" y="1" width="998" height="998" fill="none" stroke="#e7ca90" stroke-opacity=".5" stroke-width="2"/>'; }

/* the square numbers stay at or above the text floor (phone 12 px, TV 21 px of the 1080p frame) at any board size: unitsPx = screen px per unit */
function numbers(unitPx,floorPx){
  if(!st.svg||!unitPx) return;
  var fs=Math.max(24,Math.ceil((floorPx+.4)/unitPx));
  if(fs===st.numPx) return; st.numPx=fs;
  st.numEls.forEach(function(t){
    var rail=t.classList.contains("sn-railtxt");
    t.setAttribute("font-size",rail?Math.max(30,fs):fs);
    if(rail) t.textContent=fs>38?"Start":"Start: off the board";   // a small board: the short word keeps the text floor
    if(!rail){ var c=cell(+t.textContent); t.setAttribute("y",String(c.y-50+fs*.92)); t.setAttribute("x",String(c.x-50+7)); }
    else t.setAttribute("y",String(RAIL+35+Math.max(0,fs-30)*.35));
  });
}

/* the ladder or snake lights up while it fires (opacity only, one shot); a snake also shivers its head */
function glow(at,ms){
  if(!st.svg) return null;
  var g0=st.svg.querySelector('[data-head="'+at+'"]')||st.svg.querySelector('[data-foot="'+at+'"]'); if(!g0) return null;
  var gl=g0.querySelector(".sn-glow"); if(!gl||!gl.animate) return null;
  try{ gl.animate([{opacity:0},{opacity:.9,offset:.2},{opacity:.65,offset:.75},{opacity:0}],{duration:ms,easing:"ease-out"}); }catch(e){}
  var hd=g0.querySelector(".sn-head");
  if(hd){ var base=hd.getAttribute("data-css"); try{ hd.animate([{transform:base},{transform:base+" translate(6px,0)"},{transform:base+" translate(-4px,0)"},{transform:base+" translate(5px,0)"},{transform:base}],{duration:Math.min(700,ms*.5)}); }catch(e){} }
  return true;
}
/* a snake head within one roll of the player whose turn it is: three soft red pulses (finite; the page skips it under reduced effects) */
function warn(heads){
  if(!st.svg) return;
  heads.forEach(function(h){ var c=st.svg.querySelector('[data-head="'+h+'"] .sn-warn'); if(!c||!c.animate) return;
    try{ c.animate([{opacity:0},{opacity:.85,offset:.3},{opacity:0}],{duration:1100,iterations:3,easing:"ease-in-out"}); }catch(e){} });
}
function crest(ms){ var c=st.svg&&st.svg.querySelector(".sn-crestfx"); if(!c||!c.animate) return; var c0=cell(100);
  c.setAttribute("transform","translate("+(c0.x-50)+" "+(c0.y-50)+")");
  try{ c.animate([{opacity:0},{opacity:1,offset:.25},{opacity:0}],{duration:ms,easing:"ease-out"}); }catch(e){} }
function snakePts(head){ var s=st.snakes[head]; return s?s.pts:null; }
function rungs(foot){ var l=st.ladders[foot]; return l?l.mids:null; }

/* the American spinner (original art): a dial in six jewel wedges numbered 1-6 and a gold arrow; the arrow turns to the spin */
function spinnerSVG(){
  var cols=["#4b1730","#16305e","#123f36","#4a3412","#2e1c52","#0f3d44"], w="", t="", i;
  for(i=0;i<6;i++){
    var a0=(i*60-30-90)*Math.PI/180, a1=(i*60+30-90)*Math.PI/180, am=(i*60-90)*Math.PI/180;
    w+='<path d="M50 50L'+f1(50+46*Math.cos(a0))+" "+f1(50+46*Math.sin(a0))+"A46 46 0 0 1 "+f1(50+46*Math.cos(a1))+" "+f1(50+46*Math.sin(a1))+'Z" fill="'+cols[i]+'" stroke="#e7ca90" stroke-opacity=".6" stroke-width="1"/>';
    t+='<text x="'+f1(50+33*Math.cos(am))+'" y="'+f1(50+33*Math.sin(am))+'">'+(i+1)+"</text>";
  }
  return '<svg class="sn-spin" viewBox="0 0 100 100" aria-hidden="true" focusable="false"><circle cx="50" cy="50" r="49" fill="#0b0a12" stroke="#e7ca90" stroke-width="2"/>'+w+
    '<g class="sn-spin__nums">'+t+'</g><g class="sn-arrow"><path d="M50 13L56 50L50 58L44 50Z" fill="#f3d98f" stroke="#5a3a10" stroke-width="1.2"/><circle cx="50" cy="50" r="6.5" fill="#e2bd72" stroke="#5a3a10" stroke-width="1.2"/></g></svg>';
}

S.Board={W:W,H:H,RAIL:RAIL,PAL:PAL,cell:cell,centre:centre,startSlot:startSlot,build:build,numbers:numbers,glow:glow,warn:warn,crest:crest,snakePts:snakePts,rungs:rungs,spinnerSVG:spinnerSVG,
  state:function(){ return st; }};
})(window);
