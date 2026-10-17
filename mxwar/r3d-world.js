/* MOTOCROSS WAR 3D — THE WORLD AROUND THE TRACK (owner: stadium): the stands and the crowd, the suites, the padded wall, the light rigs and
   their glow, the big screen, the sky, the start gate, the finish line and its flag stand, the flaggers and flag textures, the outdoor
   terrain with trees, spectators, paddock and clouds, the speedway infield. Built once per layout from course.js (ES module, three.js r160
   vendored at ui/vendor). Original art only: every texture is drawn in code, every model is plain geometry; no logos, no sponsor marks,
   no copied maps, no text but lap numbers on the big screen.
   buildWorld(C, look, q) -> {root, ctx, track, fin, info, matTrack, dirt, frame}. q = quality {lo: reduce effects}. The track surface itself
   is r3d-track.js (buildWorld calls trackMaterial() and addTrack() there). Draw calls are kept low: the stands, the crowd, the lights'
   glow (one instanced mesh), the trees (two), the gate pads (one), the flaggers.
   Moved out of the old one-file r3d-world.js byte for byte (the file split: no visual change). */
import * as THREE_NS from "../ui/vendor/three-0.160.0.module.min.js";
const THREE=THREE_NS;
import {lin,mixc,clamp,sstep,fbm,pfbm,canvas,tex,rngf,merge,paint,xf,clear,getAniso} from "./r3d-util.js";
import {SOIL,dirtMaps,padMaps,trackMaterial,addTrack} from "./r3d-track.js";
import {stadium as stadiumBowl,glowSprites} from "./r3d-stadium-bowl.js";
import {glowSheet,BRAND,PROPS,propsUV,propsTex} from "./r3d-stadium-art.js";
const MXG=(typeof window!=="undefined"?window:globalThis).MXWar;
const CO=()=>MXG.Course;

/* ---------------- textures drawn in code ---------------- */
function grassTex(lo){
  /* a lawn that tiles: soft clumps, blades, a little dry straw; the green itself is in the vertex colours */
  const W=lo?256:512, c=canvas(W,W), x=c.getContext("2d"), id=x.createImageData(W,W), d=id.data, R=rngf(99);
  /* polish: calmer (the fine noise was a fuzzy carpet up close), a soft clump scale and a little dry straw */
  for(let j=0;j<W;j++) for(let i=0;i<W;i++){ const u=i/W, v=j/W, n=pfbm(u*6,v*6,6,4), m=pfbm(u*48,v*48,48,2), p=(j*W+i)*4, s=pfbm(u*12+5,v*12,12,2), c2=pfbm(u*20+3,v*20+7,20,2);
    const lv=clamp(0.84+(n-0.5)*0.3+(c2-0.5)*0.16+(m-0.5)*0.16+(R()-0.5)*0.05,0.5,1.06), dry=clamp((s-0.58)*2.2,0,0.6);
    d[p]=clamp(lv*(232+dry*30),0,255); d[p+1]=clamp(lv*252,0,255); d[p+2]=clamp(lv*(200-dry*40),0,255); d[p+3]=255; }
  x.putImageData(id,0,0);
  return tex(c,true);
}
/* the crowd: people at real size (a seat 0.55 m, a row 0.85 m up the slope), round heads and shoulders in soft shading, empty seats,
   aisles every 16 seats, the row risers in shadow; at night darker, with the odd phone light. Polish: the old crowd packed four people
   into a metre with hard rectangles, a shimmering mosaic up close. */
const CROWD={cols:64,rows:16,seat:0.55,row:0.85};
function crowdTex(lo,night){
  const cols=CROWD.cols, rows=CROWD.rows, cw=lo?8:16, rh=lo?14:28, W=cols*cw, H=rows*rh, c=canvas(W,H), x=c.getContext("2d"), R=rngf(77);
  x.fillStyle=night?"#16141c":"#3a3b44"; x.fillRect(0,0,W,H);
  const shirts=night?["#9a958e","#8a2a34","#2e4384","#a08a4a","#34343c","#3f6e40","#a2602e","#62626e","#b0b0b6","#54382a","#38507a","#6a3e6c","#2c2c34","#7a7a80"]:
    ["#ece8e0","#c8102e","#1f4fc4","#f2cf1d","#2a2a2a","#57b947","#ff7a1a","#8a8a96","#f4f4f6","#6b3f2a","#3a5ba0","#d6d0c6","#9a1c28"];
  const skin=["#e0b48c","#8d5a3b","#c58c63","#5a3a26","#ecc8a2","#a8714c"], hair=["#2a1e16","#4a3020","#141216","#7a5a36","#b89a6a"];
  const seatC=night?"#23233a":"#2f3a5a";
  for(let r=0;r<rows;r++){
    const y0=r*rh;
    x.fillStyle=night?"#0c0b10":"#262630"; x.fillRect(0,y0+rh*0.86,W,rh*0.14);   /* the riser in shadow */
    for(let k=0;k<cols;k++){
      const px=k*cw;
      if(k%16===0){ x.fillStyle=night?"#2a2832":"#6a6a72"; x.fillRect(px,y0,cw,rh); x.fillStyle=night?"#38363f":"#7c7c84"; x.fillRect(px,y0+rh*0.8,cw,rh*0.06); continue; }   /* an aisle */
      if(R()<0.12){ x.fillStyle=seatC; x.fillRect(px+cw*0.12,y0+rh*0.42,cw*0.76,rh*0.4); continue; }   /* an empty seat */
      const sh=shirts[Math.floor(R()*shirts.length)], up=R()<0.07, lean=(R()-0.5)*cw*0.12;
      /* shoulders and body: a rounded block, lighter on top */
      const g=x.createLinearGradient(0,y0+rh*0.36,0,y0+rh*0.86); g.addColorStop(0,sh); g.addColorStop(1,night?"#0e0d12":"#20202a");
      x.fillStyle=g; x.beginPath(); x.ellipse(px+cw*0.5+lean,y0+rh*0.62,cw*0.42,rh*0.27,0,0,7); x.fill();
      if(up){ x.fillStyle=sh; x.fillRect(px+cw*0.1+lean,y0+rh*0.06,cw*0.14,rh*0.4); x.fillRect(px+cw*0.76+lean,y0+rh*0.06,cw*0.14,rh*0.4); }
      /* the head: skin, hair or a cap */
      x.fillStyle=skin[Math.floor(R()*skin.length)]; x.beginPath(); x.ellipse(px+cw*0.5+lean,y0+rh*0.3,cw*0.21,rh*0.13,0,0,7); x.fill();
      x.fillStyle=R()<0.3?shirts[Math.floor(R()*shirts.length)]:hair[Math.floor(R()*hair.length)]; x.beginPath(); x.ellipse(px+cw*0.5+lean,y0+rh*0.24,cw*0.22,rh*0.08,0,Math.PI,0); x.fill();
    }
  }
  if(night) for(let i=0;i<(lo?16:50);i++){ x.fillStyle="rgba(255,250,232,"+(0.7+R()*0.3)+")"; x.beginPath(); x.arc(R()*W,R()*H,lo?0.8:1.3,0,7); x.fill(); }
  const t=tex(c,true); t.anisotropy=getAniso(); return t;
}
function glowTex(){
  const c=canvas(64,64), x=c.getContext("2d"), g=x.createRadialGradient(32,32,0,32,32,32);
  g.addColorStop(0,"rgba(255,255,255,1)"); g.addColorStop(0.18,"rgba(255,246,220,.85)"); g.addColorStop(0.5,"rgba(255,230,180,.18)"); g.addColorStop(1,"rgba(255,230,180,0)");
  x.fillStyle=g; x.fillRect(0,0,64,64); const t=new THREE.CanvasTexture(c); t.colorSpace=THREE.SRGBColorSpace; return t;
}
function checkerTex(){
  const c=canvas(64,16), x=c.getContext("2d"); for(let i=0;i<16;i++) for(let j=0;j<4;j++){ x.fillStyle=(i+j)%2?"#111114":"#f4f1e8"; x.fillRect(i*4,j*4,4,4); }
  const t=tex(c,true); t.magFilter=THREE.NearestFilter; return t;
}

/* (the starting pad's dirt maps are cached by r3d-track.js padMaps) */
/* ---------------- steel and banners: plain parts with baked face shading on one props texture (the start gate and the finish arch are each ONE draw call) ---------------- */
const _SL=new THREE.Vector3(0.3,0.8,0.5).normalize();
function steelPart(g,rgb,k){ g=g.index?g.toNonIndexed():g; const m=g.attributes.position.count, N=g.attributes.normal, c=new Float32Array(m*3), uv=new Float32Array(m*2);
  for(let i=0;i<m;i++){ const sh=(0.5+0.5*Math.max(0,N.getX(i)*_SL.x+N.getY(i)*_SL.y+N.getZ(i)*_SL.z))*(k||1); c[i*3]=rgb[0]*sh; c[i*3+1]=rgb[1]*sh; c[i*3+2]=rgb[2]*sh; uv[i*2]=0.01; uv[i*2+1]=0.03; }
  g.setAttribute("color",new THREE.BufferAttribute(c,3)); g.setAttribute("uv",new THREE.BufferAttribute(uv,2)); return g; }
/* a light: no shading, brighter than white (the frame's bloom picks it up) */
function lampPart(g,rgb){ g=steelPart(g,rgb,1); const c=g.attributes.color; for(let i=0;i<c.count;i++) c.setXYZ(i,rgb[0],rgb[1],rgb[2]); return g; }
function bannerQuad(w,h,rect,face){ const g=new THREE.PlaneGeometry(w,h), uv=g.attributes.uv, r=propsUV(rect), m=g.attributes.position.count, c=new Float32Array(m*3).fill(1);
  for(let i=0;i<m;i++) uv.setXY(i,r[0]+(r[2]-r[0])*uv.getX(i),r[1]+(r[3]-r[1])*uv.getY(i)); g.rotateY(face>0?Math.PI/2:-Math.PI/2); g.setAttribute("color",new THREE.BufferAttribute(c,3)); return g; }
function propsMesh(parts){ const t=propsTex(), m=new THREE.MeshBasicMaterial({map:t,vertexColors:true,side:THREE.DoubleSide}); m.userData.keepMaps=true; return new THREE.Mesh(merge(parts),m); }   /* the props texture is shared: never freed with a gate or a world */
/* a truss: two chords, struts and zig-zag braces, along z from -len/2 to len/2 */
function trussParts(len,y,x,steel,lamp,nLamps){ const P=[], cs=0.5, st=1.2;
  P.push(xf(steelPart(new THREE.BoxGeometry(0.16,0.16,len),steel),x,y+cs/2,0), xf(steelPart(new THREE.BoxGeometry(0.16,0.16,len),steel),x,y-cs/2,0));
  const nn=Math.max(2,Math.round(len/st)); for(let i=0;i<=nn;i++){ const z=-len/2+len*i/nn; P.push(xf(steelPart(new THREE.BoxGeometry(0.08,cs,0.08),steel),x,y,z)); if(i<nn){ const zc=z+len/nn/2, L=Math.hypot(cs,len/nn), a=Math.atan2(len/nn,cs); P.push(xf(steelPart(new THREE.BoxGeometry(0.06,L,0.06),steel,0.9),x,y,zc,a*(i%2?1:-1)+0,0,0)); } }
  for(let i=0;i<nLamps;i++){ const z=-len/2+len*(i+0.5)/nLamps; P.push(xf(lampPart(new THREE.BoxGeometry(0.28,0.2,0.28),lamp),x+0.12,y-cs/2-0.18,z)); }
  return P; }

/* ---------------- the starting gate: a long beam, one pad per rider slot, the concrete pad behind it ---------------- */
function gateBuild(C,look,n){
  const Co=CO(), grp=new THREE.Group(), o={};
  let f; if(C.S&&C.S.n) f=Co.startFrame(C,C.gateAt||2,o); else f=Co.frame(C,C.join+(C.gateAt||0),o);
  const th=f.th, gw=Math.max(n*0.9,C.gateW*0.92), slots=Math.max(n,Math.round(gw/0.9)), pad=gw/slots;
  const beamG=new THREE.BoxGeometry(0.16,0.16,gw+0.6); const beam=new THREE.Mesh(beamG,new THREE.MeshLambertMaterial({color:0x4a4d55})); beam.position.set(0,0.12,0); grp.add(beam);
  const padG=new THREE.BoxGeometry(0.05,0.55,pad*0.86); padG.translate(0,0.275,0);
  const pads=new THREE.InstancedMesh(padG,new THREE.MeshLambertMaterial({color:0xb9bcc4}),slots);
  pads.frustumCulled=false;
  /* the concrete pad behind the gate */
  /* the packed starting pad behind the gate: hard dirt with the floor's grain (polish: it was a flat brown slab from above) */
  const sk=look.soil||"stadium-dirt", pm=padMaps(sk);   /* drawn once per soil (the gate is rebuilt every race) */
  const Sp=SOIL[look.soil]||SOIL["stadium-dirt"], pc=mixc(lin(Sp[0]),lin(Sp[2]),0.75);
  const pg=new THREE.PlaneGeometry(4.2,gw+1.0), PU=pg.attributes.uv; for(let i=0;i<PU.count;i++) PU.setXY(i,PU.getX(i)*4.2/6,PU.getY(i)*(gw+1)/6);
  const conc=new THREE.Mesh(pg,new THREE.MeshLambertMaterial({map:pm.map,normalMap:pm.normal,normalScale:new THREE.Vector2(0.6,0.6),color:new THREE.Color().setRGB(pc[0],pc[1],pc[2])}));
  conc.material.userData.keepMaps=true;   /* shared: never freed with the gate */
  conc.rotation.x=-Math.PI/2; conc.position.set(-2.2,0.025,0); conc.receiveShadow=true; grp.add(conc);
  grp.add(pads);
  /* the gate's steel: two end posts, a truss over the whole gate with a MOTOCROSS WAR START banner hung under it (both faces), lamps along it; one draw call */
  { const steel=lin("#2c2f3a"), lamp=[4.2,3.9,3.3], span=gw+2.2, parts=[];
    for(const sd of [-1,1]) parts.push(xf(steelPart(new THREE.BoxGeometry(0.34,7.2,0.34),steel),-0.35,3.6,sd*(span/2)), xf(steelPart(new THREE.BoxGeometry(0.9,0.12,0.9),steel,0.8),-0.35,0.06,sd*(span/2)));
    parts.push.apply(parts,trussParts(span,6.9,-0.35,steel,lamp,Math.max(6,Math.round(span/1.6))));
    const bw=span-0.6, bq1=bannerQuad(bw,1.8,PROPS.gate,1), bq2=bannerQuad(bw,1.8,PROPS.gate,-1); xf(bq1,-0.2,5.5,0); xf(bq2,-0.5,5.5,0); parts.push(bq1,bq2);
    grp.add(propsMesh(parts)); }
  grp.position.set(f.x,(f.y||0)+0.01,f.z); grp.rotation.y=-th;
  const state={grp:grp,pads:pads,slots:slots,pad:pad,gw:gw,th:th,x:f.x,z:f.z,y:f.y||0,drop:0,dropT:-1};
  state.slotLat=function(k){ return -gw/2+pad*(k+0.5); };   /* lateral (right +) of slot k */
  state.set=function(a){ /* a = 0 (up) .. 1 (down, flat on the dirt toward the riders' front) */
    const M=new THREE.Matrix4(), Q=new THREE.Quaternion(), E=new THREE.Euler(), V=new THREE.Vector3(), S=new THREE.Vector3(1,1,1);
    for(let k=0;k<slots;k++){ E.set(0,0,-a*Math.PI*0.47); Q.setFromEuler(E); V.set(0.05,0,-gw/2+pad*(k+0.5)); M.compose(V,Q,S); pads.setMatrixAt(k,M); }
    pads.instanceMatrix.needsUpdate=true;
  };
  state.set(0);
  return state;
}

/* ---------------- the finish line: a checkered stripe across the track, the flagger's stand ---------------- */
function finishBuild(C,look){
  const Co=CO(), o={}, f=Co.frame(C,0,o), grp=new THREE.Group();
  const stripe=new THREE.Mesh(new THREE.PlaneGeometry(1.1,f.hw*2+0.4),new THREE.MeshBasicMaterial({map:checkerTex(),transparent:false}));
  stripe.material.map.repeat.set(1,Math.max(2,Math.round(f.hw*2/1.1))*0.5);
  stripe.rotation.x=-Math.PI/2; stripe.position.set(0,Co.ground(C,0,0)-(f.y||0)+0.04,0); grp.add(stripe);
  /* the stand: on the inside (finSide) just past the line */
  const side=C.finSide||-1, lat=side*(f.hw+1.6);
  const stand=new THREE.Group(), st=lin("#3a3d46"), pl=lin("#d9d9de"), parts=[];
  [[-0.6,-0.6],[0.6,-0.6],[-0.6,0.6],[0.6,0.6]].forEach(c=>parts.push(xf(paint(new THREE.BoxGeometry(0.09,2.4,0.09),st),c[0],1.2,c[1])));
  parts.push(xf(paint(new THREE.BoxGeometry(1.5,0.1,1.5),pl),0,2.42,0));
  [[0,0.72,1.5,0.05],[0,-0.72,1.5,0.05]].forEach(r=>parts.push(xf(paint(new THREE.BoxGeometry(r[2],r[3],r[3]),st),r[0],3.4,r[1])));
  parts.push(xf(paint(new THREE.BoxGeometry(0.05,0.05,1.5),st),-0.72,3.4,0));
  [[-0.72,0.72],[-0.72,-0.72],[0.72,0.72],[0.72,-0.72]].forEach(c=>parts.push(xf(paint(new THREE.BoxGeometry(0.05,1.0,0.05),st),c[0],2.95,c[1])));
  [0.5,1.1,1.7].forEach(y=>parts.push(xf(paint(new THREE.BoxGeometry(0.05,0.05,1.2),st),-0.62,y,0)));   /* the ladder rungs */
  stand.add(new THREE.Mesh(merge(parts),new THREE.MeshLambertMaterial({vertexColors:true})));
  stand.position.set(0.9,0,lat); grp.add(stand);
  /* the finish arch: two legs either side of the lane (clear of the flag stand and of the next lane's blocks), a truss with the checkered FINISH banner (both faces) and lamps; one draw call */
  { const steel=lin("#2c2f3a"), lamp=[4.2,3.9,3.3], zi=-side*(f.hw+2.3), zo=side*(f.hw+3.5), z0=Math.min(zi,zo), z1=Math.max(zi,zo), span=z1-z0, zc=(z0+z1)/2, parts=[];
    for(const zz of [zi,zo]) parts.push(xf(steelPart(new THREE.BoxGeometry(0.36,7.6,0.36),steel),0,3.8,zz), xf(steelPart(new THREE.BoxGeometry(1.0,0.12,1.0),steel,0.8),0,0.06,zz));
    const nPre=parts.length; parts.push.apply(parts,trussParts(span+0.4,7.3,0,steel,lamp,Math.max(5,Math.round(span/1.6)))); parts.forEach((p,i)=>{ if(i>=nPre) p.translate(0,0,zc); });
    const bq1=bannerQuad(span-0.2,1.15,PROPS.finish,1), bq2=bannerQuad(span-0.2,1.15,PROPS.finish,-1); xf(bq1,0.12,6.3,zc); xf(bq2,-0.12,6.3,zc); parts.push(bq1,bq2);
    grp.add(propsMesh(parts)); }
  grp.position.set(f.x,f.y||0,f.z); grp.rotation.y=-f.th;
  return {grp:grp,flagAt:new THREE.Vector3(f.x+Math.cos(f.th)*0.9-Math.sin(f.th)*lat,(f.y||0)+2.47,f.z+Math.sin(f.th)*0.9+Math.cos(f.th)*lat),th:f.th,side:side,lat:lat};
}

/* ---------------- a flagger (a person on a stand or beside the track) waving a flag; one mesh each ---------------- */
export function flaggerBuild(flagTex,o){
  o=o||{}; const mar=!!o.marshal, grp=new THREE.Group();
  /* the starter in a white shirt; a track marshal in a hi-vis orange vest over a dark shirt, with a big flag that shows from across the
     floor (polish: the yellow flag was a speck) */
  const shirt=lin(mar?"#2a2c34":"#e8e4dc"), vest=lin("#ff7418"), strip=lin("#e9ecef");
  const parts=[
    xf(paint(new THREE.BoxGeometry(0.36,0.5,0.22),shirt),0,1.2,0),
    xf(paint(new THREE.BoxGeometry(0.15,0.8,0.17),lin("#23252c")),0.085,0.42,0), xf(paint(new THREE.BoxGeometry(0.15,0.8,0.17),lin("#23252c")),-0.085,0.42,0),
    xf(paint(new THREE.BoxGeometry(0.14,0.08,0.22),lin("#141416")),0.085,0.04,0.02), xf(paint(new THREE.BoxGeometry(0.14,0.08,0.22),lin("#141416")),-0.085,0.04,0.02),
    xf(paint(new THREE.BoxGeometry(0.09,0.5,0.09),shirt),-0.22,1.17,0,0,0,-0.08),
    xf(paint(new THREE.SphereGeometry(0.115,10,8),lin("#c58c63")),0,1.6,0),
    xf(paint(new THREE.SphereGeometry(0.125,10,5,0,Math.PI*2,0,1.3),lin(mar?"#ff7418":"#1d2a4a")),0,1.65,0),
    xf(paint(new THREE.BoxGeometry(0.16,0.02,0.12),lin(mar?"#ff7418":"#1d2a4a")),0,1.64,0.12)];
  if(mar) parts.push(xf(paint(new THREE.BoxGeometry(0.38,0.42,0.24),vest),0,1.24,0), xf(paint(new THREE.BoxGeometry(0.385,0.04,0.245),strip),0,1.16,0), xf(paint(new THREE.BoxGeometry(0.385,0.04,0.245),strip),0,1.3,0));
  const man=new THREE.Mesh(merge(parts),new THREE.MeshLambertMaterial({vertexColors:true})); grp.add(man);
  const arm=new THREE.Group(); arm.position.set(0.2,1.4,0);
  const armM=new THREE.Mesh(paint(new THREE.BoxGeometry(0.09,0.55,0.09),mar?vest:shirt),new THREE.MeshLambertMaterial({vertexColors:true})); armM.position.set(0,0.25,0); arm.add(armM);
  const fw=mar?1.25:0.9, fh=mar?0.86:0.6, pl=mar?1.5:1.1;
  const pole=new THREE.Mesh(new THREE.CylinderGeometry(0.015,0.015,pl,5),new THREE.MeshLambertMaterial({color:0xcccccc})); pole.position.set(0,0.2+pl/2,0); arm.add(pole);
  const fg=new THREE.PlaneGeometry(fw,fh,8,2); fg.translate(fw/2,0,0);
  /* the cloth glows a little of its own colour: it reads under the lights and in the shade */
  const flag=new THREE.Mesh(fg,new THREE.MeshLambertMaterial({map:flagTex,side:THREE.DoubleSide,emissive:0xffffff,emissiveMap:flagTex,emissiveIntensity:mar?0.5:0.3})); flag.position.set(0,0.2+pl-fh/2,0); arm.add(flag);
  grp.add(arm);
  const P=fg.attributes.position, X0=Float32Array.from(P.array);
  return {grp,arm,flag,wave(t,amp){ for(let i=0;i<P.count;i++){ const x=X0[i*3]; P.array[i*3+2]=Math.sin(t*9-x*5)*0.13*x*amp; P.array[i*3+1]=X0[i*3+1]-Math.abs(Math.sin(t*4.5))*0.06*x*amp; } P.needsUpdate=true;
      if(mar){ arm.rotation.z=-0.15+Math.sin(t*5.2)*0.75*amp; arm.rotation.x=Math.sin(t*2.6)*0.22*amp; flag.rotation.y=Math.sin(t*5.2+0.9)*0.95*amp; }   /* a marshal waves it hard, side to side over the head, the cloth sweeping round the pole (it shows from every side) */
      else { arm.rotation.z=-0.35+Math.sin(t*6)*0.55*amp; arm.rotation.x=Math.sin(t*3)*0.1*amp; } },
    setTex(t){ flag.material.map=t; flag.material.emissiveMap=t; flag.material.needsUpdate=true; }};
}
export function flagTex(kind){
  const c=canvas(96,64), x=c.getContext("2d");
  if(kind==="checkered"){ for(let i=0;i<6;i++) for(let j=0;j<4;j++){ x.fillStyle=(i+j)%2?"#111114":"#f6f2e8"; x.fillRect(i*16,j*16,16,16); } }
  else { x.fillStyle=kind==="white"?"#fbfaf5":kind==="yellow"?"#f6d21c":kind==="green"?"#2fa84f":"#c8102e"; x.fillRect(0,0,96,64); }
  return tex(c,false);
}

/* (the stadium itself - floor, wall, the bowl and its crowd, the light towers, the video boards - is r3d-stadium-bowl.js) */

/* ---------------- outdoors: terrain carved round the track, trees, spectators, the paddock, far hills, a day sky ---------------- */
function terrainHeightFn(C,look){
  /* a smooth elevation field from the track's own heights (so the hills are where the track climbs), plus noise hills away from it */
  /* fine samples (every ~3 m) for the carve along the track, every fourth one for the smooth elevation field */
  const pts=[], st=Math.max(1,Math.round(3/C.ds));
  for(let i=0;i<C.N;i+=st) pts.push([C.x[i],C.z[i],C.y[i],C.hw[i]]);
  const nLoop=pts.length;
  if(C.S&&C.S.n) for(let i=0;i<C.S.n;i+=st) pts.push([C.S.x[i],C.S.z[i],C.S.y[i]||0,C.S.hw[i]]);
  const amp=look.around==="beach-speedway"?0.4:look.around==="farmland"?2.5:7;
  /* a spatial hash for the nearest track point */
  const cell=24, H={}; pts.forEach((p,i)=>{ const k=Math.floor(p[0]/cell)+","+Math.floor(p[1]/cell); (H[k]=H[k]||[]).push(i); });
  function nearest(x,z){ let best=1e9, bi=-1; const cx=Math.floor(x/cell), cz=Math.floor(z/cell);
    for(let r=0;r<4&&bi<0||r<2;r++) for(let a=-r;a<=r;a++) for(let b=-r;b<=r;b++){ if(Math.max(Math.abs(a),Math.abs(b))!==r) continue; const L=H[(cx+a)+","+(cz+b)]; if(!L) continue; L.forEach(i=>{ const p=pts[i], d=(p[0]-x)*(p[0]-x)+(p[1]-z)*(p[1]-z); if(d<best){ best=d; bi=i; } }); }
    if(bi<0) return null;
    /* the track's height right beside (x, z): along the centre-line between the two nearest samples, not the nearest sample's */
    const p=pts[bi]; let y=p[2];
    const nb=bi<nLoop?[(bi+1)%nLoop,(bi-1+nLoop)%nLoop]:[bi+1<pts.length?bi+1:bi,bi-1>=nLoop?bi-1:bi];
    for(const j of nb){ if(j===bi) continue; const q=pts[j], ex=q[0]-p[0], ez=q[1]-p[1], L2=ex*ex+ez*ez||1, t=((x-p[0])*ex+(z-p[1])*ez)/L2; if(t>=0&&t<=1){ y=p[2]+(q[2]-p[2])*t; break; } }
    return {d:Math.sqrt(best),p:p,y:y}; }
  return function(x,z){
    let sw=0, sy=0; for(let i=0;i<pts.length;i+=12){ const p=pts[i], d2=(p[0]-x)*(p[0]-x)+(p[1]-z)*(p[1]-z), w=1/(d2+2500); sw+=w; sy+=w*p[2]; }
    let y=sy/sw+(fbm(x/140,z/140,4)-0.45)*amp*2.2;
    const n=nearest(x,z);
    /* carved flat a little under the track out to 12 m beyond its edge (wider than a terrain cell, so no grass triangle can rise through
       the dirt), then easing back into the hills */
    if(n){ const t=sstep(n.p[3]+12,n.p[3]+56,n.d); y=(n.y-0.25)*(1-t)+y*t; }
    return y;
  };
}
function outdoorWorld(C,look,q,root,ctx){
  const [x0,x1,z0,z1]=C.layout.floor||[-500,600,-400,520], W=x1-x0, D=z1-z0, cx=(x0+x1)/2, cz=(z0+z1)/2;
  const hf=terrainHeightFn(C,look), cs=q.lo?11:8, nx=Math.ceil(W/cs), nz=Math.ceil(D/cs);
  const pos=new Float32Array((nx+1)*(nz+1)*3), col=new Float32Array((nx+1)*(nz+1)*3), uv=new Float32Array((nx+1)*(nz+1)*2), idx=[];
  const g1=lin(look.around==="beach-speedway"?"#6f7f45":"#587a35"), g2=lin(look.around==="beach-speedway"?"#a59a6a":"#3f5f28"), dry=lin("#8f8a55");
  for(let j=0;j<=nz;j++) for(let i=0;i<=nx;i++){ const x=x0+i*cs, z=z0+j*cs, y=hf(x,z), k=j*(nx+1)+i; pos[k*3]=x; pos[k*3+1]=y; pos[k*3+2]=z; uv[k*2]=x/9; uv[k*2+1]=z/9;
    const n=fbm(x/60,z/60,3); let c=mixc(g1,g2,n); c=mixc(c,dry,clamp((fbm(x/25+9,z/25,2)-0.55)*2,0,0.5)); col[k*3]=c[0]; col[k*3+1]=c[1]; col[k*3+2]=c[2]; }
  for(let j=0;j<nz;j++) for(let i=0;i<nx;i++){ const a=j*(nx+1)+i, b=a+1, c2=a+nx+1, d=c2+1; idx.push(a,c2,b,b,c2,d); }
  const tg=new THREE.BufferGeometry(); tg.setAttribute("position",new THREE.BufferAttribute(pos,3)); tg.setAttribute("color",new THREE.BufferAttribute(col,3)); tg.setAttribute("uv",new THREE.BufferAttribute(uv,2)); tg.setIndex(idx); tg.computeVertexNormals();
  const gt=grassTex(q.lo);
  const terr=new THREE.Mesh(tg,new THREE.MeshLambertMaterial({map:gt,vertexColors:true})); terr.receiveShadow=true; root.add(terr);
  ctx.hf=hf;
  /* far hills: a ring of low hills at the horizon */
  const fh=[], R0=Math.max(W,D)*0.95, nseg=q.lo?36:64; for(let i=0;i<=nseg;i++){ const a=i/nseg*Math.PI*2; const h=30+fbm(i*0.3,4,3)*90; fh.push([cx+Math.cos(a)*R0,cz+Math.sin(a)*R0,h]); }
  const hp=[], hi=[], hc=[]; fh.forEach((p,i)=>{ hp.push(p[0],-5,p[1], cx+(p[0]-cx)*1.25,p[2],cz+(p[1]-cz)*1.25); const c1=lin("#5d7350"), c2=lin("#8fa0a8"); hc.push(c1[0],c1[1],c1[2],c2[0],c2[1],c2[2]); });
  for(let i=0;i<nseg;i++){ const a=i*2; hi.push(a,a+1,a+2,a+1,a+3,a+2); }
  const hg=new THREE.BufferGeometry(); hg.setAttribute("position",new THREE.Float32BufferAttribute(hp,3)); hg.setAttribute("color",new THREE.Float32BufferAttribute(hc,3)); hg.setIndex(hi); hg.computeVertexNormals();
  root.add(new THREE.Mesh(hg,new THREE.MeshLambertMaterial({vertexColors:true,side:THREE.DoubleSide})));
  /* trees: pines and round trees in clumps, never on or near the track */
  const R=rngf(C.L|0), trees=[], want=q.lo?260:620;
  for(let k=0;k<want*6&&trees.length<want;k++){ const x=x0+R()*W, z=z0+R()*D; if(fbm(x/90,z/90,3)<0.47) continue; if(!clear(C,x,z,16)) continue; trees.push([x,z,hf(x,z),0.7+R()*0.7,R()<0.62?0:1]); }
  const pine=merge([xf(paint(new THREE.ConeGeometry(2.2,5.5,7),lin("#1f3d22")),0,5.2,0),xf(paint(new THREE.ConeGeometry(1.7,4.4,7),lin("#28482a")),0,7.6,0),xf(paint(new THREE.CylinderGeometry(0.25,0.32,2.8,5),lin("#4a3424")),0,1.4,0)]);
  const leafy=merge([xf(paint(new THREE.IcosahedronGeometry(3.0,0),lin("#35562a")),0,5.6,0),xf(paint(new THREE.IcosahedronGeometry(2.2,0),lin("#3f6630")),1.2,6.6,0.6),xf(paint(new THREE.CylinderGeometry(0.3,0.4,3.6,5),lin("#4a3424")),0,1.8,0)]);
  const tmat=new THREE.MeshLambertMaterial({vertexColors:true});
  [pine,leafy].forEach((geo,type)=>{ const L=trees.filter(t=>t[4]===type); if(!L.length) return; const m=new THREE.InstancedMesh(geo,tmat,L.length), M=new THREE.Matrix4(), Q=new THREE.Quaternion(), E=new THREE.Euler(), V=new THREE.Vector3(), S=new THREE.Vector3();
    const tc=new THREE.Color();
    L.forEach((t,i)=>{ E.set(0,t[0]*1.7,0); Q.setFromEuler(E); V.set(t[0],t[2]-0.2,t[1]); S.set(t[3],t[3]*(0.85+0.3*((i*37)%10)/10),t[3]); M.compose(V,Q,S); m.setMatrixAt(i,M);
      const k=0.82+((i*53)%17)/17*0.36; tc.setRGB(k*(type?1.04:0.96),k,k*(type?0.9:1.0)); m.setColorAt(i,tc); });
    m.instanceMatrix.needsUpdate=true; if(m.instanceColor) m.instanceColor.needsUpdate=true; root.add(m); });
  /* the track's edges: stakes and a ribbon, as at a national */
  stakesRibbon(C,look,q,root);
  /* a few soft clouds */
  ctx.clouds(C,q);
  /* spectators along the fence at the jumps and the finish */
  spectators(C,look,q,root,hf,R);
  /* the paddock: trucks and tents near the start */
  paddock(C,look,q,root,hf,R);
  /* a deeper blue overhead, a soft haze at the horizon (polish: the old sky washed out to white under the tone mapping) */
  ctx.sky(look.around==="desert"?0x6f9fd6:0x2e6cc4,0x78a9e0,0xcbd9e6,true);
  ctx.fog(0xc6d4e2,320,1600);
  return {cx:cx,cz:cz};
}
function spectators(C,look,q,root,hf,R){
  const Co=CO(), list=[], o={};
  const spots=C.feats.filter(f=>f.k==="jump"||f.k==="whoops"||f.k==="sand").map(f=>(f.from+f.to)/2).concat([0,C.L*0.5]);
  spots.forEach(s0=>{ for(let k=0;k<(q.lo?14:34);k++){ const s=s0+(R()-0.5)*40, f=Co.frame(C,s,o), side=R()<0.5?-1:1, lat=side*(f.hw+7+R()*7);
    const x=f.x-Math.sin(f.th)*lat, z=f.z+Math.cos(f.th)*lat; if(!clear(C,x,z,5)) continue; list.push([x,z,hf?hf(x,z):0,R()]); } });
  if(!list.length) return;
  /* a person: shirt (the instance colour), arms, trousers, shoes, a head with hair or a cap (their own colours: aFix) */
  /* (about 110 triangles a person: there are hundreds of them, small on screen) */
  const shirt=xf(paint(new THREE.CylinderGeometry(0.2,0.17,0.62,6,1,true),[1,1,1]),0,1.1,0); shirt.scale(1,1,0.7);
  const parts=[shirt,
    xf(paint(new THREE.BoxGeometry(0.09,0.56,0.1),[1,1,1]),0.25,1.08,0,0,0,0.12),xf(paint(new THREE.BoxGeometry(0.09,0.56,0.1),[1,1,1]),-0.25,1.08,0,0,0,-0.12),
    xf(paint(new THREE.BoxGeometry(0.15,0.8,0.16),lin("#2c3040")),0.09,0.4,0),xf(paint(new THREE.BoxGeometry(0.15,0.8,0.16),lin("#2c3040")),-0.09,0.4,0),
    xf(paint(new THREE.SphereGeometry(0.12,6,4),lin("#c58c63")),0,1.56,0),xf(paint(new THREE.SphereGeometry(0.125,6,2,0,Math.PI*2,0,1.25),lin("#2a2018")),0,1.6,0)];
  const fixN=[0,0,0,1,1,1,1];
  parts.forEach((g,k)=>{ const n=g.attributes.position.count; g.setAttribute("aFix",new THREE.BufferAttribute(new Float32Array(n).fill(fixN[k]),1)); });
  const body=mergeFix(parts);
  const m=new THREE.InstancedMesh(body,fixMat(),list.length), M=new THREE.Matrix4(), Q=new THREE.Quaternion(), V=new THREE.Vector3(), S=new THREE.Vector3(1,1,1), cl=new THREE.Color();
  const shirts=["#d8d4cc","#c8102e","#1f4fc4","#f2cf1d","#2a2a2a","#57b947","#ff7a1a","#e6e6ea","#3a5ba0","#7a3b8f"];
  list.forEach((p,i)=>{ Q.setFromAxisAngle(new THREE.Vector3(0,1,0),p[3]*6.28); V.set(p[0],p[2],p[1]); M.compose(V,Q,S); m.setMatrixAt(i,M); cl.set(shirts[i%shirts.length]); m.setColorAt(i,cl); });
  m.instanceMatrix.needsUpdate=true; root.add(m);
}
/* a Lambert material where vertices marked aFix keep their own colour (not tinted by the instance colour): skin, trousers */
export function fixMat(){
  const m=new THREE.MeshLambertMaterial({vertexColors:true});
  m.onBeforeCompile=sh=>{ sh.vertexShader=sh.vertexShader.replace("#include <common>","#include <common>\nattribute float aFix;").replace("#include <color_vertex>","#include <color_vertex>\n#ifdef USE_INSTANCING_COLOR\n vColor.rgb=mix(vColor.rgb,color.rgb,aFix);\n#endif"); };
  m.customProgramCacheKey=()=>"mx-wfix";
  return m;
}
/* merge() that carries an aFix attribute along (non-indexed, in the same vertex order as merge) */
function mergeFix(list){ const g=merge(list), F=new Float32Array(g.attributes.position.count); let n=0;
  list.forEach(q=>{ const a=q.attributes.aFix, ix=q.index, c=ix?ix.count:q.attributes.position.count; for(let i=0;i<c;i++) F[n+i]=a?a.array[ix?ix.array[i]:i]:0; n+=c; });
  g.setAttribute("aFix",new THREE.BufferAttribute(F,1)); return g; }
/* outdoors: white stakes every few metres along both edges with a coloured ribbon between them (plain colours, no marks); none on another
   lane, the start or a jump's run-out */
function stakesRibbon(C,look,q,root){
  const Co=CO(), o={}, step=q.lo?8:5.5, rows={"-1":[],"1":[]};
  for(let s=0;s<C.L;s+=step){ const f=Co.frame(C,s,o), ii=Math.round(s/C.ds)%C.N;
    for(const side of [-1,1]){
      const out=(f.k>0?-1:1)===side, ext=1.3+(out?C.bank[ii]*0.7:0), lat=side*(f.hw+ext), x=f.x-Math.sin(f.th)*lat, z=f.z+Math.cos(f.th)*lat;
      if(!clear(C,x,z,1.0)){ rows[side].push(null); continue; }
      const edge=Co.ground(C,s,side*f.hw), y=edge+(f.y-0.55-edge)*sstep(0,1,ext/2.21);
      rows[side].push([x,y-0.12,z]); } }
  const post=merge([xf(paint(new THREE.BoxGeometry(0.06,1.05,0.06),lin("#ecebe6")),0,0.52,0),xf(paint(new THREE.BoxGeometry(0.07,0.14,0.07),lin("#ff6a10")),0,1.05,0)]);
  const all=rows["-1"].concat(rows["1"]).filter(Boolean);
  if(!all.length) return;
  const pm=new THREE.InstancedMesh(post,new THREE.MeshLambertMaterial({vertexColors:true}),all.length), M=new THREE.Matrix4();
  all.forEach((p,i)=>{ M.makeTranslation(p[0],p[1],p[2]); pm.setMatrixAt(i,M); }); pm.instanceMatrix.needsUpdate=true; root.add(pm);
  const P=[], Cc=[], rc=lin(look.around==="desert"?"#2a62d6":"#ff7a1a"), rc2=lin("#f4f2ea");
  ["-1","1"].forEach(sd=>{ const L=rows[sd]; for(let i=0;i<L.length;i++){ const a=L[i], b=L[(i+1)%L.length]; if(!a||!b) continue; if(Math.hypot(a[0]-b[0],a[2]-b[2])>step*1.7) continue;
    const c=(i%2)?rc:rc2; [[a,0.6],[a,0.74],[b,0.6],[b,0.74]].forEach(v=>{ P.push(v[0][0],v[0][1]+v[1],v[0][2]); Cc.push(c[0],c[1],c[2]); }); } });
  if(!P.length) return;
  const I=[]; for(let k=0;k<P.length/12;k++){ const a=k*4; I.push(a,a+2,a+1,a+1,a+2,a+3); }
  const g=new THREE.BufferGeometry(); g.setAttribute("position",new THREE.Float32BufferAttribute(P,3)); g.setAttribute("color",new THREE.Float32BufferAttribute(Cc,3)); g.setIndex(I); g.computeVertexNormals();
  root.add(new THREE.Mesh(g,new THREE.MeshLambertMaterial({vertexColors:true,side:THREE.DoubleSide})));
}
function cloudTex(){
  const W=256, H=128, c=canvas(W,H), x=c.getContext("2d"), R=rngf(5);
  for(let i=0;i<30;i++){ const u=0.14+R()*0.72, px=W*u, py=H*(0.62-Math.sin(u*Math.PI)*0.22+R()*0.12), r=H*(0.12+R()*0.18), g=x.createRadialGradient(px,py,0,px,py,r);
    g.addColorStop(0,"rgba(255,255,255,.5)"); g.addColorStop(0.55,"rgba(255,255,255,.26)"); g.addColorStop(1,"rgba(255,255,255,0)"); x.fillStyle=g; x.beginPath(); x.arc(px,py,r,0,7); x.fill(); }
  const t=new THREE.CanvasTexture(c); t.colorSpace=THREE.SRGBColorSpace; return t;
}
function paddock(C,look,q,root,hf,R){
  const Co=CO(), o={}; let f;
  if(C.S&&C.S.n) f=Co.startFrame(C,0,o); else f=Co.frame(C,C.join,o);
  const items=[], n=q.lo?8:18;
  for(let k=0;k<n*4&&items.length<n;k++){ const x=f.x-Math.cos(f.th)*(40+R()*90)+(R()-0.5)*120, z=f.z-Math.sin(f.th)*(30+R()*40)+(R()-0.5)*120; if(!clear(C,x,z,14)) continue; items.push([x,z,hf?hf(x,z):0,R()]); }
  const truck=merge([xf(paint(new THREE.BoxGeometry(13,3.6,2.6),[1,1,1]),0,2.2,0),xf(paint(new THREE.BoxGeometry(3,3,2.5),lin("#d8d8dc")),8.2,1.9,0),xf(paint(new THREE.BoxGeometry(16,0.5,2.4),lin("#1c1c20")),0.8,0.4,0)]);
  const m=new THREE.InstancedMesh(truck,new THREE.MeshLambertMaterial({vertexColors:true}),items.length), M=new THREE.Matrix4(), Q=new THREE.Quaternion(), V=new THREE.Vector3(), S=new THREE.Vector3(1,1,1), cl=new THREE.Color();
  const cols=["#d62828","#1f4fc4","#57b947","#f2cf1d","#ff7a1a","#f2f4f8","#26292e","#a8101c"];
  items.forEach((p,i)=>{ Q.setFromAxisAngle(new THREE.Vector3(0,1,0),Math.round(p[3]*4)*Math.PI/2+0.3); V.set(p[0],p[2],p[1]); M.compose(V,Q,S); m.setMatrixAt(i,M); cl.set(cols[i%cols.length]); m.setColorAt(i,cl); });
  m.instanceMatrix.needsUpdate=true; root.add(m);
}

/* ---------------- the speedway infield (Daytona-style): flat sandy infield, the banked oval, a grandstand, light towers, palms, a lake ---------------- */
function speedway(C,look,q,root,ctx){
  const [x0,x1,z0,z1]=C.layout.floor||[-150,90,-40,125], cx=(x0+x1)/2, cz=(z0+z1)/2;
  /* the infield: flat ground with sandy grass */
  const hf=(x,z)=>(fbm(x/80,z/80,2)-0.5)*0.3-0.32;   /* always under the track's shoulders (no grass poking through the dirt) */
  const flat={layout:{floor:[cx-700,cx+700,cz-420,cz+420]},L:C.L,N:C.N,x:C.x,z:C.z,hw:C.hw,y:C.y,S:C.S,feats:C.feats,ds:C.ds,k:C.k};
  const look2=Object.assign({},look,{around:"beach-speedway"});
  /* the oval: an ellipse-ish tri-oval ribbon of asphalt, banked in the turns */
  const ov=[], A=640, B=300, segs=q.lo?72:128;
  for(let i=0;i<=segs;i++){ const a=i/segs*Math.PI*2, ca=Math.cos(a), sa=Math.sin(a), e=3.2; const px=Math.sign(ca)*Math.pow(Math.abs(ca),2/e)*A, pz=Math.sign(sa)*Math.pow(Math.abs(sa),2/e)*B;
    ov.push([cx+px,cz+pz+40,Math.abs(ca)>0.75?1:0]); }
  const op=[], oc=[], oi=[];
  for(let i=0;i<=segs;i++){ const p=ov[i%segs], pn=ov[(i+1)%segs], dx=pn[0]-p[0], dz=pn[1]-p[1], L=Math.hypot(dx,dz)||1, nx=dz/L, nz=-dx/L;
    const bank=p[2]?9:1.2; const inn=[p[0]-nx*14,0.1,p[1]-nz*14], out=[p[0]+nx*14,bank,p[1]+nz*14], wall=[p[0]+nx*15,bank+1.4,p[1]+nz*15];
    op.push(inn[0],inn[1],inn[2],out[0],out[1],out[2],wall[0],wall[1],wall[2]); const g=lin("#3a3b40"), w=lin("#d9d9de"); oc.push(g[0],g[1],g[2],g[0]*1.1,g[1]*1.1,g[2]*1.1,w[0],w[1],w[2]); }
  for(let i=0;i<segs;i++){ const a=i*3; oi.push(a,a+3,a+1,a+1,a+3,a+4,a+1,a+4,a+2,a+2,a+4,a+5); }
  const og=new THREE.BufferGeometry(); og.setAttribute("position",new THREE.Float32BufferAttribute(op,3)); og.setAttribute("color",new THREE.Float32BufferAttribute(oc,3)); og.setIndex(oi); og.computeVertexNormals();
  root.add(new THREE.Mesh(og,new THREE.MeshLambertMaterial({vertexColors:true,side:THREE.DoubleSide})));
  /* the grandstand along the front stretch (south), with the crowd */
  const gsW=900, gs=new THREE.Mesh(new THREE.PlaneGeometry(gsW,60),new THREE.MeshLambertMaterial({map:(()=>{ const t=crowdTex(q.lo,true); t.repeat.set(gsW/(CROWD.cols*CROWD.seat),60/(CROWD.rows*CROWD.row)); return t; })(),side:THREE.DoubleSide}));
  gs.position.set(cx,22,cz+B+40+28); gs.rotation.x=-0.78; root.add(gs);
  const gsBack=new THREE.Mesh(new THREE.BoxGeometry(gsW,4,4),new THREE.MeshLambertMaterial({color:0x22222a})); gsBack.position.set(cx,44,cz+B+40+50); root.add(gsBack);
  /* the infield ground */
  const W=1500, D=900, cs=q.lo?40:24, nx=Math.ceil(W/cs), nz=Math.ceil(D/cs);
  const g=new THREE.PlaneGeometry(W,D,nx,nz); g.rotateX(-Math.PI/2); g.translate(cx,0,cz+40);
  const P=g.attributes.position, cl=new Float32Array(P.count*3), g1=lin("#6f7f45"), g2=lin("#a08f62");
  for(let i=0;i<P.count;i++){ const x=P.getX(i), z=P.getZ(i); P.setY(i,hf(x,z)-0.15); const n=fbm(x/50,z/50,3); const c=mixc(g1,g2,n*0.8); cl[i*3]=c[0]; cl[i*3+1]=c[1]; cl[i*3+2]=c[2]; }
  g.setAttribute("color",new THREE.BufferAttribute(cl,3)); g.computeVertexNormals();
  const gt=grassTex(q.lo); gt.repeat.set(W/12,D/12);
  { const ig=new THREE.Mesh(g,new THREE.MeshLambertMaterial({map:gt,vertexColors:true})); ig.receiveShadow=true; root.add(ig); }
  /* the lake (north of the track) */
  const lake=new THREE.Mesh(new THREE.CircleGeometry(160,40),new THREE.MeshLambertMaterial({color:0x0a1a2c,emissive:0x02060c}));
  lake.rotation.x=-Math.PI/2; lake.scale.set(1.6,1,1); lake.position.set(cx+60,0.02,cz-220); root.add(lake);
  /* palms and light towers round the track */
  const R=rngf(4242), palms=[], towers=[];
  for(let k=0;k<400&&palms.length<(q.lo?30:70);k++){ const x=cx+(R()-0.5)*520, z=cz+(R()-0.5)*360; if(!clear(C,x,z,12)) continue; palms.push([x,z,0.8+R()*0.6]); }
  const palm=merge([xf(paint(new THREE.CylinderGeometry(0.22,0.34,9,6),lin("#6b5238")),0,4.5,0)].concat([0,1,2,3,4,5,6].map(i=>{ const g2=paint(new THREE.ConeGeometry(0.7,4.2,4),lin("#3c6b2c")); g2.rotateZ(Math.PI/2.2); g2.translate(2.0,0,0); g2.rotateY(i/7*Math.PI*2); g2.translate(0,9,0); return g2; })));
  const pm=new THREE.InstancedMesh(palm,new THREE.MeshLambertMaterial({vertexColors:true}),palms.length), M=new THREE.Matrix4(), Q=new THREE.Quaternion(), V=new THREE.Vector3(), S=new THREE.Vector3();
  palms.forEach((p,i)=>{ Q.setFromAxisAngle(new THREE.Vector3(0,1,0),p[0]); V.set(p[0],0,p[1]); S.set(p[2],p[2],p[2]); M.compose(V,Q,S); pm.setMatrixAt(i,M); }); pm.instanceMatrix.needsUpdate=true; root.add(pm);
  const glows=[];
  for(let i=0;i<10;i++){ const a=i/10*Math.PI*2, x=cx+Math.cos(a)*150, z=cz+Math.sin(a)*95; if(!clear(C,x,z,8)) continue; towers.push([x,z]); glows.push([x,31,z,10]); }
  const tg=paint(new THREE.CylinderGeometry(0.35,0.5,30,6),lin("#3a3c44")); tg.translate(0,15,0);
  const tm=new THREE.InstancedMesh(tg,new THREE.MeshLambertMaterial({vertexColors:true}),Math.max(1,towers.length)); towers.forEach((t,i)=>{ M.makeTranslation(t[0],0,t[1]); tm.setMatrixAt(i,M); }); tm.instanceMatrix.needsUpdate=true; root.add(tm);
  /* stadium-style lights along the far grandstand roof */
  for(let i=0;i<14;i++) glows.push([cx-gsW/2+gsW*(i+0.5)/14,48,cz+B+40+52,9]);
  ctx.glow(glows,0xfff1d6);
  ctx.hf=hf;
  ctx.sky(0x0a1024,0x2b3a66,0x6a4a5a);
  ctx.fog(0x101626,220,1100);
  return {cx:cx,cz:cz};
}

/* ---------------- the whole world ---------------- */
export function buildWorld(C,look,q){
  const root=new THREE.Group(), ctx={};
  const tm=trackMaterial(look,q), matTrack=tm.mat; ctx.dirt=tm.dirt;
  ctx.glowTex=glowTex();
  /* the lights' glow (outdoor night lights, the speedway): instanced camera-facing soft lights, additive; list = [x, y, z, size] (r3d-stadium-bowl.js glowSprites: the same sprite shader as the stadium's towers) */
  ctx.glow=function(list,color){
    if(q.lo) list=list.filter((g,i)=>i%2===0);
    const c=new THREE.Color(color), L=list.map(g=>({x:g[0],y:g[1],z:g[2],s:g[3],r:c.r,g:c.g,b:c.b,k:0,a:1.15}));
    const m=glowSprites(glowSheet(),L,{uTime:{value:0}}); root.add(m); ctx.glowMesh=m;
  };
  ctx.sky=function(top,mid,hor,sun){
    const g=new THREE.SphereGeometry(2600,24,12), P=g.attributes.position, c=new Float32Array(P.count*3), t=lin("#"+top.toString(16).padStart(6,"0")), m=lin("#"+mid.toString(16).padStart(6,"0")), h=lin("#"+hor.toString(16).padStart(6,"0"));
    for(let i=0;i<P.count;i++){ const y=P.getY(i)/2600; const col=y>0.25?mixc(m,t,clamp((y-0.25)/0.6,0,1)):mixc(h,m,clamp(y/0.25+0.15,0,1)); c[i*3]=col[0]; c[i*3+1]=col[1]; c[i*3+2]=col[2]; }
    g.setAttribute("color",new THREE.BufferAttribute(c,3));
    const sky=new THREE.Mesh(g,new THREE.MeshBasicMaterial({vertexColors:true,side:THREE.BackSide,fog:false,depthWrite:false})); sky.renderOrder=-10; root.add(sky); ctx.skyMesh=sky;
    if(sun){ const s=new THREE.Mesh(new THREE.PlaneGeometry(1,1),new THREE.MeshBasicMaterial({map:ctx.glowTex,transparent:true,depthWrite:false,fog:false,blending:THREE.AdditiveBlending,color:0xfff3d0}));
      s.scale.set(420,420,1); ctx.sunMesh=s; root.add(s); }
  };
  ctx.fog=function(col,near,far){ ctx.fogC=[col,near,far]; };
  /* soft clouds: camera-facing quads far out in the sky (one draw call; no fog) */
  ctx.clouds=function(C2,q2){
    const n=q2.lo?7:14, R=rngf((C2.L|0)+3), geo=new THREE.PlaneGeometry(1,1), M=new THREE.Matrix4(), list=[];
    const F=C2.layout.floor||[-500,600,-400,520], cx=(F[0]+F[1])/2, cz=(F[2]+F[3])/2;
    for(let i=0;i<n;i++){ const a=i/n*Math.PI*2+R()*0.4, d=1500+R()*600; list.push([cx+Math.cos(a)*d,240+R()*300,cz+Math.sin(a)*d,520+R()*480,150+R()*120]); }
    const mat=new THREE.ShaderMaterial({uniforms:{map:{value:cloudTex()},col:{value:new THREE.Color(0xffffff)}},transparent:true,depthWrite:false,fog:false,
      vertexShader:"varying vec2 vUv; void main(){ vUv=uv; vec4 c=modelViewMatrix*instanceMatrix*vec4(0.,0.,0.,1.); c.x+=position.x*length(instanceMatrix[0].xyz); c.y+=position.y*length(instanceMatrix[1].xyz); gl_Position=projectionMatrix*c; }",
      fragmentShader:"uniform sampler2D map; uniform vec3 col; varying vec2 vUv; void main(){ vec4 t=texture2D(map,vUv); gl_FragColor=vec4(col*mix(0.8,1.0,vUv.y),t.a*0.9); }"});
    const m=new THREE.InstancedMesh(geo,mat,list.length);
    list.forEach((c,i)=>{ M.makeScale(c[3],c[4],1); M.setPosition(c[0],c[1],c[2]); m.setMatrixAt(i,M); });
    m.instanceMatrix.needsUpdate=true; m.frustumCulled=false; m.renderOrder=-5; root.add(m);
  };
  let info;
  if(C.kind==="stadium"){ info=stadiumBowl(C,look,q,root,ctx); ctx.bowlY=info.bowlY; }   /* ctx.bowlY(x, z) -> {y, d}: the height of the stands at a place (for cameras) */
  else if(look.around==="beach-speedway"||C.kind==="hybrid") info=speedway(C,look,q,root,ctx);
  else info=outdoorWorld(C,look,q,root,ctx);
  const dirt=addTrack(C,look,q,root,matTrack), track=dirt.track;   /* the track surface (r3d-track.js) joins the scene where it always did */
  const fin=finishBuild(C,look); root.add(fin.grp);
  return {root,ctx,track,fin,info,matTrack,dirt,frame:(info&&info.frame)||null};   /* frame(dt, tw, cam): optional per-frame work for the surroundings (race3d.js calls it if set) */
}

/* the helpers the old one-file module exported: still importable from here (they live in r3d-util.js now) */
export {gateBuild,glowTex};
export {setAniso,merge,paint,xf,clear,clearDist,lin,mixc,fbm,vnoise,canvas,tex,rngf} from "./r3d-util.js";
