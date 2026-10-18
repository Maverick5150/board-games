/* MOTOCROSS WAR 3D — THE BIKE (owner: bike): a modern 450 cc four-stroke Supercross bike, an ORIGINAL design (no logos, no sponsor marks, no brand
   shapes; the team is the colours). Geometry: r3d-bike-model.js (an aluminium twin-spar frame, engine cases, cylinder and head, shrouds over the
   radiators, tank, seat, side panels, rear fender, the exhaust header into a muffler on the right, a fork with gold lower legs and guards, triple clamps,
   bars with a crossbar pad, grips, levers and a master cylinder, wave brake discs and calipers, chain and sprockets, an aluminium swingarm, the rear shock
   with its coloured coil spring, the linkage, footpegs, knobby tyres with real knobs on the close level of detail). Three levels of detail, drawn through
   InstancedMesh (every rider shares one draw call per part): LOD 0 close (< 12 m), LOD 1 mid (< 38 m), LOD 2 far (one static mesh). One shader: physically
   based (MeshStandardMaterial) with baked per-vertex material (metalness, roughness, which colour, ambient occlusion), the team colours from instance
   attributes, a livery mask for the graphics, a procedural night-stadium environment for the reflections, and MUD that builds up on the lower parts.
   Reduce effects / the Fire TV tier (lo) uses only LOD 1 and 2 and a Lambert version of the same shader.
   Bike local axes: +X forward, +Y up, +Z right (heading th: rotation.y = -th; roll + = lean right; pitch + = nose up; Euler order YZX).
   createBike(n, lo, mk, q) -> M: mk(geo, count, material) is the instancing glue of r3d-riders.js (an InstancedMesh added to the riders' group). M holds every
   InstancedMesh as M["bk<lod>_<part>"] and the bike's own state as M.bk. colorBike(M, i, R): R = {color, accent}. poseBike(M, i, B, st): B = the bike's world
   Matrix4; reads st.compF / compR (suspension compression, m), st.spinF / spinR (wheel spin, rad), st.lodD (distance to the camera, m: picks the level of detail),
   st.mud (0..1), st.steer (rad, + right; when absent it is worked out from the track's curvature st.k). hideBike(M, i). */
import * as THREE_NS from "../ui/vendor/three-0.160.0.module.min.js";
const THREE=THREE_NS;
import {bone,canvas,clamp,MAT as KIT,getKitTier} from "./r3d-util.js";
import {BIKE,buildBike,buildFarBike,buildWheel,buildBlurDisc,triCount,UA,A0,ARM} from "./r3d-bike-model.js";
export {BIKE};

/* ---------------- textures (made once per page, shared by every race) ---------------- */
const TEX={};
/* the night stadium as seen from the track: dark sky, a bright band of lights and crowd round the horizon, four light banks high up, the sun's own spot, a warm dirt floor.
   An equirectangular canvas: three.js turns it into a prefiltered environment on first use. */
function envTexture(size){
  const w=size, h=size/2, c=canvas(w,h), x=c.getContext("2d"), px=u=>u*w, py=v=>(1-v)*h;
  const g=x.createLinearGradient(0,0,0,h); g.addColorStop(0,"#05070d"); g.addColorStop(0.22,"#0b1020"); g.addColorStop(0.40,"#1b2440"); g.addColorStop(0.49,"#3a3350"); g.addColorStop(0.5,"#4a3a2c"); g.addColorStop(0.75,"#3a2b1d"); g.addColorStop(1,"#1d140d");
  x.fillStyle=g; x.fillRect(0,0,w,h);
  /* the crowd and the stand lights: a bright warm band with many small lights */
  const band=x.createLinearGradient(0,py(0.64),0,py(0.50)); band.addColorStop(0,"rgba(255,206,140,0)"); band.addColorStop(0.5,"rgba(255,206,140,0.55)"); band.addColorStop(1,"rgba(120,80,50,0.25)"); x.fillStyle=band; x.fillRect(0,py(0.64),w,py(0.50)-py(0.64));
  let s=7; const rnd=()=>{ s=(s*16807)%2147483647; return s/2147483647; };
  for(let k=0;k<Math.round(w*0.9);k++){ x.fillStyle="rgba(255,"+(200+Math.round(rnd()*50))+","+(120+Math.round(rnd()*90))+","+(0.35+rnd()*0.6).toFixed(2)+")"; x.fillRect(rnd()*w,py(0.50+rnd()*0.14),1+rnd()*2,1+rnd()); }
  /* four light banks high up (the stadium's towers) and a row of ring lights */
  [0.04,0.30,0.56,0.80].forEach(u=>{ x.fillStyle="rgba(255,250,235,1)"; x.fillRect(px(u)-w*0.035,py(0.80),w*0.07,h*0.08); x.fillStyle="rgba(255,244,215,0.55)"; x.fillRect(px(u)-w*0.05,py(0.82),w*0.10,h*0.12); });
  x.fillStyle="rgba(255,240,210,0.9)"; for(let k=0;k<24;k++) x.fillRect(px(k/24+0.01),py(0.665),w*0.016,h*0.012);
  /* the sun's key light (the scene's directional light comes from azimuth 0.918, elevation 0.7175) */
  const sg=x.createRadialGradient(px(0.918),py(0.7175),1,px(0.918),py(0.7175),h*0.10); sg.addColorStop(0,"rgba(255,248,230,1)"); sg.addColorStop(0.35,"rgba(255,236,200,0.85)"); sg.addColorStop(1,"rgba(255,230,190,0)"); x.fillStyle=sg; x.fillRect(px(0.918)-h*0.12,py(0.7175)-h*0.12,h*0.24,h*0.24);
  const t=new THREE.CanvasTexture(c); t.mapping=THREE.EquirectangularReflectionMapping; t.colorSpace=THREE.SRGBColorSpace; t.generateMipmaps=false; t.minFilter=THREE.LinearFilter; t.magFilter=THREE.LinearFilter; return t;
}
/* THE LIVERY v2 (milestone 2): four masks in one RGBA texture (a DataTexture packed from four canvases, so no channel is lost to premultiplied alpha):
   r = the accent colour, g = black, b = white, a = where the team colour carries the team's fine pattern (hexes, halftone dots, pinstripes or shards, drawn by the shader).
   The upper half is the side view (x LIV.x0..x1 across, y LIV.y1 at the top .. LIV.y0), the lower half the view from above for the fenders (x LIV.tx0..tx1, z -tz..tz).
   The shader works the texture coordinates out from the model position, so every level of detail wears the same graphics. Original art: angular blades, pinstripes,
   chevrons, no logos, no lettering but the rider's own number and name. */
const LIV={x0:-0.86,x1:0.58,y0:0.56,y1:1.00,tx0:-1.17,tx1:1.19,tz:0.15};
function liveryTexture(W){
  const H=W/2, cs=[0,1,2,3].map(()=>{ const c=canvas(W,H), x=c.getContext("2d"); x.fillStyle="#000"; x.fillRect(0,0,W,H); return {c:c,x:x}; });
  const SX=v=>(v-LIV.x0)/(LIV.x1-LIV.x0)*W, SY=v=>(LIV.y1-v)/(LIV.y1-LIV.y0)*H/2, TX=v=>(v-LIV.tx0)/(LIV.tx1-LIV.tx0)*W, TZ=v=>H/2+(v+LIV.tz)/(2*LIV.tz)*H/2;
  const path=(x,pts,top)=>{ x.beginPath(); pts.forEach((p,i)=>{ const u=top?TX(p[0]):SX(p[0]), v=top?TZ(p[1]):SY(p[1]); if(i) x.lineTo(u,v); else x.moveTo(u,v); }); };
  const poly=(k,pts,top,al)=>{ const x=cs[k].x; x.fillStyle="rgba(255,255,255,"+(al==null?1:al)+")"; path(x,pts,top); x.closePath(); x.fill(); };
  const line=(k,pts,wm,top)=>{ const x=cs[k].x; x.strokeStyle="#fff"; x.lineWidth=Math.max(1,wm*W/(top?(LIV.tx1-LIV.tx0):(LIV.x1-LIV.x0))); x.lineJoin="miter"; x.lineCap="butt"; path(x,pts,top); x.stroke(); };
  const mir=pts=>pts.map(p=>[p[0],-p[1]]);
  const AC=0, BK=1, WT=2, PT=3;
  /* the pattern zones first (soft edges) */
  cs[PT].x.filter="blur("+Math.max(1,Math.round(W/340))+"px)";
  poly(PT,[[0.56,0.70],[0.56,0.80],[0.36,0.86],[0.20,0.93],[0.10,1.0],[-0.08,1.0],[-0.08,0.95],[0.06,0.885],[0.22,0.80],[0.42,0.73]],false,0.95);
  poly(PT,[[-0.56,0.74],[-0.87,0.77],[-0.87,0.99],[-0.56,0.99]],false,0.85);
  [1,-1].forEach(sg=>{ poly(PT,[[-0.42,0.046*sg],[-1.02,0.030*sg],[-1.02,0.12*sg],[-0.42,0.13*sg]],true,0.85); poly(PT,[[0.55,0.040*sg],[1.06,0.024*sg],[1.06,0.13*sg],[0.55,0.14*sg]],true,0.6); });
  cs[PT].x.filter="none";
  /* the shroud: a black lower band, a wide accent blade from the vent up to the tank, a thinner slash above it, white pinstripes */
  poly(BK,[[0.57,0.550],[0.30,0.628],[0.10,0.722],[-0.08,0.782],[-0.08,0.815],[0.10,0.763],[0.28,0.680],[0.57,0.606]]);
  poly(AC,[[0.57,0.700],[0.40,0.742],[0.26,0.812],[0.13,0.892],[0.02,0.960],[-0.08,1.0],[-0.08,0.925],[0.02,0.874],[0.15,0.800],[0.30,0.722],[0.57,0.650]]);
  poly(AC,[[0.45,0.796],[0.30,0.862],[0.18,0.936],[0.10,0.988],[0.03,1.0],[0.10,0.944],[0.22,0.871],[0.36,0.806],[0.46,0.782]]);
  poly(BK,[[0.20,0.792],[0.08,0.866],[0.03,0.866],[0.15,0.792]]);
  line(WT,[[0.57,0.638],[0.30,0.709],[0.15,0.787],[0.02,0.862],[-0.08,0.913]],0.0075);
  line(WT,[[0.57,0.619],[0.28,0.692],[0.10,0.776],[-0.08,0.827]],0.0050);
  line(WT,[[0.47,0.776],[0.36,0.797],[0.22,0.864],[0.10,0.937],[0.02,0.988]],0.0042);
  poly(WT,[[0.545,0.772],[0.47,0.800],[0.545,0.800]]);
  /* the side panel: a black front corner, an accent band under the seat edge with a white pinstripe, two chevrons behind the number, a black tail */
  poly(BK,[[-0.01,0.730],[-0.27,0.755],[-0.27,0.802],[-0.01,0.777]]);
  poly(AC,[[-0.01,0.902],[-0.87,0.950],[-0.87,0.990],[-0.01,0.938]]);
  line(WT,[[-0.01,0.895],[-0.87,0.943]],0.0042);
  poly(AC,[[-0.598,0.790],[-0.668,0.790],[-0.632,0.872],[-0.668,0.950],[-0.598,0.950],[-0.562,0.872]]);
  poly(WT,[[-0.688,0.805],[-0.736,0.805],[-0.706,0.874],[-0.736,0.950],[-0.688,0.950],[-0.658,0.874]]);
  poly(BK,[[-0.775,0.800],[-0.87,0.812],[-0.87,0.990],[-0.795,0.990]]);
  /* the fenders from above: an accent centre stripe with white pinstripes, a black chevron at the tip */
  poly(AC,[[-0.39,-0.030],[-1.13,-0.012],[-1.13,0.012],[-0.39,0.030]],true); poly(AC,[[0.50,-0.026],[1.17,-0.010],[1.17,0.010],[0.50,0.026]],true);
  [1,-1].forEach(sg=>{ poly(WT,[[-0.39,0.036*sg],[-1.10,0.017*sg],[-1.10,0.022*sg],[-0.39,0.043*sg]],true); poly(WT,[[0.50,0.032*sg],[1.15,0.015*sg],[1.15,0.020*sg],[0.50,0.039*sg]],true); });
  poly(BK,[[-1.035,-0.13],[-1.18,-0.13],[-1.18,0.13],[-1.035,0.13],[-0.985,0.0]],true);
  poly(BK,[[1.095,-0.13],[1.20,-0.13],[1.20,0.13],[1.095,0.13],[1.045,0.0]],true);
  void mir;
  /* pack the four masks into one RGBA texture */
  const d=new Uint8Array(W*H*4), im=cs.map(o=>o.x.getImageData(0,0,W,H).data);
  for(let i=0,j=0;i<W*H;i++,j+=4){ d[j]=im[0][j]; d[j+1]=im[1][j]; d[j+2]=im[2][j]; d[j+3]=im[3][j]; }
  const t=new THREE.DataTexture(d,W,H,THREE.RGBAFormat,THREE.UnsignedByteType);
  t.colorSpace=THREE.NoColorSpace; t.wrapS=t.wrapT=THREE.ClampToEdgeWrapping; t.anisotropy=4; t.generateMipmaps=true; t.minFilter=THREE.LinearMipmapLinearFilter; t.magFilter=THREE.LinearFilter; t.needsUpdate=true;
  return t;
}
function tex(lo){ const k=lo?"lo":"hi"; if(!TEX[k]) TEX[k]={env:lo?null:envTexture(256),liv:liveryTexture(lo?512:1024)}; return TEX[k]; }

/* THE NUMBER ON THE SIDE PANELS (milestone 2): a per-race atlas, one cell per rider, three masks: r = the number background, g = the numerals and the rider's name, b = a thin
   border. The shader projects the cell onto both side panels (mirrored on the left so it reads the right way), paints the class colours (PLATE_CLASS: 450 = white
   with black numerals; the points leader's red plate with white numerals from the rider's st.red, no redraw), and the mud and the clear coat go over it like the rest of the plastic. */
const DEC={x0:-0.560,w:0.320,y0:0.785,h:0.170};   /* the side-panel number: the front of the panel, above the muffler on the right */
export const PLATE_CLASS={"450":{bg:"#f4f1e8",fg:"#121216"},"250":{bg:"#121216",fg:"#f4f1e8"},red:{bg:"#c8101c",fg:"#ffffff"}};
let plateClass="450";
export function setPlateClass(c){ plateClass=PLATE_CLASS[c]?String(c):"450"; }
function surname(nm){ const w=String(nm||"").trim().split(/\s+/); return (w[w.length-1]||"").toUpperCase(); }
function rrect(x,px,py,w,h,r){ x.beginPath(); x.moveTo(px+r,py); x.lineTo(px+w-r,py); x.quadraticCurveTo(px+w,py,px+w,py+r); x.lineTo(px+w,py+h-r); x.quadraticCurveTo(px+w,py+h,px+w-r,py+h); x.lineTo(px+r,py+h); x.quadraticCurveTo(px,py+h,px,py+h-r); x.lineTo(px,py+r); x.quadraticCurveTo(px,py,px+r,py); x.closePath(); }
function fitFont(x,t,max,base,min,style){ let fs=base; x.font=style+" "+fs+"px Manrope, system-ui, sans-serif"; while(x.measureText(t).width>max&&fs>min){ fs-=1; x.font=style+" "+fs+"px Manrope, system-ui, sans-serif"; } return fs; }
function decalAtlas(n,lo){
  const CW=lo?64:128, CH=lo?36:72, cols=8, rows=Math.max(1,Math.ceil(n/cols)), c=canvas(cols*CW,rows*CH), x=c.getContext("2d");
  x.fillStyle="#000"; x.fillRect(0,0,c.width,c.height);
  const t=new THREE.CanvasTexture(c); t.colorSpace=THREE.NoColorSpace; t.anisotropy=4; t.generateMipmaps=true; t.minFilter=THREE.LinearMipmapLinearFilter;
  return {c:c,x:x,t:t,CW:CW,CH:CH,cols:cols,rows:rows};
}
function drawDecal(D,i,R){
  const x=D.x, k=D.CW/128, px=(i%D.cols)*D.CW, py=Math.floor(i/D.cols)*D.CH, num=String(R.num==null?"":R.num), nm=surname(R.name);
  x.save(); x.beginPath(); x.rect(px,py,D.CW,D.CH); x.clip(); x.globalCompositeOperation="source-over"; x.fillStyle="#000"; x.fillRect(px,py,D.CW,D.CH);
  x.globalCompositeOperation="lighter";
  const bx=px+4*k, by=py+4*k, bw=D.CW-8*k, bh=53*k;
  rrect(x,bx,by,bw,bh,7*k); x.fillStyle="rgb(255,0,0)"; x.fill();
  x.lineWidth=2.2*k; x.strokeStyle="rgb(0,0,255)"; rrect(x,bx+1.1*k,by+1.1*k,bw-2.2*k,bh-2.2*k,6*k); x.stroke();
  x.fillStyle="rgb(0,255,0)"; x.textAlign="center"; x.textBaseline="middle";
  if(nm){ fitFont(x,nm,bw-16*k,Math.round(10.5*k),Math.max(5,Math.round(6*k)),"800"); x.fillText(nm,px+D.CW/2,by+8.5*k); }
  fitFont(x,num,bw-14*k,Math.round(40*k),Math.round(18*k),"italic 900"); x.fillText(num,px+D.CW/2,by+(nm?33:28)*k);
  x.restore(); D.t.needsUpdate=true;
}
/* a team's graphic style (0..3: which mask takes which colour, and the fine pattern) from its colour, so a team's bikes match */
function styleOf(col){ let h=43; const s=String(col||"").toLowerCase(); for(let i=0;i<s.length;i++) h=Math.imul(h^s.charCodeAt(i),16777619)>>>0; return (h>>>7)%4; }   /* (the seven modern makes spread over the four styles, at most two a style)

/* ---------------- the material ---------------- */
/* integer hashes (no float hash: frames stay byte-identical), value noise, the mud splats (one splat at most per cell, its size, place and presence from one hash),
   the team's fine pattern; every high-frequency term fades to its mean where a pixel covers more than a cell (no shimmer on the FIRE TV tier, which has no anti-aliasing) */
const GLSL_LIB=[
"uint bkU(uvec3 v){ v=v*1664525u+1013904223u; v.x+=v.y*v.z; v.y+=v.z*v.x; v.z+=v.x*v.y; v^=v>>16u; v.x+=v.y*v.z; v.y+=v.z*v.x; v.z+=v.x*v.y; return v.x^v.y^v.z; }",
"float bkHf(ivec3 c){ return float(bkU(uvec3(c+32768))&0xffffffu)*(1.0/16777216.0); }",
"float bkVN(vec2 p,int s){ vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f); ivec2 c=ivec2(i);",
"  return mix(mix(bkHf(ivec3(c,s)),bkHf(ivec3(c+ivec2(1,0),s)),f.x),mix(bkHf(ivec3(c+ivec2(0,1),s)),bkHf(ivec3(c+ivec2(1,1),s)),f.x),f.y); }",
"float bkSplat(vec2 p,float dens,float rmax,uint s){ vec2 i=floor(p), f=fract(p); float cov=0.0;",
"  for(int j=-1;j<=1;j++) for(int k=-1;k<=1;k++){ ivec2 c=ivec2(i)+ivec2(k,j)+32768; uint h=bkU(uvec3(uvec2(c),s));",
"    if(float(h&255u)*(1.0/255.0)>=dens) continue;",
"    vec2 o=vec2(float((h>>8u)&255u),float((h>>16u)&255u))*(1.0/255.0); float r=rmax*(0.4+0.6*float(h>>24u)*(1.0/255.0));",
"    cov=max(cov,1.0-smoothstep(r*0.62,r,length(vec2(float(k),float(j))+o-f))); }",
"  return cov; }",
"float bkPat(vec2 p,float sty,float fw){ float v=0.0, avg=0.3, cs=0.024;",
"  if(sty<0.5){ vec2 q=p/0.024, r=vec2(1.0,1.7320508), h=r*0.5; vec2 a=mod(q,r)-h, b=mod(q-h,r)-h; vec2 g=dot(a,a)<dot(b,b)?a:b; vec2 qa=abs(g); float d=max(dot(qa,vec2(0.5,0.8660254)),qa.x); v=smoothstep(0.40,0.46,d); avg=0.32; }",
"  else if(sty<1.5){ cs=0.016; vec2 g=fract(p/cs)-0.5; float rr=0.10+0.27*smoothstep(-0.85,0.55,p.x); v=1.0-smoothstep(rr-0.07,rr+0.07,length(g)); avg=3.14159*rr*rr; }",
"  else if(sty<2.5){ cs=0.011; float s=fract((p.x*0.8+p.y)/cs); v=smoothstep(0.24,0.31,s)*(1.0-smoothstep(0.62,0.69,s)); avg=0.38; }",
"  else { cs=0.05; vec2 q=p/cs; q.x+=q.y*0.5; vec2 i=floor(q), f=fract(q); uint h=bkU(uvec3(uvec2(ivec2(i)+32768),uint(step(f.x,f.y))+11u)); v=step(0.60,float(h&255u)*(1.0/255.0)); avg=0.4; }",
"  return mix(v,avg,smoothstep(0.35,0.9,fw/cs)); }",
""].join("\n");
const NBK=64;   /* bikes a race at most in the per-bike uniform arrays (a field is 22 to 40) */
function bikeMaterial(lo,D,U){
  const T=tex(lo), std=!lo, phys=std&&getKitTier()==="high";
  const o={vertexColors:true,roughness:1,metalness:0,envMap:T.env,envMapIntensity:1.7};
  /* the plastics' clear coat comes from the lead's material kit on the high tier (MeshPhysicalMaterial, gloss preset); the shader keeps the coat on the plastics only, off the mud */
  const m=lo?new THREE.MeshLambertMaterial({vertexColors:true}):(phys?KIT.gloss(null,Object.assign(o,{clearcoat:1,clearcoatRoughness:0.07})):new THREE.MeshStandardMaterial(o));
  m.userData.keepMaps=true;
  const cl=PLATE_CLASS[plateClass]||PLATE_CLASS["450"], bg=new THREE.Color(cl.bg), fg=new THREE.Color(cl.fg);
  m.onBeforeCompile=sh=>{
    sh.uniforms.uLiv={value:T.liv}; sh.uniforms.uDec={value:D.t}; sh.uniforms.uDecG={value:new THREE.Vector4(D.cols,D.rows,0,0)}; sh.uniforms.uBkC={value:U.c}; sh.uniforms.uBkA={value:U.a};
    sh.uniforms.uMudCol={value:new THREE.Vector3(0.115,0.066,0.032)}; sh.uniforms.uPlBg={value:new THREE.Vector3(bg.r,bg.g,bg.b)}; sh.uniforms.uPlFg={value:new THREE.Vector3(fg.r,fg.g,fg.b)};
    sh.vertexShader=sh.vertexShader
      .replace("#include <common>","#include <common>\nattribute vec4 aMat;\nuniform vec4 uBkC["+NBK+"];\nuniform vec4 uBkA["+NBK+"];\nvarying vec4 vMat;\nvarying vec3 vAcc;\nvarying vec4 vMud;\nvarying vec3 vLoc;\nvarying vec3 vNl;")
      .replace("#include <color_vertex>","#include <color_vertex>\n{ int bi=int(instanceColor.r); vec4 kc=uBkC[bi], ka=uBkA[bi]; float sty=mod(kc.w,8.0), red=step(7.5,kc.w);\n  float wl=step(31.5,aMat.z); float rr=aMat.z-32.0*wl; float kd=floor((rr+0.5)/4.0); float tn=rr-4.0*kd; vec3 fc=sty>0.5&&sty<1.5?vec3(0.86):(sty>1.5&&sty<2.5?ka.rgb:kc.rgb); vec3 tint=tn<0.5?vec3(1.0):(tn<1.5?kc.rgb:(tn<2.5?ka.rgb:fc)); vColor.rgb=color.rgb*tint;\n  vAcc=ka.rgb; vMud=vec4(instanceColor.b,sty,instanceColor.g,float(bi)+0.5*red); }\nvMat=aMat; vLoc=position; vNl=normal;");
    let fs=sh.fragmentShader.replace("#include <common>","#include <common>\nuniform sampler2D uLiv;\nuniform sampler2D uDec;\nuniform vec4 uDecG;\nuniform vec3 uMudCol;\nuniform vec3 uPlBg;\nuniform vec3 uPlFg;\nvarying vec4 vMat;\nvarying vec3 vAcc;\nvarying vec4 vMud;\nvarying vec3 vLoc;\nvarying vec3 vNl;\n"+GLSL_LIB);
    const f=n=>n.toFixed(4);
    fs=fs.replace("#include <color_fragment>",[
      "#include <color_fragment>",
      "float bkW=step(31.5,vMat.z); float bkR=vMat.z-32.0*bkW; float bkK=floor((bkR+0.5)/4.0); float bkTn=bkR-4.0*bkK;",
      "float bkIgn=fract(52.9829189*fract(dot(gl_FragCoord.xy,vec2(0.06711056,0.00583715))));",
      "{ float bkZ=vViewPosition.z; if(bkZ<1.7){ if(smoothstep(0.8,1.7,bkZ)<bkIgn) discard; } }",   /* the near-lens fade: no bike ever fills the lens (director note D12) */
      "if(bkK>0.5&&bkK<1.5&&vMud.z>0.02){ if(bkIgn<vMud.z*0.82) discard; }",   /* the spokes of a fast wheel thin out: the translucent blur disc shows the spinning wheel */
      "vec3 bkN=normalize(vNl); vec3 bkAN=abs(bkN); vec2 bkPP=bkAN.z>max(bkAN.x,bkAN.y)?vLoc.xy:(bkAN.y>bkAN.x?vLoc.xz:vLoc.zy); float bkFW=length(fwidth(bkPP));",
      /* the livery: the side view for the team plastics, the view from above for the fenders */
      "float bkTop=step(2.5,bkTn)*(1.0-step(3.5,bkTn));",
      "vec4 bkL=texture2D(uLiv,mix(vec2((vLoc.x-("+f(LIV.x0)+"))/"+f(LIV.x1-LIV.x0)+",clamp(("+f(LIV.y1)+"-vLoc.y)/"+f(LIV.y1-LIV.y0)+",0.004,0.996)*0.5),vec2((vLoc.x-("+f(LIV.tx0)+"))/"+f(LIV.tx1-LIV.tx0)+",0.5+clamp((vLoc.z+"+f(LIV.tz)+")/"+f(2*LIV.tz)+",0.004,0.996)*0.5),bkTop));",
      "float bkLk=(bkTn>0.5&&bkTn<1.5&&bkK<0.5)?1.0:(bkTop>0.5?0.85:0.0);",
      "vec3 b0=diffuseColor.rgb; float sty=vMud.y;",
      "if(bkLk>0.0){ vec3 S=b0*0.42+0.004; b0=mix(b0,S,bkPat(bkPP,sty,bkFW)*bkL.a*0.85*bkLk);",
      "  vec3 cA=vAcc, cB=vec3(0.010), cC=vec3(0.80);",
      "  if(sty>0.5&&sty<1.5){ cA=vec3(0.010); cB=vAcc; } else if(sty>1.5&&sty<2.5){ cA=vec3(0.80); cC=vAcc; } else if(sty>2.5){ cA=vAcc; cB=vec3(0.80); cC=vec3(0.010); }",
      "  b0=mix(b0,cA,bkL.r*bkLk); b0=mix(b0,cB,bkL.g*bkLk); b0=mix(b0,cC,bkL.b*bkLk); }",
      /* the side-panel number: the rider's cell projected on both panels */
      "vec2 bkDu=vec2((vLoc.x-("+f(DEC.x0)+"))/"+f(DEC.w)+",(vLoc.y-"+f(DEC.y0)+")/"+f(DEC.h)+");",
      "float bkDin=step(0.0,bkDu.x)*step(bkDu.x,1.0)*step(0.0,bkDu.y)*step(bkDu.y,1.0)*step(0.5,bkAN.z)*step(0.5,bkTn)*(1.0-step(1.5,bkTn))*(1.0-step(0.5,bkK));",
      "bkDu=clamp(bkDu,0.0,1.0); if(vLoc.z<0.0) bkDu.x=1.0-bkDu.x;",
      "float bkCi=floor(vMud.w+0.01), bkRed=step(0.25,vMud.w-bkCi), bkCol=mod(bkCi,uDecG.x), bkRow=floor(bkCi/uDecG.x+0.001);",
      "vec3 bkD=texture2D(uDec,vec2((bkCol+bkDu.x)/uDecG.x,1.0-(bkRow+1.0-bkDu.y)/uDecG.y)).rgb*bkDin;",
      "b0=mix(b0,mix(uPlBg,vec3(0.578,0.005,0.012),bkRed),bkD.r); b0=mix(b0,mix(uPlFg,vec3(0.86),bkRed),bkD.g); b0=mix(b0,mix(vAcc,vec3(0.86),bkRed),bkD.b);",
      /* the radiator vent behind the louvre fins */
      "float bkVx=vLoc.x+(vLoc.y-0.742)*0.447; float bkVent=step(0.5,bkTn)*(1.0-step(1.5,bkTn))*(1.0-step(0.5,bkK))*step(0.6,bkAN.z)*step(0.286,bkVx)*step(bkVx,0.462)*step(abs(vLoc.y-0.742),0.060);",
      "b0=mix(b0,vec3(0.012),bkVent); diffuseColor.rgb=b0;",
      "float bkPl=step(0.5,bkTn)*(1.0-bkVent); float bkMk=0.0;",
      /* the seat cover: gripper ribs across it */
      "float bkRib=0.0; if(bkK>4.5&&bkK<5.5){ bkRib=(1.0-smoothstep(0.30,0.55,abs(fract(vLoc.x/0.026)-0.5)*2.0))*(1.0-smoothstep(0.4,0.9,bkFW/0.026)); diffuseColor.rgb*=0.80+0.55*bkRib; }",
      /* the tyres: moulded marks and a raised ring on the sidewalls (the physically based tiers) */
      std?"if(bkK>1.5&&bkK<2.5){ float r=length(vLoc.xy), sd=abs(vLoc.z), th=atan(vLoc.y,vLoc.x); float inG=step(fract(th*0.3183099+0.08),0.30);":"",
      std?"  uint h=bkU(uvec3(uint(floor((th+3.1415927)*r*88.0))+7u,uint(step(0.284,r)),5u)); float lt=step(0.32,float(h&255u)*(1.0/255.0))*inG*step(0.272,r)*(1.0-step(0.297,r));":"",
      std?"  bkMk=max(lt,1.0-smoothstep(0.0009,0.0022,abs(r-0.2995)))*step(0.02,sd)*(1.0-smoothstep(0.6,1.2,bkFW*150.0)); diffuseColor.rgb=mix(diffuseColor.rgb,vec3(0.075,0.070,0.064),bkMk*0.9); }":"",
      /* MUD: splats flung back off the wheels (stretched along the bike) at two sizes, and a caked coat that creeps up from the lower parts, the rear, the undersides,
         the skid plate and the tyres as st.mud grows; wet (dark, glossy) and dry (light, rough) patches */
      "float mudK=0.0, bkWet=0.5;",
      "if(vMud.x>0.002){ float mud=vMud.x; float low=1.0-smoothstep(0.28,0.86,vLoc.y), rear=smoothstep(0.15,-0.95,vLoc.x)*0.35, under=smoothstep(0.15,-0.7,bkN.y)*0.55;",
      "  float w=mix(clamp(low*0.85+rear+under,0.0,1.4),0.80,bkW); if(bkK>3.5) w=max(w,1.15); if(bkK>1.5&&bkK<2.5) w=max(w,0.95);",
      "  vec2 sp=bkPP*vec2(bkAN.y>0.8?1.0:0.55,1.0); float d1=clamp(mud*(0.20+0.95*w),0.0,0.9), d2=clamp(mud*(0.28+1.15*w),0.0,0.94);",
      "  float nz=bkVN(bkPP*21.0,3)"+(std?"*0.62+bkVN(bkPP*63.0,4)*0.38":"")+"; float thr=1.0-mud*w*1.02; float coat=smoothstep(thr-0.13,thr+0.13,nz);",
      "  float f1=smoothstep(0.6,1.6,bkFW*36.0), c1=f1<0.999?mix(bkSplat(sp*36.0,d1,0.50,1u),d1*0.30,f1):d1*0.30;",
      std?"  float f2=smoothstep(0.6,1.6,bkFW*110.0), c2=f2<0.999?mix(bkSplat(sp*110.0,d2,0.46,2u),d2*0.30,f2):d2*0.30;\n  mudK=max(coat,max(c1,c2*0.9)); bkWet=bkVN(bkPP*14.0,6);"
         :"  mudK=max(coat,c1);",
      "  diffuseColor.rgb=mix(diffuseColor.rgb,uMudCol*(0.58+0.85*nz)*mix(1.25,0.75,bkWet),mudK); }",
      ""].join("\n"));
    if(std){
      fs=fs.replace("#include <roughnessmap_fragment>","float roughnessFactor=mix(mix(mix(mix(vMat.y,"+(phys?"0.42":"0.30")+",bkPl),0.62,bkMk*0.5),0.55,bkRib*0.6),mix(0.96,0.50,bkWet),mudK);")
           .replace("#include <metalnessmap_fragment>","float metalnessFactor=vMat.x*(1.0-mudK);");
      if(phys) fs=fs.replace("#include <lights_physical_fragment>","#include <lights_physical_fragment>\nmaterial.clearcoat*=bkPl*(1.0-mudK);");
      fs=fs.replace("#include <lights_fragment_maps>",THREE.ShaderChunk.lights_fragment_maps.replace("iblIrradiance += getIBLIrradiance( geometryNormal );",""));
      fs=fs.replace("#include <aomap_fragment>","reflectedLight.indirectDiffuse*=vMat.w;\n#ifdef USE_ENVMAP\nreflectedLight.indirectSpecular*=mix(vMat.w,1.0,0.35);\n#endif\n");
    } else fs=fs.replace("#include <aomap_fragment>","reflectedLight.indirectDiffuse*=vMat.w;\n");
    sh.fragmentShader=fs;
  };
  m.customProgramCacheKey=()=>"mxbike2-"+(phys?"phys":std?"std":"lam");
  m.addEventListener("dispose",()=>{ D.t.dispose(); });
  return m;
}
/* the wheel's blur disc (milestone 2, director note: "airborne and fast-spinning wheels are hollow hoops"): a translucent, lit disc in each plane of spokes, densest at the hub
   (where the spokes crowd), as the spokes thin out; one instanced draw per level of detail for both wheels of every bike, no shadow, faded near the lens like the bike */
function blurMaterial(){
  const m=new THREE.MeshLambertMaterial({color:0x9a9da6,transparent:true,depthWrite:false,side:THREE.DoubleSide});
  m.onBeforeCompile=sh=>{
    sh.vertexShader=sh.vertexShader.replace("#include <common>","#include <common>\nvarying float vBl;\nvarying vec2 vRd;").replace("#include <begin_vertex>","#include <begin_vertex>\nvBl=instanceColor.r; vRd=position.xy;");
    sh.fragmentShader=sh.fragmentShader.replace("#include <common>","#include <common>\nvarying float vBl;\nvarying vec2 vRd;").replace("#include <color_fragment>",
      "#include <color_fragment>\ndiffuseColor.rgb=diffuse;\n{ float r=length(vRd), an=atan(vRd.y,vRd.x); float a=vBl*(0.13+0.40*pow(0.19/max(r,0.19),1.35))*(0.86+0.14*cos(an*9.0));\n"+
      " a*=smoothstep(0.19,0.25,r)*(1.0-smoothstep(0.93,1.0,r))*smoothstep(0.8,1.7,vViewPosition.z); diffuseColor.a*=a; }");
  };
  m.customProgramCacheKey=()=>"mxbike2-blur";
  return m;
}

/* ---------------- createBike: the level-of-detail sets, one InstancedMesh per part ---------------- */
/* Each level of detail is a SET of instanced meshes. Bikes are packed into the slots 0..count-1 of the set their distance picks (the count is what is drawn, so
   a mid-distance bike costs nothing in the close set and the draw counters stay honest): slot, colour, accent and mud are rewritten every frame.
   Per slot only the instance matrix and the instance COLOUR change (both are what the replay records): instanceColor = (the bike's index + 0.5, the wheels' blur 0..0.9, mud 0..1);
   the team colour, the accent, the team's graphic style and the red plate are per bike in two uniform arrays (U.c, U.a) the shader reads by that index (a replay shows every bike in its own colours and numbers). */
const PARTS=["body","steer","fork","swing","shock","wheelF","wheelR"];
const _Z=new THREE.Matrix4().makeScale(0,0,0);
function instGeo(src){
  const g=new THREE.BufferGeometry(); g.setIndex(src.index); Object.keys(src.attributes).forEach(k=>g.setAttribute(k,src.attributes[k])); return g;
}
/* the blur discs' radius: the spokes' rim ends (front 21 inch, rear 19 inch rims) */
const BLUR_R=[0.2667-0.016,0.2413-0.016];
/* mk(geo, count, material): the instancing glue of r3d-riders.js; q = the quality options (optional) */
export function createBike(n,lo,mk,q){
  q=q||{}; const D=decalAtlas(n,lo), U={c:new Float32Array(NBK*4).fill(1),a:new Float32Array(NBK*4).fill(1)}, mat=bikeMaterial(lo,D,U), bmat=blurMaterial(), M={}, sets=[], d2=lo?null:buildBike(2), d1=buildBike(1);
  const mkSet=(lod,src,far)=>{
    const S={lod:lod,cnt:0,meshes:[],parts:{},far:null,blur:null,col:new THREE.InstancedBufferAttribute(new Float32Array(n*3),3)};
    S.col.setUsage(THREE.DynamicDrawUsage);
    const one=(name,geo)=>{ const m=mk(instGeo(geo),n,mat); m.instanceColor=S.col; m.castShadow=true; m.receiveShadow=!far&&!lo; m.count=0; m.visible=false; M["bk"+lod+"_"+name]=m; S.meshes.push(m); return m; };
    if(far) S.far=one("far",src); else { PARTS.forEach(k=>{ S.parts[k]=one(k,src[k]); });
      /* the wheels' blur discs: two instances a bike (front, rear), translucent, drawn after the opaque scene */
      S.blur=mk(buildBlurDisc(lod===0?32:20),n*2,bmat); S.blur.instanceColor=new THREE.InstancedBufferAttribute(new Float32Array(n*2*3),3); S.blur.instanceColor.setUsage(THREE.DynamicDrawUsage); S.blur.castShadow=false; S.blur.receiveShadow=false; S.blur.count=0; S.blur.visible=false; S.blur.renderOrder=3; M["bk"+lod+"_blur"]=S.blur; }
    sets.push(S); return S;
  };
  if(!lo) mkSet(0,d2); mkSet(1,d1); mkSet(2,buildFarBike(),true);
  M.bk={n:n,lo:!!lo,sets:sets,cur:new Int8Array(n).fill(-1),lastI:1e9,hiMax:q.bikeHi!=null?q.bikeHi:(lo?0:4),dist:new Float32Array(n).fill(1e9),cutD:1e9,pc:new Float32Array(n*3).fill(1),ac:new Float32Array(n*3).fill(1),
    /* the distances at which a bike leaves one level for the next (m): hysteresis of 8% */
    th:lo?[q.bikeLod&&q.bikeLod[0]||8]:(q.bikeLod&&q.bikeLod.length>1?q.bikeLod:[9.5,36]),sp:new Float32Array(n*2),
    /* milestone 2: the side-panel number atlas, each team's graphic style */
    dec:D,style:new Uint8Array(n),U:U};
  return M;
}
/* the team colours of rider i's bike: the plastics in the team colour, the graphics in the accent colour (written into the sets' instance attributes as the bikes are posed);
   milestone 2: the team's graphic style and the rider's number and name on the side panels */
const _col=new THREE.Color();
export function colorBike(M,i,R){
  const K=M.bk; _col.set(R.color||"#888"); K.pc[i*3]=_col.r; K.pc[i*3+1]=_col.g; K.pc[i*3+2]=_col.b;
  _col.set(R.accent||"#f2f2f6"); K.ac[i*3]=_col.r; K.ac[i*3+1]=_col.g; K.ac[i*3+2]=_col.b;
  K.style[i]=styleOf(R.color); if(K.dec) drawDecal(K.dec,i,R);
  if(i<NBK){ const c=K.U.c, a=K.U.a; c[i*4]=K.pc[i*3]; c[i*4+1]=K.pc[i*3+1]; c[i*4+2]=K.pc[i*3+2]; c[i*4+3]=K.style[i]+(R.red?8:0); a[i*4]=K.ac[i*3]; a[i*4+1]=K.ac[i*3+1]; a[i*4+2]=K.ac[i*3+2]; a[i*4+3]=0; }
}
/* the front number plate's face in the riders' atlas (milestone 2): the team-coloured plastic plate with a dark rim, the rider's name across its top, the number background
   in the class colours (PLATE_CLASS: 450 white with black numerals; the points leader red with white numerals), a gold ring for the person's own rider.
   x = the atlas canvas context, rr = rounded-rect path helper, fit = shrink the font to the plate, (px, py) = the cell's corner */
export function drawPlate(x,rr,fit,px,py,cell,R,t){
  const cl=R.red?PLATE_CLASS.red:(PLATE_CLASS[R.cls]||PLATE_CLASS[plateClass]||PLATE_CLASS["450"]), k=cell/128, nm=surname(R.name);
  x.fillStyle="#0b0b0e"; rr(px+2*k,py+4*k,cell-4*k,cell-8*k,19*k); x.fill();
  x.fillStyle=R.color||"#444"; rr(px+5*k,py+7*k,cell-10*k,cell-14*k,16*k); x.fill();
  const g=x.createLinearGradient(0,py+7*k,0,py+cell-7*k); g.addColorStop(0,"rgba(255,255,255,.16)"); g.addColorStop(0.45,"rgba(255,255,255,0)"); g.addColorStop(1,"rgba(0,0,0,.22)"); x.fillStyle=g; rr(px+5*k,py+7*k,cell-10*k,cell-14*k,16*k); x.fill();
  x.fillStyle=cl.bg; rr(px+12*k,py+29*k,cell-24*k,cell-44*k,10*k); x.fill();
  x.lineWidth=2.5*k; x.strokeStyle=R.me?"#f0c040":"rgba(0,0,0,.55)"; rr(px+12*k,py+29*k,cell-24*k,cell-44*k,10*k); x.stroke();
  x.textAlign="center"; x.textBaseline="middle";
  if(nm){ const c=new THREE.Color(R.color||"#444"), lum=0.2126*c.r+0.7152*c.g+0.0722*c.b; x.fillStyle=lum>0.45?"#121216":"#ffffff"; let fs=Math.round(15*k); x.font="800 "+fs+"px Manrope, system-ui, sans-serif"; while(x.measureText(nm).width>cell-30*k&&fs>8){ fs--; x.font="800 "+fs+"px Manrope, system-ui, sans-serif"; } x.fillText(nm,px+cell/2,py+18.5*k); }
  x.fillStyle=cl.fg; fit(t,cell-34*k,Math.round(70*k)); x.fillText(t,px+cell/2,py+cell/2+14*k);
  x.fillStyle="#2a2a2e"; [[px+15*k,py+15*k],[px+cell-15*k,py+15*k]].forEach(p=>{ x.beginPath(); x.arc(p[0],p[1],2.4*k,0,Math.PI*2); x.fill(); });
}

/* ---------------- posing ---------------- */
const _a=new THREE.Vector3(), _b=new THREE.Vector3(), _c=new THREE.Vector3(), _q1=new THREE.Quaternion(), _s1=new THREE.Vector3(1,1,1);
const _m1=new THREE.Matrix4(), _m2=new THREE.Matrix4(), _m3=new THREE.Matrix4(), _S=new THREE.Matrix4(), _F=new THREE.Matrix4(), _fw=new THREE.Vector3();
/* the number plates' fixed local matrices: the front plate (on the bars: it turns with them) and the two side plates */
const PLATE_F=new THREE.Matrix4().compose(new THREE.Vector3(0.508,1.035,0),new THREE.Quaternion().setFromEuler(new THREE.Euler(0,Math.PI/2,0.30,"ZYX")),new THREE.Vector3(0.25,0.215,1));
export const PLATE_L=[PLATE_F,
  new THREE.Matrix4().compose(new THREE.Vector3(-0.42,0.835,0.1505),new THREE.Quaternion().setFromEuler(new THREE.Euler(0,0,-0.03)),new THREE.Vector3(0.30,0.205,1)),
  new THREE.Matrix4().compose(new THREE.Vector3(-0.42,0.835,-0.1505),new THREE.Quaternion().setFromEuler(new THREE.Euler(0,Math.PI,0.03)),new THREE.Vector3(0.30,0.205,1))];
/* the steering: a turn of the front end about the steering axis (+ = to the right), as a matrix in bike space */
const _R=new THREE.Matrix4(), _T=new THREE.Matrix4();
export function steerMatrix(delta,out){
  out=out||new THREE.Matrix4(); out.makeTranslation(-A0.x,-A0.y,-A0.z); out.premultiply(_R.makeRotationAxis(UA,-delta)); out.premultiply(_T.makeTranslation(A0.x,A0.y,A0.z)); return out;
}
/* where a point of the bike's bars ends up when they are turned by delta (the grips: the rider's hands) */
export function steerPoint(p,delta,out){ out=out||new THREE.Vector3(); return out.copy(p).applyMatrix4(steerMatrix(delta,_m3)); }
BIKE.steerGain=1;   /* how much of the track's steering the bars show: all of it now that the rider's hands follow the grips (steerXYZ in r3d-rider-pose.js; it was 0.6 while the hands did not) */
/* the same turn of the bars for a plain point (no THREE objects: the rider's pose is plain arrays): (x, y, z) in bike space -> o[k], o[k+1], o[k+2] */
export function steerXYZ(x,y,z,delta,o,k){
  const c=Math.cos(-delta), s=Math.sin(-delta), px=x-A0.x, py=y-A0.y, pz=z-A0.z, d=UA.x*px+UA.y*py+UA.z*pz, u=1-c;   /* Rodrigues: a turn of -delta about the steering axis UA through A0 (steerMatrix) */
  o[k]=A0.x+px*c+(UA.y*pz-UA.z*py)*s+UA.x*d*u; o[k+1]=A0.y+py*c+(UA.z*px-UA.x*pz)*s+UA.y*d*u; o[k+2]=A0.z+pz*c+(UA.x*py-UA.y*px)*s+UA.z*d*u;
}
export function steerOf(st){ return steerAngle(st)*BIKE.steerGain; }
export function steerAngle(st){ if(st.steer!=null) return st.steer; const k=st.k||0; return clamp(Math.atan(BIKE.WB*k)*(st.air?0.25:1)*0.9,-BIKE.STEER_MAX,BIKE.STEER_MAX); }
function lodOf(K,i,d){
  if(d==null||!isFinite(d)) return 0;
  const nset=K.sets.length; let l=K.cur[i];
  if(l<0){ l=0; while(l<nset-1&&d>K.th[l]) l++; return l; }
  while(l<nset-1&&d>K.th[l]*1.08) l++;
  while(l>0&&d<K.th[l-1]*0.92) l--;
  return l;
}
/* the close level of detail (LOD 0, 21.8k triangles a bike, drawn twice with the shadow pass) is for the nearest q.bikeHi bikes only: the cut distance is the N-th nearest of the last frame (polish step, director note D6: the tier flag the bike never read) */
function capHi(K,l,d){ return (l===0&&!K.lo&&K.sets[0].lod===0&&(d>K.cutD||K.hiMax<=0))?1:l; }
/* every frame starts with the first bike posed or hidden again (the riders are posed in order, each once a frame): the sets are emptied */
function newFrame(K,i){ if(i<=K.lastI){ for(const S of K.sets){ S.cnt=0; for(const m of S.meshes){ m.count=0; m.visible=false; } if(S.blur){ S.blur.count=0; S.blur.visible=false; } }
    const n=K.n, hm=K.hiMax; if(hm>0&&hm<n){ const a=Array.prototype.slice.call(K.dist); a.sort((x,y)=>x-y); K.cutD=a[hm-1]+0.001; } else K.cutD=1e9; K.dist.fill(1e9); }
  K.lastI=i; }
/* the bike's pose: B = the bike's world matrix; st = the per-frame state (compF, compR, spinF, spinR, lodD, mud, steer, k) */
export function poseBike(M,i,B,st){
  const K=M.bk; newFrame(K,i);
  if(st.lodCut) K.cur[i]=-1;
  K.dist[i]=(st.lodD!=null&&isFinite(st.lodD))?st.lodD:1e9;
  const li=capHi(K,lodOf(K,i,st.lodD),st.lodD); K.cur[i]=li;
  const S0=K.sets[li], slot=S0.cnt++, cf=st.compF||0, cr=st.compR||0;
  /* how far the wheels turned since the last frame: past a spoke's spacing the spokes alias, so they fade (screen-door dither) as the wheel blurs */
  const dsp=Math.max(Math.abs((st.spinR||0)-K.sp[i*2+1]),Math.abs((st.spinF||0)-K.sp[i*2])); K.sp[i*2]=st.spinF||0; K.sp[i*2+1]=st.spinR||0;
  const blur=dsp>6?0:clamp((dsp-0.16)/0.5,0,0.9);
  for(const m of S0.meshes){ m.count=S0.cnt; m.visible=true; }
  /* this bike's colours and mud in its slot */
  S0.col.setXYZ(slot,Math.min(i,NBK-1)+0.5,blur,Math.max(st.mud||0,0.16)); S0.col.needsUpdate=true;   /* (polish: a bike in a main event is never clean: a floor of dirt on the lower parts, as the cover's) */
  if(i<NBK) K.U.c[i*4+3]=K.style[i]+(st.red?8:0);   /* the red plate follows st.red (V.setRed) */
  let delta=0;
  if(S0.far){ S0.far.setMatrixAt(slot,B); } else {
    const P=S0.parts; delta=steerOf(st);
    /* the steered frame S = B * steer; the lower fork slides up the fork axis by the compression */
    if(Math.abs(delta)>1e-4){ steerMatrix(delta,_m1); _S.multiplyMatrices(B,_m1); } else _S.copy(B);
    P.body.setMatrixAt(slot,B); P.steer.setMatrixAt(slot,_S);
    _a.copy(UA).multiplyScalar(cf); _m2.makeTranslation(_a.x,_a.y,_a.z); _F.multiplyMatrices(_S,_m2); P.fork.setMatrixAt(slot,_F);
    /* the front wheel: at the axle on the sliding fork, spinning about z */
    _q1.setFromAxisAngle(_c.set(0,0,1),-(st.spinF||0)); _a.copy(BIKE.FA).addScaledVector(UA,cf); _m1.compose(_a,_q1,_s1); _m2.multiplyMatrices(_S,_m1); P.wheelF.setMatrixAt(slot,_m2);
    if(S0.blur){ S0.blur.count=S0.cnt*2; S0.blur.visible=true; S0.blur.instanceColor.setXYZ(slot*2,blur,0,0); _m3.makeScale(BLUR_R[0],BLUR_R[0],1); _m1.multiplyMatrices(_m2,_m3); S0.blur.setMatrixAt(slot*2,_m1); }
    /* the swingarm pivots; the rear axle rides its arc */
    const sn=clamp((BIKE.RA.y+cr-BIKE.PIVOT.y)/ARM,-0.97,0.97), ang=-Math.asin(sn), rax=BIKE.PIVOT.x-ARM*Math.sqrt(1-sn*sn), ray=BIKE.PIVOT.y+sn*ARM;
    _q1.setFromAxisAngle(_c.set(0,0,1),ang); _m1.compose(BIKE.PIVOT,_q1,_s1); _m2.multiplyMatrices(B,_m1); P.swing.setMatrixAt(slot,_m2);
    _q1.setFromAxisAngle(_c.set(0,0,1),-(st.spinR||0)); _a.set(rax,ray,0); _m1.compose(_a,_q1,_s1); _m2.multiplyMatrices(B,_m1); P.wheelR.setMatrixAt(slot,_m2);
    if(S0.blur){ S0.blur.instanceColor.setXYZ(slot*2+1,blur,0,0); _m3.makeScale(BLUR_R[1],BLUR_R[1],1); _m1.multiplyMatrices(_m2,_m3); S0.blur.setMatrixAt(slot*2+1,_m1); S0.blur.instanceColor.needsUpdate=true; S0.blur.instanceMatrix.needsUpdate=true; }
    /* the shock: from the linkage (it rises as the wheel does) to the frame mount */
    _a.copy(BIKE.SHOCK_TOP).sub(BIKE.SHOCK_BOT).normalize(); _b.copy(BIKE.SHOCK_BOT).addScaledVector(_a,clamp(cr/BIKE.TRAVEL,-0.45,1)*BIKE.SHOCK_STROKE).applyMatrix4(B); _c.copy(BIKE.SHOCK_TOP).applyMatrix4(B);
    _fw.set(1,0,0).transformDirection(B); bone(P.shock,slot,_b,_c,1,_fw);
  }
  /* plates (fixed slots, 3 a bike): the front one turns with the bars, the sides stay on the panels */
  if(Math.abs(delta)>1e-4){ steerMatrix(delta,_m1); _m3.multiplyMatrices(_m1,PLATE_L[0]); _m2.multiplyMatrices(B,_m3); } else _m2.multiplyMatrices(B,PLATE_L[0]);
  M.plate.setMatrixAt(i*3,_m2);
  for(let k=1;k<3;k++) M.plate.setMatrixAt(i*3+k,_Z);   /* (milestone 2: the side numbers are painted on the side panels by the bike's shader: the old side quads are not drawn) */
}
export function hideBike(M,i){
  const K=M.bk; newFrame(K,i); K.cur[i]=-1; K.dist[i]=1e9;
  for(let k=0;k<3;k++) M.plate.setMatrixAt(i*3+k,_Z);
}
/* how many bikes each level of detail holds this frame (tests, the viewer) */
export function lodCounts(M){ return M.bk.sets.map(S=>S.cnt); }
/* the front plate (milestone 2): curved round the fork, its edges 2 cm back (the plate quad's local x across, z its face) */
export function plateGeo(){ const g=new THREE.PlaneGeometry(1,1,8,1), P=g.attributes.position; for(let i=0;i<P.count;i++){ const x=P.getX(i); P.setZ(i,-0.022*4*x*x); } g.computeVertexNormals(); return g; }
/* the old geometry names (the model is r3d-bike-model.js now): the close body and the wheels */
export function chassisGeo(){ return buildBike(1).body; }
export function wheelGeo(){ return buildWheel(1,true); }
export function plasticsGeo(){ return buildBike(1).body; }
export function trimGeo(){ return buildBike(1).steer; }
export function forkGeo(){ return buildBike(1).fork; }
export function swingGeo(){ return buildBike(1).swing; }
const V3=(x,y,z)=>new THREE.Vector3(x,y,z);
export {V3};
export function tube(a,b,r,c,seg,capped){ const d=new THREE.Vector3().subVectors(b,a), len=d.length(), g=new THREE.CylinderGeometry(r,r,len,seg||6,1,!capped); g.translate(0,len/2,0);
  g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),d.normalize())); g.translate(a.x,a.y,a.z); return g; }
export {triCount};
