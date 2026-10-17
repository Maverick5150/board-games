/* MOTOCROSS WAR 3D — THE ENVIRONMENT MAP (owner: lead): a small procedural "night stadium" (or a day sky) drawn once into a PMREM cube, so every physically
   based material (MeshStandardMaterial / MeshPhysicalMaterial) reflects the light banks, the dark sky, the crowd band and the warm dirt floor instead of a flat grey.
   makeEnvironment(renderer, {kind: "night" | "day", key: Vector3 (the key light's direction, so the brightest bank sits where the key light is), seed})
     -> {rt (a WebGLRenderTarget: rt.texture is the env map), dispose()}.  One call costs about 20-60 ms (a 256 px cube, five blur steps): once per race, never per frame.
   Nothing here is a photo: rectangles, gradients and seeded speckles. Colours are linear and HDR (a bank is 8-60 times brighter than the dirt: that is what makes a helmet's
   highlight bloom).  MeshBasicMaterial colours above 1 are fine here: PMREM draws into a half-float target. */
import * as THREE_NS from "../ui/vendor/three-0.160.0.module.min.js";
const THREE=THREE_NS;
import {rngf} from "./r3d-util.js";

const DEG=Math.PI/180;
/* a quad of size (w x h) at azimuth az, elevation el (radians) on a sphere of radius r, facing the centre */
function panel(w,h,az,el,r,rgb,sc){
  const m=new THREE.Mesh(new THREE.PlaneGeometry(w,h),new THREE.MeshBasicMaterial({color:new THREE.Color(rgb[0],rgb[1],rgb[2]),side:THREE.DoubleSide,toneMapped:false,fog:false}));
  m.position.set(Math.cos(el)*Math.cos(az)*r,Math.sin(el)*r,Math.cos(el)*Math.sin(az)*r); m.lookAt(0,0,0); sc.add(m); return m;
}

export function makeEnvironment(renderer,o){
  o=o||{}; const kind=o.kind||"night", rnd=rngf(o.seed||7), sc=new THREE.Scene(), made=[];
  /* the dome: a vertex-coloured gradient (a dark sky, a hazy horizon, a warm floor) */
  const sg=new THREE.SphereGeometry(60,32,16), pa=sg.attributes.position, col=new Float32Array(pa.count*3), c=new THREE.Color();
  const stops=kind==="day"
    ? [[-1,[0.30,0.20,0.11]],[-0.12,[0.42,0.30,0.18]],[0,[0.75,0.82,0.92]],[0.25,[0.35,0.55,0.95]],[1,[0.10,0.25,0.75]]]
    : [[-1,[0.050,0.028,0.014]],[-0.20,[0.26,0.145,0.070]],[-0.02,[0.30,0.17,0.085]],[0.02,[0.060,0.070,0.120]],[0.22,[0.020,0.028,0.060]],[1,[0.003,0.005,0.014]]];
  for(let i=0;i<pa.count;i++){ const y=pa.getY(i)/60; let k=0; while(k<stops.length-2&&y>stops[k+1][0]) k++; const a=stops[k], b=stops[k+1], t=Math.min(1,Math.max(0,(y-a[0])/(b[0]-a[0])));
    col[i*3]=a[1][0]+(b[1][0]-a[1][0])*t; col[i*3+1]=a[1][1]+(b[1][1]-a[1][1])*t; col[i*3+2]=a[1][2]+(b[1][2]-a[1][2])*t; }
  sg.setAttribute("color",new THREE.BufferAttribute(col,3));
  sc.add(new THREE.Mesh(sg,new THREE.MeshBasicMaterial({vertexColors:true,side:THREE.BackSide,toneMapped:false,fog:false})));
  const R=50;
  if(kind==="night"){
    /* the crowd band: a dim warm speckle round the horizon (small quads, orange / white / red / blue), one merged mesh */
    const pal=[[0.55,0.34,0.16],[0.7,0.62,0.5],[0.5,0.14,0.12],[0.16,0.24,0.5],[0.6,0.5,0.3]], NQ=460, P=new Float32Array(NQ*18), Cc=new Float32Array(NQ*18), v=new THREE.Vector3(), rt2=new THREE.Vector3(), up2=new THREE.Vector3();
    for(let i=0;i<NQ;i++){ const az=rnd()*Math.PI*2, el=(4+rnd()*20)*DEG, p=pal[Math.floor(rnd()*pal.length)], k=0.18+rnd()*0.55, w=(0.9+rnd()*1.2)/2, h=(0.5+rnd()*0.8)/2;
      v.set(Math.cos(el)*Math.cos(az),Math.sin(el),Math.cos(el)*Math.sin(az)); rt2.set(-Math.sin(az),0,Math.cos(az)); up2.crossVectors(v,rt2);
      const q=[[-1,-1],[1,-1],[1,1],[-1,-1],[1,1],[-1,1]];
      for(let j=0;j<6;j++){ const o2=(i*6+j)*3; P[o2]=v.x*R+rt2.x*w*q[j][0]+up2.x*h*q[j][1]; P[o2+1]=v.y*R+rt2.y*w*q[j][0]+up2.y*h*q[j][1]; P[o2+2]=v.z*R+rt2.z*w*q[j][0]+up2.z*h*q[j][1]; Cc[o2]=p[0]*k; Cc[o2+1]=p[1]*k; Cc[o2+2]=p[2]*k; } }
    const cg=new THREE.BufferGeometry(); cg.setAttribute("position",new THREE.BufferAttribute(P,3)); cg.setAttribute("color",new THREE.BufferAttribute(Cc,3));
    sc.add(new THREE.Mesh(cg,new THREE.MeshBasicMaterial({vertexColors:true,side:THREE.DoubleSide,toneMapped:false,fog:false})));
    /* the light banks: rows of bright bulbs along a ring at 24-34 degrees (the stadium rim), cool white; the brightest sits where the key light is */
    const kv=o.key||new THREE.Vector3(-0.6,0.5,0.4), kaz=Math.atan2(kv.z,kv.x), kel=Math.asin(Math.max(-1,Math.min(1,kv.clone().normalize().y)));
    for(let i=0;i<10;i++){ const az=kaz+(i/10)*Math.PI*2+0.3, el=(26+((i*37)%9))*DEG, k=7+((i*53)%5)*2;
      panel(5.2,2.4,az,el,R,[k*0.95,k*0.98,k],sc); }
    /* the floodlights: one at the key light's direction (the biggest), two more up and to the sides (the cover's upper left and upper right banks) */
    panel(8,5,kaz,Math.max(0.3,kel),R,[46,48,52],sc);
    panel(6,4,kaz+1.25,(48)*DEG,R,[24,25,27],sc);
    panel(6,4,kaz-1.15,(44)*DEG,R,[22,23,26],sc);
    /* a warm lamp or two low in the crowd: gold glints on the helmets' sides */
    panel(3,1.2,kaz+2.5,12*DEG,R,[5.5,3.4,1.5],sc); panel(3,1.2,kaz-2.3,10*DEG,R,[5,3.0,1.3],sc);
  } else {
    /* a day: one sun disc, a bright horizon, a few soft clouds */
    const kv=o.key||new THREE.Vector3(-0.5,0.7,0.4), kaz=Math.atan2(kv.z,kv.x), kel=Math.asin(Math.max(-1,Math.min(1,kv.clone().normalize().y)));
    panel(6,6,kaz,Math.max(0.2,kel),R,[40,36,28],sc);
    for(let i=0;i<9;i++) panel(14,4,rnd()*Math.PI*2,(20+rnd()*45)*DEG,R,[1.2,1.2,1.25],sc);
  }
  const pm=new THREE.PMREMGenerator(renderer);
  let rt; try{ rt=pm.fromScene(sc,0.04,0.1,200); } finally { pm.dispose(); sc.traverse(m=>{ if(m.geometry) m.geometry.dispose(); if(m.material) m.material.dispose(); }); }
  return {rt:rt,dispose(){ rt.dispose(); }};
}
