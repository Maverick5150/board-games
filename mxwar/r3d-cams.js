/* MOTOCROSS WAR 3D — THE CAMERAS (owner: cams): a TV broadcast of a supercross night. The cover chase (the default: low behind the rider,
   3.5 m back, 1.5 m up, 70 degrees, the rider big in the right third, the pack ahead and the lit stadium in the frame), trackside broadcast
   long lenses that pan with the pack, the corner camera low inside a berm, the jump camera low at the landing, the high stadium-wide
   from the grandstand, the onboard (82 degrees, stabilised), the replay (slow motion from recorded frames, render time only), the gate,
   the holeshot, the crash with the marshal's yellow flag, the line. THE DIRECTOR cuts every 4-8 s between them (reserved shots: the gate
   drop, the holeshot, a featured pass, a crash and the yellow flag, the leader at the line, the white and checkered flags), keeps the
   person's rider on screen often and never films an empty track. Every camera is a damped rig (critically damped springs: no jitter, no
   snapping), keeps clear of the dirt, the berms and the walls, and rolls a little with the bike, shakes a little on a landing.
   createCams(VIEW) -> CAMS. VIEW = the view's LIVE state (getters; race3d.js owns it, read-only here, never assign): cam (the THREE camera),
   C, world, rs (the riders' records), st (the per-rider state), R, FX (the riders' and particles' meshes: the replay), gate, marshal, T (the
   race clock), lapNo, lenLaps, mode ("gate" | "race" | "idle"), holdInfo, yellow, lapPlan, meSeats, W, H, flag, finished, tv, leaderIdx().
   CAMS.director(dt), CAMS.camera(dt) (every frame, in that order); CAMS.shot, setShot(s), pickShot(force), force(spec) (tests), shotLog, featLog,
   target (the aim point: the shadow box follows it), focus (the subject: where a depth of field would focus), camS, snap(), buildGrid() (a new
   course), reset() (a new race), modes() / mode(id) / nextMode() (the presets for the remote and the phone button), replayNow(), state();
   spots and tests: sees, safeCam, dirtTop, terrainAt, inFloor, trackCam, featCam, cornerCam, lineCam, crashCam, yellowCam, gateCam, turn1Cam, spotCam, secPt. */
import * as THREE_NS from "../ui/vendor/three-0.160.0.module.min.js";
const THREE=THREE_NS;
import {clamp,sstep,now,clear,clearDist} from "./r3d-util.js";
import {motionMode} from "./r3d-quality.js";
const MX=(typeof window!=="undefined"?window:globalThis).MXWar;
const PI=Math.PI, TAU=PI*2, R2D=180/PI;
const motion=motionMode;
const lerp=(a,b,t)=>a+(b-a)*t;
const wrapA=a=>{ a%=TAU; if(a>PI) a-=TAU; else if(a<-PI) a+=TAU; return a; };
/* a critically damped follower (smooth-damp): x closes on the target with time constant tau, never overshoots, its velocity is continuous */
class Sd{
  constructor(x){ this.x=x||0; this.v=0; }
  snap(x){ this.x=x; this.v=0; return x; }
  step(target,tau,dt){ if(!(dt>0)) return this.x; const om=2/Math.max(0.02,tau), e=om*dt, k=1/(1+e+0.48*e*e+0.235*e*e*e), ch=this.x-target, tmp=(this.v+om*ch)*dt; this.v=(this.v-om*tmp)*k; this.x=target+(ch+tmp)*k; return this.x; }
  stepA(target,tau,dt){ return this.step(this.x+wrapA(target-this.x),tau,dt); }   /* an angle: the short way round (x may leave -PI..PI, only its sin / cos are used) */
}
/* the stadium bowl's profile (distance back from the wall, height): the stadium builds the stands from it (r3d-world.js stadium(), `prof`); a venue may
   publish its own as world.ctx.bowl = {prof}. The high cameras stand just above it. */
const BOWL=[[0,1.6],[2,3.0],[30,18],[31,18.4],[32,22.5],[34,23],[62,42],[64,44]];
/* the presets of the remote / phone button */
const MODES=[{id:"auto",name:"Director"},{id:"chase",name:"Chase"},{id:"broadcast",name:"Broadcast"},{id:"stadium",name:"Stadium"},{id:"onboard",name:"Onboard"}];
/* the WIDE chase (11_SKIN_DESIGN_TOKENS.json cinematic_chase: 3.5 m behind, 1.5 m up, 70 degrees vertical): milestone 1's default, kept for a chase with shot.wide and as the replay's rig */
const CHASE={back:3.5,up:1.5,side:-1.1,fov:70};
/* THE HERO CHASE (milestone 2, the cover's framing; the default chase): 2.6 m behind the rider and 1 m to his left, 1.1 m up, 72 degrees vertical, the rider big in the
   right third (his hip point at NDC x +0.42, y -0.28: helmet to tyres over about half the frame's height), the riders ahead in the left two thirds, the stands and the floodlights
   in the upper frame. (2.6 m, not the cover's 2 m: the riders' and bikes' near-lens fade (r3d-riders.js / r3d-bike.js, D12) dissolves whatever is nearer than 1.7 m to the lens,
   and at 2.1 m it ate the subject's own rear wheel and fender; at 2.6 m his tyre's back edge is 1.5 m from the lens. With the fade off for the chased subject (a REQUEST) b = 2.1.) The rig keeps the subject exactly where the mount wants him (the eye rides his own heading, smoothed: a hairpin swings it round behind him, never ahead),
   and chooses between MOUNTS by cost (a rival filling the lens now or in 0.35 s, the track's edge, a berm under the lens) with hysteresis, gliding between them (critically damped):
   b = metres back, s = metres to his right (- = left), u = metres up, x / y = where his hip point sits on screen (NDC), pref = the mount's cost when nothing is in the way */
const HERO={fov:72,mounts:[
  {id:"cover",b:2.6,s:-1.0,u:1.1,x:0.42,y:-0.28,pref:0},
  {id:"mirror",b:2.6,s:1.0,u:1.1,x:-0.42,y:-0.28,pref:0.30},
  {id:"high",b:3.0,s:-0.75,u:2.7,x:0.30,y:-0.16,pref:0.45},
  {id:"wide",b:3.6,s:-1.2,u:1.6,x:0.32,y:-0.22,pref:0.62}],
  crash:{id:"crash",b:7,s:-2.4,u:2.8,x:0,y:-0.1,pref:0}};
/* the lens of a frame: a phone held upright gets a wider vertical field (the sides crop, the riders stay big) */
function lensFov(fov,asp,sh){ return asp<1&&sh!=="gate"&&sh!=="crash"?clamp(2*Math.atan(Math.tan(fov*PI/360)/Math.max(0.78,Math.pow(asp,0.55)))*R2D,10,84):fov; }

export function createCams(VIEW){
  /* ---------------- the cameras' own state ---------------- */
  let shot=null, shotLog=[], featLog=[], HG=null, mode="auto", CORN=[], share=0.5, lapWide=-1, launched=false, onbCool=0, cornLog=[], wideSide=0, youOut=0, earlyT=-1e9;   /* youOut: seconds the person's rider has been out of the frame; earlyT: the race time of the last early cut back to him */
  const camS={pos:new THREE.Vector3(),look:new THREE.Vector3(),fov:50,snap:true,roll:0};
  const tmpO={}, v3=new THREE.Vector3();   /* scratch */
  const cam=VIEW.cam;   /* the THREE.PerspectiveCamera (race3d.js owns it; these functions move it) */
  const cTarget=new THREE.Vector3(), cFocus=new THREE.Vector3(), E=new THREE.Vector3(), T=new THREE.Vector3(), tv3=new THREE.Vector3(), tv4=new THREE.Vector3(), tv2=new THREE.Vector3();
  const RG={fov:50,roll:0,near:0.5,clr:1.2,follow:false};   /* what the rig of this frame asks for */
  const FS=new Sd(50), ROLL=new Sd(0);   /* the lens and the roll, smoothed across shots' frames */

  /* the highest dirt in every 2 m cell (the track, its berms and shoulders, the start path): no camera ever sits inside a jump or under a
     landing (polish: a chase camera behind a rider who had just landed could end up under the jump's face, and the screen showed the
     dirt's underside as a black wedge) */
  function heightGrid(){
    let x0=1e9,x1=-1e9,z0=1e9,z1=-1e9; const S=VIEW.C.S&&VIEW.C.S.n?VIEW.C.S:null;
    const grow=(x,z)=>{ if(x<x0) x0=x; if(x>x1) x1=x; if(z<z0) z0=z; if(z>z1) z1=z; };
    for(let i=0;i<VIEW.C.N;i++) grow(VIEW.C.x[i],VIEW.C.z[i]); if(S) for(let i=0;i<S.n;i++) grow(S.x[i],S.z[i]);
    const cs=2, m=16; x0-=m; z0-=m; x1+=m; z1+=m;
    const nx=Math.ceil((x1-x0)/cs)+1, nz=Math.ceil((z1-z0)/cs)+1, H=new Float32Array(nx*nz).fill(-1e9);
    const put=(x,z,y)=>{ const i=Math.floor((x-x0)/cs), j=Math.floor((z-z0)/cs); if(i<0||j<0||i>=nx||j>=nz) return; const k=j*nx+i; if(y>H[k]) H[k]=y; };
    const o={};
    const out=VIEW.C.kind!=="stadium";
    for(let i=0;i<VIEW.C.N;i++){ const s=i*VIEW.C.ds, f=MX.Course.frame(VIEW.C,s,o), ax=-Math.sin(f.th), az=Math.cos(f.th), hw=f.hw;
      for(let l=-hw;l<=hw+0.01;l+=1) put(f.x+ax*l,f.z+az*l,MX.Course.ground(VIEW.C,s,l));
      /* the shoulders as the dirt is drawn (r3d-world trackMesh): from the edge down to the ground, wider beside a tall jump outdoors */
      for(const sd of [-1,1]){ const edge=MX.Course.ground(VIEW.C,s,sd*hw), eh=edge-f.y, sw=out&&eh>=0.45?2.6*(1+Math.min(eh,4)*0.55):2.6, ext=0.85*sw;
        for(let e=0;e<=ext+1.01;e+=1){ const y=edge+(f.y-(out?0.55:0.3)-edge)*sstep(0,1,e/ext), l=sd*(hw+e); put(f.x+ax*l,f.z+az*l,y); } } }
    if(S) for(let i=0;i<S.n;i++){ const ax=-Math.sin(S.th[i]), az=Math.cos(S.th[i]); for(let l=-S.hw[i]-1;l<=S.hw[i]+1.01;l+=1) put(S.x[i]+ax*l,S.z[i]+az*l,(S.y[i]||0)+0.1); }
    return {x0:x0,z0:z0,cs:cs,nx:nx,nz:nz,H:H};
  }
  function dirtTop(x,z){
    if(!HG) return -1e9; const i=Math.floor((x-HG.x0)/HG.cs), j=Math.floor((z-HG.z0)/HG.cs); let y=-1e9;
    for(let b=j-1;b<=j+1;b++){ if(b<0||b>=HG.nz) continue; for(let a=i-1;a<=i+1;a++){ if(a<0||a>=HG.nx) continue; const v=HG.H[b*HG.nx+a]; if(v>y) y=v; } }
    return y;
  }
  /* the dirt's height in the one cell under (x, z) (no neighbours: for sight lines and the close chase) */
  function dirtCell(x,z){ if(!HG) return -1e9; const i=Math.floor((x-HG.x0)/HG.cs), j=Math.floor((z-HG.z0)/HG.cs); if(i<0||j<0||i>=HG.nx||j>=HG.nz) return -1e9; return HG.H[j*HG.nx+i]; }
  /* the ground under (x, z): the dirt cell, the outdoor terrain, a stadium's floor */
  function floorFine(x,z){ const hf=VIEW.world&&VIEW.world.ctx.hf; return Math.max(dirtCell(x,z),hf?hf(x,z):-1e9,VIEW.C&&VIEW.C.kind==="stadium"?-0.16:-1e9); }
  /* can a camera at a see b over the dirt (a jump, a landing, a berm in between)? the far end's own cell doesn't count */
  function sees(a,b,margin){
    const d=Math.hypot(b.x-a.x,b.z-a.z), n=Math.max(2,Math.ceil(d/1.2)), m=margin!=null?margin:0.25;
    const hf=VIEW.world&&VIEW.world.ctx.hf;
    if(a.y<8&&legInSight(a,b,0.75)) return false;   /* a finish-arch leg across the sight line (milestone 2) */
    for(let k=1;k<n;k++){ const t=k/n; if(t*d>d-2.2) break; const x=a.x+(b.x-a.x)*t, z=a.z+(b.z-a.z)*t, y=a.y+(b.y-a.y)*t; if(dirtCell(x,z)>y-m) return false; if(hf&&hf(x,z)>y-m-0.3) return false; }   /* the dirt, and outdoors the hills */
    return true;
  }
  /* a camera at p stays at least clr above the dirt and the ground under it */
  function safeCam(p,clr){ const y=Math.max(dirtTop(p.x,p.z),VIEW.world&&VIEW.world.ctx.hf?VIEW.world.ctx.hf(p.x,p.z):-1e9,VIEW.C&&VIEW.C.kind==="stadium"?-0.16:-1e9); if(p.y<y+clr) p.y=y+clr; return p; }

  /* the finish tower (the flagger's stand) and the finish arch's two steel legs (0.36 m boxes, 7.6 m tall, either side of the lane: r3d-world.js finishBuild) are solid things the dirt
     grid does not know: no fixed camera stands inside or against them (milestone 2, QD look #10: a leg filled 12% of a jump camera's frame) */
  function archLegs(){ const w=VIEW.world, fin=w&&w.fin; if(!fin||!VIEW.C) return null; if(fin.__legs) return fin.__legs; const f=MX.Course.frame(VIEW.C,0,{}), hw=Math.abs(fin.lat)-1.6, sd=fin.side||-1;
    fin.__legs=[-sd*(hw+2.3),sd*(hw+3.5)].map(l=>({x:f.x-Math.sin(f.th)*l,z:f.z+Math.cos(f.th)*l})); return fin.__legs; }
  function blocked(x,z,pad){ const fa=VIEW.world&&VIEW.world.fin&&VIEW.world.fin.flagAt; if(fa&&Math.hypot(x-fa.x,z-fa.z)<3.6+(pad||0)) return true;
    const lg=archLegs(); if(lg) for(const p of lg) if(Math.hypot(x-p.x,z-p.z)<1.6+(pad||0)) return true; return false; }
  /* does the sight line from a to b pass within r metres of an arch leg (a steel post across the lens)? */
  function legInSight(a,b,r){ const lg=archLegs(); if(!lg) return false; const dx=b.x-a.x, dz=b.z-a.z, L2=dx*dx+dz*dz||1;
    for(const p of lg){ const t=clamp(((p.x-a.x)*dx+(p.z-a.z)*dz)/L2,0,1); if(t>0.02&&Math.hypot(a.x+dx*t-p.x,a.z+dz*t-p.z)<r) return true; } return false; }
  /* ---------------- where things are on the course ---------------- */
  const pa={}, pb={};
  /* a point of the rider's path: race distance D (the gate = 0; before it the start's first heading, extended back), lateral lat (+ right) -> {x, z, th, hw, k, s, onStart, g (the dirt's height there)} */
  function pathAt(D,lat,o){
    const C=VIEW.C, Dm=Math.max(0,D), l=MX.Course.atD(C,Dm,pa), on=l.onStart, f=on?MX.Course.startFrame(C,Dm,pb):MX.Course.frame(C,l.s,pb), th=f.th, bk=D<0?-D:0;
    o=o||{}; o.th=th; o.hw=f.hw; o.k=f.k||0; o.onStart=on; o.s=on?-1:l.s;
    const px=f.x-Math.cos(th)*bk, pz=f.z-Math.sin(th)*bk; o.x=px-Math.sin(th)*lat; o.z=pz+Math.cos(th)*lat;
    o.g=on?(f.y||0)+0.02:MX.Course.ground(C,l.s,lat);
    return o;
  }
  /* the corners of the lap: runs of the centre-line tighter than 36 m radius that turn at least 40 degrees: {s0, s1, sa (the apex), side (+1 right), R, ang, len} */
  function buildCorners(){
    CORN=[]; const C=VIEW.C, N=C.N, ds=C.ds, kT=1/36; let i0=-1;
    for(let i=0;i<N;i++){ if(Math.abs(C.k[i])<kT){ i0=i; break; } } if(i0<0) return;   /* the scan starts on a straight sample */
    const close=(r,i)=>{ const len=((i-r.i0+N)%N)*ds; if(r.ang>=0.7&&len>=9) CORN.push({s0:r.i0*ds,s1:i*ds,sa:r.ia*ds,side:r.side,R:1/Math.max(1e-4,r.kmax),ang:r.ang,len:len,spot:undefined}); };
    let run=null;
    for(let n=1;n<=N;n++){ const i=(i0+n)%N, k=C.k[i], on=Math.abs(k)>=kT;
      if(on&&run&&Math.sign(k)!==run.side){ close(run,i); run=null; }
      if(on&&!run) run={i0:i,side:Math.sign(k),ang:0,kmax:0,ia:i};
      if(run){ if(on){ run.ang+=Math.abs(k)*ds; if(Math.abs(k)>run.kmax){ run.kmax=Math.abs(k); run.ia=i; } } else { close(run,i); run=null; } } }
    CORN.sort((a,b)=>a.sa-b.sa);
  }
  function nextCorner(s){ let best=null, bd=1e9; CORN.forEach(c=>{ const d=MX.Course.wrap(VIEW.C,c.sa-6-s); if(d<bd){ bd=d; best=c; } }); return best?{c:best,d:bd+6}:null; }

  /* ---------------- the camera director: the whole lap at real speed, cut between sections as the leader rides them ---------------- */
  const newK=()=>({yaw:new Sd(),pitch:new Sd(),y:new Sd(),roll:new Sd(),air:new Sd(),tx:new Sd(),ty:new Sd(),tz:new Sd(),fx:new Sd(),zoom:new Sd(),init:false,
    wasAir:false,vyMin:0,py:0,shkA:0,shkT:9,bx:0,by:0,bz:0,drift:0,a0:0});
  function setShot(s){ shot=s; shot.t=0; shot.k=newK(); camS.snap=true; if(s.why==="yellow"&&VIEW.yellow) VIEW.yellow.shown=true; shot.cam=typeof s.cam==="function"?s.cam():(s.cam||null); shotLog.push(s.type+(s.why?":"+s.why:"")); if(shotLog.length>12) shotLog.shift(); if(s.type==="onboard") onbCool=30; }
  function nextFeat(s){
    let best=null, bd=1e9; VIEW.C.feats.forEach(f=>{ if(f.k!=="whoops"&&f.k!=="jump"&&f.k!=="rhythm"&&f.k!=="sand"&&f.k!=="step") return; const d=MX.Course.wrap(VIEW.C,f.from-s); if(d<bd){ bd=d; best=f; } }); return best?{f:best,d:bd}:null;
  }
  /* a camera inside the stadium: on the floor and inside the bowl of stands, whose rounded corners cut across the floor's corners
     (polish: a corner camera could stand inside the stands and film the crowd's backs; r3d-world builds the bowl as this superellipse) */
  function inFloor(p){ if(VIEW.C.kind!=="stadium"||!VIEW.C.layout.floor) return p; const F=VIEW.C.layout.floor; p.x=clamp(p.x,F[0]+2.2,F[1]-2.2); p.z=clamp(p.z,F[2]+2.2,F[3]-2.2);
    const cx=(F[0]+F[1])/2, cz=(F[2]+F[3])/2, rx=(F[1]-F[0])/2+1.5-3.5, rz=(F[3]-F[2])/2+1.5-3.5, dx=(p.x-cx)/rx, dz=(p.z-cz)/rz, q=Math.pow(dx*dx*dx*dx+dz*dz*dz*dz,0.25);
    if(q>1){ p.x=cx+(p.x-cx)/q; p.z=cz+(p.z-cz)/q; }
    return p; }
  function terrainAt(x,z,y){ if(VIEW.world.ctx.hf) return VIEW.world.ctx.hf(x,z); return y||0; }
  /* a trackside camera beside loop distance s: a spot with room (no lane within `room` m: nobody rides through the lens) at least minOff m
     from the subject's line (a wall may pull a spot in: the real distance counts), the side with more room; inside the wall in a stadium.
     Where the floor is packed with lanes it becomes a crane, raised over the riders (polish: a spot pulled in by the wall could put the
     rider 3 m from the lens) */
  function trackCam(s,h,distA,room,minOff,tgtH,xt){
    const f=MX.Course.frame(VIEW.C,s,tmpO), want=room!=null?room:(VIEW.C.kind==="stadium"?5.5:4.5), mo=f.hw+(minOff!=null?minOff:7);
    const tg=new THREE.Vector3(f.x,MX.Course.ground(VIEW.C,s,0)+(tgtH!=null?tgtH:1.0),f.z), fx=f.x, fz=f.z, fth=f.th, fhw=f.hw, fy=f.y;
    let best=null, bs=-1e9;
    for(const dist of (distA||[10,14,18,23,29,36])) for(const side of [1,-1]){
      const lat=side*(fhw+dist), p=inFloor({x:fx-Math.sin(fth)*lat,z:fz+Math.cos(fth)*lat});
      if(blocked(p.x,p.z,0.8)) continue;
      const cd=clearDist(VIEW.C,p.x,p.z), off=Math.hypot(p.x-fx,p.z-fz), base=terrainAt(p.x,p.z,fy);
      /* the spot must see the subject's spot over the dirt (polish: a camera behind a landing showed nothing but the mound); higher if it must */
      let vis=-1; for(const up of [0,2.5,5,9]){ const c=safeCam(new THREE.Vector3(p.x,base+h+up,p.z),1.2); if(sees(c,tg)&&(!xt||xt.every(t=>sees(c,t)))){ vis=up; if(cd>=want&&off>=mo&&up<9) return c; break; } }
      const sc=Math.min(cd,want)*2+Math.min(off,mo)*0.8-Math.max(0,off-mo-12)*0.1-(vis<0?20:vis*0.6);
      if(sc>bs){ bs=sc; best={p:p,cd:cd,off:off,vis:vis,base:base}; } }
    const raise=clamp(want-best.cd,0,want)*1.3+(best.off<mo?2.5:0)+(best.vis>0?best.vis:best.vis<0?9:0);
    return safeCam(new THREE.Vector3(best.p.x,best.base+h+1.5+raise,best.p.z),1.2);
  }
  /* a point of the section to keep in sight: on the centre-line at loop distance s, h above the dirt */
  function secPt(s,h){ const f=MX.Course.frame(VIEW.C,s,{}); return new THREE.Vector3(f.x,MX.Course.ground(VIEW.C,s,0)+h,f.z); }
  /* a jump: low at the side of the flight (a metre above the floor in a stadium), the riders flying across the stands and the lights; only the near edge of the track need be in
     sight (the riders are in the air, not on the dirt) */
  function jumpCam(f){
    const C=VIEW.C, out=C.kind!=="stadium", lip=f.lip!=null?f.lip:f.from+3, arc=(C.arcs||[]).find(a=>Math.abs(a.a-lip)<2.5), sA=arc?arc.a+(arc.b-arc.a)*0.5:lip+(f.to-lip)*0.4;
    for(const ds of [0,-5,5,-10,10]) for(const d of (out?[12,16,21]:[7,9,12,15,19])) for(const side of [1,-1]){   /* at least 7 m from the lane: closer, the jump's own landing hides the flight */
      const s=sA+ds, fr=MX.Course.frame(C,s,tmpO), lat=side*(fr.hw+d), p=inFloor({x:fr.x-Math.sin(fr.th)*lat,z:fr.z+Math.cos(fr.th)*lat});
      if(clearDist(C,p.x,p.z)<(out?3.2:1.5)||blocked(p.x,p.z,0.8)) continue;
      const cc=safeCam(new THREE.Vector3(p.x,terrainAt(p.x,p.z,fr.y)+(out?2.2:0.9),p.z),0.7), le=side*fr.hw, edge=new THREE.Vector3(fr.x-Math.sin(fr.th)*le,MX.Course.ground(C,s,le)+0.4,fr.z+Math.cos(fr.th)*le);
      if(sees(cc,edge,0.1)) return cc; }
    return null;
  }
  function featCam(f){
    const sp=(VIEW.C.spots||[]).find(x=>Math.abs(x.mid-(f.from+f.to)/2)<3), out=VIEW.C.kind!=="stadium";
    /* the whole section in sight, not just its middle: the whoops from end to end, a jump's lip and its landing */
    const xt=f.k==="whoops"?[secPt(f.from+4,1),secPt(f.to-4,1)]:f.k==="jump"?[secPt(f.lip!=null?f.lip:f.from+3,1.2),secPt(f.to-2,0.8)]:null;
    /* a jump: from below the landing side, low, looking up at the riders against the stands and the lights (outdoors higher and further back: the hills' big
       faces would hide them) */
    if(f.k==="jump") return jumpCam(f)||(out?trackCam(f.lip!=null?f.lip+(f.to-f.lip)*0.55:(f.from+f.to)/2,3.6,[12,16,21,27],4.5,10,(f.h||2)+1.5,xt):trackCam(f.lip!=null?f.lip+(f.to-f.lip)*0.55:(f.from+f.to)/2,0.35,[10,13,16,20],undefined,undefined,(f.h||2)+1.5,xt));
    if(f.k==="whoops"&&sp){ const p=inFloor({x:sp.x,z:sp.z}), fm=MX.Course.frame(VIEW.C,sp.mid,tmpO), c=safeCam(new THREE.Vector3(p.x,terrainAt(p.x,p.z,sp.y)+3.2,p.z),1.5);
      if(clearDist(VIEW.C,p.x,p.z)>=4&&Math.hypot(p.x-fm.x,p.z-fm.z)>=fm.hw+7&&sees(c,new THREE.Vector3(fm.x,MX.Course.ground(VIEW.C,sp.mid,0)+1,fm.z))&&xt.every(t=>sees(c,t))) return c; }
    if(f.k==="whoops") return trackCam((f.from+f.to)/2,VIEW.C.kind==="stadium"?2.4:7.5,VIEW.C.kind==="stadium"?[6,8,11,14,18,24]:undefined,VIEW.C.kind==="stadium"?3.2:undefined,VIEW.C.kind==="stadium"?5:undefined,undefined,xt);
    /* a rhythm lane, the sand, a step-up: further back and higher, a third of the way along, looking down on the lane (the riders ahead
       must not fill the lens) */
    return trackCam(f.from+(f.to-f.from)*0.35,VIEW.C.kind==="stadium"?4.6:5,[14,18,23,29,36],5.5,11,1.6);
  }
  /* a camera round a spot: on rings of the given distances, at the first height that sees every target over the dirt and the hills, clear
     of the lanes (raised over a lane that passes close); scored for the wanted distance and for standing ahead along fdir (the riders come
     toward the lens) */
  function spotCam(cx,cz,fy,fdir,targets,dists,heights,want,avoid){
    /* every spot scored first on what is cheap (room, distance, standing ahead), then the sight lines tested best first: a spot whose
       best possible score can't beat the best found is never tested (the sight tests are what cost: this keeps the cut to a crash smooth) */
    const cand=[];
    for(const d of dists) for(let k=0;k<16;k++){ const a=k/16*PI*2, p=inFloor({x:cx+Math.cos(a)*d,z:cz+Math.sin(a)*d}), dd=Math.hypot(p.x-cx,p.z-cz);
      if(dd<d*0.6) continue;
      if(avoid&&avoid.some(o=>Math.hypot(p.x-o.x,p.z-o.z)<o.d)) continue;   /* too close to someone who must be in the frame */
      const cd=clearDist(VIEW.C,p.x,p.z); if(cd<1.2||blocked(p.x,p.z,0.8)) continue;
      const ahead=((p.x-cx)*fdir.x+(p.z-cz)*fdir.z)/dd; cand.push({p:p,cd:cd,sc:Math.min(cd,3.5)*1.2-Math.abs(dd-want)*0.4+ahead*0.9}); }
    cand.sort((a,b)=>b.sc-a.sc);
    let best=null, bs=-1e9;
    for(const c0 of cand){ if(c0.sc<=bs) break;
      const base=terrainAt(c0.p.x,c0.p.z,fy); let hi=0;
      for(const h of heights){ if(c0.sc-hi*0.8<=bs) break; const q=safeCam(new THREE.Vector3(c0.p.x,base+h+(c0.cd<3?1:0),c0.p.z),1.2); if(targets.every(t=>sees(q,t))){ bs=c0.sc-hi*0.8; best=q; break; } hi++; } }
    return best;
  }
  /* the crash camera: close (about 9.5 m from where the rider lands), low, looking over the riders passing the crash, beside or a little ahead of
     the crash so the rider tumbles toward the lens */
  function crashCam(s){
    const f=MX.Course.frame(VIEW.C,s+3,tmpO), tgt=new THREE.Vector3(f.x,MX.Course.ground(VIEW.C,s+3,0)+0.7,f.z);
    return spotCam(f.x,f.z,f.y,{x:Math.cos(f.th),z:Math.sin(f.th)},[tgt],[8,9.5,11.5,14],[2.4,3.6,5.5,8],9.5)||trackCam(s+5,2.4,[6,8.5,11,14,18],3.2,5);
  }
  /* the yellow lap: the marshal waving the flag and the riders coming into the section, both in sight */
  function yellowCam(ys){
    const f=MX.Course.frame(VIEW.C,ys,{}), fa=MX.Course.frame(VIEW.C,ys-14,{}), T0=[new THREE.Vector3(f.x,MX.Course.ground(VIEW.C,ys,0)+1,f.z),new THREE.Vector3(fa.x,MX.Course.ground(VIEW.C,ys-14,0)+1,fa.z)];
    let av=null, cx=f.x, cz=f.z, dir={x:Math.cos(f.th),z:Math.sin(f.th)};
    if(VIEW.marshal&&VIEW.marshal.grp.visible){ const m=VIEW.marshal.grp.position; T0.push(m.clone().add(v3.set(0,1.5,0))); av=[{x:m.x,z:m.z,d:9}]; cx=(f.x+m.x)/2; cz=(f.z+m.z)/2;   /* the marshal 9 m or more from the lens */
      /* across the track from him, a little ahead: the riders pass between the lens and the flag (the classic shot; polish: from his own
         side the frame was grass and his back) */
      const ax=f.x-m.x, az=f.z-m.z, al=Math.hypot(ax,az)||1; dir={x:ax/al*0.8+Math.cos(f.th)*0.6,z:az/al*0.8+Math.sin(f.th)*0.6}; const dl=Math.hypot(dir.x,dir.z)||1; dir.x/=dl; dir.z/=dl; }
    return spotCam(cx,cz,f.y,dir,T0,[11,14,17,21,26],[2.6,4,6,9,12],15,av)||trackCam(ys+2,3.4,[8,11,14,18,23],3.5,6);
  }
  /* the gate camera: low, a few metres beyond the start straight's edge and a little ahead of the gate (the side with more room) */
  function gateCam(g){
    const fx=Math.cos(g.th), fz=Math.sin(g.th), rx=-fz, rz=fx, fwd=6+g.gw*0.22, lat=g.gw*0.5+4.5, ht=1.25+g.gw*0.03;
    let best=null, bd=-1e9;
    for(const sd of [1,-1]){ const p=inFloor({x:g.x+fx*fwd+rx*lat*sd,z:g.z+fz*fwd+rz*lat*sd}), cd=clearDist(VIEW.C,p.x,p.z); if(cd>bd){ bd=cd; best=p; } }
    return new THREE.Vector3(best.x,terrainAt(best.x,best.z,g.y)+ht+(bd<2?2.5:0),best.z);
  }
  function turn1Cam(){
    let f; if(VIEW.C.S.n){ f=MX.Course.startFrame(VIEW.C,Math.max(0,VIEW.C.Ls-16),tmpO); } else f=MX.Course.frame(VIEW.C,VIEW.C.join+Math.max(10,VIEW.C.hsD-16),tmpO);
    const side=-Math.sign(f.k||1)||1;
    for(const dist of [14,20,26]){ const lat=side*(f.hw+dist), x=f.x-Math.sin(f.th)*lat, z=f.z+Math.cos(f.th)*lat; if(clear(VIEW.C,x,z,2)){ const p=inFloor({x:x,z:z}); return new THREE.Vector3(p.x,terrainAt(p.x,p.z,f.y)+6.5,p.z); } }
    const p=inFloor({x:f.x+20,z:f.z+20}); return new THREE.Vector3(p.x,terrainAt(p.x,p.z,0)+6.5,p.z);
  }
  /* the line: from beyond it, low, across the track from the flagger: the riders come at the lens over the stripe, the flagger and the
     flag up on the tower behind them */
  function lineCam(){ const fin=VIEW.world.fin, f=MX.Course.frame(VIEW.C,0,{}), th=f.th, sd0=-Math.sign(fin.lat||1);
    /* it must see the riders coming to the line and the flag over any jump or landing just past it (polish: at a traced track with a
       jump right after the line the lens saw only the landing's back); the first spot that does, from the classic low one up */
    const T0=[secPt(0,1),secPt(-22,1),fin.flagAt.clone().add(v3.set(0,1.2,0))];
    for(const h of [1.6,2.4,3.6,5.5,8]) for(const fw of [11,8,15,20]) for(const sd of [sd0,-sd0]){ const lat=sd*(f.hw+3.5);
      const p=inFloor({x:f.x+Math.cos(th)*fw-Math.sin(th)*lat,z:f.z+Math.sin(th)*fw+Math.cos(th)*lat}); if(clearDist(VIEW.C,p.x,p.z)<1.5) continue;
      const c=safeCam(new THREE.Vector3(p.x,terrainAt(p.x,p.z,f.y)+h,p.z),1.2); if(T0.every(t=>sees(c,t))) return c; }
    const lat=sd0*(f.hw+3.5), p=inFloor({x:f.x+Math.cos(th)*11-Math.sin(th)*lat,z:f.z+Math.sin(th)*11+Math.cos(th)*lat}); return safeCam(new THREE.Vector3(p.x,terrainAt(p.x,p.z,f.y)+5.5,p.z),1.2); }
  /* a corner: low inside the berm, a little before the apex, so the riders rail it toward the lens (memoised: the spot does not depend on the rider) */
  function cornerCam(c){
    if(c.spot!==undefined) return c.spot||null;
    const C=VIEW.C, tgs=[secPt(c.sa,1.1),secPt(c.sa-7,1.0),secPt(c.sa+5,1.0)]; let found=false;
    for(const ds of [-4,-7,-1,2,-10]) for(const d of [1.8,2.8,4,6]){ if(found) break;
      const s=c.sa+ds, f=MX.Course.frame(C,s,tmpO), lat=c.side*(f.hw+d), p=inFloor({x:f.x-Math.sin(f.th)*lat,z:f.z+Math.cos(f.th)*lat});
      if(clearDist(C,p.x,p.z)<1.0||blocked(p.x,p.z,0.8)) continue;
      const cc=safeCam(new THREE.Vector3(p.x,terrainAt(p.x,p.z,f.y)+0.8,p.z),0.5);
      if(tgs.every(t=>sees(cc,t))){ c.spot=cc; found=true; } }
    if(!found) c.spot=false;
    return c.spot||null;
  }
  /* the stadium-wide: high on the stands (on the bowl's own surface: the profile + clearance), looking down on the whole course; a = the bowl's angle (PI/2 = the south side),
     d = metres back from the wall. Outdoors: a tower over the terrain, back from the course's middle */
  function wideSpot(side){
    const C=VIEW.C, F=C.layout.floor;
    if(C.kind==="stadium"&&F){
      const BY=VIEW.world&&VIEW.world.ctx&&VIEW.world.ctx.bowlY;   /* the stadium's own stands (r3d-stadium-bowl.js bowlY(x, z) -> {y, d}): the eye stands 2.8 m above the seats under it, in the lower tiers like a TV's main camera */
      const a=[PI/2,PI*1.5,PI*0.72,PI*0.28][side%4], d=BY?[20,20,18,18][side%4]:[46,46,38,38][side%4], cx=(F[0]+F[1])/2, cz=(F[2]+F[3])/2, rx=(F[1]-F[0])/2+1.5, rz=(F[3]-F[2])/2+1.5, ca=Math.cos(a), sa=Math.sin(a), e=4;
      const P=(VIEW.world&&VIEW.world.ctx&&VIEW.world.ctx.bowl&&VIEW.world.ctx.bowl.prof)||BOWL; let hS=P[P.length-1][1]; for(let i=1;i<P.length;i++){ if(d<=P[i][0]){ hS=lerp(P[i-1][1],P[i][1],(d-P[i-1][0])/(P[i][0]-P[i-1][0])); break; } }
      const at=aa=>{ const c1=Math.cos(aa), s1=Math.sin(aa), px=cx+Math.sign(c1)*Math.pow(Math.abs(c1),2/e)*rx+c1*d, pz=cz+Math.sign(s1)*Math.pow(Math.abs(s1),2/e)*rz+s1*d; return new THREE.Vector3(px,BY?Math.max(BY(px,pz).y,0)+2.8:hS+2.8,pz); };   /* the bowl's own parametrisation (r3d-world stadium()): a point on the stands */
      return {a:a,d:d,at:at,pos:at(a),mid:new THREE.Vector3(cx,0,cz-2),stadium:true};
    }
    let x0=1e9,x1=-1e9,z0=1e9,z1=-1e9; for(let i=0;i<C.N;i+=4){ x0=Math.min(x0,C.x[i]); x1=Math.max(x1,C.x[i]); z0=Math.min(z0,C.z[i]); z1=Math.max(z1,C.z[i]); }
    const cx=(x0+x1)/2, cz=(z0+z1)/2, ext=Math.max(x1-x0,z1-z0), sx=side%2?-1:1, p=new THREE.Vector3(cx+ext*0.15*sx,0,cz+ext*0.85); p.y=terrainAt(p.x,p.z,0)+ext*0.4+6;
    return {a:0,d:0,pos:p,mid:new THREE.Vector3(cx,terrainAt(cx,cz,0),cz),stadium:false};
  }

  /* ---------------- the director's choices ---------------- */
  const meList=()=>{ const o=[]; VIEW.meSeats.forEach(s=>{ const i=VIEW.rs.findIndex(x=>x.seat===s); if(i>=0&&!VIEW.rs[i].gone) o.push(i); }); return o; };
  const isMe=i=>i>=0&&VIEW.rs[i]&&VIEW.meSeats.indexOf(VIEW.rs[i].seat)>=0;
  function packAround(j,rng){ /* how many riders are within rng metres of rider j along the race distance (the pack the shot will show) */
    const r=VIEW.rs[j]; let n=0; VIEW.rs.forEach((o,i)=>{ if(i===j||o.gone||o.onStart&&!r.onStart) return; if(Math.abs(o.D-r.D)<rng) n++; }); return n; }
  function candidates(urgent){
    const L=[], lead=VIEW.leaderIdx(); if(lead<0) return L;
    const rs=VIEW.rs, r=rs[lead], me=meList().filter(i=>!rs[i].crash);
    const boost=clamp((0.70-share)*4,0,1.4), outB=youOut>5?2.6:youOut>3?0.8:0;   /* the person's rider has had less than its share of the screen (70%: the CEO roots for his own rider): its shots get a lift; out of the frame for over 5 s: the hero chase on him comes next (milestone 2) */
    if(VIEW.lapNo===1&&r.D<VIEW.C.hsD&&VIEW.C.hsD-r.D<62&&!(shot&&shot.type==="turn1")) L.push({type:"turn1",subj:lead,pri:9.2,min:4.5,max:8,cam:turn1Cam});   /* the holeshot: never missed */
    rs.forEach((k,i)=>{ if(k.crashPlan&&!k.crash&&!k.gone&&!k.onStart&&k.lapN>=k.crashPlan.lap){ const d=MX.Course.wrap(VIEW.C,k.crashPlan.s-k.s); if(d>0&&d<Math.max(10,k.v*2.6)){ const out=k.crashPlan.kind==="out"; const cs=k.crashPlan.s; L.push({type:"crash",subj:i,pri:10,min:out?7.5:8.4,max:out?9.5:10.5,cam:()=>crashCam(cs)}); } } });
    if(!r.onStart){ const toLine=VIEW.C.L-r.s, tl=toLine/Math.max(4,r.v), over=VIEW.lapPlan&&VIEW.lapPlan.over&&VIEW.lapPlan.n>=VIEW.lapNo;
      if(tl<3.4&&(over||VIEW.lapNo===VIEW.lenLaps-1||VIEW.lapNo%3===0)) L.push({type:"line",subj:lead,pri:over?9:VIEW.lapNo===VIEW.lenLaps-1?7:4,min:3.2,max:over?7:5,cam:lineCam}); }
    /* the yellow lap: once, the first rider (in running order) about to ride through the yellow section, with the marshal in the frame */
    if(VIEW.yellow&&VIEW.yellow.lap===VIEW.lapNo&&!VIEW.yellow.shown){ const ys=VIEW.yellow.s; let yi=-1;
      rs.map((k,i)=>i).filter(i=>!rs[i].gone&&!rs[i].crash&&!rs[i].onStart).sort((a,b)=>rs[b].D-rs[a].D).some(i=>{ const k=rs[i], d=MX.Course.wrap(VIEW.C,VIEW.yellow.s0-k.s); if(d>2&&d<Math.max(8,k.v*1.8)&&d<30){ yi=i; return true; } return false; });   /* (milestone 2, QD motion #6: it cut in 4.5 s out and filmed an empty corner for up to 6 s: now about 1.8 s out, the first rider within 30 m) */
      if(yi>=0) L.push({type:"track",subj:yi,pri:6.5,min:4.5,max:7,cam:()=>yellowCam(ys),why:"yellow"}); }
    /* the launch: right after the gate drops the person's rider, the pack ahead and the gate row behind (the cover's framing) */
    if(!launched&&VIEW.lapNo===1&&VIEW.T<9&&me.length&&!rs[me[0]].crash) L.push({type:"chase",subj:me[0],pri:9.4,min:3,max:4.6,why:"launch"});
    if(urgent) return L;
    [lead].concat(me).forEach((j,ix)=>{ const qq=rs[j]; if(!qq||qq.onStart) return; const you=ix>0, nf=nextFeat(qq.s);
      if(nf){ const tt=nf.d/Math.max(4,qq.v);
        if(tt<3.0&&tt>0.2){ const f=nf.f, seen=featLog.slice(-2).indexOf(f.from)>=0, pri=(you?5.3+boost:4.6)-(seen?1.6:0)+(f.big?0.4:0);
          if(you&&f.k==="jump"&&onbCool<=0&&VIEW.C.kind==="stadium"&&packAround(j,3.5)===0) L.push({type:"onboard",subj:j,pri:pri+0.4,min:3.6,max:5.4,why:"jump",feat:f});   /* over the big jump from the rider's own eyes */
          L.push({type:f.k==="whoops"?"whoops":f.k==="jump"?"jump":"track",subj:j,pri:pri,min:3.6,max:7,cam:()=>featCam(f),feat:f,why:f.k}); } }
      const nc=nextCorner(qq.s);   /* a corner coming up: low inside the berm as they rail it */
      if(nc&&cornerCam(nc.c)){ const tt=nc.d/Math.max(4,qq.v), recent=cornLog.slice(-3).indexOf(nc.c.sa)>=0;
        if(tt<3.2&&tt>0.9&&!recent) L.push({type:"corner",subj:j,pri:(you?4.5+boost:3.9)+(nc.c.R<14?0.3:0),min:4,max:6.5,cam:()=>cornerCam(nc.c),why:"corner",corner:nc.c}); } });
    const ord=rs.filter(x=>!x.gone&&!x.crash&&!x.onStart).sort((a,b)=>b.D-a.D);
    for(let k=1;k<Math.min(ord.length,14);k++){ const a=ord[k-1], b=ord[k], gap=a.D-b.D, closing=b.v-a.v;
      if(gap<8&&gap>0.5&&closing>0.25){ const mine=VIEW.meSeats.indexOf(a.seat)>=0||VIEW.meSeats.indexOf(b.seat)>=0, imp=(k<=4?2:0)+(mine?2:0)+(VIEW.lapPlan&&(VIEW.lapPlan.win===a.seat||VIEW.lapPlan.win===b.seat)?2:0);
        if(imp>=2){ const bs=b.s+b.v*2.2; L.push(mine||k<=3?{type:"chase",subj:b.k,victim:a.k,pri:4.4+imp*0.3,min:3.6,max:6.5,why:"battle"}:{type:"track",subj:b.k,victim:a.k,pri:4.2+imp*0.3,min:3.5,max:6.5,cam:()=>trackCam(bs,3.2),why:"battle"}); break; } } }
    if(VIEW.holdInfo&&VIEW.holdInfo.war) VIEW.holdInfo.war.forEach((j,ix)=>{ if(rs[j]&&!rs[j].gone&&!rs[j].onStart) L.push({type:"chase",subj:j,pri:3.6-ix*0.1+(isMe(j)?0.8:0),min:3,max:4.5,why:"war"}); });
    /* a wide establishing shot of the whole night: once a lap, and after the first corner of lap one */
    if(lapWide!==VIEW.lapNo&&!r.onStart&&(VIEW.lapNo>1||r.D>VIEW.C.hsD+20)&&VIEW.C.kind!==undefined&&motion()!=="off") L.push({type:"bcast",subj:lead,pri:3.7,min:4.8,max:7.2,why:"wide"});   /* (milestone 2: the high broadcast from the stands, framed wide) */
    L.push({type:"chase",subj:lead,pri:2,min:4,max:7,why:"lead"});
    if(me.length) L.push({type:"chase",subj:me[0],pri:Math.min(8.5,4.0+boost+outB),min:4.5,max:8,why:"you"});   /* the hero chase on the person's rider: the default filler, above the leader's corners and the establishing shot (milestone 2: 2.9 before) */
    if(!r.onStart){ const rsd=r.s+Math.max(8,r.v*2.2); L.push({type:"track",subj:lead,pri:2.1,min:3.5,max:6,cam:()=>trackCam(rsd,3.4),why:"roving"}); }
    /* never an empty track: a chase with nobody near it, or a spot shot of a lone rider, is the last choice; nor a chase with riders right behind the subject (the lens would sit among them) */
    L.forEach(c=>{ if(c.pri>=9||c.type==="wide"||c.type==="bcast"||c.type==="crash") return; const n=packAround(c.subj,c.type==="chase"?34:22); if(n===0) c.pri-=2.2; else if(n===1) c.pri-=0.5;
      if(c.type==="chase"){ const q=rs[c.subj]; let f=0; if(q) rs.forEach((o,i)=>{ if(i===c.subj||o.gone||!o.pos) return; const dd=q.D-o.D; if(dd>0&&dd<5&&Math.abs(o.lat-q.lat)<2.4) f++; }); if(f>=1) c.pri-=(c.wide?1.2:0.45)+(c.wide?0.7:0.3)*Math.min(2,f-1); } });   /* (milestone 2: the hero chase lifts or swaps sides over a rider behind its subject) */
    return L;
  }
  /* the shot a preset holds: the person's rider (or the leader), never cutting; the broadcast keeps cutting between trackside spots as the rider passes them */
  function lockedShot(){
    const me=meList(), lead=VIEW.leaderIdx(), subj=me.length?me[0]:lead; if(subj<0) return null;
    const r=VIEW.rs[subj];
    switch(mode){
      case "chase": return {type:"chase",subj:subj,pri:2,min:1e9,max:1e9,why:"preset"};
      case "onboard": return {type:"onboard",subj:subj,pri:2,min:1e9,max:1e9,why:"preset"};
      case "stadium": return {type:"wide",subj:subj,pri:2,min:1e9,max:1e9,why:"preset"};
      case "broadcast": return {type:"bcast",subj:subj,pri:2,min:1e9,max:1e9,why:"preset"};   /* (milestone 2: the elevated stadium broadcast from the stands, panning and zooming with the pack round the person's rider; it was the trackside long lens) */
    }
    return null;
  }
  function pickShot(force){
    if(mode!=="auto"&&VIEW.mode==="race"){ const s=lockedShot(); if(s){ if(!force&&shot&&shot.why==="preset"&&shot.type===s.type&&shot.subj===s.subj&&!s.cam){ shot.t=0; return; } setShot(s); return; } }
    const L=candidates(); if(!L.length) return;
    const last=shotLog.slice(-2);
    L.forEach(c=>{ const k=c.type+(c.why?":"+c.why:""); if(last.indexOf(k)>=0&&c.pri<6) c.pri-=1.2; c.pri+=Math.random()*0.15; });
    L.sort((a,b)=>b.pri-a.pri);
    const c=L[0];
    if(!force&&shot&&c.type===shot.type&&c.subj===shot.subj&&c.why===shot.why&&!c.cam&&c.type!=="wide"&&c.type!=="bcast"){ shot.t=0; return; }   /* the same moving camera: just keep it */
    if(c.feat){ featLog.push(c.feat.from); if(featLog.length>6) featLog.shift(); }
    if(c.corner){ cornLog.push(c.corner.sa); if(cornLog.length>6) cornLog.shift(); }
    if(c.why==="launch") launched=true;
    if(c.type==="wide"||c.type==="bcast"&&c.why==="wide") lapWide=VIEW.lapNo;
    setShot(c);
  }
  const dirA=new THREE.Vector3(), fwA=new THREE.Vector3();
  function director(dt){
    if(!shot) return;
    if(RP) return;   /* a replay is running: the live director waits */
    shot.t+=dt; if(onbCool>0) onbCool-=dt;
    if(VIEW.mode!=="race") return;
    replayAuto(); if(RP) return;
    { const on=meList().length?(youOut===0?1:0):(isMe(shot.subj)?1:0); share+=(on-share)*Math.min(1,dt/28); }   /* the person's share of the screen over about the last half minute: the time his rider was really in the frame (milestone 2; it counted the shots whose subject he was) */
    if(shot.type==="gate"&&shot.t<shot.min) return;
    if(mode!=="auto"){   /* a preset: it holds; the shot is only renewed when its rider changes (a crash out), and the broadcast re-picks its spot as the rider passes */
      const s=lockedShot(); if(!s){ return; }
      if(shot.why!=="preset"||shot.type!==s.type||shot.subj!==s.subj||(shot.type==="track"&&shot.t>=shot.max)) pickShot(true);
      else if(shot.type==="track"&&shot.cam){ const r=VIEW.rs[shot.subj]; if(r&&r.pos){ dirA.subVectors(shot.cam,r.pos); fwA.set(Math.cos(r.th||0),0,Math.sin(r.th||0)); if(dirA.dot(fwA)<-18||dirA.length()<4.5) pickShot(true); } }
      return; }
    if(shot.pri<9&&shot.t>0.6){ const L=candidates(true).filter(c=>c.pri>shot.pri&&(c.pri>=9||(c.pri>shot.pri+2.5&&shot.t>1.2))).sort((a,b)=>b.pri-a.pri); if(L.length){ if(L[0].why==="launch") launched=true; setShot(L[0]); return; } }   /* a crash, the holeshot, the checkered flag cut in at once; the white flag or the yellow section over a filler shot */
    /* the person's rider out of the frame for over 6 s: a filler shot of somebody else ends early, and the next pick (his hero chase has the lift then) brings him back (milestone 2: the CEO
       roots for his own rider; QD motion #6 measured him out of the frame for up to 13.7 s). At most once every 4 s of race */
    if(youOut>6&&shot.pri<6&&shot.t>1.2&&!isMe(shot.subj)&&shot.why!=="yellow"&&VIEW.T-earlyT>4&&meList().some(i=>!VIEW.rs[i].crash&&!VIEW.rs[i].onStart)){ earlyT=VIEW.T; pickShot(); return; }
    if(shot.t>=shot.max){ pickShot(); return; }
    if(shot.t>=shot.min){
      const r=VIEW.rs[shot.subj];
      if(shot.feat&&r&&!r.onStart){ const d=MX.Course.wrap(VIEW.C,r.s-shot.feat.to); if(d<VIEW.C.L/2&&d>3){ pickShot(); return; } }
      if(shot.corner&&r&&!r.onStart){ const d=MX.Course.wrap(VIEW.C,r.s-shot.corner.s1); if(d<VIEW.C.L/2&&d>4){ pickShot(); return; } }
      if(shot.cam&&r&&r.pos&&shot.type!=="crash"&&shot.type!=="line"){ dirA.subVectors(shot.cam,r.pos); fwA.set(Math.cos(r.th||0),0,Math.sin(r.th||0)); const far=shot.type==="track"?18:6; if(dirA.dot(fwA)<-far||dirA.length()<4.2){ pickShot(); return; } }
      if(!shot.cam&&shot.type!=="wide"&&shot.type!=="bcast"&&shot.t>=shot.min+1.5) pickShot();
    }
  }

  /* ---------------- the rigs: each places E (the eye) and T (the aim) and asks for a lens (RG) ---------------- */
  /* the cover chase: the camera rides the rider's own line `back` metres behind him and `side` to his left, low; it looks so that he stands in the right third
     and the riders ahead and the track fill the rest; the bike's lean rolls it a little, a landing shakes it a little */
  function rigChase(r,j,dt,snap,o,K,rs){
    K=K||shot.k; rs=rs||VIEW.rs; const st=j>=0&&VIEW.st?VIEW.st[j]:null, asp=VIEW.W/Math.max(1,VIEW.H), crash=!!r.crash&&!o.noCrash;
    const back=crash?8:o.back, up=crash?2.6:o.up, sd0=crash?2.4:Math.abs(o.side), S=r.pos;
    /* the camera's spot on the path behind him, kept on the dirt (not over the lane blocks); the side with room (a neighbour abreast of him would fill the lens) */
    const p0=pathAt(r.D-back,r.lat,pa), lim=Math.max(0.6,p0.hw-0.6);
    if(K.sideT===undefined) K.sideT=-1;
    { const spotClear=sg=>{ const q=pathAt(r.D-back,clamp(r.lat+sg*sd0,-lim,lim),pb); let m=1e9; for(let i2=0;i2<rs.length;i2++){ const x=rs[i2]; if(x===r||x.gone||!x.pos) continue; const d=Math.hypot(x.pos.x-q.x,x.pos.z-q.z); if(d<m) m=d; } return m; };
      const cl=spotClear(-1), cr=spotClear(1);
      /* (polish, D12: a side swap carries the lens across the subject's lane, through whoever is alongside: only when the other side is really clear (2.6 m) and not twice in a row within 1.6 s) */
      K.swapT=(K.swapT||0)+Math.max(0,dt);
      if(K.swapT>1.6){ if(K.sideT<0&&cl<1.5&&cr>2.6&&cr>cl+0.6){ K.sideT=1; K.swapT=0; } else if(K.sideT>0&&cr<1.5&&cl>2.6&&cl>cr+0.6){ K.sideT=-1; K.swapT=0; } } }
    if(!K.init||snap) K.side=new Sd(K.sideT*sd0);
    const sideS=K.side.step(K.sideT*sd0,0.4,dt), latC=clamp(r.lat+sideS,-lim,lim), pc=pathAt(r.D-back,latC,pa);
    E.x=pc.x; E.z=pc.z;
    /* riders are solid: one close to the lens pushes it away (a continuous push, so it glides round the pack) and lifts it over his head */
    /* (polish, director note D12: a bike is 2.2 m long, so the keep-out is measured from its WHEELBASE SEGMENT, not from its origin: a rider alongside the lens had his rear wheel at 0.3 m from it while his origin was 1.4 m away and the push did nothing) */
    let near=0; for(let pass=0;pass<2;pass++) for(let i2=0;i2<rs.length;i2++){ const x=rs[i2]; if(x===r||x.gone||!x.pos) continue;
      const fx=Math.cos(x.th||0), fz=Math.sin(x.th||0); let tq=(E.x-x.pos.x)*fx+(E.z-x.pos.z)*fz; tq=clamp(tq,-1.05,1.05);
      let dx=E.x-(x.pos.x+fx*tq), dz=E.z-(x.pos.z+fz*tq), d=Math.hypot(dx,dz);
      if(d<2.1){ if(d<0.35){ const sgn=((E.x-x.pos.x)*-fz+(E.z-x.pos.z)*fx)>=0?1:-1; dx=-fz*sgn*0.35; dz=fx*sgn*0.35; d=0.35; }   /* (nearly on the segment: the side he is on, not a flip; milestone 2, QD motion #4: the push vector has the length d, so the push is 2.1 - d, not a 10 m kick) */
        const k=(2.1-d)/Math.max(d,0.35); E.x+=dx*k; E.z+=dz*k; near=Math.max(near,1-d/2.1); } }
    K.near=K.near===undefined?near:K.near+(near-K.near)*Math.min(1,Math.max(0,dt)*6);
    /* height: above the dirt under the lens, smoothed (the whoops don't bounce it), lifted a little with the bike over a jump, and high enough to see him over a crest */
    const hAir=Math.max(0,(r.oy!=null&&r.gy!=null?r.oy-r.gy:0)), air=K.air.step(hAir,0.25,dt);
    let yT=pc.g+up+0.55*Math.min(3,air)+1.5*K.near;   /* (polish: lifted over his head: a rider's helmet is at 1.7 m) */
    { let need=-1e9; for(let q=1;q<=3;q++){ const t=q*0.25, px=lerp(E.x,S.x,t), pz=lerp(E.z,S.z,t), g=floorFine(px,pz)+0.28; need=Math.max(need,(g-t*S.y)/(1-t)); } if(need>yT) yT=need; }
    if(!K.init||snap) K.y.snap(yT); const ys=K.y.step(yT,0.24,dt);
    E.y=Math.max(ys,pc.g+0.42,floorFine(E.x,E.z)+0.4);
    if(VIEW.C.kind==="stadium") inFloor(E);
    /* where to look: the subject in the right third (x 0.30..0.60 of the half screen), the track ahead and the riders in front of him in the rest */
    const tanV=Math.tan(o.fov*PI/360), tanH=tanV*asp, thMin=Math.atan(0.3*tanH), thMax=Math.atan(0.6*tanH);
    const bear=(x,z)=>Math.atan2(z-E.z,x-E.x), bs=bear(S.x,S.z), ah=pathAt(r.D+14,lerp(r.lat,0,0.35),pb);
    let dsum=wrapA(bear(ah.x,ah.z)-bs), wsum=1, cnt=0;
    for(let q=0;q<rs.length&&cnt<4;q++){ const x=rs[q]; if(x===r||x.gone||!x.pos) continue; const dd=x.D-r.D; if(dd<2||dd>40) continue; const rel=wrapA(bear(x.pos.x,x.pos.z)-bs); if(Math.abs(rel)>1.2) continue; const w=0.9*(1-dd/48); dsum+=rel*w; wsum+=w; cnt++; }
    const thS=clamp(-dsum/wsum,thMin,thMax), yawD=bs-thS, hd=Math.max(0.8,Math.hypot(S.x-E.x,S.z-E.z));
    const es=Math.atan2(S.y-E.y,hd), pitchD=clamp(-0.09+0.62*(es+0.14),-0.25,0.45);   /* the horizon above the middle (the stands and the lights fill the top), the rider low: the cover's frame */
    if(!K.init||snap){ K.yaw.snap(yawD); K.pitch.snap(pitchD); K.roll.snap(0); K.init=true; K.py=S.y; K.wasAir=!!r.air; K.vyMin=0; }
    const yaw=K.yaw.stepA(yawD,0.24,dt), pitch=K.pitch.step(pitchD,0.3,dt);
    /* a landing: the camera drops with the bike and comes back (a soft shake); the bike's lean banks it a little */
    const vy=dt>0?(S.y-K.py)/dt:0; K.py=S.y; if(r.air){ if(!K.wasAir) K.vyMin=0; K.vyMin=Math.min(K.vyMin,vy); }
    if(K.wasAir&&!r.air&&!crash){ K.shkA=clamp(-K.vyMin*0.017,0.03,0.16); K.shkT=0; }
    K.wasAir=!!r.air; K.shkT+=Math.max(0,dt);
    const sh=K.shkA*Math.exp(-K.shkT/0.2)*Math.sin(K.shkT*TAU*3.1), lean=st?st.lean:(r.lean||0), roll=K.roll.step(clamp(lean*0.2,-0.13,0.13),0.4,dt);
    E.y+=sh;
    const pt=pitch+sh*0.5, cp=Math.cos(pt);
    T.set(E.x+Math.cos(yaw)*cp*14,E.y+Math.sin(pt)*14,E.z+Math.sin(yaw)*cp*14);
    cFocus.copy(S);
    RG.fov=crash?60:o.fov+clamp(((r.v||0)-10)*0.12,0,1.6); RG.roll=roll; RG.near=0.5; RG.clr=0.4; RG.follow=true;
  }
  /* THE HERO CHASE (milestone 2; the numbers are HERO's): the eye rides the subject's own heading (a spring, tau 0.38 s, never more than 43 degrees behind the track's heading: a
     hairpin swings it round BEHIND him, never ahead), offset by the chosen mount; the aim puts his hip point exactly where the mount wants it on screen (the camera is fixed to him,
     so nothing lags: the composition is the cover's whatever his speed); the height floats over the whoops (half the dirt under the lens, half the dirt under him, smoothed), rises
     with him over a jump (80% of his height in the air), never dips into the dirt and always sees him over a crest; a rival filling the lens (now or in 0.35 s), the track's edge, a
     berm or the wall under the lens make another mount cheaper and the rig glides there (critically damped, about a second; a switch waits 0.9 s unless the lens is badly blocked). */
  const hm={x:0,y:0,z:0}, hw2={x:0,z:0};
  /* the dirt as drawn at the subject's position plus (dx, dz) (the subject's own track frame: exact enough within a few metres of him; the start pad is flat) */
  function groundNear(r,dx,dz){ const f=r.fr; if(!f) return r.gy!=null?r.gy:0; if(r.onStart||r.crash&&r.s==null) return f.y||0;
    const c=Math.cos(f.th), s=Math.sin(f.th), al=dx*c+dz*s, lt=-dx*s+dz*c; return MX.Course.ground(VIEW.C,(r.s||0)+al,clamp((r.lat||0)+lt,-f.hw-0.5,f.hw+0.5)); }
  function mountEye(m,S,yaw,gS,o){ const fx=Math.cos(yaw), fz=Math.sin(yaw); o.x=S.x-fx*m.b-fz*m.s; o.z=S.z-fz*m.b+fx*m.s; o.y=gS+m.u; return o; }
  /* what a mount costs now: its preference + 2.4 x how much a rival fills its lens + the track's edge (the lens over the blocks) + a berm or a jump face under the lens + the
     stadium's wall. The lens test is the picture itself: each rival within 8 m (a 2.2 x 0.8 x 1.9 m box, now and where he will be in 0.35 s) projected through the lens this
     mount would have; its share of the frame (the box's screen rectangle, clipped to the frame; a box across the lens plane counts as 70%) over 5% costs, 30% or more is the
     worst (1). The subject himself is the picture and does not count. */
  const pc8=[[-1.1,-0.4],[1.1,-0.4],[-1.1,0.4],[1.1,0.4]];
  function mountCost(m,r,j,S,yaw,gS,tanH,tanV,kA){
    mountEye(m,S,yaw,gS,hm); const rs=VIEW.rs;
    const be=Math.atan2(S.z-hm.z,S.x-hm.x), hd=Math.max(0.6,Math.hypot(S.x-hm.x,S.z-hm.z)), psi=be-Math.atan(m.x*tanH), pit=Math.atan2(S.y-hm.y,hd)-Math.atan(m.y*tanV);
    const cps=Math.cos(pit), sps=Math.sin(pit), cy=Math.cos(psi), sy=Math.sin(psi);
    const fX=cps*cy, fY=sps, fZ=cps*sy, rX=-sy, rZ=cy, uX=-cy*sps, uY=cps, uZ=-sy*sps;   /* the lens' forward, right and up */
    let I=0;
    for(let i=0;i<rs.length;i++){ const o=rs[i]; if(i===j||(o.gone&&!o.crash)||!o.pos) continue;
      const dx0=o.pos.x-hm.x, dz0=o.pos.z-hm.z; if(dx0*dx0+dz0*dz0>64) continue;
      const fo=Math.cos(o.th||0), go=Math.sin(o.th||0), gy=o.gy!=null?o.gy:o.pos.y-1, top=gy+(o.crash?1.2:1.95);
      for(let w=0;w<2;w++){ const ad=w&&!o.crash?Math.min(4,(o.v||0)*0.35):0, cx=o.pos.x+fo*ad, cz=o.pos.z+go*ad;
        let x0=1e9,x1=-1e9,y0=1e9,y1=-1e9,nf=0;
        for(let c=0;c<4;c++) for(let h=0;h<2;h++){ const a=pc8[c][0], l=pc8[c][1], px=cx+fo*a-go*l-hm.x, py=(h?top:gy)-hm.y, pz=cz+go*a+fo*l-hm.z;
          const zc=px*fX+py*fY+pz*fZ; if(zc>0.05) nf++; const zz=Math.max(zc,0.3);   /* (a corner at or behind the lens plane is projected as if 0.3 m in front: it pushes the box to the frame's edge on its own side) */
          const xn=(px*rX+pz*rZ)/(zz*tanH), yn=(px*uX+py*uY+pz*uZ)/(zz*tanV); if(xn<x0) x0=xn; if(xn>x1) x1=xn; if(yn<y0) y0=yn; if(yn>y1) y1=yn; }
        let cov=0;
        if(nf){ x0=Math.max(-1,x0); x1=Math.min(1,x1); y0=Math.max(-1,y0); y1=Math.min(1,y1); if(x1>x0&&y1>y0) cov=(x1-x0)*(y1-y0)/4; }   /* (all of him behind the lens: nothing) */
        const k=clamp((cov-0.05)/0.25,0,1)*(w?0.7:1); if(k>I) I=k; } }
    let P=m.pref+2.4*I+(m.s<0?1:-1)*clamp((kA||0)*8,-0.2,0.2);   /* a right turn ahead (kA > 0) prefers the lens on his right, looking into the turn (and a left turn the cover's) */
    const f=r.fr; if(f&&!r.crash){ const c=Math.cos(f.th), s=Math.sin(f.th), lt=(r.lat||0)+(hm.x-S.x)*-s+(hm.z-S.z)*c, over=Math.abs(lt)-(f.hw-0.35); if(over>0) P+=0.25+over*0.5;
      if(groundNear(r,hm.x-S.x,hm.z-S.z)>gS+0.75) P+=0.35; }
    if(VIEW.C.kind==="stadium"&&VIEW.C.layout.floor){ hw2.x=hm.x; hw2.z=hm.z; inFloor(hw2); if(Math.hypot(hw2.x-hm.x,hw2.z-hm.z)>0.3) P+=0.6; }
    return {cost:P,I:I};
  }
  function rigHero(r,j,dt,snap){
    const K=shot.k, st=j>=0&&VIEW.st?VIEW.st[j]:null, S=r.pos, asp=VIEW.W/Math.max(1,VIEW.H), crash=!!r.crash, th=r.th||0;
    const fovL=lensFov(crash?60:HERO.fov+clamp(((r.v||0)-10)*0.12,0,2),asp,"chase"), tanV=Math.tan(fovL*PI/360), tanH=tanV*asp, xs=clamp(asp/1.78,0.45,1);
    const first=!K.init||snap;
    if(first){ K.hy=new Sd(th); K.mi=-1; K.mT=9; K.hb=new Sd(0); K.hs=new Sd(0); K.hu=new Sd(0); K.hx=new Sd(0); K.hyy=new Sd(0); K.gb=new Sd(0); K.sy=new Sd(S.y); K.py=S.y; K.wasAir=!!r.air; K.vyMin=0; K.shkA=0; K.shkT=9; }
    /* the heading the eye rides: his, smoothed, at most 43 degrees behind */
    let yawS=K.hy.stepA(th,0.38,dt); { const lag=wrapA(yawS-th); if(Math.abs(lag)>0.75){ yawS=th+Math.sign(lag)*0.75; K.hy.x=yawS; } }
    const gS=r.gy!=null?r.gy:S.y-1;
    /* the turn ahead (the mean curvature 5-25 m on, + = right): the composition leans into it, and it prefers the mount that looks into it */
    let kA=0; if(!r.onStart&&!crash&&r.s!=null){ for(let q=5;q<=25;q+=5) kA+=MX.Course.frame(VIEW.C,r.s+q,tmpO).k||0; kA/=5; }
    if(first) K.kA=new Sd(kA); const kS=K.kA.step(kA,0.5,dt);
    /* the mount: the cheapest, with hysteresis */
    const M=crash?[HERO.crash]:HERO.mounts; K.mT+=Math.max(0,dt);
    /* (each mount's cost is smoothed over a quarter second, and a switch needs a clear margin and a dwell: 0.3 and 1.4 s, or 0.35 and 0.5 s when the lens is badly
       blocked; a pack in which every mount is blocked does not make the rig hunt between them) */
    if(first||!K.cs||K.cs.length!==M.length){ K.cs=null; }
    let best=0, bc=1e9; const costs=[]; for(let i=0;i<M.length;i++){ const c=mountCost(M[i],r,j,S,yawS,gS,tanH,tanV,kS); costs.push(c); }
    if(!K.cs) K.cs=costs.map(c=>c.cost); else { const a=Math.min(1,Math.max(0,dt)/0.25); for(let i=0;i<M.length;i++) K.cs[i]+=(costs[i].cost-K.cs[i])*a; }
    for(let i=0;i<M.length;i++) if(K.cs[i]<bc){ bc=K.cs[i]; best=i; }
    if(first||K.mi<0||K.mi>=M.length) K.mi=best;
    else if(best!==K.mi){ const cc=K.cs[K.mi]; if((bc<cc-0.3&&K.mT>1.4)||(costs[K.mi].I>0.6&&bc<cc-0.35&&K.mT>0.5)){ K.mi=best; K.mT=0; } }
    const m=M[K.mi]; K.mount=m.id; K.lensI=costs[K.mi].I;
    if(first){ K.hb.snap(m.b); K.hs.snap(m.s); K.hu.snap(m.u); K.hx.snap(m.x); K.hyy.snap(m.y); }
    const b=K.hb.step(m.b,0.5,dt), sd=K.hs.step(m.s,0.5,dt), u=K.hu.step(m.u,0.45,dt), xT=clamp(K.hx.step(m.x,0.55,dt)-clamp(kS*2.5,-0.22,0.22),-0.6,0.6)*xs, yT=K.hyy.step(m.y,0.5,dt);
    /* the eye */
    const fx=Math.cos(yawS), fz=Math.sin(yawS);
    E.x=S.x-fx*b-fz*sd; E.z=S.z-fz*b+fx*sd;
    { const f=r.fr; if(f&&!crash){ const c=Math.cos(f.th), s=Math.sin(f.th), lt=(r.lat||0)+(E.x-S.x)*-s+(E.z-S.z)*c, lim=Math.max(0.4,f.hw-0.35); if(Math.abs(lt)>lim){ const q=Math.sign(lt)*lim-lt; E.x+=-s*q; E.z+=c*q; } } }   /* over the dirt, never over the blocks */
    /* riders are solid: whatever mount is chosen, a rival's body near the lens pushes it away (out to 2.4 m from his wheelbase segment: a continuous push, so it glides round the
       pack; the vector has the length d: no flash frames, QD motion #4) and lifts it over his head (up to 1.8 m); the subject's own body keeps it 1.6 m away */
    let near=0; const rsA=VIEW.rs, KO=crash?3:2.4, ex0=E.x, ez0=E.z;
    for(let pass=0;pass<2;pass++) for(let i2=0;i2<rsA.length;i2++){ const o=rsA[i2]; if(o===r||(o.gone&&!o.crash)||!o.pos) continue;
      const fo=Math.cos(o.th||0), go=Math.sin(o.th||0); let tq=(E.x-o.pos.x)*fo+(E.z-o.pos.z)*go; tq=clamp(tq,-1.05,1.05);
      let dx=E.x-(o.pos.x+fo*tq), dz=E.z-(o.pos.z+go*tq), d=Math.hypot(dx,dz);
      if(d<KO){ if(d<0.35){ const sg=((E.x-o.pos.x)*-go+(E.z-o.pos.z)*fo)>=0?1:-1; dx=-go*sg*0.35; dz=fo*sg*0.35; d=0.35; }
        const k=(KO-d)/d; E.x+=dx*k; E.z+=dz*k; near=Math.max(near,1-d/KO); } }
    { const fo=Math.cos(th), go=Math.sin(th); let tq=(E.x-S.x)*fo+(E.z-S.z)*go; tq=clamp(tq,-1.05,1.05); const dx=E.x-(S.x+fo*tq), dz=E.z-(S.z+go*tq), d=Math.hypot(dx,dz);
      if(d<1.6&&d>1e-3){ const k=(1.6-d)/d; E.x+=dx*k; E.z+=dz*k; } }
    { const f=r.fr; if(f&&!crash){ const c=Math.cos(f.th), s=Math.sin(f.th), lt=(r.lat||0)+(E.x-S.x)*-s+(E.z-S.z)*c, lim=f.hw+0.3; if(Math.abs(lt)>lim){ const q=Math.sign(lt)*lim-lt; E.x+=-s*q; E.z+=c*q; } } }   /* a push may take it a little over the edge, never into the next lane */
    /* the push itself glides (tau 0.08 s): two rivals pushing from either side, or one crossing the lens, never throw the eye a metre in one frame */
    if(first||!K.pxS){ K.pxS=new Sd(E.x-ex0); K.pzS=new Sd(E.z-ez0); } E.x=ex0+K.pxS.step(E.x-ex0,0.08,dt); E.z=ez0+K.pzS.step(E.z-ez0,0.08,dt);
    K.near=K.near===undefined||first?near:K.near+(near-K.near)*Math.min(1,Math.max(0,dt)*6);
    if(VIEW.C.kind==="stadium") inFloor(E);
    const hAir=crash?0:Math.max(0,(r.oy!=null?r.oy:gS)-gS), air=K.air.step(Math.min(4.5,hAir),0.22,dt);
    const gE=groundNear(r,E.x-S.x,E.z-S.z), gBase=crash?gS:0.5*gE+0.5*gS;
    if(first) K.gb.snap(gBase); const gb=K.gb.step(gBase,0.28,dt);
    let yT2=gb+u+0.8*air+1.8*K.near;   /* (lifted over a rival's head: a helmet is at 1.95 m) */
    { let need=-1e9; for(let q=1;q<=3;q++){ const t=q*0.25, g=groundNear(r,(E.x-S.x)*(1-t),(E.z-S.z)*(1-t))+0.25; need=Math.max(need,(g-t*S.y)/(1-t)); } if(need>yT2) yT2=need; }   /* he stays in sight over a crest */
    if(first) K.y.snap(yT2); const ys=K.y.step(yT2,0.18,dt);
    const floor=Math.max(gE,groundNear(r,E.x-S.x+fx*0.6,E.z-S.z+fz*0.6),groundNear(r,E.x-S.x-fx*0.6,E.z-S.z-fz*0.6))+0.45;
    E.y=Math.max(ys,floor);
    /* a landing: the camera drops with the bike and comes back (a soft shake) */
    const vy=dt>0?(S.y-K.py)/dt:0; K.py=S.y; if(r.air){ if(!K.wasAir) K.vyMin=0; K.vyMin=Math.min(K.vyMin,vy); }
    if(K.wasAir&&!r.air&&!crash){ K.shkA=clamp(-K.vyMin*0.017,0.03,0.14); K.shkT=0; }
    K.wasAir=!!r.air; K.shkT+=Math.max(0,dt);
    const shk=K.shkA*Math.exp(-K.shkT/0.2)*Math.sin(K.shkT*TAU*3.1); E.y+=shk;
    /* the aim: his hip point at the mount's place on screen */
    /* (no lag on the aim: a landing drops him 8 m/s at 2.3 m from the lens, and any smoothing of the angles let him slide to the frame's edge; only his height is lightly
       smoothed, so the suspension's bob over the whoops does not shake the frame) */
    if(first){ K.sy.snap(S.y); K.roll.snap(0); K.init=true; }
    const syS=K.sy.step(S.y,0.05,dt), be=Math.atan2(S.z-E.z,S.x-E.x), hd=Math.max(0.6,Math.hypot(S.x-E.x,S.z-E.z)), el=Math.atan2(syS-E.y,hd);
    const psi=be-Math.atan(xT*tanH), pit=clamp(el-Math.atan(yT*tanV),-0.7,0.8)+shk*0.4, cp=Math.cos(pit);
    T.set(E.x+Math.cos(psi)*cp*14,E.y+Math.sin(pit)*14,E.z+Math.sin(psi)*cp*14);
    cFocus.copy(S);
    const lean=st?st.lean:(r.lean||0), roll=K.roll.step(crash?0:clamp(lean*0.22,-0.12,0.12),0.35,dt);   /* the bike's lean banks it a little in a berm */
    RG.fov=crash?60:HERO.fov+clamp(((r.v||0)-10)*0.12,0,2); RG.roll=roll; RG.near=0.5; RG.clr=0.4; RG.follow=true;
  }
  /* onboard: the rider's eyes just in front of the helmet, over the bars; the bike's roll and pitch softened (a helmet camera is stabilised), looking into the corner */
  const oEul=new THREE.Euler(0,0,0,"YZX"), oQ=new THREE.Quaternion(), oV=new THREE.Vector3();
  function rigOnboard(r,j,dt,snap){
    const K=shot.k, st=VIEW.st&&VIEW.st[j], S=r.pos;
    const look=pathAt(r.D+Math.max(3,(r.v||8)*0.32),r.lat,pb);
    if(!K.init||snap){ K.yaw.snap(look.th); K.pitch.snap(0); K.roll.snap(0); K.init=true; }
    const yaw=K.yaw.stepA(look.th,0.1,dt), pitchB=st?st.pitch:0, pitch=K.pitch.step(pitchB*0.8-0.1,0.09,dt), lean=st?st.lean:(r.lean||0), roll=K.roll.step(lean*0.45,0.14,dt);
    if(st&&st.visible){ oEul.set(st.lean,st.yaw,st.pitch,"YZX"); oQ.setFromEuler(oEul); oV.set(0.4,1.32,0).applyQuaternion(oQ); E.set(st.x+oV.x,st.y+oV.y,st.z+oV.z); }   /* on the bars: rigid on the bike's own frame, whatever it does in the air (the rider's helmet is behind the lens) */
    else { const p=pathAt(r.D+0.15,r.lat,pa), cy0=Math.cos(yaw), sy0=Math.sin(yaw); E.set(p.x+cy0*0.4,(r.oy!=null?r.oy:S.y-1)+1.32,p.z+sy0*0.4); }
    if(r.fr&&!r.crash) E.y=Math.max(E.y,groundNear(r,E.x-S.x,E.z-S.z)+0.25);   /* never below the dirt on a landing (QD motion #12: it dipped 13 cm) */
    const cp=Math.cos(pitch); T.set(E.x+Math.cos(yaw)*cp*20,E.y+Math.sin(pitch)*20,E.z+Math.sin(yaw)*cp*20);
    cFocus.copy(T);
    RG.fov=82; RG.roll=roll; RG.near=0.1; RG.clr=0.3; RG.follow=true;
  }
  /* the stadium-wide: a fixed high spot on the stands, a slow crane along them, the aim between the course's middle and the pack */
  function rigWide(r,j,dt,snap,o){
    const K=shot.k, asp=VIEW.W/Math.max(1,VIEW.H), port=asp<1;
    if(!shot.wide){ shot.wide=wideSpot(wideSide++); }
    const w=shot.wide;
    if(w.at&&!port){ K.drift+=Math.max(0,dt)*0.011*(w.a>PI?-1:1); E.copy(w.at(w.a+K.drift)); } else E.copy(w.pos);   /* a slow crane along the stands */
    /* the pack's middle (the riders racing, the leader's end weighted a little) */
    let sx=0,sz=0,n=0,minx=1e9,maxx=-1e9,minz=1e9,maxz=-1e9; VIEW.rs.forEach(x=>{ if(x.gone||!x.pos) return; sx+=x.pos.x; sz+=x.pos.z; n++; minx=Math.min(minx,x.pos.x); maxx=Math.max(maxx,x.pos.x); minz=Math.min(minz,x.pos.z); maxz=Math.max(maxz,x.pos.z); });
    if(!n){ sx=w.mid.x; sz=w.mid.z; n=1; minx=maxx=sx; minz=maxz=sz; } else { sx/=n; sz/=n; }
    const keep=port?0.92:0.3, tx=lerp(w.mid.x,sx,keep), tz=lerp(w.mid.z,sz,keep), ty=terrainAt(tx,tz,0)+0.4;
    if(!K.init||snap){ K.tx.snap(tx); K.ty.snap(ty); K.tz.snap(tz); K.init=true; }
    T.set(K.tx.step(tx,1.4,dt),K.ty.step(ty,1.4,dt),K.tz.step(tz,1.4,dt));
    cFocus.copy(T);
    /* the lens: the whole course in a landscape frame (50 degrees, the stadium_aerial preset); on a phone, the pack's width */
    const dist=E.distanceTo(T); let fov=50;
    if(port){ const wid=Math.max(18,Math.hypot(maxx-minx,maxz-minz)*1.2+12); fov=clamp(2*Math.atan(wid/asp/(2*dist))*R2D,24,72); }
    RG.fov=fov; RG.roll=0; RG.near=0.5; RG.clr=2.5; RG.follow=false;
  }
  /* THE BROADCAST (milestone 2: the camera button's "Broadcast" and the director's once-a-lap establishing shot; the CEO's elevated stadium view, Reference_Crops/broadcast_overview):
     a TV camera on a platform in the stands, 6.5 m over the seats where they are about 10 m high (the lower bowl), on a rail along a long side of the stadium. It dollies slowly
     with the action (tau 3 s), pans with the pack round its rider (a damped follower led by their speed) and zooms so the pack fills about half the frame's width (16-42 degrees
     vertical); it changes sides (a cut) only when the pack comes too close under it or too far across the floor, at most every 5 s. Outdoors: a tower over the terrain. */
  let RAILS=null;
  function bcastRails(){
    if(RAILS) return RAILS;
    const C=VIEW.C, F=C.layout&&C.layout.floor, BY=VIEW.world&&VIEW.world.ctx&&VIEW.world.ctx.bowlY; RAILS=[];
    if(C.kind==="stadium"&&F&&BY){ const cx=(F[0]+F[1])/2;
      for(const sd of [1,-1]){ const z0=sd>0?F[3]:F[2]; let z=z0+sd*6;
        for(let d=6;d<=60;d+=1){ z=z0+sd*d; const b=BY(cx,z); if(b&&b.y>=9.5) break; }
        RAILS.push({z:z,x0:F[0]+26,x1:F[1]-26,side:sd}); } }
    return RAILS;
  }
  const bT=new THREE.Vector3(), bV=new THREE.Vector3();
  function rigBroadcast(r,j,dt,snap){
    const K=shot.k, rs=VIEW.rs, asp=VIEW.W/Math.max(1,VIEW.H), est=shot.why==="wide", BY=VIEW.world&&VIEW.world.ctx&&VIEW.world.ctx.bowlY;
    /* the pack round the rider: everyone within 30 m of race distance (the rider counts three times), its middle and its size */
    let sx=0,sy=0,sz=0,sw=0; const D0=r.D||0;
    for(let i=0;i<rs.length;i++){ const o=rs[i]; if((o.gone&&!o.crash)||!o.pos) continue; if(i!==j&&Math.abs((o.D||0)-D0)>30) continue; const w=i===j?3:1; sx+=o.pos.x*w; sy+=(o.gy!=null?o.gy:o.pos.y-1)*w; sz+=o.pos.z*w; sw+=w; }
    if(!sw){ sx=r.pos.x; sy=r.pos.y-1; sz=r.pos.z; sw=1; } sx/=sw; sy/=sw; sz/=sw;
    let ext=0; for(let i=0;i<rs.length;i++){ const o=rs[i]; if((o.gone&&!o.crash)||!o.pos) continue; if(i!==j&&Math.abs((o.D||0)-D0)>30) continue; ext=Math.max(ext,Math.hypot(o.pos.x-sx,o.pos.z-sz)); }
    ext=Math.min(ext,40);
    const v=r.v||0, th=r.th||0; bT.set(sx+Math.cos(th)*v*0.45,sy+0.6,sz+Math.sin(th)*v*0.45);   /* led by the pack's speed: the pan never trails */
    /* the eye: a rail in the stands (or the outdoor tower) */
    const R=bcastRails(); K.bt=(K.bt||0)+Math.max(0,dt);
    if(R.length){
      const eyeOn=(ri,x)=>{ const rl=R[ri], xx=clamp(x,rl.x0,rl.x1), b=BY(xx,rl.z); return bV.set(xx,(b?Math.max(b.y,0):10)+6.5,rl.z); };
      const score=ri=>{ const e=eyeOn(ri,bT.x*0.6), d=Math.hypot(e.x-bT.x,e.z-bT.z), dep=Math.atan2(e.y-bT.y,d)*R2D; return Math.abs(d-55)*0.035+(d<35?(35-d)*0.06:0)+(dep<10?(10-dep)*0.1:0)+(dep>32?(dep-32)*0.1:0)-(ri===K.ri?0.6:0); };   /* across the floor (about 55 m), looking down 10-32 degrees: the far stands behind the pack */
      if(K.ri===undefined||snap){ K.ri=score(0)<=score(1)?0:1; K.bt=0; K.ex=new Sd(clamp(bT.x*0.6,R[K.ri].x0,R[K.ri].x1)); K.init=false; }
      else if(K.bt>5&&R.length>1){ const o=1-K.ri; if(score(o)<score(K.ri)-0.25){ K.ri=o; K.bt=0; K.ex=new Sd(clamp(bT.x*0.6,R[o].x0,R[o].x1)); K.init=false; camS.snap=true; } }   /* a cut to the other side */
      const ex=K.ex.step(clamp(bT.x*0.6,R[K.ri].x0,R[K.ri].x1),3.0,dt); E.copy(eyeOn(K.ri,ex));
    } else { if(!shot.wide) shot.wide=wideSpot(0); E.copy(shot.wide.pos); }
    /* the pan and the zoom */
    if(!K.init){ K.tx.snap(bT.x); K.ty.snap(bT.y); K.tz.snap(bT.z); }
    T.set(K.tx.step(bT.x,0.9,dt),K.ty.step(bT.y,0.9,dt),K.tz.step(bT.z,0.9,dt));
    const dist=Math.max(8,E.distanceTo(T)), wantW=clamp(ext*2+16,est?60:24,est?110:80), hf=2*Math.atan(wantW/2/dist);
    let vf=clamp(2*Math.atan(Math.tan(hf/2)/Math.max(0.56,asp))*R2D,16,est?50:42);
    if(!K.init){ K.zoom.snap(vf); K.init=true; } vf=K.zoom.step(vf,1.0,dt);
    T.y+=0.12*Math.tan(vf*PI/360)*dist;   /* the pack a little below the middle: the stands and the lights above it */
    cFocus.copy(T);
    RG.fov=vf; RG.roll=0; RG.near=0.5; RG.clr=2.5; RG.follow=false;
  }
  /* a heli / crane shot (kept for tests): behind and above, inside the wall */
  function rigHeli(r,j,dt,snap){
    const K=shot.k, S=r.pos, th=r.th||0;
    tv4.set(S.x-Math.cos(th)*16,Math.max(S.y+10,(r.gy||0)+1.9),S.z-Math.sin(th)*16); if(VIEW.C.kind==="stadium"&&VIEW.C.layout.floor){ const p=inFloor({x:tv4.x,z:tv4.z}); tv4.x=p.x; tv4.z=p.z; } safeCam(tv4,3.5);
    if(!K.init||snap){ K.tx.snap(tv4.x); K.ty.snap(tv4.y); K.tz.snap(tv4.z); K.init=true; }
    E.set(K.tx.step(tv4.x,0.4,dt),K.ty.step(tv4.y,0.4,dt),K.tz.step(tv4.z,0.4,dt)); safeCam(E,3.5);
    T.set(S.x+Math.cos(th)*3,S.y-0.5,S.z+Math.sin(th)*3); cFocus.copy(S);
    RG.fov=40; RG.roll=0; RG.near=0.5; RG.clr=3.5; RG.follow=false;
  }
  /* every fixed spot: the gate, the holeshot, the broadcast trackside, the corner, the whoops, the jump, the crash, the yellow flag, the line.
     The camera stands still (kept clear of the dirt); the aim is a damped pan after the subject (and the pack round him), the lens a long
     lens that frames them */
  function rigSpot(sh,r,j,dt,snap){
    const K=shot.k, asp=VIEW.W/Math.max(1,VIEW.H), rs=VIEW.rs;
    if(!shot.cam) shot.cam=trackCam(r.s||0,3);
    E.copy(shot.cam); const low=sh==="corner"||sh==="jump"||sh==="whoops"; safeCam(E,low?0.55:1.2);
    tv4.copy(r.pos); let spread=0, base=sh==="whoops"?6:sh==="jump"?6.5:sh==="turn1"?10:sh==="line"?3.2:sh==="crash"?2.6:sh==="corner"?4.5:2.4, vel=1;
    const cr=sh==="crash"?r.crash:null;
    if(cr){ /* the crash: tight on the rider and the bike while it happens; once the rider is down the marshal's yellow flag joins the frame */
      const t=VIEW.T-cr.T, bp=r.bikeP;
      if(bp){ tv4.lerp(bp,0.35); spread=Math.min(7,bp.distanceTo(r.pos))*0.9; }
      if(VIEW.marshal&&VIEW.marshal.grp.visible){ const mp=VIEW.marshal.grp.position, k=sstep(1.3,2.6,t), dm=Math.hypot(mp.x-r.pos.x,mp.z-r.pos.z);
        if(dm<22){ tv4.x+=(mp.x-tv4.x)*0.32*k; tv4.y+=(mp.y+1.5-tv4.y)*0.32*k; tv4.z+=(mp.z-tv4.z)*0.32*k; spread=Math.max(spread,Math.min(9,dm*0.7)*k); } }
      base=2.2; vel=0;
    }
    else if(shot.victim!=null&&rs[shot.victim]&&rs[shot.victim].pos){ tv4.lerp(rs[shot.victim].pos,0.45); spread=Math.min(14,rs[shot.victim].pos.distanceTo(r.pos)); }
    else if(sh==="line"&&VIEW.world.fin){ /* the flagger's flag in the frame with the rider */
      const fp=VIEW.world.fin.flagAt, dm=Math.hypot(fp.x-r.pos.x,fp.z-r.pos.z); tv4.set(tv4.x+(fp.x-tv4.x)*0.4,tv4.y+(fp.y+1.6-tv4.y)*0.4,tv4.z+(fp.z-tv4.z)*0.4); spread=Math.min(18,dm*0.9+2); }
    else if(shot.why==="yellow"&&VIEW.marshal&&VIEW.marshal.grp.visible){ /* the yellow section: the marshal waving the flag, the riders coming through
        (the riders join the frame as they arrive; a rider still far off doesn't pull the marshal out of it) */
      const mp=VIEW.marshal.grp.position, dm=Math.hypot(mp.x-r.pos.x,mp.z-r.pos.z);
      if(dm<26){ tv4.set((tv4.x+mp.x)/2,(tv4.y+mp.y+1.4)/2,(tv4.z+mp.z)/2); spread=Math.min(14,dm*0.8); }
      else if(VIEW.yellow){ const sp=secPt(VIEW.yellow.s,1); tv4.set((sp.x+mp.x)/2,(sp.y+mp.y+1.3)/2,(sp.z+mp.z)/2); spread=Math.min(8,Math.hypot(sp.x-mp.x,sp.z-mp.z)); }   /* the section and the flag, waiting for the riders */
      else { const k=4/dm; tv4.set(mp.x+(r.pos.x-mp.x)*k,mp.y+1.3,mp.z+(r.pos.z-mp.z)*k); spread=4; } }
    else if(!cr&&sh!=="gate"&&sh!=="line"){ /* the pack round him: the aim moves toward the riders within 12 m of him along the lap, the lens takes them in */
      let gx=0,gy=0,gz=0,gn=0,gd=0; rs.forEach((x,q)=>{ if(q===j||x.gone||!x.pos||x.crash) return; const dd=Math.abs(x.D-r.D); if(dd>14) return; gx+=x.pos.x; gy+=x.pos.y; gz+=x.pos.z; gn++; gd=Math.max(gd,x.pos.distanceTo(r.pos)); });
      if(gn){ const k=Math.min(sh==="jump"||sh==="whoops"?0.2:0.5,gn*0.18); tv4.x+=(gx/gn-tv4.x)*k; tv4.y+=(gy/gn-tv4.y)*k; tv4.z+=(gz/gn-tv4.z)*k; spread=Math.min(sh==="track"?8:14,gd*0.9); } }
    tv4.y-=0.3;
    /* the pan: a damped follower with the subject's speed fed forward (no lag behind a fast rider) */
    const lead=sh==="jump"||sh==="whoops"||sh==="corner"?0.13:0.07, th=r.th||0, vx=Math.cos(th)*(r.v||0)*lead*vel, vz=Math.sin(th)*(r.v||0)*lead*vel;
    if(!K.init||snap){ K.tx.snap(tv4.x+vx); K.ty.snap(tv4.y); K.tz.snap(tv4.z+vz); K.init=true; }
    const tau=cr?0.18:sh==="jump"||sh==="whoops"?0.1:sh==="corner"?0.12:0.2;
    T.set(K.tx.step(tv4.x+vx,tau,dt),K.ty.step(tv4.y,tau,dt),K.tz.step(tv4.z+vz,tau,dt)); cFocus.copy(T);
    const dist=E.distanceTo(T), wantW=2.6+spread*0.8+base+(cr?0:Math.max(0,dist-22)*0.05);   /* a far subject: a little more of the scene round it */
    let fov=2*Math.atan(wantW/(2*dist))*R2D*(sh==="track"?1.3:1.6), lo=sh==="line"?12:20, hi=sh==="corner"?58:sh==="jump"||sh==="whoops"?52:sh==="turn1"?52:sh==="track"?35:64;   /* the broadcast long lens: 20-35 degrees */
    fov=clamp(fov,lo,hi);
    if(dist>16&&(sh==="track"||sh==="jump"||sh==="whoops"||sh==="corner")) fov=Math.min(fov,34);   /* a far camera takes a long lens */
    if(sh==="turn1") fov=clamp(fov,26,64);
    if(shot.why==="yellow"){ const as=Math.max(0.8,asp); fov=clamp(2*Math.atan((11+spread*0.5)/as/(2*dist))*R2D,14,52); }   /* the yellow section about 12 m across */
    if(sh==="crash"){ /* the crash: framed by the scene's width (the rider, the bike, then the marshal): about 7 m across, never a speck */
      /* (the width across the screen whatever its shape: an upright phone gets the same scene, taller) */
      const visW=(cr?6.2+spread*1.25:8+Math.max(0,dist-12)*0.3)*(VIEW.W<VIEW.H?0.85:1);
      fov=clamp(2*Math.atan(visW/asp/(2*dist))*R2D,8,VIEW.W<VIEW.H?75:55); }
    RG.fov=fov; RG.roll=0; RG.near=0.5; RG.clr=low?0.55:1.2; RG.follow=false;
  }
  /* the gate: low beside the start straight, the whole gate in the frame, then the pack as it launches */
  function rigGate(dt,snap,have,r){
    const g=VIEW.gate, K=shot.k, fx=Math.cos(g.th), fz=Math.sin(g.th), rx=-fz, rz=fx;
    if(!camS.gp||camS.gk!==g){ camS.gk=g; camS.gp=safeCam(gateCam(g),1.0); }
    E.copy(camS.gp);
    tv4.set(g.x-fx*0.4,g.y+0.85,g.z-fz*0.4);
    if(VIEW.mode==="race"&&have) T.lerpVectors(tv4,r.pos,sstep(0.25,2.0,shot.t)); else T.copy(tv4);
    cFocus.copy(T);
    /* wide enough for both ends of the gate (and the pack once it's away) */
    const e1=v3.set(g.x+rx*g.gw*0.5,g.y,g.z+rz*g.gw*0.5).sub(E), e2=tv2.set(g.x-rx*g.gw*0.5,g.y,g.z-rz*g.gw*0.5).sub(E), ang=e1.angleTo(e2)*1.18, asp0=VIEW.W/Math.max(1,VIEW.H);
    RG.fov=clamp(2*Math.atan(Math.tan(ang/2)/Math.max(0.6,asp0))*R2D,22,70); RG.roll=0; RG.near=0.5; RG.clr=1.0; RG.follow=false;
  }

  /* ---------------- the replay: slow motion from recorded frames (render time only: the race is never touched) ----------------
     Every frame the riders' and the particles' drawn state (every instanced matrix, every particle attribute, a plain object's transform) is copied into a ring of
     the last 7 s (about 50 KB a frame, 60 Hz at most), with where every rider was. A replay draws COPIES of those meshes (shared geometry and materials) from the ring, at
     slow speed, through a low 3/4-rear camera and then a low side camera; the live meshes are hidden meanwhile and go on being updated by the race. */
  const REPLAY_SECS=7.0, GH=14;
  let REC=null, RP=null, replays=0; const replayed=new Set();
  function recBuild(){
    const R=VIEW.R, FXv=VIEW.FX; if(!R||!R.grp) return null;
    const roots=[R.grp]; if(FXv&&FXv.group) roots.push(FXv.group);
    const ch=[]; let total=0;
    roots.forEach(root=>root.traverse(o=>{
      if(o===root) return;
      if(o.isInstancedMesh){ const a=o.instanceMatrix.array; ch.push({o:o,k:"im",a:a,len:a.length,off:total}); total+=a.length;
        if(o.instanceColor){ const ca=o.instanceColor.array; ch.push({o:o,k:"imc",a:ca,len:ca.length,off:total}); total+=ca.length; }   /* (the bikes' team colours are per slot, and the slots are packed by level of detail every frame) */
        ch.push({o:o,k:"cnt",len:2,off:total}); total+=2; }   /* visible, count (the bikes are packed into the first slots of their level of detail's set) */
      else if(o.isPoints||o.isLine){ for(const nm in o.geometry.attributes){ const at=o.geometry.attributes[nm]; if(!at.array||at.isInterleavedBufferAttribute) continue; ch.push({o:o,k:"at",nm:nm,a:at.array,len:at.array.length,off:total}); total+=at.array.length; } }
      else if(o.isMesh&&o.geometry&&o.geometry.isInstancedBufferGeometry){
        /* a mesh drawn from per-instance attributes: the skinned riders (r3d-riders.js: the rider, his colours, his mud) are recorded (with the bone matrices below); the particle sprites and the lens flecks
           (r3d-fx.js: about 190 KB a frame) are NOT: their clones stay hidden in a replay */
        if(root===R.grp){ for(const nm in o.geometry.attributes){ const at=o.geometry.attributes[nm]; if(!at.isInstancedBufferAttribute||!at.array) continue; ch.push({o:o,k:"ib",nm:nm,a:at.array,len:at.array.length,off:total}); total+=at.array.length; }
          ch.push({o:o,k:"icnt",len:2,off:total}); total+=2; } }
      else { ch.push({o:o,k:"xf",len:11,off:total}); total+=11; } }));
    /* the skinned riders' bone matrices (a float data texture the riders' shader reads: one row a rider): the replay writes the recorded rows into it, the live frame rewrites them every step */
    if(R.bones&&R.boneTex){ ch.push({o:null,k:"bones",a:R.bones,len:R.bones.length,off:total}); total+=R.bones.length; }
    const ghOff=total; total+=VIEW.rs.length*GH;
    return {R:R,FX:FXv,roots:roots,ch:ch,total:total,ghOff:ghOff,Q:[],lastT:-1e9,clones:null,nRs:VIEW.rs.length};
  }
  function recDispose(){
    if(!REC) return;
    if(RP) replayEnd(true);
    if(REC.clones) REC.clones.forEach(c=>{ c.root.traverse(o=>{ if(o.isInstancedMesh) o.dispose(); }); if(c.root.parent) c.root.parent.remove(c.root); });
    REC=null;
  }
  function record(){
    const T=VIEW.T;
    if(!REC||REC.R!==VIEW.R||REC.FX!==VIEW.FX||REC.nRs!==VIEW.rs.length){ recDispose(); REC=recBuild(); if(!REC) return; }
    if(T<REC.lastT) REC.Q.length=0;   /* the clock went back (a new gate): start again */
    if(T-REC.lastT<1/31) return;   /* (30 Hz at most: a 7 s ring of the riders' state is about 30 MB at 60 Hz) */
    REC.lastT=T;
    let e; if(REC.Q.length&&T-REC.Q[0].T>REPLAY_SECS) e=REC.Q.shift(); else e={T:0,b:new Float32Array(REC.total)};
    e.T=T; const b=e.b, ch=REC.ch;
    for(let i=0;i<ch.length;i++){ const c=ch[i];
      if(c.k==="xf"){ const o=c.o, q=o.quaternion; let k=c.off; b[k++]=o.position.x; b[k++]=o.position.y; b[k++]=o.position.z; b[k++]=q.x; b[k++]=q.y; b[k++]=q.z; b[k++]=q.w; b[k++]=o.scale.x; b[k++]=o.scale.y; b[k++]=o.scale.z; b[k]=o.visible?1:0; }
      else if(c.k==="cnt"){ b[c.off]=c.o.visible?1:0; b[c.off+1]=c.o.count; }
      else if(c.k==="icnt"){ b[c.off]=c.o.visible?1:0; b[c.off+1]=c.o.geometry.instanceCount; }
      else b.set(c.a,c.off); }
    let k=REC.ghOff;
    for(let i=0;i<VIEW.rs.length;i++){ const r=VIEW.rs[i], p=r.pos;
      b[k++]=p?p.x:0; b[k++]=p?p.y:0; b[k++]=p?p.z:0; b[k++]=r.th||0; b[k++]=r.D||0; b[k++]=r.lat||0; b[k++]=r.v||0; b[k++]=r.oy!=null?r.oy:0; b[k++]=r.gy!=null?r.gy:0; b[k++]=r.air?1:0; b[k++]=r.lean||0; b[k++]=r.crash?1:0; b[k++]=(r.gone&&!r.crash)||!p?1:0; b[k++]=r.s||0; }
    REC.Q.push(e);
  }
  /* copies of the recorded meshes (once per race), the live ones' twins; the particles' geometry is copied too (their buffers are rewritten) */
  function recClones(){
    if(REC.clones) return REC.clones;
    const out=[];
    REC.roots.forEach(root=>{
      const c=root.clone(true), A=[], B=[]; root.traverse(o=>A.push(o)); c.traverse(o=>B.push(o));
      B.forEach((o,i)=>{ if(o.isPoints||o.isLine) o.geometry=o.geometry.clone();
        else if(o.isMesh&&o.geometry&&o.geometry.isInstancedBufferGeometry){ o.geometry=o.geometry.clone(); const src=A[i]; if(src.customDepthMaterial) o.customDepthMaterial=src.customDepthMaterial;   /* (the skinned riders' own shadow pass material: Mesh.copy does not carry it) */
          if(root!==VIEW.R.grp) o.visible=false; } });   /* the particle sprites and lens flecks are not recorded: hidden in a replay */
      const idx=new Map(); A.forEach((o,i)=>idx.set(o,i));
      REC.ch.forEach(ch=>{ const i=idx.get(ch.o); if(i!==undefined){ ch.c=ch.c||{}; ch.c[root.id]=B[i]; } });
      if(VIEW.R&&root===VIEW.R.grp&&VIEW.R.M&&VIEW.R.M.tag){ const i=idx.get(VIEW.R.M.tag); if(i!==undefined) B[i].visible=false; }   /* no number tags in a replay (they are placed for the live camera) */
      c.visible=false; const par=root.parent; if(par) par.add(c); out.push({root:c,src:root});
    });
    REC.clones=out; return out;
  }
  const rpq=new THREE.Quaternion();
  function ghostsFrom(b0,b1,f){
    const n=VIEW.rs.length;
    for(let i=0;i<n;i++){ const g=RP.gh[i], o=REC.ghOff+i*GH, L=k=>b0[o+k]+(b1[o+k]-b0[o+k])*f;
      g.pos.set(L(0),L(1),L(2)); g.th=b0[o+3]; g.D=L(4); g.lat=L(5); g.v=L(6); g.oy=L(7); g.gy=L(8); g.air=b0[o+9]>0.5; g.lean=L(10); g.crash=null; g.gone=b0[o+12]>0.5; g.s=b0[o+13]; g.onStart=false; }
  }
  function replayStart(o){
    if(RP||!VIEW.R||!VIEW.rs.length||VIEW.mode!=="race"||motion()==="off") return false;
    if(!REC||REC.R!==VIEW.R||REC.Q.length<24||o.subj<0) return false;
    const Q=REC.Q, t1=Q[Q.length-1].T, t0=Q[0].T; let ts, te;
    if(o.ev!=null){ ts=Math.max(t0,o.ev-1.3); te=Math.min(t1,o.ev+2.5); } else { ts=Math.max(t0,t1-5.2); te=t1; }
    if(te-ts<1.2) return false;
    const cl=recClones();
    RP={tp:ts,te:te,ts:ts,ev:o.ev!=null?o.ev:null,subj:o.subj,i:0,real:0,K0:newK(),K1:newK(),style:-1,spot:null,base:o.ev!=null?1.0:0.62,slow:0.3,
      gh:VIEW.rs.map(()=>({pos:new THREE.Vector3(),th:0,D:0,lat:0,v:0,oy:0,gy:0,air:false,lean:0,crash:null,gone:false,s:0,onStart:false}))};
    VIEW.R.grp.visible=false; if(VIEW.FX&&VIEW.FX.group) VIEW.FX.group.visible=false; cl.forEach(c=>{ c.root.visible=true; });
    replays++; camS.snap=true; return true;
  }
  function replayEnd(quiet){
    if(!RP) return;
    if(VIEW.R&&VIEW.R.grp) VIEW.R.grp.visible=true; if(VIEW.FX&&VIEW.FX.group) VIEW.FX.group.visible=true;
    if(REC&&REC.clones) REC.clones.forEach(c=>{ c.root.visible=false; });
    RP=null; if(REC) REC.Q.length=0;   /* the ring starts again (live frames recorded after the gap would not join the old ones) */
    camS.snap=true; if(!quiet&&shot&&VIEW.mode==="race") pickShot(true);
  }
  /* one replay frame: advance the playhead (slow around the event), write the interpolated state into the copies, place the camera */
  function replayFrame(dt){
    const Q=REC.Q, P=RP;
    const d=P.ev!=null?Math.abs(P.tp-P.ev):9, sp=P.ev!=null?P.base+(P.slow-P.base)*Math.exp(-d*d/(2*0.75*0.75)):P.base;
    P.tp=Math.min(P.te,P.tp+Math.max(0,dt)*sp); P.real+=Math.max(0,dt);
    while(P.i<Q.length-2&&Q[P.i+1].T<=P.tp) P.i++;
    while(P.i>0&&Q[P.i].T>P.tp) P.i--;
    const e0=Q[P.i], e1=Q[Math.min(Q.length-1,P.i+1)], f=e1.T>e0.T?clamp((P.tp-e0.T)/(e1.T-e0.T),0,1):0, b0=e0.b, b1=e1.b;
    REC.clones.forEach(cl=>{ REC.ch.forEach(c=>{ const o=c.c&&c.c[cl.src.id]; if(!o) return;
      if(c.k==="im"){ const a=o.instanceMatrix.array, off=c.off; for(let k=0;k<c.len;k++) a[k]=b0[off+k]+(b1[off+k]-b0[off+k])*f; o.instanceMatrix.needsUpdate=true; }
      else if(c.k==="at"){ const at=o.geometry.attributes[c.nm], a=at.array, off=c.off; for(let k=0;k<c.len;k++) a[k]=b0[off+k]+(b1[off+k]-b0[off+k])*f; at.needsUpdate=true; }
      else if(c.k==="imc"){ const a=o.instanceColor.array, off=c.off; for(let k=0;k<c.len;k++) a[k]=b0[off+k]; o.instanceColor.needsUpdate=true; }   /* (colours and counts are the earlier frame's: no blending of slots) */
      else if(c.k==="cnt"){ o.visible=b0[c.off]>0.5&&b0[c.off+1]>0; o.count=b0[c.off+1]|0; }
      else if(c.k==="ib"){ const at=o.geometry.attributes[c.nm], a=at.array, off=c.off; for(let k=0;k<c.len;k++) a[k]=b0[off+k]; at.needsUpdate=true; }
      else if(c.k==="icnt"){ o.visible=b0[c.off]>0.5&&b0[c.off+1]>0; o.geometry.instanceCount=b0[c.off+1]|0; }
      else { const off=c.off, L=k=>b0[off+k]+(b1[off+k]-b0[off+k])*f; o.position.set(L(0),L(1),L(2)); rpq.set(L(3),L(4),L(5),L(6)).normalize(); o.quaternion.copy(rpq); o.scale.set(L(7),L(8),L(9)); o.visible=f<0.5?b0[off+10]>0.5:b1[off+10]>0.5; } }); });
    { const bc=REC.ch[REC.ch.length-1]; if(bc&&bc.k==="bones"&&VIEW.R&&VIEW.R.bones===bc.a){ const a=bc.a, off=bc.off; for(let k=0;k<bc.len;k++) a[k]=b0[off+k]+(b1[off+k]-b0[off+k])*f; VIEW.R.boneTex.needsUpdate=true; } }   /* the riders' recorded bone matrices into the live bone texture (the clones read it; the live frame rewrites it at the next step) */
    ghostsFrom(b0,b1,f);
    /* the cameras: a low 3/4 rear chase, then (at the event) a low side view from the track's edge, a long lens panning with the rider */
    const g=P.gh[P.subj], second=P.ev!=null?P.tp>=P.ev-0.45:P.tp>=P.ts+(P.te-P.ts)*0.55;
    if(!second){ if(P.style!==0){ P.style=0; camS.snap=true; P.K0=newK(); } rigChase(g,-1,dt,camS.snap||dt<=0,{back:5.4,up:1.05,side:-2.6,fov:52,noCrash:true},P.K0,P.gh); RG.fov=52; }
    else {
      if(P.style!==1){ P.style=1; camS.snap=true; P.K1=newK(); P.spot=trackCam(g.s,1.3,[7,9,12,15,19],3.2,5.5,1.0); }
      const K=P.K1, snap=camS.snap||dt<=0; E.copy(P.spot); tv4.copy(g.pos); tv4.y-=0.2;
      if(!K.init||snap){ K.tx.snap(tv4.x); K.ty.snap(tv4.y); K.tz.snap(tv4.z); K.init=true; }
      T.set(K.tx.step(tv4.x,0.14,dt),K.ty.step(tv4.y,0.14,dt),K.tz.step(tv4.z,0.14,dt)); cFocus.copy(T);
      RG.fov=clamp(2*Math.atan(4.4/Math.max(4,E.distanceTo(T)))*R2D,20,50); RG.roll=0; RG.near=0.5; RG.clr=0.7; RG.follow=false;
    }
    if(P.tp>=P.te-1e-4||P.real>13) replayEnd();
  }
  /* auto replay: the person's own crash, once the live crash shot has run most of its course; on demand: the last few seconds of the person's rider (or the leader) */
  function replayAuto(){
    if(mode!=="auto"||RP||VIEW.mode!=="race"||VIEW.finished||VIEW.lapNo>=VIEW.lenLaps||!REC||!REC.Q.length) return;   /* never over the last lap and the flag */
    VIEW.rs.forEach((r,i)=>{ const c=r.crash; if(!c||VIEW.meSeats.indexOf(r.seat)<0||replayed.has(c.T)) return;
      if(VIEW.T-c.T>5.4&&REC.Q[0].T<=c.T-1.2){ replayed.add(c.T); replayStart({subj:i,ev:c.T+0.35}); } });
  }
  function replayNow(o){ if(o&&o.subj!=null) return replayStart({subj:o.subj,ev:o.ev!=null?o.ev:null}); const me=meList(), subj=me.length?me[0]:VIEW.leaderIdx(); if(subj<0) return false; return replayStart({subj:subj,ev:null}); }

  /* ---------------- the camera: the chosen rig, the lens, the safety, then the THREE camera ---------------- */
  function camera(dt){
    if(!shot) return;
    const sh=shot.type, off=motion()==="off";
    if(!RP&&VIEW.mode==="race"&&!off&&VIEW.R&&VIEW.replayOK!==false) record();
    let snap=camS.snap||dt<=0;
    const j=shot.subj>=0?shot.subj:VIEW.leaderIdx();
    const r=j>=0?VIEW.rs[j]:null, have=!!(r&&r.pos);
    let set=true;
    if(RP){ replayFrame(dt); snap=camS.snap||dt<=0; }
    else if(off&&VIEW.mode==="race"){
      /* reduced motion: a still wide frame, re-placed every few seconds (inside the wall in a stadium, never in the stands) */
      if(have&&(snap||!camS.offT||now()-camS.offT>6000)){ camS.offT=now(); cTarget.copy(r.pos); const p=inFloor({x:r.pos.x+24,z:r.pos.z+20}); E.set(p.x,r.pos.y+24,p.z); safeCam(E,6); camS.offE=E.clone(); }
      if(camS.offE) E.copy(camS.offE); T.copy(cTarget); RG.fov=50; RG.roll=0; RG.near=0.5; RG.clr=6; RG.follow=false;
    } else if(sh==="gate"&&VIEW.gate) rigGate(dt,snap,have,r);
    else if(!have){ set=false; /* nothing to follow */ }
    else if(sh==="chase"){ if(shot.wide) rigChase(r,j,dt,snap,{back:CHASE.back,up:CHASE.up,side:shot.why==="launch"?-1.5:CHASE.side,fov:CHASE.fov}); else rigHero(r,j,dt,snap); }   /* the hero chase (milestone 2) unless the shot asks for the wide one */
    else if(sh==="onboard") rigOnboard(r,j,dt,snap);
    else if(sh==="bcast") rigBroadcast(r,j,dt,snap);
    else if(sh==="wide") rigWide(r,j,dt,snap);
    else if(sh==="heli") rigHeli(r,j,dt,snap);
    else rigSpot(sh,r,j,dt,snap);
    if(!set) return;
    snap=snap||camS.snap;   /* a rig may cut inside its own shot (the broadcast changing sides): the lens snaps with it */
    /* the lens: smoothed across frames (a cut snaps it); a phone held upright gets a wider vertical field so the sides crop and the riders stay big */
    const asp=VIEW.W/Math.max(1,VIEW.H), fov=lensFov(RG.fov,asp,RP?"replay":sh);
    if(snap){ FS.snap(fov); ROLL.snap(RG.roll); camS.snap=false; } else { FS.step(fov,sh==="chase"&&!RP?0.12:0.3,dt); ROLL.step(RG.roll,0.05,dt); }   /* (the hero chase aims with the lens it asked for: a quick follower keeps its composition) */
    camS.fov=FS.x;
    /* never inside the dirt, a berm or a wall: the fixed spots are kept above the grid's dirt, the followers above the exact ground under them */
    if(!RG.follow){ safeCam(E,RG.clr); if(VIEW.C.kind==="stadium"&&sh!=="wide"&&sh!=="heli"&&!(sh==="bcast"&&!RP)) inFloor(E); }   /* (the broadcast stands in the stands, like the stadium-wide) */
    /* never inside the stands (the stadium's real seats, not the base profile): at least 2.5 m above whatever the bowl has under the eye; on the floor (d < 0) nothing changes */
    { const BY=VIEW.world&&VIEW.world.ctx&&VIEW.world.ctx.bowlY; if(BY){ const b=BY(E.x,E.z); if(b&&b.d>-0.5&&E.y<b.y+2.5) E.y=b.y+2.5; } }
    cTarget.copy(T);
    cam.position.copy(E); cam.lookAt(T);
    if(RG.roll) cam.rotateZ(-ROLL.x);
    if(Math.abs(cam.near-RG.near)>1e-4){ cam.near=RG.near; cam.updateProjectionMatrix(); }
    if(Math.abs(cam.fov-camS.fov)>0.01){ cam.fov=camS.fov; cam.updateProjectionMatrix(); }
    camS.roll=ROLL.x;
    /* is the person's rider in the frame? (the director brings him back after 5 s out of it: milestone 2) */
    { const me=VIEW.mode==="race"&&!RP?meList():null; if(me&&me.length){ const q=VIEW.rs[me[0]]; if(q&&q.pos){ cam.updateMatrixWorld(); tv3.copy(q.pos).project(cam); youOut=tv3.z<1&&Math.abs(tv3.x)<1&&Math.abs(tv3.y)<1?0:youOut+Math.max(0,dt); } } }
  }

  /* ---------------- the presets and the tools ---------------- */
  function setMode(m){ if(!m) return mode; if(!MODES.some(x=>x.id===m)) return mode; if(m===mode) return mode; mode=m; camS.snap=true; if(shot&&shot.type!=="gate"&&VIEW.mode==="race") pickShot(true); return mode; }
  function nextMode(){ const i=MODES.findIndex(x=>x.id===mode); return setMode(MODES[(i+1)%MODES.length].id); }
  /* tests: hold a shot as it would be chosen (pri 99: nothing cuts it) */
  function force(spec){ const s=Object.assign({pri:99,min:1e9,max:1e9,why:"test"},spec); if(s.type==="wide"||s.type==="bcast") lapWide=VIEW.lapNo; setShot(s); return shot; }

  return {
    get shot(){ return shot; }, get shotLog(){ return shotLog; }, get featLog(){ return featLog; }, get target(){ return cTarget; }, get focus(){ return cFocus; }, camS:camS,
    /* a new course: the grid of the dirt's heights (so no camera sits inside a jump), the corners; a new race: forget the shots */
    buildGrid:function(){ HG=heightGrid(); buildCorners(); RAILS=null; },
    reset:function(){ camS.gp=null; shotLog=[]; featLog=[]; cornLog=[]; share=0.5; youOut=0; earlyT=-1e9; lapWide=-1; launched=false; onbCool=0; wideSide=0; camS.offE=null; recDispose(); replayed.clear(); replays=0; },
    snap:function(){ camS.snap=true; },
    modes:function(){ return MODES.map(m=>({id:m.id,name:m.name})); }, mode:setMode, nextMode:nextMode, replayNow:replayNow,
    state:function(){ return {mode:mode,shot:shot?{type:shot.type,why:shot.why||"",subj:shot.subj,mount:shot.k&&shot.k.mount||""}:null,youOut:+youOut.toFixed(1),replay:!!RP,replays:replays,rec:REC?REC.Q.length:0,recMB:REC?+(REC.Q.length*REC.total*4/1048576).toFixed(1):0,share:+share.toFixed(2)}; },
    setShot:setShot, pickShot:pickShot, director:director, camera:camera, force:force,
    sees:sees, safeCam:safeCam, dirtTop:dirtTop, terrainAt:terrainAt, inFloor:inFloor, corners:()=>CORN,
    trackCam:trackCam, featCam:featCam, cornerCam:cornerCam, lineCam:lineCam, crashCam:crashCam, yellowCam:yellowCam, gateCam:gateCam, turn1Cam:turn1Cam, spotCam:spotCam, secPt:secPt
  };
}
