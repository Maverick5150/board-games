/* MOTOCROSS WAR 3D — THE LOOK (owner: lead): the renderer's colour pipeline (sRGB output, filmic tone mapping, exposure), the shadow map,
   the clear colour, the scene with its light rig (hemisphere, the sun with its shadow box, a fill, ambient), the per-venue lighting and
   fog, the shadow box that follows the camera, the blob-shadow opacity, and the (empty) post-processing slot. Moved out of race3d.js byte
   for byte (the file split: no visual change).
   createLook(renderer, {shadows}) -> L: L.scene, L.hemi, L.sun, L.fill, L.amb, L.SUN (the sun's direction), L.shadows (are real shadows on),
   L.setShadows(on), L.apply(C, look, world) (a new race: the venue's lights, exposure, sun disc, fog), L.fitShadow(cam, target) (every
   frame while shadows are on), L.blobOp(x, y, z) (how much of a blob shadow to keep there: 0.42..1), L.render(scene, cam) (the frame:
   draws through L.post when a post-processing chain is set, else straight to the renderer), L.resize(W, H, pr), L.post = null (THE
   POST-PROCESSING SLOT: an object {render(scene, cam), resize(W, H, pr)}; bloom, depth of field and SMAA go here). */
import * as THREE_NS from "../ui/vendor/three-0.160.0.module.min.js";
const THREE=THREE_NS;
import {clamp,sstep} from "./r3d-util.js";

export function createLook(renderer,opts){
  opts=opts||{};
  let SHADOWS=!!opts.shadows;
  /* the colour pipeline, the shadow map, the clear colour */
  renderer.outputColorSpace=THREE.SRGBColorSpace; renderer.toneMapping=THREE.ACESFilmicToneMapping; renderer.toneMappingExposure=1.08;
  renderer.shadowMap.enabled=SHADOWS; renderer.shadowMap.type=THREE.PCFShadowMap;
  renderer.setClearColor(0x05060a,1);
  /* the scene and its lights */
  const scene=new THREE.Scene();
  const hemi=new THREE.HemisphereLight(0xb8c4e0,0x3a2a1c,1.0); scene.add(hemi);
  const sun=new THREE.DirectionalLight(0xfff2dc,2.2); sun.position.set(-60,120,40); scene.add(sun); scene.add(sun.target);
  sun.castShadow=SHADOWS; sun.shadow.mapSize.set(1024,1024); sun.shadow.bias=-0.0008; sun.shadow.normalBias=0.03;
  sun.shadow.camera.near=1; sun.shadow.camera.far=320; let shHalf=0;
  const fill=new THREE.DirectionalLight(0x9fb4ff,0.45); fill.position.set(80,40,-60); scene.add(fill);
  const amb=new THREE.AmbientLight(0xffffff,0.0); scene.add(amb);
  const SUN=new THREE.Vector3(0.5,0.8,0.3);

  function setShadows(on){ SHADOWS=!!on; renderer.shadowMap.enabled=SHADOWS; sun.castShadow=SHADOWS; }
  function lights(C,look,world){
    const night=look.night||C.kind==="stadium";
    if(C.kind==="stadium"){ hemi.color.set(0xc8d0ee); hemi.groundColor.set(0x6a5038); hemi.intensity=1.5; sun.color.set(0xfff3e0); sun.intensity=3.3; sun.position.set(-70,62,40); fill.color.set(0xb8c8ff); fill.intensity=1.1; amb.intensity=0.35; renderer.toneMappingExposure=1.3; }
    else if(night){ hemi.color.set(0x8a96c0); hemi.groundColor.set(0x5a4430); hemi.intensity=1.3; sun.color.set(0xffefd2); sun.intensity=2.8; sun.position.set(-60,70,50); fill.color.set(0xa8b8ff); fill.intensity=0.8; amb.intensity=0.3; renderer.toneMappingExposure=1.22; }
    else { hemi.color.set(0xcfe0ff); hemi.groundColor.set(0x4a3a24); hemi.intensity=1.2; sun.color.set(0xfff4e0); sun.intensity=2.8; sun.position.set(-160,150,90); fill.color.set(0x9fb4ff); fill.intensity=0.35; amb.intensity=0.12; renderer.toneMappingExposure=1.05; }
    if(world.ctx.sunMesh){ world.ctx.sunMesh.position.copy(sun.position).normalize().multiplyScalar(2300); world.ctx.sunMesh.lookAt(0,0,0); }
    SUN.copy(sun.position).normalize();
  }
  /* the shadow box: round what the camera looks at (pulled a little toward the lens), its size from how far the camera is, snapped to
     whole texels in the light's view so the edges never shimmer as it follows the action */
  const shR=new THREE.Vector3(), shU=new THREE.Vector3(), shF=new THREE.Vector3(), shC=new THREE.Vector3(), YUP=new THREE.Vector3(0,1,0);
  function fitShadow(cam,cTarget){
    const sc=sun.shadow.camera, half=clamp(Math.round(cam.position.distanceTo(cTarget)*0.95/4)*4,16,52);
    if(half!==shHalf){ shHalf=half; sc.left=-half; sc.right=half; sc.top=half; sc.bottom=-half; sc.updateProjectionMatrix(); }
    shC.copy(cTarget).lerp(cam.position,0.2);
    shF.copy(SUN).negate(); shR.crossVectors(YUP,SUN).normalize(); shU.crossVectors(SUN,shR);
    const tx=2*half/sun.shadow.mapSize.x, a=shC.dot(shR), b=shC.dot(shU);
    shC.addScaledVector(shR,Math.round(a/tx)*tx-a).addScaledVector(shU,Math.round(b/tx)*tx-b);
    sun.target.position.copy(shC); sun.position.copy(shC).addScaledVector(SUN,160); sun.target.updateMatrixWorld(); sun.updateMatrixWorld();
  }
  /* how much of a blob shadow to keep at (x, z): faint inside the real shadows' box, whole outside it (and with no real shadows) */
  function blobOp(x,y,z){
    if(!SHADOWS||!shHalf) return 1;
    const dx=x-shC.x, dy=y-shC.y, dz=z-shC.z, a=Math.abs(dx*shR.x+dy*shR.y+dz*shR.z), b=Math.abs(dx*shU.x+dy*shU.y+dz*shU.z);
    return 0.42+0.58*sstep(0.72*shHalf,0.94*shHalf,Math.max(a,b));
  }
  const L={scene:scene,hemi:hemi,sun:sun,fill:fill,amb:amb,SUN:SUN,post:null};
  Object.defineProperty(L,"shadows",{get:()=>SHADOWS}); Object.defineProperty(L,"shHalf",{get:()=>shHalf});
  L.setShadows=setShadows; L.fitShadow=fitShadow; L.blobOp=blobOp;
  /* a new race: the venue's lights and exposure, the sun disc, then the fog */
  L.apply=function(C,look,world){
    lights(C,look,world);
    scene.fog=world.ctx.fogC?new THREE.Fog(world.ctx.fogC[0],world.ctx.fogC[1],world.ctx.fogC[2]):null;
  };
  /* THE POST-PROCESSING SLOT (empty): set L.post={render(scene,cam),resize(W,H,pr)} to draw through a chain of passes */
  L.render=function(sc,cam){ if(L.post&&L.post.render) L.post.render(sc,cam); else renderer.render(sc,cam); };
  L.resize=function(W,H,pr){ if(L.post&&L.post.resize) L.post.resize(W,H,pr); };
  return L;
}
