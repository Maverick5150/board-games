/* MOTOCROSS WAR 3D — the tracks: layouts (BG_audit/games/mxwar/LAYOUT-FORMAT.md) and the course builder with the riding physics.
   window.MXWar.Tracks (node: module.exports, pure: no DOM).
   - A LAYOUT is facts in our own coordinates: a closed centre line (normalised points, x right, y down, starting at the start gate), a
     length and width in metres, an optional elevation by lap fraction, and features along it (start, finish, whoops, rhythm, triple, double,
     tabletop, stepup, stepdown, big-jump, berm, sand, hill, offcamber ...). The researcher's real layouts arrive as mxwar/data/tracks.js
     (window.MXWarTracks = track-layouts.json); until a round has one, three built-in tracks of our own design stand in: a modern stadium
     Supercross track, the Daytona hybrid and an outdoor national with hills (status ERA-DEFAULT / SKETCHED, said so in the data).
   - build(layout) -> a COURSE: the centre line resampled every 0.5 m (a centripetal Catmull-Rom spline), its heading and curvature, the
     ground (base elevation + feature shapes + banked berms on the outside of turns), and the riding profile every rider follows:
       speed (cornering limit from the curvature, braking 8.5 m/s2 and a 450's acceleration, the exact take-off speed of every jump so it
       lands on the landing's down face, the whoops skimmed at speed), the time along the lap (calibrated to a real lap: a stadium lap about
       50-60 s), the bike's PATH (ground-following, ballistic arcs off every lip: g = 9.81, the whoops skimmed crest to crest), its pitch, the
       suspension (a spring-damper hit by every landing), standing or seated, and the lean in the turns. Every rider rides the same physics
       at their own time gap, so a pack bunches in the turns and strings out on the straights by itself. */
(function(g){
"use strict";
var MX=g.MXWar=g.MXWar||{};
if(MX.Tracks) return;
var PI=Math.PI, TAU=PI*2, GRAV=9.81;
function clamp(x,a,b){ return x<a?a:x>b?b:x; }
function sstep(x){ x=clamp(x,0,1); return x*x*(3-2*x); }
function hash(s){ var h=2166136261>>>0; s=String(s||""); for(var i=0;i<s.length;i++){ h^=s.charCodeAt(i); h=Math.imul(h,16777619)>>>0; } return h>>>0; }

/* ---------------- the built-in layouts: drawn with a tiny path language in metres, stored in the layout format ----------------
   P(x, y, headingDeg): s(len) a straight; t(radius, deg) a turn (deg > 0 = right, < 0 = left); f(type, len, extra) a feature over the next
   len metres (a straight); mark(type, extra) a zero-length mark (the finish line). Map coordinates: x right, y down. */
function Path(x,y,hd){ this.x=x; this.y=y; this.h=hd*PI/180; this.h0=this.h; this.pts=[[x,y]]; this.s=0; this.feats=[]; this.el=[]; }
Path.prototype.pt=function(){ this.pts.push([this.x,this.y]); };
Path.prototype.st=function(len){ var n=Math.max(1,Math.ceil(len/7)); for(var i=0;i<n;i++){ this.x+=Math.cos(this.h)*len/n; this.y+=Math.sin(this.h)*len/n; this.pt(); } this.s+=len; return this; };
Path.prototype.t=function(r,deg){ var a=deg*PI/180, n=Math.max(2,Math.ceil(Math.abs(deg)/15)), side=deg>0?1:-1;
  var cx=this.x-Math.sin(this.h)*r*side, cy=this.y+Math.cos(this.h)*r*side, a0=Math.atan2(this.y-cy,this.x-cx);
  for(var i=1;i<=n;i++){ var aa=a0+a*i/n; this.x=cx+Math.cos(aa)*r; this.y=cy+Math.sin(aa)*r; this.pt(); }
  this.h+=a; this.s+=Math.abs(a)*r; return this; };
Path.prototype.f=function(type,len,ex){ var F={type:type,s0:this.s,s1:this.s+len}; for(var k in (ex||{})) F[k]=ex[k]; this.feats.push(F); return this.st(len); };
Path.prototype.mark=function(type,ex){ var F={type:type,s0:this.s,s1:this.s+0.5}; for(var k in (ex||{})) F[k]=ex[k]; this.feats.push(F); return this; };
Path.prototype.elev=function(m){ this.el.push([this.s,m]); return this; };
/* close the loop exactly: the shortest turn-straight-turn (Dubins) from here onto the start pose, turns of radius r */
Path.prototype.close=function(r){
  var x0=this.x, y0=this.y, h0=this.h, x1=this.pts[0][0], y1=this.pts[0][1], h1=this.h0, best=null, sides=[[1,1],[-1,-1],[1,-1],[-1,1]];
  function ctr(x,y,h,s){ return [x-s*r*Math.sin(h),y+s*r*Math.cos(h)]; }
  function wrap(a){ a%=TAU; return a<0?a+TAU:a; }
  sides.forEach(function(sd){ var s1=sd[0], s2=sd[1], c1=ctr(x0,y0,h0,s1), c2=ctr(x1,y1,h1,s2), dx=c2[0]-c1[0], dy=c2[1]-c1[1], d=Math.hypot(dx,dy), th=Math.atan2(dy,dx);
    var q=r*(s2-s1)/Math.max(1e-9,d); if(Math.abs(q)>1) return; var ph=th-Math.asin(q), len=d*Math.cos(th-ph); if(len<0) return;
    var a1=wrap((ph-h0)*s1), a2=wrap((h1-ph)*s2), tot=r*a1+len+r*a2; if(!best||tot<best.tot) best={s1:s1,s2:s2,a1:a1,a2:a2,len:len,tot:tot}; });
  if(!best) return this;
  if(best.a1>1e-3) this.t(r,best.s1*best.a1*180/PI); if(best.len>0.05) this.st(best.len); if(best.a2>1e-3) this.t(r,best.s2*best.a2*180/PI);
  return this;
};
Path.prototype.layout=function(meta){
  /* close the loop onto the start, then normalise (one scale for x and y: the shape is kept) */
  this.pts.pop();
  var L=0, n=this.pts.length, i; for(i=0;i<n;i++){ var a=this.pts[i], b=this.pts[(i+1)%n]; L+=Math.hypot(b[0]-a[0],b[1]-a[1]); }
  var minx=1e9, miny=1e9, maxx=-1e9, maxy=-1e9; this.pts.forEach(function(p){ minx=Math.min(minx,p[0]); miny=Math.min(miny,p[1]); maxx=Math.max(maxx,p[0]); maxy=Math.max(maxy,p[1]); });
  var span=Math.max(maxx-minx,maxy-miny), pad=span*0.04, k=1/(span+pad*2);
  var out={}; for(var m in meta) out[m]=meta[m];
  out.points=this.pts.map(function(p){ return [+((p[0]-minx+pad)*k).toFixed(4),+((p[1]-miny+pad)*k).toFixed(4)]; });
  out.lengthM=Math.round(L);
  out.features=this.feats.map(function(F){ var o={t0:+(F.s0/L).toFixed(4),t1:+(Math.min(F.s1,L)/L).toFixed(4),type:F.type}; for(var q in F) if(q!=="s0"&&q!=="s1"&&q!=="type") o[q]=F[q]; return o; });
  if(this.el.length) out.elev=this.el.map(function(e){ return [+(e[0]/L).toFixed(4),e[1]]; });
  return out;
};
var BUILTIN=null;
function builtins(){
  if(BUILTIN) return BUILTIN;
  /* 1. a modern stadium Supercross track (our own design in the modern style): a long start straight into a 180 left, the whoops, a
        rhythm lane and a tabletop, the big triple, the finish line and its jump, a sand corner on the way back. About 540 m, 8.5 m wide. */
  var A=new Path(30,72,0);
  A.f("start",100).t(9,-180).st(14).f("whoops",54,{count:15}).st(16).t(8,180).st(10).f("rhythm",46,{count:6}).st(10).f("tabletop",18).st(14)
   .t(8,-180).st(14).f("triple",34,{name:"The triple"}).st(12).mark("finish").f("tabletop",16,{name:"Finish-line jump"}).st(38).t(10,-90).f("sand",14).st(16).t(10,-90).close(10);
  var sx=A.layout({id:"sx-stadium",name:"Stadium Supercross",venue:"",city:"",kind:"stadium",years:[1974,2026],status:"ERA-DEFAULT",
    source:"Our own design in the modern stadium style (no published map copied)",widthM:8.5,soil:"stadium-dirt",surroundings:"stadium-open",lapS:56});
  /* 2. the Daytona hybrid: the Supercross track in the speedway's infield, longer and faster with wide turns, sandy soil, under the lights */
  var D=new Path(40,120,0);
  D.f("start",140).st(10).t(15,-180).st(14).f("rhythm",50,{count:7}).st(14).f("double",24).st(18).t(15,180).st(12).f("whoops",52,{count:15}).st(24).f("triple",34,{name:"The big triple"}).st(4)
   .t(15,-180).st(14).f("sand",30).st(10).f("stepup",24).st(16).mark("finish").f("tabletop",20,{name:"Finish-line jump"}).st(36).close(15);
  var dy=D.layout({id:"daytona-hybrid",name:"Daytona",venue:"Daytona International Speedway",city:"Daytona Beach",kind:"stadium",years:[1974,2026],status:"SKETCHED",
    source:"The speedway-infield hybrid (long, sandy, fast) sketched from descriptions; the yearly layout is not traced",widthM:10,soil:"sand",surroundings:"beach-speedway",lapS:66});
  /* 3. an outdoor national with hills: a long start straight, a climb to a tabletop on the hilltop, rollers down, the big double, whoops in
        the valley, a step-up back up the hill, an off-camber, a double, a sand corner, the finish-line tabletop */
  var N=new Path(60,520,0);
  N.elev(0).f("start",190).st(20).t(34,-90).st(60).elev(8).f("tabletop",28,{name:"Top of the hill"}).elev(14).st(60).f("rollers",50,{count:5}).st(40)
   .t(30,-90).st(30).f("rhythm",64,{count:5}).st(40).elev(16).t(32,-180).st(30).f("big-jump",46,{name:"The big double"}).elev(8).st(40)
   .t(28,180).st(24).f("whoops",56,{count:12}).elev(2).st(36).t(26,-180).st(16).f("stepup",30).st(24).f("offcamber",30).elev(5).st(16)
   .t(26,180).f("double",32).st(24).f("sand",44).elev(1).st(24).mark("finish").f("tabletop",26,{name:"Finish-line tabletop"}).st(24).close(30);
  var mx=N.layout({id:"national-hills",name:"Outdoor National",venue:"",city:"",kind:"outdoor",years:[1972,2026],status:"ERA-DEFAULT",
    source:"Our own design in the style of a hilly national (no published map copied)",widthM:10,soil:"loam",surroundings:"hills-trees",lapS:120});
  BUILTIN={sx:sx,daytona:dy,mx:mx}; return BUILTIN;
}

/* ---------------- choosing a layout for a round ---------------- */
function data(){ return g.MXWarTracks||null; }
function byId(id){ var D=data(); if(D&&D.layouts) for(var i=0;i<D.layouts.length;i++) if(D.layouts[i].id===id) return D.layouts[i]; var B=builtins(); for(var k in B) if(B[k].id===id) return B[k]; return null; }
function norm(s){ return String(s||"").toLowerCase().replace(/[^a-z0-9]+/g," ").trim(); }
/* series "sx" | "mx" | "smx", year, the calendar entry {n, city, venue}: the researcher's layout for that round, else the venue's layout for
   that year, else a built-in (Daytona by its city, outdoor for Motocross, the stadium track for the rest); the mirror variant spreads the
   built-in stadium track over the season so two cities in a row don't look the same */
function forRound(series,year,cal){
  var D=data(), key=series+"-"+year+"-r"+(cal&&cal.n), L=null;
  if(D&&D.rounds&&D.rounds[key]) L=byId(D.rounds[key]);
  if(!L&&D&&D.layouts){
    var v=norm(cal&&cal.venue), c=norm(cal&&cal.city), best=null;
    D.layouts.forEach(function(x){ var yr=x.years||[0,9999]; if(year<yr[0]||year>yr[1]) return;
      var kindOk=(series==="mx")===(x.kind==="outdoor")||series==="smx";
      if(!kindOk) return;
      var hit=(v&&norm(x.venue)&&norm(x.venue)===v)||(c&&norm(x.city)&&norm(x.city).split(" ")[0]===c.split(" ")[0]);
      if(hit&&(!best||(x.years&&best.years&&x.years[0]>best.years[0]))) best=x; });
    L=best;
  }
  var B=builtins(), variant=0;
  if(!L){
    if(/daytona/i.test((cal&&cal.city)||"")||/daytona/i.test((cal&&cal.venue)||"")) L=B.daytona;
    else if(series==="mx") L=B.mx;
    else if(series==="smx") L=B.daytona;
    else { L=B.sx; variant=hash((cal&&(cal.venue||cal.city))||"")%4; }
  }
  return {layout:L,variant:variant,key:L.id+"|"+variant};
}

/* ---------------- feature shapes (height above the base, metres, at x metres into a feature of length len) ---------------- */
function bump(x,a,b,h,k){ /* a mound rising over [a, mid] and falling over [mid, b] */ if(x<=a||x>=b) return 0; var u=(x-a)/(b-a); return h*Math.pow(Math.sin(PI*u),k||1); }
function face(x,a,b,h,p){ /* a take-off face: concave, rising from a to the lip at b (height h), then a short back slope */ if(x<a) return 0; if(x<=b) return h*Math.pow((x-a)/(b-a),p||1.35); var d=(x-b)/2.6; return d>=1?0:h*(1-d*d); }
function land(x,a,top,b,h){ /* a landing: the back rises over [a, top - .4], a short flat, the down face to b */ if(x<a||x>b) return 0; if(x<top-0.4){ var u=(x-a)/(top-0.4-a); return h*(1-(1-u)*(1-u)); } if(x<=top) return h; var w=(x-top)/(b-top); return h*(1-sstep(w)); }
var SHAPES={
  whoops:function(x,len,F){ var n=F.count||Math.max(4,Math.round(len/3.4)), u=x/len; if(u<0||u>1) return 0; var e=Math.min(1,Math.min(u,1-u)*n*0.9+0.45); return (F.h||1.12)*e*(0.5-0.5*Math.cos(TAU*n*u)); },
  rollers:function(x,len,F){ var n=F.count||Math.max(3,Math.round(len/9)); if(x<0||x>len) return 0; return (F.h||1.3)*(0.5-0.5*Math.cos(TAU*n*x/len)); },
  rhythm:function(x,len,F){ var n=F.count||Math.max(3,Math.round(len/7)), sp=len/n, i=Math.floor(x/sp), y=x-i*sp; if(i<0||i>=n) return 0; var h=(F.h||1.55)*(i%2?0.82:1); return bump(y,0.2,sp-0.2,h,0.8); },
  double:function(x,len,F){ var H=F.h||1.9; return Math.max(face(x,0,4.6,H),land(x,len-8.6,len-6.2,len,H)); },
  triple:function(x,len,F){ var H=F.h||2.3; return Math.max(face(x,0,5.4,H),bump(x,len*0.36,len*0.6,H*0.55,0.9),land(x,len-10,len-7,len,H*1.02)); },
  tabletop:function(x,len,F){ var H=F.h||1.9; if(x<0||x>len) return 0; if(x<4.6) return H*Math.pow(x/4.6,1.3); if(x<len-6) return H; return H*(1-sstep((x-(len-6))/6)); },
  stepup:function(x,len,F){ var H=F.h||1.5, H2=H*1.65; if(x<0||x>len) return 0; var t=face(x,0,4.2,H); if(x<len*0.55) return t; var a=len*0.55; if(x<a+3) return Math.max(t,H2*sstep((x-a)/3)); return H2*(1-sstep((x-(a+3))/(len-a-3))); },
  stepdown:function(x,len,F){ var H=F.h||2.2; if(x<0||x>len) return 0; if(x<len*0.4) return H*sstep(x/(len*0.15)); var d=(x-len*0.4)/(len*0.6); return H*0.35*(1-sstep(d)); },
  "big-jump":function(x,len,F){ var H=F.h||3.1; return Math.max(face(x,0,7,H,1.25),land(x,len-14,len-10.5,len,H*1.05)); },
  hill:function(x,len,F){ if(x<0||x>len) return 0; var s=Math.sin(PI*x/len); return (F.h||7)*s*s; }
};
var JUMPS={double:1,triple:1,tabletop:1,stepup:1,"big-jump":1,stepdown:1};
/* the shortest length a jump shape needs; a shorter mark in a traced layout is ridden as a roller */
var MINLEN={double:13,triple:20,tabletop:12,stepup:14,"big-jump":22,stepdown:12};
var PRI={whoops:5,rhythm:5,rollers:4,double:6,triple:6,tabletop:6,stepup:6,"big-jump":6,stepdown:6,sand:3,offcamber:2,mechanics:1,berm:1,hill:1,tunnel:1,bridge:1};

/* ---------------- the course ---------------- */
function build(layout,o){
  o=o||{}; var variant=o.variant|0, gateN=Math.max(8,Math.min(42,o.gate||22)), outdoor=layout.kind==="outdoor";
  var pts=layout.points.map(function(p){ return [variant&1?1-p[0]:p[0],variant&2?1-p[1]:p[1]]; });
  var n=pts.length, L0=0, i;
  for(i=0;i<n;i++){ var a=pts[i], b=pts[(i+1)%n]; L0+=Math.hypot(b[0]-a[0],b[1]-a[1]); }
  var sc=(layout.lengthM||600)/L0;
  /* centripetal Catmull-Rom through the points (closed), sampled densely */
  var dense=[];
  function P(k){ var q=pts[((k%n)+n)%n]; return [q[0]*sc,q[1]*sc]; }
  for(i=0;i<n;i++){
    var p0=P(i-1), p1=P(i), p2=P(i+1), p3=P(i+2);
    var t0=0, t1=t0+Math.pow(Math.hypot(p1[0]-p0[0],p1[1]-p0[1]),0.5)+1e-4, t2=t1+Math.pow(Math.hypot(p2[0]-p1[0],p2[1]-p1[1]),0.5)+1e-4, t3=t2+Math.pow(Math.hypot(p3[0]-p2[0],p3[1]-p2[1]),0.5)+1e-4;
    var seg=Math.max(2,Math.ceil(Math.hypot(p2[0]-p1[0],p2[1]-p1[1])/0.4));
    for(var k=0;k<seg;k++){ var t=t1+(t2-t1)*k/seg, xy=[0,0];
      for(var c=0;c<2;c++){
        var A1=(t1-t)/(t1-t0)*p0[c]+(t-t0)/(t1-t0)*p1[c], A2=(t2-t)/(t2-t1)*p1[c]+(t-t1)/(t2-t1)*p2[c], A3=(t3-t)/(t3-t2)*p2[c]+(t-t2)/(t3-t2)*p3[c];
        var B1=(t2-t)/(t2-t0)*A1+(t-t0)/(t2-t0)*A2, B2=(t3-t)/(t3-t1)*A2+(t-t1)/(t3-t1)*A3;
        xy[c]=(t2-t)/(t2-t1)*B1+(t-t1)/(t2-t1)*B2; }
      dense.push(xy); }
  }
  /* resample every DS metres */
  var DS=0.5, cum=[0];
  for(i=1;i<=dense.length;i++){ var u=dense[i-1], v=dense[i%dense.length]; cum.push(cum[i-1]+Math.hypot(v[0]-u[0],v[1]-u[1])); }
  var Ltot=cum[dense.length], N=Math.round(Ltot/DS), L=N*DS;
  var C={layout:layout,id:layout.id,variant:variant,kind:outdoor?"outdoor":"stadium",N:N,DS:DS,L:L,outdoor:outdoor,
    x:new Float32Array(N),z:new Float32Array(N),tx:new Float32Array(N),tz:new Float32Array(N),k:new Float32Array(N),E:new Float32Array(N),F:new Float32Array(N),
    hw:new Float32Array(N),berm:new Float32Array(N),sand:new Float32Array(N),cam:new Float32Array(N),feat:new Int16Array(N)};
  var j=0;
  for(i=0;i<N;i++){ var s=i*Ltot/N; while(j<dense.length-1&&cum[j+1]<s) j++; var f=(s-cum[j])/Math.max(1e-6,cum[j+1]-cum[j]), q0=dense[j], q1=dense[(j+1)%dense.length];
    C.x[i]=q0[0]+(q1[0]-q0[0])*f; C.z[i]=q0[1]+(q1[1]-q0[1])*f; }
  /* centre the track on the origin */
  var mnx=1e9,mxx=-1e9,mnz=1e9,mxz=-1e9; for(i=0;i<N;i++){ mnx=Math.min(mnx,C.x[i]); mxx=Math.max(mxx,C.x[i]); mnz=Math.min(mnz,C.z[i]); mxz=Math.max(mxz,C.z[i]); }
  var cx0=(mnx+mxx)/2, cz0=(mnz+mxz)/2; for(i=0;i<N;i++){ C.x[i]-=cx0; C.z[i]-=cz0; }
  C.box={x0:mnx-cx0,x1:mxx-cx0,z0:mnz-cz0,z1:mxz-cz0};
  /* heading and curvature (smoothed) */
  var hd=new Float32Array(N);
  for(i=0;i<N;i++){ var a2=(i+1)%N, b2=(i-1+N)%N, dx=C.x[a2]-C.x[b2], dz=C.z[a2]-C.z[b2], l=Math.hypot(dx,dz)||1; C.tx[i]=dx/l; C.tz[i]=dz/l; hd[i]=Math.atan2(dz,dx); }
  var kr=new Float32Array(N);
  for(i=0;i<N;i++){ var d=hd[(i+2)%N]-hd[(i-2+N)%N]; while(d>PI) d-=TAU; while(d<-PI) d+=TAU; kr[i]=d/(4*DS); }
  smooth(kr,C.k,8);
  /* features in metres */
  var W=(layout.widthM||(outdoor?10:8.5))/2;
  C.feats=(layout.features||[]).map(function(F,fi){ var o2={}; for(var q in F) o2[q]=F[q]; o2.s0=F.t0*L; o2.s1=Math.max(F.t1*L,o2.s0+0.5); o2.len=o2.s1-o2.s0; o2.i=fi;
    if(JUMPS[o2.type]&&o2.len<MINLEN[o2.type]){ o2.was=o2.type; o2.type="rollers"; o2.count=1; o2.h=Math.min(1.3,0.4+o2.len*0.08); }
    if(o2.type==="hill"&&layout.elev&&layout.elev.length) o2.mark=true;   /* the real elevation already has the hill */
    if(o2.type==="berm"||o2.type==="offcamber"||o2.type==="mechanics"||o2.type==="tunnel"||o2.type==="bridge") o2.mark=true;
    return o2; });
  C.featAt=function(s){ s=((s%L)+L)%L; var b=null; for(var q=0;q<C.feats.length;q++){ var F=C.feats[q]; if(s>=F.s0&&s<=F.s1&&!F.mark&&(!b||(PRI[F.type]||0)>(PRI[b.type]||0))) b=F; } return b; };
  var fin=C.feats.filter(function(F){ return F.type==="finish"; })[0], st=C.feats.filter(function(F){ return F.type==="start"; })[0];
  C.sFin=fin?(fin.s0+fin.s1)/2:(st?st.s1:L*0.9);
  C.startLen=st?st.len:Math.min(80,L*0.12);
  /* the base elevation (outdoors), the feature heights, the width (the start funnel), the berms */
  var el=(layout.elev||[]).slice().sort(function(a,b){ return a[0]-b[0]; });
  for(i=0;i<N;i++){
    var s2=i*DS, t2b=s2/L;
    C.E[i]=el.length?elevAt(el,t2b):0;
    var h=0, sd=0, fid=-1;
    for(var q=0;q<C.feats.length;q++){ var F=C.feats[q], x2=s2-F.s0; if(x2<-0.01||x2>F.len+0.01) continue; var fn=F.mark?null:SHAPES[F.type]; if(fn){ var hh=fn(x2,F.len,F); if(hh>h) h=hh; } if(F.type==="sand") sd=1;
      if(F.type!=="start"&&F.type!=="finish"&&(fid<0||(PRI[F.type]||0)>(PRI[C.feats[fid].type]||0))) fid=q; }
    C.F[i]=h; C.sand[i]=sd; C.feat[i]=fid;
    var gw=Math.max(W,gateN*0.5+1.2), fun=sstep(1-s2/Math.max(20,C.startLen*0.85));
    C.hw[i]=s2<C.startLen?W+(gw-W)*fun:W;
  }
  smooth(C.E,C.E,30);
  /* the start funnel widens toward the free side only (the stands side of a stadium start, never into the next row): the strip's centre
     moves sideways by the extra width (C.off), the inner edge stays where it was */
  C.off=new Float32Array(N);
  var nS=Math.min(N-1,Math.round(C.startLen/DS)), gw2=Math.max(W,gateN*0.5+1.2), room=[0,0];
  [1,-1].forEach(function(side,si){ var worst=1e9;
    for(var i2=0;i2<=nS;i2+=4){ var nx2=-C.tz[i2]*side, nz2=C.tx[i2]*side, px=C.x[i2]+nx2*(gw2*2-W), pz=C.z[i2]+nz2*(gw2*2-W);
      for(var j2=0;j2<N;j2+=3){ var along=Math.min(Math.abs(j2-i2),N-Math.abs(j2-i2))*DS; if(along<C.startLen+40) continue; var d2=Math.hypot(C.x[j2]-px,C.z[j2]-pz); if(d2<worst) worst=d2; } }
    room[si]=worst; });
  C.fside=room[0]>=room[1]?1:-1;
  for(i=0;i<N;i++) C.off[i]=C.fside*(C.hw[i]-W);
  /* berms: the outside of every turn rises (signed: + = the berm is on the right side) */
  var bmax=outdoor?1.2:1.6;
  for(i=0;i<N;i++){ var kk=C.k[i], bh=clamp(Math.abs(kk)*12,0,bmax); if(C.F[i]>0.3) bh*=0.3; C.berm[i]=kk>0?-bh:bh; }
  var tmp=new Float32Array(N); smooth(C.berm,tmp,10); C.berm=tmp;
  var oc=C.feats.filter(function(F){ return F.type==="offcamber"; });
  C.camb=new Float32Array(N); oc.forEach(function(F){ for(var s3=F.s0;s3<F.s1;s3+=DS){ var ii=((Math.round(s3/DS))%N+N)%N; C.camb[ii]=-0.13*Math.sin(PI*(s3-F.s0)/F.len)*(C.k[ii]>=0?1:-1); } });
  profile(C,o);
  return C;
}
function elevAt(el,t){ if(t<=el[0][0]) return lerpWrap(el[el.length-1],el[0],t); for(var i=0;i<el.length-1;i++) if(t<=el[i+1][0]){ var a=el[i], b=el[i+1]; return a[1]+(b[1]-a[1])*sstep((t-a[0])/Math.max(1e-6,b[0]-a[0])); } return lerpWrap(el[el.length-1],el[0],t); }
function lerpWrap(a,b,t){ var span=(b[0]+1)-a[0], u=((t<a[0]?t+1:t)-a[0])/Math.max(1e-6,span); return a[1]+(b[1]-a[1])*sstep(u); }
function smooth(src,dst,r){ var N=src.length, out=new Float32Array(N), acc=0, i; for(i=-r;i<=r;i++) acc+=src[((i%N)+N)%N]; for(i=0;i<N;i++){ out[i]=acc/(2*r+1); acc+=src[(i+r+1)%N]-src[((i-r)%N+N)%N]; } dst.set(out); return dst; }

/* the ground height at track position s (metres, wraps) and lateral offset lat (metres, + = right of the centre line) */
function idx(C,s){ var f=((s%C.L)+C.L)%C.L/C.DS, i=Math.floor(f); return [i%C.N,(i+1)%C.N,f-i]; }
function ground(C,s,lat){
  var q=idx(C,s), i=q[0], j=q[1], f=q[2];
  var base=C.E[i]+(C.E[j]-C.E[i])*f+C.F[i]+(C.F[j]-C.F[i])*f;
  if(!lat) return base;
  var hw=C.hw[i], bm=C.berm[i]+(C.berm[j]-C.berm[i])*f, u=lat/hw, side=bm>=0?1:-1, w=Math.max(0,u*side);
  return base+Math.abs(bm)*Math.pow(Math.min(w,1.25),1.7)+(C.camb[i]||0)*lat;
}
function fh(C,s){ /* centre-line ground at any s by the analytic feature shapes (finer than the 0.5 m samples, for the jump physics) */
  var L=C.L; s=((s%L)+L)%L; var q=idx(C,s), e=C.E[q[0]]+(C.E[q[1]]-C.E[q[0]])*q[2], h=0;
  for(var k=0;k<C.feats.length;k++){ var F=C.feats[k], x=s-F.s0; if(x<-0.01||x>F.len+0.01) continue; var fn=F.mark?null:SHAPES[F.type]; if(fn){ var y=fn(x,F.len,F); if(y>h) h=y; } }
  return e+h;
}

/* ---------------- the riding profile ---------------- */
function profile(C,o){
  var N=C.N, DS=C.DS, L=C.L, i, outdoor=C.outdoor;
  /* 1. the exact take-off speed of every jump: from the lip (the face's top) to a point on the landing's down face */
  C.feats.forEach(function(F){
    if(!JUMPS[F.type]) return;
    var lip=F.s0+(F.type==="big-jump"?7:F.type==="triple"?5.4:F.type==="stepup"?4.2:F.type==="stepdown"?F.len*0.4:4.6), tgt;
    if(F.type==="tabletop") tgt=F.s1-6+2.2; else if(F.type==="stepup") tgt=F.s0+F.len*0.55+3.4; else if(F.type==="stepdown") tgt=F.s1-F.len*0.3;
    else if(F.type==="big-jump") tgt=F.s1-10.5+3.6; else if(F.type==="triple") tgt=F.s1-7+2.6; else tgt=F.s1-6.2+2.3;
    var yl=fh(C,lip), sl=(fh(C,lip)-fh(C,lip-0.3))/0.3, th=Math.atan(sl), dx=tgt-lip, dy=fh(C,tgt)-yl;
    var den=2*Math.cos(th)*Math.cos(th)*(dx*Math.tan(th)-dy), v=den>0?Math.sqrt(GRAV*dx*dx/den):14;
    F.lip=lip; F.tgt=tgt; F.vj=clamp(v*Math.cos(th),6,outdoor?26:19); F.theta=th;
  });
  /* 2. the speed limit at every point (horizontal speed along the line) */
  var lim=new Float32Array(N), sp=new Float32Array(N), k=1;
  function limits(kv){
    for(i=0;i<N;i++){
      var kk=Math.abs(C.k[i]), bank=Math.abs(C.berm[i])>0.5, aLat=(bank?10.5:7.5)*kv*kv, vt=(outdoor?26:17)*kv;
      var v=kk>1e-4?Math.sqrt(aLat/kk):vt; v=Math.min(v,vt);
      if(C.sand[i]) v=Math.min(v,vt*0.72);
      var F=C.feat[i]>=0?C.feats[C.feat[i]]:null;
      if(F&&F.type==="whoops") v=Math.min(v,(outdoor?14:14.2)*Math.min(1.08,kv));
      if(F&&F.type==="rhythm") v=Math.min(v,(outdoor?15:11.5)*Math.min(1.1,kv));
      lim[i]=v;
    }
    /* the jumps: a steady run up the face at the take-off speed, the same speed in the air to the landing target */
    C.feats.forEach(function(F){ if(!F.vj) return; for(var s=F.lip-6;s<=F.tgt+1;s+=DS){ var ii=((Math.round(s/DS))%N+N)%N; lim[ii]=F.vj; } });
  }
  function passes(start0){
    var a, rep, vprev;
    for(i=0;i<N;i++) sp[i]=lim[i];
    for(rep=0;rep<3;rep++){
      for(i=0;i<N;i++){ var j=(i+1)%N, v=sp[i], acc=Math.max(1.2,7.8*(1-v/(outdoor?31:28))); var near=nearLip(j); if(near) acc=13; var vn=Math.sqrt(v*v+2*acc*DS); if(sp[j]>vn) sp[j]=vn; }
      for(i=N-1;i>=0;i--){ var j2=(i+1)%N, vb=Math.sqrt(sp[j2]*sp[j2]+2*8.5*DS); if(sp[i]>vb) sp[i]=vb; }
    }
  }
  var lipZone=new Uint8Array(N); C.feats.forEach(function(F){ if(!F.vj) return; for(var s=F.lip-28;s<=F.lip;s+=DS){ lipZone[((Math.round(s/DS))%N+N)%N]=1; } });
  function nearLip(j){ return lipZone[j]===1; }
  function lapTime(){ var t=0; for(i=0;i<N;i++) t+=DS/Math.max(0.5,sp[i]); return t; }
  /* 3. calibrate the free limits (cornering grip, top speed) to a real lap time; the jump speeds stay physical */
  var want=(C.layout.lapS)||(C.outdoor?clamp(L/16.5,95,170):clamp(L/11.2,42,80)), lo=0.55, hi=1.6;
  for(var it=0;it<22;it++){ k=(lo+hi)/2; limits(k); passes(); var tl=lapTime(); if(tl>want) lo=k; else hi=k; }
  limits(k); passes();
  C.kv=k;
  C.v=new Float32Array(sp);
  C.tau=new Float64Array(N+1); for(i=0;i<N;i++) C.tau[i+1]=C.tau[i]+DS/Math.max(0.5,sp[i]);
  C.Tlap=C.tau[N];
  /* the opening lap from a standing start at the gate (s = 0): the reaction, then the drive, until it meets the flying lap */
  var v0=new Float32Array(N), t0=new Float64Array(N+1), v=0, conv=-1;
  for(i=0;i<N;i++){ var acc0=Math.max(1.2,(i*DS<12?6.4:7.8)*(1-v/(C.outdoor?31:28))); if(conv<0){ v0[i]=Math.min(sp[i],v); if(i>0&&v>=sp[i]-1e-3&&i*DS>10) conv=i; v=Math.min(sp[i],Math.sqrt(v*v+2*acc0*DS)); } else v0[i]=sp[i]; }
  for(i=0;i<N;i++) t0[i+1]=t0[i]+DS/Math.max(0.6,v0[i]);
  C.v0=v0; C.tau0=t0; C.conv=conv<0?N:conv;
  /* 4. the bike's path: a sprung chassis over the ground (a 2 Hz spring, a damper, 0.30 m of travel; the wheels leave the ground as soon as
        the spring is unloaded, then it is ballistic, g = 9.81): faces are absorbed, the whoops are skimmed crest to crest, every lip throws
        the bike on an arc. Each jump's take-off speed is found by a bisection (a local ride up to the lip) so the arc lands on its target. */
  var Y=new Float32Array(N), AIR=new Uint8Array(N), PIT=new Float32Array(N), CMP=new Float32Array(N), STD=new Float32Array(N), LEAN=new Float32Array(N), ROOST=new Float32Array(N), FLY=new Int32Array(N);
  var KS=(TAU*2.0)*(TAU*2.0), CD=2*0.5*TAU*2.0, FREE=GRAV/KS, TRAVEL=0.3, flights=[], VY=new Float32Array(N);
  function simulate(record){
    var sub=4, h=DS/sub, y=fh(C,0), vy=0, inAir=false, takeS=0, takeP=0, fl=[];
    for(var lap=0;lap<2;lap++){
      for(i=0;i<N;i++){
        var vh=Math.max(1,sp[i]);
        for(var q=0;q<sub;q++){
          var s=i*DS+q*h+h, dt=h/vh, yg=fh(C,s), vg=(fh(C,s+0.15)-fh(C,s-0.15))/0.3*vh, ext=y-yg, ac;
          if(ext<FREE){ ac=KS*(yg-y)+CD*(vg-vy); if(ac<-GRAV) ac=-GRAV; } else ac=-GRAV;
          vy+=ac*dt; y+=vy*dt;
          if(yg-y>TRAVEL){ y=yg-TRAVEL; if(vy<vg) vy=vg; }
          var air=y-yg>FREE*1.05;
          if(air&&!inAir){ inAir=true; takeS=s; takeP=Math.atan2(vy,vh); }
          else if(!air&&inAir){ inAir=false; if(lap===1&&s-takeS>2.5) fl.push({s0:takeS,s1:s,p0:takeP,p1:Math.atan((fh(C,s+0.3)-fh(C,s-0.3))/0.6)}); }
        }
        if(lap===1&&record){ Y[i]=y; AIR[i]=inAir?1:0; CMP[i]=clamp(fh(C,i*DS)-y,0,TRAVEL); VY[i]=vy; }
      }
    }
    return fl;
  }
  /* each jump on its own: the chassis rides up to the lip at a steady speed; a bisection finds the take-off speed whose arc lands on the
     target (on the landing's down face) */
  function landAt(F,v,y0,vy0){
    var h=DS/4, s=F.lip-14, y=fh(C,s)+(y0||0), vy=vy0||0, air=false, took=-1;
    for(var n2=0;n2<4000;n2++){
      var sN=s+h, dt=h/v, yg=fh(C,sN), vg=(fh(C,sN+0.15)-fh(C,sN-0.15))/0.3*v, ac;
      if(y-yg<FREE){ ac=KS*(yg-y)+CD*(vg-vy); if(ac<-GRAV) ac=-GRAV; } else ac=-GRAV;
      vy+=ac*dt; y+=vy*dt; if(yg-y>TRAVEL){ y=yg-TRAVEL; if(vy<vg) vy=vg; }
      var a=y-yg>FREE*1.05; s=sN;
      if(a&&!air){ air=true; if(took<0&&s>F.lip-2.5) took=s; }
      else if(!a&&air){ air=false; if(took>=0&&s-took>1.5) return s; }
      if(s>F.s1+25) return s;
    }
    return s;
  }
  function calib(F,y0,vy0){ var lo=5, hi=outdoor?28:21;
    for(var it2=0;it2<24;it2++){ var mid=(lo+hi)/2; if(landAt(F,mid,y0,vy0)<F.tgt) lo=mid; else hi=mid; }
    F.vj=(lo+hi)/2; }
  C.feats.forEach(function(F){ if(F.vj) calib(F,0,0); });
  limits(k); passes();
  /* round two: a jump right after a rough section meets the face with the chassis still moving: calibrate again from the full lap's state */
  var fl1=simulate(true), again=false;
  C.feats.forEach(function(F){ if(!F.vj) return; var f=null; fl1.forEach(function(x){ if(!f&&x.s0>=F.lip-2.5&&x.s0<=F.lip+1.5) f=x; });
    if(f&&Math.abs(f.s1-F.tgt)<1.2) return; var i0=((Math.round((F.lip-14)/DS))%N+N)%N; calib(F,Y[i0]-fh(C,F.lip-14),VY[i0]); again=true; });
  if(again){ limits(k); passes(); }
  C.v=new Float32Array(sp); for(i=0;i<N;i++) C.tau[i+1]=C.tau[i]+DS/Math.max(0.5,sp[i]); C.Tlap=C.tau[N];
  for(i=0;i<N;i++) C.tau0[i+1]=C.tau0[i]+DS/Math.max(0.6,i<C.conv?Math.min(C.v0[i],sp[i]):sp[i]);
  flights=simulate(true);
  /* pitch: from the path under the two wheels; in a long flight, from the take-off angle to the landing slope */
  for(i=0;i<N;i++){ var sA=i*DS, ya=pathAt(Y,N,DS,sA+0.74), yb=pathAt(Y,N,DS,sA-0.74); PIT[i]=Math.atan2(ya-yb,1.48); }
  flights.forEach(function(fl){ var a=fl.s0, b=fl.s1; if(b<a) b+=L; for(var s=a;s<=b;s+=DS){ var u=(s-a)/(b-a), ii=((Math.round(s/DS))%N+N)%N; PIT[ii]=fl.p0+(fl.p1-fl.p0)*sstep(u)-0.06*Math.sin(PI*u); FLY[ii]=1; } });
  /* standing: in the whoops, rhythm and jumps and on the fast straights; seated in the turns */
  for(i=0;i<N;i++){ var Fq=C.feat[i]>=0?C.feats[C.feat[i]]:null, stv=0;
    if(Fq&&(Fq.type!=="sand"&&Fq.type!=="berm"&&Fq.type!=="offcamber")) stv=1;
    if(AIR[i]||FLY[i]) stv=1; if(sp[i]>13.5&&Math.abs(C.k[i])<0.02) stv=Math.max(stv,0.8); if(Math.abs(C.k[i])>0.05) stv*=0.2; STD[i]=stv; }
  var std2=new Float32Array(N); smooth(STD,std2,8);
  /* lean into the turns: atan(v^2 k / g), smoothed */
  for(i=0;i<N;i++) LEAN[i]=clamp(Math.atan(sp[i]*sp[i]*C.k[i]/GRAV),-0.78,0.78);
  var lean2=new Float32Array(N); smooth(LEAN,lean2,4);
  /* roost: hard acceleration out of the turns */
  for(i=0;i<N;i++){ var j3=(i+1)%N, acc3=(sp[j3]*sp[j3]-sp[i]*sp[i])/(2*DS); ROOST[i]=AIR[i]?0:clamp((acc3-1.2)/4,0,1)*(C.sand[i]?1.4:1); }
  C.Y=Y; C.air=AIR; C.pitch=PIT; C.comp=CMP; C.stand=std2; C.lean=lean2; C.roost=ROOST; C.fly=FLY; C.flights=flights;
}
function pathAt(Y,N,DS,s){ var f=((s/DS)%N+N)%N, i=Math.floor(f), j=(i+1)%N; f-=i; return Y[i]+(Y[j]-Y[i])*f; }

/* ---------------- reading a course ---------------- */
/* the profile time -> race distance (metres from the gate, continuous over the laps): the opening lap from the standing start, then flying laps */
function distAt(C,tau){
  if(tau<=0) return 0;
  var T0=C.tau0[C.N];
  if(tau<T0) return C.DS*search(C.tau0,tau,C.N);
  var t=tau-T0, laps=Math.floor(t/C.Tlap), r=t-laps*C.Tlap;
  return C.L*(1+laps)+C.DS*search(C.tau,r,C.N);
}
/* the inverse: the profile time at race distance D */
function timeAt(C,D){
  if(D<=0) return 0;
  if(D<C.L) return lerpArr(C.tau0,D/C.DS);
  var laps=Math.floor(D/C.L)-1, r=D-C.L*(laps+1);
  return C.tau0[C.N]+laps*C.Tlap+lerpArr(C.tau,r/C.DS);
}
function lerpArr(a,f){ var i=Math.floor(f), t=f-i; if(i>=a.length-1) return a[a.length-1]; return a[i]+(a[i+1]-a[i])*t; }
function search(a,v,N){ var lo=0, hi=N; while(hi-lo>1){ var m=(lo+hi)>>1; if(a[m]<=v) lo=m; else hi=m; } var d=a[hi]-a[lo]; return lo+(d>0?(v-a[lo])/d:0); }
/* the race distance where lap k (1-based) ends: the k-th crossing of the finish line (a finish line close behind the gate makes the opening
   lap a full loop more) */
function lapEnd(C,k){ var f=C.sFin<C.L*0.25?C.sFin+C.L:C.sFin; return f+(k-1)*C.L; }
/* sample a course array at track position s (wraps), linear */
function at(C,arr,s){ var f=((s%C.L)+C.L)%C.L/C.DS, i=Math.floor(f)%C.N, j=(i+1)%C.N, t=f-Math.floor(f); return arr[i]+(arr[j]-arr[i])*t; }

MX.Tracks={builtins:builtins,forRound:forRound,byId:byId,build:build,ground:ground,fh:fh,distAt:distAt,timeAt:timeAt,lapEnd:lapEnd,at:at,SHAPES:SHAPES,JUMPS:JUMPS};
if(typeof module!=="undefined"&&module.exports) module.exports=MX.Tracks;
})(typeof window!=="undefined"?window:globalThis);
