/* MOTOCROSS WAR 3D — THE TRACK SURFACE (owner: dirt). Everything the riders ride on: the soil colours, the dirt as REAL TERRAIN and the material it is drawn with, the lane-edge blocks.
   The dirt is a relief field in track space (r3d-dirt-relief.js: ruts along the racing lines, the berms' high lines, windrows of loose dirt, whoop erosion, braking bumps, tyre tracks, clods).
   That one field does four jobs, so nothing can disagree:
     1. the MESH: a ribbon on a fine grid (0.25 m x 0.19 m), cut into 48 m chunks with three levels of detail (THREE.LOD: nearest 0.25 m rows, then 0.5, then 1.0) so the ruts are
        geometry near the lens and cost nothing far away; Reduce effects / the TV: one coarser mesh;
     2. the GROUND THE WHEELS FOLLOW: Course.ground() is wrapped (installGround) so it returns the dirt AS DRAWN (ground + the field's smooth part): a wheel sits IN a rut;
     3. the TRACK-SPACE TEXTURE (slopes of the detail the mesh can't carry, ambient occlusion from the whole relief, a loose-dirt mask) the shader reads per pixel;
     4. moisture, which darkens the colour and makes the dirt shine at a grazing angle.
   The soil itself is two CC0 photo scans (assets/dirt/dirt-tiles.js: a packed arena dirt and a crumbly loose dirt, Poly Haven, see assets/LICENSES.md) blended by the loose mask at two scales
   each (so the tiling never shows), lit by a physically based material (Reduce effects: Lambert with fewer samples).
   r3d-world.js calls trackMaterial() first and addTrack() where the track joins the scene; the stadium floor and the starting pad use dirtMaps() / padMaps() / SOIL from here.
   addTrack() returns {track, frame, relief}: race3d.js calls frame(dt, riders) every frame if it is set. */
import * as THREE_NS from "../ui/vendor/three-0.160.0.module.min.js";
const THREE=THREE_NS;
import {lin,mixc,clamp,sstep,vnoise,pfbm,canvas,tex,normalTex,rngf,merge,clear,getAniso} from "./r3d-util.js";
import {decodePNG} from "./r3d-dirt-png.js";
import {DIRT_TILES_PNG} from "./assets/dirt/dirt-tiles.js";
import {DIRT_TILES_LO_PNG} from "./assets/dirt/dirt-tiles-lo.js";
import {buildRelief,buildStartFine} from "./r3d-dirt-relief.js";
const MXG=(typeof window!=="undefined"?window:globalThis).MXWar;
const CO=()=>MXG.Course;

/* ---------------- the soil and the dirt's detail maps ---------------- */
/* dirt colours (sRGB): the groomed track, a lighter dry / worn tone, the packed / wet dark. SOIL is what r3d-world.js reads for the stadium floor and the starting pad (its [2] is
   the floor's tone: mix(base, dark, 0.6)); TRK is the track's own palette, with the deep dark of wet ruts (the cover's dirt: saturated warm brown, R : G : B about 1 : 0.6 : 0.3) */
export const SOIL={ "stadium-dirt":["#74461f","#a56c35","#6a3f1c"], loam:["#4e3320","#6e4a2c","#43301f"], clay:["#7a4326","#a8683c","#663b21"],
  hardpack:["#84603a","#b08354","#755535"], sand:["#c2a170","#d6b986","#97784b"] };
/* the track's own palette (milestone 2): THREE SOIL FAMILIES and the deep dark of a rut's bottom, picked per place by the relief's moisture:
   [dry tan (crests, lips, windrows, the dry edges), mid brown (the groomed body of the track), wet dark brown (the racing line, the watered patches), the deep wet of a rut's bottom].
   The cover's dirt keeps milestone 1's warm saturated hue (its foreground crop: mean sRGB 111,65,32, saturation 0.78) but spans a far wider value range (luma p5 10, p95 179 against
   milestone 1's 36 / 166 on the flat): a golden dry tan, a darker mid brown, a wet near-black brown in the ruts. */
const TRK={ "stadium-dirt":["#a2723f","#6a4322","#3f2715","#28180c"], loam:["#7d6347","#4e3320","#2e1d10","#180f08"], clay:["#a8683c","#7a4326","#45260f","#26150a"],
  hardpack:["#b08354","#84603a","#573a20","#33210f"], sand:["#d6b986","#c2a170","#97784b","#6b5232"] };
/* the dirt's detail maps for the stadium FLOOR and the starting pad (r3d-world.js multiplies them by the soil colour and repeats them every 7 m): the same scans as the track, laid as a
   mosaic of k x k tiles, each turned or mirrored its own way, so no big blotch repeats across the floor. {map: a warm near-white luma detail (sRGB), normal: a tangent-space normal map}. */
export function dirtMaps(soil,lo,floor){
  const T=soilTiles(!!lo), TW=T.W, A=T.A.image.data, B=T.B.image.data, W=lo?256:512, k=lo?2:3, sw=W/k, N=W*W, c=new Uint8Array(N*4), n=new Uint8Array(N*4), sandy=soil==="sand", g=(lo?0.9:1.3)*(sandy?0.6:1)*(floor?0.78:1);
  /* milestone 2: the floor's grain is calmer (it read as sandpaper from the stands) and its tone patchier (damp and dry patches inside the tile) */
  const gam=floor?1.12:1.5, mA=floor?0.66:0.86, mB=floor?0.5:0.28;
  const tex2=(arr,u,v,ch)=>{ const x=u*TW, y=v*TW, x0=Math.floor(x), y0=Math.floor(y), fx=x-x0, fy=y-y0, xa=((x0%TW)+TW)%TW, xb=(xa+1)%TW, ya=((y0%TW)+TW)%TW, yb=(ya+1)%TW;
    return (arr[(ya*TW+xa)*4+ch]*(1-fx)+arr[(ya*TW+xb)*4+ch]*fx)*(1-fy)+(arr[(yb*TW+xa)*4+ch]*(1-fx)+arr[(yb*TW+xb)*4+ch]*fx)*fy; };
  for(let y=0;y<W;y++) for(let x=0;x<W;x++){
    const ti=Math.floor(x/sw), tj=Math.floor(y/sw), d=(ti*5+tj*3+ti*tj*2)%8, sp=d&1, fx=(d>>1)&1, fy=(d>>2)&1, up=(x%sw)/sw, vp=(y%sw)/sw;
    const u0=sp?vp:up, v0=sp?up:vp, u=fx?1-u0:u0, v=fy?1-v0:v0;
    const J00=sp?0:(fx?-1:1), J01=sp?(fx?-1:1):0, J10=sp?(fy?-1:1):0, J11=sp?0:(fy?-1:1);
    const ra=tex2(A,u,v,0)/128, rb=tex2(B,u,v,0)/128, macro=mA+mB*pfbm(x/W*4,y/W*4,4,3), val=clamp(Math.pow(0.5*ra+0.5*rb,gam)*0.92*macro,0.3,1.0)*255, p=(y*W+x)*4;
    c[p]=val; c[p+1]=val*0.985; c[p+2]=val*0.96; c[p+3]=255;
    const sx=((tex2(A,u,v,1)-128)*0.5+(tex2(B,u,v,1)-128)*0.9)/127*g, sy=((tex2(A,u,v,2)-128)*0.5+(tex2(B,u,v,2)-128)*0.9)/127*g;
    const gx=sx*J00+sy*J10, gy=sx*J01+sy*J11, l=Math.sqrt(gx*gx+gy*gy+1);
    n[p]=(0.5-0.5*gx/l)*255; n[p+1]=(0.5-0.5*gy/l)*255; n[p+2]=(0.5+0.5/l)*255; n[p+3]=255; }
  const mt=new THREE.DataTexture(c,W,W,THREE.RGBAFormat), nt=new THREE.DataTexture(n,W,W,THREE.RGBAFormat), an=Math.max(1,Math.min(getAniso(),8));
  mt.colorSpace=THREE.SRGBColorSpace; nt.colorSpace=THREE.NoColorSpace;
  [mt,nt].forEach(t=>{ t.wrapS=t.wrapT=THREE.RepeatWrapping; t.magFilter=THREE.LinearFilter; t.minFilter=THREE.LinearMipmapLinearFilter; t.generateMipmaps=true; t.anisotropy=an; t.needsUpdate=true; });
  return {map:mt,normal:nt};
}
const PADMAPS={};
export function padMaps(sk){ return PADMAPS[sk]||(PADMAPS[sk]=dirtMaps(sk,true,true)); }

/* THE STADIUM FLOOR'S MATERIAL (milestone 2; for r3d-stadium-bowl.js: a REQUEST, the floor is the stadium's mesh). The floor read as uniform orange sandpaper repeating every 7 m from the
   stands: this keeps dirtMaps' map and normal (repeat 7 m) and adds, in world space, a second turned sample of the same grain at 11.3 m (the 7 m tile no longer repeats visibly) and big damp
   and dry patches (a 128 px tileable noise laid at 41 m: damp darker and browner, dry paler and dustier). Lambert on every tier (the floor is mostly far away), two more texture samples.
   floorMaterial(look, lo, rgb) -> a MeshLambertMaterial; rgb = the linear colour the stadium already computes (mix(SOIL[0], SOIL[2], 0.6) x 0.86). */
let PATCHT=null;
function patchTex(){
  if(PATCHT) return PATCHT; const W=128, d=new Uint8Array(W*W*4);
  for(let y=0;y<W;y++) for(let x=0;x<W;x++){ const p=(y*W+x)*4, a=pfbm(x/W*4,y/W*4,4,3), b=pfbm(x/W*6+3.1,y/W*6+1.7,6,2); d[p]=Math.round(clamp(a,0,1)*255); d[p+1]=Math.round(clamp(b,0,1)*255); d[p+2]=128; d[p+3]=255; }
  const t=new THREE.DataTexture(d,W,W,THREE.RGBAFormat); t.colorSpace=THREE.NoColorSpace; t.wrapS=t.wrapT=THREE.RepeatWrapping; t.magFilter=THREE.LinearFilter; t.minFilter=THREE.LinearMipmapLinearFilter; t.generateMipmaps=true; t.needsUpdate=true;
  return PATCHT=t;
}
export function floorMaterial(look,lo,rgb,W,D){
  const fm=dirtMaps(look&&look.soil,!!lo,true); if(W&&D){ fm.map.repeat.set(W/7,D/7); fm.normal.repeat.set(W/7,D/7); }
  const m=new THREE.MeshLambertMaterial({map:fm.map,normalMap:fm.normal,normalScale:new THREE.Vector2(0.8,0.8),color:new THREE.Color().setRGB(rgb[0],rgb[1],rgb[2])});
  const U={uPatch:{value:patchTex()},uFmap:{value:fm.map}};
  m.onBeforeCompile=sh=>{
    Object.assign(sh.uniforms,U);
    sh.vertexShader=sh.vertexShader.replace("#include <common>",`#include <common>
varying vec2 vFxz;`).replace("#include <begin_vertex>",`#include <begin_vertex>
vFxz=(modelMatrix*vec4(transformed,1.0)).xz;`);
    sh.fragmentShader=sh.fragmentShader.replace("#include <common>",`#include <common>
uniform sampler2D uPatch; uniform sampler2D uFmap; varying vec2 vFxz;`)
      .replace("#include <map_fragment>",`#include <map_fragment>
{ vec2 fq=vec2(0.8253*vFxz.x-0.5646*vFxz.y,0.5646*vFxz.x+0.8253*vFxz.y)/11.3;
  vec4 g2=texture2D(uFmap,fq+vec2(0.37,0.11)); diffuseColor.rgb*=mix(1.0,dot(g2.rgb,vec3(0.333))*1.35,0.5);
  vec4 pt=texture2D(uPatch,vFxz/41.0+vec2(0.21,0.63));
  float damp=smoothstep(0.52,0.72,pt.r), dry=smoothstep(0.55,0.75,pt.g)*(1.0-damp);
  float lum=dot(diffuseColor.rgb,vec3(0.3,0.59,0.11));
  diffuseColor.rgb=mix(diffuseColor.rgb,diffuseColor.rgb*vec3(0.66,0.62,0.6),damp*0.85);
  diffuseColor.rgb=mix(diffuseColor.rgb,vec3(lum)*vec3(1.2,1.04,0.86)*1.15,dry*0.4); }`);
  };
  m.customProgramCacheKey=()=>"mx-floor";
  return m;
}

/* ---------------- the soil scans: two tiles as GPU textures (luma detail, slopes, cavity), decoded synchronously ---------------- */
const TILES={};
function makeTile(src,W,chL,chH,gain,aoK){
  const N=W*W, h=new Float32Array(N), t=new Float32Array(N), out=new Uint8Array(N*4);
  for(let k=0;k<N;k++) h[k]=src[k*4+chH]/255;
  /* the cavity: a box blur (radius W/56) minus the height, wrapping */
  const r=Math.max(2,Math.round(W/56)), inv=1/(2*r+1);
  for(let y=0;y<W;y++){ let s=0; for(let q=-r;q<=r;q++) s+=h[y*W+((q+W)%W)]; for(let x=0;x<W;x++){ t[y*W+x]=s*inv; s+=h[y*W+((x+r+1)%W)]-h[y*W+(((x-r)%W+W)%W)]; } }
  const u=new Float32Array(N);
  for(let x=0;x<W;x++){ let s=0; for(let q=-r;q<=r;q++) s+=t[((q+W)%W)*W+x]; for(let y=0;y<W;y++){ u[y*W+x]=s*inv; s+=t[((y+r+1)%W)*W+x]-t[(((y-r)%W+W)%W)*W+x]; } }
  for(let y=0;y<W;y++){ const yu=((y-1+W)%W)*W, yd=((y+1)%W)*W, yc=y*W;
    for(let x=0;x<W;x++){ const xl=(x-1+W)%W, xr=(x+1)%W, k=yc+x, p=k*4;
      const gx=(h[yc+xr]-h[yc+xl])*gain, gy=(h[yd+x]-h[yu+x])*gain, cav=u[k]-h[k];
      out[p]=src[k*4+chL]; out[p+1]=Math.round(clamp(0.5+gx*0.5,0,1)*255); out[p+2]=Math.round(clamp(0.5+gy*0.5,0,1)*255); out[p+3]=Math.round(clamp(1-cav*aoK,0.25,1)*255); } }
  return out;
}
function dataTex(data,w,h,rep,aniso){ const t=new THREE.DataTexture(data,w,h,THREE.RGBAFormat); t.colorSpace=THREE.NoColorSpace; t.wrapS=t.wrapT=rep?THREE.RepeatWrapping:THREE.ClampToEdgeWrapping;
  t.magFilter=THREE.LinearFilter; t.minFilter=THREE.LinearMipmapLinearFilter; t.generateMipmaps=true; t.anisotropy=aniso; t.needsUpdate=true; return t; }
export function soilTiles(lo){
  const key=lo?"lo":"hi"; if(TILES[key]) return TILES[key];
  const png=decodePNG(lo?DIRT_TILES_LO_PNG:DIRT_TILES_PNG), W=png.w, src=png.data;
  const A=makeTile(src,W,0,1,lo?5:9,4.2), B=makeTile(src,W,2,3,lo?6:11,4.0), an=Math.max(1,Math.min(getAniso(),lo?2:8));
  return TILES[key]={A:dataTex(A,W,W,true,an),B:dataTex(B,W,W,true,an),W:W,K:dataTex(clumpTile(lo?128:256),lo?128:256,lo?128:256,true,an)};
}
/* THE CLUMP TILE (milestone 2: the cover's chunky loose dirt). A tileable cellular pattern drawn in code: clods (about 9 cm) with crumbs between them (about 3.5 cm),
   each a lit dome cut off from its neighbours by a dark crack. RGBA8: R = luma (clod tops lighter, cracks darker), G,B = slopes (0.5 = flat), A = cavity (ambient occlusion).
   The shader lays it in world space (0.85 m a tile, turned against the scans) on the loose dirt near the lens. Seeded: the same tile on every device. */
function clumpTile(W){
  const rnd=rngf(4243), N=W*W, h=new Float32Array(N);
  const layer=(cells,amp)=>{ const P=new Float32Array(cells*cells*3); for(let k=0;k<cells*cells;k++){ P[k*3]=0.12+0.76*rnd(); P[k*3+1]=0.12+0.76*rnd(); P[k*3+2]=0.45+0.55*rnd(); }
    for(let y=0;y<W;y++){ const v=y/W*cells, cj=Math.floor(v);
      for(let x=0;x<W;x++){ const u=x/W*cells, ci=Math.floor(u); let d1=9,d2=9,hh=0;
        for(let dj=-1;dj<=1;dj++) for(let di=-1;di<=1;di++){ const ii=((ci+di)%cells+cells)%cells, jj=((cj+dj)%cells+cells)%cells, q=(jj*cells+ii)*3;
          const dx=ci+di+P[q]-u, dy=cj+dj+P[q+1]-v, d=Math.sqrt(dx*dx+dy*dy); if(d<d1){ d2=d1; d1=d; hh=P[q+2]; } else if(d<d2) d2=d; }
        const crack=sstep(0.0,0.22,d2-d1), dome=Math.sqrt(Math.max(0,1-d1*d1*0.9));
        h[y*W+x]+=amp*hh*crack*dome; } } };
  layer(9,1.0); layer(23,0.42);
  let mn=1e9,mx=-1e9; for(let k=0;k<N;k++){ if(h[k]<mn) mn=h[k]; if(h[k]>mx) mx=h[k]; } for(let k=0;k<N;k++) h[k]=(h[k]-mn)/(mx-mn||1);
  /* cavity: a box blur (radius W/40) minus the height, wrapping */
  const r=Math.max(2,Math.round(W/40)), inv=1/(2*r+1), t=new Float32Array(N), b=new Float32Array(N), out=new Uint8Array(N*4);   /* slopes per metre: a tile is 0.85 m, the tallest clod 3.5 cm */
  for(let y=0;y<W;y++){ let s=0; for(let q=-r;q<=r;q++) s+=h[y*W+((q+W)%W)]; for(let x=0;x<W;x++){ t[y*W+x]=s*inv; s+=h[y*W+((x+r+1)%W)]-h[y*W+(((x-r)%W+W)%W)]; } }
  for(let x=0;x<W;x++){ let s=0; for(let q=-r;q<=r;q++) s+=t[((q+W)%W)*W+x]; for(let y=0;y<W;y++){ b[y*W+x]=s*inv; s+=t[((y+r+1)%W)*W+x]-t[(((y-r)%W+W)%W)*W+x]; } }
  for(let y=0;y<W;y++){ const yu=((y-1+W)%W)*W, yd=((y+1)%W)*W, yc=y*W;
    for(let x=0;x<W;x++){ const xl=(x-1+W)%W, xr=(x+1)%W, k=yc+x, p=k*4, gx=(h[yc+xr]-h[yc+xl])*W*0.0206, gy=(h[yd+x]-h[yu+x])*W*0.0206, cav=b[k]-h[k];
      out[p]=Math.round(clamp(0.5+(h[k]-0.45)*0.8,0,1)*255); out[p+1]=Math.round(clamp(0.5+gx*0.5,0,1)*255); out[p+2]=Math.round(clamp(0.5+gy*0.5,0,1)*255); out[p+3]=Math.round(clamp(1-cav*2.6,0.2,1)*255); } }
  return out;
}

/* ---------------- the dirt shader (injected into three's standard / Lambert material) ----------------
   Milestone 2: the colour is worked AFTER the vertex colour (three.js applies vColor after map_fragment: the old saturation trick worked on white); per pixel the moisture rises in
   cavities, on the worn line and in the race's own grooves (darker, more saturated, a sheen the key light catches); dry loose crests turn a paler, dustier tan; near the lens the
   loose dirt is CHUNKY: a cellular clump tile (clods and crumbs, their slopes and cracks) laid in world space at two scales and faded out with distance (it would shimmer);
   the WEAR (uWear.x 0..1, from the race clock: r3d-track.js frame) darkens, packs and polishes where the wheels pass (aTraf) and reveals the wear map's grooves lap by lap. */
/* THE NIGHT'S WEAR (2026-10-19, the CEO: "the track should be perfect, but the ruts get deeper and deeper as the night goes on"): every vertex carries the groomed track (its position,
   its normal, aCol0 = its colour and moisture) and what the racing digs (aRut = the height the ruts, bumps and chop add at a wear of 1, aNw = the normal there, color / aWet = the worn
   colour and moisture); uNight = (m: the ruts' depth, 0.12 at the first heat's gate .. 1.2 at the end of the Main; wN: the worn look's share, 0 .. 1.23; the fine detail's
   strength; the cavities' strength) from the race order and the laps already run (nightFrame below). The normal at a wear m is exact: the height is linear in m, so the
   normal's slope is too. */
const GL_VS_PARS="attribute float aWet;\nattribute float aTraf;\nattribute float aRut;\nattribute vec3 aNw;\nattribute vec4 aCol0;\nuniform vec4 uNight;\nvarying float vWet;\nvarying float vTraf;\nvarying vec2 vTm;\nvarying vec2 vWxz;\n";
const GL_VS_NORMAL="{ vec3 mxN0=objectNormal/max(objectNormal.y,0.05), mxN1=aNw/max(aNw.y,0.05); objectNormal=normalize(mxN0+(mxN1-mxN0)*uNight.x); }\n";
const GL_VS_BODY="transformed.y+=uNight.x*aRut*0.5;\nvWet=clamp(mix(aCol0.a,aWet,min(uNight.y,1.0)),0.0,1.0); vTraf=aTraf; vTm=uv; vWxz=(modelMatrix*vec4(transformed,1.0)).xz;\n";
const GL_VS_COLOR="#ifdef USE_COLOR\nvColor=mix(aCol0.rgb*aCol0.rgb,vColor,min(uNight.y,1.0));\n#endif\n";
const GL_FS_PARS=`uniform sampler2D uTrack; uniform sampler2D uTileA; uniform sampler2D uTileB; uniform sampler2D uClump; uniform sampler2D uWearT;
uniform vec4 uTm; uniform vec3 uSheen; uniform vec4 uTun; uniform vec4 uTun2; uniform vec4 uWear; uniform vec4 uNight;
varying float vWet; varying float vTraf; varying vec2 vTm; varying vec2 vWxz;
vec2 mxRot(vec2 p,float a){ float c=cos(a), s=sin(a); return vec2(c*p.x-s*p.y, s*p.x+c*p.y); }
`;
/* the samples: the scans' luma detail (two scales each, blended by the loose mask), the clump tile, the track-space texture (slopes, cavity, loose mask), the wear map */
const GL_MAP_HI=`vec2 mxUv=vec2(vTm.x*uTm.x,(vTm.y+uTm.y)*uTm.z);
vec4 mxT=texture2D(uTrack,mxUv);
vec4 mxW=texture2D(uWearT,mxUv);
vec2 mxP=vWxz;
vec4 mxA1=texture2D(uTileA,mxP*0.47), mxA2=texture2D(uTileA,mxRot(mxP,0.62)*0.173+vec2(0.31,0.17));
vec4 mxB1=texture2D(uTileB,mxP*0.92), mxB2=texture2D(uTileB,mxRot(mxP,-0.43)*0.31+vec2(0.57,0.23));
vec4 mxK1=texture2D(uClump,mxRot(mxP,0.37)*1.18+vec2(0.13,0.71)), mxK2=texture2D(uClump,mxRot(mxP,-1.13)*0.75+vec2(0.41,0.29));
float mxWr=clamp(uWear.x*vTraf,0.0,1.0);
float mxGv=mxW.a<0.995?smoothstep(mxW.a,mxW.a+0.07,uWear.x):0.0;
float mxLoose=clamp((mxT.a*1.15*(0.45+0.55*min(uNight.y,1.0))+(mxA2.r-0.5)*0.35)*(1.0-0.7*mxWr),0.0,1.0);
float mxDist=length(vViewPosition);
float mxCl=(1.0-smoothstep(5.0,30.0,mxDist))*(0.3+0.7*mxLoose)*(1.0-0.55*mxWr)*uTun2.x;
float mxCl2=(1.0-smoothstep(12.0,60.0,mxDist))*(0.1+0.9*mxLoose)*uTun2.y;
float mxLumA=mxA1.r*1.992*mix(1.0,mxA2.r*1.992,0.6), mxLumB=mxB1.r*1.992*mix(1.0,mxB2.r*1.992,0.6);
float mxLuma=pow(max(mix(mxLumA,mxLumB,mxLoose),0.02),uTun.w)*(1.0+(mxK1.r-0.5)*0.6*mxCl+(mxK2.r-0.5)*0.5*mxCl2);
vec2 mxGd=mix((mxA1.gb-0.5)*2.0+(mxA2.gb-0.5)*1.3,(mxB1.gb-0.5)*2.0+(mxB2.gb-0.5)*1.3,mxLoose)*(1.0-0.4*mxWr);
vec2 mxGk=mxRot((mxK1.gb-0.5)*2.0,-0.37)*mxCl+mxRot((mxK2.gb-0.5)*2.0,1.13)*0.6*mxCl2;
float mxAOd=mix(mxA1.a*mxA2.a,mxB1.a*mxB2.a,mxLoose)*mix(1.0,mxK1.a,mxCl*0.7)*mix(1.0,mxK2.a,mxCl2*0.5);
float mxWx=clamp((1.0-mxT.b)*0.5*uNight.w+mxWr*0.62+mxW.b*mxGv*0.75,0.0,1.0);
float mxWet=clamp(vWet+mxWx,0.0,1.0);
`;
const GL_MAP_LO=`vec2 mxUv=vec2(vTm.x*uTm.x,(vTm.y+uTm.y)*uTm.z);
vec4 mxT=texture2D(uTrack,mxUv);
vec2 mxP=vWxz;
vec4 mxA1=texture2D(uTileA,mxP*0.47), mxB1=texture2D(uTileB,mxP*0.92), mxA2=texture2D(uTileA,mxRot(mxP,0.62)*0.173+vec2(0.31,0.17));
vec4 mxK1=texture2D(uClump,mxRot(mxP,0.37)*1.18+vec2(0.13,0.71));
float mxWr=clamp(uWear.x*vTraf,0.0,1.0);
float mxLoose=clamp(mxT.a*1.15*(0.45+0.55*min(uNight.y,1.0))*(1.0-0.7*mxWr),0.0,1.0);
float mxCl=(1.0-smoothstep(4.0,24.0,length(vViewPosition)))*(0.3+0.7*mxLoose)*(1.0-0.55*mxWr)*uTun2.x;
float mxLuma=pow(max(mix(mxA1.r*1.992,mxB1.r*1.992,mxLoose)*mix(1.0,mxA2.r*1.992,0.5),0.02),uTun.w)*(1.0+(mxK1.r-0.5)*0.9*mxCl);
vec2 mxGd=mix((mxA1.gb-0.5)*2.0,(mxB1.gb-0.5)*2.0,mxLoose)*(1.0-0.4*mxWr)+mxRot((mxK1.gb-0.5)*2.0,-0.37)*mxCl;
float mxAOd=mix(mxA1.a,mxB1.a,mxLoose)*mix(1.0,mxK1.a,mxCl);
float mxWx=clamp((1.0-mxT.b)*0.5*uNight.w+mxWr*0.62,0.0,1.0);
float mxWet=clamp(vWet+mxWx,0.0,1.0);
`;
/* the colour, after the vertex colour (the soil family by moisture): the scans' grain and the clumps, the per-pixel extra moisture, the dusty dry crust */
const GL_COLOR_HI=`{ vec3 mxCol=diffuseColor.rgb*clamp(mxLuma,0.3,1.7);
  float mxL=dot(mxCol,vec3(0.3,0.59,0.11));
  mxCol=max(mix(vec3(mxL),mxCol,1.0+0.15*mxWx),0.0)*mix(1.0,0.5,mxWx);
  diffuseColor.rgb=mxCol; }
`;
const GL_COLOR_LO=`diffuseColor.rgb*=clamp(mxLuma,0.3,1.7)*mix(1.0,0.48,mxWx);
`;
const GL_NORMAL_HI=`{
  vec3 q0=dFdx(-vViewPosition), q1=dFdy(-vViewPosition); vec2 st0=dFdx(vTm), st1=dFdy(vTm);
  vec3 q1p=cross(q1,normal), q0p=cross(normal,q0);
  vec3 mxTa=q1p*st0.x+q0p*st1.x, mxBi=q1p*st0.y+q0p*st1.y;
  float det=max(dot(mxTa,mxTa),dot(mxBi,mxBi)); float sc=(det==0.0)?0.0:inversesqrt(det); mxTa*=sc; mxBi*=sc;
  vec2 gs=(mxT.rg*2.0-1.0)*uTun.x*(1.0-0.35*mxWr)*uNight.z+(mxW.rg*2.0-1.0)*uTun.x*mxGv;
  normal=normalize(normal-mxTa*gs.x-mxBi*gs.y);
  normal=normalize(normal-mat3(viewMatrix)*vec3(mxGd.x*uTun.y+mxGk.x*uTun2.z,0.0,mxGd.y*uTun.y+mxGk.y*uTun2.z));
}
`;
const GL_NORMAL_LO=`{
  vec3 q0=dFdx(-vViewPosition), q1=dFdy(-vViewPosition); vec2 st0=dFdx(vTm), st1=dFdy(vTm);
  vec3 q1p=cross(q1,normal), q0p=cross(normal,q0);
  vec3 mxTa=q1p*st0.x+q0p*st1.x, mxBi=q1p*st0.y+q0p*st1.y;
  float det=max(dot(mxTa,mxTa),dot(mxBi,mxBi)); float sc=(det==0.0)?0.0:inversesqrt(det); mxTa*=sc; mxBi*=sc;
  vec2 gs=(mxT.rg*2.0-1.0)*uTun.x*(1.0-0.35*mxWr)*uNight.z;
  normal=normalize(normal-mxTa*gs.x-mxBi*gs.y);
  normal=normalize(normal-mat3(viewMatrix)*vec3(mxGd.x,0.0,mxGd.y)*uTun.y);
}
`;
const GL_NORMAL_PRE="vec3 mxNg=normal;\n";
/* the light: cavities and cracks occlude; wet dirt catches the key light's highlight (the direct specular rises with the moisture) and glistens at a grazing angle */
const GL_AO_HI=`float mxAO=clamp(mix(1.0,mxT.b,uNight.w)*mxAOd,0.0,1.0);
reflectedLight.indirectDiffuse*=mxAO*mxAO;
reflectedLight.directDiffuse*=mix(1.0,mxAO,0.9);
float mxWs=smoothstep(0.4,0.92,mxWet);
reflectedLight.directSpecular*=mix(0.12,0.5,mxWs)*mix(1.0,mxAO,0.9)*vec3(1.0,0.8,0.55);   /* the wet rut walls caught the key light as a thin white line (a1-a5 captures): a warm, softer glint */
reflectedLight.indirectSpecular*=mix(0.18,0.7,mxWs)*mxAO*vec3(1.0,0.84,0.62);   /* dry powdery dirt barely mirrors the floodlit environment: at a grazing angle the rut walls and lips read as a white ribbon (a2 captures) */
float mxFr=pow(1.0-clamp(dot(mxNg,normalize(vViewPosition)),0.0,1.0),5.0);
reflectedLight.indirectSpecular+=uSheen*(mxFr*mxWs*uTun.z*mxAO);
`;
const GL_AO_LO=`float mxAO=clamp(mix(1.0,mxT.b,uNight.w)*mxAOd,0.0,1.0);
reflectedLight.indirectDiffuse*=mxAO*mxAO;
reflectedLight.directDiffuse*=mix(1.0,mxAO,0.9);
`;
const GL_ROUGH=`float roughnessFactor=clamp(mix(0.97,0.62,mxWet*mxWet)-0.08*mxWr,0.5,1.0);\n`;

/* a neutral wear map (no grooves) for the start strip */
let NOWEAR=null;
function noWear(){ if(NOWEAR) return NOWEAR; const t=new THREE.DataTexture(new Uint8Array([128,128,0,255]),1,1,THREE.RGBAFormat); t.colorSpace=THREE.NoColorSpace; t.needsUpdate=true; return NOWEAR=t; }

/* the material of one strip of dirt. tier "hi": physically based; "lo" (Reduce effects, the TV): Lambert, fewer samples. */
function dirtMaterial(tier,tiles,sheen){
  const hi=tier==="hi";
  const m=hi?new THREE.MeshStandardMaterial({color:0xffffff,roughness:0.95,metalness:0,vertexColors:true,side:THREE.DoubleSide})
            :new THREE.MeshLambertMaterial({color:0xffffff,vertexColors:true,side:THREE.DoubleSide});
  const U={uTrack:{value:null},uTileA:{value:tiles.A},uTileB:{value:tiles.B},uClump:{value:tiles.K},uWearT:{value:noWear()},uTm:{value:new THREE.Vector4(1/500,4,0.125,1)},uSheen:{value:new THREE.Color(sheen)},
    uTun:{value:new THREE.Vector4(hi?1.5:1.2,hi?1.15:0.9,0.22,hi?1.35:1.2)},uTun2:{value:new THREE.Vector4(1,hi?1:0,1,0)},uWear:{value:new THREE.Vector4(0,0,0,0)},uNight:{value:new THREE.Vector4(1,1,1,1)}};
  m.userData.mx=U;
  m.onBeforeCompile=sh=>{
    Object.assign(sh.uniforms,U);
    sh.vertexShader=sh.vertexShader.replace("#include <common>","#include <common>\n"+GL_VS_PARS).replace("#include <beginnormal_vertex>","#include <beginnormal_vertex>\n"+GL_VS_NORMAL)
      .replace("#include <begin_vertex>","#include <begin_vertex>\n"+GL_VS_BODY).replace("#include <color_vertex>","#include <color_vertex>\n"+GL_VS_COLOR);
    let f=sh.fragmentShader.replace("#include <common>","#include <common>\n"+GL_FS_PARS).replace("#include <map_fragment>",hi?GL_MAP_HI:GL_MAP_LO)
      .replace("#include <color_fragment>","#include <color_fragment>\n"+(hi?GL_COLOR_HI:GL_COLOR_LO))
      .replace("#include <normal_fragment_maps>",GL_NORMAL_PRE+(hi?GL_NORMAL_HI:GL_NORMAL_LO))
      .replace("#include <aomap_fragment>",hi?GL_AO_HI:GL_AO_LO);
    if(hi) f=f.replace("#include <roughnessmap_fragment>",GL_ROUGH);
    sh.fragmentShader=f;
  };
  m.customProgramCacheKey=()=>"mx-dirt3-"+tier;
  return m;
}
/* the track-space texture (slopes of the fine detail, cavity, loose mask) from the relief */
function trackTexture(fine,rep){ const t=new THREE.DataTexture(fine.data,fine.nt,fine.nv,THREE.RGBAFormat); t.colorSpace=THREE.NoColorSpace; t.wrapS=rep?THREE.RepeatWrapping:THREE.ClampToEdgeWrapping; t.wrapT=THREE.ClampToEdgeWrapping;
  t.magFilter=THREE.LinearFilter; t.minFilter=THREE.LinearMipmapLinearFilter; t.generateMipmaps=true; t.anisotropy=Math.max(1,Math.min(getAniso(),8)); t.needsUpdate=true; return t; }

/* ---------------- the ground the wheels follow ---------------- */
/* Course.ground() is wrapped once: for a course whose relief was registered (addTrack), it returns the dirt as it is DRAWN (ground + the relief's smooth part) */
const PATCH={orig:null,map:new WeakMap()};
function installGround(C,Rl){
  const Co=CO(); if(!PATCH.orig||Co.ground!==PATCH.wrapped){ PATCH.orig=Co.ground===PATCH.wrapped?PATCH.orig:Co.ground;
    PATCH.wrapped=function(Cc,s,lat){ const y=PATCH.orig(Cc,s,lat), R=PATCH.map.get(Cc); return R?y+R.delta(s,lat):y; }; Co.ground=PATCH.wrapped; }
  PATCH.map.set(C,Rl);
}

/* ---------------- the track ribbon: a global grid, then chunks ---------------- */
function trackBuild(C,look,q,tier,tiles){
  const Co=CO(), hi=tier==="hi", S=TRK[look.soil]||TRK["stadium-dirt"], lite=lin(S[0]), base=lin(S[1]), dark=lin(S[2]), deep=lin(S[3]), sandc=lin(SOIL.sand[1]), grassEdge=lin("#4f6b33");
  const outdoor=C.kind!=="stadium", long=C.L>800;
  /* milestone 2: 61 columns on the near level (0.125 m across a 7.5 m track: a 20-28 cm rut is five to six vertices wide, not a crease); the TV's single mesh keeps 21 columns, so its ruts are
     drawn at 65% of the depth (a V that deep would read as a fold; the fine map's shading carries the rest) */
  const R=buildRelief(C,{ds:hi?(long?0.5:0.25):(long?1.0:0.5),nl:hi?(long?41:61):21,rut:hi?1:0.65});
  installGround(C,R);
  R.m=0;   /* (the night's wear: the mesh is built GROOMED (positions, normals, colours) with what the racing digs beside it (PW, CR / WT: the worn colours); trackMesh sets it back) */
  const ns=R.ns, nl=R.nl, SH=[1.35,1.85], U=[-SH[1],-SH[0]], nc=nl+4;
  for(let j=0;j<nl;j++) U.push(-1+2*j/(nl-1)); U.push(SH[0],SH[1]);
  const PX=new Float32Array((ns+1)*nc), PY=new Float32Array((ns+1)*nc), PZ=new Float32Array((ns+1)*nc), CR=new Float32Array((ns+1)*nc*3), WT=new Float32Array((ns+1)*nc), TF=new Float32Array((ns+1)*nc), UVs=new Float32Array((ns+1)*nc), UVl=new Float32Array((ns+1)*nc);
  const PW=new Float32Array((ns+1)*nc), CR0=new Float32Array((ns+1)*nc*3), WT0=new Float32Array((ns+1)*nc);
  const o={}, o2={}, prevX=new Float64Array(nc), prevZ=new Float64Array(nc);
  for(let i=0;i<=ns;i++){
    const s=i*R.ds, ss=i===ns?0:s, f=Co.frame(C,ss,o), hw=f.hw, nx=-Math.sin(f.th), nz=Math.cos(f.th), ii=Math.round(ss/C.ds)%C.N, sand=C.sand[ii]||0;
    const kk=Math.max(Math.abs(f.k),Math.abs(Co.frame(C,ss-1.5,o2).k),Math.abs(Co.frame(C,ss+1.5,o2).k)), Rk=1/Math.max(1e-4,kk), inSide=f.k>0?1:-1, lim=0.8*Rk, knee=0.55*lim;
    const Fh=C.F[ii]||0, Fs=Math.abs((C.F[(ii+1)%C.N]||0)-(C.F[(ii-1+C.N)%C.N]||0))/(2*C.ds);
    const sideW=[2.6,2.6];
    if(outdoor) [-1,1].forEach((sd,m)=>{ const eh=Co.ground(C,ss,sd*hw)-f.y; if(eh<0.45) return; let w=2.6*(1+Math.min(eh,4)*0.55);
      const room=roomBeside(C,f.x+nx*sd*hw,f.z+nz*sd*hw,ss,30); w=Math.max(2.6,Math.min(w,room-1.5)); sideW[m]=w; });
    for(let c=0;c<nc;c++){
      const u=U[c], a=Math.abs(u); let lat=a<=1?u*hw:Math.sign(u)*(hw+(a-1)*sideW[u<0?0:1]);
      if(Math.sign(lat)===inSide&&Math.abs(lat)>knee){ const xx=Math.abs(lat); lat=inSide*(knee+(lim-knee)*Math.tanh((xx-knee)/Math.max(0.01,lim-knee))); }   /* the inside of a tight turn is squeezed, never folded */
      let y;
      if(a<=1) y=Co.ground(C,ss,lat);                                                                 /* (the wrapped ground: the dirt as drawn) */
      else { const edge=Co.ground(C,ss,Math.sign(u)*hw); y=edge+(f.y-(outdoor?0.55:0.3)-edge)*sstep(0,1,(a-1)/0.85); }   /* the shoulder dips under the ground at its outer edge */
      let vx=f.x+nx*lat, vz=f.z+nz*lat;
      if(i>0&&i<ns){ const al=(vx-prevX[c])*Math.cos(f.th)+(vz-prevZ[c])*Math.sin(f.th); if(al<0.02){ vx+=Math.cos(f.th)*(0.02-al); vz+=Math.sin(f.th)*(0.02-al); } }
      prevX[c]=vx; prevZ[c]=vz;
      const k=i*nc+c; PX[k]=vx; PY[k]=y; PZ[k]=vz; UVs[k]=ss; UVl[k]=lat;
      /* colour: moisture sets the tone (dry pale crests and edges, dark packed ruts and racing line), the slow drift breaks up the lanes; berm faces packed, sand pale, the shoulders grass outdoors.
         Twice: the worn track's (CR, WT: the moisture of the racing's ruts and lips) and the groomed track's (CR0, WT0); the shader blends them by the night's wear */
      const inner=a<=1, latc=clamp(lat,-R.LATR+0.001,R.LATR-0.001), tone=R.at(R.tone,ss,latc)/255;
      const bermFace=a>0.55&&a<=1?C.bank[ii]/2:0;
      const hs=Fh>0.05?clamp(0.9+0.2*clamp(Fh/1.4,0,1)-0.14*clamp(Fs,0,1),0.7,1.12):1;   /* the tops of whoops, mounds and jumps catch the light, the steep faces are darker */
      for(let v2=0;v2<2;v2++){ const MA=v2?R.moist0:R.moist, CA=v2?CR0:CR, WA=v2?WT0:WT;
        let w=inner?R.at(MA,ss,latc)/255:R.at(MA,ss,Math.sign(lat)*(R.LATR-0.01))/255*0.6;
        /* the soil family by moisture (milestone 2): dry tan -> mid brown -> wet dark brown -> the deep wet of a rut's bottom */
        let col=mixc(mixc(mixc(lite,base,sstep(0.06,0.32,w)),dark,sstep(0.42,0.78,w)),deep,sstep(0.84,1.0,w));
        col=mixc(col,dark,bermFace*0.18);
        const tn=(0.84+0.32*tone)*hs; col=[col[0]*tn,col[1]*tn,col[2]*tn];
        if(sand>0) col=mixc(col,sandc,sand*0.85);
        if(!inner){ const hAbove=y-(f.y-0.55);
          col=outdoor?mixc(mixc(base,lite,0.3),grassEdge,sstep(1.05,1.8,a)*(1-sstep(0.35,1.1,hAbove))):mixc(mixc(base,dark,0.4),dark.map(v=>v*0.78),sstep(1.0,1.85,a)); w=0.25; }
        CA[k*3]=col[0]; CA[k*3+1]=col[1]; CA[k*3+2]=col[2]; WA[k]=sand>0.3?w*0.4:w; }
      TF[k]=inner?R.at(R.traf,ss,latc)/255:0; PW[k]=inner?R.wearAt(ss,lat):0;
    }
  }
  return {R,PX,PY,PZ,CR,WT,TF,UVs,UVl,nc,ns,U,Co,PW,CR0,WT0};
}

/* one mesh from a list of grid rows (ascending; any spacing), columns every sc (the shoulders always), positions relative to (cx, cy, cz); skirts hide the cracks between levels of detail */
function gridMesh(G,rowList,sc,cx,cy,cz,skirts,mat){
  const {R,PX,PY,PZ,CR,WT,TF,UVs,UVl,nc,ns,PW,CR0,WT0}=G, nl=R.nl, r0=rowList[0], r1=rowList[rowList.length-1];
  const cols=[0,1]; for(let j=0;j<nl;j+=sc) cols.push(2+j); if((nl-1)%sc) cols.push(2+nl-1); cols.push(nc-2,nc-1);
  const nr=rowList.length, ncc=cols.length, nv=nr*ncc+(skirts?2*ncc:0);
  /* (milestone 2: normals as normalized bytes, moisture and traffic as bytes: 37 bytes a vertex instead of 52; the near level has half as many vertices again as milestone 1's) */
  const pos=new Float32Array(nv*3), nor=new Int8Array(nv*3), col=new Float32Array(nv*3), wet=new Uint8Array(nv), trf=new Uint8Array(nv), uv=new Float32Array(nv*2);
  /* (the night's wear: + 9 bytes a vertex: the wear's height (16 bits over +-0.5 m), its normal (bytes), the groomed colour (bytes of its square root: fine in the darks) and moisture) */
  const rut=new Int16Array(nv), nw=new Int8Array(nv*3), c0=new Uint8Array(nv*4);
  const at=(r,c)=>{ if(r>=ns) return (r===ns?ns:r-ns)*nc+c; if(r<0) return (r+ns)*nc+c; return r*nc+c; };
  let v=0;
  for(let ri=0;ri<nr;ri++){ const r=rowList[ri], rp=ri>0?rowList[ri-1]:r-(rowList[Math.min(1,nr-1)]-r||1), rn=ri<nr-1?rowList[ri+1]:r+(r-(ri>0?rowList[ri-1]:r-1));
    for(let ci=0;ci<ncc;ci++){ const c=cols[ci], k=at(r,c);
      const cm=cols[Math.max(0,ci-1)], cp=cols[Math.min(ncc-1,ci+1)], kl=at(r,cm), kr=at(r,cp), ku=at(rp,c), kd=at(rn,c);
      for(let q=0;q<2;q++){   /* the groomed surface's normal, then the worn one's (the heights plus the wear at 1) */
        const ax=PX[kr]-PX[kl], ay=PY[kr]-PY[kl]+(q?PW[kr]-PW[kl]:0), az=PZ[kr]-PZ[kl], bx=PX[kd]-PX[ku], by=PY[kd]-PY[ku]+(q?PW[kd]-PW[ku]:0), bz=PZ[kd]-PZ[ku];
        /* lateral x along-the-track: up (the lap runs along +s, lat to the right) */
        let nx=ay*bz-az*by, ny=az*bx-ax*bz, nz=ax*by-ay*bx; const ln=Math.hypot(nx,ny,nz)||1; nx/=ln; ny/=ln; nz/=ln; if(ny<0){ nx=-nx; ny=-ny; nz=-nz; }
        const N=q?nw:nor; N[v*3]=Math.round(nx*127); N[v*3+1]=Math.round(ny*127); N[v*3+2]=Math.round(nz*127); }
      pos[v*3]=PX[k]-cx; pos[v*3+1]=PY[k]-cy; pos[v*3+2]=PZ[k]-cz; rut[v]=Math.round(clamp(PW[k]/0.5,-1,1)*32767);
      col[v*3]=CR[k*3]; col[v*3+1]=CR[k*3+1]; col[v*3+2]=CR[k*3+2]; wet[v]=Math.round(clamp(WT[k],0,1)*255); trf[v]=Math.round(clamp(TF[k],0,1)*255); uv[v*2]=UVs[k]; uv[v*2+1]=UVl[k];
      c0[v*4]=Math.round(Math.sqrt(clamp(CR0[k*3],0,1))*255); c0[v*4+1]=Math.round(Math.sqrt(clamp(CR0[k*3+1],0,1))*255); c0[v*4+2]=Math.round(Math.sqrt(clamp(CR0[k*3+2],0,1))*255); c0[v*4+3]=Math.round(clamp(WT0[k],0,1)*255); v++; } }
  /* the loop's last row is the first row again: its s runs on to L so the texture coordinate is continuous */
  if(r1>=ns){ for(let ri=0;ri<nr;ri++){ const r=rowList[ri]; if(r>=ns){ for(let ci=0;ci<ncc;ci++) uv[(ri*ncc+ci)*2]=R.L+(r-ns)*R.ds; } } }
  const I=[]; for(let ri=0;ri<nr-1;ri++) for(let ci=0;ci<ncc-1;ci++){ const a=ri*ncc+ci, b=a+1, c2=a+ncc, d=c2+1; I.push(a,b,c2,b,d,c2); }
  if(skirts){ /* a skirt under the first and the last row: a strip dropped 0.16 m */
    [0,nr-1].forEach((ri,m)=>{ const base0=nr*ncc+m*ncc; for(let ci=0;ci<ncc;ci++){ const s0=(ri*ncc+ci), d=base0+ci; pos[d*3]=pos[s0*3]; pos[d*3+1]=pos[s0*3+1]-0.16; pos[d*3+2]=pos[s0*3+2]; nor[d*3]=nor[s0*3]; nor[d*3+1]=nor[s0*3+1]; nor[d*3+2]=nor[s0*3+2];
      col[d*3]=col[s0*3]; col[d*3+1]=col[s0*3+1]; col[d*3+2]=col[s0*3+2]; wet[d]=wet[s0]; trf[d]=trf[s0]; uv[d*2]=uv[s0*2]; uv[d*2+1]=uv[s0*2+1];
      rut[d]=rut[s0]; nw[d*3]=nw[s0*3]; nw[d*3+1]=nw[s0*3+1]; nw[d*3+2]=nw[s0*3+2]; for(let q=0;q<4;q++) c0[d*4+q]=c0[s0*4+q]; }
      for(let ci=0;ci<ncc-1;ci++){ const t0=ri*ncc+ci, t1=t0+1, b0=base0+ci, b1=b0+1; I.push(t0,b0,t1,t1,b0,b1); } });
  }
  const g=new THREE.BufferGeometry(); g.setAttribute("position",new THREE.BufferAttribute(pos,3)); g.setAttribute("normal",new THREE.BufferAttribute(nor,3,true)); g.setAttribute("color",new THREE.BufferAttribute(col,3));
  g.setAttribute("aWet",new THREE.BufferAttribute(wet,1,true)); g.setAttribute("aTraf",new THREE.BufferAttribute(trf,1,true)); g.setAttribute("uv",new THREE.BufferAttribute(uv,2)); g.setIndex(nv>65000?new THREE.BufferAttribute(new Uint32Array(I),1):new THREE.BufferAttribute(new Uint16Array(I),1));
  g.setAttribute("aRut",new THREE.BufferAttribute(rut,1,true)); g.setAttribute("aNw",new THREE.BufferAttribute(nw,3,true)); g.setAttribute("aCol0",new THREE.BufferAttribute(c0,4,true));
  g.computeBoundingSphere(); if(g.boundingSphere) g.boundingSphere.radius+=0.5;   /* (the ruts move the surface up to about 0.35 m at the night's deepest: the culling sphere allows for it) */
  const m=new THREE.Mesh(g,mat); m.receiveShadow=true; m.position.set(cx,cy,cz); return m;
}

const RT=()=>+new Date();   /* the real clock: the capture harness virtualizes performance.now and Date.now */

/* ---------------- CLODS resting on the dirt (milestone 2: the cover's chunky loose dirt, as real lit geometry near the lens) ----------------
   One instanced mesh per near chunk (a child of the chunk's finest level of detail, so it is drawn only within 40 m of the lens; HIGH and ULTRA only): clods of 2.5-11 cm
   (log-normal, a few big ones on the lips), many where the relief's loose grid says the dirt was pushed up (rut lips, the berm's lip, the windrows, the dry edges), few on the packed line.
   Each sits on the dirt as drawn (Course.ground, wrapped: the relief), sunk by a third of its height, turned and tilted at random, in the dry / mid soil colours (lit tops).
   Seeded per chunk: the same clods on every device and in every capture. A clod is a jittered icosahedron (20 triangles); they receive the key's shadow, they cast none. */
let CLODGEO=null;
function clodGeo(){
  if(CLODGEO) return CLODGEO;
  const g=new THREE.IcosahedronGeometry(1,0), P=g.attributes.position, r=rngf(9137), seen=new Map();
  for(let i=0;i<P.count;i++){ const key=P.getX(i).toFixed(3)+","+P.getY(i).toFixed(3)+","+P.getZ(i).toFixed(3); let k=seen.get(key); if(k==null){ k=0.72+0.5*r(); seen.set(key,k); }
    P.setXYZ(i,P.getX(i)*k,P.getY(i)*k*0.78,P.getZ(i)*k); }
  g.computeVertexNormals(); return CLODGEO=g;
}
function clodsFor(G,C,r0,r1,cx,cy,cz,mat,look){
  const {R}=G, Co=G.Co, rnd=rngf(7001+r0*13), S=TRK[look.soil]||TRK["stadium-dirt"], lite=lin(S[0]), base=lin(S[1]), list=[], o={}, o2={};
  for(let r=r0;r<r1;r+=2){
    const s=(r+0.5)*R.ds, f=Co.frame(C,s,o), hw=f.hw, nx=-Math.sin(f.th), nz=Math.cos(f.th), rr=R.rows, ri=Math.min(rr.n-1,Math.floor(s/rr.ds)), roost=clamp(rr.accel[ri]*1.2+rr.A[ri]*0.5,0,1);   /* the roost lands round the line out of a corner */
    const kk=Math.max(Math.abs(f.k),Math.abs(Co.frame(C,s-1.5,o2).k),Math.abs(Co.frame(C,s+1.5,o2).k)), Rk=1/Math.max(1e-4,kk), inSide=f.k>0?1:-1, knee=0.55*0.8*Rk;
    for(let t=0;t<14;t++){
      const lat=(rnd()*2-1)*(hw-0.12), latc=clamp(lat,-R.LATR+0.001,R.LATR-0.001);
      if(Math.sign(lat)===inSide&&Math.abs(lat)>knee*0.95) continue;   /* the inside of a tight turn is squeezed in the mesh: no clods there */
      const lo=R.at(R.loose,s,latc)/255, tr=R.at(R.traf,s,latc)/255, p=Math.min(1,Math.min(1,0.07+1.2*lo*Math.sqrt(lo))*(1-0.85*tr)+0.45*roost*(1-0.45*tr));
      if(rnd()>p) continue;
      const big=rnd()<0.06+0.12*lo, sz=big?0.06+0.05*rnd():0.022+0.03*Math.pow(rnd(),1.6), ds2=(rnd()-0.5)*R.ds*2;
      const x=f.x+nx*lat+Math.cos(f.th)*ds2, z=f.z+nz*lat+Math.sin(f.th)*ds2, y=Co.ground(C,s+ds2,lat)+sz*0.78*0.42;
      const tone=0.78+0.4*rnd(), c=mixc(lite,base,0.35+0.5*rnd()); list.push([x-cx,y-cy,z-cz,sz,rnd()*6.283,(rnd()-0.5)*0.6,(rnd()-0.5)*0.6,c[0]*tone,c[1]*tone,c[2]*tone,R.wearAt(s+ds2,lat)]);   /* (the last: the wear under it: the clod rides the night's dirt) */
    }
  }
  if(!list.length) return null;
  /* (the night's wear: a geometry per chunk sharing the clod's buffers, with two numbers per clod: the height the wear moves the dirt under it (aRutI) and the wear it appears at
     (aThr): a groomed track has a few clods (the crew's blade leaves some), the racing throws the rest up, race by race) */
  const cg=clodGeo(), geo=new THREE.BufferGeometry(); for(const k in cg.attributes) geo.setAttribute(k,cg.attributes[k]); if(cg.index) geo.setIndex(cg.index);
  const rutI=new Float32Array(list.length), thr=new Float32Array(list.length); list.forEach((a,i)=>{ rutI[i]=a[10]; thr[i]=((i*0.6180339+0.13)%1)*1.15-0.2; });
  geo.setAttribute("aRutI",new THREE.InstancedBufferAttribute(rutI,1)); geo.setAttribute("aThr",new THREE.InstancedBufferAttribute(thr,1));
  const m=new THREE.InstancedMesh(geo,mat,list.length), M=new THREE.Matrix4(), Q=new THREE.Quaternion(), E=new THREE.Euler(), V=new THREE.Vector3(), Sc=new THREE.Vector3(), cl=new THREE.Color();
  list.forEach((a,i)=>{ E.set(a[5],a[4],a[6]); Q.setFromEuler(E); V.set(a[0],a[1],a[2]); Sc.set(a[3]*(0.8+0.4*((i*0.618)%1)),a[3],a[3]*(0.8+0.4*((i*0.382)%1))); M.compose(V,Q,Sc); m.setMatrixAt(i,M); cl.setRGB(a[7],a[8],a[9]); m.setColorAt(i,cl); });
  m.instanceMatrix.needsUpdate=true; if(m.instanceColor) m.instanceColor.needsUpdate=true; m.receiveShadow=true; m.castShadow=false; m.computeBoundingSphere(); if(m.boundingSphere) m.boundingSphere.radius+=0.5; m.userData.mxClods=list.length;
  return m;
}
/* the clods' material follows the night's wear: each clod rides the dirt under it (aRutI x the wear's depth, added after its own turn and size) and appears once the wear passes
   its own threshold (aThr), growing from nothing over 0.15 of the wear */
const CLOD_PROJ="vec4 mvPosition=vec4(transformed,1.0);\n#ifdef USE_INSTANCING\nmvPosition=instanceMatrix*mvPosition;\n#endif\nmvPosition.y+=uNight.x*aRutI;\nmvPosition=modelViewMatrix*mvPosition;\ngl_Position=projectionMatrix*mvPosition;\n";
const CLOD_WPOS="#if defined( USE_ENVMAP ) || defined( DISTANCE ) || defined ( USE_SHADOWMAP ) || defined ( USE_TRANSMISSION ) || NUM_SPOT_LIGHT_COORDS > 0\nvec4 worldPosition=vec4(transformed,1.0);\n#ifdef USE_INSTANCING\nworldPosition=instanceMatrix*worldPosition;\n#endif\nworldPosition.y+=uNight.x*aRutI;\nworldPosition=modelMatrix*worldPosition;\n#endif\n";
function clodNight(m){
  const U={uNight:{value:new THREE.Vector4(1,1,1,1)}}; m.userData.mx=U;
  m.onBeforeCompile=sh=>{ Object.assign(sh.uniforms,U);
    sh.vertexShader=sh.vertexShader.replace("#include <common>","#include <common>\nattribute float aRutI;\nattribute float aThr;\nuniform vec4 uNight;\n")
      .replace("#include <begin_vertex>","#include <begin_vertex>\ntransformed*=smoothstep(aThr,aThr+0.15,uNight.y);\n").replace("#include <project_vertex>",CLOD_PROJ).replace("#include <worldpos_vertex>",CLOD_WPOS); };
  m.customProgramCacheKey=()=>"mx-clod-night";
}
function trackMesh(C,look,q,mat,tier,tiles){
  const t0=RT(), G=trackBuild(C,look,q,tier,tiles), {R}=G, hi=tier==="hi", root=new THREE.Group(), t1=RT();
  let clodMat=null;   /* (the clods' material: the night frame drives it too) */
  const fine=R.fine(hi?(C.L>800?8192:4096):2048,hi?128:64), track=trackTexture(fine,true), t2=RT();
  const U=mat.userData.mx; U.uTrack.value=track; U.uTm.value.set(1/R.L,R.LATR,1/(2*R.LATR),1);
  /* milestone 2: the wear map (the race's own grooves, revealed lap by lap) at the fine map's length and twice its width (a tyre groove is 11-15 cm wide); HIGH and up only */
  let wearT=null; if(hi){ const wm=R.wear(fine.nt,C.L>800?128:256); wearT=trackTexture(wm,true); U.uWearT.value=wearT; }
  const info={tris:0,chunks:0,gridMs:t1-t0,fineMs:t2-t1,wearMs:RT()-t2,fineTexels:fine.nt*fine.nv,gridVerts:R.ns*G.nc};
  if(hi){
    const td=clamp(q&&q.terrainDetail!=null?q.terrainDetail:1,0.5,1.2), nCh=Math.max(1,Math.round(R.L/48)), nsq=R.ns/4;
    /* the clods: HIGH and ULTRA (rank 2+; a build without a rank, e.g. a test, gets them too); BALANCED keeps its call budget */
    /* (the clods barely mirror the floodlit environment: at a grazing angle toward the lights a lip of clods read as a white ribbon in the captures, envMapIntensity 1 -> 0.1) */
    clodMat=(q&&q.rank!=null&&q.rank<2)?null:new THREE.MeshStandardMaterial({color:0xffffff,roughness:1,metalness:0,envMapIntensity:0.1}); if(clodMat){ clodMat.userData.keepEnv=true; clodNight(clodMat); } info.clods=0;
    for(let c=0;c<nCh;c++){ const r0=4*Math.round(c*nsq/nCh), r1=c===nCh-1?R.ns:4*Math.round((c+1)*nsq/nCh); if(r1<=r0) continue;
      const mid=Math.round((r0+r1)/2), k=Math.min(mid,R.ns-1)*G.nc+Math.floor(G.nc/2), cx=G.PX[k], cy=G.PY[k], cz=G.PZ[k];
      const lod=new THREE.LOD(); lod.position.set(cx,cy,cz);
      const seq=st=>{ const a=[]; for(let r=r0;r<=r1;r+=st) a.push(r); if(a[a.length-1]!==r1) a.push(r1); return a; };
      const m0=gridMesh(G,seq(1),1,cx,cy,cz,true,mat), m1=gridMesh(G,seq(2),2,cx,cy,cz,true,mat), m2=gridMesh(G,seq(4),4,cx,cy,cz,true,mat);
      [m0,m1,m2].forEach(m=>{ m.position.set(0,0,0); });
      /* the clods only where they can be seen (a chunk within 24 m: the a6 captures paid up to 5 clod meshes, +83k triangles, at the whoops camera); 24-36 m the same fine mesh without them */
      let near=m0, m0b=null;
      if(clodMat){ const cm=clodsFor(G,C,r0,r1,cx,cy,cz,clodMat,look); if(cm){ near=new THREE.Group(); near.add(m0); near.add(cm); info.clods+=cm.count; m0b=new THREE.Mesh(m0.geometry,mat); m0b.receiveShadow=true; } }
      lod.addLevel(near,0); if(m0b) lod.addLevel(m0b,24*td); lod.addLevel(m1,36*td); lod.addLevel(m2,100*td);   /* (polish, D6: the tier's terrain detail scales the levels' distances: BALANCED 0.8 = 35 m / 80 m) */
      root.add(lod); info.chunks++; info.tris+=m0.geometry.index.count/3;
    }
  } else {
    /* Reduce effects / the TV: ONE mesh, rows every 0.5 m where the dirt is shaped along the lap (a jump, whoops, sand) and every 1 m elsewhere (ruts and berms vary slowly along it) */
    const rw=R.rows, shaped=i=>{ i=((i%R.ns)+R.ns)%R.ns; return rw.F[i]>0.004||rw.sand[i]>0.01||rw.whoop[i]>0; };
    const list=[0]; for(let i=1;i<R.ns;i++){ if(i%2===0||shaped(i)||shaped(i-1)||shaped(i+1)||shaped(i+2)) list.push(i); } list.push(R.ns);
    const m=gridMesh(G,list,1,0,0,0,false,mat); root.add(m); info.chunks=1; info.tris=m.geometry.index.count/3;
  }
  root.traverse(o=>{ if(o.isMesh) o.geometry.addEventListener("dispose",()=>{ track.dispose(); if(wearT) wearT.dispose(); }); });
  info.meshMs=RT()-t2;
  R.m=1;   /* (built groomed; until the race sets the night (setNight), the ground is the worn track of milestone 2) */
  return {root,relief:R,info,track,clodMat};
}

/* ---------------- the start path (a flatter strip: the same material, neutral track texture) ---------------- */
function startMesh(C,look,q,mat){
  const Co=CO(), S=TRK[look.soil]||TRK["stadium-dirt"], base=lin(S[1]), dark=lin(S[2]), outdoor=C.kind!=="stadium", grassEdge=lin("#4f6b33");
  if(!(C.S&&C.S.n)) return null;
  const P2=[], C2=[], U2=[], W2=[], I2=[], S2=C.S, fr2=[-1.5,-1,-0.6,-0.2,0,0.2,0.6,1,1.5], nl2=fr2.length, st2=Math.max(1,Math.round((q.lo?2:1)*C.ds/S2.ds));
  let rows=0;
  const lst=Math.max(1,Math.round(1/C.ds)), onLoop=(x,z)=>{ for(let i=0;i<C.N;i+=lst){ const dx=C.x[i]-x, dz=C.z[i]-z, r=C.hw[i]+0.3; if(dx*dx+dz*dz<r*r) return true; } return false; };
  for(let i=0;i<S2.n;i+=st2){ rows++; const th=S2.th[i], nx=-Math.sin(th), nz=Math.cos(th), hw=S2.hw[i], y0=S2.y[i]||0;
    for(let j=0;j<nl2;j++){ const u=fr2[j], a=Math.abs(u), lat=u*hw+(a>1?(a-1)*3*Math.sign(u):0); let y=a<=1?y0+0.02+(vnoise(i*0.4,lat)-0.5)*0.04:y0-0.06;
      const px=S2.x[i]+nx*lat, pz=S2.z[i]+nz*lat; if(onLoop(px,pz)) y=Math.min(y,y0-0.14);
      P2.push(px,y,pz); const c=a>1?(outdoor?grassEdge:mixc(base,dark,0.25)):mixc(base,dark,Math.exp(-u*u*3)*0.25+0.12); C2.push(c[0],c[1],c[2]); U2.push(i*S2.ds,lat); W2.push(a>1?0.25:0.38); } }
  for(let k=0;k<rows-1;k++) for(let j=0;j<nl2-1;j++){ const a=k*nl2+j, b=a+1, c2=a+nl2, d=c2+1; I2.push(a,b,c2,b,d,c2); }
  const g=new THREE.BufferGeometry(); g.setAttribute("position",new THREE.Float32BufferAttribute(P2,3)); g.setAttribute("color",new THREE.Float32BufferAttribute(C2,3)); g.setAttribute("uv",new THREE.Float32BufferAttribute(U2,2));
  g.setAttribute("aWet",new THREE.Float32BufferAttribute(W2,1)); g.setAttribute("aTraf",new THREE.Float32BufferAttribute(new Float32Array(W2.length),1)); g.setIndex(I2); g.computeVertexNormals();
  /* (the night's wear: the start path is groomed for every race: no ruts, the same colour and moisture both ways) */
  { const n=W2.length, c0=new Float32Array(n*4); for(let k=0;k<n;k++){ c0[k*4]=Math.sqrt(Math.max(0,C2[k*3])); c0[k*4+1]=Math.sqrt(Math.max(0,C2[k*3+1])); c0[k*4+2]=Math.sqrt(Math.max(0,C2[k*3+2])); c0[k*4+3]=W2[k]; }   /* (the start strip: aRut 0 (Float32: as is), aCol0 = the square root of its colour, as the track's) */
    g.setAttribute("aRut",new THREE.Float32BufferAttribute(new Float32Array(n),1)); g.setAttribute("aNw",g.attributes.normal.clone()); g.setAttribute("aCol0",new THREE.Float32BufferAttribute(c0,4)); }
  const m=new THREE.Mesh(g,mat); m.receiveShadow=true; return m;
}


/* a tuff block: a chamfered, slightly tapered slab (an octagonal cross-section extruded along the lane, smooth normals through the chamfers: it reads as moulded plastic) with 28 triangles;
   dusty brown toward the foot where the dirt kicks up on it */
function blockGeo(L,H,W,c){
  const t=0.035, P=[[-W/2+c,0],[W/2-c,0],[W/2,c],[W/2-t,H-c],[W/2-t-c*0.8,H],[-W/2+t+c*0.8,H],[-W/2+t,H-c],[-W/2,c]], n=P.length, pos=[], nor=[], col=[], idx=[], dust=lin("#7a5230");
  const edgeN=k=>{ const a=P[k], b=P[(k+1)%n], dz=b[0]-a[0], dy=b[1]-a[1], l=Math.hypot(dz,dy)||1; return [dy/l,-dz/l]; };   /* outward normal (z, y) of the edge k -> k+1 */
  const shade=(y,x,z)=>{ const tt=clamp(1-y/(H*0.62),0,1), grime=0.5+0.5*vnoise(x*7+z*3,y*5), k=tt*tt*0.78*grime; return [1+(dust[0]-1)*k,1+(dust[1]-1)*k,1+(dust[2]-1)*k]; };
  for(let e=0;e<2;e++){ const x=(e?1:-1)*L/2; for(let k=0;k<n;k++){ const n0=edgeN((k-1+n)%n), n1=edgeN(k), nz=n0[0]+n1[0], ny=n0[1]+n1[1], l=Math.hypot(nz,ny)||1;
    pos.push(x,P[k][1],P[k][0]); nor.push(0,ny/l,nz/l); const cc=shade(P[k][1],x,P[k][0]); col.push(cc[0],cc[1],cc[2]); } }
  for(let k=0;k<n;k++){ const a=k, b=(k+1)%n, c2=n+k, d=n+(k+1)%n; idx.push(a,c2,b,b,c2,d); }
  for(let e=0;e<2;e++){ const base=pos.length/3, x=(e?1:-1)*L/2; pos.push(x,H*0.5,0); nor.push(e?1:-1,0,0); col.push(1,1,1);
    for(let k=0;k<n;k++){ pos.push(x,P[k][1],P[k][0]); nor.push(e?1:-1,0,0); const cc=shade(P[k][1],x,P[k][0]); col.push(cc[0],cc[1],cc[2]); }
    for(let k=0;k<n;k++){ const a=base+1+k, b=base+1+(k+1)%n; if(e) idx.push(base,b,a); else idx.push(base,a,b); } }
  const g=new THREE.BufferGeometry(); g.setAttribute("position",new THREE.Float32BufferAttribute(pos,3)); g.setAttribute("normal",new THREE.Float32BufferAttribute(nor,3)); g.setAttribute("color",new THREE.Float32BufferAttribute(col,3)); g.setIndex(idx); return g;
}
function baleGeo(){ const g=new THREE.BoxGeometry(1.2,0.5,0.55), n=g.attributes.position.count, c=new Float32Array(n*3).fill(1); g.setAttribute("color",new THREE.BufferAttribute(c,3)); return g; }

/* ---------------- tuff blocks (modern stadium) or hay bales (old eras) along the lane edges ---------------- */
function edgeBlocks(C,look,q){
  const Co=CO(), list=[], o={}, step=look.bales?2.6:2.0;
  for(let s=0;s<C.L;s+=step){
    const f=Co.frame(C,s,o);
    [-1,1].forEach(side=>{
      const nx=-Math.sin(f.th)*side, nz=Math.cos(f.th)*side;
      let gap=-1;
      for(let d=1.2;d<=9;d+=0.6){ const x=f.x+nx*(f.hw+d), z=f.z+nz*(f.hw+d); if(!clear(C,x,z,0.05)){ gap=d; break; } }
      if(gap<1.4) return;
      if(Math.abs(f.k)>1/28&&Math.sign(f.k)!==side) return;
      const lat=side*(f.hw+gap/2), x=f.x-Math.sin(f.th)*lat, z=f.z+Math.cos(f.th)*lat;
      if(list.some(b=>(b[0]-x)*(b[0]-x)+(b[1]-z)*(b[1]-z)<2.4)) return;
      if(!clear(C,x,z,0.35)) return;
      list.push([x,z,f.th,(f.y||0)]);
    });
  }
  const geo=look.bales?baleGeo():blockGeo(1.3,0.44,0.5,0.06), hi=!q.lo;
  const mat=hi?new THREE.MeshStandardMaterial({color:0xffffff,vertexColors:true,roughness:0.62,metalness:0}):new THREE.MeshLambertMaterial({color:0xffffff,vertexColors:true});
  /* polish: moulded plastic that has been in a race: dirt splotches, a dusty foot, rubbed edges and scuffs (a procedural pattern on the block's own position, per block by its place on the track: no texture) */
  /* milestone 2: the FIRE TV tier's blocks get the same raced-in pattern (they were clean plastic there; Lambert has no roughness chunk, so that line is a no-op there),
     every block a crust of roost on its top, the colours a little sun-faded */
  if(!look.bales){ mat.onBeforeCompile=sh=>{
    sh.vertexShader=sh.vertexShader.replace("#include <common>","#include <common>"+"\n"+"varying vec3 vBk; varying float vBh;").replace("#include <begin_vertex>","#include <begin_vertex>"+"\n"+"vBk=position+vec3(instanceMatrix[3].x*0.37,instanceMatrix[3].z*0.53,instanceMatrix[3].x+instanceMatrix[3].z); vBh=position.y;");
    sh.fragmentShader=sh.fragmentShader.replace("#include <common>","#include <common>"+"\n"+"varying vec3 vBk; varying float vBh; float bkH(vec3 p){ p=fract(p*0.3183099+0.1); p*=17.0; return fract(p.x*p.y*p.z*(p.x+p.y+p.z)); } float bkN(vec3 x){ vec3 i=floor(x), f=fract(x); f=f*f*(3.0-2.0*f); return mix(mix(mix(bkH(i),bkH(i+vec3(1,0,0)),f.x),mix(bkH(i+vec3(0,1,0)),bkH(i+vec3(1,1,0)),f.x),f.y),mix(mix(bkH(i+vec3(0,0,1)),bkH(i+vec3(1,0,1)),f.x),mix(bkH(i+vec3(0,1,1)),bkH(i+vec3(1,1,1)),f.x),f.y),f.z); }")
      .replace("#include <color_fragment>","#include <color_fragment>"+"\n"+"{ float n=0.6*bkN(vBk*vec3(6.0,10.0,9.0))+0.4*bkN(vBk*vec3(21.0,31.0,27.0)); float low=1.0-smoothstep(0.02,0.28,vBh); float dirt=clamp(smoothstep(0.58,0.86,n)*0.5+low*0.6*n,0.0,0.85); float top=smoothstep(0.33,0.43,vBh); float dep=smoothstep(0.42,0.78,0.7*bkN(vBk*vec3(9.0,5.0,9.0))+0.3*bkN(vBk*vec3(37.0,11.0,41.0)))*top; dirt=max(dirt,dep*0.88); diffuseColor.rgb=mix(diffuseColor.rgb,vec3(dot(diffuseColor.rgb,vec3(0.3,0.59,0.11))),0.14); diffuseColor.rgb=mix(diffuseColor.rgb,vec3(0.075,0.042,0.02)*(0.7+0.6*n),dirt); float scuff=smoothstep(0.82,0.94,bkN(vBk*vec3(3.0,40.0,34.0)))*0.45; diffuseColor.rgb=mix(diffuseColor.rgb,diffuseColor.rgb*0.62,scuff); }")
      .replace("#include <roughnessmap_fragment>","#include <roughnessmap_fragment>"+"\n"+"roughnessFactor=clamp(roughnessFactor+0.08*bkN(vBk*13.0),0.0,1.0);");
  }; mat.customProgramCacheKey=()=>"mx-tuff"; }
  const m=new THREE.InstancedMesh(geo,mat,Math.max(1,list.length)), M=new THREE.Matrix4(), Q=new THREE.Quaternion(), E=new THREE.Euler(0,0,0,"YXZ"), V=new THREE.Vector3(), Sx=new THREE.Vector3(1,1,1), cl=new THREE.Color();
  /* tuff blocks in plain colours (the CEO's broadcast photo: yellow, red, blue, white), every albedo at 0.6 or less in linear light (the near-white blocks reached 1.4-1.7 under the key and glowed neon: lead's request, director note D5); no brand, no lettering */
  const tints=look.bales?["#c9a55a","#b8944e","#d4b066"]:["#c8a010","#b82430","#2a5cb8","#bfc1c8","#c8a010","#b82430","#2a5cb8"];
  const rnd=rngf(7919+list.length);
  list.forEach((b,i)=>{ const jy=(rnd()-0.5)*0.09, jr=(rnd()-0.5)*0.05, jl=(rnd()-0.5)*0.18, drop=0.025+rnd()*0.03; E.set(0,-b[2]+jy,jr); Q.setFromEuler(E);
    V.set(b[0]+Math.cos(b[2])*jl,b[3]+(look.bales?0.25:0.22)-drop,b[1]+Math.sin(b[2])*jl); M.compose(V,Q,Sx); m.setMatrixAt(i,M); cl.set(tints[i%tints.length]); m.setColorAt(i,cl); });
  m.instanceMatrix.needsUpdate=true; if(m.instanceColor) m.instanceColor.needsUpdate=true;
  return m;
}

/* how far (x, z) is from the nearest OTHER part of the track: samples within skip m of loop distance s don't count (its own section) */
function roomBeside(C,x,z,s,skip){
  const st=Math.max(1,Math.round(1/C.ds)); let best=1e9;
  for(let i=0;i<C.N;i+=st){ let dd=Math.abs(i*C.ds-s); dd=Math.min(dd,C.L-dd); if(dd<skip) continue; const dx=C.x[i]-x, dz=C.z[i]-z, d=Math.sqrt(dx*dx+dz*dz)-C.hw[i]; if(d<best) best=d; }
  if(C.S&&C.S.n) for(let i=0;i<C.S.n;i+=st){ const dx=C.S.x[i]-x, dz=C.S.z[i]-z, d=Math.sqrt(dx*dx+dz*dz)-C.S.hw[i]; if(d<best) best=d; }
  return best;
}

/* ---------------- the track's material and its scene objects ---------------- */
function tierOf(q){ return q&&q.dirtTier?q.dirtTier:(q&&q.lo?"lo":"hi"); }
function sheenOf(look){ return look&&look.night?0xffbe70:0xdfeaff; }
/* the material the track is drawn with -> {mat, dirt (a colour texture for the old callers)} */
export function trackMaterial(look,q){
  const tier=tierOf(q), t0=RT(), tiles=soilTiles(tier==="lo"), mat=dirtMaterial(tier,tiles,sheenOf(look));
  TILES.ms=RT()-t0;
  mat.userData.tier=tier; mat.userData.tiles=tiles;
  return {mat:mat,dirt:tiles.A};
}
/* the track and the lane-edge blocks, added to the world's root -> {track, frame, relief}; frame(dt, riders) is optional (set it for per-frame work:
   tyre tracks, ruts that deepen...), called by race3d.js with the riders' per-frame state (CONTRACT.md) */
export function addTrack(C,look,q,root,mat){
  const tb=RT(), tier=mat.userData.tier||tierOf(q), tiles=mat.userData.tiles||soilTiles(tier==="lo");
  const T=trackMesh(C,look,q,mat,tier,tiles); root.add(T.root);
  const sm=dirtMaterial(tier,tiles,sheenOf(look)), st=startMesh(C,look,q,sm);
  if(st){ const sf=buildStartFine(C,tier==="hi"?1024:512,tier==="hi"?128:64), stex=trackTexture(sf,false); sm.userData.mx.uTrack.value=stex; sm.userData.mx.uTm.value.set(1/sf.L,sf.LAT,1/(2*sf.LAT),1);
    st.geometry.addEventListener("dispose",()=>stex.dispose()); root.add(st); }
  if(C.kind!=="outdoor"&&look.around!=="hills-trees") root.add(edgeBlocks(C,look,q));
  T.info.totalMs=RT()-tb; T.info.tilesMs=T.info.tilesMs||0;
  const nf=nightFrame([mat,sm,T.clodMat],C.L,T.relief);
  return {track:T.root,frame:nf,setNight:nf.setNight,night:nf.state,relief:T.relief,info:T.info,tier:tier};
}
/* THE NIGHT'S WEAR (2026-10-19, the CEO: "the ruts get deeper as the night goes on. So for the heat races ... the track should be perfect, but the ruts get deeper and deeper as
   the night goes on, just like actual motocross physics"). race3d.js calls frame(dt, riders) every frame (the dirt zone) and setNight({base, total, len}) for every race: the laps the
   night has run before this race (base), the night's laps in all (total: every race of the round's program, the heats first, the Main last), this race's laps (len). The night's
   progress p = (base + the leader's laps in this race) / total: a pure function of the round, the race and the race's own progress (the leader's race distance, st.D / L), never of
   the frame rate or the screen: the TV in Party Mode and every phone see the same dirt. From p (nightLevels):
     m   the depth of what the racing digs (ruts, their lips, the berm's lip, braking bumps, roost ripples, the whoops' scour, chop and lane): 0.12 at the first heat's gate (a
         groomed track: the practice's faint lines), 0.24 after a heat of a 4-race night, 0.57 at the Main's gate, 1.2 at its flag (1 = milestone 2's ruts, 20-28 cm in a corner)
     wN  the worn look's share (the colours and moisture of the ruts and lips, the clods thrown up, the cavities and the fine detail's strength)
     ws  the line's packing and the race's grooves (the wear map: milestone 2's uWear, now over the night: p^0.8)
   The ground the wheels follow is the relief at m (Rl.m), so the riders ride the worn track: their wheels drop into the ruts that are there. Only uniforms change; nothing is uploaded. */
export function nightLevels(p){
  p=clamp(p,0,1); const m=0.12+1.08*Math.pow(p,1.25), wN=clamp((m-0.12)/0.88,0,1.23);
  return {p:p,m:m,wN:wN,ws:Math.pow(p,0.8),kF:Math.min(1.08,0.5+0.5*wN),kA:Math.min(1.1,0.4+0.6*wN)};
}
function nightFrame(mats,L,Rl){
  const N={base:1,total:2,len:1,p:-1};   /* (until setNight: the second half of a night of two races) */
  let last=-1;
  const apply=(p,laps)=>{ const lv=nightLevels(p); if(Rl) Rl.m=lv.m; N.p=p; N.m=lv.m; N.wN=lv.wN;
    for(const m of mats){ const U=m&&m.userData.mx; if(!U) continue; if(U.uNight) U.uNight.value.set(lv.m,lv.wN,lv.kF,lv.kA); if(U.uWear) U.uWear.value.set(lv.ws,laps,0,0); } };
  const f=function(dt,RST){
    let Dm=0; if(RST) for(let i=0;i<RST.length;i++){ const st=RST[i]; if(st&&st.visible!==false&&typeof st.D==="number"&&st.D>Dm) Dm=st.D; }
    const laps=Dm/L, p=clamp((N.base+Math.min(N.len,laps))/Math.max(1e-6,N.total),0,1);
    if(Math.abs(p-last)<1e-4) return; last=p; apply(p,laps);
  };
  f.setNight=function(o){ o=o||{}; const len=Math.max(1,+o.len||1), total=Math.max(len,+o.total||2*len), base=clamp(o.base!=null?+o.base:total-len,0,total-len);
    N.base=base; N.total=total; N.len=len; last=-1; apply(clamp(base/total,0,1),0); return N; };
  f.state=N;
  return f;
}
