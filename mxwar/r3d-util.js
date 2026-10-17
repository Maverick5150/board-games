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

/* ---------------- the material kit (lead): physically based presets for the bike, the rider, the dirt and the stadium ----------------
   MAT.gloss(color, opts) glossy painted plastic (clear coat)        MAT.plastic(color, opts) satin / matte plastic      MAT.rubber(color, opts) tyres, grips, boots' soles
   MAT.paint(color, opts) painted metal (frame, tank)                MAT.anodized(color, opts) coloured aluminium         MAT.chrome(opts) mirror metal     MAT.steel(opts) brushed steel (exhaust, spokes)
   MAT.fabric(color, opts) jersey, pants, gloves                     MAT.leather(color, opts) boots, seat                 MAT.visor(opts) a dark mirrored visor
   MAT.dirt(color, opts) dry soil (rough, no sheen)                  MAT.mud(color, opts) wet, packed soil with a faint clear coat      material(kind, color, opts) = the same by name.
   color: a hex / CSS string / THREE.Color (omit it when opts.vertexColors is true); opts go to the material's constructor (vertexColors, map, normalMap, side, roughness ... override the preset;
   opts.env scales the preset's environment-map strength).  Every material made here is registered, so setKitTier() can change them all later.
   THE KIT TIER (setKitTier / getKitTier; r3d-look.js follows the quality tier): "high" = MeshPhysicalMaterial (clear coat, sheen: the cover's glossy plastics and helmets), "mid" = MeshStandardMaterial,
   "low" = MeshLambertMaterial / MeshPhongMaterial (no environment map: the Fire TV tier).  The scene's environment map (r3d-look.js) lights every Standard / Physical material by itself. */
let KIT_TIER="high"; const KIT=[];
export function setKitTier(t){ KIT_TIER=(t==="mid"||t==="low")?t:"high"; }
export function getKitTier(){ return KIT_TIER; }
const PRESET={
  gloss:   {rough:0.28,metal:0.00,cc:1.00,ccr:0.06,env:1.00,shin:90, spec:0x777777,matte:0},
  plastic: {rough:0.55,metal:0.00,cc:0.00,ccr:0.50,env:0.55,shin:26, spec:0x303030,matte:0},
  rubber:  {rough:0.93,metal:0.00,cc:0.00,ccr:0.50,env:0.20,shin:5,  spec:0x0c0c0c,matte:1},
  paint:   {rough:0.38,metal:0.55,cc:0.60,ccr:0.12,env:1.00,shin:60, spec:0x666666,matte:0},
  anodized:{rough:0.30,metal:0.92,cc:0.00,ccr:0.50,env:1.00,shin:100,spec:0xaaaaaa,matte:0},
  chrome:  {rough:0.06,metal:1.00,cc:0.00,ccr:0.50,env:1.25,shin:160,spec:0xffffff,matte:0},
  steel:   {rough:0.42,metal:0.95,cc:0.00,ccr:0.50,env:1.00,shin:50, spec:0x999999,matte:0},
  fabric:  {rough:0.92,metal:0.00,cc:0.00,ccr:0.50,env:0.30,shin:4,  spec:0x050505,matte:1,sheen:0.55},
  leather: {rough:0.55,metal:0.00,cc:0.18,ccr:0.40,env:0.50,shin:30, spec:0x222222,matte:0},
  visor:   {rough:0.04,metal:0.85,cc:0.00,ccr:0.50,env:1.50,shin:220,spec:0xffffff,matte:0},
  dirt:    {rough:0.97,metal:0.00,cc:0.00,ccr:0.50,env:0.10,shin:2,  spec:0x000000,matte:1},
  mud:     {rough:0.45,metal:0.00,cc:0.30,ccr:0.50,env:0.60,shin:40, spec:0x333333,matte:0}
};
function kitBuild(kind,color,opts){
  const pr=PRESET[kind]||PRESET.plastic, o=Object.assign({},opts||{}), env=o.env!=null?o.env:1; delete o.env; if(color!=null&&o.color==null) o.color=color;
  let m;
  if(KIT_TIER==="low"){
    if(pr.matte) m=new THREE.MeshLambertMaterial(o);
    else { if(o.roughness!=null) delete o.roughness; delete o.metalness; o.shininess=pr.shin; o.specular=new THREE.Color(pr.spec); m=new THREE.MeshPhongMaterial(o); }
  } else if(KIT_TIER==="mid"||(!pr.cc&&!pr.sheen)){
    if(o.roughness==null) o.roughness=pr.rough; if(o.metalness==null) o.metalness=pr.metal; o.envMapIntensity=(o.envMapIntensity!=null?o.envMapIntensity:pr.env*env); m=new THREE.MeshStandardMaterial(o);
  } else {
    if(o.roughness==null) o.roughness=pr.rough; if(o.metalness==null) o.metalness=pr.metal; o.envMapIntensity=(o.envMapIntensity!=null?o.envMapIntensity:pr.env*env);
    if(pr.cc){ o.clearcoat=pr.cc; o.clearcoatRoughness=pr.ccr; }
    if(pr.sheen){ o.sheen=pr.sheen; o.sheenRoughness=0.8; o.sheenColor=new THREE.Color(0x8890a8); }
    m=new THREE.MeshPhysicalMaterial(o);
  }
  m.userData.kit=kind; return m;
}
export function material(kind,color,opts){ const m=kitBuild(kind,color,opts); KIT.push(m); return m; }
export const MAT={};
["gloss","plastic","rubber","paint","anodized","fabric","leather","dirt","mud"].forEach(k=>{ MAT[k]=(c,o)=>material(k,c,o); });
["chrome","steel","visor"].forEach(k=>{ MAT[k]=(o)=>material(k,null,o); });
/* a physically based stand-in for an existing Phong material (the base bike and helmet: gloss for a high shininess, metal for a lower one): the lead's upgrade (r3d-look.js) uses it, high tier only */
export function pbrFromPhong(m,tier){
  const o={vertexColors:m.vertexColors,map:m.map,color:m.color.clone(),side:m.side,transparent:m.transparent,opacity:m.opacity};
  const gloss=m.shininess>=60; const saved=KIT_TIER; KIT_TIER=tier||"high";
  const r=kitBuild(gloss?(m.shininess>=100?"gloss":"gloss"):"steel",null,o); KIT_TIER=saved;
  if(m.onBeforeCompile!==THREE.Material.prototype.onBeforeCompile){ r.onBeforeCompile=m.onBeforeCompile; r.customProgramCacheKey=m.customProgramCacheKey; }
  return r;
}

export {lin,mixc,clamp,sstep,hash2,vnoise,fbm,hashp,pnoise,pfbm,canvas,tex,normalTex,rngf,clear,clearDist};
