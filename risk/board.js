/* RISK - map renderer (step 5): the real world map. Used by the phone game (risk/index.html), the Party Mode TV and the Party phones.
   Needs map.js (it carries Risk.MAP.geo, the 42 territories as real regions).
   Map data: Natural Earth (public domain), 1:50m admin-0 countries and admin-1 states / provinces, simplified and projected (Miller, stretched
   north-south to the board's 5:3 frame) by the build scripts; each classic territory is a union of real countries and subdivisions
   (see BG_audit/step5/risk/TERRITORIES.md).
   - ONE static SVG, drawn once: the deep navy sea with a graticule, the 42 territories (one path each, continent colours), their borders,
     the sea links (dashed gold; Alaska - Kamchatka leaves one edge and enters the other), the continent bonus medals, the sea art (a whale,
     a ship, dolphins in gold line art) and every name: inside its land when it fits, else beside it over the sea (touching its coast, or
     with a cased leader ending in a dot on its land), each line at its natural width (map.js GEO.lab, laid out by the step-5 review).
   - Names on a small board (the phone): once zoomed in, each name is drawn at least 12 px, growing away from its badge; a name that would
     touch another name, a badge, a medal, the frame's edge or the Fit button waits for more zoom (worked out when a gesture ends).
     Owner tint / outline and the selected / source / target marks are small <use> elements that only change when a territory changes.
   - Army badges (the owner's Luxe seat colour) sit on the pole of inaccessibility of each territory, one group per territory.
   - Zoom: one transform on .rkview (pinch, wheel, double tap on the sea or a territory with nothing to do, one-finger pan, the Fit button
     in the frame); the layer is promoted only while a gesture runs, so it is re-rastered crisp at rest.
   - Touch: a tap hits the territory under the finger (a coarse grid of the map, plus a generous reach round small islands); a long press
     inspects any territory without acting (opts.onInspect / board.onInspect); setInspect(t) outlines the territory a card is naming.
   API (unchanged): create(container,{labels,tint,focusable,pulseLayer,static,onTap}) -> setView, setMarks, flash, setTint, setLabels, centerOf,
   zoomAt, fit, focus, scale, terrAt, onTap, onInspect, simulateTap, setFocusable, root, svg. Also silhouette(t), piecesSVG, cubeSVG, oblongSVG. */
(function(g){
"use strict";
var Risk=g.Risk=g.Risk||{}, MP=Risk.MAP, GEO=MP&&MP.geo;
var SVGNS="http://www.w3.org/2000/svg", BR=12.5, uid=0;

/* the board colours -> the Luxe seat colours (ui/theme.css --seat-N, -hi, -lo); hex here so the Party pages need no theme */
var SEATS={
  Red:{c:"#ff5d73",hi:"#ffa1ae",lo:"#802f3a"}, Blue:{c:"#5f95ff",hi:"#a2c2ff",lo:"#304b80"}, Green:{c:"#3fd391",hi:"#90e5bf",lo:"#206a49"},
  Yellow:{c:"#ffcb4f",hi:"#ffe199",lo:"#806628"}, Black:{c:"#c4c8d8",hi:"#dddfe8",lo:"#62646c"}, Pink:{c:"#ff7fcb",hi:"#ffb5e1",lo:"#804066"},
  Neutral:{c:"#c9915a",hi:"#e0bf9f",lo:"#65492d"}
};
function seatOf(pc,hex){ if(pc&&SEATS[pc.name]) return SEATS[pc.name]; return {c:hex||"#c9915a",hi:"#e8e8e8",lo:"#444"}; }
function hexRGB(h){ return [parseInt(h.substr(1,2),16),parseInt(h.substr(3,2),16),parseInt(h.substr(5,2),16)]; }
function shade(h,k){ var r=hexRGB(h); function f(v){ return Math.max(0,Math.min(255,Math.round(k<1?v*k:v+(255-v)*(k-1)))); } return "rgb("+f(r[0])+","+f(r[1])+","+f(r[2])+")"; }
function esc(s){ return String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/"/g,"&quot;"); }
function el(n,a,p){ var e=document.createElementNS(SVGNS,n); if(a) for(var k in a) e.setAttribute(k,a[k]); if(p) p.appendChild(e); return e; }

/* ---- the hit grid (4 units): which territory is under a map point ---- */
var AL="ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnop", grid=null;
function hitGrid(){
  if(grid||!GEO) return grid; var h=GEO.hit, a=new Uint8Array(h.w*h.h).fill(255), rows=h.rle.split("|"), y, i;
  for(y=0;y<h.h;y++){ var s=rows[y]||"", x=0, m, re=/([A-Za-z.])(\d*)/g; while((m=re.exec(s))){ var n=m[2]?+m[2]:1, v=m[1]==="."?255:AL.indexOf(m[1]); for(i=0;i<n&&x<h.w;i++) a[y*h.w+(x++)]=v; } }
  grid={a:a,w:h.w,h:h.h,c:h.c}; return grid;
}
function terrAtPoint(ux,uy,reach){
  var G=hitGrid(); if(!G) return null; var cx=Math.floor(ux/G.c), cy=Math.floor(uy/G.c); if(cx<0||cy<0||cx>=G.w||cy>=G.h) return null;
  var v=G.a[cy*G.w+cx]; if(v!==255) return v;
  var R=Math.ceil((reach==null?12:reach)/G.c), best=null, bd=1e9, dx, dy;   // near a coast: the nearest land within reach, so a small island is easy to hit
  for(dy=-R;dy<=R;dy++) for(dx=-R;dx<=R;dx++){ var x=cx+dx, y=cy+dy; if(x<0||y<0||x>=G.w||y>=G.h) continue; var u=G.a[y*G.w+x]; if(u===255) continue; var d=dx*dx+dy*dy; if(d<bd){ bd=d; best=u; } }
  return best;
}

/* ---- pieces kept from the first board: the Party tile picture uses cubeSVG ---- */
function cubeSVG(x,y,col){
  return '<g transform="translate('+x+','+y+')" stroke="rgba(0,0,0,.45)" stroke-width=".7" stroke-linejoin="round">'+
    '<polygon points="-7,-10.5 0,-7 0,0 -7,-3.5" fill="'+col.c+'"/><polygon points="7,-10.5 0,-7 0,0 7,-3.5" fill="'+col.d+'"/><polygon points="0,-14 7,-10.5 0,-7 -7,-10.5" fill="'+col.l+'"/></g>';
}
function oblongSVG(x,y,col){
  return '<g transform="translate('+x+','+y+')" stroke="rgba(0,0,0,.5)" stroke-width=".7" stroke-linejoin="round">'+
    '<path d="M-13,-3 L-13,-7 Q-13,-12 -8,-12 L8,-12 Q13,-12 13,-7 L13,-3 Q13,0 9,0 L-9,0 Q-13,0 -13,-3Z" fill="'+col.c+'"/>'+
    '<path d="M-12.5,-7 Q-12.5,-11.4 -8,-11.4 L8,-11.4 Q12.5,-11.4 12.5,-7 L12.5,-6 L-12.5,-6Z" fill="'+col.l+'" stroke="none"/>'+
    '<path d="M-12.6,-2 L12.6,-2 L12.2,-1.4 Q12,-.2 9,-.2 L-9,-.2 Q-12,-.2 -12.2,-1.4Z" fill="'+col.d+'" stroke="none"/></g>';
}
function piecesSVG(n,col){
  var obl=Math.floor(n/10), cub=n%10, s="", i; if(obl>6) obl=6; var cy=16, rows=[[4,-21,0],[3,-14,-7],[2,-7,-14]], left=cub, placed=[];
  rows.forEach(function(r){ var k=Math.min(left,r[0]); left-=k; var x0=-(k-1)*7; for(i=0;i<k;i++) placed.push([x0+i*14,r[2]]); });
  placed.sort(function(a,b){ return a[1]-b[1]; });
  var obY=cy-(cub>6?27:cub>4?20:cub>0?13:3);
  for(i=0;i<obl;i++){ var rowN=Math.floor(i/2), inRow=Math.min(2,obl-rowN*2), idx=i%2, ox=(inRow===1?0:(idx?15:-15)); s+=oblongSVG(ox,obY-rowN*11-0,col); }
  placed.forEach(function(p){ s+=cubeSVG(p[0],cy+p[1],col); });
  return s;
}

/* ---- the territory silhouette for the cards (an SVG picture of the real region) ---- */
var silCache={};
function silhouette(t){
  if(silCache[t]!==undefined) return silCache[t]; if(!GEO||!GEO.t[t]){ silCache[t]=""; return ""; }
  var b=GEO.sb[t], pad=1.5, w=b[2]-b[0]+2*pad, h=b[3]-b[1]+2*pad;
  var svg='<svg xmlns="http://www.w3.org/2000/svg" viewBox="'+(b[0]-pad)+' '+(b[1]-pad)+' '+w+' '+h+'" width="'+Math.round(w*4)+'" height="'+Math.round(h*4)+'"><path d="'+GEO.t[t]+'" fill="#111" fill-rule="evenodd"/></svg>';
  return (silCache[t]="data:image/svg+xml;charset=utf-8,"+encodeURIComponent(svg));
}

/* ---- the static map: built once per board ---- */
function buildStatic(svg,P){
  var G=GEO, i, defs=el("defs",null,svg), CONT=MP.continents;
  // sea + graticule
  var sg=el("radialGradient",{id:P+"sea",cx:".5",cy:".45",r:".75"},defs); el("stop",{offset:"0","stop-color":"#14275a"},sg); el("stop",{offset:"1","stop-color":"#091330"},sg);
  el("rect",{width:G.W,height:G.H,fill:"url(#"+P+"sea)"},svg);
  el("path",{d:G.gr,fill:"none",stroke:"#aebfff","stroke-opacity":".10","stroke-width":".5"},svg);
  el("path",{d:G.eq,fill:"none",stroke:"#e7ca90","stroke-opacity":".16","stroke-width":".6","stroke-dasharray":"3 4"},svg);
  // territory shapes (defs) and one gradient per continent
  CONT.forEach(function(c,ci){ var x0=1e9,y0=1e9,x1=-1e9,y1=-1e9; c.terrs.forEach(function(t){ var b=G.bb[t]; x0=Math.min(x0,b[0]); y0=Math.min(y0,b[1]); x1=Math.max(x1,b[2]); y1=Math.max(y1,b[3]); });
    var lg=el("linearGradient",{id:P+"c"+ci,gradientUnits:"userSpaceOnUse",x1:0,y1:y0,x2:0,y2:y1},defs); el("stop",{offset:"0","stop-color":shade(c.color,1.14)},lg); el("stop",{offset:".55","stop-color":c.color},lg); el("stop",{offset:"1","stop-color":shade(c.color,.8)},lg); });
  for(i=0;i<MP.n;i++) el("path",{id:P+"p"+i,d:G.t[i],"fill-rule":"evenodd"},defs);
  var u=function(parent,i,a){ a.href="#"+P+"p"+i; return el("use",a,parent); };
  var glow=el("g",{"stroke-linejoin":"round",fill:"none"},svg);   // a soft shelf round every coast (the inner halves are covered by the fills)
  for(i=0;i<MP.n;i++){ u(glow,i,{stroke:"#7ea4ff","stroke-opacity":".10","stroke-width":"9"}); u(glow,i,{stroke:"#9db9ff","stroke-opacity":".16","stroke-width":"4.2"}); }
  var land=el("g",{class:"rkland","stroke-linejoin":"round"},svg), fills=[];
  for(i=0;i<MP.n;i++){ var ci=MP.cont[i]; fills.push(u(land,i,{"data-t":i,fill:"url(#"+P+"c"+ci+")",stroke:shade(CONT[ci].color,.38),"stroke-width":".7"})); }
  var own=el("g",{class:"rkown","pointer-events":"none","stroke-linejoin":"round"},svg), ownU=[];
  for(i=0;i<MP.n;i++) ownU.push(u(own,i,{display:"none"}));
  var markG=el("g",{class:"rkmarks","pointer-events":"none","stroke-linejoin":"round"},svg);
  // sea links: dashed gold with a dark casing; Alaska - Kamchatka leaves one edge and enters the other
  var sea=el("g",{class:"rksea","fill":"none","stroke-linecap":"round"},svg);
  function link(x1,y1,x2,y2,arrow){ var d="M"+x1+" "+y1+"L"+x2+" "+y2; el("path",{d:d,stroke:"#080a15","stroke-opacity":".7","stroke-width":"3.4"},sea); el("path",{d:d,stroke:"#e7ca90","stroke-width":"1.7","stroke-dasharray":"5 3.6"},sea); }
  G.sea.forEach(function(s){ link(s.p[0],s.p[1],s.p[2],s.p[3]); });
  link(G.wrap.left[0],G.wrap.left[1],0,G.wrap.left[1]-3); link(G.wrap.right[0],G.wrap.right[1],G.W,G.wrap.right[1]+3);
  [[3,G.wrap.left[1]-3,1],[G.W-3,G.wrap.right[1]+3,-1]].forEach(function(a){ el("path",{d:"M"+(a[0]+a[2]*7)+" "+(a[1]-5)+"L"+a[0]+" "+a[1]+"L"+(a[0]+a[2]*7)+" "+(a[1]+5),stroke:"#e7ca90","stroke-width":"1.7","stroke-linejoin":"round",fill:"none"},sea); });
  // ocean names, the compass, the continent bonus medals
  var oc=el("g",{class:"rkocean","pointer-events":"none"},svg);
  G.oceans.forEach(function(o){ var t=el("text",{x:0,y:0,"text-anchor":"middle",class:"rkocn","font-size":o.fs,transform:"translate("+o.x+","+o.y+") rotate("+o.rot+")"},oc); t.textContent=o.t; });
  var cp=el("g",{transform:"translate("+G.compass.x+","+G.compass.y+")",stroke:"#e7ca90","stroke-opacity":".5",fill:"none","stroke-width":".9"},oc);
  el("circle",{r:20},cp); el("circle",{r:15,"stroke-opacity":".5"},cp); el("path",{d:"M0-27V27M-27 0H27",}, cp); el("path",{d:"M0-27L4-4L27 0L4 4L0 27L-4 4L-27 0L-4-4Z",fill:"#e7ca90","fill-opacity":".18"},cp); var nn=el("text",{y:-31,"text-anchor":"middle",class:"rkocn","font-size":8,fill:"#e7ca90","stroke":"none"},cp); nn.textContent="N";
  // the sea art of the step-4 board (a whale, a three-masted ship, two dolphins), redrawn as gold line art like the compass: static, in open sea
  var orn=el("g",{class:"rkorn",stroke:"#e7ca90","stroke-opacity":".42",fill:"#e7ca90","fill-opacity":".07","stroke-width":".9","stroke-linejoin":"round","stroke-linecap":"round"},oc), WAVES="q5 -3 10 0t10 0t10 0t10 0t10 0t10 0";
  var wh=el("g",{transform:"translate(72,252)"},orn);
  el("path",{d:"M-18 2C-16-9 2-13 14-6C19-3 21 1 20 4C12 9-6 10-18 2Z"},wh); el("path",{d:"M-18 2C-21 0-24-4-26-8C-27-4-26-1-24 1C-27 3-30 6-31 9C-26 8-22 5-18 3",fill:"none"},wh);
  el("path",{d:"M-12 5C-2 7 8 6 17 3M13-8C12-13 9-15 6-18M13-8C14-13 17-15 20-18M13-8V-17",fill:"none"},wh); el("circle",{cx:14,cy:-1,r:".9","fill-opacity":".6"},wh); el("path",{d:"M-30 12"+WAVES,fill:"none"},wh);
  var sh=el("g",{transform:"translate(650,556)"},orn), sail=function(x,a,b,w){ return "M"+(x-w)+" "+a+"Q"+x+" "+(a+3)+" "+(x+w)+" "+a+"L"+(x+w)+" "+b+"Q"+x+" "+(b+3)+" "+(x-w)+" "+b+"Z"; };
  el("path",{d:"M-22 4L23 4L18 13L-17 13ZM-22 4V0H-13V4"},sh); el("path",{d:"M-9 4V-25M2 4V-29M12 4V-22M23 3L31-3",fill:"none"},sh);
  el("path",{d:sail(-9,-21,-4,7)+sail(2,-25,-4,8)+sail(12,-18,-4,6)+"M30-2L13-19L20 1ZM2-29L10-27L2-25"},sh); el("path",{d:"M-30 17"+WAVES,fill:"none"},sh);
  var dol=el("g",{transform:"translate(405,552)"},orn), dolphin=function(x,y,k){ var g3=el("g",{transform:"translate("+x+","+y+") scale("+k+")"},dol);
    el("path",{d:"M-12 4C-9-7 5-10 13-2L14-1L12-1C6-5-4-3-9 5ZM0-7L3-11L4-6"},g3); el("path",{d:"M-12 4L-16 2M-12 4L-14 8",fill:"none"},g3); };
  dolphin(-8,-2,1); dolphin(14,3,.8); el("path",{d:"M-30 10"+WAVES,fill:"none"},dol);
  var med=el("g",{class:"rkmedals"},svg);
  G.medals.forEach(function(m){ var c=CONT[m.c], gg=el("g",{transform:"translate("+m.x+","+m.y+")"},med); el("circle",{r:15,fill:"#080a15","fill-opacity":".55"},gg); el("circle",{r:13,fill:c.color,stroke:"#e7ca90","stroke-width":"2"},gg);
    var t=el("text",{y:5,"text-anchor":"middle",class:"rkmed","font-size":14},gg); t.textContent="+"+c.bonus; var ti=el("title",null,gg); ti.textContent=c.name+": +"+c.bonus+" armies for holding it all"; });
  // names (review, step 5): one group per territory (data-t), the capital-letter block centred on nx,ny (1.0 em line pitch), each line at
  // its natural Manrope width (textLength = that width, so a fallback font is fitted, never squeezed); a name beside its land in the sea
  // has a cased leader ending in a dot on that land
  var names=el("g",{class:"rklabels","pointer-events":"none"},svg), labG=[];
  G.lab.forEach(function(l){
    var g2=el("g",{"data-t":l.t},names);
    if(l.lead){ var d="M"+l.lead[0]+" "+l.lead[1]+"L"+l.lead[2]+" "+l.lead[3];
      el("path",{d:d,stroke:"#060918","stroke-opacity":".8","stroke-width":"2.4","stroke-linecap":"round",fill:"none"},g2);
      el("path",{d:d,stroke:"#fff3d1","stroke-width":"1",fill:"none"},g2);
      el("circle",{cx:l.lead[2],cy:l.lead[3],r:"2.2",fill:"#fff3d1",stroke:"#060918","stroke-width":"1"},g2); }
    var t=el("text",{class:"rkname","text-anchor":"middle","font-size":l.fs,"stroke-width":(l.fs*.2).toFixed(2)},g2), top=l.ny-l.h/2;
    l.lines.forEach(function(ln,k){ var ts=el("tspan",{x:l.nx,y:(top+l.fs*.72+k*l.fs).toFixed(2),textLength:l.lw[k],lengthAdjust:"spacingAndGlyphs"},t); ts.textContent=ln; });
    labG[l.t]=g2;
  });
  return {fills:fills,own:ownU,marks:markG,sea:sea,names:names,labG:labG,P:P};
}

/* ---- the board object ---- */
function create(container,opts){
  opts=opts||{};
  var self={opts:opts}, V=null, marks={sel:null,src:{},tgt:{},hot:{},mine:{}}, labelsMode=opts.labels||"auto", P="rk"+(++uid)+"-";
  var scale=1,tx=0,ty=0, tint=!!opts.tint, tapFn=opts.onTap||null, inspectFn=opts.onInspect||null, flashT={};
  /* opts.focusable (the single-device page on TV): every territory is a D-pad stop (data-focus; "look" for the ones nothing can be done on,
     so the page's own focus rules still see only the actionable ones); OK taps it. One ring group above the pieces shows the focus. */
  var focusOn=!!opts.focusable, ringLayer=null, ringT=-1;
  /* opts.pulseLayer: the pulsing marks are drawn on ONE overlay under the pieces, which the page pulses as a whole by opacity */
  var pulseOn=!!opts.pulseLayer, psvg=null;
  container.innerHTML="";
  var root=document.createElement("div"); root.className="rkroot"; root.setAttribute("role","group"); root.setAttribute("aria-label","World map of the 42 territories");
  var view=document.createElement("div"); view.className="rkview";
  var map=el("svg",{viewBox:"0 0 "+MP.W+" "+MP.H,class:"rksvg rkmap",preserveAspectRatio:"xMidYMid meet","aria-hidden":"true"}); map.style.pointerEvents="none";
  var svg=el("svg",{viewBox:"0 0 "+MP.W+" "+MP.H,class:"rksvg rkpcsvg",preserveAspectRatio:"xMidYMid meet"});
  injectCSS();
  view.appendChild(map);
  var S=buildStatic(map,P);
  if(pulseOn){ psvg=el("svg",{viewBox:"0 0 "+MP.W+" "+MP.H,class:"rksvg rkpulsel",preserveAspectRatio:"xMidYMid meet","aria-hidden":"true"}); psvg.style.display="none"; psvg.style.pointerEvents="none"; view.appendChild(psvg); }
  view.appendChild(svg); root.appendChild(view); container.appendChild(root);
  var defs=el("defs",null,svg);
  Object.keys(SEATS).forEach(function(k){ var s=SEATS[k], gr=el("radialGradient",{id:P+"s"+k,cx:".35",cy:".3",r:".85"},defs); el("stop",{offset:"0","stop-color":s.hi},gr); el("stop",{offset:".5","stop-color":s.c},gr); el("stop",{offset:"1","stop-color":s.lo},gr); });
  var pieceLayer=el("g",{class:"rkpieces"},svg), groups=[], keyCache=[], i;
  for(i=0;i<MP.n;i++){ var gg=el("g",{class:"tg","data-t":i,transform:"translate("+MP.x[i]+","+MP.y[i]+")"},pieceLayer); groups.push(gg); }

  function useOf(t,a){ var u=document.createElementNS(SVGNS,"use"); u.setAttribute("href","#"+P+"p"+t); for(var k in a) u.setAttribute(k,a[k]); return u; }
  function seatFor(o){ var pc=V&&V.pcol&&V.pcol[o]; return seatOf(pc,V&&V.colors&&V.colors[o]); }
  function actionable(t){ return marks.sel===t||!!marks.src[t]||!!marks.tgt[t]||!!marks.hot[t]||!!marks.mine[t]; }
  function hitR(t){ return focusOn?29:(MP.geo.lab[t].r<14?20:15); }
  function focusAttrs(t,gg,a){
    if(focusOn){ var act=actionable(t); gg.setAttribute("data-focus",act?"":"look"); gg.setAttribute("tabindex","-1"); gg.setAttribute("role","button");
      var o=V&&V.terr[t]?(V.terr[t].o!==undefined?V.terr[t].o:V.terr[t][0]):-1;
      gg.setAttribute("aria-label",MP.names[t]+(a>0?", "+a+" "+(a===1?"army":"armies"):"")+(o<0?", empty":"")); if(act) gg.setAttribute("data-act",""); else gg.removeAttribute("data-act"); }
    else if(gg.hasAttribute("data-focus")){ gg.removeAttribute("data-focus"); gg.removeAttribute("data-act"); gg.removeAttribute("tabindex"); gg.removeAttribute("role"); gg.removeAttribute("aria-label"); }
  }
  function drawGroup(t){
    var st=V&&V.terr[t], gg=groups[t]; if(!st){ gg.innerHTML=""; keyCache[t]=null; return; }
    var o=st.o!==undefined?st.o:st[0], a=st.a!==undefined?st.a:st[1];
    focusAttrs(t,gg,a);
    var seat=o>=0?seatFor(o):null, sn=o>=0&&V.pcol&&V.pcol[o]&&SEATS[V.pcol[o].name]?V.pcol[o].name:null;
    var key=o+"/"+a+"/"+focusOn+"/"+hitR(t)+"/"+(flashT[t]||"")+"/"+(seat?seat.c:"");
    if(keyCache[t]===key) return; keyCache[t]=key;
    var h='<circle class="hit" r="'+hitR(t)+'" fill="transparent"/>';
    if(flashT[t]) h+='<circle class="rkflash" r="'+(BR+8)+'" fill="none" stroke="'+(flashT[t]==="lose"?"#ff5a4a":"#fff")+'" stroke-width="3"/>';
    if(a>0&&o>=0){
      var nd=String(a).length, fs=nd>=4?8.5:nd===3?10.5:14, rr=nd>=4?BR+3:nd===3?BR+1:BR, fill=sn?"url(#"+P+"s"+sn+")":seat.c;
      h+='<ellipse cx=".8" cy="2.2" rx="'+rr+'" ry="'+(rr*.92)+'" fill="#000" opacity=".32"/>'+
         '<circle r="'+rr+'" fill="'+fill+'" stroke="#080a15" stroke-width="1.7"/><circle r="'+(rr-2.4)+'" fill="none" stroke="#fff" stroke-opacity=".5" stroke-width=".8"/>'+
         '<text y="'+(fs*.36)+'" text-anchor="middle" class="rknum" font-size="'+fs+'">'+a+'</text>';
    }
    gg.innerHTML=h;
  }
  /* owner tint / outline under the names, and the marks */
  function paintOwn(){
    for(var t=0;t<MP.n;t++){ var u=S.own[t], st=V&&V.terr[t], o=st?(st.o!==undefined?st.o:st[0]):-1;
      if(o<0){ u.setAttribute("display","none"); continue; } var c=seatFor(o).c;
      u.removeAttribute("display"); u.setAttribute("fill",c); u.setAttribute("fill-opacity",tint?".34":".07"); u.setAttribute("stroke",c); u.setAttribute("stroke-width",tint?"1.5":"1.2"); u.setAttribute("stroke-opacity",tint?".95":".8"); }
  }
  function ringPos(t){ return [MP.x[t],MP.y[t]]; }
  function arrow(a,b,col){   // a gold arrow between two badges (the attack or the move in hand)
    var A=ringPos(a), B=ringPos(b), dx=B[0]-A[0], dy=B[1]-A[1], L=Math.hypot(dx,dy)||1, ux=dx/L, uy=dy/L, s=BR+4, x1=A[0]+ux*s, y1=A[1]+uy*s, x2=B[0]-ux*(s+3), y2=B[1]-uy*(s+3);
    if(L<2*s+8) return "";
    var hx=x2-ux*9, hy=y2-uy*9, nx=-uy*5, ny=ux*5, ar='M'+x1.toFixed(1)+' '+y1.toFixed(1)+'L'+hx.toFixed(1)+' '+hy.toFixed(1), hd='M'+x2.toFixed(1)+' '+y2.toFixed(1)+'L'+(hx+nx).toFixed(1)+' '+(hy+ny).toFixed(1)+'L'+(hx-nx).toFixed(1)+' '+(hy-ny).toFixed(1)+'Z';
    return '<path d="'+ar+'" stroke="#080a15" stroke-opacity=".75" stroke-width="5" stroke-linecap="round" fill="none"/><path d="'+hd+'" fill="#080a15" fill-opacity=".75" stroke="#080a15" stroke-opacity=".75" stroke-width="3" stroke-linejoin="round"/>'+
      '<path d="'+ar+'" stroke="'+col+'" stroke-width="2.4" stroke-linecap="round" fill="none"/><path d="'+hd+'" fill="'+col+'"/>';
  }
  function useStr(t,a){ var s='<use href="#'+P+'p'+t+'"'; for(var k in a) s+=' '+k+'="'+a[k]+'"'; return s+'/>'; }
  function paintMarks(){
    var h="", ph="", t, pcls=pulseOn?"":' class="rkpulse"', sel=marks.sel;
    for(t in marks.mine) if(marks.mine[t]&&+t!==sel){   // yours to pick: the territory lit, and the soft glow in your seat colour round its badge (as the step-4 board had)
      var st=V&&V.terr[+t], ow=st?(st.o!==undefined?st.o:st[0]):-1;
      h+=useStr(+t,{fill:"#fff","fill-opacity":".13",stroke:"#fff3d1","stroke-opacity":".35","stroke-width":"1.1"})+'<circle cx="'+MP.x[t]+'" cy="'+MP.y[t]+'" r="25" fill="'+(ow>=0?seatFor(ow).hi:"#fff3d1")+'" fill-opacity=".3"/>'; }
    var tg=Object.keys(marks.tgt).filter(function(k){ return marks.tgt[k]; }), sr=Object.keys(marks.src).filter(function(k){ return marks.src[k]; });
    if(sel!=null){ h+=useStr(sel,{fill:"#fff3d1","fill-opacity":".24",stroke:"#ffd23f","stroke-width":"3"}); if(tg.length===1) h+=arrow(sel,+tg[0],"#ffd23f"); else if(!tg.length&&sr.length===1&&+sr[0]!==sel) h+=arrow(+sr[0],sel,"#ffe27a"); }
    for(t in marks.src) if(marks.src[t]) ph+=useStr(+t,{fill:"#ffe27a","fill-opacity":".12",stroke:"#ffe27a","stroke-width":"3"})+'<circle cx="'+MP.x[t]+'" cy="'+MP.y[t]+'" r="'+(BR+6)+'" fill="none" stroke="#ffe27a" stroke-width="3"/>';
    for(t in marks.tgt) if(marks.tgt[t]) ph+=useStr(+t,{fill:"#ff3b2a","fill-opacity":".30",stroke:"#ff3b2a","stroke-width":"3","stroke-dasharray":"6 3.5"})+'<circle cx="'+MP.x[t]+'" cy="'+MP.y[t]+'" r="'+(BR+6)+'" fill="rgba(255,60,40,.22)" stroke="#ff3b2a" stroke-width="3" stroke-dasharray="6 3.5"/>';
    for(t in marks.hot) if(marks.hot[t]) ph+=useStr(+t,{fill:"#fff","fill-opacity":".16",stroke:"#fff","stroke-width":"2.4"})+'<circle cx="'+MP.x[t]+'" cy="'+MP.y[t]+'" r="'+(BR+6)+'" fill="none" stroke="#fff" stroke-width="3"/>';
    for(t in flashT) if(flashT[t]) h+=useStr(+t,{fill:flashT[t]==="lose"?"#ff5a4a":"#fff","fill-opacity":".5",class:"rkfl"});
    S.marks.innerHTML=h+(pulseOn?"":'<g'+pcls+'>'+ph+'</g>');
    if(pulseOn){ var pg=psvg._g; if(!pg){ pg=psvg._g=el("g",{"stroke-linejoin":"round"},psvg); } pg.innerHTML=ph; fitPulse(); }
  }
  // the pulse overlay is only as big as the marked territories (a small layer to blend on each beat), gone when nothing pulses
  var pulseBox="";
  function fitPulse(){
    if(!psvg) return; var x0=1e9,y0=1e9,x1=-1e9,y1=-1e9, any=false, t;
    function add(k){ for(t in k){ if(!k[t]) continue; any=true; var b=MP.geo.bb[t]; x0=Math.min(x0,b[0]-4,MP.x[t]-BR-9); y0=Math.min(y0,b[1]-4,MP.y[t]-BR-9); x1=Math.max(x1,b[2]+4,MP.x[t]+BR+9); y1=Math.max(y1,b[3]+4,MP.y[t]+BR+9); } }
    add(marks.src); add(marks.tgt); add(marks.hot);
    var box=any?[Math.max(0,x0),Math.max(0,y0),Math.min(MP.W,x1)-Math.max(0,x0),Math.min(MP.H,y1)-Math.max(0,y0)].map(function(v){ return Math.round(v); }).join(" "):"";
    if(box===pulseBox) return; pulseBox=box;
    if(!box){ psvg.style.display="none"; return; }
    var b=box.split(" ").map(Number); psvg.setAttribute("viewBox",box); psvg.style.display="";
    psvg.style.left=(b[0]/MP.W*100)+"%"; psvg.style.top=(b[1]/MP.H*100)+"%"; psvg.style.width=(b[2]/MP.W*100)+"%"; psvg.style.height=(b[3]/MP.H*100)+"%";
  }
  function drawAll(){ for(var t=0;t<MP.n;t++) drawGroup(t); paintOwn(); paintMarks(); applyLabels(); }
  /* names on a small board (the phone, zoomed in): each name is drawn at least NAMEPX on screen, growing away from its own badge (or its
     leader), and a name that would then touch a placed name, any badge, a medal or the map's edge waits until the zoom gives it room.
     Worked out once per zoom level (never per frame of a gesture); the TV and the Party TV board show every name as laid out */
  var NAMEPX=12, nameK=-1, nameBox=[], nameOn=[], BRIM=14.6;
  function nameLayout(k){
    if(Math.abs(k-nameK)<1e-4) return; nameK=k;
    var G=GEO, order=G.lab.map(function(l){ return l.t; }).sort(function(a,b){ return G.lab[b].fs-G.lab[a].fs||a-b; }), done=[], i, u;
    var fixed=(focusOn||opts.static||labelsMode!=="auto");
    order.forEach(function(t){
      var l=G.lab[t], pad=l.fs*.12+.4, top=l.ny-l.h/2, b=[l.nx-l.w/2-pad,top-pad,l.nx+l.w/2+pad,top+l.h+pad], f=fixed?1:Math.max(1,Math.min(3.4,NAMEPX/(l.fs*k)));
      var ax=l.lead?l.lead[0]:Math.max(b[0],Math.min(b[2],MP.x[t])), ay=l.lead?l.lead[1]:Math.max(b[1],Math.min(b[3],MP.y[t]));
      var sb=[ax+(b[0]-ax)*f,ay+(b[1]-ay)*f,ax+(b[2]-ax)*f,ay+(b[3]-ay)*f], on=true;
      if(f>1){
        if(sb[0]<0||sb[1]<0||sb[2]>MP.W||sb[3]>MP.H) on=false;
        for(i=0;on&&i<done.length;i++){ var o=done[i]; if(sb[0]<o[2]+1&&sb[2]>o[0]-1&&sb[1]<o[3]+1&&sb[3]>o[1]-1) on=false; }
        for(u=0;on&&u<MP.n;u++){ var dx=Math.max(sb[0]-MP.x[u],0,MP.x[u]-sb[2]), dy=Math.max(sb[1]-MP.y[u],0,MP.y[u]-sb[3]); if(dx*dx+dy*dy<BRIM*BRIM) on=false; }
        for(u=0;on&&u<G.medals.length;u++){ var m=G.medals[u], ex=Math.max(sb[0]-m.x,0,m.x-sb[2]), ey=Math.max(sb[1]-m.y,0,m.y-sb[3]); if(ex*ex+ey*ey<17*17) on=false; }
      }
      if(on) done.push(sb); nameBox[t]=on?sb:null;
      var g2=S.labG[t], tr=f>1?"translate("+ax.toFixed(1)+","+ay.toFixed(1)+") scale("+f.toFixed(3)+") translate("+(-ax).toFixed(1)+","+(-ay).toFixed(1)+")":"";
      if((g2.getAttribute("transform")||"")!==tr){ if(tr) g2.setAttribute("transform",tr); else g2.removeAttribute("transform"); }
    });
  }
  /* zoomed in, a name shows only when it is whole in the frame and clear of the Zoom / Fit button: never a name cut by the frame's edge
     (worked out when a pan or a zoom ends) */
  function nameView(){
    var w=root.clientWidth||600, h=root.clientHeight||w*.6, k=w*scale/MP.W, u0=-tx/k, v0=-ty/k, u1=(w-tx)/k, v1=(h-ty)/k, fb=null, t;
    if(scale>1.001&&fitBtn&&fitBtn.style.display!=="none"){ var rr=root.getBoundingClientRect(), br=fitBtn.getBoundingClientRect(); if(br.width) fb=[(br.left-rr.left-tx)/k-1.5,(br.top-rr.top-ty)/k-1.5,(br.right-rr.left-tx)/k+1.5,(br.bottom-rr.top-ty)/k+1.5]; }
    for(t=0;t<MP.n;t++){ var b=nameBox[t], on=!!b;
      if(on&&scale>1.001){ if(b[0]<u0||b[1]<v0||b[2]>u1||b[3]>v1) on=false; else if(fb&&b[0]<fb[2]&&b[2]>fb[0]&&b[1]<fb[3]&&b[3]>fb[1]) on=false; }
      nameOn[t]=on; var g2=S.labG[t], disp=on?"":"none"; if(g2.style.display!==disp) g2.style.display=disp; }
  }
  function applyLabels(){
    var w=root.clientWidth||600, k=w*scale/MP.W, show=labelsMode==="always"||(labelsMode==="auto"&&k>=0.6);   // names show once the map is at least 0.6 px a unit
    S.names.style.display=show?"":"none"; root.classList.toggle("is-names",show);
    if(show&&!root.classList.contains("is-gesture")){ nameLayout(k); nameView(); }
  }
  if(typeof window!=="undefined") window.addEventListener("resize",function(){ if(root.isConnected) applyLabels(); });
  self.setView=function(v){ V=v; keyCache=[]; drawAll(); };
  self.setMarks=function(m){ marks={sel:m.sel==null?null:m.sel,src:m.src||{},tgt:m.tgt||{},hot:m.hot||{},mine:m.mine||{}}; keyCache=[]; drawAll(); };
  self.flash=function(t,kind,ms){ flashT[t]=kind||"win"; keyCache[t]=null; drawGroup(t); paintMarks(); setTimeout(function(){ delete flashT[t]; keyCache[t]=null; drawGroup(t); paintMarks(); },ms||900); };
  self.setTint=function(b){ tint=!!b; paintOwn(); };
  self.setLabels=function(m){ labelsMode=m; nameK=-1; applyLabels(); };
  self.centerOf=function(t){ return [MP.x[t],MP.y[t]]; };
  self.viewPoint=function(t){ var r=root.getBoundingClientRect(); return r.width?[(tx+MP.x[t]/MP.W*r.width*scale)/r.width,(ty+MP.y[t]/MP.H*r.height*scale)/r.height]:[MP.x[t]/MP.W,MP.y[t]/MP.H]; };   // where the badge is in the window now, as fractions of the map frame (zoom and pan included)

  /* ---- the D-pad focus ring: ONE group above every piece, moved to the focused territory (static strokes, no filter) ---- */
  function showRing(t){
    if(!ringLayer){ ringLayer=el("g",{class:"rkfring","aria-hidden":"true","pointer-events":"none"},svg); }
    if(svg.lastChild!==ringLayer) svg.appendChild(ringLayer);
    if(S.names&&ringLayer.nextSibling!==S.names) svg.appendChild(S.names);   // the names stay readable above the ring and the outline
    ringLayer.innerHTML=useStr(t,{fill:"none",stroke:"#080a15","stroke-width":"4","stroke-linejoin":"round"})+useStr(t,{fill:"none",stroke:"#fff3d1","stroke-width":"2","stroke-linejoin":"round"})+
      '<g transform="translate('+MP.x[t]+','+MP.y[t]+')"><circle r="'+(BR+14)+'" fill="none" stroke="rgba(231,202,144,.45)" stroke-width="5"/><circle r="'+(BR+8.5)+'" fill="none" stroke="#080a15" stroke-width="2.6"/><circle r="'+(BR+11)+'" fill="none" stroke="#fff3d1" stroke-width="3.2"/></g>';
    ringLayer.style.display=""; ringT=t;
  }
  function hideRing(){ if(ringLayer) ringLayer.style.display="none"; ringT=-1; }
  /* the territory a card is describing (a tap or long press on the phone): its outline in ivory over the map, under the names and routes */
  var inspG=null;
  self.setInspect=function(t){
    if(!inspG){ inspG=el("g",{class:"rkinsp","pointer-events":"none","stroke-linejoin":"round"}); map.insertBefore(inspG,S.sea); }
    inspG.innerHTML=(t==null||t<0)?"":useStr(t,{fill:"#fff3d1","fill-opacity":".14",stroke:"#060918","stroke-opacity":".85","stroke-width":"4.2"})+useStr(t,{fill:"none",stroke:"#fff3d1","stroke-width":"2.2"});
  };
  function panTo(t){
    if(scale<=1) return; var r=root.getBoundingClientRect(), p=ringPos(t), x=tx+p[0]/MP.W*r.width*scale, y=ty+p[1]/MP.H*r.height*scale, m=Math.min(r.width,r.height)*0.18;
    if(x>=m&&x<=r.width-m&&y>=m&&y<=r.height-m) return;
    tx=r.width/2-p[0]/MP.W*r.width*scale; ty=r.height/2-p[1]/MP.H*r.height*scale; clamp(); apply();
  }
  self.setFocusable=function(on){ on=!!on; if(on===focusOn) return; focusOn=on; keyCache=[]; nameK=-1; drawAll(); if(!on) hideRing(); if(fitBtn) fitBtn.style.display=on?"none":""; };
  var nav=null, DIRS={up:[0,-1],down:[0,1],left:[-1,0],right:[1,0]};
  function buildNav(){
    nav=[]; var t,u,d;
    for(t=0;t<MP.n;t++){ nav[t]={}; for(d in DIRS){ var ux=DIRS[d][0], uy=DIRS[d][1], best=-1, bs=1e9;
      for(u=0;u<MP.n;u++){ if(u===t) continue; var dx=MP.x[u]-MP.x[t], dy=MP.y[u]-MP.y[t], main=dx*ux+dy*uy; if(main<3) continue; var perp=Math.abs(dx*uy-dy*ux); if(perp>main*1.4) continue; var sc=main+perp*1.6; if(sc<bs){ bs=sc; best=u; } }
      nav[t][d]=best>=0?best:null; } }
    // every territory must be reachable by the arrows alone: a territory nothing points to gets an arrow from its nearest reachable neighbour
    for(var it=0;it<60;it++){
      var seen={0:1}, q=[0], c; while(q.length){ c=q.shift(); for(d in DIRS){ var n=nav[c][d]; if(n!=null&&!seen[n]){ seen[n]=1; q.push(n); } } }
      var miss=[]; for(t=0;t<MP.n;t++) if(!seen[t]) miss.push(t); if(!miss.length) break;
      var bp=null, bd=1e9; miss.forEach(function(m){ for(var v=0;v<MP.n;v++){ if(!seen[v]) continue; var dd=Math.hypot(MP.x[m]-MP.x[v],MP.y[m]-MP.y[v]); if(dd<bd){ bd=dd; bp=[v,m]; } } });
      var dx2=MP.x[bp[1]]-MP.x[bp[0]], dy2=MP.y[bp[1]]-MP.y[bp[0]], dir=Math.abs(dx2)>Math.abs(dy2)?(dx2>0?"right":"left"):(dy2>0?"down":"up"); nav[bp[0]][dir]=bp[1];
    }
  }
  function goTo(n){ var g=groups[n]; if(!g) return; var B=g.ownerDocument.defaultView&&g.ownerDocument.defaultView.BGUI; if(B&&B.focus&&B.focus.enabled) B.focus.set(g); else { try{ g.focus({preventScroll:true}); }catch(x){ g.focus(); } } }
  self.nav=function(){ if(!nav) buildNav(); return nav; };
  root.addEventListener("keydown",function(e){
    if(!focusOn||e.altKey||e.ctrlKey||e.metaKey) return;
    var k=e.key, c=e.keyCode, dir=(k==="ArrowUp"||k==="Up"||c===38)?"up":(k==="ArrowDown"||k==="Down"||c===40)?"down":(k==="ArrowLeft"||k==="Left"||c===37)?"left":(k==="ArrowRight"||k==="Right"||c===39)?"right":null;
    if(dir){ var tg0=e.target&&e.target.closest&&e.target.closest(".tg"); if(tg0){ if(!nav) buildNav(); var n=nav[+tg0.getAttribute("data-t")][dir]; if(n!=null){ e.preventDefault(); goTo(n); } } return; } if(!(k==="Enter"||k==="Select"||c===13||c===23)) return;
    var tg=e.target&&e.target.closest&&e.target.closest(".tg"); if(!tg) return;
    e.preventDefault(); if(tapFn) tapFn(+tg.getAttribute("data-t"),e);
  });
  root.addEventListener("focusin",function(e){ var tg=focusOn&&e.target&&e.target.closest&&e.target.closest(".tg"); if(!tg) return; var t=+tg.getAttribute("data-t"); showRing(t); panTo(t); });
  root.addEventListener("focusout",function(e){ if(!e.relatedTarget||!root.contains(e.relatedTarget)) hideRing(); });

  /* ---- zoom / pan / tap ---- */
  var gestureT=0;
  function gestureOn(){ clearTimeout(gestureT); root.classList.add("is-gesture"); }
  function gestureOff(){ clearTimeout(gestureT); gestureT=setTimeout(function(){ root.classList.remove("is-gesture"); applyLabels(); },180); }
  var fitBtn=null;
  function syncFit(){ if(!fitBtn) return; var on=scale>1.02; fitBtn.setAttribute("aria-label",on?"Fit the whole map":"Zoom in"); fitBtn.lastChild.textContent=on?"Fit":"Zoom"; fitBtn.firstChild.style.display=on?"none":""; fitBtn.classList.toggle("is-icon",!on); }
  function apply(){ view.style.transform=(scale===1&&!tx&&!ty)?"":"translate("+(Math.round(tx*100)/100)+"px,"+(Math.round(ty*100)/100)+"px) scale("+(Math.round(scale*1000)/1000)+")"; root.classList.toggle("is-fit",scale<=1); applyLabels(); syncFit(); }
  function clamp(){ var r=root.getBoundingClientRect(), w=r.width, h=r.height; var minX=Math.min(0,w-w*scale), minY=Math.min(0,h-h*scale); tx=Math.max(minX,Math.min(0,tx)); ty=Math.max(minY,Math.min(0,ty)); }
  var MAXZ=5;
  self.zoomAt=function(k,cx,cy){ var r=root.getBoundingClientRect(); cx=cx==null?r.width/2:cx; cy=cy==null?r.height/2:cy; var ns=Math.max(1,Math.min(MAXZ,scale*k)); var f=ns/scale; tx=cx-(cx-tx)*f; ty=cy-(cy-ty)*f; scale=ns; if(scale<1.001){ scale=1; tx=0; ty=0; } clamp(); apply(); };
  self.fit=function(){ scale=1; tx=0; ty=0; apply(); };
  self.focus=function(t,k){ var r=root.getBoundingClientRect(); var ns=Math.max(1,Math.min(MAXZ,k||2.4)); scale=ns; tx=r.width/2-(MP.x[t]/MP.W*r.width)*ns; ty=r.height/2-(MP.y[t]/MP.H*r.height)*ns; clamp(); apply(); };
  self.scale=function(){ return scale; };
  function pointOf(e){ var r=map.getBoundingClientRect(); return [(e.clientX-r.left)/r.width*MP.W,(e.clientY-r.top)/r.height*MP.H]; }
  function terrAtEvent(e){ var tg=e.target&&e.target.closest&&e.target.closest(".tg"); if(tg) return +tg.getAttribute("data-t"); var p=pointOf(e); return nameAt(p[0],p[1]); }
  function nameAt(ux,uy){   // the land under the point, else a name over the sea (shown, and not inside its own land), else the nearest coast within reach
    var v=terrAtPoint(ux,uy,0); if(v!=null) return v;
    if(S.names.style.display!=="none") for(var t=0;t<MP.n;t++){ var b=nameBox[t], l=GEO.lab[t]; if(b&&nameOn[t]&&l.k!=="in"&&ux>=b[0]&&ux<=b[2]&&uy>=b[1]&&uy<=b[3]) return t; }
    return terrAtPoint(ux,uy,12);
  }
  self.terrAt=function(ux,uy){ return nameAt(ux,uy); };
  var ptrs={}, startPt=null, moved=false, pinch=null, lpT=0, lpDone=false, lastTap={t:0,x:0,y:0};
  function clearLP(){ clearTimeout(lpT); lpT=0; }
  root.addEventListener("pointerdown",function(e){
    if(e.target.closest&&e.target.closest(".rk-fitbtn")) return;
    ptrs[e.pointerId]={x:e.clientX,y:e.clientY};
    if(Object.keys(ptrs).length===1){ startPt={x:e.clientX,y:e.clientY,tx:tx,ty:ty,t:Date.now()}; moved=false; lpDone=false; clearLP();
      if(inspectFn&&e.pointerType!=="mouse"){ var ev={clientX:e.clientX,clientY:e.clientY,target:e.target}; lpT=setTimeout(function(){ lpT=0; if(moved||!startPt) return; var t=terrAtEvent(ev); if(t!=null){ lpDone=true; inspectFn(t); } },520); } }
    else { pinch=null; moved=true; clearLP(); gestureOn(); }
  });
  root.addEventListener("pointermove",function(e){
    if(!ptrs[e.pointerId]) return; ptrs[e.pointerId]={x:e.clientX,y:e.clientY};
    var ids=Object.keys(ptrs);
    if(ids.length===2){ var a=ptrs[ids[0]], b=ptrs[ids[1]], dist=Math.hypot(a.x-b.x,a.y-b.y), r=root.getBoundingClientRect(); if(pinch){ self.zoomAt(dist/pinch.d,(a.x+b.x)/2-r.left,(a.y+b.y)/2-r.top); } pinch={d:dist}; moved=true; return; }
    if(startPt&&scale>1){ var dx=e.clientX-startPt.x, dy=e.clientY-startPt.y; if(Math.abs(dx)+Math.abs(dy)>7){ if(!moved){ moved=true; clearLP(); gestureOn(); } } if(moved){ tx=startPt.tx+dx; ty=startPt.ty+dy; clamp(); apply(); } }
    else if(startPt&&(Math.abs(e.clientX-startPt.x)+Math.abs(e.clientY-startPt.y)>9)){ moved=true; clearLP(); }
  });
  function up(e){
    var had=ptrs[e.pointerId]; delete ptrs[e.pointerId]; if(Object.keys(ptrs).length<2) pinch=null; clearLP();
    var n=Object.keys(ptrs).length;
    if(had&&startPt&&!moved&&!lpDone&&n===0&&e.type==="pointerup"){
      var t=terrAtEvent(e), now=Date.now();
      // a double tap zooms in (or back out) when the first tap did nothing: on the sea, or on a territory nothing can be done on
      if(now-lastTap.t<320&&Math.hypot(e.clientX-lastTap.x,e.clientY-lastTap.y)<34&&(t==null||!actionable(t))&&!opts.static){
        lastTap.t=0; var r=root.getBoundingClientRect(); if(scale>1.05) self.fit(); else { self.zoomAt(2.6,e.clientX-r.left,e.clientY-r.top); } gestureOff(); return;
      }
      lastTap={t:now,x:e.clientX,y:e.clientY};
      if(t!=null&&tapFn) tapFn(t,e);
    }
    if(n===0){ startPt=null; gestureOff(); }
  }
  root.addEventListener("pointerup",up); root.addEventListener("pointercancel",up);
  root.addEventListener("wheel",function(e){ if(opts.static) return; e.preventDefault(); var r=root.getBoundingClientRect(); gestureOn(); self.zoomAt(e.deltaY<0?1.2:1/1.2,e.clientX-r.left,e.clientY-r.top); gestureOff(); },{passive:false});
  if(opts.static){ root.style.pointerEvents="none"; }
  else {
    fitBtn=document.createElement("button"); fitBtn.type="button"; fitBtn.className="rk-fitbtn";
    fitBtn.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5"/><path d="M15.5 15.5L21 21M10.5 7.5v6M7.5 10.5h6"/></svg><span>Zoom</span>';
    fitBtn.setAttribute("aria-label","Zoom in"); fitBtn.classList.add("is-icon"); root.appendChild(fitBtn);
    fitBtn.addEventListener("pointerdown",function(e){ e.stopPropagation(); });
    fitBtn.addEventListener("click",function(e){ e.stopPropagation(); gestureOn(); if(scale>1.02) self.fit(); else self.zoomAt(2.4); gestureOff(); });
    if(focusOn) fitBtn.style.display="none";
  }
  self.onTap=function(f){ tapFn=f; };
  self.onInspect=function(f){ inspectFn=f; };
  self.root=root; self.svg=svg; self.names=S.names;
  self.simulateTap=function(t){ if(tapFn) tapFn(t,{}); };
  apply();
  return self;
}
var cssDone=false;
function injectCSS(){
  if(cssDone||typeof document==="undefined") return; cssDone=true;
  var s=document.createElement("style"); s.id="rkBoardCss";
  s.textContent=".rkroot{position:relative;width:100%;aspect-ratio:5/3;overflow:hidden;touch-action:none;user-select:none;-webkit-user-select:none;background:#0b1530;border-radius:10px}"+
  ".rkview{position:absolute;inset:0;transform-origin:0 0}"+
  ".rkroot.is-gesture .rkview{will-change:transform}"+
  ".rksvg{position:absolute;left:0;top:0;width:100%;height:100%;display:block;overflow:visible}"+
  ".rkname{font-family:Manrope,'Segoe UI',system-ui,sans-serif;font-weight:800;fill:#fff8e6;stroke:rgba(6,9,24,.92);paint-order:stroke;stroke-linejoin:round}"+
  ".rkocn{font-family:'DM Serif Display',Georgia,serif;font-style:italic;fill:rgba(165,190,245,.5);letter-spacing:.14em}"+
  ".rkmed{font-family:Manrope,'Segoe UI',system-ui,sans-serif;font-weight:800;fill:#080a15}"+
  ".rknum{font-family:Manrope,'Segoe UI',system-ui,sans-serif;font-weight:800;fill:#0b0a12;pointer-events:none;font-variant-numeric:tabular-nums}"+
  ".tg{cursor:pointer;outline:none}"+
  ".rk-fitbtn{position:absolute;bottom:8px;left:8px;z-index:4;display:inline-flex;align-items:center;gap:6px;min-width:44px;min-height:44px;padding:0 14px;border:0;border-radius:22px;color:#f4e3b8;background:rgba(8,10,21,.78);box-shadow:inset 0 0 0 1px rgba(231,202,144,.55);font:700 13px/1 Manrope,'Segoe UI',system-ui,sans-serif;cursor:pointer}"+
  ".rk-fitbtn svg{width:20px;height:20px}.rk-fitbtn.is-icon{padding:0;justify-content:center;width:44px}.rk-fitbtn.is-icon span{display:none}"+
  ".rkpulse{animation:rkp 1.1s ease-in-out infinite}@keyframes rkp{50%{opacity:.35}}"+
  ".rkflash{animation:rkf .9s ease-out 1 forwards;transform-box:fill-box;transform-origin:center}@keyframes rkf{from{opacity:1;transform:scale(.8)}to{opacity:0;transform:scale(1.5)}}"+
  ".rkfl{animation:rkfl .9s ease-out 1 forwards}@keyframes rkfl{from{opacity:1}to{opacity:0}}";
  document.head.appendChild(s);
}
Risk.Board={create:create,silhouette:silhouette,piecesSVG:piecesSVG,cubeSVG:cubeSVG,oblongSVG:oblongSVG,terrAtPoint:terrAtPoint,SEATS:SEATS,hasCanvas:function(){ return true; }};
})(typeof window!=="undefined"?window:globalThis);
