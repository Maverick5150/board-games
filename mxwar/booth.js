/* MOTOCROSS WAR — the booth: the page's side of the announcers. It puts the commentator (mxwar/announce.js, MXWar.Announce) on the air through
   the shared voice (ui/voice.js, window.BGVoice: speech, captions, the duck hooks) and keeps the settings, the pause, the save and the
   start procedure. ONE booth for the phone / TV game page (mxwar/game.js) and for the Party TV host (firestick/games/mxwar.js): both make the
   same calls, so what one says the other says (the CEO's Party parity rule). No game rules in here, no DOM of its own (the caption strips are
   BGVoice's, the page mounts them). It never breaks the game: every call is guarded, a failing commentator or voice means a silent booth.

     var booth = MXWar.Booth.create({ speed: fn -> "slow"|"medium"|"fast", ctx: fn -> {hold, quiet}, onStory, sayNames: fn -> {typed name: respelling},
                                       voice, announce, now, timer:false (tests) });
     booth.feed(G, events)            the SAME event array the page plays (startRace, step / apply, simRace); skipped while the announcers are Off
     booth.shown(kind, info)          the race view's moments: "crash" {s}, "holeshot", "checkered" (2D); "pass" {s}, "lapped" {s, by} (3D, later)
     booth.shot(shot) / booth.setTrack({layout, sectionAt}) / booth.setLapMs(ms)    the camera director / the track / a compressed lap, for the 3D view
     booth.gate({G, key, people, drop(), stage(name)})   the start procedure (the opening, the 30-second board, sideways, the drop); .go() = a tap
     booth.state() / booth.restore(st) / booth.newSeason(st)         what a save keeps (the variety memory) / a fresh commentator
     booth.settings() / booth.set(key, value)   mode "voice" | "captions" | "off", chatter "less" | "normal" | "more", vol 0.2..1, a / b (voice names)
     booth.voices() / booth.sample(who)         the pickers' list (men's voices only; la / lb = friendly names, why / info = why there is only captions and what the device has) / a test line in a voice
     booth.attach(hosts)              mounts the caption strips: {band: element, top: element}
   ctx() is asked on every tick (150 ms): hold = the game is paused (the Menu): the commentator is paused too and the voice stops; quiet = a sheet
   that must stay silent is open (the battle board, the race times ...): the voice stops and the lines meant for that time are dropped. Time is
   the page's own clock (performance.now). Node: module.exports = MXWar.Booth. */
(function(g){
"use strict";
var MX=g.MXWar=g.MXWar||{};
if(MX.Booth) return;
var KEY="bg_mxwar_ann", SAYKEY="bg_mxwar_say";
var MODES=["voice","captions","off"], CHAT=["less","normal","more"];
function lsGet(k){ try{ return JSON.parse(g.localStorage.getItem(k)||"null"); }catch(e){ return null; } }
function lsSet(k,v){ try{ g.localStorage.setItem(k,JSON.stringify(v)); }catch(e){} }
function clamp(x,a,b){ return x<a?a:x>b?b:x; }
function str(s,n){ return String(s==null?"":s).slice(0,n||80); }
function cleanSettings(x){
  var d={mode:"voice",chatter:"normal",vol:1,a:"",b:""};
  if(x&&typeof x==="object"){
    if(MODES.indexOf(x.mode)>=0) d.mode=x.mode;
    if(CHAT.indexOf(x.chatter)>=0) d.chatter=x.chatter;
    if(+x.vol>0) d.vol=clamp(+x.vol,0.2,1);
    d.a=str(x.a); d.b=str(x.b);
  }
  return d;
}

/* ---- the music ducks under a line: Sound.duck(on) (sound.js; a page without it ignores this). The hooks go on the shared voice ONCE; a line
        that follows another within half a second keeps the music down (no pumping between two lines) ---- */
var duckOn=false, duckT=0;
function callDuck(on){ try{ var S=g.Sound; if(S&&typeof S.duck==="function") S.duck(on); }catch(e){} }
function duck(on){
  clearTimeout(duckT);
  if(on){ if(!duckOn){ duckOn=true; callDuck(true); } return; }
  duckT=setTimeout(function(){ if(duckOn){ duckOn=false; callDuck(false); } },500);
}
function hookVoice(V){
  if(!V||V.__mxBooth||typeof V.onStart!=="function") return;
  try{ V.__mxBooth=true; V.onStart(function(){ duck(true); }); V.onEnd(function(){ duck(false); }); }catch(e){}
}

/* what the opening of a race is made of (announce.js: the round's show open, the race intro, the engines): the start procedure waits for these */
var OPENING={show_open:1,party_welcome:1,smx_playoff:1,triple_crown:1,championship_math:1,race_intro_heat:1,race_intro_semi:1,race_intro_lcq:1,race_intro_qual:1,race_intro_main:1,race_intro_moto:1,engines:1};
var T={openMin:1800,openMax:32000,openTail:600,lineupAfter:1500,stageMin:900,noLine:900,boardHold:1800,boardCap:11000,sideHoldLo:2600,sideHoldHi:4200,sideCap:14000};
/* Game speed Fast: the same show, about a third shorter (the opening is let run to 14 s, the holds are half as long: the gate drops after about 24 s instead of 37-40 s); Medium and Slow keep the full procedure */
var TFAST={openMin:1500,openMax:14000,openTail:400,lineupAfter:1200,stageMin:700,noLine:600,boardHold:900,boardCap:6000,sideHoldLo:1400,sideHoldHi:2400,sideCap:8000};

function create(o){
  o=o||{};
  var AN=o.announce||MX.Announce, V=("voice" in o)?o.voice:g.BGVoice;
  var now=o.now||function(){ return g.performance&&g.performance.now?g.performance.now():Date.now(); };
  var storeKey=o.store===false?null:(o.storeKey||KEY);
  var S=cleanSettings(storeKey?lsGet(storeKey):null);
  var ann=null, inflight=0, held=false, quiet=false, fed={}, strips=[], gate=null, timer=0;
  var B={_inflight:function(){ return inflight; }};

  function speedNow(){ var s=typeof o.speed==="function"?o.speed():o.speed; return s==="slow"||s==="fast"?s:"medium"; }
  function sayMap(){ var m=null; try{ m=typeof o.sayNames==="function"?o.sayNames():o.sayNames; }catch(e){ m=null; } return m&&typeof m==="object"?m:{}; }
  function on(){ return S.mode!=="off"; }

  /* ---------------- the commentator ---------------- */
  function say(line){
    var A=ann, id=line.id, done=false;
    function fin(){ if(done) return; done=true; inflight=Math.max(0,inflight-1); try{ if(A) A.lineDone(id,now()); }catch(e){} }
    inflight++;
    if(!on()||held||quiet||(g.document&&g.document.hidden)){ setTimeout(fin,0); return; }   /* nothing is said over a menu, with the announcers Off or on a hidden page */
    if(!V){ setTimeout(fin,Math.max(300,line.est||1500)); return; }
    var got=null;
    try{
      got=V.speak(line.text,{who:line.who,say:line.say,tier:line.tier,interrupt:line.interrupt,priority:line.pri,ttl:line.ttl,line:line,
        onStart:function(){ try{ if(A) A.lineStart(id,now()); }catch(e){} },
        onEnd:function(){ fin(); }});
    }catch(e){ got=null; }
    if(got==null) setTimeout(fin,0);
  }
  function makeAnn(prev){
    if(!AN||!AN.create) return null;
    var st=null; try{ st=prev&&prev.state?prev.state():null; }catch(e){ st=null; }
    var a=null;
    try{ a=AN.create({say:say,onStory:function(s){ try{ if(typeof o.onStory==="function") o.onStory(s); }catch(e){} },speed:speedNow(),chatter:S.chatter,sayNames:sayMap(),seed:o.seed}); }
    catch(e){ try{ if(g.console&&g.console.warn) g.console.warn("booth: no commentator:",e&&e.message); }catch(x){} return null; }
    if(st){ delete st.sit; try{ a.restore(st,now()); }catch(e){} }   /* the variety memory goes on; the sitting's flags start again */
    return a;
  }
  ann=makeAnn(null);
  B.available=function(){ return !!ann; };

  /* ---------------- settings ---------------- */
  function applyVoice(){
    if(!V) return;
    try{ V.mode(S.mode); V.volume(S.vol); if(typeof V.setVoice==="function"){ V.setVoice("a",S.a||null); V.setVoice("b",S.b||null); } }catch(e){}
  }
  function save(){ if(storeKey) lsSet(storeKey,S); }
  B.settings=function(){ return {mode:S.mode,chatter:S.chatter,vol:S.vol,a:S.a,b:S.b}; };
  B.callsRace=function(){ return !!ann&&on(); };
  B.set=function(k,v){
    var was=S.mode;
    if(k==="mode"&&MODES.indexOf(v)>=0) S.mode=v;
    else if(k==="chatter"&&CHAT.indexOf(v)>=0){ S.chatter=v; if(ann) ann.set("chatter",v); }
    else if(k==="vol"&&+v>0) S.vol=clamp(+v,0.2,1);
    else if(k==="a"||k==="b") S[k]=str(v);
    else if(k==="speed"){ if(ann) ann.set("speed",v==="slow"||v==="fast"?v:"medium"); return; }
    else return;
    save(); applyVoice();
    if(S.mode==="off"&&was!=="off"){ if(gate) gate.cancel(); if(V) try{ V.stop(); }catch(e){} }
    if(S.mode!=="off"&&was==="off"&&V) try{ V.ready(); }catch(e){}   /* the engines start only once the announcers are on */
    if(typeof o.onChange==="function") try{ o.onChange(B.settings()); }catch(e){}
  };
  B.setSpeed=function(s){ if(ann) ann.set("speed",s==="slow"||s==="fast"?s:"medium"); };
  /* a view that paces a lap shorter than the real lap (not the 2D view: it rides the real lap time) tells the commentator the lap's length on screen, in ms; 0 = real */
  B.setLapMs=function(ms){ if(ann) ann.set("lapMs",+ms>0?+ms:0); };
  /* the people's own names, said as they asked ("How should the announcers say your name?"): re-read before a feed when it changed */
  var namesSig="";
  function syncNames(){ if(!ann) return; var m=sayMap(), sig=JSON.stringify(m); if(sig!==namesSig){ namesSig=sig; ann.set("sayNames",m); } }
  B.voices=function(){
    var r=null, v=null; try{ r=V?V.ready():null; v=V?V.voices():null; }catch(e){}
    var list=v&&v.list?v.list:[];
    return {ready:!!(r&&r.ready),engine:r?r.engine:"captions",native:!!(r&&r.engine==="native"),list:list,a:v&&v.a?v.a.name:"",b:v&&v.b?v.b.name:"",la:v&&v.a?(v.a.label||v.a.name):"",lb:v&&v.b?(v.b.label||v.b.name):"",same:!!(v&&v.same),why:r&&r.why?r.why:"",info:r&&r.info?r.info:"",picks:{a:S.a,b:S.b}};
  };
  /* a test line in a voice (the settings' "Hear the announcers"): returns the text said, or "" when the announcers are Off; queue = after the line playing */
  B.sample=function(who,queue){
    if(!V||!on()) return "";
    who=who==="b"?"b":"a";
    var text=who==="a"?"Wes Calloway here, and the gate is about to drop!":"Hutch Bramlett with you. Watch the first corner.";
    try{ return V.speak(text,{who:who,say:text,tier:"T1",interrupt:!queue,ttl:8000})!=null?text:""; }catch(e){ return ""; }
  };

  /* ---------------- the captions ---------------- */
  B.attach=function(hosts){
    if(!V||typeof V.captions!=="function") return null;
    hosts=hosts||{};
    var out={};
    ["band","top"].forEach(function(k){
      if(!hosts[k]) return;
      try{ var st=V.captions(hosts[k],{names:{a:"Calloway",b:"Bramlett"}}); if(st){ strips.push(st); out[k]=st; } }catch(e){}
    });
    return out;
  };

  /* ---------------- the feed, the clock, the pause ---------------- */
  function raceKey(Gs){ return Gs?(Gs.sid+"|"+Gs.ri+"|"+Gs.rkey):""; }
  function sync(c){ if(!c){ try{ c=typeof o.ctx==="function"?o.ctx():null; }catch(e){ c=null; } } if(c){ setHold(!!c.hold); setQuiet(!!c.quiet); } return c; }
  B.feed=function(Gs,evs){
    if(!ann||!on()||!Gs) return;
    sync(); syncNames();
    evs=evs||[];
    for(var i=0;i<evs.length;i++) if(evs[i]&&evs[i].e==="race") fed[Gs.sid+"|"+evs[i].ri+"|"+evs[i].key]=true;
    try{ ann.feed(Gs,evs,now()); }catch(e){}
  };
  B.shown=function(kind,info){ sync(); if(ann&&on()&&!held) try{ ann.shown(kind,info||{},now()); }catch(e){} };
  B.shot=function(s){ if(ann) try{ ann.shot(s); }catch(e){} };
  B.setTrack=function(t){ if(ann) try{ ann.setTrack(t); }catch(e){} };
  B.phase=function(kind,info){ sync(); if(ann&&on()&&!held) try{ ann.phase(kind,info||null,now()); }catch(e){} };
  B.story=function(){ try{ return ann?ann.story():null; }catch(e){ return null; } };
  function setHold(h){
    if(h===held) return;
    held=h;
    if(!ann) return;
    if(h){ try{ ann.pause(); }catch(e){} if(V) try{ V.stop(); }catch(x){} }
    else { try{ ann.resume(now()); }catch(e){} }
  }
  function setQuiet(q){
    if(q===quiet) return;
    quiet=q;
    if(q&&V) try{ V.stop(); }catch(e){}
  }
  B.hold=function(h){ setHold(!!h); };
  B.tick=function(c){
    var t=now();
    sync(c||null);
    if(held||!ann||!on()) return;
    try{ ann.tick(t); }catch(e){}
    if(gate&&!quiet) gate.step(t);   /* a sheet that is not the show is open: the start procedure waits for it (its calls would be dropped) */
  };
  if(o.timer!==false&&g.setInterval){ timer=g.setInterval(function(){ try{ B.tick(); }catch(e){} },150); }
  B.destroy=function(){ if(timer){ g.clearInterval(timer); timer=0; } if(gate) gate.cancel(); strips.forEach(function(s){ try{ s.destroy(); }catch(e){} }); strips=[]; try{ if(V) V.stop(); }catch(e){} };
  B.state=function(){ try{ return ann?ann.state():null; }catch(e){ return null; } };
  B.restore=function(st){ if(ann&&st) try{ ann.restore(st,now()); }catch(e){} };
  /* a new season, or a save loaded: a fresh commentator (the variety memory kept, or the saved one), the voice stopped, nothing carried over */
  B.newSeason=function(st){
    if(gate) gate.cancel();
    if(V) try{ V.stop(); }catch(e){}
    fed={}; namesSig="";
    ann=makeAnn(st?null:{state:function(){ return B.state(); }});
    if(ann&&st) try{ ann.restore(st,now()); }catch(e){}
  };
  B.reset=function(){ if(gate) gate.cancel(); if(V) try{ V.stop(); }catch(e){} if(ann) try{ ann.reset(); }catch(e){} fed={}; };
  B.queue=function(){ try{ return ann?ann.queue():[]; }catch(e){ return []; } };
  B.history=function(){ try{ return ann?ann.history():[]; }catch(e){ return []; } };
  B._ann=function(){ return ann; };

  /* ---------------- the start procedure (AMA: the show opens, the 30-second board, the board turns sideways, the gate drops 5-10 s later) ----------------
     The opening is what the commentator says when the race is set up (the welcome, the intros, the engines): it is let finish, up to 32 s (14 s at Game speed Fast, where every hold is half as long too).
     A person on the gate decides when to go: their tap (Drop the gate) runs the board and the drop; a tap while the opening still plays skips
     it (straight to "sideways"); a tap during the board or the sideways call drops the gate at once. Watching, or Auto: the whole procedure runs by
     itself. A stage whose line was never made (a race picked up after a reload) skips its wait. B.gate() is null when the announcers are Off, so
     a game with them off is never slowed. */
  function pending(set){ var q=B.queue(); for(var i=0;i<q.length;i++) if(set[q[i].ev]) return true; return false; }
  function quietNow(set){ return inflight===0&&!pending(set); }
  function lineMade(ev,since){ var h=B.history(); for(var i=h.length-1;i>=0;i--){ if(h[i].at<since-50) break; if(h[i].ev===ev) return true; } return false; }
  B.gate=function(op){
    op=op||{};
    if(!ann||!on()) return null;
    if(gate) gate.cancel();
    var t0=now(), Tk=speedNow()==="fast"?TFAST:T;   /* the timing table of this show (Game speed Fast: about a third shorter) */
    var st={stage:"open",t0:t0,stageAt:t0,last:t0,people:!!op.people,openDone:false,openAt:0,lineupAt:0,phased:false,since:0,qs:0,holdMs:0,done:false,cancelled:false};
    /* a race the commentator did not see set up (a reload on the gate): set it up now, so the opening, the board and the drop are called */
    if(op.G&&op.G.race&&op.G.race.phase==="gate"&&!fed[raceKey(op.G)]){
      var rc=op.G.race;
      B.feed(op.G,[{e:"race",ri:op.G.ri,key:op.G.rkey,label:op.label||"",kind:rc.kind,n:rc.n,len:rc.o?rc.o.len:0,riders:(op.G.rmap||[]).slice()}]);
    }
    function enter(stage){ st.stage=stage; st.stageAt=st.last; st.phased=false; st.qs=0; try{ if(typeof op.stage==="function") op.stage(stage); }catch(e){} }
    function dropNow(){
      if(st.done||st.cancelled) return;
      st.stage="drop";
      var ok=true; try{ ok=typeof op.drop==="function"?op.drop()!==false:true; }catch(e){ ok=true; }
      if(ok){ st.done=true; if(gate===G2) gate=null; }   /* not ok = the page is busy (a battle plays): asked again at the next tick */
    }
    /* one stage of the call: its commentator phase once, then the line made and spoken, then a hold, then the next stage */
    function callStage(ev,phase,holdLo,holdHi,cap,next){
      var sa=st.last-st.stageAt;
      if(!st.phased){ st.phased=true; st.since=st.last; st.holdMs=holdLo+Math.random()*(holdHi-holdLo); B.phase(phase); }
      var set={}; set[ev]=1; set.lineup_gate=1;
      if(quietNow(set)){ if(!st.qs) st.qs=st.last; } else st.qs=0;
      var made=lineMade(ev,st.since), hold=made?st.holdMs:Tk.noLine;
      if(sa>=cap||(sa>=Tk.stageMin&&st.qs&&st.last-st.qs>=hold)) next();
    }
    var G2={
      state:function(){ return {stage:st.stage,openDone:st.openDone,done:st.done,cancelled:st.cancelled,people:st.people}; },
      people:function(p){ st.people=!!p; },
      cancel:function(){ st.cancelled=true; st.done=true; if(gate===G2) gate=null; },
      /* a tap: the opening still playing = skip it (to the sideways call); the opening over = run the board; during the board = drop now. A double tap
         (two taps within 0.8 s) counts as one: it must not skip the whole show by accident */
      go:function(){
        if(st.done||st.cancelled) return;
        var t=now(); if(st.tapAt&&t-st.tapAt<800) return; st.tapAt=t;
        if(st.stage==="open") enter(st.openDone?"board":"side");
        else dropNow();
      },
      step:function(t){
        if(st.done||st.cancelled) return;
        var dt=t-st.last; if(dt<0) dt=0; if(dt>1500) dt=1500;   /* a gap between ticks (a hidden page, a Menu) is not time spent waiting */
        st.last+=dt;
        if(st.stage==="drop"){ dropNow(); return; }
        if(!st.people&&st.last-st.t0>100000){ dropNow(); return; }   /* a safety net: Auto / watching never waits longer than the longest procedure (about 60 s) plus a margin */
        if(st.stage==="open"){
          var el=st.last-st.t0;
          if(!st.openDone){ if((el>=Tk.openMin&&quietNow(OPENING))||el>=Tk.openMax){ st.openDone=true; st.openAt=st.last; } }
          else {
            var wait=st.last-st.openAt;
            if(!st.people){ if(wait>=Tk.openTail) enter("board"); }
            else if(!st.lineupAt&&wait>=Tk.lineupAfter){ st.lineupAt=st.last; B.phase("lineup"); }   /* the gate-pick talk fills the wait for the person's tap */
          }
        } else if(st.stage==="board") callStage("board_30","board30",Tk.boardHold,Tk.boardHold,Tk.boardCap,function(){ enter("side"); });
        else if(st.stage==="side") callStage("board_sideways","sideways",Tk.sideHoldLo,Tk.sideHoldHi,Tk.sideCap,dropNow);
      }
    };
    gate=G2;
    return G2;
  };
  B.gateState=function(){ return gate?gate.state():null; };

  /* ---------------- start ---------------- */
  if(V){ hookVoice(V); applyVoice(); if(on()) try{ V.ready(); }catch(e){} }   /* the voice engines start now, so the first race is not waiting for them */
  return B;
}

/* the settings kept on this device, read and written without a booth (the Party lobby's Announcers row) */
function stored(){ return cleanSettings(lsGet(KEY)); }
function store(patch){ var c=cleanSettings(Object.assign(stored(),patch||{})); lsSet(KEY,c); return c; }
MX.Booth={create:create,KEY:KEY,SAYKEY:SAYKEY,clean:cleanSettings,stored:stored,store:store,
  /* the typed name -> how to say it, kept on this device (the setup's "How should the announcers say your name?") */
  say:{all:function(){ var m=lsGet(SAYKEY); return m&&typeof m==="object"?m:{}; },
    get:function(name){ var m=lsGet(SAYKEY); return m&&name&&typeof m[name]==="string"?m[name]:""; },
    set:function(name,txt){ if(!name) return; var m=lsGet(SAYKEY); if(!m||typeof m!=="object") m={}; txt=String(txt==null?"":txt).replace(/[^A-Za-z0-9' .-]/g,"").replace(/\s+/g," ").trim().slice(0,30); if(txt) m[String(name).slice(0,40)]=txt; else delete m[name]; lsSet(SAYKEY,m); }}};
if(typeof module!=="undefined"&&module.exports) module.exports=MX.Booth;
})(typeof window!=="undefined"?window:globalThis);
