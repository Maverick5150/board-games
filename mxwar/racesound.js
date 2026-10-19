/* MOTOCROSS WAR — THE TV RACE SOUND (MXWar.RaceSound; SHOW-PLAN W11, MUSIC-PLAN 9 and 11.3). The CEO (2026-10-19): "as the dirt bikes are passing,
   you want to have that sound of the motor and just realistic sounds where the camera's close up, and then the kind of ambient sounds of all the
   bikes in the TV broadcasting, and when the announcers are talking, you kind of hear the ambient noise of all the bikes, the crowd. Any kind of
   crash or real close moment ... you can hear the crowd get roar." TV grammar: no music under live racing; engines, the crowd and the PA; the booth
   always on top.
   WHAT YOU HEAR
   - The camera's bike up front and the three nearest bikes (mxwar/audio/engine-worklet.js: real CC0 recorded engine sound in rpm bins, re-pitched
     to every bike's revs, Doppler and replay pitch, layered over a synthesized engine for the throttle chops, the four-stroke pops and the
     two-stroke ring-ding), from the 3D view's audio read V.audioFrame (distance, side, radial speed, speed, acceleration, air, landing, crash).
   - A close pass: a RECORDED CC0 pass-by (with its own Doppler and the dirt) started so its loudest moment meets the bike's closest approach to the
     lens, panned across with it, while that bike's synthesized voice steps back.
   - The pack: a recorded bed of many bikes whose level and brightness follow how many riders are near the camera (a close chase thins it, a
     broadcast wide over a bunched pack swells it).
   - The crowd: a recorded bed that breathes with the race (the excitement model, MUSIC-PLAN 9.4) and reacts (cheers, the roar, a gasp and the
     "ooooh", groans, applause) with the same sizes the booth's intensity model gives its calls, so a HUGE call always rides a big roar.
   - The start: the gate's rev chorus, the 30-second board's air horn, the hush at sideways, the pneumatic gate and the slam at the drop, the roar.
   - Era engines: two-strokes up to 2003, four-strokes from 2004 (2004-05 four-stroke unless a season lists twoStroke riders), by the season's
     year and class; a stadium (supercross, SMX) or outdoors (motocross).
   API (SHOW-PLAN 4.9, MUSIC-PLAN 11.3):
     var RS = MXWar.RaceSound.create({sound: window.Sound, era: {stroke, cc, venue} | MXWar.RaceSound.eraOf(season), tier: "firetv"|"phone"|"high",
                                       base: "mxwar/" (where audio/ is), voice: window.BGVoice, main: true (a Main / moto: the excitement baseline)});
     RS.load() -> Promise          the race core (manifest, decoded files) and the worklet: in the 3D warm hold, never in a live race
     RS.gate(stage)                "open" | "board" | "side" | "drop" (booth.gate's stage(name) callback, and its drop())
     RS.frame(snap)                10-20 Hz: V.audioFrame(out), or MXWar.RaceSound.feed2D(...) on Classic 2D
     RS.moment(kind, info)         "holeshot" | "lead" | "pass" | "youPass" | "crash" {s, kind: "remount"|"out", place, you} | "remount" | "war" {depth} |
                                   "battle" {place, you} | "photo" | "yellow" | "white" | "checkered" {main, you} | "lapped"; info.place / you / main / lap / len
     RS.replay(on, {slow})         a live replay: the replay's engines 7 semitones lower through a 3 kHz low-pass, more reverb, the live race at -10 dB
     RS.hold(on)                   the Menu: the race ducks 12 dB
     RS.line(on, lv)               a booth line starts / ends (lv 3 = HUGE); hooked to window.BGVoice automatically, call it yourself without one
     RS.stop() / RS.destroy()      the end of a race (a 1.2 s fade) / leaving
     RS.state()                    for tests: {E, voices, nodes, reactions, out, ...}
   Where the sound goes: W3's broadcast mixer (Sound.mix, profile "broadcast") when it is on: its "race" bus (ducking and the dialogue pocket are the
   mixer's); otherwise our own small chain on Sound's AudioContext (Sound.ctx(); a context of our own only when Sound has none): a 2.5 kHz pocket,
   a duck (-5 dB under a line, -3 dB under a HUGE one, from the voice's start / end), the Race sound volume (localStorage bg_vol_race, default 0.7)
   and a peak limiter. Never touches other games' sound. Every call is guarded: a failure means a silent race, never a broken game.
   Node: module.exports = MXWar.RaceSound (the pure parts: eraOf, Rev, Excite, assign, approach, feed2D, reactionFor). */
(function(g){
"use strict";
var MX=g.MXWar=g.MXWar||{};
if(MX.RaceSound) return;

var C_AIR=343;
function clamp(x,a,b){ return x<a?a:x>b?b:x; }
function dbl(d){ return Math.pow(10,d/20); }
function now(){ return (g.performance&&g.performance.now)?g.performance.now():Date.now(); }
function rngOf(seed){ var s=(seed>>>0)||1; return function(){ s=(Math.imul(s,1664525)+1013904223)>>>0; return s/4294967296; }; }

/* ======================= the era (MUSIC-PLAN 9.3) ======================= */
/* season {year, cls, series} (a season file, or G.season) -> {stroke, cc, venue}. Two-strokes 1972-2003, four-strokes from 2004 (2004-05: four-stroke
   by default; a season's optional twoStroke list is per rider and handled by the caller); the class sets the size; supercross and SMX run in a stadium */
function eraOf(s){
  s=s||{};
  var year=+s.year||2026, cls=String(s.cls||""), series=String(s.series||"sx").toLowerCase();
  var stroke=year<=2003?2:4, cc=450;
  var m=cls.match(/(\d{3})/); if(m) cc=+m[1];
  if(stroke===2){ if(cc!==125&&cc!==500) cc=250; }
  else { cc=/250F|Lites|250SX|250MX/i.test(cls)?250:450; }
  return {stroke:stroke,cc:cc,venue:series==="mx"?"outdoor":"stadium",year:year};
}

/* ======================= the rev model (MUSIC-PLAN 9.3) =======================
   One bike's engine from the view's motion, stepped at the frame rate: a five-speed gearbox (upshift at 94 % of a gear's top speed, the revs falling by
   the ratio, a 60 ms throttle cut), the throttle from the acceleration (off on the brakes), the revs flaring in the air (the rear wheel spins free),
   a dip and a thump on landing, a crash's scream to the limiter for 0.3 s then the engine dies (out) or idles on its side (down), the remount's start
   (a kick in the two-stroke eras). On the gate: the stage's revs with this bike's own throttle wiggle. */
var RATIO=[0.38,0.55,0.71,0.86,1.0];
function revOf(era){
  var two=era.stroke===2, cc=era.cc;
  if(two){ if(cc<=125) return {idle:2100,red:12800,gate:9800,vmax:27}; if(cc>=500) return {idle:1400,red:7900,gate:6200,vmax:33}; return {idle:1700,red:9900,gate:7600,vmax:31}; }
  if(cc<=250) return {idle:2000,red:13600,gate:10200,vmax:29}; return {idle:1700,red:11600,gate:8600,vmax:32};
}
function Rev(era,seed){
  this.R=revOf(era); this.two=era.stroke===2; this.vmax=this.R.vmax*(era.venue==="stadium"?0.86:1);
  this.g=0; this.rpm=this.R.idle; this.thr=0.1; this.cut=0; this.air=0; this.crash=0; this.ct=0; this.dead=false; this.kick=0; this.r=rngOf(seed||1);
  this.wf=0.5+this.r(); this.wp=this.r()*6.283; this.t=0;
}
/* dt (s), v (m/s), a (m/s^2), air (0|1), land (0..1), crash (0|1|2), gate: null | {stage, t} -> this.{rpm, thr} and the events: {shift, thump, died, start} */
Rev.prototype.step=function(dt,v,a,air,land,crash,gate){
  var R=this.R, ev={shift:false,thump:0,died:false,start:false};
  dt=clamp(dt||0.066,0.001,0.5); this.t+=dt;
  /* a crash: to the limiter for 0.3 s, then out (dies) or down (idles on its side) */
  if(crash){
    if(!this.crash){ this.crash=crash; this.ct=0; }
    this.ct+=dt;
    if(this.ct<0.32){ this.rpm=R.red; this.thr=1; }
    else if(crash===2||this.ct>2.4){ if(!this.dead){ this.dead=true; ev.died=true; } this.rpm=Math.max(0,this.rpm-R.red*dt*2.2); this.thr=0; }
    else { this.rpm+=(R.idle-this.rpm)*Math.min(1,dt*6); this.thr=0.04; }
    return ev;
  }
  if(this.crash){ this.crash=0; ev.start=true; this.kick=this.two?0.55:0.25; this.dead=false; this.g=0; this.rpm=R.idle; }   /* back on the bike: the start */
  if(this.kick>0){ this.kick-=dt; this.rpm+=(R.idle*1.9-this.rpm)*Math.min(1,dt*9); this.thr=0.35; return ev; }
  /* on the gate: the stage's revs, each bike's own wiggle */
  if(gate){
    var st=gate.stage, w=0.5+0.5*Math.sin(6.283*this.wf*this.t+this.wp)*Math.sin(6.283*0.37*this.t+this.wp*0.5), want, thr;
    if(st==="open"){ want=R.idle+(R.gate*0.55-R.idle)*w*w; thr=0.15+0.4*w*w; }
    else if(st==="board"){ want=R.gate*(0.72+0.3*w); thr=0.35+0.55*w; }
    else if(st==="side"){ want=R.gate*(0.97+0.04*w); thr=0.75+0.1*w; }
    else { want=R.red*0.96; thr=1; }   /* the drop: wide open, the clutch dumped */
    this.rpm+=(want-this.rpm)*Math.min(1,dt*(st==="drop"?14:8)); this.thr+=(thr-this.thr)*Math.min(1,dt*10);
    this.g=0; return ev;
  }
  var vm=this.vmax, top=RATIO[this.g]*vm;
  /* the gearbox */
  if(!air&&this.g<4&&v>top*0.94&&this.t-(this.lastShift||-9)>0.35){ this.g++; this.cut=0.06; this.lastShift=this.t; ev.shift=true; top=RATIO[this.g]*vm; }
  else if(!air&&this.g>0){ var lo=RATIO[this.g-1]*vm; if(v<lo*(a<-2?0.78:0.6)&&this.t-(this.lastShift||-9)>0.25){ this.g--; this.lastShift=this.t; top=RATIO[this.g]*vm; } }
  var rpm=R.red*clamp(v/top,0,1.02);
  if(this.g===0&&v<top*0.55) rpm=Math.max(rpm,R.idle+(R.red*0.62-R.idle)*clamp(this.thr*1.3,0,1));   /* first gear off the line: the clutch slips */
  rpm=Math.max(rpm,R.idle);
  /* the throttle: on with the acceleration, off on the brakes (smoothed); the shift's cut */
  var tw=a>0.35?clamp(0.6+a/7,0,1):a<-1.6?0.04:clamp(0.45+a/4,0.12,0.7);
  this.thr+=(tw-this.thr)*Math.min(1,dt*12);
  if(this.cut>0){ this.cut-=dt; this.thr=Math.min(this.thr,0.1); }
  /* in the air the rear wheel spins free: the revs flare (on the throttle) or fall (chopped); landing: a dip and a thump */
  if(air){ this.air+=dt; rpm=this.air<0.5?Math.min(R.red,Math.max(this.rpm,rpm)*(1+0.5*dt)):this.rpm*(1-0.35*dt); if(this.air>0.55) this.thr=Math.min(this.thr,0.25); }
  else { if(this.air>0) this.air=0; }
  if(land>0.05){ ev.thump=land; rpm*=1-0.08*land; }
  /* the revs move toward the target fast (a light flywheel), the limiter caps them */
  this.rpm+=(rpm-this.rpm)*Math.min(1,dt*(rpm>this.rpm?9:6));
  if(this.rpm>R.red) this.rpm=R.red;
  return ev;
};

/* ======================= the excitement model (MUSIC-PLAN 9.4) =======================
   E 0..1 at 10 Hz = baseline (0.2, +0.15 a Main or a moto, +0.1 the top three within a second, +0.25 the last lap, +0.1 the person in the top five)
   + impulses that fall back over about 2.5 s. The reaction sizes come from the booth's own intensity rules (MXWar.Intensity.evalEvent on
   MXWar.IntensityData: the same events, places, the person, the Main, the last lap), so the crowd and the booth agree. */
var IMP={holeshot:0.5,lead:0.6,pass:0.25,youPass:0.15,crash:0.45,out:0.5,war:0.3,checkered:0.8,photo:0.85,white:0.3,battle:0.18,yellow:0.05,remount:0.15,lapped:0,huge:0.35};
var EVMAP={holeshot:"holeshot",lead:"lead_change",pass:"track_pass",youPass:"you_up",war:"double_war",battle:"lead_battle",photo:"photo_finish",yellow:"yellow_flag",white:"white_flag",checkered:"checkered",lapped:"lapped"};
function flagsFor(kind,info){
  info=info||{}; var f={}, pl=+info.place||0;
  if(pl>0){ f.p1=pl<=1; f.p3=pl<=3; f.p5=pl<=5; f.p10=pl<=10; f.pback=pl>10; }
  if(kind==="holeshot"||kind==="lead"){ f.p1=f.p3=f.p5=f.p10=true; f.lead=kind==="lead"; }
  if(info.you) f.you=true;
  if(info.main) f.final=true;
  if(info.len>0&&info.lap>0){ var left=info.len-info.lap+1, late=clamp(Math.round(info.len*0.15),1,3); f.endgame=left<=late; f.lastlap=left<=1; f.early=info.lap<=2; }
  if(info.close) f.close=f.tight=true;
  if(info.again) f.again=true;
  if(kind==="youPass"){ if(pl>0&&pl<=3) f.podium=true; if(pl>0&&pl<=10) f.top10=true; }
  return f;
}
/* the size of the crowd's reaction to a moment: 0 none .. 3 the roar (the booth's level for that moment, before its HUGE budget) */
function reactionFor(kind,info){
  var D=MX.IntensityData, I=MX.Intensity, ev=EVMAP[kind];
  if(kind==="crash") ev=info&&info.kind==="out"?"crash_out":"crash_remount";
  if(kind==="war") ev=info&&info.depth>=3?"triple_war":"double_war";
  if(kind==="battle") ev=info&&info.lastlap?"last_lap_battle":info&&+info.place>1?"midpack_battle":"lead_battle";
  if(kind==="pass"&&info&&+info.place>0&&+info.place<=5) ev="pass_top";
  var lv=null;
  if(D&&D.events&&I&&I.evalEvent&&ev&&D.events[ev]){ try{ lv=I.evalEvent(D.events[ev],flagsFor(kind,info),null).E; }catch(e){ lv=null; } }
  if(lv==null){ var T={holeshot:2,lead:3,pass:1,youPass:1,crash:2,war:2,battle:1,photo:3,yellow:1,white:2,checkered:3,lapped:0,remount:1}; lv=T[kind]==null?1:T[kind];
    if(kind==="crash"&&info&&+info.place>0&&info.place<=3) lv=3; if(kind==="checkered"&&info&&!info.main&&!info.you) lv=2; }
  if(kind==="lapped") lv=0;
  return clamp(lv|0,0,3);
}
function Excite(o){ o=o||{}; this.main=!!o.main; this.imp=0; this.E=0.2; this.top3=false; this.last=false; this.youTop5=false; this.hold=0; this.t=0; }
Excite.prototype.base=function(){ return 0.2+(this.main?0.15:0)+(this.top3?0.1:0)+(this.last?0.25:0)+(this.youTop5?0.1:0); };
Excite.prototype.kick=function(x){ this.imp=Math.min(1.2,Math.max(this.imp,x)+x*0.25); };
Excite.prototype.step=function(dt){ this.t+=dt; this.imp*=Math.exp(-dt/2.5); this.E=clamp(this.base()+this.imp,0,1); return this.E; };

/* ======================= the voices: who the four engine voices follow =======================
   voice 0 = the hero (snap.hero, the camera's subject) when he is within 140 m; voices 1-3 = the nearest other riders within 110 m. A voice keeps its
   rider while he stays among the 4 nearest others (one place of hysteresis: no swapping back and forth); a freed voice takes the nearest rider
   without one. Returns [seat|-1 x4]. */
function assign(snap,cur){
  var R=snap&&snap.riders||[], n=snap&&snap.n!=null?snap.n:R.length, out=[-1,-1,-1,-1], i, j, by={}, order=[];
  for(i=0;i<n;i++){ var r=R[i]; if(!r||r.seat<0||r.crash===2&&r.d>40) continue; by[r.seat]=r; order.push(r); }
  order.sort(function(a,b){ return a.d-b.d; });
  var hero=snap&&snap.hero!=null&&by[snap.hero]&&by[snap.hero].d<140?snap.hero:(order.length&&order[0].d<140?order[0].seat:-1);
  out[0]=hero;
  var near5={}, k=0; for(i=0;i<order.length&&k<4;i++){ if(order[i].seat===hero) continue; near5[order[i].seat]=1; k++; }
  var used={}; used[hero]=1;
  for(j=1;j<4;j++){ var s=cur&&cur[j]; if(s!=null&&s>=0&&near5[s]&&!used[s]&&by[s].d<110){ out[j]=s; used[s]=1; } }
  for(j=1;j<4;j++){ if(out[j]>=0) continue; for(i=0;i<order.length;i++){ var q=order[i]; if(used[q.seat]||q.d>=110) continue; out[j]=q.seat; used[q.seat]=1; break; } }
  return out;
}
/* the closest approach of a rider to the lens from one read: straight-line motion at speed v with radial speed vr (negative = coming closer):
   t (s from now) = -vr d / v^2, b (m, the miss distance) = d sqrt(1 - (vr / v)^2) */
function approach(r){
  var v=Math.max(0.5,+r.v||0), vr=+r.vr||0, d=+r.d||0, q=clamp(vr/v,-1,1);
  return {t:-vr*d/(v*v),b:d*Math.sqrt(Math.max(0,1-q*q))};
}

/* ======================= the 2D feed (Classic 2D, no WebGL2: MUSIC-PLAN 9.6) =======================
   No camera and no Doppler: the hero is the person's rider (else the leader) at a fixed 9 m, his speed from the time model's progress (lap length x
   d(progress)/dt), the riders within 0.05 lap of him as the near bikes (distance from the progress gap), the pack's level from how bunched the field is.
   feed2D(G, tMs, out, {hero: seat, lapM: metres}) fills out in the V.audioFrame shape (allocation-free after the first call). */
var W2D=null;
function feed2D(G,t,out,o){
  o=o||{}; out=out||{};
  if(!out.riders){ out.riders=[]; for(var i=0;i<8;i++) out.riders.push({seat:-1,d:0,az:0,vr:0,v:0,a:0,air:0,land:0,crash:0}); out.cam={x:0,y:0,z:0,fx:0,fz:1}; }
  var T=MX.Time, tm=G&&G.tm; out.t=(t||0)/1000; out.n=0;
  if(!T||!tm||!T.walker){ out.mode="gate"; out.hero=-1; return out; }
  if(!W2D||W2D.G!==G){ W2D={G:G,w:T.walker(G),pr:{},v:{},t:-1}; }
  var w=W2D.w, n=G.n||(tm.r?tm.r.length:0), lapM=+o.lapM>0?o.lapM:(tm.p>0?tm.p*14:700), dt=W2D.t>=0?(t-W2D.t)/1000:0;
  out.mode=t<=0?"gate":(tm.done&&tm.flag!=null&&t>=tm.flag?"fin":"run");
  var hero=o.hero!=null&&o.hero>=0?o.hero:-1, best=-1, bp=-1e9, pr=[], st=[];
  for(var s=0;s<n;s++){ var p=0, ss="run"; try{ p=w.at(s,t); ss=w.state; }catch(e){} pr[s]=p; st[s]=ss; if(ss==="run"&&p>bp){ bp=p; best=s; } }
  if(hero<0) hero=best; out.hero=hero;
  var hp=pr[hero]||0, k=0, spread=0, cnt=0;
  for(s=0;s<n&&k<8;s++){
    var gap=(pr[s]-hp)*lapM, sp=0;
    if(dt>0&&W2D.pr[s]!=null){ sp=clamp((pr[s]-W2D.pr[s])*lapM/dt,0,40); }
    var a=dt>0&&W2D.v[s]!=null?clamp((sp-W2D.v[s])/Math.max(dt,0.05),-12,12):0;
    if(Math.abs(pr[s]-bp)<0.06&&st[s]==="run"){ spread+=Math.abs(pr[s]-bp); cnt++; }
    if(s===hero||Math.abs(gap)<lapM*0.05){
      var R=out.riders[k++]; R.seat=s; R.d=s===hero?9:Math.max(4,Math.abs(gap)+3); R.az=s===hero?0:clamp(gap/40,-0.8,0.8); R.vr=0; R.v=sp; R.a=a; R.air=0; R.land=0;
      R.crash=st[s]==="down"?1:st[s]==="out"?2:0;
    }
    W2D.pr[s]=pr[s]; W2D.v[s]=sp;
  }
  out.n=k; out.bunch=cnt>1?clamp(1-spread/cnt/0.03,0,1):0;   /* (bunch: how close the leading group runs, 0..1: the pack bed's level on Classic 2D) */
  W2D.t=t;
  return out;
}

/* ======================= the race core: the manifest's names (mxwar/audio/race/race.json) ======================= */
function urlJoin(a,b){ return a.replace(/\/?$/,"/")+b; }

/* ======================= create ======================= */
var LIVE=[];   /* the race sounds alive on this page (the voice's start / end hooks reach them all) */
var hooked=false;
function hookVoice(V){
  if(hooked||!V||typeof V.onStart!=="function") return; hooked=true;
  try{
    V.onStart(function(it){ var lv=it&&it.tier?(+String(it.tier).slice(1)||0):(it&&it.line&&it.line.lv)|0; for(var i=0;i<LIVE.length;i++) try{ LIVE[i].line(true,lv); }catch(e){} });
    V.onEnd(function(){ for(var i=0;i<LIVE.length;i++) try{ LIVE[i].line(false); }catch(e){} });
  }catch(e){}
}

function create(o){
  o=o||{};
  var S=o.sound||g.Sound||null, era=o.era&&o.era.stroke?o.era:eraOf(o.era||o.season||{}), tier=o.tier||"high";
  var base=o.base||(function(){ try{ var c=g.document&&g.document.currentScript; if(c&&c.src) return c.src.replace(/[^\/]*$/,""); }catch(e){} return "./"; })();
  var low=!!(o.low||(g.navigator&&g.navigator.deviceMemory&&g.navigator.deviceMemory<=1));
  var RS={}, ctx=null, own=null, G=null, core=null, loadP=null, dead=false, held=false, inReplay=false, lineOn=false, lineLv=0, lineEnd=0;
  var seed=(o.seed>>>0)||((Date.now()&0xffff)+1), rnd=rngOf(seed);
  var EX=new Excite({main:o.main!==false}), revs={}, cur=[-1,-1,-1,-1], gateSt=null, lastSnapT=-1, lastWall=0, frames=0, lastE=0;
  var passes=[], recent={}, lastReact=-1e9, reacts=[], pendingFollow=[], nodes={n:0,max:0}, stats={frames:0,ms:0,msMax:0}, downSeen={}, lastJumpOoh=-1e9, remountDue=[];
  var voiceState=[0,1,2,3].map(function(){ return {seat:-1,g:0,sw:0}; });
  var VREF=6, PANK=0.85;

  /* ---------- the output: W3's broadcast mixer when it is on, else our own chain ---------- */
  function mixerBus(){ try{ if(S&&S.mix&&typeof S.mix.get==="function"&&S.mix.get()==="broadcast"&&typeof S.mix.bus==="function") return S.mix.bus("race")||null; }catch(e){} return null; }
  function getCtx(){
    if(ctx) return ctx;
    try{ if(S&&typeof S.ctx==="function") ctx=S.ctx(); }catch(e){ ctx=null; }
    if(!ctx&&o.ctx) ctx=o.ctx;
    if(!ctx&&!(S&&typeof S.ctx==="function")){   /* a sound.js from before Sound.ctx (W3): a context of our own */
      var AC=g.AudioContext||g.webkitAudioContext; if(AC) try{ ctx=new AC(); RS._ownCtx=true; }catch(e){ ctx=null; }
    }
    return ctx;
  }
  /* the node count: every node with the window it is alive in (persistent ones until the end); the maximum overlap is the graph's size */
  var spans=[];
  function track(nd,t0,t1,w){ nodes.n++; if(nodes.n>nodes.max) nodes.max=nodes.n; spans.push([t0==null?(ctx?ctx.currentTime:0):t0,t1==null?1e9:t1,w||(t1==null?"base":"shot")]); if(spans.length>4000) spans.splice(0,1000); return nd; }
  function untrack(k){ nodes.n=Math.max(0,nodes.n-(k||1)); }
  function peakNodes(){ var ev=[]; spans.forEach(function(s){ ev.push([s[0],1]); ev.push([s[1],-1]); }); ev.sort(function(a,b){ return a[0]-b[0]||a[1]-b[1]; }); var c=0, m=0; ev.forEach(function(e){ c+=e[1]; if(c>m) m=c; }); return m; }
  function ownChain(C){
    /* the pocket (a -4 dB dip at 2.5 kHz while a line plays), the duck, the Race sound volume, a peak limiter (as W3's: -6 dBFS, knee 3, 20:1, 2 ms, 150 ms) */
    var pk=track(C.createBiquadFilter()); pk.type="peaking"; pk.frequency.value=2500; pk.Q.value=0.8; pk.gain.value=0;
    var dk=track(C.createGain()), vol=track(C.createGain()), lim=track(C.createDynamicsCompressor());
    try{ lim.threshold.value=-6; lim.knee.value=3; lim.ratio.value=20; lim.attack.value=0.002; lim.release.value=0.15; }catch(e){}
    pk.connect(dk); dk.connect(vol); vol.connect(lim); lim.connect(C.destination);
    var v=0.7; try{ var x=parseFloat(g.localStorage.getItem("bg_vol_race")); if(!isNaN(x)) v=clamp(x,0,1); }catch(e){}
    vol.gain.value=v>=0.7?v/0.7:Math.pow(v/0.7,10/(20*Math.log(2)/Math.LN10));   /* the same audio taper as W3's sliders (halving = -10 dB) */
    return {input:pk,pocket:pk,duck:dk,vol:vol,lim:lim};
  }
  function outNode(){
    var m=mixerBus();
    if(m){ if(own){ try{ G.out.disconnect(); }catch(e){} own=null; } return m; }
    if(!own) own=ownChain(ctx);
    return own.input;
  }
  var outTo=null;
  function route(){ if(!G) return; var t=outNode(); if(t===outTo) return; try{ G.out.disconnect(); }catch(e){} try{ G.out.connect(t); outTo=t; }catch(e){} }

  /* ---------- loading: the manifest, the files, the worklet ---------- */
  function fetchBuf(url){ return g.fetch(url).then(function(r){ if(!r.ok) throw new Error(url+" "+r.status); return r.arrayBuffer(); }).then(function(ab){ return new Promise(function(res,rej){ try{ var p=ctx.decodeAudioData(ab,res,rej); if(p&&p.then) p.then(res,rej); }catch(e){ rej(e); } }); }); }
  /* the decoder's delay (AAC priming) cancelled to the sample: every race file starts with 50 ms of digital silence and a 10 ms alignment mark (a 1 kHz
     burst from full height); the sound itself starts 50 ms after the mark's first sample over 0.25 (cutrace.js) */
  function onset(buf){ var d=buf.getChannelData(0), sr=buf.sampleRate, n=Math.min(d.length,Math.round(sr*0.6)); for(var i=0;i<n;i++) if(d[i]>0.25||d[i]<-0.25) return i+Math.round(sr*0.05); return Math.round(sr*0.1); }
  RS.load=function(){
    if(loadP) return loadP;
    if(!getCtx()) return Promise.resolve(false);
    var mf=null;
    loadP=g.fetch(urlJoin(base,"audio/race/race.json")).then(function(r){ if(!r.ok) throw new Error("race.json "+r.status); return r.json(); }).then(function(m){
      mf=m; var want=[], files=m.files||{};
      Object.keys(files).forEach(function(k){
        var f=files[k];
        if(f.stroke&&f.stroke!==era.stroke) return;               /* only this era's engines and pass-bys */
        if(f.venue&&f.venue!==era.venue) return;                   /* only this venue's beds */
        if(low&&f.kind==="bed"&&f.alt) return;
        want.push(k);
      });
      return Promise.all(want.map(function(k){ return fetchBuf(urlJoin(base,"audio/race/"+files[k].file)).then(function(b){ return [k,b]; },function(){ return [k,null]; }); }));
    }).then(function(list){
      core={m:mf,buf:{},on:{}}; list.forEach(function(x){ if(x[1]){ core.buf[x[0]]=x[1]; core.on[x[0]]=onset(x[1]); } });
      var aw=ctx.audioWorklet;
      if(!aw||typeof aw.addModule!=="function"||typeof g.AudioWorkletNode!=="function") return false;
      return aw.addModule(urlJoin(base,"audio/engine-worklet.js")).then(function(){ return true; },function(){ return false; });
    }).then(function(wk){ core=core||{m:null,buf:{},on:{}}; core.worklet=!!wk; build(); return true; })
    .catch(function(e){ try{ if(g.console&&g.console.warn) g.console.warn("RaceSound: ",e&&e.message); }catch(x){} core=core||{m:null,buf:{},on:{}}; try{ build(); }catch(x){} return false; });
    return loadP;
  };

  /* ---------- the graph ---------- */
  function bankFor(){
    if(!core||!core.m) return null;
    var key=era.stroke===2?"eng2s":"eng4s", b=core.buf[key], f=core.m.files&&core.m.files[key];
    if(!b||!f||!f.bins) return null;
    var d=b.getChannelData(0), off=core.on[key]||0, out=new Float32Array(Math.max(0,d.length-off)); out.set(d.subarray(off));
    return {data:out,bins:f.bins,sr:b.sampleRate};
  }
  function build(){
    if(G||dead||!ctx) return;
    var C=ctx, T=C.currentTime;
    G={};
    G.out=track(C.createGain()); G.out.gain.value=0;
    G.hold=track(C.createGain()); G.hold.connect(G.out);
    /* engines (+ the recorded pass-bys) -> the replay's low-pass -> the sum; beds (pack, crowd) -> their own gain (the replay drops it 10 dB) */
    G.eng=track(C.createGain()); G.eng.gain.value=dbl(o.engDb==null?-13:o.engDb);
    G.lp=track(C.createBiquadFilter()); G.lp.type="lowpass"; G.lp.frequency.value=20000; G.lp.Q.value=0.5;
    G.eng.connect(G.lp); G.lp.connect(G.hold);
    G.beds=track(C.createGain()); G.beds.connect(G.hold);
    G.sfx=G.hold; G.sfxK=dbl(-10);   /* (the PA's horns and pyro go straight into the sum at their own level: one node less) */
    /* the venue: a small feedback-delay room (stadium) for the engines and the reactions; outdoors drier */
    var stad=era.venue==="stadium";
    G.verb=track(C.createGain()); G.verb.gain.value=dbl(stad?-20:-30);
    var dl=[0.047,0.083], fb=[0.45,0.38];
    G.dly=dl.map(function(t,i){ var d=track(C.createDelay(0.2)), f=track(C.createGain()); d.delayTime.value=t*(stad?1.6:1); f.gain.value=fb[i]*(stad?1:0.6); G.verb.connect(d); d.connect(f); f.connect(d); d.connect(G.hold); return d; });
    G.lp.connect(G.verb);
    /* the engine worklet */
    var bank=bankFor();
    if(core&&core.worklet){
      try{
        G.wk=track(new g.AudioWorkletNode(C,"mx-engine",{numberOfInputs:0,numberOfOutputs:1,outputChannelCount:[2],
          processorOptions:{stroke:era.stroke,cc:era.cc,seed:seed,gate:tier==="firetv"?6:8,main:low?3:4,bank:bank}}));
        G.wk.connect(G.eng);
        G.P=function(n){ return G.wk.parameters.get(n); };
      }catch(e){ G.wk=null; }
    }
    if(!G.wk) fallbackVoice(C);
    /* the pack: a recorded bed of many bikes (this era's stroke when there is one) */
    var pk=core&&core.buf[era.stroke===2&&core.buf.pack2s?"pack2s":"pack"];
    G.packG=track(C.createGain()); G.packG.gain.value=0; G.packLP=track(C.createBiquadFilter()); G.packLP.type="lowpass"; G.packLP.frequency.value=3000; G.packLP.Q.value=0.4;
    G.packLP.connect(G.packG); G.packG.connect(G.beds);
    if(pk){ G.pack=track(C.createBufferSource()); G.pack.buffer=pk; G.pack.loop=true; loopPts(G.pack,era.stroke===2&&core.buf.pack2s?"pack2s":"pack"); G.pack.connect(G.packLP); G.pack.start(T,G.pack.loopStart+rnd()*(G.pack.loopEnd-G.pack.loopStart)*0.9); }
    /* the crowd: two copies of the bed at different offsets, a high shelf that brightens an excited crowd */
    G.crowdG=track(C.createGain()); G.crowdG.gain.value=0; G.shelf=track(C.createBiquadFilter()); G.shelf.type="highshelf"; G.shelf.frequency.value=3000; G.shelf.gain.value=0;
    G.shelf.connect(G.crowdG); G.crowdG.connect(G.beds);
    var cb=core&&(core.buf[stad?"crowd":"crowdOut"]||core.buf.crowd);
    G.crowd=[];
    if(cb){ for(var i=0;i<(low?1:2);i++){ var s=track(C.createBufferSource()); s.buffer=cb; s.loop=true; loopPts(s,core.buf[stad?"crowd":"crowdOut"]?(stad?"crowd":"crowdOut"):"crowd"); s.playbackRate.value=i?0.985:1; s.connect(G.shelf); s.start(T,s.loopStart+rnd()*(s.loopEnd-s.loopStart)*0.9); G.crowd.push(s); } }
    G.react=track(C.createGain()); G.react.gain.value=dbl(o.reactDb==null?-6:o.reactDb); G.react.connect(G.hold); G.react.connect(G.verb);
    G.rpan=[-0.35,0.35].map(function(p){ var pn=C.createStereoPanner?track(C.createStereoPanner()):track(C.createGain()); if(pn.pan) pn.pan.value=p; pn.connect(G.react); return pn; });
    G.rpan.splice(1,0,G.react);   /* left, centre (the bus itself), right */
    G.pass=track(C.createGain()); G.pass.gain.value=dbl(o.passDb==null?-9:o.passDb); G.pass.connect(G.eng);
    route();
    G.out.gain.setTargetAtTime(1,T,0.15);
    LIVE.push(RS); hookVoice(o.voice||g.BGVoice);
  }
  function loopPts(src,key){ var f=core.m&&core.m.files&&core.m.files[key], b=src.buffer, on=(core.on[key]||0)/b.sampleRate; if(f&&f.loop){ src.loopStart=on+f.loop[0]; src.loopEnd=on+f.loop[1]; } else { src.loopStart=on; src.loopEnd=b.duration; } }
  /* no AudioWorklet (a very old WebView): the hero only, an oscillator with a pulse-like wave through a waveshaper and two filters (MUSIC-PLAN 9.3) */
  function fallbackVoice(C){
    var os=track(C.createOscillator()), n=32, re=new Float32Array(n), im=new Float32Array(n);
    for(var k=1;k<n;k++){ re[k]=0; im[k]=(k%2?1:0.6)/Math.pow(k,0.9); }
    try{ os.setPeriodicWave(C.createPeriodicWave(re,im)); }catch(e){ os.type="sawtooth"; }
    var ws=track(C.createWaveShaper()), cv=new Float32Array(1024); for(var i=0;i<1024;i++){ var x=i/511.5-1; cv[i]=Math.tanh(2.2*x); } ws.curve=cv;
    var b1=track(C.createBiquadFilter()), b2=track(C.createBiquadFilter()), gn=track(C.createGain());
    b1.type="bandpass"; b1.frequency.value=era.stroke===2?1600:700; b1.Q.value=1.2; b2.type="lowpass"; b2.frequency.value=6000;
    gn.gain.value=0; os.connect(ws); ws.connect(b1); b1.connect(b2); b2.connect(gn); gn.connect(G.eng); os.start();
    G.fb={os:os,b1:b1,b2:b2,g:gn};
  }
  function set(p,v,T,tau){ if(!p) return; try{ p.setTargetAtTime(v,T,tau); }catch(e){} }
  function setNow(p,v,T){ if(!p) return; try{ p.cancelScheduledValues(T); p.setValueAtTime(v,T); }catch(e){} }

  /* ---------- the four engine voices ---------- */
  function voiceOut(i,seat,r,T,cut){
    var vs=voiceState[i];
    if(seat<0||!r){ if(G.P){ set(G.P("gain"+i),0,T,0.08); } else if(i===0&&G.fb) set(G.fb.g.gain,0,T,0.08); vs.seat=-1; return; }
    var rv=revs[seat], d=Math.max(1.6,+r.d||0), dop=clamp(C_AIR/(C_AIR+(+r.vr||0)),0.78,1.28);
    var gd=clamp(VREF/d,0,2.2), lp=clamp(19000/(1+d/40),1600,19000), load=0.55+0.45*rv.thr;
    var pb=1; for(var q=0;q<passes.length;q++) if(passes[q].seat===seat&&passes[q].end>T){ pb=0.18; break; }   /* a recorded pass-by is playing for him: his engine voice steps back */
    var gn=gd*load*pb*(r.crash?0.55:1)*(rv.dead?0:1);
    if(G.P){
      var tau=cut?0.012:0.045;
      if(vs.seat!==seat&&vs.seat>=0&&!cut){ /* a new rider on this voice: down in 30 ms, then the new bike */ setNow(G.P("gain"+i),0,T); set(G.P("rpm"+i),rv.rpm,T+0.03,0.005); set(G.P("dop"+i),dop,T+0.03,0.005); set(G.P("gain"+i),gn,T+0.035,0.06); }
      else { set(G.P("gain"+i),gn,T,tau); set(G.P("rpm"+i),rv.rpm,T,0.04); set(G.P("dop"+i),dop,T,0.05); }
      set(G.P("thr"+i),rv.thr,T,0.03); set(G.P("pan"+i),clamp((+r.az||0)*PANK,-1,1),T,0.06); set(G.P("lp"+i),lp,T,0.06);
    } else if(i===0&&G.fb){
      var f=(era.stroke===2?rv.rpm/60:rv.rpm/120)*dop; set(G.fb.os.frequency,f,T,0.04); set(G.fb.g.gain,gn*0.3,T,0.05); set(G.fb.b2.frequency,lp,T,0.06);
    }
    vs.seat=seat;
  }

  /* ---------- the recorded pass-bys: the clip's loudest moment meets the closest approach ---------- */
  function passPool(){ var m=core&&core.m, out=[]; if(!m||!m.files) return out; Object.keys(m.files).forEach(function(k){ var f=m.files[k]; if(f.kind==="pass"&&(!f.stroke||f.stroke===era.stroke)&&core.buf[k]) out.push(k); }); return out; }
  var PASS=null;
  function tryPass(r,T){
    if(inReplay||!G||!core) return;
    if(!PASS) PASS=passPool(); if(!PASS.length) return;
    var a=approach(r); if(a.t<0.25||a.t>2.4||a.b>7||(+r.v||0)<8) return;
    if(passes.some(function(p){ return p.seat===r.seat&&p.end>T-0.5; })) return;
    if(passes.filter(function(p){ return p.end>T; }).length>=2) return;
    var pick=null, tries=0;
    while(tries++<8){ var k=PASS[Math.floor(rnd()*PASS.length)]; if(!recent[k]||T-recent[k]>20){ pick=k; break; } }
    if(!pick) pick=PASS[Math.floor(rnd()*PASS.length)];
    var f=core.m.files[pick], b=core.buf[pick], on=(core.on[pick]||0)/b.sampleRate, peak=on+(f.peak||1), rate=clamp((+r.v||20)/(f.v||20),0.88,1.14);
    var lead=a.t, off=Math.max(on,peak-lead*rate), when=T+Math.max(0,lead-(peak-off)/rate);
    var lvl=clamp(3/Math.max(1.2,a.b),0.35,1.25)*dbl(f.gainDb||0), dur=Math.min((b.duration-off)/rate,6);
    var src=track(ctx.createBufferSource(),T,when+dur,"pass"), gn=track(ctx.createGain(),T,when+dur,"pass"), pn=ctx.createStereoPanner?track(ctx.createStereoPanner(),T,when+dur,"pass"):null;
    src.buffer=b; src.playbackRate.value=rate*(G.pitch||1);
    gn.gain.setValueAtTime(0,T); gn.gain.linearRampToValueAtTime(lvl,when+0.05); gn.gain.setValueAtTime(lvl,when+Math.max(0.1,dur-0.5)); gn.gain.linearRampToValueAtTime(0,when+dur);
    src.connect(gn);
    if(pn){ /* across the picture with him: from his side now to the other side after the closest approach */
      var s0=clamp((+r.az||0)*PANK,-1,1), side=s0>=0?1:-1; pn.pan.setValueAtTime(s0,T); pn.pan.linearRampToValueAtTime(0,when+(peak-off)/rate); pn.pan.linearRampToValueAtTime(-side*0.7,when+(peak-off)/rate+1.2);
      gn.connect(pn); pn.connect(G.pass); } else gn.connect(G.pass);
    src.start(when,off); src.stop(when+dur+0.05);
    var P={seat:r.seat,end:when+dur,k:pick,at:when+(peak-off)/rate,b:+a.b.toFixed(2)};
    passes.push(P); recent[pick]=T; RS._log.push(["pass",+T.toFixed(3),r.seat,pick,+P.at.toFixed(3),P.b]);
    src.onended=function(){ try{ src.disconnect(); gn.disconnect(); if(pn) pn.disconnect(); }catch(e){} untrack(pn?3:2); };
  }

  /* ---------- one-shots: the crowd's reactions, the PA, the landing thump, the kick start ---------- */
  var bags={};
  function poolOf(name){ var m=core&&core.m, p=m&&m.pools&&m.pools[name]; return (p||[]).filter(function(k){ return core.buf[k]; }); }
  function draw(name,T){
    var p=poolOf(name); if(!p.length) return null;
    var bag=bags[name]; if(!bag||!bag.length){ bag=bags[name]=p.slice(); for(var i=bag.length-1;i>0;i--){ var j=Math.floor(rnd()*(i+1)); var x=bag[i]; bag[i]=bag[j]; bag[j]=x; } }
    for(var k=0;k<bag.length;k++){ if(!recent[bag[k]]||T-recent[bag[k]]>60){ return bag.splice(k,1)[0]; } }   /* never the same clip within 60 s */
    return null;
  }
  function shot(key,T,o2){
    var b=core&&core.buf[key]; if(!b||!G) return null; o2=o2||{};
    var f=core.m.files[key]||{}, on=(core.on[key]||0)/b.sampleRate, dur=Math.min(b.duration-on,o2.max||30);
    var src=track(ctx.createBufferSource(),T,T+dur), gn=track(ctx.createGain(),T,T+dur), pn=null;
    src.buffer=b; if(o2.rate) src.playbackRate.value=o2.rate;
    var lvl=dbl((f.gainDb||0)+(o2.db||0));
    var dest=o2.to||(o2.pan!=null&&G.rpan?G.rpan[o2.pan<-0.15?0:o2.pan>0.15?2:1]:G.react);
    gn.gain.setValueAtTime(o2.fadeIn?0:lvl,T); if(o2.fadeIn) gn.gain.linearRampToValueAtTime(lvl,T+o2.fadeIn);
    if(o2.max&&o2.max<b.duration-on){ gn.gain.setValueAtTime(lvl,T+o2.max-0.6); gn.gain.linearRampToValueAtTime(0,T+o2.max); }
    src.connect(gn); gn.connect(dest);
    src.start(T,on); src.stop(T+dur+0.05); recent[key]=T;
    src.onended=function(){ try{ src.disconnect(); gn.disconnect(); if(pn) pn.disconnect(); }catch(e){} untrack(pn?3:2); };
    return {src:src,g:gn,end:T+dur};
  }
  /* the crowd's answer to a moment of size lv (0..3) */
  function react(kind,lv,T,info){
    if(!G||!core||lv<=0) return;
    if(T-lastReact<1.5&&!(info&&info.force)) return;
    var cap=lineOn?(lineLv>=3?-1:-3):0;   /* under a booth line the reaction gives way (the voice stays 10 LU over the race, 8 under a HUGE call) */
    var pool, db=0, pan=(rnd()-0.5)*0.6, k;
    if(kind==="crash"||kind==="out"){
      pool=lv>=3||kind==="out"?"ooh":"gasp"; k=draw(pool,T)||draw("gasp",T);
      if(k){ shot(k,T,{db:cap+(lv>=3?0:-3),pan:pan}); }
      pendingFollow.push({t:T+(kind==="out"?2.6:1.8),pool:kind==="out"?"murmur":"groan",db:cap-4});
    } else if(kind==="remount"){ pool="applause"; k=draw(pool,T); if(k) shot(k,T,{db:cap-4,pan:pan,max:5,fadeIn:0.25}); }
    else if(kind==="war"){ k=(lv>=2?draw("ooh",T):null)||draw("gasp",T); if(k) shot(k,T,{db:cap-5,pan:pan}); }
    else if(kind==="yellow"){ k=draw("murmur",T); if(k) shot(k,T,{db:cap-6,pan:pan,max:5,fadeIn:0.4}); }
    else if(kind==="landing"){ k=draw("ooh",T)||draw("cheerS",T); if(k) shot(k,T,{db:cap-8,pan:pan,max:3,fadeIn:0.05}); }
    else {
      pool=lv>=3?"roar":lv>=2?"cheerL":"cheerS"; k=draw(pool,T)||(lv>=2?draw(pool==="roar"?"cheerL":"roar",T)||draw("ooh",T):null)||draw("cheerS",T);
      if(k) shot(k,T,{db:cap+(lv>=3?0:lv>=2?-2:-6),pan:pan,max:lv>=3?9:6,fadeIn:0.08});
      if(lv>=3&&(kind==="lead"||kind==="checkered"||kind==="photo")) horns(T+0.25,kind==="checkered"?3:1);
      if(kind==="checkered"&&era.venue==="stadium") pyro(T+0.4);
    }
    lastReact=T; reacts.push([+T.toFixed(3),kind,lv,k||null]); RS._log.push(["react",+T.toFixed(3),kind,lv,k||null]);
  }
  /* the PA's air horn (synthesized: two detuned saws through a band-pass), n blasts */
  function horns(T,n){
    if(!G) return;
    for(var b=0;b<n;b++){
      var t0=T+b*0.62, len=b===n-1?0.95:0.42, gn=track(ctx.createGain(),t0,t0+len,"horn"), bp=track(ctx.createBiquadFilter(),t0,t0+len,"horn");
      bp.type="bandpass"; bp.frequency.value=620; bp.Q.value=1.1; var hl=0.16*G.sfxK; gn.gain.setValueAtTime(0,t0); gn.gain.linearRampToValueAtTime(hl,t0+0.03); gn.gain.setValueAtTime(hl,t0+len-0.08); gn.gain.linearRampToValueAtTime(0,t0+len);
      bp.connect(gn); gn.connect(G.sfx); gn.connect(G.verb);
      [349.2,352.4].forEach(function(f,k){ var os=track(ctx.createOscillator(),t0,t0+len,"horn"); os.type="sawtooth"; os.frequency.value=f; os.connect(bp); os.start(t0); os.stop(t0+len+0.02);
        os.onended=function(){ try{ os.disconnect(); }catch(e){} untrack(1); if(k===1){ try{ gn.disconnect(); bp.disconnect(); }catch(e){} untrack(2); } }; });
    }
  }
  /* a pyro boom (supercross): low noise thump with a sub */
  function noiseBuf(){ if(G.nb) return G.nb; var n=ctx.sampleRate, b=ctx.createBuffer(1,n,n), d=b.getChannelData(0), r=rngOf(seed^77); for(var i=0;i<n;i++) d[i]=r()*2-1; G.nb=b; return b; }
  function burst(T,len,lpF,lvl,to,pitchF){
    var s=track(ctx.createBufferSource(),T,T+len,"fx"), f=track(ctx.createBiquadFilter(),T,T+len,"fx"), gn=track(ctx.createGain(),T,T+len,"fx");
    if(!to||to===G.sfx) lvl*=G.sfxK; s.buffer=noiseBuf(); f.type="lowpass"; f.frequency.value=lpF; gn.gain.setValueAtTime(lvl,T); gn.gain.exponentialRampToValueAtTime(0.0005*G.sfxK,T+len);
    if(pitchF) { f.frequency.setValueAtTime(lpF,T); f.frequency.exponentialRampToValueAtTime(pitchF,T+len); }
    s.connect(f); f.connect(gn); gn.connect(to||G.sfx); s.start(T,rnd()*0.5); s.stop(T+len+0.05); s.onended=function(){ try{ s.disconnect(); f.disconnect(); gn.disconnect(); }catch(e){} untrack(3); };
  }
  function tone(T,f0,f1,len,lvl,to){ var os=track(ctx.createOscillator(),T,T+len,"fx"), gn=track(ctx.createGain(),T,T+len,"fx"); if(!to||to===G.sfx) lvl*=G.sfxK; os.frequency.setValueAtTime(f0,T); os.frequency.exponentialRampToValueAtTime(f1,T+len); gn.gain.setValueAtTime(lvl,T); gn.gain.exponentialRampToValueAtTime(Math.max(1e-5,lvl*0.001),T+len); os.connect(gn); gn.connect(to||G.sfx); os.start(T); os.stop(T+len+0.05); os.onended=function(){ try{ os.disconnect(); gn.disconnect(); }catch(e){} untrack(2); }; }
  function pyro(T){ if(!G) return; burst(T,1.1,900,0.5,G.sfx,90); tone(T,70,32,0.7,0.6); }
  /* the gate: the pneumatic release, then the pads slamming down (inharmonic metal), the thud */
  function gateSlam(T){
    if(!G) return;
    burst(T,0.14,3500,0.22,G.sfx);
    [310,820,1910].forEach(function(f,i){ tone(T+0.06,f,f*0.995,0.3-i*0.05,0.17/(i+1.1)); });
    tone(T+0.06,62,40,0.12,0.55);
  }
  function thump(T,x){ if(!G||x<0.15) return; tone(T,90,44,0.18,0.35*x,G.eng); burst(T,0.08,900,0.12*x,G.eng); }

  /* ---------- the gate stages ---------- */
  RS.gate=function(stage){
    if(dead) return; if(!G){ if(loadP) loadP.then(function(){ RS.gate(stage); }); return; }
    var T=ctx.currentTime; gateSt={stage:stage,t:T};
    var P=G.P;
    if(stage==="open"){ if(P){ set(P("gGain"),dbl(-6),T,0.8); set(P("gRev"),0.25,T,1.2); set(P("gWig"),1,T,0.2); } EX.kick(0.05); if(o.main!==false&&era.venue==="stadium") pyro(T+0.2); var kw=draw("whistle",T); if(kw) shot(kw,T+1.2,{db:-4,pan:-0.3}); }
    else if(stage==="board"){ if(P){ set(P("gRev"),0.75,T,0.6); set(P("gWig"),1,T,0.2); set(P("gGain"),dbl(-3),T,0.5); } horns(T+0.1,1); EX.kick(0.12); var kb=draw("cheerS",T); if(kb) shot(kb,T+0.9,{db:-6,pan:0.3}); }
    else if(stage==="side"){ if(P){ set(P("gRev"),1.0,T,0.4); set(P("gWig"),0.15,T,0.4); set(P("gGain"),dbl(-2),T,0.4); } RS._hush=T; var ks=draw("whistle",T); if(ks) shot(ks,T+0.4,{db:-8,pan:0.3}); }
    else if(stage==="drop"){
      gateSlam(T); if(P){ set(P("gRev"),1.2,T,0.08); set(P("gWig"),0,T,0.05); set(P("gGain"),dbl(-1),T,0.05); set(P("gRev"),0.9,T+1.6,0.8); set(P("gWig"),0.7,T+1.6,0.5); set(P("gLp"),3500,T+1.2,1.2); }
      G.farFrom=T+2.2;   /* (from here RS.frame sets the far pack's level) */
      EX.kick(0.55); react("drop",3,T+0.15,{force:true}); gateSt={stage:"drop",t:T,done:true};
      if(G.packG) set(G.packG.gain,dbl(-8),T+0.4,0.6);
    }
    RS._log.push(["gate",+T.toFixed(3),stage]);
  };

  /* ---------- one read of the picture (10-20 Hz) ---------- */
  var packLvl=0;
  RS.frame=function(snap){
    if(dead||!snap) return; if(!G){ if(!loadP) RS.load(); return; }
    var w0=now(), T=ctx.currentTime;
    var dt=lastSnapT>=0&&snap.t>lastSnapT&&snap.t-lastSnapT<0.5?snap.t-lastSnapT:(lastWall?clamp((w0-lastWall)/1000,0.02,0.2):0.066);
    lastSnapT=snap.t; lastWall=w0; frames++;
    if((frames&15)===0) route();   /* (the mixer turned on or off: follow it) */
    var R=snap.riders||[], n=snap.n!=null?snap.n:R.length, i, r, by={};
    var gateNow=snap.mode==="gate"&&gateSt&&!gateSt.done?gateSt:(snap.mode==="gate"&&!gateSt?{stage:"open"}:null);
    var dens=0, dmin=1e9;
    for(i=0;i<n;i++){ r=R[i]; if(!r||r.seat<0) continue; by[r.seat]=r;
      var rv=revs[r.seat]||(revs[r.seat]=new Rev(era,seed+r.seat*101));
      var e=rv.step(dt,+r.v||0,+r.a||0,r.air?1:0,+r.land||0,r.crash|0,gateNow);
      if(e.thump&&r.d<25) thump(T,e.thump*clamp(8/r.d,0,1));
      if(e.start&&r.d<40){ var kk=era.stroke===2||era.year<2010?"kick":"estart"; if(core&&core.buf[kk]) shot(kk,T,{db:-6+20*Math.log10(clamp(8/r.d,0.1,1)),pan:clamp(r.az*PANK,-1,1),to:G.eng}); }
      if(snap.mode!=="gate"&&!r.crash) dens+=1/(1+(r.d/28)*(r.d/28));
      if(r.d<dmin) dmin=r.d;
      if(snap.mode==="run"&&!r.crash) tryPass(r,T);
      /* a remount seen in the picture: the crowd applauds him back on the bike; a big landing near the lens: now and then an "ooh" */
      var was=downSeen[r.seat]; if(r.crash===1) downSeen[r.seat]=T; else if(was!=null&&!r.crash){ delete downSeen[r.seat]; if(T-was<15){ react("remount",1,T+0.2,{force:true}); for(var q2=remountDue.length-1;q2>=0;q2--) if(remountDue[q2].s===r.seat) remountDue.splice(q2,1); } }
      if(r.land>=0.8&&r.d<30&&T-lastJumpOoh>45&&rnd()<0.2){ lastJumpOoh=T; react("landing",1,T+0.1,{}); }
    }
    /* the four voices */
    var a=assign(snap,cur), cutCam=snap.cut===1;
    for(i=0;i<4;i++) voiceOut(i,a[i],a[i]>=0?by[a[i]]:null,T,cutCam);
    cur=a;
    /* the pack: level and brightness from how many riders are near the lens (a close chase thins it, a wide shot over a bunched pack swells it) */
    var dn=snap.bunch!=null?1+2.5*snap.bunch:dens;
    if(G.packG&&G.pack){
      var lvl=snap.mode==="gate"?0:snap.mode==="fin"?dbl(-14):dbl(-15+5.5*Math.log(1+dn)/Math.log(4));
      if(dmin<6) lvl*=0.7;   /* a bike right at the lens covers the pack */
      packLvl=lvl; set(G.packG.gain,lvl*(inReplay?dbl(-10):1)*(G.packK||1),T,0.35); set(G.packLP.frequency,clamp(1400+2600*Math.log(1+dn),1400,9000),T,0.4);
    }
    /* the far pack: the gate chorus's bikes, further off, in this season's engines: louder and brighter with more riders near the lens */
    if(G.P&&G.farFrom&&T>=G.farFrom&&snap.mode!=="gate"){
      var fl=snap.mode==="fin"?dbl(-16):dbl(-13+5*Math.log(1+dn)/Math.log(4))*(dmin<6?0.7:1)*(inReplay?dbl(-10):1);
      set(G.P("gGain"),fl,T,0.4); set(G.P("gLp"),clamp(1800+1800*Math.log(1+dn),1800,7000),T,0.5); set(G.P("gRev"),0.82+0.1*Math.sin(EX.t*0.21),T,1.2);
    }
    /* the crowd breathes with the race */
    stepCrowd(dt,T);
    for(i=remountDue.length-1;i>=0;i--){ var rd=remountDue[i]; if(T<rd.t) continue; if(rd.s!=null&&downSeen[rd.s]!=null&&T-rd.t<8) continue;   /* the picture shows him still down: the picture's own remount will be applauded */
      remountDue.splice(i,1); react("remount",1,T,{force:true}); }
    /* the moments' follow-ups (the groan after a gasp ...) */
    for(i=pendingFollow.length-1;i>=0;i--){ var fw=pendingFollow[i]; if(T>=fw.t){ pendingFollow.splice(i,1); var k2=draw(fw.pool,T); if(k2) shot(k2,T,{db:fw.db,pan:(rnd()-0.5)*0.5,max:5,fadeIn:0.2}); } }
    passes=passes.filter(function(p){ return p.end>T-1; });
    var ms=now()-w0; stats.frames++; stats.ms+=ms; if(ms>stats.msMax) stats.msMax=ms;
  };
  function stepCrowd(dt,T){
    if(!G.crowdG) return;
    var E=EX.step(dt), hush=RS._hush&&gateSt&&gateSt.stage==="side"?dbl(-6):1;
    var breathe=1+0.12*Math.sin(EX.t*0.9)+0.06*Math.sin(EX.t*0.37+1.3);
    var db=-21+12*E;   /* -21 dB calm .. -9 dB a roaring crowd (the bed is mastered at -16 LUFS; the race bus sets the rest) */
    if(lineOn) db=Math.min(db,lineLv>=3?-12:-14);
    set(G.crowdG.gain,dbl(db)*hush*breathe*(inReplay?dbl(-10):1),T,0.25); set(G.shelf.gain,6*E,T,0.3);
    lastE=E;
  }

  /* ---------- the moments ---------- */
  RS.moment=function(kind,info){
    if(dead) return; info=info||{};
    if(info.lastlap==null&&info.len>0&&info.lap>0) info.lastlap=info.len-info.lap+1<=1;
    if(kind==="white") EX.last=true;
    if(info.top3close!=null) EX.top3=!!info.top3close;
    if(info.youTop5!=null) EX.youTop5=!!info.youTop5;
    var lv=reactionFor(kind,info);
    var imp=kind==="crash"&&info.kind==="out"?IMP.out:IMP[kind]; if(imp) EX.kick(imp*(0.6+0.15*lv));
    if(!G) return;
    var T=ctx.currentTime+(info.delay||0);
    RS._log.push(["moment",+ctx.currentTime.toFixed(3),kind,lv,info.s==null?null:info.s]);
    if(kind==="battle"){ /* a battle swells the murmur: the bed rises with E; a cheer only if it is for the lead late on */ if(lv>=3) react("battle",2,T,info); return; }
    if(kind==="crash"){ react(info.kind==="out"?"out":"crash",Math.max(lv,info.place>0&&info.place<=10?2:1),T,{force:true}); if(info.kind!=="out") remountDue.push({t:T+6,s:info.s}); }
    else if(kind==="remount") react("remount",1,T,{force:true});
    else if(kind==="checkered"){ react("checkered",lv,T,{force:true}); }
    else react(kind,lv,T,info);
  };
  /* a booth line starts / ends: our own duck (no mixer) and the HUGE call's roar (the crowd and the booth agree: a HUGE line always rides a big reaction) */
  RS.line=function(on,lv){
    if(dead||!G) return;
    var T=ctx.currentTime; lv=lv|0;
    if(on){ lineOn=true; lineLv=lv; lineEnd=0;
      if(lv>=3&&!reacts.some(function(x){ return x[0]>T-1&&x[2]>=2&&x[3]; })){ react("huge",3,T+0.05,{force:true}); EX.kick(IMP.huge); }
    } else { lineOn=false; lineEnd=T; }
    if(own){ set(own.duck.gain,on?dbl(lv>=3?-3:-5):1,T,on?0.12:0.6); set(own.pocket.gain,on?-4:0,T,on?0.12:0.6); }
  };
  RS.replay=function(on,op){
    if(dead||!G) return; inReplay=!!on; var T=ctx.currentTime, p=on?(op&&op.slow===false?1:0.667):1;
    G.pitch=p; if(G.P) set(G.P("pitch"),p,T,0.12);
    set(G.lp.frequency,on?3000:20000,T,0.15); set(G.verb.gain,dbl(on?-8:(era.venue==="stadium"?-14:-24)),T,0.2);
    set(G.beds.gain,on?dbl(-10):1,T,0.25);
    RS._log.push(["replay",+T.toFixed(3),!!on]);
  };
  RS.hold=function(on){ if(dead||!G) return; held=!!on; set(G.hold.gain,on?dbl(-12):1,ctx.currentTime,0.15); };
  RS.stop=function(){
    if(dead||!G) return; var T=ctx.currentTime;
    set(G.out.gain,0,T,0.4);
    if(G.P) for(var i=0;i<4;i++) set(G.P("gain"+i),0,T+1.2,0.05);
    gateSt=null; passes=[]; RS._log.push(["stop",+T.toFixed(3)]);
  };
  RS.start=function(){ if(dead||!G) return; set(G.out.gain,1,ctx.currentTime,0.15); revs={}; cur=[-1,-1,-1,-1]; EX=new Excite({main:o.main!==false}); };
  RS.destroy=function(){
    if(dead) return; dead=true;
    var i=LIVE.indexOf(RS); if(i>=0) LIVE.splice(i,1);
    if(!G) return;
    try{ G.out.gain.setTargetAtTime(0,ctx.currentTime,0.05); }catch(e){}
    var g2=G; G=null;
    setTimeout(function(){
      try{ if(g2.wk){ try{ g2.wk.port.postMessage({t:"end"}); }catch(e){} g2.wk.disconnect(); } }catch(e){}
      ["pack"].forEach(function(k){ try{ g2[k]&&g2[k].stop(); }catch(e){} });
      (g2.crowd||[]).forEach(function(s){ try{ s.stop(); }catch(e){} });
      if(g2.fb) try{ g2.fb.os.stop(); }catch(e){}
      try{ g2.out.disconnect(); }catch(e){}
      if(own){ try{ own.lim.disconnect(); }catch(e){} own=null; }
      if(RS._ownCtx&&ctx&&ctx.close) try{ ctx.close(); }catch(e){}
    },250);
  };
  RS.state=function(){ return {era:era,tier:tier,low:low,E:+lastE.toFixed(3),voices:voiceState.map(function(v){ return v.seat; }),nodes:nodes.n,nodesMax:nodes.max,
    nodesPeak:peakNodes(),out:own?"own":(outTo?"mixer":"none"),worklet:!!(G&&G.wk),bank:!!(G&&G.wk&&core&&core.buf[era.stroke===2?"eng2s":"eng4s"]),passes:passes.length,reactions:reacts.slice(-12),frameMs:stats.frames?+(stats.ms/stats.frames).toFixed(4):0,frameMsMax:+stats.msMax.toFixed(3),
    loaded:!!core,files:core?Object.keys(core.buf).length:0}; };
  RS._log=[]; RS._spans=function(){ return spans; };
  RS._ctx=function(){ return ctx; };
  RS._G=function(){ return G; };
  return RS;
}

MX.RaceSound={create:create,eraOf:eraOf,feed2D:feed2D,Rev:Rev,Excite:Excite,assign:assign,approach:approach,reactionFor:reactionFor,revOf:revOf};
if(typeof module!=="undefined"&&module.exports) module.exports=MX.RaceSound;
})(typeof window!=="undefined"?window:globalThis);
