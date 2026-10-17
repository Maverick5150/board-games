/* MOTOCROSS WAR 3D — THE RIDER MODEL (owner: rider): the rider's body as ONE SKINNED MESH built in code (original art: no logos, no sponsor marks,
   no real liveries; the team is the colour). A 17-bone skeleton (pelvis, lumbar, chest, neck, head, shoulders / elbows / wrists, hips / knees /
   ankles), the rest pose, and the mesh: a baggy jersey with a chest protector and a neck brace, sleeves, gloves, pants with knee braces, tall boots with
   buckles, a helmet with a peak, a chin bar, goggles and a strap, and a number patch curved over the jersey's back. Every vertex carries two bones and
   their weights (linear blend skinning), a colour, a COLOUR SLOT (0 = the team colour, 1 = the accent colour, 2 = fixed), and a cloth-flutter amount.
   buildRider(detail) -> {body, helmet, back}; detail 1 = near (about 3,000 triangles, the helmet is its own mesh: glossy), detail 0 = far pack (about
   650 triangles, the helmet is part of the body mesh). Rest pose: standing, facing +X, +Y up, +Z right, the pelvis joint at the origin; the rest rotation of
   every bone is the identity (REST[b] is the bone's joint). Pure geometry: no rendering, no DOM. */
import * as THREE_NS from "../ui/vendor/three-0.160.0.module.min.js";
import {lin} from "./r3d-util.js";
const THREE=THREE_NS;

/* ---------------- the skeleton ---------------- */
export const BN={PELVIS:0,SPINE:1,CHEST:2,NECK:3,HEAD:4,UAL:5,FAL:6,HAL:7,UAR:8,FAR:9,HAR:10,THL:11,SHL:12,FTL:13,THR:14,SHR:15,FTR:16};
export const NB=17;
export const NAMES=["pelvis","spine","chest","neck","head","uarmL","farmL","handL","uarmR","farmR","handR","thighL","shinL","footL","thighR","shinR","footR"];
/* each bone's joint in the rest pose (m; x forward, y up, z right; the pelvis joint = the origin) */
export const REST=[[0,0,0],[0,0.10,0],[0,0.26,0],[0.008,0.53,0],[0.012,0.61,0],
  [0,0.49,-0.215],[0,0.20,-0.215],[0,-0.07,-0.215],[0,0.49,0.215],[0,0.20,0.215],[0,-0.07,0.215],
  [0,-0.03,-0.095],[0,-0.46,-0.095],[0,-0.91,-0.095],[0,-0.03,0.095],[0,-0.46,0.095],[0,-0.91,0.095]];
/* bone lengths (m) */
export const LEN={UA:0.29,FA:0.27,HAND:0.075,TH:0.43,SH:0.45};

/* ---------------- a tiny indexed-geometry builder ---------------- */
function GB(){ this.P=[]; this.C=[]; this.K=[]; this.F=[]; this.I=[]; this.n=0; }
GB.prototype.vert=function(p,col,sk,fx){ this.P.push(p[0],p[1],p[2]); this.C.push(col[0],col[1],col[2]); this.K.push(sk[0],sk[1],sk[2],sk[3]); this.F.push(fx[0],fx[1],fx[2]); return this.n++; };
GB.prototype.geometry=function(){
  const n=this.n, P=new Float32Array(this.P), N=new Float32Array(n*3), I=this.I;
  for(let t=0;t<I.length;t+=3){ const a=I[t]*3, b=I[t+1]*3, c=I[t+2]*3;
    const ux=P[b]-P[a], uy=P[b+1]-P[a+1], uz=P[b+2]-P[a+2], vx=P[c]-P[a], vy=P[c+1]-P[a+1], vz=P[c+2]-P[a+2];
    const nx=uy*vz-uz*vy, ny=uz*vx-ux*vz, nz=ux*vy-uy*vx;
    N[a]+=nx; N[a+1]+=ny; N[a+2]+=nz; N[b]+=nx; N[b+1]+=ny; N[b+2]+=nz; N[c]+=nx; N[c+1]+=ny; N[c+2]+=nz; }
  for(let i=0;i<n;i++){ const l=Math.hypot(N[i*3],N[i*3+1],N[i*3+2])||1; N[i*3]/=l; N[i*3+1]/=l; N[i*3+2]/=l; }
  const g=new THREE.BufferGeometry();
  g.setAttribute("position",new THREE.BufferAttribute(P,3)); g.setAttribute("normal",new THREE.BufferAttribute(N,3));
  g.setAttribute("color",new THREE.BufferAttribute(new Float32Array(this.C),3));
  g.setAttribute("aSkin",new THREE.BufferAttribute(new Float32Array(this.K),4));   /* bone 0, bone 1, weight 0, weight 1 */
  g.setAttribute("aFx",new THREE.BufferAttribute(new Float32Array(this.F),3));     /* colour slot (0 team, 1 accent, 2 fixed), cloth flutter, mud weight */
  g.setIndex(new THREE.BufferAttribute(n>65000?new Uint32Array(I):new Uint16Array(I),1));
  g.computeBoundingSphere(); return g;
};
const X=[1,0,0], Y=[0,1,0], Z=[0,0,1];
const sstp=(a,b,x)=>{ const t=Math.max(0,Math.min(1,(x-a)/(b-a))); return t*t*(3-2*t); };
const mixv=(a,b,t)=>[a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t,a[2]+(b[2]-a[2])*t];
/* a ring (an ellipse in the plane spanned by u and v, centre c, radii ru and rv, a superellipse of exponent n) and how its vertices are coloured / skinned:
   col (rgb or f(a) -> rgb), slot (0 | 1 | 2 or f(a)), bones [b0, b1, t] (the weight of b1), flap (cloth flutter 0..1), mud, k(a) (radial multiplier), fold (wrinkle amplitude) */
function ring(c,ru,rv,o){ const r={c:c,u:X,v:Z,ru:ru,rv:rv,n:2,col:[1,1,1],slot:0,bones:[0,0,0],flap:0,mud:0,fold:0,k:null}; return Object.assign(r,o||{}); }
/* loft between consecutive rings (a surface of seg vertices a ring); caps: "t" closes the last ring, "b" the first (flat, own vertices) */
function loft(g,rings,seg,caps){
  const base=g.n, rows=rings.length, first=g.I.length, rv=[];
  for(let j=0;j<rows;j++){ const r=rings[j];
    for(let k=0;k<seg;k++){ const a=k/seg*Math.PI*2, ca=Math.cos(a), sa=Math.sin(a);
      let cx=ca, sz=sa; if(r.n!==2){ const e=2/r.n; cx=Math.sign(ca)*Math.pow(Math.abs(ca),e); sz=Math.sign(sa)*Math.pow(Math.abs(sa),e); }
      let m=r.k?r.k(a):1; if(r.fold){ const y=r.c[1]+r.c[0]*3; m*=1+r.fold*(0.6*Math.sin(5*a+9*y)+0.4*Math.sin(11*a-17*y+1.3)); }
      const px=r.c[0]+(r.u[0]*r.ru*cx+r.v[0]*r.rv*sz)*m, py=r.c[1]+(r.u[1]*r.ru*cx+r.v[1]*r.rv*sz)*m, pz=r.c[2]+(r.u[2]*r.ru*cx+r.v[2]*r.rv*sz)*m;
      const col=typeof r.col==="function"?r.col(a):r.col, slot=typeof r.slot==="function"?r.slot(a):r.slot, b=r.bones;
      g.vert([px,py,pz],col,[b[0],b[1],1-b[2],b[2]],[slot,r.flap,typeof r.mud==="function"?r.mud(a):r.mud]); } }
  const T=[];
  for(let j=0;j<rows-1;j++) for(let k=0;k<seg;k++){ const a=base+j*seg+k, b=base+j*seg+(k+1)%seg, c=base+(j+1)*seg+k, d=base+(j+1)*seg+(k+1)%seg; T.push(a,c,b,b,c,d); }
  /* orient: the faces must point away from the loft's axis (the rings' centres) */
  let s=0; const P=g.P;
  for(let t=0;t<T.length;t+=3){ const a=T[t]*3, b=T[t+1]*3, c=T[t+2]*3, row=Math.floor((T[t]-base)/seg), rc=rings[Math.min(rows-1,row)].c;
    const ux=P[b]-P[a], uy=P[b+1]-P[a+1], uz=P[b+2]-P[a+2], vx=P[c]-P[a], vy=P[c+1]-P[a+1], vz=P[c+2]-P[a+2];
    const nx=uy*vz-uz*vy, ny=uz*vx-ux*vz, nz=ux*vy-uy*vx, mx=(P[a]+P[b]+P[c])/3-rc[0], my=(P[a+1]+P[b+1]+P[c+1])/3-rc[1], mz=(P[a+2]+P[b+2]+P[c+2])/3-rc[2];
    s+=nx*mx+ny*my+nz*mz; }
  const flip=s<0;
  for(let t=0;t<T.length;t+=3){ if(flip) g.I.push(T[t],T[t+2],T[t+1]); else g.I.push(T[t],T[t+1],T[t+2]); }
  /* caps: a flat fan on a copy of the end ring, wound to face along the axis away from the loft */
  const cap=(j,top)=>{ const r=rings[j], mud0=typeof r.mud==="function"?r.mud(0):r.mud, cb=g.n, col0=typeof r.col==="function"?r.col(0):r.col, slot0=typeof r.slot==="function"?r.slot(0):r.slot, b=r.bones;
    for(let k=0;k<seg;k++){ const o=(base+j*seg+k)*3; g.vert([P[o],P[o+1],P[o+2]],col0,[b[0],b[1],1-b[2],b[2]],[slot0,0,mud0]); }
    const ci=g.vert(r.c,col0,[b[0],b[1],1-b[2],b[2]],[slot0,0,mud0]);
    /* the outward direction of the cap: from the neighbouring ring's centre to this one */
    const nb=rings[top?j-1:j+1]||r, dx=r.c[0]-nb.c[0], dy=r.c[1]-nb.c[1], dz=r.c[2]-nb.c[2];
    let sg=0; { const a=cb*3, b2=(cb+1)*3, c2=ci*3, ux=P[b2]-P[a], uy=P[b2+1]-P[a+1], uz=P[b2+2]-P[a+2], vx=P[c2]-P[a], vy=P[c2+1]-P[a+1], vz=P[c2+2]-P[a+2];
      sg=(uy*vz-uz*vy)*dx+(uz*vx-ux*vz)*dy+(ux*vy-uy*vx)*dz; }
    for(let k=0;k<seg;k++){ const a=cb+k, b3=cb+(k+1)%seg; if(sg>=0) g.I.push(a,b3,ci); else g.I.push(a,ci,b3); } };
  if(caps){ if(caps.indexOf("b")>=0) cap(0,false); if(caps.indexOf("t")>=0) cap(rows-1,true); }
  return base;
}
const thin=(a,on)=>on?a.filter((x,i)=>i===0||i===a.length-1||i%2===0):a;

/* ---------------- the colours (linear) ---------------- */
const COL={white:lin("#dfe2e8"),boot:lin("#e6e8ee"),dark:lin("#15161b"),mid:lin("#2a2c33"),glove:lin("#1a1b20"),strap:lin("#e9eaee"),sole:lin("#101114"),metal:lin("#8a8e98"),lens:lin("#27324a")};
const K1=[1,1,1];
/* bones along y: the weights blend between the stops (a stop = a bone's joint height, so a ring between two joints is shared by both) */
function skinY(y,stops){ if(y>=stops[0][0]) return [stops[0][1],stops[0][1],0]; for(let i=1;i<stops.length;i++){ if(y>=stops[i][0]){ const a=stops[i-1], b=stops[i], t=(a[0]-y)/(a[0]-b[0]); return [a[1],b[1],t]; } } const l=stops[stops.length-1]; return [l[1],l[1],0]; }
const SK_TORSO=[[0.62,BN.NECK],[0.50,BN.CHEST],[0.26,BN.CHEST],[0.10,BN.SPINE],[0.0,BN.PELVIS]];
/* the jersey's surface at height y (the back number is laid on it) */
const TORSO=[[-0.050,0.000,0.150,0.190],[0.020,0.000,0.138,0.178],[0.100,0.002,0.128,0.165],[0.190,0.008,0.136,0.176],[0.280,0.016,0.150,0.196],[0.380,0.020,0.152,0.214],[0.455,0.012,0.135,0.228],[0.510,0.004,0.100,0.165],[0.545,0.004,0.072,0.095]];
function torsoAt(y){ for(let i=1;i<TORSO.length;i++) if(y<=TORSO[i][0]||i===TORSO.length-1){ const a=TORSO[i-1], b=TORSO[i], t=Math.max(0,Math.min(1,(y-a[0])/(b[0]-a[0]))), s=t*t*(3-2*t); return {cx:a[1]+(b[1]-a[1])*s,rx:a[2]+(b[2]-a[2])*s,rz:a[3]+(b[3]-a[3])*s}; } }

/* ---------------- the parts ---------------- */
function addTorso(g,seg,lo){
  /* the rows (y) of the jersey: the key profile in TORSO, sampled finer where the bands and the number go */
  const Y=lo?[-0.05,0.10,0.28,0.40,0.51,0.545]:[-0.05,0.02,0.10,0.19,0.25,0.30,0.345,0.40,0.455,0.51,0.545];
  const rows=Y.map(y=>{ const t=torsoAt(y), sk=skinY(y,SK_TORSO);
    return ring([t.cx,y,0],t.rx,t.rz,{bones:sk,fold:lo?0:(y<0.15?0.008:0.004),flap:y<0.0?1:y<0.1?0.55:0,mud:a=>Math.max(0,Math.cos(a))*0.42*(1-sstp(0.08,0.5,y)),
      /* the jersey in the team colour; the side panels under the arms, a band across the chest and the shoulder yoke in the accent colour */
      slot:a=>(y>0.5||(y<0.40&&Math.abs(Math.sin(a))>0.8)||(y>0.29&&y<0.36&&Math.cos(a)>0.15))?1:0,
      col:a=>{ let c=1; if(y<0.09) c=0.86+0.14*sstp(-0.05,0.09,y); if(y>0.20&&y<0.30&&Math.cos(a)<-0.2) c*=0.95; if(Math.abs(Math.sin(a))>0.93&&y>0.15&&y<0.45) c*=0.82; return [c,c,c]; } }); });
  loft(g,rows,seg,"t");
  /* the belt and the pants' waist under the jersey hem, the pelvis */
  const pel=[[-0.17,0.0,0.112,0.168,0.8],[-0.10,0.0,0.128,0.184,0.9],[-0.03,0.0,0.134,0.182,1],[0.04,0.0,0.128,0.172,1]].map(t=>ring([t[1],t[0],0],t[2],t[3],{bones:[BN.PELVIS,BN.PELVIS,0],col:[0.5*t[4],0.5*t[4],0.5*t[4]],slot:0}));
  loft(g,thin(pel,lo),seg,"b");
}
function addNeck(g,seg,lo){
  /* the neck brace: a collar over the shoulders, higher at the front and back; the neck inside it */
  const nb=[[0.462,0.018,0.118,0.158],[0.500,0.012,0.108,0.140],[0.545,0.006,0.082,0.100],[0.585,0.008,0.070,0.078]].map(t=>ring([t[1],t[0],0],t[2],t[3],{bones:[BN.CHEST,BN.NECK,sstp(0.42,0.62,t[0])],col:COL.mid,slot:2,k:a=>1+0.05*Math.pow(Math.abs(Math.cos(a)),6)}));
  loft(g,thin(nb,lo),seg,"t");
  const nk=[[0.53,0.008,0.050],[0.62,0.012,0.046]].map(t=>ring([t[1],t[0],0],t[2],t[2],{bones:[BN.NECK,BN.HEAD,sstp(0.54,0.62,t[0])],col:COL.dark,slot:2}));
  loft(g,nk,Math.max(6,seg-2),"t");
}
function addArm(g,sd,seg,lo){
  const z=0.215*sd, UA=sd<0?BN.UAL:BN.UAR, FA=sd<0?BN.FAL:BN.FAR, HA=sd<0?BN.HAL:BN.HAR;
  /* the sleeve: shoulder cap, upper arm, elbow, forearm, cuff (the accent colour); the elbow gets a bulge so the bend doesn't pinch */
  const S=[[0.565,0.048,0.048,[BN.CHEST,UA,0.5],0],[0.520,0.066,0.064,[BN.CHEST,UA,0.55],0],[0.470,0.064,0.062,[BN.CHEST,UA,0.7],0.006],[0.400,0.058,0.056,[UA,UA,0],0.006],[0.300,0.052,0.050,[UA,UA,0],0.006],[0.235,0.052,0.050,[UA,FA,0.18],0.007],
    [0.200,0.058,0.056,[UA,FA,0.5],0.008],[0.165,0.054,0.052,[UA,FA,0.82],0.007],[0.090,0.052,0.050,[FA,FA,0],0.006],[0.010,0.050,0.048,[FA,FA,0],0.004],[-0.040,0.046,0.046,[FA,HA,0.2],0],[-0.075,0.043,0.044,[FA,HA,0.5],0]];
  const rows=thin(S,lo).map(t=>{ const y=t[0]; return ring([0,y,z],t[1],t[2],{bones:t[3],fold:lo?0:t[4],flap:y<0.15?0.7:y<0.3?0.25:0,mud:y<0.1?0.35:0,slot:(y>0.29&&y<0.40)||y<0.03?1:0,col:K1}); });
  loft(g,rows,seg,"tb");
  /* the glove: a fist on the bar (wide across the bar, along z), the cuff in the accent colour above it */
  const G=[[-0.060,0.047,0.052,[FA,HA,0.5],1],[-0.095,0.047,0.058,[HA,HA,0],2],[-0.140,0.052,0.062,[HA,HA,0],2],[-0.180,0.042,0.054,[HA,HA,0],2],[-0.198,0.026,0.036,[HA,HA,0],2]];
  const gr=thin(G,lo).map(t=>ring([0.006,t[0],z],t[1],t[2],{bones:t[3],col:t[4]===1?[0.9,0.9,0.9]:COL.glove,slot:t[4]===1?1:2,n:2.6,mud:0.45}));
  loft(g,gr,Math.max(6,seg-2),"b");
  if(!lo){ /* the elbow guard under the sleeve: a dark bump on the back of the elbow */ }
}
function addLeg(g,sd,seg,lo){
  const z=0.095*sd, TH=sd<0?BN.THL:BN.THR, SH=sd<0?BN.SHL:BN.SHR, FT=sd<0?BN.FTL:BN.FTR;
  /* pants: thigh, knee, calf to the boot top; the team colour darkened */
  const P=[[0.030,0.098,0.096,[BN.PELVIS,TH,0.55],0],[-0.060,0.100,0.095,[BN.PELVIS,TH,0.9],0.01],[-0.180,0.094,0.090,[TH,TH,0],0.012],[-0.300,0.084,0.080,[TH,TH,0],0.012],[-0.395,0.078,0.075,[TH,SH,0.2],0.012],
    [-0.460,0.082,0.078,[TH,SH,0.5],0.012],[-0.530,0.074,0.070,[TH,SH,0.85],0.01],[-0.600,0.066,0.063,[SH,SH,0],0.01]];
  const pr=thin(P,lo).map(t=>{ const y=t[0]; return ring([0.003+(y<-0.2?0.006:0),y,z],t[1],t[2],{bones:t[3],fold:lo?0:t[4],col:[0.46,0.46,0.46],slot:0,flap:0.18,mud:sstp(-0.30,-0.62,y)*0.6}); });
  loft(g,pr,seg,"");
  /* the knee brace: a shell over the knee, a cup in front (the accent colour), a dark band round, a hinge on each side */
  const kb=[-0.385,-0.425,-0.465,-0.505,-0.545].map((y,i)=>{ const f=1-Math.abs(i-2)/2.6; return ring([0.012,y,z],0.082+0.012*f,0.080+0.010*f,{bones:[TH,SH,sstp(-0.40,-0.52,y)],col:a=>Math.cos(a)>0.45?[0.9,0.9,0.9]:COL.mid,slot:a=>Math.cos(a)>0.45?1:2,
    k:a=>1+0.5*Math.pow(Math.max(0,Math.cos(a)),3)*f*0.55+0.07*Math.pow(Math.abs(Math.sin(a)),8)*f}); });
  if(!lo) loft(g,kb,Math.max(8,seg),"tb");
  /* the boot: a collar, the white upper, buckles, the ankle */
  const B=[[-0.575,0.0,0.082,0.076,[SH,SH,0],COL.mid,2],[-0.610,0.008,0.077,0.072,[SH,SH,0],COL.boot,2],[-0.700,0.014,0.074,0.069,[SH,SH,0],COL.boot,2],[-0.790,0.012,0.072,0.067,[SH,FT,0.3],COL.boot,2],[-0.870,0.008,0.070,0.065,[SH,FT,0.75],COL.boot,2],[-0.935,0.004,0.066,0.062,[FT,FT,0],COL.boot,2]];
  const br=thin(B,lo).map(t=>ring([t[1],t[0],z],t[2],t[3],{bones:t[4],col:t[5],slot:t[6],mud:sstp(-0.5,-0.95,t[0])*0.9,fold:lo?0:0.005}));
  loft(g,br,seg,"b");
  /* the foot: a loft along +x from the heel (rings stand in the y-z plane, the toe box and the dark sole) */
  const F=[[-0.080,-0.946,0.044,0.048],[-0.045,-0.940,0.052,0.060],[0.030,-0.952,0.044,0.064],[0.110,-0.962,0.036,0.067],[0.170,-0.968,0.030,0.062],[0.208,-0.975,0.019,0.042]];
  const fr=thin(F,lo).map(t=>ring([t[0],t[1],z],t[2],t[3],{u:Y,v:Z,bones:[FT,FT,0],mud:0.9,n:2.4,col:a=>Math.cos(a)<-0.5?COL.sole:(t[0]>0.12&&Math.cos(a)>0.55?COL.mid:COL.boot),slot:2}));
  loft(g,fr,Math.max(8,seg),"tb");
  if(!lo){ /* the buckles: three straps across the shin, small dark / accent boxes on the outer front */
    [-0.655,-0.735,-0.815].forEach((y,i)=>{ const bk=[0,1].map(q=>ring([0.040+0.004*i+q*0.014,y,z+sd*0.022],0.014,0.030-q*0.008,{bones:[SH,SH,0],col:COL.dark,slot:i===1?1:2,n:3})); loft(g,bk,6,"tb"); }); }
}
/* the helmet: a modified sphere (a long shell with a chin bar, an eye port), a peak, the goggles' frame and lens, the strap */
function addHelmet(g,hi){
  const c=[0.026,0.742,0], rx=0.158, ry=0.144, rz=0.131, nlon=hi?22:10, nlat=hi?13:6, H=BN.HEAD, sk=[H,H,1,0];
  const rows=[]; const th0=-0.95, th1=Math.PI/2;
  for(let j=0;j<=nlat;j++){ const th=th0+(th1-th0)*j/nlat; rows.push(th); }
  const base=g.n;
  for(let j=0;j<=nlat;j++){ const th=rows[j];
    for(let k=0;k<nlon;k++){ const ph=k/nlon*Math.PI*2, dx=Math.cos(th)*Math.cos(ph), dy=Math.sin(th), dz=Math.cos(th)*Math.sin(ph);
      let px=c[0]+rx*dx, py=c[1]+ry*dy, pz=c[2]+rz*dz;
      const fr=sstp(-0.1,0.9,dx), low=sstp(0.15,-0.7,dy), chin=fr*low;
      px+=0.052*chin; py-=0.024*chin; pz*=1-0.20*chin;
      const port=sstp(0.55,0.70,dx)*sstp(-0.12,0.0,dy)*(1-sstp(0.40,0.50,dy));
      px-=0.010*port; py+=0.0*port;
      px+=0.010*sstp(0.5,0.62,dx)*sstp(0.42,0.5,dy);   /* the brow */
      /* colours: the shell in the team colour, a stripe over the top and a swoosh on each side in the accent colour, the eye port and the chin vent dark */
      let slot=0, col=K1;
      if(Math.abs(dz)<0.11&&dy>0.15&&dx>-0.8) slot=1;
      else if(Math.abs(dz)>0.80&&dy>-0.45&&dy<0.32&&dx<0.35&&dx>-0.55) slot=1;
      if(port>0.35){ slot=2; col=COL.dark; }
      if(dx>0.70&&dy<-0.30){ slot=2; col=COL.dark; }
      if(dx<-0.5&&dy<-0.22){ slot=2; col=COL.mid; }
      g.vert([px,py,pz],col,sk,[slot,0,0.38*sstp(0.25,0.9,dx)*(dy<0.35?1:0.35)]); } }
  const T=[]; for(let j=0;j<nlat;j++) for(let k=0;k<nlon;k++){ const a=base+j*nlon+k, b=base+j*nlon+(k+1)%nlon, cc=base+(j+1)*nlon+k, d=base+(j+1)*nlon+(k+1)%nlon; T.push(a,cc,b,b,cc,d); }
  { let s=0; const P=g.P; for(let t=0;t<T.length;t+=3){ const a=T[t]*3, b=T[t+1]*3, cc=T[t+2]*3, ux=P[b]-P[a], uy=P[b+1]-P[a+1], uz=P[b+2]-P[a+2], vx=P[cc]-P[a], vy=P[cc+1]-P[a+1], vz=P[cc+2]-P[a+2];
      s+=(uy*vz-uz*vy)*(P[a]-c[0])+(uz*vx-ux*vz)*(P[a+1]-c[1])+(ux*vy-uy*vx)*(P[a+2]-c[2]); }
    for(let t=0;t<T.length;t+=3){ if(s<0) g.I.push(T[t],T[t+2],T[t+1]); else g.I.push(T[t],T[t+1],T[t+2]); } }
  /* the bottom: a dark disc closing the shell at the neck */
  { const ph0=g.n; for(let k=0;k<nlon;k++){ const o=(base+k)*3; g.vert([g.P[o],g.P[o+1],g.P[o+2]],COL.dark,sk,[2,0,0]); } const ci=g.vert([c[0]-0.012,c[1]-0.115,0],COL.dark,sk,[2,0,0]);
    for(let k=0;k<nlon;k++) g.I.push(ph0+k,ph0+(k+1)%nlon,ci); { /* orient downward */ const n0=g.I.length-nlon*3, P=g.P, a=g.I[n0]*3, b=g.I[n0+1]*3, cc=g.I[n0+2]*3; const ny=(P[b+2]-P[a+2])*(P[cc]-P[a])-(P[b]-P[a])*(P[cc+2]-P[a+2]); if(ny>0) for(let t=n0;t<g.I.length;t+=3){ const s=g.I[t+1]; g.I[t+1]=g.I[t+2]; g.I[t+2]=s; } } }
  /* the peak: a thick curved plate above the eyes, angled up, in the accent colour (a darker underside, a rim) */
  { const nu=hi?5:2, nv=hi?8:4, p0=g.n, W=nv+1;
    for(let side=0;side<2;side++){ const off=side?0.0065:-0.0065;
      for(let i=0;i<=nu;i++){ const u=i/nu; for(let j=0;j<=nv;j++){ const v=-1+2*j/nv, w=1-Math.abs(v);
        const x=0.100+0.205*u+0.022*w*u, y=0.848+0.066*u*u*0.5+0.052*u-0.020*v*v*(0.4+u)-0.0, z=v*(0.094+0.020*u);
        const cc=side?[0.95,0.95,0.95]:[0.55,0.55,0.55];
        g.vert([x,y+off,z],cc,[BN.HEAD,BN.HEAD,1,0],[1,0,0]); } } }
    const idx=(s2,i,j)=>p0+s2*(nu+1)*W+i*W+j;
    for(let s2=0;s2<2;s2++) for(let i=0;i<nu;i++) for(let j=0;j<nv;j++){ const a=idx(s2,i,j), b=idx(s2,i,j+1), cc=idx(s2,i+1,j), d=idx(s2,i+1,j+1); if(s2===1) g.I.push(a,b,cc,b,d,cc); else g.I.push(a,cc,b,b,cc,d); }
    /* the rim: strips joining the top and the bottom along the front and the two sides (own vertices, flat) */
    const rim=(pairs)=>{ for(let q=0;q<pairs.length-1;q++){ const a=pairs[q][0], b=pairs[q][1], cc=pairs[q+1][0], d=pairs[q+1][1]; const P=g.P, ax=P[a*3],ay=P[a*3+1],az=P[a*3+2];
        const base2=g.n; [a,b,cc,d].forEach(vi=>g.vert([P[vi*3],P[vi*3+1],P[vi*3+2]],[0.7,0.7,0.7],[BN.HEAD,BN.HEAD,1,0],[1,0,0]));
        /* outward = away from the plate's centre line */ const mx=(P[a*3]+P[cc*3])/2, mz=(P[a*3+2]+P[cc*3+2])/2;
        g.I.push(base2,base2+1,base2+2,base2+1,base2+3,base2+2); const ux=P[b*3]-P[a*3],uy=P[b*3+1]-P[a*3+1],uz=P[b*3+2]-P[a*3+2], vx=P[cc*3]-P[a*3],vy=P[cc*3+1]-P[a*3+1],vz=P[cc*3+2]-P[a*3+2];
        const nx=uy*vz-uz*vy, nz=ux*vy-uy*vx, ox=mx-0.18, oz=mz; if(nx*ox+nz*oz<0){ const n0=g.I.length-6; for(let t=n0;t<g.I.length;t+=3){ const sw=g.I[t+1]; g.I[t+1]=g.I[t+2]; g.I[t+2]=sw; } } } };
    const front=[]; for(let j=0;j<=nv;j++) front.push([idx(0,nu,j),idx(1,nu,j)]); rim(front);
    const left=[]; for(let i=0;i<=nu;i++) left.push([idx(0,i,0),idx(1,i,0)]); rim(left);
    const right=[]; for(let i=0;i<=nu;i++) right.push([idx(0,i,nv),idx(1,i,nv)]); rim(right); }
  /* the goggles: a squared frame in the eye port, the lens in it, the strap round the shell */
  const gf=[[0.152,0.048,0.078],[0.184,0.047,0.080],[0.206,0.040,0.071]].map(t=>ring([t[0],0.768,0],t[1],t[2],{u:Y,v:Z,n:3.2,bones:[H,H,0],col:COL.dark,slot:2}));
  loft(g,gf,hi?16:8,"");
  const lens=[[0.200,0.036,0.066],[0.216,0.028,0.054]].map(t=>ring([t[0],0.768,0],t[1],t[2],{u:Y,v:Z,n:3.0,bones:[H,H,0],col:[0.62,0.62,0.62],slot:1}));
  loft(g,lens,hi?14:8,"t");
  if(hi){ const st=[[0.744,0.164,0.136],[0.768,0.172,0.143],[0.794,0.164,0.136]].map(t=>ring([c[0]-0.004,t[0],0],t[1],t[2],{bones:[H,H,0],col:COL.strap,slot:2}));
    loft(g,st,22,"");
    /* the chin bar's vents */
    [-1,1].forEach(sd=>{ const vr=[0,1].map(q=>ring([0.214+q*0.01,0.672,sd*0.040],0.016,0.016,{u:Y,v:Z,n:2.5,bones:[H,H,0],col:COL.dark,slot:2})); loft(g,vr,8,"t"); }); }
}
/* the number patch on the jersey's back: a curved grid 0.27 x 0.24 m laid 6 mm above the jersey; u runs to the rider's right, v up (the atlas cell) */
function addBack(g,hi){
  const nu=hi?8:4, nv=hi?6:3, w=0.138, y0=0.215, y1=0.455; const P0=g.n;
  for(let j=0;j<=nv;j++){ const y=y0+(y1-y0)*j/nv, t=torsoAt(y), sk=skinY(y,SK_TORSO);
    for(let i=0;i<=nu;i++){ const z=-w+2*w*i/nu, e=Math.sqrt(Math.max(0.02,1-(z/t.rz)*(z/t.rz))); const x=t.cx-t.rx*e-0.007;
      const p=g.P; g.vert([x,y,z],K1,[sk[0],sk[1],1-sk[2],sk[2]],[2,0,0]); g.UV=g.UV||[]; g.UV.push(i/nu,j/nv); } }
  for(let j=0;j<nv;j++) for(let i=0;i<nu;i++){ const a=P0+j*(nu+1)+i, b=a+1, c=a+(nu+1), d=c+1; g.I.push(a,b,c,b,d,c); }
  /* the faces point back (-x) */
  { const P=g.P, a=g.I[0]*3, b=g.I[1]*3, c=g.I[2]*3, nx=(P[b+1]-P[a+1])*(P[c+2]-P[a+2])-(P[b+2]-P[a+2])*(P[c+1]-P[a+1]); if(nx>0) for(let t=0;t<g.I.length;t+=3){ const s=g.I[t+1]; g.I[t+1]=g.I[t+2]; g.I[t+2]=s; } }
}

/* ---------------- the whole rider ---------------- */
/* detail 1: the near rider (own helmet mesh, buckles, folds); 0: the far pack (one mesh, thin rings). Returns the geometries and the triangle counts */
export function buildRider(detail){
  const hi=detail>0, seg=hi?14:7, lo=!hi, body=new GB();
  addTorso(body,seg,lo); addNeck(body,seg,lo); addArm(body,-1,hi?12:6,lo); addArm(body,1,hi?12:6,lo); addLeg(body,-1,hi?12:7,lo); addLeg(body,1,hi?12:7,lo);
  let helmet=null;
  if(hi){ const h=new GB(); addHelmet(h,true); helmet=h.geometry(); } else addHelmet(body,false);
  const gb=body.geometry();
  const b=new GB(); addBack(b,hi); const back=b.geometry(); back.setAttribute("uv",new THREE.BufferAttribute(new Float32Array(b.UV),2));
  return {body:gb,helmet:helmet,back:back,tris:{body:gb.index.count/3,helmet:helmet?helmet.index.count/3:0,back:back.index.count/3}};
}
