/* Board Games — synthesized music + sound effects (Web Audio, no audio files).
   API: Sound.music(name) | Sound.sfx(name) | Sound.fromText(msg) | Sound.openPanel() | Sound.mountButton(opts) | Sound.duck(on)
   mountButton opts: {top, right, size} (classic look); with ui/theme.css on the page the button is Luxe and docks in
   .bg-topbar__end ({into: el} = another slot, {dock: false} = float; top/right still move a floating one). */
(function(g){
"use strict";
var AC=g.AudioContext||g.webkitAudioContext;
var KEY={music:"bg_vol_music",sfx:"bg_vol_sfx",mm:"bg_mute_music",sm:"bg_mute_sfx"};
function ld(k,d){ try{ var v=g.localStorage.getItem(k); if(v===null||v==="") return d; var n=parseFloat(v); return isNaN(n)?d:n; }catch(e){ return d; } }
var st={music:ld(KEY.music,0.4),sfx:ld(KEY.sfx,0.8),mm:ld(KEY.mm,0)===1,sm:ld(KEY.sm,0)===1};
function save(){ try{ var L=g.localStorage; L.setItem(KEY.music,String(st.music)); L.setItem(KEY.sfx,String(st.sfx)); L.setItem(KEY.mm,st.mm?"1":"0"); L.setItem(KEY.sm,st.sm?"1":"0"); }catch(e){} }

var ctx=null,musicGain=null,sfxGain=null,noiseBuf=null,want=null,cur=null,timer=null,step=0,nextT=0,unlocked=false;

function ensure(){
  if(!AC) return false;
  if(!ctx){
    try{ ctx=new AC(); }catch(e){ return false; }
    var out=ctx.destination;
    if(ctx.createDynamicsCompressor){ var comp=ctx.createDynamicsCompressor(); comp.connect(ctx.destination); out=comp; }
    musicGain=ctx.createGain(); sfxGain=ctx.createGain();
    musicGain.connect(out); sfxGain.connect(out);
    var len=ctx.sampleRate; noiseBuf=ctx.createBuffer(1,len,ctx.sampleRate);
    var d=noiseBuf.getChannelData(0); for(var i=0;i<len;i++) d[i]=Math.random()*2-1;
    applyVol();
  }
  if(ctx.state==="suspended"&&ctx.resume&&!isHidden()){ try{ ctx.resume(); }catch(e){} }   // never wake the audio while the page/app is in the background
  return true;
}
function isHidden(){ try{ return !!(g.document&&g.document.hidden); }catch(e){ return false; } }
/* a game's announcers (Motocross War: ui/voice.js lowers the music under a spoken line): duck(true) takes the music down about 8 dB, duck(false) brings it back;
   a game that never calls it hears no change */
var duckK=1;
function musicLevel(){ return st.mm?0:st.music*0.55*duckK; }
function duck(on){
  duckK=on?0.4:1;
  if(!ctx||!musicGain) return;
  try{ musicGain.gain.setTargetAtTime(musicLevel(),ctx.currentTime,on?0.08:0.4); }catch(e){}
}
function applyVol(){
  if(!ctx) return; var t=ctx.currentTime;
  musicGain.gain.setTargetAtTime(musicLevel(),t,0.05);
  sfxGain.gain.setTargetAtTime(st.sm?0:st.sfx*0.9,t,0.05);
  if(st.mm) halt(); else run();          // muted music schedules no notes at all; unmuting starts it again
}
function hz(m){ return 440*Math.pow(2,(m-69)/12); }

/* ---------- voices ---------- */
var inSfx=false, sty=null, mul=1;
/* per-game sfx colour: wave, and the register (in whole semitones) the effects sit near */
var STY={trouble:{wave:"square",reg:0},sorry:{wave:"sawtooth",reg:2},monopoly:{wave:"triangle",reg:-1},rummy500:{wave:"triangle",reg:1},risk:{wave:"square",reg:-2},uno:{wave:"square",reg:2},scatter:{wave:"triangle",reg:1}};
/* the effects are written in C major; move them to the parent major key of the song that is playing
   (whole semitones, so they stay on the music's tuning grid and in its key), in the octave nearest the game's register */
var PARENT={major:0,mixo:5,minor:3,dorian:10};
function sfxMul(){
  if(!sty) return 1;
  var th=curTheme, r=sty.reg||0, k=(th&&th.key!=null)?(th.key+(PARENT[th.scale]||0))%12:0;
  while(k-r>6) k-=12; while(r-k>=6) k+=12;
  return Math.pow(2,k/12);
}
function tone(f,t,dur,type,vol,dest,o){
  o=o||{};
  if(inSfx&&sty){
    if(sty.wave&&(type==="square"||type==="triangle")) type=sty.wave;
    if(mul!==1){ f=f*mul; if(o.to){ var o2={}; for(var kk in o) o2[kk]=o[kk]; o2.to=o.to*mul; o=o2; } }
  }
  var osc=ctx.createOscillator(), gn=ctx.createGain();
  osc.type=type||"sine"; osc.frequency.setValueAtTime(f,t);
  if(o.to) osc.frequency.exponentialRampToValueAtTime(o.to,t+dur);
  gn.gain.setValueAtTime(0.0001,t);
  gn.gain.linearRampToValueAtTime(vol,t+(o.a||0.01));
  gn.gain.exponentialRampToValueAtTime(0.0001,t+dur);
  osc.connect(gn); gn.connect(dest); osc.start(t); osc.stop(t+dur+0.05);
}
function noise(t,dur,vol,freq,type,dest){
  var s=ctx.createBufferSource(); s.buffer=noiseBuf;
  var fl=ctx.createBiquadFilter(); fl.type=type||"bandpass"; fl.frequency.value=freq||2000;
  var gn=ctx.createGain(); gn.gain.setValueAtTime(vol,t); gn.gain.exponentialRampToValueAtTime(0.0001,t+dur);
  s.connect(fl); fl.connect(gn); gn.connect(dest); s.start(t,Math.random()*0.5); s.stop(t+dur+0.05);
}

/* ---------- sound effects ---------- */
var SFX={
  tick:function(t,d){ tone(880,t,0.05,"square",0.10,d); },
  click:function(t,d){ tone(660,t,0.06,"triangle",0.14,d); },
  dice:function(t,d){ for(var i=0;i<7;i++){ noise(t+i*0.07+Math.random()*0.02,0.05,0.5,1800+Math.random()*2500,"bandpass",d); tone(220+Math.random()*120,t+i*0.07,0.04,"square",0.05,d); } },
  coin:function(t,d){ tone(988,t,0.09,"square",0.13,d); tone(1319,t+0.08,0.28,"square",0.13,d); },
  pay:function(t,d){ tone(440,t,0.12,"triangle",0.2,d); tone(330,t+0.11,0.2,"triangle",0.2,d); },
  bump:function(t,d){ tone(160,t,0.25,"sine",0.5,d,{to:45}); noise(t,0.12,0.5,500,"lowpass",d); },
  slide:function(t,d){ tone(260,t,0.45,"sawtooth",0.11,d,{to:1100}); noise(t,0.4,0.16,3000,"highpass",d); },
  card:function(t,d){ noise(t,0.09,0.5,5000,"highpass",d); noise(t+0.07,0.07,0.4,4200,"highpass",d); tone(698,t+0.1,0.06,"triangle",0.12,d); },
  bell:function(t,d){ tone(880,t,0.5,"triangle",0.2,d); tone(1320,t,0.4,"sine",0.11,d); tone(1760,t+0.02,0.3,"sine",0.07,d); },
  jail:function(t,d){ tone(120,t,0.55,"square",0.22,d,{to:90}); tone(95,t+0.02,0.55,"sawtooth",0.12,d); },
  win:function(t,d){ [523,659,784,1047,784,1047,1319].forEach(function(f,i){ tone(f,t+i*0.11,i>5?0.6:0.16,"square",0.15,d); }); },
  lose:function(t,d){ [392,330,262,196].forEach(function(f,i){ tone(f,t+i*0.16,0.3,"triangle",0.2,d); }); },
  turn:function(t,d){ tone(660,t,0.08,"sine",0.13,d); tone(880,t+0.07,0.12,"sine",0.13,d); },
  deal:function(t,d){ for(var i=0;i<6;i++){ noise(t+i*0.08,0.05,0.45,4500,"highpass",d); } tone(523,t+0.5,0.06,"triangle",0.1,d); },
  draw:function(t,d){ noise(t,0.07,0.45,5200,"highpass",d); tone(587,t+0.05,0.05,"triangle",0.1,d); },
  discard:function(t,d){ noise(t,0.05,0.5,3000,"bandpass",d); tone(220,t+0.02,0.09,"sine",0.25,d,{to:150}); },
  meld:function(t,d){ tone(523,t,0.12,"triangle",0.18,d); tone(659,t+0.09,0.12,"triangle",0.18,d); tone(784,t+0.18,0.3,"triangle",0.18,d); },
  cannon:function(t,d){ noise(t,0.2,0.9,260,"lowpass",d); tone(95,t,0.32,"sine",0.42,d,{to:38}); noise(t+0.02,0.1,0.5,1600,"bandpass",d); },
  conquer:function(t,d){ [392,523,659,784].forEach(function(f,i){ tone(f,t+i*0.09,0.22,"sawtooth",0.1,d); }); tone(1047,t+0.4,0.5,"square",0.12,d); noise(t+0.4,0.2,0.3,3000,"highpass",d); },
  place:function(t,d){ tone(260,t,0.06,"square",0.12,d,{to:170}); noise(t,0.04,0.35,2000,"bandpass",d); },
  build:function(t,d){ tone(294,t,0.07,"square",0.14,d); tone(440,t+0.08,0.1,"square",0.14,d); noise(t,0.05,0.3,900,"bandpass",d); }
};
/* one action plays one sound: sfx asked for in the same task are batched and only the most important one plays,
   and a long jingle is not started again while it is still playing (e.g. "goes out" followed by the game-over fanfare).
   If the most important one is held that way, the next one in the batch plays instead (two quick Risk conquests
   still click), except while the win fanfare is playing. */
var PRI={tick:0,click:1,card:2,draw:2,discard:2,place:2,deal:3,dice:3,turn:3,build:4,coin:4,pay:4,meld:4,slide:5,bump:5,cannon:5,jail:6,bell:6,conquer:7,lose:8,win:9};
var HOLD={win:1600,lose:900,conquer:900,jail:700};
var pend=null, lastAt={};
function sfx(name){
  if(!AC||st.sm||!SFX[name]) return;
  if(isHidden()) return;                       // background page/app: drop it (resuming here would restart the music unseen)
  if(pend!==null){ if(pend.indexOf(name)<0) pend.push(name); return; }
  pend=[name];
  if(typeof Promise!=="undefined") Promise.resolve().then(playPending); else setTimeout(playPending,0);
}
function held(n,now){ return !!(HOLD[n]&&lastAt[n]&&now-lastAt[n]<HOLD[n]); }
function playPending(){
  var list=pend||[]; pend=null;
  if(!list.length||st.sm||isHidden()) return;
  var now=Date.now();
  list.sort(function(a,b){ return (PRI[b]||0)-(PRI[a]||0); });
  if(held(list[0],now)&&list[0]==="win") return;
  var name=list.filter(function(n){ return !held(n,now); })[0];
  if(!name) return;
  if(!ensure()) return;
  lastAt[name]=now;
  try{ inSfx=true; sty=STY[styleName]||null; mul=sfxMul(); SFX[name](ctx.currentTime+0.01,sfxGain); }catch(e){} inSfx=false;
}
function fromText(m){
  m=String(m||"");
  if(/wins!|wins the game|🏆/i.test(m)) return sfx("win");
  if(/bankrupt/i.test(m)) return sfx("lose");
  if(/slid/i.test(m)) return sfx("slide");
  if(/sent home|bumped|SORRY/i.test(m)) return sfx("bump");
  if(/to Jail|goes to Jail|3 doubles/i.test(m)) return sfx("jail");
  if(/passes GO|landed on GO|collects/i.test(m)) return sfx("bell");
  if(/ says UNO!/i.test(m)) return sfx("bell");
  if(/ catches .* didn't say UNO/i.test(m)) return sfx("bump");
  if(/ challenges .*'s /i.test(m)) return sfx("bump");
  if(/FLIP!|knocked out by the Mercy/i.test(m)) return sfx(/FLIP/.test(m)?"dice":"lose");
  if(/Direction reversed| is skipped|are skipped|Everyone else is skipped/i.test(m)) return sfx("slide");
  if(/ plays [A-Z][a-z]+ |^[A-Za-z0-9 ]+ plays /.test(m)&&!/armies/.test(m)) return sfx("card");
  if(/ draws \d+ cards?| draws a card| keeps the card/i.test(m)) return sfx("draw");
  if(/ picks .* for Color Roulette| passes their hand| swaps hands/i.test(m)) return sfx("deal");
  if(/conquers|captures .* headquarters/i.test(m)) return sfx("conquer");
  if(/eliminates/i.test(m)) return sfx("lose");
  if(/ attacks .* rolls /i.test(m)) return sfx("cannon");
  if(/trades in a set/i.test(m)) return sfx("meld");
  if(/draws a territory card/i.test(m)) return sfx("card");
  if(/ places \d+ (armies|army)| places an army| claims | moves \d+ armies? (into|from)| moves 1 army (into|from)| shifts \d+ arm(y|ies) from/i.test(m)) return sfx("place");
  /* Rummy 500 says "You draw / take / meld / lay off / discard / go out" for the single human player */
  if(/goes out|\bgo out!|wins the round/i.test(m)) return sfx("win");
  if(/\bmelds?\b|\blays? off\b|laid off/i.test(m)) return sfx("meld");
  if(/\bdiscards?\b(?! pile)/i.test(m)) return sfx("discard");
  if(/\btakes? .* from the discard|\bdraws? from the (stock|pile)/i.test(m)) return sfx("draw");
  if(/deals|shuffl/i.test(m)) return sfx("deal");
  if(/builds/i.test(m)) return sfx("build");
  if(/buys|Trade done| for \$/i.test(m)) return sfx("coin");
  if(/Bank pays you|(^|[.:] )(Collect|Receive) \$|you get \$|You inherit|tax refund/.test(m)) return sfx("coin");   // money coming in (Chance / Chest)
  if(/\bpays\b|\bTax\b|\brent\b|\bfine\b/i.test(m)&&!/no rent/i.test(m)) return sfx("pay");                      // whole words: not "Laurent", "Josefine", "rental"
}

/* ---------- music: a small composer makes 10 different songs per game; a shuffled playlist plays them ---------- */
var styleName="menu";
function mulberry(seed){ var a=seed>>>0; return function(){ a=(a+0x6D2B79F5)>>>0; var t=a; t=Math.imul(t^(t>>>15),t|1); t^=t+Math.imul(t^(t>>>7),t|61); return ((t^(t>>>14))>>>0)/4294967296; }; }
function hashStr(x){ var h=2166136261; for(var i=0;i<x.length;i++){ h^=x.charCodeAt(i); h=Math.imul(h,16777619); } return h>>>0; }
function pickOf(r,a){ return a[Math.floor(r()*a.length)]; }
var SCALES={major:[0,2,4,5,7,9,11],minor:[0,2,3,5,7,8,10],mixo:[0,2,4,5,7,9,10],dorian:[0,2,3,5,7,9,10]};
function d2s(sc,d){ var n=sc.length; return sc[((d%n)+n)%n]+12*Math.floor(d/n); }
var KEYS=[48,50,52,53,55,57,58];
function P(s){ return s.trim().split(/\s+/).map(function(x){ return x==="."?null:parseInt(x,10); }); }
function R8(p){ var a=[]; for(var b=0;b<4;b++) for(var j=0;j<8;j++) a.push(!!p[j]); return a; }
function barsB(roots,pat){ var a=[]; for(var b=0;b<4;b++) for(var j=0;j<8;j++) a.push(pat[j]===null?null:roots[b]+pat[j]); return a; }
/* the calm menu loop (hand-written) */
var THEMES={ menu:{ bpm:84,len:32,swing:0,leadRoot:72,leadWave:"sine",leadVol:0.11,leadLen:2,
  lead:P("0 4 7 12 7 4 0 4  5 9 12 17 12 9 5 9  7 11 14 19 14 11 7 11  4 7 12 16 12 7 4 7"),
  bassRoot:48,bass:barsB([0,5,7,4],[0,null,null,null,7,null,null,null]),bassVol:0.16 } };

var STYLES={
  trouble:{ scales:["major","major","mixo"], bpm:[112,140], swing:0, sev:false, leadVol:0.075, waves:["square","triangle","square"], bassKind:"bounce",
    progs:[[0,4,5,3],[0,5,3,4],[0,3,4,3],[5,3,0,4],[0,2,3,4],[0,3,0,4],[3,4,0,0],[0,4,3,4]],
    bridge:[[3,4,0,5],[5,4,3,4],[1,4,0,0],[3,0,4,0]],
    rhythms:[[1,0,1,1,1,0,1,1],[1,1,1,0,1,1,1,0],[1,0,1,0,1,1,1,0],[1,1,0,1,1,0,1,1]],
    chordSteps:[0,4],
    drums:[{kick:[1,0,0,0,1,0,0,0],hat:[0,0,1,0,0,0,1,0],hv:0.1},{kick:[1,0,0,1,1,0,0,0],hat:[1,0,1,0,1,0,1,0],hv:0.07},{kick:[1,0,0,0,1,0,0,1],snare:[0,0,1,0,0,0,1,0],hat:[0,1,0,1,0,1,0,1],hv:0.06}],
    titles:["Pop Goes the Die","Six to Start","Peg Parade","Home Stretch","Bump and Run","Lucky Six Shuffle","Dome Sweet Dome","Race to Home","Pop-o-matic Polka","Peg Party"] },
  sorry:{ scales:["minor","minor","dorian"], bpm:[120,150], swing:0, sev:false, leadVol:0.055, waves:["sawtooth","square","sawtooth"], bassKind:"pulse",
    progs:[[0,5,2,6],[0,3,4,0],[0,6,5,4],[0,5,3,4],[0,2,6,5],[0,4,5,3],[0,3,6,2],[0,6,3,4]],
    bridge:[[3,4,0,0],[5,6,0,0],[2,3,4,4],[3,6,2,4]],
    rhythms:[[1,0,1,0,1,0,1,1],[1,1,0,1,1,0,1,0],[1,0,1,1,0,1,1,0],[1,0,0,1,1,0,1,0]],
    chordSteps:[0,3,6],
    drums:[{kick:[1,0,0,0,1,0,0,1],snare:[0,0,1,0,0,0,1,0],hat:[1,1,1,1,1,1,1,1],hv:0.05},{kick:[1,0,0,1,0,0,1,0],snare:[0,0,0,0,1,0,0,0],hat:[0,1,0,1,0,1,0,1],hv:0.06},{kick:[1,0,1,0,1,0,1,0],snare:[0,1,0,1,0,1,0,1],hat:[1,0,1,0,1,0,1,0],hv:0.05}],
    titles:["Sorry Not Sorry","Slide Into Home","Wait For It","Bumped Again","The Long Slide","Card Shark Shuffle","Back to Start","Safety Zone Stomp","Eleven Swap","Pawn Takes Revenge"] },
  scatter:{ scales:["major","mixo","major","dorian"], bpm:[104,130], swing:0.2, sev:true, leadVol:0.1, waves:["triangle","square","triangle"], bassKind:"walk",
    progs:[[0,5,3,4],[0,3,1,4],[0,4,5,3],[1,4,0,5],[0,2,3,4],[0,6,3,4],[0,3,4,0],[5,1,4,0]],
    bridge:[[3,4,0,0],[1,4,3,0],[5,2,1,4],[3,5,4,0]],
    rhythms:[[1,0,1,1,0,1,1,0],[1,1,0,1,0,1,0,1],[1,0,0,1,1,0,1,1],[1,0,1,0,1,1,0,1]],
    chordSteps:[0,3,6],
    drums:[{kick:[1,0,0,0,1,0,0,0],snare:[0,0,1,0,0,0,1,0],sv:0.06,hat:[1,0,1,1,1,0,1,1],hv:0.04},{kick:[1,0,0,1,0,0,1,0],snare:[0,0,0,0,1,0,0,0],sv:0.07,hat:[1,1,1,1,1,1,1,1],hv:0.03},{kick:[1,0,1,0,1,0,1,0],snare:[0,1,0,1,0,1,0,1],sv:0.05,hat:[0,1,0,1,0,1,0,1],hv:0.045}],
    titles:["Starts With S","Brain Storm Boogie","Nobody Else Wrote That","Beat the Clock","Duplicate Blues","Category Is…","Thinking Out Loud","Scatter Shuffle","Letter Roll Jazz","Unique Answer Swing"] },
  uno:{ scales:["major","mixo","major","dorian"], bpm:[118,138], swing:0.1, sev:false, leadVol:0.09, waves:["square","triangle","square"], bassKind:"walk",
    progs:[[0,3,4,0],[0,4,5,3],[0,5,3,4],[0,3,0,4],[0,2,3,4],[0,6,3,4],[0,4,3,5],[0,3,5,4]],
    bridge:[[3,4,0,0],[5,4,3,0],[2,3,4,4],[3,5,4,0]],
    rhythms:[[1,0,1,1,1,0,1,1],[1,1,0,1,1,0,1,0],[1,0,1,0,1,1,0,1],[1,1,1,0,1,0,1,1]],
    chordSteps:[0,3,6],
    drums:[{kick:[1,0,0,0,1,0,0,0],snare:[0,0,1,0,0,0,1,0],sv:0.08,hat:[1,1,1,1,1,1,1,1],hv:0.04},{kick:[1,0,0,1,0,0,1,0],snare:[0,0,1,0,0,1,0,1],sv:0.08,hat:[1,0,1,0,1,0,1,0],hv:0.05},{kick:[1,0,1,0,1,0,1,0],snare:[0,1,0,1,0,1,0,1],sv:0.06,hat:[0,1,0,1,0,1,0,1],hv:0.045}],
    titles:["Wild Card Boogie","Draw Four Shuffle","Skip a Beat","Reverse Psychology","Last Card Standing","Color Me Lucky","Two to Draw","Say It First","Match Point Stomp","Flip the Table"] },
  risk:{ scales:["minor","dorian","minor"], bpm:[96,126], swing:0, sev:false, leadVol:0.075, waves:["square","sawtooth","square"], bassKind:"pulse",
    progs:[[0,5,3,4],[0,6,5,4],[0,3,4,0],[0,2,6,5],[0,5,6,4],[0,4,3,6],[0,3,6,4],[0,6,2,4]],
    bridge:[[3,4,0,0],[5,6,0,4],[2,3,4,4],[6,5,4,4]],
    rhythms:[[1,0,1,1,1,0,1,1],[1,0,0,1,1,0,1,0],[1,1,0,1,0,1,1,0],[1,0,1,0,1,1,0,1]],
    chordSteps:[0,3,6],
    drums:[{kick:[1,0,0,0,1,0,0,0],snare:[0,0,1,0,0,0,1,1],sv:0.09,hat:[1,0,1,0,1,0,1,0],hv:0.04},{kick:[1,0,0,1,0,0,1,0],snare:[0,0,1,0,0,1,1,1],sv:0.1,hat:[0,0,0,0,0,0,0,0],hv:0},{kick:[1,0,1,0,1,0,1,0],snare:[0,1,0,1,0,1,0,1],sv:0.07,hat:[1,1,1,1,1,1,1,1],hv:0.03}],
    titles:["Continental Drift","Border Dispute","March on Kamchatka","The Siam Gambit","Long Campaign","Cavalry at Dawn","Artillery Waltz","Sea Lanes","Hold the Chokepoint","Total Conquest"] },
  rummy500:{ scales:["major","dorian","mixo","major"], bpm:[88,112], swing:0.22, sev:true, leadVol:0.12, waves:["triangle","sine","triangle"], bassKind:"walk",
    progs:[[0,5,1,4],[1,4,0,5],[0,2,3,4],[5,1,4,0],[0,3,1,4],[2,5,1,4],[0,5,3,4],[3,4,2,5]],
    bridge:[[3,2,1,4],[1,4,3,0],[5,2,1,4],[3,4,0,5]],
    rhythms:[[1,0,1,0,1,0,1,1],[1,0,0,1,1,0,1,0],[1,1,0,1,0,1,0,1],[1,0,1,1,0,0,1,0]],
    chordSteps:[0,3,6],
    drums:[{snare:[0,0,0,0,1,0,0,0],sv:0.07,hat:[1,0,1,1,1,0,1,1],hv:0.045},{kick:[1,0,0,0,0,0,0,0],kv:0.18,hat:[1,0,1,0,1,0,1,0],hv:0.05},{snare:[0,0,0,1,0,0,0,1],sv:0.06,hat:[1,1,1,1,1,1,1,1],hv:0.03}],
    titles:["Ace High Lounge","Shuffle and Deal","Full House Slow Dance","Run of Luck","Discard Blues","Going Out Swing","Wild Card Waltz","Joker's Lullaby","Five Hundred Nights","Meld Into Morning"] },
  monopoly:{ scales:["major","mixo","major"], bpm:[96,120], swing:0.3, sev:true, leadVol:0.13, waves:["triangle","sine","triangle"], bassKind:"walk",
    progs:[[0,5,1,4],[1,4,0,5],[0,3,1,4],[0,5,3,4],[2,5,1,4],[0,2,3,4],[3,4,2,5],[0,1,4,0]],
    bridge:[[3,2,1,4],[5,1,4,0],[1,4,3,0],[3,4,0,5]],
    rhythms:[[1,0,1,0,1,1,0,1],[1,0,0,1,1,0,1,0],[1,0,1,1,0,1,0,1],[1,1,0,1,0,1,1,0]],
    chordSteps:[0,5],
    drums:[{kick:[1,0,0,0,0,0,0,0],kv:0.25,snare:[0,0,0,1,0,0,0,1],sv:0.1,hat:[1,0,1,0,1,0,1,0],hv:0.06},{kick:[1,0,0,0,1,0,0,0],kv:0.22,hat:[1,1,1,1,1,1,1,1],hv:0.04},{snare:[0,0,0,0,1,0,0,0],sv:0.09,hat:[1,0,1,0,1,0,1,0],hv:0.07}],
    titles:["Boardwalk Blues","Go Collect Two Hundred","Park Place Swing","Rent Is Due","Free Parking Jazz","Railroad Rag","Hotel Lobby","Chance Encounter","Community Chest Cha-Cha","Pass Go Boogie"] },
  /* the hub (the opening screen): a slow late-night lounge, brushes and walking bass under a soft lead */
  lobby:{ scales:["major","dorian","major","mixo"], bpm:[80,98], swing:0.26, sev:true, leadVol:0.1, waves:["sine","triangle","sine"], bassKind:"walk",
    progs:[[0,5,1,4],[1,4,0,5],[2,5,1,4],[0,3,1,4],[3,4,2,5],[0,2,1,4],[0,5,3,4],[5,1,4,0]],
    bridge:[[3,2,1,4],[5,1,4,0],[3,4,0,5],[1,4,3,0]],
    rhythms:[[1,0,1,0,1,0,0,1],[1,0,0,1,0,1,0,0],[1,0,1,1,0,0,1,0],[1,0,0,0,1,0,1,0]],
    chordSteps:[0,3,6],
    drums:[{snare:[0,0,0,0,1,0,0,0],sv:0.05,hat:[1,0,1,1,1,0,1,1],hv:0.035},{kick:[1,0,0,0,0,0,0,0],kv:0.16,hat:[1,0,1,0,1,0,1,0],hv:0.04},{snare:[0,0,0,1,0,0,0,1],sv:0.045,hat:[1,1,1,1,1,1,1,1],hv:0.025}],
    titles:["Midnight Lobby","Velvet Rope","Gold Leaf Lounge","Felt and Brass","After Hours Parlor","Lamplight Shuffle","House Rules","Starlit Table","Last Call Serenade","Game Night Glow"] }
};
function melody(r,sc,prog,rh,resolve){
  var out=[], prev=2+Math.floor(r()*5), LO=-2, HI=9;
  for(var b=0;b<4;b++){
    var ch=prog[b];
    for(var st2=0;st2<8;st2++){
      if(!rh[st2]){ out.push(null); continue; }
      var d;
      if(st2===0||st2===4){
        var c=[]; [0,2,4].forEach(function(k){ for(var o=-1;o<=1;o++) c.push(ch+k+7*o); });
        c=c.filter(function(x){ return x>=LO&&x<=HI; });
        c.sort(function(a,z){ return Math.abs(a-prev)-Math.abs(z-prev); });
        d=c[Math.min(c.length-1,Math.floor(r()*2))];
      } else {
        var stp=[-2,-1,-1,0,1,1,2][Math.floor(r()*7)]; d=Math.max(LO,Math.min(HI,prev+stp));
      }
      out.push(d); prev=d;
    }
  }
  if(resolve){ for(var i=out.length-1;i>=out.length-8;i--){ if(out[i]!=null){ var tg=[0,2,4,7]; tg.sort(function(a,z){ return Math.abs(a-prev)-Math.abs(z-prev); }); out[i]=tg[0]; break; } } }
  return out;
}
function compose(game,idx){
  var S=STYLES[game], r=mulberry(hashStr(game)*131+idx*977+7);
  var scn=pickOf(r,S.scales), sc=SCALES[scn], key=pickOf(r,KEYS), bpm=Math.round(S.bpm[0]+r()*(S.bpm[1]-S.bpm[0]));
  var progA=pickOf(r,S.progs), progB=pickOf(r,S.bridge), rhA=pickOf(r,S.rhythms), rhB=pickOf(r,S.rhythms), wave=pickOf(r,S.waves), dr=pickOf(r,S.drums);
  var mA=melody(r,sc,progA,rhA,true), mB=melody(r,sc,progB,rhB,false), mA2=mA.slice(0,24).concat(melody(r,sc,progA,rhA,true).slice(24));
  var secs=[[progA,mA],[progA,mA],[progB,mB],[progA,mA2]];
  var lead=[],bass=[],chord=[],kick=[],snare=[],hat=[];
  secs.forEach(function(sec,si){
    var prog=sec[0], mel=sec[1];
    for(var b=0;b<4;b++){
      var ch=prog[b], nextCh=(b<3?prog[b+1]:(si<3?secs[si+1][0][0]:progA[0]));
      var root=key-12+d2s(sc,ch), third=key-12+d2s(sc,ch+2), fifth=key-12+d2s(sc,ch+4), nroot=key-12+d2s(sc,nextCh);
      var cn=[0,2,4].concat(S.sev?[6]:[]).map(function(k){ return key+12+d2s(sc,ch+k); });
      for(var j=0;j<8;j++){
        var m=mel[b*8+j]; lead.push(m==null?null:key+24+d2s(sc,m));
        var bv=null;
        if(S.bassKind==="bounce") bv=[root,null,root+7,null,root,null,root+7,null][j];
        else if(S.bassKind==="pulse") bv=[root,root,null,root+12,root,null,root+7,null][j];
        else bv=[root,null,third,null,fifth,null,(nroot-1),null][j];
        bass.push(bv===undefined?null:bv);
        chord.push(S.chordSteps.indexOf(j)>=0?cn:null);
        kick.push(!!(dr.kick&&dr.kick[j])); snare.push(!!(dr.snare&&dr.snare[j])); hat.push(!!(dr.hat&&dr.hat[j]));
      }
    }
  });
  return { title:S.titles[idx], key:key, scale:scn, bpm:bpm, len:128, swing:S.swing, leadRoot:0, leadWave:wave, leadVol:S.leadVol*(0.9+r()*0.25), leadLen:(game==="sorry"?0.6:game==="monopoly"?1.1:0.9),
    lead:lead, bassRoot:0, bass:bass, bassVol:game==="monopoly"?0.24:0.2, chordRoot:0, chord:chord, chordVol:game==="monopoly"?0.06:0.045,
    kick:kick, snare:snare, hat:hat, hatVol:dr.hv||0.07, kickVol:dr.kv||0.5, snareVol:dr.sv||0.26 };
}
var songCache={};
function getSongs(game){ if(!songCache[game]){ var a=[]; for(var i=0;i<10;i++) a.push(compose(game,i)); songCache[game]=a; } return songCache[game]; }

function playStep(th,i,t,dur){
  var d=musicGain, v;
  v=th.lead[i]; if(v!=null) tone(hz(th.leadRoot+v),t,dur*th.leadLen,th.leadWave,th.leadVol,d);
  v=th.bass[i]; if(v!=null) tone(hz(th.bassRoot+v),t,dur*1.6,th.bassWave||"triangle",th.bassVol||0.2,d);
  v=th.chord&&th.chord[i]; if(v) v.forEach(function(n){ tone(hz(th.chordRoot+n),t,dur*1.2,"triangle",th.chordVol||0.06,d); });
  if(th.kick&&th.kick[i]) tone(120,t,0.14,"sine",th.kickVol||0.5,d,{to:45});
  if(th.snare&&th.snare[i]) noise(t,0.1,th.snareVol||0.28,1800,"bandpass",d);
  if(th.hat&&th.hat[i]) noise(t,0.04,th.hatVol||0.1,7000,"highpass",d);
}
var game=null, plist=[], pidx=0, curTheme=null, playlistMode=false;
function lastKey(gm){ return "bg_last_"+gm; }
function shuffled(n,avoid){ var a=[],i; for(i=0;i<n;i++) a.push(i); for(i=n-1;i>0;i--){ var j=Math.floor(Math.random()*(i+1)); var t=a[i]; a[i]=a[j]; a[j]=t; } if(n>1&&a[0]===avoid){ var t2=a[0]; a[0]=a[1]; a[1]=t2; } return a; }
function nextSong(){
  if(!playlistMode) return;
  pidx++; if(pidx>=plist.length){ plist=shuffled(10,plist[plist.length-1]); pidx=0; }
  curTheme=getSongs(game)[plist[pidx]]; step=0; try{ g.localStorage.setItem(lastKey(game),String(plist[pidx])); }catch(e){}
  refreshPanel();
}
function pump(){
  if(!curTheme||!ctx) return;
  while(nextT<ctx.currentTime+0.4){
    var th=curTheme, dur=60/th.bpm/2;
    var i=step%th.len, t=nextT+((i%2)?th.swing*dur:0);
    playStep(th,i,t,dur); nextT+=dur; step++;
    if(playlistMode&&step>=th.len*2) nextSong();      // each song plays twice, then the next one starts
  }
}
function halt(){ if(timer){ clearInterval(timer); timer=null; } }
function stopMusic(){ halt(); cur=null; }
function run(){            // (re)start the note scheduler for the current song; never while the music is muted
  if(!ctx||!cur||timer||st.mm) return;
  if(nextT<ctx.currentTime+0.05){ step-=step%8; nextT=ctx.currentTime+0.15; }   // after a pause: start again cleanly at the top of the bar
  timer=setInterval(pump,80); pump();
}
function setupTheme(name){
  if(STYLES[name]){
    playlistMode=true; game=name;
    var last=parseInt(ld(lastKey(name),-1),10); if(isNaN(last)) last=-1;
    plist=shuffled(10,last); pidx=0; curTheme=getSongs(name)[plist[0]];
    try{ g.localStorage.setItem(lastKey(name),String(plist[0])); }catch(e){}
  } else { playlistMode=false; game=null; curTheme=THEMES.menu; }
}
function begin(){
  if(!want){ stopMusic(); return; }
  if(cur===want&&(timer||st.mm)) return;
  stopMusic(); setupTheme(want);
  cur=want; step=0; nextT=ctx.currentTime+0.15; run(); refreshPanel();
}
function music(name){ want=name||null; styleName=(name&&(STYLES[name]||name==="menu"))?name:"menu"; if(!AC) return; if(unlocked&&ensure()) begin(); }
function skip(){ if(playlistMode&&cur) nextSong(); }          // start a different song (used at the start of every game)
function nowPlaying(){ return (playlistMode&&curTheme)?curTheme.title:""; }

function unlock(){
  if(unlocked) return; unlocked=true;
  ["pointerdown","keydown","touchstart","click"].forEach(function(ev){ try{ g.document.removeEventListener(ev,unlock,true); }catch(e){} });
  if(ensure()&&want) begin();
}
/* In the Board Games app (the Fire TV app's window.AndroidTV, the phone app's window.BoardGamesApp) the WebView lets audio start
   without a tap, so the music starts with the page. A browser still waits for the first tap or key, as before. */
function appStart(){
  if(unlocked||isHidden()||!(g.AndroidTV||g.BoardGamesApp)||!ensure()) return;
  var go=function(){ if(!unlocked&&ctx&&ctx.state==="running") unlock(); };
  go();
  if(!unlocked&&ctx.resume){ try{ var p=ctx.resume(); if(p&&p.then) p.then(go,function(){}); }catch(e){} }
}
if(g.document){
  ["pointerdown","keydown","touchstart","click"].forEach(function(ev){ g.document.addEventListener(ev,unlock,true); });
  g.document.addEventListener("visibilitychange",function(){ if(!ctx){ appStart(); return; } try{ if(g.document.hidden){ ctx.suspend&&ctx.suspend(); } else { ctx.resume&&ctx.resume(); appStart(); } }catch(e){} });
  appStart();
}

/* ---------- settings panel + floating button ---------- */
/* Midnight Luxe: when ui/theme.css is on the page, the button and the panel are built with its bg- classes (ink panel, gold
   hairlines, the ui fonts, 44 px targets / 72 px at 1080p TV, no emoji); the ids, keys, focus trap and behaviour are the same.
   The button docks into the page's .bg-topbar__end (before the menu knob) or floats where that slot would be.
   With ui/ui.js (window.BGUI) the panel also carries the "Reduce effects" switch: BGUI.effects, default off = full effects,
   saved per device under "bgui.effects", so every game and Party Mode get the setting in the same place. */
var SVG_SND='<svg class="bg-ico" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" fill="currentColor" stroke-width="1.5"/><path d="M15.5 9a4.2 4.2 0 0 1 0 6M18.2 6.5a8 8 0 0 1 0 11"/></svg>';
var SVG_MUTE='<svg class="bg-ico" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" fill="currentColor" stroke-width="1.5"/><path d="M16 9.5l5 5M21 9.5l-5 5"/></svg>';
function luxe(){ try{ var d=g.document; return !!(d&&g.getComputedStyle&&g.getComputedStyle(d.documentElement).getPropertyValue("--gold-200").trim()); }catch(e){ return false; } }
function fxApi(){ var B=g.BGUI; return (B&&B.effects&&typeof B.effects.set==="function"&&typeof B.effects.get==="function")?B.effects:null; }
var panelKeys=null, panelTrap=null, panelBack=null;
function closePanel(){
  var d=g.document, o=d.getElementById("bgSoundPanel");
  if(panelKeys){ g.removeEventListener("keydown",panelKeys,true); d.removeEventListener("focusin",panelTrap,true); panelKeys=panelTrap=null; }
  if(!o) return;
  o.remove();
  var b=panelBack; panelBack=null;      // focus goes back to what had it (or to what the page focused while the window was open)
  try{ if(b&&b!==d.body&&b.isConnected!==false&&b.focus) b.focus(); }catch(e){}
  if(!d.activeElement||d.activeElement===d.body){ var sb=d.getElementById("bgSndBtn"); if(sb) try{ sb.focus(); }catch(e){} }
}
function setVol(which,v){ v=Math.max(0,Math.min(1,v)); if(which==="m") st.music=v; else st.sfx=v; save(); applyVol(); refreshPanel(); }
/* the Luxe button's icon follows the mute state, and is re-rendered ONLY when that state changes: the first tap of a page unlocks
   audio inside its pointerdown (unlock -> begin -> refreshPanel), and replacing the svg under the finger there cancelled that
   tap's click, so the first tap on the icon started the music instead of opening the panel */
function sndIcon(sb){ var m=(st.mm&&st.sm)?"1":"0"; if(sb.getAttribute("data-muted")===m) return; sb.setAttribute("data-muted",m); sb.innerHTML=m==="1"?SVG_MUTE:SVG_SND; }
function refreshPanel(){
  var d=g.document;
  var sb=d.getElementById("bgSndBtn"); if(sb&&sb.classList&&sb.classList.contains("bg-sndbtn")) sndIcon(sb);
  var rm=d.getElementById("bgRm"), rs=d.getElementById("bgRs"); if(!rm||!rs) return;
  rm.value=Math.round(st.music*100); rs.value=Math.round(st.sfx*100);
  d.getElementById("bgVm").textContent=Math.round(st.music*100)+"%"; d.getElementById("bgVs").textContent=Math.round(st.sfx*100)+"%";
  var lx=rm.classList&&rm.classList.contains("bg-range"), mm=d.getElementById("bgMm"), ms=d.getElementById("bgMs");
  if(lx){
    rm.style.setProperty("--v",rm.value+"%"); rs.style.setProperty("--v",rs.value+"%");
    mm.textContent=st.mm?"Music off":"Music on"; ms.textContent=st.sm?"Effects off":"Effects on";
    mm.setAttribute("aria-pressed",st.mm?"false":"true"); ms.setAttribute("aria-pressed",st.sm?"false":"true");
  } else { mm.textContent=st.mm?"🔇 Music off":"🎵 Music on"; ms.textContent=st.sm?"🔇 Effects off":"🔊 Effects on"; }
  var np=d.getElementById("bgNow"); if(np) np.textContent=lx?(nowPlaying()?("Now playing: "+nowPlaying()):"Menu music"):(nowPlaying()?("♪ Now playing: "+nowPlaying()):"♪ Menu music");
  var fe=d.getElementById("bgFx"), F=fxApi();
  if(fe&&F){ var red=F.get()==="reduced"; if(fe.getAttribute("role")==="switch") fe.setAttribute("aria-checked",red?"true":"false"); else fe.textContent="✨ Reduce effects: "+(red?"on":"off"); }
}
function openPanel(){
  var d=g.document; closePanel();
  var back=d.activeElement;
  var ov=d.createElement("div"); ov.id="bgSoundPanel";
  var F=fxApi();
  if(luxe()){
    ov.className="bg-sound"; ov.setAttribute("role","dialog"); ov.setAttribute("aria-modal","true"); ov.setAttribute("aria-labelledby","bgSndTitle");
    var vol=function(label,idr,idv,what){ return '<div class="bg-sound__vol"><div class="bg-sound__label"><span>'+label+'</span><span id="'+idv+'" class="bg-sound__val"></span></div>'+
      '<div class="bg-sound__slide"><button type="button" data-a="'+idr+'-" class="bg-btn bg-btn--icon" aria-label="'+what+' quieter">−</button><input id="'+idr+'" class="bg-range" type="range" min="0" max="100" step="5" aria-label="'+label+'"><button type="button" data-a="'+idr+'+" class="bg-btn bg-btn--icon" aria-label="'+what+' louder">+</button></div></div>'; };
    ov.innerHTML='<div class="bg-sound__card"><div class="bg-sound__head"><span class="bg-eyebrow">Settings</span><h2 class="bg-sound__title" id="bgSndTitle">'+(F?"Sound and effects":"Sound")+'</h2><div id="bgNow" class="bg-sound__now"></div></div>'+
      vol("Music volume","bgRm","bgVm","Music")+vol("Sound-effects volume","bgRs","bgVs","Sound effects")+
      '<div class="bg-sound__row"><button type="button" id="bgMm" class="bg-btn bg-btn--secondary"></button><button type="button" id="bgMs" class="bg-btn bg-btn--secondary"></button><button type="button" id="bgNext" class="bg-btn bg-btn--ghost">Next song</button><button type="button" id="bgTest" class="bg-btn bg-btn--ghost">Test</button></div>'+
      (F?'<div class="bg-sound__fx bg-rows"><button type="button" id="bgFx" class="bg-row" role="switch" aria-checked="false"><span class="bg-row__main"><span class="bg-row__title">Reduce effects</span><span class="bg-row__desc">Calmer background motion for slower devices. Saved on this device.</span></span><span class="bg-toggle"></span></button></div>':'')+
      '<button type="button" id="bgDone" class="bg-btn bg-btn--primary bg-btn--block bg-sound__done">Done</button></div>';
  } else {
  ov.style.cssText="position:fixed;inset:0;z-index:2147483000;background:rgba(6,10,26,.9);display:flex;align-items:center;justify-content:center;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;color:#eef2ff;padding:16px";
  var fs="clamp(17px,3vh,30px)";
  var btn="font-size:"+fs+";font-weight:800;color:#fff;background:#2b7be0;border:3px solid #2b7be0;border-radius:14px;padding:.45em .9em;cursor:pointer";
  var row=function(label,idr,idv){ return '<div style="margin:1.2em 0"><div style="font-size:'+fs+';font-weight:800;margin-bottom:.4em">'+label+' <span id="'+idv+'" style="color:#ffd86b"></span></div>'+
      '<div style="display:flex;align-items:center;gap:.6em"><button data-a="'+idr+'-" style="'+btn+'">−</button><input id="'+idr+'" type="range" min="0" max="100" step="5" style="flex:1;height:2.4em"><button data-a="'+idr+'+" style="'+btn+'">+</button></div></div>'; };
  ov.innerHTML='<div style="background:#16203f;border:2px solid #39498a;border-radius:22px;padding:1.4em 1.6em;width:min(92vw,720px);max-height:92vh;overflow:auto">'+
    '<div style="font-size:calc('+fs+' * 1.3);font-weight:900">🔊 Sound settings</div>'+
    '<div id="bgNow" style="margin-top:.5em;color:#ffd86b;font-size:'+fs+';font-weight:700"></div>'+
    row("🎵 Music volume","bgRm","bgVm")+row("🔊 Sound-effects volume","bgRs","bgVs")+
    '<div style="display:flex;flex-wrap:wrap;gap:.6em;margin-top:.4em"><button id="bgMm" style="'+btn+';background:#2a3663;border-color:#3a4a7e"></button><button id="bgMs" style="'+btn+';background:#2a3663;border-color:#3a4a7e"></button><button id="bgNext" style="'+btn+';background:#6a2bd0;border-color:#6a2bd0">⏭ Next song</button><button id="bgTest" style="'+btn+';background:#27a758;border-color:#27a758">▶ Test</button></div>'+
    (F?'<div style="margin-top:.6em"><button id="bgFx" style="'+btn+';width:100%;background:#2a3663;border-color:#3a4a7e"></button></div>':'')+
    '<button id="bgDone" style="'+btn+';width:100%;margin-top:1.2em">Done</button></div>';
  }
  d.body.appendChild(ov);
  function on(id,fn){ var e=d.getElementById(id); if(e) e.onclick=fn; }
  d.getElementById("bgRm").oninput=function(){ setVol("m",this.value/100); };
  d.getElementById("bgRs").oninput=function(){ setVol("s",this.value/100); };
  Array.prototype.forEach.call(ov.querySelectorAll("button[data-a]"),function(b){ b.onclick=function(){ var a=b.getAttribute("data-a"); var up=a.slice(-1)==="+"; if(a.indexOf("bgRm")===0) setVol("m",st.music+(up?0.1:-0.1)); else { setVol("s",st.sfx+(up?0.1:-0.1)); sfx("coin"); } }; });
  on("bgMm",function(){ st.mm=!st.mm; save(); applyVol(); refreshPanel(); });
  on("bgMs",function(){ st.sm=!st.sm; save(); applyVol(); refreshPanel(); });
  on("bgTest",function(){ unlock(); ensure(); sfx("dice"); setTimeout(function(){ sfx("coin"); },600); });
  on("bgNext",function(){ unlock(); skip(); refreshPanel(); });
  on("bgFx",function(){ var E=fxApi(); if(E) E.set(E.get()==="reduced"?"full":"reduced"); refreshPanel(); });
  on("bgDone",closePanel);
  /* remote / keyboard: Up/Down move between the controls (they must NOT change a slider), Left/Right adjust a slider or move along a row
     of buttons, Back closes the window. The window is modal: keys are taken at the window level and focus is kept inside it,
     so a page that focuses one of its own buttons behind it (e.g. "Next round" on the TV) cannot take the remote away. */
  var last=null;
  function ctrls(){ return Array.prototype.slice.call(ov.querySelectorAll("button,input")); }
  function home(){ var to=(last&&ov.contains(last))?last:d.getElementById("bgDone"); try{ if(to) to.focus(); }catch(e){} }
  panelBack=back;
  panelTrap=function(e){
    if(!ov.isConnected){ closePanel(); return; }
    if(ov.contains(e.target)){ last=e.target; return; }
    panelBack=e.target; home();
  };
  panelKeys=function(e){
    if(!ov.isConnected){ closePanel(); return; }
    var k=e.key, a=d.activeElement, all=ctrls();
    function stop(){ e.preventDefault(); e.stopPropagation(); }
    if(k==="Escape"||k==="Backspace"||k==="GoBack"||k==="BrowserBack"||e.keyCode===4){ stop(); closePanel(); return; }
    if(all.indexOf(a)<0){ stop(); home(); return; }                 // focus slipped out: take it back, never act on the page behind
    e.stopPropagation();
    if(k==="ArrowDown"||k==="ArrowUp"){
      e.preventDefault();
      // vertical moves skip the − / + buttons beside a slider (from one of them, move as if from its slider)
      var col=all.filter(function(x){ return !x.hasAttribute("data-a"); }), from=a;
      if(a.hasAttribute("data-a")) from=a.parentNode.querySelector("input")||a;
      var i=col.indexOf(from), j=(i<0)?0:Math.max(0,Math.min(col.length-1,i+(k==="ArrowDown"?1:-1)));
      if(col[j]) col[j].focus(); return;
    }
    if((k==="ArrowLeft"||k==="ArrowRight")&&a.type!=="range"){
      e.preventDefault();
      var row=Array.prototype.filter.call(a.parentNode.children,function(x){ return all.indexOf(x)>=0; }), ri=row.indexOf(a)+(k==="ArrowRight"?1:-1);
      if(row[ri]) row[ri].focus(); return;
    }
    if(k==="Tab"){ e.preventDefault(); var ti=(all.indexOf(a)+(e.shiftKey?-1:1)+all.length)%all.length; all[ti].focus(); }
  };
  g.addEventListener("keydown",panelKeys,true); d.addEventListener("focusin",panelTrap,true);
  refreshPanel(); try{ d.getElementById("bgDone").focus(); }catch(e){}
}
function panelOpen(){ return !!g.document.getElementById("bgSoundPanel"); }
function mountButton(o){
  var d=g.document; if(!d||d.getElementById("bgSndBtn")) return; o=o||{};
  if(luxe()){   // Midnight Luxe: a .bg-btn--icon in the top bar's end slot (o.into: another slot; o.dock:false: always float)
    var lb=d.createElement("button"); lb.id="bgSndBtn"; lb.type="button"; lb.className="bg-btn bg-btn--icon bg-sndbtn";
    lb.setAttribute("aria-label","Sound settings"); sndIcon(lb);
    lb.onclick=function(){ unlock(); openPanel(); };
    var slot=null; try{ slot=o.dock===false?null:(o.into?(typeof o.into==="string"?d.querySelector(o.into):o.into):d.querySelector(".bg-topbar__end")); }catch(e){ slot=null; }
    if(slot){ slot.insertBefore(lb,slot.firstChild); return; }
    lb.classList.add("bg-sndbtn--float"); if(o.top) lb.style.top=o.top; if(o.right) lb.style.right=o.right;
    d.body.appendChild(lb); return;
  }
  var b=d.createElement("button"); b.id="bgSndBtn"; b.type="button"; b.textContent="🔊";
  b.setAttribute("aria-label","Sound settings");
  b.style.cssText="position:fixed;z-index:2147482000;top:"+(o.top||"6px")+";right:"+(o.right||"6px")+";background:#16203fdd;color:#eef2ff;border:1px solid #2e3b66;border-radius:10px;padding:6px 11px;font-size:"+(o.size||"16px")+";font-weight:700;cursor:pointer";
  b.onclick=function(){ unlock(); openPanel(); };
  if(!d.getElementById("bgSndCss")){   // clear focus ring for the TV remote (keyboard/D-pad focus only; taps on phones show none)
    var cs=d.createElement("style"); cs.id="bgSndCss"; cs.textContent="#bgSndBtn:focus{outline:3px solid #fff;outline-offset:2px}#bgSndBtn:focus:not(:focus-visible){outline:none}";
    (d.head||d.documentElement).appendChild(cs);
  }
  d.body.appendChild(b);
}

/* a game added later brings its own music style from its folder, before its first Sound.music(name):
   Sound.addStyle("war", {scales, bpm, swing, sev, leadVol, waves, bassKind, progs, bridge, rhythms, chordSteps, drums, titles: [10 song titles]},
   {wave: "square", reg: 0})   (the second object = the flavour of its sound effects; both shaped like the STYLES / STY entries above).
   An existing style is never replaced. */
function addStyle(name,S,fl){
  if(!name||!S||STYLES[name]||name==="menu") return false;
  if(!S.titles||S.titles.length<10||!S.progs||!S.rhythms||!S.drums||!S.scales||!S.bpm) return false;
  STYLES[name]=S; if(fl&&!STY[name]) STY[name]=fl; delete songCache[name];
  return true;
}
g.Sound={music:music,skip:skip,nowPlaying:nowPlaying,stop:function(){ want=null; stopMusic(); },duck:duck,sfx:sfx,fromText:fromText,openPanel:openPanel,closePanel:closePanel,panelOpen:panelOpen,mountButton:mountButton,addStyle:addStyle,hasStyle:function(n){ return !!STYLES[n]; },state:st,_songs:getSongs,_themes:THEMES};
})(window);
