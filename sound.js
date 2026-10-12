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
function tone(f,t,dur,type,vol,dest,o){
  o=o||{}; var osc=ctx.createOscillator(), gn=ctx.createGain();
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
  build:function(t,d){ tone(300,t,0.07,"square",0.14,d); tone(450,t+0.08,0.1,"square",0.14,d); noise(t,0.05,0.3,900,"bandpass",d); }
};
function sfx(name){
  if(!AC||st.sm||!SFX[name]) return;
  if(!ensure()) return;
  try{ SFX[name](ctx.currentTime+0.01,sfxGain); }catch(e){}
}
function fromText(m){
  m=String(m||"");
  if(/wins!|wins the game|🏆/i.test(m)) return sfx("win");
  if(/bankrupt/i.test(m)) return sfx("lose");
  if(/slid/i.test(m)) return sfx("slide");
  if(/sent home|bumped|SORRY|swap/i.test(m)) return sfx("bump");
  if(/to Jail|goes to Jail|3 doubles/i.test(m)) return sfx("jail");
  if(/passes GO|landed on GO|collects/i.test(m)) return sfx("bell");
  if(/builds/i.test(m)) return sfx("build");
  if(/buys|Trade done| for \$/i.test(m)) return sfx("coin");
  if(/pays|Tax|rent|fine/i.test(m)) return sfx("pay");
}

/* ---------- music (tiny step sequencer; 32 eighth-note steps = 4 bars) ---------- */
function P(s){ return s.trim().split(/\s+/).map(function(x){ return x==="."?null:parseInt(x,10); }); }
function R8(p){ var a=[]; for(var b=0;b<4;b++) for(var j=0;j<8;j++) a.push(!!p[j]); return a; }
function barsB(roots,pat){ var a=[]; for(var b=0;b<4;b++) for(var j=0;j<8;j++) a.push(pat[j]===null?null:roots[b]+pat[j]); return a; }
function barsC(ch,steps){ var a=[]; for(var b=0;b<4;b++) for(var j=0;j<8;j++) a.push(steps.indexOf(j)>=0?ch[b]:null); return a; }
function walk(w){ var a=[]; for(var b=0;b<4;b++) for(var j=0;j<8;j++) a.push(j%2===0?w[b][j/2]:null); return a; }
var THEMES={
  trouble:{ bpm:124,len:32,swing:0, leadRoot:72,leadWave:"square",leadVol:0.075,leadLen:0.9,
    lead:P("0 4 7 4 12 7 4 7  5 9 12 9 14 12 9 12  7 11 14 11 16 14 11 14  12 7 9 5 7 4 2 0"),
    bassRoot:48,bass:barsB([0,5,7,0],[0,null,7,null,0,null,7,null]),bassVol:0.2,
    kick:R8([1,0,0,0,1,0,0,0]),hat:R8([0,0,1,0,0,0,1,0]),hatVol:0.1 },
  sorry:{ bpm:132,len:32,swing:0, leadRoot:74,leadWave:"sawtooth",leadVol:0.05,leadLen:0.7,
    lead:P("0 . 3 . 7 . 3 .  5 . 8 . 12 . 8 .  7 . 10 . 14 . 10 .  12 10 8 7 5 3 2 0"),
    bassRoot:38,bass:barsB([0,-4,-2,0],[0,null,0,null,7,null,0,null]),bassVol:0.22,
    kick:R8([1,0,0,0,1,0,0,1]),snare:R8([0,0,1,0,0,0,1,0]),hat:R8([1,1,1,1,1,1,1,1]),hatVol:0.05 },
  monopoly:{ bpm:108,len:32,swing:0.3, leadRoot:72,leadWave:"triangle",leadVol:0.13,leadLen:1.1,
    lead:P("12 . 11 . 7 . 4 7  9 . 7 . 4 . 0 4  5 . 9 . 12 . 9 5  7 . 11 . 14 . 11 7"),
    bassRoot:36,bass:walk([[0,4,7,4],[-3,0,4,0],[2,5,9,5],[-5,-1,2,-1]]),bassVol:0.24,
    chordRoot:60,chord:barsC([[0,4,7,11],[-3,0,4,7],[2,5,9,12],[-1,2,5,7]],[0,5]),chordVol:0.06,
    kick:R8([1,0,0,0,0,0,0,0]),kickVol:0.25,snare:R8([0,0,0,1,0,0,0,1]),snareVol:0.1,hat:R8([1,0,1,0,1,0,1,0]),hatVol:0.06 },
  menu:{ bpm:84,len:32,swing:0, leadRoot:72,leadWave:"sine",leadVol:0.11,leadLen:2,
    lead:P("0 4 7 12 7 4 0 4  5 9 12 17 12 9 5 9  7 11 14 19 14 11 7 11  4 7 12 16 12 7 4 7"),
    bassRoot:48,bass:barsB([0,5,7,4],[0,null,null,null,7,null,null,null]),bassVol:0.16 }
};
function playStep(th,i,t,dur){
  var d=musicGain, v;
  v=th.lead[i]; if(v!=null) tone(hz(th.leadRoot+v),t,dur*th.leadLen,th.leadWave,th.leadVol,d);
  v=th.bass[i]; if(v!=null) tone(hz(th.bassRoot+v),t,dur*1.6,th.bassWave||"triangle",th.bassVol||0.2,d);
  v=th.chord&&th.chord[i]; if(v) v.forEach(function(n){ tone(hz(th.chordRoot+n),t,dur*1.2,"triangle",th.chordVol||0.06,d); });
  if(th.kick&&th.kick[i]) tone(120,t,0.14,"sine",th.kickVol||0.5,d,{to:45});
  if(th.snare&&th.snare[i]) noise(t,0.1,th.snareVol||0.28,1800,"bandpass",d);
  if(th.hat&&th.hat[i]) noise(t,0.04,th.hatVol||0.1,7000,"highpass",d);
}
function pump(){
  var th=THEMES[cur]; if(!th||!ctx) return;
  var dur=60/th.bpm/2;
  while(nextT<ctx.currentTime+0.4){
    var i=step%th.len, t=nextT+((i%2)?th.swing*dur:0);
    playStep(th,i,t,dur); nextT+=dur; step++;
  }
}
function stopMusic(){ if(timer){ clearInterval(timer); timer=null; } cur=null; }
function begin(){
  if(!want){ stopMusic(); return; }
  if(cur===want&&timer) return;
  stopMusic(); if(!THEMES[want]) return;
  cur=want; step=0; nextT=ctx.currentTime+0.15; timer=setInterval(pump,80); pump();
}
function music(name){ want=name||null; if(!AC) return; if(unlocked&&ensure()) begin(); }

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
    row("🎵 Music volume","bgRm","bgVm")+row("🔊 Sound-effects volume","bgRs","bgVs")+
    '<div style="display:flex;flex-wrap:wrap;gap:.6em;margin-top:.4em"><button id="bgMm" style="'+btn+';background:#2a3663;border-color:#3a4a7e"></button><button id="bgMs" style="'+btn+';background:#2a3663;border-color:#3a4a7e"></button><button id="bgTest" style="'+btn+';background:#27a758;border-color:#27a758">▶ Test</button></div>'+
    '<button id="bgDone" style="'+btn+';width:100%;margin-top:1.2em">Done</button></div>';
  d.body.appendChild(ov);
  function on(id,fn){ var e=d.getElementById(id); if(e) e.onclick=fn; }
  d.getElementById("bgRm").oninput=function(){ setVol("m",this.value/100); };
  d.getElementById("bgRs").oninput=function(){ setVol("s",this.value/100); };
  Array.prototype.forEach.call(ov.querySelectorAll("button[data-a]"),function(b){ b.onclick=function(){ var a=b.getAttribute("data-a"); var up=a.slice(-1)==="+"; if(a.indexOf("bgRm")===0) setVol("m",st.music+(up?0.1:-0.1)); else { setVol("s",st.sfx+(up?0.1:-0.1)); sfx("coin"); } }; });
  on("bgMm",function(){ st.mm=!st.mm; save(); applyVol(); refreshPanel(); });
  on("bgMs",function(){ st.sm=!st.sm; save(); applyVol(); refreshPanel(); });
  on("bgTest",function(){ unlock(); ensure(); sfx("dice"); setTimeout(function(){ sfx("coin"); },600); });
  on("bgDone",closePanel);
  refreshPanel(); try{ d.getElementById("bgDone").focus(); }catch(e){}
}
function mountButton(o){
  var d=g.document; if(!d||d.getElementById("bgSndBtn")) return; o=o||{};
  var b=d.createElement("button"); b.id="bgSndBtn"; b.type="button"; b.textContent="🔊";
  b.setAttribute("aria-label","Sound settings");
  b.style.cssText="position:fixed;z-index:2147482000;top:"+(o.top||"6px")+";right:"+(o.right||"6px")+";background:#16203fdd;color:#eef2ff;border:1px solid #2e3b66;border-radius:10px;padding:6px 11px;font-size:"+(o.size||"16px")+";font-weight:700;cursor:pointer";
  b.onclick=function(){ unlock(); openPanel(); };
  d.body.appendChild(b);
}

g.Sound={music:music,stop:function(){ want=null; stopMusic(); },sfx:sfx,fromText:fromText,openPanel:openPanel,mountButton:mountButton,state:st,_themes:THEMES};
})(window);
