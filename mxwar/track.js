/* MOTOCROSS WAR v2 — the TRACK view (the CEO, 2026-10-16 ~18:30: "I want it where it's smooth, where they ride up and actually pass each
   other. They should be riding the whole time, and he should be riding the actual track, and going through the whoop section and jumping
   the ramps."). window.MXWar.Track.create(host) -> a view. Original art only: plain shapes and gradients drawn on two canvases (no images
   from outside, no logos, no text but the riders' plate numbers).
   - The round's track is drawn as a LOOP, seeded by the venue (every city its own layout): a stadium Supercross track (the start straight
     with the gate and the finish line, 180-degree turns, a whoop section, a triple and rhythm jumps, the return straight) or an outdoor
     national (a longer winding loop over hills with big tabletops and rollers). Built once per layout into a static background canvas.
   - Every rider is a small bike in team colours with their plate riding continuously round it. The leader's lap follows the race (one
     battle = one lap: the leader crosses the finish line as the lap is decided, the pace learnt from the real lap times; when the field
     waits for a person's flip they keep riding, slower). Everyone else rides behind the leader at a gap from the standings (a bike's
     length a place, plus a little per card behind), so a change of places is a smooth ride-up and overtake: the gap eases to its new
     size and the rider moving up swings to the inside line to pass. Bikes bob through the whoops and arc over the jumps (a shadow on the
     ground under them), lean into the slopes and face the way they ride. The points leader's plate is RED.
   - Cheap: one requestAnimationFrame loop drawing pre-rendered sprites (one bike image per team colour and direction, one plate image per
     rider, one shadow) with transforms only: 2-3 drawImage calls a rider a frame. It stops while the page is hidden or the race isn't on
     screen (stop()). "Reduce effects" = simpler motion (no bob, arcs or shadows) at 30 frames a second, still smooth; reduced motion =
     no continuous motion at all (the bikes are drawn where they stand after every lap). */
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
function stadium(W,H,key){
  var R=rng(hash("sx|"+key)), C=new Course();
  var stands=Math.round(H*0.15), mB=Math.max(6,H*0.05), m=Math.max(8,W*0.03);
  var tw=clamp(Math.round((H-stands-mB)*0.1),8,30);
  var y0=stands+tw*0.9, y3=H-mB-tw*0.6, gap=(y3-y0)/3, r=gap/2, q=Math.min(gap*0.45,W*0.05);
  var y1=y0+gap, y2=y1+gap;
  var xV=m+tw*0.6, xL=xV+q, xLi=xV+tw*1.15+r+Math.max(2,W*0.008);
  var xMax=W-m-tw*0.6-r;
  var xR0=xMax-R()*W*0.07, xR2=xMax-R()*W*0.07;
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
function outdoor(W,H,key){
  var R=rng(hash("mx|"+key)), C=new Course();
  var sky=Math.round(H*0.16), m=Math.max(8,W*0.03), mB=Math.max(6,H*0.05);
  var tw=clamp(Math.round((H-sky-mB)*0.085),7,26);
  var cx=W/2, cy=(sky+tw+H-mB)/2, rx=W/2-m-tw, ry=(H-mB-sky-tw)/2-tw*0.4;
  var N=11, pts=[];
  for(var i=0;i<N;i++){
    var t=PI/2-i*TAU/N+(R()-0.5)*0.25, k=i===0?1:0.66+R()*0.34;   // point 0 at the bottom (the start straight)
    pts.push([cx+Math.cos(t)*rx*k,cy+Math.sin(t)*ry*(i===0?1:(0.62+R()*0.38))]);
  }
  /* a flat start straight: the bottom point becomes a straight run */
  var p0=pts[0]; pts[0]=[p0[0]-rx*0.32,cy+ry]; pts.unshift([p0[0]+rx*0.32,cy+ry]);
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
function drawBackground(ctx,C,W,H){
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
  /* a soft vignette */
  var vg=ctx.createRadialGradient(W/2,H*0.55,Math.min(W,H)*0.3,W/2,H*0.55,Math.max(W,H)*0.75); vg.addColorStop(0,"rgba(0,0,0,0)"); vg.addColorStop(1,"rgba(0,0,0,.45)"); ctx.fillStyle=vg; ctx.fillRect(0,0,W,H);
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
function create(host,opt){
  opt=opt||{};
  var bgC=document.createElement("canvas"), fgC=document.createElement("canvas");
  bgC.className="mx-trk__bg"; fgC.className="mx-trk__fg"; bgC.setAttribute("aria-hidden","true"); fgC.setAttribute("aria-hidden","true");
  host.appendChild(bgC); host.appendChild(fgC);
  var bx=bgC.getContext("2d"), fx=fgC.getContext("2d");
  var V={host:host,kind:"stadium",key:"",W:0,H:0,dpr:1,C:null,riders:[],by:{},phase:"gate",X:0,laps:0,lapT:now(),exp:2200,lapsN:30,
    run:false,raf:0,last:0,flag:null,flagT:0,mode:"full",tvScale:1,dirty:true,pFin:0,pGate:0,stillX:null};
  var P={};
  function motion(){ var B=g.BGUI; if(document.documentElement.getAttribute("data-motion")==="reduce"||(B&&B.reducedMotion&&B.reducedMotion())) return "off";
    return document.documentElement.getAttribute("data-effects")==="reduced"?"reduced":"full"; }
  /* layout: the host's size; the course and the background drawn again when it changes */
  V.resize=function(force){
    var W=Math.round(host.clientWidth), H=Math.round(host.clientHeight), dpr=Math.min(2,g.devicePixelRatio||1);
    if(!W||!H) return false;
    if(!force&&W===V.W&&H===V.H&&dpr===V.dpr&&V.C&&V.C.kind===V.kind&&V.C._key===V.key) return true;
    V.W=W; V.H=H; V.dpr=dpr;
    [bgC,fgC].forEach(function(c){ c.width=Math.round(W*dpr); c.height=Math.round(H*dpr); c.style.width=W+"px"; c.style.height=H+"px"; });
    V.C=V.kind==="outdoor"?outdoor(W,H,V.key):stadium(W,H,V.key); V.C._key=V.key;
    bx.setTransform(dpr,0,0,dpr,0,0); drawBackground(bx,V.C,W,H);
    var rem=parseFloat(getComputedStyle(document.documentElement).fontSize)||16, tv=document.documentElement.hasAttribute("data-tv");
    V.bw=clamp(Math.round(V.C.tw*(V.kind==="outdoor"?2.1:1.9)),18,tv?46:34); V.bh=Math.round(V.bw*2/3);
    V.fs=Math.round(tv?Math.max(14,rem*0.72):Math.max(10,Math.min(12,rem*0.72)));
    V.pFin=V.C.fin/V.C.L; V.pGate=V.C.gate/V.C.L; if(V.pGate<V.pFin) V.pGate+=1;
    V.unit=V.bw*1.05/V.C.L;
    V.riders.forEach(function(r){ r.spr=null; r.plate=null; });
    V.dirty=true; drawFrame(0,true);
    return true;
  };
  V.setLayout=function(kind,key){ kind=kind==="outdoor"?"outdoor":"stadium"; key=String(key||""); if(kind!==V.kind||key!==V.key){ V.kind=kind; V.key=key; V.resize(true); } };
  /* the riders of this race: [{s, color, accent, plate, red, me}] in gate order */
  V.setRiders=function(list){
    V.riders=list.map(function(o,k){ return {s:o.s,k:k,color:o.color,accent:o.accent,num:o.plate,red:!!o.red,me:!!o.me,out:false,off:0,offT:0,lane:0,laneT:0,
      base:((k*7919)%11-5)/5*0.22,face:1,spr:null,sprL:null,plate:null,place:k}; });
    V.by={}; V.riders.forEach(function(r){ V.by[r.s]=r; bikeImage(r.color,r.accent,function(){ r.spr=null; V.dirty=true; if(!V.run) drawFrame(0,true); }); });
    V.dirty=true;
  };
  /* the gate: the riders lined up behind it in gate order (lanes across the start straight, rows back from the gate) */
  V.gate=function(on){
    V.phase=on?"gate":"race";
    var C=V.C; if(!C) return;
    var n=V.riders.length, lanes=n>30?5:n>12?4:3, cols=Math.ceil(n/lanes);
    var room=(C.gate-C.gateLine)/C.L, step=Math.min(V.unit*0.9,room/Math.max(1,cols));
    V.riders.forEach(function(r){ var c=Math.floor(r.k/lanes), l=r.k%lanes; r.gx=V.pGate-(c+0.6)*step; r.gl=(l-(lanes-1)/2)/Math.max(1,(lanes-1)/2)*0.85; if(on){ r.off=V.pGate-r.gx; r.offT=r.off; r.lane=r.gl; r.laneT=r.gl; } });
    if(on){ V.X=V.pGate; V.laps=0; V.lapT=now(); V.flag=null; }
    else { V.X=V.pGate; V.lapT=now(); V.riders.forEach(function(r){ r.off=V.pGate-r.gx; r.lane=r.gl; }); }
    V.dirty=true; if(!V.run) drawFrame(0,true);
  };
  /* where the steel gate stands (CSS px in the host): for the page's #gate and its dust */
  V.gateRect=function(){ var C=V.C; if(!C) return null; C.at(C.gate,P); var h=C.tw*1.9; return {x:P.x,y:P.y-h*0.62,h:h,w:Math.max(5,C.tw*0.32)}; };
  /* the standings after a lap (or a change): order = seats by place; cnt = cards held; out = seats out of cards */
  V.update=function(order,cnt,outs){
    var C=V.C; if(!C) return;
    var max=0; order.forEach(function(s){ if(cnt[s]>max) max=cnt[s]; });
    var alive=order.filter(function(s){ return !(outs&&outs[s]); });
    var raw=[0], minGap=V.unit*1.35, kc=V.unit*0.08, i;   /* riders level on cards still ride a bike and a third apart (v1 leftover: crowded bikes) */
    for(i=1;i<alive.length;i++) raw.push(raw[i-1]+minGap+kc*Math.max(0,(cnt[alive[i-1]]||0)-(cnt[alive[i]]||0)));
    var tot=raw[raw.length-1]||0, lim=0.84, sc=tot>lim?lim/tot:1;
    alive.forEach(function(s,i){ var r=V.by[s]; if(!r) return; r.offT=raw[i]*sc; r.out=false; r.place=i; });
    order.forEach(function(s,i){ var r=V.by[s]; if(r&&outs&&outs[s]){ if(!r.out){ r.out=true; r.parkT=now(); } r.place=i; } });
    V.dirty=true; if(!V.run) drawFrame(0,true);
  };
  /* a lap is decided (battle n done): the leader is due at the finish line; the lap time learnt for the pace */
  V.lap=function(n,len){
    var t=now(), d=t-V.lapT;
    if(n>V.laps&&V.laps>0&&d>200&&d<20000) V.exp=clamp(V.exp*0.6+d*0.4,400,12000);
    if(n>V.laps){ V.laps=n; V.lapT=t; }
    if(len) V.lapsN=len;
    if(motion()==="off"){ V.X=V.pFin+V.laps+0.5; }
    V.dirty=true; if(!V.run) drawFrame(0,true);
  };
  V.setLaps=function(n,len){ V.laps=n; V.lapsN=len||V.lapsN; V.lapT=now(); V.X=n>0?V.pFin+n:V.pGate; V.riders.forEach(function(r){ r.off=r.offT; r.lane=r.laneT; }); };
  V.setPace=function(ms){ if(ms>0) V.exp=clamp(ms,400,12000); };
  V.setFlag=function(f){ V.flag=f||null; V.flagT=now(); if(f==="checkered") V.phase="over"; V.dirty=true; if(!V.run) drawFrame(0,true); };
  V.setRed=function(s){ V.riders.forEach(function(r){ var on=r.s===s; if(on!==r.red){ r.red=on; r.plate=null; } }); V.dirty=true; };
  /* the loop */
  function tick(t){
    V.raf=0; if(!V.run) return;
    if(document.hidden){ V.run=false; return; }
    var mo=motion();
    if(mo==="off"){ V.run=false; drawFrame(0,true); return; }
    var dt=V.last?Math.min(100,t-V.last):16;
    if((mo==="reduced"||V.half)&&V.last&&t-V.last<31){ V.raf=requestAnimationFrame(tick); return; }
    /* a device that can't keep up (frames late, or a frame costing over 8 ms) rides at 30 frames a second: the same look, half the work */
    var c0=now(); V.last=t; drawFrame(dt,false); var cost=now()-c0;
    if(!V.half&&mo==="full"){ V.fs2=(V.fs2||0)+1; V.ft=(V.ft||0)+dt; V.fc=(V.fc||0)+cost; if(V.fs2>=90){ if(V.ft/V.fs2>22||V.fc/V.fs2>8) V.half=true; V.fs2=0; V.ft=0; V.fc=0; } }
    V.raf=requestAnimationFrame(tick);
  }
  V.start=function(){ if(V.run) return; if(document.hidden) return; if(motion()==="off"){ drawFrame(0,true); return; } V.run=true; V.last=0; V.raf=requestAnimationFrame(tick); };
  V.stop=function(){ V.run=false; if(V.raf){ cancelAnimationFrame(V.raf); V.raf=0; } };
  document.addEventListener("visibilitychange",function(){ if(document.hidden) V.stop(); else if(V.want) V.start(); });
  V.want=false;
  V.show=function(on){ V.want=!!on; if(on) V.start(); else V.stop(); };
  V.state=function(){ return {half:!!V.half,run:V.run,riders:V.riders.length,laps:V.laps,X:+V.X.toFixed(3),exp:Math.round(V.exp),kind:V.kind,key:V.key,W:V.W,H:V.H,flag:V.flag,phase:V.phase,mode:motion(),frames:V.frames|0}; };
  V.positions=function(){ var C=V.C, out=[]; if(!C) return out; V.riders.forEach(function(r){ var s=(V.X-r.off)*C.L; C.at(s,P); out.push({s:r.s,x:Math.round(P.x),y:Math.round(P.y),off:+r.off.toFixed(4),offT:+r.offT.toFixed(4),out:r.out,place:r.place}); }); return out; };
  V.frames=0;

  /* advance the riders and draw one frame (dt ms; still = draw where they stand) */
  function drawFrame(dt,still){
    var C=V.C; if(!C||!V.W) return;
    var mo=motion(), simple=mo!=="full", W=V.W, H=V.H, dpr=V.dpr, t=now();
    if(!still&&dt>0&&V.phase!=="gate"){
      /* the leader's pace: due at the finish line as the lap is decided (from = this lap's start, to = the next line crossing) */
      var from=V.laps===0?V.pGate:V.pFin+V.laps, to=V.pFin+V.laps+1, el=(t-V.lapT)/V.exp;
      var want=from+(to-from)*Math.min(0.97,Math.max(0,el)), cruise=1/V.exp;
      if(V.phase==="over") want=V.X+0.25;
      var v=cruise*clamp(1+2.2*(want-V.X)/Math.max(0.05,to-from),V.phase==="over"?0.4:0.55,1.9);
      V.X+=v*dt;
      var k=1-Math.exp(-dt/(simple?420:650)), kl=1-Math.exp(-dt/260);
      V.riders.forEach(function(r){
        var d=r.offT-r.off; r.off+=d*k;
        r.laneT=r.base+clamp(d/(V.unit*1.4),-1,1)*-0.85;   // the rider moving up (the gap shrinking) swings to the inside to pass
        r.lane+=(r.laneT-r.lane)*kl;
      });
    } else if(still&&mo==="off"&&V.phase!=="gate"){
      V.riders.forEach(function(r){ r.off=r.offT; r.lane=r.base; });
    }
    fx.setTransform(1,0,0,1,0,0); fx.clearRect(0,0,fgC.width,fgC.height);
    var tw=C.tw, bw=V.bw, bh=V.bh, list=V.riders.slice();
    list.sort(function(a,b){ return ((a.me?2:0)+(a.red?1:0))-((b.me?2:0)+(b.red?1:0))||b.place-a.place; });   // the back of the field first; the red plate, then the people, on top
    /* the riders out of cards: parked in the pits (bottom right), dimmed */
    var parked=0;
    list.forEach(function(r){
      if(r.out){
        fx.globalAlpha=0.38; var spr=sprite(r,1); var px=W-8-bw*0.7*(++parked), py=H-4;
        if(spr) { fx.setTransform(dpr*0.7,0,0,dpr*0.7,dpr*px,dpr*(py-bh*0.7)); fx.drawImage(spr,0,0,bw,bh); }
        fx.globalAlpha=1; return;
      }
      var s=(V.phase==="gate"?r.gx:(V.X-r.off))*C.L;
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
      /* the plate floats above the rider, upright */
      var pl=plate(r);
      /* neighbours' plates are staggered (every other place a plate higher) so a close pack's numbers stay readable */
      if(pl){ fx.setTransform(dpr,0,0,dpr,0,0); var pw=pl._w, phh=pl._h, top=y-lift-bh*depth*0.98-phh*0.92-(r.place%2?phh*0.8:0); fx.drawImage(pl,Math.round(x-pw/2),Math.round(Math.max(1,top)),pw,phh); }
    });
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
  function sprite(r,dir){
    if(!r.spr||r._bw!==V.bw||r._dpr!==V.dpr){ r.spr=bikeSprite(r.color,r.accent,V.bw,V.bh,V.dpr,1); r.sprL=r.spr?bikeSprite(r.color,r.accent,V.bw,V.bh,V.dpr,-1):null; r._bw=V.bw; r._dpr=V.dpr; }
    return dir<0?r.sprL:r.spr;
  }
  /* plates: every rider on TV and in a gate of up to 22 on a phone; a 40-rider gate on a phone: the top 12, the people and the red plate
     (the tower lists them all); neighbours' plates are staggered so they stay readable */
  function plate(r){
    var n=V.riders.length, tv=document.documentElement.hasAttribute("data-tv"), show=r.me||r.red||tv||n<=22||r.place<12;
    if(!show) return null;
    if(!r.plate||r._fs!==V.fs||r._pdpr!==V.dpr){ r.plate=plateSprite(r.num,{red:r.red,me:r.me,color:r.color},V.dpr,V.fs); r._fs=V.fs; r._pdpr=V.dpr; }
    return r.plate;
  }
  return V;
}

MX.Track={create:create,stadium:stadium,outdoor:outdoor};
})(typeof window!=="undefined"?window:globalThis);
