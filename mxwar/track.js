/* MOTOCROSS WAR v2 — the TRACK view (the CEO, 2026-10-16 ~18:30: "I want it where it's smooth, where they ride up and actually pass each
   other. They should be riding the whole time, and he should be riding the actual track, and going through the whoop section and jumping
   the ramps."). window.MXWar.Track.create(host) -> a view. Original art only: plain shapes and gradients drawn on two canvases (no images
   from outside, no logos, no text but the riders' plate numbers).
   - The round's track is drawn as a LOOP, seeded by the venue (every city its own layout): a stadium Supercross track (the start straight
     with the gate and the finish line, 180-degree turns, a whoop section, a triple and rhythm jumps, the return straight) or an outdoor
     national (a longer winding loop over hills with big tabletops and rollers). Built once per layout into a static background canvas.
   - Every rider is a small bike in team colours with their plate riding continuously round it. The leader's lap follows the race (one
     battle = one lap: the leader crosses the finish line just after the lap is decided, the pace learnt from the real lap times;
     a lap that runs late (a person thinking, a long war) eases the field toward the line, never past it uncounted). Everyone else rides behind the leader at a gap from the standings (a bike's
     length a place, plus a little per card behind), so a change of places is a smooth ride-up and overtake: the gap eases to its new
     size and the rider moving up swings to the inside line to pass. Bikes bob through the whoops and arc over the jumps (a shadow on the
     ground under them), lean into the slopes and face the way they ride. The points leader's plate is RED.
   - Cheap: one requestAnimationFrame loop drawing pre-rendered sprites (one bike image per team colour and direction, one plate image per
     rider, one shadow) with transforms only: 2-3 drawImage calls a rider a frame. It stops while the page is hidden or the race isn't on
     screen (stop()). "Reduce effects" = simpler motion (no bob, arcs or shadows) at 30 frames a second, still smooth; reduced motion =
     no continuous motion at all (the bikes are drawn where they stand after every lap).
   mxtime (the CEO, 2026-10-17: "the cards decide REAL lap times"): with a race that has G.tm (setModel) the view rides a RACE CLOCK instead of a standings
   table: every rider is drawn where MXWar.Time says he is at that clock (progressAt: laps + phase, a crash hold, the yellow section), so the picture
   matches the times; the clock may not pass the leader's line crossing of the last lap decided (the next lap's cards turn as the leader starts it);
   the falls, the yellow flag, the passes, the lapped riders and every rider's line are handed to onEvent in clock order. Without a model the view
   rides as before. */
(function(g){
"use strict";
var MX=g.MXWar=g.MXWar||{};
if(MX.Track) return;
var PI=Math.PI, TAU=PI*2;
function clamp(x,a,b){ return x<a?a:x>b?b:x; }
function hash(s){ var h=2166136261>>>0; s=String(s||""); for(var i=0;i<s.length;i++){ h^=s.charCodeAt(i); h=Math.imul(h,16777619)>>>0; } return h>>>0; }
function rng(seed){ var t=seed>>>0; return function(){ t=(t+0x6D2B79F5)>>>0; var x=Math.imul(t^(t>>>15),t|1); x^=x+Math.imul(x^(x>>>7),x|61); return ((x^(x>>>14))>>>0)/4294967296; }; }
function now(){ return (g.performance&&performance.now)?performance.now():Date.now(); }

/* ---------------- the course: a polyline sampled every ~2 px with the section marks ---------------- */
function Course(){ this.x=[]; this.y=[]; this.a=[]; this.s=[]; this.L=0; this.f=[]; }
Course.prototype.add=function(x,y){
  var n=this.x.length;
  if(n){ var dx=x-this.x[n-1], dy=y-this.y[n-1], d=Math.sqrt(dx*dx+dy*dy); if(d<0.01) return; this.s.push(this.s[n-1]+d); } else this.s.push(0);
  this.x.push(x); this.y.push(y);
};
Course.prototype.line=function(x0,y0,x1,y1){ var d=Math.hypot(x1-x0,y1-y0), n=Math.max(2,Math.ceil(d/2)); for(var i=(this.x.length?1:0);i<=n;i++) this.add(x0+(x1-x0)*i/n,y0+(y1-y0)*i/n); };
Course.prototype.arc=function(cx,cy,r,t0,t1){ var n=Math.max(4,Math.ceil(Math.abs(t1-t0)*r/2)); for(var i=1;i<=n;i++){ var t=t0+(t1-t0)*i/n; this.add(cx+r*Math.cos(t),cy+r*Math.sin(t)); } };
Course.prototype.close=function(){
  var n=this.x.length, dx=this.x[0]-this.x[n-1], dy=this.y[0]-this.y[n-1];
  this.L=this.s[n-1]+Math.sqrt(dx*dx+dy*dy);
  for(var i=0;i<n;i++){ var j=(i+1)%n, k=(i+n-1)%n; this.a.push(Math.atan2(this.y[j]-this.y[k],this.x[j]-this.x[k])); }
};
/* the point at arc length s (wraps): {x, y, a} by interpolation (binary search over s) */
Course.prototype.at=function(s,out){
  var L=this.L; s=((s%L)+L)%L;
  var S=this.s, lo=0, hi=S.length-1;
  if(s>=S[hi]){ var n=hi, f=(s-S[n])/Math.max(1e-6,L-S[n]); out.x=this.x[n]+(this.x[0]-this.x[n])*f; out.y=this.y[n]+(this.y[0]-this.y[n])*f; out.a=this.a[n]; return out; }
  while(hi-lo>1){ var m=(lo+hi)>>1; if(S[m]<=s) lo=m; else hi=m; }
  var t=(s-S[lo])/Math.max(1e-6,S[hi]-S[lo]);
  out.x=this.x[lo]+(this.x[hi]-this.x[lo])*t; out.y=this.y[lo]+(this.y[hi]-this.y[lo])*t;
  var a0=this.a[lo], a1=this.a[hi], da=a1-a0; if(da>PI) da-=TAU; else if(da<-PI) da+=TAU; out.a=a0+da*t;
  return out;
};
/* sections: {k: "jump" | "whoops" | "hill" | "rollers", s0, s1, h, n} */
Course.prototype.feature=function(s){
  var L=this.L; s=((s%L)+L)%L;
  for(var i=0;i<this.f.length;i++){ var F=this.f[i]; if(s>=F.s0&&s<=F.s1) return F; }
  return null;
};

/* a stadium track (Supercross): 4 rows joined by 180-degree turns, the return straight on the left; the venue seeds the row lengths and
   which row gets the whoops, the triple and the rhythm */
function stadium(W,H,key,hole){
  var R=rng(hash("sx|"+key)), C=new Course();
  var stands=Math.round(H*0.15), mB=Math.max(6,H*0.05), m=Math.max(8,W*0.03);
  /* the card window sits over the bottom-right corner: on a wide arena rows 2 and 3 (and the turn between them) end short of it; where
     that would leave them too short (a phone upright) the whole course rides above it (the band beside it holds the pits) */
  var tw, y0, y3, gap, r, q, y1, y2, xV, xL, xLi, xMax, lim=0, side=false;
  function geo(mb){ tw=clamp(Math.round((H-stands-mb)*0.1),8,30); y0=stands+tw*0.9; y3=H-mb-tw*0.6; gap=(y3-y0)/3; r=gap/2; q=Math.min(gap*0.45,W*0.05);
    y1=y0+gap; y2=y1+gap; xV=m+tw*0.6; xL=xV+q; xLi=xV+tw*1.15+r+Math.max(2,W*0.008); xMax=W-m-tw*0.6-r; }
  geo(mB);
  if(hole&&hole.w>0&&hole.w<W*0.5){ lim=W-hole.w-r-tw*1.1-4; if(lim-xLi>=W*0.22) side=true; else { mB=Math.max(mB,hole.h+2); geo(mB); } }
  var xR0=xMax-R()*W*0.07, xR2=xMax-R()*W*0.07;
  if(side) xR2=Math.min(xR2,lim);
  C.line(xL,y0,xR0,y0);              // row 0: the start straight, the gate, the finish line
  var e0=C.s[C.s.length-1];
  C.arc(xR0,y0+r,r,-PI/2,PI/2);      // the first turn
  var b1=C.s[C.s.length-1];
  C.line(xR0,y1,xLi,y1); var e1=C.s[C.s.length-1];
  C.arc(xLi,y1+r,r,-PI/2,-PI*1.5);
  var b2=C.s[C.s.length-1];
  C.line(xLi,y2,xR2,y2); var e2=C.s[C.s.length-1];
  C.arc(xR2,y2+r,r,-PI/2,PI/2);
  var b3=C.s[C.s.length-1];
  C.line(xR2,y3,xL,y3); var e3=C.s[C.s.length-1];
  C.arc(xL,y3-q,q,PI/2,PI);          // into the return straight
  C.line(xV,y3-q,xV,y0+q);
  C.arc(xL,y0+q,q,PI,PI*1.5);
  C.close();
  var rows=[[0,e0],[b1,e1],[b2,e2],[b3,e3]], len=function(k){ return rows[k][1]-rows[k][0]; }, at=function(k,f){ return rows[k][0]+len(k)*f; };
  /* the gate and the finish line on row 0: the finish line just before the gate (a lap = gate round to the line, then line to line) */
  C.fin=at(0,0.24); C.gate=at(0,0.52); C.gateLine=at(0,0.04);
  var whoopRow=R()<0.5?1:2, tripleRow=3, rhythmRow=whoopRow===1?2:1;
  C.f.push({k:"whoops",s0:at(whoopRow,0.18),s1:at(whoopRow,0.78),h:Math.max(1.2,tw*0.16),n:Math.round(9+R()*5)});
  C.f.push({k:"jump",s0:at(tripleRow,0.22+R()*0.08),s1:at(tripleRow,0.62+R()*0.08),h:gap*0.62});
  var nr=2+Math.floor(R()*2);
  for(var i=0;i<nr;i++){ var a=0.12+i*(0.76/nr); C.f.push({k:"jump",s0:at(rhythmRow,a),s1:at(rhythmRow,a+0.62/nr),h:gap*0.34}); }
  C.f.push({k:"jump",s0:at(0,0.78),s1:at(0,0.95),h:gap*0.3});    // the jump into the first turn
  C.f.sort(function(a,b){ return a.s0-b.s0; });
  C.kind="stadium"; C.tw=tw; C.stands=stands; C.rowY=[y0,y1,y2,y3]; C.gap=gap; C.W=W; C.H=H;
  C.dirt=["#6b4a2f","#7a5233","#5d4330","#80583a"][Math.floor(R()*4)];
  return C;
}
/* an outdoor national (Pro Motocross): a longer winding loop over the land; hills, big tabletops and rollers; the start straight at the
   bottom of the loop, run left to right */
function outdoor(W,H,key,hole){
  var R=rng(hash("mx|"+key)), C=new Course();
  var sky=Math.round(H*0.16), m=Math.max(8,W*0.03), mB=Math.max(6,H*0.05);
  if(hole&&hole.w>0&&hole.w>=W*0.36&&hole.w<W*0.5) mB=Math.max(mB,hole.h+2);   /* a narrow arena: the loop rides above the card window */
  var tw=clamp(Math.round((H-sky-mB)*0.085),7,26);
  var cx=W/2, cy=(sky+tw+H-mB)/2, rx=W/2-m-tw, ry=(H-mB-sky-tw)/2-tw*0.4;
  var N=11, pts=[];
  for(var i=0;i<N;i++){
    var t=PI/2-i*TAU/N+(R()-0.5)*0.25, k=i===0?1:0.66+R()*0.34;   // point 0 at the bottom (the start straight)
    pts.push([cx+Math.cos(t)*rx*k,cy+Math.sin(t)*ry*(i===0?1:(0.62+R()*0.38))]);
  }
  /* a flat start straight: the bottom point becomes a straight run */
  var p0=pts[0]; pts[0]=[p0[0]-rx*0.32,cy+ry]; pts.unshift([p0[0]+rx*0.32,cy+ry]);
  /* the card window sits over the bottom-right corner: the start straight ends short of it and the loop's points there move up */
  if(hole&&hole.w>0&&hole.w<W*0.5&&hole.w<W*0.36){ var hx=W-hole.w-tw*1.6, hy=H-hole.h-tw*1.4;
    pts.forEach(function(pt,ix){ if(pt[0]>hx&&pt[1]>hy){ if(ix<=1) pt[0]=Math.min(pt[0],hx-tw); else pt[1]=Math.max(sky+tw,hy-tw*0.6); } }); }
  pts.reverse();   // run left to right along the bottom
  var n=pts.length, seg=24, j, k2;
  function cr(a,b,c,d,t){ var t2=t*t, t3=t2*t; return 0.5*((2*b)+(-a+c)*t+(2*a-5*b+4*c-d)*t2+(-a+3*b-3*c+d)*t3); }
  for(j=0;j<n;j++){
    var P0=pts[(j-1+n)%n], P1=pts[j], P2=pts[(j+1)%n], P3=pts[(j+2)%n];
    for(k2=(j?1:0);k2<=seg;k2++){ var tt=k2/seg; C.add(cr(P0[0],P1[0],P2[0],P3[0],tt),clamp(cr(P0[1],P1[1],P2[1],P3[1],tt),sky+tw*0.7,H-mB-tw*0.4)); }
  }
  C.close();
  /* the start straight: the stretch near the bottom with the smallest turning (the sampled points round the bottom-most) */
  var lo=0; for(j=1;j<C.y.length;j++) if(C.y[j]>C.y[lo]) lo=j;
  C.gate=C.s[lo]; C.fin=(C.gate-C.L*0.06+C.L)%C.L; C.gateLine=(C.gate-C.L*0.11+C.L)%C.L;
  var L=C.L, fr=function(f){ return (C.gate+L*f)%L; };
  var spots=[[0.12,0.2,"hill"],[0.27,0.33,"jump"],[0.4,0.47,"rollers"],[0.52,0.6,"hill"],[0.64,0.7,"jump"],[0.77,0.83,"jump"],[0.87,0.92,"hill"]];
  spots.forEach(function(sp){ var a=sp[0]+(R()-0.5)*0.02, b=sp[1]+(R()-0.5)*0.02; var s0=fr(a), s1=fr(b); if(s1<s0) return;
    C.f.push({k:sp[2],s0:s0,s1:s1,h:sp[2]==="jump"?ry*0.42:sp[2]==="hill"?ry*0.16:Math.max(1.2,tw*0.18),n:sp[2]==="rollers"?5:0}); });
  C.f.sort(function(a,b){ return a.s0-b.s0; });
  C.kind="outdoor"; C.tw=tw; C.stands=sky; C.W=W; C.H=H; C.cx=cx; C.cy=cy; C.rx=rx; C.ry=ry;
  C.dirt=["#7d5a3c","#8a5f3a","#6e5136","#93683f"][Math.floor(R()*4)];
  C.seedHills=R();
  return C;
}

/* ---------------- the background (static: drawn once per layout) ---------------- */
function strokeCourse(ctx,C,from,to){
  ctx.beginPath(); var p={}; var step=2, s;
  if(from==null){ ctx.moveTo(C.x[0],C.y[0]); for(var i=1;i<C.x.length;i++) ctx.lineTo(C.x[i],C.y[i]); ctx.closePath(); }
  else { C.at(from,p); ctx.moveTo(p.x,p.y); for(s=from+step;s<to;s+=step){ C.at(s,p); ctx.lineTo(p.x,p.y); } C.at(to,p); ctx.lineTo(p.x,p.y); }
}
function drawBackground(ctx,C,W,H,fs){
  var R=rng(hash(C.kind+"|bg|"+W+"x"+H)), i, p={}, F;
  if(C.kind==="stadium"){
    var bg=ctx.createLinearGradient(0,0,0,H); bg.addColorStop(0,"#0a0810"); bg.addColorStop(0.3,"#1a1219"); bg.addColorStop(1,"#120d0c");
    ctx.fillStyle=bg; ctx.fillRect(0,0,W,H);
    /* the stands: tiers of seats and a crowd of small lights */
    var st=C.stands; var sg=ctx.createLinearGradient(0,0,0,st); sg.addColorStop(0,"#231d2c"); sg.addColorStop(1,"#15111b"); ctx.fillStyle=sg; ctx.fillRect(0,0,W,st);
    ctx.fillStyle="rgba(120,108,140,.28)"; for(i=1;i<4;i++) ctx.fillRect(0,Math.round(st*i/4),W,1);
    for(i=0;i<Math.round(W/5);i++){ var cxp=R()*W, cyp=2+R()*(st-5); ctx.fillStyle=R()<0.12?"rgba(255,226,168,.75)":R()<0.5?"rgba(170,160,190,.45)":"rgba(220,120,90,.35)"; ctx.fillRect(cxp,cyp,1.6,1.6); }
    ctx.fillStyle="#8f8a96"; ctx.fillRect(0,st-2,W,2);
    /* light pools from the rig */
    [0.2,0.5,0.8].forEach(function(fx){ var lg=ctx.createRadialGradient(W*fx,st,0,W*fx,st,H*0.9); lg.addColorStop(0,"rgba(255,240,205,.16)"); lg.addColorStop(1,"rgba(255,240,205,0)"); ctx.fillStyle=lg; ctx.fillRect(0,st,W,H-st); });
    /* the dirt floor */
    var fl=ctx.createLinearGradient(0,st,0,H); fl.addColorStop(0,"#3e2c1d"); fl.addColorStop(1,"#2a1d13"); ctx.fillStyle=fl; ctx.fillRect(0,st,W,H-st);
  } else {
    var sk=ctx.createLinearGradient(0,0,0,C.stands); sk.addColorStop(0,"#1c2a4a"); sk.addColorStop(1,"#6a7590"); ctx.fillStyle=sk; ctx.fillRect(0,0,W,C.stands);
    var gr=ctx.createLinearGradient(0,C.stands,0,H); gr.addColorStop(0,"#3a5a2c"); gr.addColorStop(1,"#1d3016"); ctx.fillStyle=gr; ctx.fillRect(0,C.stands,W,H-C.stands);
    /* far hills and a tree line */
    ctx.fillStyle="#2f4a26"; ctx.beginPath(); ctx.moveTo(0,C.stands+4); for(i=0;i<=12;i++) ctx.lineTo(W*i/12,C.stands-4-R()*C.stands*0.35); ctx.lineTo(W,C.stands+4); ctx.closePath(); ctx.fill();
    ctx.fillStyle="#17281a"; for(i=0;i<Math.round(W/14);i++){ var tx=R()*W, th=4+R()*C.stands*0.35; ctx.beginPath(); ctx.moveTo(tx,C.stands-th); ctx.lineTo(tx-th*0.4,C.stands+2); ctx.lineTo(tx+th*0.4,C.stands+2); ctx.closePath(); ctx.fill(); }
    /* hills under the track (darker mounds) */
    C.f.forEach(function(F){ if(F.k!=="hill"&&F.k!=="jump") return; C.at((F.s0+F.s1)/2,p); var hr=F.k==="hill"?C.rx*0.16:C.rx*0.09; var hg=ctx.createRadialGradient(p.x,p.y,0,p.x,p.y,hr); hg.addColorStop(0,"rgba(20,36,14,.55)"); hg.addColorStop(1,"rgba(20,36,14,0)"); ctx.fillStyle=hg; ctx.fillRect(p.x-hr,p.y-hr,hr*2,hr*2); });
  }
  var tw=C.tw;
  ctx.lineJoin="round"; ctx.lineCap="round";
  /* the berms' outer edge, then the dirt */
  strokeCourse(ctx,C); ctx.strokeStyle="rgba(0,0,0,.45)"; ctx.lineWidth=tw+5; ctx.stroke();
  if(C.kind==="stadium"){ ctx.setLineDash([Math.max(3,tw*0.5),Math.max(2,tw*0.3)]); ctx.strokeStyle="rgba(233,227,210,.85)"; ctx.lineWidth=tw+3; ctx.stroke(); ctx.setLineDash([]); }
  else { ctx.strokeStyle="rgba(201,167,124,.5)"; ctx.lineWidth=tw+2.5; ctx.stroke(); }
  ctx.strokeStyle=C.dirt; ctx.lineWidth=tw; ctx.stroke();
  strokeCourse(ctx,C); ctx.strokeStyle="rgba(255,236,200,.08)"; ctx.lineWidth=Math.max(1,tw*0.35); ctx.stroke();
  /* the sections */
  C.f.forEach(function(F){
    if(F.k==="whoops"||F.k==="rollers"){
      var n=F.n||10; for(var w=0;w<n;w++){ var s=F.s0+(F.s1-F.s0)*(w+0.5)/n; C.at(s,p); var nx=-Math.sin(p.a), ny=Math.cos(p.a), hw=tw*0.5;
        ctx.strokeStyle="rgba(255,230,190,.38)"; ctx.lineWidth=Math.max(1.2,tw*0.16); ctx.beginPath(); ctx.moveTo(p.x-nx*hw,p.y-ny*hw); ctx.lineTo(p.x+nx*hw,p.y+ny*hw); ctx.stroke();
        C.at(s+Math.max(1.5,(F.s1-F.s0)/n*0.4),p); ctx.strokeStyle="rgba(20,10,4,.4)"; ctx.beginPath(); ctx.moveTo(p.x-nx*hw,p.y-ny*hw); ctx.lineTo(p.x+nx*hw,p.y+ny*hw); ctx.stroke(); }
    } else if(F.k==="jump"){
      var a=F.s0, b=F.s1, l=b-a;
      strokeCourse(ctx,C,a,a+l*0.28); ctx.strokeStyle="rgba(255,226,180,.32)"; ctx.lineWidth=tw*0.92; ctx.stroke();       // the take-off face
      strokeCourse(ctx,C,b-l*0.3,b); ctx.strokeStyle="rgba(255,226,180,.22)"; ctx.lineWidth=tw*0.92; ctx.stroke();        // the landing
      strokeCourse(ctx,C,a+l*0.28,b-l*0.3); ctx.strokeStyle="rgba(20,10,4,.28)"; ctx.lineWidth=tw*0.8; ctx.stroke();      // the gap
    } else if(F.k==="hill"){
      strokeCourse(ctx,C,F.s0,F.s1); ctx.strokeStyle="rgba(255,226,180,.14)"; ctx.lineWidth=tw*0.7; ctx.stroke();
    }
  });
  /* the finish line: a checkered stripe across the track, and the flagger's tower beside it */
  C.at(C.fin,p); var nx=-Math.sin(p.a), ny=Math.cos(p.a), hw=tw*0.55, sq=Math.max(2,tw/5), cells=Math.max(3,Math.round(tw/sq));
  for(i=0;i<cells;i++) for(var r2=0;r2<2;r2++){ ctx.fillStyle=(i+r2)%2?"#111116":"#f3efe4"; var u=-hw+(i+0.5)*(hw*2/cells), v=(r2-0.5)*sq; ctx.fillRect(p.x+nx*u+Math.cos(p.a)*v-sq/2,p.y+ny*u+Math.sin(p.a)*v-sq/2,sq,sq); }
  C.flagAt={x:p.x+nx*(-hw-tw*0.5)-Math.cos(p.a)*tw*0.2,y:p.y+ny*(-hw-tw*0.5)};
  ctx.fillStyle="#2a2a32"; ctx.fillRect(C.flagAt.x-1.5,C.flagAt.y-tw*1.6,3,tw*1.6); ctx.fillStyle="#c99f5e"; ctx.fillRect(C.flagAt.x-tw*0.35,C.flagAt.y-tw*0.5,tw*0.7,tw*0.5);
  /* the start: the gate's footing across the track (the steel gate itself is the page's #gate while the riders wait) */
  C.at(C.gate,p); nx=-Math.sin(p.a); ny=Math.cos(p.a);
  ctx.strokeStyle="rgba(201,159,94,.75)"; ctx.lineWidth=Math.max(1.5,tw*0.12); ctx.beginPath(); ctx.moveTo(p.x-nx*tw*0.6,p.y-ny*tw*0.6); ctx.lineTo(p.x+nx*tw*0.6,p.y+ny*tw*0.6); ctx.stroke();
  /* the CEO (20:06): "I wanna see the whoop section and jumps": the sections are named on the infield (a dark pill, light text) */
  if(fs>0) labelSections(ctx,C,W,H,fs);
  /* a soft vignette */
  var vg=ctx.createRadialGradient(W/2,H*0.55,Math.min(W,H)*0.3,W/2,H*0.55,Math.max(W,H)*0.75); vg.addColorStop(0,"rgba(0,0,0,0)"); vg.addColorStop(1,"rgba(0,0,0,.45)"); ctx.fillStyle=vg; ctx.fillRect(0,0,W,H);
}

function labelSections(ctx,C,W,H,fs){
  var p={}, done={}, list=[];
  C.f.forEach(function(F){ var name=F.k==="whoops"?"Whoops":F.k==="rollers"?"Rollers":null;
    if(F.k==="jump"){ var big=C.f.filter(function(x){ return x.k==="jump"; }).sort(function(a,b){ return b.h-a.h; })[0]; if(F===big) name=C.kind==="stadium"?"Triple":"Big jump"; }
    if(name&&!done[name]){ done[name]=1; list.push([name,F]); } });
  ctx.save(); ctx.font="700 "+fs+"px Manrope, system-ui, sans-serif"; ctx.textBaseline="middle"; ctx.textAlign="center";
  list.forEach(function(it){
    var F=it[1]; C.at((F.s0+F.s1)/2,p);
    var tw=Math.ceil(ctx.measureText(it[0]).width)+fs*0.9, th=Math.round(fs*1.45), x=p.x, below=p.y+C.tw*0.5+th*0.5+fs*0.35, above=p.y-C.tw*0.5-th*0.5-fs*0.35;
    /* a stadium names its sections above their row (the bottom row below it), so two names never meet; outdoors under the track */
    var low=C.rowY?p.y>=C.rowY[3]-2:false, y=C.kind==="stadium"&&!low?above:below;
    if(y+th/2>H-2) y=above; if(y-th/2<C.stands) y=below;
    x=clamp(x,tw/2+2,W-tw/2-2);
    ctx.fillStyle="rgba(10,8,6,.74)"; ctx.beginPath(); var r=th/2; ctx.moveTo(x-tw/2+r,y-th/2); ctx.arcTo(x+tw/2,y-th/2,x+tw/2,y+th/2,r); ctx.arcTo(x+tw/2,y+th/2,x-tw/2,y+th/2,r); ctx.arcTo(x-tw/2,y+th/2,x-tw/2,y-th/2,r); ctx.arcTo(x-tw/2,y-th/2,x+tw/2,y-th/2,r); ctx.closePath(); ctx.fill();
    ctx.fillStyle="#f3e6c8"; ctx.fillText(it[0],x,y+fs*0.04);
  });
  ctx.restore();
}

/* ---------------- sprites ---------------- */
var bikeImg={};   // colour|accent -> {img, ok}
function bikeSVG(color,accent){
  var s=MX.Art&&MX.Art.bike?MX.Art.bike(color,accent):"";
  return s.replace("<svg ",'<svg xmlns="http://www.w3.org/2000/svg" width="60" height="40" ');
}
function bikeImage(color,accent,cb){
  var k=color+"|"+accent, e=bikeImg[k];
  if(e){ if(!e.ok&&cb) e.cbs.push(cb); return e; }
  e=bikeImg[k]={img:new Image(),ok:false,cbs:cb?[cb]:[]};
  e.img.onload=function(){ e.ok=true; var c=e.cbs; e.cbs=[]; c.forEach(function(f){ try{ f(); }catch(x){} }); };
  e.img.src="data:image/svg+xml;charset=utf-8,"+encodeURIComponent(bikeSVG(color,accent));
  return e;
}
function canvas(w,h){ var c=document.createElement("canvas"); c.width=Math.max(1,Math.ceil(w)); c.height=Math.max(1,Math.ceil(h)); return c; }
/* a bike sprite canvas at the device pixel ratio, facing right (dir 1) or left (-1) */
function bikeSprite(color,accent,w,h,dpr,dir){
  var e=bikeImage(color,accent), c=canvas(w*dpr,h*dpr), x=c.getContext("2d");
  if(!e.ok) return null;
  if(dir<0){ x.translate(c.width,0); x.scale(-1,1); }
  x.drawImage(e.img,0,0,c.width,c.height);
  return c;
}
function plateSprite(num,o,dpr,fs){
  var txt=String(num==null?"-":num), font="800 "+fs+"px Manrope, system-ui, sans-serif";
  var mc=canvas(4,4).getContext("2d"); mc.font=font; var tw=Math.ceil(mc.measureText(txt).width);
  var pad=Math.round(fs*0.32), stripe=Math.max(2,Math.round(fs*0.22)), w=tw+pad*2+stripe, h=Math.round(fs*1.32), ring=o.me?2:0;
  var c=canvas((w+ring*2)*dpr,(h+ring*2)*dpr), x=c.getContext("2d"); x.scale(dpr,dpr);
  function rr(px,py,pw,ph,r){ x.beginPath(); x.moveTo(px+r,py); x.lineTo(px+pw-r,py); x.quadraticCurveTo(px+pw,py,px+pw,py+r); x.lineTo(px+pw,py+ph-r); x.quadraticCurveTo(px+pw,py+ph,px+pw-r,py+ph); x.lineTo(px+r,py+ph); x.quadraticCurveTo(px,py+ph,px,py+ph-r); x.lineTo(px,py+r); x.quadraticCurveTo(px,py,px+r,py); x.closePath(); }
  if(ring){ x.fillStyle="#f0d48a"; rr(0,0,w+ring*2,h+ring*2,4); x.fill(); }
  x.fillStyle=o.red?"#c8101c":"#f4f1e8"; rr(ring,ring,w,h,3); x.fill();
  x.fillStyle=o.color||"#3a3a44"; x.fillRect(ring,ring+1,stripe,h-2);
  x.strokeStyle="rgba(0,0,0,.4)"; x.lineWidth=1; rr(ring+0.5,ring+0.5,w-1,h-1,3); x.stroke();
  x.fillStyle=o.red?"#ffffff":"#121216"; x.font=font; x.textBaseline="middle"; x.textAlign="center";
  x.fillText(txt,ring+stripe+(w-stripe)/2,ring+h/2+fs*0.05);
  c._w=w+ring*2; c._h=h+ring*2;
  return c;
}
var shadowC=null;
function shadow(){
  if(shadowC) return shadowC;
  var c=canvas(64,24), x=c.getContext("2d"), gr=x.createRadialGradient(32,12,0,32,12,32);
  gr.addColorStop(0,"rgba(0,0,0,.55)"); gr.addColorStop(1,"rgba(0,0,0,0)"); x.fillStyle=gr; x.setTransform(1,0,0,0.375,0,7.5); x.beginPath(); x.arc(32,12,32,0,TAU); x.fill();
  return shadowC=c;
}

/* ---------------- the view ---------------- */
/* mxcrash (the CEO, 2026-10-16 20:06: "riders are moving so fucking fast ... the results of the cards is what moves the driver ... if they
   lose a war double war the rider crashes and gets back up. If they lose a triple war they crash and dont return ... When a rider crashes
   the yellow flag comes out"):
   - PACE (mxlaps, the CEO ~21:10 "Fix it" with a search answer: about 50 s to 1 min a stadium lap, 1 to 2 min outdoors): the leader rides
     one lap in V.exp ms = the REAL lap time of the round (round.js lapTime: Supercross 53-59 s, outdoor 1:45-2:15; game.js lapMs) at a
     steady speed; no Game speed changes it.
   - PASSES OVER THE WHOLE LAP (mxlaps): a lap's result moves every rider's target gap, but each rider whose place changes makes the move
     at their own point of the lap (from just after the cards turn to about 60% round, a stable spread by rider and lap: update ->
     r.pend, applied as the leader passes that point; the rest of the lap lets every move ride out before the line), so the passes happen one by one round the lap, each a ride-up of a few seconds, never the whole field at once. A lap's cards are turned as the leader STARTS that lap (ready() says when),
     and the field then rides the result round the lap (passes are ride-ups over the lap). The leader never crosses the line that ends a
     lap whose cards are not turned yet: he eases to it (a person thinking). The riding is logic (advance) apart from the drawing, so the
     race keeps its clock while the board covers the track; it pauses with the Menu (setLive).
   - CRASHES: crash(s, kind) tumbles the bike where the rider is (the rider is thrown, gets up, picks the bike up and rides on for a
     "remount", the field passing; for an "out" the bike ends off the track with an OUT tag for the rest of the race).
   - YELLOW FLAG: setYellow(lap) at the crash: a flagger waves yellow beside that section (it glows yellow) and nobody changes places in it
     until the leader ends lap \`lap\` (the engine's yellow lap). */
function outSprite(dpr,fs){
  var font="800 "+fs+"px Manrope, system-ui, sans-serif", mc=canvas(4,4).getContext("2d"); mc.font=font;
  var tw=Math.ceil(mc.measureText("OUT").width), w=tw+Math.round(fs*0.7), h=Math.round(fs*1.32), c=canvas(w*dpr,h*dpr), x=c.getContext("2d");
  x.scale(dpr,dpr); x.fillStyle="#b3121e"; x.beginPath(); x.moveTo(3,0); x.lineTo(w-3,0); x.quadraticCurveTo(w,0,w,3); x.lineTo(w,h-3); x.quadraticCurveTo(w,h,w-3,h); x.lineTo(3,h); x.quadraticCurveTo(0,h,0,h-3); x.lineTo(0,3); x.quadraticCurveTo(0,0,3,0); x.closePath(); x.fill();
  x.strokeStyle="rgba(255,255,255,.7)"; x.lineWidth=1; x.stroke(); x.fillStyle="#ffffff"; x.font=font; x.textBaseline="middle"; x.textAlign="center"; x.fillText("OUT",w/2,h/2+fs*0.05);
  c._w=w; c._h=h; return c;
}
function create(host,opt){
  opt=opt||{};
  var bgC=document.createElement("canvas"), fgC=document.createElement("canvas");
  bgC.className="mx-trk__bg"; fgC.className="mx-trk__fg"; bgC.setAttribute("aria-hidden","true"); fgC.setAttribute("aria-hidden","true");
  host.appendChild(bgC); host.appendChild(fgC);
  var bx=bgC.getContext("2d"), fx=fgC.getContext("2d");
  var V={host:host,kind:"stadium",key:"",W:0,H:0,dpr:1,C:null,riders:[],by:{},phase:"gate",X:0,laps:0,lapT:now(),exp:10000,lapsN:30,
    run:false,raf:0,last:0,flag:null,flagT:0,mode:"full",tvScale:1,dirty:true,pFin:0,pGate:0,stillX:null,exp1:0,
    live:false,lt:0,lapSeen:0,yel:null,hole:null,onLap:null,onYellow:null};
  var P={}, Q={};
  V.mdl=null; V.walk=null; V.ct=0; V.rate=1; V.wait=false; V.seenK=0; V.q=[]; V.qi=0; V.qn=0; V.qdirty=false; V.onEvent=null; V.pct=null; V.fdt=16; V.spdBase=1;
  function motion(){ var B=g.BGUI; if(document.documentElement.getAttribute("data-motion")==="reduce"||(B&&B.reducedMotion&&B.reducedMotion())) return "off";
    return document.documentElement.getAttribute("data-effects")==="reduced"?"reduced":"full"; }
  /* layout: the host's size; the course and the background drawn again when it changes */
  V.resize=function(force){
    var W=Math.round(host.clientWidth), H=Math.round(host.clientHeight), dpr=Math.min(2,g.devicePixelRatio||1), hk=V.hole?V.hole.w+"x"+V.hole.h:"";
    if(!W||!H) return false;
    if(!force&&W===V.W&&H===V.H&&dpr===V.dpr&&V.C&&V.C.kind===V.kind&&V.C._key===V.key&&V.C._hole===hk) return true;
    var keepX=V.C?V.X-V.pFin:null;
    V.W=W; V.H=H; V.dpr=dpr;
    [bgC,fgC].forEach(function(c){ c.width=Math.round(W*dpr); c.height=Math.round(H*dpr); c.style.width=W+"px"; c.style.height=H+"px"; });
    V.C=V.kind==="outdoor"?outdoor(W,H,V.key,V.hole):stadium(W,H,V.key,V.hole); V.C._key=V.key; V.C._hole=hk;
    var rem=parseFloat(getComputedStyle(document.documentElement).fontSize)||16, tv=document.documentElement.hasAttribute("data-tv");
    V.bw=clamp(Math.round(V.C.tw*(V.kind==="outdoor"?2.1:1.9)),18,tv?46:34); V.bh=Math.round(V.bw*2/3);
    V.fs=Math.round(tv?Math.max(14,rem*0.72):Math.max(10,Math.min(12,rem*0.72)));
    V.lfs=tv?Math.max(10,Math.round(rem*0.875)):12;   /* the section names: the text floors (12 px phone; TV 21 px at 1080, 10.5 at 540) */
    bx.setTransform(dpr,0,0,dpr,0,0); drawBackground(bx,V.C,W,H,V.lfs);
    var oldFin=V.pFin;
    V.pFin=V.C.fin/V.C.L; V.pGate=V.C.gate/V.C.L; if(V.pGate<V.pFin) V.pGate+=1;
    if(keepX!=null&&V.phase!=="gate"){ V.X=V.pFin+keepX; V.riders.forEach(function(r){ if(r.cr) r.cr.at=r.cr.at-oldFin+V.pFin; }); if(V.yel){ V.yel.c=V.yel.c-oldFin+V.pFin; V.yel.until=V.yel.until-oldFin+V.pFin; } }
    V.unit=V.bw*1.05/V.C.L;
    V.riders.forEach(function(r){ r.spr=null; r.plate=null; });
    V.outS=null;
    V.dirty=true; drawFrame(true);
    return true;
  };
  V.setLayout=function(kind,key){ kind=kind==="outdoor"?"outdoor":"stadium"; key=String(key||""); if(kind!==V.kind||key!==V.key){ V.kind=kind; V.key=key; V.resize(true); } };
  /* the card window's corner (CSS px, bottom right): the course keeps clear of it */
  V.setHole=function(h){ V.hole=h&&h.w>0?{w:Math.round(h.w),h:Math.round(h.h)}:null; };
  /* the riders of this race: [{s, color, accent, plate, red, me}] in gate order */
  V.setRiders=function(list){
    V.riders=list.map(function(o,k){ return {s:o.s,k:k,color:o.color,accent:o.accent,num:o.plate,red:!!o.red,me:!!o.me,out:false,off:0,offT:0,lane:0,laneT:0,
      base:((k*7919)%11-5)/5*0.22,face:1,spr:null,sprL:null,plate:null,place:k,cr:null,slowT:0,sx:0,pr:0,spd:1,st:"run"}; });
    V.by={}; V.riders.forEach(function(r){ V.by[r.s]=r; bikeImage(r.color,r.accent,function(){ r.spr=null; V.dirty=true; if(!V.run) drawFrame(true); }); });
    V.yel=null; V.dirty=true;
  };
  /* the gate: the riders lined up behind it in gate order (lanes across the start straight, rows back from the gate) */
  V.gate=function(on){
    V.phase=on?"gate":"race";
    var C=V.C; if(!C) return;
    var n=V.riders.length, lanes=n>30?5:n>12?4:3, cols=Math.ceil(n/lanes);
    var room=(C.gate-C.gateLine)/C.L, step=Math.min(V.unit*0.9,room/Math.max(1,cols));
    V.riders.forEach(function(r){ var c=Math.floor(r.k/lanes), l=r.k%lanes; r.gx=V.pGate-(c+0.6)*step; r.gl=(l-(lanes-1)/2)/Math.max(1,(lanes-1)/2)*0.85; r.pend=null; if(on){ r.off=V.pGate-r.gx; r.offT=r.off; r.lane=r.gl; r.laneT=r.gl; r.cr=null; } });
    V.X=V.pGate; V.lapT=now(); V.lt=now();
    if(on){ V.laps=0; V.flag=null; V.yel=null; V.lapSeen=0; if(V.mdl){ V.ct=0; V.seenK=0; V.q=[]; V.qi=0; V.qn=0; V.pct=null; V.riders.forEach(function(r){ r.sx=r.gx; r.pr=0; r.spd=1; r.st="run"; r.out=false; }); } }
    else { V.riders.forEach(function(r){ r.off=V.pGate-r.gx; r.lane=r.gl; }); laneCheck(); }
    V.dirty=true; if(!V.run) drawFrame(true);
  };
  /* where the steel gate stands (CSS px in the host): for the page's #gate and its dust */
  V.gateRect=function(){ var C=V.C; if(!C) return null; C.at(C.gate,P); var h=C.tw*1.9; return {x:P.x,y:P.y-h*0.62,h:h,w:Math.max(5,C.tw*0.32)}; };
  /* the standings after a lap (or a change): order = seats by place; cnt = cards held; out = seats out of the race */
  V.update=function(order,cnt,outs){
    var C=V.C; if(!C||V.mdl) return;   /* (a race with a time model is placed by the clock, not by a standings table) */
    advance(now());
    var alive=order.filter(function(s){ return !(outs&&outs[s]); });
    var raw=[0], minGap=V.unit*1.35, kc=V.unit*0.08, i;   /* riders level on cards still ride a bike and a third apart (v1 leftover: crowded bikes) */
    for(i=1;i<alive.length;i++) raw.push(raw[i-1]+minGap+kc*Math.max(0,(cnt[alive[i-1]]||0)-(cnt[alive[i]]||0)));
    var tot=raw[raw.length-1]||0, lim=0.84, sc=tot>lim?lim/tot:1;
    var spread=V.phase==="race"&&V.exp>=15000&&motion()!=="off", mv=[], cl=Math.floor(V.X-V.pFin+1e-9);   /* cl: the lap the leader rides now */
    alive.forEach(function(s,i){ var r=V.by[s]; if(!r) return; var nt=raw[i]*sc, moved=r.place!==i;
      if(r.pend&&r.pend.lap<cl){ r.offT=r.pend.t; r.pend=null; }   /* a move left over from the lap before: made now */
      r.out=false; r.place=i;
      if(!spread||r.cr) { r.offT=nt; r.pend=null; return; }
      if(r.pend){ r.pend.t=nt; return; }                                  /* already moving this lap: the same point, the new target */
      if(moved&&Math.abs(nt-r.offT)>=V.unit*0.5) mv.push({r:r,t:nt}); else r.offT=nt; });
    /* the riders changing places take turns round the lap (a stable order by rider and lap) */
    mv.sort(function(a,b){ return (((a.r.s+1)*2654435761+cl*40503)>>>0)%9973-(((b.r.s+1)*2654435761+cl*40503)>>>0)%9973; });
    /* spread from just after the cards turn to a little past half the lap: every move has the rest of the lap to ride out before the line */
    var room=Math.max(0.2,Math.min(0.55,V.pFin+cl+0.6-V.X)), st0=V.X+0.04;
    mv.forEach(function(m,j){ m.r.pend={t:m.t,at:st0+room*(j+0.5)/mv.length,lap:cl}; });
    order.forEach(function(s,i){ var r=V.by[s]; if(r&&outs&&outs[s]){ if(!r.out){ r.out=true; r.parkT=now(); } r.place=i; } });
    V.dirty=true; if(!V.run) drawFrame(true);
  };
  /* a lap's cards are turned (battle n decided): the leader may ride on to the end of lap n (reduced motion: drawn where they stand) */
  V.lap=function(n,len){
    if(V.mdl){ if(len) V.lapsN=len; poll(); if(motion()==="off"){ var lim0=limitMs(); if(!isFinite(lim0)) lim0=V.mdl.tm.flag; V.ct=Math.max(V.ct,lim0); fire(V.ct); } V.dirty=true; if(!V.run) drawFrame(true); return; }
    advance(now());
    if(n>V.laps){ V.laps=n; V.lapT=now(); }
    if(len) V.lapsN=len;
    if(motion()==="off"){ V.X=V.pFin+V.laps+0.5; }
    V.dirty=true; if(!V.run) drawFrame(true);
  };
  /* a race picked up again (Continue, a new screen): n laps decided; the leader rides the last of them */
  V.setLaps=function(n,len){ if(V.mdl){ if(len) V.lapsN=len; return; } V.laps=n; V.lapsN=len||V.lapsN; V.lapT=now(); V.lt=now(); V.X=n>0?Math.max(V.pGate,V.pFin+n-0.3):V.pGate; laneCheck(true); V.riders.forEach(function(r){ if(r.pend){ r.offT=r.pend.t; r.pend=null; } if(!r.cr){ r.off=r.offT; r.lane=r.laneT; } }); };
  V.setPace=function(ms){ if(ms>0) V.exp=clamp(ms,1500,400000); };
  /* mxtimewire: the race's REAL first lap (ms from the gate to the first crossing of the line; 0 = none researched: the start rides at the
     lap's pace). The gate stands where the drawing puts it, so the leader rides that stretch at the speed that makes the real first lap
     (a quicker start of a stadium lap, whose real gate sits near the line); within 0.35-2.5 x a lap's pace */
  V.setFirst=function(ms){ V.exp1=ms>0?clamp(ms,1000,400000):0; };
  function unitMs(x){ if(V.exp1>0&&V.phase!=="gate"&&x<V.pFin+1-1e-9){ var seg=V.pFin+1-V.pGate; if(seg>0.05) return clamp(V.exp1/seg,V.exp*0.35,V.exp*2.5); } return V.exp; }
  function msBetween(a,b){ if(b<=a) return 0; var cut=V.pFin+1; if(V.exp1>0&&a<cut){ var m=Math.min(b,cut); return (m-a)*unitMs(a)+(b>m?(b-m)*V.exp:0); } return (b-a)*V.exp; }
  V.setFlag=function(f){ V.flag=f||null; V.flagT=now(); if(f==="checkered") V.phase="over"; V.dirty=true; if(!V.run) drawFrame(true); };
  V.setRed=function(s){ V.riders.forEach(function(r){ var on=r.s===s; if(on!==r.red){ r.red=on; r.plate=null; } }); V.dirty=true; };
  /* the race clock runs while the race is on screen or only covered by the board (the Menu pauses it) */
  V.setLive=function(on){ on=!!on; if(on&&!V.live) V.lt=now(); V.live=on; };
  function timed(){ return (!!V.C||!!V.mdl)&&V.live&&motion()!=="off"; }   /* (a race with a time model has its clock without a drawn course: the 3D race rides it while this canvas rests) */
  /* ms until the leader starts the lap whose cards are next (0 = now; -1 = no riding clock: reduced motion, no track, paused) */
  V.ready=function(){
    advance(now());
    if(!timed()) return -1;
    if(V.phase==="gate") return 0;
    if(V.mdl){ poll(); var lim=limitMs(); return V.mdl.tm.done||lim<=V.ct?0:Math.round((lim-V.ct)/V.rate)+30; }   /* ms of the clock to the leader's line: then the next lap's cards turn */
    var line=V.pFin+V.laps;
    if(V.X<line-1.02){ V.X=Math.max(V.X,line-0.3); V.riders.forEach(function(r){ if(!r.cr) r.off=r.offT; }); laneCheck(true); }   /* the race ran on unwatched: catch up */
    var need=line-V.X; return need<=0?0:Math.round(msBetween(V.X,line))+30;
  };
  /* ms until the leader reaches the line that ends lap k (the checkered flag waits for it) */
  V.untilLine=function(k){ advance(now()); if(!timed()||V.phase==="gate") return 0;
    if(V.mdl){ var tm=V.mdl.tm, T=MX.Time, tl=(tm.done&&k>=tm.L)?tm.flag:T.leaderLine(V.mdl,k); return tl==null||tl<=V.ct?0:Math.round((tl-V.ct)/V.rate)+30; }
    var d=V.pFin+k-V.X; return d<=0?0:Math.round(msBetween(V.X,V.pFin+k))+30; };
  V.leaderLap=function(){ if(V.mdl) return V.phase==="gate"?0:Math.max(1,V.lapSeen); return V.phase==="gate"?0:Math.floor(V.X-V.pFin+1e-9)+1; };
  /* a crash: kind "remount" | "out" (CRASH-CONTRACT.md); where the rider is now */
  V.crash=function(s,kind){
    var r=V.by[s]; if(!r||!V.C||V.mdl) return;
    advance(now());
    var f=clamp(V.exp/10000,0.6,1.4);
    r.cr={t0:now(),kind:kind==="out"?"out":"remount",at:V.X-r.off,dur:Math.round(2600*f),side:r.lane>=0?1:-1,lane0:r.lane};
    crashTimes(r.cr);
    if(r.cr.kind==="out") r.out=true;
    V.dirty=true; if(!V.run) drawFrame(true);
  };
  /* a rider out of the race by a crash, picked up again (Continue): off the track at that point of the lap (0..1 from the line) */
  V.park=function(s,sector){ var r=V.by[s]; if(!r||V.mdl) return; r.out=true; r.cr={t0:-1e9,kind:"out",at:V.pFin+clamp(+sector||0.5,0,1),dur:1,side:1,lane0:0}; crashTimes(r.cr); };
  /* the yellow flag at the last crash, until the leader ends lap \`lap\`; null = down */
  V.setYellow=function(lap,s,sector){
    if(V.mdl) return;   /* (the model's yellowOn / yellowOff events decide) */
    if(lap==null){ V.yel=null; V.dirty=true; return; }
    advance(now());
    var r=s!=null?V.by[s]:null, c=r&&r.cr?r.cr.at:sector!=null?V.pFin+clamp(+sector,0,1):(V.yel?V.yel.c:V.X-0.1);
    V.yel={c:c,until:V.pFin+lap,t0:now()};
    V.dirty=true; if(!V.run) drawFrame(true);
  };
  V.yellowOn=function(){ advance(now()); return !!V.yel; };
  function laneCheck(silent){ var k=V.leaderLap(); if(k>V.lapSeen){ V.lapSeen=k; if(!silent&&V.onLap) try{ V.onLap(k); }catch(e){} } }
  function inYellow(r){ if(!V.yel) return false; var p=V.X-r.off, d=p-V.yel.c; d=d-Math.round(d); return Math.abs(d)<0.075; }
  /* the riding (logic only; the drawing reads it): dt ms at time t */
  function logic(dt,t){
    var simple=motion()!=="full";
    var to=V.pFin+V.laps+1, v=1/unitMs(V.X);
    if(V.phase==="over") v*=0.6;
    else v*=clamp((to-V.X)/0.16,0,1);                 /* never over the line of a lap whose cards are still to turn: ease to it */
    var dX=Math.max(0,v*dt); V.X+=dX;
    var k=1-Math.exp(-dt/(simple?420:650)), kl=1-Math.exp(-dt/260);
    V.riders.forEach(function(r){
      if(r.pend&&V.X>=r.pend.at){ r.offT=r.pend.t; r.pend=null; }   /* this rider's move of the lap starts here */
      if(r.cr){
        r.off=V.X-r.cr.at;                            /* down on the track: the field rides on past */
        if(r.cr.kind==="remount"&&t-r.cr.t0>=r.cr.dur){ r.cr=null; r.slowT=t+Math.min(V.exp*0.6,15000); r.lane=r.laneT; }
        return;
      }
      if(r.out) return;
      var d=r.offT-r.off, st=d*k, up=r.slowT&&t<r.slowT?0.3:1;
      /* never backwards, never a zoom: the gap grows by at most 85% of the leader's progress and shrinks by at most the leader's progress
         (a rider back on the bike after a crash rejoins calmly: 30%) */
      if(st>dX*0.85) st=dX*0.85; else if(st<-dX*up) st=-dX*up;
      if(V.yel&&inYellow(r)) st=0;                    /* yellow flag: nobody changes places in that section */
      r.off+=st;
      r.laneT=r.base+clamp(d/(V.unit*1.4),-1,1)*-0.85;   // the rider moving up (the gap shrinking) swings to the inside to pass
      r.lane+=(r.laneT-r.lane)*kl;
    });
    if(V.yel&&V.X>=V.yel.until){ V.yel=null; if(V.onYellow) try{ V.onYellow(false); }catch(e){} }
    laneCheck();
  }
  function advance(t){
    if(V.mdl){ advanceModel(t); return; }
    if(!V.C||!V.live||V.phase==="gate"||motion()==="off"){ V.lt=t; return; }
    var dt=t-(V.lt||t); V.lt=t; if(dt<=0) return; if(dt>20000) dt=20000;
    while(dt>0){ var d=Math.min(dt,40); logic(d,t-dt+d); dt-=d; }
  }
  /* ================= MODEL MODE ================= */
  /* the course position (in laps) at progress pr (laps + phase of the lap; 0 = the gate, 1 = the first line): lap 1 runs gate -> line, every other lap line -> line */
  function xOfPr(pr){ return pr<=1?V.pGate+pr*(V.pFin+1-V.pGate):V.pFin+pr; }
  function xOfLap(k,ph){ return k<=1?V.pGate+ph*(V.pFin+1-V.pGate):V.pFin+(k-1)+ph; }
  function limitMs(){ return V.mdl?MX.Time.clockLimit(V.mdl):0; }
  /* the lap decided since the last look: its events are put on the clock */
  function poll(){ if(!V.mdl) return; var tm=V.mdl.tm; while(V.seenK<tm.k){ V.seenK++; enqueue(V.seenK); } }
  function push(e){ e.o=V.qn++; V.q.push(e); V.qdirty=true; }
  function lappedAt(lead,s,k){
    var tm=V.mdl.tm, lo=k>1?tm.r[lead].T[k-2]:0, hi=tm.r[lead].T[k-1], W=V.walk;
    for(var i=0;i<16;i++){ var mid=(lo+hi)/2; if(W.at(lead,mid)-W.at(s,mid)>=1) hi=mid; else lo=mid; }
    return hi;
  }
  function enqueue(k){
    var T=MX.Time, rc=V.mdl, tm=rc.tm, n=rc.n, s, R, w, ev=[];
    tm.laps.forEach(function(l){ if(l.k===k) ev=l.ev; });
    push({t:k===1?0:(T.leaderLine(rc,k-1)||0),e:"lap",k:k});                                                  /* the leader starts lap k */
    for(s=0;s<n;s++){
      R=tm.r[s];
      if(R.T.length>=k) push({t:R.T[k-1],e:"line",s:s,k:k});                                                 /* a rider ends lap k */
      w=T.holdWindow(rc,s,k);
      if(w){
        if(R.dnf&&R.dnf.why==="crash"&&R.dnf.lap===k) push({t:w[0],e:"down",s:s,k:k,kind:"out",at:R.dnf.at});          /* a lost triple war: he stops there for good */
        else { push({t:w[0],e:"down",s:s,k:k,kind:"remount",at:R.hold[k][0],ms:R.hold[k][1]}); push({t:w[1],e:"up",s:s,k:k}); }   /* a lost double war: down, then back on the bike */
      }
      if(R.dnf&&R.dnf.why==="cards"&&R.dnf.lap===k) push({t:R.dnf.t,e:"pits",s:s,k:k});                    /* out of cards: he pulls off at the line */
    }
    ev.forEach(function(e){
      if(e.e==="pass"){ var ta=T.timeAt(rc,e.a,k-1+e.at); if(ta!=null) push({t:ta,e:"pass",k:k,a:e.a,d:e.d,pos:e.pos,at:e.at,crash:e.crash||0}); }
      else if(e.e==="lapped"){ push({t:lappedAt(e.by,e.s,k),e:"lapped",s:e.s,by:e.by,k:k}); }
      else if(e.e==="fastest"){ push({t:tm.r[e.s].T[k-1],e:"fastest",s:e.s,k:k,time:e.t}); }
    });
    T.yellowWindows(rc).forEach(function(y){                                                                  /* the yellow flag flies from the crash to the last rider's exit */
      if(y.lap===k+1&&(y.t0!=null||y.from!=null)) push({t:y.t0!=null?y.t0:y.from,e:"yellowOn",lap:y.lap,c:y.c,by:y.by});
      if(y.lap===k&&y.to!=null) push({t:y.to,e:"yellowOff",lap:y.lap});
    });
    if(tm.done&&k===tm.k) push({t:tm.flag,e:"flag",k:k});
  }
  function fire(upTo){
    if(V.qdirty){ V.q=V.q.slice(V.qi); V.qi=0; V.q.sort(function(a,b){ return a.t-b.t||a.o-b.o; }); V.qdirty=false; }
    while(V.qi<V.q.length&&V.q[V.qi].t<=upTo) handle(V.q[V.qi++]);
  }
  function handle(e){
    if(e.e==="lap"){ if(e.k>V.lapSeen) V.lapSeen=e.k; if(V.onLap) try{ V.onLap(e.k); }catch(x){} }
    else if(e.e==="yellowOn"){ V.yel={c:xOfLap(e.lap-1,e.c),until:1e12,t0:now(),lap:e.lap}; V.dirty=true; if(V.onYellow) try{ V.onYellow(true); }catch(x){} }
    else if(e.e==="yellowOff"){ if(V.yel&&V.yel.lap<=e.lap){ V.yel=null; V.dirty=true; if(V.onYellow) try{ V.onYellow(false); }catch(x){} } }
    if(V.onEvent) try{ V.onEvent(e); }catch(x2){}
  }
  /* the clock: real time x rate, never past the leader's line of the last lap decided (a person who has not flipped yet holds it there; with V.wait it eases the last 1.5 s) */
  function stepModel(d){
    poll();
    var lim=limitMs(), dc=d*V.rate;
    if(V.ct<lim){ var room=lim-V.ct; if(V.wait&&isFinite(room)) dc*=clamp(room/1500,0.06,1); V.ct+=Math.min(dc,room); }
    fire(V.ct);
  }
  function advanceModel(t){
    if(!V.live||V.phase==="gate"||motion()==="off"){ V.lt=t; return; }
    var dt=t-(V.lt||t); V.lt=t; if(dt<=0) return; if(dt>20000) dt=20000;
    while(dt>0){ var d=Math.min(dt,40); stepModel(d); dt-=d; }
  }
  /* a race picked up again (Continue, a new screen): the clock starts where the leader starts the lap now riding */
  function resumeClock(){
    var T=MX.Time, rc=V.mdl, tm=rc.tm, ct0=tm.done?tm.flag:(tm.k>=2?(T.leaderLine(rc,tm.k-1)||0):0);
    V.ct=ct0; V.seenK=Math.max(0,tm.k-1); V.q=[]; V.qi=0; V.qn=0; V.yel=null; V.lapSeen=Math.max(0,tm.k-1); V.pct=null;
    if(!tm.done&&tm.k>0) poll();
    V.q=V.q.filter(function(e){ return e.t>=ct0||e.e==="yellowOff"; });
    T.yellowWindows(rc).forEach(function(y){ if(y.t0!=null&&y.t0<=ct0&&(y.to==null||ct0<y.to)){ V.yel={c:xOfLap(y.lap-1,y.c),until:1e12,t0:now(),lap:y.lap}; } });
    V.qdirty=true; fire(ct0-1);
  }
  V.setModel=function(rc){
    var T=MX.Time; V.mdl=(rc&&rc.tm&&T)?rc:null; V.walk=V.mdl?T.walker(rc):null;
    V.ct=0; V.seenK=0; V.q=[]; V.qi=0; V.qn=0; V.qdirty=false; V.yel=null; V.pct=null; V.lapSeen=0;
    V.riders.forEach(function(r){ r.cr=null; r.out=false; r.pr=0; r.spd=1; r.st="run"; });
    if(V.mdl&&V.phase!=="gate"&&rc.tm.k>0) resumeClock();
    V.dirty=true; if(!V.run) drawFrame(true);
  };
  V.model=function(){ return !!V.mdl; };
  V.setRate=function(x){ V.rate=x>0?x:1; };
  V.setWait=function(on){ V.wait=!!on; };
  V.clock=function(){ return V.ct; };
  /* the race clock brought up to now (ms): a view that draws this race somewhere else (the 3D race) asks every frame, so the clock runs while this canvas rests */
  V.tick=function(){ advance(now()); return V.ct; };
  V.rows=function(){ return V.mdl&&V.walk?V.walk.rows(V.ct):null; };
  V.limit=function(){ return limitMs(); };
  /* a crash's timing, in ms of the clock it is drawn on (the clock of the model, or real time without one) */
  function crashTimes(c){
    var dur=c.dur;
    if(c.model){ c.tum=Math.min(1100,dur*0.3); c.rise=Math.min(1700,dur*0.25); c.rise0=dur-c.rise; c.up0=Math.min(c.tum+500,c.rise0*0.5); c.upMs=Math.max(300,Math.min(2400,(c.rise0-c.up0)*0.8)); }
    else { c.tum=dur*0.3; c.rise=dur*0.22; c.rise0=dur*0.78; c.up0=dur*0.38; c.upMs=dur*0.3; }
    return c;
  }
  function startCrash(r,kind,t0,dur,x){
    r.cr=crashTimes({t0:t0,kind:kind,at:x,dur:dur,side:r.lane>=0?1:-1,lane0:r.lane,model:true});
    if(kind==="out") r.out=true;
  }
  /* every rider where the clock says: progress -> course position, his state (down / out / pits / finished), the lane (a rider gaining swings to the inside to pass), the places */
  function modelFrame(){
    var rc=V.mdl, tm=rc.tm, W=V.walk, ct=V.ct, pace=tm.p*1000, i, r, pr, k, st;
    var dct=V.pct==null?0:ct-V.pct; V.pct=ct;
    var kl=1-Math.exp(-V.fdt/260), v0=1/pace, lead=-1, leadPr=-1, order=[];
    for(i=0;i<V.riders.length;i++){
      r=V.riders[i]; pr=W.at(r.s,ct); st=W.state;
      if(st==="fin"&&tm.r[r.s].fin) pr+=(ct-tm.r[r.s].fin.t)/(pace/0.55);        /* past his flag: he rolls on, cooling down */
      r.st=st;
      if(st==="down"){ if(!r.cr||r.cr.kind!=="remount"||r.cr.t0!==W.h0) startCrash(r,"remount",W.h0,Math.max(1,W.h1-W.h0),xOfPr(pr)); }
      else if(st==="out"){ if(!r.cr||r.cr.kind!=="out"){ var dn=tm.r[r.s].dnf; startCrash(r,"out",dn.t,1e12,xOfLap(dn.lap,dn.at)); } }
      else if(r.cr){ r.cr=null; r.slowT=0; }
      r.out=(st==="out"||st==="pits");
      if(dct>0&&!r.cr){ var sp=(pr-r.pr)/dct; r.spd+=(sp/v0-r.spd)*0.18; }
      r.pr=pr; r.sx=xOfPr(pr);
      if(!r.cr&&!r.out){
        var base=r.base, swing=clamp((r.spd-1.0)*5,0,1)*-0.85, u=0;
        if(pr<tm.t1){ u=clamp(pr/tm.t1,0,1); u=u*u*(3-2*u); r.sx-=(V.pGate-r.gx)*(1-u); }   /* the start: from the grid rows into the funnel of turn 1 */
        var want=r.gl*(1-u)+(base+swing)*u; r.laneT=want; r.lane+=(want-r.lane)*(u<1?1:kl);
      }
      if(!r.out&&st!=="fin"&&pr>leadPr){ leadPr=pr; lead=i; }
      order.push(r);
    }
    order.sort(function(a,b){ return (a.out?1:0)-(b.out?1:0)||b.pr-a.pr||a.s-b.s; });
    for(i=0;i<order.length;i++) order[i].place=i;
    if(lead>=0) V.X=xOfPr(leadPr);
  }

  /* the loop */
  function tick(t){
    V.raf=0; if(!V.run) return;
    if(document.hidden){ V.run=false; return; }
    var mo=motion();
    if(mo==="off"){ V.run=false; drawFrame(true); return; }
    var dt=V.last?Math.min(100,t-V.last):16;
    if((mo==="reduced"||V.half)&&V.last&&t-V.last<31){ V.raf=requestAnimationFrame(tick); return; }
    /* a device that can't keep up (frames late, or a frame costing over 8 ms) rides at 30 frames a second: the same look, half the work */
    var c0=now(); V.last=t; drawFrame(false); var cost=now()-c0;
    if(!V.half&&mo==="full"){ V.fs2=(V.fs2||0)+1; V.ft=(V.ft||0)+dt; V.fc=(V.fc||0)+cost; if(V.fs2>=90){ if(V.ft/V.fs2>22||V.fc/V.fs2>8) V.half=true; V.fs2=0; V.ft=0; V.fc=0; } }
    V.raf=requestAnimationFrame(tick);
  }
  V.start=function(){ if(V.run) return; if(document.hidden) return; if(motion()==="off"){ drawFrame(true); return; } V.run=true; V.last=0; V.raf=requestAnimationFrame(tick); };
  V.stop=function(){ V.run=false; if(V.raf){ cancelAnimationFrame(V.raf); V.raf=0; } };
  document.addEventListener("visibilitychange",function(){ if(document.hidden) V.stop(); else if(V.want) V.start(); });
  V.want=false;
  V.show=function(on){ V.want=!!on; if(on) V.start(); else V.stop(); };
  V.state=function(){ return {model:!!V.mdl,ct:Math.round(V.ct),rate:V.rate,limit:V.mdl?(isFinite(limitMs())?limitMs():-1):null,half:!!V.half,run:V.run,live:V.live,riders:V.riders.length,laps:V.laps,X:+(V.X-V.pFin).toFixed(3),lap:V.leaderLap(),exp:Math.round(V.exp),exp1:Math.round(V.exp1),kind:V.kind,key:V.key,W:V.W,H:V.H,flag:V.flag,phase:V.phase,mode:motion(),frames:V.frames|0,
    yellow:V.yel?{c:+(V.yel.c-V.pFin).toFixed(3),until:+(V.yel.until-V.pFin).toFixed(3)}:null,crashed:V.riders.filter(function(r){ return r.cr; }).map(function(r){ return {s:r.s,kind:r.cr.kind}; }),hole:V.hole}; };
  V.positions=function(){ var C=V.C, out=[]; if(!C) return out; V.riders.forEach(function(r){ var s=(V.mdl?r.sx:(V.X-r.off))*C.L; C.at(s,P); out.push({s:r.s,x:Math.round(P.x),y:Math.round(P.y),off:+r.off.toFixed(4),offT:+r.offT.toFixed(4),pend:r.pend?+(r.pend.at-V.pFin).toFixed(3):null,out:r.out,place:r.place,cr:r.cr?r.cr.kind:null}); }); return out; };
  V.frames=0;

  /* draw one frame (still = draw where they stand, no riding) */
  function drawFrame(still){
    var C=V.C; if(!C||!V.W) return;
    var mo=motion(), simple=mo!=="full", W=V.W, H=V.H, dpr=V.dpr, t=now(), mdl=!!V.mdl;
    V.fdt=V.lfd?Math.min(100,Math.max(1,t-V.lfd)):16; V.lfd=t;
    if(!still) advance(t);
    else if(!mdl&&mo==="off"&&V.phase!=="gate"){ V.riders.forEach(function(r){ if(!r.cr) { r.off=r.offT; r.lane=r.base; } }); }
    if(mdl&&V.phase!=="gate"){ if(!still||mo==="off") poll(); modelFrame(); }
    fx.setTransform(1,0,0,1,0,0); fx.clearRect(0,0,fgC.width,fgC.height);
    var tw=C.tw, bw=V.bw, bh=V.bh, list=V.riders.slice();
    /* the yellow flag: the section glows yellow, a flagger waves it beside the track */
    if(V.yel){
      var yc=V.yel.c*C.L, half=C.L*0.075;
      fx.setTransform(dpr,0,0,dpr,0,0); fx.lineJoin="round"; fx.lineCap="round";
      strokeCourse(fx,C,yc-half,yc+half); fx.strokeStyle="rgba(255,206,40,.26)"; fx.lineWidth=tw*1.5; fx.stroke();
      fx.strokeStyle="rgba(255,214,60,.55)"; fx.lineWidth=Math.max(1.5,tw*0.12); fx.setLineDash([tw*0.5,tw*0.4]); fx.stroke(); fx.setLineDash([]);
      C.at(yc,Q); var ynx=-Math.sin(Q.a), yny=Math.cos(Q.a), side=(Q.y+yny*tw>H-4||Q.x+ynx*tw<2||Q.x+ynx*tw>W-2)?-1:1;
      var fxp=Q.x+ynx*side*tw*1.25, fyp=Q.y+yny*side*tw*1.25, fhh=Math.max(14,tw*1.2), wv=simple?0:Math.sin((t-V.yel.t0)/110), fw2=fhh*0.7;
      fx.fillStyle="#2a2a32"; fx.fillRect(fxp-1,fyp-fhh,2,fhh);                                    // the flag's pole
      fx.fillStyle="#1d1b22"; fx.beginPath(); fx.arc(fxp-fw2*0.2,fyp-fhh*0.18,fhh*0.12,0,TAU); fx.fill();     // the flagger
      fx.fillRect(fxp-fw2*0.2-fhh*0.07,fyp-fhh*0.08,fhh*0.14,fhh*0.3);
      fx.fillStyle="#ffd21f"; fx.beginPath(); fx.moveTo(fxp,fyp-fhh); fx.quadraticCurveTo(fxp+fw2*0.5,fyp-fhh+wv*fhh*0.18,fxp+fw2,fyp-fhh+wv*fhh*0.1); fx.lineTo(fxp+fw2,fyp-fhh*0.5+wv*fhh*0.1); fx.quadraticCurveTo(fxp+fw2*0.5,fyp-fhh*0.5+wv*fhh*0.18,fxp,fyp-fhh*0.5); fx.closePath(); fx.fill();
      fx.strokeStyle="rgba(0,0,0,.55)"; fx.lineWidth=1; fx.stroke();
    }
    list.sort(function(a,b){ return ((a.me?2:0)+(a.red?1:0))-((b.me?2:0)+(b.red?1:0))||b.place-a.place; });   // the back of the field first; the red plate, then the people, on top
    /* the riders out of cards: parked in the pits (bottom right), dimmed */
    var parked=0; V.tags=[];
    list.forEach(function(r){
      if(r.out&&!r.cr){
        fx.globalAlpha=0.38; var spr=sprite(r,1); var px=(V.hole?W-V.hole.w-8:W-8)-bw*0.7*(++parked), py=H-4;
        if(spr) { fx.setTransform(dpr*0.7,0,0,dpr*0.7,dpr*px,dpr*(py-bh*0.7)); fx.drawImage(spr,0,0,bw,bh); }
        fx.globalAlpha=1; return;
      }
      if(r.cr){ drawCrash(r,mdl?V.ct:t,simple); return; }
      var s=(V.phase==="gate"?r.gx:(mdl?r.sx:(V.X-r.off)))*C.L;
      C.at(s,P);
      var ca=Math.cos(P.a), sa=Math.sin(P.a);
      if(ca>0.3) r.face=1; else if(ca<-0.3) r.face=-1;
      var nx=-sa, ny=ca, lat=r.lane*tw*0.38, x=P.x+nx*lat, y=P.y+ny*lat;
      var lift=0, pitch=0, F=simple?null:C.feature(s);
      if(F){ var u=(((s%C.L)+C.L)%C.L-F.s0)/(F.s1-F.s0);
        if(F.k==="jump"||F.k==="hill"){ lift=F.h*Math.sin(PI*u); pitch=-(F.k==="jump"?0.42:0.22)*Math.cos(PI*u); }
        else { var ph=PI*F.n*u; lift=F.h*Math.abs(Math.sin(ph)); pitch=0.16*Math.cos(ph*2); } }
      var depth=C.kind==="stadium"?0.84+0.22*(P.y-C.stands)/(H-C.stands):0.86+0.2*(P.y-C.stands)/(H-C.stands);
      var tilt=r.face>0?Math.atan2(sa,ca):Math.atan2(-sa,-ca); tilt=clamp(tilt,-0.5,0.5)+pitch*r.face*-1;
      if(!simple&&lift>0.5){ var shs=depth*(1-Math.min(0.5,lift/(C.gap||40))); fx.setTransform(dpr,0,0,dpr,0,0); fx.globalAlpha=0.8; fx.drawImage(shadow(),x-bw*0.45*shs,y-bh*0.12*shs,bw*0.9*shs,bh*0.3*shs); fx.globalAlpha=1; }
      var spr=sprite(r,r.face), k2=depth, c2=Math.cos(tilt)*k2, s2=Math.sin(tilt)*k2;
      fx.setTransform(dpr*c2,dpr*s2,-dpr*s2,dpr*c2,dpr*x,dpr*(y-lift));
      if(spr) fx.drawImage(spr,-bw/2,-bh*0.92,bw,bh);
      else { fx.fillStyle=r.color; fx.fillRect(-bw/2,-bh*0.6,bw,bh*0.45); }
      drawPlate(r,x,y-lift,depth,ca);
    });
    /* the OUT tags over the field (a rider passing never hides one) */
    if(V.tags.length){ fx.setTransform(dpr,0,0,dpr,0,0); V.tags.forEach(function(g2){ fx.drawImage(g2[0],g2[1],g2[2],g2[0]._w,g2[0]._h); }); }
    /* the flagger: the white flag (last lap) or the checkered flag, waving at the finish line */
    if(V.flag&&C.flagAt){
      var fa=C.flagAt, fw=tw*1.5, fh=tw*1.0, wave=simple?0:Math.sin((t-V.flagT)/120)*fh*0.18, x0=fa.x, y0=fa.y-tw*1.6;
      fx.setTransform(dpr,0,0,dpr,0,0);
      fx.fillStyle="#d9d4c6"; fx.fillRect(x0-1,y0-fh*0.2,2,fh*1.4);
      if(V.flag==="white"){ fx.fillStyle="#fbfaf5"; fx.beginPath(); fx.moveTo(x0,y0); fx.lineTo(x0+fw,y0+wave); fx.lineTo(x0+fw,y0+fh+wave); fx.lineTo(x0,y0+fh); fx.closePath(); fx.fill(); fx.strokeStyle="rgba(0,0,0,.5)"; fx.lineWidth=1; fx.stroke(); }
      else { var cs=fw/4; for(var ci=0;ci<4;ci++) for(var cj=0;cj<3;cj++){ fx.fillStyle=(ci+cj)%2?"#111116":"#f6f2e8"; var wy=wave*(ci/4); fx.fillRect(x0+ci*cs,y0+cj*(fh/3)+wy,cs+0.5,fh/3+0.5); } }
    }
    fx.setTransform(1,0,0,1,0,0);
    V.frames=(V.frames|0)+1; V.dirty=false;
  }
  /* the plate floats above the rider, upright; neighbours' plates are staggered (every other place a plate higher) so a close pack's
     numbers stay readable; on a steep or vertical stretch the raised plate steps sideways towards the infield instead */
  function drawPlate(r,x,y,depth,ca,tag){
    var pl=tag||plate(r); if(!pl) return;
    var W=V.W, dpr=V.dpr, bh=V.bh, bw=V.bw;
    fx.setTransform(dpr,0,0,dpr,0,0); var pw=pl._w, phh=pl._h, steep=Math.abs(ca)<0.5, odd=!tag&&r.place%2===1;
    var top=y-bh*depth*0.98-phh*0.92-(odd&&!steep?phh*0.8:0), left=x-pw/2+(odd&&steep?(x<W/2?1:-1)*(pw*0.5+bw*0.45):0);
    fx.drawImage(pl,Math.round(clamp(left,1,W-pw-1)),Math.round(Math.max(1,top)),pw,phh);
  }
  /* a crash: the bike tumbles (spins, slides off the line, a puff of dirt), lies on its side while the rider gets up; a remount stands it
     up and rides on; an out leaves it off the track with an OUT tag */
  function drawCrash(r,t,simple){
    var C=V.C, c=r.cr, dpr=V.dpr, tw=C.tw, bw=V.bw, bh=V.bh, el=t-c.t0, out=c.kind==="out";
    if(c.tum==null) crashTimes(c);
    var tumble=clamp(el/c.tum,0,1), down=el>c.tum, rise=out?0:clamp((el-c.rise0)/c.rise,0,1);
    var slide=(1-Math.pow(1-tumble,2))*0.012*C.L, s=c.at*C.L+slide;
    C.at(s,P); var ca=Math.cos(P.a), sa=Math.sin(P.a), nx=-sa, ny=ca;
    var latK=out?(c.lane0*(1-tumble)+c.side*2.1*tumble):(c.lane0*(1-tumble)+c.side*1.15*tumble)*(1-rise)+c.lane0*rise;
    var x=P.x+nx*latK*tw*0.38*(out?1.6:1), y=P.y+ny*latK*tw*0.38*(out?1.6:1);
    var depth=0.92, face=r.face||1;
    /* dirt puff */
    if(!simple&&tumble<1&&el>=0){ fx.setTransform(dpr,0,0,dpr,0,0); fx.globalAlpha=0.5*(1-tumble); fx.fillStyle="#c9a77c";
      for(var i=0;i<4;i++){ var a=i*1.7+0.4, rr=tw*(0.3+tumble*0.9); fx.beginPath(); fx.arc(x+Math.cos(a)*rr*0.8,y-bh*0.2+Math.sin(a)*rr*0.35,tw*(0.25+tumble*0.4),0,TAU); fx.fill(); } fx.globalAlpha=1; }
    var rot, sy, hop=0;
    if(!down){ rot=(simple?1:2.4)*PI*tumble*c.side*face; sy=1; hop=simple?0:Math.sin(PI*tumble)*bh*0.6; }
    else { rot=(PI*0.5*c.side*face)*(1-rise)*0.18; sy=1-0.55*(1-rise); }
    var spr=sprite(r,face), alpha=out&&down?0.72:1;
    fx.globalAlpha=alpha;
    var cr=Math.cos(rot)*depth, sr=Math.sin(rot)*depth;
    fx.setTransform(dpr*cr,dpr*sr,-dpr*sr*sy,dpr*cr*sy,dpr*x,dpr*(y-hop));
    if(spr) fx.drawImage(spr,-bw/2,-bh*0.6,bw,bh); else { fx.fillStyle=r.color; fx.fillRect(-bw/2,-bh*0.5,bw,bh*0.45); }
    fx.globalAlpha=1;
    /* the rider: thrown clear, gets up (standing beside the bike), then back on it */
    if(down&&rise<1){
      var gu=clamp((el-c.up0)/c.upMs,0,1), hx=x+c.side*face*bw*0.55, hy=y, body=bh*0.62;
      fx.setTransform(dpr,0,0,dpr,0,0); fx.strokeStyle=r.color; fx.lineWidth=Math.max(2,bw*0.1); fx.lineCap="round";
      var ang=(1-gu)*PI*0.5*c.side;     /* lying (sideways) to standing */
      var tx=hx+Math.sin(ang)*body, ty=hy-Math.cos(ang)*body;
      fx.beginPath(); fx.moveTo(hx,hy); fx.lineTo(tx,ty); fx.stroke();
      fx.fillStyle="#f2f2f6"; fx.beginPath(); fx.arc(tx+Math.sin(ang)*bw*0.1,ty-Math.cos(ang)*bw*0.1,Math.max(2.5,bw*0.13),0,TAU); fx.fill();
      fx.strokeStyle="rgba(0,0,0,.55)"; fx.lineWidth=1; fx.stroke();
    }
    drawPlate(r,x,y-hop,depth,ca);
    if(out&&down){ if(!V.outS||V.outS._fs!==V.fs||V.outS._dpr!==V.dpr){ V.outS=outSprite(V.dpr,V.fs); V.outS._fs=V.fs; V.outS._dpr=V.dpr; }
      var o=V.outS; V.tags.push([o,Math.round(clamp(x-o._w/2,1,V.W-o._w-1)),Math.round(Math.min(V.H-o._h-1,y+bh*0.25))]); }
  }
  function sprite(r,dir){
    if(!r.spr||r._bw!==V.bw||r._dpr!==V.dpr){ r.spr=bikeSprite(r.color,r.accent,V.bw,V.bh,V.dpr,1); r.sprL=r.spr?bikeSprite(r.color,r.accent,V.bw,V.bh,V.dpr,-1):null; r._bw=V.bw; r._dpr=V.dpr; }
    return dir<0?r.sprL:r.spr;
  }
  /* plates: every rider on TV and in a gate of up to 22 on a phone; a 40-rider gate on a phone: the top 12, the people, the red plate and
     a rider down (the tower lists them all) */
  function plate(r){
    var n=V.riders.length, tv=document.documentElement.hasAttribute("data-tv"), show=r.me||r.red||tv||n<=22||r.place<12||!!r.cr;
    if(!show) return null;
    if(!r.plate||r._fs!==V.fs||r._pdpr!==V.dpr){ r.plate=plateSprite(r.num,{red:r.red,me:r.me,color:r.color},V.dpr,V.fs); r._fs=V.fs; r._pdpr=V.dpr; }
    return r.plate;
  }
  return V;
}

MX.Track={create:create,stadium:stadium,outdoor:outdoor};
})(typeof window!=="undefined"?window:globalThis);
