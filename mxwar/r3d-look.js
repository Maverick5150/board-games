/* MOTOCROSS WAR 3D — THE LOOK (owner: lead): how the night stadium is LIT and how the frame is finished.
   The cover is the target: hard cool-white floodlights from the banks (the key, the only light that casts real shadows), a low warm bounce from the dirt, a warm rim
   light that cuts the riders out of the dark (it follows the camera), a soft cool fill so the jersey numbers stay readable, deep blue-black air with a little haze, an
   environment map (a procedural night stadium, r3d-lead-env.js) so every physically based material reflects the light banks, and a post chain (r3d-lead-post.js: HDR scene,
   bloom, depth of field on the chase camera, ACES filmic tone mapping, a colour grade toward the cover, vignette, film grain, SMAA).
   createLook(renderer, {shadows, lo, tv, weak, host}) -> L
     L.scene, L.hemi, L.sun (the KEY), L.fill, L.rim, L.kick, L.bounce, L.amb, L.SUN (the key's direction, a Vector3 updated per venue), L.shadows (are real shadows on), L.shHalf,
     L.setShadows(on), L.apply(C, look, world, env {lo, tv}) (a new race: venue lights, exposure, sun disc, fog, environment map, tier), L.frame(cam, target, dt, tw) (every frame: the camera-relative
     lights, the focus of the depth of field), L.fitShadow(cam, target), L.blobOp(x, y, z), L.render(scene, cam, tw) (the frame), L.resize(W, H, pr), L.dispose(),
     L.post (THE POST SLOT: null = the plain frame; the lead's chain sets it, a test may set {render(scene, cam), resize(W, H, pr)} itself),
     L.upgrade(root) (physically based stand-ins for the Phong materials under root, high / medium tiers), L.receive(root) (every instanced body part receives the key's shadow),
     L.tier, L.setTier(name), L.flags, L.setFlags({...}), L.tiers (the table), L.info() (what is on).
   THE FLAGS (quality tiers switch them; CONTRACT.md section 11): see TIERS below. A tier is a named set of flags: "high", "medium", "low", "stick" (the names of CONTRACT.md 9.4).
   Nobody has to call setTier: apply() picks one from Reduce effects / the TV flag / the weak-GPU test; the performance engineer's V.setQuality(name) may call L.setTier(name). */
import * as THREE_NS from "../ui/vendor/three-0.160.0.module.min.js";
const THREE=THREE_NS;
import {clamp,sstep,setKitTier,pbrFromPhong} from "./r3d-util.js";
import {makeEnvironment} from "./r3d-lead-env.js";
import {createPost,postSupported} from "./r3d-lead-post.js";

/* the tier table: every effect is one flag. post: "full" (HDR scene + bloom + DOF + SMAA + grade) | "lite" (HDR scene + bloom + grade, MSAA) | "off" (the renderer's own frame: nothing extra) */
export const TIERS={
  high:  {rig:"full",shadowRes:1024,softShadow:false,env:true, pbr:true, fog:"exp",post:"full",bloom:1.0,bloomDiv:4,dof:true, motionBlur:1.0,haze:0.011,hazeI:1.0,aa:"fxaa",msaa:0,grade:1,vignette:0.34,grain:0.035,exposure:1.0,cssVig:false},   /* (polish: 1024 and a plain filter, as the quality table says: a 2048 soft map was 4x the texels and 9 taps) */
  ultra: {rig:"full",shadowRes:2048,softShadow:true, env:true, pbr:true, fog:"exp",post:"full",bloom:1.0,bloomDiv:2,dof:true, motionBlur:1.0,haze:0.011,hazeI:1.0,aa:"fxaa",msaa:0,grade:1,vignette:0.34,grain:0.035,exposure:1.0,cssVig:false},
  medium:{motionBlur:0,haze:0,hazeI:1,rig:"full",shadowRes:1024,softShadow:false,env:true, pbr:true, fog:"exp",post:"lite",bloom:0.75,bloomDiv:4,dof:false,aa:"fxaa",msaa:0,grade:1,vignette:0.30,grain:0.0, exposure:1.0,cssVig:false},
  low:   {motionBlur:0,haze:0,hazeI:1,rig:"lite",shadowRes:1024,softShadow:false,env:false,pbr:false,fog:"lin",post:"off", bloom:0,   dof:false,aa:"none",msaa:0,grade:0,vignette:0,   grain:0.0, exposure:1.0,cssVig:false},
  stick: {motionBlur:0,haze:0,hazeI:1,rig:"lite",shadowRes:1024,softShadow:false,env:false,pbr:false,fog:"lin",post:"off", bloom:0,   dof:false,aa:"none",msaa:0,grade:0,vignette:0,   grain:0.0, exposure:1.0,cssVig:false}
};
const SUN_DIR=new THREE.Vector3(), V1=new THREE.Vector3(), V2=new THREE.Vector3(), V3=new THREE.Vector3(), UP=new THREE.Vector3(0,1,0);
const DEG=Math.PI/180;

export function createLook(renderer,opts){
  opts=opts||{};
  let SHADOWS=!!opts.shadows, LO=!!opts.lo, TV=!!opts.tv, WEAK=!!opts.weak, forced=null, tierName="high";
  const F=Object.assign({},TIERS.high);   /* the live flags */
  /* the colour pipeline, the shadow map, the clear colour */
  renderer.outputColorSpace=THREE.SRGBColorSpace; renderer.toneMapping=THREE.ACESFilmicToneMapping; renderer.toneMappingExposure=1.1;
  renderer.shadowMap.enabled=SHADOWS; renderer.shadowMap.type=THREE.PCFShadowMap;
  renderer.setClearColor(0x03040a,1);
  /* the scene and its lights */
  const scene=new THREE.Scene();
  const hemi=new THREE.HemisphereLight(0x4f68b0,0x8a5a34,0.9); scene.add(hemi);
  const sun=new THREE.DirectionalLight(0xeef3ff,4.4); sun.position.set(-78,50,36); scene.add(sun); scene.add(sun.target);
  sun.castShadow=SHADOWS; sun.shadow.mapSize.set(1024,1024); sun.shadow.bias=-0.0004; sun.shadow.normalBias=0.025;
  sun.shadow.camera.near=60; sun.shadow.camera.far=270; sun.shadow.radius=1.5; let shHalf=0;
  const fill=new THREE.DirectionalLight(0x8fa6ff,0.42); fill.position.set(80,40,-60); scene.add(fill);
  const rim=new THREE.DirectionalLight(0xffe0bc,2.2); rim.position.set(0,30,100); scene.add(rim);          /* the warm rim: ahead of the camera, it lights the edges of whatever faces it */
  const kick=new THREE.DirectionalLight(0xa9bcff,0.5); kick.position.set(0,40,-100); scene.add(kick);       /* a soft cool fill from behind the camera: the jersey numbers stay readable */
  const bounce=new THREE.DirectionalLight(0xd88a46,0.8); bounce.position.set(0.15,-1,0.1); scene.add(bounce); /* the warm bounce off the dirt: underside of fenders, helmets, arms */
  const amb=new THREE.AmbientLight(0xffffff,0.0); scene.add(amb);
  const SUN=new THREE.Vector3(0.5,0.8,0.3);
  const base={key:4.4,hemi:0.9,fill:0.42,rim:2.2,kick:0.5,bounce:0.8,amb:0.0};   /* the venue's intensities (the flags scale / switch them) */
  const lastCam=new THREE.Vector3(1e6,0,0); let focusD=8, venueExp=1.1, envRT=null, envKind="", envWant="night", post=null, canPost=false, upRoots=[], fogKind="exp", fogCol=0x0b1226, fogDen=0.0042, cssVig=null, venueNight=true, curDof=0;
  const L={scene:scene,hemi:hemi,sun:sun,fill:fill,rim:rim,kick:kick,bounce:bounce,amb:amb,SUN:SUN,post:null,flags:F,tiers:TIERS};
  Object.defineProperty(L,"shadows",{get:()=>SHADOWS}); Object.defineProperty(L,"shHalf",{get:()=>shHalf}); Object.defineProperty(L,"tier",{get:()=>tierName});

  function setShadows(on){ SHADOWS=!!on; renderer.shadowMap.enabled=SHADOWS; sun.castShadow=SHADOWS; }
  /* the venue's lights (a stadium at night, a floodlit outdoor night, a day) */
  function lights(C,look,world){
    const night=look.night||C.kind==="stadium"; venueNight=night;
    if(C.kind==="stadium"){
      hemi.color.set(0x5a76c8); hemi.groundColor.set(0x8a5a34); sun.color.set(0xfff2e2); sun.position.set(-78,50,36); fill.color.set(0x8fa6ff);
      Object.assign(base,{key:6.8,hemi:0.8,fill:0.5,rim:1.8,kick:0.55,bounce:0.9,amb:0.0}); venueExp=1.12; fogCol=0x0b1226; fogDen=0.0042;
    } else if(night){
      hemi.color.set(0x4a5a94); hemi.groundColor.set(0x7a5030); sun.color.set(0xf0f2ff); sun.position.set(-70,56,50); fill.color.set(0x8fa6ff);
      Object.assign(base,{key:4.0,hemi:0.9,fill:0.45,rim:1.9,kick:0.45,bounce:0.7,amb:0.04}); venueExp=1.1; fogCol=0x0a0f1c; fogDen=0.0030;
    } else {
      hemi.color.set(0xcfe0ff); hemi.groundColor.set(0x6a5034); sun.color.set(0xfff4e0); sun.position.set(-160,150,90); fill.color.set(0x9fb4ff);
      Object.assign(base,{key:3.2,hemi:1.5,fill:0.4,rim:0.5,kick:0.3,bounce:0.5,amb:0.12}); venueExp=1.0; fogCol=0xc6d4e2; fogDen=0.0;
    }
    rim.color.set(night?0xffe0bc:0xfff1dc); kick.color.set(night?0xa9bcff:0xdfe8ff); bounce.color.set(night?0xd88a46:0xb88a5a);
    if(world.ctx.sunMesh){ world.ctx.sunMesh.position.copy(sun.position).normalize().multiplyScalar(2300); world.ctx.sunMesh.lookAt(0,0,0); }
    SUN.copy(sun.position).normalize();
    applyIntensities();
  }
  function applyIntensities(){
    const full=F.rig==="full", e=F.exposure!=null?F.exposure:1;
    sun.intensity=base.key; hemi.intensity=base.hemi*(full?1:1.5); fill.intensity=base.fill*(full?1:1.3); amb.intensity=base.amb+(full?0:0.28);
    rim.intensity=full?base.rim:0; kick.intensity=full?base.kick:0; bounce.intensity=full?base.bounce:0; rim.visible=kick.visible=bounce.visible=full;
    renderer.toneMappingExposure=venueExp*e;
  }
  /* ---- tiers and flags ---- */
  /* the tier nobody asked for: Reduce effects, a weak GPU or ANY TV (the Fire TV Stick model is not measured yet: design for the weakest) = no post chain at all (low / stick); a touch phone = the
     light chain (medium); everything else (a laptop, a desktop) = high. The performance engineer's V.setQuality(name) may call L.setTier(name) to override this once a device is measured. */
  const MOBILE=(()=>{ try{ return (navigator.maxTouchPoints||0)>0&&!TV; }catch(e){ return false; } })();
  function autoTier(){ return TV?"stick":(LO||WEAK)?"low":MOBILE?"medium":"high"; }
  function setFlags(f){
    const was=Object.assign({},F); Object.assign(F,f||{});
    /* the shadow map: its size and its filter */
    if(sun.shadow.mapSize.x!==F.shadowRes){ sun.shadow.mapSize.set(F.shadowRes,F.shadowRes); if(sun.shadow.map){ sun.shadow.map.dispose(); sun.shadow.map=null; } shHalf=0; }
    const st=F.softShadow?THREE.PCFSoftShadowMap:THREE.PCFShadowMap;
    if(renderer.shadowMap.type!==st){ renderer.shadowMap.type=st; renderer.shadowMap.needsUpdate=true; scene.traverse(o=>{ const ms=o.material?(Array.isArray(o.material)?o.material:[o.material]):[]; ms.forEach(m=>{ m.needsUpdate=true; }); }); }
    /* the environment map and the physically based stand-ins */
    if(F.env&&!envRT&&L._world) ensureEnv();
    scene.environment=(F.env&&envRT)?envRT.texture:null;
    setKitTier(F.pbr?(F.post==="full"?"high":"mid"):"low");
    upRoots.forEach(r=>swapPBR(r,F.pbr));
    /* the post chain */
    const wantPost=F.post!=="off"&&canPost;
    if(wantPost){
      if(!post){ post=createPost(renderer,{}); }
      post.setFlags({bloom:F.bloom,bloomDiv:F.bloomDiv||2,dof:F.post==="full"&&F.dof,motionBlur:F.post==="full"?F.motionBlur:0,haze:F.post==="full"?F.haze:0,hazeI:F.hazeI,aa:F.aa,grade:F.grade,vignette:F.vignette,grain:F.grain,exposure:null});
      L.post=post; L._mine=post;
    } else if(L.post&&L.post===L._mine){ L.post=null; L._mine=null; }
    /* the stadium's glow sprites are written in HDR units: 2.5x when the chain's bloom is on (the floodlights bloom and star), 1x on the plain frame (no clipped white blobs on the TV tier) */
    { const gm=L._world&&L._world.ctx&&L._world.ctx.glowMesh; if(gm&&gm.material&&gm.material.uniforms&&gm.material.uniforms.uHdr) gm.material.uniforms.uHdr.value=(wantPost&&F.bloom>0)?2.5:1.8; }   /* (polish, D7: with no bloom chain the halos carry the glow: 1.8x, additive, clipped by the frame) */
    /* the fog */
    if(scene.fog&&L._fogOn) applyFog();
    cssVigOn(!!F.cssVig&&!L.post&&opts.host);
    applyIntensities();
    return F;
  }
  /* the environment map is built the first time a tier that wants it runs on a venue (a race starts as a stick, the performance engineer later raises it: it is made then) */
  function ensureEnv(){
    if(envRT||!envWant) return;
    try{ envRT=makeEnvironment(renderer,{kind:envWant,key:SUN,seed:11}).rt; envKind=envWant; L._envError=""; }catch(e){ envRT=null; L._envError=String(e&&e.stack||e).slice(0,400); }
  }
  function setTier(name){ if(!TIERS[name]) return false; forced=name; tierName=name; setFlags(TIERS[name]); return true; }
  L.setFlags=setFlags; L.setTier=setTier;
  function cssVigOn(on){
    if(!opts.host) return;
    if(on&&!cssVig){ cssVig=document.createElement("div"); cssVig.className="mx-v3__vig"; cssVig.setAttribute("aria-hidden","true");
      cssVig.style.cssText="position:absolute;inset:0;pointer-events:none;background:radial-gradient(ellipse at 50% 48%,rgba(0,0,0,0) 52%,rgba(2,3,8,0.42) 100%);"; opts.host.appendChild(cssVig); }
    else if(!on&&cssVig){ cssVig.remove(); cssVig=null; }
  }

  /* ---- the shadow box: round what the camera looks at (pulled a little toward the lens), its size from how far the camera is, snapped to whole texels in the light's view ---- */
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
  L.setShadows=setShadows; L.fitShadow=fitShadow; L.blobOp=blobOp;

  /* ---- the camera-relative lights and the depth of field's focus (every frame, after the camera is placed) ---- */
  const camF=new THREE.Vector3(), curVP=new THREE.Matrix4(), lastVP=new THREE.Matrix4();
  L.frame=function(cam,target,dt,tw,subjD){
    cam.getWorldDirection(camF); camF.y=0; if(camF.lengthSq()<1e-6) camF.set(1,0,0); camF.normalize();
    if(F.rig==="full"){
      /* the rim: ahead of the camera, 26 degrees up, turned 28 degrees to the camera's right; the kick: behind the camera, 40 degrees up, turned 35 degrees to the left */
      let a=Math.atan2(camF.z,camF.x);
      V1.set(Math.cos(a+28*DEG)*Math.cos(26*DEG),Math.sin(26*DEG),Math.sin(a+28*DEG)*Math.cos(26*DEG)); rim.position.copy(V1).multiplyScalar(100);
      V2.set(Math.cos(a+Math.PI-35*DEG)*Math.cos(40*DEG),Math.sin(40*DEG),Math.sin(a+Math.PI-35*DEG)*Math.cos(40*DEG)); kick.position.copy(V2).multiplyScalar(100);
    }
    /* depth of field and the foreground motion blur: only a close camera (the chase, the crash, the jump close-ups); the focus sits on the subject */
    cam.updateMatrixWorld(); curVP.multiplyMatrices(cam.projectionMatrix,cam.matrixWorldInverse);
    if(post&&L.post===post&&F.post==="full"&&(F.dof||F.motionBlur>0||F.haze>0)){
      /* subjD = the distance to the rider the picture is about (0 = none in view: a wide shot, no blur) */
      const cut=cam.position.distanceTo(lastCam)>2.0||!(dt>0); lastCam.copy(cam.position);   /* a cut (a new shot, a seek): the focus is already there */
      const has=subjD!=null?subjD>0:true, d=subjD>0?subjD:cam.position.distanceTo(target)*0.62, amt=has?(1-0.5*sstep(5,16,d))*(1-sstep(18,36,d)):0, k=Math.min(1,(dt||0.016)*5);
      curDof+=(amt-curDof)*(cut?1:k); if(subjD>0) focusD+=(d-focusD)*(cut?1:Math.min(1,dt*6)); else focusD=d;
      post.setDof(F.dof?curDof:0,clamp(focusD,2.6,40));
      post.setMotion(cut?curVP:lastVP,cut?0:curDof);
    }
    lastVP.copy(curVP);
  };

  /* ---- a new race: the venue's lights and exposure, the sun disc, the environment map, then the fog and the tier ---- */
  L.apply=function(C,look,world,env){
    env=env||{}; if(env.lo!=null) LO=!!env.lo; if(env.tv!=null) TV=!!env.tv;
    canPost=postSupported(renderer);
    lights(C,look,world);
    /* the environment map for this venue (a night stadium, or a day sky), built once per venue kind (and only when a tier wants it) */
    envWant=(C.kind==="stadium"||look.night)?"night":"day"; if(env.rebuildEnv&&envRT){ envRT.dispose(); envRT=null; }
    if(envRT&&envKind!==envWant){ envRT.dispose(); envRT=null; }
    /* the fog: the venue's own for a day, a cool exponential haze in the stadium air at night */
    L._fogOn=true;
    /* the stadium's light-bank glows are drawn at 1.0 or less: below the bloom's threshold. Lights that are not HDR-aware yet (their colour is at most 1.05) are made 2x brighter so the bloom
       makes them glow; a module that already outputs more than 1 (or sets userData.hdr) is left alone */
    const gm=world.ctx&&world.ctx.glowMesh; if(gm&&gm.material&&gm.material.uniforms&&gm.material.uniforms.col&&!gm.material.userData.hdr){ const c=gm.material.uniforms.col.value; if(Math.max(c.r,c.g,c.b)<=1.05){ c.multiplyScalar(2.0); gm.material.userData.hdr=true; } }
    L._world=world; tierName=forced||autoTier(); setFlags(TIERS[tierName]); applyFog(world);
  };
  function applyFog(world){
    world=world||L._world; if(!world) return;
    if(F.fog==="exp"&&venueNight&&fogDen>0){ scene.fog=new THREE.FogExp2(fogCol,fogDen); }
    else scene.fog=world.ctx.fogC?new THREE.Fog(world.ctx.fogC[0],world.ctx.fogC[1],world.ctx.fogC[2]):null;
  }

  /* ---- the physically based stand-ins: a Phong material (the base bike, the helmets) gets a Physical one that reflects the environment; the originals are kept for the low tiers ---- */
  function swapPBR(root,on){
    root.traverse(m=>{ if(!m.isMesh||!m.userData||!m.userData.mxPhong) return; const u=m.userData; if(on){ if(!u.mxPbr) u.mxPbr=pbrFromPhong(u.mxPhong,F.post==="full"?"high":"mid"); m.material=u.mxPbr; } else m.material=u.mxPhong; });
  }
  L.upgrade=function(root){
    /* only plain Phong materials: one with its own onBeforeCompile patch (a specialist's skin, number atlas ...) keeps its own look */
    root.traverse(m=>{ if(m.isMesh&&m.material&&m.material.isMeshPhongMaterial&&!m.userData.mxPhong&&m.material.onBeforeCompile===THREE.Material.prototype.onBeforeCompile){ m.userData.mxPhong=m.material; } });
    upRoots=[root]; swapPBR(root,F.pbr);
  };
  /* every part of the bike and the rider receives the key's shadow (the helmet's on the shoulders, the rider's on the tank): instanced body parts only */
  L.receive=function(root,names){ root.traverse(m=>{ if(m.isMesh&&m.isInstancedMesh&&m.castShadow) m.receiveShadow=true; }); };

  /* ---- the frame ---- */
  L.render=function(sc,cam,tw){
    renderer.info.autoReset=false; renderer.info.reset();
    if(L.post&&L.post.render) L.post.render(sc,cam,tw); else renderer.render(sc,cam);
  };
  L.resize=function(W,H,pr){ if(L.post&&L.post.resize) L.post.resize(W,H,pr); };
  L.dispose=function(){ if(post) post.dispose(); post=null; if(envRT) envRT.dispose(); envRT=null; cssVigOn(false); };
  L.info=function(){ return {tier:tierName,post:!!(L.post&&L.post===post),postInfo:post?post.info():null,env:!!envRT&&!!scene.environment,rig:F.rig,pbr:F.pbr,shadowRes:sun.shadow.mapSize.x,fog:scene.fog?(scene.fog.isFogExp2?"exp2 "+scene.fog.density:"linear"):"none",exposure:renderer.toneMappingExposure,envError:L._envError||""}; };
  setFlags(TIERS[autoTierInit()]);
  function autoTierInit(){ tierName=autoTier(); return tierName; }
  return L;
}
