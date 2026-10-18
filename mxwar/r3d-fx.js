/* MOTOCROSS WAR 3D — EFFECTS (owner: fx): the flying dirt of the cover and the race atmosphere, all driven by the riders' real motion.
   Milestone 2, "the dirt storm": the cover is a STORM of crumbs (hundreds of motion-blurred specks, fewer chunky clods of darker moist dirt, backlit dust,
   roost arcs that fill the foreground), never a veil over the pack. What it draws (every piece pooled and instanced, counts set by the quality tier):
   - SPECKS (new): thousands of crumbs on the GPU (radius about 0.4-2.6 cm, median 1 cm: what reads at the chase distance). A speck is written ONCE when it
     is thrown (where, how fast, when, its size, drag and colour) and the vertex shader moves it on a ballistic arc with air drag (an exact solution, no
     per-frame CPU work or upload). THE SHUTTER: its trail is where it was 1/250 s ago RELATIVE TO THE LENS (its flight minus the camera's motion over the
     last tick), both ends projected, at most 5.5% of the frame height and 5 crumb widths, never thinner than 1.4 px, fainter the longer it is; it fades near the lens and its
     size is capped there. A quarter of them are flat CHIPS that tumble and catch the light. Colours from dark wet soil to light dry tan. On the high tiers
     their cores write depth, so the depth of field keeps a crumb at its own distance sharp. The roost: a rooster tail under power inside a wider fan,
     berm spray to the outside, front-wheel flicks, a steady spray at speed; take-offs, landings and crashes throw them too.
   - CLODS: low-poly rocks (an InstancedMesh, 20 triangles, 8 on the weak tiers): darker moist dirt (a physically based material with a wet sheen on the
     high tiers, no warm emissive floor: the highlights stay brown), log-normal sizes (radius about 1-3.4 cm, 4% chunks to 6.5 cm, up to 1.6x off the start
     pad), lit by the scene's lights, tumbling, stretched along their velocity when fast, bouncing and settling on the real ground (Course.ground), then
     shrinking away; they shrink inside 1.6 m of the lens.
   - SPRITES (one instanced billboard draw call): DUST puffs (lumpy, baked normals, lit by the scene's lights with forward scattering when a light is
     behind them, a warm glow when seen against the ring of floodlight banks, thinner higher up) and HAZE (big faint puffs trailing the pack). THE VEIL RULE: a puff fades from 2.2 m to 0.7 m from the lens, a puff
     never covers more than about a fifth of the frame's height, and the whole dust layer's opacity-weighted coverage of the frame is capped (`uVeil`,
     worked out while the frame is drawn from the drawing camera: nothing in the simulation reads the camera).
   - MOTES (high tier): dust specks floating round the camera; LENS flecks (high tier): mud on the lens behind a roosting rider (draw-time only).
   Emission rules (FX.inputs / FX.rider / take-off / landing / crash) read the per-rider state of CONTRACT.md section 5. Determinism: a private seeded
   generator (never Math.random); the simulation never reads the camera on the high tiers; the specks move with the simulation clock (a uniform).
   API (race3d.js hook zones): createFx({lo, C, look, tier?, fx?}) -> FX: FX.group, FX.inputs(st, dt), FX.rider(st, dt), FX.step(dt), FX.focus(a, b),
   FX.crashStart(f, gy, r), FX.crashStep(...), FX.stats(), FX.setBudget(0..1), FX.debug(x, z, r), FX.hash(), FX.dispose(), FX.part (the clods).
   The old module functions emit(P, ...) and stepParticles(P, dt) stay (r3d-riders.js re-exports them). */
import * as THREE_NS from "../ui/vendor/three-0.160.0.module.min.js";
const THREE=THREE_NS;
import {canvas,clamp,sstep} from "./r3d-util.js";
import {motionMode,isTV} from "./r3d-quality.js";
const GL=typeof window!=="undefined"?window:globalThis;

/* ---------------- the tiers: how much of everything (perf: pass {tier: "high" | "medium" | "low" | "stick"} or {fx: {...overrides}} in Q.options) ----------------
   specks = the GPU crumb pool (spk = its emission scale); clods = mesh rocks; puffs / haze = dust sprites; veil = the dust layer's coverage cap; depth = the specks' cores write depth (the depth of field);
   bank = how strongly the dust glows when it is seen against the ring of floodlight banks (forward scattering); size = crumbs and clods larger on the
   lower resolutions and smaller pools (FIRE TV draws 960x540: a 1 cm crumb there is under a pixel at 5 m) */
const TIERS={
  high:  {n:"high",   specks:20000, spk:1.00, clods:1400, puffs:300, haze:36, motes:170, lens:6, rock:20, rate:1.00, atlas:128, pbr:true,  depth:true,  veil:0.30, maxPx:12, bank:0.30, size:1.0},
  medium:{n:"medium", specks:5000, spk:0.75, clods:640,  puffs:150, haze:14, motes:80,  lens:0, rock:20, rate:0.85, atlas:128, pbr:true,  depth:true,  veil:0.28, maxPx:11, bank:0.26, size:1.15},
  low:   {n:"low",    specks:1200, spk:0.55, clods:240,  puffs:64,  haze:0,  motes:0,   lens:0, rock:8,  rate:0.7,  atlas:96,  pbr:false, depth:false, veil:0.24, maxPx:9,  bank:0.22, size:1.5},
  ultra: {n:"ultra",  specks:26000, spk:1.20, clods:2000, puffs:380, haze:44, motes:210, lens:6, rock:20, rate:1.00, atlas:128, pbr:true,  depth:true,  veil:0.32, maxPx:13, bank:0.30, size:1.0},
  stick: {n:"stick",  specks:1400, spk:0.55, clods:160,  puffs:40,  haze:0,  motes:0,   lens:0, rock:8,  rate:0.6,  atlas:96,  pbr:false, depth:false, veil:0.22, maxPx:9,  bank:0.22, size:1.7}
};
const ALIAS={firetv:"stick",stick:"stick",low:"low",balanced:"medium",medium:"medium",high:"high",ultra:"ultra"};
function tierOf(o){
  let t=ALIAS[String(o.tier||o.fxTier||o.quality||"").toLowerCase()];
  if(o.lo){ if(t!=="stick"&&t!=="low") t=isTV()?"stick":"low"; } else if(!t) t="high";   /* Reduce effects is the weak tiers whatever the name */
  const r=Object.assign({},TIERS[t]); if(o.fx&&typeof o.fx==="object"&&o.fx.clods!=null) Object.assign(r,o.fx);   /* (perf's q.fx is {particles, scale}: not a pool override) */
  return r;
}

/* ---------------- the old particle ring buffer (kept: r3d-riders.js still re-exports these two) ---------------- */
export function emit(P,x,y,z,vx,vy,vz,size,life,dirt){
  const k=P.next; P.next=(P.next+1)%P.n;
  P.pos[k*3]=x; P.pos[k*3+1]=y; P.pos[k*3+2]=z; P.vel[k*3]=vx; P.vel[k*3+1]=vy; P.vel[k*3+2]=vz; P.life[k]=life; P.max[k]=life; P.size[k]=size;
  const c=dirt||[0.36,0.27,0.19]; P.col[k*3]=c[0]; P.col[k*3+1]=c[1]; P.col[k*3+2]=c[2]; P.vari[k]=(k*7)%4;
}
export function stepParticles(P,dt){
  for(let k=0;k<P.n;k++){ if(P.life[k]<=0){ if(P.alpha) P.alpha[k]=0; continue; } P.life[k]-=dt; const t=P.life[k]/P.max[k];
    P.vel[k*3+1]-=9.81*dt*(P.size[k]>0.3?0.15:1); const dr=P.size[k]>0.3?1-1.6*dt:1-0.4*dt; P.vel[k*3]*=dr; P.vel[k*3+2]*=dr;
    P.pos[k*3]+=P.vel[k*3]*dt; P.pos[k*3+1]+=P.vel[k*3+1]*dt; P.pos[k*3+2]+=P.vel[k*3+2]*dt;
    if(P.size[k]>0.3) P.size[k]+=dt*0.9;
    if(P.alpha) P.alpha[k]=Math.max(0,Math.min(1,t*1.6))*(P.size[k]>0.3?0.32:0.9); }
}

/* ---------------- the dust puff atlas: 2 x 2 lumpy puffs; R, G = the puff's surface normal in screen space, B = density, A = coverage ---------------- */
let ATLAS_CACHE={};
function atlasData(cell){
  if(ATLAS_CACHE[cell]) return ATLAS_CACHE[cell];
  const W=cell*2, c=canvas(W,W), x=c.getContext("2d",{willReadFrequently:true});
  x.clearRect(0,0,W,W);
  let sd=987654321; const R=()=>{ sd=(sd*16807)%2147483647; return sd/2147483647; };
  for(let v=0;v<4;v++){
    const ox=(v%2)*cell, oy=(v>>1)*cell, nb=22+v*3;
    for(let k=0;k<nb;k++){
      const a=R()*6.2832, d=Math.pow(R(),0.8)*0.26*cell, px=ox+cell*0.5+Math.cos(a)*d, py=oy+cell*0.5+Math.sin(a)*d*0.88, r=(0.07+0.115*R())*cell, g=x.createRadialGradient(px,py,0,px,py,r);
      g.addColorStop(0,"rgba(255,255,255,0.5)"); g.addColorStop(0.5,"rgba(255,255,255,0.24)"); g.addColorStop(1,"rgba(255,255,255,0)");
      x.fillStyle=g; x.beginPath(); x.arc(px,py,r,0,6.2832); x.fill();
    }
  }
  const src=x.getImageData(0,0,W,W).data, h=new Float32Array(W*W), out=new Uint8Array(W*W*4);
  for(let i=0;i<W*W;i++) h[i]=src[i*4+3]/255;
  const at=(i,j)=>h[Math.max(0,Math.min(W-1,j))*W+Math.max(0,Math.min(W-1,i))];
  for(let j=0;j<W;j++) for(let i=0;i<W;i++){
    const cx=((i%cell)+0.5)/cell*2-1, cy=((j%cell)+0.5)/cell*2-1, rr=Math.sqrt(cx*cx+cy*cy), win=1-sstep(0.7,0.97,rr);
    const hx=at(i+2,j)-at(i-2,j), hy=at(i,j+2)-at(i,j-2);
    let nx=-hx*2.6, ny=hy*2.6; const L=Math.sqrt(nx*nx+ny*ny+1); nx/=L; ny/=L;
    const hh=h[j*W+i]*win, a=sstep(0.03,0.5,hh)*win, o=((W-1-j)*W+i)*4;   /* the canvas is top down, a GL texture bottom up */
    out[o]=Math.round((nx*0.5+0.5)*255); out[o+1]=Math.round((ny*0.5+0.5)*255); out[o+2]=Math.round(Math.min(1,hh*1.6)*255); out[o+3]=Math.round(a*255);
  }
  return (ATLAS_CACHE[cell]={data:out,size:W});
}
function atlasTexture(cell){
  const A=atlasData(cell), t=new THREE.DataTexture(A.data,A.size,A.size,THREE.RGBAFormat);
  t.colorSpace=THREE.NoColorSpace; t.minFilter=THREE.LinearMipmapLinearFilter; t.magFilter=THREE.LinearFilter; t.generateMipmaps=true; t.wrapS=t.wrapT=THREE.ClampToEdgeWrapping; t.needsUpdate=true; return t;
}

/* ---------------- one clod: a jittered low-poly rock (flat faces, so it catches the light like a lump of dirt) ---------------- */
function rockGeometry(tris){
  const g0=tris>=20?new THREE.IcosahedronGeometry(1,0):new THREE.OctahedronGeometry(1,0), g=g0.index?g0.toNonIndexed():g0, p=g.attributes.position, seen=new Map();
  for(let i=0;i<p.count;i++){
    const x=p.getX(i), y=p.getY(i), z=p.getZ(i), key=x.toFixed(3)+","+y.toFixed(3)+","+z.toFixed(3);
    let d=seen.get(key); if(d===undefined){ const s=Math.sin(x*127.1+y*311.7+z*74.7)*43758.5453; d=0.72+0.56*(s-Math.floor(s)); seen.set(key,d); }
    p.setXYZ(i,x*d,y*d*0.82,z*d);
  }
  g.computeVertexNormals();
  const nr=g.attributes.normal, col=new Float32Array(p.count*3);
  for(let i=0;i<p.count;i++){ const x=p.getX(i), y=p.getY(i), z=p.getZ(i), l=Math.hypot(x,y,z)||1, nx=nr.getX(i)*0.45+x/l*0.55, ny=nr.getY(i)*0.45+y/l*0.55, nz=nr.getZ(i)*0.45+z/l*0.55, nl=Math.hypot(nx,ny,nz)||1; nr.setXYZ(i,nx/nl,ny/nl,nz/nl); }   /* (m2: lumpier than the polish step's round balls: half facet, half radial) */
  for(let i=0;i<p.count;i++){ const f=Math.floor(i/3), h=Math.sin(f*91.7+1.3)*43758.5453, tone=(0.82+0.36*(h-Math.floor(h)))*(0.7+0.4*(nr.getY(i)*0.5+0.5)); col[i*3]=tone; col[i*3+1]=tone*0.97; col[i*3+2]=tone*0.93; }
  g.setAttribute("color",new THREE.BufferAttribute(col,3)); return g;
}

/* ---------------- the sprite shaders (dust and haze): instanced billboards, lit with the scene's own lights ---------------- */
const LIGHT_FN=[
"vec3 sceneLight(vec3 n,vec3 vd,float back){",   /* the scene's lights on a soft normal: ambient + hemisphere + wrapped directional, plus the forward scatter toward a light behind the particle (tinted warm, like the cover's backlit dust) */
"  vec3 L=ambientLightColor;",
"  #if NUM_HEMI_LIGHTS > 0",
"  for(int i=0;i<NUM_HEMI_LIGHTS;i++) L+=getHemisphereLightIrradiance(hemisphereLights[i],n);",
"  #endif",
"  #if NUM_DIR_LIGHTS > 0",
"  for(int i=0;i<NUM_DIR_LIGHTS;i++){ vec3 ld=directionalLights[i].direction; float w=dot(n,ld)*0.5+0.5; float f=max(0.0,dot(vd,ld)); L+=directionalLights[i].color*(w*w+back*f*f*f*vec3(1.0,0.78,0.5)); }",
"  #endif",
"  return L*RECIPROCAL_PI;",
"}"].join("\n");
const SPR_VS=[
"attribute vec4 aA; attribute vec4 aB; attribute vec4 aC; attribute vec4 aD;",   /* aA = x y z radius; aB = vx vy vz alpha; aC = r g b kind (1..4 puff variants); aD = rotation, the ground under it, -, - */
"uniform float uH; uniform float uVeil; uniform float uCapR; uniform float uBank;",
"varying vec2 vUv; varying vec4 vC; varying float vA; varying vec2 vRot; varying vec3 vVP; varying float vGlow;",
"#include <fog_pars_vertex>",
"void main(){",
"  vec4 mvPosition=modelViewMatrix*vec4(aA.xyz,1.0);",
"  float depth=max(0.05,-mvPosition.z), size=aA.w, alpha=aB.w;",
"  vec2 c=position.xy;",
"  float cs=cos(aD.x), sn=sin(aD.x); vec2 off=vec2(cs*c.x-sn*c.y,sn*c.x+cs*c.y)*size; vRot=vec2(cs,sn);",
"  float ry=size*projectionMatrix[1][1]/depth;",                    /* the puff's radius as a share of the half height */
"  alpha*=smoothstep(0.7,2.2,depth);",                               /* m2: a puff fades from 2.2 m to 0.7 m from the lens (it never fills the lens) */
"  alpha*=ry>uCapR?mix(pow(uCapR/ry,1.5),1.0,smoothstep(3.0,6.0,depth)):1.0;",   /* m2: near the lens no single puff covers more than about a quarter of the frame's height; from 6 m a big cloud is a cloud (the layer cap still holds) */
"  alpha*=mix(1.0,0.4,smoothstep(0.7,3.0,aA.y-aD.y));",              /* m2: denser near the floor, thinner higher up */
"  alpha*=uVeil;",                                                   /* m2: the whole dust layer's coverage cap (set while the frame is drawn) */
"  vec3 wd=normalize(aA.xyz-cameraPosition); float ce=0.868*sqrt(max(0.0,1.0-wd.y*wd.y))+0.497*wd.y;",   /* m2: the ring of floodlight banks 30 degrees up all round the bowl: the angle between the view ray and the nearest bank */
"  vGlow=uBank*0.64/pow(1.36-1.2*clamp(ce,-1.0,1.0),1.5);",          /* forward scattering (Henyey-Greenstein, g 0.6): dust seen against the lights glows, dust seen from above does not */
"  mvPosition.xy+=off; vVP=mvPosition.xyz; vUv=c*0.5+0.5; vC=aC; vA=alpha;",
"  gl_Position=projectionMatrix*mvPosition;",
"  #include <fog_vertex>",
"}"].join("\n");
const SPR_FS=[
"uniform sampler2D uAtlas; uniform float uGain;",
"varying vec2 vUv; varying vec4 vC; varying float vA; varying vec2 vRot; varying vec3 vVP; varying float vGlow;",
"#include <common>",
"#include <fog_pars_fragment>",
"#include <lights_pars_begin>",
LIGHT_FN,
"void main(){",
"  vec3 vd=normalize(vVP);",
"  float cell=floor(vC.w-0.5); vec2 uv=(vec2(mod(cell,2.0),floor(cell*0.5))+0.02+0.96*vUv)*0.5; vec4 t=texture2D(uAtlas,uv);",
"  vec2 nt=t.rg*2.0-1.0; vec3 n=normalize(vec3(vRot.x*nt.x-vRot.y*nt.y,vRot.y*nt.x+vRot.x*nt.y,0.62));",
"  vec3 L=sceneLight(n,vd,0.8)*(1.0-0.26*t.b)+vGlow*vec3(1.0,0.72,0.42)*(0.45+0.55*(1.0-t.b));",   /* the thick middle is a little darker (self shadow) unless the light is behind it */
"  vec4 col=vec4(vC.rgb*L*uGain,pow(t.a,1.6)*vA);",   /* m2: softer edges (dust, not a disc) */
"  if(col.a<0.003) discard;",
"  gl_FragColor=col;",
"  #include <tonemapping_fragment>",
"  #include <colorspace_fragment>",
"  #include <fog_fragment>",
"}"].join("\n");

/* ---------------- the speck shaders: ballistic crumbs moved on the GPU ---------------- */
const SPK_VS=[
"attribute vec4 aP; attribute vec4 aV; attribute vec4 aS; attribute vec4 aK;",   /* aP = x0 y0 z0 t0 (thrown); aV = vx vy vz life; aS = the ground y, radius, drag, seed; aK = r g b, kind (0 grain, 1 chip) */
"uniform float uTime; uniform float uH; uniform float uShutter; uniform float uMaxPx; uniform float uBank; uniform vec3 uCamV; uniform float uMaxTrail;",
"varying vec2 vUv; varying vec3 vCol; varying float vA; varying float vGlint; varying vec3 vVP; varying float vBank; varying float vLen; varying vec2 vDir;",
"#include <fog_pars_vertex>",
"void main(){",
"  vUv=position.xy; vCol=aK.rgb; vA=0.0; vGlint=0.0; vVP=vec3(0.0,0.0,-1.0); vBank=0.0; vLen=1.0; vDir=vec2(1.0,0.0);",
"  float age=uTime-aP.w, life=aV.w;",
"  if(age<0.0||age>=life){ gl_Position=vec4(0.0,0.0,2.0,1.0); return; }",
"  float k=aS.z, e=exp(-k*age); vec3 vt=vec3(0.0,-9.81/k,0.0);",                     /* the exact flight with linear air drag: v(t) = vt + (v0 - vt) e^(-kt) */
"  vec3 p=aP.xyz+vt*age+(aV.xyz-vt)*((1.0-e)/k), v=vt+(aV.xyz-vt)*e;",
"  float sink=aS.x-p.y;",                                                            /* under the dirt it is gone (the clods do the settling) */
"  float alpha=(1.0-step(0.0,sink))*smoothstep(0.0,0.025,age)*(1.0-smoothstep(0.7*life,life,age));",
"  if(sink>0.0){ p.y=aS.x; v=vec3(0.0); }",
"  vec4 mvPosition=modelViewMatrix*vec4(p,1.0);",
"  float depth=-mvPosition.z;",
"  if(depth<0.12||alpha<0.002){ gl_Position=vec4(0.0,0.0,2.0,1.0); return; }",
"  float ppm=uH*0.5*projectionMatrix[1][1]/depth, rad=aS.y, px=rad*ppm;",           /* pixels a metre at its depth; its radius in pixels */
"  float kw=px<0.7?0.7/max(px,1e-4):1.0;",                                          /* never thinner than about 1.4 px across ... */
"  alpha*=clamp(px/0.7,0.18,1.0);",                                                 /* ... a sub-pixel crumb fades instead of shimmering (m2: but not below 0.18: a far roost of hundreds still reads from the stands) */
"  float cap=px*kw>uMaxPx?uMaxPx/(px*kw):1.0;",                                     /* near the lens a crumb never becomes a blob */
"  float hw=px*kw*cap;",                                                            /* its half width on the screen (px) */
"  if(aK.w>0.5){ float ph=aS.w*40.0+age*(9.0+15.0*fract(aS.w*13.7)); hw*=0.3+0.7*abs(cos(ph)); float g=abs(sin(ph)); g*=g; g*=g; vGlint=g*g; }",   /* a flat chip tumbling: it thins and flashes as it turns */
"  vec3 vr=(modelViewMatrix*vec4(v-uCamV,0.0)).xyz; vec3 q=mvPosition.xyz-vr*uShutter; q.z=min(q.z,-0.1);",   /* THE SHUTTER (m2): where it was one shutter ago RELATIVE TO THE LENS (its flight minus the camera's motion) ... */
"  vec4 c0=projectionMatrix*mvPosition, c1=projectionMatrix*vec4(q,1.0); vec2 sp=vec2(projectionMatrix[1][1]/projectionMatrix[0][0],1.0)*(uH*0.5);",   /* ... both ends projected (clip -> square pixels): dirt the camera rushes past streaks, dirt flying along with it does not */
"  vec2 d=c0.xy/c0.w*sp-c1.xy/c1.w*sp; float lp=length(d), lmax=min(uMaxTrail,10.0*hw); if(lp>lmax){ d*=lmax/max(lp,1e-4); lp=lmax; } vec2 dir=lp>1e-3?d/lp:vec2(1.0,0.0);",
"  float hl=hw+0.5*lp; vLen=hl/max(hw,1e-3); vDir=dir;",
"  alpha*=clamp(1.7*hw/hl,0.3,1.0);",                                               /* a long streak is fainter (the same dirt, spread out) */
"  alpha*=smoothstep(0.3,1.1,depth)*(1.0-smoothstep(75.0,120.0,depth));",
"  vec2 sc=c0.xy/c0.w*sp+dir*(position.x*hl-0.5*lp)+vec2(-dir.y,dir.x)*(position.y*hw);",   /* the quad in pixels, centred half a trail behind the crumb */
"  vec3 wd=normalize(p-cameraPosition); float ce=clamp(0.868*sqrt(max(0.0,1.0-wd.y*wd.y))+0.497*wd.y,-1.0,1.0); vBank=uBank*0.64/pow(1.36-1.2*ce,1.5);",   /* seen against the ring of floodlight banks a crumb has a warm bright rim (forward scattering, as the dust) */
"  vVP=mvPosition.xyz; vA=alpha;",
"  gl_Position=vec4(sc/sp*c0.w,c0.z,c0.w);",
"  #include <fog_vertex>",
"}"].join("\n");
const SPK_FS=[
"uniform float uGain;",
"varying vec2 vUv; varying vec3 vCol; varying float vA; varying float vGlint; varying vec3 vVP; varying float vBank; varying float vLen; varying vec2 vDir;",
"#include <common>",
"#include <fog_pars_fragment>",
"#include <lights_pars_begin>",
LIGHT_FN,
"void main(){",
"  float x=vUv.x*vLen, ex=max(abs(x)-(vLen-1.0),0.0)*sign(x); vec2 q=vec2(ex,vUv.y); float r=length(q);",   /* m2: a capsule, not a stretched disc (a stretched disc read as a leaf or a coin) */
"  #ifdef SPK_DEPTH",
"  if(r>0.92||vA<0.012) discard;",                      /* a crumb has a hard edge: its core goes into the depth buffer, so the depth of field keeps it at its own distance */
"  float a=vA;",
"  #else",
"  float a=vA*(1.0-smoothstep(0.62,1.0,r));",
"  if(a<0.004) discard;",
"  #endif",
"  vec3 vd=normalize(vVP);",
"  vec2 sv=q.x*vDir+q.y*vec2(-vDir.y,vDir.x); vec3 n=normalize(vec3(sv,sqrt(max(0.0,1.0-dot(sv,sv)))+0.15));",   /* m2: a lump of dirt: the normal of a ball under the fragment (a lit side and a dark side) */
"  vec3 L=sceneLight(n,vd,0.7);",
"  vec3 col=vCol*L*uGain*1.1+vCol*vBank*vec3(1.0,0.72,0.42)*(0.2+0.6*r)+vGlint*vec3(1.0,0.82,0.58)*1.6;",
"  gl_FragColor=vec4(col,a);",
"  #include <tonemapping_fragment>",
"  #include <colorspace_fragment>",
"  #include <fog_fragment>",
"}"].join("\n");

const MOTE_VS=[
"uniform vec3 uCam; uniform float uT; uniform vec3 uBox; uniform float uH; uniform float uSize;",
"varying float vA;",
"void main(){",
"  vec3 s=position;",
"  vec3 p=s*uBox+vec3(0.5*sin(uT*0.31+s.y*40.0),-0.16*uT+0.35*sin(uT*0.23+s.x*30.0),0.5*cos(uT*0.27+s.z*30.0));",
"  vec3 q=mod(p-uCam,uBox)-0.5*uBox; vec4 mv=viewMatrix*vec4(uCam+q,1.0);",
"  float depth=max(0.2,-mv.z), e=max(abs(q.x)/uBox.x,max(abs(q.y)/uBox.y,abs(q.z)/uBox.z));",
"  float tw=0.5+0.5*sin(uT*(1.3+s.x*2.2)+s.z*60.0);",
"  gl_PointSize=clamp(uSize*uH/depth,1.4,3.6);",
"  vA=(1.0-smoothstep(0.34,0.5,e))*(0.35+0.65*tw)*smoothstep(0.8,3.0,depth)*(1.0-smoothstep(16.0,28.0,depth))*step(0.0,-mv.z);",
"  gl_Position=projectionMatrix*mv;",
"}"].join("\n");
const MOTE_FS=[
"uniform vec3 uCol; varying float vA;",
"void main(){ vec2 d=gl_PointCoord-0.5; float r=dot(d,d)*4.0; if(r>1.0||vA<0.004) discard; gl_FragColor=vec4(uCol,vA*(1.0-r)*0.6);",
"  #include <tonemapping_fragment>",
"  #include <colorspace_fragment>",
"}"].join("\n");

const LENS_VS=K=>[
"attribute vec4 aS; uniform float uVis["+K+"]; uniform float uAspect;",   /* aS = centre x, y (screen, -1..1), radius (fraction of the height), seed; uVis = how much of each shows (a uniform: set while the lens is drawn, it applies to that very draw; an attribute set there would upload one draw late) */
"varying vec2 vUv; varying float vSeed; varying float vVis;",
"void main(){ float av=uVis[gl_InstanceID]; vUv=position.xy; vSeed=aS.w; vVis=av; vec2 p=aS.xy+position.xy*vec2(aS.z/uAspect,aS.z)*step(0.002,av); gl_Position=vec4(p,0.0,1.0); }"].join("\n");
const LENS_FS=[
"varying vec2 vUv; varying float vSeed; varying float vVis;",
"void main(){",
"  float r=length(vUv), ang=atan(vUv.y,vUv.x), edge=0.72+0.16*sin(ang*3.0+vSeed*17.0)+0.09*sin(ang*7.0+vSeed*31.0)+0.05*sin(ang*13.0+vSeed*7.0);",
"  float m=1.0-smoothstep(edge-0.1,edge,r); if(m<0.01) discard;",
"  vec3 col=mix(vec3(0.045,0.027,0.016),vec3(0.2,0.115,0.055),smoothstep(0.15,0.85,r));",
"  col+=vec3(0.55,0.5,0.42)*smoothstep(0.3,0.0,length(vUv-vec2(-0.28,0.32)))*0.32;",
"  gl_FragColor=vec4(col,m*vVis*0.78);",
"  #include <tonemapping_fragment>",
"  #include <colorspace_fragment>",
"}"].join("\n");

export function createFx(opts){
  opts=opts||{};
  const lo=!!opts.lo, C=opts.C, look=opts.look||{}, T=tierOf(opts), OFF=motionMode()==="off", stadium=!!(C&&C.kind==="stadium"), CAM=opts.cam&&T.n!=="high"&&T.n!=="ultra"?opts.cam:null, LIVE=opts.live||null;   /* the camera ranks the riders on the weaker tiers only (the high tier stays a pure function of the race) */
  const grp=new THREE.Group(); grp.name="fx";
  const MXC=GL.MXWar&&GL.MXWar.Course;
  /* the soil (linear colours; the shaders light them): wet = dark moist crumbs and clods, mid = the soil, dry = light dry tan, dust = the fine dust
     (m2: darker and more saturated than milestone 1's: lit by a 6.8 key their highlights now stay warm brown instead of clipping to cream) */
  const soil=look.soil||"stadium-dirt";
  const B0=soil==="sand"?{clod:[0.30,0.22,0.12],dust:[0.40,0.31,0.19],loose:1.0}:soil==="hardpack"?{clod:[0.16,0.1,0.058],dust:[0.34,0.25,0.15],loose:0.8}
    :soil==="loam"?{clod:[0.07,0.045,0.027],dust:[0.22,0.155,0.1],loose:0.45}:soil==="clay"?{clod:[0.15,0.07,0.034],dust:[0.31,0.19,0.105],loose:0.6}:{clod:[0.19,0.108,0.056],dust:[0.30,0.19,0.10],loose:0.7};
  const mul=(c,k)=>[c[0]*k,c[1]*k,c[2]*k], mix3=(a,b,t)=>[a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t,a[2]+(b[2]-a[2])*t];
  const COL={wet:mul(B0.clod,0.34),mid:mul(B0.clod,0.66),dry:mul(mix3(B0.clod,B0.dust,0.6),0.9),dust:B0.dust,loose:B0.loose};
  COL.clod=COL.mid;
  /* a private generator: the effects never touch Math.random (same race = same dirt) */
  let sd=0x5EEDF00D|0; const rnd=()=>{ sd=(sd+0x6D2B79F5)|0; let t=Math.imul(sd^(sd>>>15),1|sd); t=(t+Math.imul(t^(t>>>7),61|t))^t; return ((t^(t>>>14))>>>0)/4294967296; };
  const gauss=()=>(rnd()+rnd()+rnd()+rnd()-2)*1.732;   /* about a unit normal (Irwin-Hall) */
  const logn=(med,s,a,b)=>clamp(med*Math.exp(s*gauss()),a,b);
  const FX={group:grp,lo:lo,tier:T.n,budget:1,off:OFF,time:0};
  const noop=()=>{};
  if(OFF){ FX.inputs=FX.rider=FX.step=FX.crashStart=FX.crashStep=FX.setBudget=FX.dispose=FX.focus=FX.debug=noop; FX.stats=()=>({tier:T.n,off:true}); FX.hash=()=>({off:true}); FX.emit=noop; FX.part={n:0,life:new Float32Array(0)}; return FX; }

  /* ================= CLODS: an InstancedMesh of rocks ================= */
  const NC=T.clods, cPos=new Float32Array(NC*3), cVel=new Float32Array(NC*3), cLife=new Float32Array(NC), cRad=new Float32Array(NC), cSc=new Float32Array(NC*3), cAx=new Float32Array(NC*3),
    cAng=new Float32Array(NC), cSpin=new Float32Array(NC), cRest=new Uint8Array(NC), cAlive=new Uint8Array(NC), cS0=new Float32Array(NC), cL0=new Float32Array(NC), cCs=new Float32Array(NC), cSn=new Float32Array(NC),
    cX0=new Float32Array(NC), cZ0=new Float32Array(NC), cG0=new Float32Array(NC), cMax=new Float32Array(NC);
  const rockG=rockGeometry(T.rock);
  /* m2: moist dark dirt. The high tiers: a physically based material (rough 0.55: a wet sheen catches the floodlights), the weak tiers Lambert; no warm emissive floor (it lifted every clod to tan) */
  const rockM=T.pbr?new THREE.MeshStandardMaterial({color:0xffffff,vertexColors:true,roughness:0.56,metalness:0,envMapIntensity:0.55}):new THREE.MeshLambertMaterial({color:0xffffff,vertexColors:true,emissive:0x0b0603});
  rockM.onBeforeCompile=function(sh){ sh.vertexShader=sh.vertexShader.replace("#include <begin_vertex>","#include <begin_vertex>\n#ifdef USE_INSTANCING\n  transformed*=smoothstep(0.35,1.6,-(modelViewMatrix*instanceMatrix*vec4(0.0,0.0,0.0,1.0)).z);\n#endif"); };   /* (m2: shrink inside 1.6 m of the lens, not 1.1: no clod is ever a blob on the lens) */
  const rocks=new THREE.InstancedMesh(rockG,rockM,NC); rocks.frustumCulled=false; rocks.receiveShadow=true; rocks.castShadow=false; rocks.name="fx-clods";
  rocks.instanceMatrix.setUsage(THREE.DynamicDrawUsage); rocks.setColorAt(0,new THREE.Color(1,1,1)); rocks.instanceColor.setUsage(THREE.DynamicDrawUsage);
  const cm=rocks.instanceMatrix.array, ccol=rocks.instanceColor.array;
  for(let k=0;k<NC;k++){ cm[k*16+15]=1; cm[k*16+12]=0; cm[k*16+13]=-999; cm[k*16+14]=0; }
  grp.add(rocks);
  let cNext=0, cLive=0, colDirty=true;
  const hwOf=C&&C.hw, shoulder=stadium?0.3:0.55, floorY=stadium?-0.16:-1e9;
  /* the dirt's height under a clod: its own course coordinates from where it left (s, lateral), the course's real ground(); the start pad is flat */
  function groundAt(k,x,z){
    if(cS0[k]<0||!MXC) return cG0[k];
    const dx=x-cX0[k], dz=z-cZ0[k], s=cS0[k]+dx*cCs[k]+dz*cSn[k], lat=cL0[k]-dx*cSn[k]+dz*cCs[k];
    const i=Math.round(MXC.wrap(C,s)/C.ds)%C.N, hw=hwOf[i], a=Math.abs(lat);
    let g=MXC.ground(C,s,a>hw?(lat<0?-hw:hw):lat); if(a>hw) g-=shoulder*sstep(0,2.2,a-hw);
    return g>floorY?g:floorY;
  }
  /* one clod: where, how fast, radius (m), life (s), linear colour, the ground reference (s0 < 0 = flat at gy) */
  function clod(x,y,z,vx,vy,vz,rad,life,col,gy,s0,lat0,th0){
    const k=cNext; cNext=(cNext+1)%NC; const o=k*3;
    cPos[o]=x; cPos[o+1]=y; cPos[o+2]=z; cVel[o]=vx; cVel[o+1]=vy; cVel[o+2]=vz; cLife[k]=life; cMax[k]=life; cRad[k]=rad; cRest[k]=0;
    const q1=0.7+0.65*rnd(), q2=0.6+0.6*rnd(), q3=0.7+0.6*rnd(); cSc[o]=q1; cSc[o+1]=q2; cSc[o+2]=q3;
    let ax=rnd()-0.5, ay=rnd()-0.5, az=rnd()-0.5; const al=Math.sqrt(ax*ax+ay*ay+az*az)||1; cAx[o]=ax/al; cAx[o+1]=ay/al; cAx[o+2]=az/al; cAng[k]=rnd()*6.28; cSpin[k]=(rnd()<0.5?-1:1)*(4+14*rnd());
    cS0[k]=s0; cL0[k]=lat0; cCs[k]=Math.cos(th0); cSn[k]=Math.sin(th0); cX0[k]=x; cZ0[k]=z; cG0[k]=gy;
    const m=0.7+0.6*rnd(), tint=1+0.14*(rnd()-0.5); ccol[o]=col[0]*m*tint; ccol[o+1]=col[1]*m; ccol[o+2]=col[2]*m/tint; colDirty=true;
    if(!cAlive[k]){ cAlive[k]=1; cLive++; }
  }
  /* m2: clod sizes are log-normal (radius about 1-3.4 cm, 4% big chunks of 3.2-6.5 cm: the first cut's 0.5-2 cm were under a pixel or two at the chase distance
     of 3-8 m and the storm did not show in the captures), clod colours from wet to the soil (moist chunks are darker) */
  const SZ=T.size||1, clodR=()=>SZ*(rnd()<0.04?logn(0.045,0.25,0.032,0.065):logn(0.018,0.4,0.009,0.034));
  const clodC=()=>mix3(COL.wet,COL.mid,rnd()*0.8);

  /* ================= SPECKS: the storm of crumbs, ballistic on the GPU ================= */
  const NK=Math.max(16,T.specks), kP=new Float32Array(NK*4), kV=new Float32Array(NK*4), kS=new Float32Array(NK*4), kC=new Float32Array(NK*4);
  for(let k=0;k<NK;k++){ kP[k*4+3]=-1e6; kV[k*4+3]=0; kS[k*4+2]=1; }
  const kg=new THREE.InstancedBufferGeometry();
  kg.setAttribute("position",new THREE.BufferAttribute(new Float32Array([-1,-1,0, 1,-1,0, 1,1,0, -1,1,0]),3)); kg.setIndex([0,1,2, 0,2,3]);
  const jP=new THREE.InstancedBufferAttribute(kP,4).setUsage(THREE.DynamicDrawUsage), jV=new THREE.InstancedBufferAttribute(kV,4).setUsage(THREE.DynamicDrawUsage),
    jS=new THREE.InstancedBufferAttribute(kS,4).setUsage(THREE.DynamicDrawUsage), jC=new THREE.InstancedBufferAttribute(kC,4).setUsage(THREE.DynamicDrawUsage);
  kg.setAttribute("aP",jP); kg.setAttribute("aV",jV); kg.setAttribute("aS",jS); kg.setAttribute("aK",jC); kg.instanceCount=NK;
  const km=new THREE.ShaderMaterial({uniforms:THREE.UniformsUtils.merge([THREE.UniformsLib.lights,THREE.UniformsLib.fog,{uTime:{value:0},uH:{value:720},uShutter:{value:1/250},uMaxPx:{value:T.maxPx},uGain:{value:1},uBank:{value:T.bank||0},uCamV:{value:new THREE.Vector3()},uMaxTrail:{value:40}}]),
    vertexShader:SPK_VS,fragmentShader:SPK_FS,lights:true,fog:true,transparent:true,depthWrite:!!T.depth,depthTest:true,defines:T.depth?{SPK_DEPTH:1}:{}});
  const specks=new THREE.Mesh(kg,km); specks.frustumCulled=false; specks.renderOrder=3.5; specks.name="fx-specks";   /* after the dust (renderOrder 3) */
  const _v2=new THREE.Vector2();
  function targetH(r){ const rt=r.getRenderTarget(); return rt?rt.height:r.getDrawingBufferSize(_v2).y; }
  /* the shutter needs the lens' own motion over the last tick: FX.step notes where the camera was before the cams moved it (the pose of the previous tick: a pure
     function of the tick, like the camera itself), the draw takes the difference; a cut (over 40 m/s) or another camera draws with none */
  const LCAM=opts.cam||null, camPrev=new THREE.Vector3(); let camPrevOk=false, camDt=1/60;
  specks.onBeforeRender=function(r,sc,camera){ const U=km.uniforms, h=targetH(r); U.uH.value=h; U.uMaxTrail.value=0.055*h; const cv=U.uCamV.value;
    if(camPrevOk&&camera===LCAM&&camDt>1e-7){ cv.subVectors(camera.position,camPrev).multiplyScalar(1/camDt); if(cv.lengthSq()>1600) cv.set(0,0,0); } else cv.set(0,0,0); };
  grp.add(specks);
  let kNext=0, kFirst=-1, kNew=0, liveK=0, simT=0, stepDt=1/60;
  const SPK=T.spk, KMAX=Math.max(24,Math.round(NK/22*0.9));   /* at most this many specks a rider a frame (22 riders at the gate share the pool) */
  /* a crumb: where, how fast, its radius (m), life (s), linear colour, the ground under it, kind (0 grain, 1 chip), u = how long ago in this frame it left (0..1 of the frame) */
  function speck(x,y,z,vx,vy,vz,rad,life,col,gy,kind,u){
    const k=kNext; kNext=(kNext+1)%NK; const o=k*4, ago=(u||0)*stepDt;
    if(kFirst<0) kFirst=k; kNew++;
    const kd=0.35+0.0034/rad;   /* the drag: fine crumbs slow down fast, chunks fly on */
    kP[o]=x; kP[o+1]=y; kP[o+2]=z; kP[o+3]=simT+stepDt-ago;
    kV[o]=vx; kV[o+1]=vy; kV[o+2]=vz; kV[o+3]=life;
    kS[o]=gy; kS[o+1]=rad; kS[o+2]=kd; kS[o+3]=rnd();
    const m=0.82+0.36*rnd(); kC[o]=col[0]*m; kC[o+1]=col[1]*m; kC[o+2]=col[2]*m; kC[o+3]=kind;
  }
  /* the colour of a crumb: 30% wet dark, 40% the soil, 30% light dry tan (airborne crumbs must read against the dark stands too) */
  const speckC=()=>{ const r=rnd(); return r<0.35?COL.wet:r<0.8?COL.mid:COL.dry; };
  /* radius (m): about 0.4-2.6 cm, median 1 cm (the cover's crumbs near the lead rider are 2-5 px at 720p, 2-3 m from the lens); the first cut's 1.3-10 mm drew
     sub-pixel dots that faded to nothing at the chase distance */
  const speckR=chip=>SZ*(chip?logn(0.012,0.55,0.005,0.034):logn(0.009,0.6,0.003,0.03));

  /* ================= SPRITES: dust puffs and haze, one instanced draw call ================= */
  const NPF=T.puffs, NHZ=T.haze, NS=NPF+NHZ, H0=NPF;
  const sPos=new Float32Array(NS*3), sVel=new Float32Array(NS*3), sLife=new Float32Array(NS), sMax=new Float32Array(NS), sSize=new Float32Array(NS), sGrow=new Float32Array(NS), sA0=new Float32Array(NS),
    sDrag=new Float32Array(NS), sBuoy=new Float32Array(NS);
  const aA=new Float32Array(NS*4), aB=new Float32Array(NS*4), aC=new Float32Array(NS*4), aD=new Float32Array(NS*4);
  const sg=new THREE.InstancedBufferGeometry();
  sg.setAttribute("position",new THREE.BufferAttribute(new Float32Array([-1,-1,0, 1,-1,0, 1,1,0, -1,1,0]),3)); sg.setIndex([0,1,2, 0,2,3]);
  const iA=new THREE.InstancedBufferAttribute(aA,4).setUsage(THREE.DynamicDrawUsage), iB=new THREE.InstancedBufferAttribute(aB,4).setUsage(THREE.DynamicDrawUsage),
    iC=new THREE.InstancedBufferAttribute(aC,4).setUsage(THREE.DynamicDrawUsage), iD=new THREE.InstancedBufferAttribute(aD,4).setUsage(THREE.DynamicDrawUsage);
  sg.setAttribute("aA",iA); sg.setAttribute("aB",iB); sg.setAttribute("aC",iC); sg.setAttribute("aD",iD); sg.instanceCount=NS;
  const atlasTex=atlasTexture(T.atlas);
  const sm=new THREE.ShaderMaterial({uniforms:THREE.UniformsUtils.merge([THREE.UniformsLib.lights,THREE.UniformsLib.fog,{uAtlas:{value:atlasTex},uH:{value:720},uGain:{value:1},uVeil:{value:1},uCapR:{value:0.26},uBank:{value:T.bank||0}}]),
    vertexShader:SPR_VS,fragmentShader:SPR_FS,lights:true,fog:true,transparent:true,depthWrite:false,depthTest:true});
  const sprites=new THREE.Mesh(sg,sm); sprites.frustumCulled=false; sprites.renderOrder=3; sprites.name="fx-sprites";
  /* THE VEIL RULE, worked out while the frame is drawn (the drawing camera; the simulation never reads it): the dust layer's opacity-weighted share of the frame,
     with the shader's own fades, is held under T.veil (a hairpin with the lens inside the pack used to be a wall of dust with ghosted riders) */
  const VEIL=T.veil, veil={cov:0,gain:1};
  sprites.onBeforeRender=function(r,sc,cam){
    sm.uniforms.uH.value=targetH(r);
    const e=cam.matrixWorldInverse.elements, P11=cam.projectionMatrix.elements[5], asp=cam.aspect||1.78, capR=sm.uniforms.uCapR.value; let cov=0;
    for(let k=0;k<NS;k++){ const o4=k*4, a=aB[o4+3]; if(a<=0.002) continue;
      const x=aA[o4], y=aA[o4+1], z=aA[o4+2], s=aA[o4+3], d=-(e[2]*x+e[6]*y+e[10]*z+e[14]); if(d<0.7) continue;
      const ry=s*P11/d, cy=(e[1]*x+e[5]*y+e[9]*z+e[13])*P11/d, cx=(e[0]*x+e[4]*y+e[8]*z+e[12])*P11/(d*asp);
      if(cx-ry/asp>1||cx+ry/asp<-1||cy-ry>1||cy+ry<-1) continue;
      const near=sstep(0.7,2.2,d), cap=ry>capR?Math.pow(capR/ry,1.5)+(1-Math.pow(capR/ry,1.5))*sstep(3.0,6.0,d):1, hi=1-0.6*sstep(0.7,3.0,y-aD[o4+1]);
      cov+=Math.min(1,0.785*ry*ry/asp)*a*near*cap*hi*0.5;   /* the share of the frame (pi r^2 / 4 in clip units) x opacity x the atlas' mean coverage */
    }
    veil.cov=cov; veil.gain=cov>VEIL?VEIL/cov:1; sm.uniforms.uVeil.value=veil.gain;
  };
  grp.add(sprites);
  let nextPf=0, nextHz=H0, colDirtyS=true;
  let liveP=0, liveH=0;
  function sprite(k,x,y,z,vx,vy,vz,size,grow,life,alpha,col,kind,rot,drag,buoy,gy){
    colDirtyS=true; const o=k*3, o4=k*4; sPos[o]=x; sPos[o+1]=y; sPos[o+2]=z; sVel[o]=vx; sVel[o+1]=vy; sVel[o+2]=vz; sSize[k]=size; sGrow[k]=grow; sLife[k]=life; sMax[k]=life; sA0[k]=alpha; sDrag[k]=drag; sBuoy[k]=buoy;
    aC[o4]=col[0]; aC[o4+1]=col[1]; aC[o4+2]=col[2]; aC[o4+3]=kind; aD[o4]=rot; aD[o4+1]=gy;
    aA[o4]=x; aA[o4+1]=y; aA[o4+2]=z; aA[o4+3]=size; aB[o4]=vx; aB[o4+1]=vy; aB[o4+2]=vz; aB[o4+3]=0;
  }
  /* a puff of dust: radius r0 growing, a life, a peak alpha, a variant of the atlas; gy = the ground under it (the shader thins it with height) */
  function puff(x,y,z,vx,vy,vz,r0,grow,life,alpha,col,buoy,drag,gy){
    if(NPF<1) return; const k=nextPf; nextPf=(nextPf+1)%NPF; const m=0.88+0.24*rnd();
    sprite(k,x,y,z,vx,vy,vz,r0,grow,life,alpha,[col[0]*m,col[1]*m,col[2]*m],1+((rnd()*4)|0),rnd()*6.283,drag==null?1.5:drag,buoy==null?0.2:buoy,gy==null?y-0.3:gy);
  }
  function haze(x,y,z,vx,vy,vz,r0,grow,life,alpha,col,gy){
    if(NHZ<1) return; const k=nextHz; nextHz=H0+((nextHz-H0+1)%NHZ);
    sprite(k,x,y,z,vx,vy,vz,r0,grow,life,alpha,[col[0],col[1],col[2]],1+((rnd()*4)|0),rnd()*6.283,0.6,0.1,gy==null?y-0.8:gy);
  }

  /* ================= MOTES: dust floating round the camera (all on the GPU; high tier) ================= */
  let motes=null, mm=null;
  if(T.motes>0){
    const mg=new THREE.BufferGeometry(), mp=new Float32Array(T.motes*3); for(let i=0;i<mp.length;i++) mp[i]=rnd();
    mg.setAttribute("position",new THREE.BufferAttribute(mp,3));
    mm=new THREE.ShaderMaterial({uniforms:{uCam:{value:new THREE.Vector3()},uT:{value:0},uBox:{value:new THREE.Vector3(22,9,22)},uH:{value:720},uSize:{value:0.012},uCol:{value:new THREE.Vector3(1.0,0.74,0.44)}},
      vertexShader:MOTE_VS,fragmentShader:MOTE_FS,transparent:true,depthWrite:false,depthTest:true,blending:THREE.AdditiveBlending});
    motes=new THREE.Points(mg,mm); motes.frustumCulled=false; motes.renderOrder=4; motes.name="fx-motes";
    motes.onBeforeRender=function(r,sc,cam){ mm.uniforms.uCam.value.copy(cam.position); mm.uniforms.uH.value=targetH(r); };
    grp.add(motes);
  }

  /* ================= LENS FLECKS: mud on the lens, from the spray of the riders ahead of the camera and the bursts near it (a pure function of those and the drawing camera) ================= */
  let lens=null, lg=null, lAV=null, lm=null;
  const burst=[];   /* recent bursts near the ground: x, y, z, strength (decays), set by landings and crashes */
  const rec=[];     /* the riders' emission memory (also what the lens and the mud read) */
  if(T.lens>0){
    const K=T.lens; lg=new THREE.InstancedBufferGeometry();
    lg.setAttribute("position",new THREE.BufferAttribute(new Float32Array([-1,-1,0, 1,-1,0, 1,1,0, -1,1,0]),3)); lg.setIndex([0,1,2, 0,2,3]);
    const S=new Float32Array(K*4); for(let k=0;k<K;k++){ const a=rnd()*6.283, d=0.35+0.55*rnd(); S[k*4]=Math.cos(a)*d*0.95; S[k*4+1]=Math.sin(a)*d*0.8-0.12; S[k*4+2]=0.015+0.03*rnd()*rnd()*3.0; S[k*4+3]=rnd()*10; }
    lAV=new Float32Array(K); lg.setAttribute("aS",new THREE.InstancedBufferAttribute(S,4)); lg.instanceCount=K;
    lm=new THREE.ShaderMaterial({uniforms:{uAspect:{value:1.78},uVis:{value:lAV}},vertexShader:LENS_VS(K),fragmentShader:LENS_FS,transparent:true,depthWrite:false,depthTest:false});
    lens=new THREE.Mesh(lg,lm); lens.frustumCulled=false; lens.renderOrder=999; lens.name="fx-lens";
    const fw=new THREE.Vector3();
    lens.onBeforeRender=function(r,sc,cam){
      lm.uniforms.uAspect.value=cam.aspect||1.78; cam.getWorldDirection(fw); const cp=cam.position; let ex=0;
      for(let j=0;j<rec.length;j++){ const e=rec[j]; if(!e||e.f<FRAME-1) continue; const dx=e.x-cp.x, dy=e.y+0.4-cp.y, dz=e.z-cp.z, d=Math.sqrt(dx*dx+dy*dy+dz*dz);
        if(d<0.5||d>9) continue; const f=(dx*fw.x+dy*fw.y+dz*fw.z)/d; if(f<0.55) continue; const w=1-d/9; ex+=e.spray*w*w*(f-0.45); }
      for(let j=0;j<burst.length;j++){ const b=burst[j]; const dx=b[0]-cp.x, dy=b[1]-cp.y, dz=b[2]-cp.z, d=Math.sqrt(dx*dx+dy*dy+dz*dz); if(d<0.5||d>8) continue;
        const f=(dx*fw.x+dy*fw.y+dz*fw.z)/d; if(f<0.5) continue; const w=1-d/8; ex+=b[3]*w*w*(f-0.4); }
      const K=lAV.length; for(let k=0;k<K;k++){ const need=(k+0.5)/K; lAV[k]=clamp((ex*4.5-need*0.9)*3.0,0,1); }
    };
    grp.add(lens);
  }

  /* ================= the per-rider memory and the emission regulator ================= */
  function recOf(i){ let e=rec[i]; if(!e){ e={f:-9,air:false,x:0,y:0,z:0,spray:0,acc:0,power:0,berm:0,launch:0,ls:0,cA:0,kA:0,dA:0,hA:0,fA:0,mudS:0}; rec[i]=e; } return e; }
  const PS={c:1,k:1,p:1,h:1};   /* how much of the wanted emission the pools take now (from last frame's fill) */
  const RATE=T.rate;
  let FRAME=1, slowT=0, fastT=0;   /* FRAME counts the steps: a rider's memory is current if FX.rider ran for it this frame or the last */

  /* ---------------- the inputs the zone in race3d.js rider() asks for, above poseRider ---------------- */
  FX.inputs=function(st,dt){
    const e=recOf(st.i), v=st.v||0;
    if(dt>0) e.acc+=(st.acc-e.acc)*Math.min(1,dt*7);
    /* wheelspin is a low-speed thing: hard acceleration in a low gear (out of a turn, up a face, off the gate) digs the tyre in, at speed it hooks up */
    const pad=st.onStart&&st.D<18&&v>1.2, launch=pad?1-st.D/18:0, lowSpeed=1.05-0.85*clamp(v/16,0,1);
    const power=clamp(clamp(Math.max(e.acc,0)/3.2,0,1.4)*lowSpeed+launch*0.9,0,1.4);
    /* a berm or a rut: the back end slides out and the tyre throws dirt to the outside, harder under power (a rider holding speed through a turn is on the gas) */
    const corner=clamp(Math.abs(st.lean)*1.7,0,1)*clamp(v/4,0,1), berm=corner*(0.7+0.3*clamp(power*1.2,0,1));
    e.power=power; e.berm=berm; e.launch=launch;
    e.ls=(st.onStart&&st.D<18)?clamp(1-st.D/18,0,1):0;   /* (polish: how much the pad is under him, from the drop on: `launch` needs v > 1.2, so the first half second of the start threw full dust and spray from all 22 riders: the wall of dust in front of the gate) */
    st.throttle=clamp(power+berm*0.5,0,1);
    st.slip=clamp(power*0.7+berm*0.45+(st.sand||0)*0.3+launch*0.25,0,1);
    st.roost=st.slip*8;
  };

  /* ---------------- take-off: the rear wheel digs into the lip and throws a handful of dirt and a puff back ---------------- */
  function takeoff(st,cth,sth,rx,rz){
    const v=st.v, g=st.tR+0.05, px=st.x-cth*0.8, pz=st.z-sth*0.8, s0=st.onStart?-1:st.s-0.8, n=Math.round((6+v*0.5)*RATE), m=Math.round((40+v*4)*RATE*SPK);
    for(let k=0;k<n;k++){ const sd=(rnd()+rnd()-1)*2.2, up=2.2+3.8*rnd(); clod(px+rx*(rnd()-0.5)*0.15,g+0.05,pz+rz*(rnd()-0.5)*0.15,cth*v*0.15-cth*(0.4+1.6*rnd())+rx*sd,up,sth*v*0.15-sth*(0.4+1.6*rnd())+rz*sd,clodR(),0.9+0.8*rnd(),clodC(),g,s0,st.lat,st.th); }
    for(let k=0;k<m;k++){ const sd=(rnd()+rnd()-1)*2.6, up=2.0+5.0*rnd(), chip=rnd()<0.25; speck(px,g+0.08,pz,cth*v*0.18-cth*(0.5+2.6*rnd())+rx*sd,up,sth*v*0.18-sth*(0.5+2.6*rnd())+rz*sd,speckR(chip),0.6+0.6*rnd(),speckC(),g-0.05,chip?1:0,rnd()); }
    for(let k=0,q=Math.max(1,Math.round(2*Math.min(1,0.4+RATE)));k<q;k++){ const side=(rnd()<0.5?-1:1)*(0.3+1.0*rnd()); puff(px,g+0.3,pz,cth*v*0.1-cth*0.6+rx*side,0.5+0.7*rnd(),sth*v*0.1-sth*0.6+rz*side,0.4+0.25*rnd(),0.9+0.4*rnd(),1.6+0.8*rnd(),0.22+0.1*rnd(),COL.dust,0.22,1.3,g); }
  }
  /* ---------------- landing: dust and a ring of clods and crumbs, bigger for a harder landing (st.impact, m/s) ---------------- */
  function landing(st,cth,sth,rx,rz){
    const im=st.impact, big=clamp((im-1)/7,0,1), dc=COL.dust;
    const nC=Math.round((7+im*3.5)*RATE), nS=Math.round((60+im*30)*RATE*SPK), nP=Math.max(2,Math.round((3+im*0.7)*Math.min(1,0.4+RATE)));
    for(let w=0;w<2;w++){                      /* the rear wheel lands under the bike, the front a wheelbase ahead */
      const off=w?0.72:-0.72, px=st.x+cth*off, pz=st.z+sth*off, gy=(w?st.tF:st.tR)+0.03, wt=w?0.45:0.55, s0=st.onStart?-1:st.s+off;
      for(let k=0,n=Math.round(nC*wt);k<n;k++){ const a=rnd()*6.283, sp=(0.9+2.6*rnd()+0.28*im)*(0.5+0.5*rnd()), up=1.4+0.4*im*rnd()+2.4*rnd();
        clod(px,gy+0.02,pz,Math.cos(a)*sp+cth*st.v*0.35,up,Math.sin(a)*sp+sth*st.v*0.35,clodR()*(1+0.4*big),1.0+0.9*rnd(),clodC(),gy,s0,st.lat,st.th); }
      for(let k=0,n=Math.round(nS*wt);k<n;k++){ const a=rnd()*6.283, sp=(1.4+4.2*rnd()+0.4*im)*(0.5+0.5*rnd()), chip=rnd()<0.3; speck(px,gy+0.04,pz,Math.cos(a)*sp+cth*st.v*0.4,1.2+3.2*rnd()+0.3*im,Math.sin(a)*sp+sth*st.v*0.4,speckR(chip),0.5+0.6*rnd(),speckC(),gy-0.04,chip?1:0,rnd()*0.5); }
      for(let k=0,n=Math.max(1,Math.round(nP*wt));k<n;k++){ const a=(k/n+rnd()*0.4)*6.283, sp=0.9+1.9*rnd()+0.25*im;
        puff(px+Math.cos(a)*0.2,gy+0.14,pz+Math.sin(a)*0.2,Math.cos(a)*sp+cth*st.v*0.45,0.2+0.4*rnd(),Math.sin(a)*sp+sth*st.v*0.45,0.28+0.14*rnd()+0.03*im,0.7+0.35*rnd(),1.1+0.7*rnd()+0.12*im,0.18+0.24*big+0.1*rnd(),dc,0.15,1.7,gy); }
    }
    if(burst.length>5) burst.shift(); burst.push([st.x,st.y,st.z,0.35+0.5*big]);
  }

  /* how much the camera cares about a rider (weaker tiers only: the pools are small, so the dirt goes where the viewer looks): 1 near, less far, little behind */
  const cpos={x:0,z:0,fx:0,fz:1};
  function camNote(){ if(!CAM) return; const e=CAM.matrixWorld.elements; cpos.x=CAM.position.x; cpos.z=CAM.position.z; const fx=-e[8], fz=-e[10], l=Math.hypot(fx,fz)||1; cpos.fx=fx/l; cpos.fz=fz/l; }
  const focus=[{x:0,z:0,on:false},{x:0,z:0,on:false}];
  FX.focus=function(a,b){ const f=[a,b]; for(let i=0;i<2;i++){ const p=f[i], o=focus[i]; if(p){ o.x=p.x; o.z=p.z; o.on=true; } else o.on=false; } };   /* the leader and the person (race state only): the high tiers send the dirt where the viewer mostly looks without ever reading the camera */
  function care(x,z){
    if(!CAM){ let fd=1e9; for(let i=0;i<2;i++){ const o=focus[i]; if(!o.on) continue; const fx=x-o.x, fz=z-o.z, d=Math.sqrt(fx*fx+fz*fz); if(d<fd) fd=d; } if(fd>=1e9) return 1; return fd<22?1:fd<55?1-0.55*(fd-22)/33:0.45-0.3*Math.min(1,(fd-55)/60); }
    const dx=x-cpos.x, dz=z-cpos.z, d=Math.sqrt(dx*dx+dz*dz), f=(dx*cpos.fx+dz*cpos.fz)/(d+1e-3);
    let w=d<18?1:d<45?1-0.62*(d-18)/27:Math.max(0.1,0.38-0.28*(d-45)/50); if(f<0.1&&d>5) w*=0.25;
    return w;
  }

  /* ---------------- the rider, every frame: the roost off the rear wheel, the flick off the front, the dust trail, the haze, the mud ---------------- */
  FX.rider=function(st,dt){
    const e=recOf(st.i); e.f=FRAME; e.x=st.x; e.y=st.y; e.z=st.z;
    if(!(dt>0)) return;
    stepDt=Math.min(dt,0.12);
    const cth=Math.cos(st.th), sth=Math.sin(st.th), rx=-sth, rz=cth, v=st.v||0;
    if(st.landed&&st.impact>1.0) landing(st,cth,sth,rx,rz);
    if(st.air&&!e.air&&v>5) takeoff(st,cth,sth,rx,rz); e.air=st.air;
    /* mud: riding in the roost of a rider ahead in the same line dirties him (st.mud 0..1, slowly clears); the lens reads the sprays */
    { let ex=0; for(let j=0;j<rec.length;j++){ const o=rec[j]; if(!o||o===e||o.f<FRAME-1||o.spray<0.05) continue; const dx=o.x-st.x, dz=o.z-st.z, al=dx*cth+dz*sth, ac=Math.abs(-dx*sth+dz*cth); if(al>1.2&&al<9&&ac<1.7) ex+=o.spray*(1-al/9)*(1-ac/1.7); }
      st.mud=clamp((st.mud||0)*(1-dt*0.012)+ex*dt*0.1,0,1); }
    if(st.air||st.gate||v<0.3){ e.spray*=Math.exp(-dt*2.5); return; }
    const pw=e.power, bm=e.berm, ef=Math.max(pw,bm*0.9), cruise=clamp(v/18,0,1), sand=st.sand||0, brake=clamp((-e.acc-1.6)/4,0,1), loose=COL.loose;
    const imp=(st.me?1.5:1)*(st.red?1.15:1)*RATE*care(st.x,st.z);
    e.spray+=(clamp(pw*0.9+bm*0.9+sand*cruise*0.5,0,1)-e.spray)*Math.min(1,dt*4);
    const gR=st.tR+0.03, gF=st.tF+0.03, s0R=st.onStart?-1:st.s-0.8, s0F=st.onStart?-1:st.s+0.8, sgn=st.k>0?1:-1, lift=0.55+0.45*Math.min(1,ef+0.3);
    /* clods: a fan thrown up and back off the rear tyre (in the world's frame the dirt barely moves while the bike drives away from it); in a turn the back end slides and throws them to the outside */
    e.cA+=(2+30*cruise+300*pw+300*bm+90*sand*cruise)*(1-0.35*e.ls)*dt*PS.c*imp; let n=e.cA|0; e.cA-=n; if(n>30) n=30;
    while(n-->0){
      const up=(2.4+6.0*Math.pow(rnd(),0.9))*lift, bk=(rnd()-0.25)*(1.4+3.6*ef)+0.06*v, sd=(rnd()+rnd()-1)*(1.6+1.8*bm)-sgn*bm*(1.5+3.5*rnd()), cr=(0.1+0.25*rnd())*v, u=rnd();
      const bx=st.x-cth*(0.8+v*dt*u)+rx*(rnd()-0.5)*0.14, bz=st.z-sth*(0.8+v*dt*u)+rz*(rnd()-0.5)*0.14;
      clod(bx,gR+0.05+0.1*rnd(),bz,cth*cr-cth*bk+rx*sd,up,sth*cr-sth*bk+rz*sd,clodR()*(1+0.6*e.ls),0.9+0.9*rnd(),clodC(),gR,s0R,st.lat,st.th);   /* (m2: the launch digs bigger chunks off the start pad: the gate roost must read from the gate camera and the stands) */
    }
    /* THE STORM (m2): hundreds of crumbs a second off the rear tyre. Under power a tight ROOSTER TAIL (thrown back at the wheelspin speed, a clear arc that reads
       from the chase and from the stands) inside a wider fan; in a berm the back end slides and sprays to the outside; at speed the knobs keep throwing a steady spray (up to 450 a second) */
    e.kA+=(450*cruise+2400*pw+2000*bm+600*sand*cruise)*SPK*(0.4+0.6*(1-e.ls)*(1-e.ls))*dt*PS.k*imp;   /* (m2: 40% on the start pad, was 3%: the old cut was for milestone 1's big cream spray sprites; dark 1 cm crumbs do not veil the gate) */
    n=e.kA|0; e.kA-=n; if(n>KMAX) n=KMAX;
    while(n-->0){
      const tail=rnd()<0.5*ef, u=rnd(), chip=rnd()<0.25;
      let up, bk, sd;
      if(tail){ up=(3.6+4.0*rnd())*lift; bk=(3.0+8.0*ef*(0.6+0.4*rnd())); sd=(rnd()-0.5)*0.9-sgn*bm*(2.0+3.0*rnd()); }   /* the arc: back at about the wheelspin speed, 25-45 degrees up, 1-1.8 m high */
      else { up=(1.2+6.4*rnd())*lift; bk=(0.4+rnd()*(1.5+6.0*ef)); sd=(rnd()+rnd()-1)*(2.0+2.2*bm)-sgn*bm*(1.5+4.0*rnd()); }
      const cr=(0.04+0.12*rnd())*v;
      speck(st.x-cth*(0.78+v*dt*u)+rx*(rnd()-0.5)*0.18,gR+0.04+0.1*rnd(),st.z-sth*(0.78+v*dt*u)+rz*(rnd()-0.5)*0.18,cth*(cr-bk)+rx*sd,up,sth*(cr-bk)+rz*sd,speckR(chip),0.45+0.8*rnd(),speckC(),gR-0.06,chip?1:0,u);
    }
    /* the front wheel in a berm or a rut flicks dirt to the outside and ahead */
    e.fA+=(bm>0.2&&v>4?(26+90*bm)*(0.4+0.6*Math.min(1,v/12)):0)*dt*PS.k*imp*SPK; n=e.fA|0; e.fA-=n; if(n>16) n=16;
    while(n-->0){ const fo=0.78+rnd()*0.1, out=-sgn*(2.0+3.5*rnd()), up=1.4+3.0*rnd(), fr=0.25*v+0.5*v*rnd(), u=rnd();
      const fx=st.x+cth*(fo-v*dt*u)+rx*(rnd()-0.5)*0.1, fz=st.z+sth*(fo-v*dt*u)+rz*(rnd()-0.5)*0.1;
      if(rnd()<0.12) clod(fx,gF+0.05,fz,cth*fr+rx*out,up,sth*fr+rz*out,clodR(),0.9+0.8*rnd(),clodC(),gF,s0F,st.lat,st.th);
      else { const chip=rnd()<0.3; speck(fx,gF+0.06,fz,cth*fr+rx*out*1.2,up*1.1,sth*fr+rz*out*1.2,speckR(chip),0.45+0.6*rnd(),speckC(),gF-0.06,chip?1:0,u); } }
    /* the dust off the rear tyre: a rooster tail of puffs in a hollow fan (the line straight behind the bike stays clear for a chase camera), low on the floor, more under power, on the brakes and in sand; the 22 on the gate throw less each */
    const lf=1-0.93*e.ls, pwD=pw*lf*lf, efD=Math.max(pwD,bm*0.9);   /* (polish: the 22 on the gate throw almost no dust each: together they were a wall of it between the camera and the field) */
    e.dA+=((1.2+3.5*cruise*loose)*lf+16*pwD*loose+9*bm+6*sand*cruise+6*brake)*dt*PS.p*imp; n=e.dA|0; e.dA-=n; if(n>8) n=8;
    while(n-->0){ const side=(rnd()<0.5?-1:1)*(0.5+1.4*rnd()), hi=rnd()<0.2*efD?1.8:1, off=0.9+v*dt*rnd(), ox=rx*side*0.2;
      puff(st.x-cth*off+ox,gR+0.18+0.2*rnd(),st.z-sth*off+rz*side*0.2,cth*v*0.12-cth*(0.3+0.8*rnd())+rx*side*0.9-sgn*bm*rx*1.2,(0.35+0.8*rnd())*hi,sth*v*0.12-sth*(0.3+0.8*rnd())+rz*side*0.9-sgn*bm*rz*1.2,
      (0.5+0.36*rnd()+0.28*efD)*(1-0.4*e.ls),1.05+0.65*rnd()+0.4*efD,1.5+1.0*rnd()+0.4*efD,(0.18+0.13*rnd()+0.15*efD+0.05*sand)*(0.7+0.3*loose)*lf*1.25,COL.dust,0.18,1.4,gR); }   /* (m2: 1.4x bigger, 1.3x faster growing and x1.25 as opaque as the first cut: coverage from size, not opacity; x2.6 opacity drew solid pancakes) */
    /* the haze that hangs over the track behind a fast pack: large, faint, slow, low */
    e.hA+=(v>6?(0.8+0.7*efD)*lf:0)*dt*PS.h*(st.me?1.3:1)*RATE; n=e.hA|0; e.hA-=n; if(n>3) n=3;
    while(n-->0) haze(st.x-cth*(1.4+3*rnd())+rx*(rnd()-0.5)*1.5,gR+0.55+0.7*rnd(),st.z-sth*(1.4+3*rnd())+rz*(rnd()-0.5)*1.5,(rnd()-0.5)*0.5,0.12,(rnd()-0.5)*0.5,1.3+0.8*rnd(),0.45+0.25*rnd(),3.2+2.4*rnd(),0.045+0.03*rnd(),COL.dust,gR);
  };

  /* ---------------- a crash begins at f ({x, z, th}, the centre line) where the rider r was, the ground gy: a burst of dirt and a cloud of dust ---------------- */
  FX.crashStart=function(f,gy,r){
    const p=r&&r.pos?r.pos:null, x=p?p.x:f.x, z=p?p.z:f.z, th=r&&r.th!=null?r.th:f.th||0, v=r&&r.v?Math.min(20,r.v):10, cth=Math.cos(th), sth=Math.sin(th), g=gy+0.05;
    const nC=Math.round(36*RATE), nS=Math.round(260*RATE*SPK), nP=Math.max(3,Math.round(9*Math.min(1,0.35+RATE)));
    for(let k=0;k<nC;k++){ const a=rnd()*6.283, sp=1.2+4.2*rnd(), fw=v*(0.25+0.45*rnd()); clod(x+(rnd()-0.5)*0.9,g+0.1+0.4*rnd(),z+(rnd()-0.5)*0.9,Math.cos(a)*sp+cth*fw,2+4.5*rnd(),Math.sin(a)*sp+sth*fw,clodR()*(rnd()<0.08?1.6:1),1.2+1.0*rnd(),clodC(),g,-1,0,th); }
    for(let k=0;k<nS;k++){ const a=rnd()*6.283, sp=1.5+5.5*rnd(), fw=v*(0.2+0.5*rnd()), chip=rnd()<0.3; speck(x+(rnd()-0.5)*0.8,g+0.1+0.5*rnd(),z+(rnd()-0.5)*0.8,Math.cos(a)*sp+cth*fw,1.5+5*rnd(),Math.sin(a)*sp+sth*fw,speckR(chip),0.6+0.7*rnd(),speckC(),g-0.05,chip?1:0,rnd()*0.4); }
    for(let k=0;k<nP;k++){ const a=(k/nP+rnd()*0.3)*6.283, sp=0.8+2.4*rnd(), fw=v*(0.12+0.3*rnd()); puff(x+Math.cos(a)*0.3,g+0.3+0.35*rnd(),z+Math.sin(a)*0.3,Math.cos(a)*sp+cth*fw,0.45+0.9*rnd(),Math.sin(a)*sp+sth*fw,0.5+0.3*rnd(),0.9+0.5*rnd(),1.8+1.1*rnd(),0.32+0.18*rnd(),COL.dust,0.22,1.2,g); }
    burst.push([x,g,z,0.9]); if(burst.length>6) burst.shift();
  };
  /* the crash script, every frame: dust where the rider hits the dirt and at each bounce (c.fx counts them), a plough of dirt behind the sliding bike
     (c = the crash record, t = seconds since the fall, ts = how long the bike slides; (hx, hgy, hz) the rider, (bx, gy, bz) the bike, thB its heading) */
  FX.crashStep=function(c,t,dt,hx,hgy,hz,bx,gy,bz,thB,ts){
    if(!(dt>0)) return;
    stepDt=Math.min(dt,0.12);
    const ev=[0.62,1.01,1.4];
    while(c.fx<ev.length&&t>=ev[c.fx]){
      const first=c.fx===0, nC=Math.round((first?14:8)*RATE), nP=Math.max(2,Math.round((first?5:3)*Math.min(1,0.35+RATE))), nS=Math.round((first?110:60)*RATE*SPK), g=hgy+0.06;
      for(let k=0;k<nC;k++){ const a=rnd()*6.283, sp=0.8+2.8*rnd(); clod(hx+(rnd()-0.5)*0.6,g+0.15,hz+(rnd()-0.5)*0.6,Math.cos(a)*sp,1.6+3*rnd(),Math.sin(a)*sp,clodR(),1.0+0.9*rnd(),clodC(),g,-1,0,thB); }
      for(let k=0;k<nS;k++){ const a=rnd()*6.283, sp=1+4*rnd(), chip=rnd()<0.3; speck(hx+(rnd()-0.5)*0.6,g+0.2,hz+(rnd()-0.5)*0.6,Math.cos(a)*sp,1+3.6*rnd(),Math.sin(a)*sp,speckR(chip),0.5+0.6*rnd(),speckC(),g-0.05,chip?1:0,rnd()*0.4); }
      for(let k=0;k<nP;k++){ const a=rnd()*6.283, sp=0.6+1.8*rnd(); puff(hx+Math.cos(a)*0.3,g+0.2+0.3*rnd(),hz+Math.sin(a)*0.3,Math.cos(a)*sp,0.4+0.8*rnd(),Math.sin(a)*sp,0.45+0.3*rnd(),0.85+0.4*rnd(),1.5+1.0*rnd(),(first?0.34:0.24)+0.12*rnd(),COL.dust,0.22,1.3,g); }
      burst.push([hx,g,hz,first?0.7:0.45]); if(burst.length>6) burst.shift(); c.fx++;
    }
    if(t<ts){   /* the bike ploughs along on its side: a spray of dirt to its far side and a trail of dust */
      const sl=1-t/ts, cb=Math.cos(thB), sb=Math.sin(thB); let nC=Math.min(3,((c.cA=(c.cA||0)+dt*(12+14*sl)*PS.c*RATE)|0)); c.cA-=nC;
      while(nC-->0) clod(bx+(rnd()-0.5)*0.6,gy+0.12,bz+(rnd()-0.5)*0.6,-cb*(0.4+1.2*rnd())+(rnd()-0.5)*2.4,0.8+2.4*rnd(),-sb*(0.4+1.2*rnd())+(rnd()-0.5)*2.4,clodR(),0.9+0.8*rnd(),clodC(),gy,-1,0,thB);
      let nS=Math.min(14,((c.cS=(c.cS||0)+dt*(160+160*sl)*PS.k*RATE*SPK)|0)); c.cS-=nS;
      while(nS-->0){ const chip=rnd()<0.3; speck(bx+(rnd()-0.5)*0.7,gy+0.1,bz+(rnd()-0.5)*0.7,-cb*(0.8+2*rnd())+(rnd()-0.5)*3,0.8+3*rnd(),-sb*(0.8+2*rnd())+(rnd()-0.5)*3,speckR(chip),0.45+0.5*rnd(),speckC(),gy-0.05,chip?1:0,rnd()); }
      let nP=Math.min(2,((c.cP=(c.cP||0)+dt*(10+10*sl)*PS.p*RATE)|0)); c.cP-=nP;
      while(nP-->0) puff(bx+(rnd()-0.5)*0.7,gy+0.18+0.2*rnd(),bz+(rnd()-0.5)*0.7,-Math.cos(thB)*1.0+(rnd()-0.5)*0.8,0.25+0.45*rnd(),-Math.sin(thB)*1.0+(rnd()-0.5)*0.8,0.35+0.25*rnd(),0.7+0.4*rnd(),1.3+0.8*rnd(),0.18+0.12*rnd(),COL.dust,0.18,1.5,gy);
    }
  };

  /* ================= the step: move everything, write the buffers, set next frame's regulator ================= */
  FX.step=function(dt){
    if(!(dt>0)) return;
    if(LCAM){ camPrev.copy(LCAM.position); camPrevOk=true; camDt=dt; }   /* (drawing only: the shutter's lens motion; nothing simulated reads it) */
    if(!LIVE){   /* with no ladder (perf's Q.live) the budget adapts by itself: slow frames thin the emission, fast frames bring it back */
      if(dt>0.22){ slowT=0; } else if(dt>0.036){ slowT+=dt; fastT=0; } else if(dt<0.022){ fastT+=dt; slowT=Math.max(0,slowT-dt*0.5); }
      if(slowT>2.0&&FX.budget>0.36){ FX.budget=Math.max(0.35,FX.budget*0.8); slowT=0; } else if(fastT>5&&FX.budget<1&&!FX.pinned){ FX.budget=Math.min(1,FX.budget*1.12); fastT=0; } }
    dt=Math.min(dt,0.12); simT+=dt; stepDt=dt; if(mm) mm.uniforms.uT.value=simT; km.uniforms.uTime.value=simT; camNote();
    for(let b=burst.length-1;b>=0;b--){ burst[b][3]-=dt*0.8; if(burst[b][3]<=0) burst.splice(b,1); }
    const sub=dt>0.034?Math.ceil(dt/0.0167):1, h=dt/sub;
    for(let s=0;s<sub;s++) stepOnce(h);
    rocks.instanceMatrix.needsUpdate=true; if(colDirty){ rocks.instanceColor.needsUpdate=true; colDirty=false; }
    iA.needsUpdate=true; iB.needsUpdate=true; iC.needsUpdate=colDirtyS; iD.needsUpdate=colDirtyS; colDirtyS=false;
    /* the specks thrown this frame: only their slots go up to the GPU (one or two ranges of the ring) */
    if(kNew>0){
      const at=[jP,jV,jS,jC];
      if(kNew>=NK) at.forEach(a=>{ a.clearUpdateRanges(); a.needsUpdate=true; });
      else { const a0=kFirst, n0=Math.min(kNew,NK-a0), n1=kNew-n0; at.forEach(a=>{ a.addUpdateRange(a0*4,n0*4); if(n1>0) a.addUpdateRange(0,n1*4); a.needsUpdate=true; }); }
      kNew=0; kFirst=-1;
    }
    let lk=0; for(let k=0;k<NK;k++){ const o=k*4; if(simT-kP[o+3]<kV[o+3]) lk++; } liveK=lk;
    /* the regulator: a pool that is filling up slows its emitters down (so 22 riders on the gate share the budget); the budget scales it all */
    FRAME++; const bd=FX.budget*(LIVE&&LIVE.particleScale!=null?clamp(LIVE.particleScale,0.05,1):1);
    PS.c=clamp(1.7*(1-cLive/NC),0.08,1)*bd; PS.k=clamp(1.6*(1-liveK/NK),0.06,1)*bd; PS.p=clamp(1.7*(1-liveP/Math.max(1,NPF)),0.06,1)*bd; PS.h=NHZ?clamp(1.7*(1-liveH/NHZ),0.05,1)*bd:0;
  };

  function stepOnce(h){
    /* clods */
    const drag=1-0.5*h; let live=0;
    for(let k=0;k<NC;k++){
      if(!cAlive[k]) continue;
      let L=cLife[k]-h; cLife[k]=L; const o=k*3, m=k*16;
      if(L<=0){ cAlive[k]=0; cm[m]=cm[m+1]=cm[m+2]=cm[m+4]=cm[m+5]=cm[m+6]=cm[m+8]=cm[m+9]=cm[m+10]=0; cm[m+13]=-999; continue; }
      live++;
      let x=cPos[o], y=cPos[o+1], z=cPos[o+2], vx=0, vy=0, vz=0;
      if(!cRest[k]){
        vx=cVel[o]*drag; vy=cVel[o+1]*drag-9.81*h; vz=cVel[o+2]*drag;
        x+=vx*h; y+=vy*h; z+=vz*h;
        const g=groundAt(k,x,z)+cRad[k]*0.55;
        if(y<g){ y=g;
          if(vy<-1.3){ vy=-vy*0.3; vx*=0.6; vz*=0.6; cSpin[k]*=0.55; }
          else { vx=vy=vz=0; cRest[k]=1; cSpin[k]=0; const keep=0.4+0.5*(k%5)/5; if(L>keep) cLife[k]=L=keep; } }
        cVel[o]=vx; cVel[o+1]=vy; cVel[o+2]=vz; cPos[o]=x; cPos[o+1]=y; cPos[o+2]=z; cAng[k]+=cSpin[k]*h;
      }
      /* the matrix: rotation about the clod's own axis by its angle (Rodrigues), scaled, shrinking away at the end of its life; m2: stretched along its velocity when it is fast (a fast shutter's blur, at most 1.9x) */
      const th=cAng[k], c=Math.cos(th), s=Math.sin(th), t=1-c, ax=cAx[o], ay=cAx[o+1], az=cAx[o+2], f=cRad[k]*(L<0.3?L/0.3:1), sx=f*cSc[o], sy=f*cSc[o+1], sz=f*cSc[o+2];
      let m0=(c+t*ax*ax)*sx, m1=(t*ax*ay+s*az)*sx, m2=(t*ax*az-s*ay)*sx, m4=(t*ax*ay-s*az)*sy, m5=(c+t*ay*ay)*sy, m6=(t*ay*az+s*ax)*sy, m8=(t*ax*az+s*ay)*sz, m9=(t*ay*az-s*ax)*sz, m10=(c+t*az*az)*sz;
      const sp2=vx*vx+vy*vy+vz*vz;
      if(sp2>36){ const sp=Math.sqrt(sp2), ux=vx/sp, uy=vy/sp, uz=vz/sp, q=Math.min(0.45,(sp-6)*0.09);   /* S = I + q u u^T on every column (1x at 6 m/s .. 1.45x from 11 m/s) */
        let d=ux*m0+uy*m1+uz*m2; m0+=q*ux*d; m1+=q*uy*d; m2+=q*uz*d;
        d=ux*m4+uy*m5+uz*m6; m4+=q*ux*d; m5+=q*uy*d; m6+=q*uz*d;
        d=ux*m8+uy*m9+uz*m10; m8+=q*ux*d; m9+=q*uy*d; m10+=q*uz*d; }
      cm[m]=m0; cm[m+1]=m1; cm[m+2]=m2; cm[m+4]=m4; cm[m+5]=m5; cm[m+6]=m6; cm[m+8]=m8; cm[m+9]=m9; cm[m+10]=m10;
      cm[m+12]=x; cm[m+13]=y; cm[m+14]=z;
    }
    cLive=live;
    /* sprites */
    let lp=0, lh=0;
    for(let k=0;k<NS;k++){
      let L=sLife[k]; if(L<=0) continue; L-=h; sLife[k]=L; const o=k*3, o4=k*4;
      if(L<=0){ aA[o4+3]=0; aB[o4+3]=0; continue; }
      if(k<H0) lp++; else lh++;
      const dr=1-sDrag[k]*h; let vx=sVel[o]*dr, vy=sVel[o+1]*dr+sBuoy[k]*h, vz=sVel[o+2]*dr;
      sVel[o]=vx; sVel[o+1]=vy; sVel[o+2]=vz; const x=sPos[o]+vx*h, y=sPos[o+1]+vy*h, z=sPos[o+2]+vz*h; sPos[o]=x; sPos[o+1]=y; sPos[o+2]=z;
      const sz=sSize[k]+sGrow[k]*h; sSize[k]=sz;
      const m=sMax[k], att=Math.min(1,(m-L)/0.14), fo=Math.pow(L/m,0.85);
      aA[o4]=x; aA[o4+1]=y; aA[o4+2]=z; aA[o4+3]=sz; aB[o4]=vx; aB[o4+1]=vy; aB[o4+2]=vz; aB[o4+3]=sA0[k]*att*fo;
    }
    liveP=lp; liveH=lh;
  }

  /* tests: the live particles within r metres of (x, z): counts and a few samples; the rider memory */
  FX.debug=function(x,z,r){
    const o={clods:0,specks:0,puffs:0,haze:0,samples:[],rec:rec.map(e=>e?{power:+e.power.toFixed(2),berm:+e.berm.toFixed(2),spray:+e.spray.toFixed(2),cA:+e.cA.toFixed(2)}:null)};
    for(let k=0;k<NC;k++){ if(!cAlive[k]) continue; const dx=cPos[k*3]-x, dz=cPos[k*3+2]-z; if(dx*dx+dz*dz<r*r){ o.clods++; if(o.samples.length<6) o.samples.push(["c",+cPos[k*3].toFixed(2),+cPos[k*3+1].toFixed(2),+cPos[k*3+2].toFixed(2),+cLife[k].toFixed(2),cRest[k],+cRad[k].toFixed(3)]); } }
    for(let k=0;k<NK;k++){ const q=k*4; if(simT-kP[q+3]>=kV[q+3]) continue; const dx=kP[q]-x, dz=kP[q+2]-z; if(dx*dx+dz*dz<r*r) o.specks++; }
    for(let k=0;k<NS;k++){ if(sLife[k]<=0) continue; const dx=sPos[k*3]-x, dz=sPos[k*3+2]-z; if(dx*dx+dz*dz<r*r){ if(k<H0) o.puffs++; else o.haze++; } }
    return o;
  };
  /* tests: a checksum of every pool, the generator state and the lens, to prove two runs of the same tick agree */
  FX.hash=function(){
    let a=0,b2=0,c=0,d=0,e2=0,k2=0;
    for(let k=0;k<NC*3;k++){ a+=cPos[k]*(1+(k%7)); b2+=cVel[k]; } for(let k=0;k<NC;k++){ c+=cLife[k]*(1+k%5)+cRest[k]+cAng[k]*0.01; }
    for(let k=0;k<NS*3;k++){ d+=sPos[k]*(1+(k%5)); } for(let k=0;k<NS*4;k++){ e2+=aB[k]*(1+(k%3))+aA[k]; }
    for(let k=0;k<NK*4;k++){ k2+=(kP[k]>-1e5?kP[k]:0)*(1+(k%5))+kV[k]*(1+(k%3)); }
    return {clods:[a,b2,c].map(x=>+x.toFixed(5)),sprites:[+d.toFixed(5),+e2.toFixed(5)],specks:+k2.toFixed(4),live:[cLive,liveK,liveP,liveH],simT:+simT.toFixed(6),FRAME:FRAME,sd:sd,lens:lAV?Array.from(lAV).map(x=>+x.toFixed(4)):null,mote:mm?+mm.uniforms.uT.value.toFixed(6):null,budget:FX.budget,PS:[PS.c,PS.k,PS.p,PS.h].map(x=>+x.toFixed(4)),burst:burst.length,focus:focus.map(o=>[o.on,+o.x.toFixed(3),+o.z.toFixed(3)])};
  };
  FX.setBudget=function(f){ FX.budget=clamp(f,0.05,1); FX.pinned=f<1; };   /* (a budget set from outside is kept: the self-adapting ladder only brings back what it took) */
  FX.emit=function(x,y,z,vx,vy,vz,size,life,dirt){ if(size>0.3) puff(x,y,z,vx,vy,vz,size,0.5,life,0.25,dirt||COL.dust,0.2,1.5,y-0.3); else clod(x,y,z,vx,vy,vz,Math.max(0.006,size*0.4),life,dirt||COL.clod,y-0.1,-1,0,0); };
  FX.stats=function(){ return {tier:T.n,clods:cLive,clodPool:NC,specks:liveK,speckPool:NK,puffs:liveP,puffPool:NPF,haze:liveH,hazePool:NHZ,motes:T.motes,lens:T.lens,budget:FX.budget,veil:{cov:+veil.cov.toFixed(3),gain:+veil.gain.toFixed(3),cap:VEIL},regulator:{c:+PS.c.toFixed(2),k:+PS.k.toFixed(2),p:+PS.p.toFixed(2)}}; };
  FX.part={n:NC,pos:cPos,vel:cVel,life:cLife,max:cMax,get next(){ return cNext; }};
  FX.dispose=function(){ rocks.dispose(); rockG.dispose(); rockM.dispose(); kg.dispose(); km.dispose(); sg.dispose(); sm.dispose(); atlasTex.dispose(); if(motes){ motes.geometry.dispose(); mm.dispose(); } if(lens){ lg.dispose(); lm.dispose(); } };
  return FX;
}
