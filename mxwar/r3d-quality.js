/* MOTOCROSS WAR 3D — QUALITY (owner: perf): the quality TIERS, the adaptive-resolution ladder, the GPU classification and probe, the level-of-detail and
   texture-budget helpers, and the in-game BENCHMARK (r3d-perf-bench.js). Everything a specialist needs to know about "how much may I spend" is in ONE place:
   Q.options(LO) -> the flags every builder receives, Q.live -> the flags that move at run time (the ladder), V.qualityNames() / V.setQuality(name).
   TIERS (CONTRACT.md section 3 has the full table):  firetv (FIRE TV: Fire TV Stick class, 960x540 up to 1280x720, no real shadows, no post, 30 fps),
   balanced (mid phones / old laptops, 60 fps), high (today's full look; real shadows, bloom + SMAA slots), ultra (big GPUs: 2048 shadows, DoF, 900 particles).
   Legacy names of the capture harness still work: stick = firetv, low = firetv, medium = balanced.
   How a tier is chosen: ?quality= / ?tier= (or ?q= on the capture page) > a stored choice for this GPU > the GPU string + a 40 ms probe. The ladder then holds
   the frame rate (30 fps on a TV, 60 on a phone) by moving the render scale in 7 small steps and shedding effects in a fixed order, with dwell times and
   bans so it never pumps; it stores what it learned.
   Exports: isTV, motionMode, detectWeakGPU, classifyGpu, TIERS, STEPS, tierNames, resolveTier, createLadder, createLod, texBudget, createQuality. */
import * as THREE_NS from "../ui/vendor/three-0.160.0.module.min.js";
const THREE=THREE_NS;
import {setAniso} from "./r3d-util.js";
import {createBench} from "./r3d-perf-bench.js";
const GL=typeof window!=="undefined"?window:globalThis;
const nowMs=()=>(GL.performance&&performance.now)?performance.now():Date.now();

/* a TV (the Fire TV app and Party Mode's screen set data-tv on the page) */
export function isTV(){ return document.documentElement.hasAttribute("data-tv"); }
/* "off" = reduced motion, "lo" = Reduce effects, "full" */
export function motionMode(){ const B=GL.BGUI; if(document.documentElement.getAttribute("data-motion")==="reduce"||(B&&B.reducedMotion&&B.reducedMotion())) return "off"; return document.documentElement.getAttribute("data-effects")==="reduced"?"lo":"full"; }

/* ---------------------------------------------------------------- the GPU: what is it, how strong (a prior; the probe and the ladder correct it) */
/* class: 0 weak (Fire TV Stick, old phones, Pi), 1 mid (mid phones, integrated laptop GPUs), 2 strong (new phones, Apple, big integrated), 3 big (discrete desktop GPUs, Apple M);
   -1 = a software rasteriser (never fast). The rules are tested top to bottom; the first match wins. */
const GPU_RULES=[
  [/swiftshader|llvmpipe|softpipe|software rasteri|basic render driver|mesa offscreen|microsoft basic/i,-1,"software"],
  [/Mali-(?:4\d\d|T[6-8]\d\d|G31(?!\d)|G51(?!\d))|Mali-G52 ?MC?1(?!\d)/i,0,"mali-low"],
  [/PowerVR|\bIMG\b|GE8\d\d\d|GX6\d\d\d|SGX|Rogue G/i,0,"powervr"],
  [/VideoCore|Vivante|Tegra (?:2|3|4|K1)(?!\d)|Adreno \(TM\) [2-5]\d\d(?!\d)|Adreno [2-5]\d\d(?!\d)/i,0,"old-mobile"],
  [/Intel.*(?:HD Graphics (?:[2-5]\d\d\d|4[0-1]\d|50[0-5])(?!\d)|GMA|Q\d\d)/i,0,"intel-old"],
  [/Mali-G(?:52|57|68|71|72|76)(?!\d)|Adreno \(TM\) 6[0-3]\d(?!\d)|Adreno 6[0-3]\d(?!\d)/i,1,"mobile-mid"],
  [/Apple M\d|GeForce (?:GTX|RTX)|NVIDIA|Radeon (?:RX|Pro|VII)|Arc\(TM\)|Arc A\d|Quadro|RTX/i,3,"discrete"],
  [/Immortalis|Mali-G(?:77|78|310|510|610|615|620|710|715|720)(?!\d)|Adreno \(TM\) (?:6[4-9]|[7-9])\d(?!\d)|Adreno (?:6[4-9]|[7-9])\d(?!\d)|Xclipse/i,2,"mobile-high"],
  [/Iris Xe|Iris\(R\) Xe|Radeon.*Graphics|Intel.*(?:UHD|Iris|HD Graphics)/i,1,"integrated"],
  [/Apple/i,2,"apple"]
];
export function classifyGpu(s){
  s=String(s||"");
  for(let i=0;i<GPU_RULES.length;i++){ const r=GPU_RULES[i]; if(r[0].test(s)) return {cls:r[1],family:r[2],string:s,software:r[1]<0}; }
  return {cls:1,family:"unknown",string:s,software:false};
}
export function gpuString(gl){
  try{ const d=gl.getExtension("WEBGL_debug_renderer_info"); return String(d?gl.getParameter(d.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER)); }catch(e){ return ""; }
}
/* kept for the old callers: a weak GPU (real shadows off) */
export function detectWeakGPU(renderer){
  try{ const g=classifyGpu(gpuString(renderer.getContext())); return g.cls<=0; }catch(e){ return false; }
}

/* ---------------------------------------------------------------- the tiers: THE named flags every specialist reads */
export const STEPS=[1,0.9,0.8,0.75,0.67,0.6,0.5];   /* the render-scale ladder (x the pixel-ratio cap): 7 steps, about 10% apart */
export const TIERS={
  firetv:{id:"firetv",rank:0,label:"FIRE TV",aliases:["stick","low"],fps:30,lo:true,msaa:false,
    note:"Fire TV Stick class (Mali-G31 / GE8300, 1-2 GB): 960x540 up to 1280x720, blob shadows, no post chain, the simple world",
    res:{maxPR:1.0,capW:1280,tvW:1280,start:0.75,min:0.5},
    shadow:{real:false,size:512,soft:false},
    post:{on:false,bloom:false,bloomScale:0.5,aa:"none",dof:false,shafts:false},
    fx:{particles:160,scale:1},
    crowd:{detail:0.35,anim:false},
    scenery:{trees:0.4,terrain:0.5},
    riders:{full:4,mid:6,near:14,far:40},
    tex:{max:512,aniso:1,budgetMB:24},
    budget:{calls:46,tris:110000,geoMB:6}},
  balanced:{id:"balanced",rank:1,label:"BALANCED",aliases:["medium","mid"],fps:60,fpsTV:30,lo:false,msaa:true,
    note:"mid phones, old laptops, integrated GPUs: real shadows (1024), half-resolution bloom, FXAA-class edges, 60 fps",
    res:{maxPR:1.25,tvW:1280,start:1,min:0.5},
    shadow:{real:true,size:1024,soft:false},
    post:{on:true,bloom:true,bloomScale:0.5,aa:"fxaa",dof:false,shafts:false},
    fx:{particles:360,scale:1},
    crowd:{detail:0.7,anim:false},
    scenery:{trees:0.7,terrain:0.8},
    riders:{full:8,mid:8,near:22,far:60},
    tex:{max:1024,aniso:4,budgetMB:48},
    budget:{calls:60,tris:200000,geoMB:10}},
  high:{id:"high",rank:2,label:"HIGH",aliases:[],fps:60,fpsTV:60,lo:false,msaa:true,
    note:"today's full look: real shadows (1024), full-resolution bloom + SMAA slots, 520 particles, animated crowd",
    res:{maxPR:1.75,tvW:1280,start:1,min:0.5},
    shadow:{real:true,size:1024,soft:false},
    post:{on:true,bloom:true,bloomScale:1,aa:"smaa",dof:false,shafts:true},
    fx:{particles:520,scale:1},
    crowd:{detail:1,anim:true},
    scenery:{trees:1,terrain:1},
    riders:{full:12,mid:10,near:30,far:80},
    tex:{max:1024,aniso:8,budgetMB:96},
    budget:{calls:90,tris:350000,geoMB:16}},
  ultra:{id:"ultra",rank:3,label:"ULTRA",aliases:["max"],fps:60,fpsTV:60,lo:false,msaa:true,
    note:"big GPUs: 2048 soft shadows, depth of field, 900 particles, every rider detailed, 2x pixel ratio, 1920 wide on a TV",
    res:{maxPR:2.0,tvW:1920,start:1,min:0.5},
    shadow:{real:true,size:2048,soft:true},
    post:{on:true,bloom:true,bloomScale:1,aa:"smaa",dof:true,shafts:true},
    fx:{particles:900,scale:1},
    crowd:{detail:1,anim:true},
    scenery:{trees:1,terrain:1},
    riders:{full:22,mid:0,near:60,far:120},
    tex:{max:2048,aniso:16,budgetMB:192},
    budget:{calls:140,tris:600000,geoMB:32}}
};
const ORDER=["firetv","balanced","high","ultra"];
export function tierNames(){ return ORDER.slice(); }
/* a tier id from a name, an alias (stick / low / medium ...) or null */
export function resolveTier(name){
  if(name==null) return null; const s=String(name).toLowerCase().trim();
  if(TIERS[s]) return s;
  for(let i=0;i<ORDER.length;i++){ if(TIERS[ORDER[i]].aliases.indexOf(s)>=0) return ORDER[i]; }
  if(s==="firetv"||s==="fire tv"||s==="fire-tv"||s==="tv") return "firetv";
  return null;
}

/* ---------------------------------------------------------------- the rungs: what the ladder moves along (one integer, small steps, fixed order) */
/* The cuts, in the order they are made when frames run long: resolution first (cheap, hardly visible at 10 feet), then the lightest effects, then the
   shadows, then more resolution, then the crowd's animation and the post chain. A cut that this tier has nothing to cut for is skipped. The first
   rungs of a tier that starts below full scale (FIRE TV starts at 0.75 = 960 of 1280) are "bonus" rungs UP: scale 0.8, 0.9, 1.0. */
const CUTS=[["s"],["s"],["fx",0.6],["dof"],["bloomHalf"],["shadows"],["s"],["crowd"],["fx",0.35],["bloom"],["post"],["s"],["s"]];
function nearestStep(v){ let b=0,bd=9; STEPS.forEach((s,i)=>{ const d=Math.abs(s-v); if(d<bd){ bd=d; b=i; } }); return b; }
export function buildRungs(tier,noBonus){
  const s0=nearestStep(tier.res.start||1);
  const st={si:s0,shadows:!!tier.shadow.real,fx:1,dof:!!tier.post.dof,bloom:tier.post.bloom?(tier.post.bloomScale||1):0,post:!!tier.post.on,crowdAnim:!!tier.crowd.anim};
  const rungs=[Object.assign({},st)];
  CUTS.forEach(c=>{
    const n=Object.assign({},st); let did=false;
    switch(c[0]){
      case "s": if(n.si<STEPS.length-1){ n.si++; did=true; } break;
      case "fx": if(n.fx>c[1]){ n.fx=c[1]; did=true; } break;
      case "dof": if(n.dof){ n.dof=false; did=true; } break;
      case "bloomHalf": if(n.bloom>0.5){ n.bloom=0.5; did=true; } break;
      case "shadows": if(n.shadows){ n.shadows=false; did=true; } break;
      case "crowd": if(n.crowdAnim){ n.crowdAnim=false; did=true; } break;
      case "bloom": if(n.bloom>0){ n.bloom=0; did=true; } break;
      case "post": if(n.post){ n.post=false; n.bloom=0; n.dof=false; did=true; } break;
    }
    if(did){ Object.assign(st,n); rungs.push(Object.assign({},st)); }
  });
  let bonus=0;
  if(!noBonus) for(let si=s0-1;si>=0;si--){ rungs.unshift(Object.assign({},rungs[0],{si:si})); bonus++; }
  return {rungs:rungs,k0:bonus};
}
/* the relative frame cost of a rung (arbitrary units, from the measured split of the base frame: ~35% fixed calls / triangles, ~40% fill, ~10% shadow pass,
   ~10% post, ~5% particles); only RATIOS are used, to predict whether one rung up would still hold the frame rate */
export function rungCost(r,tier){
  const s=STEPS[r.si]; return 0.35+0.40*s*s+(r.shadows&&tier.shadow.real?0.10:0)+(r.post?0.10*(0.4+0.6*(r.bloom||0)+(r.dof?0.5:0)):0)+0.05*r.fx;
}

/* ---------------------------------------------------------------- THE LADDER: a pure controller (no GL, no clock: tested on simulated devices in BG_audit/sprint/mxvis/perf/ladder-sim.js)
   frame(dt, work) -> null | {from, to, why}.  dt = seconds between frames, work = the frame's own cost in ms when sampled (sim + draw + a GPU finish), else null.
   T = the frame time to hold (33.3 ms on a TV, 16.7 ms elsewhere; a vsync'd frame lasts a whole number of 16.7 ms, so a 35 ms frame is really 50).
   DOWN: the 1.2 s mean frame time is over T x 1.18 on two evaluations in a row: one rung (two when over T x 1.7); the rung left is banned for 3 dwells (21 s), and each repeat doubles the ban.
   UP: only after a dwell (7 s; 3 s when there is lots of room; doubling to 90 s after a failed try), the mean on target, 4 samples of the frame's own cost that PREDICT (cost model ratio of the rung
   above) <= 82% of T, and the rung not banned. A try is watched for 3.5 s and undone at once when its own cost samples exceed 97% of T or the mean climbs over T x 1.15. Never pumps: bans double. */
export function createLadder(cfg){
  const T=cfg.T, n=cfg.rungs.length, costOf=cfg.cost; let k=Math.max(0,Math.min(n-1,cfg.k0|0)), t=0, dwell=cfg.dwell||7;
  const S={T:T,n:n,fails:0,downs:0,ups:0,reverts:0,mean:0,log:[]};
  let peak=0,win=[],wSum=0,samples=[],lastEval=0,slowEvals=0,tChange=-1e9,settle=cfg.warm!=null?cfg.warm:2.5,watch=null,upOk=0;
  const bans={}, banN={}; const WINS=1.2;
  function reset(){ win.length=0; wSum=0; samples.length=0; slowEvals=0; }
  function med(a){ const s=a.slice().sort((x,y)=>x-y); return s[s.length>>1]; }
  /* the window's mean frame time with its slowest 6% left out: one hitch (a GC, a texture upload) is not a slow device */
  function tmean(){ const c=win.length; if(c<12) return wSum/c*1000; const s=win.slice().sort((x,y)=>x-y), drop=Math.max(1,Math.floor(c*0.06)); let sum=0; for(let i=0;i<c-drop;i++) sum+=s[i]; return sum/(c-drop)*1000; }
  function move(to,why){
    const from=k; k=to; peak*=costOf(to)/costOf(from); reset(); tChange=t; settle=t+1.6; const e={t:+t.toFixed(1),from:from,to:to,why:why}; S.log.push(e); if(S.log.length>40) S.log.shift(); return e;
  }
  /* a rung that was too slow cannot be tried again for a while, and each repeat doubles the wait (3 dwells, 6, 12 ... up to 10 minutes): a limit cycle dies out in two turns */
  function ban(j,extra){ banN[j]=(banN[j]||0)+1; bans[j]=t+Math.min(600,dwell*3*Math.pow(2,banN[j]-1))+(extra||0); }
  Object.defineProperty(S,"k",{get:()=>k,set:v=>{ k=Math.max(0,Math.min(n-1,v|0)); reset(); tChange=t; settle=t+1.6; }});
  Object.defineProperty(S,"dwell",{get:()=>dwell});
  S.frame=function(dt,work){
    t+=dt;
    if(dt>0.22) return null;                                   /* a hitch (shader compile, tab wake-up): not a slow device */
    win.push(dt); wSum+=dt; while(wSum>WINS&&win.length>6) wSum-=win.shift();
    if(work!=null&&work>=0){ samples.push(work); if(samples.length>6) samples.shift(); peak=Math.max(work,peak); if(samples.length>=6){ const md=med(samples); if(md<peak*0.6) peak=md*1.1; } }   /* six samples all far below the old peak: the load has changed for good */
    peak*=Math.exp(-dt/90);   /* the recent worst frame cost, forgotten over about 90 s: slow swings of the load (a camera cut, the pack bunching up) must not fool a try up */
    if(t<settle||t-lastEval<0.4) return null; lastEval=t;
    if(wSum<0.8) return null;
    const m=tmean(); S.mean=m;
    if(watch){
      /* a try one rung up is watched for 3.5 s: its own cost samples (3 of them) must fit in 95% of a frame, and the mean frame time must hold */
      const w3=samples.length>=3?med(samples.slice(-3)):null;
      if(t>watch.until){ watch=null; upOk++; if(upOk>=2){ dwell=Math.max(7,dwell*0.7); upOk=0; } }
      else if((m>T*1.15&&win.length>=8)||(w3!=null&&w3>T*0.97)){ const w=watch; watch=null; S.reverts++; S.fails++; ban(w.to,dwell); dwell=Math.min(90,dwell*1.6); return move(w.from,"revert: the try up ran "+(w3!=null?w3.toFixed(1)+" ms of work":m.toFixed(1)+" ms")); }
    }
    if(m>T*1.18){
      slowEvals++;
      if(slowEvals>=2&&k<n-1){
        /* how far down? the cost model says which rung would fit (at most 3 at once: the model is only a guide) */
        const have=samples.length>=2?Math.max(med(samples),m*0.8):m; let j=k+1; while(j<n-1&&have*costOf(j)/costOf(k)>T*0.95) j++;
        const to=Math.min(n-1,Math.max(k+1,Math.min(k+3,j)));
        if(watch) watch=null;
        ban(k,0); S.downs++;
        return move(to,"slow: "+m.toFixed(1)+" ms mean vs "+T.toFixed(1));
      }
      return null;
    } else slowEvals=0;
    if(k>0&&samples.length>=4&&m<=T*1.1){
      const w=Math.max(med(samples),peak*0.95), p1=w*costOf(k-1)/costOf(k);
      const dw=p1<=T*0.5?Math.max(3,dwell*0.4):dwell;           /* a lot of room: climb back quicker (after a load spike) */
      if(t-tChange>=dw&&(bans[k-1]||0)<=t&&p1<=T*0.82){
        let to=k-1;
        if(k>=2&&(bans[k-2]||0)<=t&&w*costOf(k-2)/costOf(k)<=T*0.7) to=k-2;
        S.ups++; const e=move(to,"headroom: "+w.toFixed(1)+" ms of work predicts "+(w*costOf(to)/costOf(k)).toFixed(1)+" "+(k-to)+" rung(s) up"); watch={from:e.from,to:to,until:t+3.5}; return e;
      }
    }
    return null;
  };
  return S;
}

/* ---------------------------------------------------------------- level of detail and culling helpers (anyone may use them; the view feeds createLod every frame) */
/* createLod(tier-getter) -> L: L.update(cam, list, n, H) with list[i] = {x, y, z, visible}; fills L.level[i] (0 full, 1 mid, 2 low, 3 not in view), L.dist[i], L.px[i] (the rider's height
   on screen in pixels, 2 m tall) and L.counts. The nearest `full` riders in view are level 0, the next `mid` are level 1, the rest 2; a level only changes after 8 frames of
   asking for it (no popping at a boundary). */
export function createLod(){
  const fr=new THREE.Frustum(), pm=new THREE.Matrix4(), sph=new THREE.Sphere(new THREE.Vector3(),1.8);
  const L={level:new Uint8Array(64),want:new Uint8Array(64),hold:new Uint8Array(64),dist:new Float32Array(64),px:new Float32Array(64),counts:[0,0,0,0],frame:0,order:[]};
  L.inView=(x,y,z,r)=>{ sph.center.set(x,y,z); sph.radius=r||1; return fr.intersectsSphere(sph); };
  L.update=function(cam,list,n,H,t){
    L.frame++; n=Math.min(n,64);
    cam.updateMatrixWorld(); pm.multiplyMatrices(cam.projectionMatrix,cam.matrixWorldInverse); fr.setFromProjectionMatrix(pm);
    const cp=cam.position, th=Math.tan(cam.fov*Math.PI/360)*2, full=t.riders.full, mid=t.riders.mid, ord=L.order; ord.length=0;
    for(let i=0;i<n;i++){
      const s=list[i]; if(!s||!s.visible){ L.want[i]=3; L.dist[i]=1e9; L.px[i]=0; continue; }
      sph.center.set(s.x,s.y+0.9,s.z); const d=cp.distanceTo(sph.center); L.dist[i]=d; L.px[i]=d>0.1?2.0/(d*th)*H:H;
      if(!fr.intersectsSphere(sph)){ L.want[i]=3; continue; }
      ord.push(i);
    }
    ord.sort((a,b)=>L.dist[a]-L.dist[b]);
    for(let r=0;r<ord.length;r++){ const i=ord[r]; L.want[i]=(r<full&&L.dist[i]<t.riders.near)?0:(r<full+mid&&L.dist[i]<t.riders.far)?1:2; }
    L.counts[0]=L.counts[1]=L.counts[2]=L.counts[3]=0;
    for(let i=0;i<n;i++){
      if(L.want[i]===L.level[i]) L.hold[i]=0; else if(++L.hold[i]>=8||L.want[i]===3||L.level[i]===3){ L.level[i]=L.want[i]; L.hold[i]=0; }
      L.counts[L.level[i]]++;
    }
    return L;
  };
  return L;
}

/* ---------------------------------------------------------------- texture budget (estimates; canvas / image textures only) */
export function texBudget(root,tier){
  const seen=new Set(); let bytes=0, count=0, biggest=[];
  const add=t=>{ if(!t||!t.isTexture||seen.has(t.uuid)) return; seen.add(t.uuid); const im=t.image, w=(im&&(im.width||im.videoWidth))||0, h=(im&&(im.height||im.videoHeight))||0;
    const mip=t.generateMipmaps!==false&&t.minFilter!==1003&&t.minFilter!==1006; const b=w*h*4*(mip?4/3:1); bytes+=b; count++; biggest.push([b,w+"x"+h+(t.name?" "+t.name:"")]); };
  root.traverse(o=>{ const ms=o.material?(Array.isArray(o.material)?o.material:[o.material]):[]; ms.forEach(m=>{ for(const k in m){ const v=m[k]; if(v&&v.isTexture) add(v); } if(m.uniforms) Object.values(m.uniforms).forEach(u=>{ if(u&&u.value&&u.value.isTexture) add(u.value); }); }); });
  biggest.sort((a,b)=>b[0]-a[0]);
  const MB=bytes/1048576; return {count:count,MB:+MB.toFixed(1),budgetMB:tier?tier.tex.budgetMB:0,over:tier?MB>tier.tex.budgetMB:false,biggest:biggest.slice(0,4).map(b=>b[1])};
}
/* shrink canvas textures larger than `max` (a safety net for the tier's texture size; async image textures are the builder's business) */
export function fitTextures(root,max){
  let n=0; const seen=new Set();
  root.traverse(o=>{ const ms=o.material?(Array.isArray(o.material)?o.material:[o.material]):[]; ms.forEach(m=>{ for(const k in m){ const t=m[k];
    if(!t||!t.isTexture||seen.has(t.uuid)) continue; seen.add(t.uuid); const im=t.image; if(!im||!(im instanceof GL.HTMLCanvasElement)) continue;
    const big=Math.max(im.width,im.height); if(big<=max) continue; const f=max/big, c=document.createElement("canvas"); c.width=Math.max(1,Math.round(im.width*f)); c.height=Math.max(1,Math.round(im.height*f));
    const x=c.getContext("2d"); x.imageSmoothingQuality="high"; x.drawImage(im,0,0,c.width,c.height); t.image=c; t.needsUpdate=true; n++; } }); });
  return n;
}

/* ---------------------------------------------------------------- the GPU probe: ~40 ms on a good GPU. A fixed workload (60k lit triangles + 3 layers of a 40-op fragment shader on a 640x360 target),
   timed with gl.finish(): the median of 8 frames after 3 warm-up frames. Calibration: see CONTRACT.md; the bench panel prints it so the Fire TV's number can be added. */
export function probeGpu(renderer){
  const out={ms:0,ok:false};
  try{
    const gl=renderer.getContext(), W=640, H=360, rt=new THREE.WebGLRenderTarget(W,H,{depthBuffer:true});
    const sc=new THREE.Scene(), cam=new THREE.PerspectiveCamera(50,W/H,0.5,200); cam.position.set(0,6,14); cam.lookAt(0,0,0);
    sc.add(new THREE.HemisphereLight(0xffffff,0x443322,1.2)); const dl=new THREE.DirectionalLight(0xffffff,2); dl.position.set(3,8,5); sc.add(dl);
    const geo=new THREE.IcosahedronGeometry(0.5,3), mat=new THREE.MeshPhongMaterial({color:0xc8a070,shininess:60}), N=192, im=new THREE.InstancedMesh(geo,mat,N), m4=new THREE.Matrix4();
    for(let i=0;i<N;i++){ m4.makeTranslation((i%16-7.5)*0.9,Math.floor(i/16)*0.35-1,(Math.floor(i/16)-6)*1.0); im.setMatrixAt(i,m4); } sc.add(im);
    const fm=new THREE.ShaderMaterial({transparent:true,depthWrite:false,uniforms:{u:{value:0}},vertexShader:"void main(){ gl_Position=vec4(position.xy,0.0,1.0); }",
      fragmentShader:"uniform float u; void main(){ vec2 p=gl_FragCoord.xy*0.01; float a=0.0; for(int i=0;i<10;i++){ a+=sin(p.x*float(i+1)+u)*cos(p.y*float(i+2)-u)+dot(p,p)*0.001; p=p.yx*1.01+a*0.01; } gl_FragColor=vec4(vec3(0.5+0.5*sin(a)),0.18); }"});
    const quad=new THREE.Mesh(new THREE.PlaneGeometry(2,2),fm); quad.frustumCulled=false; for(let i=0;i<3;i++){ const q=quad.clone(); q.renderOrder=10+i; sc.add(q); }
    const prevRT=renderer.getRenderTarget(), prevAuto=renderer.info.autoReset, ts=[];
    renderer.setRenderTarget(rt);
    for(let i=0;i<11;i++){ const t0=nowMs(); renderer.render(sc,cam); gl.finish(); if(i>=3) ts.push(nowMs()-t0); }
    renderer.setRenderTarget(prevRT); renderer.info.autoReset=prevAuto; renderer.info.reset();
    rt.dispose(); geo.dispose(); mat.dispose(); fm.dispose(); quad.geometry.dispose();
    ts.sort((a,b)=>a-b); out.ms=+ts[ts.length>>1].toFixed(2); out.best=+ts[0].toFixed(2); out.ok=true;
  }catch(e){ out.error=String(e&&e.message||e); }
  return out;
}

/* ---------------------------------------------------------------- the quality object */
const STORE="mxwar.quality.v1";
function readStore(){ try{ return JSON.parse(GL.localStorage.getItem(STORE)||"null"); }catch(e){ return null; } }
function writeStore(o){ try{ GL.localStorage.setItem(STORE,JSON.stringify(o)); }catch(e){} }
function urlParam(k){ try{ return new GL.URLSearchParams(GL.location.search).get(k); }catch(e){ return null; } }

export function createQuality(env){
  env=env||{};
  const LO0=!!env.lo;
  const ua=(GL.navigator&&navigator.userAgent)||"";
  const dev={tv:isTV(),mobile:/Android|iPhone|iPad|iPod|Mobile/i.test(ua),dpr:GL.devicePixelRatio||1,cores:(GL.navigator&&navigator.hardwareConcurrency)||0,mem:(GL.navigator&&navigator.deviceMemory)||0};
  /* 1. what GPU: a throwaway context, so the renderer can be made with the right attributes (MSAA cannot be changed later) */
  let gpu0={cls:1,family:"unknown",string:"",software:false};
  try{ const c=document.createElement("canvas"), g=c.getContext("webgl2")||c.getContext("webgl"); if(g){ gpu0=classifyGpu(gpuString(g)); const lc=g.getExtension("WEBGL_lose_context"); if(lc) lc.loseContext(); } }catch(e){}
  /* 2. which tier: an explicit request > a stored choice for this GPU > the GPU class (then the probe) */
  let source="gpu", want=null;
  const req=urlParam("quality")||urlParam("tier")||(GL.DEMO?urlParam("q"):null)||document.documentElement.getAttribute("data-quality");
  if(req&&req!=="auto"&&resolveTier(req)){ want=resolveTier(req); source="url"; }
  const stored=readStore();
  if(!want&&stored&&stored.gpu===gpu0.string&&stored.tier&&TIERS[stored.tier]&&stored.src!=="url"){ want=stored.tier; source="stored"; }
  const prior=gpu0.cls<=0?"firetv":gpu0.cls===1?"balanced":gpu0.cls===2?"high":"ultra";
  let tierId=want||prior;
  const msaaWanted=!LO0&&TIERS[tierId].msaa;
  const renderer=new THREE.WebGLRenderer({antialias:msaaWanted,powerPreference:"high-performance",alpha:false,stencil:false,preserveDrawingBuffer:false});
  const maxAniso=renderer.capabilities.getMaxAnisotropy()||1;
  const Q={renderer:renderer,dev:dev,gpu:gpu0,fixed:false,stats:{prDrops:0,prRaises:0,shadowDrop:false,sheds:0,reverts:0,probeMs:0},events:[]};
  Q.weakGPU=gpu0.cls<=0;
  /* 3. the probe: only when nobody decided and the GPU is not known to be weak (the probe may move the prior one tier either way) */
  Q.probe=null;
  if(!want&&gpu0.cls>=1&&env.probe!==false&&!gpu0.software){
    Q.probe=probeGpu(renderer); Q.stats.probeMs=Q.probe.ms;
    if(Q.probe.ok){ const ms=Q.probe.ms, r=ORDER.indexOf(tierId); let nr=r; if(ms>14) nr=Math.max(0,r-2); else if(ms>7) nr=Math.max(0,r-1); else if(ms<1.6&&gpu0.cls>=2&&!dev.mobile) nr=Math.min(3,r+1); tierId=ORDER[nr]; if(nr!==r) source="probe"; else source="gpu+probe"; }
  } else if(!want&&gpu0.cls<=0) source="gpu";
  if(dev.tv&&!want&&tierId!=="firetv"&&(dev.cores&&dev.cores<=4)&&(dev.mem&&dev.mem<=2)) { tierId="firetv"; source="tv-class"; }
  let tier=TIERS[tierId];
  const autoTier=want?prior:tierId, autoSource=want?"gpu":source;   /* what the system alone would choose here ("auto") */
  Q.source=source; Q.autoTier=autoTier;
  /* anisotropy follows the tier (r3d-util caps it at 8) */
  const applyAniso=()=>setAniso(Math.min(maxAniso,(LO0?TIERS.firetv:tier).tex.aniso));
  applyAniso();

  /* ---- the ladder: rungs of this tier, the current render scale, the live flags ---- */
  let LOcur=LO0, pr=1, prCap=1, RG=null, ladder=null, rung=null, lastW=0, lastH=0, fixedPR=false;
  const live={tier:tierId,shadows:false,shadowSize:1024,particleScale:1,crowdAnim:true,scale:1,pr:1,post:{on:false,bloom:false,bloomScale:1,aa:"none",dof:false,shafts:false}};
  Q.live=live;
  const listeners=[];
  Q.onChange=fn=>{ listeners.push(fn); return ()=>{ const i=listeners.indexOf(fn); if(i>=0) listeners.splice(i,1); }; };
  const emit=(what,info)=>{ Q.events.push({t:+(nowMs()/1000).toFixed(1),what:what,info:info}); if(Q.events.length>60) Q.events.shift(); for(let i=0;i<listeners.length;i++){ try{ listeners[i](what,info,live); }catch(e){} } };
  const eff=()=>LOcur?TIERS.firetv:tier;           /* Reduce effects / reduced motion = the FIRE TV flags whatever the tier */
  const targetFps=()=>{ const e=eff(); return (dev.tv&&e.fpsTV)?e.fpsTV:e.fps; };
  function setRung(){
    const e=eff(); RG=buildRungs(e,LOcur);
    ladder=createLadder({T:1000/targetFps(),rungs:RG.rungs,k0:RG.k0,cost:k=>rungCost(RG.rungs[k],e)});
    rung=RG.rungs[ladder.k]; recompute();
  }
  function recompute(){
    const e=eff(), r=rung||RG.rungs[RG.k0];
    live.tier=e.id; live.shadows=!!(e.shadow.real&&r.shadows); live.shadowSize=e.shadow.size; live.particleScale=r.fx; live.crowdAnim=!!(e.crowd.anim&&r.crowdAnim);
    live.scale=STEPS[r.si]; Object.assign(live.post,{on:!!(e.post.on&&r.post),bloom:!!(e.post.bloom&&r.bloom>0),bloomScale:r.bloom||e.post.bloomScale,aa:r.post?e.post.aa:"none",dof:!!(e.post.dof&&r.dof),shafts:!!(e.post.shafts&&r.post)});
  }
  setRung();
  if(stored&&stored.gpu===gpu0.string&&stored.tier===tierId&&stored.rung!=null&&!LO0&&source!=="url"){ try{ ladder.k=Math.max(0,Math.min(RG.rungs.length-1,stored.rung|0)); rung=RG.rungs[ladder.k]; recompute(); }catch(e){} }

  Object.defineProperty(Q,"pr",{get:()=>pr}); Object.defineProperty(Q,"prCap",{get:()=>prCap});
  Object.defineProperty(Q,"tier",{get:()=>tier}); Object.defineProperty(Q,"tierName",{get:()=>tierId});
  Object.defineProperty(Q,"effTier",{get:()=>eff()});
  Object.defineProperty(Q,"rung",{get:()=>ladder.k}); Object.defineProperty(Q,"ladder",{get:()=>ladder}); Object.defineProperty(Q,"targetFps",{get:()=>targetFps()});
  Q.names=tierNames; Q.resolve=resolveTier; Q.TIERS=TIERS;
  Q.label=name=>{ const id=resolveTier(name); return id?TIERS[id].label:null; };

  /* ---- options for the builders ---- */
  Q.options=function(LO){
    const e=LO?TIERS.firetv:tier;
    return {lo:!!(LO||e.lo),tier:e.id,rank:e.rank,label:e.label,shadow:e.shadow,post:e.post,fx:e.fx,crowd:e.crowd,scenery:e.scenery,riders:e.riders,tex:e.tex,res:e.res,budget:e.budget,
      particles:e.fx.particles,texMax:e.tex.max,aniso:e.tex.aniso,crowdDetail:e.crowd.detail,crowdAnim:e.crowd.anim,trees:e.scenery.trees,terrainDetail:e.scenery.terrain,riderLod:e.riders,
      live:live,key:e.id+(LO?"+lo":"")};
  };
  /* what makes a world new for the cache: the tier's build flags (a tier switch rebuilds the world on the next race) */
  Q.buildKey=function(LO){ return Q.options(LO).key; };
  Q.shadowsWanted=function(LO){ return !LO&&live.shadows; };

  /* ---- the pixel ratio: a cap per device and tier, then the ladder's scale on top ---- */
  function applyPR(p){
    pr=p; live.pr=p; try{ renderer.setPixelRatio(p); renderer.setSize(env.W(),env.H(),false); if(env.resized) env.resized(env.W(),env.H(),p); }catch(e){}
  }
  Q.resize=function(w,h,W,H,LO){
    if(!!LO!==LOcur){ LOcur=!!LO; applyAniso(); setRung(); }
    const dpr=GL.devicePixelRatio||1, e=eff();
    if(!Q.fixed){
      let cap=Math.min(dpr,e.res.maxPR); if(e.res.capW) cap=Math.min(cap,e.res.capW/w); if(dev.tv&&e.res.tvW) cap=Math.min(cap,e.res.tvW/w);
      prCap=Math.max(0.5,cap); pr=Math.max(0.5,prCap*STEPS[rung.si]); live.pr=pr;
      /* the ladder's steps are relative to the cap; a cap that is itself small leaves the steps alone, it never goes below half of it */
    }
    lastW=w; lastH=h;
    return pr;
  };
  Q.fix=function(p,W,H){ prCap=p; pr=p; live.pr=p; renderer.setPixelRatio(p); renderer.setSize(W,H,false); Q.fixed=true; };

  /* ---- applying a rung ---- */
  let shadowSizeApplied=0;
  Q.bindLook=function(LOOK){ Q._look=LOOK; applyShadowMap(); };
  function applyShadowMap(){
    const L=Q._look; if(!L||!L.sun) return; const want=live.shadowSize||1024, sh=L.sun.shadow;
    if(shadowSizeApplied===want||want<=0) return; shadowSizeApplied=want;
    if(sh.mapSize.x!==want){ sh.mapSize.set(want,want); if(sh.map){ sh.map.dispose(); sh.map=null; } }
  }
  function applyRung(why){
    const before={sh:live.shadows,pr:pr};
    rung=RG.rungs[ladder.k]; recompute();
    if(live.shadows!==env.shadowsOn()){ env.setShadows(live.shadows&&!LOcur); }
    Q.stats.shadowDrop=!live.shadows&&eff().shadow.real;
    const np=Math.max(0.5,prCap*STEPS[rung.si]);
    if(!Q.fixed&&Math.abs(np-pr)>1e-3){ if(np<pr) Q.stats.prDrops++; else Q.stats.prRaises++; applyPR(np); }
    emit("rung",{k:ladder.k,why:why,scale:live.scale,shadows:live.shadows,fx:live.particleScale,post:live.post.on,pr:+pr.toFixed(2)});
  }

  /* ---- the frame: the ladder, the benchmark, the level of detail, the GPU sample ---- */
  let frameNo=0, sampleEvery=30, lastWork=0, view=null, lod=createLod(), calmSince=0, persistT=0;
  Q.lod=lod; Q.work=()=>lastWork;
  Q.attach=function(v){ view=v; if(!Q.bench) Q.bench=createBench(Q,v); return Q; };
  Q.adapt=function(dt,ms){
    frameNo++;
    const benchRunning=Q.bench&&Q.bench.running();
    let work=null;
    if(!Q.fixed&&!benchRunning&&frameNo%sampleEvery===0&&dt<0.1){ try{ const gl=renderer.getContext(), t0=nowMs(); gl.finish(); work=(ms||0)+(nowMs()-t0); lastWork=work; }catch(e){} }
    if(view){ try{ if(view.lodList){ const l=view.lodList(); lod.update(view.cam,l,view.count(),view.H(),eff()); for(let i=0;i<l.length&&i<64;i++){ l[i].lod=lod.level[i]; } } }catch(e){} }
    if(Q.bench) Q.bench.frame(dt,ms,work);
    if(Q.fixed) return;
    const a=ladder.frame(dt,work);
    if(a){ if(a.to>a.from&&a.why.indexOf("revert")<0) Q.stats.sheds++; if(a.why.indexOf("revert")===0) Q.stats.reverts++; applyRung(a.why); calmSince=0; }
    else { calmSince+=dt; if(calmSince>20&&nowMs()-persistT>15000){ persistT=nowMs(); Q.save(); calmSince=0; } }
    /* the ladder is at the bottom and frames still run long: the tier itself is too high for this device (an automatic choice only): drop it now, the world follows with the next race */
    if(ladder.k>=ladder.n-1&&source!=="url"&&source!=="manual"&&tier.rank>0&&ladder.mean>ladder.T*1.25){ lowT+=dt; if(lowT>10){ lowT=0; Q.demote("the ladder is at its floor and frames still run "+ladder.mean.toFixed(0)+" ms"); } } else lowT=0;
  };
  let lowT=0;
  Q.save=function(){ if(source==="url") return; writeStore({gpu:gpu0.string,tier:tierId,rung:ladder.k,src:source,t:Date.now()}); };

  /* ---- choosing a tier by hand / by the system ---- */
  /* Q.set(name, src) -> {id, changed, buildChanged}: the run-time flags change at once, the build flags (crowd, textures, particle count ...) with the next race (or at once when the view rebuilds) */
  Q.set=function(name,src){
    let id=resolveTier(name);
    if(String(name).toLowerCase()==="auto"){ id=autoTier; src=autoSource; }   /* "auto" = the system's own choice for this GPU (forgets a manual one) */
    if(!id) throw new Error("no quality '"+name+"' (tiers: "+ORDER.join(", ")+", auto; aliases stick, low, medium)");
    const buildChanged=Q.buildKey(LOcur)!==(TIERS[id].id+(LOcur?"+lo":""));
    const changed=id!==tierId;
    tierId=id; tier=TIERS[id]; source=src||"manual"; Q.source=source; applyAniso(); setRung();
    shadowSizeApplied=0; applyShadowMap();
    if(env.shadowsOn()!==(live.shadows&&!LOcur)) env.setShadows(live.shadows&&!LOcur);
    if(lastW) Q.resize(lastW,lastH,env.W(),env.H(),LOcur);
    if(lastW&&!Q.fixed) applyPR(pr);
    if(source!=="url") Q.save();
    emit("tier",{id:id,source:source});
    return {id:id,changed:changed,buildChanged:buildChanged};
  };
  Q.demote=function(why){ const r=ORDER.indexOf(tierId); if(r<=0) return null; const id=ORDER[r-1]; emit("demote",{from:tierId,to:id,why:why}); const o=Q.set(id,"auto-demote"); Q.pendingBuild=true; return o; };
  Q.summary=function(){ const e=eff(); return {tier:tierId,label:TIERS[tierId].label,effective:e.id,source:source,gpu:gpu0.string,gpuClass:gpu0.cls,family:gpu0.family,probeMs:Q.probe?Q.probe.ms:null,
    target:targetFps(),rung:ladder.k,rungs:ladder.n,scale:live.scale,pr:+pr.toFixed(2),prCap:+prCap.toFixed(2),shadows:live.shadows,tv:dev.tv,mobile:dev.mobile,dpr:dev.dpr,lo:LOcur,msaa:!!msaaWanted}; };

  /* ---- memory ---- */
  Q.memory=function(scene){ const t=texBudget(scene,eff()), i=renderer.info.memory, h=GL.performance&&performance.memory; return {textures:t.count,texMB:t.MB,texBudgetMB:t.budgetMB,texOver:t.over,biggest:t.biggest,geometries:i.geometries,glTextures:i.textures,heapMB:h?+(h.usedJSHeapSize/1048576).toFixed(1):null}; };
  Q.fitTextures=function(root){ return fitTextures(root,eff().tex.max); };
  Q.budgetCheck=function(calls,tris){ const b=eff().budget; return {calls:calls,callsBudget:b.calls,tris:tris,trisBudget:b.tris,ok:calls<=b.calls&&tris<=b.tris}; };
  return Q;
}
