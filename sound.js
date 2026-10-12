/* Board Games — synthesized music + sound effects (Web Audio, no audio files).
   API: Sound.music(name) | Sound.sfx(name) | Sound.fromText(msg) | Sound.openPanel() | Sound.mountButton(opts) */
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
  if(ctx.state==="suspended"&&ctx.resume){ try{ ctx.resume(); }catch(e){} }
  return true;
}
function applyVol(){
  if(!ctx) return; var t=ctx.currentTime;
  musicGain.gain.setTargetAtTime(st.mm?0:st.music*0.55,t,0.05);
  sfxGain.gain.setTargetAtTime(st.sm?0:st.sfx*0.9,t,0.05);
}
function hz(m){ return 440*Math.pow(2,(m-69)/12); }

/* ---------- voices ---------- */
var inSfx=false, sty=null;
var STY={trouble:{wave:"square",pitch:1},sorry:{wave:"sawtooth",pitch:1.14},monopoly:{wave:"triangle",pitch:0.92},rummy500:{wave:"triangle",pitch:1.06},risk:{wave:"square",pitch:0.9},uno:{wave:"square",pitch:1.12}};
function tone(f,t,dur,type,vol,dest,o){
  o=o||{};
  if(inSfx&&sty){
    if(sty.wave&&(type==="square"||type==="triangle")) type=sty.wave;
    if(sty.pitch){ f=f*sty.pitch; if(o.to){ var o2={}; for(var kk in o) o2[kk]=o[kk]; o2.to=o.to*sty.pitch; o=o2; } }
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
  tick:function(t,d){ tone(900,t,0.05,"square",0.10,d); },
  click:function(t,d){ tone(660,t,0.06,"triangle",0.14,d); },
  dice:function(t,d){ for(var i=0;i<7;i++){ noise(t+i*0.07+Math.random()*0.02,0.05,0.5,1800+Math.random()*2500,"bandpass",d); tone(220+Math.random()*120,t+i*0.07,0.04,"square",0.05,d); } },
  coin:function(t,d){ tone(988,t,0.09,"square",0.13,d); tone(1319,t+0.08,0.28,"square",0.13,d); },
  pay:function(t,d){ tone(440,t,0.12,"triangle",0.2,d); tone(330,t+0.11,0.2,"triangle",0.2,d); },
  bump:function(t,d){ tone(160,t,0.25,"sine",0.5,d,{to:45}); noise(t,0.12,0.5,500,"lowpass",d); },
  slide:function(t,d){ tone(260,t,0.45,"sawtooth",0.11,d,{to:1100}); noise(t,0.4,0.16,3000,"highpass",d); },
  card:function(t,d){ noise(t,0.09,0.5,5000,"highpass",d); noise(t+0.07,0.07,0.4,4200,"highpass",d); tone(700,t+0.1,0.06,"triangle",0.12,d); },
  bell:function(t,d){ tone(880,t,0.5,"triangle",0.2,d); tone(1320,t,0.4,"sine",0.11,d); tone(1760,t+0.02,0.3,"sine",0.07,d); },
  jail:function(t,d){ tone(120,t,0.55,"square",0.22,d,{to:90}); tone(95,t+0.02,0.55,"sawtooth",0.12,d); },
  win:function(t,d){ [523,659,784,1047,784,1047,1319].forEach(function(f,i){ tone(f,t+i*0.11,i>5?0.6:0.16,"square",0.15,d); }); },
  lose:function(t,d){ [392,330,262,196].forEach(function(f,i){ tone(f,t+i*0.16,0.3,"triangle",0.2,d); }); },
  turn:function(t,d){ tone(660,t,0.08,"sine",0.13,d); tone(880,t+0.07,0.12,"sine",0.13,d); },
  deal:function(t,d){ for(var i=0;i<6;i++){ noise(t+i*0.08,0.05,0.45,4500,"highpass",d); } tone(520,t+0.5,0.06,"triangle",0.1,d); },
  draw:function(t,d){ noise(t,0.07,0.45,5200,"highpass",d); tone(600,t+0.05,0.05,"triangle",0.1,d); },
  discard:function(t,d){ noise(t,0.05,0.5,3000,"bandpass",d); tone(220,t+0.02,0.09,"sine",0.25,d,{to:150}); },
  meld:function(t,d){ tone(523,t,0.12,"triangle",0.18,d); tone(659,t+0.09,0.12,"triangle",0.18,d); tone(784,t+0.18,0.3,"triangle",0.18,d); },
  cannon:function(t,d){ noise(t,0.2,0.9,260,"lowpass",d); tone(95,t,0.32,"sine",0.42,d,{to:38}); noise(t+0.02,0.1,0.5,1600,"bandpass",d); },
  conquer:function(t,d){ [392,523,659,784].forEach(function(f,i){ tone(f,t+i*0.09,0.22,"sawtooth",0.1,d); }); tone(1047,t+0.4,0.5,"square",0.12,d); noise(t+0.4,0.2,0.3,3000,"highpass",d); },
  place:function(t,d){ tone(260,t,0.06,"square",0.12,d,{to:170}); noise(t,0.04,0.35,2000,"bandpass",d); },
  build:function(t,d){ tone(300,t,0.07,"square",0.14,d); tone(450,t+0.08,0.1,"square",0.14,d); noise(t,0.05,0.3,900,"bandpass",d); }
};
function sfx(name){
  if(!AC||st.sm||!SFX[name]) return;
  if(!ensure()) return;
  try{ inSfx=true; sty=STY[styleName]||null; SFX[name](ctx.currentTime+0.01,sfxGain); }catch(e){} inSfx=false;
}
function fromText(m){
  m=String(m||"");
  if(/wins!|wins the game|🏆/i.test(m)) return sfx("win");
  if(/bankrupt/i.test(m)) return sfx("lose");
  if(/slid/i.test(m)) return sfx("slide");
  if(/sent home|bumped|SORRY|swap/i.test(m)) return sfx("bump");
  if(/to Jail|goes to Jail|3 doubles/i.test(m)) return sfx("jail");
  if(/passes GO|landed on GO|collects/i.test(m)) return sfx("bell");
  if(/ says UNO!/i.test(m)) return sfx("bell");
  if(/ catches .* didn't say UNO/i.test(m)) return sfx("bump");
  if(/ challenges .*'s /i.test(m)) return sfx("bump");
  if(/FLIP!|knocked out by the Mercy/i.test(m)) return sfx(/FLIP/.test(m)?"dice":"lose");
  if(/Direction reversed| is skipped|are skipped|Everyone else is skipped/i.test(m)) return sfx("slide");
  if(/ plays [A-Z][a-z]+ |^[A-Za-z0-9 ]+ plays /.test(m)&&!/armies/.test(m)) return sfx("card");
  if(/ draws d+ cards?| draws a card| keeps the card/i.test(m)) return sfx("draw");
  if(/ picks .* for Color Roulette| passes their hand| swaps hands/i.test(m)) return sfx("deal");
  if(/conquers|captures .* headquarters/i.test(m)) return sfx("conquer");
  if(/eliminates/i.test(m)) return sfx("lose");
  if(/ attacks .* rolls /i.test(m)) return sfx("cannon");
  if(/trades in a set/i.test(m)) return sfx("meld");
  if(/draws a territory card/i.test(m)) return sfx("card");
  if(/ places \d+ (armies|army)| places an army| claims | moves \d+ armies? (into|from)| moves 1 army (into|from)/i.test(m)) return sfx("place");
  if(/goes out|wins the round/i.test(m)) return sfx("win");
  if(/melds|lays off|laid off/i.test(m)) return sfx("meld");
  if(/discards/i.test(m)) return sfx("discard");
  if(/takes .* from the discard|draws from the (stock|pile)/i.test(m)) return sfx("draw");
  if(/deals|shuffl/i.test(m)) return sfx("deal");
  if(/builds/i.test(m)) return sfx("build");
  if(/buys|Trade done| for \$/i.test(m)) return sfx("coin");
  if(/pays|Tax|rent|fine/i.test(m)) return sfx("pay");
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
    titles:["Boardwalk Blues","Go Collect Two Hundred","Park Place Swing","Rent Is Due","Free Parking Jazz","Railroad Rag","Hotel Lobby","Chance Encounter","Community Chest Cha-Cha","Pass Go Boogie"] }
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
  var sc=SCALES[pickOf(r,S.scales)], key=pickOf(r,KEYS), bpm=Math.round(S.bpm[0]+r()*(S.bpm[1]-S.bpm[0]));
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
  return { title:S.titles[idx], bpm:bpm, len:128, swing:S.swing, leadRoot:0, leadWave:wave, leadVol:S.leadVol*(0.9+r()*0.25), leadLen:(game==="sorry"?0.6:game==="monopoly"?1.1:0.9),
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
function stopMusic(){ if(timer){ clearInterval(timer); timer=null; } cur=null; }
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
  if(cur===want&&timer) return;
  stopMusic(); setupTheme(want);
  cur=want; step=0; nextT=ctx.currentTime+0.15; timer=setInterval(pump,80); pump(); refreshPanel();
}
function music(name){ want=name||null; styleName=(name&&(STYLES[name]||name==="menu"))?name:"menu"; if(!AC) return; if(unlocked&&ensure()) begin(); }
function skip(){ if(playlistMode&&timer) nextSong(); }          // start a different song (used at the start of every game)
function nowPlaying(){ return (playlistMode&&curTheme)?curTheme.title:""; }

function unlock(){
  if(unlocked) return; unlocked=true;
  ["pointerdown","keydown","touchstart","click"].forEach(function(ev){ try{ g.document.removeEventListener(ev,unlock,true); }catch(e){} });
  if(ensure()&&want) begin();
}
if(g.document){
  ["pointerdown","keydown","touchstart","click"].forEach(function(ev){ g.document.addEventListener(ev,unlock,true); });
  g.document.addEventListener("visibilitychange",function(){ if(!ctx) return; try{ if(g.document.hidden){ ctx.suspend&&ctx.suspend(); } else { ctx.resume&&ctx.resume(); } }catch(e){} });
}

/* ---------- settings panel + floating button ---------- */
function closePanel(){ var o=g.document.getElementById("bgSoundPanel"); if(o) o.remove(); }
function setVol(which,v){ v=Math.max(0,Math.min(1,v)); if(which==="m") st.music=v; else st.sfx=v; save(); applyVol(); refreshPanel(); }
function refreshPanel(){
  var d=g.document; var rm=d.getElementById("bgRm"), rs=d.getElementById("bgRs"); if(!rm||!rs) return;
  rm.value=Math.round(st.music*100); rs.value=Math.round(st.sfx*100);
  d.getElementById("bgVm").textContent=Math.round(st.music*100)+"%"; d.getElementById("bgVs").textContent=Math.round(st.sfx*100)+"%";
  d.getElementById("bgMm").textContent=st.mm?"🔇 Music off":"🎵 Music on"; d.getElementById("bgMs").textContent=st.sm?"🔇 Effects off":"🔊 Effects on";
  var np=d.getElementById("bgNow"); if(np) np.textContent=nowPlaying()?("♪ Now playing: "+nowPlaying()):"♪ Menu music";
}
function openPanel(){
  var d=g.document; closePanel();
  var ov=d.createElement("div"); ov.id="bgSoundPanel";
  ov.style.cssText="position:fixed;inset:0;z-index:2147483000;background:rgba(6,10,26,.9);display:flex;align-items:center;justify-content:center;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;color:#eef2ff;padding:16px";
  var fs="clamp(17px,3vh,30px)";
  var btn="font-size:"+fs+";font-weight:800;color:#fff;background:#2b7be0;border:3px solid #2b7be0;border-radius:14px;padding:.45em .9em;cursor:pointer";
  function row(label,idr,idv){ return '<div style="margin:1.2em 0"><div style="font-size:'+fs+';font-weight:800;margin-bottom:.4em">'+label+' <span id="'+idv+'" style="color:#ffd86b"></span></div>'+
      '<div style="display:flex;align-items:center;gap:.6em"><button data-a="'+idr+'-" style="'+btn+'">−</button><input id="'+idr+'" type="range" min="0" max="100" step="5" style="flex:1;height:2.4em"><button data-a="'+idr+'+" style="'+btn+'">+</button></div></div>'; }
  ov.innerHTML='<div style="background:#16203f;border:2px solid #39498a;border-radius:22px;padding:1.4em 1.6em;width:min(92vw,720px);max-height:92vh;overflow:auto">'+
    '<div style="font-size:calc('+fs+' * 1.3);font-weight:900">🔊 Sound settings</div>'+
    '<div id="bgNow" style="margin-top:.5em;color:#ffd86b;font-size:'+fs+';font-weight:700"></div>'+
    row("🎵 Music volume","bgRm","bgVm")+row("🔊 Sound-effects volume","bgRs","bgVs")+
    '<div style="display:flex;flex-wrap:wrap;gap:.6em;margin-top:.4em"><button id="bgMm" style="'+btn+';background:#2a3663;border-color:#3a4a7e"></button><button id="bgMs" style="'+btn+';background:#2a3663;border-color:#3a4a7e"></button><button id="bgNext" style="'+btn+';background:#6a2bd0;border-color:#6a2bd0">⏭ Next song</button><button id="bgTest" style="'+btn+';background:#27a758;border-color:#27a758">▶ Test</button></div>'+
    '<button id="bgDone" style="'+btn+';width:100%;margin-top:1.2em">Done</button></div>';
  d.body.appendChild(ov);
  function on(id,fn){ var e=d.getElementById(id); if(e) e.onclick=fn; }
  d.getElementById("bgRm").oninput=function(){ setVol("m",this.value/100); };
  d.getElementById("bgRs").oninput=function(){ setVol("s",this.value/100); };
  Array.prototype.forEach.call(ov.querySelectorAll("button[data-a]"),function(b){ b.onclick=function(){ var a=b.getAttribute("data-a"); var up=a.slice(-1)==="+"; if(a.indexOf("bgRm")===0) setVol("m",st.music+(up?0.1:-0.1)); else { setVol("s",st.sfx+(up?0.1:-0.1)); sfx("coin"); } }; });
  on("bgMm",function(){ st.mm=!st.mm; save(); applyVol(); refreshPanel(); });
  on("bgMs",function(){ st.sm=!st.sm; save(); applyVol(); refreshPanel(); });
  on("bgTest",function(){ unlock(); ensure(); sfx("dice"); setTimeout(function(){ sfx("coin"); },600); });
  on("bgNext",function(){ unlock(); skip(); refreshPanel(); });
  on("bgDone",closePanel);
  /* remote / keyboard: Up/Down move between the controls (they must NOT change a slider), Left/Right adjust a slider, Back closes the window */
  ov.addEventListener("keydown",function(e){
    var k=e.key, list=Array.prototype.slice.call(ov.querySelectorAll("button,input")), i=list.indexOf(d.activeElement);
    if(k==="Escape"||k==="Backspace"||k==="GoBack"||k==="BrowserBack"||e.keyCode===4){ e.preventDefault(); e.stopPropagation(); closePanel(); return; }
    if(k==="ArrowDown"||k==="ArrowUp"){
      e.preventDefault(); e.stopPropagation();
      var j=k==="ArrowDown"?Math.min(list.length-1,i+1):Math.max(0,i-1); if(i<0) j=0;
      // skip the − / + buttons beside a slider when moving vertically
      while(list[j]&&list[j].hasAttribute("data-a")&&j>0&&j<list.length-1) j+=(k==="ArrowDown"?1:-1);
      if(list[j]) list[j].focus(); return;
    }
    if((k==="ArrowLeft"||k==="ArrowRight")&&d.activeElement&&d.activeElement.type!=="range"){ e.preventDefault(); e.stopPropagation(); var jj=k==="ArrowRight"?Math.min(list.length-1,i+1):Math.max(0,i-1); if(list[jj]) list[jj].focus(); }
  },true);
  refreshPanel(); try{ d.getElementById("bgDone").focus(); }catch(e){}
}
function panelOpen(){ return !!g.document.getElementById("bgSoundPanel"); }
function mountButton(o){
  var d=g.document; if(!d||d.getElementById("bgSndBtn")) return; o=o||{};
  var b=d.createElement("button"); b.id="bgSndBtn"; b.type="button"; b.textContent="🔊";
  b.setAttribute("aria-label","Sound settings");
  b.style.cssText="position:fixed;z-index:2147482000;top:"+(o.top||"6px")+";right:"+(o.right||"6px")+";background:#16203fdd;color:#eef2ff;border:1px solid #2e3b66;border-radius:10px;padding:6px 11px;font-size:"+(o.size||"16px")+";font-weight:700;cursor:pointer";
  b.onclick=function(){ unlock(); openPanel(); };
  d.body.appendChild(b);
}

g.Sound={music:music,skip:skip,nowPlaying:nowPlaying,stop:function(){ want=null; stopMusic(); },sfx:sfx,fromText:fromText,openPanel:openPanel,closePanel:closePanel,panelOpen:panelOpen,mountButton:mountButton,state:st,_songs:getSongs,_themes:THEMES};
})(window);
