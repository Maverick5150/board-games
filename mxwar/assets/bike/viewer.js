/* The bike specialist's own test page (not part of the game, not in sw.js): the real bike modules (r3d-bike.js through r3d-riders.js) in a small stadium-lit scene with
   the same light rig as r3d-look.js, so a bike can be looked at from any angle without booting the race. window.VIEWER.shot(cfg) -> a PNG data URL.
   cfg = {w, h, eye:[x,y,z], target:[x,y,z], fov, bikes:[{x,z,th,roll,pitch,stand,crouch,compF,compR,spin,mud,steer,k,color,accent,num,lodD}], lo, shadows} */
import * as THREE from "../../../ui/vendor/three-0.160.0.module.min.js";
import {createRiders,poseRider,commit,tagAt} from "../../r3d-riders.js";
import {lodCounts} from "../../r3d-bike.js";

const q=new URLSearchParams(location.search), W=+q.get("w")||1280, H=+q.get("h")||720;
const renderer=new THREE.WebGLRenderer({antialias:true,powerPreference:"high-performance",alpha:false,preserveDrawingBuffer:false});
renderer.setPixelRatio(1); renderer.setSize(W,H,false); document.body.appendChild(renderer.domElement);
renderer.outputColorSpace=THREE.SRGBColorSpace; renderer.toneMapping=THREE.ACESFilmicToneMapping; renderer.toneMappingExposure=1.3; renderer.shadowMap.enabled=true; renderer.shadowMap.type=THREE.PCFShadowMap; renderer.setClearColor(0x05060a,1);
const scene=new THREE.Scene();
const hemi=new THREE.HemisphereLight(0xc8d0ee,0x6a5038,1.5); scene.add(hemi);
const sun=new THREE.DirectionalLight(0xfff3e0,3.3); sun.castShadow=true; sun.shadow.mapSize.set(2048,2048); sun.shadow.bias=-0.0008; sun.shadow.normalBias=0.03; sun.shadow.camera.near=1; sun.shadow.camera.far=320; scene.add(sun); scene.add(sun.target);
const fill=new THREE.DirectionalLight(0xb8c8ff,1.1); fill.position.set(80,40,-60); scene.add(fill);
scene.add(new THREE.AmbientLight(0xffffff,0.35));
const SUN=new THREE.Vector3(-70,62,40).normalize();
/* ground: warm dirt with a little noise */
{ const c=document.createElement("canvas"); c.width=c.height=256; const x=c.getContext("2d"); const id=x.createImageData(256,256); let s=3; const r=()=>{ s=(s*16807)%2147483647; return s/2147483647; };
  for(let i=0;i<256*256;i++){ const v=0.78+0.22*r(); id.data[i*4]=150*v; id.data[i*4+1]=98*v; id.data[i*4+2]=58*v; id.data[i*4+3]=255; } x.putImageData(id,0,0);
  const t=new THREE.CanvasTexture(c); t.colorSpace=THREE.SRGBColorSpace; t.wrapS=t.wrapT=THREE.RepeatWrapping; t.repeat.set(60,60); t.anisotropy=8;
  const g=new THREE.Mesh(new THREE.PlaneGeometry(400,400),new THREE.MeshLambertMaterial({map:t})); g.rotation.x=-Math.PI/2; g.receiveShadow=true; scene.add(g); }
const cam=new THREE.PerspectiveCamera(60,W/H,0.3,600);
let R=null, list=null, cur=null;
const PAL=[["#d9262b","#f4f4f6"],["#1f4fd8","#ffd400"],["#f0cc10","#111111"],["#ff6a13","#151515"],["#1fa23a","#f0f0f0"],["#1a1a1d","#ff2d2d"],["#7b3fd6","#ffd400"],["#e8e8ec","#d9262b"]];
function setup(cfg){
  if(R){ scene.remove(R.grp); }
  const bikes=cfg.bikes||[{}];
  list=bikes.map((b,i)=>({s:i,color:b.color||PAL[i%PAL.length][0],accent:b.accent||PAL[i%PAL.length][1],num:b.num||String(10+i*7),name:"R"+i,red:i===0&&!!cfg.red,me:false}));
  R=createRiders(list,{lo:!!cfg.lo}); scene.add(R.grp); cur=cfg;
}
const eul=new THREE.Euler(0,0,0,"YZX"), qq=new THREE.Quaternion(), BW=new THREE.Matrix4(), v3=new THREE.Vector3(), one=new THREE.Vector3(1,1,1);
function pose(cfg){
  (cfg.bikes||[{}]).forEach((b,i)=>{
    const th=b.th||0, yaw=-th, roll=b.roll||0, pitch=b.pitch||0, x=b.x||0, z=b.z||0, y=b.y||0;
    eul.set(roll,yaw,pitch,"YZX"); qq.setFromEuler(eul); BW.compose(v3.set(x,y,z),qq,one);
    const st={compF:b.compF==null?0.0:b.compF,compR:b.compR==null?0.0:b.compR,spinF:b.spin||0,spinR:b.spin||0,stand:b.stand==null?0.25:b.stand,dab:b.dab||0,lean:roll,crouch:b.crouch||0,
      mud:b.mud||0,k:b.k||0,steer:b.steer,lodD:b.lodD};
    if(st.lodD==null){ const dx=cfg.eye[0]-x, dy=cfg.eye[1]-y, dz=cfg.eye[2]-z; st.lodD=Math.hypot(dx,dy,dz); }
    if(cfg.noRider) { st.hide=false; }
    poseRider(R,i,BW,st); tagAt(R,i,v3,0);
    if(cfg.noRider){ const M=R.M; const z0=new THREE.Matrix4().makeScale(0,0,0); ["helmet","torso","back"].forEach(k=>M[k].setMatrixAt(i,z0)); ["uarm","farm","thigh","shin"].forEach(k=>{ M[k].setMatrixAt(i*2,z0); M[k].setMatrixAt(i*2+1,z0); }); }
    R.M.shadow.setMatrixAt(i*2,new THREE.Matrix4().makeScale(0,0,0)); R.M.shadow.setMatrixAt(i*2+1,new THREE.Matrix4().makeScale(0,0,0));
  });
  commit(R);
}
function frame(cfg){
  cam.fov=cfg.fov||55; cam.aspect=cfg.w&&cfg.h?cfg.w/cfg.h:W/H; cam.updateProjectionMatrix(); cam.position.set(...cfg.eye); cam.lookAt(new THREE.Vector3(...cfg.target)); cam.updateMatrixWorld();
  const c=new THREE.Vector3(...(cfg.shadowAt||cfg.target)); const half=cfg.shHalf||9;
  sun.shadow.camera.left=-half; sun.shadow.camera.right=half; sun.shadow.camera.top=half; sun.shadow.camera.bottom=-half; sun.shadow.camera.updateProjectionMatrix();
  sun.target.position.copy(c); sun.position.copy(c).addScaledVector(SUN,160); sun.target.updateMatrixWorld(); sun.updateMatrixWorld();
  renderer.shadowMap.enabled=cfg.shadows!==false; sun.castShadow=cfg.shadows!==false;
  renderer.info.autoReset=false; renderer.info.reset();
}
window.VIEWER={
  ready:true,
  shot(cfg,type,qual){
    if(cfg.w&&cfg.h&&(cfg.w!==renderer.domElement.width||cfg.h!==renderer.domElement.height)){ renderer.setSize(cfg.w,cfg.h,false); }
    if(!R||cfg.reset||JSON.stringify(cfg.bikes.map(b=>[b.color,b.accent,b.num]))+cfg.lo+cfg.red!==cur._key){ setup(cfg); cur._key=JSON.stringify(cfg.bikes.map(b=>[b.color,b.accent,b.num]))+cfg.lo+cfg.red; }
    pose(cfg); frame(cfg); renderer.render(scene,cam);
    window.VIEWER.last={calls:renderer.info.render.calls,tris:renderer.info.render.triangles,lods:lodCounts(R.M)};
    return renderer.domElement.toDataURL(type||"image/png",qual||0.95);
  },
  bench(cfg,n){ if(!R||cfg.reset) setup(cfg); pose(cfg); frame(cfg); const gl=renderer.getContext(); const t0=performance.now(); for(let i=0;i<n;i++){ renderer.info.reset(); renderer.render(scene,cam); } gl.finish(); const px=new Uint8Array(4); gl.readPixels(0,0,1,1,gl.RGBA,gl.UNSIGNED_BYTE,px); return (performance.now()-t0)/n; },
  stats(){ return {calls:renderer.info.render.calls,tris:renderer.info.render.triangles,geoms:renderer.info.memory.geometries,tex:renderer.info.memory.textures,programs:renderer.info.programs.length}; },
  gl(){ const gl=renderer.getContext(), d=gl.getExtension("WEBGL_debug_renderer_info"); return d?gl.getParameter(d.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER); }
};
