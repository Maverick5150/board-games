/* MOTOCROSS WAR 3D — THE SHADER WARM-UP (owner: perf). Every program the race can need is compiled while the gate shows, so no frame of the race waits for one.
   WHY: three.js compiles a material's program the first time it is drawn in a new STATE, and the adaptive ladder changes exactly those states during a race:
     - real shadows on / off (renderer.shadowMap.enabled: every lit material gets another program),
     - the crowd's animation on / off (its shader is rebuilt), the depth of field and the bloom on / off (the post chain re-creates its final pass with other defines),
     - a new render size (the post chain disposes and re-creates its final pass: its program was destroyed with it and compiled again).
     (The post chain itself is never switched off mid-race any more: r3d-quality.js CUTS. The frame drawn into the chain's target or to the screen is still a state the tools can ask for.)
   Measured before this file (BG_audit/sprint/mxvis2/perf/before-probe-1280.json, the laptop's Intel UHD under the runner's CPU cap): walking the HIGH ladder down and up compiled 59 programs, the
   shadow cut froze the frame 7.3 s and the post-chain cut 16.4 s; BALANCED 1.4 s and 2.3 s; every size step 40-160 ms. After it (probe/a-probe-1280.json): 0 programs compiled during the walk.
   WHAT IT DOES (createWarm(renderer) -> W; W.run(ctx) synchronously, W.runAsync(ctx) as short slices between frames; both return the report):
     1. COMPILE the scene in every state the tier's ladder can reach (renderer.compile under each state: the current state first, so the gate's own frame is ready soonest). compile() covers the
        hidden objects too (the marshal, the crash props, every level of detail). The driver compiles in parallel (KHR_parallel_shader_compile): the async warm WAITS for the programs without
        blocking (it polls program.isReady() every 30 ms, at most 15 s), so the page keeps drawing the gate while the GPU process compiles.
     2. UPLOAD every texture of the scene now (renderer.initTexture, a few per slice): no upload hitch the first time a camera sees the far stand or the marshal.
     3. ONE SHADOW DRAW into a 16 x 16 target with real shadows on (only on a tier that can have them): the shadow pass's depth programs are compiled now.
     4. THE POST CHAIN: each flag set the ladder can reach is drawn once over an EMPTY scene (no world drawn: a few ms), and every pass material it used gets a KEEPER: a twin ShaderMaterial with the same
        code, defines and state, compiled once and never drawn. A keeper holds a reference on the pass's program AND on its shader stages, so when the chain disposes and re-creates its final
        pass (a new size, a flag), the new material finds the same program in three.js' cache: a ladder step compiles nothing.
   ctx = {scene, cam, look (r3d-look.js object: .post), setShadows(on), shadowsOn(), shadowStates [bool], targetStates [bool] (true = drawn into the post chain's target), crowd(on) | null,
          crowdStates [bool], postSets [{post, dof, bloom}] (r3d-look.js flags), applyFlags(f), restoreFlags(), alive() (false = the race this warm was for is gone: stop)}
   Nothing here changes a pixel of a frame (states are restored, the warm draw goes to a private target) and nothing calls Math.random after the first warm of a view (the target and the
   scenes are made once). */
import * as THREE_NS from "../ui/vendor/three-0.160.0.module.min.js";
const THREE=THREE_NS;
const GL=typeof window!=="undefined"?window:globalThis;
const realNow=(GL.Performance&&GL.Performance.prototype&&GL.Performance.prototype.now&&GL.performance)?()=>GL.Performance.prototype.now.call(GL.performance):()=>Date.now();

export function createWarm(renderer){
  const W={runs:0,last:null,keepers:0};
  let tiny=null, empty=null;
  const kScenes={screen:null,target:null}, keepers=new Map(), vpTmp=new THREE.Matrix4();
  const progCount=()=>{ const p=renderer.info&&renderer.info.programs; return p?p.length:-1; };
  function target(){ if(!tiny) tiny=new THREE.WebGLRenderTarget(16,16,{type:THREE.HalfFloatType,depthBuffer:true,stencilBuffer:false,generateMipmaps:false}); return tiny; }
  function uniq(a){ const o=[]; (a||[]).forEach(x=>{ if(o.indexOf(x)<0) o.push(x); }); return o; }
  /* the scene compiled as if drawn to the screen (intoTarget false) or into a target (the post chain's state); the programs it made or found go into `progs` */
  function compileAs(scene,cam,intoTarget,progs){
    const prev=renderer.getRenderTarget(); renderer.setRenderTarget(intoTarget?target():null);
    let mats=null;
    try{ mats=renderer.compile(scene,cam); } finally { renderer.setRenderTarget(prev); }
    if(progs&&mats&&mats.forEach) mats.forEach(m=>{ const p=renderer.properties.get(m), pr=p&&p.currentProgram; if(pr&&progs.indexOf(pr)<0) progs.push(pr); });
  }
  /* 1. every state the ladder can reach: shadows x target x crowd (cur = only the state the view is in now: the gate's own frame) */
  function compileStates(ctx,cur,progs){
    const out=[], sh0=ctx.shadowsOn(), tg0=!!(ctx.look&&ctx.look.post);
    if(cur){ compileAs(ctx.scene,ctx.cam,tg0,progs); out.push((sh0?"SH":"--")+(tg0?"+post":"+screen")+" (now)"); return out; }
    const shs=uniq([sh0].concat(ctx.shadowStates||[])), tgs=uniq([tg0].concat(ctx.targetStates||[])), crs=ctx.crowd?uniq([ctx.crowdNow].concat(ctx.crowdStates||[])):[null];
    try{
      for(const sh of shs){
        if(sh!==ctx.shadowsOn()) ctx.setShadows(sh);
        for(const tg of tgs) for(const cr of crs){
          if(sh===sh0&&tg===tg0&&(cr==null||cr===ctx.crowdNow)) continue;   /* (done by the first slice) */
          if(cr!=null) ctx.crowd(cr);
          compileAs(ctx.scene,ctx.cam,tg,progs); out.push((sh?"SH":"--")+(tg?"+post":"+screen")+(cr==null?"":cr?"+crowdAnim":"+crowdStill"));
        }
      }
    } finally {
      if(ctx.shadowsOn()!==sh0) ctx.setShadows(sh0);
      if(ctx.crowd&&ctx.crowdNow!=null) ctx.crowd(ctx.crowdNow);
    }
    return out;
  }
  /* 2. the textures of the scene (loaded ones only: an image still loading is uploaded by three.js when it arrives) */
  function textures(scene){
    const seen=new Set(), list=[];
    const add=t=>{ if(!t||!t.isTexture||seen.has(t)||t.isRenderTargetTexture) return; seen.add(t); const im=t.image; if(!im) return; if(im.complete===false) return; if(t.isVideoTexture) return; list.push(t); };
    scene.traverse(o=>{ const ms=o.material?(Array.isArray(o.material)?o.material:[o.material]):[]; ms.forEach(m=>{ for(const k in m){ const v=m[k]; if(v&&v.isTexture) add(v); } if(m.uniforms) for(const u in m.uniforms){ const v=m.uniforms[u]&&m.uniforms[u].value; if(v&&v.isTexture) add(v); } }); });
    if(scene.environment&&scene.environment.isTexture) add(scene.environment);
    return list;
  }
  function upload(list,from,n){ let i=from; for(;i<list.length&&i<from+n;i++){ try{ renderer.initTexture(list[i]); }catch(e){} } return i; }
  /* 3. one draw with real shadows on (the shadow pass compiles its depth programs), into the 16 x 16 target: only when the tier can have real shadows */
  function shadowDraw(ctx){
    if((ctx.shadowStates||[]).indexOf(true)<0) return 0;
    const sh0=ctx.shadowsOn(); if(!sh0) ctx.setShadows(true);
    const prev=renderer.getRenderTarget(), ar=renderer.info.autoReset;
    renderer.setRenderTarget(target());
    try{ renderer.render(ctx.scene,ctx.cam); }
    finally{ renderer.setRenderTarget(prev); renderer.info.autoReset=ar; if(ctx.shadowsOn()!==sh0) ctx.setShadows(sh0); }
    return 1;
  }
  /* 4. the post chain: draw each flag set over an empty scene, keep a twin of every pass material (see the header) */
  function twin(m){
    const k=new THREE.ShaderMaterial({vertexShader:m.vertexShader,fragmentShader:m.fragmentShader,defines:Object.assign({},m.defines),uniforms:{},
      toneMapped:m.toneMapped,fog:m.fog,lights:m.lights,transparent:m.transparent,blending:m.blending,blendSrc:m.blendSrc,blendDst:m.blendDst,blendEquation:m.blendEquation,
      side:m.side,depthTest:m.depthTest,depthWrite:m.depthWrite,vertexColors:m.vertexColors,dithering:m.dithering,alphaTest:m.alphaTest,premultipliedAlpha:m.premultipliedAlpha,glslVersion:m.glslVersion,clipping:m.clipping});
    k.extensions=Object.assign({},m.extensions); k.name="perf-keeper"; return k;
  }
  function postSet(ctx,f,rep){
    ctx.applyFlags(f);
    const P=ctx.look&&ctx.look.post; if(!P||!P.render) return;
    if(!empty) empty=new THREE.Scene();
    const seen=[], orig=renderer.render;
    renderer.render=function(s){ if(s&&s!==empty&&s.isScene&&s.children.length===1){ const o=s.children[0], m=o.material; if(m&&m.isShaderMaterial) seen.push([m,renderer.getRenderTarget()===null,o.geometry]); } return orig.apply(renderer,arguments); };
    /* (milestone 2 merge) the lead's half-resolution chain draws its prepass, its gather (depth of field + camera motion blur) and its contact-shadow pass only while a subject is near and
       the camera moves: all three are switched on for this one draw so their programs get keepers too (the next frame's LOOK.frame sets the real values again before anything is drawn) */
    try{ if(f.dof&&P.setDof) P.setDof(0.5,8); if(P.setAo) P.setAo(true); if(P.setMotion){ ctx.cam.updateMatrixWorld(); vpTmp.multiplyMatrices(ctx.cam.projectionMatrix,ctx.cam.matrixWorldInverse); P.setMotion(vpTmp,1); } P.render(empty,ctx.cam,0); } finally { renderer.render=orig; }
    seen.forEach(([m,toScreen,geo])=>{
      const pp=renderer.properties.get(m), prog=pp&&pp.currentProgram; if(!prog) return;
      const key=prog.cacheKey; if(keepers.has(key)) return;
      const which=toScreen?"screen":"target"; if(!kScenes[which]) kScenes[which]=new THREE.Scene();
      const k=twin(m), mesh=new THREE.Mesh(geo,k); mesh.frustumCulled=false; kScenes[which].add(mesh);
      compileAs(kScenes[which],ctx.cam,!toScreen,null);
      const kp=renderer.properties.get(k).currentProgram;
      keepers.set(key,{mat:k,mesh:mesh}); rep.keepers++; if(kp!==prog) rep.keeperMiss++;
    });
  }
  function report(){ return {ms:0,programs0:progCount(),programs:0,states:[],compiled:0,waitMs:0,notReady:0,textures:0,shadowDraw:0,keepers:0,keeperMiss:0,slices:[],progAfter:[]}; }
  function finish(rep,t0){ rep.ms=+(realNow()-t0).toFixed(1); rep.programs=progCount(); rep.keepersAll=keepers.size; W.runs++; W.last=rep; W.keepers=keepers.size; return rep; }
  /* synchronously (the capture page warms inside setRace; tools): the first draw of each new program blocks until the driver has compiled it, which is fine there */
  W.run=function(ctx){
    const rep=report(), t0=realNow(), progs=[];
    const step=(fn)=>{ const a=realNow(); try{ fn(); }catch(e){ rep.error=String(e&&e.message||e); } rep.slices.push(+(realNow()-a).toFixed(1)); rep.progAfter.push(progCount()); };
    step(()=>{ rep.states=rep.states.concat(compileStates(ctx,true,progs)); });
    step(()=>{ rep.states=rep.states.concat(compileStates(ctx,false,progs)); });
    step(()=>{ const l=textures(ctx.scene); upload(l,0,l.length); rep.textures=l.length; });
    step(()=>{ rep.shadowDraw=shadowDraw(ctx); });
    step(()=>{ (ctx.postSets||[]).forEach(f=>postSet(ctx,f,rep)); ctx.restoreFlags(); });
    rep.compiled=progs.length;
    return finish(rep,t0);
  };
  /* as short slices between frames (the game: V.warm() right after setRace, while the gate shows); waits for the driver's parallel compiles without blocking; stops when ctx.alive() turns false */
  W.runAsync=function(ctx){
    const rep=report(), t0=realNow(), progs=[]; let texList=null, texAt=0, waitT0=0;
    const list=[
      ()=>{ rep.states=rep.states.concat(compileStates(ctx,true,progs)); },
      ()=>{ rep.states=rep.states.concat(compileStates(ctx,false,progs)); rep.compiled=progs.length; waitT0=realNow(); },
      ()=>{ /* wait for the parallel compiles (never blocks: isReady() asks without waiting when the driver can tell; without that extension isReady() is true at once) */
        const left=progs.filter(p=>{ try{ return !p.isReady(); }catch(e){ return false; } });
        rep.notReady=left.length;
        if(left.length&&realNow()-waitT0<15000) return "again";
        rep.waitMs=+(realNow()-waitT0).toFixed(1);
      },
      ()=>{ if(!texList){ texList=textures(ctx.scene); rep.textures=texList.length; } texAt=upload(texList,texAt,4); if(texAt<texList.length) return "again"; },
      ()=>{ rep.shadowDraw=shadowDraw(ctx); },
      ()=>{ (ctx.postSets||[]).forEach(f=>postSet(ctx,f,rep)); ctx.restoreFlags(); }
    ];
    return new Promise(res=>{
      let i=0;
      const next=()=>{
        if(i>=list.length||(ctx.alive&&!ctx.alive())){ rep.aborted=i<list.length; res(finish(rep,t0)); return; }
        const a=realNow(); let r; try{ r=list[i](); }catch(e){ rep.error=String(e&&e.message||e); }
        if(r==="again"){ GL.setTimeout(next,i===2?30:0); return; }
        rep.slices.push(+(realNow()-a).toFixed(1)); rep.progAfter.push(progCount()); i++;
        GL.setTimeout(next,0);
      };
      GL.setTimeout(next,0);
    });
  };
  W.dispose=function(){ keepers.forEach(k=>{ k.mat.dispose(); }); keepers.clear(); if(tiny){ tiny.dispose(); tiny=null; } };
  return W;
}
