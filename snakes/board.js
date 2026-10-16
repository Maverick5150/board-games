/* SNAKES AND LADDERS — the board art (window.Snakes.Board). Original Midnight Luxe art, drawn as inline SVG from the engine's board data
   (G.L), so every real layout and a shuffled board look the same way: lacquered jewel squares, gilded ladders with rungs, patterned
   snakes with a head, eyes and a forked tongue, a gold crest on the goal and a start rail under the board (players start OFF the board).
   No filters, no images: gradients and paths only. Pieces live in an HTML layer over the SVG (game.js) and move by transform.
   Every board of the catalogue (boards.js) is drawn from its own layout in the same look: geom(bd) places the squares of a 10 x 10 or
   9 x 8 grid (1 bottom left, rows alternate), the Jaina chart's cells (its six top squares stand above as a little temple, with gold
   footprints on the squares that lift a token one row) or the F. H. Ayres spiral (rings of squares, 100 in the middle). The art never
   copies a real board: only the numbers of its squares, ladders and snakes are used; each board gets its own jewel palette.
   Geometry (viewBox units): the board area is 1000 x 1000 (a 10 x 10 square is 100, exactly as before), centred; square n's centre is
   centre(n); the start rail is the strip y 1000..1070. Exports what game.js needs to animate: centre(n), startSlot(i), snakePts(head) (the
   centreline from the head down to the tail: the slither follows it), rungs(foot) (the rung midpoints, foot to top: the climb steps on
   each one; a footprint gives its short straight step), glow(at, ms) (the ladder or snake lights up as it fires), numbers(px) (keeps the
   square numbers above the text floor at any board size), scale() (the board's size factor for the tokens) and preview(bd) (a small
   picture of any board for the picker, drawn from its layout). */
(function(g){
"use strict";
var S=g.Snakes=g.Snakes||{};
var W=1000, H=1070, RAIL=1000, NS="http://www.w3.org/2000/svg";
var E=function(){ return S.Engine; };
function f1(x){ return Math.round(x*10)/10; }
function hash(s){ var h=2166136261; s=String(s); for(var i=0;i<s.length;i++){ h^=s.charCodeAt(i); h=Math.imul(h,16777619); } return h>>>0; }

/* the board palettes (original jewel lacquer; never the print of a real board): [dark square, light square] + the lit stops */
var PAL={
  vic:{a:"#4b1730",b:"#16305e",a2:"#6a2442",b2:"#244584",name:"garnet and sapphire"},
  mb:{a:"#123f36",b:"#5a3a0e",a2:"#1d5a4c",b2:"#80561c",name:"jade and amber"},
  shuffle:{a:"#2e1c52",b:"#0f3d44",a2:"#43307a",b2:"#1b5a62",name:"amethyst and teal"},
  lucknow1780:{a:"#5c1d14",b:"#1b2c66",a2:"#7d2a1c",b2:"#2a3f8a",name:"carnelian and lapis"},
  jaina1800:{a:"#0f3f30",b:"#5c2410",a2:"#185a44",b2:"#7c3418",name:"malachite and vermilion"},
  nepal19c:{a:"#14324a",b:"#5a1a12",a2:"#1e4766",b2:"#7a261a",name:"slate and madder"},
  "jaina-vam":{a:"#3a1240",b:"#0f3f30",a2:"#561c5e",b2:"#185a44",name:"mulberry and malachite"},
  wellcome1900:{a:"#4e2a0c",b:"#5a1620",a2:"#6e3c12",b2:"#7a2030",name:"umber and crimson"},
  ayres1892:{a:"#1b2f5c",b:"#3e1a4a",a2:"#284384",b2:"#56246a",name:"sapphire and plum"},
  harlesden1920:{a:"#1f4a2a",b:"#5a1c2a",a2:"#2c6a3c",b2:"#7a2a3a",name:"bottle green and claret"},
  codeg:{a:"#2a2a5e",b:"#4a3410",a2:"#3a3a84",b2:"#6c4c18",name:"indigo and bronze"},
  leela1975:{a:"#3b1450",b:"#5a3a0e",a2:"#52206e",b2:"#7c5216",name:"violet and saffron"}
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

var st={host:null,svg:null,L:{},bd:"vic",snakes:{},ladders:{},numEls:[],numPx:0,gm:null};

/* ---------- geometry: where every square of board bd sits (cached per board) ---------- */
var GEOC={};
function geom(bd){
  var e=E(), key=bd||"vic";
  if(GEOC[key]) return GEOC[key];
  var info=bd!=="shuffle"&&e&&e.infoOf?e.infoOf(bd):null, eg=bd!=="shuffle"&&e&&e.geoOf?e.geoOf(bd):null;
  var grid=info&&info.grid?info.grid:{kind:"rows",cols:10,rows:10}, P={}, T={}, n, cs;
  var gm={kind:grid.kind,P:P,T:T,end:eg?eg.end:100,goal:eg?eg.goal:100,steps:eg&&eg.steps?eg.steps:null,top:eg&&eg.top?eg.top:0,play:eg?eg.play:"",
    start:eg&&eg.start>0?eg.start:0,need6:!!(eg&&eg.need6),arrows:!!(info&&info.devices&&info.devices.all),info:info};
  if(grid.kind==="spiral"){
    var rings=grid.rings||[33,27,20,15,4,1], bw=84, ro=496, a0=120; n=1; cs=bw;
    rings.forEach(function(cnt,i){
      var rO=ro-i*bw, rI=rO-bw;
      if(cnt===1){ P[n]={x:500,y:500}; T[n]={kind:"disc",r:rO,cx:500,cy:500,num:{x:500,y:500-rO*.45}}; n++; return; }
      var step=360/cnt;
      for(var j=0;j<cnt;j++,n++){
        var am=(a0-j*step)*Math.PI/180, a1=(a0-j*step+step/2)*Math.PI/180, a2=(a0-j*step-step/2)*Math.PI/180, rm=rI+bw*.44, rn=rO-bw*.2;
        P[n]={x:500+rm*Math.cos(am),y:500+rm*Math.sin(am)};
        T[n]={kind:"sector",rO:rO,rI:rI,a1:a1,a2:a2,am:am,odd:(n+i)%2,num:{x:500+rn*Math.cos(am),y:500+rn*Math.sin(am)}};
      }
    });
  } else if(grid.kind==="cells"){
    var mc=0, mr=0, k2;
    for(k2 in grid.cells){ mc=Math.max(mc,grid.cells[k2][0]); mr=Math.max(mr,grid.cells[k2][1]); }
    cs=1000/Math.max(mc+1,mr+1); var ox=(1000-(mc+1)*cs)/2, oy=(1000-(mr+1)*cs)/2;
    for(k2 in grid.cells){ var c=grid.cells[k2][0], r=grid.cells[k2][1], x=ox+(c+.5)*cs, y=oy+(mr-r+.5)*cs;
      P[+k2]={x:x,y:y}; T[+k2]={kind:"rect",x:x-cs/2,y:y-cs/2,w:cs,h:cs,odd:(c+r)%2}; }
  } else {
    var C=grid.cols||10, R=grid.rows||10; cs=1000/Math.max(C,R); var ox2=(1000-C*cs)/2, oy2=(1000-R*cs)/2;
    for(n=1;n<=C*R;n++){ var rr=Math.floor((n-1)/C), cc=(n-1)%C; if(rr%2) cc=C-1-cc;
      var x2=ox2+(cc+.5)*cs, y2=oy2+(R-1-rr+.5)*cs;
      P[n]={x:x2,y:y2}; T[n]={kind:"rect",x:x2-cs/2,y:y2-cs/2,w:cs,h:cs,odd:(rr+((n-1)%C))%2}; }
    gm.box={x:ox2,y:oy2,w:C*cs,h:R*cs};
  }
  gm.cs=cs; gm.k=Math.max(.7,Math.min(1.1,cs/100));
  return (GEOC[key]=gm);
}
function cur(){ return st.gm||geom(st.bd); }
function centre(n){ var p=cur().P[n]; return p?{x:p.x,y:p.y}:{x:50,y:1035}; }
function cell(n){ return centre(n); }
function startSlot(i,n){ var gap=n>4?66:76; return {x:52+i*gap,y:1035}; }
function scale(){ return cur().k; }

/* ---------- snakes: a sine-curved centreline from the head (higher square) to the tail ---------- */
function snakeLine(a,b,seed,k){
  var A=centre(a), B=centre(b), dx=B.x-A.x, dy=B.y-A.y, len=Math.sqrt(dx*dx+dy*dy)||1, nx=-dy/len, ny=dx/len;
  var waves=Math.max(1,Math.round(len/(300*k))), amp=Math.min(58*k,16*k+len*.06)*((seed%2)?1:-1);
  if(len<130*k){ waves=1; amp=(seed%2?1:-1)*Math.max(26*k,len*.35); }   // a short one (56->53) curls
  var N=Math.max(28,Math.round(len/11)), pts=[];
  for(var i=0;i<=N;i++){ var t=i/N, s=Math.sin(Math.PI*waves*t)*amp; pts.push({x:A.x+dx*t+nx*s,y:A.y+dy*t+ny*s,t:t}); }
  return pts;
}
function normalAt(pts,i){ var p=pts[Math.max(0,i-1)], q=pts[Math.min(pts.length-1,i+1)], dx=q.x-p.x, dy=q.y-p.y, l=Math.sqrt(dx*dx+dy*dy)||1; return {x:-dy/l,y:dx/l,tx:dx/l,ty:dy/l}; }
function snakeSVG(head,tail,k0,k){
  var seed=hash(head+":"+tail), pts=snakeLine(head,tail,seed,k), sk=SKINS[k0%SKINS.length], N=pts.length-1, L=[], R=[], i;
  var len=0; for(i=1;i<=N;i++) len+=Math.hypot(pts[i].x-pts[i-1].x,pts[i].y-pts[i-1].y);
  var wHead=Math.min(36,22+len*.02/k)*k;
  function wid(t){ return Math.max(0,(wHead-1)*Math.pow(1-t,.75))+(t<1?1:0); }
  for(i=0;i<=N;i++){ var n=normalAt(pts,i), w=wid(pts[i].t)/2; L.push(f1(pts[i].x+n.x*w)+" "+f1(pts[i].y+n.y*w)); R.push(f1(pts[i].x-n.x*w)+" "+f1(pts[i].y-n.y*w)); }
  var body="M"+L.join("L")+"L"+R.reverse().join("L")+"Z";
  var gid="sg"+k0, A=pts[0], B=pts[N];
  var out='<g class="sn-snake" data-head="'+head+'"><defs><linearGradient id="'+gid+'" gradientUnits="userSpaceOnUse" x1="'+f1(A.x)+'" y1="'+f1(A.y)+'" x2="'+f1(B.x)+'" y2="'+f1(B.y)+'">'+
    '<stop offset="0" stop-color="'+sk[0]+'"/><stop offset=".6" stop-color="'+sk[0]+'"/><stop offset="1" stop-color="'+sk[1]+'"/></linearGradient></defs>'+
    '<path d="'+body+'" fill="#05060c" opacity=".35" transform="translate('+f1(5*k)+" "+f1(7*k)+')"/>'+
    '<path d="'+body+'" fill="url(#'+gid+')" stroke="#0b0a12" stroke-opacity=".6" stroke-width="'+f1(3*k)+'" stroke-linejoin="round"/>';
  // the belly line: a light stripe down one side of the body
  var bl=[]; for(i=1;i<Math.round(N*.86);i++){ var nb=normalAt(pts,i), wb=wid(pts[i].t)*.28; bl.push(f1(pts[i].x+nb.x*wb)+" "+f1(pts[i].y+nb.y*wb)); }
  if(bl.length>1) out+='<path d="M'+bl.join("L")+'" fill="none" stroke="'+sk[3]+'" stroke-opacity=".38" stroke-width="'+f1(3.5*k)+'" stroke-linecap="round"/>';
  // diamonds down the back
  var d="", acc=0, every=27*k;
  for(i=2;i<N-2;i++){
    acc+=Math.hypot(pts[i].x-pts[i-1].x,pts[i].y-pts[i-1].y); if(acc<every) continue; acc=0;
    var nd=normalAt(pts,i), wd=wid(pts[i].t); if(wd<7*k) break;
    var hl=Math.min(11*k,wd*.42), hw=wd*.3, p=pts[i];
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
  out+='<path class="sn-glow" d="'+body+'" fill="none" stroke="#ffe9a8" stroke-width="'+f1(9*k)+'" stroke-linejoin="round" opacity="0"/>';
  out+='<circle class="sn-warn" cx="'+f1(A.x)+'" cy="'+f1(A.y)+'" r="'+f1(44*k)+'" fill="none" stroke="#ff6b6b" stroke-width="'+f1(5*k)+'" opacity="0"/></g>';
  st.snakes[head]={pts:pts,tail:tail};
  return out;
}

/* ---------- ladders: two gilded rails with rungs; the climb steps on every rung (Leela: a gilded arrow instead) ---------- */
function ladderSVG(foot,top,k0,k,arrow){
  var A=centre(foot), B=centre(top), dx=B.x-A.x, dy=B.y-A.y, len=Math.sqrt(dx*dx+dy*dy)||1, ux=dx/len, uy=dy/len, nx=-uy, ny=ux, hw=17*k, ext=18*k;
  var a={x:A.x-ux*ext,y:A.y-uy*ext}, b={x:B.x+ux*ext,y:B.y+uy*ext};
  var rail=function(s){ return "M"+f1(a.x+nx*hw*s)+" "+f1(a.y+ny*hw*s)+"L"+f1(b.x+nx*hw*s)+" "+f1(b.y+ny*hw*s); };
  var nr=Math.max(3,Math.round(len/(40*k))), gap=len/nr, rungs="", mids=[];
  for(var i=0;i<=nr;i++){ var t=Math.min(len,i*gap), cx=A.x+ux*t, cy=A.y+uy*t; mids.push({x:cx,y:cy});
    if(i>0&&i<nr) rungs+="M"+f1(cx+nx*hw)+" "+f1(cy+ny*hw)+"L"+f1(cx-nx*hw)+" "+f1(cy-ny*hw); }
  var gid="lg"+k0;
  st.ladders[foot]={mids:mids,top:top};
  var grad='<defs><linearGradient id="'+gid+'" gradientUnits="userSpaceOnUse" x1="'+f1(a.x+nx*hw)+'" y1="'+f1(a.y+ny*hw)+'" x2="'+f1(a.x-nx*hw)+'" y2="'+f1(a.y-ny*hw)+'">'+
    '<stop offset="0" stop-color="#fff0c4"/><stop offset=".45" stop-color="#d9b06a"/><stop offset="1" stop-color="#8f6428"/></linearGradient></defs>';
  if(arrow){   // an arrow (Leela's "snakes and arrows"): a gilded shaft, a head at the top, fletching at the foot
    var tip={x:B.x+ux*ext*1.2,y:B.y+uy*ext*1.2}, hb={x:tip.x-ux*34*k,y:tip.y-uy*34*k}, sh="M"+f1(a.x)+" "+f1(a.y)+"L"+f1(hb.x)+" "+f1(hb.y);
    var head="M"+f1(tip.x)+" "+f1(tip.y)+"L"+f1(hb.x+nx*20*k)+" "+f1(hb.y+ny*20*k)+"L"+f1(hb.x-nx*20*k)+" "+f1(hb.y-ny*20*k)+"Z";
    var fl=""; for(var q=0;q<3;q++){ var fx=a.x+ux*(10+q*13)*k, fy=a.y+uy*(10+q*13)*k; fl+="M"+f1(fx)+" "+f1(fy)+"l"+f1((nx*16-ux*12)*k)+" "+f1((ny*16-uy*12)*k)+"M"+f1(fx)+" "+f1(fy)+"l"+f1((-nx*16-ux*12)*k)+" "+f1((-ny*16-uy*12)*k); }
    return '<g class="sn-ladder sn-arrowl" data-foot="'+foot+'">'+grad+
      '<path d="'+sh+fl+'" fill="none" stroke="#05060c" stroke-opacity=".4" stroke-width="'+f1(12*k)+'" transform="translate('+f1(5*k)+" "+f1(7*k)+')" stroke-linecap="round"/>'+
      '<path d="'+sh+fl+'" fill="none" stroke="#2a1a08" stroke-width="'+f1(13*k)+'" stroke-linecap="round"/><path d="'+sh+fl+'" fill="none" stroke="url(#'+gid+')" stroke-width="'+f1(8*k)+'" stroke-linecap="round"/>'+
      '<path d="'+head+'" fill="url(#'+gid+')" stroke="#2a1a08" stroke-width="'+f1(4*k)+'" stroke-linejoin="round"/>'+
      '<path class="sn-glow" d="'+sh+head+'" fill="none" stroke="#fff2c0" stroke-width="'+f1(14*k)+'" stroke-linecap="round" opacity="0"/></g>';
  }
  var rails=rail(1)+rail(-1);
  return '<g class="sn-ladder" data-foot="'+foot+'">'+grad+
    '<path d="'+rails+rungs+'" fill="none" stroke="#05060c" stroke-opacity=".4" stroke-width="'+f1(12*k)+'" transform="translate('+f1(5*k)+" "+f1(7*k)+')" stroke-linecap="round"/>'+
    '<path d="'+rungs+'" fill="none" stroke="#2a1a08" stroke-width="'+f1(10*k)+'" stroke-linecap="round"/><path d="'+rungs+'" fill="none" stroke="url(#'+gid+')" stroke-width="'+f1(6*k)+'" stroke-linecap="round"/>'+
    '<path d="'+rails+'" fill="none" stroke="#2a1a08" stroke-width="'+f1(13*k)+'" stroke-linecap="round"/><path d="'+rails+'" fill="none" stroke="url(#'+gid+')" stroke-width="'+f1(8*k)+'" stroke-linecap="round"/>'+
    '<path d="'+rails+'" fill="none" stroke="#fff6dc" stroke-opacity=".45" stroke-width="'+f1(2*k)+'" stroke-linecap="round" transform="translate('+f1(nx*-2*k)+" "+f1(ny*-2*k)+')"/>'+
    '<path class="sn-glow" d="'+rails+rungs+'" fill="none" stroke="#fff2c0" stroke-width="'+f1(14*k)+'" stroke-linecap="round" opacity="0"/></g>';
}

/* ---------- the squares ---------- */
function sectorPath(t){
  var c=500, p=function(r,a){ return f1(c+r*Math.cos(a))+" "+f1(c+r*Math.sin(a)); };
  return "M"+p(t.rO,t.a1)+"A"+t.rO+" "+t.rO+" 0 0 0 "+p(t.rO,t.a2)+"L"+p(t.rI,t.a2)+"A"+t.rI+" "+t.rI+" 0 0 1 "+p(t.rI,t.a1)+"Z";
}
function starPath(x,y,s){   // the crest's star, centred on (x, y), s = the square's size / 100
  return "M"+f1(x)+" "+f1(y-28*s)+"l"+f1(8.5*s)+" "+f1(17.5*s)+" "+f1(19.3*s)+" "+f1(2.8*s)+"-"+f1(14*s)+" "+f1(13.6*s)+" "+f1(3.3*s)+" "+f1(19.2*s)+
    "L"+f1(x)+" "+f1(y+16*s)+"l-"+f1(17.1*s)+" "+f1(9.1*s)+" "+f1(3.3*s)+"-"+f1(19.2*s)+"-"+f1(14*s)+"-"+f1(13.6*s)+" "+f1(19.3*s)+"-"+f1(2.8*s)+"z";
}
function tilesSVG(gm){
  var sq="", n, t, goal=gm.goal, top=gm.top, rect10=gm.kind==="rows"&&gm.cs===100;
  for(n in gm.T){
    n=+n; t=gm.T[n];
    if(t.kind==="disc"){
      sq+='<circle cx="500" cy="500" r="'+t.r+'" fill="url(#snCrest)"/><path d="'+starPath(500,500,t.r/55)+'" fill="#7a4e14" fill-opacity=".55"/>'; continue;
    }
    if(t.kind==="sector"){ sq+='<path d="'+sectorPath(t)+'" fill="url(#snSq'+(t.odd?"B":"A")+')" stroke="#0b0a12" stroke-opacity=".5" stroke-width="2"/>'; continue; }
    var x=f1(t.x), y=f1(t.y), w=f1(t.w), s=t.w/100;
    if(n===goal){
      if(top){   // the Jaina liberation square: an arch on the temple's top
        sq+='<path d="M'+x+" "+f1(t.y+t.h)+"V"+f1(t.y+t.h*.42)+"A"+f1(t.w/2)+" "+f1(t.h*.42)+" 0 0 1 "+f1(t.x+t.w)+" "+f1(t.y+t.h*.42)+"V"+f1(t.y+t.h)+'Z" fill="url(#snCrest)" stroke="#e7ca90" stroke-opacity=".7" stroke-width="2"/>';
        sq+='<path d="'+starPath(t.x+t.w/2,t.y+t.h*.62,s*.8)+'" fill="#7a4e14" fill-opacity=".55"/>';
      } else {
        sq+='<rect x="'+x+'" y="'+y+'" width="'+w+'" height="'+w+'" fill="url(#snCrest)"/>'+(rect10?'<path d="M'+(t.x+50)+' '+(t.y+22)+'l8.5 17.5 19.3 2.8-14 13.6 3.3 19.2L'+(t.x+50)+' '+(t.y+66)+'l-17.1 9.1 3.3-19.2-14-13.6 19.3-2.8z" fill="#7a4e14" fill-opacity=".55"/>'
          :'<path d="'+starPath(t.x+t.w/2,t.y+t.h*.5,s)+'" fill="#7a4e14" fill-opacity=".55"/>');
      }
      continue;
    }
    var fill=top&&n>=top?"url(#snSqT)":"url(#snSq"+(t.odd?"B":"A")+")";
    sq+='<rect x="'+x+'" y="'+y+'" width="'+w+'" height="'+w+'" fill="'+fill+'"'+(rect10?"":' stroke="#0b0a12" stroke-opacity=".45" stroke-width="2"')+"/>";
  }
  return sq;
}
function frameSVG(gm){
  if(gm.kind==="rows"&&gm.cs===100) return gridLines();
  if(gm.kind==="rows"){ var b=gm.box; return '<rect x="'+f1(b.x+1)+'" y="'+f1(b.y+1)+'" width="'+f1(b.w-2)+'" height="'+f1(b.h-2)+'" fill="none" stroke="#e7ca90" stroke-opacity=".5" stroke-width="2"/>'; }
  if(gm.kind==="spiral") return '<circle cx="500" cy="500" r="497" fill="none" stroke="#e7ca90" stroke-opacity=".55" stroke-width="3"/>';
  return "";
}
function gridLines(){ var d=""; for(var i=1;i<10;i++) d+="M"+i*100+" 0V1000M0 "+i*100+"H1000"; return '<path d="'+d+'" stroke="#0b0a12" stroke-opacity=".45" stroke-width="2"/><rect x="1" y="1" width="998" height="998" fill="none" stroke="#e7ca90" stroke-opacity=".5" stroke-width="2"/>'; }
/* a Jaina footprint: a pair of gold prints low in the square and a chevron to the square above (the token goes straight up) */
function footSVG(gm,n){
  var t=gm.T[n]; if(!t||t.kind!=="rect") return "";
  var s=t.w/100, x=t.x+t.w*.72, y=t.y+t.h*.74, d="";
  d+='<ellipse cx="'+f1(x-7*s)+'" cy="'+f1(y+3*s)+'" rx="'+f1(5*s)+'" ry="'+f1(9*s)+'"/><ellipse cx="'+f1(x+7*s)+'" cy="'+f1(y-5*s)+'" rx="'+f1(5*s)+'" ry="'+f1(9*s)+'"/>';
  return '<g class="sn-foot" data-step="'+n+'" fill="#f0d48a" fill-opacity=".85">'+d+'<path d="M'+f1(t.x+t.w*.5-10*s)+" "+f1(t.y+9*s)+"l"+f1(10*s)+" -"+f1(8*s)+" "+f1(10*s)+" "+f1(8*s)+'" fill="none" stroke="#f0d48a" stroke-opacity=".85" stroke-width="'+f1(3.5*s)+'" stroke-linecap="round" stroke-linejoin="round"/></g>';
}

/* ---------- the whole board ---------- */
function railText(gm,short){ if(gm.start>0) return short?"Start: 1":"Start: on square 1"; if(gm.need6) return short?"A 6 to enter":"Start: a 6 to enter"; return short?"Start":"Start: off the board"; }
function build(host,L,bd){
  host=typeof host==="string"?document.querySelector(host):host; if(!host) return null;
  st.host=host; st.L=L||{}; st.bd=bd||"vic"; st.snakes={}; st.ladders={}; st.gm=geom(st.bd);
  var gm=st.gm, k=gm.k, P=PAL[st.bd]||PAL.vic, nums="", i;
  var defs='<defs><linearGradient id="snSqA" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="'+P.a2+'"/><stop offset="1" stop-color="'+P.a+'"/></linearGradient>'+
    '<linearGradient id="snSqB" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="'+P.b2+'"/><stop offset="1" stop-color="'+P.b+'"/></linearGradient>'+
    '<linearGradient id="snSqT" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#a87420"/><stop offset="1" stop-color="#6e4810"/></linearGradient>'+
    '<radialGradient id="snGloss" cx=".3" cy=".18" r=".95"><stop offset="0" stop-color="#fff" stop-opacity=".16"/><stop offset=".55" stop-color="#fff" stop-opacity=".03"/><stop offset="1" stop-color="#000" stop-opacity=".22"/></radialGradient>'+
    '<radialGradient id="snCrest" cx=".5" cy=".45" r=".7"><stop offset="0" stop-color="#fff4cf"/><stop offset=".5" stop-color="#e2bd72"/><stop offset="1" stop-color="#9c6c2c"/></radialGradient>'+
    '<radialGradient id="snBurst" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#fff6d8" stop-opacity=".95"/><stop offset=".45" stop-color="#f3c96a" stop-opacity=".5"/><stop offset="1" stop-color="#f3c96a" stop-opacity="0"/></radialGradient>'+
    '<linearGradient id="snRail" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1b1830"/><stop offset="1" stop-color="#0c0b18"/></linearGradient></defs>';
  var sq=tilesSVG(gm);
  // ladder foot and snake head squares carry a soft ring, so the start of every ladder and snake is easy to find
  var marks="";
  Object.keys(st.L).forEach(function(kk){ var a=+kk, b=+st.L[kk], t=gm.T[a], c=centre(a), col=b>a?"#f0d48a":"#ff8a8a";
    if(!t) return;
    if(t.kind==="rect") marks+='<rect x="'+f1(t.x+t.w*.04)+'" y="'+f1(t.y+t.h*.04)+'" width="'+f1(t.w*.92)+'" height="'+f1(t.h*.92)+'" rx="'+f1(10*k)+'" fill="none" stroke="'+col+'" stroke-opacity=".5" stroke-width="3"/>';
    else marks+='<circle cx="'+f1(c.x)+'" cy="'+f1(c.y)+'" r="'+f1(38*k)+'" fill="none" stroke="'+col+'" stroke-opacity=".5" stroke-width="3"/>'; });
  if(gm.steps) Object.keys(gm.steps).forEach(function(f){ marks+=footSVG(gm,+f); });
  var lad="", sn="", k0=0;
  Object.keys(st.L).forEach(function(kk){ var a=+kk, b=+st.L[kk]; if(b>a) lad+=ladderSVG(a,b,k0++,k,gm.arrows); });
  var ks=0; Object.keys(st.L).sort(function(x,y){ return (+st.L[y]-+y)-(+st.L[x]-+x); }).forEach(function(kk){ var a=+kk, b=+st.L[kk]; if(b<a){ sn+=snakeSVG(a,b,ks+100,k); ks++; } });
  for(i in gm.T){ i=+i; nums+='<text class="sn-num'+(i===gm.goal?" is-100":"")+(gm.T[i].kind!=="rect"?" is-mid":"")+'" data-n="'+i+'" x="0" y="0">'+i+"</text>"; }
  var rail='<rect x="0" y="'+RAIL+'" width="'+W+'" height="'+(H-RAIL)+'" fill="url(#snRail)"/><path d="M0 '+(RAIL+1)+'H'+W+'" stroke="#e7ca90" stroke-opacity=".55" stroke-width="2"/>'+
    '<path d="M50 '+(RAIL-4)+'l-12 14h24z" fill="#e7ca90" fill-opacity=".7"/>'+
    '<text class="sn-railtxt" x="'+(W-18)+'" y="'+(RAIL+35)+'">'+railText(gm,false)+'</text>';
  var crest='<g class="sn-crestfx" opacity="0"><circle cx="50" cy="50" r="'+f1(150*k)+'" fill="url(#snBurst)"/></g>';
  host.innerHTML='<svg class="sn-svg" viewBox="0 0 '+W+" "+H+'" preserveAspectRatio="xMidYMid meet" aria-hidden="true" focusable="false">'+defs+
    '<g class="sn-sq">'+sq+'</g><rect width="1000" height="1000" fill="url(#snGloss)"/><g class="sn-grid">'+frameSVG(gm)+'</g>'+marks+
    '<g class="sn-lads">'+lad+'</g><g class="sn-snks">'+sn+'</g><g class="sn-nums">'+nums+'</g>'+rail+crest+'</svg>';
  st.svg=host.querySelector("svg"); st.numEls=[].slice.call(st.svg.querySelectorAll(".sn-num, .sn-railtxt")); st.numPx=0;
  placeNumbers(Math.max(24,Math.round(24*k)));
  return st.svg;
}
function placeNumbers(fs){
  var gm=cur();
  st.numEls.forEach(function(t){
    if(t.classList.contains("sn-railtxt")) return;
    var n=+t.getAttribute("data-n"), c=gm.T[n]; if(!c) return;
    t.setAttribute("font-size",fs);
    if(c.kind==="rect"){ t.setAttribute("x",String(f1(c.x+7*gm.k))); t.setAttribute("y",String(f1(c.y+fs*.92))); }
    else { t.setAttribute("x",String(f1(c.num.x))); t.setAttribute("y",String(f1(c.num.y+fs*.36))); }
  });
}

/* the square numbers stay at or above the text floor (phone 12 px, TV 21 px of the 1080p frame) at any board size: unitsPx = screen px per unit */
function numbers(unitPx,floorPx){
  if(!st.svg||!unitPx) return;
  var gm=cur(), fs=Math.max(Math.round(24*gm.k),Math.ceil((floorPx+.4)/unitPx));
  if(fs===st.numPx) return; st.numPx=fs;
  placeNumbers(fs);
  st.numEls.forEach(function(t){
    if(!t.classList.contains("sn-railtxt")) return;
    t.setAttribute("font-size",Math.max(30,fs));
    t.textContent=railText(gm,fs>38);   // a small board: the short words keep the text floor
    t.setAttribute("y",String(RAIL+35+Math.max(0,fs-30)*.35));
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
function crest(ms){ var c=st.svg&&st.svg.querySelector(".sn-crestfx"); if(!c||!c.animate) return; var c0=centre(cur().goal);
  c.setAttribute("transform","translate("+f1(c0.x-50)+" "+f1(c0.y-50)+")");
  try{ c.animate([{opacity:0},{opacity:1,offset:.25},{opacity:0}],{duration:ms,easing:"ease-out"}); }catch(e){} }
function snakePts(head){ var s=st.snakes[head]; return s?s.pts:null; }
function rungs(foot){
  var l=st.ladders[foot]; if(l) return l.mids;
  var gm=cur(), to=gm.steps&&gm.steps[foot]; if(to==null) return null;   // a footprint: a short straight step up
  var A=centre(foot), B=centre(to), out=[]; for(var i=0;i<=3;i++) out.push({x:A.x+(B.x-A.x)*i/3,y:A.y+(B.y-A.y)*i/3}); return out;
}

/* ---------- a small picture of a board for the picker (flat fills, no numbers: the same layout and colours as the board itself) ---------- */
var PREV={};
function preview(bd,nums){
  var key=bd+(nums?"#n":"");
  if(PREV[key]) return PREV[key];
  var e=E(), shuffle=bd==="shuffle", gm=geom(bd), P=PAL[bd]||PAL.vic, k=gm.k, L=shuffle?{12:47,31:68,58:92,97:63,74:28,43:8}:(e&&e.BOARDS[bd]?e.BOARDS[bd].L:{}), out="", n, t, kk;
  for(n in gm.T){ n=+n; t=gm.T[n];
    var fill=n===gm.goal?"#e2bd72":gm.top&&n>=gm.top?"#8c6018":(t.odd?P.b2:P.a2);
    if(t.kind==="disc") out+='<circle cx="500" cy="500" r="'+t.r+'" fill="#e2bd72"/>';
    else if(t.kind==="sector") out+='<path d="'+sectorPath(t)+'" fill="'+fill+'" stroke="#0b0a12" stroke-width="4"/>';
    else out+='<rect x="'+f1(t.x)+'" y="'+f1(t.y)+'" width="'+f1(t.w)+'" height="'+f1(t.h)+'" fill="'+fill+'" stroke="#0b0a12" stroke-width="4"/>'; }
  var pc=function(q){ var p=gm.P[q]; return p||{x:50,y:950}; };
  for(kk in L){ var a=+kk, b=+L[kk], A=pc(a), B=pc(b), dx=B.x-A.x, dy=B.y-A.y, len=Math.sqrt(dx*dx+dy*dy)||1, nx=-dy/len, ny=dx/len;
    if(b>a){ var hw=20*k, r="";
      if(gm.arrows) out+='<path d="M'+f1(A.x)+" "+f1(A.y)+"L"+f1(B.x)+" "+f1(B.y)+'" stroke="#f0d48a" stroke-width="'+f1(16*k)+'" stroke-linecap="round"/><circle cx="'+f1(B.x)+'" cy="'+f1(B.y)+'" r="'+f1(20*k)+'" fill="#f0d48a"/>';
      else { for(var i=1;i<Math.max(2,Math.round(len/(70*k)));i++){ var tt=i/Math.max(2,Math.round(len/(70*k))), cx=A.x+dx*tt, cy=A.y+dy*tt; r+="M"+f1(cx+nx*hw)+" "+f1(cy+ny*hw)+"L"+f1(cx-nx*hw)+" "+f1(cy-ny*hw); }
        out+='<path d="M'+f1(A.x+nx*hw)+" "+f1(A.y+ny*hw)+"L"+f1(B.x+nx*hw)+" "+f1(B.y+ny*hw)+"M"+f1(A.x-nx*hw)+" "+f1(A.y-ny*hw)+"L"+f1(B.x-nx*hw)+" "+f1(B.y-ny*hw)+r+'" fill="none" stroke="#f0d48a" stroke-width="'+f1(10*k)+'" stroke-linecap="round"'+(shuffle?' stroke-dasharray="'+f1(26*k)+" "+f1(18*k)+'"':"")+"/>"; }
    } else { var sk=SKINS[(a+b)%SKINS.length], s=(hash(a+":"+b)%2?1:-1)*Math.min(70*k,len*.25), mx=(A.x+B.x)/2+nx*s, my=(A.y+B.y)/2+ny*s;
      out+='<path d="M'+f1(A.x)+" "+f1(A.y)+"Q"+f1(mx)+" "+f1(my)+" "+f1(B.x)+" "+f1(B.y)+'" fill="none" stroke="'+sk[0]+'" stroke-width="'+f1(22*k)+'" stroke-linecap="round"'+(shuffle?' stroke-dasharray="'+f1(30*k)+" "+f1(20*k)+'"':"")+'/><circle cx="'+f1(A.x)+'" cy="'+f1(A.y)+'" r="'+f1(22*k)+'" fill="'+sk[0]+'" stroke="#0b0a12" stroke-width="4"/>'; } }
  if(gm.steps) for(kk in gm.steps){ var f=pc(+kk); out+='<circle cx="'+f1(f.x)+'" cy="'+f1(f.y)+'" r="'+f1(12*k)+'" fill="#f0d48a"/>'; }
  if(nums){ var nt="";   // the big preview: every square's number (sized by previewFit to the text floor; top-left of a square, centred on a ring)
    for(n in gm.T){ n=+n; t=gm.T[n];
      if(t.kind==="rect") nt+='<text class="sn-num'+(n===gm.goal?" is-100":"")+'" x="'+f1(t.x+6*k)+'" y="'+f1(t.y+5*k)+'" dominant-baseline="hanging">'+n+"</text>";
      else nt+='<text class="sn-num is-mid'+(n===gm.goal?" is-100":"")+'" x="'+f1(t.num.x)+'" y="'+f1(t.kind==="disc"?500:t.num.y)+'" dominant-baseline="central">'+n+"</text>"; }
    out+='<g class="sn-pnums" font-size="'+Math.round(24*k)+'">'+nt+"</g>"; }
  return (PREV[key]='<svg class="sn-prevsvg'+(nums?" sn-prevsvg--big":"")+'" viewBox="0 0 1000 1000" aria-hidden="true" focusable="false">'+out+"</svg>");
}
/* size the big preview's numbers for its drawn size: at or above the text floor (unitPx = screen px per unit), shown only when every
   number fits its square (a two-digit number is about 1.15 em wide); returns the size used, or 0 when the numbers are hidden */
function previewFit(svg,bd,unitPx,floorPx){
  var g=svg&&svg.querySelector(".sn-pnums"); if(!g||!unitPx) return 0;
  var gm=geom(bd), fs=Math.max(Math.round(24*gm.k),Math.ceil((floorPx+.4)/unitPx)), room=1e9, n, t;
  for(n in gm.T){ t=gm.T[n];
    if(t.kind==="rect") room=Math.min(room,t.w,t.h);
    else if(t.kind==="sector") room=Math.min(room,t.rO-t.rI,(t.rO+t.rI)/2*Math.abs(t.a1-t.a2)); }
  var ok=fs*1.15<=room*.92;
  g.setAttribute("font-size",String(fs)); g.style.display=ok?"":"none";
  // a three-digit number (100 on a square of a 10 x 10 board) that would run into the next square is left out: the gold goal square
  // still marks it (a small sideways phone preview), never two numbers overlapping
  [].forEach.call(g.querySelectorAll(".sn-num"),function(t){ var n=+t.textContent, c=gm.T[n]; if(!c||c.kind!=="rect"||t.textContent.length<3) return;
    t.style.display=fs*.6*t.textContent.length+6*gm.k<=c.w?"":"none"; });
  return ok?fs:0;
}

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
  geom:geom,scale:scale,preview:preview,previewFit:previewFit,state:function(){ return st; }};
})(window);
