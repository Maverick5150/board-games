/* MOTOCROSS WAR 3D — THE CAMERAS (owner: cams): the TV director (which shot next, cutting between sections as the leader rides them: the gate,
   the holeshot, the whoops, the big jump, a battle for position, a crash about to happen, the yellow flag, chase cams, the heli shot, the
   white flag and the line), every camera rig (chase, heli, trackside, feature, spot, crash, yellow, gate, turn 1, line), where to stand
   so the dirt never hides the action (the grid of the dirt's heights, sight lines, a camera never under the dirt), and the camera itself
   (position, look-at, field of view, smoothing). Moved out of race3d.js; only edit: the view's live state that was a closure variable is
   read as VIEW.name (the file split: no visual change).
   createCams(VIEW) -> CAMS. VIEW = the view's LIVE state (getters, race3d.js owns it; read-only here, never assign): VIEW.cam (the THREE
   camera), VIEW.C (the course), VIEW.world, VIEW.rs (the riders' records), VIEW.gate, VIEW.marshal, VIEW.T (the race clock, s), VIEW.lapNo,
   VIEW.lenLaps, VIEW.mode ("gate" | "race" | "idle"), VIEW.holdInfo, VIEW.yellow, VIEW.lapPlan, VIEW.meSeats, VIEW.W, VIEW.H (the canvas
   size), VIEW.leaderIdx().
   CAMS.shot (the current shot), CAMS.setShot(s), CAMS.pickShot(force), CAMS.director(dt), CAMS.camera(dt) (every frame, in that order),
   CAMS.buildGrid() (a new course), CAMS.reset() (a new race), CAMS.snap(), CAMS.target, CAMS.sees(a, b), CAMS.terrainAt(x, z, y), CAMS.dirtTop(x, z)
   and the camera spots (trackCam, featCam, lineCam ...) for tests. */
import * as THREE_NS from "../ui/vendor/three-0.160.0.module.min.js";
const THREE=THREE_NS;
import {clamp,sstep,now,clear,clearDist} from "./r3d-util.js";
import {motionMode} from "./r3d-quality.js";
const MX=(typeof window!=="undefined"?window:globalThis).MXWar;
const PI=Math.PI;
const motion=motionMode;
export function createCams(VIEW){
  /* ---------------- the cameras' own state ---------------- */
  let shot=null, shotLog=[], featLog=[], HG=null;
  const camS={pos:new THREE.Vector3(),look:new THREE.Vector3(),fov:50,snap:true};
  const tmpO={}, v3=new THREE.Vector3();   /* scratch */
  const cam=VIEW.cam;   /* the THREE.PerspectiveCamera (race3d.js owns it; these functions move it) */

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
  /* the dirt's height in the one cell under (x, z) (no neighbours: for sight lines) */
  function dirtCell(x,z){ if(!HG) return -1e9; const i=Math.floor((x-HG.x0)/HG.cs), j=Math.floor((z-HG.z0)/HG.cs); if(i<0||j<0||i>=HG.nx||j>=HG.nz) return -1e9; return HG.H[j*HG.nx+i]; }
  /* can a camera at a see b over the dirt (a jump, a landing, a berm in between)? the far end's own cell doesn't count */
  function sees(a,b,margin){
    const d=Math.hypot(b.x-a.x,b.z-a.z), n=Math.max(2,Math.ceil(d/1.2)), m=margin!=null?margin:0.25;
    const hf=VIEW.world&&VIEW.world.ctx.hf;
    for(let k=1;k<n;k++){ const t=k/n; if(t*d>d-2.2) break; const x=a.x+(b.x-a.x)*t, z=a.z+(b.z-a.z)*t, y=a.y+(b.y-a.y)*t; if(dirtCell(x,z)>y-m) return false; if(hf&&hf(x,z)>y-m-0.3) return false; }   /* the dirt, and outdoors the hills */
    return true;
  }
  /* a camera at p stays at least clr above the dirt and the ground under it */
  function safeCam(p,clr){ const y=Math.max(dirtTop(p.x,p.z),VIEW.world&&VIEW.world.ctx.hf?VIEW.world.ctx.hf(p.x,p.z):-1e9,VIEW.C&&VIEW.C.kind==="stadium"?-0.16:-1e9); if(p.y<y+clr) p.y=y+clr; return p; }

  /* ---------------- the camera director: the whole lap at real speed, cut between sections as the leader rides them ---------------- */
  function setShot(s){ shot=s; shot.t=0; camS.snap=true; if(s.why==="yellow"&&VIEW.yellow) VIEW.yellow.shown=true; shot.cam=typeof s.cam==="function"?s.cam():(s.cam||null); shotLog.push(s.type+(s.why?":"+s.why:"")); if(shotLog.length>12) shotLog.shift(); }
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
  /* a trackside camera beside loop distance s: the side with room, off the track (inside the wall in a stadium) */
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
  function featCam(f){
    const sp=(VIEW.C.spots||[]).find(x=>Math.abs(x.mid-(f.from+f.to)/2)<3), out=VIEW.C.kind!=="stadium";
    /* the whole section in sight, not just its middle: the whoops from end to end, a jump's lip and its landing */
    const xt=f.k==="whoops"?[secPt(f.from+4,1),secPt(f.to-4,1)]:f.k==="jump"?[secPt(f.lip!=null?f.lip:f.from+3,1.2),secPt(f.to-2,0.8)]:null;
    /* a jump: from below the landing side, looking up at the riders against the sky (outdoors higher and further back: the hills' big
       faces would hide them) */
    if(f.k==="jump"){ const at=f.lip!=null?f.lip+(f.to-f.lip)*0.55:(f.from+f.to)/2; return out?trackCam(at,3.6,[12,16,21,27],4.5,10,(f.h||2)+1.5,xt):trackCam(at,1.5,[9,12,15,19],undefined,undefined,(f.h||2)+1.5,xt); }
    if(f.k==="whoops"&&sp){ const p=inFloor({x:sp.x,z:sp.z}), fm=MX.Course.frame(VIEW.C,sp.mid,tmpO), c=safeCam(new THREE.Vector3(p.x,terrainAt(p.x,p.z,sp.y)+5.5,p.z),1.5);
      if(clearDist(VIEW.C,p.x,p.z)>=4&&Math.hypot(p.x-fm.x,p.z-fm.z)>=fm.hw+7&&sees(c,new THREE.Vector3(fm.x,MX.Course.ground(VIEW.C,sp.mid,0)+1,fm.z))&&xt.every(t=>sees(c,t))) return c; }
    if(f.k==="whoops") return trackCam((f.from+f.to)/2,VIEW.C.kind==="stadium"?5.5:7.5,undefined,undefined,undefined,undefined,xt);
    /* a rhythm lane, the sand, a step-up: further back and higher, a third of the way along, looking down on the lane (the riders ahead
       must not fill the lens) */
    return trackCam(f.from+(f.to-f.from)*0.35,VIEW.C.kind==="stadium"?7:5,[14,18,23,29,36],5.5,11,1.6);
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
      const cd=clearDist(VIEW.C,p.x,p.z); if(cd<1.2) continue;
      const ahead=((p.x-cx)*fdir.x+(p.z-cz)*fdir.z)/dd; cand.push({p:p,cd:cd,sc:Math.min(cd,3.5)*1.2-Math.abs(dd-want)*0.4+ahead*0.9}); }
    cand.sort((a,b)=>b.sc-a.sc);
    let best=null, bs=-1e9;
    for(const c0 of cand){ if(c0.sc<=bs) break;
      const base=terrainAt(c0.p.x,c0.p.z,fy); let hi=0;
      for(const h of heights){ if(c0.sc-hi*0.8<=bs) break; const q=safeCam(new THREE.Vector3(c0.p.x,base+h+(c0.cd<3?1:0),c0.p.z),1.2); if(targets.every(t=>sees(q,t))){ bs=c0.sc-hi*0.8; best=q; break; } hi++; } }
    return best;
  }
  /* the crash camera: close (about 9.5 m from where the rider lands), a crane at about 5 m looking down over the riders passing the crash,
     beside or a little ahead of the crash so the rider tumbles toward the lens */
  function crashCam(s){
    const f=MX.Course.frame(VIEW.C,s+3,tmpO), tgt=new THREE.Vector3(f.x,MX.Course.ground(VIEW.C,s+3,0)+0.7,f.z);
    return spotCam(f.x,f.z,f.y,{x:Math.cos(f.th),z:Math.sin(f.th)},[tgt],[8,9.5,11.5,14],[5,7,9],9.5)||trackCam(s+5,2.4,[6,8.5,11,14,18],3.2,5);
  }
  /* the yellow lap: the marshal waving the flag and the riders coming into the section, both in sight */
  function yellowCam(ys){
    const f=MX.Course.frame(VIEW.C,ys,{}), fa=MX.Course.frame(VIEW.C,ys-14,{}), T=[new THREE.Vector3(f.x,MX.Course.ground(VIEW.C,ys,0)+1,f.z),new THREE.Vector3(fa.x,MX.Course.ground(VIEW.C,ys-14,0)+1,fa.z)];
    let av=null, cx=f.x, cz=f.z, dir={x:Math.cos(f.th),z:Math.sin(f.th)};
    if(VIEW.marshal&&VIEW.marshal.grp.visible){ const m=VIEW.marshal.grp.position; T.push(m.clone().add(v3.set(0,1.5,0))); av=[{x:m.x,z:m.z,d:9}]; cx=(f.x+m.x)/2; cz=(f.z+m.z)/2;   /* the marshal 9 m or more from the lens */
      /* across the track from him, a little ahead: the riders pass between the lens and the flag (the classic shot; polish: from his own
         side the frame was grass and his back) */
      const ax=f.x-m.x, az=f.z-m.z, al=Math.hypot(ax,az)||1; dir={x:ax/al*0.8+Math.cos(f.th)*0.6,z:az/al*0.8+Math.sin(f.th)*0.6}; const dl=Math.hypot(dir.x,dir.z)||1; dir.x/=dl; dir.z/=dl; }
    return spotCam(cx,cz,f.y,dir,T,[11,14,17,21,26],[3.5,6,9,12],15,av)||trackCam(ys+2,3.4,[8,11,14,18,23],3.5,6);
  }
  /* the gate camera: low, a few metres beyond the start straight's edge and a little ahead of the gate (the side with more room) */
  function gateCam(g){
    const fx=Math.cos(g.th), fz=Math.sin(g.th), rx=-fz, rz=fx, fwd=6+g.gw*0.22, lat=g.gw*0.5+4.5, ht=1.6+g.gw*0.035;
    let best=null, bd=-1e9;
    for(const sd of [1,-1]){ const p=inFloor({x:g.x+fx*fwd+rx*lat*sd,z:g.z+fz*fwd+rz*lat*sd}), cd=clearDist(VIEW.C,p.x,p.z); if(cd>bd){ bd=cd; best=p; } }
    return new THREE.Vector3(best.x,terrainAt(best.x,best.z,g.y)+ht+(bd<2?2.5:0),best.z);
  }
  function turn1Cam(){
    let f; if(VIEW.C.S.n){ f=MX.Course.startFrame(VIEW.C,Math.max(0,VIEW.C.Ls-16),tmpO); } else f=MX.Course.frame(VIEW.C,VIEW.C.join+Math.max(10,VIEW.C.hsD-16),tmpO);
    const side=-Math.sign(f.k||1)||1;
    for(const dist of [14,20,26]){ const lat=side*(f.hw+dist), x=f.x-Math.sin(f.th)*lat, z=f.z+Math.cos(f.th)*lat; if(clear(VIEW.C,x,z,2)){ const p=inFloor({x:x,z:z}); return new THREE.Vector3(p.x,terrainAt(p.x,p.z,f.y)+10,p.z); } }
    const p=inFloor({x:f.x+20,z:f.z+20}); return new THREE.Vector3(p.x,terrainAt(p.x,p.z,0)+10,p.z);
  }
  /* the line: from beyond it, low, across the track from the flagger: the riders come at the lens over the stripe, the flagger and the
     flag up on the tower behind them */
  function lineCam(){ const fin=VIEW.world.fin, f=MX.Course.frame(VIEW.C,0,{}), th=f.th, sd0=-Math.sign(fin.lat||1);
    /* it must see the riders coming to the line and the flag over any jump or landing just past it (polish: at a traced track with a
       jump right after the line the lens saw only the landing's back); the first spot that does, from the classic low one up */
    const T=[secPt(0,1),secPt(-22,1),fin.flagAt.clone().add(v3.set(0,1.2,0))];
    for(const h of [2.1,3.6,5.5,8]) for(const fw of [11,8,15,20]) for(const sd of [sd0,-sd0]){ const lat=sd*(f.hw+3.5);
      const p=inFloor({x:f.x+Math.cos(th)*fw-Math.sin(th)*lat,z:f.z+Math.sin(th)*fw+Math.cos(th)*lat}); if(clearDist(VIEW.C,p.x,p.z)<1.5) continue;
      const c=safeCam(new THREE.Vector3(p.x,terrainAt(p.x,p.z,f.y)+h,p.z),1.2); if(T.every(t=>sees(c,t))) return c; }
    const lat=sd0*(f.hw+3.5), p=inFloor({x:f.x+Math.cos(th)*11-Math.sin(th)*lat,z:f.z+Math.sin(th)*11+Math.cos(th)*lat}); return safeCam(new THREE.Vector3(p.x,terrainAt(p.x,p.z,f.y)+5.5,p.z),1.2); }
  function candidates(urgent){
    const L=[], lead=VIEW.leaderIdx(); if(lead<0) return L;
    const r=VIEW.rs[lead], me=VIEW.meSeats.filter(s=>VIEW.rs[s]&&!VIEW.rs[s].gone&&!VIEW.rs[s].crash);
    if(VIEW.lapNo===1&&r.D<VIEW.C.hsD&&VIEW.C.hsD-r.D<62&&!(shot&&shot.type==="turn1")) L.push({type:"turn1",subj:lead,pri:9.2,min:4.5,max:8,cam:turn1Cam});   /* the holeshot: never missed */
    VIEW.rs.forEach((k,i)=>{ if(k.crashPlan&&!k.crash&&!k.gone&&!k.onStart&&k.lapN>=k.crashPlan.lap){ const d=MX.Course.wrap(VIEW.C,k.crashPlan.s-k.s); if(d>0&&d<Math.max(10,k.v*2.6)){ const out=k.crashPlan.kind==="out"; const cs=k.crashPlan.s; L.push({type:"crash",subj:i,pri:10,min:out?7.5:8.4,max:out?9.5:10.5,cam:()=>crashCam(cs)}); } } });
    if(!r.onStart){ const toLine=VIEW.C.L-r.s, tl=toLine/Math.max(4,r.v), over=VIEW.lapPlan&&VIEW.lapPlan.over&&VIEW.lapPlan.n>=VIEW.lapNo;
      if(tl<3.4&&(over||VIEW.lapNo===VIEW.lenLaps-1||VIEW.lapNo%3===0)) L.push({type:"line",subj:lead,pri:over?9:VIEW.lapNo===VIEW.lenLaps-1?7:4,min:3.2,max:over?7:5,cam:lineCam}); }
    /* the yellow lap: once, the first rider (in running order) about to ride through the yellow section, with the marshal in the frame */
    if(VIEW.yellow&&VIEW.yellow.lap===VIEW.lapNo&&!VIEW.yellow.shown){ const ys=VIEW.yellow.s; let yi=-1;
      VIEW.rs.map((k,i)=>i).filter(i=>!VIEW.rs[i].gone&&!VIEW.rs[i].crash&&!VIEW.rs[i].onStart).sort((a,b)=>VIEW.rs[b].D-VIEW.rs[a].D).some(i=>{ const k=VIEW.rs[i], d=MX.Course.wrap(VIEW.C,VIEW.yellow.s0-k.s); if(d>2&&d<Math.max(14,k.v*4.5)){ yi=i; return true; } return false; });
      if(yi>=0) L.push({type:"track",subj:yi,pri:6.5,min:4.5,max:7,cam:()=>yellowCam(ys),why:"yellow"}); }
    if(urgent) return L;
    [lead].concat(me).forEach((j,ix)=>{ const qq=VIEW.rs[j]; if(!qq||qq.onStart) return; const nf=nextFeat(qq.s); if(!nf) return; const tt=nf.d/Math.max(4,qq.v);
      if(tt<3.0&&tt>0.2){ const f=nf.f, seen=featLog.slice(-2).indexOf(f.from)>=0; L.push({type:f.k==="whoops"?"whoops":f.k==="jump"?"jump":"track",subj:j,pri:(ix?4.6:5)-(seen?1.6:0)+(f.big?0.4:0),min:3.2,max:6.5,cam:()=>featCam(f),feat:f,why:f.k}); } });
    const ord=VIEW.rs.filter(x=>!x.gone&&!x.crash&&!x.onStart).sort((a,b)=>b.D-a.D);
    for(let k=1;k<Math.min(ord.length,14);k++){ const a=ord[k-1], b=ord[k], gap=a.D-b.D, closing=b.v-a.v;
      if(gap<8&&gap>0.5&&closing>0.25){ const imp=(k<=4?2:0)+(VIEW.meSeats.indexOf(a.seat)>=0||VIEW.meSeats.indexOf(b.seat)>=0?2:0)+(VIEW.lapPlan&&(VIEW.lapPlan.win===a.seat||VIEW.lapPlan.win===b.seat)?2:0);
        if(imp>=2){ const bs=b.s+b.v*2.2; L.push({type:"track",subj:b.k,victim:a.k,pri:4.2+imp*0.3,min:3.5,max:6.5,cam:()=>trackCam(bs,2.6),why:"battle"}); break; } } }
    if(VIEW.holdInfo&&VIEW.holdInfo.war) VIEW.holdInfo.war.forEach((j,ix)=>{ if(VIEW.rs[j]&&!VIEW.rs[j].gone&&!VIEW.rs[j].onStart) L.push({type:"chase",subj:j,pri:3.6-ix*0.1,min:3,max:4.5,why:"war"}); });
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
    if(VIEW.mode!=="race") return;
    if(shot.type==="gate"&&shot.t<shot.min) return;
    if(shot.pri<9&&shot.t>0.6){ const L=candidates(true).filter(c=>c.pri>shot.pri&&(c.pri>=9||(c.pri>shot.pri+2.5&&shot.t>1.2))).sort((a,b)=>b.pri-a.pri); if(L.length){ setShot(L[0]); return; } }   /* a crash, the holeshot, the checkered flag cut in at once; the white flag or the yellow section over a filler shot */
    if(shot.t>=shot.max){ pickShot(); return; }
    if(shot.t>=shot.min){
      const r=VIEW.rs[shot.subj];
      if(shot.feat&&r&&!r.onStart){ const d=MX.Course.wrap(VIEW.C,r.s-shot.feat.to); if(d<VIEW.C.L/2&&d>3){ pickShot(); return; } }
      if(shot.cam&&r&&r.pos&&shot.type!=="crash"&&shot.type!=="line"){ dirA.subVectors(shot.cam,r.pos); fwA.set(Math.cos(r.th||0),0,Math.sin(r.th||0)); if(dirA.dot(fwA)<-6||dirA.length()<5){ pickShot(); return; } }
      if(!shot.cam&&shot.t>=shot.min+1.5) pickShot();
    }
  }
  const cTarget=new THREE.Vector3(), cPos=new THREE.Vector3(), tv3=new THREE.Vector3(), tv4=new THREE.Vector3(), tv2=new THREE.Vector3();
  function camera(dt){
    if(!shot) return;
    const sh=shot.type, snap=camS.snap||dt<=0; let fov=50;
    const off=motion()==="off";
    const j=shot.subj>=0?shot.subj:VIEW.leaderIdx();
    const have=j>=0&&VIEW.rs[j]&&VIEW.rs[j].pos; if(have) tv3.copy(VIEW.rs[j].pos);
    if(off&&VIEW.mode==="race"){
      /* reduced motion: a still wide frame, re-placed every few seconds (inside the wall in a stadium, never in the stands) */
      if(have&&(snap||!camS.offT||now()-camS.offT>6000)){ camS.offT=now(); cTarget.copy(tv3); const p=inFloor({x:tv3.x+24,z:tv3.z+20}); cPos.set(p.x,tv3.y+24,p.z); safeCam(cPos,6); }
      fov=50;
    } else if(sh==="gate"&&VIEW.gate){
      const g=VIEW.gate, fx=Math.cos(g.th), fz=Math.sin(g.th), rx=-fz, rz=fx;
      if(!camS.gp||camS.gk!==g){ camS.gk=g; camS.gp=safeCam(gateCam(g),1.2); }
      cPos.copy(camS.gp);
      tv4.set(g.x-fx*0.4,g.y+0.85,g.z-fz*0.4);
      if(VIEW.mode==="race"&&have) cTarget.lerpVectors(tv4,tv3,sstep(0.25,2.0,shot.t)); else cTarget.copy(tv4);
      /* wide enough for both ends of the gate (and the pack once it's away) */
      const e1=v3.set(g.x+rx*g.gw*0.5,g.y,g.z+rz*g.gw*0.5).sub(cPos), e2=tv2.set(g.x-rx*g.gw*0.5,g.y,g.z-rz*g.gw*0.5).sub(cPos), ang=e1.angleTo(e2)*1.18;
      const asp0=VIEW.W/Math.max(1,VIEW.H); fov=clamp(2*Math.atan(Math.tan(ang/2)/Math.max(0.6,asp0))*180/PI,22,70);
    } else if(!have){ /* nothing to follow */ }
    else if(sh==="chase"||sh==="heli"){
      /* chase: low behind the rider, the track ahead in the frame; heli: a cable-cam view from behind and above (inside the wall in a
         stadium), tight enough that the rider reads */
      const r=VIEW.rs[j], th=r.th||0, heli=sh==="heli", back=heli?16:7.2, up=heli?10:2.6, clr=heli?3.5:1.5;
      tv4.set(tv3.x-Math.cos(th)*back,Math.max(tv3.y+up,(r.gy||0)+1.9),tv3.z-Math.sin(th)*back);
      if(VIEW.C.kind==="stadium"&&VIEW.C.layout.floor){ const p=inFloor({x:tv4.x,z:tv4.z}); tv4.x=p.x; tv4.z=p.z; }
      safeCam(tv4,clr);
      if(snap) cPos.copy(tv4); else cPos.lerp(tv4,1-Math.exp(-dt/0.32));
      safeCam(cPos,clr);
      const ah=heli?3:6;
      tv4.set(tv3.x+Math.cos(th)*ah,tv3.y-(heli?0.5:0.15),tv3.z+Math.sin(th)*ah);
      if(snap) cTarget.copy(tv4); else cTarget.lerp(tv4,1-Math.exp(-dt/0.12));
      fov=heli?40:54;
    } else {
      if(!shot.cam) shot.cam=trackCam(VIEW.rs[j].s||0,3);
      cPos.copy(shot.cam); safeCam(cPos,1.2);
      tv4.copy(tv3); let spread=0, base=sh==="whoops"?6:sh==="jump"?6.5:sh==="turn1"?10:sh==="line"?3.2:sh==="crash"?2.6:2.4;
      const cr=sh==="crash"?VIEW.rs[j].crash:null;
      if(cr){ /* the crash: tight on the rider and the bike while it happens; once the rider is down the marshal's yellow flag joins the frame */
        const t=VIEW.T-cr.T, bp=VIEW.rs[j].bikeP;
        if(bp){ tv4.lerp(bp,0.35); spread=Math.min(7,bp.distanceTo(tv3))*0.9; }
        if(VIEW.marshal&&VIEW.marshal.grp.visible){ const mp=VIEW.marshal.grp.position, k=sstep(1.3,2.6,t), dm=Math.hypot(mp.x-tv3.x,mp.z-tv3.z);
          if(dm<22){ tv4.x+=(mp.x-tv4.x)*0.32*k; tv4.y+=(mp.y+1.5-tv4.y)*0.32*k; tv4.z+=(mp.z-tv4.z)*0.32*k; spread=Math.max(spread,Math.min(9,dm*0.7)*k); } }
        base=2.2;
      }
      else if(shot.victim!=null&&VIEW.rs[shot.victim]&&VIEW.rs[shot.victim].pos){ tv4.lerp(VIEW.rs[shot.victim].pos,0.45); spread=Math.min(14,VIEW.rs[shot.victim].pos.distanceTo(tv3)); }
      else if(sh==="line"&&VIEW.world.fin){ /* the flagger's flag in the frame with the rider */
        const fp=VIEW.world.fin.flagAt, dm=Math.hypot(fp.x-tv3.x,fp.z-tv3.z); tv4.set(tv4.x+(fp.x-tv4.x)*0.4,tv4.y+(fp.y+1.6-tv4.y)*0.4,tv4.z+(fp.z-tv4.z)*0.4); spread=Math.min(18,dm*0.9+2); }
      else if(shot.why==="yellow"&&VIEW.marshal&&VIEW.marshal.grp.visible){ /* the yellow section: the marshal waving the flag, the riders coming through
          (the riders join the frame as they arrive; a rider still far off doesn't pull the marshal out of it) */
        const mp=VIEW.marshal.grp.position, dm=Math.hypot(mp.x-tv3.x,mp.z-tv3.z);
        if(dm<26){ tv4.set((tv4.x+mp.x)/2,(tv4.y+mp.y+1.4)/2,(tv4.z+mp.z)/2); spread=Math.min(14,dm*0.8); }
        else if(VIEW.yellow){ const sp=secPt(VIEW.yellow.s,1); tv4.set((sp.x+mp.x)/2,(sp.y+mp.y+1.3)/2,(sp.z+mp.z)/2); spread=Math.min(8,Math.hypot(sp.x-mp.x,sp.z-mp.z)); }   /* the section and the flag, waiting for the riders */
        else { const k=4/dm; tv4.set(mp.x+(tv3.x-mp.x)*k,mp.y+1.3,mp.z+(tv3.z-mp.z)*k); spread=4; } }
      tv4.y-=0.3;
      if(snap) cTarget.copy(tv4); else cTarget.lerp(tv4,1-Math.exp(-dt/(cr?0.18:0.1)));
      const dist=cPos.distanceTo(cTarget), wantW=2.6+spread*0.8+base+(cr?0:Math.max(0,dist-22)*0.05);   /* a far subject: a little more of the scene round it */
      fov=clamp(2*Math.atan(wantW/(2*dist))*180/PI*1.6,sh==="line"?12:19,64);
      if(sh==="turn1") fov=clamp(fov,26,64);
      if(shot.why==="yellow"){ const asp=Math.max(0.8,VIEW.W/Math.max(1,VIEW.H)); fov=clamp(2*Math.atan((11+spread*0.5)/asp/(2*dist))*180/PI,14,52); }   /* the yellow section about 12 m across */
      if(sh==="crash"){ /* the crash: framed by the scene's width (the rider, the bike, then the marshal): about 7 m across, never a speck */
        /* (the width across the screen whatever its shape: an upright phone gets the same scene, taller) */
        const visW=(cr?6.2+spread*1.25:8+Math.max(0,dist-12)*0.3)*(VIEW.W<VIEW.H?0.85:1), asp=VIEW.W/Math.max(1,VIEW.H);
        fov=clamp(2*Math.atan(visW/asp/(2*dist))*180/PI,8,VIEW.W<VIEW.H?75:55); }
    }
    /* a portrait screen: a little wider vertically, the sides cropped (the riders stay big) */
    const asp=VIEW.W/Math.max(1,VIEW.H); if(asp<1&&sh!=="gate"&&sh!=="crash") fov=clamp(2*Math.atan(Math.tan(fov*PI/360)/Math.max(0.78,Math.pow(asp,0.55)))*180/PI,10,80);
    if(snap){ camS.fov=fov; camS.snap=false; } else camS.fov+=(fov-camS.fov)*Math.min(1,dt*4);
    cam.position.copy(cPos); cam.lookAt(cTarget); if(Math.abs(cam.fov-camS.fov)>0.01){ cam.fov=camS.fov; cam.updateProjectionMatrix(); }
  }

  return {
    get shot(){ return shot; }, get shotLog(){ return shotLog; }, get featLog(){ return featLog; }, get target(){ return cTarget; }, camS:camS,
    /* a new course: the grid of the dirt's heights (so no camera sits inside a jump); a new race: forget the shots */
    buildGrid:function(){ HG=heightGrid(); },
    reset:function(){ camS.gp=null; shotLog=[]; featLog=[]; },
    snap:function(){ camS.snap=true; },
    setShot:setShot, pickShot:pickShot, director:director, camera:camera,
    sees:sees, safeCam:safeCam, dirtTop:dirtTop, terrainAt:terrainAt, inFloor:inFloor,
    trackCam:trackCam, featCam:featCam, lineCam:lineCam, crashCam:crashCam, yellowCam:yellowCam, gateCam:gateCam, turn1Cam:turn1Cam, spotCam:spotCam, secPt:secPt
  };
}
