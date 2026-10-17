/* MOTOCROSS WAR 3D — THE STADIUM BOWL (owner: stadium): the enormous lit stadium of the cover. A deep three-tier bowl lofted round the floor
   (lower seats, a cross aisle, upper lower-seats, the concourse and its LED ribbon, the suites' windows, the cantilever, the upper deck, the rim
   with its ribbon and a roof edge of lights), a crowd of tens of thousands drawn by a shader from a 64-person atlas (every seat its own person,
   cheering groups, a wave rolling round the bowl, camera flashes), the ad boards round the floor, light towers with banks of floodlights and
   their glow and flares, big video boards (lap, leader, race clock), haze cones from the banks. ES module on three.js r160 (vendored at
   ui/vendor). Original art only: every texture is drawn in code (r3d-stadium-art.js).
   stadium(C, look, q, root, ctx) -> {cx, cz, frame(dt, tw, cam, T, lap, len, leaderNum), board}. q = quality options (q.lo = Reduce effects / the Stick;
   optional tier fields, all with defaults from q.lo: q.segs, q.fancy, q.towers, q.haze). The bowl's footprint is a superellipse (e = 6) round the floor:
   r3d-cams.js keeps cameras inside a smaller one (e = 4), so every camera stays inside. */
import * as THREE_NS from "../ui/vendor/three-0.160.0.module.min.js";
const THREE=THREE_NS;
import {lin,mixc,clamp,sstep,canvas,tex,rngf,merge,paint,xf} from "./r3d-util.js";
import {SOIL,dirtMaps} from "./r3d-track.js";
import {CROWD,crowdAtlas,boardsTex,ribbonTex,suitesTex,drawBoard,glowSheet,BRAND} from "./r3d-stadium-art.js";

const sgn=v=>v<0?-1:1;
/* the footprint: a superellipse resampled to equal steps along its length, with the outward normal at every point */
function makeRing(cx,cz,rx,rz,e,segs){
  const M=4096, P=new Float64Array((M+1)*2), Lc=new Float64Array(M+1);
  for(let i=0;i<=M;i++){ const a=i/M*Math.PI*2, ca=Math.cos(a), sa=Math.sin(a); P[i*2]=sgn(ca)*Math.pow(Math.abs(ca),2/e)*rx; P[i*2+1]=sgn(sa)*Math.pow(Math.abs(sa),2/e)*rz;
    if(i) Lc[i]=Lc[i-1]+Math.hypot(P[i*2]-P[i*2-2],P[i*2+1]-P[i*2-1]); }
  const tot=Lc[M], pts=[]; let j=0;
  for(let k=0;k<segs;k++){ const t=k/segs*tot; while(j<M-1&&Lc[j+1]<t) j++; const f=(t-Lc[j])/((Lc[j+1]-Lc[j])||1);
    const px=P[j*2]+(P[j*2+2]-P[j*2])*f, pz=P[j*2+1]+(P[j*2+3]-P[j*2+1])*f;
    let nx=sgn(px)*Math.pow(Math.abs(px/rx),e-1)/rx, nz=sgn(pz)*Math.pow(Math.abs(pz/rz),e-1)/rz; const l=Math.hypot(nx,nz)||1;
    pts.push({x:cx+px,z:cz+pz,nx:nx/l,nz:nz/l}); }
  return {pts:pts,len:tot,n:segs};
}
/* the level curve at distance d outside the footprint: x, z, and the running length along it (the seats are 0.55 m wherever it is) */
function levelFn(ring){
  const cache={};
  return d=>{ const k=d.toFixed(3); if(cache[k]) return cache[k]; const n=ring.n, X=new Float32Array(n+1), Z=new Float32Array(n+1), U=new Float64Array(n+1);
    for(let i=0;i<=n;i++){ const p=ring.pts[i%n]; X[i]=p.x+p.nx*d; Z[i]=p.z+p.nz*d; if(i) U[i]=U[i-1]+Math.hypot(X[i]-X[i-1],Z[i]-Z[i-1]); }
    return cache[k]={X:X,Z:Z,U:U,len:U[n]}; };
}
/* a mesh builder: position, uv, vertex colour, aRing (x = where round the bowl 0..1, y = an aisle's width there, as a fraction of the bowl) */
function Mesher(){
  const P=[],UV=[],C=[],RG=[],I=[]; let n=0;
  const A={vert(x,y,z,u,v,r,g,b,rx,ry){ P.push(x,y,z); UV.push(u,v); C.push(r,g,b); RG.push(rx||0,ry||0); return n++; },
    quad(a,b,c,d){ I.push(a,b,c,b,d,c); },
    count(){ return n; },
    geo(){ const g=new THREE.BufferGeometry(); g.setAttribute("position",new THREE.Float32BufferAttribute(P,3)); g.setAttribute("uv",new THREE.Float32BufferAttribute(UV,2)); g.setAttribute("color",new THREE.Float32BufferAttribute(C,3));
      g.setAttribute("aRing",new THREE.Float32BufferAttribute(RG,2)); g.setIndex(I); return g; }};
  return A;
}
/* a lofted strip between two profile points pr = [d0, y0, d1, y1] (distance out from the footprint, height), cut into `sub` steps; fn(t, ringFrac, U, out) fills out {u, v, r, g, b, ar} */
function loft(M,LV,segs,pr,sub,fn){
  const L0=LV(pr[0]), L1=LV(pr[2]), out={u:0,v:0,r:1,g:1,b:1,ar:0}, rows=[];
  for(let s=0;s<=sub;s++){ const t=s/sub, row=[];
    for(let i=0;i<=segs;i++){ const x=L0.X[i]+(L1.X[i]-L0.X[i])*t, z=L0.Z[i]+(L1.Z[i]-L0.Z[i])*t, y=pr[1]+(pr[3]-pr[1])*t, U=L0.U[i]+(L1.U[i]-L0.U[i])*t;
      out.ar=0; fn(t,i/segs,U,out); row.push(M.vert(x,y,z,out.u,out.v,out.r,out.g,out.b,i/segs,out.ar)); }
    rows.push(row); }
  for(let s=0;s<sub;s++) for(let i=0;i<segs;i++) M.quad(rows[s][i],rows[s][i+1],rows[s+1][i],rows[s+1][i+1]);
}

/* the crowd: every seat is one person from the atlas, picked by a hash of its place: no repeating wallpaper. Basic material (the floodlights are
   baked into the vertex shade per row and per place round the bowl), the person lookup replaces the map fragment. FANCY: cheering groups, a wave,
   sway, camera flashes. */
function crowdMaterial(atlas,U,fancy){
  const m=new THREE.MeshBasicMaterial({map:atlas,vertexColors:true,side:THREE.DoubleSide});
  if(fancy) m.defines={FANCY:1};
  m.onBeforeCompile=sh=>{
    sh.uniforms.uTime=U.uTime;
    sh.vertexShader=sh.vertexShader.replace("#include <common>","#include <common>\nattribute vec2 aRing; varying vec2 vRing;").replace("#include <begin_vertex>","#include <begin_vertex>\n vRing=aRing;");
    sh.fragmentShader=sh.fragmentShader.replace("#include <common>",`#include <common>
varying vec2 vRing; uniform float uTime;
uint pcg(uint v){ uint s=v*747796405u+2891336453u; uint w=((s>>((s>>28u)+4u))^s)*277803737u; return (w>>22u)^w; }
float rnd(uvec2 p,uint k){ return float(pcg(p.x*1973u+p.y*9277u+k*26699u+1u))*(1.0/4294967295.0); }`)
    .replace("#include <map_fragment>",`
#ifdef USE_MAP
{
  vec2 cu=vMapUv; vec2 gx=dFdx(cu), gy=dFdy(cu); float fw=max(length(gx),length(gy));
  vec2 id=floor(cu); vec2 f=cu-id; uvec2 ui=uvec2(id);
  float r0=rnd(ui,0u), r1=rnd(ui,1u), r2=rnd(ui,2u), r3=rnd(ui,3u);
  float ar=fract(vRing.x*44.0); bool aisle=ar<vRing.y;
  vec4 sampled;
  if(aisle){
    vec2 fa=vec2(clamp(ar/vRing.y,0.03,0.97),clamp(f.y,0.015,0.985));
    sampled=textureGrad(map,(vec2(6.0,7.0-7.0)+fa)/8.0,gx*0.16,gy*0.16);
  } else {
    float arms=0.0;
#ifdef FANCY
    float wp=fract(vRing.x*3.0-uTime*0.045); float wave=smoothstep(0.0,0.015,wp)*(1.0-smoothstep(0.05,0.09,wp));
    float fld=sin(id.x*0.09+uTime*0.37)+sin(id.y*0.17-uTime*0.29)+sin((id.x+id.y*1.7)*0.06+uTime*0.21);
    arms=max(wave,step(2.3,fld+(r2-0.5)*0.6));
#endif
    int sp;
    if(r0<0.035) sp=60+int(r1*2.0);
    else if(arms>0.5) sp=36+int(r1*12.0);
    else if(r0<0.11) sp=48+int(r1*8.0);
    else if(r0<0.15) sp=56+int(r1*4.0);
    else if(r0<0.155) sp=63;
    else sp=int(r1*36.0);
    vec2 fl=f;
#ifdef FANCY
    fl.x+=sin(uTime*(0.9+r2*0.6)+r2*40.0)*0.03;
#endif
    if(r2>0.5) fl.x=1.0-fl.x;
    fl=clamp(fl,0.015,0.985);
    vec2 a0=vec2(float(sp-(sp/8)*8),7.0-float(sp/8));
    sampled=textureGrad(map,(a0+fl)/8.0,gx*0.16,gy*0.16);
    float blk=rnd(uvec2(floor(id.x/28.0),floor(id.y/9.0)),5u);
    sampled.rgb*=(0.55+0.35*r3)*(0.78+0.34*blk);
#ifdef FANCY
    float tt=uTime*1.7+r2*137.0; uint ti=uint(floor(tt)); float kk=fract(tt);
    float fon=step(0.9965,rnd(ui,ti+31u));
    vec2 hp=(f-vec2(0.5,0.78))*vec2(0.55,0.85);
    float fl2=fon*exp(-kk*7.0)*smoothstep(0.17,0.0,length(hp))*(1.0-smoothstep(0.25,0.7,fw));
    sampled.rgb+=vec3(1.0,0.96,0.85)*fl2*5.0;
#endif
  }
  diffuseColor*=sampled;
}
#endif`);
  };
  m.customProgramCacheKey=()=>"mx-crowd"+(fancy?"F":"");
  return m;
}

/* a sprite glow: instanced camera-facing quads (soft light or starburst from the sheet), additive; per instance: position + size (the matrix), a tint (instance colour), the sprite and a
   twinkle. Tone mapping and the colour space are the frame's own (so the glow looks the same drawn directly or through a post chain). */
export function glowSprites(sheet,list,U){
  const geo=new THREE.PlaneGeometry(1,1), n=list.length, kind=new Float32Array(n), amp=new Float32Array(n), ph=new Float32Array(n);
  const mat=new THREE.ShaderMaterial({uniforms:{map:{value:sheet},uTime:U.uTime},transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,fog:false,
    vertexShader:`attribute float aKind; attribute float aAmp; attribute float aPh; varying vec2 vUv; varying vec3 vCol; varying float vK; varying float vI; uniform float uTime;
void main(){ vUv=uv; vK=aKind; vCol=instanceColor; vI=aAmp*(0.86+0.14*sin(uTime*(3.0+aPh*5.0)+aPh*40.0));
  vec4 c=modelViewMatrix*instanceMatrix*vec4(0.,0.,0.,1.); float s=length(instanceMatrix[0].xyz); c.xy+=position.xy*s; c.z+=min(s*0.35,2.0); gl_Position=projectionMatrix*c; }`,
    fragmentShader:`uniform sampler2D map; varying vec2 vUv; varying vec3 vCol; varying float vK; varying float vI;
void main(){ vec2 uv=vec2(vUv.x*0.5+0.5*vK,vUv.y); vec4 t=texture2D(map,uv); gl_FragColor=vec4(vCol*t.rgb*t.a*vI,t.a);
#include <tonemapping_fragment>
#include <colorspace_fragment>
}`});
  const m=new THREE.InstancedMesh(geo,mat,n), M=new THREE.Matrix4(), c=new THREE.Color();
  list.forEach((g,i)=>{ M.makeScale(g.s,g.s,g.s); M.setPosition(g.x,g.y,g.z); m.setMatrixAt(i,M); c.setRGB(g.r,g.g,g.b); m.setColorAt(i,c); kind[i]=g.k||0; amp[i]=g.a==null?1:g.a; ph[i]=g.p==null?(i*0.6180339)%1:g.p; });
  geo.setAttribute("aKind",new THREE.InstancedBufferAttribute(kind,1)); geo.setAttribute("aAmp",new THREE.InstancedBufferAttribute(amp,1)); geo.setAttribute("aPh",new THREE.InstancedBufferAttribute(ph,1));
  m.instanceMatrix.needsUpdate=true; if(m.instanceColor) m.instanceColor.needsUpdate=true; m.frustumCulled=false; m.renderOrder=5; return m;
}

/* the near rows: upright cut-out people standing on the slope (one card per seat, facing the floor): they overlap like a real crowd, bob, sway, cheer and flash; the lookup is
   the same hash idea as the slope's shader. Fog, tone mapping and the colour space are the frame's own. */
function crowdCards(ring,LV,pr,segs,U,atlasCut,shadeFn,pool){
  const slen=Math.hypot(pr[2]-pr[0],pr[3]-pr[1]), rows=Math.max(1,Math.round(slen/CROWD.row)), nA=44, aw=1.2*CROWD.seat, list=[], R=rngf(8821);
  for(let r=0;r<rows;r++){ const t=(r+0.5)/rows, d=pr[0]+(pr[2]-pr[0])*t, y=pr[1]+(pr[3]-pr[1])*t, L=LV(d), aisleW=aw*nA/L.len, sh=shadeFn(t); let i=0;
    for(let s=0.3;s<L.len-0.3;s+=CROWD.seat){ while(i<segs-1&&L.U[i+1]<s) i++; const f=(s-L.U[i])/((L.U[i+1]-L.U[i])||1), rf=(i+f)/segs; if(((rf*nA)%1)<aisleW) continue;
      const x=L.X[i]+(L.X[i+1]-L.X[i])*f, z=L.Z[i]+(L.Z[i+1]-L.Z[i])*f, p0=ring.pts[i], p1=ring.pts[(i+1)%segs]; let nx=p0.nx+(p1.nx-p0.nx)*f, nz=p0.nz+(p1.nz-p0.nz)*f; const nl=Math.hypot(nx,nz)||1; nx/=nl; nz/=nl;
      const jx=(R()-0.5)*0.12, jd=(R()-0.5)*0.14;
      list.push({x:x-nz*jx+nx*jd,y:y,z:z+nx*jx+nz*jd,th:Math.atan2(-nx,-nz),sh:sh*pool(rf),rf:rf,a:R(),b:R(),c:R()}); } }
  const n=list.length, geo=new THREE.PlaneGeometry(1,1); geo.translate(0,0.5,0);
  const uni=THREE.UniformsUtils.merge([THREE.UniformsLib.fog,{map:{value:atlasCut}}]); uni.uTime=U.uTime;
  const mat=new THREE.ShaderMaterial({uniforms:uni,fog:true,side:THREE.DoubleSide,
    vertexShader:`attribute vec4 aInst; varying vec2 vUv; varying vec3 vCol; varying float vY; uniform float uTime;
#include <fog_pars_vertex>
void main(){
  float s0=aInst.x, s1=aInst.y, s2=aInst.z; vec3 wp=instanceMatrix[3].xyz;
  float ph=fract(aInst.w*3.0-uTime*0.045); float wave=smoothstep(0.0,0.015,ph)*(1.0-smoothstep(0.05,0.09,ph));
  float fld=sin(wp.x*0.11+uTime*0.37)+sin(wp.z*0.13-uTime*0.29)+sin((wp.x+wp.z)*0.07+uTime*0.21);
  float arms=max(wave,step(2.3,fld+(s2-0.5)*0.6));
  int sp;
  if(arms>0.5) sp=36+int(s1*12.0); else if(s0<0.07) sp=48+int(s1*8.0); else if(s0<0.10) sp=56+int(s1*4.0); else sp=int(s1*36.0);
  vec2 a0=vec2(float(sp-(sp/8)*8),7.0-float(sp/8)); vec2 q=uv; if(s2>0.5) q.x=1.0-q.x; q=clamp(q,0.012,0.988);
  vUv=(a0+q)/8.0; vCol=instanceColor; vY=uv.y;
  float bob=arms*0.07*abs(sin(uTime*5.0+s1*40.0)); float sway=sin(uTime*(0.9+s2*0.6)+s2*40.0)*0.03;
  vec4 mvPosition=modelViewMatrix*instanceMatrix*vec4(position.x+sway,position.y+bob,position.z,1.0);
  gl_Position=projectionMatrix*mvPosition;
#include <fog_vertex>
}`,
    fragmentShader:`uniform sampler2D map; varying vec2 vUv; varying vec3 vCol; varying float vY;
#include <fog_pars_fragment>
void main(){ vec4 t=texture2D(map,vUv); if(t.a<0.45) discard; gl_FragColor=vec4(t.rgb*vCol*(0.7*mix(0.45,1.0,smoothstep(0.0,0.5,vY))),1.0);
#include <tonemapping_fragment>
#include <colorspace_fragment>
#include <fog_fragment>
}`});
  const m=new THREE.InstancedMesh(geo,mat,n), M=new THREE.Matrix4(), Q=new THREE.Quaternion(), P=new THREE.Vector3(), S=new THREE.Vector3(0.62,0.95,1), Y=new THREE.Vector3(0,1,0), c=new THREE.Color(), inst=new Float32Array(n*4);
  list.forEach((g,i)=>{ Q.setFromAxisAngle(Y,g.th); P.set(g.x,g.y,g.z); M.compose(P,Q,S); m.setMatrixAt(i,M); const k=g.sh; c.setRGB(k,k*0.97,k*0.93); m.setColorAt(i,c); inst[i*4]=g.a; inst[i*4+1]=g.b; inst[i*4+2]=g.c; inst[i*4+3]=g.rf; });
  geo.setAttribute("aInst",new THREE.InstancedBufferAttribute(inst,4)); m.instanceMatrix.needsUpdate=true; if(m.instanceColor) m.instanceColor.needsUpdate=true; m.frustumCulled=false; return m;
}

export function stadium(C,look,q,root,ctx){
  const lo=!!q.lo, F=C.layout.floor||[-66,66,-48,32], x0=F[0], x1=F[1], z0=F[2], z1=F[3], cx=(x0+x1)/2, cz=(z0+z1)/2, W=x1-x0, D=z1-z0;
  const dome=look.around==="stadium-dome", fancy=q.fancy!=null?!!q.fancy:!lo, hazeOn=q.haze!=null?!!q.haze:!lo, segs=q.segs||(lo?72:128), nTow=q.towers||(lo?6:10);
  const U={uTime:{value:0}}, R=rngf(4151);
  /* the dirt floor */
  const fm=dirtMaps(look.soil,lo,true); fm.map.repeat.set(W/7,D/7); fm.normal.repeat.set(W/7,D/7);
  const Sx=SOIL[look.soil]||SOIL["stadium-dirt"], fc=mixc(lin(Sx[0]),lin(Sx[2]),0.6);
  const floor=new THREE.Mesh(new THREE.PlaneGeometry(W+4,D+4),new THREE.MeshLambertMaterial({map:fm.map,normalMap:fm.normal,normalScale:new THREE.Vector2(0.8,0.8),color:new THREE.Color().setRGB(fc[0]*0.86,fc[1]*0.86,fc[2]*0.86)}));
  floor.rotation.x=-Math.PI/2; floor.position.set(cx,-0.16,cz); floor.receiveShadow=true; root.add(floor);   /* under the deepest rut of the track, so it never shows through the dirt */
  /* the footprint and the profile of the bowl: [distance out, height, distance out, height] */
  const ring=makeRing(cx,cz,W/2+1.5,D/2+1.5,6,segs), LV=levelFn(ring);
  const PR={apron:[-0.05,1.4,1.0,2.5],low1:[1.0,2.5,14.0,9.5],aisle:[14.0,9.5,15.6,9.5],rail:[15.6,9.5,15.6,10.4],low2:[15.6,10.4,30.0,18.0],conc:[30.0,18.0,31.0,18.0],
    rib1:[31.0,18.0,31.0,19.5],suite:[31.0,19.5,31.0,23.5],trim:[31.0,23.5,31.0,24.0],under:[31.0,24.0,36.0,25.5],up:[36.0,25.5,64.0,44.0],rim:[64.0,44.0,64.0,47.0],cap:[64.0,47.0,64.0,48.5],
    roof:[64.0,48.5,61.0,49.7],back:[64.0,44.0,72.0,0.0]};
  /* ---- the crowd: three lofted strips of seats ---- */
  const MC=Mesher(), shadeAt=(r)=>1+0.10*Math.sin(r*Math.PI*2*5+0.7)+0.06*Math.sin(r*Math.PI*2*11)+0.04*Math.sin(r*Math.PI*2*23);
  const crowdBand=(pr,sub,shadeFn,uoff,voff)=>{ const slen=Math.hypot(pr[2]-pr[0],pr[3]-pr[1]), rows=Math.max(1,Math.round(slen/CROWD.row)), nA=44;
    loft(MC,LV,segs,pr,sub,(t,r,Uu,o)=>{ const s=shadeFn(t)*shadeAt(r); o.u=Uu/CROWD.seat+uoff; o.v=t*rows+voff; o.r=s; o.g=s*0.97; o.b=s*0.93; o.ar=1.2*CROWD.seat*nA/LV(pr[0]+(pr[2]-pr[0])*t).len; }); };
  crowdBand(PR.low1,6,t=>1.0-0.12*t,37.1,11.0);
  crowdBand(PR.low2,6,t=>0.92-0.44*Math.pow(t,1.25),521.3,63.0);
  crowdBand(PR.up,8,t=>0.46+0.36*t,1042.7,121.0);
  const atlas=crowdAtlas(lo), cm=crowdMaterial(atlas,U,fancy);
  const bowl=new THREE.Mesh(MC.geo(),cm); bowl.frustumCulled=false; root.add(bowl);
  const nCards=q.cards!=null?q.cards:(lo?0:1);
  if(nCards>0){ const cut=crowdAtlas(false,true), pl=r=>shadeAt(r); const c1=crowdCards(ring,LV,PR.low1,segs,U,cut,t=>1.0-0.12*t,pl); root.add(c1);
    if(nCards>1) root.add(crowdCards(ring,LV,PR.low2,segs,U,cut,t=>0.92-0.44*Math.pow(t,1.25),pl)); }
  /* ---- the structure: dark concrete, rails, the concourse, the cantilever, the roof edge, the back (vertex colours, unlit) ---- */
  const MS=Mesher(), flat=(rgb)=>(t,r,Uu,o)=>{ o.r=rgb[0]; o.g=rgb[1]; o.b=rgb[2]; };
  const conc=lin("#1d1c24"), concL=lin("#34333c"), dark=lin("#0b0b11"), navy=lin("#141b38"), steel=lin("#2a2c36");
  loft(MS,LV,segs,PR.apron,1,flat(lin("#16151c")));
  loft(MS,LV,segs,PR.aisle,1,flat(concL)); loft(MS,LV,segs,PR.rail,1,flat(conc));
  loft(MS,LV,segs,PR.conc,1,flat(concL)); loft(MS,LV,segs,PR.trim,1,flat(conc)); loft(MS,LV,segs,PR.under,1,flat(dark));
  loft(MS,LV,segs,PR.roof,1,flat(dark)); loft(MS,LV,segs,PR.back,1,flat(dark)); loft(MS,LV,segs,PR.cap,1,flat(steel));
  root.add(new THREE.Mesh(MS.geo(),new THREE.MeshBasicMaterial({vertexColors:true,side:THREE.DoubleSide})));
  /* the glowing accents: LED strips under the first row, along the cross aisle rail and the concourse edge, the roof edge */
  const MA=Mesher(), glowStrip=(pr,rgb)=>loft(MA,LV,segs,pr,1,flat(rgb));
  glowStrip([0.35,1.785,0.455,1.95],[2.6,0.35,0.25]); glowStrip([15.55,10.25,15.55,10.4],[1.8,1.4,0.9]); glowStrip([30.0,18.0,30.0,18.12],[2.2,1.7,0.9]); glowStrip([61.0,49.55,61.0,49.7],[2.2,2.0,1.6]); glowStrip([64.05,48.2,64.05,48.5],[2.6,0.4,0.3]);
  const accent=new THREE.Mesh(MA.geo(),new THREE.MeshBasicMaterial({vertexColors:true,side:THREE.DoubleSide,fog:false})); root.add(accent);
  /* ---- the LED ribbons (the lower on the concourse, the upper on the rim) and the suites' windows ---- */
  const rt=ribbonTex(lo), MR=Mesher();
  [PR.rib1,PR.rim].forEach(pr=>{ const rep16=(pr[3]-pr[1])*16, nr=Math.max(1,Math.round(LV(pr[0]).len/rep16)); loft(MR,LV,segs,pr,1,(t,r,Uu,o)=>{ o.u=Uu/(LV(pr[0]).len/nr); o.v=t; o.r=1.5; o.g=1.5; o.b=1.5; }); });
  const ribbons=new THREE.Mesh(MR.geo(),new THREE.MeshBasicMaterial({map:rt,vertexColors:true,side:THREE.DoubleSide,toneMapped:true})); root.add(ribbons);
  const st=suitesTex(lo), MW=Mesher(); st.wrapS=THREE.RepeatWrapping; st.wrapT=THREE.ClampToEdgeWrapping;
  loft(MW,LV,segs,PR.suite,1,(t,r,Uu,o)=>{ o.u=Uu/16; o.v=t; o.r=1.25; o.g=1.2; o.b=1.1; });
  root.add(new THREE.Mesh(MW.geo(),new THREE.MeshBasicMaterial({map:st,vertexColors:true,side:THREE.DoubleSide})));
  /* ---- the wall round the floor: ad boards 1.1 m, a padded cap; it follows the footprint 0.55 m inside it ---- */
  const bt=boardsTex(lo), MB=Mesher(), L0=LV(-0.55), MK=Mesher();
  const wallBand=(Mx,pr,fn)=>loft(Mx,LV,segs,pr,1,fn);
  wallBand(MB,[-0.55,0.0,-0.55,1.1],(t,r,Uu,o)=>{ o.u=Uu/23.5; o.v=t; o.r=1.3; o.g=1.3; o.b=1.3; });
  wallBand(MK,[-0.55,1.1,-0.55,1.16],flat(lin("#f0f1f3"))); wallBand(MK,[-0.55,1.16,-0.55,1.4],flat(navy)); wallBand(MK,[-0.55,1.4,-0.05,1.4],flat(lin("#202a52")));
  root.add(new THREE.Mesh(MK.geo(),new THREE.MeshBasicMaterial({vertexColors:true,side:THREE.DoubleSide})));
  root.add(new THREE.Mesh(MB.geo(),new THREE.MeshBasicMaterial({map:bt,vertexColors:true,side:THREE.DoubleSide})));
  /* ---- light towers on the rim: a mast, a bank of floodlights facing the floor, a catwalk; the bulbs are emissive discs, every one has a glow, every bank a halo and a starburst ---- */
  const parts=[], bulbs=[], glows=[], dummy=new THREE.Object3D(), tgt=new THREE.Vector3(cx,2,cz), bcols=lo?4:6, brows=lo?3:4, sp=lo?2.6:2.2;
  const steelC=lin("#1a1c24"), plate=lin("#0c0d12");
  const addBulb=(M,s)=>{ const p=new THREE.Vector3().setFromMatrixPosition(M); bulbs.push(M.clone()); glows.push({x:p.x,y:p.y,z:p.z,s:s,r:1.0,g:0.93,b:0.78,k:0,a:0.55}); };
  for(let k=0;k<nTow;k++){
    const idx=Math.floor(((k+0.5)/nTow+0.037)*segs)%segs, p=ring.pts[idx], baseD=PR.rim[0]+1.8, hM=13+(k%3)*2.5;
    const bx=p.x+p.nx*baseD, bz=p.z+p.nz*baseD, by=PR.cap[3], top=by+hM;
    dummy.position.set(bx-p.nx*1.6,top,bz-p.nz*1.6); dummy.lookAt(tgt.x,tgt.y,tgt.z); dummy.updateMatrix(); const Mb=dummy.matrix.clone();
    const bw=(bcols-1)*sp+2.2, bh=(brows-1)*sp+2.2;
    const box=xf(paint(new THREE.BoxGeometry(bw,bh,0.7),plate),0,0,0); box.applyMatrix4(Mb); parts.push(box);
    const frm=xf(paint(new THREE.BoxGeometry(bw+0.5,bh+0.5,0.5),steelC),0,0,-0.2); frm.applyMatrix4(Mb); parts.push(frm);
    for(const s of [-1,1]){ const m=xf(paint(new THREE.CylinderGeometry(0.34,0.5,hM+0.6,6),steelC),bx+s*p.nz*2.4,by+(hM+0.6)/2-0.3,bz-s*p.nx*2.4); parts.push(m); }
    const cat=xf(paint(new THREE.BoxGeometry(bw+1.5,0.35,2.2),steelC),0,-bh/2-0.6,-0.9); cat.applyMatrix4(Mb); parts.push(cat);
    for(let j=0;j<brows;j++) for(let i=0;i<bcols;i++){ const lm=new THREE.Matrix4().makeTranslation((i-(bcols-1)/2)*sp,(j-(brows-1)/2)*sp,0.37); addBulb(Mb.clone().multiply(lm),lo?3.4:2.9); }
    const c0=new THREE.Vector3(0,0,1.0).applyMatrix4(Mb);
    glows.push({x:c0.x,y:c0.y,z:c0.z,s:bw*2.2,r:1.0,g:0.85,b:0.6,k:0,a:0.26}); glows.push({x:c0.x,y:c0.y,z:c0.z,s:bw*4.4,r:1.0,g:0.9,b:0.7,k:1,a:0.8});
  }
  /* the roof edge: a row of small lights along the rim */
  const nRim=lo?32:64;
  for(let k=0;k<nRim;k++){ const p=ring.pts[Math.floor(k/nRim*segs)%segs]; dummy.position.set(p.x+p.nx*(PR.rim[0]-0.2),PR.rim[3]+0.55,p.z+p.nz*(PR.rim[0]-0.2)); dummy.lookAt(cx,PR.rim[3]-8,cz); dummy.updateMatrix(); addBulb(dummy.matrix.clone(),2.0); bulbs[bulbs.length-1].rimLight=true; }
  root.add(new THREE.Mesh(merge(parts),new THREE.MeshBasicMaterial({vertexColors:true})));
  const bg=new THREE.CircleGeometry(0.8,12), bm=new THREE.MeshBasicMaterial({fog:false}); bm.color.setRGB(4.2,4.0,3.5);
  const bI=new THREE.InstancedMesh(bg,bm,bulbs.length); bulbs.forEach((M,i)=>{ if(M.rimLight){ const s=0.6; M.scale(new THREE.Vector3(s,s,s)); } bI.setMatrixAt(i,M); }); bI.instanceMatrix.needsUpdate=true; bI.frustumCulled=false; root.add(bI);
  const sheet=glowSheet(), gm=glowSprites(sheet,glows,U); root.add(gm); ctx.glowMesh=gm;
  /* ---- the roof of a dome ---- */
  if(dome){ const rr=Math.max(W,D)/2+80, roof=new THREE.Mesh(new THREE.SphereGeometry(rr,24,10,0,Math.PI*2,0,Math.PI*0.32),new THREE.MeshLambertMaterial({color:0x1a1a22,side:THREE.BackSide})); roof.scale.set(1,0.35,(D/2+80)/rr); roof.position.set(cx,20,cz); root.add(roof); }
  /* ---- haze: a soft cone of light from every bank toward the floor (a stadium night under the lights) ---- */
  if(hazeOn&&!dome){
    const g=new THREE.CylinderGeometry(0.9,9,1,16,1,true); g.translate(0,-0.5,0);
    const mat=new THREE.ShaderMaterial({transparent:true,depthWrite:false,side:THREE.DoubleSide,blending:THREE.AdditiveBlending,fog:false,uniforms:{col:{value:new THREE.Color(0xfff0d0)}},
      vertexShader:"varying float vF; varying float vE; void main(){ vF=1.0+position.y; vec4 mv=modelViewMatrix*instanceMatrix*vec4(position,1.0); vec3 n=normalize(mat3(modelViewMatrix*instanceMatrix)*normal); vE=abs(dot(n,normalize(-mv.xyz))); gl_Position=projectionMatrix*mv; }",
      fragmentShader:"uniform vec3 col; varying float vF; varying float vE; void main(){ float a=0.06*pow(vF,1.5)*pow(vE,1.3); gl_FragColor=vec4(col*a,a);\n#include <tonemapping_fragment>\n#include <colorspace_fragment>\n}"});
    const n=Math.min(nTow,8), m=new THREE.InstancedMesh(g,mat,n), M=new THREE.Matrix4(), Q=new THREE.Quaternion(), up=new THREE.Vector3(0,-1,0), d=new THREE.Vector3(), pos=new THREE.Vector3(), sc=new THREE.Vector3();
    for(let i=0;i<n;i++){ const p=ring.pts[Math.floor(((i+0.5)/n+0.037)*segs)%segs]; pos.set(p.x+p.nx*(PR.rim[0]-1),PR.cap[3]+14,p.z+p.nz*(PR.rim[0]-1));
      const tx=cx+(((i*37)%11)/11-0.5)*W*0.6, tz=cz+(((i*53)%7)/7-0.5)*D*0.5; d.set(tx-pos.x,0.2-pos.y,tz-pos.z); const len=d.length(); d.normalize(); Q.setFromUnitVectors(up,d); sc.set(1,len,1); M.compose(pos,Q,sc); m.setMatrixAt(i,M); }
    m.instanceMatrix.needsUpdate=true; m.frustumCulled=false; m.renderOrder=6; root.add(m);
  }
  /* ---- the big video boards: the east and west ends and the far side, original graphics, plain text ---- */
  const bc=canvas(512,256), bx=bc.getContext("2d"), bt2=tex(bc,false), board={lap:0,len:0,num:null,T:null,sec:-1,dirty:true};
  const MBd=Mesher(), parts2=[], bw2=26, bh2=11.2;
  [0,Math.floor(segs/2),Math.floor(segs*0.75)].forEach((i,bi)=>{ const p=ring.pts[i], dd=46, qx=p.x+p.nx*dd, qz=p.z+p.nz*dd, yc=40.5, tx=-p.nz, tz=p.nx;
    const a=[qx-tx*bw2/2,yc-bh2/2,qz-tz*bw2/2], b=[qx+tx*bw2/2,yc-bh2/2,qz+tz*bw2/2], c=[qx-tx*bw2/2,yc+bh2/2,qz-tz*bw2/2], d2=[qx+tx*bw2/2,yc+bh2/2,qz+tz*bw2/2];
    const v0=MBd.vert(a[0],a[1],a[2],0,0,1.7,1.7,1.7), v1=MBd.vert(b[0],b[1],b[2],1,0,1.7,1.7,1.7), v2=MBd.vert(c[0],c[1],c[2],0,1,1.7,1.7,1.7), v3=MBd.vert(d2[0],d2[1],d2[2],1,1,1.7,1.7,1.7); MBd.quad(v0,v1,v2,v3);
    const fr=xf(paint(new THREE.BoxGeometry(bw2+1.4,bh2+1.4,0.9),steel),0,0,0); const Mf=new THREE.Matrix4().makeBasis(new THREE.Vector3(tx,0,tz),new THREE.Vector3(0,1,0),new THREE.Vector3(-p.nx,0,-p.nz)); Mf.setPosition(qx+p.nx*0.65,yc,qz+p.nz*0.65); fr.applyMatrix4(Mf); parts2.push(fr);
    for(const s of [-1,1]){ const post=xf(paint(new THREE.BoxGeometry(0.8,8,0.8),steel),qx+tx*s*(bw2/2-1.2)+p.nx*0.6,yc-bh2/2-3.2,qz+tz*s*(bw2/2-1.2)+p.nz*0.6); parts2.push(post); }
  });
  const scr=new THREE.Mesh(MBd.geo(),new THREE.MeshBasicMaterial({map:bt2,vertexColors:true,side:THREE.DoubleSide,fog:false})); root.add(scr);
  root.add(new THREE.Mesh(merge(parts2),new THREE.MeshBasicMaterial({vertexColors:true})));
  const redraw=()=>{ drawBoard(bx,512,256,board); bt2.needsUpdate=true; board.dirty=false; };
  ctx.screen=function(lap,len,num){ board.lap=lap|0; board.len=len|0; if(num!=null) board.num=num; if(!lap) board.T=null; board.dirty=true; redraw(); };
  ctx.screen(0,0,null);
  /* the night sky and the haze of a big night */
  ctx.sky(0x04060e,0x0d1330,0x1c2038);
  ctx.fog(0x141a2e,140,600);
  /* per frame: the clock of the shaders, the ribbon's scroll, the board's clock */
  function frame(dt,tw,cam,T,lap,len,num){
    U.uTime.value=tw%3600; rt.offset.x=(tw*0.011)%1;
    if(len!=null){ let ch=false; if(len!==board.len){ board.len=len|0; ch=true; } if(lap!=null&&lap!==board.lap){ board.lap=lap|0; ch=true; } if(num!=null&&num!==board.num){ board.num=num; ch=true; }
      if(T!=null&&lap>0){ const s=Math.floor(T); if(s!==board.sec){ board.sec=s; board.T=T; ch=true; } } else if(board.T!=null&&!(lap>0)){ board.T=null; ch=true; }
      if(ch) redraw(); }
  }
  return {cx:cx,cz:cz,frame:frame,board:board};
}
