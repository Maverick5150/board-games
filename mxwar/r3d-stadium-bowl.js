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
import {lin,mixc,clamp,sstep,canvas,tex,rngf,merge,paint,xf,clear} from "./r3d-util.js";
import {SOIL,dirtMaps} from "./r3d-track.js";
import {CROWD,crowdAtlas,boardsTex,ribbonTex,suitesTex,drawBoard,glowSheet,BRAND,PROPS,propsUV,propsTex} from "./r3d-stadium-art.js";

const sgn=v=>v<0?-1:1;
/* Reduce effects or reduced motion (the page's own attributes, as game.js sets them): the world stays still */
function stillWorld(){ try{ const d=document.documentElement; return d.getAttribute("data-effects")==="reduced"||d.getAttribute("data-motion")==="reduce"; }catch(e){ return false; } }
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

/* the night crowd's tops (linear RGB): every seat's shirt is recoloured from this palette by a hash (the atlas draws shirts grey and marks them in alpha:
   r3d-stadium-art.js SHIRT_GREY). PAL_MEAN is its weighted mean (the far crowd's colour). Shared by the slope, the near cards and the near people. */
const PAL_GLSL=`
vec3 shirtCol(float h,float k){
  vec3 c=vec3(0.014,0.014,0.018)+vec3(0.026)*k;                 /* 30% black and charcoal */
  if(h>0.30) c=vec3(0.018,0.026,0.075)*(0.8+0.4*k);             /* navy */
  if(h>0.40) c=vec3(0.50,0.50,0.52)*(0.62+0.38*k);              /* white, light grey */
  if(h>0.52) c=vec3(0.10,0.10,0.11)*(0.8+0.4*k);                /* mid grey */
  if(h>0.58) c=vec3(0.62,0.025,0.03)*(0.55+0.45*k);             /* the war red: the crowd's colour */
  if(h>0.72) c=vec3(0.03,0.07,0.26);                            /* royal blue, muted */
  if(h>0.78) c=vec3(0.45,0.30,0.03);                            /* gold */
  if(h>0.82) c=vec3(0.03,0.12,0.04);                            /* dark green */
  if(h>0.86) c=vec3(0.45,0.12,0.02);                            /* orange */
  if(h>0.89) c=vec3(0.18,0.02,0.03);                            /* maroon */
  if(h>0.92) c=vec3(0.30,0.22,0.12);                            /* tan */
  if(h>0.95) c=vec3(0.02,0.12,0.12);                            /* teal */
  if(h>0.975) c=k>0.5?vec3(0.35,0.55,0.03):vec3(0.16,0.04,0.26); /* a rare bright pop */
  return c;
}
const vec3 PAL_MEAN=vec3(0.195,0.119,0.103);
uint pcg(uint v){ uint s=v*747796405u+2891336453u; uint w=((s>>((s>>28u)+4u))^s)*277803737u; return (w>>22u)^w; }
float rnd(uvec2 p,uint k){ return float(pcg(p.x*1973u+p.y*9277u+k*26699u+1u))*(1.0/4294967295.0); }`;
/* three.js' fog, weaker on the crowd (uFogK): the stadium air is lit by the floodlights, the far stands must not sink into the night (milestone 2: the upper decks read dark) */
const FOG_K=`#ifdef USE_FOG
	#ifdef FOG_EXP2
		float fogFactor = 1.0 - exp( - fogDensity * fogDensity * vFogDepth * vFogDepth );
	#else
		float fogFactor = smoothstep( fogNear, fogFar, vFogDepth );
	#endif
	gl_FragColor.rgb = mix( gl_FragColor.rgb, fogColor, fogFactor*uFogK );
#endif`;
/* the crowd: every seat is one person from the atlas, picked by a hash of its place: no repeating wallpaper. Basic material (the floodlights are
   baked into the vertex colour per row and per place round the bowl: warm pools by the light banks, a cool night level, the floor's bounce), the person lookup
   replaces the map fragment. Milestone 2: every shirt recoloured per seat from the palette; poses on every tier (5.5% arms up, 6% standing, 6.5% filming);
   a LOW-PASS by distance (a seat under a pixel shows the crowd's mean colour per section, no per-seat noise: the far decks no longer crawl); the wave and a slow
   section shimmer reach the far decks; camera flashes in coarser cells far away (still at least a pixel). FANCY: cheering groups, the wave's arms, sway. */
function crowdMaterial(atlas,U,fancy,animNow,twink){
  const m=new THREE.MeshBasicMaterial({map:atlas,vertexColors:true,side:THREE.DoubleSide});
  m.defines=fancy?{FANCY:1}:twink?{TWINK:1}:{};   /* TWINK (the tiers without crowd animation: FIRE TV, BALANCED): only the phone flashes, a hash a pixel, no wave or sway */
  m.onBeforeCompile=sh=>{
    sh.uniforms.uTime=U.uTime; sh.uniforms.uGain=U.uGain; sh.uniforms.uFogK=U.uFogK; sh.uniforms.uNear=U.uNear; sh.uniforms.uLp=U.uLp;
    sh.vertexShader=sh.vertexShader.replace("#include <common>","#include <common>\nattribute vec2 aRing; varying vec2 vRing;").replace("#include <begin_vertex>","#include <begin_vertex>\n vRing=aRing;");
    sh.fragmentShader=sh.fragmentShader.replace("#include <common>","#include <common>\nvarying vec2 vRing; uniform float uTime; uniform float uGain; uniform float uFogK; uniform vec2 uNear; uniform vec2 uLp;\n"+PAL_GLSL)
    .replace("#include <fog_fragment>",FOG_K)
    .replace("#include <map_fragment>",`
#ifdef USE_MAP
{
  vec2 cu=vMapUv; vec2 gx=dFdx(cu), gy=dFdy(cu); float fw=max(length(gx),length(gy)), fwy=max(abs(gx.y),abs(gy.y));
  vec2 id=floor(cu); vec2 f=cu-id; uvec2 ui=uvec2(id);
  float r0=rnd(ui,0u), r1=rnd(ui,1u), r2=rnd(ui,2u), r3=rnd(ui,3u), r4=rnd(ui,4u);
  float ar=fract(vRing.x*44.0); bool aisle=ar<vRing.y;
  float blk=rnd(uvec2(floor(id.x/28.0),floor(id.y/9.0)),5u), sec=0.84+0.32*blk;
  /* milestone 2: three regimes by the size of a seat on the screen (fw = seats a pixel): the person's sprite (a seat over 3 px); the SEAT'S OWN colour (its shirt, a pixel or two:
     a fine, stable speckle in rows, heads lit above the shadowed riser); the BLOCK'S mean (several seats a pixel: no crawl). (The first try faded straight to the atlas' mean: a flat grey, an empty stand.) */
  float l1=smoothstep(0.35,0.9,fw), l2=smoothstep(uLp.x,uLp.y,fw);
  float rowK=mix(mix(1.3,0.5,smoothstep(0.45,0.9,f.y)),1.0,smoothstep(0.35,0.8,fwy));
  vec3 blockC=(vec3(0.035)+0.30*PAL_MEAN)*sec;
  float wave=0.0;
#ifdef FANCY
  float wp=fract(vRing.x*3.0-uTime*0.045); wave=smoothstep(0.0,0.015,wp)*(1.0-smoothstep(0.05,0.09,wp));
  blockC*=1.0+0.05*sin(uTime*0.6+blk*40.0)+0.45*wave;
#endif
  bool under=id.y>=uNear.x&&id.y<uNear.y;   /* a row where the 3D people stand: its own seats show empty under them */
  vec3 col;
  if(aisle){
    vec2 fa=vec2(clamp(ar/vRing.y,0.03,0.97),clamp(f.y,0.015,0.985));
    vec4 sa=textureGrad(map,(vec2(6.0,0.0)+fa)/8.0,gx*0.16,gy*0.16);
    col=mix(mix(sa.rgb,vec3(0.05,0.048,0.055),l1),blockC*0.7,l2);
  } else {
    float arms=0.0;
#ifdef FANCY
    float fld=sin(id.x*0.09+uTime*0.37)+sin(id.y*0.17-uTime*0.29)+sin((id.x+id.y*1.7)*0.06+uTime*0.21);
    arms=max(wave,step(2.3,fld+(r2-0.5)*0.6));
#endif
    bool empty=under||r0<0.035;
    int sp;
    if(empty) sp=60+int(r1*2.0);
    else if(arms>0.5||r0>0.945) sp=36+int(r1*12.0);
    else if(r0<0.10) sp=48+int(r1*8.0);
    else if(r0<0.16) sp=56+int(r1*4.0);
    else if(r0<0.165) sp=63;
    else sp=int(r1*36.0);
    vec2 fl=f;
#ifdef FANCY
    fl.x+=sin(uTime*(0.9+r2*0.6)+r2*40.0)*0.03;
#endif
    if(r2>0.5) fl.x=1.0-fl.x;
    fl=clamp(fl,0.015,0.985);
    vec2 a0=vec2(float(sp-(sp/8)*8),7.0-float(sp/8));
    vec4 s=textureGrad(map,(a0+fl)/8.0,gx*0.16,gy*0.16);
    float mk=clamp((1.0-s.a)*2.0,0.0,1.0), shd=(0.78+0.3*r3)*sec;
    s.rgb=mix(s.rgb,s.rgb*shirtCol(r4,r3)*2.09,mk)*shd;
    vec3 seatC=(empty?vec3(0.03):vec3(0.035)+0.30*shirtCol(r4,r3))*shd*rowK;
    col=mix(mix(s.rgb,seatC,l1),blockC,l2);
#if defined(FANCY)||defined(TWINK)
    if(!under){
      float g=fw>0.6?3.0:1.0; vec2 c2=cu/vec2(g,g*0.66); vec2 i2=floor(c2); vec2 f2=c2-i2; uvec2 u2=uvec2(i2);
      float tt=uTime*1.7+rnd(u2,2u)*137.0; uint ti=uint(floor(tt)); float kk=fract(tt);
      float fon=step(0.991,rnd(u2,ti+31u));   /* about 0.9% of the cells: dozens of phone flashes in a wide frame (the QD: more pops) */
      float spot=1.0-smoothstep(0.0,0.3,length((f2-vec2(0.5,0.72))*vec2(0.6,0.9)));
      col+=vec3(1.0,0.96,0.88)*fon*exp(-kk*5.0)*spot*7.0;
    }
#endif
  }
  diffuseColor.rgb*=col*uGain;
}
#endif`);
  };
  m.customProgramCacheKey=()=>"mx-crowd2"+(m.defines&&m.defines.FANCY?"F":m.defines&&m.defines.TWINK?"T":"");
  return m;
}

/* a sprite glow: instanced camera-facing quads (soft light or starburst from the sheet), additive; per instance: position + size (the matrix), a tint (instance colour), the sprite and a
   twinkle. Tone mapping and the colour space are the frame's own (so the glow looks the same drawn directly or through a post chain). */
export function glowSprites(sheet,list,U){
  const geo=new THREE.PlaneGeometry(1,1), n=list.length, kind=new Float32Array(n), amp=new Float32Array(n), ph=new Float32Array(n);
  const mat=new THREE.ShaderMaterial({uniforms:{map:{value:sheet},uTime:U.uTime,uHdr:{value:1}},transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,fog:false,
    vertexShader:`attribute float aKind; attribute float aAmp; attribute float aPh; varying vec2 vUv; varying vec3 vCol; varying float vK; varying float vI; uniform float uTime;
void main(){ vUv=uv; vK=aKind; vCol=instanceColor; vI=aAmp*(0.86+0.14*sin(uTime*(3.0+aPh*5.0)+aPh*40.0));
  vec4 c=modelViewMatrix*instanceMatrix*vec4(0.,0.,0.,1.); float s=length(instanceMatrix[0].xyz); c.xy+=position.xy*s; c.z+=min(s*0.35,2.0); gl_Position=projectionMatrix*c; }`,
    fragmentShader:`uniform sampler2D map; uniform float uHdr; varying vec2 vUv; varying vec3 vCol; varying float vK; varying float vI;
void main(){ vec2 uv=vec2(vUv.x*0.5+0.5*vK,vUv.y); vec4 t=texture2D(map,uv); gl_FragColor=vec4(vCol*t.rgb*t.a*vI*1.5*uHdr,t.a);   /* uHdr: 1 = the plain frame, 2.5 = the HDR chain is on (r3d-look.js sets it): the glows rise above the bloom threshold */
#include <tonemapping_fragment>
#include <colorspace_fragment>
}`});
  const m=new THREE.InstancedMesh(geo,mat,n), M=new THREE.Matrix4(), c=new THREE.Color();
  list.forEach((g,i)=>{ M.makeScale(g.s,g.s,g.s); M.setPosition(g.x,g.y,g.z); m.setMatrixAt(i,M); c.setRGB(g.r,g.g,g.b); m.setColorAt(i,c); kind[i]=g.k||0; amp[i]=g.a==null?1:g.a; ph[i]=g.p==null?(i*0.6180339)%1:g.p; });
  geo.setAttribute("aKind",new THREE.InstancedBufferAttribute(kind,1)); geo.setAttribute("aAmp",new THREE.InstancedBufferAttribute(amp,1)); geo.setAttribute("aPh",new THREE.InstancedBufferAttribute(ph,1));
  mat.userData.hdr=true; m.instanceMatrix.needsUpdate=true; if(m.instanceColor) m.instanceColor.needsUpdate=true; m.frustumCulled=false; m.renderOrder=5; return m;   /* userData.hdr: already written for the HDR chain (the lead's L.apply leaves it alone) */
}

/* the near rows: upright cut-out people standing on the slope (one card per seat, facing the floor): they overlap like a real crowd, bob, sway, cheer and flash; the lookup is
   the same hash idea as the slope's shader. Fog, tone mapping and the colour space are the frame's own. */
function crowdCards(ring,LV,pr,segs,U,atlasCut,lightFn,band,skipRows,maxRows){
  const slen=Math.hypot(pr[2]-pr[0],pr[3]-pr[1]), rows=Math.max(1,Math.round(slen/CROWD.row)), nA=44, aw=1.2*CROWD.seat, list=[], R=rngf(8821);
  for(let r=0;r<rows;r++){ const t=(r+0.5)/rows, d=pr[0]+(pr[2]-pr[0])*t, y=pr[1]+(pr[3]-pr[1])*t, L=LV(d), aisleW=aw*nA/L.len; let i=0;
    for(let s=0.3;s<L.len-0.3;s+=CROWD.seat){ while(i<segs-1&&L.U[i+1]<s) i++; const f=(s-L.U[i])/((L.U[i+1]-L.U[i])||1), rf=(i+f)/segs; if(((rf*nA)%1)<aisleW) continue;
      const x=L.X[i]+(L.X[i+1]-L.X[i])*f, z=L.Z[i]+(L.Z[i+1]-L.Z[i])*f, p0=ring.pts[i], p1=ring.pts[(i+1)%segs]; let nx=p0.nx+(p1.nx-p0.nx)*f, nz=p0.nz+(p1.nz-p0.nz)*f; const nl=Math.hypot(nx,nz)||1; nx/=nl; nz/=nl;
      const jx=(R()-0.5)*0.12, jd=(R()-0.5)*0.14, a=R(), b=R(), c=R();
      if(r<(skipRows||0)) continue;   /* (the first rows are the near people: nearPeople) */
      if(maxRows&&r>=maxRows) continue;   /* (FIRE TV: only the first rows stand up as cards) */
      list.push({x:x-nz*jx+nx*jd,y:y,z:z+nx*jx+nz*jd,th:Math.atan2(-nx,-nz),L:lightFn(band,t,rf,L.len),rf:rf,a:a,b:b,c:c}); } }
  const n=list.length, geo=new THREE.PlaneGeometry(1,1); geo.translate(0,0.5,0);
  const uni=THREE.UniformsUtils.merge([THREE.UniformsLib.fog,{map:{value:atlasCut}}]); uni.uTime=U.uTime; uni.uGain=U.uGainC||U.uGain; uni.uFogK=U.uFogK;
  /* milestone 2: the shirt recoloured per person (the atlas' alpha: 0 empty, 0.62 shirt, 1 the rest), poses on every tier, the light of the place (instance colour =
     the baked floodlight level), and the cards sink into the slope beyond 60-115 m (each is then a pixel or two: the slope's own low-passed crowd takes over, no noise) */
  const mat=new THREE.ShaderMaterial({uniforms:uni,fog:true,side:THREE.DoubleSide,
    vertexShader:`attribute vec4 aInst; varying vec2 vUv; varying vec3 vCol; varying float vY; varying vec2 vSh; uniform float uTime;
#include <fog_pars_vertex>
void main(){
  float s0=aInst.x, s1=aInst.y, s2=aInst.z; vec3 wp=instanceMatrix[3].xyz;
  float ph=fract(aInst.w*3.0-uTime*0.045); float wave=smoothstep(0.0,0.015,ph)*(1.0-smoothstep(0.05,0.09,ph));
  float fld=sin(wp.x*0.11+uTime*0.37)+sin(wp.z*0.13-uTime*0.29)+sin((wp.x+wp.z)*0.07+uTime*0.21);
  float arms=max(wave,step(2.3,fld+(s2-0.5)*0.6));
  int sp;
  if(arms>0.5||s0>0.945) sp=36+int(s1*12.0); else if(s0<0.065) sp=48+int(s1*8.0); else if(s0<0.125) sp=56+int(s1*4.0); else sp=int(s1*36.0);
  vec2 a0=vec2(float(sp-(sp/8)*8),7.0-float(sp/8)); vec2 q=uv; if(s2>0.5) q.x=1.0-q.x; q=clamp(q,0.012,0.988);
  vUv=(a0+q)/8.0; vCol=instanceColor; vY=uv.y; vSh=vec2(fract(s1*7.31+s2*3.7),fract(s0*5.13+s1*1.9));
  float bob=arms*0.07*abs(sin(uTime*5.0+s1*40.0)); float sway=sin(uTime*(0.9+s2*0.6)+s2*40.0)*0.03;
  vec4 cpos=modelViewMatrix*instanceMatrix[3]; float sink=1.0-smoothstep(60.0,115.0,-cpos.z);
  vec4 mvPosition=modelViewMatrix*instanceMatrix*vec4(position.x+sway,(position.y+bob)*sink,position.z,1.0);
  gl_Position=projectionMatrix*mvPosition;
#include <fog_vertex>
}`,
    fragmentShader:`uniform sampler2D map; uniform float uGain; uniform float uFogK; varying vec2 vUv; varying vec3 vCol; varying float vY; varying vec2 vSh;
#include <fog_pars_fragment>
${PAL_GLSL}
void main(){ vec4 t=texture2D(map,vUv); if(t.a<0.3) discard;
  float mk=clamp((0.9-t.a)*4.0,0.0,1.0); vec3 c=mix(t.rgb,t.rgb*shirtCol(vSh.x,vSh.y)*2.09,mk);
  if(!gl_FrontFacing) c=mix(c,vec3(0.02,0.016,0.013)+c*0.12,smoothstep(0.62,0.72,vY)*(1.0-mk));   /* seen from behind (a camera in the stands above them): the backs of their heads */
  gl_FragColor=vec4(c*vCol*uGain*0.86*mix(0.5,1.0,smoothstep(0.0,0.5,vY)),1.0);
#include <tonemapping_fragment>
#include <colorspace_fragment>
${FOG_K}
}`});
  const m=new THREE.InstancedMesh(geo,mat,n), M=new THREE.Matrix4(), Q=new THREE.Quaternion(), P=new THREE.Vector3(), S=new THREE.Vector3(0.62,0.95,1), Y=new THREE.Vector3(0,1,0), c=new THREE.Color(), inst=new Float32Array(n*4);
  list.forEach((g,i)=>{ Q.setFromAxisAngle(Y,g.th); P.set(g.x,g.y,g.z); M.compose(P,Q,S); m.setMatrixAt(i,M); c.setRGB(g.L[0],g.L[1],g.L[2]); m.setColorAt(i,c); inst[i*4]=g.a; inst[i*4+1]=g.b; inst[i*4+2]=g.c; inst[i*4+3]=g.rf; });
  geo.setAttribute("aInst",new THREE.InstancedBufferAttribute(inst,4)); m.instanceMatrix.needsUpdate=true; if(m.instanceColor) m.instanceColor.needsUpdate=true; m.frustumCulled=false; return m;
}

/* the first rows as real people (milestone 2, HIGH / ULTRA): instanced low-poly bodies (a tapered torso with shoulders, a head with hair, two arms on shoulder pivots:
   36 triangles), facing the floor, shirt and skin from the same palette, lit by the floodlights (a key from above the far banks, the place's baked light); arms
   rest, one waves, some pump both fists, everybody's go up when the wave passes; a few stand. They sink into the slope beyond 60-115 m like the cards. ONE draw call.
   (36 triangles a person in the paused first try: facets and a diamond head; now 52 with smooth shading.) */
function nearPeople(ring,LV,pr,segs,U,lightFn,nRows){
  const slen=Math.hypot(pr[2]-pr[0],pr[3]-pr[1]), rows=Math.max(1,Math.round(slen/CROWD.row)), nA=44, aw=1.2*CROWD.seat, list=[], R=rngf(8821);
  for(let r=0;r<Math.min(nRows,rows);r++){ const t=(r+0.5)/rows, d=pr[0]+(pr[2]-pr[0])*t, y=pr[1]+(pr[3]-pr[1])*t, L=LV(d), aisleW=aw*nA/L.len; let i=0;
    for(let s=0.3;s<L.len-0.3;s+=CROWD.seat){ while(i<segs-1&&L.U[i+1]<s) i++; const f=(s-L.U[i])/((L.U[i+1]-L.U[i])||1), rf=(i+f)/segs; if(((rf*nA)%1)<aisleW) continue;
      const x=L.X[i]+(L.X[i+1]-L.X[i])*f, z=L.Z[i]+(L.Z[i+1]-L.Z[i])*f, p0=ring.pts[i], p1=ring.pts[(i+1)%segs]; let nx=p0.nx+(p1.nx-p0.nx)*f, nz=p0.nz+(p1.nz-p0.nz)*f; const nl=Math.hypot(nx,nz)||1; nx/=nl; nz/=nl;
      const jx=(R()-0.5)*0.12, jd=(R()-0.5)*0.14, a=R(), b=R(), c=R();
      if(a<0.04) continue;   /* an empty seat */
      list.push({x:x-nz*jx+nx*jd,y:y,z:z+nx*jx+nz*jd,th:Math.atan2(-nx,-nz)+(c-0.5)*0.5,L:lightFn(0,t,rf,L.len),a:a,b:b,c:c,rf:rf}); } }
  /* the body in person space (+z = the front, toward the floor; y = 0 the seat): colour.r = the part (0 torso, 1 head, 2 left arm, 3 right arm) */
  /* smooth normals (each part keeps its own: a rounded body under the lights, not facets): a 5-sided torso with shoulders, a 5 x 3 head, 3-sided arms: 52 triangles */
  const torso=new THREE.CylinderGeometry(0.215,0.16,0.5,5,1,false); torso.rotateY(Math.PI/10); torso.scale(1,1,0.6); torso.translate(0,0.27,0);
  const head=new THREE.SphereGeometry(0.105,5,3); head.scale(0.92,1.12,1.0); head.translate(0,0.68,0.01);
  const arm=s=>{ const g=new THREE.CylinderGeometry(0.068,0.05,0.52,3,1,true); g.translate(0,-0.26,0); g.translate(s*0.215,0.47,0.0); return g; };
  const parts=[paint(torso,[0,0,0]),paint(head,[1,0,0]),paint(arm(-1),[2,0,0]),paint(arm(1),[3,0,0])], geo=merge(parts);
  const n=list.length;
  const uni=THREE.UniformsUtils.merge([THREE.UniformsLib.fog,{}]); uni.uTime=U.uTime; uni.uGain=U.uGain; uni.uFogK=U.uFogK;
  const mat=new THREE.ShaderMaterial({uniforms:uni,fog:true,vertexColors:true,
    vertexShader:`attribute vec4 aP; varying vec3 vCol; varying vec3 vN; varying float vPart; varying float vHy; varying float vPy; varying vec2 vSh; uniform float uTime;
#include <fog_pars_vertex>
void main(){
  vec3 p=position, nn=normal; float part=color.r;
  float stand=step(0.9,fract(aP.y*13.7)); p.y+=stand*0.32;
  float ph=fract(aP.w*3.0-uTime*0.045); float wave=smoothstep(0.0,0.015,ph)*(1.0-smoothstep(0.05,0.09,ph));
  if(part>1.5){ float side=part<2.5?-1.0:1.0, th=0.16;
    if(aP.x<0.16&&side>0.0) th=2.45+0.5*sin(uTime*6.0+aP.z*30.0);
    else if(aP.x>=0.16&&aP.x<0.25) th=2.75+0.3*sin(uTime*7.5+aP.z*20.0);
    th=max(th,wave*2.9);
    vec2 sh=vec2(side*0.215,0.47+stand*0.32); vec2 q=p.xy-sh; float c=cos(th*side), s=sin(th*side);
    p.xy=sh+vec2(c*q.x-s*q.y,s*q.x+c*q.y); nn.xy=vec2(c*nn.x-s*nn.y,s*nn.x+c*nn.y); }
  p.y+=wave*0.12*(part<1.5?1.0:1.0);
  vec4 cpos=modelViewMatrix*instanceMatrix[3]; float sink=1.0-smoothstep(60.0,115.0,-cpos.z);
  p.y*=sink;
  vCol=instanceColor; vN=nn; vPart=part; vHy=position.y-0.68; vPy=position.y; vSh=vec2(fract(aP.y*7.31+aP.z*3.7),fract(aP.x*5.13+aP.y*1.9));
  vec4 mvPosition=modelViewMatrix*instanceMatrix*vec4(p,1.0); gl_Position=projectionMatrix*mvPosition;
#include <fog_vertex>
}`,
    fragmentShader:`uniform float uGain; uniform float uFogK; varying vec3 vCol; varying vec3 vN; varying float vPart; varying float vHy; varying float vPy; varying vec2 vSh;
#include <fog_pars_fragment>
${PAL_GLSL}
void main(){
  vec3 alb=shirtCol(vSh.x,vSh.y);
  if(vPart>0.5&&vPart<1.5){ float sk=fract(vSh.x*9.7+vSh.y*3.1); alb=mix(vec3(0.62,0.40,0.27),vec3(0.10,0.05,0.03),sk*sk);
    if(vHy>0.035) alb=mix(vec3(0.012,0.009,0.007),vec3(0.30,0.20,0.10),step(0.8,fract(vSh.y*11.3))); }
  if(vPart>1.5&&vPy<0.2){ float sk=fract(vSh.x*9.7+vSh.y*3.1); alb=mix(vec3(0.62,0.40,0.27),vec3(0.10,0.05,0.03),sk*sk); }   /* the forearms and hands */
  vec3 n=normalize(vN); float sh=0.5+0.55*max(dot(n,normalize(vec3(0.0,0.72,0.69))),0.0)+0.15*max(dot(n,normalize(vec3(0.0,0.3,-0.95))),0.0);
  gl_FragColor=vec4(alb*sh*vCol*uGain*0.8,1.0);   /* (as bright as the cards behind them: the first try was half as bright, a dark row) */
#include <tonemapping_fragment>
#include <colorspace_fragment>
${FOG_K}
}`});
  /* 8 sectors round the bowl, each culled by the camera's frustum (its bounding sphere + 1.5 m for the arms): a chase frame draws 2-4 of them, the people behind the lens cost nothing
     (one ring-wide mesh drew all 1,300 people, about 68k triangles, in every frame) */
  const K=8, grp=new THREE.Group(), M=new THREE.Matrix4(), Q=new THREE.Quaternion(), P=new THREE.Vector3(), S=new THREE.Vector3(1,1,1), Y=new THREE.Vector3(0,1,0), c=new THREE.Color(); grp.name="mx-near-people";
  for(let k=0;k<K;k++){ const L=list.filter(g=>Math.min(K-1,Math.floor(g.rf*K))===k); if(!L.length) continue;
    const gk=geo.clone(), inst=new Float32Array(L.length*4), m=new THREE.InstancedMesh(gk,mat,L.length);
    L.forEach((g,i)=>{ Q.setFromAxisAngle(Y,g.th); P.set(g.x,g.y+0.42,g.z); M.compose(P,Q,S); m.setMatrixAt(i,M); c.setRGB(g.L[0],g.L[1],g.L[2]); m.setColorAt(i,c); inst[i*4]=g.a; inst[i*4+1]=g.b; inst[i*4+2]=g.c; inst[i*4+3]=g.rf; });
    gk.setAttribute("aP",new THREE.InstancedBufferAttribute(inst,4)); m.instanceMatrix.needsUpdate=true; if(m.instanceColor) m.instanceColor.needsUpdate=true;
    m.computeBoundingSphere(); m.boundingSphere.radius+=1.5; m.frustumCulled=true; m.name="mx-near-people-"+k; grp.add(m); }
  geo.dispose(); return grp;
}

export function stadium(C,look,q,root,ctx){
  const lo=!!q.lo, F=C.layout.floor||[-66,66,-48,32], x0=F[0], x1=F[1], z0=F[2], z1=F[3], cx=(x0+x1)/2, cz=(z0+z1)/2, W=x1-x0, D=z1-z0;
  /* the quality tier: from the perf specialist's options when they exist (crowd.detail 0.35 / 0.7 / 1, crowd.anim, post.shafts, tier id), else from lo; each field can also be given outright (q.segs, q.fancy, q.cards, q.towers, q.haze, q.banners) */
  const det=q.crowdDetail!=null?q.crowdDetail:(lo?0.35:1), dome=look.around==="stadium-dome";
  const fancy=q.fancy!=null?!!q.fancy:(q.crowdAnim!=null?!!q.crowdAnim:!lo), hazeOn=q.haze!=null?!!q.haze:(q.post&&q.post.shafts!=null?!!q.post.shafts:!lo);
  const segs=q.segs||(det>=1?128:det>=0.7?96:72), nTow=q.towers||(det>=1?10:det>=0.7?8:6), nCards=q.cards!=null?q.cards:(det>=1?(q.tier==="ultra"?2:1):det>=0.7?1:0), nBan=q.banners!=null?q.banners:(det>=0.7?14:0);
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
  /* where the stands are: bowlY(x, z) -> {y: the height of the seats / structure at that place (0 on the floor), d: how far out from the footprint (negative = on the floor)}.
     For cameras (keep an eye above the stand under it) and anything that must not stand inside the bowl. */
  const PROF=[[-0.05,1.4],[1.0,2.5],[14.0,9.5],[15.6,9.5],[15.6,10.4],[30.0,18.0],[31.0,18.0],[31.0,24.0],[36.0,25.5],[64.0,44.0],[64.0,48.5]];
  function bowlY(x,z){ let bi=0,bd=1e9; for(let i=0;i<ring.n;i++){ const p=ring.pts[i], d2=(p.x-x)*(p.x-x)+(p.z-z)*(p.z-z); if(d2<bd){ bd=d2; bi=i; } }
    const p=ring.pts[bi], d=(x-p.x)*p.nx+(z-p.z)*p.nz; if(d<=PROF[0][0]) return {y:0,d:d};
    for(let k=1;k<PROF.length;k++){ if(d<=PROF[k][0]||k===PROF.length-1){ const a=PROF[k-1], b=PROF[k], t=b[0]===a[0]?1:clamp((d-a[0])/(b[0]-a[0]),0,1); return {y:a[1]+(b[1]-a[1])*t,d:d}; } }
    return {y:0,d:d}; }
  /* ---- the floodlights on the stands (milestone 2): a cool night level everywhere, a WARM POOL by every light bank (the spill of the banks above and of the
     lamps under the decks: brighter where a bank is, darker between them), the upper rows nearer the banks, the floor's warm bounce on the first rows. Baked
     per vertex (the slope) or per person (the cards, the near people): no per-pixel lights. ---- */
  const towerF=[]; for(let k=0;k<nTow;k++) towerF.push((((k+0.5)/nTow+0.037)%1+1)%1);
  const COOL=[0.80,0.86,1.0], WARM=[1.0,0.79,0.55], lightK=lo?1.12:1.0;
  function poolAt(rf,len){ const sg=Math.max(18,0.36*len/nTow); let s=0; for(const f of towerF){ let d=Math.abs(rf-f); d=Math.min(d,1-d)*len; s+=Math.exp(-(d*d)/(sg*sg)); } return Math.min(1.25,s); }
  function lightAt(band,t,rf,len){ const p=poolAt(rf,len), w=0.92+0.08*Math.sin(rf*Math.PI*2*7+0.7)+0.05*Math.sin(rf*Math.PI*2*17); let base,pw;
    if(band===0){ base=0.95+0.22*(1-t); pw=0.5; } else if(band===1){ base=0.86; pw=0.62; } else { base=0.66+0.12*t; pw=0.5+0.7*t; }
    const k=lightK*w; return [k*(base*COOL[0]+pw*p*WARM[0]),k*(base*COOL[1]+pw*p*WARM[1]),k*(base*COOL[2]+pw*p*WARM[2])]; }
  U.uGain={value:lo?0.8:1.0}; U.uGainC={value:lo?1.05:1.0}; U.uFogK={value:0.55}; U.uNear={value:new THREE.Vector2(0,0)}; U.uLp={value:lo?new THREE.Vector2(0.8,2.0):new THREE.Vector2(1.0,2.6)};   /* calibrated against the tone curve: the stands land near luma 45-55 (milestone 1: about 30) */
  /* ---- the crowd: three lofted strips of seats ---- */
  const MC=Mesher();
  const crowdBand=(pr,sub,band,uoff,voff)=>{ const slen=Math.hypot(pr[2]-pr[0],pr[3]-pr[1]), rows=Math.max(1,Math.round(slen/CROWD.row)), nA=44;
    loft(MC,LV,segs,pr,sub,(t,r,Uu,o)=>{ const Lv=LV(pr[0]+(pr[2]-pr[0])*t), c=lightAt(band,t,r,Lv.len); o.u=Uu/CROWD.seat+uoff; o.v=t*rows+voff; o.r=c[0]; o.g=c[1]; o.b=c[2]; o.ar=1.2*CROWD.seat*nA/Lv.len; }); };
  crowdBand(PR.low1,6,0,37.1,11.0);
  crowdBand(PR.low2,6,1,521.3,63.0);
  crowdBand(PR.up,8,2,1042.7,121.0);
  /* the twinkle of phone flashes on the tiers without crowd animation; never with Reduce effects or reduced motion (those ask for a still world) */
  const twink=!fancy&&(q.twinkle!=null?!!q.twinkle:!stillWorld());
  let animOn=fancy; const atlas=crowdAtlas(lo), cm=crowdMaterial(atlas,U,fancy,()=>animOn,twink);
  const bowl=new THREE.Mesh(MC.geo(),cm); bowl.frustumCulled=false; root.add(bowl);
  const nearRows=q.nearPeople!=null?q.nearPeople:((det>=1&&!lo)?(q.tier==="ultra"?3:2):0);   /* the first rows as 3D people: HIGH 2 rows, ULTRA 3 */
  if(nCards>0){ const cut=crowdAtlas(false,true); const c1=crowdCards(ring,LV,PR.low1,segs,U,cut,lightAt,0,nearRows); root.add(c1);
    if(nCards>1) root.add(crowdCards(ring,LV,PR.low2,segs,U,cut,lightAt,1,0)); }
  if(nearRows){ root.add(nearPeople(ring,LV,PR.low1,segs,U,lightAt,nearRows)); U.uNear.value.set(11,11+nearRows); }   /* (11: the first row's v in the slope's texture: crowdBand(PR.low1, ..., 11.0)) */
  /* FIRE TV (milestone 2: its lower stands read dark and flat): the first 3 rows stand up as cut-out people on the small atlas (about 2,000 cards: +1 draw call, +4k triangles);
     not with Reduce effects or reduced motion (a still, simpler world) */
  const tvRows=q.cardRows!=null?q.cardRows:(nCards===0&&!stillWorld()?3:0);
  if(nCards===0&&tvRows>0) root.add(crowdCards(ring,LV,PR.low1,segs,U,crowdAtlas(true,true),lightAt,0,0,tvRows));
  /* ---- the structure: dark concrete, rails, the concourse, the cantilever, the roof edge, the back, the wall's padded cap (vertex colours, unlit, fogged): one mesh ---- */
  const MS=Mesher(), flat=(rgb)=>(t,r,Uu,o)=>{ o.r=rgb[0]; o.g=rgb[1]; o.b=rgb[2]; };
  const conc=lin("#1d1c24"), concL=lin("#34333c"), dark=lin("#0b0b11"), navy=lin("#141b38"), steel=lin("#2a2c36");
  /* the structure near the floor takes the warm spill of the banks too (milestone 2: the bowl was unlit by its own lights): brighter and warmer under a bank */
  const lit=(rgb,d)=>{ const Ld=LV(d).len; return (t,r,Uu,o)=>{ const p=poolAt(r,Ld), k=0.8+0.45*p; o.r=rgb[0]*k*(1+0.14*p); o.g=rgb[1]*k; o.b=rgb[2]*k*(1-0.14*p); }; };
  loft(MS,LV,segs,PR.apron,1,lit(lin("#16151c"),0));
  loft(MS,LV,segs,PR.aisle,1,lit(concL,14)); loft(MS,LV,segs,PR.rail,1,lit(conc,15.6));
  loft(MS,LV,segs,PR.conc,1,flat(concL)); loft(MS,LV,segs,PR.trim,1,flat(conc)); loft(MS,LV,segs,PR.under,1,flat(dark));
  loft(MS,LV,segs,PR.roof,1,flat(dark)); loft(MS,LV,segs,PR.back,1,flat(dark)); loft(MS,LV,segs,PR.cap,1,flat(steel));
  loft(MS,LV,segs,[-0.55,1.1,-0.55,1.16],1,lit(lin("#f0f1f3"),-0.55)); loft(MS,LV,segs,[-0.55,1.16,-0.55,1.4],1,lit(navy,-0.55)); loft(MS,LV,segs,[-0.55,1.4,-0.05,1.4],1,lit(lin("#202a52"),-0.3));   /* the wall's cap */
  /* tall banners hanging from the roof edge, facing the floor (the props texture; the plain structure samples its white corner) */
  for(let k=0;k<nBan;k++){ const p=ring.pts[Math.floor((k+0.5)/nBan*segs)%segs], dd=61, qx=p.x+p.nx*dd, qz=p.z+p.nz*dd, tx=-p.nz, tz=p.nx, hw=1.6, y1=49.6, y0=43.6, r=propsUV(PROPS.ban[k%4]);
    const v0=MS.vert(qx-tx*hw,y0,qz-tz*hw,r[0],r[1],1,1,1), v1=MS.vert(qx+tx*hw,y0,qz+tz*hw,r[2],r[1],1,1,1), v2=MS.vert(qx-tx*hw,y1,qz-tz*hw,r[0],r[3],1,1,1), v3=MS.vert(qx+tx*hw,y1,qz+tz*hw,r[2],r[3],1,1,1); MS.quad(v0,v1,v2,v3); }
  { const sm=new THREE.MeshBasicMaterial({map:propsTex(),vertexColors:true,side:THREE.DoubleSide}); sm.userData.keepMaps=true; root.add(new THREE.Mesh(MS.geo(),sm)); }
  /* ---- the LED ribbons (the lower on the concourse, the upper on the rim), the suites' windows, the ad boards round the floor (1.1 m, 0.55 m inside the footprint) ---- */
  const rt=ribbonTex(lo), MR=Mesher();
  [PR.rib1,PR.rim].forEach(pr=>{ const rep16=(pr[3]-pr[1])*16, nr=Math.max(1,Math.round(LV(pr[0]).len/rep16)); loft(MR,LV,segs,pr,1,(t,r,Uu,o)=>{ o.u=Uu/(LV(pr[0]).len/nr); o.v=t; o.r=1.5; o.g=1.5; o.b=1.5; }); });
  root.add(new THREE.Mesh(MR.geo(),new THREE.MeshBasicMaterial({map:rt,vertexColors:true,side:THREE.DoubleSide})));
  const st=suitesTex(lo), MW=Mesher(); st.wrapS=THREE.RepeatWrapping; st.wrapT=THREE.ClampToEdgeWrapping;
  loft(MW,LV,segs,PR.suite,1,(t,r,Uu,o)=>{ o.u=Uu/16; o.v=t; o.r=1.25; o.g=1.2; o.b=1.1; });
  root.add(new THREE.Mesh(MW.geo(),new THREE.MeshBasicMaterial({map:st,vertexColors:true,side:THREE.DoubleSide})));
  /* the ad boards round the floor: warm light under every bank (milestone 2: the wall was one flat level) */
  const bt=boardsTex(lo), MB=Mesher(), wallL=LV(-0.55).len;
  loft(MB,LV,segs,[-0.55,0.0,-0.55,1.1],1,(t,r,Uu,o)=>{ const p=poolAt(r,wallL), k=1.3*(0.78+0.1*t); o.u=Uu/23.5; o.v=t; o.r=k*(0.86+0.5*p); o.g=k*(0.88+0.4*p); o.b=k*(0.95+0.26*p); });
  /* hero signs (milestone 2): big upright panels of the boards' art (6 x 2.25 m on two legs) on the floor's edge wherever the track leaves room, lit like the wall */
  let netOn=false; const heroLegs=[], heroN=lo?0:(q.heroSigns!=null?q.heroSigns:22);
  for(let k=0;k<heroN;k++){ const f=(k+0.5)/heroN, p=ring.pts[Math.floor(f*segs)%segs], dd=-2.4, qx=p.x+p.nx*dd, qz=p.z+p.nz*dd, tx=-p.nz, tz=p.nx, hw=3.0;
    if(!clear(C,qx,qz,3.4)||!clear(C,qx-tx*hw,qz-tz*hw,2.6)||!clear(C,qx+tx*hw,qz+tz*hw,2.6)) continue;
    const pk=(k*3)%8, u0=pk/8, u1=(pk+1)/8, y0=0.45, y1=2.7, pl=poolAt(f,wallL), kr=1.25*(0.86+0.5*pl), kg=1.25*(0.88+0.4*pl), kb=1.25*(0.95+0.26*pl);
    const v0=MB.vert(qx-tx*hw,y0,qz-tz*hw,u0,0,kr,kg,kb), v1=MB.vert(qx+tx*hw,y0,qz+tz*hw,u1,0,kr,kg,kb), v2=MB.vert(qx-tx*hw,y1,qz-tz*hw,u0,1,kr,kg,kb), v3=MB.vert(qx+tx*hw,y1,qz+tz*hw,u1,1,kr,kg,kb); MB.quad(v0,v1,v2,v3);
    for(const sd of [-0.8,0.8]) heroLegs.push(xf(paint(new THREE.BoxGeometry(0.12,y0+0.05,0.12),lin("#14151b")),qx+tx*hw*sd+p.nx*0.08,(y0+0.05)/2,qz+tz*hw*sd+p.nz*0.08));
    heroLegs.push(xf(paint(new THREE.BoxGeometry(0.1,y1-y0+0.1,0.1),lin("#14151b")),qx+tx*hw+p.nx*0.06,(y0+y1)/2,qz+tz*hw+p.nz*0.06), xf(paint(new THREE.BoxGeometry(0.1,y1-y0+0.1,0.1),lin("#14151b")),qx-tx*hw+p.nx*0.06,(y0+y1)/2,qz-tz*hw+p.nz*0.06));
    { const bk=paint(new THREE.PlaneGeometry(hw*2+0.08,y1-y0+0.08),lin("#2c2e36")); bk.applyMatrix4(new THREE.Matrix4().makeBasis(new THREE.Vector3(tx,0,tz),new THREE.Vector3(0,1,0),new THREE.Vector3(p.nx,0,p.nz)).setPosition(qx+p.nx*0.035,(y0+y1)/2,qz+p.nz*0.035)); heroLegs.push(bk); } }   /* a plain dark back: seen from the stands the art read mirrored (the first try) */
  root.add(new THREE.Mesh(MB.geo(),new THREE.MeshBasicMaterial({map:bt,vertexColors:true,side:THREE.DoubleSide})));
  /* the catch net over the wall (milestone 2): posts every 2.6 m, a top cable and a fine dark net (alpha-tested: it fades away with distance instead of shimmering) */
  if(!lo){ const nc=canvas(64,64), nx2=nc.getContext("2d"); nx2.clearRect(0,0,64,64); nx2.strokeStyle="rgba(70,72,80,1)"; nx2.lineWidth=1.6; nx2.beginPath(); for(let i=-64;i<=64;i+=16){ nx2.moveTo(i,0); nx2.lineTo(i+64,64); nx2.moveTo(i+64,0); nx2.lineTo(i,64); } nx2.stroke();
    const nt=tex(nc,true), MN=Mesher(), netL=LV(-0.45).len; loft(MN,LV,segs,[-0.45,1.4,-0.45,3.3],1,(t,r,Uu,o)=>{ o.u=Uu/1.6; o.v=t*1.2; o.r=o.g=o.b=1; });
    const nm=new THREE.MeshBasicMaterial({map:nt,vertexColors:true,side:THREE.DoubleSide,alphaTest:0.5,transparent:false}); root.add(new THREE.Mesh(MN.geo(),nm));
    const npost=Math.round(netL/2.6); for(let k=0;k<npost;k++){ const p=ring.pts[Math.floor(k/npost*segs)%segs]; heroLegs.push(xf(paint(new THREE.CylinderGeometry(0.035,0.04,2.0,5),lin("#202128")),p.x-p.nx*0.47,2.35,p.z-p.nz*0.47)); }
    netOn=true; }
  /* ---- the lights: LED strips, light towers on the rim (a mast, a bank of floodlights facing the floor, a catwalk), the bulbs as emissive discs (brighter than white), a ring of
     floodlight banks under the roof lip: ONE mesh, never fogged. Every bulb has a glow, every bank a halo (the glow sprites below). Milestone 2: the strips are at least
     0.25-0.5 m tall (they were 12-17 cm: a sub-pixel thread that broke into dashes far away) and dimmer per area; the rim's string of 64 tiny bulbs (a sparkling dashed line)
     became a ring of real floodlight banks under the roof lip, visible from the high cameras. ---- */
  const MA=Mesher(), glowStrip=(pr,rgb)=>loft(MA,LV,segs,pr,1,flat(rgb));
  if(netOn) loft(MA,LV,segs,[-0.47,3.28,-0.47,3.36],1,flat(lin("#30323a")));   /* the net's top cable */
  glowStrip([0.25,1.62,0.5,1.95],[1.1,0.17,0.12]); glowStrip([15.55,9.95,15.55,10.4],[0.8,0.64,0.42]); glowStrip([30.0,18.0,30.0,18.6],[0.85,0.66,0.37]); glowStrip([61.0,48.95,61.0,49.7],[0.9,0.83,0.66]); glowStrip([64.05,48.0,64.05,48.5],[1.2,0.2,0.14]);
  const parts=[], bulbs=[], glows=[], banks=[], dummy=new THREE.Object3D(), tgt=new THREE.Vector3(cx,2,cz), bcols=lo?4:6, brows=lo?3:4, sp=lo?2.6:2.2;
  const steelC=lin("#1a1c24"), plate=lin("#0c0d12");
  parts.push.apply(parts,heroLegs);   /* the hero signs' legs and frames, the net's posts */
  const addBulb=(M,s,rim,a)=>{ const p=new THREE.Vector3().setFromMatrixPosition(M); bulbs.push({M:M.clone(),rim:!!rim}); glows.push({x:p.x,y:p.y,z:p.z,s:s*0.56,r:1.0,g:0.93,b:0.78,k:0,a:a!=null?a:(rim?0.5:0.8)}); };   /* (polish: each bulb a distinct small disc, as the cover's light banks: the bank's halo and the bloom do the glow) */
  for(let k=0;k<nTow;k++){
    const idx=Math.floor(((k+0.5)/nTow+0.037)*segs)%segs, p=ring.pts[idx], baseD=PR.rim[0]+1.8, hM=dome?3+(k%3)*1.2:13+(k%3)*2.5;
    const bx=p.x+p.nx*baseD, bz=p.z+p.nz*baseD, by=PR.cap[3], top=by+hM;
    dummy.position.set(bx-p.nx*1.6,top,bz-p.nz*1.6); dummy.lookAt(tgt.x,tgt.y,tgt.z); dummy.updateMatrix(); const Mb=dummy.matrix.clone();
    const bw=(bcols-1)*sp+2.2, bh=(brows-1)*sp+2.2;
    const box=xf(paint(new THREE.BoxGeometry(bw,bh,0.7),plate),0,0,0); box.applyMatrix4(Mb); parts.push(box);
    const frm=xf(paint(new THREE.BoxGeometry(bw+0.5,bh+0.5,0.5),steelC),0,0,-0.2); frm.applyMatrix4(Mb); parts.push(frm);
    for(const s of [-1,1]){ const m=xf(paint(new THREE.CylinderGeometry(0.34,0.5,hM+0.6,6),steelC),bx+s*p.nz*2.4,by+(hM+0.6)/2-0.3,bz-s*p.nx*2.4); parts.push(m); }
    const cat=xf(paint(new THREE.BoxGeometry(bw+1.5,0.35,2.2),steelC),0,-bh/2-0.6,-0.9); cat.applyMatrix4(Mb); parts.push(cat);
    for(let j=0;j<brows;j++) for(let i=0;i<bcols;i++){ const lm=new THREE.Matrix4().makeTranslation((i-(bcols-1)/2)*sp,(j-(brows-1)/2)*sp,0.37); addBulb(Mb.clone().multiply(lm),lo?3.4:2.9,false); }
    const c0=new THREE.Vector3(0,0,1.0).applyMatrix4(Mb);
    glows.push({x:c0.x,y:c0.y,z:c0.z,s:bw*2.4,r:1.0,g:0.85,b:0.6,k:0,a:0.30}); glows.push({x:c0.x,y:c0.y,z:c0.z,s:bw*2.5,r:1.0,g:0.9,b:0.7,k:1,a:0.34});   /* (polish: a soft halo and a small flare, no longer a 29 m four-point star) */
    banks.push({c:c0.clone(),w:bw});
  }
  /* the roof ring: banks of 4 x 2 floodlights (3 x 2 on FIRE TV) hung under the roof lip between the towers, aimed at the floor */
  const nRoof=dome?0:(q.roofBanks!=null?q.roofBanks:(lo?8:det>=1?18:12)), rcols=lo?3:4, rrows=2, rsp=1.45, rimL=LV(PR.roof[0]).len;
  for(let k=0;k<nRoof;k++){
    const f=(k+0.25)/nRoof; let near=false; for(const tf of towerF){ let d=Math.abs(f-tf); d=Math.min(d,1-d)*rimL; if(d<16) near=true; } if(near) continue;
    const p=ring.pts[Math.floor(f*segs)%segs], dd=PR.roof[2]+1.2;   /* under the roof lip (d 61-64), in front of the rim wall (d 64): at d 64.4 the rim hid them */
    dummy.position.set(p.x+p.nx*dd,PR.roof[1]-1.3,p.z+p.nz*dd); dummy.lookAt(cx,0,cz); dummy.updateMatrix(); const Mb=dummy.matrix.clone();
    const bw=(rcols-1)*rsp+1.6, bh=(rrows-1)*rsp+1.6;
    const box=xf(paint(new THREE.BoxGeometry(bw,bh,0.5),plate),0,0,0); box.applyMatrix4(Mb); parts.push(box);
    const frm=xf(paint(new THREE.BoxGeometry(bw+0.3,0.25,1.2),steelC),0,bh/2+0.1,-0.3); frm.applyMatrix4(Mb); parts.push(frm);
    for(let j=0;j<rrows;j++) for(let i=0;i<rcols;i++){ const lm=new THREE.Matrix4().makeTranslation((i-(rcols-1)/2)*rsp,(j-(rrows-1)/2)*rsp,0.27); addBulb(Mb.clone().multiply(lm),lo?2.8:2.3,true,lo?0.85:0.72); }
    const c0=new THREE.Vector3(0,0,0.8).applyMatrix4(Mb);
    glows.push({x:c0.x,y:c0.y,z:c0.z,s:bw*2.3,r:1.0,g:0.86,b:0.62,k:0,a:0.24});
  }
  const discs=bulbs.map(b=>{ const g=new THREE.CircleGeometry(b.rim?0.52:0.8,lo?8:12); g.applyMatrix4(b.M); return paint(g,[4.2,4.0,3.5]); });
  root.add(new THREE.Mesh(merge([MA.geo()].concat(parts,discs)),new THREE.MeshBasicMaterial({vertexColors:true,side:THREE.DoubleSide,fog:false})));
  const sheet=glowSheet(), gm=glowSprites(sheet,glows,U); root.add(gm); ctx.glowMesh=gm;
  /* ---- the roof of a dome ---- */
  if(dome){ const rr=W/2+95, roof=new THREE.Mesh(new THREE.SphereGeometry(rr,32,10,0,Math.PI*2,0,Math.PI*0.36),new THREE.MeshBasicMaterial({color:0x14141c,side:THREE.BackSide})); roof.scale.set(1,0.3,(D/2+95)/rr); roof.position.set(cx,29,cz); root.add(roof); }
  /* ---- LIGHT SHAFTS (milestone 2; the tiers with q.post.shafts, and only while the ladder keeps q.live.post.shafts): a beam of light through the haze from every tower
     bank toward the floor, STATIC like real floodlights (the old cones swept like searchlights and faded out right at the bank, so a broadcast frame never showed them).
     Brightest near the bank, fading along its length, soft edges (brighter where the view crosses the beam's core), a slow drift of dust in it; it ends in the air
     well above the floor (no hard line where a cone would cut the dirt). Additive, no depth write, never fogged, ONE draw call. (The colour is NOT premultiplied:
     three.js' additive blending multiplies by the alpha itself, src * a + dst; the old cones wrote col * a and so added col * a * a, about 0.5% of white: invisible.) ---- */
  let shafts=null;
  if(hazeOn&&!dome&&banks.length){
    const g=new THREE.CylinderGeometry(0.42,1,1,16,1,true); g.translate(0,-0.5,0);   /* (the first try: 4 m at the bank, 26 m wide at the end: the cones overlapped into flat wedges of light over the stands) */
    const mat=new THREE.ShaderMaterial({transparent:true,depthWrite:false,side:THREE.DoubleSide,blending:THREE.AdditiveBlending,fog:false,uniforms:{col:{value:new THREE.Vector3(1.0,0.92,0.78)},uTime:U.uTime,uI:{value:q.shaftI!=null?q.shaftI:0.045}},
      vertexShader:"attribute float aPh; varying float vU; varying float vE; varying float vPh; varying float vD; void main(){ vU=-position.y; vPh=aPh; vec4 mv=modelViewMatrix*instanceMatrix*vec4(position,1.0); vec3 n=normalize(mat3(modelViewMatrix*instanceMatrix)*normal); vE=abs(dot(n,normalize(-mv.xyz))); vD=-mv.z; gl_Position=projectionMatrix*mv; }",
      fragmentShader:"uniform vec3 col; uniform float uTime; uniform float uI; varying float vU; varying float vE; varying float vPh; varying float vD; void main(){ float u=clamp(vU,0.0,1.0); float a=uI*pow(1.0-u,1.5)*smoothstep(0.0,0.04,u)*pow(clamp(vE,0.0,1.0),2.0)*smoothstep(14.0,40.0,vD)*(0.8+0.2*sin(u*19.0-uTime*0.35+vPh*6.0)); gl_FragColor=vec4(col,a);\n#include <tonemapping_fragment>\n#include <colorspace_fragment>\n}"});
    const n=banks.length, m=new THREE.InstancedMesh(g,mat,n), M=new THREE.Matrix4(), Q=new THREE.Quaternion(), dn=new THREE.Vector3(0,-1,0), d=new THREE.Vector3(), sc=new THREE.Vector3(), ph=new Float32Array(n);
    banks.forEach((b,i)=>{ const ax=cx+((((i*37)%11)/11)-0.5)*W*0.55, az=cz+((((i*53)%7)/7)-0.5)*D*0.45; d.set(ax-b.c.x,-b.c.y,az-b.c.z); const len=d.length()*0.72; d.normalize(); Q.setFromUnitVectors(dn,d);
      const rb=b.w*0.85;   /* a beam: about the bank's size where it leaves, 11 m across at its end; a beam within 14-40 m of the lens fades out (no wash over the frame) */ sc.set(rb,len,rb); M.compose(b.c,Q,sc); m.setMatrixAt(i,M); ph[i]=(i*0.618)%1; });
    g.setAttribute("aPh",new THREE.InstancedBufferAttribute(ph,1)); m.instanceMatrix.needsUpdate=true; m.frustumCulled=false; m.renderOrder=6; m.name="mx-shafts"; root.add(m); shafts=m;
  }
  /* ---- the big video boards: the east and west ends and the far side, original graphics, plain text; the screens and their steel frames are ONE mesh on one texture (the canvas's last rows are white for the steel) ---- */
  const BH=272, V0=1-256/BH, bc=canvas(512,BH), bx=bc.getContext("2d"); bx.fillStyle="#ffffff"; bx.fillRect(0,256,512,BH-256);
  const bt2=tex(bc,false), board={lap:0,len:0,num:null,T:null,sec:-1,dirty:true};
  const MBd=Mesher(), parts2=[], bw2=26, bh2=11.2, solid=g=>{ const uv=g.attributes.uv; for(let i=0;i<uv.count;i++) uv.setXY(i,0.5,0.015); return g; };
  [0,Math.floor(segs/2),Math.floor(segs*0.75)].forEach((i,bi)=>{ const p=ring.pts[i], dd=46, qx=p.x+p.nx*dd, qz=p.z+p.nz*dd, yc=40.5, tx=-p.nz, tz=p.nx;
    const a=[qx-tx*bw2/2,yc-bh2/2,qz-tz*bw2/2], b=[qx+tx*bw2/2,yc-bh2/2,qz+tz*bw2/2], c=[qx-tx*bw2/2,yc+bh2/2,qz-tz*bw2/2], d2=[qx+tx*bw2/2,yc+bh2/2,qz+tz*bw2/2];
    const v0=MBd.vert(a[0],a[1],a[2],0,V0,1.7,1.7,1.7), v1=MBd.vert(b[0],b[1],b[2],1,V0,1.7,1.7,1.7), v2=MBd.vert(c[0],c[1],c[2],0,1,1.7,1.7,1.7), v3=MBd.vert(d2[0],d2[1],d2[2],1,1,1.7,1.7,1.7); MBd.quad(v0,v1,v2,v3);
    const fr=xf(solid(paint(new THREE.BoxGeometry(bw2+1.4,bh2+1.4,0.9),steel)),0,0,0); const Mf=new THREE.Matrix4().makeBasis(new THREE.Vector3(tx,0,tz),new THREE.Vector3(0,1,0),new THREE.Vector3(-p.nx,0,-p.nz)); Mf.setPosition(qx+p.nx*0.65,yc,qz+p.nz*0.65); fr.applyMatrix4(Mf); parts2.push(fr);
    for(const s2 of [-1,1]){ const post=xf(solid(paint(new THREE.BoxGeometry(0.8,8,0.8),steel)),qx+tx*s2*(bw2/2-1.2)+p.nx*0.6,yc-bh2/2-3.2,qz+tz*s2*(bw2/2-1.2)+p.nz*0.6); parts2.push(post); }
  });
  root.add(new THREE.Mesh(merge([MBd.geo()].concat(parts2)),new THREE.MeshBasicMaterial({map:bt2,vertexColors:true,side:THREE.DoubleSide,fog:false})));
  const redraw=()=>{ drawBoard(bx,512,256,board); bt2.needsUpdate=true; board.dirty=false; };
  ctx.screen=function(lap,len,num){ board.lap=lap|0; board.len=len|0; if(num!=null) board.num=num; if(!lap) board.T=null; board.dirty=true; redraw(); };
  ctx.screen(0,0,null);
  /* the night sky and the haze of a big night */
  ctx.sky(0x04060e,0x101838,0x26253f);
  ctx.fog(0x141a2e,140,600);
  /* per frame: the clock of the shaders, the ribbon's scroll, the board's clock */
  function frame(dt,tw,cam,T,lap,len,num){
    U.uTime.value=tw%3600; rt.offset.x=(tw*0.011)%1;
    if(shafts){ const lp=q.live&&q.live.post; shafts.visible=!lp||lp.shafts!==false; }
    /* the adaptive ladder can switch the crowd's animation off under load (q.live.crowdAnim from r3d-quality.js): the shader is rebuilt without it */
    const lv=q.live; if(lv&&fancy&&lv.crowdAnim!=null&&!!lv.crowdAnim!==animOn){ animOn=!!lv.crowdAnim; cm.defines=animOn?{FANCY:1}:{TWINK:1}; cm.needsUpdate=true; }   /* (the ladder's cut keeps the flashes: a hash a pixel) */
    if(len!=null){ let ch=false; if(len!==board.len){ board.len=len|0; ch=true; } if(lap!=null&&lap!==board.lap){ board.lap=lap|0; ch=true; } if(num!=null&&num!==board.num){ board.num=num; ch=true; }
      if(T!=null&&lap>0){ const s=Math.floor(T); if(s!==board.sec){ board.sec=s; board.T=T; ch=true; } } else if(board.T!=null&&!(lap>0)){ board.T=null; ch=true; }
      if(ch) redraw(); }
  }
  return {cx:cx,cz:cz,frame:frame,board:board,bowlY:bowlY};
}
