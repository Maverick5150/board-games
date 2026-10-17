/* MOTOCROSS WAR 3D — QUALITY (owner: perf): the renderer's creation options (antialiasing, power preference), the anisotropy setting, the
   weak-GPU test, the reduce-effects and TV flags, and the adaptive pixel-ratio ladder (a pixel-ratio cap per device, lowered on the fly when
   frames run long and raised again when they are fast, the real shadows dropped first). Moved out of race3d.js byte for byte (the file split:
   no visual change).
   isTV(), motionMode() -> "off" (reduced motion) | "lo" (Reduce effects) | "full", detectWeakGPU(renderer),
   createQuality({host, lo, setShadows(on), shadowsOn(), W(), H()}) -> Q: Q.renderer (made here), Q.weakGPU, Q.pr, Q.prCap, Q.fixed,
   Q.stats {prDrops, shadowDrop}, Q.shadowsWanted(LO), Q.resize(w, h, W, H, LO) -> the pixel ratio to apply, Q.adapt(dt) (every frame),
   Q.fix(p, W, H) (tests: a fixed pixel ratio). */
import * as THREE_NS from "../ui/vendor/three-0.160.0.module.min.js";
const THREE=THREE_NS;
import {setAniso} from "./r3d-util.js";
const GL=typeof window!=="undefined"?window:globalThis;

/* a TV (the Fire TV app and Party Mode's screen set data-tv on the page) */
export function isTV(){ return document.documentElement.hasAttribute("data-tv"); }
/* "off" = reduced motion, "lo" = Reduce effects, "full" */
export function motionMode(){ const B=GL.BGUI; if(document.documentElement.getAttribute("data-motion")==="reduce"||(B&&B.reducedMotion&&B.reducedMotion())) return "off"; return document.documentElement.getAttribute("data-effects")==="reduced"?"lo":"full"; }
/* real shadows: off with Reduce effects, on a GPU known to be slow, and dropped by itself when frames run long (adapt) */
export function detectWeakGPU(renderer){
  return (()=>{ try{ const gl=renderer.getContext(), d=gl.getExtension("WEBGL_debug_renderer_info"), s=String(d?gl.getParameter(d.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER)); return /GE8|GX6|SGX|Mali-(4|T[67]|G31|G51)|Adreno \(TM\) [345]\d\d\b|VideoCore|PowerVR Rogue G/i.test(s); }catch(e){ return false; } })();
}

export function createQuality(env){
  env=env||{};
  const lo=!!env.lo;
  const renderer=new THREE.WebGLRenderer({antialias:!lo,powerPreference:"high-performance",alpha:false,stencil:false,preserveDrawingBuffer:false});
  setAniso(lo?2:Math.min(8,renderer.capabilities.getMaxAnisotropy()||1));
  const weakGPU=detectWeakGPU(renderer);
  const Q={renderer:renderer,weakGPU:weakGPU,fixed:false,stats:{prDrops:0,shadowDrop:false}};
  let pr=1, prCap=1;
  Object.defineProperty(Q,"pr",{get:()=>pr}); Object.defineProperty(Q,"prCap",{get:()=>prCap});
  /* the real shadows are wanted unless Reduce effects is on, the GPU is known to be slow, or the ladder has dropped them */
  Q.shadowsWanted=function(LO){ return !LO&&!weakGPU&&!Q.stats.shadowDrop; };
  /* the pixel ratio for a canvas of w x h (it was W x H): a TV at most 1280 x 720 wide (960 with Reduce effects), a phone 1.75 (1.0) */
  Q.resize=function(w,h,W,H,LO){
    const dpr=GL.devicePixelRatio||1;
    if(!Q.fixed){ if(isTV()) prCap=Math.min(dpr,(LO?960:1280)/w); else prCap=Math.min(dpr,LO?1.0:1.75); prCap=Math.max(0.5,prCap); if(w!==W||h!==H||!pr) pr=prCap; }
    return pr;
  };
  let slowT=0, fastT=0, longPrev=false;
  Q.adapt=function(dt){
    if(Q.fixed) return;
    const ft=dt*1000;
    if(ft>220&&!longPrev){ longPrev=true; return; }   /* a one-off hitch (a shader compiling, the tab waking up) is not a slow device; two in a row are */
    longPrev=ft>220;
    if(ft>34){ slowT+=dt; fastT=0; } else if(ft<18){ fastT+=dt; slowT=Math.max(0,slowT-dt*0.5); }
    if(slowT>1.2&&env.shadowsOn()){ env.setShadows(false); Q.stats.shadowDrop=true; slowT=0; return; }   /* the real shadows go first (the blobs stay) */
    if(slowT>1.5&&pr>prCap*0.5){ pr=Math.max(prCap*0.5,pr*0.85); renderer.setPixelRatio(pr); renderer.setSize(env.W(),env.H(),false); slowT=0; Q.stats.prDrops++; }
    else if(fastT>5&&pr<prCap){ pr=Math.min(prCap,pr*1.1); renderer.setPixelRatio(pr); renderer.setSize(env.W(),env.H(),false); fastT=0; }
  };
  Q.fix=function(p,W,H){ prCap=p; pr=p; renderer.setPixelRatio(p); renderer.setSize(W,H,false); Q.fixed=true; };
  /* the quality options every builder receives: buildWorld(C, look, q), createRiders(list, q), createFx({C, look, ...q}). lo = Reduce effects.
     The tiers go here (a crowd density, a particle budget ...): the builders read the fields they know. If a field changes what is BUILT, add it
     to the world's cache key in race3d.js setRace (the [hook:perf] zone next to it). */
  Q.options=function(LO){ return {lo:!!LO}; };
  return Q;
}
