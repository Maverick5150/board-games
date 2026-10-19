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
   API (game.js): supported(); create(host, hooks {onLap(n), onFinish(), lost(), shown(kind, info)}) -> V: V.setRace(o), V.gate(), V.drop(), V.lap(result) -> show
   {at(name): Promise (holeshot | pass | crash | yellow | line | done)}, V.hold(o), V.standings(order, cnt, lap), V.setFlag(k), V.setRed(s),
   V.markOut(s), V.show(on), V.resize(), V.skip(), V.state(), V.stats(), V.shot(name) (tests).
   THE FILE SPLIT (2026-10-17, no visual change): this file is the view's core (create(), the race state machine, rider motion and the cards
   sync, crash scripts, the frame loop). Everything a specialist owns lives in its own module and is created / called from a marked hook
   zone ("// [hook:<role>]" ... "// [/hook:<role>]") here: r3d-util.js (shared helpers), r3d-look.js (renderer settings, lights, fog, the post
   slot), r3d-quality.js (adaptive pixel ratio, weak GPU), r3d-track.js (the dirt surface), r3d-world.js (the stadium and everything round
   the track), r3d-bike.js, r3d-riders.js, r3d-fx.js (roost, dust), r3d-cams.js (the director and every camera). See CONTRACT.md. */
import * as THREE_NS from "../ui/vendor/three-0.160.0.module.min.js";
import {clamp,sstep,now,clear,MX_KEEP} from "./r3d-util.js";
import {isTV,motionMode,createQuality} from "./r3d-quality.js";
import {createLook} from "./r3d-look.js";
import {buildWorld,gateBuild,flaggerBuild,flagTex} from "./r3d-world.js";
import {createRiders,poseRider,hideRider,shadowAt,tagAt,commit,setRed as atlasRed} from "./r3d-riders.js";
import {BIKE} from "./r3d-bike.js";
import {createFx} from "./r3d-fx.js";
import {createCams} from "./r3d-cams.js";
const THREE=THREE_NS;
const GL=typeof window!=="undefined"?window:globalThis;
const MX=GL.MXWar;
const G=9.81, PI=Math.PI, GRATE=0.16;

/* WebGL2 is required (the riders' GPU skinning reads bone matrices with texelFetch from a float data texture, the dirt and the post chain use half-float targets): a WebGL1-only device runs the 2D track instead.
   ?gl=0 in the page's address forces that fallback (tests, a device that misbehaves). */
export function supported(){
  try{ if(/[?&]gl=0(&|$)/.test(GL.location.search)) return false; const c=document.createElement("canvas"); return !!(GL.WebGL2RenderingContext&&c.getContext("webgl2")); }catch(e){ return false; }
}

export function create(host,hooks){
  hooks=hooks||{};
  const tv=isTV, motion=motionMode;   /* (r3d-quality.js) */
  let LO=motion()!=="full";
  /* ---------------- renderer, look, quality ---------------- */
  // [hook:perf]
  const QUAL=createQuality({host:host,lo:LO,setShadows:on=>LOOK.setShadows(on),shadowsOn:()=>LOOK.shadows,W:()=>W,H:()=>H,resized:(w,h,p)=>LOOK.resize(w,h,p),redraw:()=>{ if(C&&!V.lost) LOOK.render(scene,cam); }});   /* the renderer, the tier (GPU class + probe + ?quality=), anisotropy, the adaptive ladder (r3d-quality.js) */
  const renderer=QUAL.renderer;
  /* THE FRAME CAP: a 30 fps target (FIRE TV always; BALANCED on a TV) draws every second vsync (an even 33 ms cadence instead of a 16 / 33 / 50 ms mix, and the GPU idles half the time: a Fire TV Stick throttles when it
     runs hot). Done by shadowing requestAnimationFrame inside this view: the loop (tick, start) calls this one; QUAL.skipFrame(t) says "not this time" and the request is simply renewed. 60 fps targets, tests (fixed ratio) and the harness are untouched. */
  const requestAnimationFrame=cb=>GL.requestAnimationFrame(t=>{ if(QUAL.skipFrame(t)){ requestAnimationFrame(cb); return; } cb(t); });
  let lastRace=null, builtTier="";   /* the last setRace argument and the tier key the current world was built with (V.setQuality rebuilds when they differ) */
  let warmPending=false, raceGen=0;   /* the shader warm-up (r3d-perf-warm.js): owed by every new race; raceGen stops a warm that belongs to a race already replaced */
  /* THE WARM HOLD (milestone 2 merge, perf REQUEST 2 / director note N7): in the game a new race draws NOTHING and its clock waits until V.warm() has compiled its shaders in parallel,
     so no frame waits for a program and the page never blocks on a compile (HIGH on this laptop: one 12.7 s task entering the race). The stadium's environment capture waits too
     (LOOK.apply deferEnv, then LOOK.envCapture()), and V.drop() waits for the warm. A caller that never calls V.warm() is released on the next task (the old behaviour). The capture page
     (demo.html) warms synchronously inside setRace and never holds, unless ?warm=async (tools that test the game's own path). drawHold = holding; warmHold = that warm's Promise. */
  let drawHold=false, warmHold=null;
  const holdWanted=()=>!GL.DEMO||/[?&]warm=async/.test(GL.location.search);
  // [/hook:perf]
  const LOOK=createLook(renderer,{shadows:QUAL.shadowsWanted(LO),lo:LO,tv:tv(),weak:QUAL.weakGPU,host:host});   /* colour space, tone mapping, shadow map, the light rig, fog, the environment map, the post chain, the quality flags (r3d-look.js) */
  const scene=LOOK.scene, SUN=LOOK.SUN;   /* SUN = the sun's direction (LOOK.apply updates it for each venue) */
  const cv=renderer.domElement; cv.className="mx-v3__cv"; cv.setAttribute("aria-hidden","true"); host.appendChild(cv);
  const V={lost:false};
  // [hook:harness]
  V.camHook=null;   /* the capture harness (demo.js) sets V.camHook=function(dt,riders,T){ return null | {eye:[x,y,z],target:[x,y,z],fov} } to place the camera; null = the director's */
  // [/hook:harness]
  Object.defineProperty(V,"prFixed",{get:()=>QUAL.fixed,set:v=>{ QUAL.fixed=!!v; },enumerable:true});   /* (tests freeze the pixel-ratio ladder with V.prFixed = true; V.fixPR(p) does it too) */
  cv.addEventListener("webglcontextlost",e=>{ e.preventDefault(); V.lost=true; V.stop(); if(hooks.lost) hooks.lost(); },false);
  const cam=new THREE.PerspectiveCamera(50,1,0.5,4200);
  let W=0,H=0;
  /* ---------------- state ---------------- */
  let C=null, look=null, world=null, worldKey="", R=null, FX=null, rs=[], N=0, list=[], gate=null, flagger=null, marshal=null;
  let T=0, lapNo=1, lenLaps=30, mode="idle", show=null, holdInfo=null, flag=null, running=false, want=false, raf=0, lastT=0, yellow=null, lapPlan=null, finished=false, stillT=0;
  let meSeats=[], redSeat=-1, lappedK=[], shownHs=false;   /* (the announcers' seam, hooks.shown: lappedK = how many laps down each rider was last seen, shownHs = the holeshot was called) */
  const texFlags={};
  const stats={frames:0,ms:0,msMax:0,calls:0,tris:0,fpsT0:now(),fpsN:0,fps:0,ft:[]};
  const tmpO={}, tmpO2={}, q=new THREE.Quaternion(), eul=new THREE.Euler(0,0,0,"YZX"), v3=new THREE.Vector3(), sc1=new THREE.Vector3(1,1,1);

  /* ---------------- the cameras (r3d-cams.js) read the view's LIVE state through VIEW (getters: always the current value) ---------------- */
  // [hook:cams]
  const VIEW={cam:cam,leaderIdx:leaderIdx,
    get C(){ return C; }, get world(){ return world; }, get rs(){ return rs; }, get gate(){ return gate; }, get marshal(){ return marshal; },
    get T(){ return T; }, get lapNo(){ return lapNo; }, get lenLaps(){ return lenLaps; }, get mode(){ return mode; },
    get holdInfo(){ return holdInfo; }, get yellow(){ return yellow; }, get lapPlan(){ return lapPlan; }, get meSeats(){ return meSeats; },
    get W(){ return W; }, get H(){ return H; },
    /* read-only views for the cameras' own needs: the per-rider state (lean, pitch, stance), the riders' and the particles' meshes (the replay
       draws copies of them from recorded frames), the flag, a finished race, a TV screen */
    get st(){ return RST; }, get R(){ return R; }, get FX(){ return FX; }, get flag(){ return flag; }, get finished(){ return finished; }, get tv(){ return tv(); },
    get replayOK(){ return QUAL.options(LO).replay!==false; }};   /* the replay ring is about 30 MB: not on the FIRE TV tier (r3d-quality.js, flag replay) */
  const CAMS=createCams(VIEW);
  /* the camera presets for the remote / phone button (game.js calls these; nothing here changes the race): V.camModes() -> [{id, name}], V.camMode(id?) -> the mode (sets it when given),
     V.camNext() -> the next mode, V.camReplay() -> true when a replay started (a slow-motion replay of the last few seconds, drawn from recorded frames: render time only), V.camState() -> {mode, shot, replay, replays, rec, recMB} (the HUD shows a REPLAY badge while replay is true) */
  V.camModes=function(){ return CAMS.modes(); }; V.camMode=function(m){ return CAMS.mode(m); }; V.camNext=function(){ return CAMS.nextMode(); }; V.camReplay=function(){ return CAMS.replayNow(); }; V.camState=function(){ return CAMS.state(); };
  // [/hook:cams]

  /* ---------------- the per-rider state the modules read every frame (CONTRACT.md "Per-rider state"): one object per rider, refilled in
     rider() / crashPose(); read-only for everyone but the zones marked [hook:...] below ---------------- */
  let RST=[];
  function newState(k,r0){ return {i:k,seat:r0.s,me:!!r0.me,red:!!r0.red,visible:true,
    x:0,y:0,z:0,th:0,yaw:0,pitch:0,lean:0, v:0,acc:0,throttle:0,slip:0,roost:0, lat:0,s:0,D:0,onStart:true,k:0,tag:"",sand:0,gate:false,
    air:false,landed:false,impact:0,hAir:0,gF:0,gR:0,tF:0,tR:0,gy:0, compF:0,compR:0,spinF:0,spinR:0, stand:0,dab:0,crouch:0, mud:0, crash:null,body:null,limbs:null}; }
  /* a fallen rider's state: the bike where it lies (bx, by, bz, heading bth), the rider's hip where he is (hx, hy, hz) */
  function crashState(i,c,t,bx,by,bz,bth,hx,hy,hz){
    const st=RST[i]; st.visible=true; st.x=bx; st.y=by; st.z=bz; st.th=bth; st.yaw=-bth; st.pitch=0; st.lean=0; st.v=0; st.acc=0; st.throttle=0; st.slip=0; st.roost=0;
    st.air=false; st.landed=false; st.impact=0; st.gate=false; st.hAir=0; st.gy=by; st.crash={kind:c.kind,t:t,hx:hx,hy:hy,hz:hz};
  }

  /* ---------------- the round -> the course and the world (built once per layout) ---------------- */
  V.setRace=function(o){
    // [hook:perf]
    lastRace=o; raceGen++; warmPending=true; drawHold=holdWanted(); warmHold=null;
    const lo=motion()!=="full"; if(lo!==LO){ LO=lo; worldKey=""; LOOK.setShadows(QUAL.shadowsWanted(LO)); if(typeof driveLook==="function") driveLook(); }   /* Reduce effects changed: the next race is built simpler (or richer), the shadows follow */
    // [/hook:perf]
    const pick=MX.Layouts.pick(o.series,o.year,o.round,o.cal||{});
    // [hook:perf]
    const key=pick.layout.id+"|"+(pick.look.around)+"|"+(LO?"lo":"hi")+"|"+(o.lapT>0?Math.round(o.lapT):"")+"|"+QUAL.buildKey(LO);   /* what makes a world new: the layout, its look, Reduce effects, the round's lap time, the quality tier's build flags */
    // [/hook:perf]
    if(key!==worldKey){
      if(world){ disposeTree(world.root); scene.remove(world.root); }
      C=MX.Course.build(pick.layout); look=pick.look; worldKey=key;
      /* the round's real average lap (the timing research), when it differs: the speeds tuned to it, within believable bounds */
      if(o.lapT>0&&Math.abs(C.Tlap/o.lapT-1)>0.04){ const want=clamp(o.lapT,C.Tlap*0.87,C.Tlap*1.15); C=MX.Course.build(Object.assign({},pick.layout,{vavg:C.L/want})); }
      // [hook:perf]
      world=buildWorld(C,look,QUAL.options(LO)); scene.add(world.root); builtTier=QUAL.buildKey(LO); QUAL.fitTextures(world.root);   /* the quality options (r3d-quality.js); canvas textures over the tier's size are shrunk */
      // [/hook:perf]
      // [hook:cams]
      CAMS.buildGrid();   /* the grid of the dirt's heights: no camera ever sits inside a jump */
      // [/hook:cams]
      LOOK.apply(C,look,world,{lo:LO,tv:tv(),deferEnv:drawHold});   /* the venue's lights, exposure, sun disc, fog, environment map and the look's quality tier (r3d-look.js); deferEnv: the stadium's environment capture waits for the warm (the warm hold) */
      // [hook:stadium]
      const flo=!!QUAL.options(LO).lo;   /* the simple world (FIRE TV, Reduce effects): coarser flagger figures */
      flagger=flaggerBuild(flagT("white"),{lo:flo}); flagger.grp.position.copy(world.fin.flagAt).add(v3.set(0,-0.02,0)); flagger.grp.rotation.y=-world.fin.th+(world.fin.side>0?PI:0); world.root.add(flagger.grp);
      marshal=flaggerBuild(flagT("yellow"),{marshal:true,lo:flo}); marshal.grp.visible=false; world.root.add(marshal.grp);
      // [/hook:stadium]
    }
    V.layout=pick; V.courseInfo={id:C.id,L:+C.L.toFixed(1),Tlap:+C.Tlap.toFixed(1),D1:+C.D1.toFixed(1),T1:+C.T1.toFixed(1),kind:C.kind,shared:pick.shared,name:pick.layout.name};
    if(R){ disposeTree(R.grp); scene.remove(R.grp); }
    // [hook:fx]
    if(FX){ if(FX.dispose) FX.dispose(); disposeTree(FX.group); scene.remove(FX.group); }
    // [/hook:fx]
    list=o.riders.map((r,k)=>({s:r.s!=null?r.s:k,color:r.color,accent:r.accent,num:r.num,name:r.name,red:!!r.red,me:!!r.me}));
    N=list.length; meSeats=list.filter(r=>r.me).map(r=>r.s); redSeat=(list.find(r=>r.red)||{s:-1}).s;
    R=createRiders(list,QUAL.options(LO)); scene.add(R.grp); LOOK.upgrade(R.grp); LOOK.receive(R.grp);   /* physically based stand-ins for Phong parts; the body parts receive the key's shadow (r3d-look.js) */
    // [hook:fx]
    FX=createFx(Object.assign({C:C,look:look,cam:cam},QUAL.options(LO))); scene.add(FX.group);   /* the roost and dust particles: a new system for every race (r3d-fx.js) */
    // [/hook:fx]
    if(gate){ world.root.remove(gate.grp); disposeTree(gate.grp); }
    gate=gateBuild(C,look,N); world.root.add(gate.grp);
    // [hook:motion]
    gridBuild();   /* the start grid: fixed slots in staggered rows inside the start's width (gridLat / gridBack) */
    rs=list.map((r,k)=>({k:k,seat:r.s,g:0,tg:null,boot:null,lat:gridLat(k),latT:gridLat(k),bias:(((k*7919)%11)/10-0.5)*0.7,D:-0.95-gridBack(k),Dp:-0.95-gridBack(k),s:0,onStart:true,v:0,vp:0,
      F:{y:0,v:0},Rr:{y:0,v:0},stand:0,lean:0,dab:0,spinF:0,spinR:0,gone:false,crash:null,crashPlan:null,air:false,init:false,lapN:1,
      Dl:-0.95-gridBack(k),P:-gridBack(k),sb:0,vl:0,al:0,alF:0,psi:0,psiHold:0,sd:{},jF:null,jR:null,jDone:null,czone:0,rem:false}));
    // [/hook:motion]
    RST=list.map((r0,k)=>newState(k,r0));
    lenLaps=o.len||30; lapNo=1; T=0; holdInfo=null; flag=null; yellow=null; lapPlan=null; finished=false; show=null; lappedK=[]; shownHs=false;
    // [hook:cams]
    CAMS.reset();
    // [/hook:cams]
    // [hook:stadium]
    if(world.ctx.screen) world.ctx.screen(0,lenLaps,null);
    // [/hook:stadium]
    gate.set(0); gate.drop=0; gate.dropT=-1; V.setFlag(null); marshal.grp.visible=false;
    mode="gate"; CAMS.setShot({type:"gate",subj:-1,pri:0,min:1e9,max:1e9});
    V.resize(); renderOnce();
    // [hook:perf]
    if(drawHold){ const g=raceGen; setTimeout(()=>{ if(drawHold&&!warmHold&&g===raceGen) releaseHold(); },0); }   /* (nobody called V.warm() in the same task: draw as before) */
    // [/hook:perf]
    return V.courseInfo;
  };
  // [hook:motion]
  /* THE START GRID (the motion specialist, milestone 2). The old grid put 22 riders in ONE row of 0.9 m slots on a gate wider than the start
     (19.8 m on a 17 m start): the outer slots were clamped onto each other (riders 17, 19, 21 stood in one spot) and slotOf() sent rider 21 to
     rider 19's slot. Now: fixed slots in staggered rows (one row up to 11 riders; 22 = two rows of 11), the slots spread evenly inside the start's
     usable width (half width - 0.55 m), the second row 2.3 m behind the first and offset half a pitch (it launches through the gaps), the middle
     slots first (k = 0 in the middle, then alternating outward). gridLat(k) = the slot's lateral offset (+ right), gridBack(k) = metres behind
     the front row. */
  let GRID=null;
  function gridBuild(){
    let hwG=8; try{ hwG=(C.S&&C.S.n?MX.Course.startFrame(C,C.gateAt||2,{}):MX.Course.frame(C,C.join+(C.gateAt||0),{})).hw; }catch(e){}
    const use=Math.max(1.5,hwG-0.6), rows=N<=11?1:Math.max(2,Math.ceil(N/Math.max(2,Math.floor(2*use/1.3)+1))), per=Math.ceil(N/rows);
    const P=Math.min(2.0,2*use/Math.max(1,per-1+(rows>1?0.5:0))), lat=[], back=[];
    for(let k=0;k<N;k++){ const row=k%rows, c=Math.floor(k/rows), pos=(c%2?1:-1)*Math.ceil(c/2);
      lat.push(clamp(pos*P+(rows>1?(row/(rows-1)-0.5)*P*0.5:0),-use,use)); back.push(row*1.0); }   /* the second row 1.0 m back, half a pitch over (an echelon: footprints touch, never overlap) */
    const rank=[]; lat.map((l,k)=>[l,k]).sort((x,y)=>(x[0]-y[0])||(x[1]-y[1])).forEach((v,j)=>{ rank[v[1]]=j; });   /* each slot's place across the track, left to right */
    GRID={lat:lat,back:back,hwG:hwG,use:use,rows:rows,P:P,rank:rank};
  }
  function gridLat(k){ return GRID&&GRID.lat[k]!=null?GRID.lat[k]:0; }
  /* level riders: the one ahead in the cards' order of this lap (V.lap) goes first; before any cards, the logical distance, then the grid */
  function rightOf(o,r){ const a=o.cr!=null?o.cr:1e3, b=r.cr!=null?r.cr:1e3; if(a!==b) return a<b; return o.Dl>r.Dl||(o.Dl===r.Dl&&o.k<r.k); }
  function gridBack(k){ return GRID&&GRID.back[k]!=null?GRID.back[k]:0; }
  /* which side of rider o rider r keeps (+1 = his right): the side he is on (natural hysteresis); right behind him, the side he chose for this
     pass while it lasts (1.6 s memory), else toward his own line, else toward the room */
  function sideOf(r,o,target,ia,ib){
    const dl=r.lat-o.lat, m=r.sd||(r.sd={}), rec=m[o.k];
    if(Math.abs(dl)>0.3){ const s=dl>0?1:-1; m[o.k]={s:s,T:T}; return s; }
    if(rec&&T-rec.T<1.6){ rec.T=T; return rec.s; }
    const s=Math.abs(target-o.lat)>0.25?(target>o.lat?1:-1):((ib-o.lat)>=(o.lat-ia)?1:-1);
    m[o.k]={s:s,T:T}; return s;
  }
  function slotOf(k){ const n=gate.slots, mid=Math.floor(n/2); return clamp(mid+(k%2?1:-1)*Math.ceil(k/2),0,n-1); }   /* (kept for reference; the grid above replaces it) */
  const SEP=1.2;
  function passLine(r,a,ord,target,ia,ib,blk){
    let lo=ia, hi=ib; const bad=[], mem=r.sd||(r.sd={});
    for(let b=0;b<ord.length;b++){ const o=ord[b]; if(o===r||o.crash) continue;
      const dD=o.D-r.D; if(dD<-1.6||dD>10) continue;
      if(dD<2.2){ /* level: never crossed */
        let sd=r.lat-o.lat; if(Math.abs(sd)<0.02){ const m=mem[o.k]; sd=m&&T-m.T<1.6?m.s:(r.k<o.k?-1:1); }
        if(sd>0) lo=Math.max(lo,o.lat+SEP); else hi=Math.min(hi,o.lat-SEP);
        mem[o.k]={s:sd>0?1:-1,T:T}; continue; }
      if(b>a) continue;
      const cl=Math.max(0,(r.v||0)-(o.v||0)), m=mem[o.k], want=r.sb>0.05||r.Dl>o.D-3.2;
      if((want&&dD<5+cl*1.4)||(m&&T-m.T<1.6&&dD<6)) bad.push(o); }
    if(lo>hi) return (lo+hi)/2;   /* squeezed between two level riders: the middle (the setback sorts out the rest) */
    /* the free gaps between the riders to pass, inside [lo, hi] */
    const iv=bad.map(o=>[o.lat-SEP,o.lat+SEP]).concat(blk?blk.map(v=>[v[0],v[1]]):[]).sort((x,y)=>x[0]-y[0]), gaps=[]; let c0=lo;   /* (a fallen rider or bike: an interval too) */
    for(const v of iv){ if(v[0]>c0) gaps.push([c0,Math.min(v[0],hi)]); c0=Math.max(c0,v[1]); if(c0>=hi) break; }
    if(c0<hi) gaps.push([c0,hi]);
    if(!gaps.length) return clamp(target,lo,hi);
    let best=null, bc=1e9;
    for(const g of gaps){ if(g[1]<g[0]) continue; const p=clamp(target,g[0],g[1]);
      let cost=Math.abs(p-target)+0.8*Math.abs(p-r.lat);
      for(const o of bad){ const m=mem[o.k]; if(m&&T-m.T<1.6&&(p>o.lat?1:-1)!==m.s) cost+=2.5; }   /* a pass keeps its side */
      if(cost<bc){ bc=cost; best=p; } }
    if(best==null) return clamp(target,lo,hi);
    for(const o of bad) mem[o.k]={s:best>o.lat?1:-1,T:T};
    return best;
  }
  // [/hook:motion]
  function flagT(k){ return texFlags[k]||(texFlags[k]=flagTex(k)); }
  /* free a world or a rider set: geometries, materials and every texture they hold (normal and glow maps, shader uniforms too: a new
     layout each round must not leave the old one's textures on the GPU) */
  function disposeTree(o){ o.traverse(m=>{ if(m.geometry) m.geometry.dispose(); if(m.material){ const ms=Array.isArray(m.material)?m.material:[m.material]; ms.forEach(x=>{
    if(!x.userData||!x.userData.keepMaps) ["map","normalMap","emissiveMap","alphaMap"].forEach(k=>{ if(x[k]) x[k].dispose(); });
    if(x.uniforms) Object.values(x.uniforms).forEach(u=>{ if(u&&u.value&&u.value.isTexture) u.value.dispose(); });
    x.dispose(); }); } }); }

  /* ---------------- the clock, the laps, the gaps ---------------- */
  function lapStartT(n){ return MX.Course.tOfD(C,MX.Course.lapStartD(C,n)); }
  function tauOf(i){ const r=rs[i]; if(r.crash) return r.crash.tau; return LIVE?liveTau(r):T-r.g; }   /* (LIVE: the time model's clock places him: [hook:live] below) */
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
  // [hook:live]
  /* THE LIVE SEAM (the game's integration, mxlive 2026-10-18; not part of the view's development branch: BG_audit/sprint/mxlive/sync-view.sh carries every
     [hook:live] zone over a re-sync). A race of the TIME MODEL (mxwar/time.js, MXWar.Time; TIME-MODEL.md section 8, the view contract) is placed by ITS race
     clock instead of this view's own lap clock and the cards' gaps: V.setModel(G, {clock}) with G = the race (G.tm) and clock() = the race clock in ms (the
     game's own: track.js model mode, which fires the game's events too; the Party host's the same). Every frame every rider is where MXWar.Time says he is at
     that clock (walker.at: laps + phase, a crash hold, the yellow section), put on the track through this course's own speed profile (equal phase = the same
     point for everybody: lap 1's phase is the share of the standing-start lap's time C.T1, every other lap's the share of C.Tlap). So the order on the track IS
     the timing tower's; a rider crosses the line when the model says; goes down where and when it says (the crash is planned as soon as the lap's knots are
     known: the bike goes down a slide's length before the model's crash point and comes to rest ON it; a lost double war: down for the model's hold, the crash
     script slowed to fill it, back on the bike and away with a soft start centred on the model's restart, never more than A_RAMP / 4 of course time from it);
     stays down (a lost triple war); pulls off out of cards; and the yellow flag flies over the section for the model's window. The motion layer still spaces the pack (setbacks, lateral lines), so a drawn swap can lag the tower by a bike length. The laps,
     the flags and the finish follow the clock, hooks.onLap is not called (the game's clock turns the cards); hooks.shown reports the holeshot, the crashes,
     the passes into the top 10 (the tower's order), the lapped riders and the checkered flag as the picture shows them. V.setModel(null): the view's own lap
     clock again (V.lap). */
  let LIVE=null;
  const A_RAMP=1.2, SBMAX=6;
  /* the course time of a progress (laps + phase): the model's phase on this course's speed profile. Lap 1 in two parts, so the model's funnel into turn 1 (its phase t1) is
     THIS course's turn 1 (the end of the start, C.hsD): the gate -> turn 1 and turn 1 -> the line each the share of their own course time */
  function tauPr(pr){
    if(pr<=0) return 0; if(pr>=1) return C.T1+(pr-1)*C.Tlap;
    const t1=LIVE&&LIVE.G.tm&&LIVE.G.tm.t1>0&&LIVE.G.tm.t1<0.5?LIVE.G.tm.t1:0.12, th=clamp(MX.Course.tOfD(C,C.hsD),0.05*C.T1,0.6*C.T1);
    return pr<=t1?pr/t1*th:th+(pr-t1)/(1-t1)*(C.T1-th);
  }
  /* the remount's soft start: on the bike where it lies (course time tb) until tR - a, then from rest up to the model's pace (rho: course s per race s) by tR + a, where
     he is exactly where the model has him; tR = the model's restart, later by the time the model needs to reach the bike when it slid past his crash point */
  function liveTau(r){
    const m=r.rmt;
    if(m){ const x=T-m.tR; if(x>=m.a) r.rmt=null; else return m.tb+m.rho*(x<=-m.a?0:(x+m.a)*(x+m.a)/(4*m.a)); }
    return tauPr(r.mpr||0);
  }
  function liveAt(pr){ return MX.Course.atD(C,MX.Course.dOfT(C,tauPr(pr)),{}); }   /* where a progress is: {lap, s (loop position), onStart} */
  /* a crash the model has (a hold = a lost double war, a crash-out = a lost triple war). PLANNED (livePlanOf: the usual case, the lap's knots are known well before
     he gets there): the motion zone starts it a slide's length before the model's crash point and liveStep then sets the slide so the bike stops ON that point.
     UNPLANNED (liveCrash: a race picked up again in a hold, a crash on the start path, a rider held back past his planned spot): it starts at the model's moment
     (t0, ms) at the model's place and the bike slides on a little. A remount is down until t1. A crash picked up long after it happened has no burst of dirt
     and no camera cut. */
  const slideOf=v=>v*v/15;   /* the crash script's bike slide for its speed v0 (crashPose: v0 t - 3.75 t^2 to t = v0 / 7.5) */
  function livePlanOf(r,Rm,k){
    r.lastK=k;
    const h=Rm.hold[k], d=Rm.dnf&&Rm.dnf.why==="crash"&&Rm.dnf.lap===k?Rm.dnf:null; if(!h&&!d) return;
    const ph=d?d.at:h[0], Dc=MX.Course.dOfT(C,tauPr(k-1+ph)), v=clamp(MX.Course.vOfD(C,Dc)*(LIVE.rate||1),6,10), Ds=Dc-slideOf(v), at=MX.Course.atD(C,Math.max(0,Ds),{});
    if(at.onStart||Ds<r.D+2) return;
    let w=null; try{ w=MX.Time.holdWindow(LIVE.G,r.seat,k); }catch(e){ w=null; }
    r.crashPlan={kind:d?"out":"remount",s:at.s,lap:at.lap,side:((r.seat*31+k-1)%2)?1:-1};
    r.livePlan={k:k,ph:ph,Dc:Dc,kind:d?"out":"remount",h0:w?w[0]:null,h1:w&&isFinite(w[1])?w[1]:null};
  }
  function liveCrash(i,kind,t0,t1){
    const r=rs[i], ct=LIVE.ct; r.lastH0=t0; r.rmt=null; r.livePlan=null;
    if(!r.crash){
      r.crashPlan={kind:kind,s:r.s,lap:r.lapN,side:((r.seat*31+Math.floor(r.mpr||0))%2)?1:-1};
      if(ct-t0<2500) beginCrash(i);
      else { const c=r.crashPlan; r.crashPlan=null; r.tg=null; r.crash={T:T,lap:lapNo,kind:kind,tau:0,D:0,side:c.side,v0:Math.max(6,r.v||MX.Course.vOfD(C,Math.max(0,r.D))),lat:r.lat,down:1e9,th:r.fr?r.fr.th:0,fx:0}; }
    }
    const c=r.crash; if(!c) return;
    c.T=t0/1000; c.tau=tauPr(r.mpr||0); c.D=Math.max(0,MX.Course.dOfT(C,c.tau)); c.lap=Math.floor(r.mpr||0)+1;
    c.v0=Math.min(c.v0,10);   /* the bike slides at most about 6.7 m: the remount (from where it lies) stays within a few tenths of the model's restart */
    if(kind==="remount"){ c.h1=t1/1000; c.down=Math.max(1.5,c.h1-A_RAMP-c.T); c.ex=Math.max(0,c.down-4.6); } else { c.down=1e9; c.ex=0; }   /* on the bike again A_RAMP before the model's restart (he lies longer to fill the hold) */
  }
  /* the crash script's clock: a long hold stretches the half second he lies face down (1.4..1.9 s of the script); the rest runs as written */
  function crashT(c){ let t=T-c.T; const ex=c.ex||0; if(ex>0&&t>1.4) t=t<1.9+ex?1.4+(t-1.4)*0.5/(0.5+ex):t-ex; return t; }
  function liveYellow(ct){
    const tm=LIVE.G.tm;
    if(LIVE.yk!==tm.k){ LIVE.yk=tm.k; try{ LIVE.yw=MX.Time.yellowWindows(LIVE.G); }catch(e){ LIVE.yw=[]; } }
    let on=null; for(const y of LIVE.yw){ if(y.from!=null&&ct>=y.from&&(y.to==null||ct<y.to)){ on=y; break; } }
    if(on){ if(!yellow||yellow.lap!==on.lap||yellow.c!==on.c){ const s=liveAt(on.lap-1+on.c).s, s0=liveAt(on.lap-1+on.c-on.z).s, s1=liveAt(on.lap-1+on.c+on.z).s;
        yellow={lap:on.lap,s:s,s0:s0,len:Math.max(4,MX.Course.wrap(C,s1-s0)),c:on.c}; marshalAt(s); } }
    else if(yellow){ yellow=null; if(marshal&&!rs.some(r=>r.crash)) marshal.grp.visible=false; }
  }
  /* one frame on the model's clock: T, every rider's progress and state, the crashes ahead (the director's "crash about to happen"), the crashes, the remounts,
     the pits, the laps, the yellow flag, the finish, the passes */
  function liveStep(dt){
    const tm=LIVE.G.tm, W=LIVE.walk; if(!tm||!W) return;
    const ct=Math.max(0,+LIVE.clock()||0), jump=LIVE.ct>=0&&Math.abs(ct-LIVE.ct)>1500;   /* a jump of the clock (a race picked up again, reduced motion, a long pause): placed at once */
    if(dt>0&&LIVE.ct>=0&&!jump) LIVE.rate+=(clamp((ct-LIVE.ct)/(dt*1000),0,12)-LIVE.rate)*Math.min(1,dt/0.4);   /* the clock's rate (race s per wall s, smoothed): 1 in the game, 0 while it waits */
    LIVE.ct=ct; T=ct/1000;
    let lp=-1;
    for(let i=0;i<N;i++){
      const r=rs[i], Rm=tm.r[r.seat]; if(!Rm) continue;
      let pr=W.at(r.seat,ct); const st=W.state;
      if(st==="fin"&&Rm.fin) pr+=(ct-Rm.fin.t)/(tm.p*1000/0.55);   /* past his flag he rolls on, cooling down (as the 2D track does) */
      r.mpr=pr; r.mst=st;
      if(jump) r.init=false;
      if(r.gone) continue;
      const LP=r.livePlan;
      if(LP&&r.crash&&!r.crash.live){   /* a planned crash the motion zone has just started: the bike stops ON the model's crash point, down until its restart */
        const c=r.crash; c.live=true; c.v0=clamp(Math.sqrt(15*Math.max(0.5,LP.Dc-c.D)),3,10); c.lap=LP.k; c.tau=tauPr(LP.k-1+LP.ph);
        if(LP.kind==="remount"&&LP.h1!=null){ c.h1=LP.h1/1000; c.down=Math.max(1.5,c.h1-A_RAMP-c.T); c.ex=Math.max(0,c.down-4.6); r.lastH0=LP.h0; } else { c.down=1e9; c.ex=0; r.outSeen=true; }
        r.livePlan=null; }
      if(st==="down"&&W.h0!==r.lastH0&&!(r.crash&&r.crash.kind==="out")) liveCrash(i,"remount",W.h0,W.h1);
      else if(st==="out"&&!r.outSeen){ r.outSeen=true; liveCrash(i,"out",Rm.dnf&&Rm.dnf.t!=null?Rm.dnf.t:ct,1e12); }
      else if(st==="pits"&&!r.crash){ r.gone=true; continue; }   /* out of cards: he pulls off at the line */
      else if(st==="run"&&!r.crash&&!r.crashPlan&&r.lastK!==Math.floor(pr)+1) livePlanOf(r,Rm,Math.floor(pr)+1);   /* a crash ahead on this lap: planned (the director looks ahead with it) */
      const c=r.crash;
      if(c&&c.kind==="remount"&&T-c.T>=c.down&&!r.rmt){   /* (the motion zone puts him back on the bike this frame, where it lies): the soft start, timed on the model's restart */
        const tb=MX.Course.tOfD(C,c.D+slideOf(c.v0)), h1=c.h1!=null?c.h1:T+A_RAMP; let rho=C.Tlap/Math.max(1,tm.p);
        try{ const q0=W.at(r.seat,h1*1000+500), q1=W.at(r.seat,h1*1000+1500); if(q1>q0) rho=clamp(tauPr(q1)-tauPr(q0),0.2,4); }catch(e){}
        r.rmt={tb:tb,a:A_RAMP,rho:rho,tR:h1+Math.max(0,tb-(c.tau||tb))/rho}; }
      if(!r.crash&&(st==="run"||st==="fin")&&pr>lp) lp=pr;
    }
    /* the cards' order for level riders (the motion zone's rightOf) = the model's order now */
    const ord=rs.filter(r=>!r.gone&&!r.crash&&r.mpr!=null).sort((a,b)=>(b.mpr-a.mpr)||(a.k-b.k));
    rs.forEach(r=>{ r.cr=1e3; }); ord.forEach((r,j)=>{ r.cr=j; });
    /* the passes the tower shows (a rider moves up into the top 10 past a rider who is riding): the announcers' calls land with them */
    if(!jump&&LIVE.ord&&dt>0){ const was=LIVE.ord; for(let j=0;j<Math.min(10,ord.length);j++){ const a=ord[j], ja=was.indexOf(a.seat), d=ord[j+1]; if(ja>j&&d&&was.indexOf(d.seat)>=0&&was.indexOf(d.seat)<ja) shown("pass",{s:a.seat}); } }
    LIVE.ord=ord.map(r=>r.seat);
    if(lp>=0){ const nl=clamp(Math.floor(lp)+1,1,lenLaps); if(nl>lapNo||jump){ lapNo=nl; if(world.ctx.screen) world.ctx.screen(lapNo,lenLaps,null); } }   /* the leader's lap (the big screen) */
    liveYellow(ct);
    if(!finished&&tm.done&&tm.flag!=null&&ct>=tm.flag){ finished=true; if(show) show.fire("done"); if(hooks.onFinish) setTimeout(()=>hooks.onFinish(),0); if(tm.win>=0) shown("checkered",{s:tm.win}); }
  }
  // [/hook:live]
  /* a lap's result: every rider rides from where they are to the new standings over the rest of the lap */
  V.lap=function(req){
    const S=makeShow();
    if(!C||!R){ S.fire("done"); return S; }
    if(show&&!show.ended) endShow();
    show=S; holdInfo=null; mode="race";
    const n=req.lap||lapNo;
    const alive=req.order1.filter(s=>!(req.dnf&&req.dnf.indexOf(s)>=0)&&rs[s]&&!rs[s].gone);
    const gg=MX.Course.gaps(alive,req.cnt1,C.Tlap,{base:0.5,extra:1.4});
    // [hook:motion]
    rs.forEach(r=>{ r.cr=1e3; }); alive.forEach((s,j)=>{ if(rs[s]) rs[s].cr=j; });   /* the cards' order this lap: who has the right of way when two riders are level */
    // [/hook:motion]
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
    // [hook:stadium]
    if(n>=2&&world.ctx.screen) world.ctx.screen(n,lenLaps,null);   /* the big screen: the lap */
    // [/hook:stadium]
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
  /* THE ANNOUNCERS' SEAM (milestone 2 merge): hooks.shown(kind, info) is called when the picture shows a moment the commentators call (the booth's booth.shown: the game
     wires it to annShown): "holeshot" {s} (the leader into turn 1 on lap 1), "pass" {s} (the lap winner's first pass), "crash" {s, kind} (the bike goes down), "lapped" {s, by}
     (the leader rides past a rider a lap down), "checkered" {s} (the winner takes the flag). s / by = the game's seats. Called after the frame (a timeout), never inside it. */
  function shown(kind,info){ if(hooks.shown) setTimeout(()=>{ try{ hooks.shown(kind,info); }catch(e){} },0); }
  function makeShow(){ const S={fired:{},waits:{},ended:false}; S.at=n=>S.fired[n]?Promise.resolve():new Promise(r=>(S.waits[n]=S.waits[n]||[]).push(r)); S.fire=n=>{ if(S.fired[n]) return; S.fired[n]=true; (S.waits[n]||[]).splice(0).forEach(f=>{ try{ f(); }catch(e){} }); }; S.done=S.at("done"); return S; }
  function endShow(){ if(!show) return; show.ended=true; ["holeshot","pass","crash","yellow","line"].forEach(k=>show.fire(k)); show.fire("done"); }
  function leaderIdx(){ let b=-1, bd=-1e9; rs.forEach((r,i)=>{ if(!r.gone&&!r.crash&&r.D>bd){ bd=r.D; b=i; } }); return b; }
  function trackRank(seat){ if(seat==null||seat<0||!rs[seat]) return -1; const D=rs[seat].D; let k=0; rs.forEach(r=>{ if(!r.gone&&r.D>D) k++; }); return k; }
  /* waiting on the cards (a person's flip, a war): the riders ride on; the director looks at the war's riders */
  V.hold=function(o){ holdInfo=o||null; };
  /* the standings without a result (a race restored mid-way): gaps set at once, the clock at the start of that lap */
  V.standings=function(order,cnt,n){
    if(!C) return;
    const alive=order.filter(s=>rs[s]&&!rs[s].gone), gg=MX.Course.gaps(alive,cnt,C.Tlap,{base:0.5,extra:1.4});
    rs.forEach((r,i)=>{ r.g=gg[i]!=null?gg[i]:r.g+3; r.tg=null; r.init=false; });
    lapNo=Math.max(1,n||1); T=lapStartT(lapNo)+0.05; mode="race"; finished=false; gate.set(1); gate.drop=1; gate.dropT=1; lappedK=[]; shownHs=lapNo>1;
    CAMS.pickShot(true); renderOnce();
  };
  V.markOut=function(seat){ const r=rs[seat]; if(r) r.gone=true; };
  // [hook:motion]
  V.gate=function(){ mode="gate"; gate.set(0); gate.drop=0; gate.dropT=-1; T=0; lapNo=1; rs.forEach((r,k)=>{ r.lat=gridLat(k); r.latT=r.lat; r.vl=0; r.al=0; r.alF=0; r.psi=0; r.sb=0; r.sd={}; r.jF=null; r.jR=null; r.jDone=null; r.rem=false; r.init=false; r.crash=null; r.crashPlan=null; r.g=0; r.tg=null; }); CAMS.setShot({type:"gate",subj:-1,pri:0,min:1e9,max:1e9}); renderOnce(); };
  // [/hook:motion]
  /* the gate drops: the pads fall, the clock starts (resolves once the riders are away) */
  V.drop=function(){
    // [hook:perf]
    if(drawHold&&warmHold){ const p=warmHold; return p.then(()=>V.drop(),()=>V.drop()); }   /* the warm hold: the gate drops once the race's shaders are ready */
    // [/hook:perf]
    return new Promise(res=>{
      if(!C){ res(); return; }
      mode="race"; lapNo=1; T=0; finished=false; gate.dropT=now(); lappedK=[]; shownHs=false;
      { const shot=CAMS.shot; if(shot&&shot.type==="gate"){ shot.min=2.6; shot.max=3.4; shot.pri=1; shot.t=0; } }
      if(motion()==="off"){ gate.set(1); renderOnce(); res(); return; }
      setTimeout(res,650);
    });
  };
  V.setFlag=function(k){ flag=k||null; if(flagger){ flagger.grp.visible=true; flagger.setTex(flagT(flag||"green")); } };
  V.setRed=function(seat){ if(seat===redSeat) return; redSeat=seat; list.forEach(r=>r.red=r.s===seat); if(R) atlasRed(R,list); };
  V.setSpeed=function(){ /* real time only (the CEO, 21:10): Game speed never changes the race */ };
  V.lapDone=function(){};
  V.skip=function(){ endShow(); rs.forEach(r=>{ r.crashPlan=null; }); finished=true; };
  // [hook:live]
  /* V.setModel(G, {clock}) -> true when the race has a time model: the view rides its clock from now on (see the live seam above); a race under way (picked up
     again, a new screen) is placed at once, the gate down. V.setModel(null): the view's own clock. V.model() -> on. V.liveState(): the tests' look at it. */
  V.setModel=function(G0,o){
    LIVE=G0&&G0.tm&&MX.Time&&MX.Time.walker?{G:G0,walk:MX.Time.walker(G0),clock:(o&&typeof o.clock==="function")?o.clock:()=>0,ct:-1,rate:1,yk:-1,yw:[],ord:null}:null;
    if(!C||!R) return !!LIVE;
    rs.forEach(r=>{ r.mpr=null; r.mst=null; r.lastH0=null; r.lastK=null; r.outSeen=false; r.rmt=null; });
    if(LIVE&&G0.phase!=="gate"){
      mode="race"; finished=false; holdInfo=null; lapPlan=null; show=null; lappedK=[]; yellow=null; gate.set(1); gate.drop=1; gate.dropT=1;
      if(marshal) marshal.grp.visible=false;
      rs.forEach(r=>{ r.init=false; r.tg=null; r.boot=null; r.crashPlan=null; r.crash=null; r.gone=false; });
      liveStep(0); shownHs=T>0; CAMS.pickShot(true); renderOnce();
    }
    return !!LIVE;
  };
  V.model=()=>!!LIVE;
  V.liveState=function(){
    if(!LIVE) return null;
    return {ct:LIVE.ct,lap:lapNo,len:lenLaps,mode:mode,finished:finished,yellow:yellow?{lap:yellow.lap,s:+yellow.s.toFixed(1),len:+yellow.len.toFixed(1)}:null,marshal:!!(marshal&&marshal.grp.visible),
      riders:rs.map(r=>({s:r.seat,pr:r.mpr!=null?+r.mpr.toFixed(4):null,st:r.mst,D:+r.D.toFixed(2),Dm:r.mpr!=null&&C?+MX.Course.dOfT(C,tauPr(r.mpr)).toFixed(2):null,sb:+(r.sb||0).toFixed(2),crash:r.crash?r.crash.kind:null,ct:r.crash?+(T-r.crash.T).toFixed(2):null,down:r.crash?+(+r.crash.down).toFixed(2):null,plan:r.crashPlan?r.crashPlan.kind:null,rmt:!!r.rmt,gone:!!r.gone})),
      order:rs.filter(r=>!r.gone&&!r.crash).sort((a,b)=>(b.D-a.D)||(a.k-b.k)).map(r=>r.seat)};
  };
  // [/hook:live]

  /* ---------------- the loop ---------------- */
  function tick(t){
    raf=0; if(!running) return;
    if(document.hidden){ running=false; return; }
    /* real time even on a slow device (frames up to half a second apart still move the race on by their real length; the physics
       sub-steps); timeScale: tests only (never in the game) */
    const dt=Math.min(1.0,(lastT?Math.min(0.5,(t-lastT)/1000):1/60)*(V.timeScale||1)); lastT=t;
    if(drawHold){ raf=requestAnimationFrame(tick); return; }   /* the warm hold (perf): nothing moves and nothing is drawn until the race's shaders are ready */
    const c0=now();
    const off=motion()==="off";
    step(dt);
    if(!off||(stillT+=dt)>=2){ stillT=0; render(); }
    const ms=now()-c0; stats.ms=stats.ms*0.95+ms*0.05; stats.msMax=Math.max(stats.msMax*0.995,ms); stats.frames++;
    stats.ft.push(dt*1000); if(stats.ft.length>120) stats.ft.shift();
    // [hook:perf]
    if(!off) QUAL.adapt(dt,ms);   /* the adaptive ladder, the benchmark, the riders' level of detail (r3d-quality.js) */
    // [/hook:perf]
    raf=requestAnimationFrame(tick);
  }
  function start(){ if(running||V.lost) return; if(document.hidden) return; running=true; lastT=0; raf=requestAnimationFrame(tick); }
  V.stop=function(){ running=false; if(raf){ cancelAnimationFrame(raf); raf=0; } };
  V.show=function(on){ want=!!on; if(on) start(); else V.stop(); };
  document.addEventListener("visibilitychange",()=>{ if(document.hidden) V.stop(); else if(want) start(); });
  V.resize=function(){
    const w=Math.max(1,Math.round(host.clientWidth)), h=Math.max(1,Math.round(host.clientHeight));
    // [hook:perf]
    const pr=QUAL.resize(w,h,W,H,LO);   /* the pixel ratio: a cap per device (TV, phone, Reduce effects) */
    /* the capture page has no game.js to call V.warm() while the gate shows: there the new race is warmed here, at the end of setRace, at its real size (the race and its frames are unchanged) */
    if(warmPending&&GL.DEMO&&C&&R&&!V.lost&&!/[?&]warm=(async|off)/.test(GL.location.search)){ renderer.setPixelRatio(pr); renderer.setSize(w,h,false); V.warmSync(); }   /* (?warm=async: tools test the game's own V.warm()) */
    // [/hook:perf]
    W=w; H=h; renderer.setPixelRatio(pr); renderer.setSize(W,H,false); cv.style.width=W+"px"; cv.style.height=H+"px";
    LOOK.resize(W,H,pr);
    cam.aspect=W/H; cam.updateProjectionMatrix(); CAMS.snap(); renderOnce();
  };
  function renderOnce(){ if(!C||V.lost) return; step(0); if(drawHold) return; render(); }   /* (the warm hold: placed, not drawn) */
  /* the end of the warm hold: the stadium's environment is captured now (its programs are ready), then the first frame */
  function releaseHold(){ drawHold=false; warmHold=null; if(V.lost||!C) return; try{ if(LOOK.envCapture) LOOK.envCapture(); }catch(e){} renderOnce(); }
  function render(){
    LOOK.render(scene,cam,now()/1000);   /* the frame (through the post-processing slot when one is set) */
    const inf=renderer.info.render; stats.calls=inf.calls; stats.tris=inf.triangles;
    stats.fpsN++; const tn=now(); if(tn-stats.fpsT0>1000){ stats.fps=stats.fpsN*1000/(tn-stats.fpsT0); stats.fpsN=0; stats.fpsT0=tn; }
  }

  /* ---------------- one step of the world ---------------- */
  const BW=new THREE.Matrix4(), keepCam=new THREE.Vector3();
  function step(dt){
    if(!C||!R) return;
    const tw=now()/1000, racing=mode==="race";
    // [hook:live]
    if(LIVE&&racing) liveStep(dt);   /* a time-model race: the model's clock (the lap loop below is the view's own clock) */
    const dtM=LIVE&&racing?dt*LIVE.rate:dt;   /* the motion zone's time step: the race clock's (its rate: 1 in the game; a test's faster clock moves the pack as a sped-up race) */
    // [/hook:live]
    if(racing&&dt>0&&!LIVE){
      T+=dt; updateGaps(dt);
      /* the leader starts a lap: the cards of that lap turn (the game); the end of the last lap is the checkered flag */
      while(!finished&&T>=lapStartT(lapNo+1)){
        if(show) show.fire("line");
        if(lapNo>=lenLaps||(lapPlan&&lapPlan.over&&lapPlan.n>=lapNo)){ finished=true; if(show) show.fire("done"); if(hooks.onFinish) setTimeout(()=>hooks.onFinish(),0); { const Lw=leaderIdx(); if(Lw>=0) shown("checkered",{s:rs[Lw].seat}); } break; }
        if(show) show.fire("done");
        lapNo++;
        // [hook:stadium]
        if(world.ctx.screen) world.ctx.screen(lapNo,lenLaps,null);   /* the big screen: the lap */
        // [/hook:stadium]
        const n=lapNo; if(hooks.onLap) setTimeout(()=>hooks.onLap(n),0);
      }
    }
    if(gate&&racing){ const a=gate.dropT>0?clamp((now()-gate.dropT)/260,0,1):1; if(a!==gate.drop){ gate.drop=a; gate.set(a*a); } }
    const atGate=mode==="gate";
    // [hook:motion]
    /* THE MOTION (the motion specialist, milestone 2): how the race MOVES. The engine and the cards decide each rider's race distance (his gap to
       the leader's schedule: r.Dl, the LOGICAL distance); the view only PLACES the riders round it, so the order at the line, the lap times and
       the standings are untouched:
       - PACK SPACING: a setback r.sb >= 0 holds a rider back from his logical distance while another rider is in his way (bikes never ride through
         each other: the one behind yields, the one in front never moves for him), then lets him catch up gently: r.D = r.Dl - r.sb is what is
         drawn. Once the riders are spread (every lap ends with the cards' gaps, 4 m and more apart) the setbacks are 0 and r.D = r.Dl.
       - THE LATERAL LINE is a critically damped follower (tau 0.35 s, at most 4 m/s^2 sideways, never faster sideways than about 0.42 x the
         speed: no sliding at walking pace) toward a line that keeps riders on their side of each other (hysteresis: you stay on the side you are
         on; a pass picks its side and keeps it), instead of the old bang-bang chase at a 2.4 m/s clamp (the crab-walk).
       - THE GRID: fixed slots in staggered rows (gridBuild), no passing pushes at the gate or on the start straight: the riders hold their lanes as
         the start narrows and queue into turn 1 through the setbacks (the funnel), the racing line takes over into turn 1.
       - A fallen rider and his bike are HARD obstacles (never inside 1.45 m of them while level with them) and the riders slow through the crash.
       - THE REMOUNT rides on from where the bike lies, from a stop (r.rem: no teleport, no snap to the racing line). */
    const ordA=[];
    for(let i=0;i<N;i++){
      const r=rs[i]; if(r.gone&&!r.crash) continue;
      if(r.crash&&r.crash.kind==="remount"&&T-r.crash.T>=r.crash.down){ /* back on the bike where it lies: the logical distance becomes the bike's, he rides on from there from a stop */
        const c=r.crash, ts=c.v0/7.5, hw0=(r.fr&&r.fr.hw)||4; r.g=T-MX.Course.tOfD(C,c.D+c.v0*ts-3.75*ts*ts); r.lat=clamp(c.lat+c.side*Math.min(2.2,0.9*ts),-hw0+0.6,hw0-0.6);
        r.crash=null; r.boot={t:0}; r.init=false; r.rem=true; r.sb=0; r.vl=0; r.al=0; r.alF=0; r.psi=-c.side*0.18; r.psiHold=0.8; r.pa=0; r.jF=null; r.jR=null; r.jDone=null; r.czone=0; }
      if(r.crash&&r.crash.kind==="out"&&lapNo>r.crash.lap+1){ r.crash=null; r.gone=true; hideRider(R,i); continue; }   /* cleared after the yellow lap */
      if(r.leave&&lapNo>r.leave&&!r.crash){ r.gone=true; r.leave=0; hideRider(R,i); continue; }
      const tau=atGate?0:tauOf(i), d0=MX.Course.dOfT(C,Math.max(0,tau));
      const Db=atGate?-0.95:d0-0.95*(1-sstep(0,18,d0));   /* (the old D: the front row waits out the clock's first 0.95 m, the rear wheel spinning) */
      r.Db=Db; r.Dl=Db-gridBack(r.k)*(1-sstep(0,60,Math.max(0,d0)));   /* the second row starts 2.3 m back; the offset fades over the first 60 m */
      if(r.sb==null) r.sb=0;
      ordA.push(r);
    }
    /* who yields to whom: a rider clearly AHEAD as drawn (more than 1 m) is never driven through; two riders LEVEL as drawn (within 1 m)
       merge in the cards' order (the one the cards put behind lets the other in: the funnel into turn 1 and every merge sort themselves by the
       race's real order, nobody is buried by a tie). Processed front to back as drawn last frame; a rider not yet placed this frame counts
       where he was drawn last frame. The distance is measured along the rider's own line (the inside of a hairpin is shorter). */
    for(let a=0;a<ordA.length;a++){ const r=ordA[a]; r.Dq=r.D; }
    ordA.sort((a,b)=>(b.Dq-a.Dq)||(b.Dl-a.Dl)||(a.k-b.k));
    for(let a=0;a<ordA.length;a++){
      const r=ordA[a], live=racing&&dt>0&&(r.init||r.rem)&&!atGate;
      let sb=r.crash?r.sb:0;
      if(!r.crash&&!atGate){
        let need=0;
        const Lf=2.15+0.05*Math.max(0,r.v||0), kr=(r.fr&&r.fr.k)||0;   /* nose to tail: the footprint (2 m) and a gap that grows with the speed (0.9 m at 15 m/s); more round a tight turn (the bikes are turned against each other) */
        for(let b=0;b<ordA.length;b++){ if(b===a||(!live&&b>a)) continue; const o=ordA[b]; if(o.crash) continue;   /* (a placement frame: only against the riders already placed) */
          const oD=b<a?o.D:o.Dq, lead=oD-r.Dq;   /* (o.D: placed this frame; o.Dq: where he was drawn last frame) */
          if(!(lead>1.25||(lead>=-1.25&&rightOf(o,r)))) continue;   /* he has the right of way over r */
          const ah=oD-r.Dl, dl=Math.abs(o.lat-r.lat), Lq=Lf*(1-sstep(0.70,0.752,dl))*(1+2.4*Math.abs(kr))/Math.max(0.45,1-kr*(o.lat+r.lat)*0.5); if(Lq<=0.001||ah>Lq) continue;   /* (the footprint is 0.75 m wide) */
          const nd=Lq-ah; if(nd>need) need=nd; }
        if(live){
          const cz=r.czone||0; sb=r.sb||0;
          if(cz>0) sb+=2.6*cz*dtM;   /* a crash ahead: slower through it (up to 2.6 m/s), made up afterwards */
          if(need>sb){ sb=Math.min(need,sb+7*dtM); if(need-sb>0.15) sb=need-0.15; }   /* held back: quickly, never more than 0.15 m into the bike ahead */
          else if(cz<=0){ const ex=sb-need; sb-=Math.min(ex,Math.min(ex>4?2.6:1.8,0.2+ex*1.5)*dtM); }   /* catching up: gently (1.8 m/s faster than the clock, 2.6 m/s when far back) */
          sb=Math.max(0,LIVE?Math.min(SBMAX,sb):sb);   /* ([hook:live] the time model's clock: never more than SBMAX m behind the tower's place: a rider who finds no room squeezes through) */
        } else sb=LIVE?Math.min(SBMAX,need):need;   /* a placement frame (the race restored, a test jump): placed at once ([hook:live] the setback cap holds here too) */
      }
      let D=r.Dl-sb;
      if(live&&D<r.D){ D=r.D; sb=r.Dl-D; }   /* never backwards */
      r.sb=sb;
      r.Dp=(r.init||r.rem)?r.D:D; r.D=D;
      r.P=D+Math.max(0,-r.Db);   /* where he is drawn on the start: the front row stands at the start path's first metre while the clock's first 0.95 m pass (the wheel spins) */
      const loc=MX.Course.atD(C,Math.max(0,D),tmpO);
      const sPrev=r.s; r.onStart=loc.onStart; r.s=loc.onStart?0:loc.s; r.lapN=loc.lap;
      /* a crash happens where the engine said, on the lap it said */
      if(racing&&r.crashPlan&&!r.crash&&!r.onStart&&r.lapN>=r.crashPlan.lap&&dt>0){ const a2=MX.Course.wrap(C,r.crashPlan.s-sPrev), b2=MX.Course.wrap(C,r.crashPlan.s-r.s); if(a2<C.L/2&&(b2>C.L/2||b2<0.05)) beginCrash(r.k); }
    }
    /* the frames and the lateral lines, front to back (as drawn) */
    const ordB=ordA.slice().sort((a,b)=>(b.D-a.D)||(a.k-b.k)), loopStart=!(C.S&&C.S.n), turn1=loopStart?C.hsD:C.Ls;
    for(let a=0;a<ordB.length;a++){
      const r=ordB[a];
      let fr;
      if(r.onStart){ fr=MX.Course.startFrame(C,Math.max(0,r.P),tmpO2); if(r.P<0){ fr.x+=Math.cos(fr.th)*r.P; fr.z+=Math.sin(fr.th)*r.P; } }   /* the second row stands behind the start path's first point */
      else fr=MX.Course.frame(C,r.s,tmpO2);
      const hw=fr.hw;
      r.fr={x:fr.x,z:fr.z,th:fr.th,k:fr.k,hw:hw,y:fr.y||0,tag:fr.tag,sand:fr.sand||0};
      if(r.crash) continue;
      let ia=-hw+0.55, ib=hw-0.55;
      if(!r.onStart){ /* the inside of a tight turn is not a line: nobody rides a radius under 4 m (a hairpin is ridden on its berm, two or three wide, not on its apex) */
        const k1=fr.k, k2=MX.Course.frame(C,r.s+6,tmpO).k, kk=Math.abs(k2)>Math.abs(k1)?k2:k1;
        if(kk>1/40) ib=Math.max(ia+0.6,Math.min(ib,1/kk-4)); else if(kk<-1/40) ia=Math.min(ib-0.6,Math.max(ia,-(1/-kk-4))); }
      if(atGate){ r.lat=gridLat(r.k); r.latT=r.lat; r.vl=0; r.al=0; r.alF=0; r.psi=0; continue; }   /* the grid: still, each in his own slot */
      let target, pushes=true;
      const startMode=r.onStart||(loopStart&&r.lapN===1&&r.D<C.hsD);
      if(startMode){
        /* the start: each rider holds his lane, the lanes narrow with the start (they keep their order across it); into turn 1 the racing line takes over */
        const lane=clamp(gridLat(r.k)*clamp((hw-0.6)/Math.max(0.5,GRID?GRID.use:hw),0.62,1),-(hw-0.6),hw-0.6), wS=sstep(turn1-44,turn1-18,r.D);   /* (the lanes narrow a little; where the start gets narrower still the outside riders tuck in behind: the funnel) */
        let line=r.bias*hw*0.45; { const kk=r.onStart?MX.Course.startFrame(C,Math.min(C.Ls,Math.max(0,r.P)+9),tmpO).k:MX.Course.frame(C,r.s+9,tmpO).k; if(Math.abs(kk)>1/30) line=-Math.sign(kk)*hw*0.36+r.bias*0.5; }
        target=lane*(1-wS)+line*wS; pushes=wS>0.02||!!LIVE;   /* (from where the lanes start to bend to the racing line, level riders keep their sides; [hook:live] on the time model's clock the riders launch at their own pace: a quicker one finds room round a slower one on the start too) */
      } else { const kk=MX.Course.frame(C,r.s+9,tmpO).k; target=Math.abs(kk)>1/30?-Math.sign(kk)*hw*0.36+r.bias*0.5:r.bias*hw*0.45; }
      /* passing room, solved across the track (not one push after another): a rider LEVEL with him (overlapping along the track) is never crossed:
         he stays on his side of him, at least SEP away; a rider just ahead that he is closing on, is held back by or is already passing must not be
         in his lane: the line goes to the free gap nearest the racing line, with hysteresis (moving costs, a pass keeps its side for 1.6 s). A rider
         content to follow stays in the line ahead of him (a train in the ruts); if no gap is free, the setback above holds him behind. */
      /* nobody rides into a fallen rider or his bike, where they are now (the bike slides on, the rider is thrown further the other way): each
         blocks 1.9 m either side of it from 22 m before (the passing solver treats it like a rider to get round); level with it, it is a hard
         limit (1.45 m) and everyone slows through it */
      let blk=null, cz=0;
      for(let q1=0;q1<rs.length;q1++){ const o=rs[q1], c=o.crash; if(!c||o===r) continue;
        for(let q2=0;q2<2;q2++){ const pd=q2?(c.rD!=null?c.rD:c.D):(c.bD!=null?c.bD:c.D), pl=q2?(c.rL!=null?c.rL:c.lat):(c.bL!=null?c.bL:c.lat), dd=pd-r.D;
          if(Math.abs(pl)>hw+0.7) continue;   /* off the track: no obstacle */
          if(dd>-3&&dd<22){ (blk=blk||[]).push([pl-1.9,pl+1.9,pl,dd]); cz=Math.max(cz,1-sstep(12,22,dd)); } } }
      r.czone=cz;
      if(pushes) target=passLine(r,a,ordB,target,ia,ib,blk);
      if(blk){ const bs=blk.slice().sort((x,y)=>x[0]-y[0]), mg=[]; bs.forEach(v=>{ const l=mg[mg.length-1]; if(l&&v[0]<=l[1]) l[1]=Math.max(l[1],v[1]); else mg.push([v[0],v[1]]); });
        const cur=clamp(r.lat,ia,ib), tc=clamp(target,ia,ib), lo2=Math.min(cur,tc), hi2=Math.max(cur,tc);
        const hit=mg.find(v=>(tc>v[0]&&tc<v[1])||(cur>v[0]&&cur<v[1])||(lo2<=v[0]&&hi2>=v[1]));
        if(hit){ const left=hit[0]-ia, right=ib-hit[1], goL=left>=0.3, goR=right>=0.3, preferL=cur<=(hit[0]+hit[1])/2;
          target=goL&&goR?(preferL?hit[0]:hit[1]):goL?hit[0]:goR?hit[1]:(left>right?ia:ib); } }
      target=clamp(target,ia,ib); r.latT=target;
      /* the follower */
      if(!r.init&&!r.rem){ r.lat=target; r.vl=0; r.al=0; }   /* a placement frame */
      else if(dtM>0){
        const am=cz>0?6:4, vmax=Math.min(cz>0?4.5:3.2,0.15+0.42*Math.max(0,r.v||0)), n=Math.max(1,Math.ceil(dtM*120)), h=dtM/n, v0=r.vl||0;
        let lat=r.lat, vl=v0;
        for(let q=0;q<n;q++){ let ac=0;
          { const e=target-lat, vd=Math.sign(e)*Math.min(vmax,Math.abs(e)/0.35,Math.sqrt(2*am*0.85*Math.abs(e))), aa=r.air?1.2:am; ac=clamp((vd-vl)/0.0875,-aa,aa); }   /* (in the air only a little body english sideways) */
          vl+=ac*h; lat+=vl*h; }
        r.al=(vl-v0)/dtM; r.vl=vl; r.lat=lat;
      }
      /* hard limits: the track's edge; a fallen rider or bike level with him */
      { const lim=dt>0&&(r.init||r.rem)?Math.max(0.02,6*dtM):99;   /* back inside the track's edge (and the inside of a hairpin): quickly, never in one jump */
        if(r.lat<ia-0.15){ r.lat+=Math.min(ia-0.15-r.lat,lim); if(r.vl<0) r.vl=0; } else if(r.lat>ib+0.15){ r.lat-=Math.min(r.lat-ib-0.15,lim); if(r.vl>0) r.vl=0; } }
      if(blk){ /* the fallen riders and bikes level with him: one merged no-go stretch each (never pushed from one onto the other), left on the
         nearest side, at most 6 m/s sideways (no jump: the soft line above has already steered him round from 22 m out) */
        const hz=[]; for(let q=0;q<blk.length;q++){ const v=blk[q]; if(v[3]>-2.2&&v[3]<2.4) hz.push([v[2]-1.45,v[2]+1.45]); }
        if(hz.length){ hz.sort((x,y)=>x[0]-y[0]); const mz=[]; hz.forEach(v=>{ const l=mz[mz.length-1]; if(l&&v[0]<=l[1]) l[1]=Math.max(l[1],v[1]); else mz.push(v.slice()); });
          for(const z of mz){ if(r.lat>z[0]&&r.lat<z[1]){ const toL=r.lat-z[0], toR=z[1]-r.lat, sd=toL<=toR?-1:1, goal=sd<0?z[0]:z[1]; r.lat+=clamp(goal-r.lat,-Math.max(0.02,6*dtM),Math.max(0.02,6*dtM)); if(r.vl*sd<0) r.vl=0; break; } } } }
    }
    // [/hook:motion]
    /* the flagger: the white flag as the leader comes to the line to start the last lap, the checkered flag as the winner arrives */
    if(racing&&!finished){ const L0=leaderIdx(); if(L0>=0&&!rs[L0].onStart){ const tl=(C.L-rs[L0].s)/Math.max(4,rs[L0].v||8);
      if(tl<2.6&&lapNo===lenLaps-1&&flag!=="white") V.setFlag("white");
      if(tl<2.2&&(lapNo>=lenLaps||(lapPlan&&lapPlan.over&&lapPlan.n>=lapNo))&&flag!=="checkered") V.setFlag("checkered"); } }
    /* show moments: the holeshot into turn 1, the lap winner's first pass */
    if(show&&!show.ended&&racing){
      const L=leaderIdx();
      if(lapNo===1&&L>=0&&rs[L].D>=C.hsD-6) show.fire("holeshot");
      if(lapPlan&&lapPlan.win!=null&&lapPlan.win>=0&&!show.fired.pass){ const rk=trackRank(lapPlan.win); if(lapPlan.rank0>=0&&rk<lapPlan.rank0){ show.fire("pass"); if(rs[lapPlan.win]) shown("pass",{s:rs[lapPlan.win].seat}); } }
    }
    /* the announcers' moments that need no lap result (hooks.shown): the holeshot, a rider lapped by the leader */
    if(racing&&dt>0&&!finished&&hooks.shown){
      const L=leaderIdx();
      if(!shownHs&&lapNo===1&&L>=0&&rs[L].D>=C.hsD-6){ shownHs=true; shown("holeshot",{s:rs[L].seat}); }
      if(L>=0&&!rs[L].onStart){ const DL=rs[L].D;
        for(let i=0;i<N;i++){ const r=rs[i]; if(i===L||r.gone||r.crash||r.onStart) continue; const k=Math.floor((DL-r.D)/C.L);
          if(lappedK[i]==null) lappedK[i]=k; else if(k>lappedK[i]){ lappedK[i]=k; if(k>=1) shown("lapped",{s:r.seat,by:rs[L].seat}); } } }
    }
    for(let i=0;i<N;i++){ const r=rs[i]; if((r.gone&&!r.crash)||!r.fr){ hideRider(R,i); RST[i].visible=false; continue; } rider(i,r,dt,atGate,tw); }
    // [hook:fx]
    { const Li=leaderIdx(), Ld=Li>=0?rs[Li]:null, Me=meSeats.length?rs.find(r=>r.seat===meSeats[0]):null; FX.focus(Ld&&Ld.pos?Ld.pos:null,Me&&Me.pos?Me.pos:null); }   /* the leader and the person: where the viewer mostly looks (race state only, never the camera: the frames stay a pure function of the tick) (r3d-fx.js) */
    FX.step(dt);   /* the particles move on (r3d-fx.js) */
    // [/hook:fx]
    // [hook:rider]
    commit(R,cam,dt);   /* the riders' level of detail by distance to the camera, every instance buffer and the bone texture are uploaded (r3d-riders.js) */
    // [/hook:rider]
    // [hook:dirt]
    if(world.dirt&&world.dirt.frame) world.dirt.frame(dt,RST);   /* per-frame work for the track surface: tyre tracks, ruts (r3d-track.js addTrack().frame) */
    // [/hook:dirt]
    // [hook:stadium]
    if(flagger&&flagger.grp.visible) flagger.wave(tw,flag?1:0.05);
    if(marshal&&marshal.grp.visible) marshal.wave(tw*1.2,1);
    if(world.frame){ const Lx=racing?leaderIdx():-1; world.frame(dt,tw,cam,racing?T:null,racing?lapNo:0,lenLaps,Lx>=0&&list[Lx]?list[Lx].num:null); }   /* per-frame work for the surroundings: the crowd, lights, the big screen (race clock, lap, the leader's number) (r3d-world.js buildWorld().frame) */
    // [/hook:stadium]
    // [hook:cams]
    CAMS.director(dt);   /* which shot next */
    CAMS.camera(dt);     /* the camera: position, look-at, field of view */
    // [/hook:cams]
    keepCam.copy(cam.position);   /* (where the director put the lens: the near-lens keep sphere below holds only for the director's own camera) */
    // [hook:harness]
    let hkKeep=null;
    if(V.camHook){ const h=V.camHook(dt,rs,T); if(h){ hkKeep=h.keep||null; cam.position.set(h.eye[0],h.eye[1],h.eye[2]); CAMS.target.set(h.target[0],h.target[1],h.target[2]); cam.lookAt(CAMS.target); if(h.fov&&Math.abs(cam.fov-h.fov)>1e-4){ cam.fov=h.fov; cam.updateProjectionMatrix(); } } }   /* the capture harness' camera (demo.js; null in the game): after the director, before the sky and the shadow box follow the lens */
    // [/hook:harness]
    /* the chase subject is spared from the riders' and bikes' near-lens fade (milestone 2 merge, the cams' request: CAMS.keep = his hip and a radius, w = 0 for nobody; r3d-util.js MX_KEEP);
       a camera the capture harness placed elsewhere spares nobody */
    MX_KEEP.value.copy(CAMS.keep); if(cam.position.distanceToSquared(keepCam)>1e-10) MX_KEEP.value.w=0;
    if(hkKeep) MX_KEEP.value.set(hkKeep[0],hkKeep[1],hkKeep[2],hkKeep[3]);   /* (polish: a harness rig on a rider spares and un-smears its subject exactly as the game's chase does) */
    if(CAMS.shot){ if(world.ctx.skyMesh) world.ctx.skyMesh.position.copy(cam.position); if(LOOK.shadows) LOOK.fitShadow(cam,CAMS.target); }   /* the sky follows the lens; the shadow box follows the action */
    LOOK.frame(cam,CAMS.target,dt,tw,subjectDist());   /* the camera-relative lights (rim, kick) and the depth of field's focus (r3d-look.js) */
    tags();
  }
  /* the depth of field's subject: the rider nearest the middle of the picture within 34 m of the lens (0 = nobody: a wide shot, no blur) */
  const sjF=new THREE.Vector3();
  function subjectDist(){
    if(!LOOK.flags.dof) return 0;
    cam.getWorldDirection(sjF); let best=0, bs=1e9;
    for(let i=0;i<rs.length;i++){ const r=rs[i]; if((r.gone&&!r.crash)||!r.pos) continue;
      const dx=r.pos.x-cam.position.x, dy=r.pos.y-cam.position.y, dz=r.pos.z-cam.position.z, d=Math.sqrt(dx*dx+dy*dy+dz*dz); if(d>34||d<1.2) continue;
      const ca=(dx*sjF.x+dy*sjF.y+dz*sjF.z)/d; if(ca<0.62) continue;
      const sc=d*(1.9-ca); if(sc<bs){ bs=sc; best=d; } }
    return best;
  }
  /* one rider: speed, the axles (sprung masses on the wheels), the stance, the bike and body matrices */
  function rider(i,r,dt,isGate,tw){
    const fr=r.fr, s=r.s, onStart=r.onStart;
    const th=fr.th, cth=Math.cos(th), sth=Math.sin(th), nx=-sth, nz=cth, lat=r.lat;
    const x=fr.x+nx*lat, z=fr.z+nz*lat;
    // [hook:motion]
    let v=r.rem?0:r.init&&dt>0?(r.D-r.Dp)/dt:(isGate?0:MX.Course.vOfD(C,Math.max(0,r.D)));   /* (a remount rides on from a stop: r.rem) */
    if(!isFinite(v)||v<0) v=0; r.vp=r.v; r.v=r.init?r.v+(v-r.v)*Math.min(1,dt*10):v; r.vi=v;   /* (r.vi: this frame's own speed, unsmoothed: the jump arcs plan with it) */
    const acc=dt>0?(r.v-r.vp)/dt:0;
    const gF=ride(r,s,onStart,BIKE.WB/2), gR=ride(r,s,onStart,-BIKE.WB/2), tF=gnd(r,s,onStart,BIKE.WB/2), tR=gnd(r,s,onStart,-BIKE.WB/2);
    const aF=onStart||r.crash?null:jumpArc(r,s+BIKE.WB/2,true), aR=onStart||r.crash?null:jumpArc(r,s-BIKE.WB/2,false);   /* this rider's own flight over a jump, from his speed at the lip */
    // [/hook:motion]
    if(r.crash){ crashPose(i,r,tw,dt); return; }
    let landed=false, impact=0;   /* this frame the bike touches down, and how hard: the axles' downward speed just before (m/s) */
    if(!r.init||dt<=0){
      initAxle(r.F,gF,aF,r.v); initAxle(r.Rr,gR,aR,r.v); r.init=true;
      // [hook:motion]
      r.rem=false;
      // [/hook:motion]
      r.stand=standTarget(r,aF||aR); r.lean=leanTarget(r); r.dab=0; r.gF=gF; r.gR=gR;
    } else {
      const sub=Math.max(1,Math.ceil(dt/(1/120))), h=dt/sub, vgF=(gF-r.gF)/dt, vgR=(gR-r.gR)/dt;
      const vyIn=(r.F.v+r.Rr.v)*0.5;
      for(let k=0;k<sub;k++){ axle(r.F,aF,gF,vgF,h,r.v); axle(r.Rr,aR,gR,vgR,h,r.v); }
      r.gF=gF; r.gR=gR;
      const inAir=!!(aF||aR);
      landed=r.air&&!inAir; if(landed) impact=Math.max(0,-vyIn);   /* (the dust: r3d-fx.js, FX.rider below) */
      r.air=inAir;
      r.stand+=clamp(standTarget(r,inAir)-r.stand,-dt*3.5,dt*3.5);
      r.lean+=clamp(leanTarget(r)-r.lean,-dt*1.6,dt*1.6);
      const dabT=(r.stand<0.3&&Math.abs(fr.k)>1/14&&r.v<11&&!inAir)?Math.sign(fr.k):0; r.dab+=clamp(dabT-r.dab,-dt*3,dt*3);
    }
    const yF=r.F.y, yR=r.Rr.y, LsEq=BIKE.TRAVEL-BIKE.SAG, pitch=Math.atan2(yF-yR,BIKE.WB);
    let oy=(yF+yR)/2-BIKE.WR-LsEq;
    /* polish: weight transfer: the bike squats and lifts its front under hard throttle (the gate drop, out of a turn) and dives on the
       brakes into a turn, pivoting on the wheel that stays down */
    const paT=(isGate||r.air||onStart&&r.D<0.5)?0:clamp(acc*0.013,-0.06,0.1); r.pa=(r.pa||0)+(paT-(r.pa||0))*Math.min(1,dt*7);
    oy+=BIKE.WB/2*Math.abs(Math.sin(r.pa));
    // [hook:motion]
    /* THE BIKE POINTS WHERE IT GOES: its heading is the track's plus the angle of its own path (the lateral speed against the forward speed,
       low-passed 0.12 s; the bike no longer crab-walks across a lane with its nose locked to the track), and a lane change leans it into the
       turn it makes (the lateral acceleration, low-passed 0.15 s) */
    { const vf=Math.max(2,(r.v||0)*(1-fr.k*lat)), psiT=isGate?0:Math.atan2(r.vl||0,vf)*sstep(0.3,2.0,r.v||0);
      if(dt>0){ r.psi+=(psiT-r.psi)*Math.min(1,dt/(r.psiHold>0?0.35:0.12)); if(r.psiHold>0) r.psiHold-=dt; r.alF+=((r.air?0:(r.al||0))-r.alF)*Math.min(1,dt/0.15); }
      else if(!isFinite(r.psi)) r.psi=0; }
    const hd=th+r.psi;   /* the bike's heading */
    let roll=r.lean+clamp(Math.atan((r.alF||0)/G)*0.9,-0.32,0.32), yaw=-hd, pz=pitch+r.pa;
    if(isGate){ roll=0; pz+=Math.sin(tw*31+i)*0.004; }
    // [/hook:motion]
    if(r.air&&aF&&aF.A&&aF.A.b-aF.A.a>14&&!LO){ const u=aF.u; const wsg=((i*13)%3)-1; roll+=wsg*0.55*Math.sin(PI*clamp(u*1.15,0,1)); yaw+=wsg*0.18*Math.sin(PI*u); }
    eul.set(roll,yaw,pz,"YZX"); q.setFromEuler(eul);
    BW.compose(v3.set(x,oy,z),q,sc1);
    const compF=clamp(LsEq-(yF-Math.max(tF+BIKE.WR,yF-BIKE.TRAVEL)),-0.12,BIKE.TRAVEL-0.02), compR=clamp(LsEq-(yR-Math.max(tR+BIKE.WR,yR-BIKE.TRAVEL)),-0.12,BIKE.TRAVEL-0.02);
    r.spinF+=r.v*dt/BIKE.WR; r.spinR+=r.v*dt/BIKE.WR;
    const crouch=clamp((compF+compR)*1.6,0,0.6)+(isGate?0.5:0);
    const gy=Math.min(tF,tR), hAir=Math.max(0,oy-gy);
    /* the per-rider state every module reads (CONTRACT.md) */
    const st=RST[i];
    // [hook:motion]
    st.visible=true; st.me=!!list[i].me; st.red=!!list[i].red; st.x=x; st.y=oy; st.z=z; st.th=hd; st.yaw=yaw; st.pitch=pz;   /* st.th = the bike's heading (the track's + its path angle): the roost leaves the real rear wheel */
    // [/hook:motion]
    st.v=r.v; st.acc=acc; st.lat=r.lat; st.s=s; st.D=r.D; st.onStart=onStart; st.k=fr.k; st.tag=fr.tag||""; st.sand=fr.sand||0; st.gate=isGate;
    st.air=r.air; st.landed=landed; st.impact=impact; st.hAir=hAir; st.gF=gF; st.gR=gR; st.tF=tF; st.tR=tR; st.gy=gy;
    st.compF=compF; st.compR=compR; st.spinF=r.spinF; st.spinR=r.spinR; st.stand=isGate?0:r.stand; st.dab=r.dab; st.lean=roll; st.crouch=crouch;
    st.crash=null; st.body=null; st.limbs=null;
    // [hook:fx]
    /* the effects inputs (r3d-fx.js owns these formulas): the throttle and the rear wheel's wheelspin as 0..1 (st.throttle, st.slip), how hard it
       throws dirt (st.roost); st.mud (0..1, kept between frames, raised when riding in another rider's roost) is raised in FX.rider */
    FX.inputs(st,dt);
    // [/hook:fx]
    // [hook:bike]
    /* extra pose inputs for the bike (read by r3d-bike.js poseBike): st.compF / st.compR (suspension compression, m), st.spinF / st.spinR (wheel spin, rad), and
       st.lodD: the distance to the lens that picks the level of detail (a bike behind the lens or well outside the picture counts as far; a narrow lens as near),
       st.mud (0..1, kept between frames): the dirt builds up with the distance ridden, faster in sand, and a hard landing throws more on */
    { const bv=st.bv||(st.bv=new THREE.Vector3()), bq=st.bq||(st.bq=new THREE.Quaternion()), cp=st.cp||(st.cp=new THREE.Vector3()), th2=Math.tan(cam.fov*PI/360);
      /* a cut (the camera jumped): the level of detail is chosen afresh, never from the last shot's */
      st.lodCut=cp.distanceToSquared(cam.position)>9; cp.copy(cam.position);
      const dd=Math.sqrt((cam.position.x-x)*(cam.position.x-x)+(cam.position.y-oy)*(cam.position.y-oy)+(cam.position.z-z)*(cam.position.z-z));
      bv.set(x-cam.position.x,oy+0.6-cam.position.y,z-cam.position.z).applyQuaternion(bq.copy(cam.quaternion).invert()); const dz2=-bv.z;
      const off=dz2<-1||Math.abs(bv.x)>th2*cam.aspect*dz2+4||Math.abs(bv.y)>th2*dz2+4;
      st.lodD=dd*(th2/0.577)*(off?2.6:1);
      st.mud=Math.min(1,(st.mud||0)+dt*r.v*0.00058*(1+2.5*(fr.sand||0))+(landed?0.03*Math.min(impact,8)/8:0)); }
    // [/hook:bike]
    // [hook:rider]
    /* extra pose inputs for the rider (read by r3d-riders.js poseRider): st.stand 0..1, st.dab -1..1, st.crouch, st.lean; the bike's own acceleration is measured from the matrix there */
    /* (the rider branch raised st.mud toward 1 with a 50 s time constant here: in the merged build st.mud has ONE physical source, the bike zone above (distance ridden, sand, landings: the bike specialist's request) plus the roost of other riders (r3d-fx.js FX.inputs); a second, time-based writer would have every bike and rider fully caked after two laps). The skinned riders' shader browns the boots, legs, gloves and chest with st.mud. */
    // [/hook:rider]
    poseRider(R,i,BW,st);   /* the bike, then the rider on it (r3d-riders.js, r3d-bike.js) */
    const gl=onStart?0:(MX.Course.ground(C,s,lat+0.5)-MX.Course.ground(C,s,lat-0.5));
    let shx=x, shz=z, shy=(tF+tR)/2;
    if(hAir>0.25&&!onStart){ const k=Math.min(6,hAir)/Math.max(0.35,SUN.y), ox=-SUN.x*k, oz=-SUN.z*k, al=ox*cth+oz*sth, lt=ox*nx+oz*nz; shx=x+ox; shz=z+oz; shy=MX.Course.ground(C,s+al,lat+lt); }
    // [hook:motion]
    shadowAt(R,i*2,shx,shy,shz,hd,2.1,0.9,clamp(1-hAir/6,0.3,1),clamp((tF-tR)/BIKE.WB,-1.2,1.2),clamp(gl,-1.2,1.2),LOOK.blobOp(shx,shy,shz));   /* (the blob turns with the bike) */
    // [/hook:motion]
    shadowAt(R,i*2+1,0,-999,0,0,0,0,0);
    // [hook:motion]
    r.pos=r.pos||new THREE.Vector3(); r.pos.set(x,oy+1.0,z); r.th=hd; r.oy=oy; r.gy=gy;   /* r.th = the bike's heading */
    // [/hook:motion]
    // [hook:fx]
    FX.rider(st,dt);   /* landing dust, the roost off the rear wheel (r3d-fx.js) */
    // [/hook:fx]
  }
  function gnd(r,s,onStart,off){ if(onStart) return (r.fr.y||0)+0.02; return MX.Course.ground(C,s+off,r.lat); }
  // [hook:motion]
  function ride(r,s,onStart,off){
    if(onStart) return (r.fr.y||0)+0.02;
    const g=MX.Course.ground(C,s+off,r.lat), sk=skim(s+off)*sstep(5,9,r.v||0);   /* the skim line over the whoops' tops is a thing of speed: a rider at walking pace (a remount) rolls through the troughs */
    return sk>0?Math.max(g,sk+MX.Course.frame(C,s+off,tmpO).y):g;
  }
  /* JUMP ARCS THAT FOLLOW THE SPEED (view side). course.js gives every jump ONE spatial arc, flown at its design speed (A.vx); the riders reach the
     lip at their own speed (the cards' gaps move them up to 16% either side of the schedule), so a fixed arc made slow riders hang (an implied
     gravity of 7 m/s^2) and slammed fast ones (11.7). Each rider now flies his OWN ballistic arc from the lip at his own speed with real gravity:
     the distance grows with the speed (d x (v / vx)^1.4: a faster rider flies higher, further and longer, lands further down the landing), kept
     on the landing (never short onto its face, never off its far end: per kind of jump), never through the dirt on the way. The arc is chosen
     when the front wheel leaves the lip and both wheels fly it. */
  const JLIM={rhythm:[-0.6,0.6],double:[-1.4,2.6],triple:[-1.4,2.6],table:[-3.5,3.0],stepup:[-0.8,1.2],drop:[-1.0,2.0]};   /* how much shorter / longer than the design each landing takes (m): onto the peak's top at the shortest, never its face */
  function arcY(J,x){ return {y:J.ya+x*J.tan-G*x*x/(2*J.v*J.v),dy:J.tan-G*x/(J.v*J.v),A:J.A,u:x/J.d}; }
  function jumpArc(r,s,front){
    const key=front?"jF":"jR"; let J=r[key];
    if(J){ const x=MX.Course.wrap(C,s-J.a); if(x<=J.d) return arcY(J,x); r[key]=null; }   /* this wheel is down again */
    const a=MX.Course.airAt(C,s); if(!a){ if(front) r.jDone=null; return null; }   /* (past the jump: the next lap flies it again) */
    if(!front){ const F=r.jF; if(F&&F.A===a.A){ r.jR=F; const x=MX.Course.wrap(C,s-F.a); return x<=F.d?arcY(F,x):null; } return r.jDone===a.A?null:a; }   /* the rear wheel flies the front's arc */
    if(r.jDone===a.A) return null;   /* already flown (he landed short of the design's touch point) */
    /* his speed IN THE AIR: the schedule flies every arc at its design speed A.vx and the cards' gap rate scales it (the rider's own speed over the
       schedule's at this point); planning with the speed on the face (braking to the lip) made the flight floaty (implied gravity 7.9) */
    const vs=MX.Course.vOfD(C,Math.max(0,r.D)), q=clamp((r.vi!=null?r.vi:r.v)/Math.max(1,vs),0.7,1.35);
    const A=a.A, d=A.b-A.a, v=A.vx*q, lim=JLIM[A.kind]||[-0.8,1.6], lat=r.lat;
    const gAt=u=>MX.Course.ground(C,A.a+u,lat);
    let dr=clamp(d*Math.pow(q,1.4),Math.max(1.2,d+lim[0]),d+lim[1]);
    for(let k=0;k<12&&gAt(dr+0.25)>gAt(dr)+0.01;k++) dr+=0.25;   /* never onto a rising face */
    let tn=(gAt(dr)-A.ya)/dr+G*dr/(2*v*v);
    for(let it=0;it<6;it++){ let ok=true; for(let k=1;k<10;k++){ const x=dr*k/10; if(A.ya+x*tn-G*x*x/(2*v*v)<gAt(x)+0.1){ ok=false; break; } } if(ok) break; dr+=0.5; tn=(gAt(dr)-A.ya)/dr+G*dr/(2*v*v); }   /* never through the dirt */
    J=r.jF={A:A,a:A.a,d:dr,ya:A.ya,tan:tn,v:v}; r.jDone=A;
    const x=MX.Course.wrap(C,s-J.a); return x<=J.d?arcY(J,x):null;
  }
  // [/hook:motion]
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
    // [hook:motion]
    /* a PROGRESSIVE spring (stiffer over the last 55% of the travel, 4x at the bottom) and a hydraulic bump stop (more compression damping deep in
       the stroke): a 4 m/s landing uses about 0.13 m of the shock, a 6 m/s landing 0.16 m, only 7 m/s and more bottoms it (it bottomed from 4 m/s) */
    if(Ls<BIKE.TRAVEL){ const Lc=Math.max(Ls,0.03), xp=clamp((BIKE.TRAVEL-Lc-0.45*BIKE.TRAVEL)/(0.55*BIKE.TRAVEL),0,1), dv=A.v-vg; a+=K*(1+3*xp*xp)*(LREST-Lc)-2*Z*Math.sqrt(K)*(dv<0?1+7*xp*xp:1)*dv; }   /* (the force of the bottom of the stroke at most: a wheel that finds itself under a step in the dirt is not shot into the sky) */
    // [/hook:motion]
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
    // [hook:fx]
    FX.crashStart(f,r.gy||0,r);   /* the burst of dirt and dust where the rider goes down (r3d-fx.js) */
    // [/hook:fx]
    { const shot=CAMS.shot; placeMarshalS(r.s,r.crash.side,shot&&shot.type==="crash"?shot.cam:null,r.crash.kind); }
    if(show){ show.fire("crash"); const S=show; setTimeout(()=>S.fire("yellow"),2400); }
    shown("crash",{s:r.seat,kind:c.kind});
    // [hook:cams]
    { const shot=CAMS.shot; if(shot&&shot.type!=="crash") CAMS.pickShot(true); }
    // [/hook:cams]
  }
  /* the marshal: beside the track a little past the crash, on the far side from the camera that shows it (never in front of the lens) */
  function placeMarshalS(s,side,camP,kind){
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
        if(!CAMS.sees(camP,v3.set(x,MX.Course.ground(C,s+ds,sd*f.hw)+1.8,z),0.1)) sc-=3; }   /* hidden behind a jump from the crash camera */
      else sc+=sd===(side||1)?0.5:0;   /* on the bike's side (the rider tumbles the other way) */
      if(kind==="out"&&sd===-(side||1)&&ds>=3&&ds<=13) sc-=2.5;   /* never where a crashed-out rider walks off the track */
      cands.push({sc:sc,f:f,lat:lat,x:x,z:z,s:s+ds});
    }
    if(!cands.length){ const f=MX.Course.frame(C,s+8,{}), lat=-(side||1)*(f.hw+1.5); cands.push({sc:0,f:f,lat:lat,x:f.x-Math.sin(f.th)*lat,z:f.z+Math.cos(f.th)*lat,s:s+8}); }
    cands.sort((a,b)=>b.sc-a.sc);
    const c=cands[0], f=c.f, lat=c.lat, x=c.x, z=c.z;
    const edge=MX.Course.ground(C,c.s,Math.sign(lat)*f.hw), y=Math.max(edge+((f.y||0)-(C.kind==="stadium"?0.3:0.55)-edge)*sstep(0,1,(Math.abs(lat)-f.hw)/2.2),CAMS.terrainAt(x,z,-1e9),C.kind==="stadium"?-0.16:-1e9);   /* on the shoulder's slope as the dirt is drawn, or the ground beside it */
    /* facing the riders coming at the crash, turned toward the track */
    const fx=-Math.cos(f.th)*0.6+Math.sin(f.th)*Math.sign(lat)*0.8, fz=-Math.sin(f.th)*0.6-Math.cos(f.th)*Math.sign(lat)*0.8;
    marshal.grp.position.set(x,y-0.03,z); marshal.grp.rotation.y=Math.atan2(fx,fz); marshal.grp.visible=true; marshal.s=s;
  }
  /* the yellow lap's marshal: where the crash really happened (the same spot the crash was moved to), left where he stands if he's there */
  function marshalAt(sy){ if(marshal&&marshal.grp.visible&&marshal.s!=null){ let d=Math.abs(marshal.s-sy); d=Math.min(d,C.L-d); if(d<4) return; } placeMarshalS(sy); }
  V.yellowAt=function(sector){ if(!C) return; marshalAt(crashSpot(MX.Course.wrap(C,sector*C.L))); };
  V.yellowOff=function(){ if(marshal&&!rs.some(r=>r.crash)) marshal.grp.visible=false; };
  const CM=new THREE.Matrix4(), BM=new THREE.Matrix4(), cq=new THREE.Quaternion(), ce=new THREE.Euler(0,0,0,"YZX"), cv3=new THREE.Vector3(), cv4=new THREE.Vector3();
  /* a point on the dirt as it is drawn: race distance D, lateral lat (+ right): {px, py, pz} and the frame (th, hw) in o */
  function surfY(s,lat,f,x,z){ const a=Math.abs(lat); let y;
    if(a<=f.hw) y=MX.Course.ground(C,s,lat);
    else { const edge=MX.Course.ground(C,s,Math.sign(lat)*f.hw); y=edge+((f.y||0)-(C.kind==="stadium"?0.3:0.55)-edge)*sstep(0,1,(a-f.hw)/2.2); }
    return Math.max(y,CAMS.terrainAt(x,z,-1e9),C.kind==="stadium"?-0.16:-1e9); }
  function trackXZ(D,lat,o){ const l=MX.Course.atD(C,Math.max(0,D),o), on=l.onStart, sl=l.s;
    const f=on?MX.Course.startFrame(C,Math.max(0,D),o):MX.Course.frame(C,sl,o);
    o.px=f.x-Math.sin(f.th)*lat; o.pz=f.z+Math.cos(f.th)*lat; o.py=on?(f.y||0)+0.02:surfY(sl,lat,f,o.px,o.pz); return o; }
  const tmpCB={}, tmpCR={};
  // [hook:motion]
  const tmpCW={};
  // [/hook:motion]
  /* polish: the bike and the rider part company (the bike slides off to its side, the rider is thrown further and tumbles the other way:
     the old script left the rider lying under his own bike); both follow the track's curve and stand on the dirt as it is drawn (the
     shoulders too) while the rider walks back to the bike or off the track; a rider out of the race turns to watch it */
  function crashPose(i,r,tw,dt){
    const c=r.crash, t=crashT(c), side=c.side, rsd=-side;   /* (crashT: T - c.T, a long hold of the time model stretched: [hook:live]) */
    /* the bike: tips over toward its side, slides to a stop along the track, spins a little; lifted again for a remount */
    const ts=c.v0/7.5, tt=Math.min(t,ts), slide=c.v0*tt-3.75*tt*tt, slideEnd=c.v0*ts-3.75*ts*ts;
    const lift=c.kind==="remount"?sstep(3.2,3.9,t):0, rollB=side*(1.25*sstep(0,0.38,t))*(1-lift);
    const yawB=side*0.9*(1-Math.exp(-t*2.2))*(1-lift*0.8), hw0=(r.fr&&r.fr.hw)||4;
    const bl=c.kind==="remount"?hw0-0.6:hw0+1.5, latB=clamp(c.lat+side*Math.min(2.2,0.9*tt),-bl,bl);   /* a bike that will be ridden on stays on the dirt */
    trackXZ(c.D+slide,latB,tmpCB); const bx=tmpCB.px, bz=tmpCB.pz, gy=tmpCB.py, thB=tmpCB.th;
    // [hook:motion]
    /* the remount: as the bike is lifted it settles onto its own two wheels (the height and pitch of the dirt under them, as the riding branch
       will draw it), so riding on from here starts exactly where the lifted bike stands: no pop in height or pitch */
    let pzB=0.05*Math.sin(t*6)*(t<ts?1:0), yB=gy+0.32*Math.abs(Math.sin(rollB));
    if(lift>0){ const wf=trackXZ(c.D+slide+BIKE.WB/2,latB,tmpCW).py, wr=trackXZ(c.D+slide-BIKE.WB/2,latB,tmpCW).py; pzB+=(Math.atan2(wf-wr,BIKE.WB)-pzB)*lift; yB+=((wf+wr)/2-yB)*lift; }
    ce.set(rollB,-thB+yawB,pzB,"YZX"); cq.setFromEuler(ce);
    BM.compose(cv3.set(bx,yB,bz),cq,sc1);
    // [/hook:motion]
    /* the rider: over the bars, further than the bike slides, tumbling away from it; lying; up; then to the bike (remount) or off (out) */
    const tr=Math.min(t,1.4), thrown=c.v0*0.95*tr-2.7*tr*tr, thrownEnd=c.v0*0.95*1.4-2.7*1.96;
    let Dr=c.D+thrown+0.6, latR=clamp(c.lat+rsd*Math.min(2.1,1.5*tr),-hw0-1,hw0+1), face=null;
    let hy, bodyPitch=0, bodyRoll=0, spread=0, walk=0, stand=0, reach=0, phase=0;
    if(t<0.62){ /* thrown over the bars: up off the seat, rotating forward, down onto the dirt */
      const u=t/0.62; hy=Math.max(0.3,1.0+2.3*t-4.9*t*t); bodyPitch=-2.5*u; bodyRoll=rsd*0.5*u; spread=0.55+0.45*u; }
    else if(t<1.4){ /* the tumble: two rolls along the dirt, each bounce lower, ending face down (two whole turns: no jump into the lying pose) */
      const u=t-0.62, e=1-Math.pow(1-u/0.78,2), b=Math.abs(Math.sin(u*8.05))*0.42*Math.exp(-u*3.0);
      hy=0.26+b; bodyRoll=rsd*(0.5*(1-e)+4*PI*e); bodyPitch=-2.5+(2.5-PI/2)*sstep(0,0.78,u); spread=1; }
    else if(t<1.9){ hy=0.16; bodyRoll=0; bodyPitch=-PI/2; spread=0.7; }
    else if(t<2.7){ const u=sstep(1.9,2.7,t); hy=0.16+u*0.8; bodyPitch=-PI/2*(1-u); spread=0.7*(1-u); stand=u; }
    else { hy=0.96; stand=1;
      const D0=c.D+thrownEnd+0.6, L0=clamp(c.lat+rsd*2.1,-hw0-1,hw0+1);
      if(c.kind==="remount"){
        if(t>=3.9){ poseRider(R,i,BM,{stand:0.3,dab:0,lean:rollB,crouch:0.2,spinF:r.spinF,spinR:r.spinR}); shadowAt(R,i*2,bx,gy,bz,thB,2.1,0.9,1,0,0,LOOK.blobOp(bx,gy,bz)); shadowAt(R,i*2+1,0,-999,0,0,0,0,0); r.pos=r.pos||new THREE.Vector3(); r.pos.set(bx,gy+1,bz); r.th=thB; r.gy=gy; r.bikeP=(r.bikeP||new THREE.Vector3()).set(bx,gy+0.4,bz); crashState(i,c,t,bx,gy,bz,thB,bx,gy+1,bz); return; }
        const D1=c.D+slideEnd-0.1, L1=latB+rsd*0.7, u=sstep(2.7,3.3,t);
        Dr=D0+(D1-D0)*u; latR=L0+(L1-L0)*u; walk=t<3.3?1:0; phase=t*9; reach=sstep(3.1,3.5,t);
        face=t<3.3?Math.atan2(L1-L0,D1-D0):t<3.6?Math.atan2(-rsd,0.25):Math.atan2(-rsd*(1-sstep(3.6,3.9,t)),0.25+sstep(3.6,3.9,t));   /* walk back, face the bike, swing on */
      } else {
        const L1=rsd*(hw0+4.5), u=sstep(2.7,4.7,t);
        Dr=D0+1.2*u; latR=L0+(L1-L0)*u; walk=t<4.7?1:0; phase=t*8;
        face=t<4.9?Math.atan2(L1-L0,1.2):Math.atan2(-rsd*sstep(4.9,5.6,t),1-sstep(4.9,5.6,t)*0.9);   /* walk off the track, then turn to watch the race */
      }
    }
    trackXZ(Dr,latR,tmpCR); const hx=tmpCR.px, hz=tmpCR.pz, hgy=tmpCR.py, thR=tmpCR.th, bodyYaw=-(thR+(face!=null?face:0));
    c.bD=c.D+slide; c.bL=latB; c.rD=Dr; c.rL=latR;   /* where the bike and the rider are (the others steer round them) */
    // [hook:fx]
    FX.crashStep(c,t,dt,hx,hgy,hz,bx,gy,bz,thB,ts);   /* dust where the rider hits the dirt, a trail behind the sliding bike (r3d-fx.js) */
    // [/hook:fx]
    ce.set(bodyRoll,bodyYaw,bodyPitch,"YZX"); cq.setFromEuler(ce); CM.compose(cv4.set(hx,hgy+hy,hz),cq,sc1);
    poseRider(R,i,BM,{body:CM,limbs:{spread:spread,walk:walk,phase:phase,stand:stand,reach:reach},spinF:r.spinF,spinR:r.spinR});
    shadowAt(R,i*2,bx,gy,bz,thB+yawB,2.0,1.0,1,0,0,LOOK.blobOp(bx,gy,bz)); shadowAt(R,i*2+1,hx,hgy,hz,thR,1.0,0.8,clamp(1-hy/2,0.3,1),0,0,LOOK.blobOp(hx,hgy,hz));
    r.bikeP=(r.bikeP||new THREE.Vector3()).set(bx,gy+0.4,bz);
    r.pos=r.pos||new THREE.Vector3(); r.pos.set(hx,hgy+hy+0.4,hz); r.th=thR; r.gy=gy;
    crashState(i,c,t,bx,gy,bz,thB,hx,hgy+hy,hz);
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
    let k=0; const placed=[], pw=px*1.6*0.9, ph=px*1.05;   /* tags never touch (no stacks of plates over a pack) */
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
  V.state=function(){ const shot=CAMS.shot, shotLog=CAMS.shotLog; return {mode:mode,lap:lapNo,len:lenLaps,T:+T.toFixed(2),lapT:C?+(T-lapStartT(lapNo)).toFixed(1):0,finished:finished,shot:shot?{type:shot.type,t:+shot.t.toFixed(2),subj:shot.subj,why:shot.why||""}:null,shots:shotLog.slice(),
    yellow:yellow?{lap:yellow.lap,s:+yellow.s.toFixed(0)}:null,riders:rs.map(r=>({s:r.seat,D:+r.D.toFixed(1),ls:+(r.s||0).toFixed(1),g:+r.g.toFixed(2),v:+(r.v||0).toFixed(1),lat:+r.lat.toFixed(2),air:!!r.air,stand:+r.stand.toFixed(2),crash:r.crash?r.crash.kind:null,ct:r.crash?+(T-r.crash.T).toFixed(2):null,plan:r.crashPlan?r.crashPlan.kind:null,gone:r.gone})),
    course:V.courseInfo,running:running,flag:flag,lo:LO}; };
  V.order=function(){ return rs.filter(r=>!r.gone).slice().sort((a,b)=>b.D-a.D).map(r=>r.seat); };
  V.stats=function(){ const ft=stats.ft.slice().sort((a,b)=>a-b); return {calls:stats.calls,tris:stats.tris,jsMs:+stats.ms.toFixed(2),jsMsMax:+stats.msMax.toFixed(2),fps:+stats.fps.toFixed(1),frameMs50:ft.length?+ft[Math.floor(ft.length/2)].toFixed(1):0,frameMs90:ft.length?+ft[Math.floor(ft.length*0.9)].toFixed(1):0,pr:+QUAL.pr.toFixed(2),prCap:+QUAL.prCap.toFixed(2),prDrops:QUAL.stats.prDrops,W:W,H:H,geometries:renderer.info.memory.geometries,textures:renderer.info.memory.textures,frames:stats.frames}; };
  V.lapTime=function(){ return C?C.Tlap:0; };
  /* tests: move the clock (T) to where the subject meets a section, and hold a named shot there */
  V.shot=function(name,o){
    o=o||{}; if(!C) return null;
    const j=o.subj!=null?o.subj:leaderIdx(); if(j<0) return null;
    const n=Math.max(2,o.lap||lapNo); mode="race";
    const r=rs[j];
    let s, type=name, cam=null;
    if(name==="whoops"||name==="jump"||name==="rhythm"||name==="sand"){ const feat=C.feats.filter(f=>f.k===(name==="jump"?"jump":name)).sort((a,b)=>(b.big?1:0)-(a.big?1:0))[0]; if(!feat) return null; s=(feat.lip!=null?feat.lip:feat.from)-(o.ahead!=null?o.ahead:8); cam=CAMS.featCam(feat); if(name!=="whoops"&&name!=="jump") type="track"; }
    else if(name==="line"){ s=C.L-(o.ahead!=null?o.ahead:14); cam=CAMS.lineCam(); }
    else { s=o.s!=null?o.s:C.L*0.3; if(name==="track") cam=CAMS.trackCam(s+12,2.6); }
    const D=MX.Course.lapStartD(C,n)+s; T=MX.Course.tOfD(C,D)+r.g; lapNo=n; rs.forEach(x=>x.init=false);
    CAMS.setShot({type:type,subj:j,pri:99,min:1e9,max:1e9,cam:cam,why:"test"});
    renderOnce(); return {type:type,T:+T.toFixed(1),subj:j};
  };
  V.release=function(){ const shot=CAMS.shot; if(shot){ shot.pri=1; shot.min=0.5; shot.max=1; } };
  /* tests: move the race on by sec seconds in 1/60 s steps (the director and the camera run as in the game), then draw one frame */
  V.advance=function(sec,noDraw){ if(!C) return null; const n=Math.max(1,Math.round(sec*60)); for(let k=0;k<n;k++) step(sec/n); if(!noDraw) render(); return V.state(); };
  /* tests: run the race for sec seconds without drawing and report the lowest the camera came to the dirt (and where) */
  V.sweep=function(sec){ const shotLog=CAMS.shotLog, dirtTop=CAMS.dirtTop; if(!C) return null; let lo=1e9, at=null; const n=Math.max(1,Math.round(sec*30)); for(let k=0;k<n;k++){ step(sec/n); const p=cam.position, a=p.y-Math.max(dirtTop(p.x,p.z),-50); if(a<lo){ lo=a; at={shot:CAMS.shot?CAMS.shot.type+(CAMS.shot.why?":"+CAMS.shot.why:""):"",x:+p.x.toFixed(1),z:+p.z.toFixed(1),T:+T.toFixed(1)}; } } return {lowest:+lo.toFixed(2),at:at,shots:shotLog.slice()}; };
  /* test hook: where seat k is on screen (NDC -1..1; in = inside the frame) and how far from the camera; the marshal too */
  V.proj=function(k){ const i=rs.findIndex(r=>r.seat===k); if(i<0||!rs[i].pos) return null; cam.updateMatrixWorld(); const d=cam.position.distanceTo(rs[i].pos), p=rs[i].pos.clone().project(cam);
    let m=null; if(marshal&&marshal.grp.visible){ const q=marshal.grp.position.clone(); q.y+=1.4; const mp=q.project(cam); m={x:+mp.x.toFixed(2),y:+mp.y.toFixed(2),in:Math.abs(mp.x)<1&&Math.abs(mp.y)<1&&mp.z<1}; }
    return {x:+p.x.toFixed(2),y:+p.y.toFixed(2),in:Math.abs(p.x)<1&&Math.abs(p.y)<1&&p.z<1,d:+d.toFixed(1),marshal:m}; };
  V.renderNow=renderOnce;
  /* tests: where the camera is, how far above the dirt under it, the shadows */
  V.camInfo=function(){ const p=cam.position, shot=CAMS.shot, dirtTop=CAMS.dirtTop; return {x:+p.x.toFixed(1),y:+p.y.toFixed(2),z:+p.z.toFixed(1),aboveDirt:+(p.y-Math.max(dirtTop(p.x,p.z),-50)).toFixed(2),fov:+cam.fov.toFixed(1),shot:shot?shot.type+(shot.why?":"+shot.why:""):"",shadows:LOOK.shadows,shHalf:LOOK.shHalf,weakGPU:QUAL.weakGPU}; };
  V.setShadows=function(on){ LOOK.setShadows(on); };
  V.fixPR=function(p){ QUAL.fix(p,W,H); };
  // [hook:perf]
  /* THE QUALITY TIERS (r3d-quality.js, CONTRACT.md section 3 and 9.4): V.qualityNames() -> ["firetv","balanced","high","ultra"]; V.setQuality(name) (also "auto", and the old names stick / low / medium) applies the
     run-time flags at once (render scale, shadows, the ladder) and rebuilds the world when the tier's build flags differ and no race is running; V.quality() = what was chosen and why;
     V.bench({seconds}) / V.benchResult(): the in-game benchmark (?bench=1 starts it by itself). The capture harness (demo.js, perf.js, shots.js) calls V.setQuality(name) right after V.setRace. */
  V.qualityNames=()=>QUAL.names();
  V.qualityLabel=name=>QUAL.label(name);
  V.quality=()=>QUAL.summary();
  V.setQuality=function(name){
    const was=QUAL.tierName, r=QUAL.set(name);
    let rebuilt=false;
    if(lastRace&&QUAL.buildKey(LO)!==builtTier&&(mode==="gate"||mode==="idle")){ V.setRace(lastRace); rebuilt=true; }   /* the build flags changed and nothing is racing: build the new world now (a race in progress keeps its world until the next setRace) */
    return {tier:QUAL.tierName,label:QUAL.label(QUAL.tierName),was:was,changed:r.changed,rebuilt:rebuilt,pendingRebuild:QUAL.buildKey(LO)!==builtTier};
  };
  /* THE WARM-UP (r3d-perf-warm.js, milestone 2): every program the tier's ladder can reach (real shadows on / off, the frame into the post chain or to the screen, the crowd's animation on / off,
     the post chain's depth of field and bloom on / off, the shadow pass, the hidden objects) is compiled while the gate shows, and the post chain's pass programs are kept alive so a ladder step
     compiles nothing. V.warm() -> Promise of the report (one slice per task: game.js calls it right after setRace), V.warmSync() -> the report (tools; the capture page warms inside setRace). */
  function warmCtx(){
    const P=QUAL.warmPlan(), base=(LOOK.tiers&&LOOK.tiers[LOOK.tier])||null, g=raceGen, u=a=>a.filter((x,i)=>a.indexOf(x)===i);
    const lookSet=lv=>({post:(lv.post.on&&base)?base.post:"off",dof:!!(base&&lv.post.dof&&base.dof),bloom:(lv.post.bloom&&base)?base.bloom*(lv.post.bloomScale<1?0.6:1):0});   /* = driveLive() */
    const sets=[], keys=[]; P.lives.forEach(lv=>{ const f=lookSet(lv), k=JSON.stringify(f); if(f.post!=="off"&&keys.indexOf(k)<0){ keys.push(k); sets.push(f); } });
    const wf=world&&world.frame;
    return {scene:scene,cam:cam,look:LOOK,setShadows:on=>LOOK.setShadows(on),shadowsOn:()=>LOOK.shadows,shadowStates:u(P.shadows.map(x=>!!x&&!LO)),
      targetStates:u(P.lives.map(lv=>lookSet(lv).post!=="off")),
      crowd:(wf&&P.crowd.length>1)?(on=>{ QUAL.live.crowdAnim=on; wf(0,now()/1000,cam,null,null,null,null); }):null, crowdNow:QUAL.live.crowdAnim, crowdStates:P.crowd,
      postSets:sets, applyFlags:f=>{ if(LOOK.setFlags) LOOK.setFlags(f); }, restoreFlags:()=>driveLive(), alive:()=>g===raceGen&&!V.lost};
  }
  V.warm=()=>{ try{ if(!R||!C||V.lost){ if(drawHold) releaseHold(); return Promise.resolve(false); } warmPending=false;
      const g=raceGen, p=QUAL.warm(warmCtx(),true);
      if(drawHold){ warmHold=p; const done=()=>{ if(warmHold===p) warmHold=null; if(g===raceGen&&drawHold) releaseHold(); }; p.then(done,done); setTimeout(done,20000); }   /* (the warm hold ends with the warm; 20 s at most) */
      return p; }catch(e){ if(drawHold) releaseHold(); return Promise.resolve(false); } };
  V.warming=()=>!!(drawHold&&warmHold);   /* the game: true while the new race waits for its shaders (show "lining up", the drop waits by itself) */
  V.warmSync=()=>{ if(!R||!C||V.lost) return null; warmPending=false; return QUAL.warm(warmCtx(),false); };
  V.bench=o=>QUAL.bench.start(o);
  V.benchResult=()=>QUAL.bench.result;
  V.perfRaces=()=>QUAL.bench.races();   /* how the last races really ran on this device (the passive record in r3d-perf-bench.js: no page to open, nothing on screen) */
  /* (milestone 2 merge) the 2D track as the automatic fallback for a device too slow for 3D: V.tooSlow() -> null | {why, ms, w, h, pr} once the FIRE TV tier has sat at its floor with frames
     still too long for 10 s (r3d-quality.js); hooks.slow(info) is called once then (after the frame). The game decides (the next race in 2D); this view keeps drawing the race it is in. */
  V.tooSlow=()=>QUAL.tooSlow||null;
  QUAL.onChange((what,info)=>{ if(what==="slow"&&hooks.slow) setTimeout(()=>{ try{ hooks.slow(info); }catch(e){} },0); });
  /* The look (r3d-look.js) may have its own tier table (high / medium / low / stick): our tier drives it, and the ladder's cuts (post chain, bloom, depth of field) are forwarded as flags it understands.
     Guarded: a look without setTier / setFlags is left alone (the base look). The post flags of a tier are the MOST it may draw; the ladder only switches them off. */
  const LOOKTIER={firetv:()=>QUAL.dev.tv?"stick":"low",balanced:()=>"medium",high:()=>(QUAL.dev.mobile||QUAL.dev.tv)?"medium":"high",ultra:()=>"ultra"};
  function driveLook(){ if(LOOK.setTier&&LOOK.tiers){ try{ const nm=LOOKTIER[LO?"firetv":QUAL.tierName](); LOOK.setTier(nm); driveLive(); }catch(e){} } }
  function driveLive(){
    if(!LOOK.setFlags||!LOOK.tiers) return;
    try{ const base=LOOK.tiers[LOOK.tier], lv=QUAL.live; if(!base) return;
      LOOK.setFlags({post:lv.post.on?base.post:"off",dof:!!(lv.post.dof&&base.dof),bloom:lv.post.bloom?base.bloom*(lv.post.bloomScale<1?0.6:1):0}); }catch(e){}
  }
  QUAL.onChange((what)=>{ if(what==="tier") driveLook(); else if(what==="rung") driveLive(); });
  QUAL.bindLook(LOOK); driveLook();
  QUAL.attach({V:V,cam:cam,mode:()=>mode,T:()=>T,W:()=>W,H:()=>H,count:()=>N,lodList:()=>RST});
  // [/hook:perf]
  // [hook:live]
  /* THE LIVE GAME'S RACE ENTRY (mxlive 2026-10-19; measured on the real game page: BG_audit/sprint/mxlive/fix). What still blocked the page after the warm hold, and the fix:
     1. THE WORLD IN STEPS. V.prepareWorld(o) -> Promise: the world of the race o (the course, the surroundings, the stadium, the track's dirt and meshes: 1.5-3 s of work here)
        is built over several tasks (soilWarmSteps, buildWorldSteps / addTrackSteps / trackMeshSteps: generators, one step a task) while the old world stays whole and nothing draws; the
        last step puts it in place. The game calls it before V.setRace(o), which then finds the world built (the same key) and makes the riders only. It mirrors setRace's
        world block (the key, Course.build with the round's lap time, buildWorld, the grid, LOOK.apply, the flaggers): KEEP THEM IN STEP when that block changes upstream.
     2. FIRST USE WHILE NOTHING DRAWS. three.js asks the driver about a program (its info log, its uniform and attribute tables: synchronous round trips to the GPU process)
        the first time it DRAWS with it. Inside a frame each call waits behind every draw already queued: the first frames of a race first-used about 47 programs and blocked
        the page 3-5 s (ANGLE / D3D11 here), and a ladder step (real shadows off, a new size) that first-uses programs the warm had only compiled stalled 1-2 s. Once the
        warm's parallel compiles are ready, every program is first-used NOW, a few per task, while the warm hold draws nothing (QUAL.warm is wrapped: the hold ends after it).
     3. AN ENVIRONMENT MAP TO PREFILTER (the bike's painted night stadium, an equirectangular canvas, on the BALANCED tier) is converted the first time a material using it is
        compiled, with a program compiled and drawn on the spot: inside the warm's compile it waited 1.6-1.8 s for the GPU process (busy with the parallel compiles just
        sent). Those objects are compiled first, in a task of their own.
     4. 2D CANVASES READ BACK. The view paints its once-a-page atlases (the crowd, the liveries, the mud) on 2D canvases and reads them back (getImageData): a GPU canvas reads
        back through the GPU process, 0.4-0.6 s each here. Until the first race is built, a 2D canvas made while the view builds is a CPU canvas (willReadFrequently). */
  {
    const HC=GL.HTMLCanvasElement&&GL.HTMLCanvasElement.prototype;
    if(HC&&HC.getContext&&!HC.getContext.__mxLive){ const gc0=HC.getContext; const gc=function(t,o){ if((GL.__mxWRF|0)>0&&!GL.__mxWRFdone&&t==="2d") o=Object.assign({willReadFrequently:true},o||{}); return gc0.call(this,t,o); }; gc.__mxLive=true; HC.getContext=gc; }
    const building=fn=>{ GL.__mxWRF=(GL.__mxWRF|0)+1; try{ return fn(); } finally { GL.__mxWRF=Math.max(0,(GL.__mxWRF|0)-1); } };
    let prepTok=0, gap=false, BWS=null, SWS=null, PM=null, WB=null, inflight=null, sizeOK=0;
    try{ import("./r3d-world.js").then(m=>{ BWS=m&&m.buildWorldSteps||null; },()=>{}); import("./r3d-track.js").then(m=>{ SWS=m&&m.soilWarmSteps||null; PM=m&&m.padMaps||null; },()=>{}); import("./r3d-bike.js").then(m=>{ WB=m&&m.warmBike||null; },()=>{}); }catch(e){}
    const setRace0=V.setRace, resize0=V.resize;
    V.setRace=function(){ prepTok++; inflight=null; gap=false; const r=building(()=>setRace0.apply(V,arguments)); GL.__mxWRFdone=true; return r; };   /* (a setRace cancels a world still being prepared) */
    /* V.resize: between the world's last step and setRace the old riders are gone (setRace resizes); and the SAME size re-allocates nothing: the game lays its page out
       after every lap (layoutArena), and a canvas given its own size again re-allocates its drawing buffer, which waits for the GPU (0.9-1.2 s here while the warm compiles) */
    V.resize=function(){
      if(gap) return;
      const w=Math.max(1,Math.round(host.clientWidth)), h=Math.max(1,Math.round(host.clientHeight));
      if(w===W&&h===H&&!warmPending&&C&&!V.lost){ CAMS.snap(); renderOnce(); return; }
      sizeOK++; try{ return resize0.apply(V,arguments); } finally { sizeOK--; }   /* (the view's own resize sets its size at once: 6 below) */
    };
    /* V.worldKey(o): the key of the world race o needs (setRace's key); V.prepareWorld(o) for a world already built or being built is that build (no new one) */
    const keyOf=o=>{ const lo=motion()!=="full", pick=MX.Layouts.pick(o.series,o.year,o.round,o.cal||{}); return {lo:lo,pick:pick,key:pick.layout.id+"|"+(pick.look.around)+"|"+(lo?"lo":"hi")+"|"+(o.lapT>0?Math.round(o.lapT):"")+"|"+QUAL.buildKey(lo)}; };   /* (= setRace's key) */
    V.worldKey=o=>{ try{ return keyOf(o).key; }catch(e){ return null; } };
    V.worldReady=o=>{ try{ return keyOf(o).key===worldKey; }catch(e){ return false; } };
    /* the canvas at the race's size AHEAD, in a task of its own (V.prepareWorld's last step): a new drawing buffer took 0.8 s inside setRace's V.resize on the TV here (setRace's
       own resize then finds the size made: nothing to re-allocate). As V.resize does it (the ladder's ratio for this size); a hidden page (the season screen: no size) waits for setRace */
    const sizeAhead=()=>{ const w=Math.max(1,Math.round(host.clientWidth)), h=Math.max(1,Math.round(host.clientHeight)); if(w<8||h<8||V.lost) return false;
      const pr=QUAL.resize(w,h,W,H,LO); if(w===W&&h===H&&Math.abs(renderer.getPixelRatio()-pr)<1e-4) return false;
      W=w; H=h; sizeOK++; try{ renderer.setPixelRatio(pr); renderer.setSize(W,H,false); } finally { sizeOK--; } cv.style.width=W+"px"; cv.style.height=H+"px"; LOOK.resize(W,H,pr); cam.aspect=W/H; cam.updateProjectionMatrix(); return true; };
    V.prepareWorld=function(o){
      try{ if(o&&inflight&&inflight.key===keyOf(o).key) return inflight.p; }catch(e){}
      const tok=++prepTok; let me=null;
      const p=new Promise(res0=>{
        const res=v=>{ if(inflight===me) inflight=null; res0(v); };
        try{
          if(!o||V.lost){ res(false); return; }
          const lo=motion()!=="full"; if(lo!==LO){ LO=lo; worldKey=""; LOOK.setShadows(QUAL.shadowsWanted(LO)); if(typeof driveLook==="function") driveLook(); }   /* (as setRace) */
          const K=keyOf(o), pick=K.pick, key=K.key;
          if(key===worldKey){ setTimeout(()=>{ try{ if(tok===prepTok) sizeAhead(); }catch(e){} res(true); },0); return; }   /* (the world is there: the canvas size only, in a task of its own) */
          me={key:key,p:null}; inflight=me;
          raceGen++; drawHold=holdWanted(); warmHold=null;   /* nothing draws while the world is replaced (a warm in flight for the old race stops) */
          const q=QUAL.options(LO), alive=()=>tok===prepTok&&!V.lost;
          let C2=null, it=null, w2=null, n=0, sit=SWS?SWS(q):null, wb=false, wp=false;   /* (first the soil tiles the world needs: once a page, in steps) */
          const fail=e=>{ try{ console.warn("mxwar 3D: prepareWorld",e); }catch(x){} res(false); };   /* (setRace then builds it the old way) */
          const commit=()=>{
            if(R){ disposeTree(R.grp); scene.remove(R.grp); R=null; }   /* the old race's riders, particles and gate go with the old world (setRace makes new ones) */
            if(FX){ if(FX.dispose) FX.dispose(); disposeTree(FX.group); scene.remove(FX.group); FX=null; }
            if(world){ disposeTree(world.root); scene.remove(world.root); } gate=null;
            C=C2; look=pick.look; world=w2; worldKey=key; gap=true;
            scene.add(world.root); builtTier=QUAL.buildKey(LO); QUAL.fitTextures(world.root);
            CAMS.buildGrid();
            LOOK.apply(C,look,world,{lo:LO,tv:tv(),deferEnv:drawHold});
            const flo=!!QUAL.options(LO).lo;
            flagger=flaggerBuild(flagT("white"),{lo:flo}); flagger.grp.position.copy(world.fin.flagAt).add(v3.set(0,-0.02,0)); flagger.grp.rotation.y=-world.fin.th+(world.fin.side>0?PI:0); world.root.add(flagger.grp);
            marshal=flaggerBuild(flagT("yellow"),{marshal:true,lo:flo}); marshal.grp.visible=false; world.root.add(marshal.grp);
          };
          const step=()=>{
            if(!alive()){ res(false); return; }
            let done=false;
            try{
              building(()=>{
                if(sit){ const r=sit.next(); if(r.done) sit=null; return; }
                if(!wb){ wb=true; if(WB) WB(q.lo); return; }   /* the bike's once-a-page textures (r3d-bike.js warmBike: setRace's riders then skip them) */
                if(!wp){ wp=true; if(PM) PM(pick.look.soil||"stadium-dirt"); return; }   /* the gate pad's maps for this soil (r3d-track.js padMaps, once a soil: as gateBuild) */
                if(!C2){ C2=MX.Course.build(pick.layout); if(o.lapT>0&&Math.abs(C2.Tlap/o.lapT-1)>0.04){ const want=clamp(o.lapT,C2.Tlap*0.87,C2.Tlap*1.15); C2=MX.Course.build(Object.assign({},pick.layout,{vavg:C2.L/want})); } return; }
                if(!w2){ if(!it&&BWS) it=BWS(C2,pick.look,q); if(it){ const r=it.next(); if(r.done) w2=r.value; } else w2=buildWorld(C2,pick.look,q); return; }
                commit(); done=true;
              });
            }catch(e){ fail(e); return; }
            n++;
            if(done){ V.prepared={key:key,steps:n}; setTimeout(()=>{ try{ if(alive()) sizeAhead(); }catch(e){} res(true); },0); return; }   /* (then the canvas size, in a task of its own) */
            setTimeout(step,0);
          };
          setTimeout(step,0);
        }catch(e){ try{ console.warn("mxwar 3D: prepareWorld",e); }catch(x){} res(false); }
      });
      if(me) me.p=p;
      return p;
    };
    const used=new WeakSet();
    /* first-use every ready program until `until` (ms of now()): 0 = all done, 1 = out of time (more ready ones left), 2 = only programs still compiling left */
    const firstUse=until=>{ const ps=(renderer.info&&renderer.info.programs)||[], gl=renderer.getContext(); let wait=false;
      for(const p of ps){ if(!p||used.has(p)) continue; let ok=true; try{ ok=!p.isReady||p.isReady(); }catch(e){ ok=true; } if(!ok){ wait=true; continue; }
        if(now()>until) return 1;
        /* a program that did not link is left alone: the warm compiles some variants no frame ever draws (renderer.compile() takes every object, the shadow
           proxies' colour programs too); three.js reports one only if a frame really draws with it, as before */
        let linked=true; try{ linked=gl.getProgramParameter(p.program,gl.LINK_STATUS)!==false; }catch(e){ linked=true; }
        if(linked) try{ p.getUniforms(); p.getAttributes(); }catch(e){}
        used.add(p); }
      return wait?2:0; };
    const preEnv=(ctx)=>{ const sc=ctx&&ctx.scene, cm=ctx&&ctx.cam; if(!sc||!cm) return 0; const objs=[];
      sc.traverse(o=>{ const ms=o.material?(Array.isArray(o.material)?o.material:[o.material]):[]; if(ms.some(m=>m&&m.isMeshStandardMaterial&&m.envMap&&m.envMap.isTexture&&m.envMap.mapping!==THREE.CubeUVReflectionMapping)) objs.push(o); });
      objs.forEach(o=>{ try{ renderer.compile(o,cm,sc); }catch(e){} }); return objs.length; };
    /* 5. EVERY PROGRAM READY BEFORE ANY DRAW. The warm (r3d-perf-warm.js) compiles in parallel and waits at most 15 s, then DRAWS (one shadow draw, the post chain's passes):
       on a GPU still compiling (a slow one, or one shared with other work) those draws waited synchronously for every program still in the queue (a 10-51 s task here).
       So every state the ladder can reach is compiled first (the current one, then the rest: as the warm's compileStates) and the warm starts once they are all ready
       (polled, the page live): it then finds them compiled and ready, and its draws are quick. The hold waits for them up to WARM_MAX (V.warm below, as the view's
       own with a longer cap than its 20 s: on a GPU shared with other work the compiles took 18-50 s here, and a hold ended early made the first frame wait for
       them synchronously: one 5.6 s task). Past WARM_MAX the hold goes on only while programs are still compiling (polled; the page stays live: on a GPU shared
       with other work here the compiles took over 60 s once, and a hold ended at 30 s made the first frame wait 31.7 s for them), WARM_HARD at the most. */
    let tgt=null;
    const uniq=a=>a.filter((x,i)=>a.indexOf(x)===i);
    const compileAs=(sc,cm,into)=>{ const prev=renderer.getRenderTarget(); if(into&&!tgt) tgt=new THREE.WebGLRenderTarget(16,16,{type:THREE.HalfFloatType,depthBuffer:true,stencilBuffer:false,generateMipmaps:false}); renderer.setRenderTarget(into?tgt:null); try{ renderer.compile(sc,cm); } finally { renderer.setRenderTarget(prev); } };
    const compileNow=ctx=>{ const tg0=!!(ctx.look&&ctx.look.post); compileAs(ctx.scene,ctx.cam,tg0); };
    const compileRest=ctx=>{ const sh0=ctx.shadowsOn(), tg0=!!(ctx.look&&ctx.look.post), shs=uniq([sh0].concat(ctx.shadowStates||[])), tgs=uniq([tg0].concat(ctx.targetStates||[])), crs=ctx.crowd?uniq([ctx.crowdNow].concat(ctx.crowdStates||[])):[null];
      try{ for(const sh of shs){ if(sh!==ctx.shadowsOn()) ctx.setShadows(sh); for(const tg of tgs) for(const cr of crs){ if(sh===sh0&&tg===tg0&&(cr==null||cr===ctx.crowdNow)) continue; if(cr!=null) ctx.crowd(cr); compileAs(ctx.scene,ctx.cam,tg); } } }
      finally{ if(ctx.shadowsOn()!==sh0) ctx.setShadows(sh0); if(ctx.crowd&&ctx.crowdNow!=null) ctx.crowd(ctx.crowdNow); } };
    const WARM_MAX=30000, WARM_HARD=75000;
    /* = the view's V.warm (the warm hold), with the cap WARM_MAX instead of 20 s (WARM_HARD while programs still compile) */
    V.warm=()=>{ try{ if(!R||!C||V.lost){ if(drawHold) releaseHold(); return Promise.resolve(false); } warmPending=false;
        const g=raceGen, t0=now(), p=QUAL.warm(warmCtx(),true);
        if(drawHold){ warmHold=p; const done=()=>{ if(warmHold===p) warmHold=null; if(g===raceGen&&drawHold) releaseHold(); };
          const cap=()=>{ if(g!==raceGen||warmHold!==p) return; if(notReady()>0&&now()-t0<WARM_HARD){ setTimeout(cap,500); return; } done(); };
          p.then(done,done); setTimeout(cap,WARM_MAX); }
        return p; }catch(e){ if(drawHold) releaseHold(); return Promise.resolve(false); } };
    const notReady=()=>{ const ps=(renderer.info&&renderer.info.programs)||[]; let n=0; for(const p of ps){ try{ if(p&&p.isReady&&!p.isReady()) n++; }catch(e){} } return n; };
    const warm0=QUAL.warm;
    QUAL.warm=function(ctx,async){
      if(!async){ preEnv(ctx); const rep=warm0.call(QUAL,ctx,false); firstUse(Infinity); return rep; }
      const tick=()=>new Promise(r=>setTimeout(r,0)), live=()=>!V.lost&&!(ctx&&ctx.alive&&!ctx.alive()), t00=now(), pre={};
      const ready=()=>new Promise(r=>{ const t0=now(); const poll=()=>{ if(!live()){ r(); return; } const n=notReady(); pre.notReady=n; if(n===0||now()-t00>WARM_HARD-4000){ pre.readyMs=+(now()-t0).toFixed(0); r(); return; } setTimeout(poll,50); }; poll(); });
      return tick().then(()=>{ if(live()) preEnv(ctx); }).then(tick).then(()=>{ if(live()) try{ compileNow(ctx); }catch(e){} }).then(tick).then(()=>{ if(live()) try{ compileRest(ctx); }catch(e){} }).then(ready)
        .then(()=>warm0.call(QUAL,ctx,true)).then(rep=>new Promise(res=>{ const t0=now(); let n=0; if(rep&&typeof rep==="object") rep.pre=pre;
        const step=()=>{ if(V.lost||(ctx&&ctx.alive&&!ctx.alive())){ res(rep); return; } const r=firstUse(now()+12); n++;
          if(r&&now()-t0<6000) setTimeout(step,r===2?30:0); else { if(rep&&typeof rep==="object"){ rep.firstUseMs=+(now()-t0).toFixed(1); rep.firstUseSlices=n; } res(rep); } };
        step(); }));
    };
    /* 6. A NEW SIZE NEVER STALLS THE RACE. A resolution step of the ladder (r3d-quality.js applyPR: renderer.setPixelRatio, at a camera cut) gives the canvas a new drawing
       buffer, and that call waits until the GPU process has done every frame already queued: 0.6-2.5 s mid-race here (the BALANCED phone race, the TV), the review's
       mid-race stalls; with nothing queued it takes about 10 ms. So the new ratio is applied when nothing is queued: at the ladder's request a fence goes into the
       queue and the next frames are not DRAWN (the picture holds still; the race, its riders, the director and the moments for the announcers go on step by step, as
       do the page, the clock and the tower; the ladder does not measure meanwhile) while the fence is polled once a frame (never waited for); once the GPU has done the
       frames before it, the canvas takes its new size and that frame is drawn at it. A GPU still busy after a try (3 frames, 0.4 s at least; longer at each try, 2 s
       at most: one shared with other work): the picture draws on at the size it has and tries again 2 s later (then every 4 s; the next race's own resize applies it
       at the latest). Only with the ladder at its floor does the third try take the size even then (a stall: there the old size would make the ladder demote the
       tier, or call the device too slow for 3D, after 10 s of long frames; elsewhere a busy GPU stalled 1.6-5.3 s here on a forced size). The view's own resize (a new layout, a new race: it applies the
       ladder's current ratio) and V.fixPR (tests) set the size at once, as before. V.sizeLog: the last tries (fence wait, apply ms, ok). */
    {
      const gl=renderer.getContext(), sPR=renderer.setPixelRatio, sSZ=renderer.setSize;
      let want=0, tries=0, fence=null, fT=0, tryMs=0, nextT=0;
      const unfence=()=>{ if(fence){ try{ gl.deleteSync(fence); }catch(e){} fence=null; } };
      const drop=()=>{ want=0; tries=0; nextT=0; unfence(); };
      const frameMs=()=>{ const a=stats.ft.slice(-12).sort((x,y)=>x-y); return a.length?a[a.length>>1]:16.7; };
      const log=o=>{ V.sizeLog.push(o); if(V.sizeLog.length>24) V.sizeLog.shift(); };
      const apply=()=>{ const p=want, n=tries, t0=now(); drop(); sizeOK++;
        try{ sPR.call(renderer,p); sSZ.call(renderer,W,H,false); }catch(e){} finally { sizeOK--; }
        log({t:Math.round(t0),wait:Math.round(t0-fT),ms:+(now()-t0).toFixed(1),ok:true,tries:n+1,pr:+p.toFixed(3)}); };
      V.sizeLog=[];
      renderer.setPixelRatio=function(p){
        if(sizeOK||V.lost||!gl.fenceSync){ drop(); return sPR.call(renderer,p); }
        if(Math.abs(p-renderer.getPixelRatio())<1e-4){ drop(); return; }   /* (a step back to the size it has: nothing to do) */
        want=p; nextT=0; unfence();   /* (the ladder's own state says p already: QUAL.summary().pr; the tries so far still count) */
      };
      renderer.setSize=function(w,h,u){ if(want&&!sizeOK) return; return sSZ.call(renderer,w,h,u); };   /* (the ladder's setSize after its ratio: the same size, nothing to do) */
      const fix0=QUAL.fix; QUAL.fix=function(){ sizeOK++; try{ return fix0.apply(QUAL,arguments); } finally { sizeOK--; } };
      const lr0=LOOK.render; LOOK.render=function(){ if(fence) return; return lr0.apply(LOOK,arguments); };   /* (waiting for the fence: nothing drawn) */
      const ad0=QUAL.adapt; QUAL.adapt=function(){ if(fence) return; return ad0.apply(QUAL,arguments); };   /* (nor measured: no frame was drawn) */
      const skip0=QUAL.skipFrame;
      QUAL.skipFrame=function(t){
        if(want&&!V.lost&&now()>=nextT){
          if(!fence){ try{ fence=gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE,0); gl.flush(); }catch(e){ fence=null; } fT=now(); tryMs=Math.min(2000,Math.max(400,3*frameMs())*(1<<Math.min(tries,2))); if(!fence) apply(); }
          else {
            let s=true; try{ s=gl.getSyncParameter(fence,gl.SYNC_STATUS)===gl.SIGNALED; }catch(e){ s=true; }
            if(s) apply();
            else if(now()-fT>=tryMs){
              let floor=false; if(tries>=2) try{ const q=QUAL.summary(); floor=!!q&&q.rungs>0&&q.rung>=q.rungs-1; }catch(e){ floor=false; }
              if(!floor){ unfence(); tries=Math.min(tries+1,9); nextT=now()+(tries<3?2000:4000); log({t:Math.round(fT),wait:Math.round(now()-fT),ok:false,tries:tries,pr:+want.toFixed(3)}); } else apply(); }
          }
        }
        return skip0.call(QUAL,t);
      };
    }
  }
  // [/hook:live]
  V.dispose=function(){ V.stop(); if(world) disposeTree(world.root); if(R) disposeTree(R.grp); if(FX) disposeTree(FX.group); LOOK.dispose(); renderer.dispose(); cv.remove(); };
  V.renderer=renderer; V.scene=scene; V.camera=cam;
  V._dbg={riders:()=>R,fx:()=>FX,look:()=>LOOK,quality:()=>QUAL,cams:()=>CAMS,state:()=>RST,gate:()=>gate,world:()=>world,marshal:()=>marshal,target:()=>CAMS.target.clone(),sees:(a,b)=>CAMS.sees(a,b),dirt:(x,z)=>CAMS.dirtTop(x,z),hf:(x,z)=>world.ctx.hf?world.ctx.hf(x,z):null,yellow:()=>yellow,shot:()=>CAMS.shot,pos:k=>{ const r=rs.find(x=>x.seat===k); return r&&r.pos?{x:+r.pos.x.toFixed(2),y:+r.pos.y.toFixed(2),z:+r.pos.z.toFixed(2),crash:r.crash?r.crash.kind:null}:null; },
    clearance:(k,full)=>{ const r=rs.find(x=>x.seat===k); if(!r||!r.crash||!r.pos) return null; const P=[r.pos,r.bikeP].filter(Boolean); let m=1e9, who=null;
      rs.forEach(o=>{ if(o===r||o.crash||o.gone||!o.pos) return; P.forEach((p,pi)=>{ const d=Math.hypot(o.pos.x-p.x,o.pos.z-p.z); if(d<m){ m=d; who={seat:o.seat,D:+o.D.toFixed(1),lat:+o.lat.toFixed(2),latT:+o.latT.toFixed(2),what:pi?"bike":"rider"}; } }); });
      if(!full) return +m.toFixed(2); const c=r.crash; return {m:+m.toFixed(2),who:who,crash:{D:+c.D.toFixed(1),bD:c.bD!=null?+c.bD.toFixed(1):null,bL:c.bL!=null?+c.bL.toFixed(2):null,rD:c.rD!=null?+c.rD.toFixed(1):null,rL:c.rL!=null?+c.rL.toFixed(2):null,t:+(T-c.T).toFixed(2)},hw:r.fr?+r.fr.hw.toFixed(2):null}; }};   /* tests only */
  return V;
}
