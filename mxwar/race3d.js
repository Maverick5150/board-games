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
import {buildWorld,gateBuild,flaggerBuild,flagTex,clear,clearDist,setAniso} from "./r3d-world.js";
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
  const renderer=new THREE.WebGLRenderer({antialias:!LO,powerPreference:"high-performance",alpha:false,stencil:false,preserveDrawingBuffer:false});
  setAniso(LO?2:Math.min(8,renderer.capabilities.getMaxAnisotropy()||1));
  renderer.outputColorSpace=THREE.SRGBColorSpace; renderer.toneMapping=THREE.ACESFilmicToneMapping; renderer.toneMappingExposure=1.08;
  /* real shadows (polish): the riders cast them on the dirt from the main light (a 1024 map over a box round what the camera looks at:
     sharp where it matters); off with Reduce effects, on a GPU known to be slow, and dropped by itself when frames run long (adapt) */
  const weakGPU=(()=>{ try{ const gl=renderer.getContext(), d=gl.getExtension("WEBGL_debug_renderer_info"), s=String(d?gl.getParameter(d.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER)); return /GE8|GX6|SGX|Mali-(4|T[67]|G31|G51)|Adreno \(TM\) [345]\d\d\b|VideoCore|PowerVR Rogue G/i.test(s); }catch(e){ return false; } })();
  let SHADOWS=!LO&&!weakGPU;
  renderer.shadowMap.enabled=SHADOWS; renderer.shadowMap.type=THREE.PCFShadowMap;
  renderer.setClearColor(0x05060a,1);
  const cv=renderer.domElement; cv.className="mx-v3__cv"; cv.setAttribute("aria-hidden","true"); host.appendChild(cv);
  const V={lost:false};
  cv.addEventListener("webglcontextlost",e=>{ e.preventDefault(); V.lost=true; V.stop(); if(hooks.lost) hooks.lost(); },false);
  const scene=new THREE.Scene();
  const cam=new THREE.PerspectiveCamera(50,1,0.5,4200);
  const hemi=new THREE.HemisphereLight(0xb8c4e0,0x3a2a1c,1.0); scene.add(hemi);
  const sun=new THREE.DirectionalLight(0xfff2dc,2.2); sun.position.set(-60,120,40); scene.add(sun); scene.add(sun.target);
  sun.castShadow=SHADOWS; sun.shadow.mapSize.set(1024,1024); sun.shadow.bias=-0.0008; sun.shadow.normalBias=0.03;
  sun.shadow.camera.near=1; sun.shadow.camera.far=320; let shHalf=0;
  const fill=new THREE.DirectionalLight(0x9fb4ff,0.45); fill.position.set(80,40,-60); scene.add(fill);
  const amb=new THREE.AmbientLight(0xffffff,0.0); scene.add(amb);
  const SUN=new THREE.Vector3(0.5,0.8,0.3);
  let W=0,H=0,pr=1,prCap=1;
  /* ---------------- state ---------------- */
  let C=null, look=null, world=null, worldKey="", R=null, rs=[], N=0, list=[], gate=null, flagger=null, marshal=null, HG=null;
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
    const key=pick.layout.id+"|"+(pick.look.around)+"|"+(LO?"lo":"hi")+"|"+(o.lapT>0?Math.round(o.lapT):"");
    if(key!==worldKey){
      if(world){ disposeTree(world.root); scene.remove(world.root); }
      C=MX.Course.build(pick.layout); look=pick.look; worldKey=key;
      /* the round's real average lap (the timing research), when it differs: the speeds tuned to it, within believable bounds */
      if(o.lapT>0&&Math.abs(C.Tlap/o.lapT-1)>0.04){ const want=clamp(o.lapT,C.Tlap*0.87,C.Tlap*1.15); C=MX.Course.build(Object.assign({},pick.layout,{vavg:C.L/want})); }
      world=buildWorld(C,look,{lo:LO}); scene.add(world.root);
      HG=heightGrid();
      lights();
      scene.fog=world.ctx.fogC?new THREE.Fog(world.ctx.fogC[0],world.ctx.fogC[1],world.ctx.fogC[2]):null;
      flagger=flaggerBuild(flagT("white")); flagger.grp.position.copy(world.fin.flagAt).add(v3.set(0,-0.02,0)); flagger.grp.rotation.y=-world.fin.th+(world.fin.side>0?PI:0); world.root.add(flagger.grp);
      marshal=flaggerBuild(flagT("yellow"),{marshal:true}); marshal.grp.visible=false; world.root.add(marshal.grp);
    }
    V.layout=pick; V.courseInfo={id:C.id,L:+C.L.toFixed(1),Tlap:+C.Tlap.toFixed(1),D1:+C.D1.toFixed(1),T1:+C.T1.toFixed(1),kind:C.kind,shared:pick.shared,name:pick.layout.name};
    if(R){ disposeTree(R.grp); scene.remove(R.grp); }
    list=o.riders.map((r,k)=>({s:r.s!=null?r.s:k,color:r.color,accent:r.accent,num:r.num,name:r.name,red:!!r.red,me:!!r.me}));
    N=list.length; meSeats=list.filter(r=>r.me).map(r=>r.s); redSeat=(list.find(r=>r.red)||{s:-1}).s;
    R=createRiders(list,{lo:LO}); scene.add(R.grp);
    ["wheel","chassis","plastic","trim","fork","swing","helmet","torso","uarm","farm","thigh","shin"].forEach(k=>{ if(R.M[k]) R.M[k].castShadow=true; });
    if(gate){ world.root.remove(gate.grp); disposeTree(gate.grp); }
    gate=gateBuild(C,look,N); world.root.add(gate.grp); camS.gp=null;
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
    SUN.copy(sun.position).normalize();
  }
  function disposeTree(o){ o.traverse(m=>{ if(m.geometry) m.geometry.dispose(); if(m.material){ const ms=Array.isArray(m.material)?m.material:[m.material]; ms.forEach(x=>{ if(x.map) x.map.dispose(); x.dispose(); }); } }); }
  /* the highest dirt in every 2 m cell (the track, its berms and shoulders, the start path): no camera ever sits inside a jump or under a
     landing (polish: a chase camera behind a rider who had just landed could end up under the jump's face, and the screen showed the
     dirt's underside as a black wedge) */
  function heightGrid(){
    let x0=1e9,x1=-1e9,z0=1e9,z1=-1e9; const S=C.S&&C.S.n?C.S:null;
    const grow=(x,z)=>{ if(x<x0) x0=x; if(x>x1) x1=x; if(z<z0) z0=z; if(z>z1) z1=z; };
    for(let i=0;i<C.N;i++) grow(C.x[i],C.z[i]); if(S) for(let i=0;i<S.n;i++) grow(S.x[i],S.z[i]);
    const cs=2, m=16; x0-=m; z0-=m; x1+=m; z1+=m;
    const nx=Math.ceil((x1-x0)/cs)+1, nz=Math.ceil((z1-z0)/cs)+1, H=new Float32Array(nx*nz).fill(-1e9);
    const put=(x,z,y)=>{ const i=Math.floor((x-x0)/cs), j=Math.floor((z-z0)/cs); if(i<0||j<0||i>=nx||j>=nz) return; const k=j*nx+i; if(y>H[k]) H[k]=y; };
    const o={};
    const out=C.kind!=="stadium";
    for(let i=0;i<C.N;i++){ const s=i*C.ds, f=MX.Course.frame(C,s,o), ax=-Math.sin(f.th), az=Math.cos(f.th), hw=f.hw;
      for(let l=-hw;l<=hw+0.01;l+=1) put(f.x+ax*l,f.z+az*l,MX.Course.ground(C,s,l));
      /* the shoulders as the dirt is drawn (r3d-world trackMesh): from the edge down to the ground, wider beside a tall jump outdoors */
      for(const sd of [-1,1]){ const edge=MX.Course.ground(C,s,sd*hw), eh=edge-f.y, sw=out&&eh>=0.45?2.6*(1+Math.min(eh,4)*0.55):2.6, ext=0.85*sw;
        for(let e=0;e<=ext+1.01;e+=1){ const y=edge+(f.y-(out?0.55:0.3)-edge)*sstep(0,1,e/ext), l=sd*(hw+e); put(f.x+ax*l,f.z+az*l,y); } } }
    if(S) for(let i=0;i<S.n;i++){ const ax=-Math.sin(S.th[i]), az=Math.cos(S.th[i]); for(let l=-S.hw[i]-1;l<=S.hw[i]+1.01;l+=1) put(S.x[i]+ax*l,S.z[i]+az*l,(S.y[i]||0)+0.1); }
    return {x0:x0,z0:z0,cs:cs,nx:nx,nz:nz,H:H};
  }
  function dirtTop(x,z){
    if(!HG) return -1e9; const i=Math.floor((x-HG.x0)/HG.cs), j=Math.floor((z-HG.z0)/HG.cs); let y=-1e9;
    for(let b=j-1;b<=j+1;b++){ if(b<0||b>=HG.nz) continue; for(let a=i-1;a<=i+1;a++){ if(a<0||a>=HG.nx) continue; const v=HG.H[b*HG.nx+a]; if(v>y) y=v; } }
    return y;
  }
  /* the dirt's height in the one cell under (x, z) (no neighbours: for sight lines) */
  function dirtCell(x,z){ if(!HG) return -1e9; const i=Math.floor((x-HG.x0)/HG.cs), j=Math.floor((z-HG.z0)/HG.cs); if(i<0||j<0||i>=HG.nx||j>=HG.nz) return -1e9; return HG.H[j*HG.nx+i]; }
  /* can a camera at a see b over the dirt (a jump, a landing, a berm in between)? the far end's own cell doesn't count */
  function sees(a,b,margin){
    const d=Math.hypot(b.x-a.x,b.z-a.z), n=Math.max(2,Math.ceil(d/1.2)), m=margin!=null?margin:0.25;
    const hf=world&&world.ctx.hf;
    for(let k=1;k<n;k++){ const t=k/n; if(t*d>d-2.2) break; const x=a.x+(b.x-a.x)*t, z=a.z+(b.z-a.z)*t, y=a.y+(b.y-a.y)*t; if(dirtCell(x,z)>y-m) return false; if(hf&&hf(x,z)>y-m-0.3) return false; }   /* the dirt, and outdoors the hills */
    return true;
  }
  /* a camera at p stays at least clr above the dirt and the ground under it */
  function safeCam(p,clr){ const y=Math.max(dirtTop(p.x,p.z),world&&world.ctx.hf?world.ctx.hf(p.x,p.z):-1e9,C&&C.kind==="stadium"?-0.16:-1e9); if(p.y<y+clr) p.y=y+clr; return p; }

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
    if(req.yellow&&req.yellow.sector!=null){ const sy=crashSpot(MX.Course.wrap(C,req.yellow.sector*C.L)); yellow={s0:MX.Course.wrap(C,sy-16),len:46,lap:n,s:sy}; marshalAt(sy); }
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
    /* real time even on a slow device (frames up to half a second apart still move the race on by their real length; the physics
       sub-steps); timeScale: tests only (never in the game) */
    const dt=Math.min(1.0,(lastT?Math.min(0.5,(t-lastT)/1000):1/60)*(V.timeScale||1)); lastT=t;
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
  let slowT=0, fastT=0, longPrev=false;
  function adapt(dt){
    if(V.prFixed) return;
    const ft=dt*1000;
    if(ft>220&&!longPrev){ longPrev=true; return; }   /* a one-off hitch (a shader compiling, the tab waking up) is not a slow device; two in a row are */
    longPrev=ft>220;
    if(ft>34){ slowT+=dt; fastT=0; } else if(ft<18){ fastT+=dt; slowT=Math.max(0,slowT-dt*0.5); }
    if(slowT>1.2&&SHADOWS){ setShadows(false); stats.shadowDrop=true; slowT=0; return; }   /* the real shadows go first (the blobs stay) */
    if(slowT>1.5&&pr>prCap*0.5){ pr=Math.max(prCap*0.5,pr*0.85); renderer.setPixelRatio(pr); renderer.setSize(W,H,false); slowT=0; stats.prDrops++; }
    else if(fastT>5&&pr<prCap){ pr=Math.min(prCap,pr*1.1); renderer.setPixelRatio(pr); renderer.setSize(W,H,false); fastT=0; }
  }
  function setShadows(on){ SHADOWS=!!on; renderer.shadowMap.enabled=SHADOWS; sun.castShadow=SHADOWS; }
  /* the shadow box: round what the camera looks at (pulled a little toward the lens), its size from how far the camera is, snapped to
     whole texels in the light's view so the edges never shimmer as it follows the action */
  const shR=new THREE.Vector3(), shU=new THREE.Vector3(), shF=new THREE.Vector3(), shC=new THREE.Vector3(), YUP=new THREE.Vector3(0,1,0);
  function fitShadow(){
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
    if(r.crash){ crashPose(i,r,tw,dt); return; }
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
    const gl=onStart?0:(MX.Course.ground(C,s,lat+0.5)-MX.Course.ground(C,s,lat-0.5));
    let shx=x, shz=z, shy=(tF+tR)/2;
    if(hAir>0.25&&!onStart){ const k=Math.min(6,hAir)/Math.max(0.35,SUN.y), ox=-SUN.x*k, oz=-SUN.z*k, al=ox*cth+oz*sth, lt=ox*nx+oz*nz; shx=x+ox; shz=z+oz; shy=MX.Course.ground(C,s+al,lat+lt); }
    shadowAt(R,i*2,shx,shy,shz,th,2.1,0.9,clamp(1-hAir/6,0.3,1),clamp((tF-tR)/BIKE.WB,-1.2,1.2),clamp(gl,-1.2,1.2),blobOp(shx,shy,shz));
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
  /* roost chunks a little darker than the lit dirt, dust paler than it (display colours: the particle shader writes them as they are) */
  function dirtCol(){ const s=look&&look.soil; return s==="sand"?[0.74,0.63,0.45]:s==="hardpack"?[0.55,0.43,0.3]:C.kind==="stadium"?[0.45,0.33,0.22]:[0.36,0.27,0.18]; }
  function dustCol(){ const s=look&&look.soil; return s==="sand"?[0.86,0.79,0.64]:C.kind==="stadium"?[0.7,0.6,0.48]:[0.74,0.67,0.55]; }
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
    r.crash={T:T,lap:lapNo,kind:c.kind,tau:T-r.g,D:Math.max(0,r.D),side:c.side,v0:Math.max(6,r.v||MX.Course.vOfD(C,r.D)),lat:r.lat,down:c.kind==="out"?1e9:4.6,th:r.fr?r.fr.th:0,fx:0};
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
    /* polish: right at the track's edge near the crash (the old 11 m on and 2.2 m out left the flag a speck); where the camera that shows
       the crash sees him BEHIND the action, never between the lens and the rider; with no camera, the far side */
    const fc=MX.Course.frame(C,s+3,{}), cands=[];
    for(const ds of [8,3,13,-4]) for(const sd of [1,-1]){
      const f=MX.Course.frame(C,s+ds,{}), lat=sd*(f.hw+1.5), x=f.x-Math.sin(f.th)*lat, z=f.z+Math.cos(f.th)*lat;
      if(!clear(C,x,z,0.5)) continue;
      let sc=ds===8?1:ds===3?0.7:ds===13?0.45:0.2;
      if(camP){ const ax=fc.x-camP.x, az=fc.z-camP.z, bx=x-camP.x, bz=z-camP.z, da=Math.hypot(ax,az)||1, db=Math.hypot(bx,bz)||1, cosA=(ax*bx+az*bz)/(da*db);
        if(db<da+1.5) sc-=4; else if(cosA<0.86) sc-=1.5; else sc+=1+(db-da)*0.02;
        if(!sees(camP,v3.set(x,MX.Course.ground(C,s+ds,sd*f.hw)+1.8,z),0.1)) sc-=3; }   /* hidden behind a jump from the crash camera */
      else sc+=sd===-(side||1)?0.5:0;
      cands.push({sc:sc,f:f,lat:lat,x:x,z:z,s:s+ds});
    }
    if(!cands.length){ const f=MX.Course.frame(C,s+8,{}), lat=-(side||1)*(f.hw+1.5); cands.push({sc:0,f:f,lat:lat,x:f.x-Math.sin(f.th)*lat,z:f.z+Math.cos(f.th)*lat,s:s+8}); }
    cands.sort((a,b)=>b.sc-a.sc);
    const c=cands[0], f=c.f, lat=c.lat, x=c.x, z=c.z;
    const edge=MX.Course.ground(C,c.s,Math.sign(lat)*f.hw), y=Math.max(edge+((f.y||0)-(C.kind==="stadium"?0.3:0.55)-edge)*sstep(0,1,(Math.abs(lat)-f.hw)/2.2),terrainAt(x,z,-1e9),C.kind==="stadium"?-0.16:-1e9);   /* on the shoulder's slope as the dirt is drawn, or the ground beside it */
    /* facing the riders coming at the crash, turned toward the track */
    const fx=-Math.cos(f.th)*0.6+Math.sin(f.th)*Math.sign(lat)*0.8, fz=-Math.sin(f.th)*0.6-Math.cos(f.th)*Math.sign(lat)*0.8;
    marshal.grp.position.set(x,y-0.03,z); marshal.grp.rotation.y=Math.atan2(fx,fz); marshal.grp.visible=true; marshal.s=s;
  }
  /* the yellow lap's marshal: where the crash really happened (the same spot the crash was moved to), left where he stands if he's there */
  function marshalAt(sy){ if(marshal&&marshal.grp.visible&&marshal.s!=null){ let d=Math.abs(marshal.s-sy); d=Math.min(d,C.L-d); if(d<4) return; } placeMarshalS(sy); }
  V.yellowAt=function(sector){ if(!C) return; marshalAt(crashSpot(MX.Course.wrap(C,sector*C.L))); };
  V.yellowOff=function(){ if(marshal&&!rs.some(r=>r.crash)) marshal.grp.visible=false; };
  const CM=new THREE.Matrix4(), BM=new THREE.Matrix4(), cq=new THREE.Quaternion(), ce=new THREE.Euler(0,0,0,"YZX"), cv3=new THREE.Vector3(), cv4=new THREE.Vector3();
  function crashPose(i,r,tw,dt){
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
    if(t<0.62){ /* thrown over the bars: up off the seat, rotating forward, down onto the dirt */
      const u=t/0.62; hy=Math.max(0.3,1.0+2.3*t-4.9*t*t); bodyPitch=-2.5*u; bodyRoll=side*0.5*u; spread=0.55+0.45*u; }
    else if(t<1.4){ /* the tumble: two rolls along the dirt, each bounce lower, ending face down (two whole turns: no jump into the lying pose) */
      const u=t-0.62, e=1-Math.pow(1-u/0.78,2), b=Math.abs(Math.sin(u*8.05))*0.42*Math.exp(-u*3.0);
      hy=0.26+b; bodyRoll=side*(0.5*(1-e)+4*PI*e); bodyPitch=-2.5+(2.5-PI/2)*sstep(0,0.78,u); spread=1; }
    else if(t<1.9){ hy=0.16; bodyRoll=0; bodyPitch=-PI/2; spread=0.7; }
    else if(t<2.7){ const u=sstep(1.9,2.7,t); hy=0.16+u*0.8; bodyPitch=-PI/2*(1-u); spread=0.7*(1-u); stand=u; }
    else { hy=0.96; stand=1;
      const endX=f.x+cth*(thrown+0.6)+nx*(c.lat+side*3), endZ=f.z+sth*(thrown+0.6)+nz*(c.lat+side*3);
      if(c.kind==="remount"){ const u=sstep(2.7,3.3,t); const tx=bx+nx*(-side*0.7), tz=bz+nz*(-side*0.7); hx=endX+(tx-endX)*u; hz=endZ+(tz-endZ)*u; walk=t<3.3?1:0; phase=t*9; reach=sstep(3.1,3.5,t); bodyYaw=-th+side*0.6*(1-sstep(3.3,3.9,t)); }
      else { const u=sstep(2.7,4.7,t); const off=side*(f.hw+4.5); const tx=f.x+cth*(thrown+1.5)+nx*off, tz=f.z+sth*(thrown+1.5)+nz*off; hx=endX+(tx-endX)*u; hz=endZ+(tz-endZ)*u; walk=t<4.7?1:0; phase=t*8; bodyYaw=-th+side*PI/2; }
      if(c.kind==="remount"&&t>=3.9){ poseRider(R,i,BM,{stand:0.3,dab:0,lean:rollB,crouch:0.2,spinF:r.spinF,spinR:r.spinR}); shadowAt(R,i*2,bx,gy,bz,th,2.1,0.9,1,0,0,blobOp(bx,gy,bz)); shadowAt(R,i*2+1,0,-999,0,0,0,0,0); r.pos=r.pos||new THREE.Vector3(); r.pos.set(bx,gy+1,bz); r.th=th; r.gy=gy; r.bikeP=(r.bikeP||new THREE.Vector3()).set(bx,gy+0.4,bz); return; }
    }
    const l2=MX.Course.atD(C,c.D+thrown,tmpO2), hgy=l2.onStart?(f.y||0):MX.Course.ground(C,l2.s,c.lat);
    if(!LO&&dt>0){ /* dust: a burst where the rider hits the dirt and at each bounce; a trail behind the sliding bike */
      const ev=[0.62,1.01,1.4]; while(c.fx<ev.length&&t>=ev[c.fx]){ const nb=c.fx?6:14; for(let k=0;k<nb;k++) emit(R,hx+(Math.random()-0.5)*0.9,hgy+0.15,hz+(Math.random()-0.5)*0.9,(Math.random()-0.5)*2.4,0.4+Math.random()*1.2,(Math.random()-0.5)*2.4,0.55+Math.random()*0.7,1.3+Math.random()*0.7,dustCol()); c.fx++; }
      if(t<ts&&Math.random()<Math.min(1,dt*40)) emit(R,bx+(Math.random()-0.5)*0.7,gy+0.12,bz+(Math.random()-0.5)*0.7,-cth*1.2+(Math.random()-0.5),0.3+Math.random()*0.7,-sth*1.2+(Math.random()-0.5),0.45+Math.random()*0.5,1.1,dustCol()); }
    ce.set(bodyRoll,bodyYaw,bodyPitch,"YZX"); cq.setFromEuler(ce); CM.compose(cv4.set(hx,hgy+hy,hz),cq,sc1);
    poseRider(R,i,BM,{body:CM,limbs:{spread:spread,walk:walk,phase:phase,stand:stand,reach:reach},spinF:r.spinF,spinR:r.spinR});
    shadowAt(R,i*2,bx,gy,bz,th+yawB,2.0,1.0,1,0,0,blobOp(bx,gy,bz)); shadowAt(R,i*2+1,hx,hgy,hz,th,1.0,0.8,clamp(1-hy/2,0.3,1),0,0,blobOp(hx,hgy,hz));
    r.bikeP=(r.bikeP||new THREE.Vector3()).set(bx,gy+0.4,bz);
    r.pos=r.pos||new THREE.Vector3(); r.pos.set(hx,hgy+hy+0.4,hz); r.th=th; r.gy=gy;
  }

  /* ---------------- the camera director: the whole lap at real speed, cut between sections as the leader rides them ---------------- */
  function leaderIdx(){ let b=-1, bd=-1e9; rs.forEach((r,i)=>{ if(!r.gone&&!r.crash&&r.D>bd){ bd=r.D; b=i; } }); return b; }
  function setShot(s){ shot=s; shot.t=0; camS.snap=true; if(s.why==="yellow"&&yellow) yellow.shown=true; shot.cam=typeof s.cam==="function"?s.cam():(s.cam||null); shotLog.push(s.type+(s.why?":"+s.why:"")); if(shotLog.length>12) shotLog.shift(); }
  function nextFeat(s){
    let best=null, bd=1e9; C.feats.forEach(f=>{ if(f.k!=="whoops"&&f.k!=="jump"&&f.k!=="rhythm"&&f.k!=="sand"&&f.k!=="step") return; const d=MX.Course.wrap(C,f.from-s); if(d<bd){ bd=d; best=f; } }); return best?{f:best,d:bd}:null;
  }
  function inFloor(p){ if(C.kind!=="stadium"||!C.layout.floor) return p; const F=C.layout.floor; p.x=clamp(p.x,F[0]+2.2,F[1]-2.2); p.z=clamp(p.z,F[2]+2.2,F[3]-2.2); return p; }
  function terrainAt(x,z,y){ if(world.ctx.hf) return world.ctx.hf(x,z); return y||0; }
  /* a trackside camera beside loop distance s: the side with room, off the track (inside the wall in a stadium) */
  /* a trackside camera beside loop distance s: a spot with room (no lane within `room` m: nobody rides through the lens) at least minOff m
     from the subject's line (a wall may pull a spot in: the real distance counts), the side with more room; inside the wall in a stadium.
     Where the floor is packed with lanes it becomes a crane, raised over the riders (polish: a spot pulled in by the wall could put the
     rider 3 m from the lens) */
  function trackCam(s,h,distA,room,minOff,tgtH){
    const f=MX.Course.frame(C,s,tmpO), want=room!=null?room:(C.kind==="stadium"?5.5:4.5), mo=f.hw+(minOff!=null?minOff:7);
    const tg=new THREE.Vector3(f.x,MX.Course.ground(C,s,0)+(tgtH!=null?tgtH:1.0),f.z), fx=f.x, fz=f.z, fth=f.th, fhw=f.hw, fy=f.y;
    let best=null, bs=-1e9;
    for(const dist of (distA||[10,14,18,23,29,36])) for(const side of [1,-1]){
      const lat=side*(fhw+dist), p=inFloor({x:fx-Math.sin(fth)*lat,z:fz+Math.cos(fth)*lat});
      const cd=clearDist(C,p.x,p.z), off=Math.hypot(p.x-fx,p.z-fz), base=terrainAt(p.x,p.z,fy);
      /* the spot must see the subject's spot over the dirt (polish: a camera behind a landing showed nothing but the mound); higher if it must */
      let vis=-1; for(const up of [0,2.5,5,9]){ const c=safeCam(new THREE.Vector3(p.x,base+h+up,p.z),1.2); if(sees(c,tg)){ vis=up; if(cd>=want&&off>=mo&&up<9) return c; break; } }
      const sc=Math.min(cd,want)*2+Math.min(off,mo)*0.8-Math.max(0,off-mo-12)*0.1-(vis<0?20:vis*0.6);
      if(sc>bs){ bs=sc; best={p:p,cd:cd,off:off,vis:vis,base:base}; } }
    const raise=clamp(want-best.cd,0,want)*1.3+(best.off<mo?2.5:0)+(best.vis>0?best.vis:best.vis<0?9:0);
    return safeCam(new THREE.Vector3(best.p.x,best.base+h+1.5+raise,best.p.z),1.2);
  }
  function featCam(f){
    const sp=(C.spots||[]).find(x=>Math.abs(x.mid-(f.from+f.to)/2)<3), out=C.kind!=="stadium";
    /* a jump: from below the landing side, looking up at the riders against the sky (outdoors higher and further back: the hills' big
       faces would hide them) */
    if(f.k==="jump"){ const at=f.lip!=null?f.lip+(f.to-f.lip)*0.55:(f.from+f.to)/2; return out?trackCam(at,3.6,[12,16,21,27],4.5,10,(f.h||2)+1.5):trackCam(at,1.5,[9,12,15,19],undefined,undefined,(f.h||2)+1.5); }
    if(f.k==="whoops"&&sp){ const p=inFloor({x:sp.x,z:sp.z}), fm=MX.Course.frame(C,sp.mid,tmpO), c=safeCam(new THREE.Vector3(p.x,terrainAt(p.x,p.z,sp.y)+5.5,p.z),1.5);
      if(clearDist(C,p.x,p.z)>=4&&Math.hypot(p.x-fm.x,p.z-fm.z)>=fm.hw+7&&sees(c,new THREE.Vector3(fm.x,MX.Course.ground(C,sp.mid,0)+1,fm.z))) return c; }
    if(f.k==="whoops") return trackCam((f.from+f.to)/2,C.kind==="stadium"?5.5:7.5);
    /* a rhythm lane, the sand, a step-up: further back and higher, a third of the way along, looking down on the lane (the riders ahead
       must not fill the lens) */
    return trackCam(f.from+(f.to-f.from)*0.35,C.kind==="stadium"?7:5,[14,18,23,29,36],5.5,11,1.6);
  }
  /* a camera round a spot: on rings of the given distances, at the first height that sees every target over the dirt and the hills, clear
     of the lanes (raised over a lane that passes close); scored for the wanted distance and for standing ahead along fdir (the riders come
     toward the lens) */
  function spotCam(cx,cz,fy,fdir,targets,dists,heights,want,avoid){
    let best=null, bs=-1e9;
    for(const d of dists) for(let k=0;k<16;k++){ const a=k/16*PI*2, p=inFloor({x:cx+Math.cos(a)*d,z:cz+Math.sin(a)*d}), cd=clearDist(C,p.x,p.z), dd=Math.hypot(p.x-cx,p.z-cz);
      if(cd<1.2||dd<d*0.6) continue;
      if(avoid&&avoid.some(o=>Math.hypot(p.x-o.x,p.z-o.z)<o.d)) continue;   /* too close to someone who must be in the frame */
      const base=terrainAt(p.x,p.z,fy); let c=null, hi=0;
      for(const h of heights){ const q=safeCam(new THREE.Vector3(p.x,base+h+(cd<3?1:0),p.z),1.2); if(targets.every(t=>sees(q,t))){ c=q; break; } hi++; }
      if(!c) continue;
      const ahead=((p.x-cx)*fdir.x+(p.z-cz)*fdir.z)/dd, sc=Math.min(cd,3.5)*1.2-Math.abs(dd-want)*0.4+ahead*0.9-hi*0.8;
      if(sc>bs){ bs=sc; best=c; } }
    return best;
  }
  /* the crash camera: close (about 9.5 m from where the rider lands), a crane at about 5 m looking down over the riders passing the crash,
     beside or a little ahead of the crash so the rider tumbles toward the lens */
  function crashCam(s){
    const f=MX.Course.frame(C,s+3,tmpO), tgt=new THREE.Vector3(f.x,MX.Course.ground(C,s+3,0)+0.7,f.z);
    return spotCam(f.x,f.z,f.y,{x:Math.cos(f.th),z:Math.sin(f.th)},[tgt],[8,9.5,11.5,14],[5,7,9],9.5)||trackCam(s+5,2.4,[6,8.5,11,14,18],3.2,5);
  }
  /* the yellow lap: the marshal waving the flag and the riders coming into the section, both in sight */
  function yellowCam(ys){
    const f=MX.Course.frame(C,ys,{}), fa=MX.Course.frame(C,ys-14,{}), T=[new THREE.Vector3(f.x,MX.Course.ground(C,ys,0)+1,f.z),new THREE.Vector3(fa.x,MX.Course.ground(C,ys-14,0)+1,fa.z)];
    let av=null, cx=f.x, cz=f.z;
    if(marshal&&marshal.grp.visible){ const m=marshal.grp.position; T.push(m.clone().add(v3.set(0,1.5,0))); av=[{x:m.x,z:m.z,d:9}]; cx=(f.x+m.x)/2; cz=(f.z+m.z)/2; }   /* the marshal 9 m or more from the lens */
    return spotCam(cx,cz,f.y,{x:Math.cos(f.th),z:Math.sin(f.th)},T,[11,14,17,21,26],[3.5,6,9,12],15,av)||trackCam(ys+2,3.4,[8,11,14,18,23],3.5,6);
  }
  /* the gate camera: low, a few metres beyond the start straight's edge and a little ahead of the gate (the side with more room) */
  function gateCam(g){
    const fx=Math.cos(g.th), fz=Math.sin(g.th), rx=-fz, rz=fx, fwd=6+g.gw*0.22, lat=g.gw*0.5+4.5, ht=1.6+g.gw*0.035;
    let best=null, bd=-1e9;
    for(const sd of [1,-1]){ const p=inFloor({x:g.x+fx*fwd+rx*lat*sd,z:g.z+fz*fwd+rz*lat*sd}), cd=clearDist(C,p.x,p.z); if(cd>bd){ bd=cd; best=p; } }
    return new THREE.Vector3(best.x,terrainAt(best.x,best.z,g.y)+ht+(bd<2?2.5:0),best.z);
  }
  function turn1Cam(){
    let f; if(C.S.n){ f=MX.Course.startFrame(C,Math.max(0,C.Ls-16),tmpO); } else f=MX.Course.frame(C,C.join+Math.max(10,C.hsD-16),tmpO);
    const side=-Math.sign(f.k||1)||1;
    for(const dist of [14,20,26]){ const lat=side*(f.hw+dist), x=f.x-Math.sin(f.th)*lat, z=f.z+Math.cos(f.th)*lat; if(clear(C,x,z,2)){ const p=inFloor({x:x,z:z}); return new THREE.Vector3(p.x,terrainAt(p.x,p.z,f.y)+10,p.z); } }
    const p=inFloor({x:f.x+20,z:f.z+20}); return new THREE.Vector3(p.x,terrainAt(p.x,p.z,0)+10,p.z);
  }
  /* the line: from beyond it, low, across the track from the flagger: the riders come at the lens over the stripe, the flagger and the
     flag up on the tower behind them */
  function lineCam(){ const fin=world.fin, f=MX.Course.frame(C,0,tmpO), th=f.th, lat=-Math.sign(fin.lat||1)*(f.hw+3.5);
    const p=inFloor({x:f.x+Math.cos(th)*11-Math.sin(th)*lat,z:f.z+Math.sin(th)*11+Math.cos(th)*lat}); return new THREE.Vector3(p.x,terrainAt(p.x,p.z,f.y)+2.1,p.z); }
  function candidates(urgent){
    const L=[], lead=leaderIdx(); if(lead<0) return L;
    const r=rs[lead], me=meSeats.filter(s=>rs[s]&&!rs[s].gone&&!rs[s].crash);
    if(lapNo===1&&r.D<C.hsD&&C.hsD-r.D<62&&!(shot&&shot.type==="turn1")) L.push({type:"turn1",subj:lead,pri:9.2,min:4.5,max:8,cam:turn1Cam});   /* the holeshot: never missed */
    rs.forEach((k,i)=>{ if(k.crashPlan&&!k.crash&&!k.gone&&!k.onStart&&k.lapN>=k.crashPlan.lap){ const d=MX.Course.wrap(C,k.crashPlan.s-k.s); if(d>0&&d<Math.max(10,k.v*2.6)){ const out=k.crashPlan.kind==="out"; const cs=k.crashPlan.s; L.push({type:"crash",subj:i,pri:10,min:out?7.5:8.4,max:out?9.5:10.5,cam:()=>crashCam(cs)}); } } });
    if(!r.onStart){ const toLine=C.L-r.s, tl=toLine/Math.max(4,r.v), over=lapPlan&&lapPlan.over&&lapPlan.n>=lapNo;
      if(tl<3.4&&(over||lapNo===lenLaps-1||lapNo%3===0)) L.push({type:"line",subj:lead,pri:over?9:lapNo===lenLaps-1?7:4,min:3.2,max:over?7:5,cam:lineCam}); }
    /* the yellow lap: once, the first rider (in running order) about to ride through the yellow section, with the marshal in the frame */
    if(yellow&&yellow.lap===lapNo&&!yellow.shown){ const ys=yellow.s; let yi=-1;
      rs.map((k,i)=>i).filter(i=>!rs[i].gone&&!rs[i].crash&&!rs[i].onStart).sort((a,b)=>rs[b].D-rs[a].D).some(i=>{ const k=rs[i], d=MX.Course.wrap(C,yellow.s0-k.s); if(d>2&&d<Math.max(14,k.v*4.5)){ yi=i; return true; } return false; });
      if(yi>=0) L.push({type:"track",subj:yi,pri:6.5,min:4.5,max:7,cam:()=>yellowCam(ys),why:"yellow"}); }
    if(urgent) return L;
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
    if(shot.pri<9&&shot.t>0.6){ const L=candidates(true).filter(c=>c.pri>shot.pri&&(c.pri>=9||(c.pri>shot.pri+2.5&&shot.t>1.2))).sort((a,b)=>b.pri-a.pri); if(L.length){ setShot(L[0]); return; } }   /* a crash, the holeshot, the checkered flag cut in at once; the white flag or the yellow section over a filler shot */
    if(shot.t>=shot.max){ pickShot(); return; }
    if(shot.t>=shot.min){
      const r=rs[shot.subj];
      if(shot.feat&&r&&!r.onStart){ const d=MX.Course.wrap(C,r.s-shot.feat.to); if(d<C.L/2&&d>3){ pickShot(); return; } }
      if(shot.cam&&r&&r.pos&&shot.type!=="crash"&&shot.type!=="line"){ dirA.subVectors(shot.cam,r.pos); fwA.set(Math.cos(r.th||0),0,Math.sin(r.th||0)); if(dirA.dot(fwA)<-6||dirA.length()<5){ pickShot(); return; } }
      if(!shot.cam&&shot.t>=shot.min+1.5) pickShot();
    }
  }
  const cTarget=new THREE.Vector3(), cPos=new THREE.Vector3(), tv3=new THREE.Vector3(), tv4=new THREE.Vector3(), tv2=new THREE.Vector3();
  function camera(dt){
    if(!shot) return;
    const sh=shot.type, snap=camS.snap||dt<=0; let fov=50;
    const off=motion()==="off";
    const j=shot.subj>=0?shot.subj:leaderIdx();
    const have=j>=0&&rs[j]&&rs[j].pos; if(have) tv3.copy(rs[j].pos);
    if(off&&mode==="race"){
      /* reduced motion: a still wide frame, re-placed every few seconds (inside the wall in a stadium, never in the stands) */
      if(have&&(snap||!camS.offT||now()-camS.offT>6000)){ camS.offT=now(); cTarget.copy(tv3); const p=inFloor({x:tv3.x+24,z:tv3.z+20}); cPos.set(p.x,tv3.y+24,p.z); safeCam(cPos,6); }
      fov=50;
    } else if(sh==="gate"&&gate){
      const g=gate, fx=Math.cos(g.th), fz=Math.sin(g.th), rx=-fz, rz=fx;
      if(!camS.gp||camS.gk!==g){ camS.gk=g; camS.gp=safeCam(gateCam(g),1.2); }
      cPos.copy(camS.gp);
      tv4.set(g.x-fx*0.4,g.y+0.85,g.z-fz*0.4);
      if(mode==="race"&&have) cTarget.lerpVectors(tv4,tv3,sstep(0.25,2.0,shot.t)); else cTarget.copy(tv4);
      /* wide enough for both ends of the gate (and the pack once it's away) */
      const e1=v3.set(g.x+rx*g.gw*0.5,g.y,g.z+rz*g.gw*0.5).sub(cPos), e2=tv2.set(g.x-rx*g.gw*0.5,g.y,g.z-rz*g.gw*0.5).sub(cPos), ang=e1.angleTo(e2)*1.18;
      const asp0=W/Math.max(1,H); fov=clamp(2*Math.atan(Math.tan(ang/2)/Math.max(0.6,asp0))*180/PI,22,70);
    } else if(!have){ /* nothing to follow */ }
    else if(sh==="chase"||sh==="heli"){
      /* chase: low behind the rider, the track ahead in the frame; heli: a cable-cam view from behind and above (inside the wall in a
         stadium), tight enough that the rider reads */
      const r=rs[j], th=r.th||0, heli=sh==="heli", back=heli?16:7.2, up=heli?10:2.6, clr=heli?3.5:1.5;
      tv4.set(tv3.x-Math.cos(th)*back,Math.max(tv3.y+up,(r.gy||0)+1.9),tv3.z-Math.sin(th)*back);
      if(C.kind==="stadium"&&C.layout.floor){ const p=inFloor({x:tv4.x,z:tv4.z}); tv4.x=p.x; tv4.z=p.z; }
      safeCam(tv4,clr);
      if(snap) cPos.copy(tv4); else cPos.lerp(tv4,1-Math.exp(-dt/0.32));
      safeCam(cPos,clr);
      const ah=heli?3:6;
      tv4.set(tv3.x+Math.cos(th)*ah,tv3.y-(heli?0.5:0.15),tv3.z+Math.sin(th)*ah);
      if(snap) cTarget.copy(tv4); else cTarget.lerp(tv4,1-Math.exp(-dt/0.12));
      fov=heli?40:54;
    } else {
      if(!shot.cam) shot.cam=trackCam(rs[j].s||0,3);
      cPos.copy(shot.cam); safeCam(cPos,1.2);
      tv4.copy(tv3); let spread=0, base=sh==="whoops"?6:sh==="jump"?6.5:sh==="turn1"?10:sh==="line"?3.2:sh==="crash"?2.6:2.4;
      const cr=sh==="crash"?rs[j].crash:null;
      if(cr){ /* the crash: tight on the rider and the bike while it happens; once the rider is down the marshal's yellow flag joins the frame */
        const t=T-cr.T, bp=rs[j].bikeP;
        if(bp){ tv4.lerp(bp,0.35); spread=Math.min(7,bp.distanceTo(tv3))*0.9; }
        if(marshal&&marshal.grp.visible){ const mp=marshal.grp.position, k=sstep(1.3,2.6,t), dm=Math.hypot(mp.x-tv3.x,mp.z-tv3.z);
          if(dm<22){ tv4.x+=(mp.x-tv4.x)*0.32*k; tv4.y+=(mp.y+1.5-tv4.y)*0.32*k; tv4.z+=(mp.z-tv4.z)*0.32*k; spread=Math.max(spread,Math.min(9,dm*0.7)*k); } }
        base=2.2;
      }
      else if(shot.victim!=null&&rs[shot.victim]&&rs[shot.victim].pos){ tv4.lerp(rs[shot.victim].pos,0.45); spread=Math.min(14,rs[shot.victim].pos.distanceTo(tv3)); }
      else if(sh==="line"&&world.fin){ /* the flagger's flag in the frame with the rider */
        const fp=world.fin.flagAt, dm=Math.hypot(fp.x-tv3.x,fp.z-tv3.z); tv4.set(tv4.x+(fp.x-tv4.x)*0.4,tv4.y+(fp.y+1.6-tv4.y)*0.4,tv4.z+(fp.z-tv4.z)*0.4); spread=Math.min(18,dm*0.9+2); }
      else if(shot.why==="yellow"&&marshal&&marshal.grp.visible){ /* the yellow section: the marshal waving the flag, the riders coming through
          (the riders join the frame as they arrive; a rider still far off doesn't pull the marshal out of it) */
        const mp=marshal.grp.position, dm=Math.hypot(mp.x-tv3.x,mp.z-tv3.z);
        if(dm<26){ tv4.set((tv4.x+mp.x)/2,(tv4.y+mp.y+1.4)/2,(tv4.z+mp.z)/2); spread=Math.min(14,dm*0.8); }
        else { const k=4/dm; tv4.set(mp.x+(tv3.x-mp.x)*k,mp.y+1.3,mp.z+(tv3.z-mp.z)*k); spread=4; } }
      tv4.y-=0.3;
      if(snap) cTarget.copy(tv4); else cTarget.lerp(tv4,1-Math.exp(-dt/(cr?0.18:0.1)));
      const dist=cPos.distanceTo(cTarget), wantW=2.6+spread*0.8+base+(cr?0:Math.max(0,dist-22)*0.05);   /* a far subject: a little more of the scene round it */
      fov=clamp(2*Math.atan(wantW/(2*dist))*180/PI*1.6,sh==="line"?12:19,64);
      if(sh==="turn1") fov=clamp(fov,26,64);
      if(shot.why==="yellow"){ const asp=Math.max(0.8,W/Math.max(1,H)); fov=clamp(2*Math.atan((11+spread*0.5)/asp/(2*dist))*180/PI,14,52); }   /* the yellow section about 12 m across */
      if(sh==="crash"){ /* the crash: framed by the scene's width (the rider, the bike, then the marshal): about 7 m across, never a speck */
        const visW=(cr?6.2+spread*1.25:8+Math.max(0,dist-12)*0.3)*(W<H?0.8:1), asp=Math.max(0.8,W/Math.max(1,H));
        fov=clamp(2*Math.atan(visW/asp/(2*dist))*180/PI,8,55); }
    }
    /* a portrait screen: a little wider vertically, the sides cropped (the riders stay big) */
    const asp=W/Math.max(1,H); if(asp<1&&sh!=="gate"&&sh!=="crash") fov=clamp(2*Math.atan(Math.tan(fov*PI/360)/Math.max(0.78,Math.pow(asp,0.55)))*180/PI,10,80);
    if(snap){ camS.fov=fov; camS.snap=false; } else camS.fov+=(fov-camS.fov)*Math.min(1,dt*4);
    cam.position.copy(cPos); cam.lookAt(cTarget); if(Math.abs(cam.fov-camS.fov)>0.01){ cam.fov=camS.fov; cam.updateProjectionMatrix(); }
    if(world.ctx.skyMesh) world.ctx.skyMesh.position.copy(cam.position);
    if(SHADOWS) fitShadow();
  }
  /* number tags over riders that are small on screen (always the person's and the red plate), at most 7, a constant size on screen */
  const tagV=new THREE.Vector3(), tagP=new THREE.Vector3();
  function tags(){
    if(!R) return;
    cam.updateMatrixWorld();
    const show2=[], camP=cam.position, th=Math.tan(cam.fov*PI/360)*2, px=tv()?clamp(Math.round((GL.innerHeight||1080)/36),15,30):24;   /* TV tags scale with the screen like its text */
    rs.forEach((r,i)=>{ if((r.gone&&!r.crash)||!r.pos){ tagAt(R,i,null,0); return; } show2.push([camP.distanceTo(r.pos),i]); });
    const max=LO?5:7, mine=new Set(meSeats.concat(redSeat>=0?[redSeat]:[]));
    show2.sort((a,b)=>(mine.has(b[1])-mine.has(a[1]))||a[0]-b[0]);   /* the person's and the red plate first, then the nearest */
    let k=0; const placed=[], pw=px*1.6*0.9, ph=px*0.8;
    show2.forEach(([d,i])=>{
      const r=rs[i], view=d*th, riderPx=2.0/view*H, small=riderPx<95;
      const vis=(k<max||mine.has(i))&&small&&d>6&&!(mode==="gate"&&!mine.has(i));
      if(vis){ const size=view*(px*(mine.has(i)?1.12:1))/H; tagV.copy(r.pos); tagV.y+=0.9+size*0.55;
        /* never a pile of tags: one that would overlap a tag already shown is left out */
        tagP.copy(tagV).project(cam); const sx=(tagP.x*0.5+0.5)*W, sy=(0.5-tagP.y*0.5)*H;
        if(tagP.z>1||sx<pw*0.55||sx>W-pw*0.55||sy<ph*0.6||sy>H-ph*0.6||placed.some(p=>Math.abs(p[0]-sx)<pw&&Math.abs(p[1]-sy)<ph)){ tagAt(R,i,null,0); return; }   /* never cut by the screen's edge, never a pile */
        placed.push([sx,sy]); tagAt(R,i,tagV,size*1.6); k++; } else tagAt(R,i,null,0);
    });
    R.M.tag.instanceMatrix.needsUpdate=true;
  }

  /* ---------------- tests and tools ---------------- */
  V.state=function(){ return {mode:mode,lap:lapNo,len:lenLaps,T:+T.toFixed(2),lapT:C?+(T-lapStartT(lapNo)).toFixed(1):0,finished:finished,shot:shot?{type:shot.type,t:+shot.t.toFixed(2),subj:shot.subj,why:shot.why||""}:null,shots:shotLog.slice(),
    yellow:yellow?{lap:yellow.lap,s:+yellow.s.toFixed(0)}:null,riders:rs.map(r=>({s:r.seat,D:+r.D.toFixed(1),ls:+(r.s||0).toFixed(1),g:+r.g.toFixed(2),v:+(r.v||0).toFixed(1),lat:+r.lat.toFixed(2),air:!!r.air,stand:+r.stand.toFixed(2),crash:r.crash?r.crash.kind:null,ct:r.crash?+(T-r.crash.T).toFixed(2):null,plan:r.crashPlan?r.crashPlan.kind:null,gone:r.gone})),
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
  /* tests: move the race on by sec seconds in 1/60 s steps (the director and the camera run as in the game), then draw one frame */
  V.advance=function(sec,noDraw){ if(!C) return null; const n=Math.max(1,Math.round(sec*60)); for(let k=0;k<n;k++) step(sec/n); if(!noDraw) render(); return V.state(); };
  /* tests: run the race for sec seconds without drawing and report the lowest the camera came to the dirt (and where) */
  V.sweep=function(sec){ if(!C) return null; let lo=1e9, at=null; const n=Math.max(1,Math.round(sec*30)); for(let k=0;k<n;k++){ step(sec/n); const p=cam.position, a=p.y-Math.max(dirtTop(p.x,p.z),-50); if(a<lo){ lo=a; at={shot:shot?shot.type+(shot.why?":"+shot.why:""):"",x:+p.x.toFixed(1),z:+p.z.toFixed(1),T:+T.toFixed(1)}; } } return {lowest:+lo.toFixed(2),at:at,shots:shotLog.slice()}; };
  /* test hook: where seat k is on screen (NDC -1..1; in = inside the frame) and how far from the camera; the marshal too */
  V.proj=function(k){ const i=rs.findIndex(r=>r.seat===k); if(i<0||!rs[i].pos) return null; cam.updateMatrixWorld(); const d=cam.position.distanceTo(rs[i].pos), p=rs[i].pos.clone().project(cam);
    let m=null; if(marshal&&marshal.grp.visible){ const q=marshal.grp.position.clone(); q.y+=1.4; const mp=q.project(cam); m={x:+mp.x.toFixed(2),y:+mp.y.toFixed(2),in:Math.abs(mp.x)<1&&Math.abs(mp.y)<1&&mp.z<1}; }
    return {x:+p.x.toFixed(2),y:+p.y.toFixed(2),in:Math.abs(p.x)<1&&Math.abs(p.y)<1&&p.z<1,d:+d.toFixed(1),marshal:m}; };
  V.renderNow=renderOnce;
  /* tests: where the camera is, how far above the dirt under it, the shadows */
  V.camInfo=function(){ const p=cam.position; return {x:+p.x.toFixed(1),y:+p.y.toFixed(2),z:+p.z.toFixed(1),aboveDirt:+(p.y-Math.max(dirtTop(p.x,p.z),-50)).toFixed(2),fov:+cam.fov.toFixed(1),shot:shot?shot.type+(shot.why?":"+shot.why:""):"",shadows:SHADOWS,shHalf:shHalf,weakGPU:weakGPU}; };
  V.setShadows=function(on){ setShadows(on); };
  V.fixPR=function(p){ prCap=p; pr=p; renderer.setPixelRatio(p); renderer.setSize(W,H,false); V.prFixed=true; };
  V.dispose=function(){ V.stop(); if(world) disposeTree(world.root); if(R) disposeTree(R.grp); renderer.dispose(); cv.remove(); };
  V.renderer=renderer; V.scene=scene; V.camera=cam;
  V._dbg={riders:()=>R,gate:()=>gate,world:()=>world,marshal:()=>marshal,target:()=>cTarget.clone(),sees:(a,b)=>sees(a,b),dirt:(x,z)=>dirtTop(x,z),hf:(x,z)=>world.ctx.hf?world.ctx.hf(x,z):null,yellow:()=>yellow,shot:()=>shot};   /* tests only */
  return V;
}
