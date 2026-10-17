/* MOTOCROSS WAR 3D — SHARED HELPERS (owner: lead; every module imports from here, nobody else edits this file: ask the lead).
   Plain maths, seeded value noise, canvas / texture / geometry-merge helpers, the instanced-limb helper and the pure course queries
   (is a point on the track, how far from it). Moved out of r3d-world.js and r3d-riders.js byte for byte (the file split: no visual change). */
import * as THREE_NS from "../ui/vendor/three-0.160.0.module.min.js";
const THREE=THREE_NS;
const GL=typeof window!=="undefined"?window:globalThis;
export function now(){ return (GL.performance&&performance.now)?performance.now():Date.now(); }

/* ---------------- small helpers ---------------- */
function lin(hex){ const c=new THREE.Color(hex); return [c.r,c.g,c.b]; }   /* sRGB hex -> linear rgb for vertex colours */
function mixc(a,b,t){ return [a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t,a[2]+(b[2]-a[2])*t]; }
function clamp(x,a,b){ return x<a?a:x>b?b:x; }
function sstep(a,b,x){ const t=clamp((x-a)/(b-a),0,1); return t*t*(3-2*t); }
function hash2(x,z){ let h=Math.imul((x|0)*73856093^(z|0)*19349663,1597334677)>>>0; return (h%10000)/10000; }
function vnoise(x,z){ const xi=Math.floor(x), zi=Math.floor(z), xf=x-xi, zf=z-zi, u=xf*xf*(3-2*xf), v=zf*zf*(3-2*zf);
  const a=hash2(xi,zi), b=hash2(xi+1,zi), c=hash2(xi,zi+1), d=hash2(xi+1,zi+1); return a+(b-a)*u+(c-a)*v+(a-b-c+d)*u*v; }
function fbm(x,z,o){ let s=0, a=0.5, f=1; for(let i=0;i<(o||4);i++){ s+=a*vnoise(x*f,z*f); f*=2.03; a*=0.5; } return s; }
/* periodic value noise: a texture drawn with it tiles with no seam (polish: the old dirt showed a hard edge every 5 m, like planks) */
function hashp(x,z,p){ x=((x%p)+p)%p; z=((z%p)+p)%p; return hash2(x,z); }
function pnoise(x,z,p){ const xi=Math.floor(x), zi=Math.floor(z), xf=x-xi, zf=z-zi, u=xf*xf*(3-2*xf), v=zf*zf*(3-2*zf);
  const a=hashp(xi,zi,p), b=hashp(xi+1,zi,p), c=hashp(xi,zi+1,p), d=hashp(xi+1,zi+1,p); return a+(b-a)*u+(c-a)*v+(a-b-c+d)*u*v; }
function pfbm(x,z,p,o){ let s=0, a=0.5, f=1, n=0; for(let i=0;i<o;i++){ s+=a*pnoise(x*f,z*f,p*f); n+=a; f*=2; a*=0.5; } return s/n; }
function canvas(w,h){ const c=document.createElement("canvas"); c.width=w; c.height=h; return c; }
let ANISO=4;   /* the renderer's best anisotropic filtering (race3d.js sets it): the dirt and the crowd stay crisp at a low angle */
export function setAniso(a){ ANISO=Math.max(1,Math.min(8,a|0||1)); }
export function getAniso(){ return ANISO; }
function tex(c,rep){ const t=new THREE.CanvasTexture(c); t.colorSpace=THREE.SRGBColorSpace; t.wrapS=t.wrapT=rep?THREE.RepeatWrapping:THREE.ClampToEdgeWrapping; t.anisotropy=ANISO; t.needsUpdate=true; return t; }
/* a tangent-space normal map from a height field (wraps; strength = how steep the relief looks) */
function normalTex(Hh,W,strength){
  const c=canvas(W,W), x=c.getContext("2d"), id=x.createImageData(W,W), d=id.data;
  for(let j=0;j<W;j++){ const ju=((j-1+W)%W)*W, jd=((j+1)%W)*W, jr=j*W;
    for(let i=0;i<W;i++){ const l=Hh[jr+(i-1+W)%W], r=Hh[jr+(i+1)%W], u=Hh[ju+i], dn=Hh[jd+i];
      let nx=(l-r)*strength, ny=(dn-u)*strength; const L=Math.sqrt(nx*nx+ny*ny+1); const p=(jr+i)*4;
      d[p]=(nx/L*0.5+0.5)*255; d[p+1]=(ny/L*0.5+0.5)*255; d[p+2]=(1/L*0.5+0.5)*255; d[p+3]=255; } }
  x.putImageData(id,0,0);
  const t=new THREE.CanvasTexture(c); t.colorSpace=THREE.NoColorSpace; t.wrapS=t.wrapT=THREE.RepeatWrapping; t.anisotropy=ANISO; t.needsUpdate=true; return t;
}
function rngf(seed){ let t=seed>>>0; return ()=>{ t=(t+0x6D2B79F5)>>>0; let x=Math.imul(t^(t>>>15),t|1); x^=x+Math.imul(x^(x>>>7),x|61); return ((x^(x>>>14))>>>0)/4294967296; }; }
/* merge plain geometries (position, normal, color, uv) into one non-indexed BufferGeometry */
export function merge(list){
  let n=0; const parts=list.map(g=>{ const q=g.index?g.toNonIndexed():g; n+=q.attributes.position.count; return q; });
  const P=new Float32Array(n*3), N=new Float32Array(n*3), Cc=new Float32Array(n*3), U=new Float32Array(n*2); let o=0;
  parts.forEach(q=>{ const c=q.attributes.position.count; P.set(q.attributes.position.array,o*3); if(q.attributes.normal) N.set(q.attributes.normal.array,o*3);
    if(q.attributes.color) Cc.set(q.attributes.color.array,o*3); else Cc.fill(1,o*3,(o+c)*3); if(q.attributes.uv) U.set(q.attributes.uv.array,o*2); o+=c; });
  const g=new THREE.BufferGeometry(); g.setAttribute("position",new THREE.BufferAttribute(P,3)); g.setAttribute("normal",new THREE.BufferAttribute(N,3));
  g.setAttribute("color",new THREE.BufferAttribute(Cc,3)); g.setAttribute("uv",new THREE.BufferAttribute(U,2)); return g;
}
export function paint(g,rgb){ const q=g.index?g.toNonIndexed():g; const n=q.attributes.position.count, a=new Float32Array(n*3); for(let i=0;i<n;i++){ a[i*3]=rgb[0]; a[i*3+1]=rgb[1]; a[i*3+2]=rgb[2]; } q.setAttribute("color",new THREE.BufferAttribute(a,3)); return q; }
export function xf(g,x,y,z,rx,ry,rz,sx,sy,sz){ const m=new THREE.Matrix4().compose(new THREE.Vector3(x,y,z),new THREE.Quaternion().setFromEuler(new THREE.Euler(rx||0,ry||0,rz||0)),new THREE.Vector3(sx||1,sy||1,sz||1)); g.applyMatrix4(m); return g; }

/* ---------------- the course: where the track is (pure functions of the built course C: no THREE, no state) ---------------- */
function clear(C,x,z,margin){
  /* true if (x, z) is not on the track (any part) */
  const st=Math.max(1,Math.round(1/C.ds));
  for(let i=0;i<C.N;i+=st){ const dx=C.x[i]-x, dz=C.z[i]-z; if(dx*dx+dz*dz<(C.hw[i]+margin)*(C.hw[i]+margin)) return false; }
  if(C.S&&C.S.n) for(let i=0;i<C.S.n;i+=st){ const dx=C.S.x[i]-x, dz=C.S.z[i]-z; if(dx*dx+dz*dz<(C.S.hw[i]+margin)*(C.S.hw[i]+margin)) return false; }
  return true;
}
/* how far (x, z) is from the nearest edge of the track (negative = on it) */
function clearDist(C,x,z){
  const st=Math.max(1,Math.round(1/C.ds)); let best=1e9;
  for(let i=0;i<C.N;i+=st){ const dx=C.x[i]-x, dz=C.z[i]-z, d=Math.sqrt(dx*dx+dz*dz)-C.hw[i]; if(d<best) best=d; }
  if(C.S&&C.S.n) for(let i=0;i<C.S.n;i+=st){ const dx=C.S.x[i]-x, dz=C.S.z[i]-z, d=Math.sqrt(dx*dx+dz*dz)-C.S.hw[i]; if(d<best) best=d; }
  return best;
}

/* ---------------- an instanced limb: the unit bone mesh (+Y) placed from a to b (shared by the bike's fork and the rider's limbs) ---------------- */
const _up=new THREE.Vector3(0,1,0), _bd=new THREE.Vector3(), _bq=new THREE.Quaternion(), _bm1=new THREE.Matrix4(), _bs=new THREE.Vector3();
/* the bone mesh (unit +Y) from a to b (own scratch: a and b may be any vectors) */
const _bx=new THREE.Vector3(), _bz=new THREE.Vector3();
export function bone(m,i,a,b,thick,fw){
  _bd.subVectors(b,a); const len=_bd.length()||1e-4; _bd.multiplyScalar(1/len);
  if(fw){ /* local +X toward fw (the rider's or the bike's front), +Z = X x Y: the limb never spins about its own axis */
    _bx.copy(fw).addScaledVector(_bd,-fw.dot(_bd)); if(_bx.lengthSq()<1e-6) _bx.set(0,1,0).addScaledVector(_bd,-_bd.y); _bx.normalize(); _bz.crossVectors(_bx,_bd);
    const t=thick||1; _bm1.set(_bx.x*t,_bd.x*len,_bz.x*t,a.x, _bx.y*t,_bd.y*len,_bz.y*t,a.y, _bx.z*t,_bd.z*len,_bz.z*t,a.z, 0,0,0,1); m.setMatrixAt(i,_bm1); return; }
  _bq.setFromUnitVectors(_up,_bd); _bs.set(thick||1,len,thick||1); _bm1.compose(a,_bq,_bs); m.setMatrixAt(i,_bm1);
}

export {lin,mixc,clamp,sstep,hash2,vnoise,fbm,hashp,pnoise,pfbm,canvas,tex,normalTex,rngf,clear,clearDist};
