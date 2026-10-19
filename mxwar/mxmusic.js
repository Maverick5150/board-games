/* MOTOCROSS WAR — the music director (mxshow S0, 2026-10-19: the CEO's picks on today's screens). ONE director for the game page (mxwar/game.js) and for the
   Party TV host (firestick/games/mxwar.js): both tell it the same moments, so the TV plays the same music at the same moments; the phones of a Party load
   none of this and stay silent. It calls only ../sound.js (Sound.mix, Sound.sfx, Sound.music / stop) and ./mxsound.js (Sound.show). Presentation only: it
   never changes the race, the points or the save (it reads the season's standings for the stakes ladder).
   THE CEO'S PICKS (BG_audit/sprint/mxshow/music/CEO-PICKS.md), as the package "base" cut them (mxwar/audio/base/pkg.json):
     #9 "MX War Theme" (our own code-made theme, the old video game sound) = THE theme: played whole the first time music plays in a visit (the title,
        on the Menu), and the checkered fanfare;
     #2 "Welcome to the Show" (Kevin MacLeod, CC BY 4.0) = the opener: the broadcast open when a new round comes up on the season screen;
     #8 "Megasong" (Emma_MA, CC0) = the post-race music: the results of a round's last race (the recap bed) and its podium (the last 16 bars, the final hit);
     #1, #3-#7 = the rotation, at random with no immediate repeat (the draw is kept on the device): the Menu after the theme, the season screen, the
        results of the other races, the season's end; one track at a time (about a minute each, streamed), one after another;
     #10 never. No music while a race runs (from the gate to the flag: engines and the booth only).
   API:
     var M = MXWar.Music.create({pkg: "base", game: "mxwar"})   one per page (a new one retires the old)
     M.at(moment, info)   what the screen shows now; the same moment again changes nothing:
       "menu"                 the Menu (the game page's setup, the Party sign-up)
       "season", {round}      the season screen (Party: the season, standings and line-up panels); round = the key of a round that comes up: its open, once
       "results", {last, G}   a race's results; last = the round's last race: the post-race music (G, the season: the stakes ladder picks its variant)
       "podium", {round}      the round's podium: its music once, landing on the bar of the post-race bed (which fades into it)
       "flag"                 the flag fell, the results are not up yet: what plays goes on (the checkered fanfare), nothing starts
       "race"                 the gate and the race: the music fades out within 350 ms (the booth runs the start procedure: never music over it)
       "over"                 the season is over (the champion, the Victory): the rotation
       "off"                  leaving (the Party game ends): silence, every decoded buffer released
     M.flag(final, fx) -> "pkg" | "sfx"   the checkered flag: final (a Main, or a round's last race) = the checkered fanfare (MX War Theme) on the music
                            bus; otherwise, or with Music off, or before the fanfare is decoded: today's effect fx ("win" / "conquer")
     M.plays() -> true when the package's music can play now (the page leaves out its old podium fanfare)
     M.next()               the sound panel's Next song: another track of the rotation (while the rotation plays)
     M.credits() -> Promise<[{cue, title, by, licence, url, changes, source}]>   the package's own credit lines (Sound.show.credits()), for the Credits sheets
     M.state() -> {moment, playing, hold, log: the last changes with the AudioContext time ...}   (the tests: what plays and why)
     MXWar.Music.creditsHTML(list, {tv}) -> the credits list (every CC BY line in full: title, author, licence and its address, the source, the changes)
   Rules:
     - Music off (the sound panel) = nothing starts and what plays stops (its decoded files are released); Music on = the moment's music starts again.
       The Music volume is the music bus's (Sound.mix; the broadcast profile, which the page sets, ducks it 7 dB under every booth line).
     - A one-shot plays to its end before the next music: the checkered fanfare, the open. The podium gives way at once (the next screen's music).
     - Levels (MUSIC-PLAN 4.1): the Menu's music at -18 LUFS, the rotation elsewhere at -22 (a bed under the booth's talk), the post-race bed -22,
       the podium -20, the open and the fanfare -18 (Sound.show's own trims).
     - A browser starts audio on the first tap or key (sound.js); the Fire TV app starts it with the page. Hidden page: everything waits with the context.
     - Without the package (offline and never fetched): today's synthesized playlist where music plays, and still none in a race.
     - Reduced motion does not change the music. */
(function(g){
"use strict";
var MXW=g.MXWar=g.MXWar||{};
if(MXW.Music) return;
var S=g.Sound, doc=g.document||null, ACTIVE=null;
function dbl(d){ return Math.pow(10,d/20); }
function okSound(){ return !!(S&&S.show&&S.mix&&typeof S.ctx==="function"&&typeof S.show.bed==="function"); }
var GAIN_MENU=1, GAIN_BED=dbl(-4), FADE_RACE=350, FADE_CUT=300, FADE_OFF=150;

/* ---------- the credits (the package's own lines: pkg.json, through Sound.show.credits()) ---------- */
function credits(pkg){
  if(!okSound()) return Promise.resolve([]);
  var P=S.show._p||{};
  var pr=P.man&&(!pkg||P.id===pkg)?Promise.resolve():S.show.load(pkg||"base",{cues:[]});
  return pr.then(function(){ return S.show.credits(); },function(){ return []; });
}
function esc(s){ return String(s==null?"":s).replace(/[&<>"]/g,function(c){ return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]; }); }
function role(c){
  c=String(c||"");
  if(/\btitle\b/.test(c)) return "The theme: the title music and the checkered flag.";
  if(/\bopen\b/.test(c)) return "The opener of every new round.";
  if(/recapB|podium/.test(c)) return "The post-race music: the results of a round's last race and the podium.";
  if(/long-c/.test(c)) return "In the rotation: the Menu, the season screen and between races.";
  return "";
}
function licLine(x){
  var l=String(x.licence||"");
  if(/^CC BY/i.test(l)){ var v=(/(\d\.\d)/.exec(l)||[])[1]||""; return "Licensed under Creative Commons: By Attribution "+v+" License "+(x.url||""); }
  if(/^CC0/i.test(l)) return "CC0 1.0: public domain dedication, credited as a courtesy "+(x.url||"");
  return "Made for Motocross War by the game's own code";
}
function injectCSS(){
  if(!doc||doc.getElementById("mxm-css")) return;
  var st=doc.createElement("style"); st.id="mxm-css";
  st.textContent=".mxm-cred{display:grid;gap:.4rem;margin:0 0 .75rem;padding:0;list-style:none;max-height:min(52vh,30rem);overflow-y:auto;overscroll-behavior:contain}"+
    ".mxm-cred li{display:grid;gap:.15rem;min-width:0;padding:.45rem .65rem;border-radius:var(--r-md,10px);background:var(--ink-3,rgba(255,255,255,.05));box-shadow:inset 0 0 0 1px var(--line-1,rgba(255,255,255,.1));"+
      "font:var(--fw-ui,500) var(--fs-xs,.8rem)/1.4 var(--font-ui,system-ui,sans-serif);color:var(--text-2,#c9c9d2);overflow-wrap:anywhere}"+
    ".mxm-cred b{font-weight:700;color:var(--text-1,#f2f2f6)}.mxm-cred .mxm-use{color:var(--text-1,#f2f2f6)}"+
    "html[data-tv] .mxm-cred{grid-template-columns:repeat(2,minmax(0,1fr));column-gap:1rem;max-height:min(58vh,40rem)}";
  (doc.head||doc.documentElement).appendChild(st);
}
/* one line per work (the replay whooshes are effects, not music: left out); o.tv = the rows take the remote's focus, so Up / Down scroll the list */
function creditsHTML(list,o){
  injectCSS(); o=o||{};
  var rows=(list||[]).filter(function(x){ return !/whoosh/.test(String(x.cue||"")); });
  if(!rows.length) return '<p class="mxm-none">The music list comes with the music: it loads when this device is online.</p>';
  return '<ol class="mxm-cred" aria-label="Music credits">'+rows.map(function(x){
    var use=role(x.cue), ch=x.changes?String(x.changes).charAt(0).toUpperCase()+String(x.changes).slice(1)+".":"";
    return '<li'+(o.tv?' class="bg-focus" data-focus tabindex="-1"':"")+'><span><b>&ldquo;'+esc(x.title)+'&rdquo;</b> '+esc(x.by)+'</span><span>'+esc(licLine(x))+'</span>'+
      (use||ch?'<span class="mxm-use">'+esc((use?use+" ":"")+ch)+'</span>':"")+(x.source?'<span>Source: '+esc(x.source)+'</span>':"")+"</li>";
  }).join("")+"</ol>";
}

/* ---------- the director ---------- */
function create(o){
  o=o||{};
  if(ACTIVE) try{ ACTIVE.at("off"); ACTIVE._retire(); }catch(e){}
  var PK=o.pkg||"base", GM=o.game||"mxwar";
  var want={m:null,info:{}}, wantK="", cur=null, synth=false, opened={}, podded={}, hold=0, holdWhat=null, titleUntil=0, tmr=0, dead=false;
  var pend=false, raceDone=false, manP=null, manFail=false, seq=0, hooked=null, lastMu=null, logA=[], gain=GAIN_BED;
  function ctx(){ try{ return S&&S.ctx?S.ctx():null; }catch(e){ return null; } }
  function tnow(){ var c=ctx(); return c?c.currentTime:0; }
  function running(){ var c=ctx(); return !!(c&&c.state==="running")&&!(doc&&doc.hidden); }
  function muted(){ var st=S&&S.state; return !!(st&&st.mm); }
  function SP(){ return (S&&S.show&&S.show._p)||{}; }
  function cueOf(n){ var m=SP().man; return (m&&m.cues&&m.cues[n])||null; }
  function tailOf(n){ var c=cueOf(n); return c?Math.max(0,(c.len||0)-(c.beat0!=null?c.beat0:(c.on||0))):0; }   // from the downbeat to the file's end
  function note(what,x){ var r={t:+tnow().toFixed(3),w:Math.round((g.performance&&g.performance.now?g.performance.now():Date.now())),what:what}; if(x) for(var k in x) r[k]=x[k]; logA.push(r); if(logA.length>80) logA.shift(); }
  function hookCtx(){ var c=ctx(); if(c&&c!==hooked){ hooked=c; try{ c.addEventListener("statechange",function(){ if(c.state==="running") kick(); }); }catch(e){} } }
  function wake(t){ clearTimeout(tmr); tmr=setTimeout(apply,Math.max(30,Math.round((t-tnow())*1000)+25)); }
  function preload(list){ if(!okSound()||!running()||muted()) return; try{ S.show.load(PK,{cues:list}).then(null,function(){}); }catch(e){} }
  /* the stakes ladder (Sound.show.stakes, MUSIC-PLAN 5.3): the post-race bed's bigger variant in the last 3 rounds or a title fight closer than one race's points */
  function stakes(I){
    var G=I&&I.G, SS=MXW.Season; if(!G||!SS||!okSound()) return;
    try{
      var res=G.results&&G.results.length?G.results[G.results.length-1]:null, ri=res?res.ri:G.ri, c=G.cal[Math.min(ri,G.cal.length-1)], L=SS.standings(G);
      var F=SS.calFormat?SS.calFormat(G,c):null, rp=F&&F.table?(F.table[0]||0)*((c&&c.mult)||1):null;
      S.show.stakes({ri:ri,n:G.cal.length,gap:L.length>1?L[0].pts-L[1].pts:null,racePts:rp});
    }catch(e){}
  }
  function synthOn(){ if(synth) return; synth=true; cur=null; note("no package: today's synthesized playlist"); try{ S.music(GM); }catch(e){} }
  function halt(all){
    clearTimeout(tmr); tmr=0; seq++;
    var was=!!(cur||synth); cur=null; synth=false; hold=0; holdWhat=null;
    try{ S.stop(); }catch(e){}   // today's synthesized playlist (the offline fallback) never plays on in a race
    if(okSound()){ try{ S.show.stop({fade:all?FADE_OFF:FADE_RACE,all:!!all}); }catch(e){} }
    note(all?"off: silence, every buffer released":"silence (the race)",{was:was});
  }
  /* the rotation: the Menu's stream (the visit's theme first, then one track after another); it goes on when it already plays */
  function rot(gn){
    if(cur==="rot") return;
    var P=SP(), first=!P.titleDone, my=++seq, t=tnow();
    if(cur==="pod") try{ S.show.stop({fade:FADE_CUT}); }catch(e){}
    cur="rot"; gain=gn;
    if(first) titleUntil=t+(cueOf("title")?cueOf("title").len:0);
    note(first?"theme (MX War Theme, whole)":"rotation",{gain:+gn.toFixed(3)});
    S.show.bed("menu",{fade:600,gain:gn}).then(null,function(e){ if(my!==seq) return; note("rotation failed",{e:String(e&&e.message||e).slice(0,80)}); cur=null; synthOn(); });
  }
  /* a round comes up: its open (Welcome to the Show), unless the visit's theme is playing (then the theme is this round's open) */
  function open(key){
    opened[key]=1;
    var t=tnow();
    if(cur==="rot"&&t<titleUntil-0.5){ note("open: the theme is playing (it opens this round)",{round:key}); return; }
    var my=++seq; cur="open";
    try{ S.show.stop({fade:FADE_CUT}); }catch(e){}   // what plays makes room (a podium, the rotation, a bed)
    note("open (Welcome to the Show)",{round:key});
    S.show.cue("open").then(function(when){ if(my!==seq) return; hold=when+tailOf("open"); holdWhat="open"; wake(hold); },
      function(e){ if(my!==seq) return; note("open failed",{e:String(e&&e.message||e).slice(0,80)}); cur=null; apply(); });
  }
  /* the round's last results: the recap bed of the post-race music (Megasong), the stakes ladder's variant */
  function post(I){
    if(cur==="post") return;
    stakes(I);
    var my=++seq;
    if(cur==="pod") try{ S.show.stop({fade:FADE_CUT}); }catch(e){}
    cur="post"; note("post-race (Megasong)",{variant:SP().stakes});
    S.show.bed("recapB",{fade:800}).then(null,function(e){ if(my!==seq) return; note("post-race failed",{e:String(e&&e.message||e).slice(0,80)}); cur=null; rot(GAIN_BED); });
    preload(["podium"]);
  }
  /* the podium: Megasong's last 16 bars and its final hit, on the bar of the recap bed, which fades out into its downbeat */
  function pod(key){
    if(!key||podded[key]) return;
    podded[key]=1;
    var my=++seq; cur="pod"; note("podium (Megasong's finish)",{round:key});
    S.show.cue("podium",{at:"bar"}).then(function(when){
      if(my!==seq) return;
      try{ var p=S.show.bed(null,{fade:Math.max(40,Math.round((when-tnow())*1000))}); if(p&&p.then) p.then(null,function(){}); }catch(e){}
    },function(e){ if(my!==seq) return; note("podium failed: today's fanfare",{e:String(e&&e.message||e).slice(0,80)}); cur=null; try{ S.sfx("win"); }catch(x){} });
  }
  function apply(){
    clearTimeout(tmr); tmr=0;
    if(dead) return;
    var m=want.m, I=want.info||{};
    if(!m) return;
    if(m==="off"){ halt(true); return; }
    if(m==="race"){ if(!raceDone){ raceDone=true; halt(false); } return; }
    raceDone=false;
    if(m==="flag") return;
    if(!okSound()) return;
    hookCtx();
    if(!running()){ pend=true; return; }
    pend=false;
    var mu=muted(); lastMu=mu;
    if(mu){ if(cur||synth){ halt(false); note("Music off"); } return; }
    if(!S.show.has("menu")){
      if(!manP&&!manFail){ manP=S.show.load(PK,{cues:[]}).then(function(){ manP=null; apply(); },function(){ manP=null; manFail=true; apply(); }); }
      if(manFail) synthOn();
      return;
    }
    if(synth){ synth=false; try{ S.stop(); }catch(e){} }
    if(m==="results"&&I.last){ stakes(I); preload(["recapB","podium"]); }
    else if(m==="podium") preload(["podium"]);
    else if(m==="season"&&I.round&&!opened[I.round]) preload(["open"]);
    if(hold>tnow()+0.05){ wake(hold); return; }   // the checkered fanfare or the open plays to its end first
    hold=0; holdWhat=null;
    preload(["checkered"]);
    if(m==="menu") rot(GAIN_MENU);
    else if(m==="over") rot(GAIN_BED);
    else if(m==="season"){ if(I.round&&!opened[I.round]) open(I.round); else rot(GAIN_BED); }
    else if(m==="results"){ if(I.last) post(I); else rot(GAIN_BED); }
    else if(m==="podium") pod(I.round);
  }
  function at(m,info){
    if(dead) return;
    var I=info||{}, k=m+"|"+(I.round||"")+"|"+(I.last?1:0);
    if(k===wantK){ if(pend) apply(); return; }
    wantK=k; want={m:m,info:I}; note("moment: "+m,I.round?{round:I.round}:I.last?{last:true}:null);
    apply();
  }
  function kick(){ if(dead||!want.m) return; hookCtx(); if(pend||(want.m!=="race"&&want.m!=="off"&&muted()!==lastMu)) apply(); }
  /* the checkered flag (after M.at("flag")): the fanfare on the music for a final, else (or not ready) today's effect */
  function flag(final,fx){
    if(final&&okSound()&&running()&&!muted()&&S.show.ready("checkered")){
      var my=++seq; cur="flag"; note("checkered fanfare (MX War Theme)");
      S.show.cue("checkered").then(function(when){ if(my!==seq) return; hold=when+tailOf("checkered"); holdWhat="checkered"; },function(){ if(my!==seq) return; cur=null; try{ S.sfx(fx); }catch(e){} });
      return "pkg";
    }
    try{ S.sfx(fx); }catch(e){}
    if(final) preload(["checkered"]);
    note("flag: today's effect",{fx:fx,final:!!final});
    return "sfx";
  }
  function plays(){ return okSound()&&running()&&!muted()&&S.show.has("menu"); }
  function next(){ if(cur!=="rot"||!okSound()) return false; var gn=gain; cur=null; titleUntil=0; note("Next song"); rot(gn); return true; }
  /* the sound panel's "Now playing" line names the track (sound.js writes "Menu music": it knows only its own playlist) */
  function nowText(){
    var P=SP(), m=P.man; if(!m||!m.credits) return "";
    function by(cue){ for(var i=0;i<m.credits.length;i++){ var x=m.credits[i]; if((", "+x.cue+",").indexOf(", "+cue+",")>=0||String(x.cue).split(/,\s*/).indexOf(cue)>=0) return x.title+", "+x.by.replace(/\s*\(.*\)$/,""); } return ""; }
    if(cur==="rot"){ if(tnow()<titleUntil) return by("title"); var src=P.rot; return src?by("long-"+src):""; }
    if(cur==="post"||cur==="pod") return by("podium");
    if(cur==="open") return by("open");
    if(cur==="flag") return by("checkered");
    return "";
  }
  function nowLine(){
    var el=doc&&doc.getElementById("bgNow"); if(!el) return; var t=nowText(), cl=/^♪/.test(el.textContent||"");
    if(t){ el.textContent=(cl?"♪ Now playing: ":"Now playing: ")+t; return; }
    if(!synth&&(want.m==="race"||want.m==="flag")) el.textContent=(cl?"♪ ":"")+"No music during the race: engines and the booth";
  }
  function gesture(e){
    var t=e.target, inP=!!(t&&t.closest&&t.closest("#bgSoundPanel,#bgSndBtn"));
    if(inP&&e.type==="click"){ var nx=!!t.closest("#bgNext"); setTimeout(function(){ if(dead) return; if(nx) next(); kick(); nowLine(); },0); return; }
    kick();
  }
  function state(){
    var P=SP();
    return {moment:want.m,info:{round:want.info&&want.info.round||null,last:!!(want.info&&want.info.last)},playing:cur,synth:synth,pend:pend,muted:muted(),running:running(),t:+tnow().toFixed(3),
      hold:+hold.toFixed(3),holdWhat:holdWhat,titleUntil:+titleUntil.toFixed(3),opened:Object.keys(opened),podded:Object.keys(podded),gain:+gain.toFixed(3),
      show:okSound()?{man:!!P.man,titleDone:!!P.titleDone,stakes:P.stakes,rot:P.rot||null,mem:S.show.mem()}:null,profile:S&&S.mix&&S.mix.get?S.mix.get():null,log:logA.slice()};
  }
  /* the effects keep Motocross War's own flavour (sound.js recolours them by the game's music style): the style is set without a note of the playlist
     (Music off for that one call: the playlist schedules nothing), and the playlist that may be playing (the Party lobby's) stops */
  (function keepStyle(){ if(!S||typeof S.music!=="function") return; var st=S.state, mm=st?st.mm:false; try{ if(st) st.mm=true; S.music(GM); S.stop(); }catch(e){} if(st) st.mm=mm; })();
  var M={at:at,flag:flag,plays:plays,next:next,credits:function(){ return credits(PK); },state:state,
    _kick:kick,_gesture:gesture,_now:nowLine,_retire:function(){ dead=true; clearTimeout(tmr); }};
  ACTIVE=M; hookCtx();
  if(okSound()&&!S.show.has("menu")){ manP=S.show.load(PK,{cues:[]}).then(function(){ manP=null; if(pend||want.m) apply(); },function(){ manP=null; manFail=true; if(want.m) apply(); }); }   // the manifest early (no decoding before audio starts)
  return M;
}

/* the first tap or key starts audio in a browser (sound.js unlocks first: its listeners came first); the sound panel's Music on / off, Next song and
   "Now playing" (the panel is sound.js's, shared by every game: this only listens) */
if(doc){
  ["pointerdown","keydown","touchstart","click"].forEach(function(ev){ doc.addEventListener(ev,function(e){ if(ACTIVE) try{ ACTIVE._gesture(e); }catch(x){} },true); });
  doc.addEventListener("input",function(e){ var t=e.target; if(ACTIVE&&t&&t.closest&&t.closest("#bgSoundPanel")) setTimeout(function(){ if(ACTIVE) ACTIVE._now(); },0); },true);
  doc.addEventListener("visibilitychange",function(){ if(ACTIVE&&!doc.hidden) try{ ACTIVE._kick(); }catch(e){} });
}
MXW.Music={create:create,credits:credits,creditsHTML:creditsHTML,active:function(){ return ACTIVE; }};
})(window);
