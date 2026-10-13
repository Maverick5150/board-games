/* RISK — map renderer: nautical-chart sea, continent-coloured territories (drawn procedurally), 1960s wooden cube/oblong pieces,
   zoom/pan, tap-to-select. Used by the phone game, the Party-mode TV and the Party phones. Needs map.js. */
(function(g){
"use strict";
var Risk=g.Risk=g.Risk||{}, MP=Risk.MAP;
var SC=2;                                   // raster scale for the drawn map
var geo=null;                               // cached geometry: {W,H,label:Uint8Array,edge:Uint8Array,land:Uint8Array,contig:{}}
var SVGNS="http://www.w3.org/2000/svg";

function hasCanvas(){ try{ var c=document.createElement("canvas"); return !!(c.getContext&&c.getContext("2d")); }catch(e){ return false; } }
function chaikin(pts,n){
  for(var it=0;it<n;it++){ var out=[]; for(var i=0;i<pts.length;i++){ var a=pts[i], b=pts[(i+1)%pts.length]; out.push([a[0]*0.75+b[0]*0.25,a[1]*0.75+b[1]*0.25],[a[0]*0.25+b[0]*0.75,a[1]*0.25+b[1]*0.75]); } pts=out; }
  return pts;
}
function warp(x,y){ return [x+5.5*Math.sin(y/23+x/71)+3.2*Math.sin(y/9.5-x/31), y+5.5*Math.sin(x/27-y/63)+3.2*Math.sin(x/11+y/37)]; }

/* ---- geometry: land mask + nearest-seed (Voronoi) territories ---- */
function buildGeometry(){
  if(geo) return geo;
  var W=MP.W*SC, H=MP.H*SC, cv=document.createElement("canvas"); cv.width=W; cv.height=H;
  var ctx=cv.getContext("2d"); if(!ctx) return null;
  ctx.clearRect(0,0,W,H);
  MP.land.forEach(function(l,k){
    var pts=chaikin(l.p,3); ctx.beginPath();
    pts.forEach(function(p,i){ if(i) ctx.lineTo(p[0]*SC,p[1]*SC); else ctx.moveTo(p[0]*SC,p[1]*SC); });
    ctx.closePath(); ctx.fillStyle="rgb("+(k+1)+",0,0)"; ctx.fill();
  });
  var img=ctx.getImageData(0,0,W,H).data;
  var label=new Uint8Array(W*H).fill(255), land=new Uint8Array(W*H);
  var seedsOf=MP.land.map(function(l){ return l.t.map(function(t){ return [t,MP.x[t],MP.y[t]]; }); });
  for(var y=0;y<H;y++){
    for(var x=0;x<W;x++){
      var o=(y*W+x)*4; if(img[o+3]<128) continue;
      var lm=img[o]-1; if(lm<0||lm>=seedsOf.length) continue;
      land[y*W+x]=1;
      var seeds=seedsOf[lm]; if(seeds.length===1){ label[y*W+x]=seeds[0][0]; continue; }
      var w=warp(x/SC,y/SC), best=1e12, bt=seeds[0][0];
      for(var s=0;s<seeds.length;s++){ var dx=w[0]-seeds[s][1], dy=w[1]-seeds[s][2]; var d=dx*dx+dy*dy; if(d<best){ best=d; bt=seeds[s][0]; } }
      label[y*W+x]=bt;
    }
  }
  var edge=new Uint8Array(W*H), contig={};
  for(var yy=0;yy<H-1;yy++){
    for(var xx=0;xx<W-1;xx++){
      var i=yy*W+xx, a=label[i]; var r=label[i+1], d2=label[i+W];
      if(land[i]){
        if(!land[i+1]||!land[i+W]||(xx>0&&!land[i-1])||(yy>0&&!land[i-W])) edge[i]=2;
        else if(r!==a||d2!==a){ edge[i]=1; }
        if(land[i+1]&&r!==a){ contig[Math.min(a,r)+","+Math.max(a,r)]=1; }
        if(land[i+W]&&d2!==a){ contig[Math.min(a,d2)+","+Math.max(a,d2)]=1; }
      } else if(land[i+1]||land[i+W]) { /* sea side of the coast */ }
    }
  }
  geo={W:W,H:H,label:label,edge:edge,land:land,contig:contig};
  return geo;
}
function hexRGB(h){ return [parseInt(h.substr(1,2),16),parseInt(h.substr(3,2),16),parseInt(h.substr(5,2),16)]; }
function hash(i){ i=(i^61)^(i>>>16); i=i+(i<<3); i=i^(i>>>4); i=Math.imul(i,0x27d4eb2d); i=i^(i>>>15); return (i&1023)/1023; }

/* ---- the sea canvas: parchment-blue ocean, wave texture, sea lanes, ocean names, bonus circles, whale / ship / dolphins ---- */
function drawSea(canvas,G){
  var W=MP.W*SC,H=MP.H*SC; canvas.width=W; canvas.height=H; var c=canvas.getContext("2d"); if(!c) return;
  var gr=c.createLinearGradient(0,0,0,H); gr.addColorStop(0,"#a7cde3"); gr.addColorStop(.55,"#8dbdd8"); gr.addColorStop(1,"#7eb0cf");
  c.fillStyle=gr; c.fillRect(0,0,W,H);
  c.save(); c.scale(SC,SC); c.strokeStyle="rgba(255,255,255,.16)"; c.lineWidth=.9;
  for(var y=14;y<MP.H;y+=17){ c.beginPath(); for(var x=0;x<=MP.W;x+=8){ var yy=y+2.2*Math.sin(x/19+y/7); if(x) c.lineTo(x,yy); else c.moveTo(x,yy); } c.stroke(); }
  c.restore();
  c.save(); c.scale(SC,SC);
  // sea lanes (drawn under the land so only the water part shows) — double lines like the printed board
  var lanes=[];
  MP.pairs.forEach(function(p){ var k=Math.min(p[0],p[1])+","+Math.max(p[0],p[1]); if(!G||!G.contig[k]) lanes.push(p); });
  function lane(x1,y1,x2,y2){
    c.lineCap="round";
    c.strokeStyle="#173b57"; c.lineWidth=5.2; c.beginPath(); c.moveTo(x1,y1); c.lineTo(x2,y2); c.stroke();
    c.strokeStyle="#9ec7df"; c.lineWidth=2.1; c.beginPath(); c.moveTo(x1,y1); c.lineTo(x2,y2); c.stroke();
  }
  lanes.forEach(function(p){
    var a=p[0],b=p[1];
    if(MP.names[a]==="Alaska"&&MP.names[b]==="Kamchatka"||MP.names[b]==="Alaska"&&MP.names[a]==="Kamchatka"){
      var al=MP.idx["Alaska"],ka=MP.idx["Kamchatka"];
      lane(MP.x[al],MP.y[al],-4,MP.y[al]+4); lane(MP.x[ka],MP.y[ka],MP.W+4,MP.y[ka]+4); return;
    }
    lane(MP.x[a],MP.y[a],MP.x[b],MP.y[b]);
  });
  c.restore();
  // ocean names
  c.save(); c.scale(SC,SC); c.fillStyle="rgba(20,60,95,.62)"; c.textAlign="center";
  function oname(t,x,y,rot,sz){ c.save(); c.translate(x,y); c.rotate(rot*Math.PI/180); c.font="italic "+(sz||19)+"px Georgia,'Times New Roman',serif"; c.fillText(t,0,0); c.restore(); }
  oname("Pacific Ocean",58,430,-78,19); oname("Pacific Ocean",972,330,78,17); oname("Atlantic Ocean",338,292,-72,19); oname("Indian Ocean",668,505,-8,19); oname("Arctic Ocean",236,25,0,13);   // left of Greenland, so its land doesn't cover the end of the name
  // bonus circles (continent colour + army bonus)
  var bon=[[0,44,288],[1,128,484],[2,430,26],[3,360,486],[4,904,300],[5,752,538]];
  bon.forEach(function(b){ var ct=MP.continents[b[0]]; c.beginPath(); c.arc(b[1],b[2],15,0,Math.PI*2); c.fillStyle=ct.color; c.fill(); c.lineWidth=2.4; c.strokeStyle="#2a2014"; c.stroke(); c.fillStyle="#fff"; c.font="bold 18px Georgia,serif"; c.textBaseline="middle"; c.strokeStyle="rgba(0,0,0,.55)"; c.lineWidth=2.4; c.strokeText(String(ct.bonus),b[1],b[2]+1); c.fillText(String(ct.bonus),b[1],b[2]+1); c.textBaseline="alphabetic"; });
  // whale, three-masted ship, dolphins (simple original drawings)
  function whale(x,y){ c.save(); c.translate(x,y); c.fillStyle="#2a4a64"; c.beginPath(); c.ellipse(0,0,19,7,0,0,Math.PI*2); c.fill(); c.beginPath(); c.moveTo(-17,0); c.lineTo(-27,-9); c.lineTo(-22,2); c.lineTo(-28,9); c.closePath(); c.fill(); c.strokeStyle="#f4fbff"; c.lineWidth=1.6; c.beginPath(); c.moveTo(8,-6); c.quadraticCurveTo(8,-17,3,-20); c.moveTo(8,-6); c.quadraticCurveTo(10,-16,15,-18); c.stroke(); c.restore(); }
  function ship(x,y){ c.save(); c.translate(x,y); c.fillStyle="#5a3a1c"; c.beginPath(); c.moveTo(-22,8); c.lineTo(22,8); c.lineTo(15,17); c.lineTo(-15,17); c.closePath(); c.fill(); c.strokeStyle="#3b2410"; c.lineWidth=1.5; [-11,0,11].forEach(function(m){ c.beginPath(); c.moveTo(m,8); c.lineTo(m,-18); c.stroke(); }); c.fillStyle="#f6f0dc"; [-11,0,11].forEach(function(m,i){ c.beginPath(); c.moveTo(m+1,-16); c.lineTo(m+9,-3+i%2*2); c.lineTo(m+1,6); c.closePath(); c.fill(); c.stroke(); }); c.restore(); }
  function dolphin(x,y,r){ c.save(); c.translate(x,y); c.rotate(r); c.strokeStyle="#2a4a64"; c.lineWidth=3.2; c.lineCap="round"; c.beginPath(); c.moveTo(-12,6); c.quadraticCurveTo(-2,-14,12,2); c.stroke(); c.beginPath(); c.moveTo(8,0); c.lineTo(15,-5); c.stroke(); c.restore(); }
  whale(258,52); ship(706,566); dolphin(330,566,0); dolphin(352,572,.3);
  c.restore();
}

/* ---- pieces: 1960s wooden cubes (1 army) and oblong prisms (10 armies) ---- */
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
  var obl=Math.floor(n/10), cub=n%10, s="", i;
  if(obl>6) obl=6;
  var cy=16;                                     // base line of the lowest cubes
  var rows=[[4,-21,0],[3,-14,-7],[2,-7,-14]];    // cubes: [count, firstX, y offset]
  var left=cub, placed=[];
  rows.forEach(function(r){ var k=Math.min(left,r[0]); left-=k; var x0=-(k-1)*7; for(i=0;i<k;i++) placed.push([x0+i*14,r[2]]); });
  // draw back (top rows) first
  placed.sort(function(a,b){ return a[1]-b[1]; });
  var obY=cy-(cub>6?27:cub>4?20:cub>0?13:3);
  for(i=0;i<obl;i++){ var rowN=Math.floor(i/2), inRow=Math.min(2,obl-rowN*2), idx=i%2, ox=(inRow===1?0:(idx?15:-15)); s+=oblongSVG(ox,obY-rowN*11-0,col); }
  placed.forEach(function(p){ s+=cubeSVG(p[0],cy+p[1],col); });
  return s;
}

/* ---- the board object ---- */
function create(container,opts){
  opts=opts||{};
  var self={opts:opts}, V=null, marks={sel:null,src:{},tgt:{},hot:{},mine:{}}, labelsMode=opts.labels||"auto";
  var scale=1,tx=0,ty=0, tint=!!opts.tint, tapFn=opts.onTap||null, flashT={};
  container.innerHTML="";
  var root=document.createElement("div"); root.className="rkroot";
  var view=document.createElement("div"); view.className="rkview";
  var seaC=document.createElement("canvas"), landC=document.createElement("canvas"); seaC.className="rksea"; landC.className="rkland";
  var svg=document.createElementNS(SVGNS,"svg"); svg.setAttribute("viewBox","0 0 "+MP.W+" "+MP.H); svg.setAttribute("class","rksvg"); svg.setAttribute("preserveAspectRatio","xMidYMid meet");
  view.appendChild(seaC); view.appendChild(landC); view.appendChild(svg); root.appendChild(view); container.appendChild(root);
  injectCSS();
  var canvasOK=hasCanvas(), G=null, base=[];
  // base territory colours
  for(var i=0;i<MP.n;i++) base.push(hexRGB(MP.continents[MP.cont[i]].color));
  if(canvasOK){ G=buildGeometry(); }
  if(G){ drawSea(seaC,G); landC.width=G.W; landC.height=G.H; }
  else { seaC.style.background="#8dbdd8"; }
  function paintLand(){
    if(!G) return; var ctx=landC.getContext("2d"), W=G.W, H=G.H, id=ctx.createImageData(W,H), d=id.data;
    var cols=[], i, k;
    for(i=0;i<MP.n;i++){
      var c=base[i].slice();
      if(tint&&V&&V.terr[i]&&V.terr[i].o>=0){ var oc=hexRGB(V.colors[V.terr[i].o]||"#888888"); c=[Math.round(c[0]*.5+oc[0]*.5),Math.round(c[1]*.5+oc[1]*.5),Math.round(c[2]*.5+oc[2]*.5)]; }
      cols.push(c);
    }
    var label=G.label, edge=G.edge, land=G.land;
    for(i=0;i<W*H;i++){
      if(!land[i]) continue; var o=i*4, t=label[i], c2=cols[t], e=edge[i], sh=0.94+hash(i)*0.1;
      if(e===2){ d[o]=24; d[o+1]=18; d[o+2]=10; d[o+3]=255; continue; }
      if(e===1){ d[o]=Math.round(c2[0]*.42); d[o+1]=Math.round(c2[1]*.42); d[o+2]=Math.round(c2[2]*.42); d[o+3]=255; continue; }
      d[o]=Math.min(255,c2[0]*sh); d[o+1]=Math.min(255,c2[1]*sh); d[o+2]=Math.min(255,c2[2]*sh); d[o+3]=255;
    }
    ctx.putImageData(id,0,0);
  }
  paintLand();

  /* ---- overlay ---- */
  var groups=[], labelEls=[], rings=[];
  var defs=document.createElementNS(SVGNS,"defs"); defs.innerHTML='<filter id="rkglow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="3"/></filter>'; svg.appendChild(defs);
  var labelLayer=document.createElementNS(SVGNS,"g"); labelLayer.setAttribute("class","rklabels"); svg.appendChild(labelLayer);
  var pieceLayer=document.createElementNS(SVGNS,"g"); svg.appendChild(pieceLayer);
  var LOFF={"Great Britain":[-27,-2,"end"],"Western Europe":[-6,41,"middle"],"Southern Europe":[8,41,"middle"],"Western Australia":[-4,41,"middle"],"Eastern Australia":[10,-20,"middle"],"Iceland":[-8,-26,"middle"],"Northwest Territory":[0,-20,"middle"],"Alberta":[-6,42,"middle"],"Eastern United States":[10,41,"middle"],"Western United States":[-12,41,"middle"],"Japan":[4,-26,"middle"],"Central America":[0,42,"middle"],"Argentina":[0,44,"middle"],"Madagascar":[0,44,"middle"],"South Africa":[0,44,"middle"],"New Guinea":[0,-20,"middle"],"Northern Europe":[2,-18,"middle"]};
  var POFF={"Alaska":[10,0],"Greenland":[0,14],"Western Australia":[0,-4]};   // pieces + rings of edge territories nudged inward so the board edge doesn't cut them
  var LINES={"Western United States":["WESTERN","UNITED STATES"],"Eastern United States":["EASTERN","UNITED STATES"],"Northwest Territory":["NORTHWEST","TERRITORY"]};
  function splitLines(n){ if(LINES[n]) return LINES[n]; var u=n.toUpperCase(); if(u.length<=10||u.indexOf(" ")<0) return [u]; var best=-1,bd=99; for(var k=0;k<u.length;k++){ if(u[k]===" "&&Math.abs(k-u.length/2)<bd){ bd=Math.abs(k-u.length/2); best=k; } } return [u.slice(0,best),u.slice(best+1)]; }
  for(var t=0;t<MP.n;t++){
    var lo=LOFF[MP.names[t]]||[0,-24,"middle"], lines=splitLines(MP.names[t]);
    var tl=document.createElementNS(SVGNS,"text"); tl.setAttribute("text-anchor",lo[2]); tl.setAttribute("class","rkname"); tl.setAttribute("fill",MP.continents[MP.cont[t]].ink);
    lines.forEach(function(ln,k){ var ts=document.createElementNS(SVGNS,"tspan"); ts.setAttribute("x",MP.x[t]+lo[0]); ts.setAttribute("y",MP.y[t]+lo[1]-(lines.length-1-k)*9.5); ts.textContent=ln; tl.appendChild(ts); });
    labelLayer.appendChild(tl); labelEls.push(tl);
    var po=POFF[MP.names[t]]||[0,0];
    var gg=document.createElementNS(SVGNS,"g"); gg.setAttribute("class","tg"); gg.setAttribute("data-t",t); gg.setAttribute("transform","translate("+(MP.x[t]+po[0])+","+(MP.y[t]+po[1])+")"); pieceLayer.appendChild(gg); groups.push(gg);
  }
  var keyCache=[];
  function drawGroup(t){
    var st=V&&V.terr[t], gg=groups[t]; if(!st){ gg.innerHTML=""; return; }
    var o=st.o!==undefined?st.o:st[0], a=st.a!==undefined?st.a:st[1];
    var colHex=(o>=0&&V.colors[o])||"#888888";
    var pc=V.pcol&&V.pcol[o]||colorObj(colHex);
    var key=o+"/"+a+"/"+(marks.sel===t?1:0)+(marks.src[t]?"s":"")+(marks.tgt[t]?"t":"")+(marks.hot[t]?"h":"")+(marks.mine[t]?"m":"")+(flashT[t]?"f":"")+scaleBucket();
    if(keyCache[t]===key) return; keyCache[t]=key;
    var h='';
    if(marks.mine[t]) h+='<circle r="30" fill="'+pc.l+'" opacity=".30"/>';
    if(marks.src[t]) h+='<circle r="31" fill="none" stroke="#ffe27a" stroke-width="4" class="rkpulse"/>';
    if(marks.tgt[t]) h+='<circle r="31" fill="rgba(255,60,40,.22)" stroke="#ff3b2a" stroke-width="4" stroke-dasharray="7 4" class="rkpulse"/>';
    if(marks.hot[t]) h+='<circle r="31" fill="none" stroke="#fff" stroke-width="3.5" class="rkpulse"/>';
    if(marks.sel===t) h+='<circle r="33" fill="rgba(255,226,122,.25)" stroke="#ffd23f" stroke-width="4.5"/>';
    if(flashT[t]) h+='<circle r="34" fill="none" stroke="'+(flashT[t]==="lose"?"#ff5a4a":"#fff")+'" stroke-width="5" class="rkflash"/>';
    h+='<circle r="29" fill="transparent"/>';
    if(a>0&&o>=0){
      h+='<g class="rkpcs" transform="translate(-7,-2) scale(1.12)">'+piecesSVG(a,pc)+'</g>';
      var nd=String(a).length, br=nd>=4?16.5:(nd===3?15:12.5), fs=nd>=5?7.5:(nd===4?9:(nd===3?11:14));   // 3-4 digit stacks: wider badge, smaller digits that stay inside the ring
      h+='<g><circle cx="23" cy="13" r="'+br+'" fill="#f7efd8" stroke="'+pc.d+'" stroke-width="2.6"/><text x="23" y="'+(13+fs*0.4)+'" text-anchor="middle" class="rknum" fill="#2a1d0a"'+(nd>2?' style="font-size:'+fs+'px"':'')+'>'+a+'</text></g>';
    }
    gg.innerHTML=h;
  }
  function colorObj(hex){ var r=hexRGB(hex); function mix(k){ return "rgb("+Math.round(r[0]*k)+","+Math.round(r[1]*k)+","+Math.round(r[2]*k)+")"; } return {c:hex,d:mix(.55),l:mix(1.25).replace(/(\d+)/g,function(m){ return Math.min(255,+m); })}; }
  function scaleBucket(){ return ""; }
  function drawAll(){ for(var t=0;t<MP.n;t++) drawGroup(t); applyLabels(); }
  function applyLabels(){
    var show=labelsMode==="always"||(labelsMode==="auto"&&scale>=1.45);
    labelLayer.style.display=show?"":"none";
  }
  self.setView=function(v){ V=v; paintLand(); keyCache=[]; drawAll(); };
  self.setMarks=function(m){ marks={sel:m.sel==null?null:m.sel,src:m.src||{},tgt:m.tgt||{},hot:m.hot||{},mine:m.mine||{}}; keyCache=[]; drawAll(); };
  self.flash=function(t,kind,ms){ flashT[t]=kind||"win"; keyCache[t]=null; drawGroup(t); setTimeout(function(){ delete flashT[t]; keyCache[t]=null; drawGroup(t); },ms||900); };
  self.setTint=function(b){ tint=!!b; paintLand(); };
  self.setLabels=function(m){ labelsMode=m; applyLabels(); };
  self.centerOf=function(t){ return [MP.x[t],MP.y[t]]; };

  /* ---- zoom / pan / tap ---- */
  function apply(){ view.style.transform="translate("+tx+"px,"+ty+"px) scale("+scale+")"; applyLabels(); }
  function clamp(){ var r=root.getBoundingClientRect(), w=r.width, h=r.height; var minX=Math.min(0,w-w*scale), minY=Math.min(0,h-h*scale); tx=Math.max(minX,Math.min(0,tx)); ty=Math.max(minY,Math.min(0,ty)); }
  self.zoomAt=function(k,cx,cy){ var r=root.getBoundingClientRect(); cx=cx==null?r.width/2:cx; cy=cy==null?r.height/2:cy; var ns=Math.max(1,Math.min(4.5,scale*k)); var f=ns/scale; tx=cx-(cx-tx)*f; ty=cy-(cy-ty)*f; scale=ns; clamp(); apply(); };
  self.fit=function(){ scale=1; tx=0; ty=0; apply(); };
  self.focus=function(t,k){ var r=root.getBoundingClientRect(); var ns=Math.max(1,Math.min(4.5,k||2.2)); scale=ns; tx=r.width/2-(MP.x[t]/MP.W*r.width)*ns; ty=r.height/2-(MP.y[t]/MP.H*r.height)*ns; clamp(); apply(); };
  self.scale=function(){ return scale; };
  function terrAtEvent(e){
    var tg=e.target.closest&&e.target.closest(".tg"); if(tg) return +tg.getAttribute("data-t");
    var r=svg.getBoundingClientRect(); var ux=(e.clientX-r.left)/r.width*MP.W, uy=(e.clientY-r.top)/r.height*MP.H;
    return self.terrAt(ux,uy);
  }
  self.terrAt=function(ux,uy){
    if(G){ var x=Math.round(ux*SC), y=Math.round(uy*SC); if(x>=0&&y>=0&&x<G.W&&y<G.H){ var l=G.label[y*G.W+x]; if(l!==255) return l;
        // near a coast: look around a little so thin territories are easy to hit
        for(var rr=4;rr<=24;rr+=4){ for(var a=0;a<8;a++){ var xx=Math.round(x+Math.cos(a*Math.PI/4)*rr*SC/2), yy=Math.round(y+Math.sin(a*Math.PI/4)*rr*SC/2); if(xx>=0&&yy>=0&&xx<G.W&&yy<G.H&&G.label[yy*G.W+xx]!==255) return G.label[yy*G.W+xx]; } } } return null; }
    var best=null,bd=1e9; for(var t=0;t<MP.n;t++){ var dx=ux-MP.x[t], dy=uy-MP.y[t], d=dx*dx+dy*dy; if(d<bd){ bd=d; best=t; } } return bd<2400?best:null;
  };
  var ptrs={}, startPt=null, moved=false, pinch=null;
  root.addEventListener("pointerdown",function(e){ ptrs[e.pointerId]={x:e.clientX,y:e.clientY}; if(Object.keys(ptrs).length===1){ startPt={x:e.clientX,y:e.clientY,tx:tx,ty:ty,t:Date.now()}; moved=false; } else { pinch=null; moved=true; } });
  root.addEventListener("pointermove",function(e){
    if(!ptrs[e.pointerId]) return; ptrs[e.pointerId]={x:e.clientX,y:e.clientY};
    var ids=Object.keys(ptrs);
    if(ids.length===2){ var a=ptrs[ids[0]], b=ptrs[ids[1]], dist=Math.hypot(a.x-b.x,a.y-b.y), r=root.getBoundingClientRect(); if(pinch){ self.zoomAt(dist/pinch.d,(a.x+b.x)/2-r.left,(a.y+b.y)/2-r.top); } pinch={d:dist}; moved=true; return; }
    if(startPt&&scale>1){ var dx=e.clientX-startPt.x, dy=e.clientY-startPt.y; if(Math.abs(dx)+Math.abs(dy)>7) moved=true; if(moved){ tx=startPt.tx+dx; ty=startPt.ty+dy; clamp(); apply(); } }
    else if(startPt&&(Math.abs(e.clientX-startPt.x)+Math.abs(e.clientY-startPt.y)>9)) moved=true;
  });
  function up(e){
    var had=ptrs[e.pointerId]; delete ptrs[e.pointerId]; if(Object.keys(ptrs).length<2) pinch=null;
    if(had&&startPt&&!moved&&Object.keys(ptrs).length===0&&e.type==="pointerup"){ var t=terrAtEvent(e); if(t!=null&&tapFn) tapFn(t,e); }
    if(Object.keys(ptrs).length===0) startPt=null;
  }
  root.addEventListener("pointerup",up); root.addEventListener("pointercancel",up);
  root.addEventListener("wheel",function(e){ if(opts.static) return; e.preventDefault(); var r=root.getBoundingClientRect(); self.zoomAt(e.deltaY<0?1.2:1/1.2,e.clientX-r.left,e.clientY-r.top); },{passive:false});
  if(opts.static){ root.style.pointerEvents="none"; }
  self.onTap=function(f){ tapFn=f; };
  self.root=root; self.svg=svg;
  self.simulateTap=function(t){ if(tapFn) tapFn(t,{}); };
  apply();
  return self;
}
var cssDone=false;
function injectCSS(){
  if(cssDone||typeof document==="undefined") return; cssDone=true;
  var s=document.createElement("style"); s.id="rkBoardCss";
  s.textContent=".rkroot{position:relative;width:100%;aspect-ratio:5/3;overflow:hidden;touch-action:none;user-select:none;-webkit-user-select:none;background:#8dbdd8;border-radius:10px}"+
  ".rkview{position:absolute;inset:0;transform-origin:0 0;will-change:transform}"+
  ".rksea,.rkland,.rksvg{position:absolute;left:0;top:0;width:100%;height:100%;display:block}"+
  ".rkland{filter:drop-shadow(0 3px 3px rgba(20,35,50,.55))}"+
  ".rksvg{overflow:visible}"+
  ".rkname{font:700 8.6px Georgia,'Times New Roman',serif;letter-spacing:.2px;paint-order:stroke;stroke:rgba(255,255,255,.88);stroke-width:2.6px;stroke-linejoin:round;pointer-events:none}"+
  ".rknum{font:900 14px Georgia,serif;pointer-events:none}"+
  ".tg{cursor:pointer}"+
  ".rkpulse{animation:rkp 1.1s ease-in-out infinite}@keyframes rkp{50%{opacity:.35}}"+
  ".rkflash{animation:rkf .9s ease-out 1 forwards}@keyframes rkf{from{opacity:1;stroke-width:7}to{opacity:0;stroke-width:1}}";
  document.head.appendChild(s);
}
var silCache={}, bboxes=null;
function silhouette(t){
  if(silCache[t]!==undefined) return silCache[t];
  var G=null; try{ G=hasCanvas()?buildGeometry():null; }catch(e){}
  if(!G){ silCache[t]=""; return ""; }
  if(!bboxes){ bboxes={}; for(var i=0;i<G.W*G.H;i++){ var l=G.label[i]; if(l===255) continue; var x=i%G.W, y=(i-x)/G.W, b=bboxes[l]; if(!b) bboxes[l]=[x,y,x,y]; else { if(x<b[0]) b[0]=x; if(y<b[1]) b[1]=y; if(x>b[2]) b[2]=x; if(y>b[3]) b[3]=y; } } }
  var bb=bboxes[t]; if(!bb){ silCache[t]=""; return ""; }
  var bw=bb[2]-bb[0]+1, bh=bb[3]-bb[1]+1, sc=Math.min(84/bw,48/bh), w=Math.max(4,Math.round(bw*sc)), h=Math.max(4,Math.round(bh*sc));
  var cv=document.createElement("canvas"); cv.width=w; cv.height=h; var cx=cv.getContext("2d"), id=cx.createImageData(w,h);
  for(var y2=0;y2<h;y2++) for(var x2=0;x2<w;x2++){ var sx=bb[0]+Math.floor(x2/sc), sy=bb[1]+Math.floor(y2/sc); if(G.label[sy*G.W+sx]===t){ var o=(y2*w+x2)*4; id.data[o]=17; id.data[o+1]=17; id.data[o+2]=17; id.data[o+3]=255; } }
  cx.putImageData(id,0,0); var url=cv.toDataURL("image/png"); silCache[t]=url; return url;
}
Risk.Board={create:create,silhouette:silhouette,buildGeometry:buildGeometry,piecesSVG:piecesSVG,cubeSVG:cubeSVG,oblongSVG:oblongSVG,hasCanvas:hasCanvas};
})(typeof window!=="undefined"?window:globalThis);
