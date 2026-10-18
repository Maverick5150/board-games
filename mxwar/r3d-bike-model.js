/* MOTOCROSS WAR 3D — THE BIKE'S MODEL (owner: bike): a modern 450 cc four-stroke Supercross bike built in code (an ORIGINAL design: no brand shapes, no
   logos), at three levels of detail. Pure geometry: no materials, no textures, no scene (r3d-bike.js makes those).
   Bike local axes: +X forward, +Y up, +Z right (the exhaust and the brake discs are on the right, the chain on the left). Metres.
   A part is a THREE.BufferGeometry added to a Builder with a matrix and a material record {c (linear rgb), mt (metalness), rg (roughness), tint (0 fixed
   colour, 1 team colour, 2 accent colour), ao}; the Builder writes one indexed BufferGeometry with position, normal, color, uv and aMat = (metalness,
   roughness, tint, ambient occlusion). One shader (r3d-bike.js) turns those into physically based plastics, anodized metal, rubber and chrome.
   buildBike(d) -> { body, steer, fork, swing, shock, wheelF, wheelR } for d = 2 (close), 1 (mid); buildFar() -> one static geometry (far).
   The moving groups (poseBike in r3d-bike.js): body (the frame, engine, bodywork, exhaust: the chassis matrix), steer (bars, triple clamps, upper fork tubes, the
   front plate's bracket: turns about the steering axis), fork (lower legs, front fender, caliper: steer + slides up the fork), swing (swingarm, chain,
   rear brake, linkage: pivots, built relative to the pivot with the arm along -X), shock (a unit-length bone along +Y, stretched between its mounts),
   wheelF / wheelR (tyre with real knobs, rim, spokes, hub, disc, sprocket: built round the axle, spin about +Z). */
import * as THREE_NS from "../ui/vendor/three-0.160.0.module.min.js";
const THREE=THREE_NS;
import {lin} from "./r3d-util.js";

const PI=Math.PI, TAU=PI*2;
const V=(x,y,z)=>new THREE.Vector3(x,y,z);
const clamp=(x,a,b)=>x<a?a:x>b?b:x, sstep=(a,b,x)=>{ const t=clamp((x-a)/(b-a),0,1); return t*t*(3-2*t); };
const spow=(x,p)=>Math.sign(x)*Math.pow(Math.abs(x),p);

/* ---------------- the numbers of the bike ---------------- */
const WB=1.48, WR=0.34, RAKE=27*PI/180;
const UA=V(-Math.sin(RAKE),Math.cos(RAKE),0), NF=V(Math.cos(RAKE),Math.sin(RAKE),0);   /* up the fork / forward, square to it */
const FA=V(0.74,WR,0), RA=V(-0.74,WR,0), A0=FA.clone().addScaledVector(NF,-0.022);       /* the steering axis passes the axle's foot point, 22 mm behind the fork line */
const axisPt=s=>A0.clone().addScaledVector(UA,s);                                        /* a point on the steering axis, s metres up from the axle's height */
const forkPt=s=>FA.clone().addScaledVector(UA,s);                                         /* a point on the fork tubes' line, s up from the axle */
const PIVOT=V(-0.17,0.44,0), ARM=Math.hypot(RA.x-PIVOT.x,RA.y-PIVOT.y);
export const BIKE={WB:WB,WR:WR,FA:FA,RA:RA,HEAD:axisPt(0.745),PIVOT:PIVOT,GRIP:V(0.40,1.12,0.37),PEG:V(-0.07,0.43,0.21),TRAVEL:0.30,SAG:0.10,
  /* the rig the rider and the pose read: */
  RAKE:RAKE,UP:UA,FWD:NF,STEER_PT:A0,ARM:ARM,SEAT:V(-0.20,0.958,0),KNEE:V(0.14,0.84,0.15),
  SHOCK_TOP:V(-0.25,0.84,0),SHOCK_BOT:V(-0.20,0.352,0),SHOCK_STROKE:0.11,STEER_MAX:0.34,CHAIN_SPROCKET:V(-0.255,0.46,0)};
export {axisPt,forkPt,UA,NF,A0};

/* ---------------- the material records ---------------- */
/* tint: 0 fixed colour, 1 team colour (the livery and the side-panel number decal apply), 2 accent colour, 3 team colour seen from above (the fenders: the top livery).
   kind (milestone 2): 0 plain, 1 spoke (dithers away and leaves the blur disc when the wheel turns fast), 2 tyre (the sidewall's moulded marks, dirt packed between the knobs),
   3 solid team colour with no graphics (handguards, louvre fins), 4 skid plate / under-side parts (they take the mud first), 5 the seat cover (gripper ribs), 6 the front number plate's face (the rider's number from the side-panel atlas). Packed into aMat.z = tint + 4 * kind + 32 * (a wheel or shock part). */
const K=(hex,mt,rg,tint,ao,kind)=>({c:lin(hex),mt:mt,rg:rg,tint:tint||0,ao:ao==null?1:ao,kind:kind||0});
export const MAT={
  alu:K("#bcbfc7",0.92,0.34), aluD:K("#80848c",0.88,0.40), aluB:K("#d3d6dc",0.95,0.26),
  caseM:K("#363940",0.70,0.50), cover:K("#a2a6ae",0.88,0.40), cyl:K("#202127",0.55,0.50), head:K("#4a4c54",0.75,0.42),
  steel:K("#9a9da5",0.92,0.34), exh:K("#bdb7aa",0.93,0.28), muff:K("#cdced4",0.94,0.26), cap:K("#18191c",0.35,0.42),
  black:K("#111215",0.25,0.55), blackM:K("#0d0e10",0.0,0.82), seat:K("#0b0b0d",0.0,0.80,0,1,5), rubber:K("#0c0c0e",0.0,0.90), tread:K("#101012",0.0,0.88,0,1,2), side:K("#17171a",0.0,0.84),
  gold:K("#d8b050",0.94,0.26), upper:K("#dde0e6",1.0,0.12), anod:K("#17181c",0.85,0.38), anodG:K("#2a2c33",0.85,0.36),
  rim:K("#c8cbd2",0.93,0.30), hub:K("#d8b050",0.92,0.28), spoke:K("#a9acb4",0.90,0.34,0,1,1), disc:K("#b4b8c0",0.92,0.30), discD:K("#4b4d54",0.8,0.45),
  plastic:{c:[1,1,1],mt:0.0,rg:0.17,tint:1,ao:1,kind:0}, accent:{c:[1,1,1],mt:0.0,rg:0.26,tint:2,ao:1,kind:0}, grip:K("#1a1a1d",0.0,0.85), lever:K("#b6b9c0",0.9,0.35), bolt:K("#8c8f97",0.9,0.4),
  spring:{c:[1,1,1],mt:0.55,rg:0.35,tint:2,ao:1,kind:0}, shockB:K("#17181c",0.8,0.38), chain:K("#8a8272",0.85,0.42), rad:K("#4a4d55",0.75,0.5), slit:K("#050506",0.0,0.9),
  /* milestone 2 */
  guard:{c:[1,1,1],mt:0.0,rg:0.22,tint:1,ao:1,kind:3}, hose:K("#0f0f11",0.0,0.58), cable:K("#0c0c0e",0.0,0.46), skid:K("#141518",0.05,0.48,0,1,4),
  plateK:K("#1a1a1e",0.0,0.40), plateF:{c:[1,1,1],mt:0.0,rg:0.22,tint:1,ao:1,kind:6}, link:K("#7d7a74",0.88,0.40), linkD:K("#3a3936",0.8,0.5), blurFar:K("#5c5f66",0.55,0.55), outlet:K("#08080a",0.2,0.7)
};

/* ---------------- the builder ---------------- */
const _v=new THREE.Vector3(), _n=new THREE.Vector3(), _nm=new THREE.Matrix3(), _I=new THREE.Matrix4();
export function Builder(){ this.P=[]; this.N=[]; this.C=[]; this.U=[]; this.A=[]; this.I=[]; }
Builder.prototype.add=function(g,o){
  o=o||{}; const pa=g.attributes.position, na=g.attributes.normal, cnt=pa.count, base=this.P.length/3, m=o.m||_I, flip=m.determinant()<0;
  _nm.getNormalMatrix(m);
  const c=o.c||[1,1,1], mt=o.mt==null?0:o.mt, rg=o.rg==null?0.5:o.rg, tn=(o.tint||0)+4*(o.kind||0)+(o.noGrad?32:0), ao0=o.ao==null?1:o.ao, uvm=o.uv||"side", grad=!o.noGrad;
  for(let i=0;i<cnt;i++){
    _v.fromBufferAttribute(pa,i).applyMatrix4(m); _n.fromBufferAttribute(na,i).applyMatrix3(_nm).normalize();
    this.P.push(_v.x,_v.y,_v.z); this.N.push(_n.x,_n.y,_n.z); this.C.push(c[0],c[1],c[2]);
    if(uvm==="side") this.U.push((_v.x+1.2)/2.4,0.5+0.5*clamp((_v.y-0.45)/0.75,0,1));
    else if(uvm==="top") this.U.push((_v.x+1.2)/2.4,0.5*clamp(0.5+_v.z*2.6,0,1));
    else this.U.push(0,0);
    this.A.push(mt,rg,tn,ao0*(grad?0.62+0.38*sstep(0.18,0.85,_v.y):1));
  }
  const ix=g.index;
  if(ix){ for(let i=0;i<ix.count;i+=3){ const a=ix.getX(i)+base, b=ix.getX(i+1)+base, d=ix.getX(i+2)+base; if(flip) this.I.push(a,d,b); else this.I.push(a,b,d); } }
  else for(let i=0;i<cnt;i+=3){ const a=base+i; if(flip) this.I.push(a,a+2,a+1); else this.I.push(a,a+1,a+2); }
  return this;
};
Builder.prototype.mark=function(name){ (this.marks||(this.marks=[])).push([name,this.I.length/3]); return this; };
Builder.prototype.addM=function(g,o){ /* the part and its mirror image (the left side), for parts built on the right (z > 0) */
  this.add(g,o); const m=new THREE.Matrix4().makeScale(1,1,-1); if(o&&o.m) m.multiply(o.m); this.add(g,Object.assign({},o,{m:m})); return this; };
Builder.prototype.geometry=function(){
  const g=new THREE.BufferGeometry(); if(this.marks) g.userData.marks=this.marks;
  g.setAttribute("position",new THREE.Float32BufferAttribute(this.P,3)); g.setAttribute("normal",new THREE.Float32BufferAttribute(this.N,3));
  g.setAttribute("color",new THREE.Float32BufferAttribute(this.C,3)); g.setAttribute("uv",new THREE.Float32BufferAttribute(this.U,2));
  g.setAttribute("aMat",new THREE.Float32BufferAttribute(this.A,4)); g.setIndex(this.P.length/3>65535?new THREE.Uint32BufferAttribute(this.I,1):new THREE.Uint16BufferAttribute(this.I,1));
  return g;
};
const withMat=(mat,extra)=>Object.assign({},mat,extra||{});
const Tm=(x,y,z,rx,ry,rz,sx,sy,sz)=>new THREE.Matrix4().compose(V(x||0,y||0,z||0),new THREE.Quaternion().setFromEuler(new THREE.Euler(rx||0,ry||0,rz||0)),V(sx==null?1:sx,sy==null?1:sy,sz==null?1:sz));
const fromAxis=(p,dirV,len)=>{ /* a matrix that puts a +Y cylinder of length len with its base at p along dirV */
  const q=new THREE.Quaternion().setFromUnitVectors(V(0,1,0),dirV.clone().normalize()); return new THREE.Matrix4().compose(p,q,V(1,1,1)); };

/* ---------------- shape makers (indexed, smooth normals) ---------------- */
function makeGeo(P,I,N,U){
  const g=new THREE.BufferGeometry(); g.setAttribute("position",new THREE.Float32BufferAttribute(P,3));
  g.setIndex(I); if(N) g.setAttribute("normal",new THREE.Float32BufferAttribute(N,3)); else g.computeVertexNormals();
  return g;
}
/* make the shell point outward: a closed shell's signed volume must be positive */
function orient(P,I){
  let vol=0; for(let i=0;i<I.length;i+=3){ const a=I[i]*3,b=I[i+1]*3,c=I[i+2]*3;
    vol+=P[a]*(P[b+1]*P[c+2]-P[b+2]*P[c+1])-P[a+1]*(P[b]*P[c+2]-P[b+2]*P[c])+P[a+2]*(P[b]*P[c+1]-P[b+1]*P[c]); }
  if(vol<0) for(let i=0;i<I.length;i+=3){ const t=I[i+1]; I[i+1]=I[i+2]; I[i+2]=t; }
}
/* a tube along a Catmull-Rom path; rad = a number, a function of t (0..1) returning r or [rN, rB] (an ellipse) */
export function sweep(pts,rad,seg,o){
  o=o||{}; const curve=new THREE.CatmullRomCurve3(pts,false,"centripetal"), ns=o.ns||Math.max(4,(pts.length-1)*(o.per||4));
  const fr=curve.computeFrenetFrames(ns,false), rr=typeof rad==="function"?rad:(()=>rad), P=[], I=[];
  for(let i=0;i<=ns;i++){ const t=i/ns, p=curve.getPointAt(t), r=rr(t), ra=Array.isArray(r)?r[0]:r, rb=Array.isArray(r)?r[1]:r, nn=fr.normals[i], bb=fr.binormals[i];
    for(let j=0;j<seg;j++){ const a=j/seg*TAU, c=Math.cos(a), s=Math.sin(a); P.push(p.x+nn.x*c*ra+bb.x*s*rb,p.y+nn.y*c*ra+bb.y*s*rb,p.z+nn.z*c*ra+bb.z*s*rb); } }
  for(let i=0;i<ns;i++) for(let j=0;j<seg;j++){ const a=i*seg+j, b=i*seg+(j+1)%seg, c=(i+1)*seg+j, d=(i+1)*seg+(j+1)%seg; I.push(a,b,c,b,d,c); }
  let cap0=-1;
  if(o.caps){ for(const e of [0,ns]){ const p=curve.getPointAt(e/ns), ci=P.length/3; P.push(p.x,p.y,p.z); const r0=rr(e/ns), ra=Array.isArray(r0)?r0[0]:r0, rb=Array.isArray(r0)?r0[1]:r0; const nn=fr.normals[e], bb=fr.binormals[e];
      const rb0=P.length/3; for(let j=0;j<seg;j++){ const a=j/seg*TAU; P.push(p.x+nn.x*Math.cos(a)*ra+bb.x*Math.sin(a)*rb,p.y+nn.y*Math.cos(a)*ra+bb.y*Math.sin(a)*rb,p.z+nn.z*Math.cos(a)*ra+bb.z*Math.sin(a)*rb); }
      for(let j=0;j<seg;j++){ const a=rb0+j, b=rb0+(j+1)%seg; if(e===0) I.push(ci,b,a); else I.push(ci,a,b); } } }
  orient(P,I); return makeGeo(P,I);
}
/* a loft through closed sections (arrays of Vector3 of equal length), ends capped by fans */
export function loft(secs,o){
  o=o||{}; const ns=secs.length, nj=secs[0].length, P=[], I=[];
  secs.forEach(s=>s.forEach(p=>P.push(p.x,p.y,p.z)));
  for(let i=0;i<ns-1;i++) for(let j=0;j<nj;j++){ const a=i*nj+j, b=i*nj+(j+1)%nj, c=(i+1)*nj+j, d=(i+1)*nj+(j+1)%nj; I.push(a,b,c,b,d,c); }
  const base=P.length/3;
  if(o.caps!==false){ for(const e of [0,ns-1]){ const s=secs[e], cx=s.reduce((q,p)=>q+p.x,0)/nj, cy=s.reduce((q,p)=>q+p.y,0)/nj, cz=s.reduce((q,p)=>q+p.z,0)/nj, ci=P.length/3; P.push(cx,cy,cz);
      const r0=P.length/3; s.forEach(p=>P.push(p.x,p.y,p.z)); for(let j=0;j<nj;j++){ const a=r0+j, b=r0+(j+1)%nj; if(e===0) I.push(ci,b,a); else I.push(ci,a,b); } } }
  orient(P,I);
  return makeGeo(P,I);
}
/* section helpers: a closed loop in the (z, y) plane at station x */
export function superSec(x,cz,cy,hw,hh,e,n){ const s=[]; for(let k=0;k<n;k++){ const a=k/n*TAU; s.push(V(x,cy+hh*spow(Math.sin(a),2/e),cz+hw*spow(Math.cos(a),2/e))); } return s; }
/* a loop from a half outline [z, y] (right side, top to bottom) mirrored to the left */
export function mirrorSec(x,half,dz){ const s=[]; half.forEach(p=>s.push(V(x,p[1],(dz||0)+p[0]))); for(let k=half.length-1;k>=1;k--) s.push(V(x,half[k][1],(dz||0)-half[k][0])); return s; }
/* sections resampled through a Catmull-Rom: sub extra stations between each pair */
export function smoothSecs(secs,sub){
  if(sub<=1) return secs; const nj=secs[0].length, curves=[]; for(let j=0;j<nj;j++) curves.push(new THREE.CatmullRomCurve3(secs.map(s=>s[j]),false,"centripetal"));
  const out=[], ns=(secs.length-1)*sub; for(let i=0;i<=ns;i++){ const t=i/ns; out.push(curves.map(c=>c.getPoint(t))); } return out;
}
/* a superellipsoid blob: radii rx, ry, rz, squareness e (2 = ellipsoid, 4 = pillow); its long axis is X */
export function blob(rx,ry,rz,e,nu,nv){
  const P=[], I=[]; e=e||2.5; nu=nu||8; nv=nv||12;
  for(let i=0;i<=nu;i++){ const f=-PI/2+PI*i/nu, cr=spow(Math.cos(f),2/e), sx=spow(Math.sin(f),2/e);
    for(let j=0;j<nv;j++){ const t=j/nv*TAU; P.push(rx*sx,ry*cr*spow(Math.sin(t),2/e),rz*cr*spow(Math.cos(t),2/e)); } }
  for(let i=0;i<nu;i++) for(let j=0;j<nv;j++){ const a=i*nv+j, b=i*nv+(j+1)%nv, c=(i+1)*nv+j, d=(i+1)*nv+(j+1)%nv; I.push(a,b,c,b,d,c); }
  orient(P,I); return makeGeo(P,I);
}
const cyl=(r0,r1,h,seg,open)=>new THREE.CylinderGeometry(r1,r0,h,seg||8,1,!!open);   /* r0 at the bottom (y 0), r1 at the top; y centred */
/* a cylinder from point a to point b (radius r0 at a, r1 at b) as a geometry already in place */
function rod(a,b,r0,r1,seg,open){ const d=b.clone().sub(a), len=d.length(), g=cyl(r0,r1,len,seg,open); g.translate(0,len/2,0); g.applyMatrix4(fromAxis(a,d)); return g; }
/* a lathe round +Y from [radius, y] points */
const lathe=(pts,seg)=>new THREE.LatheGeometry(pts.map(p=>new THREE.Vector2(Math.max(p[0],1e-4),p[1])),seg||16);
const Zaxis=Tm(0,0,0,PI/2,0,0);                                 /* a lathe's +Y axis becomes +Z (the wheel's axle) */

/* ---------------- wheels ---------------- */
/* the tyre's cross section (radius, half width) from the bead to the crown, one side; the knobs stand on it */
const TYRE_F={bead:[[0.2685,0.0235],[0.2755,0.0300],[0.289,0.0385],[0.305,0.0420],[0.317,0.0350],[0.3225,0.0190],[0.3245,0.0]], knobH:0.0155, w:0.041, name:"front"};
const TYRE_R={bead:[[0.2430,0.0285],[0.2535,0.0345],[0.268,0.0525],[0.286,0.0585],[0.304,0.0540],[0.318,0.0400],[0.3225,0.0200],[0.3235,0.0]], knobH:0.0165, w:0.0585, name:"rear"};
function tyreGeo(ty,seg,d){
  const bd=d>=2?ty.bead:ty.bead.filter((p,i)=>i%2===0||i===ty.bead.length-1);
  const pts=[]; bd.forEach(p=>pts.push([p[0],-p[1]])); for(let i=bd.length-2;i>=0;i--) pts.push([bd[i][0],bd[i][1]]);
  /* a lathe wants increasing "y" (here: z) for outward normals: build from -z to +z */
  const g=lathe(pts.map(p=>[p[0],p[1]]),seg); g.applyMatrix4(Zaxis); return g;
}
/* the knobs: truncated pyramids standing on the crown. rows = [z of the row, angular offset in steps]; hl, hw = half length and half width at the base */
function crownAt(ty,z){ z=Math.abs(z); const b=ty.bead; for(let i=b.length-1;i>=1;i--){ if(z<=b[i-1][1]+1e-9){ const z0=b[i][1], z1=b[i-1][1], t=z1===z0?0:(z-z0)/(z1-z0); return b[i][0]+(b[i-1][0]-b[i][0])*clamp(t,0,1); } } return b[0][0]; }
function addKnobs(B,ty,N,rows,mat,hl,hw,lite){
  const sl=[-1,1,1,-1], sw=[-1,-1,1,1];
  for(let k=0;k<N;k++) rows.forEach(r=>{
    const thc=(k+r[1])/N*TAU, zc=r[0], P=[], I=[], base=[], top=[];
    for(let q=0;q<4;q++){
      const zb=zc+sw[q]*hw, tb=thc+sl[q]*hl/0.33, zt=zc+sw[q]*hw*0.74, tt=thc+sl[q]*hl*0.74/0.33, rb=crownAt(ty,zb)-0.002, rt=WR-zt*zt/0.30;
      base.push(V(Math.cos(tb)*rb,Math.sin(tb)*rb,zb)); top.push(V(Math.cos(tt)*rt,Math.sin(tt)*rt,zt)); }
    const faces=[[top[0],top[1],top[2],top[3]],[base[0],base[1],top[1],top[0]],[base[1],base[2],top[2],top[1]],[base[2],base[3],top[3],top[2]],[base[3],base[0],top[0],top[3]]];
    const fl=lite?[faces[0],faces[1],faces[3]]:faces;
    const mid=V(0,0,0); base.concat(top).forEach(p=>mid.add(p)); mid.multiplyScalar(1/8);
    fl.forEach(f=>{ const b0=P.length/3; f.forEach(p=>P.push(p.x,p.y,p.z));
      /* point the face away from the knob's middle */
      const e1=f[1].clone().sub(f[0]), e2=f[2].clone().sub(f[0]), nrm=e1.cross(e2), c=f[0].clone().add(f[2]).multiplyScalar(0.5).sub(mid);
      if(nrm.dot(c)>=0) I.push(b0,b0+1,b0+2,b0,b0+2,b0+3); else I.push(b0,b0+2,b0+1,b0,b0+3,b0+2); });
    B.add(makeGeo(P,I),withMat(mat,{uv:"none",noGrad:true}));
  });
}
function wheelBuild(d,rear){
  const B=new Builder(), ty=rear?TYRE_R:TYRE_F, seg=d>=2?36:d===1?18:12, nk=rear?24:26;
  /* tyre carcass */
  B.add(tyreGeo(ty,seg,d),withMat(MAT.tread,{uv:"none",noGrad:true}));
  /* knobs: centre, mid and shoulder rows, staggered */
  if(d>=2){ const zs=rear?[0.0185,0.039]:[0.0135,0.030];
    addKnobs(B,ty,nk,[[0,0,0],[zs[0],0.5,0.12],[-zs[0],0.5,-0.12],[zs[1],0.0,0.45],[-zs[1],0.0,-0.45]],MAT.tread,rear?0.0155:0.014,rear?0.0105:0.0095); }
  else if(d===1){ const zs=rear?0.030:0.024; addKnobs(B,ty,rear?18:20,[[0,0,0],[zs,0.5,0.25],[-zs,0.5,-0.25]],MAT.tread,rear?0.019:0.017,rear?0.0135:0.0125,true); }
  /* the rim: bead seat, lips, barrel */
  const rb=rear?0.2413:0.2667, rl=rear?0.2535:0.2755, rw=rear?0.0273:0.0203, ri=rb-0.012;
  const rimPts=d>=2?[[ri,-rw],[rl,-rw],[rl,-rw+0.0045],[rb,-rw+0.011],[rb,rw-0.011],[rl,rw-0.0045],[rl,rw],[ri,rw]]:[[rl,-rw],[rb,-rw+0.011],[rb,rw-0.011],[rl,rw]]; const rim=lathe(rimPts,seg); rim.applyMatrix4(Zaxis); B.add(rim,withMat(MAT.rim,{uv:"none",noGrad:true}));
  /* hub: shell, flanges, end caps */
  const hubW=rear?0.052:0.044, hubPts=[[0.012,-hubW-0.016],[0.026,-hubW-0.016],[0.026,-hubW],[0.050,-hubW],[0.050,-hubW+0.007],[0.030,-hubW+0.012],[0.030,hubW-0.012],[0.050,hubW-0.007],[0.050,hubW],[0.026,hubW],[0.026,hubW+0.016],[0.012,hubW+0.016]];
  const hub=lathe(d>=2?hubPts:[[0.012,-hubW-0.016],[0.050,-hubW],[0.030,-hubW+0.012],[0.030,hubW-0.012],[0.050,hubW],[0.012,hubW+0.016]],d>=2?16:8); hub.applyMatrix4(Zaxis); B.add(hub,withMat(MAT.hub,{uv:"none",noGrad:true}));
  /* spokes: 36 laced in two sets (d2), 16 (d1) */
  const nsp=d>=2?18:d===1?6:0;
  for(let k=0;k<nsp;k++) for(const sd of [-1,1]){ const th=k/nsp*TAU+(sd>0?PI/nsp:0), off=(sd>0?1:-1)*0.5, a=V(Math.cos(th)*0.046,Math.sin(th)*0.046,sd*hubW*0.9), th2=th+off*0.62, b=V(Math.cos(th2)*(ri-0.003),Math.sin(th2)*(ri-0.003),sd*rw*0.35);
    B.add(rod(a,b,0.0016,0.0016,d>=2?3:3,true),withMat(MAT.spoke,{uv:"none",noGrad:true})); }
  /* brake disc (right, +z): wave rotor and its carrier; the rear has the sprocket on the left */
  if(d>=1){ const R=rear?0.119:0.133, zd=rear?0.052:0.047, ring=[]; const nw=d>=2?48:16, P=[], I=[];
    for(let i=0;i<nw;i++){ const t=i/nw*TAU, ro=R+0.0045*Math.cos(t*(rear?10:12)); P.push(Math.cos(t)*ro,Math.sin(t)*ro,zd+0.0025,Math.cos(t)*(R-0.030),Math.sin(t)*(R-0.030),zd+0.0025,Math.cos(t)*ro,Math.sin(t)*ro,zd-0.0025,Math.cos(t)*(R-0.030),Math.sin(t)*(R-0.030),zd-0.0025); }
    for(let i=0;i<nw;i++){ const j=(i+1)%nw, a=i*4, b=j*4; I.push(a,b,a+1,b,b+1,a+1, a+2,a+3,b+2,b+2,a+3,b+3, a,a+2,b,b,a+2,b+2, a+1,b+1,a+3,b+1,b+3,a+3); }
    orient(P,I); B.add(makeGeo(P,I),withMat(MAT.disc,{uv:"none",noGrad:true}));
    if(d>=2){ const car=lathe([[0.03,zd-0.004],[R-0.028,zd-0.004],[R-0.028,zd+0.004],[0.03,zd+0.004]],24); car.applyMatrix4(Zaxis); B.add(car,withMat(MAT.discD,{uv:"none",noGrad:true})); }
    if(rear){ /* the sprocket (left): a toothed ring on a carrier */
      const nt=d>=2?36:14, ro=0.1005, ri2=0.0955, zS=-0.056, SP=[], SI=[];
      for(let i=0;i<nt*2;i++){ const t=i/(nt*2)*TAU, r=(i%2?ri2:ro); SP.push(Math.cos(t)*r,Math.sin(t)*r,zS+0.0035,Math.cos(t)*0.07,Math.sin(t)*0.07,zS+0.0035,Math.cos(t)*r,Math.sin(t)*r,zS-0.0035,Math.cos(t)*0.07,Math.sin(t)*0.07,zS-0.0035); }
      const nn=nt*2; for(let i=0;i<nn;i++){ const j=(i+1)%nn, a=i*4, b=j*4; SI.push(a,b,a+1,b,b+1,a+1, a+2,a+3,b+2,b+2,a+3,b+3, a,a+2,b,b,a+2,b+2); }
      orient(SP,SI); B.add(makeGeo(SP,SI),withMat(MAT.steel,{uv:"none",noGrad:true}));
      /* the sprocket's web (milestone 2): six arms and a bolt ring from the carrier to the hub, the big lightening holes between them */
      if(d>=1){ for(let k=0;k<6;k++){ const t=(k+0.5)/6*TAU; B.add(new THREE.BoxGeometry(0.040,0.014,0.0055),withMat(MAT.steel,{m:Tm(Math.cos(t)*0.055,Math.sin(t)*0.055,zS,0,0,t),uv:"none",noGrad:true})); }
        const wr=lathe([[0.034,zS-0.003],[0.044,zS-0.003],[0.044,zS+0.003],[0.034,zS+0.003]],d>=2?18:10); wr.applyMatrix4(Zaxis); B.add(wr,withMat(MAT.steel,{uv:"none",noGrad:true})); } } }
  return B.geometry();
}
export function buildWheel(d,rear){ return wheelBuild(d,rear); }

/* ---------------- the frame, engine, bodywork and exhaust (the chassis) ---------------- */
const S=(d,a,b,c)=>d>=2?a:d===1?b:c;
function bodyBuild(d){
  const B=new Builder(), sg=S(d,8,5,4), per=S(d,3,1,1);
  /* ---- the aluminium twin-spar frame: chunky beams from the head tube round the engine to the swingarm pivot ---- */
  const spar=[V(0.392,0.985,0.040),V(0.30,0.953,0.060),V(0.19,0.922,0.082),V(0.07,0.882,0.100),V(-0.03,0.805,0.108),V(-0.10,0.69,0.108),V(-0.15,0.56,0.102),V(-0.17,0.46,0.096)];
  B.addM(sweep(spar,t=>[0.037-0.011*t,0.024],S(d,11,6,5),{per:per,caps:true}),withMat(MAT.alu,{ao:0.95}));
  B.add(rod(axisPt(0.622),axisPt(0.735),0.040,0.040,S(d,14,8,6)),withMat(MAT.alu,{ao:0.9}));                  /* the head tube */
  if(d>=1) B.addM(rod(V(0.40,0.915,0.040),V(0.388,0.985,0.052),0.021,0.021,6),withMat(MAT.alu));              /* gusset */
  /* the cradle under the engine: two steel tubes */
  const cradle=[V(0.43,0.89,0.050),V(0.385,0.66,0.112),V(0.30,0.40,0.118),V(0.17,0.285,0.112),V(-0.03,0.282,0.106),V(-0.15,0.40,0.100)];
  B.addM(sweep(cradle,0.0135,S(d,6,4,3),{per:per,caps:true}),withMat(MAT.aluD,{ao:0.7}));
  /* the subframe: two rails to the tail, a cross brace */
  const sub=[V(-0.11,0.805,0.075),V(-0.40,0.842,0.078),V(-0.70,0.895,0.074),V(-0.93,0.945,0.065)];
  B.addM(sweep(sub,0.0145,S(d,6,4,3),{per:per,caps:true}),withMat(MAT.alu,{ao:0.6}));
  if(d>=2){ B.addM(rod(V(-0.22,0.70,0.085),V(-0.45,0.86,0.078),0.011,0.011,5),withMat(MAT.alu,{ao:0.55})); B.add(rod(V(-0.52,0.86,-0.075),V(-0.52,0.86,0.075),0.011,0.011,5),withMat(MAT.alu,{ao:0.55})); }
  B.mark('before-frame');
  /* the swingarm pivot plates and bolt, the skid plate */
  B.addM(new THREE.BoxGeometry(0.075,0.21,0.012,1,1,1),withMat(MAT.alu,{m:Tm(-0.165,0.475,0.112),ao:0.9}));
  B.add(rod(V(-0.17,0.44,-0.12),V(-0.17,0.44,0.12),0.0155,0.0155,S(d,8,6,5)),withMat(MAT.steel,{ao:0.8}));
  /* the skid plate (milestone 2): a moulded black guard under the engine with wings up the front of the cases */
  B.add(blob(0.205,0.030,0.098,4,S(d,6,4,3),S(d,14,8,6)),withMat(MAT.skid,{m:Tm(0.085,0.272,0),ao:0.85}));
  if(d>=1) B.addM(blob(0.085,0.038,0.006,3.5,S(d,4,3,3),S(d,10,6,6)),withMat(MAT.skid,{m:Tm(0.17,0.305,0.109,0,0,0.35),ao:0.85}));
  if(d>=2) [[0.0,-1],[0.0,1],[0.20,-1],[0.20,1]].forEach(p=>B.add(cyl(0.006,0.006,0.008,6),withMat(MAT.bolt,{m:Tm(p[0],0.243,p[1]*0.07),uv:"none"})));
  B.mark('before-engine');
  /* ---- the engine ---- */
  B.add(blob(0.215,0.135,0.105,3,S(d,10,5,4),S(d,16,8,6)),withMat(MAT.caseM,{m:Tm(0.055,0.405,0),ao:0.8}));                       /* crankcase */
  if(d>=2) B.add(blob(0.12,0.10,0.052,3,6,12),withMat(MAT.caseM,{m:Tm(-0.07,0.42,0),ao:0.75}));                                      /* gearbox */
  B.add(lathe([[0.001,0],[0.104,0],[0.108,0.006],[0.108,0.026],[0.094,0.034],[0.001,0.034]],S(d,24,12,8)),withMat(MAT.cover,{m:Tm(0.03,0.41,0.112,PI/2,0,0),uv:"none",ao:0.95}));   /* clutch cover (right) */
  if(d>=2){ for(let k=0;k<8;k++){ const a=k/8*TAU; B.add(cyl(0.007,0.007,0.014,6),withMat(MAT.bolt,{m:Tm(0.03+Math.cos(a)*0.088,0.41+Math.sin(a)*0.088,0.158,PI/2,0,0),uv:"none"})); }
    B.add(lathe([[0.001,0],[0.04,0],[0.04,0.012],[0.001,0.016]],14),withMat(MAT.steel,{m:Tm(0.03,0.41,0.146,PI/2,0,0),uv:"none"})); }
  B.add(lathe([[0.001,0],[0.082,0],[0.086,0.006],[0.086,0.02],[0.075,0.026],[0.001,0.026]],S(d,22,10,8)),withMat(MAT.cover,{m:Tm(0.145,0.46,-0.095,-PI/2,0,0),uv:"none",ao:0.9}));    /* ignition cover (left) */
  if(d>=2) B.add(blob(0.075,0.062,0.034,3,5,10),withMat(MAT.caseM,{m:Tm(-0.075,0.415,-0.118)}));                                       /* sprocket cover (left) */
  /* cylinder, fins, head, valve cover (the axis leans 0.2 rad forward) */
  const ax=V(Math.sin(0.2),Math.cos(0.2),0), cb=V(0.175,0.575,0), at=t=>cb.clone().addScaledVector(ax,t);
  B.add(blob(0.115,0.080,0.080,3.2,S(d,6,4,3),S(d,12,8,6)),withMat(MAT.cyl,{m:Tm(at(0.115).x,at(0.115).y,0,0,0,PI/2-0.2),ao:0.7}));
  if(d>=2) for(let k=0;k<7;k++){ const p=at(0.02+k*0.032); B.add(blob(0.100,0.0055,0.097,3,3,10),withMat(MAT.head,{m:Tm(p.x,p.y,0,0,0,-0.2),ao:0.7})); }
  B.add(blob(0.092,0.062,0.092,3,S(d,5,4,3),S(d,10,8,6)),withMat(MAT.head,{m:Tm(at(0.27).x,at(0.27).y,0,0,0,-0.2),ao:0.7}));
  if(d>=2) B.add(blob(0.085,0.018,0.078,3.5,4,10),withMat(MAT.alu,{m:Tm(at(0.335).x,at(0.335).y,0,0,0,-0.2),ao:0.8}));
  if(d>=1) B.add(rod(V(0.10,0.80,0),V(-0.12,0.78,0),0.034,0.044,S(d,8,6,4)),withMat(MAT.black,{ao:0.5}));                                  /* throttle body and airbox boot */
  B.addM(new THREE.BoxGeometry(0.05,0.30,0.075),withMat(MAT.rad,{m:Tm(0.395,0.755,0.113,0,0,-0.30),ao:0.6}));                           /* radiators */
  B.mark('before-tank');
  /* ---- the tank cover and radiator shrouds: one loft, team colour ---- */
  const sh=[
    [0.520,[[0.000,0.768],[0.045,0.770],[0.088,0.750],[0.120,0.710],[0.136,0.662],[0.132,0.614],[0.090,0.604]]],
    [0.455,[[0.000,0.925],[0.046,0.927],[0.092,0.902],[0.132,0.842],[0.158,0.765],[0.166,0.684],[0.146,0.614],[0.096,0.600]]],
    [0.360,[[0.000,0.984],[0.052,0.984],[0.100,0.962],[0.140,0.903],[0.162,0.815],[0.168,0.722],[0.148,0.652],[0.090,0.640]]],
    [0.235,[[0.000,0.994],[0.057,0.992],[0.106,0.974],[0.138,0.928],[0.152,0.857],[0.150,0.775],[0.135,0.722],[0.086,0.712]]],
    [0.100,[[0.000,0.985],[0.062,0.983],[0.111,0.965],[0.137,0.928],[0.146,0.873],[0.144,0.812],[0.131,0.772],[0.082,0.766]]],
    [-0.030,[[0.000,0.963],[0.067,0.961],[0.115,0.951],[0.133,0.927],[0.139,0.889],[0.137,0.843],[0.127,0.812],[0.080,0.806]]]];
  const ss=sh.map(r=>mirrorSec(r[0],r[1]));
  B.add(loft(smoothSecs(ss,S(d,3,1,1)),{}),withMat(MAT.plastic,{ao:1}));
  /* louvres in the shrouds: dark slits */
  /* the radiator louvres (milestone 2): fins in the team colour standing proud of the shroud over a black vent (the vent is painted by the shader) */
  if(d>=1){ const nf=d>=2?6:3, sp=d>=2?0.029:0.058; for(let k=0;k<nf;k++){ const x=0.300+k*sp+(d>=2?0:0.012); B.addM(new THREE.BoxGeometry(d>=2?0.0055:0.008,0.118,0.011),withMat(MAT.guard,{m:Tm(x,0.742,0.1705,0,0.10,0.42),ao:0.9})); } }
  /* the airbox cover and filter cap behind the shroud (black plastic), under the seat */
  if(d>=1) B.addM(blob(0.14,0.085,0.016,3.5,S(d,5,3,3),S(d,10,6,6)),withMat(MAT.side,{m:Tm(-0.185,0.78,0.108),ao:0.9}));
  B.mark('before-seat');
  /* ---- the seat: black, long and flat ---- */
  const seatY=[[0.12,0.956],[0.04,0.962],[-0.14,0.962],[-0.34,0.958],[-0.56,0.956],[-0.72,0.962],[-0.80,0.965]], seatW=[0.082,0.098,0.118,0.131,0.136,0.130,0.118];
  const seatS=seatY.map((p,i)=>superSec(p[0],0,p[1]-0.034,seatW[i],0.036,3.4,S(d,14,8,6)));
  B.add(loft(smoothSecs(seatS,S(d,2,1,1)),{}),withMat(MAT.seat,{ao:1}));
  B.mark('before-panels');
  /* ---- side panels (the side number plates sit on these) ---- */
  const pnl=[[-0.04,0.74,0.944],[-0.22,0.755,0.948],[-0.44,0.775,0.948],[-0.62,0.795,0.948],[-0.80,0.825,0.952]];
  const pS=pnl.map(p=>superSec(p[0],0.138,(p[1]+p[2])/2,0.011,(p[2]-p[1])/2,5,S(d,10,6,4)));
  B.addM(loft(smoothSecs(pS,S(d,2,1,1)),{}),withMat(MAT.plastic,{ao:1}));
  B.mark('before-fender');
  /* ---- the rear fender: long, a gentle upsweep at the tail ---- */
  const fnd=[[-0.38,0.915,0.102],[-0.58,0.905,0.101],[-0.78,0.915,0.097],[-0.93,0.938,0.090],[-1.04,0.968,0.082],[-1.13,0.996,0.072]];
  const fS=fnd.map(p=>superSec(p[0],0,p[1]-0.008,p[2],0.011,2.8,S(d,12,6,4)));
  B.add(loft(smoothSecs(fS,S(d,3,1,1)),{}),withMat(MAT.plastic,{uv:"top",ao:1,tint:3}));
  B.mark('before-exhaust');
  /* ---- the exhaust: header round the right of the engine, mid-pipe, the muffler ---- */
  const hdr=[V(0.298,0.700,0.046),V(0.345,0.600,0.092),V(0.338,0.505,0.150),V(0.262,0.462,0.172),V(0.150,0.528,0.168),V(0.030,0.600,0.172),V(-0.110,0.668,0.178),V(-0.250,0.735,0.186)];
  B.add(sweep(hdr,t=>0.0185-0.003*t,S(d,10,5,4),{per:S(d,3,1,1),caps:true}),withMat(MAT.exh,{ao:0.9}));
  { const md=V(-0.968,0.250,-0.012).normalize(), mp=V(-0.30,0.748,0.212), mq=new THREE.Quaternion().setFromUnitVectors(V(0,1,0),md), Lm=0.52, me=mp.clone().addScaledVector(md,Lm);
    B.add(lathe(d>=2?[[0.001,0.0],[0.040,0.0],[0.049,0.03],[0.0535,0.10],[0.0545,0.24],[0.0545,0.42],[0.050,0.48],[0.040,0.508],[0.034,Lm],[0.001,Lm]]:[[0.001,0.0],[0.049,0.03],[0.0545,0.24],[0.0545,0.42],[0.034,Lm],[0.001,Lm]],S(d,24,8,6)),
      withMat(MAT.muff,{m:new THREE.Matrix4().compose(mp,mq,V(1,1,1)),uv:"none",ao:1}));                                                  /* the muffler: along -X, rising */
    /* the end cap (milestone 2): a bright machined ring round a dark face and a short outlet pipe, the first thing the chase camera sees */
    const mcm=new THREE.Matrix4().compose(me,mq,V(1,1,1));
    B.add(lathe(d>=1?[[0.0300,-0.002],[0.0362,0.0],[0.0376,0.006],[0.0376,0.017],[0.0330,0.023],[0.0215,0.023],[0.0205,0.019]]:[[0.03,0],[0.0376,0.006],[0.0376,0.017],[0.021,0.023]],S(d,18,10,6)),withMat(MAT.aluB,{m:mcm,uv:"none",ao:1}));
    B.add(lathe([[0.0215,0.019],[0.0215,0.010],[0.001,0.010]],S(d,14,8,6)),withMat(MAT.cap,{m:mcm,uv:"none"}));
    if(d>=1) B.add(lathe([[0.0168,0.008],[0.0168,0.046],[0.0150,0.047]],S(d,14,8,6)),withMat(MAT.steel,{m:mcm,uv:"none"}));
    if(d>=1) B.add(lathe([[0.0150,0.047],[0.0150,0.012],[0.001,0.012]],S(d,12,8,6)),withMat(MAT.outlet,{m:mcm,uv:"none"}));
    B.add(rod(V(-0.250,0.735,0.186),V(-0.300,0.748,0.212),0.0175,0.034,S(d,8,6,4)),withMat(MAT.exh,{ao:0.9}));                          /* the mid-pipe joins header and muffler */
    if(d>=2){ B.add(rod(V(-0.50,0.79,0.12),V(-0.50,0.79,0.19),0.007,0.007,5),withMat(MAT.aluD)); B.add(rod(V(-0.68,0.835,0.115),V(-0.68,0.835,0.18),0.007,0.007,5),withMat(MAT.aluD));
      B.add(blob(0.20,0.022,0.036,4,4,10),withMat(MAT.aluB,{m:Tm(-0.47,0.780,0.150,0,0,0.10),ao:1}));   /* (milestone 2: the muffler bracket sits under the side-panel number, not across it) */ } }
  B.mark('before-hoses');
  /* radiator hoses, the water pump cover (milestone 2) */
  if(d>=1){ const hs=S(d,7,5,4), hp={per:S(d,3,1,1),caps:true};
    B.add(sweep([V(0.372,0.880,0.092),V(0.335,0.884,0.078),V(0.290,0.872,0.062),V(0.252,0.858,0.058)],0.0105,hs,hp),withMat(MAT.hose,{ao:0.75}));
    B.add(sweep([V(0.372,0.880,-0.092),V(0.330,0.880,-0.072),V(0.288,0.868,-0.058),V(0.250,0.856,-0.054)],0.0105,hs,hp),withMat(MAT.hose,{ao:0.75}));
    B.add(sweep([V(0.402,0.632,0.100),V(0.372,0.572,0.122),V(0.300,0.512,0.136),V(0.232,0.488,0.134)],0.0110,hs,hp),withMat(MAT.hose,{ao:0.7}));
    if(d>=2){ B.add(sweep([V(0.402,0.632,-0.100),V(0.360,0.565,-0.108),V(0.300,0.520,-0.104),V(0.250,0.500,-0.096)],0.0110,hs,hp),withMat(MAT.hose,{ao:0.65}));
      B.add(lathe([[0.001,0],[0.034,0],[0.036,0.006],[0.036,0.016],[0.030,0.020],[0.001,0.020]],16),withMat(MAT.cover,{m:Tm(0.215,0.485,0.122,PI/2,0,0),uv:"none",ao:0.85}));
      /* the clutch cable and the throttle cables below the head tube (their tops turn with the bars: steerBuild) */
      B.add(sweep([V(0.452,0.930,-0.030),V(0.432,0.880,0.030),V(0.400,0.820,0.072),V(0.360,0.720,0.090)],0.0038,5,{per:2,caps:true}),withMat(MAT.cable,{ao:0.6}));
      B.add(sweep([V(0.448,0.945,0.062),V(0.410,0.900,0.060),V(0.330,0.850,0.045),V(0.160,0.805,0.040)],0.0034,5,{per:2,caps:true}),withMat(MAT.cable,{ao:0.6}));
    } }
  B.mark('before-pegs');
  /* ---- footpegs, brake pedal, shifter, shock mount ---- */
  B.addM(new THREE.BoxGeometry(0.10,0.018,0.036),withMat(MAT.steel,{m:Tm(-0.075,0.419,0.205),ao:0.9}));
  B.addM(rod(V(-0.075,0.425,0.150),V(-0.075,0.425,0.222),0.011,0.011,S(d,6,4,4)),withMat(MAT.aluD));
  /* the pegs' teeth (milestone 2): two rows of cleats on each peg */
  if(d>=2) for(const ex of [-0.044,0.044]) for(let k=0;k<5;k++) B.addM(cyl(0.0034,0.0006,0.0075,4),withMat(MAT.steel,{m:Tm(-0.075+ex,0.4305,0.190+k*0.0075),uv:"none",ao:0.9}));
  if(d>=1){ B.add(rod(V(-0.04,0.44,0.14),V(-0.28,0.40,0.205),0.0085,0.007,5),withMat(MAT.steel)); B.add(new THREE.BoxGeometry(0.045,0.01,0.03),withMat(MAT.steel,{m:Tm(-0.30,0.399,0.205)})); }
  if(d>=2){ B.add(rod(V(0.08,0.395,-0.12),V(0.16,0.40,-0.18),0.0075,0.0075,5),withMat(MAT.steel)); B.add(rod(V(-0.25,0.84,-0.04),V(-0.25,0.84,0.04),0.012,0.012,6),withMat(MAT.steel,{ao:0.6}));
    B.add(lathe([[0.001,0],[0.034,0],[0.034,0.008],[0.001,0.008]],12),withMat(MAT.steel,{m:Tm(-0.255,0.46,-0.152,-PI/2,0,0),uv:"none"})); }
  return B.geometry();
}

/* the right handguard's shield (milestone 2): a thin curved plate lofted along the bar, its face turning outward round the bar end (the left one is its mirror image) */
function guardGeo(d){
  const ns=S(d,12,7,5), nj=S(d,10,8,6), secs=[];
  for(let i=0;i<=ns;i++){ const t=i/ns, wrap=sstep(0.60,1.0,t), phi=wrap*1.22;
    const x=0.476-0.006*Math.sin(PI*t)-0.046*wrap*wrap, z=0.255+0.208*t-0.012*wrap, y=1.117+0.004*t, hh=0.024+0.027*Math.sin(PI*Math.min(1,t*1.08)), th=0.0034, nx=Math.cos(phi), nz=Math.sin(phi);
    const sec=[]; for(let j=0;j<nj;j++){ const a=j/nj*TAU, c=Math.cos(a), sn=Math.sin(a), bow=0.010*(1-sn*sn); sec.push(V(x+nx*(th*c+bow),y+hh*sn,z+nz*(th*c+bow))); }
    secs.push(sec); }
  return loft(secs,{});
}
/* ---------------- the steered front: triple clamps, upper fork tubes, bars, levers, grips, plate bracket ---------------- */
function steerBuild(d){
  const B=new Builder(), sg=S(d,12,6,4);
  const zf=0.105;                                                    /* the fork legs' lateral position */
  /* upper fork tubes (the inner tubes: polished) */
  [-1,1].forEach(sd=>{ B.add(rod(forkPt(0.30).setZ(sd*zf),forkPt(0.805).setZ(sd*zf),0.0245,0.0245,sg),withMat(MAT.upper,{ao:1})); });
  /* top clamp: a forged plate with the bar mounts; the bottom clamp */
  const fa=(s,off)=>axisPt(s).addScaledVector(NF,off);
  const topM=new THREE.Matrix4().compose(fa(0.760,0.014),new THREE.Quaternion().setFromEuler(new THREE.Euler(0,0,RAKE)),V(1,1,1));
  B.add(blob(0.040,0.017,0.138,3.2,S(d,6,4,3),S(d,14,10,8)),withMat(MAT.anod,{m:topM,ao:0.9}));
  const botM=new THREE.Matrix4().compose(fa(0.588,0.012),new THREE.Quaternion().setFromEuler(new THREE.Euler(0,0,RAKE)),V(1,1,1));
  B.add(blob(0.046,0.022,0.142,3.2,S(d,6,4,3),S(d,14,10,8)),withMat(MAT.anod,{m:botM,ao:0.8}));
  /* the pinch bolts on the front of the top clamp */
  if(d>=2) [-1,1].forEach(sd=>{ const q=fa(0.757,0.058); B.add(cyl(0.0085,0.0085,0.014,8),withMat(MAT.bolt,{m:Tm(q.x,q.y,sd*0.088,0,0,RAKE+PI/2)})); });
  /* fork caps and adjusters on top of the legs */
  if(d>=1) [-1,1].forEach(sd=>{ const t=forkPt(0.805).setZ(sd*zf); B.add(cyl(0.0265,0.0265,0.022,sg),withMat(MAT.gold,{m:new THREE.Matrix4().compose(t.clone().addScaledVector(UA,0.011),new THREE.Quaternion().setFromEuler(new THREE.Euler(0,0,RAKE)),V(1,1,1))})); });
  /* bar mounts (risers), the handlebar: a tapered tube with its bends, the crossbar and its pad */
  const barC=V(0.392,1.093,0);
  if(d>=1) [-1,1].forEach(sd=>{ B.add(cyl(0.020,0.020,0.045,S(d,8,6,4)),withMat(MAT.anod,{m:Tm(0.382,1.045,sd*0.10),ao:0.9})); });
  const bar=[V(0.392,1.094,0.0),V(0.392,1.095,0.10),V(0.394,1.102,0.19),V(0.398,1.114,0.255),V(0.400,1.120,0.31),V(0.400,1.120,0.40)];
  B.addM(sweep(bar,t=>0.0143-0.0033*Math.max(0,(t-0.55)/0.45),S(d,10,5,4),{per:S(d,3,1,1),caps:true}),withMat(MAT.alu,{ao:1}));
  B.add(rod(V(0.382,1.150,-0.115),V(0.382,1.150,0.115),0.0105,0.0105,S(d,8,6,5)),withMat(MAT.alu));                          /* crossbar */
  if(d>=2) B.addM(rod(V(0.386,1.098,0.108),V(0.382,1.150,0.115),0.0105,0.0105,6),withMat(MAT.alu));
  B.add(blob(0.034,0.034,0.118,3.5,S(d,4,3,3),S(d,10,6,5)),withMat(MAT.accent,{m:Tm(0.395,1.162,0),ao:0.95}));                      /* the bar pad */
  /* grips, throttle sleeve, end plugs */
  B.addM(cyl(0.0182,0.0188,0.125,S(d,12,7,5)),withMat(MAT.grip,{m:Tm(0.400,1.120,0.362,PI/2,0,0),ao:1}));
  if(d>=2){ B.addM(cyl(0.0205,0.0205,0.034,10),withMat(MAT.black,{m:Tm(0.400,1.120,0.282,PI/2,0,0)})); B.addM(cyl(0.0125,0.0125,0.012,8),withMat(MAT.anod,{m:Tm(0.400,1.120,0.428,PI/2,0,0)}));
    for(let k=0;k<(d>=2?6:0);k++) B.addM(cyl(0.0191,0.0191,0.0042,12),withMat(MAT.rubber,{m:Tm(0.400,1.120,0.31+k*0.0175,PI/2,0,0)})); }
  /* perches and levers: clutch (left) and brake (right) */
  if(d>=2) B.addM(blob(0.036,0.019,0.022,3,4,8),withMat(MAT.black,{m:Tm(0.414,1.100,0.262),ao:0.9}));
  /* the levers (milestone 2): forged blades from the perches out along the bars, a little in front of the grips, the tips curled back */
  B.addM(sweep([V(0.420,1.101,0.262),V(0.440,1.097,0.290),V(0.452,1.091,0.345),V(0.452,1.087,0.392),V(0.444,1.084,0.418)],t=>[0.0042-0.0012*t,0.0085-0.002*t],S(d,7,4,4),{per:S(d,3,1,1),caps:true}),withMat(MAT.lever,{ao:1}));
  /* the handguards (milestone 2): moulded shields in the team colour in front of the levers, curling round the bar ends, on alloy mounts */
  B.addM(guardGeo(d),withMat(MAT.guard,{uv:"none",ao:1}));
  if(d>=1){ B.addM(rod(V(0.398,1.110,0.212),V(0.468,1.114,0.262),0.0058,0.0058,S(d,6,4,4)),withMat(MAT.alu,{ao:0.9})); B.addM(rod(V(0.402,1.120,0.430),V(0.430,1.121,0.452),0.0058,0.0058,S(d,6,4,4)),withMat(MAT.alu,{ao:0.9})); }
  /* the front brake line, the clutch cable and the throttle cables (milestone 2): black lines looping forward from the bars; they carry on below the
     head tube in the chassis (bodyBuild) and down the right fork leg to the caliper (forkBuild) */
  if(d>=1){ const cs=S(d,6,4,4), cp={per:S(d,3,2,1),caps:true};
    B.add(sweep([V(0.418,1.122,0.248),V(0.455,1.095,0.228),V(0.478,1.040,0.190),V(0.472,0.985,0.150),forkPt(0.60).setZ(0.136).addScaledVector(NF,0.040),forkPt(0.46).setZ(0.137).addScaledVector(NF,0.034)],0.0045,cs,cp),withMat(MAT.hose,{ao:0.9}));
    B.add(sweep([V(0.420,1.104,-0.262),V(0.450,1.090,-0.250),V(0.490,1.040,-0.205),V(0.505,0.985,-0.130),V(0.488,0.952,-0.060),V(0.458,0.935,-0.030)],0.0040,cs,cp),withMat(MAT.cable,{ao:0.9}));
    B.add(sweep([V(0.405,1.104,0.276),V(0.432,1.072,0.255),V(0.462,1.022,0.190),V(0.472,0.982,0.120),V(0.462,0.956,0.078),V(0.448,0.946,0.062)],0.0034,cs,cp),withMat(MAT.cable,{ao:0.9}));
    if(d>=2) B.add(sweep([V(0.399,1.100,0.280),V(0.424,1.064,0.262),V(0.452,1.016,0.196),V(0.462,0.978,0.126),V(0.452,0.952,0.084),V(0.440,0.944,0.066)],0.0032,cs,cp),withMat(MAT.cable,{ao:0.9})); }
  if(d>=2){ B.add(blob(0.028,0.022,0.020,3,4,8),withMat(MAT.anod,{m:Tm(0.405,1.128,0.255),ao:0.9})); B.add(cyl(0.012,0.012,0.04,8),withMat(MAT.black,{m:Tm(0.404,1.155,0.255)})); }   /* brake master cylinder + reservoir */
  /* the front number plate (milestone 2): a curved plastic plate in the team colour (the shader paints the rider's number background, numerals and name from the
     side-panel atlas onto its face, kind 6), a dark back; its frame: centre (0.508, 1.035, 0), leaning back 0.30 rad, 0.25 m across, 0.215 m high */
  { const pf=new THREE.Matrix4().compose(V(0.508,1.035,0),new THREE.Quaternion().setFromEuler(new THREE.Euler(0,PI/2,0.30,"ZYX")),V(0.25,0.215,1));
    const face=new THREE.PlaneGeometry(1,1,S(d,10,6,4),S(d,3,1,1)), P=face.attributes.position; for(let i=0;i<P.count;i++){ const x=P.getX(i), y=P.getY(i); P.setZ(i,-0.022*4*x*x-0.006*(1-4*y*y)*0); } face.computeVertexNormals();
    const back=face.clone(); back.scale(1,1,1); back.translate(0,0,-0.0045); const bi=back.index.array; for(let i=0;i<bi.length;i+=3){ const t=bi[i+1]; bi[i+1]=bi[i+2]; bi[i+2]=t; } back.computeVertexNormals();
    B.add(face,withMat(MAT.plateF,{m:pf,uv:"none",ao:1})); B.add(back,withMat(MAT.plateK,{m:pf,uv:"none",ao:0.9})); }
  /* the number-plate bracket: two posts from the bars to where the plate stands */
  B.addM(rod(V(0.395,1.145,0.082),V(0.488,1.043,0.082),0.008,0.008,5),withMat(MAT.alu));
  if(d>=2) B.add(rod(V(0.488,1.000,-0.10),V(0.488,1.062,0.10),0.006,0.006,4),withMat(MAT.alu));
  return B.geometry();
}

/* ---------------- the lower fork: legs, guards, front fender, caliper, axle lugs (slides with the wheel and turns with the bars) ---------------- */
function forkBuild(d){
  const B=new Builder(), sg=S(d,14,6,4), zf=0.105;
  [-1,1].forEach(sd=>{
    const a=forkPt(0.0).setZ(sd*zf), b=forkPt(0.385).setZ(sd*zf);
    B.add(rod(a,b,0.0275,0.0275,sg),withMat(MAT.gold,{ao:0.95}));
    B.add(rod(forkPt(0.378).setZ(sd*zf),forkPt(0.400).setZ(sd*zf),0.0295,0.0295,sg),withMat(MAT.black,{ao:0.8}));                      /* the dust seal */
    if(d>=1) B.add(blob(0.036,0.040,0.022,3,4,S(d,8,6,4)),withMat(MAT.gold,{m:new THREE.Matrix4().compose(FA.clone().setZ(sd*(zf-0.014)),new THREE.Quaternion().setFromEuler(new THREE.Euler(0,0,RAKE)),V(1,1,1)),ao:0.9}));   /* the axle lug */
    if(d>=2) B.add(rod(FA.clone().setZ(sd*0.062),FA.clone().setZ(sd*0.112),0.0105,0.0105,8),withMat(MAT.steel,{ao:0.9}));                       /* the axle's end and nut */
    /* the fork guard, a curved shield in the front of each leg */
    const gp=forkPt(0.215).setZ(sd*zf).addScaledVector(NF,0.030);
    B.add(blob(0.012,0.115,0.026,3.2,S(d,5,3,3),S(d,10,6,5)),withMat(MAT.accent,{m:new THREE.Matrix4().compose(gp,new THREE.Quaternion().setFromEuler(new THREE.Euler(0,0,RAKE)),V(1,1,1)),ao:1}));
    if(d>=2){ /* the compression screw and the bleed screw on each leg */
      B.add(cyl(0.007,0.007,0.02,6),withMat(MAT.steel,{m:new THREE.Matrix4().compose(forkPt(0.372).setZ(sd*zf).addScaledVector(NF,0.0),new THREE.Quaternion().setFromEuler(new THREE.Euler(PI/2,0,0)),V(1,1,1))})); }
  });
  /* the brake caliper (right) and its bracket: behind the leg at the disc's edge */
  { const cp=V(FA.x-0.098,FA.y+0.074,0.060); B.add(blob(0.034,0.040,0.020,3,S(d,4,3,3),S(d,8,5,4)),withMat(MAT.anodG,{m:Tm(cp.x,cp.y,cp.z,0,0,0.65),ao:0.9}));
    if(d>=2) B.add(rod(V(FA.x-0.075,FA.y+0.04,0.066),V(FA.x-0.045,FA.y+0.12,0.099),0.011,0.011,6),withMat(MAT.aluD)); }
  /* the front brake line's lower half (milestone 2): down the outside of the right leg to the caliper */
  if(d>=1) B.add(sweep([forkPt(0.47).setZ(0.137),forkPt(0.34).setZ(0.139),forkPt(0.22).setZ(0.137),V(0.655,0.500,0.110),V(0.650,0.462,0.078)],0.0045,S(d,6,4,4),{per:S(d,3,2,1),caps:true}),withMat(MAT.hose,{ao:0.85}));
  /* the front fender: a long blade over the tyre, the beak curling up, mounted on the legs */
  const fp=[[0.50,0.716,0.126],[0.57,0.730,0.122],[0.65,0.737,0.115],[0.74,0.740,0.108],[0.83,0.733,0.100],[0.91,0.712,0.093],[0.98,0.676,0.086],[1.04,0.632,0.080],[1.10,0.592,0.073],[1.16,0.574,0.066]];
  const fS=fp.map(p=>superSec(p[0],0,p[1],p[2],0.011,2.6,S(d,12,6,4)));
  B.add(loft(smoothSecs(fS,S(d,3,1,1)),{}),withMat(MAT.plastic,{uv:"top",ao:1,tint:3}));
  /* fender stays down to the legs */
  if(d>=1) [-1,1].forEach(sd=>{ B.add(blob(0.04,0.05,0.008,3,S(d,4,3,3),S(d,8,5,4)),withMat(MAT.plastic,{m:Tm(0.575,0.69,sd*0.112,0,0,0.5),uv:"top"})); });
  return B.geometry();
}

/* ---------------- the swingarm (built relative to the pivot: the arm runs along -X), chain, rear brake, linkage ---------------- */
function swingBuild(d){
  const B=new Builder(), L=ARM, sg=S(d,8,5,4);
  /* two arms: box-section aluminium, deeper at the pivot */
  const arm=(sd)=>{ const sec=[]; const st=[[0.0,0.085],[0.12,0.075],[0.30,0.058],[0.46,0.050],[0.545,0.062],[L+0.012,0.056]];
    st.forEach(p=>sec.push(superSec(-p[0],sd*0.088,0,0.0165,p[1]/2,4,S(d,8,5,4)))); return loft(smoothSecs(sec,S(d,2,1,1)),{}); };
  B.add(arm(1),withMat(MAT.alu,{ao:0.95,uv:"none"})); B.add(arm(-1),withMat(MAT.alu,{ao:0.95,uv:"none"}));
  B.add(rod(V(-0.065,0.0,-0.09),V(-0.065,0.0,0.09),0.016,0.016,8),withMat(MAT.alu,{ao:0.8,uv:"none"}));                                  /* the cross brace near the pivot */
  if(d>=2) B.add(rod(V(-0.45,0.0,-0.09),V(-0.45,0.0,0.09),0.0125,0.0125,6),withMat(MAT.alu,{ao:0.8,uv:"none"}));
  /* the axle blocks and chain adjusters at the wheel end */
  [-1,1].forEach(sd=>{ B.add(blob(0.034,0.030,0.011,3,S(d,4,3,3),S(d,8,5,4)),withMat(MAT.aluB,{m:Tm(-L,0,sd*0.102),ao:0.9,uv:"none"})); if(d>=2) B.add(rod(V(-L-0.008,0,sd*0.095),V(-L-0.008,0,sd*0.12),0.0105,0.0105,8),withMat(MAT.steel,{uv:"none"})); });
  if(d>=2) B.add(rod(V(-L,0,-0.12),V(-L,0,0.12),0.0105,0.0105,8),withMat(MAT.steel,{uv:"none"}));
  /* the chain (left): two runs between the front and rear sprockets (a flat band with its links) */
  const fx=-0.255+PIVOT.x*0, up=V(0,0,0);
  { const cs=BIKE.CHAIN_SPROCKET.clone(); const fs={x:cs.x-PIVOT.x,y:cs.y-PIVOT.y};            /* the front sprocket in the arm's frame (rest pose) */
    const rot=Math.atan2(RA.y-PIVOT.y,RA.x-PIVOT.x)-PI; const c=Math.cos(-rot), s=Math.sin(-rot);   /* bike frame -> arm frame at rest */
    const fx2=fs.x*c-fs.y*s, fy2=fs.x*s+fs.y*c;                                                  /* (the arm frame has x along -the arm) */
    const rs=0.0975, fr=0.030, a1=V(fx2,fy2+fr,-0.058), a2=V(-L,rs,-0.058), b1=V(fx2,fy2-fr,-0.058), b2=V(-L,-rs,-0.058);
    B.add(box3(a1,a2,0.011,0.0075),withMat(MAT.chain,{ao:0.7,uv:"none"})); B.add(box3(b1,b2,0.011,0.0075),withMat(MAT.chain,{ao:0.7,uv:"none"}));
    /* the links (milestone 2): alternating outer and inner side plates at the chain's 15.9 mm pitch along both runs (LOD 0) */
    if(d>=2){ for(const [p0,p1] of [[a1,a2],[b1,b2]]){ const len=p0.distanceTo(p1), nL=Math.floor(len/0.0159), ang=Math.atan2(p1.y-p0.y,p1.x-p0.x);
        for(let k=0;k<nL;k++){ const t=(k+0.5)/nL, p=p0.clone().lerp(p1,t), outer=k%2===0, dz=outer?0.0063:0.0048, h=outer?0.0112:0.0096;
          for(const sz of [-1,1]) B.add(new THREE.BoxGeometry(0.0180,h,0.0013),withMat(outer?MAT.link:MAT.linkD,{m:Tm(p.x,p.y,p.z+sz*dz,0,0,ang),uv:"none",ao:0.8})); } } }
    /* the chain guide and slider on the lower run, the upper guide at the front */
    if(d>=2){ B.add(box3(V(-0.20,-0.045,-0.058),V(-0.42,-0.085,-0.058),0.02,0.014),withMat(MAT.black,{uv:"none",ao:0.7})); }
  }
  /* the rear brake: the caliper and its hanger on the right arm */
  B.add(blob(0.040,0.032,0.020,3,S(d,4,3,3),S(d,8,5,4)),withMat(MAT.anodG,{m:Tm(-L+0.034,-0.092,0.074,0,0,-0.3),ao:0.9,uv:"none"}));
  if(d>=2) B.add(rod(V(-L+0.034,-0.092,0.088),V(-L-0.01,-0.03,0.099),0.008,0.008,5),withMat(MAT.aluD,{uv:"none"}));
  /* the rear brake line (milestone 2): from the caliper along the top of the right arm toward the pivot */
  if(d>=1) B.add(sweep([V(-L+0.030,-0.060,0.094),V(-L+0.070,0.002,0.108),V(-L+0.15,0.036,0.110),V(-0.30,0.038,0.110),V(-0.12,0.046,0.112),V(-0.06,0.030,0.124)],0.0040,S(d,5,4,4),{per:S(d,3,1,1),caps:true}),withMat(MAT.hose,{uv:"none",ao:0.85}));
  /* the linkage: a rocker and two dog-bones under the arms in front of the shock */
  if(d>=2){ B.add(blob(0.055,0.025,0.012,3,4,8),withMat(MAT.alu,{m:Tm(-0.105,-0.098,0.0),ao:0.7,uv:"none"})); B.addM(rod(V(-0.10,-0.098,0.045),V(-0.27,-0.075,0.045),0.0075,0.0075,5),withMat(MAT.aluD,{uv:"none"})); }
  return B.geometry();
}
/* a flat band between two points: width along z, thickness */
function box3(a,b,t,w){ const d=b.clone().sub(a), len=d.length(), g=new THREE.BoxGeometry(len,t,w); const m=new THREE.Matrix4().compose(a.clone().add(b).multiplyScalar(0.5),new THREE.Quaternion().setFromEuler(new THREE.Euler(0,0,Math.atan2(d.y,d.x))),V(1,1,1)); g.applyMatrix4(m); return g; }

/* ---------------- the rear shock: a unit-length bone along +Y (the eye at y = 0, the top at y = 1) with the coil spring on it ---------------- */
const SHOCK_L=Math.hypot(BIKE.SHOCK_TOP.x-BIKE.SHOCK_BOT.x,BIKE.SHOCK_TOP.y-BIKE.SHOCK_BOT.y);
function shockBuild(d){
  const B=new Builder(), L=SHOCK_L, Y=y=>y/L;
  /* parts are built in real metres along y then squashed by 1/L so a bone() of length L is the real shock */
  const sq=new THREE.Matrix4().makeScale(1,1/L,1);
  const put=(g,mat,m)=>{ const mm=m?sq.clone().multiply(m):sq.clone(); B.add(g,withMat(mat,{m:mm,uv:"none",noGrad:true})); };
  put(cyl(0.020,0.020,0.20,S(d,12,6,5)),MAT.shockB,Tm(0,0.12,0));                                              /* damper body */
  if(d>=2) put(cyl(0.010,0.010,0.30,6),MAT.steel,Tm(0,0.35,0));                                                  /* the shaft */
  put(cyl(0.025,0.025,0.012,S(d,14,7,5)),MAT.gold,Tm(0,0.222,0));                                              /* lower spring seat (adjuster) */
  put(cyl(0.028,0.028,0.012,S(d,14,7,5)),MAT.gold,Tm(0,L-0.040,0));                                            /* upper seat */
  if(d>=2){ put(cyl(0.0185,0.0185,0.03,8),MAT.steel,Tm(0,0.0,0,0,0,0)); put(cyl(0.017,0.017,0.03,8),MAT.steel,Tm(0,L-0.01,0,0,0,0));
    put(cyl(0.021,0.021,0.10,8),MAT.gold,Tm(0.036,0.12,0.0)); }                                         /* the piggyback reservoir */
  /* the coil: ~9 turns of wire, in the accent colour */
  const turns=S(d,8,5,4), per=S(d,12,6,6), pts=[], y0=0.235, y1=L-0.052, Rr=0.0345;
  for(let k=0;k<=turns*per;k++){ const f=k/(turns*per), a=f*turns*TAU; pts.push(V(Math.cos(a)*Rr,y0+(y1-y0)*f,Math.sin(a)*Rr)); }
  B.add(sweep(pts,0.0050,S(d,4,3,3),{ns:turns*per,per:1}),withMat(MAT.spring,{m:sq.clone(),uv:"none",noGrad:true}));
  return B.geometry();
}

/* ---------------- the far model: the whole bike as ONE static mesh of about 500 triangles (rest pose) ---------------- */
function farBuild(){
  const B=new Builder(), nt=(o)=>withMat(o,{uv:"none"});
  /* wheels (static, at the rest height): a tyre lathe of 5 points and a rim disc */
  [[FA,TYRE_F],[RA,TYRE_R]].forEach(([c,ty])=>{ const w=ty.w;
    const t=lathe([[0.265,-w*0.6],[0.322,-w*0.95],[0.34,0],[0.322,w*0.95],[0.265,w*0.6]],10); t.applyMatrix4(Zaxis); B.add(t,withMat(MAT.tread,{m:Tm(c.x,c.y,0),uv:"none",noGrad:true}));
    B.add(cyl(0.24,0.24,0.02,8),withMat(MAT.blurFar,{m:Tm(c.x,c.y,0,PI/2,0,0),uv:"none",noGrad:true})); });   /* (milestone 2: a grey disc, the spokes as a far wheel shows them, not a silver plate) */
  /* frame and engine: two beams and a block */
  B.addM(sweep([V(0.392,0.985,0.04),V(0.07,0.882,0.10),V(-0.10,0.69,0.108),V(-0.17,0.46,0.096)],0.03,4,{per:1,caps:true}),withMat(MAT.alu));
  B.add(blob(0.215,0.135,0.105,3,4,6),withMat(MAT.caseM,{m:Tm(0.055,0.405,0)}));
  B.add(blob(0.115,0.080,0.080,3.2,3,6),withMat(MAT.cyl,{m:Tm(0.19,0.69,0,0,0,PI/2-0.2)}));
  /* tank + shrouds, seat, side panels, rear fender: four stations each */
  const sh=[[0.52,[[0,0.768],[0.088,0.75],[0.136,0.662],[0.09,0.604]]],[0.36,[[0,0.984],[0.100,0.962],[0.162,0.815],[0.09,0.64]]],[0.10,[[0,0.985],[0.111,0.965],[0.146,0.873],[0.082,0.766]]],[-0.03,[[0,0.963],[0.115,0.951],[0.139,0.889],[0.08,0.806]]]];
  B.add(loft(sh.map(r=>mirrorSec(r[0],r[1])),{}),withMat(MAT.plastic));
  B.add(loft([[0.12,0.956,0.082],[-0.14,0.962,0.118],[-0.56,0.956,0.136],[-0.80,0.965,0.118]].map(p=>superSec(p[0],0,p[1]-0.034,p[2],0.036,3.4,6)),{}),withMat(MAT.seat));
  B.addM(loft([[-0.04,0.74,0.944],[-0.44,0.775,0.948],[-0.80,0.825,0.952]].map(p=>superSec(p[0],0.138,(p[1]+p[2])/2,0.011,(p[2]-p[1])/2,4,4)),{}),withMat(MAT.plastic));
  B.add(loft([[-0.38,0.915,0.102],[-0.78,0.915,0.097],[-1.13,0.996,0.072]].map(p=>superSec(p[0],0,p[1]-0.008,p[2],0.011,2.8,4)),{}),withMat(MAT.plastic,{uv:"top"}));
  /* fork, bars, front fender, exhaust */
  B.addM(rod(forkPt(0.0).setZ(0.105),forkPt(0.8).setZ(0.105),0.027,0.025,4),withMat(MAT.gold));
  B.add(rod(V(0.40,1.12,-0.40),V(0.40,1.12,0.40),0.016,0.016,4),withMat(MAT.alu));
  B.add(loft([[0.50,0.716,0.126],[0.83,0.733,0.100],[1.04,0.632,0.080],[1.16,0.574,0.066]].map(p=>superSec(p[0],0,p[1],p[2],0.011,2.6,4)),{}),withMat(MAT.plastic,{uv:"top"}));
  B.add(sweep([V(0.298,0.700,0.046),V(0.338,0.505,0.150),V(0.03,0.6,0.172),V(-0.25,0.735,0.186)],0.019,4,{per:1,caps:true}),withMat(MAT.exh));
  { const md=V(-0.968,0.250,-0.012).normalize(); B.add(lathe([[0.001,0],[0.049,0.03],[0.0545,0.24],[0.0545,0.42],[0.034,0.52],[0.001,0.52]],6),withMat(MAT.muff,{m:new THREE.Matrix4().compose(V(-0.30,0.748,0.212),new THREE.Quaternion().setFromUnitVectors(V(0,1,0),md),V(1,1,1)),uv:"none"})); }
  /* the front plate (milestone 2: the rider's number is painted on it by the shader) */
  B.add(new THREE.PlaneGeometry(1,1),withMat(MAT.plateF,{m:new THREE.Matrix4().compose(V(0.508,1.035,0),new THREE.Quaternion().setFromEuler(new THREE.Euler(0,PI/2,0.30,"ZYX")),V(0.25,0.215,1)),uv:"none"}));
  /* swingarm and shock: one beam and one rod */
  B.add(rod(V(-0.17,0.44,0),V(-0.74,0.34,0),0.05,0.04,4),withMat(MAT.alu));
  B.add(rod(BIKE.SHOCK_BOT.clone(),BIKE.SHOCK_TOP.clone(),0.035,0.035,4),withMat(MAT.spring));
  return B.geometry();
}
/* the spinning wheel's blur disc (milestone 2): two thin annuli (the two planes of spokes) from the hub to the rim at unit radius; r3d-bike.js scales them to the rim and draws them translucent */
export function buildBlurDisc(seg){
  seg=seg||28; const P=[], N=[], U=[], I=[]; const r0=0.19;
  for(const zs of [-1,1]){ const base=P.length/3, z=zs*0.021;
    for(let i=0;i<=seg;i++){ const a=i/seg*TAU, c=Math.cos(a), s=Math.sin(a); P.push(c*r0,s*r0,z, c,s,z); N.push(0,0,zs,0,0,zs); U.push(r0,a/TAU,1,a/TAU); }
    for(let i=0;i<seg;i++){ const a=base+i*2; if(zs>0) I.push(a,a+1,a+2,a+1,a+3,a+2); else I.push(a,a+2,a+1,a+1,a+2,a+3); } }
  const g=new THREE.BufferGeometry(); g.setAttribute("position",new THREE.Float32BufferAttribute(P,3)); g.setAttribute("normal",new THREE.Float32BufferAttribute(N,3)); g.setAttribute("uv",new THREE.Float32BufferAttribute(U,2)); g.setIndex(I); return g;
}
/* merge finished builder geometries (same attributes) */
function merge3(list){ const B=new Builder(); list.forEach(g=>{ const P=g.attributes.position.array, N=g.attributes.normal.array, C=g.attributes.color.array, U=g.attributes.uv.array, A=g.attributes.aMat.array, ix=g.index.array, base=B.P.length/3;
    for(let i=0;i<P.length;i++) B.P.push(P[i]); for(let i=0;i<N.length;i++) B.N.push(N[i]); for(let i=0;i<C.length;i++) B.C.push(C[i]); for(let i=0;i<U.length;i++) B.U.push(U[i]); for(let i=0;i<A.length;i++) B.A.push(A[i]); for(let i=0;i<ix.length;i++) B.I.push(ix[i]+base); });
  return B.geometry(); }

/* ---------------- the public builders (cached per level of detail) ---------------- */
const CACHE={};
export function buildBike(d){
  if(CACHE[d]) return CACHE[d];
  const o={body:bodyBuild(d),steer:steerBuild(d),fork:forkBuild(d),swing:swingBuild(d),shock:shockBuild(d),wheelF:wheelBuild(d,false),wheelR:wheelBuild(d,true)};
  return (CACHE[d]=o);
}
export function buildFarBike(){ return CACHE.far||(CACHE.far=farBuild()); }
export function triCount(g){ return (g.index?g.index.count:g.attributes.position.count)/3; }
export {Tm,rod,sweep as sweepTube,Zaxis,SHOCK_L,ARM};
