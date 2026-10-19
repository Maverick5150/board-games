/* Motocross War — the broadcast's sound, on top of ../sound.js (mxshow W3). Loaded after sound.js by the game page and by the Party TV (the TV
   plays every sound; the phones load none of this and stay silent). Presentation only: nothing here touches a race, a result or the points.

   S1, the replay sounds (synthesized, on the effects bus: they follow the Effects volume and mute):
     Sound.sfx("mxReplayIn")   a band-passed noise sweep 400 -> 2400 Hz in 0.32 s, then a 120 ms two-note saw stab a fifth apart (E4 + B4: the
                               theme's key) through a low-pass; 0.46 s in all
     Sound.sfx("mxReplayOut")  the falling sweep 2400 -> 400 Hz, then a 40 ms tick; 0.37 s
     MXWar.Sfx.replay("in" | "out")   the package's whooshIn / whooshOut when they are decoded, else the synthesized pair
     MXWar.Sfx.cue("checkered" | "podium" | "war" | "menu")   the package's cue, else today's sound ("win", "win", "cannon", the playlist)

   S2, the show music (MUSIC-PLAN 11.2; the package is mxwar/audio/<pkg>/pkg.json, cut from the CEO's picks by our own tool):
     Sound.show.load(pkg = "base", {cues}) -> Promise       the manifest, and the stings decoded (cues: which; default the show's stings)
     Sound.show.cue(name, {at: "now" | "beat" | "bar", gain, bus}) -> Promise<t>   a one-shot; t = the AudioContext time its downbeat lands
                               (open, theme, hit, podium, outro, whooshIn, whooshOut, checkered, war, bumper)
     Sound.show.bed(name | null, {fade: ms, end, bar, gain}) -> Promise<t>   a looping bed (preA, recapB, next: sample-exact loops entering on
                               the next bar of what plays, at a random bar of the loop), or a streamed one (menu: the theme first, then the
                               rotation; finale); null = fade out, {end: true} = the bed's own 2-bar ending from the next bar
     Sound.show.nextBar() -> t   the next bar line of the bed (or of a long sting) playing now; now when nothing plays
     Sound.show.stop({fade: 250}) -> t   Skip: silent within the fade; then every decoded buffer is released (but the 4 race cues: {all: true})
     Sound.show.has(name) -> bool;  Sound.show.credits() -> [{cue, title, by, licence, url, changes, source}]
     Sound.show.stakes({ri, n, gap, racePts} | 1 | 2) -> 1 | 2   the stakes ladder: variant 2 (preA2 / recapB2) in the last 3 rounds or when
                               the title gap is under one race's points; preA / recapB resolve to the current variant
     Sound.show.ready(name) -> bool (decoded now);  Sound.show.mem() -> {bytes, peak, files}
   Levels (MUSIC-PLAN 4.1, through Sound.mix's broadcast profile): stings -18 LUFS on the show bus, whooshes -20, beds -22 (-30 under a line),
   podium / bumper / finale -20, menu -18. Decoded audio stays under 28 MB: cues not playing are released, oldest first. */
(function(g){
"use strict";
var S=g.Sound, MXW=g.MXWar=g.MXWar||{};
if(!S||typeof S.addSfx!=="function"||!S.mix){   // an older or missing sound.js: MXWar.Sfx plays today's sounds, there is no Sound.show
  MXW.Sfx={replay:function(){ return "off"; },cue:function(n){ var o={checkered:"win",podium:"win",war:"cannon"}[n]; try{ if(o&&S&&S.sfx) S.sfx(o); else if(n==="menu"&&S&&S.music) S.music("mxwar"); }catch(e){} return "synth"; }};
  return;
}
var PKGS={base:"30c0ddf7"};   // each manifest's content hash (cutpkg.js): a new manifest is a new URL, so no cache can serve an old one
var BASE=(function(){ try{ var s=g.document&&g.document.currentScript&&g.document.currentScript.src; if(s) return s.replace(/[^\/]*$/,"")+"audio/"; }catch(e){} return "audio/"; })();
function dbl(d){ return Math.pow(10,(d||0)/20); }
function hidden(){ try{ return !!(g.document&&g.document.hidden); }catch(e){ return false; } }

/* ---------- S1: the synthesized replay sounds ---------- */
var A_SW=0.794, A_ST=0.170, A_TK=0.302;   // about -22 LUFS momentary on the broadcast effects bus, like the game effects (w3/out/audio-tests.json)
function sweep(C,nb,t,out,up){
  var s=C.createBufferSource(); s.buffer=nb;
  var f=C.createBiquadFilter(); f.type="bandpass"; f.Q.value=1.6;
  f.frequency.setValueAtTime(up?400:2400,t); f.frequency.exponentialRampToValueAtTime(up?2400:400,t+0.32);
  var gn=C.createGain(); gn.gain.setValueAtTime(0.0001,t);
  if(up){ gn.gain.exponentialRampToValueAtTime(A_SW,t+0.27); gn.gain.exponentialRampToValueAtTime(0.0001,t+0.34); }
  else { gn.gain.exponentialRampToValueAtTime(A_SW,t+0.02); gn.gain.exponentialRampToValueAtTime(0.0001,t+0.33); }
  s.connect(f); f.connect(gn); gn.connect(out); s.start(t,Math.random()*0.5); s.stop(t+0.36);
}
S.addSfx("mxReplayIn",function(t,out,C,nb){
  sweep(C,nb,t,out,true);
  var t2=t+0.32, lp=C.createBiquadFilter(), gn=C.createGain();
  lp.type="lowpass"; lp.Q.value=0.9; lp.frequency.setValueAtTime(2600,t2); lp.frequency.exponentialRampToValueAtTime(900,t2+0.12);
  gn.gain.setValueAtTime(0.0001,t2); gn.gain.exponentialRampToValueAtTime(A_ST,t2+0.006); gn.gain.exponentialRampToValueAtTime(0.0001,t2+0.12);
  [329.63,493.88].forEach(function(f){ var o=C.createOscillator(); o.type="sawtooth"; o.frequency.value=f; o.connect(lp); o.start(t2); o.stop(t2+0.13); });
  lp.connect(gn); gn.connect(out);
},{pri:6,solo:true});
S.addSfx("mxReplayOut",function(t,out,C,nb){
  sweep(C,nb,t,out,false);
  var t2=t+0.32, o=C.createOscillator(), gn=C.createGain();
  o.type="triangle"; o.frequency.value=1760;
  gn.gain.setValueAtTime(0.0001,t2); gn.gain.exponentialRampToValueAtTime(A_TK,t2+0.002); gn.gain.exponentialRampToValueAtTime(0.0001,t2+0.04);
  o.connect(gn); gn.connect(out); o.start(t2); o.stop(t2+0.05);
},{pri:6,solo:true});

/* ---------- S2: Sound.show ---------- */
var BUDGET=(function(){ try{ var m=g.navigator&&g.navigator.deviceMemory; return m&&m<=1?14e6:28e6; }catch(e){ return 28e6; } })(), RACE_SET=["whooshIn","whooshOut","checkered","war"], SHOW_SET=["open","theme","hit","outro","whooshIn","whooshOut"];
var WHOOSH_SFX=0.307;  // a package whoosh in a live replay rides the effects bus at the synthesized pair's level (-22 LUFS momentary)
var P={id:null,man:null,ready:null,files:{},bytes:0,pend:0,peak:0,delay:null,stakes:1,rot:null,lastBar:{},drawn:{},titleDone:false,gen:0};
var BED=null, GRID=null, LIVE=[], STREAMS=[];   // LIVE: every source scheduled on a decoded cue, with its scheduled end
function ac(){ return S.ctx(); }
function busOf(c,o){ var n=(o&&o.bus)||(c&&c.bus)||"music"; return S.mix.bus(n)||S.mix.bus("music"); }
function fetchBuf(u){ return fetch(u).then(function(r){ if(!r.ok) throw new Error(r.status+" "+u); return r.arrayBuffer(); }); }
function fetchJSON(u){ return fetch(u).then(function(r){ if(!r.ok) throw new Error(r.status+" "+u); return r.json(); }); }
function decodeBuf(C,ab){ return new Promise(function(res,rej){ var p; try{ p=C.decodeAudioData(ab,res,rej); }catch(e){ rej(e); return; } if(p&&p.then) p.then(res,rej); }); }
/* the decoder's delay: the first sample over -40 dBFS against where the packager put it (pkg.json "on") */
function firstOver(buf){ var n=Math.min(buf.length,Math.round(buf.sampleRate*0.6)), ch=[], c, i; for(c=0;c<buf.numberOfChannels;c++) ch.push(buf.getChannelData(c)); for(i=0;i<n;i++) for(c=0;c<ch.length;c++) if(ch[c][i]>0.01||ch[c][i]<-0.01) return i/buf.sampleRate; return null; }

function rotGet(){ if(P.rot===null){ try{ P.rot=g.localStorage.getItem("bg_mxwar_rot")||""; }catch(e){ P.rot=""; } } return P.rot; }
function rotSet(v){ P.rot=v; try{ g.localStorage.setItem("bg_mxwar_rot",v); }catch(e){} }
/* a name -> {name, c}: preA / recapB follow the stakes ladder; a group (menu, finale, next, bumper) draws one of the rotation's tracks, never the
   track drawn last (anywhere: the draw is shared and kept on the device), unless it was drawn ahead by load() */
function resolve(name,keep){
  var m=P.man; if(!m) return null;
  if(name==="preA"||name==="recapB") name=name+(P.stakes===2&&m.cues[name+"2"]?2:1);
  var gr=m.groups&&m.groups[name];
  if(gr){
    var pick=P.drawn[name];
    if(!pick){
      var alts=(gr.alts||[]).filter(function(a){ return m.cues[a]; }), last=rotGet(), pool=alts.filter(function(a){ return m.cues[a].src!==last; });
      if(!pool.length) pool=alts; if(!pool.length) return null;
      pick=pool[Math.floor(Math.random()*pool.length)]; rotSet(m.cues[pick].src);
    }
    if(keep) P.drawn[name]=pick; else delete P.drawn[name];
    return {name:pick,c:m.cues[pick]};
  }
  return m.cues[name]?{name:name,c:m.cues[name]}:null;
}
function man(){ return P.man?Promise.resolve(P.man):load(P.id||"base",{cues:[]}); }
function load(id,o){
  id=id||"base"; o=o||{};
  if(P.id!==id||!P.ready){
    if(P.id&&P.id!==id) release(true);
    P.id=id; P.man=null;
    var pr=P.ready=fetchJSON(BASE+id+"/pkg.json"+(PKGS[id]?"?h="+PKGS[id]:"")).then(function(m){ if(!m||!m.cues) throw new Error("no cues in "+id); if(P.ready===pr) P.man=m; return m; });
    pr.catch(function(){ if(P.ready===pr){ P.ready=null; P.id=null; } });
  }
  var want=(o.cues||SHOW_SET).slice();
  // one decode after another (a burst of decodes would stall a slow device), and only what fits the budget now: the rest decodes when it is
  // first used, when the cues that have finished can be released
  function next(){
    var nm=want.shift(); if(nm==null) return P.man;
    if(!has(nm)) return next();
    var C=ac(), r=resolve(nm,true), est=r&&C?Math.ceil((r.c.len||10)*C.sampleRate)*8:0;
    if(!r||r.c.kind==="stream"||!C||(P.bytes+P.pend+est>BUDGET&&!(P.files[r.c.file]&&P.files[r.c.file].buf))) return next();
    return decode(r.name,r.c).then(next,next);
  }
  return P.ready.then(next);
}
/* a decoded cue is in use while a source scheduled on it has not reached its end (its scheduled end, not onended, which can come late) */
function inUse(e){ var C=ac(), t=C?C.currentTime:0; for(var i=0;i<LIVE.length;i++){ var x=LIVE[i]; if(x.e===e&&x.end>t-0.05) return true; } return false; }
function room(est){   // est: the bytes about to be decoded; decodes still in flight count with their estimates (P.pend)
  if(P.bytes+P.pend+est<=BUDGET) return;
  var C=ac(), t=C?C.currentTime:0; LIVE=LIVE.filter(function(x){ return x.end>t-0.5; });
  var list=Object.keys(P.files).map(function(k){ return P.files[k]; }).filter(function(e){ return e.buf&&!inUse(e); });
  list.sort(function(a,b){ return ((RACE_SET.indexOf(a.name)>=0)-(RACE_SET.indexOf(b.name)>=0))||(a.last-b.last); });
  while(P.bytes+P.pend+est>BUDGET&&list.length) drop(list.shift());
}
function drop(e){ if(P.files[e.f]!==e) return; if(e.buf) P.bytes-=e.bytes; delete P.files[e.f]; e.buf=null; }
function decode(name,c){
  var f=c.file, e=P.files[f], C=ac();
  if(e&&e.buf){ e.last=Date.now(); return Promise.resolve(e); }
  if(e&&e.p) return e.p;
  if(!C) return Promise.reject(new Error("audio not started"));
  e=P.files[f]={f:f,name:name,c:c,last:Date.now(),buf:null,bytes:0,dl:0};
  var est=Math.ceil((c.len||10)*C.sampleRate)*8; room(est); P.pend+=est;
  e.p=fetchBuf(BASE+P.id+"/"+f).then(function(ab){ return decodeBuf(C,ab); }).then(function(buf){
    e.p=null; P.pend=Math.max(0,P.pend-est); if(P.files[f]!==e) return e;
    e.buf=buf; e.bytes=buf.length*buf.numberOfChannels*4; P.bytes+=e.bytes; if(P.bytes>P.peak) P.peak=P.bytes;
    var on=firstOver(buf), ok=on!=null&&c.on!=null&&Math.abs(on-c.on)<0.2;
    e.dl=ok?on-c.on:(P.delay!=null?P.delay:0);
    if(ok&&c.on<=0.06) P.delay=e.dl;
    return e;
  },function(err){ P.pend=Math.max(0,P.pend-est); if(P.files[f]===e) delete P.files[f]; throw err; });
  return e.p;
}
function need(name,keep){
  return man().then(function(){
    var r=resolve(name,keep); if(!r) throw new Error("no cue "+name);
    if(r.c.kind==="stream") return r;
    return decode(r.name,r.c).then(function(e){ r.e=e; return r; });
  });
}
function grid(){ var C=ac(), t=C?C.currentTime:0; if(BED&&BED.grid) return BED.grid; if(GRID&&GRID.until>t) return GRID; return null; }
function nextOn(G,isBar,after){ var u=isBar?G.bar:G.bar/4, k=Math.ceil((after-G.t0)/u-1e-6); return G.t0+k*u; }
function nextBar(){ var C=ac(); if(!C) return 0; var t=C.currentTime+0.05, G=grid(); return G?nextOn(G,true,t):t; }
/* every source: src -> its level (and fade-in) -> [a bed's duck under a sting] -> its fader (one fade-out) -> the bus. Each fade starts from a
   value computed here: Web Audio's cancelAndHoldAtTime adds no anchor when it cancels nothing, and a ramp scheduled later would then start at
   the last event (a 50 ms fade 12 s on became a 12 s fade). */
function chainOf(C,src,lvl,bus,duck){ var gn=C.createGain(), fd=C.createGain(), dk=duck?C.createGain():null; gn.gain.value=lvl; src.connect(gn); if(dk){ gn.connect(dk); dk.connect(fd); } else gn.connect(fd); fd.connect(bus); return {gn:gn,dk:dk,fd:fd}; }
function track(src,v,e,name,end){
  var x={src:src,g:v.gn,fd:v.fd,e:e,name:name,end:end,fo:null}; LIVE.push(x);
  src.onended=function(){ if(e) e.last=Date.now(); var i=LIVE.indexOf(x); if(i>=0) LIVE.splice(i,1); try{ v.gn.disconnect(); v.fd.disconnect(); if(v.dk) v.dk.disconnect(); }catch(err){} };
  return x;
}
function fadeOut(x,t0,t1){
  if(!x||!x.fd) return; var p=x.fd.gain, v0=1;
  if(x.fo){ if(t0>=x.fo[1]) return; if(t0>x.fo[0]) v0=Math.max(0,1-(t0-x.fo[0])/(x.fo[1]-x.fo[0])); t1=Math.min(t1,x.fo[1]); try{ p.cancelScheduledValues(t0); }catch(e){} }
  t1=Math.max(t0+0.005,t1);
  try{ p.setValueAtTime(v0,t0); p.linearRampToValueAtTime(0,t1); }catch(e){}
  x.fo=[t0,t1]; x.end=Math.min(x.end,t1+0.05);
  if(x.src){ try{ x.src.stop(t1+0.02); }catch(e){} }
}
/* a sting over a bed: the bed down 6 dB from t0 (in 30 ms) to t1 (back in 100 ms), from the duck's value at t0 */
function dkAt(b,t){ var ev=b.dkEv, v=1; for(var i=0;i<ev.length;i++){ var e=ev[i]; if(e[0]<=t){ v=e[1]; continue; } if(e[2]&&i>0){ var q=ev[i-1]; return q[1]+(e[1]-q[1])*(t-q[0])/(e[0]-q[0]); } break; } return v; }
function duckBed(b,t0,t1){
  var p=b.dk.gain, v0=dkAt(b,t0); try{ p.cancelScheduledValues(t0); }catch(e){}
  b.dkEv=b.dkEv.filter(function(e){ return e[0]<t0; });
  var ev=[[t0,v0,0],[t0+0.03,0.5,1],[Math.max(t0+0.03,t1-0.2),0.5,0],[Math.max(t0+0.13,t1+0.1),1,1]];
  try{ ev.forEach(function(e){ if(e[2]) p.linearRampToValueAtTime(e[1],e[0]); else p.setValueAtTime(e[1],e[0]); }); }catch(e){}
  b.dkEv=b.dkEv.concat(ev);
}
/* a one-shot: at "now" it starts at once (its pick-up included); at "beat" / "bar" its downbeat lands on the grid of what plays */
function play(r,o){
  var C=ac(), c=r.c, e=r.e, t=C.currentTime+0.03, at=(o&&o.at)||"now";
  var on=c.on||0.05, pre=Math.max(0,(c.beat0!=null?c.beat0:on)-on), when, start;
  var G=at==="now"?null:grid();
  if(G){ when=nextOn(G,at==="bar",t+pre); start=when-pre; } else { start=t; when=t+pre; }
  var src=C.createBufferSource(); src.buffer=e.buf;
  var v=chainOf(C,src,dbl(c.gainDb)*(o&&o.gain!=null?o.gain:1),busOf(c,o),false), len=c.len-on;
  track(src,v,e,r.name,start+len);
  src.start(start,on+e.dl);
  if(BED&&BED.dk&&((o&&o.bus)||c.bus)==="show"&&!BED.fading) duckBed(BED,when,start+len);   // a sting over a bed ducks the bed 6 dB for its length
  if(c.bpm&&c.bar&&len>3) GRID={t0:when,bar:c.bar,until:start+len};
  return when;
}
function cue(name,o){ return need(name).then(function(r){ if(!ac()) throw new Error("audio not started"); if(r.c.kind==="stream") throw new Error(name+" is streamed: bed()"); return play(r,o||{}); }); }
function ready(name){ var m=P.man; if(!m) return false; var c=m.cues[name]||(m.groups&&m.groups[name]&&P.drawn[name]&&m.cues[P.drawn[name]]); var e=c&&P.files[c.file]; return !!(e&&e.buf); }
function readyNow(name){ var m=P.man, c=m&&m.cues[name], e=c&&P.files[c.file]; return e&&e.buf?{name:name,c:c,e:e}:null; }

function fadeBed(b,when,ms){
  var C=ac(), t=C.currentTime, f=ms!=null?ms/1000:b.grid.bar, t0=Math.max(t,when-f), t1=Math.max(t0+0.01,when-(b.c.pre||0));
  b.fading=true; fadeOut(b.x,t0,t1);
}
function pickBar(name,n){ var k=Math.floor(Math.random()*n); if(n>1&&k===P.lastBar[name]) k=(k+1)%n; P.lastBar[name]=k; return k; }
function bed(name,o){
  o=o||{};
  if(name==null) return Promise.resolve(bedOff(o));
  return man().then(function(m){
    var gr=m.groups&&m.groups[name], first=gr?m.cues[(gr.alts||[])[0]]:null;
    if((gr&&first&&first.kind==="stream")||(m.cues[name]&&m.cues[name].kind==="stream")) return stream(name,o);
    return need(name).then(function(r){
      var C=ac(); if(!C) throw new Error("audio not started");
      var c=r.c, e=r.e; if(c.kind!=="bed") throw new Error(r.name+" is not a bed");
      var pre=c.pre||0, t=C.currentTime, G=grid(), when=G?nextOn(G,true,t+pre+0.015):t+0.06;
      var n=c.bars||1, k=o.bar!=null?((o.bar%n)+n)%n:pickBar(r.name,n), off=c.beat0+e.dl+k*c.bar;
      var src=C.createBufferSource(), lvl=dbl(c.gainDb)*(o.gain!=null?o.gain:1);
      src.buffer=e.buf; src.loop=true; src.loopStart=c.loop[0]+e.dl; src.loopEnd=c.loop[1]+e.dl;
      var v=chainOf(C,src,0,busOf(c,o),true);
      v.gn.gain.setValueAtTime(0,when-pre); v.gn.gain.linearRampToValueAtTime(lvl,when);
      var old=BED;
      BED={name:r.name,c:c,e:e,src:src,g:v.gn,dk:v.dk,dkEv:[],lvl:lvl,grid:{t0:when,bar:c.bar},fading:false};
      BED.x=track(src,v,e,r.name,Infinity);
      src.start(when-pre,off-pre);
      if(old) fadeBed(old,when,o.fade);
      killStreams(when,o.fade);
      return when;
    });
  });
}
function bedOff(o){
  var b=BED, C=ac(); BED=null; killStreams(null,o.fade);
  if(!b||!C) return C?C.currentTime:0;
  if(o.end&&b.c.end){
    var pre=b.c.endPre!=null?b.c.endPre:(b.c.pre||0), when=nextOn(b.grid,true,C.currentTime+pre+0.015), e=b.e;
    var s2=C.createBufferSource(); s2.buffer=e.buf; var v=chainOf(C,s2,0,busOf(b.c),false);
    v.gn.gain.setValueAtTime(0,when-pre); v.gn.gain.linearRampToValueAtTime(b.lvl,when-pre*0.3);
    track(s2,v,e,b.name+":end",when+(b.c.end[1]-b.c.end[0]));
    s2.start(when-pre,b.c.end[0]+e.dl);
    b.fading=true; fadeOut(b.x,when-pre,when-pre*0.3);
    return when;
  }
  var f=(o.fade!=null?o.fade:400)/1000, t=C.currentTime; b.fading=true; fadeOut(b.x,t,t+f);
  return t;
}
/* streamed beds: a media element into the music bus (the menu: the theme once a visit, then the rotation, one track after another; the finale) */
function stream(name,o){
  var C=ac(); if(!C) return Promise.reject(new Error("audio not started"));
  var t=C.currentTime;
  if(BED){ var b=BED; BED=null; fadeBed(b,t+((o.fade!=null?o.fade:600)/1000),o.fade!=null?o.fade:600); }
  killStreams(null,o.fade);
  var first=name==="menu"&&!P.titleDone&&P.man.groups.menu&&P.man.groups.menu.first;
  var r=first?{name:first,c:P.man.cues[first]}:resolve(name);
  if(!r) return Promise.reject(new Error("no cue "+name));
  if(first) P.titleDone=true;
  startStream(r,name==="menu",o);
  return Promise.resolve(t);
}
function startStream(r,isMenu,o){
  var C=ac(), a, node, lvl=dbl(r.c.gainDb)*(o&&o.gain!=null?o.gain:1);
  try{ a=new g.Audio(); a.preload="auto"; a.src=BASE+P.id+"/"+r.c.file; node=C.createMediaElementSource(a); }catch(e){ return null; }
  var gn=C.createGain(), fd=C.createGain(); node.connect(gn); gn.connect(fd); fd.connect(busOf(r.c,o));
  var st={a:a,node:node,g:gn,fd:fd,fo:null,end:Infinity,name:r.name,lvl:lvl,menu:isMenu};
  STREAMS.push(st);
  var t=C.currentTime; gn.gain.setValueAtTime(0,t); gn.gain.linearRampToValueAtTime(lvl,t+0.08);
  a.addEventListener("ended",function(){ var live=STREAMS.indexOf(st)>=0; endStream(st); if(live&&isMenu&&!STREAMS.length){ var nx=resolve("menu"); if(nx) startStream(nx,true,o); } });
  a.addEventListener("error",function(){ var live=STREAMS.indexOf(st)>=0; endStream(st); if(live&&isMenu&&!STREAMS.length){ try{ S.music("mxwar"); }catch(e){} } });   // offline and not cached: the playlist of today
  if(!hidden()){ try{ var p=a.play(); if(p&&p.catch) p.catch(function(){}); }catch(e){} }
  return st;
}
function endStream(st){ var i=STREAMS.indexOf(st); if(i>=0) STREAMS.splice(i,1); try{ st.a.pause(); }catch(e){} try{ st.node.disconnect(); st.g.disconnect(); st.fd.disconnect(); }catch(e){} try{ st.a.removeAttribute("src"); st.a.load(); }catch(e){} }
function killStreams(when,ms){
  var C=ac(); if(!C) return; var t=C.currentTime, f=Math.max(0.02,(ms!=null?ms:600)/1000), t1=when!=null?Math.max(t+0.02,when):t+f, t0=Math.max(t,t1-f);
  STREAMS.slice().forEach(function(st){ STREAMS.splice(STREAMS.indexOf(st),1); fadeOut(st,t0,t1); setTimeout(function(){ endStream(st); },Math.max(0,(t1-t)*1000+60)); });
}
if(g.document) g.document.addEventListener("visibilitychange",function(){ STREAMS.forEach(function(st){ try{ if(hidden()) st.a.pause(); else { var p=st.a.play(); if(p&&p.catch) p.catch(function(){}); } }catch(e){} }); });

function stop(o){
  o=o||{}; var C=ac(), f=Math.max(0.03,((o.fade!=null?o.fade:250)/1000)*0.8), t=C?C.currentTime:0;
  if(C){
    var all=LIVE.slice(); LIVE.length=0; BED=null; GRID=null;
    all.forEach(function(x){ fadeOut(x,t,t+f); });
    killStreams(t+f,f*1000);
  }
  var gen=++P.gen; P.drawn={};
  setTimeout(function(){ if(P.gen===gen) release(!!o.all); },Math.round((f+0.1)*1000));
  return t+f;
}
function release(all){ Object.keys(P.files).forEach(function(k){ var e=P.files[k]; if(!all&&RACE_SET.indexOf(e.name)>=0) return; if(e.p) return; drop(e); }); if(all) P.files={}; }
function has(name){ var m=P.man; if(!m) return false; if(name==="preA"||name==="recapB") return !!m.cues[name+"1"]; return !!(m.cues[name]||(m.groups&&m.groups[name])); }
function credits(){ return ((P.man&&P.man.credits)||[]).map(function(x){ return {cue:x.cue,title:x.title,by:x.by,licence:x.licence,url:x.url,changes:x.changes,source:x.source}; }); }
function stakes(o){
  if(o===1||o===2) P.stakes=o;
  else if(o&&typeof o==="object") P.stakes=((o.n&&o.ri!=null&&o.ri>=o.n-3)||(o.gap!=null&&o.racePts!=null&&o.gap<o.racePts))?2:1;
  return P.stakes;
}
S.show={load:load,cue:cue,bed:bed,nextBar:nextBar,stop:stop,has:has,credits:credits,stakes:stakes,ready:ready,
  mem:function(){ return {bytes:P.bytes,peak:P.peak,files:Object.keys(P.files).filter(function(k){ return P.files[k].buf; }).length,budget:BUDGET}; },
  _p:P};

/* ---------- MXWar.Sfx: the replay wipe's sound and the race's big moments ---------- */
MXW.Sfx={
  replay:function(dir){
    var st=S.state||{}; if(st.sm||hidden()) return "off";
    var r=readyNow(dir==="out"?"whooshOut":"whooshIn"), C=ac();
    if(r&&C){ try{ play(r,{bus:"sfx",gain:WHOOSH_SFX/dbl(r.c.gainDb)}); return "pkg"; }catch(e){} }
    S.sfx(dir==="out"?"mxReplayOut":"mxReplayIn"); return "synth";
  },
  cue:function(name){
    if(name==="menu"){ if(P.man){ bed("menu").catch(function(){ S.music("mxwar"); }); return "pkg"; } S.music("mxwar"); return "synth"; }
    var old={checkered:"win",podium:"win",war:"cannon"}[name]; if(!old) return "none";
    if(readyNow(name)||(P.man&&name==="podium")){ cue(name).catch(function(){ S.sfx(old); }); return "pkg"; }
    S.sfx(old); if(P.man) need(name,true).catch(function(){}); return "synth";
  }
};
})(window);
