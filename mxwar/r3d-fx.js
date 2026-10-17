/* MOTOCROSS WAR 3D — EFFECTS (owner: fx): the flying dirt of the cover and the race atmosphere, all driven by the riders' real motion.
   What it draws (every piece pooled, instanced, counts set by the quality tier, one draw call each):
   - CLODS: little low-poly rocks (an InstancedMesh, 20 triangles, 8 on the weak tiers) that are LIT by the scene's lights like the dirt, tumbling,
     falling with gravity and drag, bouncing and settling on the real ground height (course.js ground()), then shrinking away.
   - SPRITES (one instanced billboard draw call): fine spray (velocity-stretched streaks, a bit of motion blur), DUST puffs (lumpy volumetric puffs
     with baked normals, lit by the scene's lights, brighter when the stadium lights are behind them) and HAZE (big faint puffs trailing the pack).
   - MOTES (high tier): dust specks floating round the camera in the light; LENS flecks (high tier): mud that splatters the lens when the camera
     is right behind a roosting rider (a pure function of the riders' spray and the drawing camera: nothing remembers the camera).
   Emission rules (FX.inputs / FX.rider / landing / crash) read the per-rider state of CONTRACT.md section 5: speed, acceleration (drive out of a
   turn, up a face), lean (cornering slide), sand, the gate launch, air / landed / impact, crashes. Nothing here reads the camera while the world
   is simulated, so the capture harness stays deterministic (only drawing uses the camera). A private seeded generator, not Math.random.
   API (race3d.js hook zones): createFx({lo, C, look, tier?, fx?}) -> FX: FX.group, FX.inputs(st, dt) (st.throttle / slip / roost / mud, above poseRider),
   FX.rider(st, dt) (the emission), FX.step(dt), FX.crashStart(f, gy, r), FX.crashStep(...), FX.stats(), FX.setBudget(0..1), FX.dispose(), FX.part (a debug view of the clods).
   The old module functions emit(P, ...) and stepParticles(P, dt) stay (r3d-riders.js re-exports them). */
import * as THREE_NS from "../ui/vendor/three-0.160.0.module.min.js";
const THREE=THREE_NS;
import {canvas,clamp,sstep} from "./r3d-util.js";
import {motionMode,isTV} from "./r3d-quality.js";
const GL=typeof window!=="undefined"?window:globalThis;

/* ---------------- the tiers: how much of everything (perf: pass {tier: "high" | "medium" | "low" | "stick"} or {fx: {...overrides}} in Q.options) ---------------- */
const TIERS={
  high:  {n:"high",   clods:900, sparks:2600, puffs:260, haze:36, motes:170, lens:6, rock:20, rate:1.00, atlas:128, bigger:1.0},
  medium:{n:"medium", clods:420, sparks:1000, puffs:130, haze:14, motes:80,  lens:0, rock:20, rate:0.8,  atlas:128, bigger:1.1},
  low:   {n:"low",    clods:240, sparks:480,  puffs:64,  haze:0,  motes:0,   lens:0, rock:8,  rate:0.7,  atlas:96,  bigger:1.25},
  ultra: {n:"ultra",   clods:1300, sparks:3600, puffs:340, haze:44, motes:210, lens:6, rock:20, rate:1.00, atlas:128, bigger:1.0},
  stick: {n:"stick",  clods:160, sparks:300,  puffs:44,  haze:0,  motes:0,   lens:0, rock:8,  rate:0.6,  atlas:96,  bigger:1.35}
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
    let d=seen.get(key); if(d===undefined){ const s=Math.sin(x*127.1+y*311.7+z*74.7)*43758.5453; d=0.78+0.44*(s-Math.floor(s)); seen.set(key,d); }
    p.setXYZ(i,x*d,y*d*0.88,z*d);
  }
  g.computeVertexNormals();
  const nr=g.attributes.normal, col=new Float32Array(p.count*3);
  for(let i=0;i<p.count;i++){ const f=Math.floor(i/3), h=Math.sin(f*91.7+1.3)*43758.5453, tone=(0.9+0.2*(h-Math.floor(h)))*(0.66+0.46*(nr.getY(i)*0.5+0.5)); col[i*3]=tone; col[i*3+1]=tone*0.98; col[i*3+2]=tone*0.94; }
  g.setAttribute("color",new THREE.BufferAttribute(col,3)); return g;
}

/* ---------------- the sprite shaders: instanced billboards, lit with the scene's own lights ---------------- */
const SPR_VS=[
"attribute vec4 aA; attribute vec4 aB; attribute vec4 aC; attribute vec4 aD;",   /* aA = x y z radius; aB = vx vy vz alpha; aC = r g b kind (0 spray, 1..4 puff variants); aD = rotation */
"uniform float uH; uniform float uShutter;",
"varying vec2 vUv; varying vec4 vC; varying float vA; varying vec2 vRot; varying vec3 vVP;",
"#include <fog_pars_vertex>",
"void main(){",
"  vec4 mvPosition=modelViewMatrix*vec4(aA.xyz,1.0);",
"  float depth=max(0.05,-mvPosition.z), size=aA.w, alpha=aB.w, kind=aC.w, ppm=uH*0.5*projectionMatrix[1][1]/depth;",
"  vec2 c=position.xy, off;",
"  if(kind<0.5){",
"    vec3 vv=(modelViewMatrix*vec4(aB.xyz,0.0)).xyz; float spd=length(vv.xy); vec2 dir=spd>1e-3?vv.xy/spd:vec2(1.0,0.0);",
"    float len=size+min(spd*uShutter,0.5), px=size*ppm, k=px<0.9?0.9/max(px,1e-4):1.0;",   /* never thinner than a pixel; a speck that small fades instead of shimmering */
"    alpha*=clamp(px/0.9,0.12,1.0)*(1.0-smoothstep(45.0,90.0,depth));",
"    off=dir*c.x*len*k+vec2(-dir.y,dir.x)*c.y*size*k; vRot=vec2(1.0,0.0);",
"  } else {",
"    float cs=cos(aD.x), sn=sin(aD.x); off=vec2(cs*c.x-sn*c.y,sn*c.x+cs*c.y)*size; vRot=vec2(cs,sn);",
"    alpha*=smoothstep(0.25,1.1,depth);",   /* a puff never fills the lens */
"  }",
"  mvPosition.xy+=off; vVP=mvPosition.xyz; vUv=c*0.5+0.5; vC=aC; vA=alpha;",
"  gl_Position=projectionMatrix*mvPosition;",
"  #include <fog_vertex>",
"}"].join("\n");
const SPR_FS=[
"uniform sampler2D uAtlas; uniform float uGain;",
"varying vec2 vUv; varying vec4 vC; varying float vA; varying vec2 vRot; varying vec3 vVP;",
"#include <common>",
"#include <fog_pars_fragment>",
"#include <lights_pars_begin>",
"vec3 sceneLight(vec3 n,vec3 vd,float back){",   /* the scene's lights on a soft normal: ambient + hemisphere + wrapped directional, plus the forward scatter toward the light */
"  vec3 L=ambientLightColor;",
"  #if NUM_HEMI_LIGHTS > 0",
"  for(int i=0;i<NUM_HEMI_LIGHTS;i++) L+=getHemisphereLightIrradiance(hemisphereLights[i],n);",
"  #endif",
"  #if NUM_DIR_LIGHTS > 0",
"  for(int i=0;i<NUM_DIR_LIGHTS;i++){ vec3 ld=directionalLights[i].direction; float w=dot(n,ld)*0.5+0.5; L+=directionalLights[i].color*(w*w+back*pow(max(0.0,dot(vd,ld)),3.0)); }",
"  #endif",
"  return L*RECIPROCAL_PI;",
"}",
"void main(){",
"  vec3 vd=normalize(vVP); vec4 col;",
"  if(vC.w<0.5){",
"    vec2 d=vUv*2.0-1.0; float a=smoothstep(1.0,0.2,length(d));",
"    col=vec4(vC.rgb*sceneLight(vec3(0.0,0.4,0.92),vd,0.5)*uGain,a*vA);",
"  } else {",
"    float cell=floor(vC.w-0.5); vec2 uv=(vec2(mod(cell,2.0),floor(cell*0.5))+0.02+0.96*vUv)*0.5; vec4 t=texture2D(uAtlas,uv);",
"    vec2 nt=t.rg*2.0-1.0; vec3 n=normalize(vec3(vRot.x*nt.x-vRot.y*nt.y,vRot.y*nt.x+vRot.x*nt.y,0.62));",
"    vec3 L=sceneLight(n,vd,1.1)*(1.0-0.22*t.b);",   /* the thick middle is a little darker (self shadow) unless the light is behind it */
"    col=vec4(vC.rgb*L*uGain,t.a*vA);",
"  }",
"  if(col.a<0.003) discard;",
"  gl_FragColor=col;",
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

const LENS_VS=[
"attribute vec4 aS; attribute float aV; uniform float uAspect;",   /* aS = centre x, y (screen, -1..1), radius (fraction of the height), seed; aV = how much of it shows */
"varying vec2 vUv; varying float vSeed; varying float vVis;",
"void main(){ vUv=position.xy; vSeed=aS.w; vVis=aV; vec2 p=aS.xy+position.xy*vec2(aS.z/uAspect,aS.z)*step(0.002,aV); gl_Position=vec4(p,0.0,1.0); }"].join("\n");
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
  /* the soil: the dark moist clods and the paler dust (linear colours; the shaders light them) */
  const soil=look.soil||"stadium-dirt";
  const COL=soil==="sand"?{clod:[0.30,0.22,0.12],dust:[0.52,0.42,0.27],loose:1.0}:soil==="hardpack"?{clod:[0.16,0.1,0.058],dust:[0.46,0.35,0.22],loose:0.8}
    :soil==="loam"?{clod:[0.07,0.045,0.027],dust:[0.3,0.22,0.15],loose:0.45}:soil==="clay"?{clod:[0.15,0.07,0.034],dust:[0.42,0.27,0.16],loose:0.6}:{clod:[0.19,0.108,0.056],dust:[0.46,0.33,0.21],loose:0.7};
  COL.spray=[COL.clod[0]*0.62+COL.dust[0]*0.38,COL.clod[1]*0.62+COL.dust[1]*0.38,COL.clod[2]*0.62+COL.dust[2]*0.38];
  /* a private generator: the effects never touch Math.random (same race = same dirt) */
  let sd=0x5EEDF00D|0; const rnd=()=>{ sd=(sd+0x6D2B79F5)|0; let t=Math.imul(sd^(sd>>>15),1|sd); t=(t+Math.imul(t^(t>>>7),61|t))^t; return ((t^(t>>>14))>>>0)/4294967296; };
  const FX={group:grp,lo:lo,tier:T.n,budget:1,off:OFF,time:0};
  const noop=()=>{};
  if(OFF){ FX.inputs=FX.rider=FX.step=FX.crashStart=FX.crashStep=FX.setBudget=FX.dispose=FX.focus=FX.debug=noop; FX.stats=()=>({tier:T.n,off:true}); FX.emit=noop; FX.part={n:0,life:new Float32Array(0)}; return FX; }

  /* ================= CLODS: an InstancedMesh of rocks ================= */
  const NC=T.clods, cPos=new Float32Array(NC*3), cVel=new Float32Array(NC*3), cLife=new Float32Array(NC), cRad=new Float32Array(NC), cSc=new Float32Array(NC*3), cAx=new Float32Array(NC*3),
    cAng=new Float32Array(NC), cSpin=new Float32Array(NC), cRest=new Uint8Array(NC), cAlive=new Uint8Array(NC), cS0=new Float32Array(NC), cL0=new Float32Array(NC), cCs=new Float32Array(NC), cSn=new Float32Array(NC),
    cX0=new Float32Array(NC), cZ0=new Float32Array(NC), cG0=new Float32Array(NC), cMax=new Float32Array(NC);
  const rockG=rockGeometry(T.rock), rockM=new THREE.MeshLambertMaterial({color:0xffffff,vertexColors:true});
  rockM.onBeforeCompile=function(sh){ sh.vertexShader=sh.vertexShader.replace("#include <begin_vertex>","#include <begin_vertex>\n#ifdef USE_INSTANCING\n  transformed*=smoothstep(0.3,1.1,-(modelViewMatrix*instanceMatrix*vec4(0.0,0.0,0.0,1.0)).z);\n#endif"); };
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
    const q1=0.75+0.6*rnd(), q2=0.7+0.6*rnd(), q3=0.75+0.5*rnd(); cSc[o]=q1; cSc[o+1]=q2; cSc[o+2]=q3;
    let ax=rnd()-0.5, ay=rnd()-0.5, az=rnd()-0.5; const al=Math.sqrt(ax*ax+ay*ay+az*az)||1; cAx[o]=ax/al; cAx[o+1]=ay/al; cAx[o+2]=az/al; cAng[k]=rnd()*6.28; cSpin[k]=(rnd()<0.5?-1:1)*(4+14*rnd());
    cS0[k]=s0; cL0[k]=lat0; cCs[k]=Math.cos(th0); cSn[k]=Math.sin(th0); cX0[k]=x; cZ0[k]=z; cG0[k]=gy;
    const m=0.55+0.75*rnd(), tint=1+0.16*(rnd()-0.5); ccol[o]=col[0]*m*tint; ccol[o+1]=col[1]*m; ccol[o+2]=col[2]*m/tint; colDirty=true;
    if(!cAlive[k]){ cAlive[k]=1; cLive++; }
  }

  /* ================= SPRITES: spray streaks, dust puffs, haze, one instanced draw call ================= */
  const NSP=T.sparks, NPF=T.puffs, NHZ=T.haze, NS=NSP+NPF+NHZ, P0=NSP, H0=NSP+NPF;
  const sPos=new Float32Array(NS*3), sVel=new Float32Array(NS*3), sLife=new Float32Array(NS), sMax=new Float32Array(NS), sSize=new Float32Array(NS), sGrow=new Float32Array(NS), sA0=new Float32Array(NS),
    sDrag=new Float32Array(NS), sGrav=new Float32Array(NS), sBuoy=new Float32Array(NS);
  const aA=new Float32Array(NS*4), aB=new Float32Array(NS*4), aC=new Float32Array(NS*4), aD=new Float32Array(NS*4);
  const sg=new THREE.InstancedBufferGeometry();
  sg.setAttribute("position",new THREE.BufferAttribute(new Float32Array([-1,-1,0, 1,-1,0, 1,1,0, -1,1,0]),3)); sg.setIndex([0,1,2, 0,2,3]);
  const iA=new THREE.InstancedBufferAttribute(aA,4).setUsage(THREE.DynamicDrawUsage), iB=new THREE.InstancedBufferAttribute(aB,4).setUsage(THREE.DynamicDrawUsage),
    iC=new THREE.InstancedBufferAttribute(aC,4).setUsage(THREE.DynamicDrawUsage), iD=new THREE.InstancedBufferAttribute(aD,4).setUsage(THREE.DynamicDrawUsage);
  sg.setAttribute("aA",iA); sg.setAttribute("aB",iB); sg.setAttribute("aC",iC); sg.setAttribute("aD",iD); sg.instanceCount=NS;
  const atlasTex=atlasTexture(T.atlas);
  const sm=new THREE.ShaderMaterial({uniforms:THREE.UniformsUtils.merge([THREE.UniformsLib.lights,THREE.UniformsLib.fog,{uAtlas:{value:atlasTex},uH:{value:720},uShutter:{value:1/150},uGain:{value:1}}]),
    vertexShader:SPR_VS,fragmentShader:SPR_FS,lights:true,fog:true,transparent:true,depthWrite:false,depthTest:true});
  const sprites=new THREE.Mesh(sg,sm); sprites.frustumCulled=false; sprites.renderOrder=3; sprites.name="fx-sprites";
  const _v2=new THREE.Vector2();
  function targetH(r){ const rt=r.getRenderTarget(); return rt?rt.height:r.getDrawingBufferSize(_v2).y; }
  sprites.onBeforeRender=function(r){ sm.uniforms.uH.value=targetH(r); };
  grp.add(sprites);
  let nextSp=0, nextPf=P0, nextHz=H0, colDirtyS=true;
  let liveS=0, liveP=0, liveH=0;
  function sprite(k,x,y,z,vx,vy,vz,size,grow,life,alpha,col,kind,rot,drag,grav,buoy){
    colDirtyS=true; const o=k*3, o4=k*4; sPos[o]=x; sPos[o+1]=y; sPos[o+2]=z; sVel[o]=vx; sVel[o+1]=vy; sVel[o+2]=vz; sSize[k]=size; sGrow[k]=grow; sLife[k]=life; sMax[k]=life; sA0[k]=alpha; sDrag[k]=drag; sGrav[k]=grav; sBuoy[k]=buoy;
    aC[o4]=col[0]; aC[o4+1]=col[1]; aC[o4+2]=col[2]; aC[o4+3]=kind; aD[o4]=rot;
    aA[o4]=x; aA[o4+1]=y; aA[o4+2]=z; aA[o4+3]=size; aB[o4]=vx; aB[o4+1]=vy; aB[o4+2]=vz; aB[o4+3]=0;
  }
  /* a streak of fine spray (a clump of dirt flying: stretched along its velocity by the shader) */
  function spray(x,y,z,vx,vy,vz,col){
    const k=nextSp; nextSp=(nextSp+1)%NSP; const m=0.55+0.8*rnd();
    sprite(k,x,y,z,vx,vy,vz,0.016+0.022*rnd(),0,0.28+0.36*rnd(),0.9,[COL.spray[0]*m,COL.spray[1]*m,COL.spray[2]*m],0,0,1.3,0.75,0);
  }
  /* a puff of dust: radius r0 growing, a life, a peak alpha, a variant of the atlas */
  function puff(x,y,z,vx,vy,vz,r0,grow,life,alpha,col,buoy,drag){
    const k=nextPf; nextPf=P0+((nextPf-P0+1)%NPF); const m=0.88+0.24*rnd();
    sprite(k,x,y,z,vx,vy,vz,r0,grow,life,alpha,[col[0]*m,col[1]*m,col[2]*m],1+((rnd()*4)|0),rnd()*6.283,drag==null?1.5:drag,0,buoy==null?0.25:buoy);
  }
  function haze(x,y,z,vx,vy,vz,r0,grow,life,alpha,col){
    if(NHZ<1) return; const k=nextHz; nextHz=H0+((nextHz-H0+1)%NHZ);
    sprite(k,x,y,z,vx,vy,vz,r0,grow,life,alpha,[col[0],col[1],col[2]],1+((rnd()*4)|0),rnd()*6.283,0.6,0,0.12);
  }

  /* ================= MOTES: dust floating round the camera (all on the GPU; high tier) ================= */
  let motes=null, mm=null;
  if(T.motes>0){
    const mg=new THREE.BufferGeometry(), mp=new Float32Array(T.motes*3); for(let i=0;i<mp.length;i++) mp[i]=rnd();
    mg.setAttribute("position",new THREE.BufferAttribute(mp,3));
    mm=new THREE.ShaderMaterial({uniforms:{uCam:{value:new THREE.Vector3()},uT:{value:0},uBox:{value:new THREE.Vector3(22,9,22)},uH:{value:720},uSize:{value:0.012},uCol:{value:new THREE.Vector3(1.0,0.78,0.5)}},
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
    lAV=new Float32Array(K); lg.setAttribute("aS",new THREE.InstancedBufferAttribute(S,4)); lg.setAttribute("aV",new THREE.InstancedBufferAttribute(lAV,1).setUsage(THREE.DynamicDrawUsage)); lg.instanceCount=K;
    lm=new THREE.ShaderMaterial({uniforms:{uAspect:{value:1.78}},vertexShader:LENS_VS,fragmentShader:LENS_FS,transparent:true,depthWrite:false,depthTest:false});
    lens=new THREE.Mesh(lg,lm); lens.frustumCulled=false; lens.renderOrder=999; lens.name="fx-lens";
    const fw=new THREE.Vector3(), tmp=new THREE.Vector3();
    lens.onBeforeRender=function(r,sc,cam){
      lm.uniforms.uAspect.value=cam.aspect||1.78; cam.getWorldDirection(fw); const cp=cam.position; let ex=0;
      for(let j=0;j<rec.length;j++){ const e=rec[j]; if(!e||e.f<FRAME-1) continue; const dx=e.x-cp.x, dy=e.y+0.4-cp.y, dz=e.z-cp.z, d=Math.sqrt(dx*dx+dy*dy+dz*dz);
        if(d<0.5||d>9) continue; const f=(dx*fw.x+dy*fw.y+dz*fw.z)/d; if(f<0.55) continue; const w=1-d/9; ex+=e.spray*w*w*(f-0.45); }
      for(let j=0;j<burst.length;j++){ const b=burst[j]; const dx=b[0]-cp.x, dy=b[1]-cp.y, dz=b[2]-cp.z, d=Math.sqrt(dx*dx+dy*dy+dz*dz); if(d<0.5||d>8) continue;
        const f=(dx*fw.x+dy*fw.y+dz*fw.z)/d; if(f<0.5) continue; const w=1-d/8; ex+=b[3]*w*w*(f-0.4); }
      const K=lAV.length; for(let k=0;k<K;k++){ const need=(k+0.5)/K; lAV[k]=clamp((ex*4.5-need*0.9)*3.0,0,1); }
      lg.attributes.aV.needsUpdate=true;
    };
    grp.add(lens);
  }

  /* ================= the per-rider memory and the emission regulator ================= */
  function recOf(i){ let e=rec[i]; if(!e){ e={f:-9,air:false,x:0,y:0,z:0,spray:0,acc:0,power:0,berm:0,launch:0,cA:0,sA:0,dA:0,hA:0,fA:0,mudS:0}; rec[i]=e; } return e; }
  const PS={c:1,s:1,p:1,h:1};   /* how much of the wanted emission the pools take now (from last frame's fill) */
  const RATE=T.rate, BIG=T.bigger;
  let simT=0, FRAME=1, slowT=0, fastT=0;   /* FRAME counts the steps: a rider's memory is current if FX.rider ran for it this frame or the last */

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
    st.throttle=clamp(power+berm*0.5,0,1);
    st.slip=clamp(power*0.7+berm*0.45+(st.sand||0)*0.3+launch*0.25,0,1);
    st.roost=st.slip*8;
  };

  /* ---------------- take-off: the rear wheel digs into the lip and throws a handful of dirt and a puff back ---------------- */
  function takeoff(st,cth,sth,rx,rz){
    const v=st.v, g=st.tR+0.05, px=st.x-cth*0.8, pz=st.z-sth*0.8, s0=st.onStart?-1:st.s-0.8, n=Math.round((7+v*0.6)*RATE), m=Math.round((34+v*3)*RATE);
    for(let k=0;k<n;k++){ const sd=(rnd()+rnd()-1)*2.2, up=2.2+3.8*rnd(); clod(px+rx*(rnd()-0.5)*0.15,g+0.05,pz+rz*(rnd()-0.5)*0.15,cth*v*0.15-cth*(0.4+1.6*rnd())+rx*sd,up,sth*v*0.15-sth*(0.4+1.6*rnd())+rz*sd,(0.015+0.03*Math.pow(rnd(),2))*BIG,0.9+0.8*rnd(),COL.clod,g,s0,st.lat,st.th); }
    for(let k=0;k<m;k++){ const sd=(rnd()+rnd()-1)*2.6, up=2.0+5.0*rnd(); spray(px,g+0.08,pz,cth*v*0.18-cth*(0.5+2.2*rnd())+rx*sd,up,sth*v*0.18-sth*(0.5+2.2*rnd())+rz*sd,COL.spray); }
    for(let k=0,q=Math.max(1,Math.round(2*Math.min(1,0.4+RATE)));k<q;k++){ const side=(rnd()<0.5?-1:1)*(0.3+1.0*rnd()); puff(px,g+0.3,pz,cth*v*0.1-cth*0.6+rx*side,0.6+0.8*rnd(),sth*v*0.1-sth*0.6+rz*side,0.4+0.25*rnd(),0.9+0.4*rnd(),1.6+0.8*rnd(),0.26+0.1*rnd(),COL.dust,0.3,1.3); }
  }
  /* ---------------- landing: dust and a ring of clods, bigger for a harder landing (st.impact, m/s) ---------------- */
  function landing(st,cth,sth,rx,rz){
    const im=st.impact, big=clamp((im-1)/7,0,1), cc=COL.clod, dc=COL.dust;
    const nC=Math.round((8+im*4)*RATE), nS=Math.round((40+im*20)*RATE), nP=Math.max(2,Math.round((3+im*0.7)*Math.min(1,0.4+RATE)));
    for(let w=0;w<2;w++){                      /* the rear wheel lands under the bike, the front a wheelbase ahead */
      const off=w?0.72:-0.72, px=st.x+cth*off, pz=st.z+sth*off, gy=(w?st.tF:st.tR)+0.03, wt=w?0.45:0.55, s0=st.onStart?-1:st.s+off;
      for(let k=0,n=Math.round(nC*wt);k<n;k++){ const a=rnd()*6.283, sp=(0.9+2.6*rnd()+0.28*im)*(0.5+0.5*rnd()), up=1.4+0.4*im*rnd()+2.4*rnd();
        clod(px,gy+0.02,pz,Math.cos(a)*sp+cth*st.v*0.35,up,Math.sin(a)*sp+sth*st.v*0.35,(0.013+0.034*Math.pow(rnd(),2.2))*BIG*(1+0.5*big),1.0+0.9*rnd(),cc,gy,s0,st.lat,st.th); }
      for(let k=0,n=Math.round(nS*wt);k<n;k++){ const a=rnd()*6.283, sp=(1.4+4.2*rnd()+0.4*im)*(0.5+0.5*rnd()); spray(px,gy+0.04,pz,Math.cos(a)*sp+cth*st.v*0.4,1.2+3.2*rnd()+0.3*im,Math.sin(a)*sp+sth*st.v*0.4,cc); }
      for(let k=0,n=Math.max(1,Math.round(nP*wt));k<n;k++){ const a=(k/n+rnd()*0.4)*6.283, sp=0.9+1.9*rnd()+0.25*im;
        puff(px+Math.cos(a)*0.2,gy+0.16,pz+Math.sin(a)*0.2,Math.cos(a)*sp+cth*st.v*0.45,0.25+0.5*rnd(),Math.sin(a)*sp+sth*st.v*0.45,0.28+0.14*rnd()+0.03*im,0.7+0.35*rnd(),1.1+0.7*rnd()+0.12*im,0.2+0.26*big+0.1*rnd(),dc,0.2,1.7); }
    }
    if(burst.length>5) burst.shift(); burst.push([st.x,st.y,st.z,0.35+0.5*big]);
  }

  /* how much the camera cares about a rider (weaker tiers only: the pools are small, so the dirt goes where the viewer looks): 1 near, less far, little behind */
  const cpos={x:0,z:0,fx:0,fz:1};
  function camNote(){ if(!CAM) return; const e=CAM.matrixWorld.elements; cpos.x=CAM.position.x; cpos.z=CAM.position.z; const fx=-e[8], fz=-e[10], l=Math.hypot(fx,fz)||1; cpos.fx=fx/l; cpos.fz=fz/l; }
  const focus={x:0,z:0,on:false};
  FX.focus=function(p){ if(p){ focus.x=p.x; focus.z=p.z; focus.on=true; } else focus.on=false; };   /* the director's subject: the high tiers send the dirt where the viewer looks without ever reading the camera */
  function care(x,z){
    if(!CAM){ if(!focus.on) return 1; const fx=x-focus.x, fz=z-focus.z, fd=Math.sqrt(fx*fx+fz*fz); return fd<22?1:fd<55?1-0.55*(fd-22)/33:0.45-0.3*Math.min(1,(fd-55)/60); }
    const dx=x-cpos.x, dz=z-cpos.z, d=Math.sqrt(dx*dx+dz*dz), f=(dx*cpos.fx+dz*cpos.fz)/(d+1e-3);
    let w=d<18?1:d<45?1-0.62*(d-18)/27:Math.max(0.1,0.38-0.28*(d-45)/50); if(f<0.1&&d>5) w*=0.25;
    return w;
  }

  /* ---------------- the rider, every frame: the roost off the rear wheel, the flick off the front, the dust trail, the haze, the mud ---------------- */
  FX.rider=function(st,dt){
    const e=recOf(st.i); e.f=FRAME; e.x=st.x; e.y=st.y; e.z=st.z;
    if(!(dt>0)) return;
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
    e.cA+=(2+5*cruise+380*pw+320*bm+110*sand*cruise)*dt*PS.c*imp; let n=e.cA|0; e.cA-=n; if(n>40) n=40;
    while(n-->0){
      const up=(2.6+6.4*Math.pow(rnd(),0.9))*lift, bk=(rnd()-0.3)*(1.2+3.2*ef)+0.05*v, sd=(rnd()+rnd()-1)*(1.6+1.8*bm)-sgn*bm*(1.5+3.5*rnd()), cr=(0.1+0.25*rnd())*v;
      const bx=st.x-cth*(0.8+v*dt*rnd())+rx*(rnd()-0.5)*0.14, bz=st.z-sth*(0.8+v*dt*rnd())+rz*(rnd()-0.5)*0.14, big=rnd()<0.025?1.5:1;
      clod(bx,gR+0.05+0.1*rnd(),bz,cth*cr-cth*bk+rx*sd,up,sth*cr-sth*bk+rz*sd,(0.015+0.036*Math.pow(rnd(),2.2))*big*BIG,0.9+0.9*rnd(),COL.clod,gR,s0R,st.lat,st.th);
    }
    /* the fine spray: hundreds of specks in the same fan, faster */
    e.sA+=(10*cruise+1300*pw+900*bm+320*sand*cruise)*dt*PS.s*imp; n=e.sA|0; e.sA-=n; if(n>60) n=60;
    while(n-->0){
      const up=(1.6+7.6*rnd())*lift, bk=(rnd()-0.3)*(1.6+4.2*ef)+0.05*v, sd=(rnd()+rnd()-1)*(2.2+2.2*bm)-sgn*bm*(1.5+4*rnd()), cr=(0.1+0.3*rnd())*v;
      spray(st.x-cth*(0.8+v*dt*rnd())+rx*(rnd()-0.5)*0.2,gR+0.06+0.12*rnd(),st.z-sth*(0.8+v*dt*rnd())+rz*(rnd()-0.5)*0.2,cth*cr-cth*bk+rx*sd,up,sth*cr-sth*bk+rz*sd,COL.spray);
    }
    /* the front wheel in a berm or a rut flicks dirt to the outside and ahead */
    e.fA+=(bm>0.2&&v>4?(18+60*bm)*(0.4+0.6*Math.min(1,v/12)):0)*dt*PS.c*imp; n=e.fA|0; e.fA-=n; if(n>12) n=12;
    while(n-->0){ const fo=0.78+rnd()*0.1, out=-sgn*(2.0+3.5*rnd()), up=1.4+3.0*rnd(), fr=0.25*v+0.5*v*rnd();
      const fx=st.x+cth*fo+rx*(rnd()-0.5)*0.1, fz=st.z+sth*fo+rz*(rnd()-0.5)*0.1;
      if(rnd()<0.35) clod(fx,gF+0.05,fz,cth*fr+rx*out,up,sth*fr+rz*out,(0.014+0.03*Math.pow(rnd(),2))*BIG,0.9+0.8*rnd(),COL.clod,gF,s0F,st.lat,st.th);
      else spray(fx,gF+0.06,fz,cth*fr+rx*out*1.2,up*1.1,sth*fr+rz*out*1.2,COL.spray); }
    /* the dust off the rear tyre: a rooster tail of puffs in a hollow fan (the line straight behind the bike stays clear for a chase camera), more under power, on the brakes and in sand; the 22 on the gate throw less each */
    const pwD=pw*(1-0.86*e.launch);
    e.dA+=(1.2+3.5*cruise*loose+18*pwD*loose+10*bm+8*sand*cruise+6*brake)*dt*PS.p*imp; n=e.dA|0; e.dA-=n; if(n>8) n=8;
    while(n-->0){ const side=(rnd()<0.5?-1:1)*(0.5+1.4*rnd()), hi=rnd()<0.25*ef?2.2:1, off=0.9+v*dt*rnd(), ox=rx*side*0.2;
      puff(st.x-cth*off+ox,gR+0.25+0.25*rnd(),st.z-sth*off+rz*side*0.2,cth*v*0.12-cth*(0.3+0.8*rnd())+rx*side*0.9-sgn*bm*rx*1.2,(0.5+1.0*rnd())*hi,sth*v*0.12-sth*(0.3+0.8*rnd())+rz*side*0.9-sgn*bm*rz*1.2,
      0.36+0.26*rnd()+0.2*ef,0.8+0.5*rnd()+0.3*ef,1.5+1.0*rnd()+0.4*ef,(0.2+0.14*rnd()+0.16*ef+0.05*sand)*(0.7+0.3*loose)*(1-0.72*e.launch),COL.dust,0.3,1.4); }
    /* the haze that hangs over the track behind a fast pack: large, faint, slow */
    e.hA+=(v>6?0.8+0.7*ef:0)*dt*PS.h*(st.me?1.3:1)*RATE; n=e.hA|0; e.hA-=n; if(n>3) n=3;
    while(n-->0) haze(st.x-cth*(1.4+3*rnd())+rx*(rnd()-0.5)*1.5,gR+0.7+0.9*rnd(),st.z-sth*(1.4+3*rnd())+rz*(rnd()-0.5)*1.5,(rnd()-0.5)*0.5,0.15,(rnd()-0.5)*0.5,1.3+0.8*rnd(),0.45+0.25*rnd(),3.2+2.4*rnd(),0.05+0.035*rnd(),COL.dust);
  };

  /* ---------------- a crash begins at f ({x, z, th}, the centre line) where the rider r was, the ground gy: a burst of dirt and a cloud of dust ---------------- */
  FX.crashStart=function(f,gy,r){
    const p=r&&r.pos?r.pos:null, x=p?p.x:f.x, z=p?p.z:f.z, th=r&&r.th!=null?r.th:f.th||0, v=r&&r.v?Math.min(20,r.v):10, cth=Math.cos(th), sth=Math.sin(th), g=gy+0.05;
    const nC=Math.round(40*RATE), nS=Math.round(110*RATE), nP=Math.max(3,Math.round(9*Math.min(1,0.35+RATE)));
    for(let k=0;k<nC;k++){ const a=rnd()*6.283, sp=1.2+4.2*rnd(), fw=v*(0.25+0.45*rnd()); clod(x+(rnd()-0.5)*0.9,g+0.1+0.4*rnd(),z+(rnd()-0.5)*0.9,Math.cos(a)*sp+cth*fw,2+4.5*rnd(),Math.sin(a)*sp+sth*fw,(0.015+0.04*Math.pow(rnd(),2))*BIG*(rnd()<0.06?1.8:1),1.2+1.0*rnd(),COL.clod,g,-1,0,th); }
    for(let k=0;k<nS;k++){ const a=rnd()*6.283, sp=1.5+5.5*rnd(), fw=v*(0.2+0.5*rnd()); spray(x+(rnd()-0.5)*0.8,g+0.1+0.5*rnd(),z+(rnd()-0.5)*0.8,Math.cos(a)*sp+cth*fw,1.5+5*rnd(),Math.sin(a)*sp+sth*fw,COL.clod); }
    for(let k=0;k<nP;k++){ const a=(k/nP+rnd()*0.3)*6.283, sp=0.8+2.4*rnd(), fw=v*(0.12+0.3*rnd()); puff(x+Math.cos(a)*0.3,g+0.35+0.4*rnd(),z+Math.sin(a)*0.3,Math.cos(a)*sp+cth*fw,0.5+1.0*rnd(),Math.sin(a)*sp+sth*fw,0.5+0.3*rnd(),0.9+0.5*rnd(),1.8+1.1*rnd(),0.34+0.2*rnd(),COL.dust,0.3,1.2); }
    burst.push([x,g,z,0.9]); if(burst.length>6) burst.shift();
  };
  /* the crash script, every frame: dust where the rider hits the dirt and at each bounce (c.fx counts them), a plough of dirt behind the sliding bike
     (c = the crash record, t = seconds since the fall, ts = how long the bike slides; (hx, hgy, hz) the rider, (bx, gy, bz) the bike, thB its heading) */
  FX.crashStep=function(c,t,dt,hx,hgy,hz,bx,gy,bz,thB,ts){
    if(!(dt>0)) return;
    const ev=[0.62,1.01,1.4];
    while(c.fx<ev.length&&t>=ev[c.fx]){
      const first=c.fx===0, nC=Math.round((first?16:9)*RATE), nP=Math.max(2,Math.round((first?5:3)*Math.min(1,0.35+RATE))), nS=Math.round((first?50:30)*RATE), g=hgy+0.06;
      for(let k=0;k<nC;k++){ const a=rnd()*6.283, sp=0.8+2.8*rnd(); clod(hx+(rnd()-0.5)*0.6,g+0.15,hz+(rnd()-0.5)*0.6,Math.cos(a)*sp,1.6+3*rnd(),Math.sin(a)*sp,(0.014+0.034*Math.pow(rnd(),2))*BIG,1.0+0.9*rnd(),COL.clod,g,-1,0,thB); }
      for(let k=0;k<nS;k++){ const a=rnd()*6.283, sp=1+4*rnd(); spray(hx+(rnd()-0.5)*0.6,g+0.2,hz+(rnd()-0.5)*0.6,Math.cos(a)*sp,1+3.6*rnd(),Math.sin(a)*sp,COL.clod); }
      for(let k=0;k<nP;k++){ const a=rnd()*6.283, sp=0.6+1.8*rnd(); puff(hx+Math.cos(a)*0.3,g+0.2+0.3*rnd(),hz+Math.sin(a)*0.3,Math.cos(a)*sp,0.4+0.8*rnd(),Math.sin(a)*sp,0.45+0.3*rnd(),0.85+0.4*rnd(),1.5+1.0*rnd(),(first?0.36:0.26)+0.12*rnd(),COL.dust,0.3,1.3); }
      burst.push([hx,g,hz,first?0.7:0.45]); if(burst.length>6) burst.shift(); c.fx++;
    }
    if(t<ts){   /* the bike ploughs along on its side: a spray of dirt to its far side and a trail of dust */
      const sl=1-t/ts, cb=Math.cos(thB), sb=Math.sin(thB); let nC=Math.min(3,((c.cA=(c.cA||0)+dt*(14+16*sl)*PS.c*RATE)|0)); c.cA-=nC;
      while(nC-->0) clod(bx+(rnd()-0.5)*0.6,gy+0.12,bz+(rnd()-0.5)*0.6,-cb*(0.4+1.2*rnd())+(rnd()-0.5)*2.4,0.8+2.4*rnd(),-sb*(0.4+1.2*rnd())+(rnd()-0.5)*2.4,(0.013+0.03*Math.pow(rnd(),2))*BIG,0.9+0.8*rnd(),COL.clod,gy,-1,0,thB);
      let nS=Math.min(8,((c.cS=(c.cS||0)+dt*(90+90*sl)*PS.s*RATE)|0)); c.cS-=nS;
      while(nS-->0) spray(bx+(rnd()-0.5)*0.7,gy+0.1,bz+(rnd()-0.5)*0.7,-cb*(0.8+2*rnd())+(rnd()-0.5)*3,0.8+3*rnd(),-sb*(0.8+2*rnd())+(rnd()-0.5)*3,COL.clod);
      let nP=Math.min(2,((c.cP=(c.cP||0)+dt*(10+10*sl)*PS.p*RATE)|0)); c.cP-=nP;
      while(nP-->0) puff(bx+(rnd()-0.5)*0.7,gy+0.2+0.2*rnd(),bz+(rnd()-0.5)*0.7,-Math.cos(thB)*1.0+(rnd()-0.5)*0.8,0.3+0.5*rnd(),-Math.sin(thB)*1.0+(rnd()-0.5)*0.8,0.35+0.25*rnd(),0.7+0.4*rnd(),1.3+0.8*rnd(),0.2+0.12*rnd(),COL.dust,0.25,1.5);
    }
  };

  /* ================= the step: move everything, write the buffers, set next frame's regulator ================= */
  FX.step=function(dt){
    if(!(dt>0)) return;
    if(!LIVE){   /* with no ladder (perf's Q.live) the budget adapts by itself: slow frames thin the emission, fast frames bring it back */
      if(dt>0.22){ slowT=0; } else if(dt>0.036){ slowT+=dt; fastT=0; } else if(dt<0.022){ fastT+=dt; slowT=Math.max(0,slowT-dt*0.5); }
      if(slowT>2.0&&FX.budget>0.36){ FX.budget=Math.max(0.35,FX.budget*0.8); slowT=0; } else if(fastT>5&&FX.budget<1&&!FX.pinned){ FX.budget=Math.min(1,FX.budget*1.12); fastT=0; } }
    dt=Math.min(dt,0.12); simT+=dt; if(mm) mm.uniforms.uT.value=simT; camNote();
    for(let b=burst.length-1;b>=0;b--){ burst[b][3]-=dt*0.8; if(burst[b][3]<=0) burst.splice(b,1); }
    const sub=dt>0.034?Math.ceil(dt/0.0167):1, h=dt/sub;
    for(let s=0;s<sub;s++) stepOnce(h);
    rocks.instanceMatrix.needsUpdate=true; if(colDirty){ rocks.instanceColor.needsUpdate=true; colDirty=false; }
    iA.needsUpdate=true; iB.needsUpdate=true; iC.needsUpdate=colDirtyS; iD.needsUpdate=colDirtyS; colDirtyS=false;
    /* the regulator: a pool that is filling up slows its emitters down (so 22 riders on the gate share the budget); the budget scales it all */
    FRAME++; const bd=FX.budget*(LIVE&&LIVE.particleScale!=null?clamp(LIVE.particleScale,0.05,1):1);
    PS.c=clamp(1.7*(1-cLive/NC),0.08,1)*bd; PS.s=clamp(1.7*(1-liveS/Math.max(1,NSP)),0.08,1)*bd; PS.p=clamp(1.7*(1-liveP/Math.max(1,NPF)),0.06,1)*bd; PS.h=NHZ?clamp(1.7*(1-liveH/NHZ),0.05,1)*bd:0;
  };
  function stepOnce(h){
    /* clods */
    const drag=1-0.5*h; let live=0;
    for(let k=0;k<NC;k++){
      if(!cAlive[k]) continue;
      let L=cLife[k]-h; cLife[k]=L; const o=k*3, m=k*16;
      if(L<=0){ cAlive[k]=0; cm[m]=cm[m+1]=cm[m+2]=cm[m+4]=cm[m+5]=cm[m+6]=cm[m+8]=cm[m+9]=cm[m+10]=0; cm[m+13]=-999; continue; }
      live++;
      let x=cPos[o], y=cPos[o+1], z=cPos[o+2];
      if(!cRest[k]){
        let vx=cVel[o]*drag, vy=cVel[o+1]*drag-9.81*h, vz=cVel[o+2]*drag;
        x+=vx*h; y+=vy*h; z+=vz*h;
        const g=groundAt(k,x,z)+cRad[k]*0.55;
        if(y<g){ y=g;
          if(vy<-1.3){ vy=-vy*0.3; vx*=0.6; vz*=0.6; cSpin[k]*=0.55; }
          else { vx=vy=vz=0; cRest[k]=1; cSpin[k]=0; const keep=0.4+0.5*(k%5)/5; if(L>keep) cLife[k]=L=keep; } }
        cVel[o]=vx; cVel[o+1]=vy; cVel[o+2]=vz; cPos[o]=x; cPos[o+1]=y; cPos[o+2]=z; cAng[k]+=cSpin[k]*h;
      }
      /* the matrix: rotation about the clod's own axis by its angle (Rodrigues), scaled, shrinking away at the end of its life */
      const th=cAng[k], c=Math.cos(th), s=Math.sin(th), t=1-c, ax=cAx[o], ay=cAx[o+1], az=cAx[o+2], f=cRad[k]*(L<0.3?L/0.3:1), sx=f*cSc[o], sy=f*cSc[o+1], sz=f*cSc[o+2];
      cm[m]=(c+t*ax*ax)*sx; cm[m+1]=(t*ax*ay+s*az)*sx; cm[m+2]=(t*ax*az-s*ay)*sx;
      cm[m+4]=(t*ax*ay-s*az)*sy; cm[m+5]=(c+t*ay*ay)*sy; cm[m+6]=(t*ay*az+s*ax)*sy;
      cm[m+8]=(t*ax*az+s*ay)*sz; cm[m+9]=(t*ay*az-s*ax)*sz; cm[m+10]=(c+t*az*az)*sz;
      cm[m+12]=x; cm[m+13]=y; cm[m+14]=z;
    }
    cLive=live;
    /* sprites */
    let ls=0, lp=0, lh=0;
    for(let k=0;k<NS;k++){
      let L=sLife[k]; if(L<=0) continue; L-=h; sLife[k]=L; const o=k*3, o4=k*4;
      if(L<=0){ aA[o4+3]=0; aB[o4+3]=0; continue; }
      if(k<P0) ls++; else if(k<H0) lp++; else lh++;
      const dr=1-sDrag[k]*h; let vx=sVel[o]*dr, vy=sVel[o+1]*dr+(-9.81*sGrav[k]+sBuoy[k])*h, vz=sVel[o+2]*dr;
      sVel[o]=vx; sVel[o+1]=vy; sVel[o+2]=vz; const x=sPos[o]+vx*h, y=sPos[o+1]+vy*h, z=sPos[o+2]+vz*h; sPos[o]=x; sPos[o+1]=y; sPos[o+2]=z;
      const sz=sSize[k]+sGrow[k]*h; sSize[k]=sz;
      const m=sMax[k], att=Math.min(1,(m-L)/(k<P0?0.03:0.14)), fo=k<P0?L/m:Math.pow(L/m,0.85);
      aA[o4]=x; aA[o4+1]=y; aA[o4+2]=z; aA[o4+3]=sz; aB[o4]=vx; aB[o4+1]=vy; aB[o4+2]=vz; aB[o4+3]=sA0[k]*att*fo;
    }
    liveS=ls; liveP=lp; liveH=lh;
  }

  /* tests: the live particles within r metres of (x, z): counts and a few samples; the rider memory */
  FX.debug=function(x,z,r){
    const o={clods:0,sprays:0,puffs:0,haze:0,samples:[],rec:rec.map(e=>e?{power:+e.power.toFixed(2),berm:+e.berm.toFixed(2),spray:+e.spray.toFixed(2),cA:+e.cA.toFixed(2)}:null)};
    for(let k=0;k<NC;k++){ if(!cAlive[k]) continue; const dx=cPos[k*3]-x, dz=cPos[k*3+2]-z; if(dx*dx+dz*dz<r*r){ o.clods++; if(o.samples.length<6) o.samples.push(["c",+cPos[k*3].toFixed(2),+cPos[k*3+1].toFixed(2),+cPos[k*3+2].toFixed(2),+cLife[k].toFixed(2),cRest[k],+cRad[k].toFixed(3)]); } }
    for(let k=0;k<NS;k++){ if(sLife[k]<=0) continue; const dx=sPos[k*3]-x, dz=sPos[k*3+2]-z; if(dx*dx+dz*dz<r*r){ if(k<P0) o.sprays++; else if(k<H0) o.puffs++; else o.haze++; } }
    return o;
  };
  FX.setBudget=function(f){ FX.budget=clamp(f,0.05,1); FX.pinned=f<1; };   /* (a budget set from outside is kept: the self-adapting ladder only brings back what it took) */
  FX.emit=function(x,y,z,vx,vy,vz,size,life,dirt){ if(size>0.3) puff(x,y,z,vx,vy,vz,size,0.5,life,0.25,dirt||COL.dust); else clod(x,y,z,vx,vy,vz,Math.max(0.01,size*0.5),life,dirt||COL.clod,y-0.1,-1,0,0); };
  FX.stats=function(){ return {tier:T.n,clods:cLive,clodPool:NC,sprays:liveS,sprayPool:NSP,puffs:liveP,puffPool:NPF,haze:liveH,hazePool:NHZ,motes:T.motes,lens:T.lens,budget:FX.budget,regulator:{c:+PS.c.toFixed(2),s:+PS.s.toFixed(2),p:+PS.p.toFixed(2)}}; };
  FX.part={n:NC,pos:cPos,vel:cVel,life:cLife,max:cMax,get next(){ return cNext; }};
  FX.dispose=function(){ rocks.dispose(); rockG.dispose(); rockM.dispose(); sg.dispose(); sm.dispose(); atlasTex.dispose(); if(motes){ motes.geometry.dispose(); mm.dispose(); } if(lens){ lg.dispose(); lm.dispose(); } };
  return FX;
}
