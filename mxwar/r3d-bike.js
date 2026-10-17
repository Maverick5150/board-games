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
import {bone,canvas,clamp,lin} from "./r3d-util.js";
import {BIKE,buildBike,buildFarBike,buildWheel,triCount,MAT,UA,A0,ARM} from "./r3d-bike-model.js";
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
/* the livery: one mask, red = the accent colour, green = black, blue = white. The upper half is the side view (x -1.2..0.6 across, y 0.45..1.2 up),
   the lower half the view from above (x across, z up the picture) for the fenders. */
function liveryTexture(size){
  const c=canvas(size,size), x=c.getContext("2d"), K=size/512, u=px=>px*K;
  x.fillStyle="#000"; x.fillRect(0,0,size,size);
  const X=xx=>(xx+1.2)/2.4*512, Y=yy=>256-(yy-0.45)/0.75*256;                 /* bike side view -> pixels (upper half) */
  const poly=(pts,col)=>{ x.fillStyle=col; x.beginPath(); pts.forEach((p,k)=>{ const a=X(p[0])*K, b=Y(p[1])*K; if(k) x.lineTo(a,b); else x.moveTo(a,b); }); x.closePath(); x.fill(); };
  /* the shroud: a swoosh from the lower front sweeping up and back, a dark lower edge */
  poly([[0.52,0.60],[0.44,0.63],[0.30,0.73],[0.15,0.86],[0.03,0.945],[-0.05,0.95],[0.10,0.84],[0.25,0.71],[0.40,0.60]],"rgb(255,0,0)");
  poly([[0.52,0.585],[0.40,0.585],[0.30,0.64],[0.20,0.70],[0.10,0.72],[0.18,0.665],[0.30,0.61]],"rgb(0,255,0)");
  /* the side panel: a wedge and a thin line behind it */
  poly([[-0.04,0.735],[-0.30,0.775],[-0.55,0.80],[-0.80,0.835],[-0.80,0.90],[-0.55,0.86],[-0.30,0.84],[-0.04,0.80]],"rgb(255,0,0)");
  poly([[-0.04,0.715],[-0.34,0.745],[-0.80,0.805],[-0.80,0.82],[-0.34,0.76],[-0.04,0.73]],"rgb(0,0,255)");
  /* the airbox cover and the rear: a block of the accent colour */
  poly([[-0.62,0.935],[-0.80,0.945],[-0.80,0.965],[-0.62,0.955]],"rgb(255,0,0)");
  /* from above: a centre stripe along the rear fender, a band on the front fender */
  const zrow=z=>(1-0.5*clamp(0.5+z*2.6,0,1))*512*K, XT=xx=>X(xx)*K;
  x.fillStyle="rgb(255,0,0)"; x.fillRect(XT(-1.14),zrow(0.026),XT(-0.40)-XT(-1.14),zrow(-0.026)-zrow(0.026)); x.fillRect(XT(0.55),zrow(0.022),XT(1.12)-XT(0.55),zrow(-0.022)-zrow(0.022));
  x.fillStyle="rgb(0,255,0)"; x.fillRect(XT(0.55),zrow(0.058),XT(1.12)-XT(0.55),zrow(0.040)-zrow(0.058)); x.fillRect(XT(0.55),zrow(-0.040),XT(1.12)-XT(0.55),zrow(-0.058)-zrow(-0.040));
  x.fillStyle="rgb(0,0,255)"; x.fillRect(XT(-1.14),zrow(0.058),XT(-0.40)-XT(-1.14),zrow(0.044)-zrow(0.058)); x.fillRect(XT(-1.14),zrow(-0.044),XT(-0.40)-XT(-1.14),zrow(-0.058)-zrow(-0.044));
  const t=new THREE.CanvasTexture(c); t.colorSpace=THREE.NoColorSpace; t.wrapS=t.wrapT=THREE.ClampToEdgeWrapping; t.anisotropy=4; t.generateMipmaps=true; t.minFilter=THREE.LinearMipmapLinearFilter; return t;
}
function tex(lo){ const k=lo?"lo":"hi"; if(!TEX[k]) TEX[k]={env:lo?null:envTexture(256),liv:liveryTexture(lo?256:512)}; return TEX[k]; }

/* ---------------- the material ---------------- */
const GLSL_NOISE="float bkHash(vec3 p){ p=fract(p*0.3183099+0.1); p*=17.0; return fract(p.x*p.y*p.z*(p.x+p.y+p.z)); }\n"+
  "float bkNoise(vec3 x){ vec3 i=floor(x), f=fract(x); f=f*f*(3.0-2.0*f); return mix(mix(mix(bkHash(i),bkHash(i+vec3(1,0,0)),f.x),mix(bkHash(i+vec3(0,1,0)),bkHash(i+vec3(1,1,0)),f.x),f.y),mix(mix(bkHash(i+vec3(0,0,1)),bkHash(i+vec3(1,0,1)),f.x),mix(bkHash(i+vec3(0,1,1)),bkHash(i+vec3(1,1,1)),f.x),f.y),f.z); }\n";
function bikeMaterial(lo){
  const T=tex(lo), std=!lo;
  const m=std?new THREE.MeshStandardMaterial({vertexColors:true,roughness:1,metalness:0,envMap:T.env,envMapIntensity:1.7}):new THREE.MeshLambertMaterial({vertexColors:true});
  m.userData.keepMaps=true;
  m.onBeforeCompile=sh=>{
    sh.uniforms.uLiv={value:T.liv}; sh.uniforms.uMudCol={value:new THREE.Vector3(0.115,0.066,0.032)};
    sh.vertexShader=sh.vertexShader
      .replace("#include <common>","#include <common>\nattribute vec4 aMat;\nattribute vec3 aAccent;\nattribute vec3 aMud;\nvarying vec4 vMat;\nvarying vec3 vAcc;\nvarying vec3 vMud;\nvarying vec3 vLoc;\nvarying vec2 vLiv;")
      .replace("#include <color_vertex>","#include <color_vertex>\n{ float wl=step(7.5,aMat.z); float tn=aMat.z-8.0*wl; tn-=4.0*step(3.5,tn); float sty=aMud.y; vec3 fc=sty>0.5&&sty<1.5?vec3(0.86):(sty>1.5&&sty<2.5?aAccent:instanceColor.rgb); vec3 tint=tn<0.5?vec3(1.0):(tn<1.5?instanceColor.rgb:(tn<2.5?aAccent:fc)); vColor.rgb=color.rgb*tint; }\nvMat=aMat; vAcc=aAccent; vMud=aMud; vLoc=position; vLiv=uv;");
    let fs=sh.fragmentShader.replace("#include <common>","#include <common>\nuniform sampler2D uLiv;\nuniform vec3 uMudCol;\nvarying vec4 vMat;\nvarying vec3 vAcc;\nvarying vec3 vMud;\nvarying vec3 vLoc;\nvarying vec2 vLiv;\n"+(std?GLSL_NOISE:""));
    fs=fs.replace("#include <color_fragment>",
      "#include <color_fragment>\n"+
      "float bkWl=step(7.5,vMat.z); float bkTn=vMat.z-8.0*bkWl; float bkSp=step(3.5,bkTn); bkTn-=4.0*bkSp;\n"+
      "if(bkSp>0.5&&vMud.z>0.02){ if(fract(sin(dot(gl_FragCoord.xy,vec2(12.9898,78.233)))*43758.5453)<vMud.z) discard; }\n"+
      "{ float lk=step(0.5,bkTn)*(1.0-step(1.5,bkTn))+step(2.5,bkTn)*0.85; vec3 lv=texture2D(uLiv,vLiv).rgb; float sty=vMud.y; vec3 b0=diffuseColor.rgb; vec3 cA=vAcc, cB=vec3(0.010), cC=vec3(0.80);\n"+
      "  if(sty>0.5&&sty<1.5){ cA=vec3(0.010); cB=vAcc; } else if(sty>1.5&&sty<2.5){ cA=vec3(0.80); cC=vAcc; } else if(sty>2.5){ cA=vAcc; cB=vec3(0.80); cC=vec3(0.010); }\n"+
      "  b0=mix(b0,cA,lv.r*lk); b0=mix(b0,cB,lv.g*lk); b0=mix(b0,cC,lv.b*lk); diffuseColor.rgb=b0; }\n"+
      "float mudK=0.0;\n"+
      (std?"if(vMud.x>0.002){ float hm=mix(1.0-smoothstep(0.28,0.80,vLoc.y),0.46,bkWl); float nz=bkNoise(vLoc*(bkWl>0.5?34.0:30.0))*0.60+bkNoise(vLoc*95.0+7.3)*0.40; float thr=1.0-vMud.x*(0.38+1.30*hm); mudK=smoothstep(thr-0.17,thr+0.17,nz); diffuseColor.rgb=mix(diffuseColor.rgb,uMudCol*(0.62+0.75*nz),mudK); }\n"
          :"if(vMud.x>0.002){ float hm=mix(1.0-smoothstep(0.28,0.80,vLoc.y),0.62,bkWl); mudK=clamp(vMud.x*(0.30+1.2*hm)*1.1-0.12,0.0,1.0)*0.85; diffuseColor.rgb=mix(diffuseColor.rgb,uMudCol*1.2,mudK); }\n"));
    if(std){
      fs=fs.replace("#include <roughnessmap_fragment>","float roughnessFactor=mix(vMat.y,0.94,mudK);").replace("#include <metalnessmap_fragment>","float metalnessFactor=vMat.x*(1.0-mudK);");
      fs=fs.replace("#include <lights_fragment_maps>",THREE.ShaderChunk.lights_fragment_maps.replace("iblIrradiance += getIBLIrradiance( geometryNormal );",""));
      fs=fs.replace("#include <aomap_fragment>","reflectedLight.indirectDiffuse*=vMat.w;\n#ifdef USE_ENVMAP\nreflectedLight.indirectSpecular*=mix(vMat.w,1.0,0.35);\n#endif\n");
    } else fs=fs.replace("#include <aomap_fragment>","reflectedLight.indirectDiffuse*=vMat.w;\n");
    sh.fragmentShader=fs;
  };
  m.customProgramCacheKey=()=>"mxbike-"+(std?"std":"lam");
  return m;
}

/* ---------------- createBike: the level-of-detail sets, one InstancedMesh per part ---------------- */
/* Each level of detail is a SET of instanced meshes. Bikes are packed into the slots 0..count-1 of the set their distance picks (the count is what is drawn, so
   a mid-distance bike costs nothing in the close set and the draw counters stay honest): slot, colour, accent and mud are rewritten every frame. */
const PARTS=["body","steer","fork","swing","shock","wheelF","wheelR"];
const _Z=new THREE.Matrix4().makeScale(0,0,0);
function instGeo(src,S){
  const g=new THREE.BufferGeometry(); g.setIndex(src.index); Object.keys(src.attributes).forEach(k=>g.setAttribute(k,src.attributes[k]));
  g.setAttribute("aAccent",S.acc); g.setAttribute("aMud",S.mud); return g;
}
/* mk(geo, count, material): the instancing glue of r3d-riders.js; q = the quality options (optional) */
export function createBike(n,lo,mk,q){
  q=q||{}; const mat=bikeMaterial(lo), M={}, sets=[], d2=lo?null:buildBike(2), d1=buildBike(1);
  const mkSet=(lod,src,far)=>{
    const S={lod:lod,cnt:0,meshes:[],parts:{},far:null,col:new THREE.InstancedBufferAttribute(new Float32Array(n*3).fill(1),3),acc:new THREE.InstancedBufferAttribute(new Float32Array(n*3).fill(1),3),mud:new THREE.InstancedBufferAttribute(new Float32Array(n*3),3)};
    S.col.setUsage(THREE.DynamicDrawUsage); S.acc.setUsage(THREE.DynamicDrawUsage); S.mud.setUsage(THREE.DynamicDrawUsage);
    const one=(name,geo)=>{ const m=mk(instGeo(geo,S),n,mat); m.instanceColor=S.col; m.castShadow=true; m.receiveShadow=!far&&!lo; m.count=0; m.visible=false; M["bk"+lod+"_"+name]=m; S.meshes.push(m); return m; };
    if(far) S.far=one("far",src); else PARTS.forEach(k=>{ S.parts[k]=one(k,src[k]); });
    sets.push(S); return S;
  };
  if(!lo) mkSet(0,d2); mkSet(1,d1); mkSet(2,buildFarBike(),true);
  M.bk={n:n,lo:!!lo,sets:sets,cur:new Int8Array(n).fill(-1),lastI:1e9,pc:new Float32Array(n*3).fill(1),ac:new Float32Array(n*3).fill(1),
    /* the distances at which a bike leaves one set for the next (m): hysteresis of 8% */
    th:lo?[8]:[9.5,36],sp:new Float32Array(n*2)};
  return M;
}
/* the team colours of rider i's bike: the plastics in the team colour, the graphics in the accent colour (written into the sets' instance attributes as the bikes are posed) */
const _col=new THREE.Color();
export function colorBike(M,i,R){
  const K=M.bk; _col.set(R.color||"#888"); K.pc[i*3]=_col.r; K.pc[i*3+1]=_col.g; K.pc[i*3+2]=_col.b;
  _col.set(R.accent||"#f2f2f6"); K.ac[i*3]=_col.r; K.ac[i*3+1]=_col.g; K.ac[i*3+2]=_col.b;
}
/* the number plate's face in the riders' atlas: a black plastic plate, the white (or red, for the points leader) face with the team colour across its top,
   a black (white on red) number; x = the atlas canvas context, rr = rounded-rect path helper, fit = shrink the font to the plate, (px, py) = the cell's corner */
export function drawPlate(x,rr,fit,px,py,cell,R,t){
  x.fillStyle="#0b0b0e"; rr(px+1,py+7,cell-2,cell-14,17); x.fill();
  x.fillStyle=R.red?"#c8101c":"#f4f1e8"; rr(px+5,py+11,cell-10,cell-22,12); x.fill();
  x.save(); rr(px+5,py+11,cell-10,cell-22,12); x.clip(); x.fillStyle=R.color||"#444"; x.fillRect(px+5,py+11,cell-10,14);
  const g=x.createLinearGradient(0,py+11,0,py+cell-11); g.addColorStop(0,"rgba(255,255,255,.0)"); g.addColorStop(1,"rgba(0,0,0,.10)"); x.fillStyle=g; x.fillRect(px+5,py+25,cell-10,cell-36); x.restore();
  x.lineWidth=4; x.strokeStyle=R.me?"#f0c040":"rgba(0,0,0,.6)"; rr(px+5,py+11,cell-10,cell-22,12); x.stroke();
  x.fillStyle=R.red?"#ffffff":"#121216"; x.textAlign="center"; x.textBaseline="middle"; fit(t,cell-24,84); x.fillText(t,px+cell/2,py+cell/2+9);
  x.fillStyle="#2a2a2e"; [[px+14,py+17],[px+cell-14,py+17]].forEach(p=>{ x.beginPath(); x.arc(p[0],p[1],2.4,0,Math.PI*2); x.fill(); });
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
BIKE.steerGain=0.6;   /* how much of the track's steering the bars show (the rider's hands must follow: steerOf) */
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
/* every frame starts with the first bike posed or hidden again (the riders are posed in order, each once a frame): the sets are emptied */
function newFrame(K,i){ if(i<=K.lastI){ for(const S of K.sets){ S.cnt=0; for(const m of S.meshes){ m.count=0; m.visible=false; } } } K.lastI=i; }
/* the bike's pose: B = the bike's world matrix; st = the per-frame state (compF, compR, spinF, spinR, lodD, mud, steer, k) */
export function poseBike(M,i,B,st){
  const K=M.bk; newFrame(K,i);
  if(st.lodCut) K.cur[i]=-1;
  const li=lodOf(K,i,st.lodD); K.cur[i]=li;
  const S0=K.sets[li], slot=S0.cnt++, cf=st.compF||0, cr=st.compR||0;
  /* how far the wheels turned since the last frame: past a spoke's spacing the spokes alias, so they fade (screen-door dither) as the wheel blurs */
  const dsp=Math.max(Math.abs((st.spinR||0)-K.sp[i*2+1]),Math.abs((st.spinF||0)-K.sp[i*2])); K.sp[i*2]=st.spinF||0; K.sp[i*2+1]=st.spinR||0;
  const blur=dsp>6?0:clamp((dsp-0.16)/0.5,0,0.9);
  for(const m of S0.meshes){ m.count=S0.cnt; m.visible=true; }
  /* this bike's colours and mud in its slot */
  S0.col.setXYZ(slot,K.pc[i*3],K.pc[i*3+1],K.pc[i*3+2]); S0.acc.setXYZ(slot,K.ac[i*3],K.ac[i*3+1],K.ac[i*3+2]); S0.mud.setXYZ(slot,st.mud||0,i%4,blur);
  S0.col.needsUpdate=true; S0.acc.needsUpdate=true; S0.mud.needsUpdate=true;
  let delta=0;
  if(S0.far){ S0.far.setMatrixAt(slot,B); } else {
    const P=S0.parts; delta=steerOf(st);
    /* the steered frame S = B * steer; the lower fork slides up the fork axis by the compression */
    if(Math.abs(delta)>1e-4){ steerMatrix(delta,_m1); _S.multiplyMatrices(B,_m1); } else _S.copy(B);
    P.body.setMatrixAt(slot,B); P.steer.setMatrixAt(slot,_S);
    _a.copy(UA).multiplyScalar(cf); _m2.makeTranslation(_a.x,_a.y,_a.z); _F.multiplyMatrices(_S,_m2); P.fork.setMatrixAt(slot,_F);
    /* the front wheel: at the axle on the sliding fork, spinning about z */
    _q1.setFromAxisAngle(_c.set(0,0,1),-(st.spinF||0)); _a.copy(BIKE.FA).addScaledVector(UA,cf); _m1.compose(_a,_q1,_s1); _m2.multiplyMatrices(_S,_m1); P.wheelF.setMatrixAt(slot,_m2);
    /* the swingarm pivots; the rear axle rides its arc */
    const sn=clamp((BIKE.RA.y+cr-BIKE.PIVOT.y)/ARM,-0.97,0.97), ang=-Math.asin(sn), rax=BIKE.PIVOT.x-ARM*Math.sqrt(1-sn*sn), ray=BIKE.PIVOT.y+sn*ARM;
    _q1.setFromAxisAngle(_c.set(0,0,1),ang); _m1.compose(BIKE.PIVOT,_q1,_s1); _m2.multiplyMatrices(B,_m1); P.swing.setMatrixAt(slot,_m2);
    _q1.setFromAxisAngle(_c.set(0,0,1),-(st.spinR||0)); _a.set(rax,ray,0); _m1.compose(_a,_q1,_s1); _m2.multiplyMatrices(B,_m1); P.wheelR.setMatrixAt(slot,_m2);
    /* the shock: from the linkage (it rises as the wheel does) to the frame mount */
    _a.copy(BIKE.SHOCK_TOP).sub(BIKE.SHOCK_BOT).normalize(); _b.copy(BIKE.SHOCK_BOT).addScaledVector(_a,clamp(cr/BIKE.TRAVEL,-0.45,1)*BIKE.SHOCK_STROKE).applyMatrix4(B); _c.copy(BIKE.SHOCK_TOP).applyMatrix4(B);
    _fw.set(1,0,0).transformDirection(B); bone(P.shock,slot,_b,_c,1,_fw);
  }
  /* plates (fixed slots, 3 a bike): the front one turns with the bars, the sides stay on the panels */
  if(Math.abs(delta)>1e-4){ steerMatrix(delta,_m1); _m3.multiplyMatrices(_m1,PLATE_L[0]); _m2.multiplyMatrices(B,_m3); } else _m2.multiplyMatrices(B,PLATE_L[0]);
  M.plate.setMatrixAt(i*3,_m2);
  for(let k=1;k<3;k++){ _m2.multiplyMatrices(B,PLATE_L[k]); M.plate.setMatrixAt(i*3+k,_m2); }
}
export function hideBike(M,i){
  const K=M.bk; newFrame(K,i); K.cur[i]=-1;
  for(let k=0;k<3;k++) M.plate.setMatrixAt(i*3+k,_Z);
}
/* how many bikes each level of detail holds this frame (tests, the viewer) */
export function lodCounts(M){ return M.bk.sets.map(S=>S.cnt); }
export function plateGeo(){ return new THREE.PlaneGeometry(1,1); }
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
