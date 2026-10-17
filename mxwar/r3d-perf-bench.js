/* MOTOCROSS WAR 3D — THE IN-GAME BENCHMARK (owner: perf). Plays 20 seconds of the real race and shows, on the screen of the device it runs on (the Fire TV
   included), the numbers that decide the quality: fps (average, 1% low, 0.1% low), frame ms (average, 95th, max), draw calls, triangles, the tier chosen and why, the
   render scale the adaptive ladder settled on, the GPU string, the GPU probe, memory. Nothing is simulated: it reads the frame times of the live requestAnimationFrame loop.
   HOW TO START IT
     - a URL flag:  ?bench=1  on the capture page (mxwar/demo.html?live=1&bench=1: a real race of the real engine starts at once and is measured from the gate drop) or on the
       game page (mxwar/index.html?bench=1: start any race; the first 20 s after the gate drops are measured). Extra flags: &benchSeconds=30  &quality=firetv|balanced|high|ultra.
     - ?bench=sweep (capture page only): runs the four tiers one after the other (the page reloads between them; the results are kept in sessionStorage) and ends with a table.
     - a function:  __mxv3.bench({seconds: 20}) -> Promise of the result object; __mxv3.benchResult() the last one; the result is also window.__MXBENCH, a console line
       "[mxwar-bench] {json}" and localStorage "mxwar.bench.last" (the game's settings screen can show it).
   createBench(Q, view) -> B {running(), frame(dt, ms, work), start(o) -> Promise, stop(), result, state}. `view` = {V (the public view), mode(), T(), W(), H()}. */
const GL=typeof window!=="undefined"?window:globalThis;
const nowMs=()=>(GL.performance&&performance.now)?performance.now():Date.now();
const esc=s=>String(s).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
function param(k){ try{ return new GL.URLSearchParams(GL.location.search).get(k); }catch(e){ return null; } }
function lsGet(k){ try{ return GL.localStorage.getItem(k); }catch(e){ return null; } }
function lsSet(k,v){ try{ GL.localStorage.setItem(k,v); }catch(e){} }
function ssGet(k){ try{ return GL.sessionStorage.getItem(k); }catch(e){ return null; } }
function ssSet(k,v){ try{ if(v==null) GL.sessionStorage.removeItem(k); else GL.sessionStorage.setItem(k,v); }catch(e){} }

/* frame statistics from a list of frame times in ms */
export function summarize(ms,target){
  const n=ms.length; if(!n) return null;
  const s=Array.from(ms).sort((a,b)=>a-b); let sum=0; for(let i=0;i<n;i++) sum+=s[i];
  const q=p=>s[Math.min(n-1,Math.floor(n*p))];
  const worst=f=>{ const c=Math.max(1,Math.ceil(n*f)); let t=0; for(let i=n-c;i<n;i++) t+=s[i]; return 1000/(t/c); };
  const Tt=1000/(target||30), under=s.filter(x=>x<=Tt*1.1).length/n, stut=s.filter(x=>x>Tt*2.2).length;
  return {frames:n,seconds:+(sum/1000).toFixed(2),fpsAvg:+(1000/(sum/n)).toFixed(1),fps1Low:+worst(0.01).toFixed(1),fps01Low:+worst(0.001).toFixed(1),
    msAvg:+(sum/n).toFixed(2),ms50:+q(0.5).toFixed(2),ms95:+q(0.95).toFixed(2),ms99:+q(0.99).toFixed(2),msMax:+s[n-1].toFixed(1),msMin:+s[0].toFixed(1),
    pctOnTarget:+(under*100).toFixed(1),stutters:stut};
}

export function createBench(Q,view){
  const mode=param("bench"), auto=!!mode&&mode!=="0"&&mode!=="off";
  const B={mode:mode,auto:auto,state:"idle",result:null,seconds:+(param("benchSeconds")||20),ui:null};
  let samples=[],jsms=[],callsA=[],trisA=[],scales=new Map(),t=0,warm=1.0,armT=0,since=0,res=null,pending=null,events0=0,prDrops0=0,prRaises0=0,sheds0=0,reverts0=0,workA=[],keyH=null;
  B.running=()=>B.state==="running";

  /* ---------------- the overlay ---------------- */
  function css(){
    return "position:fixed;left:2.2vw;top:3vh;max-width:min(94vw,1100px);z-index:2147483000;box-sizing:border-box;padding:1.6vh 2vw;border-radius:10px;background:rgba(6,9,15,.88);"
      +"border:1px solid rgba(236,185,103,.55);color:#f0f1f3;font:600 clamp(13px,2.35vh,26px)/1.38 ui-monospace,Menlo,Consolas,monospace;white-space:pre;pointer-events:none;"
      +"box-shadow:0 8px 40px rgba(0,0,0,.6);";
  }
  let keysOn=false;
  function ensureUI(){
    if(B.ui) return B.ui;
    const d=document.createElement("div"); d.id="mx-bench"; d.setAttribute("role","status"); d.style.cssText=css(); document.body.appendChild(d); B.ui=d;
    d.addEventListener("click",()=>{ if(B.state==="done"||B.state==="idle") B.start({seconds:B.seconds}); });
    if(!keysOn){ keysOn=true; GL.addEventListener("keydown",e=>{ if(!B.ui) return; if(e.key==="Escape"||e.key==="Backspace"||e.key==="b"||e.key==="B"){ B.stop(); hide(); } else if((e.key==="Enter"||e.key===" ")&&B.state==="done"){ e.preventDefault(); B.start({seconds:B.seconds}); } },true); }
    return d;
  }
  function hide(){ if(B.ui){ B.ui.remove(); B.ui=null; } }
  const wrap=(t,n)=>{ const out=[]; let line=""; String(t).split(" ").forEach(w=>{ if((line+" "+w).trim().length>n){ out.push(line); line=w; } else line=(line+" "+w).trim(); }); if(line) out.push(line); return out; };
  const g=(c,v)=>'<span style="color:'+c+'">'+v+"</span>";
  const GOLD="#ecb967", RED="#f72d2e", GREEN="#7ee08f", DIM="#9aa3b2";
  function draw(){
    const d=ensureUI(), S=Q.summary(), live=Q.live;
    const head=g(GOLD,"MOTOCROSS WAR  |  GRAPHICS BENCHMARK");
    if(B.state==="armed"){ d.innerHTML=head+"\n\n"+"waiting for the gate to drop ... start a race ("+esc(S.label)+" tier, target "+S.target+" fps)\n"+g(DIM,"Esc / Back closes"); return; }
    if(B.state==="running"){
      const k=Math.max(1,samples.length), recent=samples.slice(-60), r=summarize(recent,S.target), el=Math.max(0,Math.min(B.seconds,t-warm));
      const bar="#".repeat(Math.round(20*el/B.seconds))+"-".repeat(20-Math.round(20*el/B.seconds));
      d.innerHTML=head+"   "+g(DIM,"["+bar+"] "+el.toFixed(0)+" / "+B.seconds+" s")+"\n\n"
        +"tier    "+esc(S.label)+g(DIM,"  ("+esc(S.source)+")")+"   target "+S.target+" fps\n"
        +"fps now "+(r?g(r.fpsAvg>=S.target*0.95?GREEN:RED,r.fpsAvg.toFixed(1)):"-")+g(DIM,"   frame "+(r?r.msAvg.toFixed(1):"-")+" ms")+"\n"
        +"render  "+Q.renderer.domElement.width+"x"+Q.renderer.domElement.height+g(DIM,"  scale "+live.scale.toFixed(2)+"  pr "+S.pr)+"\n"
        +g(DIM,"keep the race running; "+(k)+" frames so far");
      return;
    }
    const R=B.result; if(!R){ d.innerHTML=head+"\n\nready. Press OK / tap to run "+B.seconds+" s."; return; }
    const ok=R.verdict.pass, col=ok?GREEN:RED;
    const L=[];
    L.push(head+"   "+g(col,ok?"PASS":"BELOW TARGET"));
    L.push("");
    L.push("tier    "+esc(R.tier.label)+g(DIM,"  chosen by "+esc(R.tier.source)+(R.tier.effective!==R.tier.id?"; Reduce effects forces "+R.tier.effective:""))+"   target "+R.target+" fps");
    L.push("fps     avg "+g(col,R.stats.fpsAvg.toFixed(1))+"   1% low "+g(R.stats.fps1Low>=R.target*0.8?GREEN:RED,R.stats.fps1Low.toFixed(1))+"   0.1% low "+R.stats.fps01Low.toFixed(1));
    L.push("frame   avg "+R.stats.msAvg.toFixed(1)+" ms   p95 "+R.stats.ms95.toFixed(1)+"   p99 "+R.stats.ms99.toFixed(1)+"   max "+R.stats.msMax.toFixed(0)+"   on target "+R.stats.pctOnTarget.toFixed(0)+"%");
    L.push("render  "+R.canvas.w+"x"+R.canvas.h+g(DIM,"  (scale "+R.canvas.scaleAvg.toFixed(2)+" of "+R.canvas.cssW+"x"+R.canvas.cssH+", pr "+R.canvas.pr+")")+"   calls "+R.render.calls.avg+"   tris "+Math.round(R.render.tris.avg/1000)+"k");
    L.push("cpu     JS "+R.jsMs.avg.toFixed(1)+" ms/frame (max "+R.jsMs.max.toFixed(0)+")"+(R.gpuWorkMs!=null?"   frame work "+R.gpuWorkMs.toFixed(1)+" ms":"")+"   heap "+(R.memory.heapMB!=null?R.memory.heapMB+" MB":"n/a")+"   tex "+R.memory.textures+" ("+R.memory.texMB+" MB)");
    L.push("ladder  rung "+R.ladder.rung+"/"+(R.ladder.rungs-1)+"   steps down "+R.ladder.downs+"   up "+R.ladder.ups+"   undone "+R.ladder.reverts+g(DIM,"   shadows "+(R.ladder.shadows?"on":"off")));
    L.push("gpu     "+esc(R.gpu.string.slice(0,70))+g(DIM,"  ["+esc(R.gpu.family)+"]  probe "+(R.gpu.probeMs!=null?R.gpu.probeMs+" ms":"n/a")));
    L.push("device  "+(R.device.tv?"TV ":"")+(R.device.mobile?"mobile ":"")+"dpr "+R.device.dpr+"  cores "+(R.device.cores||"?")+"  mem "+(R.device.mem||"?")+" GB"+g(DIM,"   "+new Date(R.when).toISOString().slice(0,19)+"Z"));
    L.push("");
    wrap(R.verdict.text,72).forEach(l=>L.push(g(col,esc(l))));
    L.push(g(DIM,"OK / tap: run again    Esc / Back: close    ?bench=sweep: all four tiers"));
    d.innerHTML=L.join("\n");
  }

  /* ---------------- the run ---------------- */
  function reset(){ samples=[]; jsms=[]; callsA=[]; trisA=[]; workA=[]; scales=new Map(); t=0; armT=0; since=0; res=null;
    prDrops0=Q.stats.prDrops; prRaises0=Q.stats.prRaises; sheds0=Q.stats.sheds; reverts0=Q.stats.reverts; events0=Q.events.length; }
  B.start=function(o){
    o=o||{}; if(o.seconds>0) B.seconds=o.seconds;
    reset(); B.state=o.immediate?"running":"armed"; B.result=null;
    if(B.state==="armed"&&view.mode()==="race"&&view.T()>0.4) B.state="running";
    if(!o.quiet) draw();
    return new Promise(r=>{ pending=r; });
  };
  B.stop=function(){ if(B.state==="running"||B.state==="armed") B.state="idle"; if(pending){ const p=pending; pending=null; p(null); } };
  function sample(){
    let st={}; try{ st=view.V.stats(); }catch(e){}
    callsA.push(st.calls||0); trisA.push(st.tris||0);
  }
  /* ?fps=1: a one-line live counter in the corner (any time, any race): fps, frame ms, size, tier, rung, calls, triangles */
  let hud=null, hudT=0, ring=[];
  function fpsHud(dt){
    ring.push(dt); if(ring.length>45) ring.shift(); hudT+=dt; if(hudT<0.5) return; hudT=0;
    if(!hud){ hud=document.createElement("div"); hud.id="mx-fps"; hud.style.cssText="position:fixed;left:6px;top:6px;z-index:2147482999;padding:3px 8px;border-radius:5px;background:rgba(6,9,15,.72);color:#f0f1f3;font:600 clamp(11px,1.9vh,20px)/1.3 ui-monospace,Menlo,Consolas,monospace;white-space:pre;pointer-events:none"; document.body.appendChild(hud); }
    let sum=0,mx=0; for(let i=0;i<ring.length;i++){ sum+=ring[i]; if(ring[i]>mx) mx=ring[i]; }
    const fps=ring.length/sum, S=Q.summary(); let st={}; try{ st=view.V.stats(); }catch(e){}
    hud.textContent=fps.toFixed(0)+" fps  "+(sum/ring.length*1000).toFixed(1)+" ms (max "+(mx*1000).toFixed(0)+")  "+Q.renderer.domElement.width+"x"+Q.renderer.domElement.height+"  "+S.label+" r"+S.rung+"/"+(S.rungs-1)+"  "+(st.calls||0)+" calls "+Math.round((st.tris||0)/1000)+"k tris";
  }
  const hudOn=param("fps")==="1"||param("fps")==="true";
  B.frame=function(dt,ms,work){
    if(hudOn) fpsHud(dt);
    if(B.state==="armed"){
      armT+=dt; if(view.mode()==="race"&&view.T()>0.4) B.state="running";
      if(B.state==="armed"){ if(Math.floor(armT*4)!==Math.floor((armT-dt)*4)) draw(); return; }
    }
    if(B.state!=="running") return;
    t+=dt;
    if(t<=warm) return;   /* the first second (shader compiles, the camera cut) is not measured */
    samples.push(dt*1000); jsms.push(ms||0); if(work!=null&&work>=0) workA.push(work);
    const k=Q.live.scale; scales.set(k,(scales.get(k)||0)+dt);
    since+=dt; if(since>=0.5){ since=0; sample(); }
    if(Math.floor(t*4)!==Math.floor((t-dt)*4)) draw();
    if(t-warm>=B.seconds) finish();
  };
  function finish(){
    const S=Q.summary(), R={version:1,when:Date.now(),seconds:B.seconds,target:S.target,tier:{id:S.tier,label:S.label,source:S.source,effective:S.effective},
      gpu:{string:S.gpu,family:S.family,cls:S.gpuClass,probeMs:S.probeMs},device:{tv:S.tv,mobile:S.mobile,dpr:S.dpr,cores:Q.dev.cores,mem:Q.dev.mem,ua:(GL.navigator&&navigator.userAgent)||""}};
    R.stats=summarize(samples,S.target);
    const avg=a=>a.length?a.reduce((x,y)=>x+y,0)/a.length:0, mx=a=>a.reduce((x,y)=>Math.max(x,y),0);
    R.jsMs={avg:+avg(jsms).toFixed(2),max:+mx(jsms).toFixed(1)}; R.gpuWorkMs=workA.length?+avg(workA).toFixed(1):null;
    R.render={calls:{avg:Math.round(avg(callsA)),max:mx(callsA)},tris:{avg:Math.round(avg(trisA)),max:mx(trisA)}};
    const cv=Q.renderer.domElement; let sw=0,sa=0; scales.forEach((sec,sc)=>{ sw+=sec; sa+=sc*sec; });
    R.canvas={w:cv.width,h:cv.height,cssW:view.W(),cssH:view.H(),pr:+Q.pr.toFixed(2),prCap:+Q.prCap.toFixed(2),scaleAvg:sw?sa/sw:Q.live.scale,scaleTime:Array.from(scales.entries()).map(e=>[+e[0].toFixed(2),+e[1].toFixed(1)])};
    let mem={}; try{ mem=Q.memory(view.V.scene); }catch(e){}
    R.memory={heapMB:mem.heapMB!=null?mem.heapMB:null,textures:mem.textures||0,texMB:mem.texMB||0,texBudgetMB:mem.texBudgetMB||0,geometries:mem.geometries||0};
    R.ladder={rung:Q.rung,rungs:Q.ladder.n,downs:Q.stats.prDrops-prDrops0,ups:Q.stats.prRaises-prRaises0,sheds:Q.stats.sheds-sheds0,reverts:Q.stats.reverts-reverts0,shadows:Q.live.shadows,events:Q.events.slice(events0).slice(-12)};
    const st=R.stats, ok=st.fpsAvg>=S.target*0.95&&st.fps1Low>=S.target*0.8;
    R.verdict={pass:ok,text:ok?("Holds "+S.target+" fps: "+st.fpsAvg+" fps average, "+st.fps1Low+" at the 1% low, "+st.pctOnTarget+"% of frames on time."):
      ("Below the "+S.target+" fps target: "+st.fpsAvg+" fps average, "+st.fps1Low+" at the 1% low, "+st.pctOnTarget+"% of frames on time"+(Q.rung>=Q.ladder.n-1?"; the ladder is at its floor: this tier is too high for this device.":"; the ladder was still adjusting: run it again."))};
    B.result=R; B.state="done"; GL.__MXBENCH=R;
    try{ console.log("[mxwar-bench] "+JSON.stringify(R)); }catch(e){}
    lsSet("mxwar.bench.last",JSON.stringify(R));
    try{ const h=JSON.parse(lsGet("mxwar.bench.history")||"[]"); h.push({when:R.when,tier:R.tier.id,fps:st.fpsAvg,low:st.fps1Low,gpu:S.gpu.slice(0,50)}); lsSet("mxwar.bench.history",JSON.stringify(h.slice(-12))); }catch(e){}
    if(Q.save) Q.save();
    if(sweep()){ sweepNext(R); } else draw();
    if(pending){ const p=pending; pending=null; p(R); }
  }

  /* ---------------- the sweep (capture page): four tiers, one page load each ---------------- */
  const SWKEY="mxwar.bench.sweep", SWORDER=["firetv","balanced","high","ultra"];
  function sweep(){ return mode==="sweep"; }
  function sweepState(){ try{ return JSON.parse(ssGet(SWKEY)||"null"); }catch(e){ return null; } }
  function gotoTier(id){ try{ const u=new URL(GL.location.href); u.searchParams.set("quality",id); u.searchParams.set("q",id); u.searchParams.set("bench","sweep"); GL.location.replace(u.toString()); }catch(e){} }
  function sweepNext(R){
    const s=sweepState()||{i:0,out:[]}; s.out.push({tier:R.tier.id,label:R.tier.label,fps:R.stats.fpsAvg,low:R.stats.fps1Low,p95:R.stats.ms95,max:R.stats.msMax,w:R.canvas.w,h:R.canvas.h,scale:+R.canvas.scaleAvg.toFixed(2),calls:R.render.calls.avg,tris:R.render.tris.avg,pass:R.verdict.pass,src:R.tier.source,gpu:R.gpu.string});
    s.i++; ssSet(SWKEY,JSON.stringify(s));
    if(s.i<SWORDER.length){ draw(); GL.setTimeout(()=>gotoTier(SWORDER[s.i]),2500); }
    else { ssSet(SWKEY,null); showSweep(s.out); GL.__MXBENCH_SWEEP=s.out; try{ console.log("[mxwar-bench-sweep] "+JSON.stringify(s.out)); lsSet("mxwar.bench.sweep",JSON.stringify(s.out)); }catch(e){} }
  }
  function showSweep(out){
    const d=ensureUI(); d.style.pointerEvents="auto";
    const rows=out.map(r=>(r.label+"        ").slice(0,9)+(" "+r.fps.toFixed(1)).slice(-6)+" fps  1% "+(" "+r.low.toFixed(1)).slice(-5)+"  p95 "+(" "+r.p95.toFixed(0)).slice(-3)+" ms  "+r.w+"x"+r.h+" ("+r.scale.toFixed(2)+")  "+(r.calls+"c ").padStart(5)+Math.round(r.tris/1000)+"k  "+(r.pass?"PASS":"below"));
    d.innerHTML=g(GOLD,"MOTOCROSS WAR  |  BENCHMARK, ALL TIERS")+"\n\n"+esc(rows.join("\n"))+"\n\n"+g(DIM,esc((out[0]&&out[0].gpu||"").slice(0,80)))+"\n"+g(DIM,"the highest tier marked PASS is the one this device can hold");
  }
  /* the sweep needs the right tier from the start of the page: reload once with ?quality= when it is not the one the sweep is on */
  if(sweep()){
    const s=sweepState()||{i:0,out:[]}; const want=SWORDER[Math.min(s.i,SWORDER.length-1)], have=param("quality");   /* (the capture page's own ?q= is set too) */
    if(!ssGet(SWKEY)) ssSet(SWKEY,JSON.stringify(s));
    if(have!==want){ GL.setTimeout(()=>gotoTier(want),50); }
    else B.start({seconds:B.seconds});
  } else if(auto){ B.start({seconds:B.seconds}); }
  return B;
}
