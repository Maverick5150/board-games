/* MOTOCROSS WAR 3D — THE CAMERA DIRECTOR. One module, a small interface, so the broadcast pass (a real Supercross / Motocross television
   broadcast: BG_audit/games/mxwar/BROADCAST-CAMERA.md) can rework the camera work here and nowhere else. window.MXWar.Director3D.create(X) -> D.
   THE SHOT LIST it plays (D.shots, kind -> what it is): gate (the start from the gate, a lock-on of the leader as it drops), turn1 (the
   holeshot into turn 1), chase (the COVER shot: low behind a bike, 3.5 m back, 1.5 m up, a wide lens), side / wide (trackside at an obstacle
   or a turn: the whoops, the big jump), battle (a pass seen side on), crash (abreast of the tumble), yellow (the marshal's section), line
   (the finish line and its flagger), heli (a crane over the stadium), stands (the HIGH GRANDSTAND camera: the whole dirt course and every
   rider, as from the seats), onboard (the helmet camera).
   THE EVENTS it reacts to (D.onResult / D.onCrash / D.onYellow, called by race3d.js as the race happens): a lap's result plans the lap's
   RESERVED shots (the gate drop and the holeshot on the first lap, the lap's featured pass, the yellow section, the leader at the line); a
   crash reserves its shot; between reserved shots a FILLER is picked (trackside at the next obstacle the leader reaches, a close battle, the
   chase on you or the leader, a wide at an obstacle, now and then the crane), a cut every 4-7 s, never the same shot twice in a row.
   THE STORYLINE hook: D.story({leader, you, fights:[[seatBehind, seatAhead]], comeback, ...}) tells the director what the race is about right
   now (the broadcast pass chooses shots from it); today the filler picks read the race themselves (closePair, meSeat).
   THE PRESETS the person can pick (the CEO's visual pack: cover chase, broadcast trackside, grandstand full track, onboard): D.preset(name)
   locks one kind ("chase" | "stands" | "side" | "onboard"), "auto" = the director. */
(function(g){
"use strict";
var MX=g.MXWar=g.MXWar||{};
if(MX.Director3D) return;
var PI=Math.PI;
function clamp(x,a,b){ return x<a?a:x>b?b:x; }
function lerp(a,b,t){ return a+(b-a)*t; }
function sstep(x){ x=clamp(x,0,1); return x*x*(3-2*x); }
var SHOTS={
  gate:"the start from the gate: the camera locks on the leader as the gate drops",
  turn1:"the holeshot: the leader into turn 1",
  chase:"the cover shot: low behind a bike (3.5 m back, 1.5 m up, a wide lens), damped, lifting over a rider in between",
  side:"trackside at the next obstacle or turn the leader reaches (the whoops, the big jump)",
  wide:"a wider trackside view of an obstacle with the field coming through",
  battle:"two riders side by side, from the side with more room",
  crash:"abreast of where the bike and the rider come to rest",
  yellow:"the marshal waving the yellow flag at the section",
  line:"the finish line, its arch and the flagger, the leader riding through",
  heli:"a crane high over the stadium, orbiting",
  stands:"the high grandstand camera: the whole dirt course and every rider, as from the seats",
  onboard:"the helmet camera of a rider (you, else the leader)"
};
var LOCKABLE={chase:1,stands:1,side:1,onboard:1,heli:1,wide:1};
function create(X){
  var V=X.V, CAM=X.CAM, EYE=[0,0,0], TGT=[0,0,0], CHP={};
  var D={shots:SHOTS,presetName:"auto",storyline:null,lockKind:null};
  function SC(){ return X.scene(); }
  function poses(){ return X.poses(); }

  /* ---- reserved shots: a reserved shot keeps its slot unless a higher one overlaps; a line shot trims itself after a crash shot instead of vanishing ---- */
  D.reserve=function(sh){
    sh.res=true; V.res=V.res.filter(function(o){ return o.t1>V.T-0.5; });
    var clash=V.res.filter(function(o){ return sh.t0<o.t1&&o.t0<sh.t1; });
    if(clash.some(function(o){ return (o.pri||0)>=(sh.pri||0); })){
      if(sh.kind!=="line") return;
      var last=0; clash.forEach(function(o){ last=Math.max(last,o.t1); }); if(last>sh.t1-1.9) return; sh.t0=last;
    } else clash.forEach(function(o){ if(o.kind==="line"&&o.t1>sh.t1+1.9) o.t0=sh.t1; else V.res.splice(V.res.indexOf(o),1); });
    V.res.push(sh); V.res.sort(function(a,b){ return a.t0-b.t0; });
  };
  D.reserveLine=function(k){ if(V.res.some(function(o){ return o.kind==="line"&&o.lapK===k; })) return; var te=X.lapEnd(k); D.reserve({kind:"line",t0:te-3.4,t1:te+1.8,pri:2,lapK:k}); };
  /* the events */
  D.onResult=function(i){   /* a lap's result is planned: i = {first, turnT, turn1, pass, crashT, crashFocus, crashKind, hold:{s}, Tb, Tend, k} */
    if(i.first){ D.reserve({kind:"gate",t0:-1.5,t1:Math.min(3.4,i.turnT-2.2),pri:6}); D.reserve({kind:"turn1",t0:i.turnT-2.2,t1:i.turnT+2.6,spot:i.turn1,holeshot:i.turnT+0.9,pri:6}); }
    if(i.crashT!=null) D.onCrash(i.crashT,i.crashFocus,i.crashKind);
    if(i.pass) D.reserve({kind:"battle",t0:i.pass.t0-0.9,t1:i.pass.t1+1.0,pair:[i.pass.w,i.pass.p],pri:3});
    if(i.hold){ var ty=X.leadTimeAt(i.hold.s,i.Tb); if(ty<i.Tend-3) D.reserve({kind:"yellow",t0:ty-2.8,t1:ty+3.4,spot:mkSpot(i.hold.s,X.C().outdoor?20:14,X.C().outdoor?5.5:5.2),pri:4}); }
    D.reserveLine(i.k);
  };
  D.onCrash=function(crashT,focus,kind){ D.reserve({kind:"crash",t0:crashT-1.7,t1:crashT+(kind==="out"?7.8:6.8),focus:focus,pri:5}); };
  D.story=function(s){ D.storyline=s||null; };
  D.preset=function(name){
    D.presetName=name||"auto"; D.lockKind=LOCKABLE[name]?name:null;
    V.res=D.lockKind?V.res.filter(function(o){ return o.kind==="crash"; }):V.res; V.shot=null;   /* a lock keeps only the crash shot: the person asked for this camera */
  };

  /* ---- the current shot ---- */
  function setShot(sh){
    V.shot=sh; if(!sh) return;
    sh.el=0; if(sh.res) sh.d=Math.max(0.4,sh.t1-V.T);
    CAM.se=null; CAM.st=null; V.lastShotKind=sh.kind; V.cuts=(V.cuts|0)+1; if(X.cut) X.cut();
    if(sh.kind==="crash"&&sh.focus>=0){ var r=V.by[sh.focus]; if(r&&r.crash) sh.spot=crashSpot(r); }
    V.hist=(V.hist||[]).concat([[sh.kind,+V.T.toFixed(1)]]).slice(-40);
  }
  D.setShot=setShot;
  /* the crash camera: abreast of where the bike and the rider come to rest (0.6 v on), 9 m out on the side without a berm in the way, 4.6 m up
     so the whole tumble is in view */
  function crashSpot(r){ var C=V.C, d=((r.crash.D%C.L)+C.L)%C.L, s=d+0.6*r.crash.v, p=X.placeSpot(C,SC(),s,9,Math.round(d/C.DS)%C.N), j=p.i;
    return {x:p.x,y:(C.outdoor?Math.max(C.E[j]+C.F[j],p.land)+6.2:Math.max(0,C.F[j]*0.6)+5.2)+p.lift,z:p.z}; }
  function mkSpot(s,dist,h){ var C=V.C, p=X.placeSpot(C,SC(),s,dist); return {s:s,x:p.x,y:p.land+h+p.lift,z:p.z,side:p.side}; }
  function meSeat(){ var m=-1; V.riders.forEach(function(r){ if(r.me&&!r.out&&!r.park&&!(r.crash&&r.crash.kind==="out")) m=r.s; }); return m; }
  D.meSeat=meSeat;
  function closePair(){
    var rid=poses().filter(function(p){ return !p.parked&&!p.crash; }).sort(function(a,b){ return b.D-a.D; }), best=null, bd=1e9, you=meSeat();
    for(var i=0;i<rid.length-1&&i<14;i++){ var d=rid[i].D-rid[i+1].D; if(d<5.5){ var sc=d-(rid[i].r.s===you||rid[i+1].r.s===you?4:0)+i*0.15; if(sc<bd){ bd=sc; best=[rid[i+1].r.s,rid[i].r.s]; } } }
    return best;
  }
  function pickFiller(d){
    var S=SC(), T=V.T, opts=[], last=V.lastShotKind, sp=null, best=1e9;
    S.secs.concat(S.turns).forEach(function(x){ var dt=X.leadTimeAt(x.s,T)-T; if(dt>0.9&&dt<Math.min(d,6.5)-0.7&&dt<best){ best=dt; sp=x; } });
    if(sp&&last!=="side") opts.push({kind:"side",spot:sp,d:Math.min(d,best+2.2),w:3.2});
    var pair=closePair(); if(pair&&last!=="battle") opts.push({kind:"battle",pair:pair,d:Math.min(d,4.6),w:2.4});
    var you=meSeat(); opts.push({kind:"chase",focus:(you>=0&&Math.random()<0.45)?you:-1,d:Math.min(d,5.2),w:last==="chase"?0.5:2});
    var ws=null; S.secs.forEach(function(x){ var dt=X.leadTimeAt(x.s,T)-T; if(dt>0.4&&dt<4) ws=x; }); if(ws&&last!=="wide") opts.push({kind:"wide",spot:ws,d:Math.min(d,4.6),w:1.6});
    if(last!=="stands"&&(V.rot%5===4)) opts.push({kind:"stands",d:Math.min(d,5.4),w:2.2});
    if(last!=="heli"&&(V.rot%6===5)) opts.push({kind:"heli",d:Math.min(d,4.2),w:1.2});
    V.rot++;
    var tot=0; opts.forEach(function(o){ tot+=o.w; }); var r=Math.random()*tot;
    for(var i=0;i<opts.length;i++){ r-=opts[i].w; if(r<=0) return opts[i]; } return opts[0];
  }
  D.direct=function(){
    var T=V.T, sh=V.shot, i;
    if(V.phase==="pre"){ if(!sh||(sh.kind!=="gate"&&sh.el>=sh.d)) setShot({kind:"gate",d:1e9}); return; }
    if(D.lockKind){   /* a camera the person picked: it stays (a crash still cuts in) */
      var cr=null; for(i=0;i<V.res.length;i++){ var oc=V.res[i]; if(oc.kind==="crash"&&oc.t0<=T+0.02&&oc.t1>T){ cr=oc; break; } }
      if(cr){ if(sh!==cr) setShot(cr); return; }
      if(!sh||sh.res||sh.kind!==D.lockKind||sh.lock!==D.presetName){ var you=meSeat(); setShot({kind:D.lockKind,d:1e9,lock:D.presetName,focus:D.lockKind==="onboard"||D.lockKind==="chase"?you:-1,spot:D.lockKind==="side"||D.lockKind==="wide"?SC().secs[0]:null}); }
      return;
    }
    var R0=null; for(i=0;i<V.res.length;i++){ var o=V.res[i]; if(o.t0<=T+0.02&&o.t1>T){ R0=o; break; } }
    if(R0){ if(sh!==R0) setShot(R0); return; }
    if(sh&&sh.res&&T>=sh.t1) sh=null;
    var next=null; for(i=0;i<V.res.length;i++){ if(V.res[i].t0>T){ next=V.res[i]; break; } }
    var room=next?next.t0-T:99;
    if(sh&&sh.el<sh.d) return;
    if(sh&&room<2.4){ sh.d=sh.el+room+0.02; return; }
    setShot(pickFiller(Math.min(room,4.2+Math.random()*2.6)));
  };
  D.debugShot=function(kind,o){ o=o||{}; V.res=[]; setShot({kind:kind,d:o.d||999,spot:o.spot||(kind==="side"||kind==="wide"?(SC().secs.filter(function(x){ return !o.type||x.F&&x.F.type===o.type; })[0]):null),focus:o.focus!=null?o.focus:-1,pair:o.pair}); };

  /* ---- the camera of the shot (fills CAM: eye, tgt, fov, close) ---- */
  function riderPos(s){ var P=poses(); for(var i=0;i<P.length;i++) if(P[i].r.s===s) return P[i]; return null; }
  D.riderPos=riderPos;
  function nearest(sp){ var b=null, bd=1e9; poses().forEach(function(p){ if(p.parked) return; var d=Math.hypot(p.x-sp.x,p.z-sp.z); if(d<bd){ bd=d; b=p; } }); return b; }
  /* the stands camera of a scene, once: on the long side of the floor, over the upper deck's front rows (the spectators' own eye line), looking
     across the dirt at the middle of the course; the lens fitted to the course so the whole of it is in frame */
  function standsCam(S,C){
    if(S.stands) return S.stands;
    var b=S.box, cx=(b.x0+b.x1)/2, cz=(b.z0+b.z1)/2, w=b.x1-b.x0, h=b.z1-b.z0, alongX=w>=h, e;
    if(C.outdoor){ var R=S.radius; e={x:cx+R*0.35,y:Math.max(30,R*0.42),z:cz+R*1.15,tx:cx,ty:C.E?4:0,tz:cz}; }
    else {
      var fl=S.floor||{x0:b.x0-14,x1:b.x1+14,z0:b.z0-14,z1:b.z1+14};
      e=alongX?{x:cx,y:25,z:fl.z1+29,tx:cx,ty:0,tz:cz-h*0.04}:{x:fl.x1+29,y:25,z:cz,tx:cx-w*0.04,ty:0,tz:cz};
    }
    var dist=Math.hypot(e.x-e.tx,e.y-e.ty,e.z-e.tz), span=Math.max(w,h);
    e.fov=clamp(2*Math.atan(span*0.56/dist),0.55,1.15);
    return (S.stands=e);
  }
  D.camera=function(dt){
    var C=V.C, S=SC(), sh=V.shot||{kind:"heli",el:0}, P=poses(), lead=riderPos(V.leadS)||P.filter(function(p){ return !p.parked; })[0], fov=0.9, close=false;
    var focus=sh.focus!=null&&sh.focus>=0?riderPos(sh.focus):null; if(!focus) focus=lead;
    var u=sh.el||0;
    switch(sh.kind){
      case "heli": { var a=0.35+u*0.08+(V.rot*0.7), R0=S.radius*1.25, cx=S.centre; EYE[0]=cx[0]+Math.cos(a)*R0; EYE[1]=(C.outdoor?S.radius*0.55:42)+cx[1]; EYE[2]=cx[2]+Math.sin(a)*R0; TGT[0]=cx[0]; TGT[1]=cx[1]; TGT[2]=cx[2]; fov=0.95; break; }
      case "stands": { var sc=standsCam(S,C); EYE[0]=sc.x; EYE[1]=sc.y; EYE[2]=sc.z; TGT[0]=sc.tx; TGT[1]=sc.ty; TGT[2]=sc.tz; fov=sc.fov;
        /* a slow drift along the stands (a hand-held broadcast camera is never dead still) */
        var dr=Math.sin(u*0.35)*0.5; EYE[0]+=dr*(C.outdoor?2:4); TGT[0]+=dr*1.5; break; }
      case "onboard": { var fo=focus; if(!fo) break;
        EYE[0]=fo.x-fo.tx*0.1; EYE[1]=fo.y+1.55; EYE[2]=fo.z-fo.tz*0.1; TGT[0]=fo.x+fo.tx*18; TGT[1]=fo.y+1.1; TGT[2]=fo.z+fo.tz*18; fov=1.3; close=true; break; }
      case "gate": { var G=S.gate, Tn=V.T; EYE[0]=G.x; EYE[1]=G.y; EYE[2]=G.z;
        var GG=X.gateF(C), gc=[GG.x-GG.tz*GG.off,GG.E+0.7,GG.z+GG.tx*GG.off];
        if(Tn>0.4&&lead){ var w2=sstep((Tn-0.4)/1.2); TGT[0]=lerp(gc[0],lead.x,w2); TGT[1]=lerp(gc[1],lead.y+0.6,w2); TGT[2]=lerp(gc[2],lead.z,w2); fov=lerp(0.5,0.42,w2); }
        else { TGT[0]=gc[0]; TGT[1]=gc[1]; TGT[2]=gc[2]; fov=0.5; } close=true; break; }
      case "chase": { var f=focus||lead; if(!f) break;
        /* THE COVER SHOT: 3.5 m behind and 1.5 m above the bike, a 70 degree lens, the heading eased so it doesn't whip round every turn,
           lifting over a rider in between; the track ahead in the middle of the frame */
        if(sh.hx==null||sh.f!==f.r.s){ sh.hx=f.tx; sh.hz=f.tz; sh.f=f.r.s; } else { var kh=1-Math.exp(-dt/0.5); sh.hx+=(f.tx-sh.hx)*kh; sh.hz+=(f.tz-sh.hz)*kh; }
        var hl=Math.hypot(sh.hx,sh.hz)||1, hx=sh.hx/hl, hz=sh.hz/hl, crowd=0;
        for(var pi=0;pi<P.length;pi++){ var pq=P[pi]; if(pq!==f&&!pq.parked&&pq.D<f.D-0.6&&pq.D>f.D-9) crowd=1; }
        if(sh.up==null) sh.up=crowd; else sh.up+=(crowd-sh.up)*(1-Math.exp(-dt/0.8));
        var por=V.H>V.W*1.05, back=(3.6+1.9*sh.up)*(por?1.1:1), upH=1.5+1.5*sh.up;
        var bD=f.D-back*1.05; if(f.r&&f.r.lat!=null&&bD>-C.Lc){ X.ridePose(bD,f.r.lat*0.7,CHP); var ex=CHP.x-f.x, ez=CHP.z-f.z, el=Math.hypot(ex,ez)||1; ex=ex/el*back; ez=ez/el*back; EYE[0]=f.x+ex; EYE[2]=f.z+ez; hx=-ex/back; hz=-ez/back; }
        else { EYE[0]=f.x-hx*back; EYE[2]=f.z-hz*back; }
        EYE[1]=Math.max(f.y+upH,(CHP.gl!=null?CHP.gl:0)+0.9); TGT[0]=f.x+hx*9; TGT[1]=f.y+0.85; TGT[2]=f.z+hz*9; fov=1.2; close=true;
        if(C.outdoor){ var gy=X.landAt(S,EYE[0],EYE[2])+1.0; if(EYE[1]<gy) EYE[1]=gy; } break; }
      case "side": case "turn1": case "yellow": { var sp=sh.spot||S.turn1, f2=sh.kind==="turn1"?lead:sh.kind==="yellow"?nearest(V.marshal||sp):(focus||lead); EYE[0]=sp.x; EYE[1]=sp.y; EYE[2]=sp.z;
        if(f2){ TGT[0]=f2.x+f2.tx*(f2.v||8)*0.12; TGT[1]=f2.y+0.8; TGT[2]=f2.z+f2.tz*(f2.v||8)*0.12;
          if(sh.kind==="yellow"&&V.marshal){ TGT[0]=lerp(TGT[0],V.marshal.x,0.45); TGT[1]=lerp(TGT[1],V.marshal.y+1.6,0.45); TGT[2]=lerp(TGT[2],V.marshal.z,0.45); }
          var dd=Math.hypot(TGT[0]-sp.x,TGT[2]-sp.z,TGT[1]-sp.y); fov=clamp(2*Math.atan((sh.kind==="yellow"?13:9)/Math.max(1,dd)),0.3,1.05); close=dd<34; } break; }
      case "wide": { var sp2=sh.spot||S.secs[0], f3=focus||lead; var F=sp2.F, s0=F?F.s0:sp2.s, i0=Math.round(s0/C.DS)%C.N, side=sp2.side||1, lat=side*(C.hw[i0]+(C.outdoor?32:20));
        EYE[0]=C.x[i0]-C.tz[i0]*lat-C.tx[i0]*12; EYE[2]=C.z[i0]+C.tx[i0]*lat-C.tz[i0]*12; EYE[1]=(C.outdoor?Math.max(C.E[i0],X.landAt(S,EYE[0],EYE[2])):0)+(C.outdoor?24:16);
        if(f3){ TGT[0]=f3.x; TGT[1]=f3.y; TGT[2]=f3.z; } fov=0.72; close=false; break; }
      case "battle": { var pr=sh.pair||[-1,-1], pa=riderPos(pr[0]), pb=riderPos(pr[1]); if(!pa||!pb){ pa=pb=focus||lead; } if(!pa) break; var mx=(pa.x+pb.x)/2, my=(pa.y+pb.y)/2, mz=(pa.z+pb.z)/2, tx=pa.tx, tz=pa.tz;
        var sd=sh.side||(sh.side=(X.sideClear(C,pa.D%C.L,1,9)>=X.sideClear(C,pa.D%C.L,-1,9)?1:-1)); EYE[0]=mx-tz*7.5*sd-tx*3; EYE[1]=my+1.9; EYE[2]=mz+tx*7.5*sd-tz*3; TGT[0]=mx+tx*1.5; TGT[1]=my+0.75; TGT[2]=mz+tz*1.5; fov=0.92; close=true;
        if(C.outdoor){ var gy2=X.landAt(S,EYE[0],EYE[2])+1.2; if(EYE[1]<gy2) EYE[1]=gy2; } break; }
      case "crash": { var sp3=sh.spot, f4=sh.focus>=0?riderPos(sh.focus):null; if(!sp3&&f4){ sp3={x:f4.x+8,y:f4.y+3.5,z:f4.z+8}; } if(!sp3) break; EYE[0]=sp3.x; EYE[1]=sp3.y; EYE[2]=sp3.z;
        /* frame the bike AND the thrown rider (their midpoint, wide enough for both) */
        if(f4){ var fg=f4.fig, mxx=fg?(f4.x+fg[0])/2:f4.x, myy=fg?(f4.y+fg[3])/2:f4.y, mzz=fg?(f4.z+fg[2])/2:f4.z, spread=fg?Math.hypot(fg[0]-f4.x,fg[2]-f4.z):0;
          TGT[0]=mxx; TGT[1]=myy+0.5; TGT[2]=mzz; var dd2=Math.hypot(mxx-sp3.x,mzz-sp3.z); fov=clamp(2*Math.atan((4.6+spread*0.55)/Math.max(1,dd2)),0.3,1.0); } close=true; break; }
      case "line": { var L=S.line, f5=lead, FG2=S.flagger, LA=S.lineAim, bx2=(LA[0]+FG2.x)/2, by2=(LA[1]+FG2.y+0.7)/2, bz2=(LA[2]+FG2.z)/2; EYE[0]=L.x; EYE[1]=L.y; EYE[2]=L.z;
        /* aim between the line and the flagger; the leader pulls the aim his way as he comes up to the line */
        if(f5){ var dl=Math.hypot(f5.x-LA[0],f5.z-LA[2]), w3=clamp(1-dl/45,0,1)*0.45; TGT[0]=lerp(bx2,f5.x,w3); TGT[1]=lerp(by2,f5.y+0.8,w3); TGT[2]=lerp(bz2,f5.z,w3); } else { TGT[0]=bx2; TGT[1]=by2; TGT[2]=bz2; }
        fov=0.64; close=true; break; }
    }
    /* a phone held upright shows more height: lift the camera and aim it lower so the track, not the roof, fills the frame */
    if(V.H>V.W*1.05&&sh.kind!=="heli"&&sh.kind!=="wide"&&sh.kind!=="stands"&&sh.kind!=="onboard"){ var up=sh.kind==="chase"?0.5:sh.kind==="gate"?1.4:1.2; EYE[1]+=up; TGT[1]-=(sh.kind==="chase"?0.2:0.45); }
    /* smoothing inside a shot (reset on every cut) */
    if(!CAM.se||!CAM.st){ CAM.se=EYE.slice(); CAM.st=TGT.slice(); CAM.fv=fov; V.cut=true; }
    else { var ke=1-Math.exp(-dt/(sh.kind==="onboard"?0.08:0.22)), kt=1-Math.exp(-dt/(sh.kind==="onboard"?0.06:0.12)); for(var i=0;i<3;i++){ CAM.se[i]+=(EYE[i]-CAM.se[i])*ke; CAM.st[i]+=(TGT[i]-CAM.st[i])*kt; } CAM.fv+=(fov-CAM.fv)*ke; }
    CAM.eye=CAM.se; CAM.tgt=CAM.st; CAM.fov=CAM.fv; CAM.close=close;
  };
  return D;
}
MX.Director3D={create:create,SHOTS:SHOTS};
})(typeof window!=="undefined"?window:globalThis);
