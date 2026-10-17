/* MOTOCROSS WAR 3D — the RACE VIEW (the CEO, 2026-10-16 20:06: "i want 3D perfection on every track the results of the cards is what moves
   the driver ... People will want to watch the race with perfect physics, if they lose a war double war the rider crashes and gets back up.
   If they lose a triple war they crash and dont return for the whole race. When a rider crashes the yellow flag comes out. I wanna see the
   whoop section and jumps. With great graphics."; ~21:10: "A lap on screen takes a REAL lap time"). ES module on three.js r160 (vendored:
   ui/vendor/three-0.160.0.module.min.js, MIT).
   - REAL TIME: the race clock runs at 1x from the gate drop; every lap takes the track's real lap time (course.js: a lap-time simulation of
     this layout, a stadium lap about 50 s, outdoors about 2 min). Nothing ever zips.
   - THE CARDS MOVE THE RIDERS. One battle = one lap: when the leader starts a lap the view tells the game (hooks.onLap), the cards turn, and
     V.lap(result) moves every rider's GAP (seconds behind the leader's schedule) from where it is to the new standings over the rest of the
     lap, never more than 16% faster or slower than the schedule: the lap's winner surges and passes, losers fade, passes are smooth and
     spread over the lap, on another line (riders keep their spacing). The running order on track becomes the order of the cards.
   - PHYSICS THAT LOOKS REAL: each axle is a sprung, damped mass on its own wheel (the suspension compresses on landings and soaks the
     whoops while the riders skim them), ballistic arcs over every jump (the exact take-off speed, the bike pitching to the arc, the rider
     standing, a whip on the big ones), leaning into turns (lean = atan(v^2 k / g)), braking into berms, seated in turns with the inside
     foot out, roost when the throttle opens, dust on landings.
   - CRASHES (CRASH-CONTRACT.md): at the engine's crash sector a double-war loser tumbles, lies, gets up, lifts the bike, remounts and
     rejoins further back; a triple-war loser tumbles and walks off (out), the bike left on its side; a marshal waves the YELLOW flag there,
     and the next lap nobody passes in that section.
   - A TV CAMERA DIRECTOR shows the whole lap at real speed, cutting between sections as the leader rides them: the gate from the front,
     the holeshot into turn 1, the whoops from the side, the big jump from below, a battle for position, a crash about to happen, the
     yellow flag, chase cams on the leader or on You, a wide heli shot, the white flag and the checkered flag at the line.
   - Performance: every part type is one instanced draw call (about 26-32 draw calls), low-poly (about 80k triangles with 22 riders), the
     pixel ratio capped (phone 1.75, TV at most 1280 x 720, Reduce effects 960 x 540) and lowered on the fly when frames run long; the
     clock stops while the page is hidden or the race isn't on screen; reduced motion = a still wide frame every 2 s, no camera moves.
   API (game.js): supported(); create(host, hooks {onLap(n), onFinish()}) -> V: V.setRace(o), V.gate(), V.drop(), V.lap(result) -> show
   {at(name): Promise (holeshot | pass | crash | yellow | line | done)}, V.hold(o), V.standings(order, cnt, lap), V.setFlag(k), V.setRed(s),
   V.markOut(s), V.show(on), V.resize(), V.skip(), V.state(), V.stats(), V.shot(name) (tests). */
import * as THREE_NS from "../ui/vendor/three-0.160.0.module.min.js";
import {buildWorld,gateBuild,flaggerBuild,flagTex,clear} from "./r3d-world.js";
import {createRiders,poseRider,hideRider,shadowAt,tagAt,commit,emit,stepParticles,BIKE,setRed as atlasRed} from "./r3d-riders.js";
const THREE=THREE_NS;
const GL=typeof window!=="undefined"?window:globalThis;
const MX=GL.MXWar;
const G=9.81, PI=Math.PI, GRATE=0.16;
function clamp(x,a,b){ return x<a?a:x>b?b:x; }
function sstep(a,b,x){ const t=clamp((x-a)/(b-a),0,1); return t*t*(3-2*t); }
function now(){ return (GL.performance&&performance.now)?performance.now():Date.now(); }

export function supported(){
  try{ const c=document.createElement("canvas"); return !!(GL.WebGLRenderingContext&&(c.getContext("webgl2")||c.getContext("webgl"))); }catch(e){ return false; }
}

export function create(host,hooks){
  hooks=hooks||{};
  const tv=()=>document.documentElement.hasAttribute("data-tv");
  const motion=()=>{ const B=GL.BGUI; if(document.documentElement.getAttribute("data-motion")==="reduce"||(B&&B.reducedMotion&&B.reducedMotion())) return "off"; return document.documentElement.getAttribute("data-effects")==="reduced"?"lo":"full"; };
  let LO=motion()!=="full";
  /* ---------------- renderer ---------------- */
  const renderer=new THREE.WebGLRenderer({antialias:!LO&&!tv(),powerPreference:"high-performance",alpha:false,stencil:false,preserveDrawingBuffer:false});
  renderer.outputColorSpace=THREE.SRGBColorSpace; renderer.toneMapping=THREE.ACESFilmicToneMapping; renderer.toneMappingExposure=1.08;
  renderer.setClearColor(0x05060a,1);
  const cv=renderer.domElement; cv.className="mx-v3__cv"; cv.setAttribute("aria-hidden","true"); host.appendChild(cv);
  const V={lost:false};
  cv.addEventListener("webglcontextlost",e=>{ e.preventDefault(); V.lost=true; V.stop(); if(hooks.lost) hooks.lost(); },false);
  const scene=new THREE.Scene();
  const cam=new THREE.PerspectiveCamera(50,1,0.5,4200);
  const hemi=new THREE.HemisphereLight(0xb8c4e0,0x3a2a1c,1.0); scene.add(hemi);
  const sun=new THREE.DirectionalLight(0xfff2dc,2.2); sun.position.set(-60,120,40); scene.add(sun); scene.add(sun.target);
  const fill=new THREE.DirectionalLight(0x9fb4ff,0.45); fill.position.set(80,40,-60); scene.add(fill);
  const amb=new THREE.AmbientLight(0xffffff,0.0); scene.add(amb);
  let W=0,H=0,pr=1,prCap=1;
  /* ---------------- state ---------------- */
  let C=null, look=null, world=null, worldKey="", R=null, rs=[], N=0, list=[], gate=null, flagger=null, marshal=null;
  let T=0, lapNo=1, lenLaps=30, mode="idle", show=null, holdInfo=null, flag=null, running=false, want=false, raf=0, lastT=0, yellow=null, lapPlan=null, finished=false, stillT=0;
  let shot=null, shotLog=[], featLog=[];
  const camS={pos:new THREE.Vector3(),look:new THREE.Vector3(),fov:50,snap:true};
  let meSeats=[], redSeat=-1;
  const texFlags={};
  const stats={frames:0,ms:0,msMax:0,calls:0,tris:0,fpsT0:now(),fpsN:0,fps:0,prDrops:0,ft:[]};
  const tmpO={}, tmpO2={}, q=new THREE.Quaternion(), eul=new THREE.Euler(0,0,0,"YZX"), v3=new THREE.Vector3(), sc1=new THREE.Vector3(1,1,1);

  /* ---------------- the round -> the course and the world (built once per layout) ---------------- */
  V.setRace=function(o){
    const lo=motion()!=="full"; if(lo!==LO){ LO=lo; worldKey=""; }   /* Reduce effects changed: the next race is built simpler (or richer) */
    const pick=MX.Layouts.pick(o.series,o.year,o.round,o.cal||{});
    const key=pick.layout.id+"|"+(pick.look.around)+"|"+(LO?"lo":"hi");
    if(key!==worldKey){
      if(world){ disposeTree(world.root); scene.remove(world.root); }
      C=MX.Course.build(pick.layout); look=pick.look; worldKey=key;
      world=buildWorld(C,look,{lo:LO}); scene.add(world.root);
      lights();
      scene.fog=world.ctx.fogC?new THREE.Fog(world.ctx.fogC[0],world.ctx.fogC[1],world.ctx.fogC[2]):null;
      flagger=flaggerBuild(flagT("white")); flagger.grp.position.copy(world.fin.flagAt).add(v3.set(0,-0.02,0)); flagger.grp.rotation.y=-world.fin.th+(world.fin.side>0?PI:0); world.root.add(flagger.grp);
      marshal=flaggerBuild(flagT("yellow")); marshal.grp.visible=false; world.root.add(marshal.grp);
    }
    V.layout=pick; V.courseInfo={id:C.id,L:+C.L.toFixed(1),Tlap:+C.Tlap.toFixed(1),D1:+C.D1.toFixed(1),T1:+C.T1.toFixed(1),kind:C.kind,shared:pick.shared,name:pick.layout.name};
    if(R){ disposeTree(R.grp); scene.remove(R.grp); }
    list=o.riders.map((r,k)=>({s:r.s!=null?r.s:k,color:r.color,accent:r.accent,num:r.num,name:r.name,red:!!r.red,me:!!r.me}));
    N=list.length; meSeats=list.filter(r=>r.me).map(r=>r.s); redSeat=(list.find(r=>r.red)||{s:-1}).s;
    R=createRiders(list,{lo:LO}); scene.add(R.grp);
    if(gate){ world.root.remove(gate.grp); disposeTree(gate.grp); }
    gate=gateBuild(C,look,N); world.root.add(gate.grp);
    rs=list.map((r,k)=>({k:k,seat:r.s,g:0,tg:null,boot:null,lat:gate.slotLat(slotOf(k)),latT:0,bias:(((k*7919)%11)/10-0.5)*0.7,D:-0.95,Dp:-0.95,s:0,onStart:true,v:0,vp:0,
      F:{y:0,v:0},Rr:{y:0,v:0},stand:0,lean:0,dab:0,spinF:0,spinR:0,gone:false,crash:null,crashPlan:null,air:false,init:false,lapN:1}));
    lenLaps=o.len||30; lapNo=1; T=0; holdInfo=null; flag=null; yellow=null; lapPlan=null; finished=false; show=null; shotLog=[]; featLog=[];
    if(world.ctx.screen) world.ctx.screen(0,lenLaps,null);
    gate.set(0); gate.drop=0; gate.dropT=-1; V.setFlag(null); marshal.grp.visible=false;
    mode="gate"; setShot({type:"gate",subj:-1,pri:0,min:1e9,max:1e9});
    V.resize(); renderOnce();
    return V.courseInfo;
  };
  function slotOf(k){ const n=gate.slots, mid=Math.floor(n/2); return clamp(mid+(k%2?1:-1)*Math.ceil(k/2),0,n-1); }
  function flagT(k){ return texFlags[k]||(texFlags[k]=flagTex(k)); }
  function lights(){
    const night=look.night||C.kind==="stadium";
    if(C.kind==="stadium"){ hemi.color.set(0xc8d0ee); hemi.groundColor.set(0x6a5038); hemi.intensity=1.5; sun.color.set(0xfff3e0); sun.intensity=3.3; sun.position.set(-70,62,40); fill.color.set(0xb8c8ff); fill.intensity=1.1; amb.intensity=0.35; renderer.toneMappingExposure=1.3; }
    else if(night){ hemi.color.set(0x8a96c0); hemi.groundColor.set(0x5a4430); hemi.intensity=1.3; sun.color.set(0xffefd2); sun.intensity=2.8; sun.position.set(-60,70,50); fill.color.set(0xa8b8ff); fill.intensity=0.8; amb.intensity=0.3; renderer.toneMappingExposure=1.22; }
    else { hemi.color.set(0xcfe0ff); hemi.groundColor.set(0x4a3a24); hemi.intensity=1.2; sun.color.set(0xfff4e0); sun.intensity=2.8; sun.position.set(-160,150,90); fill.color.set(0x9fb4ff); fill.intensity=0.35; amb.intensity=0.12; renderer.toneMappingExposure=1.05; }
    if(world.ctx.sunMesh){ world.ctx.sunMesh.position.copy(sun.position).normalize().multiplyScalar(2300); world.ctx.sunMesh.lookAt(0,0,0); }
  }
  function disposeTree(o){ o.traverse(m=>{ if(m.geometry) m.geometry.dispose(); if(m.material){ const ms=Array.isArray(m.material)?m.material:[m.material]; ms.forEach(x=>{ if(x.map) x.map.dispose(); x.dispose(); }); } }); }

  /* ---------------- the clock, the laps, the gaps ---------------- */
  function lapStartT(n){ return MX.Course.tOfD(C,MX.Course.lapStartD(C,n)); }
  function tauOf(i){ const r=rs[i]; if(r.crash) return r.crash.tau; return T-r.g; }
  function inYellow(r){ if(!yellow||yellow.lap!==lapNo||r.onStart) return false; return MX.Course.wrap(C,r.s-yellow.s0)<yellow.len; }
  function updateGaps(dt){
    for(let i=0;i<N;i++){ const r=rs[i]; if(r.gone||r.crash) continue;
      if(r.boot){ /* restarting after a remount: from a stop up to speed over 2.2 s (the rider's clock runs slow, the gap grows) */
        r.boot.t+=dt; const slow=Math.max(0,1-r.boot.t/2.2); r.g+=slow*dt; if(r.boot.t>=2.2){ r.boot=null; const g1=r.tg?r.tg.g1:r.g; r.tg={g0:r.g,g1:g1,p:0,rate:1/Math.max(10,lapStartT(lapNo+1)-T)}; } continue; }
      const tg=r.tg; if(!tg) continue;
      if(inYellow(r)) continue;   /* the yellow section: nobody gains or loses a place there */
      tg.p=Math.min(1,tg.p+dt*tg.rate);
      const e=tg.p*tg.p*(3-2*tg.p), want=tg.g0+(tg.g1-tg.g0)*e;
      r.g+=clamp(want-r.g,-GRATE*dt,GRATE*dt);
    }
  }
  /* a lap's result: every rider rides from where they are to the new standings over the rest of the lap */
  V.lap=function(req){
    const S=makeShow();
    if(!C||!R){ S.fire("done"); return S; }
    if(show&&!show.ended) endShow();
    show=S; holdInfo=null; mode="race";
    const n=req.lap||lapNo;
    const alive=req.order1.filter(s=>!(req.dnf&&req.dnf.indexOf(s)>=0)&&rs[s]&&!rs[s].gone);
    const gg=MX.Course.gaps(alive,req.cnt1,C.Tlap,{base:0.5,extra:1.4});
    const Tend=Math.max(T+8,lapStartT(n+1)-1.5), rate=1/Math.max(5,Tend-T);
    rs.forEach((r,i)=>{ const g1=gg[i]!=null?gg[i]:r.g+2.5; if(r.boot&&r.tg){ r.tg.g1=g1; return; } r.tg={g0:r.g,g1:g1,p:0,rate:rate}; });
    const scr=crashSpot(MX.Course.wrap(C,(req.sector!=null?req.sector:0.5)*C.L));
    (req.crashes||[]).forEach(c=>{ const r=rs[c.s]; if(!r||r.gone) return; r.crashPlan={kind:c.kind,s:scr,lap:n,side:((c.s*31+n)%2)?1:-1}; });
    /* out of cards (not a crash): rides this lap out, then leaves the track */
    (req.dnf||[]).forEach(s2=>{ const r=rs[s2]; if(r&&!r.crashPlan&&!r.crash&&!r.gone) r.leave=n; });
    if(req.yellow&&req.yellow.sector!=null){ const sy=MX.Course.wrap(C,req.yellow.sector*C.L); yellow={s0:MX.Course.wrap(C,sy-16),len:46,lap:n,s:sy}; placeMarshalS(sy); }
    else if(yellow&&yellow.lap<n){ yellow=null; if(!rs.some(r=>r.crash)) marshal.grp.visible=false; }
    lapPlan={n:n,win:req.win,over:!!req.over,last:!!req.last,rank0:trackRank(req.win)};
    S.n=n; S.Tend=lapStartT(n+1); S.over=!!req.over;
    if(n>=2&&world.ctx.screen) world.ctx.screen(n,lenLaps,null);
    if(finished){ const S2=S; setTimeout(()=>{ ["holeshot","pass","crash","yellow","line"].forEach(k=>S2.fire(k)); S2.fire("done"); },0); }   /* the leader already finished: nothing left to wait for */
    if(motion()==="off"){ rs.forEach(r=>{ if(r.tg){ r.g=r.tg.g1; r.tg.p=1; } r.init=false; }); renderOnce(); }
    return S;
  };
  /* where a crash can happen on the ground: a sector that falls on a jump (its face, the air, the landing) or a rhythm lane moves to just
     past it (the whoops are a fine place to go down) */
  function crashSpot(s){
    for(let k=0;k<C.feats.length;k++){ const f=C.feats[k]; if(f.k!=="jump"&&f.k!=="rhythm"&&f.k!=="step") continue; if(MX.Course.wrap(C,s-f.from+2)<(f.to-f.from)+6) return MX.Course.wrap(C,f.to+5); }
    if(MX.Course.airAt(C,s)) return MX.Course.wrap(C,s+25);
    return s;
  }
  function makeShow(){ const S={fired:{},waits:{},ended:false}; S.at=n=>S.fired[n]?Promise.resolve():new Promise(r=>(S.waits[n]=S.waits[n]||[]).push(r)); S.fire=n=>{ if(S.fired[n]) return; S.fired[n]=true; (S.waits[n]||[]).splice(0).forEach(f=>{ try{ f(); }catch(e){} }); }; S.done=S.at("done"); return S; }
  function endShow(){ if(!show) return; show.ended=true; ["holeshot","pass","crash","yellow","line"].forEach(k=>show.fire(k)); show.fire("done"); }
  function trackRank(seat){ if(seat==null||seat<0||!rs[seat]) return -1; const D=rs[seat].D; let k=0; rs.forEach(r=>{ if(!r.gone&&r.D>D) k++; }); return k; }
  /* waiting on the cards (a person's flip, a war): the riders ride on; the director looks at the war's riders */
  V.hold=function(o){ holdInfo=o||null; };
  /* the standings without a result (a race restored mid-way): gaps set at once, the clock at the start of that lap */
  V.standings=function(order,cnt,n){
    if(!C) return;
    const alive=order.filter(s=>rs[s]&&!rs[s].gone), gg=MX.Course.gaps(alive,cnt,C.Tlap,{base:0.5,extra:1.4});
    rs.forEach((r,i)=>{ r.g=gg[i]!=null?gg[i]:r.g+3; r.tg=null; r.init=false; });
    lapNo=Math.max(1,n||1); T=lapStartT(lapNo)+0.05; mode="race"; finished=false; gate.set(1); gate.drop=1; gate.dropT=1;
    pickShot(true); renderOnce();
  };
  V.markOut=function(seat){ const r=rs[seat]; if(r) r.gone=true; };
  V.gate=function(){ mode="gate"; gate.set(0); gate.drop=0; gate.dropT=-1; T=0; lapNo=1; rs.forEach((r,k)=>{ r.lat=gate.slotLat(slotOf(k)); r.init=false; r.crash=null; r.crashPlan=null; r.g=0; r.tg=null; }); setShot({type:"gate",subj:-1,pri:0,min:1e9,max:1e9}); renderOnce(); };
  /* the gate drops: the pads fall, the clock starts (resolves once the riders are away) */
  V.drop=function(){
    return new Promise(res=>{
      if(!C){ res(); return; }
      mode="race"; lapNo=1; T=0; finished=false; gate.dropT=now();
      if(shot&&shot.type==="gate"){ shot.min=2.6; shot.max=3.4; shot.pri=1; shot.t=0; }
      if(motion()==="off"){ gate.set(1); renderOnce(); res(); return; }
      setTimeout(res,650);
    });
  };
  V.setFlag=function(k){ flag=k||null; if(flagger){ flagger.grp.visible=true; flagger.setTex(flagT(flag||"green")); } };
  V.setRed=function(seat){ if(seat===redSeat) return; redSeat=seat; list.forEach(r=>r.red=r.s===seat); if(R) atlasRed(R,list); };
  V.setSpeed=function(){ /* real time only (the CEO, 21:10): Game speed never changes the race */ };
  V.lapDone=function(){};
  V.skip=function(){ endShow(); rs.forEach(r=>{ r.crashPlan=null; }); finished=true; };

  /* ---------------- the loop ---------------- */
  function tick(t){
    raf=0; if(!running) return;
    if(document.hidden){ running=false; return; }
    const dt=(lastT?Math.min(0.1,(t-lastT)/1000):1/60)*(V.timeScale||1); lastT=t;   /* timeScale: tests only (never in the game: real time) */
    const c0=now();
    const off=motion()==="off";
    step(dt);
    if(!off||(stillT+=dt)>=2){ stillT=0; render(); }
    const ms=now()-c0; stats.ms=stats.ms*0.95+ms*0.05; stats.msMax=Math.max(stats.msMax*0.995,ms); stats.frames++;
    stats.ft.push(dt*1000); if(stats.ft.length>120) stats.ft.shift();
    if(!off) adapt(dt);
    raf=requestAnimationFrame(tick);
  }
  function start(){ if(running||V.lost) return; if(document.hidden) return; running=true; lastT=0; raf=requestAnimationFrame(tick); }
  V.stop=function(){ running=false; if(raf){ cancelAnimationFrame(raf); raf=0; } };
  V.show=function(on){ want=!!on; if(on) start(); else V.stop(); };
  document.addEventListener("visibilitychange",()=>{ if(document.hidden) V.stop(); else if(want) start(); });
  let slowT=0, fastT=0;
  function adapt(dt){
    if(V.prFixed) return;
    const ft=dt*1000;
    if(ft>34){ slowT+=dt; fastT=0; } else if(ft<18){ fastT+=dt; slowT=Math.max(0,slowT-dt*0.5); }
    if(slowT>1.5&&pr>prCap*0.5){ pr=Math.max(prCap*0.5,pr*0.85); renderer.setPixelRatio(pr); renderer.setSize(W,H,false); slowT=0; stats.prDrops++; }
    else if(fastT>5&&pr<prCap){ pr=Math.min(prCap,pr*1.1); renderer.setPixelRatio(pr); renderer.setSize(W,H,false); fastT=0; }
  }
  V.resize=function(){
    const w=Math.max(1,Math.round(host.clientWidth)), h=Math.max(1,Math.round(host.clientHeight));
    const dpr=GL.devicePixelRatio||1;
    if(!V.prFixed){ if(tv()) prCap=Math.min(dpr,(LO?960:1280)/w); else prCap=Math.min(dpr,LO?1.0:1.75); prCap=Math.max(0.5,prCap); if(w!==W||h!==H||!pr) pr=prCap; }
    W=w; H=h; renderer.setPixelRatio(pr); renderer.setSize(W,H,false); cv.style.width=W+"px"; cv.style.height=H+"px";
    cam.aspect=W/H; cam.updateProjectionMatrix(); camS.snap=true; renderOnce();
  };
  function renderOnce(){ if(!C||V.lost) return; step(0); render(); }
  function render(){
    renderer.render(scene,cam);
    const inf=renderer.info.render; stats.calls=inf.calls; stats.tris=inf.triangles;
    stats.fpsN++; const tn=now(); if(tn-stats.fpsT0>1000){ stats.fps=stats.fpsN*1000/(tn-stats.fpsT0); stats.fpsN=0; stats.fpsT0=tn; }
  }

  /* ---------------- one step of the world ---------------- */
  const BW=new THREE.Matrix4();
  function step(dt){
    if(!C||!R) return;
    const tw=now()/1000, racing=mode==="race";
    if(racing&&dt>0){
      T+=dt; updateGaps(dt);
      /* the leader starts a lap: the cards of that lap turn (the game); the end of the last lap is the checkered flag */
      while(!finished&&T>=lapStartT(lapNo+1)){
        if(show) show.fire("line");
        if(lapNo>=lenLaps||(lapPlan&&lapPlan.over&&lapPlan.n>=lapNo)){ finished=true; if(show) show.fire("done"); if(hooks.onFinish) setTimeout(()=>hooks.onFinish(),0); break; }
        if(show) show.fire("done");
        lapNo++;
        if(world.ctx.screen) world.ctx.screen(lapNo,lenLaps,null);
        const n=lapNo; if(hooks.onLap) setTimeout(()=>hooks.onLap(n),0);
      }
    }
    if(gate&&racing){ const a=gate.dropT>0?clamp((now()-gate.dropT)/260,0,1):1; if(a!==gate.drop){ gate.drop=a; gate.set(a*a); } }
    const atGate=mode==="gate";
    /* positions on the course from each rider's clock */
    for(let i=0;i<N;i++){
      const r=rs[i]; if(r.gone&&!r.crash) continue;
      if(r.crash&&r.crash.kind==="remount"&&T-r.crash.T>=r.crash.down){ r.g=T-r.crash.tau; r.crash=null; r.boot={t:0}; r.init=false; }
      if(r.crash&&r.crash.kind==="out"&&lapNo>r.crash.lap+1){ r.crash=null; r.gone=true; hideRider(R,i); continue; }   /* cleared after the yellow lap */
      if(r.leave&&lapNo>r.leave&&!r.crash){ r.gone=true; r.leave=0; hideRider(R,i); continue; }
      const tau=atGate?0:tauOf(i), d0=MX.Course.dOfT(C,Math.max(0,tau));
      const D=atGate?-0.95:d0-0.95*(1-sstep(0,18,d0));
      r.Dp=r.init?r.D:D; r.D=D;
      const loc=MX.Course.atD(C,Math.max(0,D),tmpO);
      const sPrev=r.s; r.onStart=loc.onStart; r.s=loc.onStart?0:loc.s; r.lapN=loc.lap;
      /* a crash happens where the engine said, on the lap it said */
      if(racing&&r.crashPlan&&!r.crash&&!r.onStart&&r.lapN>=r.crashPlan.lap&&dt>0){ const a=MX.Course.wrap(C,r.crashPlan.s-sPrev), b=MX.Course.wrap(C,r.crashPlan.s-r.s); if(a<C.L/2&&(b>C.L/2||b<0.05)) beginCrash(i); }
    }
    /* the frames, the racing lines and passing room (riders level side by side, the one behind moves over; nobody rides into a fallen rider) */
    const order=rs.filter(r=>!r.gone||r.crash).sort((a,b)=>b.D-a.D);
    for(let a=0;a<order.length;a++){
      const r=order[a];
      const fr=r.onStart?MX.Course.startFrame(C,Math.max(0,r.D),tmpO2):MX.Course.frame(C,r.s,tmpO2), hw=fr.hw;
      r.fr={x:fr.x,z:fr.z,th:fr.th,k:fr.k,hw:hw,y:fr.y||0,tag:fr.tag,sand:fr.sand||0};
      if(r.crash) continue;
      let target;
      if(r.onStart||atGate||(r.lapN===1&&r.D<C.hsD)){ const f=atGate?0:sstep(C.hsD*0.18,C.hsD*0.9,r.D); target=gate.slotLat(slotOf(r.k))*(1-f)+(r.bias*hw*0.4)*f; }
      else { const kk=MX.Course.frame(C,r.s+9,tmpO).k; target=Math.abs(kk)>1/30?-Math.sign(kk)*hw*0.36+r.bias*0.5:r.bias*hw*0.45; }
      for(let b=a-1;b>=0&&order[b].D-r.D<5.5;b--){ const o=order[b]; const ol=o.crash?o.crash.lat:o.lat; if(Math.abs(ol-target)<(o.crash?1.7:1.15)){ target=ol+(target>=ol?1.25:-1.25)*(o.crash?1.4:1); } }
      for(let b=a+1;b<order.length&&r.D-order[b].D<1.4;b++){ const o=order[b]; if(o.crash) continue; if(Math.abs(o.lat-target)<1.0){ target=o.lat+(target>=o.lat?1.1:-1.1); } }
      rs.forEach(o=>{ if(o.crash&&o!==r){ const dd=o.crash.D-r.D; if(dd>-3&&dd<16){ const ol=o.crash.lat; if(Math.abs(ol-target)<1.8) target=ol+(target>=ol?1.9:-1.9); } } });
      r.latT=clamp(target,-hw+0.55,hw-0.55);
      const maxV=r.init&&dt>0?2.4*dt:99; r.lat+=clamp(r.latT-r.lat,-maxV,maxV);
    }
    /* the flagger: the white flag as the leader comes to the line to start the last lap, the checkered flag as the winner arrives */
    if(racing&&!finished){ const L0=leaderIdx(); if(L0>=0&&!rs[L0].onStart){ const tl=(C.L-rs[L0].s)/Math.max(4,rs[L0].v||8);
      if(tl<2.6&&lapNo===lenLaps-1&&flag!=="white") V.setFlag("white");
      if(tl<2.2&&(lapNo>=lenLaps||(lapPlan&&lapPlan.over&&lapPlan.n>=lapNo))&&flag!=="checkered") V.setFlag("checkered"); } }
    /* show moments: the holeshot into turn 1, the lap winner's first pass */
    if(show&&!show.ended&&racing){
      const L=leaderIdx();
      if(lapNo===1&&L>=0&&rs[L].D>=C.hsD-6) show.fire("holeshot");
      if(lapPlan&&lapPlan.win!=null&&lapPlan.win>=0&&!show.fired.pass){ const rk=trackRank(lapPlan.win); if(lapPlan.rank0>=0&&rk<lapPlan.rank0) show.fire("pass"); }
    }
    for(let i=0;i<N;i++){ const r=rs[i]; if((r.gone&&!r.crash)||!r.fr){ hideRider(R,i); continue; } rider(i,r,dt,atGate,tw); }
    stepParticles(R,dt);
    commit(R);
    if(flagger&&flagger.grp.visible) flagger.wave(tw,flag?1:0.05);
    if(marshal&&marshal.grp.visible) marshal.wave(tw*1.2,1);
    director(dt);
    camera(dt);
    tags();
  }
  /* one rider: speed, the axles (sprung masses on the wheels), the stance, the bike and body matrices */
  function rider(i,r,dt,isGate,tw){
    const fr=r.fr, s=r.s, onStart=r.onStart;
    const th=fr.th, cth=Math.cos(th), sth=Math.sin(th), nx=-sth, nz=cth, lat=r.lat;
    const x=fr.x+nx*lat, z=fr.z+nz*lat;
    let v=r.init&&dt>0?(r.D-r.Dp)/dt:(isGate?0:MX.Course.vOfD(C,Math.max(0,r.D)));
    if(!isFinite(v)||v<0) v=0; r.vp=r.v; r.v=r.init?r.v+(v-r.v)*Math.min(1,dt*10):v;
    const acc=dt>0?(r.v-r.vp)/dt:0;
    const gF=ride(r,s,onStart,BIKE.WB/2), gR=ride(r,s,onStart,-BIKE.WB/2), tF=gnd(r,s,onStart,BIKE.WB/2), tR=gnd(r,s,onStart,-BIKE.WB/2);
    const aF=onStart?null:MX.Course.airAt(C,s+BIKE.WB/2), aR=onStart?null:MX.Course.airAt(C,s-BIKE.WB/2);
    if(r.crash){ crashPose(i,r,tw); return; }
    if(!r.init||dt<=0){
      initAxle(r.F,gF,aF,r.v); initAxle(r.Rr,gR,aR,r.v); r.init=true;
      r.stand=standTarget(r,aF||aR); r.lean=leanTarget(r); r.dab=0; r.gF=gF; r.gR=gR;
    } else {
      const sub=Math.max(1,Math.ceil(dt/(1/120))), h=dt/sub, vgF=(gF-r.gF)/dt, vgR=(gR-r.gR)/dt;
      for(let k=0;k<sub;k++){ axle(r.F,aF,gF,vgF,h,r.v); axle(r.Rr,aR,gR,vgR,h,r.v); }
      r.gF=gF; r.gR=gR;
      const inAir=!!(aF||aR);
      if(r.air&&!inAir&&!LO){ for(let k=0;k<6;k++) emit(R,x+(Math.random()-0.5)*1.2,gR+0.1,z+(Math.random()-0.5)*1.2,(Math.random()-0.5)*2,0.6+Math.random(),(Math.random()-0.5)*2,0.5+Math.random()*0.5,1.2,dustCol()); }
      r.air=inAir;
      r.stand+=clamp(standTarget(r,inAir)-r.stand,-dt*3.5,dt*3.5);
      r.lean+=clamp(leanTarget(r)-r.lean,-dt*1.6,dt*1.6);
      const dabT=(r.stand<0.3&&Math.abs(fr.k)>1/14&&r.v<11&&!inAir)?Math.sign(fr.k):0; r.dab+=clamp(dabT-r.dab,-dt*3,dt*3);
    }
    const yF=r.F.y, yR=r.Rr.y, LsEq=BIKE.TRAVEL-BIKE.SAG, oy=(yF+yR)/2-BIKE.WR-LsEq, pitch=Math.atan2(yF-yR,BIKE.WB);
    let roll=r.lean, yaw=-th, pz=pitch;
    if(isGate){ roll=0; pz+=Math.sin(tw*31+i)*0.004; }
    if(r.air&&aF&&aF.A&&aF.A.b-aF.A.a>14&&!LO){ const u=aF.u; const wsg=((i*13)%3)-1; roll+=wsg*0.55*Math.sin(PI*clamp(u*1.15,0,1)); yaw+=wsg*0.18*Math.sin(PI*u); }
    eul.set(roll,yaw,pz,"YZX"); q.setFromEuler(eul);
    BW.compose(v3.set(x,oy,z),q,sc1);
    const compF=clamp(LsEq-(yF-Math.max(tF+BIKE.WR,yF-BIKE.TRAVEL)),-0.12,BIKE.TRAVEL-0.02), compR=clamp(LsEq-(yR-Math.max(tR+BIKE.WR,yR-BIKE.TRAVEL)),-0.12,BIKE.TRAVEL-0.02);
    r.spinF+=r.v*dt/BIKE.WR; r.spinR+=r.v*dt/BIKE.WR;
    const crouch=clamp((compF+compR)*1.6,0,0.6)+(isGate?0.5:0);
    poseRider(R,i,BW,{stand:isGate?0:r.stand,dab:r.dab,lean:roll,crouch:crouch,spinF:r.spinF,spinR:r.spinR,compF:compF,compR:compR});
    const gy=Math.min(tF,tR), hAir=Math.max(0,oy-gy);
    shadowAt(R,i*2,x,gy,z,th,2.1,0.9,clamp(1-hAir/5,0.25,1));
    shadowAt(R,i*2+1,0,-999,0,0,0,0,0);
    r.pos=r.pos||new THREE.Vector3(); r.pos.set(x,oy+1.0,z); r.th=th; r.oy=oy; r.gy=gy;
    if(!LO&&!isGate&&!r.air&&dt>0){
      const want2=(acc>1.0?acc*0.9:0)+(fr.sand>0.3?r.v*0.25:0)+(r.D<14&&r.v>2?6:0);
      let nE=want2*dt*(R.part.n>300?5:2); while(nE>0){ if(Math.random()<nE){ const bx=x-cth*0.85, bz=z-sth*0.85, sp=2.5+r.v*0.35;
          emit(R,bx+(Math.random()-0.5)*0.3,gR+0.08,bz+(Math.random()-0.5)*0.3,-cth*sp+(Math.random()-0.5)*1.6,1.4+Math.random()*2.2,-sth*sp+(Math.random()-0.5)*1.6,0.05+Math.random()*0.07,0.55+Math.random()*0.4,fr.sand>0.3?[0.62,0.52,0.36]:dirtCol());
          if(Math.random()<0.18) emit(R,bx,gR+0.3,bz,-cth*sp*0.3,0.5,-sth*sp*0.3,0.5+Math.random()*0.6,1.4,dustCol()); }
        nE-=1; }
    }
  }
  function dirtCol(){ const s=look&&look.soil; return s==="sand"?[0.6,0.5,0.33]:s==="hardpack"?[0.42,0.32,0.22]:[0.27,0.19,0.12]; }
  function dustCol(){ const s=look&&look.soil; return s==="sand"?[0.72,0.64,0.5]:C.kind==="stadium"?[0.42,0.35,0.28]:[0.6,0.52,0.42]; }
  function gnd(r,s,onStart,off){ if(onStart) return (r.fr.y||0)+0.02; return MX.Course.ground(C,s+off,r.lat); }
  function ride(r,s,onStart,off){
    if(onStart) return (r.fr.y||0)+0.02;
    const g=MX.Course.ground(C,s+off,r.lat), sk=skim(s+off);
    return sk>0?Math.max(g,sk+MX.Course.frame(C,s+off,tmpO).y):g;
  }
  /* the skim line through the whoops / rollers: the tops' height, ramped in over the first whoop and a half and out over the last */
  function skim(s){
    s=MX.Course.wrap(C,s);
    for(let k=0;k<C.feats.length;k++){ const f=C.feats[k]; if(f.k!=="whoops"&&f.k!=="rollers") continue; if(s<f.from-1||s>f.to+1) continue;
      const sp=f.sp||((f.to-f.from)/(f.n||5)), h=(f.h||0.8)*0.9; return h*sstep(f.from+sp*0.25,f.from+sp*1.6,s)*(1-sstep(f.to-sp*1.6,f.to-sp*0.25,s)); }
    return 0;
  }
  function initAxle(A,g,air,v){ const LsEq=BIKE.TRAVEL-BIKE.SAG; if(air){ A.y=air.y+BIKE.WR+BIKE.TRAVEL*0.85; A.v=air.dy*v; } else { A.y=g+BIKE.WR+LsEq; A.v=0; } }
  /* one axle: the chassis point above a wheel. On the ground a spring (about 1.6 Hz, sag 10 cm, 30 cm travel) and a damper; off the ground
     it falls (g); in a jump's arc it rides the arc (the wheels follow the flight path, the suspension hangs out); bottoming never launches */
  const K=100, Z=0.45, LREST=BIKE.TRAVEL-BIKE.SAG+G/K;
  function axle(A,air,g,vg,h,v){
    if(air){ const ty=air.y+BIKE.WR+BIKE.TRAVEL*0.88; A.v=air.dy*v; A.y+=(ty-A.y)*Math.min(1,h*30); return; }
    const gw=g+BIKE.WR, Ls=A.y-gw;
    let a=-G;
    if(Ls<BIKE.TRAVEL) a+=K*(LREST-Ls)-2*Z*Math.sqrt(K)*(A.v-vg);
    A.v+=a*h; A.y+=A.v*h;
    if(A.y-gw<0.03){ A.y=gw+0.03; if(A.v<vg) A.v=Math.min(vg,3.2); }
  }
  function standTarget(r,air){
    if(air) return 1; const t=r.fr.tag;
    if(t==="whoops"||t==="rhythm"||t==="jump"||t==="bigjump"||t==="rollers") return 1;
    if(!r.onStart){ for(let d=4;d<=16;d+=4){ const tt=MX.Course.frame(C,r.s+d,tmpO).tag; if(tt==="jump"||tt==="bigjump"||tt==="whoops"||tt==="rhythm") return 1; } }
    if(Math.abs(r.fr.k)>1/22) return 0;
    if(r.onStart) return r.D>10?0.75:0.1;
    return r.v>12?0.75:0.35;
  }
  function leanTarget(r){ const k=r.fr.k; return clamp(Math.atan(r.v*r.v*k/G)*0.95,-0.85,0.85); }

  /* ---------------- crashes ---------------- */
  function beginCrash(i){
    const r=rs[i], c=r.crashPlan; r.crashPlan=null;
    r.crash={T:T,lap:lapNo,kind:c.kind,tau:T-r.g,D:Math.max(0,r.D),side:c.side,v0:Math.max(6,r.v||MX.Course.vOfD(C,r.D)),lat:r.lat,down:c.kind==="out"?1e9:4.6,th:r.fr?r.fr.th:0};
    r.tg=null;
    const f=r.fr||{x:0,z:0,th:0};
    if(!LO) for(let k=0;k<26;k++) emit(R,f.x+(Math.random()-0.5)*1.2,(r.gy||0)+0.3,f.z+(Math.random()-0.5)*1.2,(Math.random()-0.5)*5,1+Math.random()*3,(Math.random()-0.5)*5,k<18?0.06+Math.random()*0.08:0.8+Math.random()*0.7,k<18?0.8:1.8,k<18?dirtCol():dustCol());
    placeMarshalS(r.s,r.crash.side,shot&&shot.type==="crash"?shot.cam:null);
    if(show){ show.fire("crash"); const S=show; setTimeout(()=>S.fire("yellow"),2400); }
    if(shot&&shot.type!=="crash") pickShot(true);
  }
  /* the marshal: beside the track a little past the crash, on the far side from the camera that shows it (never in front of the lens) */
  function placeMarshalS(s,side,camP){
    if(!marshal) return;
    const f=MX.Course.frame(C,s+11,tmpO2);
    let sd=-(side||1);
    if(camP){ const cs=(camP.x-f.x)*(-Math.sin(f.th))+(camP.z-f.z)*Math.cos(f.th); sd=cs>0?-1:1; }
    let lat=sd*(f.hw+2.2), x=f.x-Math.sin(f.th)*lat, z=f.z+Math.cos(f.th)*lat;
    if(!clear(C,x,z,0.6)){ lat=-lat; x=f.x-Math.sin(f.th)*lat; z=f.z+Math.cos(f.th)*lat; }
    const y=MX.Course.ground(C,s+11,Math.sign(lat)*f.hw);
    marshal.grp.position.set(x,y-0.05,z); marshal.grp.rotation.y=-f.th+(lat>0?PI/2:-PI/2); marshal.grp.visible=true; marshal.s=s;
  }
  V.yellowAt=function(sector){ if(!C) return; placeMarshalS(MX.Course.wrap(C,sector*C.L)); };
  V.yellowOff=function(){ if(marshal&&!rs.some(r=>r.crash)) marshal.grp.visible=false; };
  const CM=new THREE.Matrix4(), BM=new THREE.Matrix4(), cq=new THREE.Quaternion(), ce=new THREE.Euler(0,0,0,"YZX"), cv3=new THREE.Vector3(), cv4=new THREE.Vector3();
  function crashPose(i,r,tw){
    const c=r.crash, t=T-c.T, f=r.fr, th=c.th, cth=Math.cos(th), sth=Math.sin(th), nx=-sth, nz=cth;
    /* the bike: tips over toward the side, slides to a stop, spins a little; lifted again for a remount */
    const ts=c.v0/7.5, tt=Math.min(t,ts), slide=c.v0*tt-3.75*tt*tt;
    const lift=c.kind==="remount"?sstep(3.2,3.9,t):0, rollB=c.side*(1.25*sstep(0,0.38,t))*(1-lift);
    const yawB=c.side*0.9*(1-Math.exp(-t*2.2))*(1-lift*0.8);
    const latB=clamp(c.lat+c.side*Math.min(2.2,0.9*tt),-f.hw-1.5,f.hw+1.5);
    const bx=f.x+cth*slide+nx*latB, bz=f.z+sth*slide+nz*latB;
    const loc=MX.Course.atD(C,c.D+slide,tmpO), gy=loc.onStart?(f.y||0):MX.Course.ground(C,loc.s,latB);
    ce.set(rollB,-th+yawB,0.05*Math.sin(t*6)*(t<ts?1:0),"YZX"); cq.setFromEuler(ce);
    BM.compose(cv3.set(bx,gy+0.32*Math.abs(Math.sin(rollB)),bz),cq,sc1);
    /* the rider: thrown forward, tumbling and bouncing, lying, getting up; then to the bike (remount) or off the track (out) */
    const tr=Math.min(t,1.4), thrown=c.v0*0.85*tr-3.1*tr*tr, side=c.side;
    let hx=f.x+cth*(thrown+0.6)+nx*(c.lat+side*Math.min(3,1.6*tr)), hz=f.z+sth*(thrown+0.6)+nz*(c.lat+side*Math.min(3,1.6*tr));
    let hy, bodyPitch=0, bodyRoll=0, spread=0, walk=0, stand=0, reach=0, phase=0, bodyYaw=-th;
    if(t<1.4){ const b=Math.abs(Math.sin(t*6.5))*0.55*Math.exp(-t*2.0); hy=0.28+b; bodyRoll=side*4*PI*(1-Math.exp(-t*1.9)); bodyPitch=-0.9*Math.sin(t*3); spread=1; }
    else if(t<1.9){ hy=0.16; bodyRoll=0; bodyPitch=-PI/2; spread=0.7; }
    else if(t<2.7){ const u=sstep(1.9,2.7,t); hy=0.16+u*0.8; bodyPitch=-PI/2*(1-u); spread=0.7*(1-u); stand=u; }
    else { hy=0.96; stand=1;
      const endX=f.x+cth*(thrown+0.6)+nx*(c.lat+side*3), endZ=f.z+sth*(thrown+0.6)+nz*(c.lat+side*3);
      if(c.kind==="remount"){ const u=sstep(2.7,3.3,t); const tx=bx+nx*(-side*0.7), tz=bz+nz*(-side*0.7); hx=endX+(tx-endX)*u; hz=endZ+(tz-endZ)*u; walk=t<3.3?1:0; phase=t*9; reach=sstep(3.1,3.5,t); bodyYaw=-th+side*0.6*(1-sstep(3.3,3.9,t)); }
      else { const u=sstep(2.7,4.7,t); const off=side*(f.hw+4.5); const tx=f.x+cth*(thrown+1.5)+nx*off, tz=f.z+sth*(thrown+1.5)+nz*off; hx=endX+(tx-endX)*u; hz=endZ+(tz-endZ)*u; walk=t<4.7?1:0; phase=t*8; bodyYaw=-th+side*PI/2; }
      if(c.kind==="remount"&&t>=3.9){ poseRider(R,i,BM,{stand:0.3,dab:0,lean:rollB,crouch:0.2,spinF:r.spinF,spinR:r.spinR}); shadowAt(R,i*2,bx,gy,bz,th,2.1,0.9,1); shadowAt(R,i*2+1,0,-999,0,0,0,0,0); r.pos=r.pos||new THREE.Vector3(); r.pos.set(bx,gy+1,bz); r.th=th; r.gy=gy; return; }
    }
    const l2=MX.Course.atD(C,c.D+thrown,tmpO2), hgy=l2.onStart?(f.y||0):MX.Course.ground(C,l2.s,c.lat);
    ce.set(bodyRoll,bodyYaw,bodyPitch,"YZX"); cq.setFromEuler(ce); CM.compose(cv4.set(hx,hgy+hy,hz),cq,sc1);
    poseRider(R,i,BM,{body:CM,limbs:{spread:spread,walk:walk,phase:phase,stand:stand,reach:reach},spinF:r.spinF,spinR:r.spinR});
    shadowAt(R,i*2,bx,gy,bz,th+yawB,2.0,1.0,1); shadowAt(R,i*2+1,hx,hgy,hz,th,1.0,0.8,clamp(1-hy/2,0.3,1));
    r.pos=r.pos||new THREE.Vector3(); r.pos.set(hx,hgy+hy+0.4,hz); r.th=th; r.gy=gy;
  }

  /* ---------------- the camera director: the whole lap at real speed, cut between sections as the leader rides them ---------------- */
  function leaderIdx(){ let b=-1, bd=-1e9; rs.forEach((r,i)=>{ if(!r.gone&&!r.crash&&r.D>bd){ bd=r.D; b=i; } }); return b; }
  function setShot(s){ shot=s; shot.t=0; camS.snap=true; shot.cam=typeof s.cam==="function"?s.cam():(s.cam||null); shotLog.push(s.type+(s.why?":"+s.why:"")); if(shotLog.length>12) shotLog.shift(); }
  function nextFeat(s){
    let best=null, bd=1e9; C.feats.forEach(f=>{ if(f.k!=="whoops"&&f.k!=="jump"&&f.k!=="rhythm"&&f.k!=="sand"&&f.k!=="step") return; const d=MX.Course.wrap(C,f.from-s); if(d<bd){ bd=d; best=f; } }); return best?{f:best,d:bd}:null;
  }
  function inFloor(p){ if(C.kind!=="stadium"||!C.layout.floor) return p; const F=C.layout.floor; p.x=clamp(p.x,F[0]+2.2,F[1]-2.2); p.z=clamp(p.z,F[2]+2.2,F[3]-2.2); return p; }
  function terrainAt(x,z,y){ if(world.ctx.hf) return world.ctx.hf(x,z); return y||0; }
  /* a trackside camera beside loop distance s: the side with room, off the track (inside the wall in a stadium) */
  function trackCam(s,h,distA){
    const f=MX.Course.frame(C,s,tmpO);
    for(const side of [1,-1]) for(const dist of (distA||[11,15,19,24])){ const lat=side*(f.hw+dist), x=f.x-Math.sin(f.th)*lat, z=f.z+Math.cos(f.th)*lat; if(clear(C,x,z,1.6)){ const p=inFloor({x:x,z:z}); return new THREE.Vector3(p.x,terrainAt(p.x,p.z,f.y)+h,p.z); } }
    const p=inFloor({x:f.x+14,z:f.z+14}); return new THREE.Vector3(p.x,terrainAt(p.x,p.z,f.y)+h,p.z);
  }
  function featCam(f){
    const sp=(C.spots||[]).find(x=>Math.abs(x.mid-(f.from+f.to)/2)<3);
    if(f.k==="jump"){ const at=f.lip!=null?f.lip+(f.to-f.lip)*0.55:(f.from+f.to)/2; return trackCam(at,1.5,[9,12,15,19]); }
    if(f.k==="whoops"&&sp){ const p=inFloor({x:sp.x,z:sp.z}); return new THREE.Vector3(p.x,terrainAt(p.x,p.z,sp.y)+5.5,p.z); }
    if(f.k==="whoops") return trackCam((f.from+f.to)/2,5.5);
    return trackCam((f.from+f.to)/2,3.2);
  }
  function turn1Cam(){
    let f; if(C.S.n){ f=MX.Course.startFrame(C,Math.max(0,C.Ls-16),tmpO); } else f=MX.Course.frame(C,C.join+Math.max(10,C.hsD-16),tmpO);
    const side=-Math.sign(f.k||1)||1;
    for(const dist of [14,20,26]){ const lat=side*(f.hw+dist), x=f.x-Math.sin(f.th)*lat, z=f.z+Math.cos(f.th)*lat; if(clear(C,x,z,2)){ const p=inFloor({x:x,z:z}); return new THREE.Vector3(p.x,terrainAt(p.x,p.z,f.y)+10,p.z); } }
    const p=inFloor({x:f.x+20,z:f.z+20}); return new THREE.Vector3(p.x,terrainAt(p.x,p.z,0)+10,p.z);
  }
  function lineCam(){ const fa=world.fin.flagAt, th=world.fin.th, sd=world.fin.side; const p=inFloor({x:fa.x+Math.cos(th)*5.5-Math.sin(th)*sd*1.5,z:fa.z+Math.sin(th)*5.5+Math.cos(th)*sd*1.5}); return new THREE.Vector3(p.x,fa.y+0.6,p.z); }
  function candidates(urgent){
    const L=[], lead=leaderIdx(); if(lead<0) return L;
    const r=rs[lead], me=meSeats.filter(s=>rs[s]&&!rs[s].gone&&!rs[s].crash);
    if(!urgent&&lapNo===1&&r.D<C.hsD&&C.hsD-r.D<75) L.push({type:"turn1",subj:lead,pri:8,min:4,max:7.5,cam:turn1Cam});
    rs.forEach((k,i)=>{ if(k.crashPlan&&!k.crash&&!k.gone&&!k.onStart&&k.lapN>=k.crashPlan.lap){ const d=MX.Course.wrap(C,k.crashPlan.s-k.s); if(d>0&&d<Math.max(10,k.v*2.6)){ const out=k.crashPlan.kind==="out"; const cs=k.crashPlan.s; L.push({type:"crash",subj:i,pri:10,min:out?7:8.2,max:out?9:10.5,cam:()=>trackCam(cs-4,6.0,[6,9,12,16])}); } } });
    if(!r.onStart){ const toLine=C.L-r.s, tl=toLine/Math.max(4,r.v), over=lapPlan&&lapPlan.over&&lapPlan.n>=lapNo;
      if(tl<3.4&&(over||lapNo===lenLaps-1||lapNo%3===0)) L.push({type:"line",subj:lead,pri:over?9:lapNo===lenLaps-1?7:4,min:3.2,max:over?7:5,cam:lineCam}); }
    if(urgent) return L;
    if(yellow&&yellow.lap===lapNo&&!r.onStart){ const d=MX.Course.wrap(C,yellow.s0-r.s); if(d>0&&d<r.v*3){ const ys=yellow.s; L.push({type:"track",subj:lead,pri:6,min:4,max:6.5,cam:()=>trackCam(ys-6,4.2,[9,12,15,19]),why:"yellow"}); } }
    [lead].concat(me).forEach((j,ix)=>{ const qq=rs[j]; if(!qq||qq.onStart) return; const nf=nextFeat(qq.s); if(!nf) return; const tt=nf.d/Math.max(4,qq.v);
      if(tt<3.0&&tt>0.2){ const f=nf.f, seen=featLog.slice(-2).indexOf(f.from)>=0; L.push({type:f.k==="whoops"?"whoops":f.k==="jump"?"jump":"track",subj:j,pri:(ix?4.6:5)-(seen?1.6:0)+(f.big?0.4:0),min:3.2,max:6.5,cam:()=>featCam(f),feat:f,why:f.k}); } });
    const ord=rs.filter(x=>!x.gone&&!x.crash&&!x.onStart).sort((a,b)=>b.D-a.D);
    for(let k=1;k<Math.min(ord.length,14);k++){ const a=ord[k-1], b=ord[k], gap=a.D-b.D, closing=b.v-a.v;
      if(gap<8&&gap>0.5&&closing>0.25){ const imp=(k<=4?2:0)+(meSeats.indexOf(a.seat)>=0||meSeats.indexOf(b.seat)>=0?2:0)+(lapPlan&&(lapPlan.win===a.seat||lapPlan.win===b.seat)?2:0);
        if(imp>=2){ const bs=b.s+b.v*2.2; L.push({type:"track",subj:b.k,victim:a.k,pri:4.2+imp*0.3,min:3.5,max:6.5,cam:()=>trackCam(bs,2.6),why:"battle"}); break; } } }
    if(holdInfo&&holdInfo.war) holdInfo.war.forEach((j,ix)=>{ if(rs[j]&&!rs[j].gone&&!rs[j].onStart) L.push({type:"chase",subj:j,pri:3.6-ix*0.1,min:3,max:4.5,why:"war"}); });
    L.push({type:"chase",subj:lead,pri:2,min:4,max:7});
    if(me.length) L.push({type:"chase",subj:me[0],pri:2.3,min:4,max:7,why:"you"});
    L.push({type:"heli",subj:lead,pri:1.8,min:4,max:6.5});
    if(!r.onStart){ const rsd=r.s+Math.max(8,r.v*2.2); L.push({type:"track",subj:lead,pri:2.1,min:3.5,max:6,cam:()=>trackCam(rsd,2.4),why:"roving"}); }
    return L;
  }
  function pickShot(force){
    const L=candidates(); if(!L.length) return;
    const last=shotLog.slice(-2);
    L.forEach(c=>{ const k=c.type+(c.why?":"+c.why:""); if(last.indexOf(k)>=0&&c.pri<6) c.pri-=1.2; c.pri+=Math.random()*0.15; });
    L.sort((a,b)=>b.pri-a.pri);
    const c=L[0];
    if(!force&&shot&&c.type===shot.type&&c.subj===shot.subj&&c.why===shot.why&&!c.cam){ shot.t=0; return; }   /* the same moving camera: just keep it */
    if(c.feat){ featLog.push(c.feat.from); if(featLog.length>6) featLog.shift(); }
    setShot(c);
  }
  const dirA=new THREE.Vector3(), fwA=new THREE.Vector3();
  function director(dt){
    if(!shot) return;
    shot.t+=dt;
    if(mode!=="race") return;
    if(shot.type==="gate"&&shot.t<shot.min) return;
    if(shot.pri<9&&shot.t>0.6){ const L=candidates(true).filter(c=>c.pri>=9&&c.pri>shot.pri); if(L.length){ setShot(L[0]); return; } }
    if(shot.t>=shot.max){ pickShot(); return; }
    if(shot.t>=shot.min){
      const r=rs[shot.subj];
      if(shot.feat&&r&&!r.onStart){ const d=MX.Course.wrap(C,r.s-shot.feat.to); if(d<C.L/2&&d>3){ pickShot(); return; } }
      if(shot.cam&&r&&r.pos&&shot.type!=="crash"&&shot.type!=="line"){ dirA.subVectors(shot.cam,r.pos); fwA.set(Math.cos(r.th||0),0,Math.sin(r.th||0)); if(dirA.dot(fwA)<-6){ pickShot(); return; } }
      if(!shot.cam&&shot.t>=shot.min+1.5) pickShot();
    }
  }
  const cTarget=new THREE.Vector3(), cPos=new THREE.Vector3(), tv3=new THREE.Vector3(), tv4=new THREE.Vector3();
  function camera(dt){
    if(!shot) return;
    const sh=shot.type, snap=camS.snap||dt<=0; let fov=50;
    const off=motion()==="off";
    const j=shot.subj>=0?shot.subj:leaderIdx();
    const have=j>=0&&rs[j]&&rs[j].pos; if(have) tv3.copy(rs[j].pos);
    if(off&&mode==="race"){
      if(have&&(snap||!camS.offT||now()-camS.offT>6000)){ camS.offT=now(); cTarget.copy(tv3); cPos.set(tv3.x+34,tv3.y+30,tv3.z+30); }
      fov=50;
    } else if(sh==="gate"&&gate){
      const g=gate, fx=Math.cos(g.th), fz=Math.sin(g.th), rx=-fz, rz=fx;
      cPos.set(g.x+fx*11+rx*g.gw*0.36,g.y+1.5,g.z+fz*11+rz*g.gw*0.36);
      if(mode==="race"&&have){ tv4.set(g.x-fx*0.6+rx*g.gw*0.08,g.y+0.85,g.z-fz*0.6+rz*g.gw*0.08); cTarget.lerpVectors(tv4,tv3,sstep(0.25,2.0,shot.t)); }
      else cTarget.set(g.x-fx*0.6+rx*g.gw*0.08,g.y+0.85,g.z-fz*0.6+rz*g.gw*0.08);
      fov=Math.min(66,2*Math.atan((g.gw*0.6)/12)*180/PI);
    } else if(!have){ /* nothing to follow */ }
    else if(sh==="chase"||sh==="heli"){
      const r=rs[j], th=r.th||0, back=sh==="heli"?20:8.5, up=sh==="heli"?13:3.4;
      tv4.set(tv3.x-Math.cos(th)*back,Math.max(tv3.y+up,(r.gy||0)+2.0),tv3.z-Math.sin(th)*back);
      if(C.kind==="stadium"&&C.layout.floor&&sh==="chase"){ const p=inFloor({x:tv4.x,z:tv4.z}); tv4.x=p.x; tv4.z=p.z; }
      if(snap) cPos.copy(tv4); else cPos.lerp(tv4,1-Math.exp(-dt/0.32));
      tv4.set(tv3.x+Math.cos(th)*5,tv3.y-0.2,tv3.z+Math.sin(th)*5);
      if(snap) cTarget.copy(tv4); else cTarget.lerp(tv4,1-Math.exp(-dt/0.12));
      fov=sh==="heli"?46:58;
    } else {
      if(!shot.cam) shot.cam=trackCam(rs[j].s||0,3);
      cPos.copy(shot.cam);
      tv4.copy(tv3); let spread=0;
      if(shot.victim!=null&&rs[shot.victim]&&rs[shot.victim].pos){ tv4.lerp(rs[shot.victim].pos,0.45); spread=Math.min(14,rs[shot.victim].pos.distanceTo(tv3)); }
      else if((shot.why==="yellow"||sh==="crash")&&marshal&&marshal.grp.visible){ /* the marshal waving the yellow flag in the frame too */
        const mp=marshal.grp.position, dm=Math.hypot(mp.x-tv3.x,mp.z-tv3.z); if(dm<40){ tv4.set(tv4.x+(mp.x-tv4.x)*0.35,tv4.y+(mp.y+1.4-tv4.y)*0.35,tv4.z+(mp.z-tv4.z)*0.35); spread=Math.min(16,dm*0.9); } }
      tv4.y-=0.3;
      if(snap) cTarget.copy(tv4); else cTarget.lerp(tv4,1-Math.exp(-dt/0.1));
      const dist=cPos.distanceTo(cTarget), wantW=2.6+spread*0.8+(sh==="whoops"?6:sh==="jump"?6.5:sh==="turn1"?10:sh==="line"?3.2:sh==="crash"?3.2:2.4);
      fov=clamp(2*Math.atan(wantW/(2*dist))*180/PI*1.6,12,64);
      if(sh==="turn1") fov=clamp(fov,26,64);
    }
    /* a portrait screen: a little wider vertically, the sides cropped (the riders stay big) */
    const asp=W/Math.max(1,H); if(asp<1) fov=clamp(2*Math.atan(Math.tan(fov*PI/360)/Math.max(0.78,Math.pow(asp,0.55)))*180/PI,10,80);
    if(snap){ camS.fov=fov; camS.snap=false; } else camS.fov+=(fov-camS.fov)*Math.min(1,dt*4);
    cam.position.copy(cPos); cam.lookAt(cTarget); if(Math.abs(cam.fov-camS.fov)>0.01){ cam.fov=camS.fov; cam.updateProjectionMatrix(); }
    if(world.ctx.skyMesh) world.ctx.skyMesh.position.copy(cam.position);
  }
  /* number tags over riders that are small on screen (always the person's and the red plate), at most 7, a constant size on screen */
  const tagV=new THREE.Vector3();
  function tags(){
    if(!R) return;
    const show2=[], camP=cam.position, th=Math.tan(cam.fov*PI/360)*2, px=tv()?30:24;
    rs.forEach((r,i)=>{ if((r.gone&&!r.crash)||!r.pos){ tagAt(R,i,null,0); return; } show2.push([camP.distanceTo(r.pos),i]); });
    show2.sort((a,b)=>a[0]-b[0]);
    const max=LO?5:7, mine=new Set(meSeats.concat(redSeat>=0?[redSeat]:[]));
    let k=0;
    show2.forEach(([d,i])=>{
      const r=rs[i], view=d*th, riderPx=2.0/view*H, small=riderPx<95;
      const vis=(k<max||mine.has(i))&&small&&d>6&&!(mode==="gate"&&!mine.has(i));
      if(vis){ const size=view*(px*(mine.has(i)?1.12:1))/H; tagV.copy(r.pos); tagV.y+=0.9+size*0.55; tagAt(R,i,tagV,size*1.6); k++; } else tagAt(R,i,null,0);
    });
    R.M.tag.instanceMatrix.needsUpdate=true;
  }

  /* ---------------- tests and tools ---------------- */
  V.state=function(){ return {mode:mode,lap:lapNo,len:lenLaps,T:+T.toFixed(2),lapT:C?+(T-lapStartT(lapNo)).toFixed(1):0,finished:finished,shot:shot?{type:shot.type,t:+shot.t.toFixed(2),subj:shot.subj,why:shot.why||""}:null,shots:shotLog.slice(),
    yellow:yellow?{lap:yellow.lap,s:+yellow.s.toFixed(0)}:null,riders:rs.map(r=>({s:r.seat,D:+r.D.toFixed(1),g:+r.g.toFixed(2),v:+(r.v||0).toFixed(1),lat:+r.lat.toFixed(2),air:!!r.air,stand:+r.stand.toFixed(2),crash:r.crash?r.crash.kind:null,plan:r.crashPlan?r.crashPlan.kind:null,gone:r.gone})),
    course:V.courseInfo,running:running,flag:flag,lo:LO}; };
  V.order=function(){ return rs.filter(r=>!r.gone).slice().sort((a,b)=>b.D-a.D).map(r=>r.seat); };
  V.stats=function(){ const ft=stats.ft.slice().sort((a,b)=>a-b); return {calls:stats.calls,tris:stats.tris,jsMs:+stats.ms.toFixed(2),jsMsMax:+stats.msMax.toFixed(2),fps:+stats.fps.toFixed(1),frameMs50:ft.length?+ft[Math.floor(ft.length/2)].toFixed(1):0,frameMs90:ft.length?+ft[Math.floor(ft.length*0.9)].toFixed(1):0,pr:+pr.toFixed(2),prCap:+prCap.toFixed(2),prDrops:stats.prDrops,W:W,H:H,geometries:renderer.info.memory.geometries,textures:renderer.info.memory.textures,frames:stats.frames}; };
  V.lapTime=function(){ return C?C.Tlap:0; };
  /* tests: move the clock (T) to where the subject meets a section, and hold a named shot there */
  V.shot=function(name,o){
    o=o||{}; if(!C) return null;
    const j=o.subj!=null?o.subj:leaderIdx(); if(j<0) return null;
    const n=Math.max(2,o.lap||lapNo); mode="race";
    const r=rs[j];
    let s, type=name, cam=null;
    if(name==="whoops"||name==="jump"||name==="rhythm"||name==="sand"){ const feat=C.feats.filter(f=>f.k===(name==="jump"?"jump":name)).sort((a,b)=>(b.big?1:0)-(a.big?1:0))[0]; if(!feat) return null; s=(feat.lip!=null?feat.lip:feat.from)-(o.ahead!=null?o.ahead:8); cam=featCam(feat); if(name!=="whoops"&&name!=="jump") type="track"; }
    else if(name==="line"){ s=C.L-(o.ahead!=null?o.ahead:14); cam=lineCam(); }
    else { s=o.s!=null?o.s:C.L*0.3; if(name==="track") cam=trackCam(s+12,2.6); }
    const D=MX.Course.lapStartD(C,n)+s; T=MX.Course.tOfD(C,D)+r.g; lapNo=n; rs.forEach(x=>x.init=false);
    setShot({type:type,subj:j,pri:99,min:1e9,max:1e9,cam:cam,why:"test"});
    renderOnce(); return {type:type,T:+T.toFixed(1),subj:j};
  };
  V.release=function(){ if(shot){ shot.pri=1; shot.min=0.5; shot.max=1; } };
  V.renderNow=renderOnce;
  V.fixPR=function(p){ prCap=p; pr=p; renderer.setPixelRatio(p); renderer.setSize(W,H,false); V.prFixed=true; };
  V.dispose=function(){ V.stop(); if(world) disposeTree(world.root); if(R) disposeTree(R.grp); renderer.dispose(); cv.remove(); };
  V.renderer=renderer; V.scene=scene; V.camera=cam;
  return V;
}
