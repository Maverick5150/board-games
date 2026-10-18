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
function GB(){ this.P=[]; this.C=[]; this.K=[]; this.F=[]; this.I=[]; this.n=0; this.part=0; }
/* every vertex also carries its PART of the outfit (PART.*, set with g.part before a loft): the fragment shader paints the jersey, sleeves, gloves, pants, boots and helmet from it (r3d-riders.js apparel) */
GB.prototype.vert=function(p,col,sk,fx){ this.P.push(p[0],p[1],p[2]); this.C.push(col[0],col[1],col[2]); this.K.push(sk[0],sk[1],sk[2],sk[3]); this.F.push(fx[0],fx[1],fx[2],this.part); return this.n++; };
export const PART={JERSEY:0,SLEEVE:1,GLOVE:2,PANTS:3,BOOT:4,GEAR:5,SHELL:6,TRIM:7,STRAP:8,LENS:9,CHIN:10,FRAME:11};
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
  g.setAttribute("aFx",new THREE.BufferAttribute(new Float32Array(this.F),4));     /* colour slot (0 team, 1 accent, 2 fixed), cloth flutter, mud weight, the outfit part (PART.*) */
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
let LITE=false;   /* (set by buildRider while it builds the lite near rider) */

/* ---------------- the colours (linear) ---------------- */
const COL={white:lin("#dfe2e8"),boot:lin("#e6e8ee"),dark:lin("#15161b"),mid:lin("#2a2c33"),glove:lin("#1a1b20"),strap:lin("#e9eaee"),sole:lin("#101114"),metal:lin("#8a8e98"),lens:lin("#1a2234")};
const K1=[1,1,1];
/* bones along y: the weights blend between the stops (a stop = a bone's joint height, so a ring between two joints is shared by both) */
function skinY(y,stops){ if(y>=stops[0][0]) return [stops[0][1],stops[0][1],0]; for(let i=1;i<stops.length;i++){ if(y>=stops[i][0]){ const a=stops[i-1], b=stops[i], t=(a[0]-y)/(a[0]-b[0]); return [a[1],b[1],t]; } } const l=stops[stops.length-1]; return [l[1],l[1],0]; }
const SK_TORSO=[[0.62,BN.NECK],[0.50,BN.CHEST],[0.26,BN.CHEST],[0.10,BN.SPINE],[0.0,BN.PELVIS]];
/* the jersey's surface at height y (the back number is laid on it) */
const TORSO=[[0.000,-0.004,0.156,0.196],[0.060,0.000,0.138,0.172],[0.120,0.004,0.130,0.162],[0.190,0.008,0.136,0.172],[0.280,0.016,0.152,0.200],[0.380,0.020,0.154,0.222],[0.455,0.012,0.136,0.240],[0.510,0.004,0.104,0.190],[0.545,0.004,0.076,0.112]];   /* (milestone 2: a loose hem, squarer shoulders over the chest protector's cups) */
function torsoAt(y){ for(let i=1;i<TORSO.length;i++) if(y<=TORSO[i][0]||i===TORSO.length-1){ const a=TORSO[i-1], b=TORSO[i], t=Math.max(0,Math.min(1,(y-a[0])/(b[0]-a[0]))), s=t*t*(3-2*t); return {cx:a[1]+(b[1]-a[1])*s,rx:a[2]+(b[2]-a[2])*s,rz:a[3]+(b[3]-a[3])*s}; } }

/* ---------------- the parts ---------------- */
function addTorso(g,seg,lo){
  /* the rows (y) of the jersey: the key profile in TORSO, sampled finer where the bands and the number go */
  const Y=lo?[0.0,0.12,0.28,0.40,0.51,0.545]:[0.0,0.06,0.12,0.19,0.25,0.30,0.345,0.40,0.455,0.51,0.545];
  const rows=Y.map(y=>{ const t=torsoAt(y), sk=skinY(y,SK_TORSO);
    const cp=lo?0:sstp(0.22,0.32,y)*(1-sstp(0.44,0.50,y)), cu=lo?0:sstp(0.42,0.47,y)*(1-sstp(0.50,0.54,y));
    return ring([t.cx,y,0],t.rx,t.rz,{bones:sk,fold:lo?0:(y<0.15?0.008:0.004),flap:y<0.02?1:y<0.12?0.5:0,mud:a=>Math.max(0,Math.cos(a))*0.42*(1-sstp(0.08,0.5,y)),
      k:(cp>0||cu>0)?(a=>1+0.045*cp*Math.pow(Math.max(0,Math.cos(a)),2)+0.05*cu*Math.pow(Math.abs(Math.sin(a)),4)):null,   /* the chest protector's plate and shoulder cups under the jersey */
      /* the jersey in the team colour; the side panels under the arms, a band across the chest and the shoulder yoke in the accent colour */
      slot:a=>y>0.45?1:(y<0.40&&Math.abs(Math.sin(a))>0.8)?4:(y>0.29&&y<0.36&&Math.cos(a)>0.15)?3:0,
      col:a=>{ let c=1; if(y<0.09) c=0.86+0.14*sstp(-0.05,0.09,y); if(y>0.20&&y<0.30&&Math.cos(a)<-0.2) c*=0.95; if(Math.abs(Math.sin(a))>0.9&&y>0.15&&y<0.45) c*=0.72; if(Math.cos(a)<-0.985&&y>0.1&&y<0.45) c*=0.86; return [c,c,c]; } }); });
  g.part=PART.JERSEY; loft(g,rows,seg,"t");
  /* the belt and the pants' waist under the jersey hem, the pelvis */
  const pel=[[-0.17,0.0,0.112,0.168],[-0.10,0.0,0.128,0.184],[-0.03,0.0,0.136,0.184],[0.04,0.0,0.132,0.176]].map(t=>ring([t[1],t[0],0],t[2],t[3],{bones:[BN.PELVIS,BN.PELVIS,0],col:[0.46,0.46,0.46],slot:a=>Math.abs(Math.sin(a))>0.9?4:5,fold:lo?0:0.006}));
  g.part=PART.PANTS; loft(g,thin(pel,lo),seg,"b");
}
function addNeck(g,seg,lo){
  /* the neck brace: a collar over the shoulders, higher at the front and back; the neck inside it */
  const nb=[[0.488,0.012,0.114,0.156],[0.530,0.008,0.102,0.132],[0.572,0.008,0.090,0.106],[0.603,0.010,0.083,0.090]].map(t=>ring([t[1],t[0],0],t[2],t[3],{bones:[BN.CHEST,BN.NECK,sstp(0.46,0.64,t[0])],col:t[0]>0.555?COL.dark:COL.mid,slot:2,   /* (milestone 2: it rises to the helmet's rim: no neck shows; dark plastic, not a grey bib) */k:a=>1+0.05*Math.pow(Math.abs(Math.cos(a)),6)}));   /* (polish: a coloured collar over the shoulders with a dark pad at its top, not a grey funnel) */
  g.part=PART.GEAR; loft(g,thin(nb,lo),seg,"t");
  const nk=[[0.53,0.008,0.050],[0.62,0.012,0.046]].map(t=>ring([t[1],t[0],0],t[2],t[2],{bones:[BN.NECK,BN.HEAD,sstp(0.54,0.62,t[0])],col:COL.dark,slot:2}));
  g.part=PART.GEAR; loft(g,nk,lo?5:Math.max(6,seg-2),"t");
}
function addArm(g,sd,seg,lo){
  const z=0.215*sd, UA=sd<0?BN.UAL:BN.UAR, FA=sd<0?BN.FAL:BN.FAR, HA=sd<0?BN.HAL:BN.HAR;
  /* the sleeve: shoulder cap, upper arm, elbow, forearm, cuff (the accent colour); the elbow gets a bulge so the bend doesn't pinch */
  const S=[[0.565,0.048,0.048,[BN.CHEST,UA,0.5],0],[0.520,0.066,0.064,[BN.CHEST,UA,0.55],0],[0.470,0.064,0.062,[BN.CHEST,UA,0.7],0.006],[0.400,0.058,0.056,[UA,UA,0],0.006],[0.300,0.052,0.050,[UA,UA,0],0.006],[0.235,0.052,0.050,[UA,FA,0.18],0.007],
    [0.200,0.058,0.056,[UA,FA,0.5],0.008],[0.165,0.054,0.052,[UA,FA,0.82],0.007],[0.090,0.052,0.050,[FA,FA,0],0.006],[0.010,0.050,0.048,[FA,FA,0],0.004],[-0.036,0.047,0.047,[FA,HA,0.15],0],[-0.050,0.045,0.046,[FA,HA,0.3],0]];   /* (milestone 2: the sleeve ends over the glove's cuff) */
  const rows=thin(S,lo).map(t=>{ const y=t[0], ep=lo?0:(1-Math.min(1,Math.abs(y-0.200)/0.05)); return ring([0,y,z],t[1],t[2],{bones:t[3],fold:lo?0:t[4],flap:y<0.15?0.7:y<0.3?0.25:0,mud:y<0.1?0.35:0,slot:(y>0.29&&y<0.40)?3:y<0.03?1:0,col:K1,
    k:ep>0?(a=>1+0.20*ep*Math.pow(Math.max(0,-Math.cos(a)),3)):null}); });   /* (milestone 2: an elbow guard under the sleeve, a bulge at the back of the elbow) */
  g.part=PART.SLEEVE; loft(g,rows,seg,"tb");
  /* the glove (milestone 2: it was a mitten 12 cm across): the near rider's hand WRAPS THE GRIP. In the hand bone's rest frame the grip is a bar along z through
     (0, -0.145): the cuff (accent colour), the back of the hand down to the knuckles over the bar, four fingers curled round the front and under the bar, the thumb
     round its back from the inside. The pack keeps a small closed fist. */
  if(lo){
    const G=[[-0.058,0.040,0.046,[FA,HA,0.5],1],[-0.092,0.030,0.044,[HA,HA,0],2],[-0.135,0.032,0.046,[HA,HA,0],2],[-0.168,0.022,0.036,[HA,HA,0],2]];
    const gr=G.map(t=>ring([0.004,t[0],z],t[1],t[2],{bones:t[3],col:t[4]===1?[0.9,0.9,0.9]:COL.glove,slot:t[4]===1?1:2,n:2.6,mud:0.45}));
    g.part=PART.GLOVE; loft(g,gr,5,"b");
  } else {
    g.part=PART.GLOVE;
    const cuff=[[-0.028,0.043,0.048,[FA,FA,0]],[-0.050,0.046,0.051,[FA,HA,0.5]],[-0.066,0.040,0.047,[FA,HA,0.85]]].map(t=>ring([0.002,t[0],z],t[1],t[2],{bones:t[3],col:[0.9,0.9,0.9],slot:1,n:2.4,mud:0.3}));
    loft(g,cuff,10,"");
    const hand=[[-0.062,0.002,0.026,0.038],[-0.080,0.004,0.021,0.043],[-0.099,0.006,0.019,0.045],[-0.116,0.008,0.017,0.044],[-0.128,0.009,0.012,0.040]].map(t=>ring([t[1],t[0],z],t[2],t[3],{bones:[HA,HA,0],col:COL.glove,slot:2,n:2.6,mud:0.45}));
    loft(g,hand,10,"b");
    const GY=-0.145, R=0.0245, sd2=sd;
    [[-0.029,0.0094,-2.85],[-0.0095,0.0097,-2.95],[0.0095,0.0093,-2.85],[0.027,0.0082,-2.5]].forEach(f=>{
      const zf=z+sd2*f[0], n=LITE?5:7, rows=[];
      for(let k=0;k<n;k++){ const th=0.95+(f[2]-0.95)*k/(n-1), r=f[1]*(1-0.18*k/(n-1)), ct=Math.cos(th), s2=Math.sin(th);
        rows.push(ring([R*ct,GY+R*s2,zf],r,r,{u:[ct,s2,0],v:Z,bones:[HA,HA,0],col:COL.glove,slot:2,mud:0.45})); }
      loft(g,rows,LITE?5:6,"t"); });
    { const zt=z-sd2*0.036, n=5, rows=[];
      for(let k=0;k<n;k++){ const th=2.55+(4.55-2.55)*k/(n-1), r=0.0105*(1-0.15*k/(n-1)), ct=Math.cos(th), s2=Math.sin(th), rr=R+0.002;
        rows.push(ring([rr*ct,GY+rr*s2,zt],r,r,{u:[ct,s2,0],v:Z,bones:[HA,HA,0],col:COL.glove,slot:2,mud:0.45})); }
      loft(g,rows,6,"tb"); }
  }
  if(!lo){ /* the elbow guard under the sleeve: a dark bump on the back of the elbow */ }
}
function addLeg(g,sd,seg,lo){
  const z=0.095*sd, TH=sd<0?BN.THL:BN.THR, SH=sd<0?BN.SHL:BN.SHR, FT=sd<0?BN.FTL:BN.FTR;
  /* pants: thigh, knee, calf to the boot top; the team colour darkened (milestone 2: the knee brace is UNDER the pants, a bulk at the knee, not a robot shell on it) */
  const P=[[0.030,0.098,0.096,[BN.PELVIS,TH,0.55],0],[-0.060,0.100,0.095,[BN.PELVIS,TH,0.9],0.01],[-0.180,0.094,0.090,[TH,TH,0],0.012],[-0.300,0.085,0.081,[TH,TH,0],0.012],[-0.390,0.086,0.081,[TH,SH,0.2],0.012],
    [-0.455,0.091,0.085,[TH,SH,0.5],0.012],[-0.520,0.083,0.077,[TH,SH,0.85],0.01],[-0.575,0.070,0.066,[SH,SH,0],0.01],[-0.610,0.064,0.060,[SH,SH,0],0.006]];
  const pr=thin(P,lo).map(t=>{ const y=t[0], kn=lo?0:(1-Math.min(1,Math.abs(y+0.455)/0.08)); return ring([0.003+(y<-0.2?0.006:0),y,z],t[1],t[2],{bones:t[3],fold:lo?0:t[4],col:[0.46,0.46,0.46],slot:5,flap:0.18,mud:sstp(-0.30,-0.62,y)*0.6,
    k:kn>0?(a=>1+0.10*kn*Math.pow(Math.max(0,Math.cos(a)),2)+0.04*kn*Math.pow(Math.abs(Math.sin(a)),6)):null}); });
  g.part=PART.PANTS; loft(g,pr,seg,"");
  /* the boot (milestone 2: a size that fits the leg): the padded collar, the shaft with a shin plate in front, the ankle, buckles on the outer side */
  const B=[[-0.560,0.0,0.075,0.069,[SH,SH,0],COL.mid],[-0.590,0.006,0.072,0.067,[SH,SH,0],COL.boot],[-0.680,0.012,0.069,0.064,[SH,SH,0],COL.boot],[-0.770,0.012,0.067,0.062,[SH,FT,0.3],COL.boot],[-0.850,0.008,0.066,0.061,[SH,FT,0.75],COL.boot],[-0.905,0.004,0.064,0.060,[FT,FT,0],COL.boot],[-0.935,0.002,0.063,0.060,[FT,FT,0],COL.boot]];
  const br=thin(B,lo).map(t=>ring([t[1],t[0],z],t[2],t[3],{bones:t[4],col:t[5],slot:2,mud:sstp(-0.5,-0.95,t[0])*0.9,fold:lo?0:0.004,
    k:lo?null:(a=>1+0.07*Math.pow(Math.max(0,Math.cos(a)),4)*sstp(-0.56,-0.62,t[0])*sstp(-0.90,-0.84,t[0]))}));   /* (the shin plate stands proud in front) */
  g.part=PART.BOOT; loft(g,br,seg,"b");
  /* the foot: a loft along +x from the heel (rings stand in the y-z plane, the toe box and the dark sole) */
  const F=[[-0.082,-0.950,0.042,0.047],[-0.045,-0.942,0.050,0.058],[0.030,-0.953,0.043,0.061],[0.110,-0.962,0.035,0.063],[0.168,-0.967,0.029,0.058],[0.202,-0.972,0.018,0.040]];
  const fr=thin(F,lo).map(t=>ring([t[0],t[1],z],t[2],t[3],{u:Y,v:Z,bones:[FT,FT,0],mud:0.9,n:2.4,col:a=>Math.cos(a)<-0.5?COL.sole:(t[0]>0.12&&Math.cos(a)>0.55?COL.mid:COL.boot),slot:2}));
  g.part=PART.BOOT; loft(g,fr,lo?6:Math.max(8,seg),"tb");
  if(!lo){ /* four straps from the front round the outer side, each with a buckle */
    const so=sd;   /* the outer side */
    [-0.628,-0.700,-0.772,-0.842].forEach((y,i)=>{ const rr=B.find(b=>b[0]<=y)||B[B.length-1], rx=rr[2]+0.0045, rz=rr[3]+0.0045, cx=rr[1];
      const row=dy=>{ const pts=[]; for(let k=0;k<=8;k++){ const a=-0.55+2.45*k/8; pts.push([cx+rx*Math.cos(a)*(1+0.07*Math.pow(Math.max(0,Math.cos(a)),4)),y+dy,z+so*rz*Math.sin(a)]); } return pts; };
      g.part=PART.GEAR; band(g,row(-0.0065),row(0.0065),false,COL.dark,2,[SH,SH,1,0],(m,n)=>n[0]*(m[0]-cx)+n[2]*(m[2]-z)>0);
      const a=1.30, bx=cx+(rx+0.006)*Math.cos(a), bz=z+so*(rz+0.006)*Math.sin(a), ux=Math.cos(a), uz=so*Math.sin(a);
      const bk=[-1,1].map(q=>ring([bx-uz*0.016*q,y,bz+ux*0.016*q],0.007,0.015,{u:[ux,0,uz],v:Y,n:3,bones:[SH,SH,0],col:i===1?K1:COL.metal,slot:i===1?1:2}));
      loft(g,bk,6,"tb"); }); }
}
/* ---------------- milestone 2: THE HELMET, a real motocross shell (it was a ball with a flat 'duck bill' on top and a robot neck under it) ----------------
   a long shell (longer at the back, a flatter crown, the lower back flared out over the neck brace, the rim low enough to hide the neck), the face recessed; a CHIN
   BAR that wraps the face and juts forward into a beak with a vent; GOGGLES (a thick frame wrapped round the face with a nose cut, a dark mirrored lens, a strap round
   the shell); a VISOR that grows out of the brow over the goggles and runs back along the temples. Every vertex is on the head bone. hi = the near rider's own
   glossy mesh (about 1,700 triangles); lo = about 300 triangles inside the pack's body mesh (the goggles are painted on the shell). */
export const HC=[0.020,0.742,0];   /* the shell's centre: the apparel shader paints the shell by the direction from it */
function shellPt(dx,dy,dz,o){
  const rx=dx>0?0.142:0.153, ry=dy>0?0.139:0.152, rz=0.127;
  let x=HC[0]+rx*dx, y=HC[1]+ry*dy, z=HC[2]+rz*dz;
  const low=sstp(-0.25,-0.85,dy), back=sstp(0.35,-0.55,dx);
  z*=1+0.075*low*(0.55+0.45*back); x-=0.014*low*back;          /* the lower back flares out */
  const face=sstp(0.42,0.78,dx)*sstp(0.34,0.06,dy);            /* the face is recessed: the goggles and the chin bar sit in front of it */
  x-=0.040*face;
  y-=0.010*sstp(0.55,0.95,dy);                                 /* a flatter crown */
  o[0]=x; o[1]=y; o[2]=z; return o;
}
const SP=[0,0,0];
/* faces between two point rows (closed loops or open strips) of equal length; want(p, n) -> true when the face normal n at p points the way it should */
function band(g,A,B,closed,col,slot,sk,want){
  const n=A.length, ia=[], ib=[];
  for(let k=0;k<n;k++){ ia.push(g.vert(A[k],typeof col==="function"?col(k,0):col,sk,[typeof slot==="function"?slot(k,0):slot,0,0])); }
  for(let k=0;k<n;k++){ ib.push(g.vert(B[k],typeof col==="function"?col(k,1):col,sk,[typeof slot==="function"?slot(k,1):slot,0,0])); }
  const P=g.P, m=closed?n:n-1;
  for(let k=0;k<m;k++){ const k1=(k+1)%n, a=ia[k], b=ia[k1], c=ib[k], d=ib[k1];
    const ux=P[b*3]-P[a*3], uy=P[b*3+1]-P[a*3+1], uz=P[b*3+2]-P[a*3+2], vx=P[c*3]-P[a*3], vy=P[c*3+1]-P[a*3+1], vz=P[c*3+2]-P[a*3+2];
    const nx=uy*vz-uz*vy, ny=uz*vx-ux*vz, nz=ux*vy-uy*vx, mx=(P[a*3]+P[d*3])/2, my=(P[a*3+1]+P[d*3+1])/2, mz=(P[a*3+2]+P[d*3+2])/2;
    if(want([mx,my,mz],[nx,ny,nz])) g.I.push(a,b,c,b,d,c); else g.I.push(a,c,b,b,c,d); }
}
function addHelmet(g,hi){
  const H=BN.HEAD, sk=[H,H,1,0], nlon=hi?(LITE?22:30):9, nlat=hi?(LITE?11:15):5, th0=-1.0, th1=Math.PI/2;
  /* the shell */
  const base=g.n; g.part=PART.SHELL;
  for(let j=0;j<=nlat;j++){ const th=th0+(th1-th0)*j/nlat;
    for(let k=0;k<nlon;k++){ const ph=k/nlon*Math.PI*2, dx=Math.cos(th)*Math.cos(ph), dy=Math.sin(th), dz=Math.cos(th)*Math.sin(ph);
      shellPt(dx,dy,dz,SP);
      /* colours (the pack's helmet has no apparel shader: its stripes and the goggles are vertex colours; the near helmet repaints the shell) */
      let slot=0, col=K1;
      if(Math.abs(dz)<0.11&&dy>0.15&&dx>-0.8) slot=3;
      else if(Math.abs(dz)>0.80&&dy>-0.45&&dy<0.32&&dx<0.35&&dx>-0.55) slot=4;
      if(dx<-0.5&&dy<-0.22){ slot=2; col=COL.mid; }
      if(!hi&&dx>0.62&&dy>-0.16&&dy<0.30){ slot=2; col=COL.lens; }   /* the pack: the goggles painted on */
      g.vert([SP[0],SP[1],SP[2]],col,sk,[slot,0,0.38*sstp(0.25,0.9,dx)*(dy<0.35?1:0.35)]); } }
  const T=[]; for(let j=0;j<nlat;j++) for(let k=0;k<nlon;k++){ const a=base+j*nlon+k, b=base+j*nlon+(k+1)%nlon, cc=base+(j+1)*nlon+k, d=base+(j+1)*nlon+(k+1)%nlon; T.push(a,cc,b,b,cc,d); }
  { let s=0; const P=g.P; for(let t=0;t<T.length;t+=3){ const a=T[t]*3, b=T[t+1]*3, cc=T[t+2]*3, ux=P[b]-P[a], uy=P[b+1]-P[a+1], uz=P[b+2]-P[a+2], vx=P[cc]-P[a], vy=P[cc+1]-P[a+1], vz=P[cc+2]-P[a+2];
      s+=(uy*vz-uz*vy)*(P[a]-HC[0])+(uz*vx-ux*vz)*(P[a+1]-HC[1])+(ux*vy-uy*vx)*(P[a+2]-HC[2]); }
    for(let t=0;t<T.length;t+=3){ if(s<0) g.I.push(T[t],T[t+2],T[t+1]); else g.I.push(T[t],T[t+1],T[t+2]); } }
  /* the rim: a dark lip closing the shell over the neck (the padding) */
  { const ph0=g.n; for(let k=0;k<nlon;k++){ const o=(base+k)*3; g.vert([g.P[o],g.P[o+1],g.P[o+2]],COL.dark,sk,[2,0,0]); } const ci=g.vert([HC[0]-0.012,HC[1]-0.120,0],COL.dark,sk,[2,0,0]);
    for(let k=0;k<nlon;k++) g.I.push(ph0+k,ph0+(k+1)%nlon,ci); { const n0=g.I.length-nlon*3, P=g.P, a=g.I[n0]*3, b=g.I[n0+1]*3, cc=g.I[n0+2]*3; const ny=(P[b+2]-P[a+2])*(P[cc]-P[a])-(P[b]-P[a])*(P[cc+2]-P[a+2]); if(ny>0) for(let t=n0;t<g.I.length;t+=3){ const s2=g.I[t+1]; g.I[t+1]=g.I[t+2]; g.I[t+2]=s2; } } }
  /* the chin bar: rings round a horizontal arc that wraps the face, juts forward into a beak; a dark vent at its front */
  { g.part=hi?PART.CHIN:PART.SHELL; const nr=hi?(LITE?11:15):5, seg=hi?(LITE?8:10):5, rows=[], spine=f=>{ const cf=Math.cos(f), beak=Math.pow(Math.max(0,cf),6), Rx=0.150+0.042*beak; return [0.028+Rx*cf,0.652+0.024*(1-cf)-0.012*beak,0.114*Math.sin(f),beak]; };
    for(let j=0;j<nr;j++){ const f=-1.70+3.40*j/(nr-1), P0=spine(f), Pa=spine(f-0.01), Pb=spine(f+0.01);
      let nx=Pb[2]-Pa[2], nz=-(Pb[0]-Pa[0]); const nl=Math.hypot(nx,nz)||1; nx/=nl; nz/=nl; if(nx*(P0[0]-0.028)+nz*P0[2]<0){ nx=-nx; nz=-nz; }
      const vent=Math.abs(f)<0.22;   /* (a narrow vent: a wide black one read as a robot's mouth) */
      rows.push(ring([P0[0],P0[1],P0[2]],0.020,0.037+0.010*P0[3],{u:[nx,0,nz],v:Y,n:2.6,bones:[H,H,0],col:a=>(vent&&Math.cos(a)>0.5&&Math.abs(Math.sin(a))<0.45)?COL.mid:K1,slot:a=>(vent&&Math.cos(a)>0.5&&Math.abs(Math.sin(a))<0.45)?2:0,mud:0.45})); }
    loft(g,rows,seg,"tb"); }
  /* the visor: grows out of the brow (on the shell) and runs back along the temples; a top sheet (team colour), a dark underside, a rim */
  { g.part=PART.TRIM; const nu=hi?(LITE?4:6):2, nv=hi?(LITE?8:10):4, W=nv+1, p0=g.n;
    for(let side=0;side<2;side++){ const off=side?0.0042:-0.0042;
      for(let i=0;i<=nu;i++){ const u=i/nu; for(let j=0;j<=nv;j++){ const v=-1+2*j/nv, ph=v*1.10, th=0.40, dx=Math.cos(th)*Math.cos(ph), dy=Math.sin(th), dz=Math.cos(th)*Math.sin(ph);
        shellPt(dx,dy,dz,SP); const ax=SP[0]+0.004*dx, ay=SP[1]+0.004*dy, az=SP[2]+0.004*dz;
        const tx=0.290-0.168*v*v, ty=0.823-0.014*v*v, tz=v*0.119;
        const x=ax+(tx-ax)*u, y=ay+(ty-ay)*u+0.011*Math.sin(Math.PI*u)*(1-0.6*v*v)+0.005*(1-Math.abs(v))*(1-Math.abs(v))*u, z=az+(tz-az)*u;
        g.vert([x,y+off,z],side?K1:COL.dark,sk,[side?0:2,0,0]); } } }
    const idx=(s2,i,j)=>p0+s2*(nu+1)*W+i*W+j;
    for(let s2=0;s2<2;s2++) for(let i=0;i<nu;i++) for(let j=0;j<nv;j++){ const a=idx(s2,i,j), b=idx(s2,i,j+1), cc=idx(s2,i+1,j), d=idx(s2,i+1,j+1);
      const P=g.P, ux=P[b*3]-P[a*3], uy=P[b*3+1]-P[a*3+1], uz=P[b*3+2]-P[a*3+2], vx=P[cc*3]-P[a*3], vy=P[cc*3+1]-P[a*3+1], vz=P[cc*3+2]-P[a*3+2], ny=uz*vx-ux*vz;
      if((ny>0)===(s2===1)) g.I.push(a,b,cc,b,d,cc); else g.I.push(a,cc,b,b,cc,d); }
    const rimA=[], rimB=[]; for(let j=0;j<=nv;j++){ const a=idx(0,nu,j), b=idx(1,nu,j); rimA.push([g.P[a*3],g.P[a*3+1],g.P[a*3+2]]); rimB.push([g.P[b*3],g.P[b*3+1],g.P[b*3+2]]); }
    band(g,rimA,rimB,false,[0.55,0.55,0.55],2,sk,(m,n)=>n[0]*(m[0]-0.05)+n[2]*m[2]>0); }
  if(!hi) return;
  /* the goggles: a thick frame wrapped round the face (a nose cut at the bottom), the lens a little behind its face, the strap round the shell */
  { const N=LITE?20:28, gy=0.750, loop=(sw,sh,dx)=>{ const pts=[]; for(let k=0;k<N;k++){ const a=k/N*Math.PI*2, ca=Math.cos(a), sa=Math.sin(a), e=2/3.6;
        const z=sw*Math.sign(ca)*Math.pow(Math.abs(ca),e); let y=gy+sh*Math.sign(sa)*Math.pow(Math.abs(sa),e); if(sa<0) y+=sh*0.38*Math.pow(1-Math.abs(ca),3)*(-sa);
        pts.push([0.151-1.50*z*z+dx,y,z]); } return pts; };
    const C0=[0.151,gy,0], outF=loop(0.101,0.044,0.013), inF=loop(0.084,0.031,0.013), outB=loop(0.107,0.048,-0.014), inB=loop(0.084,0.031,0.006);
    g.part=PART.FRAME;
    band(g,outF,inF,true,K1,1,sk,(m,n)=>n[0]>0);                                                                   /* the frame's face */
    band(g,outB,outF,true,K1,1,sk,(m,n)=>n[1]*(m[1]-C0[1])+n[2]*m[2]>0);                                            /* its outer wall */
    band(g,inF,inB,true,COL.dark,2,sk,(m,n)=>n[1]*(m[1]-C0[1])+n[2]*m[2]<0);                                        /* the inner lip */
    g.part=PART.LENS;
    { const ci=g.vert([0.151+0.010,gy+0.002,0],COL.lens,sk,[2,0,0]), ids=inB.map(p=>g.vert([p[0]+0.001,p[1],p[2]],COL.lens,sk,[2,0,0]));
      for(let k=0;k<N;k++){ const a=ids[k], b=ids[(k+1)%N]; const P=g.P, uy=P[b*3+1]-P[a*3+1], uz=P[b*3+2]-P[a*3+2], vy=P[ci*3+1]-P[a*3+1], vz=P[ci*3+2]-P[a*3+2];
        if(uy*vz-uz*vy>0) g.I.push(a,b,ci); else g.I.push(a,ci,b); } }
    /* the strap: a band 4 cm wide round the back of the shell at the goggles' height, 3.5 mm proud of it */
    g.part=PART.STRAP;
    const M2=LITE?20:30, row=yy=>{ const pts=[]; for(let k=0;k<=M2;k++){ const ph=0.62+(Math.PI*2-1.24)*k/M2; let th=Math.asin(Math.max(-0.9,Math.min(0.9,(yy-HC[1])/0.145)));
        for(let it=0;it<4;it++){ shellPt(Math.cos(th)*Math.cos(ph),Math.sin(th),Math.cos(th)*Math.sin(ph),SP); th+=(yy-SP[1])/0.145; }
        const dx=SP[0]-HC[0], dy=SP[1]-HC[1], dz=SP[2]-HC[2], l=Math.hypot(dx,dy,dz)||1; pts.push([SP[0]+dx/l*0.0035,SP[1]+dy/l*0.0035,SP[2]+dz/l*0.0035]); } return pts; };
    band(g,row(gy-0.019),row(gy+0.021),false,K1,1,sk,(m,n)=>n[0]*(m[0]-HC[0])+n[1]*(m[1]-HC[1])+n[2]*m[2]>0); }
}
/* the number patch on the jersey's back: a curved grid 0.30 x 0.30 m laid 7 mm above the jersey; u runs to the rider's right, v up (the atlas cell: the name over the number) */
function addBack(g,hi){
  const nu=hi?8:4, nv=hi?7:3, w=0.150, y0=0.170, y1=0.470; const P0=g.n;   /* (milestone 2: 30 x 30 cm: the name across the shoulders, the number under it) */
  for(let j=0;j<=nv;j++){ const y=y0+(y1-y0)*j/nv, t=torsoAt(y), sk=skinY(y,SK_TORSO);
    for(let i=0;i<=nu;i++){ const z=-w+2*w*i/nu, e=Math.sqrt(Math.max(0.02,1-(z/t.rz)*(z/t.rz))); const x=t.cx-t.rx*e-0.007;
      const p=g.P; g.vert([x,y,z],K1,[sk[0],sk[1],1-sk[2],sk[2]],[2,0,0]); g.UV=g.UV||[]; g.UV.push(i/nu,j/nv); } }
  for(let j=0;j<nv;j++) for(let i=0;i<nu;i++){ const a=P0+j*(nu+1)+i, b=a+1, c=a+(nu+1), d=c+1; g.I.push(a,b,c,b,d,c); }
  /* the faces point back (-x) */
  { const P=g.P, a=g.I[0]*3, b=g.I[1]*3, c=g.I[2]*3, nx=(P[b+1]-P[a+1])*(P[c+2]-P[a+2])-(P[b+2]-P[a+2])*(P[c+1]-P[a+1]); if(nx>0) for(let t=0;t<g.I.length;t+=3){ const s=g.I[t+1]; g.I[t+1]=g.I[t+2]; g.I[t+2]=s; } }
}

/* ---------------- the whole rider ---------------- */
/* detail 1: the near rider (own helmet mesh, buckles, folds); 0: the far pack (one mesh, thin rings). Returns the geometries and the triangle counts */
/* lite (milestone 2): the near rider of the FIRE TV tier / Reduce effects: the same shapes with fewer segments (about 3,900 triangles, the old near rider's cost) */
export function buildRider(detail,lite){
  const hi=detail>0, seg=hi?(lite?16:20):6, lo=!hi, body=new GB(), ls=hi?(lite?10:12):5;
  LITE=!!lite&&hi;
  addTorso(body,seg,lo); addNeck(body,seg,lo); addArm(body,-1,ls,lo); addArm(body,1,ls,lo); addLeg(body,-1,hi?ls:6,lo); addLeg(body,1,hi?ls:6,lo);
  let helmet=null;
  if(hi){ const h=new GB(); addHelmet(h,true); helmet=h.geometry(); } else addHelmet(body,false);
  LITE=false;
  const gb=body.geometry();
  const b=new GB(); addBack(b,hi); const back=b.geometry(); back.setAttribute("uv",new THREE.BufferAttribute(new Float32Array(b.UV),2));
  return {body:gb,helmet:helmet,back:back,tris:{body:gb.index.count/3,helmet:helmet?helmet.index.count/3:0,back:back.index.count/3}};
}
