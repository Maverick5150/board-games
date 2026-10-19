/* MOTOCROSS WAR — the race's engines: ONE AudioWorkletProcessor, "mx-engine" (MUSIC-PLAN 9.3; SHOW-PLAN W11). mxwar/racesound.js
   (MXWar.RaceSound) loads it with audioWorklet.addModule and drives it; nothing else does. No recordings in here: every engine is
   synthesized, so its revs, throttle and Doppler follow the race exactly (the recorded pass-bys, the pack and the crowd are racesound.js's).
   - FOUR MAIN VOICES: 0 = the hero (the camera's bike, up front), 1-3 = the three nearest other bikes (fly-bys with Doppler). Each voice:
     firing pulses from a phase accumulator at the firing rate (rpm / 60 a two-stroke, rpm / 120 a four-stroke single) that vary from cycle
     to cycle; off the throttle a two-stroke skips fires ("four-stroking", the ring-ding) and a four-stroke pops now and then; at the rev
     limiter the ignition cuts; three exhaust resonators that follow the revs (a two-stroke's expansion chamber "comes on the pipe" at
     6,500-8,600 rpm for a 250: the scream); an intake rasp; a soft clip; then the distance (two low-passes), the gain and the pan.
     Doppler (the factor from racesound.js: 343 / (343 + radial speed)) scales the firing rate and every resonance.
   - THE GATE CHORUS: 8 bikes holding revs on the gate, each with its own throttle wiggle, spread across the stereo field: the pack's rev chorus
     before the drop; after it the same bikes, further off (gLp), are the far pack of the season's era (two-strokes in a 1990s season).
   - Every control is a k-rate AudioParam (sample-accurate in an OfflineAudioContext too; racesound.js smooths with setTargetAtTime).
   - THE RECORDED ENGINE (processorOptions.bank, from mxwar/audio/race: eng4s / eng2s): real CC0 onboard engine sound in rpm bins (each bin a
     seamless loop pitch-flattened to one firing frequency, BG_audit/sprint/mxshow/w11/tools/bank.js). A voice plays the two bins around its firing
     frequency, resampled to it x Doppler x pitch, crossfaded by log frequency, each bin keeping its own read position (no restart, no click). The
     recording carries the real timbre and the cycle-to-cycle life; the synthesized voice takes over as the throttle closes (the chops, the pops, the
     ring-ding) and is the whole sound when no bank is loaded.
     A second bank, bankOff (the same recordings' decel stretches: the revs falling, the burble and the pops), takes over as the throttle closes,
     with the synthesis only a light layer under it.
   processorOptions: {stroke: 2 | 4, cc: 125 | 250 | 450 | 500, seed, gate: 8 (the chorus size; 0..8), main: 4 (1..4), bank: {data, bins, sr} | null,
     bankOff: {data, bins, sr} | null}.
   Node (tests and the offline measurements): module.exports = {Engine, PARAMS, toneOf, eraRev}; Engine(o).render(L, R, n, P) renders n
   samples into L / R with P = {name: value} (the same names as the AudioParams). Silent voices cost nothing (skipped). */
(function(){
"use strict";
var SRATE=(typeof sampleRate==="number")?sampleRate:48000;
var MAIN=4, GATE=8;
/* the parameters: per main voice i: rpm, thr (0..1), gain (linear), pan (-1..1), dop (Doppler factor), lp (Hz); the chorus; pitch (a live replay: x0.667) */
var PARAMS=[];
(function(){
  for(var i=0;i<MAIN;i++){
    PARAMS.push({name:"rpm"+i,defaultValue:1800,minValue:0,maxValue:20000});
    PARAMS.push({name:"thr"+i,defaultValue:0,minValue:0,maxValue:1});
    PARAMS.push({name:"gain"+i,defaultValue:0,minValue:0,maxValue:8});
    PARAMS.push({name:"pan"+i,defaultValue:0,minValue:-1,maxValue:1});
    PARAMS.push({name:"dop"+i,defaultValue:1,minValue:0.5,maxValue:2});
    PARAMS.push({name:"lp"+i,defaultValue:16000,minValue:200,maxValue:20000});
  }
  PARAMS.push({name:"gGain",defaultValue:0,minValue:0,maxValue:8});   /* the gate chorus: its level, */
  PARAMS.push({name:"gRev",defaultValue:0,minValue:0,maxValue:1.2});  /* its revs (0 idle .. 1 held on the gate .. 1.2 wide open), */
  PARAMS.push({name:"gWig",defaultValue:1,minValue:0,maxValue:1});    /* how much each throttle wiggles (0 = every bike holds its revs: sideways) */
  PARAMS.push({name:"gLp",defaultValue:6500,minValue:300,maxValue:16000});   /* their distance (a low-pass): the far pack after the drop is the same bikes, further off */
  PARAMS.push({name:"pitch",defaultValue:1,minValue:0.25,maxValue:2});
  PARAMS.forEach(function(p){ p.automationRate="k-rate"; });
})();

/* the era's engine (MUSIC-PLAN 9.3): idle, the limiter, "on the pipe" (two-strokes), the gate's hold */
function eraRev(stroke,cc){
  if(stroke===2){
    if(cc<=125) return {idle:2100,red:12800,pipeLo:9000,pipeHi:11600,gate:9800};
    if(cc>=500) return {idle:1400,red:7900,pipeLo:4900,pipeHi:6800,gate:6200};
    return {idle:1700,red:9900,pipeLo:6500,pipeHi:8600,gate:7600};
  }
  if(cc<=250) return {idle:2000,red:13600,pipeLo:0,pipeHi:0,gate:10200};
  return {idle:1700,red:11600,pipeLo:0,pipeHi:0,gate:8600};
}
/* the voice's tone: the resonators (frequency at idle + a slope per rpm, Q, gain), the pulse length, the misfire and pop rules. Tuned against the
   CC0 recordings' measured spectra (BG_audit/sprint/mxshow/w11: the comparison is the measurement, nobody here can hear) */
function toneOf(stroke,cc){
  var k=stroke===2?(cc<=125?1.22:cc>=500?0.82:1):(cc<=250?1.14:1);
  /* (the numbers: tools/tune-synth.js, a search toward the CC0 recordings' cycle-to-cycle variation, pulse depth, brightness and spectrum; the plan's
     first values were 7.3 on its score, these 2.9 (four-stroke) and 4.9 (two-stroke); w11/work/tune-4.json, tune-2.json) */
  if(stroke===2) return {two:true,k:k,tau:0.78,body:[119*k,0,1.4,0.48],pipe:[643*k,0.04*k,1.5,0.58],ring:[3575*k,0,4,0.23],rasp:0.053,drive:0.9,driveT:1.97,noise:0.105,miss:0.35,pop:0,ampLo:0.65,ampSp:0.52,floor:0.003};
  return {two:false,k:k,tau:1.14,body:[115*k,0.004*k,2.2,1.56],pipe:[637*k,0.02*k,4.96,0.75],ring:[2697*k,0,4,0.2],rasp:0.02,drive:1.94,driveT:0.76,noise:0.19,miss:0,pop:0.06,ampLo:0.77,ampSp:0.92,floor:0.11};
}
function sstep(a,b,x){ var t=(x-a)/(b-a); t=t<0?0:t>1?1:t; return t*t*(3-2*t); }
/* a rational tanh (|x| < 3; outside, +-1): cheap and smooth */
function sat(x){ if(x>3) return 1; if(x<-3) return -1; var x2=x*x; return x*(27+x2)/(27+9*x2); }
function rng(seed){ var s=(seed>>>0)||1; return function(){ s=(Math.imul(s,1664525)+1013904223)>>>0; return s/4294967296; }; }

/* THE RECORDED ENGINE: the bins (ascending firing frequency) over one Float32Array; at = the bin's first sample, len = its loop length (fractional) */
function Bank(b){
  this.d=b.data; this.bins=[]; this.lf=[];
  var bs=(b.bins||[]).slice().sort(function(x,y){ return x.f0-y.f0; }), sc=(b.sr||48000)/SRATE;
  for(var i=0;i<bs.length;i++){ var x=bs[i]; if(!(x.f0>0&&x.len>8&&x.at>=0&&x.at+x.len+2<=this.d.length)) continue; this.bins.push({f0:x.f0*sc,at:x.at|0,len:x.len}); this.lf.push(Math.log(x.f0*sc)); }
  this.M=this.bins.length;
}
/* the two bins around firing frequency f: {a, b, wa, wb} (b = -1 above the last bin / below the first) */
Bank.prototype.pick=function(f,o){
  var lf=Math.log(Math.max(f,1)), M=this.M, L=this.lf, j=0;
  if(M===1||lf<=L[0]){ o.a=0; o.b=-1; o.wa=1; o.wb=0; return o; }
  if(lf>=L[M-1]){ o.a=M-1; o.b=-1; o.wa=1; o.wb=0; return o; }
  while(j<M-2&&lf>L[j+1]) j++;
  var u=(lf-L[j])/(L[j+1]-L[j]); u=u<0?0:u>1?1:u;
  o.a=j; o.b=j+1; o.wa=Math.cos(u*Math.PI/2); o.wb=Math.sin(u*Math.PI/2); return o;
};
/* ONE main voice's state */
function Voice(seed){ this.r=rng(seed); this.ph=this.r(); this.env=0; this.amp=0; this.dk=0.99; this.lp1=0; this.lp2=0;
  this.a1=0; this.b1=0; this.a2=0; this.b2=0; this.a3=0; this.b3=0; this.ha=0; this.hb=0; this.on=false; this.cut=0; this.pos=null; this.pk={a:0,b:-1,wa:1,wb:0}; this.ws=0; this.wy=1; }
function initPos(V,bank){ V.pos=new Float64Array(bank.M); for(var i=0;i<bank.M;i++) V.pos[i]=V.r()*bank.bins[i].len; }
/* ONE gate-chorus bike */
function GVoice(seed,i,n){ var r=rng(seed); this.r=r; this.ph=r(); this.env=0; this.amp=0; this.dk=0.99; this.a1=0; this.b1=0; this.a2=0; this.b2=0; this.lp=0; this.pos=null; this.pk={a:0,b:-1,wa:1,wb:0};
  this.base=r(); this.wf=0.45+0.9*r(); this.wp=r()*6.283; this.wf2=0.13+0.3*r(); this.wp2=r()*6.283; this.pan=n>1?-0.92+1.84*i/(n-1):0; this.det=0.985+0.03*r(); }

function Engine(o){
  o=o||{};
  this.sr=o.sampleRate||SRATE;
  this.stroke=o.stroke===2?2:4; this.cc=+o.cc||(this.stroke===2?250:450);
  this.rev=eraRev(this.stroke,this.cc); this.tone=toneOf(this.stroke,this.cc);
  var seed=(o.seed>>>0)||7919;
  this.nMain=Math.max(1,Math.min(MAIN,o.main==null?MAIN:o.main|0)); this.nGate=Math.max(0,Math.min(GATE,o.gate==null?GATE:o.gate|0));
  this.v=[]; for(var i=0;i<MAIN;i++) this.v.push(new Voice(seed*31+i*977+1));
  this.g=[]; for(var j=0;j<this.nGate;j++) this.g.push(new GVoice(seed*17+j*613+5,j,this.nGate));
  this.t=0;   /* the chorus's own clock (s) */
  this.nr=rng(seed^0x5bd1e995);
  this.bank=null; this.bankOff=null;
  if(o.bank&&o.bank.data&&o.bank.bins){ try{ var B=new Bank(o.bank); if(B.M>=2){ this.bank=B; for(var k=0;k<MAIN;k++) initPos(this.v[k],B); for(var q=0;q<this.g.length;q++) initPos(this.g[q],B); } }catch(e){ this.bank=null; } }
  if(this.bank&&o.bankOff&&o.bankOff.data&&o.bankOff.bins){ try{ var BO=new Bank(o.bankOff); if(BO.M>=2){ this.bankOff=BO; for(var k2=0;k2<MAIN;k2++){ var vv=this.v[k2]; vv.off={r:vv.r,pos:null,pk:{a:0,b:-1,wa:1,wb:0}}; initPos(vv.off,BO); } } }catch(e){ this.bankOff=null; } }
  /* the mix of the two: the recording on the throttle, the synthesis off it (o.mix: tests force 0 = synth only, 1 = recording only) */
  this.mix=o.mix==null?null:+o.mix;
  this.synthK=o.synthK==null?(this.stroke===2?1.0:0.37):+o.synthK;   /* the synth's level against the bank's (-20 dBFS RMS loops), measured: the four-stroke synth is 8.5 dB louder, the two-stroke level */
}
/* the recorded engine for one voice: n samples of the bins around firing frequency f (no Doppler) at playback factor D (Doppler x pitch), x amp, into Y */
Engine.prototype.sampled=function(V,Y,n,f,D,amp,BK){
  var B=BK||this.bank, pk=B.pick(f,V.pk), d=B.d, ba=B.bins[pk.a], ra=f*D/ba.f0, pa=V.pos[pk.a], la=ba.len, aa=ba.at, wa=pk.wa*amp;
  if(pk.b>=0&&pk.wb>1e-3){
    var bb=B.bins[pk.b], rb=f*D/bb.f0, pb=V.pos[pk.b], lb=bb.len, ab=bb.at, wb=pk.wb*amp;
    for(var i=0;i<n;i++){
      var ia=pa|0, fa=pa-ia, ib=pb|0, fb=pb-ib;
      Y[i]=wa*(d[aa+ia]+(d[aa+ia+1]-d[aa+ia])*fa)+wb*(d[ab+ib]+(d[ab+ib+1]-d[ab+ib])*fb);
      pa+=ra; if(pa>=la) pa-=la; pb+=rb; if(pb>=lb) pb-=lb;
    }
    V.pos[pk.b]=pb;
  } else {
    for(var j=0;j<n;j++){ var i2=pa|0, f2=pa-i2; Y[j]=wa*(d[aa+i2]+(d[aa+i2+1]-d[aa+i2])*f2); pa+=ra; if(pa>=la) pa-=la; }
  }
  V.pos[pk.a]=pa;
};
/* one main voice, n samples, added into L / R */
var YS=new Float32Array(128), YB=new Float32Array(128);
Engine.prototype.voice=function(V,L,R,n,rpm,thr,gain,pan,dop,lp,pitch){
  var sr=this.sr, T=this.tone, rv=this.rev, two=T.two;
  if(gain<=1e-5){ V.on=false; return; }   /* a silent voice costs nothing (its state waits) */
  V.on=true;
  if(rpm<1) rpm=1;
  if(YS.length<n){ YS=new Float32Array(n); YB=new Float32Array(n); }
  /* the weights: the recording while the throttle is open (its loudness rising with the revs and the load), the synthesis as it closes */
  var ws=0, wy=1;
  var on=1, wo=0;
  if(this.bank){ on=sstep(0.06,0.42,thr); ws=this.mix==null?(0.12+0.88*on):this.mix; wy=this.mix==null?(1-on):(1-this.mix); }   /* (on the throttle the recording alone: by measurement the closest to the real engines) */
  if(this.bankOff&&this.mix==null){ wo=(1-on)*0.9; ws=on; wy=(1-on)*0.35; }   /* off the throttle: the recorded decel (the burble, the pops), the synthesis a light layer */
  var fRpm=two?rpm/60:rpm/120, ampB=ws*(0.3+0.7*Math.pow(thr,0.8))*(0.55+0.45*Math.min(1,rpm/rv.red));
  if(ws>1e-3) this.sampled(V,YB,n,fRpm,dop*pitch,ampB*2.4); else for(var z=0;z<n;z++) YB[z]=0;
  if(wo>1e-3){ this.sampled(V.off,YS,n,fRpm,dop*pitch,wo*0.4*(0.55+0.45*Math.min(1,rpm/rv.red))*2.4,this.bankOff); for(var z2=0;z2<n;z2++) YB[z2]+=YS[z2]; }
  wy*=this.bank?this.synthK:1;
  var al=1-Math.exp(-2*Math.PI*Math.min(lp,sr*0.45)/sr), gl=gain*Math.cos((pan+1)*Math.PI/4), gr=gain*Math.sin((pan+1)*Math.PI/4);
  if(wy<1e-3){   /* the recording only: the distance and the pan */
    var m1=V.lp1, m2=V.lp2;
    for(var q=0;q<n;q++){ m1+=al*(YB[q]-m1); m2+=al*(m1-m2); L[q]+=m2*gl; R[q]+=m2*gr; }
    V.lp1=m1; V.lp2=m2; return;
  }
  var fire=(two?rpm/60:rpm/120)*dop*pitch, inc=fire/sr, D=dop*pitch;
  V.dk=Math.exp(-1/(Math.max(1e-4,T.tau/Math.max(fire,1))*sr));
  /* the resonators follow the revs (and the Doppler shift, and a replay's pitch) */
  var pb=two?sstep(rv.pipeLo,rv.pipeHi,rpm)*(1-sstep(rv.red*0.97,rv.red*1.04,rpm)):0;
  var f1=(T.body[0]+T.body[1]*rpm)*D, f2=two?(T.pipe[0]+1300*T.k*pb+T.pipe[1]*rpm)*D:(T.pipe[0]+T.pipe[1]*rpm)*D, f3=T.ring[0]*D;
  var lim=sr/6, F1=2*Math.sin(Math.PI*Math.min(f1,lim)/sr), F2=2*Math.sin(Math.PI*Math.min(f2,lim)/sr), F3=2*Math.sin(Math.PI*Math.min(f3,lim)/sr), FH=2*Math.sin(Math.PI*Math.min(5200*D,lim)/sr);
  var Q1=1/T.body[2], Q2=1/(two?T.pipe[2]+6*pb:T.pipe[2]), Q3=1/(two?T.ring[2]+10*(1-thr):T.ring[2]), QH=1/1.2;
  var g1=T.body[3], g2=two?T.pipe[3]*(1+0.9*pb):T.pipe[3], g3=two?T.ring[3]+0.5*(1-thr):T.ring[3];
  var drv=T.drive+T.driveT*thr, rasp=T.rasp*thr, nz=T.noise;
  var atLim=rpm>=rv.red*0.985&&thr>0.5, r=V.r;
  var ph=V.ph, env=V.env, dk=V.dk, a1=V.a1, b1=V.b1, a2=V.a2, b2=V.b2, a3=V.a3, b3=V.b3, ha=V.ha, hb=V.hb, l1=V.lp1, l2=V.lp2;
  var thrP=0.25+0.75*Math.pow(thr,0.7);
  for(var i=0;i<n;i++){
    ph+=inc;
    if(ph>=1){ ph-=1;
      /* combustion varies cycle to cycle; a two-stroke off the throttle skips fires; a four-stroke off it pops; the limiter cuts the ignition */
      var miss=(two&&thr<0.12&&r()<T.miss)||(atLim&&r()<0.45);
      var amp=miss?0.08:(T.ampLo+T.ampSp*r())*thrP;
      if(!two&&thr<0.1&&r()<T.pop) amp=1.4;
      env=amp; }
    else env*=dk;
    var w=r()*2-1, x=env*(1+nz*w)+T.floor*thrP*w+1e-18;
    /* the exhaust: three state-variable band-passes */
    var h1=x-a1-Q1*b1; b1+=F1*h1; a1+=F1*b1;
    var h2=x-a2-Q2*b2; b2+=F2*h2; a2+=F2*b2;
    var h3=x-a3-Q3*b3; b3+=F3*h3; a3+=F3*b3;
    var y=g1*b1+g2*b2+g3*b3;
    if(rasp>0){ var hh=w*env-ha-QH*hb; hb+=FH*hh; ha+=FH*hb; y+=rasp*hb; }
    y=wy*sat(drv*y)+YB[i];
    l1+=al*(y-l1); l2+=al*(l1-l2);
    L[i]+=l2*gl; R[i]+=l2*gr;
  }
  V.ph=ph; V.env=env; V.a1=a1; V.b1=b1; V.a2=a2; V.b2=b2; V.a3=a3; V.b3=b3; V.ha=ha; V.hb=hb; V.lp1=l1; V.lp2=l2;
};
/* the gate chorus, n samples: every bike's revs = its own base + the held level + its throttle wiggle */
Engine.prototype.chorus=function(L,R,n,gain,rev,wig,pitch,glp){
  var N=this.g.length; if(!N) return;
  if(gain<=1e-5){ this.t+=n/this.sr; return; }
  var sr=this.sr, rv=this.rev, two=this.stroke===2, T=this.tone, gv=gain/Math.sqrt(N), t=this.t, lim=sr/6;
  for(var j=0;j<N;j++){
    var G=this.g[j], r=G.r;
    var w=0.5+0.5*Math.sin(6.283*G.wf*t+G.wp)*Math.sin(6.283*G.wf2*t+G.wp2);   /* each throttle's own wiggle */
    var hold=rv.idle+(rv.gate-rv.idle)*Math.min(1,rev)+(rv.red*0.98-rv.gate)*Math.max(0,rev-1)*5;
    var rpm=(hold*(0.9+0.12*G.base)+wig*1700*(w-0.5)*Math.min(1,rev+0.2))*G.det, thr=Math.min(1,0.3+0.55*w*wig+0.4*Math.max(0,rev-1)*5);
    if(this.bank){   /* the recorded engine for every bike on the gate: cheap, and real */
      if(YB.length<n){ YS=new Float32Array(n); YB=new Float32Array(n); }
      this.sampled(G,YB,n,two?rpm/60:rpm/120,pitch,(0.35+0.65*thr)*2.4);
      var gl0=gv*Math.cos((G.pan+1)*Math.PI/4), gr0=gv*Math.sin((G.pan+1)*Math.PI/4), al0=1-Math.exp(-2*Math.PI*Math.min(glp||6500,sr*0.45)/sr), lp0=G.lp;
      for(var i0=0;i0<n;i0++){ lp0+=al0*(YB[i0]-lp0); L[i0]+=lp0*gl0; R[i0]+=lp0*gr0; }
      G.lp=lp0; continue;
    }
    var fire=(two?rpm/60:rpm/120)*pitch, inc=fire/sr;
    G.dk=Math.exp(-1/(Math.max(1e-4,T.tau/Math.max(fire,1))*sr));
    var pb=two?sstep(rv.pipeLo,rv.pipeHi,rpm):0;
    var f1=(T.body[0]+T.body[1]*rpm)*pitch, f2=(two?T.pipe[0]+1300*T.k*pb+T.pipe[1]*rpm:T.pipe[0]+T.pipe[1]*rpm)*pitch;
    var F1=2*Math.sin(Math.PI*Math.min(f1,lim)/sr), F2=2*Math.sin(Math.PI*Math.min(f2,lim)/sr), Q1=1/T.body[2], Q2=1/(two?T.pipe[2]+4*pb:T.pipe[2]);
    var g2=two?T.pipe[3]*(1+0.8*pb):T.pipe[3], drv=1.3+2.2*thr, al=1-Math.exp(-2*Math.PI*Math.min(glp||6500,sr*0.45)/sr);
    var gl=gv*Math.cos((G.pan+1)*Math.PI/4), gr=gv*Math.sin((G.pan+1)*Math.PI/4), thrP=0.3+0.7*thr;
    var ph=G.ph, env=G.env, dk=G.dk, a1=G.a1, b1=G.b1, a2=G.a2, b2=G.b2, lp=G.lp;
    for(var i=0;i<n;i++){
      ph+=inc;
      if(ph>=1){ ph-=1; env=(0.75+0.5*r())*thrP; } else env*=dk;
      var x=env*(1+0.35*(r()*2-1))+1e-18;
      var h1=x-a1-Q1*b1; b1+=F1*h1; a1+=F1*b1;
      var h2=x-a2-Q2*b2; b2+=F2*h2; a2+=F2*b2;
      var y=sat(drv*(T.body[3]*b1+g2*b2));
      lp+=al*(y-lp);
      L[i]+=lp*gl; R[i]+=lp*gr;
    }
    G.ph=ph; G.env=env; G.a1=a1; G.b1=b1; G.a2=a2; G.b2=b2; G.lp=lp;
  }
  this.t+=n/sr;
};
/* n samples with the parameter values P (one value each: k-rate) */
Engine.prototype.render=function(L,R,n,P){
  var pitch=P.pitch==null?1:P.pitch;
  for(var i=0;i<this.nMain;i++) this.voice(this.v[i],L,R,n,P["rpm"+i],P["thr"+i],P["gain"+i],P["pan"+i],P["dop"+i],P["lp"+i],pitch);
  this.chorus(L,R,n,P.gGain||0,P.gRev||0,P.gWig==null?1:P.gWig,pitch,P.gLp||6500);
};

if(typeof AudioWorkletProcessor!=="undefined"&&typeof registerProcessor==="function"){
  class MXEngine extends AudioWorkletProcessor{
    static get parameterDescriptors(){ return PARAMS; }
    constructor(opt){
      super();
      var po=(opt&&opt.processorOptions)||{};
      this.E=new Engine({stroke:po.stroke,cc:po.cc,seed:po.seed,gate:po.gate,main:po.main,sampleRate:SRATE});
      this.P={}; this.alive=true;
      var self=this;
      this.port.onmessage=function(e){ var d=e&&e.data; if(d&&d.t==="end") self.alive=false; };
    }
    process(inputs,outputs,params){
      var out=outputs[0]; if(!out||!out.length) return this.alive;
      var L=out[0], R=out[1]||out[0], n=L.length, P=this.P;
      for(var i=0;i<PARAMS.length;i++){ var nm=PARAMS[i].name, a=params[nm]; P[nm]=a&&a.length?a[0]:PARAMS[i].defaultValue; }
      this.E.render(L,R,n,P);
      return this.alive;
    }
  }
  registerProcessor("mx-engine",MXEngine);
}
if(typeof module!=="undefined"&&module.exports) module.exports={Engine:Engine,PARAMS:PARAMS,toneOf:toneOf,eraRev:eraRev};
})();
