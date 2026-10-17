/* MOTOCROSS WAR 3D — the COURSE: a track layout turned into numbers (pure, no DOM, no three.js). Node: module.exports = MXWar.Course;
   browser: window.MXWar.Course. The 3D view (race3d.js) draws it and rides on it; tests check it in node.
   A LAYOUT (layouts.js) is a description, never a copied map: a closed centre-line (turtle segments: ["S", metres] straight,
   ["L"|"R", radius, degrees] a left / right arc; or spline points [x, z, y]) with a width, the start path from the gate to where it joins the
   loop, and FEATURES placed along the loop in metres from the finish line: whoops (a row of mounds), rhythm (mounds jumped in doubles and
   triples), jump (a face, a lip, a gap or a table, a landing), step (step-up / step-down), sand, rollers, hill (outdoor elevation is in the
   spline's y). Units are metres and seconds; y is up; the heading th runs from +x toward +z, so th growing is a RIGHT turn (seen from above
   with y up, +z is the rider's right when he rides +x).
   build(layout) -> C:
     C.L (lap length), C.n samples every C.ds metres: x z (centre-line), y (base elevation), th (heading), k (curvature, + = right turn),
     hw (half width), bank (berm height at the outside edge), F (feature height on the centre-line), sand (0..1);
     C.ground(s, lat) the dirt's height at loop distance s and lateral offset lat (+ = right); C.air(s) the jump arc {y, dy} or null;
     C.v / C.t the speed profile of a flying lap (m/s) and the time to each sample; C.Tlap;
     the start: C.S (the start path samples, same fields), C.join (loop s where the start path meets the loop), C.gateW, the lap-1 times;
     race distance D (gate = 0): C.atD(D, out) -> {onStart, s, lap} and C.tOfD / C.dOfT (the leader's clock), C.lapStartD(n).
   The speed profile is a lap-time simulation (corner speed from the radius and the berm, accelerate and brake limits, the exact take-off
   speed every jump needs to land where its landing is: ballistic, g = 9.81), so a stadium lap is about 50-60 s, an outdoor lap about 2 min.
   */
(function(g){
"use strict";
var MX=g.MXWar=g.MXWar||{};
if(MX.Course) return;
var PI=Math.PI, TAU=PI*2, G=9.81;
function clamp(x,a,b){ return x<a?a:x>b?b:x; }
function lerp(a,b,t){ return a+(b-a)*t; }
function sstep(a,b,x){ var t=clamp((x-a)/(b-a),0,1); return t*t*(3-2*t); }
function hash(s){ var h=2166136261>>>0; s=String(s||""); for(var i=0;i<s.length;i++){ h^=s.charCodeAt(i); h=Math.imul(h,16777619)>>>0; } return h>>>0; }
function rng(seed){ var t=seed>>>0; return function(){ t=(t+0x6D2B79F5)>>>0; var x=Math.imul(t^(t>>>15),t|1); x^=x+Math.imul(x^(x>>>7),x|61); return ((x^(x>>>14))>>>0)/4294967296; }; }

/* ---------------- a polyline from turtle segments or spline points ---------------- */
function turtle(x,z,th,path,step){
  var P=[[x,z,0]]; step=step||0.25;
  path.forEach(function(sg){
    var t=sg[0];
    if(t==="S"){ var n=Math.max(1,Math.ceil(sg[1]/step)), dx=Math.cos(th), dz=Math.sin(th); for(var i=1;i<=n;i++) P.push([x+dx*sg[1]*i/n,z+dz*sg[1]*i/n,0]); x+=dx*sg[1]; z+=dz*sg[1]; }
    else { var r=sg[1], a=sg[2]*PI/180, sgn=t==="R"?1:-1, cx=x+r*(-Math.sin(th))*sgn, cz=z+r*Math.cos(th)*sgn, n2=Math.max(2,Math.ceil(a*r/step));
      /* the centre is to the right (R) or left (L); the point turns about it */
      var a0=Math.atan2(z-cz,x-cx);
      for(var j=1;j<=n2;j++){ var aa=a0+sgn*a*j/n2; P.push([cx+r*Math.cos(aa),cz+r*Math.sin(aa),0]); }
      x=P[P.length-1][0]; z=P[P.length-1][1]; th+=sgn*a; }
  });
  return {P:P,x:x,z:z,th:th};
}
/* centripetal Catmull-Rom through closed (or open) control points [x, z, y] */
function spline(pts,closed,step){
  var out=[], n=pts.length, segs=closed?n:n-1;
  function pt(i){ if(closed) return pts[(i%n+n)%n]; return pts[clamp(i,0,n-1)]; }
  for(var i=0;i<segs;i++){
    var p0=pt(i-1), p1=pt(i), p2=pt(i+1), p3=pt(i+2);
    var d=Math.hypot(p2[0]-p1[0],p2[1]-p1[1]), m=Math.max(4,Math.ceil(d/(step||0.25)));
    for(var j=(i===0?0:1);j<=m;j++){ out.push(cr(p0,p1,p2,p3,j/m)); }
  }
  if(closed) out.pop();
  return out;
}
function cr(p0,p1,p2,p3,t){
  /* centripetal parameterisation (alpha 0.5): no cusps or loops in tight corners */
  function tj(ti,a,b){ var d=Math.hypot(b[0]-a[0],b[1]-a[1]); return ti+Math.sqrt(Math.max(1e-6,d)); }
  var t0=0, t1=tj(t0,p0,p1), t2=tj(t1,p1,p2), t3=tj(t2,p2,p3), u=lerp(t1,t2,t), r=[];
  for(var k=0;k<3;k++){
    var a0=p0[k]||0, a1=p1[k]||0, a2=p2[k]||0, a3=p3[k]||0;
    var A1=(t1-u)/(t1-t0)*a0+(u-t0)/(t1-t0)*a1, A2=(t2-u)/(t2-t1)*a1+(u-t1)/(t2-t1)*a2, A3=(t3-u)/(t3-t2)*a2+(u-t2)/(t3-t2)*a3;
    var B1=(t2-u)/(t2-t0)*A1+(u-t0)/(t2-t0)*A2, B2=(t3-u)/(t3-t1)*A2+(u-t1)/(t3-t1)*A3;
    r.push((t2-u)/(t2-t1)*B1+(u-t1)/(t2-t1)*B2);
  }
  return r;
}
/* resample a polyline every ds metres (closed: wraps), with the heading and a smoothed curvature */
function resample(P,closed,ds){
  var cum=[0], i;
  for(i=1;i<P.length;i++) cum.push(cum[i-1]+Math.hypot(P[i][0]-P[i-1][0],P[i][1]-P[i-1][1]));
  var Ltot=cum[cum.length-1]+(closed?Math.hypot(P[0][0]-P[P.length-1][0],P[0][1]-P[P.length-1][1]):0);
  var n=Math.max(2,Math.round(Ltot/ds)), dsr=Ltot/n, X=new Float64Array(closed?n:n+1), Z=new Float64Array(X.length), Y=new Float64Array(X.length), j=0;
  var pts=closed?P.concat([P[0]]):P, cc=closed?cum.concat([Ltot]):cum;
  for(i=0;i<X.length;i++){
    var s=i*dsr; while(j<cc.length-2&&cc[j+1]<s) j++;
    var f=(s-cc[j])/Math.max(1e-9,cc[j+1]-cc[j]); f=clamp(f,0,1);
    X[i]=lerp(pts[j][0],pts[j+1][0],f); Z[i]=lerp(pts[j][1],pts[j+1][1],f); Y[i]=lerp(pts[j][2]||0,pts[j+1][2]||0,f);
  }
  var N=X.length, TH=new Float64Array(N), K=new Float64Array(N);
  for(i=0;i<N;i++){
    var a=closed?(i-1+N)%N:Math.max(0,i-1), b=closed?(i+1)%N:Math.min(N-1,i+1);
    TH[i]=Math.atan2(Z[b]-Z[a],X[b]-X[a]);
  }
  /* curvature from the heading change over +-2 m, then smoothed over +-3 m (berms and leans ease in and out) */
  var w=Math.max(1,Math.round(2/dsr));
  for(i=0;i<N;i++){
    var a2=closed?(i-w+N)%N:Math.max(0,i-w), b2=closed?(i+w)%N:Math.min(N-1,i+w), span=(closed?2*w:(b2-a2))*dsr;
    var d=TH[b2]-TH[a2]; while(d>PI) d-=TAU; while(d<-PI) d+=TAU; K[i]=span>0?d/span:0;
  }
  K=smooth(K,Math.max(1,Math.round(3/dsr)),closed);
  return {n:N,ds:dsr,L:closed?Ltot:Ltot,x:X,z:Z,y:Y,th:TH,k:K,closed:closed};
}
function smooth(A,w,closed){
  var N=A.length, out=new Float64Array(N), i, j;
  for(i=0;i<N;i++){ var s=0, c=0; for(j=-w;j<=w;j++){ var k=i+j; if(closed) k=(k%N+N)%N; else if(k<0||k>=N) continue; var wt=1-Math.abs(j)/(w+1); s+=A[k]*wt; c+=wt; } out[i]=s/c; }
  return out;
}

/* ---------------- features: the dirt's shape along the centre-line, and the arcs over it ---------------- */
/* a mound: up face from a to the top, a short flat top, the back down to b; h metres tall */
function mound(F,ds,s0,top0,top1,s1,h,shape){
  for(var s=s0;s<=s1;s+=ds*0.5){
    var y;
    if(s<top0) y=h*Math.pow(sstep(s0,top0,s),shape||1);      /* the face */
    else if(s<=top1) y=h;
    else y=h*sstep(s1,top1,s);                                   /* the back */
    put(F,ds,s,y);
  }
}
function put(F,ds,s,y){ var i=Math.round(s/ds); if(i>=0&&i<F.length&&y>F[i]) F[i]=y; }
/* a face that ends in a lip (a ramp, concave: steeper near the lip) and a landing (a short up face, the peak, a long down ramp) */
function ramp(u){ return 0.3*u+0.7*u*u; }   /* a concave face: about 30-35 degrees at the lip of a 2 m jump with a 6 m face */
function face(F,ds,s0,lip,h){ for(var s=s0;s<=lip;s+=ds*0.5){ var u=(s-s0)/(lip-s0); put(F,ds,s,h*ramp(u)); } for(s=lip;s<=lip+1.6;s+=ds*0.5) put(F,ds,s,h*(1-sstep(lip,lip+1.6,s))); }
function landing(F,ds,up0,peak,s1,h){ for(var s=up0;s<=s1;s+=ds*0.5){ var y=s<peak?h*sstep(up0,peak,s):h*(1-Math.pow((s-peak)/(s1-peak),1.15)); put(F,ds,s,Math.max(0,y)); } }
function table(F,ds,s0,lip,end,s1,h){ for(var s=s0;s<=s1;s+=ds*0.5){ var y; if(s<lip){ var u=(s-s0)/(lip-s0); y=h*ramp(u); } else if(s<=end) y=h; else y=h*(1-Math.pow((s-end)/(s1-end),1.1)); put(F,ds,s,y); } }

function build(layout){
  var Lo=layout, ds=Lo.ds||0.5, i, j;
  /* the loop */
  var raw;
  if(Lo.path){ var tt=turtle(Lo.x0||0,Lo.z0||0,(Lo.th0||0)*PI/180,Lo.path); raw=tt.P; if(Math.hypot(tt.x-raw[0][0],tt.z-raw[0][1])>0.6) throw new Error("layout "+Lo.id+": the loop doesn't close ("+tt.x.toFixed(2)+","+tt.z.toFixed(2)+")"); raw.pop(); }
  else raw=spline(Lo.pts,true,0.25);
  var C=resample(raw,true,ds); ds=C.ds; var N=C.n, L=C.L;
  C.id=Lo.id; C.kind=Lo.kind||"stadium"; C.name=Lo.name||""; C.layout=Lo;
  C.hw=new Float64Array(N); C.bank=new Float64Array(N); C.F=new Float64Array(N); C.sand=new Float64Array(N); C.rough=new Float64Array(N); C.tag=new Array(N);
  var w0=(Lo.width||7.5)/2;
  for(i=0;i<N;i++) C.hw[i]=w0;
  /* smooth the base elevation (outdoor hills) so faces and landings sit on it cleanly */
  if(Lo.pts){ C.y=smooth(C.y,Math.round(6/ds),true); }
  /* berms: the outside edge of every turn tighter than ~26 m is raised (more for a hairpin); a "flat" feature cancels it */
  for(i=0;i<N;i++){ var R=1/Math.max(1e-4,Math.abs(C.k[i])); C.bank[i]=R<26?clamp((26-R)/26*(Lo.berm||1.5),0,Lo.berm||1.5):0; }
  C.bank=smooth(C.bank,Math.round(3/ds),true);
  /* the features */
  C.feats=[]; C.arcs=[]; C.mounds=[];
  var ar=[];   /* arcs: {a: lip s, b: touch s, ya, yb, tan: take-off slope, vx} */
  (Lo.features||[]).map(function(f){ return metres(f,L); }).forEach(function(f){
    var F=C.F, k=f.k;
    if(k==="whoops"){
      var n=f.n||14, sp=(f.to-f.from)/n, h=f.h||1.0;
      for(j=0;j<n;j++){ var c=f.from+sp*(j+0.5); for(var s=c-sp/2;s<=c+sp/2;s+=ds*0.5) put(F,ds,s,h*0.5*(1+Math.cos(TAU*(s-c)/sp))); C.mounds.push({s:c,h:h,w:sp}); }
      C.feats.push({k:"whoops",from:f.from,to:f.to,n:n,h:h,sp:sp,name:f.name||"The whoops"});
      tagRange(C,f.from,f.to,"whoops");
    } else if(k==="rhythm"){
      /* n mounds every sp metres; the combo says how they are jumped: 2 = a double (land on the back of the next), 3 = a triple, 1 = rolled */
      var hm=f.h||1.35, spm=f.sp||5.6, combo=f.combo||[2,3,2], tot=combo.reduce(function(a,b){ return a+b; },0), c0=f.from+2.6, cs=[];
      for(j=0;j<tot;j++){ cs.push(c0+j*spm); face(F,ds,cs[j]-3.0,cs[j]-0.2,hm); for(var sb=cs[j]-0.2;sb<=cs[j]+2.6;sb+=ds*0.5) put(F,ds,sb,hm*(1-sstep(cs[j]-0.2,cs[j]+2.6,sb))); C.mounds.push({s:cs[j],h:hm,w:5.6}); }
      var m=0; combo.forEach(function(cn){ if(cn>=2){ ar.push({a:cs[m]-0.2,b:cs[m+cn-1]+0.9,kind:"rhythm",lt:hm*1.7/2.8}); } m+=cn; });
      C.feats.push({k:"rhythm",from:f.from,to:cs[tot-1]+2.6,n:tot,combo:combo,h:hm,name:f.name||"The rhythm lane"});
      tagRange(C,f.from,cs[tot-1]+2.6,"rhythm");
    } else if(k==="jump"){
      /* face from s0 to the lip (h), landing: up face from up0 to the peak (hl), the down ramp to s1; a table fills the gap */
      var hL=f.h||2.0, hl=f.hl!=null?f.hl:hL*1.05;
      var lt=hL*1.7/Math.max(1,f.lip-f.s0);   /* the face's slope at the lip (ramp'(1) = 1.7) */
      if(f.table){ table(F,ds,f.s0,f.lip,f.end,f.s1,hL); ar.push({a:f.lip,b:f.touch||(f.end+(f.s1-f.end)*0.3),kind:"table",lt:lt}); }
      else { face(F,ds,f.s0,f.lip,hL); if(f.mid) mound(F,ds,f.lip+2.2,f.lip+3.6,f.peak-3.6,f.peak-2.2,f.mid,1); landing(F,ds,f.peak-(f.up||2.4),f.peak,f.s1,hl); ar.push({a:f.lip,b:f.touch||(f.peak+1.4),kind:f.mid?"triple":"double",lt:lt}); }
      C.feats.push({k:"jump",from:f.s0,to:f.s1,lip:f.lip,h:hL,table:!!f.table,big:!!f.big,name:f.name||(f.table?"The tabletop":f.mid?"The triple":"The double")});
      tagRange(C,f.s0,f.s1,f.big?"bigjump":"jump");
    } else if(k==="step"){
      /* a step-up: a small face, the jump up onto a high top (h2), the top, then (down) a drop off its far edge to a landing */
      var h1=f.h1||1.1, h2=f.h2||2.1;
      face(F,ds,f.s0,f.lip,h1);
      for(var s2=f.top0-1.6;s2<=f.top1;s2+=ds*0.5) put(F,ds,s2,s2<f.top0?h2*sstep(f.top0-1.6,f.top0,s2):h2);
      for(s2=f.top1;s2<=f.s1;s2+=ds*0.5){ var u2=(s2-f.top1)/(f.s1-f.top1); put(F,ds,s2,Math.max(0,h2*(1-sstep(0,1,u2)*1.0)-0.0)); }
      ar.push({a:f.lip,b:f.top0+1.2,kind:"stepup",lt:h1*1.7/Math.max(1,f.lip-f.s0)});
      if(f.drop) ar.push({a:f.top1-0.2,b:f.top1+(f.s1-f.top1)*0.55,kind:"drop"});
      C.feats.push({k:"step",from:f.s0,to:f.s1,lip:f.lip,h:h2,name:f.name||"The step-up"});
      tagRange(C,f.s0,f.s1,"jump");
    } else if(k==="rollers"){
      var nr=f.n||5, spr=(f.to-f.from)/nr, hr=f.h||0.8;
      for(j=0;j<nr;j++){ var cc=f.from+spr*(j+0.5); for(var s3=cc-spr/2;s3<=cc+spr/2;s3+=ds*0.5) put(F,ds,s3,hr*0.5*(1+Math.cos(TAU*(s3-cc)/spr))); }
      C.feats.push({k:"rollers",from:f.from,to:f.to,n:nr,h:hr,sp:spr,name:f.name||"The rollers"}); tagRange(C,f.from,f.to,"rollers");
    } else if(k==="sand"){
      for(var s4=f.from-4;s4<=f.to+4;s4+=ds){ var ii=Math.round(s4/ds); if(ii>=0&&ii<N) C.sand[ii]=Math.max(C.sand[ii],sstep(f.from-4,f.from+2,s4)*(1-sstep(f.to-2,f.to+4,s4))); }
      C.feats.push({k:"sand",from:f.from,to:f.to,name:f.name||"The sand"}); tagRange(C,f.from,f.to,"sand");
    } else if(k==="flat"){
      for(var s5=f.from;s5<=f.to;s5+=ds){ var i5=Math.round(s5/ds); if(i5>=0&&i5<N) C.bank[i5]*=f.keep||0; }
    } else if(k==="width"){
      for(var s6=f.from-6;s6<=f.to+6;s6+=ds){ var i6=Math.round(s6/ds); if(i6>=0&&i6<N) C.hw[i6]=Math.max(C.hw[i6],lerp(w0,f.w/2,sstep(f.from-6,f.from,s6)*(1-sstep(f.to,f.to+6,s6)))); }
    } else if(k==="rough"){
      for(var s7=f.from;s7<=f.to;s7+=ds){ var i7=Math.round(s7/ds); if(i7>=0&&i7<N) C.rough[i7]=f.r||1; }
    }
  });
  C.feats.sort(function(a,b){ return a.from-b.from; });
  /* soften the dirt profile a touch so no face has a kink (keeps lips and peaks crisp: a 1-sample blur) */
  /* the arcs: take-off slope from the face just before the lip, ballistic flight to the touch point */
  ar.forEach(function(A){
    var ia=Math.round(A.a/ds), ib=Math.round(A.b/ds);
    A.ya=C.F[ia]+C.y[ia]; A.yb=C.F[ib]+C.y[ib];
    var i0=Math.max(0,ia-Math.round(2/ds)), slope=(A.lt!=null?A.lt:0)+(C.y[ia]-C.y[i0])/((ia-i0)*ds||1);   /* + the hill's own slope */
    A.tan=clamp(slope,0.2,A.kind==="rhythm"?0.45:A.kind==="stepup"?0.8:(C.kind==="outdoor"&&Lo.shared?0.5:0.72)); if(A.kind==="drop") A.tan=0.08+(C.y[ia]-C.y[i0])/((ia-i0)*ds||1);
    var d=A.b-A.a, den=d*A.tan-(A.yb-A.ya);
    if(den<0.05){ A.tan=(A.yb-A.ya)/d+0.35; den=d*A.tan-(A.yb-A.ya); }
    A.vx=Math.sqrt(G*d*d/(2*den));
    A.peak=A.ya+A.vx*A.vx*A.tan*A.tan/(2*G);
    A.land=A.tan-G*d/(A.vx*A.vx);   /* the arc's slope at the touch */
    C.arcs.push(A);
  });
  C.arcs.sort(function(a,b){ return a.a-b.a; });
  C.L=L; C.ds=ds; C.N=N;
  /* the finish line is s = 0 (the layout starts the loop there); the flagger stands on the side given (or the inside) */
  C.finSide=Lo.finSide||-1;
  speedProfile(C,Lo);
  startPath(C,Lo);
  cameraSpots(C);
  return C;
}
function tagRange(C,a,b,t){ for(var s=a;s<=b;s+=C.ds){ var i=Math.round(s/C.ds); if(i>=0&&i<C.N&&!C.tag[i]) C.tag[i]=t; } }
/* a feature given by lap fraction (f = where it starts, f0..f1 = a range) and relative sizes (face, gap, top, down) -> metres */
function metres(f,L){
  var o={}, k; for(k in f) o[k]=f[k];
  if(o.f0!=null){ o.from=o.f0*L; o.to=(o.f1!=null?o.f1:o.f0)*L; }
  if(o.f!=null){
    var s0=o.f*L;
    if(o.k==="jump"){ o.s0=s0; o.lip=s0+(o.face||5); if(o.table){ o.end=o.lip+(o.top||10); o.s1=o.end+(o.down||7); } else { o.peak=o.lip+(o.gap||14); o.touch=o.peak+1.4; o.s1=o.peak+(o.down||8); } }
    else if(o.k==="step"){ o.s0=s0; o.lip=s0+(o.face||4); o.top0=o.lip+3.5; o.top1=o.top0+(o.top||8); o.s1=o.top1+(o.down||7); o.drop=true; }
    else o.from=s0;
  }
  return o;
}

/* ---------------- lookups on the loop ---------------- */
function wrap(C,s){ var L=C.L; s%=L; return s<0?s+L:s; }
function idx(C,s){ var f=wrap(C,s)/C.ds, i=Math.floor(f); return {i:i%C.N,j:(i+1)%C.N,f:f-i}; }
function sample(C,A,s){ var q=idx(C,s); return A[q.i]+(A[q.j]-A[q.i])*q.f; }
/* the arc over s, if s is in the air: {y, dy (slope), A} */
function airAt(C,s){
  s=wrap(C,s);
  for(var k=0;k<C.arcs.length;k++){ var A=C.arcs[k]; if(s>=A.a&&s<=A.b){ var x=s-A.a; return {y:A.ya+x*A.tan-G*x*x/(2*A.vx*A.vx),dy:A.tan-G*x/(A.vx*A.vx),A:A,u:x/(A.b-A.a)}; } }
  return null;
}
/* the dirt's height at (s, lateral offset): base + feature + the berm on the outside of a turn (lat + = right) */
function ground(C,s,lat){
  var q=idx(C,s), i=q.i, j=q.j, f=q.f;
  var y=C.y[i]+(C.y[j]-C.y[i])*f, F=C.F[i]+(C.F[j]-C.F[i])*f, k=C.k[i], hw=C.hw[i], b=C.bank[i]+(C.bank[j]-C.bank[i])*f;
  var out=k>0?-lat:lat;   /* a right turn (k > 0) raises the left side (the outside) */
  var bm=b>0?b*Math.pow(sstep(-0.1*hw,1.15*hw,out),1.6):0;
  /* the features fade toward the edges a little (rounded shoulders), so a jump isn't a box */
  var edge=1-0.25*sstep(0.75*hw,1.25*hw,Math.abs(lat));
  return y+F*edge+bm;
}
function frame(C,s,o){
  var q=idx(C,s), i=q.i, j=q.j, f=q.f; o=o||{};
  o.x=C.x[i]+(C.x[j]-C.x[i])*f; o.z=C.z[i]+(C.z[j]-C.z[i])*f;
  var a=C.th[i], b=C.th[j], d=b-a; while(d>PI) d-=TAU; while(d<-PI) d+=TAU; o.th=a+d*f;
  o.k=C.k[i]+(C.k[j]-C.k[i])*f; o.hw=C.hw[i]; o.sand=C.sand[i]; o.tag=C.tag[i]||""; o.y=C.y[i]+(C.y[j]-C.y[i])*f;
  return o;
}

/* ---------------- the speed profile (a lap-time simulation) ---------------- */
function accel(v,sand,f){ return Math.max(1.0,(6.2-0.19*v)*(1-0.35*sand)*(f||1)); }
var BRAKE=7.2;
function grade(C,i){ var N=C.N, a=(i-2+N)%N, b=(i+2)%N; return (C.y[b]-C.y[a])/(4*C.ds); }   /* the hill's slope (rise over run) */
function vLimit(C,i,Lo){
  var R=Math.max(Lo.minR||5,1/Math.max(1e-4,Math.abs(C.k[i]))), b=Math.max(0,C.bank[i])/(Lo.berm||1.5), alat=(3.4+4.8*b)*(Lo.grip||1)*(C.sc||1), top=(Lo.vtop||(C.kind==="outdoor"?23:18))*(1-0.22*C.sand[i])*Math.min(1.12,C.sc||1);
  var v=Math.min(top,Math.sqrt(alat*R));
  var t=C.tag[i];
  if(t==="whoops") v=Math.min(v,Lo.vwhoops||14.5);
  if(t==="rollers") v=Math.min(v,18);
  return Math.max(4.5,v);
}
function speedProfile(C,Lo){
  /* a researched layout gives its length: its lap time follows from it at a real average speed (the CEO, 21:10: "from the track's length
     where the layout gives it"): the profile is scaled until the lap is length / average speed (stadium about 36 km/h, outdoors about 56) */
  C.sc=1; speedPass(C,Lo);
  if(Lo.vavg){ for(var it=0;it<6;it++){ var want=C.L/Lo.vavg, f=C.Tlap/want; if(Math.abs(f-1)<0.015) break; C.sc*=Math.pow(f,0.9); speedPass(C,Lo); } }
}
function speedPass(C,Lo){
  var N=C.N, ds=C.ds, vmax=new Float64Array(N), fix=new Float64Array(N), i, k;
  for(i=0;i<N;i++){ vmax[i]=vLimit(C,i,Lo); fix[i]=0; }
  /* every arc sets its own speed: horizontal speed vx in the air, and vx at the lip */
  C.arcs.forEach(function(A){ var ia=Math.round(A.a/ds), ib=Math.round(A.b/ds); for(var q=ia;q<=ib;q++){ fix[q%N]=A.vx; } });
  var v=new Float64Array(N);
  for(i=0;i<N;i++) v[i]=fix[i]||vmax[i];
  /* forward (accelerate) and backward (brake) passes, around the loop three times so the lap is periodic */
  for(k=0;k<3;k++){
    for(i=1;i<=N;i++){ var a=i-1, b=i%N; var lim=fix[b]||vmax[b]; var ac=Math.max(0.4,accel(v[a],C.sand[a],(Lo.acc||1)*(C.sc||1))-G*0.85*grade(C,a)); var acc=Math.sqrt(Math.max(0,v[a]*v[a]+2*ac*ds)); v[b]=fix[b]?fix[b]:Math.min(lim,acc); }
    for(i=N-1;i>=0;i--){ var b2=(i+1)%N; var lim2=fix[i]||vmax[i]; var br=Math.max(3,BRAKE+G*0.8*grade(C,i)); var dec=Math.sqrt(v[b2]*v[b2]+2*br*ds); v[i]=fix[i]?fix[i]:Math.min(lim2,dec,v[i]); }
  }
  C.v=v; C.vmax=vmax; C.fix=fix;
  var t=new Float64Array(N+1); t[0]=0;
  for(i=0;i<N;i++){ var j=(i+1)%N; t[i+1]=t[i]+ds/Math.max(0.5,(v[i]+v[j])/2); }
  C.t=t; C.Tlap=t[N];
}
/* time from the finish line to loop distance s on a flying lap, and its inverse */
function tAt(C,s){ s=wrap(C,s); var f=s/C.ds, i=Math.floor(f); if(i>=C.N) return C.Tlap; return C.t[i]+(C.t[i+1]-C.t[i])*(f-i); }
function sAt(C,t){ t=((t%C.Tlap)+C.Tlap)%C.Tlap; var T=C.t, lo=0, hi=C.N; while(hi-lo>1){ var m=(lo+hi)>>1; if(T[m]<=t) lo=m; else hi=m; } return (lo+(t-T[lo])/Math.max(1e-9,T[lo+1]-T[lo]))*C.ds; }
function vAt(C,s){ return sample(C,C.v,s); }

/* ---------------- the start: from the gate to where it joins the loop ---------------- */
function startPath(C,Lo){
  var S=Lo.start, P=null, o={};
  if(!S){ S={join:Lo.gateS||0,gateW:Lo.gateW||(C.kind==="stadium"?17:36),gateAt:0}; }
  if(S.path){ var tt=turtle(S.x0,S.z0,(S.th0||0)*PI/180,S.path); P=tt.P; }
  else if(S.pts){
    /* a spline start that MERGES into the loop: its last point is the loop's point at joinF, the one before it 18 m back along the loop's
       heading (so it joins tangentially) */
    var js=(S.joinF||0)*C.L; frame(C,js,o);
    var pts=S.pts.slice(0,-1).concat([[o.x-Math.cos(o.th)*18,o.z-Math.sin(o.th)*18,o.y],[o.x,o.z,o.y]]);
    P=spline(pts,false,0.25); S.join=js;
  }
  var St={n:0,L:0};
  if(P){
    St=resample(P,false,C.ds);
    St.L=(St.n-1)*St.ds;
    /* the start's width: the gate's width at the gate, easing to the loop's width by the first turn */
    var gw=S.gateW||24, nw=St.n; St.hw=new Float64Array(nw);
    for(var i=0;i<nw;i++){ var s=i*St.ds; St.hw[i]=lerp(gw/2,(Lo.width||7.5)/2,sstep(S.narrow0||10,S.narrow1||(St.L*0.75),s)); }
  } else if(Lo.startLen){
    /* the gate on the loop (the shared format): the start straight is the loop itself, widened for the gate */
    var g0=S.join||0;
    for(var s2=g0-6;s2<=g0+Lo.startLen+6;s2+=C.ds){ var i2=Math.round(wrap(C,s2)/C.ds)%C.N; C.hw[i2]=Math.max(C.hw[i2],lerp((S.gateW||24)/2,C.hw[i2],sstep(g0+8,g0+Lo.startLen,s2))); }
  }
  C.S=St; C.join=S.join||0; C.gateW=S.gateW||24; C.gateAt=S.gateAt!=null?S.gateAt:2;   /* the gate stands gateAt metres along the start */
  C.startLen=St.n?0:(Lo.startLen||0); C.hsD=St.n?(St.n-1)*C.ds+(Lo.startHs||0):Math.max(40,C.startLen||80);   /* the run to turn 1 (the holeshot) ends here */
  var join=C.join, m=St.n?St.n-1:0;
  C.Ls=m*C.ds; C.m1=m;
  /* lap 1 = the start path, then the loop from join to the finish line; with the gate ON the loop just before the line, the first crossing
     doesn't count (the race starts behind the line): lap 1 runs on round to the line once more */
  var d0=wrap(C,-join); if(!St.n&&d0<0.35*C.L) d0+=C.L;
  var nl=Math.round(d0/C.ds), tot=m+nl, v=new Float64Array(tot+1), vm=new Float64Array(tot+1), fx=new Float64Array(tot+1), k, ji=Math.round(join/C.ds);
  for(k=0;k<=tot;k++){
    if(k<m){ var R=1/Math.max(1e-4,Math.abs(St.k[k])); vm[k]=Math.min(Lo.vtop||(C.kind==="outdoor"?23:18),Math.sqrt((4.0+4)*R)); fx[k]=0; }
    else { var li=((ji+(k-m))%C.N+C.N)%C.N; vm[k]=C.vmax[li]; fx[k]=C.fix[li]; }
  }
  v[0]=0;
  for(k=1;k<=tot;k++){ var a=k-1; var acc=Math.sqrt(v[a]*v[a]+2*accel(v[a],0,Lo.acc)*C.ds*(a<m?1.15:1)); v[k]=fx[k]?fx[k]:Math.min(vm[k],acc); }
  for(k=tot-1;k>=1;k--){ var dec=Math.sqrt(v[k+1]*v[k+1]+2*BRAKE*C.ds); v[k]=fx[k]?fx[k]:Math.min(v[k],dec,vm[k]); }
  /* the end of lap 1 meets the flying lap at the line */
  v[tot]=C.v[0];
  var t=new Float64Array(tot+1); t[0]=0;
  for(k=0;k<tot;k++) t[k+1]=t[k]+C.ds/Math.max(0.6,(v[k]+v[k+1])/2);
  C.v1=v; C.t1=t; C.n1=St.n; C.D1=tot*C.ds; C.T1=t[tot];
}
/* race distance D (the gate = 0; lap 1 ends at D1, then every lap is L) -> where the rider is */
function atD(C,D,o){
  o=o||{};
  if(D<0) D=0;
  if(D<C.D1){
    o.lap=1;
    if(C.S.n&&D<C.Ls){ o.onStart=true; o.d=D; o.s=-1; return o; }
    o.onStart=false; o.s=wrap(C,C.join+(D-C.Ls)); o.d=D; return o;
  }
  var x=D-C.D1, n=Math.floor(x/C.L); o.lap=2+n; o.onStart=false; o.s=x-n*C.L; o.d=D; return o;
}
/* the speed at race distance D on the leader's schedule (lap 1 from the standing start) */
function vOfD(C,D){
  if(D<C.D1){ var f=Math.max(0,D)/C.ds, i=Math.floor(f), j=Math.min(i+1,C.v1.length-1); return C.v1[i]+(C.v1[j]-C.v1[i])*(f-i); }
  var x=D-C.D1, n=Math.floor(x/C.L); return vAt(C,x-n*C.L);
}
/* the leader's clock: time since the gate drop at race distance D, and the inverse */
function tOfD(C,D){
  if(D<=0) return 0;
  if(D<C.D1){ var f=D/C.ds, i=Math.floor(f); return C.t1[i]+(C.t1[Math.min(i+1,C.t1.length-1)]-C.t1[i])*(f-i); }
  var x=D-C.D1, n=Math.floor(x/C.L); return C.T1+n*C.Tlap+tAt(C,x-n*C.L);
}
function dOfT(C,T){
  if(T<=0) return 0;
  if(T<C.T1){ var A=C.t1, lo=0, hi=A.length-1; while(hi-lo>1){ var m=(lo+hi)>>1; if(A[m]<=T) lo=m; else hi=m; } return (lo+(T-A[lo])/Math.max(1e-9,A[lo+1]-A[lo]))*C.ds; }
  var x=T-C.T1, n=Math.floor(x/C.Tlap); return C.D1+n*C.L+sAt(C,x-n*C.Tlap);
}
/* lap n (1-based) starts at race distance: 0 for lap 1 (the gate), D1 + (n - 2) L after */
function lapStartD(C,n){ return n<=1?0:C.D1+(n-2)*C.L; }
/* the race distance in lap n where the loop distance is s (null if lap 1 doesn't pass there) */
function dInLap(C,n,s){
  s=wrap(C,s);
  if(n<=1){ var d=C.Ls+wrap(C,s-C.join); return d<=C.D1?d:null; }
  return C.D1+(n-2)*C.L+s;
}
/* the start path's point at distance d */
function startFrame(C,d,o){
  var S=C.S; o=o||{}; var f=clamp(d/S.ds,0,S.n-1), i=Math.floor(f), j=Math.min(S.n-1,i+1); f-=i;
  o.x=S.x[i]+(S.x[j]-S.x[i])*f; o.z=S.z[i]+(S.z[j]-S.z[i])*f; o.y=S.y[i]+(S.y[j]-S.y[i])*f;
  var a=S.th[i], b=S.th[j], dd=b-a; while(dd>PI) dd-=TAU; while(dd<-PI) dd+=TAU; o.th=a+dd*f; o.k=S.k[i]; o.hw=S.hw[i]; o.sand=0; o.tag="start";
  return o;
}

/* ---------------- camera spots: where a TV camera stands for each section (the side with room, off the track) ---------------- */
function nearest(C,x,z,skipS,skipW){
  var best=1e9, i, st=Math.max(1,Math.round(2/C.ds));
  for(i=0;i<C.N;i+=st){ var s=i*C.ds; if(skipS!=null){ var dd=Math.abs(s-skipS); dd=Math.min(dd,C.L-dd); if(dd<skipW) continue; } var d=Math.hypot(C.x[i]-x,C.z[i]-z)-C.hw[i]; if(d<best) best=d; }
  if(C.S&&C.S.n){ for(i=0;i<C.S.n;i+=st){ var d2=Math.hypot(C.S.x[i]-x,C.S.z[i]-z)-C.S.hw[i]; if(d2<best) best=d2; } }
  return best;
}
function cameraSpots(C){
  var spots=[], o={};
  C.feats.forEach(function(f){
    var mid=(f.from+f.to)/2; frame(C,mid,o);
    var best=null;
    [1,-1].forEach(function(side){
      for(var dist=9;dist<=22;dist+=3.5){
        var nx=-Math.sin(o.th)*side, nz=Math.cos(o.th)*side, x=o.x+nx*(o.hw+dist), z=o.z+nz*(o.hw+dist);
        var room=nearest(C,x,z,mid,(f.to-f.from)/2+25);
        var sc=Math.min(room,8)+(side===C.finSide?0:0.5)-dist*0.08;
        if(room>1.2&&(!best||sc>best.sc)) best={x:x,z:z,side:side,dist:dist,sc:sc};
      }
    });
    if(best) spots.push({k:f.k,name:f.name,from:f.from,to:f.to,mid:mid,x:best.x,z:best.z,side:best.side,y:o.y,big:f.big});
  });
  C.spots=spots;
}

/* ---------------- the pack: gaps (seconds behind the leader's clock) from the running order and the cards ---------------- */
/* order = seats by place (riders still in); cnt = cards held. The gap to the rider ahead grows with the card gap; the whole field is
   scaled to stay inside a fraction of the lap (no lapping in a race of cards). */
function gaps(order,cnt,lapT,o){
  o=o||{};
  var base=o.base!=null?o.base:0.48, extra=o.extra!=null?o.extra:1.5, g={}, acc=0, prev=null;
  order.forEach(function(s,i){
    if(i===0){ g[s]=0; prev=s; return; }
    var d=Math.max(0,(cnt[prev]||0)-(cnt[s]||0));
    acc+=base+extra*Math.min(1,d/24)+(o.jit?((s*7919)%13)/13*0.12:0);
    g[s]=acc; prev=s;
  });
  var lim=(o.frac||0.42)*lapT;
  if(acc>lim){ var sc=lim/acc; for(var k in g) g[k]*=sc; }
  return g;
}

MX.Course={build:build,ground:ground,frame:frame,airAt:airAt,wrap:wrap,sample:sample,tAt:tAt,sAt:sAt,vAt:vAt,vOfD:vOfD,atD:atD,tOfD:tOfD,dOfT:dOfT,
  lapStartD:lapStartD,dInLap:dInLap,startFrame:startFrame,gaps:gaps,hash:hash,rng:rng,turtle:turtle,spline:spline,G:G};
if(typeof module!=="undefined"&&module.exports) module.exports=MX.Course;
})(typeof window!=="undefined"?window:globalThis);
